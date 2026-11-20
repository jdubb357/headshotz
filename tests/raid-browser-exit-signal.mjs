// Isolated Chrome grader for the Extraction Raid exit signal. Every production
// exit prop carries a presentation-only flare and smoke column. The signal is
// visible only while the authoritative openAt/closeAt window is scheduled, is
// tinted by open/contested state, animates with scene time, freezes under reduced
// motion, and paints a measurable pixel delta. No snapshot, boarding, seat,
// settlement or /api behaviour is exercised or changed by this effect.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const account = store.register('exit_signal_probe', 'a long exit signal password').id;
const snapshot = runtime.raids.deploy(account, {requestId: 'exit_signal_probe', mapId: 'relay', recovery: true});
assert.ok(snapshot.exits.length >= 4, 'the relay deployment exposes four exit kinds');
const now = snapshot.serverTime;
// Fabricate window timings only for the presentation fixture: every exit still
// carries its authored id/kind/coordinates and the server never sees this copy.
const variant = {
  ...snapshot,
  exits: snapshot.exits.map((exit, index) => ({
    ...exit,
    openAt: index === 0 ? now - 5 : index === 1 ? now + 30 : index === 2 ? now - 5 : 0,
    closeAt: index === 0 ? now + 40 : index === 1 ? now + 70 : index === 2 ? now + 40 : 0,
    contested: index === 2
  }))
};
const ids = snapshot.exits.map(exit => exit.id);
const openId = ids[0];
const inboundId = ids[1];
const contestedId = ids[2];
const inactiveId = ids[3];

const h = await browserHarness();
const screenshot = async (page, path) => {
  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(shot.data, 'base64'));
};

try {
  const page = await h.page('/raid-online.html');
  await page.wait(`document.readyState==='complete'`);
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  const result = await page.evaluate(`(async () => {
    const {RaidView} = await import('./raid-view.mjs');
    const THREE = await import('./lib/three.module.min.js');
    const {TX} = await import('./gfx.js');
    const base = ${JSON.stringify(snapshot)};
    const variant = ${JSON.stringify(variant)};
    const exitIds = ${JSON.stringify(ids)};
    const openId = ${JSON.stringify(openId)};
    const inboundId = ${JSON.stringify(inboundId)};
    const contestedId = ${JSON.stringify(contestedId)};
    const inactiveId = ${JSON.stringify(inactiveId)};
    document.querySelector('main').hidden = true;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
    document.body.append(canvas);
    const view = new RaidView(canvas);
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.start(base);
    view.sync(variant);
    const frame = time => view.frame(time, 0, 0, view.snapshot.self);
    frame(2000);
    const exits = new Map();
    for (const [key, entry] of view.actors) {
      if (entry.type !== 'exit') continue;
      exits.set(key, {entry, signal: entry.model.userData.exitSignal});
    }
    const read = () => {
      const out = {};
      for (const [id, {signal}] of exits) {
        out[id] = {
          target: !!signal,
          visible: !!signal?.group?.visible,
          flareVisible: !!signal?.flare?.visible,
          flareColor: signal?.flare?.material.color.getHex(),
          flarePulse: signal?.flare?.material.opacity,
          puffs: signal?.smoke?.map(puff => ({
            x: +puff.position.x.toFixed(4),
            y: +puff.position.y.toFixed(4),
            z: +puff.position.z.toFixed(4),
            opacity: +puff.material.opacity.toFixed(4),
            scale: +puff.scale.x.toFixed(4),
            color: puff.material.color.getHex()
          })) || []
        };
      }
      return out;
    };
    // Animation: scene time advances the smoke column deterministically.
    frame(2500);
    const animatedA = read();
    frame(3000);
    const animatedB = read();
    const positionsOf = state => state[openId].puffs.flatMap(puff => [puff.x, puff.y, puff.z]);
    const beforePositions = positionsOf(animatedA);
    const afterPositions = positionsOf(animatedB);
    let moved = 0;
    for (let i = 0; i < beforePositions.length; i++) if (beforePositions[i] !== afterPositions[i]) moved++;
    // Reduced motion: the same column has to stay still between two clocks.
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    frame(4000);
    const frozenA = read();
    frame(5000);
    const frozenB = read();
    const frozen = JSON.stringify(frozenA) === JSON.stringify(frozenB);
    const frozenFlare = frozenA[openId].flarePulse === frozenB[openId].flarePulse;
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    frame(5500);
    // Shared textures: every puff reuses the one authored smoke map and every
    // flare reuses the cached procedural glow map.
    const allPuffs = exitIds.flatMap(id => exits.get(id)?.signal?.puffs || []);
    const smokeMapShared = allPuffs.every(puff => puff.material.map === TX.smoke);
    const flares = exitIds.map(id => exits.get(id)?.signal?.flare);
    const glowMapShared = flares.every(flare => flare.material.map === flares[0].material.map);
    const puffCount = exits.get(openId).signal.smoke.length;
    const stateA = animatedA;
    // Pixel evidence: render the open exit (the call beacon on the relay map)
    // from a near, elevated camera with and without its signal group.
    const openExit = variant.exits.find(exit => exit.id === openId);
    const heroCamera = new THREE.PerspectiveCamera(70, 480 / 270, .1, 4000);
    heroCamera.position.set(openExit.x + 15, 16, openExit.z + 17);
    heroCamera.lookAt(openExit.x, 9, openExit.z);
    const signal = exits.get(openId).signal;
    const target = new THREE.WebGLRenderTarget(480, 270);
    const render = () => {
      view.renderer.setRenderTarget(target);
      view.renderer.autoClear = true;
      view.renderer.clear();
      view.renderer.render(view.scene, heroCamera);
      const pixels = new Uint8Array(480 * 270 * 4);
      view.renderer.readRenderTargetPixels(target, 0, 0, 480, 270, pixels);
      return pixels;
    };
    for (const [id, entry] of exits) entry.signal.group.visible = false;
    const plainPixels = render();
    for (const [id, entry] of exits) entry.signal.group.visible = false;
    signal.group.visible = true;
    const signalPixels = render();
    let changed = 0;
    for (let i = 0; i < signalPixels.length; i += 4) {
      if (Math.abs(signalPixels[i] - plainPixels[i]) + Math.abs(signalPixels[i + 1] - plainPixels[i + 1]) + Math.abs(signalPixels[i + 2] - plainPixels[i + 2]) > 10) changed++;
    }
    target.dispose();
    const heroRender = show => {
      for (const [id, entry] of exits) entry.signal.group.visible = false;
      if (show) signal.group.visible = true;
      const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .1, 4000);
      cam.position.copy(heroCamera.position);
      cam.lookAt(openExit.x, 9, openExit.z);
      view.renderer.setRenderTarget(null);
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(innerWidth, innerHeight, false);
      view.renderer.autoClear = true;
      view.renderer.clear();
      view.renderer.render(view.scene, cam);
    };
    window.__exitSignalHero = show => heroRender(show);
    heroRender(false);
    return {
      exitIds,
      exits: stateA,
      animateMoved: moved,
      frozen,
      frozenFlare,
      smokeMapShared,
      glowMapShared,
      puffCount,
      changed,
      activeBlue: stateA[openId].flareColor,
      inboundAmber: stateA[inboundId].flareColor,
      contestedRed: stateA[contestedId].flareColor
    };
  })()`);
  assert.deepEqual(page.errors, []);
  assert.deepEqual(Object.keys(result.exits).sort(), ids.slice().sort(), 'every authored exit builds a production signal');
  const openState = result.exits[openId];
  const inboundState = result.exits[inboundId];
  const contestedState = result.exits[contestedId];
  const inactiveState = result.exits[inactiveId];
  assert.equal(openState.target, true, 'open exit carries a signal group');
  assert.equal(openState.visible, true, 'an open exit window vents smoke');
  assert.equal(openState.flareVisible, true, 'an open exit shows its coloured flare');
  assert.equal(inboundState.visible, true, 'a scheduled (inbound) exit vents preparatory smoke');
  assert.equal(inboundState.flareVisible, false, 'no flare before the window opens');
  assert.equal(inactiveState.visible, false, 'a closed call beacon shows no signal');
  assert.equal(inactiveState.flareVisible, false, 'a closed call beacon has no flare');
  assert.equal(openState.flareColor, 0x86efbb, 'open flare uses the exit colour code');
  assert.equal(contestedState.flareColor, 0xff805b, 'contested flare uses the danger colour');
  assert.ok(inboundState.flarePulse < openState.flarePulse, 'inbound smoke/flare is a faint fraction of an open window');
  assert.equal(result.puffCount, 8, 'the smoke column renders eight authored puffs');
  assert.deepEqual(result.exits[openId].puffs.map(puff => puff.color), result.exits[openId].puffs.map(() => 0xd6d0c4), 'open smoke stays neutral');
  assert.deepEqual(result.exits[contestedId].puffs.map(puff => puff.color), result.exits[contestedId].puffs.map(() => 0xffc2b2), 'contested smoke warms');
  assert.ok(result.puffCount === 8 && result.exits[inactiveId].puffs.length === 8, 'inactive exit keeps its pooled puffs');
  assert.ok(result.animateMoved > 8, 'smoke column coordinates advance with scene time (' + result.animateMoved + ' fields)');
  assert.equal(result.frozen, true, 'reduced motion freezes the smoke column');
  assert.equal(result.frozenFlare, true, 'reduced motion freezes the flare pulse');
  assert.equal(result.smokeMapShared, true, 'every smoke puff reuses the authored shared texture');
  assert.equal(result.glowMapShared, true, 'every flare reuses the cached glow map');
  assert.ok(result.changed > 200, 'the signal paints ' + result.changed + ' isolated pixels');
  await page.evaluate('window.__exitSignalHero(false)');
  await screenshot(page, '/tmp/hs-exit-signal-before.png');
  await page.evaluate('window.__exitSignalHero(true)');
  await screenshot(page, '/tmp/hs-exit-signal.png');
  console.log(JSON.stringify({
    exits: ids,
    activeBlue: result.activeBlue,
    inboundAmber: result.inboundAmber,
    contestedRed: result.contestedRed,
    animateMoved: result.animateMoved,
    frozen: result.frozen,
    frozenFlare: result.frozenFlare,
    smokeMapShared: result.smokeMapShared,
    glowMapShared: result.glowMapShared,
    changed: result.changed,
    before: '/tmp/hs-exit-signal-before.png',
    after: '/tmp/hs-exit-signal.png',
    browserErrors: []
  }));
} finally {
  await h.close();
  runtime.server.close();
}
