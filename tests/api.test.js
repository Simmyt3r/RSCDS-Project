import test from 'node:test';import assert from 'node:assert/strict';
import {parseBBox,validPeriod,validateFeature} from '../api/_validators.js';
test('bbox valid',()=>assert.deepEqual(parseBBox('8,7,8.05,7.05'),[8,7,8.05,7.05]));
test('bbox oversized rejected',()=>assert.throws(()=>parseBBox('8,7,10,9')));
test('dates valid',()=>assert.equal(validPeriod('2025-01-01/2025-02-01'),'2025-01-01/2025-02-01'));
test('invalid date reversed',()=>assert.throws(()=>validPeriod('2026-01-01/2025-01-01')));
test('unverified only imports',()=>assert.throws(()=>validateFeature({type:'Feature',geometry:{type:'Polygon',coordinates:[]},properties:{area_m2:2000,score:.5,review_status:'verified',source:'Sentinel-2'}})));
