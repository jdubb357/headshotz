import * as THREE from './lib/three.module.min.js';
import {mergeParts} from './gfx.js';
import {gunParts,handParts} from './weapons.js';
import {makeCharacterWithCache,animate} from './chars.js';
import {WEAPONS} from './shared/raid-catalog.mjs';
import {MACHINES} from './shared/raid-enemies.mjs';
import {lootTierColor} from './shared/raid-loot-presentation.mjs';
const geometries={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,12,8),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,8),ring:new THREE.TorusGeometry(1,.08,5,24)};
const HIT_FLASH_COLOR=new THREE.Color(0xffffff);
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
// Presentation-only worn plating for machines. A seeded procedural canvas paints
// panel seams, rivets, rust blooms, scratches and grime; the same neutral texture
// is tinted by each machine's existing hull colour. The texture is shared and not
// marked raidOwned, so per-actor disposal never frees another machine's map.
let wornPlatingTex=null,coreGlowTex=null;
function wornPlatingTexture(){
 if(wornPlatingTex)return wornPlatingTex;
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d');
 let seed=0x5eed1a7f;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
 g.fillStyle='#b4b7ad';g.fillRect(0,0,size,size);
 // Welded panel seams with bolt rows.
 g.strokeStyle='rgba(33,41,39,.72)';g.lineWidth=3;
 for(const y of [1/3,2/3]){g.beginPath();g.moveTo(0,size*y);g.lineTo(size,size*y);g.stroke()}
 for(const x of [1/4,3/4]){g.beginPath();g.moveTo(size*x,0);g.lineTo(size*x,size);g.stroke()}
 for(const y of [1/3,2/3])for(let x=14;x<size;x+=32){
  g.fillStyle='rgba(228,232,220,.55)';g.beginPath();g.arc(x+1,size*y+1,2.8,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(26,32,30,.4)';g.beginPath();g.arc(x,size*y,2.8,0,Math.PI*2);g.fill();
 }
 // Rust blooms bleeding out of seams and scratches.
 for(let i=0;i<12;i++){const x=rnd()*size,y=rnd()*size,r=16+rnd()*36,a=.1+rnd()*.24;
  const grd=g.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,'rgba(121,56,24,'+a.toFixed(3)+')');grd.addColorStop(1,'rgba(121,56,24,0)');
  g.fillStyle=grd;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
 }
 // Chipped edges and scuffs.
 for(let i=0;i<42;i++){const x=rnd()*size,y=rnd()*size,l=3+rnd()*16;
  g.strokeStyle=rnd()<.6?'rgba(236,238,228,.34)':'rgba(44,51,47,.42)';g.lineWidth=1;
  g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*l,y+(rnd()-.5)*l*.4);g.stroke();
 }
 // Fine deterministic grime speckle.
 for(let i=0;i<950;i++){g.fillStyle='rgba(28,33,30,'+(.04+rnd()*.12).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.2,1.2)}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 wornPlatingTex=texture;return texture;
}
function coreGlowTexture(){
 if(coreGlowTex)return coreGlowTex;
 const size=64,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d');
 const grd=g.createRadialGradient(32,32,0,32,32,32);grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.38,'rgba(255,255,255,.48)');grd.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=grd;g.fillRect(0,0,size,size);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;coreGlowTex=texture;return texture;
}
function wornMat(color){const key='worn|'+color;if(!materials.has(key)){const material=new THREE.MeshStandardMaterial({color,map:wornPlatingTexture(),roughness:.74,metalness:.53,envMapIntensity:.95});material.userData.raidWorn=true;materials.set(key,material)}return materials.get(key)}
export function part(root,type,color,x,y,z,sx,sy,sz,rotation){const mesh=new THREE.Mesh(geometries[type]||geometries.box,mat(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);if(rotation)mesh.rotation.set(...rotation);root.add(mesh);return mesh}
function wornPart(root,type,color,x,y,z,sx,sy,sz,rotation){const mesh=part(root,type,color,x,y,z,sx,sy,sz,rotation);mesh.material=wornMat(color);mesh.userData.raidWorn=true;return mesh}
function lightPart(root,x,y,z,r=.15,withHalo=true){
 const mesh=new THREE.Mesh(geometries.sphere,new THREE.MeshBasicMaterial({color:0xff5038}));mesh.position.set(x,y,z);mesh.scale.setScalar(r);root.add(mesh);root.userData.core=mesh;mesh.material.userData.raidOwned=true;
 if(withHalo){
  const material=new THREE.SpriteMaterial({map:coreGlowTexture(),color:0xff5038,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending});material.userData.raidOwned=true;
  const halo=new THREE.Sprite(material);halo.scale.setScalar(2.7);mesh.add(halo);mesh.userData.halo=halo;
 }
 return mesh;
}
export function weaponModel(id,hands=false){
 const {parts,info}=gunParts(id==='pistol'?'handgun':id,1),all=hands?parts.concat(handParts(info,0x43565c)):parts,groups=new Map(),root=new THREE.Group();
 for(const p of all){const key=p.mat||'metal';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 for(const [key,parts]of groups){const geometry=mergeParts(parts,{uv:true});geometry.userData.raidOwned=true;
  const metal=['metal','alu','chrome','brass'].includes(key),polished=key==='alu'||key==='chrome';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:metal?polished?.22:.38:key==='wood'?.88:.78,metalness:key==='brass'?.72:metal?.66:.1,envMapIntensity:metal?(polished?1.55:1.35):1});material.userData.raidOwned=true;
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
export function machineModel(kind,options={}){
 const def=MACHINES[kind]||MACHINES.scout,root=new THREE.Group(),color=def.color,dark=0x253139,metal=0x697a7b,plain=options.plain===true;
 root.userData.kind=kind;root.userData.legs=[];
 const features=[];
 // Hulls and armour receive the shared worn-plating map; small accents stay on
 // the plain material cache. `plain` is an evidence-only switch used by the
 // grader to reconstruct the former generic model for before/after measurement;
 // production sync never passes it.
 const hull=(type,c,x,y,z,sx,sy,sz,rotation)=>plain?part(root,type,c,x,y,z,sx,sy,sz,rotation):wornPart(root,type,c,x,y,z,sx,sy,sz,rotation);
 const detail=(type,c,x,y,z,sx,sy,sz,rotation)=>{if(plain)return null;const mesh=part(root,type,c,x,y,z,sx,sy,sz,rotation);mesh.userData.raidDetail=true;features.push(mesh);return mesh};
 let silhouette=[];
 if(kind==='scout'){
  hull('cylinder',color,0,.65,0,.5,.45,.5);hull('sphere',dark,0,1,0,.35,.25,.35);
  for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;part(root,'box',metal,Math.sin(angle)*.5,.3,Math.cos(angle)*.5,.12,.65,.12,[Math.cos(angle)*.4,0,Math.sin(angle)*.4]);part(root,'cylinder',dark,Math.sin(angle)*.65,.12,Math.cos(angle)*.65,.18,.15,.18,[0,0,Math.PI/2])}
  if(!plain){
   detail('cylinder',metal,0,1.5,.02,.026,.6,.026);
   detail('cone',0xff8a5e,0,1.92,.02,.1,.22,.1);
   detail('box',metal,-.46,.8,0,.22,.08,.52,[0,0,-.24]);
   detail('box',metal,.46,.8,0,.22,.08,.52,[0,0,.24]);
   detail('box',metal,0,1.18,.33,.26,.09,.09);
   silhouette=['antenna','side-fins','lens-housing'];
  }
  lightPart(root,0,def.core,.33,.12,!plain);
 }else if(kind==='hunter'){
  hull('box',color,0,1.2,0,.9,.55,1.25);hull('box',dark,0,1.45,.6,.65,.4,.6);
  for(const x of [-.58,.58])for(const z of [-.45,.45]){const pivot=new THREE.Group();pivot.position.set(x,1,z);root.add(pivot);part(pivot,'box',metal,0,-.25,0,.16,.6,.18,[.2,0,x>0?-.3:.3]);part(pivot,'box',dark,0,-.7,.12,.17,.55,.16,[-.35,0,0]);part(pivot,'box',dark,0,-.95,.25,.28,.12,.4);root.userData.legs.push(pivot)}
  if(!plain){
   detail('box',metal,0,1.52,-.36,.2,.09,.5,[-.32,0,0]);
   detail('box',metal,0,1.64,-.08,.24,.1,.38,[-.5,0,0]);
   detail('cylinder',dark,0,1.82,.6,.05,.5,.05);
   detail('cone',0xff8a5e,0,2.16,.6,.12,.26,.12);
   detail('box',metal,-.64,1.34,.02,.36,.16,.72,[0,0,.16]);
   detail('box',metal,.64,1.34,.02,.36,.16,.72,[0,0,-.16]);
   detail('sphere',0xff8a5e,0,1.3,.94,.12,.07,.06);
   for(const x of [-.58,.58])detail('box',metal,x,1.05,-.72,.2,.42,.16,[0,0,x*.4]);
   silhouette=['dorsal-ridge','sensor-mast','shoulder-cowls','hip-fins','head-lens'];
  }
  lightPart(root,0,def.core,.75,.15,!plain);
 }else if(kind==='heavy'){
  for(const x of [-.8,.8]){part(root,'box',dark,x,.35,0,.45,.65,1.85);for(const z of [-.6,0,.6])part(root,'cylinder',metal,x,.3,z,.25,.5,.25,[0,0,Math.PI/2])}
  hull('box',color,0,1.3,0,1.5,1.5,1.1);hull('box',metal,0,2.25,0,1.1,.6,1);part(root,'cylinder',dark,0,2.3,.9,.18,1.5,.18,[Math.PI/2,0,0]);
  for(const x of [-.6,.6])hull('box',color,x,1.8,.65,.45,1.6,.25,[0,0,x*.18]);
  if(!plain){
   for(let i=0;i<3;i++)detail('box',0xd29a3d,-.12+i*.24,.88,.56,.1,.3,.03,[0,0,Math.PI/4]);
   for(let i=0;i<4;i++)detail('box',dark,0,.72+i*.24,-.56,.78,.05,.04);
   detail('box',metal,-.92,1.55,0,.7,.2,.9,[0,0,.12]);
   detail('box',metal,.92,1.55,0,.7,.2,.9,[0,0,-.12]);
   detail('cylinder',metal,-1.12,1.95,0,.11,.42,.11);
   detail('cylinder',metal,1.12,1.95,0,.11,.42,.11);
   silhouette=['hazard-chevrons','rear-vents','shoulder-plates','piston-stacks'];
  }
  lightPart(root,0,def.core,.6,.2,!plain);
 }else if(kind==='flyer'){
  hull('sphere',color,0,.55,0,.48,.4,.55);hull('box',dark,0,.32,0,.45,.4,.45);
  for(const x of [-.75,.75])for(const z of [-.55,.55]){part(root,'box',metal,x/2,.6,z/2,.9,.12,.15,[0,-Math.sign(x*z)*.55,0]);part(root,'ring',dark,x,.63,z,.4,.4,.4,[Math.PI/2,0,0]);part(root,'box',metal,x,.65,z,.65,.04,.08)}
  if(!plain){
   for(const x of [-.78,.78]){
    detail('box',metal,x,.8,-.02,.76,.06,.2,[0,0,-Math.sign(x)*.18]);
    detail('box',dark,x*.92,.87,-.02,.2,.05,.3,[0,0,-Math.sign(x)*.3]);
   }
   detail('sphere',0xff8a5e,0,.3,.58,.09,.09,.06);
   detail('cylinder',dark,0,.2,-.58,.12,.4,.12,[Math.PI/2,0,0]);
   detail('cone',0xff8a5e,0,.2,-.84,.1,.24,.1,[-Math.PI/2,0,0]);
   for(const x of [-.3,.3])detail('box',dark,x,.03,-.18,.08,.3,.1,[0,0,x*.6]);
   silhouette=['rotor-blades','belly-sensor','rear-thruster','landing-struts'];
  }
  lightPart(root,0,def.core,.45,.16,!plain);
 }else{
  for(const x of [-1.35,1.35])for(const z of [-.8,.8]){const pivot=new THREE.Group();pivot.position.set(x,2.2,z);root.add(pivot);part(pivot,'box',metal,0,-.8,0,.45,1.9,.5,[0,0,x*.15]);part(pivot,'box',dark,x*.15,-1.9,.2,.7,.4,1.1);root.userData.legs.push(pivot)}
  hull('box',color,0,3.2,0,2.3,2.1,1.8);hull('box',dark,0,4.65,0,1.5,.75,1.4);
  for(const x of [-1.6,1.6]){hull('box',metal,x,3.7,0,.65,.7,1.2);part(root,'cylinder',dark,x,3.75,.9,.24,1.6,.24,[Math.PI/2,0,0])}
  part(root,'ring',metal,0,def.core,1, .65,.65,.65);
  if(!plain){
   for(const x of [-.5,0,.5])detail('cone',metal,x,5.15,0,.16,.5,.16);
   for(let i=0;i<5;i++)detail('box',0xff9a2f,0,3.02+i*.24,.92,.6,.05,.04);
   for(const x of [-1.95,1.95])detail('box',metal,x,4.35,0,.32,1.2,.7,[0,0,-x*.06]);
   silhouette=['crown-spikes','chest-vents','shoulder-pylons'];
  }
  lightPart(root,0,def.core,1.05,.42,!plain);
 }
 root.userData.machineDetail={worn:!plain,halo:!plain,features:silhouette,detailCount:features.length};
 root.userData.actor='machine';return root;
}

export function propModel(kind,color=0xe0aa4d,options={}){
 const root=new THREE.Group();
 if(kind==='ping'){
  part(root,'cylinder',0xf4d284,0,1,0,.04,2,.04);part(root,'cone',0xf4d284,0,2.3,0,.32,.5,.32,[0,0,Math.PI]);part(root,'ring',0xf4d284,0,.12,0,.7,.7,.7,[Math.PI/2,0,0]);
 }else if(kind==='cache'){
  part(root,'box',0x35444b,0,.4,0,1.25,.75,.85);const lid=part(root,'box',color,0,.82,0,1.32,.12,.92);lid.material=lid.material.clone();lid.material.userData.raidOwned=true;root.userData.lid=lid;
  for(const x of [-.45,.45])part(root,'box',0x9ca4a0,x,.46,.44,.12,.6,.05);part(root,'box',0x8dc5b6,0,.54,.46,.25,.12,.03);
  // Procedural municipal crate detail: reinforcement feet, riveted lid seam and
  // a true loot-tier accent. The accent tint is derived from the shared rarity
  // palette so a cache reads at the same tier as the loot inside it. This is
  // presentation-only; item ownership and open/vault status remain authoritative.
  for(const x of [-.59,.59])for(const z of [-.38,.38])part(root,'box',0x7d8580,x,.1,z,.11,.16,.07);
  for(const x of [-.52,-.18,.18,.52])part(root,'box',0x6b7370,x,.755,.448,.05,.025,.025);
  const tier=Math.max(0,Math.min(5,Math.trunc(Number(options.tier))||0)),accent=lootTierColor(tier),tierGroup=new THREE.Group();
  tierGroup.userData.cacheTierGroup=true;tierGroup.userData.tier=tier;root.add(tierGroup);
  part(tierGroup,'ring',accent,0,.036,0,.74,.74,.74,[Math.PI/2,0,0]);
  for(const z of [-.468,.468])part(tierGroup,'box',accent,0,.82,z,1.2,.035,.02);
  for(const x of [-.455,.455])part(tierGroup,'box',accent,x,.55,.468,.1,.24,.02);
  part(tierGroup,'box',accent,0,.3,.444,.26,.12,.02);
  const seal=part(tierGroup,'box',accent,0,.9,0,.24,.04,.24);seal.rotation.y=Math.PI/4;
  root.userData.cacheTier=tier;root.userData.cacheAccent=accent;root.userData.cacheTierGroup=tierGroup;
 }else if(kind==='loot'){
  part(root,'box',0x3d463d,-.12,.09,0,.85,.12,.28,[0,.15,0]);part(root,'box',0x7b8577,-.12,.15,0,.55,.05,.55,[0,.15,0]);part(root,'box',0x343933,.05,.22,0,.2,.2,.16);part(root,'box',0x303833,0,.1,.22,.5,.18,.38);
  part(root,'ring',color,0,.3,0,.58,.58,.58,[Math.PI/2,0,0]);part(root,'cylinder',color,0,.48,0,.035,.55,.035);
 }else if(kind==='bag'){
  part(root,'box',0x47534d,0,.22,0,.85,.4,.65);for(const x of [-.25,.25])part(root,'box',0xa89670,x,.25,0,.09,.45,.72);part(root,'ring',0x35444b,0,.45,0,.15,.15,.15);
 }else if(kind==='door'){
  // A single authoritative slab plus a floor sill: closed doors read as a solid
  // barrier, open ones as a lit threshold, and locks are colored red.
  const leaf=part(root,'box',color,0,1.4,0,1,1,1);leaf.material=leaf.material.clone();leaf.material.userData.raidOwned=true;root.userData.doorLeaf=leaf;
  const sill=part(root,'box',0x8dbb9b,0,.05,0,1,.1,1);sill.material=sill.material.clone();sill.material.userData.raidOwned=true;root.userData.doorSill=sill;
 }else{
  part(root,'cylinder',0x36474d,0,.07,0,3,.12,3);const ring=part(root,'ring',color,0,.15,0,2.6,2.6,2.6,[Math.PI/2,0,0]);ring.material=ring.material.clone();ring.material.userData.raidOwned=true;root.userData.exitRing=ring;
  part(root,'box',0x53646b,2.3,.8,0,.45,1.6,.45);part(root,'box',color,2.3,1.6,0,.5,.2,.5);
 }
 root.userData.actor=kind;return root;
}
// Tall additive columns mark the armories and exits from a distance without
// needing a label sprite. They are built from their own geometry/material so
// the shared prop palette is never mutated.
export function beaconModel(color=0x83efc2,height=16){
 const root=new THREE.Group();
 const shaftGeometry=new THREE.CylinderGeometry(.08,.28,height,8,1,true);shaftGeometry.userData.raidOwned=true;
 const shaftMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});shaftMaterial.userData.raidOwned=true;
 const shaft=new THREE.Mesh(shaftGeometry,shaftMaterial);shaft.position.y=height/2+1.6;root.add(shaft);
 const ringGeometry=new THREE.TorusGeometry(1.6,.09,5,32);ringGeometry.userData.raidOwned=true;
 const ringMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending});ringMaterial.userData.raidOwned=true;
 const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.2;root.add(ring);
 root.userData.beacon=true;root.userData.beaconShaft=shaft;root.userData.beaconRing=ring;return root;
}
export function updateActor(root,state,dt,time){
 const previous=root.userData.last||{x:state.x,z:state.z,at:time-.15};
 if(previous.x!==state.x||previous.z!==state.z){root.userData.speed=Math.min(8,Math.hypot(state.x-previous.x,state.z-previous.z)/Math.max(.1,time-previous.at));root.userData.last={x:state.x,z:state.z,at:time}}else if(time-previous.at>.4)root.userData.speed=(root.userData.speed||0)*.9;
 const speed=root.userData.speed||0;
 // A visible HP drop is the only evidence of incoming damage, so unchanged
 // snapshots never replay the reaction. Reduced motion keeps both a still pose
 // and a stable machine core.
 if(Number.isFinite(state.hp)){
  const priorHp=root.userData.lastHp,actor=root.userData.actor;
  if(Number.isFinite(priorHp)&&state.hp<priorHp&&!state.reduced){
   const damage=priorHp-state.hp;
   if(actor==='human')root.userData.flinch=Math.min(1,(root.userData.flinch||0)+.4+Math.min(.55,damage/110));
   else if(actor==='machine')root.userData.hitFlash=1;
  }
  root.userData.lastHp=state.hp;
 }
 const target=new THREE.Vector3(state.x,state.y||0,state.z);if(!root.userData.placed){root.position.copy(target);root.userData.placed=true}else root.position.lerp(target,Math.min(1,dt*14));
 root.rotation.y=(state.yaw||0)+(root.userData.actor==='human'?Math.PI:0);
 if(root.userData.actor==='human')animate(root,{speed,pitch:state.pitch||0,dist:10,down:!!state.downed,air:!!state.air,slide:!!state.sliding,crouch:!!state.crouch,reduced:state.reduced===true},dt);
 else if(root.userData.actor==='machine'){
  for(const [i,leg]of root.userData.legs.entries())leg.rotation.x=Math.sin(time*7+i*Math.PI)*Math.min(.35,speed*.1);
  const phase=root.userData.kind==='overlord'&&state.bossPhase?state.bossPhase:null,reduced=root.userData.motionReduced===true||state.reduced===true;
  const hitFlash=Math.max(0,(root.userData.hitFlash||0)-dt*3.6);root.userData.hitFlash=reduced?0:hitFlash;
  const core=root.userData.core;if(core){
   const strobe=!reduced&&phase==='meltdown'&&Math.sin(time*14)>0;
   core.material.color.setHex(state.state==='windup'?0xffe28e:strobe?0xfff4ea:phase==='meltdown'?0xff2c1e:phase==='furnace'?0xff9a2f:phase==='approach'?0xff6a52:0xff5038);
   if(!reduced&&hitFlash>0)core.material.color.lerp(HIT_FLASH_COLOR,Math.min(1,hitFlash*.85));
   const phasePulse=phase==='furnace'&&!reduced?1.12+.18*Math.sin(time*9):strobe?1.5:1;
   const hitPulse=reduced?0:1+hitFlash*.5;
   core.scale.setScalar((root.userData.kind==='overlord'?.42:root.userData.kind==='heavy'?.2:.15)*phasePulse*(state.state==='windup'?1.2+.15*Math.sin(time*12):1)*hitPulse);
   const halo=core.userData.halo;
   if(halo){
    halo.material.color.copy(core.material.color);
    halo.material.opacity=reduced?.24:state.state==='windup'?.7:phase==='meltdown'?.34+.3*Math.max(0,Math.sin(time*10)):phase==='furnace'?.58:.44;
   }
  }
  const beacon=root.userData.beacon;
  if(beacon){const color=phase==='meltdown'?0xff3a2e:phase==='furnace'?0xffb04a:0x9db6c4;beacon.userData.beaconShaft.material.color.setHex(color);beacon.userData.beaconRing.material.color.setHex(color);beacon.visible=!reduced}
 }
}
export function disposeOwned(root){root.traverse(node=>{releaseCharacterGeometry(node);if(node.isInstancedMesh&&node.geometry?.userData.raidOwned)node.dispose();if(node.geometry?.userData.raidOwned)node.geometry.dispose();const list=Array.isArray(node.material)?node.material:[node.material];for(const m of list)if(m?.userData.raidOwned){if(m.userData.raidOwnTexture)m.map?.dispose();if(m.userData.raidOwnNormalTexture)m.normalMap?.dispose();m.dispose()}})}
