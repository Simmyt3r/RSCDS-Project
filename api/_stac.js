/**
 * Earth Search STAC adapter. Keep the provider request minimal: sort and cloud
 * thresholds are applied to returned metadata locally for compatibility.
 * Does not expose COG URLs, credentials or geolocation from other users.
 */
export const STAC_ENDPOINT='https://earth-search.aws.element84.com/v1/search';
export const STAC_COLLECTION='sentinel-2-c1-l2a';
const ASSETS=new Set(['red','green','blue','nir','swir16','scl','visual']);
export class STACProviderError extends Error {
 constructor(status){super('Satellite imagery catalogue unavailable; please retry the search later.');this.name='STACProviderError';this.status=status;this.httpStatus=502;}
}
export function expandDates(period){
 const [start,end]=period.split('/');
 return `${start}T00:00:00Z/${end}T23:59:59Z`;
}
export function cleanScenes(data){
 if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features)) throw new STACProviderError(200);
 const filtered=data.features.filter(item=>item&&item.properties&&item.id)
  .map(item=>{
   const cloudCover=Number(item.properties['eo:cloud_cover']);
   return {id:item.id,date:item.properties.datetime,cloudCover:Number.isFinite(cloudCover)?cloudCover:null,
     platform:item.properties.platform,assets:Object.keys(item.assets||{}).filter(key=>ASSETS.has(key)),
     provenance:item.collection||STAC_COLLECTION};
  })
  .filter(item=>item.cloudCover!==null&&item.cloudCover<=60&&item.date&&Number.isFinite(Date.parse(item.date)));
 filtered.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 return filtered.slice(0,12);
}
export async function searchCatalog(bbox,period,options={}){
 const fetcher=options.fetcher||fetch;
 const datetime=expandDates(period);
 const body={collections:[STAC_COLLECTION],bbox,datetime,limit:80};
 let response;
 try {
  response=await fetcher(STAC_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/geo+json'},
    body:JSON.stringify(body),signal:options.signal,cache:'no-store'});
  if(!response.ok&&[400,405,415,422].includes(response.status)){
   // Some STAC gateways reject POST variants despite advertising Item Search.
   // A standards-based GET is a safe read-only fallback, never a fake dataset.
   const url=new URL(STAC_ENDPOINT);
   url.searchParams.set('collections',STAC_COLLECTION);
   url.searchParams.set('bbox',bbox.join(','));
   url.searchParams.set('datetime',datetime);
   url.searchParams.set('limit','80');
   response=await fetcher(url.toString(),{method:'GET',headers:{'Accept':'application/geo+json'},signal:options.signal,cache:'no-store'});
  }
 }catch(error){
  if(error?.name==='AbortError')throw error;
  throw new STACProviderError(0);
 }
 if(!response.ok)throw new STACProviderError(response.status);
 let data;
 try {data=await response.json();}catch {throw new STACProviderError(response.status);}
 return {features:cleanScenes(data),datetime};
}
