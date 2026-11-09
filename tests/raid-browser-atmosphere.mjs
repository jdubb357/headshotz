// Cinematic atmosphere grader: proves the raid field gains condition-driven sun
// scattering, a warm horizon bloom, sunlit dust motes that drift only with motion
// enabled, weather/night damping, and clean disposal — all presentation-only.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('atmosphere_probe','a long atmosphere probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'atmosphere_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  const THREE=await import('./lib/three.module.min.js');
  const base=${JSON.stringify(snapshot)};
  const variant=overrides=>({...base,conditions:{...base.conditions,...overrides}});
  const day=variant({weather:'clear',period:'dusk',clock:'18:00',daylight:.9,light:1.9,ambient:1.7,visibility:1,sky:0xb08a78,fog:0xa88f7c,sun:{x:-70,y:22,z:35}});
  const rain=variant({...day.conditions,weather:'rain',daylight:.8,visibility:.75,sky:0x526a83,fog:0x667d90});
  const night=variant({...day.conditions,weather:'clear',period:'night',clock:'23:00',daylight:0,light:.16,ambient:.5,sky:0x101a2f,fog:0x263349,sun:{x:0,y:-80,z:35}});
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='atmosphereProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const view=new RaidView(canvas);view.start(day);view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  const settle=state=>{view.sync(state);view.updateEnvironment(1);view.updateAtmosphere(1);return view};
  settle(day);
  const scatter=view.skyDome.material.uniforms.uScatter.value,shader=view.skyDome.material.fragmentShader;
  const cloudUniforms=view.skyDome.material.uniforms,cloudState=()=>({strength:cloudUniforms.uCloud.value,time:cloudUniforms.cloudTime.value,colSum:cloudUniforms.cloudCol.value.r+cloudUniforms.cloudCol.value.g+cloudUniforms.cloudCol.value.b});
  const dayCloud=cloudState();
  const dust={isPoints:!!view.motes?.isPoints,count:view.motes?.geometry.attributes.position.count||0,map:!!view.motes?.material.map,additive:view.motes?.material.blending===THREE.AdditiveBlending,visible:view.motes?.visible,opacity:view.motes?.material.opacity||0,size:view.motes?.material.size};
  // Motion-on drift: the deterministic field changes between two scene seconds.
  const positions=()=>Array.from(view.motes.geometry.attributes.position.array);
  const cloudTimeA=cloudUniforms.cloudTime.value;const before=positions();view.updateAtmosphere(2);const after=positions();const cloudTimeB=cloudUniforms.cloudTime.value;
  const cloudDrift=cloudTimeB-cloudTimeA;
  let drift=0;for(let i=0;i<before.length;i++)if(before[i]!==after[i])drift++;
  // Reduced motion must hide the animated dust and leave the buffer untouched.
  view.applySettings({reduced:true,sfxVolume:0,fov:75,viewMode:'third'});const frozen=positions();view.updateAtmosphere(3);const frozenAfter=positions();
  let frozenDrift=0;for(let i=0;i<frozen.length;i++)if(frozen[i]!==frozenAfter[i])frozenDrift++;
  const cloudFrozenA=cloudUniforms.cloudTime.value;view.updateAtmosphere(9);const cloudFrozenB=cloudUniforms.cloudTime.value;
  const reduced={visible:view.motes.visible,opacity:view.motes.material.opacity,frozenDrift,cloudTime:cloudFrozenB,cloudFrozen:cloudFrozenA===cloudFrozenB&&cloudFrozenB===0};
  view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  // Weather/night damping.
  settle(rain);const rainAtmosphere={visible:view.motes.visible,scatter:view.skyDome.material.uniforms.uScatter.value,cloud:cloudState()};
  settle(night);const nightAtmosphere={visible:view.motes.visible,scatter:view.skyDome.material.uniforms.uScatter.value,cloud:cloudState()};
  settle(day);const mistCloud=(settle(variant({...day.conditions,weather:'mist'}))&&cloudState());const ashCloud=(settle(variant({...day.conditions,weather:'ash'}))&&cloudState());settle(day);
  // Objective scattering evidence: identical camera/frame, only uScatter varies.
  // The sun's sharp disc and base gradient remain present in both renders.
  settle(day);view.motes.visible=false;
  const targetSun=view.environmentTarget.sun;
  const eye=new THREE.Vector3(base.self.x||0,1.65,base.self.z||0),dir=targetSun.clone().normalize();
  const cam=new THREE.PerspectiveCamera(70,320/180,.1,4000);cam.position.copy(eye);cam.lookAt(eye.clone().addScaledVector(dir,120));
  const target=new THREE.WebGLRenderTarget(320,180);
  view.renderer.autoClear=true;
  const warm=()=>{const data=new Uint8Array(320*180*4);view.renderer.readRenderTargetPixels(target,0,0,320,180,data);let count=0,sum=0,bright=0,red=0;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];if(r>=80&&r>g&&g>b&&r-b>=18)count++;sum+=Math.max(0,r-b);bright+=r+g+b;red+=r}return {count,sum,bright,red}};
  view.skyDome.material.uniforms.uScatter.value=1;view.renderer.setRenderTarget(target);view.renderer.render(view.scene,cam);const warmOn=warm();
  view.skyDome.material.uniforms.uScatter.value=0;view.renderer.render(view.scene,cam);const warmOff=warm();
  view.renderer.setRenderTarget(null);target.dispose();
  // Cloud-deck proof: an upward-facing camera against the same sky, first with
  // the deck switched off twice (must be stable), then at full coverage.
  const skyCam=new THREE.PerspectiveCamera(70,320/180,.1,4000);skyCam.position.set(0,20,0);skyCam.lookAt(new THREE.Vector3(0,160,-60));
  const skyTarget=new THREE.WebGLRenderTarget(320,180);
  const readSky=()=>{const data=new Uint8Array(320*180*4);view.renderer.readRenderTargetPixels(skyTarget,0,0,320,180,data);return data};
  cloudUniforms.uCloud.value=0;view.renderer.setRenderTarget(skyTarget);view.renderer.render(view.scene,skyCam);const skyPlainA=readSky();
  view.renderer.render(view.scene,skyCam);const skyPlainB=readSky();
  cloudUniforms.uCloud.value=1;view.renderer.render(view.scene,skyCam);const skyCloudy=readSky();
  view.renderer.setRenderTarget(null);skyTarget.dispose();cloudUniforms.uCloud.value=dayCloud.strength;
  let cloudChanged=0,cloudStable=0;
  for(let i=0;i<skyPlainA.length;i+=4){
   const d=Math.abs(skyCloudy[i]-skyPlainA[i])+Math.abs(skyCloudy[i+1]-skyPlainA[i+1])+Math.abs(skyCloudy[i+2]-skyPlainA[i+2]);
   if(d>8)cloudChanged++;
   if(Math.abs(skyPlainA[i]-skyPlainB[i])+Math.abs(skyPlainA[i+1]-skyPlainB[i+1])+Math.abs(skyPlainA[i+2]-skyPlainB[i+2])>4)cloudStable++;
  }
  // Hero frame for visual inspection: the authored avenue grid gives a street
  // lined with buildings and lamps, with the low sun off the left frontage.
  settle({...day,self:{...base.self,x:300,y:0,z:3}});view.motes.visible=true;view.updateAtmosphere(1.4);
  const hero=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,4000);
  const heroEye=new THREE.Vector3(300,2.1,3);hero.position.copy(heroEye);
  hero.lookAt(new THREE.Vector3(-300,2.1,3));
  view.renderer.setPixelRatio(1);view.renderer.setSize(innerWidth,innerHeight,false);view.renderer.autoClear=true;
  view.renderer.render(view.scene,hero);
  window.__atmosphereView=view;
  // Two post-assertion captures: a street-level hero frame and a sky-up frame
  // that shows the procedural cloud deck at full coverage.
  window.__atmosphereHero=()=>{view.renderer.setRenderTarget(null);view.renderer.clear();settle({...day,self:{...base.self,x:300,y:0,z:3}});view.motes.visible=true;view.updateAtmosphere(1.4);view.renderer.render(view.scene,hero)};
  window.__atmosphereCloudSky=()=>{const skyCam=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,4000);skyCam.position.set(0,30,0);skyCam.lookAt(new THREE.Vector3(0,140,-40));view.renderer.setRenderTarget(null);view.renderer.setPixelRatio(1);view.renderer.setSize(innerWidth,innerHeight,false);view.renderer.autoClear=true;view.sync(day);view.updateEnvironment(1);view.updateAtmosphere(2);view.skyDome.material.uniforms.uCloud.value=1;view.motes.visible=false;view.renderer.clear();view.renderer.render(view.scene,skyCam)};
  return {scatter,shader:{hasScatter:/uScatter/.test(shader),horizon:/horizon/.test(shader),bloom:/pow\\(s,4\\.\\)/.test(shader)},cloud:{shader:{hasCloud:/uCloud/.test(shader),hasFbm:/cloudFbm/.test(shader),horizonMask:/smoothstep\\(0\\.,\\.10,y\\)/.test(shader)},day:dayCloud,rain:rainAtmosphere.cloud,night:nightAtmosphere.cloud,mist:mistCloud,ash:ashCloud,drift:cloudDrift,reduced,changed:cloudChanged,stable:cloudStable},dust,drift,reduced,rain:rainAtmosphere,night:nightAtmosphere,pixels:{on:warmOn,off:warmOff,diff:warmOn.count-warmOff.count,sumDiff:warmOn.sum-warmOff.sum,brightDiff:warmOn.bright-warmOff.bright,redDiff:warmOn.red-warmOff.red}};
 })()`);
 assert.ok(result.shader.hasScatter&&result.shader.horizon&&result.shader.bloom,'the sky shader paints sun bloom and horizon scattering');
 const cloud=result.cloud;
 assert.ok(cloud.shader.hasCloud&&cloud.shader.hasFbm&&cloud.shader.horizonMask,'the sky shader paints a drifting fbm cloud deck with a horizon mask');
 assert.ok(cloud.day.strength>=.1&&cloud.day.strength<=.35,'clear weather keeps thin cloud cover ('+cloud.day.strength.toFixed(2)+')');
 assert.ok(cloud.mist.strength>=.4,'mist banks a denser deck ('+cloud.mist.strength.toFixed(2)+')');
 assert.ok(cloud.rain.strength>=.8,'the rain front closes the cloud ceiling ('+cloud.rain.strength.toFixed(2)+')');
 assert.ok(cloud.ash.strength>=.6,'ash dust thickens the deck ('+cloud.ash.strength.toFixed(2)+')');
 assert.ok(cloud.rain.strength>cloud.day.strength+.5,'heavy weather is visibly more overcast than clear');
 assert.ok(cloud.night.colSum<cloud.day.colSum*.55,'night cloud tint stays dark ('+cloud.night.colSum.toFixed(0)+' vs '+cloud.day.colSum.toFixed(0)+')');
 assert.ok(cloud.drift>.5,'cloud coordinates advance with the scene clock ('+cloud.drift.toFixed(2)+' s)');
 assert.equal(cloud.reduced.cloudFrozen,true,'reduced motion freezes the cloud deck clock at zero');
 assert.ok(cloud.changed>500,'cloud coverage repaints the sky measurably ('+cloud.changed+' px)');
 assert.equal(cloud.stable,0,'an unclouded sky frame is stable between renders');
 assert.ok(result.scatter>.6&&result.scatter<=1,'scatter intensity follows daylight ('+result.scatter+')');
 assert.equal(result.dust.isPoints,true,'sunlit dust renders as a point field');
 assert.equal(result.dust.count,240,'the dust field keeps its authored population');
 assert.equal(result.dust.map,true,'dust motes use the soft additive sprite');
 assert.equal(result.dust.additive,true,'dust motes blend additively with the scene');
 assert.equal(result.dust.visible,true,'dust motes are visible in clear daylight');
 assert.ok(result.dust.opacity>0.2,'dust motes carry daylight-dependent opacity ('+result.dust.opacity+')');
 assert.ok(result.drift>50,'dust motes drift with motion enabled ('+result.drift+' coordinates change)');
 assert.equal(result.reduced.visible,false,'reduced motion hides the animated dust field');
 assert.equal(result.reduced.frozenDrift,0,'reduced motion freezes dust positions');
 assert.equal(result.rain.visible,false,'the rain front suppresses sunlit dust');
 assert.ok(result.rain.scatter<result.scatter,'the rain front damps sky scattering ('+result.rain.scatter+' vs '+result.scatter+')');
 assert.equal(result.night.visible,false,'night hides sunlit dust');
 assert.ok(result.night.scatter<.01,'night removes sky scattering');
 assert.ok(result.pixels.redDiff>400000,'sun scattering lifts the red channel around the low sun ('+result.pixels.redDiff+')');
 assert.ok(result.pixels.brightDiff>1000000,'sun scattering raises sky brightness ('+result.pixels.brightDiff+')');
 assert.deepEqual(p.errors,[]);
 await p.evaluate("window.__atmosphereCloudSky()");await new Promise(r=>setTimeout(r,260));
 await shot(p,'/tmp/hs-clouds.png');
 await p.evaluate("window.__atmosphereHero()");await new Promise(r=>setTimeout(r,260));
 await shot(p,'/tmp/hs-atmosphere.png');
 await p.evaluate("(()=>{const v=window.__atmosphereView;v.clear();v.renderer.dispose();document.getElementById('atmosphereProbe').remove();delete window.__atmosphereView;delete window.__atmosphereHero;delete window.__atmosphereCloudSky})()");
 console.log(JSON.stringify({scatter:result.scatter,cloud:result.cloud,dust:result.dust,drift:result.drift,reducedMotion:result.reduced,rain:result.rain,night:result.night,pixels:result.pixels,screenshots:['/tmp/hs-atmosphere.png','/tmp/hs-weather-rain.png','/tmp/hs-clouds.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
