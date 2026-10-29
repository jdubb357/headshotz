// HeadShotz external assets (all CC0 from Poly Haven — see ASSETS.md). Loaded lazily after the menu appears; Low quality skips them and keeps the built-in procedural look.
import {THREE,GQ,hqSwap} from './gfx.js';
export const HQP={ready:false,models:{}};
const TEX={concrete:2,brick:3,planks:2,asphalt:2,rock:2,tiles:3,metal:2,grass:3,sand:2,forest:3,dirt:3,gravel:4,cobble:3,plaster:2,crate:1.5};
const MODELS={crate:'assets/models/wooden_crate_02.glb',barrel:'assets/models/barrel_03.glb',chest:'assets/models/treasure_chest.glb'};
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
 const total=jobs.length;let ok=true;for(const j of jobs){try{await j()}catch(e){ok=false;console.warn('asset',e&&e.message)}tick()}
 HQP.ready=Object.keys(HQP.models).length>0;return ok}
