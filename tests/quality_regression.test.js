import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validPeriod} from '../api/_validators.js';
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
 assert.match(schema,/DROP INDEX IF EXISTS rscds\.rscds_feature_hash_idx/);
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
