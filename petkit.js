// HeadShotz v94 PET KIT: shared helpers for the detailed in-code pet models (petmodels.js) and the tier visuals (T1 plain / T2 glow / T3 particle aura).
// Everything is generated in code (no third-party assets).
import {THREE} from './gfx.js';
export const GE={sph:new THREE.SphereGeometry(1,16,12),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,10),cyl:new THREE.CylinderGeometry(1,1,1,10),tor:new THREE.TorusGeometry(1,.18,8,18)};
const MC={};
export function mat(c,o={}){const k=c+'|'+(o.em||0)+'|'+(o.ro??.7)+'|'+(o.me||0)+'|'+(o.ds?1:0)+'|'+(o.op||1);if(MC[k])return MC[k];const m=new THREE.MeshStandardMaterial({color:c,roughness:o.ro??.7,metalness:o.me||0,emissive:o.em?(o.ec??c):0,emissiveIntensity:o.em||0,side:o.ds?THREE.DoubleSide:THREE.FrontSide,transparent:(o.op||1)<1,opacity:o.op||1});return MC[k]=m}
export function P(par,t,col,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,o){const m=new THREE.Mesh(GE[t],o&&o.m?o.m:mat(col,o));m.position.set(x,y,z);m.scale.set(sx,sy??sx,sz??sx);m.rotation.set(rx,ry,rz);par.add(m);return m}
export const G=(par,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);par.add(g);return g};
const _u=new THREE.Vector3(0,1,0),_d=new THREE.Vector3();
// thin bone/limb from a to b (arrays), radius r
export function bone(par,a,b,r,m){const mesh=new THREE.Mesh(GE.cyl,m);_d.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const L=_d.length();mesh.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);mesh.scale.set(r,L/2,r);mesh.quaternion.setFromUnitVectors(_u,_d.normalize());par.add(mesh);return mesh}
// flat membrane polygon fan around vertex 0; pts = [[x,y,z],...] (hub first)
export function fan(pts,m){const v=[];for(let i=1;i<pts.length-1;i++)v.push(...pts[0],...pts[i],...pts[i+1]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return new THREE.Mesh(g,m)}
// glowing eye (emissive sphere + tiny pupil); registers its material in rig.glow so the tier can raise the intensity
export function glowEye(h,rig,col,x,y,z,r,slit){const m=new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.9,roughness:.3});(rig.glow||(rig.glow=[])).push(m);const e=P(h,'sph',0,x,y,z,r,r*1.1,r*.7,0,0,0,{m});if(slit)P(h,'sph',0x000000,x,y,z+r*.55,r*.22,r*.9,r*.2,0,0,0,{ro:.4});return e}
let _gt=null;export function glowTex(){if(_gt)return _gt;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);_gt=new THREE.CanvasTexture(c);return _gt}
const SPM={};export function spriteMat(col,op=1){const k=col+'|'+op;return SPM[k]||(SPM[k]=new THREE.SpriteMaterial({map:glowTex(),color:col,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}))}
// ---- tiers: T1 plain, T2 glow (halo + brighter eyes), T3 particle aura (orbiting sparks + stronger halo)
export const TIER_N=['T1','T2','T3'];
export function decorate(g,col,tier,lite){tier=tier|0;const old=g.userData.deco;if(old){g.remove(old);}g.userData.deco=null;g.userData.aura=null;const rig=g.userData.rig;
 if(rig&&rig.glow)for(const m of rig.glow)m.emissiveIntensity=tier>=3?2.4:tier===2?1.6:.9;
 if(tier<2)return;const d=new THREE.Group();const h=new THREE.Sprite(spriteMat(col,tier>=3?.5:.32));h.scale.setScalar(tier>=3?1.5:1.2);h.position.y=.32;d.add(h);d.userData.halo=h;
 if(tier>=3){const n=lite?5:9;const pos=new Float32Array(n*3);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const pm=new THREE.PointsMaterial({color:col,size:.09,map:glowTex(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});const pt=new THREE.Points(geo,pm);pt.frustumCulled=false;d.add(pt);g.userData.aura={pt,n,pos}}
 g.add(d);g.userData.deco=d}
export function animDeco(g,t){const d=g.userData.deco;if(!d)return;if(d.userData.halo)d.userData.halo.material.opacity=(g.userData.aura?.5:.32)*(.8+.2*Math.sin(t*2.6));const a=g.userData.aura;if(a){for(let i=0;i<a.n;i++){const ph=t*1.1+i*6.283/a.n,r=.34+.06*Math.sin(t*2+i),k=(t*.35+i/a.n)%1;a.pos[i*3]=Math.cos(ph)*r;a.pos[i*3+1]=.05+k*.7;a.pos[i*3+2]=Math.sin(ph)*r}a.pt.geometry.attributes.position.needsUpdate=true}}
