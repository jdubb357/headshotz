// HeadShotz external assets (all CC0 from Poly Haven — see ASSETS.md). Loaded lazily after the menu appears; Low quality skips them and keeps the built-in procedural look.
import {THREE,GQ,hqSwap} from './gfx.js';
export const HQP={ready:false,models:{},guns:{},machines:{},windows:{}};
const TEX={gunWood:1,concrete:2,brick:3,planks:2,asphalt:2,rock:2,tiles:3,metal:2,grass:3,sand:2,forest:3,dirt:3,gravel:4,cobble:3,plaster:2,crate:1.5};
const MODELS={crate:'assets/models/wooden_crate_02.glb',barrel:'assets/models/barrel_03.glb',chest:'assets/models/treasure_chest.glb'};
// Raid machine bodies are scanned/rigged GLBs, not box geometry. They are loaded
// separately from the lobby props so the raid (the only mode that spawns these
// actors) never pays for them in Battle Royale.
const MACHINE_GLB={scout:{url:'assets/models/machines/scout.glb',height:1.45}};
// Real scanned façade windows for raid facades. Extracted from Poly Haven's CC0
// "Modular Urban Apartments Facade" module, optimised to 186 KB, one timber frame
// plus recessed glass. Loaded only by the raid, never by Battle Royale.
const WINDOW_GLB={urban:'assets/models/windows/window_urban.glb'};
const TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
// phones: halve the gun textures (1024 -> 512) to save ~140 MB of GPU memory
function shrinkTex(t,max){const im=t.image;if(!im||!im.width||im.width<=max)return;try{const c=document.createElement('canvas');c.width=c.height=max;c.getContext('2d').drawImage(im,0,0,max,max);if(im.close)im.close();t.image=c;t.needsUpdate=true}catch(e){}}
const GUNS=['pistol_hi','pistol_lo','rifle_hi','rifle_lo','m4a1_hi','m4a1_lo','grease_hi','grease_lo','shotgun_hi','shotgun_lo','ak47_hi','ak47_lo','suomi_hi','suomi_lo','snip_hi','snip_lo','luger_hi','luger_lo','frag_hi','smokeg_hi','flashb_hi','molo_hi','katana_hi','axe_hi'];
const img=u=>new Promise((res,rej)=>{const i=new Image();i.decoding='async';i.onload=()=>res(i);i.onerror=rej;i.src=u});
export let skyTex=null;
export async function loadAssets(onProg=()=>{}){if(GQ.level==='low'){onProg(1,'skipped');return false}
 const jobs=[];let done=0;const tick=()=>onProg(++done/total);
 for(const k in TEX)jobs.push(()=>Promise.all([img(`assets/tex/${k}_d.jpg`),img(`assets/tex/${k}_n.jpg`)]).then(([d,n])=>{hqSwap(k,d,n,TEX[k])}));
 jobs.push(()=>img('assets/tex/sky.jpg').then(i=>{const t=new THREE.Texture(i);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;skyTex=t}));
 let L=null;jobs.push(async()=>{const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js')]);L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder)});
 for(const k in MODELS)jobs.push(async()=>{while(!L)await new Promise(r=>setTimeout(r,30));const g=await L.loadAsync(MODELS[k]);let mesh=null;g.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o});if(!mesh)return;
  mesh.updateWorldMatrix(true,false);const geo=mesh.geometry.clone();geo.applyMatrix4(mesh.matrixWorld);geo.computeBoundingBox();const bb=geo.boundingBox,sz=bb.getSize(new THREE.Vector3());
  geo.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);const m=mesh.material;m.envMapIntensity=.8;HQP.models[k]={geo,mat:m,size:sz}});
 for(const k of GUNS)jobs.push(async()=>{while(!L)await new Promise(r=>setTimeout(r,30));const g=await L.loadAsync(`assets/models/guns/${k}.glb`);const seen=new Set();g.scene.traverse(o=>{if(o.isMesh&&o.material){const m=o.material;m.envMapIntensity=1.1;if(m.map)m.map.anisotropy=4;if(TOUCH)for(const t of[m.map,m.normalMap,m.metalnessMap,m.roughnessMap,m.aoMap])if(t&&!seen.has(t)){seen.add(t);shrinkTex(t,512)}}});HQP.guns[k]=g.scene});
 const total=jobs.length;let ok=true;for(const j of jobs){try{await j()}catch(e){ok=false;console.warn('asset',e&&e.message)}tick()}
 HQP.ready=Object.keys(HQP.models).length>0;return ok}
// Scanned, rigged raid machines. Loaded after the lobby props so the raid can
// swap its procedural scout for the real animated GLB as soon as the browser
// has it. Normalised to the authoritative machine height and centred on the
// server footprint so hit flash, core and tracer origins stay aligned.
export async function loadMachines(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(MACHINE_GLB);if(!keys.length)return true;
 const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js')]);
 const L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder);
 let ok=true,done=0;
 for(const k of keys){
  try{
   const g=await L.loadAsync(MACHINE_GLB[k].url);
   const lights=[];g.scene.traverse(o=>{if(o.isLight)lights.push(o)});for(const l of lights)l.parent?.remove(l);
   g.scene.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(g.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
   const scale=MACHINE_GLB[k].height/Math.max(.001,size.y);
   g.scene.scale.setScalar(scale);
   g.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
   g.scene.updateMatrixWorld(true);
   HQP.machines[k]={scene:g.scene,animations:g.animations||[],height:MACHINE_GLB[k].height,source:MACHINE_GLB[k].url};
  }catch(e){ok=false;console.warn('machine asset',e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
// Scanned façade windows for raids. The GLB is a single object with two
// primitives (timber frame and recessed glass); we normalise the combined
// bounds so the raid builder can seat it in any existing window opening.
export async function loadWindows(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(WINDOW_GLB);if(!keys.length)return true;
 const [{GLTFLoader}]=await Promise.all([import('./lib/jsm/GLTFLoader.js')]);
 const L=new GLTFLoader();
 let ok=true,done=0;
 for(const k of keys){
  try{
   const g=await L.loadAsync(WINDOW_GLB[k]);
   g.scene.updateMatrixWorld(true);
   const parts=[];
   g.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);parts.push({geo,mat:o.material})});
   if(!parts.length)throw new Error('no window meshes');
   const box=new THREE.Box3();
   for(const p of parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}
   if(box.isEmpty())throw new Error('empty window bounds');
   const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),minY=box.min.y;
   for(const p of parts){
    p.geo.translate(-center.x,-minY,-center.z);p.geo.computeBoundingBox();p.geo.computeBoundingSphere();
    const mat=p.mat;mat.envMapIntensity=1.15;
    if(mat.map){mat.map.colorSpace=THREE.SRGBColorSpace;mat.map.anisotropy=4}
    // Glass is authored BLEND and recessed behind the timber frame. Keep it
    // depth-write-free so the dark pane behind reads through it as an interior.
    if(mat.transparent)mat.depthWrite=false;
   }
   HQP.windows[k]={parts,width:size.x,height:size.y,depth:size.z,source:WINDOW_GLB[k]};
  }catch(e){ok=false;console.warn('window asset',e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
