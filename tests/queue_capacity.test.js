import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectedGridPixels,validateJobRequest} from '../api/_jobs.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const windows={before:'2025-01-01/2025-03-31',after:'2026-01-01/2026-03-31'};
test('sample study area remains within 1024 pixels at approximately 10m',()=>{
 const p=projectedGridPixels([8.2,7.6,8.25,7.65]);
 assert.ok(p.width>400&&p.width<800);
 assert.ok(p.height>400&&p.height<800);
 assert.equal(validateJobRequest({bbox:[8.2,7.6,8.25,7.65],...windows}).minPixels,9);
});
test('high latitude boxes fail before queuing rather than silently downgrading resolution',()=>{
 const p=projectedGridPixels([8.2,75,8.25,75.05]);
 assert.ok(p.height>1024);
 assert.throws(()=>validateJobRequest({bbox:[8.2,75,8.25,75.05],...windows}),/exceeds 1024 pixels/);
});
test('worker lease and analysis queue fail closed if evidence schema is missing',()=>{
 const jobs=read('api/jobs.js'),worker=read('api/worker.js');
 assert.match(jobs,/if\(!schema\?\.evidence_ready\)return send\(res,503/);
 assert.match(worker,/if\(!schema\?\.evidence_ready\)return send\(res,503/);
 assert.match(worker,/attrelid=to_regclass\('rscds\.analysis_jobs'\)/);
});
test('visible status does not claim operational health on a schema mismatch',()=>{
 const dashboard=read('public/app.js');
 assert.match(dashboard,/ready\?'System operational':'Database needs attention'/);
 assert.match(dashboard,/classList\.toggle\('ok',ready\)/);
});
