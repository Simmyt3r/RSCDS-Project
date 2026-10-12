import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validPeriod} from '../api/_validators.js';
import {fingerprint} from '../api/_fingerprint.js';
const file=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('invalid calendar days and reversed observation windows fail closed',()=>{
 for(const interval of ['2026-02-30/2026-03-31','2026-02-29/2026-03-31',
  '2026-04-31/2026-05-01','2026-08-15/2026-08-14','2026-00-11/2026-10-13'])
   assert.throws(()=>validPeriod(interval));
 assert.equal(validPeriod('2024-02-29/2024-03-02'),'2024-02-29/2024-03-02');
});
test('hashes are unique per analysis, not across all jobs',()=>{
 const schema=file('scripts/schema.sql');
 assert.match(schema,/rscds_job_feature_hash_idx[\s\S]*job_id,feature_hash/);
 assert.match(schema,/rscds_manual_feature_hash_idx[\s\S]*feature_hash\) WHERE job_id IS NULL/);
 assert.doesNotMatch(schema,/DROP INDEX/);
 assert.equal(schema,file('public/schema.sql'));
 const ingest=file('api/_ingest.js');
 assert.match(ingest,/ON CONFLICT DO NOTHING/);
 assert.match(ingest,/job_id IS NOT DISTINCT FROM/);
});
test('worker cannot mix a new attempt with interrupted batches',()=>{
 const worker=file('api/worker.js');
 assert.match(worker,/status==='running'[\s\S]*DELETE FROM rscds\.detections WHERE job_id/);
 assert.match(worker,/FOR UPDATE SKIP LOCKED/);
 assert.match(worker,/FOR UPDATE/);
 assert.match(worker,/lease_expires>NOW\(\)/);
 assert.doesNotMatch(worker,/FROM available a WHERE/);
});

test('run-scoped fingerprints avoid historical global uniqueness collisions',()=>{
 const feature={type:'Feature',geometry:{type:'Polygon',coordinates:[[[8,7],[8.01,7],[8.01,7.01],[8,7]]]},
  properties:{source:'Sentinel-2',scene_before:'scene1',scene_after:'scene2'}};
 const first='123e4567-e89b-42d3-a456-426614174000',second='123e4567-e89b-42d3-a456-426614174001';
 assert.equal(fingerprint(feature,first),fingerprint(feature,first));
 assert.notEqual(fingerprint(feature,first),fingerprint(feature,second));
 assert.notEqual(fingerprint(feature),fingerprint(feature,first));
 const ingest=file('api/_ingest.js');assert.match(ingest,/fingerprint\(f,jobId\)/);
});
