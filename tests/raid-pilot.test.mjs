import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidPilot,gameplayRejection} from '../scripts/lib/raid-pilot.mjs';
import {RAID_WORLDS,ARCHIVED_RAID_WORLDS,clearLine} from '../shared/raid-worlds.mjs';
import {stepOperator} from '../shared/raid-motion.mjs';
const snapshot=()=>({map:'relay',mapVersion:2,serverTime:1000,left:600,self:{x:-68,y:0,z:-68,yaw:0,pitch:0,hp:100,alive:true,grounded:true,vy:0,fallPeak:0,move:{x:0,z:0},pack:[],secure:[],secureCap:1,cap:8,weight:4,weightCap:22,ammo:30,weaponId:'rifle',equipment:[{id:'rifle',kind:'weapon',weapon:'ar',loaded:30,condition:100}]},machines:[],players:[],telegraphs:[],hazards:[],caches:[],exits:[]});
test('pilot uses its authenticated identity to avoid foreign starter supplies while looting ordinary items',()=>{
 const state=snapshot(),pilot=new RaidPilot({account:'own'}),foreign={id:'foreign',kind:'weapon',weapon:'ar',quantity:1,loaded:30,grantOwner:'another'};state.bags=[{id:'bag',x:-68,y:0,z:-68,items:[foreign]}];assert.equal(pilot.chooseLoot(state),undefined);const own={id:'own_ammo',kind:'ammo',ammo:'medium',quantity:30,grantOwner:'own'};state.bags[0].items.push(own);assert.equal(pilot.chooseLoot(state).id,'bag');assert.deepEqual(pilot.intent(state),{type:'take',sourceId:'bag',itemId:own.id});state.bags[0].items=[foreign,{id:'earned',kind:'valuable',quantity:1,value:50}];assert.deepEqual(new RaidPilot({account:'own'}).intent(state),{type:'take',sourceId:'bag',itemId:'earned'});
});
test('pilot stops old movement before firing, aims with public data and respects acknowledged cooldown',()=>{
 const state=snapshot(),pilot=new RaidPilot();state.machines=[{id:'visible_machine',kind:'scout',x:-68,y:0,z:-55,hp:75,state:'patrol'}];state.self.move={x:0,z:1};assert.deepEqual(pilot.intent(state),{type:'move',x:0,z:0,yaw:0,pitch:0});state.self.move={x:0,z:0};const fire=pilot.intent(state);assert.equal(fire.type,'fire');assert.equal(fire.yaw,0);assert.ok(fire.pitch<0);assert.equal(fire.targetId,undefined);pilot.accepted(fire,state);assert.equal(pilot.intent(state).type,'move');state.serverTime+=.2;assert.equal(pilot.intent(state).type,'fire');
});
test('pilot searches and takes actual visible items, then keeps artifacts unsecured and seeks an exit',()=>{
 const state=snapshot(),pilot=new RaidPilot(),cache={id:'cache0',label:'Test cache',x:-68,y:0,z:-68,open:false,items:[]};state.caches=[cache];assert.equal(pilot.intent(state).type,'search');cache.searchRemaining=2;assert.equal(pilot.intent(state).type,'move');cache.searchRemaining=null;cache.open=true;cache.items=[{id:'artifact',kind:'contract',quantity:1,artifact:'relay_log'}];assert.deepEqual(pilot.intent(state),{type:'take',sourceId:'cache0',itemId:'artifact'});state.self.pack=[cache.items[0]];state.exits=[{id:'call',kind:'call',x:-70,y:0,z:0,openAt:0,closeAt:0,seats:3,maxActivations:2,activations:0,usedSeats:0}];assert.equal(pilot.intent(state).type,'move');assert.equal(pilot.phase,'extract');assert.equal(state.self.secure.length,0);
});
test('pilot evades visible telegraphs and does not choose full or exhausted exits',()=>{
 const state=snapshot(),pilot=new RaidPilot();state.telegraphs=[{x:-68,y:0,z:-68,radius:2,until:1001}];const evade=pilot.intent(state);assert.equal(evade.type,'move');assert.ok(Math.hypot(evade.x,evade.z)>0);state.telegraphs=[];state.exits=[{id:'full',kind:'call',x:-68,z:-68,openAt:999,closeAt:1100,seats:1,usedSeats:1},{id:'ended',kind:'key',x:-68,z:-68,openAt:0,closeAt:0,maxActivations:1,activations:1},{id:'available',kind:'timed',x:-68,z:-66,openAt:999,closeAt:1100,seats:3,usedSeats:0}];assert.equal(pilot.chooseExit(state).id,'available');
});
test('only recognized acknowledged gameplay races are classified as expected rejections',()=>{
 const base={status:409,state:snapshot(),ack:{accepted:false}};assert.equal(gameplayRejection({...base,message:'Item already claimed'}),'loot_changed');assert.equal(gameplayRejection({...base,message:'Stale action'}),null);assert.equal(gameplayRejection({...base,message:'Unknown action field'}),null);assert.equal(gameplayRejection({...base,status:500,message:'Item already claimed'}),null);assert.equal(gameplayRejection({...base,ack:undefined,message:'Item already claimed'}),null);
});
test('pilot commits to a reachable goal rather than oscillating when a detour passes another cache',()=>{
 const state=snapshot(),pilot=new RaidPilot();state.caches=[{id:'a',x:-50,y:0,z:-68},{id:'b',x:-68,y:0,z:-40}];assert.equal(pilot.chooseLoot(state).id,'a');Object.assign(state.self,{x:-67,z:-56});assert.equal(pilot.chooseLoot(state).id,'a');pilot.avoid.set('a',1005);assert.equal(pilot.chooseLoot(state).id,'b');
});
test('pilot uses owned utility intentions without requesting a target, damage or result',()=>{
 const state=snapshot(),pilot=new RaidPilot();state.self.equipment.push({id:'owned_lure',kind:'utility',utility:'decoy',quantity:1});assert.deepEqual(pilot.intent(state),{type:'throw',itemId:'owned_lure',yaw:Math.PI/2,pitch:0});pilot.accepted({type:'throw'},state);assert.notEqual(pilot.intent(state).type,'throw');state.serverTime+=2;state.self.equipment.at(-1).utility='frag';state.machines=[{id:'nearby_scout',kind:'scout',x:-68,y:0,z:-55,hp:75,state:'patrol'}];const charge=pilot.intent(state);assert.equal(charge.type,'throw');assert.equal(charge.pitch,(13-10)/8);assert.deepEqual(Object.keys(charge).sort(),['itemId','pitch','type','yaw']);
});
test('combat or treatment pauses do not count as route stalls, while continuous blocked navigation still does',()=>{
 const state=snapshot(),world=RAID_WORLDS[0],[x,z,y=0]=world.caches[0],goal={id:'cache0',x,y,z},pilot=new RaidPilot();state.mapVersion=3;pilot.navigate(state,world,goal);state.serverTime+=10;pilot.navigate(state,world,goal);assert.equal(pilot.stats.stalls,0);for(let i=0;i<24;i++){state.serverTime+=.15;pilot.navigate(state,world,goal)}assert.ok(pilot.stats.stalls>0);
});
for(const world of [...RAID_WORLDS,...ARCHIVED_RAID_WORLDS]){
 const goals=world.version===3?[...world.caches.map(([x,z,y=0],i)=>({id:'cache'+i,x,y,z})),...world.exits]:[world.caches.find(c=>c[2]>0)].map(([x,z,y])=>({id:'legacy_roof',x,y,z}));
 for(const [spawnIndex,spawn]of world.spawns.entries())for(const goal of goals)test(`${world.name} v${world.version}: spawn ${spawnIndex} reaches ${goal.id}`,()=>{
  const state=snapshot();state.map=world.id;state.mapVersion=world.version;state.self.x=spawn[0];state.self.z=spawn[1];const pilot=new RaidPilot();let reached=false;
  for(let i=0;i<1200;i++){
   if(Math.hypot(state.self.x-goal.x,state.self.z-goal.z,(state.self.y||0)-(goal.y||0))<2.4&&clearLine(world,state.self.x,state.self.z,goal.x,goal.z,(state.self.y||0)+1,(goal.y||0)+.6)){reached=true;break}
   const intent=pilot.navigate(state,world,goal);if(pilot.stats.unreachable)break;state.self.move={x:intent.x,z:intent.z};state.self.lastInput=state.serverTime;for(let step=0;step<3;step++){state.serverTime+=.05;stepOperator(world,state.self,.05,state.serverTime)}
  }
  assert.equal(reached,true,JSON.stringify({position:{x:state.self.x,y:state.self.y,z:state.self.z},goal,stats:pilot.stats}));
 });
}

for(const world of RAID_WORLDS)for(const [cacheIndex,[x,z,y=0]]of world.caches.entries())for(const goal of world.exits)test(`${world.name}: cache ${cacheIndex} returns to ${goal.id}`,()=>{
 const state=snapshot();state.map=world.id;state.mapVersion=world.version;Object.assign(state.self,{x,y,z});const pilot=new RaidPilot();let reached=false;
 for(let i=0;i<1200;i++){
  if(Math.hypot(state.self.x-goal.x,state.self.z-goal.z,(state.self.y||0)-(goal.y||0))<2.4&&clearLine(world,state.self.x,state.self.z,goal.x,goal.z,(state.self.y||0)+1,(goal.y||0)+.6)){reached=true;break}
  const intent=pilot.navigate(state,world,goal);if(pilot.stats.unreachable)break;state.self.move={x:intent.x,z:intent.z};state.self.lastMoveAt=state.serverTime;for(let step=0;step<3;step++){state.serverTime+=.05;stepOperator(world,state.self,.05,state.serverTime)}
 }
 assert.equal(reached,true,JSON.stringify({position:{x:state.self.x,y:state.self.y,z:state.self.z},goal,stats:pilot.stats}));
});

test('a telegraph detour discards the old route instead of following a roof waypoint after falling',()=>{
 const state=snapshot(),pilot=new RaidPilot();pilot.path=[{x:-68,y:4.2,z:-55}];pilot.goal='old';state.telegraphs=[{x:-68,y:0,z:-68,radius:2}];pilot.intent(state);assert.deepEqual(pilot.path,[]);assert.equal(pilot.goal,null);
});
for(const [map,x,y,z]of [['switchyard',48.180010386135734,4.142560642822911,36.99569463465307],['reservoir',46.295672088072315,4.6777982014747534,36.909316976811965],['relay',13.625701963646787,3.9530977265132905,6.988048252183093]])test(`${map}: reported mid-ramp stall can reach an exit`,()=>{
 const world=RAID_WORLDS.find(w=>w.id===map),state=snapshot();state.map=map;state.mapVersion=world.version;Object.assign(state.self,{x,y,z});const pilot=new RaidPilot(),goal=world.exits[1];let reached=false;
 for(let i=0;i<1400;i++){
  if(Math.hypot(state.self.x-goal.x,state.self.z-goal.z,state.self.y-(goal.y||0))<2.4){reached=true;break}
  const intent=pilot.navigate(state,world,goal);if(pilot.stats.unreachable)break;state.self.move={x:intent.x,z:intent.z};state.self.lastMoveAt=state.serverTime;for(let j=0;j<3;j++){state.serverTime+=.05;stepOperator(world,state.self,.05,state.serverTime)}
 }
 assert.ok(reached,JSON.stringify({position:state.self,stats:pilot.stats}));
});
