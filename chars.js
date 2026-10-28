// HeadShotz characters v3: sculpted human forms (jaw, cheekbones, neck muscles, deltoids/biceps/calves, fingers), detailed faces
// (eye whites + iris + lids, lips, brows, hair and facial-hair variety, stubble), clothing with procedural fabric folds/weave,
// seams, per-class camo, MOLLE webbing, patches, straps/buckles, detailed boots and gloves. One custom PBR material for all
// characters: per-vertex material id (cloth/camo, skin, gear, eyes, leather) drives camo, fold bump, roughness, subsurface-like
// skin tint and rim light. Each section = 1 main mesh + 1 detail mesh (detail hidden beyond ~28 m), geometry cached per look.
import {THREE,G,mergeParts,texMat,MATHOOK,GQ} from './gfx.js';
import {HUM,makeHuman,animateHuman,setRbox} from './humans.js';
import {makeToon} from './toon.js';
const SKINS=[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac,0xd4a373,0xa86b45,0x6b4226];
const HAIR=[0x2b1d14,0x5a3825,0xb5813f,0x111111,0x8b4513,0xd8c08a,0x7a3b1d];
const IRIS=[0x4a6fa5,0x5b3a1e,0x3e7d4a,0x2a1a10,0x6f8a9c];
function hash(s){let h=7;for(const c of String(s))h=h*31+c.charCodeAt(0)|0;return Math.abs(h)}
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
// material ids: 0 cloth+camo 1 skin 2 hard gear 3 eye 4 plain cloth/leather 5 stubble skin 6 hair
let MID=0;const M=k=>{MID=k};
function limb(P,a,b,r1,r2,c,seg=10){_a.set(...a);_b.set(...b);const d=_b.clone().sub(_a),l=d.length();_q.setFromUnitVectors(_up,d.normalize());_m.compose(_a.clone().add(_b).multiplyScalar(.5),_q,new THREE.Vector3(1,1,1));P.push({g:(lowQ()||Math.max(r1,r2)<(GQ.level==='high'?.02:.03))?G('cyl',r2,r1,l,lowQ()?Math.max(5,seg*.7|0):seg):limbGeo(l,r1,r2,0,seg+(GQ.level==='high'?4:0)),m:_m.clone(),c,k:MID})}
const LG={};function limbGeo(l,r1,r2,bu,seg){const k=[l,r1,r2,bu,seg].map(v=>+(+v).toFixed(4)).join(',');if(LG[k])return LG[k];const pts=[];const n=GQ.level==='low'?4:GQ.level==='high'?10:6;
 const nc=GQ.level==='low'?2:GQ.level==='high'?4:3;for(let i=0;i<=nc;i++){const a=-Math.PI/2+i/nc*Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r1,-l/2+Math.sin(a)*r1*.9))}
 for(let i=1;i<n;i++){const t=i/n;pts.push(new THREE.Vector2(r1+(r2-r1)*t+bu*Math.sin(Math.PI*t)*Math.sin(Math.PI*t),-l/2+l*t))}
 for(let i=0;i<=nc;i++){const a=i/nc*Math.PI/2;pts.push(new THREE.Vector2(Math.max(1e-4,Math.cos(a)*r2),l/2+Math.sin(a)*r2*.9))}
 const g=new THREE.LatheGeometry(pts,seg);return LG[k]=g}
function limbO(P,a,b,r1,r2,c,bu=0,seg=14){_a.set(...a);_b.set(...b);const d=_b.clone().sub(_a),l=d.length();_q.setFromUnitVectors(_up,d.normalize());_m.compose(_a.clone().add(_b).multiplyScalar(.5),_q,new THREE.Vector3(1,1,1));P.push({g:limbGeo(l,r1,r2,bu,lowQ()?Math.max(6,seg*.55|0):seg+4),m:_m.clone(),c,k:MID})}
function torsoGeo(pr,seg,sz){const k='T'+pr.join()+seg+sz;if(LG[k])return LG[k];const g=new THREE.LatheGeometry(pr.map(([r,y])=>new THREE.Vector2(Math.max(1e-4,r),y)),seg);g.scale(1,1,sz);return LG[k]=g}
// v19: every "box" part is a rounded box (spherified corners/edges, smooth normals) so gear, faces and plates read soft, not blocky.
// Low tier uses 1 corner segment (cheap bevel), medium 2, high 3; geometry cached per size.
const lowQ=()=>GQ.level==='low',CS=()=>GQ.level==='high'?2:1;
const RB={};function rbox(w,h,d){const s=CS(),k=[w,h,d,s].map(v=>+(+v).toFixed(4)).join(',');if(RB[k])return RB[k];
 const r=Math.min(w,h,d)*.42,n=2*s+1,g=new THREE.BoxGeometry(1,1,1,n,n,n),pa=g.attributes.position,na=g.attributes.normal,hx=[w/2-r,h/2-r,d/2-r],v=[0,0,0],c=[0,0,0];
 const map=(u,hi)=>{const t=Math.round((u+.5)*n);let x;if(t<=s)x=-hi-r+r*t/s;else if(t>=n-s)x=hi+r*(t-(n-s))/s;else x=-hi+2*hi*(t-s)/(n-2*s);return x};
 for(let i=0;i<pa.count;i++){v[0]=map(pa.getX(i),hx[0]);v[1]=map(pa.getY(i),hx[1]);v[2]=map(pa.getZ(i),hx[2]);for(let a=0;a<3;a++)c[a]=Math.max(-hx[a],Math.min(hx[a],v[a]));
  let nx=v[0]-c[0],ny=v[1]-c[1],nz=v[2]-c[2];const l=Math.hypot(nx,ny,nz);if(l>1e-7){nx/=l;ny/=l;nz/=l;pa.setXYZ(i,c[0]+nx*r,c[1]+ny*r,c[2]+nz*r);na.setXYZ(i,nx,ny,nz)}else{pa.setXYZ(i,v[0],v[1],v[2])}}
 return RB[k]=g}
const bx=(P,w,h,d,x,y,z,c,rx=0,ry=0,rz=0)=>P.push({g:Math.min(w,h,d)<(GQ.level==='high'?.004:.012)||Math.max(w,h,d)<(lowQ()?.2:GQ.level==='high'?0:.04)?G('box',w,h,d):rbox(w,h,d),p:[x,y,z],r:[rx,ry,rz],c,k:MID});
const sp=(P,r,x,y,z,c,sx=1,sy=1,sz=1,seg=12)=>{seg=lowQ()?Math.max(6,seg*.6|0):r>.05&&GQ.level==='high'?seg+8:seg;P.push({g:G('sph',r,seg,Math.max(6,seg*.7|0)),p:[x,y,z],s:[sx,sy,sz],c,k:MID})};
const cy=(P,r1,r2,h,x,y,z,c,seg=12,rx=0,rz=0)=>P.push({g:G('cyl',r1,r2,h,seg),p:[x,y,z],r:[rx,0,rz],c,k:MID});
// ---------- character material ----------
const NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 pbump(vec3 sp,vec3 n,float h){vec3 sx=dFdx(sp),sy=dFdy(sp);vec3 r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);vec3 g=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*n-g);}`;
const CM={};
function charMat(lvl){if(lvl==='low')return texMat('char');if(CM[lvl])return CM[lvl];const hi=lvl==='high';
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,envMapIntensity:.45});
 m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float mid;attribute float camo;varying float vMid;varying float vCamo;varying vec3 vOP;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvMid=mid;vCamo=camo;vOP=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vMid;varying float vCamo;varying vec3 vOP;\n'+NOISE)
   .replace('#include <color_fragment>',`#include <color_fragment>
   float isCloth=step(vMid,.5),isSkin=step(.5,vMid)*step(vMid,1.5)+step(4.5,vMid)*step(vMid,5.5),isGear=step(1.5,vMid)*step(vMid,2.5),isEye=step(2.5,vMid)*step(vMid,3.5),isHair=step(5.5,vMid);
   if(isCloth>.5&&vCamo>.5){vec3 q=vOP*vec3(9.,7.,9.);float n=vn(q)+.5*vn(q*2.3);vec3 c0=diffuseColor.rgb;
    if(vCamo<1.5){diffuseColor.rgb=n<.62?c0*.62:n<.98?c0:mix(c0,vec3(.22,.2,.14),.55);}                      // woodland blotches
    else if(vCamo<2.5){vec3 pq=floor(vOP*vec3(38.));float d=h3(pq)+.4*h3(floor(vOP*vec3(14.)));diffuseColor.rgb=d<.5?c0*.7:d<1.05?c0:c0*1.25;} // digital
    else if(vCamo<3.5){float t=sin(vOP.y*42.+vn(q*.7)*5.);diffuseColor.rgb=t>.55?c0*.45:c0;}                   // tiger stripes
    else {diffuseColor.rgb=c0*(.85+.25*vn(q*3.));}}                                                           // tonal
   if(vMid>4.5&&vMid<5.5){float st=step(.62,h3(floor(vOP*vec3(520.))));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.45,st*.65);}
   if(isHair>.5){diffuseColor.rgb*=.8+.4*vn(vOP*vec3(260.,40.,260.));}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=isCloth>.5?.92:isSkin>.5?.52:isGear>.5?.42:isEye>.5?.12:isHair>.5?.6:.78;`)
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=isGear>.5?.18:0.;')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   {float h=0.;if(vMid<.5||(vMid>3.5&&vMid<4.5)){h=(sin(vOP.y*95.+sin(vOP.x*31.+vOP.z*27.)*2.4)*.0011+vn(vOP*vec3(${hi?'900.':'500.'}))*.00035);}
    else if(isSkin>.5){h=vn(vOP*vec3(1400.))*.00012;}else if(isHair>.5){h=vn(vOP*vec3(900.,80.,900.))*.0006;}
    if(h!=0.)normal=pbump(-vViewPosition,normal,h);}`)
   .replace('#include <opaque_fragment>',`{vec3 Vd=normalize(vViewPosition);float rim=pow(1.-clamp(dot(normal,Vd),0.,1.),3.);
    outgoingLight+=rim*mix(vec3(.16,.19,.24),vec3(.5,.24,.16),isSkin)*diffuseColor.rgb*1.4+rim*.05;
    outgoingLight+=isSkin*diffuseColor.rgb*vec3(.11,.03,.018);
    if(isEye>.5)outgoingLight+=pow(max(0.,dot(normal,normalize(vec3(.3,.5,1.)))),40.)*.5;}
   #include <opaque_fragment>`)};
 m.customProgramCacheKey=()=>'char3'+lvl;return CM[lvl]=m}
MATHOOK.char3=charMat;
const GEO={};const MAT=()=>texMat('char3');
function mk(key,f,camo){key+="|"+GQ.level;if(!GEO[key]){const P=[];f(P);if(!P.length){GEO[key]=null}else{const g=mergeParts(P);const n=g.attributes.position.count;const md=new Float32Array(n),cm=new Float32Array(n);let o=0;
  for(const pt of P){const c=pt.g.index?pt.g.index.count:pt.g.attributes.position.count;md.fill(pt.k||0,o,o+c);cm.fill((pt.k||0)===0?camo:0,o,o+c);o+=c}
  if(o===n){g.setAttribute('mid',new THREE.BufferAttribute(md,1));g.setAttribute('camo',new THREE.BufferAttribute(cm,1))}else{g.setAttribute('mid',new THREE.BufferAttribute(new Float32Array(n),1));g.setAttribute('camo',new THREE.BufferAttribute(new Float32Array(n),1))}GEO[key]=g}}return GEO[key]}
let CAMO=0;
function sect(parent,key,main,detail){const g=new THREE.Group();MID=0;const a=mk(key+'|m',main,CAMO);if(a){const m=new THREE.Mesh(a,MAT());m.userData.tm='char3';m.castShadow=true;g.add(m)}
 if(detail){MID=0;const b=mk(key+'|d',detail,CAMO);if(b){const d=new THREE.Mesh(b,MAT());d.userData.tm='char3';d.userData.lod=1;g.add(d)}}MID=0;parent.add(g);return g}
// class looks: colours + headgear + kit flags + camo (1 woodland 2 digital 3 tiger 4 tonal 0 none)
export const LOOKS={
 soldier:{head:'helmet',vest:0x4b5344,pants:0x4a5038,shirtT:1,camo:1},
 ninja:{head:'ninja',vest:0x15161a,pants:0x1b1c21,slim:1,shirt:0x202127,belt:0xa31515,camo:4},
 juggernaut:{head:'jugg',vest:0x2f3338,pants:0x3a3e44,bulk:1,plates:1,camo:2},
 medic:{head:'cap',vest:0xe9ecef,pants:0x5a6470,cross:1,pack:1,camo:2},
 scout:{head:'boonie',vest:0x6b5b3e,pants:0x7a6c4c,light:1,goggles:1,rolled:1,camo:3},
 engineer:{head:'hardhat',vest:0xe67e22,pants:0x34495e,tools:1,pack:1,rolled:1,camo:0}};
export function makeCharacter(teamCol,name,id,tagCol,outfit,cls){let m=null;if(window.__toonOn&&window.__toonOn(id))return makeToon(teamCol,name,id,tagCol,window.__toonFit?window.__toonFit(id):null);if(HUM.ready&&!window.__procChars){try{m=makeHuman(teamCol,name,id,tagCol,outfit,cls,LOOKS)}catch(e){console.warn('human',e&&e.message)}}if(!m)m=makeProc(teamCol,name,id,tagCol,outfit,cls);m.userData.args=[teamCol,name,id,tagCol,outfit,cls];return m}
export {HUM};
function makeProc(teamCol,name,id,tagCol,outfit,cls){const h=hash(id);const skin=SKINS[h%SKINS.length],hair=HAIR[(h>>3)%HAIR.length],iris=IRIS[(h>>5)%IRIS.length];
 const hs=(h>>7)%4,fh=(h>>9)%4;// hair style, facial hair
 const L=LOOKS[cls]||LOOKS.soldier;CAMO=outfit?(outfit.camo||0):L.camo;const col=new THREE.Color(teamCol),dark=col.clone().multiplyScalar(.55).getHex();
 const shirt=L.shirt??teamCol,vest=outfit?outfit[0]:L.vest,pants=outfit?outfit[1]:L.pants,boot=0x2a2520,sole=0x0e0e0e,glove=0x2a2a2a,strap=0x26292b,pouch=new THREE.Color(vest).multiplyScalar(.82).getHex(),metal=0x6f747a,seam=new THREE.Color(pants).multiplyScalar(.6).getHex(),lip=new THREE.Color(skin).lerp(new THREE.Color(0x9e4b46),.45).getHex(),skinD=new THREE.Color(skin).multiplyScalar(.85).getHex();
 const bw=L.bulk?1.18:L.slim?.92:1;const K=['v3',cls||'soldier',teamCol,skin,hair,iris,hs,fh,vest,pants,outfit?1:0].join('|');
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
 // ---- torso (hips .92 .. shoulders 1.42) ----
 const torso=sect(rig,'T'+K,P=>{
  M(0);P.push({g:torsoGeo([[.02,.86],[.13,.865],[.165,.9],[.17,.97],[.16,1.04],[.15,1.07]].map(([r,y])=>[r*bw,y]),20,.74),p:[0,0,0],c:pants,k:MID});// pelvis / pants seat
  M(L.slim?4:0);P.push({g:torsoGeo([[.15,1.0],[.152,1.05],[.146,1.1],[.16,1.2],[.178,1.29],[.18,1.35],[.165,1.41],[.11,1.455],[.05,1.47]].map(([r,y])=>[r*bw,y]),22,.7),p:[0,0,0],c:shirt,k:MID});// organic torso: waist -> ribcage -> chest -> shoulders
  bx(P,.31*bw,.025,.23*bw,0,1.035,0,new THREE.Color(shirt).multiplyScalar(.9).getHex());// shirt hem overlapping belt
  if(L.slim){sp(P,.075,-.07,1.3,-.1,shirt,1.1,.8,.6,10);sp(P,.075,.07,1.3,-.1,shirt,1.1,.8,.6,10)}// pecs
  sp(P,.1*bw,-.2*bw,1.37,0,shirt,1.05,.85,1);sp(P,.1*bw,.2*bw,1.37,0,shirt,1.05,.85,1);// shoulders / deltoids
  limb(P,[-.05,1.47,.01],[-.19*bw,1.39,.01],.045,.06,shirt,8);limb(P,[.05,1.47,.01],[.19*bw,1.39,.01],.045,.06,shirt,8);// trapezius
  M(1);cy(P,.052,.06,.1,0,1.465,0,skin,12);M(L.slim?4:0);bx(P,.13,.05,.06,0,1.43,-.065,shirt);// neck + collar
  M(0);if(!L.slim){bx(P,.36*bw,.34,.07,0,1.22,-.125*bw,vest);bx(P,.36*bw,.34,.06,0,1.22,.12*bw,vest);bx(P,.08,.3,.24*bw,-.18*bw,1.2,0,vest);bx(P,.08,.3,.24*bw,.18*bw,1.2,0,vest)}// plate carrier
  M(4);bx(P,.37*bw,.055,.32*bw,0,1.02,0,L.belt??strap);// belt
  M(2);if(L.plates){bx(P,.4,.2,.09,0,1.34,-.16,vest);bx(P,.42,.22,.09,0,1.14,-.17,vest);sp(P,.13,-.24,1.4,0,vest,1.1,.7,1.1);sp(P,.13,.24,1.4,0,vest,1.1,.7,1.1);bx(P,.3,.12,.06,0,.92,-.15,vest)}// plates + groin plate
  M(4);if(L.pack){bx(P,.28,.36,.16,0,1.22,.2*bw,L.cross?0xd6d9dc:0x4a4f55);bx(P,.26,.05,.15,0,1.42,.2*bw,strap);bx(P,.22,.08,.03,0,1.08,.285*bw,new THREE.Color(L.cross?0xd6d9dc:0x4a4f55).multiplyScalar(.8).getHex())}
 },P=>{const z=-.165*bw;
  M(1);sp(P,.012,0,1.445,-.055,skinD,1,1.3,1,6);limb(P,[-.035,1.51,-.02],[-.012,1.43,-.05],.011,.013,skinD,6);limb(P,[.035,1.51,-.02],[.012,1.43,-.05],.011,.013,skinD,6);// adam's apple + neck muscles
  M(4);if(!L.slim){for(const x of[-.11,0,.11]){bx(P,.085,.11,.05,x,1.13,z,pouch);bx(P,.088,.025,.055,x,1.19,z,new THREE.Color(pouch).multiplyScalar(.8).getHex());bx(P,.02,.03,.01,x,1.175,z-.03,0x111111)}// mag pouches + tabs
   for(let r=0;r<3;r++)for(const s of[-1,1])bx(P,.012,.035*bw,.2*bw,s*.185*bw,1.1+r*.06,0,strap);// MOLLE rows (sides)
   for(let r=0;r<2;r++)bx(P,.34*bw,.008,.005,0,1.27+r*.05,z-.008,new THREE.Color(vest).multiplyScalar(.7).getHex());// MOLLE webbing front
   bx(P,.12,.07,.03,.08,1.31,z+.005,pouch);M(2);bx(P,.05,.12,.05,-.2*bw,1.3,-.06,0x1d1f20);cy(P,.006,.006,.12,-.2*bw,1.42,-.06,0x111111,4);// admin pouch, radio + antenna
   M(4);bx(P,.11,.03,.008,-.08,1.34,z-.004,0x2d2d2d);bx(P,.1,.022,.004,-.08,1.34,z-.01,0xd9d2b8)}// name tape
  M(2);bx(P,.05,.04,.02,0,1.02,-.165*bw,0xb8a26a);bx(P,.02,.02,.01,0,1.02,-.178*bw,0x8a7a4a);// buckle
  M(4);for(const s of[-1,1]){bx(P,.06,.025,.3*bw,s*.12,1.41,0,strap);M(2);bx(P,.035,.03,.012,s*.12,1.36,-.15*bw,metal);M(4)}// shoulder straps + buckles
  for(const s of[-1,1])bx(P,.006,.4,.006,s*.165*bw,1.2,0,new THREE.Color(shirt).multiplyScalar(.65).getHex());// side seams
  bx(P,.006,.2,.006,-.1,.98,-.155*bw,seam);bx(P,.006,.2,.006,.1,.98,-.155*bw,seam);// fly/pocket seams
  if(L.cross){bx(P,.1,.03,.01,0,1.3,z-.01,0xd63031);bx(P,.03,.1,.01,0,1.3,z-.01,0xd63031);bx(P,.09,.03,.01,0,1.3,.29*bw,0xd63031);bx(P,.03,.09,.01,0,1.3,.29*bw,0xd63031)}
  if(L.tools){bx(P,.08,.1,.05,.16,.97,-.12,0x8d6e63);M(2);bx(P,.02,.14,.02,.2,.95,-.13,metal);bx(P,.04,.03,.02,.2,1.03,-.13,0xc0392b);M(4);bx(P,.08,.1,.05,-.16,.97,-.12,0x8d6e63);M(2);cy(P,.03,.03,.02,-.17,.9,-.15,0xbdc3c7,10,Math.PI/2)}// tool pouches, wrench, tape
  if(L.slim){M(4);bx(P,.36,.04,.02,0,1.25,-.15,0x2b2c33,0,0,.6);M(2);bx(P,.04,.3,.04,.0,1.25,.16,0x55575e,0,0,.6);bx(P,.08,.02,.06,-.07,1.15,.15,0x8a7a4a,0,0,.6)}// ninja wrap + sword handle + guard
 });
 // ---- head (pivot at neck 1.5) ----
 const head=new THREE.Group();head.position.set(0,1.5,0);head.scale.setScalar(.93);rig.add(head);const hd=L.head,capped=hd!=='ninja'&&hd!=='helmet'&&hd!=='jugg';
 sect(head,'H'+K,P=>{
  M(1);sp(P,.113,0,.145,-.002,skin,.9,1.06,1,16);// cranium
  M(fh===1?5:1);sp(P,.088,0,.06,-.025,skin,1.0,.6,1.0,14);sp(P,.032,0,.03,-.088,skin,1.1,.8,.8,10);// jaw + chin
  M(1);for(const s of[-1,1]){sp(P,.022,s*.058,.112,-.082,skin,1.35,.6,.55,10);sp(P,.024,s*.112,.13,0,skin,.55,1.1,1,8)}// cheekbones + ears
  bx(P,.12,.022,.03,0,.17,-.097,skin);// brow ridge
  if(hd==='helmet'||hd==='jugg'){M(2);sp(P,.142,0,.225,.01,hd==='jugg'?0x3a3d42:teamCol,1,.74,1.08,16);bx(P,.29,.02,.3,0,.2,.01,hd==='jugg'?0x2a2c30:dark)}
  else if(hd==='ninja'){M(4);sp(P,.124,0,.15,0,0x15161a,1,1.12,1.06,16);M(1);bx(P,.2,.05,.03,0,.145,-.112,skin)}
  else if(hd==='cap'){M(4);sp(P,.123,0,.2,0,0xe9ecef,1,.6,1.05,16);bx(P,.16,.015,.09,0,.18,-.15,0xd63031)}
  else if(hd==='boonie'){M(0);sp(P,.125,0,.2,0,0x6b5b3e,1,.65,1.05,16);cy(P,.2,.21,.02,0,.175,0,0x5c4f35,18)}
  else if(hd==='hardhat'){M(2);sp(P,.135,0,.2,0,0xf1c40f,1,.72,1.08,16);cy(P,.17,.17,.015,0,.17,-.01,0xf1c40f,18)}
  if(capped){M(6);if(hs!==3)sp(P,.117,0,.16,.012,hair,.97,.9,.98,14)}// hair under headgear
  if(hd==='helmet'||hd==='jugg'){M(6);if(hs!==3)for(const s of[-1,1])bx(P,.012,.05,.03,s*.105,.12,-.03,hair)}// sideburns
  if(fh===2&&hd!=='ninja'&&hd!=='jugg'){M(6);sp(P,.08,0,.04,-.035,hair,1.1,.6,1.05,12);sp(P,.04,0,.015,-.08,hair,1.1,.9,.9,8)}// full beard
 },P=>{const fz=-.112;
  if(hd!=='ninja'){M(1);limb(P,[0,.15,fz+.005],[0,.105,fz-.018],.009,.014,skin,6);sp(P,.014,0,.102,fz-.014,skin,1,.85,1,8);for(const s of[-1,1])sp(P,.009,s*.014,.093,fz-.008,skinD,1,.7,1,6);// nose bridge, tip, nostrils
   M(1);bx(P,.045,.009,.012,0,.068,fz+.006,lip);sp(P,.022,0,.056,fz+.008,lip,1.2,.45,.5,8);// lips
   if(fh===3){M(6);bx(P,.05,.012,.012,0,.078,fz+.0,hair)}}// mustache
  for(const s of[-1,1]){M(3);sp(P,.016,s*.04,.145,fz+.002,0xf2efe8,1.15,.8,.55,10);sp(P,.0085,s*.04,.145,fz-.006,iris,1,1,.4,8);sp(P,.004,s*.04,.145,fz-.0095,0x080808,1,1,.4,6);// eye white, iris, pupil
   M(1);sp(P,.018,s*.04,.154,fz+.0,skin,1.2,.42,.6,8);// upper lid
   if(hd!=='ninja'){M(6);bx(P,.045,.01,.012,s*.042,.178,fz+.006,hair,0,0,s*-.12)}}// brows
  if(hd==='helmet'){M(2);bx(P,.06,.05,.03,0,.25,-.15,0x222222);bx(P,.04,.03,.04,0,.24,-.17,0x111111);for(const s of[-1,1]){bx(P,.03,.04,.12,s*.14,.2,0,0x2b2b2b);M(4);bx(P,.012,.12,.012,s*.118,.09,-.02,strap);M(2)}bx(P,.06,.03,.008,0,.2,.15,0x6f747a)}// NVG mount, rails, chin straps, strobe
  if(hd==='jugg'){M(2);bx(P,.22,.08,.03,0,.15,-.14,0x1a1a1a);M(3);bx(P,.2,.04,.025,0,.15,-.157,0x6fb7ff);M(2);for(const s of[-1,1])cy(P,.03,.03,.03,s*.15,.15,-.02,0x2a2c30,10,0,Math.PI/2)}// visor + ear cups
  if(hd==='cap'||hd==='boonie'){M(2);for(const s of[-1,1])cy(P,.035,.035,.025,s*.125,.13,0,0x222222,10,0,Math.PI/2);bx(P,.012,.012,.1,.12,.08,-.06,0x222222)}// headset + mic
  if(hd==='cap'){M(4);bx(P,.04,.04,.005,0,.24,-.12,0xd63031)}
  if(L.goggles){M(4);bx(P,.24,.025,.02,0,.24,-.11,0x222);M(3);for(const s of[-1,1])bx(P,.07,.04,.02,s*.045,.24,-.125,0x9fd3ff)}
  if(hd==='hardhat'){M(4);bx(P,.08,.03,.005,0,.24,-.135,0x222222)}
  if(hd==='ninja'){M(4);bx(P,.24,.02,.02,0,.205,-.112,0xa31515);bx(P,.02,.12,.02,0,.15,.12,0xa31515,.3)}// headband + tail
 });
 // ---- aim group: arms + hands holding the gun ----
 const aim=new THREE.Group();aim.position.set(0,1.36,0);rig.add(aim);const fore=L.rolled?skin:shirt;
 sect(aim,'A'+K,P=>{const ar=L.bulk?.07:.055;
  M(L.slim?4:0);limbO(P,[.2*bw,0,0],[.2,-.2,-.14],ar*1.05,ar*.82,shirt,ar*.18);// upper arm with bicep (seamless shoulder/elbow caps)
  M(L.rolled?1:L.slim?4:0);limbO(P,[.2,-.2,-.14],[.07,-.12,-.36],ar*.85,ar*.62,fore,ar*.14);
  M(L.slim?4:0);limbO(P,[-.2*bw,0,0],[-.19,-.17,-.24],ar*1.05,ar*.82,shirt,ar*.18);
  M(L.rolled?1:L.slim?4:0);limbO(P,[-.19,-.17,-.24],[-.02,-.08,-.56],ar*.85,ar*.62,fore,ar*.14);
  M(4);sp(P,.042,.06,-.12,-.39,glove,1,1.05,1.25,10);sp(P,.042,-.01,-.08,-.58,glove,1,.9,1.25,10);// gloved palms
  if(L.rolled){M(0);for(const s of[1,-1]){const e=s>0?[.2,-.2,-.14]:[-.19,-.17,-.24];cy(P,ar*1.08,ar*1.08,.04,e[0]*.96+(s>0?-.005:.01),e[1]+.005,e[2]-.01,shirt,10,.9)}}// rolled cuffs
 },P=>{M(4);
  for(let i=0;i<4;i++){limb(P,[.088,-.11,-.365-i*.017],[.04,-.165,-.37-i*.017],.011,.01,glove,6);limb(P,[-.045,-.105,-.552-i*.017],[.025,-.055,-.556-i*.017],.011,.01,glove,6)}// fingers wrapped on grip / handguard
  limb(P,[.035,-.095,-.375],[.01,-.075,-.425],.012,.01,glove,6);limb(P,[-.04,-.06,-.575],[-.015,-.035,-.62],.012,.01,glove,6);// thumbs
  M(2);bx(P,.05,.02,.06,.075,-.095,-.39,0x1a1a1a,0,0,-.5);bx(P,.05,.02,.06,-.015,-.055,-.58,0x1a1a1a,0,0,.3);// knuckle pads
  M(4);cy(P,.047,.047,.03,.07,-.13,-.33,glove,10,1.2);cy(P,.047,.047,.03,-.02,-.085,-.52,glove,10,1.2);// glove cuffs
  if(!L.slim){for(const s of[-1,1])bx(P,.1,.06,.1,s*.2,-.06,-.03,L.plates?0x2f3338:new THREE.Color(shirt).multiplyScalar(.7).getHex());// shoulder pads
   bx(P,.012,.06,.08,-.255*bw,-.05,-.02,teamCol);bx(P,.013,.02,.08,-.256*bw,-.05,-.02,0xffffff);bx(P,.012,.05,.06,.255*bw,-.05,-.02,0x4a4a4a)}// flag + velcro patches
  for(const s of[-1,1])bx(P,.008,.008,.12,s>0?.135:-.105,s>0?-.16:-.125,s>0?-.25:-.4,new THREE.Color(fore).multiplyScalar(.6).getHex(),.5)});// sleeve seams
 const gunMount=new THREE.Group();gunMount.position.set(.055,-.085,-.4);aim.add(gunMount);
 // ---- legs ----
 const legs=[];for(const s of[-1,1]){const th=new THREE.Group();th.position.set(s*.095*bw,.92,0);rig.add(th);
  sect(th,'Lt'+s+K,P=>{M(0);limbO(P,[0,.02,0],[0,-.43,-.01],.095*bw,.066*bw,pants,.012*bw,16);sp(P,.06*bw,0,-.17,-.04,pants,1,2,.7,10)},// thigh (seamless hip/knee) + quad
   P=>{M(0);bx(P,.07,.11,.05,s*.07,-.2,-.03,pouch);M(4);bx(P,.072,.012,.052,s*.07,-.15,-.03,new THREE.Color(pouch).multiplyScalar(.75).getHex());bx(P,.006,.42,.006,s*.088*bw,-.21,0,seam);// cargo pocket + flap + outer seam
    if(s>0&&!L.slim){M(2);bx(P,.06,.17,.09,.08,-.13,-.02,0x1d1f20);M(4);bx(P,.065,.025,.1,.08,-.03,-.02,strap);bx(P,.065,.025,.1,.08,-.19,-.02,strap)}});// thigh holster + straps
  const sh=new THREE.Group();sh.position.set(0,-.44,-.01);th.add(sh);
  sect(sh,'Ls'+s+K,P=>{M(0);limbO(P,[0,.01,0],[0,-.36,.01],.068*bw,.056,pants,.008,16);sp(P,.05*bw,0,-.13,.03,pants,1,1.7,.9,10);P.push({g:torsoGeo([[.058,-.27],[.066,-.32],[.075,-.35],[.078,-.37]],14,1.05),p:[0,0,.005],c:pants,k:0});// shin + calf + pant hem draping over boot
   M(4);bx(P,.12,.1,.24,0,-.43,-.045,boot);sp(P,.06,0,-.44,-.14,boot,1,.7,1.1,10);bx(P,.125,.025,.255,0,-.47,-.045,sole);cy(P,.065,.072,.13,0,-.355,.005,boot,12)},// boot, toe cap, sole, ankle
   P=>{M(2);bx(P,.11,.12,.05,0,-.02,-.065,L.slim?0x202127:0x3a3f45);M(4);bx(P,.125,.02,.02,0,-.02,0,strap);// knee pad + strap
    for(let i=0;i<4;i++)bx(P,.07,.006,.01,0,-.4+i*.022,-.125,0x8a7f6a);bx(P,.135,.02,.05,0,-.335,-.02,strap);M(2);bx(P,.025,.022,.012,s*.06,-.335,-.05,metal);// laces, ankle strap + buckle
    M(4);for(let i=0;i<4;i++)bx(P,.13,.01,.02,0,-.485,-.15+i*.06,0x050505)});// sole treads
  legs.push([th,sh])}
 // name tag
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 38px system-ui,sans-serif';x.textAlign='center';
 x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(tagCol??teamCol).getHexString();x.fillText(name,128,46);
 const tg=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false,transparent:true}));tg.scale.set(1.5,.375,1);tg.position.y=2.25;root.add(tg);
 const lod=[];root.traverse(o=>{if(o.userData&&o.userData.lod)lod.push(o)});
 root.userData={rig,head,aim,gunMount,legs,torso,tag:tg,ph:0,flinch:0,dead:0,roll:(h%2?1:-1),lod,lodOn:true,cls:cls||'soldier',crouch:0,climb:0,down:0,lean:0};return root}
const lerp=(a,b,k)=>a+(b-a)*k;
// st: {speed, air, slide, pitch, crouch, climb, down, dist}
export function animate(m,st,dt){const u=m.userData;if(u.anim)return u.anim(m,st,dt);if(u.kind==='hum')return animateHuman(m,st,dt);const sp=Math.min(st.speed,10);
 if(st.dist!=null){const on=st.dist<28;if(on!==u.lodOn){u.lodOn=on;for(const o of u.lod)o.visible=on}}
 const k8=Math.min(1,dt*8),k14=Math.min(1,dt*14);
 u.crouch=lerp(u.crouch,st.crouch?1:0,k8);u.climb=lerp(u.climb,st.climb?1:0,k8);u.down=lerp(u.down,st.down?1:0,Math.min(1,dt*5));
 const run=Math.min(1,sp/7),walk=Math.min(1,sp/2.2);u.ph+=dt*(st.climb?7:(1.6+sp*1.15));
 const s=Math.sin(u.ph),c=Math.cos(u.ph);const amp=(.32+.42*run)*walk;
 // base gait
 let rigY=-Math.abs(s)*.035*walk+.012*walk,rigX=-run*.14,rigZ=c*.035*walk,legA=[s*amp,-s*amp],shA=[-Math.max(0,Math.sin(u.ph+1.1))*amp*1.5-.05*walk,-Math.max(0,Math.sin(u.ph+1.1+Math.PI))*amp*1.5-.05*walk],headX=0,aimY=0;
 if(u.crouch>.01){const k=u.crouch;rigY=lerp(rigY,-.3,k);legA=legA.map(a=>lerp(a,.95+a*.4,k));shA=shA.map(a=>lerp(a,-1.5+a*.3,k));rigX=lerp(rigX,.18,k)}
 if(st.air&&!st.climb){legA=[.55,-.15];shA=[-1.0,-.35];rigY=0}
 if(u.climb>.01){const k=u.climb,cs=Math.sin(u.ph);legA=legA.map((a,i)=>lerp(a,.6+(i?-cs:cs)*.5,k));shA=shA.map((a,i)=>lerp(a,-1.1+(i?cs:-cs)*.35,k));rigX=lerp(rigX,-.08,k);aimY=k}
 if(st.slide){rigY=-.48;rigX=.45;legA=[1.25,1.05];shA=[-.15,-.55]}
 if(u.down>.01){const k=u.down,cw=Math.sin(u.ph*.6)*walk;rigY=lerp(rigY,-.26,k);rigX=lerp(rigX,.6,k);legA=legA.map((a,i)=>lerp(a,.18+(i?-cw:cw)*.12,k));shA=shA.map((a,i)=>lerp(a,-2.68+(i?cw:-cw)*.1,k));headX=-.55*k;aimY=Math.max(aimY,.5*k)}// kneeling/crawling on the surface (head ~1.0-1.2 = downed hitbox)
 {const idle=(1-walk)*(1-u.crouch)*(1-u.down)*(st.air||st.slide||st.climb?0:1);if(idle>.01){u.it=(u.it||0)+dt;const w=Math.sin(u.it*.7);rigZ+=w*.03*idle;legA=legA.map((a,i)=>a+(i?(w>0?.08:0):(w<0?.08:0))*idle);shA=shA.map((a,i)=>a-(i?(w>0?.14:0):(w<0?.14:0))*idle);rigY+=-.012*Math.abs(w)*idle}
  if(u.torso){const br=1+Math.sin((u.it||0)*1.7)*.008*(1-run);u.torso.scale.set(1,br,1+ (br-1)*1.5)}}
 u.flinch=Math.max(0,u.flinch-dt*4);
 if(u.dead>0){u.dead+=dt;const k=Math.min(1,u.dead/.55);const e=k*k*(3-2*k);rigX=1.45*e;rigY=-.05*e;rigZ=u.roll*.25*e;legA=[.3*e,.1*e];shA=[-.2,-.3];u.tag.visible=false}
 else u.tag.visible=true;
 if(st.slope!=null&&u.down>.01)rigX+=st.slope*u.down;const r=u.rig;r.position.y+=(rigY-r.position.y)*k14;r.rotation.x+=((rigX+u.flinch*.35)-r.rotation.x)*Math.min(1,dt*(u.dead?8:12));r.rotation.z+=(rigZ-r.rotation.z)*k14;
 // aim: arms follow pitch; head stabilises against body tilt so the gun stays on target
 const pitch=u.dead?0:st.pitch;u.aim.rotation.x+=(lerp(pitch-r.rotation.x*.85,-.9,aimY*.6)-u.aim.rotation.x)*Math.min(1,dt*15);u.aim.position.y=1.36+(u.climb>.01?.05*u.climb:0);
 u.head.rotation.x+=((pitch*.6-r.rotation.x*.7+headX)-u.head.rotation.x)*k14;u.head.rotation.z=-r.rotation.z*.8;
 if(u.torso){u.torso.rotation.y=lerp(u.torso.rotation.y,s*.06*walk,k14)}
 for(let i=0;i<2;i++){const[th,sh]=u.legs[i];th.rotation.x+=(legA[i]-th.rotation.x)*k14;sh.rotation.x+=(shA[i]-sh.rotation.x)*k14}}
export {rbox};

setRbox(rbox);
