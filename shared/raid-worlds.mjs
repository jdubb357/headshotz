// Original raid layouts shared by rendering and authoritative collision checks.
const blockGrids=new WeakMap();
// Declared up front because the frozen sector builders call blocked() during
// module initialisation, before the prop APIs at the bottom of this file.
const propGrids=new WeakMap();
// Decor collision grids derive from deterministic scenery/doorway/spawn data,
// so online authority, offline in-page rules and both builders agree. Scenery
// is memoized per sector; it must not see decor collision while selecting
// plant/ruin sites (see the ignoreDecor control flow in blocked()).
const decorGrids=new WeakMap(),sceneryCache=new WeakMap(),doorwayCache=new WeakMap();
const FOOTPRINT={
 car:p=>{const s=p.scale||1;return {hw:1.15*s+.12,hd:.62*s+.12,h:1.75*s}},
 truck:p=>{const s=p.scale||1;return {hw:3.05*s+.2,hd:1.25*s+.1,h:2.1*s}},
 tank:p=>{const s=p.scale||1;return {hw:1.3*s,hd:1.3*s,h:3.25*s}},
 dumpster:p=>{const s=p.scale||1;return {hw:1.1*s,hd:.68*s,h:1.5*s}},
 crate:p=>{const s=p.scale||1;return {hw:.62*s,hd:.62*s,h:1.15*s}},
 barrel:p=>{const s=p.scale||1;return {hw:.55*s,hd:.55*s,h:1.35*s}},
 sandbag:p=>{const s=p.scale||1;return {hw:.8*s,hd:.5*s,h:.7*s}},
 pallet:p=>{const s=p.scale||1;return {hw:.72*s,hd:.55*s,h:.8*s}},
 hay:p=>{const s=p.scale||1;return {hw:1*s,hd:.64*s,h:1.35*s}},
 wreck:()=>({hw:3.0,hd:1.25,h:2.0}),
 scrap:()=>({hw:.95,hd:.66,h:.95}),
 rock:p=>{const s=p.scale||1;return {hw:1.35*s,hd:1.15*s,h:.9*s}},
 tree:p=>{const s=p.scale||1;return {hw:.3*s,hd:.3*s,h:1.2*s}},
 stump:p=>{const s=p.scale||1;return {hw:.34*s,hd:.34*s,h:1.3*s}}
};
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
function box(m,x,z,w,d,h,y=0,material='concrete',color=undefined){m.blocks.push(color==null?[x,z,w,d,h,y,material]:[x,z,w,d,h,y,material,color])}
function room(m,x,z,w,d,h,doors=['n','s'],wallKind='brick',roofKind='roof',tint=undefined){
 for(const side of ['n','s','e','w']){
  const horizontal=side==='n'||side==='s',length=horizontal?w:d,sign=side==='n'||side==='w'?-1:1;
  const wall=(offset,size,height,base=0)=>box(m,x+(horizontal?offset:sign*w/2),z+(horizontal?sign*d/2:offset),horizontal?size:.45,horizontal?.45:size,height,base,wallKind,tint);
  if(doors.includes(side)){const segment=(length-3.4)/2;for(const s of [-1,1])wall(s*(length+3.4)/4,segment,h);wall(0,3.4,h-2.8,2.8)}
  else{wall(0,length,1.1);wall(0,length,h-2.2,2.2);for(let a=-length/2;a<=length/2;a+=3)wall(a,.45,h)}
 }
 box(m,x,z,w+.8,d+.8,.22,h,roofKind);
 m.props.push({kind:'floor',x,y:.02,z,w:w-.5,d:d-.5,color:wallKind==='planks'?0x6b5137:0x62615d},{kind:'lamp',x,y:h-.5,z});
}
function cache(m,x,z,tier,name,y=0,vault=false){m.caches.push([x,z,y]);m.cacheMeta.push({tier,name,vault})}
// Interactive doors are authored at the same wall gaps the room builder leaves
// for movement. Descriptors remain axis-aligned boxes so shared collision, LOS
// and ballistics can test them without knowing which wall side produced them.
function doorsForRoom(m,x,z,w,d,h,sides,label,locked=false){
 for(const side of sides){
  if(!['n','s','e','w'].includes(side))continue;
  const horizontal=side==='n'||side==='s',sign=side==='n'||side==='w'?-1:1;
  m.doorSeq=(m.doorSeq||0)+1;
  m.doors.push({id:m.id+'-door-'+String(m.doorSeq).padStart(2,'0'),x:horizontal?x:x+sign*w/2,y:0,z:horizontal?z+sign*d/2:z,
   w:horizontal?3.4:.32,d:horizontal?.32:3.4,h,side,label,locked,closed:false});
 }
}
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
 enlarged.doors=(enlarged.doors||[]).map(door=>({...door,x:door.x*factor,z:door.z*factor,w:door.w*factor,d:door.d*factor,closed:!!door.closed}));
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
 return {id,name,theme,version:5,size:720,blocks:[],ramps:[],props:[],landmarks:[],hazards:[],caches:[],cacheMeta:[],doors:[],doorSeq:0,
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
function warehouse(m,x,z,R,tint=undefined){
 const w=32+Math.round(R()*22),d=22+Math.round(R()*14),h=6+Math.round(R()*4);
 if(!clearFootprint(m,x,z,w,d,7))return false;
 room(m,x,z,w,d,h,R()<.5?['n','s']:['e','w'],'concrete','roof',tint);rooftop(m,x,z,w,d,h,R);
 for(let i=0;i<2+Math.round(R()*3);i++)box(m,x+(R()-.5)*w*.55,z+(R()-.5)*d*.55,1.6,1.6,1.1,.02,'crate');
 return true;
}
function house(m,x,z,R,wallKind='brick',roofKind='roof',tint=undefined){
 const w=14+Math.round(R()*12),d=12+Math.round(R()*8),h=3.6+Math.round(R()*2.4);
 if(!clearFootprint(m,x,z,w,d,6))return false;
 room(m,x,z,w,d,h,R()<.5?['s']:['n','e'],wallKind,roofKind,tint);
 if(R()<.55)box(m,x+(R()-.5)*w*.35,z+d*.28,1.1,1.1,2.6,h+.22,'brick');
 return true;
}
function ruin(m,x,z,R,wallKind='brick',tint=undefined){
 const w=12+Math.round(R()*18),d=8+Math.round(R()*14),h=2+Math.round(R()*1.5);
 if(!clearFootprint(m,x,z,w,d,5))return false;
 box(m,x-w/3,z-d/2,w/3,.42,h,0,wallKind,tint);box(m,x+w/4,z-d/2,w/3,.42,h-.4,0,wallKind,tint);
 box(m,x-w/2,z+d*.15,.42,d*.55,h-.6,0,wallKind,tint);
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
function shed(m,x,z,R,wallKind='metal',roofKind='metal',tint=undefined){
 const w=12+Math.round(R()*10),d=10+Math.round(R()*8),h=3.2+Math.round(R()*2);
 if(!clearFootprint(m,x,z,w,d,5))return false;
 room(m,x,z,w,d,h,['s'],wallKind,roofKind,tint);return true;
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

function townBuilding(m,x,z,R,theme,facing,names,wallOverride=null){
 const walls=theme==='wilderness'?['planks','brick','concrete']:theme==='settlement'?['brick','brick','concrete','planks']:['brick','concrete','planks','metal'];
 // Consume the original random draw even when the caller pins a wall kind, so
 // every later dimension and window in the deterministic layout is unchanged.
 const wallPick=R();
 const wall=wallOverride||walls[Math.floor(wallPick*walls.length)];
 const tint=tintFor(theme,x,z,wall);
 const w=12+Math.floor(R()*9),d=11+Math.floor(R()*7);
 const h=4.2+R()*1.8,floors=R()<(theme==='reservoir'?.22:.36)?2:1;
 if(!clearFootprint(m,x,z,w,d,5))return false;
 room(m,x,z,w,d,h,R()<.5?['n','e']:['s','w'],wall,'roof',tint);
 let top=h;
 if(floors===2){
  const up=2.8+R()*.7;
  box(m,x,z,w-.4,d-.4,up,h,wall,tint);
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

const WALL_CYCLES={
 industrial:['planks','brick','concrete','metal','concrete','brick','planks','concrete','brick','metal','metal','concrete'],
 wilderness:['planks','planks','brick','concrete','planks','brick','planks','concrete','brick','planks','concrete','brick'],
 settlement:['brick','concrete','brick','planks','metal','brick','concrete','brick','planks','brick','metal','concrete']
};
function settlement(m,cx,cz,R,theme,names,district=false,facingHint){
 townStreet(m,cx,cz,district?16:14,district?240:220);
 const lots=district
  ?[[-72,-48],[-36,-54],[0,-56],[36,-54],[72,-48],[-86,-14],[-86,20],[-72,54],[-36,58],[0,58],[36,58],[72,54],[86,-14],[86,20]]
  :[[-46,-32],[-46,-2],[-46,28],[46,-32],[46,-2],[46,28],[-15,-46],[17,-46],[-15,44],[17,44],[-78,-26],[78,24]];
 // A deterministic material rotation gives each settlement street a legible
 // mix of concrete, brick, metal siding and timber instead of a row of the
 // same warm plank facade. Only the surface material changes; footprints,
 // heights, windows and doorway gaps are untouched.
 const wallCycle=(WALL_CYCLES[theme]||WALL_CYCLES.industrial);
 let built=0;
 for(const [k,[lx,lz]] of lots.entries()){
  const x=cx+lx,z=cz+lz;
  const facing=Math.abs(lx)>=Math.abs(lz)?(lx<0?'e':'w'):(lz<0?'s':'n');
  if(townBuilding(m,x,z,R,theme,R()<.7?facing:facingHint||facing,names,wallCycle[k%wallCycle.length]))built++;
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

// ---------------------------------------------------------------------------
// Version 9: full-sector district fabric. Version 8 turned spawn approaches
// into street settlements, but most of the 1,440 m ground plane between them
// still read as bare concrete. Version 9 fills every 240 m cell with authored
// neighbourhoods and threads a road grid through the sector. Blocks are real
// collision geometry (the server and offline builder cannot disagree); roads,
// fences, fields, furniture and vegetation stay visual props.
// ---------------------------------------------------------------------------
function wallKindFor(theme,R){
 const kinds=theme==='wilderness'?['planks','planks','brick']:theme==='settlement'?['brick','brick','concrete','planks']:['concrete','metal','brick','concrete'];
 return kinds[Math.floor(R()*kinds.length)];
}
const BUILDING_TINTS={
 industrial:[0xbfc3ba,0xa8b0ae,0xd0c7b4,0x9eaaa4,0xb99e7c,0x8e9a96,0xc7b49a],
 wilderness:[0xa98f69,0xbb9b70,0x8c7a56,0xc0a379,0x9a865f,0x8a704f],
 settlement:[0xc08862,0xb99673,0xd1a47b,0xaa8067,0xbfa088,0x9f8a74,0xc5b29a]
};
// Walls read by material, not by theme alone: concrete is pale cool cement,
// brick is a muted fired clay, metal is galvanised siding, timber is weathered
// grey-brown. The tints multiply the shared white-ish surface maps, so a metal
// block no longer inherits the warm tan that made every facade look like planks.
const WALL_TINTS={
 industrial:{
  concrete:[0xb7b8ae,0xabaea8,0xc2c1b8,0x9da3a1,0xbfbdb0],
  brick:[0x9a7d6c,0x8d6f61,0xa78b7a,0x7f6357,0x94796b],
  metal:[0xc4c6bf,0xb4b8b2,0xcbcdc6,0xa5a9a3,0xbcc0b8],
  planks:[0x8a7b66,0x7c6e59,0x95866f,0x6d6053,0x9b8a74]
 },
 wilderness:{
  concrete:[0xa9aba2,0x9fa59d,0xb4b3a8],
  brick:[0x9b7663,0x8e6b58,0xb0836d],
  metal:[0x969a94,0x878c88,0x9c9f99],
  planks:[0x957d5f,0x8a7357,0xa38c6b,0x796446]
 },
 settlement:{
  concrete:[0xb8b2a4,0xcac4b6,0xaba598,0xbfb5a4],
  brick:[0x9e6752,0x8d5c48,0xb4795f,0x835344,0xa97a64],
  metal:[0x929693,0x838884,0x9fa3a0],
  planks:[0x93755a,0x877058,0xa0856b,0x775d45]
 }
};
const ROOF_TINTS={
 industrial:[0x3f4b4e,0x505a58,0x5e5d4c,0x465d5b],
 wilderness:[0x4f5847,0x5f5f4c,0x6c5d49,0x45584a],
 settlement:[0x53545e,0x6a5b50,0x5f6672,0x7a6b5c,0x4d4948]
};
function tintFor(theme,x,z,kind=null){
 const list=(kind&&WALL_TINTS[theme]&&WALL_TINTS[theme][kind])||BUILDING_TINTS[theme]||BUILDING_TINTS.industrial;
 return list[Math.round(Math.abs((x*7+z*13+(x+z)*3)))%list.length];
}
function roofTintFor(theme,x,z){
 const list=ROOF_TINTS[theme]||ROOF_TINTS.industrial;
 return list[Math.round(Math.abs((x*11+z*5+(x-z)*7)))%list.length];
}
function facadeWindows(m,x,z,w,d,base,h,R,axis,side,litChance=.5){
 const first=base+1.2,last=base+h-1,colors=[0xffd58b,0xffc36f,0xffe8b0,0xcfe4ff];
 const along=axis==='z'?w:d,n=Math.max(1,Math.min(3,Math.floor(along/6)));
 for(let y=first;y<=last;y+=2.6)for(let i=0;i<n;i++){
  const t=n===1?0:(i-(n-1)/2)*(along*.7/(n-1)),lit=R()<litChance,color=colors[Math.floor(R()*colors.length)];
  if(axis==='z')m.props.push({kind:'window',x:x+t,y:y-.65,z:z+side*(d/2+.3),w:1.2,d:.16,h:1.35,lit,color});
  else m.props.push({kind:'window',x:x+side*(w/2+.3),y:y-.65,z:z+t,w:.16,d:1.2,h:1.35,lit,color});
 }
}
function fenceSegment(m,x,z,w,d,ry=0,color=0x7e8a90){m.props.push({kind:'fence',x,z,y:0,w,d,ry,color})}
function hedgeSegment(m,x,z,w,d,ry=0,color=0x4b7046){m.props.push({kind:'hedge',x,z,y:0,w,d,ry,color})}
function fieldPatch(m,x,z,w,d,color){m.props.push({kind:'field',x,z,y:.018,w,d,color:color??(m.theme==='wilderness'?0x5d7248:0x6d745f)})}
function hayProp(m,x,z,scale=1){m.props.push({kind:'hay',x,z,y:0,scale})}
function billboardProp(m,x,z,name,color=0x6e8a7d){m.props.push({kind:'billboard',name,x,y:0,z,color})}
function truckProp(m,x,z,R,color){m.props.push({kind:'truck',x,z,y:0,scale:.8+R()*.5,color:color??[0x55606b,0x7a5d40,0x4c6b55,0x8b7048][Math.floor(R()*4)]})}
function palletProp(m,x,z,scale=1){m.props.push({kind:'pallet',x,z,y:0,scale})}
function binProp(m,x,z,scale=1,color=0x4e6550){m.props.push({kind:'dumpster',x,z,y:0,scale,color})}
function addUnit(m,cx,cz,w,d,R,theme,height){
 // Mixed heights make the district skyline read as a town rather than a row of
 // identical flat boxes: shops/stables, mid-rise blocks and the occasional
 // taller apartment or silo.
 const h=height??(R()<.22?10+R()*7.5:R()<.45?7.4+R()*2.2:4.4+R()*2.2);
 if(!clearFootprint(m,cx,cz,w,d,2.5))return false;
 const wall=wallKindFor(theme,R),tint=tintFor(theme,cx,cz,wall);
 box(m,cx,cz,w,d,h,0,wall,tint);
 box(m,cx,cz,w+.7,d+.7,.24,h,'roof',roofTintFor(theme,cx,cz));
 facadeWindows(m,cx,cz,w,d,0,h,R,'z',1,.45);
 facadeWindows(m,cx,cz,w,d,0,h,R,'z',-1,.4);
 facadeWindows(m,cx,cz,w,d,0,h,R,'x',1,.35);
 rooftop(m,cx,cz,w,d,h,R);
 return true;
}
function rowHouses(m,cx,cz,units,R,theme,horiz=true){
 const uw=8+Math.floor(R()*4),depth=12+Math.floor(R()*4);
 const totalW=horiz?units*uw:depth,totalD=horiz?depth:units*uw;
 const wall=wallKindFor(theme,R),h=R()<.35?7.2+R()*1.8:4.6+R()*2.2;
 if(!clearFootprint(m,cx,cz,totalW,totalD,2))return 0;
 for(let i=0;i<units;i++){
  const x=horiz?cx+(i-(units-1)/2)*uw:cx,z=horiz?cz:cz+(i-(units-1)/2)*uw;
  const uW=horiz?uw:depth,uD=horiz?depth:uw;
  box(m,x,z,uW-.2,uD-.2,h,0,wall,tintFor(theme,x,z,wall));
  facadeWindows(m,x,z,uW-.2,uD-.2,0,h,R,horiz?'z':'x',1,.55);
  facadeWindows(m,x,z,uW-.2,uD-.2,0,h,R,horiz?'z':'x',-1,.5);
  if(R()<.22){
   if(horiz)m.props.push({kind:'awning',x,y:2.2,z:z+(uD/2+.55),w:uW*.82,d:1.2,color:R()<.5?0x8d382e:0x41625c});
   else m.props.push({kind:'awning',x:x+(uW/2+.55),y:2.2,z,w:1.2,d:uD*.82,color:R()<.5?0x8d382e:0x41625c});
  }
  if(R()<.12){
   const name=TOWN_NAMES[m.id][Math.floor(R()*TOWN_NAMES[m.id].length)];
   if(horiz)m.props.push({kind:'sign',name,x,y:3,z:z+uD/2+.42});
   else m.props.push({kind:'sign',name,x:x+uW/2+.42,y:3,z});
  }
 }
 box(m,cx,cz,totalW+.7,totalD+.7,.24,h,'roof',roofTintFor(theme,cx,cz));
 rooftop(m,cx,cz,totalW,totalD,h,R);
 return units;
}
function residentialCell(m,cx,cz,R){
 fieldPatch(m,cx,cz,30,30,0x6f755c);
 for(const row of [[0,-48,4+Math.round(R()*2),true],[0,48,4+Math.round(R()*2),true],[-48,0,3+Math.round(R()*2),false],[48,0,3+Math.round(R()*2),false]])rowHouses(m,cx+row[0],cz+row[1],row[2],R,'settlement',row[3]);
 for(const [dx,dz] of [[-82,-82],[82,-82],[-82,82],[82,82],[0,-92],[0,92]])if(R()<.8)addUnit(m,cx+dx,cz+dz,14+R()*9,12+R()*7,R,'settlement');
 for(const [dx,dz] of [[-72,-72],[72,-72],[-72,72],[72,72],[0,74],[0,-74]])if(R()<.9)addUnit(m,cx+dx,cz+dz,12+R()*8,11+R()*7,R,'settlement');
 addUnit(m,cx-84,cz+4,11+R()*6,10+R()*5,R,'settlement');addUnit(m,cx+84,cz-4,11+R()*6,10+R()*5,R,'settlement');
 // Keep the district fabric dense out to the cell edges instead of leaving a
 // bare ring between neighbourhoods.
 for(const [dx,dz] of [[-96,0],[96,0],[0,-96],[0,96],[-96,-96],[96,-96],[-96,96],[96,96]])if(R()<.86)addUnit(m,cx+dx,cz+dz,12+R()*7,11+R()*6,R,'settlement');
 if(R()<.35)m.props.push({kind:'basin',x:cx+3,y:.02,z:cz,w:20,d:13,color:0x4d7d86});
 for(const dx of [-26,26])for(const dz of [-22,22])if(R()<.4)m.props.push({kind:'bench',x:cx+dx,z:cz+dz,y:0,scale:.9});
 for(let i=0;i<7;i++){
  const a=R()*Math.PI*2,r=16+R()*24,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,roll=R();
  if(roll<.32)m.props.push({kind:'bench',x,z,y:0,scale:1});
  else if(roll<.58)m.props.push({kind:'planter',x,z,y:0,scale:.8+R()*.4});
  else if(roll<.75)m.props.push({kind:'tent',x,z,y:0,scale:.72+R()*.3,color:0x8a9b7a});
  else binProp(m,x,z,.7+R()*.3,0x4e6550);
 }
 for(let i=0;i<3;i++){const side=i%2?-1:1,x=cx+side*(52+R()*44),z=cz+(R()*2-1)*70;if(clearFootprint(m,x,z,1.4,2.8,1))m.props.push({kind:'car',x,z,y:0,scale:.7+R()*.4,color:_car(R)})}
 for(let i=0;i<4;i++){const side=i<2?-1:1;if(i%2)fenceSegment(m,cx+side*64,cz+(R()*2-1)*30,4,18,Math.PI/2,0x7b858c);else fenceSegment(m,cx+(R()*2-1)*30,cz+side*64,18,4,0,0x7b858c)}
 for(let i=0;i<9;i++){const a=R()*Math.PI*2,r=26+R()*32,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;if(R()<.45)hedgeSegment(m,x,z,2.4+R()*2.4,2.2,0,0x477045);else addTree(m,x,z,R,[0x556b4f,0x6d835f,0x47583d])}
}
function industrialCell(m,cx,cz,R){
 warehouse(m,cx-28,cz-40,R,tintFor('industrial',cx-28,cz-40,'concrete'));shed(m,cx+40,cz-38,R,'metal','metal',tintFor('industrial',cx+40,cz-38,'metal'));containers(m,cx-42,cz+38,R);containers(m,cx+42,cz+40,R);
 const fw=30+Math.round(R()*16),fd=20+Math.round(R()*12),fh=7+Math.round(R()*4),fx=cx+15,fz=cz-4;
 if(clearFootprint(m,fx,fz,fw,fd,3)){
  box(m,fx,fz,fw,fd,fh,0,'concrete',tintFor('industrial',fx,fz,'concrete'));box(m,fx,fz,fw+.8,fd+.8,.28,fh,'roof',roofTintFor('industrial',fx,fz));
  facadeWindows(m,fx,fz,fw,fd,0,fh,R,'z',1,.3);facadeWindows(m,fx,fz,fw,fd,0,fh,R,'z',-1,.25);
  rooftop(m,fx,fz,fw,fd,fh,R);
  m.props.push({kind:'floor',x:fx,y:.02,z:fz+fd/2+9,w:fw*.9,d:12,color:0x7b807a});
 }
 cratePile(m,cx+18,cz+24,R);cratePile(m,cx-62,cz-4,R);cratePile(m,cx-2,cz+64,R);
 m.props.push({kind:'tank',x:cx+58,y:0,z:cz-6,scale:.9+R()*.5,color:0x7f8b84});
 m.props.push({kind:'tank',x:cx-58,y:0,z:cz+58,scale:.8+R()*.4,color:0x6b7f72});
 for(let i=0;i<4;i++){const a=R()*Math.PI*2,r=24+R()*54,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,roll=R();
  if(roll<.45){if(clearFootprint(m,x,z,1.5,1.5,.5))m.props.push({kind:'barrel',x,z,y:0,scale:.8+R()*.5,color:0x4b5344})}
  else if(roll<.75)palletProp(m,x,z,.8+R()*.5);
  else truckProp(m,x,z,R);
 }
 for(let i=0;i<4;i++)fenceSegment(m,cx+(R()*2-1)*80,cz+(R()*2-1)*80,12,3,0,0x666f74);
 for(let i=0;i<6;i++)addTree(m,cx+(R()*2-1)*86,cz+(R()*2-1)*86,R,[0x556b4f,0x6d835f,0x47583d]);
 fieldPatch(m,cx+(R()<.5?-1:1)*72,cz+(R()*2-1)*52,28,20,0x5e6a50);
 for(let i=0;i<4;i++)hedgeSegment(m,cx+(R()*2-1)*72,cz+(R()*2-1)*66,2+R()*2.4,1.8,0,0x477045);
 const chx=cx+(R()<.5?-1:1)*58,chz=cz+(R()<.5?-1:1)*58,ch=19+R()*9;
 if(clearFootprint(m,chx,chz,5,5,7)){box(m,chx,chz,5,5,ch-1,0,'concrete');box(m,chx,chz,5.6,5.6,.5,0,'barrier');box(m,chx,chz,4.2,4.2,1.2,ch-1,'metal')}
}
function ruralCell(m,cx,cz,R){
 if(R()<.5){
  fieldPatch(m,cx-12,cz-8,116,78,0x5d7248);fieldPatch(m,cx+44,cz+44,54,38,0x6a7a52);
  house(m,cx-48,cz-40,R,'planks','planks',tintFor('wilderness',cx-48,cz-40,'planks'));shed(m,cx-22,cz-56,R,'planks','planks',tintFor('wilderness',cx-22,cz-56,'planks'));shed(m,cx+54,cz-34,R,'planks','planks',tintFor('wilderness',cx+54,cz-34,'planks'));
  const bw=34+Math.round(R()*16),bd=20+Math.round(R()*10),bh=7+R()*2,bx=cx+12,bz=cz+12;
  if(clearFootprint(m,bx,bz,bw,bd,4)){box(m,bx,bz,bw,bd,bh,0,'planks',tintFor('wilderness',bx,bz,'planks'));box(m,bx,bz,bw+.9,bd+.9,.3,bh,'roof',roofTintFor('wilderness',bx,bz));facadeWindows(m,bx,bz,bw,bd,0,bh,R,'z',1,.45);facadeWindows(m,bx,bz,bw,bd,0,bh,R,'z',-1,.4)}
  m.props.push({kind:'tank',x:cx+46,y:0,z:cz+2,scale:.8+R()*.5,color:0x9a9a8a});
  m.props.push({kind:'tank',x:cx-56,y:0,z:cz+34,scale:.6+R()*.4,color:0x7b8b7c});
  for(let i=0;i<9;i++)hayProp(m,cx+(R()*2-1)*70,cz+(R()*2-1)*58,.8+R()*.5);
  truckProp(m,cx-24,cz+16,R,0x8a7350);
  for(let i=0;i<3;i++)fenceSegment(m,cx+((i%2)*2-1)*72,cz+(R()*2-1)*40,5,28,Math.PI/2,0x79654e);
  for(let i=0;i<4;i++)addTree(m,cx+(R()*2-1)*76,cz+(R()*2-1)*72,R,[0x3b6b40,0x4b7d49,0x2f5636,0x5b8a4f]);
 }else{
  fieldPatch(m,cx,cz,26,26,0x6a704f);
  for(const [dx,dz] of [[-58,-42],[56,-40],[-54,42],[52,44],[-18,-62],[24,58]]){
   const roll=R(),tint=tintFor('wilderness',cx+dx,cz+dz,'planks');if(roll<.55)house(m,cx+dx,cz+dz,R,'planks','planks',tint);else if(roll<.8)ruin(m,cx+dx,cz+dz,R,'planks',tint);else shed(m,cx+dx,cz+dz,R,'planks','planks',tint);
  }
  m.props.push({kind:'campfire',x:cx,z:cz,y:0,scale:.8,color:0xffb64d});
  for(const [dx,dz] of [[-11,-7],[11,7],[-9,10],[10,-9]])m.props.push({kind:'tent',x:cx+dx,z:cz+dz,y:0,scale:.75+R()*.3,color:0x8a9b7a});
  for(let i=0;i<4;i++){const a=R()*Math.PI*2,r=14+R()*16,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;m.props.push({kind:R()<.5?'barrel':'crate',x,z,y:0,scale:.7+R()*.4,color:R()<.5?0x4b5344:0x9c7b4d})}
  for(let i=0;i<3;i++)fenceSegment(m,cx+(R()*2-1)*52,cz+(R()*2-1)*52,2,18,0,0x79654e);
  for(let i=0;i<6;i++)hedgeSegment(m,cx+(R()*2-1)*66,cz+(R()*2-1)*60,2+R()*3,2.4,0,0x477045);
  for(let i=0;i<16;i++)addTree(m,cx+(R()*2-1)*82,cz+(R()*2-1)*76,R,[0x3b6b40,0x4b7d49,0x2f5636,0x5b8a4f]);
 }
}
function marketCell(m,cx,cz,R){
 townBuilding(m,cx-38,cz-34,R,'settlement',R()<.5?'s':'n',TOWN_NAMES[m.id]);
 townBuilding(m,cx+38,cz-34,R,'settlement',R()<.5?'s':'n',TOWN_NAMES[m.id]);
 townBuilding(m,cx-38,cz+36,R,'settlement',R()<.5?'n':'s',TOWN_NAMES[m.id]);
 townBuilding(m,cx+38,cz+36,R,'settlement',R()<.5?'n':'s',TOWN_NAMES[m.id]);
 fieldPatch(m,cx,cz,32,26,0x7d7868);
 for(let i=0;i<8;i++){
  const a=R()*Math.PI*2,r=8+R()*24,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r,roll=R(),col=[0xff6b6b,0x4dabf7,0xffd43b,0x69db7c][Math.floor(R()*4)];
  if(roll<.55)m.props.push({kind:'stall',x,z,y:0,scale:.8+R()*.4,color:col});
  else if(roll<.75)palletProp(m,x,z,.8+R()*.4);
  else if(roll<.9)m.props.push({kind:'crate',x,z,y:0,scale:.7+R()*.3,color:0x9c7b4d});
  else binProp(m,x,z,.7+R()*.2,0x4e6550);
 }
 for(const [dx,dz] of [[-14,-12],[14,12],[-16,10],[12,-14]])m.props.push({kind:'bench',x:cx+dx,z:cz+dz,y:0,scale:1});
 for(let i=0;i<4;i++){const x=cx+(R()*2-1)*64,z=cz+(R()*2-1)*58;if(clearFootprint(m,x,z,1.5,3,1))m.props.push({kind:'car',x,z,y:0,scale:.7+R()*.4,color:_car(R)})}
 for(let i=0;i<12;i++)addTree(m,cx+(R()*2-1)*82,cz+(R()*2-1)*80,R,[0x556b4f,0x6d835f,0x47583d]);
 for(let i=0;i<5;i++)hedgeSegment(m,cx+(R()*2-1)*72,cz+(R()*2-1)*72,2.4+R()*2,2.2,0,0x477045);
}
function parkCell(m,cx,cz,R){
 fieldPatch(m,cx,cz,116,92,0x6a7a52);
 m.props.push({kind:'basin',x:cx+14,y:.02,z:cz-8,w:46,d:26,color:0x4d7d86});
 m.props.push({kind:'sidewalk',x:cx,y:.03,z:cz+34,w:100,d:7});
 m.props.push({kind:'sidewalk',x:cx,y:.03,z:cz-34,w:100,d:7});
 for(let i=0;i<20;i++){
  const a=R()*Math.PI*2,r=22+R()*38,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;
  if(Math.abs(x-(cx+14))<28&&Math.abs(z-(cz-8))<18)continue;
  addTree(m,x,z,R,[0x3b6b40,0x4b7d49,0x2f5636,0x5b8a4f]);
 }
 for(const [dx,dz] of [[-34,-14],[34,-14],[-34,10],[34,10],[-22,26],[24,26]])if(R()<.75)m.props.push({kind:'bench',x:cx+dx,z:cz+dz,y:0,scale:1});
 for(const [dx,dz] of [[-48,-38],[48,-38],[0,40]])m.props.push({kind:'planter',x:cx+dx,z:cz+dz,y:0,scale:1.1,ry:R()*Math.PI/2});
 for(let i=0;i<3;i++){const x=cx+(R()*2-1)*56,z=cz+(R()*2-1)*42;if(clearFootprint(m,x,z,1.4,2.8,1))m.props.push({kind:'car',x,z,y:0,scale:.7+R()*.35,color:_car(R)})}
 m.props.push({kind:'sign',name:'NORTH PARK',x:cx,y:2.6,z:cz-44});
}
function districtTower(m,cx,cz,R,theme){
 const w=14+Math.round(R()*8),d=12+Math.round(R()*6),h=18+Math.round(R()*14);
 if(!clearFootprint(m,cx,cz,w,d,8))return false;
 const wall=theme==='wilderness'?'planks':theme==='settlement'?'brick':'concrete';
 box(m,cx,cz,w,d,h,0,wall,tintFor(theme,cx,cz,wall));
 box(m,cx,cz,w+.9,d+.9,.32,h,'roof',roofTintFor(theme,cx,cz));
 facadeWindows(m,cx,cz,w,d,0,h,R,'z',1,.3);
 facadeWindows(m,cx,cz,w,d,0,h,R,'z',-1,.28);
 facadeWindows(m,cx,cz,w,d,0,h,R,'x',1,.24);
 facadeWindows(m,cx,cz,w,d,0,h,R,'x',-1,.24);
 rooftop(m,cx,cz,w,d,h,R);
 m.props.push({kind:'sign',name:TOWN_NAMES[m.id][Math.floor(R()*TOWN_NAMES[m.id].length)].toUpperCase(),x:cx,y:3.2,z:cz+d/2+.55});
 return true;
}
function districtCell(m,cx,cz,R,theme){
 if(theme==='industrial')industrialCell(m,cx,cz,R);
 else if(theme==='wilderness')ruralCell(m,cx,cz,R);
 else if(R()<.78)residentialCell(m,cx,cz,R);else marketCell(m,cx,cz,R);
}
function groundCover(m,cx,cz,R){
 const greens=m.theme==='wilderness'?[0x6a7a52,0x5d7248,0x71825a,0x556b47]:m.theme==='settlement'?[0x7d7663,0x6e6b5b,0x877e6c]:[0x747a70,0x6d736a,0x81877d];
 for(let i=0;i<5;i++){
  const x=cx+(R()*2-1)*86,z=cz+(R()*2-1)*84,w=14+R()*30,d=9+R()*22;
  m.props.push({kind:'field',x,z,y:.017,w,d,color:greens[Math.floor(R()*greens.length)]});
 }
 if(m.theme==='wilderness'||R()<.35)for(let i=0;i<4;i++){const y=R()*Math.PI*2,r=18+R()*58,x=cx+Math.sin(y)*r,z=cz+Math.cos(y)*r;if(clearFootprint(m,x,z,1.5,1.5,.4))m.props.push({kind:m.theme==='wilderness'?'bush':'rock',x,z,y:0,scale:.5+R()*.9})}
}
// The spawn point itself is the first thing a player sees. A small formed-up
// frontage either side of the approach road frames that view with rowhouses
// instead of an empty field, while leaving the exact spawn coordinate and the
// immediate walking lane clear.
function spawnThreshold(m,R){
 for(const [sx,sz] of m.spawns||[]){
  const len=Math.hypot(sx,sz)||1,ux=-sx/len,uz=-sz/len,px=-uz,pz=ux;
  for(const side of [-1,1]){
   const f=15+R()*9,o=7+R()*8;
   addUnit(m,sx+ux*f+px*side*o,sz+uz*f+pz*side*o,10+R()*7,10+R()*7,R,m.theme);
   const far=38+R()*22,wide=9+R()*13;
   addUnit(m,sx+ux*far+px*side*wide,sz+uz*far+pz*side*wide,12+R()*8,11+R()*7,R,m.theme);
  }
 }
}
// Buildings fronting the avenues give every street a continuous built edge
// instead of scattered islands set back inside the cells. They are authored
// collision blocks, so the gaps a player sees along a road are real.
function avenueFrontage(m,R){
 const half=m.size/2-10,lines=[-480,-240,0,240,480];
 for(const x of lines)for(let z=-half+18;z<half-18;z+=42+R()*14)for(const side of [-1,1]){
  if(R()<.82)addUnit(m,x+side*(20+R()*5),z+(R()-.5)*3,11+R()*7,12+R()*9,R,m.theme);
 }
 for(const z of lines)for(let x=-half+18;x<half-18;x+=42+R()*14)for(const side of [-1,1]){
  if(R()<.82)addUnit(m,x+(R()-.5)*3,z+side*(20+R()*5),12+R()*9,11+R()*7,R,m.theme);
 }
}
function cityRoadGrid(m,R){
 const half=m.size/2-10,lines=[-480,-240,0,240,480];
 for(const x of lines){
  m.props.push({kind:'road',x,z:0,y:.026,w:14,d:half*2});
  m.props.push({kind:'sidewalk',x:x+8.5,z:0,y:.03,w:3.5,d:half*2});
  m.props.push({kind:'sidewalk',x:x-8.5,z:0,y:.03,w:3.5,d:half*2});
 }
 for(const z of lines){
  m.props.push({kind:'road',x:0,z,y:.026,w:half*2,d:14});
  m.props.push({kind:'sidewalk',x:0,z:z+8.5,y:.03,w:half*2,d:3.5});
  m.props.push({kind:'sidewalk',x:0,z:z-8.5,y:.03,w:half*2,d:3.5});
 }
 for(const x of lines)for(const z of lines)m.props.push({kind:'crosswalk',x,z,y:.035,w:18,d:18});
 for(let i=-half;i<=half;i+=62){
  for(const x of lines){
   const lx=x+9.2,lz=i;
   if(clearFootprint(m,lx,lz,.7,.7,.4))m.props.push({kind:'lamp',x:lx,z:lz,y:0});
   const lx2=x-9.2;if(clearFootprint(m,lx2,lz,.7,.7,.4))m.props.push({kind:'lamp',x:lx2,z:lz,y:0});
  }
  for(const z of lines){
   const lx=i,lz=z+9.2;
   if(clearFootprint(m,lx,lz,.7,.7,.4))m.props.push({kind:'lamp',x:lx,z:lz,y:0});
   const lz2=z-9.2;if(clearFootprint(m,lx,lz2,.7,.7,.4))m.props.push({kind:'lamp',x:lx,z:lz2,y:0});
  }
 }
 for(let i=-half;i<=half;i+=130){
  for(const x of lines){const lx=x+9.2,lz=i;if(clearFootprint(m,lx,lz,.4,.4,.4))m.props.push({kind:'powerPole',x:lx,z:lz,y:0});const lx2=x-9.2;if(clearFootprint(m,lx2,lz,.4,.4,.4))m.props.push({kind:'powerPole',x:lx2,z:lz,y:0})}
  for(const z of lines){const lx=i,lz=z-9.2;if(clearFootprint(m,lx,lz,.4,.4,.4))m.props.push({kind:'powerPole',x:lx,z:lz,y:0});const lz2=z+9.2;if(clearFootprint(m,lx,lz2,.4,.4,.4))m.props.push({kind:'powerPole',x:lx,z:lz2,y:0})}
 }
 // Street trees, benches and bins add life along the avenues. Like the lamps
 // they are visual-only; the authoritative server still collides only with
 // world.blocks.
 for(let i=-half+16;i<half;i+=38){
  for(const x of lines){
   for(const side of [-1,1]){
    const tx=x+side*(11.5+R()*2),tz=i+(R()*2-1)*6;
    if(clearFootprint(m,tx,tz,1.8,1.8,.8))addTree(m,tx,tz,R,[m.theme==='wilderness'?0x3b6b40:m.theme==='settlement'?0x4b7d49:0x556b4f,m.theme==='settlement'?0x6d835f:0x6d835f,0x47583d]);
    if(R()<.22){const bx=x+side*10.4,bz=i+(R()*2-1)*22;if(clearFootprint(m,bx,bz,2.4,1.1,.6))m.props.push({kind:'bench',x:bx,z:bz,y:0,scale:.9})}
    if(R()<.18){const bx=x+side*11.2,bz=i+(R()*2-1)*30;if(clearFootprint(m,bx,bz,1.8,1.5,.6))binProp(m,bx,bz,.72,0x4e6550)}
   }
   if(R()<.5){const pz=i+(R()*2-1)*10;if(clearFootprint(m,x-4.6,pz,2.4,1.4,.8))m.props.push({kind:'car',x:x-4.6,z:pz,y:0,scale:.62+R()*.35,color:_car(R)})}
  }
  for(const z of lines){
   for(const side of [-1,1]){
    const tx=i+(R()*2-1)*6,tz=z+side*(11.5+R()*2);
    if(clearFootprint(m,tx,tz,1.8,1.8,.8))addTree(m,tx,tz,R,[m.id==='reservoir'?0x3b6b40:0x4b7d49,m.id==='reservoir'?0x2f5636:0x6d835f,0x47583d]);
    if(R()<.2){const bx=i+(R()*2-1)*22,bz=z+side*10.4;if(clearFootprint(m,bx,bz,1.1,2.4,.6))m.props.push({kind:'bench',x:bx,z:bz,y:0,scale:.9})}
   }
   if(R()<.5){const px=i+(R()*2-1)*10;if(clearFootprint(m,px,z-4.6,1.4,2.4,.8))m.props.push({kind:'car',x:px,z:z-4.6,y:0,scale:.62+R()*.35,color:_car(R)})}
  }
 }
 // Occasional delivery trucks parked in the industrial and settlement depots.
 if(m.theme!=='wilderness')for(let i=0;i<6;i++){const x=(R()*2-1)*(half-20),z=(R()*2-1)*(half-20);if(clearFootprint(m,x,z,5,2.6,1.5))truckProp(m,x,z,R)}
}
function cityBillboards(m,R){
 const names={relay:['RELAY CONTROL','SECTOR 7','FREIGHT HALL','DRY RUN','NO SIGNAL'],reservoir:['RESERVOIR','RANGER POST','WATER NOTICE','NORTH SHORE','TRACE'],switchyard:['DEPOT','EMBERS','RAIL YARD','SIGNAL 4','CONTROL'],industrial:['RELAY','HAUL','SECTOR 7','FREIGHT','NO SIGNAL'],wilderness:['FOREST POST','RANGER','WATER','TRAIL'],settlement:['TOWN','DEPOT','MARKET','SIGNAL']}[m.id]||['SECTOR'];
 for(const [x,z] of [[-700,-180],[-520,690],[150,-700],[700,520],[-270,250],[270,-255]]){
  if(clearFootprint(m,x,z,3,1,1))billboardProp(m,x,z,names[Math.floor(R()*names.length)]);
 }
}
function densifyWorld(world,seed){
 const m=structuredClone(world);m.version=9;
 const R=prng(seed),cells=[-600,-360,-120,120,360,600];
 for(const cx of cells)for(const cz of cells){groundCover(m,cx,cz,R);districtCell(m,cx,cz,R,m.theme)}
 // A handful of taller civic or industrial landmarks break the otherwise even
 // roofline and give each sector a recognisable skyline.
 for(const [cx,cz] of [[-360,120],[120,-360],[360,360],[-120,-120]])districtTower(m,cx,cz,R,m.theme);
 spawnThreshold(m,R);
 avenueFrontage(m,R);
 cityRoadGrid(m,R);
 for(let i=0;i<10;i++)truckProp(m,(R()*2-1)*(m.size/2-24),(R()*2-1)*(m.size/2-24),R);
 cityBillboards(m,R);
 return m;
}

// Version 10 adds a shared, deterministic terrain heightfield to each sector.
// The heightfield lives in shared world data so authoritative collision, the
// online renderer, the offline map builder and the minimap all sample the same
// surface. Its broad Gaussian ridges give every sector real relief, while
// structures, roads, fields, ramps, spawns, caches and exits are cut-and-filled
// onto flat pads and the surrounding ground is distance-capped so pad edges rise
// gradually instead of forming a wall.
const TERRAIN_RES=160;
const TERRAIN_PAD=2;
const TERRAIN_EDGE_RISE=1;
function sculptTerrain(world,seed){
 const m=structuredClone(world);m.version=10;
 const res=TERRAIN_RES,cell=m.size/res,half=m.size/2,heights=new Float32Array(res*res),mask=new Float32Array(res*res),R=prng(seed);
 const markRect=(x,z,w,d)=>{
  const i0=Math.max(0,Math.floor((x-w/2+half)/cell-.5)),i1=Math.min(res-1,Math.ceil((x+w/2+half)/cell-.5));
  const j0=Math.max(0,Math.floor((z-d/2+half)/cell-.5)),j1=Math.min(res-1,Math.ceil((z+d/2+half)/cell-.5));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)mask[j*res+i]=1;
 };
 const markCircle=(x,z,r)=>{
  const i0=Math.max(0,Math.floor((x-r+half)/cell-.5)),i1=Math.min(res-1,Math.ceil((x+r+half)/cell-.5));
  const j0=Math.max(0,Math.floor((z-r+half)/cell-.5)),j1=Math.min(res-1,Math.ceil((z+r+half)/cell-.5));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const cx=-half+(i+.5)*cell-x,cz=-half+(j+.5)*cell-z;if(cx*cx+cz*cz<=r*r)mask[j*res+i]=1}
 };
 // Five ring-distributed ridges plus a low centre knoll give each sector relief
 // across all quadrants instead of one hill in the middle.
 const ridges=[];
 for(let i=0;i<5;i++){
  const angle=i/5*Math.PI*2+(R()-.5)*.55,distance=110+R()*430;
  ridges.push({x:Math.cos(angle)*distance,z:Math.sin(angle)*distance,s:280+R()*180,h:30+R()*12});
 }
 ridges.push({x:(R()-.5)*220,z:(R()-.5)*220,s:320,h:24+R()*10});
 for(let j=0;j<res;j++)for(let i=0;i<res;i++){
  const x=-half+(i+.5)*cell,z=-half+(j+.5)*cell;let h=0;
  for(const ridge of ridges){const dx=x-ridge.x,dz=z-ridge.z;h=Math.max(h,ridge.h*Math.exp(-(dx*dx+dz*dz)/(2*ridge.s*ridge.s)))}
  heights[j*res+i]=h;
 }
 for(const block of m.blocks)markRect(block[0],block[1],block[2]+TERRAIN_PAD*2,block[3]+TERRAIN_PAD*2);
 for(const prop of m.props||[]){
  if(!['road','sidewalk','plaza','field','basin','rail'].includes(prop.kind))continue;
  markRect(prop.x,prop.z,(prop.w||((prop.kind==='rail')?40:12))+4,(prop.d||6)+4);
 }
 for(const ramp of m.ramps||[])markRect(ramp.x,ramp.z,ramp.w+6,ramp.d+6);
 for(const [x,z]of m.spawns)markCircle(x,z,15);
 for(const [x,z]of m.caches)markCircle(x,z,15);
 for(const exit of m.exits)markCircle(exit.x,exit.z,16);
 for(const hazard of m.hazards||[])markCircle(hazard.x,hazard.z,(hazard.radius||6)+3);
 for(const marker of m.landmarks||[])markCircle(marker.x,marker.z,(marker.radius||8)+4);
 if(m.supply)markCircle(m.supply.x,m.supply.z,12);
 // A heightfield pad needs a rise from the flattened footprint to open ground,
 // not a vertical wall. Cap every surrounding cell by its distance from the pad
 // so the transition is gradual, and keep the cap within the navigation step
 // limit so hills remain walkable for floorAt/supportAt pathfinding.
 const core=new Float32Array(mask);
 const distance=new Float32Array(mask.length);distance.fill(255);
 let frontier=[];
 for(let k=0;k<core.length;k++)if(core[k]){distance[k]=0;frontier.push(k)}
 for(let d=1;d<res*2&&frontier.length;d++){
  const next=[];
  for(const k of frontier){
   const x=k%res,y=(k/res)|0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=res||ny>=res)continue;
    const nk=ny*res+nx;if(distance[nk]!==255)continue;distance[nk]=d;next.push(nk);
   }
  }
  frontier=next;
 }
 for(let k=0;k<heights.length;k++){
  if(core[k]){heights[k]=0;continue}
  if(distance[k]===255)continue;
  heights[k]=Math.min(heights[k],distance[k]*cell*TERRAIN_EDGE_RISE);
 }
 m.terrain={cell,resolution:res,heights};
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
room(relay5,0,0,30,24,5.4);doorsForRoom(relay5,0,0,30,24,5.4,['n','s'],'Relay control door',true);roofLink(relay5,0,0,5.4);
room(relay5,-180,40,26,20,5.0);doorsForRoom(relay5,-180,40,26,20,5.0,['n','s'],'Freight hall door');roofLink(relay5,-180,40,5.0);
room(relay5,180,-40,24,18,4.6);doorsForRoom(relay5,180,-40,24,18,4.6,['n','s'],'Turbine hall door');
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
room(reservoir5,-180,-160,24,20,5.0);doorsForRoom(reservoir5,-180,-160,24,20,5.0,['n','s'],'Pump house door',true);roofLink(reservoir5,-180,-160,5.0);
room(reservoir5,180,160,22,18,6.0);doorsForRoom(reservoir5,180,160,22,18,6.0,['n','s'],'Watch station door');roofLink(reservoir5,180,160,6.0);
room(reservoir5,180,-160,20,16,5.4);doorsForRoom(reservoir5,180,-160,20,16,5.4,['n','s'],'Intake door');roofLink(reservoir5,180,-160,5.4);
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
room(switchyard5,-180,-120,26,20,5.0);doorsForRoom(switchyard5,-180,-120,26,20,5.0,['n','s'],'Freight office door');roofLink(switchyard5,-180,-120,5.0);
room(switchyard5,0,-140,22,20,4.6);doorsForRoom(switchyard5,0,-140,22,20,4.6,['n','s'],'Dispatch door',true);
room(switchyard5,160,140,30,24,5.2);doorsForRoom(switchyard5,160,140,30,24,5.2,['n','s'],'Depot strongbox door',true);roofLink(switchyard5,160,140,5.2);
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
// Version 9 fills the open ground between those settlements with a road grid
// and authored neighbourhoods in every 240 m cell. V8 and earlier layouts stay
// frozen so checkpoints created before the district pass keep their geometry.
const V9_RAID_WORLDS=V8_RAID_WORLDS.map(world=>densifyWorld(world,({relay:0x2c91ef,reservoir:0x77c26b,switchyard:0xb85f21})[world.id]||42731));
// Version 10 sculpts a shared terrain surface over the frozen v9 districts.
// V9 and every earlier layout remain retrievable so existing checkpoints keep
// their exact flat geometry.
const V10_RAID_WORLDS=V9_RAID_WORLDS.map(world=>sculptTerrain(world,({relay:0x6d9f43,reservoir:0x2fb6a8,switchyard:0xd7558b})[world.id]||58231));
export const RAID_WORLDS=V10_RAID_WORLDS;
// Old checkpoints still resolve their exact layouts for versions 1-10.
export function getWorld(id,version=10){return (version===1?LEGACY_RAID_WORLDS:version===2?ARCHIVED_RAID_WORLDS:version===3?V3_RAID_WORLDS:version===4?V4_RAID_WORLDS:version===5?V5_RAID_WORLDS:version===6?V6_RAID_WORLDS:version===7?V7_RAID_WORLDS:version===8?V8_RAID_WORLDS:version===9?V9_RAID_WORLDS:version===10?V10_RAID_WORLDS:[]).find(w=>w.id===id)}
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
// ===================== Prop collision =====================
// World props (cars, trucks, crates, barrels, ...) used to be presentation-only:
// the operator could walk through a parked car and bullets passed through it.
// Anything that reads as solid cover gets a real footprint here, derived from
// the same dimensions the offline builder draws. A spatial hash (mirroring the
// block grid) keeps the extra test proportional to nearby props.
function propGrid(world){
 const props=world.props||[];
 let grid=propGrids.get(props);
 if(!props.length){if(!grid){grid={count:0,cells:new Map(),cell:24};propGrids.set(props,grid)}return grid}
 if(grid&&grid.count===props.length)return grid;
 // Deployment spawns, caches and exits must stay reachable. A prop authored on
 // top of one of those interchange points stays visual-only rather than sealing
 // the only approach (an authored wreck currently sits on the switchyard cache).
 const keepClear=[];for(const [px,pz]of world.spawns||[])keepClear.push([px,pz,2.6]);
 for(const [px,pz]of world.caches||[])keepClear.push([px,pz,2.2]);
 for(const exit of world.exits||[])keepClear.push([exit.x,exit.z,2.4]);
 const cell=24,cells=new Map();
 for(const prop of props){
  const footprint=FOOTPRINT[prop.kind]?FOOTPRINT[prop.kind](prop):null;if(!footprint)continue;
  if(keepClear.some(([qx,qz,pad])=>Math.abs(prop.x-qx)<footprint.hw+pad&&Math.abs(prop.z-qz)<footprint.hd+pad))continue;
  const y=Number.isFinite(prop.y)&&Math.abs(prop.y)>.01?prop.y:terrainHeightAt(world,prop.x,prop.z);
  const entry=[prop.x,prop.z,footprint.hw,footprint.hd,y,footprint.h];
  const x0=Math.floor((prop.x-footprint.hw)/cell),x1=Math.floor((prop.x+footprint.hw)/cell);
  const z0=Math.floor((prop.z-footprint.hd)/cell),z1=Math.floor((prop.z+footprint.hd)/cell);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const key=i*65536+j;let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(entry)}
 }
 grid={count:props.length,cells,cell};propGrids.set(props,grid);return grid;
}
function propBlocked(world,x,z,r,y,height){
 const grid=propGrid(world),cell=grid.cell,minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);
 const test=([px,pz,hw,hd,base,h])=>Math.abs(x-px)<hw+r&&Math.abs(z-pz)<hd+r&&y+height>base+.04&&y<base+h-.04;
 for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
  const list=grid.cells.get(i*65536+j);
  if(list&&list.some(test))return true;
 }
 return false;
}
// ===================== Decor collision =====================
// The neutral builder draws undergrowth, ruin walls, doorway stoops and spawn
// clutter from deterministic data that used to be presentation-only. The same
// data is lowered into a second spatial hash so the operator, bullets and AI
// stop on what the player sees. Nothing here mutates the frozen layout.
function decorHash(n){const v=Math.sin(n)*43758.5453123;return v-Math.floor(v)}
const windowFootprint=prop=>[prop.x.toFixed(4),prop.z.toFixed(4),Number(prop.y||0).toFixed(4),prop.w??'',prop.d??'',prop.h??''].join('|');
export function uniqueWindowProps(props){
 const keep=new Map();
 for(const prop of props){
  if(prop.kind!=='window')continue;
  const key=windowFootprint(prop),prev=keep.get(key);
  if(!prev||(!prev.lit&&prop.lit))keep.set(key,prop);
 }
 if(!keep.size)return props;
 const out=[];
 for(const prop of props){
  if(prop.kind==='window'&&keep.get(windowFootprint(prop))!==prop)continue;
  out.push(prop);
 }
 return out;
}
// Spawn apron drums and the wooden supply crate. Rendered and collided from one
// list so the offline builder and authority can never drift apart.
const SPAWN_DRUMS=[[-3.2,11.4,0x4b5344],[-1.4,12.8,0x8a5a3e],[1.8,13.8,0x4b5344]];
// Authored metre footprints of the scanned courtyard cover. Keeping the sizes
// beside the offsets lets one deterministic list drive both the instanced scan
// and the decor collider (the offline builder and authority never drift).
const SPAWN_COVER_DIMS={
 barrier:{w:1.565,h:1.112,d:.442},
 cratepile:{w:.825,h:.35,d:.409},
 bin:{w:1.955,h:1.21,d:.556},
 wreck:{w:1.789,h:1.411,d:4.38},
 log:{w:3.051,h:.291,d:.277},
 tyre:{w:.6,h:.165,d:.6},
 bag:{w:.528,h:.575,d:.463}
};
// The hero courtyard on the first deployment point (the relay spawn street):
// a jersey-barrier line on the enemy side of the lane, a crate pile and rubbish
// on the spawn-side pavement, a dumpster, and a covered wreck. Offsets are
// metres from the spawn and rotate with the return direction toward the sector
// interior. All gaps at screen centre stay walkable.
const SPAWN_COVER_HERO=[
 ['barrier',4.0,16.0,-.02,0],['barrier',5.2,16.2,-.03,0],
 ['barrier',6.4,16.4,-.04,0],['barrier',7.6,16.6,-.05,0],
 ['cratepile',-4.9,11.5,.03,0],['cratepile',-4.85,11.46,.12,.35],
 ['cratepile',-5.7,11.9,.55,0],
 ['tyre',-4.2,12.4,.3,0],['bag',-5.3,13.4,.2,0],
 ['cratepile',3.6,12.6,.03,0],['cratepile',3.75,12.65,.12,.35],
 ['cratepile',4.7,12.2,.55,0],
 ['bag',5.1,13.1,.4,0],['bag',4.9,13.5,-.3,0],
 ['tyre',6.8,14.0,.2,0],['tyre',2.0,9.2,.5,0],['tyre',3.1,9.7,1.1,0],
 ['tyre',-8.2,17.4,.9,0],
 ['log',7.8,16.4,.85,0],
 ['bin',7.5,14.4,-.04,0],
 ['bag',8.2,13.2,.3,0],['bag',6.2,13.5,-.2,0],['bag',7.0,15.3,.6,0],
 ['wreck',-11.4,18.4,1.35,0]
];
// Other deployment courts get a lighter version of the same cover so a raid
// starting elsewhere still has real barriers and debris without paying the full
// hero triangle budget nine times.
const SPAWN_COVER_LIGHT=[
 ['barrier',-5.2,13.8,.1,0],
 ['cratepile',3.4,12.6,.2,0],
 ['tyre',-2.8,14.6,.6,0],
 ['bag',4.9,13.2,.4,0]
];
export function raidSpawnDressing(world){
 const blocks=world.blocks||[],out=[];
 const hit=(x,z)=>blocks.some(([bx,bz,w,d])=>Math.abs(x-bx)<w/2+.7&&Math.abs(z-bz)<d/2+.7);
 for(let si=0;si<(world.spawns||[]).length;si++){
  const [sx,sz]=world.spawns[si];
  for(const [dx,dz,color] of SPAWN_DRUMS){
   const x=sx+dx,z=sz+dz;if(hit(x,z))continue;
   out.push({kind:'drum',x,z,y:terrainHeightAt(world,x,z),color,radius:.52,height:1.3});
  }
  const x=sx-4.4,z=sz+9.7;
  // Footprint matches the real wooden-military-crate scan so the rendered prop
  // and the decor collider describe the same low, long box.
  if(!hit(x,z))out.push({kind:'crate',x,z,y:terrainHeightAt(world,x,z),color:0x8a6a45,w:1.242,h:.46,d:.52});
  for(const [kind,dx,dz,ry,level] of si===0?SPAWN_COVER_HERO:SPAWN_COVER_LIGHT){
   const x=sx+dx,z=sz+dz;if(hit(x,z))continue;
   const dims=SPAWN_COVER_DIMS[kind];
   out.push({kind,x,z,y:terrainHeightAt(world,x,z)+level,level,ry,w:dims.w,h:dims.h,d:dims.d});
  }
 }
 return out;
}
// Street-level doorway sites, derived from frozen blocks and the authored window
// layer. This picker is the single source of truth for both the façade dress
// (raid-environment.mjs) and the doorway stoop colliders.
export function raidDoorwaySites(world){
 let sites=doorwayCache.get(world);if(sites)return sites;
 const windows=uniqueWindowProps(world.props||[]).filter(p=>p.kind==='window');
 sites=[];
 for(const block of world.blocks||[]){
  const [x,z,w,d,h,y=0,kind='concrete']=block;
  if(y>.4||h<2.8||w<6||d<6)continue;
  if(kind!=='brick'&&kind!=='concrete'&&kind!=='planks')continue;
  const doorHash=decorHash(x*57.1+z*37.7+world.id.length*3.3+h*1.9);
  if(doorHash>=.45)continue;
  const primary=Math.floor(decorHash(doorHash*7.31)*4)%4;
  for(let attempt=0;attempt<4;attempt++){
   const face=(primary+attempt)%4,onZ=face<2,nx=face===2?-1:face===3?1:0,nz=face===0?1:face===1?-1:0;
   const minA=(onZ?x:z)-(onZ?w:d)/2+1.5,maxA=(onZ?x:z)+(onZ?w:d)/2-1.5;
   const faceWins=[];
   for(const p of windows){
    if(onZ){if(Math.abs(p.z-(z+nz*(d/2+.27)))<.8&&p.x>=x-w/2-.1&&p.x<=x+w/2+.1)faceWins.push({a:p.x,width:p.w||1.2})}
    else if(Math.abs(p.x-(x+nx*(w/2+.27)))<.8&&p.z>=z-d/2-.1&&p.z<=z+d/2+.1)faceWins.push({a:p.z,width:p.d||1.2});
   }
   faceWins.sort((a,b)=>a.a-b.a);
   const gaps=[];let cursor=minA;
   for(const win of faceWins){const s=win.a-win.width/2-.18,e=win.a+win.width/2+.18;if(s-cursor>=1.8)gaps.push([cursor,s]);cursor=Math.max(cursor,e)}
   if(maxA-cursor>=1.8)gaps.push([cursor,maxA]);
   if(!gaps.length)continue;
   gaps.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
   const a=(gaps[0][0]+gaps[0][1])/2,wallX=x+nx*w/2,wallZ=z+nz*d/2,ddx=onZ?a:wallX,ddz=onZ?wallZ:a;
   const doorBase=y+.38,doorW=1.12,doorH=Math.min(2.15,h-.5);
   const outX=onZ?0:nx,outZ=onZ?nz:0;
   const awning=decorHash(doorHash*29.3+face*4.2)<.55;
   sites.push({x:ddx,y:doorBase,z:ddz,base:y,top:y+h,face,onZ,outX,outZ,w:doorW,h:doorH,windows:faceWins.length,awning,doorHash});
   break;
  }
 }
 doorwayCache.set(world,sites);return sites;
}
// A rotated box footprint is tested against the same surface height rule as
// authored blocks, so low rubble stays passable while standing walls stop a
// body, a bullet or a machine. Only live (v10) deployments carry decor solids:
// the v7-v9 construction worlds consult blocked() while their frozen prop
// scatter is still being assembled.
function decorGrid(world){
 const cached=decorGrids.get(world);if(cached)return cached;
 const cell=24,cells=new Map();
 if(!world||!(world.version>=10)){const empty={cells,cell,count:0};decorGrids.set(world,empty);return empty}
 const keepClear=[];for(const [px,pz]of world.spawns||[])keepClear.push([px,pz,2.6]);
 for(const [px,pz]of world.caches||[])keepClear.push([px,pz,2.2]);
 for(const exit of world.exits||[])keepClear.push([exit.x,exit.z,2.4]);
 const entries=[];
 const push=(x,z,hw,hd,base,h,ry=0)=>entries.push([x,z,hw,hd,base,h,ry]);
 const pushDoor=(x,z,hw,hd,base,h)=>{
  // Leave the immediate approach to a deployment point open: a decorative
  // stoop beside a cache must never be the only thing sealing it.
  if(keepClear.some(([qx,qz,pad])=>Math.abs(x-qx)<hw+pad&&Math.abs(z-qz)<hd+pad))return;
  entries.push([x,z,hw,hd,base,h,0]);
 };
 for(const item of raidScenery(world)){
  if(item.kind==='ruin'){
   const s=item.scale||1,base=terrainHeightAt(world,item.x,item.z),ry=item.ry||0;
   push(item.x,item.z,.275*s,1.2*s,base,1.7*s,ry);
   push(item.x+Math.sin(ry)*1.25*s,item.z+Math.cos(ry)*1.25*s,.25*s,.75*s,base,1.16*s,ry);
  } else if(item.kind==='stump'){
   const s=item.scale||1;
   push(item.x,item.z,.3*s,.3*s,terrainHeightAt(world,item.x,item.z),1.3*s);
  }
 }
 for(const door of raidDoorwaySites(world)){
  const hw=door.onZ?(door.w+.7)/2:.34,hd=door.onZ?.34:(door.w+.7)/2;
  pushDoor(door.x+(door.onZ?0:door.outX*.34),door.z+(door.onZ?door.outZ*.34:0),hw,hd,door.y-.35,.30);
 }
 for(const item of raidSpawnDressing(world)){
  if(item.kind==='drum')push(item.x,item.z,item.radius,item.radius,item.y,item.height);
  else push(item.x,item.z,item.w/2,item.d/2,item.y,item.h,item.ry||0);
 }
 for(const entry of entries){const [x,z,hw,hd]=entry,ry=entry[6]||0,cos=Math.abs(Math.cos(ry)),sin=Math.abs(Math.sin(ry));
  const ex=cos*hw+sin*hd,ez=sin*hw+cos*hd;
  const x0=Math.floor((x-ex)/cell),x1=Math.floor((x+ex)/cell);
  const z0=Math.floor((z-ez)/cell),z1=Math.floor((z+ez)/cell);
  for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const key=i*65536+j;let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(entry)}
 }
 const grid={cells,cell,count:entries.length};decorGrids.set(world,grid);return grid;
}
function decorBlocked(world,x,z,r,y,height){
 const grid=decorGrid(world);if(!grid.count)return false;
 const cell=grid.cell,minX=Math.floor((x-r)/cell),maxX=Math.floor((x+r)/cell),minZ=Math.floor((z-r)/cell),maxZ=Math.floor((z+r)/cell);
 for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
  const list=grid.cells.get(i*65536+j);if(!list)continue;
  for(const [px,pz,hw,hd,base,h,ry]of list){
   if(y+height<=base+.04||y>=base+h-.04)continue;
   if(!ry){if(Math.abs(x-px)<hw+r&&Math.abs(z-pz)<hd+r)return true;continue}
   const dx=x-px,dz=z-pz,cos=Math.cos(ry),sin=Math.sin(ry);
   if(Math.abs(dx*cos-dz*sin)<hw+r&&Math.abs(dx*sin+dz*cos)<hd+r)return true;
  }
 }
 return false;
}
export function blocked(world,x,z,r=.5,y=0,height=1.7,ignoreProps=false,ignoreDecor=false){
 if(Math.abs(x)>world.size/2-r||Math.abs(z)>world.size/2-r)return true;
 if(nearbyBlocks(world,x,z,r).some(([bx,bz,w,d,h,base=0])=>Math.abs(x-bx)<w/2+r&&Math.abs(z-bz)<d/2+r&&y+height>base+.04&&y<base+h-.04))return true;
 if((world.doors||[]).some(door=>door.closed&&Math.abs(x-door.x)<door.w/2+r&&Math.abs(z-door.z)<door.d/2+r&&y+height>(door.y||0)+.04&&y<(door.y||0)+door.h-.04))return true;
 if(!ignoreProps&&propBlocked(world,x,z,r,y,height))return true;
 if(!ignoreDecor&&decorBlocked(world,x,z,r,y,height))return true;
 return (world.ramps||[]).some(ramp=>{const level=rampLevel(ramp,x,z);return level!=null&&y<level-.04&&y+height>level-.12});
}
export function rampLevel(r,x,z){if(Math.abs(x-r.x)>r.w/2||Math.abs(z-r.z)>r.d/2)return null;const t=r.axis==='x'?(x-r.x)/r.w+.5:(z-r.z)/r.d+.5;return r.from+(r.to-r.from)*t}
// Bilinear sample of the shared terrain surface. Worlds before v10 have no
// terrain and resolve to the historical flat ground at y = 0.
export function terrainHeightAt(world,x,z){
 const t=world.terrain;if(!t||!isFinite(x)||!isFinite(z))return 0;
 const res=t.resolution,cell=t.cell,half=world.size/2;
 let fx=Math.max(0,Math.min(res-1,(x+half)/cell-.5)),fz=Math.max(0,Math.min(res-1,(z+half)/cell-.5));
 const x0=Math.floor(fx),z0=Math.floor(fz),x1=Math.min(res-1,x0+1),z1=Math.min(res-1,z0+1),ax=fx-x0,az=fz-z0,heights=t.heights,row0=z0*res,row1=z1*res;
 return heights[row0+x0]*(1-ax)*(1-az)+heights[row0+x1]*ax*(1-az)+heights[row1+x0]*(1-ax)*az+heights[row1+x1]*ax*az;
}
// Presentation-only scenery. It is derived deterministically from frozen world
// data instead of being stored in the versioned layout, so checkpoints, block
// collision and spawn/cache/exit routes remain byte-for-byte unchanged.
export function raidScenery(world){
 const cached=sceneryCache.get(world);if(cached)return cached;
 const seedText=world.id+'|'+world.size+'|'+world.theme;
 let seed=2166136261;for(let i=0;i<seedText.length;i++)seed=Math.imul(seed^seedText.charCodeAt(i),16777619)>>>0;
 const R=prng(seed),half=world.size/2,props=world.props||[],out=[];
 const roads=props.filter(p=>(p.kind==='road'||p.kind==='sidewalk'||p.kind==='crosswalk'||p.kind==='plaza')&&p.w&&p.d);
 const clearRoad=(x,z,pad=2.4)=>{for(const p of roads){if(Math.abs(x-p.x)<(p.w||0)/2+pad&&Math.abs(z-p.z)<(p.d||0)/2+pad)return false}return true};
 const points=[];for(const [x,z] of world.spawns||[])points.push([x,z,15]);
 for(const [x,z] of world.caches||[])points.push([x,z,11]);
 for(const exit of world.exits||[])points.push([exit.x,exit.z,13]);
 if(world.supply)points.push([world.supply.x,world.supply.z,10]);
 const nearPoint=(x,z)=>points.some(([px,pz,r])=>Math.hypot(x-px,z-pz)<r);
 const usable=(x,z)=>Math.abs(x)<half-18&&Math.abs(z)<half-18&&!nearPoint(x,z)&&!blocked(world,x,z,1.2,0,1.7,false,true)&&clearRoad(x,z);
 const foliage=world.theme==='wilderness'?[[0x3f6238,0x587446,0x688b52],[0x45673d,0x5e8248,0x36533a],[0x577a4a,0x6f8d54]]:
   world.theme==='settlement'?[[0x4c7042,0x668550,0x3f5e39],[0x567748,0x6a8b58,0x45653f],[0x6f8753,0x5f7d49]]:
   [[0x4f7048,0x64854d,0x38553a],[0x52744a,0x5d7f4f,0x3c5a40],[0x6a844f,0x5f7b47]];
 const rubbleColors=[0x8a8777,0x6d6a60,0x9a9689];
 const fernScale=()=>.55+R()*.85,shrubScale=()=>.6+R()*1.05,stumpScale=()=>.7+R()*.7;
 // Dense undergrowth across the open ground: ferns/shrubs dominate, with moss
 // cushions on the ground and dead trunks adding vertical silhouette.
 const step=world.size>=1200?30:20;
 for(let gx=-half+12;gx<half-12;gx+=step)for(let gz=-half+12;gz<half-12;gz+=step){
  const x=Math.round(gx+R()*(step-18)),z=Math.round(gz+R()*(step-18));
  if(!usable(x,z))continue;
  const roll=R(),theme=world.theme,kind=theme==='wilderness'?(roll<.52?'fern':roll<.82?'shrub':roll<.9?'moss':'stump'):theme==='settlement'?(roll<.46?'fern':roll<.7?'shrub':roll<.87?'moss':'stump'):(roll<.4?'fern':roll<.65?'shrub':roll<.84?'moss':'stump');
  const palette=foliage[kind==='fern'?0:kind==='shrub'?1:2];
  out.push({kind,x,z,y:0,scale:kind==='fern'?fernScale():kind==='shrub'?shrubScale():stumpScale(),color:palette[Math.floor(R()*palette.length)],ry:R()*Math.PI*2});
  // Moss cushions share a cell only occasionally; two nearby plants keep the
  // cluster silhouette natural instead of a single repeated stamp.
  if(R()<.28){const x2=Math.round(x+(R()-.5)*9),z2=Math.round(z+(R()-.5)*9);if(usable(x2,z2))out.push({kind:R()<.65?'fern':'shrub',x:x2,z:z2,y:0,scale:.5+R()*.75,color:foliage[0][Math.floor(R()*3)],ry:R()*Math.PI*2})}
 }
 // Standing ruin walls and rubble fields anchor destroyed structures around
 // real blocks, then loose rubble draws the eye along their former footprints.
 const structures=[];
 for(const block of world.blocks){const [x,z,w,d,h,base=0,kind='concrete']=block;if(base<=.4&&h>=2.4&&w>=4&&d>=4&&kind!=='window')structures.push(block)}
 let ruins=0;
 for(let i=0;i<structures.length&&ruins<18;i+=Math.max(1,Math.floor(structures.length/18))){
  const [bx,bz,w,d,h]=structures[i],angle=R()*Math.PI*2,offset=Math.max(w,d)/2+2.4+R()*2.5;
  const x=Math.round(bx+Math.cos(angle)*offset),z=Math.round(bz+Math.sin(angle)*offset);
  if(!usable(x,z))continue;
  const scale=.8+R()*.55,ry=angle+Math.PI/2,rx=Math.round(x+(R()-.5)*4),rz=Math.round(z+(R()-.5)*4),rubbleOk=usable(rx,rz);
  out.push({kind:'ruin',x,z,y:0,scale,color:rubbleColors[Math.floor(R()*rubbleColors.length)],ry});
  out.push({kind:'rubble',x:rubbleOk?rx:x,z:rubbleOk?rz:z,y:0,scale:.6+R()*.8,color:rubbleColors[Math.floor(R()*3)],ry:R()*Math.PI*2});
  ruins++;
 }
 for(let i=0;i<structures.length&&out.filter(p=>p.kind==='rubble').length<34;i+=Math.max(1,Math.floor(structures.length/30))){
  const [bx,bz,w,d]=structures[i],angle=R()*Math.PI*2,offset=Math.max(w,d)/2+1.7+R()*1.6;
  const x=Math.round(bx+Math.cos(angle)*offset),z=Math.round(bz+Math.sin(angle)*offset);
  if(usable(x,z))out.push({kind:'rubble',x,z,y:0,scale:.5+R()*.7,color:rubbleColors[Math.floor(R()*3)],ry:R()*Math.PI*2});
 }
 sceneryCache.set(world,out);
 return out;
}
export function floorAt(world,x,z,ceiling=Infinity){
 let y=terrainHeightAt(world,x,z);
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
