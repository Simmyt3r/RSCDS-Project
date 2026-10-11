import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Vercel build preflight passes with no production credentials',()=>{
 const output=execFileSync(process.execPath,['scripts/preflight.mjs'],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.match(output,/preflight PASS/);
});
test('deployment config explicitly chooses Other and static public output',()=>{
 const config=JSON.parse(read('vercel.json'));
 assert.equal(config.framework,null);
 assert.equal(config.outputDirectory,'public');
 assert.equal(config.buildCommand,'npm run build');
 assert.deepEqual(config.regions,['sfo1']);
 assert.equal(config.functions['api/*.js'].maxDuration,30);
});
test('deployment assistant tests HTTP routes and distinct secrets',()=>{
 const html=read('public/setup.html');
 for(const entry of ['/api/health','/api/detections','/api/jobs','/api/worker','/api/scenes?bbox=bad'])assert.ok(html.includes(entry),`${entry} missing`);
 assert.match(html,/keysIndependent/);
});
test('private API response is not cached and static output is not publicly framed',()=>{
 const headers=JSON.stringify(JSON.parse(read('vercel.json')).headers);
 assert.match(headers,/no-store/);
 assert.match(headers,/DENY/);
 assert.match(headers,/nosniff/);
});
test('no production secrets needed for build or embedded in Vercel config',()=>{
 const config=read('vercel.json');
 assert.doesNotMatch(config,/postgresql:\/\//);
 assert.doesNotMatch(config,/ADMIN_API_KEY|WORKER_API_KEY|DATABASE_URL/);
});
