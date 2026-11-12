import * as THREE from './lib/three.module.min.js';
import {mergeParts,TX} from './gfx.js';
import {gunParts,handParts} from './weapons.js';
import {makeCharacterWithCache,animate} from './chars.js';
import {WEAPONS} from './shared/raid-catalog.mjs';
import {MACHINES} from './shared/raid-enemies.mjs';
import {lootTierColor} from './shared/raid-loot-presentation.mjs';
const geometries={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,12,8),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,8),ring:new THREE.TorusGeometry(1,.08,5,24),gem:new THREE.OctahedronGeometry(1,0)};
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
// Salvaged stamped-metal crate shell. Caches are the objects players search at
// range, so a shared procedural map (rolled seams, rivet border, diagonal
// braces, rust blooms and scuffs) makes them read as weathered municipal
// containers instead of flat boxes. The neutral map is tinted by each part's
// authored colour; authoritatively-owned tier accents and the open/vault lid
// status keep their own colours. One texture is shared by every cache and it is
// not chargeable to a per-actor disposal pass.
let cacheShellTex=null;
function cacheShellTexture(){
 if(cacheShellTex)return cacheShellTex;
 const size=128,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d');
 let seed=0xc42e5a1d;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
 g.fillStyle='#d4d0c4';g.fillRect(0,0,size,size);
 // Rolled plate bands with alternating light lip / dark seam.
 for(let i=0;i<7;i++){const y=8+i*17+(rnd()-.5)*3;g.strokeStyle='rgba(232,228,216,.55)';g.lineWidth=1;g.beginPath();g.moveTo(0,y);g.lineTo(size,y);g.stroke();g.strokeStyle='rgba(52,60,55,.36)';g.beginPath();g.moveTo(0,y+2);g.lineTo(size,y+2);g.stroke()}
 // Recessed panel border and corner rivet rows.
 g.strokeStyle='rgba(38,45,41,.62)';g.lineWidth=2;g.strokeRect(7,7,size-14,size-14);
 g.strokeStyle='rgba(240,236,224,.34)';g.lineWidth=1;g.strokeRect(9,9,size-18,size-18);
 for(const p of [12,44,76,108]){
  for(const [x,y] of [[p,12],[p,116],[12,p],[116,p]]){g.fillStyle='rgba(245,242,232,.72)';g.beginPath();g.arc(x,y+1,2.6,0,Math.PI*2);g.fill();g.fillStyle='rgba(30,37,33,.55)';g.beginPath();g.arc(x,y,2.6,0,Math.PI*2);g.fill()}
 }
 // Diagonal reinforcing braces welded across both panels.
 g.strokeStyle='rgba(70,78,71,.55)';g.lineWidth=4;
 for(const [ax,ay,bx,by] of [[24,24,104,104],[104,24,24,104]]){g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();g.strokeStyle='rgba(228,224,211,.26)';g.lineWidth=1;g.beginPath();g.moveTo(ax+2,ay+2);g.lineTo(bx+2,by+2);g.stroke();g.strokeStyle='rgba(70,78,71,.55)';g.lineWidth=4}
 // Rust blooms leaking from seams.
 for(let i=0;i<10;i++){const x=6+rnd()*(size-12),y=6+rnd()*(size-12),r=7+rnd()*17,a=.12+rnd()*.28;
  const grd=g.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,'rgba(122,58,27,'+a.toFixed(3)+')');grd.addColorStop(1,'rgba(122,58,27,0)');g.fillStyle=grd;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill()}
 // Chipped paint and directional handling scuffs.
 for(let i=0;i<26;i++){const x=rnd()*size,y=18+rnd()*(size-36),l=5+rnd()*22;
  g.strokeStyle=rnd()<.55?'rgba(244,240,228,.34)':'rgba(48,55,50,.34)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*l,y+(rnd()-.7)*2);g.stroke()}
 // Fine deterministic grime speckle.
 for(let i=0;i<420;i++){g.fillStyle='rgba(36,43,39,'+(.04+rnd()*.10).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.1,1.1)}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 cacheShellTex=texture;return texture;
}
function cacheShellMat(color){const key='cache-shell|'+color;if(!materials.has(key)){const material=new THREE.MeshStandardMaterial({color,map:cacheShellTexture(),roughness:.68,metalness:.52,envMapIntensity:1.05});materials.set(key,material)}return materials.get(key)}
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
// First-person weapon finish. The gun and hands are merged into a handful of
// vertex-coloured material groups, so broad colour still comes from each part's
// authored tint; these small neutral maps add the tooth that made the model read
// plastic: brushed steel streaks, edge scratches, wood grain, glove leather grain
// and woven sleeve texture. They are generated once, shared by every weapon, and
// never charged to a weapon's disposal pass.
let gunMetalTex=null,gunWoodTex=null,gunLeatherTex=null,gunFabricTex=null;
function gunCanvasTexture(size,paint){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const g=canvas.getContext('2d'),rnd=(()=>{let seed=0x7f3a9c21;return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296}})();
 paint(g,size,rnd);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 return texture;
}
function gunMetalTexture(){
 if(gunMetalTex)return gunMetalTex;
 gunMetalTex=gunCanvasTexture(256,(g,size,rnd)=>{
  g.fillStyle='#e9e9e9';g.fillRect(0,0,size,size);
  // Worn finish blotches: slightly darker patches where handling has polished
  // or scorched the parkerising.
  for(let i=0;i<18;i++){
   const r=18+rnd()*60,x=rnd()*size,y=rnd()*size,v=Math.round(196+rnd()*35);
   const grd=g.createRadialGradient(x,y,0,x,y,r);
   grd.addColorStop(0,`rgba(${v},${v},${v},${(.16+rnd()*.22).toFixed(3)})`);grd.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=grd;g.fillRect(x-r,y-r,r*2,r*2);
  }
  // Brushed machining streaks, mostly horizontal, with occasional bright hilites.
  for(let i=0;i<110;i++){
   const y=rnd()*size,l=8+rnd()*90,x=rnd()*size;
   g.strokeStyle=rnd()<.5?'rgba(255,255,255,.16)':'rgba(66,69,70,.14)';
   g.lineWidth=rnd()<.25?1.6:1;g.beginPath();g.moveTo(x,y);g.lineTo(x+l,y+(rnd()-.5)*1.4);g.stroke();
  }
  // Scrapes and gouges with a bright lip so they catch the key light.
  for(let i=0;i<58;i++){
   const x=rnd()*size,y=rnd()*size,l=3+rnd()*20,a=rnd()*Math.PI;
   g.strokeStyle='rgba(48,52,53,'+(.18+rnd()*.32).toFixed(3)+')';
   g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
   g.strokeStyle='rgba(255,255,255,.16)';g.beginPath();g.moveTo(x+Math.cos(a)*.5,y+Math.sin(a)*.5);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  // Pitting, rivet-level grit and a little oil grime.
  for(let i=0;i<260;i++){const v=rnd()<.5?'35,39,40':'244,244,240';g.fillStyle='rgba('+v+','+(.05+rnd()*.09).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.6,1.6)}
  for(let i=0;i<4;i++){
   const x=rnd()*size,y=rnd()*size,r=14+rnd()*36;
   const grd=g.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,'rgba(76,48,24,.16)');grd.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=grd;g.fillRect(x-r,y-r,r*2,r*2);
  }
 });
 return gunMetalTex;
}
function gunWoodTexture(){
 if(gunWoodTex)return gunWoodTex;
 gunWoodTex=gunCanvasTexture(256,(g,size,rnd)=>{
  g.fillStyle='#d9c3a4';g.fillRect(0,0,size,size);
  // Long grain running down the sheet, gently waved, with lighter and darker
  // heart streaks. Tinted by the stock's authored tan so it stays warm.
  for(let i=0;i<46;i++){
   const x=rnd()*size,amp=2+rnd()*7,freq=.02+rnd()*.04,phase=rnd()*6.28;
   g.strokeStyle=rnd()<.55?'rgba(78,44,18,'+(.08+rnd()*.12).toFixed(3)+')':'rgba(255,238,206,'+(.08+rnd()*.10).toFixed(3)+')';
   g.lineWidth=.7+rnd()*1.6;g.beginPath();
   for(let y=0;y<=size;y+=8){const xx=x+Math.sin(y*freq+phase)*amp;y?g.lineTo(xx,y):g.moveTo(xx,y)}
   g.stroke();
  }
  // Knots and tiny splits.
  for(let i=0;i<5;i++){
   const x=rnd()*size,y=rnd()*size,r=3+rnd()*6;
   g.strokeStyle='rgba(66,34,12,.35)';g.lineWidth=1.2;g.beginPath();g.ellipse(x,y,r*1.8,r*.65,0,0,Math.PI*2);g.stroke();
   g.fillStyle='rgba(60,30,10,.25)';g.beginPath();g.ellipse(x,y,r*.55,r*.4,0,0,Math.PI*2);g.fill();
  }
  for(let i=0;i<260;i++){g.fillStyle=rnd()<.5?'rgba(64,38,16,'+(.05+rnd()*.1).toFixed(3)+')':'rgba(255,236,205,'+(.04+rnd()*.09).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.4,1.4)}
 });
 return gunWoodTex;
}
function gunLeatherTexture(){
 if(gunLeatherTex)return gunLeatherTex;
 gunLeatherTex=gunCanvasTexture(192,(g,size,rnd)=>{
  g.fillStyle='#d5c5b2';g.fillRect(0,0,size,size);
  // Pebbled leather grain with creases across the knuckles and wrist.
  for(let i=0;i<360;i++){
   const x=rnd()*size,y=rnd()*size,r=2+rnd()*5;
   const grd=g.createRadialGradient(x,y,0,x,y,r);
   grd.addColorStop(0,'rgba(118,92,66,.22)');grd.addColorStop(1,'rgba(118,92,66,0)');
   g.fillStyle=grd;g.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<22;i++){
   const x=rnd()*size,y=rnd()*size,l=10+rnd()*46,a=(rnd()-.5)*.7;
   g.strokeStyle='rgba(70,48,30,'+(.22+rnd()*.26).toFixed(3)+')';g.lineWidth=1;
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+l*.5,y+a*l,x+l,y+a*l*.3);g.stroke();
  }
  // Double stitch seams catch the eye at close range without extra geometry.
  for(const y of [size*.22,size*.78]){
   g.strokeStyle='rgba(246,238,224,.45)';g.lineWidth=2;g.setLineDash([5,4]);
   g.beginPath();g.moveTo(0,y);g.lineTo(size,y);g.stroke();g.setLineDash([]);
   g.strokeStyle='rgba(52,38,26,.28)';g.lineWidth=1;g.beginPath();g.moveTo(0,y+3);g.lineTo(size,y+3);g.stroke();
  }
  for(let i=0;i<180;i++){g.fillStyle='rgba(60,44,30,'+(.04+rnd()*.09).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.5,1.5)}
 });
 return gunLeatherTex;
}
function gunFabricTexture(){
 if(gunFabricTex)return gunFabricTex;
 gunFabricTex=gunCanvasTexture(192,(g,size,rnd)=>{
  g.fillStyle='#c9c9c9';g.fillRect(0,0,size,size);
  // Coarse diagonal weave so sleeves read as cloth next to the leather gloves.
  for(let i=0;i<220;i++){
   const x=rnd()*size,y=rnd()*size;
   g.strokeStyle=rnd()<.5?'rgba(255,255,255,.14)':'rgba(60,64,58,.13)';
   g.lineWidth=1;g.beginPath();
   if(rnd()<.5){g.moveTo(x,y);g.lineTo(x+3,y+3)}else{g.moveTo(x,y);g.lineTo(x+3,y-3)}
   g.stroke();
  }
  // Duty stains and faded wear patches.
  for(let i=0;i<10;i++){
   const x=rnd()*size,y=rnd()*size,r=7+rnd()*26;
   const grd=g.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,'rgba(46,48,38,.14)');grd.addColorStop(1,'rgba(46,48,38,0)');
   g.fillStyle=grd;g.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<240;i++){g.fillStyle='rgba(44,48,40,'+(.04+rnd()*.08).toFixed(3)+')';g.fillRect(rnd()*size,rnd()*size,1.2,1.2)}
 });
 return gunFabricTex;
}
let gunReticleTex=null;
function gunReticleTexture(){
 if(gunReticleTex)return gunReticleTex;
 // A crisp, hot centre dot with a short glow ring: readable at a glance and
 // still warm enough to bloom into the muzzle-flash palette instead of the
 // blown white square the bare reticle plane used to produce.
 gunReticleTex=gunCanvasTexture(64,(g,size)=>{
  g.clearRect(0,0,size,size);
  const c=size/2,halo=g.createRadialGradient(c,c,0,c,c,size*.44);
  halo.addColorStop(0,'rgba(255,108,52,.95)');halo.addColorStop(.34,'rgba(255,70,28,.4)');halo.addColorStop(.7,'rgba(255,42,18,.12)');halo.addColorStop(1,'rgba(255,42,18,0)');
  g.fillStyle=halo;g.fillRect(0,0,size,size);
  g.fillStyle='#ff4a24';g.beginPath();g.arc(c,c,size*.16,0,Math.PI*2);g.fill();
  g.fillStyle='#ffd0b0';g.beginPath();g.arc(c,c,size*.075,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,132,84,.55)';g.lineWidth=1.4;g.beginPath();g.arc(c,c,size*.34,0,Math.PI*2);g.stroke();
 });
 return gunReticleTex;
}
function gunGroupMaterial(key){
 if(key==='ret'){
  const reticle=gunReticleTexture(),material=new THREE.MeshStandardMaterial({
   map:reticle,transparent:true,alphaTest:.22,depthWrite:false,
   roughness:1,metalness:0,emissive:0xff6a3a,emissiveMap:reticle,emissiveIntensity:2.4
  });
  material.name=key;material.userData.raidOwned=true;return material;
 }
 if(key==='glass'){
  const material=new THREE.MeshStandardMaterial({
   vertexColors:true,color:0x16243a,transparent:true,opacity:.38,roughness:.12,metalness:.3,envMapIntensity:1.7
  });
  material.name=key;material.userData.raidOwned=true;return material;
 }
 const metal=['metal','alu','chrome','brass'].includes(key),polished=key==='alu'||key==='chrome';
 let map=null;
 if(key==='wood')map=gunWoodTexture();
 else if(key==='glove'||key==='pad')map=gunLeatherTexture();
 else if(key==='sleeve')map=gunFabricTexture();
 else if(key!=='rubber')map=gunMetalTexture();
 const bump=map?(key==='wood'?.0028:key==='glove'||key==='sleeve'?.0016:metal?.0042:.0032):0;
 const material=new THREE.MeshStandardMaterial({
  vertexColors:true,map:map||null,bumpMap:map||null,bumpScale:bump,
  roughness:metal?polished?.22:.38:key==='wood'?.88:key==='glove'||key==='sleeve'?.92:.78,
  metalness:key==='brass'?.72:metal?.66:.1,
  envMapIntensity:metal?(polished?1.55:1.35):key==='glove'||key==='sleeve'?.55:.85
 });
 // Sub-frame hard edges catch a cool rim so the silhouette of receiver,
 // handguard and optic separates from the background instead of reading as
 // one flat dark slab. Metal gets the strongest rim; polymer/rubber a faint
 // one. Cloth and gloves are deliberately excluded (organic, no hard edges).
 if(metal||key==='poly'||key==='rubber'){
  const rim=metal?.22:key==='poly'?.12:.07;
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'float raidEdge=pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),4.2);\n'+
    'outgoingLight+=vec3(.48,.54,.62)*'+rim.toFixed(3)+'*raidEdge;\n'+
    '#include <opaque_fragment>');
  };
 }
 material.name=key;material.userData.raidOwned=true;return material;
}
export function weaponModel(id,hands=false){
 const {parts,info}=gunParts(id==='pistol'?'handgun':id,1),all=hands?parts.concat(handParts(info,0x2f342c,0x5a4634)):parts,groups=new Map(),root=new THREE.Group();
 for(const p of all){const key=p.mat||'metal';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 for(const [key,parts]of groups){const geometry=mergeParts(parts,{uv:true});geometry.userData.raidOwned=true;
  const mesh=new THREE.Mesh(geometry,gunGroupMaterial(key));
  // The reticle is a tiny glowing plane that must sit on top of the tinted optic
  // glass no matter how the transparent groups sort.
  if(key==='ret')mesh.renderOrder=4;
  root.add(mesh);
  // Crisp bevel glints along authored hard edges. The merged group already
  // carries the silhouette, so a threshold of 25 degrees draws only at panel
  // breaks and seams rather than every triangle. One extra thin additive line
  // set per supported group; no new textures or per-shot work.
  if(key==='metal'||key==='alu'||key==='chrome'){
   const edges=new THREE.EdgesGeometry(geometry,30);
   const edgeMaterial=new THREE.LineBasicMaterial({color:0xe9dcc0,transparent:true,opacity:.20,blending:THREE.AdditiveBlending,depthWrite:false});
   edges.userData.raidOwned=true;edgeMaterial.userData.raidOwned=true;
   const glints=new THREE.LineSegments(edges,edgeMaterial);
   glints.renderOrder=1;glints.frustumCulled=false;
   root.add(glints);
  }
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
 const limb=(parent,type,c,x,y,z,sx,sy,sz,rotation)=>plain?part(parent,type,c,x,y,z,sx,sy,sz,rotation):wornPart(parent,type,c,x,y,z,sx,sy,sz,rotation);
 const detail=(type,c,x,y,z,sx,sy,sz,rotation)=>{if(plain)return null;const mesh=part(root,type,c,x,y,z,sx,sy,sz,rotation);mesh.userData.raidDetail=true;features.push(mesh);return mesh};
 let silhouette=[];
 if(kind==='scout'){
  // Needle Scout: a squat armored sensor pod carried on three articulated legs.
  // The pod is graphite with amber armour shards so the silhouette reads as a
  // machine rather than a coloured canister, and the leg sockets sit inside the
  // belly yoke so the thighs grow out of the body instead of floating beside it.
  hull('sphere',color,0,1.05,0,.58,.44,.66);               // amber carapace
  hull('sphere',0x242c31,0,.74,0,.56,.26,.62);             // belly leg yoke
  hull('box',0x242c31,0,1.43,-.06,.5,.14,.38,[0,0,.12]);  // dark dorsal spine plate
  hull('box',metal,-.42,1.05,-.22,.18,.36,.58,[0,0,-.18]); // steel side plates
  hull('box',metal,.42,1.05,-.22,.18,.36,.58,[0,0,.18]);
  hull('cone',0x39434a,0,1.0,.5,.32,.4,.3,[Math.PI/2,0,0]); // sensor beak
  hull('box',dark,0,1.22,.56,.4,.24,.2);                   // eye cowl
  hull('box',dark,-.33,1.3,.46,.22,.12,.3,[0,0,-.24]);     // brow plates flanking the sensor
  hull('box',dark,.33,1.3,.46,.22,.12,.3,[0,0,.24]);
  // The hips sit inside the belly yoke; only the thick armoured thighs emerge,
  // so there is no socket ball floating beside the silhouette. Bright steel
  // struts and a box pad carry the eye down to the ground in one connected line.
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3;
   const hip=new THREE.Group();hip.position.set(Math.sin(a)*.3,.78,Math.cos(a)*.3);hip.rotation.y=a;root.add(hip);
   part(hip,'sphere',dark,0,0,0,.2,.16,.2);                 // buried hip joint
   limb(hip,'cylinder',0x505c62,0,-.19,.16,.11,.5,.12,[-.7,0,0]); // armoured thigh
   const knee=new THREE.Group();knee.position.set(0,-.38,.32);hip.add(knee);
   part(knee,'sphere',0x3e484e,0,0,0,.16,.14,.16);
   limb(knee,'cylinder',0x8e9a9f,0,-.165,.1,.085,.39,.09,[-.545,0,0]);
   part(knee,'box',color,0,-.04,.04,.18,.1,.1,[-.545,0,0]); // amber knee guard
   const foot=new THREE.Group();foot.position.set(0,-.33,.19);knee.add(foot);
   part(foot,'cylinder',0x4d585d,0,-.005,0,.24,.055,.3);    // planted pad
   part(foot,'cylinder',0x353e43,0,-.035,0,.14,.035,.18);
   root.userData.legs.push({hip,knee,foot,baseY:.78,phase:i===1?Math.PI:0});
  }
  if(!plain){
   detail('cylinder',metal,0,1.56,0,.026,.36,.026);
   detail('cone',0xff8a5e,0,1.79,0,.09,.17,.09);
   detail('box',metal,-.7,1.03,-.1,.3,.08,.5,[0,0,-.28]);
   detail('box',metal,.7,1.03,-.1,.3,.08,.5,[0,0,.28]);
   detail('box',dark,0,1.19,.62,.38,.2,.14);               // lens housing
   detail('box',dark,0,1.25,-.58,.34,.1,.12);              // rear vent
   silhouette=['antenna','side-fins','lens-housing'];
  }
  lightPart(root,0,1.18,.74,.12,!plain);
 }else if(kind==='hunter'){
  hull('box',color,0,1.2,0,1.28,.58,1.28);hull('box',0x39434a,0,1.02,0,1.36,.32,1.12);
  // Painted steel sensor cowl: the old graphite slab read as a black hole at
  // dusk because its tint multiplied the worn map down to near-zero albedo.
  hull('box',0xa2a8ac,0,1.45,.6,.68,.44,.58);
  // Articulated legs: hip → knee → foot. The girdle reaches past the hips and
  // a socket ball seals each joint so the thighs remain visibly attached.
  for(const x of [-.58,.58])for(const z of [-.45,.45]){
   const hip=new THREE.Group();hip.position.set(x,1,z);root.add(hip);
   part(hip,'sphere',metal,0,0,0,.2,.16,.2);
   limb(hip,'cylinder',0x4b565c,0,-.2,0,.11,.5,.12,[.18,0,x>0?-.28:.28]);
   const knee=new THREE.Group();knee.position.set(0,-.46,.08);hip.add(knee);
   part(knee,'sphere',dark,0,0,0,.14,.12,.14);
   limb(knee,'cylinder',0x5d686d,0,-.2,0,.1,.44,.11,[-.2,0,0]);
   // The pad pivots independently so a lifting leg keeps its foot flat instead
   // of dangling with a tilted ankle.
   const foot=new THREE.Group();foot.position.set(0,-.44,.02);knee.add(foot);
   part(foot,'cylinder',dark,0,-.01,0,.23,.09,.32);
   part(foot,'cylinder',metal,0,-.03,.09,.18,.05,.3);
   root.userData.legs.push({hip,knee,foot,baseY:1,phase:(x*z)>0?0:Math.PI});
  }
  if(!plain){
   detail('box',metal,0,1.52,-.36,.2,.09,.5,[-.32,0,0]);
   detail('box',metal,0,1.64,-.08,.24,.1,.38,[-.5,0,0]);
   detail('cylinder',dark,0,1.82,.6,.05,.5,.05);
   detail('cone',0xff8a5e,0,2.16,.6,.12,.26,.12);
   detail('box',metal,-.64,1.34,.02,.36,.16,.72,[0,0,.16]);
   detail('box',metal,.64,1.34,.02,.36,.16,.72,[0,0,-.16]);
   detail('sphere',0xff8a5e,0,1.3,.94,.12,.07,.06);
   // Small recessed bezel and warm sensor slit, deliberately proud of the
   // painted cowl face: sitting the bezel on the same plane as the hull made
   // the two surfaces z-fight into a flat black square at dusk.
   detail('box',0x2b3438,0,1.44,.925,.44,.13,.03);
   const sensorSlit=new THREE.Mesh(geometries.box,mat(0xffc46b,true));
   sensorSlit.position.set(0,1.44,.955);sensorSlit.scale.set(.38,.06,.02);root.add(sensorSlit);
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
  // The Warden's four landing legs articulate at hip and knee so the heavy
  // chassis reads as a walker rather than a sliding tower.
  for(const x of [-1.35,1.35])for(const z of [-.8,.8]){
   const hip=new THREE.Group();hip.position.set(x,2.2,z);root.add(hip);
   part(hip,'box',metal,0,-.6,0,.45,1.55,.5,[0,0,x*.15]);
   const knee=new THREE.Group();knee.position.set(x*.12,-1.35,.16);hip.add(knee);
   part(knee,'box',dark,0,-.35,0,.72,.7,1.05);
   part(knee,'box',metal,x*.1,-.66,.22,.8,.09,1.15);
   root.userData.legs.push({hip,knee,baseY:2.2,phase:(x*z)>0?0:Math.PI});
  }
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
  // `plain` reconstructs the former flat-coloured container for evidence
  // benches only; production sync never passes it.
  const plain=options.plain===true;
  const shellPart=(type,c,x,y,z,sx,sy,sz,rotation)=>{const mesh=part(root,type,c,x,y,z,sx,sy,sz,rotation);if(!plain)mesh.material=cacheShellMat(c);return mesh};
  shellPart('box',plain?0x35444b:0x5e7176,0,.4,0,1.25,.75,.85);
  const lid=shellPart('box',color,0,.82,0,1.32,.12,.92);lid.material=lid.material.clone();lid.material.userData.raidOwned=true;root.userData.lid=lid;
  for(const x of [-.45,.45])shellPart('box',plain?0x9ca4a0:0xa3aaa5,x,.46,.44,.12,.6,.05);
  shellPart('box',plain?0x8dc5b6:0x8fb5a8,0,.54,.46,.25,.12,.03);
  // Procedural municipal crate detail: reinforcement feet, riveted lid seam and
  // a true loot-tier accent. The accent tint is derived from the shared rarity
  // palette so a cache reads at the same tier as the loot inside it. This is
  // presentation-only; item ownership and open/vault status remain authoritative.
  for(const x of [-.59,.59])for(const z of [-.38,.38])shellPart('box',plain?0x7d8580:0x9b978c,x,.1,z,.11,.16,.07);
  for(const x of [-.52,-.18,.18,.52])shellPart('box',plain?0x6b7370:0x8e918c,x,.755,.448,.05,.025,.025);
  if(!plain){
   // Corner braces, a lid hinge beam and a front latch: the load-bearing edges
   // catch light and make the crate legible even while its tier accent colour is
   // dimmed by weather.
   for(const [x,z] of [[-.6,-.4],[-.6,.4],[.6,-.4],[.6,.4]])shellPart('box',0x808a85,x,.45,z,.07,.68,.07);
   part(root,'box',0x6b7873,0,.855,-.43,1.1,.06,.1);
   part(root,'box',0xb0a685,0,.8,.46,.2,.16,.09);
   part(root,'box',0x5c6864,0,.84,.46,.11,.05,.16);
   // A dark recess under the lid lip adds depth so the container top reads as a
   // removable plate rather than a painted stripe.
   part(root,'box',0x212e32,0,.755,.47,1.18,.03,.07);
  }
  root.userData.cacheShell=!plain;
  const tier=Math.max(0,Math.min(5,Math.trunc(Number(options.tier))||0)),accent=lootTierColor(tier),tierGroup=new THREE.Group();
  tierGroup.userData.cacheTierGroup=true;tierGroup.userData.tier=tier;root.add(tierGroup);
  part(tierGroup,'ring',accent,0,.036,0,.74,.74,.74,[Math.PI/2,0,0]);
  for(const z of [-.468,.468])part(tierGroup,'box',accent,0,.82,z,1.2,.035,.02);
  for(const x of [-.455,.455])part(tierGroup,'box',accent,x,.55,.468,.1,.24,.02);
  part(tierGroup,'box',accent,0,.3,.444,.26,.12,.02);
  const seal=part(tierGroup,'box',accent,0,.9,0,.24,.04,.24);seal.rotation.y=Math.PI/4;
  root.userData.cacheTier=tier;root.userData.cacheAccent=accent;root.userData.cacheTierGroup=tierGroup;
 }else if(kind==='loot'){
  // `plain` reconstructs the former flat pile for evidence benches only;
  // production sync never passes it.
  const plain=options.plain===true;
  part(root,'box',0x3d463d,-.12,.09,0,.85,.12,.28,[0,.15,0]);part(root,'box',0x7b8577,-.12,.15,0,.55,.05,.55,[0,.15,0]);part(root,'box',0x343933,.05,.22,0,.2,.2,.16);part(root,'box',0x303833,0,.1,.22,.5,.18,.38);
  const ring=part(root,'ring',color,0,.3,0,.58,.58,.58,[Math.PI/2,0,0]);
  part(root,'cylinder',color,0,.48,0,.035,.55,.035);
  if(!plain){
   // Loose ground drops are easy to miss against debris, so production piles
   // carry presentation-only pickup beacons: an additive tinted gem, a soft
   // halo sprite, a short light wisp and a pulsing accent ring. `color` is the
   // authoritative rarity accent passed by the raid client; loot items, ids,
   // ownership and settlement are untouched.
   ring.material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending});
   ring.material.userData.raidOwned=true;
   const gemMaterial=new THREE.MeshBasicMaterial({color});
   gemMaterial.userData.raidOwned=true;
   const gem=new THREE.Mesh(geometries.gem,gemMaterial);gem.position.set(0,.95,0);gem.scale.setScalar(.13);gem.rotation.y=.4;root.add(gem);
   const haloMaterial=new THREE.SpriteMaterial({map:coreGlowTexture(),color,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending});
   haloMaterial.userData.raidOwned=true;
   const halo=new THREE.Sprite(haloMaterial);halo.position.set(0,.95,0);halo.scale.setScalar(1.1);root.add(halo);gem.userData.halo=halo;
   const wispMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending});
   wispMaterial.userData.raidOwned=true;
   const wisp=new THREE.Mesh(geometries.cylinder,wispMaterial);wisp.position.set(0,.86,0);wisp.scale.set(.035,1.2,.035);wisp.renderOrder=-1;root.add(wisp);
   root.userData.lootBeacon={gem,halo,wisp,ring};
  }
  root.userData.lootPile=!plain;
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
  const signal=exitSignalModel();root.add(signal.group);root.userData.exitSignal=signal;
 }
 root.userData.actor=kind;return root;
}
// Extraction signal: a coloured flare and a drifting smoke column above every
// exit whose winding window is scheduled or open. Visibility, tint and flare
// colour come from the authoritative `openAt`/`closeAt`/`contested` snapshot
// fields; nothing here changes boarding, seats, timing or settlement. The smoke
// shares the existing card-smoke texture and freezes to a still pose when reduced
// motion is requested, matching the dust and loot-beacon conventions.
const EXIT_SIGNAL_PUFFS=8;
function exitSignalModel(){
 const group=new THREE.Group();
 const flareMaterial=new THREE.SpriteMaterial({map:coreGlowTexture(),color:0x86efbb,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 flareMaterial.userData.raidOwned=true;
 const flare=new THREE.Sprite(flareMaterial);flare.position.set(0,1.1,0);flare.scale.setScalar(2.34);flare.renderOrder=3;group.add(flare);
 const smoke=[];
 for(let i=0;i<EXIT_SIGNAL_PUFFS;i++){
  const material=new THREE.SpriteMaterial({map:TX.smoke,color:0xd2ccc0,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending,fog:true});
  material.userData.raidOwned=true;
  const puff=new THREE.Sprite(material);
  puff.userData.exitSignalPhase=i/EXIT_SIGNAL_PUFFS;
  puff.userData.exitSignalAngle=i*2.399963;
  puff.position.set(Math.cos(i*2.399963)*.5,2.4+i*.9,Math.sin(i*2.399963)*.5);
  puff.scale.setScalar(1.2);puff.renderOrder=2;
  group.add(puff);smoke.push(puff);
 }
 group.visible=false;
 return {group,flare,smoke};
}
// Pure phase predicate: exits vent smoke only while their window is scheduled
// (inbound or open) and carry the same colour code the map and exit cards use.
export function exitSignalState(exit,now){
 const scheduled=!!exit&&Number(exit.closeAt)>now,open=scheduled&&Number(exit.openAt)<=now,contested=!!exit?.contested;
 return {scheduled,open,contested,color:contested?0xff805b:open?0x86efbb:0xd7a650,strength:open?1:.4};
}
export function updateExitSignal(signal,exit,now,seconds,reduced){
 const state=exitSignalState(exit,now);
 signal.group.visible=state.scheduled;
 if(!state.scheduled){signal.flare.visible=false;return state}
 const tint=state.contested?0xffc2b2:state.open?0xd6d0c4:0xcfc3b4;
 signal.flare.visible=state.open;
 signal.flare.material.color.setHex(state.color);
 const pulse=reduced?.78:.72+.18*Math.sin(seconds*2.6+(Number(exit.x)||0)*.02);
 signal.flare.material.opacity=pulse*state.strength;
 signal.flare.scale.setScalar((reduced?2.34:2.34+.34*Math.sin(seconds*2.6))*(state.contested?1.15:1));
 for(const puff of signal.smoke){
  const phase=puff.userData.exitSignalPhase,angle=puff.userData.exitSignalAngle;
  // Reduced motion freezes each puff at its authored sample position instead
  // of scrolling it up the column.
  const t=reduced?phase:(seconds*.19+phase)%1,spread=reduced?0:.18+t*.58;
  puff.material.color.setHex(tint);
  puff.position.y=2.4+t*19;
  puff.position.x=Math.cos(angle)*(.5+spread)+Math.sin(seconds*.7+angle)*.24*spread;
  puff.position.z=Math.sin(angle)*(.5+spread)+Math.cos(seconds*.6+angle)*.24*spread;
  puff.scale.setScalar(reduced?1.55:1.1+t*2.6);
  puff.material.opacity=(reduced?.16:Math.sin(Math.PI*t)*.34)*state.strength;
 }
 return state;
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
 // Seed the tracker on the actor's first frame. Falling back to the *current*
 // state on every frame made the first snapshot look unmoved forever: the last
 // position was never written, so speed stayed 0 and legs never gait.
 if(!root.userData.last)root.userData.last={x:state.x,z:state.z,at:time};
 const previous=root.userData.last;
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
  // Locomotion is driven by the snapshot speed: stride cadence and swing
  // amplitude rise with it, each leg flexes its knee as it swings forward so
  // the feet actually step, and the pose eases back to a planted stance when
  // the machine stops instead of snapping upright.
  const legs=root.userData.legs||[],reduced=root.userData.motionReduced===true||state.reduced===true;
  if(legs.length){
   if(root.userData.gait===undefined)root.userData.gait=((Number(state.x)||0)*.43+(Number(state.z)||0)*.71)%(Math.PI*2);
   const walking=!reduced&&speed>.15,blendTarget=walking?1:0;
   root.userData.walkBlend=(root.userData.walkBlend||0)+((blendTarget-(root.userData.walkBlend||0))*Math.min(1,dt*10));
   const blend=root.userData.walkBlend,amp=Math.min(.46,.1+speed*.09)*blend;
   if(!reduced&&walking)root.userData.gait=(root.userData.gait+dt*Math.min(2.3,.9+speed*.28)*Math.PI*2)%(Math.PI*2);
   const gait=reduced?0:root.userData.gait;
   for(const leg of legs){
    const swing=Math.sin(gait+leg.phase),lift=Math.max(0,-swing);
    leg.hip.rotation.x=swing*amp;
    leg.hip.position.y=leg.baseY+lift*.035*blend;
    leg.knee.rotation.x=-lift*amp*1.5;
    // Cancel the whole hip+knee pitch so the pads stay level with the ground
    // while the leg steps; a tilted pad was what made the feet read detached.
    if(leg.foot)leg.foot.rotation.x=-(leg.hip.rotation.x+leg.knee.rotation.x);
   }
  }
  const phase=root.userData.kind==='overlord'&&state.bossPhase?state.bossPhase:null;
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
