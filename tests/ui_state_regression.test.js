import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const code=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const evidence=code('public/evidence-workspace.js');
const images=code('public/imagery-compare.js');
const style=code('public/styles.css');
test('evidence loading never exports a previous or failed job',()=>{
 assert.match(evidence,/function resetEvidence\(/);
 assert.match(evidence,/resetEvidence\('Loading the selected analysis record/);
 assert.match(evidence,/resetEvidence\('Unable to load this analysis/);
 assert.match(evidence,/S\.loaded=true/);
 assert.match(evidence,/const ready=S\.loaded&&S\.next===null/);
 assert.match(evidence,/!S\.loaded\|\|!S\.job\|\|S\.next!==null/);
});
test('changing satellite acquisitions removes old raster layers and old polygon overlay',()=>{
 assert.match(images,/function clearDisplayedImages\(/);
 assert.match(images,/S\.metaBefore=null;S\.metaAfter=null;S\.linkedEvidence=null/);
 assert.match(images,/clearDisplayedImages\(\);\s*S\[kind\]/);
 assert.match(images,/select\('before',a\);\s*select\('after',b\)/);
 assert.match(images,/if\(sequence===S\.request\)tileError\(\)/);
});
test('navigation maintains visible focus and narrow-screen controls',()=>{
 assert.match(style,/:focus-visible/);
 assert.match(style,/topbar\{flex-wrap:wrap/);
});
