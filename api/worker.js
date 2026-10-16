import {send,getDB} from './_helpers.js';
import {validUUID,safeFailureMessage,safeTokenMatch} from './_jobs.js';
import {insertFeatures} from './_ingest.js';
import {validatedProvenance} from './_evidence.js';

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
      // Never lease work against an out-of-date database instance.
      const [schema]=await sql`SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid=to_regclass('rscds.analysis_jobs') AND attname='scene_before'
        AND attnum>0 AND NOT attisdropped) AS evidence_ready`;
      if(!schema?.evidence_ready)return send(res,503,{
        error:'Connected database does not have required analysis provenance columns.'
      });
      // Recover worker crashes after expiry, with bounded attempts.
      await sql`UPDATE rscds.analysis_jobs SET status='failed',error_message='Worker did not finish after three attempts',finished_at=NOW(),lease_token=NULL WHERE status='running' AND lease_expires<NOW() AND attempts>=3`;
      const rows=await sql.begin(async tx=>{
        const available=await tx`SELECT id,status FROM rscds.analysis_jobs
          WHERE status='queued' OR (status='running' AND lease_expires<NOW() AND attempts<3)
          ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if(!available.length)return [];
        const job=available[0];
        if(job.status==='running'){
          // Recover atomically: stale partial batches must not contaminate a retry.
          await tx`DELETE FROM rscds.detections WHERE job_id=${job.id}`;
        }
        return tx`UPDATE rscds.analysis_jobs
          SET status='running',attempts=attempts+1,lease_token=gen_random_uuid(),
            lease_expires=NOW()+INTERVAL '60 minutes',started_at=NOW(),finished_at=NULL,
            error_message=NULL,result_count=0,scene_before=NULL,scene_after=NULL,
            acquired_before=NULL,acquired_after=NULL,valid_fraction=NULL,processor_method=NULL
          WHERE id=${job.id}
          RETURNING id,bbox,before_window,after_window,cloud_max,min_pixels,lease_token`;
      });
      return send(res,200,{job:rows[0]||null});
    }
    if(!validUUID(body?.id)||!validUUID(body?.lease_token))throw Error('Invalid job lease');
    if(!['batch','complete','fail'].includes(body.action))throw Error('Unknown worker action');
    if(body.action==='batch'){
      if(body.features?.type!=='FeatureCollection')throw Error('FeatureCollection required');
      const result=await sql.begin(async tx=>{
        // Lock the same job row used by retry/lease before storing a batch.
        const active=await tx`SELECT id FROM rscds.analysis_jobs
          WHERE id=${body.id} AND lease_token=${body.lease_token}
            AND status='running' AND lease_expires>NOW() FOR UPDATE`;
        if(!active.length)return null;
        return insertFeatures(tx,body.features.features,body.id);
      });
      return send(res,result?200:409,result||{error:'Job lease is no longer active'});
    }
    if(body.action==='fail'){
      const msg=safeFailureMessage(body.message);
      const rows=await sql`UPDATE rscds.analysis_jobs SET status='failed',error_message=${msg},lease_token=NULL,lease_expires=NULL,finished_at=NOW() WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running' AND lease_expires>NOW() RETURNING id,status`;
      return send(res,rows.length?200:409,rows[0]||{error:'Lease expired'});
    }
    const p=validatedProvenance(body.provenance);
    const completed=await sql.begin(async tx=>{
      // Same row lock as batches and crash recovery ensures no incomplete evidence.
      const active=await tx`SELECT id FROM rscds.analysis_jobs
        WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running'
          AND lease_expires>NOW() FOR UPDATE`;
      if(!active.length)return null;
      const [mismatched]=await tx`SELECT COUNT(*)::int AS count FROM rscds.detections
        WHERE job_id=${body.id} AND (scene_before IS DISTINCT FROM ${p.before}
          OR scene_after IS DISTINCT FROM ${p.after})`;
      if(mismatched.count)throw Error('Uploaded candidate scenes do not match processing provenance');
      const rows=await tx`UPDATE rscds.analysis_jobs SET status='completed',
        result_count=(SELECT COUNT(*)::INT FROM rscds.detections WHERE job_id=${body.id}),
        scene_before=${p.before},scene_after=${p.after},acquired_before=${p.early},
        acquired_after=${p.late},valid_fraction=${p.fraction},processor_method=${p.method},
        lease_token=NULL,lease_expires=NULL,finished_at=NOW()
        WHERE id=${body.id} AND lease_token=${body.lease_token} AND status='running'
          AND lease_expires>NOW() RETURNING id,status,result_count`;
      return rows[0]||null;
    });
    return send(res,completed?200:409,completed||{error:'Lease expired'});
  }catch(e){return send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
