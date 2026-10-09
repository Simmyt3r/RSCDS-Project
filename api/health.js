import {send,getDB} from './_helpers.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 let db='not configured';
 if(process.env.DATABASE_URL){
  const sql=getDB();try{const r=await sql`SELECT to_regclass('rscds.detections') as table_name`;db=r[0].table_name?'ready':'migration required';}catch{db='connection error';}finally{await sql.end();}
 }
 send(res,200,{app:'RSCDS',version:'0.2.0',catalog:'Earth Search STAC',database:db,adminConfigured:Boolean(process.env.ADMIN_API_KEY&&process.env.ADMIN_API_KEY.length>=24),mode:'candidate detections require review'});
}
