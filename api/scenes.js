import {send,parseBBox,validPeriod} from './_helpers.js';
import {searchCatalog,STAC_COLLECTION,STACProviderError} from './_stac.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 let bbox,datetime;
 try {bbox=parseBBox(req.query.bbox);datetime=validPeriod(req.query.dates);}
 catch(error){return send(res,400,{error:error.message||'Invalid search parameters'});}
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),22000);
 try{
  const result=await searchCatalog(bbox,datetime,{signal:controller.signal});
  return send(res,200,{source:'Element84 Earth Search',collection:STAC_COLLECTION,bbox,
    datetime:result.datetime,features:result.features,
    warning:'Imagery metadata only. Cloud coverage is scene-wide; no detection is implied.'});
 }catch(error){
  const timedOut=error?.name==='AbortError';
  const status=timedOut?504:(error instanceof STACProviderError?502:502);
  return send(res,status,{error:timedOut?'Satellite catalogue timed out; retry or choose a shorter time window.':
   'Satellite imagery catalogue unavailable; retry later or inspect the provider status.',
   provider:'Element84 Earth Search',upstreamStatus:error instanceof STACProviderError?error.status:undefined});
 }finally{clearTimeout(timer);}
}
