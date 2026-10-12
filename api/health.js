import {send,getDB} from './_helpers.js';

export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 let db='not configured';
 let databaseChecks=null;
 if(process.env.DATABASE_URL){
  let sql;
  try{
   sql=getDB();
   const [row]=await sql`SELECT
     to_regclass('rscds.detections') IS NOT NULL AS has_detections,
     to_regclass('rscds.analysis_jobs') IS NOT NULL AS has_jobs,
     EXISTS(SELECT 1 FROM information_schema.columns
       WHERE table_schema='rscds' AND table_name='detections' AND column_name='job_id') AS has_job_link,
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='rscds' AND table_name='analysis_jobs' AND column_name='scene_before') AS has_evidence_link`;
   databaseChecks={
     detections:Boolean(row?.has_detections),
     jobs:Boolean(row?.has_jobs),
     jobReference:Boolean(row?.has_job_link),
     sceneProvenance:Boolean(row?.has_evidence_link)
   };
   db=Object.values(databaseChecks).every(Boolean)?'ready':'migration required';
  }catch{db='connection error';}
  finally{if(sql)await sql.end();}
 }
 return send(res,200,{
  app:'RSCDS',version:'0.5.1',catalog:'Earth Search STAC',database:db,databaseChecks,
  adminConfigured:Boolean(process.env.ADMIN_API_KEY&&process.env.ADMIN_API_KEY.length>=24),
  workerConfigured:Boolean(process.env.WORKER_API_KEY&&process.env.WORKER_API_KEY.length>=24),
  keysIndependent:Boolean(process.env.ADMIN_API_KEY&&process.env.WORKER_API_KEY&&process.env.ADMIN_API_KEY!==process.env.WORKER_API_KEY),
  mode:'candidate detections require review'
 });
}
