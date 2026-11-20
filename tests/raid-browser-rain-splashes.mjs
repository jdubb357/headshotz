// Static-Pages rain-splash grader: boots the shipped raid client from a plain
// static-file server (no Node `/api`), deploys, then proves the presentation-only
// ground-impact ripple field exists only for an active rain front, follows the
// authoritative operator, is deterministic for a given scene time, freezes/
// hides under reduced motion, and paints an isolated pixel delta. Snapshot,
// rules, loot and transport are never mutated by this probe.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MIME = {
  '.html': 'text/html', '.mjs': 'application/javascript', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
};
async function staticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(404, {'content-type': 'application/json'});
        res.end(JSON.stringify({error: 'Static Pages has no raid API'}));
        return;
      }
      const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const file = resolve(ROOT, '.' + requested);
      if (file !== ROOT && !file.startsWith(ROOT + '/')) throw new Error('path escape');
      const content = await readFile(file);
      res.writeHead(200, {'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache'});
      res.end(content);
    } catch {
      res.writeHead(404, {'content-type': 'text/plain'});
      res.end('Not found');
    }
  });
  await new Promise((ready, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ready);
  });
  return {server, url: 'http://127.0.0.1:' + server.address().port};
}

const {server, url} = await staticServer();
const previous = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = url;
const harness = await browserHarness();
try {
  const page = await harness.page('/raid-online.html?offline=1');
  await page.wait('document.body.dataset.raidTransport===\'offline\'');
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  await page.wait('!!window.__hszOfflineRaid');
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  await page.wait("!!document.querySelector('#stash input[data-equip]')");
  await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block'");
  await page.wait('!!window.__hszOfflineRaid.snapshot()');

  const result = await page.evaluate(`(async()=>{
    const THREE=await import('./lib/three.module.min.js');
    const {RaidView}=await import('./raid-view.mjs');
    const {terrainHeightAt}=await import('./shared/raid-worlds.mjs');
    const base=window.__hszOfflineRaid.snapshot();
    const rain={...base,conditions:{...base.conditions,weather:'rain',daylight:.28,visibility:.6,light:.75,ambient:1.1,sky:0x2b3a52,fog:0x4b5b62,period:'dusk',clock:'19:00',sun:{x:70,y:18,z:35}}};
    const clear={...base,conditions:{...base.conditions,weather:'clear',daylight:.8,visibility:1,light:1.7,ambient:1.6,sky:0xb08a78,fog:0xa88f7c,period:'dusk',clock:'18:00',sun:{x:-70,y:22,z:35}}};
    const probe=document.createElement('canvas');
    probe.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:5';
    document.body.append(probe);
    const view=new RaidView(probe);
    view.renderer.setSize(640,360,false);
    view.start(rain);
    view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
    const meshFor=()=>view.splashes;
    const mesh=meshFor();
    if(!mesh)return {missing:true};
    const state=view.splashesState;
    // Seed a stable window so every measurement starts from the same authored
    // phases; the ripple field never consumes rule or snapshot state.
    for(let t=1000;t<1400;t+=16)view.frame(t,0,-.15,rain.self);
    const anchor=view.splashesAnchor, arr=mesh.instanceMatrix.array;
    let maxDist=0,offGround=0,rings=0;
    const growsAt2000=[];
    for(let i=0;i<state.count;i++){
      const dx=arr[i*16+12]-anchor.x,dz=arr[i*16+14]-anchor.z,grow=Math.hypot(arr[i*16],arr[i*16+1],arr[i*16+2]);
      maxDist=Math.max(maxDist,Math.hypot(dx,dz));
      const ground=terrainHeightAt(view.world,arr[i*16+12],arr[i*16+14]);
      if(Math.abs(arr[i*16+13]-ground-.03)>0.02)offGround++;
      if(grow>0.01)rings++;
    }
    view.frame(2000,0,-.15,rain.self);
    for(let i=0;i<state.count;i++)growsAt2000.push(Math.hypot(mesh.instanceMatrix.array[i*16],mesh.instanceMatrix.array[i*16+1],mesh.instanceMatrix.array[i*16+2]));
    const colors=mesh.instanceColor?mesh.instanceColor.array:null;
    let bluest=0,validTint=0;
    if(colors){for(let i=0;i<state.count;i++){const r=colors[i*3],g=colors[i*3+1],b=colors[i*3+2];if(b>g&&g>r&&b>bluest)bluest=b;if(r>=0&&b>=0)validTint++}}
    // Animation: a later scene time moves the expansion ring forward for most
    // instances, and returning to the exact time restores the identical pose.
    view.frame(2168,0,-.15,rain.self);
    let moved=0;
    for(let i=0;i<state.count;i++){const grow=Math.hypot(mesh.instanceMatrix.array[i*16],mesh.instanceMatrix.array[i*16+1],mesh.instanceMatrix.array[i*16+2]);if(Math.abs(grow-growsAt2000[i])>0.02)moved++}
    view.frame(2000,0,-.15,rain.self);
    let deterministic=0;
    for(let i=0;i<state.count;i++){const grow=Math.hypot(mesh.instanceMatrix.array[i*16],mesh.instanceMatrix.array[i*16+1],mesh.instanceMatrix.array[i*16+2]);if(Math.abs(grow-growsAt2000[i])<1e-6)deterministic++}
    // Visibility rules: clear weather and reduced motion both suppress the field.
    view.sync(clear);view.frame(2200,0,-.15,rain.self);
    const clearHidden=!view.splashes||!view.splashes.visible;
    view.sync(rain);view.frame(2200,0,-.15,rain.self);
    const rainVisible=!!view.splashes&&view.splashes.visible;
    view.applySettings({reduced:true,sfxVolume:0,fov:75,viewMode:'third'});
    view.frame(2300,0,-.15,rain.self);
    const reducedHidden=!view.splashes||!view.splashes.visible;
    view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
    view.frame(2400,0,-.15,rain.self);
    // Follow the operator: the field rebuilds around the moved position.
    const movedSnap={...rain,self:{...rain.self,x:rain.self.x+120,z:rain.self.z-40}};
    view.sync(movedSnap);
    for(let t=2500;t<2700;t+=16)view.frame(t,0,-.15,movedSnap.self);
    let movedMax=0;
    for(let i=0;i<state.count;i++)movedMax=Math.max(movedMax,Math.hypot(mesh.instanceMatrix.array[i*16+12]-movedSnap.self.x,mesh.instanceMatrix.array[i*16+14]-movedSnap.self.z));
    // Isolated pixel bench: hide the district and the streaks, keep only the
    // ripple meshes, and render a top-down frame with and without them.
    const hidden=[];
    for(const child of view.scene.children){if(child!==mesh){hidden.push([child,child.visible]);child.visible=false}}
    const background=view.scene.background,fog=view.scene.fog;
    view.scene.background=null;view.scene.fog=null;
    const camera=new THREE.PerspectiveCamera(60,640/360,.1,200);
    const self=movedSnap.self;
    camera.position.set(self.x,(self.y||0)+11,self.z);
    camera.lookAt(self.x,self.y||0,self.z);
    const target=new THREE.WebGLRenderTarget(640,360);
    const render=drawn=>{
      mesh.visible=drawn;view.renderer.setRenderTarget(target);view.renderer.setClearColor(0x000000,1);view.renderer.clear();view.renderer.render(view.scene,camera);
      const data=new Uint8Array(640*360*4);view.renderer.readRenderTargetPixels(target,0,0,640,360,data);return data;
    };
    const splashPixels=render(true),plainPixels=render(false);
    let rainObserved=0;
    for(let i=0;i<splashPixels.length;i+=4){
      if(Math.abs(splashPixels[i]-plainPixels[i])+Math.abs(splashPixels[i+1]-plainPixels[i+1])+Math.abs(splashPixels[i+2]-plainPixels[i+2])>8)rainObserved++;
    }
    // Paint the visible probe frame the screenshot will capture: same top-down
    // bench with the district hidden, so the inspection sees the ripple field.
    mesh.visible=true;
    view.renderer.setRenderTarget(null);target.dispose();
    view.renderer.setClearColor(0x000000,1);view.renderer.clear();view.renderer.render(view.scene,camera);
    const image=probe.toDataURL('image/png');
    window.__hsRainSplashProbe={view,probe};
    return {missing:false,count:state.count,maxDist,offGround,rings,bluest,validTint,moved,deterministic,clearHidden,rainVisible,reducedHidden,movedMax,splashPixels:rainObserved,imageLength:image.length,anchor:{x:anchor.x,z:anchor.z}};
  })()`);

  assert.equal(result.missing, false, 'the rain front builds a splash field');
  assert.equal(result.count, 48, 'the splash field keeps its authored 48-ring pool');
  assert.ok(result.rings === 48, 'every pooled ring is placed on the ground');
  assert.ok(result.maxDist <= 12.01, 'the splash disc stays camera-local (' + result.maxDist.toFixed(2) + ' m)');
  assert.equal(result.offGround, 0, 'every ring sits just above the authored terrain height');
  assert.ok(result.validTint === 48 && result.bluest > 0.1, 'rings carry a cool additive tint');
  assert.ok(result.moved >= 40, 'the ripple animation advances for most rings (' + result.moved + '/48)');
  assert.equal(result.deterministic, 48, 'returning to the same scene time repaints the identical field');
  assert.equal(result.clearHidden, true, 'clear weather hides the ground splashes');
  assert.equal(result.rainVisible, true, 'an active rain front shows the ground splashes');
  assert.equal(result.reducedHidden, true, 'reduced motion hides the animated splashes');
  assert.ok(result.movedMax <= 12.01, 'the field re-anchors to the moved operator (' + result.movedMax.toFixed(2) + ' m)');
  assert.ok(result.splashPixels > 100, 'the ripple field paints a visible isolated delta (' + result.splashPixels + ' px)');
  assert.ok(result.imageLength > 1000, 'the visible probe rendered a non-empty frame');

  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile('/tmp/hs-rain-splashes.png', Buffer.from(shot.data, 'base64'));

  // The probe is still mounted for the screenshot; clear it now so the page is
  // returned to its normal state before the API/error checks.
  await page.evaluate(`(()=>{
    const p=window.__hsRainSplashProbe;if(!p)return false;
    p.view.clear();p.probe.remove();delete window.__hsRainSplashProbe;
    return true;
  })()`);
  const apiCalls = await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))");
  assert.deepEqual(apiCalls, [], 'the offline rain-splash probe must not call the Node API');
  assert.deepEqual(page.errors, []);

  console.log(JSON.stringify({
    staticOfflineBoot: true,
    deploy: true,
    ringPool: result.count,
    ringsOnGround: result.rings,
    maxDiscRadius: Math.round(result.maxDist * 10) / 10,
    tintBluest: Math.round(result.bluest * 100) / 100,
    animatedRings: result.moved,
    deterministicRings: result.deterministic,
    clearHidden: result.clearHidden,
    rainVisible: result.rainVisible,
    reducedHidden: result.reducedHidden,
    followsOperator: Math.round(result.movedMax * 10) / 10,
    splashPixels: result.splashPixels,
    noApiTraffic: true,
    screenshot: '/tmp/hs-rain-splashes.png',
    browserErrors: [],
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
