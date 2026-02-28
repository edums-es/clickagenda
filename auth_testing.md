# Auth Testing Playbook for Click Agenda

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  slug: 'test-user-' + Date.now(),
  phone: '(11) 99999-9999',
  bio: 'Profissional de teste',
  picture: '',
  business_name: 'Salao Teste',
  business_type: 'Salao',
  address: 'Rua Teste, 123',
  min_advance_hours: 2,
  cancellation_policy_hours: 6,
  onboarding_completed: false,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
curl -X GET "BACKEND_URL/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "BACKEND_URL/api/services" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X POST "BACKEND_URL/api/services" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_SESSION_TOKEN" -d '{"name":"Corte","duration_minutes":30,"price":50,"buffer_minutes":10}'
```

## Step 3: Browser Testing
```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com/dashboard");
```
