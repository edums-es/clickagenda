"""One-time copy into Supabase; source remains untouched, secrets never printed.
Requires pymongo only for this operational task, not the deployed application.
"""
import argparse
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from bson import json_util
from cryptography.fernet import Fernet
from pymongo import MongoClient
import httpx
import os
import server
from supabase_core import supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from release_audit import railway_variables

logging.getLogger('httpx').setLevel(logging.WARNING)
def normalize(value):
    digits = ''.join(filter(str.isdigit, value or ''))
    return '55' + digits if len(digits) == 11 else digits

def run():
    config = railway_variables()
    db = MongoClient(config['MONGO_URL'], serverSelectionTimeoutMS=15000)[config['DB_NAME']]
    snapshot = {name:list(db[name].find()) for name in db.list_collection_names()}
    encrypted = Fernet(os.environ['INTEGRATION_ENCRYPTION_KEY'].encode()).encrypt(json_util.dumps(snapshot).encode())
    backup = 'migration-backups/' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json.enc'
    supabase.storage.from_('platform-secrets').upload(backup, encrypted, file_options={'content-type':'application/octet-stream'})
    print('Encrypted full source snapshot saved privately:', backup, flush=True)
    # Client accounts do not own public professional URLs. Give their internal
    # profile a deterministic ASCII identifier accepted by the restored schema.
    for user in snapshot.get('users', []):
        if user.get('role') == 'client':
            user['slug'] = 'cliente-' + uuid.uuid5(uuid.NAMESPACE_URL, user['user_id']).hex[:12]
    accounts = {u.email.lower():u for u in supabase.auth.admin.list_users(per_page=1000) if u.email}
    profiles = {p['slug']:p for p in supabase.table('profiles').select('id,slug').execute().data if p.get('slug')}
    # Preflight all account conflicts before importing anything.
    for user in snapshot.get('users',[]):
        email = user['email'].lower()
        existing = accounts.get(email)
        collision = profiles.get(user.get('slug'))
        if collision and (not existing or str(existing.id) != collision['id']):
            raise RuntimeError('Legacy public slug conflicts with a different Supabase account; review required')
        if not existing and not (user.get('password_hash') or '').startswith(('$2a$', '$2b$', '$2y$')):
            raise RuntimeError('Account without a portable bcrypt hash; explicit recovery required')
    owner_map = {}
    for user in snapshot.get('users',[]):
        email = user['email'].lower()
        existing = accounts.get(email)
        if existing:
            owner_map[user['user_id']] = str(existing.id)
            continue
        owner = str(uuid.uuid5(uuid.NAMESPACE_URL, 'clickagenda:legacy:' + user['user_id']))
        payload = {'id':owner, 'email':email, 'password_hash':user['password_hash'], 'email_confirm':True, 'user_metadata':{'full_name':user['name'], 'business_name':user.get('business_name',''), 'slug':user.get('slug','')}}
        response = httpx.post(SUPABASE_URL + '/auth/v1/admin/users', headers={'apikey':SUPABASE_SERVICE_ROLE_KEY, 'Authorization':'Bearer ' + SUPABASE_SERVICE_ROLE_KEY}, json=payload, timeout=30)
        if response.status_code not in (200,201):
            error = response.json()
            raise RuntimeError(f"Account migration failed: HTTP {response.status_code}; code={error.get('error_code')}; message={error.get('msg') or error.get('message')}")
        owner = response.json()['id']
        profile = {key:user[key] for key in ('business_name','phone','bio','business_type','address','city','state','picture','cover_picture','social_links','featured_service_ids','min_advance_hours','cancellation_policy_hours','onboarding_completed') if key in user}
        profile.update(full_name=user['name'], role=user.get('role','professional'), plan='pro' if user.get('plan') == 'pro' else 'freemium')
        supabase.table('profiles').update(profile).eq('id',owner).execute()
        owner_map[user['user_id']] = owner
    counts = {}
    services = {}
    clients = {}
    for collection, table, key in [('services','services','service_id'),('clients','clients','client_id')]:
        count = 0
        for row in snapshot.get(collection,[]):
            owner = owner_map[row['user_id']]
            legacy_key = 'legacy_' + key
            saved = supabase.table(table).select('id').eq('professional_id',owner).eq(legacy_key,row[key]).execute().data
            if not saved:
                data = {'professional_id':owner, legacy_key:row[key]}
                if table == 'services':
                    data.update({field:row[field] for field in ('name','description','duration_minutes','buffer_minutes','category','active') if field in row})
                    data['price_cents'] = round(float(row.get('price',0))*100)
                else:
                    data.update({field:row[field] for field in ('name','phone','email','notes','tags','last_visit') if field in row})
                    data['phone_norm'] = normalize(row.get('phone',''))
                saved = supabase.table(table).insert(data).execute().data
                count += 1
            (services if table == 'services' else clients)[row[key]] = saved[0]['id']
        counts[table] = count
    for collection, table in [('availability_rules','availability_rules'),('breaks','availability_breaks')]:
        count = 0
        for row in snapshot.get(collection,[]):
            owner = owner_map[row['user_id']]
            weekday = (int(row['day_of_week']) + 1) % 7
            data = {'professional_id':owner, 'weekday':weekday, 'start_time':row['start_time'], 'end_time':row['end_time']}
            if table == 'availability_rules': data['active'] = row.get('is_active',True)
            saved = supabase.table(table).select('id').eq('professional_id',owner).eq('weekday',weekday).execute().data
            if not saved:
                supabase.table(table).insert(data).execute()
                count += 1
            elif table == 'availability_rules':
                # New-account triggers seed default hours. Replace only hours
                # of the deterministic accounts owned by this migration.
                assert owner == str(uuid.uuid5(uuid.NAMESPACE_URL, 'clickagenda:legacy:' + row['user_id']))
                supabase.table(table).update(data).eq('id',saved[0]['id']).eq('professional_id',owner).execute()
        counts[table] = count
    count = 0
    for row in snapshot.get('appointments',[]):
        owner = owner_map[row['user_id']]
        if supabase.table('appointments').select('id').eq('professional_id',owner).eq('legacy_appointment_id',row['appointment_id']).execute().data: continue
        zone = ZoneInfo('America/Sao_Paulo')
        start = datetime.fromisoformat(row['date'] + 'T' + row['start_time']).replace(tzinfo=zone)
        end = datetime.fromisoformat(row['date'] + 'T' + row['end_time']).replace(tzinfo=zone)
        if end <= start: end += timedelta(days=1)
        service = next((s for s in snapshot['services'] if s['service_id'] == row['service_id']), {})
        buffer = int(service.get('buffer_minutes',0))
        client = next((c for c in snapshot['clients'] if c['user_id'] == row['user_id'] and normalize(c.get('phone')) == normalize(row.get('client_phone'))), {})
        data = {key:row[key] for key in ('client_name','client_phone','client_email','notes','status','service_name','token') if key in row}
        data.update(professional_id=owner, legacy_appointment_id=row['appointment_id'], service_id=services.get(row['service_id']), client_id=clients.get(client.get('client_id')), service_price=round(float(row.get('service_price',0))*100), appointment_date=row['date'], start_time=row['start_time'], end_time=row['end_time'], start_at=start.isoformat(), end_at=end.isoformat(), buffer_minutes=buffer, blocked_until=(end+timedelta(minutes=buffer)).isoformat())
        supabase.table('appointments').insert(data).execute()
        count += 1
    counts['appointments'] = count
    print('Migration complete. Source untouched. Inserted:', json.dumps(counts), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    if not parser.parse_args().apply: parser.error('--apply required')
    run()
