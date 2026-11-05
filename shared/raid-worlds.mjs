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
export const RAID_WORLDS=V5_RAID_WORLDS.map(world=>enlargedWorld(world,2,6));
// Old checkpoints still resolve their exact 720 m layout for versions 1-5.
export function getWorld(id,version=6){return (version===1?LEGACY_RAID_WORLDS:version===2?ARCHIVED_RAID_WORLDS:version===3?V3_RAID_WORLDS:version===4?V4_RAID_WORLDS:version===5?V5_RAID_WORLDS:version===6?RAID_WORLDS:[]).find(w=>w.id===id)}
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
