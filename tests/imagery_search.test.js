import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/imagery-search.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function setup(responder){
 const nodes={};
 const make=()=>({
  value:'',textContent:'',dataset:{},className:'',children:[],disabled:false,
  append(...items){this.children.push(...items);},
  replaceChildren(){this.children=[];},
  addEventListener(name,cb){this[name]=cb;},
  setAttribute(){},
 });
 for(const name of ['search-scenes','bbox','before','after','scene-search-feedback',
   'before-results','after-results','imagery-sample'])nodes[name]=make();
 nodes['search-scenes'].textContent='Search imagery';
 nodes.bbox.value='8.20,7.60,8.25,7.65';
 nodes.before.value='2025-01-01/2025-03-31';
 nodes.after.value='2026-01-01/2026-03-31';
 const doc={readyState:'complete',getElementById:id=>nodes[id],createElement:()=>make()};
 const window={location:{search:''}};
 const calls=[];
 vm.runInNewContext(source,{document:doc,window,AbortController,
  URLSearchParams,fetch:async(url,opts)=>{
   calls.push({url,opts});
   return responder(url,opts);
  },setTimeout:()=>1,clearTimeout:()=>{}});
 return {nodes,calls,api:window.RSCDSImagery};
}
const scene={id:'S2B_T32NMP_20250128T094646_L2A',date:'2025-01-28T10:00:00Z',
 cloudCover:5.5,platform:'sentinel-2b'};
const success=features=>({ok:true,status:200,json:async()=>({features})});
test('imagery search runs independently of the dashboard and map scripts',async()=>{
 const x=setup(async()=>success([scene]));
 await x.api.search();
 assert.equal(x.calls.length,2);
 assert.equal(x.nodes['before-results'].children.length,1);
 assert.equal(x.nodes['after-results'].children.length,1);
 assert.equal(x.nodes['scene-search-feedback'].dataset.status,'success');
 assert.equal(x.nodes['search-scenes'].disabled,false);
 assert.ok(x.calls.every(c=>!('Authorization' in c.opts.headers)));
});
test('before and after searches show partial results separately',async()=>{
 const x=setup(async url=>url.includes('2025-01-01')?success([scene]):
  {ok:false,status:502,json:async()=>({error:'Satellite imagery catalogue unavailable'})});
 await x.api.search();
 assert.equal(x.nodes['before-results'].children.length,1);
 assert.match(x.nodes['after-results'].children[0].textContent,/search failed/i);
 assert.equal(x.nodes['scene-search-feedback'].dataset.status,'error');
});
test('invalid dates and coordinates are rejected before network requests',async()=>{
 const x=setup(async()=>success([]));
 x.nodes.before.value='2025-02-30/2025-03-31';
 await x.api.search();
 assert.equal(x.calls.length,0);
 assert.match(x.nodes['scene-search-feedback'].textContent,/real dates/);
 x.nodes.before.value='2025-01-01/2025-03-31';
 x.nodes.bbox.value='8,7,12,10';
 await x.api.search();
 assert.equal(x.calls.length,0);
 assert.match(x.nodes['scene-search-feedback'].textContent,/too large/);
});
test('working example button restores valid example observation periods',()=>{
 const x=setup(async()=>success([]));
 x.nodes.bbox.value='bad';
 x.nodes['imagery-sample'].click();
 assert.equal(x.nodes.bbox.value,'8.20,7.60,8.25,7.65');
 assert.equal(x.nodes.before.value,'2025-01-01/2025-03-31');
 assert.equal(x.nodes.after.value,'2026-01-01/2026-03-31');
});
test('search component is loaded as separate script before dashboard app',()=>{
 assert.ok(html.includes('src="/imagery-search.js"'));
 assert.ok(html.indexOf('imagery-search.js')<html.indexOf('src="/app.js"'));
 assert.match(html,/id="scene-search-feedback"/);
 assert.match(html,/id="imagery-sample"/);
});
