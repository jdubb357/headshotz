// HeadShotz characters v2: human proportions, detailed head/face, hair or headgear, layered tactical kit (shirt, plate carrier,
// pouches, belt, holster, knee pads, gloves, boots), class looks, smooth procedural animation (walk/run, crouch, climb, slide,
// jump, downed, death, aim). Each body section is ONE merged vertex-coloured PBR mesh (7 draws per character); small details live
// in a separate "detail" mesh per section that is hidden beyond ~28 m (cheap LOD). Geometry is cached per look+colours.
import {THREE,G,mergeParts,texMat} from './gfx.js';
const SKINS=[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac,0xd4a373];
const HAIR=[0x2b1d14,0x5a3825,0xb5813f,0x111111,0x8b4513,0xd8c08a];
function hash(s){let h=7;for(const c of String(s))h=h*31+c.charCodeAt(0)|0;return Math.abs(h)}
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
function limb(P,a,b,r1,r2,c,seg=10){_a.set(...a);_b.set(...b);const d=_b.clone().sub(_a),l=d.length();_q.setFromUnitVectors(_up,d.normalize());_m.compose(_a.clone().add(_b).multiplyScalar(.5),_q,new THREE.Vector3(1,1,1));P.push({g:G('cyl',r2,r1,l,seg),m:_m.clone(),c})}
const bx=(P,w,h,d,x,y,z,c,rx=0,ry=0,rz=0)=>P.push({g:G('box',w,h,d),p:[x,y,z],r:[rx,ry,rz],c});
const sp=(P,r,x,y,z,c,sx=1,sy=1,sz=1,seg=12)=>P.push({g:G('sph',r,seg,Math.max(6,seg*.66|0)),p:[x,y,z],s:[sx,sy,sz],c});
const cy=(P,r1,r2,h,x,y,z,c,seg=12,rx=0,rz=0)=>P.push({g:G('cyl',r1,r2,h,seg),p:[x,y,z],r:[rx,0,rz],c});
const GEO={};const MAT=()=>texMat('char');
function mk(key,f){if(!GEO[key]){const P=[];f(P);GEO[key]=P.length?mergeParts(P):null}return GEO[key]}
function sect(parent,key,main,detail){const g=new THREE.Group();const a=mk(key+'|m',main);if(a){const m=new THREE.Mesh(a,MAT());m.userData.tm='char';m.castShadow=true;g.add(m)}
 if(detail){const b=mk(key+'|d',detail);if(b){const d=new THREE.Mesh(b,MAT());d.userData.tm='char';d.userData.lod=1;g.add(d)}}parent.add(g);return g}
// class looks: colours + headgear + kit flags
export const LOOKS={
 soldier:{head:'helmet',vest:0x4b5344,pants:0x3b4034,shirtT:1},
 ninja:{head:'ninja',vest:0x15161a,pants:0x1b1c21,slim:1,shirt:0x202127,belt:0xa31515},
 juggernaut:{head:'jugg',vest:0x2f3338,pants:0x2a2d31,bulk:1,plates:1},
 medic:{head:'cap',vest:0xe9ecef,pants:0x46505a,cross:1,pack:1},
 scout:{head:'boonie',vest:0x6b5b3e,pants:0x5a5340,light:1,goggles:1},
 engineer:{head:'hardhat',vest:0xe67e22,pants:0x34495e,tools:1,pack:1}};
export function makeCharacter(teamCol,name,id,tagCol,outfit,cls){const h=hash(id);const skin=SKINS[h%SKINS.length],hair=HAIR[(h>>3)%HAIR.length];
 const L=LOOKS[cls]||LOOKS.soldier;const col=new THREE.Color(teamCol),dark=col.clone().multiplyScalar(.55).getHex();
 const shirt=L.shirt??(L.shirtT?teamCol:teamCol),vest=outfit?outfit[0]:L.vest,pants=outfit?outfit[1]:L.pants,boot=0x22201d,sole=0x0e0e0e,glove=0x2a2a2a,strap=0x26292b,pouch=new THREE.Color(vest).multiplyScalar(.82).getHex(),metal=0x6f747a;
 const bw=L.bulk?1.18:L.slim?.92:1;const K=[cls||'soldier',teamCol,skin,hair,vest,pants,outfit?1:0].join('|');
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
 // ---- torso (hips .92 .. shoulders 1.42) ----
 const torso=sect(rig,'T'+K,P=>{
  cy(P,.16*bw,.15*bw,.2,0,.98,0,pants,14);// hips
  cy(P,.17*bw,.15*bw,.42,0,1.2,0,shirt,14);// shirt torso (tapered)
  sp(P,.1*bw,-.2*bw,1.37,0,shirt,1,.85,1);sp(P,.1*bw,.2*bw,1.37,0,shirt,1,.85,1);// shoulders
  cy(P,.055,.06,.09,0,1.465,0,skin,10);// neck
  bx(P,.12,.05,.05,0,1.425,-.07,shirt);// collar
  if(!L.slim){bx(P,.36*bw,.34,.07,0,1.22,-.125*bw,vest);bx(P,.36*bw,.34,.06,0,1.22,.12*bw,vest);bx(P,.08,.3,.24*bw,-.18*bw,1.2,0,vest);bx(P,.08,.3,.24*bw,.18*bw,1.2,0,vest)}// plate carrier
  else{bx(P,.3,.05,.31,0,1.04,0,L.belt??strap)}
  bx(P,.37*bw,.055,.32*bw,0,1.02,0,L.belt??strap);// belt
  if(L.plates){bx(P,.4,.2,.09,0,1.34,-.16,vest);bx(P,.42,.22,.09,0,1.14,-.17,vest);sp(P,.13,-.24,1.4,0,vest,1.1,.7,1.1);sp(P,.13,.24,1.4,0,vest,1.1,.7,1.1)}
  if(L.pack){bx(P,.28,.36,.16,0,1.22,.2*bw,L.cross?0xd6d9dc:0x4a4f55);bx(P,.26,.05,.15,0,1.42,.2*bw,strap)}
 },P=>{const z=-.165*bw;
  if(!L.slim)for(const x of[-.11,0,.11]){bx(P,.085,.11,.05,x,1.13,z,pouch);bx(P,.088,.025,.055,x,1.19,z,new THREE.Color(pouch).multiplyScalar(.8).getHex())}
  if(!L.slim){bx(P,.12,.07,.03,.08,1.31,z+.005,pouch);bx(P,.05,.12,.05,-.2*bw,1.3,-.06,0x1d1f20);cy(P,.006,.006,.12,-.2*bw,1.42,-.06,0x111111,4)}// admin pouch, radio + antenna
  bx(P,.05,.04,.02,0,1.02,-.165*bw,0xb8a26a);// buckle
  for(const s of[-1,1])bx(P,.06,.025,.3*bw,s*.12,1.41,0,strap);// shoulder straps
  if(L.cross){bx(P,.1,.03,.01,0,1.3,z-.01,0xd63031);bx(P,.03,.1,.01,0,1.3,z-.01,0xd63031);bx(P,.09,.03,.01,0,1.3,.29*bw,0xd63031);bx(P,.03,.09,.01,0,1.3,.29*bw,0xd63031)}
  if(L.tools){bx(P,.08,.1,.05,.16,.97,-.12,0x8d6e63);bx(P,.02,.14,.02,.2,.95,-.13,metal);bx(P,.08,.1,.05,-.16,.97,-.12,0x8d6e63)}
  if(L.slim){bx(P,.36,.04,.02,0,1.25,-.15,0x2b2c33,0,0,.6);bx(P,.04,.3,.04,.0,1.25,.16,0x55575e,0,0,.6)}// ninja wrap + sword handle
 });
 // ---- head (pivot at neck 1.5) ----
 const head=new THREE.Group();head.position.set(0,1.5,0);rig.add(head);
 sect(head,'H'+K,P=>{
  sp(P,.115,0,.14,-.005,skin,.92,1.08,1,14);// cranium
  bx(P,.17,.08,.17,0,.04,-.025,skin);sp(P,.07,0,.035,-.07,skin,1.15,.8,.9,10);// jaw + chin
  sp(P,.025,-.112,.13,0,skin,.6,1.1,1,8);sp(P,.025,.112,.13,0,skin,.6,1.1,1,8);// ears
  const hd=L.head;
  if(hd==='helmet'||hd==='jugg'){sp(P,.142,0,.2,0,hd==='jugg'?0x3a3d42:teamCol,1,.78,1.08,14);bx(P,.29,.025,.3,0,.175,0,hd==='jugg'?0x2a2c30:dark)}
  else if(hd==='ninja'){sp(P,.125,0,.15,0,0x15161a,1,1.12,1.06,14);bx(P,.2,.05,.03,0,.17,-.118,skin)}
  else if(hd==='cap'){sp(P,.123,0,.2,0,0xe9ecef,1,.6,1.05,14);bx(P,.16,.015,.09,0,.18,-.15,0xd63031)}
  else if(hd==='boonie'){sp(P,.125,0,.2,0,0x6b5b3e,1,.65,1.05,14);cy(P,.2,.21,.02,0,.175,0,0x5c4f35,16)}
  else if(hd==='hardhat'){sp(P,.135,0,.2,0,0xf1c40f,1,.72,1.08,14);cy(P,.17,.17,.015,0,.17,-.01,0xf1c40f,16)}
  if(hd!=='ninja'&&hd!=='helmet'&&hd!=='jugg')sp(P,.118,0,.16,.012,hair,.97,.9,.98,12);// hair under headgear
 },P=>{const hd=L.head;const fz=-.112;
  if(hd!=='ninja'){sp(P,.017,0,.115,fz-.012,skin,.8,1,1.2,8);bx(P,.06,.012,.012,0,.058,fz+.008,0x9e5b4e)}// nose, mouth
  for(const s of[-1,1]){sp(P,.017,s*.042,.15,fz+.01,0xf5f5f5,1.2,.8,.5,8);sp(P,.009,s*.042,.15,fz+.002,0x3b2a1a,1,1,.5,6);if(hd!=='ninja')bx(P,.045,.01,.012,s*.042,.178,fz+.006,hair,0,0,s*-.12)}// eyes + brows
  if(hd==='helmet'){bx(P,.06,.05,.03,0,.25,-.15,0x222222);bx(P,.04,.03,.04,0,.24,-.17,0x111111);for(const s of[-1,1])bx(P,.012,.12,.012,s*.118,.09,-.02,strap)}// NVG mount + chin straps
  if(hd==='jugg'){bx(P,.22,.08,.03,0,.15,-.14,0x1a1a1a);bx(P,.2,.04,.025,0,.15,-.157,0x6fb7ff)}// visor
  if(hd==='cap'||hd==='boonie'){for(const s of[-1,1])cy(P,.035,.035,.025,s*.125,.13,0,0x222222,10,0,Math.PI/2);bx(P,.012,.012,.1,.12,.08,-.06,0x222222)}// headset + mic
  if(L.goggles)bx(P,.19,.04,.03,0,.24,-.12,0x2d3436);
 });
 // ---- aim group: arms + hands holding the gun ----
 const aim=new THREE.Group();aim.position.set(0,1.36,0);rig.add(aim);
 sect(aim,'A'+K,P=>{const ar=L.bulk?.07:.055;
  limb(P,[.2*bw,0,0],[.2,-.2,-.14],ar,ar*.9,shirt);limb(P,[.2,-.2,-.14],[.07,-.12,-.36],ar*.85,ar*.75,shirt);sp(P,ar*.9,.2,-.2,-.14,shirt);
  limb(P,[-.2*bw,0,0],[-.19,-.17,-.24],ar,ar*.9,shirt);limb(P,[-.19,-.17,-.24],[-.02,-.08,-.56],ar*.85,ar*.75,shirt);sp(P,ar*.9,-.19,-.17,-.24,shirt);
  sp(P,.045,.06,-.12,-.39,glove,1,1.1,1.3,10);sp(P,.045,-.01,-.08,-.58,glove,1,1,1.3,10);// gloved hands
 },P=>{if(!L.slim)for(const s of[-1,1])bx(P,.1,.06,.1,s*.2,-.06,-.03,L.plates?0x2f3338:new THREE.Color(shirt).multiplyScalar(.7).getHex());// shoulder pads / sleeve patches
  cy(P,.05,.05,.03,.07,-.13,-.33,glove,10,1.2);cy(P,.05,.05,.03,-.02,-.085,-.52,glove,10,1.2)});// glove cuffs
 const gunMount=new THREE.Group();gunMount.position.set(.055,-.085,-.4);aim.add(gunMount);
 // ---- legs ----
 const legs=[];for(const s of[-1,1]){const th=new THREE.Group();th.position.set(s*.095*bw,.92,0);rig.add(th);
  sect(th,'Lt'+s+K,P=>{limb(P,[0,0,0],[0,-.43,-.01],.085*bw,.07*bw,pants,12);sp(P,.07*bw,0,-.43,-.01,pants)},P=>{bx(P,.07,.1,.05,s*.065,-.2,-.03,pouch);if(s>0&&!L.slim){bx(P,.06,.17,.09,.08,-.13,-.02,0x1d1f20)}});// cargo pocket, thigh holster
  const sh=new THREE.Group();sh.position.set(0,-.44,-.01);th.add(sh);
  sect(sh,'Ls'+s+K,P=>{limb(P,[0,0,0],[0,-.38,.01],.068*bw,.055,pants,12);bx(P,.12,.1,.24,0,-.43,-.045,boot);bx(P,.125,.025,.255,0,-.47,-.045,sole);cy(P,.065,.07,.12,0,-.36,.005,boot,10)},
   P=>{bx(P,.11,.12,.05,0,-.02,-.065,L.slim?0x202127:0x3a3f45);for(let i=0;i<3;i++)bx(P,.07,.006,.01,0,-.39+i*.025,-.127,0x8a7f6a)});// knee pad, laces
  legs.push([th,sh])}
 // name tag
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 38px system-ui,sans-serif';x.textAlign='center';
 x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(tagCol??teamCol).getHexString();x.fillText(name,128,46);
 const tg=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false,transparent:true}));tg.scale.set(1.5,.375,1);tg.position.y=2.25;root.add(tg);
 const lod=[];root.traverse(o=>{if(o.userData&&o.userData.lod)lod.push(o)});
 root.userData={rig,head,aim,gunMount,legs,torso,tag:tg,ph:0,flinch:0,dead:0,roll:(h%2?1:-1),lod,lodOn:true,cls:cls||'soldier',crouch:0,climb:0,down:0,lean:0};return root}
const lerp=(a,b,k)=>a+(b-a)*k;
// st: {speed, air, slide, pitch, crouch, climb, down, dist}
export function animate(m,st,dt){const u=m.userData;const sp=Math.min(st.speed,10);
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
 if(u.down>.01){const k=u.down;rigY=lerp(rigY,-.62,k);rigX=lerp(rigX,1.2,k);legA=legA.map((a,i)=>lerp(a,.25+i*.15+Math.sin(u.ph*.5+i)*.08*walk,k));shA=shA.map(a=>lerp(a,-.35,k));headX=-.9*k}
 u.flinch=Math.max(0,u.flinch-dt*4);
 if(u.dead>0){u.dead+=dt;const k=Math.min(1,u.dead/.55);const e=k*k*(3-2*k);rigX=1.45*e;rigY=-.05*e;rigZ=u.roll*.25*e;legA=[.3*e,.1*e];shA=[-.2,-.3];u.tag.visible=false}
 else u.tag.visible=true;
 const r=u.rig;r.position.y+=(rigY-r.position.y)*k14;r.rotation.x+=((rigX+u.flinch*.35)-r.rotation.x)*Math.min(1,dt*(u.dead?8:12));r.rotation.z+=(rigZ-r.rotation.z)*k14;
 // aim: arms follow pitch; head stabilises against body tilt so the gun stays on target
 const pitch=u.dead?0:st.pitch;u.aim.rotation.x+=(lerp(pitch-r.rotation.x*.85,-.9,aimY*.6)-u.aim.rotation.x)*Math.min(1,dt*15);u.aim.position.y=1.36+(u.climb>.01?.05*u.climb:0);
 u.head.rotation.x+=((pitch*.6-r.rotation.x*.7+headX)-u.head.rotation.x)*k14;u.head.rotation.z=-r.rotation.z*.8;
 if(u.torso){u.torso.rotation.y=lerp(u.torso.rotation.y,s*.06*walk,k14)}
 for(let i=0;i<2;i++){const[th,sh]=u.legs[i];th.rotation.x+=(legA[i]-th.rotation.x)*k14;sh.rotation.x+=(shA[i]-sh.rotation.x)*k14}}
