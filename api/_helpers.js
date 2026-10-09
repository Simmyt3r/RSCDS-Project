import postgres from 'postgres';
export const SCHEMA='rscds';
export function send(res,code,obj){res.status(code).setHeader('Content-Type','application/json; charset=utf-8').end(JSON.stringify(obj));}
export function requireAdmin(req,res){
 const secret=process.env.ADMIN_API_KEY;
 if(!secret || secret.length<24){send(res,503,{error:'Administrator access not configured. Set ADMIN_API_KEY (at least 24 characters).'});return false;}
 const presented=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 // Compare in constant time; no access to URL query strings.
 const a=Buffer.from(presented),b=Buffer.from(secret);
 const crypto=awaitCrypto();
 if(a.length!==b.length || !crypto.timingSafeEqual(a,b)){send(res,401,{error:'Administrator authentication required'});return false;}
 return true;
}
import crypto from 'node:crypto';
function awaitCrypto(){return crypto;}
export function getDB(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL not set');
 return postgres(process.env.DATABASE_URL,{ssl:'require',max:1,connect_timeout:5,idle_timeout:5});
}
export {parseBBox,validPeriod,validateFeature} from './_validators.js';
