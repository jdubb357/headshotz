// Static-Pages playability gate: serve the game as plain files with no Node
// `/api`, DEPLOY from the hub into the in-page offline raid client, and verify
// the whole solo loop: deploy, move, hit a machine, loot a ground pile, and
// extract through the shipped UI while the authoritative RaidService settles.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {settlementGapText,stashUsageText} from '../shared/raid-report.mjs';
import {stashCapacity} from '../shared/raid-catalog.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};

async function staticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(404, {'content-type': 'application/json'});
        res.end(JSON.stringify({error: 'Static Pages has no raid API'}));
        return;
      }
      const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = resolve(ROOT, '.' + requested);
      if (file !== ROOT && !file.startsWith(ROOT + '/')) throw new Error('path escape');
      const content = await readFile(file);
      res.writeHead(200, {'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache'});
      res.end(content);
    } catch {
      res.writeHead(404, {'content-type': 'text/plain'});
      res.end('Not found');
    }
  });
  await new Promise((ready, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ready);
  });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (p, code, down = true) => p.command('Input.dispatchKeyEvent', {
  type: down ? 'keyDown' : 'keyUp',
  code,
  key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
});

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  // 1. The static hub itself routes EXTRACTION RAIDS DEPLOY to the offline
  //    raid client. There is no service meta and no Node API on this origin.
  const page = await harness.page('/');
  await page.wait('!!window.__hsz?.raid');
  await page.evaluate("document.getElementById('raidBtn').click()");
  await page.wait("location.pathname==='/raid-online.html' && new URLSearchParams(location.search).get('offline')==='1'");
  await page.wait('document.body.dataset.raidTransport===\'offline\'');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  await page.wait("!!window.__hszOfflineRaid && window.__hszOfflineRaid.mode==='offline'");
  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'the offline raid client must not call the Node API',
  );

  // 2. Select the starter weapon from the real stash, deploy, and enter play.
  await page.wait("!!document.querySelector('#stash input[data-equip]')");
  await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait('document.body.getAttribute(\'aria-busy\')===\'false\'');
  await page.wait('!!window.__hszOfflineRaid.snapshot()');
  const start = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z,hp:s.hp,deploymentId:s.deploymentId,yaw:s.yaw,weaponId:s.weaponId}})()");
  assert.ok(start.deploymentId, 'deploy returns an authoritative deployment id');
  assert.ok(Number.isFinite(start.x) && Number.isFinite(start.z), 'deploy places the operator');
  assert.ok(start.hp > 0 && start.weaponId, 'the starter weapon is equipped');

  // 3. Movement through the shipped keyboard bindings changes the authoritative
  //    position, not just the local prediction.
  await page.command('Page.bringToFront');
  await page.evaluate("document.getElementById('view').focus()");
  await key(page, 'KeyW');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot()?.self;return !!s && Math.hypot(s.x-(${start.x}), s.z-(${start.z}))>0.5})()`);
  await key(page, 'KeyW', false);
  await sleep(400);
  const moved = await page.evaluate("(()=>{const rt=window.__hszOfflineRaid.runtime();const p=rt.raids.byAccount.get(rt.account);return {x:p.x,z:p.z,yaw:p.yaw}})()");
  assert.ok(Math.hypot(moved.x - start.x, moved.z - start.z) > 0.5, 'the authoritative operator moved');

  // 4. Fire at an authoritative machine placed in front of the operator's
  //    synced facing. World blockers are cleared only for this shot so the
  //    fixture cannot read a different authored wall; the service still
  //    resolves the hit, damage and feedback token itself.
  await page.evaluate(`(()=>{
    window.__hszStaticHit=[];
    const marker=document.getElementById('hitmarker');
    new MutationObserver(()=>{if(marker.classList.contains('show'))window.__hszStaticHit.push({kind:marker.dataset.kind,text:document.getElementById('hitmarkerCaption').textContent,target:window.__hszOfflineRaid.snapshot()?.self?.hit?.target})}).observe(marker,{attributes:true,attributeFilter:['class','data-kind']});
  })()`);
  const fixture = await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(), p=rt.raids.byAccount.get(rt.account), r=rt.raids.raids.get(p.raidId);
    window.__hszStaticGrade={blocks:r.world.blocks,ramps:r.world.ramps,doors:r.world.doors,machines:r.machines.slice(),rivals:r.rivals.slice()};
    r.world.blocks=[];r.world.ramps=[];r.world.doors=[];r.rivals=[];
    const x=p.x+Math.sin(p.yaw||0)*4, z=p.z+Math.cos(p.yaw||0)*4;
    r.machines=[{id:'static-grader-machine',kind:'hunter',x,y:0.35,z,hp:120,maxHp:140,state:'patrol',yaw:0,nextAttack:1e10}];
    return {x,z,hp:120};
  })()`);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page, 'KeyF');
  await sleep(120);
  await key(page, 'KeyF', false);
  await page.wait('window.__hszStaticHit.length>0');
  const hit = await page.evaluate('window.__hszStaticHit[0]');
  assert.ok(['hit', 'headshot', 'kill'].includes(hit.kind), 'an authoritative machine hit shows the hit marker');
  assert.equal(hit.target, 'machine', 'the authoritative hit token names a machine');
  assert.match(hit.text, /machine/i, 'the hit caption names a machine');
  const machineHp = await page.evaluate("(()=>{const rt=window.__hszOfflineRaid.runtime();const r=rt.raids.raids.get(rt.raids.byAccount.get(rt.account).raidId);const m=r.machines.find(m=>m.id==='static-grader-machine');return m?m.hp:null})()");
  assert.ok(Number.isFinite(machineHp) && machineHp < fixture.hp, 'the authoritative machine lost health');
  await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(), r=rt.raids.raids.get(rt.raids.byAccount.get(rt.account).raidId), saved=window.__hszStaticGrade;
    r.world.blocks=saved.blocks;r.world.ramps=saved.ramps;r.world.doors=saved.doors;r.machines=saved.machines;
    delete window.__hszStaticGrade;
  })()`);

  // 5. Loot a real ground pile. The operator is moved to the pile as a fixture
  //    only so the test does not spend minutes crossing the sector; the take
  //    still travels through the shipped Interact binding and RaidService.
  await sleep(300);
  const loot = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot();const self=s.self;const pile=(s.loot||[]).filter(l=>l.items.some(i=>i.kind==='weapon')).sort((a,b)=>Math.hypot(a.x-self.x,a.z-self.z)-Math.hypot(b.x-self.x,b.z-self.z))[0];if(!pile)return null;return {id:pile.id,x:pile.x,y:pile.y||0,z:pile.z,label:pile.label,weaponId:pile.items.find(i=>i.kind==='weapon').id}})()");
  assert.ok(loot, 'a weapon-bearing ground loot pile is visible from insertion');
  await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime();const p=rt.raids.byAccount.get(rt.account);p.x=${loot.x};p.y=${loot.y};p.z=${loot.z}})()`);
  await key(page, 'ArrowLeft');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s && Math.hypot(s.self.x-(${loot.x}), s.self.z-(${loot.z}))<0.5})()`);
  await key(page, 'ArrowLeft', false);
  await sleep(250);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page, 'KeyE');
  await key(page, 'KeyE', false);
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s && s.self.pack.some(i=>i.id===${JSON.stringify(loot.weaponId)})})()`);
  const looted = await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(), r=rt.raids.raids.get(rt.raids.byAccount.get(rt.account).raidId);
    const pile=(r.floorLoot||[]).find(l=>l.id===${JSON.stringify(loot.id)});
    return {inPack:true, stillOnGround:!!(pile&&pile.items.some(i=>i.id===${JSON.stringify(loot.weaponId)}))};
  })()`);
  assert.equal(looted.stillOnGround, false, 'taking the weapon removed it from the authoritative pile');

  // 6. Extract through an opened beacon. The exit window and operator position
  //    are authoritative fixtures; boarding, seat reservation and settlement
  //    still run through the in-page RaidService on the 50 ms tick.
  const exitInfo = await page.evaluate(`(()=>{
    const rt=window.__hszOfflineRaid.runtime(), p=rt.raids.byAccount.get(rt.account), r=rt.raids.raids.get(p.raidId);
    const exit=r.exits.find(e=>e.kind==='call')||r.exits[0];
    p.x=exit.x;p.y=exit.y||0;p.z=exit.z;
    const now=Date.now()/1000;exit.openAt=now-2;exit.closeAt=now+90;
    return {id:exit.id,x:exit.x,z:exit.z,kind:exit.kind};
  })()`);
  await key(page, 'ArrowRight');
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();const card=document.querySelector('[data-exit="${exitInfo.id}"]');return !!s && !!card && card.dataset.phase==='open' && Math.hypot(s.self.x-(${exitInfo.x}), s.self.z-(${exitInfo.z}))<4})()`);
  await key(page, 'ArrowRight', false);
  await sleep(250);
  await page.evaluate("document.getElementById('view').focus()");
  await key(page, 'KeyE');
  await key(page, 'KeyE', false);
  await page.wait(`(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s && !!s.self.board && s.self.board.exit===${JSON.stringify(exitInfo.id)}})()`);
  await page.wait("(()=>{const s=window.__hszOfflineRaid.snapshot();return !!s && s.self.result && s.self.result.outcome==='extract'})()");
  const result = await page.evaluate("(()=>{const r=window.__hszOfflineRaid.snapshot().self.result;return {outcome:r.outcome,items:r.items?.length||0,lost:r.lostItems?.length||0}})()");
  assert.equal(result.outcome, 'extract', 'boarding settles as an extraction');
  assert.ok(result.items >= 1, 'extraction returns carried equipment');
  assert.equal(result.lost, 0, 'a successful extraction loses no equipment');
  const profile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(profile.activeDeployment, null, 'settlement clears the active deployment');
  assert.ok(profile.credits >= 250, 'the guest account keeps its credits');

  await writeFile('/tmp/raid-static-offline.png', Buffer.from((await page.command('Page.captureScreenshot', {format: 'png'})).data, 'base64'));

  // 7. Return to base through the shipped control. The settlement card must
  //    reconcile credits/XP and returned vs lost items from the offline
  //    RaidService result, and show the authoritative stash capacity reminder.
  //    A protected-overflow fixture proves the offline card flags gear that
  //    could not be banked because the stash was full.
  const offlineResult = await page.evaluate("window.__hszOfflineRaid.api('results').then(records=>records[0])");
  await page.evaluate(`(()=>{const rt=window.__hszOfflineRaid.runtime();rt.store.inventory.set('overflow-grader-fixture',{account:rt.account,location:'overflow',deployment:null,payload:{id:'overflow-grader-fixture',kind:'weapon',weapon:'smg',quantity:1,condition:100}});return true})()`);
  const overflowProfile = await page.evaluate("window.__hszOfflineRaid.api('profile')");
  assert.equal(overflowProfile.overflow.length, 1, 'the offline profile exposes the protected overflow fixture');
  await page.evaluate("document.getElementById('leave').click()");
  await page.wait("document.getElementById('rewards').hidden===false");
  const rewardsCard = await page.evaluate("({settlement:document.getElementById('rewardsSettlement').textContent,stash:document.getElementById('rewardsStashUsage').textContent,stashHidden:document.getElementById('rewardsStashUsage').hidden,overflow:document.getElementById('rewardsStashUsage').dataset.overflow||null})");
  assert.equal(rewardsCard.settlement, settlementGapText(offlineResult), 'the offline settlement panel reconciles the authoritative result');
  assert.equal(rewardsCard.stash, stashUsageText(overflowProfile, stashCapacity(overflowProfile)), 'the offline settlement panel shows authoritative stash capacity');
  assert.equal(rewardsCard.stashHidden, false, 'the offline stash capacity reminder is visible');
  assert.equal(rewardsCard.overflow, 'true', 'protected overflow is flagged on the offline settlement card');
  assert.match(rewardsCard.stash, /1 item in protected overflow — resolve before deploying again/, 'the overflow warning is actionable');
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    staticDeployRouting: true,
    offlineBoot: true,
    deploy: true,
    moving: true,
    machineHit: hit.kind,
    machineHpAfter: Math.round(machineHp),
    looted: loot.label,
    extracted: result.outcome,
    itemsReturned: result.items,
    lostItems: result.lost,
    credits: profile.credits,
    settlementGap: rewardsCard.settlement,
    stashUsage: rewardsCard.stash,
    noApiTraffic: true,
    screenshot: '/tmp/raid-static-offline.png',
    browserErrors: [],
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
