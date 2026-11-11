// Isolated Chrome grader for the machine-enemy detail pass. The production
// RaidView sync path must build all five machine classes with a procedural worn
// plating map, a core halo sprite and each class's silhouette features. An
// isolated evidence bench renders the plain (former) and detailed models for
// every class and proves the detail pass changes measurable pixels. Hero
// captures show the former generic machines before and the detailed machines
// after.
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
const account = store.register('machine_models_probe', 'a long machine models password').id;
const snapshot = runtime.raids.deploy(account, {requestId: 'machine_models_probe', mapId: 'relay', recovery: true});
assert.ok(snapshot.machines.length >= 1, 'the relay deployment populates machine actors');
assert.ok(snapshot.machines.some(m => m.kind === 'scout'), 'the relay deployment includes the scout class');

const EXPECTED = {
  scout: ['antenna', 'side-fins', 'lens-housing'],
  hunter: ['dorsal-ridge', 'sensor-mast', 'shoulder-cowls', 'hip-fins', 'head-lens'],
  heavy: ['hazard-chevrons', 'rear-vents', 'shoulder-plates', 'piston-stacks'],
  flyer: ['rotor-blades', 'belly-sensor', 'rear-thruster', 'landing-struts'],
  overlord: ['crown-spikes', 'chest-vents', 'shoulder-pylons']
};
const KINDS = Object.keys(EXPECTED);

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
    const {machineModel, updateActor} = await import('./raid-models.mjs');
    const THREE = await import('./lib/three.module.min.js');
    const base = ${JSON.stringify(snapshot)};
    const expected = ${JSON.stringify(EXPECTED)};
    const kinds = ${JSON.stringify(KINDS)};
    document.querySelector('main').hidden = true;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
    document.body.append(canvas);
    const view = new RaidView(canvas);
    view.start(base);
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75});
    // Production sync path: real relay machines stay in the snapshot alongside
    // one synthetic machine per class so every constructor is exercised.
    const state = structuredClone(base);
    state.machines = [...state.machines, ...kinds.map((kind, i) => ({
      id: 'grader_machine_' + kind,
      kind,
      x: base.self.x + 9 + i * 2.5,
      y: base.self.y,
      z: base.self.z + 12,
      hp: 120,
      state: 'windup',
      yaw: 0
    }))];
    view.sync(state);
    const entries = [...view.actors.entries()].filter(([, entry]) => entry.type === 'machine');
    const inspected = entries.map(([key, entry]) => {
      const model = entry.model;
      let worn = 0, haloMap = null;
      model.traverse(node => {
        if (node.isMesh && node.material?.map && node.material.userData?.raidWorn) worn++;
        if (node.isSprite && node.material?.map) haloMap = node.material.map;
      });
      return {
        id: key,
        kind: model.userData.kind,
        detail: model.userData.machineDetail || null,
        core: !!model.userData.core,
        halo: !!model.userData.core?.userData.halo,
        haloIsSprite: model.userData.core?.userData.halo?.isSprite === true,
        haloHasMap: !!haloMap,
        wornMeshes: worn
      };
    });
    // Evidence bench: one plain and one detailed model per class, rendered in
    // isolation so the worn map, halo and silhouette geometry all contribute to
    // a per-class pixel delta on a neutral dark backdrop.
    const bench = new THREE.Scene();
    bench.background = new THREE.Color(0x111a23);
    bench.add(new THREE.HemisphereLight(0xdff4ff, 0x303834, 2.6));
    const sun = new THREE.DirectionalLight(0xffe6b8, 2.6);
    sun.position.set(3.4, 8, 4.2);
    bench.add(sun);
    const rim = new THREE.DirectionalLight(0x9ddcff, 1.3);
    rim.position.set(-4, 2.4, -3);
    bench.add(rim);
    const plain = {}, detailed = {};
    for (const kind of kinds) {
      plain[kind] = machineModel(kind, {plain: true});
      detailed[kind] = machineModel(kind);
      bench.add(plain[kind]);
      bench.add(detailed[kind]);
      updateActor(detailed[kind], {x: 0, y: 0, z: 0, hp: 120, state: 'patrol', reduced: false}, 0.016, 1000);
    }
    const all = [...Object.values(plain), ...Object.values(detailed)];
    for (const model of all) model.visible = false;
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 80);
    camera.position.set(0, 4.5, 20);
    camera.lookAt(0, 2.4, 0);
    const target = new THREE.WebGLRenderTarget(640, 360);
    const renderTarget = model => {
      for (const actor of all) actor.visible = actor === model;
      view.renderer.setRenderTarget(target);
      view.renderer.clear();
      view.renderer.render(bench, camera);
      const pixels = new Uint8Array(640 * 360 * 4);
      view.renderer.readRenderTargetPixels(target, 0, 0, 640, 360, pixels);
      return pixels;
    };
    const deltas = kinds.map(kind => {
      const before = renderTarget(plain[kind]);
      const after = renderTarget(detailed[kind]);
      let changed = 0;
      for (let i = 0; i < after.length; i += 4) {
        if (Math.abs(after[i] - before[i]) + Math.abs(after[i + 1] - before[i + 1]) + Math.abs(after[i + 2] - before[i + 2]) > 12) changed++;
      }
      return {kind, changed};
    });
    // Shared maps/textures: two machines of the same class must reuse the same
    // worn plating texture instead of allocating one per actor.
    const tribA = machineModel('scout'), tribB = machineModel('scout');
    const mapA = tribA.children.find(node => node.material?.userData?.raidWorn)?.material.map;
    const mapB = tribB.children.find(node => node.material?.userData?.raidWorn)?.material.map;
    const wornMapShared = !!mapA && mapA === mapB;
    // Lay out both rows side by side for inspection screenshots; the event only
    // toggles visibility so the production camera view is never touched.
    const rowX = kinds.map((_, i) => (i - 2) * 3.2);
    for (const kind of kinds) {
      plain[kind].position.set(rowX[kinds.indexOf(kind)], 0, 0);
      detailed[kind].position.set(rowX[kinds.indexOf(kind)], 0, 0);
    }
    view.renderer.setRenderTarget(null);
    target.dispose();
    window.__machineBench = visible => {
      for (const kind of kinds) {
        plain[kind].visible = !visible;
        detailed[kind].visible = visible;
      }
      view.renderer.setRenderTarget(null);
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(innerWidth, innerHeight, false);
      view.renderer.clear();
      view.renderer.render(bench, camera);
    };
    return {inspected, deltas, wornMapShared};
  })()`);
  assert.deepEqual(page.errors, []);
  const inspected = result.inspected;
  for (const kind of KINDS) {
    const actor = inspected.find(item => item.kind === kind && item.id === 'grader_machine_' + kind);
    assert.ok(actor, 'production sync constructs the ' + kind + ' machine');
    assert.ok(actor.detail, kind + ' publishes machine detail metadata');
    assert.equal(actor.detail.worn, true, kind + ' carries worn plating');
    assert.equal(actor.detail.halo, true, kind + ' carries a core halo');
    assert.equal(actor.core, true, kind + ' retains its authoritative core');
    assert.equal(actor.halo, true, kind + ' retains the additive core halo');
    assert.equal(actor.haloIsSprite, true, kind + ' halo is a camera-facing sprite');
    assert.equal(actor.haloHasMap, true, kind + ' halo uses the procedural glow map');
    assert.ok(actor.wornMeshes > 0, kind + ' hulls use the worn plating material');
    assert.deepEqual(actor.detail.features, EXPECTED[kind], kind + ' exposes its silhouette features');
    assert.ok(actor.detail.detailCount >= EXPECTED[kind].length, kind + ' silhouette parts are built');
  }
  const relayScout = inspected.find(item => item.kind === 'scout' && item.id !== 'grader_machine_scout');
  assert.ok(relayScout, 'the authoritative relay scout is rendered and detailed too');
  assert.equal(relayScout.detail.worn, true);
  assert.equal(result.wornMapShared, true, 'the worn plating texture is shared between machines');
  console.log('detail deltas', JSON.stringify(result.deltas));
  for (const delta of result.deltas) assert.ok(delta.changed > 200, delta.kind + ' detail pass paints ' + delta.changed + ' pixels');
  await page.evaluate('window.__machineBench(false)');
  await screenshot(page, '/tmp/hs-machine-models-before.png');
  await page.evaluate('window.__machineBench(true)');
  await screenshot(page, '/tmp/hs-machine-models-after.png');
  console.log(JSON.stringify({
    machines: inspected.map(item => ({id: item.id, kind: item.kind, wornMeshes: item.wornMeshes, features: item.detail.features})),
    detailPixels: result.deltas,
    wornMapShared: result.wornMapShared,
    before: '/tmp/hs-machine-models-before.png',
    after: '/tmp/hs-machine-models-after.png',
    browserErrors: []
  }));
} finally {
  await h.close();
  await new Promise(resolve => runtime.server.close(resolve));
}
