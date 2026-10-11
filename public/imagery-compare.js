/* Real Sentinel-2 true-colour raster comparison. No private data is sent to tile provider. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const S={before:null,after:null,metaBefore:null,metaAfter:null,map:null,beforeLayer:null,afterLayer:null,polygons:null,bounds:null,request:0,failures:0,loads:0,linkedEvidence:null};
function feedback(message,level='info'){const el=$('compare-feedback');if(el){el.textContent=message;el.dataset.status=level;}}
function date(scene){return String(scene?.date||'Unknown acquisition').slice(0,10);}
function select(kind,scene){
 if(!['before','after'].includes(kind)||!scene?.id)return;
 S[kind]=scene;
 const title=$('compare-'+kind+'-label'),sub=$('compare-'+kind+'-detail');
 if(title)title.textContent=date(scene);
 if(sub)sub.textContent=scene.id+(scene.cloudCover==null?' · acquisition-specific cloud fraction unrecorded':' · '+Number(scene.cloudCover).toFixed(1)+'% scene-wide clouds');
 if(kind==='before')S.metaBefore=null;else S.metaAfter=null;
 feedback('Image selected. Render the pair to update the comparison map.');
}
function best(list){
 return (list||[]).filter(x=>x?.id&&(x.assets||[]).includes('visual')).sort((a,b)=>Number(a.cloudCover??100)-Number(b.cloudCover??100))[0]
  ||list?.[0]||null;
}
function setSearchResults(before,after){
 const a=best(before),b=best(after);
 if(a)select('before',a);
 if(b)select('after',b);
 if(a&&b)feedback('Two real acquisitions selected using lowest scene-wide cloud percentage. You may choose other scenes above.');
}
function clearLayer(name){
 if(S.map&&S[name]){try{S.map.removeLayer(S[name]);}catch{}}
 S[name]=null;
}
function setSwipe(value){
 const pct=Math.max(0,Math.min(100,Number(value)||0));
 const pane=S.map?.getPane('after-photo');
 if(pane)pane.style.clipPath='inset(0 '+(100-pct)+'% 0 0)';
 const display=$('compare-swipe-value');if(display)display.textContent=pct+'%';
}
function studyBBox(){
 const value=window.RSCDSImagery?.parseBBox($('bbox')?.value);
 if(!value)throw Error('Enter valid coordinates and search imagery again.');
 return value.split(',').map(Number);
}
function intersects(a,b){return Array.isArray(b)&&a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
async function lookup(scene){
 const res=await fetch('/api/imagery?scene='+encodeURIComponent(scene.id),{cache:'no-store'});
 const data=await res.json();
 if(!res.ok)throw Error(data.error||'Unable to load original satellite source');
 if(data.id!==scene.id)throw Error('Mismatched source scene.');
 return data;
}
function preview(kind,scene){
 const el=$(kind+'-quicklook');
 if(!el)return;
 el.replaceChildren();
 if(!scene.preview){el.textContent='No photographic quicklook is available for this scene.';return;}
 const img=document.createElement('img');
 img.src=scene.preview;img.loading='lazy';img.referrerPolicy='no-referrer';
 img.alt='Full-scene Sentinel-2 true-colour photographic preview from '+date(scene);
 img.onerror=()=>{el.textContent='Photographic quicklook unavailable. The aligned map may still work.';};
 const label=document.createElement('small');label.textContent=date(scene)+' · '+scene.id;
 el.append(img,label);
}
function mapReady(bbox){
 if(typeof L==='undefined')throw Error('Leaflet map library did not load. View the full-scene photographs below.');
 if(!S.map){
  S.map=L.map('compare-map',{scrollWheelZoom:false,zoomControl:true,maxZoom:18});
  for(const [name,index] of [['before-photo',200],['after-photo',201],['change-polygons',460]]){
   S.map.createPane(name);
   const pane=S.map.getPane(name);
   pane.style.zIndex=String(index);
   if(name==='after-photo'){
    // Leaflet panes are absolutely positioned with no intrinsic dimensions.
    // Give the clipping plane viewport dimensions so swipe percentages work.
    pane.style.width='100%';
    pane.style.height='100%';
   }
  }
 }
 clearLayer('beforeLayer');clearLayer('afterLayer');clearLayer('polygons');
 S.bounds=bbox;S.failures=0;S.loads=0;
 S.map.fitBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]],{padding:[16,16],maxZoom:15});
 setTimeout(()=>S.map?.invalidateSize(),120);
}
function tileError(){
 S.failures++;
 if(S.failures>=4)feedback('Some aligned raster tiles failed to render. The external demo may be rate limited or images may not cover the entire view. Actual source quicklooks remain below.','error');
}
async function render(){
 if(!S.before||!S.after){feedback('Select a before and after acquisition first.','error');return;}
 const button=$('compare-load');if(button)button.disabled=true;
 const sequence=++S.request;
 feedback('Loading both original Sentinel-2 scenes…','loading');
 try{
  const bbox=studyBBox();
  const [before,after]=await Promise.all([lookup(S.before),lookup(S.after)]);
  if(sequence!==S.request)return;
  S.metaBefore=before;S.metaAfter=after;
  preview('before',before);preview('after',after);
  if(!intersects(bbox,before.bbox)||!intersects(bbox,after.bbox))
   throw Error('One chosen scene does not intersect the study area. Select scenes covering your coordinates.');
  if(!before.tileTemplate||!after.tileTemplate)
   throw Error('One scene has no public true-colour COG. See its actual full-scene preview below.');
  mapReady(bbox);
  const options={maxZoom:18,maxNativeZoom:17,updateWhenIdle:true,keepBuffer:0,
   attribution:'Copernicus Sentinel-2 · Element84 · TiTiler demo'};
  S.beforeLayer=L.tileLayer(before.tileTemplate,{...options,pane:'before-photo'});
  S.afterLayer=L.tileLayer(after.tileTemplate,{...options,pane:'after-photo'});
  for(const layer of [S.beforeLayer,S.afterLayer]){
   layer.on('tileload',()=>S.loads++);
   layer.on('tileerror',tileError);
   layer.addTo(S.map);
  }
  const slider=$('compare-swipe');if(slider){slider.disabled=false;setSwipe(slider.value);}
  feedback('Satellite images aligned to the same map coordinates. Drag the After image reveal slider to compare dates. Use private authentication below for change polygons.','success');
 }catch(error){feedback(String(error?.message||error),'error');}
 finally{if(button)button.disabled=false;}
}
function setLinkedEvidence(jobId,features,partial=false){
 // Supplied solely by authenticated /api/evidence response in this browser tab.
 S.linkedEvidence={jobId,features:Array.isArray(features)?features:[],partial:Boolean(partial)};
 const label=$('compare-polygon-status');
 if(label)label.textContent='Linked evidence job '+String(jobId).slice(0,8)+
  (partial?' (not all feature pages loaded)':' (complete available candidate set)')+
  '. Render selected source photos, then click Overlay change polygons.';
}
async function overlay(){
 const secret=$('compare-admin-key')?.value.trim();
 const label=$('compare-polygon-status');
 if(!S.map||!S.metaBefore||!S.metaAfter){if(label)label.textContent='Render dated images before overlaying polygons.';return;}
 if(!S.linkedEvidence&&!secret){if(label)label.textContent='Enter administrator key, or open an authenticated analysis from Visual evidence.';return;}
 const button=$('compare-polygons');if(button)button.disabled=true;
 try{
  let features;
  if(S.linkedEvidence)features=S.linkedEvidence.features;
  else{
   const response=await fetch('/api/detections',{headers:{Authorization:'Bearer '+secret},cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Administrator access denied');
   features=data.features||[];
  }
  const matched=features.filter(f=>f.properties?.scene_before===S.metaBefore.id&&f.properties?.scene_after===S.metaAfter.id);
  clearLayer('polygons');
  if(matched.length){
   S.polygons=L.geoJSON({type:'FeatureCollection',features:matched},{
    pane:'change-polygons',
    style:f=>({color:f.properties.review_status==='verified'?'#138d72':f.properties.review_status==='rejected'?'#b94c65':'#ffab27',weight:3,fillOpacity:.16}),
    onEachFeature:(f,layer)=>{
     const p=f.properties;
     const text=document.createElement('div');
     const title=document.createElement('strong');title.textContent='Change candidate #'+f.id;
     const desc=document.createElement('div');desc.textContent='Status: '+p.review_status+' · score: '+Number(p.score).toFixed(2)+' · area: '+Math.round(Number(p.area_m2))+' m²';
     text.append(title,desc);layer.bindPopup(text);
    }
   }).addTo(S.map);
  }
  if(label)label.textContent=matched.length
    ?matched.length+' polygons from this exact before/after scene pair (amber: unverified, green: verified, red: rejected).'
    :'No stored polygons correspond to this exact image pair. The analysis worker may have selected different dates; no changes are fabricated.';
 }catch(error){if(label)label.textContent='Cannot load private polygons: '+String(error.message||error);}
 finally{if(button)button.disabled=false;}
}
function bind(){
 $('compare-load')?.addEventListener('click',()=>void render());
 $('compare-swipe')?.addEventListener('input',ev=>setSwipe(ev.target.value));
 $('compare-reset')?.addEventListener('click',()=>{
  if(S.map&&S.bounds){const [w,s,e,n]=S.bounds;S.map.fitBounds([[s,w],[n,e]],{padding:[16,16],maxZoom:15});}
 });
 $('compare-polygons')?.addEventListener('click',()=>void overlay());
 $('compare-clear-polygons')?.addEventListener('click',()=>{
  clearLayer('polygons');const el=$('compare-polygon-status');if(el)el.textContent='Polygon overlay hidden.';
 });
}
window.RSCDSImageryCompare={select,setSearchResults,render,overlay,setSwipe,setLinkedEvidence};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
