// Fog-attenuated ruined-district horizon grader: proves the massive raid
// sectors render two deterministic layers of jagged ruin silhouettes that fade
// toward the sector fog colour, that dust columns rise from the nearer roofs,
// and that RaidView keeps the same horizon ring centred on the live camera.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('horizon_probe','a long horizon probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'horizon_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const offline=await p.evaluate(`(async()=>{
  const maps=await import('./maps.js'),gfx=await import('./gfx.js'),worlds=await import('./shared/raid-worlds.mjs');
  const THREE=await import('./lib/three.module.min.js');
  const build=(i)=>{const entry=maps.RAID_MAPS[i],b=maps.buildMap(entry.index);return{entry,b,meta:b.group.userData.raidHorizonDepth,skyGroup:b.sky&&b.sky.children.find(c=>c.userData.raidHorizonDepth)}};
  const colorDistance=(mesh,fogHex)=>{const attribute=mesh.geometry.getAttribute('color'),fog=new THREE.Color(fogHex);let sum=0;for(let i=0;i<attribute.count;i++){const c=new THREE.Color(attribute.getX(i),attribute.getY(i),attribute.getZ(i));sum+=Math.hypot(c.r-fog.r,c.g-fog.g,c.b-fog.b)}return sum/attribute.count};
  const signature=group=>{const layers=group.children.filter(c=>c.userData.raidHorizonLayer!=null),dust=group.children.find(c=>c.userData.raidHorizonDust),lights=group.children.filter(c=>c.userData.raidHorizonLights);return JSON.stringify({layers:layers.map(m=>[m.userData.raidHorizonLayer,Array.from(m.geometry.getAttribute('color').array),Array.from(m.geometry.getAttribute('position').array)]),dust:dust?Array.from(dust.geometry.getAttribute('position').array):[],lights:lights.map(m=>[m.userData.raidHorizonLights,Array.from(m.geometry.getAttribute('color').array),Array.from(m.geometry.getAttribute('position').array)])})};
  const firstBob=build(0),bobAgain=build(0);
  const deterministic=signature(firstBob.skyGroup)===signature(bobAgain.skyGroup);
  const directA=gfx.makeRaidHorizon('relay-horizon-check',0xa9bacb,{radius:320,scale:1}),directB=gfx.makeRaidHorizon('relay-horizon-check',0xa9bacb,{radius:320,scale:1});
  const directDeterministic=signature(directA)===signature(directB);
  const sectors=[];for(let i=0;i<maps.RAID_MAPS.length;i++){const{entry,meta,skyGroup}=build(i);
   const layers=skyGroup?skyGroup.children.filter(c=>c.userData.raidHorizonLayer!=null):[];
   const dust=skyGroup&&skyGroup.children.find(c=>c.userData.raidHorizonDust);
   const lights=skyGroup?skyGroup.children.filter(c=>c.userData.raidHorizonLights):[];
   const fogHex=entry.def.fog[0];
   const distances=layers.map(m=>colorDistance(m,fogHex));
   const near=layers.find(m=>m.userData.raidHorizonLayer===0),far=layers.find(m=>m.userData.raidHorizonLayer===1);
   let higherFar=true;if(near&&far){higherFar=distances[0]>distances[1]}
   const glowStats=tag=>{const points=lights.find(c=>c.userData.raidHorizonLights===tag);if(!points)return null;const a=points.geometry.getAttribute('color'),pos=points.geometry.getAttribute('position');let warm=0,radMin=Infinity,radMax=0,yMin=Infinity,yMax=-Infinity;const quadrants=new Set();for(let i=0;i<a.count;i++){const r=a.getX(i),g=a.getY(i),b=a.getZ(i);if(r>=g&&g>=b&&r-b>.02)warm++;const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const rad=Math.hypot(x,z);radMin=Math.min(radMin,rad);radMax=Math.max(radMax,rad);yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);quadrants.add(Math.floor(((Math.atan2(z,x)+Math.PI)%(Math.PI*2))/(Math.PI/2)))}return{count:a.count,warm,isPoints:!!points.isPoints,additive:points.material.blending===THREE.AdditiveBlending,radMin,radMax,yMin,yMax,quadrants:quadrants.size,size:points.material.size,animated:!!points.material.userData.raidHorizonAnimated,animation:points.material.userData.raidHorizonAnimation||null}};
   const animation=(points,kind)=>{const material=points&&points.material;if(!material||!material.onBeforeCompile||!points.userData.raidHorizonLights)return{patched:false};const probe={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};let clock=null,uniformClock=false;try{material.onBeforeCompile(probe);clock=probe.uniforms.uHorizonTime||null;uniformClock=!!clock&&typeof clock.value==='number'}catch{return{patched:false}}return{patched:true,kind:points.userData.raidHorizonLights,clock:!!clock,uniformClock,vertex:/uHorizonTime/.test(probe.vertexShader)&&/hseed/.test(probe.vertexShader),fragment:/diffuseColor\\.a\\*=\\s*vFlicker/.test(probe.fragmentShader),cacheKey:material.customProgramCacheKey&&material.customProgramCacheKey()};};
   const tickGroup=skyGroup&&[skyGroup,...skyGroup.children].find(c=>c?.userData.raidHorizonTick&&c.userData.raidHorizonClock);
   let animationState={hasTick:false};
   if(tickGroup){tickGroup.userData.raidHorizonTick(1.7,false);const moving=tickGroup.userData.raidHorizonClock.value;tickGroup.userData.raidHorizonTick(9,true);const frozen=tickGroup.userData.raidHorizonClock.value;tickGroup.userData.raidHorizonTick(2.6,false);animationState={hasTick:true,moving,frozen,now:tickGroup.userData.raidHorizonClock.value,beacon:animation(lights.find(c=>c.userData.raidHorizonLights==='beacons'),'beacons'),embers:animation(lights.find(c=>c.userData.raidHorizonLights==='embers'),'embers')}}
   sectors.push({id:entry.def.raidWorld.id,meta,layers:layers.length,dustCount:dust?dust.geometry.getAttribute('position').count:0,dustIsPoints:!!dust?.isPoints,lights:lights.length,windows:glowStats('windows'),beacons:glowStats('beacons'),haze:glowStats('haze'),embers:glowStats('embers'),animationState,distances,higherFar,nearY:meta?meta.dustMinY:0,farY:meta?meta.dustMaxY:0});
  }
  // One horizon-focused frame looking out across the sector: the sky group is
  // rendered without the near district so the layered ruined skyline and its
  // dust columns are clearly legible as evidence.
  const m=build(0),THREE2=THREE;const canvas=document.createElement('canvas');canvas.id='horizonProbe';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';document.body.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.setSize(1280,720);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE2.Scene();scene.background=new THREE2.Color(m.entry.def.sky[1]);
  const camera=new THREE2.PerspectiveCamera(58,1280/720,.1,900);camera.position.set(0,3,0);camera.lookAt(-330,3,-80);
  if(m.b.sky){m.b.sky.position.set(0,0,0);scene.add(m.b.sky)}
  // Pixel-prove the GPU firelight: identical camera, only the horizon clock
  // changes, then a frozen clock is rendered twice for stability. Any changed
  // pixels come from flashing beacons and rising embers, not the static scene.
  const motionGroup=m.b.sky&&m.b.sky.children.find(c=>c.userData.raidHorizonTick&&c.userData.raidHorizonClock);
  const motionTarget=new THREE.WebGLRenderTarget(320,180),motionCam=new THREE.PerspectiveCamera(58,320/180,.1,900);motionCam.position.set(0,3,0);motionCam.lookAt(-330,4,-80);
  const readGlow=(time,reduced)=>{if(motionGroup)motionGroup.userData.raidHorizonTick(time,reduced);renderer.setRenderTarget(motionTarget);renderer.clear();renderer.render(scene,motionCam);const data=new Uint8Array(320*180*4);renderer.readRenderTargetPixels(motionTarget,0,0,320,180,data);return data};
  const sampleDiff=(a,b,threshold)=>{let changed=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(d>threshold)changed++}return changed};
  const glowA=readGlow(0,false),glowB=readGlow(1.2,false);
  const flickerPixels=sampleDiff(glowA,glowB,6);
  const frozenA=readGlow(1.2,true),frozenB=readGlow(1.2,true);
  const frozenChanged=sampleDiff(frozenA,frozenB,4);
  renderer.setRenderTarget(null);motionTarget.dispose();
  window.__horizonOfflineRender=()=>{if(motionGroup)motionGroup.userData.raidHorizonTick(2.4,false);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1]};
  window.__horizonOfflineCleanup=()=>{renderer.dispose();canvas.remove();delete window.__horizonOfflineRender;delete window.__horizonOfflineCleanup};
  return {deterministic,directDeterministic,glowMotion:{flickerPixels,frozenChanged},sectors}
 })()`);
 assert.equal(offline.sectors.length,3,'all three raid sectors carry a horizon layer');
 assert.equal(offline.deterministic,true,'offline horizon geometry is deterministic across builds');
 assert.equal(offline.directDeterministic,true,'direct horizon builds are deterministic');
 assert.ok(offline.glowMotion.flickerPixels>50,`the horizon firelight visibly changes between clock samples (${offline.glowMotion.flickerPixels} px)`);
 assert.equal(offline.glowMotion.frozenChanged,0,'a frozen firelight clock renders identically frame to frame');
 for(const sector of offline.sectors){
  const meta=sector.meta;
  assert.ok(meta,'horizon metadata is exposed to tooling');
  assert.equal(sector.layers,2,'the horizon renders a near and far silhouette layer');
  assert.ok(meta.layers.every(layer=>layer.clusters>=24),`both horizon layers keep dense ruined clusters (${sector.id})`);
  assert.ok(meta.silhouettes>=100,`the horizon carries a rich fractal skyline (${sector.id}: ${meta.silhouettes})`);
  assert.ok(meta.layers[1].fogMix<meta.layers[0].fogMix,`the far layer is mixed farther toward the fog colour (${sector.id})`);
  assert.equal(sector.higherFar,true,`the far layer vertices sit closer to the fog tint (${sector.id})`);
  assert.ok(sector.dustCount>=24,`dust plumes render as a dense point field (${sector.id}: ${sector.dustCount})`);
  assert.equal(sector.dustIsPoints,true,'dust plumes are assembled in one point draw');
  assert.ok(meta.plumes>=8,`at least eight dust plume origins rise from real roofs (${sector.id})`);
  assert.equal(meta.puffs,meta.plumes*3,'each plume contributes three graded puffs');
  assert.ok(meta.dustMaxY>meta.dustMinY+8,`dust columns climb measurably above the roofline (${sector.id})`);
  assert.equal(meta.windows,sector.windows?.count,'the window budget matches the rendered point field');
  assert.equal(meta.beacons,sector.beacons?.count,'the beacon budget matches the rendered point field');
  assert.equal(meta.haze,sector.haze?.count,'the haze budget matches the rendered point field');
  assert.equal(meta.embers,sector.embers?.count,'the ember budget matches the rendered point field');
  assert.equal(sector.lights,4,'windows, beacons, haze and embers each render in one dedicated glow draw');
  for(const[name,field,min]of[['windows',sector.windows,8],['beacons',sector.beacons,4],['haze',sector.haze,8],['embers',sector.embers,24]]){
   assert.ok(field,`${sector.id} renders a ${name} glow field`);
   assert.ok(field.count>=min,`${sector.id} keeps at least ${min} ${name} glows`);
   assert.equal(field.isPoints,true,`${name} glow field is a single points draw`);
   assert.equal(field.additive,true,`${name} glows blend additively`);
   assert.equal(field.warm,field.count,`${name} glow colours stay warm (r >= g >= b)`);
   assert.ok(field.radMax<meta.radius*.95,`${sector.id} ${name} stay inside the playable horizon radius`);
   assert.ok(field.radMax<396,`${sector.id} ${name} stay below the offline sky dome`);
  }
  assert.ok(sector.windows.radMin>meta.radius*.74&&sector.windows.radMax<meta.radius*.94,`windows sit on the inward-facing near facades (${sector.id})`);
  assert.ok(sector.windows.yMin>=2&&sector.windows.yMax<meta.windowMaxY+1e-6,`window levels span the lower reaches of the ruins (${sector.id})`);
  assert.ok(sector.haze.radMin>meta.radius*.82&&sector.haze.radMax<meta.radius*.9,`haze hugs the near ring's foot (${sector.id})`);
  assert.ok(sector.haze.yMin>=1&&sector.haze.yMax<=meta.layers[0].heightMin+1e-6,`haze stays between the ground and the lower rooftops (${sector.id})`);
  assert.equal(sector.haze.quadrants,4,`haze spans the full ring (${sector.id})`);
  assert.ok(meta.windowMaxY>meta.layers[0].heightMin,`windows reach above the lower rooftops (${sector.id})`);
  assert.ok(meta.windowMaxY<=meta.layers[0].heightMax,`window levels stay within the ruin bodies (${sector.id})`);
  assert.ok(sector.embers.radMax+9<396,`ember drift stays inside the offline sky dome (${sector.id})`);
  assert.ok(meta.emberMaxY<=meta.layers[0].heightMax+2.5,`embers rise from the burned near rooftops (${sector.id})`);
  const anim=sector.animationState;
  assert.equal(anim.hasTick,true,`${sector.id} exposes a horizon firelight clock`);
  assert.ok(anim.moving>1.6&&anim.moving<1.8,`the clock advances through the scene time (${sector.id})`);
  assert.equal(anim.frozen,0,`reduced motion pins the firelight clock to zero (${sector.id})`);
  assert.ok(anim.now>2.4,`the clock resumes when motion is re-enabled (${sector.id})`);
  for(const kind of ['beacon','embers']){const a=anim[kind];assert.equal(a.patched,true,`${sector.id} patches the ${kind} shader for animated firelight`);assert.equal(a.uniformClock,true,`${kind} firelight shares the horizon time uniform`);assert.equal(a.clock,true,`${kind} receives the clock uniform`);assert.equal(a.vertex,true,`${kind} vertex shader computes distinct phases from position`);assert.equal(a.fragment,true,`${kind} shader applies the per-light flicker`);assert.ok(/raid-horizon-(beacons|embers)/.test(a.cacheKey),`${kind} uses a unique shader cache key`) }
  assert.deepEqual(Object.keys(meta).filter(key=>key==='presentationOnly'),['presentationOnly'],'horizon metadata is presentation-only');
 }
 assert.deepEqual(p.errors,[]);
 const offlineImage=await p.evaluate("window.__horizonOfflineRender()");
 await writeFile('/tmp/hs-horizon-offline.png',Buffer.from(offlineImage,'base64'));
 await p.evaluate("window.__horizonOfflineCleanup()");

 const online=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs'),THREE=await import('./lib/three.module.min.js'),{mapConditions}=await import('./shared/raid-enemies.mjs');
  const snapshot=${JSON.stringify(snapshot)};
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='horizonOnlineProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const view=new RaidView(canvas);view.start(snapshot);view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
  const group=view.horizonDepth,meta=group&&group.userData.raidHorizonDepth;
  const fog=new THREE.Color(view.snapshot?.conditions?.fog??mapConditions(view.world).fog??0x9aa9b4);
  const colorDistance=mesh=>{const attribute=mesh.geometry.getAttribute('color');let sum=0;for(let i=0;i<attribute.count;i++){const c=new THREE.Color(attribute.getX(i),attribute.getY(i),attribute.getZ(i));sum+=Math.hypot(c.r-fog.r,c.g-fog.g,c.b-fog.b)}return sum/attribute.count};
  const layers=group?group.children.filter(c=>c.userData.raidHorizonLayer!=null):[],dust=group&&group.children.find(c=>c.userData.raidHorizonDust),lights=group?group.children.filter(c=>c.userData.raidHorizonLights):[];
  const distances=layers.map(colorDistance);
  const glowStats=tag=>{const points=lights.find(c=>c.userData.raidHorizonLights===tag);if(!points)return null;const a=points.geometry.getAttribute('color'),pos=points.geometry.getAttribute('position');let warm=0,radMax=0,yMax=0;for(let i=0;i<a.count;i++){const r=a.getX(i),g=a.getY(i),b=a.getZ(i);if(r>=g&&g>=b&&r-b>.02)warm++;const rad=Math.hypot(pos.getX(i),pos.getY(i),pos.getZ(i));radMax=Math.max(radMax,rad);yMax=Math.max(yMax,pos.getY(i))}return{count:a.count,warm,isPoints:!!points.isPoints,additive:points.material.blending===THREE.AdditiveBlending,radMax,yMax}};
  const lightFields=['windows','beacons','haze','embers'].map(glowStats);
  view.frame(1200,0,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);
  const clock=group&&group.userData.raidHorizonClock;
  const activeClock=clock?clock.value:-1;
  const centered=Math.hypot(group.position.x-view.camera.position.x,group.position.y-view.camera.position.y,group.position.z-view.camera.position.z)<.001;
  const probes=[];
  for(let k=0;k<8;k++){const yaw=k*Math.PI/4;view.frame(1200,yaw,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);probes.push(view.renderer.domElement.toDataURL('image/png').split(',')[1])}
  // Reduced motion pins the firelight clock; re-enabling it resumes the glow.
  view.applySettings({reduced:true,sfxVolume:0,fov:75,viewMode:'first'});
  view.frame(2400,0,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);
  const frozenClock=clock?clock.value:-1;
  view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'first'});
  view.frame(2400,0,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);
  const resumedClock=clock?clock.value:-1;
  // Isolated horizon frame: hide the district so the ring's geometry and colour
  // grading can be inspected on their own, then restore for later screenshots.
  view.environmentRoot.visible=false;view.frame(2400,0,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);
  const isolated=view.renderer.domElement.toDataURL('image/png').split(',')[1];
  view.environmentRoot.visible=true;view.frame(2400,0,0,{x:snapshot.self.x,y:0,z:snapshot.self.z},false);
  window.__horizonOnlineView=view;
  return {meta,layers:layers.length,dustCount:dust?dust.geometry.getAttribute('position').count:0,lights:lights.length,windowField:glowStats('windows'),beaconField:glowStats('beacons'),hazeField:glowStats('haze'),emberField:glowStats('embers'),lightFields,animatedClock:{hasClock:!!clock,activeClock,frozenClock,resumedClock},skyRadius:195*view.viewScale,distances,higherFar:distances.length===2&&distances[0]>distances[1],centered,hasVisible:!!group && group.visible,probes,isolated}
 })()`);
 assert.ok(online.meta,'RaidView owns the horizon ring');
 assert.equal(online.layers,2,'RaidView renders both silhouette layers');
 assert.ok(online.meta.plumes>=8&&online.meta.puffs===online.meta.plumes*3,'RaidView carries the same dust column budget');
 assert.ok(online.dustCount>=24,'RaidView dust is a dense point field');
 assert.equal(online.higherFar,true,'RaidView far silhouettes fade closer to fog than the near ones');
 assert.equal(online.centered,true,'the horizon ring is centred on the live camera');
 assert.equal(online.hasVisible,true,'the horizon ring is visible in play');
 assert.equal(online.lights,4,'RaidView renders windows, beacons, haze and embers in dedicated glow fields');
 for(const[name,field,min]of[['windows',online.windowField,8],['beacons',online.beaconField,4],['haze',online.hazeField,8],['embers',online.emberField,24]]){
  assert.ok(field&&field.count>=min,`RaidView keeps at least ${min} ${name} glows`);
  assert.equal(field.isPoints,true,`online ${name} glows are a single points draw`);
  assert.equal(field.additive,true,`online ${name} glows blend additively`);
  assert.equal(field.warm,field.count,`online ${name} glow colours stay warm`);
  assert.ok(field.radMax<online.skyRadius,`online ${name} glows stay inside the sky dome (${field.radMax.toFixed(0)} < ${online.skyRadius.toFixed(0)})`);
 }
 assert.equal(online.meta.windows,online.windowField.count,'online window budget matches the rendered field');
 assert.equal(online.meta.beacons,online.beaconField.count,'online beacon budget matches the rendered field');
 assert.equal(online.meta.haze,online.hazeField.count,'online haze budget matches the rendered field');
 assert.equal(online.meta.embers,online.emberField.count,'online ember budget matches the rendered field');
 assert.equal(online.animatedClock.hasClock,true,'online horizon exposes a firelight clock');
 assert.ok(online.animatedClock.activeClock>1.1&&online.animatedClock.activeClock<1.3,'online firelight clock advances with the frame time');
 assert.equal(online.animatedClock.frozenClock,0,'reduced motion pins online firelight to zero');
 assert.ok(online.animatedClock.resumedClock>2.3,'the online firelight clock resumes after reduced motion is cleared');
 await writeFile('/tmp/hs-horizon-online.png',Buffer.from(online.probes[4],'base64'));
 await writeFile('/tmp/hs-horizon-isolated.png',Buffer.from(online.isolated,'base64'));
 await p.evaluate("(()=>{const v=window.__horizonOnlineView;v.clear();v.renderer.dispose();document.getElementById('horizonOnlineProbe')?.remove();delete window.__horizonOnlineView})()");
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({offline:offline.sectors.map(s=>({id:s.id,silhouettes:s.meta.silhouettes,plumes:s.meta.plumes,puffs:s.meta.puffs,windows:s.windows.count,beacons:s.beacons.count,haze:s.haze.count,embers:s.embers.count,layers:s.meta.layers,dustMaxY:s.meta.dustMaxY,animationState:s.animationState})),online:{layers:online.layers,dustCount:online.dustCount,plumes:online.meta.plumes,puffs:online.meta.puffs,windows:online.windowField.count,beacons:online.beaconField.count,haze:online.hazeField.count,embers:online.emberField.count,animatedClock:online.animatedClock,distances:online.distances},screenshots:['/tmp/hs-horizon-offline.png','/tmp/hs-horizon-online.png','/tmp/hs-horizon-isolated.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
