import {send,requireAdmin,getDB} from './_helpers.js';
import {previous,stateFor,perform} from './_migrations.js';
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return send(res,405,{error:'GET or POST only'});
 if(!requireAdmin(req,res))return;
 if(req.method==='POST'&&req.headers.origin){
  let same=false;
  try{const origin=new URL(req.headers.origin);same=origin.protocol==='https:'&&origin.host===req.headers.host;}catch{}
  if(!same)return send(res,403,{error:'Request must originate from this RSCDS site'});
 }
 let sql;
 try{
  sql=getDB();
  if(req.method==='GET'){
   const [identity]=await sql`SELECT current_database() AS name`;
   const migrations=stateFor(await previous(sql));
   return send(res,200,{database:identity.name,scope:'rscds',migrations,
    pending:migrations.filter(m=>m.status==='pending').map(m=>m.id),
    caution:'Changes apply to the database configured for this Vercel deployment.'});
  }
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const applied=await perform(sql,body);
  return send(res,200,{ok:true,applied,scope:'rscds'});
 }catch(err){
  const safe=err?.status&&/^(Pending versions|Another migration|Recorded migration)/.test(err.message)
   ?err.message:'Migration failed. Verify database permissions, connection and PostGIS availability.';
  return send(res,err?.status||503,{error:safe});
 }finally{if(sql)await sql.end();}
}
