// HeadShotz v39 realistic characters: MakeHuman (CC0) skinned humans with the MakeHuman "game_engine" skeleton (see ASSETS.md).
// 3 mesh tiers (hi/md/lo, meshopt-compressed, textures shipped separately as WebP), shared across all players via SkeletonUtils.clone.
// Clothes are recoloured in-shader (team shirt, class trousers + camo) keeping the photographed folds; class gear (helmets, plate
// carriers, packs) is attached to bones. Animation is procedural on the skeleton (same pose model as the old rig: gait, crouch, slide,
// jump, climb, downed crawl, death) with 2-bone IK putting both hands on the weapon, which is mounted on the right hand's aim frame.
// If anything fails to load, chars.js keeps building the old procedural characters.
import {THREE,GQ} from './gfx.js';import {buildGear} from './gear.js';
export const HUM={ready:false,failed:false,tpl:{},tex:{},ms:0,bytes:0};
const BASE=new URL('assets/hum/',import.meta.url).href;
const SKINC=[0,1,2,3];
let rboxF=null;export function setRbox(f){rboxF=f}
function tex(url,srgb=true){return new Promise((res,rej)=>{new THREE.TextureLoader().load(url,t=>{t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.anisotropy=4;res(t)},undefined,rej)})}
export async function loadHumans(onProg=()=>{}){const t0=performance.now();try{
 const mob=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1,low=GQ.level==='low',tiers=low?['lo']:[GQ.level==='high'&&!mob?'hi':'md','lo'],sfx=low?'_l':'';
 const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('./lib/jsm/GLTFLoader.js'),import('./lib/jsm/meshopt_decoder.module.js')]);
 const SU=await import('./lib/jsm/SkeletonUtils.js');HUM.SU=SU;HUM.BGU=await import('./lib/jsm/BufferGeometryUtils.js');const L=new GLTFLoader();L.setMeshoptDecoder(MeshoptDecoder);
 const names=['cloth','shoes','hair','eye','brow','lash',...SKINC.map(i=>'skin'+i)];const jobs=tiers.length+names.length+(low?0:1);let done=0;const tk=()=>onProg(++done/jobs);
 for(const t of tiers){const g=await L.loadAsync(BASE+`hum_${t}.glb`);prepTpl(g.scene);HUM.tpl[t]=g.scene;tk()}
 await Promise.all(names.map(n=>tex(BASE+n+sfx+'.webp').then(x=>{HUM.tex[n]=x;tk()})));
 if(!low){HUM.tex.clothn=await tex(BASE+'clothn.webp',false);tk()}
 HUM.tier=tiers[0];HUM.ready=true}catch(e){console.warn('humans',e&&e.message,e&&e.stack);HUM.failed=true}HUM.ms=Math.round(performance.now()-t0);return HUM.ready}
// tag each template mesh with its part + compute a 'pants' vertex weight on the clothes (bind pose, below the belt)
function prepTpl(sc){sc.updateMatrixWorld(true);const v=new THREE.Vector3();
 sc.traverse(o=>{if(!o.isSkinnedMesh)return;const n=(o.name+' '+(o.geometry.name||'')).toLowerCase();
  o.userData.part=n.includes('casualsuit')?'cloth':n.includes('shoes')?'shoes':n.includes('short0')||n.includes('hair')?'hair':n.includes('eyebrow')?'brow':n.includes('eyelash')?'lash':n.includes('low-poly')||n.includes('high-poly')?'eye':'skin';
  if(o.userData.part==='cloth'&&!o.geometry.attributes.pants){const p=o.geometry.attributes.position,a=new Float32Array(p.count);o.skeleton.update();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);a[i]=v.y<1.0?1:0}let sm=0;for(let i=0;i<p.count;i++)sm+=a[i];HUM.pantsFrac=sm/p.count;o.geometry.setAttribute('pants',new THREE.BufferAttribute(a,1))}
  o.frustumCulled=false})}
const NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
function clothMat(shirt,pants,camo){const m=new THREE.MeshStandardMaterial({map:HUM.tex.cloth,normalMap:HUM.tex.clothn||null,roughness:.92,metalness:0,envMapIntensity:.4});
 m.userData.u={uShirt:{value:new THREE.Color(shirt)},uPants:{value:new THREE.Color(pants)},uCamo:{value:camo}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,m.userData.u);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float pants;varying float vP;varying vec3 vOP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvP=pants;vOP=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uShirt;uniform vec3 uPants;uniform float uCamo;varying float vP;varying vec3 vOP;\n'+NOISE)
   .replace('#include <map_fragment>',`#include <map_fragment>
   {float l=dot(diffuseColor.rgb,vec3(.3,.59,.11));float d=clamp(.45+l*1.6,.35,1.35);vec3 c=mix(uShirt,uPants,step(.5,vP));
    if(uCamo>.5&&vP>.5){vec3 q=vOP*vec3(5.5,4.,5.5);float n=vn(q)+.5*vn(q*2.3);
     if(uCamo<1.5)c=n<.62?c*.6:n<.98?c:mix(c,vec3(.22,.2,.14),.5);else if(uCamo<2.5){float e=h3(floor(vOP*vec3(26.)))+.4*h3(floor(vOP*vec3(9.)));c=e<.5?c*.7:e<1.05?c:c*1.22;}
     else if(uCamo<3.5){float t=sin(vOP.y*30.+vn(q*.7)*5.);c=t>.55?c*.5:c;}else c*=(.85+.25*vn(q*3.));}
    diffuseColor.rgb=c*d;}`)};
 m.customProgramCacheKey=()=>'humcloth'+(HUM.tex.clothn?1:0);return m}
const SKM={};function partMat(part,key,tint){const k=part+key;if(SKM[k])return SKM[k];let m;
 if(part==='skin'){m=new THREE.MeshStandardMaterial({map:HUM.tex['skin'+key],roughness:.55,metalness:0,envMapIntensity:.35});
  m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*vec3(.10,.03,.02);\n#include <opaque_fragment>')};m.customProgramCacheKey=()=>'humskin'}
 else if(part==='shoes')m=new THREE.MeshStandardMaterial({map:HUM.tex.shoes,roughness:.55,metalness:0});
 else if(part==='hair')m=new THREE.MeshStandardMaterial({map:HUM.tex.hair,color:tint,alphaTest:.45,side:THREE.DoubleSide,roughness:.7});
 else if(part==='eye')m=new THREE.MeshStandardMaterial({map:HUM.tex.eye,roughness:.15});
 else m=new THREE.MeshStandardMaterial({map:HUM.tex[part],alphaTest:.4,side:THREE.DoubleSide,roughness:.8,transparent:false});
 return SKM[k]=m}
const HAIRT=[0xffffff,0x8a6a50,0x5a4636,0xd8c4a0,0x303030];
const gm=(c,r=.6,mt=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:mt});
const GMC={};const gmat=(c,r,mt)=>GMC[c+'|'+r+'|'+mt]||(GMC[c+'|'+r+'|'+mt]=gm(c,r,mt));
let GM=null;function gearMat(){if(GM)return GM;GM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:1,envMapIntensity:.8});const hi=GQ.level!=='low';
 // per-vertex roughness (color.a) + metalness/kind (gx); procedural micro-detail per kind (weave, brushed metal, cord wrap, glass, grain) as colour + bump
 GM.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 gx;varying float vRgh;varying vec2 vGx;varying vec3 vGp;').replace('#include <color_vertex>','#include <color_vertex>\nvRgh=color.a;vGx=gx;vGp=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vRgh;varying vec2 vGx;varying vec3 vGp;\n'+NOISE+`
vec3 gBump(vec3 sp,vec3 n,float h){vec3 dx=dFdx(sp),dy=dFdy(sp);float bx=dFdx(h),by=dFdy(h);vec3 r1=cross(dy,n),r2=cross(n,dx);float d=dot(dx,r1);vec3 g=sign(d)*(bx*r1+by*r2);return normalize(abs(d)*n-g);}`)
   .replace('#include <map_fragment>',`#include <map_fragment>
   float gH=0.;float gk=floor(vGx.y+.5);vec3 gp=vGp;
   ${hi?`if(gk==1.){float w=sin(gp.x*1400.+gp.y*700.)*sin(gp.y*1400.-gp.z*700.);float n=vn(gp*90.);gH=w*.25+n*.6;diffuseColor.rgb*=.86+.22*n+.05*w;}
   else if(gk==2.){float n=vn(gp*vec3(500.,25.,500.));float sc=step(.985,vn(gp*vec3(60.,700.,60.)));gH=n*.15;diffuseColor.rgb*=.9+.18*n+.5*sc;}
   else if(gk==3.){float a=fract((gp.x+gp.y+gp.z)*55.),b=fract((gp.x-gp.y+gp.z)*55.);float dm=min(min(a,1.-a),min(b,1.-b));gH=smoothstep(.0,.18,dm);diffuseColor.rgb*=.55+.6*gH;}
   else if(gk==5.){float n=vn(gp*260.)+.5*vn(gp*700.);gH=n*.4;diffuseColor.rgb*=.85+.2*n;}`:''}`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vRgh;')
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vGx.x;')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+(hi?'if(gH!=0.)normal=gBump(-vViewPosition,normal,gH*.0016);':''))
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(gk==4.)totalEmissiveRadiance+=diffuseColor.rgb*.35;')};
 GM.customProgramCacheKey=()=>'humgear2'+(hi?1:0);return GM}
function box(w,h,d){return rboxF?rboxF(w,h,d):new THREE.BoxGeometry(w,h,d)}
// gear, built in rig space (character faces -Z, feet at y=0) and re-parented onto bones keeping its transform
function gear(L,teamCol,cls,add){buildGear(L,teamCol,cls,add,rboxF)}
const _v=new THREE.Vector3(),_w=new THREE.Vector3(),_x=new THREE.Vector3(),_y=new THREE.Vector3(),_q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_m=new THREE.Matrix4();
function hashS(s){let h=7;for(const c of String(s))h=h*31+c.charCodeAt(0)|0;return Math.abs(h)}
export function makeHuman(teamCol,name,id,tagCol,outfit,cls,LOOKS){const h=hashS(id);const L=LOOKS[cls]||LOOKS.soldier;
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);const T=HUM.tier;
 const body=HUM.SU.clone(HUM.tpl[T]);body.rotation.y=Math.PI;const bw=L.bulk?1.1:L.slim?.96:1;body.scale.set(bw,1,bw);rig.add(body);
 const bones={};body.traverse(o=>{if(o.isBone)bones[o.name]=o});
 const skinK=String(SKINC[(h>>2)%SKINC.length]),shirt=outfit?outfit[0]:(L.shirt??new THREE.Color(teamCol).lerp(new THREE.Color(0x3a3d36),.3).getHex()),pants=outfit?outfit[1]:L.pants,cm=clothMat(shirt,pants,outfit?0:L.camo);
 const hairT=HAIRT[(h>>5)%HAIRT.length];
 const setMats=o=>{if(!o.isSkinnedMesh)return;const p=o.userData.part;o.material=p==='cloth'?cm:partMat(p,p==='skin'?skinK:p==='hair'?String(hairT):'',hairT);o.castShadow=true;if(p==='hair'&&L.head&&L.head!=='cap')o.visible=false};
 body.traverse(setMats);
 // far LOD: the lo tier bound to this body's skeleton
 const lod=[],far=[];if(T!=='lo'&&HUM.tpl.lo){const lo=HUM.SU.clone(HUM.tpl.lo);lo.traverse(o=>{if(o.isSkinnedMesh){const bs=o.skeleton.bones.map(b=>bones[b.name]);o.bind(new THREE.Skeleton(bs,o.skeleton.boneInverses),o.bindMatrix);setMats(o)}});
  const ms=[];lo.traverse(o=>{if(o.isSkinnedMesh)ms.push(o)});for(const o of ms){const par=body.getObjectByName(o.parent.name)||body;par.add(o);o.visible=false;far.push(o)}
  body.traverse(o=>{if(o.isSkinnedMesh&&!far.includes(o))lod.push(o)})}
 // rest pose data: bone rest quats + rig-space axes
 rig.updateMatrixWorld(true);root.updateMatrixWorld(true);const rest={};for(const n in bones)rest[n]=bones[n].quaternion.clone();
 const rigInv=new THREE.Matrix4().copy(rig.matrixWorld).invert();const axL=(n,ax)=>{const b=bones[n];if(!b)return null;b.getWorldQuaternion(_q);rig.getWorldQuaternion(_q2);_q.premultiply(_q2.invert());return ax.clone().applyQuaternion(_q.invert()).normalize()};
 const X=new THREE.Vector3(1,0,0),Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0);const AX={};for(const n in bones)AX[n]={x:axL(n,X),z:axL(n,Z),y:axL(n,Y)};
 // gear on bones
 // gear: collected per bone, baked into that bone's space and merged into ONE vertex-coloured mesh per bone (few draw calls)
 const GB={};gear(L,teamCol,cls,(m,bn)=>{const b=bones[bn]?bn:'spine_03';(GB[b]=GB[b]||[]).push(m)});
 for(const bn in GB){const b=bones[bn];b.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(b.matrixWorld).invert();const gs=[];
  for(const m of GB[bn]){rig.add(m);m.updateMatrixWorld(true);let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();for(const k of Object.keys(g.attributes))if(!['position','normal'].includes(k))g.deleteAttribute(k);
   g.applyMatrix4(_m.multiplyMatrices(inv,m.matrixWorld));const col=m.material.color,n=g.attributes.position.count,ca=new Float32Array(n*4);const rr=m.material.roughness,mt=m.material.metalness,gk=m.material.userData.k||0;const gx=new Float32Array(n*2);for(let i=0;i<n;i++){ca[i*4]=col.r;ca[i*4+1]=col.g;ca[i*4+2]=col.b;ca[i*4+3]=rr;gx[i*2]=mt;gx[i*2+1]=gk}g.setAttribute('color',new THREE.BufferAttribute(ca,4));g.setAttribute('gx',new THREE.BufferAttribute(gx,2));rig.remove(m);gs.push(g)}
  const mg=HUM.BGU.mergeGeometries(gs);if(!mg)continue;const mesh=new THREE.Mesh(mg,gearMat());mesh.castShadow=true;b.add(mesh)}
 // aim frame + gun mount (same numbers as the old rig so gun FX/muzzle stay where the game expects)
 const aim=new THREE.Group();aim.position.set(0,1.36,0);rig.add(aim);const gunMount=new THREE.Group();gunMount.position.set(.055,-.085,-.4);aim.add(gunMount);
 const gR=new THREE.Object3D();gR.position.set(.06,-.11,-.36);aim.add(gR);const gL=new THREE.Object3D();gL.position.set(-.01,-.07,-.53);aim.add(gL);
 // name tag
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 38px system-ui,sans-serif';x.textAlign='center';
 x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(tagCol??teamCol).getHexString();x.fillText(name,128,46);
 const tg=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false,transparent:true}));tg.scale.set(1.5,.375,1);tg.position.y=2.25;root.add(tg);
 root.userData={kind:'hum',rig,body,bones,rest,AX,aim,gunMount,gR,gL,head:bones.head,tag:tg,ph:0,flinch:0,dead:0,roll:(h%2?1:-1),lod,far,lodOn:true,cls:cls||'soldier',crouch:0,climb:0,down:0,lean:0,mats:[cm]};
 return root}
const lerp=(a,b,k)=>a+(b-a)*k;
function rot(u,n,axis,a){const b=u.bones[n];if(!b||!a)return;const ax=u.AX[n][axis];_q.setFromAxisAngle(ax,a);b.quaternion.multiply(_q)}
// aim bone b so that its child (at world pos cw) points at world target t
function aimTo(b,cw,t){b.getWorldPosition(_v);_x.copy(cw).sub(_v).normalize();_y.copy(t).sub(_v).normalize();if(_x.lengthSq()<1e-8||_y.lengthSq()<1e-8)return;_q.setFromUnitVectors(_x,_y);b.getWorldQuaternion(_q2);_q2.premultiply(_q);b.parent.getWorldQuaternion(_q3);b.quaternion.copy(_q3.invert().multiply(_q2));b.updateMatrixWorld(true)}
const _A=new THREE.Vector3(),_B=new THREE.Vector3(),_C=new THREE.Vector3(),_T=new THREE.Vector3(),_P=new THREE.Vector3(),_E=new THREE.Vector3(),_D=new THREE.Vector3();
function ik(u,side,target,poleW){const up=u.bones['upperarm_'+side],lo=u.bones['lowerarm_'+side],hd=u.bones['hand_'+side];if(!up||!lo||!hd)return;
 up.getWorldPosition(_A);lo.getWorldPosition(_B);hd.getWorldPosition(_C);const l1=_A.distanceTo(_B),l2=_B.distanceTo(_C);_T.copy(target);
 _D.copy(_T).sub(_A);let d=_D.length();const mx=(l1+l2)*.999;if(d>mx){_D.multiplyScalar(mx/d);d=mx;_T.copy(_A).add(_D)}_D.normalize();
 const ca=Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*Math.max(d,1e-4)))),sa=Math.sqrt(1-ca*ca);
 _P.copy(poleW).sub(_A);_P.addScaledVector(_D,-_P.dot(_D)).normalize();_E.copy(_A).addScaledVector(_D,l1*ca).addScaledVector(_P,l1*sa);
 aimTo(up,_B,_E);lo.getWorldPosition(_B);hd.getWorldPosition(_C);aimTo(lo,_C,_T)}
export function animateHuman(m,st,dt){const u=m.userData;const sp=Math.min(st.speed,10);
 if(st.dist!=null&&u.far.length){const on=st.dist<20;if(on!==u.lodOn){u.lodOn=on;for(const o of u.lod)o.visible=on;for(const o of u.far)o.visible=!on}}
 const k8=Math.min(1,dt*8),k14=Math.min(1,dt*14);
 u.crouch=lerp(u.crouch,st.crouch?1:0,k8);u.climb=lerp(u.climb,st.climb?1:0,k8);u.down=lerp(u.down,st.down?1:0,Math.min(1,dt*5));
 const run=Math.min(1,sp/7),walk=Math.min(1,sp/2.2);u.ph+=dt*(st.climb?7:(1.6+sp*1.15));
 const s=Math.sin(u.ph),c=Math.cos(u.ph);const amp=(.32+.42*run)*walk;
 let rigY=-Math.abs(s)*.035*walk+.012*walk,rigX=-run*.1,rigZ=c*.03*walk,legA=[s*amp,-s*amp],shA=[-Math.max(0,Math.sin(u.ph+1.1))*amp*1.5-.05*walk,-Math.max(0,Math.sin(u.ph+1.1+Math.PI))*amp*1.5-.05*walk],headX=0,aimY=0,spX=0;
 if(u.crouch>.01){const k=u.crouch;rigY=lerp(rigY,-.3,k);legA=legA.map(a=>lerp(a,.95+a*.4,k));shA=shA.map(a=>lerp(a,-1.5+a*.3,k));rigX=lerp(rigX,.18,k)}
 if(st.air&&!st.climb){legA=[.55,-.15];shA=[-1.0,-.35];rigY=0}
 if(u.climb>.01){const k=u.climb,cs=Math.sin(u.ph);legA=legA.map((a,i)=>lerp(a,.6+(i?-cs:cs)*.5,k));shA=shA.map((a,i)=>lerp(a,-1.1+(i?cs:-cs)*.35,k));rigX=lerp(rigX,-.08,k);aimY=k}
 if(st.slide){rigY=-.48;rigX=.45;legA=[1.25,1.05];shA=[-.15,-.55]}
 if(u.down>.01){const k=u.down,cw=Math.sin(u.ph*.6)*walk;rigY=lerp(rigY,-.46,k);rigX=lerp(rigX,.6,k);legA=legA.map((a,i)=>lerp(a,.18+(i?-cw:cw)*.12,k));shA=shA.map((a,i)=>lerp(a,-2.68+(i?cw:-cw)*.1,k));headX=-.55*k;aimY=Math.max(aimY,.5*k)}
 let idleSway=0;{const idle=(1-walk)*(1-u.crouch)*(1-u.down)*(st.air||st.slide||st.climb?0:1);if(idle>.01){u.it=(u.it||0)+dt;const w=Math.sin(u.it*.7);rigZ+=w*.02*idle;legA=legA.map((a,i)=>a+(i?(w>0?.06:0):(w<0?.06:0))*idle);shA=shA.map((a,i)=>a-(i?(w>0?.1:0):(w<0?.1:0))*idle);rigY+=-.01*Math.abs(w)*idle;idleSway=Math.sin((u.it||0)*1.7)*.02*idle}}
 u.flinch=Math.max(0,u.flinch-dt*4);
 if(u.dead>0){u.dead+=dt;const k=Math.min(1,u.dead/.55);const e=k*k*(3-2*k);rigX=1.45*e;rigY=-.05*e;rigZ=u.roll*.25*e;legA=[.3*e,.1*e];shA=[-.2,-.3];u.tag.visible=false}else u.tag.visible=true;
 if(st.slope!=null&&u.down>.01)rigX+=st.slope*u.down;const r=u.rig;r.position.y+=(rigY-r.position.y)*k14;r.rotation.x+=((rigX+u.flinch*.35)-r.rotation.x)*Math.min(1,dt*(u.dead?8:12));r.rotation.z+=(rigZ-r.rotation.z)*k14;
 const pitch=u.dead?0:st.pitch;u.aim.rotation.x+=(lerp(pitch-r.rotation.x*.85,-.9,aimY*.6)-u.aim.rotation.x)*Math.min(1,dt*15);u.aim.position.y=1.36+(u.climb>.01?.05*u.climb:0)+(u.crouch>.01?0:0);
 // smoothed joint angles
 const J=u.J||(u.J={l0:0,l1:0,s0:0,s1:0,hx:0,sx:0});J.l0+=(legA[0]-J.l0)*k14;J.l1+=(legA[1]-J.l1)*k14;J.s0+=(shA[0]-J.s0)*k14;J.s1+=(shA[1]-J.s1)*k14;
 J.hx+=((pitch*.45-r.rotation.x*.6+headX)-J.hx)*k14;J.sx+=((pitch*.25-r.rotation.x*.2+idleSway)-J.sx)*k14;
 for(const n in u.rest)u.bones[n].quaternion.copy(u.rest[n]);
 // legs: thigh/calf around the rig X axis (+ = forward / knee bend back), feet stay flat-ish
 rot(u,'thigh_l','x',J.l0);rot(u,'calf_l','x',J.s0);rot(u,'foot_l','x',-(J.l0+J.s0)*.6);
 rot(u,'thigh_r','x',J.l1);rot(u,'calf_r','x',J.s1);rot(u,'foot_r','x',-(J.l1+J.s1)*.6);
 rot(u,'spine_02','x',J.sx*.5);rot(u,'spine_03','x',J.sx*.5);rot(u,'spine_03','y',(u.torsoY=lerp(u.torsoY||0,s*.06*walk,k14))-.12);rot(u,'neck_01','x',J.hx*.4);rot(u,'head','x',J.hx*.6);rot(u,'head','y',.12);
 rot(u,'head','z',r.rotation.z*.8);
 // fingers: grip curl
 for(const sd of['l','r'])for(const f of['index','middle','ring','pinky'])for(let i=1;i<=3;i++)rot(u,`${f}_0${i}_${sd}`,'x',-(i===1?.5:.7));
 m.updateMatrixWorld(true);
 // arms: 2-bone IK onto the weapon (right hand on the grip, left on the handguard); elbows down/out
 u.gR.getWorldPosition(_w);const pr=_v.set(.45,-.9,.2).applyQuaternion(r.getWorldQuaternion(_q3)).add(u.bones.upperarm_r.getWorldPosition(new THREE.Vector3()));ik(u,'r',_w.clone(),pr);
 u.gL.getWorldPosition(_w);const pl=_v.set(-.6,-.8,-.1).applyQuaternion(r.getWorldQuaternion(_q3)).add(u.bones.upperarm_l.getWorldPosition(new THREE.Vector3()));ik(u,'l',_w.clone(),pl);
 // hands align with the gun's forward axis
 u.aim.getWorldQuaternion(_q3);_x.set(0,0,-1).applyQuaternion(_q3);for(const sd of['r','l']){const hb=u.bones['hand_'+sd],mc=u.bones['middle_01_'+sd];if(hb&&mc){mc.getWorldPosition(_E);hb.getWorldPosition(_A);aimTo(hb,_E,_A.clone().add(_x))}}}
