// HeadShotz Royale air vehicles (all original, procedural, vertex-coloured): the Battle Airship (balloon + wooden gondola + spinning propellers),
// the deployable hang-glider, freefall wind streaks and puffy low clouds. A handful of draw calls each; iPhone friendly.
import {THREE,mergeParts,GQ,G} from './gfx.js';
const V3=THREE.Vector3;
const mat=(o={})=>GQ.level==='low'?new THREE.MeshLambertMaterial({vertexColors:true,side:o.side||THREE.FrontSide}):new THREE.MeshStandardMaterial({vertexColors:true,roughness:o.rough??.55,metalness:o.metal??.05,side:o.side||THREE.FrontSide});
const box=()=>G('box',1,1,1),cyl=(s=10)=>new THREE.CylinderGeometry(1,1,1,s),sph=(w=14,h=10)=>new THREE.SphereGeometry(1,w,h),cone=(s=8)=>new THREE.ConeGeometry(1,1,s);
const col=new THREE.Color();
function colorize(g,fn){const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){fn(p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),col);c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g}
function bannerTex(txt){const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const x=cv.getContext('2d');x.font='900 italic 170px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=26;x.strokeStyle='#1a0f3a';x.strokeText(txt,512,134);const g=x.createLinearGradient(0,40,0,220);g.addColorStop(0,'#fff6b0');g.addColorStop(.55,'#ffc21a');g.addColorStop(1,'#ff8a1f');x.fillStyle=g;x.fillText(txt,512,134);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
// ---------------------------------------------------------------- Battle Airship (local origin = deck surface under the players' feet, nose toward -Z)
export function makeBus(){const root=new THREE.Group();const PAL=[0x7a3cff,0xfff3d6,0xffc21a,0xfff3d6,0xff4fa3,0xfff3d6];
 // balloon envelope: stretched sphere, striped gores, darker belly, bright crown
 const eg=new THREE.SphereGeometry(1,40,26);eg.rotateX(Math.PI/2);eg.scale(5.2,5.6,10.5);eg.computeVertexNormals();
 colorize(eg,(x,y,z,nx,ny,nz,c)=>{const a=Math.atan2(y,x),gi=Math.floor((a+Math.PI)/(Math.PI*2)*18)%PAL.length;c.set(PAL[gi]);const sh=.84+.16*(ny*.5+.5);c.multiplyScalar(sh);const k=Math.abs(z)/10.5;if(k>.93)c.lerp(col.clone().set(0xffc21a),.7)});
 const env=new THREE.Mesh(eg,mat({rough:.42}));env.position.y=8.4;env.castShadow=true;root.add(env);
 // metal band + nose cap rings
 const P=[];const part=(g,c,p,s,r)=>P.push({g,c,p,s,r,ao:false});
 for(const z of[-4.6,0,4.6]){const k=Math.sqrt(1-(z/10.5)**2);part(new THREE.TorusGeometry(1,.035,6,40),0xffd23f,[0,8.4,z],[5.25*k,5.65*k,5.25*k],[0,0,0])}
 // gondola: wooden boat hull + deck + rails + cabin + figurehead
 part(new THREE.SphereGeometry(1,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2),0x8a5a2b,[0,-.02,0],[2.0,1.5,6.6]);part(new THREE.TorusGeometry(1,.07,6,32),0xffc21a,[0,-.02,0],[2.0,6.6,1],[Math.PI/2,0,0]);
 part(new THREE.CylinderGeometry(1,1,.12,24),0xc99a5a,[0,-.05,0],[1.95,1,6.5],[0,0,0]);
 for(let i=0;i<9;i++){const z=-4.8+i*1.2;for(const s of[-1,1]){part(box(),0xffd23f,[s*1.72,.5,z],[.1,1.0,.1])}}
 for(const s of[-1,1]){part(box(),0xfff3d6,[s*1.72,1.02,0],[.14,.1,10.0]);part(box(),0x7a3cff,[s*1.72,.7,0],[.1,.08,10.0])}
 part(box(),0xfff3d6,[0,1.02,-5.0],[3.5,.1,.14]);part(cone(10),0xffc21a,[0,.15,-7.6],[.9,2.0,.9],[-Math.PI/2,0,0]);part(sph(8,6),0xff4fa3,[0,.15,-6.6],[.5,.5,.5]);
 part(box(),0xd9aa66,[0,.95,2.6],[2.6,1.8,3.0]);part(box(),0x7a3cff,[0,1.95,2.6],[3.1,.18,3.5]);part(box(),0xffc21a,[0,2.1,2.6],[2.2,.12,3.0]);
 for(const s of[-1,1]){part(box(),0x9fe0ff,[s*1.31,1.1,2.1],[.06,.7,.9]);part(box(),0x9fe0ff,[s*1.31,1.1,3.3],[.06,.7,.9])}part(box(),0x9fe0ff,[0,1.1,4.12],[1.0,.7,.06]);
 for(const z of[-1.2,.2])part(box(),0x4a2f1a,[0,.18,z],[2.2,.32,.7]);// benches
 // ropes balloon <-> rails
 for(const z of[-4.5,-1.5,1.5,4.5])for(const s of[-1,1]){const top=new V3(s*3.6,3.3+Math.abs(z)*.06,z*.95),bot=new V3(s*1.72,1.0,z);const d=top.clone().sub(bot),L=d.length(),m=top.clone().add(bot).multiplyScalar(.5);const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.normalize());const e=new THREE.Euler().setFromQuaternion(q);part(cyl(5),0x3a2a1a,[m.x,m.y,m.z],[.028,L,.028],[e.x,e.y,e.z])}
 // tail: cross fins, rudder, lamps, flags
 for(const a of[0,Math.PI/2,Math.PI,-Math.PI/2]){const dx=Math.round(Math.sin(a)),dy=Math.round(Math.cos(a));const vert=!!dy;part(box(),vert?0xff4fa3:0xffc21a,[dx*(2.9+1.3),8.4+dy*(3.2+1.3),8.6],vert?[.2,2.8,4.4]:[2.8,.2,4.4],[0,0,0])}
 for(const z of[-6.9,6.6])part(sph(8,6),0xfff3a0,[0,1.5,z],[.2,.2,.2]);
 part(box(),0xff4fa3,[0,2.9,4.1],[.05,.6,1.1],[0,0,0]);part(cyl(5),0x4a2f1a,[0,2.5,4.1],[.04,.8,.04]);
 const body=new THREE.Mesh(mergeParts(P),mat());body.castShadow=true;root.add(body);
 // banner text on both flanks (bent to follow the envelope)
 const tx=bannerTex('BATTLE BUS');for(const s of[-1,1]){const pg=new THREE.PlaneGeometry(11,2.8,26,6);const pa=pg.attributes.position;for(let i=0;i<pa.count;i++){const z=-pa.getX(i)*s,y=pa.getY(i);const q=1-(z/10.5)**2-(y/5.6)**2;pa.setXYZ(i,s*(5.2*Math.sqrt(Math.max(0,q))+.04),y+8.4,z)}pg.computeVertexNormals();
  const bm=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide,depthWrite:false,fog:true}));bm.renderOrder=2;root.add(bm)}
 // propellers (spin) with soft motion disc
 const props=[];for(const s of[-1,1]){const g=new THREE.Group();g.position.set(s*2.6,.55,5.9);root.add(g);
  const pm=mergeParts([{g:cyl(8),c:0xffc21a,p:[0,0,0],s:[.35,.5,.35],r:[Math.PI/2,0,0]},{g:sph(8,6),c:0x7a3cff,p:[0,0,-.3],s:[.28,.28,.28]},...[0,1,2].map(i=>({g:box(),c:0xfff3d6,p:[Math.sin(i*2.094)*.95,Math.cos(i*2.094)*.95,0],s:[.34,1.9,.06],r:[0,0,-i*2.094]}))]);
  const sp=new THREE.Group();sp.add(new THREE.Mesh(pm,mat()));const disc=new THREE.Mesh(new THREE.CircleGeometry(1.95,24),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide}));sp.add(disc);g.add(sp);props.push(sp);
  const arm=new THREE.Mesh(mergeParts([{g:box(),c:0x8a5a2b,p:[-s*1.2,-.1,-.3],s:[2.6,.18,.18]}]),mat());arm.position.set(s*2.6,.55,5.9);root.add(arm)}
 root.userData={props,env,update(dt,t){for(const p of props)p.rotation.z+=dt*34;env.scale.y=1+Math.sin(t*1.6)*.006;root.rotation.z=Math.sin(t*.9)*.012;root.position.y+=0}};
 return root}
// ---------------------------------------------------------------- Hang-glider (local origin = pilot's feet, nose toward -Z, control bar at hand height)
export function makeGlider(c1=0xff4fa3,c2=0xffd23f){const root=new THREE.Group();const wing=new THREE.Group();root.add(wing);
 const span=3.1,chord=2.9,nx=8,nz=6;const pos=[],cols=[],idx=[];const cA=new THREE.Color(c1),cB=new THREE.Color(c2),cW=new THREE.Color(0xffffff);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const u=i/nx*2-1,v=j/nz;const x=u*span,depth=Math.abs(u);const zf=-1.7+depth*1.5;const z=zf+(chord*(1-depth*.55))*v;const y=3.0+depth*.55-Math.sin(v*Math.PI)*.18*(1-depth*.6);pos.push(x,y,z);
  const stripe=(Math.floor(Math.abs(u)*4.2)%2===0);const cc=stripe?cA:cB;const k=.85+.15*v;cols.push(cc.r*k,cc.g*k,cc.b*k)}
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+1,c=a+nz+1,d=c+1;idx.push(a,c,b,b,c,d)}
 const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));wg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));wg.setIndex(idx);wg.computeVertexNormals();
 const wm=new THREE.Mesh(wg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));wm.castShadow=true;wing.add(wm);
 // frame: leading edges, keel, cross bar, control bar and king post, hang straps
 const P=[];const rod=(a,b,r,c)=>{const d=new V3(...b).sub(new V3(...a)),L=d.length(),m=new V3(...a).add(new V3(...b)).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.normalize()),e=new THREE.Euler().setFromQuaternion(q);P.push({g:cyl(6),c,p:[m.x,m.y,m.z],s:[r,L,r],r:[e.x,e.y,e.z],ao:false})};
 const tipY=3.0+.55;rod([0,3.0,-1.7],[span,tipY,-.2],.04,0xfff3d6);rod([0,3.0,-1.7],[-span,tipY,-.2],.04,0xfff3d6);rod([0,3.0,-1.7],[0,3.05,1.2],.035,0xd0d6e0);rod([-span*.7,3.45,-.55],[span*.7,3.45,-.55],.03,0xd0d6e0);
 rod([-.45,1.95,-.1],[.45,1.95,-.1],.035,0xffc21a);rod([-.45,1.95,-.1],[-.1,3.0,-.5],.03,0x4a4a55);rod([.45,1.95,-.1],[.1,3.0,-.5],.03,0x4a4a55);
 for(const s of[-1,1]){rod([s*.45,1.95,-.1],[s*.9,3.2,-.9],.03,0x4a4a55)}
 wing.add(new THREE.Mesh(mergeParts(P),mat({rough:.4,metal:.4})));
 // sparkle trail anchors
 const tips=[new THREE.Object3D(),new THREE.Object3D()];tips[0].position.set(-span,3.55,-.2);tips[1].position.set(span,3.55,-.2);root.add(tips[0],tips[1]);
 root.userData={wing,tips,flex(roll,pitch,t){wing.rotation.z=roll*.5;wing.rotation.x=pitch;wing.position.y=Math.sin(t*5)*.01}};
 root.scale.setScalar(1);return root}
// ---------------------------------------------------------------- wind streaks (world-space, relative to the pilot's velocity)
export function makeWind(N=90){const g=new THREE.BufferGeometry();const pos=new Float32Array(N*6);g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const seed=[];for(let i=0;i<N;i++){const a=Math.random()*6.283,r=2.2+Math.random()*9;seed.push({ox:Math.cos(a)*r,oy:(Math.random()-.5)*10,oz:Math.sin(a)*r,t:Math.random(),l:.7+Math.random()*1.1,v:.8+Math.random()*.5})}
 const m=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,fog:false});const ls=new THREE.LineSegments(g,m);ls.frustumCulled=false;ls.renderOrder=5;
 const _d=new V3();
 ls.userData.update=(dt,center,vel,k)=>{m.opacity+=(Math.min(.6,k*.65)-m.opacity)*Math.min(1,dt*6);ls.visible=m.opacity>.02;if(!ls.visible)return;const sp=vel.length();if(sp>.5)_d.copy(vel).multiplyScalar(1/sp);else _d.set(0,-1,0);
  for(let i=0;i<N;i++){const s=seed[i];s.t+=dt*s.v*(.4+sp*.03);if(s.t>1)s.t-=1;const along=(.5-s.t)*40;// streaks start ahead of the pilot and rush past behind
   const px=center.x+s.ox+_d.x*along,py=center.y+s.oy+_d.y*along,pz=center.z+s.oz+_d.z*along,L=s.l*(.8+sp*.12);
   pos[i*6]=px;pos[i*6+1]=py;pos[i*6+2]=pz;pos[i*6+3]=px+_d.x*L;pos[i*6+4]=py+_d.y*L;pos[i*6+5]=pz+_d.z*L}
  g.attributes.position.needsUpdate=true};
 return ls}
// ---------------------------------------------------------------- low puffy clouds the players fall through
export function makeCloudField(cx,cz,R,y0,y1,N=26,seed=7){let s=seed;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};const P=[];
 for(let i=0;i<N;i++){const a=r()*6.283,d=Math.sqrt(r())*R,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,y=y0+r()*(y1-y0),sc=.8+r()*1.3;for(let k=0;k<6;k++)P.push({g:sph(10,7),c:0xffffff,p:[x+(k-2.5)*8*sc+r()*6,y+r()*5,z+r()*10],s:[9*sc*(.7+r()*.6),4.2*sc*(.7+r()*.6),7.5*sc*(.7+r()*.6)],ao:false})}
 const m=new THREE.Mesh(mergeParts(P),new THREE.MeshBasicMaterial({vertexColors:true,color:0xf4f8ff,transparent:true,opacity:.62,depthWrite:false,fog:false}));m.frustumCulled=false;m.renderOrder=-5;return m}
