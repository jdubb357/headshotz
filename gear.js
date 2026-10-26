// HeadShotz v41 class gear: shaped (lathe / extrude+bevel / swept tubes) parts built in rig space (character faces -Z, feet y=0,
// bind pose), tagged with PBR params + a surface kind for the gear shader (0 plain, 1 woven cloth, 2 brushed metal, 3 cord wrap,
// 4 lens/glass, 5 leather/rubber). humans.js bakes them per bone into one merged mesh each.
import {THREE,GQ} from './gfx.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const UP=V(0,1,0);
const MC={};export function gmat(c,r=.6,mt=0,k=0){const key=c+'|'+r+'|'+mt+'|'+k;if(MC[key])return MC[key];const m=new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:mt});m.userData.k=k;return MC[key]=m}
const HY=1.675,HZ=-.045;// head centre (bind) + head-bone calibration offset
export function buildGear(L,teamCol,cls,add,rbox){const low=GQ.level==='low';const S=low?8:16,S2=low?6:10;
 const box=(w,h,d)=>rbox?rbox(w,h,d):new THREE.BoxGeometry(w,h,d);
 const put=(geo,mat,x,y,z,bone,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,bone==='head'?z+HZ:z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);add(m,bone)};
 const putM=(geo,mat,M,bone)=>{const m=new THREE.Mesh(geo,mat);m.applyMatrix4(M);if(bone==='head')m.position.z+=HZ;add(m,bone)};
 // tube between two points (rb at a, rt at b), optional flatten
 const seg=(a,b,ra,rb,mat,bone,n=S2,fl=1)=>{const d=b.clone().sub(a),l=d.length();const g=new THREE.CylinderGeometry(rb,ra,l,n,1);const m=new THREE.Mesh(g,mat);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(UP,d.normalize());m.scale.set(1,1,fl);if(bone==='head')m.position.z+=HZ;add(m,bone)};
 const lathe=(pts,n=S)=>new THREE.LatheGeometry((pts[0][1]>pts[pts.length-1][1]?pts.slice().reverse():pts).map(p=>new THREE.Vector2(p[0],p[1])),n);
 const ext=(shape,depth,bev=.004)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:!low,bevelThickness:bev,bevelSize:bev,bevelSegments:low?1:2,curveSegments:low?4:8});g.translate(0,0,-depth/2);return g};
 const rr=(w,h,r)=>{const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s};
 const plate=(w,h,d,r=.02)=>ext(rr(w,h,r),d,Math.min(.006,d*.3));
 const dome=(r,ys,th0,th1,n=S)=>new THREE.SphereGeometry(r,n,Math.max(4,n/2|0),0,Math.PI*2,th0,th1);
 const team=gmat(teamCol,.6,0,1),strap=gmat(0x1f2124,.75,0,1),buckle=gmat(0x2a2b2d,.4,.7,2),dk=c=>new THREE.Color(c).multiplyScalar(.75).getHex();
 const ring=(r,t,mat,x,y,z,bone,sx=1,sy=1,rx=Math.PI/2)=>put(new THREE.TorusGeometry(r,t,low?4:6,S),mat,x,y,z,bone,sx,sy,1,rx);
 // --- shared parts --------------------------------------------------------------------------------------------------------
 const pouch=(x,y,z,w,h,d,mat,bone,flap=true)=>{put(plate(w,h,d,.012),mat,x,y,z,bone);if(flap)put(plate(w*1.04,h*.32,d*.35,.01),mat,x,y+h*.36,z-d*.42,bone);if(!low)put(box(w*.22,h*.12,.006),buckle,x,y+h*.2,z-d*.62,bone)};
 const forearm=(s,r0,r1,mat,f0=.22,f1=.9)=>{const a=V(s*.372,1.226,-.017),b=V(s*.509,1.094,-.213);seg(a.clone().lerp(b,f0),a.clone().lerp(b,f1),r0,r1,mat,'lowerarm_'+(s<0?'l':'r'))};
 const shin=(s,r0,r1,mat,f0=.18,f1=.86)=>{const a=V(s*.152,.518,-.028),b=V(s*.202,.073,-.014);seg(a.clone().lerp(b,f0),a.clone().lerp(b,f1),r0,r1,mat,'calf_'+(s<0?'l':'r'))};
 const knee=(s,mat)=>{put(plate(.1,.11,.03,.03),mat,s*.152,.53,-.085,'calf_'+(s<0?'l':'r'),1,1,1,-.12)};
 const belt=(c,y=1.0)=>{put(lathe([[.168,-.025],[.172,-.02],[.172,.02],[.168,.025]],S),gmat(c,.7,0,5),0,y,.005,'pelvis',1,1,.78);put(plate(.05,.04,.012,.006),buckle,0,y,-.138,'pelvis')};
 const carrier=(c,bk=1,heavy=false)=>{const v=gmat(c,.85,0,1),vd=gmat(dk(c),.85,0,1);
  put(plate(.33*bk,.33,.05,.04),v,0,1.27,-.15*bk,'spine_03');put(plate(.34*bk,.36,.05,.04),v,0,1.28,.135*bk,'spine_03');// front/back plates
  put(lathe([[.2*bk,-.06],[.205*bk,0],[.2*bk,.06]],S),vd,0,1.13,0,'spine_03',1,1,.82);// cummerbund
  for(const s of[-1,1]){seg(V(s*.1,1.43,-.14),V(s*.11,1.47,.0),.028,.028,v,'spine_03',4,.35);seg(V(s*.11,1.47,0),V(s*.1,1.44,.13),.028,.028,v,'spine_03',4,.35)}// shoulder straps
  if(heavy)return v;
  for(let i=0;i<3;i++){const x=-.1+i*.1;pouch(x,1.17,-.2*bk,.085,.12,.05,vd,'spine_03');if(!low)put(plate(.06,.04,.025,.008),gmat(0x2b2b2b,.5,.3,0),x,1.255,-.2*bk,'spine_03')}// mag pouches + mags
  if(!low){for(let i=0;i<4;i++)put(box(.3*bk,.008,.004),strap,0,1.31-i*.04,.167*bk,'spine_03')}// MOLLE rows on back
  put(plate(.075,.075,.008,.01),team,-.07,1.37,-.18*bk,'spine_03');return v};
 const goggles=(y,z,tint=0x7fb3d5,sc=1)=>{const lens=gmat(tint,.08,.4,4),fr=gmat(0x1b1c1e,.6,0,5);for(const s of[-1,1]){put(new THREE.CylinderGeometry(.03*sc,.033*sc,.026,S2),fr,s*.042*sc,y,z,'head',1,1,1,Math.PI/2);put(new THREE.CircleGeometry(.026*sc,S2),lens,s*.042*sc,y,z-.0135,'head',1,1,1,0,Math.PI,0)}
  put(box(.02*sc,.012,.02),fr,0,y,z,'head');put(lathe([[.132,-.008],[.134,0],[.132,.008]],S),strap,0,y,.0,'head',1,1,1.12)};
 // --- heads ---------------------------------------------------------------------------------------------------------------
 const hd=L.head;
 if(hd==='helmet'){// MICH/FAST-style: lathe shell with flared rim, side rails, NVG shroud, cover strap, ear pro
  const hm=gmat(dk(L.vest),.62,0,1),hard=gmat(0x2b2d2f,.45,.3,2);
  put(lathe([[0,.12],[.06,.116],[.1,.09],[.122,.045],[.13,0],[.132,-.02],[.138,-.03],[.14,-.034]],S),hm,0,1.705,.0,'head',.92,1,1.08);
  for(const s of[-1,1]){put(plate(.012,.03,.1,.005),hard,s*.125,1.69,.0,'head',1,1,1,0,0,s*-.15);put(new THREE.CylinderGeometry(.04,.042,.03,S2),gmat(0x2f3133,.6,0,5),s*.093,1.64,.0,'head',1,1,1,0,0,Math.PI/2)}
  put(plate(.05,.04,.02,.008),hard,0,1.78,-.125,'head',1,1,1,-.5);if(!low){put(box(.035,.02,.03),hard,0,1.8,-.135,'head');ring(.1,.006,strap,0,1.73,.0,'head',1.25,1.1)}
  seg(V(-.11,1.64,0),V(0,1.56,-.07),.006,.006,strap,'head',4);seg(V(.11,1.64,0),V(0,1.56,-.07),.006,.006,strap,'head',4)}
 else if(hd==='jugg'){// EOD-style heavy helmet: deep lathe shell, full face plate with a glowing visor slit, neck guard
  const st=gmat(0x3a3e44,.42,.75,2),st2=gmat(0x24272b,.5,.6,2);
  put(lathe([[0,.15],[.07,.145],[.12,.11],[.152,.05],[.16,-.02],[.158,-.09],[.15,-.13]],S),st,0,HY,.015,'head',1,1,1.08);
  put(plate(.22,.19,.04,.04),st2,0,HY-.03,-.15,'head',1,1,1,-.08);put(plate(.17,.035,.02,.012),gmat(0x66c2ff,.05,.2,4),0,HY+.01,-.172,'head');
  for(let i=0;i<(low?2:4);i++)put(box(.11,.006,.012),st,0,HY-.06-i*.022,-.172,'head');
  put(lathe([[.17,0],[.19,-.08],[.2,-.1]],S),st2,0,HY-.12,.02,'head',1,1,1.05);for(const s of[-1,1])put(new THREE.CylinderGeometry(.05,.05,.03,S2),st2,s*.158,HY-.02,.0,'head',1,1,1,0,0,Math.PI/2)}
 else if(hd==='ninja'){// fitted cloth wrap: crown + face wrap with an eye slit, fold rings, knot + tails at the back
  const bl=gmat(0x121316,.95,0,1),bl2=gmat(0x1a1b20,.95,0,1),red=gmat(0x7a0e12,.85,0,1);
  const MY=1.664,MZ=-.003,ms=[1,1.12,1.17],R=.106;// mask ellipsoid fitted to the head (eyes at y~1.646-1.676)
  put(dome(R,0,0,Math.PI*.47),bl,0,MY,MZ,'head',...ms);// crown down to the brow
  put(lathe([[.0,.005],[.098,.003],[.104,-.02],[.103,-.06],[.09,-.1],[.075,-.13],[.07,-.16]],S),bl,0,1.641,.0,'head',1,1,1.27);// face/neck wrap from just under the eyes
  put(new THREE.SphereGeometry(R,S,S2,0,Math.PI,Math.PI*.4,Math.PI*.22),bl,0,MY,MZ,'head',...ms);// back of the head bridges the slit
  if(!low){put(new THREE.SphereGeometry(R*1.04,S,4,Math.PI*1.3,Math.PI*.4,Math.PI*.6,Math.PI*.06),bl2,0,MY,MZ,'head',1.03,1.15,1.21);put(new THREE.SphereGeometry(R*1.03,S,4,Math.PI*1.2,Math.PI*.6,Math.PI*.7,Math.PI*.05),bl2,0,MY,MZ,'head',1.03,1.15,1.2)}// wrap folds across the face
  ring(.106,.008,red,0,1.7,-.003,'head',1.01,1.18,Math.PI/2-.22);// headband
  put(new THREE.SphereGeometry(.022,S2,S2),red,0,1.69,.12,'head',1.3,.9,.8);// knot
  for(const s of[-1,1]){const g=new THREE.CylinderGeometry(.018,.006,.2,4);put(g,red,s*.025,1.6,.14,'head',1,1,.3,.3,0,s*.22)}
  // garb: obi with back knot, crossed chest straps (sword harness), arm + leg wraps, kunai and shuriken
  const obi=gmat(L.belt||0x7a0e12,.85,0,1),wrap=gmat(0x2a2b30,.9,0,3);
  put(lathe([[.17,-.05],[.176,-.04],[.178,.04],[.172,.05]],S),obi,0,1.0,.005,'pelvis',1,1,.8);put(plate(.09,.06,.04,.02),obi,0,1.0,.14,'pelvis');
  for(const s of[-1,1])put(new THREE.CylinderGeometry(.028,.012,.2,4),obi,s*.03,.89,.15,'pelvis',1,1,.3,.2,0,s*.15);
  put(lathe([[.164,-.012],[.168,0],[.164,.012]],S),strap,0,1.05,.005,'pelvis',1,1,.8);
  seg(V(-.16,1.42,-.06),V(.15,1.08,-.15),.02,.02,strap,'spine_03',4,.3);seg(V(.16,1.42,.05),V(-.15,1.08,.15),.02,.02,strap,'spine_03',4,.3);
  for(const s of[-1,1]){forearm(s,.046,.036,wrap,.15,.85);shin(s,.058,.046,wrap,.12,.8)}
  const steel=gmat(0x9aa1a8,.28,.9,2);
  for(const s of[-1,1]){const M=new THREE.Matrix4().compose(V(s*.13,.93,-.1),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,s*.25)),V(1,1,1));
   const parts=[[new THREE.CylinderGeometry(.008,.01,.075,S2),wrap,-.04],[new THREE.ConeGeometry(.016,.09,4),steel,.045],[new THREE.TorusGeometry(.01,.0025,4,S2),steel,-.085]];
   for(const [g,m,y] of parts){const mm=new THREE.Matrix4().makeTranslation(0,-y,0);if(g.type==='ConeGeometry')mm.multiply(new THREE.Matrix4().makeScale(1,1,.35)).multiply(new THREE.Matrix4().makeRotationX(Math.PI));putM(g,m,M.clone().multiply(mm),'pelvis')}}
  if(!low){const sh=new THREE.Shape();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=i%2?.012:.04;sh[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r)}sh.closePath();const hole=new THREE.Path();hole.absarc(0,0,.006,0,Math.PI*2,true);sh.holes.push(hole);put(ext(sh,.004,.0015),steel,.09,1.0,-.15,'pelvis',1,1,1,0,.25,0)}
  // two katanas crossed in an X on the back: saya with koiguchi/kojiri fittings + sageo cord, tsuba, cord-wrapped tsuka with fuchi/kashira
  const saya=gmat(0x0d0d10,.22,.1,0),gold=gmat(0x8a6a2a,.35,.85,2),tsuka=gmat(0x1c2233,.85,0,3),cord=gmat(0x6a1018,.8,0,1);
  for(const s of[-1,1]){const R=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,s*.72));const C=V(0,1.2,.2+(s>0?.035:0));const pos=C.clone().sub(V(0,-.12,0).applyQuaternion(R));
   const M=new THREE.Matrix4().compose(pos,R,V(1,1,1));const P=(g,m,y,sx=1,sz=1,rx=0)=>{const mm=new THREE.Matrix4().compose(V(0,y,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,0,0)),V(sx,1,sz));putM(g,m,M.clone().multiply(mm),'spine_03')};
   P(lathe([[.0,-.38],[.012,-.375],[.016,-.33],[.019,.1],[.0195,.34],[.0,.345]],S2),saya,-.24,1,.62);// saya (oval), y -.62..+.1
   P(new THREE.CylinderGeometry(.0175,.016,.03,S2),gold,-.605,1,.66);P(new THREE.CylinderGeometry(.021,.021,.02,S2),gold,.09,1,.66);
   P(new THREE.TorusGeometry(.021,.004,4,S2),cord,-.05,1,.7,Math.PI/2);if(!low)P(new THREE.TorusGeometry(.021,.004,4,S2),cord,-.02,1,.7,Math.PI/2);
   P(new THREE.CylinderGeometry(.042,.042,.008,low?8:12),gold,.112,1,.8);P(new THREE.CylinderGeometry(.044,.044,.003,low?8:12),gmat(0x1a1a1a,.4,.6,2),.118,1,.8);// tsuba + seppa
   P(lathe([[.0,-.14],[.0155,-.138],[.0145,0],[.0155,.138],[.0,.14]],S2),tsuka,.265,1,.72);// tsuka
   P(new THREE.CylinderGeometry(.017,.017,.016,S2),gold,.128,1,.72);P(new THREE.SphereGeometry(.0175,S2,S2/2|0,0,Math.PI*2,0,Math.PI/2),gold,.403,1,.72)}}
 else if(hd==='cap'){// medic: soft cap with red cross badge
  const c=gmat(0xe9ecef,.85,0,1),red=gmat(0xc0262b,.6,0,1);
  put(lathe([[0,.1],[.07,.095],[.115,.06],[.13,.01],[.13,-.005]],S),c,0,HY+.025,.008,'head',1,1,1.08);put(plate(.16,.09,.008,.035),c,0,HY+.02,-.15,'head',1,1,1,Math.PI/2-.2);
  put(box(.05,.016,.004),red,0,HY+.075,-.13,'head',1,1,1,-.35);put(box(.016,.05,.004),red,0,HY+.075,-.13,'head',1,1,1,-.35)}
 else if(hd==='boonie'){// scout: hood with a peak, goggles pushed up on the hood
  const c=gmat(dk(L.vest),.95,0,1);put(dome(.12,0,0,Math.PI*.42),c,0,1.68,.005,'head',.95,1.12,1.08);put(new THREE.SphereGeometry(.122,S,S2,Math.PI*1.72,Math.PI*1.56,Math.PI*.32,Math.PI*.5),c,0,1.67,.012,'head',.98,1.18,1.1);
  put(plate(.17,.05,.01,.02),c,0,HY+.075,-.135,'head',1,1,1,Math.PI/2-.55);goggles(1.745,-.105,0xffa94d,.9)}
 else if(hd==='hardhat'){// engineer: ridged lathe hard hat with brim, goggles on the front, headlamp
  const c=gmat(0xf1c40f,.32,0,0);put(lathe([[0,.12],[.07,.115],[.12,.075],[.135,.02],[.135,0],[.17,-.008],[.172,-.016],[.13,-.012]],S),c,0,HY+.025,.008,'head',1,1,1.12);
  for(const s of[-1,0,1])put(plate(.02,.13,.012,.006),c,s*.035,HY+.11,.0,'head',1,1,s?1:1.3,Math.PI/2,0,0);
  goggles(HY+.06,-.12,0x9fe7ff,1);if(!low){put(new THREE.CylinderGeometry(.018,.02,.025,S2),gmat(0x222222,.5,.3,5),0,HY+.075,-.14,'head',1,1,1,Math.PI/2);put(new THREE.CircleGeometry(.016,S2),gmat(0xfff6c0,.1,0,4),0,HY+.075,-.153,'head',1,1,1,0,Math.PI,0)}}
 // --- bodies --------------------------------------------------------------------------------------------------------------
 if(cls==='juggernaut'||L.plates){const st=gmat(0x3a3e44,.42,.75,2),st2=gmat(0x24272b,.5,.6,2);carrier(0x2f3338,1.15,true);
  put(plate(.36,.36,.06,.06),st,0,1.27,-.19,'spine_03',1,1,1,-.08);put(plate(.38,.4,.06,.06),st,0,1.27,.18,'spine_03');put(lathe([[.13,.03],[.15,0],[.13,-.03]],S),st2,0,1.47,0,'spine_03',1,1,.9);// chest/back plates + gorget
  for(const s of[-1,1]){const ua='upperarm_'+(s<0?'l':'r');put(new THREE.SphereGeometry(.11,S,S2,0,Math.PI*2,0,Math.PI*.5),st,s*.22,1.42,-.005,ua,1,.7,1);put(new THREE.SphereGeometry(.12,S,S2,0,Math.PI*2,0,Math.PI*.4),st2,s*.215,1.4,-.005,ua,1,.6,1);
   forearm(s,.055,.05,st,.1,.75);put(plate(.15,.18,.03,.03),st2,s*.11,.82,-.1,'thigh_'+(s<0?'l':'r'),1,1,1,-.08);knee(s,st);shin(s,.07,.06,st2,.15,.6)}
  put(plate(.22,.1,.04,.02),st2,0,.92,-.15,'pelvis')}
 else if(hd==='ninja'){}
 else if(cls==='medic'||L.cross){const v=carrier(0xe9ecef,1);const red=gmat(0xc0262b,.6,0,1);
  put(box(.1,.03,.006),red,0,1.38,-.178,'spine_03');put(box(.03,.1,.006),red,0,1.38,-.178,'spine_03');
  for(const s of[-1,1]){pouch(s*.2,.95,-.04,.07,.1,.06,gmat(0xd6d9dc,.85,0,1),'pelvis');put(plate(.1,.05,.012,.01),gmat(0xffffff,.6,0,1),s*.215,1.3,0,'upperarm_'+(s<0?'l':'r'),1,1,1,0,Math.PI/2,0);put(box(.05,.015,.004),red,s*.222,1.3,0,'upperarm_'+(s<0?'l':'r'),1,1,1,0,Math.PI/2,0);put(box(.015,.05,.004),red,s*.222,1.3,0,'upperarm_'+(s<0?'l':'r'),1,1,1,0,Math.PI/2,0)}
  const pk=gmat(0xc9ccd0,.85,0,1);put(plate(.3,.38,.15,.06),pk,0,1.22,.25,'spine_03');put(plate(.26,.16,.06,.04),pk,0,1.1,.34,'spine_03');put(box(.12,.035,.006),red,0,1.3,.327,'spine_03');put(box(.035,.12,.006),red,0,1.3,.327,'spine_03');
  for(const s of[-1,1])put(plate(.06,.22,.09,.025),pk,s*.17,1.2,.25,'spine_03');if(!low)seg(V(-.14,1.36,.32),V(.14,1.36,.32),.012,.012,gmat(0xff6b6b,.5,0,5),'spine_03',S2)}
 else if(cls==='engineer'||L.tools){// hi-vis vest with reflective bands, tool belt, wrench + hammer, small pack
  const v=gmat(0xe67e22,.8,0,1),refl=gmat(0xdde3e6,.25,.5,4);put(plate(.34,.34,.03,.04),v,0,1.27,-.14,'spine_03');put(plate(.35,.36,.03,.04),v,0,1.28,.13,'spine_03');put(lathe([[.195,-.06],[.2,0],[.195,.06]],S),v,0,1.14,0,'spine_03',1,1,.82);
  for(const y of[1.22,1.32]){put(box(.34,.022,.005),refl,0,y,-.158,'spine_03');put(box(.35,.022,.005),refl,0,y,.148,'spine_03')}
  const lth=gmat(0x6b4a2b,.7,0,5);belt(0x4a3420,.99);for(const s of[-1,1]){pouch(s*.15,.92,-.1,.08,.11,.06,lth,'pelvis',false);pouch(s*.19,.93,.05,.07,.1,.06,lth,'pelvis',false)}
  const steel=gmat(0xa7adb3,.3,.9,2);const wr=new THREE.Shape();wr.moveTo(-.011,-.1);wr.lineTo(.011,-.1);wr.lineTo(.011,.08);wr.absarc(0,.1,.028,-Math.PI*.35,Math.PI*1.35,false);wr.lineTo(-.011,.08);wr.closePath();const jaw=new THREE.Path();jaw.moveTo(-.011,.105);jaw.lineTo(.011,.105);jaw.lineTo(.011,.14);jaw.lineTo(-.011,.14);wr.holes.push(jaw);
  put(ext(wr,.008,.002),steel,.2,.86,-.04,'thigh_r',1,1,1,0,Math.PI/2,.08);// wrench in a thigh loop
  seg(V(-.19,.82,-.07),V(-.19,.98,-.07),.011,.011,gmat(0x7a4b25,.6,0,5),'pelvis',S2);put(box(.03,.03,.09),steel,-.19,.99,-.07,'pelvis');// hammer
  put(plate(.26,.28,.12,.05),gmat(0x40464d,.8,0,1),0,1.24,.22,'spine_03');put(new THREE.CylinderGeometry(.03,.03,.24,S2),gmat(0x2a2e33,.5,.4,2),0,1.39,.24,'spine_03',1,1,1,0,0,Math.PI/2);
  for(const s of[-1,1])knee(s,gmat(0x2b2d30,.7,0,5))}
 else if(cls==='scout'||L.light){// light rig: X harness, small chest pouches, binoculars on the chest, radio
  const v=gmat(L.vest,.85,0,1);for(const s of[-1,1]){seg(V(s*.12,1.45,-.1),V(-s*.12,1.12,-.17),.018,.018,v,'spine_03',4,.35);seg(V(s*.12,1.45,.09),V(-s*.12,1.12,.16),.018,.018,v,'spine_03',4,.35)}
  put(lathe([[.188,-.025],[.192,0],[.188,.025]],S),v,0,1.12,0,'spine_03',1,1,.83);for(const x of[-.11,.11])pouch(x,1.14,-.18,.06,.07,.04,gmat(dk(L.vest),.85,0,1),'spine_03');
  const bn=gmat(0x2b2d2f,.55,0,5),gl=gmat(0x3f6c8a,.05,.3,4);for(const s of[-1,1]){put(new THREE.CylinderGeometry(.022,.026,.1,S2),bn,s*.03,1.3,-.2,'spine_03');put(new THREE.CircleGeometry(.018,S2),gl,s*.03,1.35,-.2,'spine_03',1,1,1,-Math.PI/2)}put(box(.03,.05,.02),bn,0,1.3,-.2,'spine_03');
  seg(V(-.03,1.35,-.2),V(-.1,1.47,-.1),.004,.004,strap,'spine_03',4);seg(V(.03,1.35,-.2),V(.1,1.47,-.1),.004,.004,strap,'spine_03',4);
  put(plate(.06,.1,.04,.012),gmat(0x2a2c2e,.6,0,5),.16,1.33,.12,'spine_03');if(!low)seg(V(.17,1.38,.12),V(.18,1.62,.14),.003,.002,gmat(0x111111,.5,0,5),'spine_03',4);belt(0x3b3426);
  for(const s of[-1,1])put(plate(.06,.15,.08,.015),gmat(dk(L.vest),.85,0,1),s*.17,.8,-.02,'thigh_'+(s<0?'l':'r'))}
 else{// soldier
  carrier(L.vest,1);belt(0x2b2d22);put(plate(.07,.17,.1,.015),gmat(0x1d1f20,.6,0,5),.17,.82,-.02,'thigh_r');for(const s of[-1,1])knee(s,gmat(0x2b2d22,.7,0,5));
  put(plate(.06,.12,.04,.012),gmat(dk(L.vest),.85,0,1),-.14,1.3,.17,'spine_03');put(plate(.18,.1,.07,.02),gmat(dk(L.vest),.85,0,1),0,1.0,.15,'pelvis')}// radio + dump pouch
 if(hd!=='ninja')put(plate(.1,.06,.008,.01),team,-.21,1.36,0,'upperarm_l',1,1,1,0,Math.PI/2,0)}
