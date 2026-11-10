// Isolated Chrome grader for look-only view sync. A real deployment holds a look
// key while standing still: the operator must not move, yet the authoritative
// snapshot's self.yaw/self.pitch must follow the local view so the minimap,
// compass, off-screen threat ring and incoming-damage bearing stay live. The
// old idle-movement deferral omitted this look packet, freezing those tools until
// the next move or shot. No loot, machine or operator fixtures are injected.
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
const state = () => page.evaluate("fetch('/api/raid').then(r => r.json())");
const key = (type, code) => page.command('Input.dispatchKeyEvent', {type, code, key: code});
let page;

async function waitFor(fn, timeout = 6000, interval = 120) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await fn();
    if (value) return value;
    await sleep(interval);
  }
  throw new Error('Timed out waiting for condition');
}

try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('viewsync_' + Date.now().toString(36).slice(-6))};document.querySelector('[name=password]').value='a long view sync acceptance password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('view').focus()");

  const initial = await state();
  assert.ok(initial?.self?.alive, 'the operator deployed alive');
  const startX = initial.self.x, startZ = initial.self.z;
  const compass = () => page.evaluate("document.getElementById('compass')?.textContent || ''");
  const compassStart = await compass();

  // Hold a look key without any movement key. Prior to iteration 19's fix, the
  // client deferred the periodic idle packet and the server never learned the
  // new bearing.
  await key('keyDown', 'ArrowRight');
  await sleep(520);
  await key('keyUp', 'ArrowRight');
  const turned = await waitFor(async () => {
    const s = await state();
    if (!s?.self?.alive || s.self.downed) return false;
    return Math.abs(wrapped((s.self.yaw || 0) - (initial.self.yaw || 0))) > 0.12 ? s : false;
  });
  const moved = Math.hypot(turned.self.x - startX, turned.self.z - startZ);
  assert.ok(moved < 0.2, 'looking only must not move the operator (' + moved.toFixed(2) + ' m)');
  assert.equal(turned.self.alive, true);
  assert.equal(turned.self.downed, false);

  // After the sync packet lands, the compass the player sees is derived from the
  // same bearing the authority now has.
  await sleep(300);
  const synced = await state();
  const compassNow = await compass();
  assert.notEqual(compassNow, compassStart, 'the visible compass follows the turn');
  const heading = ((Math.atan2(Math.sin(synced.self.yaw || 0), -Math.cos(synced.self.yaw || 0)) * 180 / Math.PI) + 360) % 360;
  const direction = Number(compassNow.match(/(\d{3})°/)?.[1]);
  assert.ok(Number.isFinite(direction), 'compass shows a numeric bearing');
  assert.ok(Math.abs(((direction - heading + 540) % 360) - 180) < 20, 'compass bearing matches the synced authoritative yaw');

  const pitchStart = synced.self.pitch || 0;
  await key('keyDown', 'ArrowUp');
  await sleep(360);
  await key('keyUp', 'ArrowUp');
  const pitched = await waitFor(async () => {
    const s = await state();
    if (!s?.self?.alive || s.self.downed) return false;
    return Math.abs((s.self.pitch || 0) - pitchStart) > 0.05 ? s : false;
  });
  const pitchUp = pitched.self.pitch || 0;

  // Aiming down is authoritative in the same way; an all-positive pitch range
  // would silently hide low machines, crates and loot from aimed fire.
  await key('keyDown', 'ArrowDown');
  await sleep(760);
  await key('keyUp', 'ArrowDown');
  const pitchedDown = await waitFor(async () => {
    const s = await state();
    if (!s?.self?.alive || s.self.downed) return false;
    return pitchUp - (s.self.pitch || 0) > 0.25 ? s : false;
  });
  assert.ok((pitchedDown.self.pitch || 0) < pitchStart - 0.05, 'downward aim syncs below the deployed pitch');
  assert.ok(Math.hypot(pitchedDown.self.x - startX, pitchedDown.self.z - startZ) < 0.2, 'pitch-only aim does not move the operator');

  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-view-sync.png', Buffer.from(shot.data, 'base64'));
  assert.deepEqual(page.errors, [], 'the view-sync browser context has no errors');
  console.log(JSON.stringify({
    startYaw: initial.self.yaw, syncedYaw: synced.self.yaw, yawDelta: wrapped((synced.self.yaw || 0) - (initial.self.yaw || 0)),
    startPitch: pitchStart, pitchUp, pitchDown: pitchedDown.self.pitch, movedMetres: Math.round(moved * 100) / 100,
    compassStart, compassNow, screenshot: '/tmp/raid-view-sync.png', browserErrors: []
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({failure: String(error), browserErrors: page?.errors}, null, 2));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
