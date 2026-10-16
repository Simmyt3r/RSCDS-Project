/* Administrator-only migration panel; credentials never persisted. */
(function(){
 const $=id=>document.getElementById(id);
 let pending=null,busy=false;
 function notice(value,err=false){const el=$('migration-feedback');el.textContent=value;el.dataset.status=err?'error':'info';}
 function lock(){pending=null;$('migration-apply').disabled=true;}
 async function request(method,body){
  const key=$('migration-key')?.value.trim();
  if(!key)throw Error('Enter your administrator key.');
  const response=await fetch('/api/migrations',{method,cache:'no-store',headers:{
   Authorization:'Bearer '+key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json().catch(()=>({error:'Unexpected response'}));
  if(!response.ok)throw Error(json.error||'Migration request failed.');
  return json;
 }
 async function refresh(){
  if(busy)return;busy=true;lock();$('migration-check').disabled=true;
  notice('Inspecting approved migrations…');
  try{
   const data=await request('GET');
   $('migration-target').textContent='Connected database: '+data.database+
    ' · schema: rscds. Confirm this is the intended service before applying.';
   const list=$('migration-versions');list.replaceChildren();
   for(const m of data.migrations){
    const line=document.createElement('div');line.className='migration-line';
    const title=document.createElement('strong');title.textContent=m.id+' · '+m.title;
    const status=document.createElement('span');status.textContent=m.status;line.append(title,status);list.append(line);
   }
   if(data.migrations.some(m=>m.status==='checksum_mismatch'))throw Error('Recorded migration checksum differs from this release. Do not proceed.');
   pending=data.pending||[];
   $('migration-apply').disabled=!pending.length||!$('migration-consent').checked;
   notice(pending.length?'Approved pending updates: '+pending.join(', '):'All recorded migrations are current.');
  }catch(e){lock();notice(e.message,true);$('migration-target').textContent='Database target not verified.';}
  finally{busy=false;$('migration-check').disabled=false;}
 }
 async function apply(){
  if(busy||!pending?.length||!$('migration-consent').checked)return;
  busy=true;const expected=pending.slice();lock();$('migration-check').disabled=true;
  notice('Applying fixed, versioned SQL transaction. Please wait.');
  try{
   const result=await request('POST',{action:'apply',confirmation:'APPLY_RSCDS_MIGRATIONS',expectedPending:expected});
   $('migration-consent').checked=false;
   notice('Applied '+result.applied.length+' approved migration(s). Confirm the health check is ready.');
  }catch(e){notice(e.message,true);}
  finally{busy=false;$('migration-check').disabled=false;setTimeout(()=>void refresh(),0);}
 }
 function start(){
  $('migration-check')?.addEventListener('click',()=>void refresh());
  $('migration-apply')?.addEventListener('click',()=>void apply());
  $('migration-consent')?.addEventListener('change',()=>{
   $('migration-apply').disabled=!$('migration-consent').checked||!pending?.length||busy;
  });
  $('migration-key')?.addEventListener('input',()=>{lock();$('migration-consent').checked=false;});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
