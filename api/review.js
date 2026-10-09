import {send,requireAdmin,getDB} from './_helpers.js';
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{error:'POST only'});
 if(!requireAdmin(req,res))return;
 let sql;try{
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!Number.isSafeInteger(Number(b.id))||!['verified','rejected'].includes(b.status)||typeof b.reviewer!=='string'||b.reviewer.trim().length<3||typeof b.notes!=='string'||b.notes.trim().length<10)throw Error('Valid id, status, reviewer (3+), evidence notes (10+) required');
  sql=getDB();const out=await sql`UPDATE rscds.detections SET review_status=${b.status},reviewer=${b.reviewer.trim().slice(0,120)},review_notes=${b.notes.trim().slice(0,3000)},reviewed_at=NOW() WHERE id=${Number(b.id)} RETURNING id,review_status`;
  return send(res,out.length?200:404,out[0]||{error:'Not found'});
 }catch(e){send(res,400,{error:String(e.message||e)});}finally{if(sql)await sql.end();}
}
