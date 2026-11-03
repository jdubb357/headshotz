import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RateLimiter} from '../server/rate-limit.mjs';
test('rate limits isolate accounts and action categories and expire predictably',()=>{
 let now=1000;const limits=new RateLimiter({now:()=>now});
 limits.check('a:trade',2);limits.check('a:trade',2);assert.throws(()=>limits.check('a:trade',2),/Too many/);
 limits.check('b:trade',2);limits.check('a:move',2);now+=60001;assert.doesNotThrow(()=>limits.check('a:trade',2));
});
test('untrusted rate-limit key growth is bounded without evicting active limits',()=>{
 let now=1000;const limits=new RateLimiter({now:()=>now,maxKeys:2});limits.check('a',1);limits.check('b',1);
 assert.throws(()=>limits.check('c',1),/Service busy/);assert.throws(()=>limits.check('a',1),/Too many/);
 now+=60001;limits.check('c',1);assert.equal(limits.windows.size,1);
});
