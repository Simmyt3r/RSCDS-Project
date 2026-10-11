/**
 * Earth Search Sentinel-2 true-colour image metadata.
 *
 * Only canonical L2A item IDs are accepted. The upstream URL and collection
 * are fixed; callers cannot use this endpoint to fetch an arbitrary URL.
 * Raster tile requests remain opt-in and never use administrative credentials.
 */
export const COLLECTION='sentinel-2-c1-l2a';
export const STAC_ITEMS='https://earth-search.aws.element84.com/v1/collections/'+COLLECTION+'/items/';
const SCENE_ID=/^S2[A-C]_T[0-9]{2}[A-Z]{3}_[0-9]{8}T[0-9]{6}_L2A$/;
export function validSceneId(id) {
 return typeof id==='string'&&id.length<=90&&SCENE_ID.test(id);
}
export function safePublicImageUrl(value) {
 if(typeof value!=='string'||value.length>2048)return null;
 try {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if(!(
   u.hostname==='earth-search.aws.element84.com'||
   u.hostname==='sentinel-cogs.s3.us-west-2.amazonaws.com'||
   u.hostname==='sentinel-cogs.s3.amazonaws.com'||
   u.hostname==='sentinel-cogs.s3.us-east-1.amazonaws.com'||
   u.hostname==='e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com'||
   u.hostname==='e84-earth-search-sentinel-data.s3.amazonaws.com'||
   (u.hostname.endsWith('.s3.us-west-2.amazonaws.com')&&!u.hostname.startsWith('.'))
  ))return null;
  return u.href;
 }catch{return null;}
}
export function sceneMetadata(item, expectedId) {
 if(!item||item.id!==expectedId||item.collection!==COLLECTION||!item.assets)
  throw Error('Satellite scene record unavailable');
 const visual=safePublicImageUrl(item.assets.visual?.href);
 const preview=safePublicImageUrl(item.assets.thumbnail?.href)
    ||safePublicImageUrl(item.assets.overview?.href)
    ||safePublicImageUrl(item.assets.rendered_preview?.href);
 // STAC should provide geographic bbox for the scene footprint.
 const bb=item.bbox;
 const bbox=Array.isArray(bb)&&bb.length===4&&bb.every(Number.isFinite)
   &&bb[0]>=-180&&bb[2]<=180&&bb[1]>=-85&&bb[3]<=85
   &&bb[0]<bb[2]&&bb[1]<bb[3]?bb:null;
 return {id:item.id,date:item.properties?.datetime||null,
   platform:item.properties?.platform||null,cloudCover:item.properties?.['eo:cloud_cover']??null,
   bbox,visual,preview,source:STAC_ITEMS+encodeURIComponent(expectedId),
   copyright:'Copernicus Sentinel data via Element84 Earth Search',
   kind:'True-colour Sentinel-2 Level-2A image, nominal 10 m resolution'};
}
export async function lookupScene(id,{fetcher=fetch,signal}={}){
 if(!validSceneId(id))throw Error('Invalid Sentinel-2 scene identifier');
 let response;
 try{response=await fetcher(STAC_ITEMS+encodeURIComponent(id),
   {method:'GET',headers:{'Accept':'application/geo+json'},signal,cache:'no-store'});}
 catch(error){
  if(error?.name==='AbortError')throw error;
  throw Error('Satellite catalogue not reachable');
 }
 if(!response.ok)throw Error('Satellite scene lookup returned HTTP '+response.status);
 let item;
 try{item=await response.json();}catch{throw Error('Satellite catalogue returned unreadable data');}
 return sceneMetadata(item,id);
}
export const TILE_RENDERER='https://titiler.xyz';
export function tileTemplate(scene,base=TILE_RENDERER) {
 if(!scene?.visual)return null;
 // Third-party TiTiler demo is for limited research previews, not heavy/production use.
 // Do not append private API tokens, user-supplied URLs or sensitive AOIs.
 const url=new URL('/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png',base);
 url.searchParams.set('url',scene.visual);
 url.searchParams.set('bidx','1');
 url.searchParams.append('bidx','2');
 url.searchParams.append('bidx','3');
 return url.toString();
}
