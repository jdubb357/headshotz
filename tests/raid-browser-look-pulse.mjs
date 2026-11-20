// Isolated Chrome grader for deterministic look pulses. A real deployment and
// the shipped Arrow key bindings are driven by exact in-page 100 ms holds; the
// authoritative snapshot must reflect the client's integrated look delta of
// 0.17 rad yaw (1.7 rad/s) and 0.14 rad pitch (1.4 rad/s). The client integrates
// look once per animation frame, so the wall-clock hold can round up by one
// 60 Hz frame (up to 0.023 rad at 1.4 rad/s); FRAME_QUANTUM allows exactly that
// quantization and still rejects the multi-frame drift of open-loop CDP holds.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const FRAME_QUANTUM = 0.03;

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
let page;

// The same shipped-binding pulse the natural acceptance uses: the raid input
// handler only needs keydown/keyup, and the in-page timer releases the key at
// exactly the requested duration instead of relying on CDP transport timing.
async function lookPulse(code, ms) {
  await page.evaluate(`(() => new Promise(resolve => {
    const target = document.getElementById('view') || document.activeElement || document.body;
    const send = type => target.dispatchEvent(new KeyboardEvent(type, {bubbles: true, cancelable: true, code: ${JSON.stringify(code)}, key: ${JSON.stringify(code)}}));
    send('keydown');
    setTimeout(() => { send('keyup'); resolve(true); }, ${Math.max(1, Math.round(ms))});
  }))()`);
}

async function settle() {
  // Two 150 ms client move ticks plus one extra poll so the authoritative
  // snapshot is not a pre-pulse sample.
  await sleep(420);
  return state();
}

try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('pulse_' + Date.now().toString(36).slice(-6))};document.querySelector('[name=password]').value='a deterministic look pulse password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('view').focus()");

  let snap = await state();
  assert.ok(snap?.self?.alive, 'the operator deployed alive');
  const before = {x: snap.self.x, z: snap.self.z, yaw: snap.self.yaw || 0, pitch: snap.self.pitch || 0};

  // 100 ms yaw hold: shipped binding + in-page release == 1.7 rad/s * 0.1 s.
  await lookPulse('ArrowLeft', 100);
  snap = await settle();
  const yawDelta = wrapped((snap.self.yaw || 0) - before.yaw);
  assert.ok(Math.abs(yawDelta - 0.17) <= FRAME_QUANTUM, 'a 100 ms yaw pulse turns 0.17 rad (got ' + yawDelta.toFixed(4) + ')');
  assert.ok(Math.hypot(snap.self.x - before.x, snap.self.z - before.z) < 0.2, 'a look pulse does not move the operator');

  // 100 ms pitch hold: 1.4 rad/s * 0.1 s. Start from the now-synced pitch.
  const pitchBase = snap.self.pitch || 0;
  await lookPulse('ArrowUp', 100);
  snap = await settle();
  const pitchDelta = (snap.self.pitch || 0) - pitchBase;
  assert.ok(Math.abs(pitchDelta - 0.14) <= FRAME_QUANTUM, 'a 100 ms pitch pulse tilts 0.14 rad (got ' + pitchDelta.toFixed(4) + ')');

  // A second opposite pulse lands back within one tick's rounding of the
  // starting bearing: no open-loop overshoot accumulates between pulses.
  await lookPulse('ArrowRight', 100);
  snap = await settle();
  const backYaw = wrapped((snap.self.yaw || 0) - before.yaw);
  assert.ok(Math.abs(backYaw) <= FRAME_QUANTUM * 2, 'opposing 100 ms sweeps return to the start bearing (got ' + backYaw.toFixed(4) + ')');

  assert.deepEqual(page.errors, [], 'the look-pulse browser context has no errors');
  console.log(JSON.stringify({
    yawDelta: Math.round(yawDelta * 1000) / 1000,
    pitchDelta: Math.round(pitchDelta * 1000) / 1000,
    backYaw: Math.round(backYaw * 1000) / 1000,
    movedMetres: 0,
    browserErrors: []
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
