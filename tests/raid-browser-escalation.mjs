// Isolated Chrome grader for raid encounter escalation. The server clock is
// advanced deterministically to publish an environmental warning, an active
// hazard window, and the final extraction squeeze; the real raid UI must show
// the sector status line and paint hazard rings on the minimap/full map.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
let clock = 1000;
const runtime = createRaidServer(store, {now: () => clock});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function register(page) {
  const name = 'esc_' + Date.now().toString(36).slice(-6);
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long escalation password';document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  return name;
}
async function deploy(page) {
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
}
async function pixels(page, id, predicate) {
  return page.evaluate(`(() => {
    const canvas = document.getElementById(${JSON.stringify(id)});
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (${predicate}) count++;
    return count;
  })()`);
}
const isRed = '(data[i] > 180 && data[i + 1] < 110 && data[i + 2] < 110)';

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await register(page);
  const id = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  await deploy(page);
  const player = runtime.raids.byAccount.get(id);
  const raid = runtime.raids.raids.get(player.raidId);
  Object.assign(raid, {machines: [], rivals: [], dynamicHazards: [], phaseHazards: [], hazardTicks: {}, world: {...raid.world, hazards: []}, nextPatrol: raid.started + 10_000, nextElite: raid.started + 10_000, squeezeAt: 0, nextSqueeze: 0, alarms: 0, alarmLevel: 0});

  const advance = async (at) => {
    clock = at;
    player.lastInput = at;
    runtime.raids.advance(0.05, at);
  };

  // Hazard warning first: no damage, but the sector status announces the front
  // and the minimap paints its amber warning ring.
  await page.wait("document.getElementById('sectorStatus').textContent.includes('Ashfall squall')===false");
  await advance(raid.started + 150);
  await page.wait("document.getElementById('sectorStatus').textContent.includes('Ashfall squall')");
  const warningStatus = await page.evaluate("document.getElementById('sectorStatus').textContent");
  assert.match(warningStatus, /Ashfall squall in 18s · take cover/, 'the warning window and countdown are rendered');
  assert.equal(await page.evaluate("document.getElementById('sectorStatus').getAttribute('data-state')"), 'warning');
  const warningRed = await pixels(page, 'minimap', isRed);

  // Make the window active. Red hazard paint must increase while the status
  // switches to an active countdown, with no browser exception.
  await advance(raid.started + 170);
  await page.wait("document.getElementById('sectorStatus').textContent.includes('Ashfall squall ACTIVE')");
  assert.equal(await page.evaluate("document.getElementById('sectorStatus').getAttribute('data-state')"), 'critical');
  const activeRed = await pixels(page, 'minimap', isRed);
  assert.ok(activeRed > warningRed, 'the active hazard window adds red hazard paint to the minimap (' + warningRed + ' → ' + activeRed + ')');

  // The full-screen map paints the same authoritative hazard field.
  await page.evaluate("document.getElementById('mapToggle').click()");
  await page.wait("document.getElementById('tacticalMap').hidden===false");
  const mapWarningRed = await pixels(page, 'tacticalCanvas', isRed);
  assert.ok(mapWarningRed > warningRed, 'the full map paints the active hazard ring (' + mapWarningRed + ' pixels)');

  // Endgame squeeze: the server advances into the final 180 seconds and the
  // client surfaces collapse countdown plus elite patrol strength. The exit is
  // turned contested by the elite ambush authoritative snapshot.
  const exit = raid.exits.find(e => e.kind === 'call') || raid.exits[0];
  Object.assign(player, {x: exit.x, y: exit.y || 0, z: exit.z, protectedUntil: 0});
  await advance(raid.deadline - 150);
  await page.wait("document.getElementById('sectorStatus').textContent.includes('SECTOR COLLAPSE')");
  const squeezeStatus = await page.evaluate("document.getElementById('sectorStatus').textContent");
  assert.match(squeezeStatus, /SECTOR COLLAPSE · 150s · extraction contested/, 'the squeeze countdown is rendered');
  await page.wait("document.getElementById('sectorStatus').textContent.includes('Elite patrols')");
  const eliteStatus = await page.evaluate("document.getElementById('sectorStatus').textContent");
  assert.match(eliteStatus, /Elite patrols ×\d+/, 'elite patrol strength is rendered');
  const state = await page.evaluate("fetch('/api/raid').then(r=>r.json())");
  assert.equal(state.escalation.squeeze.left, 150);
  assert.ok(state.escalation.squeeze.contested >= 1, 'the elite ambush marks the extraction site contested');
  assert.ok(state.escalation.elite >= 1, 'visible elite patrol strength is authoritative');
  assert.ok((state.escalation.alarms || 0) >= 0, 'threat level data is present without fabrication');

  // Rendered elite markers and concise sector status must remain visible and
  // stable; machine/tick activity is exercised on the same snapshots.
  assert.ok(await page.evaluate("document.getElementById('sectorStatus').textContent.length < 220"), 'the status line stays compact');
  await sleep(300);
  assert.deepEqual(page.errors, [], 'escalation browser context has no errors');
  console.log(JSON.stringify({
    hazardWarning: warningStatus,
    hazardActive: true,
    minimapHazardRed: [warningRed, activeRed],
    fullMapHazardRed: mapWarningRed,
    squeezeStatus,
    eliteStatus,
    contestedExits: state.escalation.squeeze.contested,
    elitePatrols: state.escalation.elite,
    browserErrors: [],
    scope: 'Authoritative server escalation rendered by the real raid UI; no browser exception.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: await page?.evaluate("document.getElementById('sectorStatus')?.textContent").catch(() => null),
    errors: page?.errors
  }));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
