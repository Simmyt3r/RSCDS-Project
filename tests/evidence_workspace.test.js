import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('public/evidence-workspace.js');
const html=read('public/index.html');
const nav=read('public/navigation.js');
const app=read('public/app.js');
const compare=read('public/imagery-compare.js');

test('private evidence workspace is reachable from sidebar and completed job rows',()=>{
 assert.match(html,/href="#evidence"/);
 assert.match(html,/id="tab-evidence"/);
 assert.match(nav,/evidence:'Visual evidence'/);
 assert.match(app,/RSCDSEvidence\.openJob\(jobId,state\.key\)/);
 assert.match(html,/src="\/evidence-workspace.js"/);
});
test('evidence only loads protected job-bound sources and paginates results',()=>{
 assert.match(script,/Authorization:'Bearer '\+S\.key/);
 assert.match(script,/\/api\/evidence\?job_id=/);
 assert.match(script,/next_offset/);
 assert.match(script,/Load more features|evidence-next/);
 assert.match(script,/job\.scene_before|j\.scene_before/);
});
test('local evidence grid never loads external map tile services',()=>{
 assert.match(script,/L\.gridLayer/);
 assert.doesNotMatch(script,/tileLayer\(|maplibreGL\(/);
 assert.match(script,/getContext\('2d'\)/);
});
test('private reviews include independent rationale and immutable status checks',()=>{
 assert.match(script,/\/api\/review/);
 assert.match(script,/reviewer\.length<3\|\|notes\.length<10/);
 assert.match(script,/review_status!=='unverified'/);
});
test('exports require complete pagination and only start with an explicit click',()=>{
 assert.match(script,/S\.next!==null/);
 assert.match(script,/new Blob/);
 assert.match(script,/Export GeoJSON|evidence-geojson/);
 assert.match(script,/URL\.revokeObjectURL/);
 assert.match(script,/No.*provenance|scene_before/);
});
test('viewer links exact scenes and reuses only already-authorized job polygons',()=>{
 assert.match(script,/controller\.select\('before'/);
 assert.match(script,/controller\.select\('after'/);
 assert.match(script,/controller\.setLinkedEvidence/);
 assert.match(compare,/S\.linkedEvidence/);
 assert.match(compare,/f\.properties\?\.scene_before===S\.metaBefore\.id/);
 assert.match(compare,/f\.properties\?\.scene_after===S\.metaAfter\.id/);
 assert.match(script,/does not|external|Render/i);
});
