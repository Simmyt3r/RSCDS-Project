import {fingerprint} from './_fingerprint.js';
import {send,requireAdmin,getDB,validateFeature} from './_helpers.js';

export default async function handler(req,res){
 if(!requireAdmin(req,res))return;
 let sql;
 try{
  sql=getDB();
  if(req.method==='GET'){
   const rows=await sql`SELECT id,site_label,area_m2,score,review_status,source,scene_before,scene_after,ST_AsGeoJSON(geom)::json AS geometry,created_at FROM rscds.detections ORDER BY created_at DESC LIMIT 100`;
   return send(res,200,{type:'FeatureCollection',features:rows.map(x=>({type:'Feature',id:x.id,geometry:x.geometry,properties:{site_label:x.site_label,area_m2:x.area_m2,score:x.score,review_status:x.review_status,source:x.source,scene_before:x.scene_before,scene_after:x.scene_after,created_at:x.created_at}})),limit:100});
  }
  if(req.method==='POST'){
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(body?.type!=='FeatureCollection'||!Array.isArray(body.features)||body.features.length<1||body.features.length>100)throw Error('Send a FeatureCollection with 1–100 features');
   const features=body.features.map(f=>({p:validateFeature(f),geometry:JSON.stringify(f.geometry),hash:fingerprint(f)}));
   const inserted=await sql.begin(async tx=>{
    const created=[];
    for(const f of features){
     const p=f.p;
     const rows=await tx`INSERT INTO rscds.detections (site_label,geom,area_m2,score,source,scene_before,scene_after,feature_hash)
       SELECT ${String(p.site_label||'Candidate').slice(0,120)}, ST_SetSRID(ST_GeomFromGeoJSON(${f.geometry}),4326), ${p.area_m2}, ${p.score}, ${p.source}, ${String(p.scene_before||'').slice(0,255)}, ${String(p.scene_after||'').slice(0,255)}, ${f.hash}
       WHERE ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(${f.geometry}),4326))
       ON CONFLICT (feature_hash) DO NOTHING RETURNING id`;
     if(rows.length)created.push(rows[0].id);
     else {
      const exists=await tx`SELECT 1 FROM rscds.detections WHERE feature_hash=${f.hash} LIMIT 1`;
      if(!exists.length)throw Error('Feature geometry was invalid');
     }
    }
    return created;
   });
   return send(res,201,{imported:inserted.length,skipped_duplicates:features.length-inserted.length,ids:inserted,review_status:'unverified'});
  }
  return send(res,405,{error:'GET/POST only'});
 }catch(e){return send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
