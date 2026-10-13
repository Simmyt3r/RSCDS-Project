import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../api/health.js',import.meta.url),'utf8');
test('health separates database mismatch, catalog column absence and permissions',()=>{
 assert.match(src,/current_database\(\)='defaultdb' AS uses_expected_database/);
 assert.match(src,/pg_catalog\.pg_attribute/);
 assert.match(src,/attnum>0 AND NOT attisdropped/);
 assert.match(src,/provenanceColumnExists:Boolean\(row\?\.has_evidence_catalog\)/);
 assert.match(src,/sceneProvenance:Boolean\(row\?\.has_evidence_link\)/);
 assert.match(src,/database target mismatch/);
 assert.match(src,/database permissions required/);
 assert.match(src,/migration required/);
 assert.doesNotMatch(src,/databaseUrl:|hostname:|password:/);
});
