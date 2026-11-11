// Static-Pages transport smoke: serve the repo as plain files with no Node
// raid API and exercise the in-page dispatcher through the real raid UI.
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';

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

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=static_dispatch');
  await page.wait("document.body.dataset.raidTransport==='offline'");
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  assert.match(await page.evaluate("document.getElementById('identity').textContent"), /250 credits/);
  assert.match(await page.evaluate("document.getElementById('partyState').textContent"), /Playing solo/);

  // Offline is a solo-versus-machines mode: squad create/join, voice and
  // connection probes are hosted-only controls and must not be surfaced.
  const soloUI = await page.evaluate(`(()=>{
    const hidden=id=>{for(let el=document.getElementById(id);el;el=el.parentElement)if(el.hidden)return true;return false};
    return {
      squadControlsHidden:hidden('squadOnlineControls'),
      partyCreateHidden:hidden('partyCreate'),
      partyJoinHidden:hidden('partyJoin'),
      partyModeDisabled:document.getElementById('partyMode').disabled,
      partyRoleDisabled:document.getElementById('partyRole').disabled,
      connectionControlsHidden:hidden('connectionControls'),
      checkLatencyDisabled:document.getElementById('checkLatency').disabled,
      commsToggleHidden:hidden('commsToggle'),
      voiceEnableDisabled:document.getElementById('voiceEnable').disabled,
      voiceStatus:document.getElementById('voiceStatus').textContent,
      matchSummary:document.getElementById('matchSummary').textContent,
    };
  })()`);
  assert.equal(soloUI.squadControlsHidden, true, 'offline hides squad mutation controls');
  assert.equal(soloUI.partyCreateHidden, true);
  assert.equal(soloUI.partyJoinHidden, true);
  assert.equal(soloUI.partyModeDisabled, true);
  assert.equal(soloUI.partyRoleDisabled, true);
  assert.equal(soloUI.connectionControlsHidden, true, 'offline hides latency probes');
  assert.equal(soloUI.checkLatencyDisabled, true);
  assert.equal(soloUI.commsToggleHidden, true, 'offline hides squad voice');
  assert.equal(soloUI.voiceEnableDisabled, true);
  assert.match(soloUI.voiceStatus, /unavailable in offline/);
  assert.match(soloUI.matchSummary, /Offline raid/);

  // The offline dispatcher must exist and its 50 ms tick must be running.
  assert.equal(await page.evaluate("!!window.__hszOfflineRaid && window.__hszOfflineRaid.mode==='offline'"), true);
  assert.equal(await page.evaluate("window.__hszOfflineRaid.runtime().tickTimer!==null"), true);

  // No Node /api traffic: the page is fully in-page.
  const apiRequests = await page.evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(n=>new URL(n).pathname.startsWith('/api/'))");
  assert.deepEqual(apiRequests, []);

  // Select the starter rifle, deploy, and enter the raid.
  await page.wait("!!document.querySelector('#stash input[data-equip]')");
  await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait("!!window.__hszOfflineRaid.snapshot()");

  const start = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {x:s.x,z:s.z,deploymentId:s.deploymentId,hp:s.hp}})()");
  assert.ok(start.deploymentId);
  assert.ok(Number.isFinite(start.x) && Number.isFinite(start.z));
  assert.ok(start.hp > 0);

  // Move through a real dispatched action and see the authoritative position change.
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'KeyW', key: 'w'});
  const moved = await (async () => {
    const until = Date.now() + 8000;
    while (Date.now() < until) {
      const now = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot()?.self;return s?{x:s.x,z:s.z}:null})()");
      if (now && Math.hypot(now.x - start.x, now.z - start.z) > 0.5) return now;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('authoritative position did not change after moving');
  })();
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyW', key: 'w'});
  assert.ok(moved);

  // A fire packet resolves through the in-page RaidService and returns state.
  // Retry because the UI's own reliable-action queue may commit a newer
  // sequence while this diagnostic packet is prepared.
  const fired = await page.evaluate(`(async()=>{
    for(let attempt=0;attempt<6;attempt++){
      const s=window.__hszOfflineRaid.snapshot();
      try{
        const r=await window.__hszOfflineRaid.api('action',{type:'fire',yaw:s.self.yaw,pitch:0,seq:s.self.seq+1,raidId:s.raidId,deploymentId:s.self.deploymentId,protocol:window.__hszOfflineRaid.protocol,includeState:true});
        return {ok:!!r.ok,accepted:!!r.ack.accepted,state:!!r.state};
      }catch(e){}
      await new Promise(r=>setTimeout(r,60));
    }
    return {ok:false,accepted:false,state:false};
  })()`);
  assert.equal(fired.ok, true);
  assert.equal(fired.accepted, true);
  assert.equal(fired.state, true);

  assert.deepEqual(page.errors, []);

  // Static Pages DEPLOY routing: the hub banner must send users to the offline
  // raid client, and the clearly labeled secondary control must keep the
  // original co-op raid base reachable on a plain static page.
  const hub = await harness.page('/?q=low&noassets&nohum');
  await hub.wait("!!window.__hsz?.raid");
  assert.equal(await hub.evaluate("document.getElementById('raidLegacyBtn').classList.contains('hidden')"), false, 'static hub exposes classic extraction');
  await hub.evaluate("document.getElementById('raidLegacyBtn').click()");
  await hub.wait("!document.getElementById('raid').classList.contains('hidden')");
  assert.equal(await hub.evaluate("location.pathname"), '/');
  assert.deepEqual(hub.errors, []);

  const deployPage = await harness.page('/?q=low&noassets&nohum');
  await deployPage.wait("!!window.__hsz?.raid");
  await deployPage.evaluate("document.getElementById('raidBtn').click()");
  await deployPage.wait("location.pathname==='/raid-online.html' && location.search.includes('offline=1')");
  await deployPage.wait("document.body.dataset.raidTransport==='offline'");
  assert.deepEqual(deployPage.errors, []);

  // Without the explicit flag, a failed /api/profile probe must still select
  // offline mode; GitHub Pages serves this instance with no service meta.
  const probed = await harness.page('/raid-online.html?guest=probe_dispatch');
  await probed.wait("document.body.dataset.raidTransport==='offline'");
  await probed.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  assert.match(await probed.evaluate("document.getElementById('identity').textContent"), /250 credits/);
  assert.equal(await probed.evaluate("document.getElementById('squadOnlineControls').hidden"), true);
  assert.deepEqual(probed.errors, []);

  console.log(JSON.stringify({staticOffline: true, probeFallback: true, deploy: true, moving: true, firing: true, noApiTraffic: true, tick: true, soloUI: true, staticDeployRouting: true, classicExtraction: true, browserExceptions: []}));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
