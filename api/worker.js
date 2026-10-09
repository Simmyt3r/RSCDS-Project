import {send,getDB} from './_helpers.js';
import {validUUID,safeFailureMessage,safeTokenMatch} from './_jobs.js';
import {insertFeatures} from './_ingest.js';

export default async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{error:'POST only'});
  const presented=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!process.env.WORKER_API_KEY||process.env.WORKER_API_KEY.length<24)return send(res,503,{error:'Worker authentication not configured'});
  if(!safeTokenMatch(presented,process.env.WORKER_API_KEY))return send(res,401,{error:'Worker authentication required'});
  let sql;
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    sql=getDB();
    if(body?.action==='lease'){
      // Recover worker crashes after expiry, with bounded attempts.
      await sql`UPDATE rscds.analysis_jobs SET status='failed',error_message='Worker did not finish after three attempts',finished_at=NOW(),lease_token=NULL WHERE status='running' AND lease_expires<NOW() AND attempts>=3`;
      const rows=await sql`WITH available AS (
        SELECT id FROM rscds.analysis_jobs
        WHERE status='queued' OR (status='running' AND lease_expires<NOW() AND attempts<3)
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE rscds.analysis_jobs j SET status='running',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_expires=NOW()+INTERVAL '60 minutes',started_at=NOW(),error_message=NULL
      FROM available a WHERE j.id=a.id RETURNING j.id,j.bbox,j.before_window,j.after_window,j.cloud_max,j.min_pixels,j.lease_token`;
      return send(res,200,{job:rows[0]||null});
    }
    if(!validUUID(body?.id)||!validUUID(body?.lease_token))throw Error('Invalid job lease');
    if(!['batch','complete','fail'].includes(body.action))throw Error('Unknown worker action');
    const active=await sql`SELECT id FROM rscds.analysis_jobs WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running' AND lease_expires>NOW()`;
    if(!active.length)return send(res,409,{error:'Job lease is no longer active'});
    if(body.action==='batch'){
      if(body.features?.type!=='FeatureCollection')throw Error('FeatureCollection required');
      const result=await sql.begin(async tx=>insertFeatures(tx,body.features.features,body.id));
      return send(res,200,result);
    }
    if(body.action==='fail'){
      const msg=safeFailureMessage(body.message);
      const rows=await sql`UPDATE rscds.analysis_jobs SET status='failed',error_message=${msg},lease_token=NULL,lease_expires=NULL,finished_at=NOW() WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running' RETURNING id,status`;
      return send(res,rows.length?200:409,rows[0]||{error:'Lease expired'});
    }
    const rows=await sql`UPDATE rscds.analysis_jobs SET status='completed',result_count=(SELECT COUNT(*)::INT FROM rscds.detections WHERE job_id=${body.id}),lease_token=NULL,lease_expires=NULL,finished_at=NOW() WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running' RETURNING id,status,result_count`;
    return send(res,rows.length?200:409,rows[0]||{error:'Lease expired'});
  }catch(e){return send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
