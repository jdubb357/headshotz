// Isolated Chrome grader for ground-loot pickup beacons. A real relay deployment
// builds its authored ground drops through the production RaidView; every live
// pile must carry the presentation-only beacon (shared texture/geometry), the
// beacon must animate while reduced motion freezes it, and an isolated bench
// measures the visibility delta against the former flat piles.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {lootTierColor} from '../shared/raid-loot-presentation.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const account = store.register('loot_beacon_probe', 'a long loot beacon password').id;
const snapshot = runtime.raids.deploy(account, {requestId: 'loot_beacons_probe', mapId: 'relay', recovery: true});
const liveLoot = snapshot.loot || [];
assert.ok(liveLoot.length > 0, 'the relay deployment shows authored ground loot near spawn');
const accentOf = (pile) => {
  const items = pile.items || [];
  const rarity = items.reduce((max, item) => Math.max(max, Math.max(0, Math.min(5, Math.trunc(Number(item.rarity) || 0)))), 0);
  return lootTierColor(rarity);
};

const h = await browserHarness();
const screenshot = async (p, path) => {
  const shot = await p.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(shot.data, 'base64'));
};

try {
  const page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  await page.wait(`document.readyState==='complete'`);
  const result = await page.evaluate(`(async () => {
    const {RaidView} = await import('./raid-view.mjs');
    const THREE = await import('./lib/three.module.min.js');
    const {propModel} = await import('./raid-models.mjs');
    const {lootTierColor} = await import('./shared/raid-loot-presentation.mjs');
    const {disposeOwned} = await import('./raid-models.mjs');
    const base = ${JSON.stringify(snapshot)};
    const expected = ${JSON.stringify(liveLoot.map(pile => ({id: pile.id, accent: accentOf(pile)})))};
    document.querySelector('main').hidden = true;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
    document.body.append(canvas);
    const view = new RaidView(canvas);
    view.start(base);
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.sync(base);
    const entries = [...view.actors.entries()].filter(([, entry]) => entry.type === 'loot');
    const beacons = entries.map(([key, entry]) => {
      const beacon = entry.model.userData.lootBeacon;
      const source = expected.find(item => item.id === entry.data.id);
      return {
        id: entry.data.id,
        pile: entry.model.userData.lootPile === true,
        beacon: !!beacon,
        gem: !!beacon?.gem,
        halo: !!beacon?.halo?.isSprite,
        wisp: !!beacon?.wisp,
        ring: !!beacon?.ring,
        accent: Number(beacon?.ring?.material?.color?.getHex?.()) || null,
        sourceAccent: source ? source.accent : null
      };
    });
    // The animated beacon reuses one procedural glow map and one gem geometry,
    // and per-actor disposal must never release that shared map.
    const halos = entries.map(([, entry]) => entry.model.userData.lootBeacon?.halo).filter(Boolean);
    const glowShared = halos.length > 0 && halos.every(halo => halo.material.map === halos[0].material.map);
    const gemShared = entries.length > 0 && entries.every(([, entry]) => entry.model.userData.lootBeacon?.gem?.geometry === entries[0][1].model.userData.lootBeacon?.gem?.geometry);
    let sharedMapDisposed = 0;
    if (halos.length) {
      halos[0].material.map.addEventListener('dispose', () => { sharedMapDisposed++; });
      const victim = entries[entries.length - 1][1].model;
      disposeOwned(victim);
      victim.removeFromParent();
    }
    // Presentation animation: gem hover/turn while running, frozen still pose
    // under reduced motion. Values are read after two production frames.
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    const actor = entries[0][1].model.userData.lootBeacon;
    view.frame(1000, 0, 0, null, false);
    const moving = {y: actor.gem.position.y, rot: actor.gem.rotation.y, ring: actor.ring.material.opacity};
    view.frame(1700, 0, 0, null, false);
    const animated = Math.abs(actor.gem.position.y - moving.y) > 1e-4 && Math.abs(actor.gem.rotation.y - moving.rot) > 1e-4;
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.frame(2400, 0, 0, null, false);
    const frozen = {y: actor.gem.position.y, rot: actor.gem.rotation.y, ring: actor.ring.material.opacity};
    view.frame(3100, 0, 0, null, false);
    const staticPose = Math.abs(actor.gem.position.y - frozen.y) < 1e-6 && Math.abs(actor.gem.rotation.y - frozen.rot) < 1e-6 && actor.gem.position.y === .95;
    // Isolated evidence bench: production piles versus evidence-only flat piles,
    // laid out on three rarities so the accent ladder is measurable.
    const bench = new THREE.Scene();
    bench.background = new THREE.Color(0x101c1a);
    bench.add(new THREE.HemisphereLight(0xdff4ff, 0x303834, 2.6));
    const benchSun = new THREE.DirectionalLight(0xffe6b8, 2.4);
    benchSun.position.set(2.4, 5, 3.2);
    bench.add(benchSun);
    // Drop heart-stem motion: the beam group is a still frame for evidence.
    const rowColors = [lootTierColor(1), lootTierColor(3), lootTierColor(4)];
    const row = rowColors.map((color, index) => {
      const model = propModel('loot', color);
      model.position.set((index - 1) * 1.6, 0, 0);
      bench.add(model);
      return model;
    });
    const flat = rowColors.map((color, index) => {
      const model = propModel('loot', color, {plain: true});
      model.position.set((index - 1) * 1.6, 0, 0);
      model.visible = false;
      bench.add(model);
      return model;
    });
    const benchCamera = new THREE.PerspectiveCamera(45, 480 / 270, .1, 40);
    benchCamera.position.set(0, 1.75, 4.6);
    benchCamera.lookAt(0, .65, 0);
    const target = new THREE.WebGLRenderTarget(480, 270);
    const renderBench = () => {
      view.renderer.setRenderTarget(target);
      view.renderer.clear();
      view.renderer.render(bench, benchCamera);
      const pixels = new Uint8Array(480 * 270 * 4);
      view.renderer.readRenderTargetPixels(target, 0, 0, 480, 270, pixels);
      return pixels;
    };
    for (const model of row) model.visible = false;
    for (const model of flat) model.visible = true;
    const flatPixels = renderBench();
    for (const model of flat) model.visible = false;
    for (const model of row) model.visible = true;
    const beaconPixels = renderBench();
    let changed = 0;
    for (let i = 0; i < beaconPixels.length; i += 4) {
      if (Math.abs(beaconPixels[i] - flatPixels[i]) + Math.abs(beaconPixels[i + 1] - flatPixels[i + 1]) + Math.abs(beaconPixels[i + 2] - flatPixels[i + 2]) > 12) changed++;
    }
    target.dispose();
    const screenBench = () => {
      view.renderer.setRenderTarget(null);
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(innerWidth, innerHeight, false);
      view.renderer.clear();
      view.renderer.render(bench, benchCamera);
    };
    window.__lootPileBench = plain => {
      for (const model of flat) model.visible = plain;
      for (const model of row) model.visible = !plain;
      screenBench();
    };
    return {beacons, glowShared, gemShared, sharedMapDisposed, animated, staticPose, changed};
  })()`);
  assert.deepEqual(page.errors, []);
  assert.deepEqual(result.beacons.map(beacon => beacon.id), liveLoot.map(pile => pile.id), 'every visible ground loot pile is rendered');
  for (const beacon of result.beacons) {
    assert.equal(beacon.pile, true, beacon.id + ' is a production loot pile');
    assert.equal(beacon.beacon, true, beacon.id + ' carries a pickup beacon');
    assert.equal(beacon.gem, true, beacon.id + ' carries a floating gem');
    assert.equal(beacon.halo, true, beacon.id + ' carries an additive halo');
    assert.equal(beacon.wisp, true, beacon.id + ' carries a light wisp');
    assert.equal(beacon.ring, true, beacon.id + ' carries an accent ring');
    assert.equal(beacon.accent, beacon.sourceAccent, beacon.id + ' uses the authoritative pile rarity accent');
  }
  assert.equal(result.glowShared, true, 'every loot beacon reuses one shared procedural glow map');
  assert.equal(result.gemShared, true, 'every loot beacon reuses one shared gem geometry');
  assert.equal(result.sharedMapDisposed, 0, 'per-actor disposal never frees the shared loot glow map');
  assert.equal(result.animated, true, 'the pickup gem hovers and turns while running');
  assert.equal(result.staticPose, true, 'reduced motion freezes a still, readable pickup pose');
  assert.ok(result.changed > 700, 'the pickup beacon paints ' + result.changed + ' isolated pixels');
  await page.evaluate('window.__lootPileBench(true)');
  await screenshot(page, '/tmp/hs-loot-beacons-before.png');
  await page.evaluate('window.__lootPileBench(false)');
  await screenshot(page, '/tmp/hs-loot-beacons.png');
  console.log(JSON.stringify({
    lootCount: liveLoot.length,
    beacons: result.beacons,
    glowShared: result.glowShared,
    gemShared: result.gemShared,
    sharedMapDisposed: result.sharedMapDisposed,
    animated: result.animated,
    staticPose: result.staticPose,
    changed: result.changed,
    before: '/tmp/hs-loot-beacons-before.png',
    after: '/tmp/hs-loot-beacons.png',
    browserErrors: []
  }));
} finally {
  await h.close();
  await new Promise(resolve => runtime.server.close(resolve));
}
