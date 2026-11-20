// Static-Pages offline raid persistence: IndexedDB must keep the guest profile,
// stash results and unresolved raid checkpoints alive across a full page reload.
// The repo is served as plain files with no Node raid `/api`; all authority comes
// from the in-page RaidService, so persistence has nothing to do with the server.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
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
const key=(p,code,down=true)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code});

async function deploy(page){
  await page.wait("!!document.querySelector('#stash input[data-equip]')");
  await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait("!!window.__hszOfflineRaid.snapshot()");
  return await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {deploymentId:s.deploymentId,x:s.x,z:s.z,hp:s.hp}})()");
}

async function reloadBoot(page){
  await page.command('Page.reload',{ignoreCache:true});
  await page.wait(BOOTED);
  await page.command('Page.bringToFront');
}

const {server,url}=await staticServer();
const previous=process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL=url;
const harness=await browserHarness();
try{
  // ---- 1. Settled profile, stash and results survive a reload. ----
  const page=await harness.page('/raid-online.html?offline=1&guest=persist_alpha');
  await page.wait(BOOTED);
  assert.deepEqual(await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),[],'persistence mode makes no Node API calls');
  assert.equal(await page.evaluate("window.__hszOfflineRaid.persistent===true"),true,'IndexedDB persistence is active');
  const start=await deploy(page);
  assert.ok(start.deploymentId);

  // Move through the shipped binding so the authoritative operator changes.
  await page.command('Page.bringToFront');
  await page.evaluate("document.getElementById('view').focus()");
  await key(page,'KeyW');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot()?.self;return !!s&&Math.hypot(s.x-(${start.x}),s.z-(${start.z}))>0.5})()`);
  await key(page,'KeyW',false);
  await sleep(400);

  // Extract through a call beacon so the settlement changes credits, XP and the stash.
  const exit=await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(),p=rt.raids.byAccount.get(rt.account),r=rt.raids.raids.get(p.raidId);
    const e=r.exits.find(e=>e.kind==='call')||r.exits[0];
    p.x=e.x;p.y=e.y||0;p.z=e.z;const now=Date.now()/1000;e.openAt=now-2;e.closeAt=now+90;
    return {id:e.id,x:e.x,z:e.z};
  })()`);
  await key(page,'ArrowRight');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();const c=document.querySelector(${JSON.stringify(`[data-exit="${exit.id}"]`)});return !!s&&!!c&&c.dataset.phase==='open'})()`);
  await key(page,'ArrowRight',false);
  await sleep(250);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page,'KeyE');await key(page,'KeyE',false);
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s&&!!s.self.board&&s.self.board.exit===${JSON.stringify(exit.id)}})()`);
  await page.wait("(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s&&!!s.self.result&&s.self.result.outcome==='extract'})()");
  const beforeReload=await page.evaluate("(async()=>{const p=await window.__hszOfflineRaid.api('profile');return {username:p.username,credits:p.credits,xp:p.xp,items:p.items.map(it=>it.id),activeDeployment:p.activeDeployment}})()");
  assert.ok(beforeReload.credits>=270,'extraction awarded credits');
  assert.ok(beforeReload.items.length>=1,'the returned gear is in the settled stash');

  // IndexedDB contains a canonical snapshot with the settled account and no
  // active deployment left unresolved.
  const stored=await page.evaluate(`(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('headshotz-raid-offline');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const state=await new Promise((resolve,reject)=>{const tx=db.transaction('raid-state-v1','readonly'),q=tx.objectStore('raid-state-v1').get('store');q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)});
    db.close();
    return state?{accounts:state.accounts.length,checkpoints:state.checkpoints.length,deployments:state.deployments.length}:null;
  })()`);
  assert.ok(stored&&stored.accounts>=1,'the guest account is written to IndexedDB');
  assert.ok(stored.deployments>=1,'the settled deployment record is written to IndexedDB');

  // Reload into the same guest. A fresh in-memory store would mint new starter
  // item ids and reset credits, so the stable ids prove the durable restore.
  await sleep(400);
  await reloadBoot(page);
  const afterReload=await page.evaluate("(async()=>{const p=await window.__hszOfflineRaid.api('profile');return {username:p.username,credits:p.credits,xp:p.xp,items:p.items.map(it=>it.id),activeDeployment:p.activeDeployment}})()");
  assert.equal(afterReload.username,beforeReload.username);
  assert.equal(afterReload.credits,beforeReload.credits,'settled credits survive the reload');
  assert.equal(afterReload.xp,beforeReload.xp,'settled XP survives the reload');
  assert.deepEqual(afterReload.items,beforeReload.items,'the settled stash survives the reload by item identity');
  assert.equal(afterReload.activeDeployment,null,'the settled deployment is still cleared');
  assert.deepEqual(page.errors,[]);

  // ---- 2. An unfinished raid checkpoint survives a reload and can resume. ----
  await page.command('Page.navigate',{url:url+'/raid-online.html?offline=1&guest=persist_beta'});
  await page.wait(BOOTED);
  const second=await deploy(page);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page,'KeyW');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot()?.self;return !!s&&Math.hypot(s.x-(${second.x}),s.z-(${second.z}))>0.5})()`);
  await key(page,'KeyW',false);
  await sleep(400);
  const expected=await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z,hp:s.hp,deploymentId:s.deploymentId}})()");
  await sleep(400);

  await reloadBoot(page);
  assert.equal(await page.evaluate("document.getElementById('resume').hidden"),false,'the static client offers Resume for the restored deployment');
  assert.equal(await page.evaluate("document.getElementById('deploy').disabled"),true,'a fresh deployment is blocked while one is restored');
  const resumedProfile=await page.evaluate("(async()=>{const p=await window.__hszOfflineRaid.api('profile');return {activeDeployment:p.activeDeployment&&p.activeDeployment.id,items:p.items.length}})()");
  assert.equal(resumedProfile.activeDeployment,expected.deploymentId,'the active deployment id survives the reload');
  await page.evaluate("document.getElementById('resume').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait("!!window.__hszOfflineRaid.snapshot()");
  const resumed=await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {deploymentId:s.deploymentId,x:s.x,z:s.z,hp:s.hp}})()");
  assert.equal(resumed.deploymentId,expected.deploymentId,'resuming restores the same authoritative deployment');
  assert.ok(Math.hypot(resumed.x-expected.x,resumed.z-expected.z)<0.01,'the operator resumes at the persistent position');
  assert.equal(resumed.hp,expected.hp,'the operator resumes at the persistent health');
  assert.deepEqual(page.errors,[]);

  // ---- 3. When IndexedDB is unavailable, localStorage keeps the checkpoint. ----
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(RAID_LOCAL_KEY)})`);
  await page.command('Page.addScriptToEvaluateOnNewDocument',{
    source:"Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});",
  });
  await page.command('Page.navigate',{url:url+'/raid-online.html?offline=1&guest=persist_local'});
  await page.wait(BOOTED);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.storageMode==='localStorage'"),true,'a missing IndexedDB selects the localStorage backend');
  const localStart=await deploy(page);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page,'KeyW');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot()?.self;return !!s&&Math.hypot(s.x-(${localStart.x}),s.z-(${localStart.z}))>0.5})()`);
  await key(page,'KeyW',false);
  await sleep(400);
  const localExpected=await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z,deploymentId:s.deploymentId}})()");
  const localStored=await page.evaluate(`(()=>{try{const s=JSON.parse(localStorage.getItem(${JSON.stringify(RAID_LOCAL_KEY)})||'null');return s?{accounts:s.accounts.length,checkpoints:s.checkpoints.length}:null}catch{return null}})()`);
  assert.ok(localStored&&localStored.accounts>=1,'localStorage holds the fallback snapshot');
  assert.ok(localStored.checkpoints>=1,'localStorage holds the active raid checkpoint');

  await sleep(300);
  await reloadBoot(page);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.storageMode==='localStorage'"),true,'the fallback remains active after reload');
  const localProfile=await page.evaluate("(async()=>{const p=await window.__hszOfflineRaid.api('profile');return p.activeDeployment&&p.activeDeployment.id})()");
  assert.equal(localProfile,localExpected.deploymentId,'the fallback restore keeps the active deployment');
  await page.evaluate("document.getElementById('resume').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait("!!window.__hszOfflineRaid.snapshot()");
  const localResumed=await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {deploymentId:s.deploymentId,x:s.x,z:s.z}})()");
  assert.equal(localResumed.deploymentId,localExpected.deploymentId);
  assert.ok(Math.hypot(localResumed.x-localExpected.x,localResumed.z-localExpected.z)<0.01,'the fallback checkpoint resumes at the last position');
  assert.deepEqual(page.errors,[]);

  console.log(JSON.stringify({
    persistence:true,
    profileReload:{credits:afterReload.credits,xp:afterReload.xp,items:afterReload.items.length},
    checkpointReload:{deploymentId:resumed.deploymentId,x:resumed.x,z:resumed.z},
    localStorageFallback:{accounts:localStored.accounts,checkpoints:localStored.checkpoints,deploymentId:localResumed.deploymentId},
    noApiTraffic:true,
    browserErrors:[],
  }));
}finally{
  await harness.close();
  server.close();
  if(previous===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previous;
}
