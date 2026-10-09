import crypto from 'node:crypto';
import {parseBBox,validPeriod} from './_validators.js';

export const JOB_SCHEMA='rscds';
export function validateJobRequest(input){
  if(!input || typeof input!=='object' || Array.isArray(input))throw Error('Provide the study area and two date windows');
  const bbox=parseBBox(input.bbox);
  // Current worker caps the output grid at 1024 pixels. Keep near native 10 m resolution.
  if(bbox[2]-bbox[0]>.09 || bbox[3]-bbox[1]>.09)throw Error('Analysis AOI must be at most 0.09° wide and tall; divide larger areas into smaller studies');
  const before=validPeriod(input.before),after=validPeriod(input.after);
  if(before.split('/')[1]>=after.split('/')[0])throw Error('Before must end before the after observation begins');
  const cloudMax=input.cloud_max===undefined?35:Number(input.cloud_max);
  const minPixels=input.min_pixels===undefined?9:Number(input.min_pixels);
  if(!Number.isFinite(cloudMax)||cloudMax<0||cloudMax>60)throw Error('Cloud limit must be between 0 and 60');
  if(!Number.isSafeInteger(minPixels)||minPixels<2||minPixels>100)throw Error('Minimum pixel cluster must be 2–100');
  return {bbox,before,after,cloudMax,minPixels};
}
export function validUUID(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
export function safeFailureMessage(message){
  // External catalog/raster exceptions can contain file paths, scene IDs, or coordinates.
  const text=String(message||'').trim();
  const allowed=['No usable scene','Less than 30% shared cloud-free pixels','Identical scene selected','Results exceed the permitted feature count'];
  return allowed.find(x=>text.startsWith(x))||'Processing failed; adjust the scene dates or cloud coverage and retry';
}
export function safeTokenMatch(presented,expected){
  if(typeof expected!=='string'||expected.length<24)return false;
  const a=Buffer.from(String(presented||'')),b=Buffer.from(expected);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
