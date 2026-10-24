// HeadShotz v7 maps: multi-level, climbable (ladders + stairs), with foliage/interior hiding spots. Original designs.
export function newDefs({G,rng,_c,facade}){
// ---- shared helpers (operate on Builder B) ----
const slab=(B,x,top,z,w,d,c,tex='concrete')=>B.box(x,top-.3,z,w,.3,d,c,tex,{gy:top-.3});
// hollow room: walls .3 thick, door gaps (1.8 wide) on sides listed in doors ('n'=+z,'s'=-z,'e'=+x,'w'=-x); optional roof slab
function room(B,x,z,w,d,h,c,tex,doors='',roof=true,y=0,rc){const t=.3,dg=1.8;
 const wallX=(zz,side)=>{if(doors.includes(side)){const s=(w-dg)/2;B.box(x-w/2+s/2,y,zz,s,h,t,c,tex,{gy:y});B.box(x+w/2-s/2,y,zz,s,h,t,c,tex,{gy:y});B.box(x,y+2.3,zz,dg,h-2.3,t,c,tex,{gy:y})}else B.box(x,y,zz,w,h,t,c,tex,{gy:y})};
 const wallZ=(xx,side)=>{if(doors.includes(side)){const s=(d-dg)/2;B.box(xx,y,z-d/2+s/2,t,h,s,c,tex,{gy:y});B.box(xx,y,z+d/2-s/2,t,h,s,c,tex,{gy:y});B.box(xx,y+2.3,z,t,h-2.3,dg,c,tex,{gy:y})}else B.box(xx,y,z,t,h,d,c,tex,{gy:y})};
 wallX(z+d/2-t/2,'n');wallX(z-d/2+t/2,'s');wallZ(x+w/2-t/2,'e');wallZ(x-w/2+t/2,'w');
 // window strips (decor)
 for(const s of[-1,1])B.box(x,y+1.3,z+s*(d/2+.02),w*.5,.7,.04,0xffffff,'window',{solid:false,shadow:false,local:true});
 if(roof)slab(B,x,y+h+.3,z,w+.4,d+.4,rc??_c.set(c).multiplyScalar(.7).getHex(),'concrete');return B}
const parapet=(B,x,y,z,w,d,c=0x9aa0a6,tex='metal')=>B.box(x,y,z,w,1,d,c,tex,{gy:y,shadow:false});
const pine=(B,x,z,s=1)=>{B.cyl(x,0,z,.2*s,1.2*s,0x5d4037,'rock',{seg:6});for(let i=0;i<3;i++)B.part('leaves',{g:G('cone',(1.7-i*.45)*s,1.7*s,8),p:[x,(1.6+i*1.05)*s,z],c:i===2?0xeef4f8:0x2f5d3a});B.cols.push({x0:x-.5*s,x1:x+.5*s,y0:0,y1:4*s,z0:z-.5*s,z1:z+.5*s});B.shadows.push([x,z,3*s,3*s])};
const sandbags=(B,x,z,q,len=3)=>{const L=B.at(x,z,q);for(let i=0;i<Math.round(len/.6);i++)for(let r=0;r<2;r++)L.box(-len/2+.3+i*.6+(r?.3:0),r*.4,0,.58,.4,.5,0xb8a57a,'sand',{solid:false,shadow:false});L.box(0,0,0,len,.85,.55,0,'plain',{ao:false});B.T.plain.pop()};
const vine=(B,x,z,y0,y1,n)=>B.ladder(x,z,y0,y1,n,0x3e7d32);
const tank=(B,x,z,r,h,c)=>{B.cyl(x,0,z,r,h,c,'metal',{seg:20,us:.5});for(let y=1.5;y<h;y+=1.8)B.part('metal',{g:G('cyl',r+.04,r+.04,.08,20),p:[x,y,z],c:_c.set(c).multiplyScalar(.8).getHex()});B.part('metal',{g:G('cyl',r*.96,r,.5,20),p:[x,h+.25,z],c:_c.set(c).multiplyScalar(.9).getHex()});};
const pipeRun=(B,x,y,z,len,ax,c=0x8d99a6,r=.28)=>{B.part('metal',{g:G('cyl',r,r,len,10),p:[x,y,z],r:ax==='x'?[0,0,Math.PI/2]:[Math.PI/2,0,0],c});};
const D=[];
// ===================== 1. ABANDONED MALL =====================
D.push({name:'Abandoned Mall',wallH:14,desc:'2 floors, escalators, stores',icon:'🛍️',size:[70,48],ground:['tiles',0xc9c4b8,.35],grade:[1.02,1,.98,1.06,1.05],horizon:'city',
 sky:[0x5b6f8a,0xc9b79c,0xd8c7aa],fog:[0xb9ab96,40,120],hemi:[0xfff4e6,0x6b5f55,1.45],sun:[0xfff0d6,1.6,[.35,.85,.3]],
 build(B){const wall=0xd8d0c2,flr=0xb7b0a3,gal=4.2,shopC=[0xc0392b,0x2980b9,0x27ae60,0x8e44ad,0xd35400,0x16a085];
  for(const s of[-1,1]){B.box(0,0,s*24.4,70,8.5,.8,0xcfc6b6,'plaster',{us:.3});B.box(s*35.4,0,0,.8,8.5,48,0xcfc6b6,'plaster',{us:.3})}
  // upper galleries (north & south) + central bridge
  for(const s of[-1,1]){slab(B,0,gal,s*18,70,12,flr,'tiles');parapet(B,-18.5,gal,s*12.2,33,.25,0x8a8f98);parapet(B,18.5,gal,s*12.2,33,.25,0x8a8f98);
   for(let x=-30;x<=30;x+=10){B.box(x,0,s*12.3,.7,gal-.3,.7,0xe8e2d6,'plaster')}}
  slab(B,0,gal,0,4,24.4,flr,'tiles');for(const sx of[-1,1])parapet(B,sx*2.1,gal,0,.2,24.4,0x8a8f98);
  // ground-floor stores under galleries (walls between, open fronts with counters) and upper stores along outer walls
  for(const s of[-1,1])for(let i=0;i<6;i++){const x=-27.5+i*11,zc=s*18.5,c=shopC[(i+(s>0?0:3))%6];
   B.box(x+5.35,0,zc,.3,gal-.3,11,wall,'plaster');B.box(x,0,s*12.9,8,1,.6,c,'planks');B.box(x,2.9,s*12.6,9,.6,.2,c,'plain',{solid:false,shadow:false});B.glow(x,3.05,s*12.48,4,.3,.03,0xfff3c4);
   for(const k of[-1,1])B.box(x+k*2.8,0,zc+s*2,1.2,2.1,4,0x7f8c8d,'metal',{us:.6});// shelves = cover
   B.crate(x-1,zc-s*1.5,1,0,0xbfa27a);
   // upper floor stores
   B.box(x+5.35,gal,s*19,.3,3.2,10,wall,'plaster',{gy:gal});B.box(x,gal,s*13.4,7,1,.5,c,'planks',{gy:gal});B.box(x+2.5,gal,s*20,1.2,2.1,3,0x95a5a6,'metal',{gy:gal});
   B.cyl(x-2,gal,s*16,.25,1.8,0xf5e6d3,'plain',{seg:8,gy:gal});B.part('plain',{g:G('sph',.22,8,6),p:[x-2,gal+2,s*16],c:0xf5e6d3})}
  // escalators (stairs) both sides + a service stair
  B.stairs(-20,0,4.6,'z+',12,.35,.55,2.2,0x95a5a6,'metal');B.stairs(20,0,-4.6,'z-',12,.35,.55,2.2,0x95a5a6,'metal');
  for(const[x,z,dz]of[[-20,8,1],[20,-8,-1]]){for(const s of[-1.2,1.2])B.box(x+s,0,z,.15,1.1,6.6,0x2d3436,'metal',{solid:false,shadow:false,gy:0})}
  // ladders (service): on gallery support pillars
  B.ladder(10,11.95,0,gal,'z-');B.ladder(-10,-11.95,0,gal,'z+');B.ladder(-30,11.95,0,gal,'z-');B.ladder(30,-11.95,0,gal,'z+');
  // atrium: dry fountain, planters with hedges (hide), kiosks, debris
  B.cyl(0,0,0,3.4,.7,0xbdc3c7,'concrete',{seg:24});B.cyl(0,.7,0,.6,2.2,0x95a5a6,'concrete',{seg:12});B.part('concrete',{g:G('cyl',1.6,1.2,.4,16),p:[0,2.4,0],c:0xbdc3c7});
  for(const[x,z]of[[-9,-6],[9,6],[-26,6],[26,-6],[-14,0],[14,0]]){B.box(x,0,z,3.2,.6,3.2,0xa1887f,'brick');B.hedge(x,z,3,3,1.9,0x4c8c3a,.6)}
  for(const[x,z,c]of[[-6,6,0xe67e22],[6,-6,0x3498db],[-32,-2,0x9b59b6],[32,2,0x1abc9c]])B.stall(x,z,0,c);
  for(const[x,z,q]of[[-17,-3,0],[17,3,1],[-4,-9,1],[4,9,0]])B.bench(x,z,q);
  B.box(-24,0,-7,4,.5,1.2,0x7f8c8d,'metal');B.box(-24,.5,-7,3.4,1.4,.15,0x2c3e50,'plain',{solid:false});B.glow(-24,.7,-6.9,3,1,.02,0x7fd3ff);// fallen sign
  for(const[x,z]of[[-12,-9],[12,9],[-29,-9],[29,9],[0,10.5],[0,-10.5]])B.crate(x,z,1.2);
  // broken roof frame (open sky) + skylight beams
  for(let x=-30;x<=30;x+=10)B.box(x,9,0,.5,.5,48,0x6d6d6d,'metal',{solid:false,shadow:false});for(let z=-20;z<=20;z+=10)B.box(0,9.3,z,70,.3,.3,0x6d6d6d,'metal',{solid:false,shadow:false});
  for(const s of[-1,1])B.box(0,7.4,s*24,70,1.6,.6,0xb3aa9a,'plaster',{solid:false,shadow:false});
  // nav spots on the galleries/bridge
  for(const x of[-28,-14,0,14,28])for(const s of[-1,1])B.spot(x,gal,s*15);B.spot(0,gal,0)},
 spawnsA:[[-31,-4],[-31,0],[-31,4],[-28,-2],[-28,2],[-33,0]],spawnsB:[[31,4],[31,0],[31,-4],[28,2],[28,-2],[33,0]],spawnsM:[[0,-6],[0,6],[-16,-8],[16,8],[-27,18],[27,-18],[-5,-18],[5,18],[-22,0],[22,0]]});
// ===================== 2. SNOWY OUTPOST =====================
D.push({name:'Snowy Outpost',wallH:14,desc:'Cabins, radar tower, frozen lake',icon:'❄️',size:[90,80],ground:['sand',0xeef2f6,.14],grade:[.97,1,1.06,1.08,1.04],horizon:'mountains',
 grass:[],sky:[0x7d9fc2,0xdfe8f0,0xeef3f8],fog:[0xdfe7ef,45,150],hemi:[0xf0f6ff,0x8a99aa,1.5],sun:[0xfff6ea,1.7,[-.5,.55,.4]],
 build(B){const log=0x7b5136,snow=0xf4f7fa,ice=0xbfe3f5;
  // frozen lake (flat, slick look) with ice cracks + fishing huts
  B.part('tiles',{g:G('cyl',13,13,.04,40),p:[0,.02,0],c:ice});for(let i=0;i<7;i++){const a=i*.9;B.part('plain',{g:G('box',.06,.01,6+i%3*2),p:[Math.cos(a)*4,.05,Math.sin(a)*4],r:[0,a,0],c:0xe8f6ff})}
  room(B,-5,4,3,3,2.6,0x8d6e63,'planks','e');room(B,6,-5,3,3,2.6,0x6d4c41,'planks','w');B.ladder(-5,5.65,0,2.9,'z+');B.ladder(6,-6.65,0,2.9,'z-');B.spot(-5,2.9,4);B.spot(6,2.9,-5);
  // cabins each side (enterable, roof reachable by ladder)
  for(const s of[-1,1]){const x=s*34;room(B,x,-12,8,6,3.2,log,'planks',s<0?'e':'w');room(B,x,12,8,6,3.2,log,'planks',s<0?'en':'ws');
   for(const z of[-12,12]){B.ladder(x+s*4.15,z+2,0,3.5,s<0?'x-':'x+');B.box(x,3.5,z,8.6,.25,6.6,snow,'plain',{solid:false,shadow:false});B.spot(x,3.5,z);
    B.crate(x-1.5,z-1.5,1);B.box(x+2,0,z+1.6,1.6,.9,.8,0x5d4037,'planks');B.hedge(x-s*6,z+4,3,1.4,1.5,0x2f5d3a)}
   // watchtower with ladder at spawn side
   const wx=s*40;for(const a of[-1.2,1.2])for(const b of[-1.2,1.2])B.box(wx+a,0,b,.3,6,.3,log,'planks',{solid:false});B.box(wx,0,0,1,6,1,log,'planks');slab(B,wx,6,0,3.6,3.6,0x8d6e63,'planks');
   for(const[a,b,w,d]of[[0,1.7,3.6,.2],[0,-1.7,3.6,.2],[-s*1.7,0,.2,3.6]])B.box(wx+a,6,b,w,1,d,log,'planks',{gy:6});B.box(wx+s*1.7,0,0,.2,6,1.2,log,'planks',{shadow:false});B.ladder(wx+s*1.85,0,0,6,s<0?'x-':'x+');B.spot(wx,6,0);
   sandbags(B,s*24,-4,1,4);sandbags(B,s*24,4,1,4);for(const z of[-26,26])B.barrel(s*22,z,0x2d6a4f);B.box(s*18,0,s*-20,6,2.4,2.4,0x4a6572,'metal',{us:.6})}
  // radar tower (centre north): 2 platforms, ladders
  const rx=0,rz=26;for(const a of[-2,2])for(const b of[-2,2])B.box(rx+a,0,rz+b,.35,10,.35,0x95a5a6,'metal',{solid:false});B.box(rx,0,rz,1.4,10,1.4,0x7f8c8d,'metal');
  for(const y of[5,10]){slab(B,rx,y,rz,5,5,0x7f8c8d,'metal');for(const[a,b,w,d]of[[0,2.45,5,.15],[0,-2.45,5,.15],[2.45,0,.15,5]])B.box(rx+a,y,rz+b,w,1,d,0xb0bec5,'metal',{gy:y,solid:true,shadow:false});B.spot(rx,y,rz)}
  B.ladder(rx-.7,rz,0,5,'x-');B.box(rx-1.5,5,rz+1.5,.8,5,.8,0x7f8c8d,'metal',{gy:5});B.ladder(rx-1.9,rz+1.5,5,10,'x-');
  B.part('metal',{g:G('cyl',2.4,2.4,.25,20),p:[rx,12,rz],r:[.5,0,0],c:0xdfe6e9});B.cyl(rx,10,rz,.15,2,0x636e72,'metal',{solid:false,shadow:false});B.glow(rx,12.6,rz,.3,.3,.3,0xff4040);
  // radar south: generator shed + fuel
  room(B,0,-26,10,6,3.4,0x546e7a,'metal','ns');B.ladder(-3,-29.15,0,3.7,'z-');B.spot(0,3.7,-26);for(const x of[-3,3])B.barrel(x,-21,0xc0392b);
  // pine forest + snow rocks (cover), hedges = snowy bushes (hide)
  const r=rng(77);for(let i=0;i<60;i++){const a=r()*6.28,d=22+r()*20;const x=Math.cos(a)*d*1.0,z=Math.sin(a)*d*.85;if(Math.abs(x)>28&&Math.abs(x)<42&&Math.abs(z)<18)continue;if(Math.abs(x)<5&&Math.abs(z)>20)continue;pine(B,x,z,.8+r()*.6)}
  for(const[x,z,w,h,d]of[[-16,-10,4,1.6,3],[16,10,4,1.6,3],[-14,14,3,2,5],[14,-14,3,2,5],[0,-14,6,1.2,2],[0,14,6,1.2,2],[-24,0,2,1.4,6],[24,0,2,1.4,6]])B.rock(x,z,w,h,d,0xcfd8dc);
  for(const[x,z]of[[-18,-2],[18,2],[-10,20],[10,-20],[-26,-22],[26,22]])B.hedge(x,z,3.2,2,1.9,0x3b6b4a)},
 spawnsA:[[-40,-6],[-40,6],[-37,-3],[-37,3],[-43,-4],[-43,4]],spawnsB:[[40,6],[40,-6],[37,3],[37,-3],[43,4],[43,-4]],spawnsM:[[0,-18],[0,18],[-20,-12],[20,12],[-30,0],[30,0],[-12,30],[12,-32],[10,8],[-10,-8]]});
// ===================== 3. JUNGLE TEMPLE =====================
D.push({name:'Jungle Temple',wallH:14,desc:'Ruins, vines, rope bridges',icon:'🌿',size:[80,80],ground:['grass',0x5f8f3a,.2],grade:[.98,1.03,.95,1.12,1.05],horizon:'mountains',
 grass:[{on:['grass'],count:3200,color:0x4f8a32,height:1}],sky:[0x5f93b8,0xd9e6c2,0xbfd8a8],fog:[0xa8c49a,35,120],hemi:[0xeaffdc,0x4a5a32,1.45],sun:[0xfff0c8,1.6,[.4,.7,-.3]],
 build(B){const st=0x9e9a86,st2=0x7d7a68,moss=0x4f7a3a;
  // central stepped pyramid: 3 tiers, stairs N/S, vines E/W, shrine on top
  const tiers=[[16,2.5],[11,5],[6.5,7.5]];for(const[w,h]of tiers)B.box(0,0,0,w,h,w,st,'rock',{us:.3});
  B.stairs(0,0,8,'z+',5,.5,.6,3,st2,'rock');B.stairs(0,0,-8,'z-',5,.5,.6,3,st2,'rock');// to tier1 (2.5)
  B.stairs(0,2.5,5.5,'z+',5,.5,.5,2.4,st2,'rock');B.stairs(0,2.5,-5.5,'z-',5,.5,.5,2.4,st2,'rock');// tier2 (5)
  B.stairs(0,5,3.25,'z+',5,.5,.45,2,st2,'rock');// tier3 (7.5)
  vine(B,8,3,0,2.5,'x+');vine(B,-8,-3,0,2.5,'x-');vine(B,5.5,-2,2.5,5,'x+');vine(B,-5.5,2,2.5,5,'x-');vine(B,-3.25,-1.5,5,7.5,'x-');
  for(const a of[-1,1])for(const b of[-1,1])B.box(a*2.4,7.5,b*2.4,.7,3,.7,st2,'rock',{gy:7.5});slab(B,0,10.8,0,6,6,st,'rock');
  for(const[x,z]of[[0,0],[5,5],[-5,-5],[0,6],[0,-6]])B.spot(x,x===0&&z===0?7.5:x?5:2.5,z);
  // ruined walls & broken pillars ring (cover)
  const r=rng(9);for(let i=0;i<18;i++){const a=i/18*6.283+.17,d=17+(i%2)*3;const x=Math.cos(a)*d,z=Math.sin(a)*d;if(i%3===0)B.box(x,0,z,.9,1.5+r()*3,.9,st2,'rock');else B.at(x,z,i&1).box(0,0,0,4+r()*2,.8+r()*1.6,.8,st,'rock',{us:.4})}
  // two watch towers per side linked by rope bridge (planks) at 4.5m
  for(const s of[-1,1]){const tx=s*24;for(const tz of[-14,14]){B.box(tx,0,tz,3.4,4.5,3.4,st,'rock',{us:.3});vine(B,tx-s*1.7,tz,0,4.5,s<0?'x+':'x-');B.spot(tx,4.5,tz);
     for(const[a,b,w,d]of[[0,1.6,3.4,.2],[0,-1.6,3.4,.2]])B.box(tx+a,4.5,tz+b+(b>0?0:0),w,.7,d,st2,'rock',{gy:4.5,solid:b*tz<0})}
   // bridge between the two towers (solid planks, rope rails decor)
   B.box(tx,4.25,0,1.6,.25,24.6,0x8d6e3f,'planks',{gy:4.25,shadow:false});for(const k of[-.8,.8])B.box(tx+k,5.2,0,.06,.06,24.6,0xc8a878,'plain',{solid:false,shadow:false});for(let z=-11;z<=11;z+=2.2)for(const k of[-.8,.8])B.box(tx+k,4.5,z,.06,.7,.06,0xc8a878,'plain',{solid:false,shadow:false});
   B.spot(tx,4.5,0);
   // spawn shrine (small hut) + hedge cover
   room(B,s*34,0,6,8,3,st2,'rock',s<0?'e':'w');B.ladder(s*37.15,2.5,0,3.3,s<0?'x-':'x+');B.spot(s*34,3.3,0);
   for(const z of[-8,8])B.hedge(s*30,z,3,3,1.9,moss)}
  // dense jungle: trees + undergrowth hedges (hiding) + logs
  for(let i=0;i<46;i++){const a=r()*6.283,d=26+r()*12;B.tree(Math.cos(a)*d,Math.sin(a)*d*.95,1.2+r()*.6,0x3c7a30)}
  for(const[x,z,w,d]of[[-12,-14,4,2.5],[12,14,4,2.5],[-14,10,2.5,4],[14,-10,2.5,4],[0,-20,5,2],[0,20,5,2],[-20,-26,3,3],[20,26,3,3],[-28,22,3,3],[28,-22,3,3],[-6,28,3,2],[6,-28,3,2]])B.hedge(x,z,w,d,2,moss);
  for(const[x,z,q]of[[-10,-24,0],[10,24,0],[-26,8,1],[26,-8,1]])B.at(x,z,q).cyl(0,0,0,.45,.8,0x6d4c41,'planks',{seg:8});
  for(const[x,z]of[[-9,-9],[9,9],[-9,9],[9,-9]]){B.box(x,0,z,2,1.2,.6,st,'rock');B.crate(x+1.5,z,1,0,0x9c7b4a)}},
 spawnsA:[[-34,-6],[-34,6],[-31,-10],[-31,10],[-37,-8],[-37,8]],spawnsB:[[34,6],[34,-6],[31,10],[31,-10],[37,8],[37,-8]],spawnsM:[[0,-12],[0,12],[-12,0],[12,0],[-20,-20],[20,20],[-20,20],[20,-20],[0,-30],[0,30]]});
// ===================== 4. ROOFTOPS CITY =====================
D.push({name:'Rooftops',wallH:14,desc:'Jumpable roofs, fire escapes',icon:'🏙️',size:[72,60],ground:['asphalt',0x5a5f66,.3],grade:[1,1,1.04,1.1,1.06],horizon:'city',
 sky:[0x3b5b8c,0xffb88a,0xffd8a8],fog:[0xd8a890,50,150],hemi:[0xfff0e0,0x5a5060,1.4],sun:[0xffd0a0,1.8,[-.6,.45,.35]],
 build(B){const cols2=[0xb5651d,0x9c8f80,0x7f8c8d,0xa0522d,0x8e7d6b,0x6d7b8d];
  // building grid: [x,z,w,d,h]; gaps <=2.2m between similar roofs so they're jumpable, planks bridge the bigger gaps
  const bl=[[-22,-16,10,10,4.5],[-10,-16,10,10,6],[2,-16,10,10,4.5],[14,-16,10,8,7.5],[-22,16,10,10,6],[-10,16,10,10,4.5],[2,16,10,10,7.5],[14,16,10,8,4.5],[-4,0,8,8,3.2]];
  bl.forEach(([x,z,w,d,h],i)=>{const c=cols2[i%6];facade(B,x,z,w,h,d,c,'z');
   // roof props: AC unit, vent, water tank, chimney (cover)
   const rr=rng(i*11+3);B.box(x-w/4,h,z+(rr()-.5)*d*.4,1.6,1,1.2,0xbdc3c7,'metal',{gy:h});B.box(x+w/4,h,z-d/4,.8,1.6,.8,0x7f8c8d,'brick',{gy:h});
   if(i%3===0){for(const a of[-.6,.6])for(const b of[-.6,.6])B.box(x+w/4+a,h,z+d/4+b,.12,1.4,.12,0x5d4037,'planks',{gy:h,solid:false});B.cyl(x+w/4,h+1.4,z+d/4,1,1.6,0x8d6e63,'planks',{seg:12,gy:h+1.4})}
   for(const s of[-1,1])B.box(x,h,z+s*(d/2-.1),w,.5,.2,_c.set(c).multiplyScalar(.75).getHex(),'concrete',{gy:h,shadow:false});
   B.spot(x,h,z)});
  // fire escapes: balcony + ladders on street-facing walls (z faces toward the street at z=0)
  for(const[x,z,h,n]of[[-22,-11,4.5,'z+'],[-10,-11,6,'z+'],[2,-11,4.5,'z+'],[14,-12,7.5,'z+'],[-22,11,6,'z-'],[-10,11,4.5,'z-'],[2,11,7.5,'z-'],[14,12,4.5,'z-']]){
   const s=n==='z+'?1:-1;B.ladder(x+2.5,z,0,h,n,0x2d3436);for(let y=2.6;y<h-.5;y+=2.6){B.box(x-1,y,z+s*.6,3,.12,1.2,0x2d3436,'metal',{gy:y,solid:false,shadow:false});B.box(x-1,y+.9,z+s*1.2,3,.05,.05,0x2d3436,'metal',{solid:false,shadow:false})}}
  // planks between rooftops of different blocks
  B.box(-16,5.75,-16,2.2,.25,1.4,0x8d6e3f,'planks',{gy:5.75,shadow:false});B.box(-16,5.75,16,2.2,.25,1.4,0x8d6e3f,'planks',{gy:5.75,shadow:false});
  B.box(-4,4.25,-8,1.4,.25,6.4,0x8d6e3f,'planks',{gy:4.25,shadow:false});// low roof to block
  // stairs from street up to the low centre roof (3.2) and a ramp of crates
  B.stairs(-4,0,4.6,'z+',0,0,0,0,0);
  
  B.stairs(-8.6,0,-1,'x-',8,.4,.6,2.2,0x95a5a6,'concrete');
  B.crate(5,2,1.4);B.crate(5,3.4,1.4,0);B.crate(6.4,2.5,1.4,0);B.box(5.7,1.4,2.7,1.4,1.4,1.4,0xd2a56a,'crate',{gy:1.4,local:true});
  // street: cars, dumpsters, barriers, park with hedges (hide)
  for(const[x,z,q,c]of[[-28,-4,1,0xc0392b],[-16,4,0,0x2980b9],[8,-4,0,0xf1c40f],[24,4,1,0x27ae60],[30,-6,1,0x8e44ad]])B.car(x,z,q,c);
  for(const[x,z]of[[-27,-10],[-5,-10.5],[8,10.5],[20,-10.5]]){B.box(x,0,z,2,1.4,1.2,0x2e7d32,'metal',{us:.5});B.box(x,1.4,z,2.1,.1,1.3,0x1b5e20,'metal',{solid:false,shadow:false})}
  for(const z of[-24,24])for(let x=-30;x<=30;x+=12)B.lamp(x,z*.85,4.2,z>0?3:1);
  B.box(28,0,0,12,.2,22,0x4f7a3a,'grass',{solid:false,shadow:false});for(const[x,z]of[[26,-6],[30,4],[26,8],[31,-2]])B.hedge(x,z,3,2.4,1.9,0x3e8e41);B.tree(29,-9,1.1);B.tree(25,2,1);
  for(const[x,z]of[[-33,0],[-33,-8],[-33,8]])B.barrier(x,z,1,3)},
 spawnsA:[[-32,-3],[-32,3],[-30,0],[-34,-5],[-34,5],[-30,-6]],spawnsB:[[33,-12],[33,12],[22,-1],[22,1],[34,-20],[34,20]],spawnsM:[[0,-6],[0,6],[-16,0],[12,0],[-28,24],[28,-24],[-28,-24],[20,24],[-2,26],[2,-26]]});
// ===================== 5. OIL REFINERY =====================
D.push({name:'Oil Refinery',wallH:14,desc:'Tanks, catwalks, pipes',icon:'🛢️',size:[90,70],ground:['sand',0xc8ab7d,.14],grade:[1.05,1,.92,1.12,1.06],horizon:'mountains',
 sky:[0x6a9ccc,0xffd9a0,0xf4d2a0],fog:[0xe4c89a,55,160],hemi:[0xfff2dc,0x8a6a4a,1.35],sun:[0xffe4b8,2,[.5,.6,-.4]],
 build(B){const tc=[0xe0e0d8,0xd35400,0x95a5a6],cat=6;
  // 4 big tanks + catwalk ring between them (6m), ladders on tank fronts
  const T4=[[-12,-10],[12,-10],[-12,10],[12,10]];T4.forEach(([x,z],i)=>{tank(B,x,z,4,cat,tc[i%3]);B.ladder(x+(x<0?3.45:-3.45),z,0,cat,x<0?'x+':'x-',0x5d6d7e);B.spot(x,cat,z)});
  for(const z of[-10,10])B.box(0,cat-.3,z,16.2,.3,1.6,0x7f8c8d,'metal',{gy:cat-.3,shadow:false});for(const x of[-12,12])B.box(x,cat-.3,0,1.6,.3,12.2,0x7f8c8d,'metal',{gy:cat-.3,shadow:false});
  for(const z of[-10,10])for(const s of[-1,1])B.box(0,cat+.9,z+s*.8,16,.06,.06,0xf1c40f,'metal',{solid:false,shadow:false});
  B.spot(0,cat,-10);B.spot(0,cat,10);B.spot(-12,cat,0);B.spot(12,cat,0);
  // centre: pump house with roof access stairs
  room(B,0,0,8,6,3.5,0x7f8c8d,'metal','ns');B.ladder(4.15,0,0,3.8,'x+');B.spot(0,3.8,0);
  // pipe racks (low pipes = jumpable cover, high pipes decor), valves
  for(const s of[-1,1]){const z=s*22;for(let x=-32;x<=32;x+=8){B.box(x,0,z,.3,3.2,.3,0x5d6d7e,'metal',{solid:false})}pipeRun(B,0,3.3,z,66,'x',0xb0bec5,.35);pipeRun(B,0,3.3,z+.8,66,'x',0xd35400,.25);
   B.box(0,0,z-2.2,30,.7,.6,0x95a5a6,'metal',{us:.5});pipeRun(B,0,.35,z-2.2,30,'x',0xa0a8b0,.32);
   for(const x of[-10,10]){B.cyl(x,.7,z-2.2,.15,.5,0xc0392b,'metal',{solid:false,shadow:false})}}
  // flare stack + distillation column with ladder (tall perch)
  B.cyl(-30,0,24,.9,16,0x95a5a6,'metal',{seg:12});B.glow(-30,16,24,.5,.8,.5,0xff8c2a);
  B.cyl(30,0,-24,1.8,10,0xbdc3c7,'metal',{seg:14});B.box(32.1,0,-24,.2,8,1.2,0x7f8c8d,'metal',{shadow:false});B.ladder(32.25,-24,0,8,'x+');slab(B,30,8,-24,4.4,4.4,0x7f8c8d,'metal');for(const[a,b,w,d]of[[0,2.1,4.4,.15],[0,-2.1,4.4,.15],[-2.1,0,.15,4.4]])B.box(30+a,8,-24+b,w,1,d,0xf1c40f,'metal',{gy:8,shadow:false});B.spot(30,8,-24);
  // spawns: offices + containers + trucks; control room on stilts with stairs
  for(const s of[-1,1]){room(B,s*38,0,6,10,3.2,0xecf0f1,'plaster',s<0?'e':'w');B.ladder(s*34.85,-3,0,3.5,s<0?'x+':'x-');B.spot(s*38,3.5,0);
   B.container(s*28,-14,1,s<0?0x2e86de:0xc0392b);B.container(s*28,14,1,s<0?0x27ae60:0xf39c12);B.container(s*28,14,1,0x8e44ad,2.6);B.ladder(s*28-s*1.3,17.2,0,5.2,'z+',0x34495e);B.spot(s*28,5.2,14);
   B.wreck(s*20,s*-26,0,0x7f8c8d);B.forklift(s*20,s*2,0);for(const z of[-6,6])B.barrel(s*24,z,0x34495e);sandbags(B,s*22,-8,1,3);sandbags(B,s*22,8,1,3)}
  for(const[x,z]of[[-20,-30],[20,30],[-36,-28],[36,28],[0,-31],[0,31]])B.hedge(x,z,3,2,1.7,0x7a8a4a);
  for(let i=0;i<10;i++){const x=-27+i*6;B.crate(x,(i%2?1:-1)*30,1.2)}},
 spawnsA:[[-40,-8],[-40,8],[-36,-10],[-36,10],[-42,-12],[-42,12]],spawnsB:[[40,8],[40,-8],[36,10],[36,-10],[42,12],[42,-12]],spawnsM:[[0,-6],[0,6],[-20,0],[20,0],[-24,-18],[24,18],[0,-26],[0,26],[-30,-12],[30,12]]});
return D}
