// HeadShotz graphics helpers: procedural textures, merged geometry, sky, pooled effects.
import * as THREE from './lib/three.module.min.js';
export {THREE};
// ---------- seeded random ----------
export function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%100000)/100000}}
// ---------- canvas textures ----------
function cvs(n=128){const c=document.createElement('canvas');c.width=c.height=n;return[c,c.getContext('2d')]}
function tex(c,repeat=true){const t=new THREE.CanvasTexture(c);if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;return t}
function noise(x,n,r,a,b,cnt,sz){for(let i=0;i<cnt;i++){const v=a+(b-a)*r();x.fillStyle=`rgba(${v},${v},${v},${.25+r()*.35})`;const s=1+r()*sz;x.fillRect(r()*n,r()*n,s,s)}}
const TEXGEN={
 plain(x,n){x.fillStyle='#fff';x.fillRect(0,0,n,n)},
 concrete(x,n,r){x.fillStyle='#e9e9e9';x.fillRect(0,0,n,n);noise(x,n,r,170,255,1800,2.5);x.strokeStyle='rgba(90,90,90,.25)';x.lineWidth=1;for(let i=0;i<3;i++){x.beginPath();let px=r()*n,py=r()*n;x.moveTo(px,py);for(let k=0;k<6;k++){px+=(r()-.5)*24;py+=(r()-.5)*24;x.lineTo(px,py)}x.stroke()}
  x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,0,n,2);x.fillRect(0,0,2,n)},
 tiles(x,n,r){const k=4,s=n/k;for(let i=0;i<k;i++)for(let j=0;j<k;j++){const v=225+r()*30|0;x.fillStyle=`rgb(${v},${v-4},${v-10})`;x.fillRect(i*s,j*s,s,s)}noise(x,n,r,190,255,500,1.5);
  x.fillStyle='rgba(60,50,40,.45)';for(let i=0;i<=k;i++){x.fillRect(i*s-1,0,2,n);x.fillRect(0,i*s-1,n,2)}},
 planks(x,n,r){const k=5,s=n/k;for(let i=0;i<k;i++){const v=200+r()*45|0;x.fillStyle=`rgb(${v},${v*.88|0},${v*.75|0})`;x.fillRect(0,i*s,n,s);
  x.strokeStyle='rgba(80,50,20,.18)';for(let g=0;g<6;g++){x.beginPath();const y=i*s+r()*s;x.moveTo(0,y);x.bezierCurveTo(n*.3,y+(r()-.5)*4,n*.6,y+(r()-.5)*4,n,y);x.stroke()}
  x.fillStyle='rgba(40,25,10,.55)';x.fillRect(0,i*s,n,1.5);const cut=r()*n;x.fillRect(cut,i*s,1.5,s)}},
 metal(x,n,r){for(let i=0;i<n;i++){const v=200+40*Math.sin(i/n*Math.PI*16)|0;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(i,0,1,n)}noise(x,n,r,120,255,400,2);
  x.fillStyle='rgba(120,60,20,.15)';for(let i=0;i<8;i++){x.beginPath();x.arc(r()*n,r()*n,2+r()*6,0,7);x.fill()}},
 brick(x,n,r){x.fillStyle='#bdb3a8';x.fillRect(0,0,n,n);const bh=n/8,bw=n/4;for(let j=0;j<8;j++)for(let i=-1;i<5;i++){const v=215+r()*40|0;x.fillStyle=`rgb(${v},${v*.93|0},${v*.88|0})`;x.fillRect(i*bw+(j%2)*bw/2+1.5,j*bh+1.5,bw-3,bh-3)}noise(x,n,r,150,255,600,1.5)},
 grass(x,n,r){x.fillStyle='#e8f0e0';x.fillRect(0,0,n,n);for(let i=0;i<2600;i++){const v=180+r()*75|0;x.fillStyle=`rgba(${v*.85|0},${v},${v*.75|0},.5)`;x.fillRect(r()*n,r()*n,1,2+r()*3)}},
 sand(x,n,r){x.fillStyle='#f4ece0';x.fillRect(0,0,n,n);noise(x,n,r,190,255,2400,1.4);x.strokeStyle='rgba(150,120,80,.12)';x.lineWidth=2;for(let i=0;i<6;i++){x.beginPath();const y=r()*n;x.moveTo(0,y);x.quadraticCurveTo(n/2,y+(r()-.5)*20,n,y);x.stroke()}},
 rock(x,n,r){x.fillStyle='#ddd';x.fillRect(0,0,n,n);for(let i=0;i<60;i++){const v=170+r()*80|0;x.fillStyle=`rgba(${v},${v},${v},.5)`;x.beginPath();x.ellipse(r()*n,r()*n,4+r()*18,2+r()*8,r()*3,0,7);x.fill()}
  x.fillStyle='rgba(80,60,40,.18)';for(let i=0;i<5;i++)x.fillRect(0,r()*n,n,1+r()*2);noise(x,n,r,120,255,800,2)},
 carpet(x,n,r){x.fillStyle='#eee';x.fillRect(0,0,n,n);noise(x,n,r,175,255,4000,1);x.fillStyle='rgba(0,0,0,.06)';for(let i=0;i<n;i+=8)x.fillRect(0,i,n,1)},
 asphalt(x,n,r){x.fillStyle='#d8d8d8';x.fillRect(0,0,n,n);noise(x,n,r,90,255,3500,1.6)},
 plaster(x,n,r){x.fillStyle='#f3f3f3';x.fillRect(0,0,n,n);noise(x,n,r,205,255,1500,3);x.fillStyle='rgba(0,0,0,.08)';x.fillRect(0,n-6,n,6)},
 crate(x,n,r){TEXGEN.planks(x,n,r);x.strokeStyle='rgba(70,40,15,.85)';x.lineWidth=n*.09;x.strokeRect(n*.045,n*.045,n*.91,n*.91);x.beginPath();x.moveTo(n*.08,n*.08);x.lineTo(n*.92,n*.92);x.stroke();
  x.fillStyle='rgba(30,20,10,.6)';for(const[a,b]of[[.05,.05],[.95,.05],[.05,.95],[.95,.95]]){x.beginPath();x.arc(a*n,b*n,2.5,0,7);x.fill()}},
 hazard(x,n){x.fillStyle='#fff';x.fillRect(0,0,n,n);x.fillStyle='#333';for(let i=-n;i<n*2;i+=n/4){x.beginPath();x.moveTo(i,0);x.lineTo(i+n/8,0);x.lineTo(i+n/8-n,n);x.lineTo(i-n,n);x.fill()}},
 leaves(x,n,r){x.fillStyle='#ccc';x.fillRect(0,0,n,n);for(let i=0;i<500;i++){const v=170+r()*85|0;x.fillStyle=`rgb(${v},${v},${v})`;x.beginPath();x.ellipse(r()*n,r()*n,3+r()*4,1.5+r()*2,r()*3,0,7);x.fill()}},
 window(x,n){x.fillStyle='#9ad';x.fillRect(0,0,n,n);const g=x.createLinearGradient(0,0,n,n);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(.6,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,n,n);
  x.fillStyle='#555';x.fillRect(0,0,n,6);x.fillRect(0,n-6,n,6);x.fillRect(0,0,6,n);x.fillRect(n-6,0,6,n);x.fillRect(n/2-3,0,6,n)},
};
const texCache={};
export function getTex(name){if(texCache[name])return texCache[name];const[c,x]=cvs(name==='plain'?8:128);(TEXGEN[name]||TEXGEN.plain)(x,c.width,rng(name.length*977+name.charCodeAt(0)*31));return texCache[name]=tex(c)}
const matCache={};
export function texMat(name){if(matCache[name])return matCache[name];return matCache[name]=new THREE.MeshLambertMaterial({map:getTex(name),vertexColors:true})}
export const glowMat=new THREE.MeshBasicMaterial({vertexColors:true});
// soft round texture (smoke/fire/flash)
function radial(stops,n=64){const[c,x]=cvs(n);const g=x.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);for(const[o,col]of stops)g.addColorStop(o,col);x.fillStyle=g;x.fillRect(0,0,n,n);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
export const TX={
 soft:radial([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]),
 smoke:(()=>{const[c,x]=cvs(64);const r=rng(7);for(let i=0;i<14;i++){const px=16+r()*32,py=16+r()*32,rad=10+r()*16;const g=x.createRadialGradient(px,py,0,px,py,rad);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}return new THREE.CanvasTexture(c)})(),
 flash:(()=>{const[c,x]=cvs(64);const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(.25,'rgba(255,220,120,.9)');g.addColorStop(1,'rgba(255,140,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  x.globalCompositeOperation='lighter';x.strokeStyle='rgba(255,240,180,.9)';for(let i=0;i<6;i++){const a=i/6*Math.PI*2;x.lineWidth=3;x.beginPath();x.moveTo(32,32);x.lineTo(32+Math.cos(a)*31,32+Math.sin(a)*31);x.stroke()}return new THREE.CanvasTexture(c)})(),
 hole:(()=>{const[c,x]=cvs(32);const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(10,10,10,1)');g.addColorStop(.3,'rgba(20,20,20,.9)');g.addColorStop(.45,'rgba(60,50,40,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})(),
 shadow:(()=>{const[c,x]=cvs(64);x.filter='blur(6px)';x.fillStyle='rgba(0,0,0,.9)';x.beginPath();x.roundRect?x.roundRect(10,10,44,44,10):x.rect(10,10,44,44);x.fill();return new THREE.CanvasTexture(c)})(),
 scorch:radial([[0,'rgba(0,0,0,.8)'],[.6,'rgba(20,10,0,.5)'],[1,'rgba(0,0,0,0)']]),
};
// ---------- geometry merge ----------
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_c=new THREE.Color(),_n=new THREE.Vector3();
export function G(kind,...a){switch(kind){
 case 'box':return new THREE.BoxGeometry(a[0],a[1],a[2]);
 case 'cyl':return new THREE.CylinderGeometry(a[0],a[1]??a[0],a[2],a[3]||8,1,!!a[4]);
 case 'cone':return new THREE.ConeGeometry(a[0],a[1],a[2]||8);
 case 'sph':return new THREE.SphereGeometry(a[0],a[1]||8,a[2]||6);
 case 'ico':return new THREE.IcosahedronGeometry(a[0],a[1]||0);
 case 'dode':return new THREE.DodecahedronGeometry(a[0],0);
 case 'tor':return new THREE.TorusGeometry(a[0],a[1],a[2]||5,a[3]||10,a[4]||Math.PI*2);
 case 'cap':return new THREE.CapsuleGeometry(a[0],a[1],2,6);
 }}
// part: {g, p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], c:hex, ao:true, uv:'world'|'local', us:uv scale, v: shade variation}
export function mergeParts(parts,opt={}){let total=0;const geos=[];
 for(const pt of parts){let g=pt.g.index?pt.g.toNonIndexed():pt.g.clone();
  _e.set(...(pt.r||[0,0,0]));_q.setFromEuler(_e);_s.set(...(pt.s||[1,1,1]));_p.set(...(pt.p||[0,0,0]));_m.compose(_p,_q,_s);if(pt.m)_m.premultiply(pt.m);g.applyMatrix4(_m);geos.push([g,pt]);total+=g.attributes.position.count}
 const P=new Float32Array(total*3),N=new Float32Array(total*3),C=new Float32Array(total*3),U=opt.uv?new Float32Array(total*2):null;let o=0;
 for(const[g,pt]of geos){const pa=g.attributes.position.array,na=g.attributes.normal.array,cnt=g.attributes.position.count;P.set(pa,o*3);N.set(na,o*3);
  _c.set(pt.c??0xffffff);const us=pt.us||.25;let bb=null;if(pt.uv==='local'){g.computeBoundingBox();bb=g.boundingBox}
  const gy=pt.gy??0;
  for(let i=0;i<cnt;i++){const x=pa[i*3],y=pa[i*3+1],z=pa[i*3+2],nx=na[i*3],ny=na[i*3+1],nz=na[i*3+2];
   let f=1;if(pt.ao!==false&&opt.ao){const h=y-gy;f=.58+.42*Math.min(1,Math.max(0,h/1.4));if(ny<-.5)f*=.75;if(ny>.5)f=Math.max(f,.95)}
   if(pt.top&&ny>.5){C[(o+i)*3]=pt.top[0];C[(o+i)*3+1]=pt.top[1];C[(o+i)*3+2]=pt.top[2]}else{C[(o+i)*3]=_c.r*f;C[(o+i)*3+1]=_c.g*f;C[(o+i)*3+2]=_c.b*f}
   if(U){const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);let u,v;
    if(bb){const sx=bb.max.x-bb.min.x||1,sy=bb.max.y-bb.min.y||1,sz=bb.max.z-bb.min.z||1;if(ay>=ax&&ay>=az){u=(x-bb.min.x)/sx;v=(z-bb.min.z)/sz}else if(ax>=az){u=(z-bb.min.z)/sz;v=(y-bb.min.y)/sy}else{u=(x-bb.min.x)/sx;v=(y-bb.min.y)/sy}}
    else{if(ay>=ax&&ay>=az){u=x*us;v=z*us}else if(ax>=az){u=z*us;v=y*us}else{u=x*us;v=y*us}}
    U[(o+i)*2]=u;U[(o+i)*2+1]=v}}
  o+=cnt;g.dispose()}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));geo.setAttribute('color',new THREE.BufferAttribute(C,3));if(U)geo.setAttribute('uv',new THREE.BufferAttribute(U,2));
 geo.computeBoundingSphere();return geo}
// ---------- matcap for viewmodels ----------
function matcapTex(base,hi,dark){const[c,x]=cvs(128);const g=x.createRadialGradient(46,40,4,64,64,64);g.addColorStop(0,hi);g.addColorStop(.35,base);g.addColorStop(.85,dark);g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,128,128);
 const r=x.createLinearGradient(0,90,0,128);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(1,'rgba(255,255,255,.25)');x.fillStyle=r;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
export const MC={
 metal:new THREE.MeshMatcapMaterial({matcap:matcapTex('#c4cad3','#ffffff','#545a63'),vertexColors:true}),
 matte:new THREE.MeshMatcapMaterial({matcap:matcapTex('#c9c9c9','#f4f4f4','#5c5c5c'),vertexColors:true}),
};MC.metal.color.setScalar(3.2);MC.matte.color.setScalar(2.6);const _mcEnd={
};
// ---------- sky ----------
export function makeSky(top,mid,bottom,sunDir){const g=new THREE.SphereGeometry(400,24,12);const c=[],pa=g.attributes.position;const T=new THREE.Color(top),M=new THREE.Color(mid),B=new THREE.Color(bottom),X=new THREE.Color();
 for(let i=0;i<pa.count;i++){const y=pa.getY(i)/400;if(y>0)X.copy(M).lerp(T,Math.pow(y,.6));else X.copy(M).lerp(B,Math.min(1,-y*4));c.push(X.r,X.g,X.b)}
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));m.renderOrder=-10;
 const grp=new THREE.Group();grp.add(m);
 if(sunDir){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.soft,color:0xfff4d0,fog:false,depthWrite:false,transparent:true,blending:THREE.AdditiveBlending}));s.position.copy(sunDir).multiplyScalar(350);s.scale.setScalar(110);grp.add(s);
  const s2=s.clone();s2.material=s.material.clone();s2.material.opacity=1;s2.scale.setScalar(30);s2.position.copy(sunDir).multiplyScalar(349);grp.add(s2)}
 // clouds
 const cl=[];const r=rng(42);for(let i=0;i<14;i++){const a=r()*Math.PI*2,d=230+r()*80,y=70+r()*60;for(let k=0;k<4;k++)cl.push({g:G('sph',1,7,5),p:[Math.cos(a)*d+k*14-20,y+r()*6,Math.sin(a)*d+r()*10],s:[18+r()*14,6+r()*4,12+r()*8],c:0xffffff})}
 const cm=new THREE.Mesh(mergeParts(cl),new THREE.MeshBasicMaterial({vertexColors:true,fog:false,transparent:true,opacity:.85,depthWrite:false}));cm.renderOrder=-9;grp.add(cm);
 return grp}
// ---------- pooled effects ----------
export class FX{constructor(scene){this.scene=scene;
 // sparks
 const N=220;this.sp={pos:new Float32Array(N*3),col:new Float32Array(N*3),vel:new Float32Array(N*3),life:new Float32Array(N),i:0,N};
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.sp.pos,3));g.setAttribute('color',new THREE.BufferAttribute(this.sp.col,3));
 this.sp.pts=new THREE.Points(g,new THREE.PointsMaterial({size:.09,vertexColors:true,map:TX.soft,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.sp.pts.frustumCulled=false;scene.add(this.sp.pts);this.sp.pos.fill(-999);
 // decals
 this.dec=new THREE.InstancedMesh(new THREE.PlaneGeometry(.13,.13),new THREE.MeshBasicMaterial({map:TX.hole,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),80);this.dec.count=0;this.decI=0;this.dec.frustumCulled=false;scene.add(this.dec);
 this.scor=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:TX.scorch,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),10);this.scor.count=0;this.scorI=0;this.scor.frustumCulled=false;scene.add(this.scor);
 // shells
 this.sh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.007,.007,.032,5),new THREE.MeshLambertMaterial({color:0xd4a437,emissive:0x3a2a00}),24);this.sh.frustumCulled=false;this.shells=[];this.shI=0;this.sh.count=24;
 const hide=new THREE.Matrix4().makeTranslation(0,-999,0);for(let i=0;i<24;i++){this.sh.setMatrixAt(i,hide);this.shells.push({p:new THREE.Vector3(0,-999,0),v:new THREE.Vector3(),r:new THREE.Euler(),w:new THREE.Vector3(),t:0})}scene.add(this.sh);
 // sprites
 this.spr=[];for(let i=0;i<70;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.smoke,transparent:true,depthWrite:false}));s.visible=false;scene.add(s);this.spr.push({s,t:0})}this.sprI=0;
}
 spark(p,n,col=0xffc864,speed=4,life=.35){const S=this.sp;_c.set(col);for(let k=0;k<n;k++){const i=S.i++%S.N;S.pos[i*3]=p.x;S.pos[i*3+1]=p.y;S.pos[i*3+2]=p.z;
  S.vel[i*3]=(Math.random()-.5)*speed;S.vel[i*3+1]=Math.random()*speed*.8;S.vel[i*3+2]=(Math.random()-.5)*speed;S.life[i]=life*(.5+Math.random()*.6);S.col[i*3]=_c.r;S.col[i*3+1]=_c.g;S.col[i*3+2]=_c.b}}
 decal(p,n){const o=new THREE.Object3D();o.position.copy(p).addScaledVector(n,.012);o.lookAt(_p.copy(o.position).add(n));o.rotateZ(Math.random()*6);o.scale.setScalar(.7+Math.random()*.6);o.updateMatrix();
  this.dec.setMatrixAt(this.decI%80,o.matrix);this.decI++;this.dec.count=Math.min(80,this.decI);this.dec.instanceMatrix.needsUpdate=true}
 scorch(p,r){const o=new THREE.Object3D();o.position.set(p.x,p.y+.02,p.z);o.rotation.x=-Math.PI/2;o.scale.setScalar(r*2);o.updateMatrix();this.scor.setMatrixAt(this.scorI%10,o.matrix);this.scorI++;this.scor.count=Math.min(10,this.scorI);this.scor.instanceMatrix.needsUpdate=true}
 shell(p,v){const s=this.shells[this.shI++%24];s.p.copy(p);s.v.copy(v);s.t=1.4;s.w.set(Math.random()*20,Math.random()*20,Math.random()*20)}
 sprite(o){const e=this.spr[this.sprI++%this.spr.length];const s=e.s,m=s.material;m.map=o.tex||TX.smoke;m.color.set(o.color??0xffffff);m.blending=o.add?THREE.AdditiveBlending:THREE.NormalBlending;m.opacity=o.op??.8;m.needsUpdate=true;
  s.position.copy(o.p);s.visible=true;Object.assign(e,{t:o.life,life:o.life,s0:o.s0,s1:o.s1,op:o.op??.8,v:o.v?o.v.clone():null,rise:o.rise||0});s.scale.setScalar(o.s0);m.rotation=Math.random()*6;return e}
 update(dt,floorAt){const S=this.sp;for(let i=0;i<S.N;i++){if(S.life[i]<=0)continue;S.life[i]-=dt;if(S.life[i]<=0){S.pos[i*3+1]=-999;continue}
  S.vel[i*3+1]-=12*dt;S.pos[i*3]+=S.vel[i*3]*dt;S.pos[i*3+1]+=S.vel[i*3+1]*dt;S.pos[i*3+2]+=S.vel[i*3+2]*dt;const f=Math.min(1,S.life[i]*4);S.col[i*3]*=.97;S.col[i*3+1]*=.95;S.col[i*3+2]*=.9;}
  S.pts.geometry.attributes.position.needsUpdate=true;S.pts.geometry.attributes.color.needsUpdate=true;
  let any=false;for(let i=0;i<24;i++){const s=this.shells[i];if(s.t<=0)continue;any=true;s.t-=dt;s.v.y-=14*dt;s.p.addScaledVector(s.v,dt);const fy=floorAt?floorAt(s.p):0;if(s.p.y<fy+.01){s.p.y=fy+.01;s.v.y*=-.35;s.v.x*=.6;s.v.z*=.6;s.w.multiplyScalar(.6)}
   s.r.x+=s.w.x*dt;s.r.y+=s.w.y*dt;s.r.z+=s.w.z*dt;_q.setFromEuler(s.r);_m.compose(s.t>0?s.p:_p.set(0,-999,0),_q,_s.set(1,1,1));this.sh.setMatrixAt(i,_m)}
  if(any)this.sh.instanceMatrix.needsUpdate=true;
  for(const e of this.spr){if(!e.s.visible)continue;e.t-=dt;if(e.t<=0){e.s.visible=false;continue}const k=1-e.t/e.life;e.s.scale.setScalar(e.s0+(e.s1-e.s0)*Math.sqrt(k));e.s.material.opacity=e.op*Math.min(1,e.t/(e.life*.5));
   if(e.v)e.s.position.addScaledVector(e.v,dt);e.s.position.y+=e.rise*dt}}
}
