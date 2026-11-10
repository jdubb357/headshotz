import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {ESCALATION,MACHINE_CAP,scheduleReinforcement,escalate,spawnElitePatrol,advanceEvents,hitMachine} from '../server/raid-ai.mjs';

function rawRaid(now=1000){
 return {id:'escalation'+Math.random().toString(36).slice(2,8),world:RAID_WORLDS[0],started:now,deadline:now+600,players:new Map(),machines:[],rivals:[],caches:[{id:'cache_a',x:20,y:0,z:20,open:false},{id:'cache_b',x:-20,y:0,z:-20,open:false}],exits:[{id:'exit_a',kind:'call',x:40,y:0,z:0},{id:'exit_b',kind:'timed',x:-40,y:0,z:0}],bags:[],floorLoot:[],events:[],reinforcements:[],dynamicHazards:[],hazardTicks:{},nextSqueeze:0,squeezeAt:0,eliteSpawns:0};
}
function setup(t){
 const store=new RaidStore();t.after(()=>store.close());let now=1000;
 const service=new RaidService(store,{now:()=>now});
 const id=store.register('escalation_'+randomUUID().slice(0,6),'a long escalation password').id;
 service.deploy(id,{requestId:'escalation_deploy_'+id,mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),raid=service.raids.get(p.raidId);
 Object.assign(p,{combatVersion:1,protectedUntil:0,hp:100,alive:true,downed:false,bleedUntil:0});
 raid.machines=[];raid.rivals=[];raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};raid.dynamicHazards=[];raid.phaseHazards=[];raid.hazardTicks={};
 return {store,service,id,p,raid,setTime:value=>now=value};
}

test('reinforcement requests queue a staggered, bounded wave with an elite lead unit',()=>{
 const raid=rawRaid(1000);
 const first=scheduleReinforcement(raid,5,-5,1000,{kind:'hunter',delay:10,reason:'alarm:test',count:3,elite:true});
 assert.equal(first.reason,'alarm:test');
 assert.equal(raid.reinforcements.length,3,'the wave queues three units');
 assert.deepEqual(raid.reinforcements.map(entry=>entry.reason),['alarm:test','alarm:test#1','alarm:test#2']);
 assert.deepEqual(raid.reinforcements.map(entry=>entry.at),[1010,1013,1016],'arrivals are staggered');
 assert.deepEqual(raid.reinforcements.map(entry=>entry.kind),['hunter','scout','scout'],'the lead hunter is followed by scouts');
 assert.equal(raid.reinforcements[0].elite,true,'only the lead unit is elite');
 assert.ok(raid.events.some(e=>/response wave/i.test(e.text)),'the wave is announced');
 assert.equal(raid.reinforcements[0].reason,'alarm:test','compatibility reason for breach responses is preserved');
});

test('accumulated alarms escalate wave size and periodically commit an elite hunter',()=>{
 const raid=rawRaid(1000);
 const sizes=[];
 for(let i=1;i<=7;i++){escalate(raid,1000+i,10,10,'alarm:'+i);sizes.push(raid.reinforcements.filter(e=>e.reason==='alarm:'+i||e.reason.startsWith('alarm:'+i+'#')).length)}
 assert.deepEqual(sizes,[2,2,3,3,4,4,4],'wave size grows with threat level and caps at four');
 assert.equal(raid.alarms,7);
 assert.equal(raid.alarmLevel,4,'the response is capped at threat level four');
 assert.ok(raid.events.some(e=>/threat level 2/i.test(e.text)),'level changes are announced');
 assert.equal(raid.reinforcements.filter(e=>e.elite).length,2,'alarm three and six carry elite hunters');
 assert.equal(raid.reinforcements.filter(e=>e.elite).every(e=>e.reason==='alarm:3'||e.reason==='alarm:6'),true);
 assert.ok(raid.reinforcements.length<=ESCALATION.alarmWaveCap*7,'queue stays bounded');
});

test('elite patrols are enhanced, marked, capped and drop extra salvage',async t=>{
 const f=setup(t);
 const hunter=MACHINES.hunter,machine=spawnElitePatrol(f.raid,1000);
 assert.ok(machine,'an elite patrol spawns from the raid anchors');
 assert.equal(machine.elite,true);
 assert.equal(machine.kind,'hunter');
 assert.ok(machine.hp>=Math.round(hunter.hp*1.35),'elite health is raised');
 assert.ok(machine.speed>hunter.speed&&machine.sight>hunter.sight&&machine.damage>hunter.damage,'elite stats are boosted');
 assert.ok(machine.investigate,'elite patrols have a search objective');
 f.raid.machines=[machine,...Array.from({length:ESCALATION.eliteCap-1},(_,i)=>({id:'elite_'+i,kind:'hunter',x:0,y:0,z:0,hp:100,maxHp:190,elite:true,state:'patrol'}))];
 assert.equal(spawnElitePatrol(f.raid,1001),null,'the elite cap blocks another patrol');
 // Visible elite machines carry the marker in the authoritative snapshot.
 Object.assign(f.p,{x:machine.x,y:machine.y||0,z:machine.z,protectedUntil:Infinity});
 f.raid.machines=[machine];
 const seen=f.service.snapshot(f.id).machines.find(m=>m.id===machine.id);
 assert.ok(seen&&seen.elite===true,'snapshot machine entries carry elite:true');
 // Elite kills add an extra valuable and mod to the authoritative salvage bag
 // and escalate the sector response.
 hitMachine(f.service,f.raid,machine,999,(machine.y||0)+MACHINES.hunter.core,f.p.team);
 const bag=f.raid.bags.find(b=>b.id===machine.id+'_salvage');
 assert.ok(bag&&bag.items.some(it=>it.kind==='valuable'),'elite salvage includes a valuable');
 assert.ok(bag.items.filter(it=>it.kind==='mod').length>=1,'elite salvage includes an attachment mod');
 assert.ok(f.raid.alarms>=1&&f.raid.reinforcements.length>=1,'the elite kill escalates the response');
});

test('environmental hazard windows warn first, damage on a one-second cadence and expire',t=>{
 const f=setup(t),{raid,p,service,setTime}=f;
 raid.nextHazardWindow=1000;raid.dynamicHazards=[];
 advanceEvents(service,raid,1000);
 const hazard=raid.dynamicHazards[0];
 assert.ok(hazard,'a hazard window is generated');
 assert.equal(hazard.name,'Ashfall squall','the sector theme names the hazard');
 assert.equal(hazard.start,1018,'warning precedes the active window');
 assert.equal(hazard.damage,ESCALATION.hazardDamage);
 assert.equal(hazard.radius,26);
 let snap=service.snapshot(f.id).hazards.find(h=>h.id===hazard.id);
 assert.ok(snap,'the warning is visible in the snapshot');
 assert.equal(snap.active,false);assert.equal(snap.warning,true);assert.equal(snap.in,18);
 assert.equal(p.hp,100,'warnings do not damage');
 Object.assign(p,{x:hazard.x,y:hazard.y||0,z:hazard.z,protectedUntil:0,hp:100,alive:true,downed:false});
 setTime(1018);advanceEvents(service,raid,1018);
 assert.equal(p.hp,98,'active hazards damage once per second');
 setTime(1018.4);advanceEvents(service,raid,1018.4);
 assert.equal(p.hp,98,'damage keeps the one-second cadence');
 setTime(1019.2);advanceEvents(service,raid,1019.2);
 assert.equal(p.hp,96);
 setTime(1040);advanceEvents(service,raid,1060);
 assert.equal(service.snapshot(f.id).hazards.some(h=>h.id===hazard.id),false,'expired windows leave the snapshot');
});

test('the endgame squeeze triggers once, marks exits contested and spawns elite ambushes',t=>{
 const f=setup(t),{raid,p,service,setTime}=f;
 raid.deadline=1100; // 100 s left when advanceEvents first runs
 raid.machines=[];raid.dynamicHazards=[];raid.squeezeAt=0;raid.nextSqueeze=0;
 const exit=raid.exits.find(e=>e.id==='exit_a')||raid.exits[0];
 Object.assign(p,{x:exit.x,y:exit.y||0,z:exit.z,protectedUntil:0});
 setTime(1000);advanceEvents(service,raid,1000);
 assert.ok(raid.squeezeAt,'the squeeze starts inside the final lead window');
 assert.ok(raid.events.some(e=>e.kind==='squeeze'&&/contested/i.test(e.text)),'the squeeze is announced');
 const eliteMachines=raid.machines.filter(m=>m.hp>0&&m.elite);
 assert.ok(eliteMachines.length>=1,'an elite ambush is dispatched immediately');
 const snap=service.snapshot(f.id);
 assert.ok(snap.escalation.squeeze,'the squeeze appears in the snapshot');
 assert.equal(snap.escalation.squeeze.left,100);
 assert.ok(snap.escalation.squeeze.contested>=1,'the elite machine marks its extraction site contested');
 setTime(1045);advanceEvents(service,raid,1045);
 assert.ok(raid.machines.filter(m=>m.hp>0&&m.elite).length<=MACHINE_CAP,'squeeze waves respect the machine cap');
 const firstSqueeze=raid.squeezeAt;
 setTime(1050);advanceEvents(service,raid,1050);
 assert.equal(raid.squeezeAt,firstSqueeze,'the squeeze starts exactly once');
});
