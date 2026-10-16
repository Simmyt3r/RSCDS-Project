import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MIGRATIONS,checksum,stateFor,validateApply,perform} from '../api/_migrations.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pending=MIGRATIONS.map(x=>x.id);
test('versioned migrations cover the canonical schema without arbitrary client SQL',()=>{
 const canonical=read('scripts/schema.sql').split('\n')
  .filter(l=>!l.trim().startsWith('--')).join('\n').split(';').map(x=>x.trim()).filter(Boolean);
 const actual=MIGRATIONS.flatMap(x=>x.sql);
 assert.equal(actual.length,canonical.length);
 assert.deepEqual([...actual].sort(),[...canonical].sort());
 assert.equal(MIGRATIONS.length,3);
 for(const m of MIGRATIONS) {
  assert.match(m.id,/^\d{3}_[a-z_]+$/);
  assert.match(checksum(m),/^[a-f0-9]{64}$/);
  assert.ok(m.sql.every(statement=>/^(CREATE|ALTER) /.test(statement)));
 }
});
test('dry-run summary catches checksum drift and is read-only',()=>{
 const a=stateFor([{id:pending[0],checksum:checksum(MIGRATIONS[0])}]);
 assert.equal(a[0].status,'applied');
 assert.equal(a[1].status,'pending');
 assert.equal(stateFor([{id:pending[0],checksum:'bad'}])[0].status,'checksum_mismatch');
});
test('admin consent and exact pending-version snapshot are required',()=>{
 const request={action:'apply',confirmation:'APPLY_RSCDS_MIGRATIONS',expectedPending:pending};
 assert.doesNotThrow(()=>validateApply(request,pending));
 for(const body of [null,{}, {...request,sql:'DROP TABLE rscds.detections',
  expectedPending:[]},{...request,confirmation:'yes'},{...request,expectedPending:pending.slice(1)}])
  assert.throws(()=>validateApply(body,pending));
});
function mockDatabase({current=[],lock=true}={}){
 const statements=[];
 const tx=async (chunks,...args)=>{
  const sql=chunks.join('$');
  if(sql.includes('pg_try_advisory_xact_lock'))return [{locked:lock}];
  if(sql.includes('to_regclass'))return [{exists:current.length>0}];
  if(sql.includes('SELECT id,checksum'))return current;
  if(sql.includes('INSERT INTO rscds.schema_migrations')){statements.push('history:'+args[0]);return [];}
  throw Error('Unexpected tagged SQL in mock: '+sql.slice(0,90));
 };
 tx.unsafe=async text=>{statements.push(text);return [];};
 const db={begin:fn=>fn(tx)};
 return {db,statements};
}
test('migrations apply in one transaction with advisory locking and history',async()=>{
 const m=mockDatabase();
 assert.deepEqual(await perform(m.db,{action:'apply',confirmation:'APPLY_RSCDS_MIGRATIONS',expectedPending:pending}),pending);
 assert.match(m.statements[0],/statement_timeout/);
 assert.ok(m.statements.some(x=>x.includes('CREATE SCHEMA IF NOT EXISTS rscds')));
 for(const id of pending)assert.ok(m.statements.includes('history:'+id));
});
test('migrations never execute DDL after stale snapshot or busy lock',async()=>{
 for(const option of [{current:[],lock:false},{current:[],lock:true}]){
  const m=mockDatabase(option);
  await assert.rejects(()=>perform(m.db,{action:'apply',confirmation:'no',expectedPending:[]}));
  assert.equal(m.statements.length,0);
 }
});
test('setup UI requires admin key, version confirmation and does not store credentials',()=>{
 const ui=read('public/migrations.js'),endpoint=read('api/migrations.js'),html=read('public/index.html');
 assert.match(endpoint,/requireAdmin\(req,res\)/);
 assert.match(endpoint,/req\.headers\.origin/);
 assert.doesNotMatch(endpoint,/body\.sql|req\.query\.sql|eval\(/);
 assert.match(ui,/Authorization:'Bearer '/);
 assert.match(ui,/migration-consent/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|document\.cookie/);
 for(const id of ['migration-check','migration-key','migration-apply','migration-consent'])
  assert.ok(html.includes('id="'+id+'"'));
});
