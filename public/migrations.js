/* One-time initial RSCDS database setup, with no account or API key. */
(function(){
 const $=id=>document.getElementById(id);
 let pending=null,busy=false;
 function notice(value,err=false){
  const el=$('migration-feedback');
  if(el){el.textContent=value;el.dataset.status=err?'error':'info';}
 }
 function lock(){pending=null;$('migration-apply').disabled=true;}
 async function request(method,body){
  const response=await fetch('/api/migrations',{method,cache:'no-store',
   headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json().catch(()=>({error:'Unexpected response'}));
  if(!response.ok)throw Error(json.error||'Initial migration request failed.');
  return json;
 }
 async function refresh(){
  if(busy)return;
  busy=true;lock();$('migration-check').disabled=true;
  notice('Checking approved initial database migrations…');
  try{
   const data=await request('GET');
   $('migration-target').textContent='Database connection: '+data.database+
    ' · schema: rscds. Verify DATABASE_URL in Vercel points to your intended Aiven service.';
   const list=$('migration-versions');list.replaceChildren();
   for(const m of data.migrations){
    const row=document.createElement('div');row.className='migration-line';
    const name=document.createElement('strong');name.textContent=m.id+' · '+m.title;
    const label=document.createElement('span');label.textContent=m.status;
    row.append(name,label);list.append(row);
   }
   pending=data.bootstrapAvailable?data.pending:null;
   $('migration-apply').disabled=!pending?.length||!$('migration-consent').checked;
   notice(data.bootstrapClosed?
     'Initial setup complete. Public migration writes are now permanently closed for these versions.':
     data.bootstrapAvailable?'Ready to apply approved initial versions: '+pending.join(', '):
     'These migrations require a controlled operator-led upgrade.',
     !data.bootstrapClosed&&!data.bootstrapAvailable);
  }catch(error){
   lock();notice(error.message,true);
   $('migration-target').textContent='Database target not verified.';
  }finally{busy=false;$('migration-check').disabled=false;}
 }
 async function apply(){
  if(busy||!pending?.length||!$('migration-consent').checked)return;
  busy=true;const snapshot=pending.slice();lock();
  $('migration-check').disabled=true;
  notice('Applying only approved initial database migrations…');
  try{
   const result=await request('POST',{
    action:'apply',confirmation:'APPLY_RSCDS_MIGRATIONS',expectedPending:snapshot
   });
   $('migration-consent').checked=false;
   notice('Applied '+result.applied.length+' initial migration versions. Checking status…');
  }catch(error){notice(error.message,true);}
  finally{busy=false;$('migration-check').disabled=false;void refresh();}
 }
 function start(){
  $('migration-check')?.addEventListener('click',()=>void refresh());
  $('migration-apply')?.addEventListener('click',()=>void apply());
  $('migration-consent')?.addEventListener('change',()=>{
   $('migration-apply').disabled=!$('migration-consent').checked||!pending?.length||busy;
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
