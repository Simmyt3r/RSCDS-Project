import {send,requireAdmin,getDB} from './_helpers.js';
import {validUUID} from './_jobs.js';
import {evidenceOffset,EVIDENCE_PAGE_SIZE,evidenceSummary} from './_evidence.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 if(!requireAdmin(req,res))return;
 let sql;
 try{
  const id=req.query?.job_id;
  if(!validUUID(id))return send(res,400,{error:'Valid job_id required'});
  const offset=evidenceOffset(req.query?.offset);
  sql=getDB();
  const jobs=await sql`SELECT id,bbox,before_window,after_window,cloud_max,min_pixels,status,
    attempts,result_count,scene_before,scene_after,acquired_before,acquired_after,
    valid_fraction,processor_method,created_at,started_at,finished_at
    FROM rscds.analysis_jobs WHERE id=${id}`;
  if(!jobs.length)return send(res,404,{error:'Analysis job was not found'});
  if(jobs[0].status!=='completed')return send(res,409,{error:'Only completed jobs provide final evidence',status:jobs[0].status});
  const counts=await sql`SELECT review_status,COUNT(*)::INT AS count,
    COALESCE(SUM(area_m2),0)::DOUBLE PRECISION AS area_m2
    FROM rscds.detections WHERE job_id=${id} GROUP BY review_status`;
  const summary=evidenceSummary(counts);
  const rows=await sql`SELECT id,feature_hash,site_label,area_m2,score,source,scene_before,scene_after,
    review_status,reviewer,review_notes,reviewed_at,created_at,ST_AsGeoJSON(geom)::json AS geometry
    FROM rscds.detections WHERE job_id=${id} ORDER BY id ASC LIMIT ${EVIDENCE_PAGE_SIZE} OFFSET ${offset}`;
  const features=rows.map(r=>({type:'Feature',id:r.id,geometry:r.geometry,
    properties:{feature_hash:r.feature_hash,site_label:r.site_label,area_m2:r.area_m2,score:r.score,source:r.source,
      scene_before:r.scene_before,scene_after:r.scene_after,review_status:r.review_status,
      reviewer:r.reviewer,review_notes:r.review_notes,reviewed_at:r.reviewed_at,created_at:r.created_at}}));
  return send(res,200,{job:jobs[0],summary,featureCollection:{type:'FeatureCollection',features},
    pagination:{offset,page_size:EVIDENCE_PAGE_SIZE,returned:rows.length,total:summary.total,
      next_offset:offset+rows.length<summary.total?offset+rows.length:null},
    caution:'Unvalidated land-cover candidates are not evidence of a settlement or population.'});
 }catch{return send(res,400,{error:'Unable to load protected evidence. Check job ID and schema migration.'});}
 finally{if(sql)await sql.end();}
}