/* Independent accessible navigation: must work even if map or API initialization fails. */
(function(){
  'use strict';
  const pages=new Set(['overview','imagery','detections','review','setup']);
  const names={overview:'Overview',imagery:'Satellite imagery',detections:'Candidate detections',review:'Review workspace',setup:'Deploy & configure'};
  function boot(){
    const sidebar=document.getElementById('app-sidebar');
    const nav=document.getElementById('primary-navigation');
    const opener=document.getElementById('mobile-nav-toggle');
    const closer=document.getElementById('mobile-nav-close');
    const backdrop=document.getElementById('mobile-nav-backdrop');
    const crumb=document.getElementById('crumb');
    if(!sidebar||!nav)return;
    const links=Array.from(nav.querySelectorAll('a.nav[data-tab]'));
    const panes=Array.from(document.querySelectorAll('.tabpane'));
    let lastTab='overview';
    let opened=false;
    function setOpen(value,{restoreFocus=false}={}){
      opened=Boolean(value);
      sidebar.classList.toggle('is-open',opened);
      if(backdrop)backdrop.hidden=!opened;
      if(opener)opener.setAttribute('aria-expanded',String(opened));
      document.body.classList.toggle('nav-open',opened);
      if(opened&&closer)closer.focus();
      else if(!opened&&restoreFocus&&opener)opener.focus();
    }
    function selectedFromLocation(){
      const candidate=decodeURIComponent((window.location.hash||'').replace(/^#(?:tab-)?/,''));
      return pages.has(candidate)?candidate:null;
    }
    function go(name,options={}){
      if(!pages.has(name))return false;
      lastTab=name;
      links.forEach(link=>{
        const current=link.dataset.tab===name;
        link.classList.toggle('active',current);
        if(current)link.setAttribute('aria-current','page');
        else link.removeAttribute('aria-current');
      });
      panes.forEach(pane=>{
        const current=pane.id==='tab-'+name;
        pane.classList.toggle('active',current);
        pane.setAttribute('aria-hidden',String(!current));
      });
      if(crumb)crumb.textContent=names[name];
      if(options.updateHash!==false && window.location.hash!=='#'+name){
        window.history.pushState({rscdsTab:name},'', '#'+name);
      }
      setOpen(false);
      if(name==='overview')window.dispatchEvent(new Event('rscds:overview-visible'));
      return true;
    }
    nav.addEventListener('click',event=>{
      const link=event.target.closest('a.nav[data-tab]');
      if(!link||!nav.contains(link))return;
      event.preventDefault();
      go(link.dataset.tab);
    });
    opener?.addEventListener('click',()=>setOpen(!opened,{restoreFocus:opened}));
    closer?.addEventListener('click',()=>setOpen(false,{restoreFocus:true}));
    backdrop?.addEventListener('click',()=>setOpen(false,{restoreFocus:true}));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened)setOpen(false,{restoreFocus:true});});
    window.addEventListener('popstate',()=>go(selectedFromLocation()||'overview',{updateHash:false}));
    window.addEventListener('hashchange',()=>go(selectedFromLocation()||'overview',{updateHash:false}));
    window.addEventListener('resize',()=>{
      if(opened&&!window.matchMedia('(max-width:700px)').matches)setOpen(false);
    });
    window.RSCDSNavigation={go,openMenu:()=>setOpen(true),closeMenu:()=>setOpen(false),current:()=>lastTab};
    go(selectedFromLocation()||'overview',{updateHash:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
