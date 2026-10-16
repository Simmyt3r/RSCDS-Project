import {send,getDB} from './_helpers.js';
import {previous,stateFor,publicBootstrapState,perform} from './_migrations.js';
/** Public, one-time initial schema bootstrap: never accepts SQL or credentials. */
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return send(res,405,{error:'GET or POST only'});
 res.setHeader('Cache-Control','no-store');
 if(req.method==='POST'){
  // Same-origin is a browser safety control, NOT authentication.
  const origin=req.headers.origin;
  let same=false;
  try{
   const expected=req.headers['x-forwarded-host']||req.headers.host;
   const supplied=new URL(String(origin));
   same=supplied.protocol==='https:'&&supplied.host===expected;
  }catch{}
  if(!same)return send(res,403,{error:'Open this site over HTTPS to run initial setup'});
  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')return send(res,415,{error:'JSON request required'});
 }
 let sql;
 try{
  sql=getDB();
  if(req.method==='GET'){
   const summary=stateFor(await previous(sql));
   const gate=publicBootstrapState(summary);
   return send(res,200,{database:'connected',scope:'rscds',migrations:summary,
    pending:gate.pending,bootstrapAvailable:gate.available,bootstrapClosed:gate.closed,
    caution:'No login required. Anyone could apply the fixed initial schema changes while setup remains open. Confirm DATABASE_URL in Vercel before applying.'});
  }
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const applied=await perform(sql,body);
  return send(res,200,{ok:true,applied,scope:'rscds',bootstrapClosed:true});
 }catch(err){
  const safe=err?.status&&/^(Pending versions|Another migration|Recorded migration|Initial database setup|This migration needs)/.test(err.message)
    ?err.message:'Initial migration failed. Check connectivity, permissions and PostGIS availability.';
  return send(res,err?.status||503,{error:safe});
 }finally{if(sql)await sql.end();}
}