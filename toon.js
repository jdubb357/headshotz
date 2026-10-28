// HeadShotz Royale toon characters: original stylized heroes (big head, big expressive eyes, mitten hands, chunky boots, smooth shading).
// One shared vertex-colour material, geometry cached per outfit/part, ~11 meshes per character, procedural skeletal animation
// (run/strafe/jump/aim/crouch/slide/climb/down/freefall/glide/chute/emotes) and a 2-bone IK for the two-handed weapon grip.
import {THREE,mergeParts,GQ} from './gfx.js';
const V3=THREE.Vector3;
export const OUTFITS=[
 {id:0,name:'Sunny Scout',top:0xff9a2e,acc:0xfff1c9,pants:0x3b4a6b,shoes:0x6b3b1f,glove:0xfff1c9,skin:0xf1c27d,hair:0x5a3825,hs:0,hat:'cap',hatc:0x2f6fdf,iris:0x3a7bd5,pack:'round',packc:0x2f6fdf,sleeve:1,rar:0},
 {id:1,name:'Blaze',top:0xe5333f,acc:0xffd23f,pants:0x232a3a,shoes:0x161616,glove:0x232a3a,skin:0xe0ac69,hair:0xf2c94c,hs:1,hat:'goggles',hatc:0xffd23f,iris:0x3e7d4a,pack:'box',packc:0x9a1f2a,sleeve:1,rar:1},
 {id:2,name:'Mint Pilot',top:0x2ec4b6,acc:0xffffff,pants:0x1d6b64,shoes:0xf2f2f2,glove:0xffffff,skin:0xffdbac,hair:0x7a3b1d,hs:2,hat:'none',hatc:0,iris:0x5b3a1e,pack:'wings',packc:0xffffff,sleeve:1,rar:1},
 {id:3,name:'Violet Vandal',top:0x8e44ff,acc:0xff4fa3,pants:0x2b1d4d,shoes:0xff4fa3,glove:0x2b1d4d,skin:0xc68642,hair:0xff4fa3,hs:3,hat:'none',hatc:0,iris:0x2a1a10,pack:'none',packc:0,sleeve:0,rar:2},
 {id:4,name:'Captain Cobalt',top:0x2f6fdf,acc:0xc9d6ee,pants:0x24324f,shoes:0x2a2f3a,glove:0xc9d6ee,skin:0x8d5524,hair:0x111111,hs:5,hat:'helmet',hatc:0xc9d6ee,iris:0x4a6fa5,pack:'tank',packc:0xc9d6ee,sleeve:1,rar:2},
 {id:5,name:'Lime Lancer',top:0x7ed957,acc:0x1b3a1b,pants:0x2d3b2d,shoes:0x1b3a1b,glove:0x1b3a1b,skin:0xd4a373,hair:0x111111,hs:7,hat:'band',hatc:0xffd23f,iris:0x2a1a10,pack:'quiver',packc:0x6b4226,sleeve:0,rar:2},
 {id:6,name:'Golden Glimmer',top:0xffd23f,acc:0xffffff,pants:0xf2f2f2,shoes:0xb8860b,glove:0xffffff,skin:0xa86b45,hair:0x2b1d14,hs:4,hat:'crown',hatc:0xffd23f,iris:0x5b3a1e,pack:'cape',packc:0xffffff,sleeve:1,rar:3},
 {id:7,name:'Night Owl',top:0x3a3f52,acc:0xffd23f,pants:0x20232e,shoes:0xffd23f,glove:0x20232e,skin:0xf1c27d,hair:0x20232e,hs:0,hat:'hood',hatc:0x3a3f52,iris:0xffd23f,pack:'wings2',packc:0x2a2d3a,sleeve:1,rar:4}];
const RARN=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];export {RARN};
let MAT=null;const mat=()=>{if(MAT)return MAT;MAT=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.02,envMapIntensity:.7});
 // stylized look: warm fresnel rim light + soft sky-bounce tint on downward normals (cheap toon-ish shading, no extra passes)
 MAT.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  {float fr=pow(1.0-saturate(dot(normalize(normal),normalize(vViewPosition))),3.2);totalEmissiveRadiance+=vec3(1.0,.93,.8)*fr*.3;totalEmissiveRadiance+=vec3(.07,.1,.16)*saturate(-normal.y)*.35;}`)};
 return MAT};
const GC={};const cap=(r,l,s=1)=>{const k='c'+r+'|'+l+'|'+GQ.level;return GC[k]||(GC[k]=new THREE.CapsuleGeometry(r,l,GQ.level==='low'?3:4,GQ.level==='low'?8:12))};
const sph=(r=1)=>{const k='s'+GQ.level;return GC[k]||(GC[k]=new THREE.SphereGeometry(1,GQ.level==='low'?10:16,GQ.level==='low'?8:12))};
const sphLo=()=>GC.sl||(GC.sl=new THREE.SphereGeometry(1,8,6));
const cone=()=>GC.cn||(GC.cn=new THREE.ConeGeometry(1,1,7));
const cyl=()=>GC.cy||(GC.cy=new THREE.CylinderGeometry(1,1,1,12));
const box=()=>GC.bx||(GC.bx=new THREE.BoxGeometry(1,1,1));
const tor=(r,t,a)=>{const k='t'+r+'|'+t+'|'+a;return GC[k]||(GC[k]=new THREE.TorusGeometry(r,t,6,14,a))};
const shell=(from,to)=>{const k='h'+from+'|'+to+'|'+GQ.level;return GC[k]||(GC[k]=new THREE.SphereGeometry(1,GQ.level==='low'?10:16,GQ.level==='low'?5:9,0,Math.PI*2,from,to-from))};
const part=(P,g,c,p,s,r)=>P.push({g,c,p,s,r,ao:false});
const S=(P,c,p,s,r)=>part(P,sph(),c,p,s,r);
const mix=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
function hairParts(P,o){const hc=o.hair,hy=1.55;const capG=shell(0,Math.PI*.62);
 const capH=(sc=1)=>part(P,capG,hc,[0,hy+.02,.03],[.292*sc,.285*sc,.30*sc],[-.38,0,0]);
 switch(o.hs){
 case 0:capH();S(P,hc,[0,hy+.17,-.12],[.2,.1,.14]);break;// short + fringe tuft
 case 1:capH();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rr=i<7?.14:0;part(P,cone(),hc,[Math.cos(a)*rr,hy+.28+(i>=7?.06:0),Math.sin(a)*rr*.9+.02],[.075,.24,.075],[Math.sin(a)*.55,0,-Math.cos(a)*.55])}break;
 case 2:capH();S(P,hc,[0,hy+.03,.3],[.1,.1,.1]);part(P,cap(.07,.3),hc,[0,hy-.2,.38],[1,1,1],[.25,0,0]);S(P,o.acc,[0,hy+.02,.3],[.05,.05,.05]);break;
 case 3:capH(.97);for(let i=0;i<6;i++)part(P,cone(),hc,[0,hy+.25-Math.abs(i-2.5)*.02,-.17+i*.1],[.07,.28-Math.abs(i-2.5)*.02,.07],[(i-2.5)*.08,0,0]);break;
 case 4:capH();S(P,hc,[0,hy+.33,.02],[.14,.14,.14]);break;
 case 7:capH();part(P,cap(.13,.34),hc,[0,hy-.12,.22],[1.2,1,.8],[.1,0,0]);break;
 default:break}
 if(o.hs>=0){for(const s of[-1,1])S(P,hc,[s*.245,hy-.02,-.09],[.03,.09,.05]);part(P,shell(Math.PI*.35,Math.PI*.75),hc,[0,hy+.0,.05],[.285,.27,.29],[.5,0,0])}}
function headParts(P,o){const hy=1.55,sk=o.skin;
 part(P,sph(),sk,[0,hy,0],[.27,.255,.26]);
 for(const s of[-1,1]){S(P,sk,[s*.265,hy-.01,.01],[.05,.07,.04]);S(P,mix(sk,0xaa5544,.35),[s*.278,hy-.01,.0],[.022,.045,.022]);S(P,mix(sk,0xff6677,.35),[s*.15,hy-.07,-.205],[.055,.035,.02]);// ears, cheeks
  part(P,cap(.02,.075),mix(o.hair,0x000000,.2),[s*.1,hy+.125,-.234],[1,1,.8],[0,0,Math.PI/2+s*.2]);// brows
 }
 S(P,mix(sk,0x7a3a2a,.18),[0,hy-.045,-.262],[.03,.026,.03]);// nose
 part(P,tor(.055,.007,Math.PI),0x3a1616,[0,hy-.112,-.249],[1,1,.8],[0,0,Math.PI]);// smile line
 S(P,mix(sk,0xa83f45,.62),[0,hy-.106,-.252],[.046,.013,.016]);S(P,mix(sk,0xc24f55,.55),[0,hy-.125,-.249],[.04,.015,.017]);// lips
 S(P,0xf4f1ee,[0,hy-.117,-.258],[.03,.006,.006]);// teeth
 part(P,cap(.02,.05),mix(sk,0x7a3a2a,.08),[0,hy+.0,-.24],[1,1,.9],[.3,0,0]);// nose bridge
 switch(o.hat){
 case 'cap':part(P,shell(0,Math.PI*.55),o.hatc,[0,hy+.04,.01],[.3,.28,.3],[-.2,0,0]);part(P,cyl(),o.hatc,[0,hy+.1,-.31],[.2,.015,.17],[.12,0,0]);S(P,o.acc,[0,hy+.3,.0],[.04,.04,.04]);break;
 case 'goggles':part(P,tor(.27,.03,Math.PI*1.1),0x20232e,[0,hy+.08,0],[1,1,1],[Math.PI/2-.2,0,Math.PI*-.05]);for(const s of[-1,1])part(P,cyl(),o.hatc,[s*.11,hy+.2,-.2],[.09,.03,.09],[Math.PI/2-.4,0,0]);break;
 case 'helmet':part(P,shell(0,Math.PI*.7),o.hatc,[0,hy+.02,.0],[.31,.3,.31],[-.12,0,0]);part(P,cyl(),0x10253f,[0,hy+.02,-.2],[.26,.065,.2],[Math.PI/2,0,0]).g;part(P,cone(),0xe5333f,[.3,hy+.03,0],[.04,.16,.04],[0,0,-Math.PI/2]);part(P,cone(),0xe5333f,[-.3,hy+.03,0],[.04,.16,.04],[0,0,Math.PI/2]);break;
 case 'band':part(P,tor(.272,.025,Math.PI*2),o.hatc,[0,hy+.1,0],[1,1,.98],[Math.PI/2,0,0]);part(P,cap(.03,.2),o.hatc,[.1,hy+.1,.27],[1,1,1],[.5,0,.4]);break;
 case 'crown':for(let i=0;i<5;i++){const a=(i/5-.4)*Math.PI;part(P,cone(),o.hatc,[Math.sin(a)*.2,hy+.31,Math.cos(a)*.2-.02],[.05,.14,.05])}part(P,tor(.2,.03,Math.PI*2),o.hatc,[0,hy+.27,-.0],[1,1,1],[Math.PI/2,0,0]);S(P,0xe5333f,[0,hy+.3,-.2],[.03,.03,.03]);break;
 case 'hood':part(P,shell(0,Math.PI*.8),o.hatc,[0,hy+.0,.11],[.31,.32,.3],[-.25,0,0]);part(P,tor(.2,.045,Math.PI*1.5),o.hatc,[0,hy-.01,-.2],[1,1.1,.5],[0,0,Math.PI*.75]);hairParts(P,{...o,hs:-1});break}
 if(o.hat!=='hood'&&o.hat!=='helmet')hairParts(P,o)}
function bodyParts(P,o){const t=o.top,a=o.acc;
 part(P,cap(.2,.3),t,[0,1.02,0],[1.3,1.02,.95]);// torso
 part(P,cap(.205,.04),o.pants,[0,.84,0],[1.1,.8,.85]);// hips
 part(P,cyl(),a,[0,.9,0],[.235,.03,.185]);// belt
 part(P,cyl(),o.skin,[0,1.31,0],[.08,.07,.08]);// neck
 for(const s of[-1,1])part(P,box(),mix(t,0x000000,.22),[s*.105,.95,-.172],[.1,.085,.02]);// chest pockets
 S(P,0xd9c27a,[0,.9,-.185],[.04,.03,.012]);// buckle
 S(P,a,[0,1.12,-.17],[.06,.06,.02]);// chest emblem
 part(P,tor(.12,.035,Math.PI*2),mix(t,0xffffff,.15),[0,1.28,0],[1,1,.8],[Math.PI/2,0,0]);// collar
 switch(o.pack){
 case'round':part(P,cap(.14,.14),o.packc,[0,1.06,.24],[1,1,.7]);break;
 case'box':part(P,box(),o.packc,[0,1.06,.26],[.3,.36,.16]);part(P,box(),a,[0,1.2,.35],[.22,.06,.03]);break;
 case'wings':for(const s of[-1,1]){part(P,cap(.06,.4),o.packc,[s*.2,1.12,.27],[1,1,.35],[0,0,s*-.6]);part(P,cap(.05,.3),a,[s*.3,.98,.29],[1,1,.3],[0,0,s*-.9])}part(P,cap(.1,.1),o.packc,[0,1.06,.22],[1,1,.8]);break;
 case'tank':part(P,cap(.07,.34),o.packc,[-.1,1.06,.26]);part(P,cap(.07,.34),o.packc,[.1,1.06,.26]);part(P,cyl(),0xe5333f,[0,1.2,.22],[.22,.04,.08],[0,0,Math.PI/2]);break;
 case'quiver':part(P,cap(.05,.5),o.packc,[.08,1.1,.25],[1,1,1],[0,0,.35]);for(let i=0;i<3;i++)part(P,cone(),a,[.1+i*.03,1.5-i*.02,.26],[.03,.12,.03],[0,0,.35]);break;
 case'cape':part(P,box(),o.packc,[0,.98,.2],[.46,.74,.04],[.12,0,0]);part(P,cyl(),0xe5333f,[0,1.3,.02],[.24,.02,.2]);break;
 case'wings2':for(const s of[-1,1])part(P,cap(.05,.5),o.packc,[s*.26,1.1,.27],[1,1,.3],[0,0,s*-.45]);part(P,cap(.1,.2),a,[0,1.05,.24],[1,1,.6]);break}
 if(o.hat==='hood')part(P,cone(),o.hatc,[0,1.2,.19],[.12,.18,.06],[Math.PI,0,0]);
}
function armParts(P,o,s,seg){// seg 0 upper, 1 fore (mitten is a separate mesh so it can hide when a gun's own hands take over)
 const sl=o.sleeve;if(seg===0){part(P,cap(.075,.2),o.top,[0,-.15,0]);S(P,o.top,[0,0,0],[.09,.09,.09]);part(P,tor(.07,.012,Math.PI*2),o.acc,[0,-.06,0],[1,1,1],[Math.PI/2,0,0])}
 else{part(P,cap(.066,.17),sl?o.top:o.skin,[0,-.15,0]);part(P,tor(.067,.016,Math.PI*2),o.acc,[0,-.23,0],[1,1,1],[Math.PI/2,0,0])}}
function mittParts(P,o){S(P,o.glove,[0,-.325,-.01],[.085,.08,.09]);S(P,o.glove,[0,-.295,-.075],[.035,.04,.04])}
function legParts(P,o,seg){
 if(seg===0){part(P,cap(.11,.2),o.pants,[0,-.19,0]);S(P,o.pants,[0,0,0],[.115,.115,.115])}
 else{part(P,cap(.08,.15),o.pants,[0,-.15,0]);S(P,o.pants,[0,0,0],[.085,.085,.085]);S(P,mix(o.pants,0x000000,.2),[0,-.02,-.075],[.085,.075,.04]);part(P,cap(.095,.1),o.shoes,[0,-.37,-.045],[1,1,1.7],[Math.PI/2,0,0]);part(P,box(),0xeeeeee,[0,-.335,-.1],[.09,.012,.1]);part(P,box(),0xeeeeee,[0,-.35,-.12],[.09,.012,.1]);part(P,box(),mix(o.shoes,0xffffff,.55),[0,-.445,-.04],[.19,.03,.34])}}
function eyeParts(P,o){for(const s of[-1,1]){const x=s*.095,y=1.555,z=-.225;
 part(P,sph(),0xf4f1ee,[x,y,z],[.078,.098,.04]);part(P,sph(),mix(o.iris,0x000000,.6),[x,y-.005,z-.0235],[.06,.075,.018]);part(P,sph(),o.iris,[x,y-.005,z-.026],[.052,.067,.02]);part(P,sphLo(),mix(o.iris,0xffffff,.45),[x,y-.032,z-.034],[.034,.026,.01]);part(P,sph(),0x101018,[x,y-.005,z-.037],[.028,.038,.012]);part(P,sphLo(),0xffffff,[x+s*-.017,y+.026,z-.046],[.014,.014,.01]);part(P,sphLo(),0xffffff,[x+s*.02,y-.025,z-.044],[.007,.007,.006]);
  part(P,tor(.074,.009,Math.PI),0x15101a,[x,y+.012,z-.038],[1,1.05,.5],[0,0,0])}}
const MK={};function geo(o,key,f){const k=o.id+'|'+key+'|'+GQ.level;if(MK[k])return MK[k];const P=[];f(P);const g=mergeParts(P);g.computeBoundingSphere();return MK[k]=g}
const lerp=(a,b,t)=>a+(b-a)*t;
function mesh(g){const m=new THREE.Mesh(g,mat());m.castShadow=true;return m}
function ik(root,sh,el,hand,tx,ty,tz,l1,l2,pole){// 2-bone IK in the parent space of `sh`; rotates sh (upper) and el (fore)
 const d=Math.hypot(tx-sh.position.x,ty-sh.position.y,tz-sh.position.z);const dd=Math.min(Math.max(d,.05),l1+l2-.005);
 const a1=Math.acos(Math.max(-1,Math.min(1,(l1*l1+dd*dd-l2*l2)/(2*l1*dd)))),a2=Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-dd*dd)/(2*l1*l2))));
 const dir=new V3(tx-sh.position.x,ty-sh.position.y,tz-sh.position.z).normalize();
 // basis: arm hangs along -Y; build quaternion taking -Y to dir, then bend about the pole axis
 const down=new V3(0,-1,0),q=new THREE.Quaternion().setFromUnitVectors(down,dir);
 const pAxis=new V3().crossVectors(dir,pole).normalize();const qb=new THREE.Quaternion().setFromAxisAngle(pAxis,a1);// swing upper off the line toward the pole
 sh.quaternion.copy(qb).multiply(q);
 el.quaternion.setFromAxisAngle(new V3(1,0,0),0);const bend=Math.PI-a2;
 // elbow bends in the plane defined by upper-arm dir & pole: express as rotation about the sh-local axis perpendicular to that plane
 const loc=pAxis.clone().applyQuaternion(sh.quaternion.clone().invert());el.quaternion.setFromAxisAngle(loc,-bend)}
export function makeToon(teamCol,name,id,tagCol,outfitIdx,opt={}){
 const h=Math.abs([...String(id)].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7));const oi=outfitIdx!=null?outfitIdx:h%OUTFITS.length;const o=OUTFITS[((oi%OUTFITS.length)+OUTFITS.length)%OUTFITS.length];
 const root=new THREE.Group();const rig=new THREE.Group();root.add(rig);
 const hips=new THREE.Group();hips.position.y=.78;rig.add(hips);
 const torso=new THREE.Group();hips.add(torso);const T=mesh(geo(o,'body',P=>bodyParts(P,o)));T.position.y=-.78;torso.add(T);
 const headG=new THREE.Group();headG.position.set(0,1.38-.78,0);headG.scale.setScalar(.93);torso.add(headG);const Hm=mesh(geo(o,'head',P=>headParts(P,o)));Hm.position.set(0,-1.38,0);headG.add(Hm);
 const eyes=mesh(geo(o,'eyes',P=>eyeParts(P,o)));eyes.position.set(0,-1.38,0);eyes.castShadow=false;headG.add(eyes);
 const mk=(seg,fn,pos,par)=>{const g=new THREE.Group();g.position.set(...pos);par.add(g);if(fn){const m=mesh(geo(o,fn[0],fn[1]));g.add(m)}return g};
 const arm=[],fore=[],leg=[],shin=[],handM=[];
 for(const s of[-1,1]){const i=s<0?0:1;const a=mk(0,['au'+s,P=>armParts(P,o,s,0)],[s*.285,1.24-.78,0],torso);const f=mk(0,['af'+s,P=>armParts(P,o,s,1)],[0,-.29,0],a);const hm=mesh(geo(o,'mit'+s,P=>mittParts(P,o)));f.add(hm);handM[i]=hm;arm[i]=a;fore[i]=f;
  const l=mk(0,['lt'+s,P=>legParts(P,o,0)],[s*.115,0,0],hips);const sh=mk(0,['ls'+s,P=>legParts(P,o,1)],[0,-.4,0],l);leg[i]=l;shin[i]=sh}
 // weapon mount in torso space (aim group pitches with the camera)
 const aim=new THREE.Group();aim.position.set(0,1.3-.78,0);torso.add(aim);const gunMount=new THREE.Group();gunMount.position.set(.1,-.12,-.3);aim.add(gunMount);
 const gR=new THREE.Object3D();gR.position.set(.11,-.12,-.3);aim.add(gR);const gL=new THREE.Object3D();gL.position.set(-.04,-.1,-.62);aim.add(gL);
 // name tag
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 38px system-ui,sans-serif';x.textAlign='center';x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(tagCol??teamCol).getHexString();x.fillText(name,128,46);
 const tg=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false,transparent:true}));tg.scale.set(1.5,.375,1);tg.position.y=2.25;root.add(tg);
 if(opt.noTag)tg.visible=false;
 if(opt.outline){const om=new THREE.MeshBasicMaterial({color:0x10141f,side:THREE.BackSide});root.traverse(c=>{if(c.isMesh&&c!==eyes){const m=new THREE.Mesh(c.geometry,om);m.scale.setScalar(1.05);c.add(m)}})}
 root.userData={kind:'toon',anim:animToon,rig,hips,torso,headG,eyes,arm,fore,handM,leg,shin,aim,gunMount,gR,gL,tag:tg,ph:0,flinch:0,dead:0,roll:(h%2?1:-1),lod:[],far:[],lodOn:true,cls:'soldier',crouch:0,climb:0,down:0,lean:0,outfit:o,blinkT:2+(h%30)/10,mood:0,J:{}};
 root.userData.args=[teamCol,name,id,tagCol,oi];return root}

// ---- gun grip solver: the gun group carries its own gloved hands (fingers wrapped on the grip, trigger finger on the trigger, support hand on the handguard).
// We place the gun per class (stock at the shoulder / extended pistol / blade at the hip...), then 2-bone IK both arms onto the gun's wrist points.
const sstep=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_p=new V3(),_w=new V3();
export function gunKind(info){if(info.fists)return'fists';if(info.util)return'util';if(info.hold==='knife'||info.hold==='axe')return'blade';if(info.hold==='katana')return'katana';if(info.pistol)return'pistol';if(info.hold==='launcher')return'rpg';return'long'}
function solveGun(u,st,dt,run,sw){
 const gun=u.gunMount.children[0];if(!gun)return null;const info=gun.userData.info,wr=gun.userData.wr;if(!info||!wr||!wr.R)return null;
 const kind=gunKind(info),zr=gun.userData.zr||.2;
 if(u.gunSeen!==gun){u.gunSeen=gun;u.swT=1}u.swT=Math.max(0,(u.swT||0)-dt*3.2);
 if(st.shot)u.kk=1;u.kk=(u.kk||0)*Math.exp(-dt*11);
 const ads=u.adsS=lerp(u.adsS||0,st.ads||0,Math.min(1,dt*10));const rl=st.reload>0?st.reload:0;
 const bump=sstep(0,.22,rl)*(1-sstep(.72,.95,rl)),tilt=sstep(0,.2,rl)*(1-sstep(.8,1,rl));
 const bob=Math.sin(u.it*1.9)*.004+Math.abs(Math.sin(u.ph))*.016*run,sway=Math.cos(u.ph)*.01*run;
 const O=new V3(),E=new THREE.Euler(0,0,0,'YXZ');const wR=new V3(...wr.R.w);const dL=wr.L?zr-wr.L.w[2]:.3;const GS=(kind==='long'||kind==='rpg')?Math.max(.95,Math.min(1.6,.6/dL)):1.6;
 if(kind==='long'||kind==='rpg'){const rp=kind==='rpg';O.set(rp?.28:lerp(.21,.15,ads),rp?.1:lerp(-.15,-.04,ads),-.09-GS*zr+(rp?.12:0));E.set(rp?.05:0,0,0)}
 else if(kind==='pistol'){_p.set(lerp(.12,.07,ads),lerp(-.0,.03,ads),-.4);O.copy(_p).sub(wR.clone().multiplyScalar(GS))}
 else if(kind==='blade'){_p.set(.32,-.32,-.36);E.set(.75,-.15,0);O.copy(_p).sub(wR.clone().multiplyScalar(GS).applyEuler(E))}
 else if(kind==='katana'){_p.set(.22,-.24,-.4);E.set(.95,-.1,0);O.copy(_p).sub(wR.clone().multiplyScalar(GS).applyEuler(E))}
 else if(kind==='util'){_p.set(.3,-.12,-.42);O.copy(_p).sub(wR.clone().multiplyScalar(GS))}
 else{_p.set(.17,-.12,-.38);O.copy(_p).sub(wR.clone().multiplyScalar(GS))}// fists
 E.x+=.1*u.kk*(kind==='long'||kind==='pistol'||kind==='rpg'?1:0)-tilt*.45*(kind==='long'||kind==='pistol'?1:.3)-u.swT*.9;E.z+=tilt*.35;E.y+=tilt*.2;
 O.z+=.07*u.kk;O.y+=bob-u.swT*.28-tilt*.04;O.x+=sway;
 // left hand to the mag during reload (hand mesh lives in the 'lh' sub-group)
 const G=gun.userData.G||{},lh=G.lh;let ld=null;
 if(lh&&wr.L){if(!lh.userData.b0)lh.userData.b0=lh.position.clone();const mc=G.mag&&G.mag.userData.c?G.mag.userData.c:new V3(0,-.05,.02);const lc=new V3(...wr.L.w);ld=mc.clone().add(new V3(0,-.045,.02)).sub(lc).multiplyScalar(bump);lh.position.copy(lh.userData.b0).add(ld)}
 const gm=u.gunMount;gm.position.copy(O);gm.quaternion.setFromEuler(E);gm.scale.set(GS,GS,GS);gm.updateMatrix();
 const out={R:new V3(...wr.R.w).applyMatrix4(gm.matrix)};if(wr.L){out.L=new V3(...wr.L.w);if(ld)out.L.add(ld);out.L.applyMatrix4(gm.matrix)}
 // reach: if a hand is too far from its shoulder, slide the whole gun back toward the body
 const shR=new V3(.285,-.06,0),shL=new V3(-.285,-.06,0);let over=Math.max(out.R.distanceTo(shR),out.L?out.L.distanceTo(shL):0)-.585;
 if(over>0&&kind!=='pistol'){gm.position.z+=over;gm.updateMatrix();out.R.z+=over;if(out.L)out.L.z+=over}
 return out}
const AX=new V3(1,0,0);
// st: speed, air, slide, pitch, climb, down, slope, dist, crouch, lx/lz (local move dir), pose ('fall'|'glide'|'chute'|'bus'), emote(string)|null, aim(bool), hold(bool: gun raised)
export function animToon(m,st,dt){const u=m.userData;const sp=Math.min(st.speed||0,11);
 const k8=Math.min(1,dt*8),k14=Math.min(1,dt*14),k6=Math.min(1,dt*6);
 u.crouch=lerp(u.crouch,st.crouch?1:0,k8);u.climb=lerp(u.climb,st.climb?1:0,k8);u.down=lerp(u.down,st.down?1:0,Math.min(1,dt*5));
 const pose=st.pose||null;u.pz=u.pz||{fall:0,glide:0,chute:0,bus:0,emote:0};for(const k in u.pz)u.pz[k]=lerp(u.pz[k],(pose===k||(k==='emote'&&st.emote&&!pose))?1:0,k6);
 const run=Math.min(1,sp/7.5),walk=Math.min(1,sp/2),air=st.air&&!st.climb;
 u.ph+=dt*(st.climb?7:(2+sp*1.05));const s=Math.sin(u.ph),c=Math.cos(u.ph);
 // local move dir (forward = -z). lz<0 forward, lz>0 backward, lx sideways
 const lx=st.lx||0,lz=st.lz==null?-1:st.lz;const fwd=-lz;const sideAmt=Math.abs(lx);
 const amp=(.3+.5*run)*walk;let hipsY=Math.abs(s)*.045*walk-0;
 let thL=s*amp*fwd+Math.abs(s)*0,thR=-s*amp*fwd;let shL=-Math.max(0,Math.sin(u.ph+1.1))*amp*1.3,shR=-Math.max(0,Math.sin(u.ph+1.1+Math.PI))*amp*1.3;
 let splay=[sideAmt*.12*walk,-sideAmt*.12*walk];
 // strafing: legs cross over
 if(sideAmt>.3){thL=s*amp*.9*(fwd>=0?1:-1)*(.4+(1-sideAmt)*.6);thR=-thL}
 let tX=-run*.16*(fwd>=0?1:-.3),tZ=-lx*run*.06+c*.025*walk,tY=0;
 let armPose=st.relax?'idle':'hold',hx=0;
 if(u.crouch>.01){const k=u.crouch;hipsY=lerp(hipsY,-.32,k);thL=lerp(thL,.95+thL*.4,k);thR=lerp(thR,.95+thR*.4,k);shL=lerp(shL,-1.5,k);shR=lerp(shR,-1.5,k);tX=lerp(tX,.2,k)}
 if(air){thL=.5;thR=-.2;shL=-.9;shR=-.3;hipsY=0}
 if(st.slide){hipsY=-.5;tX=.5;thL=1.3;thR=1.1;shL=-.1;shR=-.5}
 if(u.climb>.01){const k=u.climb,cs=Math.sin(u.ph);thL=lerp(thL,.6+cs*.5,k);thR=lerp(thR,.6-cs*.5,k);shL=lerp(shL,-1.1+cs*.3,k);shR=lerp(shR,-1.1-cs*.3,k);armPose=k>.5?'climb':armPose}
 // idle breathing
 const idle=(1-walk)*(1-u.crouch)*(air||st.slide?0:1);u.it=(u.it||0)+dt;const br=Math.sin(u.it*1.9)*.012*idle;
 u.flinch=Math.max(0,u.flinch-dt*4);
 let rigRoll=0,rigPitch=0,rigY=0;
 // freefall (belly-down spread eagle), glide (arms up on the handle, legs trailing), chute, bus (sit-ready)
 const pz=u.pz;
 if(pz.fall>.01){const k=pz.fall,w1=Math.sin(u.it*13)*.05;rigRoll=lerp(rigRoll,-(st.bank||0)*.45,k);rigPitch=lerp(rigPitch,-1.35,k);tX=lerp(tX,0,k);thL=lerp(thL,-.5+w1,k);thR=lerp(thR,-.5-w1,k);shL=lerp(shL,.5,k);shR=lerp(shR,.5,k);armPose=k>.5?'fall':armPose;rigY=lerp(rigY,0,k);hipsY=lerp(hipsY,0,k)}
 if(pz.glide>.01){const k=pz.glide;rigPitch=lerp(rigPitch,-.18+(st.bank||0)*0,k);rigRoll=lerp(rigRoll,-(st.bank||0)*.5,k);thL=lerp(thL,.15,k);thR=lerp(thR,.05,k);shL=lerp(shL,-.5,k);shR=lerp(shR,-.4,k);armPose=k>.5?'glide':armPose}
 if(pz.chute>.01){const k=pz.chute;thL=lerp(thL,.1+Math.sin(u.it*1.7)*.05,k);thR=lerp(thR,-.05,k);shL=lerp(shL,-.25,k);shR=lerp(shR,-.2,k);armPose=k>.5?'glide':armPose;rigRoll=lerp(rigRoll,Math.sin(u.it*1.3)*.05,k)}
 if(pz.bus>.01){armPose=pz.bus>.5?'bus':armPose}
 if(u.down>.01){const k=u.down;hipsY=lerp(hipsY,-.55,k);tX=lerp(tX,.65,k);thL=lerp(thL,.2,k);thR=lerp(thR,.1,k);shL=lerp(shL,-2.2,k);shR=lerp(shR,-2.2,k);armPose=k>.5?'down':armPose}
 let emo=null;if(st.emote&&!pose&&!air){emo=EMO[st.emote]||EMO.wave;u.et=(u.et||0)+dt}else u.et=0;
 if(u.dead>0){u.dead+=dt;const k=Math.min(1,u.dead/.55),e=k*k*(3-2*k);rigPitch=1.45*e;rigY=-.2*e;rigRoll=u.roll*.25*e;thL=.3*e;thR=.1*e;shL=-.2;shR=-.3;armPose='limp';u.tag.visible=false}else u.tag.visible=!(st.noTag);
 // apply
 const J=u.J;const sm=(n,v,k=k14)=>{J[n]=J[n]==null?v:J[n]+(v-J[n])*k;return J[n]};
 u.hips.position.y=sm('hy',.78+hipsY+br,k14);
 u.rig.rotation.x=sm('rx',rigPitch+u.flinch*.35,Math.min(1,dt*(u.dead?8:12)));u.rig.rotation.z=sm('rz',rigRoll);{const rx=u.rig.rotation.x;u.rig.position.y=sm('ry',rigY)+.78*(1-Math.cos(rx));u.rig.position.z=-.78*Math.sin(rx)}
 u.torso.rotation.x=sm('tx',tX+(1-pz.fall)*0);u.torso.rotation.z=sm('tz',tZ);
 for(let i=0;i<2;i++){const sd=i?1:-1;u.leg[i].rotation.x=sm('l'+i,i?thR:thL);u.leg[i].rotation.z=sm('lz'+i,splay[i]*sd*-1);u.shin[i].rotation.x=sm('s'+i,i?shR:shL)}
 // head follows pitch a bit
 const pitch=u.dead?0:(st.pitch||0);u.aim.rotation.x+=(pitch*(pz.fall>.5||pz.glide>.5?0:1)-u.aim.rotation.x)*Math.min(1,dt*15);
 u.headG.rotation.x=sm('hx',(pz.fall>.5?.9:pitch*.5)-u.rig.rotation.x*.2-u.torso.rotation.x*.5);u.headG.rotation.y=sm('hy2',emo&&emo.head?emo.head(u.et):0);
 // blink
 u.blinkT-=dt;let bl=1;if(u.blinkT<0){const t=-u.blinkT;bl=t<.12?1-Math.sin(t/.12*Math.PI)*.92:1;if(t>.12)u.blinkT=2+Math.random()*3.5}u.eyes.scale.y=bl;u.eyes.position.y=-1.38+1.555*(1-bl);
 // arms
 const hold=st.hold!==false&&armPose==='hold';
 const gp=(armPose==='hold'&&!emo)?solveGun(u,st,dt,run,0):null;
 for(let i=0;i<u.handM.length;i++)u.handM[i].visible=!(gp&&(i===1||gp.L));
 for(let i=0;i<2;i++){const A=u.arm[i],F=u.fore[i],sd=i?1:-1;
  if(armPose==='hold'&&!emo){const gt=gp&&(i?gp.R:(gp.L||new V3(-.3,-.5,-.12)));const t=i?u.gR:u.gL;const q=new V3();
   if(gt)q.copy(gt);else q.set(t.position.x,t.position.y,t.position.z);q.applyAxisAngle(AX,u.aim.rotation.x).add(u.aim.position);
   ik(u.torso,A,F,null,q.x,q.y,q.z,.29,.31,new V3(sd*.8,-.6,.2).normalize());A.rotation.z+=0;
   const sw=idle>.01&&!gt?Math.sin(u.it*1.9)*.02:0;A.rotation.x+=sw}
  else if(armPose==='climb'){A.rotation.set(-2.5+(i?Math.cos(u.ph):-Math.cos(u.ph))*.5,0,sd*.2);F.rotation.set(-.5,0,0)}
  else if(armPose==='fall'){A.rotation.set(-.3,0,sd*-1.05);A.rotation.order='ZXY';F.rotation.set(-.2,0,0)}
  else if(armPose==='glide'){A.rotation.set(-2.7,0,sd*.25);F.rotation.set(-.15,0,0)}
  else if(armPose==='bus'){A.rotation.set(-.4,0,sd*.1);F.rotation.set(-1,0,0)}
  else if(armPose==='down'){A.rotation.set(-2.0,0,sd*.3);F.rotation.set(-.5,0,0)}
  else if(armPose==='limp'){A.rotation.set(.2,0,sd*.3);F.rotation.set(-.2,0,0)}
  else if(emo){emo.arms(A,F,i,u.et,u)}
  else{const sw=(i?s:-s)*amp*.9;A.rotation.set(sw,0,sd*.08);F.rotation.set(-.3-run*.5,0,0)}
  if(armPose!=='hold'||emo){if(A.rotation.order!=='XYZ'&&armPose!=='fall')A.rotation.order='XYZ'}}
 u.rig.rotation.y=emo&&emo.spin?emo.spin(u.et):0;if(emo&&emo.body)emo.body(u,u.et);
 u.gunMount.visible=armPose==='hold'&&!emo;if(!(gp)&&armPose!=='hold'||emo)for(const h of u.handM)h.visible=true;
 // far LOD: skip face blink etc. handled by caller visibility
}
// emotes: each {arms(A,F,i,t,u), body(u,t), head(t), dur}
const EMO={
 wave:{dur:3,arms:(A,F,i,t)=>{if(i===1){A.rotation.set(0,0,-2.6);F.rotation.set(0,0,-.3+Math.sin(t*9)*.6)}else A.rotation.set(0,0,-.1)},head:t=>Math.sin(t*3)*.2},
 dance:{dur:6,arms:(A,F,i,t)=>{const sd=i?1:-1,b=Math.sin(t*7+i*Math.PI);A.rotation.set(-2.6+b*.5,0,sd*(.5+Math.sin(t*3.5)*.3));F.rotation.set(-.5,0,0)},body:(u,t)=>{u.rig.rotation.z=Math.sin(t*3.5)*.12;u.hips.position.y=.78+Math.abs(Math.sin(t*7))*.07;u.leg[0].rotation.x=Math.sin(t*7)*.5;u.leg[1].rotation.x=-Math.sin(t*7)*.5;u.torso.rotation.y=Math.sin(t*3.5)*.4},head:t=>Math.sin(t*3.5)*.3},
 flex:{dur:3,arms:(A,F,i,t)=>{const sd=i?1:-1;A.rotation.set(0,0,sd*-1.5);F.rotation.set(0,0,sd*-2.3+Math.sin(t*10)*.05)},body:(u,t)=>{u.torso.scale.setScalar(1+Math.abs(Math.sin(t*5))*.04)},head:()=>0},
 cheer:{dur:3,arms:(A,F,i,t)=>{const sd=i?1:-1;A.rotation.set(0,0,sd*-2.9+Math.sin(t*12+i)*.2);F.rotation.set(-.2,0,0)},body:(u,t)=>{u.hips.position.y=.78+Math.abs(Math.sin(t*6))*.1;u.leg[0].rotation.x=.1;u.leg[1].rotation.x=.1},head:t=>Math.sin(t*6)*.15},
 salute:{dur:2.6,arms:(A,F,i,t)=>{const sd=i?1:-1;if(i===1){const k=Math.min(1,t*5)*(t>2.1?Math.max(0,1-(t-2.1)*5):1);A.rotation.set(-.9*k,0,-1.5*k+.0);F.rotation.set(-2.4*k,0,0)}else{A.rotation.set(0,0,sd*.08);F.rotation.set(-.15,0,0)}},body:(u,t)=>{u.torso.rotation.x=-.04},head:t=>Math.sin(t*1.5)*.05},
 spin:{dur:2.4,spin:t=>{const k=Math.min(1,t/1.5);return -(1-Math.pow(1-k,3))*Math.PI*4},arms:(A,F,i,t)=>{const sd=i?1:-1;A.rotation.set(0,0,sd*-1.45);F.rotation.set(0,0,sd*-.1)},body:(u,t)=>{u.hips.position.y=.78+Math.max(0,Math.sin(Math.min(1,t/.5)*Math.PI))*.12;u.leg[0].rotation.x=.12;u.leg[1].rotation.x=-.12},head:()=>0},
 clap:{dur:3,arms:(A,F,i,t)=>{const sd=i?1:-1,c=(1+Math.sin(t*15))/2;A.rotation.set(-1.25,0,sd*(.03+.3*c));F.rotation.set(-.7,0,0)},body:(u,t)=>{u.hips.position.y=.78+Math.abs(Math.sin(t*7.5))*.025},head:t=>Math.sin(t*2)*.1},
 sit:{dur:5,arms:(A,F,i,t)=>{A.rotation.set(-.6,0,(i?1:-1)*.1);F.rotation.set(-1.2,0,0)},body:(u,t)=>{u.hips.position.y=.5;u.leg[0].rotation.x=1.4;u.leg[1].rotation.x=1.4;u.shin[0].rotation.x=-1.4;u.shin[1].rotation.x=-1.4},head:t=>Math.sin(t*1.5)*.3}};
export const EMOTES=Object.keys(EMO);export const EMOTE_DUR=Object.fromEntries(Object.entries(EMO).map(([k,v])=>[k,v.dur]));
