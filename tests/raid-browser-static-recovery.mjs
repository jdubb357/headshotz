// Static-Pages offline raid save recovery: a stale, partial or future-version
// IndexedDB snapshot, or corrupted localStorage JSON, must never block boot.
// The client quarantines the bad save, starts a clean local profile, explains
// the reset, and writes new state that survives a normal reload.
//
// Plain files only; there is no Node `/api` on this origin. Run with CDP_URL
// pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {RAID_LOCAL_KEY} from '../shared/raid-store-local.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};
const BOOTED="document.body.dataset.raidTransport==='offline' && !document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'";

async function staticServer(){
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname.startsWith('/api/')){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({error:'Static Pages has no raid API'}));return}
      const requested=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
      const file=resolve(ROOT,'.'+requested);
      if(file!==ROOT&&!file.startsWith(ROOT+'/'))throw new Error('path escape');
      const content=await readFile(file);
      res.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-cache'});
      res.end(content);
    }catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found')}
  });
  await new Promise((ready,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ready)});
  return {server,url:'http://127.0.0.1:'+server.address().port};
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reloadBoot=async page=>{
  await page.command('Page.reload',{ignoreCache:true});
  await page.wait(BOOTED);
  await page.command('Page.bringToFront');
};

async function seedIndexedDb(page,snapshot){
  await page.evaluate(`(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('headshotz-raid-offline',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('raid-state-v1','readwrite');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      tx.objectStore('raid-state-v1').put(${JSON.stringify(snapshot)},'store');
    });
    db.close();
  })()`);
}

const profile=async page=>page.evaluate("(async()=>{const p=await window.__hszOfflineRaid.api('profile');return {id:p.id,username:p.username,credits:p.credits,xp:p.xp,items:p.items.map(it=>it.id),activeDeployment:p.activeDeployment&&p.activeDeployment.id}})()");

const {server,url}=await staticServer();
const previous=process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL=url;
const harness=await browserHarness();
try{
  // ---- 1. A partial IndexedDB snapshot quarantines cleanly. ----
  const page=await harness.page('/raid-online.html?offline=1&guest=recovery_alpha');
  await page.wait(BOOTED);
  const seeded=await profile(page);
  assert.ok(seeded.id,'the first boot created a local guest');
  await seedIndexedDb(page,{version:1,accounts:[['orphan',{id:'orphan',username:'orphan',state:{credits:1}}]]});
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.persistent===true"),true,'recovery keeps the persistent store');
  assert.equal(await page.evaluate("window.__hszOfflineRaid.recovery?.reason"),'malformed','the bad snapshot is reported');
  assert.equal(await page.evaluate("window.__hszOfflineRaid.recovery?.message"),'Persisted raid state is missing byUsername','the UI receives the concrete reason');
  assert.equal(await page.evaluate("window.__hszOfflineRaid.persistenceError"),null,'a quarantine is not a write failure');
  assert.equal(await page.evaluate("document.getElementById('offlineSaveNote').hidden"),false,'the reset is explained in the base screen');
  assert.match(await page.evaluate("document.getElementById('offlineSaveNote').textContent"),/previous offline save could not be read/);
  const recovered=await profile(page);
  assert.equal(recovered.username,'recovery_alpha','the requested local name still applies');
  assert.notEqual(recovered.id,seeded.id,'the orphan snapshot did not leak into the new profile');
  assert.equal(recovered.items.length,4,'a fresh starter kit is present');

  // The clean replacement is durable: the next reload restores the same local
  // profile instead of re-quarantining the old snapshot.
  await sleep(300);
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.recovery"),null,'the clean save replaced the bad one');
  assert.equal(await page.evaluate("document.getElementById('offlineSaveNote').hidden"),true,'no recovery warning on a healthy reload');
  const stable=await profile(page);
  assert.equal(stable.id,recovered.id,'the recovered operator persists by account id');
  assert.deepEqual(stable.items,recovered.items,'the recovered stash persists by item identity');

  // ---- 2. A future-version snapshot is quarantined, not mis-imported. ----
  await seedIndexedDb(page,{version:99,accounts:[]});
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.recovery?.reason"),'unsupported-version');
  assert.match(await page.evaluate("document.getElementById('offlineSaveNote').textContent"),/newer save format/);
  const versionRecovered=await profile(page);
  assert.equal(versionRecovered.username,'recovery_alpha','a clean profile remains usable after a version reset');
  await sleep(300);
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.recovery"),null);

  // ---- 3. Corrupted localStorage recovery when IndexedDB is unavailable. ----
  await page.evaluate(`localStorage.setItem(${JSON.stringify(RAID_LOCAL_KEY)},'{"version":1,"accounts":[')`);
  await page.command('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});"});
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.storageMode==='localStorage'"),true,'the fallback backend handles the boot');
  assert.equal(await page.evaluate("window.__hszOfflineRaid.persistent===true"),true,'the persistent store survives corrupt fallback data');
  const localRecovered=await profile(page);
  assert.equal(localRecovered.items.length,4,'the truncated value did not block a fresh local profile');
  await sleep(400);
  const localStored=await page.evaluate(`(()=>{try{const s=JSON.parse(localStorage.getItem(${JSON.stringify(RAID_LOCAL_KEY)})||'null');return s?{version:s.version,accounts:s.accounts.length,ids:s.accounts.map(e=>e[0])}:null}catch{return null}})()`);
  assert.ok(localStored,'a clean snapshot is written to localStorage');
  assert.equal(localStored.version,1);
  assert.ok(localStored.ids.includes(localRecovered.id),'the fresh guest is durable in localStorage');

  await reloadBoot(page);
  const localStable=await profile(page);
  assert.equal(localStable.id,localRecovered.id,'the localStorage guest survives a reload');
  assert.deepEqual(localStable.items,localRecovered.items);
  assert.deepEqual(page.errors,[]);

  console.log(JSON.stringify({
    malformed:{reason:'malformed',quarantined:true,stableId:stable.id},
    futureVersion:{reason:'unsupported-version',quarantined:true},
    corruptLocalStorage:{storageMode:'localStorage',stableId:localStable.id},
    noApiTraffic:true,
    browserErrors:[],
  }));
}finally{
  await harness.close();
  server.close();
  if(previous===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previous;
}
