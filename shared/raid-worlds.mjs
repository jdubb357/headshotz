// Original raid layouts shared by rendering and authoritative collision checks.
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
function room(m,x,z,w,d,h,doors=['n','s']){
 for(const side of ['n','s','e','w']){
  const horizontal=side==='n'||side==='s',length=horizontal?w:d,sign=side==='n'||side==='w'?-1:1;
  const wall=(offset,size,height,base=0)=>box(m,x+(horizontal?offset:sign*w/2),z+(horizontal?sign*d/2:offset),horizontal?size:.45,horizontal?.45:size,height,base,'brick');
  if(doors.includes(side)){const segment=(length-3.4)/2;for(const s of [-1,1])wall(s*(length+3.4)/4,segment,h);wall(0,3.4,h-2.8,2.8)}
  else{wall(0,length,1.1);wall(0,length,h-2.2,2.2);for(let a=-length/2;a<=length/2;a+=3)wall(a,.45,h)}
 }
 box(m,x,z,w+.8,d+.8,.22,h,'roof');
 m.props.push({kind:'floor',x,y:.02,z,w:w-.5,d:d-.5,color:0x62615d},{kind:'lamp',x,y:h-.5,z});
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
export const ARCHIVED_RAID_WORLDS=[relay,reservoir,switchyard].map(world=>structuredClone(world));
// Keep v2 checkpoints intact. The v3 landing meets the top of each roof ramp,
// instead of blocking its middle and forcing a precision climb along its edge.
export const RAID_WORLDS=[relay,reservoir,switchyard];
for(const world of RAID_WORLDS){world.version=3;for(const ramp of world.ramps.filter(r=>r.axis==='z'&&r.w===4&&r.d===16)){
 const landing=world.blocks.find(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+7&&w===7&&d===4&&h===.18);if(landing)landing[1]+=2;
}}
export function getWorld(id,version=3){return (version===1?LEGACY_RAID_WORLDS:version===2?ARCHIVED_RAID_WORLDS:version===3?RAID_WORLDS:[]).find(w=>w.id===id)}
export function blocked(world,x,z,r=.5,y=0,height=1.7){
 if(Math.abs(x)>world.size/2-r||Math.abs(z)>world.size/2-r)return true;
 if(world.blocks.some(([bx,bz,w,d,h,base=0])=>Math.abs(x-bx)<w/2+r&&Math.abs(z-bz)<d/2+r&&y+height>base+.04&&y<base+h-.04))return true;
 return (world.ramps||[]).some(ramp=>{const level=rampLevel(ramp,x,z);return level!=null&&y<level-.04&&y+height>level-.12});
}
export function rampLevel(r,x,z){if(Math.abs(x-r.x)>r.w/2||Math.abs(z-r.z)>r.d/2)return null;const t=r.axis==='x'?(x-r.x)/r.w+.5:(z-r.z)/r.d+.5;return r.from+(r.to-r.from)*t}
export function floorAt(world,x,z,ceiling=Infinity){
 let y=0;
 for(const [bx,bz,w,d,h,base=0]of world.blocks)if(Math.abs(x-bx)<=w/2&&Math.abs(z-bz)<=d/2&&base+h<=ceiling+.01)y=Math.max(y,base+h);
 for(const ramp of world.ramps||[]){const level=rampLevel(ramp,x,z);if(level!=null&&level<=ceiling+.01)y=Math.max(y,level)}
 return y;
}
// A body's footprint remains supported by a platform while it overlaps its
// edge. Center-only support drops the feet into the platform's side and traps
// operators when descending an adjoining ramp.
export function supportAt(world,x,z,ceiling=Infinity,radius=.45){
 let y=floorAt(world,x,z,ceiling);
 for(const [bx,bz,w,d,h,base=0]of world.blocks)if(Math.abs(x-bx)<w/2+radius&&Math.abs(z-bz)<d/2+radius&&base+h<=ceiling+.01)y=Math.max(y,base+h);
 return y;
}
export function clearLine(world,x,z,tx,tz,fromY=1.6,toY=1.6){const distance=Math.hypot(tx-x,tz-z),steps=Math.ceil(distance/.35);for(let i=1;i<steps;i++){const t=i/steps;if(blocked(world,x+(tx-x)*t,z+(tz-z)*t,0,fromY+(toY-fromY)*t,.02))return false}return true}
