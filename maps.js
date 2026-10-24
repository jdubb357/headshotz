// Original low-poly maps. Box: [x, y(bottom), z, w, h, d, color]
function B(){const a=[];const o={
  box(x,y,z,w,h,d,c){a.push([x,y,z,w,h,d,c]);return o},
  // stairs rising along dir ('x+','x-','z+','z-') from (x,z) at base y
  stairs(x,y,z,dir,n,stepH,run,width,c){for(let i=0;i<n;i++){const h=stepH*(i+1),off=run*i+run/2;
    if(dir==='x+')a.push([x+off,y,z,run,h,width,c]);if(dir==='x-')a.push([x-off,y,z,run,h,width,c]);
    if(dir==='z+')a.push([x,y,z+off,width,h,run,c]);if(dir==='z-')a.push([x,y,z-off,width,h,run,c]);}return o},
  border(sx,sz,h,c){a.push([0,0,-sz/2-0.5,sx+2,h,1,c],[0,0,sz/2+0.5,sx+2,h,1,c],[-sx/2-0.5,0,0,1,h,sz,c],[sx/2+0.5,0,0,1,h,sz,c]);return o},
  mirror(){const n=a.length;for(let i=0;i<n;i++){const b=a[i];if(Math.abs(b[0])<0.01&&Math.abs(b[2])<0.01)continue;a.push([-b[0],b[1],-b[2],b[3],b[4],b[5],b[6]])}return o},
  list:a};return o}

export const MAPS=[
(()=>{ // 1. Balanced mid arena
  const b=B();
  b.box(-12,0,-6,4,1.4,1,0xff9f43).box(-6,0,-12,1,2.2,5,0x48dbfb).box(-14,0,8,6,3,1,0xf368e0)
   .box(-6,0,4,2,1.2,2,0xfeca57).box(-3,0,12,6,2.5,1,0x1dd1a1).box(-16,0,-14,4,4,4,0x5f27cd)
   .box(-16,4,-14,1,1,4,0x5f27cd).stairs(-13,0,-16,'x+',5,0.8,0.8,2,0xc8d6e5)
   .box(-10,0,0,1,2.4,3,0xff6b6b);
  b.mirror();
  b.box(0,0,0,6,2,6,0x576574).box(0,2,0,4,0.4,4,0xfeca57).stairs(0,0,3,'z+',3,0.6,0.8,2,0xc8d6e5).stairs(0,0,-3,'z-',3,0.6,0.8,2,0xc8d6e5)
   .border(40,40,4,0xa29bfe);
  return {name:'Sunset Plaza',desc:'Balanced arena',ground:0x7bed9f,sky:0xffb88c,fog:[40,90],
    boxes:b.list,spawnsA:[[-17,0],[-17,5],[-15,-4],[-18,12]],spawnsB:[[17,0],[17,-5],[15,4],[18,-12]]}})(),
(()=>{ // 2. Vertical construction site
  const b=B();const st=0x95a5a6,yb=0xf1c40f,or=0xe67e22;
  // scaffold towers
  b.box(-10,0,-8,8,0.4,8,st).box(-10,0.4,-8,0.5,4,0.5,yb); // placeholder
  b.list.length=0;
  const tower=(x,z,lv)=>{for(let i=1;i<=lv;i++){b.box(x,i*3.2-0.3,z,8,0.3,8,i%2?st:0x7f8c8d)}
    for(const dx of[-3.8,3.8])for(const dz of[-3.8,3.8])b.box(x+dx,0,z+dz,0.4,lv*3.2,0.4,yb)};
  tower(-12,-10,3);tower(12,10,3);tower(-12,12,2);tower(12,-12,2);
  b.stairs(-7.5,0,-6,'x+',8,0.4,0.6,2,or).box(-2.6,0,-6,1.2,3.2,2,or); // to tower1 lvl1
  b.stairs(7.5,0,6,'x-',8,0.4,0.6,2,or).box(2.6,0,6,1.2,3.2,2,or);
  // inner ladders as stair blocks to upper levels
  b.stairs(-15,3.2,-13,'z+',8,0.4,0.6,1.6,or).stairs(15,3.2,13,'z-',8,0.4,0.6,1.6,or);
  b.stairs(-15,0,9,'z+',8,0.4,0.6,1.6,or).stairs(15,0,-9,'z-',8,0.4,0.6,1.6,or);
  // bridges between towers
  b.box(0,6.1,0,26,0.3,2,0x34495e);
  b.box(-12,6.1,1,2,0.3,14,0x34495e).box(12,6.1,-1,2,0.3,14,0x34495e);
  // ground clutter
  b.box(0,0,0,3,1.5,3,0xd35400).box(-4,0,10,6,1,1.5,0x2c3e50).box(4,0,-10,6,1,1.5,0x2c3e50)
   .box(0,0,-16,10,2,1,0xe74c3c).box(0,0,16,10,2,1,0xe74c3c).box(-18,0,0,1.5,1.5,6,0xd35400).box(18,0,0,1.5,1.5,6,0xd35400)
   .box(-6,0,0,2,3,0.5,0xbdc3c7).box(6,0,0,2,3,0.5,0xbdc3c7);
  b.border(44,40,6,0xf39c12);
  return {name:'Steel Frame',desc:'Vertical worksite',ground:0xc9a26b,sky:0x9fd3ff,fog:[45,100],
    boxes:b.list,spawnsA:[[-20,-3],[-20,3],[-18,-17],[-19,17]],spawnsB:[[20,3],[20,-3],[18,17],[19,-17]]}})(),
(()=>{ // 3. Long docks
  const b=B();const cols=[0xe74c3c,0x3498db,0x27ae60,0xf39c12,0x9b59b6];
  // pier deck is ground; water outside
  const C=(x,z,rot,c,stack)=>{const w=rot?2.5:6,d=rot?6:2.5;b.box(x,0,z,w,2.6,d,c);if(stack)b.box(x,2.6,z,w,2.6,d,cols[(cols.indexOf(c)+2)%5])};
  C(-28,-4,0,cols[0],1);C(-20,5,1,cols[1],0);C(-12,-6,0,cols[2],0);C(-8,7,0,cols[3],1);C(-2,-2,1,cols[4],0);
  C(28,4,0,cols[0],1);C(20,-5,1,cols[1],0);C(12,6,0,cols[2],0);C(8,-7,0,cols[3],1);C(2,2,1,cols[4],0);
  // crane platforms (sniper perches)
  for(const s of[-1,1]){b.box(s*36,0,-8,4,6,4,0xf1c40f).box(s*36,6,-8,4,1,0.3,0xf1c40f);
    b.stairs(s*36,0,-4,'z+',12,0.5,0.6,2,0x7f8c8d);}
  b.box(0,0,-11,30,1,0.6,0x7f8c8d).box(0,0,11,30,1,0.6,0x7f8c8d).box(-16,0,0,0.8,1.2,3,0x8e6e53).box(16,0,0,0.8,1.2,3,0x8e6e53);
  b.box(-24,0,-11,4,1.4,1,0x8e6e53).box(24,0,11,4,1.4,1,0x8e6e53);
  // low rails at edge of pier
  b.box(0,0,-12.6,84,0.5,0.3,0x5d4037).box(0,0,12.6,84,0.5,0.3,0x5d4037).box(-42.6,0,0,0.3,0.5,25,0x5d4037).box(42.6,0,0,0.3,0.5,25,0x5d4037);
  return {name:'Harbor Line',desc:'Long sightlines',ground:0xb08a5a,groundSize:[85,25.5],water:0x1e90ff,sky:0x87ceeb,fog:[60,140],
    boxes:b.list,spawnsA:[[-40,-6],[-40,6],[-38,0],[-35,10]],spawnsB:[[40,6],[40,-6],[38,0],[35,-10]]}})(),
(()=>{ // 4. Tight indoor hallways
  const b=B();const w=0xdfe6e9,h=3.2;
  b.border(32,24,h,0x636e72);
  // corridors grid walls with doorways
  const wallX=(x,z1,z2,gaps)=>{let z=z1;for(const g of[...gaps,z2+2]){const e=Math.min(g-1,z2);if(e>z)b.box(x,0,(z+e)/2,0.5,h,e-z,w);z=g+1}};
  const wallZ=(z,x1,x2,gaps)=>{let x=x1;for(const g of[...gaps,x2+2]){const e=Math.min(g-1,x2);if(e>x)b.box((x+e)/2,0,z,e-x,h,0.5,w);x=g+1}};
  wallX(-8,-12,12,[-7,3]);wallX(8,-12,12,[-3,7]);wallX(0,-12,12,[-9,0,9]);
  wallZ(-4,-16,16,[-12,-4,4,12]);wallZ(4,-16,16,[-12,-4,4,12]);
  // ceiling lights strips (decor, low) and furniture cover
  b.box(-12,0,-8,3,1,1.2,0xe17055).box(12,0,8,3,1,1.2,0xe17055).box(-4,0,8,1.2,1,3,0x00b894).box(4,0,-8,1.2,1,3,0x00b894)
   .box(-12,0,8,2,1.2,2,0x0984e3).box(12,0,-8,2,1.2,2,0x0984e3).box(-4,0,0,2,1,1,0xfdcb6e).box(4,0,0,2,1,1,0xfdcb6e);
  b.box(0,h,0,34,0.3,26,0x2d3436); // roof
  return {name:'Office Rush',desc:'Tight hallways',ground:0x74b9ff,sky:0x2d3436,fog:[20,40],indoor:true,
    boxes:b.list,spawnsA:[[-14,-10],[-14,10],[-14,0],[-11,-2]],spawnsB:[[14,10],[14,-10],[14,0],[11,2]]}})(),
(()=>{ // 5. Big canyon map
  const b=B();const r=0xc0703a,r2=0xa0522d;
  // forts
  for(const s of[-1,1]){const x=s*40;
    b.box(x,0,0,10,4,0.8,s<0?0x3fa9ff:0xff5a5a).box(x,0,-8,0.8,4,8,r2).box(x,0,8,0.8,4,8,r2);
    b.box(x+s*4,0,0,4,3,10,r2).box(x+s*4,3,0,4,0.3,10,0x8d6e63).stairs(x+s*4,0,-9,'z+',6,0.5,0.6,2,0xbcaaa4);}
  // mesas
  b.box(0,0,0,10,5,10,r).stairs(0,0,5,'z+',10,0.5,0.7,2.4,0xd7ccc8).stairs(0,0,-5,'z-',10,0.5,0.7,2.4,0xd7ccc8)
   .box(0,5,0,2,1,6,r2);
  const rocks=[[-20,-20,6,3,8],[20,20,6,3,8],[-18,22,8,2,5],[18,-22,8,2,5],[-28,-36,10,6,6],[28,36,10,6,6],[0,-34,14,4,4],[0,34,14,4,4],
    [-10,12,3,1.5,3],[10,-12,3,1.5,3],[-30,14,2,2,6],[30,-14,2,2,6],[-12,-30,4,2.5,4],[12,30,4,2.5,4]];
  for(const k of rocks)b.box(k[0],0,k[1],k[2],k[3],k[4],k[3]>3?r:r2);
  b.stairs(-28,0,-31,'z+',8,0.6,0.6,2,0xd7ccc8).stairs(28,0,31,'z-',8,0.6,0.6,2,0xd7ccc8);
  for(let i=0;i<10;i++){const x=(i-4.5)*9;b.box(x,0,-24-((i*7)%5),1.2,1.2,1.2,0x2ecc71).box(-x,0,24+((i*7)%5),1.2,1.2,1.2,0x2ecc71)}
  b.border(100,90,6,0x8d5524);
  return {name:'Canyon Fort',desc:'Big map, 8 players',ground:0xe1b382,sky:0xffd8a8,fog:[60,150],
    boxes:b.list,spawnsA:[[-46,-3],[-46,3],[-44,-10],[-44,10],[-47,0]],spawnsB:[[46,3],[46,-3],[44,10],[44,-10],[47,0]]}})(),
];
