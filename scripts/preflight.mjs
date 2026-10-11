/** No network calls and no secrets required: safe to run in the Vercel build. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const check=(ok,message)=>{if(!ok)errors.push(message);};
const file=p=>path.join(projectRoot,p);
const read=p=>fs.readFileSync(file(p),'utf8');
let cfg;
try{cfg=JSON.parse(read('vercel.json'));}catch(e){errors.push('Invalid vercel.json: '+e.message);}
if(cfg){
 check(cfg.framework===null,'Framework preset must be Other (framework:null).');
 check(cfg.outputDirectory==='public','Static output directory must be public.');
 check(cfg.buildCommand==='npm run build','Vercel build must run the preflight.');
 check(cfg.functions?.['api/*.js']?.maxDuration<=60,'API maximum duration exceeds Hobby allowance.');
}
for(const name of ['index.html','setup.html','app.js','map-basemap.js','navigation.js','imagery-search.js','setup-wizard.js','styles.css','schema.sql']){
 check(fs.existsSync(file('public/'+name)),'Missing public asset: '+name);
}
const endpoints=['health','scenes','imagery','detections','review','jobs','worker'];
for(const name of endpoints){
 const f='api/'+name+'.js';
 check(fs.existsSync(file(f)),'Missing API endpoint: '+f);
 if(fs.existsSync(file(f)))check(/export default async function handler/.test(read(f)),'Endpoint missing default handler: '+f);
}
if(fs.existsSync(file('public/index.html'))){
 const html=read('public/index.html');
 for(const asset of ['app.js','map-basemap.js','navigation.js','imagery-search.js','setup-wizard.js','styles.css'])check(html.includes('/'+asset),'Homepage does not reference '+asset);
 check(html.includes('id="map"'),'Missing satellite map container.');
}
if(fs.existsSync(file('public/setup.html'))){
 const html=read('public/setup.html');
 check(html.includes('RSCDS_DEPLOY_URL'),'Setup assistant missing GitHub worker variable.');
 check(html.includes('WORKER_API_KEY'),'Setup assistant missing worker secret instructions.');
}
if(fs.existsSync(file('scripts/schema.sql')) && fs.existsSync(file('public/schema.sql'))){
 check(read('scripts/schema.sql')===read('public/schema.sql'),'Public and source SQL migration differ.');
}
if(errors.length){
 console.error('RSCDS Vercel preflight FAILED:');
 errors.forEach(e=>console.error(' - '+e));
 process.exitCode=1;
}else{
 console.log(`RSCDS Vercel preflight PASS: ${endpoints.length} APIs, public assets, migration, Other preset, build configuration.`);
}
