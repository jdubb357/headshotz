// Isolated Chrome grader for ammunition readiness. A real deployment fires one
// authoritative round through native controls; low/empty magazine states are then
// injected into the live operator and the real Reload button restores ammo. The HUD
// must show magazine/capacity, warn below a quarter, go critical and show EMPTY at zero.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const short = () => Date.now().toString(36).slice(-6);
const readAmmo = () => `(() => {
  const token = document.querySelector('#hud .hudScore[data-metric=ammo]');
  return {
    text: token?.textContent ?? null,
    aria: token?.getAttribute('aria-label') ?? null,
    state: token?.dataset.state ?? null,
    alert: document.querySelector('#hud .hudAlert')?.textContent ?? null,
    alertState: document.querySelector('#hud .hudAlert')?.dataset.state ?? null
  };
})()`;

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('ammo_' + short())};document.querySelector('[name=password]').value='a long ammo readability password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'`);
  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(operator && raid, 'the UI account deployed into an inspectable raid');
  raid.machines = [];raid.rivals = [];raid.floorLoot = [];raid.bags = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: [], doors: []};
  Object.assign(operator, {x: 0, y: 0, z: 0, hp: 100, alive: true, downed: false, protectedUntil: runtime.raids.now() + 3600, move: {x: 0, z: 0}});

  await page.wait("!!document.querySelector('#hud .hudScore[data-metric=ammo]')");
  await page.wait("document.querySelector('#hud [data-metric=ammo] .hudVal').textContent==='30/30'");
  const full = await page.evaluate(readAmmo());
  assert.equal(full.text, 'Ammo 30/30', 'full magazine shows current and catalog capacity');
  assert.equal(full.state, null, 'a full magazine has no warning state');
  assert.equal(full.alert, null, 'no empty alert while armed');
  assert.equal(full.aria, 'Ammo 30 of 30', 'full magazine is announced with capacity');

  // One native trigger press spends one authoritative round.
  await page.evaluate("document.getElementById('view').focus()");
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'KeyF', key: 'f'});
  await page.wait('document.getElementById("hud").textContent.includes("Ammo 29/30")');
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyF', key: 'f'});
  const afterShot = await page.evaluate(readAmmo());
  assert.equal(afterShot.text, 'Ammo 29/30', 'a real shot updates the HUD numerator');
  assert.equal(operator.ammo, 29, 'the server spent exactly one round');

  // Low magazine: 7 of 30 is below the 25% threshold. This is an operator-state
  // fixture through the same authoritative fields the server exposes, not a
  // fabricated client snapshot.
  operator.ammo = 7;operator.equipment.find(it => it.id === operator.weaponId).loaded = 7;
  await page.wait("document.querySelector('#hud [data-metric=ammo] .hudVal').textContent==='7/30'");
  const low = await page.evaluate(readAmmo());
  assert.equal(low.text, 'Ammo 7/30', 'low magazine shows remaining rounds');
  assert.equal(low.state, 'warn', 'low magazine uses the warning treatment');
  assert.equal(low.aria, 'Ammo 7 of 30, low', 'low magazine is announced');
  assert.equal(low.alert, null, 'empty alert is reserved for zero rounds');
  const lowShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-ammo-low.png', Buffer.from(lowShot.data, 'base64'));

  // Empty magazine: a real Reload click must succeed because compatible rounds
  // are staged in the backpack, and the alert must disappear afterwards.
  const ammoId = 'fixture_compatible_medium';
  operator.ammo = 0;operator.equipment.find(it => it.id === operator.weaponId).loaded = 0;
  operator.pack.push({id: ammoId, kind: 'ammo', ammo: 'medium', quantity: 30, condition: 100, rarity: 0});
  await page.wait("document.querySelector('#hud [data-metric=ammo] .hudVal').textContent==='0/30'");
  const empty = await page.evaluate(readAmmo());
  assert.equal(empty.text, 'Ammo 0/30', 'empty magazine still exposes capacity');
  assert.equal(empty.state, 'critical', 'empty magazine uses the critical treatment');
  assert.equal(empty.alert, 'EMPTY · RELOAD', 'an explicit empty-reload alert is visible');
  assert.equal(empty.alertState, 'critical', 'the empty alert uses critical state');
  assert.equal(empty.aria, 'Ammo 0 of 30, empty', 'empty magazine is announced');
  const emptyShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-ammo-empty.png', Buffer.from(emptyShot.data, 'base64'));

  await page.evaluate("document.getElementById('reload').click()");
  await page.wait("document.querySelector('#hud [data-metric=ammo] .hudVal').textContent==='30/30'");
  const reloaded = await page.evaluate(readAmmo());
  assert.equal(reloaded.state, null, 'reload clears the critical state');
  assert.equal(reloaded.alert, null, 'reload removes the empty alert');
  assert.equal(operator.ammo, 30, 'reload restored the authoritative magazine');
  assert.ok(operator.pack.find(it => it.id === ammoId)?.quantity === 0 || !operator.pack.some(it => it.id === ammoId), 'reload consumed the compatible stack');

  assert.deepEqual(page.errors, [], 'ammo-readiness context has no browser errors');
  console.log(JSON.stringify({
    full: [full.text, full.aria, full.alert],
    low: [low.text, low.state, low.aria],
    empty: [empty.text, empty.state, empty.alert, empty.aria],
    reloadedTo: operator.ammo,
    realShot: true,
    screenshots: ['/tmp/raid-ammo-low.png', '/tmp/raid-ammo-empty.png'],
    browserErrors: [],
    scope: 'One isolated Chrome context; real deployment and native shot; low/empty magazines are authoritative operator fixtures; Reload is the real UI button.'
  }));
} catch (error) {
  console.error(JSON.stringify({errors: page?.errors, hud: await page?.evaluate("document.getElementById('hud')?.textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
