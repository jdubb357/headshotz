// Isolated Chrome grader for storm-front lightning in Extraction Raids. A real
// relay deployment drives the production RaidView through rain conditions; the
// deterministic pulse must lift the sky sheet and existing sun/hemisphere
// lights only during a rain front, stay frozen under reduced motion, and never
// paint under clear skies. Presentation-only: snapshot, rules, transport and
// `serverTime` are untouched.
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
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const account = store.register('lightning_probe', 'a long lightning probe password').id;
const snapshot = runtime.raids.deploy(account, {requestId: 'lightning_probe', mapId: 'relay', recovery: true});

const h = await browserHarness();
const screenshot = async (p, path) => {
  const shot = await p.command('Page.captureScreenshot', {format: 'png'});
  await writeFile(path, Buffer.from(shot.data, 'base64'));
};

try {
  const p = await h.page();
  await p.wait("document.readyState==='complete'");
  await p.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  const result = await p.evaluate(`(async () => {
    const {RaidView, lightningPulse} = await import('./raid-view.mjs');
    const THREE = await import('./lib/three.module.min.js');
    const base = ${JSON.stringify(snapshot)};
    const variant = conditions => ({...base, conditions: {...base.conditions, ...conditions}});
    const clear = variant({weather: 'clear', daylight: 1, sky: 0x91b8ca, fog: 0xb4ccd0, light: 2, ambient: 1.8, visibility: 1});
    const rain = variant({weather: 'rain', daylight: .45, sky: 0x657f8e, fog: 0x6d8790, light: 1.3, ambient: 1.4, visibility: .7, sun: {x: -38, y: 9, z: 35}});

    document.querySelector('main').hidden = true;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
    document.body.append(canvas);
    const view = new RaidView(canvas);
    view.start(rain);
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.updateEnvironment(1);

    // Pure pulse: deterministic, rain-only, and quiet between strikes.
    const pulse = {
      quiet: lightningPulse(.6, 'rain'),
      peak: lightningPulse(1.1, 'rain'),
      sheet: lightningPulse(1.38, 'rain'),
      gap: lightningPulse(5.2, 'rain'),
      clear: lightningPulse(1.1, 'clear'),
      ash: lightningPulse(1.1, 'ash'),
      repeat: lightningPulse(1.1, 'rain') === lightningPulse(1.1, 'rain'),
      cycle: lightningPulse(9.6, 'rain') === lightningPulse(1.1, 'rain')
    };

    view.sync(rain);
    view.updateEnvironment(1);
    const uniforms = view.skyDome.material.uniforms;
    view.updateAtmosphere(.6);
    const quiet = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity, hemi: view.hemi.intensity, hemiColor: view.hemi.color.getHex()};
    view.updateAtmosphere(1.1);
    const flash = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity, hemi: view.hemi.intensity, hemiColor: view.hemi.color.getHex()};
    view.updateAtmosphere(1.38);
    const sheet = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity};
    view.updateAtmosphere(5.2);
    const gap = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity, hemi: view.hemi.intensity, hemiColor: view.hemi.color.getHex()};

    // The production frame loop is the only driver on a live page.
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.frame(1100, 0, 0, null, false);
    const frameFlash = uniforms.uFlash.value;
    view.frame(5200, 0, 0, null, false);
    const frameGap = uniforms.uFlash.value;

    // Reduced motion freezes the pulse to zero and restores the neutral lights.
    view.applySettings({reduced: true, sfxVolume: 0, fov: 75, viewMode: 'third'});
    view.updateAtmosphere(1.1);
    const reduced = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity, hemi: view.hemi.intensity, hemiColor: view.hemi.color.getHex()};
    view.applySettings({reduced: false, sfxVolume: 0, fov: 75, viewMode: 'third'});

    // Clear weather never flashes even at the rain-strike clock offsets.
    view.sync(clear); view.updateEnvironment(1); view.updateAtmosphere(1.1);
    const clearState = {uFlash: uniforms.uFlash.value, sun: view.sun.intensity, hemi: view.hemi.intensity, hemiColor: view.hemi.color.getHex()};

    // Isolated sky evidence: one camera, the same rain sky, flash on versus off.
    view.sync(rain); view.updateEnvironment(1);
    view.renderer.setPixelRatio(1);
    const skyCam = new THREE.PerspectiveCamera(70, 320 / 180, .1, 4000);
    skyCam.position.set(0, 40, 0);
    skyCam.lookAt(new THREE.Vector3(0, 140, -40));
    const target = new THREE.WebGLRenderTarget(320, 180);
    const readSky = () => {
      const data = new Uint8Array(320 * 180 * 4);
      view.renderer.setRenderTarget(target);
      view.renderer.render(view.scene, skyCam);
      view.renderer.readRenderTargetPixels(target, 0, 0, 320, 180, data);
      view.renderer.setRenderTarget(null);
      return data;
    };
    view.updateAtmosphere(.6);
    const skyQuiet = readSky();
    view.updateAtmosphere(1.1);
    const skyFlash = readSky();
    target.dispose();
    let changed = 0, brightness = 0;
    for (let i = 0; i < skyQuiet.length; i += 4) {
      const before = skyQuiet[i] + skyQuiet[i + 1] + skyQuiet[i + 2];
      const after = skyFlash[i] + skyFlash[i + 1] + skyFlash[i + 2];
      if (Math.abs(skyFlash[i] - skyQuiet[i]) + Math.abs(skyFlash[i + 1] - skyQuiet[i + 1]) + Math.abs(skyFlash[i + 2] - skyQuiet[i + 2]) > 6) changed++;
      brightness += after - before;
    }
    // Screenshot evidence at street level: one quiet rain frame and one strike.
    window.__lightningProbe = (seconds) => {
      view.sync(rain); view.updateEnvironment(1); view.updateAtmosphere(seconds);
      const hero = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 4000);
      hero.position.set(300, 2.1, 3);
      hero.lookAt(new THREE.Vector3(-300, 2.1, 3));
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(innerWidth, innerHeight, false);
      view.renderer.autoClear = true;
      view.renderer.setRenderTarget(null);
      view.renderer.clear();
      view.renderer.render(view.scene, hero);
    };
    return {pulse, quiet, flash, sheet, gap, frameFlash, frameGap, reduced, clear: clearState, pixels: {changed, brightness}};
  })()`);

  assert.ok(result.pulse.quiet < 1e-9, 'no lightning before the strike');
  assert.ok(result.pulse.peak > .95, 'the primary strike reaches full brightness (' + result.pulse.peak.toFixed(2) + ')');
  assert.ok(result.pulse.sheet > .5, 'a softer follow-up sheet trails the strike (' + result.pulse.sheet.toFixed(2) + ')');
  assert.ok(result.pulse.gap < .02, 'the 8.5 s cycle closes back to darkness (' + result.pulse.gap.toFixed(3) + ')');
  assert.equal(result.pulse.clear, 0, 'clear weather never flashes');
  assert.equal(result.pulse.ash, 0, 'ash fronts never flash');
  assert.equal(result.pulse.repeat, true, 'the pulse is deterministic for the same scene time');
  assert.equal(result.pulse.cycle, true, 'the pulse repeats on the authored 8.5 s cycle');
  assert.ok(result.quiet.uFlash < 1e-9 && result.quiet.sun > 0, 'a quiet rain frame keeps the sky uniform off and lights on');
  assert.ok(result.flash.uFlash > .95, 'the sky sheet reaches full flash strength');
  assert.ok(result.flash.sun > result.quiet.sun + 1.8, 'existing sun light brightens during the strike (' + result.quiet.sun.toFixed(2) + ' → ' + result.flash.sun.toFixed(2) + ')');
  assert.ok(result.flash.hemi > result.quiet.hemi + .9, 'existing hemisphere fill brightens during the strike');
  assert.notEqual(result.flash.hemiColor, result.quiet.hemiColor, 'the hemisphere tint cools toward the flash colour');
  assert.ok(result.sheet.uFlash > .5 && result.sheet.uFlash < 1, 'the follow-up sheet is dimmer than the primary strike');
  assert.ok(result.gap.uFlash < 1e-9, 'the gap after the strike is fully dark');
  assert.equal(result.gap.sun, result.quiet.sun, 'sun light returns to its authored rain level');
  assert.equal(result.gap.hemiColor, result.quiet.hemiColor, 'the hemisphere tint returns to neutral');
  assert.ok(result.frameFlash > .95, 'the production frame loop drives the same flash');
  assert.ok(result.frameGap < 1e-9, 'the production frame loop clears the flash');
  assert.ok(result.reduced.uFlash < 1e-9, 'reduced motion disables lightning');
  assert.equal(result.reduced.sun, result.quiet.sun, 'reduced motion restores the unflashed sun level');
  assert.equal(result.reduced.hemi, result.quiet.hemi, 'reduced motion restores the unflashed hemisphere fill');
  assert.equal(result.reduced.hemiColor, result.quiet.hemiColor, 'reduced motion keeps the neutral hemisphere tint');
  assert.ok(result.clear.uFlash < 1e-9, 'clear weather leaves the flash uniform at zero');
  assert.equal(result.clear.hemiColor, result.quiet.hemiColor, 'clear weather keeps the neutral hemisphere tint');
  assert.ok(result.pixels.changed > 20000, 'lightning repaints the overhead sky measurably (' + result.pixels.changed + ' px)');
  assert.ok(result.pixels.brightness > 200000, 'lightning lifts total sky brightness (' + result.pixels.brightness + ')');

  await p.evaluate("window.__lightningProbe(.6)");
  await new Promise(r => setTimeout(r, 260));
  await screenshot(p, '/tmp/hs-lightning-before.png');
  await p.evaluate("window.__lightningProbe(1.1)");
  await new Promise(r => setTimeout(r, 260));
  await screenshot(p, '/tmp/hs-lightning.png');
  await p.evaluate("(()=>{delete window.__lightningProbe})()");
  assert.deepEqual(p.errors, []);
  console.log(JSON.stringify({
    pulse: result.pulse,
    quiet: result.quiet,
    flash: result.flash,
    sheet: result.sheet,
    gap: result.gap,
    reducedMotion: result.reduced,
    clear: result.clear,
    pixels: result.pixels,
    screenshots: ['/tmp/hs-lightning-before.png', '/tmp/hs-lightning.png'],
    browserErrors: p.errors
  }));
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
