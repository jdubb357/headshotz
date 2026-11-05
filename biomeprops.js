// HeadShotz v91: biome set-dressing for the Battle Royale island. Everything is built from the same merged primitives as the rest of the map
// (textured parts + one merged emissive "glow" mesh), so it stays cheap on iPhone. Original geometry, no third-party assets.
export function biomeProps(X){const{B,G,rr,pick,isFree,block,zones}=X;const Z={};for(const z of zones)Z[z.n]=z;
 const P=(tex,g,x,y,z,c,r,s)=>B.part(tex,{g,p:[x,y,z],r,s,c});
 const GL=(g,x,y,z,c,r,s)=>B.glows.push({g,p:[x,y,z],r,s,c});
 const spot=(z,min,max,m=2.5)=>{for(let i=0;i<16;i++){const a=rr(0,6.283),d=rr(min,max)*z.r,x=z.x+Math.cos(a)*d,zz=z.z+Math.sin(a)*d;if(isFree(x,zz,m))return[x,zz]}return null};
 const many=(n,z,min,max,m,fn)=>{if(!z)return;for(let i=0;i<n;i++){const p=spot(z,min,max,m);if(p)fn(p[0],p[1],i)}};
 const col=(x,z,hw,h,hd,tex='rock')=>B.cols.push({x0:x-hw,x1:x+hw,y0:0,y1:h,z0:z-hd,z1:z+hd,s:tex});
 const tilt=()=>rr(-.35,.35);
 // glowing crystal cluster (cone spikes)
 const crystal=(x,z,h,cs,solid,rockc=0x2e2540)=>{const n=3+(rr(0,3)|0);P('rock',G('dode',h*.3),x,h*.08,z,rockc,[0,rr(0,3),0],[1.2,.5,1.2]);
  for(let k=0;k<n;k++){const hh=h*(k?rr(.45,.85):1),w=hh*rr(.1,.16),tx=tilt()*(k?1:.3),tz=tilt()*(k?1:.3),dx=k?rr(-1,1)*h*.22:0,dz=k?rr(-1,1)*h*.22:0;GL(G('cone',w,hh,5),x+dx,hh/2*.96,z+dz,pick(cs),[tx,rr(0,3),tz])}
  if(solid){col(x,z,h*.16,h*.6,h*.16);block(x,z,h*.4,h*.4,1)}};
 // ===== Nebula Realm: crystal clusters, floating rocks with glowing undersides, star pillars
 many(15,Z['Nebula Realm'],.15,.95,3,(x,z)=>crystal(x,z,rr(2,6.5),[0xb36bff,0x7fd8ff,0xff7be8,0x9a7bff],true));
 many(12,Z['Nebula Realm'],.1,1,4,(x,z)=>{const y=rr(6,15),s=rr(1.2,3.2);P('rock',G('dode',s),x,y,z,pick([0x4a3a7a,0x3a2a66,0x5a4a8a]),[rr(0,3),rr(0,3),0],[1,.6,1]);GL(G('cone',s*.45,s*1.1,5),x,y-s*.7,z,pick([0xb36bff,0x7fd8ff]),[Math.PI,0,0]);GL(G('ico',s*.18),x+s*.4,y+s*.55,z,0xff9bf0)});
 many(5,Z['Nebula Realm'],.3,.85,3,(x,z)=>{GL(G('cyl',.18,.18,13,5),x,6.5,z,0xc78bff);GL(G('ico',.7),x,13.4,z,0xffffff);GL(G('tor',1.4,.07,4,14),x,13.4,z,0x7fd8ff,[Math.PI/2.4,0,0])});
 // ===== Inferno Forge: lava pools, obsidian spires, glowing chimneys
 many(9,Z['Inferno Forge'],.15,.95,5,(x,z)=>{const w=rr(4,10),d=rr(3,8);B.box(x,0,z,w+1,.14,d+1,0x1a1210,'rock',{solid:false,shadow:false});GL(G('box',w,.06,d),x,.14,z,pick([0xff5a14,0xff7a1a,0xff3a08]));GL(G('box',w*.5,.05,d*.5),x,.2,z,0xffd060);block(x,z,w,d,0)});
 many(12,Z['Inferno Forge'],.1,1,3,(x,z)=>{const h=rr(2.5,7);P('rock',G('cone',h*.22,h,5),x,h/2,z,0x15100e,[tilt(),rr(0,3),tilt()]);GL(G('cone',h*.05,h*.35,4),x,h*.92,z,0xff6a1a);col(x,z,h*.12,h*.7,h*.12);block(x,z,h*.3,h*.3,1)});
 many(5,Z['Inferno Forge'],.3,.9,3,(x,z)=>{B.cyl(x,0,z,1.1,9,0x3a2a24,'brick',{seg:8});GL(G('cyl',1.15,1.05,.25,8),x,9.1,z,0xff5a14);GL(G('cone',.9,1.6,6),x,9.8,z,0xffa030)});
 // ===== Golden Savanna: acacia trees, hay bales, termite mounds, dry grass tufts
 many(12,Z['Golden Savanna'],.1,1,3.5,(x,z)=>{const h=rr(4,6.5);B.cyl(x,0,z,.28,h,0x6a4a2a,'rock',{seg:6,r2:.2});P('plain',G('cyl',h*.62,h*.5,.9,9),x,h+.2,z,pick([0x6a8a2a,0x7a9a30,0x8a9a38]),[0,0,0],[1,1,.85])});
 many(14,Z['Golden Savanna'],.1,1,2.5,(x,z)=>{B.part('plain',{g:G('cyl',.75,.75,1.4,10),p:[x,.7,z],r:[0,0,Math.PI/2],c:0xd8b44a});B.cols.push({x0:x-.7,x1:x+.7,y0:0,y1:1.4,z0:z-.7,z1:z+.7,s:'dirt'});});
 many(10,Z['Golden Savanna'],.1,1,2,(x,z)=>{const h=rr(1.5,3);P('dirt',G('cone',h*.5,h,7),x,h/2,z,0xa06a3a);col(x,z,h*.25,h*.7,h*.25,'dirt')});
 // ===== Moonlit Lagoon: glowing orb lanterns, drifting jelly-lights, a huge moon
 many(16,Z['Moonlit Lagoon'],.1,1,2.5,(x,z)=>{const h=rr(2.5,4.5);B.cyl(x,0,z,.09,h,0x203a4a,'metal',{seg:5,solid:false,shadow:false});GL(G('ico',.38,1),x,h+.35,z,pick([0x3ee0d0,0x9ff0ff,0x7fb0ff]));GL(G('tor',.55,.04,4,12),x,h+.35,z,0xbafcff,[Math.PI/2,0,0])});
 many(8,Z['Moonlit Lagoon'],.1,1,3,(x,z)=>{const y=rr(3,8),s=rr(.45,.9);GL(G('sph',s,8,5),x,y,z,pick([0x20c8c0,0x3a7aff,0x6a5aff]),[0,0,0],[1,.55,1]);for(let k=0;k<4;k++)GL(G('cyl',.03,.03,s*2.4,3),x+Math.cos(k*1.6)*s*.5,y-s*1.2,z+Math.sin(k*1.6)*s*.5,0x3ee0d0)});
 {const z=Z['Moonlit Lagoon'];if(z)GL(G('sph',34,16,10),z.x-140,150,z.z+210,0xe8f6ff)}
 // ===== Thunder Isle: lightning rods with coil rings, wet slate boulders
 many(7,Z['Thunder Isle'],.1,.95,3,(x,z)=>{B.cyl(x,0,z,.22,15,0x3a4252,'metal',{seg:6});for(const y of[3,6,9])GL(G('tor',.8,.07,4,12),x,y,z,0x8fb0ff,[Math.PI/2,0,0]);GL(G('ico',.5,1),x,15.4,z,0xe8f0ff);block(x,z,1,1,1)});
 many(10,Z['Thunder Isle'],.1,1,3,(x,z)=>{const s=rr(1,2.6);P('rock',G('dode',s),x,s*.55,z,0x39414f,[rr(0,3),rr(0,3),0],[1,.75,1]);col(x,z,s*.6,s*1.1,s*.6)});
 // ===== Crystal Caverns: giant crystal spires
 many(20,Z['Crystal Caverns'],.1,.95,3.5,(x,z)=>crystal(x,z,rr(3,10),[0x4fe8ff,0xff8fe8,0xffffff,0x8a9aff],true,0x1e2a4a));
 // ===== Aurora Ridge: ice spires and glowing shards
 many(16,Z['Aurora Ridge'],.1,.95,3,(x,z)=>{const h=rr(2.5,8);P('plain',G('cone',h*.2,h,5),x,h/2,z,pick([0xcfeaff,0xb8dcf5,0xe4f4ff]),[tilt(),rr(0,3),tilt()]);col(x,z,h*.12,h*.6,h*.12);block(x,z,h*.3,h*.3,1)});
 many(9,Z['Aurora Ridge'],.1,1,3,(x,z)=>crystal(x,z,rr(1.8,4.2),[0x5affb0,0xb08aff,0x4ad8ff],false,0xcfe0ee));
 // ===== Firefly Hollow: giant glowing mushrooms
 many(20,Z['Firefly Hollow'],.1,1,2.5,(x,z)=>{const h=rr(1.5,5),cr=h*rr(.5,.8),cc=pick([0xff5ad0,0x4ae8ff,0xb86aff,0x9aff4a]);P('plain',G('cyl',h*.1,h*.14,h,6),x,h/2,z,0xe8e0c8);P('plain',G('sph',cr,10,6),x,h,z,_dim(cc),[0,0,0],[1,.5,1]);GL(G('sph',cr*.8,8,4),x,h+cr*.1,z,cc,[0,0,0],[1,.38,1]);if(h>3){col(x,z,.4,h,.4);block(x,z,1.2,1.2,1)}});
 // ===== Phantom Keep: gravestones, broken pillars, ghost torches
 many(20,Z['Phantom Keep'],.1,1,2,(x,z)=>{const h=rr(1,2.4);B.box(x,0,z,.9,h,.25,0x59646c,'cobble',{});if(rr(0,1)<.4)GL(G('box',.5,.05,.05),x,h*.6,z+.14,0x9affc8)});
 many(8,Z['Phantom Keep'],.1,.95,3,(x,z)=>{B.cyl(x,0,z,.45,rr(2,4),0x636e76,'cobble',{seg:8})});
 many(9,Z['Phantom Keep'],.1,1,2,(x,z)=>{B.cyl(x,0,z,.07,1.6,0x2a3238,'metal',{seg:5,solid:false,shadow:false});GL(G('cone',.22,.7,5),x,1.9,z,0x9affc8);GL(G('ico',.12),x,2.5,z,0xc29aff)});
 // ===== Rust Valley: scrap piles, barrels, giant cogs
 many(16,Z['Rust Valley'],.1,1,3,(x,z)=>{for(let k=0;k<3;k++)B.box(x+rr(-1,1),rr(0,.4),z+rr(-1,1),rr(1,2.4),rr(.6,1.4),rr(1,2.2),pick([0x8a4a28,0x6a3a20,0x9a5a30]),'metal',{});});
 many(14,Z['Rust Valley'],.1,1,1.5,(x,z)=>B.cyl(x,0,z,.45,1.1,pick([0x9a4a20,0x5a6a5a]),'metal',{seg:8}));
 many(4,Z['Rust Valley'],.3,.9,4,(x,z)=>{P('metal',G('tor',2.2,.5,6,10),x,2.4,z,0x7a4a2a,[0,rr(0,3),Math.PI/2*.1]);col(x,z,2.4,4.6,.6,'metal')});
 // ===== Blossom Village: cherry trees, paper lanterns, torii gates
 many(16,Z['Blossom Village'],.1,1,3,(x,z)=>{const h=rr(3,4.5);B.cyl(x,0,z,.22,h,0x5a3a2a,'rock',{seg:6});for(let k=0;k<4;k++)P('plain',G('ico',rr(1.3,2),1),x+rr(-1.3,1.3),h+rr(-.3,.9),z+rr(-1.3,1.3),pick([0xff9bc8,0xffb7d5,0xff8fc0,0xffd0e4]))});
 many(12,Z['Blossom Village'],.1,1,2,(x,z)=>{B.cyl(x,0,z,.07,2.6,0x3a2a22,'metal',{seg:5,solid:false,shadow:false});GL(G('sph',.34,8,5),x,2.8,z,pick([0xff3a3a,0xffd060]),[0,0,0],[1,1.3,1])});
 many(2,Z['Blossom Village'],.25,.8,6,(x,z)=>{for(const s of[-2.4,2.4])B.cyl(x+s,0,z,.28,5.5,0xc02828,'planks',{seg:8});B.box(x,5.2,z,7.4,.45,.6,0xc02828,'planks',{solid:false});B.box(x,4.4,z,6,.3,.4,0x222222,'planks',{solid:false})});
 // ===== Toxic Swamp: dead trees, toxic barrels, slime pools, glowing fungus
 many(14,Z['Toxic Swamp'],.1,1,3,(x,z)=>{const h=rr(3,6);B.cyl(x,0,z,.28,h,0x2e2a22,'rock',{seg:5,r2:.12});for(let k=0;k<3;k++)P('rock',G('cyl',.05,.12,2.2,4),x,h*.7+k*.2,z,0x2e2a22,[rr(-1.1,1.1),k*2,rr(-1.1,1.1)])});
 many(12,Z['Toxic Swamp'],.1,1,1.6,(x,z)=>{B.cyl(x,0,z,.42,1,0x4a5a2a,'metal',{seg:8});GL(G('cyl',.36,.36,.08,8),x,1.02,z,0x8aff3a);GL(G('box',.3,.4,.02),x,.3,z+.43,0xd8ff3a)});
 many(10,Z['Toxic Swamp'],.1,1,4,(x,z)=>{const w=rr(3,7);B.box(x,0,z,w+.6,.1,w*.8+.6,0x1a2a10,'rock',{solid:false,shadow:false});GL(G('box',w,.05,w*.8),x,.1,z,pick([0x8aff3a,0x9aff5a]));block(x,z,w,w*.8,0)});
 // ===== Frostbite Peaks: ice spikes, snowy boulders, snowmen
 many(18,Z['Frostbite Peaks'],.1,1,3,(x,z)=>{const h=rr(2,6.5);P('plain',G('cone',h*.2,h,5),x,h/2,z,pick([0xd8f0ff,0xb8e0fa,0xeaf8ff]),[tilt(),rr(0,3),tilt()]);col(x,z,h*.12,h*.6,h*.12);block(x,z,h*.3,h*.3,1)});
 many(10,Z['Frostbite Peaks'],.1,1,3,(x,z)=>{const s=rr(1,2.4);P('plain',G('dode',s),x,s*.5,z,0xf4f8fc,[rr(0,3),rr(0,3),0],[1,.7,1]);col(x,z,s*.6,s,s*.6)});
 many(4,Z['Frostbite Peaks'],.2,.9,2.5,(x,z)=>{P('plain',G('sph',.9,10,7),x,.8,z,0xffffff);P('plain',G('sph',.65,10,7),x,2,z,0xffffff);P('plain',G('sph',.45,10,7),x,2.9,z,0xffffff);P('plain',G('cone',.09,.5,5),x,2.9,z+.45,0xff8a1a,[Math.PI/2,0,0]);col(x,z,.8,2.4,.8)});
 // ===== Jungle Ruins: vine pillars, ferns, ancient glyph stones, waterfall
 many(16,Z['Jungle Ruins'],.1,1,2.5,(x,z)=>{const h=rr(2.5,6);B.box(x,0,z,1.1,h,1.1,0x7a8a6a,'cobble',{});B.box(x+.1,h*.3,z+.57,.5,h*.7,.08,0x2f9a3a,'plain',{solid:false,shadow:false});if(rr(0,1)<.5)GL(G('box',.4,.05,.02),x,h*.6,z+.56,0x6aff9a)});
 many(24,Z['Jungle Ruins'],.05,1,1.5,(x,z)=>{for(let k=0;k<5;k++)P('plain',G('cone',.18,rr(1.4,2.4),4),x,.8,z,pick([0x2f9a3a,0x48b45a,0x1f7a38]),[rr(-.9,.9),k*1.3,rr(-.9,.9)])});
 {const z=Z['Jungle Ruins'];if(z){const cx=z.x-z.r*.55,cz=z.z-z.r*.45;B.box(cx,0,cz,14,13,5,0x6a7a5a,'rock',{});B.box(cx,0,cz+3.3,11,.2,4.5,0x2a7ab0,'plain',{solid:false,shadow:false});GL(G('box',11,.05,4.4),cx,.22,cz+3.3,0x6fd0ff);for(let k=0;k<7;k++)GL(G('box',.5,12.4,.12),cx-5+k*1.65,6.3,cz+2.55,pick([0xcfeeff,0x9ad8ff,0xeaf8ff]));B.box(cx,9.5,cz+1,10,.5,3,0x2f9a3a,'plain',{solid:false})}}
 // ===== Sandstorm Dunes: cacti, great dunes, bleached ribs, obelisk
 many(18,Z['Sandstorm Dunes'],.1,1,2,(x,z)=>{const h=rr(1.6,3.4);B.cyl(x,0,z,.28,h,0x4a8a3a,'plain',{seg:7});if(h>2){P('plain',G('cyl',.17,.17,1.1,6),x+.6,h*.55,z,0x4a8a3a,[0,0,Math.PI/2]);P('plain',G('cyl',.17,.17,.9,6),x+1.1,h*.55+.5,z,0x4a8a3a)}});
 many(8,Z['Sandstorm Dunes'],.2,1,6,(x,z)=>{const w=rr(10,22),h=rr(2.5,4.5);P('sand',G('sph',w,12,6),x,0,z,0xe2b266,[0,0,0],[1,h/w,.8])});
 many(3,Z['Sandstorm Dunes'],.3,.9,4,(x,z)=>{for(let k=0;k<5;k++)P('plain',G('tor',1.4,.14,4,10,Math.PI),x+k*.9,0,z,0xefe6cf,[0,Math.PI/2,0],[.8,1.1,1])});
 {const z=Z['Sandstorm Dunes'];if(z){const x=z.x+z.r*.5,zz=z.z-z.r*.5;if(isFree(x,zz,3)){B.box(x,0,zz,2.2,.8,2.2,0x9a7a4a,'rock',{});B.part('rock',{g:G('cone',1.4,9,4),p:[x,5.3,zz],r:[0,.78,0],c:0xc09a5a});GL(G('cone',.12,.6,4),x,9.9,zz,0xffe08a);block(x,zz,3,3,1)}}}
 // ===== Neon City: neon signs, glowing arches, puddles
 many(18,Z['Neon City'],.12,.95,2.5,(x,z)=>{const h=rr(3,5.5),c=pick([0xff3df0,0x35e0ff,0xff8a3d,0x8aff4a,0xffee3a]);B.cyl(x,0,z,.09,h,0x1a1a26,'metal',{seg:5,solid:false,shadow:false});const a=rr(0,3.14);B.part('plain',{g:G('box',1.9,.9,.12),p:[x,h+.4,z],r:[0,a,0],c:0x14141e});GL(G('box',1.7,.7,.14),x,h+.4,z,c,[0,a,0]);GL(G('box',1.2,.08,.16),x,h+.4,z,0xffffff,[0,a,0])});
 many(16,Z['Neon City'],.1,1,2,(x,z)=>{const w=rr(2.5,6),d=rr(2,4);B.box(x,0,z,w,.04,d,0x0a0c18,'plain',{solid:false,shadow:false});GL(G('box',w*.7,.03,.12),x,.05,z-d*.15,pick([0xff3df0,0x35e0ff]));GL(G('box',w*.5,.03,.1),x,.05,z+d*.2,pick([0x8a3dff,0xff8a3d]))});
 many(3,Z['Neon City'],.3,.9,5,(x,z)=>{const c=pick([0xff3df0,0x35e0ff]);for(const s of[-3,3]){B.cyl(x+s,0,z,.3,7,0x181826,'metal',{seg:6});GL(G('box',.1,6.6,.1),x+s,.2,z+.32,c)}B.box(x,7,z,7,.5,.5,0x181826,'metal',{solid:false});GL(G('box',6.4,.18,.55),x,7.1,z,c);block(x,z,7,1,1)});
}
function _dim(c){const r=(c>>16&255)*.45,g=(c>>8&255)*.45,b=(c&255)*.45;return(r<<16)|(g<<8)|b|0}
