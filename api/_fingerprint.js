import crypto from 'node:crypto';
export function fingerprint(feature,jobId=null) {
 const p=feature.properties;
 const content=JSON.stringify([feature.geometry,p.source,p.scene_before||'',p.scene_after||'']);
 // Scoped evidence identity: identical results from separate runs must not
 // conflict with the historical global hash index. Replaying a batch in the
 // same job still produces the exact same fingerprint.
 const raw=jobId===null?content:JSON.stringify([jobId,content]);
 return crypto.createHash('sha256').update(raw).digest('hex');
}
