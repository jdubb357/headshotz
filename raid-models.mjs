import * as THREE from './lib/three.module.min.js';
import {mergeParts} from './gfx.js';
import {gunParts,handParts} from './weapons.js';
import {makeCharacterWithCache,animate} from './chars.js';
import {WEAPONS} from './shared/raid-catalog.mjs';
import {MACHINES} from './shared/raid-enemies.mjs';
const geometries={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,12,8),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,8),ring:new THREE.TorusGeometry(1,.08,5,24)};
const materials=new Map();
const characterGeometryCache=Object.create(null),characterGeometryRefs=new Map(),idleCharacterGeometry=new Map(),IDLE_CHARACTER_GEOMETRY_LIMIT=112;
function pruneCharacterGeometry(){
 for(const [key,geometry]of Object.entries(characterGeometryCache))if(!geometry||!characterGeometryRefs.has(geometry)&&!idleCharacterGeometry.has(geometry)){delete characterGeometryCache[key];geometry?.dispose()}
 while(idleCharacterGeometry.size>IDLE_CHARACTER_GEOMETRY_LIMIT){const geometry=idleCharacterGeometry.keys().next().value;idleCharacterGeometry.delete(geometry);for(const [key,cached]of Object.entries(characterGeometryCache))if(cached===geometry)delete characterGeometryCache[key]}
}
export function characterGeometryStats(){return {active:characterGeometryRefs.size,idle:idleCharacterGeometry.size,cached:Object.values(characterGeometryCache).filter(Boolean).length,idleLimit:IDLE_CHARACTER_GEOMETRY_LIMIT}}
function retainCharacterGeometry(root){
 const cached=new Set(Object.values(characterGeometryCache)),used=new Set();root.traverse(node=>{if(node.geometry&&cached.has(node.geometry))used.add(node.geometry)});
 for(const geometry of used){idleCharacterGeometry.delete(geometry);characterGeometryRefs.set(geometry,(characterGeometryRefs.get(geometry)||0)+1)}
 root.userData.raidCharacterGeometry=[...used];pruneCharacterGeometry();
}
function releaseCharacterGeometry(root){
 const used=root.userData.raidCharacterGeometry;if(!used)return;delete root.userData.raidCharacterGeometry;
 for(const geometry of used){const count=characterGeometryRefs.get(geometry)||0;if(count>1)characterGeometryRefs.set(geometry,count-1);else{characterGeometryRefs.delete(geometry);geometry.dispose();idleCharacterGeometry.set(geometry,true)}}
 pruneCharacterGeometry();
}
function mat(color,glow=false){const key=color+'|'+glow;if(!materials.has(key))materials.set(key,glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.35}));return materials.get(key)}
export function part(root,type,color,x,y,z,sx,sy,sz,rotation){const mesh=new THREE.Mesh(geometries[type]||geometries.box,mat(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);if(rotation)mesh.rotation.set(...rotation);root.add(mesh);return mesh}
function lightPart(root,x,y,z,r=.15){const mesh=new THREE.Mesh(geometries.sphere,new THREE.MeshBasicMaterial({color:0xff5038}));mesh.position.set(x,y,z);mesh.scale.setScalar(r);root.add(mesh);root.userData.core=mesh;mesh.material.userData.raidOwned=true;return mesh}
export function weaponModel(id,hands=false){
 const {parts,info}=gunParts(id==='pistol'?'handgun':id,1),all=hands?parts.concat(handParts(info,0x43565c)):parts,groups=new Map(),root=new THREE.Group();
 for(const p of all){const key=p.mat||'metal';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 for(const [key,parts]of groups){const geometry=mergeParts(parts,{uv:true});geometry.userData.raidOwned=true;
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:key==='metal'?.35:.8,metalness:['metal','alu','chrome'].includes(key)?.6:.1});material.userData.raidOwned=true;
  root.add(new THREE.Mesh(geometry,material));
 }
 root.userData.info=info;return root;
}
export function humanModel(name,id,friendly,weapon='ar'){
 let root;try{root=makeCharacterWithCache(characterGeometryCache,friendly?0x5e9cb2:0xb16f54,name,id,friendly?0x8ce6ff:0xffb9a0,null,'soldier');retainCharacterGeometry(root)}catch(error){pruneCharacterGeometry();throw error}
 const tag=root.userData.tag;if(tag){tag.material.userData.raidOwned=true;tag.material.userData.raidOwnTexture=true}
 setHumanWeapon(root,weapon);root.userData.actor='human';return root;
}
export function setHumanWeapon(root,weapon){const mount=root.userData.gunMount;if(!mount)return;const old=root.userData.raidGun;if(old){mount.remove(old);disposeOwned(old)}root.userData.raidGun=null;root.userData.heldWeapon=weapon??null;if(weapon&&Object.hasOwn(WEAPONS,weapon)){const gun=weaponModel(weapon);gun.scale.setScalar(.5);mount.add(gun);root.userData.raidGun=gun}}
export function machineModel(kind){
 const def=MACHINES[kind]||MACHINES.scout,root=new THREE.Group(),color=def.color,dark=0x253139,metal=0x697a7b;root.userData.kind=kind;root.userData.legs=[];
 if(kind==='scout'){
  part(root,'cylinder',color,0,.65,0,.5,.45,.5);part(root,'sphere',dark,0,1,0,.35,.25,.35);
  for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;part(root,'box',metal,Math.sin(angle)*.5,.3,Math.cos(angle)*.5,.12,.65,.12,[Math.cos(angle)*.4,0,Math.sin(angle)*.4]);part(root,'cylinder',dark,Math.sin(angle)*.65,.12,Math.cos(angle)*.65,.18,.15,.18,[0,0,Math.PI/2])}
  lightPart(root,0,def.core,.33,.12);
 }else if(kind==='hunter'){
  part(root,'box',color,0,1.2,0,.9,.55,1.25);part(root,'box',dark,0,1.45,.6,.65,.4,.6);
  for(const x of [-.58,.58])for(const z of [-.45,.45]){const pivot=new THREE.Group();pivot.position.set(x,1,z);root.add(pivot);part(pivot,'box',metal,0,-.25,0,.16,.6,.18,[.2,0,x>0?-.3:.3]);part(pivot,'box',dark,0,-.7,.12,.17,.55,.16,[-.35,0,0]);part(pivot,'box',dark,0,-.95,.25,.28,.12,.4);root.userData.legs.push(pivot)}
  lightPart(root,0,def.core,.75,.15);
 }else if(kind==='heavy'){
  for(const x of [-.8,.8]){part(root,'box',dark,x,.35,0,.45,.65,1.85);for(const z of [-.6,0,.6])part(root,'cylinder',metal,x,.3,z,.25,.5,.25,[0,0,Math.PI/2])}
  part(root,'box',color,0,1.3,0,1.5,1.5,1.1);part(root,'box',metal,0,2.25,0,1.1,.6,1);part(root,'cylinder',dark,0,2.3,.9,.18,1.5,.18,[Math.PI/2,0,0]);
  for(const x of [-.6,.6])part(root,'box',color,x,1.8,.65,.45,1.6,.25,[0,0,x*.18]);lightPart(root,0,def.core,.6,.2);
 }else if(kind==='flyer'){
  part(root,'sphere',color,0,.55,0,.48,.4,.55);part(root,'box',dark,0,.32,0,.45,.4,.45);
  for(const x of [-.75,.75])for(const z of [-.55,.55]){part(root,'box',metal,x/2,.6,z/2,.9,.12,.15,[0,-Math.sign(x*z)*.55,0]);part(root,'ring',dark,x,.63,z,.4,.4,.4,[Math.PI/2,0,0]);part(root,'box',metal,x,.65,z,.65,.04,.08)}
  lightPart(root,0,def.core,.45,.16);
 }else{
  for(const x of [-1.35,1.35])for(const z of [-.8,.8]){const pivot=new THREE.Group();pivot.position.set(x,2.2,z);root.add(pivot);part(pivot,'box',metal,0,-.8,0,.45,1.9,.5,[0,0,x*.15]);part(pivot,'box',dark,x*.15,-1.9,.2,.7,.4,1.1);root.userData.legs.push(pivot)}
  part(root,'box',color,0,3.2,0,2.3,2.1,1.8);part(root,'box',dark,0,4.65,0,1.5,.75,1.4);
  for(const x of [-1.6,1.6]){part(root,'box',metal,x,3.7,0,.65,.7,1.2);part(root,'cylinder',dark,x,3.75,.9,.24,1.6,.24,[Math.PI/2,0,0])}
  part(root,'ring',metal,0,def.core,1, .65,.65,.65);lightPart(root,0,def.core,1.05,.42);
 }
 root.userData.actor='machine';return root;
}
export function propModel(kind,color=0xe0aa4d){
 const root=new THREE.Group();
 if(kind==='ping'){
  part(root,'cylinder',0xf4d284,0,1,0,.04,2,.04);part(root,'cone',0xf4d284,0,2.3,0,.32,.5,.32,[0,0,Math.PI]);part(root,'ring',0xf4d284,0,.12,0,.7,.7,.7,[Math.PI/2,0,0]);
 }else if(kind==='cache'){
  part(root,'box',0x35444b,0,.4,0,1.25,.75,.85);const lid=part(root,'box',color,0,.82,0,1.32,.12,.92);lid.material=lid.material.clone();lid.material.userData.raidOwned=true;root.userData.lid=lid;
  for(const x of [-.45,.45])part(root,'box',0x9ca4a0,x,.46,.44,.12,.6,.05);part(root,'box',0x8dc5b6,0,.54,.46,.25,.12,.03);
 }else if(kind==='bag'){
  part(root,'box',0x47534d,0,.22,0,.85,.4,.65);for(const x of [-.25,.25])part(root,'box',0xa89670,x,.25,0,.09,.45,.72);part(root,'ring',0x35444b,0,.45,0,.15,.15,.15);
 }else{
  part(root,'cylinder',0x36474d,0,.07,0,3,.12,3);const ring=part(root,'ring',color,0,.15,0,2.6,2.6,2.6,[Math.PI/2,0,0]);ring.material=ring.material.clone();ring.material.userData.raidOwned=true;root.userData.exitRing=ring;
  part(root,'box',0x53646b,2.3,.8,0,.45,1.6,.45);part(root,'box',color,2.3,1.6,0,.5,.2,.5);
 }
 root.userData.actor=kind;return root;
}
export function updateActor(root,state,dt,time){
 const previous=root.userData.last||{x:state.x,z:state.z,at:time-.15};
 if(previous.x!==state.x||previous.z!==state.z){root.userData.speed=Math.min(8,Math.hypot(state.x-previous.x,state.z-previous.z)/Math.max(.1,time-previous.at));root.userData.last={x:state.x,z:state.z,at:time}}else if(time-previous.at>.4)root.userData.speed=(root.userData.speed||0)*.9;
 const speed=root.userData.speed||0;
 const target=new THREE.Vector3(state.x,state.y||0,state.z);if(!root.userData.placed){root.position.copy(target);root.userData.placed=true}else root.position.lerp(target,Math.min(1,dt*14));
 root.rotation.y=(state.yaw||0)+(root.userData.actor==='human'?Math.PI:0);
 if(root.userData.actor==='human')animate(root,{speed,pitch:0,dist:10,down:!!state.downed,air:false,slide:false},dt);
 else if(root.userData.actor==='machine'){
  for(const [i,leg]of root.userData.legs.entries())leg.rotation.x=Math.sin(time*7+i*Math.PI)*Math.min(.35,speed*.1);
  const core=root.userData.core;if(core){core.material.color.setHex(state.state==='windup'?0xffe28e:0xff5038);core.scale.setScalar((root.userData.kind==='overlord'?.42:root.userData.kind==='heavy'?.2:.15)*(state.state==='windup'?1.2+.15*Math.sin(time*12):1))}
 }
}
export function disposeOwned(root){root.traverse(node=>{releaseCharacterGeometry(node);if(node.isInstancedMesh&&node.geometry?.userData.raidOwned)node.dispose();if(node.geometry?.userData.raidOwned)node.geometry.dispose();const list=Array.isArray(node.material)?node.material:[node.material];for(const m of list)if(m?.userData.raidOwned){if(m.userData.raidOwnTexture)m.map?.dispose();m.dispose()}})}
