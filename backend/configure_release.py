"""Configure the linked Railway service without logging or argv-exposing secrets."""
import subprocess
from pathlib import Path
from dotenv import dotenv_values

if __name__ == '__main__':
    local = dotenv_values(Path(__file__).with_name('.env'))
    values = {key: local.get(key) for key in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPERADMIN_EMAILS', 'INTEGRATION_ENCRYPTION_KEY')}
    assert all(values.values()), 'Missing required local production configuration'
    values.update(APP_ENV='production', CORS_ORIGINS='https://clickagenda-iota.vercel.app', FRONTEND_URL='https://clickagenda-iota.vercel.app', BACKEND_PUBLIC_URL='https://clickagenda-production.up.railway.app', PASSWORD_RESET_REDIRECT_URL='https://clickagenda-iota.vercel.app/redefinir-senha')
    for key, value in values.items():
        result = subprocess.run(['npx.cmd','--yes','@railway/cli','variable','set',key,'--stdin','--skip-deploys'], input=value, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Failed to configure ' + key)
        print('Configured:', key, flush=True)
