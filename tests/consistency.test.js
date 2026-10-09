import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fingerprint} from '../api/_fingerprint.js';
const root=new URL('../',import.meta.url);
test('browser setup SQL matches canonical migration',()=>{
 const sql=fs.readFileSync(new URL('scripts/schema.sql',root),'utf8');
 const browser=fs.readFileSync(new URL('public/schema.sql',root),'utf8');
 assert.equal(sql,browser);
});
test('feature fingerprint stable and provenance-sensitive',()=>{
 const feature={geometry:{type:'Polygon',coordinates:[[[8,7],[8.1,7],[8.1,7.1],[8,7]]]},properties:{source:'Sentinel-2',scene_before:'one',scene_after:'two'}};
 assert.equal(fingerprint(feature),fingerprint(feature));
 assert.notEqual(fingerprint(feature),fingerprint({...feature,properties:{...feature.properties,scene_after:'three'}}));
});
