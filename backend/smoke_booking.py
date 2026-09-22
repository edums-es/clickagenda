"""Opt-in integration test against configured Supabase; owns and cleans its fixture.

Run: python smoke_booking.py --allow-test-fixture
Never uses an existing professional or sends messages/email.
"""
import argparse
import base64
import logging
import secrets
import uuid
import httpx
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
import server
import supabase_core as core


def run(base_url=None, pause_for_ui=False):
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    fixture_id = None
    object_path = None
    slug = 'qa-booking-' + secrets.token_hex(6)
    def client():
        return httpx.Client(base_url=base_url, timeout=30) if base_url else TestClient(server.app)
    api = client()
    def check(response, expected=200):
        if response.status_code != expected:
            raise AssertionError(f'{response.request.method} {response.request.url.path}: {response.status_code} {response.text[:200]}')
        return response.json()
    try:
        password = secrets.token_urlsafe(32) + 'A9'
        registration = api.post('/api/auth/register', json={'name':'QA temporário', 'slug':slug,
            'email':slug + '@example.invalid', 'password':password, 'role':'superadmin'})
        account = check(registration)['user']
        fixture_id = account['user_id']
        assert account['role'] == 'professional', 'Public registration must not grant admin privileges'
        assert check(api.get('/api/auth/me'))['user_id'] == fixture_id
        if base_url:
            cookie = registration.headers.get('set-cookie', '').lower()
            assert 'httponly' in cookie and 'secure' in cookie and 'samesite=lax' in cookie
        check(api.post('/api/auth/logout'))
        check(api.get('/api/auth/me'), 401)
        profile = core.supabase.table('profiles').update({'phone':'5511984567231', 'onboarding_completed':True}).eq('id', fixture_id).execute().data[0]
        check(api.post('/api/auth/login', json={'email':slug + '@example.invalid', 'password':password}))
        assert check(api.get('/api/auth/me'))['user_id'] == fixture_id
        check(api.get('/api/admin/overview'), 403)
        check(api.get('/api/admin/integrations'), 403)
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=')
        image = check(api.post('/api/profile/upload?image_type=service', files={'file':('test.png', png, 'image/png')}))
        object_path = image['url'].split('/profile-media/')[1].split('?')[0]
        service = check(api.post('/api/services', json={'name':'QA Corte', 'description':'Descrição de teste', 'image_url':image['url'], 'duration_minutes':30, 'buffer_minutes':15, 'price':69.9}))
        day = (datetime.now(ZoneInfo('America/Sao_Paulo')) + timedelta(days=2)).date()
        check(api.post('/api/availability', json={'rules':[{'day_of_week':(day.weekday()+1)%7, 'start_time':'09:00', 'end_time':'12:00', 'is_active':True}], 'breaks':[]}))
        public = check(api.get('/api/public/' + slug))
        assert public['services'][0]['image_url'] == image['url']
        assert public['services'][0]['description'] == 'Descrição de teste'
        assert 'email' not in public['professional']
        slots = check(api.get(f'/api/public/{slug}/slots', params={'date':str(day), 'service_id':service['service_id']}))['slots']
        assert slots and slots[0]['start_time'] == '09:00'
        payload = {'service_id':service['service_id'], 'client_name':'QA Cliente', 'client_phone':'11984567231', 'date':str(day), 'start_time':slots[0]['start_time'], 'booking_request_id':str(uuid.uuid4())}
        check(api.post('/api/public/' + slug + '/book', json={**payload, 'client_phone':'27999999999'}), 422)
        check(api.post('/api/public/' + slug + '/book', json={**payload, 'start_time':'08:00'}), 409)
        booking = check(api.post('/api/public/' + slug + '/book', json=payload))
        assert booking['whatsapp_url'].startswith('https://wa.me/5511984567231?text=')
        repeated = check(api.post('/api/public/' + slug + '/book', json=payload))
        assert repeated['appointment_id'] == booking['appointment_id']
        check(api.post('/api/public/' + slug + '/book', json={**payload, 'booking_request_id':str(uuid.uuid4())}), 409)
        feed = check(api.get('/api/notifications'))
        assert len(feed['items']) == feed['unread_count'] == 1
        assert feed['items'][0]['kind'] == 'booking_created'
        check(api.post('/api/notifications/read', json={'ids':[feed['items'][0]['id']]}))
        assert check(api.get('/api/notifications'))['unread_count'] == 0
        clients = check(api.get('/api/clients'))
        assert len(clients) == 1
        check(api.put('/api/appointments/' + booking['appointment_id'] + '/status', json={'status':'cancelled'}))
        assert check(api.get('/api/notifications'))['unread_count'] == 1
        refreshed = check(api.get(f'/api/public/{slug}/slots', params={'date':str(day), 'service_id':service['service_id']}))['slots']
        assert refreshed[0]['start_time'] == '09:00'
        def race(_):
            with client() as concurrent_api:
                return concurrent_api.post('/api/public/' + slug + '/book', json={**payload, 'booking_request_id':str(uuid.uuid4())}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(race, range(2))) == [200, 409]
        stats = check(api.get('/api/dashboard/stats', params={'start_date':str(day), 'end_date':str(day)}))
        assert len(stats['recent_appointments']) == len(stats['upcoming_clients']) == 1
        assert stats['upcoming_clients'][0]['service_name'] == 'QA Corte'
        assert not check(api.get('/api/dashboard/stats', params={'start_date':'2000-01-01', 'end_date':'2000-01-02'}))['recent_appointments']
        check(api.get('/api/dashboard/stats', params={'start_date':'2099-01-01', 'end_date':'2000-01-01'}), 422)
        print('PASS: registration, privilege restriction, login/session/logout, upload, catalog, availability, validation, booking, retry, concurrent conflict, clients, notifications, cancellation and dashboard metrics.')
        if pause_for_ui:
            print(f'Disposable UI fixture: {slug}@example.invalid\nPassword: {password}\nPublic slug: {slug}', flush=True)
            input('Press Enter after browser checks to remove this fixture: ')
    finally:
        api.close()
        server.app.dependency_overrides.clear()
        if not fixture_id:
            # A registration failure may occur after Auth created the account.
            # Only reconcile this unpredictable, test-owned email/slug pair.
            rows = core.supabase.table('profiles').select('id').eq('slug', slug).execute().data
            if rows:
                candidate = core.supabase.auth.admin.get_user_by_id(rows[0]['id']).user
                if candidate.email == slug + '@example.invalid':
                    fixture_id = str(candidate.id)
        if object_path:
            assert object_path.startswith(fixture_id + '/')
            core.supabase.storage.from_('profile-media').remove([object_path])
        if fixture_id:
            core.supabase.auth.admin.delete_user(fixture_id)
            print('Removed only the generated QA account, related rows and test image.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-test-fixture', action='store_true')
    parser.add_argument('--base-url', help='Test the deployed API through its public frontend origin')
    parser.add_argument('--pause-for-ui', action='store_true', help='Keep the disposable fixture until interactive browser checks finish')
    args = parser.parse_args()
    if not args.allow_test_fixture:
        parser.error('Explicit --allow-test-fixture is required')
    if args.base_url and args.base_url != 'https://clickagenda-iota.vercel.app':
        parser.error('Remote fixtures are restricted to the authorized production origin')
    run(args.base_url, args.pause_for_ui)
