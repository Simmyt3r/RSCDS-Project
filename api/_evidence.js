import {validSceneId} from './_imagery.js';
export const EVIDENCE_PAGE_SIZE=100;
export function validatedProvenance(raw){
 if(!raw||typeof raw!=='object'||raw.status!=='candidate_only')throw Error('Worker completion requires candidate-only provenance');
 const before=raw.before,after=raw.after;
 if(!validSceneId(before)||!validSceneId(after)||before===after)
  throw Error('Two distinct Sentinel-2 scene IDs required');
 const early=new Date(raw.before_date),late=new Date(raw.after_date);
 if(!Number.isFinite(early.getTime())||!Number.isFinite(late.getTime())||early>=late)
  throw Error('Invalid acquisition timestamps');
 if(typeof raw.valid_fraction!=='number'||!Number.isFinite(raw.valid_fraction)||
   raw.valid_fraction<0||raw.valid_fraction>1)throw Error('Invalid shared cloud-free fraction');
 if(raw.model!=='explainable unvalidated change heuristic v0.1')
  throw Error('Unknown processor method');
 return {before,after,early:early.toISOString(),late:late.toISOString(),
  fraction:raw.valid_fraction,method:raw.model};
}
export function evidenceOffset(raw){
 const n=Number(raw??0);
 if(!Number.isSafeInteger(n)||n<0||n>5000)
  throw Error('Evidence offset must be an integer from 0 to 5000');
 return n;
}
export function evidenceSummary(rows){
 const result={total:0,unverified:0,verified:0,rejected:0,area_m2:0};
 for(const row of rows){
  if(['unverified','verified','rejected'].includes(row.review_status))
   result[row.review_status]=Number(row.count)||0;
  result.total+=Number(row.count)||0;
  result.area_m2+=Number(row.area_m2)||0;
 }
 return result;
}
