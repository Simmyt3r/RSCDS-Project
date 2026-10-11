import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
test('operator sees distinct idle, queued, running and completed queue states',()=>{
 const js=file('public/app.js'),html=file('public/index.html');
 for(const key of ['queued','running','completed','failed'])assert.ok(js.includes(`['${key}'`));
 assert.match(js,/successful GitHub workflow only checked for work/);
 assert.match(html,/id="queue-summary"/);
 assert.match(html,/id="queue-guidance"/);
});
test('completed analysis can be opened with private job_id filter',()=>{
 const js=file('public/app.js'),api=file('api/detections.js');
 assert.match(js,/viewJobResults\(job.id\)/);
 assert.match(js,/encodeURIComponent\(state.selectedJob\)/);
 assert.match(api,/validUUID\(jobId\)/);
 assert.match(api,/job_id=\$\{jobId\}::uuid/);
 assert.match(api,/j.status='completed'/);
});
test('browser never persists administrator key',()=>{
 const js=file('public/app.js');
 assert.doesNotMatch(js,/localStorage\.setItem\([^)]*(admin|secret|state\.key)/i);
});
