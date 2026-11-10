import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {exitDescription,SQUAD_LINK,squadLinkBonus} from '../shared/raid-exits.mjs';

function setup(t,count=2){
 const store=new RaidStore();let now=1000;const service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});const ids=[];
 for(let i=0;i<count;i++){const id=store.register('squad_link_'+i,'a long squad link password').id;ids.push(id);service.deploy(id,{requestId:'squad_link_deployment_'+i,mapId:'relay',recovery:true})}
 const player=(i=0)=>service.byAccount.get(ids[i]),raid=()=>service.raids.get(player(0).raidId),exit=kind=>raid().exits.find(e=>e.kind===kind);
 assert.equal(new Set(ids.map(id=>player(ids.indexOf(id)).raidId)).size,1,'deployments join one authoritative raid');
 raid().machines=[];for(const p of raid().players.values())p.protectedUntil=Infinity;
 const action=(i,type,extra={})=>service.action(ids[i],{seq:player(i).seq+1,type,...extra}),place=(kind,...indices)=>{const e=exit(kind);for(const i of indices)Object.assign(player(i),{x:e.x,y:e.y||0,z:e.z,move:{x:0,z:0}});return e};
 return {store,service,ids,player,raid,exit,action,place,now:()=>now,advance:n=>{now+=n;for(const p of raid().players.values())p.lastInput=now;service.tick(.05)}};
}

test('squad link bonuses are capped, deterministic and never negative',()=>{
 assert.deepEqual(SQUAD_LINK,{radius:4,windowSeconds:60,credits:6,xp:10,maxCompanions:2});
 assert.equal(squadLinkBonus(0),0);
 assert.equal(squadLinkBonus(1),6);
 assert.equal(squadLinkBonus(2),12);
 assert.equal(squadLinkBonus(9),12,'the three-operator team cap is enforced');
 assert.equal(squadLinkBonus(-3),0);
 assert.equal(squadLinkBonus('2','xp'),20);
 assert.equal(squadLinkBonus(undefined,'xp'),0);
 const exit={kind:'call',seats:3,openAt:999,closeAt:1040,usedSeats:0,wave:1};
 assert.equal(exitDescription(exit,1000).includes('squad link'),false,'no bonus is advertised without a squadmate');
 assert.match(exitDescription({...exit,squadNear:1},1000),/squad link \+6 credits \(1 squadmate\)/);
 assert.match(exitDescription({...exit,squadNear:2},1000),/squad link \+12 credits \(2 squadmates\)/);
});

test('adjacent living squadmates are exposed while enemies and downed bodies are not',t=>{
 const {service,ids,player,exit,place}=setup(t,3);
 player(1).team=player().team;player(2).team='enemy_squad';
 const call=place('call',0,1,2);
 let state=service.snapshot(ids[0]).exits.find(e=>e.id===call.id);
 assert.equal(state.squadNear,1,'one living teammate within four metres is linked');
 player(1).downed=true;
 state=service.snapshot(ids[0]).exits.find(e=>e.id===call.id);
 assert.equal(state.squadNear,0,'a downed squadmate does not link a standing extraction');
 player(1).downed=false;player(1).x=call.x+10;
 state=service.snapshot(ids[0]).exits.find(e=>e.id===call.id);
 assert.equal(state.squadNear,0,'an out-of-range teammate is not linked');
 player(1).x=call.x;player(1).alive=false;
 state=service.snapshot(ids[0]).exits.find(e=>e.id===call.id);
 assert.equal(state.squadNear,0,'an eliminated teammate is not linked');
});

test('two squadmates boarding the same exit each settle the link bonus',t=>{
 const {store,ids,player,action,place,advance}=setup(t,2);
 player(1).team=player().team;
 const e=place('call',0,1);Object.assign(e,{openAt:999,closeAt:1100,seats:6});
 action(0,'extract',{exitId:e.id});action(1,'extract',{exitId:e.id});
 advance(3);
 const first=store.results(ids[0])[0],second=store.results(ids[1])[0];
 assert.equal(first.outcome,'extract');
 assert.equal(second.outcome,'extract');
 assert.equal(first.facts.squadLink,1,'the first departure sees the linked boarder');
 assert.equal(second.facts.squadLink,1,'the second sees the recorded same-wave departure');
 assert.equal(first.facts.squadLinkBonus,6);
 assert.equal(first.facts.squadLinkXp,10);
 assert.equal(first.credits,26,'base extract 20 + link 6');
 assert.equal(second.credits,26);
 assert.equal(first.xp,30,'base extract XP 20 + link XP 10');
 assert.equal(second.xp,30);
 assert.equal(store.results(ids[0]).length,1,'settlement stays idempotent');
});

test('a carried squadmate and the carrier both count as a linked extraction',t=>{
 const {store,ids,player,action,place,advance}=setup(t,3);
 player(1).team=player().team;Object.assign(player(1),{downed:true,hp:0,bleedUntil:5000});
 const e=place('call',0,1);Object.assign(e,{openAt:999,closeAt:1100,seats:6});
 action(0,'carry',{targetId:ids[1]});
 action(0,'extract',{exitId:e.id});
 advance(3);
 const carrier=store.results(ids[0])[0],passenger=store.results(ids[1])[0];
 assert.equal(carrier.outcome,'extract');
 assert.equal(passenger.outcome,'extract');
 assert.equal(carrier.facts.squadLink,1,'the passenger is part of the boarding party');
 assert.equal(passenger.facts.squadLink,1,'the carrier departed through the same exit wave');
 assert.equal(carrier.credits,26);
 assert.equal(passenger.credits,26);
});

test('solo and out-of-range extractions settle with no link bonus',t=>{
 const {store,ids,player,action,place,advance}=setup(t,2);
 player(1).team=player().team;
 let e=place('call',0);Object.assign(e,{openAt:999,closeAt:1100,seats:6});
 player(1).x=e.x+10;
 action(0,'extract',{exitId:e.id});
 advance(3);
 const result=store.results(ids[0])[0];
 assert.equal(result.outcome,'extract');
 assert.equal(result.facts.squadLink,undefined,'an out-of-range teammate does not trigger the bonus');
 assert.equal(result.facts.squadLinkBonus,undefined);
 assert.equal(result.credits,20);
 assert.equal(result.xp,20);
 assert.equal(store.results(ids[1]).length,0,'the teammate remains in the raid');
});

test('the bonus only applies inside the recorded window and exit wave',t=>{
 const {store,ids,player,raid,action,place,advance}=setup(t,2);
 player(1).team=player().team;
 const e=place('call',0,1);Object.assign(e,{openAt:999,closeAt:1300,seats:6,wave:2});
 action(0,'extract',{exitId:e.id});
 advance(3);
 assert.equal(store.results(ids[0])[0].facts.squadLink,1);
 // Simulate a stale departure from a different wave: it must not retroactively link.
 raid().exitDepartures=[{exitId:e.id,wave:1,team:player().team,account:ids[0],at:994}];
 const second=place('call',1);Object.assign(second,{openAt:999,closeAt:1300,seats:6,wave:2});
 action(1,'extract',{exitId:second.id});
 advance(3);
 assert.equal(store.results(ids[1])[0].facts.squadLink,undefined,'a past wave does not link a new departure');
 assert.equal(store.results(ids[1])[0].credits,20);
});
