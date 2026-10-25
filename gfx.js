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
 gunMetal(x,n,r){x.fillStyle='#d8d8d8';x.fillRect(0,0,n,n);noise(x,n,r,150,255,5200,1.2);x.strokeStyle='rgba(255,255,255,.35)';x.lineWidth=.6;for(let i=0;i<22;i++){x.beginPath();const px=r()*n,py=r()*n,a=r()*6.28,l=4+r()*18;x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}},
 gunAlu(x,n,r){x.fillStyle='#d2d2d2';x.fillRect(0,0,n,n);noise(x,n,r,175,255,3000,1);},
 gunPoly(x,n,r){x.fillStyle='#d0d0d0';x.fillRect(0,0,n,n);for(let i=0;i<5200;i++){const v=150+r()*105|0;x.fillStyle=`rgba(${v},${v},${v},.55)`;const s=1+r()*1.6;x.beginPath();x.arc(r()*n,r()*n,s,0,7);x.fill()}},
 gunWood(x,n,r){const g=x.createLinearGradient(0,0,0,n);g.addColorStop(0,'#d9c3a8');g.addColorStop(1,'#cdb293');x.fillStyle=g;x.fillRect(0,0,n,n);
  for(let i=0;i<70;i++){const y0=r()*n,amp=1+r()*4,f=1+r()*3,v=120+r()*80|0;x.strokeStyle=`rgba(${v*.75|0},${v*.5|0},${v*.3|0},${.25+r()*.35})`;x.lineWidth=.6+r()*1.8;x.beginPath();for(let k=0;k<=n;k+=4){const y=y0+Math.sin(k/n*Math.PI*2*f+i)*amp;k?x.lineTo(k,y):x.moveTo(k,y)}x.stroke()}
  x.fillStyle='rgba(70,40,20,.35)';for(let i=0;i<3;i++){x.beginPath();x.ellipse(r()*n,r()*n,6+r()*8,2+r()*3,0,0,7);x.fill()}},
 gunRubber(x,n,r){x.fillStyle='#bbb';x.fillRect(0,0,n,n);const s=n/16;for(let j=0;j<16;j++)for(let i=0;i<16;i++){const g=x.createLinearGradient(i*s,j*s,i*s+s,j*s+s);g.addColorStop(0,'#eee');g.addColorStop(1,'#666');x.fillStyle=g;x.beginPath();x.moveTo(i*s+s/2,j*s+.5);x.lineTo(i*s+s-.5,j*s+s/2);x.lineTo(i*s+s/2,j*s+s-.5);x.lineTo(i*s+.5,j*s+s/2);x.fill()}},
 gunCloth(x,n,r){x.fillStyle='#ccc';x.fillRect(0,0,n,n);for(let i=0;i<n;i+=2){x.fillStyle=`rgba(255,255,255,${.12+r()*.1})`;x.fillRect(i,0,1,n);x.fillStyle=`rgba(0,0,0,${.1+r()*.1})`;x.fillRect(0,i,n,1)}noise(x,n,r,120,255,1500,1.2)},
 gunChrome(x,n,r){for(let i=0;i<n;i++){const v=205+r()*45|0;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(0,i,n,1)}noise(x,n,r,170,255,500,1)},
 window(x,n){x.fillStyle='#9ad';x.fillRect(0,0,n,n);const g=x.createLinearGradient(0,0,n,n);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(.5,'rgba(255,255,255,0)');g.addColorStop(.6,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,n,n);
  x.fillStyle='#555';x.fillRect(0,0,n,6);x.fillRect(0,n-6,n,6);x.fillRect(0,0,6,n);x.fillRect(n-6,0,6,n);x.fillRect(n/2-3,0,6,n)},
};
const texCache={};
export function getTex(name){if(texCache[name])return texCache[name];const[c,x]=cvs(name==='plain'?8:128);(TEXGEN[name]||TEXGEN.plain)(x,c.width,rng(name.length*977+name.charCodeAt(0)*31));return texCache[name]=tex(c)}
// ---------- graphics quality + PBR ----------
export const GQ={level:'medium'};
// swap a procedural surface texture for a loaded photo-PBR one (in place, so existing materials update)
export function hqSwap(name,img,nimg,rep=2){const t=getTex(name);t.image=img;t.repeat.set(rep,rep);t.anisotropy=4;t.needsUpdate=true;
 if(nimg){let n=nrmCache[name];if(!n){n=new THREE.Texture();n.wrapS=n.wrapT=THREE.RepeatWrapping;n.colorSpace=THREE.NoColorSpace;nrmCache[name]=n}n.image=nimg;n.repeat.set(rep,rep);n.anisotropy=4;n.needsUpdate=true}}
// normal map from texture luminance (Sobel), tangent-space, linear
const nrmCache={};
function normalTex(name,str){if(nrmCache[name])return nrmCache[name];const src=getTex(name).image,n=src.width;const sx=src.getContext('2d').getImageData(0,0,n,n).data;
 const H=new Float32Array(n*n);for(let i=0;i<n*n;i++)H[i]=(sx[i*4]*.3+sx[i*4+1]*.59+sx[i*4+2]*.11)/255;
 for(let pass=0;pass<2;pass++){const T=new Float32Array(n*n);for(let j=0;j<n;j++)for(let i=0;i<n;i++){let s=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)s+=H[((j+dj+n)%n)*n+((i+di+n)%n)];T[j*n+i]=s/9}H.set(T)}
 const[c,x]=cvs(n);const out=x.createImageData(n,n);const h=(i,j)=>H[((j+n)%n)*n+((i+n)%n)];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const dx=(h(i+1,j-1)+2*h(i+1,j)+h(i+1,j+1))-(h(i-1,j-1)+2*h(i-1,j)+h(i-1,j+1));const dy=(h(i-1,j+1)+2*h(i,j+1)+h(i+1,j+1))-(h(i-1,j-1)+2*h(i,j-1)+h(i+1,j-1));
  let X=-dx*str,Y=dy*str,Z=1;const l=Math.hypot(X,Y,Z);const k=(j*n+i)*4;out.data[k]=(X/l*.5+.5)*255;out.data[k+1]=(Y/l*.5+.5)*255;out.data[k+2]=(Z/l*.5+.5)*255;out.data[k+3]=255}
 x.putImageData(out,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;t.anisotropy=2;return nrmCache[name]=t}
// [roughness, metalness, normal strength]
const PBR={concrete:[.9,0,1.4],tiles:[.42,0,2.2],planks:[.78,0,1.3],metal:[.45,.45,.7],brick:[.88,0,2.4],grass:[.95,0,1],sand:[.97,0,1.4],rock:[.86,0,2.6],carpet:[1,0,.8],asphalt:[.85,0,1.2],plaster:[.85,0,.6],crate:[.78,0,1.4],hazard:[.55,.25,.4],leaves:[.8,0,.6],window:[.06,.5,0],plain:[.75,0,0],
 char:[.72,0,0],gunMetal:[.36,.6,0],gunMatte:[.62,.05,0],
 gunMetalP:[.5,.78,.5],gunAlu:[.42,.6,.35],gunPoly:[.66,0,1.1],gunWood:[.5,0,.6],gunRubber:[.88,0,1.8],gunBrass:[.32,1,.25],gunChrome:[.2,1,.2],gunTrans:[.25,0,0],gunGlove:[.9,0,1],gunSleeve:[.95,0,.9],gunTP:[.55,.3,0]};
// which canvas texture each gun material samples
const GTEX={gunMetalP:'gunMetal',gunAlu:'gunAlu',gunPoly:'gunPoly',gunWood:'gunWood',gunRubber:'gunRubber',gunBrass:'gunAlu',gunChrome:'gunChrome',gunGlove:'gunCloth',gunSleeve:'gunCloth'};
const GSCALE={gunMetalP:2.3,gunAlu:2.3,gunPoly:2.1,gunWood:1.05,gunRubber:2,gunBrass:1.25,gunChrome:1.1,gunTrans:1.4,gunGlove:1.7,gunSleeve:1.25,gunTP:2};
// edge wear: curvature from screen-space normal derivatives brightens + polishes bevels (cheap, no extra textures)
function edgeWear(mat,metalWear){mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float ewv=clamp(length(fwidth(vNormal))*2.2-.18,0.,1.);ewv*=ewv;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${metalWear?'.62,.62,.64':'.32,.32,.33'}),ewv*${metalWear?'.75':'.45'});roughnessFactor=mix(roughnessFactor,${metalWear?'.22':'.45'},ewv);metalnessFactor=mix(metalnessFactor,${metalWear?'1.':'metalnessFactor'},ewv);`)};mat.customProgramCacheKey=()=>'ew'+(metalWear?1:0)}
export const RET={};{const mk=(f)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');f(x);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})};
 const glow=(x,r)=>{const g=x.createRadialGradient(32,32,0,32,32,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,60,50,1)');g.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=g;x.beginPath();x.arc(32,32,r,0,7);x.fill()};
 RET.dot=mk(x=>glow(x,7));for(const[k,c]of[['gcyan','80,240,255'],['ggreen','90,255,120'],['gorange','255,150,40'],['gblue','90,150,255'],['gred','255,60,50'],['gwhite','255,250,235']])RET[k]=mk(x=>{const g=x.createRadialGradient(32,32,4,32,32,34);g.addColorStop(0,`rgba(255,255,255,1)`);g.addColorStop(.35,`rgba(${c},1)`);g.addColorStop(1,`rgba(${c},0)`);x.fillStyle=g;x.fillRect(0,0,64,64)});RET.holo=mk(x=>{glow(x,5);x.strokeStyle='rgba(255,70,60,.95)';x.lineWidth=2.2;x.shadowColor='#f33';x.shadowBlur=4;x.beginPath();x.arc(32,32,24,0,7);x.stroke();for(const a of[0,1,2,3]){const c=Math.cos(a*Math.PI/2),s=Math.sin(a*Math.PI/2);x.beginPath();x.moveTo(32+c*24,32+s*24);x.lineTo(32+c*29,32+s*29);x.stroke()}});
 RET.chev=mk(x=>{x.strokeStyle='rgba(255,70,50,1)';x.lineWidth=3;x.shadowColor='#f33';x.shadowBlur=5;x.beginPath();x.moveTo(22,40);x.lineTo(32,30);x.lineTo(42,40);x.stroke();x.lineWidth=1.2;x.strokeStyle='rgba(30,30,30,.9)';x.shadowBlur=0;x.beginPath();x.moveTo(32,31);x.lineTo(32,62);x.stroke()})}
export const GLASS=new THREE.MeshStandardMaterial({color:0x2a4a66,metalness:.9,roughness:.05,transparent:true,opacity:.2,envMapIntensity:2.2,depthWrite:false});
GLASS.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',`{vec3 Vd=normalize(vViewPosition);float fr=pow(1.-abs(dot(normalize(normal),Vd)),2.5);
 outgoingLight+=mix(vec3(.55,.25,.75),vec3(.3,.85,.6),clamp(normal.y*.5+.5,0.,1.))*(.12+fr*.5);diffuseColor.a=clamp(diffuseColor.a+fr*.55+.06,0.,.9);}
 #include <opaque_fragment>`)};GLASS.customProgramCacheKey=()=>'lensv2';
// camo pattern texture (3-4 tone blobs) derived from a base colour; used as a map with vertex colours off so it reads cleanly
const camoCache={};export function camoTex(hex){if(camoCache[hex])return camoCache[hex];const[c,x]=cvs(256);const r=rng(hex%9973+7);const b=new THREE.Color(hex);
 const tones=[b.clone(),b.clone().multiplyScalar(.62),b.clone().lerp(new THREE.Color(0xffffff),.28),b.clone().multiplyScalar(.4)];const css=t=>'#'+t.getHexString();
 x.fillStyle=css(tones[0]);x.fillRect(0,0,256,256);for(let k=1;k<4;k++){x.fillStyle=css(tones[k]);for(let i=0;i<22;i++){const px=r()*256,py=r()*256;x.beginPath();for(let a=0;a<7;a++){const ang=a/7*Math.PI*2,rr=10+r()*26;const X=px+Math.cos(ang)*rr*1.6,Y=py+Math.sin(ang)*rr;a?x.lineTo(X,Y):x.moveTo(X,Y)}x.closePath();x.fill();
   for(const[dx,dy]of[[256,0],[-256,0],[0,256],[0,-256]]){x.save();x.translate(dx,dy);x.fill();x.restore()}}}
 noise(x,256,r,120,255,2500,1.4);return camoCache[hex]=tex(c)}
const matCache={lo:{},hi:{}};
let _gunLo=null;export function setGunLo(m){_gunLo=m}
export const MATHOOK={};
export function texMat(name){if(MATHOOK[name]){const r=MATHOOK[name](GQ.level);if(r)return r}const lvl=GQ.level==='low'?'lo':'hi';const C=matCache[GQ.level==='high'?'hh':lvl]||(matCache[GQ.level==='high'?'hh':lvl]={});if(C[name])return C[name];
 const noMap=name==='char'||name==='gunMetal'||name==='gunMatte'||name==='gunTP'||name==='gunTrans';
 if(name==='gunGlass')return C[name]=GLASS;
 if(lvl==='lo'){if(name==='gunMetal'||name==='gunMetalP'||name==='gunAlu'||name==='gunBrass'||name==='gunChrome')return C[name]=MC.metal;if(name.startsWith('gun'))return C[name]=MC.matte;return C[name]=new THREE.MeshLambertMaterial({map:noMap?null:getTex(name),vertexColors:true})}
 const[r,m,ns]=PBR[name]||[.8,0,1];const o={vertexColors:true,roughness:r,metalness:m,envMapIntensity:name==='window'?1.4:.7};
 const tn=GTEX[name]||name;if(!noMap){o.map=getTex(tn);if(ns>0){o.normalMap=normalTex(tn,ns);o.normalScale=new THREE.Vector2(1,1)}if(GTEX[name])o.roughnessMap=o.map}
 if(name==='gunTrans'){o.transparent=true;o.opacity=.82}
 const mat=new THREE.MeshStandardMaterial(o);if(GSCALE[name])mat.color.setScalar(GSCALE[name]);if(name.startsWith('gun')&&name!=='gunTP')mat.envMapIntensity=1.4;
 if(lvl==='hi'&&(name==='gunMetalP'||name==='gunAlu'||name==='gunChrome'))edgeWear(mat,true);else if(lvl==='hi'&&(name==='gunPoly'||name==='gunWood'))edgeWear(mat,false);if(name==='gunRubber'&&mat.normalScale)mat.normalScale.set(1.6,1.6);if(name==='gunMetal')mat.color.setScalar(2.4);if(name==='gunMatte')mat.color.setScalar(2.2);if(name==='char')mat.envMapIntensity=.45;return C[name]=mat}
// swap every tagged mesh under root to the material for the current level
export function swapMats(root){root.traverse(o=>{if(o.isMesh&&o.userData.tm){o.material=texMat(o.userData.tm);o.material.needsUpdate=true}else if(o.material&&o.material.needsUpdate!==undefined&&!o.isSprite){o.material.needsUpdate=true}})}
export const glowMat=new THREE.MeshBasicMaterial({vertexColors:true});glowMat.color.setScalar(2.4);
// soft round texture (smoke/fire/flash)
function radial(stops,n=64){const[c,x]=cvs(n);const g=x.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);for(const[o,col]of stops)g.addColorStop(o,col);x.fillStyle=g;x.fillRect(0,0,n,n);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
export const TX={
 soft:radial([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]),
 smoke:(()=>{const[c,x]=cvs(64);const r=rng(7);for(let i=0;i<14;i++){const px=16+r()*32,py=16+r()*32,rad=10+r()*16;const g=x.createRadialGradient(px,py,0,px,py,rad);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}return new THREE.CanvasTexture(c)})(),
 fire:(()=>{const[c,x]=cvs(64);for(let i=0;i<7;i++){const cx=32+(Math.random()-.5)*16,cy=36+(Math.random()-.5)*14,r=12+Math.random()*12;const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(.4,'rgba(255,170,60,.35)');g.addColorStop(1,'rgba(255,80,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})(),
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
// ---------- sky (shader: gradient, haze, sun disc + glow) + clouds ----------
const SKY_V=`varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`;
const SKY_F=`uniform vec3 top,mid,bot,sunDir,sunCol;uniform float sunI;varying vec3 vD;
#include <common>
void main(){vec3 d=normalize(vD);float y=d.y;vec3 c=y>0.?mix(mid,top,pow(clamp(y,0.,1.),.55)):mix(mid,bot,clamp(-y*4.,0.,1.));
 c+=mid*.35*exp(-abs(y)*14.);float s=max(dot(d,sunDir),0.);c+=sunCol*(pow(s,900.)*14.*sunI+pow(s,40.)*.45+pow(s,6.)*.18);
 gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function makeSky(top,mid,bottom,sunDir,sunCol=0xfff0d0,opt={}){const g=new THREE.SphereGeometry(400,32,16);
 const mat=new THREE.ShaderMaterial({vertexShader:SKY_V,fragmentShader:SKY_F,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
  uniforms:{top:{value:new THREE.Color(top)},mid:{value:new THREE.Color(mid)},bot:{value:new THREE.Color(bottom)},sunDir:{value:(sunDir||new THREE.Vector3(0,1,0)).clone()},sunCol:{value:new THREE.Color(sunCol)},sunI:{value:sunDir?1:0}}});
 const m=new THREE.Mesh(g,mat);m.renderOrder=-10;m.frustumCulled=false;const grp=new THREE.Group();grp.add(m);
 if(opt.clouds!==false){const cl=[];const r=rng(42);for(let i=0;i<18;i++){const a=r()*Math.PI*2,d=230+r()*80,y=60+r()*70;const shade=.92+r()*.08;
   for(let k=0;k<5;k++)cl.push({g:G('ico',1,1),top:null,p:[Math.cos(a)*d+k*13-26+r()*6,y+r()*7,Math.sin(a)*d+r()*12],s:[16+r()*14,6+r()*5,11+r()*8],c:new THREE.Color(shade,shade,shade).getHex()})}
  const cm=new THREE.Mesh(mergeParts(cl),new THREE.MeshBasicMaterial({vertexColors:true,fog:false,transparent:true,opacity:.88,depthWrite:false,color:new THREE.Color(0xffffff).lerp(new THREE.Color(mid),.12)}));cm.renderOrder=-8;cm.frustumCulled=false;grp.add(cm)}
 return grp}
// distant silhouettes on the horizon ring (follow the camera with the sky)
export function makeHorizon(kind,fogCol,seed=3){const r=rng(seed),parts=[];const F=new THREE.Color(fogCol);
 const tone=(k,base)=>F.clone().lerp(new THREE.Color(base),k).getHex();
 if(kind==='mountains'||kind==='coast'){const N=kind==='coast'?40:72,R=330;for(let i=0;i<N;i++){const a=i/N*Math.PI*2+(kind==='coast'?2.2:0);const a2=kind==='coast'?a*.45:a;const h=22+r()*55,w=40+r()*40;
   parts.push({g:G('cone',w,h,5),p:[Math.cos(a2)*R,h/2-6,Math.sin(a2)*R],r:[0,r()*6,0],c:tone(.35+r()*.15,kind==='coast'?0x355c4a:0x9a5a3c)});
   if(r()<.5)parts.push({g:G('cone',w*.6,h*.8,5),p:[Math.cos(a2+.04)*(R-30),h*.4-6,Math.sin(a2+.04)*(R-30)],c:tone(.5+r()*.15,kind==='coast'?0x2e5040:0x8a4a30)})}}
 if(kind==='city'||kind==='coast'){const R=kind==='coast'?300:290,N=kind==='coast'?36:110;for(let i=0;i<N;i++){const a=kind==='coast'?Math.PI*.95+i/N*1.4:i/N*Math.PI*2;const h=18+r()*r()*95,w=10+r()*16;
   parts.push({g:G('box',w,h,w),p:[Math.cos(a)*(R+r()*30),h/2-4,Math.sin(a)*(R+r()*30)],r:[0,-a,0],c:tone(.45+r()*.2,0x34465e)})}}
 if(!parts.length)return null;const m=new THREE.Mesh(mergeParts(parts),new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:false}));m.renderOrder=-9;m.frustumCulled=false;return m}
// ---------- animated water (fresnel sky reflection, sun glint) ----------
export const WT={value:0};
export function makeWater(deep,skyTop,skyMid,sunDir,sunCol){const u=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{deep:{value:new THREE.Color(deep)},shal:{value:new THREE.Color(deep).lerp(new THREE.Color(0x5fd0c8),.45)},
  skyT:{value:new THREE.Color(skyTop)},skyM:{value:new THREE.Color(skyMid)},sunDir:{value:sunDir.clone()},sunCol:{value:new THREE.Color(sunCol)}}]);u.time=WT;
 return new THREE.ShaderMaterial({uniforms:u,fog:true,transparent:true,depthWrite:true,
  vertexShader:`varying vec3 vW;
#include <fog_pars_vertex>
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
  fragmentShader:`uniform vec3 deep,shal,skyT,skyM,sunDir,sunCol;uniform float time;varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
float hh(vec2 p){float t=time;return sin(p.x*.31+t*1.1)*.5+sin(p.y*.37-t*.8)*.5+sin(dot(p,vec2(.7,.5))*1.3+t*1.9)*.22+sin(dot(p,vec2(-.6,.8))*2.6-t*2.7)*.1+sin(dot(p,vec2(.9,-.3))*5.1+t*3.6)*.04;}
void main(){vec2 p=vW.xz;float e=.15;float h0=hh(p);vec3 n=normalize(vec3(-(hh(p+vec2(e,0.))-h0)/e*.28,1.,-(hh(p+vec2(0.,e))-h0)/e*.28));
 vec3 v=normalize(cameraPosition-vW);float fr=.03+.97*pow(1.-max(dot(n,v),0.),5.);vec3 rf=reflect(-v,n);vec3 sky=mix(skyM,skyT,pow(clamp(rf.y,0.,1.),.5));
 vec3 base=mix(deep,shal,clamp(h0*.35+.4,0.,1.)*.5);vec3 c=mix(base,sky,clamp(fr,0.,1.));float sp=pow(max(dot(reflect(-sunDir,n),v),0.),220.);c+=sunCol*sp*7.;
 c+=vec3(.9)*smoothstep(.82,1.,h0*.5+.5)*.08;gl_FragColor=vec4(c,.94);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`})}
// ---------- instanced grass / tufts with wind ----------
export const GRASS_T={value:0};
let bladeGeo=null;function grassGeo(){if(bladeGeo)return bladeGeo;const P=[],C=[],N=[];const r=rng(9);
 for(let b=0;b<6;b++){const a=r()*Math.PI*2,h=.28+r()*.3,w=.035+r()*.025,lx=(r()-.5)*.2,lz=(r()-.5)*.2,lean=(r()-.5)*.25;const ca=Math.cos(a),sa=Math.sin(a);
  const bx=lx,bz=lz;P.push(bx-ca*w,0,bz-sa*w, bx+ca*w,0,bz+sa*w, bx+lean*ca,h,bz+lean*sa);C.push(.35,.35,.35, .35,.35,.35, 1,1,1);N.push(0,1,0,0,1,0,0,1,0)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));return bladeGeo=g}
export function scatterGrass(group,cols,{on,count,color,height=1,seed=5}){const r=rng(seed);const tris=[];let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 group.updateMatrixWorld(true);
 group.traverse(o=>{if(!o.isMesh||!on.includes(o.userData.tm))return;const pa=o.geometry.attributes.position.array,na=o.geometry.attributes.normal.array;
  for(let i=0;i<pa.length;i+=9){if(na[i+1]<.9)continue;a.fromArray(pa,i);b.fromArray(pa,i+3);c.fromArray(pa,i+6);const ar=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()/2;if(ar<.05)continue;total+=ar;tris.push([a.clone(),b.clone(),c.clone(),total])}});
 if(!tris.length)return null;
 const mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{s.uniforms.gT=GRASS_T;s.vertexShader='uniform float gT;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.);float hk=transformed.y*transformed.y*3.;transformed.x+=sin(gT*1.8+ip.x*.45+ip.z*.3)*.07*hk;transformed.z+=cos(gT*1.4+ip.z*.5-ip.x*.2)*.05*hk;
  #endif`)};
 const im=new THREE.InstancedMesh(grassGeo(),mat,count);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),p=new THREE.Vector3(),col=new THREE.Color(),base=new THREE.Color(color);let n=0;
 for(let k=0;k<count*3&&n<count;k++){const t=r()*total;let lo=0,hi=tris.length-1;while(lo<hi){const md=(lo+hi)>>1;if(tris[md][3]<t)lo=md+1;else hi=md}const[A,Bv,Cv]=tris[lo];
  let u=r(),v=r();if(u+v>1){u=1-u;v=1-v}p.copy(A).addScaledVector(ab.subVectors(Bv,A),u).addScaledVector(ac.subVectors(Cv,A),v);
  let blocked=false;for(const cc of cols){if(p.x>cc.x0-.1&&p.x<cc.x1+.1&&p.z>cc.z0-.1&&p.z<cc.z1+.1&&cc.y0<p.y+.3&&cc.y1>p.y+.05){blocked=true;break}}if(blocked)continue;
  q.setFromAxisAngle(_n.set(0,1,0),r()*6.28);const s=(.7+r()*.6)*height;sc.set(s,s*(.8+r()*.5),s);m4.compose(p,q,sc);im.setMatrixAt(n,m4);col.copy(base).multiplyScalar(.75+r()*.45);if(r()<.06)col.lerp(new THREE.Color(r()<.5?0xffe36e:0xffffff),.6);im.setColorAt(n,col);n++}
 im.count=n;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;im.userData.grass=true;return im}
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
 const sg=mergeParts([{g:G('cyl',.0058,.0058,.026,8),p:[0,0,0],c:0xd8a83a},{g:G('cyl',.0042,.0056,.006,8),p:[0,.016,0],c:0xd8a83a}]);
 this.sh=new THREE.InstancedMesh(sg,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.9,roughness:.3,color:new THREE.Color(1.6,1.6,1.6)}),24);
 const hg=mergeParts([{g:G('cyl',.0105,.0105,.05,10),p:[0,.006,0],c:0xb8221c},{g:G('cyl',.0112,.0112,.014,10),p:[0,-.024,0],c:0xd8a83a}]);
 this.hu=new THREE.InstancedMesh(hg,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.3,roughness:.5,color:new THREE.Color(1.5,1.5,1.5)}),10);this.hu.frustumCulled=false;this.hulls=[];this.huI=0;
 {const hide=new THREE.Matrix4().makeTranslation(0,-999,0);for(let i=0;i<10;i++){this.hu.setMatrixAt(i,hide);this.hulls.push({p:new THREE.Vector3(0,-999,0),v:new THREE.Vector3(),r:new THREE.Euler(),w:new THREE.Vector3(),t:0,k:1})}}scene.add(this.hu);this.sh.frustumCulled=false;this.shells=[];this.shI=0;this.sh.count=24;
 const hide=new THREE.Matrix4().makeTranslation(0,-999,0);for(let i=0;i<24;i++){this.sh.setMatrixAt(i,hide);this.shells.push({p:new THREE.Vector3(0,-999,0),v:new THREE.Vector3(),r:new THREE.Euler(),w:new THREE.Vector3(),t:0,k:1})}scene.add(this.sh);
 // sprites
 this.spr=[];for(let i=0;i<110;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.smoke,transparent:true,depthWrite:false}));s.visible=false;scene.add(s);this.spr.push({s,t:0})}this.sprI=0;
}
 spark(p,n,col=0xffc864,speed=4,life=.35){const S=this.sp;_c.set(col);for(let k=0;k<n;k++){const i=S.i++%S.N;S.pos[i*3]=p.x;S.pos[i*3+1]=p.y;S.pos[i*3+2]=p.z;
  S.vel[i*3]=(Math.random()-.5)*speed;S.vel[i*3+1]=Math.random()*speed*.8;S.vel[i*3+2]=(Math.random()-.5)*speed;S.life[i]=life*(.5+Math.random()*.6);S.col[i*3]=_c.r;S.col[i*3+1]=_c.g;S.col[i*3+2]=_c.b}}
 decal(p,n){const o=new THREE.Object3D();o.position.copy(p).addScaledVector(n,.012);o.lookAt(_p.copy(o.position).add(n));o.rotateZ(Math.random()*6);o.scale.setScalar(.7+Math.random()*.6);o.updateMatrix();
  const di=this.decI%80;this.dec.setMatrixAt(di,o.matrix);(this.decT=this.decT||[])[di]={t:performance.now(),m:o.matrix.clone()};this.decI++;this.dec.count=Math.min(80,this.decI);this.dec.instanceMatrix.needsUpdate=true}
 scorch(p,r){const o=new THREE.Object3D();o.position.set(p.x,p.y+.02,p.z);o.rotation.x=-Math.PI/2;o.scale.setScalar(r*2);o.updateMatrix();this.scor.setMatrixAt(this.scorI%10,o.matrix);this.scorI++;this.scor.count=Math.min(10,this.scorI);this.scor.instanceMatrix.needsUpdate=true}
 shell(p,v,type='rifle'){const hull=type==='shot';const s=hull?this.hulls[this.huI++%10]:this.shells[this.shI++%24];s.p.copy(p);s.v.copy(v);s.t=hull?2.2:1.6;s.k=type==='pistol'?.62:type==='rifle'?.85:.85;s.w.set((Math.random()-.5)*30,(Math.random()-.5)*30,(Math.random()-.5)*30)}
 sprite(o){const e=this.spr[this.sprI++%this.spr.length];const s=e.s,m=s.material;m.map=o.tex||TX.smoke;m.color.set(o.color??0xffffff);m.blending=o.add?THREE.AdditiveBlending:THREE.NormalBlending;m.opacity=o.op??.8;m.needsUpdate=true;
  s.position.copy(o.p);s.visible=true;Object.assign(e,{t:o.life,life:o.life,s0:o.s0,s1:o.s1,op:o.op??.8,v:o.v?o.v.clone():null,rise:o.rise||0});s.scale.setScalar(o.s0);m.rotation=Math.random()*6;return e}
 update(dt,floorAt){if(this.decT){const n=performance.now();if(!this._dc||n-this._dc>250){this._dc=n;let ch=false;for(let i=0;i<this.decT.length;i++){const d=this.decT[i];if(!d||d.done)continue;const a=(n-d.t)/1000-14;if(a<=0)continue;const k=Math.max(0,1-a/3);_m.copy(d.m);_m.scale(_s.set(k,k,k));this.dec.setMatrixAt(i,_m);ch=true;if(k<=0)d.done=1}if(ch)this.dec.instanceMatrix.needsUpdate=true}}const S=this.sp;for(let i=0;i<S.N;i++){if(S.life[i]<=0)continue;S.life[i]-=dt;if(S.life[i]<=0){S.pos[i*3+1]=-999;continue}
  S.vel[i*3+1]-=12*dt;S.pos[i*3]+=S.vel[i*3]*dt;S.pos[i*3+1]+=S.vel[i*3+1]*dt;S.pos[i*3+2]+=S.vel[i*3+2]*dt;const f=Math.min(1,S.life[i]*4);S.col[i*3]*=.97;S.col[i*3+1]*=.95;S.col[i*3+2]*=.9;}
  S.pts.geometry.attributes.position.needsUpdate=true;S.pts.geometry.attributes.color.needsUpdate=true;
  for(const[list,im]of[[this.shells,this.sh],[this.hulls,this.hu]]){let any=false;for(let i=0;i<list.length;i++){const s=list[i];if(s.t<=0&&!s.live)continue;any=true;s.live=s.t>0;s.t-=dt;s.v.y-=14*dt;s.p.addScaledVector(s.v,dt);const fy=floorAt?floorAt(s.p):0;
   if(s.p.y<fy+.012){s.p.y=fy+.012;if(s.v.y<-1.2&&this.onShellHit)this.onShellHit(s.p,im===this.hu);s.v.y*=-.35;s.v.x*=.55;s.v.z*=.55;s.w.multiplyScalar(.5)}
   s.r.x+=s.w.x*dt;s.r.y+=s.w.y*dt;s.r.z+=s.w.z*dt;_q.setFromEuler(s.r);_m.compose(s.t>0?s.p:_p.set(0,-999,0),_q,_s.set(s.k,s.k,s.k));im.setMatrixAt(i,_m)}
   if(any)im.instanceMatrix.needsUpdate=true}
  for(const e of this.spr){if(!e.s.visible)continue;e.t-=dt;if(e.t<=0){e.s.visible=false;continue}const k=1-e.t/e.life;e.s.scale.setScalar(e.s0+(e.s1-e.s0)*Math.sqrt(k));e.s.material.opacity=e.op*Math.min(1,e.t/(e.life*.5));
   if(e.v)e.s.position.addScaledVector(e.v,dt);e.s.position.y+=e.rise*dt}}
}
