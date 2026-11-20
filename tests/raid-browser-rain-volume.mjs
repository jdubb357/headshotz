// Offline rain-volume grader: boots the extraction raid client from a plain
// static-file server (GitHub-Pages style, no Node `/api`), deploys, and verifies
// the rain front is a camera-local streak field rather than 360 drops spread
// across the whole 1,440 m sector. Presentation-only: snapshot/rules untouched.
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
    const base=window.__hszOfflineRaid.snapshot();
    const rain={...base,conditions:{...base.conditions,weather:'rain',daylight:.28,visibility:.6,light:.75,ambient:1.1,sky:0x2b3a52,fog:0x4b5b62,period:'dusk',clock:'19:00',sun:{x:70,y:18,z:35}}};
    const clear={...base,conditions:{...base.conditions,weather:'clear',daylight:.8,visibility:1,light:1.7,ambient:1.6,sky:0xb08a78,fog:0xa88f7c,period:'dusk',clock:'18:00',sun:{x:-70,y:22,z:35}}};
    const probe=document.createElement('canvas');
    probe.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-1';
    document.body.append(probe);
    const view=new RaidView(probe);
    view.start(rain);
    view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
    // Seed the field so the authored offsets are in the same local box for every
    // measurement; frame() advances the drops and consumes zero rule state.
    for(let t=1000;t<1400;t+=16)view.frame(t,0,-.15,rain.self);
    const state=view.weatherState;
    const volume={radius:state.radius,ceiling:state.ceiling,drops:state.drops.length};
    // Probe geometry directly: every streak head must sit inside the local box
    // around the authoritative operator position.
    const self=view.snapshot.self;
    let maxAxis=0,near=0,slant=0,badSegments=0;
    const positions=view.weather.geometry.attributes.position.array;
    for(let i=0;i<state.drops.length;i++){
      const d=state.drops[i];
      maxAxis=Math.max(maxAxis,Math.abs(d.ox),Math.abs(d.oz));
      if(Math.hypot(d.ox,d.oz)<10&&d.y<14)near++;
      slant+=Math.abs(d.len*.28);
      // World-space tip must stay above the tail, and the tip must lean into
      // the same wind direction (positive local x) as the authored slant.
      const k=i*6;
      if(positions[k+1]<=positions[k+4]||positions[k+3]<=positions[k])badSegments++;
    }
    // Hide the authored district so the pixel bench measures rain only. The
    // weather material still uses its shipped additive/line settings.
    const hidden=[];
    for(const child of view.scene.children){if(child!==view.weather){hidden.push([child,child.visible]);child.visible=false}}
    const background=view.scene.background,fog=view.scene.fog;
    view.scene.background=null;view.scene.fog=null;
    const camera=new THREE.PerspectiveCamera(70,320/180,.1,400);
    camera.position.set(self.x,(self.y||0)+1.65,self.z);
    camera.rotation.set(-.18,0,-.18,'YXZ');
    const target=new THREE.WebGLRenderTarget(320,180);
    const render=drawn=>{
      view.weather.visible=drawn;view.renderer.setRenderTarget(target);view.renderer.setClearColor(0x000000,1);view.renderer.clear();view.renderer.render(view.scene,camera);
      const data=new Uint8Array(320*180*4);view.renderer.readRenderTargetPixels(target,0,0,320,180,data);return data;
    };
    const rainPixels=render(true),plainPixels=render(false);
    let rainObserved=0;
    for(let i=0;i<rainPixels.length;i+=4){
      if(Math.abs(rainPixels[i]-plainPixels[i])+Math.abs(rainPixels[i+1]-plainPixels[i+1])+Math.abs(rainPixels[i+2]-plainPixels[i+2])>20)rainObserved++;
    }
    view.renderer.setRenderTarget(null);target.dispose();
    for(const [child,visible] of hidden)child.visible=visible;
    view.scene.background=background;view.scene.fog=fog;
    // A clear weather snapshot hides the field, and reduced motion hides the
    // animated field even while the front itself stays rain.
    view.sync(clear);view.updateEnvironment(1);
    const clearHidden=!view.weather||!view.weather.visible;
    view.sync(rain);view.updateEnvironment(1);
    view.applySettings({reduced:true,sfxVolume:0,fov:75,viewMode:'third'});
    const reducedHidden=!view.weather||!view.weather.visible;
    view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
    // Follow the operator: after a 120 m move the rebuilt field is still local.
    const moved={...rain,self:{...rain.self,x:rain.self.x+120,z:rain.self.z-40}};
    view.sync(moved);
    view.weather.visible=true;
    for(let t=1600;t<2000;t+=16)view.frame(t,0,-.15,moved.self);
    let movedMax=0;
    for(const d of view.weatherState.drops)movedMax=Math.max(movedMax,Math.abs(d.ox),Math.abs(d.oz));
    const movedHeadX=view.weather.geometry.attributes.position.array[0],movedAnchor=moved.self.x;
    const image=view.renderer.domElement.toDataURL('image/png');
    view.clear();probe.remove();
    return {volume,maxAxis,near,slant,badSegments,rainObserved,clearHidden,reducedHidden,movedMax,movedHeadX,movedAnchor,imageLength:image.length,headCount:state.drops.length};
  })()`);

  assert.equal(result.headCount, 620, 'the rain front keeps its authored 620-drop field');
  assert.ok(result.volume.drops === 620, 'the weather rebuild preserves the drop count');
  assert.ok(result.volume.radius <= 26, 'rain is authored in a camera-local bubble');
  assert.ok(result.maxAxis <= result.volume.radius + .01, 'every streak head stays inside the local volume (' + (Math.round(result.maxAxis * 10) / 10) + ' m)');
  assert.ok(result.near >= 20, 'the near view holds a meaningful number of drops (' + result.near + ')');
  assert.ok(result.slant > 150 && result.badSegments === 0, 'streaks carry an authored wind slant and fall toward the ground');
  assert.ok(result.rainObserved > 300, 'rain paints a visible streak field in-frame (' + result.rainObserved + ' px)');
  assert.equal(result.clearHidden, true, 'clear weather hides the rain field');
  assert.equal(result.reducedHidden, true, 'reduced motion hides animated rain');
  assert.ok(result.movedMax <= result.volume.radius + .01, 'the volume stays local after the operator moves (' + result.movedMax.toFixed(1) + ' m)');
  assert.ok(Math.abs(result.movedHeadX - result.movedAnchor) <= result.volume.radius + .01, 'streak heads are re-anchored to the new operator position');
  assert.ok(result.imageLength > 1000, 'the rain probe rendered a non-empty frame');

  const apiCalls = await page.evaluate("performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(p=>p.startsWith('/api/'))");
  assert.deepEqual(apiCalls, [], 'the offline rain probe must not call the Node API');
  assert.deepEqual(page.errors, []);

  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  await writeFile('/tmp/raid-rain-volume.png', Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({
    staticOfflineBoot: true,
    deploy: true,
    volume: result.volume,
    drops: result.drops,
    nearDrops: result.near,
    rainPixels: result.rainObserved,
    clearHidden: result.clearHidden,
    reducedHidden: result.reducedHidden,
    volumeFollowsOperator: result.movedMax,
    noApiTraffic: true,
    screenshot: '/tmp/raid-rain-volume.png',
    browserErrors: [],
  }));
} finally {
  await harness.close();
  server.close();
  if (previous === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = previous;
}
