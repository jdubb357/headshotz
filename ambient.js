// HeadShotz v93: AMBIENT LIFE for every outdoor map. Visual only: nothing here is in the collision list, the hit-test list or the
// server state, so it can never block, shield or be shot by anyone. Everything is generated in code (no third-party assets) and
// batched: planes (1 instanced draw), contrails (1 Points draw), helicopters (2 draws each), bird flocks (1), bats (1), deer (1), rabbits (1).
import {THREE,G,mergeParts} from './gfx.js';
const TAU=Math.PI*2,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'YXZ'),_p=new THREE.Vector3(),_s=new THREE.Vector3(1,1,1),_c=new THREE.Color();
function put(im,i,x,y,z,yaw,pitch,roll,sx,sy,sz){_e.set(pitch||0,yaw||0,roll||0);_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sx,sy==null?sx:sy,sz==null?sx:sz);_m.compose(_p,_q,_s);im.setMatrixAt(i,_m)}
const yawOf=(dx,dz)=>Math.atan2(-dx,-dz);
// ---------- models (all face -Z) ----------
function planeGeo(){const W=0xf1f4f8,B=0x2c6fd6,D=0x8a96a8;return mergeParts([
 {g:G('cyl',1.7,1.7,26,10),r:[Math.PI/2,0,0],c:W},{g:G('cone',1.7,6,10),p:[0,0,-16],r:[-Math.PI/2,0,0],c:W},{g:G('cone',1.7,6,10),p:[0,.4,16],r:[Math.PI/2,0,0],s:[1,1,.8],c:W},
 {g:G('box',1,1,1),p:[-9,-.6,2],r:[0,.5,.06],s:[16,.5,5],c:D},{g:G('box',1,1,1),p:[9,-.6,2],r:[0,-.5,-.06],s:[16,.5,5],c:D},
 {g:G('box',1,1,1),p:[0,4.2,13.5],r:[.35,0,0],s:[.5,6.5,4],c:B},{g:G('box',1,1,1),p:[-3.6,1,14.5],s:[6,.35,2.4],r:[0,.3,0],c:D},{g:G('box',1,1,1),p:[3.6,1,14.5],s:[6,.35,2.4],r:[0,-.3,0],c:D},
 {g:G('cyl',.9,.9,3.6,8),p:[-6,-2.2,-1],r:[Math.PI/2,0,0],c:0x6c7684},{g:G('cyl',.9,.9,3.6,8),p:[6,-2.2,-1],r:[Math.PI/2,0,0],c:0x6c7684},
 {g:G('box',1,1,1),p:[0,.5,-8],s:[3.4,.5,3],c:0x1d2a3a}])}
function heliGeo(){const C=0xc9ccd2,R=0xd2402f;return mergeParts([
 {g:G('sph',1,10,8),s:[1.4,1.3,2.6],p:[0,0,0],c:R},{g:G('sph',1,8,6),s:[1.1,.8,1.2],p:[0,.25,-1.9],c:0x2d3f55},{g:G('box',1,1,1),p:[0,.35,4.6],s:[.45,.5,5.4],c:C},
 {g:G('box',1,1,1),p:[0,1.2,7.1],s:[.2,1.8,1],c:R},{g:G('cyl',.18,.18,.6,6),p:[0,.9,0],c:0x333a44},{g:G('box',1,1,1),p:[-1.1,-1.5,0],s:[.14,.14,3.8],c:0x333a44},{g:G('box',1,1,1),p:[1.1,-1.5,0],s:[.14,.14,3.8],c:0x333a44},
 {g:G('box',1,1,1),p:[-1.1,-1.0,.6],s:[.1,.9,.1],c:0x333a44},{g:G('box',1,1,1),p:[1.1,-1.0,.6],s:[.1,.9,.1],c:0x333a44}])}
function rotorGeo(){return mergeParts([{g:G('box',1,1,1),s:[13,.06,.55],c:0x20242a},{g:G('box',1,1,1),s:[.55,.06,13],c:0x20242a}])}
function birdGeo(){const g=new THREE.BufferGeometry();const v=new Float32Array([0,0,.4,0,0,-.5,-1.3,.5,0, 0,0,.4,1.3,.5,0,0,0,-.5, 0,.05,-.5,0,.05,.35,0,-.12,.0]);g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();return g}
function batGeo(){const g=new THREE.BufferGeometry();const v=new Float32Array([0,0,.3,0,0,-.3,-1.1,.35,.25, -1.1,.35,.25,0,0,-.3,-.9,.05,-.35, 0,0,.3,1.1,.35,.25,0,0,-.3, 1.1,.35,.25,.9,.05,-.35,0,0,-.3, 0,.05,-.3,0,.05,.25,0,-.2,.0]);g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();return g}
function deerGeo(){const T=0xb08050,L=0xd8bf94,D=0x7a5532;return mergeParts([
 {g:G('sph',1,10,8),p:[0,1.12,0],s:[.42,.4,.95],c:T},{g:G('sph',1,8,6),p:[0,.95,.1],s:[.36,.3,.7],c:L},{g:G('cyl',.13,.18,.8,6),p:[0,1.55,-.78],r:[-.55,0,0],c:T},{g:G('sph',1,8,6),p:[0,1.88,-1.12],s:[.19,.2,.34],c:T},{g:G('sph',1,6,5),p:[0,1.86,-1.4],s:[.08,.07,.07],c:0x2a1c12},
 {g:G('cyl',.05,.05,.8,5),p:[-.2,.4,-.58],c:D},{g:G('cyl',.05,.05,.8,5),p:[.2,.4,-.58],c:D},{g:G('cyl',.06,.06,.8,5),p:[-.2,.4,.62],c:D},{g:G('cyl',.06,.06,.8,5),p:[.2,.4,.62],c:D},
 {g:G('cone',.1,.35,5),p:[0,1.25,.98],r:[-.7,0,0],c:L},{g:G('cone',.05,.5,4),p:[-.1,2.15,-1.05],r:[0,0,.35],c:0x5a4630},{g:G('cone',.05,.5,4),p:[.1,2.15,-1.05],r:[0,0,-.35],c:0x5a4630},
 {g:G('cone',.07,.28,4),p:[-.2,2.05,-1.1],r:[0,0,.7],c:T},{g:G('cone',.07,.28,4),p:[.2,2.05,-1.1],r:[0,0,-.7],c:T}])}
function rabbitGeo(){const T=0xa89078,W=0xf2ece4;return mergeParts([
 {g:G('sph',1,8,6),p:[0,.25,0],s:[.2,.2,.3],c:T},{g:G('sph',1,8,6),p:[0,.34,-.28],s:[.13,.13,.15],c:T},{g:G('cyl',.025,.035,.3,4),p:[-.05,.56,-.27],r:[.15,0,.08],c:T},{g:G('cyl',.025,.035,.3,4),p:[.05,.56,-.27],r:[.15,0,-.08],c:T},
 {g:G('sph',1,6,5),p:[0,.27,.32],s:[.07,.07,.07],c:W},{g:G('sph',1,6,5),p:[0,.12,.1],s:[.18,.1,.2],c:W}])}
// ---------- contrail shader ----------
const CVS=`attribute float age;uniform float scale;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float s=13.+age*1.5;gl_PointSize=clamp(s*scale/max(1.,-mv.z),1.,70.);vA=clamp(1.-age/12.,0.,1.)*smoothstep(0.,1.2,age)*.34;gl_Position=projectionMatrix*mv;}`;
const CFS=`varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.15,d)*vA;if(a<.01)discard;gl_FragColor=vec4(1.,1.,1.,a);}`;
const DARK=['Nebula Realm','Phantom Keep','Toxic Swamp','Firefly Hollow','Moonlit Lagoon','Crystal Caverns'],NOBIRD=['Inferno Forge','Neon City'],NOGRAZE=['Moonlit Lagoon','Thunder Isle','Neon City','Inferno Forge'];
export function initAmbient(o){const{scene,camera,renderer,isTouch,qLevel}=o;
 const root=new THREE.Group();root.visible=false;scene.add(root);
 const S={on:false,def:null,env:null,dark:false,t:0,fogC:new THREE.Color(0xbcd0e6),k:{plane:0,heli:0,bird:0,bat:0,animal:0},zone:null,zT:0};
 const q=()=>qLevel();const lite=()=>isTouch||q()==='low';
 // planes
 const NP=2,planeIM=new THREE.InstancedMesh(planeGeo(),new THREE.MeshBasicMaterial({vertexColors:true,fog:false}),NP);planeIM.frustumCulled=false;root.add(planeIM);
 const planes=[];for(let i=0;i<NP;i++)planes.push({p:new THREE.Vector3(),v:new THREE.Vector3(),on:false,sc:1.5,tr:0,aud:0});
 const TN=240;const TP=new Float32Array(NP*TN*3),TA=new Float32Array(NP*TN).fill(999);const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(TP,3));tg.setAttribute('age',new THREE.BufferAttribute(TA,1));
 const tm=new THREE.ShaderMaterial({vertexShader:CVS,fragmentShader:CFS,transparent:true,depthWrite:false,uniforms:{scale:{value:500}}});const trail=new THREE.Points(tg,tm);trail.frustumCulled=false;trail.renderOrder=-6;root.add(trail);
 planes.forEach((p,i)=>{p.ti=i;p.head=0;p.tt=0});
 // helis
 const helis=[];const hg=heliGeo(),rg=rotorGeo(),hm=new THREE.MeshLambertMaterial({vertexColors:true,fog:false}),rm=new THREE.MeshBasicMaterial({color:0x20242a,transparent:true,opacity:.55,depthWrite:false});
 for(let i=0;i<2;i++){const g=new THREE.Group(),b=new THREE.Mesh(hg,hm),r=new THREE.Mesh(rg,rm);r.position.set(0,1.45,0);g.add(b,r);g.scale.setScalar(2.4);g.visible=false;root.add(g);helis.push({g,r,p:g.position,yaw:0,spd:0,bank:0,turn:0,on:false,thump:0})}
 // birds & bats
 const NB=14,NF=2,birdIM=new THREE.InstancedMesh(birdGeo(),new THREE.MeshBasicMaterial({color:0x2a3138,side:THREE.DoubleSide,fog:false}),NB*NF);birdIM.frustumCulled=false;root.add(birdIM);
 const flocks=[];for(let f=0;f<NF;f++){const fl={c:new THREE.Vector3(),v:new THREE.Vector3(),n:0,b:[]};for(let i=0;i<NB;i++)fl.b.push({p:new THREE.Vector3(),v:new THREE.Vector3(),ph:Math.random()*TAU,off:new THREE.Vector3(rnd(-9,9),rnd(-4,4),rnd(-9,9))});flocks.push(fl)}
 const NBAT=14,batIM=new THREE.InstancedMesh(batGeo(),new THREE.MeshBasicMaterial({color:0x14101c,side:THREE.DoubleSide}),NBAT);batIM.frustumCulled=false;root.add(batIM);
 const bats=[];for(let i=0;i<NBAT;i++)bats.push({p:new THREE.Vector3(),a:Math.random()*TAU,s:rnd(5,8),ph:Math.random()*TAU,h:rnd(8,24)});
 // animals
 const NDEER=5,NRAB=8,deerIM=new THREE.InstancedMesh(deerGeo(),new THREE.MeshLambertMaterial({vertexColors:true}),NDEER),rabIM=new THREE.InstancedMesh(rabbitGeo(),new THREE.MeshLambertMaterial({vertexColors:true}),NRAB);
 for(const im of[deerIM,rabIM]){im.frustumCulled=false;root.add(im)}
 const animals=[];const mk=(kind,im,i,sp)=>({kind,im,i,sp,p:new THREE.Vector3(),yaw:Math.random()*TAU,tx:0,tz:0,st:'graze',t:rnd(2,6),on:false,hop:0,tint:new THREE.Color(1,1,1)});
 for(let i=0;i<NDEER;i++)animals.push(mk('deer',deerIM,i,1.3));for(let i=0;i<NRAB;i++)animals.push(mk('rab',rabIM,i,2.2));
 const lerpK=(k,t,dt,r=1.2)=>k+(t-k)*Math.min(1,dt*r);
 function zoneAt(x,z){const Z=S.env&&S.env.zones&&S.env.zones();if(!Z)return null;let b=null,bd=1;for(const zz of Z){const d=Math.hypot(x-zz.x,z-zz.z)/zz.r;if(d<bd){bd=d;b=zz.n}}return b}
 // ---------- begin ----------
 function begin(def,env){S.def=def;S.env=env||null;const ok=!!(def&&!def.indoor&&def.sky&&env);S.on=ok;root.visible=ok;if(!ok)return;
  const mid=new THREE.Color(def.sky[1]);S.dark=(mid.r*.3+mid.g*.59+mid.b*.11)<.2;S.br=!!def.br;S.hub=!!def.hub;S.fogC.set(def.fog?def.fog[0]:def.sky[1]);
  const g0=def.ground&&def.ground[0];S.graze=!def.hub&&!def.pier&&(g0==='grass'||g0==='sand');const sz=def.size||[80,80];S.half=env.half||Math.min(sz[0],sz[1])/2;S.area=sz[0]*sz[1];
  S.nPlane=lite()?1:2;S.nHeli=S.hub?0:(lite()?1:2);S.nFlock=lite()?1:2;S.nBird=lite()?8:NB;S.nBat=lite()?7:NBAT;
  S.nDeer=S.graze&&S.area>12000?Math.min(NDEER,Math.round(S.area/45000)+1):0;S.nRab=S.graze?Math.min(NRAB,Math.round(S.area/9000)+1):0;if(lite()){S.nDeer=Math.ceil(S.nDeer/2);S.nRab=Math.ceil(S.nRab/2)}
  const alt=S.br?1.9:1;planes.forEach((p,i)=>{p.on=false;p.alt=alt});for(let i=0;i<TA.length;i++)TA[i]=999;tg.attributes.age.needsUpdate=true;
  helis.forEach(h=>{h.on=false;h.g.visible=false});animals.forEach(a=>{a.on=false});S.k={plane:0,heli:0,bird:0,bat:0,animal:0};S.t=0;S.zone=null;
  for(let i=0;i<NP*1;i++)planes[i].on=false;for(const f of flocks)f.n=0;for(const b of bats)b.init=false;
  for(const im of[planeIM,birdIM,batIM,deerIM,rabIM]){im.count=0}}
 // ---------- planes ----------
 function respawnPlane(p,cam){const a=Math.random()*TAU,R=470,off=rnd(-220,220);const dx=Math.cos(a),dz=Math.sin(a);const alt=(S.br?rnd(260,360):rnd(150,230));
  p.p.set(cam.x+dx*R-dz*off,alt,cam.z+dz*R+dx*off);const sp=rnd(70,95);p.v.set(-dx*sp,rnd(-1,1),-dz*sp);p.on=true;p.sc=rnd(1.4,1.9);p.tt=0;p.aud=0;
  const b=p.ti*TN;for(let i=0;i<TN;i++)TA[b+i]=999;p.head=0}
 function updPlanes(dt,cam){const want=S.nPlane;planeIM.count=want;const tn=S.t;for(let i=0;i<want;i++){const p=planes[i];if(!p.on){if(Math.random()<dt*.6||(S.t<1&&i===0))respawnPlane(p,cam);else{put(planeIM,i,0,-999,0,0,0,0,.001);continue}}
   p.p.addScaledVector(p.v,dt);const d=Math.hypot(p.p.x-cam.x,p.p.z-cam.z);if(d>560){p.on=false;put(planeIM,i,0,-999,0,0,0,0,.001);continue}
   const yaw=yawOf(p.v.x,p.v.z);put(planeIM,i,p.p.x,p.p.y,p.p.z,yaw,.03,0,p.sc*S.k.plane+.001);
   p.tt-=dt;if(p.tt<=0){p.tt=.05;const b=i*TN;p.head=(p.head+1)%TN;const j=b+p.head;TP[j*3]=p.p.x-p.v.x*.07;TP[j*3+1]=p.p.y;TP[j*3+2]=p.p.z-p.v.z*.07;TA[j]=0}
   // engine rumble, faint, louder when close
   p.aud-=dt;if(p.aud<=0&&d<520){p.aud=1.4;const v=Math.pow(1-d/520,2)*.035;if(v>.002&&o.snd)o.snd(62+Math.random()*5,1.6,v,'sine',-8)}}
  for(let i=0;i<TA.length;i++)if(TA[i]<900)TA[i]+=dt;tg.attributes.position.needsUpdate=true;tg.attributes.age.needsUpdate=true;planeIM.instanceMatrix.needsUpdate=true;
  const h=(renderer.domElement.height||720);tm.uniforms.scale.value=(h/2)/Math.tan(camera.fov*Math.PI/360)*(S.k.plane>.05?1:0)}
 // ---------- helicopters ----------
 function updHelis(dt,cam){for(let i=0;i<helis.length;i++){const h=helis[i];if(i>=S.nHeli||S.k.heli<.02){h.g.visible=false;h.on=false;continue}
   if(!h.on){const a=Math.random()*TAU,R=rnd(180,300);h.p.set(cam.x+Math.cos(a)*R,rnd(S.br?95:55,S.br?150:100),cam.z+Math.sin(a)*R);h.yaw=Math.random()*TAU;h.spd=rnd(20,30);h.on=true;h.g.visible=true;h.turn=0}
   const dx=cam.x-h.p.x,dz=cam.z-h.p.z,d=Math.hypot(dx,dz);let want=h.yaw+h.turn;if(d>340){want=yawOf(dx,dz)+Math.sin(S.t*.2+i)*.6}else if(d<70){want=yawOf(-dx,-dz)}
   if(Math.random()<dt*.25)h.turn=rnd(-.5,.5);let da=((want-h.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;da=clamp(da,-.5*dt,.5*dt);h.yaw+=da;h.bank=lerpK(h.bank,-da/Math.max(dt,.001)*.5,dt,2);
   h.p.x+=-Math.sin(h.yaw)*h.spd*dt;h.p.z+=-Math.cos(h.yaw)*h.spd*dt;h.p.y+=Math.sin(S.t*.5+i*2)*.4*dt;
   h.g.rotation.set(.09,h.yaw,h.bank,'YXZ');h.r.rotation.y+=dt*38;h.g.scale.setScalar(2.4*S.k.heli+.01);
   h.thump-=dt;if(h.thump<=0){h.thump=.19;const dist=Math.hypot(dx,dz,h.p.y-cam.y);const v=Math.pow(clamp(1-dist/360,0,1),2)*.07;if(v>.003&&o.snd)o.snd(58,.1,v,'square',-18)}}}
 // ---------- birds ----------
 function updBirds(dt,cam){const nf=S.nFlock,nb=S.nBird;birdIM.count=nf*nb;let idx=0;const sc=S.k.bird;
  for(let f=0;f<nf;f++){const fl=flocks[f];if(!fl.n){const a=Math.random()*TAU,R=rnd(80,200);fl.c.set(cam.x+Math.cos(a)*R,rnd(45,95),cam.z+Math.sin(a)*R);const h=Math.random()*TAU;fl.v.set(Math.cos(h)*9,0,Math.sin(h)*9);fl.n=1;fl.b.forEach(b=>{b.p.set(fl.c.x+b.off.x,fl.c.y+b.off.y,fl.c.z+b.off.z);b.v.copy(fl.v)})}
   const dx=cam.x-fl.c.x,dz=cam.z-fl.c.z,d=Math.hypot(dx,dz);if(d>260){const k=dt*.8;fl.v.x+=(dx/d*10-fl.v.x)*k;fl.v.z+=(dz/d*10-fl.v.z)*k}else{fl.v.x+=Math.sin(S.t*.13+f*3)*dt*1.6;fl.v.z+=Math.cos(S.t*.11+f*5)*dt*1.6}
   const sp=Math.hypot(fl.v.x,fl.v.z);if(sp>0.1){const t=10/sp;fl.v.x*=1+(t-1)*dt;fl.v.z*=1+(t-1)*dt}fl.c.addScaledVector(fl.v,dt);fl.c.y+=Math.sin(S.t*.3+f)*1.2*dt;
   for(let i=0;i<nb;i++){const b=fl.b[i];// cohesion to slot + separation + alignment (small flock: O(n^2) is trivial)
    let ax=fl.c.x+b.off.x+Math.sin(S.t*.7+b.ph)*3-b.p.x,ay=fl.c.y+b.off.y+Math.sin(S.t*.9+b.ph)*1.5-b.p.y,az=fl.c.z+b.off.z+Math.cos(S.t*.6+b.ph)*3-b.p.z;
    for(let j=0;j<nb;j++){if(j===i)continue;const c2=fl.b[j];const ex=b.p.x-c2.p.x,ey=b.p.y-c2.p.y,ez=b.p.z-c2.p.z,dd=ex*ex+ey*ey+ez*ez;if(dd<9&&dd>.001){const k=(3-Math.sqrt(dd))*.8;ax+=ex*k;ay+=ey*k;az+=ez*k}}
    b.v.x+=(ax*.9+(fl.v.x-b.v.x)*1.2)*dt;b.v.y+=(ay*.9-b.v.y*.8)*dt;b.v.z+=(az*.9+(fl.v.z-b.v.z)*1.2)*dt;const s=Math.hypot(b.v.x,b.v.y,b.v.z);if(s>16){const k=16/s;b.v.multiplyScalar(k)}
    b.p.addScaledVector(b.v,dt);const flap=.55+.45*Math.sin(S.t*11+b.ph*3);put(birdIM,idx++,b.p.x,b.p.y,b.p.z,yawOf(b.v.x,b.v.z),clamp(b.v.y*.05,-.4,.4),Math.sin(S.t*1.3+b.ph)*.25,1.5*flap*sc+.001,1.5*sc+.001,1.5*sc+.001)}}
  birdIM.instanceMatrix.needsUpdate=true}
 // ---------- bats ----------
 function updBats(dt,cam){const nb=S.nBat;batIM.count=nb;const sc=S.k.bat;for(let i=0;i<nb;i++){const b=bats[i];if(!b.init){const a=Math.random()*TAU,R=rnd(10,50);b.p.set(cam.x+Math.cos(a)*R,rnd(6,26),cam.z+Math.sin(a)*R);b.init=true}
   b.a+=(Math.sin(S.t*1.9+b.ph*5)+Math.sin(S.t*3.1+b.ph))*dt*2.2;const dx=cam.x-b.p.x,dz=cam.z-b.p.z,d=Math.hypot(dx,dz);if(d>75){let da=((Math.atan2(dz,dx)-b.a+Math.PI)%TAU+TAU)%TAU-Math.PI;b.a+=clamp(da,-3*dt,3*dt)}
   // heading angle a: dir=(cos a, sin a)
   const vx=Math.cos(b.a)*b.s,vz=Math.sin(b.a)*b.s;b.p.x+=vx*dt;b.p.z+=vz*dt;b.p.y=b.h+Math.sin(S.t*1.2+b.ph)*4+Math.sin(S.t*3.3+b.ph*2)*1.2;const fl=.35+.65*Math.abs(Math.sin(S.t*16+b.ph));
   put(batIM,i,b.p.x,b.p.y,b.p.z,yawOf(vx,vz),.1,Math.sin(S.t*2+b.ph)*.5,1.3*fl*sc+.001,1.3*sc+.001,1.3*sc+.001)}batIM.instanceMatrix.needsUpdate=true}
 // ---------- animals ----------
 const AV=new THREE.Vector3();
 function freeSpot(cam,r0,r1){const E=S.env;for(let k=0;k<12;k++){const a=Math.random()*TAU,r=rnd(r0,r1),x=cam.x+Math.cos(a)*r,z=cam.z+Math.sin(a)*r;if(Math.abs(x)>S.half-4||Math.abs(z)>S.half-4)continue;if(E.blocked&&E.blocked(x,z))continue;if(S.br&&NOGRAZE.includes(zoneAt(x,z)))continue;return[x,z]}return null}
 function tintFor(a,x,z){const zn=S.br?zoneAt(x,z):null;a.tint.setRGB(1,1,1);const r=Math.random();if(a.kind==='deer'){if(zn==='Frostbite Peaks')a.tint.setRGB(.95,.98,1.15);else if(zn==='Sandstorm Dunes'||zn==='Golden Savanna')a.tint.setRGB(1.1,.95,.7);else a.tint.setRGB(.85+r*.3,.85+r*.2,.85+r*.2)}else{const v=[[1,1,1],[1.2,1.15,1.05],[.7,.65,.6],[1.4,1.4,1.4]][Math.random()*4|0];if(zn==='Frostbite Peaks')a.tint.setRGB(1.5,1.5,1.55);else a.tint.setRGB(...v)}}
 function updAnimals(dt,cam,air){const E=S.env;if(!E)return;const nd=S.nDeer,nr=S.nRab;deerIM.count=nd;rabIM.count=nr;const hide=air||cam.y>40;
  for(const a of animals){const idx=a.kind==='deer'?a.i:a.i,lim=a.kind==='deer'?nd:nr;if(a.i>=lim){a.on=false;continue}const im=a.im;
   if(!a.on||Math.hypot(a.p.x-cam.x,a.p.z-cam.z)>(S.br?170:140)){if(hide){put(im,a.i,0,-999,0,0,0,0,.001);continue}const sp=freeSpot(cam,S.br?35:12,S.br?120:Math.max(30,S.half));if(!sp){put(im,a.i,0,-999,0,0,0,0,.001);continue}a.p.set(sp[0],0,sp[1]);tintFor(a,sp[0],sp[1]);im.setColorAt(a.i,a.tint);if(im.instanceColor)im.instanceColor.needsUpdate=true;a.on=true;a.st='graze';a.t=rnd(2,6);a.yaw=Math.random()*TAU}
   const dx=a.p.x-cam.x,dz=a.p.z-cam.z,d=Math.hypot(dx,dz);const fleeR=a.kind==='deer'?(S.scare>0?60:20):(S.scare>0?45:13);
   if(d<fleeR&&a.st!=='flee'){a.st='flee';a.t=rnd(3,5);const ang=Math.atan2(dz,dx)+rnd(-.5,.5);a.tx=a.p.x+Math.cos(ang)*40;a.tz=a.p.z+Math.sin(ang)*40}
   a.t-=dt;if(a.st==='flee'&&(a.t<=0&&d>fleeR*1.6)){a.st='graze';a.t=rnd(3,6)}
   else if(a.st==='graze'&&a.t<=0){a.st='walk';a.t=rnd(3,7);const ang=Math.random()*TAU,r=rnd(6,22);a.tx=a.p.x+Math.cos(ang)*r;a.tz=a.p.z+Math.sin(ang)*r}
   else if(a.st==='walk'&&a.t<=0){a.st='graze';a.t=rnd(3,8)}
   let spd=0;if(a.st==='walk')spd=a.sp;else if(a.st==='flee')spd=a.sp*(a.kind==='deer'?5.2:3.6);
   if(spd>0){const tx=a.tx-a.p.x,tz=a.tz-a.p.z,td=Math.hypot(tx,tz);if(td<1.2&&a.st==='walk'){a.st='graze';a.t=rnd(3,6)}else{let want=yawOf(tx,tz);let da=((want-a.yaw+Math.PI)%TAU+TAU)%TAU-Math.PI;a.yaw+=clamp(da,-4*dt,4*dt);
     const nx=a.p.x-Math.sin(a.yaw)*spd*dt,nz=a.p.z-Math.cos(a.yaw)*spd*dt;if(Math.abs(nx)>S.half-3||Math.abs(nz)>S.half-3||(E.blocked&&E.blocked(nx,nz))){a.yaw+=Math.PI*.6*(Math.random()<.5?1:-1);a.tx=a.p.x-Math.sin(a.yaw)*12;a.tz=a.p.z-Math.cos(a.yaw)*12}else{a.p.x=nx;a.p.z=nz}}}
   a.hop+=dt*(spd>0?(a.kind==='deer'?(a.st==='flee'?9:5):(a.st==='flee'?14:8)):0);let y=0,pitch=0;
   if(a.kind==='deer'){y=spd>0?Math.abs(Math.sin(a.hop))*(a.st==='flee'?.28:.07):0;pitch=a.st==='graze'?.38+Math.sin(S.t*1.6+a.i)*.05:(a.st==='flee'?-.06:0)}
   else{y=spd>0?Math.abs(Math.sin(a.hop))*(a.st==='flee'?.55:.22):0;pitch=a.st==='graze'?.25+Math.sin(S.t*4+a.i)*.08:(spd>0?-.25*Math.cos(a.hop):0)}
   const k=S.k.animal;put(im,a.i,a.p.x,y,a.p.z,a.yaw,pitch,0,k+.001);}
  deerIM.instanceMatrix.needsUpdate=true;rabIM.instanceMatrix.needsUpdate=true;if(S.scare>0)S.scare-=dt}
 // ---------- main ----------
 function update(dt,cam,st){if(!S.on)return;S.t+=dt;const air=!!(st&&st.air);
  S.zT-=dt;if(S.zT<=0){S.zT=.5;S.zone=S.br?zoneAt(cam.x,cam.z):null}
  const dark=S.dark||(S.br&&DARK.includes(S.zone)),nobird=dark||(S.br&&NOBIRD.includes(S.zone));
  const T=S.k;T.plane=lerpK(T.plane,1,dt,.5);T.heli=lerpK(T.heli,S.nHeli?1:0,dt,.5);T.bird=lerpK(T.bird,nobird?0:1,dt,.6);T.bat=lerpK(T.bat,dark?1:0,dt,.5);T.animal=lerpK(T.animal,1,dt,1);
  root.updateMatrixWorld();updPlanes(dt,cam);updHelis(dt,cam);
  if(T.bird>.01){updBirds(dt,cam)}else birdIM.count=0;
  if(T.bat>.01){updBats(dt,cam)}else batIM.count=0;
  updAnimals(dt,cam,air)}
 return{begin,update,scare(x,z,r){const d=Math.hypot(x-camera.position.x,z-camera.position.z);if(d<(r||90))S.scare=6},
  debug(){return{on:S.on,dark:S.dark,zone:S.zone,k:{...S.k},planes:planes.filter(p=>p.on).map(p=>[p.p.x,p.p.y,p.p.z]),helis:helis.filter(h=>h.on).map(h=>[h.p.x,h.p.y,h.p.z]),flocks:flocks.filter(f=>f.n).map(f=>[f.c.x,f.c.y,f.c.z]),bats:bats.filter(b=>b.init).slice(0,S.nBat).map(b=>[b.p.x,b.p.y,b.p.z]),animals:animals.filter(a=>a.on).map(a=>({k:a.kind,x:a.p.x,z:a.p.z,st:a.st})),n:{plane:S.nPlane,heli:S.nHeli,flock:S.nFlock,bird:S.nBird,bat:S.nBat,deer:S.nDeer,rab:S.nRab},draw:root.children.filter(c=>c.visible).length}},
  _s:S,animals}}
