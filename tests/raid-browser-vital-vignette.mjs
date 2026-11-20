// Isolated Chrome grader for the raid vitality vignette. The screen-edge haze is
// presentation-only: it reads the authoritative self hp/downed fields, follows
// the same <=30/<=60 thresholds as the HUD vitality token, never intercepts
// pointer input, and freezes completely under reduced motion. A real deployment
// proves the live HUD path; exported helpers are then exercised with explicit
// hp fixtures for the boundary states and an isolated pixel delta.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const short = () => Date.now().toString(36).slice(-6);
const shot = async (page, path) => {
  const png = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(png.data, 'base64'));
  return png.data;
};
const readVignette = `(() => {
  const node = document.getElementById('vitalVignette');
  if (!node) return null;
  const style = getComputedStyle(node);
  return {
    state: node.dataset.state ?? null,
    ariaHidden: node.getAttribute('aria-hidden'),
    pointerEvents: style.pointerEvents,
    opacity: style.opacity,
    animationName: style.animationName,
    background: style.backgroundImage,
    rect: node.getBoundingClientRect().toJSON()
  };
})()`;

try {
  const page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('vital_' + short())};document.querySelector('[name=password]').value='a long vitality vignette password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('hud').textContent.includes('HP')`);

  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(operator && raid, 'the UI account deployed into an inspectable raid');
  raid.machines = [];raid.rivals = [];raid.floorLoot = [];raid.bags = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: [], doors: []};
  Object.assign(operator, {x: 0, y: 0, z: 0, hp: 100, alive: true, downed: false, protectedUntil: runtime.raids.now() + 3600, move: {x: 0, z: 0}});
  operator.bag = {items: []}; raid.bags = [];
  await page.wait("!!document.getElementById('vitalVignette')");
  await page.wait("document.getElementById('vitalVignette').dataset.state==='ok'");

  const full = await page.evaluate(readVignette);
  assert.equal(full.state, 'ok', 'full health starts without a wound haze');
  assert.equal(full.opacity, '0', 'the haze is fully transparent at full health');
  assert.equal(full.animationName, 'none', 'a healthy operator never pulses');
  assert.equal(full.pointerEvents, 'none', 'the haze never intercepts controls');
  assert.equal(full.ariaHidden, 'true', 'the decorative haze is hidden from assistive tech');
  assert.equal(full.rect.width, 1280, 'the haze spans the raid viewport');
  assert.equal(full.rect.height, 720, 'the haze spans the raid viewport');

  // Low health, driven through the real action/snapshot loop rather than a
  // fabricated client state. Holding W makes the authoritative move response
  // carry the operator's new hp to updateUI.
  operator.hp = 55;
  await page.evaluate("document.getElementById('view').focus()");
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'KeyW', key: 'w'});
  await page.wait("document.getElementById('vitalVignette').dataset.state==='warn'");
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyW', key: 'w'});
  await new Promise(r => setTimeout(r, 550));
  const low = await page.evaluate(readVignette);
  assert.equal(low.state, 'warn', '60 hp or less raises the warning haze');
  assert.ok(parseFloat(low.opacity) > .3 && parseFloat(low.opacity) < 1, 'the warning haze is visible but restrained (' + low.opacity + ')');
  assert.equal(low.animationName, 'none', 'the warning haze is static');
  assert.match(low.background, /radial-gradient/, 'the haze paints a radial edge gradient');

  operator.hp = 25;
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'ArrowLeft', key: 'ArrowLeft'});
  await page.wait("document.getElementById('vitalVignette').dataset.state==='critical'");
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'ArrowLeft', key: 'ArrowLeft'});
  const critical = await page.evaluate(readVignette);
  assert.equal(critical.state, 'critical', '30 hp or less raises the critical haze');
  assert.equal(critical.animationName, 'vitalPulse', 'critical vitality pulses at full motion');
  await shot(page, '/tmp/hs-vital-vignette-critical.png');

  // Boundary and downed states plus the pure mapping. This uses the exported
  // presentation helper with explicit authoritative-shaped self fixtures; the
  // server snapshot fields above remain the source for the live states.
  const states = await page.evaluate(`(async () => {
    const mod = await import('./raid-online.mjs');
    return {
      at100: mod.vitalVignetteState(100, false),
      at61: mod.vitalVignetteState(61, false),
      at60: mod.vitalVignetteState(60, false),
      at30: mod.vitalVignetteState(30, false),
      at29: mod.vitalVignetteState(29, false),
      downed: mod.vitalVignetteState(0, true),
      unknown: mod.vitalVignetteState(undefined, false)
    };
  })()`);
  assert.deepEqual(states, {at100: 'ok', at61: 'ok', at60: 'warn', at30: 'critical', at29: 'critical', downed: 'downed', unknown: 'ok'}, 'vitality haze follows the HUD thresholds');

  const downed = await page.evaluate(`(async () => {
    const mod = await import('./raid-online.mjs');
    mod.renderVitalVignette({hp: 0, downed: true});
    const node = document.getElementById('vitalVignette');
    return {state: node.dataset.state, animation: getComputedStyle(node).animationName, background: getComputedStyle(node).backgroundImage};
  })()`);
  assert.equal(downed.state, 'downed', 'a downed operator gets the deepest haze');
  assert.equal(downed.animation, 'vitalPulse', 'the downed haze pulses at full motion');
  assert.ok(downed.background.includes('rgb(110, 4, 4)') || downed.background.includes('110, 4, 4'), 'the downed haze uses the deep maroon edge');

  // Reduced motion: the same critical state must remain visible without motion.
  await page.evaluate("const s=document.getElementById('reduceMotion');s.value='on';s.dispatchEvent(new Event('change'))");
  await page.wait("document.documentElement.dataset.reducedMotion==='true'");
  const frozen = await page.evaluate(`(async () => {
    const mod = await import('./raid-online.mjs');
    mod.renderVitalVignette({hp: 0, downed: true});
    const node = document.getElementById('vitalVignette');
    const style = getComputedStyle(node);
    return {state: node.dataset.state, animationName: style.animationName, transition: style.transitionDuration, opacity: style.opacity};
  })()`);
  assert.equal(frozen.state, 'downed', 'reduced motion keeps the severity state');
  assert.equal(frozen.animationName, 'none', 'reduced motion removes the pulse');
  assert.equal(frozen.transition, '0s', 'reduced motion removes the opacity transition');
  assert.equal(frozen.opacity, '1', 'the hazard tint stays visible without animation');

  // Isolated pixel evidence: hide every sibling of the haze so the compared
  // frames differ only by the tint. The scene is hidden and reduced motion is
  // already on, so the tinted frame cannot animate between captures.
  await page.evaluate(`(() => {
    document.getElementById('view').style.display = 'none';
    for (const child of document.getElementById('play').children) if (child.id !== 'vitalVignette') child.style.display = 'none';
  })()`);
  const paint = async hp => {
    await page.evaluate(`(async () => {
      const mod = await import('./raid-online.mjs');
      mod.renderVitalVignette({hp: ${hp}, downed: false});
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    })()`);
  };
  await paint(100);
  const clear64 = (await page.command('Page.captureScreenshot', {format: 'png'})).data;
  await writeFile('/tmp/hs-vital-vignette-clear.png', Buffer.from(clear64, 'base64'));
  await paint(25);
  const tinted = (await page.command('Page.captureScreenshot', {format: 'png'})).data;
  await writeFile('/tmp/hs-vital-vignette-dark.png', Buffer.from(tinted, 'base64'));
  const delta = await page.evaluate(`(async () => {
    const load = source => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = 'data:image/png;base64,' + source;
    });
    const a = await load(${JSON.stringify(clear64)});
    const b = await load(${JSON.stringify(tinted)});
    const canvas = document.createElement('canvas');
    canvas.width = a.width; canvas.height = a.height;
    const context = canvas.getContext('2d');
    context.drawImage(a, 0, 0);
    const first = context.getImageData(0, 0, a.width, a.height).data;
    context.clearRect(0, 0, a.width, a.height);
    context.drawImage(b, 0, 0);
    const second = context.getImageData(0, 0, a.width, a.height).data;
    let changed = 0, redder = 0;
    for (let i = 0; i < first.length; i += 4) {
      const dr = second[i] - first[i], dg = second[i + 1] - first[i + 1], db = second[i + 2] - first[i + 2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 12) changed++;
      if (dr > 16 && dr > dg && dr > db) redder++;
    }
    return {width: a.width, height: a.height, changed, redder, at: null};
  })()`);
  assert.equal(delta.width, 1280, 'the isolated capture keeps the desktop viewport');
  assert.ok(delta.changed > 20000, 'the critical haze paints a measurable edge delta (' + delta.changed + ' px)');
  assert.ok(delta.redder > 10000, 'the haze delta is predominantly red (' + delta.redder + ' px)');

  const errors = page.errors;
  assert.deepEqual(errors, [], 'the browser printed no errors');
  console.log(JSON.stringify({
    full: full.state, warn: low.state, critical: critical.state, downed: downed.state,
    reducedAnimation: frozen.animationName, delta, screenshots: ['/tmp/hs-vital-vignette-clear.png', '/tmp/hs-vital-vignette-dark.png', '/tmp/hs-vital-vignette-critical.png'],
    browserErrors: errors
  }));
} finally {
  await h.close();
  runtime.server.close();
}
