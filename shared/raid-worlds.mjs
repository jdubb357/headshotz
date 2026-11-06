// Original raid layouts shared by rendering and authoritative collision checks.
const blockGrids=new WeakMap();
const world=(id,name,theme,blocks)=>({id,name,theme,version:1,size:120,blocks,
 spawns:[[-48,-48],[48,-48],[0,48]],
 caches:[[-35,-30],[-20,15],[20,-20],[34,20],[0,0],[-40,35],[40,-38],[10,36]],
 exits:[{id:'call',x:-48,z:0,kind:'call'},{id:'transport',x:48,z:35,kind:'timed'},{id:'hatch',x:0,z:-48,kind:'key'}]});
export const LEGACY_RAID_WORLDS=[
 world('relay','Relay Graveyard','industrial',[
  [-25,-15,16,10,9],[25,5,14,18,7],[-12,32,22,8,5],[8,-30,8,18,12],[-42,8,6,14,4],[40,-10,6,18,4]
 ]),
 world('reservoir','Dry Reservoir','wilderness',[
  [-20,-16,10,24,8],[20,18,10,24,8],[-28,30,12,8,4],[30,-30,14,8,4],[0,0,8,14,3],[-43,-5,5,16,5]
 ]),
 world('switchyard','Ember Switchyard','settlement',[
  [-32,-12,10,18,7],[-12,-12,10,18,10],[12,12,10,18,7],[32,12,10,18,10],[-22,32,24,6,4],[22,-32,24,6,4]
 ])
];
function authored(id,name,theme){return {id,name,theme,version:2,size:160,blocks:[],ramps:[],props:[],landmarks:[],hazards:[],caches:[],cacheMeta:[],
 spawns:[[-68,-68],[0,-68],[68,-68],[68,-20],[68,38],[38,68],[-20,68],[-68,38],[-68,-20]],
 exits:[{id:'call',x:-70,y:0,z:0,kind:'call',name:'West evacuation beacon'},{id:'transport',x:48,y:0,z:70,kind:'timed',name:'South cargo lift'},{id:'hatch',x:0,y:0,z:-70,kind:'key',name:'North maintenance hatch'},{id:'freight',x:70,y:0,z:-48,kind:'resource',name:'Emergency freight winch'}],supply:{x:0,y:0,z:46}}}
function box(m,x,z,w,d,h,y=0,material='concrete'){m.blocks.push([x,z,w,d,h,y,material])}
function room(m,x,z,w,d,h,doors=['n','s'],wallKind='brick',roofKind='roof'){
 for(const side of ['n','s','e','w']){
  const horizontal=side==='n'||side==='s',length=horizontal?w:d,sign=side==='n'||side==='w'?-1:1;
  const wall=(offset,size,height,base=0)=>box(m,x+(horizontal?offset:sign*w/2),z+(horizontal?sign*d/2:offset),horizontal?size:.45,horizontal?.45:size,height,base,wallKind);
  if(doors.includes(side)){const segment=(length-3.4)/2;for(const s of [-1,1])wall(s*(length+3.4)/4,segment,h);wall(0,3.4,h-2.8,2.8)}
  else{wall(0,length,1.1);wall(0,length,h-2.2,2.2);for(let a=-length/2;a<=length/2;a+=3)wall(a,.45,h)}
 }
 box(m,x,z,w+.8,d+.8,.22,h,roofKind);
 m.props.push({kind:'floor',x,y:.02,z,w:w-.5,d:d-.5,color:wallKind==='planks'?0x6b5137:0x62615d},{kind:'lamp',x,y:h-.5,z});
}
function cache(m,x,z,tier,name,y=0,vault=false){m.caches.push([x,z,y]);m.cacheMeta.push({tier,name,vault})}
function roofAccess(m,x,z,h){m.ramps.push({x:x+14,z,w:4,d:16,from:0,to:h+.22,axis:'z'});box(m,x+11,z+7,7,4,.18,h+.04,'metal')}
function landmark(m,name,x,z,radius=16){m.landmarks.push({name,x,z,radius});m.props.push({kind:'sign',name,x,y:2.8,z:z+radius*.6})}
function scatter(m,seed){
 let s=seed;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
 for(let i=0;i<36;i++){
  const x=Math.round((random()-.5)*120),z=Math.round((random()-.5)*120);
  if(m.caches.some(p=>Math.hypot(x-p[0],z-p[1])<5)||m.exits.some(p=>Math.hypot(x-p.x,z-p.z)<7)||blocked(m,x,z,3))continue;
  if(i%3===0)box(m,x,z,1.5,1.5,1.05,0,'crate');
  else m.props.push({kind:m.theme==='wilderness'?'tree':'scrap',x,z,y:0,scale:.7+random()});
 }
}
// New raids use a larger open-sector layout. Scaling the authored district
// geometry keeps every interior, ramp, cache and exit reachable while giving
// the raid a much broader ground area for exploration and encounter spacing.
function enlargedWorld(world,factor,version=4){
 const enlarged=structuredClone(world);enlarged.version=version;enlarged.size=world.size*factor;
 enlarged.blocks=enlarged.blocks.map(([x,z,w,d,h,base=0,material='concrete'])=>[x*factor,z*factor,w*factor,d*factor,h,base,material]);
 enlarged.ramps=(enlarged.ramps||[]).map(ramp=>({...ramp,x:ramp.x*factor,z:ramp.z*factor,w:ramp.w*factor,d:ramp.d*factor}));
 enlarged.props=(enlarged.props||[]).map(prop=>({...prop,x:prop.x*factor,z:prop.z*factor,...(prop.w!=null?{w:prop.w*factor}:{}),...(prop.d!=null?{d:prop.d*factor}:{})}));
 enlarged.landmarks=(enlarged.landmarks||[]).map(marker=>({...marker,x:marker.x*factor,z:marker.z*factor,radius:marker.radius*factor}));
 enlarged.hazards=(enlarged.hazards||[]).map(hazard=>({...hazard,x:hazard.x*factor,z:hazard.z*factor,radius:hazard.radius*factor}));
 enlarged.caches=enlarged.caches.map(([x,z,y=0])=>[x*factor,z*factor,y]);
 enlarged.exits=enlarged.exits.map(exit=>({...exit,x:exit.x*factor,z:exit.z*factor}));
 enlarged.spawns=enlarged.spawns.map(([x,z])=>[x*factor,z*factor]);
 if(enlarged.supply)enlarged.supply={...enlarged.supply,x:enlarged.supply.x*factor,z:enlarged.supply.z*factor};
 return enlarged;
}

// Version-5 sectors are authored from scratch rather than scaled copies. Each
// keeps twelve loot sites and four exits but adds linked districts, elevated
// decks, towers and terrain cuts so the larger ground area has distinct places
// to explore instead of one stretched district.
function arena(id,name,theme){
 return {id,name,theme,version:5,size:720,blocks:[],ramps:[],props:[],landmarks:[],hazards:[],caches:[],cacheMeta:[],
  spawns:[[-300,-300],[-80,-320],[140,-320],[320,-140],[320,160],[160,320],[-140,320],[-320,160],[-320,-120]],
  exits:[{id:'call',x:-330,y:0,z:0,kind:'call',name:'West evacuation beacon'},{id:'transport',x:200,y:0,z:330,kind:'timed',name:'South cargo lift'},{id:'hatch',x:0,y:0,z:-330,kind:'key',name:'North maintenance hatch'},{id:'freight',x:330,y:0,z:-180,kind:'resource',name:'Emergency freight winch'}],
  supply:{x:0,y:0,z:100}};
}
function roofLink(m,x,z,h){
 const roof=m.blocks.find(([bx,bz,w,d,rh,base=0])=>bx===x&&bz===z&&rh===.22&&base===h),width=roof?roof[2]:30;
 const rampX=x+width/2+4,distance=Math.max(16,Math.ceil((2*(h+.22))/.7));
 m.ramps.push({x:rampX,z,w:4,d:distance,from:0,to:h+.22,axis:'z'});
 box(m,rampX-5.5,z+9,7,4,.18,h+.04,'metal');
}
function deck(m,x,z,w,d,h){
 box(m,x,z,w,d,.2,h,'metal');
 m.ramps.push({x:x-w/2-6,z,w:12,d,from:0,to:h+.2,axis:'x'});
 m.ramps.push({x:x+w/2+6,z,w:12,d,from:h+.2,to:0,axis:'x'});
}
function scatterBig(m,seed){
 let s=seed;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296},range=m.size/2-30;
 for(let i=0;i<90;i++){
  const x=Math.round((random()-.5)*range*2),z=Math.round((random()-.5)*range*2);
  if(m.caches.some(p=>Math.hypot(x-p[0],z-p[1])<7)||m.exits.some(p=>Math.hypot(x-p.x,z-p.z)<10)||m.spawns.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<6)||blocked(m,x,z,3))continue;
  if(i%5===0)box(m,x,z,1.8,1.8,1.1,0,'crate');
  else m.props.push({kind:m.theme==='wilderness'?'tree':'scrap',x,z,y:0,scale:.8+random()});
 }
}

// ===================== Version 7 sector dressing =====================
// The six-hundred-metre authored districts were scaled to 1,440 m for v6, but
// that shortcut left most of the sector floor as empty concrete. Version 7
// keeps v6 frozen for in-flight checkpoints and grows a dense, authored layer
// of compounds, ruins, container yards, groves, outcrops and field clutter
// around the existing districts. Everything is generated qualitatively and
// deterministically from the sector seed, not randomly per session.
function prng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function clearFootprint(m,x,z,w,d,pad=4){
 const hx=w/2+pad,hz=d/2+pad;
 if(Math.abs(x)+hx>m.size/2-8||Math.abs(z)+hz>m.size/2-8)return false;
 for(const [bx,bz,bw,bd] of m.blocks)if(Math.abs(x-bx)<hx+bw/2&&Math.abs(z-bz)<hz+bd/2)return false;
 for(const r of m.ramps||[])if(Math.abs(x-r.x)<hx+r.w/2&&Math.abs(z-r.z)<hz+r.d/2)return false;
 for(const [cx,cz] of m.caches)if(Math.abs(x-cx)<hx+8&&Math.abs(z-cz)<hz+8)return false;
 for(const [sx,sz] of m.spawns)if(Math.abs(x-sx)<hx+9&&Math.abs(z-sz)<hz+9)return false;
 for(const e of m.exits)if(Math.abs(x-e.x)<hx+11&&Math.abs(z-e.z)<hz+11)return false;
 return true;
}
function addTree(m,x,z,R,leaves){
 if(!clearFootprint(m,x,z,1.6,1.6,.8))return false;
 const scale=.7+R()*.75,leaf=leaves&&leaves[Math.floor(R()*leaves.length)];
 m.props.push({kind:'tree',x,z,y:0,scale,...(leaf?{leaf}:{})});return true;
}
function grove(m,cx,cz,radius,count,R,leaves){
 let n=0;
 for(let i=0;i<count;i++){const a=R()*Math.PI*2,d=Math.sqrt(R())*radius;if(addTree(m,cx+Math.sin(a)*d,cz+Math.cos(a)*d,R,leaves))n++}
 return n;
}
function rooftop(m,x,z,w,d,h,R){
 const n=2+Math.floor(R()*3);
 for(let i=0;i<n;i++)box(m,x+(R()-.55)*w*.55,z+(R()-.55)*d*.55,1.4+R()*2.2,1.2+R()*1.6,.8+R()*1.5,h+.22,'metal');
 if(R()<.55)box(m,x+(R()-.5)*w*.6,z+(R()-.5)*d*.6,.22,4+R()*4,.22,h+.22,'metal');
 if(R()<.35)box(m,x+(R()-.5)*w*.7,z+(R()-.5)*d*.2,2.4,.18,.18,h+.24,'metal');
}
function warehouse(m,x,z,R){
 const w=32+Math.round(R()*22),d=22+Math.round(R()*14),h=6+Math.round(R()*4);
 if(!clearFootprint(m,x,z,w,d,7))return false;
 room(m,x,z,w,d,h,R()<.5?['n','s']:['e','w'],'concrete','roof');rooftop(m,x,z,w,d,h,R);
 for(let i=0;i<2+Math.round(R()*3);i++)box(m,x+(R()-.5)*w*.55,z+(R()-.5)*d*.55,1.6,1.6,1.1,.02,'crate');
 return true;
}
function house(m,x,z,R,wallKind='brick',roofKind='roof'){
 const w=14+Math.round(R()*12),d=12+Math.round(R()*8),h=3.6+Math.round(R()*2.4);
 if(!clearFootprint(m,x,z,w,d,6))return false;
 room(m,x,z,w,d,h,R()<.5?['s']:['n','e'],wallKind,roofKind);
 if(R()<.55)box(m,x+(R()-.5)*w*.35,z+d*.28,1.1,1.1,2.6,h+.22,'brick');
 return true;
}
function ruin(m,x,z,R,wallKind='brick'){
 const w=12+Math.round(R()*18),d=8+Math.round(R()*14),h=2+Math.round(R()*1.5);
 if(!clearFootprint(m,x,z,w,d,5))return false;
 box(m,x-w/3,z-d/2,w/3,.42,h,0,wallKind);box(m,x+w/4,z-d/2,w/3,.42,h-.4,0,wallKind);
 box(m,x-w/2,z+d*.15,.42,d*.55,h-.6,0,wallKind);
 if(R()<.7)box(m,x+(R()-.5)*w*.4,z+(R()-.5)*d*.3,1.4+R()*2,1.2+R()*2,.5+R()*.8,0,'rock');
 return true;
}
function containers(m,x,z,R){
 const cols=2+Math.floor(R()*3),rows=2+Math.floor(R()*3),rot=R()<.4,cw=rot?2.6:6.2,cd=rot?6.2:2.6,gx=rot?3.6:7.4,gz=rot?7.4:3.6;
 let placed=0;
 for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
  const cx=x+(i-(cols-1)/2)*gx,cz=z+(j-(rows-1)/2)*gz;
  if(!clearFootprint(m,cx,cz,cw,cd,.3))continue;
  box(m,cx,cz,cw,cd,2.9,0,'container');placed++;
  if(R()<.35)box(m,cx,cz,cw,cd,2.9,2.9,'container');
 }
 if(placed)box(m,x,z,cols*gx*.92,.32,rows*gz*.92,0,'barrier');
 return placed>1;
}
function shed(m,x,z,R,wallKind='metal',roofKind='metal'){
 const w=12+Math.round(R()*10),d=10+Math.round(R()*8),h=3.2+Math.round(R()*2);
 if(!clearFootprint(m,x,z,w,d,5))return false;
 room(m,x,z,w,d,h,['s'],wallKind,roofKind);return true;
}
function outcrop(m,x,z,R){
 const w=6+Math.round(R()*18),d=5+Math.round(R()*14),h=1.5+Math.round(R()*2.2);
 if(!clearFootprint(m,x,z,w,d,4))return false;
 box(m,x,z,w,d,h,0,'rock');box(m,x+(R()-.5)*w*.6,z+(R()-.5)*d*.6,w*.35,d*.35,h+R(),0,'rock');return true;
}
function tankFarm(m,x,z,R,color){
 if(!clearFootprint(m,x,z,10,10,4))return false;
 m.props.push({kind:'tank',x,z,y:0,scale:.8+R()*.5,color});
 box(m,x+5.5,z,5,.35,.35,0,'metal');box(m,x,z+5.5,5,.35,.35,0,'metal');return true;
}
function cratePile(m,x,z,R){
 let placed=0;
 for(let i=0;i<3+Math.round(R()*4);i++){const cx=x+(R()-.5)*7,cz=z+(R()-.5)*7;
  if(!clearFootprint(m,cx,cz,1.9,1.9,1))continue;
  box(m,cx,cz,1.6,1.6,1.1,0,'crate');placed++;
  if(R()<.4)box(m,cx,cz,1.2,1.2,.8,1.1,'crate');
 }
 return placed>0;
}

function decorateWorld(world,seed){
 const m=structuredClone(world);m.version=7;
 const R=prng(seed),isRes=m.id==='reservoir',isSw=m.id==='switchyard';
 const anchors=(m.landmarks||[]).map(l=>({x:l.x,z:l.z,r:Math.max(24,l.radius||18)}));
 // A halo of purpose-built compounds around each authored landmark.
 for(const a of anchors){
  const count=isRes?4+Math.round(R()*4):5+Math.round(R()*5);
  for(let i=0;i<count;i++){
   const angle=R()*Math.PI*2,dist=a.r*1.7+R()*a.r*1.5,x=a.x+Math.sin(angle)*dist,z=a.z+Math.cos(angle)*dist,roll=R();
   if(isRes){if(roll<.4)house(m,x,z,R,'planks','planks');else if(roll<.62)outcrop(m,x,z,R);else if(roll<.8)ruin(m,x,z,R,'planks');else tankFarm(m,x,z,R,0x6b7f72)}
   else if(isSw){if(roll<.46)house(m,x,z,R,'brick','roof');else if(roll<.66)house(m,x,z,R,'concrete','roof');else if(roll<.84)shed(m,x,z,R,'metal','metal');else containers(m,x,z,R)}
   else{if(roll<.4)warehouse(m,x,z,R);else if(roll<.68)containers(m,x,z,R);else if(roll<.86)ruin(m,x,z,R,'concrete');else tankFarm(m,x,z,R,0x6f8489)}
  }
 }
 // A layer of independent compounds between the landmark districts.
 const satellites=isRes?7:10;
 for(let i=0;i<satellites;i++){
  const x=(R()*2-1)*(m.size/2-70),z=(R()*2-1)*(m.size/2-70),roll=R();
  if(isRes){if(roll<.38)house(m,x,z,R,'planks','planks');else if(roll<.64)outcrop(m,x,z,R);else if(roll<.82)ruin(m,x,z,R,'planks');else cratePile(m,x,z,R)}
  else if(isSw){if(roll<.35)house(m,x,z,R,'brick','roof');else if(roll<.58)house(m,x,z,R,'concrete','roof');else if(roll<.8)shed(m,x,z,R);else containers(m,x,z,R)}
  else{if(roll<.38)warehouse(m,x,z,R);else if(roll<.62)containers(m,x,z,R);else if(roll<.8)shed(m,x,z,R,'metal','metal');else cratePile(m,x,z,R)}
 }
 const leaves=isRes?[0x3b6b40,0x4b7d49,0x2f5636,0x5b8a4f]:isSw?[0x577d4b,0x6c9057,0x486b3c]:[0x556b4f,0x6d835f,0x47583d];
 // Every insertion point gets its own defensive hamlet so the landing zone
 // never opens onto empty ground. Compounds sit toward the centre, leaving a
 // clear run from the exact spawn marker.
 for(const [sx,sz] of m.spawns){
  const length=Math.hypot(sx,sz)||1,toX=-sx/length,toZ=-sz/length,sideX=-toZ,sideZ=toX;
  for(let i=0;i<4;i++){
   const forward=46+i*40+R()*16,offset=(i%2?1:-1)*(18+R()*26);
   const x=sx+toX*forward+sideX*offset,z=sz+toZ*forward+sideZ*offset,roll=R();
   if(isRes){if(i===3&&roll<.55)tankFarm(m,x,z,R,0x6b7f72);else if(roll<.45)outcrop(m,x,z,R);else house(m,x,z,R,'planks','planks')}
   else if(isSw){if(i===3&&roll<.5)containers(m,x,z,R);else if(roll<.4)shed(m,x,z,R);else house(m,x,z,R,'brick','roof')}
   else {if(i===3&&roll<.5)warehouse(m,x,z,R);else if(roll<.45)containers(m,x,z,R);else shed(m,x,z,R)}
  }
  const lx=sx+toX*42+sideX*10,lz=sz+toZ*42+sideZ*10;
  if(clearFootprint(m,lx,lz,1,1,3))m.props.push({kind:'floodlight',x:lx,z:lz,y:0});
  if(!isRes&&R()<.75){const ax=sx+toX*118,az=sz+toZ*118;if(clearFootprint(m,ax,az,1,1,3))m.props.push({kind:'antenna',x:ax,z:az,y:0})}
  for(let i=0;i<9;i++)addTree(m,sx+(R()*2-1)*58,sz+(R()*2-1)*58,R,leaves);
  const campPalette=isRes?[0x38483a,0x5d6b52,0x93895e]:isSw?[0x4b5344,0x8a7156,0xa3753f]:[0x4c5b4e,0x546b52,0x7d6f58];
  for(let i=0;i<5;i++){
   const a=R()*Math.PI*2,d=20+R()*46,x=sx+Math.sin(a)*d,z=sz+Math.cos(a)*d;if(!clearFootprint(m,x,z,1.5,1.5,.4))continue;
   const roll=R();
   if(isRes){if(roll<.35)m.props.push({kind:'tent',x,z,y:0,scale:.8+R()*.5,color:0x8a9b7a});else if(roll<.7)m.props.push({kind:'campfire',x,z,y:0,scale:.6+R()*.25,color:0xffb64d});else m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.5,color:campPalette[Math.floor(R()*3)]})}
   else m.props.push({kind:roll<.4?'barrel':'crate',x,z,y:0,scale:.8+R()*.5,color:campPalette[Math.floor(R()*3)]});
  }
  if(isSw)for(let i=0;i<3;i++)m.props.push({kind:'car',x:sx+(R()*2-1)*70,z:sz+(R()*2-1)*70,y:0,scale:.7+R()*.5,color:0x647082});
 }
 // Groves fill the open ground. Wilderness is deliberately dense; the other
 // two sectors get sparse windbreaks and overgrown edges.
 const groveCount=isRes?16:isSw?10:9;
 for(let g=0;g<groveCount;g++){
  const x=(R()*2-1)*(m.size/2-60),z=(R()*2-1)*(m.size/2-60),radius=isRes?22+R()*32:12+R()*22,count=isRes?18+Math.round(R()*22):8+Math.round(R()*14);
  grove(m,x,z,radius,count,R,leaves);
 }
 return m;
}

function scatterDressing(m,seed){
 const R=prng(seed^0x6d2b79f5),isRes=m.id==='reservoir',isSw=m.id==='switchyard',half=m.size/2-14;
 const palette=isRes?[0x38483a,0x5d6b52,0x93895e,0x7a4f2e]:isSw?[0x4b5344,0x8a7156,0xa3753f,0x2f3a33]:[0x4c5b4e,0x546b52,0x7d6f58];
 for(let i=0;i<600;i++){
  const x=(R()*2-1)*half,z=(R()*2-1)*half;if(!clearFootprint(m,x,z,2,2,.5))continue;
  const roll=R();
  if(isRes){
   if(roll<.34)m.props.push({kind:'bush',x,z,y:0,scale:.6+R()*.9,color:palette[Math.floor(R()*3)]});
   else if(roll<.55)m.props.push({kind:'rock',x,z,y:0,scale:.6+R()*.9,color:0x8a8777});
   else if(roll<.68)m.props.push({kind:'tree',x,z,y:0,scale:.7+R()*.9,leaf:palette[Math.floor(R()*3)]});
   else if(roll<.79)m.props.push({kind:'tent',x,z,y:0,scale:.8+R()*.5,color:0x8a9b7a});
   else if(roll<.9)m.props.push({kind:'campfire',x,z,y:0,scale:.6+R()*.25,color:0xffb64d});
   else m.props.push({kind:'scrap',x,z,y:0,scale:.7+R()*.6});
  }else if(isSw){
   if(roll<.26)m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.6,color:palette[Math.floor(R()*3)]});
   else if(roll<.4)m.props.push({kind:'wreck',x,z,y:0,scale:.9+R()*.4,color:0x3d302c});
   else if(roll<.55)m.props.push({kind:'scrap',x,z,y:0,scale:.7+R()*.7});
   else if(roll<.67)m.props.push({kind:'bush',x,z,y:0,scale:.5+R()*.7,color:palette[Math.floor(R()*3)]});
   else if(roll<.77)m.props.push({kind:'tree',x,z,y:0,scale:.7+R()*.8,leaf:palette[Math.floor(R()*3)]});
   else if(roll<.86)m.props.push({kind:'rock',x,z,y:0,scale:.5+R()*.7,color:0x8a8777});
   else if(roll<.93)m.props.push({kind:'tent',x,z,y:0,scale:.8+R()*.5,color:0x7e8977});
   else m.props.push({kind:'car',x,z,y:0,scale:.7+R()*.5,color:0x647082});
  }else{
   if(roll<.24)m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.7,color:palette[Math.floor(R()*3)]});
   else if(roll<.4)m.props.push({kind:'scrap',x,z,y:0,scale:.7+R()*.8});
   else if(roll<.52)m.props.push({kind:'wreck',x,z,y:0,scale:.9+R()*.4,color:0x3d302c});
   else if(roll<.65)m.props.push({kind:'crate',x,z,y:0,scale:.7+R()*.4,color:0x9c7b4d});
   else if(roll<.76)m.props.push({kind:'bush',x,z,y:0,scale:.5+R()*.6,color:palette[Math.floor(R()*3)]});
   else if(roll<.85)m.props.push({kind:'tree',x,z,y:0,scale:.7+R()*.8,leaf:palette[Math.floor(R()*3)]});
   else if(roll<.93)m.props.push({kind:'rock',x,z,y:0,scale:.5+R()*.7,color:0x6d6a60});
   else m.props.push({kind:'tank',x,z,y:0,scale:.8+R()*.5,color:0x748889});
  }
 }
 // Service lamps line both central routes so the sectors remain legible at
 // night without adding huge fog volumes.
 for(let i=-m.size/2+40;i<=m.size/2-40;i+=isRes?48:36){
  if(clearFootprint(m,0,i,1.5,1.5,1))m.props.push({kind:'lamp',x:0,z:i,y:0});
  if(clearFootprint(m,i,0,1.5,1.5,1))m.props.push({kind:'lamp',x:i,z:0,y:0});
 }
 return m;
}

function dressWorld(world,seed){
 return scatterDressing(decorateWorld(world,seed),seed);
}

// ---------------------------------------------------------------------------
// Version 8: living settlements. The v7 layer made the sector populated; this
// layer turns the approach to every insertion point into a street-anchored
// hamlet and adds larger interior town districts. Roads and street furniture
// are visual props (the server only collides with blocks), while the buildings
// themselves are real authored blocks so online, offline and server collision
// agree.
const TOWN_NAMES={
 relay:['WATER','RATIONS','CLINIC','REPAIR','RADIO','BARRACKS','SUPPLY','CIVIL AFFAIRS'],
 reservoir:['WATER','FIRST AID','SHELTER','FOREST POST','PUMP STATION','COMMS','SUPPLY','RANGER POST'],
 switchyard:['RAIL OFFICE','DEPOT','FUEL','MESS','ARMORY','DISPATCH','SIGNAL','STORES']
};

function townRoad(m,x,z,w,d,ry=0,kind='road'){
 m.props.push({kind,x,z,y:.014,w,d,ry});
}
function townSidewalk(m,x,z,w,d,ry=0){townRoad(m,x,z,w,d,ry,'sidewalk')}
function townPlaza(m,x,z,w,d){townRoad(m,x,z,w,d,0,'plaza')}
function townLamp(m,x,z){m.props.push({kind:'lamp',x,z,y:0})}
function townPole(m,x,z){m.props.push({kind:'powerPole',x,z,y:0})}

function townWindowRows(m,x,z,w,d,base,height,R,litChance=.55){
 const colors=[0xffd58b,0xffc36f,0xffe8b0,0xcfe4ff];
 const first=base+1.5,last=base+height-1;
 for(let y=first;y<=last;y+=2.5){
  for(const [face,off,axis] of [[0,-1,'z'],[0,1,'z'],[-1,0,'x'],[1,0,'x']]){
   const along=axis==='z'?w:d,n=Math.max(1,Math.min(3,Math.floor(along/5.2)));
   for(let i=0;i<n;i++){
    const t=n===1?0:(i-(n-1)/2)*(along*.72/Math.max(1,n-1));
    const lit=R()<litChance,color=colors[Math.floor(R()*colors.length)];
    if(axis==='z')m.props.push({kind:'window',x:x+t,y:y-.65,z:z+off*(d/2+.27),w:1.15,d:.16,h:1.3,lit,color});
    else m.props.push({kind:'window',x:x+off*(w/2+.27),y:y-.65,z:z+t,w:.16,d:1.15,h:1.3,lit,color});
   }
  }
 }
}

function townBuilding(m,x,z,R,theme,facing,names){
 const walls=theme==='wilderness'?['planks','brick','concrete']:theme==='settlement'?['brick','brick','concrete','planks']:['brick','concrete','planks','metal'];
 const wall=walls[Math.floor(R()*walls.length)];
 const w=12+Math.floor(R()*9),d=11+Math.floor(R()*7);
 const h=4.2+R()*1.8,floors=R()<(theme==='reservoir'?.22:.36)?2:1;
 if(!clearFootprint(m,x,z,w,d,5))return false;
 room(m,x,z,w,d,h,R()<.5?['n','e']:['s','w'],wall,'roof');
 let top=h;
 if(floors===2){
  const up=2.8+R()*.7;
  box(m,x,z,w-.4,d-.4,up,h,wall);
  townWindowRows(m,x,z,w-.4,d-.4,h,up,R,.6);
  top=h+up;
 }
 townWindowRows(m,x,z,w,d,0,h,R,.58);
 box(m,x,z,w-.2,d-.2,.24,top,'roof');
 rooftop(m,x,z,w,d,top,R);
 if(R()<.4)box(m,x+(R()-.5)*w*.4,z+(R()-.5)*d*.4,1.2+R()*1.4,1.1+R()*1.6,1.1+R()*1.8,top+.22,'metal');
 const dirs={n:[0,-1,'z'],s:[0,1,'z'],e:[1,0,'x'],w:[-1,0,'x']},dir=dirs[facing]||dirs.s,angry=R()<.5?0x8d382e:0x41625c;
 if(R()<.5){
  if(dir[2]==='x')m.props.push({kind:'awning',x:x+dir[0]*(w/2+.8),y:2.35,z,w:1.7,d:d*.78,color:angry});
  else m.props.push({kind:'awning',x,y:2.35,z:z+dir[1]*(d/2+.8),w:w*.78,d:1.7,color:angry});
 }
 if(R()<.3){
  const name=names[Math.floor(R()*names.length)];
  if(dir[2]==='x')m.props.push({kind:'sign',name,x:x+dir[0]*(w/2+.35),y:3.15,z});
  else m.props.push({kind:'sign',name,x,y:3.15,z:z+dir[1]*(d/2+.35)});
 }
 return true;
}

function townStreet(m,cx,cz,width=14,length=220){
 townRoad(m,cx,cz,length,width);
 townRoad(m,cx,cz,width,length);
 for(const s of [-1,1]){
  townSidewalk(m,cx,cz+s*(width/2+1.6),length,3.2);
  townSidewalk(m,cx+s*(width/2+1.6),cz,3.2,length);
 }
 townPlaza(m,cx,cz,width+16,width+16);
 m.props.push({kind:'crosswalk',x:cx,z:cz,y:.03,w:width+8,d:width+8});
 for(const t of [-90,-60,-30,30,60,90])for(const s of [-1,1]){
  townLamp(m,cx+t,cz+s*(width/2+3.6));
  townLamp(m,cx+s*(width/2+3.6),cz+t);
 }
 for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
  const x=cx+sx*(length/2-18),z=cz+sz*(width/2+5);
  if(clearFootprint(m,x,z,.8,.8,2))townPole(m,x,z);
  const x2=cx+sx*(width/2+5),z2=cz+sz*(length/2-18);
  if(clearFootprint(m,x2,z2,.8,.8,2))townPole(m,x2,z2);
 }
}

function settlement(m,cx,cz,R,theme,names,district=false,facingHint){
 townStreet(m,cx,cz,district?16:14,district?240:220);
 const lots=district
  ?[[-72,-48],[-36,-54],[0,-56],[36,-54],[72,-48],[-86,-14],[-86,20],[-72,54],[-36,58],[0,58],[36,58],[72,54],[86,-14],[86,20]]
  :[[-46,-32],[-46,-2],[-46,28],[46,-32],[46,-2],[46,28],[-15,-46],[17,-46],[-15,44],[17,44],[-78,-26],[78,24]];
 let built=0;
 for(const [lx,lz] of lots){
  const x=cx+lx,z=cz+lz;
  const facing=Math.abs(lx)>=Math.abs(lz)?(lx<0?'e':'w'):(lz<0?'s':'n');
  if(townBuilding(m,x,z,R,theme,R()<.7?facing:facingHint||facing,names))built++;
 }
 // A settlement square with supplies, shelter and abandoned transport.
 for(let i=0;i<4;i++){
  const a=R()*Math.PI*2,d=9+R()*5,x=cx+Math.sin(a)*d,z=cz+Math.cos(a)*d;
  if(!clearFootprint(m,x,z,1,1,1))continue;
  const roll=R();
  if(theme==='reservoir')m.props.push({kind:roll<.5?'tent':'campfire',x,z,y:0,scale:.8+R()*.4,color:roll<.5?0x8a9b7a:0xffb64d});
  else if(roll<.35)m.props.push({kind:'crate',x,z,y:0,scale:.75+R()*.25,color:0x9c7b4d});
  else if(roll<.7)m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.2,color:0x4b5344});
  else m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.2,color:0x8a7156});
 }
 for(const [bx,bz] of [[-12,-12],[12,12]]){
  m.props.push({kind:'bench',x:cx+bx,z:cz+bz,y:0,scale:1});
  if(R()<.55)m.props.push({kind:'dumpster',x:cx+bx*1.9,z:cz+bz*1.9,y:0,scale:.8+R()*.3,color:0x4e6550});
 }
 for(let i=0;i<5;i++){
  const side=R()<.5?-1:1,x=cx+side*(28+R()*62),z=cz+(R()*2-1)*58;
  if(clearFootprint(m,x,z,1.2,2.5,2))m.props.push({kind:'car',x,z,y:0,scale:.7+R()*.4,color:_car(R)});
 }
 for(let i=0;i<6;i++){
  const x=cx+(R()*2-1)*92,z=cz+(R()*2-1)*92,d=R()>.5?14:22;
  if(clearFootprint(m,x,z,1.5,1.5,2))m.props.push({kind:'lamp',x,z,y:0,scale:.8+R()*.45});
  else if(clearFootprint(m,x,z,1.2,1.2,2))m.props.push({kind:'barrel',x,z,y:0,scale:.7+R()*.3,color:0x4b5344});
 }
 return built;
}

function _car(R){return [0x647082,0x6f5b4d,0x7d4f42,0x4f6166][Math.floor(R()*4)]}

function spawnTown(m,sx,sz,toX,toZ,sideX,sideZ,R,theme,names){
 const dist=84,cx=sx+toX*dist,cz=sz+toZ*dist,ry=Math.atan2(-toZ,toX);
 // Approach boulevard, with pavements and a checkpoint at the landing edge.
 townRoad(m,sx+toX*dist/2,sz+toZ*dist/2,dist+34,12,ry);
 townSidewalk(m,sx+toX*dist/2+sideX*8.2,sz+toZ*dist/2+sideZ*8.2,dist+24,3.4,ry);
 townSidewalk(m,sx-toX*dist/2-sideX*8.2,sz-toZ*dist/2-sideZ*8.2,dist+24,3.4,ry);
 for(let i=16;i<dist;i+=30){
  const x=sx+toX*i,z=sz+toZ*i;
  m.props.push({kind:'sandbag',x:x+sideX*10,z:z+sideZ*10,y:0,scale:.8+R()*.25});
  if(i<58)m.props.push({kind:'sandbag',x:x-sideX*10,z:z-sideZ*10,y:0,scale:.8+R()*.25});
 }
 m.props.push({kind:'checkpoint',x:sx+toX*22,z:sz+toZ*22,y:0,scale:1,color:0xb9a56d});
 m.props.push({kind:'sign',name:'QUARANTINE LINE',x:sx+toX*18,z:sz+toZ*18,y:2.8});
 settlement(m,cx,cz,R,theme,names,false,undefined);
 return true;
}

function urbanizeWorld(world,seed){
 const m=structuredClone(world);m.version=8;
 const R=prng(seed),isRes=m.id==='reservoir',names=TOWN_NAMES[m.id]||TOWN_NAMES.relay;
 for(const [sx,sz] of m.spawns){
  const length=Math.hypot(sx,sz)||1,toX=-sx/length,toZ=-sz/length,sideX=-toZ,sideZ=toX;
  spawnTown(m,sx,sz,toX,toZ,sideX,sideZ,R,m.theme,names);
 }
 const centers={relay:[[-360,360],[540,450]],reservoir:[[-540,450],[450,-540]],switchyard:[[-180,-270],[360,-180]]}[m.id]||[];
 for(const [cx,cz] of centers)settlement(m,cx,cz,R,m.theme,names,true);
 return m;
}

const relay=authored('relay','Relay Graveyard','industrial');
room(relay,-40,-30,24,18,5.2,['n','e']);room(relay,0,0,18,16,4);roofAccess(relay,0,0,4);room(relay,38,28,20,14,4.4,['w','s']);
for(const x of [-40,-28]){box(relay,x,32,2,2,10,0,'metal');relay.props.push({kind:'dish',x,y:10,z:32})}
for(const x of [28,38,48]){box(relay,x,-34,5,9,2.3,0,'container');relay.props.push({kind:'turbine',x,y:2.3,z:-34})}
for(const x of [-16,16])for(const z of [-38,-20,24,40])box(relay,x,z,3,1.2,1.15,0,'barrier');
landmark(relay,'Relay Control',0,0);landmark(relay,'Freight Hall',-40,-30);landmark(relay,'Turbine Row',38,28);landmark(relay,'Dish Field',-34,32);landmark(relay,'Substation',38,-34);
for(const args of [[-40,-30,1,'Freight manifest'],[0,0,3,'Control roof locker',4.22],[3,3,2,'Relay console'],[38,28,2,'Turbine parts'],[38,-26,2,'Substation supplies'],[-34,32,1,'Dish service box'],[12,34,0,'Roadside salvage'],[-44,8,0,'Drainage cache'],[18,-34,1,'Cable spool'],[-20,-12,0,'Survey box'],[52,5,1,'Loading apron'],[-7,44,3,'Sealed relay vault',0,true]])cache(relay,...args);
relay.hazards.push({id:'substation_arcs',name:'Substation discharge',x:38,z:-26,y:0,radius:6,period:45,active:8,warning:4,damage:8});scatter(relay,9271);

const reservoir=authored('reservoir','Dry Reservoir','wilderness');
room(reservoir,-30,-22,20,16,4.2,['n','e']);room(reservoir,32,30,18,14,4.8,['w','s']);roofAccess(reservoir,32,30,4.8);
for(const [x,z,w,d]of [[-18,20,8,16],[18,-12,8,16],[-46,26,8,10],[44,-28,10,8]])box(reservoir,x,z,w,d,4,0,'rock');
box(reservoir,0,12,6,25,.2,1.6,'metal');reservoir.ramps.push({x:0,z:-5,w:6,d:9,from:0,to:1.8,axis:'z'},{x:0,z:29,w:6,d:9,from:1.8,to:0,axis:'z'});
reservoir.props.push({kind:'basin',x:0,y:.01,z:12,w:24,d:24},{kind:'pump',x:-30,y:0,z:-34},{kind:'waterTower',x:28,y:0,z:-38});
landmark(reservoir,'Pump House',-30,-22);landmark(reservoir,'Watch Station',32,30);landmark(reservoir,'Dry Basin',0,12);landmark(reservoir,'Rock Cut',-40,26);landmark(reservoir,'Intake Tower',28,-38);
for(const args of [[-30,-22,1,'Pump stores'],[32,30,2,'Watch station'],[32,30,3,'Observation roof',5.02],[0,12,2,'Bridge inspection box',1.8],[-45,10,0,'Ranger cache'],[44,-14,1,'Intake supplies'],[28,-38,2,'Tower equipment'],[-10,-42,1,'Survey camp'],[-38,45,0,'Forest supplies'],[22,49,0,'Abandoned camp'],[8,-26,1,'Drainage hatch'],[-4,42,3,'Sealed pump vault',0,true]])cache(reservoir,...args);
reservoir.hazards.push({id:'coolant_vent',name:'Coolant vent',x:12,z:12,y:0,radius:6,period:55,active:10,warning:5,damage:6});scatter(reservoir,7719);

const switchyard=authored('switchyard','Ember Switchyard','settlement');
room(switchyard,-36,-28,20,16,4.4,['n','e']);room(switchyard,0,-25,18,16,4,['n','s']);room(switchyard,34,30,22,18,4.2,['w','s']);roofAccess(switchyard,34,30,4.2);
for(const z of [-8,8])for(const x of [-38,-8,22,48])box(switchyard,x,z,15,4,2.5,0,'container');
box(switchyard,-22,30,28,5,.2,3.2,'metal');switchyard.ramps.push({x:-41,z:30,w:10,d:5,from:0,to:3.4,axis:'x'},{x:-3,z:30,w:10,d:5,from:3.4,to:0,axis:'x'});
for(const x of [-52,-22,8,38])switchyard.props.push({kind:'signal',x,y:0,z:-16});
for(const z of [-8,8])switchyard.props.push({kind:'rail',x:0,y:.02,z,w:132,d:2.2});
landmark(switchyard,'Freight Office',-36,-28);landmark(switchyard,'Dispatch',0,-25);landmark(switchyard,'Ember Depot',34,30);landmark(switchyard,'Transfer Bridge',-22,30);landmark(switchyard,'Rail Corridor',6,0);
for(const args of [[-36,-28,1,'Freight office'],[0,-25,2,'Dispatch console'],[34,30,2,'Depot stores'],[34,30,3,'Depot roof strongbox',4.42],[-22,30,2,'Bridge signal box',3.4],[-48,21,0,'Trackside salvage'],[20,-40,1,'Signal supplies'],[46,-26,1,'Burned carriage'],[-18,-45,0,'Worker camp'],[-1,48,0,'Evacuation stores'],[54,14,1,'Platform luggage'],[0,22,3,'Locked dispatch vault',0,true]])cache(switchyard,...args);
switchyard.hazards.push({id:'live_rail',name:'Live rail discharge',x:8,z:8,y:0,radius:7,period:50,active:8,warning:4,damage:9});scatter(switchyard,2033);
const relay5=arena('relay','Relay Graveyard','industrial');
room(relay5,0,0,30,24,5.4);roofLink(relay5,0,0,5.4);
room(relay5,-180,40,26,20,5.0);roofLink(relay5,-180,40,5.0);
room(relay5,180,-40,24,18,4.6);
for(const [x,z]of [[-180,-160],[-160,-160]]){box(relay5,x,z,2,2,10,0,'metal');relay5.props.push({kind:'dish',x,y:10,z})}
for(const [x,z]of [[80,-140],[100,-140],[120,-140],[-60,160],[-40,160],[-20,160]])box(relay5,x,z,6,12,2.4,0,'container');
for(const [x,z]of [[-220,-260],[220,-260],[-180,240],[180,240]])box(relay5,x,z,4,2,1.2,0,'barrier');
box(relay5,200,180,20,16,3.2,0,'rock');box(relay5,-240,-200,24,18,3.0,0,'rock');
deck(relay5,-140,0,220,8,2.8);
for(const [x,z]of [[-80,0],[180,0],[0,-160]])relay5.props.push({kind:'floodlight',x,y:0,z});
relay5.props.push({kind:'crane',x:220,y:0,z:-260},{kind:'antenna',x:-180,y:0,z:-160},{kind:'turbine',x:140,y:2.4,z:-140},{kind:'turbine',x:160,y:2.4,z:-140});
cache(relay5,-240,-120,0,'Tooling cache');
cache(relay5,-180,40,1,'Freight hall stores');
cache(relay5,-174,47,2,'Freight roof locker',5.22);
cache(relay5,70,-130,0,'Drainage cache');
cache(relay5,180,-40,1,'Turbine hall depot');
cache(relay5,-140,0,2,'Bridge relay node',3.0);
cache(relay5,180,160,2,'Substation supplies');
cache(relay5,240,-200,0,'Fuel dump');
cache(relay5,0,10,3,'Control roof locker',5.62);
cache(relay5,250,-100,1,'Loading apron');
cache(relay5,-20,180,1,'Dispatch annex');
cache(relay5,0,0,3,'Sealed relay vault',0,true);
landmark(relay5,'Relay Control',0,0,20);landmark(relay5,'Freight Hall',-180,40,20);landmark(relay5,'Turbine Hall',180,-40,20);landmark(relay5,'Dish Field',-170,-160,18);landmark(relay5,'Substation',240,100,18);landmark(relay5,'Transfer Deck',-140,0,16);
relay5.hazards.push({id:'substation_arcs',name:'Substation discharge',x:240,y:0,z:100,radius:8,period:65,active:9,warning:5,damage:9});
scatterBig(relay5,9271);

const reservoir5=arena('reservoir','Dry Reservoir','wilderness');
room(reservoir5,-180,-160,24,20,5.0);roofLink(reservoir5,-180,-160,5.0);
room(reservoir5,180,160,22,18,6.0);roofLink(reservoir5,180,160,6.0);
room(reservoir5,180,-160,20,16,5.4);roofLink(reservoir5,180,-160,5.4);
for(const [x,z,w,d,h]of [[-200,120,26,20,4.2],[220,220,22,18,3.8],[-260,-220,30,22,4.0]])box(reservoir5,x,z,w,d,h,0,'rock');
deck(reservoir5,0,0,260,10,1.6);
reservoir5.props.push({kind:'basin',x:0,y:.01,z:0,w:220,d:70},{kind:'pump',x:-220,y:0,z:-190},{kind:'waterTower',x:220,y:0,z:-200});
for(const [x,z]of [[-150,-20],[150,20],[180,220]])reservoir5.props.push({kind:'floodlight',x,y:0,z});
cache(reservoir5,-260,60,0,'Ranger cache');
cache(reservoir5,-180,-160,1,'Pump stores');
cache(reservoir5,-174,-153,2,'Pump roof observation',5.22);
cache(reservoir5,180,160,1,'Watch station stores');
cache(reservoir5,186,167,2,'Watch tower roof',6.22);
cache(reservoir5,0,0,2,'Basin bridge inspection',1.8);
cache(reservoir5,200,-140,2,'Tower equipment');
cache(reservoir5,-20,240,0,'Fuel cache');
cache(reservoir5,180,-160,3,'Intake roof locker',5.62);
cache(reservoir5,240,-220,1,'Intake supplies');
cache(reservoir5,-240,-80,1,'Survey camp');
cache(reservoir5,-40,-260,3,'Sealed pump vault',0,true);
landmark(reservoir5,'Pump House',-180,-160,20);landmark(reservoir5,'Watch Station',180,160,20);landmark(reservoir5,'Dry Basin',0,0,24);landmark(reservoir5,'Rock Cut',-200,120,18);landmark(reservoir5,'Intake Tower',180,-160,18);
reservoir5.hazards.push({id:'coolant_vent',name:'Coolant vent',x:60,y:0,z:60,radius:7,period:70,active:10,warning:5,damage:7});
scatterBig(reservoir5,7719);

const switchyard5=arena('switchyard','Ember Switchyard','settlement');
room(switchyard5,-180,-120,26,20,5.0);roofLink(switchyard5,-180,-120,5.0);
room(switchyard5,0,-140,22,20,4.6);
room(switchyard5,160,140,30,24,5.2);roofLink(switchyard5,160,140,5.2);
for(const z of [-60,40])for(const x of [-220,-160,-100,60,120,200])box(switchyard5,x,z,14,4,2.5,0,'container');
deck(switchyard5,-80,0,200,10,2.8);
for(const z of [-100,100])switchyard5.props.push({kind:'rail',x:0,y:.02,z,w:600,d:2.2});
for(const [x,z]of [[-220,-180],[220,-180],[-220,180],[220,180]])switchyard5.props.push({kind:'signal',x,y:0,z});
for(const [x,z]of [[-150,-20],[150,20],[-80,-40]])switchyard5.props.push({kind:'floodlight',x,y:0,z});
switchyard5.props.push({kind:'crane',x:220,y:0,z:220},{kind:'wreck',x:220,y:0,z:-160},{kind:'antenna',x:0,y:0,z:-140});
cache(switchyard5,-260,-40,0,'Trackside salvage');
cache(switchyard5,-180,-120,1,'Freight office stores');
cache(switchyard5,160,140,2,'Depot stores');
cache(switchyard5,-174,-113,2,'Freight roof platform',5.22);
cache(switchyard5,-80,0,2,'Bridge signal box',3.0);
cache(switchyard5,-40,-200,0,'Worker camp');
cache(switchyard5,220,-160,2,'Burned carriage');
cache(switchyard5,220,220,0,'Fuel depot');
cache(switchyard5,160,140,3,'Depot roof strongbox',5.42);
cache(switchyard5,200,-40,1,'Platform luggage');
cache(switchyard5,0,240,1,'Evacuation stores');
cache(switchyard5,0,-140,3,'Locked dispatch vault',0,true);
landmark(switchyard5,'Freight Office',-180,-120,20);landmark(switchyard5,'Dispatch',0,-140,20);landmark(switchyard5,'Ember Depot',160,140,20);landmark(switchyard5,'Transfer Bridge',-80,0,16);landmark(switchyard5,'Rail Corridor',0,0,24);
switchyard5.hazards.push({id:'live_rail',name:'Live rail discharge',x:60,y:0,z:-100,radius:8,period:60,active:9,warning:5,damage:9});
scatterBig(switchyard5,2033);

const authoredWorlds=[relay,reservoir,switchyard];
export const ARCHIVED_RAID_WORLDS=authoredWorlds.map(world=>structuredClone(world));
// Keep v2 checkpoints intact. The v3 landing meets the top of each roof ramp,
// instead of blocking its middle and forcing a precision climb along its edge.
const V3_RAID_WORLDS=authoredWorlds.map(world=>{const v3=structuredClone(world);v3.version=3;for(const ramp of v3.ramps.filter(r=>r.axis==='z'&&r.w===4&&r.d===16)){
 const landing=v3.blocks.find(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+7&&w===7&&d===4&&h===.18);if(landing)landing[1]+=2;
}
 return v3;
});
// Version 4 keeps the corrected v3 landings but triples every authored district
// and its footprints, producing a 480 x 480 sector for existing checkpoints.
const V4_RAID_WORLDS=V3_RAID_WORLDS.map(world=>enlargedWorld(world,3));
// Version 5 authored layout: a 720 x 720 sector with connected districts and
// elevated routes. Version 6 keeps identical connections but doubles every
// shipped district footprint, producing a genuinely massive 1,440 x 1,440 m
// sector (over seven times the area of Skyline Island) for current deployments.
const V5_RAID_WORLDS=[relay5,reservoir5,switchyard5];
const V6_RAID_WORLDS=V5_RAID_WORLDS.map(world=>enlargedWorld(world,2,6));
// Version 7 keeps v6's footprint and districts but dresses the open ground with
// dense compounds, ruins, groves, outcrops, vehicles and field clutter. v6
// remains available so in-flight checkpoints restore their exact layout.
const V7_RAID_WORLDS=V6_RAID_WORLDS.map(world=>dressWorld(world,({relay:0x5ec1a3,reservoir:0x1e5e77,switchyard:0x91e04c})[world.id]||9271));
// Version 8 dresses the approach to each insertion point as a street settlement
// and adds two interior town districts per sector. V7 is frozen for checkpoints
// created before the settlement pass; V6 and V5 remain frozen as well.
const V8_RAID_WORLDS=V7_RAID_WORLDS.map(world=>urbanizeWorld(world,({relay:0x8fca5b,reservoir:0x2a7d52,switchyard:0xd38b4a})[world.id]||24601));
export const RAID_WORLDS=V8_RAID_WORLDS;
// Old checkpoints still resolve their exact layouts for versions 1-8.
export function getWorld(id,version=8){return (version===1?LEGACY_RAID_WORLDS:version===2?ARCHIVED_RAID_WORLDS:version===3?V3_RAID_WORLDS:version===4?V4_RAID_WORLDS:version===5?V5_RAID_WORLDS:version===6?V6_RAID_WORLDS:version===7?V7_RAID_WORLDS:version===8?V8_RAID_WORLDS:[]).find(w=>w.id===id)}
// Dressed sectors hold hundreds of building blocks; a spatial hash keeps
// collision and floor queries proportional to nearby geometry instead of
// scanning every block. Static game worlds never invalidate this cache, while
// tests and editors that push/rebind blocks rebuild it on length changes.
function blockGrid(blocks){
 let grid=blockGrids.get(blocks);
 if(grid&&grid.count===blocks.length)return grid;
 const cell=24,cells=new Map();
 for(const block of blocks){
  const [x,z,w,d]=block,x0=Math.floor((x-w/2)/cell),x1=Math.floor((x+w/2)/cell),z0=Math.floor((z-d/2)/cell),z1=Math.floor((z+d/2)/cell);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const key=i*65536+j;let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(block)}
 }
 grid={count:blocks.length,cells,cell};blockGrids.set(blocks,grid);return grid;
}
function nearbyBlocks(world,x,z,r=0){
 const grid=blockGrid(world.blocks),cell=grid.cell,minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);
 if(minX===maxX&&minZ===maxZ)return grid.cells.get(minX*65536+minZ)||[];
 const out=[];
 for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){const list=grid.cells.get(i*65536+j);if(list)for(const block of list)out.push(block)}
 return out;
}
export function blocked(world,x,z,r=.5,y=0,height=1.7){
 if(Math.abs(x)>world.size/2-r||Math.abs(z)>world.size/2-r)return true;
 if(nearbyBlocks(world,x,z,r).some(([bx,bz,w,d,h,base=0])=>Math.abs(x-bx)<w/2+r&&Math.abs(z-bz)<d/2+r&&y+height>base+.04&&y<base+h-.04))return true;
 return (world.ramps||[]).some(ramp=>{const level=rampLevel(ramp,x,z);return level!=null&&y<level-.04&&y+height>level-.12});
}
export function rampLevel(r,x,z){if(Math.abs(x-r.x)>r.w/2||Math.abs(z-r.z)>r.d/2)return null;const t=r.axis==='x'?(x-r.x)/r.w+.5:(z-r.z)/r.d+.5;return r.from+(r.to-r.from)*t}
export function floorAt(world,x,z,ceiling=Infinity){
 let y=0;
 for(const [bx,bz,w,d,h,base=0]of nearbyBlocks(world,x,z))if(Math.abs(x-bx)<=w/2&&Math.abs(z-bz)<=d/2&&base+h<=ceiling+.01)y=Math.max(y,base+h);
 for(const ramp of world.ramps||[]){const level=rampLevel(ramp,x,z);if(level!=null&&level<=ceiling+.01)y=Math.max(y,level)}
 return y;
}
// A body's footprint remains supported by a platform while it overlaps its
// edge. Center-only support drops the feet into the platform's side and traps
// operators when descending an adjoining ramp.
export function supportAt(world,x,z,ceiling=Infinity,radius=.45){
 let y=floorAt(world,x,z,ceiling);
 for(const [bx,bz,w,d,h,base=0]of nearbyBlocks(world,x,z,radius))if(Math.abs(x-bx)<w/2+radius&&Math.abs(z-bz)<d/2+radius&&base+h<=ceiling+.01)y=Math.max(y,base+h);
 return y;
}
export function clearLine(world,x,z,tx,tz,fromY=1.6,toY=1.6){const distance=Math.hypot(tx-x,tz-z),steps=Math.ceil(distance/.35);for(let i=1;i<steps;i++){const t=i/steps;if(blocked(world,x+(tx-x)*t,z+(tz-z)*t,0,fromY+(toY-fromY)*t,.02))return false}return true}
