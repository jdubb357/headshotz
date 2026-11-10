// Isolated Chrome grader for off-screen machine threat markers. Four
// authoritative machines are positioned ahead, right, left and behind the
// operator; the client must keep the forward one in the scene, place the other
// three directionally from the snapshot, mark a windup machine as charging, and
// clear the layer when the snapshot has no threats. Runs through the real UI.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const short = () => Date.now().toString(36).slice(-6);
const machine = (id, kind, x, z, extra = {}) => ({
  id, kind, x, y: 0, z, hp: MACHINES[kind].hp, maxHp: MACHINES[kind].hp, yaw: 0,
  nextAttack: 1e12, state: 'patrol', home: {x, y: 0, z}, path: [], pathAt: 0,
  elite: false, ...extra
});

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('threats_' + short())};document.querySelector('[name=password]').value='a long threats password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'`);
  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  assert.ok(operator, 'the UI account deployed into a raid');
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(raid, 'the authoritative raid is inspectable');

  raid.rivals = [];
  raid.bags = [];
  raid.floorLoot = [];
  raid.caches = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: [], doors: []};
  raid.utilities = [];
  Object.assign(operator, {x: 0, y: 0, z: 0, yaw: 0, hp: 100, alive: true, downed: false, move: {x: 0, z: 0}, protectedUntil: runtime.raids.now() + 3600});

  const now = runtime.raids.now();
  const right = machine('fixture_right', 'hunter', -8, 0);
  const left = machine('fixture_left', 'scout', 8, 0);
  const forward = machine('fixture_forward', 'hunter', 0, 8);
  const behind = machine('fixture_behind', 'heavy', 0, -7, {state: 'windup', attack: {at: now + 120, point: {x: 0, y: 0, z: 0}, radius: 3.5}});
  raid.machines = [right, left, forward, behind];

  const markerState = id => page.evaluate(`(() => {
    const layer = document.getElementById('threats');
    const mr = document.querySelector('#threats [data-machine-id="${id}"]');
    return {
      layerHidden: layer.hidden,
      count: layer.querySelectorAll('.threatMarker').length,
      exists: !!mr,
      state: mr?.dataset.state ?? null,
      kind: mr?.dataset.kind ?? null,
      label: mr?.getAttribute('aria-label') ?? null,
      tx: mr ? Number(getComputedStyle(mr).getPropertyValue('--tx').replace('px','')) : null,
      ty: mr ? Number(getComputedStyle(mr).getPropertyValue('--ty').replace('px','')) : null,
      glyph: mr?.querySelector('.threatGlyph')?.textContent ?? null
    };
  })()`);

  await page.wait("document.querySelectorAll('#threats .threatMarker').length===3");
  const layer = await page.evaluate("(() => { const l=document.getElementById('threats'); return {hidden:l.hidden, label:l.getAttribute('aria-label'), markers:[...l.querySelectorAll('.threatMarker')].map(m=>m.dataset.machineId)} })()");
  assert.equal(layer.hidden, false, 'the threat layer is visible when contacts exist');
  assert.equal(layer.label, 'Off-screen machine threats', 'the layer is a single labelled group');
  assert.equal(layer.markers.filter(id => id === 'fixture_forward').length, 0, 'the forward on-screen hunter has no marker');
  assert.equal(layer.markers.length, 3, 'right, left and behind produce markers; count stays bounded');

  const rightM = await markerState('fixture_right');
  const leftM = await markerState('fixture_left');
  const behindM = await markerState('fixture_behind');
  assert.ok(rightM.exists && leftM.exists && behindM.exists, 'each off-screen machine has a marker');
  assert.equal(rightM.tx > 20, true, 'right contact sits on the right of the ring');
  assert.equal(leftM.tx < -20, true, 'left contact sits on the left of the ring');
  assert.equal(behindM.ty > 20, true, 'rear contact sits below the ring');
  assert.ok(Math.abs(rightM.ty) < 40 && Math.abs(leftM.ty) < 40, 'side contacts stay near the middle row');
  assert.ok(behindM.label.includes('Bulwark') && behindM.label.includes('behind') && behindM.label.includes('charging'), 'rear charging marker names machine, side and windup: ' + behindM.label);
  assert.equal(behindM.state, 'windup', 'windup state drives the danger treatment');
  assert.equal(behindM.glyph, '!', 'charging marker uses the warning glyph');
  assert.ok(rightM.label.includes('Prowler') && rightM.label.includes('right'), 'right marker names machine and side: ' + rightM.label);
  assert.ok(leftM.label.includes('Needle Scout') && leftM.label.includes('left'), 'left marker names machine and side: ' + leftM.label);

  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-threats.png', Buffer.from(shot.data, 'base64'));

  raid.machines = [];
  await page.wait("document.getElementById('threats').hidden===true && document.querySelectorAll('#threats .threatMarker').length===0");
  assert.deepEqual(page.errors, [], 'threat context has no browser errors');
  console.log(JSON.stringify({
    forwardExcluded: true,
    markers: layer.markers,
    positions: {right: [rightM.tx, rightM.ty], left: [leftM.tx, leftM.ty], behind: [behindM.tx, behindM.ty]},
    labels: {right: rightM.label, left: leftM.label, behind: behindM.label},
    charging: behindM.state,
    emptyHidden: true,
    screenshot: '/tmp/raid-threats.png',
    browserErrors: [],
    scope: 'One isolated Chrome context; machine fixtures are authoritative raid state; markers read only the filtered snapshot.'
  }));
} catch (error) {
  console.error(JSON.stringify({errors: page?.errors, threats: await page?.evaluate("document.getElementById('threats').innerHTML").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
