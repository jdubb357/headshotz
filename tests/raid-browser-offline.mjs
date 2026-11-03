import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore();let {server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port,previousUrl=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+port;const h=await browserHarness();
try{
 const p=await h.page();await p.command('Network.enable');await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='offline_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long offline test password';document.getElementById('register').click()");await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("caches.open('headshotz-v61').then(c=>c.put('/api/profile',new Response(JSON.stringify({username:'stale_private_account'}),{headers:{'content-type':'application/json'}})))");
 await p.evaluate("navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(()=>true)");await p.wait('!!navigator.serviceWorker.controller');
 await p.wait("caches.keys().then(keys=>!keys.includes('headshotz-v61'))");
 assert.equal(await p.evaluate("fetch('/health/ready').then(r=>r.status)"),200);
 const before=await p.evaluate("fetch('/api/profile').then(r=>r.json())");assert.match(before.username,/offline_/);
 const cached=await p.evaluate("caches.keys().then(keys=>Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys())))).then(lists=>lists.flat().some(r=>new URL(r.url).pathname.startsWith('/api/')))");assert.equal(cached,false,'private API responses are never cached');
 server.close();await once(server,'close');
 const offline=await p.evaluate("fetch('/api/profile').then(async r=>({status:r.status,data:await r.json()}))");assert.equal(offline.status,503);assert.match(offline.data.error,/offline/);assert.equal(offline.data.username,undefined);assert.equal(await p.evaluate("fetch('/health/ready').then(r=>r.status)"),503,'health must not fall back to a cached ready response');
 ({server}=createRaidServer(store));server.listen(port,'127.0.0.1');await once(server,'listening');
 await p.wait("fetch('/api/profile').then(r=>r.json()).then(p=>p.username.startsWith('offline_'))");
 assert.deepEqual(p.errors,[]);console.log(JSON.stringify({legacyPrivateCachePurged:true,privateApiNotCached:true,healthNeverStale:true,offlineJsonError:true,onlineAccountRecovered:true,browserErrors:[]}));
}finally{await h.close();if(server.listening){server.close();await once(server,'close')}store.close();if(previousUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previousUrl}
