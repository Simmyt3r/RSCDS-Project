/* RSCDS private job-linked visual evidence. Coordinates never leave the app
 * unless the operator explicitly opens the external photographic renderer. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const S={key:'',job:null,summary:null,features:[],next:null,selected:null,map:null,layer:null,loaded:false,sequence:0,busy:false};
function say(message,error=false){const el=$('evidence-status');if(el){el.textContent=message;el.dataset.status=error?'error':'info';}}
async function api(path,options={}){
 if(!S.key)throw Error('Enter the administrator key to access private evidence.');
 const response=await fetch(path,{...options,cache:'no-store',headers:{
  ...(options.headers||{}),Authorization:'Bearer '+S.key,Accept:'application/json'
 }});
 let body;try{body=await response.json();}catch{throw Error('Invalid response from private evidence service');}
 if(!response.ok)throw Error(body.error||'Private request rejected (HTTP '+response.status+')');
 return body;
}
function resetEvidence(message='No verified analysis record loaded.'){
 S.loaded=false;S.job=null;S.summary=null;S.features=[];S.next=null;S.selected=null;
 if(S.map&&S.layer){S.map.removeLayer(S.layer);S.layer=null;}
 for(const id of ['evidence-photos','evidence-report','evidence-geojson','ev-submit']){
  if($(id))$(id).disabled=true;
 }
 if($('evidence-next'))$('evidence-next').hidden=true;
 for(const id of ['ev-unverified','ev-verified','ev-rejected','ev-valid','ev-before-date','ev-after-date'])
  text(id,'—');
 text('ev-before','No scene loaded');text('ev-after','No scene loaded');
 text('ev-method','Processing method: —');text('evidence-state','No record');
 text('ev-selected','Select an unverified candidate after loading evidence.');
 text('evidence-page-status','');
 const box=$('evidence-candidates');
 if(box){
  box.replaceChildren();
  const note=document.createElement('div');note.className='empty';note.textContent=message;
  box.append(note);
 }
}
function date(value){if(!value)return 'Not recorded';const dt=new Date(value);return Number.isFinite(dt.getTime())?dt.toLocaleString():String(value);}
function text(id,value){const el=$(id);if(el)el.textContent=value==null?'—':String(value);}
function setAuth(key){
 const next=String(key||'').trim();
 if(S.key&&next!==S.key)resetEvidence('Authorization changed. Open a completed analysis again.');
 S.key=next;
 if(S.key)text('evidence-status','Administrator key held in this browser tab only.');
}
async function listJobs(){
 const key=$('evidence-key')?.value.trim();if(key)setAuth(key);
 const select=$('evidence-job');if(!select)return;
 try{
  say('Loading completed analysis jobs…');
  const data=await api('/api/jobs');
  select.replaceChildren();
  const jobs=(data.jobs||[]).filter(j=>j.status==='completed');
  const blank=document.createElement('option');blank.value='';blank.textContent=jobs.length?'Select completed analysis':'No completed analyses yet';
  select.append(blank);
  for(const job of jobs){
   const item=document.createElement('option');item.value=job.id;
   item.textContent='Run '+job.id.slice(0,8)+' · '+date(job.finished_at)+(job.scene_before?' · source-linked':' · legacy provenance missing');
   select.append(item);
  }
  say(jobs.length?jobs.length+' completed job(s) available. Select one to inspect.':'No completed runs yet. A green idle worker workflow does not generate evidence.');
 }catch(err){say(err.message,true);}
}
function drawGrid(){
 if(typeof L==='undefined')throw Error('Leaflet unavailable; candidate list and exports remain usable.');
 const tile=L.gridLayer({tileSize:256});
 tile.createTile=point=>{
  const cv=document.createElement('canvas');cv.width=256;cv.height=256;
  const ctx=cv.getContext('2d');if(!ctx)return cv;
  ctx.fillStyle='#f1f7f6';ctx.fillRect(0,0,256,256);
  ctx.strokeStyle='#c7d9d8';ctx.lineWidth=1;ctx.strokeRect(.5,.5,255,255);
  ctx.fillStyle='#708c90';ctx.font='12px system-ui';ctx.fillText('Coordinate reference grid',12,23);
  return cv;
 };
 return tile;
}
function selectedFeature(feature){
 S.selected=feature;
 const p=feature.properties||{};
 text('ev-selected','Candidate #'+feature.id+' · '+p.review_status+' · '+Math.round(p.area_m2||0).toLocaleString()+' m² · score '+Number(p.score||0).toFixed(2));
 if($('ev-submit'))$('ev-submit').disabled=p.review_status!=='unverified';
 if(p.review_status!=='unverified'){
  text('ev-selected','Candidate #'+feature.id+' was reviewed as '+p.review_status+' by '+(p.reviewer||'a reviewer')+
  '. Evidence notes: '+(p.review_notes||'Not recorded'));
 }
}
function renderMap(){
 const root=$('evidence-map');if(!root)return;
 if(typeof L==='undefined'){root.textContent='Mapping is unavailable. Coordinates and evidence remain accessible in the register.';return;}
 try{
  if(!S.map){S.map=L.map(root,{scrollWheelZoom:false,zoomControl:true}).setView([7.6,8.25],11);drawGrid().addTo(S.map);}
  if(S.layer)S.map.removeLayer(S.layer);
  const collection={type:'FeatureCollection',features:S.features};
  S.layer=L.geoJSON(collection,{
   style:f=>({color:f.properties.review_status==='verified'?'#16926d':f.properties.review_status==='rejected'?'#b75064':'#dc9225',weight:2,fillOpacity:.2}),
   onEachFeature:(f,layer)=>{
    const popup=document.createElement('div');popup.textContent='Candidate #'+f.id+' · '+f.properties.review_status;
    layer.bindPopup(popup);
    layer.on('click',()=>selectedFeature(f));
   }
  }).addTo(S.map);
  const bbox=S.job?.bbox;
  if(Array.isArray(bbox)&&bbox.length===4&&bbox.every(Number.isFinite))
   S.map.fitBounds([[bbox[1],bbox[0]],[bbox[3],bbox[2]]],{padding:[18,18]});
  setTimeout(()=>S.map?.invalidateSize(),100);
 }catch(err){root.textContent='Map unavailable: '+err.message+'. Candidate register remains usable.';}
}
function renderCandidates(){
 const box=$('evidence-candidates');if(!box)return;
 box.replaceChildren();
 if(!S.features.length){
  const p=document.createElement('div');p.className='empty';p.textContent='No stored change polygons in this completed run. That does not prove no land-cover change occurred.';box.append(p);
 }else{
  for(const feature of S.features){
   const p=feature.properties||{};
   const item=document.createElement('div');item.className='evidence-feature';
   const detail=document.createElement('div');detail.className='evidence-feature-detail';
   const title=document.createElement('strong');title.textContent='Candidate #'+feature.id+' · '+(p.site_label||'Change candidate');
   const desc=document.createElement('small');desc.textContent=Math.round(p.area_m2||0).toLocaleString()+' m² · score '+Number(p.score||0).toFixed(2);
   const review=document.createElement('small');review.textContent='Review: '+p.review_status+(p.reviewer?' · '+p.reviewer:'');
   const hash=document.createElement('small');hash.textContent='Evidence hash: '+(p.feature_hash||'Legacy hash missing');
   detail.append(title,desc,review,hash);
   const focus=document.createElement('button');focus.className='secondary';focus.textContent=p.review_status==='unverified'?'Select for review':'Inspect record';
   focus.addEventListener('click',()=>{
    selectedFeature(feature);
    const layer=S.layer?.getLayers().find(l=>l.feature?.id===feature.id);
    if(layer){const bounds=layer.getBounds?.();if(bounds?.isValid?.())S.map.fitBounds(bounds.pad(.8));layer.openPopup?.();}
   });
   item.append(detail,focus);box.append(item);
  }
 }
 text('evidence-page-status',S.features.length+' of '+(S.summary?.total??0)+' candidates loaded. Full export requires all pages.');
 if($('evidence-next'))$('evidence-next').hidden=S.next===null;
 const ready=S.loaded&&S.next===null;
 if($('evidence-report'))$('evidence-report').disabled=!ready;
 if($('evidence-geojson'))$('evidence-geojson').disabled=!ready;
}
async function fetchPage(offset,replace=false,seq=S.sequence){
 const result=await api('/api/evidence?job_id='+encodeURIComponent(S.job.id)+'&offset='+encodeURIComponent(offset));
 if(seq!==S.sequence)return false;
 if(result.job?.id!==S.job.id)throw Error('Evidence response refers to a different analysis');
 if(replace)S.features=[];
 S.features.push(...(result.featureCollection?.features||[]));
 S.next=result.pagination?.next_offset??null;
 S.summary=result.summary;
 renderSummary();
 renderCandidates();renderMap();
 return true;
}
function renderSummary(){
 const j=S.job||{},s=S.summary||{};
 text('evidence-state',j.status||'Not selected');
 text('ev-unverified',s.unverified??0);text('ev-verified',s.verified??0);text('ev-rejected',s.rejected??0);
 text('ev-valid',j.valid_fraction==null?'Not recorded':Math.round(j.valid_fraction*100)+'%');
 text('ev-before',j.scene_before||'Provenance not recorded');text('ev-after',j.scene_after||'Provenance not recorded');
 text('ev-before-date',date(j.acquired_before));text('ev-after-date',date(j.acquired_after));
 text('ev-method','Method: '+(j.processor_method||'Unavailable for legacy jobs')+
  ' · total candidate area (non-deduplicated): '+Math.round(s.area_m2||0).toLocaleString()+' m²');
 if($('evidence-photos'))$('evidence-photos').disabled=!j.scene_before||!j.scene_after;
}
async function openJob(id,key){
 if(key)setAuth(key);
 window.RSCDSNavigation?.go('evidence');
 if(!S.key){say('Enter administrator key to open the protected analysis.',true);return;}
 if(!/^[0-9a-f-]{36}$/i.test(String(id))){say('Choose a completed job from the list.',true);return;}
 const seq=++S.sequence;
 resetEvidence('Loading the selected analysis record…');
 S.job={id};
 say('Opening exact scene provenance and candidate records…');
 try{
  const result=await api('/api/evidence?job_id='+encodeURIComponent(id)+'&offset=0');
  if(seq!==S.sequence)return;
  S.job=result.job;S.summary=result.summary;S.features=result.featureCollection?.features||[];
  S.next=result.pagination?.next_offset??null;
  S.loaded=true;
  if($('evidence-job'))$('evidence-job').value=id;
  renderSummary();renderCandidates();renderMap();
  say('Loaded '+S.features.length+' of '+(S.summary.total||0)+' candidates for job '+id.slice(0,8)+
   (S.job.scene_before?' with traceable scene provenance.':' (legacy run: source scene provenance unavailable).'));
 }catch(err){
  if(seq!==S.sequence)return;
  resetEvidence('Unable to load this analysis. No result polygons are displayed.');
  say(err.message,true);
 }
}
async function more(){
 if(!S.job||S.next===null||S.busy)return;S.busy=true;
 const button=$('evidence-next');if(button)button.disabled=true;
 try{await fetchPage(S.next,false);}catch(err){say(err.message,true);}
 finally{S.busy=false;if(button)button.disabled=false;}
}
async function review(){
 if(!S.loaded||!S.job||!S.selected){say('Open a completed analysis and select an unverified candidate before reviewing.',true);return;}
 if(S.selected.properties?.review_status!=='unverified'){say('This candidate has already been reviewed. Existing decisions are immutable.',true);return;}
 const reviewer=$('ev-reviewer')?.value.trim()||'',notes=$('ev-notes')?.value.trim()||'',status=$('ev-decision')?.value;
 if(reviewer.length<3||notes.length<10||!['verified','rejected'].includes(status)){say('Enter a reviewer (3+ characters), independent rationale (10+ characters), and a valid decision.',true);return;}
 const btn=$('ev-submit');if(btn)btn.disabled=true;
 try{
  await api('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:S.selected.id,status,reviewer,notes})});
  say('Evidence decision saved. Reloading the linked candidate record.');
  await openJob(S.job.id);
  if($('ev-notes'))$('ev-notes').value='';
 }catch(err){say(err.message,true);}
 finally{if(btn&&!S.selected)btn.disabled=true;}
}
function saveFile(name,payload,type){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=name;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function download(kind){
 if(!S.loaded||!S.job||S.next!==null){say('Open a completed analysis and load every page before exporting.',true);return;}
 const metadata={job:S.job,summary:S.summary,exported_at:new Date().toISOString(),
  caution:'Unvalidated land-cover-change candidates are not independently confirmed settlements. Review evidence must be independently assessed.'};
 const prefix='RSCDS_'+S.job.id.slice(0,8);
 if(kind==='geojson'){
  saveFile(prefix+'_private.geojson',{type:'FeatureCollection',metadata,features:S.features},'application/geo+json');
 }else{
  saveFile(prefix+'_evidence_manifest.json',{...metadata,candidate_reviews:S.features.map(f=>({id:f.id,
   fingerprint:f.properties?.feature_hash,review_status:f.properties?.review_status,
   reviewer:f.properties?.reviewer,review_notes:f.properties?.review_notes,
   reviewed_at:f.properties?.reviewed_at,source:f.properties?.source,
   scene_before:f.properties?.scene_before,scene_after:f.properties?.scene_after,
   score:f.properties?.score,area_m2:f.properties?.area_m2}))},'application/json');
 }
 say('Private '+(kind==='geojson'?'GeoJSON':'evidence manifest')+' prepared locally. Protect the downloaded file.');
}
function photos(){
 const j=S.loaded?S.job:null;if(!j?.scene_before||!j?.scene_after){say('The worker scene IDs are missing for this job. Do not guess imagery from search results.',true);return;}
 const controller=window.RSCDSImageryCompare;
 if(!controller){say('The imagery comparison module has not loaded.',true);return;}
 const bbox=j.bbox;if(Array.isArray(bbox)&&bbox.length===4&&$('bbox'))$('bbox').value=bbox.join(',');
 controller.select('before',{id:j.scene_before,date:j.acquired_before,cloudCover:null});
 controller.select('after',{id:j.scene_after,date:j.acquired_after,cloudCover:null});
 controller.setLinkedEvidence?.(j.id,S.features,S.next!==null);
 window.RSCDSNavigation?.go('imagery');
 $('imagery-compare-panel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
 // No external TiTiler request occurs until the operator explicitly renders.
}
function bind(){
 $('evidence-unlock')?.addEventListener('click',()=>void listJobs());
 $('evidence-open')?.addEventListener('click',()=>void openJob($('evidence-job')?.value));
 $('evidence-refresh')?.addEventListener('click',()=>S.job?.id?void openJob(S.job.id):void listJobs());
 $('evidence-next')?.addEventListener('click',()=>void more());
 $('ev-submit')?.addEventListener('click',()=>void review());
 $('evidence-photos')?.addEventListener('click',photos);
 $('evidence-report')?.addEventListener('click',()=>download('manifest'));
 $('evidence-geojson')?.addEventListener('click',()=>download('geojson'));
 if($('ev-submit'))$('ev-submit').disabled=true;
}
window.RSCDSEvidence={openJob,listJobs,photos};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
