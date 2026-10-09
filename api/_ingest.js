import {fingerprint} from './_fingerprint.js';
import {validateFeature} from './_validators.js';

// Reused by manual imports and leased analysis jobs. Caller owns transaction.
export async function insertFeatures(tx,features,jobId=null){
  if(!Array.isArray(features)||features.length<1||features.length>100)throw Error('Use 1–100 GeoJSON features per import batch');
  const prepared=features.map(f=>({p:validateFeature(f),geometry:JSON.stringify(f.geometry),hash:fingerprint(f)}));
  let imported=0;
  for(const f of prepared){
    const p=f.p;
    const rows=await tx`INSERT INTO rscds.detections (site_label,geom,area_m2,score,source,scene_before,scene_after,feature_hash,job_id)
     SELECT ${String(p.site_label||'Candidate').slice(0,120)}, ST_SetSRID(ST_GeomFromGeoJSON(${f.geometry}),4326), ${p.area_m2}, ${p.score}, ${p.source}, ${String(p.scene_before||'').slice(0,255)}, ${String(p.scene_after||'').slice(0,255)}, ${f.hash}, ${jobId}
     WHERE ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${f.geometry}),4326))
     ON CONFLICT (feature_hash) DO NOTHING RETURNING id`;
    if(rows.length)imported++;
    else {
      const exists=await tx`SELECT 1 FROM rscds.detections WHERE feature_hash=${f.hash} LIMIT 1`;
      if(!exists.length)throw Error('Feature geometry was invalid');
    }
  }
  return {imported,skipped_duplicates:features.length-imported};
}
