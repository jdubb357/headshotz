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
    const assets = await import('./assets.js');
    const lootLoaded = await assets.loadLoot();
    const HQP = assets.HQP;
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
      const item = entry.model.userData.lootItem;
      return {
        id: entry.data.id,
        pile: entry.model.userData.lootPile === true,
        glint: !!beacon?.glint?.isSprite,
        oldGem: !!beacon?.gem,
        oldHalo: !!beacon?.halo,
        oldWisp: !!beacon?.wisp,
        oldRing: !!beacon?.ring,
        item: item?.type || null,
        itemMeshes: item?.group ? item.group.children.filter(child => child.isMesh).length : 0
      };
    });
    // The glint reuses one procedural star map and per-actor disposal must never
    // release it. The supply pile must also carry a real loaded loot scan.
    const glints = entries.map(([, entry]) => entry.model.userData.lootBeacon?.glint).filter(Boolean);
    const glintShared = glints.length > 0 && glints.every(glint => glint.material.map === glints[0].material.map);
    const supply = entries.find(([, entry]) => (entry.data.items || []).some(i => i.kind === 'material'));
    const supplyItem = supply?.[1].model.userData.lootItem;
    let sharedMapDisposed = 0;
    if (glints.length) {
      glints[0].material.map.addEventListener('dispose', () => { sharedMapDisposed++; });
      const victim = entries[entries.length - 1][1].model;
      disposeOwned(victim);
      victim.removeFromParent();
    }
    // Presentation animation: only the glint breathes; the item stays planted.
    // Under reduced motion it freezes at a still, readable pose.
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    const actor = entries[0][1].model.userData.lootBeacon;
    view.frame(1000, 0, 0, null, false);
    const moving = {opacity: actor.glint.material.opacity, scale: actor.glint.scale.x, y: actor.glint.position.y};
    view.frame(1700, 0, 0, null, false);
    const animated = Math.abs(actor.glint.material.opacity - moving.opacity) > 1e-4 && Math.abs(actor.glint.scale.x - moving.scale) > 1e-4;
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.frame(2400, 0, 0, null, false);
    const frozen = {opacity: actor.glint.material.opacity, scale: actor.glint.scale.x, y: actor.glint.position.y};
    view.frame(3100, 0, 0, null, false);
    const staticPose = actor.glint.material.opacity === frozen.opacity && actor.glint.scale.x === frozen.scale && actor.glint.position.y === frozen.y && frozen.opacity === .3 && frozen.scale === .32;
    // Isolated evidence bench: real medical-box loot against evidence-only flat
    // piles, so the measured pixel delta reflects the item + its glint.
    const bench = new THREE.Scene();
    bench.background = new THREE.Color(0x101c1a);
    bench.add(new THREE.HemisphereLight(0xdff4ff, 0x303834, 2.6));
    const benchSun = new THREE.DirectionalLight(0xffe6b8, 2.4);
    benchSun.position.set(2.4, 5, 3.2);
    bench.add(benchSun);
    const rowColors = [lootTierColor(1), lootTierColor(3), lootTierColor(4)];
    const row = rowColors.map((color, index) => {
      const model = propModel('loot', color, {visual: 'med'});
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
    return {beacons, lootLoaded, glintShared, supplyItem: supplyItem?.type || null, supplyMeshes: supplyItem?.group ? supplyItem.group.children.filter(child => child.isMesh).length : 0, sharedMapDisposed, animated, staticPose, changed};
  })()`);
  assert.deepEqual(page.errors, []);
  assert.equal(result.lootLoaded, true, 'the real CC0 loot scans decode');
  assert.deepEqual(result.beacons.map(beacon => beacon.id), liveLoot.map(pile => pile.id), 'every visible ground loot pile is rendered');
  for (const beacon of result.beacons) {
    assert.equal(beacon.pile, true, beacon.id + ' is a production loot pile');
    assert.equal(beacon.glint, true, beacon.id + ' carries the subtle pickup glint');
    assert.equal(beacon.oldGem, false, beacon.id + ' no longer carries a floating gem');
    assert.equal(beacon.oldHalo, false, beacon.id + ' no longer carries an additive halo');
    assert.equal(beacon.oldWisp, false, beacon.id + ' no longer carries a light wisp');
    assert.equal(beacon.oldRing, false, beacon.id + ' no longer carries a glowing accent ring');
  }
  assert.equal(result.supplyItem, 'material', 'the field-supply pile shows its real fuel-canister scan');
  assert.equal(result.supplyMeshes > 0, true, 'the field-supply pile is a real mesh, not a flat box');
  assert.equal(result.glintShared, true, 'every loot glint reuses one shared procedural star map');
  assert.equal(result.sharedMapDisposed, 0, 'per-actor disposal never frees the shared loot glint map');
  assert.equal(result.animated, true, 'the pickup glint breathes while running');
  assert.equal(result.staticPose, true, 'reduced motion freezes a still, readable pickup pose');
  assert.ok(result.changed > 500, 'the real loot item plus glint paints ' + result.changed + ' isolated pixels');
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
