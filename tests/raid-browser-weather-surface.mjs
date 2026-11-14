// Weather-surface grader: proves rain eases the terrain and street PBR toward a
// wet sheen, clear weather restores the exact dry baseline, and reduced motion
// snaps instead of animating the transition. Presentation-only; actors unchanged.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('weather_surface_probe','a long weather surface password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'weather_surface_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  const THREE=await import('./lib/three.module.min.js');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='weatherProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const base=${JSON.stringify(snapshot)},view=new RaidView(canvas),clear={...base,conditions:{...base.conditions,weather:'clear'}},rain={...base,conditions:{...base.conditions,weather:'rain'}};
  view.start(clear);view.applySettings({reduced:false,sfxVolume:0,fov:75});
  let clock=1000;const hold=(state,ms)=>{view.sync(state);const end=clock+ms;for(;clock<end;clock+=16)view.frame(clock,0,0,state.self);return clock};
  hold(clear,2200);
  const terrain=view.terrainMaterial,asphalt=view.wetMaterials.find(m=>m!==terrain&&m.userData.raidWet===1);
  const sample=m=>({roughness:m.roughness,metalness:m.metalness,envMapIntensity:m.envMapIntensity,normal:m.normalScale?.x??0});
  const dry={terrain:sample(terrain),asphalt:asphalt?sample(asphalt):null,wetCount:view.wetMaterials.length,wetTargets:view.wetMaterials.filter(m=>m.userData.raidWet).length};
  hold(rain,2200);
  const wet={terrain:sample(terrain),asphalt:asphalt?sample(asphalt):null,wetness:view.wetness};
  hold(clear,4800);
  const restored={terrain:sample(terrain),asphalt:asphalt?sample(asphalt):null,wetness:view.wetness};
  // Reduced motion reaches the final wet state on the first rain frame.
  view.applySettings({reduced:true,sfxVolume:0,fov:75});hold(rain,20);const reducedWetness=view.wetness;
  view.applySettings({reduced:false,sfxVolume:0,fov:75});hold(clear,2600);
  // Wet glints follow the same authoritative wetness: dusk rain ignites them,
  // clear drains them back to an exact zero, and reduced motion snaps them.
  const reflect=source=>{view.sync(source);view.updateEnvironment(1);view.updateWetness(10);const f=view.wetReflections;return {opacity:f?.material.opacity??0,visible:!!f?.visible,count:f?.count??0,wetness:view.wetness}};
  const dusk={period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75};
  const rainReflect={...rain,conditions:{...rain.conditions,...dusk}};
  const clearReflect={...clear,conditions:{...clear.conditions,...dusk}};
  const reflectionDry=reflect(clearReflect),reflectionRain=reflect(rainReflect),reflectionRestored=reflect(clearReflect);
  view.applySettings({reduced:true,sfxVolume:0,fov:75});view.sync(rainReflect);view.updateEnvironment(1);view.wetness=0;view.updateWetness(.016);
  const reflectionReduced={wetness:view.wetness,opacity:view.wetReflections?.material.opacity??0,visible:!!view.wetReflections?.visible};
  view.applySettings({reduced:false,sfxVolume:0,fov:75});
  const groundFixtures=(view.world.props||[]).filter(prop=>((prop.kind==='lamp'||prop.kind==='campfire')&&(prop.y==null||prop.y===0))||(prop.kind==='floodlight'&&(prop.y==null||prop.y===0))).length;
  const lights=view.scene.children.filter(o=>o.isLight).length;window.__weatherView=view;window.__weatherRain=rainReflect;
  return {dry,wet,restored,reducedWetness,terrainWet:{roughness:terrain.userData.raidWet,dryRoughness:terrain.userData.raidDry.roughness},lights,reflection:{field:{isInstanced:!!view.wetReflections?.isInstancedMesh,count:view.wetReflections?.count??0,expected:groundFixtures,map:!!view.wetReflections?.material.map,additive:view.wetReflections?.material.blending===THREE.AdditiveBlending,depthWrite:view.wetReflections?.material.depthWrite},dry:reflectionDry,rain:reflectionRain,restored:reflectionRestored,reduced:reflectionReduced},equal:Math.abs(restored.terrain.roughness-dry.terrain.roughness)<.001&&Math.abs(restored.terrain.metalness-dry.terrain.metalness)<.001&&Math.abs(restored.terrain.envMapIntensity-dry.terrain.envMapIntensity)<.001};
 })()`);
 assert.ok(result.dry.terrain.roughness>=.9,'dry terrain keeps its authored roughness');
 assert.ok(result.dry.asphalt&&result.dry.asphalt.roughness>result.wet.terrain.roughness,'street surfaces are present and start dry');
 assert.ok(result.wet.wetness>.8,'rain fully wets the shared surface state');
 assert.ok(result.wet.terrain.roughness<result.dry.terrain.roughness*.8,'rain sharply lowers terrain roughness');
 assert.ok(result.wet.terrain.metalness>result.dry.terrain.metalness+.2,'rain raises terrain metalness');
 assert.ok(result.wet.terrain.envMapIntensity>result.dry.terrain.envMapIntensity+.5,'rain increases environmental reflection');
 assert.ok(result.wet.asphalt.roughness<result.dry.asphalt.roughness*.8,'rain lowers asphalt roughness');
 assert.ok(result.restored.wetness===0,'clear weather drains the wet state to zero');
 assert.equal(result.equal,true,'clear weather restores the exact dry PBR baseline');
 assert.equal(result.reducedWetness,1,'reduced motion snaps to the target wet state');
 const reflection=result.reflection;
 assert.equal(reflection.field.isInstanced,true,'wet glints are one instanced field');
 assert.equal(reflection.field.count,reflection.field.expected,'wet glints equal authored ground fixtures, with no window glint ('+reflection.field.count+')');
 assert.equal(reflection.field.map,true,'wet glints use their authored sheen');
 assert.equal(reflection.field.additive,true,'wet glints add reflected light to the ground');
 assert.equal(reflection.field.depthWrite,false,'wet glints leave scene depth intact');
 assert.equal(reflection.dry.wetness,0,'clear weather starts the street dry');
 assert.equal(reflection.dry.visible,false,'dry streets hide wet glints');
 assert.ok(reflection.dry.opacity<.001,'dry streets carry zero wet-glint opacity');
 assert.ok(reflection.rain.wetness>.9,'rain fully wets the street reflection state');
 assert.equal(reflection.rain.visible,true,'rain shows wet glints on the street');
 assert.ok(reflection.rain.opacity>.3,'rain carries a strong wet-reflected sheen ('+reflection.rain.opacity.toFixed(3)+')');
 assert.equal(reflection.restored.wetness,0,'clear weather drains wet glints back to dry');
 assert.equal(reflection.restored.opacity,0,'clear weather restores exact zero wet-glint opacity');
 assert.equal(reflection.restored.visible,false,'restored dry streets hide wet glints');
 assert.equal(reflection.reduced.wetness,1,'reduced motion snaps wet glints to full wetness');
 assert.equal(reflection.reduced.visible,true,'reduced motion keeps wet glints visible');
 assert.ok(reflection.reduced.opacity>.3,'reduced motion immediately reaches the rain sheen');
 assert.ok(result.lights>0,'scene lighting remains intact');
 assert.deepEqual(p.errors,[]);
 await p.evaluate("(()=>{const v=window.__weatherView,r=window.__weatherRain;v.sync(r);for(let i=0;i<140;i++)v.frame(200000+i*16,Math.PI*.35,0,r.self)})()");
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-weather-rain.png');
 await p.evaluate("(()=>{delete window.__weatherView;delete window.__weatherRain;document.getElementById('weatherProbe').remove()})()");
 console.log(JSON.stringify({dry:result.dry,wet:result.wet,restored:result.restored,reducedWetness:result.reducedWetness,reflection:{field:result.reflection.field,dry:{opacity:+result.reflection.dry.opacity.toFixed(3),visible:result.reflection.dry.visible},rain:{opacity:+result.reflection.rain.opacity.toFixed(3),wetness:+result.reflection.rain.wetness.toFixed(3),visible:result.reflection.rain.visible},restored:{opacity:+result.reflection.restored.opacity.toFixed(3),visible:result.reflection.restored.visible},reduced:result.reflection.reduced},screenshot:'/tmp/hs-weather-rain.png',browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
