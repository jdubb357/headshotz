// Isolated Chrome grader for tiered salvage caches. A real relay deployment
// builds every cache prop through the production RaidView; each authored cache
// tier must carry the shared loot-tier accent, hiding that accent must visibly
// change the frame, and the hero captures show the plain crate before the tier
// detail and the marked crate after it.
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
const account = store.register('cache_tiers_probe', 'a long cache tiers password').id;
const snapshot = runtime.raids.deploy(account, {requestId: 'cache_tiers_probe', mapId: 'relay', recovery: true});
const expected = snapshot.caches.map(c => ({id: c.id, tier: Math.min(5, (Number(c.tier) || 0) + (c.vault ? 1 : 0))}));
const distinct = [...new Set(expected.map(c => c.tier))].sort((a, b) => a - b);
assert.deepEqual(distinct, [0, 1, 2, 3, 4], 'the relay deployment authors every cache tier');

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
    const base = ${JSON.stringify(snapshot)};
    const expected = ${JSON.stringify(expected)};
    document.querySelector('main').hidden = true;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
    document.body.append(canvas);
    const view = new RaidView(canvas);
    view.start(base);
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.sync(base);
    view.updateEnvironment(1);
    const entries = [...view.actors.entries()].filter(([, entry]) => entry.type === 'cache');
    const badges = entries.map(([, entry]) => {
      const source = expected.find(item => item.id === entry.data.id);
      const group = entry.model.userData.cacheTierGroup;
      return {
        id: entry.data.id,
        tier: entry.model.userData.cacheTier,
        accent: entry.model.userData.cacheAccent,
        matches: !!source && source.tier === entry.model.userData.cacheTier,
        children: group ? group.children.length : 0
      };
    });
    const tierCounts = {};
    for (const item of expected) tierCounts[item.tier] = (tierCounts[item.tier] || 0) + 1;
    // Isolated evidence bench: five production cache props, one per tier, on a
    // neutral dark backdrop so the tier accents are measurable without the
    // district's walls and roofs occluding them.
    const {propModel} = await import('./raid-models.mjs');
    const bench = new THREE.Scene();
    bench.background = new THREE.Color(0x111a23);
    bench.add(new THREE.HemisphereLight(0xdff4ff, 0x303834, 2.6));
    const benchSun = new THREE.DirectionalLight(0xffe6b8, 2.4);
    benchSun.position.set(2.4, 5, 3.2);
    bench.add(benchSun);
    const ladder = [0, 1, 2, 3, 4].map(tier => {
      const model = propModel('cache', 0xd8b062, {tier});
      model.position.set((tier - 2) * 1.8, 0, 0);
      bench.add(model);
      return model;
    });
    const benchCamera = new THREE.PerspectiveCamera(48, 480 / 270, .1, 60);
    benchCamera.position.set(0, 2.6, 7.2);
    benchCamera.lookAt(0, .55, 0);
    const target = new THREE.WebGLRenderTarget(480, 270);
    const renderBench = () => {
      view.renderer.setRenderTarget(target);
      view.renderer.clear();
      view.renderer.render(bench, benchCamera);
      const pixels = new Uint8Array(480 * 270 * 4);
      view.renderer.readRenderTargetPixels(target, 0, 0, 480, 270, pixels);
      return pixels;
    };
    const tierEntries = ladder.map((model, tier) => {
      const group = model.userData.cacheTierGroup;
      group.visible = false;
      const before = renderBench();
      group.visible = true;
      const after = renderBench();
      let changed = 0;
      for (let i = 0; i < after.length; i += 4) {
        if (Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]) > 12) changed++;
      }
      return {tier, id: 'bench_' + tier, changed};
    });
    view.renderer.setRenderTarget(null);
    target.dispose();
    window.__cacheTierBench = visible => {
      for (const model of ladder) model.userData.cacheTierGroup.visible = visible;
      view.renderer.setRenderTarget(null);
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(innerWidth, innerHeight, false);
      view.renderer.clear();
      view.renderer.render(bench, benchCamera);
    };
    return {badges, tierCounts, tierEntries};
  })()`);
  assert.deepEqual(page.errors, []);
  assert.equal(result.badges.length, expected.length, 'every authoritative cache has a rendered prop');
  for (const badge of result.badges) {
    const source = expected.find(item => item.id === badge.id);
    assert.ok(source, 'cache prop ' + badge.id + ' maps to an authoritative cache');
    assert.equal(badge.tier, source.tier, badge.id + ' carries the authoritative tier (' + badge.tier + ')');
    assert.equal(badge.accent, lootTierColor(source.tier), badge.id + ' uses the shared tier accent');
    assert.equal(badge.children > 0, true, badge.id + ' carries tier accent geometry');
    assert.equal(badge.matches, true, badge.id + ' matches its authored tier');
  }
  assert.deepEqual(result.tierEntries.map(item => item.tier), [0, 1, 2, 3, 4], 'one production cache prop per tier is rendered');
  for (const item of result.tierEntries) assert.ok(item.changed > 80, 'tier ' + item.tier + ' accent paints ' + item.changed + ' pixels');
  await page.evaluate('window.__cacheTierBench(false)');
  await screenshot(page, '/tmp/hs-cache-tiers-before.png');
  await page.evaluate('window.__cacheTierBench(true)');
  await screenshot(page, '/tmp/hs-cache-tiers.png');
  console.log(JSON.stringify({
    cacheCount: expected.length,
    tierCounts: result.tierCounts,
    tierPixels: result.tierEntries,
    before: '/tmp/hs-cache-tiers-before.png',
    after: '/tmp/hs-cache-tiers.png',
    browserErrors: []
  }));
} finally {
  await h.close();
  await new Promise(resolve => runtime.server.close(resolve));
}
