// HeadShotz v56 character kits: every skin is its own archetype (knight, astronaut, samurai, ...) with a different silhouette, materials
// and build, not a recolour. Kits are shaped geometry (lathe / extrude / tubes) built in rig space (faces -Z, feet y=0, bind pose)
// and baked per bone by humans.js into one merged PBR mesh per bone. Colour slots (c.top/pants/acc/hat/pack) keep the 9 tints working.
import {THREE,GQ} from './gfx.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const UP=V(0,1,0);const HY=1.675,HZ=-.045;
const MC={};export function gmat(c,r=.6,mt=0,k=0){const key=c+'|'+r+'|'+mt+'|'+k;if(MC[key])return MC[key];const m=new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:mt});m.userData.k=k;return MC[key]=m}
const dk=(c,f=.6)=>new THREE.Color(c).multiplyScalar(f).getHex(),lt=(c,f=.4)=>new THREE.Color(c).lerp(new THREE.Color(1,1,1),f).getHex();
const J={upper:[[.201,1.422,-.018],[.372,1.226,-.017],'upperarm'],fore:[[.372,1.226,-.017],[.509,1.094,-.213],'lowerarm'],thigh:[[.111,.954,.007],[.152,.518,-.028],'thigh'],shin:[[.152,.518,-.028],[.202,.073,-.014],'calf']};
// ---- builder helpers -------------------------------------------------------------------------------------------------------
export function mkG(add,rbox){const low=GQ.level==='low';const S=low?8:14,S2=low?6:10;let FINE=false;
 const g={low,S,S2,V,gmat,dk,lt,THREE};
 g.fine=(v=true)=>{FINE=v};
 const A=(m,bone)=>{if(FINE){if(low)return;m.userData.fine=1}add(m,bone)};
 g.put=(geo,mat,x,y,z,bone,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,bone==='head'?z+HZ:z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);A(m,bone);return m};
 g.seg=(a,b,ra,rb,mat,bone,n=S2,fl=1)=>{const d=b.clone().sub(a),l=d.length();const ge=new THREE.CylinderGeometry(rb,ra,l,n,1);const m=new THREE.Mesh(ge,mat);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(UP,d.normalize());m.scale.set(1,1,fl);if(bone==='head')m.position.z+=HZ;A(m,bone);return m};
 g.lathe=(pts,n=S,p0,pl)=>new THREE.LatheGeometry((pts[0][1]>pts[pts.length-1][1]?pts.slice().reverse():pts).map(p=>new THREE.Vector2(p[0],p[1])),n,p0,pl);
 g.box=(w,h,d)=>rbox?rbox(w,h,d):new THREE.BoxGeometry(w,h,d);
 g.rr=(w,h,r)=>{const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s};
 g.ext=(shape,depth,bev=.004)=>{const ge=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:!low,bevelThickness:bev,bevelSize:bev,bevelSegments:low?1:2,curveSegments:low?4:8});ge.translate(0,0,-depth/2);return ge};
 g.plate=(w,h,d,r=.02)=>g.ext(g.rr(w,h,r),d,Math.min(.006,d*.3));
 g.sph=(r,a=S,b=S2)=>new THREE.SphereGeometry(r,a,b);
 g.dome=(r,th1,n=S)=>new THREE.SphereGeometry(r,n,Math.max(4,n/2|0),0,Math.PI*2,0,th1);
 g.cyl=(a,b,h,n=S)=>new THREE.CylinderGeometry(a,b,h,n);g.cone=(r,h,n=S2)=>new THREE.ConeGeometry(r,h,n);g.tor=(r,t,arc=Math.PI*2)=>new THREE.TorusGeometry(r,t,low?4:6,S,arc);
 g.ell=(mat,x,y,z,rx,ry,rz,bone,rotx=0,roty=0,rotz=0)=>g.put(g.sph(1),mat,x,y,z,bone,rx,ry,rz,rotx,roty,rotz);
 g.raw=(m,bone)=>A(m,bone);
 g.sym=fn=>{for(const s of[-1,1])fn(s,s<0?'l':'r')};
 // point along a limb: f in 0..1 (s = side sign)
 g.jp=(part,f,s)=>{const [a,b]=J[part];return V(s*(a[0]+(b[0]-a[0])*f),a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f)};
 g.limb=(s,part,f0,f1,r0,r1,mat,n=S2,fl=1)=>g.seg(g.jp(part,f0,s),g.jp(part,f1,s),r0,r1,mat,J[part][2]+'_'+(s<0?'l':'r'),n,fl);
 // torso shell: lathe around the spine, flattened front-to-back (sz), rigid on the chest (spine_03) or pelvis
 g.shell=(pts,mat,bone='spine_03',sz=.92,z=-.02,n=S)=>g.put(g.lathe(pts,n),mat,0,0,z,bone,1,1,sz);
 g.boot=(s,mat,len=.2,h=.1,w=.1)=>{g.put(g.plate(w,h,len,.03),mat,s*.204,h/2,-.05-len/2+.1,'foot_'+(s<0?'l':'r'))};
 return g}
// ---- kit table -------------------------------------------------------------------------------------------------------------
export const KITS={};export const KIT=(id,spec)=>{KITS[id]=spec};
// ================================================== KNIGHT (solar) ==================================================
KIT('solar',{size:{w:1.1,h:1.03},hide:{hair:1},shoe:0x3a3a3e,
 cloth:c=>({shirt:dk(c.top,.45),pants:0x2a2a2e,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,sph,dome,cyl,cone,tor,box,gmat,sym,limb,shell,S,low,V}=g;
  const st=gmat(0xb9c2cc,.26,.95,2),st2=gmat(0x8d96a1,.38,.9,2),tr=gmat(c.acc,.28,.95,2),cl=gmat(c.top,.85,0,1),dkm=gmat(0x050506,.9,0,0);
  // great helm: tall lathe shell, visor slit, breath plate, brow band, feather plume
  put(lathe([[0,.15],[.07,.145],[.115,.115],[.14,.06],[.148,0],[.146,-.07],[.138,-.13]],S),st,0,HY-.0,.0,'head',1,1,1.1);
  put(box(.17,.022,.03),dkm,0,HY+.02,-.158,'head');put(plate(.026,.12,.03,.01),dkm,0,HY-.06,-.15,'head');
  for(let i=0;i<(low?2:4);i++)put(box(.012,.012,.02),dkm,-.04+i*.027,HY-.05,-.158,'head');
  put(tor(.146,.01),tr,0,HY+.045,.0,'head',1,1.1,1.1,Math.PI/2);put(plate(.02,.3,.02,.008),tr,0,HY+.0,-.155,'head',1,1,1,0,0,0);
  for(let i=0;i<7;i++){const a=i/6,y=HY+.14+Math.sin(Math.PI*a)*.075,z=-.1+a*.27;ell(cl,0,y,z,.022,.04+.02*Math.sin(Math.PI*a),.04,'head',-.6+a*1.2)}
  put(lathe([[.092,-.03],[.108,0],[.1,.03]],S),st2,0,1.515,-.012,'neck_01');// gorget
  // cuirass: shaped breast + back, centre ridge, hem lames and trim
  g.shell([[.17,1.1],[.186,1.2],[.206,1.3],[.2,1.38],[.15,1.455]],st,'spine_03',.92);
  put(plate(.022,.3,.03,.008),tr,0,1.29,-.157,'spine_03');put(lathe([[.176,-.012],[.182,0],[.176,.012]],S),tr,0,1.12,-.02,'spine_03',1,1,.92);
  put(lathe([[.2,-.012],[.206,0],[.2,.012]],S),tr,0,1.38,-.02,'spine_03',1,1,.92);
  for(let i=0;i<3;i++)put(lathe([[.185+i*.012,-.03],[.195+i*.012,0],[.185+i*.012,.03]],S),i%2?st2:st,0,1.04-i*.045,0,'pelvis',1,1,.8);// fauld lames
  put(plate(.3,.5,.02,.03),cl,0,1.2,.175,'spine_03',1,1,1,.05);// back tabard under cape
  // cape
  put(plate(.44,.78,.012,.03),cl,0,1.05,.2,'spine_03',1,1,1,.08);put(plate(.44,.06,.016,.02),tr,0,1.43,.19,'spine_03');
  sym((s,l)=>{
   put(dome(.105,Math.PI*.55),st,s*.225,1.455,-.018,'upperarm_'+l,1.2,.8,1.15,0,0,-s*.5);// pauldron
   for(let i=0;i<2;i++)limb(s,'upper',.0+i*.12,.16+i*.12,.095-i*.008,.09,i?st2:st,S,1.05);
   limb(s,'upper',.4,.95,.062,.052,st);ell(st,...jpv(g,'fore',0,s),.058,.058,.058,'lowerarm_'+l);// couter
   limb(s,'fore',.12,.88,.056,.046,st);
   const h=V(s*.522,1.075,-.245);ell(st,h.x,h.y,h.z,.05,.042,.078,'hand_'+l);// gauntlet
   put(plate(.17,.24,.03,.03),st2,s*.12,.78,-.105,'thigh_'+l,1,1,1,-.1,0,s*.12);// tasset
   limb(s,'thigh',.12,.85,.1,.082,st);ell(st,s*.152,.53,-.082,.062,.07,.05,'calf_'+l);// cuisse + poleyn
   limb(s,'shin',.08,.9,.07,.054,st);
   put(g.plate(.11,.1,.28,.04),st,s*.204,.07,-.08,'foot_'+l);// sabaton
  });
  put(plate(.05,.07,.02,.01),tr,-.01,1.0,-.2,'pelvis');
 }});
export const jpv=(g,part,f,s)=>{const p=g.jp(part,f,s);return[p.x,p.y,p.z]};
// cape / cloak: curved panel hanging from the shoulders behind the back
const cape=(g,mat,y0,y1,r0,r1,half=.9,z=.02,bone='spine_03',sz=.8)=>g.put(g.lathe([[r0,y0],[r1,y1]],g.S,Math.PI-half,half*2),mat,0,0,z,bone,1,1,sz);
// ================================================== ASTRONAUT (starpilot) ==================================================
KIT('starpilot',{size:{w:1.17,h:1.0},hide:{hair:1,brow:1,lash:1},shoe:0xdfe3ea,
 cloth:c=>({shirt:0xeef1f6,pants:0xe6eaf0,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,sph,cyl,tor,box,gmat,sym,limb,low,V,S}=g;
  const wh=gmat(0xf2f4f8,.55,0,1),wh2=gmat(0xd9dee6,.6,0,1),bl=gmat(c.acc,.45,.1,0),gold=gmat(0xd6a642,.06,1,0),dkm=gmat(0x25282d,.5,.4,5),org=gmat(0xff6a1a,.5,0,0);
  ell(wh,0,HY+.01,-.01,.2,.2,.215,'head');// helmet shell
  ell(gold,0,HY-.01,-.075,.168,.14,.15,'head');// mirrored visor
  put(tor(.17,.016),bl,0,HY-.12,-.01,'head',1,1,1.04,Math.PI/2);put(plate(.06,.035,.03,.01),dkm,.0,HY+.205,-.02,'head');
  put(lathe([[.1,-.04],[.13,0],[.11,.04]],S),wh2,0,1.5,-.012,'neck_01',1,1,1.0);put(tor(.125,.012),bl,0,1.52,-.012,'neck_01',1,1,1,Math.PI/2);
  g.shell([[.19,1.1],[.215,1.22],[.23,1.32],[.215,1.42],[.16,1.47]],wh,'spine_03',.9);
  put(plate(.17,.12,.05,.025),wh2,0,1.3,-.195,'spine_03');put(box(.1,.03,.01),org,0,1.35,-.226,'spine_03');for(let i=0;i<3;i++)put(g.sph(.011),gmat([0xff3b30,0x35d450,0x3a74ff][i],.3,0,4),-.04+i*.04,1.305,-.228,'spine_03');
  put(plate(.38,.5,.2,.06),wh2,0,1.27,.24,'spine_03');put(plate(.3,.14,.12,.05),wh,0,1.55,.24,'spine_03');put(cyl(.012,.012,.2),dkm,.12,1.7,.26,'spine_03');// life support pack + antenna
  seg(V(-.15,1.35,-.17),V(-.2,1.4,.12),.012,.012,dkm,'spine_03');seg(V(.15,1.35,-.17),V(.2,1.4,.12),.012,.012,dkm,'spine_03');
  put(lathe([[.2,-.03],[.215,0],[.2,.03]],S),dkm,0,1.0,-.02,'pelvis',1,1,.92);
  sym((s,l)=>{ell(wh,s*.225,1.435,-.018,.1,.085,.1,'upperarm_'+l);limb(s,'upper',.05,.95,.074,.066,wh);limb(s,'fore',.0,.92,.064,.056,wh);
   put(tor(.062,.012),bl,...[...jv(g,'fore',.04,s)],'lowerarm_'+l,1,1,1,0,0,0);
   const w=g.jp('fore',.97,s);put(tor(.058,.011),bl,w.x,w.y,w.z,'lowerarm_'+l,1,1,1,Math.PI/2.4,0,s*-.5);ell(wh,s*.522,1.07,-.245,.065,.058,.09,'hand_'+l);
   put(plate(.08,.05,.01,.01),gmat(s<0?0xd22a2a:0x2a4fd2,.6,0,0),s*.3,1.33,-.012,'upperarm_'+l,1,1,1,0,Math.PI/2,0);
   limb(s,'thigh',.0,.95,.112,.09,wh);limb(s,'shin',.0,.78,.092,.075,wh);ell(wh2,s*.152,.53,-.08,.085,.08,.07,'calf_'+l);
   put(plate(.135,.12,.3,.05),wh,s*.204,.065,-.07,'foot_'+l);put(plate(.14,.03,.31,.01),dkm,s*.204,.012,-.07,'foot_'+l);put(tor(.08,.014),bl,s*.2,.15,-.02,'foot_'+l,1,1,1,Math.PI/2)})}});
const jv=(g,p,f,s)=>{const v=g.jp(p,f,s);return[v.x,v.y,v.z]};
// ================================================== SAMURAI (samurai) ==================================================
KIT('samurai',{size:{w:1.04,h:1.0},hide:{hair:1},shoe:0x1a1a1c,
 cloth:c=>({shirt:0x1b1b22,pants:0x14141a,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,sph,cyl,tor,box,gmat,sym,limb,low,V,S,cone}=g;
  const lac=gmat(c.top,.32,.2,1),lac2=gmat(dk(c.top,.55),.35,.2,1),iron=gmat(0x2a2a2e,.4,.85,2),gold=gmat(c.acc,.3,.9,2),cord=gmat(0x1a1a20,.9,0,3),cord2=gmat(0xe9e2cf,.9,0,3),hak=gmat(0x15151b,.9,0,1);
  // kabuto: iron bowl, shikoro neck flare, gold maedate crescent, red lacquered mempo face guard
  put(lathe([[0,.13],[.07,.125],[.115,.095],[.14,.04],[.15,-.01],[.15,-.04]],S),iron,0,HY+.02,.0,'head',1,1,1.08);
  put(lathe([[.15,-.02],[.2,-.09],[.235,-.16],[.245,-.19]],S,Math.PI-1.4,2.8),lac2,0,HY-.0,.01,'head',1,1,1.05);
  for(const s of[-1,1])put(plate(.07,.1,.02,.02),lac2,s*.15,HY-.01,-.065,'head',1,1,1,0,s*1.05,0);
  put(tor(.105,.01,Math.PI),gold,0,HY+.115,-.125,'head',1.15,1.1,1,-.35);put(plate(.014,.07,.012,.004),gold,0,HY+.14,-.12,'head');
  put(tor(.151,.008),gold,0,HY-.015,.0,'head',1,1,1.08,Math.PI/2);
  ell(lac,0,HY-.065,-.05,.095,.07,.085,'head');put(plate(.07,.03,.02,.01),iron,0,HY-.075,-.14,'head');for(const s of[-1,1])put(cyl(.007,.007,.05),gold,s*.03,HY-.1,-.13,'head');
  // do cuirass with lacing, kusazuri hip plates, sode shoulder plates
  g.shell([[.175,1.1],[.19,1.2],[.205,1.3],[.2,1.38],[.15,1.45]],lac,'spine_03',.92);
  for(let i=0;i<5;i++)put(lathe([[.178+i*.007,-.008],[.186+i*.007,0],[.178+i*.007,.008]],S),i%2?cord2:cord,0,1.14+i*.055,-.02,'spine_03',1,1,.92);
  put(plate(.04,.3,.03,.01),gold,0,1.28,-.2,'spine_03');
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;put(plate(.12,.2,.012,.012),i%2?lac2:lac,Math.sin(a)*.195,.89,Math.cos(a)*.17-.01,'pelvis',1,1,1,0,a,0)}
  put(lathe([[.186,-.03],[.19,0],[.186,.03]],S),cord2,0,1.02,-.01,'pelvis',1,1,.88);
  sym((s,l)=>{for(let i=0;i<3;i++)put(plate(.17-i*.012,.05,.015,.012),i%2?lac2:lac,s*(.265+i*.012),1.455-i*.045,-.018,'upperarm_'+l,1,1,1,0,Math.PI/2,s*.35+s*i*.06);
   limb(s,'upper',.35,.95,.056,.05,gmat(0x2a2a30,.9,0,1));limb(s,'fore',.05,.9,.052,.044,iron);put(plate(.05,.12,.012,.01),gold,...jv(g,'fore',.5,s),'lowerarm_'+l,1,1,1,.3,0,0);
   ell(iron,s*.522,1.075,-.245,.048,.04,.076,'hand_'+l);
   limb(s,'thigh',.0,1,.125,.14,hak,S,1.1);limb(s,'shin',.0,.98,.13,.1,hak,S,1.1);limb(s,'shin',.18,.8,.066,.058,iron);put(plate(.1,.12,.02,.03),iron,s*.152,.53,-.085,'calf_'+l,1,1,1,-.1);
   put(g.plate(.1,.07,.26,.03),gmat(0x1a1a1c,.8,0,5),s*.204,.04,-.06,'foot_'+l)});
  // katana (saya + wrapped tsuka + tsuba) on the left hip
  const A=V(-.2,1.03,-.1),B=V(-.31,.6,.4);seg(A.clone().lerp(B,.2),B,.019,.016,gmat(0x0c0c10,.2,.2,0),'pelvis',S);seg(A,A.clone().lerp(B,.2),.017,.017,cord,'pelvis',S);put(cyl(.04,.04,.007),gold,...[...A.clone().lerp(B,.2).toArray()],'pelvis',1,1,1,.9,0,.25)}});
// ================================================== ANDROID (punk) ==================================================
KIT('punk',{size:{w:.98,h:1.02},hide:{hair:1,brow:1,lash:1,cloth:1},shoe:0x2a2d33,skin:{col:0xf4f6fa,metal:.92,rough:.22,mono:1,env:1.3,eye:0x35d4ff},
 build(g,c){const {put,seg,lathe,plate,ell,sph,cyl,tor,box,gmat,sym,limb,low,V,S}=g;
  const wh=gmat(0xf4f6fa,.2,.55,0),dkm=gmat(0x1c1f25,.4,.85,2),glow=gmat(c.acc,.2,0,4),gr=gmat(0x8b929c,.35,.9,2);
  put(tor(.108,.008),glow,0,HY+.02,-.0,'head',1,1.05,1.12,Math.PI/2);// head seam light
  for(const s of[-1,1]){put(cyl(.04,.04,.03),dkm,s*.108,HY,0,'head',1,1,1,0,0,Math.PI/2);put(cyl(.026,.026,.01),glow,s*.125,HY,0,'head',1,1,1,0,0,Math.PI/2)}
  put(lathe([[.07,-.03],[.08,0],[.07,.03]],S),dkm,0,1.51,-.012,'neck_01');
  g.shell([[.17,1.1],[.19,1.2],[.205,1.3],[.2,1.38],[.14,1.45]],wh,'spine_03',.92);
  put(plate(.14,.16,.02,.03),dkm,0,1.28,-.208,'spine_03');put(new THREE.CircleGeometry(.035,S),glow,0,1.3,-.221,'spine_03',1,1,1,0,Math.PI,0);put(tor(.04,.006),gr,0,1.3,-.219,'spine_03');
  for(let i=0;i<4;i++)put(lathe([[.15+.005*i,-.012],[.16+.005*i,0],[.15+.005*i,.012]],S),i%2?dkm:gr,0,1.02+i*.025,-.02,'spine_01',1,1,.92);// abdomen rings
  put(plate(.26,.3,.02,.04),dkm,0,1.25,.176,'spine_03');for(let i=0;i<3;i++)put(box(.2,.01,.01),glow,0,1.15+i*.08,.19,'spine_03');
  sym((s,l)=>{ell(dkm,s*.215,1.44,-.018,.062,.062,.062,'upperarm_'+l);limb(s,'upper',.18,.92,.056,.05,wh);put(tor(.052,.01),glow,...jv(g,'upper',.97,s),'upperarm_'+l,1,1,1,.9,0,s*-.7);ell(dkm,...jv(g,'fore',0,s),.052,.052,.052,'lowerarm_'+l);
   limb(s,'fore',.12,.82,.052,.044,wh);put(plate(.04,.14,.012,.01),glow,...jv(g,'fore',.5,s),'lowerarm_'+l,1,1,1,.3,0,0);ell(gr,s*.522,1.075,-.245,.047,.04,.074,'hand_'+l);
   limb(s,'thigh',.08,.85,.095,.078,wh);ell(dkm,s*.152,.53,-.05,.07,.07,.07,'calf_'+l);limb(s,'shin',.12,.88,.066,.05,wh);put(plate(.04,.2,.01,.01),glow,s*.15,.3,-.09,'calf_'+l);
   put(plate(.1,.07,.24,.03),dkm,s*.204,.04,-.06,'foot_'+l);put(plate(.16,.09,.02,.02),wh,s*.12,.9,-.09,'pelvis')});
 }});
// ================================================== NINJA (ninja) ==================================================
KIT('ninja',{size:{w:.95,h:1.02},legacy:{head:'ninja'},hide:{hair:1},shoe:0x141416,cloth:c=>({shirt:0x16171b,pants:0x101114,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,gmat,sym,limb,V,S}=g;const bl=gmat(0x121316,.95,0,1),red=gmat(c.acc,.85,0,1);
  seg(V(-.2,1.5,-.02),V(-.18,1.52,-.2),.03,.034,red,'spine_03');// scarf
  seg(V(.16,1.5,.02),V(.3,1.1,.28),.03,.014,red,'spine_03',6,.3);
  sym((s,l)=>{limb(s,'fore',.05,.9,.05,.04,bl);limb(s,'upper',.05,.7,.055,.048,bl);put(g.plate(.09,.06,.22,.03),bl,s*.204,.045,-.07,'foot_'+l)})}});
// ================================================== TACTICAL OPERATOR (grape) ==================================================
KIT('grape',{size:{w:1.05,h:1.0},legacy:{head:'helmet'},hair:0x1b1512,shoe:0x1d1d1f,cloth:c=>({shirt:0x2f332d,pants:0x2b2f2a,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,gmat,sym,limb,V,S,box,cyl}=g;const bk=gmat(0x1c1d1f,.55,.2,5),tan=gmat(0x6b6048,.85,0,1),gl=gmat(0x66e0ff,.1,.3,4);
  put(plate(.08,.05,.05,.01),bk,0,HY+.115,-.17,'head');put(cyl(.022,.022,.05),bk,0,HY+.115,-.2,'head',1,1,1,Math.PI/2);put(new THREE.CircleGeometry(.017,S),gl,0,HY+.115,-.226,'head',1,1,1,0,Math.PI,0);
  ell(tan,0,1.5,.0,.09,.05,.1,'neck_01');
  sym((s,l)=>{put(g.plate(.09,.1,.04,.02),bk,s*.152,.53,-.095,'calf_'+l);limb(s,'fore',.05,.45,.048,.043,bk);limb(s,'upper',.05,.4,.058,.05,tan);ell(bk,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);
   put(g.plate(.1,.07,.26,.03),bk,s*.204,.045,-.07,'foot_'+l)});
  put(plate(.26,.22,.1,.04),tan,0,1.21,.22,'spine_03');put(box(.26,.02,.01),bk,0,1.3,.272,'spine_03')}});
// ================================================== PIRATE (pirate) ==================================================
KIT('pirate',{size:{w:1.06,h:.99},hide:{hair:1},hair:0x2b1d14,shoe:0x1a1210,cloth:c=>({shirt:0xe8dfc8,pants:0x2a2018,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;
  const coat=gmat(c.top,.8,0,1),coat2=gmat(dk(c.top,.7),.85,0,1),gold=gmat(c.acc,.3,.9,2),lea=gmat(0x2a1d14,.7,0,5),hat=gmat(0x17120f,.85,0,1),sash=gmat(0xc23a2a,.85,0,1);
  // tricorn: crown + three upturned brims with gold lace and a feather
  put(lathe([[0,.1],[.09,.098],[.115,.06],[.125,0]],S),hat,0,HY+.075,.0,'head',1,1,1.05);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.PI/2;put(plate(.2,.15,.012,.05),hat,Math.cos(a)*.1,HY+.085+(i?.015:0),Math.sin(a)*.12,'head',1,1,1,Math.PI/2-.35,-a+Math.PI/2,0)}
  put(tor(.14,.007),gold,0,HY+.092,0,'head',1,1.05,1.05,Math.PI/2);put(cone(.012,.2),gmat(0xf0efe6,.9,0,1),.12,HY+.17,.0,'head',1,1,.5,0,0,-.8);
  put(plate(.05,.035,.01,.01),gmat(0x050505,.5,0,5),-.035,HY+.015,-.15,'head');seg(V(-.11,HY+.05,-.02),V(.0,HY-.02,-.14),.004,.004,gmat(0x111111,.6,0,5),'head',4);// eyepatch + strap
  // coat: collar, double-breasted front with brass buttons, flared skirts, cuffs
  g.shell([[.19,1.1],[.205,1.2],[.215,1.3],[.2,1.4],[.15,1.465]],coat,'spine_03',.93);
  put(lathe([[.18,0],[.3,-.34],[.325,-.4]],S,Math.PI-1.5,3),coat,0,1.02,.0,'pelvis',1,1,.86);// back skirt
  for(const s of[-1,1])put(plate(.09,.3,.012,.02),coat2,s*.07,1.28,-.2,'spine_03',1,1,1,0,0,s*.15);// lapels
  for(let i=0;i<4;i++)for(const s of[-1,1])put(sph(.01,6,5),gold,s*.045,1.12+i*.075,-.213,'spine_03');
  sym((s,l)=>{limb(s,'upper',.05,.95,.062,.056,coat);limb(s,'fore',.0,.8,.056,.052,coat);put(tor(.054,.01),gold,...jv(g,'fore',.82,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(lea,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);
   put(lathe([[.1,.0],[.15,-.3]],S,s>0?.2:Math.PI+.2,Math.PI*.7),coat,s*.07,.84,-.07,'thigh_'+l,1,1,1);
   limb(s,'shin',.0,1,.077,.062,lea);put(tor(.09,.025),lea,s*.152,.56,-.03,'calf_'+l,1,1,1,Math.PI/2);put(cyl(.1,.082,.14),lea,s*.152,.5,-.03,'calf_'+l);
   put(g.plate(.1,.08,.26,.03),lea,s*.204,.045,-.07,'foot_'+l)});
  put(lathe([[.2,-.04],[.205,0],[.2,.04]],S),sash,0,1.01,-.02,'pelvis',1,1,.9);put(plate(.06,.045,.02,.01),gold,0,1.02,-.19,'pelvis');
  // cutlass: guard, grip, curved blade
  const A=V(.2,1.0,-.1),B=V(.33,.55,.4);seg(A.clone().lerp(B,.22),B,.016,.01,gmat(0xcfd6dc,.12,1,0),'pelvis',6,.3);seg(A,A.clone().lerp(B,.22),.014,.014,lea,'pelvis',6);put(tor(.05,.008,Math.PI),gold,...A.clone().lerp(B,.22).toArray(),'pelvis',1,1,1,1.0,0,.3)}});
// ================================================== FIREFIGHTER (cherry) ==================================================
KIT('cherry',{size:{w:1.12,h:1.01},hide:{hair:1},shoe:0x1b1b1d,cloth:c=>({shirt:c.top,pants:0x25272c,sty:3,c2:0xdfe6e8,cut:[9,-9,9],rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;
  const coat=gmat(c.top,.8,0,1),rf=gmat(0xdfe6e8,.25,.5,4),bk=gmat(0x1b1b1d,.6,0,5),pant=gmat(0x25272c,.9,0,1),helm=gmat(c.acc,.35,.1,0),tank=gmat(0xb8bcc2,.3,.85,2),gold=gmat(0xd4a83a,.3,.9,2);
  put(lathe([[0,.12],[.07,.116],[.12,.08],[.135,.02],[.14,-.01]],S),helm,0,HY+.03,.0,'head',1,1,1.12);put(plate(.22,.18,.012,.04),helm,0,HY-.01,.17,'head',1,1,1,Math.PI/2-.35);// helmet + long back brim
  put(plate(.1,.07,.012,.02),helm,0,HY+.07,-.145,'head',1,1,1,-.15);put(plate(.07,.045,.008,.01),gold,0,HY+.075,-.153,'head');put(plate(.016,.14,.01,.004),helm,0,HY+.13,-.02,'head',1,1,1,Math.PI/2);
  put(tor(.14,.007),rf,0,HY+.02,.0,'head',1,1,1.12,Math.PI/2);
  put(lathe([[.1,-.03],[.14,0],[.12,.05]],S),coat,0,1.52,-.012,'neck_01',1,1,1.05);// turnout collar
  g.shell([[.2,1.08],[.225,1.2],[.235,1.32],[.22,1.42],[.16,1.48]],coat,'spine_03',.92);
  for(const y of[1.22,1.32])put(lathe([[.226+(y-1.2)*.05,-.014],[.232+(y-1.2)*.05,0],[.226+(y-1.2)*.05,.014]],S),rf,0,y,-.02,'spine_03',1,1,.92);
  put(lathe([[.236,-.1],[.25,-.05],[.25,0]],S),coat,0,1.0,-.02,'pelvis',1,1,.9);
  put(cyl(.065,.065,.5),tank,.0,1.28,.24,'spine_03');put(cyl(.06,.065,.05),bk,0,1.55,.24,'spine_03');put(plate(.3,.07,.04,.02),bk,0,1.5,.2,'spine_03');put(cyl(.012,.012,.1),bk,-.04,1.62,.24,'spine_03');// SCBA
  seg(V(-.05,1.57,.25),V(-.16,1.48,-.1),.012,.012,bk,'spine_03');put(sph(.045,8,6),bk,-.16,1.4,-.2,'spine_03',1,1,.8);// regulator hose + mask
  sym((s,l)=>{limb(s,'upper',.04,.95,.075,.068,coat);limb(s,'fore',.0,.9,.066,.06,coat);put(tor(.07,.012),rf,...jv(g,'fore',.55,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(bk,s*.522,1.075,-.245,.056,.05,.085,'hand_'+l);
   limb(s,'thigh',.0,1,.108,.098,pant);limb(s,'shin',.0,.7,.092,.082,pant);put(tor(.09,.012),rf,s*.152,.42,-.03,'calf_'+l,1,1,1,Math.PI/2);put(cyl(.083,.08,.38),bk,s*.152,.26,-.02,'calf_'+l);put(g.plate(.12,.1,.28,.04),bk,s*.204,.05,-.07,'foot_'+l)});
 }});
// ================================================== SCUBA DIVER (frost) ==================================================
KIT('frost',{size:{w:1.02,h:1.0},hide:{hair:1},shoe:0x101216,cloth:c=>({shirt:0x12161c,pants:0x12161c,sty:3,c2:c.acc,rough:.5}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;
  const neo=gmat(0x12161c,.55,0,0),orange=gmat(0xff8a1a,.7,0,1),tankm=gmat(0xc9ced4,.3,.85,2),yel=gmat(0xe8c21a,.4,.4,2),bk=gmat(0x0c0d10,.6,0,5),gl=gmat(c.acc,.05,.2,4),sil=gmat(0xdfe3e8,.35,.4,0);
  ell(neo,0,HY+.03,.0,.122,.125,.125,'head');// neoprene hood
  put(plate(.2,.1,.05,.04),bk,0,HY-.005,-.128,'head');put(plate(.17,.065,.012,.03),gl,0,HY-.005,-.158,'head');put(tor(.09,.008),sil,0,HY-.005,-.14,'head',1.1,.6,.7);// mask
  put(tor(.128,.009),bk,0,HY+.01,0,'head',1,1,1.08,Math.PI/2);
  seg(V(.04,HY-.04,-.14),V(.13,HY-.1,-.06),.01,.01,bk,'head',6);seg(V(.13,HY-.1,-.06),V(.2,1.2,.05),.01,.01,bk,'head',6);// regulator hose
  put(lathe([[.186,1.04],[.225,1.17],[.235,1.3],[.21,1.42],[.15,1.47]],S),orange,0,0,-.02,'spine_03',1,1,.92);// BCD vest
  put(plate(.04,.2,.02,.01),bk,-.07,1.3,-.22,'spine_03');put(plate(.06,.1,.02,.01),yel,.1,1.25,-.215,'spine_03');
  for(const x of[-.09,.09])put(cyl(.08,.08,.58),tankm,x,1.25,.23,'spine_03');put(cyl(.05,.05,.04),yel,0,1.57,.23,'spine_03');for(const x of[-.09,.09])put(cyl(.07,.07,.03),yel,x,1.0,.23,'spine_03');put(cyl(.015,.015,.14),bk,0,1.58,.23,'spine_03');
  put(lathe([[.2,-.035],[.208,0],[.2,.035]],S),bk,0,1.0,-.02,'pelvis',1,1,.9);for(let i=0;i<3;i++)put(box(.045,.07,.07),gmat(0x555a62,.5,.6,2),-.17+i*.12*0+(i-1)*.05,.98,-.19,'pelvis');
  sym((s,l)=>{ell(bk,s*.522,1.075,-.245,.05,.042,.08,'hand_'+l);put(tor(.048,.01),sil,...jv(g,'fore',.95,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);
   put(plate(.075,.05,.13,.02),bk,s*.152,.3,-.09,'calf_'+l);put(g.plate(.1,.07,.22,.03),bk,s*.204,.04,-.04,'foot_'+l);
   put(g.plate(.2,.014,.48,.06),gmat(0x1a8fb4,.5,0,5),s*.208,.025,-.38,'foot_'+l)});
 }});
// shaggy strands scattered around a segment (ghillie / fur / feathers): shared cone geometry, per-strand colour
const shag=(g,a,b,n,r,len,mats,bone,seed,fall=1,rr=.016)=>{const geo=g.cone(rr,len,4);let sd=seed;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};const d0=b.clone().sub(a);
 for(let i=0;i<n;i++){const t=rnd(),an=rnd()*Math.PI*2;const p=a.clone().addScaledVector(d0,t);const out=V(Math.cos(an),0,Math.sin(an));p.addScaledVector(out,r);const dir=out.clone().multiplyScalar(.55).add(V(0,-fall,0)).add(V(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(.5)).normalize();
  const m=new THREE.Mesh(geo,mats[(rnd()*mats.length)|0]);m.position.copy(p).addScaledVector(dir,len*.5);m.quaternion.setFromUnitVectors(V(0,-1,0),dir.clone().negate().multiplyScalar(-1));m.quaternion.setFromUnitVectors(V(0,1,0),dir.clone().negate());m.scale.set(1,1,.5);g.raw(m,bone)}};
// bare skin limbs (the MakeHuman skin mesh only covers head / neck / hands, so exposed arms and legs are tubes in the player's skin tone)
const bare=(g,c,o={})=>{const sk=g.gmat(c.skin,.55,0,0),S=g.S;g.sym((s,l)=>{
 if(o.arms!==false){const f0=o.a0??0;g.limb(s,'upper',f0,1,.052,.042,sk,S);g.ell(sk,...jv(g,'upper',0,s),.054,.054,.054,'upperarm_'+l);g.ell(sk,...jv(g,'fore',0,s),.044,.044,.044,'lowerarm_'+l);g.limb(s,'fore',0,.98,.044,.034,sk,S)}
 if(o.legs){g.limb(s,'thigh',o.t0??.74,1,.082,.064,sk,S);g.ell(sk,s*.152,.518,-.028,.066,.066,.066,'calf_'+l);g.limb(s,'shin',0,.95,.062,.042,sk,S)}})};
// ================================================== STREET ATHLETE (sky) ==================================================
KIT('sky',{size:{w:.97,h:1.03},shoe:0xf3f3f5,cloth:c=>({shirt:c.top,pants:c.pants,cut:[.205,.62,9],sty:3,c2:c.acc,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,tor,sph,gmat,sym,limb,V,S,box}=g;bare(g,c,{legs:true});const ac=gmat(c.acc,.6,0,1),wh=gmat(0xf3f3f5,.7,0,1),bk=gmat(0x15161a,.7,0,5),gold=gmat(0xd9b341,.2,1,0);
  put(tor(.108,.014),ac,0,HY+.05,0,'head',1,1,1.08,Math.PI/2-.12);// headband
  put(tor(.09,.006),gold,0,1.52,-.06,'neck_01',1,1,1.1,Math.PI/2+.5);put(sph(.012,6,5),gold,0,1.43,-.13,'spine_03');// chain
  put(plate(.14,.16,.008,.02),bk,0,1.28,.14,'spine_03');put(box(.04,.07,.006),wh,0,1.28,.148,'spine_03');// jersey number
  sym((s,l)=>{put(tor(.047,.015),wh,...jv(g,'fore',.82,s),'lowerarm_'+l,1,1,1,.9,0,s*-.6);put(tor(.054,.012),ac,...jv(g,'upper',.9,s),'upperarm_'+l,1,1,1,.9,0,s*-.7);
   put(tor(.075,.016),ac,s*.152,.48,-.03,'calf_'+l,1,1,1,Math.PI/2);limb(s,'shin',.1,.3,.066,.062,wh);
   put(g.plate(.105,.08,.27,.04),wh,s*.204,.05,-.06,'foot_'+l);put(g.plate(.11,.025,.28,.01),ac,s*.204,.012,-.06,'foot_'+l);put(g.plate(.07,.1,.03,.01),ac,s*.204,.1,-.0,'foot_'+l)})}});
// ================================================== BIKER (sunset) ==================================================
KIT('sunset',{size:{w:1.12,h:1.0},hide:{hair:1},shoe:0x141414,cloth:c=>({shirt:0x1a1a1c,pants:0x2a3350,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,tor,sph,gmat,sym,limb,V,S,box,cone,low}=g;const lea=gmat(0x151517,.45,.05,5),ac=gmat(c.acc,.55,0,1),chr=gmat(0xc7ccd2,.12,1,0),bk=gmat(0x0e0e10,.5,.3,5),jn=gmat(c.pants,.9,0,1);
  put(lathe([[0,.125],[.07,.12],[.115,.085],[.133,.03],[.137,-.02]],S),bk,0,HY+.03,.0,'head',1,1,1.1);put(tor(.136,.01),chr,0,HY+.013,0,'head',1,1,1.1,Math.PI/2);// half helmet
  put(plate(.2,.03,.02,.01),gmat(0x050505,.05,.6,4),0,HY-.0,-.155,'head');put(tor(.12,.01),ac,0,HY+.075,0,'head',1,1,1.1,Math.PI/2);put(sph(.012,6,5),chr,0,HY+.07,-.15,'head');// shades + stripe
  g.shell([[.2,1.08],[.225,1.2],[.235,1.3],[.22,1.4],[.15,1.46]],lea,'spine_03',.92);
  put(lathe([[.2,0],[.17,.06],[.12,.07]],S),lea,0,1.47,-.012,'neck_01',1,1,1.0);for(const s of[-1,1])put(plate(.1,.14,.012,.02),lea,s*.09,1.4,-.21,'spine_03',1,1,1,.25,0,s*.4);// collar + lapels
  put(plate(.14,.03,.05,.01),chr,0,1.27,-.2,'spine_03',1,1,1);seg(V(-.19,1.13,-.2),V(.19,1.13,-.2),.006,.006,chr,'spine_03',4);// zipper
  put(plate(.28,.3,.012,.05),ac,0,1.28,.2,'spine_03');put(plate(.2,.2,.014,.04),bk,0,1.28,.205,'spine_03');// back patch
  put(lathe([[.236,-.1],[.24,-.04],[.24,0]],S),lea,0,1.0,-.02,'pelvis',1,1,.9);
  for(let i=0;i<10;i++)put(tor(.025,.006),chr,.02*i-.1,.92,-.2,'pelvis',1,1,1,0,.5,0);// chain
  sym((s,l)=>{ell(lea,s*.225,1.44,-.018,.085,.075,.085,'upperarm_'+l);for(let i=0;i<3;i++)put(sph(.008,5,4),chr,s*(.22+i*.02),1.5-i*.012,-.07+i*.03,'upperarm_'+l);limb(s,'upper',.1,.95,.07,.062,lea);limb(s,'fore',.0,.82,.062,.054,lea);put(tor(.06,.01),ac,...jv(g,'fore',.5,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(bk,s*.522,1.075,-.245,.052,.045,.08,'hand_'+l);
   limb(s,'thigh',.05,1,.1,.09,jn);limb(s,'shin',.0,.5,.082,.07,jn);limb(s,'shin',.4,1,.07,.066,bk);put(cyl(.08,.075,.3),bk,s*.185,.17,-.025,'calf_'+l);put(plate(.12,.09,.04,.02),chr,s*.154,.12,-.1,'calf_'+l);put(g.plate(.12,.1,.28,.04),bk,s*.204,.05,-.07,'foot_'+l)});
 }});
// ================================================== GHILLIE SNIPER (ranger) ==================================================
KIT('ranger',{size:{w:1.18,h:1.0},hide:{hair:1},shoe:0x3b3a24,cloth:c=>({shirt:dk(c.top,.5),pants:dk(c.pants,.6),rough:1}),
 build(g,c){const {put,seg,lathe,ell,gmat,sym,V,S,low}=g;const M=[gmat(c.top,.95,0,7),gmat(dk(c.top,.7),.95,0,7),gmat(c.acc,.95,0,7),gmat(dk(c.pants,.8),.95,0,7),gmat(lt(c.top,.25),.95,0,7)];
  ell(M[1],0,HY+.02,.0,.135,.14,.14,'head');put(lathe([[.15,0],[.2,-.12],[.22,-.2]],S),M[3],0,HY-.05,.02,'head',1,1,1.0);
  g.fine();const N=low?1:1;const n=(k)=>Math.round(k*N);
  shag(g,V(0,HY+.08,-.02),V(0,HY+.08,.04),n(26),.1,.13,M,'head',11,.9,.02);
  shag(g,V(-.2,1.46,-.0),V(.2,1.46,.0),n(48),.14,.18,M,'spine_03',21,1,.022);shag(g,V(0,1.1,0),V(0,1.4,0),n(70),.2,.22,M,'spine_03',31,1.1,.024);
  shag(g,V(0,.98,0),V(0,.9,0),n(36),.2,.28,M,'pelvis',41,1.2,.025);
  g.sym((s,l)=>{shag(g,g.jp('upper',0,s),g.jp('upper',1,s),n(24),.07,.2,M,'upperarm_'+l,51+s*7,1,.02);shag(g,g.jp('fore',0,s),g.jp('fore',1,s),n(22),.06,.22,M,'lowerarm_'+l,61+s*7,1,.02);
   shag(g,g.jp('thigh',0,s),g.jp('thigh',1,s),n(26),.1,.24,M,'thigh_'+l,71+s*7,1.2,.022);shag(g,g.jp('shin',0,s),g.jp('shin',.7,s),n(20),.08,.2,M,'calf_'+l,81+s*7,1.2,.02)});
  g.fine(false)}});
// ================================================== COWBOY (tiger) ==================================================
KIT('tiger',{size:{w:1.04,h:1.01},shoe:0x4a2d18,cloth:c=>({shirt:0xb8573a,pants:0x2b3a5a,sty:0,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const lea=gmat(c.top,.7,0,5),lea2=gmat(dk(c.top,.55),.7,0,5),felt=gmat(0xc9a36a,.9,0,1),band=gmat(0x2a1a10,.8,0,5),gold=gmat(c.acc,.25,.9,2),red=gmat(0xc0392b,.85,0,1);
  put(lathe([[0,.1],[.06,.098],[.09,.07],[.1,.01],[.105,-.02]],S),felt,0,HY+.075,.0,'head',1,1.05,1.12);put(lathe([[.1,0],[.18,.012],[.27,.045],[.29,.07]],S),felt,0,HY+.052,0,'head',1,1,1.12);// crown + curled brim
  put(tor(.105,.012),band,0,HY+.07,0,'head',1,1.05,1.12,Math.PI/2);put(sph(.016,6,5),gold,0,HY+.07,-.13,'head');put(plate(.012,.03,.02,.004),gold,0,HY+.115,-.0,'head');
  put(lathe([[.082,-.05],[.1,0],[.09,.03]],S),red,0,1.505,-.012,'neck_01');put(cone(.07,.14,4),red,0,1.4,-.19,'spine_03',1,1,.3,Math.PI,0,.0);// bandana
  g.shell([[.19,1.12],[.21,1.2],[.22,1.3],[.2,1.4]],lea,'spine_03',.9);put(plate(.04,.3,.012,.01),lea2,0,1.27,-.2,'spine_03');for(let i=0;i<4;i++)put(sph(.008,5,4),gold,-.025,1.17+i*.07,-.2,'spine_03');
  put(lathe([[.2,-.03],[.205,0],[.2,.03]],S),lea2,0,1.0,-.02,'pelvis',1,1,.9);put(plate(.09,.06,.02,.01),gold,0,1.0,-.19,'pelvis');
  put(plate(.075,.2,.07,.02),lea2,.2,.88,-.09,'thigh_r');ell(gmat(0x777c82,.25,.9,2),.2,.78,-.14,.02,.045,.06,'thigh_r');// holster + revolver butt
  sym((s,l)=>{limb(s,'fore',.05,.9,.05,.044,gmat(0x5a2e1a,.7,0,5));ell(lea2,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);
   put(plate(.12,.4,.02,.03),lea,s*.14,.72,-.098,'thigh_'+l,1,1,1,-.05,0,s*.12);put(plate(.1,.38,.02,.03),lea,s*.17,.31,-.075,'calf_'+l);// chaps
   put(cyl(.08,.07,.34),lea2,s*.152,.28,-.03,'calf_'+l);put(g.plate(.1,.12,.3,.04),lea2,s*.204,.06,-.08,'foot_'+l);put(cone(.05,.1),lea2,s*.204,.045,-.27,'foot_'+l,1,1,.7,-Math.PI/2);put(sph(.022,5,4),gold,s*.204,.07,.07,'foot_'+l)})}});
// ================================================== WIZARD (moonmage) ==================================================
KIT('moonmage',{size:{w:1.0,h:1.03},hide:{hair:1},shoe:0x2a2018,cloth:c=>({shirt:dk(c.top,.7),pants:dk(c.top,.6),rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const rb=gmat(c.top,.85,0,1),rb2=gmat(dk(c.top,.7),.85,0,1),gold=gmat(c.acc,.25,.9,2),wh=gmat(0xece8df,.95,0,7),wood=gmat(0x5a3b22,.7,0,5),orb=gmat(0x7fe0ff,.05,.2,4);
  put(cyl(.26,.26,.012,S),rb2,0,HY+.075,0,'head',1,1,1);put(cone(.165,.18,S),rb2,0,HY+.16,0,'head');put(cone(.12,.2,S),rb2,.03,HY+.32,.03,'head',1,1,1,.12,0,-.2);put(cone(.07,.2,S),rb2,.12,HY+.48,.08,'head',1,1,1,.5,0,-.55);// bent cone hat
  put(tor(.165,.014),gold,0,HY+.088,0,'head',1,1,1,Math.PI/2);for(let i=0;i<3;i++)put(plate(.03,.03,.004,.005),gold,-.05+i*.05,HY+.17+i*.02,-.13,'head',1,1,1,-.2);
  put(cone(.075,.4,S),wh,0,HY-.3,-.1,'head',1,1,.55,Math.PI,0,0);ell(wh,0,HY-.06,-.115,.085,.04,.04,'head');// beard + moustache
  put(lathe([[.1,-.02],[.13,0],[.11,.05]],S),rb,0,1.5,-.012,'neck_01');
  g.shell([[.19,1.05],[.21,1.2],[.22,1.3],[.2,1.4],[.15,1.465]],rb,'spine_03',.9);
  put(lathe([[.2,1.0],[.3,.55],[.4,.12]],S),rb,0,0,-.01,'pelvis',1,1,.92);put(lathe([[.4,.14],[.405,.1],[.41,.08]],S),gold,0,0,-.01,'pelvis',1,1,.92);// long robe skirt
  put(lathe([[.2,-.03],[.21,0],[.2,.03]],S),gmat(0x8a6a3a,.8,0,3),0,1.0,-.02,'pelvis',1,1,.9);
  put(plate(.14,.14,.05,.03),wood,.22,.95,-.12,'pelvis');// pouch
  sym((s,l)=>{limb(s,'upper',.05,1,.065,.07,rb);limb(s,'fore',.0,1,.065,.14,rb);put(tor(.14,.012),gold,...jv(g,'fore',.98,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(gmat(0xe0b894,.6,0,0),s*.522,1.075,-.245,.04,.036,.065,'hand_'+l)});
  seg(V(.27,.1,.24),V(.3,1.95,.22),.02,.016,wood,'spine_03');ell(orb,.3,2.0,.22,.055,.055,.055,'spine_03');put(tor(.06,.008),gold,.3,1.95,.22,'spine_03',1,1,1,Math.PI/2);// staff
  put(sph(.03,8,6),orb,0,1.4,-.22,'spine_03');put(tor(.04,.004),gold,0,1.44,-.2,'spine_03');// amulet
 }});
// ================================================== HAZMAT (hazard) ==================================================
KIT('hazard',{size:{w:1.15,h:1.0},hide:{hair:1,brow:1,lash:1},shoe:0x121214,cloth:c=>({shirt:c.top,pants:c.top,rough:.7}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,tor,sph,gmat,sym,limb,V,S,box,low}=g;const su=gmat(c.top,.5,0,0),su2=gmat(dk(c.top,.8),.55,0,0),bk=gmat(0x131315,.5,0,5),gl=gmat(0x142233,.04,.5,0),tape=gmat(0x1a1a1a,.7,0,1),fil=gmat(0x3c3f45,.5,.5,2),or=gmat(0xff7a1a,.5,0,0);
  ell(su,0,HY+.02,.0,.14,.145,.15,'head');put(lathe([[.13,0],[.17,-.05],[.19,-.1]],S),su,0,HY-.02,0,'head',1,1,1);
  ell(gl,0,HY+.0,-.08,.115,.095,.1,'head');for(const s of[-1,1]){put(cyl(.036,.036,.05),fil,s*.07,HY-.075,-.145,'head',1,1,1,Math.PI/2);put(tor(.036,.008),or,s*.07,HY-.075,-.165,'head');}
  put(lathe([[.1,-.04],[.14,0],[.12,.05]],S),su,0,1.52,-.012,'neck_01');
  g.shell([[.2,1.08],[.23,1.2],[.245,1.32],[.225,1.42],[.16,1.48]],su,'spine_03',.92);put(lathe([[.24,-.1],[.26,-.05],[.26,0]],S),su,0,1.0,-.02,'pelvis',1,1,.9);
  put(cyl(.06,.06,.1),fil,0,1.3,-.215,'spine_03',1,1,1,Math.PI/2);put(tor(.06,.01),or,0,1.3,-.26,'spine_03');put(plate(.3,.4,.12,.05),su2,0,1.25,.23,'spine_03');put(cyl(.05,.05,.3),fil,.1,1.3,.31,'spine_03');
  seg(V(0,1.3,-.26),V(.1,1.5,.2),.012,.012,bk,'spine_03');
  sym((s,l)=>{limb(s,'upper',.04,.95,.08,.073,su);limb(s,'fore',.0,.95,.07,.064,su);put(tor(.066,.012),tape,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(bk,s*.522,1.075,-.245,.064,.056,.09,'hand_'+l);
   limb(s,'thigh',.0,1,.115,.104,su);limb(s,'shin',.0,.95,.098,.088,su);put(tor(.09,.012),tape,s*.2,.1,-.014,'calf_'+l,1,1,1,Math.PI/2);put(g.plate(.14,.12,.3,.05),bk,s*.204,.06,-.07,'foot_'+l)})}});
// ================================================== VIKING (viking) ==================================================
KIT('viking',{size:{w:1.2,h:1.04},hide:{hair:1},hair:0x8a5a2a,shoe:0x3a2a1c,cloth:c=>({shirt:0x6a5a40,pants:0x4a3a28,rough:.98}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const lea=gmat(c.top,.75,0,5),lea2=gmat(dk(c.top,.6),.75,0,5),iron=gmat(0x7a8088,.38,.9,2),fur=[gmat(c.acc,.95,0,7),gmat(dk(c.acc,.75),.95,0,7),gmat(lt(c.acc,.3),.95,0,7)],hair=gmat(0xa0652c,.9,0,7),bone=gmat(0xe8dfc9,.6,0,0);
  put(lathe([[0,.12],[.07,.116],[.115,.085],[.133,.03],[.137,-.02]],S),iron,0,HY+.03,.0,'head',1,1,1.1);put(tor(.136,.01),gmat(0x4a3a20,.6,.5,2),0,HY+.015,0,'head',1,1,1.1,Math.PI/2);
  put(plate(.02,.1,.015,.005),iron,0,HY-.02,-.16,'head');for(const s of[-1,1]){seg(V(s*.13,HY+.03,0),V(s*.2,HY+.1,0),.022,.016,bone,'head',6);seg(V(s*.2,HY+.1,0),V(s*.24,HY+.2,.02),.016,.006,bone,'head',6)}// horns
  ell(hair,0,HY-.0,.07,.12,.14,.07,'head');// long hair
  ell(hair,0,HY-.12,-.09,.095,.11,.065,'head');cone;put(cone(.07,.3,6),hair,0,HY-.34,-.12,'head',1,1,.6,Math.PI,0,0);// beard
  for(const s of[-1,1])seg(V(s*.05,HY-.12,-.12),V(s*.07,1.3,-.2),.012,.01,hair,'head',5);
  g.shell([[.2,1.08],[.225,1.2],[.235,1.3],[.215,1.4],[.15,1.46]],lea,'spine_03',.92);put(plate(.05,.34,.012,.01),lea2,0,1.26,-.222,'spine_03');for(let i=0;i<5;i++)seg(V(-.06,1.14+i*.06,-.22),V(.06,1.14+i*.06,-.22),.006,.006,gmat(0xc9b27a,.9,0,3),'spine_03',4);
  g.fine();for(let i=0;i<14;i++){const a=i/14*Math.PI*2;put(sph(.062,6,5),fur[i%3],Math.sin(a)*.2,1.45,Math.cos(a)*.17-.01,'spine_03',1,.75,1)}g.fine(false);// fur mantle
  put(lathe([[.2,1.46],[.24,1.5],[.2,1.52]],S),fur[0],0,0,-.02,'spine_03',1,1,.9);
  put(lathe([[.236,-.03],[.24,0],[.236,.03]],S),lea2,0,1.0,-.02,'pelvis',1,1,.9);put(plate(.05,.05,.015,.01),iron,0,1.0,-.2,'pelvis');
  put(cyl(.29,.29,.03,S),gmat(c.top,.7,0,1),0,1.28,.26,'spine_03',1,1,1,Math.PI/2);put(cyl(.06,.06,.05),iron,0,1.28,.29,'spine_03',1,1,1,Math.PI/2);put(tor(.285,.015),iron,0,1.28,.26,'spine_03');// round shield on back
  seg(V(-.22,.85,-.05),V(-.2,1.15,-.1),.012,.012,lea2,'pelvis',5);put(plate(.04,.14,.012,.01),iron,-.22,1.2,-.08,'pelvis',1,1,1,0,.5,0);// axe
  sym((s,l)=>{limb(s,'upper',.05,.95,.07,.062,gmat(0x6a5a40,.9,0,1));limb(s,'fore',.12,.9,.056,.05,lea2);put(tor(.054,.008),iron,...jv(g,'fore',.2,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(lea2,s*.522,1.075,-.245,.05,.044,.078,'hand_'+l);
   limb(s,'shin',.0,.9,.08,.07,gmat(0x4a3a28,.9,0,3));for(let i=0;i<4;i++)put(tor(.068,.006),lea2,s*(.16+i*.012),.12+i*.08,-.025,'calf_'+l,1,1,1,Math.PI/2);put(cyl(.1,.09,.12),fur[1],s*.152,.2,-.025,'calf_'+l);put(g.plate(.12,.1,.28,.04),lea2,s*.204,.05,-.07,'foot_'+l)})}});
// ================================================== GLADIATOR (gladiator) ==================================================
KIT('gladiator',{size:{w:1.14,h:1.02},hide:{hair:1,cloth:1},shoe:0x5a3a20,
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;bare(g,c,{legs:true,t0:.2});const br=gmat(c.acc,.3,.85,2),lea=gmat(0x6a3a1c,.6,0,5),lea2=gmat(c.pants,.7,0,5),sk=gmat(c.skin,.55,0,0),red=gmat(0xb31b1b,.9,0,7);
  // bare chest (torso skin)
  g.shell([[.18,1.06],[.192,1.18],[.205,1.3],[.195,1.4],[.14,1.46]],sk,'spine_03',.92);for(const s of[-1,1])ell(sk,s*.09,1.34,-.17,.085,.07,.045,'spine_03');for(let i=0;i<3;i++)for(const s of[-1,1])ell(sk,s*.045,1.24-i*.06,-.2,.05,.028,.03,'spine_03');
  seg(V(-.15,1.45,-.12),V(.17,1.08,-.2),.022,.02,lea,'spine_03',5,.4);seg(V(.15,1.45,-.12),V(-.17,1.08,-.2),.022,.02,lea,'spine_03',5,.4);seg(V(-.15,1.45,.1),V(.17,1.08,.18),.022,.02,lea,'spine_03',5,.4);seg(V(.15,1.45,.1),V(-.17,1.08,.18),.022,.02,lea,'spine_03',5,.4);put(sph(.03,8,6),br,0,1.27,-.22,'spine_03');
  put(lathe([[.2,-.04],[.21,0],[.2,.04]],S),lea,0,1.0,-.02,'pelvis',1,1,.9);for(let i=0;i<10;i++){const a=i/10*Math.PI*2;put(plate(.075,.2,.01,.015),i%2?lea2:lea,Math.sin(a)*.215,.88,Math.cos(a)*.19-.01,'pelvis',1,1,1,0,a,0)}// pteruges
  // galea helmet with face grille + crest
  put(lathe([[0,.13],[.07,.125],[.115,.095],[.14,.04],[.148,-.03],[.14,-.1]],S),br,0,HY+.01,.0,'head',1,1,1.08);for(let i=0;i<4;i++)put(plate(.014,.12,.014,.004),br,-.045+i*.03,HY-.05,-.165,'head');put(plate(.16,.014,.016,.004),br,0,HY-.01,-.162,'head');put(plate(.17,.012,.016,.004),br,0,HY-.08,-.16,'head');
  for(let i=0;i<8;i++){const a=i/7,z=-.1+a*.26;ell(red,0,HY+.16+Math.sin(Math.PI*a)*.06,z,.03,.045,.04,'head',-.5+a)}
  sym((s,l)=>{if(s>0){for(let i=0;i<5;i++)limb(s,'fore',.02+i*.19,.12+i*.19,.052-i*.002,.05,br,S,1.0);for(let i=0;i<3;i++)limb(s,'upper',.1+i*.25,.2+i*.25,.062,.06,br)}
   else{ell(br,s*.225,1.45,-.018,.12,.1,.11,'upperarm_'+l);put(plate(.06,.17,.02,.02),br,...jv(g,'fore',.55,s),'lowerarm_'+l,1,1,1,.3,0,0)}
   ell(lea,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);limb(s,'shin',.1,.85,.07,.056,br);put(plate(.1,.1,.02,.03),br,s*.152,.53,-.085,'calf_'+l);for(let i=0;i<3;i++)seg(V(s*.2,.06,-.04),V(s*.2,.28+i*.03,-.04+i*.02),.006,.006,lea,'foot_'+l,4)})}});
// ================================================== PHARAOH (candy) ==================================================
KIT('candy',{size:{w:1.0,h:1.03},hide:{hair:1,cloth:1},shoe:0xd4a83a,skin:{rough:.6},
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;bare(g,c,{legs:true,t0:.2});const gold=gmat(c.acc,.22,1,2),bl=gmat(0x2a6bd0,.4,.2,0),lin=gmat(0xf3ecd8,.9,0,1),lin2=gmat(0xd9ceb0,.9,0,3),sk=gmat(c.skin,.55,0,0),dkm=gmat(0x0a0a0a,.6,0,0);
  // nemes headdress: striped cap, side lappets, back tail, cobra
  put(lathe([[0,.13],[.07,.125],[.12,.09],[.14,.03],[.15,-.03]],S),bl,0,HY+.03,.0,'head',1,1,1.1);for(let i=0;i<5;i++)put(tor(.13-i*.016,.006),gold,0,HY+.01+i*.03,0,'head',1,1,1.1,Math.PI/2);
  
  for(const s of[-1,1]){put(plate(.07,.3,.02,.012),bl,s*.125,HY-.16,-.07,'head',1,1,1,0,s*.35,0);for(let i=0;i<4;i++)put(box(.07,.012,.022),gold,s*.125,HY-.06-i*.07,-.075,'head',1,1,1,0,s*.35,0)}
  put(plate(.15,.32,.025,.015),bl,0,HY-.17,.13,'head');put(cone(.022,.09,6),gold,0,HY+.12,-.17,'head',1,1,.6,.3,0,0);put(plate(.1,.03,.01,.01),dkm,0,HY+.0,-.165,'head');
  for(const s of[-1,1])put(plate(.05,.012,.01,.004),dkm,s*.04,HY+.01,-.163,'head');// kohl
  put(lathe([[.1,.0],[.15,-.03],[.2,-.1],[.25,-.14]],S),gold,0,1.5,-.03,'spine_03',1,1,.9);for(let i=0;i<3;i++)put(lathe([[.14+i*.04,-.012-.03*i],[.15+i*.04,-.005-.03*i],[.14+i*.04,.002-.03*i]],S),i%2?bl:lin2,0,1.46-i*.0,-.03,'spine_03',1,1,.9);// usekh collar
  g.shell([[.18,1.06],[.19,1.18],[.205,1.3],[.195,1.4],[.14,1.46]],sk,'spine_03',.92);
  put(lathe([[.2,1.01],[.27,.74]],S),lin,0,0,-.01,'pelvis',1,1,.9);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;put(box(.012,.27,.01),lin2,Math.sin(a)*.235,.86,Math.cos(a)*.21-.01,'pelvis',1,1,1,0,a,0)}
  put(plate(.1,.26,.012,.02),gold,0,.86,-.215,'pelvis',1,1,1,.05);put(lathe([[.2,-.03],[.21,0],[.2,.03]],S),gold,0,1.02,-.02,'pelvis',1,1,.9);
  sym((s,l)=>{put(tor(.055,.014),gold,...jv(g,'upper',.7,s),'upperarm_'+l,1,1,1,.9,0,s*-.7);put(tor(.04,.012),gold,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(sk,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);put(tor(.06,.01),gold,s*.152,.2,-.03,'calf_'+l,1,1,1,Math.PI/2);
   put(g.plate(.09,.03,.24,.02),gold,s*.204,.03,-.06,'foot_'+l)});
  seg(V(.3,.1,.2),V(.34,1.7,.15),.015,.012,gold,'spine_03');put(g.tor(.07,.012,Math.PI*1.2),gold,.34,1.75,.15,'spine_03');// crook staff
 }});
// ================================================== ZOMBIE (forest) ==================================================
KIT('forest',{skinK:0,size:{w:.94,h:1.03},hair:0x2a2a20,shoe:0x2a2a22,skin:{col:0xc8dcb0,rough:.8,eye:0xd8d7a0},
 cloth:c=>({shirt:dk(c.top,.8),pants:dk(c.pants,.9),cut:[.3,.5,9],sty:2,c2:0x8a1c1c,rough:1}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;bare(g,c,{arms:true,legs:true,t0:.55,a0:.4});const rag=gmat(dk(c.top,.8),.95,0,1),blood=gmat(0x6a1212,.5,0,0),band=gmat(0xcfc6a8,.9,0,3),gr=gmat(0x4a553e,.9,0,1);
  put(plate(.05,.07,.01,.01),blood,-.04,HY-.06,-.15,'head');put(plate(.05,.04,.01,.01),blood,.05,HY-.04,-.15,'head',1,1,1,0,0,.5);put(box(.1,.03,.01),gmat(0x1b1010,.6,0,0),0,HY-.095,-.15,'head');// wounds + torn mouth
  for(let i=0;i<5;i++)seg(V(-.14+i*.07,1.1,-.19),V(-.15+i*.07+((i%2)?.02:-.02),.82+((i*37)%5)*.02,-.2),.012,.006,rag,'pelvis',4,.3);// hanging rags
  for(let i=0;i<3;i++){seg(V(-.19,1.4,-.06+i*.05),V(-.27,1.12+i*.02,-.06+i*.05),.01,.005,rag,'spine_03',4,.4)}
  put(plate(.12,.18,.02,.03),band,-.1,1.2,-.205,'spine_03',1,1,1,0,0,.2);put(tor(.054,.012),band,...jv(g,'fore',.4,1),'lowerarm_r',1,1,1,.9,0,-.7);put(tor(.054,.012),band,...jv(g,'fore',.6,-1),'lowerarm_l',1,1,1,.9,0,.7);
  sym((s,l)=>{put(g.plate(.1,.08,.26,.03),gr,s*.204,.04,-.06,'foot_'+l)});
  put(plate(.09,.08,.02,.02),blood,.1,1.34,-.2,'spine_03');put(plate(.07,.05,.02,.02),blood,.13,.7,-.1,'thigh_r')}});
// ================================================== MUMMY (lemon) ==================================================
KIT('lemon',{size:{w:1.04,h:1.01},hide:{hair:1,brow:1,lash:1},shoe:0xcdbf98,cloth:c=>({shirt:c.top,pants:c.pants,sty:1,c2:dk(c.top,.55),rough:1}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const wr=gmat(c.top,.95,0,3),wr2=gmat(dk(c.top,.7),.95,0,3),gl=gmat(0xffa030,.1,0,4),dkm=gmat(0x1a1208,.8,0,0);
  ell(wr,0,HY+.02,.0,.115,.125,.125,'head');for(let i=0;i<7;i++)put(tor(.118-Math.abs(i-3)*.007,.008),i%2?wr:wr2,0,HY-.065+i*.036,.0,'head',1,1,1.07,Math.PI/2);put(box(.13,.025,.01),dkm,0,HY+.01,-.135,'head');for(const s of[-1,1])ell(gl,s*.035,HY+.01,-.14,.014,.01,.008,'head');
  seg(V(.1,HY+.0,-.1),V(.2,HY-.15,-.14),.01,.006,wr,'head',4,.3);
  g.shell([[.18,1.06],[.2,1.18],[.215,1.3],[.2,1.4],[.15,1.46]],wr,'spine_03',.92);for(let i=0;i<8;i++)put(lathe([[.185+(i%3)*.012,-.007],[.2+(i%3)*.012,0],[.185+(i%3)*.012,.007]],S),i%2?wr2:wr,0,1.1+i*.045,-.02,'spine_03',1,1,.92);
  seg(V(-.2,1.4,-.1),V(.2,1.12,-.2),.02,.018,wr2,'spine_03',4,.3);
  for(let i=0;i<4;i++)seg(V(-.15+i*.1,1.0,-.15),V(-.17+i*.1,.72-i%2*.1,-.17),.012,.006,wr,'pelvis',4,.3);seg(V(.15,1.4,.2),V(.12,.9,.25),.014,.008,wr,'spine_03',4,.3);
  sym((s,l)=>{limb(s,'upper',.05,.95,.056,.05,wr);limb(s,'fore',0,.95,.05,.044,wr2);ell(wr,s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);seg(V(s*.5,1.04,-.2),V(s*.5,.75,-.28),.01,.004,wr,'hand_'+l,4,.3);limb(s,'thigh',.0,1,.092,.075,wr);limb(s,'shin',0,.95,.066,.052,wr2);put(g.plate(.1,.08,.26,.03),wr,s*.204,.04,-.06,'foot_'+l)})}});
// ================================================== SKELETON WARRIOR (void) ==================================================
KIT('void',{size:{w:.92,h:1.03},hide:{skin:1,cloth:1,hair:1,brow:1,lash:1,eye:1,shoes:1},
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const bn=gmat(0xe6dfc8,.55,0,0),bn2=gmat(0xc9c0a4,.6,0,0),bk=gmat(0x0a0a0c,.9,0,0),gl=gmat(c.acc,.1,0,4),cl=gmat(c.top,.95,0,1),rust=gmat(0x4a3a30,.6,.7,2);
  ell(bn,0,HY+.025,-.005,.098,.115,.115,'head');ell(bn,0,HY-.05,-.05,.07,.04,.06,'head');// skull + cheek
  for(const s of[-1,1]){ell(bk,s*.04,HY+.0,-.105,.03,.028,.02,'head');ell(gl,s*.04,HY+.0,-.118,.012,.012,.008,'head')}put(cone(.014,.03,3),bk,0,HY-.03,-.115,'head',1,1,.5,Math.PI,0,0);
  put(plate(.09,.04,.06,.015),bn2,0,HY-.1,-.06,'head');for(let i=0;i<6;i++)put(box(.011,.016,.01),bn,-.0275*2.5+i*.0275,HY-.082,-.107,'head');// jaw + teeth
  for(let i=0;i<6;i++)ell(bn2,0,1.5-i*.0,.0,.02,.02,.02,'neck_01');
  for(let i=0;i<9;i++)ell(bn2,0,1.46-i*.05,.05+(i<4?0:.01),.026,.025,.026,'spine_03');// spine
  g.fine();for(let i=0;i<6;i++){const y=1.43-i*.055,r=.17-Math.abs(i-1.5)*.012;for(const s of[-1,1])put(tor(r,.011,Math.PI*.78),bn,0,y,-.02,'spine_03',1,1,.8,Math.PI/2,0,s>0?Math.PI*.11:Math.PI*1.11)}g.fine(false);
  put(plate(.04,.2,.02,.01),bn,0,1.3,-.17,'spine_03');
  ell(bn,0,.98,0,.16,.07,.1,'pelvis');for(const s of[-1,1])ell(bn,s*.12,.96,.0,.07,.1,.07,'pelvis');
  put(plate(.36,.9,.01,.04),cl,0,1.0,.17,'spine_03',1,1,1,.06);
  sym((s,l)=>{ell(bn,s*.2,1.43,-.018,.036,.036,.036,'upperarm_'+l);limb(s,'upper',.05,.95,.022,.019,bn);ell(bn,...jv(g,'fore',0,s),.028,.028,.028,'lowerarm_'+l);limb(s,'fore',.05,.95,.02,.016,bn);limb(s,'fore',.05,.95,.02,.016,bn2);ell(bn,s*.522,1.075,-.245,.036,.03,.062,'hand_'+l);
   limb(s,'thigh',.05,.95,.032,.026,bn);ell(bn,s*.152,.52,-.028,.036,.036,.036,'calf_'+l);limb(s,'shin',.05,.95,.026,.02,bn2);put(g.plate(.05,.04,.2,.02),bn,s*.204,.03,-.07,'foot_'+l);
   if(s<0){ell(rust,s*.235,1.45,-.018,.1,.07,.1,'upperarm_'+l);put(plate(.1,.14,.02,.02),rust,...jv(g,'fore',.5,s),'lowerarm_'+l,1,1,1,.3,0,0)}});
  put(lathe([[.1,.0],[.17,-.4],[.2,-.7]],S,Math.PI-1.2,2.4),cl,0,1.2,.1,'spine_03',1,1,.7);// tattered cloak
 }});
// ================================================== ALIEN (jungle) ==================================================
KIT('jungle',{skinK:0,size:{w:.9,h:1.05},head:1.26,hide:{hair:1,brow:1,lash:1,eye:1},shoe:0x1c2430,skin:{col:0xc4e0cc,rough:.35,env:.9},cloth:c=>({shirt:c.pants,pants:c.pants,sty:3,c2:c.acc,rough:.5}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const gl=gmat(c.acc,.1,0,4),eye=gmat(0x05080a,.04,.7,0),su=gmat(c.pants,.45,.2,0),sk=gmat(c.skin,.35,0,0);
  for(const s of[-1,1]){ell(eye,s*.062,HY+.005,-.185,.062,.034,.03,'head',0,0,s*.45);ell(gmat(0xffffff,.05,.5,0),s*.055,HY+.015,-.2,.01,.006,.004,'head')}
  put(box(.012,.015,.01),gmat(0x5a6a5e,.5,0,0),0,HY-.075,-.19,'head');put(plate(.05,.008,.01,.004),gmat(0x5a6a5e,.5,0,0),0,HY-.12,-.185,'head');
  g.shell([[.17,1.06],[.18,1.18],[.19,1.3],[.18,1.4],[.13,1.46]],su,'spine_03',.9);put(tor(.04,.006),gl,0,1.32,-.19,'spine_03');put(plate(.012,.2,.01,.004),gl,0,1.2,-.2,'spine_03');
  sym((s,l)=>{limb(s,'upper',.05,.95,.04,.034,sk);limb(s,'fore',0,.98,.034,.028,sk);ell(sk,s*.522,1.075,-.245,.04,.032,.08,'hand_'+l);for(let i=0;i<3;i++)seg(V(s*.53,1.05,-.3),V(s*(.55+i*.012),1.0-i*.01,-.38),.007,.004,sk,'hand_'+l,4);
   limb(s,'thigh',.0,1,.07,.056,su);limb(s,'shin',0,.95,.052,.04,su);put(plate(.08,.07,.24,.03),gmat(0x1c2430,.5,.3,0),s*.204,.04,-.06,'foot_'+l);put(plate(.012,.16,.01,.004),gl,s*.14,.8,-.07,'thigh_'+l)});
 }});
// ================================================== DEMON LORD (inferno) ==================================================
KIT('inferno',{skinK:0,size:{w:1.22,h:1.07},hide:{hair:1,brow:1,lash:1},shoe:0x1a0a0a,skin:{col:0xd04030,rough:.5,eye:0xffc020,em:.05},cloth:c=>({shirt:c.top,pants:c.pants,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;bare(g,c,{arms:true,legs:true,t0:.3,a0:.2});const rd=gmat(c.skin,.5,0,6),hn=gmat(0x1a1210,.4,.2,0),gl=gmat(c.acc,.1,0,4),blk=gmat(0x1c0f0d,.5,.7,2),wing=gmat(0x3a0e0e,.8,0,1);
  for(const s of[-1,1]){seg(V(s*.07,HY+.1,-.03),V(s*.17,HY+.25,-.07),.032,.02,hn,'head',7);seg(V(s*.17,HY+.25,-.07),V(s*.15,HY+.4,-.15),.02,.005,hn,'head',7)}
  put(plate(.12,.014,.05,.01),hn,0,HY-.12,-.14,'head');for(const s of[-1,1])put(cone(.012,.04,4),hn,s*.04,HY-.13,-.12,'head',1,1,1,Math.PI,0,0);
  g.shell([[.19,1.06],[.21,1.18],[.23,1.3],[.21,1.4],[.14,1.46]],rd,'spine_03',.92);for(let i=0;i<4;i++)for(const s of[-1,1])ell(blk,s*.06,1.4-i*.075,-.2+i*.0,.07,.025,.03,'spine_03');put(tor(.045,.01),gl,0,1.28,-.2,'spine_03');
  for(const s of[-1,1]){ell(blk,s*.225,1.46,-.018,.115,.1,.11,'upperarm_'+(s>0?'r':'l'));for(let i=0;i<3;i++)put(cone(.018,.1,5),hn,s*(.27+i*.0),1.5+i*.0,-.05+i*.04-.04,'upperarm_'+(s>0?'r':'l'),1,1,1,.0,0,s*-1.2+ i*.3*s)}
  put(lathe([[.2,-.03],[.22,0],[.2,.03]],S),blk,0,1.0,-.02,'pelvis',1,1,.9);put(plate(.2,.25,.02,.03),wing,0,.85,-.19,'pelvis');put(plate(.2,.3,.02,.03),wing,0,.83,.17,'pelvis');
  g.fine();for(const s of[-1,1]){for(let i=0;i<4;i++)seg(V(s*.05,1.38,.15),V(s*(.5+i*.2),1.7-i*.12+(i==3?-.1:0),.38+i*.0),.014,.006,hn,'spine_03',5);put(plate(.5,.5,.012,.08),wing,s*.45,1.5,.3,'spine_03',1,1,1,0,s*-.4,s*-.5)}g.fine(false);
  seg(V(0,.98,.08),V(0,.7,.4),.02,.01,rd,'pelvis',5);put(cone(.04,.1,4),hn,0,.62,.46,'pelvis',1,1,1,2.5);
  sym((s,l)=>{put(g.plate(.1,.1,.24,.04),blk,s*.204,.045,-.06,'foot_'+l);for(let i=0;i<3;i++)seg(V(s*(.15+i*.03),.04,-.2),V(s*(.15+i*.03),.015,-.3),.012,.004,hn,'foot_'+l,4);for(let i=0;i<3;i++)seg(V(s*.52,1.05,-.3),V(s*(.53+i*.012),1.0-i*.01,-.41),.01,.004,hn,'hand_'+l,4);
   put(g.cone(.03,.1,4),hn,s*.372,1.23,.05,'lowerarm_'+l,1,1,1,-2.2,0,0)})}});
// ================================================== DRAGON SLAYER (dragon) ==================================================
KIT('dragon',{size:{w:1.12,h:1.03},hide:{hair:1},hair:0x3a2a20,shoe:0x2a1010,cloth:c=>({shirt:c.pants,pants:c.pants,rough:.6}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const sc=gmat(c.top,.4,.35,6),sc2=gmat(dk(c.top,.6),.4,.3,6),gd=gmat(c.acc,.25,.9,2),lea=gmat(0x2a1a14,.7,0,5),gl=gmat(0xff8a1a,.1,0,4),bone=gmat(0xe0d6bc,.6,0,0);
  put(lathe([[0,.13],[.07,.125],[.115,.095],[.14,.04],[.15,-.03],[.145,-.08]],S),sc,0,HY+.01,.0,'head',1,1,1.1);put(plate(.1,.1,.05,.02),sc,0,HY-.1,-.14,'head');put(plate(.06,.12,.012,.01),sc2,0,HY+.01,-.17,'head');// dragon-scale helm with nasal
  for(const s of[-1,1]){seg(V(s*.12,HY+.07,0),V(s*.2,HY+.17,.08),.02,.01,bone,'head',6);seg(V(s*.2,HY+.17,.08),V(s*.22,HY+.28,.2),.01,.004,bone,'head',6)}for(let i=0;i<4;i++)put(cone(.018,.05+.01*i,4),bone,0,HY+.12-i*.01,.0+i*.05,'head',1,1,1,-.3-i*.2);
  for(const s of[-1,1])ell(gl,s*.04,HY-.0,-.147,.012,.007,.005,'head');
  g.shell([[.2,1.08],[.225,1.2],[.235,1.3],[.215,1.4],[.15,1.46]],sc,'spine_03',.93);for(let i=0;i<5;i++)put(tor(.215-i*.0,.012,Math.PI),sc2,0,1.12+i*.065,-.02,'spine_03',1,1,.93,Math.PI/2,0,Math.PI*.5);put(plate(.035,.34,.02,.01),gd,0,1.27,-.225,'spine_03');
  sym((s,l)=>{ell(sc2,s*.24,1.46,-.018,.12,.07,.115,'upperarm_'+l);for(let i=0;i<3;i++)put(cone(.025,.1,5),gd,s*(.26+i*.03),1.5-i*.03,-.018,'upperarm_'+l,1,1,1,0,0,-s*(1.2-i*.3));limb(s,'upper',.2,.95,.062,.054,lea);limb(s,'fore',.05,.9,.058,.05,sc2);put(plate(.06,.17,.02,.02),gd,...jv(g,'fore',.5,s),'lowerarm_'+l,1,1,1,.3,0,0);ell(lea,s*.522,1.075,-.245,.05,.044,.078,'hand_'+l);
   limb(s,'thigh',.0,.8,.09,.075,gmat(c.pants,.6,0,1));limb(s,'shin',.1,.85,.07,.056,sc);ell(gd,s*.152,.52,-.075,.058,.058,.04,'calf_'+l);put(g.plate(.1,.1,.26,.04),lea,s*.204,.05,-.06,'foot_'+l)});
  put(lathe([[.2,-.03],[.22,0],[.2,.03]],S),lea,0,1.0,-.02,'pelvis',1,1,.9);put(plate(.12,.25,.02,.04),sc2,0,.85,-.2,'pelvis');
  g.fine();put(cone(.05,.15,5),gd,0,1.3,.2,'spine_03');put(plate(.3,.5,.02,.1),gmat(0x5a1010,.85,0,1),0,1.1,.21,'spine_03');g.fine(false);// tabard + fang brooch
 }});
// ================================================== FROST QUEEN (aurora) ==================================================
KIT('aurora',{size:{w:.93,h:1.02},hide:{hair:1},hair:0xdfeff8,shoe:0xc8e6f5,skinK:0,skin:{col:0xf1f7ff,rough:.4},cloth:c=>({shirt:c.top,pants:c.pants,rough:.4}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const ice=gmat(c.top,.1,.2,4),ic2=gmat(0xeaf8ff,.12,.5,2),silk=gmat(c.pants,.35,.2,0),hair=gmat(0xe8f4ff,.5,.1,0),cr=gmat(0xbff0ff,.05,.3,4);
  ell(hair,0,HY+.01,.04,.125,.135,.115,'head');put(lathe([[.12,0],[.115,-.3],[.09,-.5]],S,Math.PI-1.1,2.2),hair,0,HY-.05,.05,'head',1,1,.8);for(const s of[-1,1])ell(hair,s*.09,HY-.12,-.01,.04,.14,.05,'head');
  for(let i=0;i<7;i++){const a=(i-3)/3*.9;put(cone(.02,.12+.1*(1-Math.abs(i-3)/3.5),4),cr,Math.sin(a)*.1,HY+.12+(1-Math.abs(a))*.01,-.03+Math.cos(a)*.0,'head',1,1,1,0,0,-a)}put(tor(.12,.008),ic2,0,HY+.1,-.02,'head',1,1,1,Math.PI/2);// ice crown
  g.shell([[.17,1.08],[.18,1.2],[.195,1.3],[.185,1.4],[.14,1.46]],ice,'spine_03',.92);put(lathe([[.12,0],[.2,-.06],[.19,-.12]],S),ic2,0,1.5,-.03,'spine_03',1,1,.9);
  for(const s of[-1,1])put(cone(.03,.16,4),cr,s*.2,1.47,-.0,'spine_03',1,1,1,0,0,-s*1.0);// shoulder crystals
  put(lathe([[.2,1.0],[.3,.5],[.42,.05]],S),silk,0,0,0,'pelvis',1,1,1.0);put(lathe([[.42,.05],[.43,.03],[.42,.01]],S),ic2,0,0,0,'pelvis',1,1,1.0);for(let i=0;i<14;i++){const a=i/14*Math.PI*2;put(cone(.02,.08,4),cr,Math.sin(a)*.42,.07,Math.cos(a)*.42,'pelvis',1,1,1,Math.PI,0,0)}
  put(lathe([[.2,-.03],[.215,0],[.2,.03]],S),ic2,0,1.0,-.02,'pelvis',1,1,.9);
  put(lathe([[.1,.0],[.2,-.5],[.38,-1.0]],S,Math.PI-.8,1.6),gmat(0xc8ecff,.3,.1,0),0,1.45,.12,'spine_03',1,1,.8);// train cape
  sym((s,l)=>{limb(s,'upper',.05,.95,.04,.036,gmat(c.skin,.5,0,0));limb(s,'fore',0,.95,.04,.038,silk);put(cone(.06,.12,6),silk,...jv(g,'fore',.95,s),'lowerarm_'+l,1,1,1,0,0,s*-1.57);ell(gmat(0xf1f7ff,.5,0,0),s*.522,1.075,-.245,.04,.034,.07,'hand_'+l);put(tor(.04,.01),ic2,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7)});
  seg(V(.52,.4,-.2),V(.52,1.7,-.2),.015,.012,ic2,'hand_r');put(cone(.06,.2,4),cr,.52,1.78,-.2,'hand_r');put(cone(.05,.1,4),cr,.52,1.62,-.2,'hand_r',1,1,1,Math.PI)}});
// ================================================== KING (royal) ==================================================
KIT('royal',{size:{w:1.16,h:1.0},hide:{hair:1},hair:0xb8b8b8,shoe:0x1c1020,cloth:c=>({shirt:0x20102f,pants:0x20102f,rough:.5}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const gold=gmat(c.acc,.2,1,2),vel=gmat(c.top,.8,0,1),erm=gmat(0xf4f1ea,.95,0,7),dot=gmat(0x111111,.9,0,0),ruby=gmat(0xe0102a,.05,.3,4),hair=gmat(0xbdbdbd,.9,0,7),lea=gmat(0x2a1a10,.6,0,5);
  ell(hair,0,HY-.12,-.09,.09,.1,.06,'head');ell(hair,0,HY+.0,.07,.11,.12,.05,'head');
  put(lathe([[.12,0],[.125,.06],[.14,.1]],S),gold,0,HY+.09,-.0,'head',1,1,1.1);for(let i=0;i<5;i++){const a=(i-2)/2*.9+Math.PI*0;put(cone(.025,.07,4),gold,Math.sin(a)*.135,HY+.2,Math.cos(a)*.135-.0,'head',1,1,1,0,0,0)}put(sph(.015),ruby,0,HY+.12,-.15,'head');put(lathe([[0,.1],[.08,.06],[.125,0]],S),vel,0,HY+.1,0,'head',1,1,1.05);
  g.shell([[.2,1.06],[.23,1.2],[.245,1.3],[.225,1.4],[.16,1.46]],gmat(0x3a2050,.5,.2,1),'spine_03',.93);put(plate(.04,.38,.012,.01),gold,0,1.27,-.236,'spine_03');for(let i=0;i<4;i++)put(sph(.014),gold,0,1.1+i*.1,-.24,'spine_03');
  put(lathe([[.2,1.46],[.26,1.52],[.28,1.46]],S),erm,0,0,-.0,'spine_03',1,1,.95);g.fine();for(let i=0;i<12;i++){const a=i/12*Math.PI*2;put(box(.01,.04,.01),dot,Math.sin(a)*.275,1.5,Math.cos(a)*.26,'spine_03',1,1,1,0,a,0)}g.fine(false);
  put(plate(.04,.32,.015,.01),erm,-.12,1.3,-.235,'spine_03');put(plate(.04,.32,.015,.01),erm,.12,1.3,-.235,'spine_03');
  put(lathe([[.26,1.46],[.38,.8],[.46,.1]],S,Math.PI-.9,1.8),vel,0,0,.1,'spine_03',1,1,.7);put(lathe([[.465,.12],[.47,.1],[.46,.08]],S,Math.PI-.9,1.8),erm,0,0,.1,'spine_03',1,1,.7);
  put(lathe([[.22,-.04],[.24,0],[.22,.04]],S),gold,0,1.0,-.02,'pelvis',1,1,.95);put(box(.07,.07,.02),gold,0,1.0,-.22,'pelvis');put(sph(.02),ruby,0,1.0,-.235,'pelvis');
  sym((s,l)=>{limb(s,'upper',.05,.95,.07,.062,gmat(0x3a2050,.5,.2,1));limb(s,'fore',0,.95,.056,.05,gmat(0x3a2050,.5,.2,1));put(tor(.056,.012),gold,...jv(g,'fore',.95,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(gmat(0xf0d0b0,.5,0,0),s*.522,1.075,-.245,.046,.04,.074,'hand_'+l);limb(s,'thigh',.0,1,.098,.08,gmat(0x20102f,.7,0,1));limb(s,'shin',.0,.85,.07,.056,lea);put(g.plate(.1,.1,.28,.04),lea,s*.204,.05,-.07,'foot_'+l);put(tor(.07,.01),gold,s*.152,.38,-.03,'calf_'+l,1,1,1,Math.PI/2)});
  seg(V(.55,.35,-.25),V(.55,1.4,-.25),.014,.012,gold,'hand_r');put(sph(.055),gold,.55,1.45,-.25,'hand_r');put(sph(.025),ruby,.55,1.45,-.25,'hand_r',1.2,1.2,1.2)}});
// ================================================== CYBERPUNK (cyber) ==================================================
KIT('cyber',{size:{w:1.02,h:1.0},hide:{hair:1},hair:0x19f0ff,shoe:0x15131f,cloth:c=>({shirt:c.top,pants:c.pants,sty:4,c2:c.acc,rough:.5}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const neon=gmat(c.acc,.05,0,4),pk=gmat(0xff2fb4,.05,0,4),jk=gmat(0x1a1830,.35,.2,5),chr=gmat(0x9098a8,.25,1,2),dkm=gmat(0x0c0c14,.3,.6,0);
  for(let i=0;i<9;i++){const a=(i-4)/4*1.1;seg(V(Math.sin(a)*.04,HY+.14,Math.cos(a)*.02-.05),V(Math.sin(a)*.17,HY+.3+(i%2)*.06,Math.cos(a)*.05-.03),.022,.004,i%3?neon:pk,'head',5)}// mohawk spikes
  put(plate(.28,.05,.02,.01),dkm,0,HY+.015,-.165,'head');put(plate(.24,.016,.012,.004),neon,0,HY+.015,-.176,'head');// visor
  put(plate(.06,.1,.03,.01),chr,.13,HY-.05,.0,'head');put(sph(.012),pk,.14,HY-.0,.0,'head');// cyber ear
  g.shell([[.19,1.06],[.215,1.18],[.23,1.3],[.21,1.4],[.15,1.46]],jk,'spine_03',.93);put(plate(.03,.36,.01,.01),neon,-.08,1.26,-.232,'spine_03',1,1,1,0,0,.1);put(plate(.03,.36,.01,.01),pk,.08,1.26,-.232,'spine_03',1,1,1,0,0,-.1);
  put(lathe([[.17,1.46],[.2,1.5],[.2,1.45]],S),jk,0,0,-.02,'spine_03',1,1,.95);
  put(lathe([[.2,1.01],[.2,.9]],S),jk,0,0,-.01,'pelvis',1,1,.95);
  sym((s,l)=>{if(s>0){limb(s,'upper',.05,.95,.058,.052,chr);limb(s,'fore',0,.95,.052,.046,dkm);for(let i=0;i<3;i++)put(tor(.056,.007),neon,...jv(g,'fore',.2+i*.3,s),'lowerarm_'+l,1,1,1,.9,0,-.7);ell(dkm,s*.522,1.075,-.245,.046,.04,.078,'hand_'+l)}else{limb(s,'upper',.05,.95,.062,.056,jk);limb(s,'fore',0,.95,.054,.048,jk);}
   limb(s,'thigh',.0,1,.092,.074,gmat(c.pants,.45,.2,5));limb(s,'shin',.0,1,.068,.054,gmat(c.pants,.45,.2,5));put(g.plate(.1,.11,.3,.05),dkm,s*.204,.055,-.07,'foot_'+l);put(g.plate(.1,.012,.3,.01),s>0?neon:pk,s*.204,.01,-.07,'foot_'+l)});
  put(box(.1,.14,.05),dkm,0,1.3,.2,'spine_03');put(plate(.08,.01,.01,.004),neon,0,1.35,.23,'spine_03')}});
// ================================================== RONIN (ronin) ==================================================
KIT('ronin',{size:{w:1.0,h:1.02},hide:{hair:1},hair:0x1a1a1a,shoe:0x3a2a1a,cloth:c=>({shirt:c.top,pants:c.pants,rough:.95}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const kim=gmat(c.top,.95,0,1),hak=gmat(c.pants,.9,0,1),str=gmat(0xd9c9a0,.95,0,1),obi=gmat(0x7a2a1a,.8,0,3),gold=gmat(c.acc,.3,.8,2),blk=gmat(0x111111,.4,.3,5),hair=gmat(0x1a1a1a,.7,0,0);
  put(lathe([[0,.2],[.18,.16],[.34,.0],[.4,-.06]],24),str,0,HY+.1,-.0,'head',1,.6,1);put(lathe([[0,.2],[.18,.16],[.34,.0],[.4,-.06]],24),gmat(0x7a6a44,.9,0,3),0,HY+.095,-.0,'head',1,.6,1);// straw kasa hat
  put(box(.06,.06,.2),hair,0,HY-.04,.14,'head');ell(hair,0,HY-.03,.1,.04,.05,.05,'head');
  put(lathe([[.2,-.05],[.215,.0],[.19,.05]],S),obi,0,1.15,-.02,'spine_03',1,1,.95);put(lathe([[.2,1.46],[.23,1.52]],S),str,0,0,-.0,'spine_03',1,1,.93);
  g.shell([[.19,1.06],[.215,1.2],[.23,1.3],[.21,1.4],[.15,1.46]],kim,'spine_03',.93);seg(V(.0,1.47,-.2),V(.19,1.15,-.24),.02,.018,str,'spine_03',4);seg(V(.0,1.47,-.2),V(-.19,1.15,-.24),.02,.018,str,'spine_03',4);// open kimono overlap
  put(lathe([[.22,1.1],[.3,.5],[.36,.05]],S),hak,0,0,-.0,'pelvis',1,1,1.0);for(let i=0;i<4;i++)put(box(.01,.9,.01),dk(c.pants,.7)&&gmat(dk(c.pants,.6),.9,0,1),Math.sin(i*1.57)*.26,.55,Math.cos(i*1.57)*.24,'pelvis',1,1,1,0,i*1.57,0);
  put(lathe([[.22,-.04],[.24,0],[.22,.04]],S),obi,0,1.0,-.02,'pelvis',1,1,.95);
  put(cyl(.012,.012,.85),blk,-.26,.95,-.12,'pelvis',1,1,1,.1,0,Math.PI/2+.25);put(cyl(.02,.02,.04),gold,-.15,1.0,-.15,'pelvis',1,1,1,0,0,Math.PI/2);put(cyl(.014,.014,.3),gmat(0x3a2a1a,.7,0,3),-.12,1.0,-.15,'pelvis',1,1,1,0,0,Math.PI/2);put(box(.02,.02,.02),gold,-.28,.75,-.09,'pelvis');// katana
  sym((s,l)=>{limb(s,'upper',.05,.95,.08,.07,kim);limb(s,'fore',0,.95,.07,.06,kim);ell(str,s*.522,1.075,-.245,.046,.04,.076,'hand_'+l);put(tor(.062,.008),str,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);limb(s,'shin',.1,.95,.06,.048,str);put(plate(.1,.04,.26,.03),gmat(0x3a2a1a,.7,0,5),s*.204,.03,-.07,'foot_'+l);put(plate(.08,.02,.12,.01),gmat(0x7a6a44,.9,0,3),s*.204,.08,-.07,'foot_'+l)})}});
// ================================================== CHEF (chef) ==================================================
KIT('chef',{size:{w:1.22,h:1.0},hide:{hair:1},hair:0x3a2a1a,shoe:0x15151a,cloth:c=>({shirt:c.top,pants:0x4a5a77,sty:3,c2:0x2a3550,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const wh=gmat(0xf7f7f7,.85,0,1),wh2=gmat(0xe2e2e8,.85,0,1),bl=gmat(0x1a1a22,.8,0,1),rd=gmat(c.acc,.8,0,1),ap=gmat(0xf3f0e8,.9,0,1),stl=gmat(0xc8ccd2,.2,1,2);
  put(cyl(.115,.12,.1,S),wh,0,HY+.15,0,'head',1,1,1.0);ell(wh,0,HY+.27,0,.18,.12,.17,'head');for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ell(wh2,Math.sin(a)*.12,HY+.3,Math.cos(a)*.11,.07,.08,.07,'head')}ell(wh2,0,HY+.38,0,.1,.06,.1,'head');// toque
  ell(gmat(0x3a2a1a,.8,0,7),0,HY-.115,-.1,.045,.03,.02,'head');put(box(.14,.012,.012),gmat(0x3a2a1a,.8,0,7),0,HY-.035,-.145,'head');// moustache
  g.shell([[.2,1.06],[.235,1.2],[.25,1.3],[.23,1.4],[.16,1.46]],wh,'spine_03',.94);for(let i=0;i<2;i++)for(let j=0;j<4;j++)put(sph(.014),bl,(i?.05:-.0)*-1+.0,1.4-j*.07,-.255,'spine_03');put(lathe([[.17,1.46],[.19,1.5],[.19,1.45]],S),wh,0,0,-.02,'spine_03',1,1,.95);put(plate(.18,.06,.02,.01),rd,0,1.5,-.2,'spine_03');// neckerchief
  put(plate(.3,.3,.02,.03),ap,0,.82,-.22,'pelvis');put(box(.3,.04,.02),ap,0,.99,-.23,'pelvis');for(const s of[-1,1])seg(V(s*.1,1.38,-.22),V(s*.14,1.02,-.23),.012,.01,ap,'spine_03',4);put(plate(.1,.08,.02,.01),wh2,0,.88,-.24,'pelvis');
  sym((s,l)=>{limb(s,'upper',.05,.95,.075,.07,wh);limb(s,'fore',0,.95,.066,.058,wh);put(tor(.066,.012),wh2,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);limb(s,'shin',.1,.95,.07,.058,gmat(0x4a5a77,.9,0,1));put(plate(.1,.1,.3,.04),bl,s*.204,.05,-.07,'foot_'+l)});
  seg(V(-.15,.7,-.28),V(-.05,.95,-.3),.008,.005,stl,'pelvis');put(box(.04,.14,.012),stl,-.22,.7,-.2,'pelvis');// knife
 }});
// ================================================== FIELD MEDIC (rose) ==================================================
KIT('rose',{size:{w:.98,h:1.0},hide:{hair:1},hair:0x6a3a1a,shoe:0xf4f4f4,cloth:c=>({shirt:c.top,pants:c.pants,sty:4,c2:0xc0262b,rough:.85}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const wh=gmat(0xf6f9f7,.8,0,1),sc=gmat(c.pants,.8,0,1),red=gmat(c.acc,.6,0,0),lea=gmat(0x3a2a1a,.7,0,5),bag=gmat(0x2f8a6a,.8,0,1),stl=gmat(0xc8ccd2,.25,1,2),hair=gmat(0x6a3a1a,.8,0,0),mask=gmat(0x7fc8d8,.6,0,1);
  put(lathe([[0,.1],[.07,.095],[.115,.07],[.135,.02],[.138,-.03]],S),sc,0,HY+.04,.0,'head',1,1,1.1);put(plate(.11,.03,.014,.005),wh,0,HY+.1,-.15,'head');put(plate(.06,.016,.012,.004),red,0,HY+.1,-.158,'head');put(plate(.014,.06,.012,.004),red,0,HY+.1,-.158,'head');// scrub cap
  put(lathe([[0,.07],[.07,.06],[.1,.0]],S,Math.PI*.9,Math.PI*1.2),mask,0,HY-.095,-.1,'head',1,1,.8);put(plate(.1,.07,.01,.01),mask,0,HY-.085,-.14,'head');seg(V(.1,HY-.07,-.1),V(.13,HY-.02,0),.004,.004,mask,'head',4);// face mask
  ell(hair,0,HY-.0,.1,.07,.04,.06,'head');
  g.shell([[.18,1.06],[.2,1.18],[.215,1.3],[.2,1.4],[.15,1.46]],sc,'spine_03',.93);put(lathe([[.18,1.46],[.19,1.49]],S),sc,0,0,-.02,'spine_03',1,1,.93);
  g.shell([[.2,1.04],[.23,1.18],[.245,1.3],[.225,1.41],[.16,1.47]],wh,'spine_03',.97);put(lathe([[.24,1.05],[.28,.8],[.32,.55]],S),wh,0,0,-.0,'pelvis',1,1,1.0);put(plate(.03,.14,.016,.004),red,-.1,1.3,-.25,'spine_03');put(plate(.1,.03,.016,.004),red,-.1,1.3,-.25,'spine_03');put(plate(.012,.5,.012,.01),sc,0,1.2,-.252,'spine_03');
  put(lathe([[.2,-.04],[.22,0],[.2,.04]],S),lea,0,1.0,-.02,'pelvis',1,1,.95);for(const s of[-1,1]){put(box(.08,.1,.05),bag,s*.2,.97,-.14,'pelvis');put(plate(.06,.025,.02,.005),red,s*.2,.97,-.17,'pelvis')}
  put(box(.24,.2,.12),gmat(0xc0262b,.6,0,0),0,1.3,.22,'spine_03');put(plate(.14,.03,.02,.005),wh,0,1.3,.285,'spine_03');put(plate(.03,.14,.02,.005),wh,0,1.3,.285,'spine_03');// med backpack
  seg(V(-.06,1.44,-.1),V(-.04,1.1,-.25),.01,.01,stl,'spine_03',4);put(tor(.07,.01),stl,-.06,1.47,-.1,'spine_03',1,1,1,0,0,0);// stethoscope
  sym((s,l)=>{limb(s,'upper',.05,.95,.058,.052,sc);limb(s,'fore',0,.95,.05,.046,sc);ell(gmat(0xe0e8f0,.6,0,0),s*.522,1.075,-.245,.046,.04,.076,'hand_'+l);limb(s,'thigh',.0,1,.09,.074,gmat(c.pants,.8,0,1));limb(s,'shin',.0,.9,.066,.052,gmat(c.pants,.8,0,1));put(plate(.1,.1,.28,.05),gmat(0xf4f4f4,.5,0,0),s*.204,.05,-.07,'foot_'+l);put(plate(.1,.02,.28,.01),red,s*.204,.012,-.07,'foot_'+l)})}});
// ================================================== MECHANIC (ocean) ==================================================
KIT('ocean',{size:{w:1.14,h:1.0},hide:{hair:1},hair:0x3a2a1a,shoe:0x3a2a1a,cloth:c=>({shirt:c.top,pants:c.top,sty:4,c2:0xfff1a0,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const cv=gmat(c.top,.9,0,1),cv2=gmat(dk(c.top,.7),.9,0,1),yel=gmat(c.acc,.4,.2,0),lea=gmat(0x3a2a1a,.7,0,5),stl=gmat(0xc8ccd2,.2,1,2),glass=gmat(0x2a3a44,.05,.5,4),rag=gmat(0xc83a2a,.9,0,1),blk=gmat(0x151515,.9,0,0);
  put(lathe([[0,.1],[.07,.095],[.115,.07],[.135,.02],[.14,-.03]],S),cv2,0,HY+.04,.0,'head',1,1,1.1);put(plate(.11,.02,.1,.01),cv2,0,HY+.01,-.2,'head');// cap w/ brim
  put(cyl(.052,.052,.2,10),glass,0,HY+.01,-.15,'head',1.0,.45,.3,Math.PI/2,0,0);for(const s of[-1,1])put(cyl(.05,.05,.015,10),stl,s*.07,HY+.0,-.178,'head',1,1,1,Math.PI/2);// goggles on face
  seg(V(-.11,HY-.04,-.12),V(.11,HY-.04,-.12),.012,.012,glass,'head');put(box(.12,.03,.01),blk,0,HY-.1,-.15,'head');ell(blk,0,HY-.11,-.12,.07,.04,.04,'head');// stubble
  g.shell([[.2,1.06],[.235,1.2],[.25,1.3],[.23,1.4],[.16,1.46]],cv,'spine_03',.94);put(lathe([[.18,1.46],[.2,1.5],[.2,1.45]],S),cv,0,0,-.02,'spine_03',1,1,.95);put(plate(.04,.4,.012,.01),cv2,0,1.26,-.25,'spine_03');for(const s of[-1,1]){put(box(.1,.08,.04),cv2,s*.1,1.32,-.25,'spine_03');put(box(.09,.012,.044),yel,s*.1,1.355,-.25,'spine_03')}
  put(lathe([[.22,-.04],[.24,0],[.22,.04]],S),lea,0,1.0,-.02,'pelvis',1,1,.95);put(box(.06,.06,.02),stl,0,1.0,-.24,'pelvis');
  // tool belt + wrench + rag
  for(const s of[-1,1])put(box(.07,.12,.05),lea,s*.21,.95,-.1,'pelvis');put(cyl(.012,.012,.26),stl,.24,.95,-.1,'pelvis');put(tor(.035,.01),stl,.24,1.1,-.1,'pelvis',1,1,1,Math.PI/2);put(plate(.1,.14,.02,.03),rag,-.12,.9,.14,'pelvis');
  sym((s,l)=>{limb(s,'upper',.05,.95,.08,.07,cv);limb(s,'fore',0,.95,.07,.06,cv);put(tor(.07,.012),cv2,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(blk,s*.522,1.075,-.245,.05,.044,.08,'hand_'+l);limb(s,'thigh',.0,1,.1,.082,cv);limb(s,'shin',.0,.95,.076,.062,cv);put(plate(.15,.04,.04,.02),yel,s*.152,.3,-.1,'calf_'+l);put(plate(.11,.11,.3,.05),lea,s*.204,.06,-.07,'foot_'+l);ell(cv2,s*.152,.53,-.08,.062,.06,.05,'calf_'+l)})}});
// ================================================== RIOT GUARD (steel) ==================================================
KIT('steel',{size:{w:1.26,h:1.02},hide:{hair:1},shoe:0x111111,cloth:c=>({shirt:c.top,pants:c.pants,rough:.8}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const nv=gmat(c.top,.55,.1,5),nv2=gmat(dk(c.top,.7),.5,.2,5),pl=gmat(0x2f353c,.4,.4,0),vis=gmat(0x35506a,.05,.6,4),blk=gmat(0x0c0c0e,.6,0,0),acc=gmat(c.acc,.3,.5,2),tp=gmat(0xdadada,.6,0,0);
  put(lathe([[0,.14],[.08,.135],[.125,.1],[.15,.04],[.157,-.04],[.15,-.12]],S),pl,0,HY+.02,.0,'head',1,1,1.1);put(lathe([[.157,0],[.16,-.06],[.14,-.12]],S,Math.PI*1.1,Math.PI*.8),pl,0,HY-.0,.0,'head',1,1,1.1);put(plate(.2,.1,.05,.03),vis,0,HY+.0,-.17,'head');put(plate(.19,.012,.03,.005),acc,0,HY+.07,-.172,'head');
  g.shell([[.21,1.04],[.245,1.18],[.26,1.3],[.24,1.41],[.17,1.47]],nv,'spine_03',.96);put(plate(.3,.34,.03,.04),pl,0,1.26,-.26,'spine_03');put(plate(.22,.12,.03,.02),pl,0,1.1,-.26,'spine_03');put(plate(.14,.05,.012,.004),tp,0,1.34,-.275,'spine_03');// vest + chest rig
  for(let i=0;i<3;i++)put(box(.06,.09,.04),blk,-.08+i*.08,1.17,-.285,'spine_03');put(lathe([[.17,1.46],[.2,1.52],[.2,1.46]],S),pl,0,0,-.02,'spine_03',1,1,.97);
  put(lathe([[.23,-.04],[.25,0],[.23,.04]],S),blk,0,1.0,-.02,'pelvis',1,1,1);for(const s of[-1,1])put(box(.07,.1,.06),blk,s*.23,.94,-.08,'pelvis');
  sym((s,l)=>{limb(s,'upper',.05,.95,.088,.078,nv2);put(sph(.07),pl,s*.24,1.44,-.018,'upperarm_'+l,1.2,1,1.1);limb(s,'fore',0,.95,.075,.066,nv2);put(box(.1,.14,.1),pl,...jv(g,'fore',.5,s),'lowerarm_'+l);ell(blk,s*.522,1.075,-.245,.052,.046,.082,'hand_'+l);limb(s,'thigh',.0,1,.105,.088,nv2);put(box(.12,.2,.08),pl,s*.14,.8,-.1,'thigh_'+l,1,1,1,-.06,0,0);limb(s,'shin',.0,.95,.082,.068,nv2);put(box(.12,.16,.06),pl,s*.152,.5,-.12,'calf_'+l);put(plate(.115,.12,.3,.05),blk,s*.204,.06,-.07,'foot_'+l)});
  seg(V(.52,.4,-.4),V(.52,1.3,-.4),.01,.01,pl,'hand_r');put(plate(.34,.72,.035,.04),gmat(0x7fb3d5,.05,.3,4),-.52,1.0,-.35,'hand_l',1,1,1,0,.0,0);put(plate(.36,.04,.04,.01),acc,-.52,1.38,-.35,'hand_l')}});// riot shield
// ================================================== DESERT RAIDER (desert) ==================================================
KIT('desert',{size:{w:1.04,h:1.04},hide:{hair:1},hair:0x2a1a10,shoe:0x5a4a2a,cloth:c=>({shirt:c.top,pants:c.pants,rough:1}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const cl=gmat(c.top,.95,0,1),cl2=gmat(dk(c.top,.75),.95,0,1),br=gmat(c.acc,.8,0,5),lea=gmat(0x4a3220,.7,0,5),rd=gmat(0x8a2a1a,.9,0,1),stl=gmat(0xb8bcc2,.3,.9,2);
  // shemagh turban: wrap + cover face
  ell(cl,0,HY+.02,.0,.125,.125,.135,'head');put(tor(.128,.025),cl2,0,HY+.04,0,'head',1,1,1.08,Math.PI/2);put(lathe([[.13,0],[.15,-.05],[.14,-.1]],S,Math.PI*.2,Math.PI*1.2),cl,0,HY-.03,.0,'head',1,1,1.1);ell(cl,0,HY-.1,-.07,.1,.065,.08,'head');put(plate(.14,.05,.01,.01),cl2,0,HY-.0,-.148,'head',1,.0,1);
  put(lathe([[.12,0],[.14,-.14],[.2,-.4]],S,Math.PI-.9,1.8),cl,0,HY-.0,.07,'head',1,1,.7);
  g.shell([[.19,1.06],[.215,1.18],[.23,1.3],[.21,1.4],[.15,1.46]],cl,'spine_03',.93);seg(V(-.2,1.43,-.12),V(.15,1.1,-.24),.03,.026,br,'spine_03',5,.4);seg(V(-.2,1.43,.1),V(.15,1.1,.2),.03,.026,br,'spine_03',5,.4);put(plate(.1,.1,.03,.03),stl,.0,1.27,-.235,'spine_03');
  put(lathe([[.2,1.46],[.26,1.5],[.3,1.36]],S),cl2,0,0,-.0,'spine_03',1,1,.96);
  put(lathe([[.22,-.04],[.24,0],[.22,.04]],S),rd,0,1.0,-.02,'pelvis',1,1,.95);put(plate(.1,.3,.02,.03),rd,0,.82,-.22,'pelvis');put(lathe([[.22,1.05],[.26,.6],[.3,.3]],S,Math.PI*.5,Math.PI*.9),cl,0,0,-.0,'pelvis',1,1,1);
  put(cyl(.012,.012,.7),lea,.25,.8,.0,'pelvis',1,1,1,0,0,.3);put(plate(.03,.5,.01,.02),stl,.35,.45,0,'pelvis',1,1,1,0,0,-.0);// scimitar
  seg(V(-.22,1.15,.2),V(.0,1.0,.25),.02,.02,gmat(0x6a5a3a,.8,0,3),'spine_03',4);put(cyl(.1,.1,.2,10),gmat(0x7a5a3a,.8,0,5),-.2,.88,.2,'pelvis');
  sym((s,l)=>{limb(s,'upper',.05,.95,.07,.062,cl);limb(s,'fore',0,.95,.062,.054,cl2);put(tor(.062,.014),br,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(lea,s*.522,1.075,-.245,.048,.042,.078,'hand_'+l);limb(s,'thigh',.0,1,.094,.078,cl2);limb(s,'shin',0,.95,.07,.056,gmat(c.pants,.9,0,1));for(let i=0;i<3;i++)put(tor(.066,.006),lea,s*(.16),.16+i*.09,-.025,'calf_'+l,1,1,1,Math.PI/2);put(plate(.1,.1,.28,.04),lea,s*.204,.05,-.07,'foot_'+l)})}});
// ================================================== ARCTIC EXPLORER (arctic) ==================================================
KIT('arctic',{size:{w:1.32,h:1.02},hide:{hair:1},shoe:0x2a2a2e,cloth:c=>({shirt:c.top,pants:c.pants,rough:.9}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const pk=gmat(c.top,.7,0,1),pk2=gmat(dk(c.top,.8),.7,0,1),acc=gmat(c.acc,.6,0,1),fur=gmat(0xf0efe9,.95,0,7),fur2=gmat(0xd8d6cc,.95,0,7),gl=gmat(0x30506a,.05,.6,4),blk=gmat(0x111115,.8,0,0),bt=gmat(0x2a2a2e,.8,0,5);
  put(lathe([[0,.2],[.1,.19],[.17,.14],[.2,.05],[.21,-.05],[.19,-.14]],S),pk,0,HY+.02,.02,'head',1,1,1);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;put(sph(.06,6,5),i%2?fur:fur2,Math.sin(a)*.17,HY-.0+Math.cos(a)*.0,Math.cos(a)*.17-.01+(Math.sin(a)>0?.04:-.0)*0,'head',1,1.2,1)}// fur ruff hood
  put(plate(.2,.07,.03,.03),gl,0,HY+.01,-.18,'head');put(tor(.1,.012),blk,0,HY+.01,-.15,'head',1,.5,1,0,0,0);
  put(lathe([[.2,1.4],[.25,1.5],[.24,1.58]],S),fur,0,0,-.02,'spine_03',1,1,.95);
  g.shell([[.22,1.04],[.26,1.18],[.275,1.3],[.255,1.41],[.18,1.47]],pk,'spine_03',.97);for(let i=0;i<4;i++)put(lathe([[.262+(i%2)*.002,-.006],[.28,0],[.262,.006]],S),pk2,0,1.1+i*.1,-.02,'spine_03',1,1,.97);put(plate(.04,.4,.02,.01),acc,0,1.26,-.27,'spine_03');
  put(plate(.16,.1,.03,.01),acc,.0,1.34,-.28,'spine_03');
  put(cyl(.17,.2,.46,10),gmat(c.acc,.7,0,1),0,1.33,.26,'spine_03',1,1,.8);put(cyl(.15,.15,.1,10),pk2,0,1.62,.26,'spine_03',1,1,.7);put(lathe([[.17,-.23],[.17,.23]],S),pk2,0,0,0,'spine_03',0,0,0);// big expedition backpack + rolled mat
  put(cyl(.09,.09,.42,10),gmat(0x3a4a5a,.8,0,1),0,1.7,.3,'spine_03',1,1,1,0,0,Math.PI/2);
  put(lathe([[.24,-.04],[.27,0],[.24,.04]],S),blk,0,1.0,-.02,'pelvis',1,1,1);
  sym((s,l)=>{limb(s,'upper',.05,.95,.095,.084,pk);limb(s,'fore',0,.95,.085,.074,pk2);put(tor(.085,.02),fur,...jv(g,'fore',.95,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(gmat(0x2a2a2e,.8,0,5),s*.522,1.075,-.245,.062,.056,.09,'hand_'+l);limb(s,'thigh',.0,1,.112,.094,gmat(c.pants,.8,0,1));limb(s,'shin',0,.9,.088,.074,gmat(c.pants,.8,0,1));put(cyl(.1,.105,.26,10),bt,s*.152,.14,-.03,'calf_'+l);put(cyl(.11,.108,.04,10),fur,s*.152,.28,-.03,'calf_'+l);put(plate(.125,.12,.3,.05),blk,s*.204,.06,-.07,'foot_'+l)});
  seg(V(.55,.1,-.3),V(.55,1.65,-.3),.014,.014,gmat(0xc8ccd2,.25,1,2),'hand_r');put(tor(.07,.01),blk,.55,.55,-.3,'hand_r');put(tor(.09,.01),acc,.55,1.55,-.3,'hand_r');// ice axe: pole+basket
  put(plate(.12,.04,.02,.01),gmat(0xc8ccd2,.2,1,2),.55,1.68,-.3,'hand_r')}});
// ================================================== NEON RACER (neon) ==================================================
KIT('neon',{size:{w:.95,h:1.0},hide:{hair:1},shoe:0x15151a,cloth:c=>({shirt:c.top,pants:c.pants,sty:3,c2:c.acc,rough:.35}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const sui=gmat(c.top,.3,.1,0),sui2=gmat(c.pants,.3,.2,0),neon=gmat(c.acc,.05,0,4),blk=gmat(0x0c0c10,.25,.5,0),vis=gmat(0x1a2236,.04,.8,4),wh=gmat(0xf4f4f6,.5,0,0),pk=gmat(c.top,.2,.2,0);
  put(lathe([[0,.16],[.08,.155],[.13,.12],[.16,.06],[.168,-.02],[.16,-.1],[.1,-.13]],S),pk,0,HY+.02,.0,'head',1,1,1.12);put(plate(.2,.08,.06,.03),vis,0,HY+.0,-.185,'head');put(plate(.012,.2,.01,.003),neon,0,HY+.1,-.17,'head',1,1,1,.5);put(plate(.2,.014,.02,.005),neon,0,HY-.05,-.178,'head');put(box(.02,.06,.1),blk,0,HY+.17,.0,'head');
  g.shell([[.17,1.06],[.2,1.18],[.215,1.3],[.195,1.4],[.14,1.46]],sui,'spine_03',.92);put(plate(.05,.36,.012,.01),wh,0,1.26,-.232,'spine_03');put(plate(.18,.03,.012,.01),neon,0,1.4,-.232,'spine_03');for(const s of[-1,1])put(plate(.035,.34,.012,.01),sui2,s*.14,1.26,-.19,'spine_03');// racing suit: white spine panel
  put(lathe([[.17,1.46],[.19,1.5],[.185,1.45]],S),blk,0,0,-.02,'spine_03',1,1,.93);put(lathe([[.2,-.04],[.215,0],[.2,.04]],S),blk,0,1.0,-.02,'pelvis',1,1,.9);
  sym((s,l)=>{limb(s,'upper',.05,.95,.058,.052,sui);limb(s,'fore',0,.95,.05,.046,sui);put(plate(.012,.2,.012,.004),neon,s*.37,1.26,0,'upperarm_'+l);ell(blk,s*.522,1.075,-.245,.046,.04,.076,'hand_'+l);limb(s,'thigh',.0,1,.092,.074,sui2);limb(s,'shin',0,.9,.066,.052,sui2);put(plate(.012,.38,.012,.004),neon,s*.19,.74,-.07,'thigh_'+l);put(plate(.1,.1,.28,.05),wh,s*.204,.05,-.07,'foot_'+l);put(plate(.1,.02,.28,.012),neon,s*.204,.012,-.07,'foot_'+l);put(sph(.05),sui2,s*.152,.53,-.08,'calf_'+l)});
  put(box(.2,.3,.1),blk,0,1.25,.22,'spine_03');put(plate(.14,.02,.01,.004),neon,0,1.3,.275,'spine_03')}});
// ================================================== STAR DRIFTER (galaxy) ==================================================
KIT('galaxy',{size:{w:1.0,h:1.0},hide:{hair:1},hair:0x6a5ae0,shoe:0x151c2c,cloth:c=>({shirt:c.top,pants:c.pants,sty:4,c2:c.acc,rough:.4}),
 build(g,c){const {put,seg,lathe,plate,ell,cyl,cone,tor,sph,gmat,sym,limb,V,S,box,low}=g;const cl=gmat(c.top,.5,.1,0),cl2=gmat(c.pants,.5,.1,0),gl=gmat(c.acc,.05,0,4),met=gmat(0x8a96aa,.25,.95,2),gl2=gmat(0x9a60ff,.05,0,4);
  put(lathe([[.11,.0],[.125,.04]],S),met,0,HY+.05,0,'head',1,1,1.1);put(plate(.22,.04,.03,.01),gl,0,HY+.0,-.17,'head');put(plate(.1,.02,.01,.005),met,0,HY+.12,-.15,'head');for(const s of[-1,1]){seg(V(s*.12,HY+.0,.0),V(s*.15,HY+.08,.1),.02,.01,met,'head',6);put(sph(.02),gl2,s*.12,HY+.0,-.0,'head')}// visor band + ear antennae
  g.shell([[.18,1.06],[.2,1.18],[.215,1.3],[.2,1.4],[.15,1.46]],cl,'spine_03',.93);put(tor(.04,.008),gl,0,1.3,-.235,'spine_03');put(plate(.012,.3,.012,.004),gl,-.1,1.25,-.235,'spine_03');put(plate(.012,.3,.012,.004),gl,.1,1.25,-.235,'spine_03');
  put(lathe([[.17,1.46],[.2,1.52],[.2,1.45]],S),met,0,0,-.02,'spine_03',1,1,.95);put(lathe([[.2,-.04],[.21,0],[.2,.04]],S),met,0,1.0,-.02,'pelvis',1,1,.92);
  put(lathe([[.1,1.46],[.24,1.0],[.34,.4]],S,Math.PI-.9,1.8),gmat(0x1a1a40,.6,0,4),0,0,.1,'spine_03',1,1,.7);// long star cape
  g.fine();for(let i=0;i<20;i++){const a=i*2.4;put(sph(.01,4,3),gl,Math.sin(a)*.25,.4+(i/20)*1.0,.2+Math.cos(a)*.03,'spine_03')}g.fine(false);
  sym((s,l)=>{limb(s,'upper',.05,.95,.058,.052,cl);limb(s,'fore',0,.95,.052,.046,cl2);put(tor(.054,.01),gl,...jv(g,'fore',.9,s),'lowerarm_'+l,1,1,1,.9,0,s*-.7);ell(met,s*.522,1.075,-.245,.046,.04,.078,'hand_'+l);limb(s,'thigh',.0,1,.092,.074,cl2);limb(s,'shin',0,.95,.068,.054,cl2);put(plate(.012,.4,.012,.004),gl,s*.19,.75,-.07,'thigh_'+l);put(plate(.1,.12,.3,.05),met,s*.204,.06,-.07,'foot_'+l);put(plate(.1,.012,.28,.01),gl,s*.204,.01,-.07,'foot_'+l)})}});
