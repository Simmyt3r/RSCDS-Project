import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/imagery-compare.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const search=fs.readFileSync(new URL('../public/imagery-search.js',import.meta.url),'utf8');
function fake(){
 const nodes={};
 const node=()=>({textContent:'',value:'',dataset:{},children:[],disabled:false,
  addEventListener(k,fn){this[k]=fn;},append(...x){this.children.push(...x);},replaceChildren(){this.children=[];}});
 for(const id of ['compare-feedback','compare-before-label','compare-before-detail','compare-after-label','compare-after-detail',
 'compare-load','compare-swipe','compare-swipe-value','compare-reset','compare-polygons','compare-clear-polygons',
 'compare-polygon-status','compare-admin-key','bbox','before-quicklook','after-quicklook'])nodes[id]=node();
 const document={readyState:'complete',getElementById:id=>nodes[id],createElement:()=>node()};
 const window={RSCDSImagery:{parseBBox:raw=>raw}};
 vm.runInNewContext(source,{document,window,fetch:()=>{throw Error('test does not use network');},setTimeout:()=>0,console});
 return {api:window.RSCDSImageryCompare,nodes};
}
test('image candidates are selected by least cloud coverage, but operators can override',()=>{
 const x=fake();
 x.api.setSearchResults([{id:'cloudy',date:'2025-01-01',cloudCover:58,assets:['visual']},
  {id:'clear',date:'2025-02-02',cloudCover:2,assets:['visual']}],
  [{id:'new',date:'2026-02-01',cloudCover:3,assets:['visual']}]);
 assert.match(x.nodes['compare-before-detail'].textContent,/clear/);
 assert.match(x.nodes['compare-after-detail'].textContent,/new/);
 x.api.select('before',{id:'manual',date:'2025-03-01'});
 assert.match(x.nodes['compare-before-detail'].textContent,/manual/);
});
test('render refuses to invent paired photographs when scenes are missing',async()=>{
 const x=fake();await x.api.render();
 assert.match(x.nodes['compare-feedback'].textContent,/Select a before and after/);
 assert.equal(x.nodes['compare-feedback'].dataset.status,'error');
});
test('polygon viewer uses protected API and exact paired scene identifiers',()=>{
 assert.match(source,/Authorization:'Bearer '\+secret/);
 assert.match(source,/scene_before===S.metaBefore.id/);
 assert.match(source,/scene_after===S.metaAfter.id/);
 assert.match(source,/no changes are fabricated/);
});
test('after photo clipping changes display, not geographic alignment',()=>{
 assert.match(source,/pane.style.clipPath='inset/);
 assert.match(source,/getPane\('after-photo'\)/);
 assert.match(source,/fitBounds/);
});
test('images and overlays are discoverable and loaded in the right order',()=>{
 for(const id of ['compare-map','compare-load','compare-swipe','compare-admin-key',
  'compare-polygons','before-quicklook','after-quicklook'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.indexOf('/imagery-search.js')<html.indexOf('/imagery-compare.js'));
 assert.ok(search.includes('RSCDSImageryCompare?.setSearchResults'));
});
