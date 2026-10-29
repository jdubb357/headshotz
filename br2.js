// HeadShotz v59: Royale island expansion ring (540 x 540 m). Named POIs: Iron Keep (castle), Foundry (factory), Maple Village (town),
// Misty Lake, Frostpeak (mountains), Old Growth Forest, Dune Camp + rivers, bridges, ponds, rocky outcrops and richer CC0 ground patches.
// Everything is built from the same merged boxes / cylinders as the rest of the island (chunk-culled in maps.js), so it stays cheap on iPhone.
export const BR_ZONES2=[
 {n:'Iron Keep',x:110,z:-232,r:40,c:'#c9a0ff'},{n:'Foundry',x:226,z:-60,r:42,c:'#ffb347'},{n:'Maple Village',x:110,z:232,r:42,c:'#ff8fb3'},
 {n:'Misty Lake',x:-236,z:36,r:44,c:'#6fd0ff'},{n:'Frostpeak',x:-222,z:-218,r:50,c:'#e8f4ff'},{n:'Old Growth Forest',x:-206,z:204,r:52,c:'#2fa35a'},{n:'Dune Camp',x:232,z:226,r:40,c:'#f2c46d'}];
export function brExtra(X){const{B,G,_c,R,rr,pick,bld,tower,pine,rock,fence,lamp,road,block,isFree,lootAt,patch,NS,PAL}=X;
 const crenel=(x,y,z,len,ax,c,step=2.2)=>{const n=Math.floor(len/step);for(let i=0;i<n;i++){const o=-len/2+step*(i+.5);ax==='x'?B.box(x+o,y,z,1.1,.9,.55,c,'brick',{shadow:false}):B.box(x,y,z+o,.55,.9,1.1,c,'brick',{shadow:false})}};
 const water=(x,z,w,d,c=0x2f86c8,y=0)=>B.box(x,y,z,w,.05,d,c,'plain',{solid:false,shadow:false});
 // plank bridge (walkable deck + solid rails). ax = direction of travel
 const bridge=(x,z,len,w,ax)=>{const L=ax==='x'?len:w,D=ax==='x'?w:len;B.box(x,.02,z,L,.16,D,0x8a6a45,'planks',{solid:false,shadow:false,us:.5});B.cols.push({x0:x-L/2,x1:x+L/2,y0:0,y1:.12,z0:z-D/2,z1:z+D/2});
  for(const s of[-1,1]){if(ax==='x'){B.box(x,0,z+s*(w/2-.1),len,1,.2,0x6d5232,'planks',{shadow:false});for(let k=-len/2+.6;k<len/2;k+=2.4)B.box(x+k,0,z+s*(w/2-.1),.3,1.35,.3,0x4e3b2a,'planks',{solid:false,shadow:false})}
   else{B.box(x+s*(w/2-.1),0,z,.2,1,len,0x6d5232,'planks',{shadow:false});for(let k=-len/2+.6;k<len/2;k+=2.4)B.box(x+s*(w/2-.1),0,z+k,.3,1.35,.3,0x4e3b2a,'planks',{solid:false,shadow:false})}}};
 // ============ IRON KEEP (castle, N edge) ============
 {const cx=110,cz=-232,H=8,T=1.6,S=22,wc=0x9d968c,rk='brick';
  patch(cx,cz,50,50,'cobble',0xb8b0a4,1);
  // moat ring + gate bridge
  for(const s of[-1,1]){water(cx,cz+s*(S+4.2),2*S+16,6.2);water(cx+s*(S+4.2),cz,6.2,2*S+2)}
  // curtain walls (gate gap in the +z wall), crenellated outer edge
  const gap=5.4;B.box(cx,0,cz-S,2*S+T,H,T,wc,rk,{gy:0});B.box(cx-S,0,cz,T,H,2*S,wc,rk,{gy:0});B.box(cx+S,0,cz,T,H,2*S,wc,rk,{gy:0});
  {const sl=(2*S+T-gap)/2;B.box(cx-gap/2-sl/2,0,cz+S,sl,H,T,wc,rk,{gy:0});B.box(cx+gap/2+sl/2,0,cz+S,sl,H,T,wc,rk,{gy:0});B.box(cx,4.6,cz+S,gap+.1,H-4.6,T,wc,rk,{gy:4.6});
   B.door(cx,cz+S,0,gap,4.6,'x',1);B.box(cx-gap/2-.35,0,cz+S+.9,.7,5.6,.7,0x6a625a,'brick',{shadow:false});B.box(cx+gap/2+.35,0,cz+S+.9,.7,5.6,.7,0x6a625a,'brick',{shadow:false})}
  for(const s of[-1,1]){crenel(cx,H,cz+s*(S+T/2-.28),2*S,'x',wc);crenel(cx+s*(S+T/2-.28),H,cz,2*S,'z',wc)}
  bridge(cx,cz+S+6.4,12,5.2,'z');
  // corner towers with ladders
  for(const a of[-1,1])for(const b of[-1,1]){const tx=cx+a*S,tz=cz+b*S,th=13;B.box(tx,0,tz,7,th,7,0x8c857b,rk,{gy:0});B.box(tx,th,tz,8,.4,8,0x5a4f48,'concrete',{gy:th});
   for(const s of[-1,1]){B.box(tx,th+.4,tz+s*3.8,8,1,.4,wc,rk,{shadow:false});B.box(tx+s*3.8,th+.4,tz,.4,1,8,wc,rk,{shadow:false})}
   B.part('rock',{g:G('cone',3.2,3.4,4),p:[tx,th+2.9,tz],r:[0,Math.PI/4,0],c:0x4a3b36});
   const ix=-a,iz=-b;B.ladder(tx+ix*3.55,tz+iz*1.8,0,th,ix>0?'x+':'x-');lootAt(tx,th+.4,tz,-1);if(R()<.5)B.brChests.push([tx,th+.4,tz+1,0,-1]);B.spot(tx,th+.4,tz);
   B.box(tx+a*.2,th-4,tz+b*3.6,.12,2.4,1.1,[0xc0392b,0x2c3e90][(a+b)&1?0:1],'plain',{solid:false,shadow:false})}
  // wall walks: stairs inside the north wall to the wall top, loot up there
  B.stairs(cx-S+7.5,0,cz-S+T/2+1.1,'x+',24,H/24,.55,2,0x9aa0a6,'concrete');B.stairs(cx+S-7.5,0,cz-S+T/2+1.1+0,'x-',24,H/24,.55,2,0x9aa0a6,'concrete');
  lootAt(cx-10,H,cz-S,-1);lootAt(cx+10,H,cz-S,-1);B.brChests.push([cx,H,cz-S,0,-1]);B.spot(cx,H,cz-S);
  // keep, hall and courtyard clutter
  bld({x:cx,z:cz-4,w:16,d:13,h:7.5,c:0xb9a58c,tex:'brick',door:'s',loot:6,chest:1,win:0,rc:0x5a3b30,dg:3.2});
  bld({x:cx-14,z:cz+8,w:7,d:6,h:3.4,c:0xa9a094,tex:'brick',door:'e',loot:3,chest:.7,win:0,rc:0x4a4038});bld({x:cx+14,z:cz+8,w:7,d:6,h:3.4,c:0xa9a094,tex:'planks',door:'w',loot:3,chest:.7,win:0,rc:0x4a4038});
  B.cyl(cx,0,cz+10,1.2,1,0x8a8f98,'rock',{seg:10});for(const a of[-1,1])B.box(cx+a*1.1,1,cz+10,.15,1.8,.15,0x6d5232,'planks',{solid:false,shadow:false});B.box(cx,2.8,cz+10,3,.15,1.2,0x6d4c41,'planks',{solid:false,shadow:false});
  for(let i=0;i<9;i++){const x=cx+rr(-18,18),z=cz+rr(-3,18);if(isFree(x,z,2.5)&&Math.hypot(x-cx,z-cz-10)>3){if(i%2)B.barrel(x,z,pick([0x7a5230,0x2e86de]));else B.crate(x,z,1.2,0,0xc79a5c)}}
  B.stall(cx-8,cz+16,0,0xc0392b);B.stall(cx+9,cz+17,0,0x2c3e90);B.wreck(cx-16,cz-14,1,0x7f6a50);
  for(const a of[-1,1])for(let k=0;k<4;k++)lamp(cx+a*(S-2.4),cz-14+k*9,1.3);
  lootAt(cx,0,cz+14,-1);lootAt(cx-12,0,cz-10,-1);lootAt(cx+12,0,cz-10,-1);
  for(let k=0;k<6;k++)rock(cx+rr(-40,40),cz+rr(-14,2)-36,rr(1,2));for(let i=0;i<12;i++){const x=cx+rr(-46,46),z=cz+rr(-8,36)+10;if(isFree(x,z,3)&&Math.abs(x-cx)>30)pine(x,z,rr(.9,1.4))}
  block(cx,cz,2*S+8,2*S+8,6)}
 // ============ FOUNDRY (factory, E) ============
 {const cx=226,cz=-60;patch(cx,cz,84,76,'gravel',0xb0aca4,1);
  bld({x:cx-14,z:cz-6,w:34,d:22,h:9,c:0x9ba3ab,tex:'metal',door:'s',loot:8,chest:1,win:0,rc:0x4a5560,dg:5.2});bld({x:cx+22,z:cz-22,w:14,d:10,h:5,c:0xc8bfae,tex:'concrete',door:'w',loot:4,chest:.8,rc:0x5a6068});bld({x:cx+26,z:cz+16,w:12,d:9,h:4,c:0xb9a58c,tex:'brick',door:'w',loot:4,chest:.7});
  // smokestacks (ladder + top loot) and tanks
  for(let i=0;i<2;i++){const x=cx+14+i*9,z=cz+2;B.cyl(x,0,z,2.2,28,i?0xa8553f:0xb86a50,'brick',{seg:14,r2:1.7});B.box(x,28,z,5,.5,5,0x4a4a4a,'metal',{gy:28});B.ladder(x+2.2*.85,z,0,28,'x+');lootAt(x,28.5,z,-1);if(i===0)B.brChests.push([x,28.5,z+1.4,0,-1]);B.spot(x,28.5,z)}
  B.cyl(cx-46,0,cz+6,4.5,8,0x5a7a9a,'metal',{seg:20});B.cyl(cx-46,0,cz+18,4.5,8,0x5a7a9a,'metal',{seg:20});B.cyl(cx-46,0,cz-8,4.5,8,0x7a8a5a,'metal',{seg:20});
  // conveyor + pipes + crane + container yard + rails
  for(let k=0;k<5;k++)B.box(cx-28+k*6,0,cz+22,.3,1.6,.3,0x444a52,'metal',{shadow:false,solid:false});B.box(cx-16,1.6,cz+22,28,.35,1.6,0x2d3436,'metal',{solid:false,shadow:false});for(let k=0;k<6;k++)B.box(cx-28+k*5,1.95,cz+22,1.4,.5,1.2,0xc79a5c,'crate',{solid:false,shadow:false,local:true});
  for(let k=0;k<4;k++)B.box(cx-6+k*4,0,cz+34,.5,5,.5,0x888e96,'metal',{shadow:false});B.box(cx+2,5,cz+34,16,.7,.7,0xd0452a,'metal',{solid:false,shadow:false});
  B.crane(cx+34,cz-6,16,0,0xe0a020);
  for(let i=0;i<8;i++){const x=cx-36+(i%4)*8,z=cz-36+Math.floor(i/4)*3.2;B.container(x,z,i%2,pick([0xc0392b,0x2980b9,0x27ae60,0xf39c12,0x7f8c8d]));if(i%3===1){B.container(x,z,i%2,pick([0xc0392b,0x2980b9,0x27ae60]),2.6)}}
  for(let k=0;k<26;k++){B.box(cx-40+k*3,0,cz+42,.4,.12,2.6,0x6d5232,'planks',NS)}B.box(cx,.12,cz+41.3,78,.12,.2,0x8a8f98,'metal',NS);B.box(cx,.12,cz+42.7,78,.12,.2,0x8a8f98,'metal',NS);
  B.forklift(cx+2,cz+30,1);B.car(cx+36,cz+30,0,0x2980b9);B.wreck(cx-10,cz-40,0,0x7f8c8d);
  for(let i=0;i<12;i++){const x=cx+rr(-40,40),z=cz+rr(-36,36);if(isFree(x,z,2.5)){if(i%2)B.barrel(x,z,pick([0xc0392b,0xf39c12,0x2e86de]));else B.crate(x,z,1.3,0,0xc79a5c)}}
  road(150,-60,200,-60,6);B.brChests.push([cx-34,0,cz-34,0,-1],[cx+28,0,cz+38,0,-1]);block(cx,cz,0,0,0)}
 // ============ MAPLE VILLAGE (town, S edge) ============
 {const cx=110,cz=232;patch(cx,cz,30,26,'cobble',0xb8b0a4,1);road(56,cz,166,cz,6);road(cx,170,cx,cz,5,'dirt');
  const houses=[[-40,-14,9,8,'s'],[-24,-14,8,8,'s'],[24,-14,9,8,'s'],[40,-14,8,9,'s'],[-40,14,9,8,'n'],[-26,14,8,8,'n'],[26,14,9,8,'n'],[42,14,8,8,'n'],[-6,-24,10,8,'s'],[10,26,11,9,'n']];
  for(const[dx,dz,w,d,door]of houses)bld({x:cx+dx,z:cz+dz,w,d,h:R()<.4?5.8:3.4,door,loot:3,chest:.6,c:pick(PAL)});
  // church with bell tower
  bld({x:cx-8,z:cz+30,w:11,d:14,h:6,c:0xe8dcc8,tex:'plaster',door:'n',loot:4,chest:.9,win:1,rc:0x4a3b36,dg:3});{const x=cx+2.6,z=cz+30,h=16;B.box(x,0,z,4,h,4,0xe0d4bc,'plaster',{gy:0});B.part('rock',{g:G('cone',3,6,4),p:[x,h+3,z],r:[0,Math.PI/4,0],c:0x4a3b36});B.glow(x,h-3,z,1,1.4,.1,0xfff0c0);B.ladder(x,z-2.05,0,h,'z-');lootAt(x,h,z,-1);B.spot(x,h,z)}
  // square: well, planters, benches, stalls, lamps, cars
  B.cyl(cx,0,cz,1.4,1.1,0x8a8f98,'rock',{seg:12});B.box(cx,2.2,cz,3,.15,1.4,0x6d4c41,'planks',{solid:false,shadow:false});for(const a of[-1,1])B.box(cx+a*1.3,1.1,cz,.15,1.3,.15,0x6d5232,'planks',{solid:false,shadow:false});
  B.bench(cx-8,cz+3,0);B.bench(cx+8,cz-3,2);B.stall(cx-10,cz-8,0,0xc0392b);B.stall(cx+10,cz+8,2,0xf39c12);B.planter(cx-6,cz-8,2.2,2.2,1);B.planter(cx+6,cz+8,2.2,2.2,1);
  for(let i=0;i<8;i++)lamp(cx-42+i*12,cz+(i%2?5:-5),i%4);B.car(cx-28,cz+4,0,0xc0392b);B.car(cx+30,cz-4,2,0x2980b9);B.wreck(cx+50,cz+10,0,0x7f8c8d);
  for(let i=0;i<4;i++)fence(cx-44+i*28,cz+20,12,'x');
  for(let i=0;i<10;i++){const x=cx+rr(-56,56),z=cz+rr(-34,30);if(isFree(x,z,3))B.tree(x,z,rr(.9,1.3))}block(cx,cz,0,0,0)}
 // ============ MISTY LAKE (W edge) ============
 {const cx=-236,cz=36;for(const[px,pz,pw,pd]of[[cx+4,cz-24,76,14],[cx+4,cz+26,76,10],[cx-27,cz+2,14,38],[cx+37,cz+2,10,38]])patch(px,pz,pw,pd,'gravel',0xc9bd9a,1);water(cx+6,cz+2,52,38,0x2f86c8,.01);for(let k=0;k<5;k++)B.box(cx+6,.06,cz-14+k*7,52-k*2,.02,.6,0x9fd0f0,'plain',NS);
  B.box(cx+6,0,cz+2,24,.55,2.4,0x8a6a45,'planks',{gy:0,us:.5});lootAt(cx+18,.55,cz+2,-1);lootAt(cx-2,.55,cz+2,-1);B.brChests.push([cx+17,.55,cz+3,0,-1]);
  for(const[dx,dz,door]of[[-26,-14,'e'],[-24,14,'e'],[2,-30,'s'],[36,-16,'w'],[34,18,'w'],[2,30,'n']])bld({x:cx+dx,z:cz+dz,w:8.5,d:7.5,h:3.2,c:0x8a6a45,tex:'planks',door,loot:3,chest:.7,rc:0x4e3b2a,win:1});
  bld({x:cx+8,z:cz-34,w:14,d:8,h:4,c:0xd8c9a8,tex:'planks',door:'s',loot:5,chest:.9,rc:0x6d4c41});
  for(const[x,z,c]of[[cx-6,cz+10,0xe8e8e8],[cx+24,cz-8,0xc0392b]]){B.box(x,.05,z,4,1.1,9,c,'metal',{gy:.05});B.box(x,1.15,z-1,2.6,1.6,3,0xf4f4f4,'plaster',{gy:1.15})}
  road(-172,30,cx+32,30,4,'dirt');lamp(cx+20,cz+8,1);for(let i=0;i<40;i++){const x=cx+rr(-60,60),z=cz+rr(-52,56);if(isFree(x,z,2.4)&&!(x>cx-22&&x<cx+34&&z>cz-18&&z<cz+22)){if(i%3)pine(x,z,rr(.9,1.4));else B.tree(x,z,rr(.9,1.3))}}
  for(let i=0;i<8;i++){const a=R()*6.28;B.bush(cx+6+Math.cos(a)*28,cz+2+Math.sin(a)*22,rr(.8,1.2))}block(cx+4,cz,78,66,0)}
 // ============ FROSTPEAK (mountains, NW corner) ============
 {const cx=-222,cz=-218;patch(cx-4,cz+2,88,108,'gravel',0xeef3f7,1);const L=[[62,56,5],[46,42,5],[32,30,5],[20,18,5]];let y=0;const ys=[];L.forEach(([w,d,hh],i)=>{ys.push(y);B.box(cx,y,cz,w,hh,d,_c.set(0x8b8f96).multiplyScalar(1-i*.05).getHex(),'rock',{gy:y,us:.1});B.box(cx,y+hh,cz,w*.94,.07,d*.94,0xf4f7fa,'plain',{solid:false,shadow:false});y+=hh});
  L.forEach(([w,d,hh],i)=>{const n=Math.round(hh/.34),sh=hh/n,run=.5,len=run*n;if(i%2===0)B.stairs(cx+w/2+len,ys[i],cz+(i===2?4:-4),'x-',n,sh,run,2.4,0x9a9ea5,'rock');else B.stairs(cx+(i===3?-3:3),ys[i],cz+d/2+len,'z-',n,sh,run,2.4,0x9a9ea5,'rock')});
  const top=y;bld({x:cx,z:cz,w:9,d:8,h:3,c:0x6f757d,tex:'concrete',door:'s',stairs:0,loot:5,chest:1,rc:0x3f444a,win:0,y:top});
  bld({x:cx-36,z:cz+26,w:12,d:9,h:3.6,c:0x8a6a45,tex:'planks',door:'e',loot:4,chest:.9,rc:0xeeeeee});bld({x:cx+44,z:cz+22,w:9,d:8,h:3.2,c:0x8a6a45,tex:'planks',door:'w',loot:3,chest:.7,rc:0xeeeeee});
  lootAt(cx-20,5,cz+6,-1);lootAt(cx+14,10,cz+4,-1);lootAt(cx,15,cz+6,-1);B.brChests.push([cx-21,5,cz-6,0,-1],[cx+15,10,cz-5,0,-1],[cx+8,15,cz-5,0,-1]);B.spot(cx,top,cz);
  for(let i=0;i<18;i++){const a=R()*6.28,r=rr(34,60);const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(isFree(x,z,3))rock(x,z,rr(1.2,2.6))}
  for(let i=0;i<60;i++){const x=cx+rr(-66,66),z=cz+rr(-62,62);if(isFree(x,z,3)&&Math.hypot(x-cx,z-cz)>38){const s=rr(1,1.7);pine(x,z,s);B.part('plain',{g:G('cone',.85*s,1.1*s,8),p:[x,(1.7+2*1.15+.55)*s,z],c:0xf0f4f8,ao:false})}}
  road(-100,-120,-100,-215,4,'dirt');road(-100,-215,cx+36,-215,4,'dirt');block(cx,cz,70,64,0)}
 // ============ OLD GROWTH FOREST (SW corner) ============
 {const cx=-206,cz=204;patch(cx,cz,112,104,'forest',0xa09062,1);
  for(const[dx,dz,door]of[[-12,-14,'e'],[16,-6,'w'],[-2,16,'n'],[30,20,'w']])bld({x:cx+dx,z:cz+dz,w:8.5,d:7.5,h:3.2,c:0x6d4c41,tex:'planks',door,loot:4,chest:.8,rc:0x3e2f23,win:1});
  tower(cx-32,cz-24,11);tower(cx+30,cz+34,10);tower(cx-14,cz+40,9);
  for(let i=0;i<10;i++){const x=cx+rr(-52,52),z=cz+rr(-50,50);if(!isFree(x,z,6))continue;const h=rr(14,19);B.cyl(x,0,z,1,h,0x5d4037,'rock',{seg:8,r2:.7});for(let k=0;k<4;k++)B.part('leaves',{g:G('ico',rr(4,5.5),1),p:[x+rr(-2.4,2.4),h-1+k*1.6,z+rr(-2.4,2.4)],c:_c.set(pick([0x2f5d3a,0x2a5234,0x37683f])).getHex(),ao:false});B.shadows.push([x,z,6,6])}
  for(let i=0;i<230;i++){const x=cx+rr(-58,58),z=cz+rr(-56,56);if(isFree(x,z,2.2))pine(x,z,rr(.9,1.7))}
  for(let i=0;i<14;i++){const x=cx+rr(-50,50),z=cz+rr(-50,50);if(isFree(x,z,3))B.box(x,0,z,rr(4,6),.7,.7,0x6d4c41,'planks',{us:.5})}
  for(let i=0;i<14;i++){const x=cx+rr(-52,52),z=cz+rr(-50,50);if(isFree(x,z,2))rock(x,z,rr(.8,1.6))}
  B.cyl(cx+2,0,cz,.7,.3,0x4a4a4a,'rock',{solid:false});B.part('plain',{g:G('cone',.35,.9,6),p:[cx+2,.7,cz],c:0xff7a1a});B.glow(cx+2,.4,cz,.4,.5,.4,0xff9a3a);lootAt(cx,0,cz+2,-1);lootAt(cx+4,0,cz-1,-1);
  for(let i=0;i<6;i++){const x=cx+rr(-44,44),z=cz+rr(-44,44);if(isFree(x,z,2)){B.crate(x,z,1.1,0,0xc79a5c);lootAt(x+1.2,0,z,-1)}}
  road(-128,160,-128,204,4,'dirt');road(-128,204,cx+30,204,4,'dirt');block(cx,cz,0,0,0)}
 // ============ DUNE CAMP (SE corner) ============
 {const cx=232,cz=226;patch(cx-8,cz,76,84,'sand',0xe8d29a,1);
  bld({x:cx-14,z:cz-14,w:12,d:9,h:3.4,c:0xcdb89a,tex:'plaster',door:'s',loot:4,chest:.8,rc:0x8a6a45});bld({x:cx+22,z:cz+12,w:9,d:8,h:3.4,c:0xb9a58c,tex:'concrete',door:'w',loot:4,chest:.8,rc:0x5a6068});
  bld({x:cx-6,z:cz+26,w:10,d:8,h:3.2,c:0x6f757d,tex:'concrete',door:'n',loot:4,chest:1,rc:0x3f444a,win:0});
  // crashed cargo plane
  {const x=cx+8,z=cz-26;B.box(x,.4,z,24,3.4,3.6,0xd8dbe0,'metal',{us:.4});B.box(x-13,1.4,z,3,2,2.6,0xb0b4ba,'metal',{shadow:false});B.box(x+4,.5,z-9,3,.5,15,0xc0c4ca,'metal',{shadow:false});B.box(x+4,.5,z+9,3,.5,15,0xc0c4ca,'metal',{shadow:false,solid:false});B.box(x+12,3.6,z,3.5,4.5,.4,0xc0392b,'metal',{shadow:false});
   lootAt(x,3.8,z,-1);lootAt(x+6,3.8,z,-1);lootAt(x-14,0,z+4,-1);B.brChests.push([x+14,0,z+4,0,-1],[x-4,3.8,z,0,-1]);B.ladder(x,z+1.85,0,3.8,'z+')}
  for(let i=0;i<6;i++){const a=i/6*6.283,x=cx+Math.cos(a)*30,z=cz+Math.sin(a)*24;if(!isFree(x,z,3))continue;B.part('plain',{g:G('cone',2.4,2.6,4),p:[x,1.3,z],r:[0,a,0],c:pick([0xc9b48a,0xb8a37a,0xd9c9a8,0x9a6a4a])});B.cols.push({x0:x-1.5,x1:x+1.5,y0:0,y1:2.2,z0:z-1.5,z1:z+1.5});lootAt(x+2,0,z,-1)}
  for(let i=0;i<10;i++){const x=cx+rr(-44,44),z=cz+rr(-40,40);if(isFree(x,z,2.5))B.cactus(x,z,rr(.8,1.4))}for(let i=0;i<8;i++){const x=cx+rr(-44,44),z=cz+rr(-40,40);if(isFree(x,z,3))rock(x,z,rr(1,2))}
  B.container(cx-30,cz+4,0,0xf39c12);B.container(cx-30,cz+10,1,0x2980b9);B.car(cx+14,cz+28,1,0xf1c40f);B.wreck(cx+30,cz-12,0,0x8a6a45);
  for(let i=0;i<8;i++){const x=cx+rr(-40,40),z=cz+rr(-36,36);if(isFree(x,z,2.5)){if(i%2)B.barrel(x,z,pick([0xc0392b,0xf39c12]));else B.crate(x,z,1.2,0,0xc79a5c)}}
  road(140,108,232,108,5,'dirt');road(232,108,232,186,5,'dirt');block(cx,cz,0,0,0)}
 // ============ rivers, ponds and bridges ============
 {const z0=-188;water(-110,z0,140,7);water(-40,z0+3,10,13);water(-34,z0+9,22,12);bridge(-100,z0,10,4.6,'z');B.brChests.push([-96,0,z0+6,0,-1]);
    // east stream under a bridge near the Foundry road
  water(190,-80,5,100);bridge(190,-60,9,5,'x')}
 // outcrops
 for(const[x,z]of[[-180,-60],[150,-170],[190,160],[-60,-215],[40,200],[205,50],[-190,150],[170,-200]])for(let k=0;k<5;k++){const a=R()*6.28,r=rr(2,8);if(isFree(x+Math.cos(a)*r,z+Math.sin(a)*r,2))rock(x+Math.cos(a)*r,z+Math.sin(a)*r,rr(1,2.3))}
}
