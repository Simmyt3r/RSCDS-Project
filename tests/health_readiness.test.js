import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../api/health.js',import.meta.url),'utf8');
test('health distinguishes actual scene-provenance migration from general DB status',()=>{
 assert.match(src,/sceneProvenance:Boolean\(row\?\.has_evidence_link\)/);
 assert.match(src,/databaseChecks/);
 assert.match(src,/Object\.values\(databaseChecks\)\.every\(Boolean\)/);
 assert.doesNotMatch(src,/databaseUrl:|hostname:|password:/);
});
