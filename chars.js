// Low-poly humanoid soldier with simple procedural animation (walk/run/jump/slide/flinch/death).
import {THREE,G,mergeParts} from './gfx.js';
export const charMat=new THREE.MeshLambertMaterial({vertexColors:true});
const SKINS=[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac,0xd4a373];
const HAIR=[0x2b1d14,0x5a3825,0xb5813f,0x111111,0x8b4513];
function hash(s){let h=7;for(const c of String(s))h=h*31+c.charCodeAt(0)|0;return Math.abs(h)}
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
function limb(P,a,b,r1,r2,c,seg=7){_a.set(...a);_b.set(...b);const d=_b.clone().sub(_a),l=d.length();_q.setFromUnitVectors(_up,d.normalize());_m.compose(_a.clone().add(_b).multiplyScalar(.5),_q,new THREE.Vector3(1,1,1));P.push({g:G('cyl',r2,r1,l,seg),m:_m.clone(),c})}
const bx=(P,w,h,d,x,y,z,c,rx=0,ry=0,rz=0)=>P.push({g:G('box',w,h,d),p:[x,y,z],r:[rx,ry,rz],c});
function mesh(P){return new THREE.Mesh(mergeParts(P),charMat)}
export function makeCharacter(teamCol,name,id,tagCol){const h=hash(id);const skin=SKINS[h%SKINS.length],hair=HAIR[(h>>3)%HAIR.length];
 const col=new THREE.Color(teamCol),dark=col.clone().multiplyScalar(.55).getHex(),vest=0x4b5344,pants=0x33373d,boot=0x1d1f22,glove=0x2a2a2a,strap=0x26292b;
 const root=new THREE.Group(),rig=new THREE.Group();root.add(rig);
 // body
 let P=[];bx(P,.34,.17,.21,0,.93,0,pants);bx(P,.36,.05,.23,0,1.02,0,strap);bx(P,.06,.04,.02,0,1.02,-.12,0xb8a26a);
 bx(P,.38,.4,.22,0,1.23,0,teamCol);bx(P,.41,.3,.26,0,1.24,0,vest);for(const x of[-.12,0,.12])bx(P,.09,.09,.05,x,1.15,-.145,dark===0?vest:0x3d4436);
 bx(P,.08,.03,.27,-.13,1.4,0,strap);bx(P,.08,.03,.27,.13,1.4,0,strap);bx(P,.26,.06,.04,0,1.33,-.135,teamCol);
 P.push({g:G('sph',.1,8,6),p:[-.22,1.38,0],s:[1,.9,1.1],c:teamCol},{g:G('sph',.1,8,6),p:[.22,1.38,0],s:[1,.9,1.1],c:teamCol});
 P.push({g:G('cyl',.06,.065,.1,8),p:[0,1.47,0],c:skin});const body=mesh(P);rig.add(body);
 // head
 const head=new THREE.Group();head.position.set(0,1.5,0);P=[];
 bx(P,.23,.26,.25,0,.14,0,skin);bx(P,.2,.06,.22,0,.03,-.01,skin);// jaw
 bx(P,.05,.03,.02,-.055,.17,-.126,0xffffff);bx(P,.05,.03,.02,.055,.17,-.126,0xffffff);bx(P,.022,.026,.01,-.052,.17,-.137,0x1b1b1b);bx(P,.022,.026,.01,.058,.17,-.137,0x1b1b1b);
 bx(P,.06,.014,.02,-.055,.2,-.127,hair);bx(P,.06,.014,.02,.055,.2,-.127,hair);bx(P,.035,.05,.035,0,.13,-.135,skin);bx(P,.07,.014,.012,0,.075,-.127,0x8e4b3e);
 bx(P,.03,.06,.04,-.125,.15,0,skin);bx(P,.03,.06,.04,.125,.15,0,skin);bx(P,.24,.08,.26,0,.26,.0,hair);
 // helmet (team colour)
 P.push({g:G('sph',.155,10,6,),p:[0,.26,0],s:[1,.75,1.05],c:teamCol});bx(P,.3,.03,.3,0,.24,0,dark);bx(P,.22,.02,.08,0,.235,-.16,dark);bx(P,.17,.035,.025,0,.3,-.145,0x222222);
 head.add(mesh(P));rig.add(head);
 // aim group: arms + rifle
 const aim=new THREE.Group();aim.position.set(0,1.36,0);P=[];
 limb(P,[.22,0,0],[.21,-.2,-.16],.06,.055,teamCol);limb(P,[.21,-.2,-.16],[.07,-.12,-.36],.05,.045,teamCol);bx(P,.07,.08,.08,.06,-.12,-.39,glove);
 limb(P,[-.22,0,0],[-.2,-.18,-.25],.06,.055,teamCol);limb(P,[-.2,-.18,-.25],[-.02,-.08,-.56],.05,.045,teamCol);bx(P,.07,.07,.09,-.01,-.08,-.58,glove);
 bx(P,.06,.08,.5,.03,-.06,-.5,0x2b2d30);bx(P,.03,.03,.25,.03,-.05,-.86,0x1a1a1a);bx(P,.04,.12,.05,.03,-.15,-.42,0x1f2023,-.2);bx(P,.04,.07,.18,.03,-.07,-.18,0x2b2d30);bx(P,.03,.04,.1,.03,.0,-.5,0x111111);
 aim.add(mesh(P));rig.add(aim);
 // legs
 const legs=[];for(const s of[-1,1]){const th=new THREE.Group();th.position.set(s*.1,.9,0);P=[];bx(P,.15,.44,.17,0,-.2,0,pants);bx(P,.1,.12,.04,s*.05,-.18,-.09,dark);th.add(mesh(P));
  const sh=new THREE.Group();sh.position.set(0,-.42,0);P=[];bx(P,.13,.36,.14,0,-.18,0,pants);bx(P,.14,.1,.05,0,-.02,-.075,0x3a3f45);bx(P,.14,.13,.26,0,-.36,-.04,boot);bx(P,.145,.03,.27,0,-.415,-.04,0x111111);
  sh.add(mesh(P));th.add(sh);rig.add(th);legs.push([th,sh])}
 // name tag
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 38px system-ui,sans-serif';x.textAlign='center';
 x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(tagCol??teamCol).getHexString();x.fillText(name,128,46);
 const tg=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false,transparent:true}));tg.scale.set(1.5,.375,1);tg.position.y=2.25;root.add(tg);
 root.userData={rig,head,aim,legs,tag:tg,ph:0,flinch:0,dead:0,roll:(h%2?1:-1)};return root}
// state: {speed, air, slide, pitch, dt}
export function animate(m,st,dt){const u=m.userData;const sp=Math.min(st.speed,10);u.ph+=dt*(2.2+sp*1.25);
 const run=Math.min(1,sp/8),walk=Math.min(1,sp/2.5);const amp=(.35+.45*run)*walk;const s=Math.sin(u.ph);
 let rigY=Math.abs(Math.cos(u.ph))*.04*walk,rigX=-run*.12,legA=[s*amp,-s*amp],shA=[-Math.max(0,Math.sin(u.ph+1.2))*amp*1.4,-Math.max(0,Math.sin(u.ph+1.2+Math.PI))*amp*1.4];
 if(st.air){legA=[.5,-.2];shA=[-.9,-.4];rigY=0}
 if(st.slide){rigY=-.48;rigX=.45;legA=[1.25,1.05];shA=[-.15,-.55]}
 u.flinch=Math.max(0,u.flinch-dt*4);
 if(u.dead>0){u.dead+=dt;const k=Math.min(1,u.dead/.55);const e=k*k*(3-2*k);rigX=1.45*e;rigY=-.05*e;m.userData.rig.rotation.z=u.roll*.25*e;legA=[.3*e,.1*e];shA=[-.2,-.3];u.tag.visible=false}
 else{u.tag.visible=true;m.userData.rig.rotation.z=0}
 const r=u.rig;r.position.y+=(rigY-r.position.y)*Math.min(1,dt*14);r.rotation.x+=((rigX+u.flinch*.35)-r.rotation.x)*Math.min(1,dt*(u.dead?8:14));
 u.aim.rotation.x+=((u.dead?0:st.pitch)-u.aim.rotation.x)*Math.min(1,dt*15);u.head.rotation.x=u.aim.rotation.x*.6;
 for(let i=0;i<2;i++){const[th,sh]=u.legs[i];th.rotation.x+=(legA[i]-th.rotation.x)*Math.min(1,dt*16);sh.rotation.x+=(shA[i]-sh.rotation.x)*Math.min(1,dt*16)}}
