#!/usr/bin/env python3
"""Interactive local setup, no credentials written to GitHub."""
import os, pathlib, secrets, getpass, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
print('RSCDS guided setup: Vercel website + Aiven PostGIS + Python imagery worker')
print('Credentials must be entered locally. Never paste them into support chats or commit them.')
url=getpass.getpass('Aiven PostgreSQL DATABASE_URL (leave blank to configure later): ').strip()
api=getpass.getpass('ADMIN_API_KEY (leave blank to generate): ').strip() or secrets.token_urlsafe(40)
if len(api)<24:sys.exit('API key must be at least 24 characters.')
lines=[f'DATABASE_URL={url}',f'ADMIN_API_KEY={api}']
env=root/'.env.local'; env.write_text('\n'.join(lines)+'\n');
try:os.chmod(env,0o600)
except OSError:pass
print(f'Created {env}. Keep private. Admin key created locally.')
if url:
 print('Apply the namespaced PostGIS migration by running:')
 print('  PGDATABASE="$DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -f scripts/schema.sql')
else:print('Database not configured; STAC scene search will work, detection persistence will not.')
print('Deploy from this directory with: npx vercel --prod')
print('Set DATABASE_URL and ADMIN_API_KEY in the Vercel project environment settings, not in source control.')
