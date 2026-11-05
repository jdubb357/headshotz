// v98 Galaxy skins: full face mask / helmet kit (original procedural geometry). Authored in hero coordinates (head centre (0,1.55,0), face toward -z) so the
// Royale hero uses it as-is and the realistic soldier scales it onto his head. Returns vertex-coloured geometries:
//   head  - cranium dome, crest fin, brow ridge, ear pods, collar + glowing seam lines (pure-white vertices = "glow seam" in the galaxy shader)  [galaxy shader]
//   mask  - dark glossy face plate that covers the whole face                                                                                    [PBR]
//   eyes  - glowing almond eyes + mouth vents (blink-scaled by the hero rig)                                                                   [unlit glow]
import {THREE,GQ} from './gfx.js';
import * as AD from './addons.js';
const C=h=>new THREE.Color(h);
function col(g,c){const k=C(c),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=k.r;a[i*3+1]=k.g;a[i*3+2]=k.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));if(!g.attributes.normal)g.computeVertexNormals();return g}
function sph(sx,sy,sz,pos,c,w,h,ps=0,pl=Math.PI*2,ts=0,tl=Math.PI){const g=new THREE.SphereGeometry(1,w,h,ps,pl,ts,tl);g.scale(sx,sy,sz);g.translate(...pos);return col(g,c)}
const CY=1.55,SX=.283,SY=.272,SZ=.278;
const ell=(R,th,ph,dy=0)=>[-R*SX*Math.cos(ph)*Math.sin(th),CY+dy+R*SY*Math.cos(th),R*SZ*Math.sin(ph)*Math.sin(th)];
const arc=(R,th,p0,p1,n=14,dy=0)=>{const o=[];for(let i=0;i<n;i++)o.push(ell(R,th,p0+(p1-p0)*i/(n-1),dy));return o};
const vline=(R,ph,t0,t1,n=10)=>{const o=[];for(let i=0;i<n;i++)o.push(ell(R,t0+(t1-t0)*i/(n-1),ph));return o};
const CACHE={};
export function galaxyHead(top,dark,lite){const key=top+'|'+dark+'|'+lite+'|'+GQ.level;if(CACHE[key])return CACHE[key];const lo=GQ.level==='low',W=lo?18:28,Hh=lo?12:18,sg=lo?5:7;const F=-Math.PI/2;const white=0xffffff;const L=[],CR=[];const dome=sph(SX,SY,SZ,[0,CY,.005],top,W,Hh);
 // crest fin over the skull (forehead -> nape) with a glowing spine line
 CR.push(AD.sweep(AD.bez([0,1.74,-.13],[0,1.9,-.06],[0,1.9,.14],[0,1.7,.29],12),t=>.03+.075*Math.sin(Math.PI*Math.min(1,t*.92+.04)),t=>C(top).lerp(C(0xffffff),.12+.1*t),sg,.22,0,false));
 CR.push(AD.sweep(AD.bez([0,1.738,-.13],[0,1.9,-.06],[0,1.9,.14],[0,1.7,.29],14).map(p=>[p[0],p[1]+.002,p[2]]),t=>.005,()=>C(white),4,1,0,false));
 // collar ring
 {const p=[];for(let i=0;i<=18;i++){const a=.35+i/18*(Math.PI*2-.7);p.push([Math.sin(a)*.135,1.335,Math.cos(a)*.135])}L.push(AD.sweep(p,()=>.03,()=>C(top).multiplyScalar(.9),sg,1,0,false))}
 // ear pods + glowing rings
 for(const s of[-1,1]){L.push(AD.sweep([[s*.25,CY,.03],[s*.32,CY,.03]],()=>.088,()=>C(top).multiplyScalar(.8),sg+2,1,.15,true));
  const t=new THREE.TorusGeometry(.066,.0075,5,lo?14:22);t.rotateY(Math.PI/2);t.translate(s*.323,CY,.03);L.push(col(t,white));
  const t2=new THREE.TorusGeometry(.03,.006,5,lo?10:16);t2.rotateY(Math.PI/2);t2.translate(s*.331,CY,.03);L.push(col(t2,white))}
 // brow ridge + glowing brow line
 L.push(AD.sweep(arc(1.02,1.3,F-.98,F+.98,16),t=>.024*(1-.4*Math.abs(t-.5)*2)+.006,()=>C(top).lerp(C(0xffffff),.2),sg,1,.3,true));
 L.push(AD.sweep(arc(1.0,1.18,F-.9,F+.9,16),()=>.0055,()=>C(white),4,1,0,false));
 // chin ridge
 L.push(AD.sweep([ell(1.06,2.2,F),ell(1.12,2.5,F)],t=>.022-.012*t,()=>C(top).lerp(C(0xffffff),.1),sg,.7,.4,true));
 // mask plate (separate glossy mesh)
 const M=[];
 // organic mask outline: a polar patch on the head ellipsoid (rounded jaw -> pointed chin, brow arch), so it reads as a sculpted visor, not a screen
 const mpt=(r,a)=>{const X=r*Math.cos(a)*(1+.06*Math.cos(a*2)),Y=r*Math.sin(a);let th=1.74+Y*.7+(Y>0?Y*.17*(1-X*X):0),ph=F+X*.96;if(Y<0)th-=Math.abs(Y)*.1*Math.abs(Math.cos(a))*0;return ell(1.045+.012*Math.sin(a*3)*0,th,ph)};
 {const NR=lo?4:6,NA=lo?20:32;const P=[],Cc=[],I=[];const mc=C(dark);const vtx=(r,a)=>{const p=mpt(r,a);P.push(...p);const sh=.75+.5*(1-r)*.5;Cc.push(mc.r*sh,mc.g*sh,mc.b*sh);return P.length/3-1};
  const c0=vtx(0,0);const rings=[];for(let i=1;i<=NR;i++){const r=i/NR,row=[];for(let k=0;k<NA;k++)row.push(vtx(r,k/NA*Math.PI*2));rings.push(row)}
  for(let k=0;k<NA;k++){const k2=(k+1)%NA;I.push(c0,rings[0][k2],rings[0][k])}
  for(let i=0;i<NR-1;i++)for(let k=0;k<NA;k++){const k2=(k+1)%NA;I.push(rings[i][k],rings[i][k2],rings[i+1][k]);I.push(rings[i][k2],rings[i+1][k2],rings[i+1][k])}
  const gm=new THREE.BufferGeometry();gm.setAttribute('position',new THREE.Float32BufferAttribute(P,3));gm.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));gm.setIndex(I);gm.computeVertexNormals();M.push(gm);
  // glowing outline + brow arc on the visor
  const ol=[];for(let k=0;k<=NA;k++)ol.push(mpt(1.012,k/NA*Math.PI*2));L.push(AD.sweep(ol,()=>.0065,()=>C(white),4,1,0,false));
  const br=[];for(let k=0;k<=14;k++){const a=Math.PI*(.18+.64*k/14);br.push(mpt(.62+.0*k,a))}}
 // nose ridge + cheek vents on the plate
 M.push(AD.sweep([ell(1.06,1.5,F),ell(1.1,1.78,F)],t=>.014-.004*t,()=>C(dark).lerp(C(0xffffff),.18),5,.8,.4,true));
 for(const s of[-1,1])for(let i=0;i<3;i++){const p=[ell(1.052,1.95+i*.1,F+s*(.5+i*.04)),ell(1.052,1.95+i*.1,F+s*(.72+i*.02))];M.push(AD.sweep(p,()=>.006,()=>C(dark).multiplyScalar(.4),4,1,0,true))}
 // eyes: almond slits, plus 4 mouth vent bars
 const E=[];const shp=(pts)=>{const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);sh.closePath();return new THREE.ShapeGeometry(sh)};
 for(const s of[-1,1]){const g=shp([[-.07,-.014],[-.02,.032],[.058,.05],[.098,.024],[.034,-.026],[-.024,-.028]].map(p=>[p[0]*s,p[1]]));if(s<0){/* mirror flips winding; basic material is double sided */}g.rotateZ(s*-.16);g.rotateY(Math.PI+s*.0);g.rotateY(-s*.34*0);g.translate(s*.105,1.568,-.285);E.push(col(g,white))}
 for(let i=0;i<3;i++){const g=shp([[-.028+i*.004,-.0045],[.028-i*.004,-.0045],[.028-i*.004,.0045],[-.028+i*.004,.0045]]);g.rotateY(Math.PI);g.translate(0,1.455-i*.022,-.288+i*.006);E.push(col(g,white))}
 return CACHE[key]={head:AD.merge([dome,...L,...CR]),extras:AD.merge(L),mask:AD.merge(M),eyes:AD.merge(E)}}
