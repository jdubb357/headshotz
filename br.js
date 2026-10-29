// HeadShotz v44: Battle Royale island "Skyline Island" (v59: 540 x 540 m). Procedural, original. Named zones, climbable roofs/towers, lots of cover & loot spots.
import {brExtra,BR_ZONES2} from './br2.js';
export const BR_ZONES0=[
 {n:'Tilted Town',x:0,z:0,r:62,c:'#ffd23f'},{n:'Industrial Works',x:112,z:-104,r:46,c:'#ff8a3d'},{n:'Farmstead',x:108,z:108,r:50,c:'#9be15d'},
 {n:'Pine Woods',x:-122,z:-12,r:50,c:'#3fbf6a'},{n:'Harbor Docks',x:-18,z:150,r:46,c:'#4de3ff'},{n:'Mount Summit',x:-18,z:-142,r:42,c:'#c9d3e0'},
 {n:'Dusty Quarry',x:-128,z:118,r:42,c:'#e0b070'},{n:'Signal Hill',x:158,z:2,r:34,c:'#ff5a8a'},{n:'Lakeside Cabins',x:-132,z:-128,r:40,c:'#7fb6ff'}];
export const BR_ZONES=[...BR_ZONES0,...BR_ZONES2];
export function brDef({G,rng,_c}){
 const R=rng(4242);const rr=(a,b)=>a+R()*(b-a),pick=a=>a[R()*a.length|0];
 const PAL=[0xe8dcc8,0xd9c9a8,0xcfd8dc,0xe6c9b8,0xc8d9c1,0xdcd0e0,0xe3d7a3];const ROOF=[0x8a3b32,0x4a5a68,0x2f6f6a,0x6d4c41,0x555b66];
 const NS={solid:false,shadow:false};
 return {name:'Skyline Island',desc:'24 players · loot · storm',icon:'🏝️',br:true,noDress:true,size:[540,540],ground:['grass',0x8fbf6a,.18],grade:[1.04,1.02,.97,1.3,1.1,.8],horizon:'city',wallH:6,
 sky:[0x2a68dc,0x86cbff,0xfff1dc],fog:[0xbcd8ee,110,330],hemi:[0xe8f2ff,0x6f8a55,1.35],sun:[0xfff0d0,1.8,[-.45,.7,-.35]],
 spawnsA:[[0,10],[6,10],[-6,10],[0,16]],spawnsB:[[0,-10],[6,-10],[-6,-10],[0,-16]],spawnsM:[[10,0],[-10,0]],zones:BR_ZONES,
 build(B){B.brLoot=[];B.brChests=[];B.brDoors=[];let bid=0;const taken=[];const lootAt=(x,y,z,b)=>B.brLoot.push([+x.toFixed(1),y,+z.toFixed(1),b]);
  const block=(x,z,w,d,pad=2)=>taken.push([x-w/2-pad,z-d/2-pad,x+w/2+pad,z+d/2+pad]);const HB=263;const isFree=(x,z,m=1.5)=>Math.abs(x)<HB&&Math.abs(z)<HB&&!taken.some(t=>x>t[0]-m&&x<t[2]+m&&z>t[1]-m&&z<t[3]+m);
  const patch=(x,z,w,d,tex,col,hh=1,us)=>B.box(x,0,z,w,.03*hh,d,col,tex,{solid:false,shadow:false,us});
  const road=(x0,z0,x1,z1,w=6,kind)=>{const horiz=Math.abs(x1-x0)>=Math.abs(z1-z0);const cx=(x0+x1)/2,cz=(z0+z1)/2,len=horiz?Math.abs(x1-x0):Math.abs(z1-z0);B.box(cx,0,cz,horiz?len:w,.04,horiz?w:len,kind==='dirt'?0x9a7a55:0x4a4d52,kind==='dirt'?'dirt':'asphalt',{solid:false,shadow:false,us:kind==='dirt'?.25:.2});
   if(kind!=='dirt')for(let k=-len/2+4;k<len/2-4;k+=9)B.box(horiz?cx+k:cx,.04,horiz?cz:cz+k,horiz?4:.3,.015,horiz?.3:4,0xe8e0a8,'plain',NS);taken.push(horiz?[Math.min(x0,x1),cz-w/2-1,Math.max(x0,x1),cz+w/2+1]:[cx-w/2-1,Math.min(z0,z1),cx+w/2+1,Math.max(z0,z1)])};
  // ---- generic building: 4 walls, one door (optionally windows), flat roof deck with parapet reachable by outside stairs, loot inside
  function bld(o){const{x,z,w,d,h=3.4,c=pick(PAL),tex='plaster',door='s',rc=pick(ROOF),stairs=1,dg=2.1,loot=3,chest=.3,win=1,windows,y:Y=0}=o;const id=bid++;const t=.3;const bx=(px,py,pz,a,b2,c2,col,tx,op)=>B.box(px,py+Y,pz,a,b2,c2,col,tx,op);
   const side=stairs?(door==='s'||door==='n'?(R()<.5?'e':'w'):(R()<.5?'n':'s')):null;
   const wall=(wx,wz,len,isX,sd)=>{const span=len;if(door===sd){const s=(span-dg)/2;B.door(wx,wz,Y,dg,2.4,isX?'x':'z',isX?(sd==='n'?1:-1):(sd==='e'?1:-1));if(isX){bx(wx-span/2+s/2,0,wz,s,h,t,c,tex);bx(wx+span/2-s/2,0,wz,s,h,t,c,tex);bx(wx,2.4,wz,dg,h-2.4,t,c,tex)}else{bx(wx,0,wz-span/2+s/2,t,h,s,c,tex);bx(wx,0,wz+span/2-s/2,t,h,s,c,tex);bx(wx,2.4,wz,t,h-2.4,dg,c,tex)}return}
    if(win&&span>5&&(windows??R()<.55)){const ww=1.5,s=(span-ww)/2;if(isX){bx(wx-span/2+s/2,0,wz,s,h,t,c,tex);bx(wx+span/2-s/2,0,wz,s,h,t,c,tex);bx(wx,0,wz,ww,1.0,t,c,tex);bx(wx,2.1,wz,ww,h-2.1,t,c,tex);bx(wx,1.0,wz,ww,1.1,.05,0xffffff,'window',{...NS,local:true})}
     else{bx(wx,0,wz-span/2+s/2,t,h,s,c,tex);bx(wx,0,wz+span/2-s/2,t,h,s,c,tex);bx(wx,0,wz,t,1.0,ww,c,tex);bx(wx,2.1,wz,t,h-2.1,ww,c,tex);bx(wx,1.0,wz,.05,1.1,ww,0xffffff,'window',{...NS,local:true})}return}
    isX?bx(wx,0,wz,span,h,t,c,tex):bx(wx,0,wz,t,h,span,c,tex)};
   wall(x,z+d/2-t/2,w,true,'n');wall(x,z-d/2+t/2,w,true,'s');wall(x+w/2-t/2,z,d,false,'e');wall(x-w/2+t/2,z,d,false,'w');
   const dk=_c.set(c).multiplyScalar(.6).getHex();bx(x,0,z,w+.1,.3,d+.1,dk,'concrete',{...NS});
   bx(x,h,z,w+.5,.35,d+.5,rc,'concrete');const pc=_c.set(rc).multiplyScalar(.8).getHex();
   for(const s of[-1,1]){if(!(side==='n'&&s>0)&&!(side==='s'&&s<0))bx(x,h+.35,z+s*(d/2+.15),w+.5,.55,.2,pc,'concrete',{shadow:false});if(!(side==='e'&&s>0)&&!(side==='w'&&s<0))bx(x+s*(w/2+.15),h+.35,z,.2,.55,d+.5,pc,'concrete',{shadow:false})}
   const dv={n:[0,1],s:[0,-1],e:[1,0],w:[-1,0]}[door];const outX=x+(dv[0]?dv[0]*(w/2+2.4):0),outZ=z+(dv[1]?dv[1]*(d/2+2.4):0),inX=x+(dv[0]?dv[0]*(w/2-2):0),inZ=z+(dv[1]?dv[1]*(d/2-2):0);
   B.brDoors.push({id,y:Y,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,out:[+outX.toFixed(1),+outZ.toFixed(1)],in:[+inX.toFixed(1),+inZ.toFixed(1)]});
   for(let i=0;i<loot;i++)lootAt(x+rr(-w/2+1.3,w/2-1.3),Y,z+rr(-d/2+1.3,d/2-1.3),id);
   if(R()<chest){let cx=x-dv[0]*(w/2-1),cz=z-dv[1]*(d/2-1);if(dv[0])cz+=rr(-d/3,d/3);else cx+=rr(-w/3,w/3);B.brChests.push([+cx.toFixed(1),Y,+cz.toFixed(1),dv[0]?(dv[0]>0?-Math.PI/2:Math.PI/2):(dv[1]>0?Math.PI:0),id]);B.cols.push({x0:cx-.55,x1:cx+.55,y0:Y,y1:Y+.7,z0:cz-.55,z1:cz+.55})}
   if(R()<.6){B.crate(x+rr(-w/3,w/3),z+rr(-d/3,d/3),rr(.9,1.3),Y,0xc79a5c)}
   if(stairs){const n=Math.ceil((h+.35)/.35),sh=(h+.35)/n,run=.55,L=run*n,wd=1.7,e=.25;
    if(side==='e')B.stairs(x+w/2+e+L,Y,z-d/2+wd/2+.6,'x-',n,sh,run,wd,0x9aa0a6,'concrete');else if(side==='w')B.stairs(x-w/2-e-L,Y,z-d/2+wd/2+.6,'x+',n,sh,run,wd,0x9aa0a6,'concrete');
    else if(side==='n')B.stairs(x-w/2+wd/2+.6,Y,z+d/2+e+L,'z-',n,sh,run,wd,0x9aa0a6,'concrete');else B.stairs(x-w/2+wd/2+.6,Y,z-d/2-e-L,'z+',n,sh,run,wd,0x9aa0a6,'concrete');
    lootAt(x+rr(-w/4,w/4),Y+h+.35,z+rr(-d/4,d/4),id);if(R()<.2)B.brChests.push([+x.toFixed(1),Y+h+.35,+z.toFixed(1),R()*6.28,id]);B.spot(x,Y+h+.35,z)}
   block(x,z,w+(stairs?7:0),d+(stairs?7:0),1.5);return id}
  const tower=(x,z,h=9,c=0x7a5a3a)=>{// lookout tower: four legs, deck, rails, ladder
   for(const a of[-1,1])for(const b of[-1,1])B.box(x+a*1.5,0,z+b*1.5,.3,h,.3,c,'planks',{gy:0});B.box(x,h,z,4,.3,4,0x8a6a45,'planks',{gy:h});for(const s of[-1,1]){B.box(x,h+.3,z+s*1.9,4,.9,.2,0x6d5232,'planks',{shadow:false});B.box(x+s*1.9,h+.3,z,.2,.9,4,0x6d5232,'planks',{shadow:false})}
   B.box(x,h+3.2,z,4.6,.25,4.6,0x6d4c41,'planks',{solid:false,shadow:false});for(const a of[-1,1])for(const b of[-1,1])B.box(x+a*1.9,h+.3,z+b*1.9,.15,2.9,.15,0x6d5232,'planks',{solid:false,shadow:false});
   B.ladder(x,z-2.05,0,h,'z-');lootAt(x,h+.3,z,-1);if(R()<.5)B.brChests.push([x,h+.3,z+.8,0,-1]);block(x,z,5,5,2);B.spot(x,h+.3,z)};
  const pine=(x,z,s=1)=>{B.cyl(x,0,z,.2*s,1.4*s,0x5d4037,'rock',{seg:6,shadow:false,solid:false});for(let i=0;i<3;i++)B.part('leaves',{g:G('cone',(1.8-i*.5)*s,1.9*s,8),p:[x,(1.7+i*1.15)*s,z],c:_c.set(pick([0x2f5d3a,0x2a5234,0x37683f])).multiplyScalar(.9+R()*.2).getHex(),ao:false});B.cols.push({x0:x-.35*s,x1:x+.35*s,y0:0,y1:4*s,z0:z-.35*s,z1:z+.35*s});B.shadows.push([x,z,3*s,3*s])};
  const rock=(x,z,s=1)=>{B.part('rock',{g:G('dode',1.2*s),p:[x,.6*s,z],s:[1.3,.8,1.1],r:[R(),R()*3,R()],c:_c.set(0x8a8c90).multiplyScalar(.85+R()*.3).getHex()});B.cols.push({x0:x-1.1*s,x1:x+1.1*s,y0:0,y1:1.1*s,z0:z-1*s,z1:z+1*s});B.shadows.push([x,z,3*s,3*s])};
  const fence=(x,z,len,ax,c=0x8a6a45)=>{const n=Math.floor(len/2);for(let i=0;i<n;i++){const o=-len/2+1+i*2;if(ax==='x'){B.box(x+o,0,z,.12,1.1,.12,c,'planks',{shadow:false,solid:false});B.box(x+o+1,.7,z,2,.09,.07,c,'planks',{...NS})}else{B.box(x,0,z+o,.12,1.1,.12,c,'planks',{shadow:false,solid:false});B.box(x,.7,z+o+1,.07,.09,2,c,'planks',{...NS})}}};
  const lamp=(x,z,q=0)=>B.lamp(x,z,4.4,q);
  for(const s of[-1,1]){B.box(0,0,s*263,540,.05,14,0xe2d3a0,'sand',NS);B.box(s*263,0,0,14,.05,540,0xe2d3a0,'sand',NS)}
  // richer ground (CC0 Poly Haven): cobbled plaza, forest floors, dirt farm yards, gravel works/quarry
  B.cyl(0,0,0,14,.03,0xb8b0a4,'cobble',{seg:28,solid:false,shadow:false});patch(-122,-12,110,108,'forest',0xa09062,1);patch(108,100,64,50,'dirt',0xa07850,1);patch(108+4,108+48,50,30,'dirt',0x8a6a40,1);patch(112,-104,96,70,'gravel',0xb0aca4,1);patch(-128,118,92,80,'dirt',0xb89a6a,1);patch(-18,141,100,20,'gravel',0xaaa59a,1);
  // ============ 1. TILTED TOWN (centre) ============
  road(-70,0,70,0,7);road(0,-70,0,70,7);road(-52,-34,52,-34,5);road(-52,34,52,34,5);road(-34,-52,-34,52,5);road(34,-52,34,52,5);
  B.cyl(0,0,0,4.6,.5,0xd9dde6,'concrete',{seg:24,shadow:false});B.cyl(0,.5,0,3.8,.2,0x4a90c8,'plain',{seg:24,solid:false,shadow:false});B.cyl(0,.5,0,.7,2.4,0xe8e8f0,'concrete',{seg:10});B.part('metal',{g:G('ico',.8,1),p:[0,3.4,0],c:0xffd23f});block(0,0,10,10,2);
  // clock tower with ladder (tallest, centre-north)
  {const x=0,z=-14,h=24;B.box(x,0,z,6,h,6,0xb9a58c,'brick',{gy:0});B.box(x,h,z,7.4,.5,7.4,0x5a3b30,'concrete',{gy:h});for(const s of[-1,1]){B.box(x,h+.5,z+s*3.5,7.4,1,.3,0x7a5a4a,'concrete',{shadow:false});B.box(x+s*3.5,h+.5,z,.3,1,7.4,0x7a5a4a,'concrete',{shadow:false})}
   B.part('concrete',{g:G('cone',3.2,3.4,4),p:[x,h+2.2,z],r:[0,Math.PI/4,0],c:0x4a3b36});for(const s of[-1,1]){B.glow(x,h-4,z+s*3.05,2.2,2.2,.1,0xfff0c0);B.glow(x+s*3.05,h-4,z,.1,2.2,2.2,0xfff0c0)}
   B.ladder(x,z+3.05,0,h,'z+');lootAt(x,h+.5,z,-1);B.brChests.push([x+1.5,h+.5,z,0,-1]);block(x,z,6,6,3);B.spot(x,h+.5,z)}
  // town blocks: ring of buildings along streets, varied sizes, doors facing the street
  const town=[[-22,-24,12,9,'s'],[22,-24,11,9,'s'],[-46,-24,10,8,'s'],[46,-24,10,8,'s'],[-22,24,11,9,'n'],[22,24,12,9,'n'],[-46,24,10,8,'n'],[46,24,10,8,'n'],
   [-24,-44,13,8,'s'],[24,-44,13,8,'s'],[-24,44,13,8,'n'],[24,44,13,8,'n'],[-46,-5,9,11,'e'],[46,-5,9,11,'w'],[-46,13,9,9,'e'],[46,13,9,9,'w'],[-12,-6,9,8,'e'],[12,6,9,8,'w'],[-12,10,8,8,'e'],[12,-10,8,8,'w']];
  for(const[x,z,w,d,door]of town)bld({x,z,w,d,h:R()<.35?5.8:3.4,door,loot:R()<.5?3:4,chest:.4});
  // plaza props
  for(const[x,z,q]of[[-8,-3,0],[8,3,1],[-6,22,1],[6,-22,0]])B.bench(x,z,q);for(let i=0;i<10;i++){const a=i/10*6.283;lamp(Math.cos(a)*9,Math.sin(a)*9,i%4)}
  B.car(-18,3.6,0,0xc0392b);B.car(20,-3.6,2,0x2980b9);B.wreck(-30,-3.6,0,0x7f8c8d);B.car(3.6,30,1,0xf1c40f);B.car(-3.6,-30,1,0x27ae60);
  for(const[x,z]of[[-36,-6],[36,7],[-8,38],[10,-40]])B.planter(x,z,2.4,2.4,.9);
  // ============ 2. INDUSTRIAL WORKS (NE) ============
  {const cx=112,cz=-104;road(70,-104,150,-104,6);road(112,-104,112,-60,6);
   bld({x:cx-24,z:cz-14,w:22,d:14,h:6.5,c:0x9ba3ab,tex:'metal',door:'s',loot:6,chest:.9,win:0,rc:0x5a6068,dg:4.2});bld({x:cx+22,z:cz-16,w:20,d:12,h:6,c:0xa3b0b8,tex:'metal',door:'w',loot:5,chest:.9,win:0,rc:0x4a5560,dg:4});bld({x:cx-8,z:cz+22,w:12,d:9,h:3.6,c:0xc8bfae,tex:'concrete',door:'n',loot:4,chest:.6});bld({x:cx+30,z:cz+14,w:9,d:8,h:3.4,c:0xb9a58c,tex:'brick',door:'w',loot:3});
   // container yard (stacks with ladders)
   const cc=[0xc0392b,0x2980b9,0x27ae60,0xf39c12,0x7f8c8d,0x8e44ad];for(let i=0;i<9;i++){const x=cx-34+(i%3)*8,z=cz+18+Math.floor(i/3)*3.2;B.container(x,z,i%2,pick(cc));if(i%3===1){B.container(x,z,i%2,pick(cc),2.6);B.ladder(x+(i%2?0:3.05),z+(i%2?1.28:0),0,5.2,i%2?'z+':'x+')}}
   block(cx-26,cz+23,26,12,1);for(let k=0;k<4;k++){B.brChests.push([cx-34+k*8,0,cz+26.5,0,-1]);}
   // silos, tanks, pipes, crane
   for(let i=0;i<3;i++){const x=cx+4+i*7,z=cz+34;B.cyl(x,0,z,3,13,0xd9d9d0,'metal',{seg:20,us:.4});B.ladder(x+3*.85,z,0,13,'x+');lootAt(x,13,z,-1)}block(cx+14,cz+34,24,8,1);
   B.cyl(cx-50,0,cz-4,4.2,6,0x5a7a9a,'metal',{seg:20});B.cyl(cx-50,0,cz+6,4.2,6,0x5a7a9a,'metal',{seg:20});
   {const x=cx+46,z=cz-40,h=22;for(const a of[-1,1])for(const b of[-1,1])B.box(x+a*2.5,0,z+b*2.5,.5,h,.5,0xe0a020,'metal',{gy:0});B.box(x,h,z,6.5,.5,6.5,0xe0a020,'metal',{gy:h});B.box(x+10,h+.3,z,24,.7,1.2,0xd09010,'metal',{solid:false});B.ladder(x,z-2.85,0,h,'z-');lootAt(x,h+.5,z,-1);B.brChests.push([x,h+.5,z+1,0,-1])}
   for(let i=0;i<14;i++){const x=cx+rr(-40,44),z=cz+rr(-34,8);if(isFree(x,z,2.5)){if(i%2)B.barrel(x,z,pick([0xc0392b,0x2e86de,0xf39c12]));else B.crate(x,z,1.3,0,0xc79a5c)}}
   B.car(cx+4,cz-4,1,0xf39c12);B.wreck(cx-14,cz+3,0,0x7f8c8d);for(let i=0;i<5;i++)B.barrier(cx-42+i*4,cz-24,0,3);block(cx,cz,100,80,0)}
  // ============ 3. FARMSTEAD (SE) ============
  {const cx=108,cz=108;road(70,108,140,108,5);road(108,60,108,108,5);
   bld({x:cx+4,z:cz-12,w:18,d:11,h:6.5,c:0xb03a2e,tex:'brick',door:'s',loot:6,chest:.9,win:0,rc:0x5a3b30,dg:4.4});// big red barn
   bld({x:cx-24,z:cz-18,w:10,d:9,h:3.4,c:0xe8dcc8,door:'e',loot:4,chest:.7});bld({x:cx+28,z:cz+10,w:8,d:7,h:3.2,c:0xcdb89a,tex:'planks',door:'w',loot:3});bld({x:cx-22,z:cz+14,w:9,d:7,h:3.2,c:0xcdb89a,tex:'planks',door:'n',loot:3});
   B.cyl(cx+22,0,cz-16,2.6,11,0xcfd3d8,'metal',{seg:18,us:.4});B.ladder(cx+22+2.6*.85,cz-16,0,11,'x+');lootAt(cx+22,11,cz-16,-1);B.part('metal',{g:G('cone',2.7,1.6,18),p:[cx+22,11.8,cz-16],c:0x8a9099});
   for(let i=0;i<7;i++){const z=cz+36+i*3.4;B.hedge(cx+4,z,44,1.4,1.3,0x6faa3a)}block(cx+4,cz+48,46,26,0);
   for(let i=0;i<7;i++){B.box(cx-26+(i%4)*2.3,0,cz+30+(i>3?2.4:0),2,1.4,1.7,0xd6b85a,'planks',{us:.5})}// hay bales
   fence(cx-12,cz+24,40,'x');fence(cx+44,cz-16,34,'z');B.car(cx-8,cz-4,1,0x2e7d32);tower(cx-44,cz+36,8);B.wreck(cx+34,cz-30,1,0x7f6a50);
   for(let i=0;i<10;i++){const x=cx+rr(-48,50),z=cz+rr(-46,6);if(isFree(x,z,3))B.tree(x,z,rr(.9,1.3))}block(cx,cz,100,100,0)}
  // ============ 4. PINE WOODS (W) ============
  {const cx=-122,cz=-12;for(const[dx,dz,w,d,door]of[[-14,-12,9,8,'e'],[14,-16,8,8,'w'],[2,16,9,7,'n']])bld({x:cx+dx,z:cz+dz,w,d,h:3.2,c:0x8a6a45,tex:'planks',door,loot:4,chest:.8,rc:0x4e3b2a,win:1});
   tower(cx-30,cz+20,10);tower(cx+30,cz-30,9);for(let i=0;i<150;i++){const x=cx+rr(-60,52),z=cz+rr(-58,60);if(isFree(x,z,2.2))pine(x,z,rr(.9,1.6))}for(let i=0;i<14;i++){const x=cx+rr(-55,50),z=cz+rr(-55,55);if(isFree(x,z,2))rock(x,z,rr(.7,1.5))}
   B.cyl(cx+4,0,cz,.7,.3,0x4a4a4a,'rock',{solid:false});B.part('plain',{g:G('cone',.35,.9,6),p:[cx+4,.7,cz],c:0xff7a1a});B.glow(cx+4,.4,cz,.4,.5,.4,0xff9a3a);lootAt(cx+2,0,cz+2,-1);lootAt(cx-2,0,cz-1,-1);
   road(-70,-12,-100,-12,4);for(let i=0;i<6;i++){const x=cx+rr(-40,40),z=cz+rr(-40,40);if(isFree(x,z,2)){B.crate(x,z,1.1,0,0xc79a5c);lootAt(x+1.2,0,z,-1)}}block(cx,cz,0,0,0)}
  // ============ 5. HARBOR DOCKS (S) ============
  {const cx=-18,cz=150;B.box(cx,0,cz+34,150,.05,60,0x2b78b8,'plain',{solid:false,shadow:false});// shallow bay
   for(let i=0;i<4;i++){const x=cx-40+i*26;B.box(x,0,cz+12,6,.55,52,0x8a6a45,'planks',{gy:0});for(let k=0;k<7;k++)B.box(x-2.7,0,cz-12+k*8,.4,1.2,.4,0x4e3b2a,'planks',{solid:false,shadow:false});if(i%2===0){lootAt(x,.55,cz+30,-1);lootAt(x,.55,cz+18,-1);B.brChests.push([x+1.5,.55,cz+36,0,-1])}else{B.crate(x+1,cz+26,1.3,.55,0xc79a5c);lootAt(x,.55,cz+22,-1)}}
   // boats
   for(const[x,z,c]of[[cx-27,cz+44,0xe8e8e8],[cx+25,cz+48,0xc0392b]]){B.box(x,.05,z,5,1.4,12,c,'metal',{gy:.05});B.box(x,1.45,z-1,3.4,2,4,0xf4f4f4,'plaster',{gy:1.45});B.glow(x,2.2,z+1.05,2.4,.5,.05,0x9fd8ff)}
   bld({x:cx-48,z:cz-14,w:20,d:12,h:5.5,c:0xa9b4bd,tex:'metal',door:'e',loot:5,chest:.9,win:0,rc:0x56606b,dg:4});bld({x:cx+40,z:cz-14,w:14,d:10,h:4,c:0xd8c9a8,door:'w',loot:4,chest:.7});bld({x:cx+8,z:cz-26,w:10,d:8,h:3.4,c:0xe0d0c0,door:'s',loot:3});
   for(let i=0;i<8;i++){B.container(cx-60+(i%4)*8,cz-34+Math.floor(i/4)*3.2,0,pick([0xc0392b,0x2980b9,0x27ae60,0xf39c12]))}
   // lighthouse (ladder inside-out)
   B.cyl(cx+66,0,cz+10,3.2,18,0xf0f0f0,'plaster',{seg:16});B.cyl(cx+66,6,cz+10,3.25,3,0xc0392b,'plaster',{seg:16,solid:false,shadow:false});B.cyl(cx+66,12,cz+10,3.25,3,0xc0392b,'plaster',{seg:16,solid:false,shadow:false});B.box(cx+66,18,cz+10,7,.4,7,0x444a52,'metal',{gy:18});B.glow(cx+66,18.5,cz+10,1.4,1.6,1.4,0xfff2b0);B.ladder(cx+66+3.2*.85,cz+10,0,18,'x+');lootAt(cx+66,18.4,cz+13,-1);B.brChests.push([cx+66,18.4,cz+8,0,-1]);
   for(let i=0;i<10;i++){const x=cx+rr(-60,60),z=cz+rr(-30,6);if(isFree(x,z,2.5)){if(i%2)B.barrel(x,z,pick([0x2e86de,0xc0392b]));else B.crate(x,z,1.2,0,0xc79a5c)}}road(-18,60,-18,110,6);block(cx,cz,0,0,0)}
  // ============ 6. MOUNT SUMMIT (N) ============
  {const cx=-18,cz=-142;const L=[[44,40,3],[32,28,3],[22,18,3],[12,10,3]];let y=0;const ys=[];L.forEach(([w,d,hh],i)=>{ys.push(y);B.box(cx,y,cz,w,hh,d,_c.set(0x8a8c90).multiplyScalar(1-i*.06).getHex(),'rock',{gy:y,us:.12});y+=hh});
   L.forEach(([w,d,hh],i)=>{const n=Math.round(hh/.34),sh=hh/n,run=.5,len=run*n;if(i%2===0)B.stairs(cx+w/2+len,ys[i],cz+(i===2?3:-3),'x-',n,sh,run,2.2,0x9a9ea5,'rock');else B.stairs(cx+(i===3?-2:2),ys[i],cz+d/2+len,'z-',n,sh,run,2.2,0x9a9ea5,'rock')});
   const top=y;bld({x:cx,z:cz,w:8,d:7,h:3,c:0x6f757d,tex:'concrete',door:'s',stairs:0,loot:4,chest:1,rc:0x3f444a,win:0,y:top});
   for(let i=0;i<10;i++){const a=R()*6.28,r=rr(30,44);const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(isFree(x,z,3))rock(x,z,rr(1,2.2))}for(let i=0;i<16;i++){const x=cx+rr(-64,64),z=cz+rr(-52,56);if(isFree(x,z,3)&&Math.hypot(x-cx,z-cz)>30)pine(x,z,rr(.9,1.4))}
   lootAt(cx-19,3,cz+6,-1);lootAt(cx+13,6,cz+4,-1);lootAt(cx,9,cz+7,-1);B.brChests.push([cx-20,3,cz-5,0,-1],[cx+14,6,cz-4,0,-1]);B.spot(cx,top,cz);block(cx,cz,60,56,0)}
  // ============ 7. DUSTY QUARRY (SW) ============
  {const cx=-128,cz=118;for(const[x,z,w,d]of[[-14,-10,18,4],[14,6,4,18],[0,16,20,3]]){const ww=w,dd=d;B.box(cx+x,0,cz+z,ww,4.2,dd,0xb99a6a,'rock',{gy:0,us:.15});B.box(cx+x,4.2,cz+z,ww*.7,2.4,dd*.8,0xa38559,'rock',{gy:4.2,us:.15})}
   B.stairs(cx-10,0,cz-12-6.6,'z+',12,.35,.55,2,0x9a8a6a,'rock');B.stairs(cx+16+6.6,0,cz+6,'x-',12,.35,.55,2,0x9a8a6a,'rock');
   bld({x:cx-4,z:cz+24,w:12,d:8,h:3.2,c:0xcdb89a,tex:'planks',door:'n',loot:4,chest:.9,rc:0x6d4c41});bld({x:cx+24,z:cz+22,w:8,d:7,h:3.2,c:0xb9a58c,tex:'planks',door:'w',loot:3});
   B.container(cx-26,cz+6,0,0xc0392b);B.container(cx-26,cz+12,1,0x2980b9);B.crate(cx+2,cz+4,1.3);B.barrel(cx+5,cz+4);
   for(let i=0;i<16;i++){const x=cx+rr(-46,46),z=cz+rr(-38,40);if(isFree(x,z,3))rock(x,z,rr(.8,2))}for(let i=0;i<6;i++){const x=cx+rr(-40,40),z=cz+rr(-30,30);if(isFree(x,z,2.5))B.crate(x,z,1.2,0,0xc79a5c)}
   lootAt(cx-14,6.6,cz-10,-1);lootAt(cx+14,6.6,cz+6,-1);B.brChests.push([cx+14,6.6,cz+10,0,-1],[cx-14,6.6,cz-10,0,-1]);B.wreck(cx+10,cz+30,0,0x8a6a45);road(-70,118,-100,118,4);block(cx,cz,0,0,0)}
  // ============ 8. SIGNAL HILL (E) ============
  {const cx=158,cz=2;B.box(cx,0,cz,26,2.4,26,0x8a8c90,'rock',{gy:0,us:.12});B.box(cx,2.4,cz,16,2.4,16,0x7e8086,'rock',{gy:2.4,us:.12});B.stairs(cx+13+4.2,0,cz,'x-',7,.34,.6,2.4,0x9a9ea5,'rock');B.stairs(cx+8+4.2,2.4,cz+4,'x-',7,.34,.6,2.4,0x9a9ea5,'rock');
   // radio mast
   {const h=34;for(const a of[-1,1])for(const b of[-1,1])B.box(cx+4+a*1.2,4.8,cz+b*1.2,.25,h-4.8,.25,0xd0452a,'metal',{gy:4.8,solid:false,shadow:false});B.cols.push({x0:cx+2.6,x1:cx+5.4,y0:4.8,y1:h,z0:cz-1.4,z1:cz+1.4});B.ladder(cx+5.4,cz,4.8,28,'x+');B.box(cx+4,28,cz,3.2,.3,3.2,0x666d75,'metal',{gy:28});lootAt(cx+4,28.3,cz,-1);B.brChests.push([cx+4,28.3,cz+1,0,-1])}
   bld({x:cx+30,z:cz-12,w:10,d:8,h:3.2,c:0x6f757d,tex:'concrete',door:'w',loot:4,chest:1,rc:0x3f444a,win:0});bld({x:cx+30,z:cz+14,w:9,d:8,h:3.2,c:0x6f757d,tex:'concrete',door:'w',loot:3,chest:.8,rc:0x3f444a,win:0});
   for(let i=0;i<6;i++){const a=i/6*6.283;sandbagsAt(cx+Math.cos(a)*18,cz+Math.sin(a)*18,i)}lootAt(cx,4.8,cz+3,-1);lootAt(cx-4,4.8,cz-3,-1);road(70,2,140,2,5);block(cx,cz,0,0,0)}
  function sandbagsAt(x,z,i){const L=B.at(x,z,i%2);L.box(0,0,0,3.2,.9,.6,0xb8a57a,'sand',{us:.5,shadow:false})}
  // ============ 9. LAKESIDE CABINS (NW) ============
  {const cx=-132,cz=-128;B.box(cx+6,0,cz+10,44,.05,36,0x2f86c8,'plain',{solid:false,shadow:false});for(let k=0;k<6;k++)B.box(cx+6,.05,cz+10-14+k*5.6,44-k*2,.02,.6,0x9fd0f0,'plain',NS);// lake
   for(const[dx,dz,door]of[[-24,-12,'e'],[-24,10,'e'],[-6,-30,'s'],[22,-24,'w'],[30,6,'w']])bld({x:cx+dx,z:cz+dz,w:8.5,d:7.5,h:3.2,c:0x8a6a45,tex:'planks',door,loot:3,chest:.7,rc:0x4e3b2a,win:1});
   B.box(cx+6,0,cz-12,10,.5,2.4,0x8a6a45,'planks',{gy:0});B.box(cx+6,0,cz-2,2.4,.5,16,0x8a6a45,'planks',{gy:0});lootAt(cx+6,.5,cz-12,-1);lootAt(cx+6,.5,cz-6,-1);
   for(let i=0;i<46;i++){const x=cx+rr(-56,56),z=cz+rr(-52,56);if(isFree(x,z,2.2)&&!(x>cx-16&&x<cx+28&&z>cz-8&&z<cz+30)){if(i%3)pine(x,z,rr(.9,1.4));else B.tree(x,z,rr(.9,1.3))}}
   lamp(cx-14,cz-4,1);block(cx+6,cz+10,46,38,0)}
  // ============ connecting roads + wilderness ============
  brExtra({B,G,_c,R,rr,pick,bld,tower,pine,rock,fence,lamp,road,block,isFree,lootAt,patch,NS,PAL});
  road(0,70,0,108,5);road(-70,0,-70,-12,4);road(70,-34,112,-60,4);road(0,-70,0,-110,5);road(-100,-12,-100,-120,4);
  const zones=[[0,0,66],[112,-104,52],[108,108,56],[-122,-12,56],[-18,150,50],[-18,-142,48],[-128,118,48],[158,2,36],[-132,-128,44],...BR_ZONES2.map(z=>[z.x,z.z,z.r+6])];
  for(let i=0;i<460;i++){const x=rr(-262,262),z=rr(-262,262);if(zones.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;if(!isFree(x,z,2.2))continue;const k=R();if(k<.5)B.tree(x,z,rr(.9,1.5));else if(k<.72)pine(x,z,rr(.9,1.5));else if(k<.88)rock(x,z,rr(.7,1.6));else B.bush(x,z,rr(.8,1.4))}
  // lone roadside lodges / watch posts (extra loot between zones)
  for(const[x,z,door]of[[-70,60,'e'],[70,-60,'w'],[60,48,'n'],[-60,-60,'s'],[-165,40,'e'],[170,-60,'w'],[40,-168,'s'],[-40,176,'s'],[-60,-215,'s'],[60,-200,'w'],[-170,-150,'e'],[175,170,'n'],[-175,-40,'e'],[190,90,'w'],[-60,230,'n'],[20,-250,'s'],[-250,-120,'e'],[250,-150,'w'],[160,-150,'s'],[-130,235,'e']])if(isFree(x,z,6)){bld({x,z,w:8,d:7,h:3.2,c:pick(PAL),door,loot:3,chest:.7});}
  for(const[x,z]of[[-90,-80],[85,-30],[-30,-80],[30,85],[-85,45],[170,60],[-180,-200],[200,-190],[-250,-60],[250,60],[-120,250],[60,-250],[200,130],[-60,200]])if(isFree(x,z,5))tower(x,z,8);
  for(let i=0;i<22;i++){const x=rr(-250,250),z=rr(-250,250);if(isFree(x,z,4)&&!zones.some(([a,b,r])=>Math.hypot(x-a,z-b)<r*.8)){B.car(x,z,i%4,pick([0xc0392b,0x2980b9,0x7f8c8d,0xf1c40f]))}}
  // ground loot sprinkled in the open (small crates & barrels)
  for(let i=0;i<100;i++){const x=rr(-255,255),z=rr(-255,255);if(isFree(x,z,2.5)){B.brLoot.push([+x.toFixed(1),0,+z.toFixed(1),-1])}}
  // v59: nudge any chest / loot spot that ended up inside a wall, container or prop out onto free, supported floor
  {const solid=k=>k.y1-k.y0>1.2&&!k.door&&k.door!==0;const inside=(x,z,y,h)=>B.cols.some(k=>solid(k)&&x>k.x0+.05&&x<k.x1-.05&&z>k.z0+.05&&z<k.z1-.05&&y>=k.y0-.01&&y+h<k.y1-.05);
   const near=(x,z,y,h,m)=>B.cols.some(k=>solid(k)&&x>k.x0-m&&x<k.x1+m&&z>k.z0-m&&z<k.z1+m&&y>=k.y0-.01&&y+h<k.y1-.05);
   const sup=(x,z,y)=>y<.1||B.cols.some(k=>x>k.x0&&x<k.x1&&z>k.z0&&z<k.z1&&Math.abs(k.y1-y)<.12);
   const fix=(a,h,m)=>{if(!inside(a[0],a[2],a[1],h))return;for(let r=.7;r<9;r+=.7)for(let q=0;q<14;q++){const ang=q/14*6.283,x=a[0]+Math.cos(ang)*r,z=a[2]+Math.sin(ang)*r;if(!near(x,z,a[1],h,m)&&sup(x,z,a[1])&&Math.abs(x)<HB&&Math.abs(z)<HB){const ox=a[0],oz=a[2];a[0]=+x.toFixed(1);a[2]=+z.toFixed(1);return[ox,oz]}}};
   for(const c of B.brChests){const o=fix(c,.5,.6);if(o){const k=B.cols.find(k=>Math.abs(k.x0-(o[0]-.55))<.02&&Math.abs(k.z0-(o[1]-.55))<.02&&k.y1-k.y0<.8);if(k){k.x0=c[0]-.55;k.x1=c[0]+.55;k.z0=c[2]-.55;k.z1=c[2]+.55}}}
   for(const l of B.brLoot)fix(l,.4,.4)}
 }}}
