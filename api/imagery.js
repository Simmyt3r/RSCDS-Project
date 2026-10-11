import {send} from './_helpers.js';
import {lookupScene,validSceneId,tileTemplate} from './_imagery.js';
export default async function handler(req,res) {
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 const id=req.query?.scene;
 if(!validSceneId(id))return send(res,400,{error:'Invalid Sentinel-2 scene identifier'});
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),16000);
 try{
  const scene=await lookupScene(id,{signal:controller.signal});
  return send(res,200,{...scene,
   tileTemplate:tileTemplate(scene),
   renderer:'TiTiler public demo (best-effort, rate limited)',
   caution:'Viewing real raster tiles sends geographic tile coordinates and scene asset URLs to a third-party renderer. Use only nonsensitive public test areas.'});
 }catch(error){
  return send(res,error?.name==='AbortError'?504:502,{error:error?.name==='AbortError'
   ?'The satellite scene lookup timed out.'
   :'The source scene or its public imagery could not be loaded. Try another acquisition.'});
 }finally{clearTimeout(timer);}
}
