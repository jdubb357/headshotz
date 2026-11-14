// Window-glow grader: proves the scanned CC0 sash windows are real geometry,
// that a lit opening's warmth is flat emissive glazing inside its timber frame
// rather than an additive sprite halo, and that daylight burns that warmth out
// of the glass while sundown restores it. Presentation-only; no gameplay state.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('window_glow_probe','a long window glow probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'window_glow_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1024,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const THREE=await import('./lib/three.module.min.js');
  const assets=await import('./assets.js');
 await assets.loadWindows();
  const asset=assets.HQP.windows?.urban;
  if(!asset?.parts?.length)return {error:'scanned window asset did not decode'};
  const {RaidView}=await import('./raid-view.mjs');
  const {buildEnvironment}=await import('./raid-environment.mjs');
  const {getWorld}=await import('./shared/raid-worlds.mjs');
  document.querySelector('main').hidden=true;
  const canvas=document.createElement('canvas');canvas.id='windowGlowProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const base=${JSON.stringify(snapshot)},world=getWorld(base.map,base.mapVersion===undefined?1:base.mapVersion);
  // Read the authored openings from a throwaway build so the staged spawn can
  // sit directly in front of a lit window before RaidView scans its near field.
  const openings=buildEnvironment(world).userData.raidWindowOpenings||[],lit=openings.filter(v=>v.lit);
  if(!lit.length)return {error:'no lit window openings authored'};
  // A warm-ambers lamp is the authored case the fix targets; cool lamp colours
  // are equally real glazing but would not prove the warm pane returns.
  const warmLit=lit.find(v=>{const c=v.color;if(c==null)return false;const r=c>>16&255,g=c>>8&255,b=c&255;return r>g&&g>b&&r-b>40});
  const s=warmLit||lit[0],outward=s.outward||1,side=outward;
  const self={...base.self,x:s.x+(s.onZ?0:3*outward),y:0,z:s.z+(s.onZ?3*outward:0)};
  const duskConditions={weather:'clear',period:'dusk',clock:'19:15',daylight:.18,light:.8,ambient:1.05,visibility:.85,sky:0x4a3f42,fog:0x5e5049,sun:{x:-70,y:22,z:35}};
  const staged={...base,conditions:{...base.conditions,...duskConditions},self};
  const view=new RaidView(canvas);view.start(staged);
  const root=view.environmentRoot,sites=root.userData.raidWindowOpenings||[];
  // The cloned lit-glass materials join the published window-material list so
  // the night curve drives them alongside the procedural pane fallback.
  const materials=view.windowMaterials,scans=materials.filter(m=>m.userData.raidWindowScan);
  if(!scans.length)return {error:'lit scan glass materials missing'};
  const glassPart=asset.parts.find(part=>/glass/i.test(part.mat?.name||''));
  const frameParts=asset.parts.filter(part=>part!==glassPart);
  let frameWindows=0,frameMeshes=0,glassDark=0,glassLit=0;
  root.traverse(node=>{
   if(!node.isInstancedMesh||!node.count)return;const material=node.material;
   if(material===glassPart.mat)glassDark+=node.count;
   else if(material?.userData?.raidWindowScan)glassLit+=node.count;
   else if(frameParts.some(part=>part.geo===node.geometry)){frameWindows+=node.count;frameMeshes++}
  });
  // No additive halo or ground glint belongs to a lit window.
  const centre={x:s.x,y:s.y+s.h/2,z:s.z};
  let haloPoints=0,glowPoints=0;
  if(view.glowPoints){
   const pos=view.glowPoints.geometry.attributes.position;
   glowPoints=pos.count;
   for(let i=0;i<pos.count;i++){
    const dx=pos.getX(i)-centre.x,dy=pos.getY(i)-centre.y,dz=pos.getZ(i)-centre.z;
    if(dx*dx+dy*dy+dz*dz<1.44)haloPoints++;
   }
  }
  let glints=0;
  if(view.wetReflections){
   const m=view.wetReflections.instanceMatrix.array;
   for(let i=0;i<view.wetReflections.count;i++){
    const dx=m[i*16+12]-centre.x,dz=m[i*16+14]-centre.z;
    if(dx*dx+dz*dz<1.44)glints++;
   }
  }
  // Every lit scan material carries its authored lamp colour as emissive glass
  // and reuses the shared scanned glass map instead of a procedural stand-in.
  const glassChecks=scans.map(material=>{
   const glow=material.userData.raidWindowGlowColor;
   return {color:material.emissive.getHex(),glow,owned:material.userData.raidOwned===true,
    transparent:material.transparent===true,depthWriteOff:material.depthWrite===false,
    map:!!material.emissiveMap&&material.emissiveMap===glassPart.mat.map};
  });
  const lighting=conditions=>{
   view.sync({...base,conditions:{...base.conditions,...conditions},self});
   view.updateEnvironment(1);
   return scans.map(m=>m.emissiveIntensity);
  };
  const noon=Math.max(...lighting({weather:'clear',period:'day',clock:'12:00',daylight:1,light:1,ambient:1.1,visibility:1,sky:0x8dc0d6,fog:0xb8c6c8,sun:{x:-30,y:65,z:35}}));
  const duskLit=Math.max(...lighting(duskConditions));
  const night=Math.max(...lighting({weather:'clear',period:'night',clock:'23:00',daylight:0,light:.35,ambient:.7,visibility:.9,sky:0x152030,fog:0x223243,sun:{x:-30,y:-40,z:25}}));
  // Restore dusk so the evidence frame shows the lit pane inside its frame.
  lighting(duskConditions);
  // Render the lit pane straight on at dusk and read a persistent render target
  // (the live canvas is composited before JS can be sure it is inspectable).
  // Bright warm pixels prove the pane is flat light inside its frame, not a hole.
  const camera=new THREE.PerspectiveCamera(52,512/360,.05,120);
  const look=new THREE.Vector3(s.x,s.y+s.h/2,s.z);
  camera.position.set(look.x+(s.onZ?0:side*2.2),look.y+.15,look.z+(s.onZ?side*2.2:0));
  camera.lookAt(look);
  const rt=new THREE.WebGLRenderTarget(512,360),frameBuffer=new Uint8Array(512*360*4);
  view.renderer.setRenderTarget(rt);view.renderer.setPixelRatio(1);view.renderer.setSize(1024,720,false);
  view.renderer.clear();view.renderer.render(view.scene,camera);
  view.renderer.readRenderTargetPixels(rt,0,0,512,360,frameBuffer);
  let maxLuminance=0,brightPixels=0;
  for(let i=0;i<frameBuffer.length;i+=4){
   const r=frameBuffer[i]/255,g=frameBuffer[i+1]/255,b=frameBuffer[i+2]/255,sum=r+g+b;
   if(sum>maxLuminance)maxLuminance=sum;
   if(sum>.35)brightPixels++;
  }
  // Isolate the scanned frames and glazing so the raster check measures the
  // window itself, not fog/weather/halo sprites. Lit glass must render as light
  // within its timber frame rather than an empty hole.
  const windowScene=new THREE.Scene();windowScene.background=new THREE.Color(0x000000);windowScene.environment=view.scene.environment;
  let windowMeshes=0;
  root.traverse(node=>{
   if(!node.isInstancedMesh||!node.count)return;
   const material=node.material;
   if(material===glassPart.mat||material?.userData?.raidWindowScan||frameParts.some(part=>part.geo===node.geometry)){
    const copy=node.clone();copy.material=material;windowScene.add(copy);windowMeshes++;
   }
  });
  windowScene.add(new THREE.HemisphereLight(0xffe4c9,0x2c241d,.6));
  view.renderer.setRenderTarget(rt);view.renderer.clear();view.renderer.render(windowScene,camera);
  frameBuffer.fill(0);view.renderer.readRenderTargetPixels(rt,0,0,512,360,frameBuffer);
  let windowBright=0,windowWarm=0,windowMax=0;
  for(let i=0;i<frameBuffer.length;i+=4){
   const r=frameBuffer[i],g=frameBuffer[i+1],b=frameBuffer[i+2],sum=r+g+b;
   if(sum>windowMax)windowMax=sum;
   if(sum>60)windowBright++;
   if(sum>25&&r>g&&g>b)windowWarm++;
  }
  const at=(x,y)=>{const i=(y*512+x)*4;return {r:frameBuffer[i],g:frameBuffer[i+1],b:frameBuffer[i+2]}};
  const windowPixel=at(256,180);
  rt.dispose();
  view.renderer.setRenderTarget(null);view.renderer.clear();view.renderer.render(view.scene,camera);
  return {glassInfo:{transparent:glassPart.mat.transparent,depthWrite:glassPart.mat.depthWrite,opacity:glassPart.mat.opacity,alphaTest:glassPart.mat.alphaTest,side:glassPart.mat.side,depthTest:glassPart.mat.depthTest},
   asset:{parts:asset.parts.length,width:asset.width,height:asset.height,source:asset.source},
   sites:sites.length,litSites:lit.length,nearWindows:root.userData.raidRealWindows,
   nearLitWindows:root.userData.raidRealWindowsLit,frameParts:frameParts.length,
   counts:{frameWindows,frameMeshes,glassDark,glassLit},
   haloPoints,glowPoints,glints,scans:scans.length,site:{x:s.x,y:s.y,z:s.z,color:s.color,warm:!!warmLit},glassChecks,noon,dusk:duskLit,night,windowMetrics:{meshes:windowMeshes,bright:windowBright,warm:windowWarm,max:windowMax,sceneLuminance:maxLuminance,pixel:windowPixel},
   rendererToneExposure:view.renderer.toneMappingExposure};
 })()`);
 console.log(JSON.stringify(result));
 assert.ok(!result.error,result.error);
 assert.equal(result.asset.parts,2,'scanned window asset carries a timber frame and glass primitive');
 assert.ok(result.sites>0,'the sector authors window openings');
 assert.ok(result.litSites>0,'the sector authors lit windows');
 assert.equal(result.counts.glassLit,result.nearLitWindows,'every near lit window gets an emissive scanned glass instance');
 assert.equal(result.counts.glassDark+result.counts.glassLit,result.nearWindows,'every near window keeps exactly one scanned glass instance');
 assert.equal(result.counts.frameWindows,result.nearWindows*result.counts.frameMeshes,'every near window gets a scanned timber frame');
 assert.equal(result.haloPoints,0,'no additive glow point sits on the lit window');
 assert.equal(result.glints,0,'no ground glint is claimed by the lit window');
 assert.ok(result.scans>0,'per-colour emissive glass materials were created');
 for(const check of result.glassChecks){
  assert.equal(check.color,check.glow,'scan glass emissive matches its authored lamp colour');
  assert.equal(check.owned,true,'scan glass material is owned for disposal');
  assert.equal(check.transparent,true,'scan glass keeps the asset\'s blended transparency');
  assert.equal(check.depthWriteOff,true,'scan glass keeps depth intact behind the frame');
  assert.equal(check.map,true,'scan glass reuses the real scanned glass map as its emissive map');
 }
 assert.ok(result.noon<.02,'daylight burns the window warmth out of the glass ('+result.noon+')');
 assert.ok(result.dusk>.2,'sundown restores flat emissive glazing ('+result.dusk.toFixed(3)+')');
 assert.ok(result.night>result.dusk,'the pane grows brighter as night deepens');
 assert.equal(result.windowMetrics.meshes>0,true,'scanned frame and glass meshes are isolated for the raster check');
 assert.ok(result.windowMetrics.bright>200,'the rendered lit pane fills its frame ('+result.windowMetrics.bright+' bright px, max '+result.windowMetrics.max+')');
 assert.ok(result.windowMetrics.warm>200,'the rendered glazing carries its warm authored colour ('+result.windowMetrics.warm+' px, centre '+JSON.stringify(result.windowMetrics.pixel)+')');
 assert.deepEqual(p.errors,[]);
 const png=await p.command('Page.captureScreenshot',{format:'png'});
 await writeFile('/tmp/hs-window-glow.png',Buffer.from(png.data,'base64'));
 await p.evaluate("(()=>{document.getElementById('windowGlowProbe').remove()})()");
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
