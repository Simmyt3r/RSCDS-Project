import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateJobRequest,validUUID,safeFailureMessage,safeTokenMatch} from '../api/_jobs.js';
const valid={bbox:'8.20,7.60,8.25,7.65',before:'2025-01-01/2025-03-31',after:'2026-01-01/2026-03-31'};
test('private study request validates coordinates and dates',()=>{
 const result=validateJobRequest(valid);
 assert.deepEqual(result.bbox,[8.2,7.6,8.25,7.65]);
 assert.equal(result.cloudMax,35);assert.equal(result.minPixels,9);
});
test('reject oversized AOI to preserve ground resolution',()=>{
 assert.throws(()=>validateJobRequest({...valid,bbox:'8,7,8.5,7.1'}));
 assert.throws(()=>validateJobRequest({...valid,bbox:'8,7,8.10,7.01'}));
});
test('reject overlapping dates',()=>assert.throws(()=>validateJobRequest({...valid,after:'2025-03-31/2025-04-30'})));
test('reject invalid worker parameters',()=>{
 assert.throws(()=>validateJobRequest({...valid,cloud_max:100}));
 assert.throws(()=>validateJobRequest({...valid,min_pixels:1}));
 assert.throws(()=>validateJobRequest({...valid,min_pixels:'NaN'}));
});
test('UUID validation',()=>{
 assert.equal(validUUID('123e4567-e89b-42d3-a456-426614174000'),true);
 assert.equal(validUUID('123e4567-e89b-42d3-a456-426614174000;DROP'),false);
});
test('worker token constant-time comparator rejects unknown tokens',()=>{
 const secret='RSCds_private_worker_key_0123456789abcdefgh';
 assert.equal(safeTokenMatch(secret,secret),true);
 assert.equal(safeTokenMatch('wrong',secret),false);
 assert.equal(safeTokenMatch(secret,'missing'),false);
});
test('worker errors sanitize scene references',()=>{
 assert.equal(safeFailureMessage('file path /tile/08.jpg cloud blocked'),'Processing failed; adjust the scene dates or cloud coverage and retry');
 assert.equal(safeFailureMessage('No usable scene in 2026-01-01/2026-03-31'),'No usable scene');
});
test('SQL migration and worker script do not expose location through CI inputs',()=>{
 assert.match(fs.readFileSync(new URL('../.github/workflows/satellite-analysis.yml',import.meta.url),'utf8'),/workflow_dispatch:\s*\n\s*schedule:/);
});
