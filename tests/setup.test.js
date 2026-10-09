import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const load=file=>fs.readFileSync(path.join(dir,'..',file),'utf8');

test('standalone browser-first setup assistant is committed with all provider steps',()=>{
 const html=load('public/setup.html');
 assert.match(html,/<!doctype html>/i);
 assert.equal((html.match(/data-step="[0-5]"/g)||[]).length,6);
 for(const name of ['DATABASE_URL','ADMIN_API_KEY','WORKER_API_KEY','RSCDS_DEPLOY_URL','RSCDS_WORKER_API_KEY']) assert.ok(html.includes(name),`${name} missing`);
 assert.match(html,/vercel\.com\/new/);
 assert.match(html,/console\.aiven\.io/);
 assert.match(html,/getRandomValues/);
 assert.doesNotMatch(html,/localStorage|sessionStorage|document\.cookie/);
 assert.match(html,/No coordinates are entered/);
});

test('Windows setup launcher opens the standalone wizard without invoking a CLI',()=>{
 const cmd=load('START_SETUP_WINDOWS.bat');
 assert.match(cmd,/public\\setup\.html/);
 assert.doesNotMatch(cmd,/(npm|psql|powershell|curl|python)\s+/i);
});

test('health endpoint verifies private queue migration rather than only base tables',()=>{
 const code=load('api/health.js');
 assert.match(code,/rscds\.analysis_jobs/);
 assert.match(code,/has_job_link/);
 assert.match(code,/migration required/);
});
