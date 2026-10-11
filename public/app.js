const $=id=>document.getElementById(id);
const state={map:null,rectangle:null,points:[],key:'',detections:[],candidateLayer:null,selectedJob:null};
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4200);}
function tab(name){return window.RSCDSNavigation?.go(name)||false;}
window.addEventListener('rscds:overview-visible',()=>{if(state.map)setTimeout(()=>state.map.invalidateSize(),160);});
async function request(url,options={}){const res=await fetch(url,{...options,headers:{...(options.headers||{}),...(state.key?{Authorization:'Bearer '+state.key}:{})}});const d=await res.json();if(!res.ok)throw Error(d.error||res.statusText);return d;}
function textNode(el,s){el.textContent=s;return el;}
function clearMap(){state.points=[];if(state.rectangle){state.rectangle.remove();state.rectangle=null;} $('map-coords').textContent='No region selected';}
function setBox(a,b){if(!state.map)return;clearMap();const bounds=L.latLngBounds(a,b);state.rectangle=L.rectangle(bounds,{color:'#118c88',weight:2,fillOpacity:.11}).addTo(state.map);state.map.fitBounds(bounds,{padding:[35,35]});const w=bounds.getWest(),s=bounds.getSouth(),e=bounds.getEast(),n=bounds.getNorth();const value=[w,s,e,n].map(x=>x.toFixed(5)).join(',');$('bbox').value=value;$('map-coords').textContent='AOI: '+value;buildCommand();}
function initializeMap(){
 if(typeof L==='undefined'){
  $('map').textContent='Map library unavailable. Enter your coordinates in Satellite imagery.';
  $('map-status').textContent='Map library unavailable; analysis inputs still work without the map.';
  return;
 }
 state.map=L.map('map',{scrollWheelZoom:false,zoomControl:true}).setView([9.05,8.7],6);
 state.map.on('click',e=>{
  state.points.push(e.latlng);
  if(state.points.length===2){setBox(state.points[0],state.points[1]);state.points=[];}
  else toast('Click the opposite corner of your study area.');
 });
 window.RSCDSBaseMap?.attach(state.map);
}
function buildCommand(){const bbox=$('bbox').value.trim(),before=$('before').value.trim(),after=$('after').value.trim();const cmd=`bbox: ${bbox}\nbefore: ${before}\nafter: ${after}`;$('worker-command').textContent=cmd;return cmd;}
function showScenes(id,data){const el=$(id);el.replaceChildren();if(!data.features.length){el.innerHTML='<div class="empty">No scenes found in this date range.</div>';return;}for(const item of data.features){const div=document.createElement('div');div.className='scene';const left=document.createElement('div');const title=document.createElement('strong');title.textContent=(item.date||'Unknown date').slice(0,10);const detail=document.createElement('small');detail.textContent=(item.platform||'Sentinel-2')+' · '+item.id;left.append(title,detail);const right=document.createElement('span');const cloud=Number(item.cloudCover||0);right.className='percent '+(cloud>30?'cloudy':'');right.textContent=cloud.toFixed(0)+'% clouds';div.append(left,right);el.append(div);}}
async function searchScenes(){$('search-scenes').disabled=true;const area=$('bbox').value.trim();buildCommand();$('before-results').textContent='Searching public imagery...';$('after-results').textContent='Searching public imagery...';try{const [a,b]=await Promise.all([request('/api/scenes?bbox='+encodeURIComponent(area)+'&dates='+encodeURIComponent($('before').value.trim())),request('/api/scenes?bbox='+encodeURIComponent(area)+'&dates='+encodeURIComponent($('after').value.trim()))]);showScenes('before-results',a);showScenes('after-results',b);toast('Real STAC scene metadata loaded. Select scenes in the analysis worker.');}catch(e){['before-results','after-results'].forEach(id=>textNode($(id),e.message));toast(e.message);}finally{$('search-scenes').disabled=false;}}
async function getDetections(){try{
 const uri=state.selectedJob?'/api/detections?job_id='+encodeURIComponent(state.selectedJob):'/api/detections';
 const data=await request(uri);state.detections=data.features||[];if(state.map&&typeof L!=='undefined'){if(state.candidateLayer)state.candidateLayer.remove();state.candidateLayer=L.geoJSON({type:'FeatureCollection',features:state.detections},{style:f=>({color:f.properties.review_status==='verified'?'#14866f':f.properties.review_status==='rejected'?'#be6962':'#d18a32',fillOpacity:.13,weight:2}),onEachFeature:(f,layer)=>layer.bindPopup('Candidate #'+f.id+' | '+f.properties.review_status)}).addTo(state.map);}if(!state.selectedJob){$('stat-candidates').textContent=state.detections.length;$('stat-verified').textContent=state.detections.filter(x=>x.properties.review_status==='verified').length;}showDetections('detection-results',false);showDetections('review-results',true);}catch(e){$('detection-results').textContent=e.message;$('review-results').textContent=e.message;toast(e.message);}}
function showDetections(id,review){const el=$(id);el.replaceChildren();
 if(state.selectedJob){
  const filter=document.createElement('div');filter.className='job-filter';
  const label=document.createElement('span');label.textContent='Showing completed analysis '+state.selectedJob.slice(0,8);
  const clear=document.createElement('button');clear.className='secondary';clear.textContent='Show all candidates';
  clear.onclick=()=>{state.selectedJob=null;void getDetections();};
  filter.append(label,clear);el.append(filter);
 }
 if(!state.detections.length){
  const empty=document.createElement('div');empty.className='empty';
  empty.textContent=state.selectedJob?'No changed polygons were produced in this completed run. This does not prove there was no settlement change.':'No reviewable candidates yet. Queue and complete an analysis, or import a validated GeoJSON file.';
  el.append(empty);return;
 }for(const f of state.detections){const p=f.properties,div=document.createElement('div'),meta=document.createElement('div');div.className='candidate';meta.className='candidate-meta';const h=document.createElement('strong');h.textContent=(p.site_label||'Candidate')+' #'+f.id;const info=document.createElement('small');info.textContent='Area '+Math.round(p.area_m2).toLocaleString()+' m² | Score '+Number(p.score).toFixed(2)+' | '+p.review_status+' | '+(p.created_at||'').slice(0,10);const provenance=document.createElement('small');provenance.textContent='Source: '+(p.source||'').slice(0,160);meta.append(h,info,provenance);div.append(meta);if(review&&p.review_status==='unverified'){const tools=document.createElement('div');tools.className='candidate-actions';for(const option of ['verified','rejected']){const button=document.createElement('button');button.className=option==='verified'?'primary':'secondary';button.textContent=option==='verified'?'Verify':'Reject';button.onclick=()=>reviewDetection(f.id,option);tools.append(button);}div.append(tools);}el.append(div);}}
async function reviewDetection(id,status){const reviewer=prompt('Reviewer name (required):');if(!reviewer)return;const notes=prompt('Independent evidence and review rationale (minimum 10 characters):');if(!notes)return;try{await request('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status,reviewer,notes})});toast('Review saved with evidence trail');getDetections();}catch(e){toast(e.message);}}
async function uploadGeoJSON(){
 const file=$('geojson-file').files?.[0];if(!file)return toast('Choose a GeoJSON file.');
 if(file.size>2e6)return toast('File too large. Upload up to 2 MB.');
 const button=$('upload-geojson');button.disabled=true;
 try{
  const data=JSON.parse(await file.text());
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>5000)throw Error('Use a GeoJSON FeatureCollection with up to 5,000 features.');
  let imported=0,duplicates=0;
  for(let i=0;i<data.features.length;i+=100){
   $('upload-response').textContent=`Importing ${Math.min(i+100,data.features.length)} of ${data.features.length}...`;
   const response=await request('/api/detections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'FeatureCollection',features:data.features.slice(i,i+100)})});
   imported+=response.imported;duplicates+=response.skipped_duplicates||0;
  }
  $('upload-response').textContent=imported+' unverified features imported; '+duplicates+' previously imported features skipped.';
  await getDetections();
 }catch(e){$('upload-response').textContent=e.message;toast(e.message);}
 finally{button.disabled=false;}
}
function useAnalysisKey(){
 const value=$('job-admin-key').value.trim();
 if(!value){toast('Enter the administrator key first');return;}
 state.key=value;$('admin-key').value=value;$('job-admin-key').value='';
 $('job-notice').textContent='Administrator key active in this browser tab only.';
 void getJobs();
}
function renderQueueStatus(counts){
 const summary=$('queue-summary');if(!summary)return;
 summary.replaceChildren();
 const labels=[['queued','Queued'],['running','Running'],['completed','Completed'],['failed','Failed']];
 for(const [key,label] of labels){
  const item=document.createElement('div');item.className='queue-count';
  const value=document.createElement('strong');value.textContent=String(counts[key]||0);
  const title=document.createElement('span');title.textContent=label;
  item.append(value,title);summary.append(item);
 }
 const guide=$('queue-guidance');
 if(counts.running)guide.textContent='A worker has leased a job. Check this page again for results; imagery downloads and raster analysis happen outside Vercel.';
 else if(counts.queued)guide.textContent='Your analysis is queued. GitHub Actions checks the queue on its schedule. The Run workflow button can trigger an earlier check.';
 else if(counts.failed)guide.textContent='No active jobs. Some analyses failed; review the sanitized error details and use Retry if appropriate.';
 else if(counts.completed)guide.textContent='No active jobs. Completed results are ready to inspect below; each change polygon still requires independent human evidence.';
 else guide.textContent='No analysis has been submitted. The successful GitHub workflow only checked for work. Select an area and dates, then press Queue secure analysis.';
}
function viewJobResults(jobId){
 state.selectedJob=jobId;tab('detections');void getDetections();
}
async function getJobs(){
 if(!state.key){$('job-results').textContent='Enter the administrator key and unlock analysis.';return;}
 const box=$('job-results');box.textContent='Loading private queue...';
 try{
  const data=await request('/api/jobs');box.replaceChildren();
  renderQueueStatus(data.summary||{queued:0,running:0,completed:0,failed:0});
  if(!data.jobs?.length){box.innerHTML='<div class="empty">No jobs yet. Select an area, choose dates, then queue an analysis.</div>';return;}
  for(const job of data.jobs){
   const row=document.createElement('div');row.className='job-row';
   const summary=document.createElement('div');summary.className='job-summary';
   const title=document.createElement('strong');title.textContent='Analysis '+job.id.slice(0,8);
   const dates=document.createElement('small');dates.textContent=`${job.before_window} → ${job.after_window} · ${new Date(job.created_at).toLocaleString()}`;
   const extent=document.createElement('small');extent.textContent='Private AOI: '+job.bbox.join(', ');
   const status=document.createElement('span');status.className='job-status job-'+job.status;status.textContent=job.status;
   summary.append(title,dates,extent);row.append(summary,status);
   if(job.status==='completed'){
    const count=document.createElement('small');count.textContent=`${job.result_count} new candidate(s) stored. A result count of zero is not evidence that there was no settlement change.`;summary.append(count);
    const inspect=document.createElement('button');inspect.className='secondary';inspect.textContent='View run results';
    inspect.onclick=()=>viewJobResults(job.id);row.append(inspect);
   }
   if(job.status==='failed'){
    const detail=document.createElement('small');detail.textContent=job.error_message||'Processing failed';summary.append(detail);
    const retry=document.createElement('button');retry.className='secondary';retry.textContent='Retry';retry.onclick=()=>retryJob(job.id,retry);row.append(retry);
   }
   box.append(row);
  }
 }catch(e){box.textContent=e.message;toast(e.message);}
}
async function retryJob(id,button){button.disabled=true;
 try{await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'retry',id})});toast('Job queued again');await getJobs();}
 catch(e){toast(e.message);}finally{button.disabled=false;}
}
async function queueAnalysis(){
 if(!state.key)return toast('Unlock the analysis queue with your administrator key first');
 const button=$('queue-analysis');button.disabled=true;
 try{
  const bbox=$('bbox').value.trim();const before=$('before').value.trim(),after=$('after').value.trim();
  const response=await request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bbox,before,after,cloud_max:Number($('job-cloud').value),min_pixels:Number($('job-pixels').value)})});
  $('job-notice').textContent='Queued job '+response.job.id.slice(0,8)+'. Worker checks every 30 minutes (sometimes later); use GitHub Actions to trigger a check immediately.';
  toast('Private analysis queued');await getJobs();
 }catch(e){$('job-notice').textContent=e.message;toast(e.message);}finally{button.disabled=false;}
}
async function health(){try{const h=await request('/api/health');const ready=h.database==='ready';$('systemstate').textContent='Website online';document.querySelector('.state-dot').classList.add('ok');$('db-pill').textContent='DB: '+h.database;$('db-pill').className='pill '+(ready?'ok':'');$('stat-db').textContent=ready?'Connected':h.database;$('setup-db').textContent=ready?'Ready':h.database;$('setup-auth').textContent=h.adminConfigured?'Configured':'Missing';}catch(e){$('systemstate').textContent='Check service';$('db-pill').textContent='Unavailable';}}
// Bind buttons before optional map initialization. Failed tiles must never disable controls.
function initializeDashboard(){
 const click=(id,handler)=>{const element=$(id);if(element)element.addEventListener('click',handler);};
 click('go-imagery',()=>tab('imagery'));click('go-setup',()=>tab('setup'));
 click('map-clear',clearMap);click('notice-close',()=>document.querySelector('.notice')?.remove());
 click('search-scenes',searchScenes);
 click('copy-command',()=>navigator.clipboard.writeText(buildCommand()).then(()=>toast('Analysis inputs copied for GitHub Actions')).catch(()=>toast('Clipboard unavailable. Copy the inputs shown on the page.')));
 click('save-key',()=>{state.key=$('admin-key').value;toast('Key used for requests in this browser tab; not persisted');void getDetections();void getJobs();});
 click('load-detections',getDetections);click('upload-geojson',uploadGeoJSON);
 click('use-job-key',useAnalysisKey);click('queue-analysis',queueAnalysis);click('refresh-jobs',getJobs);
 document.querySelectorAll('.copy-inline').forEach(button=>button.addEventListener('click',()=>navigator.clipboard.writeText(button.dataset.copy).then(()=>toast('Copied')).catch(()=>toast('Clipboard unavailable'))));
 ['bbox','before','after'].forEach(id=>$(id)?.addEventListener('input',buildCommand));
 try{buildCommand();}catch(error){console.warn('RSCDS inputs unavailable',error);}
 try{initializeMap();}catch(error){
  const map=$('map');if(map)map.textContent='Interactive map unavailable. Enter bounding-box coordinates in Satellite imagery.';const status=$('map-status');if(status)status.textContent='Map failed to initialize, but the imagery search and queue remain available.';
  console.warn('Map initialization failed; navigation and controls remain available.',error);
 }
 void health();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeDashboard,{once:true});
else initializeDashboard();

// Poll only while the operator is looking at the authenticated analysis screen.
// Never persist keys or coordinates in URLs, localStorage or GitHub workflow inputs.
setInterval(()=>{
 if(state.key&&document.visibilityState==='visible'&&document.getElementById('tab-imagery')?.classList.contains('active'))
  void getJobs();
},60000);
window.addEventListener('rscds:toast',e=>toast(e.detail));
