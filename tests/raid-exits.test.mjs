import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {createRaidExits,exitState,exitDescription,exitColor} from '../shared/raid-exits.mjs';
function setup(t,count=2){
 const store=new RaidStore();let now=1000;const service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});const ids=[];
 for(let i=0;i<count;i++){const id=store.register('exit_operator_'+i,'a long exit test password').id;ids.push(id);service.deploy(id,{requestId:'exit_deployment_'+i,mapId:'relay',recovery:true})}
 const player=(i=0)=>service.byAccount.get(ids[i]),raid=()=>service.raids.get(player().raidId),exit=kind=>raid().exits.find(e=>e.kind===kind);
 raid().machines=[];for(const p of raid().players.values())p.protectedUntil=Infinity;
 const action=(i,type,extra={})=>service.action(ids[i],{seq:player(i).seq+1,type,...extra}),place=(kind,...indices)=>{const e=exit(kind);for(const i of indices)Object.assign(player(i),{x:e.x,y:e.y||0,z:e.z,move:{x:0,z:0}});return e};
 return {store,service,ids,player,raid,exit,action,place,now:()=>now,advance:n=>{now+=n;for(const p of raid().players.values())p.lastInput=now;service.tick(.05)}};
}
test('all authored maps offer call, timed, key and fuel routes with written costs/capacity',()=>{
 for(const world of RAID_WORLDS){const exits=createRaidExits(world,1000);assert.equal(exits.length,4);assert.equal(new Set(exits.map(e=>e.id)).size,4);const timed=exits.find(e=>e.kind==='timed'),fuel=exits.find(e=>e.kind==='resource');assert.equal(timed.openAt,1180);assert.equal(timed.closeAt,1240);assert.equal(timed.seats,6);assert.match(exitDescription(fuel,1000),/2 fuel.*2 seats.*1 activation/);assert.equal(exitState(fuel,1000).phase,'locked')}
});
test('contested last seat is reserved once and interrupted boarding releases it',t=>{
 const {service,ids,player,raid,action,place,advance}=setup(t);const e=place('call',0,1);Object.assign(e,{seats:1,openAt:999,closeAt:1100});
 action(0,'extract',{exitId:e.id});const until=player().board.until;action(0,'extract',{exitId:e.id});assert.equal(player().board.until,until,'repeated boarding does not restart its timer');assert.equal(service.snapshot(ids[0]).exits.find(x=>x.id===e.id).reservedSeats,1);
 assert.throws(()=>action(1,'extract',{exitId:e.id}),/Not enough extraction seats/);assert.ok(player().board);
 player().protectedUntil=0;service.atomic(()=>service.damage(raid(),player(),1));assert.equal(player().board,null);action(1,'extract',{exitId:e.id});advance(3);assert.equal(player(1).result.outcome,'extract');assert.equal(player().alive,true);assert.equal(raid().exits.find(x=>x.id===e.id).usedSeats,1);
 assert.throws(()=>action(0,'extract',{exitId:e.id}),/Not enough extraction seats/);
});
test('walking away, cover, closing and a changed departure invalidate boarding',t=>{
 const {player,raid,action,place,advance}=setup(t,1);let e=place('call',0);Object.assign(e,{openAt:999,closeAt:1100});action(0,'extract',{exitId:e.id});player().x+=6;advance(3);assert.equal(player().board,null);assert.equal(player().alive,true);
 e=place('call',0);action(0,'extract',{exitId:e.id});raid().world={...raid().world,blocks:[...raid().world.blocks,[e.x,e.z+1,3,.3,4]]};player().z+=2;advance(3);assert.equal(player().board,null,'line of sight is revalidated during boarding');
 place('call',0);action(0,'extract',{exitId:e.id});e.wave++;advance(.1);assert.equal(player().board,null);
 action(0,'extract',{exitId:e.id});e.closeAt=1009;advance(3);assert.equal(player().board,null);assert.equal(player().alive,true);
});
test('carried operators reserve two seats and each receives an independent extraction result',t=>{
 const {store,ids,player,raid,action,place,advance}=setup(t,3);player(1).team=player().team;player(1).downed=true;player(1).hp=0;player(1).bleedUntil=1100;
 let e=place('key',0,1);Object.assign(e,{openAt:999,closeAt:1100});action(0,'carry',{targetId:ids[1]});assert.throws(()=>action(0,'extract',{exitId:e.id}),/Not enough extraction seats/);
 e=place('resource',0,1,2);Object.assign(e,{openAt:999,closeAt:1100});action(0,'extract',{exitId:e.id});assert.equal(player().board.passengers.length,2);assert.throws(()=>action(2,'extract',{exitId:e.id}),/Not enough extraction seats/);advance(4);
 assert.equal(raid().exits.find(x=>x.id===e.id).usedSeats,2);for(const id of ids.slice(0,2)){const result=store.results(id)[0];assert.equal(result.outcome,'extract');assert.equal(result.facts.extractionExit,e.id)}assert.equal(player(2).alive,true);
 const alternative=place('timed',2);Object.assign(alternative,{openAt:999,closeAt:1100});action(2,'extract',{exitId:alternative.id});advance(3);assert.equal(store.results(ids[2])[0].outcome,'extract');assert.equal(raid().exits.find(x=>x.id===e.id).usedSeats,2);
});
test('losing or putting down the carried passenger cancels the two-seat reservation',t=>{
 const {service,ids,player,raid,action,place}=setup(t);player(1).team=player().team;player(1).downed=true;player(1).bleedUntil=1100;const e=place('call',0,1);Object.assign(e,{openAt:999,closeAt:1100});action(0,'carry',{targetId:ids[1]});action(0,'extract',{exitId:e.id});action(0,'carry',{targetId:ids[1]});assert.equal(player().board,null);
 action(0,'carry',{targetId:ids[1]});action(0,'extract',{exitId:e.id});player(1).protectedUntil=0;service.atomic(()=>service.damage(raid(),player(1),2));assert.equal(player().board,null,'damage to a passenger cancels group boarding');action(0,'extract',{exitId:e.id});service.atomic(()=>service.end(raid(),player(1),'death'));assert.equal(player().carrying,null);assert.equal(player().board,null);assert.equal(e.usedSeats,0);
});
test('fuel access consumes real stacks once, stays spent on interruption and cannot reopen',t=>{
 const {service,ids,player,exit,action,place,advance,now}=setup(t,1);place('resource',0);player().pack.push(item('material',{material:'fuel',quantity:1}));service.atomic(()=>{});
 assert.throws(()=>action(0,'unlock',{exitId:'freight'}),/2 fuel required/);assert.equal(player().pack[0].quantity,1);assert.equal(exit('resource').activations,0);
 player().secure.push(item('material',{material:'fuel',quantity:2}));service.atomic(()=>{});const seq=player().seq+1,packet={seq,type:'unlock',exitId:'freight'};service.action(ids[0],packet);assert.equal(service.action(ids[0],packet).duplicate,true);assert.equal([...player().pack,...player().secure].reduce((n,it)=>n+it.quantity,0),1);assert.equal(exit('resource').activations,1);assert.equal(player().facts.exitCosts.length,1);
 action(0,'extract',{exitId:'freight'});player().x-=8;advance(4);assert.equal(player().board,null);assert.equal(player().facts.exitCosts[0].quantity,2);advance(40);place('resource',0);assert.throws(()=>action(0,'unlock',{exitId:'freight'}),/No emergency exit uses/);assert.equal(exitState(exit('resource'),now()).phase,'exhausted');
});
test('access payment and reservation/settlement roll back when their checkpoint cannot commit',t=>{
 const {store,service,ids,player,exit,action,place,advance}=setup(t,1);place('key',0);player().equipment.push(item('key'));service.atomic(()=>{});const key=player().equipment.find(it=>it.kind==='key').id,seq=player().seq+1;
 const fail=()=>store.db.exec("CREATE TRIGGER fail_exit BEFORE UPDATE ON raid_checkpoints BEGIN SELECT RAISE(ABORT,'exit disk failure'); END"),recover=()=>store.db.exec('DROP TRIGGER fail_exit');
 fail();assert.throws(()=>service.action(ids[0],{type:'unlock',exitId:'hatch',seq}),/exit disk failure/);recover();assert.equal(player().equipment.some(it=>it.id===key),true);assert.equal(exit('key').activations,0);assert.equal(player().seq,seq-1);
 service.action(ids[0],{type:'unlock',exitId:'hatch',seq});assert.equal(player().equipment.some(it=>it.id===key),false);fail();assert.throws(()=>action(0,'extract',{exitId:'hatch'}),/exit disk failure/);recover();assert.ok(!player().board);
 action(0,'extract',{exitId:'hatch'});fail();assert.throws(()=>advance(3),/exit disk failure/);recover();assert.equal(player().alive,true);assert.ok(player().board);assert.equal(exit('key').usedSeats,0);assert.equal(store.results(ids[0]).length,0);advance(.1);assert.equal(player().result.outcome,'extract');assert.equal(exit('key').usedSeats,1);assert.equal(store.results(ids[0]).length,1);
});
test('call departures are limited, have reusable seats per wave and cannot be spam-reset',t=>{
 const {player,exit,action,place,advance,now}=setup(t,1);place('call',0);action(0,'call',{exitId:'call'});assert.equal(exit('call').openAt,1035);assert.equal(exit('call').closeAt,1065);assert.equal(exit('call').activations,1);assert.throws(()=>action(0,'call',{exitId:'call'}),/already inbound/);assert.equal(exit('call').openAt,1035);exit('call').usedSeats=3;
 advance(66);action(0,'call',{exitId:'call'});assert.equal(exit('call').usedSeats,0);assert.equal(exit('call').wave,2);advance(66);assert.throws(()=>action(0,'call',{exitId:'call'}),/No transport calls/);assert.equal(player().alive,true);assert.equal(exitState(exit('call'),now()).phase,'exhausted');
});
test('exit display identifies full, reserved, contested and exhausted routes without player identifiers',()=>{
 const exit=createRaidExits(RAID_WORLDS[0],1000)[0];Object.assign(exit,{openAt:999,closeAt:1040,reservedSeats:2,usedSeats:1,contested:true});assert.match(exitDescription(exit,1000),/0\/3 seats available.*2 boarding.*CONTESTED/);assert.equal(exitColor(exit,1000),0xff805b);exit.usedSeats=3;assert.match(exitDescription(exit,1000),/^FULL/);exit.contested=false;assert.equal(exitColor(exit,1000),0x7d8793);Object.assign(exit,{activations:2,closeAt:999});assert.match(exitDescription(exit,1000),/^EXHAUSTED/);
});
test('boarding reservations and departure limits survive restart; old checkpoints keep unlimited legacy exits',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-exit-restart-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service=new RaidService(store,{now:()=>1000});
 try{const id=store.register('exit_restart','a long exit restart password').id;service.deploy(id,{requestId:'exit_restart_deploy',mapId:'relay',recovery:true});let p=service.byAccount.get(id),r=service.raids.get(p.raidId),e=r.exits[0];r.machines=[];p.x=e.x;p.z=e.z;Object.assign(e,{openAt:999,closeAt:1100,activations:1});service.action(id,{type:'extract',exitId:e.id,seq:1});const until=p.board.until;service.close();store.close();store=new RaidStore(file);service=new RaidService(store,{now:()=>1001});p=service.byAccount.get(id);r=service.raids.get(p.raidId);e=r.exits[0];assert.equal(p.board.until,until);assert.equal(e.activations,1);assert.equal(service.snapshot(id).exits[0].reservedSeats,1);
 service.tick(.05);assert.equal(p.alive,true);service.now=()=>1003;service.tick(.05);assert.equal(p.result.outcome,'extract');assert.equal(e.usedSeats,1);
 const saved=service.serialize();saved[0].exits=[{id:'legacy',kind:'key',x:0,z:0,openAt:0,closeAt:0}];service.restore(saved);assert.equal(service.raids.get(r.id).exits.length,1);assert.equal(service.raids.get(r.id).exits[0].seats,undefined);
 }finally{service.close();store.close();rmSync(root,{recursive:true,force:true})}
});
