"""Read-only release audit. Never prints credentials, hashes or client data."""
import json
import subprocess
from pymongo import MongoClient
import server
from supabase_core import supabase

def railway_variables():
    result = subprocess.run(['npx.cmd', '--yes', '@railway/cli', 'variable', 'list', '--json'], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

if __name__ == '__main__':
    variables = railway_variables()
    source = MongoClient(variables['MONGO_URL'], serverSelectionTimeoutMS=15000)
    db = source[variables['DB_NAME']]
    users = list(db.users.find({}, {'email':1, 'user_id':1, 'slug':1}))
    auth_users = supabase.auth.admin.list_users(per_page=1000)
    emails = {user.email.lower() for user in auth_users if user.email}
    print(json.dumps({'legacy_counts':{name:db[name].count_documents({}) for name in db.list_collection_names()}, 'supabase_auth_users':len(auth_users), 'legacy_accounts_missing_in_supabase':sum(user.get('email','').lower() not in emails for user in users)}, indent=2))
    for table, legacy_key, collection in [('profiles','id','users'), ('services','legacy_service_id','services'), ('clients','legacy_client_id','clients'), ('appointments','legacy_appointment_id','appointments')]:
        rows = supabase.table(table).select(legacy_key).execute().data
        print(table, 'supabase_rows', len(rows))
        if table != 'profiles':
            source_key = legacy_key.replace('legacy_', '')
            saved = {row[legacy_key] for row in rows}
            missing = sum(row.get(source_key) not in saved for row in db[collection].find({}, {source_key:1}))
            print(table, 'missing_legacy_rows', missing)
    for table in ['subscriptions','payment_events','platform_settings','admin_audit_logs']:
        try:
            supabase.table(table).select('*', head=True).limit(1).execute()
            print(table, 'ready')
        except Exception:
            print(table, 'missing_or_unavailable')
