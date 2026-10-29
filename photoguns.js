// v60: photoscanned weapons (CC0, Poly Haven) fitted onto the existing weapon rigs.
// The procedural gun still defines hands, grip, muzzle, sight and animation groups; the scan replaces the visible body.
import {THREE} from './gfx.js';
// rot = Euler rotation applied to the scan, s = uniform scale, off = offset (m) in gun space (-z = forward).
// parts: nodes (suffix match) merged per material; grp = animation group (pivot comes from info.piv), loose = ignore the node's display translation.
export const PHOTO={
 handgun:{hi:'pistol_hi',lo:'pistol_lo',rot:[0,Math.PI/2,0],s:1,off:[0,-.02,0],parts:[
  {nodes:['pistol_a','hammer_a','trigger_a']},{nodes:['slide_a'],grp:'slide'},{nodes:['magazine_loaded'],grp:'mag',loose:1}]},
 sniper:{hi:'rifle_hi',lo:'rifle_lo',rot:[0,Math.PI/2,0],s:.9,off:[0,.004,-.19],parts:[
  {nodes:['rifle_7_62','trigger','wrap','scope']},{nodes:['bolt_a','bolt_b'],grp:'bolt'}]},
 ar:{hi:'m4a1_hi',lo:'m4a1_lo',rot:[0,0,0],s:.94,off:[0,0,-.028],info:{sight:[0,.072,.02]},parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Charging_Handle'],grp:'bolt'},{nodes:['*']}]},
 smg:{hi:'grease_hi',lo:'grease_lo',rot:[0,0,0],s:.85,off:[0,0,-.118],info:{muzzle:[0,.027,-.41],grip:{c:[0,-.088,.05],a:.12,w:.032},lh:[0,-.05,-.2],sight:[0,.135,.3]},parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 shotgun:{hi:'shotgun_hi',lo:'shotgun_lo',rot:[0,0,0],s:.85,off:[0,.025,-.327],info:{muzzle:[0,.05,-.67],lh:[0,0,-.38],sight:[0,.08,.1]},parts:[
  {nodes:['Fore_Stock'],grp:'pump'},{nodes:['*']}]},
 ak47:{hi:'ak47_hi',lo:'ak47_lo',rot:[0,0,0],s:1.08,off:[0,.046,-.258],parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['*']}]},
 m4:{hi:'m4a1_hi',lo:'m4a1_lo',rot:[0,0,0],s:.909,off:[0,.021,-.028],parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Charging_Handle'],grp:'bolt'},{nodes:['*']}]},
 m16:{hi:'m4a1_hi',lo:'m4a1_lo',rot:[0,0,0],s:1.05,off:[0,.018,-.031],info:{muzzle:[0,.04,-.594],lh:[0,.04,-.24]},parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Charging_Handle'],grp:'bolt'},{nodes:['*']}]},
 mk18:{hi:'m4a1_hi',lo:'m4a1_lo',rot:[0,0,0],s:.85,off:[0,.022,-.026],info:{muzzle:[0,.04,-.482],lh:[0,.04,-.19]},parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Charging_Handle'],grp:'bolt'},{nodes:['*']}]},
 tommy:{hi:'suomi_hi',lo:'suomi_lo',rot:[0,0,0],s:.805,off:[0,.016,-.058],info:{sight:[0,.13,.22]},parts:[
  {nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 light:{hi:'snip_hi',lo:'snip_lo',rot:[0,0,0],s:0.758,off:[0,-.039,-.174],parts:[{nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 awp:{hi:'snip_hi',lo:'snip_lo',rot:[0,0,0],s:1.054,off:[0,-.076,-.243],parts:[{nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 heavy:{hi:'snip_hi',lo:'snip_lo',rot:[0,0,0],s:0.973,off:[0,-.066,-.224],parts:[{nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 barrett:{hi:'snip_hi',lo:'snip_lo',rot:[0,0,0],s:1.235,off:[0,-.095,-.29],parts:[{nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 dmr:{hi:'snip_hi',lo:'snip_lo',rot:[0,0,0],s:0.894,off:[0,-.072,-.211],parts:[{nodes:['Magazine'],grp:'mag'},{nodes:['Bolt'],grp:'bolt'},{nodes:['*']}]},
 burst:{hi:'luger_hi',lo:'luger_lo',rot:[0,Math.PI,0],s:1,off:[0,-.005,-.012],info:{muzzle:[0,.04,-.186]},parts:[{nodes:['Slide'],grp:'slide'},{nodes:['Clip'],grp:'mag',loose:1},{nodes:['*']}]},
 katana:{hi:'katana_hi',lo:'katana_hi',rot:[-Math.PI/2,Math.PI/2,0],s:1,off:[0,0,-.04],parts:[{nodes:['antique_katana_01']}]},
 axe:{hi:'axe_hi',lo:'axe_hi',rot:[-Math.PI/2,0,0],s:1,off:[0,0,0],parts:[{nodes:['wooden_axe']}]},
};
const _m=new THREE.Matrix4(),_f=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler();
function flo(a){if(a.array instanceof Float32Array&&!a.isInterleavedBufferAttribute)return a.array;const o=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)o[i*a.itemSize+k]=[a.getX,a.getY,a.getZ,a.getW][k].call(a,i);return o}
function bakeGeo(g,m){const r=new THREE.BufferGeometry();const p=new THREE.Float32BufferAttribute(flo(g.attributes.position),3);r.setAttribute('position',p);
 if(g.attributes.normal)r.setAttribute('normal',new THREE.Float32BufferAttribute(flo(g.attributes.normal),3));if(g.attributes.uv)r.setAttribute('uv',new THREE.Float32BufferAttribute(flo(g.attributes.uv),2));
 if(g.index)r.setIndex(new THREE.BufferAttribute(g.index.array.slice(),1));r.applyMatrix4(m);return r}
function merge(gs){let n=0,ni=0;for(const g of gs){n+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count}
 const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2),I=new Uint32Array(ni);let o=0,oi=0;
 for(const g of gs){const c=g.attributes.position.count;P.set(g.attributes.position.array,o*3);if(g.attributes.normal)N.set(g.attributes.normal.array,o*3);if(g.attributes.uv)U.set(g.attributes.uv.array,o*2);
  if(g.index){for(let i=0;i<g.index.count;i++)I[oi+i]=g.index.array[i]+o;oi+=g.index.count}else{for(let i=0;i<c;i++)I[oi+i]=o+i;oi+=c}o+=c}
 const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.BufferAttribute(P,3));r.setAttribute('normal',new THREE.BufferAttribute(N,3));r.setAttribute('uv',new THREE.BufferAttribute(U,2));r.setIndex(new THREE.BufferAttribute(ni>65000?I:new Uint16Array(I),1));return r}
function claimed(sp,o,root){for(const pt of sp.parts){if(pt.nodes[0]==='*')continue;let nd=o;while(nd&&nd!==root.parent){if(pt.nodes.some(s=>nd.name&&nd.name.endsWith(s)))return true;nd=nd.parent}}return false}
const CACHE={};
// -> [{grp,geo,mat}] in gun space (pivot subtraction is done by the caller), or null when the scan is not loaded
export function photoItems(id,lod,HQP){const sp=PHOTO[id];if(!sp||!HQP||!HQP.guns)return null;const key=lod?sp.lo:sp.hi;const root=HQP.guns[key];if(!root)return null;const ck=id+'|'+(lod?1:0);if(CACHE[ck])return CACHE[ck];
 _e.set(...sp.rot);_q.setFromEuler(_e);_f.compose(new THREE.Vector3(...sp.off),_q,new THREE.Vector3(sp.s,sp.s,sp.s));
 root.updateMatrixWorld(true);const out=[];
 for(const part of sp.parts){const by=new Map();
  root.traverse(o=>{if(!o.isMesh)return;let nd=o;let hit=false;while(nd&&nd!==root.parent){if(part.nodes.some(s=>nd.name&&nd.name.endsWith(s))){hit=true;break}nd=nd.parent}if(part.nodes[0]==='*'){hit=!claimed(sp,o,root);nd=o}if(!hit)return;
   _m.copy(o.matrixWorld);if(part.loose){const e=_m.elements;const nw=nd.matrixWorld.elements;e[12]-=nw[12];e[13]-=nw[13];e[14]-=nw[14]}
   _m.premultiply(_f);const g=bakeGeo(o.geometry,_m);const mat=o.material;if(!by.has(mat))by.set(mat,[]);by.get(mat).push(g)});
  for(const[mat,gs]of by)out.push({grp:part.grp||null,geo:merge(gs),mat})}
 return CACHE[ck]=out}
export function clearPhotoCache(){for(const k in CACHE)delete CACHE[k]}
