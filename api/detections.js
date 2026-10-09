import {insertFeatures} from './_ingest.js';
import {send,requireAdmin,getDB} from './_helpers.js';

export default async function handler(req,res){
 if(!requireAdmin(req,res))return;
 let sql;
 try{
  sql=getDB();
  if(req.method==='GET'){
   const rows=await sql`SELECT id,site_label,area_m2,score,review_status,source,scene_before,scene_after,ST_AsGeoJSON(geom)::json AS geometry,created_at FROM rscds.detections WHERE job_id IS NULL OR EXISTS (SELECT 1 FROM rscds.analysis_jobs j WHERE j.id=job_id AND j.status='completed') ORDER BY created_at DESC LIMIT 100`;
   return send(res,200,{type:'FeatureCollection',features:rows.map(x=>({type:'Feature',id:x.id,geometry:x.geometry,properties:{site_label:x.site_label,area_m2:x.area_m2,score:x.score,review_status:x.review_status,source:x.source,scene_before:x.scene_before,scene_after:x.scene_after,created_at:x.created_at}})),limit:100});
  }
  if(req.method==='POST'){
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(body?.type!=='FeatureCollection'||!Array.isArray(body.features)||body.features.length<1||body.features.length>100)throw Error('Send a FeatureCollection with 1–100 features');
   const result=await sql.begin(async tx=>insertFeatures(tx,body.features));
   return send(res,201,{...result,review_status:'unverified'});
  }
  return send(res,405,{error:'GET/POST only'});
 }catch(e){return send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
