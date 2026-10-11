import test from 'node:test';
import assert from 'node:assert/strict';
import {validSceneId,safePublicImageUrl,sceneMetadata,tileTemplate,lookupScene} from '../api/_imagery.js';
const id='S2B_T32NMP_20250128T094646_L2A';
const example={id,collection:'sentinel-2-c1-l2a',
 bbox:[7.1,6.8,8.6,8.2],properties:{datetime:'2025-01-28T09:58:00Z',platform:'sentinel-2b','eo:cloud_cover':2},
 assets:{visual:{href:'https://sentinel-cogs.s3.us-west-2.amazonaws.com/example/visual.tif'},
 thumbnail:{href:'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/thumb.jpg'}}};
test('scene lookup accepts genuine IDs, rejects arbitrary URLs and path traversal',()=>{
 assert.equal(validSceneId(id),true);
 for(const value of ['https://example.com','../thing','S2B_T32NMP_20250128T094646_L2A/../../../env',
  'S2B_T32NMP_20250128T094646_L2A?url=http://metadata',null,''])
  assert.equal(validSceneId(value),false);
});
test('image source allowlist rejects SSRF and credential-bearing URLs',()=>{
 assert.equal(safePublicImageUrl('http://169.254.169.254/foo'),null);
 assert.equal(safePublicImageUrl('https://evil.example/visual.tif'),null);
 assert.equal(safePublicImageUrl('https://user:pass@sentinel-cogs.s3.us-west-2.amazonaws.com/a'),null);
 assert.equal(safePublicImageUrl(example.assets.visual.href),example.assets.visual.href);
});
test('source imagery is georeferenced and has attribution',()=>{
 const out=sceneMetadata(example,id);
 assert.deepEqual(out.bbox,example.bbox);
 assert.equal(out.visual,example.assets.visual.href);
 assert.equal(out.preview,example.assets.thumbnail.href);
 assert.match(out.kind,/True-colour Sentinel-2/);
 assert.match(out.copyright,/Copernicus/);
});
test('tile template uses fixed demo service, not arbitrary user URLs',()=>{
 const t=tileTemplate(sceneMetadata(example,id));
 assert.match(t,/^https:\/\/titiler\.xyz\/cog\/tiles\/WebMercatorQuad\/\{z\}\/\{x\}\/\{y\}\.png\?/);
 const qs=new URL(t).searchParams;
 assert.equal(qs.get('url'),example.assets.visual.href);
 assert.deepEqual(qs.getAll('bidx'),['1','2','3']);
 assert.equal(tileTemplate({visual:null}),null);
});
test('upstream lookup uses only canonical Earth Search item route',async()=>{
 let called;
 const out=await lookupScene(id,{fetcher:async(url,opts)=>{called=url;assert.equal(opts.method,'GET');return {ok:true,json:async()=>example};}});
 assert.ok(called.endsWith('/items/'+id));
 assert.equal(out.id,id);
});
test('mismatched STAC items are rejected',()=>{
 assert.throws(()=>sceneMetadata({...example,id:'another'},id));
});
