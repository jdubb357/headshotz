// HeadShotz external assets (all CC0 from Poly Haven — see ASSETS.md). Loaded lazily after the menu appears; Low quality skips them and keeps the built-in procedural look.
import {THREE,GQ,hqSwap} from './gfx.js';
export const HQP={ready:false,models:{},loot:{},guns:{},machines:{},windows:{},buildings:{},nature:{},ground:{},cover:{},sky:null};
const TEX={gunWood:1,concrete:2,brick:3,planks:2,asphalt:2,rock:2,tiles:3,metal:2,grass:3,sand:2,forest:3,dirt:3,gravel:4,cobble:3,plaster:2,crate:1.5};
const MODELS={crate:'assets/models/wooden_military_crate.glb',barrel:'assets/models/barrel_stove.glb',chest:'assets/models/treasure_chest.glb'};
// Real CC0 loot props, loaded separately so the raid only pays for the small
// pickups and Battle Royale never downloads them. Each model is kept in its
// authored metre scale and merged per material by loadGLBParts.
const LOOT_GLB={
 ammo:'assets/models/loot/ammo_box.glb',
 med:'assets/models/loot/medical_box.glb',
 material:'assets/models/loot/metal_jerrycan_green.glb'
};
// Raid machine bodies are scanned/rigged GLBs, not box geometry. They are loaded
// separately from the lobby props so the raid (the only mode that spawns these
// actors) never pays for them in Battle Royale.
const MACHINE_GLB={scout:{url:'assets/models/machines/scout.glb',height:1.45}};
// Real scanned façade windows for raid facades. Extracted from Poly Haven's CC0
// "Modular Urban Apartments Facade" module, optimised to 186 KB, one timber frame
// plus recessed glass. Loaded only by the raid, never by Battle Royale.
const WINDOW_GLB={urban:'assets/models/windows/window_urban.glb'};
// Real modular architecture kit for raid street buildings: a dressed plaster
// wall panel, a timber door with recessed glass, a projecting base plinth, a
// roofline cornice, a wall pier and window/door dressing trim, all extracted
// from Poly Haven's CC0 "Modular Urban Apartments Facade" and simplified with
// meshopt. Seven modules at 512 px maps keep the whole kit under 1 MB.
const BUILDING_GLB={facade:{url:'assets/models/buildings/facade_kit.glb',
 modules:['wall_standard_standard_01','door_centered_large_01','cornice_standard_standard_01','base_standard_01','wall_pier_standard_01','dado_standard_standard_01','crown_standard_standard_01']}};
// Scanned street-cover props for the raid courtyards (Poly Haven CC0): a
// concrete jersey barrier, wooden crate, metal dumpster, covered car wreck,
// dead-tree log, tyre and trash bag. Kept out of the lobby/BR path and loaded
// only by the raid, with meshopt to stay under 1.6 MB total.
const COVER_GLB={
 barrier:'assets/models/cover/barrier.glb',
 crate:'assets/models/cover/crate.glb',
 bin:'assets/models/cover/bin.glb',
 wreck:'assets/models/cover/wreck.glb',
 log:'assets/models/cover/log.glb',
 tyre:'assets/models/cover/tyre.glb',
 bag:'assets/models/cover/bag.glb'
};
// Real scanned vegetation from Poly Haven's CC0 nature kit. Every asset is
// baked to a metre-scale height and centred on x/z with its base at y=0 so the
// raid can instance it directly on terrain height. Presentation only: their
// placement is recorded by buildEnvironment and no collision is derived.
const NATURE_GLB={
 tree:{url:'assets/models/nature/tree_small_02.glb',height:5.2,tri:1681},
 shrub:{url:'assets/models/nature/shrub_02.glb',height:1.15,tri:1059},
 fern:{url:'assets/models/nature/fern_02.glb',height:.72,tri:2768},
 grass:{url:'assets/models/nature/grass_medium_02.glb',height:.55,tri:119},
 stump:{url:'assets/models/nature/tree_stump_01.glb',height:.85,tri:1327},
 rock:{url:'assets/models/nature/rock_07.glb',height:.9,tri:652}
};
// Photographed PBR pairs for the surfaces the player actually stands on. The
// accepted 512 px maps are real scans (albedo, tangent-space normal, packed
// AO/roughness/metalness), not a canvas wash; the rough map lets sunlit gravel
// keep its grain instead of flattening to a pale slab.
const GROUND_PBR={asphalt:'assets/tex/ground/asphalt',concrete:'assets/tex/ground/concrete',gravel:'assets/tex/ground/gravel',dirt:'assets/tex/ground/dirt',gravelFloor:'assets/tex/ground/gravelfloor'};
const TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
// phones: halve the gun textures (1024 -> 512) to save ~140 MB of GPU memory
function shrinkTex(t,max){const im=t.image;if(!im||!im.width||im.width<=max)return;try{const c=document.createElement('canvas');c.width=c.height=max;c.getContext('2d').drawImage(im,0,0,max,max);if(im.close)im.close();t.image=c;t.needsUpdate=true}catch(e){}}
const GUNS=['pistol_hi','pistol_lo','rifle_hi','rifle_lo','m4a1_hi','m4a1_lo','grease_hi','grease_lo','shotgun_hi','shotgun_lo','ak47_hi','ak47_lo','suomi_hi','suomi_lo','snip_hi','snip_lo','luger_hi','luger_lo','frag_hi','smokeg_hi','flashb_hi','molo_hi','katana_hi','axe_hi'];
const img=u=>new Promise((res,rej)=>{const i=new Image();i.decoding='async';i.onload=()=>res(i);i.onerror=rej;i.src=u});
export let skyTex=null;
// Poly Haven exports mix interleaved and plain vertex buffers. BufferGeometryUtils
// cannot merge an interleaved attribute, so models are copied through a
// plain-stride clone first; node transforms are baked into the geometry.
function plainGeometry(source){
 const geo=new THREE.BufferGeometry();
 // KHR_mesh_quantization stores positions/normals/UVs as normalized integers.
 // Bake them to float before any CPU transform: BufferGeometry.applyMatrix4
 // does not round-trip the normalize flag, so a baked quantized attribute would
 // explode to its raw ±32767 range (seen as a wall-sized barrier at spawn).
 const denorm=array=>array instanceof Float32Array?1:
  array instanceof Int8Array?127:array instanceof Uint8Array?255:
  array instanceof Int16Array?32767:array instanceof Uint16Array?65535:
  array instanceof Int32Array?2147483647:array instanceof Uint32Array?4294967295:1;
 for(const name in source.attributes){
  const a=source.attributes[name];if(!a)continue;
  const normalized=!!a.normalized&&!(a.array instanceof Float32Array);
  if(a.isInterleavedBufferAttribute){
   const count=a.count,itemSize=a.itemSize,out=new Float32Array(count*itemSize);
   for(let i=0;i<count;i++)for(let j=0;j<itemSize;j++)out[i*itemSize+j]=a.data.array[i*a.data.stride+a.offset+j];
   if(normalized){const max=denorm(a.data.array);for(let i=0;i<out.length;i++)out[i]=out[i]/max}
   geo.setAttribute(name,new THREE.BufferAttribute(out,itemSize,false));
  }else if(normalized){
   const out=new Float32Array(a.count*a.itemSize),max=denorm(a.array);
   for(let i=0;i<out.length;i++)out[i]=a.array[i]/max;
   geo.setAttribute(name,new THREE.BufferAttribute(out,a.itemSize,false));
  }else geo.setAttribute(name,new THREE.BufferAttribute(a.array.slice(),a.itemSize,a.normalized));
 }
 if(source.index)geo.setIndex(source.index.clone());
 return geo;
}
// Collapse every mesh in a scene into material-grouped, world-baked parts. Each
// part issues one instanced draw, and the combined bounds stay in the scan's
// authored metre scale so the existing height-normalisation in the raid props
// keeps working unchanged.
async function loadGLBParts(L,url,mergeGeometries){
 const g=await L.loadAsync(url);
 g.scene.updateMatrixWorld(true);
 const groups=new Map();
 g.scene.traverse(o=>{
  if(!o.isMesh||!o.geometry)return;
  const mat=o.material||new THREE.MeshStandardMaterial();
  let geos=groups.get(mat);if(!geos){geos=[];groups.set(mat,geos)}
  const geo=plainGeometry(o.geometry);geo.applyMatrix4(o.matrixWorld);geos.push(geo);
 });
 const parts=[];
 for(const [mat,geos] of groups){
  if(geos.length===1){parts.push({geo:geos[0],mat});continue}
  const merged=mergeGeometries(geos,false);
  if(merged)parts.push({geo:merged,mat});
  else for(const geo of geos)parts.push({geo,mat});
 }
 if(!parts.length)throw new Error('no meshes');
 const box=new THREE.Box3();
 for(const p of parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}
 if(box.isEmpty())throw new Error('empty bounds');
 const size=box.getSize(new THREE.Vector3());
 return {parts,size,box,center:box.getCenter(new THREE.Vector3()),minY:box.min.y};
}
function photoModelMaterial(mat){
 if(!mat)return;
 mat.envMapIntensity=mat.envMapIntensity||.95;
 if(mat.map){mat.map.colorSpace=THREE.SRGBColorSpace;mat.map.anisotropy=4}
 if(mat.normalMap)mat.normalMap.anisotropy=4;
 if(mat.roughnessMap)mat.roughnessMap.anisotropy=4;
 if(mat.metalnessMap)mat.metalnessMap.anisotropy=4;
 if(mat.aoMap)mat.aoMap.anisotropy=4;
}
export async function loadAssets(onProg=()=>{}){if(GQ.level==='low'){onProg(1,'skipped');return false}
 const jobs=[];let done=0;const tick=()=>onProg(++done/total);
 for(const k in TEX)jobs.push(()=>Promise.all([img(`assets/tex/${k}_d.jpg`),img(`assets/tex/${k}_n.jpg`)]).then(([d,n])=>{hqSwap(k,d,n,TEX[k])}));
 jobs.push(()=>img('assets/tex/sky.jpg').then(i=>{const t=new THREE.Texture(i);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;skyTex=t}));
 let L=null,mergeFN=null;jobs.push(async()=>{const [{GLTFLoader},{MeshoptDecoder},{mergeGeometries}]=await Promise.all([import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js'),import('./lib/jsm/BufferGeometryUtils.js')]);L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder);mergeFN=mergeGeometries});
 for(const k in MODELS)jobs.push(async()=>{while(!L||!mergeFN)await new Promise(r=>setTimeout(r,30));const {parts,size,center,minY}=await loadGLBParts(L,MODELS[k],mergeFN);
  for(const p of parts){p.geo.translate(-center.x,-minY,-center.z);p.geo.computeBoundingBox();p.geo.computeBoundingSphere();photoModelMaterial(p.mat)}
  HQP.models[k]={geo:parts[0].geo,mat:parts[0].mat,size,parts,source:MODELS[k]}});
 for(const k of GUNS)jobs.push(async()=>{while(!L)await new Promise(r=>setTimeout(r,30));const g=await L.loadAsync(`assets/models/guns/${k}.glb`);const seen=new Set();g.scene.traverse(o=>{if(o.isMesh&&o.material){const m=o.material;m.envMapIntensity=1.1;if(m.map)m.map.anisotropy=4;if(TOUCH)for(const t of[m.map,m.normalMap,m.metalnessMap,m.roughnessMap,m.aoMap])if(t&&!seen.has(t)){seen.add(t);shrinkTex(t,512)}}});HQP.guns[k]=g.scene});
 const total=jobs.length;let ok=true;for(const j of jobs){try{await j()}catch(e){ok=false;console.warn('asset',e&&e.message)}tick()}
 HQP.ready=Object.keys(HQP.models).length>0;return ok}
// Real CC0 ground-loot models (ammo box, medical box, fuel canister). They are
// kept separate from the lobby props so the raid can dress each pile with the
// item a player will actually pick up, and the menu/BR never downloads them.
export async function loadLoot(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(LOOT_GLB);if(!keys.length)return true;
 const [{GLTFLoader},{mergeGeometries}]=await Promise.all([import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/BufferGeometryUtils.js')]);
 const L=new GLTFLoader();
 let ok=true,done=0;
 for(const k of keys){
  try{
   const {parts,size}=await loadGLBParts(L,LOOT_GLB[k],mergeGeometries);
   for(const p of parts){photoModelMaterial(p.mat);if(p.mat)p.mat.envMapIntensity=1.15}
   HQP.loot[k]={parts,size,source:LOOT_GLB[k]};
  }catch(e){ok=false;console.warn('loot asset',k,e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
// Scanned courtyard cover. Each GLB is centre-x/z and base-y baked to zero so
// the deterministic dressing list can seat it on sampled terrain; tyres are
// pre-rotated flat in the asset, keeping the instance transform to yaw only.
export async function loadCover(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(COVER_GLB);if(!keys.length)return true;
 const [{GLTFLoader},{MeshoptDecoder},{mergeGeometries}]=await Promise.all([
  import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js'),
  import('./lib/jsm/BufferGeometryUtils.js')]);
 const L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder);
 let ok=true,done=0;
 for(const k of keys){
  try{
   const {parts,size,center,minY}=await loadGLBParts(L,COVER_GLB[k],mergeGeometries);
   for(const p of parts){p.geo.translate(-center.x,-minY,-center.z);}
   let width=size.x,height=size.y,depth=size.z;
   if(k==='tyre'){
    for(const p of parts)p.geo.rotateX(Math.PI/2);
    const box=new THREE.Box3();
    for(const p of parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}
    const c=box.getCenter(new THREE.Vector3());
    for(const p of parts)p.geo.translate(-c.x,-box.min.y,-c.z);
    width=box.max.x-box.min.x;height=box.max.y-box.min.y;depth=box.max.z-box.min.z;
   }
   for(const p of parts){
    p.geo.computeBoundingBox();p.geo.computeBoundingSphere();photoModelMaterial(p.mat);
    if(p.mat){
     p.mat.envMapIntensity=.9;
     // Sun-bleached concrete scans blow to pure white against the pale apron;
     // a gentle neutral tint keeps the jersey profile readable as cover.
     if(k==='barrier')p.mat.color.multiplyScalar(.84);
    }
   }
   HQP.cover[k]={parts,size:{x:width,y:height,z:depth},source:COVER_GLB[k]};
  }catch(e){ok=false;console.warn('cover asset',k,e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
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
// Real modular façade kit. Every module is baked into a self-contained geometry
// anchored at x=0, bottom=0 with its front face looking +z, so the raid can
// instance it on any façade normal. The plaster material has photographed
// albedo, normal and roughness maps (CC0 Poly Haven), not a 128 px generated map.
// Real scanned foliage. Each GLB is flattened into one or more material-baked
// geometries (node transforms included) and normalised to a known height so an
// InstancedMesh can sit it exactly on sampled terrain. Leaves are authored as
// BLEND with a black atlas background; switching them to alpha-tested cutout
// keeps them opaque to the depth buffer instead of letting the black card
// behind the canopy sort over the street.
export async function loadNature(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(NATURE_GLB);if(!keys.length)return true;
 const [{GLTFLoader},{MeshoptDecoder},{mergeGeometries}]=await Promise.all([
  import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js'),
  import('./lib/jsm/BufferGeometryUtils.js')]);
 const L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder);
 let ok=true,done=0;
 for(const k of keys){
  const cfg=NATURE_GLB[k];
  try{
   const g=await L.loadAsync(cfg.url);
   g.scene.updateMatrixWorld(true);
   // Poly Haven exports some plants with interleaved vertex buffers, which
   // BufferGeometryUtils cannot merge. Copyp through a plain-stride clone so
   // each material's primitives collapse into one instanced draw.
   const plain=source=>{
    const geo=new THREE.BufferGeometry();
    for(const name in source.attributes){
     const a=source.attributes[name];if(!a)continue;
     if(a.isInterleavedBufferAttribute){
      const count=a.count,item=a.itemSize,out=new Float32Array(count*item);
      for(let i=0;i<count;i++)for(let j=0;j<item;j++)out[i*item+j]=a.data.array[i*a.data.stride+a.offset+j];
      geo.setAttribute(name,new THREE.BufferAttribute(out,item,a.normalized));
     }else geo.setAttribute(name,new THREE.BufferAttribute(a.array.slice(),a.itemSize,a.normalized));
    }
    if(source.index)geo.setIndex(source.index.clone());
    return geo;
   };
   const byMaterial=new Map();
   g.scene.traverse(o=>{
    if(!o.isMesh||!o.geometry)return;
    const key=o.material?.uuid||'none';
    let list=byMaterial.get(key);
    if(!list){list={mat:o.material||new THREE.MeshStandardMaterial(),geos:[]};byMaterial.set(key,list)}
    const geo=plain(o.geometry);geo.applyMatrix4(o.matrixWorld);list.geos.push(geo);
   });
   const parts=[...byMaterial.values()];if(!parts.length)throw new Error('no nature meshes');
   const box=new THREE.Box3();
   for(const p of parts)for(const geo of p.geos){geo.computeBoundingBox();box.union(geo.boundingBox)}
   if(box.isEmpty())throw new Error('empty nature bounds');
   const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),minY=box.min.y;
   const scale=cfg.height/Math.max(.001,size.y);
   for(const p of parts){
    for(const geo of p.geos){
     geo.translate(-center.x,-minY,-center.z);
     geo.scale(scale,scale,scale);
     geo.computeBoundingBox();geo.computeBoundingSphere();
    }
    const mat=p.mat;if(!mat)continue;
    mat.envMapIntensity=.7;
    const textures=[mat.map,mat.normalMap,mat.roughnessMap,mat.metalnessMap,mat.aoMap,mat.alphaMap];
    for(const t of textures)if(t){if(t===mat.map)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4}
    if(mat.map)mat.map.colorSpace=THREE.SRGBColorSpace;
    // The plant GLBs carry photographed diffuse colour composed with Poly Haven's
    // authored alpha cutout into a single RGBA texture. Alpha-testing (MASK) keeps
    // the silhouettes opaque to the depth buffer, so dense instancing never sorts
    // the transparent queue over nearby facades and no black atlas card remains.
    if(mat.map&&mat.map.image){
     mat.transparent=false;mat.depthWrite=true;mat.depthTest=true;
     if(!mat.alphaTest)mat.alphaTest=.42;
     mat.alphaMap=null;mat.needsUpdate=true;
    }
    mat.side=THREE.DoubleSide;
   }
   const merged=[];
   for(const p of parts){
    let geo=p.geos.length===1?p.geos[0]:mergeGeometries(p.geos,false);
    if(!geo||geo.getAttribute('position')==null)continue;
    geo.userData.raidNature=true;
    merged.push({geo,mat:p.mat});
   }
   if(!merged.length)throw new Error('no merged nature parts');
   HQP.nature[k]={parts:merged,height:cfg.height,tri:cfg.tri,source:cfg.url,size:{x:size.x*scale,y:cfg.height,z:size.z*scale}};
  }catch(e){ok=false;console.warn('nature asset',k,e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
// Photographed ground PBR maps shared by the raid terrain and its street slabs.
// They are plain <img> loads (not GLBs) and stay out of the texture atlas swap
// in gfx.js so their real normal/roughness channels reach the shaders intact.
export async function loadGround(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const keys=Object.keys(GROUND_PBR);if(!keys.length)return true;
 const make=(image,srgb)=>{const t=new THREE.Texture(image);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.generateMipmaps=true;t.needsUpdate=true;return t};
 let ok=true,done=0;
 for(const k of keys){
  try{
   const base=GROUND_PBR[k];
   const [d,n,r]=await Promise.all([img(base+'_d.jpg'),img(base+'_n.jpg'),img(base+'_r.jpg')]);
   HQP.ground[k]={map:make(d,true),normalMap:make(n,false),roughnessMap:make(r,false),source:base};
  }catch(e){ok=false;console.warn('ground asset',k,e&&e.message)}
  onProg(++done/keys.length);
 }
 return ok
}
// Photographed CC0 sky can't be a bare .hdr on a static page without shipping
// an extra HDR decoder, so the Poly Haven Kloofendal 48d Pure Sky source is
// tone-mapped to a 2048 x 1024 sRGB equirect once, offline, and served here.
// It backs the raid's daylight dome and a real-photo PMREM environment, which
// keeps metal barrels and window glass reflecting a photographed horizon.
export async function loadSkyPhoto(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 try{
  const image=await img('assets/tex/kloofendal_sky.jpg');
  const texture=new THREE.Texture(image);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  HQP.sky=texture;
  onProg(1);return true;
 }catch(e){console.warn('sky photo',e&&e.message);onProg(1);return false}
}
export async function loadBuildings(onProg=()=>{}){
 if(GQ.level==='low'){onProg(1,'skipped');return false}
 const [{GLTFLoader}]=await Promise.all([import('./lib/jsm/GLTFLoader.js')]);
 const L=new GLTFLoader();let ok=true,done=0;
 for(const k in BUILDING_GLB){
  try{
   const g=await L.loadAsync(BUILDING_GLB[k].url);
   g.scene.updateMatrixWorld(true);
   const mods={};
   for(const name of BUILDING_GLB[k].modules){
    const node=g.scene.getObjectByName(name);
    if(!node)throw new Error('missing module '+name);
    const parts=[];
    node.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);parts.push({geo,mat:o.material})});
    if(!parts.length)throw new Error('no meshes in '+name);
    const box=new THREE.Box3();
    for(const p of parts){p.geo.computeBoundingBox();box.union(p.geo.boundingBox)}
    if(box.isEmpty())throw new Error('empty bounds '+name);
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),minY=box.min.y;
    const seen=new Set();
    for(const p of parts){
     p.geo.translate(-center.x,-minY,-center.z);p.geo.computeBoundingBox();p.geo.computeBoundingSphere();
     const mat=p.mat;if(!seen.has(mat)){
      seen.add(mat);mat.envMapIntensity=1.0;
      for(const t of [mat.map,mat.normalMap,mat.roughnessMap,mat.metalnessMap,mat.aoMap])if(t){t.colorSpace=t===mat.map?THREE.SRGBColorSpace:t.colorSpace;t.anisotropy=4}
      if(mat.transparent)mat.depthWrite=false;
     }
    }
    mods[name]={parts,width:size.x,height:size.y,depth:size.z,source:'Poly Haven modular_urban_apartments_facade/'+name};
   }
   HQP.buildings[k]={modules:mods,url:BUILDING_GLB[k].url};
  }catch(e){ok=false;console.warn('building asset',e&&e.message)}
  onProg(++done/Object.keys(BUILDING_GLB).length);
 }
 return ok
}
