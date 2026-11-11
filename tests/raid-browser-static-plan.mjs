// Static-Pages offline raid plan: the Deploy card reports the authoritative
// field-objective hold and reward from the shared catalogue, remembers the
// chosen sector and objective on the device across reloads, and deploys that
// objective into the real in-page RaidService. There is no Node `/api`.
//
// Run with CDP_URL pointing at an isolated Chrome (default 9336).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {objectivesFor} from '../shared/raid-objectives.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};
const BOOTED = "document.body.dataset.raidTransport==='offline' && !document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'";
const PLAN = {mapId: 'switchyard', objective: 'switchyard-field-freight-office'};
const WORLD = RAID_WORLDS.find(world => world.id === PLAN.mapId);
const DEFINITION = objectivesFor(WORLD).find(objective => objective.id === PLAN.objective);
assert.ok(WORLD, 'the plan sector must exist');
assert.ok(DEFINITION, 'the plan objective must be authored');

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
  await new Promise((ready, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ready); });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const planHistory = page => page.evaluate(`(()=>{
  const line=document.getElementById('deployReadiness');
  const field=document.getElementById('fieldObjective');
  return {ready:line.dataset.ready, objective:line.dataset.objective||null, text:line.textContent, field:field.value, map:document.getElementById('map').value};
})()`);

const chooseWeapon = page => page.evaluate("document.querySelector('#stash input[data-equip]').click()");

async function selectPlan(page) {
  await page.evaluate(`(()=>{
    const map=document.getElementById('map');map.value=${JSON.stringify(PLAN.mapId)};map.dispatchEvent(new Event('change'));
    const field=document.getElementById('fieldObjective');field.value=${JSON.stringify(PLAN.objective)};field.dispatchEvent(new Event('change'));
  })()`);
}

async function shot(page, path) {
  await page.evaluate("document.getElementById('deploy').scrollIntoView({block:'center'})");
  await new Promise(resolve => setTimeout(resolve, 150));
  const png = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(png.data, 'base64'));
  return path;
}

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/');
  await page.wait('!!window.__hsz?.raid');
  await page.evaluate("document.getElementById('raidBtn').click()");
  await page.wait("location.pathname==='/raid-online.html' && new URLSearchParams(location.search).get('offline')==='1'");
  await page.wait(BOOTED);

  // 1. The Deploy card offers every authored objective for the selected sector.
  const options = await page.evaluate("([...document.getElementById('fieldObjective').options].map(o=>o.value).filter(Boolean))");
  assert.deepEqual(options, objectivesFor(RAID_WORLDS[0]).map(o => o.id), 'objective options come from the shared catalogue');
  await chooseWeapon(page);
  await selectPlan(page);
  await page.wait("document.getElementById('deployReadiness').dataset.objective==='switchyard-field-freight-office'");
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='true'");
  const selected = await planHistory(page);
  assert.equal(selected.map, PLAN.mapId);
  assert.equal(selected.field, PLAN.objective);
  assert.equal(selected.ready, 'true', 'an authored plan with gear is ready to deploy');
  assert.equal(selected.objective, PLAN.objective, 'the readiness line reports the authored objective id');
  const expectedCopy = 'field objective ' + DEFINITION.name + ' (' + DEFINITION.site + ') · +' + DEFINITION.rewardCredits + ' credits / +' + DEFINITION.rewardXp + ' XP after a ' + DEFINITION.holdSeconds + ' s hold.';
  assert.ok(selected.text.includes(expectedCopy), 'readiness copy matches the catalogue: ' + selected.text);

  // 2. Reload: the device-local plan prefills the same sector and objective.
  await page.command('Page.reload', {ignoreCache: true});
  await page.wait(BOOTED);
  const restoredBeforeSelection = await planHistory(page);
  assert.equal(restoredBeforeSelection.map, PLAN.mapId, 'the selected sector is restored');
  assert.equal(restoredBeforeSelection.field, PLAN.objective, 'the selected objective is restored');
  assert.equal(restoredBeforeSelection.ready, 'false', 'the restored plan still needs a loadout');
  await chooseWeapon(page);
  await page.wait("document.getElementById('deployReadiness').dataset.objective==='switchyard-field-freight-office'");
  await page.wait("document.getElementById('deployReadiness').dataset.ready==='true'");
  const restored = await planHistory(page);
  assert.equal(restored.objective, PLAN.objective);
  assert.ok(restored.text.includes(expectedCopy), 'restored readiness copy is still authoritative');
  await shot(page, '/tmp/hs-offline-plan.png');

  // 3. Deploy the planned objective through the shipped button.
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.body.dataset.inRaid==='true' && window.__hszOfflineRaid.snapshot()?.objective?.stage==='approach'");
  const objective = await page.evaluate("window.__hszOfflineRaid.snapshot().objective");
  assert.equal(objective.id, DEFINITION.id);
  assert.equal(objective.name, DEFINITION.name);
  assert.equal(objective.site, DEFINITION.site);
  assert.equal(objective.x, DEFINITION.x);
  assert.equal(objective.z, DEFINITION.z);
  assert.equal(objective.holdSeconds, DEFINITION.holdSeconds);
  assert.equal(objective.rewardCredits, DEFINITION.rewardCredits);
  assert.equal(objective.rewardXp, DEFINITION.rewardXp);

  assert.deepEqual(
    await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(path=>path.startsWith('/api/'))"),
    [],
    'the offline plan must not call the Node API',
  );
  console.log(JSON.stringify({
    staticServer: true,
    noApiTraffic: true,
    objectiveOptions: options.length,
    selectedMap: selected.map,
    selectedObjective: selected.objective,
    readinessCopy: expectedCopy,
    restoredMap: restored.map,
    restoredObjective: restored.objective,
    deployedObjective: objective.id,
    deployedReward: {credits: objective.rewardCredits, xp: objective.rewardXp, holdSeconds: objective.holdSeconds},
    screenshot: '/tmp/hs-offline-plan.png',
    browserErrors: page.errors,
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
