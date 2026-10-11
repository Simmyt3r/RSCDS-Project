import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/navigation.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function mockClassList(){
 const state=new Set();
 return {toggle(value,on){if(on)state.add(value);else state.delete(value);},contains(value){return state.has(value);}};
}
function node(attrs={}){
 const attributes={...attrs};
 const listeners={};
 return {dataset:{},hidden:false,classList:mockClassList(),textContent:'',focused:false,
   addEventListener(type,handler){listeners[type]=handler;},
   fire(type,event={}){listeners[type]?.(event);},
   focus(){this.focused=true;},
   setAttribute(name,value){attributes[name]=value;},
   getAttribute(name){return attributes[name]??null;},
   removeAttribute(name){delete attributes[name];},
   ...attrs};
}
function createEnvironment(initialHash=''){
 const pages=['overview','imagery','detections','review','setup'];
 const links=pages.map(p=>Object.assign(node(),{dataset:{tab:p}}));
 const panes=pages.map(p=>Object.assign(node(),{id:'tab-'+p}));
 const sidebar=node(),opener=node(),closer=node(),backdrop=node(),crumb=node(),body=node();
 const nav=node({querySelectorAll:()=>links,contains:item=>links.includes(item)});
 const ids={'app-sidebar':sidebar,'primary-navigation':nav,'mobile-nav-toggle':opener,
  'mobile-nav-close':closer,'mobile-nav-backdrop':backdrop,crumb};
 const docListeners={},winListeners={};
 const document={readyState:'complete',body,getElementById:id=>ids[id],querySelectorAll:()=>panes,
  addEventListener:(type,cb)=>docListeners[type]=cb};
 const window={location:{hash:initialHash},history:{pushState:(_s,_title,url)=>{window.location.hash=url;}},
  addEventListener:(type,cb)=>winListeners[type]=cb,dispatchEvent:()=>{},
  matchMedia:()=>({matches:true})};
 vm.runInNewContext(source,{document,window,Event:class{},console});
 return {pages,links,panes,sidebar,opener,closer,backdrop,crumb,nav,document,window,docListeners,winListeners};
}
test('sidebar destinations are real accessible anchors',()=>{
 for(const target of ['overview','imagery','detections','review','setup']){
  assert.match(html,new RegExp('data-tab="'+target+'" href="#'+target+'"'));
 }
 assert.match(html,/src="\/navigation.js"/);
 assert.ok(html.indexOf('navigation.js')<html.indexOf('app.js'));
});
test('navigation works independent of map initialization',()=>{
 const env=createEnvironment();
 const target=env.links[1];
 let prevented=false;
 env.nav.fire('click',{target:{closest:()=>target},preventDefault:()=>prevented=true});
 assert.equal(prevented,true);
 assert.equal(env.window.location.hash,'#imagery');
 assert.equal(target.getAttribute('aria-current'),'page');
 assert.equal(env.panes[1].classList.contains('active'),true);
 assert.equal(env.panes[0].classList.contains('active'),false);
 assert.equal(env.crumb.textContent,'Satellite imagery');
});
test('menu open, close and Escape work for mobile',()=>{
 const env=createEnvironment();
 env.opener.fire('click');
 assert.equal(env.sidebar.classList.contains('is-open'),true);
 assert.equal(env.opener.getAttribute('aria-expanded'),'true');
 assert.equal(env.backdrop.hidden,false);
 env.docListeners.keydown({key:'Escape'});
 assert.equal(env.sidebar.classList.contains('is-open'),false);
 assert.equal(env.backdrop.hidden,true);
 assert.equal(env.opener.getAttribute('aria-expanded'),'false');
});
test('deep links and navigation history keep section selected',()=>{
 const env=createEnvironment('#review');
 assert.equal(env.panes[3].classList.contains('active'),true);
 env.window.location.hash='#detections';
 env.winListeners.popstate();
 assert.equal(env.panes[2].classList.contains('active'),true);
 assert.equal(env.panes[3].getAttribute('aria-hidden'),'true');
});
test('map initialization occurs only after independent control binding',()=>{
 assert.match(app,/function initializeDashboard\(/);
 assert.match(app,/try\{initializeMap\(\);\}catch/);
 assert.ok(app.indexOf("click('go-imagery'")<app.indexOf('try{initializeMap();}catch'));
 assert.doesNotMatch(app,/querySelectorAll\('\[data-tab\]'\)\.forEach\(b=>b\.onclick/);
});
