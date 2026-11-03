import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
import {RAID_WORLDS,blocked} from '../shared/raid-worlds.mjs';
import {populateMachines,spawnMachine,advanceMachines,advanceEvents,hitMachine} from '../server/raid-ai.mjs';
function setup(t,mapId='relay'){
 const store=new RaidStore();t.after(()=>store.close());const {id}=store.register('encounter','a long test password');let now=1000;
 const service=new RaidService(store,{now:()=>now});service.deploy(id,{requestId:'encounter_001',mapId,recovery:true});
 const p=service.byAccount.get(id),raid=service.raids.get(p.raidId);p.protectedUntil=0;
 return {store,id,p,raid,service,setTime:value=>now=value};
}
for(const world of RAID_WORLDS)test(`${world.name}: all five machine types spawn clear of walls and deployment zones`,()=>{
 const raid={id:'test',world,players:new Map(),machines:[],events:[]};populateMachines(raid,1000);
 assert.deepEqual(new Set(raid.machines.map(m=>m.kind)),new Set(Object.keys(MACHINES)));
 for(const m of raid.machines){const def=MACHINES[m.kind];assert.equal(blocked(world,m.x,m.z,def.radius,def.flight?0:m.y,def.height),false);for(const [x,z]of world.spawns)assert.ok(Math.hypot(m.x-x,m.z-z)>=24)}
});
test('reinforcements avoid living operators as well as fixed deployment sites',t=>{
 const {raid,p}=setup(t);p.x=18;p.z=-26;p.y=0;
 const m=spawnMachine(raid,'hunter',p.x,p.z,1000);assert.ok(!m||Math.hypot(m.x-p.x,m.z-p.z)>=24);
});
test('machine attack is telegraphed at a fixed point and can be dodged',t=>{
 const {raid,p,service,setTime}=setup(t);raid.world={...raid.world,blocks:[],ramps:[]};raid.machines=[];p.x=0;p.y=0;p.z=6;
 const m={id:'test_scout',kind:'scout',x:0,y:0,z:0,hp:75,yaw:0,nextAttack:0,state:'patrol',home:{x:0,y:0,z:0}};raid.machines.push(m);
 advanceMachines(service,raid,.05,1000);assert.equal(m.state,'windup');assert.equal(p.hp,100);assert.equal(raid.telegraphs.length,1);
 p.x=5;setTime(1001);advanceMachines(service,raid,.05,1001);assert.equal(p.hp,100,'dodge escapes locked attack point');assert.equal(m.attack,null);
 p.x=0;setTime(1004);advanceMachines(service,raid,.05,1004);assert.ok(m.attack);setTime(1005);advanceMachines(service,raid,.05,1005);assert.equal(p.hp,93);
});
test('machines investigate last sighting and disengage after losing sight',t=>{
 const {raid,p,service}=setup(t);raid.world={...raid.world,blocks:[],ramps:[]};raid.conditions={...raid.conditions,visibility:1};p.x=0;p.z=15;
 const m={id:'scout',kind:'scout',x:0,y:0,z:0,hp:75,yaw:0,nextAttack:2000,state:'patrol',home:{x:0,y:0,z:0}};raid.machines=[m];
 advanceMachines(service,raid,.05,1000);assert.equal(m.lastSeen.z,15);
 raid.world.blocks=[[0,7,12,2,5]];p.x=1;p.z=16;advanceMachines(service,raid,.05,1001);
 assert.equal(m.lastSeen.z,15,'hidden operator position is not continuously tracked');assert.equal(m.state,'investigate');
 advanceMachines(service,raid,.05,1008);assert.equal(m.lastSeen,null);assert.equal(m.target,null);assert.equal(m.state,'patrol');
});
test('unreachable machine goals respect the replan interval rather than searching every tick',t=>{
 const {raid,service}=setup(t);raid.world={...raid.world,size:40,blocks:[[0,-5,10,.5,4],[0,5,10,.5,4],[-5,0,.5,10,4],[5,0,.5,10,4]],ramps:[]};raid.players=new Map();const m={id:'blocked_heavy',kind:'heavy',x:10,y:0,z:0,hp:280,yaw:0,nextAttack:2000,pathAt:0,path:[],home:{x:10,y:0,z:0},investigate:{x:0,y:0,z:0,until:1010}};raid.machines=[m];
 advanceMachines(service,raid,.05,1000);assert.equal(m.path.length,0);assert.equal(m.pathAt,1002);advanceMachines(service,raid,.05,1000.05);assert.equal(m.pathAt,1002);advanceMachines(service,raid,.05,1002.1);assert.equal(m.pathAt,1004.1);
});
test('armor resists body damage while an exposed core rewards aimed shots',t=>{
 const {raid,service,p}=setup(t);const def=MACHINES.heavy,m={id:'bulwark',kind:'heavy',hp:def.hp,y:0,state:'patrol'};
 hitMachine(service,raid,m,20,def.core,p.team);assert.equal(m.hp,270);
 m.state='windup';hitMachine(service,raid,m,20,def.core,p.team);assert.equal(m.hp,220);
});
test('flying machines drop salvage on a supported ground surface',t=>{
 const {raid,service,p}=setup(t);raid.world={...raid.world,blocks:[],ramps:[]};const m={id:'skimmer',kind:'flyer',x:0,y:8,z:0,hp:1,state:'patrol'};
 hitMachine(service,raid,m,20,8.5,p.team);const bag=raid.bags.find(b=>b.id==='skimmer_salvage');assert.equal(bag.y,0);assert.ok(bag.items.length);
});
test('roof loot rejects interaction from the floor below',t=>{
 const {raid,service,p,id}=setup(t);const c=raid.caches.find(c=>c.y>=3);assert.ok(c);p.x=c.x;p.z=c.z;p.y=0;
 assert.throws(()=>service.action(id,{type:'search',sourceId:c.id,seq:1}),/out of reach/);
 service.byAccount.get(id).y=c.y;assert.doesNotThrow(()=>service.action(id,{type:'search',sourceId:c.id,seq:2}));
});
test('supply drops and weather advance once, and active hazards deal bounded periodic damage',t=>{
 const {raid,service,p,setTime}=setup(t);raid.machines=[];const hazard=raid.world.hazards[0];p.x=hazard.x;p.y=hazard.y||0;p.z=hazard.z;
 let now=raid.started+hazard.period-hazard.active+.1;setTime(now);advanceEvents(service,raid,now);const damaged=p.hp;assert.equal(damaged,100-hazard.damage);advanceEvents(service,raid,now+.1);assert.equal(p.hp,damaged);
 now=raid.started+301;setTime(now);advanceEvents(service,raid,now);assert.equal(raid.caches.filter(c=>c.id==='supply').length,1);assert.deepEqual(raid.conditions,conditionsAt(raid.world,raid.conditionPlan,301));advanceEvents(service,raid,now+.1);assert.equal(raid.caches.filter(c=>c.id==='supply').length,1);assert.equal(raid.events.filter(e=>e.kind==='weather').length,1);
});
test('movement climbs ramps onto supported roofs and walls stop continued movement',t=>{
 const {raid,service,p}=setup(t);raid.world={...raid.world,blocks:[[0,11,8,6,.2,3.8]],ramps:[{x:0,z:0,w:4,d:16,from:0,to:4,axis:'z'}]};p.x=0;p.z=-8;p.y=0;p.move={x:0,z:1};
 for(let i=0;i<76;i++){p.lastInput=1000;service.movePlayer(raid,p,.05,1000)}
 assert.ok(Math.abs(p.y-4)<.1,JSON.stringify({y:p.y,z:p.z,grounded:p.grounded}));assert.ok(p.z>=10.5);assert.equal(p.grounded,true);
 raid.world={...raid.world,blocks:[[0,0,2,8,3]],ramps:[]};p.x=-2;p.z=0;p.y=0;p.move={x:1,z:0};
 for(let i=0;i<40;i++)service.movePlayer(raid,p,.05,1000);
 assert.ok(p.x<=-1.45);assert.ok(p.x>=-2);
});
test('jump returns to the floor and long falls apply server damage',t=>{
 const {raid,service,p,id}=setup(t);raid.world={...raid.world,blocks:[],ramps:[]};p.x=0;p.y=0;p.z=0;
 service.action(id,{type:'jump',seq:1});service.movePlayer(raid,p,.1,1000);assert.ok(p.y>.4);assert.equal(p.grounded,false);
 for(let i=0;i<30;i++)service.movePlayer(raid,p,.05,1000);
 assert.equal(p.y,0);assert.equal(p.grounded,true);assert.equal(p.hp,100);
 p.y=10;p.fallPeak=10;p.grounded=false;p.vy=0;
 for(let i=0;i<40;i++)service.movePlayer(raid,p,.05,1000);
 assert.equal(p.y,0);assert.equal(p.hp,28);
});
test('spectating follows only a living squadmate and hidden enemies stay out of snapshots',t=>{
 const {raid,service,p,id,store}=setup(t);const friendId=store.register('friendly','a long friendly password').id,enemyId=store.register('opponent','a long opponent password').id;
 service.deploy(friendId,{requestId:'friendly_001',mapId:'relay',recovery:true});service.deploy(enemyId,{requestId:'opponent_001',mapId:'relay',recovery:true});
 const friend=service.byAccount.get(friendId),enemy=service.byAccount.get(enemyId);friend.team=p.team;p.x=friend.x=0;p.y=friend.y=enemy.y=0;p.z=friend.z=0;enemy.x=0;enemy.z=12;raid.world={...raid.world,blocks:[[0,6,20,2,5]],ramps:[]};
 assert.ok(!service.snapshot(id).players.some(q=>q.id===enemyId));
 service.end(raid,p,'death');const state=service.snapshot(id,enemyId);assert.equal(state.camera.follow,friendId);assert.equal(state.camera.name,'friendly');assert.ok(!state.players.some(q=>q.id===enemyId));
 raid.world.blocks=[];assert.ok(service.snapshot(id).players.some(q=>q.id===enemyId));
 service.end(raid,friend,'death');const alone=service.snapshot(id,enemyId);assert.equal(alone.camera,null);assert.equal(alone.players.length,0);assert.equal(alone.machines.length,0);
});
test('server aim height distinguishes a level miss from an aimed hit on an airborne machine',t=>{
 const {raid,service,p,id,setTime}=setup(t);raid.world={...raid.world,blocks:[],ramps:[]};p.x=0;p.z=0;p.y=0;p.yaw=0;p.pitch=0;
 const m={id:'airborne',kind:'flyer',x:0,y:7.5,z:10,hp:65,state:'patrol'};raid.machines=[m];
 service.action(id,{type:'fire',seq:1});assert.equal(m.hp,65,'a level shot passes underneath');
 p.pitch=Math.atan((8-1.55)/10);setTime(1001);service.action(id,{type:'fire',seq:2});assert.ok(m.hp<65,'looking up hits the flyer');
});

test('ground machines descend a catwalk edge without falling into its side',t=>{
 const {raid,service}=setup(t,'switchyard');raid.players=new Map();const m={id:'catwalk_hunter',kind:'hunter',x:-15,y:3.4,z:30,hp:140,yaw:0,nextAttack:2000,pathAt:0,path:[],home:{x:-15,y:3.4,z:30},investigate:{x:8,y:0,z:30,until:1100}};raid.machines=[m];
 for(let i=0;i<600&&m.x<3;i++)advanceMachines(service,raid,.05,1000+i*.05);
 assert.ok(m.x>=3,JSON.stringify({x:m.x,y:m.y,z:m.z,path:m.path}));assert.equal(m.y,0);
});
