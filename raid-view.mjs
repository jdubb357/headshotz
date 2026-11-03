import {aimFieldOfView,SHOT_EYE_HEIGHT} from './shared/raid-ballistics.mjs';
import {weaponStats,armorStats} from './shared/raid-catalog.mjs';
import {smokeClear} from './shared/raid-utilities.mjs';
import * as THREE from './lib/three.module.min.js';
import {getWorld} from './shared/raid-worlds.mjs';
import {mapConditions} from './shared/raid-enemies.mjs';
import {exitColor} from './shared/raid-exits.mjs';
import {buildEnvironment} from './raid-environment.mjs';
import {humanModel,setHumanWeapon,machineModel,propModel,weaponModel,updateActor,disposeOwned,part} from './raid-models.mjs';

import {RaidAudio} from './raid-audio.mjs';
export {RaidAudio} from './raid-audio.mjs';
export class RaidView {
 constructor(canvas){
  this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.renderer.autoClear=false;this.audio=new RaidAudio();this.actors=new Map();this.effects=new Map();this.utilityEffects=new Map();this.lastTime=0;this.lastWeapon=null;this.recoil=0;this.snapAt=performance.now();
 }
 applySettings(settings){this.settings=settings;this.audio.volume=settings.sfxVolume;if(this.camera){this.camera.fov=settings.fov;this.camera.updateProjectionMatrix()}if(this.weather)this.weather.visible=this.snapshot?.conditions?.weather!=='clear'&&!settings.reduced}
 clear(){
  if(this.scene)disposeOwned(this.scene);if(this.overlay)disposeOwned(this.overlay);this.actors.clear();this.effects.clear();this.utilityEffects.clear();this.lastWeapon=null;this.lastTime=0;
  this.audio.reset();const context=this.audio.context;if(context&&context.state!=='closed')context.close().catch(()=>{});this.audio=new RaidAudio();this.audio.volume=this.settings?.sfxVolume??.7;
  for(const name of ['scene','overlay','snapshot','world','camera','weaponCamera','gunRoot','gun','visualSelf','hemi','sun','weather','sunOrb','moonOrb','stars','environmentTarget'])this[name]=null;
  this.renderer.renderLists.dispose();this.renderer.clear();this.renderer.info.reset();
 }
 start(snapshot){
  if(this.scene)disposeOwned(this.scene);if(this.overlay)disposeOwned(this.overlay);this.actors.clear();this.effects.clear();this.utilityEffects.clear();this.lastWeapon=null;this.audio.reset();
  this.world=getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion);this.scene=new THREE.Scene();this.scene.add(buildEnvironment(this.world));this.camera=new THREE.PerspectiveCamera(75,1,.08,230);this.camera.rotation.order='YXZ';
  this.hemi=new THREE.HemisphereLight(0xe5f2ed,0x414d49,1.8);this.sun=new THREE.DirectionalLight(0xffd6a0,2);this.sun.position.set(-30,65,35);this.scene.add(this.hemi,this.sun);
  this.environmentTarget=null;this.buildSky();
  this.overlay=new THREE.Scene();this.weaponCamera=new THREE.PerspectiveCamera(58,1,.02,8);this.overlay.add(new THREE.HemisphereLight(0xe5f2ff,0x425059,2));const light=new THREE.DirectionalLight(0xffd4a4,2);light.position.set(2,3,4);this.overlay.add(light);
  this.gunRoot=new THREE.Group();this.gunRoot.position.set(.2,-.22,-.5);this.gunRoot.scale.setScalar(.65);this.overlay.add(this.gunRoot);
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(450*3);for(let i=0;i<positions.length;i+=3){positions[i]=(Math.random()-.5)*140;positions[i+1]=Math.random()*35;positions[i+2]=(Math.random()-.5)*140}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.userData.raidOwned=true;
  const material=new THREE.PointsMaterial({color:0xd2e1e8,size:.07,transparent:true,opacity:.5});material.userData.raidOwned=true;this.weather=new THREE.Points(geometry,material);this.scene.add(this.weather);
  this.visualSelf=new THREE.Vector3(snapshot.self.x,(snapshot.self.y||0),snapshot.self.z);this.audio.resume();this.sync(snapshot);
 }
 sync(snapshot){
  this.snapshot=snapshot;this.audio.observe(snapshot);this.snapAt=performance.now();const live=new Set();
  const put=(key,type,data)=>{
   live.add(key);let entry=this.actors.get(key);
   if(!entry){const model=type==='machine'?machineModel(data.kind):type==='human'?humanModel(data.name||'Operator',data.id,data.team===snapshot.self.team,data.weapon??null):propModel(type,data.vault?0xc78bdb:data.open?0x87b89a:0xd8b062);entry={model,type,data};this.actors.set(key,entry);this.scene.add(model)}
   entry.data=data;if(type==='human'&&entry.model.userData.heldWeapon!==(data.weapon??null))setHumanWeapon(entry.model,data.weapon??null);if(type==='cache')entry.model.userData.lid?.material.color.setHex(data.open?0x87b89a:data.vault?0xc78bdb:0xd8b062);
  };
  for(const p of snapshot.players)if(p.id!==snapshot.camera?.follow)put(p.id,'human',p);
  for(const m of snapshot.machines)put(m.id,'machine',m);
  for(const c of snapshot.caches)put(c.id,'cache',c);
  for(const b of snapshot.bags)put(b.id,'bag',b);
  for(const p of snapshot.pings||[])put('ping_'+p.id,'ping',p);
  for(const e of snapshot.exits)put(e.id,'exit',e);
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
  const conditions=insideSmoke?{...(snapshot.conditions||mapConditions(this.world)),fog:0x9aa6a1,visibility:.07}:snapshot.conditions||mapConditions(this.world);this.environmentTarget={sky:new THREE.Color(conditions.sky),fog:new THREE.Color(conditions.fog),visibility:conditions.visibility,light:conditions.light,ambient:conditions.ambient??1.8,daylight:conditions.daylight??1,sun:new THREE.Vector3(conditions.sun?.x??-30,conditions.sun?.y??65,conditions.sun?.z??35)};
  if(!this.scene.background){this.scene.background=this.environmentTarget.sky.clone();this.scene.fog=new THREE.Fog(conditions.fog,28*conditions.visibility,150*conditions.visibility);this.updateEnvironment(1)}this.weather.visible=conditions.weather!=='clear'&&!this.settings?.reduced;
  const item=[...snapshot.self.equipment,...snapshot.self.pack].find(it=>it.id===snapshot.self.weaponId);
  this.gunRoot.visible=!!item;
  if(item&&this.lastWeapon!==item.id){this.lastWeapon=item.id;for(const child of [...this.gunRoot.children]){this.gunRoot.remove(child);disposeOwned(child)}this.gun=weaponModel(item.weapon,true);this.gunRoot.add(this.gun)}
 }
 smokeModel(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d'),gradient=context.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.45,'rgba(255,255,255,.85)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas),root=new THREE.Group();
  for(let i=0;i<9;i++){const material=new THREE.SpriteMaterial({map:texture,color:0x9aa6a1,transparent:true,opacity:.65,depthWrite:false});material.userData.raidOwned=true;material.userData.raidOwnTexture=i===0;const puff=new THREE.Sprite(material),angle=i*2.399963;puff.position.set(i?Math.cos(angle)*.38:0,i?Math.sin(angle*2)*.2:0,i?Math.sin(angle)*.38:0);puff.scale.setScalar(i?1.2:1.6);root.add(puff)}return root;
 }
 syncUtilities(snapshot){
  const live=new Set();for(const e of snapshot.utilities||[]){
   live.add(e.id);let mesh=this.utilityEffects.get(e.id);
   if(!mesh){
    if(e.kind==='smoke')mesh=this.smokeModel();
    else{const geometry=new THREE.TorusGeometry(e.kind==='frag'?e.radius:.6,.07,4,36),material=new THREE.MeshBasicMaterial({color:e.kind==='frag'?0xffa360:0x78d6e0,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});geometry.userData.raidOwned=material.userData.raidOwned=true;mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=Math.PI/2}
    mesh.userData.kind=e.kind;this.scene.add(mesh);this.utilityEffects.set(e.id,mesh);
   }
   const active=snapshot.serverTime>=e.activeAt;mesh.position.set(e.x,e.y+(e.kind==='smoke'?1.5:.15),e.z);if(e.kind==='smoke')mesh.scale.setScalar(active?e.radius:.15);else if(e.kind==='frag')mesh.material.color.setHex(e.detonated?0xff3825:0xffa360);
  }
  for(const [id,mesh]of this.utilityEffects)if(!live.has(id)){this.scene.remove(mesh);disposeOwned(mesh);this.utilityEffects.delete(id)}
 }
 buildSky(){
  const orb=(radius,color)=>{const geometry=new THREE.SphereGeometry(radius,12,8),material=new THREE.MeshBasicMaterial({color,fog:false,depthWrite:false});geometry.userData.raidOwned=material.userData.raidOwned=true;const mesh=new THREE.Mesh(geometry,material);this.scene.add(mesh);return mesh};
  this.sunOrb=orb(3.4,0xffd7a5);this.moonOrb=orb(2.2,0xd6e6f6);
  const positions=[];for(let i=0;i<220;i++){const y=.08+.88*(i+.5)/220,angle=i*2.399963,ring=Math.sqrt(1-y*y);positions.push(Math.cos(angle)*ring*185,y*185,Math.sin(angle)*ring*185)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.userData.raidOwned=true;const material=new THREE.PointsMaterial({color:0xdfebff,size:.4,transparent:true,opacity:0,fog:false,depthWrite:false});material.userData.raidOwned=true;this.stars=new THREE.Points(geometry,material);this.scene.add(this.stars);
 }
 updateEnvironment(blend){
  const target=this.environmentTarget;if(!target)return;this.scene.background.lerp(target.sky,blend);this.scene.fog.color.lerp(target.fog,blend);this.scene.fog.near+=(28*target.visibility-this.scene.fog.near)*blend;this.scene.fog.far+=(150*target.visibility-this.scene.fog.far)*blend;this.sun.intensity+=(target.light-this.sun.intensity)*blend;this.hemi.intensity+=(target.ambient-this.hemi.intensity)*blend;
  const lightPosition=target.sun.y>=0?target.sun:target.sun.clone().multiplyScalar(-1);this.sun.position.lerp(lightPosition,blend);this.sunOrb.position.copy(target.sun);this.moonOrb.position.copy(target.sun).multiplyScalar(-1);this.sunOrb.visible=target.sun.y>0;this.moonOrb.visible=target.sun.y<0;this.stars.material.opacity+=(1-target.daylight-this.stars.material.opacity)*blend;this.stars.visible=this.stars.material.opacity>.01;
 }
 fire(){this.recoil=this.settings?.reduced?0:.07;const s=this.snapshot?.self,item=s&&[...s.equipment,...s.pack].find(it=>it.id===s.weaponId);this.audio.play(item?'shot:'+item.weapon:'shot')}
 frame(time,yaw,pitch,predicted,aiming=false){
  if(!this.snapshot)return;const dt=Math.min(.05,(time-this.lastTime)/1000||.016);this.lastTime=time;const seconds=time/1000,s=this.snapshot.self;this.updateEnvironment(1-Math.exp(-dt*3));
  const pose=s.alive&&predicted?predicted:s,target=new THREE.Vector3(pose.x,(pose.y||0)+(s.downed?.65:s.ballisticsVersion===1?SHOT_EYE_HEIGHT:1.65),pose.z);
  if(!s.alive&&this.snapshot.camera)target.set(this.snapshot.camera.x,(this.snapshot.camera.y||0)+2,this.snapshot.camera.z);
  if(this.visualSelf.distanceTo(target)>5)this.visualSelf.copy(target);else this.visualSelf.lerp(target,Math.min(1,dt*16));this.camera.position.copy(this.visualSelf);const held=[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),targetFov=aiming&&held?aimFieldOfView(this.settings?.fov||75,weaponStats(held)):this.settings?.fov||75;this.camera.fov+=(targetFov-this.camera.fov)*(this.settings?.reduced?1:1-Math.exp(-dt*16));this.camera.rotation.set(!s.alive&&this.snapshot.camera?this.snapshot.camera.pitch:pitch,(!s.alive&&this.snapshot.camera?this.snapshot.camera.yaw:yaw)+Math.PI,0,'YXZ');
  for(const {model,data,type}of this.actors.values()){
   if(type==='human'||type==='machine')updateActor(model,data,dt,seconds);
   else{model.position.set(data.x,data.y||0,data.z);if(type==='exit')model.userData.exitRing?.material.color.setHex(exitColor(data,this.snapshot.serverTime))}
  }
  if(this.weather.visible){const positions=this.weather.geometry.attributes.position;for(let i=0;i<positions.count;i++){const speed=this.snapshot.conditions?.weather==='rain'?18:2;let y=positions.getY(i)-dt*speed;if(y<0)y=35;positions.setY(i,y)}positions.needsUpdate=true}
  for(const ring of this.effects.values())ring.material.opacity=this.settings?.reduced?.85:.6+.2*Math.sin(seconds*8);
  this.recoil=Math.max(0,this.recoil-dt*.5);this.gunRoot.position.set((aiming?0:.2)+(this.settings?.reduced||aiming?0:Math.sin(seconds*1.7)*.004),(aiming?-.17:-.22)+(this.settings?.reduced||aiming?0:Math.sin(seconds*2.1)*.004),-.5+this.recoil);this.gunRoot.rotation.x=-this.recoil;
  const width=innerWidth,height=innerHeight;if(this.canvas.width!==Math.round(width*this.renderer.getPixelRatio())||this.canvas.height!==Math.round(height*this.renderer.getPixelRatio()))this.renderer.setSize(width,height,false);
  this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.weaponCamera.aspect=width/height;this.weaponCamera.updateProjectionMatrix();
  this.renderer.clear();this.renderer.render(this.scene,this.camera);if(s.alive&&!s.downed){this.renderer.clearDepth();this.renderer.render(this.overlay,this.weaponCamera)}
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
