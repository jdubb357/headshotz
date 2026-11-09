// Cinematic rendering grader: verifies the procedural sky dome, the CSS-free
// IBL environment map, PBR surface detail, and the rain/ash/mist scene weather.
// Screenshots are written for human inspection; assertions are objective.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
import {browserHarness} from './browser-harness.mjs';
const started=Date.now(),now=()=>1000+(Date.now()-started)/1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now});
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const screenshot=async(p,path)=>{const shot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(shot.data,'base64'))};
try{
 const p=await h.page();await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in') && document.getElementById('register').onclick!==null && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate(`document.querySelector('[name=username]').value='cinema_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long cinematic password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("import('./raid-view.mjs').then(({RaidView})=>{const start=RaidView.prototype.start;RaidView.prototype.start=function(...args){const result=start.apply(this,args);window.__cinemaView=this;return result}})");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("const m=document.getElementById('map');m.value='relay';m.dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && window.__cinemaView?.snapshot && document.body.getAttribute('aria-busy')==='false'");
 const operator=runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(operator.raidId);
 raid.machines=[];operator.protectedUntil=10000;
 // Noon / clear: deterministic daylight force so the sky gradient, terrain
 // relief and specular sheen are inspectable.
 const plan={...raid.conditionPlan,startHour:12,hoursPerRaid:0,duration:1,weatherSeed:0,frontAt:999999};
 raid.conditionPlan=plan;raid.conditions=conditionsAt(raid.world,plan,0);raid.lastLightPhase='day';delete raid.conditionsSecond;
 await p.wait("window.__cinemaView.snapshot?.conditions?.clock==='12:00' && window.__cinemaView.snapshot?.conditions?.weather==='clear' && window.__cinemaView.stars.visible===false");
 const clear=await p.evaluate(`(()=>{const v=window.__cinemaView,seen=new Set();let normalMaps=0,metal=0,metalEnvironmental=0,terrainTiled=false;
  v.scene.traverse(o=>{if(!(o.isMesh||o.isInstancedMesh)||!o.material)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m||seen.has(m))continue;seen.add(m);
   if(m.normalMap)normalMaps++;
   if(m.isMeshStandardMaterial&&m.metalness>.25){metal++;if(v.scene.environment)metalEnvironmental++}
   if(m.map&&m.map.repeat&&m.map.repeat.x===54)terrainTiled=true;}});
  return {skyDome:!!v.skyDome&&v.skyDome.material.isShaderMaterial,skyUniform:!!v.skyDome?.material.uniforms?.top,skyTop:v.skyDome?.material.uniforms?.top.value.getHex(),environment:!!v.scene.environment,environmentIsTexture:!!v.scene.environment?.isTexture,normalMaps,metal,metalEnvironmental,terrainTiled,weatherClear:!v.weather||!v.weather.visible,background:!!v.scene.background,stars:v.stars.visible,light:v.sun.intensity,ambient:v.hemi.intensity};})()`);
 assert.equal(clear.skyDome,true,'raid field renders a shader sky dome');
 assert.equal(clear.skyUniform,true,'sky dome exposes condition uniforms');
 assert.equal(clear.environment,true,'scene has a generated environment map');
 assert.equal(clear.environmentIsTexture,true,'environment map is a texture');
 assert.ok(clear.normalMaps>=8,`PBR normal maps are present (${clear.normalMaps})`);
 assert.ok(clear.metal>=2,`reflective metal surfaces are present (${clear.metal})`);
 assert.ok(clear.metalEnvironmental>=2,'metal surfaces receive environment reflections');
 assert.equal(clear.terrainTiled,true,'terrain normal/albedo follow the 54x sector tile');
 assert.equal(clear.weatherClear,true,'clear midday hides the weather particle field');
 assert.equal(clear.stars,false,'clear midday hides stars');
 const scenery=await p.evaluate(`(()=>{const v=window.__cinemaView,env=v.scene.children.find(o=>o.userData?.raidScenery);return {count:env?.userData.raidScenery.count||0,kinds:env?.userData.raidScenery.kinds||{},instanced:[...v.scene.children].filter(o=>o.isInstancedMesh&&o.userData.raidOwned).length};})()`);
 assert.ok(scenery.count>=500,`deployment renders dense procedural scenery (${scenery.count})`);
 for(const kind of ['fern','shrub','stump','moss','ruin','rubble'])assert.ok(scenery.kinds[kind]>0,`deployment renders ${kind} scenery`);
 assert.deepEqual(p.errors,[]);
 await new Promise(r=>setTimeout(r,1200));
 await screenshot(p,'/tmp/hs-cinema-day.png');
 // Night / rain front: force a rain front and inspect the additive streak field.
 const rainPlan={...plan,startHour:22,weatherSeed:1,frontAt:999999};
 raid.conditionPlan=rainPlan;raid.conditions=conditionsAt(raid.world,rainPlan,0);raid.lastLightPhase='night';delete raid.conditionsSecond;
 await p.wait("window.__cinemaView.snapshot?.conditions?.weather==='rain'");
 await p.wait("window.__cinemaView.weatherKind==='rain' && window.__cinemaView.weather.visible && window.__cinemaView.stars.visible");
 const rain=await p.evaluate(`(()=>{const v=window.__cinemaView;return {kind:v.weatherKind,isLines:!!v.weather&&v.weather.isLineSegments,additive:v.weather.material.blending===2,vertices:v.weather.geometry.attributes.position.count,drops:v.weatherState.drops.length,stars:v.stars.visible,moon:v.moonOrb.visible,light:v.sun.intensity};})()`);
 assert.equal(rain.kind,'rain');
 assert.equal(rain.isLines,true,'rain renders as motion streaks, not square points');
 assert.equal(rain.additive,true,'rain streaks use additive blending');
 assert.ok(rain.vertices===rain.drops*2,'rain streak vertices are head/tail pairs');
 assert.ok(rain.stars&&rain.moon,'night rain shows stars and moon');
 await new Promise(r=>setTimeout(r,1200));
 await screenshot(p,'/tmp/hs-cinema-rain.png');
 // The other weather fronts use soft point particles, and reduced motion hides
 // the animated field while clear weather leaves nothing to draw.
 const weather=await p.evaluate(`(()=>{const v=window.__cinemaView,forest=window.__cinemaView.weather;
  v.buildWeather('ash');const ash={visible:v.weather.visible,isPoints:v.weather.isPoints};
  v.buildWeather('mist');const mist={visible:v.weather.visible,isPoints:v.weather.isPoints,opacity:v.weather.material.opacity};
  v.buildWeather('rain');
  const settings=v.settings;v.applySettings({...settings,reduced:true});const hidden=!v.weather.visible;v.applySettings({...settings,reduced:false});
  return {ash,mist,reducedHides:hidden,restored:v.weather.visible,previous:!!forest};})()`);
 assert.equal(weather.ash.isPoints,true,'ash renders as soft particles');
 assert.equal(weather.mist.isPoints,true,'mist renders as soft particles');
 assert.ok(weather.mist.opacity<.4,'mist is translucent');
 assert.equal(weather.reducedHides,true,'reduced motion hides animated weather');
 assert.equal(weather.restored,true,'weather resumes when motion is re-enabled');
 await screenshot(p,'/tmp/hs-cinema-rain-restored.png');
 // Combat expressions: authoritative HP drops drive a decaying human flinch and
 // a short machine core flash; unchanged snapshots and reduced motion stay quiet.
 const combat=await p.evaluate(`(async()=>{const mod=await import('./raid-models.mjs');
  const human=mod.humanModel('Hit test','hit_probe',true,'ar');
  mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:100},.016,1);
  const humanRestFlinch=human.userData.flinch||0,humanRestRig=human.userData.rig.rotation.x,humanRestHead=human.userData.head.rotation.x,humanRestBack=human.userData.rig.position.z,humanRestTorso=human.userData.torso.rotation.x;
  mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:55},.016,1.016);
  const humanHitFlinch=human.userData.flinch,rigTilt=human.userData.rig.rotation.x,humanHeadSnap=human.userData.head.rotation.x,humanBack=human.userData.rig.position.z,humanTorsoSnap=human.userData.torso.rotation.x;
  mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:55},.016,1.032);
  const humanStableFlinch=human.userData.flinch;
  for(let i=0;i<70;i++)mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:55},.016,1.05+i*.016);
  const humanDecayed=human.userData.flinch,humanDecayHead=Math.abs(human.userData.head.rotation.x-humanRestHead),humanDecayBack=Math.abs(human.userData.rig.position.z-humanRestBack),humanDecayTorso=Math.abs(human.userData.torso.rotation.x-humanRestTorso);
  mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:40},.016,2.2);
  const humanPreReducedHead=human.userData.head.rotation.x,humanPreReducedBack=human.userData.rig.position.z;
  mod.updateActor(human,{x:0,y:0,z:0,yaw:0,hp:20,reduced:true},.016,2.216);
  const humanReducedFlinch=human.userData.flinch||0,humanReducedHead=Math.abs(human.userData.head.rotation.x-humanRestHead),humanReducedBack=Math.abs(human.userData.rig.position.z-humanRestBack);
  const machine=mod.machineModel('scout');
  mod.updateActor(machine,{x:2,y:0,z:0,yaw:0,hp:80},.016,1);
  const machineRestScale=machine.userData.core.scale.x;
  mod.updateActor(machine,{x:2,y:0,z:0,yaw:0,hp:30},.016,1.016);
  const machineHitFlash=machine.userData.hitFlash||0,machineHitScale=machine.userData.core.scale.x,machineFlashColor=machine.userData.core.material.color.getHex();
  for(let i=0;i<50;i++)mod.updateActor(machine,{x:2,y:0,z:0,yaw:0,hp:30},.016,1.05+i*.016);
  const machineSettled=machine.userData.hitFlash||0,machineSettledScale=machine.userData.core.scale.x,machineSettledColor=machine.userData.core.material.color.getHex();
  mod.updateActor(machine,{x:2,y:0,z:0,yaw:0,hp:10,reduced:true},.016,2.1);
  const machineReducedFlash=machine.userData.hitFlash||0;
  mod.disposeOwned(human);mod.disposeOwned(machine);
  return {humanRestFlinch,humanHitFlinch,rigTilt,humanRestHead,humanHeadSnap,humanBack,humanTorsoSnap,humanStableFlinch,humanDecayed,humanDecayHead,humanDecayBack,humanDecayTorso,humanPreReducedHead,humanPreReducedBack,humanReducedFlinch,humanReducedHead,humanReducedBack,machineRestScale,machineHitFlash,machineHitScale,machineFlashColor,machineSettled,machineSettledScale,machineSettledColor,machineReducedFlash};})()`);
 assert.ok(combat.humanHitFlinch>=.5,'an authoritative damage event knocks the operator off balance');
 assert.ok(combat.humanStableFlinch<combat.humanHitFlinch,'unchanged HP does not replay the flinch');
 assert.equal(combat.humanDecayed,0,'the flinch settles back to a neutral pose');
 assert.ok(Math.abs(combat.humanHeadSnap-combat.humanRestHead)>=.02,'the head snaps away from the hit');
 assert.ok(combat.humanBack>0.005,'the body staggers backward from the hit');
 assert.ok(Math.abs(combat.humanTorsoSnap)>=.005,'the torso pitches into the hit reaction');
 assert.ok(Math.abs(combat.humanDecayHead)<.02&&Math.abs(combat.humanDecayBack)<.02&&Math.abs(combat.humanDecayTorso)<.02,'the hit stagger and head snap settle to neutral');
 assert.equal(combat.humanReducedFlinch,0,'reduced motion suppresses the flinch pose');
 assert.ok(Math.abs(combat.humanReducedHead)<=Math.abs(combat.humanPreReducedHead)&&Math.abs(combat.humanReducedBack)<=Math.abs(combat.humanPreReducedBack),'reduced motion immediately begins clearing the hit stagger');
 assert.ok(combat.rigTilt>0,'the human rig visibly tilts during the hit reaction');
 assert.ok(combat.machineHitFlash>=.8,'a machine hit brightens its core');
 assert.ok(combat.machineHitScale>combat.machineRestScale,'the machine core pulses on damage');
 assert.notEqual(combat.machineFlashColor,0xff5038,'the flash colour differs from the idle core');
 assert.equal(combat.machineSettled,0,'the machine flash decays');
 assert.ok(Math.abs(combat.machineSettledScale-combat.machineRestScale)<.001,'the core returns to its idle scale');
 assert.equal(combat.machineSettledColor,0xff5038,'the idle core colour restores');
 assert.equal(combat.machineReducedFlash,0,'reduced motion suppresses the machine hit flash');
 // Render the production character models with a settled hit reaction for
 // visual inspection; no gameplay scene or renderer state is reused.
 await p.evaluate(`(async()=>{const THREE=await import('./lib/three.module.min.js'),mod=await import('./raid-models.mjs');
  const canvas=document.createElement('canvas');canvas.id='animEvidence';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';
  document.body.append(canvas);const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d2830);scene.fog=new THREE.Fog(0x1d2830,9,22);
  const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,80);camera.position.set(1.15,1.8,3.5);camera.lookAt(-.9,1.1,0);
  scene.add(new THREE.HemisphereLight(0xcbd8df,0x334049,2.2));const key=new THREE.DirectionalLight(0xffd8a8,3);key.position.set(3,6,4);scene.add(key);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x3b4642,roughness:.9,metalness:.1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const human=mod.humanModel('Hit test','hit_visual',true,'ar');scene.add(human);
  mod.updateActor(human,{x:-.8,y:0,z:0,yaw:2.1,hp:100},.016,1);mod.updateActor(human,{x:-.8,y:0,z:0,yaw:2.1,hp:40},.016,1.016);
  for(let i=0;i<6;i++)mod.updateActor(human,{x:-.8,y:0,z:0,yaw:2.1,hp:40},.016,1.03+i*.016);
  const machine=mod.machineModel('scout');machine.position.set(1,.0,-.3);scene.add(machine);
  mod.updateActor(machine,{x:1,y:0,z:-.3,yaw:.6,hp:80},.016,1);mod.updateActor(machine,{x:1,y:0,z:-.3,yaw:.6,hp:30},.016,1.016);
  for(let i=1;i<3;i++)mod.updateActor(machine,{x:1,y:0,z:-.5,yaw:.6,hp:30},.016,1.016+i*.016);
  renderer.render(scene,camera);window.__animEvidence={renderer,human,machine};return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-anim-hit.png');
 await p.evaluate("(()=>{const e=window.__animEvidence;e.canvas=document.getElementById('animEvidence');e.renderer.dispose();document.getElementById('animEvidence').remove();delete window.__animEvidence})()");
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({skyDome:true,pbr:{normalMaps:clear.normalMaps,metal:clear.metal,reflections:clear.metalEnvironmental},weather:{rainStreaks:true,ash:true,mist:true,reducedMotion:true},scenery:{count:scenery.count,kinds:scenery.kinds,instancedMeshes:scenery.instanced},combat:{humanFlinch:true,headSnap:combat.humanHeadSnap,back:combat.humanBack,torso:combat.humanTorsoSnap,tilt:combat.rigTilt,machineFlash:true,reducedSuppressed:true},screenshots:['/tmp/hs-cinema-day.png','/tmp/hs-cinema-rain.png','/tmp/hs-anim-hit.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
