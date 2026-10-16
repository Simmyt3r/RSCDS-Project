import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('concurrent job admission is serialized with a transactional database lock',()=>{
 const jobs=source('api/jobs.js');
 assert.match(jobs,/pg_try_advisory_xact_lock\(874301,506\)/);
 assert.match(jobs,/COUNT\(\*\)::int AS count/);
 assert.match(jobs,/await sql\.begin\(async tx=>/);
 assert.match(jobs,/if\(created\.full\)return send\(res,429/);
});
test('worker completion atomically proves stored scene IDs equal chosen source scenes',()=>{
 const worker=source('api/worker.js');
 assert.match(worker,/const completed=await sql\.begin\(async tx=>/);
 assert.match(worker,/FOR UPDATE/);
 assert.match(worker,/scene_before IS DISTINCT FROM/);
 assert.match(worker,/scene_after IS DISTINCT FROM/);
 assert.match(worker,/Uploaded candidate scenes do not match processing provenance/);
});
