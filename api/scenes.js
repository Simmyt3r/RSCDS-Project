import {send,parseBBox,validPeriod} from './_helpers.js';
export default async function handler(req,res){
 if(req.method!=='GET')return send(res,405,{error:'GET only'});
 try{
  const bbox=parseBBox(req.query.bbox),datetime=validPeriod(req.query.dates);
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),18000);
  let r;
  try {r=await fetch('https://earth-search.aws.element84.com/v1/search',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({collections:['sentinel-2-c1-l2a'],bbox,datetime,limit:12,query:{'eo:cloud_cover':{lte:60}},sortby:[{field:'properties.datetime',direction:'desc'}]})});}
  finally {clearTimeout(timer)}
  if(!r.ok)throw Error('Imagery catalog returned '+r.status);
  const data=await r.json();
  const features=(data.features||[]).map(x=>({id:x.id,date:x.properties?.datetime,cloudCover:x.properties?.['eo:cloud_cover'],platform:x.properties?.platform,assets:Object.keys(x.assets||{}).filter(k=>['red','green','blue','nir','swir16','scl','visual'].includes(k)),provenance:x.collection}));
  send(res,200,{source:'Element84 Earth Search',collection:'sentinel-2-c1-l2a',bbox,datetime,features,warning:'Scene availability is not a settlement detection. Cloud cover is scene-wide metadata.'});
 }catch(err){send(res,400,{error:String(err.message||err)});}
}
