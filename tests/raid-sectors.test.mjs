import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {createSectorCaches} from '../server/raid-loot.mjs';
import {advanceEvents,advanceMachines,hitMachine} from '../server/raid-ai.mjs';
import {ARTIFACTS,SECTORS} from '../shared/raid-sectors.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {createConditionPlan,conditionsAt} from '../shared/raid-conditions.mjs';
import {maxStack} from '../shared/raid-catalog.mjs';
function setup(t,map='reservoir',count=1){
 const store=new RaidStore();let now=1000,service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});const ids=[];for(let i=0;i<count;i++)ids.push(store.register('sector_operator_'+i,'a long sector test password').id);
 const player=(i=0)=>service.byAccount.get(ids[i]),raid=()=>service.raids.get(player().raidId),deploy=(i=0)=>service.deploy(ids[i],{requestId:'sector_deploy_'+i,mapId:map,recovery:true}),trade=(contract,operation,i=0)=>store.trade(ids[i],{type:'contract',contract,operation}),action=(i,type,extra={})=>service.action(ids[i],{type,seq:player(i).seq+1,...extra});
 const takeArtifact=(i=0)=>{const c=raid().caches.find(c=>c.items.some(it=>it.kind==='contract')),artifact=c.items.find(it=>it.kind==='contract');Object.assign(player(i),{x:c.x,y:c.y,z:c.z,protectedUntil:10000});c.open=true;service.atomic(()=>{});action(i,'take',{sourceId:c.id,itemId:artifact.id});return artifact};
 return {store,ids,player,raid,deploy,trade,action,takeArtifact,get service(){return service},time:value=>now=value,restart:()=>{service.close();service=new RaidService(store,{now:()=>now})}};
}
test('sector loot is reproducible from its private seed, bounded, varied and has distinct material distributions',()=>{
 for(const world of RAID_WORLDS){const counts={},ids=new Set();
  for(let seed=0;seed<60;seed++)for(const cache of createSectorCaches(world,'raid-test','seed_'+seed))for(const it of cache.items){assert.ok(!ids.has(it.id));ids.add(it.id);assert.ok(it.quantity>=1&&it.quantity<=maxStack(it));if(it.kind==='material')counts[it.material]=(counts[it.material]||0)+1}
  const dominant={relay:'wire',reservoir:'chem',switchyard:'steel'}[world.id];assert.equal(Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0],dominant);
  const normalize=caches=>caches.map(c=>({...c,items:c.items.map(({id,...it})=>it)}));assert.deepEqual(normalize(createSectorCaches(world,'raid-test','same-secret')),normalize(createSectorCaches(world,'raid-test','same-secret')));assert.notDeepEqual(normalize(createSectorCaches(world,'raid-test','one-secret')),normalize(createSectorCaches(world,'raid-test','other-secret')));
 }
});
test('every sector has one original recovery artifact at its authored site and guaranteed key/fuel opportunities',()=>{
 for(const world of RAID_WORLDS){const caches=createSectorCaches(world,'origin-raid','secret'),artifact=ARTIFACTS[SECTORS[world.id].artifact],found=caches.flatMap(c=>c.items.filter(it=>it.kind==='contract').map(it=>({c,it})));assert.equal(found.length,1);assert.equal(found[0].c.label,artifact.site);assert.equal(found[0].it.originMap,world.id);assert.equal(found[0].it.originRaid,'origin-raid');assert.equal(caches[0].items[0].kind,'key');assert.ok(caches[7].items.some(it=>it.material==='fuel'&&it.quantity>=2))}
});
test('private loot seeds and unopened contents are absent from player snapshots',t=>{
 const f=setup(t);f.deploy();const state=f.service.snapshot(f.ids[0]);assert.ok(!JSON.stringify(state).includes(f.raid().lootSeed));assert.ok(state.caches.every(c=>c.items.length===0));assert.equal(state.conditionPlan,undefined);
});
test('sector contracts use map-specific server facts and do not accept forged claim counters',t=>{
 const f=setup(t,'relay');f.trade('relay_signal','accept');f.trade('switchyard_ledger','accept');f.deploy();f.player().facts.explorations=['reservoir:cache0','relay:cache0','relay:cache0','relay:cache1'];f.player().facts.machines=9;f.player().facts.mapMachines={relay:9};f.service.atomic(()=>f.service.end(f.raid(),f.player(),'death'));
 assert.equal(f.store.profile(f.ids[0]).contracts.relay_signal.progress,2);assert.equal(f.store.profile(f.ids[0]).contracts.switchyard_ledger.progress,0);assert.throws(()=>f.store.trade(f.ids[0],{type:'contract',contract:'switchyard_ledger',operation:'claim',facts:{mapMachines:{switchyard:999}}}),/requirements/);
});
test('recovered artifact delivery protects quest items, consumes canonical ownership and rewards each stage once',t=>{
 const f=setup(t);f.trade('reservoir_sample','accept');f.deploy();f.raid().machines=[];const artifact=f.takeArtifact();assert.throws(()=>f.action(0,'secure',{itemId:artifact.id}),/cannot be protected/);f.service.atomic(()=>f.service.end(f.raid(),f.player(),'extract'));
 assert.equal(f.store.results(f.ids[0])[0].facts.artifacts.water_sample,1);assert.equal(f.store.profile(f.ids[0]).contracts.reservoir_sample.progress,1);const report=structuredClone(f.store.results(f.ids[0])[0]);assert.equal(report.contracts[0].id,'reservoir_sample');assert.equal(report.contracts[0].delta,1);assert.equal(report.contracts[0].requirementsMet,true);
 const before=f.store.profile(f.ids[0]);for(const action of [{type:'sell',itemId:artifact.id,confirmFavorite:true},{type:'bulkSell',itemIds:[before.items[0].id,artifact.id]},{type:'recycle',itemId:artifact.id}])assert.throws(()=>f.store.trade(f.ids[0],action),/reserved contract|Contract item reserved/);assert.deepEqual(f.store.profile(f.ids[0]),before);
 assert.throws(()=>f.store.deploy(f.ids[0],{requestId:'artifact_redeploy',itemIds:[before.items.find(it=>it.kind==='weapon').id,artifact.id]}),/invalid equipment/);
 f.trade('reservoir_sample','claim');f.trade('reservoir_sample','deliver');assert.equal(f.store.db.prepare('SELECT location FROM inventory WHERE id=?').get(artifact.id).location,'consumed');assert.throws(()=>f.trade('reservoir_sample','deliver'),/already complete/);f.trade('reservoir_sample','claim');assert.throws(()=>f.trade('reservoir_sample','claim'),/No active contract/);assert.equal(f.store.profile(f.ids[0]).credits,415);assert.equal(f.store.profile(f.ids[0]).contracts.reservoir_sample.completed,true);assert.deepEqual(f.store.results(f.ids[0])[0],report,'later claims cannot rewrite the historical raid report');
});
test('failed delivery and stage claim leave owned artifacts, credits and progress intact',t=>{
 const f=setup(t);f.trade('reservoir_sample','accept');f.deploy();f.takeArtifact();f.service.atomic(()=>f.service.end(f.raid(),f.player(),'extract'));f.trade('reservoir_sample','claim');
 const fail=()=>f.store.db.exec("CREATE TRIGGER fail_sector BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT,'sector disk failure'); END;"),recover=()=>f.store.db.exec('DROP TRIGGER fail_sector');
 let before=f.store.profile(f.ids[0]);fail();assert.throws(()=>f.trade('reservoir_sample','deliver'),/sector disk failure/);recover();assert.deepEqual(f.store.profile(f.ids[0]),before);f.trade('reservoir_sample','deliver');before=f.store.profile(f.ids[0]);fail();assert.throws(()=>f.trade('reservoir_sample','claim'),/sector disk failure/);recover();assert.deepEqual(f.store.profile(f.ids[0]),before);f.trade('reservoir_sample','claim');assert.equal(f.store.profile(f.ids[0]).contracts.reservoir_sample.completed,true);
});
test('an unsecured artifact lost on death can credit only the rival who actually extracts it',t=>{
 const f=setup(t,'reservoir',2);for(let i=0;i<2;i++){f.trade('reservoir_sample','accept',i);f.deploy(i)}f.raid().machines=[];const artifact=f.takeArtifact();f.service.atomic(()=>f.service.end(f.raid(),f.player(),'death'));const bag=f.raid().bags.find(b=>b.items.some(it=>it.id===artifact.id));Object.assign(f.player(1),{x:bag.x,y:bag.y,z:bag.z});f.action(1,'take',{sourceId:bag.id,itemId:artifact.id});assert.throws(()=>f.action(1,'take',{sourceId:bag.id,itemId:artifact.id}),/already claimed/);f.service.atomic(()=>f.service.end(f.raid(),f.player(1),'extract'));
 assert.equal(f.store.profile(f.ids[0]).contracts.reservoir_sample.progress,0);assert.equal(f.store.profile(f.ids[1]).contracts.reservoir_sample.progress,1);assert.equal(f.store.profile(f.ids[1]).items.filter(it=>it.id===artifact.id).length,1);assert.deepEqual(f.store.results(f.ids[0])[0].facts.artifacts,{});
});
test('nearby squad machine credit records its sector rather than counting another map',t=>{
 const f=setup(t,'switchyard',2);for(let i=0;i<2;i++){f.trade('switchyard_ledger','accept',i);f.deploy(i)}f.player(1).team=f.player().team;for(const p of [f.player(),f.player(1)])Object.assign(p,{x:0,y:0,z:0});
 for(let i=0;i<3;i++)hitMachine(f.service,f.raid(),{id:'sector_machine_'+i,kind:'scout',x:1,y:0,z:1,hp:1,state:'patrol'},100,1,f.player().team);
 for(let i=0;i<2;i++){f.service.atomic(()=>f.service.end(f.raid(),f.player(i),'death'));assert.equal(f.store.profile(f.ids[i]).contracts.switchyard_ledger.progress,3)}
});
test('checkpoint restart preserves exact loot IDs, private seed and the environment plan',t=>{
 const f=setup(t,'relay');f.deploy();const before=structuredClone(f.service.serialize());f.restart();assert.deepEqual(f.service.serialize(),before);assert.equal(f.raid().caches.flatMap(c=>c.items).filter(it=>it.kind==='contract').length,1);
});
test('day/night plans are deterministic, continuous and bounded through weather changes and midnight',()=>{
 const world=RAID_WORLDS[0];assert.deepEqual(createConditionPlan(world,'same'),createConditionPlan(world,'same'));
 for(const startHour of [0,4.5,14,17.5,22]){const plan={...createConditionPlan(world,'same'),startHour};for(let elapsed=0;elapsed<=600;elapsed+=10){const state=conditionsAt(world,plan,elapsed);assert.ok(state.visibility>=.35&&state.visibility<=1);assert.ok(state.light>=.16&&state.light<=3);assert.match(state.clock,/^\d\d:\d\d$/);assert.ok(state.hour>=0&&state.hour<24);assert.ok(Number.isInteger(state.sky)&&state.sky>=0&&state.sky<=0xffffff)}const a=conditionsAt(world,plan,100),b=conditionsAt(world,plan,100.001);assert.ok(Math.abs(a.light-b.light)<.001)}
 const plan={...createConditionPlan(world,'same'),startHour:22};assert.equal(conditionsAt(world,plan,600).hour,4.5);assert.notEqual(conditionsAt(world,plan,299).weather,conditionsAt(world,plan,300).weather);
});
test('night changes machine detection and hides distant rivals and their attack points',t=>{
 const f=setup(t,'relay',2);for(let i=0;i<2;i++)f.deploy(i);f.raid().world={...f.raid().world,blocks:[],ramps:[],hazards:[]};Object.assign(f.player(),{x:0,y:0,z:0,protectedUntil:0});Object.assign(f.player(1),{x:0,y:0,z:55});const plan={...f.raid().conditionPlan,startHour:12,hoursPerRaid:0,frontAt:999,weatherSeed:0};f.raid().conditions=conditionsAt(f.raid().world,plan,0);f.raid().telegraphs=[{id:'far',x:0,y:0,z:55,radius:2,until:1010}];assert.ok(f.service.snapshot(f.ids[0]).players.some(p=>p.id===f.ids[1]));assert.equal(f.service.snapshot(f.ids[0]).telegraphs.length,1);
 const scout=()=>({id:'scout',kind:'scout',x:0,y:0,z:25,hp:75,yaw:Math.PI,nextAttack:2000,state:'patrol',home:{x:0,y:0,z:25}});let machine=scout();f.raid().machines=[machine];advanceMachines(f.service,f.raid(),.05,1000);assert.ok(machine.lastSeen);
 f.raid().conditions=conditionsAt(f.raid().world,{...plan,startHour:0},0);machine=scout();f.raid().machines=[machine];advanceMachines(f.service,f.raid(),.05,1000);assert.ok(!machine.lastSeen);assert.equal(f.service.snapshot(f.ids[0]).players.length,0);assert.equal(f.service.snapshot(f.ids[0]).telegraphs.length,0);
});
test('light/weather announcements persist once, while old checkpoints retain their legacy environment',t=>{
 const f=setup(t,'relay');f.deploy();f.raid().machines=[];f.raid().conditionPlan={...f.raid().conditionPlan,startHour:16,hoursPerRaid:8};f.raid().lastLightPhase='day';f.player().protectedUntil=10000;f.time(1301);advanceEvents(f.service,f.raid(),1301);advanceEvents(f.service,f.raid(),1301.1);assert.equal(f.raid().conditions.period,'night');assert.equal(f.raid().events.filter(e=>e.kind==='weather').length,1);assert.equal(f.raid().events.filter(e=>e.kind==='daylight').length,1);f.service.atomic(()=>{});f.restart();advanceEvents(f.service,f.raid(),1302);assert.equal(f.raid().events.filter(e=>e.kind==='weather').length,1);
 delete f.raid().conditionPlan;f.raid().weatherAt=1303;advanceEvents(f.service,f.raid(),1303);assert.equal(f.raid().conditions.name,'Nightfall front');const saved=structuredClone(f.raid().caches);f.restart();assert.equal(f.raid().conditionPlan,undefined);assert.deepEqual(f.raid().caches,saved);
});
test('weather advance warning is emitted once before the front and survives checkpoint restart',t=>{
 const f=setup(t);f.deploy();f.player().protectedUntil=10000;f.time(1271);advanceEvents(f.service,f.raid(),1271);advanceEvents(f.service,f.raid(),1272);assert.equal(f.raid().events.filter(e=>e.kind==='weather_warning').length,1);assert.match(f.raid().events.find(e=>e.kind==='weather_warning').text,/29 seconds/);f.service.atomic(()=>{});f.restart();advanceEvents(f.service,f.raid(),1280);assert.equal(f.raid().events.filter(e=>e.kind==='weather_warning').length,1);advanceEvents(f.service,f.raid(),1301);assert.equal(f.raid().events.filter(e=>e.kind==='weather').length,1);
});
