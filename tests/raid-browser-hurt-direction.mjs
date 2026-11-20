// Isolated Chrome grader for incoming-damage direction. A real UI deployment is
// left unprotected while one authoritative machine behind the operator resolves
// a mortar strike. The client must show a behind arrow from the server-written
// bearing and name, then remove it when the 1.6 s snapshot window expires.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {browserHarness} from './browser-harness.mjs';

let now = 1000;
const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => now});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const short = () => Date.now().toString(36).slice(-6);

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('hurt_' + short())};document.querySelector('[name=password]').value='a long hurt direction password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'`);
  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(operator && raid, 'the UI account deployed into an inspectable raid');

  raid.rivals = [];raid.bags = [];raid.floorLoot = [];raid.caches = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: [], doors: []};
  raid.utilities = [];
  Object.assign(operator, {x: 0, y: 0, z: 0, yaw: 0, hp: 100, alive: true, downed: false, move: {x: 0, z: 0}, protectedUntil: 0});

  assert.equal(await page.evaluate("document.getElementById('hurt').hidden"), true, 'no marker before any incoming damage');
  const heavy = {id: 'fixture_behind', kind: 'heavy', x: 0, y: 0, z: -5, hp: MACHINES.heavy.hp, maxHp: MACHINES.heavy.hp, yaw: 0,
    nextAttack: 1e12, state: 'patrol', home: {x: 0, y: 0, z: -5}, path: [], pathAt: 0, elite: false,
    attack: {at: now, point: {x: 0, y: 0, z: 0}, radius: 3.5}};
  raid.machines = [heavy];

  await page.wait("!!document.querySelector('#hurt .hurtMarker')");
  const marker = await page.evaluate(`(() => {
    const m = document.querySelector('#hurt .hurtMarker');
    return m && {
      side: m.dataset.side, source: m.dataset.source,
      label: m.getAttribute('aria-label'),
      tx: Number(getComputedStyle(m).getPropertyValue('--tx').replace('px','')),
      ty: Number(getComputedStyle(m).getPropertyValue('--ty').replace('px','')),
      glyph: !!m.querySelector('.hurtGlyph'),
      layerHidden: document.getElementById('hurt').hidden,
      count: document.querySelectorAll('#hurt .hurtMarker').length
    };
  })()`);
  assert.ok(marker, 'incoming positioned damage renders a direction marker');
  assert.equal(marker.layerHidden, false, 'the layer is visible while damage is recent');
  assert.equal(marker.count, 1, 'only the latest source is shown');
  assert.equal(marker.side, 'behind', 'a rear mortar strike reads as behind');
  assert.equal(marker.source, 'machine', 'the marker carries the authoritative source kind');
  assert.equal(marker.ty > 20, true, 'a behind source maps below the ring');
  assert.equal(Math.abs(marker.tx) < 20, true, 'a straight-behind source stays centered');
  assert.match(marker.label, /^Incoming damage from behind · machine fire$/, 'the marker names side and source: ' + marker.label);
  assert.equal(marker.glyph, true, 'the marker draws a directional arrow');
  assert.ok(operator.hp < 100, 'the authoritative strike reduced operator health: ' + operator.hp);

  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-hurt-direction.png', Buffer.from(shot.data, 'base64'));

  // Advance the server past the presentation window and let the live client poll
  // the resulting snapshot; the stale bearing must not linger.
  now += 3;
  runtime.raids.tick(.05);
  await page.wait("document.getElementById('hurt').hidden===true && document.querySelectorAll('#hurt .hurtMarker').length===0");
  assert.equal(operator.hp < 100, true, 'the strike remains authoritative after the marker expires');
  assert.equal(heavy.hp, MACHINES.heavy.hp, 'the machine fixture was not damaged by its own strike');

  assert.deepEqual(page.errors, [], 'hurt-direction context has no browser errors');
  console.log(JSON.stringify({
    source: marker.source, side: marker.side, label: marker.label,
    position: [marker.tx, marker.ty], hpAfterStrike: operator.hp,
    markerClearedAfterWindow: true, layerHiddenBeforeDamage: true,
    browserErrors: [], screenshot: '/tmp/raid-hurt-direction.png',
    scope: 'One isolated Chrome context; real deployment; one authoritative machine strike; snapshot-driven direction; no HP or bearing fixtures.'
  }));
} catch (error) {
  console.error(JSON.stringify({errors: page?.errors, hurt: await page?.evaluate("document.getElementById('hurt')?.innerHTML").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
