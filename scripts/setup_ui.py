#!/usr/bin/env python3
"""Local-only zero-extra-dependency browser installer for RSCDS.
Run `python scripts/setup_ui.py`, then follow the displayed loopback URL.
No network API or external connection occurs until explicitly requested.
"""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs
import os, secrets, pathlib, subprocess, shutil, threading, webbrowser, html

ROOT=pathlib.Path(__file__).resolve().parents[1]
TOKEN=secrets.token_urlsafe(28)
CSS='''<style>*{box-sizing:border-box}body{font:15px system-ui;background:#f3f7fa;color:#193247;max-width:700px;margin:48px auto;padding:20px}main{background:white;border:1px solid #dce5ed;border-radius:17px;padding:32px;box-shadow:0 14px 46px #14324916}h1{margin-top:0}label{display:block;margin:19px 0 5px;font-weight:700;font-size:13px}input{width:100%;padding:13px;border:1px solid #b9cfda;border-radius:8px}button{padding:12px 20px;border:0;border-radius:8px;background:#0b8a84;color:white;font-weight:700;cursor:pointer;margin-top:22px}.note{background:#eaf6f8;padding:14px;border-radius:9px;color:#366073;line-height:1.6}.muted{font-size:12px;color:#789}.ok{color:#14765c}</style>'''
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass  # no request bodies or credentials in logs
    def page(self,body,status=200):
        output=('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>RSCDS Setup</title>'+CSS+'<main>'+body+'</main>').encode()
        self.send_response(status);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(output)));self.send_header('Cache-Control','no-store');self.send_header('X-Frame-Options','DENY');self.end_headers();self.wfile.write(output)
    def do_GET(self):
        if self.path!='/':return self.page('<h1>Not found</h1>',404)
        self.page('''<h1>◈ RSCDS guided setup</h1><p>Configure Aiven connection and administrator key. This installer runs only on your computer at <b>127.0.0.1</b>, not on the public Internet.</p><div class="note">Your credentials will be written locally to <code>.env.local</code>, which is excluded from Git. The Vercel dashboard needs the same values entered as encrypted environment variables.</div><form method="POST" action="/configure"><input type="hidden" name="token" value="'''+TOKEN+'''"><label>Aiven PostgreSQL connection URL</label><input type="password" name="url" placeholder="postgresql://...@.../defaultdb?sslmode=require" autocomplete="off"><p class="muted">Optional until the database is ready. Prefer a dedicated database or isolated schema.</p><label>Administrator API key</label><input type="password" name="key" placeholder="Leave blank to generate a random key" autocomplete="off"><label><input type="checkbox" name="migrate" value="yes" style="width:auto"> Apply the isolated PostGIS schema immediately (requires psql installed)</label><button type="submit">Save local configuration</button></form><p class="muted">Only submit trusted Aiven connection details; no data are uploaded to third parties by this page.</p>''')
    def do_POST(self):
        if self.path!='/configure':return self.page('<h1>Not found</h1>',404)
        try:
            length=int(self.headers.get('Content-Length',0))
            if length<=0 or length>20000:return self.page('Invalid form length',413)
            q=parse_qs(self.rfile.read(length).decode('utf-8'),keep_blank_values=True)
            if q.get('token',[''])[0]!=TOKEN:return self.page('Invalid setup token',403)
            url=q.get('url',[''])[0].strip();key=q.get('key',[''])[0].strip() or secrets.token_urlsafe(40)
            if '\n' in url or '\r' in url or not (not url or url.startswith(('postgresql://','postgres://'))):return self.page('Invalid PostgreSQL URL',400)
            if len(key)<24 or '\n' in key or '\r' in key:return self.page('API key must be at least 24 characters',400)
            path=ROOT/'.env.local'
            path.write_text('DATABASE_URL='+url+'\nADMIN_API_KEY='+key+'\n')
            if os.name=='posix':os.chmod(path,0o600)
            status='No database migration attempted.'
            if q.get('migrate')==['yes']:
                if not url:status='Migration skipped: DATABASE_URL is empty.'
                elif not shutil.which('psql'):status='Migration not run: psql is not installed. Use the command shown in the manual.'
                else:
                    # Never put credentials on command line or in subprocess output.
                    env=dict(os.environ,PGDATABASE=url)
                    p=subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-f',str(ROOT/'scripts/schema.sql')],cwd=ROOT,env=env,text=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=90)
                    status='Migration succeeded.' if p.returncode==0 else 'Migration failed. Inspect PostgreSQL permissions and connection. No secrets logged.'
            body='<h1 class="ok">Local configuration saved</h1><p>'+html.escape(status)+'</p><p><b>Next:</b> Set DATABASE_URL and ADMIN_API_KEY in your Vercel project environment variables. Never post them publicly.</p><p>Check <code>scripts/schema.sql</code> and run unit tests before deployment.</p><p class="muted">Generated key is inside your private .env.local file and is intentionally not displayed in the browser response.</p>'
            self.page(body)
        except Exception:
            self.page('Could not finish setup. Check file permissions and configuration.',500)
if __name__=='__main__':
    server=HTTPServer(('127.0.0.1',0),Handler)
    url=f'http://127.0.0.1:{server.server_port}/'
    print('RSCDS local setup UI:',url,flush=True)
    webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nSetup server stopped.')
