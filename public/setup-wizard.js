/* Client-only setup assistance: never store database strings or administrator keys. */
(function(){
  const $=id=>document.getElementById(id);
  const PROGRESS_KEY='rscds.setup.checklist.v2';
  const ids=['git','database','secrets','deployment','analysis'];
  let checks={};
  try { const raw=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}'); if(raw&&typeof raw==='object') checks=raw; } catch { checks={}; }
  const showProgress=()=>{$('setup-progress').textContent=ids.filter(id=>checks[id]===true).length+'/'+ids.length;};
  const status=(text,ok)=>{const el=$('deployment-checks');el.textContent=text;el.className='deployment-checks '+(ok?'ready':'error');};
  const copy=async(value)=>{try{await navigator.clipboard.writeText(value);window.dispatchEvent(new CustomEvent('rscds:toast',{detail:'Copied to clipboard'}));}catch{window.dispatchEvent(new CustomEvent('rscds:toast',{detail:'Clipboard unavailable. Use the text shown instead.'}));}};
  window.addEventListener('load',()=>{
    document.querySelectorAll('[data-setup-step]').forEach(box=>{
      const id=box.dataset.setupStep;
      box.checked=checks[id]===true;
      box.addEventListener('change',()=>{checks[id]=box.checked;try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(checks));}catch{}showProgress();});
    });
    showProgress();
    $('copy-schema').addEventListener('click',async()=>{
      try { const res=await fetch('/schema.sql',{cache:'no-store'});if(!res.ok)throw Error('SQL script unavailable');await copy(await res.text()); }
      catch(e){status(e.message,false);}
    });
    $('generate-admin-secret').addEventListener('click',()=>{
      if(!window.crypto?.getRandomValues)return status('Secure random generator unavailable. Open this site using HTTPS.',false);
      const bytes=new Uint8Array(48);window.crypto.getRandomValues(bytes);
      $('new-admin-secret').value=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
      window.dispatchEvent(new CustomEvent('rscds:toast',{detail:'Generated a 384-bit random administrator key. Copy it securely.'}));
    });
    $('copy-admin-secret').addEventListener('click',()=>{
      if(!$('new-admin-secret').value)return status('Generate a key first.',false);
      void copy($('new-admin-secret').value);
    });
    $('check-health').addEventListener('click',async()=>{
      status('Running website, administrator and database readiness checks...',true);
      try{
        const response=await fetch('/api/health',{cache:'no-store'});
        if(!response.ok)throw Error('Health endpoint returned HTTP '+response.status);
        const result=await response.json();
        const ready=result.database==='ready'&&result.adminConfigured===true&&result.workerConfigured===true;
        status(`Website: online · Database: ${result.database||'unknown'} · Admin configured: ${result.adminConfigured?'yes':'no'} · Worker configured: ${result.workerConfigured?'yes':'no'}. ${ready?'Ready for authenticated review.':'Complete the pending settings in Vercel, then redeploy.'}`,ready);
      }catch(e){status('Website diagnostic failed: '+e.message,false);}
    });
  });
})();
