// Isolated Chrome grader for the authoritative weak-point core burst. A real
// deployment fires at a machine core through the shipped client; the server
// token must report the core coordinate that the client spawns the pooled burst
// at, with no burst on a miss or after a reconnect baseline. An isolated frame
// bench proves the burst paints measurable pixels, and reduced motion keeps a
// static readable flash/ring instead of animated sparks or a light wash.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore(), runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness(), sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (p, code, down = true) => p.command('Input.dispatchKeyEvent', {type: down ? 'keyDown' : 'keyUp', code, key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code});
const shot = async (p, path) => {const png = await p.command('Page.captureScreenshot', {format: 'png'}); await writeFile(path, Buffer.from(png.data, 'base64'))};
let page;
try {
  const p = page = await h.page();
  await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await p.evaluate("document.querySelector('[name=username]').value='weak_vfx_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long weak vfx browser password';document.getElementById('register').click()");
  await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  const profile = await p.evaluate("fetch('/api/profile').then(r=>r.json())");
  // Observe the production spawn path and retain the live view/effect handles.
  await p.evaluate(`(async()=>{const {RaidView}=await import('./raid-view.mjs');const priorStart=RaidView.prototype.start,priorBurst=RaidView.prototype.spawnCoreBurst;window.__coreBurstCalls=[];window.__lastCoreBurst=null;
    RaidView.prototype.start=function(...args){const result=priorStart.apply(this,args);window.__raidView=this;return result};
    RaidView.prototype.spawnCoreBurst=function(x,y,z,now){window.__raidView=this;const effect=priorBurst.call(this,x,y,z,now);window.__lastCoreBurst=effect;window.__coreBurstCalls.push({x,y,z});return effect}})()`);
  await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()");
  await p.wait("document.getElementById('play').style.display==='block' && window.__raidView?.snapshot && document.body.getAttribute('aria-busy')==='false'");
  const player = runtime.raids.byAccount.get(profile.id), raid = runtime.raids.raids.get(player.raidId);
  assert.ok(player.weaponId, 'the UI deployment equipped a usable weapon');
  raid.machines = []; raid.rivals = []; raid.machines.push({
    id: 'weak_vfx_machine', kind: 'hunter', x: 0, y: 0.35, z: 4, hp: 120, maxHp: 140,
    state: 'windup', yaw: 0, nextAttack: 9999999999,
    attack: {at: 9999999999, point: {x: 0, y: 0, z: 4}, radius: 1.15}
  });
  raid.world = {...raid.world, blocks: [], ramps: []};
  Object.assign(player, {x: 0, y: 0, z: 0, yaw: 0, pitch: 0, move: {x: 0, z: 0}, protectedUntil: 0});
  await p.evaluate("document.getElementById('view').focus()");
  await sleep(700);
  await shot(p, '/tmp/hs-weak-hit-vfx-before.png'); // framed weak machine before the hit

  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.getElementById('hitmarker').dataset.kind==='weak' && window.__coreBurstCalls.length>0");
  const calls = await p.evaluate("window.__coreBurstCalls");
  assert.equal(calls.length, 1, 'one weak token spawns exactly one core burst');
  assert.ok(Math.abs(calls[0].x) < 1e-9 && Math.abs(calls[0].y - 1.55) < 1e-6 && calls[0].z === 4, 'the burst anchors to the authoritative hunter core');
  const token = await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.hit)");
  assert.equal(token.weak, true);
  assert.equal(token.kill, false);
  assert.deepEqual(token.core, calls[0], 'the spawn coordinate matches the server token core');
  // Force the pooled burst to its 60 ms mid-flash frame for deterministic
  // inspection even if the real-time presentation has already advanced.
  const live = await p.evaluate(`(()=>{const v=window.__raidView,e=window.__lastCoreBurst,now=(e?.started??performance.now())+60;v.updateCombatEffects(now);
    return {pool:v.coreBurstEffects.length,started:e?.started??null,origin:e?.origin.toArray()??null,flashVisible:!!e?.flash.visible,flashOpacity:e?.flash.material.opacity??0,ringVisible:!!e?.ring.visible,ringOpacity:e?.ring.material.opacity??0,ringScale:e?.ring.scale.x??0,ringColor:e?.ring.material.color.getHex()??0,ringCameraFacing:!!e?.ring&&e.ring.quaternion.dot(v.camera.quaternion)>1-1e-4,ringAdditive:e?.ring.material.blending===2,sparksVisible:!!e?.sparks.visible,sparksOpacity:e?.sparks.material.opacity??0,sparkCount:e?.burstSparks??0,sparkMoves:!!e&&Array.from(e.sparks.geometry.attributes.position.array).some(v=>Math.abs(v)>.001),lightVisible:!!e?.light.visible,lightIntensity:e?.light.intensity??0,lightColor:e?.light.color.getHex()??0,lightDistance:e?.light.distance??0,poolLightCount:v.scene.children.filter(o=>o.isPointLight&&o.userData.raidCoreBurstLight).length,owned:[!!e&&[e.flash,e.ring,e.sparks,e.light].every(o=>o.material?.userData?.raidOwned||o.geometry?.userData?.raidOwned||o.userData?.raidOwned)]};})()`);
  assert.equal(live.pool, 4, 'core bursts reuse a fixed production pool');
  assert.ok(live.started, 'the production pool effect is live');
  assert.equal(live.flashVisible, true, 'the core burst shows an additive flash');
  assert.equal(live.ringVisible, true, 'the core burst shows a shock ring');
  assert.ok(live.ringScale > 0, 'the shock ring expands from the core');
  assert.equal(live.ringCameraFacing, true, 'the shock ring billboards toward the camera instead of edge-on');
  assert.ok((live.ringColor & 0xff) > (live.ringColor >> 16 & 255), 'the ring is a cool cyan energy hue');
  assert.equal(live.ringAdditive, true, 'the shock ring uses additive blending');
  assert.equal(live.sparksVisible, true, 'the core burst emits a spark field');
  assert.ok(live.sparkCount >= 8, 'the spark field carries a bounded particle set');
  assert.equal(live.sparkMoves, true, 'core sparks leave the core');
  assert.equal(live.lightVisible, true, 'the core burst lights nearby surfaces');
  assert.ok(live.lightIntensity > 0 && live.lightIntensity <= 2.6, 'the pooled core light is bounded');
  assert.equal(live.lightDistance, 9, 'the core light uses a bounded distance');
  assert.equal(live.poolLightCount, 4, 'the core burst pool reuses one light per slot');
  assert.deepEqual(live.owned, [true], 'every pooled core burst element is tag-disposable');
  await shot(p, '/tmp/hs-weak-hit-vfx-live.png');

  // A miss (target withdrawn off-axis) must not spawn a burst or advance the
  // token, and a reconnect inside the presentation window must not replay one.
  await sleep(650);
  raid.machines = [{id: 'weak_vfx_far', kind: 'hunter', x: 40, y: 0.35, z: 40, hp: 120, maxHp: 140, state: 'patrol', yaw: 0}];
  const beforeMiss = await p.evaluate("window.__coreBurstCalls.length");
  await key(p, 'KeyF'); await key(p, 'KeyF', false);
  await p.wait("document.querySelectorAll('#hud b').length>0");
  await sleep(700);
  assert.equal(await p.evaluate("window.__coreBurstCalls.length"), beforeMiss, 'a miss never invents a core burst');
  const beforeLeave = await p.evaluate("window.__coreBurstCalls.length");
  await p.evaluate("document.getElementById('leave').click()");
  await p.wait("document.getElementById('play').style.display==='none' && !document.getElementById('resume').hidden");
  await p.evaluate("document.getElementById('resume').click()");
  await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  assert.equal(await p.evaluate("window.__coreBurstCalls.length"), beforeLeave, 'reconnect baseline does not replay the old core burst');

  // Deterministic isolated frame bench: render the snapshot scene with the
  // environment hidden, spawn one production-pool burst at the core, and count
  // the pixels the burst paints. Toggle captures show the framed empty bench and
  // the 70 ms burst for inspection.
  const bench = await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs');const THREE=await import('./lib/three.module.min.js');
    const live=window.__raidView,base=JSON.parse(JSON.stringify(live.snapshot));
    base.machines=[];base.rivals=[];base.caches=[];base.loot=[];base.bags=[];base.pings=[];base.exits=[];base.doors=[];base.telegraphs=[];base.hazards=[];base.utilities=[];base.camera=null;
    document.querySelector('main').hidden=true;
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#0a141c';
    document.body.append(canvas);
    const fresh=new mod.RaidView(canvas);fresh.start(base);fresh.settings={...live.settings,reduced:false};
    fresh.environmentRoot.visible=false;fresh.selfActor.visible=false;if(fresh.weather)fresh.weather.visible=false;fresh.scene.fog=null;fresh.scene.background=new THREE.Color(0x0a141c);
    fresh.camera.fov=55;fresh.camera.aspect=480/270;fresh.camera.position.set(0,1.55,0.7);fresh.camera.lookAt(0,1.55,-2.6);fresh.camera.updateProjectionMatrix();
    const target=new THREE.WebGLRenderTarget(480,270),read=()=>{const pixels=new Uint8Array(480*270*4);fresh.renderer.readRenderTargetPixels(target,0,0,480,270,pixels);return pixels};
    const draw=()=>{fresh.renderer.setRenderTarget(target);fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera)};
    draw();const before=read();
    const start=performance.now();fresh.spawnCoreBurst(0,1.55,-2.6,start);fresh.updateCombatEffects(start+70);draw();const after=read();
    let changed=0;for(let i=0;i<after.length;i+=4)if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2])>12)changed++;
    window.__weakVfxBench=on=>{for(const e of fresh.coreBurstEffects){e.started=null;e.flash.visible=e.ring.visible=e.sparks.visible=e.light.visible=false;e.light.intensity=0}
      if(on){const now=performance.now();fresh.spawnCoreBurst(0,1.55,-2.6,now);fresh.updateCombatEffects(now+70)}
      fresh.renderer.setPixelRatio(1);fresh.renderer.setSize(innerWidth,innerHeight,false);fresh.camera.aspect=innerWidth/innerHeight;fresh.camera.updateProjectionMatrix();fresh.renderer.setRenderTarget(null);fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera)};
    window.__weakVfxFresh=fresh;window.__weakVfxView=live;return {changed,pool:fresh.coreBurstEffects.length,benchTargetDisposed:false};})()`);
  assert.equal(bench.pool, 4, 'the bench uses the same fixed burst pool');
  console.log('core burst pixel delta', bench.changed);
  assert.ok(bench.changed > 150, 'the core burst paints ' + bench.changed + ' measurable pixels');
  await p.evaluate('window.__weakVfxBench(false)');
  await shot(p, '/tmp/hs-weak-hit-vfx-bench-before.png');
  await p.evaluate('window.__weakVfxBench(true)');
  await shot(p, '/tmp/hs-weak-hit-vfx-bench-after.png');

  // Reduced motion: static cyan flash/ring at the core, no sparks, no light wash.
  const reduced = await p.evaluate(`(()=>{const v=window.__weakVfxFresh,now=performance.now();
    v.applySettings({...v.settings,reduced:true});
    const e=v.spawnCoreBurst(0,1.55,-2.6,now);v.updateCombatEffects(now+70);
    const early={flash:e.flash.visible,flashOpacity:e.flash.material.opacity,flashScale:e.flash.scale.x,ring:e.ring.visible,ringOpacity:e.ring.material.opacity,ringScale:e.ring.scale.x,sparks:e.sparks.visible,light:e.light.visible,lightIntensity:e.light.intensity};
    v.updateCombatEffects(now+420);
    const settled={flashScale:e.flash.scale.x,ringScale:e.ring.scale.x,ringOpacity:e.ring.material.opacity,still:e.started!==null};
    v.clear();const released={pool:v.coreBurstEffects.length,scene:v.scene};
    return {early,settled,released};})()`);
  assert.equal(reduced.early.flash, true, 'reduced motion keeps a readable core burst');
  assert.ok(reduced.early.flashOpacity > 0 && reduced.early.flashOpacity <= .7, 'the reduced flash is visible but quiet');
  assert.equal(reduced.early.ring, true, 'reduced motion keeps the shock ring');
  assert.ok(reduced.early.ringOpacity >= .5, 'the reduced ring remains readable');
  assert.equal(reduced.early.sparks, false, 'reduced motion suppresses animated sparks');
  assert.equal(reduced.early.light, false, 'reduced motion suppresses the light wash');
  assert.equal(reduced.early.lightIntensity, 0, 'reduced-motion core burst emits no light');
  assert.equal(reduced.settled.still, true, 'reduced burst persists through its short window');
  assert.equal(reduced.settled.flashScale, reduced.early.flashScale, 'reduced motion freezes the flash scale');
  assert.equal(reduced.settled.ringScale, reduced.early.ringScale, 'reduced motion freezes the ring scale');
  assert.equal(reduced.settled.ringOpacity, reduced.early.ringOpacity, 'reduced motion freezes the ring opacity');
  assert.equal(reduced.released.pool, 0, 'clear() releases the core burst pool');
  assert.equal(reduced.released.scene, null, 'clear() releases the bench scene');
  // The production live view keeps running; a fresh clear at the end would be
  // disruptive, so only the bench instance is released.

  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    spawnCalls: calls,
    token: {weak: token.weak, kill: token.kill, core: token.core},
    burst: {
      pool: live.pool, flash: live.flashVisible, ring: live.ringVisible,
      ringScale: live.ringScale, ringColor: live.ringColor, ringCameraFacing: live.ringCameraFacing, sparks: live.sparkCount,
      light: live.lightIntensity, poolLightCount: live.poolLightCount
    },
    missNoBurst: true,
    reconnectNoReplay: true,
    benchPixels: bench.changed,
    reducedMotion: reduced.early,
    screenshots: ['/tmp/hs-weak-hit-vfx-before.png', '/tmp/hs-weak-hit-vfx-live.png', '/tmp/hs-weak-hit-vfx-bench-before.png', '/tmp/hs-weak-hit-vfx-bench-after.png'],
    browserErrors: page.errors,
    scope: 'Isolated loopback service, one real Chrome client, arranged empty-cover geometry; the core token is read from /api/raid. Does not prove human balance or remote/device acceptance.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    calls: await page?.evaluate("window.__coreBurstCalls").catch(() => null),
    marker: await page?.evaluate("(()=>{const m=document.getElementById('hitmarker');return {show:m?.classList.contains('show'),kind:m?.dataset.kind,caption:document.getElementById('hitmarkerCaption')?.textContent}})()").catch(() => null),
    errors: page?.errors
  }));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
