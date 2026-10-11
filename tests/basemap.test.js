import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('public/map-basemap.js');
const html=read('public/index.html');
const js=read('public/app.js');
function fake(){
 const events={};
 const controls={};
 for(const key of ['map-status','map-grid-only','map-retry']){
  const ele={textContent:'',dataset:{},hidden:key==='map-retry',attrs:{},
   setAttribute(k,v){this.attrs[k]=v;},
   addEventListener(k,fn){this[k]=fn;}};
  controls[key]=ele;
 }
 const map={layers:[],removed:[],removeLayer(x){this.removed.push(x);this.layers=this.layers.filter(y=>y!==x);}};
 const ctx={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
 const document={getElementById:key=>controls[key],createElement:name=>({name,getContext:()=>ctx})};
 const L={gridLayer:()=>({addTo(map){map.layers.push(this);return this;}})};
 const timers=[];
 const window={};
 vm.runInNewContext(source,{document,L,window,setTimeout:(cb)=>{timers.push(cb);return timers.length;},clearTimeout:()=>{}});
 return {L,map,controls,window,timers,events};
}
test('no requests go to blocked standard OSM tile host',()=>{
 assert.doesNotMatch(source,/tile\\.openstreetmap\\.org/);
 assert.doesNotMatch(js,/tile\\.openstreetmap\\.org/);
 assert.match(source,/tiles\\.openfreemap\\.org\\/styles\\/liberty/);
 assert.match(html,/maplibre-gl/);
 assert.match(html,/map-basemap\\.js/);
});
test('missing vector renderer falls back to local grid and preserves AOI surface',()=>{
 const e=fake();e.window.RSCDSBaseMap.attach(e.map);
 assert.equal(e.window.RSCDSBaseMap.mode(),'grid');
 assert.equal(e.map.layers.length,1);
 assert.match(e.controls['map-status'].textContent,/Coordinate grid/);
 assert.equal(e.controls['map-retry'].hidden,false);
 assert.equal(e.controls['map-grid-only'].attrs['aria-pressed'],'true');
 const canvas=e.map.layers[0].createTile({x:34,y:17,z:6});
 assert.equal(canvas.width,256);
 assert.equal(canvas.height,256);
});
test('grid mode can be switched on before viewing sensitive areas',()=>{
 const e=fake();
 e.L.maplibreGL=()=>({addTo(map){map.layers.push(this);return this;},getMaplibreMap:()=>({on:(k,cb)=>{e.events[k]=cb;}})});
 e.window.maplibregl={supported:()=>true};
 e.window.RSCDSBaseMap.attach(e.map);
 assert.equal(e.window.RSCDSBaseMap.mode(),'streets');
 e.events.load();
 assert.match(e.controls['map-status'].textContent,/ready/);
 e.controls['map-grid-only'].click();
 assert.equal(e.window.RSCDSBaseMap.mode(),'grid');
 assert.equal(e.map.removed.length,1);
 assert.equal(e.controls['map-grid-only'].attrs['aria-pressed'],'true');
});
test('repeated vector-map errors switch safely to a grid',()=>{
 const e=fake();
 e.L.maplibreGL=()=>({addTo(map){map.layers.push(this);return this;},getMaplibreMap:()=>({on:(k,cb)=>{e.events[k]=cb;}})});
 e.window.maplibregl={supported:()=>true};
 e.window.RSCDSBaseMap.attach(e.map);
 e.events.error();e.events.error();e.events.error();
 assert.equal(e.window.RSCDSBaseMap.mode(),'grid');
 assert.match(e.controls['map-status'].textContent,/tiles failed/);
});
test('app preserves two-click area selection with new basemap controller',()=>{
 assert.match(js,/state\\.map\\.on\\('click'/);
 assert.match(js,/RSCDSBaseMap\\?\\.attach\\(state\\.map\\)/);
 assert.match(js,/L\\.rectangle\\(bounds/);
});
