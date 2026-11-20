// Static-Pages offline base readiness: with no Node `/api`, the base screen must
// preview the authoritative deploy preflight for the current selection, explain
// blockers, and gate the Deploy button without duplicating raid rules on the
// client. The same store method backs the deploy route, so a valid selection
// still deploys through the shipped button.
//
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

const readiness = page => page.evaluate(`(()=>{const line=document.getElementById('deployReadiness');return {
  hidden: line.hidden,
  text: line.textContent,
  state: line.dataset.ready ?? null,
  weight: line.dataset.weight ?? null,
  premium: line.dataset.premium ?? null,
  deployDisabled: document.getElementById('deploy').disabled,
  deployVisibleText: document.getElementById('deploy').textContent,
}})()`);

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1&guest=readiness_alpha');
  await page.wait('!!window.__hszOfflineRaid');
  await page.wait('document.body.dataset.raidTransport==="offline"');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'the readiness preview must stay in-page',
  );

  const ids = await page.evaluate(`(async()=>{const p=await window.__hszOfflineRaid.api('profile');const weapon=p.items.find(it=>it.kind==='weapon');const armor=p.items.find(it=>it.kind==='armor');return {weapon:weapon.id,armor:armor.id,revision:p.revision,credits:p.credits}})()`);
  assert.ok(ids.weapon && ids.armor, 'the starter guest carries a weapon and armor');

  // 1. Empty selection is blocked by the same preflight deploy runs.
  const empty = await readiness(page);
  assert.equal(empty.hidden, false, 'offline readiness line is visible');
  assert.equal(empty.state, 'false');
  assert.match(empty.text, /Equip one or two weapons/);
  assert.equal(empty.deployDisabled, true, 'Deploy is gated while the selection cannot deploy');

  // 2. A selected starter rifle is ready with authoritative weight/premium.
  await page.evaluate(`document.querySelector('#stash input[data-equip][value="${ids.weapon}"]').click()`);
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='true'");
  const ready = await readiness(page);
  assert.match(ready.text, /Ready to deploy/);
  assert.equal(ready.weight, '4.0', 'carried weight is reported from the catalogue');
  assert.equal(ready.premium, '0');
  assert.equal(ready.deployDisabled, false);

  // 3. Insuring gear surfaces the premium the store will charge.
  await page.evaluate(`document.querySelector('#stash input[data-insure][value="${ids.armor}"]').click()`);
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='true' && Number(document.getElementById('deployReadiness').dataset.premium)>0");
  const insured = await readiness(page);
  assert.equal(insured.premium, '14', 'armor insurance is 20% of its catalogue price');
  assert.match(insured.text, /insurance premium 14 credits/);
  assert.equal(insured.deployDisabled, false);

  // 4. Recovery kit is ready without paid insurance.
  await page.evaluate("(()=>{const r=document.getElementById('recovery');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await page.wait("[...document.querySelectorAll('#stash input[data-insure]')].every(i=>!i.checked) || document.getElementById('deployReadiness').textContent.includes('Recovery kit ready')");
  const recovery = await readiness(page);
  assert.equal(recovery.state, 'true');
  assert.match(recovery.text, /Recovery kit ready/);
  assert.equal(recovery.premium, '0');

  // 5. Clearing the selection blocks deploy again, and the gate uses the
  //    authoritative preflight rather than a client-side claim.
  await page.evaluate(`(()=>{const r=document.getElementById('recovery');r.checked=false;r.dispatchEvent(new Event('change',{bubbles:true}));for(const input of document.querySelectorAll('#stash input[data-equip]'))input.checked=false;for(const input of document.querySelectorAll('#stash input[data-insure]'))input.checked=false;document.getElementById('stash').dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='false'");
  const cleared = await readiness(page);
  assert.match(cleared.text, /Deploy blocked/);
  assert.equal(cleared.deployDisabled, true);

  // 6. A ready loadout still deploys through the shipped button and the
  //    authoritative service (the readiness gate is not a client shortcut).
  await page.evaluate(`document.querySelector('#stash input[data-equip][value="${ids.weapon}"]').click()`);
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='true'");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && !!window.__hszOfflineRaid.snapshot()");
  const deployed = await page.evaluate("(()=>{const s=window.__hszOfflineRaid.snapshot().self;return {deploymentId:s.deploymentId,gear:s.equipment.map(it=>it.id)}})()");
  assert.ok(deployed.deploymentId);
  assert.deepEqual(deployed.gear, [ids.weapon], 'the authoritative deployment carries the selected gear');

  // 7. Back at base with an unresolved deployment, readiness explains the
  //    active raid and Resume stays available while Deploy stays blocked.
  await page.evaluate("document.getElementById('leave').click()");
  await page.wait("document.getElementById('play').style.display==='none' && !document.getElementById('base').hidden && !document.getElementById('resume').hidden && document.body.getAttribute('aria-busy')==='false'");
  const active = await readiness(page);
  assert.equal(active.state, 'false');
  assert.match(active.text, /Operator still in raid/);
  assert.equal(active.deployDisabled, true);
  assert.equal(await page.evaluate("document.getElementById('resume').hidden"), false, 'Resume remains available');
  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))"),
    [],
    'readiness never falls back to a Node API',
  );
  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({empty, ready, insured, recovery, cleared, deployed: deployed.deploymentId, active, resumeHidden: false, noApiTraffic: true, browserErrors: []}));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
