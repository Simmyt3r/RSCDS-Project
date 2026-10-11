import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedProvenance,evidenceOffset,evidenceSummary,EVIDENCE_PAGE_SIZE} from '../api/_evidence.js';
const m={status:'candidate_only',before:'S2B_T32NMP_20250128T094646_L2A',
 after:'S2A_T32NMP_20260321T095738_L2A',before_date:'2025-01-28T09:58:45+00:00',
 after_date:'2026-03-21T09:59:04+00:00',valid_fraction:.82,model:'explainable unvalidated change heuristic v0.1'};
test('provenance preserves selected actual scenes and cloud-free overlap',()=>{
 const r=validatedProvenance(m);assert.equal(r.before,m.before);assert.equal(r.after,m.after);assert.equal(r.fraction,.82);
});
test('invalid or fabricated worker provenance is rejected',()=>{
 for(const bad of [null,{}, {...m,status:'verified'},{...m,after:m.before},{...m,valid_fraction:1.2},
   {...m,after_date:'2024-01-01T00:00:00Z'},{...m,model:'classifier predicts people'}])assert.throws(()=>validatedProvenance(bad));
});
test('evidence requests have bounded pages',()=>{
 assert.equal(evidenceOffset(undefined),0);assert.equal(evidenceOffset('100'),100);assert.equal(EVIDENCE_PAGE_SIZE,100);
 for(const bad of ['abc','-1','1.5','99999'])assert.throws(()=>evidenceOffset(bad));
});
test('evidence counts preserve human review status and total footprint',()=>{
 assert.deepEqual(evidenceSummary([{review_status:'unverified',count:4,area_m2:1200},
  {review_status:'verified',count:2,area_m2:500}]),
  {total:6,unverified:4,verified:2,rejected:0,area_m2:1700});
});
