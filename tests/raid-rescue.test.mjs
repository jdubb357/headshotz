import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {getWorld} from '../shared/raid-worlds.mjs';

function setup(t){
 const store=new RaidStore();let now=1000;
 const service=new RaidService(store,{now:()=>now}),ids=['rescuer','passenger','third'].map(name=>store.register(name,'a long rescue password').id);
 const party=service.party(ids[0],{type:'create',mode:'trio',mapId:'relay',region:'local',match:{maxRttMs:0}});
 for(const id of ids.slice(1))service.party(id,{type:'join',code:party.id});
 for(const id of ids)service.party(id,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true}});
 service.deploy(ids[0],{requestId:'rescue_trio_deploy'});
 const p=(i=0)=>service.byAccount.get(ids[i]),r=()=>service.raids.get(p().raidId);
 r().world={...r().world,blocks:[],ramps:[],hazards:[]};r().machines=[];
 ids.forEach((id,i)=>Object.assign(p(i),{x:0,y:0,z:i===1?1.5:i===2?5:0,protectedUntil:0,lastMoveAt:0,move:{x:0,z:0}}));
 Object.assign(p(1),{downed:true,hp:0,bleedUntil:1025});
 t.after(()=>{service.close();store.close()});
 return {store,service,ids,p,r,action:(i,type,extra={})=>service.action(ids[i],{type,seq:p(i).seq+1,...extra}),time:n=>{now=n},tick:()=>service.tick(.05)};
}
const wall=()=>[0,.7132,5,.001,3];
for(const type of ['revive','carry'])test(type+' cannot reach a downed squadmate through thin solid cover',t=>{
 const f=setup(t);f.r().world.blocks=[wall()];
 assert.throws(()=>f.action(0,type,{targetId:f.ids[1]}),/out of reach/);
 assert.equal(f.p().reviving??null,null);assert.equal(f.p().carrying??null,null);assert.equal(f.p(1).carrier??null,null);
});
test('rescue cannot reach through a solid roof even inside the distance limit',t=>{
 const f=setup(t);Object.assign(f.p(1),{x:0,y:1.9,z:0});f.r().world.blocks=[[0,0,4,4,.1,1.8]];
 assert.throws(()=>f.action(0,'revive',{targetId:f.ids[1]}),/out of reach/);
});
test('a thin ramp surface also blocks hands-on rescue',t=>{
 const f=setup(t);f.r().world.ramps=[{x:0,z:.7132,w:4,d:.1,from:.65,to:.75,axis:'z'}];
 assert.throws(()=>f.action(0,'carry',{targetId:f.ids[1]}),/out of reach/);
});
test('solid cover introduced during a revival cancels the channel before completion',t=>{
 const f=setup(t);f.action(0,'revive',{targetId:f.ids[1]});f.r().world.blocks=[wall()];f.time(1006);f.tick();
 assert.equal(f.p(1).downed,true);assert.equal(f.p().reviving,null);
});
test('a delayed tick cannot revive someone whose bleed deadline already passed',t=>{
 const f=setup(t);f.action(0,'revive',{targetId:f.ids[1]});f.time(1026);f.tick();
 assert.equal(f.p(1).alive,false);assert.equal(f.p(1).result.reason,'downed_expired');assert.equal(f.p().reviving,null);
});
test('damage to the patient interrupts a revival as well as damage to its helper',t=>{
 const f=setup(t);f.action(0,'revive',{targetId:f.ids[1]});f.time(1001);f.service.atomic(()=>f.service.damage(f.r(),f.p(1),2));f.time(1006);f.tick();
 assert.equal(f.p(1).downed,true);assert.equal(f.p().reviving,null);
});
test('downing a carrier releases the passenger immediately and cannot teleport them after recovery',t=>{
 const f=setup(t);f.action(0,'carry',{targetId:f.ids[1]});f.service.atomic(()=>f.service.damage(f.r(),f.p(),101,{zone:'head'}));
 assert.equal(f.p().downed,true);assert.equal(f.p().carrying,null);assert.equal(f.p(1).carrier,null);
 f.p(1).z=10;f.p().downed=false;f.p().hp=30;f.tick();assert.equal(f.p(1).z,10);
});
test('a stale carried link from a checkpoint is detached instead of moving an unlinked patient',t=>{
 const f=setup(t);f.p(1).carrier=f.ids[0];f.p().carrying=null;f.p(1).z=9;f.tick();
 assert.equal(f.p(1).carrier,null);assert.equal(f.p(1).z,9);
});
test('a carried patient can always be dropped without requiring a second reach check',t=>{
 const f=setup(t);f.action(0,'carry',{targetId:f.ids[1]});f.p().z=8;
 f.action(0,'carry',{targetId:f.ids[1]});assert.equal(f.p().carrying,null);assert.equal(f.p(1).carrier,null);
});
test('smoke does not prevent hands-on rescue and clear access still revives at five seconds',t=>{
 const f=setup(t);f.r().utilities=[{id:'rescue_smoke',kind:'smoke',x:0,y:0,z:1,radius:4,activeAt:999,until:1030}];
 f.action(0,'revive',{targetId:f.ids[1]});f.time(1004.9);f.tick();assert.equal(f.p(1).downed,true);
 f.time(1005);f.tick();assert.equal(f.p(1).downed,false);assert.equal(f.p(1).hp,30);
});
test('damage in the same simulation timestamp still cancels either side of a revival',t=>{
 const f=setup(t);f.action(0,'revive',{targetId:f.ids[1]});f.service.atomic(()=>f.service.damage(f.r(),f.p(1),2));assert.equal(f.p().reviving,null);
 f.action(0,'revive',{targetId:f.ids[1]});f.service.atomic(()=>f.service.damage(f.r(),f.p(),2));assert.equal(f.p().reviving,null);
});
test('snapshots offer only reachable rescue actions and allow the carrier to drop its own patient',t=>{
 const f=setup(t),status=()=>f.service.snapshot(f.ids[0]).players.find(p=>p.id===f.ids[1]).rescue;
 assert.deepEqual(status(),{revive:true,carry:true,carriedByYou:false});f.r().world.blocks=[wall()];assert.deepEqual(status(),{revive:false,carry:false,carriedByYou:false});
 f.r().world.blocks=[];f.p(2).z=2.5;f.action(2,'carry',{targetId:f.ids[1]});
 assert.deepEqual(status(),{revive:true,carry:false,carriedByYou:false});
 f.action(2,'carry',{targetId:f.ids[1]});f.action(0,'carry',{targetId:f.ids[1]});f.p().z=8;
 assert.deepEqual(status(),{revive:false,carry:true,carriedByYou:true});
});
test('a failed carry checkpoint restores links, receipts and the exact pre-action state',t=>{
 const f=setup(t);f.r().world=getWorld(f.r().world.id,f.r().world.version);const [x,z]=f.r().world.spawns[0];for(const i of [0,1])Object.assign(f.p(i),{x,y:0,z});const before=f.service.snapshot(f.ids[0]),checkpoint=f.store.checkpoint;
 f.store.checkpoint=()=>{throw new Error('rescue checkpoint failure')};
 assert.throws(()=>f.action(0,'carry',{targetId:f.ids[1]}),/rescue checkpoint failure/);
 assert.deepEqual(f.service.snapshot(f.ids[0]),before);assert.equal(f.p(1).carrier??null,null);
 f.store.checkpoint=checkpoint;const packet={type:'carry',seq:1,targetId:f.ids[1]};f.service.action(f.ids[0],packet);
 assert.equal(f.service.action(f.ids[0],packet).duplicate,true);assert.equal(f.p().carrying,f.ids[1]);assert.equal(f.p(1).carrier,f.ids[0]);
});
test('carry links and replay receipts survive restart without dropping or duplicating a passenger',()=>{
 const directory=mkdtempSync('/tmp/hs-rescue-restart-'),filename=join(directory,'raid.sqlite');let store=new RaidStore(filename),service=new RaidService(store,{now:()=>1000});
 try{
  const ids=['rescue_restart_a','rescue_restart_b'].map(name=>store.register(name,'a long restart password').id),party=service.party(ids[0],{type:'create',mode:'duo',mapId:'relay',region:'local',match:{maxRttMs:0}});
  service.party(ids[1],{type:'join',code:party.id});for(const id of ids)service.party(id,{type:'ready',ready:true,loadout:{recovery:true,itemIds:[]}});service.deploy(ids[0],{requestId:'rescue_restart_deploy'});
  let patient=service.byAccount.get(ids[1]),carrier=service.byAccount.get(ids[0]);Object.assign(patient,{x:carrier.x,y:carrier.y,z:carrier.z,downed:true,hp:0,bleedUntil:1025});
  const packet={type:'carry',seq:1,targetId:ids[1]};service.action(ids[0],packet);service.close();store.close();
  store=new RaidStore(filename);service=new RaidService(store,{now:()=>1001});patient=service.byAccount.get(ids[1]);carrier=service.byAccount.get(ids[0]);
  assert.equal(carrier.carrying,ids[1]);assert.equal(patient.carrier,ids[0]);assert.equal(service.action(ids[0],packet).duplicate,true);assert.equal(carrier.carrying,ids[1]);
  service.action(ids[0],{...packet,seq:2});assert.equal(carrier.carrying,null);assert.equal(patient.carrier,null);assert.equal(store.profile(ids[1]).activeDeployment.id,patient.deploymentId);
 }finally{service.close();store.close();rmSync(directory,{recursive:true,force:true})}
});
