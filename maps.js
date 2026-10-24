// HeadShotz original maps. Built from merged, textured, vertex-AO geometry (few draw calls per map).
import {newDefs} from './maps2.js';
import {THREE,G,mergeParts,texMat,glowMat,TX,makeSky,makeHorizon,makeWater,getTex,rng} from './gfx.js';
const _c=new THREE.Color();
function Builder(){const T={},cols=[],shadows=[],glows=[],ladders=[],hides=[],links=[],nav=[];
 const add=(tex,pt)=>{(T[tex]=T[tex]||[]).push(pt)};
 const B={T,cols,shadows,glows,ladders,hides,links,nav,
  // axis aligned box, y = bottom
  box(x,y,z,w,h,d,c,tex='concrete',o={}){add(tex,{g:G('box',w,h,d),p:[x,y+h/2,z],c,uv:o.local?'local':undefined,us:o.us,gy:o.gy??0,ao:o.ao});
   if(o.solid!==false)cols.push({x0:x-w/2,x1:x+w/2,y0:y,y1:y+h,z0:z-d/2,z1:z+d/2,s:tex});if(o.shadow!==false&&y<.06&&w*d>.2)shadows.push([x,z,w+.55,d+.55]);return B},
  part(tex,pt,solid){add(tex,pt);if(solid)cols.push(solid);return B},
  cyl(x,y,z,r,h,c,tex='metal',o={}){add(tex,{g:G('cyl',r,o.r2??r,h,o.seg||10),p:[x,y+h/2,z],c,us:o.us,gy:o.gy??0,ao:o.ao});if(o.solid!==false){const k=r*.85;cols.push({x0:x-k,x1:x+k,y0:y,y1:y+h,z0:z-k,z1:z+k,s:tex})}if(o.shadow!==false&&y<.06)shadows.push([x,z,r*2+.5,r*2+.5]);return B},
  glow(x,y,z,w,h,d,c){glows.push({g:G('box',w,h,d),p:[x,y+h/2,z],c});return B},
  stairs(x,y,z,dir,n,sh,run,width,c,tex='concrete'){for(let i=0;i<n;i++){const h=sh*(i+1),off=run*i+run/2;const o={gy:y};
   if(dir==='x+')B.box(x+off,y,z,run,h,width,c,tex,o);if(dir==='x-')B.box(x-off,y,z,run,h,width,c,tex,o);if(dir==='z+')B.box(x,y,z+off,width,h,run,c,tex,o);if(dir==='z-')B.box(x,y,z-off,width,h,run,c,tex,o)}
   const L=run*n,top=y+sh*n,dv={'x+':[1,0],'x-':[-1,0],'z+':[0,1],'z-':[0,-1]}[dir];links.push({a:[x-dv[0]*.9,y,z-dv[1]*.9],b:[x+dv[0]*(L+.7),top,z+dv[1]*(L+.7)]});return B},
  // climbable ladder on a wall face. n = outward normal of the wall ('x+','x-','z+','z-'); climb by holding forward
  ladder(x,z,y0,y1,n,c=0x8a8f98){const dv={'x+':[1,0],'x-':[-1,0],'z+':[0,1],'z-':[0,-1]}[n];const sx=dv[0]!==0;const px=x+dv[0]*.12,pz=z+dv[1]*.12;
   for(const s of[-.38,.38])add('metal',{g:G('box',sx?.06:.06,y1-y0+1,sx?.06:.06),p:[px+(sx?0:s),y0+(y1-y0+1)/2,pz+(sx?s:0)],c});
   for(let y=y0+.3;y<y1+.9;y+=.32)add('metal',{g:G('box',sx?.05:.76,.05,sx?.76:.05),p:[px,y,pz],c});
   const cx=x+dv[0]*.4,cz=z+dv[1]*.4;ladders.push({x0:cx-(sx?.42:.55),x1:cx+(sx?.42:.55),z0:cz-(sx?.55:.42),z1:cz+(sx?.55:.42),y0:y0-.1,y1:y1+.25,n:dv});
   links.push({a:[x+dv[0]*1.1,y0,z+dv[1]*1.1],b:[x-dv[0]*.9,y1,z-dv[1]*.9],ladder:1});return B},
  // foliage you can hide in (not solid; bots can't spot you inside unless close)
  hedge(x,z,w,d,h=1.9,c=0x3f8f3a,y=0){const r=rng(x*31+z*17);const n=Math.max(2,Math.round(w*d/1.4));for(let i=0;i<n;i++)add('leaves',{g:G('ico',.75+r()*.35,1),p:[x+(r()-.5)*w*.85,y+.6+r()*(h-1),z+(r()-.5)*d*.85],s:[1,1.15,1],c:_c.set(c).multiplyScalar(.8+r()*.35).getHex(),ao:false});
   hides.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y-.2,y1:y+h});shadows.push([x,z,w+.6,d+.6]);return B},
  spot(x,y,z){nav.push([x,z,y]);return B},
  // local frame helper for props rotated by quarter turns
  at(x,z,q=0){const rot=(lx,lz)=>[[lx,lz],[lz,-lx],[-lx,-lz],[-lz,lx]][q&3];const sw=q&1;const L={
   box(lx,y,lz,w,h,d,c,tex,o){const[a,b]=rot(lx,lz);B.box(x+a,y,z+b,sw?d:w,h,sw?w:d,c,tex,o);return L},
   cyl(lx,y,lz,r,h,c,tex,o){const[a,b]=rot(lx,lz);B.cyl(x+a,y,z+b,r,h,c,tex,o);return L},
   wheel(lx,y,lz,r,w,c){const[a,b]=rot(lx,lz);add('asphalt',{g:G('cyl',r,r,w,10),p:[x+a,y,z+b],r:sw?[Math.PI/2,0,0]:[0,0,Math.PI/2],c});return L},
   glow(lx,y,lz,w,h,d,c){const[a,b]=rot(lx,lz);B.glow(x+a,y,z+b,sw?d:w,h,sw?w:d,c);return L}};return L},
  // ---------- props ----------
  crate(x,z,s=1.2,y=0,c=0xd2a56a){return B.box(x,y,z,s,s,s,c,'crate',{local:true,gy:y})},
  barrel(x,z,c=0x2e86de,y=0){B.cyl(x,y,z,.42,1.15,c,'metal',{seg:12,gy:y});for(const h of[.3,.82])add('metal',{g:G('cyl',.44,.44,.06,12),p:[x,y+h,z],c:_c.set(c).multiplyScalar(.7).getHex()});
   add('metal',{g:G('cyl',.38,.38,.02,12),p:[x,y+1.16,z],c:_c.set(c).multiplyScalar(.6).getHex()});return B},
  container(x,z,q,c,y=0){const L=B.at(x,z,q);L.box(0,y,0,6,2.6,2.45,c,'metal',{us:.6,gy:y});const dk=_c.set(c).multiplyScalar(.55).getHex();
   for(const sx of[-2.95,2.95])for(const sz of[-1.18,1.18])L.box(sx,y,sz,.14,2.62,.14,dk,'metal',{solid:false,shadow:false,gy:y});
   L.box(3.02,y+.2,-.4,.04,2.2,.06,dk,'metal',{solid:false,shadow:false});L.box(3.02,y+.2,.4,.04,2.2,.06,dk,'metal',{solid:false,shadow:false});return B},
  car(x,z,q,c){const L=B.at(x,z,q);L.box(0,.3,0,4.2,.75,1.85,c,'plain',{shadow:false});L.box(-.2,1.05,0,2.3,.72,1.65,c,'plain',{solid:false,shadow:false});
   L.box(-.2,1.1,0,2.34,.55,1.6,0xffffff,'window',{solid:false,shadow:false,local:true});L.box(-2.13,.5,0,.06,.25,1.7,0x333333,'plain',{solid:false,shadow:false});
   for(const a of[-1.35,1.35])for(const b of[-.92,.92])L.wheel(a,.36,b,.36,.28,0x222222);L.glow(2.12,.75,-.6,.04,.16,.35,0xfff4c0).glow(2.12,.75,.6,.04,.16,.35,0xfff4c0).glow(-2.12,.75,-.6,.04,.14,.3,0xff3030).glow(-2.12,.75,.6,.04,.14,.3,0xff3030);
   B.cols.push(q&1?{x0:x-.95,x1:x+.95,y0:0,y1:1.6,z0:z-2.1,z1:z+2.1}:{x0:x-2.1,x1:x+2.1,y0:0,y1:1.6,z0:z-.95,z1:z+.95});B.shadows.push([x,z,q&1?2.4:4.8,q&1?4.8:2.4]);return B},
  wreck(x,z,q,c){const L=B.at(x,z,q);L.box(0,.15,0,4,.7,1.8,c,'metal',{us:.5});L.box(.3,.85,0,1.8,.5,1.6,_c.set(c).multiplyScalar(.6).getHex(),'metal',{solid:false,shadow:false});for(const a of[-1.3,1.3])for(const b of[-.9,.9])L.wheel(a,.3,b,.3,.25,0x1a1a1a);return B},
  tree(x,z,s=1,leaf=0x4caf50){B.cyl(x,0,z,.16*s,2.2*s,0x7a5230,'rock',{seg:7,r2:.12*s});const r=rng(x*13+z*7);
   for(let i=0;i<3;i++)add('leaves',{g:G('ico',(.9+r()*.5)*s,1),p:[x+(r()-.5)*.8*s,(2.2+i*.6)*s,z+(r()-.5)*.8*s],c:_c.set(leaf).multiplyScalar(.85+r()*.3).getHex(),ao:false});B.shadows.push([x,z,2.6*s,2.6*s]);return B},
  palm(x,z,s=1){for(let i=0;i<5;i++)add('rock',{g:G('cyl',.17*s,.19*s,.9*s,7),p:[x+i*.08*s,(.45+i*.85)*s,z],r:[0,0,-.06],c:0x9c7a52});
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add('leaves',{g:G('box',.5*s,.05,2.4*s),p:[x+.4*s+Math.cos(a)*1.0*s,4.3*s,z+Math.sin(a)*1.0*s],r:[.35,-a+Math.PI/2,0],c:0x3fa34d,ao:false})}
   B.cols.push({x0:x-.2,x1:x+.5,y0:0,y1:4.4*s,z0:z-.2,z1:z+.2});B.shadows.push([x,z,2.6,2.6]);return B},
  bush(x,z,s=1,c=0x3e9b4f){add('leaves',{g:G('ico',.7*s,1),p:[x,.45*s,z],s:[1.3,.9,1.3],c,ao:false});B.cols.push({x0:x-.7*s,x1:x+.7*s,y0:0,y1:1*s,z0:z-.7*s,z1:z+.7*s});B.shadows.push([x,z,2*s,2*s]);return B},
  lamp(x,z,h=4.2,q=0,c=0x2d3436){B.box(x,0,z,.35,.3,.35,c,'metal');B.cyl(x,.3,z,.07,h,c,'metal',{seg:6,shadow:false});const L=B.at(x,z,q);L.box(.45,h+.2,0,1,.1,.1,c,'metal',{solid:false,shadow:false});L.glow(.85,h,0,.36,.12,.24,0xfff2b3);return B},
  cone(x,z){add('plain',{g:G('cone',.22,.7,8),p:[x,.35,z],c:0xff6b1a});add('plain',{g:G('cyl',.13,.16,.12,8),p:[x,.4,z],c:0xffffff});add('plain',{g:G('box',.5,.04,.5),p:[x,.02,z],c:0xff6b1a});return B},
  barrier(x,z,q,len=3){const L=B.at(x,z,q);L.box(0,0,0,len,.9,.4,0xffffff,'hazard',{us:.5});return B},
  bench(x,z,q){const L=B.at(x,z,q);L.box(0,.42,0,2,.08,.5,0xb07a45,'planks',{solid:false,shadow:false});L.box(0,.6,.22,2,.35,.06,0xb07a45,'planks',{solid:false,shadow:false});
   for(const a of[-.85,.85])L.box(a,0,0,.08,.42,.45,0x2d3436,'metal',{solid:false,shadow:false});L.box(0,0,0,2,.7,.5,0,'plain',{solid:true,shadow:true,ao:false});T.plain.pop();return B},
  planter(x,z,w,d,tree){B.box(x,0,z,w,.7,d,0xc9b8a0,'brick');B.box(x,.7,z,w-.2,.06,d-.2,0x5d8a3a,'grass',{solid:false,shadow:false});if(tree)B.tree(x,z,tree);else B.bush(x,z,.9);return B},
  stall(x,z,q,c){const L=B.at(x,z,q);L.box(0,0,0,3,.95,1.2,0xb98250,'planks');for(const a of[-1.45,1.45])for(const b of[-.55,.55])L.box(a,0,b,.1,2.5,.1,0x6b4423,'planks',{solid:false,shadow:false});
   L.box(0,2.5,0,3.5,.1,1.9,c,'hazard',{solid:false,shadow:false,us:.7});const r=rng(x*3+z);for(let i=0;i<7;i++){const[a,b]=[[0,0],[1,0]][0];const lx=-1.2+i*.4;const pp=(q&1)?[x+.1,z+lx]:[x+lx,z+.1];add('plain',{g:G('sph',.14,6,4),p:[pp[0],1.05,pp[1]],c:[0xff7043,0xffca28,0x8bc34a,0xef5350][i%4]})}return B},
  crane(x,z,h,q,c=0xf1c40f){const L=B.at(x,z,q);for(const a of[-.9,.9])for(const b of[-.9,.9])L.box(a,0,b,.22,h,.22,c,'metal',{shadow:false});B.cols.push({x0:x-1,x1:x+1,y0:0,y1:h,z0:z-1,z1:z+1});B.shadows.push([x,z,2.6,2.6]);
   for(let y=2;y<h;y+=2.4){L.box(0,y,-.9,1.8,.12,.12,c,'metal',{solid:false,shadow:false}).box(0,y,.9,1.8,.12,.12,c,'metal',{solid:false,shadow:false}).box(-.9,y,0,.12,.12,1.8,c,'metal',{solid:false,shadow:false}).box(.9,y,0,.12,.12,1.8,c,'metal',{solid:false,shadow:false})}
   L.box(8,h,0,20,.9,1.1,c,'metal',{solid:false,shadow:false}).box(-4.5,h,0,7,.9,1.1,c,'metal',{solid:false,shadow:false}).box(-6.5,h-1.6,0,2.5,1.6,2,0x7f8c8d,'concrete',{solid:false,shadow:false})
    .box(1.3,h-1.3,0,1.6,1.4,1.6,0xecf0f1,'window',{solid:false,shadow:false,local:true}).box(0,h+.9,0,.3,3,.3,c,'metal',{solid:false,shadow:false}).box(12,h-6,0,.05,6,.05,0x222222,'plain',{solid:false,shadow:false}).box(12,h-6.4,0,.5,.4,.3,0xe74c3c,'metal',{solid:false,shadow:false});return B},
  gantry(x,zh,h,c=0xe74c3c){for(const s of[-1,1])for(const dx of[-2,2]){B.box(x+dx,0,s*zh,.8,h,.8,c,'metal')}for(const s of[-1,1])B.box(x,h-1,s*zh,4.8,1,.9,c,'metal',{solid:false,shadow:false});
   B.box(x,h,0,1.6,1.2,zh*2+1,c,'metal',{solid:false,shadow:false});B.box(x,h-1.4,3,2.2,1.3,2,0x34495e,'window',{solid:false,shadow:false,local:true});B.box(x,h-8,3,.06,6.6,.06,0x111111,'plain',{solid:false,shadow:false});return B},
  forklift(x,z,q){const L=B.at(x,z,q);L.box(0,.25,0,2.2,1,1.2,0xf39c12,'metal');L.box(-.3,1.25,0,1.2,1.1,1.1,0x333333,'metal',{solid:false,shadow:false});L.box(1.2,0,0,.12,2.6,1,0x2d3436,'metal',{solid:false});L.box(1.7,.05,-.3,1,.06,.15,0x777777,'metal',{solid:false,shadow:false}).box(1.7,.05,.3,1,.06,.15,0x777777,'metal',{solid:false,shadow:false});
   for(const a of[-.7,.7])for(const b of[-.6,.6])L.wheel(a,.28,b,.28,.24,0x1a1a1a);return B},
  cactus(x,z,s=1){B.cyl(x,0,z,.22*s,2.6*s,0x4a8f3c,'leaves',{seg:8});add('leaves',{g:G('cyl',.15*s,.15*s,1*s,7),p:[x+.45*s,1.6*s,z],c:0x4a8f3c});add('leaves',{g:G('cyl',.15*s,.15*s,.4*s,7),p:[x+.3*s,1.1*s,z],r:[0,0,Math.PI/2],c:0x4a8f3c});
   add('leaves',{g:G('cyl',.13*s,.13*s,.8*s,7),p:[x-.4*s,1.9*s,z],c:0x4a8f3c});add('leaves',{g:G('cyl',.13*s,.13*s,.3*s,7),p:[x-.25*s,1.5*s,z],r:[0,0,Math.PI/2],c:0x4a8f3c});return B},
  rock(x,z,sx,sy,sz,c=0xb5774a,y=0){add('rock',{g:G('dode',1),p:[x,y+sy*.45,z],s:[sx*.6,sy*.6,sz*.6],r:[0,(x*7+z)%3,0],c,us:.3});B.cols.push({x0:x-sx*.48,x1:x+sx*.48,y0:y,y1:y+sy*.95,z0:z-sz*.48,z1:z+sz*.48});B.shadows.push([x,z,sx*1.3,sz*1.3]);return B},
  watertower(x,z){for(const a of[-1.3,1.3])for(const b of[-1.3,1.3])B.box(x+a,0,z+b,.3,7,.3,0x6d4c41,'planks');B.cyl(x,7,z,2.2,3,0x8d6e63,'planks',{seg:12,shadow:false,solid:false});add('metal',{g:G('cone',2.4,1.2,12),p:[x,10.6,z],c:0x5d4037});B.box(x,6.8,z,5,.2,5,0x5d4037,'planks',{solid:false,shadow:false});B.shadows.push([x,z,4,4]);return B},
  desk(x,z,q){const L=B.at(x,z,q);L.box(0,.72,0,1.6,.06,.8,0xdbc6a0,'planks',{solid:false,shadow:false});for(const a of[-.75,.75])L.box(a,0,0,.06,.72,.75,0x636e72,'metal',{solid:false,shadow:false});
   L.box(0,0,0,1.6,.78,.8,0,'plain',{ao:false});T.plain.pop();L.box(0,.78,.15,.55,.36,.04,0x222222,'plain',{solid:false,shadow:false}).glow(0,.82,.125,.5,.28,.01,0x7fd3ff).box(0,.78,-.15,.5,.02,.16,0x333333,'plain',{solid:false,shadow:false});return B},
  plant(x,z){B.cyl(x,0,z,.25,.5,0xd35400,'plain',{seg:8});add('leaves',{g:G('ico',.45,1),p:[x,.9,z],s:[1,1.3,1],c:0x27ae60,ao:false});return B},
  railing(x,y,z,w,d,c=0xf1c40f){B.box(x,y+.95,z,w,.06,d,c,'metal',{solid:false,shadow:false});return B},
  build(){return B}};
 return B}
// window rows on a facade face (decor)
function facade(B,x,z,w,h,d,c,face){B.box(x,0,z,w,h,d,c,'plaster',{us:.3});B.box(x,h,z,w+.2,.3,d+.2,_c.set(c).multiplyScalar(.75).getHex(),'concrete',{solid:false,shadow:false});
 const rows=Math.floor((h-1.5)/2.6);const along=face==='x'?d:w;const n=Math.max(1,Math.floor(along/3));
 for(let r=0;r<rows;r++)for(let i=0;i<n;i++){const t=-along/2+along/n*(i+.5);const y=1.6+r*2.6;
  if(face==='x'){const fx=x+(x>0?-w/2-.03:w/2+.03);B.box(fx,y,z+t,.06,1.4,1.1,0xffffff,'window',{solid:false,shadow:false,local:true});B.box(fx+(x>0?-.1:.1),y-.12,z+t,.2,.1,1.3,0xeeeeee,'concrete',{solid:false,shadow:false})}
  else{const fz=z+(z>0?-d/2-.03:d/2+.03);B.box(x+t,y,fz,1.1,1.4,.06,0xffffff,'window',{solid:false,shadow:false,local:true});B.box(x+t,y-.12,fz+(z>0?-.1:.1),1.3,.1,.2,0xeeeeee,'concrete',{solid:false,shadow:false})}}}
// ===================== MAP DEFINITIONS =====================
const DEFS=[
{name:'Sunset Plaza',horizon:'city',grade:[1.05,1,.93,1.12,1.06],grass:[{on:['grass'],count:1400,color:0x6fae3f,height:.9}],desc:'Balanced arena',icon:'🌇',size:[48,48],ground:['tiles',0xe8d2ae,.25],
 sky:[0x3a5aa8,0xffa66b,0xffd9ae],fog:[0xffb887,45,120],hemi:[0xffe2c4,0x8a6a55,1.35],sun:[0xffd3a0,1.9,[-.6,.45,.55]],
 build(B){const cols=[0xf3d9b1,0xe9b98f,0xf7e7ce,0xd9a679,0xefc7a3,0xf2dcc0];let k=0;
  for(const s of[-1,1]){for(let i=-24;i<24;i+=6){const h=7+((i+30)*7%4);facade(B,s*26,i+3,4,h,6,cols[k++%6],'x');facade(B,i+3,s*26,6,h+((i*3)%3),4,cols[k++%6],'z')}}
  for(const s of[-1,1])for(const t of[-1,1])B.box(s*26,0,t*26,4,10,4,0xd9a679,'plaster');
  B.box(0,0,0,9,1,9,0xd7c09a,'tiles',{us:.5});for(const[d,dx,dz]of[['z+',0,4.5],['z-',0,-4.5],['x+',4.5,0],['x-',-4.5,0]]){B.stairs(dx,0,dz,d,1,.5,.6,3,0xcdb48c,'tiles');}
  B.cyl(0,1,0,1.8,.7,0xe0e0e0,'concrete',{seg:16,gy:1});B.glow(0,1.6,0,2.6,.05,2.6,0x5ec8ff);B.cyl(0,1.7,0,.22,1.6,0xdddddd,'concrete',{solid:false,shadow:false});
  B.part('concrete',{g:G('cyl',.8,.4,.35,14),p:[0,3.3,0],c:0xe6e6e6});B.glow(0,3.45,0,1,.04,1,0x7fd7ff);
  for(const s of[-1,1]){const S=(x,z)=>[s*x,s*z];
   B.stall(...S(11,-8),0,s<0?0xff6b6b:0x4dabf7);B.stall(...S(-6,16),0,s<0?0xffd43b:0x69db7c);
   B.box(s*7,0,s*5,4,1.1,.5,0xc8a98a,'brick');
   B.box(s*16,0,s*-4,.5,1.2,4,0xc8a98a,'brick');B.box(s*-12,0,s*4,.5,1.2,3,0xc8a98a,'brick');
   B.crate(s*13,s*12);B.crate(s*14.25,s*12);B.crate(s*13.6,s*12,1.2,1.2);B.crate(s*-12,s*-15);B.crate(s*-13,s*-14,.9);
   B.planter(s*6,s*-11,2.6,2.6,1.1);B.planter(s*17,s*8,2.4,2.4,1);B.planter(s*-3,s*-20,2,2);
   // corner balcony building with stairs
   B.box(s*17,0,s*-17,5,3.2,5,0xe2b48a,'brick');B.box(s*17,3.2,s*-17,5.3,.15,5.3,0xa8805c,'concrete',{solid:false,shadow:false});
   B.box(s*17,3.2,s*-19.4,5,1,.15,0x8a6d55,'metal');B.box(s*19.4,3.2,s*-17,.15,1,5,0x8a6d55,'metal');
   B.stairs(s*9.7,0,s*-17,s>0?'x+':'x-',8,.4,.6,1.8,0xcdb48c,'tiles');
   B.lamp(s*9,s*-2.5,4.2,s>0?0:2);B.lamp(s*-9,s*-9,4.2,s>0?2:0);B.lamp(s*20,s*18,4.2,s>0?2:0);
   B.bench(s*3,s*-7.5,0);B.bench(s*7.5,s*1.5,1);B.barrel(s*20.5,s*-12.5,0x2e86de);B.barrel(s*19.8,s*-11.6,0xe67e22);
   B.palm(s*-20,s*-20);B.palm(s*-14,s*20)}
 },
 spawnsA:[[-21,-5],[-21,0],[-21,5],[-20,-9],[-20,10],[-17,2]],spawnsB:[[21,5],[21,0],[21,-5],[20,9],[20,-10],[17,-2]],spawnsM:[[0,-17],[0,17],[-8,21],[8,-21],[-10,-21],[10,21],[-17,-6],[17,6]]},
{name:'Steel Frame',horizon:'city',grade:[.98,1,1.03,1.08,1.08],grass:[{on:['sand'],count:700,color:0x8f9a52,height:.75}],desc:'Vertical worksite',icon:'🏗️',size:[44,40],ground:['sand',0xb7a184,.2],
 sky:[0x3d7cc9,0xa9d4f5,0xdfeaf2],fog:[0xbcd6ea,45,120],hemi:[0xdfefff,0x7a6a55,1.3],sun:[0xfff1d6,1.8,[.5,.8,.3]],
 build(B){const st=0x8e9aa6,yb=0xf1c40f,or=0xe67e22;
  B.box(0,-.01,0,40,.02,8,0x6b6b6b,'asphalt',{solid:false,shadow:false});
  const tower=(x,z,lv)=>{B.box(x,-.0,z,8.6,.02,8.6,0x9e9e9e,'concrete',{solid:false,shadow:false});for(let i=1;i<=lv;i++){B.box(x,i*3.2-.3,z,8,.3,8,i%2?st:0x7f8c8d,'metal',{us:.8,gy:i*3.2});B.railing(x,i*3.2,z-3.95,8,.06,yb);}
   for(const dx of[-3.8,3.8])for(const dz of[-3.8,3.8])B.box(x+dx,0,z+dz,.35,lv*3.2+1,.35,yb,'metal');
   for(let i=0;i<lv;i++)for(const dz of[-3.8,3.8])B.part('metal',{g:G('box',.1,.1,9.6),p:[x,i*3.2+1.6,z+dz],r:[0,Math.PI/2,.62],c:yb})};
  tower(-12,-10,3);tower(12,10,3);tower(-12,12,2);tower(12,-12,2);
  B.stairs(-7.5,0,-6,'x+',8,.4,.6,2,or,'metal');B.box(-2.6,0,-6,1.2,3.2,2,or,'metal');B.stairs(7.5,0,6,'x-',8,.4,.6,2,or,'metal');B.box(2.6,0,6,1.2,3.2,2,or,'metal');
  B.stairs(-15,3.2,-13,'z+',8,.4,.6,1.6,or,'metal');B.stairs(15,3.2,13,'z-',8,.4,.6,1.6,or,'metal');B.stairs(-15,0,9,'z+',8,.4,.6,1.6,or,'metal');B.stairs(15,0,-9,'z-',8,.4,.6,1.6,or,'metal');
  B.box(0,6.1,0,26,.3,2,0x34495e,'metal',{gy:6});B.box(-12,6.1,1,2,.3,14,0x34495e,'metal',{gy:6});B.box(12,6.1,-1,2,.3,14,0x34495e,'metal',{gy:6});
  B.railing(0,6.4,1,26,.06,yb);B.railing(0,6.4,-1,26,.06,yb);
  B.box(0,0,0,3,1.5,3,0xc69c6d,'crate',{local:true});B.box(0,1.5,0,2,.8,2,0xc69c6d,'crate',{local:true});
  B.container(-4,10,0,0xe67e22);B.container(4,-10,0,0x2980b9);B.container(-19,-16.5,1,0x27ae60);B.container(19,16.5,1,0xc0392b);B.container(19,16.5,1,0x8e44ad,2.6);
  B.barrier(0,-16,0,10);B.barrier(0,16,0,10);B.box(-18,0,0,1.5,1.6,6,0xa0a0a0,'concrete');B.box(18,0,0,1.5,1.6,6,0xa0a0a0,'concrete');
  B.box(-6,0,0,2,3,.5,0xbdc3c7,'concrete');B.box(6,0,0,2,3,.5,0xbdc3c7,'concrete');
  for(let i=0;i<5;i++){B.part('metal',{g:G('cyl',.04,.04,5,5),p:[-5+i*.12,.15+(i%2)*.1,-3.6],r:[0,0,Math.PI/2],c:0x8d4a2a})}B.box(-5,0,-3.6,5.2,.45,.6,0,'plain',{shadow:false});B.T.plain.pop();
  B.part('metal',{g:G('cyl',.8,1,1.8,10),p:[7,1.2,3.5],r:[0,0,.5],c:0xe74c3c},{x0:6,x1:8,y0:0,y1:2,z0:2.6,z1:4.4});B.box(7,0,3.5,2.2,.5,1.4,0x555555,'metal');
  for(const[x,z]of[[-2,-14],[2,-14],[-9,4],[9,-4],[15,2],[-15,-2],[3,13],[-3,-13]])B.cone(x,z);
  B.box(20,0,-18,1.2,2.3,1.2,0x2f80ed,'plain');B.lamp(-20,-19,6,0);B.lamp(20,19,6,2);B.lamp(-20,18,6,0);B.lamp(20,-19.4,6,2);
  B.crane(-21,-21,20,0);
  B.barrel(9,-1,0x34495e);B.barrel(-9,1,0x34495e);B.barrel(9.6,-.2,0xe67e22);
 },
 spawnsA:[[-20,-3],[-20,3],[-20,-8],[-20,8],[-17,-13],[-17,16]],spawnsB:[[20,3],[20,-3],[20,8],[20,-8],[17,13],[17,-16]],spawnsM:[[0,7],[0,-7],[8,2],[-8,-2],[-6,17],[6,-17],[0,13],[0,-13]]},
{name:'Harbor Line',horizon:'coast',grade:[.97,1.01,1.04,1.15,1.05],desc:'Long sightlines',icon:'⚓',size:[85,25.5],pier:true,ground:['planks',0xa87d52,.35],water:0x1f7fc9,
 sky:[0x2f6fc0,0x9fd0f0,0xcfe6f5],fog:[0xa8cde6,60,150],hemi:[0xdff2ff,0x5a6f80,1.3],sun:[0xfff0d0,1.8,[.3,.7,-.6]],
 build(B){const cols=[0xd35400,0x2471a3,0x229954,0xd4ac0d,0x7d3c98,0xc0392b];
  B.box(0,-.01,-12.2,85,.03,1.1,0x9a9a9a,'concrete',{solid:false,shadow:false});B.box(0,-.01,12.2,85,.03,1.1,0x9a9a9a,'concrete',{solid:false,shadow:false});
  for(const s of[-1,1]){const C=(x,z,q,c,stack)=>{B.container(s*x,s*z,q,c);if(stack)B.container(s*x,s*z,q,cols[(cols.indexOf(c)+2)%6],2.6)};
   C(28,-4,0,cols[0],1);C(20,5,1,cols[1]);C(12,-6,0,cols[2]);C(8,7,0,cols[3],1);C(2,-2,1,cols[4]);C(31,8,0,cols[5]);
   B.box(s*36,0,s*-8,4,6,4,0xf1c40f,'metal');B.railing(s*36,6,s*-9.95,4,.06,0x333333);B.stairs(s*36,0,s*-4,s>0?'z+':'z-',12,.5,.6,2,0x7f8c8d,'metal');
   B.box(s*16,0,0,.8,1.2,3,0x8e6e53,'crate',{local:true});B.box(s*24,0,s*11,4,1.4,1,0x8e6e53,'planks');
   B.forklift(s*24,s*-9,s>0?0:2);B.crate(s*15,s*-10);B.crate(s*16.2,s*-10);B.crate(s*15.6,s*-10,1.2,1.2);B.barrel(s*6,s*10.5,0x1e8449);B.barrel(s*6.9,s*10.9,0x1e8449);
   B.gantry(s*18,11.4,15,s>0?0xe74c3c:0x3498db);B.lamp(s*10,s*-11.8,5,1);B.lamp(s*30,s*11.8,5,3);B.lamp(s*-2,s*11.8,5,3)}
  B.box(0,0,-11,30,1,.6,0x7f8c8d,'concrete');B.box(0,0,11,30,1,.6,0x7f8c8d,'concrete');
  for(let x=-40;x<=40;x+=8)for(const s of[-1,1])B.cyl(x+2,0,s*12.3,.22,.55,0x333333,'metal',{seg:8});
  B.box(0,0,-12.6,84,.5,.25,0x5d4037,'planks',{shadow:false});B.box(0,0,12.6,84,.5,.25,0x5d4037,'planks',{shadow:false});B.box(-42.6,0,0,.25,.5,25,0x5d4037,'planks',{shadow:false});B.box(42.6,0,0,.25,.5,25,0x5d4037,'planks',{shadow:false});
  // moored ship (decor)
  B.box(0,-2,-24,60,4,9,0x2c3e50,'metal',{solid:false,shadow:false});B.box(0,2,-24,58,.3,8.6,0x8b4513,'planks',{solid:false,shadow:false});B.box(-20,2.3,-24,8,5,7,0xecf0f1,'plaster',{solid:false,shadow:false});
  for(let i=0;i<4;i++)B.container(-6+i*6.5,-24,0,cols[i],2.3);B.box(-20,7.3,-24,1.2,4,1.2,0xc0392b,'metal',{solid:false,shadow:false});
  for(let i=0;i<6;i++)B.box(-35+i*14,-1.2,22+i%2*3,6,1.2,2.5,0xffffff,'plaster',{solid:false,shadow:false});
 },
 spawnsA:[[-41,-10],[-41,-3],[-41,3],[-41,9],[-33,10.4],[-38,0]],spawnsB:[[41,10],[41,3],[41,-3],[41,-9],[33,-10.4],[38,0]],spawnsM:[[0,8.5],[0,-8.5],[-14,2],[14,-2],[-22,-1],[22,1],[-8,-9.5],[8,9.5]]},
{name:'Office Rush',grade:[1,1,1.03,1.05,1.07],desc:'Tight hallways',icon:'🏢',size:[32,24],indoor:true,ground:['carpet',0x6c8fb5,.4],
 sky:[0x1d2b3a,0x3b5068,0x1d2b3a],fog:[0x2a3442,18,45],hemi:[0xfff8ee,0x56606e,1.5],sun:[0xffffff,.6,[.3,1,.2]],
 build(B){const w=0xeceae4,h=3.2;
  for(const s of[-1,1]){B.box(0,0,s*12.5,34,h,1,0xd6d3cc,'plaster');B.box(s*16.5,0,0,1,h,24,0xd6d3cc,'plaster')}
  for(let x=-14;x<=14;x+=4)for(const s of[-1,1])B.box(x,1.1,s*11.97,2.6,1.4,.06,0xffffff,'window',{solid:false,shadow:false,local:true});
  const wallX=(x,z1,z2,gaps)=>{let z=z1;for(const g of[...gaps,z2+2]){const e=Math.min(g-1,z2);if(e>z)B.box(x,0,(z+e)/2,.3,h,e-z,w,'plaster',{us:.4});z=g+1}};
  const wallZ=(z,x1,x2,gaps)=>{let x=x1;for(const g of[...gaps,x2+2]){const e=Math.min(g-1,x2);if(e>x)B.box((x+e)/2,0,z,e-x,h,.3,w,'plaster',{us:.4});x=g+1}};
  wallX(-8,-12,12,[-7,3]);wallX(8,-12,12,[-3,7]);wallX(0,-12,12,[-9,0,9]);wallZ(-4,-16,16,[-12,-4,4,12]);wallZ(4,-16,16,[-12,-4,4,12]);
  for(const x of[-8,0,8])B.box(x,0,0,.32,.12,24,0x8a8a8a,'plain',{solid:false,shadow:false});
  for(const s of[-1,1]){B.desk(s*12,s*-8,0);B.desk(s*12,s*-6.4,2);B.desk(s*4,s*-8,1);B.desk(s*-4,s*8.2,1);B.desk(s*12,s*8,0);B.desk(s*-12,s*-7.6,0);
   B.plant(s*15.3,s*11.2);B.plant(s*-7.3,s*-11.2);B.plant(s*.8,s*3.3);B.plant(s*7.3,s*3.3);
   B.box(s*4,0,0,2,1,1,0xfdcb6e,'crate',{local:true});B.box(s*12,0,s*8.9,2,1.2,.8,0x0984e3,'plain');B.box(s*-12,0,0,.6,1.6,.6,0x74b9ff,'plain');B.glow(s*-12,1.6,0,.4,.5,.4,0xd6f0ff);
   B.box(s*-15.9,1,s*8,.1,1.2,2.4,0xffffff,'plain',{solid:false,shadow:false})}
  B.box(0,h,0,34,.3,26,0xe8e8e8,'plaster',{solid:true,shadow:false});
  for(let x=-14;x<=14;x+=4)for(let z=-10;z<=10;z+=4)B.glow(x,h-.04,z,1.6,.04,.5,0xfffbe6);
 },
 spawnsA:[[-14,-10],[-14,10],[-14,0],[-10.5,-10],[-10.5,10],[-14,-6]],spawnsB:[[14,10],[14,-10],[14,0],[10.5,10],[10.5,-10],[14,6]],spawnsM:[[-5,-10],[5,10],[-3,-6],[3,6],[-5,1.5],[5,-1.5],[-2,10.5],[2,-10.5]]},
{name:'Canyon Fort',horizon:'mountains',grade:[1.06,1,.9,1.1,1.07],grass:[{on:['sand'],count:2200,color:0xc4a659,height:.8}],desc:'Big map, 8 players',icon:'🏜️',size:[100,90],ground:['sand',0xe0b07c,.12],
 sky:[0x4a86c8,0xffd59a,0xf6d7a7],fog:[0xf2cf9c,60,170],hemi:[0xfff0d8,0x9a6a45,1.35],sun:[0xffe0b0,2,[.6,.6,.4]],
 build(B){const r=0xc0703a,r2=0xa0522d,wd=0x8b5a2b;
  for(const s of[-1,1]){const x=s*40;
   B.box(s*35,0,-4.25,.8,3.6,5.5,wd,'planks');B.box(s*35,0,4.25,.8,3.6,5.5,wd,'planks');B.box(s*39.5,0,-7,9.8,3.6,.8,wd,'planks');B.box(s*39.5,0,7,9.8,3.6,.8,wd,'planks');
   for(let z=-7;z<=7;z+=1)B.part('planks',{g:G('cone',.22,.7,6),p:[s*35,3.95,z],c:0x6d4c2f});
   B.box(s*43,0,-4.5,3,3,3,r2,'planks');B.railing(s*43,3,-5.95,3,.06,0x5d4037);B.stairs(s*43,0,-1.5,'z+',6,.5,.6,2,0xbcaaa4,'planks');
   B.box(s*43,3,-4.5,3,.1,3,0x6d4c2f,'planks',{solid:false,shadow:false});B.box(s*43,3,-4.5,.2,3.2,.2,0x5d4037,'planks',{solid:false,shadow:false});
   B.box(s*43,6.2,-4.5,3.6,.2,3.6,s<0?0x3fa9ff:0xff5a5a,'plain',{solid:false,shadow:false});
   B.crate(s*38,s*2.5);B.crate(s*38,s*3.7);B.barrel(s*41,s*-5.2,0x6d4c41);}
  B.box(0,0,0,10,5,10,r,'rock',{us:.25});B.stairs(0,0,5,'z+',10,.5,.7,2.4,0xd7ccc8,'rock');B.stairs(0,0,-5,'z-',10,.5,.7,2.4,0xd7ccc8,'rock');B.box(0,5,0,2,1,6,r2,'rock');
  const rocks=[[-20,-20,6,3,8],[20,20,6,3,8],[-18,22,8,2,5],[18,-22,8,2,5],[-28,-36,10,6,6],[28,36,10,6,6],[0,-34,14,4,4],[0,34,14,4,4],[-10,12,3,1.5,3],[10,-12,3,1.5,3],[-30,14,2,2,6],[30,-14,2,2,6],[-12,-30,4,2.5,4],[12,30,4,2.5,4]];
  for(const k of rocks)B.rock(k[0],k[1],k[2],k[3],k[4],k[3]>3?r:r2);
  B.stairs(-28,0,-31,'z+',8,.6,.6,2,0xd7ccc8,'rock');B.stairs(28,0,31,'z-',8,.6,.6,2,0xd7ccc8,'rock');
  for(let i=0;i<46;i++){const a=i/46*Math.PI*2,d=52+(i%3)*3;B.rock(Math.cos(a)*d*1.0,Math.sin(a)*d*.9,9,8+(i%4)*3,9,i%2?r:r2)}
  B.wreck(-14,-6,0,0x8e3b2a);B.wreck(14,6,1,0x2f5d8a);B.wreck(-24,26,1,0x556b2f);B.wreck(24,-26,0,0x9c6b30);
  B.watertower(-22,-6);B.watertower(22,6);
  for(const[x,z,s]of[[-8,-20,1],[8,20,1.2],[-30,0,.9],[30,0,1],[-18,34,1.1],[18,-34,1],[-6,26,.8],[6,-26,.9],[-38,-22,1],[38,22,1],[-36,30,1],[36,-30,1]])B.cactus(x,z,s);
  for(let i=0;i<10;i++){const x=(i-4.5)*9;B.crate(x,-24-((i*7)%5),1.2);B.crate(-x,24+((i*7)%5),1.2)}
  B.box(-6,0,-14,.8,1.4,4,wd,'planks');B.box(6,0,14,.8,1.4,4,wd,'planks');B.barrel(-17,-14,0xc0392b);B.barrel(17,14,0xc0392b);
 },
 spawnsA:[[-41,0],[-43,-2.5],[-43,2.5],[-38.5,-4],[-38.5,4.5],[-46,0]],spawnsB:[[41,0],[43,2.5],[43,-2.5],[38.5,4],[38.5,-4.5],[46,0]],spawnsM:[[0,-20],[0,20],[-20,0],[20,0],[-25,-30],[25,30],[-30,-10],[30,10],[0,-42],[0,42]]},
];
DEFS.push(...newDefs({G,rng,_c,facade}));
export const MAPS=DEFS.map(d=>({name:d.name,desc:d.desc,icon:d.icon,def:d}));
// ---------- 3D MAIN HUB (not in the map vote) ----------
// queue pads: pairs of circles (blue A / red B); radius scales with team size so n players fit side by side
export const PAD_R=n=>1.15+.5*n;
export const HUB_PADS=[
 {k:'duel',n:1,x:-20,z:-15},{k:'team',n:2,x:-6,z:-15},{k:'t3',n:3,x:10.5,z:-15},
 {k:'t4',n:4,x:-12,z:12},{k:'t5',n:5,x:8,z:12},{k:'ffa',n:8,x:25,z:13,single:1}];
export function padCircles(p){const r=p.single?3.2:PAD_R(p.n);if(p.single)return[{side:'F',x:p.x,z:p.z,r}];const off=r+.7;return[{side:'A',x:p.x-off,z:p.z,r},{side:'B',x:p.x+off,z:p.z,r}]}
export const HUB_ST=[{k:'shop',name:'🛒 WEAPON SHOP',x:-27,z:-3},{k:'upgrade',name:'⭐ UPGRADES',x:-27,z:5},{k:'practice',name:'🤖 PRACTICE VS BOTS',x:28,z:-4},{k:'arsenal',name:'🔫 ARSENAL',x:-27,z:-11}];
DEFS.push({name:'HeadShotz Hub',hub:true,desc:'Main lobby',icon:'🏠',size:[64,48],ground:['tiles',0x9aa3b5,.22],grade:[1,1,1.04,1.15,1.06],horizon:'city',
 sky:[0x24306e,0xff8fa3,0xffc59a],fog:[0xd99aa8,60,160],hemi:[0xe8e4ff,0x6a5a7a,1.35],sun:[0xffd6b0,1.7,[-.4,.55,-.6]],
 build(B){// perimeter: glassy towers + low walls
  for(const s of[-1,1]){for(let i=-30;i<30;i+=7.5){facade(B,i+3.75,s*25.5,7.5,8+((i*7+40)%5),3,s<0?0x6c7a99:0x7d6b99,'z')}for(let i=-24;i<24;i+=8){facade(B,s*33.5,i+4,3,9+((i*5+50)%4),8,0x5f6d8c,'x')}}
  // centre: logo plinth with glowing ring + fountain
  B.cyl(0,0,-1,3.2,.5,0xd9dde6,'concrete',{seg:24});B.glow(0,.5,-1,5.6,.05,5.6,0xffd23f);B.cyl(0,.5,-1,1.1,2.2,0x2b2f3a,'metal',{seg:16});
  B.part('metal',{g:G('ico',1.1,1),p:[0,3.4,-1],c:0xffd23f});B.glow(0,2.7,-1,.3,.05,.3,0xffffff);
  // pad platforms (low daises) and lane markings
  for(const p of HUB_PADS){for(const c of padCircles(p))B.cyl(c.x,0,c.z,c.r+.35,.08,0x2a3045,'concrete',{seg:32,solid:false,shadow:false})}
  // stations: kiosks with glowing screens
  const kiosk=(x,z,col)=>{B.box(x,0,z,2.4,2.6,1.4,0x2b2f3a,'metal');B.box(x+.75,0,z,.12,2.4,1.2,col,'metal',{solid:false,shadow:false});B.glow(x+.72,1.2,z,.06,1.1,1.05,col);B.box(x,2.6,z,2.8,.25,1.8,col,'metal',{solid:false,shadow:false});B.glow(x,2.85,z,2.6,.08,1.6,col)};
  kiosk(-27,-3,0xffb020);kiosk(-27,5,0xb06bff);kiosk(-27,-11,0x3fa9ff);
  // practice portal arch
  B.box(28,0,-6,.8,4.2,.8,0x2b2f3a,'metal');B.box(28,0,-2,.8,4.2,.8,0x2b2f3a,'metal');B.box(28,4.2,-4,.8,.7,4.8,0x2b2f3a,'metal');B.glow(28,.05,-4,.1,4.1,3.2,0x2ee59d);
  // benches, planters, lamps for life
  for(const s of[-1,1]){B.planter(s*6,4,2.4,2.4,1);B.planter(s*16,-4,2.2,2.2,1);B.bench(s*3,-7.5,0);B.lamp(s*13,0,4.4,s>0?2:0);B.lamp(s*20,20,4.4,s>0?2:0);B.lamp(s*20,-21,4.4,s>0?2:0)}
  B.palm(-30,21);B.palm(30,21);B.palm(-30,-21);B.palm(30,-21)},
 spawnsA:[[0,4],[2,5],[-2,5],[3,3],[-3,3]],spawnsB:[[0,6]],spawnsM:[[0,6]]});
export const HUB_I=DEFS.length-1;
// --------- collision-free spawn fix ----------
function clear(cols,x,z,r=.6){for(const c of cols)if(x+r>c.x0&&x-r<c.x1&&z+r>c.z0&&z-r<c.z1&&c.y0<1.8&&c.y1>.05)return false;return true}
function fixSpawn(cols,s,lim){if(clear(cols,s[0],s[1]))return s;for(let rad=.5;rad<6;rad+=.5)for(let a=0;a<16;a++){const x=s[0]+Math.cos(a/16*6.283)*rad,z=s[1]+Math.sin(a/16*6.283)*rad;if(Math.abs(x)<lim[0]-1&&Math.abs(z)<lim[1]-1&&clear(cols,x,z))return[+x.toFixed(2),+z.toFixed(2)]}return s}
const cache={};
export function buildMap(i){if(cache[i])return cache[i];const d=DEFS[i];const B=Builder();
 const[gt,gc,gu]=d.ground;const[sx,sz]=d.size;const gsize=d.pier?[sx,sz]:[sx+40,sz+40];
 B.part(gt,{g:G('box',gsize[0],1,gsize[1]),p:[0,-.5,0],c:gc,us:gu,ao:false});
 d.build(B);
 if(!d.pier&&!d.indoor){for(const s of[-1,1]){const wh=d.wallH||4;B.box(0,0,s*(sz/2+.5),sx+2,wh,1,0x000000,'plain',{shadow:false});B.box(s*(sx/2+.5),0,0,1,wh,sz,0x000000,'plain',{shadow:false})}for(let k=0;k<4;k++)B.T.plain.pop()}
 const group=new THREE.Group();
 for(const t in B.T){if(!B.T[t].length)continue;const m=new THREE.Mesh(mergeParts(B.T[t],{uv:true,ao:true}),texMat(t));m.userData.tm=t;m.castShadow=t!=='plain';m.receiveShadow=true;m.matrixAutoUpdate=false;group.add(m)}
 if(B.glows.length)group.add(new THREE.Mesh(mergeParts(B.glows),glowMat));
 // contact shadows
 if(B.shadows.length){const planes=B.shadows.map(([x,z,w,dd])=>{const p=new THREE.PlaneGeometry(w,dd).toNonIndexed();p.rotateX(-Math.PI/2);p.translate(x,.014,z);return p});
  let n=0;for(const p of planes)n+=p.attributes.position.count;const P=new Float32Array(n*3),U=new Float32Array(n*2);let o=0;for(const p of planes){P.set(p.attributes.position.array,o*3);U.set(p.attributes.uv.array,o*2);o+=p.attributes.position.count;p.dispose()}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('uv',new THREE.BufferAttribute(U,2));
  const sm=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:TX.shadow,transparent:true,opacity:d.indoor?.35:.5,depthWrite:false,color:0x000000}));sm.renderOrder=1;group.add(sm)}
 let water=null;if(d.water){const wm=new THREE.MeshLambertMaterial({color:d.water,map:makeWaterTex(),transparent:true,opacity:.92});
  water=new THREE.Mesh(new THREE.PlaneGeometry(500,500),wm);water.rotation.x=-Math.PI/2;water.position.y=-.9;water.receiveShadow=true;group.add(water)}
 const sunDir=new THREE.Vector3(...d.sun[2]).normalize();
 if(water){water.userData.lo=water.material;water.userData.hi=makeWater(d.water,d.sky[0],d.sky[2],sunDir,d.sun[0])}
 const sky=d.indoor?null:makeSky(d.sky[0],d.sky[1],d.sky[2],sunDir,d.sun[0]);
 if(sky&&d.horizon){const hz=makeHorizon(d.horizon,d.fog[0],i*7+3);if(hz)sky.add(hz)}
 const lim=[sx/2,sz/2];const fix=l=>l.map(s=>fixSpawn(B.cols,s,lim));
 return cache[i]={def:d,group,sky,water,waterY:water?-.9:null,grassDefs:d.grass||[],cols:B.cols,ladders:B.ladders,hides:B.hides,links:B.links,nav:B.nav,sunDir,spawnsA:fix(d.spawnsA),spawnsB:fix(d.spawnsB),spawnsM:fix(d.spawnsM),groundHalf:d.pier?[sx/2,sz/2]:[1e9,1e9],size:d.size}}
function makeWaterTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#cfe8ff';x.fillRect(0,0,128,128);const r=rng(5);
 for(let i=0;i<90;i++){x.strokeStyle=`rgba(255,255,255,${.25+r()*.4})`;x.lineWidth=1+r()*1.5;x.beginPath();const px=r()*128,py=r()*128;x.moveTo(px,py);x.quadraticCurveTo(px+6,py-3,px+12+r()*8,py);x.stroke()}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(40,40);t.colorSpace=THREE.SRGBColorSpace;return t}
