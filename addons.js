// v98 sculpted character add-ons (original procedural geometry): ears with inner ear + fur tufts, curved ridged horns, tapered segmented tails with tip tufts,
// crowns, halos, bat/feather wings. Everything is a swept, tapered surface (no sphere "bubbles"), vertex-coloured with per-vertex gradients, shared by the
// Royale hero (toon.js) and the realistic soldier (gear.js / humans.js). Geometry is cached per spec; all pieces are tiny (a few hundred tris).
import {THREE,GQ} from './gfx.js';
const V3=THREE.Vector3,C3=THREE.Color;
const lo=()=>GQ.level==='low';
const hex=c=>new C3(c),mixh=(a,b,t)=>new C3(a).lerp(new C3(b),t);
// ---- tiny mesh builder: positions + colours + indices, smooth normals
function mk(){const P=[],C=[],I=[];return{P,C,I,
 v(x,y,z,c){P.push(x,y,z);C.push(c.r,c.g,c.b);return P.length/3-1},
 tri(a,b,c){I.push(a,b,c)},
 geo(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();return g}}}
// sweep a tapered (optionally flattened) tube along a polyline. rad(t)->radius, col(t,a)->Color (a = angle around, 0 = front).
// flat = ratio of the second axis (thickness) to the first (width); tip = how far the pointed end extends past the last ring (in units of last radius)
export function sweep(path,rad,col,seg=8,flat=1,tip=0,cap0=true){const m=mk();const n=path.length;const pts=path.map(p=>new V3(...p));
 const T=[];for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];T.push(b.clone().sub(a).normalize())}
 let nrm=new V3(0,0,-1);if(Math.abs(T[0].dot(nrm))>.9)nrm=new V3(1,0,0);nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize();
 const rings=[];
 for(let i=0;i<n;i++){const t=i/(n-1);const r=rad(t);if(i>0){// parallel transport
   const q=new THREE.Quaternion().setFromUnitVectors(T[i-1],T[i]);nrm.applyQuaternion(q)}
  const bin=new V3().crossVectors(T[i],nrm).normalize();const ring=[];
  for(let k=0;k<seg;k++){const a=k/seg*Math.PI*2;const cx=Math.cos(a)*r*flat,cy=Math.sin(a)*r;const p=pts[i].clone().addScaledVector(nrm,cx).addScaledVector(bin,cy);ring.push(m.v(p.x,p.y,p.z,col(t,a)))}rings.push(ring)}
 for(let i=0;i<n-1;i++)for(let k=0;k<seg;k++){const k2=(k+1)%seg;const a=rings[i][k],b=rings[i][k2],c=rings[i+1][k],d=rings[i+1][k2];m.tri(a,c,b);m.tri(b,c,d)}
 // tip
 {const e=pts[n-1],r=rad(1),tv=e.clone().addScaledVector(T[n-1],Math.max(.0001,tip*Math.max(r,.004)));const c=m.v(tv.x,tv.y,tv.z,col(1,0));for(let k=0;k<seg;k++){const k2=(k+1)%seg;m.tri(rings[n-1][k],c,rings[n-1][k2])}}
 if(cap0){const s=pts[0],c=m.v(s.x,s.y,s.z,col(0,0));for(let k=0;k<seg;k++){const k2=(k+1)%seg;m.tri(rings[0][k],rings[0][k2],c)}}
 return m.geo()}
export function bez(a,b,c,d,n=10){const o=[];for(let i=0;i<n;i++){const t=i/(n-1),u=1-t;o.push([0,1,2].map(k=>u*u*u*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*d[k]))}return o}
export function merge(list){const P=[],C=[],I=[],N=[];let o=0;for(const g0 of list){if(!g0)continue;const g=g0;const p=g.attributes.position,c=g.attributes.color,nn=g.attributes.normal;for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));C.push(c.getX(i),c.getY(i),c.getZ(i));N.push(nn.getX(i),nn.getY(i),nn.getZ(i))}
  if(g.index)for(let i=0;i<g.index.count;i++)I.push(g.index.getX(i)+o);else for(let i=0;i<p.count;i++)I.push(i+o);o+=p.count}
 if(!P.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setIndex(I);g.computeBoundingSphere();return g}
// place a geometry: scale, euler rotation (xyz), translate (returns a clone)
export function place(g,p=[0,0,0],r=[0,0,0],s=[1,1,1]){const o=g.clone();const m=new THREE.Matrix4().compose(new V3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new V3(...(typeof s==='number'?[s,s,s]:s)));o.applyMatrix4(m);return o}
export function mirrorX(g){const o=g.clone();const p=o.attributes.position,n=o.attributes.normal;for(let i=0;i<p.count;i++){p.setX(i,-p.getX(i));n.setX(i,-n.getX(i))}if(o.index){const ix=o.index;for(let i=0;i<ix.count;i+=3){const a=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,a)}}return o}
const flat=c=>()=>c;
// ---- fur tuft: a few curved tapered blades fanning from a point (+y). blades spread in the XZ plane; used for ear fluff, tail tips, cheek/chest ruffs
export function tuft(n=5,len=.1,w=.014,spread=.7,curl=.25,c0=0xffffff,c1=null,seed=1){const L=[];const c1c=hex(c1==null?c0:c1),c0c=hex(c0);let s=seed;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++){const a=n===1?0:(i/(n-1)-.5)*2*spread;const l=len*(.78+.3*rnd()*(1-Math.abs(a)/Math.max(spread,.01)*.4));const path=bez([0,0,0],[Math.sin(a)*l*.25,l*.35,0],[Math.sin(a)*l*.6+curl*l*.2*Math.sign(a||1),l*.7,0],[Math.sin(a)*l*.9+curl*l*.5*Math.sign(a||1),l*.97,0],5);
  L.push(place(sweep(path,t=>w*(1-t*.92)*(1+.35*Math.sin(t*3)),t=>mixh(c0c,c1c,t),lo()?4:5,.55,2.2,false),[0,0,0],[0,(rnd()-.5)*.5,0]))}
 return merge(L)}
// ---- ears. kind: cat | fox | wolf | bunny | elf | bat | round. Returns one ear (left, +x side pointing up) with inner ear + base fluff; local origin = ear base centre, +y up, front = -z
const EARS={cat:{h:.17,w:.075,flat:.28,lean:.05,side:.16,dish:.5,inner:.62,fluff:3,tipDark:0},
 fox:{h:.24,w:.07,flat:.26,lean:.04,side:.12,dish:.55,inner:.58,fluff:4,tipDark:1},
 wolf:{h:.2,w:.07,flat:.3,lean:.06,side:.08,dish:.45,inner:.55,fluff:4,tipDark:1},
 bunny:{h:.42,w:.052,flat:.3,lean:-.03,side:.22,dish:.65,inner:.66,fluff:0,tipDark:0,round:1,fold:1},
 elf:{h:.16,w:.045,flat:.16,lean:.45,side:.55,dish:.4,inner:.5,fluff:0,tipDark:0,back:1},
 bat:{h:.26,w:.095,flat:.12,lean:.0,side:.14,dish:.3,inner:.6,fluff:0,tipDark:0,bat:1},
 round:{h:.1,w:.07,flat:.35,lean:0,side:.1,dish:.5,inner:.6,fluff:2,tipDark:0,round:1}};
const EC={};
export function ear(kind,col,inCol=0xffb3c1,tipCol=null){const k=kind+'|'+col+'|'+inCol+'|'+tipCol+'|'+GQ.level;if(EC[k])return EC[k];const S=EARS[kind]||EARS.cat,seg=lo()?6:9,n=lo()?7:10;const c=hex(col),ic=hex(inCol),tc=hex(tipCol==null?mixh(col,0x000000,.7).getHex():tipCol);
 // centreline: slight outward lean + back-curve, bunny ears fold forward at the top
 const path=[];for(let i=0;i<n;i++){const t=i/(n-1);let x=S.side*t*t*.9,y=S.h*t,z=S.lean*t;if(S.fold)z-=.09*t*t*t;if(S.back){x=S.side*t;z=S.lean*t*.2;y=S.h*t*(1-.3*t)}path.push([x,y,z])}
 const rad=t=>{let r=S.w*(S.round?Math.sin(Math.acos(Math.min(1,t*.96))+.0001)*.85+.1*(1-t):(1-t)*(1-t*.2)+.012);if(S.bat)r=S.w*(1-t*.75)*(1+.5*Math.sin(t*3.1));if(S.back)r=S.w*(1-t)*.9+.004;return Math.max(.003,r*(t<.1?.7+3*t:1))};
 let g=sweep(path,rad,(t,a)=>{const d=S.tipDark?Math.max(0,(t-.62)/.38):0;const base=mixh(c,0xffffff,0);return mixh(base,tc,d*d).multiplyScalar(.82+.18*t)},seg,S.flat,S.round?.5:1.4);
 // dish the front (-z) toward the centre so the ear reads as a cupped shell
 {const p=g.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),t=Math.min(1,Math.max(0,y/S.h)),z=p.getZ(i),zc=S.lean*t+(S.fold?-.09*t*t*t:0);const dz=z-zc;if(dz<0){p.setZ(i,z-dz*S.dish*(1-t)*.8)}}g.computeVertexNormals()}
 // inner ear: smaller pink shell sitting in the dish, slightly in front
 const ip=path.map((q,i)=>{const t=i/(n-1);return[q[0]*.97,q[1]*S.inner+.012,q[2]-S.w*S.flat*.55*(1-t*.5)]});
 let gi=sweep(ip,t=>rad(t*.85)*.62*(1-t*.2),(t,a)=>mixh(ic,0xffffff,.2*(1-t)).multiplyScalar(.85+.15*(1-t)),seg,S.flat*.7,1.2);
 const parts=[g,gi];
 // base fluff
 for(let f=0;f<S.fluff;f++){const a=(f/(Math.max(1,S.fluff-1))-.5)*1.0;parts.push(place(tuft(3,.06,.011,.5,.2,mixh(c,0xffffff,.55).getHex(),c.getHex(),f+3),[a*.045,S.h*.06,-S.w*S.flat*.7],[-.55,0,-a*.7],[1,1,1]))}
 return EC[k]=merge(parts)}
// ---- horn: curved tapered ridged tube. dir: bends outward & back. len/base in metres (head-scale ≈ .1..). twist adds a corkscrew; ridges adds rings; tipCol for a bone-white/ember tip
export function horn(len,base,col,o={}){const k='h'+len+'|'+base+'|'+col+'|'+JSON.stringify(o)+GQ.level;if(EC[k])return EC[k];const curve=o.curve==null?.7:o.curve,back=o.back==null?.35:o.back,rg=o.ridges||0,tip=hex(o.tip==null?col:o.tip),c=hex(col),dark=hex(o.dark==null?mixh(col,0x000000,.45).getHex():o.dark);const n=lo()?9:14;
 const path=[];for(let i=0;i<n;i++){const t=i/(n-1);const a=t*curve*1.6;path.push([Math.sin(a)*len*.55*(t+.15*t*t)*(o.outward==null?1:o.outward),len*(t-.35*t*t*curve)*.95,-back*len*.35*t*t+Math.sin(t*6.28*(o.wave||0))*len*.03])}
 const g=sweep(path,t=>{let r=base*Math.pow(1-t,.78)+.0035;if(rg)r*=1+.07*Math.sin(t*rg*6.28);return r},(t,a)=>{const d=Math.max(0,(t-.55)/.45);let cc=mixh(mixh(dark,c,Math.min(1,t*2.4)),tip,d);return cc.multiplyScalar(.9+.1*Math.cos(a))},lo()?6:9,o.flat||1,2.2);
 return EC[k]=g}
// ---- crown: flared band + pointed spires with gem tips + small side pearls. radius r, spire height h
export function crown(r,h,col,gem=0xe5333f,spires=5){const k='c'+r+'|'+h+'|'+col+'|'+gem+'|'+spires+GQ.level;if(EC[k])return EC[k];const c=hex(col),L=[];const seg=lo()?10:16;
 // band: lathe-like swept ring (flared, with a rim)
 {const m=mk();const rows=[[r*.98,0,mixh(col,0x000000,.25)],[r*1.0,h*.12,c],[r*1.04,h*.46,mixh(col,0xffffff,.12)],[r*1.08,h*.58,c],[r*1.06,h*.62,mixh(col,0xffffff,.3)]];const rr=rows.map(w=>{const ring=[];for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;ring.push(m.v(Math.sin(a)*w[0],w[1],Math.cos(a)*w[0],w[2].isColor?w[2]:hex(w[2])))}return ring});
  for(let j=0;j<rr.length-1;j++)for(let i=0;i<seg;i++){const i2=(i+1)%seg;m.tri(rr[j][i],rr[j+1][i],rr[j][i2]);m.tri(rr[j][i2],rr[j+1][i],rr[j+1][i2])}
  // inner wall (so the band is double-sided/visible from inside)
  const ri=rr.map(r0=>r0.map(v=>m.v(m.P[v*3]*.94,m.P[v*3+1],m.P[v*3+2]*.94,hex(col).multiplyScalar(.7))));for(let j=0;j<ri.length-1;j++)for(let i=0;i<seg;i++){const i2=(i+1)%seg;m.tri(ri[j][i],ri[j][i2],ri[j+1][i]);m.tri(ri[j][i2],ri[j+1][i2],ri[j+1][i])}
  L.push(m.geo())}
 for(let i=0;i<spires;i++){const a=i/spires*Math.PI*2,big=i%2===0?1:.7;const sp=sweep(bez([0,0,0],[0,h*.4,0],[0,h*.8,0],[0,h*(.9+.5*big),0],5),t=>r*.19*(1-t*.75)*(1-.3*Math.sin(t*3.1)*0),(t,aa)=>mixh(c,0xffffff,.18*t),lo()?4:6,.45,1.6);
  L.push(place(sp,[Math.sin(a)*r*1.05,h*.55,Math.cos(a)*r*1.05],[0,a,0]));
  // gem
  const gm=mk();const gc=hex(gem);const gy=h*(1.35+.5*big),gr=r*.1;const top=gm.v(0,gy+gr*1.3,0,mixh(gem,0xffffff,.55)),bot=gm.v(0,gy-gr,0,gc.clone().multiplyScalar(.7)),ring=[];for(let q=0;q<6;q++){const aa=q/6*Math.PI*2;ring.push(gm.v(Math.sin(aa)*gr,gy,Math.cos(aa)*gr,q%2?gc:mixh(gem,0xffffff,.3)))}for(let q=0;q<6;q++){const q2=(q+1)%6;gm.tri(ring[q],top,ring[q2]);gm.tri(ring[q2],bot,ring[q])}
  L.push(place(gm.geo(),[Math.sin(a)*r*1.05,0,Math.cos(a)*r*1.05],[0,0,0],1))}
 return EC[k]=merge(L)}
// ---- halo: thin glowing ring with a soft inner highlight and little cardinal sparks
export function halo(r,t,col){const k='o'+r+'|'+t+'|'+col+GQ.level;if(EC[k])return EC[k];const m=mk();const seg=lo()?18:32,ts=lo()?5:7;const c=hex(col);for(let i=0;i<seg;i++){}
 const ring=[];for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;const row=[];for(let j=0;j<ts;j++){const b=j/ts*Math.PI*2;const rr=r+Math.cos(b)*t,y=Math.sin(b)*t*.7;row.push(m.v(Math.sin(a)*rr,y,Math.cos(a)*rr,mixh(col,0xffffff,.25+.35*Math.max(0,Math.sin(b)))))}ring.push(row)}
 for(let i=0;i<seg;i++){const i2=(i+1)%seg;for(let j=0;j<ts;j++){const j2=(j+1)%ts;m.tri(ring[i][j],ring[i2][j],ring[i][j2]);m.tri(ring[i][j2],ring[i2][j],ring[i2][j2])}}
 return EC[k]=m.geo()}
// ---- bat wing (membrane stretched between a curved arm and 3 finger bones) — local: shoulder at origin, wing spreads to +x. returns {bone, mem}
export function batWing(span,h,boneCol,memCol){const k='bw'+span+'|'+h+'|'+boneCol+'|'+memCol+GQ.level;if(EC[k])return EC[k];const bc=hex(boneCol),mc=hex(memCol);
 const arm=bez([0,0,0],[span*.2,h*.55,0],[span*.5,h*.8,0],[span*.62,h*.62,0],8),tips=[[span,h*.25,0],[span*.86,-h*.35,0],[span*.55,-h*.72,0]];
 const bones=[sweep(arm,t=>.016*(1-t*.6)+.004,t=>mixh(bc,0xffffff,.12*t),6,1,1.5)];const wrist=arm[arm.length-1];const fingers=tips.map((e,i)=>sweep(bez(wrist,[wrist[0]+(e[0]-wrist[0])*.4,wrist[1]+(e[1]-wrist[1])*.3+.03,0],[wrist[0]+(e[0]-wrist[0])*.75,wrist[1]+(e[1]-wrist[1])*.7,0],e,6),t=>.011*(1-t*.8)+.002,t=>mixh(bc,0xffffff,.1*t),5,1,1.2));
 const m=mk();const edge=[wrist,...tips,[0,-h*.35,0]];
 // scalloped trailing edge, then a billowing membrane grid (radial strips from the shoulder) between every pair of neighbouring bones
 const pts=[];for(let i=0;i<edge.length-1;i++){const a=edge[i],b=edge[i+1];pts.push(a);if(i>0)pts.push([(a[0]+b[0])/2*.93,(a[1]+b[1])/2*.9,0])}pts.push(edge[edge.length-1]);
 const KR=lo()?3:5,KC=lo()?1:2;
 for(let i=0;i<pts.length-1;i++){const A=pts[i],B=pts[i+1];const grid=[];for(let r=0;r<=KR;r++){const row=[];const f=r/KR;for(let q=0;q<=KC;q++){const g=q/KC;const px=(A[0]*(1-g)+B[0]*g)*f,py=(A[1]*(1-g)+B[1]*g)*f;const bil=Math.sin(f*Math.PI)*Math.sin(g*Math.PI)*h*.05;const shade=.62+.38*f*(.7+.3*Math.sin(g*Math.PI));row.push(m.v(px,py,-bil,mc.clone().multiplyScalar(shade)))}grid.push(row)}
  for(let r=0;r<KR;r++)for(let q=0;q<KC;q++){const a0=grid[r][q],a1=grid[r][q+1],b0=grid[r+1][q],b1=grid[r+1][q+1];m.tri(a0,b0,a1);m.tri(a1,b0,b1)}}
 const mem=m.geo();
 return EC[k]={bone:merge([...bones,...fingers]),mem}}
// ---- feathered wing: n tapered flat feathers fanned from the shoulder, longer toward the tip (+x). {feathers}
export function featherWing(span,h,col,tipCol){const k='fw'+span+'|'+h+'|'+col+'|'+tipCol+GQ.level;if(EC[k])return EC[k];const n=lo()?7:11,L=[];const c=hex(col),tc=hex(tipCol);
 for(let i=0;i<n;i++){const t=i/(n-1);const ang=.95-t*1.55;const len=span*(.5+.5*Math.sin(t*2.2+.4)*.9+.12*(1-t));const bend=.25+.2*t;const p=bez([0,0,0],[Math.cos(ang)*len*.3,Math.sin(ang)*len*.3+h*.1,0],[Math.cos(ang)*len*.7,Math.sin(ang)*len*.7+h*.1-bend*len*.15,0],[Math.cos(ang)*len,Math.sin(ang)*len-bend*len*.3,0],7);
  L.push(sweep(p,u=>(.078+.025*t)*Math.pow(Math.sin(Math.PI*Math.min(1,u*.96+.04)),.7)+.003,u=>mixh(c,tc,u*u*.8).multiplyScalar(.85+.15*u),lo()?5:6,.16,1.5,false))}
 return EC[k]=merge(L)}
// ---- tail spec -> segments: returns array of {geo, len, rx} for a chain; each segment geometry starts at the origin and points +y (length len); consumers hang them as nested groups.
// kinds: fox (bushy, white tip) | cat (slim, curled) | demon (thin with a spade tip) | dragon (thick, spiked) | comet (bright plume) | wolf
const TAILS={fox:{n:6,len:.58,r0:.05,r1:.078,rt:.012,bulge:1.0,tuft:1,tip:0xffffff,spike:0},cat:{n:7,len:.7,r0:.034,r1:.03,rt:.018,bulge:0,tuft:0,spike:0},
 wolf:{n:6,len:.66,r0:.05,r1:.07,rt:.012,bulge:.8,tuft:1,spike:0},demon:{n:7,len:.78,r0:.036,r1:.02,rt:.008,bulge:0,tuft:0,spike:0,spade:1},
 dragon:{n:7,len:.82,r0:.085,r1:.04,rt:.008,bulge:0,tuft:0,spike:1},comet:{n:6,len:.74,r0:.045,r1:.075,rt:.012,bulge:.7,tuft:1,spike:0,glow:1}};
export function tailSpec(kind){return TAILS[kind]||TAILS.fox}
export function tailSegs(kind,col,tipCol,accent){const k='t'+kind+'|'+col+'|'+tipCol+'|'+accent+GQ.level;if(EC[k])return EC[k];const S0=tailSpec(kind),S={...S0,n:lo()?Math.max(4,Math.ceil(S0.n*.62)):S0.n},seg=lo()?6:9,c=hex(col),tc=hex(tipCol==null?col:tipCol),ac=hex(accent==null?col:accent);const out=[];const per=S.len/S.n;
 for(let i=0;i<S.n;i++){const t0=i/S.n,t1=(i+1)/S.n;const rr=t=>{let r;if(S.bulge){r=S.r0+(S.r1-S.r0)*Math.sin(Math.min(1,t)*Math.PI*.8);r*=1-Math.pow(Math.max(0,t-.82)/.18,2)*.85}else r=S.r0+(S.rt-S.r0)*t;return Math.max(S.rt,r)};
  const ra=rr(t0),rb=rr(t1),last=i===S.n-1;const geos=[];
  // segment = short tapered tube whose ends match its neighbours, slightly overlapping so the joint hides
  geos.push(sweep([[0,-.01,0],[0,per*.5,0],[0,per+.012,0]],u=>ra+(rb-ra)*u,(u,a)=>{const tt=t0+(t1-t0)*u;let cc=c.clone();if(S.tip&&tt>.7)cc=mixh(c,hex(S.tip),Math.min(1,(tt-.7)/.2));else if(tipCol!=null&&tt>.8)cc=mixh(c,tc,(tt-.8)/.2);if(S.spade||S.glow||S.spike)cc=mixh(cc,ac,0);const bel=.88+.12*Math.cos(a);return cc.multiplyScalar(bel*(.9+.1*tt))},seg,1,last?1.5:0,i===0));
  if(S.spike&&i>0&&i<S.n-1){// dorsal spikes
   geos.push(place(sweep(bez([0,0,0],[0,.03,.01],[0,.06,.0],[0,.085,-.012],4),u=>.016*(1-u*.9),u=>mixh(ac,0xffffff,.2*u),5,.6,1.3),[0,per*.4,rb*.7*0-0.0],[Math.PI/2*0,0,0]));
   geos.push(place(sweep(bez([0,0,0],[0,.025,.0],[0,.05,.01],[0,.07,.02],4),u=>.013*(1-u*.9),u=>mixh(ac,0xffffff,.2*u),5,.6,1.3),[0,per*.4,ra*.9],[Math.PI/2*0.9,0,0]))}
  if(last&&S.tuft){const tf=tuft(lo()?5:7,S.len*.16,.026,.8,.3,S.glow?mixh(col,0xffffff,.6).getHex():(S.tip!=null?S.tip:tipCol!=null?tipCol:col),S.glow?accent:col,5);geos.push(place(tf,[0,per*.85,0],[0,0,0],1));for(let q=0;q<2;q++)geos.push(place(tf,[0,per*.7,0],[0,q*1.57+.8,.5],[.6,.6,.6]))}
  if(last&&S.spade){const sh=mk();const L0=.075,W=.052;const base=sh.v(0,0,0,ac.clone().multiplyScalar(.9));const a1=sh.v(-W,L0*.45,0,ac),a2=sh.v(W,L0*.45,0,ac),tp=sh.v(0,L0*1.25,0,mixh(col,0xffffff,.25)),bk=sh.v(0,L0*.38,.0,ac.clone().multiplyScalar(.6));const th=sh.v(0,L0*.45,-.012,ac),th2=sh.v(0,L0*.45,.012,ac);sh.tri(base,a1,th);sh.tri(base,th,a2);sh.tri(a1,tp,th);sh.tri(th,tp,a2);sh.tri(base,th2,a1);sh.tri(base,a2,th2);sh.tri(a1,th2,tp);sh.tri(th2,a2,tp);geos.push(place(sh.geo(),[0,per*.92,0]))}
  out.push({geo:merge(geos),len:per,last})}
 return EC[k]=out}

// ---- shared PBR vertex-coloured materials for the add-ons (one per kind+quality) and the tail chain animation (hero + soldier)
const AMT={};
export function addonMat(k){const key=k+GQ.level;if(AMT[key])return AMT[key];const lowQ=GQ.level==='low';let m;
 if(k==='gloss')m=lowQ?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.25,envMapIntensity:.9}):new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.3,metalness:.3,clearcoat:.55,clearcoatRoughness:.25,envMapIntensity:1});
 else if(k==='metal')m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.26,metalness:.92,envMapIntensity:1.25});
 else if(k==='cloth')m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide,envMapIntensity:.45});
 else m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,side:THREE.DoubleSide,envMapIntensity:.5});
 return AMT[key]=m}
// segmented tail: nested groups (tail[0] is the root segment), base = rest angle of the root about x (pi/2 = straight back)
export function tickTail(tr,tail,t,run,air,lx,crouch){const n=tail.length;tr.rotation.x=1.8-run*.3+air*.2-crouch*.25;tr.rotation.z=-(lx||0)*run*.3+Math.sin(t*1.2)*.08;
 for(let i=0;i<n;i++){const g=tail[i];const w=Math.sin(t*(1.8+run*2.8)-i*.7);g.rotation.x=-.16-(i/n)*.05+Math.sin(t*1.5-i*.55)*.04+run*.05*Math.sin(t*9-i);g.rotation.z=w*(.07+.1*run)*(.5+i/n)}}
export function buildTailChain(kind,col,tipCol,accent,mat){const sg=tailSegs(kind,col,tipCol,accent);const root=new THREE.Group();root.rotation.x=1.8;let par=root;const tail=[];const meshes=[];
 sg.forEach((s,i)=>{const gr=new THREE.Group();gr.position.y=i?sg[i-1].len:0;par.add(gr);const m=new THREE.Mesh(s.geo,mat?mat:addonMat(kind==='dragon'||kind==='demon'?'gloss':'matte'));m.userData.addon=1;gr.add(m);meshes.push(m);tail.push(gr);par=gr});return{root,tail,meshes}}
