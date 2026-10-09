import test from 'node:test';import assert from 'node:assert/strict';
import {parseBBox,validPeriod,validateFeature,validateGeometry} from '../api/_validators.js';
test('bbox valid',()=>assert.deepEqual(parseBBox('8,7,8.05,7.05'),[8,7,8.05,7.05]));
test('bbox oversized rejected',()=>assert.throws(()=>parseBBox('8,7,10,9')));
test('dates valid',()=>assert.equal(validPeriod('2025-01-01/2025-02-01'),'2025-01-01/2025-02-01'));
test('invalid date reversed',()=>assert.throws(()=>validPeriod('2026-01-01/2025-01-01')));
test('unverified only imports',()=>assert.throws(()=>validateFeature({type:'Feature',geometry:{type:'Polygon',coordinates:[]},properties:{area_m2:2000,score:.5,review_status:'verified',source:'Sentinel-2'}})));

test('valid polygon accepted',()=>assert.equal(validateGeometry({type:'Polygon',coordinates:[[[8,7],[8.1,7],[8.1,7.1],[8,7]]]}),true));
test('unclosed polygon rejected',()=>assert.throws(()=>validateGeometry({type:'Polygon',coordinates:[[[8,7],[8.1,7],[8.1,7.1],[8,7.1]]]})));
test('out-of-range coordinates rejected',()=>assert.throws(()=>validateGeometry({type:'Polygon',coordinates:[[[181,7],[8.1,7],[8.1,7.1],[181,7]]]})));
test('empty polygon rejected',()=>assert.throws(()=>validateGeometry({type:'Polygon',coordinates:[]})));
