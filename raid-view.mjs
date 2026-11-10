import {aimFieldOfView,SHOT_EYE_HEIGHT} from './shared/raid-ballistics.mjs';
import {weaponStats,armorStats} from './shared/raid-catalog.mjs';
import {smokeClear} from './shared/raid-utilities.mjs';
import * as THREE from './lib/three.module.min.js';
import {getWorld,terrainHeightAt,blocked} from './shared/raid-worlds.mjs';
import {mapConditions} from './shared/raid-enemies.mjs';
import {exitColor} from './shared/raid-exits.mjs';
import {buildEnvironment} from './raid-environment.mjs';
import {TX,makeRaidHorizon} from './gfx.js';
import {humanModel,setHumanWeapon,machineModel,propModel,weaponModel,updateActor,disposeOwned,part,beaconModel} from './raid-models.mjs';

import {RaidAudio,spatialCue} from './raid-audio.mjs';
export {RaidAudio} from './raid-audio.mjs';
// Bounded first-person locomotion bob; shared by the frame loop so the hand
// motion stays below the recoil and aim budgets.
const bobReach=speed=>.016*Math.max(0,Math.min(1,speed));
// Gradient sky dome: cheap, no textures, follows the authoritative sky/sun so
// dusk, night and storm fronts read as depth instead of a flat clear colour.
const SKY_VERT=`varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_FRAG=`uniform vec3 top,mid,bot,sunCol;uniform vec3 sunDir;uniform float sunI;uniform float uScatter;uniform vec3 cloudCol;uniform float uCloud;uniform float cloudTime;varying vec3 vD;
#include <common>
// Deterministic value-noise fbm used for the overcast deck. There is no runtime
// randomness: the same view direction and cloud time always paint the same deck.
float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(cloudHash(i),cloudHash(i+vec2(1.,0.)),f.x),mix(cloudHash(i+vec2(0.,1.)),cloudHash(i+vec2(1.,1.)),f.x),f.y);}
float cloudFbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*cloudNoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec3 d=normalize(vD);float y=d.y;
 vec3 c=y>0.?mix(mid,top,pow(clamp(y,0.,1.),.55)):mix(mid,bot,clamp(-y*5.,0.,1.));
 c+=mid*.22*exp(-abs(y)*12.);
 // Soft cumulus layers: two offset fbm samples create billows and wispy edges.
 // Coverage shrinks toward the horizon so the fog band stays unbroken, and the
 // drifting coordinates follow cloudTime at a gentle real-world pace.
 vec2 plan=d.xz/(.24+max(y,.04));
 float drift=cloudTime*.045;
 float deck=cloudFbm(plan*1.9+vec2(drift,drift*.55))*.85+cloudNoise(plan*4.4-vec2(drift*.7,drift*.35))*.3;
 float cover=smoothstep(.4,.76,deck)*uCloud*smoothstep(0.,.10,y);
 float s=max(dot(d,sunDir),0.);
 // Cloud undersides stay a shade darker than the sky while sun-facing edges
 // pick up the authored sun colour, so the deck reads as volume rather than a
 // flat grey wash. Near the horizon the mask above keeps the fog band unbroken.
 vec3 shade=mix(cloudCol*.78,cloudCol+sunCol*.32,clamp(pow(s,2.)*.7,0.,1.));
 c=mix(c,shade,clamp(cover,0.,1.)*.62);
 c+=sunCol*(pow(s,700.)*12.*sunI+pow(s,32.)*.28+pow(s,5.)*.07);
 // Cinematic atmospheric scattering: a broad bloom around the sun plus a warm
 // horizon band. uScatter follows daylight and is damped by heavy weather, so
 // night and storm fronts stay cold while golden hour gains a soft hush of light.
 float horizon=exp(-abs(y)*3.2);
 c+=sunCol*uScatter*(pow(s,4.)*.20+pow(s,1.8)*horizon*.15+horizon*.045);
 gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const SKY_MID=new THREE.Color(),CLOUD_MIX=new THREE.Color(),CLOUD_WHITE=new THREE.Color(0xffffff);
// Presentation-only frame composite drawn after the world and weapon overlay:
// a soft edge vignette with fine, temporally animated film grain. Both effects
// are procedural, resolution-independent and never touch gameplay state.
const POST_VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const POST_FRAG=`varying vec2 vUv;uniform sampler2D uScene;uniform sampler2D uBloomTex;uniform vec2 uResolution;uniform float uTime;uniform float uVignette;uniform float uGrain;uniform float uBloom;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 uv=vUv;
 vec3 base=texture2D(uScene,uv).rgb;
 // Soft multi-pass bloom: the half-resolution chain in BLOOM_FRAG has already
 // extracted the highlights and separable-blurred them, so this pass only
 // upsamples and adds the accumulated glow. Because the scene target is linear
 // and the bloom chain never tone-maps, the renderer's injected ACES + sRGB
 // chunks still finish the frame exactly like the direct path.
 vec3 bloom=texture2D(uBloomTex,uv).rgb;
 vec3 col=base+bloom*uBloom*1.4;
 vec2 d=(uv-.5)*vec2(uResolution.x/max(uResolution.y,1.),1.);
 float edge=smoothstep(.38,.86,length(d));
 float n=hash(floor(uv*uResolution*.5)+vec2(floor(mod(uTime,60.)*10.),1.));
 float grain=(n-.5)*uGrain;
 float dark=clamp(edge*uVignette+grain,0.,.7);
 gl_FragColor=vec4(col*(1.0-dark),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
// Half-resolution bloom chain. Pass 0 averages a 2×2 source footprint and keeps
// only highlights above a soft threshold; pass 1 and pass 2 are separable
// five-per-side Gaussian blurs. The half-resolution kernel, written in relative
// pixel units, keeps the halo the same size across 720p and high-DPI buffers.
const BLOOM_FRAG=`varying vec2 vUv;uniform sampler2D uSource;uniform vec2 uTexel;uniform float uThreshold;uniform float uBlurScale;uniform int uPass;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 blurH(vec2 uv){
 vec2 o=vec2(uTexel.x*uBlurScale,0.);
 vec3 c=texture2D(uSource,uv).rgb*.2270270270;
 c+=texture2D(uSource,uv+o).rgb*.1945945946;
 c+=texture2D(uSource,uv-o).rgb*.1945945946;
 c+=texture2D(uSource,uv+o*2.0).rgb*.1216216216;
 c+=texture2D(uSource,uv-o*2.0).rgb*.1216216216;
 c+=texture2D(uSource,uv+o*3.0).rgb*.0540540541;
 c+=texture2D(uSource,uv-o*3.0).rgb*.0540540541;
 c+=texture2D(uSource,uv+o*4.0).rgb*.0162162162;
 c+=texture2D(uSource,uv-o*4.0).rgb*.0162162162;
 return c;
}
vec3 blurV(vec2 uv){
 vec2 o=vec2(0.,uTexel.y*uBlurScale);
 vec3 c=texture2D(uSource,uv).rgb*.2270270270;
 c+=texture2D(uSource,uv+o).rgb*.1945945946;
 c+=texture2D(uSource,uv-o).rgb*.1945945946;
 c+=texture2D(uSource,uv+o*2.0).rgb*.1216216216;
 c+=texture2D(uSource,uv-o*2.0).rgb*.1216216216;
 c+=texture2D(uSource,uv+o*3.0).rgb*.0540540541;
 c+=texture2D(uSource,uv-o*3.0).rgb*.0540540541;
 c+=texture2D(uSource,uv+o*4.0).rgb*.0162162162;
 c+=texture2D(uSource,uv-o*4.0).rgb*.0162162162;
 return c;
}
void main(){
 if(uPass==0){
  vec2 o=uTexel*.5;
  vec3 c=(texture2D(uSource,vUv+vec2(-o.x,-o.y)).rgb+texture2D(uSource,vUv+vec2(o.x,-o.y)).rgb+texture2D(uSource,vUv+vec2(-o.x,o.y)).rgb+texture2D(uSource,vUv+vec2(o.x,o.y)).rgb)*.25;
  gl_FragColor=vec4(c*smoothstep(uThreshold,uThreshold+.30,luma(c)),1.);
 }else if(uPass==1){
  gl_FragColor=vec4(blurH(vUv),1.);
 }else{
  gl_FragColor=vec4(blurV(vUv),1.);
 }
}`;
// Impact palette: the first hex is the hot spark/light colour, the second is
// the slow dust plume tint. Keys match world block materials and terrain themes.
const IMPACT_PALETTE={concrete:[0xffcf82,0xb9b3a4],gravel:[0xffcf82,0xa8a394],dirt:[0xffc878,0xbfab7f],forest:[0x9ddf63,0x738b57],foliage:[0x9ddf63,0x738b57],brick:[0xe99b62,0xa57b64],planks:[0xffbf78,0x9b6b3f],metal:[0xfff1c6,0x8a8e93],rock:[0xffc890,0xa5a293],container:[0xa7d7df,0x778b8f],crate:[0xe4cf9b,0x9c8459],hazard:[0xffd75a,0xbfae7f],tiles:[0xcbd3d8,0x9a9d98],asphalt:[0xffc98d,0x8e8b8a]};
// Authoritative recoil amplitude per weapon class; presenting the same kick to
// the gun and camera keeps heavy weapons distinct without touching ballistics.
const RECOIL_KICK={ar:.07,smg:.045,shotgun:.14,sniper:.12,pistol:.06,lmg:.09};
// Authored first-person muzzle silhouettes per weapon family. Each profile is
// painted once when the weapon is equipped; the draw path adds no objects.
const FLASH_PROFILES={
 rifle:{spikes:4,core:44,tint:0xffe6b0,scale:.034,line:4},
 smg:{spikes:6,core:37,tint:0xffd898,scale:.028,line:3},
 shotgun:{spikes:8,core:57,tint:0xffcf76,scale:.062,line:9},
 sniper:{spikes:2,core:31,tint:0xfff0ca,scale:.044,line:4},
 pistol:{spikes:5,core:39,tint:0xffdc98,scale:.024,line:5},
 heavy:{spikes:10,core:51,tint:0xffc160,scale:.058,line:6}
};
function muzzleFlashTexture(profile){
 const p=FLASH_PROFILES[profile]||FLASH_PROFILES.rifle,size=128,center=64;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const context=canvas.getContext('2d');
 const core=context.createRadialGradient(center,center,0,center,center,p.core);
 core.addColorStop(0,'rgba(255,255,255,1)');core.addColorStop(.42,'rgba(255,240,200,.95)');core.addColorStop(.72,'rgba(255,176,78,.72)');core.addColorStop(1,'rgba(255,140,32,0)');
 context.fillStyle=core;context.fillRect(0,0,size,size);
 context.globalCompositeOperation='lighter';context.lineCap='round';
 for(let i=0;i<p.spikes;i++){
  const angle=i*Math.PI*2/p.spikes+(profile==='sniper'?.07:0),reach=(center*.58+(i%2?center*.3:0))*1.18;
  const x=center+Math.cos(angle)*reach,y=center+Math.sin(angle)*reach;
  const gradient=context.createLinearGradient(center,center,x,y);
  gradient.addColorStop(0,'rgba(255,248,222,.9)');gradient.addColorStop(.6,'rgba(255,168,70,.58)');gradient.addColorStop(1,'rgba(255,130,28,0)');
  context.strokeStyle=gradient;context.lineWidth=p.line;context.beginPath();context.moveTo(center,center);context.lineTo(x,y);context.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
function writeRain(arr,i,d){const k=i*6;arr[k]=d.x;arr[k+1]=d.y;arr[k+2]=d.z;arr[k+3]=d.x+Math.sin(d.y*.23+i)*.07;arr[k+4]=d.y-d.len;arr[k+5]=d.z}
export class RaidView {
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.postScene=this.postCamera=this.postMesh=this.postMaterial=null;this.postTarget=null;this.bloomScene=this.bloomMesh=this.bloomMaterial=null;this.bloomTargets=null;this.bloomWidth=0;this.bloomHeight=0;this.windMaterials=[];this.motes=this.motesState=this.motesAnchor=null;this.glowPoints=this.glowPools=this.wetReflections=null;

  this.renderer.autoClear=false;this.audio=new RaidAudio();this.actors=new Map();this.effects=new Map();this.utilityEffects=new Map();this.shotEffects=[];this.blastEffects=[];this.shotCursor=0;this.blastCursor=0;this.lastTime=0;this.lastWeapon=null;this.recoil=0;this.recoilSide=1;this.shotMuzzleLight=null;this.shotMuzzleLightAt=-1e9;this.snapAt=performance.now();this.viewMode='third';this.chase=null;this.cameraName='';this.fireYaw=0;this.firePitch=0;
 // Presentation-only view-model feel: damped look sway, locomotion bob and a
 // transient additive muzzle glow. None of these feed snapshot, ballistics or
 // prediction.
 this.vmYaw=0;this.vmPitch=0;this.vmLastYaw=null;this.vmLastPitch=null;this.vmStep=0;this.vmEquipAt=0;this.vmAim=0;this.muzzleFlashAt=-1e9;this.muzzleFlash=null;this.muzzleLight=null;this.muzzleLocal=null;
 // First-person firing particulate: a fixed recycled casing pool and one
 // short-lived muzzle-smoke puff. Both live on the weapon root so they inherit
 // sway, bob and recoil, and neither touches snapshot or ballistics state.
 this.caseFx=null;this.caseCursor=0;this.muzzleSmoke=null;this.muzzleSmokeAt=-1e9;
 // Barrel heat is presentation-only: it rises with accepted shots, stays out
 // of all authoritative state, warms the muzzle bloom between flashes, and
 // cools in place.
 this.heat=0;this.heatPeak=0;this.flashProfile=null;this.flashSpikes=0;this.muzzleBaseScale=.034;this.gunHeatMaterials=[];
 // Reload handling: a physical magazine prop and a brief dip/tilt envelope.
 // Triggered only by an accepted reload and driven by presentation time.
 this.reloadStartedAt=0;this.reloadDuration=0;this.reloadMag=null;this.reloadMagBase=null;
 }
 applySettings(settings){this.settings=settings;this.audio.volume=settings.sfxVolume;if(settings.viewMode)this.viewMode=settings.viewMode;if(this.selfActor)this.selfActor.visible=this.viewMode!=='first';if(this.camera){this.camera.fov=settings.fov;this.camera.updateProjectionMatrix()}if(this.renderCamera)this.renderCamera.fov=settings.fov;if(this.weather)this.weather.visible=this.snapshot?.conditions?.weather!=='clear'&&!settings.reduced}
 clear(){
  if(this.envMapRT)this.envMapRT.dispose();
  if(this.postTarget)this.postTarget.dispose();
  this.postTarget=null;
  for(const target of this.bloomTargets||[])target.dispose();
  this.bloomTargets=null;this.bloomWidth=0;this.bloomHeight=0;
  // Directional shadow targets are not reachable from scene disposal, so release
  // the sun's map explicitly or each restart leaves one texture on the GPU.
  if(this.sun?.shadow?.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null}
  if(this.scene)disposeOwned(this.scene);if(this.overlay)disposeOwned(this.overlay);if(this.postScene)disposeOwned(this.postScene);if(this.bloomScene)disposeOwned(this.bloomScene);this.actors.clear();this.effects.clear();this.utilityEffects.clear();this.shotEffects=[];this.blastEffects=[];this.lastWeapon=null;this.lastTime=0;
  this.audio.reset();const context=this.audio.context;if(context&&context.state!=='closed')context.close().catch(()=>{});this.audio=new RaidAudio();this.audio.volume=this.settings?.sfxVolume??.7;
  for(const name of ['scene','overlay','environmentRoot','terrainMaterial','wetMaterials','windMaterials','snapshot','world','camera','renderCamera','selfActor','weaponCamera','gunRoot','gun','visualSelf','hemi','sun','weather','weatherKind','weatherState','skyDome','envMapRT','postTarget','postScene','postCamera','postMesh','postMaterial','bloomTargets','bloomScene','bloomCamera','bloomMesh','bloomMaterial','sunOrb','moonOrb','stars','motes','motesState','motesAnchor','glowPoints','glowPools','wetReflections','environmentTarget','horizonDepth'])this[name]=null;this.chase=null;this.wetness=0;
  this.vmYaw=0;this.vmPitch=0;this.vmLastYaw=null;this.vmLastPitch=null;this.vmStep=0;this.vmEquipAt=0;this.vmAim=0;this.muzzleFlashAt=-1e9;this.muzzleFlash=null;this.muzzleLight=null;this.muzzleLocal=null;this.recoil=0;this.recoilSide=1;this.shotMuzzleLight=null;this.shotMuzzleLightAt=-1e9;
  this.caseFx=null;this.caseCursor=0;this.muzzleSmoke=null;this.muzzleSmokeAt=-1e9;
  this.heat=0;this.heatPeak=0;this.flashProfile=null;this.flashSpikes=0;this.muzzleBaseScale=.034;this.gunHeatMaterials=[];
  this.reloadStartedAt=0;this.reloadDuration=0;this.reloadMag=null;this.reloadMagBase=null;
  this.renderer.renderLists.dispose();this.renderer.clear();this.renderer.info.reset();
 }
 start(snapshot){
  if(this.envMapRT){this.envMapRT.dispose();this.envMapRT=null}
  if(this.postTarget){this.postTarget.dispose();this.postTarget=null}
  for(const target of this.bloomTargets||[])target.dispose();
  this.bloomTargets=null;this.bloomWidth=0;this.bloomHeight=0;
  if(this.sun?.shadow?.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null}
  if(this.scene)disposeOwned(this.scene);if(this.overlay)disposeOwned(this.overlay);if(this.postScene)disposeOwned(this.postScene);if(this.bloomScene)disposeOwned(this.bloomScene);this.postScene=this.postCamera=this.postMesh=this.postMaterial=null;this.bloomScene=this.bloomMesh=this.bloomMaterial=null;this.actors.clear();this.effects.clear();this.utilityEffects.clear();this.shotEffects=[];this.blastEffects=[];this.lastWeapon=null;this.weather=null;this.weatherKind=null;this.weatherState=null;this.audio.reset();
  this.vmYaw=0;this.vmPitch=0;this.vmLastYaw=null;this.vmLastPitch=null;this.vmStep=0;this.vmEquipAt=0;this.vmAim=0;this.muzzleFlashAt=-1e9;this.muzzleFlash=null;this.muzzleLight=null;this.muzzleLocal=null;this.recoil=0;this.recoilSide=1;this.shotMuzzleLight=null;this.shotMuzzleLightAt=-1e9;
  this.caseFx=null;this.caseCursor=0;this.muzzleSmoke=null;this.muzzleSmokeAt=-1e9;
  this.heat=0;this.heatPeak=0;this.flashProfile=null;this.flashSpikes=0;this.muzzleBaseScale=.034;this.gunHeatMaterials=[];
  this.reloadStartedAt=0;this.reloadDuration=0;this.reloadMag=null;this.reloadMagBase=null;
  this.world=getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion);this.viewScale=this.world.size/160;this.scene=new THREE.Scene();this.environmentRoot=buildEnvironment(this.world);this.scene.add(this.environmentRoot);this.glowPoints=this.environmentRoot.userData.raidGlowPoints||null;this.glowPools=this.environmentRoot.userData.raidGlowPools||null;this.wetReflections=this.environmentRoot.userData.raidWetReflections||null;this.terrainMaterial=this.environmentRoot.userData.raidTerrainMaterial||null;this.wetMaterials=[];this.windMaterials=this.environmentRoot.userData.raidWindMaterials||[];if(this.terrainMaterial)this.wetMaterials.push(this.terrainMaterial);for(const material of this.environmentRoot.userData.materials?.values()||[])if(material.userData.raidDry&&material.userData.raidWet>0)this.wetMaterials.push(material);const initialWeather=snapshot.conditions?.weather||'clear';this.wetness=initialWeather==='rain'?1:initialWeather==='mist'?.35:0;this.applyWetness();this.camera=new THREE.PerspectiveCamera(75,1,.08,Math.max(230,this.world.size*1.5));this.camera.rotation.order='YXZ';this.renderCamera=new THREE.PerspectiveCamera(75,1,.12,Math.max(230,this.world.size*1.5));this.renderCamera.rotation.order='YXZ';
  const selfWeapon=[...snapshot.self.equipment,...snapshot.self.pack].find(it=>it.id===snapshot.self.weaponId&&it.kind==='weapon')?.weapon??null;
  this.selfActor=humanModel(snapshot.self.name||'Operator','raid_local_operator',true,selfWeapon);if(this.selfActor.userData.tag)this.selfActor.userData.tag.visible=false;this.selfActor.visible=this.viewMode!=='first';this.scene.add(this.selfActor);
  this.hemi=new THREE.HemisphereLight(0xe5f2ed,0x414d49,1.8);this.sun=new THREE.DirectionalLight(0xffd6a0,2);this.sun.position.set(-30,65,35);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-80;this.sun.shadow.camera.right=80;this.sun.shadow.camera.top=80;this.sun.shadow.camera.bottom=-80;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=220;this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.35;this.sunDirection=new THREE.Vector3(-30,65,35).normalize();this.sunAnchor=new THREE.Vector3();this.scene.add(this.hemi,this.sun,this.sun.target);this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.enabled=true;
  this.environmentTarget=null;this.buildSky(snapshot);
  this.overlay=new THREE.Scene();this.weaponCamera=new THREE.PerspectiveCamera(58,1,.02,8);
  // Three-point first-person lighting: a warm key (sun through the scene), a
  // cool rim from behind the shoulder, and a sky/ground hemisphere fill. The
  // weapon is near the camera and gets no shadow map; these lights read the
  // metal highlights without touching the world pass.
  this.overlayFill=new THREE.HemisphereLight(0xdff3ff,0x3a2c24,1.5);
  this.overlayKey=new THREE.DirectionalLight(0xffd8a6,3.2);this.overlayKey.position.set(2.4,2.8,4.2);
  this.overlayRim=new THREE.DirectionalLight(0x9ddcff,1.75);this.overlayRim.position.set(-2.8,1.4,2.4);
  this.overlay.add(this.overlayFill,this.overlayKey,this.overlayRim);
  this.gunRoot=new THREE.Group();this.gunRoot.position.set(.2,-.22,-.5);this.gunRoot.scale.setScalar(.65);this.overlay.add(this.gunRoot);
  this.buildCombatEffects();
  this.buildComposite();
  this.visualSelf=new THREE.Vector3(snapshot.self.x,(snapshot.self.y||0),snapshot.self.z);
  this.fireOrigin=new THREE.Vector3(snapshot.self.x,(snapshot.self.y||0)+1.55,snapshot.self.z);this.fireYaw=snapshot.self.yaw||0;this.firePitch=snapshot.self.pitch||0;
  this.audio.resume();this.sync(snapshot);
 }
 sync(snapshot){
  this.snapshot=snapshot;this.audio.observe(snapshot);this.snapAt=performance.now();const live=new Set();
  const put=(key,type,data)=>{
   live.add(key);let entry=this.actors.get(key);
   if(!entry){
    const model=type==='machine'?machineModel(data.kind):type==='human'?humanModel(data.name||'Operator',data.id,data.rival?false:data.team===snapshot.self.team,data.weapon??null):propModel(type,type==='door'?(data.locked?0xc86a55:data.closed?0xd8b062:0x8dbb9b):data.weaponCache?0xbd7ad7:data.vault?0xc78bdb:data.open?0x87b89a:data.ground?0x9fd27c:0xd8b062);
    // Armories carry purple beams; extraction beacons stay cyan/green. This
    // gives both objectives a silhouette above the dense district roofs.
    if(type==='cache'&&data.weaponCache){model.userData.beacon=beaconModel(0xe07adf,18);model.add(model.userData.beacon)}
    if(type==='exit'){model.userData.beacon=beaconModel(0x83efc2,14);model.add(model.userData.beacon)}
    // The Warden carries a phase-colored column so squads can find the major
    // threat above the district roofs; updateActor recolors it per snapshot.
    if(type==='machine'&&data.kind==='overlord'){model.userData.beacon=beaconModel(0x9db6c4,18);model.add(model.userData.beacon)}
    if(type==='human'||type==='machine')model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}});
    entry={model,type,data};this.actors.set(key,entry);this.scene.add(model);
   }
   entry.data=data;if(type==='human'&&entry.model.userData.heldWeapon!==(data.weapon??null))setHumanWeapon(entry.model,data.weapon??null);if(type==='cache')entry.model.userData.lid?.material.color.setHex(data.open?0x87b89a:data.vault?0xc78bdb:0xd8b062);
  };
  for(const p of snapshot.players)if(p.id!==snapshot.camera?.follow)put(p.id,'human',p);
  for(const m of snapshot.machines)put(m.id,'machine',m);
  for(const r of snapshot.rivals||[])put(r.id,'human',r);
  for(const c of snapshot.caches)put(c.id,'cache',c);
  for(const l of snapshot.loot||[])put(l.id,'loot',l);
  for(const b of snapshot.bags)put(b.id,'bag',b);
  for(const p of snapshot.pings||[])put('ping_'+p.id,'ping',p);
  for(const e of snapshot.exits)put(e.id,'exit',e);
  for(const door of snapshot.doors||[])put('door_'+door.id,'door',door);
  // Rebuild the collision overlay per snapshot. The frozen shared world is
  // never mutated; the camera, projectile traces and prediction all read this
  // authoritative door state instead.
  this.activeWorld={...this.world,doors:(snapshot.doors||[]).map(door=>({...door,closed:!!door.closed,locked:!!door.locked}))};
  for(const [key,entry]of this.actors)if(!live.has(key)){this.scene.remove(entry.model);disposeOwned(entry.model);this.actors.delete(key)}
  const effects=new Set();
  for(const warning of [...(snapshot.telegraphs||[]),...(snapshot.hazards||[]).filter(h=>h.active||h.warning)]){
   const key=warning.id;effects.add(key);let ring=this.effects.get(key);
   if(!ring){const geometry=new THREE.TorusGeometry(warning.radius,.065,4,40),material=new THREE.MeshBasicMaterial({color:0xff805b,transparent:true,opacity:.8});geometry.userData.raidOwned=true;material.userData.raidOwned=true;ring=new THREE.Mesh(geometry,material);ring.rotation.x=Math.PI/2;this.scene.add(ring);this.effects.set(key,ring)}
   ring.position.set(warning.x,(warning.y||0)+.13,warning.z);ring.material.color.setHex(warning.active?0xff3d32:0xffb76d);
  }
  for(const [key,ring]of this.effects)if(!effects.has(key)){this.scene.remove(ring);disposeOwned(ring);this.effects.delete(key)}
  this.syncUtilities(snapshot);
  const observer=snapshot.camera||snapshot.self,eye={x:observer.x,y:(observer.y||0)+1.6,z:observer.z},insideSmoke=!smokeClear(snapshot.utilities,eye,eye,snapshot.serverTime);
  const conditions=insideSmoke?{...(snapshot.conditions||mapConditions(this.world)),fog:0x9aa6a1,visibility:.07}:snapshot.conditions||mapConditions(this.world);this.environmentTarget={sky:new THREE.Color(conditions.sky),fog:new THREE.Color(conditions.fog),visibility:conditions.visibility,light:conditions.light,ambient:conditions.ambient??1.8,daylight:conditions.daylight??1,sun:new THREE.Vector3((conditions.sun?.x??-30)*this.viewScale,(conditions.sun?.y??65)*this.viewScale,(conditions.sun?.z??35)*this.viewScale)};
  if(!this.scene.background){this.scene.background=this.environmentTarget.sky.clone();this.scene.fog=new THREE.Fog(conditions.fog,24*this.viewScale*conditions.visibility,125*this.viewScale*conditions.visibility);this.updateEnvironment(1);
   // Build the IBL once from the deployment sky. Materials then reflect the
   // same horizon and sun the camera sees, and the render target is released by
   // clear()/start() so repeated deployments do not accumulate GPU memory.
   if(!this.envMapRT){this.envMapRT=this.createEnvironmentMap(this.environmentTarget);this.scene.environment=this.envMapRT.texture}}
  // The first-person pass shares the deployment reflection probe so metal
  // surfaces pick up the same sky and sun as the world, instead of a flat fill.
  if(this.envMapRT&&this.overlay&&this.overlay.environment!==this.envMapRT.texture)this.overlay.environment=this.envMapRT.texture;
  const weather=conditions.weather||'clear';
  if(weather==='clear'){if(this.weather)this.weather.visible=false}
  else{if(!this.weather||this.weatherKind!==weather)this.buildWeather(weather);this.weather.visible=!this.settings?.reduced;this.weather.material.color.setHex(weather==='ash'?0xd6a17b:weather==='mist'?0xc3d0c8:0xaecade)}
  const item=[...snapshot.self.equipment,...snapshot.self.pack].find(it=>it.id===snapshot.self.weaponId);
  this.gunRoot.visible=!!item&&this.viewMode==='first';
  if(this.selfActor&&this.selfActor.userData.heldWeapon!==(item?.weapon??null))setHumanWeapon(this.selfActor,item?.weapon??null);
  if(item&&this.lastWeapon!==item.id){this.lastWeapon=item.id;for(const child of [...this.gunRoot.children]){this.gunRoot.remove(child);disposeOwned(child)}this.gun=weaponModel(item.weapon,true);this.gunRoot.add(this.gun);this.attachMuzzleFlash(item);this.vmEquipAt=performance.now()}
 }
 // The muzzle glow is rebuilt with each held weapon and rides the recoiling
 // gunRoot. It is presentation-only and disposed with the overlay.
 attachMuzzleFlash(item=null){
  if(!this.gun)return;
  const muzzle=this.gun.userData.info?.muzzle||[0,.05,-.35];
  this.muzzleLocal=new THREE.Vector3(muzzle[0],muzzle[1],muzzle[2]);
  // Pick the authored silhouette from the equipped weapon rather than one
  // generic radial blob: shotguns throw a broad fan, snipers a lance, pistols a
  // compact cross, and so on.
  const stats=item?weaponStats(item):null;
  const family=stats?.class||'rifle';
  const profile=(stats?.pellets||0)>1?'shotgun':family==='sniper'?'sniper':family==='smg'?'smg':family==='lmg'?'heavy':family==='pistol'?'pistol':'rifle';
  const shape=FLASH_PROFILES[profile]||FLASH_PROFILES.rifle;
  this.flashProfile=profile;this.flashSpikes=shape.spikes;this.muzzleBaseScale=shape.scale;
  const texture=muzzleFlashTexture(profile);
  const material=new THREE.SpriteMaterial({map:texture,color:FLASH_PROFILES[profile].tint,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});material.userData.raidOwned=true;material.userData.raidOwnTexture=true;
  const sprite=new THREE.Sprite(material);sprite.position.copy(this.muzzleLocal);sprite.scale.setScalar(0);sprite.visible=false;
  this.muzzleFlash=sprite;this.gunRoot.add(sprite);
  // The additive sprite reads as a bloom, but a real pooled point light is what
  // warms the hands and receiver around the muzzle. It shares the flash window,
  // carries no geometry/texture, and is rebuilt only when the weapon changes.
  const light=new THREE.PointLight(0xffd49a,0,3,2);light.position.copy(this.muzzleLocal);light.visible=false;light.castShadow=false;this.muzzleLight=light;this.gunRoot.add(light);
  // Track the held weapon's PBR materials so barrel heat can tint them. This
  // does not allocate or clone anything; the materials are already owned by
  // the weapon and disposed with it.
  this.heat=0;this.heatPeak=0;this.gunHeatMaterials=[];
  const seen=new Set();this.gun.traverse(node=>{const material=node.material;if(node.isMesh&&material?.isMeshStandardMaterial&&!seen.has(material)){seen.add(material);material.emissive.setRGB(0,0,0);this.gunHeatMaterials.push(material)}});
  // Muzzle smoke: a cool grey puff that trails the flash and dissipates.
  const smokeCanvas=document.createElement('canvas');smokeCanvas.width=smokeCanvas.height=64;
  const smokeContext=smokeCanvas.getContext('2d'),smokeGradient=smokeContext.createRadialGradient(32,32,0,32,32,32);
  smokeGradient.addColorStop(0,'rgba(255,255,255,.8)');smokeGradient.addColorStop(.45,'rgba(205,216,220,.52)');smokeGradient.addColorStop(1,'rgba(160,175,181,0)');
  smokeContext.fillStyle=smokeGradient;smokeContext.fillRect(0,0,64,64);
  const smokeTexture=new THREE.CanvasTexture(smokeCanvas);smokeTexture.colorSpace=THREE.SRGBColorSpace;
  const smoke=new THREE.SpriteMaterial({map:smokeTexture,color:0xc7d3d7,transparent:true,opacity:0,depthTest:false,depthWrite:false});smoke.userData.raidOwned=true;smoke.userData.raidOwnTexture=true;
  this.muzzleSmoke=new THREE.Sprite(smoke);this.muzzleSmoke.position.copy(this.muzzleLocal);this.muzzleSmoke.scale.setScalar(0);this.muzzleSmoke.visible=false;this.gunRoot.add(this.muzzleSmoke);
  // A fixed brass-casing pool: one shared small-canvas texture, eight recycled
  // sprites, no allocation on the firing path.
  const caseCanvas=document.createElement('canvas');caseCanvas.width=caseCanvas.height=32;
  const caseContext=caseCanvas.getContext('2d');caseContext.fillStyle='#f1cf76';caseContext.fillRect(12,6,8,21);caseContext.fillStyle='#fff0be';caseContext.fillRect(12,6,3,21);caseContext.fillStyle='#957337';caseContext.fillRect(12,25,8,3);caseContext.fillStyle='#b59a55';caseContext.fillRect(16,8,2,17);
  const caseTexture=new THREE.CanvasTexture(caseCanvas);caseTexture.colorSpace=THREE.SRGBColorSpace;
  this.caseFx=this.caseFx?.filter(sprite=>sprite.parent===this.gunRoot)||[];
  if(this.caseFx.length){for(const sprite of this.caseFx)for(const entry of [sprite.material])if(entry){if(entry.map&&entry.map!==caseTexture)entry.map.dispose();entry.map=caseTexture;entry.needsUpdate=true}}
  else{
   for(let i=0;i<8;i++){
    const material=new THREE.SpriteMaterial({map:caseTexture,color:0xfff2c8,transparent:true,opacity:0,depthTest:false,depthWrite:false});
    material.userData.raidOwned=true;if(i===0)material.userData.raidOwnTexture=true;
    const casing=new THREE.Sprite(material);casing.scale.setScalar(.024);casing.visible=false;casing.userData={life:0,max:1,vx:0,vy:0,vz:0};
    this.gunRoot.add(casing);this.caseFx.push(casing);
   }
  }
  // Reload handling prop: one fixed, owned PBR magazine that only moves during
  // an accepted reload. It shares the overlay environment but allocates nothing
  // per reload and is disposed with the weapon root.
  const pivot=this.gun.userData.info?.piv?.mag||[0,-.055,-.02];
  this.reloadMagBase=new THREE.Vector3(pivot[0],pivot[1],pivot[2]);
  const bodyGeometry=new THREE.BoxGeometry(.055,.18,.035);bodyGeometry.userData.raidOwned=true;
  const bodyMaterial=new THREE.MeshStandardMaterial({color:0x3f474a,metalness:.68,roughness:.36,envMapIntensity:1.25});bodyMaterial.userData.raidOwned=true;
  const bodyMesh=new THREE.Mesh(bodyGeometry,bodyMaterial);bodyMesh.position.y=-.09;
  const lipGeometry=new THREE.BoxGeometry(.055,.022,.038);lipGeometry.userData.raidOwned=true;
  const lipMaterial=new THREE.MeshStandardMaterial({color:0xc9a95a,metalness:.74,roughness:.28,envMapIntensity:1.4});lipMaterial.userData.raidOwned=true;
  const lipMesh=new THREE.Mesh(lipGeometry,lipMaterial);lipMesh.position.y=.012;
  this.reloadMag=new THREE.Group();this.reloadMag.add(bodyMesh,lipMesh);this.reloadMag.position.copy(this.reloadMagBase);this.reloadMag.visible=false;this.gunRoot.add(this.reloadMag);
  this.reloadStartedAt=0;this.reloadDuration=0;
 }
 // Start a physical reload handling beat after an accepted reload. Defaults to
 // the held weapon's authoritative reload time and stays entirely presentational.
 beginReload(durationMs){
  if(this.settings?.reduced||this.viewMode!=='first'||!this.gun||!this.gunRoot?.visible)return false;
  const s=this.snapshot?.self,item=s&&[...s.equipment,...s.pack].find(it=>it.id===s.weaponId);
  const seconds=item?weaponStats(item).reload:1.2;
  const ms=Math.max(350,Math.min(4000,Number(durationMs)||seconds*1000));
  this.reloadStartedAt=performance.now();this.reloadDuration=ms;
  if(this.reloadMag){this.reloadMag.visible=true;this.reloadMag.position.copy(this.reloadMagBase);this.reloadMag.rotation.set(0,0,0)}
  return true;
 }
 // Presentation-only per-shot particulate. It reads the same fields as the
 // visual kick but never mutates aim, ballistics or snapshot state.
 spawnViewModelEffects(){
  if(this.settings?.reduced||this.viewMode!=='first'||!this.gun||!this.gunRoot.visible)return;
  // Sustained fire accumulates barrel heat. Heavy/shotgun report a stronger
  // per-shot temperature jump than a rifle or SMG, but the value is bounded.
  const profile=this.flashProfile||'rifle',gain=profile==='shotgun'||profile==='heavy'?.3:profile==='sniper'?.34:.2;
  this.heat=Math.min(1,(this.heat||0)+gain);this.heatPeak=Math.max(this.heatPeak||0,this.heat);
  const info=this.gun.userData.info||{},eject=info.eject||[-.08,.03,-.3];
  if(this.caseFx?.length){
   const casing=this.caseFx[this.caseCursor++%this.caseFx.length];
   casing.position.set(eject[0],eject[1],eject[2]);
   const vy=info.ejDown?-.05:info.ejUp?(.8+Math.random()*.2):(.85+Math.random()*.35);
   casing.userData={age:0,max:.3+Math.random()*.09,vx:(eject[0]>=0?1:-1)*(.55+Math.random()*.32),vy,vz:.05+Math.random()*.14,spin:Math.random()*Math.PI*2};
   casing.material.rotation=casing.userData.spin;casing.material.opacity=.95;casing.visible=true;
  }
  if(this.muzzleSmoke){this.muzzleSmokeAt=performance.now();this.muzzleSmoke.position.copy(this.muzzleLocal);this.muzzleSmoke.visible=true}
 }
 smokeModel(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d'),gradient=context.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.45,'rgba(255,255,255,.85)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas),root=new THREE.Group();
  for(let i=0;i<9;i++){const material=new THREE.SpriteMaterial({map:texture,color:0x9aa6a1,transparent:true,opacity:.65,depthWrite:false});material.userData.raidOwned=true;material.userData.raidOwnTexture=i===0;const puff=new THREE.Sprite(material),angle=i*2.399963;puff.position.set(i?Math.cos(angle)*.38:0,i?Math.sin(angle*2)*.2:0,i?Math.sin(angle)*.38:0);puff.userData.baseX=puff.position.x;puff.userData.baseY=puff.position.y;puff.scale.setScalar(i?1.2:1.6);root.add(puff)}return root;
 }
 syncUtilities(snapshot){
  const live=new Set();for(const e of snapshot.utilities||[]){
   live.add(e.id);let mesh=this.utilityEffects.get(e.id);
   if(!mesh){
    if(e.kind==='smoke')mesh=this.smokeModel();
    else{const geometry=new THREE.TorusGeometry(e.kind==='frag'?e.radius:.6,.07,4,36),material=new THREE.MeshBasicMaterial({color:e.kind==='frag'?0xffa360:0x78d6e0,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});geometry.userData.raidOwned=material.userData.raidOwned=true;mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=Math.PI/2}
    mesh.userData.kind=e.kind;this.scene.add(mesh);this.utilityEffects.set(e.id,mesh);
   }
   const active=snapshot.serverTime>=e.activeAt;mesh.position.set(e.x,e.y+(e.kind==='smoke'?1.5:.15),e.z);mesh.userData.active=active;mesh.userData.radius=e.radius;
   if(e.kind==='smoke'){if(!active)mesh.scale.setScalar(.15)}
   else if(e.kind==='frag'){
    mesh.material.color.setHex(e.detonated?0xff3825:0xffa360);
    // A frag crossing into detonation spawns one pooled blast; the transition
    // is tracked per mesh so network snapshots that repeat cannot multiply it.
    if(active&&e.detonated&&mesh.userData.detonated!==true){mesh.userData.detonated=true;this.spawnBlast(e.x,e.y||0,e.z,e.radius)}
   }
  }
  for(const [id,mesh]of this.utilityEffects)if(!live.has(id)){this.scene.remove(mesh);disposeOwned(mesh);this.utilityEffects.delete(id)}
 }
 buildSky(snapshot=null){
  const skyMaterial=new THREE.ShaderMaterial({vertexShader:SKY_VERT,fragmentShader:SKY_FRAG,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
   uniforms:{top:{value:new THREE.Color(0x16233d)},mid:{value:new THREE.Color(0x2c3a4e)},bot:{value:new THREE.Color(0x7a766b)},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color(0xffd7a5)},sunI:{value:1},uScatter:{value:0},cloudCol:{value:new THREE.Color(0x8b8b86)},uCloud:{value:0},cloudTime:{value:0}}});
  skyMaterial.userData.raidOwned=true;
  const skyGeometry=new THREE.SphereGeometry(195*this.viewScale,32,16);skyGeometry.userData.raidOwned=true;
  this.skyDome=new THREE.Mesh(skyGeometry,skyMaterial);this.skyDome.renderOrder=-11;this.skyDome.frustumCulled=false;this.scene.add(this.skyDome);
  const orb=(radius,color)=>{const geometry=new THREE.SphereGeometry(radius,12,8),material=new THREE.MeshBasicMaterial({color,fog:false,depthWrite:false});geometry.userData.raidOwned=material.userData.raidOwned=true;const mesh=new THREE.Mesh(geometry,material);this.scene.add(mesh);return mesh};
  this.sunOrb=orb(3.4*this.viewScale,0xffd7a5);this.moonOrb=orb(2.2*this.viewScale,0xd6e6f6);
  const positions=[],radius=185*this.viewScale;for(let i=0;i<220;i++){const y=.08+.88*(i+.5)/220,angle=i*2.399963,ring=Math.sqrt(1-y*y);positions.push(Math.cos(angle)*ring*radius,y*radius,Math.sin(angle)*ring*radius)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.userData.raidOwned=true;const material=new THREE.PointsMaterial({color:0xdfebff,size:.4*this.viewScale,transparent:true,opacity:0,fog:false,depthWrite:false});material.userData.raidOwned=true;this.stars=new THREE.Points(geometry,material);this.scene.add(this.stars);
  // Behind the playable sector, two layered ruined-district silhouettes fade
  // toward the sector fog tint; dust columns rise from selected broken roofs.
  // The group is centred on the live camera each frame so it always occupies the
  // horizon ring, and its materials are fog-painted, deterministic and static.
  // Match the skyline tint to the deployment's own atmospheric haze (weather,
  // timeline and sector theme) instead of a fixed sector default, so distant
  // ruins dissolve into the exact fog colour the camera sees.
  const horizonConditions=snapshot?.conditions||mapConditions(this.world),horizonFog=horizonConditions.fog??0x9aa9b4;
  const horizonBase={industrial:0x354951,wilderness:0x455f5b,settlement:0x50505b}[this.world.theme]||0x354951;
  this.horizonDepth=makeRaidHorizon(this.world.id,horizonFog,{radius:110*this.viewScale,scale:Math.max(1,this.viewScale*.3),base:horizonBase});
  this.scene.add(this.horizonDepth);
  this.buildAtmosphere();
 }
 buildAtmosphere(){
  // Sunlit dust motes drift through a 32 m volume around the operator. They are
  // additive sparks caught in daylight, deterministic in placement, and hidden
  // during rain/ash, at night and whenever reduced motion is requested.
  const count=240,offsets=new Float32Array(count*3),phases=new Float32Array(count),positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   const angle=i*2.399963,radius=2+14*((i*.6180339)%1),height=.35+12.5*((i*.381966)%1);
   offsets[i*3]=Math.cos(angle)*radius;offsets[i*3+1]=height;offsets[i*3+2]=Math.sin(angle)*radius;phases[i]=i*.73;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.userData.raidOwned=true;
  const material=new THREE.PointsMaterial({map:TX.soft,color:0xffdd9e,size:.075,transparent:true,opacity:0,blending:THREE.AdditiveBlending,sizeAttenuation:true,depthWrite:false,fog:true});
  material.userData.raidOwned=true;
  this.motes=new THREE.Points(geometry,material);this.motes.frustumCulled=false;this.motes.renderOrder=2;this.motes.visible=false;this.scene.add(this.motes);
  this.motesState={offsets,phases};this.motesAnchor=null;
 }
 // Rain renders as additive motion streaks, snow/ash/mist as soft particles. The
 // mesh is rebuilt when the front changes so the flat Points cloud of the old
 // renderer does not hide the weather the snapshot announces.
 buildWeather(kind){
  if(this.weather){this.scene.remove(this.weather);disposeOwned(this.weather);this.weather=null}
  const size=this.world?.size||1440;
  let geometry,material,state;
  if(kind==='rain'){
   const count=360,arr=new Float32Array(count*6),colors=new Float32Array(count*6);
   state={mode:'rain',drops:[]};
   for(let i=0;i<count;i++){const d={x:(Math.random()-.5)*size,z:(Math.random()-.5)*size,y:Math.random()*38,len:1.1+Math.random()*1.9,speed:16+Math.random()*10};state.drops.push(d);writeRain(arr,i,d);
    colors[i*6]=.55;colors[i*6+1]=.7;colors[i*6+2]=.86;colors[i*6+3]=.06;colors[i*6+4]=.1;colors[i*6+5]=.16}
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(arr,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   material=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,fog:true});
   this.weather=new THREE.LineSegments(geometry,material);
  }else{
   const count=kind==='mist'?110:460,arr=new Float32Array(count*3);
   state={mode:kind,points:[],ceiling:kind==='mist'?16:kind==='ash'?30:34};
   for(let i=0;i<count;i++){const p={x:(Math.random()-.5)*size,z:(Math.random()-.5)*size,y:kind==='mist'?1+Math.random()*14:Math.random()*state.ceiling,speed:kind==='mist'?.12:kind==='ash'?.5:.9};state.points.push(p);arr[i*3]=p.x;arr[i*3+1]=p.y;arr[i*3+2]=p.z}
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(arr,3));
   material=new THREE.PointsMaterial({map:TX.soft,color:0xffffff,size:kind==='mist'?2.4:kind==='ash'?.10:.13,transparent:true,opacity:kind==='mist'?.26:.72,depthWrite:false,blending:kind==='mist'?THREE.NormalBlending:THREE.AdditiveBlending,sizeAttenuation:true,fog:true});
   this.weather=new THREE.Points(geometry,material);
  }
  geometry.userData.raidOwned=true;material.userData.raidOwned=true;
  this.weather.renderOrder=3;this.weather.frustumCulled=false;this.scene.add(this.weather);
  this.weatherKind=kind;this.weatherState=state;
 }
 createEnvironmentMap(target){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const context=canvas.getContext('2d');
  const css=color=>'#'+color.getHexString();
  const top=target.sky.clone(),mid=top.clone().lerp(target.fog,.5),ground=target.fog.clone().multiplyScalar(.55);
  const gradient=context.createLinearGradient(0,0,0,128);gradient.addColorStop(0,css(top));gradient.addColorStop(.45,css(mid));gradient.addColorStop(.55,css(mid));gradient.addColorStop(1,css(ground));
  context.fillStyle=gradient;context.fillRect(0,0,256,128);
  if(target.sun.y>0){const dir=target.sun.clone().normalize(),u=((Math.atan2(dir.z,dir.x)/(Math.PI*2))+.5)%1,v=.5-Math.asin(Math.max(-1,Math.min(1,dir.y)))/Math.PI,sx=u*256,sy=v*128,glow=context.createRadialGradient(sx,sy,0,sx,sy,20);
   glow.addColorStop(0,'rgba(255,252,238,1)');glow.addColorStop(.35,'rgba(255,230,180,.9)');glow.addColorStop(1,'rgba(255,210,150,0)');context.fillStyle=glow;context.beginPath();context.arc(sx,sy,20,0,7);context.fill()}
  const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(this.renderer),renderTarget=pmrem.fromEquirectangular(texture);
  texture.dispose();pmrem.dispose();return renderTarget;
 }
 updateEnvironment(blend){
  const target=this.environmentTarget;if(!target)return;const weather=this.snapshot?.conditions?.weather||'clear';this.scene.background.lerp(target.sky,blend);this.scene.fog.color.lerp(target.fog,blend);this.scene.fog.near+=(24*this.viewScale*target.visibility-this.scene.fog.near)*blend;this.scene.fog.far+=(125*this.viewScale*target.visibility-this.scene.fog.far)*blend;this.sun.intensity+=(target.light-this.sun.intensity)*blend;this.hemi.intensity+=(target.ambient-this.hemi.intensity)*blend;
  const lightPosition=target.sun.y>=0?target.sun:target.sun.clone().multiplyScalar(-1);this.sunDirection.lerp(lightPosition.clone().normalize(),blend).normalize();this.sunOrb.position.copy(target.sun);this.moonOrb.position.copy(target.sun).multiplyScalar(-1);this.sunOrb.visible=target.sun.y>0;this.moonOrb.visible=target.sun.y<0;this.stars.material.opacity+=(1-target.daylight-this.stars.material.opacity)*blend;this.stars.visible=target.daylight<.85&&this.stars.material.opacity>.01;
  if(this.skyDome){const u=this.skyDome.material.uniforms,weather=this.snapshot?.conditions?.weather||'clear',damp=weather==='rain'?.55:weather==='ash'?.7:1;u.top.value.lerp(target.sky,blend);u.mid.value.lerp(SKY_MID.copy(target.sky).lerp(target.fog,.42),blend);u.bot.value.lerp(target.fog,blend);u.sunDir.value.copy(target.sun).normalize();u.sunI.value+=(target.daylight-u.sunI.value)*blend;u.uScatter.value+=(Math.max(0,Math.min(1,target.daylight))*damp-u.uScatter.value)*blend;
   // Cloud deck follows the weather: thin haze by day, heavy low ceiling under
   // rain, dust-laden ash, and dark night cover whose tint comes from the same
   // authored fog/sky so every front stays cohesive with the horizon haze.
   const cloudTarget=weather==='rain'?.92:weather==='ash'?.8:weather==='mist'?.55:.3;
   u.uCloud.value+=(cloudTarget-u.uCloud.value)*blend;
   // Lift the fog/sky tint toward white in daylight so the deck reads across
   // clear, mist and rain fronts, then darken it with the daylight envelope so
   // night cover stays deep instead of glowing grey.
   const daylight=Math.max(0,Math.min(1,target.daylight||0));
   CLOUD_MIX.copy(target.fog).lerp(target.sky,.3).lerp(CLOUD_WHITE,.34).multiplyScalar(.58+.5*daylight);
   u.cloudCol.value.lerp(CLOUD_MIX,blend);
  }
 // Authored practicals ignite as daylight falls: lamp heads, floodlights and
 // campfires bloom through the additive field. The static halos use the same
 // damped weather response as the sky scattering, so storms stay diffuse.
 if(this.glowPoints){const night=Math.pow(Math.max(0,Math.min(1,1-(target.daylight||0))),1.35),damp=weather==='rain'?.55:weather==='ash'?.7:1,targetOpacity=Math.min(.9,night*.85*damp);this.glowPoints.material.opacity+=(targetOpacity-this.glowPoints.material.opacity)*blend;this.glowPoints.visible=this.glowPoints.material.opacity>.008}
 if(this.glowPools){const night=Math.pow(Math.max(0,Math.min(1,1-(target.daylight||0))),1.2),damp=weather==='rain'?.55:weather==='ash'?.7:1,targetOpacity=Math.min(.6,night*.65*damp);this.glowPools.material.opacity+=(targetOpacity-this.glowPools.material.opacity)*blend;this.glowPools.visible=this.glowPools.material.opacity>.008}
 this.updateWetReflections();
 }
 updateAtmosphere(seconds){
  const reduced=!!this.settings?.reduced;
  // The cloud deck drifts with scene time but is frozen for reduced motion, so
  // the sky shares the same stillness guarantee as the dust field.
  if(this.skyDome)this.skyDome.material.uniforms.cloudTime.value=reduced?0:seconds;
  if(!this.motes)return;const weather=this.snapshot?.conditions?.weather||'clear',target=this.environmentTarget;
  const visible=!reduced&&!!target&&target.daylight>.25&&weather==='clear';
  this.motes.visible=visible;this.motes.material.opacity=visible?Math.min(.55,.5*target.daylight):0;
  if(!visible)return;
  const s=this.snapshot?.self||this.snapshot?.camera;if(!s)return;
  if(!this.motesAnchor)this.motesAnchor=new THREE.Vector3();
  this.motesAnchor.set(s.x||0,s.y||0,s.z||0);
  const position=this.motes.geometry.attributes.position.array,{offsets,phases}=this.motesState;
  for(let i=0;i<phases.length;i++){const k=i*3,p=phases[i];
   position[k]=this.motesAnchor.x+offsets[k]+Math.sin(seconds*.31+p)*.6;
   position[k+1]=this.motesAnchor.y+offsets[k+1]+Math.cos(seconds*.27+p*1.3)*.35;
   position[k+2]=this.motesAnchor.z+offsets[k+2]+Math.sin(seconds*.23+p*.7)*.55;
  }
  this.motes.geometry.attributes.position.needsUpdate=true;
 }
 // Weather-responsive PBR: a passing rain front wets roofs, roads and terrain
 // toward a lower roughness / higher environmental sheen; every material keeps
 // a captured dry baseline so clear weather restores the authored values exactly.
 updateWetness(dt){
  const weather=this.snapshot?.conditions?.weather||'clear',target=weather==='rain'?1:weather==='mist'?.35:0;
  this.wetness=this.settings?.reduced?target:this.wetness+(target-this.wetness)*(1-Math.exp(-dt*1.6));
  if(Math.abs(this.wetness-target)<.001)this.wetness=target;
  this.applyWetness();this.updateWetReflections();
 }
 // The wet glint field is derived only from authored practicals/windows and
 // brightens as the same smoothed wetness state reaches the streets. It stays
 // under the practical day/night envelope so wet roads reflect their warm lamp
 // and window sources rather than inventing daylight reflections.
 updateWetReflections(){
  const mesh=this.wetReflections;if(!mesh)return;
  const daylight=this.environmentTarget?.daylight??1;
  const night=Math.pow(Math.max(0,Math.min(1,1-daylight)),1.1);
  mesh.material.opacity=Math.min(.55,Math.max(0,this.wetness||0)*night);
  mesh.visible=mesh.material.opacity>.004;
  // Feed the head-on drawing-buffer height into the instanced glint shader so
  // sub-pixel distant streaks fade before they alias. The shader is compiled
  // on first render; until then the default resolution leaves near streaks
  // unaffected, and each subsequent frame refreshes the uniform.
  const shader=mesh.material.userData.raidGlintShader;
  if(shader?.uniforms.uGlintResolution){
   const size=shader.uniforms.uGlintResolution.value;
   const width=this.canvas.width|0,height=this.canvas.height|0;
   if(size.x!==width||size.y!==height)size.set(width,height);
  }
 }
 applyWetness(){
  for(const material of this.wetMaterials||[]){
   const dry=material.userData.raidDry;if(!dry)continue;
   const amount=(this.wetness||0)*(material.userData.raidWet||0);
   material.roughness=dry.roughness*(1-.58*amount);
   material.metalness=dry.metalness+(.34-dry.metalness)*amount;
   material.envMapIntensity=dry.envMapIntensity+(1.35-dry.envMapIntensity)*amount;
   if(dry.normalScale!=null&&material.normalScale)material.normalScale.setScalar(dry.normalScale*(1+amount*.5));
  }
 }
 // Combat presentation reuses a bounded pool of meshes so sustained fire never
 // allocates geometry/material objects. Every pool owner is tagged for the
 // scene disposal contract used by clear()/start().
 buildCombatEffects(){
  if(!this.scene||this.shotEffects.length)return;
  const shockCanvas=document.createElement('canvas');shockCanvas.width=shockCanvas.height=64;
  const shockContext=shockCanvas.getContext('2d'),shockGradient=shockContext.createRadialGradient(32,32,3,32,32,31);
  shockGradient.addColorStop(0,'rgba(12,8,5,.95)');shockGradient.addColorStop(.55,'rgba(24,14,8,.62)');shockGradient.addColorStop(1,'rgba(40,24,14,0)');
  shockContext.fillStyle=shockGradient;shockContext.fillRect(0,0,64,64);
  for(let i=0;i<11;i++){const r=3+Math.random()*5;shockContext.fillStyle='rgba(8,5,3,'+(.25+Math.random()*.35)+')';shockContext.beginPath();shockContext.arc(8+Math.random()*48,8+Math.random()*48,r,0,7);shockContext.fill()}
  const shockTexture=new THREE.CanvasTexture(shockCanvas);shockTexture.colorSpace=THREE.SRGBColorSpace;
  const chipCanvas=document.createElement('canvas');chipCanvas.width=chipCanvas.height=16;
  const chipContext=chipCanvas.getContext('2d');chipContext.fillStyle='#fff';chipContext.beginPath();chipContext.moveTo(8,1);chipContext.lineTo(15,6);chipContext.lineTo(12,15);chipContext.lineTo(4,13);chipContext.lineTo(1,5);chipContext.closePath();chipContext.fill();
  const chipTexture=new THREE.CanvasTexture(chipCanvas);
  const sparkCount=14,emberCount=18,chipCount=8,shotDuration=260,blastDuration=900,scorchDuration=1800;
  for(let i=0;i<16;i++){
   const muzzleMaterial=new THREE.SpriteMaterial({map:TX.soft,color:0xffdc93,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
   muzzleMaterial.userData.raidOwned=true;
   const muzzle=new THREE.Sprite(muzzleMaterial);muzzle.visible=false;muzzle.renderOrder=4;this.scene.add(muzzle);
   const tracerGeometry=new THREE.BufferGeometry();tracerGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
   const tracerMaterial=new THREE.LineBasicMaterial({color:0xffe3aa,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:true});
   tracerGeometry.userData.raidOwned=tracerMaterial.userData.raidOwned=true;
   const tracer=new THREE.Line(tracerGeometry,tracerMaterial);tracer.visible=false;tracer.frustumCulled=false;tracer.renderOrder=3;this.scene.add(tracer);
   const sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(sparkCount*3),3));
   const sparkMaterial=new THREE.PointsMaterial({map:TX.soft,color:0xffc978,size:.12,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
   sparkGeometry.userData.raidOwned=sparkMaterial.userData.raidOwned=true;
   const sparks=new THREE.Points(sparkGeometry,sparkMaterial);sparks.visible=false;sparks.frustumCulled=false;sparks.renderOrder=4;this.scene.add(sparks);
   const dustMaterial=new THREE.SpriteMaterial({map:TX.soft,color:0xb9b3a4,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending});
   dustMaterial.userData.raidOwned=true;
   const dust=new THREE.Sprite(dustMaterial);dust.visible=false;dust.renderOrder=3;this.scene.add(dust);
   // Angular chips read as dislodged masonry and shrapnel instead of the round
   // soft motes used for dust; gravity and surface hue link them to the hit.
   const debrisGeometry=new THREE.BufferGeometry();debrisGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(chipCount*3),3));
   const debrisMaterial=new THREE.PointsMaterial({map:chipTexture,color:0xa8a394,size:.1,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true,alphaTest:.15});
   debrisGeometry.userData.raidOwned=debrisMaterial.userData.raidOwned=true;debrisMaterial.userData.raidOwnTexture=true;chipTexture.userData.raidOwned=true;
   const debris=new THREE.Points(debrisGeometry,debrisMaterial);debris.visible=false;debris.frustumCulled=false;debris.renderOrder=4;this.scene.add(debris);
   const trailMaterial=new THREE.SpriteMaterial({map:TX.soft,color:0xffd18b,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
   trailMaterial.userData.raidOwned=true;
   const trailRoot=new THREE.Group();trailRoot.visible=false;this.scene.add(trailRoot);
   const trailSprites=[];for(let j=0;j<8;j++){const sprite=new THREE.Sprite(trailMaterial);trailRoot.add(sprite);trailSprites.push(sprite)}
   this.shotEffects.push({muzzle,tracer,sparks,dust,debris,trailRoot,trailSprites,trailMaterial,dustMaterial,debrisMaterial,started:null,origin:new THREE.Vector3(),dir:new THREE.Vector3(),end:new THREE.Vector3(),velocities:new Float32Array(sparkCount*3),debrisVelocities:new Float32Array(chipCount*3),sparkCount,chipCount,shotDuration,surface:'concrete'});
  }
  // One pooled warm light travels with the most recent accepted shot. The
  // additive muzzle billboard is deliberately tiny; this light is what lets
  // nearby cover and terrain catch the brief flash. It is hidden at rest and
  // under reduced motion, and reused in place so sustained fire allocates
  // neither lights nor shadows.
  const shotLight=new THREE.PointLight(0xffc46a,0,7.5,2);
  shotLight.visible=false;shotLight.castShadow=false;
  shotLight.userData.raidCombatLight=true;
  this.scene.add(shotLight);
  this.shotMuzzleLight=shotLight;
  for(let i=0;i<6;i++){
   const ringGeometry=new THREE.TorusGeometry(1,.055,5,48);
   const ringMaterial=new THREE.MeshBasicMaterial({color:0xffa860,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
   ringGeometry.userData.raidOwned=ringMaterial.userData.raidOwned=true;
   const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=Math.PI/2;ring.visible=false;ring.frustumCulled=false;ring.renderOrder=3;this.scene.add(ring);
   const flashMaterial=new THREE.SpriteMaterial({map:TX.soft,color:0xfff3d2,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
   flashMaterial.userData.raidOwned=true;
   const flash=new THREE.Sprite(flashMaterial);flash.visible=false;flash.renderOrder=4;this.scene.add(flash);
   const emberGeometry=new THREE.BufferGeometry();emberGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(emberCount*3),3));
   const emberMaterial=new THREE.PointsMaterial({map:TX.soft,color:0xffb25e,size:.16,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
   emberGeometry.userData.raidOwned=emberMaterial.userData.raidOwned=true;
   const embers=new THREE.Points(emberGeometry,emberMaterial);embers.visible=false;embers.frustumCulled=false;embers.renderOrder=4;this.scene.add(embers);
   // A second point field per detonation reads as rolling powder smoke: matte
   // normal-blended puffs that rise, redden near the core and widen outward.
   // It shares the authored smoke canvas with the utility smoke meshes, so no
   // new texture is allocated and the shared canvas is never owned/disposed.
   const plumeCount=18;
   const plumeShades=new Float32Array(plumeCount*3);
   for(let i=0;i<plumeCount;i++){const shade=.36+((i*7)%11)/11*.28;plumeShades[i*3]=shade*.94;plumeShades[i*3+1]=shade*.9;plumeShades[i*3+2]=shade*.82}
   const plumeGeometry=new THREE.BufferGeometry();plumeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(plumeCount*3),3));plumeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(plumeShades,3));
   const plumeMaterial=new THREE.PointsMaterial({map:TX.smoke,color:0xb9b9ad,size:.2,transparent:true,opacity:0,vertexColors:true,depthWrite:false,depthTest:true,sizeAttenuation:true,blending:THREE.NormalBlending,fog:true});
   plumeGeometry.userData.raidOwned=plumeMaterial.userData.raidOwned=true;
   const plume=new THREE.Points(plumeGeometry,plumeMaterial);plume.visible=false;plume.frustumCulled=false;plume.renderOrder=3;this.scene.add(plume);
   // Angular masonry/metal fragments thrown by the blast. They reuse the shot
   // pool's chip canvas (so no texture allocation), follow gravity, and die with
   // the flash; the texture ownership stays with the shot debris owner.
   const chunkCount=12;
   const chunkGeometry=new THREE.BufferGeometry();chunkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(chunkCount*3),3));
   const chunkMaterial=new THREE.PointsMaterial({map:chipTexture,color:0x6f6658,size:.22,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true,alphaTest:.15});
   chunkGeometry.userData.raidOwned=chunkMaterial.userData.raidOwned=true;
   const chunks=new THREE.Points(chunkGeometry,chunkMaterial);chunks.visible=false;chunks.frustumCulled=false;chunks.renderOrder=4;this.scene.add(chunks);
   // Real warm illumination scoped to the detonation window: the light is pooled
   // with the blast so ruins and terrain are briefly lit from the explosion.
   // It is hidden between blasts so idle frames pay no extra lighting cost.
   const light=new THREE.PointLight(0xff8a24,0,40,2);
   light.visible=false;light.castShadow=false;
   this.scene.add(light);
   // The scorch is a flat decal, not a billboard, so it stays fixed to the
   // ground after the flash and shock ring have cleared.
   const scorchGeometry=new THREE.PlaneGeometry(1,1);
   const scorchMaterial=new THREE.MeshBasicMaterial({map:shockTexture,color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
   scorchGeometry.userData.raidOwned=scorchMaterial.userData.raidOwned=true;scorchMaterial.userData.raidOwnTexture=true;shockTexture.userData.raidOwned=true;
   const scorch=new THREE.Mesh(scorchGeometry,scorchMaterial);scorch.rotation.x=-Math.PI/2;scorch.visible=false;scorch.renderOrder=2;this.scene.add(scorch);
   this.blastEffects.push({ring,flash,embers,plume,chunks,scorch,light,scorchStarted:null,scorchDuration,plumeCount,chunkCount,chunkVelocities:new Float32Array(chunkCount*3),started:null,origin:new THREE.Vector3(),velocities:new Float32Array(emberCount*3),emberCount,blastDuration,radius:3});
  }
 }
 shotSurface(x,y,z,terrainHit){
  if(terrainHit)return this.world?.theme==='wilderness'?'forest':this.world?.theme==='settlement'?'dirt':'gravel';
  for(const block of this.world?.blocks||[]){
   const base=block[5]||0;
   if(Math.abs(x-block[0])<=block[2]/2+.2&&Math.abs(z-block[1])<=block[3]/2+.2&&y>=base-.2&&y<=base+block[4]+.2&&block[6])return block[6];
  }
  return 'concrete';
 }
 impactStyle(surface){return IMPACT_PALETTE[surface]||IMPACT_PALETTE.concrete}
 spawnShot(now,weapon){
  if(!this.shotEffects.length)return;
  const effect=this.shotEffects[this.shotCursor++%this.shotEffects.length];
  const origin=this.fireOrigin||this.visualSelf;if(!origin)return;
  effect.started=now;effect.weapon=weapon||'shot';effect.origin.copy(origin);
  const pitch=this.firePitch||0,yaw=this.fireYaw||0,cp=Math.cos(pitch);
  effect.dir.set(Math.sin(yaw)*cp,Math.sin(pitch),Math.cos(yaw)*cp).normalize();
  // Ballistic rays terminate on the sculpted terrain or district cover so the
  // tracer communicates impact geometry instead of disappearing into fog.
  let distance=72,surface='concrete';
  for(let t=.8;t<=72;t+=.45){
   const x=origin.x+effect.dir.x*t,y=origin.y+effect.dir.y*t,z=origin.z+effect.dir.z*t;
   const terrainHit=!!this.world&&y<=terrainHeightAt(this.world,x,z)+.02;
   if(terrainHit||(this.world&&blocked(this.world,x,z,.06,Math.max(0,y-.12),.24))){distance=t;surface=this.shotSurface(x,y,z,terrainHit);break}
  }
  effect.surface=surface;const impact=this.impactStyle(surface);effect.sparks.material.color.setHex(impact[0]);effect.dustMaterial.color.setHex(impact[1]);effect.debrisMaterial.color.setHex(impact[1]);
  // Debris uses the same surface family but a darker, matte hue so chips read
  // as displaced material rather than glowing embers.
  const debrisHue=new THREE.Color(impact[1]).multiplyScalar(.78);effect.debrisMaterial.color.copy(debrisHue);
  effect.end.copy(origin).addScaledVector(effect.dir,distance);
  const impactSpatial=this.snapshot?spatialCue({x:this.snapshot.self.x,y:this.snapshot.self.y||0,z:this.snapshot.self.z,yaw:this.snapshot.self.yaw||0},{x:effect.end.x,y:effect.end.y,z:effect.end.z}):null;
  if(impactSpatial)this.audio?.play('impact:'+surface,impactSpatial);
  // The flash and tracer start at the weapon muzzle rather than the eyes, with
  // a small right/down offset that reads naturally in both camera modes.
  effect.origin.set(origin.x+effect.dir.x*.55+Math.cos(yaw)*.16,
   origin.y+effect.dir.y*.55-.12,
   origin.z+effect.dir.z*.55-Math.sin(yaw)*.16);
  effect.muzzle.position.copy(effect.origin);
  // Muzzle bloom must stay compact near the camera. Authoring it in fixed world
  // units (instead of scaling with the sector) keeps a close-range shot from
  // flooding the frame, while the pooled light below carries the flash's read.
  const scale=.055;
  effect.muzzle.scale.set(scale,scale,1);
  effect.muzzle.visible=!this.settings?.reduced;effect.muzzle.material.opacity=0;
  if(this.shotMuzzleLight){const reduced=!!this.settings?.reduced;this.shotMuzzleLight.position.copy(effect.origin);this.shotMuzzleLight.visible=!reduced;this.shotMuzzleLight.intensity=reduced?0:3.2;this.shotMuzzleLightAt=now}
  const position=effect.tracer.geometry.attributes.position;
  position.setXYZ(0,effect.origin.x,effect.origin.y,effect.origin.z);
  position.setXYZ(1,effect.end.x,effect.end.y,effect.end.z);position.needsUpdate=true;
  effect.tracer.visible=!this.settings?.reduced;effect.tracer.material.opacity=0;
  effect.sparks.position.copy(effect.end);effect.sparks.visible=true;effect.sparks.material.opacity=0;
  const positions=effect.sparks.geometry.attributes.position.array;
  for(let i=0;i<effect.sparkCount;i++){positions[i*3]=0;positions[i*3+1]=.06;positions[i*3+2]=0}
  effect.sparks.geometry.attributes.position.needsUpdate=true;
  effect.debris.position.copy(effect.end).y+=.04;effect.debris.visible=!this.settings?.reduced;effect.debris.material.opacity=0;
  const chips=effect.debris.geometry.attributes.position.array;
  for(let i=0;i<effect.chipCount;i++){chips[i*3]=0;chips[i*3+1]=0;chips[i*3+2]=0}
  effect.debris.geometry.attributes.position.needsUpdate=true;
  const debrisBase=Math.random()*Math.PI*2;
  for(let i=0;i<effect.chipCount;i++){
   const angle=debrisBase+i*2.399963,k=i*3;
   effect.debrisVelocities[k]=Math.cos(angle)*(1.2+Math.random()*1.5);
   effect.debrisVelocities[k+1]=1.4+Math.random()*2.7;
   effect.debrisVelocities[k+2]=Math.sin(angle)*(1.2+Math.random()*1.5);
  }
  effect.dust.position.copy(effect.end).y+=.14;effect.dust.scale.setScalar(.22*this.viewScale);
  effect.dust.visible=!this.settings?.reduced;effect.dust.material.opacity=0;
  effect.trailRoot.visible=!this.settings?.reduced;
  for(let i=0;i<effect.trailSprites.length;i++){
   const f=(i+1)/9,sprite=effect.trailSprites[i];
   sprite.position.set(effect.origin.x+(effect.end.x-effect.origin.x)*f,
    effect.origin.y+(effect.end.y-effect.origin.y)*f,
    effect.origin.z+(effect.end.z-effect.origin.z)*f);
   sprite.scale.setScalar((.09-(.02*f))*this.viewScale);
  }
  for(let i=0;i<effect.sparkCount;i++){
   const k=i*3;effect.velocities[k]=(Math.random()-.5)*4.2;effect.velocities[k+1]=1.2+Math.random()*4.3;effect.velocities[k+2]=(Math.random()-.5)*4.2;
  }
  effect.sparkTime=0;
 }
 buildComposite(){
  const material=new THREE.ShaderMaterial({vertexShader:POST_VERT,fragmentShader:POST_FRAG,transparent:false,depthTest:false,depthWrite:false,
   uniforms:{uScene:{value:null},uBloomTex:{value:null},uResolution:{value:new THREE.Vector2(1,1)},uTime:{value:0},uVignette:{value:.42},uGrain:{value:.034},uBloom:{value:.3}}});
  material.userData.raidOwned=true;
  const geometry=new THREE.PlaneGeometry(2,2);geometry.userData.raidOwned=true;
  this.postMaterial=material;this.postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.postScene=new THREE.Scene();
  this.postMesh=new THREE.Mesh(geometry,material);this.postMesh.userData.raidOwned=true;this.postMesh.frustumCulled=false;this.postMesh.renderOrder=1000;
  this.postScene.add(this.postMesh);
  const bloomMaterial=new THREE.ShaderMaterial({vertexShader:POST_VERT,fragmentShader:BLOOM_FRAG,transparent:false,depthTest:false,depthWrite:false,
   uniforms:{uSource:{value:null},uTexel:{value:new THREE.Vector2(1,1)},uThreshold:{value:.58},uBlurScale:{value:2.2},uPass:{value:0}}});
  bloomMaterial.userData.raidOwned=true;
  const bloomGeometry=new THREE.PlaneGeometry(2,2);bloomGeometry.userData.raidOwned=true;
  this.bloomMaterial=bloomMaterial;this.bloomScene=new THREE.Scene();
  this.bloomMesh=new THREE.Mesh(bloomGeometry,bloomMaterial);this.bloomMesh.userData.raidOwned=true;this.bloomMesh.frustumCulled=false;this.bloomMesh.renderOrder=1001;
  this.bloomScene.add(this.bloomMesh);
 }
 ensurePostTarget(){
  const width=Math.max(1,this.canvas.width|0),height=Math.max(1,this.canvas.height|0);
  if(!this.postTarget||this.postTarget.width!==width||this.postTarget.height!==height){
   if(this.postTarget)this.postTarget.dispose();
   this.postTarget=new THREE.WebGLRenderTarget(width,height,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false});
  }
  return this.postTarget;
 }
 ensureBloomTargets(width,height){
  const w=Math.max(1,(width|0)>>1),h=Math.max(1,(height|0)>>1);
  if(!this.bloomTargets||this.bloomWidth!==w||this.bloomHeight!==h){
   for(const target of this.bloomTargets||[])target.dispose();
   const options={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false};
   this.bloomTargets=[new THREE.WebGLRenderTarget(w,h,options),new THREE.WebGLRenderTarget(w,h,options)];
   this.bloomWidth=w;this.bloomHeight=h;
  }
  return this.bloomTargets;
 }
 renderBloomChain(source,width,height){
  const [first,second]=this.ensureBloomTargets(width,height),u=this.bloomMaterial.uniforms,renderer=this.renderer;
  u.uSource.value=source;
  u.uTexel.value.set(1/Math.max(1,width),1/Math.max(1,height));
  u.uPass.value=0;
  renderer.setRenderTarget(first);renderer.clear();renderer.render(this.bloomScene,this.postCamera);
  u.uSource.value=first.texture;u.uTexel.value.set(1/first.width,1/first.height);u.uPass.value=1;
  renderer.setRenderTarget(second);renderer.clear();renderer.render(this.bloomScene,this.postCamera);
  u.uSource.value=second.texture;u.uPass.value=2;
  renderer.setRenderTarget(first);renderer.clear();renderer.render(this.bloomScene,this.postCamera);
  return first.texture;
 }
 updateCombatEffects(now){
  const reduced=!!this.settings?.reduced,viewScale=this.viewScale||1;
  for(const effect of this.shotEffects){
   if(effect.started===null)continue;
   const age=now-effect.started,fade=Math.max(0,1-age/effect.shotDuration);
   if(age>=effect.shotDuration||reduced&&age>320){effect.started=null;effect.muzzle.visible=false;effect.tracer.visible=false;effect.sparks.visible=false;effect.trailRoot.visible=false;effect.dust.visible=false;effect.debris.visible=false;continue}
   const flash=Math.max(0,1-age/85);
   effect.muzzle.visible=!reduced&&flash>0;
   effect.muzzle.material.opacity=reduced?0:flash*.65;
   effect.muzzle.scale.setScalar(.045+.02*(1-flash));
   effect.tracer.visible=!reduced&&age<170;
   effect.tracer.material.opacity=reduced?.18:Math.min(1,fade*1.8)*.72;
   effect.trailRoot.visible=!reduced&&age<190;
   effect.trailMaterial.opacity=Math.min(1,fade*1.7)*.46;
   effect.dust.visible=!reduced&&age<240;
   const dustAge=Math.min(1,age/240);effect.dust.material.opacity=reduced?0:.52*(1-dustAge);
   effect.dust.scale.setScalar((.22+.28*dustAge)*viewScale);
   effect.debris.visible=!reduced&&age<250;
   const debrisAge=Math.min(1,age/250),debrisSeconds=age/1000,chips=effect.debris.geometry.attributes.position.array;
   effect.debris.material.opacity=reduced?0:Math.min(1,(1-debrisAge)*1.4);
   effect.debris.material.size=(.14-.05*debrisAge)*viewScale;
   for(let i=0;i<effect.chipCount;i++){
    const k=i*3;
    chips[k]=effect.debrisVelocities[k]*debrisSeconds;
    chips[k+1]=Math.max(-.02,effect.debrisVelocities[k+1]*debrisSeconds-4.9*debrisSeconds*debrisSeconds);
    chips[k+2]=effect.debrisVelocities[k+2]*debrisSeconds;
   }
   effect.debris.geometry.attributes.position.needsUpdate=true;
   effect.sparks.visible=true;effect.sparks.material.opacity=reduced?.22:Math.min(1,fade*1.6)*.9;
   effect.sparks.material.size=(.12+.05*fade)*viewScale;
   const seconds=age/1000,array=effect.sparks.geometry.attributes.position.array;
   for(let i=0;i<effect.sparkCount;i++){
    const k=i*3;
    array[k]=effect.velocities[k]*seconds;
    array[k+1]=Math.max(.02,effect.velocities[k+1]*seconds-4.9*seconds*seconds);
    array[k+2]=effect.velocities[k+2]*seconds;
   }
   effect.sparks.geometry.attributes.position.needsUpdate=true;
  }
  // The pooled shot light rides the last accepted muzzle for 120 ms so foliage,
  // terrain and cover read the discharge; it is dark between shots and quiet in
  // reduced motion.
  if(this.shotMuzzleLight){
   const lightAge=now-this.shotMuzzleLightAt,lightActive=!reduced&&lightAge>=0&&lightAge<120;
   this.shotMuzzleLight.visible=lightActive;
   this.shotMuzzleLight.intensity=lightActive?(1-lightAge/120)*3.2:0;
  }
  for(const effect of this.blastEffects){
   if(effect.started===null)continue;
   const age=now-effect.started,fade=Math.max(0,1-age/effect.blastDuration);
   if(age>=effect.blastDuration){effect.started=null;effect.ring.visible=false;effect.flash.visible=false;effect.embers.visible=false;effect.plume.visible=false;effect.chunks.visible=false;effect.light.visible=false;effect.light.intensity=0;continue}
   const expand=Math.min(1,age/520),flare=Math.max(0,1-age/190);
   effect.ring.visible=true;effect.ring.position.copy(effect.origin);effect.ring.position.y+=.12;
   effect.ring.scale.setScalar(reduced?effect.radius:Math.max(.22,effect.radius*(.16+.84*expand)));
   effect.ring.material.opacity=reduced?.72:Math.min(1,fade*1.4)*.62;
   effect.flash.visible=!reduced&&flare>0;effect.flash.position.copy(effect.origin);effect.flash.position.y+=.9;
   effect.flash.material.opacity=reduced?0:flare*.9;effect.flash.scale.setScalar((1.4+1.8*expand)*this.viewScale);
   effect.light.visible=!reduced&&flare>0;effect.light.position.copy(effect.origin);effect.light.position.y+=1.15;
   effect.light.intensity=reduced?0:flare*250;
   effect.embers.visible=true;effect.embers.position.copy(effect.origin);effect.embers.material.opacity=reduced?.18:Math.min(1,fade*1.5)*.8;
   const seconds=age/1000,array=effect.embers.geometry.attributes.position.array,ring=effect.radius;
   for(let i=0;i<effect.emberCount;i++){
    const k=i*3,angle=i*2.399963;
    array[k]=Math.cos(angle)*ring*.55*expand+(Math.random()-.5)*.08;
    array[k+1]=.2+(.9+Math.random()*2.2)*seconds-4.9*seconds*seconds;
    array[k+2]=Math.sin(angle)*ring*.55*expand+(Math.random()-.5)*.08;
   }
   effect.embers.geometry.attributes.position.needsUpdate=true;
   effect.plume.visible=true;effect.plume.position.copy(effect.origin);effect.plume.position.y+=.24;
   effect.plume.material.opacity=reduced?.24:Math.min(1,fade*1.15)*.36;
   effect.plume.material.size=(reduced?.18:(.07+.14*expand))*this.viewScale;
   const plume=effect.plume.geometry.attributes.position.array;
   for(let i=0;i<effect.plumeCount;i++){
    const k=i*3,angle=i*2.399963;
    if(reduced){plume[k]=Math.cos(angle)*ring*.48;plume[k+1]=.16+(i%4)*.2;plume[k+2]=Math.sin(angle)*ring*.48}
    else{
     const spread=ring*(.12+.55*expand)*(.42+((i%4)/3)*.58);
     plume[k]=Math.cos(angle)*spread+Math.sin(seconds*.85+i)*.1;
     plume[k+1]=Math.min(ring*.85,.16+expand*(.55+((i%5)/4)*2.05))*(.78+(i%3)*.11);
     plume[k+2]=Math.sin(angle)*spread+Math.cos(seconds*.7+i)*.1;
    }
   }
   effect.plume.geometry.attributes.position.needsUpdate=true;
   effect.chunks.visible=!reduced;
   effect.chunks.position.copy(effect.origin);effect.chunks.position.y+=.12;
   effect.chunks.material.opacity=reduced?0:Math.min(1,(1-age/effect.blastDuration)*1.7)*.86;
   effect.chunks.material.size=(.22-.04*Math.min(1,age/effect.blastDuration))*this.viewScale;
   const chunkPos=effect.chunks.geometry.attributes.position.array;
   for(let i=0;i<effect.chunkCount;i++){
    const k=i*3;
    chunkPos[k]=effect.chunkVelocities[k]*seconds;
    chunkPos[k+1]=Math.max(-.04,.02+effect.chunkVelocities[k+1]*seconds-4.9*seconds*seconds);
    chunkPos[k+2]=effect.chunkVelocities[k+2]*seconds;
   }
   effect.chunks.geometry.attributes.position.needsUpdate=true;
  }
  for(const effect of this.blastEffects){
   if(effect.scorchStarted===null)continue;
   const age=now-effect.scorchStarted;
   if(age>=effect.scorchDuration){effect.scorchStarted=null;effect.scorch.visible=false;continue}
   const fade=Math.max(0,1-age/effect.scorchDuration),expand=Math.min(1,age/700);
   effect.scorch.visible=true;effect.scorch.position.copy(effect.origin);effect.scorch.position.y+=.025;
   const size=reduced?effect.radius*.95+1.1:(1.15+effect.radius*1.3*expand);
   effect.scorch.scale.setScalar(size*viewScale);
   effect.scorch.material.opacity=(reduced?.5:.72)*Math.min(1,fade*1.55);
  }
  for(const mesh of this.utilityEffects.values()){
   if(mesh.userData.kind!=='smoke')continue;
   const base=mesh.userData.radius||3,active=mesh.userData.active!==false;
   if(!active||reduced){mesh.scale.setScalar(active?base:.15);mesh.userData.growFrom=undefined}
   else{
    if(mesh.userData.growFrom===undefined){mesh.userData.growFrom=performance.now();mesh.userData.growStart=mesh.scale.x||.15}
    const t=Math.min(1,(now-mesh.userData.growFrom)/420),smooth=t*t*(3-2*t);
    mesh.scale.setScalar(mesh.userData.growStart+(base-mesh.userData.growStart)*smooth);
   }
   const phase=now*.001;
   mesh.children.forEach((puff,i)=>{
    puff.position.y=puff.userData.baseY+Math.sin(phase*1.1+i*.9)*.14;
    puff.position.x=puff.userData.baseX+Math.cos(phase*.8+i)*.08;
    puff.material.opacity=reduced?.55:.45+.12*Math.sin(phase*.9+i);
   });
  }
 }
 spawnBlast(x,y,z,radius){
  if(!this.blastEffects.length)return;
  const effect=this.blastEffects[this.blastCursor++%this.blastEffects.length];
  effect.started=performance.now();effect.origin.set(x,y||0,z);effect.radius=Math.max(1.6,radius||3);
  for(let i=0;i<effect.emberCount;i++){const k=i*3;effect.velocities[k]=0;effect.velocities[k+1]=1;effect.velocities[k+2]=0}
  effect.ring.visible=true;effect.flash.visible=false;effect.embers.visible=false;effect.plume.visible=false;effect.plume.material.opacity=0;effect.chunks.visible=false;effect.chunks.material.opacity=0;effect.light.visible=false;effect.light.intensity=0;effect.light.position.set(x,(y||0)+1.15,z);
  for(let i=0;i<effect.chunkCount;i++){
   const angle=i*2.399963,k=i*3;
   effect.chunkVelocities[k]=Math.cos(angle)*(2.2+((i*7)%5)*.42);
   effect.chunkVelocities[k+1]=2.9+((i*11)%6)*.5;
   effect.chunkVelocities[k+2]=Math.sin(angle)*(2.2+((i*13)%5)*.42);
  }
  // The ground scorch outlives the flash so the attack leaves readable damage.
  effect.scorchStarted=effect.started;effect.scorch.position.set(x,(y||0)+.025,z);effect.scorch.visible=true;
 }
 fire(){const s=this.snapshot?.self,item=s&&[...s.equipment,...s.pack].find(it=>it.id===s.weaponId);this.recoilSide=-this.recoilSide;this.recoil=this.settings?.reduced?0:RECOIL_KICK[item?.weapon]??.07;this.muzzleFlashAt=performance.now();this.audio.play(item?'shot:'+item.weapon:'shot');this.spawnShot(performance.now(),item?item.weapon:'shot');this.spawnViewModelEffects()}
 clearChase(eye,desired){
  if(!this.world)return desired;
  const delta=desired.clone().sub(eye);let last=eye.clone();
  for(let i=1;i<=18;i++){
   const p=eye.clone().addScaledVector(delta,i/18);
   if(blocked(this.activeWorld||this.world,p.x,p.z,.24,p.y-.16,.32))break;
   if(p.y<terrainHeightAt(this.world,p.x,p.z)+.36)break;
   last=p;
  }
  return last;
 }
 frame(time,yaw,pitch,predicted,aiming=false){
  if(!this.snapshot)return;const dt=Math.min(.05,Math.max(0,(time-this.lastTime)/1000)||.016);this.lastTime=time;const seconds=time/1000,s=this.snapshot.self;this.updateEnvironment(this.settings?.reduced?1:1-Math.exp(-dt*3));this.updateWetness(dt);this.updateAtmosphere(seconds);
  // Foliage sway is deterministic presentation-only motion; reduced motion
  // freezes the shared shader clock so that view is entirely static.
  for(const material of this.windMaterials||[]){const shader=material.userData.raidShader;if(shader)shader.uniforms.uWindTime.value=this.settings?.reduced?0:seconds}
  const pose=s.alive&&predicted?predicted:s,target=new THREE.Vector3(pose.x,(pose.y||0)+(s.downed?.65:s.ballisticsVersion===1?SHOT_EYE_HEIGHT:1.65),pose.z);
  if(!s.alive&&this.snapshot.camera)target.set(this.snapshot.camera.x,(this.snapshot.camera.y||0)+2,this.snapshot.camera.z);
  if(this.visualSelf.distanceTo(target)>5)this.visualSelf.copy(target);else this.visualSelf.lerp(target,Math.min(1,dt*16));this.camera.position.copy(this.visualSelf);
  if(this.horizonDepth){this.horizonDepth.position.copy(this.camera.position);if(this.horizonDepth.userData.raidHorizonTick)this.horizonDepth.userData.raidHorizonTick(seconds,!!this.settings?.reduced)}
  // Keep the 2048 shadow frustum centred on the player instead of the fixed
  // map origin; without this, shadows disappear once the operator walks more
  // than 80 m from centre. The light direction itself is kept at 90 m.
  const anchor=s.alive?pose:this.snapshot.camera||pose;this.sunAnchor.set(anchor.x,(anchor.y||0),anchor.z);
  this.sun.target.position.copy(this.sunAnchor);this.sun.position.copy(this.sunAnchor).addScaledVector(this.sunDirection,90);const held=[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),targetFov=aiming&&held?aimFieldOfView(this.settings?.fov||75,weaponStats(held)):this.settings?.fov||75;this.camera.fov+=(targetFov-this.camera.fov)*(this.settings?.reduced?1:1-Math.exp(-dt*16));this.camera.rotation.set(!s.alive&&this.snapshot.camera?this.snapshot.camera.pitch:pitch,(!s.alive&&this.snapshot.camera?this.snapshot.camera.yaw:yaw)+Math.PI,0,'YXZ');
  // Presentation-only muzzle rise; authoritative ballistics still use the snapshot pose.
  if(!this.settings?.reduced){this.camera.rotation.x+=this.recoil*.32;this.camera.rotation.z+=this.recoil*this.recoilSide*.34}
  // The aim camera above stays at eye height for authoritative ballistics and
  // network graders; the chase camera is the presentational third-person view.
  const viewYaw=!s.alive&&this.snapshot.camera?this.snapshot.camera.yaw:yaw,viewPitch=!s.alive&&this.snapshot.camera?this.snapshot.camera.pitch:pitch;
  // Damped look sway: the held weapon lags the aim by a small, bounded angle.
  // Reduced motion zeroes it; aiming halves the travel so heads-up shots stay
  // steady. Values are presentation-only and reset on each deployment.
  if(this.vmLastYaw===null||this.vmLastPitch===null){this.vmLastYaw=viewYaw;this.vmLastPitch=viewPitch}
  if(!this.settings?.reduced){
   let dy=viewYaw-this.vmLastYaw;while(dy>Math.PI)dy-=Math.PI*2;while(dy<-Math.PI)dy+=Math.PI*2;
   const dp=viewPitch-this.vmLastPitch,aimK=aiming?.35:1,swayBoundX=aiming?.02:.09,swayBoundY=aiming?.02:.07;
   const targetX=Math.max(-swayBoundX,Math.min(swayBoundX,dy*.6*aimK)),targetY=Math.max(-swayBoundY,Math.min(swayBoundY,-dp*.55*aimK)),follow=1-Math.exp(-dt*9);
   this.vmYaw+=(targetX-this.vmYaw)*follow;this.vmPitch+=(targetY-this.vmPitch)*follow;
  }else{this.vmYaw=0;this.vmPitch=0}
  this.vmLastYaw=viewYaw;this.vmLastPitch=viewPitch;
  // Locomotion bob: a small two-beat rise/fall tied to the server-reported
  // movement vector. It is bounded and suspended while stopped, downed or aiming.
  const moveSpeed=Math.min(1,Math.hypot(s.move?.x||0,s.move?.z||0));
  let bobX=0,bobY=0;
  if(!this.settings?.reduced&&s.alive&&!s.downed&&!aiming&&moveSpeed>.05){
   this.vmStep+=dt*(5.4+moveSpeed*5);const reach=bobReach(moveSpeed);
   bobX=Math.cos(this.vmStep)*reach*.85;bobY=Math.abs(Math.sin(this.vmStep))*reach*1.1;
  }
  const sliding=s.sliding===true||((predicted?.slideUntil||0)>seconds),eyeHeight=1.55+(s.downed?-.9:0);
  this.fireOrigin.set(pose.x,(pose.y||0)+eyeHeight,pose.z);this.fireYaw=viewYaw;this.firePitch=viewPitch;
  if(this.selfActor&&this.selfActor.userData.actor==='human'){
   const show=this.viewMode!=='first'&&!!s.alive;
   this.selfActor.visible=show;
   if(show)updateActor(this.selfActor,{x:pose.x,y:pose.y||0,z:pose.z,yaw:viewYaw,pitch:viewPitch,downed:!!(s.downed||s.down),air:pose.grounded===false,sliding,hp:s.hp,reduced:!!this.settings?.reduced},dt,seconds);
   if(this.selfActor.userData.tag)this.selfActor.userData.tag.visible=false;
  }
  if(this.renderCamera){
   if(this.viewMode==='third'&&s.alive&&!this.snapshot.camera){
    const eye=new THREE.Vector3(pose.x,(pose.y||0)+eyeHeight,pose.z),fx=Math.sin(viewYaw),fz=Math.cos(viewYaw),cos=Math.cos(viewPitch);
    const forward=new THREE.Vector3(fx*cos,Math.sin(viewPitch),fz*cos),look=eye.clone().addScaledVector(forward,26);
    const desired=eye.clone().add(new THREE.Vector3(-fx*3.1,.6,fz*-3.1)).add(new THREE.Vector3(-Math.cos(viewYaw)*.55,0,Math.sin(viewYaw)*.55));
    const safe=this.clearChase(eye,desired),follow=Math.min(1,1-Math.exp(-dt*20));
    if(!this.chase)this.chase=safe.clone();
    else{
     const candidate=this.chase.clone().lerp(safe,follow);
     // Smoothing must not cut a wall corner or settle below the terrain; if the
     // interpolated point is invalid, snap straight to the sampled safe point.
     const clear=candidate.y>=terrainHeightAt(this.world,candidate.x,candidate.z)+.36&&!blocked(this.activeWorld||this.world,candidate.x,candidate.z,.24,candidate.y-.16,.32);
     this.chase.copy(clear?candidate:safe);
    }
    if(!this.settings?.reduced)this.chase.y+=Math.sin(seconds*6.4)*.015*Math.min(1,(this.selfActor?.userData.speed||0)/6);
    this.renderCamera.position.copy(this.chase);this.renderCamera.lookAt(look);if(!this.settings?.reduced){this.renderCamera.rotation.x+=this.recoil*.24;this.renderCamera.rotation.z+=this.recoil*this.recoilSide*.26}this.renderCamera.fov=this.camera.fov;
   }else{this.renderCamera.position.copy(this.camera.position);this.renderCamera.rotation.copy(this.camera.rotation);this.renderCamera.fov=this.camera.fov}
  }
  for(const {model,data,type}of this.actors.values()){
   if(type==='machine')model.userData.motionReduced=!!this.settings?.reduced;
   if(type==='human'||type==='machine')updateActor(model,{...data,reduced:!!this.settings?.reduced},dt,seconds);
   else{model.position.set(data.x,data.y||0,data.z);
    if(type==='door'){
     const w=data.w||3.4,h=Math.min(data.h||2.8,2.8),d=data.d||.32,leaf=model.userData.doorLeaf,sill=model.userData.doorSill;
     if(leaf){leaf.visible=data.closed!==false;leaf.scale.set(w,h,d);leaf.position.set(0,h/2,0);leaf.material.color.setHex(data.locked?0xc86a55:data.closed?0xd8b062:0x8dbb9b)}
     if(sill){sill.scale.set(w,.1,d);sill.position.set(0,.05,0);sill.material.color.setHex(data.locked?0xe07a5b:data.closed?0xd8b062:0x9fe0ad)}
    }else{
     if(type==='exit')model.userData.exitRing?.material.color.setHex(exitColor(data,this.snapshot.serverTime));const beacon=model.userData.beacon;if(beacon){const shaft=beacon.userData.beaconShaft;shaft.material.opacity=.22+.14*Math.sin(seconds*2.2+(data.x||0)*.01);beacon.userData.beaconRing.rotation.z=seconds*.35;beacon.visible=!this.settings?.reduced}}
    }
  }
  if(this.weather?.visible&&this.weatherState){
   const state=this.weatherState,size=this.world?.size||1440,attr=this.weather.geometry.attributes.position,arr=attr.array;
   if(state.mode==='rain'){
    for(let i=0;i<state.drops.length;i++){const d=state.drops[i];d.y-=d.speed*dt;d.x+=Math.sin(seconds*.9+i*.7)*.7*dt;
     if(d.y<-1){d.y=38;d.x=(Math.random()-.5)*size;d.z=(Math.random()-.5)*size}writeRain(arr,i,d)}
   }else{
    for(let i=0;i<state.points.length;i++){const p=state.points[i];p.y-=p.speed*dt;
     if(p.y<-1){p.y=state.ceiling;p.x=(Math.random()-.5)*size;p.z=(Math.random()-.5)*size}
     p.x+=Math.sin(seconds*.4+i)*.15*dt;p.z+=Math.cos(seconds*.33+i*.7)*.12*dt;
     arr[i*3]=p.x;arr[i*3+1]=p.y;arr[i*3+2]=p.z}
   }
   attr.needsUpdate=true;
  }
  for(const ring of this.effects.values())ring.material.opacity=this.settings?.reduced?.85:.6+.2*Math.sin(seconds*8);
  this.updateCombatEffects(time);
  this.recoil=Math.max(0,this.recoil-dt*.5);
  const motionReduced=!!this.settings?.reduced,swayX=motionReduced?0:this.vmYaw+bobX,swayY=motionReduced?0:this.vmPitch-bobY;
  // Aim-down-sights presentation: ease toward a sight-aligned pose instead of
  // snapping. The rear optic's authored local position is projected through the
  // 0.65 weapon scale so the sight picture is genuinely centered, not merely the
  // weapon root. Reduced motion snaps to the target with no interpolation.
  const aimTarget=aiming?1:0;
  if(motionReduced)this.vmAim=aimTarget;
  else{
   this.vmAim+=(aimTarget-this.vmAim)*Math.min(1,dt*18);
   if(Math.abs(this.vmAim-aimTarget)<.001)this.vmAim=aimTarget;
  }
  const sight=this.gun?.userData.info?.sight||[0,.06,.15],gunScale=this.gunRoot.scale.x||.65;
  const hipX=.2,hipY=-.22,aimX=-(sight[0]||0)*gunScale,aimY=-(sight[1]||0)*gunScale;
  const aimBlend=this.vmAim;
  const equipAge=this.vmEquipAt?time-this.vmEquipAt:1e9,equipDrop=motionReduced||equipAge>=260?0:-.1*Math.pow(1-Math.max(0,equipAge)/260,2);
  const breathX=motionReduced||aiming?0:Math.sin(seconds*1.7)*.004,breathY=motionReduced||aiming?0:Math.sin(seconds*2.1)*.004;
  // Accepted reload handling: the weapon dips and leans while one magazine
  // leaves and a replacement seats. Both envelopes collapse to exactly zero at
  // the end of the window, so the base pose is restored deterministically.
  let reloadHold=0;const reloadAge=this.reloadStartedAt?time-this.reloadStartedAt:1e9;
  if(this.reloadStartedAt>0&&(motionReduced||reloadAge>=this.reloadDuration)){
   this.reloadStartedAt=0;this.reloadDuration=0;if(this.reloadMag)this.reloadMag.visible=false;
  }else if(this.reloadStartedAt>0&&reloadAge>=0&&this.reloadMag){
   const p=Math.min(1,reloadAge/this.reloadDuration);
   if(p<.12){const u=p/.12;reloadHold=u*u*(3-2*u)}
   else if(p>.78){const u=(1-p)/.22;reloadHold=u*u*(3-2*u)}
   else reloadHold=1;
   if(p<.30){const u=p/.30,k=u*u*(3-2*u);this.reloadMag.visible=true;this.reloadMag.position.set(this.reloadMagBase.x+.045*k,this.reloadMagBase.y-.20*k,this.reloadMagBase.z-.02*k);this.reloadMag.rotation.z=.9*k}
   else if(p<.52)this.reloadMag.visible=false;
   else if(p<.92){const u=(p-.52)/.40,k=u*u*(3-2*u);this.reloadMag.visible=true;this.reloadMag.position.set(this.reloadMagBase.x+.06*(1-k),this.reloadMagBase.y-.19*(1-k),this.reloadMagBase.z+.02*(1-k));this.reloadMag.rotation.z=-.7*(1-k)}
   else this.reloadMag.visible=false;
  }
  this.gunRoot.position.set(hipX+(aimX-hipX)*aimBlend+swayX+breathX*(1-aimBlend)-.035*reloadHold,hipY+(aimY-hipY)*aimBlend+swayY+equipDrop+breathY*(1-aimBlend)-.105*reloadHold,-.5+this.recoil+.025*reloadHold+.065*aimBlend);
  this.gunRoot.rotation.set(-this.recoil+.14*reloadHold,swayX*.55,swayY*.4+.22*reloadHold);
  // Additive muzzle bloom that rides the recoil; short-lived, bounded, and
  // suppressed under reduced motion like the world muzzle effects. Barrel heat
  // decays in place and leaves a faint residual glow and warm emissive tint
  // after sustained fire, so a burst reads as a hot weapon rather than a
  // sequence of disconnected flashes.
  const heat=motionReduced?0:Math.max(0,(this.heat||0)-dt*.55);
  this.heat=heat;
  const heatGlow=Math.max(0,(heat-.12)/.88);
  if(this.muzzleFlash){
   const flashAge=time-this.muzzleFlashAt,flashActive=!motionReduced&&!!this.gunRoot?.visible&&flashAge>=0&&flashAge<120;
   const barrelGlow=!motionReduced&&!!this.gunRoot?.visible&&heatGlow>0;
   this.muzzleFlash.visible=flashActive||barrelGlow;
   if(flashActive){const fade=1-flashAge/120;this.muzzleFlash.material.opacity=Math.min(1,fade*.95+heatGlow*.22);this.muzzleFlash.scale.setScalar(this.muzzleBaseScale*(.9+.35*(1-fade)))}
   else if(barrelGlow){this.muzzleFlash.material.opacity=heatGlow*.3;this.muzzleFlash.scale.setScalar(this.muzzleBaseScale*.72)}
   else this.muzzleFlash.material.opacity=0;
   if(this.muzzleLight){this.muzzleLight.visible=flashActive||barrelGlow;this.muzzleLight.intensity=flashActive?(1-flashAge/120)*3.2:barrelGlow?heatGlow*1.3:0}
   for(const material of this.gunHeatMaterials||[]){if(material.emissive)material.emissive.setRGB(heatGlow*.26,heatGlow*.094,heatGlow*.023)}
  }
  // Recycled brass casings: brief ballistic arcs that leave from the ejection
  // port and hide themselves. Reduced motion clears the pool in place.
  if(this.caseFx?.length){
   for(const casing of this.caseFx){
    if(!casing.visible)continue;
    const data=casing.userData;data.age+=dt;
    if(motionReduced||data.age>=data.max){casing.visible=false;casing.material.opacity=0;continue}
    data.vy-=6.5*dt;
    casing.position.x+=data.vx*dt;casing.position.y+=data.vy*dt;casing.position.z+=data.vz*dt;
    casing.material.rotation+=dt*7;casing.material.opacity=(1-data.age/data.max)*.95;
   }
  }
  // Translucent muzzle smoke: expands and fades over 300 ms at the muzzle.
  if(this.muzzleSmoke){
   const smokeAge=time-this.muzzleSmokeAt,smokeActive=!motionReduced&&smokeAge>=0&&smokeAge<300;
   this.muzzleSmoke.visible=smokeActive;
   if(smokeActive){const t=smokeAge/300,ease=t*(2-t);this.muzzleSmoke.scale.setScalar(.055+.16*ease);this.muzzleSmoke.material.opacity=(1-t)*.62;this.muzzleSmoke.material.rotation=t*.6}
  }
  const width=innerWidth,height=innerHeight;if(this.canvas.width!==Math.round(width*this.renderer.getPixelRatio())||this.canvas.height!==Math.round(height*this.renderer.getPixelRatio()))this.renderer.setSize(width,height,false);
  this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderCamera.aspect=width/height;this.renderCamera.updateProjectionMatrix();this.weaponCamera.aspect=width/height;this.weaponCamera.updateProjectionMatrix();
  const third=this.viewMode==='third'&&s.alive&&!this.snapshot.camera;
  // Cinematic frame finish: the deterministic bloom chain, vignette and film
  // grain are presentation-only and never feed back into actor, ballistics or
  // HUD state. The world renders into an offscreen colour target; the brush
  // chain extracts highlights at half resolution, blurs them horizontally and
  // vertically, then the composite pass upsamples the bloom over the scene.
  // Reduced motion freezes grain and keeps the bloom field static; all targets
  // are rebuilt only on size changes and released by clear()/start().
  const composite=!!(this.postScene&&this.postMaterial&&this.postMesh&&this.postMesh.visible),postTarget=composite?this.ensurePostTarget():null,camera=third?this.renderCamera:this.camera;
  this.renderer.setRenderTarget(postTarget);this.renderer.clear();this.renderer.render(this.scene,camera);
  this.gunRoot.visible=!!held&&!third;
  if(composite){
   const bloomTexture=this.renderBloomChain(postTarget.texture,postTarget.width,postTarget.height);
   this.renderer.setRenderTarget(null);
   const reduced=!!this.settings?.reduced,u=this.postMaterial.uniforms;
   u.uScene.value=postTarget.texture;
   u.uBloomTex.value=bloomTexture;
   u.uResolution.value.set(this.canvas.width,this.canvas.height);
   u.uTime.value=reduced?0:seconds;
   u.uGrain.value=reduced?0:.034;
   this.renderer.render(this.postScene,this.postCamera);
  }
  if(!third&&s.alive&&!s.downed){this.renderer.clearDepth();this.renderer.render(this.overlay,this.weaponCamera)}
 }
}
export class BasePreview {
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x1b303b);
  this.scene.add(new THREE.HemisphereLight(0xe8e9d7,0x344651,2.5));const light=new THREE.DirectionalLight(0xffcf93,3);light.position.set(3,5,4);this.scene.add(light);this.camera=new THREE.PerspectiveCamera(38,2,.1,40);this.camera.position.set(2,1.8,3);this.camera.lookAt(0,1,0);
  this.hero=humanModel('','base_operator',true,null);this.hero.rotation.y=.5;this.scene.add(this.hero);const stage=new THREE.Group();part(stage,'cylinder',0x435963,0,-.12,0,1.3,.2,1.3);for(const x of [-2.2,2.2]){part(stage,'box',0x485c61,x,.5,-1.1,1.4,1,1);part(stage,'box',0xbea572,x,1.05,-1.1,1.55,.12,1.1)}this.scene.add(stage);this.last=0;
 }
 setLoadout(loadout){
  const key=JSON.stringify([loadout.primary,loadout.secondary,loadout.armor,loadout.recovery]);this.loadout=loadout;if(key===this.loadoutKey)return;this.loadoutKey=key;
  setHumanWeapon(this.hero,loadout.primary?.weapon||null);
  for(const name of ['secondaryRoot','armorRoot'])if(this[name]){this.hero.remove(this[name]);disposeOwned(this[name]);this[name]=null}
  const wear=(root,item)=>{const color=new THREE.Color(0xffffff).lerp(new THREE.Color(0x7f8790),1-Math.max(0,Math.min(100,item.condition??100))/100);root?.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.userData.raidOwned&&material.color)material.color.copy(color)})};
  wear(this.hero.userData.raidGun,loadout.primary||{});
  if(loadout.secondary){this.secondaryRoot=weaponModel(loadout.secondary.weapon);this.secondaryRoot.userData.weapon=loadout.secondary.weapon;this.secondaryRoot.position.set(.18,1.18,.24);this.secondaryRoot.rotation.set(.4,Math.PI,.25);this.secondaryRoot.scale.setScalar(.38);wear(this.secondaryRoot,loadout.secondary);this.hero.add(this.secondaryRoot)}
  if(loadout.armor){const stats=armorStats(loadout.armor),heavy=stats.tier==='heavy',light=stats.tier==='light',color=new THREE.Color(light?0x6e9a77:heavy?0x506578:0x678da6).lerp(new THREE.Color(0x53575c),1-Math.round(Math.max(0,Math.min(100,loadout.armor.condition??100)))/100).getHex();this.armorRoot=new THREE.Group();this.armorRoot.userData.grade=stats.tier;
   for(const z of [-.2,.2])part(this.armorRoot,'box',color,0,1.23,z,heavy?.52:light?.4:.46,light?.3:heavy?.5:.45,heavy?.16:light?.08:.13);
   if(heavy)for(const x of [-.28,.28])part(this.armorRoot,'box',color,x,1.43,0,.17,.14,.26);
   this.hero.add(this.armorRoot);
  }
 }
 clear(){this.setLoadout({primary:null,secondary:null,armor:null,recovery:false});this.renderer.clear()}
 turn(){this.angle=(this.angle??.5)+Math.PI/2}
 applySettings(settings){this.settings=settings}
 frame(time,visible){if(!visible)return;const dt=Math.min(.05,(time-this.last)/1000||.016);this.last=time;updateActor(this.hero,{x:0,y:0,z:0,yaw:(this.angle??.5)+(this.settings?.reduced?0:Math.sin(time*.0003)*.12)},this.settings?.reduced?0:dt,this.settings?.reduced?0:time/1000);const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(w&&h){this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera)}}
}
