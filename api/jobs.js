import {send,requireAdmin,getDB} from './_helpers.js';
import {validateJobRequest,validUUID} from './_jobs.js';

export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return send(res,405,{error:'GET/POST only'});
  if(!requireAdmin(req,res))return;
  let sql;
  try {
    sql=getDB();
    if(req.method==='GET'){
      const rows=await sql`SELECT id,bbox,before_window,after_window,cloud_max,min_pixels,status,attempts,result_count,error_message,created_at,started_at,finished_at FROM rscds.analysis_jobs ORDER BY created_at DESC LIMIT 50`;
      return send(res,200,{jobs:rows});
    }
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(body?.action==='retry'){
      if(!validUUID(body.id))throw Error('Invalid job identifier');
      const rows=await sql.begin(async tx=>{
        const failed=await tx`SELECT id FROM rscds.analysis_jobs WHERE id=${body.id} AND status='failed' FOR UPDATE`;
        if(!failed.length)return [];
        // Abandoned batches from prior attempts must never leak into a fresh result.
        await tx`DELETE FROM rscds.detections WHERE job_id=${body.id}`;
        return tx`UPDATE rscds.analysis_jobs SET status='queued',attempts=0,lease_token=NULL,lease_expires=NULL,error_message=NULL,started_at=NULL,finished_at=NULL,result_count=0 WHERE id=${body.id} AND status='failed' RETURNING id,status`;
      });
      return send(res,rows.length?200:409,rows[0]||{error:'Only failed jobs can be retried'});
    }
    const j=validateJobRequest(body);
    const pending=await sql`SELECT COUNT(*)::int AS count FROM rscds.analysis_jobs WHERE status IN ('queued','running')`;
    if(pending[0].count>=5)return send(res,429,{error:'Five analyses are already queued or running. Complete them before submitting more.'});
    const rows=await sql`INSERT INTO rscds.analysis_jobs (bbox,before_window,after_window,cloud_max,min_pixels)
      VALUES (${sql.json(j.bbox)},${j.before},${j.after},${j.cloudMax},${j.minPixels}) RETURNING id,status,created_at`;
    return send(res,201,{job:rows[0],message:'Queued securely. GitHub Actions scheduled worker checks for new jobs every 30 minutes; use Run workflow to start a check sooner.'});
  }catch(e){return send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
