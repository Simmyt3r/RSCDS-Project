import crypto from 'node:crypto';
export function fingerprint(feature) {
 const p=feature.properties;
 const raw=JSON.stringify([feature.geometry,p.source,p.scene_before||'',p.scene_after||'']);
 return crypto.createHash('sha256').update(raw).digest('hex');
}
