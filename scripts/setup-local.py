from pathlib import Path
import secrets
p=Path('.env')
if p.exists():
    print('Existing .env preserved. Configure missing variables using .env.example.')
else:
    token=secrets.token_hex(32);password=secrets.token_hex(24)
    p.write_text(f'API_KEY={token}\nBIDGUARD_API_KEY={token}\nBIDGUARD_BACKEND_URL=http://127.0.0.1:8000\nPOSTGRES_PASSWORD={password}\nDATABASE_URL=postgresql+psycopg://bidguard:{password}@127.0.0.1:55432/bidguard\n',encoding='utf-8')
    print('Local configuration created; secrets were not printed.')
