// Map dressing: props, decals, signage, landmarks and ambient emitters, placed only where free.
import {G,rng} from './gfx.js';
export function dress(B,d,q){
 const[sx,sz]=d.size,hx=sx/2-1.5,hz=sz/2-1.5,R=rng((d.name||'x').length*977+sx*31+sz),lo=q===0,hi=q>=2;
 const sp=[...(d.spawnsA||[]),...(d.spawnsB||[]),...(d.spawnsM||[])];
 const fx=B.fxs;
 // footprint free? (no low solid overlap, away from spawns and ladders, inside the map)
 const free=(x,z,r,clr=3)=>{if(Math.abs(x)>hx-r||Math.abs(z)>hz-r)return false;
  for(const c of B.cols)if(c.y0<2.2&&c.y1>.05&&x+r>c.x0-.6&&x-r<c.x1+.6&&z+r>c.z0-.6&&z-r<c.z1+.6)return false;
  for(const s of sp)if(Math.hypot(s[0]-x,s[1]-z)<clr+r)return false;
  for(const l of B.ladders){const lx=(l.x0??l.x??0)+((l.x1??l.x0??0)-(l.x0??0))/2,lz=(l.z0??l.z??0)+((l.z1??l.z0??0)-(l.z0??0))/2;if(Math.hypot(lx-x,lz-z)<3+r)return false}
  for(const n of B.nav||[]){const nx=n.x??n[0],nz=n.z??n[1];if(nx!=null&&Math.hypot(nx-x,nz-z)<1.2+r)return false}
  return true};
 const groundAt=(x,z)=>{for(const c of B.cols)if(c.y1<.7&&c.y1>.05&&x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1)return -1;return 0};
 const tryN=(n,r,fn,tries=40)=>{let k=0;for(let t=0;t<tries*n&&k<n;t++){const x=(R()*2-1)*hx,z=(R()*2-1)*hz;if(free(x,z,r)&&groundAt(x,z)===0){fn(x,z,R);k++}}return k};
 const nd={solid:false,shadow:false};
 // --- decals (flat, never solid): puddles, oil, cracks, painted lines
 const indoor=!!d.indoor,snow=/Snow/.test(d.name),jungle=/Jungle/.test(d.name);
 tryN(lo?6:14,1.2,(x,z,r)=>{const w=.8+r()*2.2,t=r();const c=snow?0xdfe9f2:t<.4?0x2b3138:t<.7?0x3b3226:0x4a4a4a;B.box(x,.004,z,w,.012,w*(.4+r()*.6),c,'plain',nd)},30);
 if(!indoor&&!jungle&&!snow)tryN(lo?3:8,2,(x,z,r)=>{const L=B.at(x,z,r()*Math.PI);L.box(0,.006,0,2.6,.012,.18,0xf1c40f,'plain',nd);L.box(0,.006,.5,2.6,.012,.18,0xf1c40f,'plain',nd)},30);
 // --- debris: tiny loose bits (step-over size, not solid)
 if(!lo)tryN(hi?26:14,.6,(x,z,r)=>{for(let k=0;k<4;k++){const s=.08+r()*.22;B.box(x+(r()-.5)*1.2,0,z+(r()-.5)*1.2,s*1.5,s,s,jungle?0x6b6450:snow?0x9aa5ad:0x77736b,'rock',nd)}},30);
 // --- clutter: crates/barrels/pallets/tires (solid, collision = visual box)
 tryN(lo?3:6,1,(x,z,r)=>{const t=r();if(t<.35){B.crate(x,z,1.1);if(r()<.5)B.crate(x+.15,z-.1,.8,1.1)}else if(t<.65){B.barrel(x,z,[0x2e86de,0xc0392b,0x27ae60,0x7f8c8d][r()*4|0])}
  else if(t<.85){B.box(x,0,z,1.2,.15,1.2,0x9c7a4b,'planks');B.box(x,.15,z,1.2,.12,1.2,0x8a6a3e,'planks')}else{for(let k=0;k<3;k++)B.cyl(x,k*.28,z,.38,.28,0x1c1c1c,'plain',{seg:12,solid:k===0,gy:k*.28});B.cols.push({x0:x-.35,x1:x+.35,y0:0,y1:.84,z0:z-.35,z1:z+.35,s:'plain'})}});
 // --- perimeter signage + wall pipes + lights (on the boundary walls, above head height, not solid)
 if(!indoor&&!d.pier){const SC=[0xff3d71,0x00e5ff,0xffd166,0x7cff6b,0xb388ff];
  for(let i=0;i<(lo?2:5);i++){const side=i%4,c=SC[i%5],t=(R()*.8-.4);const[x,z,rot]=side===0?[t*sx,-sz/2+.12,0]:side===1?[t*sx,sz/2-.12,0]:side===2?[-sx/2+.12,t*sz,1]:[sx/2-.12,t*sz,1];
   const w=3+R()*3;if(rot){B.box(x,4.6,z,.12,1.3,w+.3,0x222831,'metal',nd);B.glow(x+(side===2?.08:-.08),4.75,z,.04,1,w,c)}else{B.box(x,4.6,z,w+.3,1.3,.12,0x222831,'metal',nd);B.glow(x,4.75,z+(side===0?.08:-.08),w,1,.04,c)}}
  if(!lo)for(const s of[-1,1]){const z=s*(sz/2-.25);B.part('metal',{g:G('cyl',.13,.13,sx-4,8),p:[0,3.3,z],r:[0,0,Math.PI/2],c:0x6b7a80})}
  tryN(lo?2:5,.4,(x,z)=>{B.lamp(x,z,4.2,0)},20)}
 // --- per-map landmarks
 const nm=d.name||'';
 const place=(r,fn,cands)=>{for(const[x,z]of cands)if(free(x,z,r,2)){fn(x,z);return true}return tryN(1,r,fn,200)>0};
 if(/Sunset/.test(nm)){place(1.6,(x,z)=>{B.cyl(x,0,z,1.6,.45,0xd8cfc0,'concrete',{seg:18});B.box(x,.45,z,2.6,.02,2.6,0x3fa7d6,'plain',nd);B.cyl(x,.45,z,.25,1.6,0xd8cfc0,'concrete',{seg:10});B.cyl(x,2.05,z,.7,.15,0xd8cfc0,'concrete',{seg:14,solid:false});fx.push({k:'mist',x,y:2.2,z})},[[0,0],[0,8],[8,0]])}
 if(/Steel/.test(nm)){place(1.5,(x,z)=>{B.box(x,0,z,1.4,1.4,1.4,0x2f3640,'metal');B.glow(x,1.4,z,.9,.06,.9,0xff7a00);fx.push({k:'steam',x,y:1.5,z})},[[0,0],[10,10],[-10,-10]])}
 if(/Harbor/.test(nm)){fx.push({k:'mist',x:0,y:.4,z:-sz/2+2},{k:'mist',x:0,y:.4,z:sz/2-2})}
 if(/Office/.test(nm)){fx.push({k:'dust',x:0,y:2.5,z:0})}
 if(/Canyon/.test(nm)){place(1.2,(x,z)=>{for(let a=0;a<6;a++)B.rock(x+Math.cos(a)*.9,z+Math.sin(a)*.9,.5,.35,.5,0x6d5a4a);B.glow(x,.05,z,.7,.25,.7,0xff8c1a);fx.push({k:'smoke',x,y:.4,z},{k:'fire',x,y:.2,z})},[[0,0],[6,6],[-6,-6]])}
 if(/Mall/.test(nm)){for(let i=0;i<(lo?3:7);i++){const x=-28+i*9.3,c=[0xe74c3c,0x3498db,0xf1c40f,0x9b59b6,0x1abc9c][i%5];B.box(x,7.6,0,.05,2.4,1.4,c,'plain',nd);B.box(x,10,0,.05,.05,1.6,0x222,'metal',nd)}
  place(2.2,(x,z)=>{B.cyl(x,0,z,2.2,.5,0xcfd8dc,'concrete',{seg:20});B.box(x,.5,z,3.6,.02,3.6,0x4fc3f7,'plain',nd);B.cyl(x,.5,z,.3,1.8,0xcfd8dc,'concrete',{seg:10});fx.push({k:'mist',x,y:2.3,z})},[[0,10],[0,-10],[12,0],[-12,0]]);
  fx.push({k:'dust',x:-15,y:6,z:0},{k:'dust',x:15,y:6,z:0})}
 if(snow){place(3,(x,z)=>{const L=B.at(x,z,.5);L.box(0,0,0,5.5,1.9,2,0x4b5d43,'metal');L.box(2.2,1.9,0,1.6,.9,1.8,0x4b5d43,'metal',{solid:false});L.box(-4.4,.4,0,3.4,.5,.5,0x4b5d43,'metal');L.box(-5.9,.4,0,.15,1.6,.15,0x333,'metal',{solid:false});
   L.box(0,2.1,0,.12,.12,8,0x2b2b2b,'metal',nd);L.box(0,2.1,0,8,.12,.12,0x2b2b2b,'metal',nd);fx.push({k:'smoke',x,y:2.2,z})},[[18,-20],[-18,20],[20,20],[-20,-20]]);
  place(1,(x,z)=>{for(let a=0;a<6;a++)B.rock(x+Math.cos(a)*.8,z+Math.sin(a)*.8,.4,.3,.4,0x555);B.glow(x,.05,z,.6,.25,.6,0xff8c1a);fx.push({k:'fire',x,y:.2,z},{k:'smoke',x,y:.5,z})},[[-10,-24],[10,24],[0,-30]]);fx.push({k:'snow'})}
 if(jungle){place(2.5,(x,z)=>{B.box(x,0,z,3.6,3.2,3,0x7d8471,'rock');B.box(x,3.2,z,3,1,2.6,0x6f7563,'rock');B.box(x,1.6,z-1.52,.6,.5,.06,0x111,'plain',nd);B.glow(x-.8,2.3,z-1.53,.5,.3,.03,0x00ff9c);B.glow(x+.8,2.3,z-1.53,.5,.3,.03,0x00ff9c);B.box(x,.9,z-1.52,1.8,.3,.06,0x222,'plain',nd)},[[0,-26],[0,26],[-26,0],[26,0]]);
  tryN(lo?2:4,.5,(x,z)=>{B.cyl(x,0,z,.12,1.6,0x5d4037,'planks',{seg:6});B.glow(x,1.6,z,.25,.3,.25,0xff9a3c);fx.push({k:'fire',x,y:1.7,z})},40);fx.push({k:'mist',x:0,y:.3,z:0})}
 if(/Rooftops/.test(nm)){tryN(lo?3:6,.6,(x,z)=>{B.box(x,0,z,1.1,.8,.8,0x95a5a6,'metal');fx.push({k:'steam',x,y:.9,z})},40);
  fx.push({k:'steam',x:-sx/4,y:.2,z:0},{k:'steam',x:sx/4,y:.2,z:0})}
 if(/Refinery/.test(nm)){tryN(lo?3:6,.5,(x,z)=>{B.box(x,0,z,.5,.9,.5,0xe67e22,'metal');B.box(x,.9,z,.6,.1,.6,0xc0392b,'metal');fx.push({k:'steam',x,y:1,z})},40);
  for(const c of B.cols)if(c.y1>12&&c.x1-c.x0<3)fx.push({k:'fire',x:(c.x0+c.x1)/2,y:c.y1+.3,z:(c.z0+c.z1)/2,big:1},{k:'smoke',x:(c.x0+c.x1)/2,y:c.y1+1.5,z:(c.z0+c.z1)/2})}
}
