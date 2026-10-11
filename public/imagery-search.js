/* Standalone Sentinel-2 discovery. Keeps search functional when map/dashboard scripts fail. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let inFlight=false;
 function parseBBox(value){
  const a=String(value||'').split(',').map(part=>Number(part.trim()));
  if(a.length!==4||!a.every(Number.isFinite))throw Error('Enter four numbers: west,south,east,north.');
  const [w,s,e,n]=a;
  if(w< -180||e>180||s< -85||n>85||w>=e||s>=n)throw Error('The study-area coordinates are invalid. West must be less than east; south less than north.');
  if(e-w>.5||n-s>.5)throw Error('Search area too large. Choose an area no wider or taller than 0.5 degrees.');
  return a.join(',');
 }
 function validISO(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.toISOString().slice(0,10)===value;
 }
 function parsePeriod(value,label){
  const parts=String(value||'').trim().split('/');
  if(parts.length!==2||!parts.every(validISO)||parts[0]>parts[1])
   throw Error(label+' must use YYYY-MM-DD/YYYY-MM-DD with real dates, from earliest to latest.');
  return parts.join('/');
 }
 function setStatus(message,kind='info'){
  const el=$('scene-search-feedback');
  if(!el)return;
  el.textContent=message;
  el.dataset.status=kind;
 }
 function empty(id,message){
  const el=$(id);if(!el)return;
  el.replaceChildren();
  const p=document.createElement('div');p.className='empty';p.textContent=message;el.append(p);
 }
 function renderScenes(id,features){
  const el=$(id);if(!el)return;
  el.replaceChildren();
  if(!features.length){empty(id,'No matching scenes in this period. Try a wider date range.');return;}
  for(const scene of features){
   const row=document.createElement('div');row.className='scene';
   const info=document.createElement('div');info.className='scene-info';
   const title=document.createElement('strong');title.textContent=String(scene.date||'Unknown acquisition').slice(0,10);
   const subtitle=document.createElement('small');subtitle.textContent=String(scene.platform||'Sentinel-2');
   const reference=document.createElement('small');reference.className='scene-ref';reference.textContent=String(scene.id||'');
   info.append(title,subtitle,reference);
   const actions=document.createElement('div');actions.className='scene-actions';
   const clouds=Number(scene.cloudCover);
   const coverage=document.createElement('span');coverage.className='percent '+(clouds>30?'cloudy':'');
   coverage.textContent=Number.isFinite(clouds)?clouds.toFixed(1)+'% scene clouds':'Cloud unknown';
   actions.append(coverage);
   const kind=id==='before-results'?'before':'after';
   const choose=document.createElement('button');choose.type='button';choose.className='scene-select';
   choose.textContent='Use as '+kind+' image';
   choose.addEventListener('click',()=>window.RSCDSImageryCompare?.select(kind,scene));
   actions.append(choose);
   if(typeof scene.id==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(scene.id)){
    const link=document.createElement('a');
    link.href='https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/'+encodeURIComponent(scene.id);
    link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Source record ↗';link.className='scene-source';
    actions.append(link);
   }
   row.append(info,actions);
   el.append(row);
  }
 }
 async function fetchScenes(area,period,signal){
  const path='/api/scenes?bbox='+encodeURIComponent(area)+'&dates='+encodeURIComponent(period);
  let res;
  try{res=await fetch(path,{method:'GET',headers:{'Accept':'application/json'},signal,cache:'no-store'});}
  catch(error){
   if(error?.name==='AbortError')throw Error('Search timed out. Retry the search.');
   throw Error('Network request failed. Check your connection and try again.');
  }
  let data;
  try{data=await res.json();}catch{throw Error('Server returned an unreadable response. Retry in a moment.');}
  if(!res.ok)throw Error((data&&typeof data.error==='string'?data.error:'Satellite search failed')+' (HTTP '+res.status+').');
  if(!data||!Array.isArray(data.features))throw Error('Satellite catalogue returned an unexpected response.');
  return data.features;
 }
 async function search(){
  if(inFlight)return;
  const button=$('search-scenes');
  if(!button)return;
  let area,before,after;
  try{
   area=parseBBox($('bbox')?.value);
   before=parsePeriod($('before')?.value,'Before window');
   after=parsePeriod($('after')?.value,'After window');
  }catch(error){setStatus(error.message,'error');return;}
  inFlight=true;
  button.disabled=true;
  const oldLabel=button.textContent;
  button.textContent='Searching Sentinel-2…';
  setStatus('Contacting the satellite catalogue for both periods. This may take up to 30 seconds.','loading');
  empty('before-results','Searching the baseline period…');
  empty('after-results','Searching the comparison period…');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),32000);
  try{
   const responses=await Promise.allSettled([fetchScenes(area,before,controller.signal),fetchScenes(area,after,controller.signal)]);
   let success=0;let failures=[];
   for(let i=0;i<responses.length;i++){
    const result=responses[i],id=i===0?'before-results':'after-results',name=i===0?'Before':'After';
    if(result.status==='fulfilled'){
     renderScenes(id,result.value);success++;
    }else{
     const message=String(result.reason?.message||'Unknown error');
     empty(id,name+' search failed: '+message);
     failures.push(name+': '+message);
    }
   }
   if(success)window.RSCDSImageryCompare?.setSearchResults(
    responses[0].status==='fulfilled'?responses[0].value:[],
    responses[1].status==='fulfilled'?responses[1].value:[]);
   if(failures.length)setStatus((success?'Partial results loaded. ':'')+failures.join(' '),'error');
   else setStatus('Found '+responses[0].value.length+' baseline and '+responses[1].value.length+' comparison Sentinel-2 scenes. Results are source metadata, not rendered images.','success');
  }finally{
   clearTimeout(timer);inFlight=false;button.disabled=false;button.textContent=oldLabel;
  }
 }
 function bind(){
  $('search-scenes')?.addEventListener('click',()=>void search().catch(error=>{
   inFlight=false;const button=$('search-scenes');if(button){button.disabled=false;button.textContent='Search imagery';}
   setStatus('Unexpected search error: '+String(error?.message||'Please retry'),'error');
  }));
  $('imagery-sample')?.addEventListener('click',()=>{
   if($('bbox'))$('bbox').value='8.20,7.60,8.25,7.65';
   if($('before'))$('before').value='2025-01-01/2025-03-31';
   if($('after'))$('after').value='2026-01-01/2026-03-31';
   setStatus('Example loaded. Click Search imagery to find real satellite scenes.','info');
  });
  if(new URLSearchParams(window.location.search).get('search')==='1')void search();
 }
 window.RSCDSImagery={search,parseBBox,parsePeriod};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
})();
