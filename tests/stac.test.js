import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCatalog,expandDates,cleanScenes,STACProviderError} from '../api/_stac.js';
const features=[{id:'old',type:'Feature',collection:'sentinel-2-c1-l2a',assets:{red:{},scl:{}},properties:{datetime:'2025-01-15T09:00:00Z','eo:cloud_cover':40}},
{id:'new',type:'Feature',assets:{nir:{},unknown:{}},properties:{datetime:'2025-02-15T09:00:00Z','eo:cloud_cover':10}},
{id:'cloudy',type:'Feature',properties:{datetime:'2025-03-15T09:00:00Z','eo:cloud_cover':88}}];
const ok=()=>({ok:true,status:200,json:async()=>({type:'FeatureCollection',features})});
test('STAC expands date-only windows to full inclusive UTC days',()=>{
 assert.equal(expandDates('2025-01-01/2025-03-31'),'2025-01-01T00:00:00Z/2025-03-31T23:59:59Z');
});
test('STAC minimal POST omits provider-specific sort and query extensions',async()=>{
 const calls=[];
 const x=await searchCatalog([8.2,7.6,8.25,7.65],'2025-01-01/2025-03-31',{
  fetcher:async(url,opts)=>{calls.push({url,opts});return ok();}
 });
 assert.equal(calls.length,1);
 const sent=JSON.parse(calls[0].opts.body);
 assert.deepEqual(Object.keys(sent).sort(),['bbox','collections','datetime','limit']);
 assert.equal(calls[0].opts.method,'POST');
 assert.equal(sent.limit,80);
 assert.deepEqual(x.features.map(y=>y.id),['new','old']);
 assert.deepEqual(x.features[0].assets,['nir']);
});
test('STAC retries as GET after upstream 400 without inventing imagery',async()=>{
 const calls=[];
 const x=await searchCatalog([8.2,7.6,8.25,7.65],'2025-01-01/2025-03-31',{fetcher:async(url,opts)=>{
  calls.push({url,method:opts.method});
  return calls.length===1?{ok:false,status:400}:ok();
 }});
 assert.equal(calls[0].method,'POST');assert.equal(calls[1].method,'GET');
 assert.match(calls[1].url,/collections=sentinel-2-c1-l2a/);
 assert.equal(x.features.length,2);
});
test('STAC fails closed when provider does not respond successfully',async()=>{
 await assert.rejects(()=>searchCatalog([8.2,7.6,8.25,7.65],'2025-01-01/2025-03-31',
  {fetcher:async()=>({ok:false,status:503})}),STACProviderError);
});
test('STAC rejects fake malformed catalogue results',()=>{
 assert.throws(()=>cleanScenes({features:features}),STACProviderError);
 assert.deepEqual(cleanScenes({type:'FeatureCollection',features:[]}),[]);
});
