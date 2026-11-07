import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {createSectorGroundLoot,createWeaponCaches} from '../server/raid-loot.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {RAID_WORLDS,blocked,floorAt,supportAt} from '../shared/raid-worlds.mjs';
import {WEAPONS,itemWeight,weaponStats} from '../shared/raid-catalog.mjs';
import {findPath} from '../shared/raid-navigation.mjs';
import {advanceMachines,hitMachine,machineRoute,MACHINE_CAP} from '../server/raid-ai.mjs';
import {advanceRivals} from '../server/raid-rivals.mjs';
import {raidSight} from '../server/raid-cover.mjs';
import {item} from '../server/rules.mjs';
function setup(t,map='relay'){
 const store=new RaidStore();t.after(()=>store.close());const {id}=store.register('game_loop_'+Math.random().toString(36).slice(2,8),'a long game loop password');
 let now=1000;const service=new RaidService(store,{now:()=>now});service.deploy(id,{requestId:'loop_001',mapId:map,recovery:true});
 const p=service.byAccount.get(id),raid=service.raids.get(p.raidId);p.protectedUntil=0;
 return {store,id,service,p,raid,setTime(value){now=value}};
}
test('every spawn has immediate ground loot that is reachable and deterministic',()=>{
 for(const world of RAID_WORLDS){
  const loot=createSectorGroundLoot(world,'loop-seed');
  world.spawns.forEach(([sx,sz],index)=>{
   const own=loot.filter(l=>l.spawn===index);
   assert.ok(own.length>=2,`${world.id} spawn ${index} has loot piles`);
   assert.ok(own.filter(l=>Math.hypot(l.x-sx,l.z-sz)<=30).length>=2,`${world.id} spawn ${index} has two piles within 30 m`);
   assert.ok(own.some(l=>l.items.some(it=>it.kind==='weapon')&&Math.hypot(l.x-sx,l.z-sz)<=40),`${world.id} spawn ${index} has a weapon within 40 m`);
   for(const pile of own){
    assert.equal(blocked(world,pile.x,pile.z,.4,pile.y),false,`${pile.id} sits on walkable ground`);
    assert.ok(Math.abs(floorAt(world,pile.x,pile.z,pile.y+.1)-pile.y)<.1,`${pile.id} sits on supported floor`);
    assert.ok(findPath(world,{x:sx,y:0,z:sz},{x:pile.x,y:pile.y,z:pile.z}).length,`${pile.id} is reachable from spawn`);
   }
  });
  const copy=createSectorGroundLoot(world,'loop-seed'),normalize=rows=>rows.map(({id,items,...row})=>({...row,items:items.map(({id,...it})=>it)}));
  assert.deepEqual(normalize(copy),normalize(loot),'ground loot is reproducible from the raid seed');
 }
});
test('every sector has guarded weapon caches with multiple weapons and matching ammunition',()=>{
 for(const world of RAID_WORLDS){
  const caches=createWeaponCaches(world,'loop-seed');
  assert.equal(caches.length,3);
  for(const cache of caches){
   assert.ok(cache.weaponCache && cache.label && cache.searchSeconds>3);
   assert.ok(cache.items.filter(it=>it.kind==='weapon').length>=2);
   const weapons=cache.items.filter(it=>it.kind==='weapon');
   for(const it of weapons)assert.ok(cache.items.some(ammo=>ammo.kind==='ammo'&&ammo.ammo===WEAPONS[it.weapon].ammo),`${cache.id} has ammunition for ${it.weapon}`);
   assert.equal(blocked(world,cache.x,cache.z,.4,cache.y),false);
   assert.ok(findPath(world,{x:world.spawns[0][0],y:0,z:world.spawns[0][1]},{x:cache.x,y:cache.y,z:cache.z}).length);
  }
 }
});
test('a deployed operator sees nearby ground loot and taking a weapon while unarmed equips it',t=>{
 const {id,service,p,raid}=setup(t);
 const loot=(raid.floorLoot||[]).find(l=>l.items.some(it=>it.kind==='weapon'));
 assert.ok(loot);
 assert.ok(service.snapshot(id).loot.some(l=>l.id===loot.id),'ground loot appears in the nearby snapshot');
 delete p.weaponId;delete p.weapon;p.ammo=0;p.pack=p.pack.filter(it=>it.kind!=='weapon');p.equipment=p.equipment.filter(it=>it.kind!=='weapon');
 Object.assign(p,{x:loot.x,y:loot.y,z:loot.z,protectedUntil:Infinity});
 const weapon=loot.items.find(it=>it.kind==='weapon');
 service.action(id,{type:'take',seq:1,sourceId:loot.id,itemId:weapon.id});
 assert.equal(p.weaponId,weapon.id);assert.ok(p.weapon&&p.weapon.damage>0);assert.ok(p.ammo>0);assert.ok(p.pack.some(it=>it.id===weapon.id));
 const before=p.ammo;assert.doesNotThrow(()=>service.action(id,{type:'fire',seq:2,yaw:0,pitch:0}));assert.equal(p.ammo,before-1);
});
test('weapon caches are search-timed, guarded, and armory guards react to the breach',t=>{
 const {id,service,p,raid,setTime}=setup(t);
 const cache=raid.caches.find(c=>c.weaponCache);assert.ok(cache);
 assert.ok(raid.machines.some(m=>m.guard===cache.id),'a machine guards each weapons cache');
 Object.assign(p,{x:cache.x,y:cache.y||0,z:cache.z,protectedUntil:Infinity});
 service.action(id,{type:'search',seq:1,sourceId:cache.id});
 assert.equal(cache.searchUntil,1000+3.4);assert.equal(cache.open,false);
 setTime(1003.4);service.advance(.05,1003.4);assert.equal(cache.open,true);
 const state=service.snapshot(id),live=state.caches.find(c=>c.id===cache.id);
 assert.ok(live.items.filter(it=>it.kind==='weapon').length>=2);assert.ok(live.items.some(it=>it.kind==='ammo'));
 assert.ok(raid.events.some(e=>/breached|weapons cache/i.test(e.text)),'the breach is announced');
 assert.ok(raid.reinforcements?.some(q=>q.reason===('breach:'+cache.id)),'breaching an armory schedules a machine response');
});
test('an insertion patrol closes in and attacks within the first minutes',t=>{
 const {service,p,raid,setTime}=setup(t);
 const approach=raid.machines.find(m=>m.approach);assert.ok(approach,'a patrol machine is seeded near the insertion point');
 assert.ok(Math.hypot(approach.x-p.x,approach.z-p.z)>=24);
 assert.ok(raid.events.some(e=>/insertion signature/i.test(e.text)),'the client is warned the patrol is closing');
 let attacked=false,elapsed=0;
 for(let frame=0;frame<1800&&!attacked;frame++){
  const now=1000+frame*.05;setTime(now);advanceMachines(service,raid,.05,now);
  attacked=raid.telegraphs.length>0||p.hp<100;
  elapsed=frame*.05;
 }
 assert.ok(attacked,`a machine engages within 90 seconds (${elapsed.toFixed(1)} s)`);
});
test('destroyed machines drop a useable weapon and matching ammunition in salvage',t=>{
 const {service,p,raid}=setup(t);
 const machine=raid.machines.find(m=>m.hp>0);machine.hp=1;
 hitMachine(service,raid,machine,999,(machine.y||0)+MACHINES[machine.kind].core,p.team);
 const bag=raid.bags.find(b=>b.id===machine.id+'_salvage');assert.ok(bag);
 const weapon=bag.items.find(it=>it.kind==='weapon');assert.ok(weapon);
 assert.ok(bag.items.some(it=>it.kind==='ammo'&&it.ammo===WEAPONS[weapon.weapon].ammo));
 Object.assign(p,{x:bag.x,y:bag.y,z:bag.z,protectedUntil:Infinity});
 const seqBefore=p.seq;service.action(p.account,{type:'take',seq:seqBefore+1,sourceId:bag.id,itemId:weapon.id});
 assert.ok(p.pack.some(it=>it.id===weapon.id));
});
test('calling extraction draws machine patrols to the exit',t=>{
 const {id,service,p,raid}=setup(t);
 const exit=raid.exits.find(e=>e.kind==='call');
 Object.assign(p,{x:exit.x,y:exit.y||0,z:exit.z,protectedUntil:Infinity});
 service.action(id,{type:'call',seq:1,exitId:exit.id});
 const close=raid.machines.filter(m=>m.ambush&&Math.hypot(m.x-exit.x,m.z-exit.z)<80);
 assert.ok(close.length>=1,'machine patrols converge on the extraction call');
});

test('ground loot stacks keep quantity and weight rules authoritative',t=>{
 const {id,service,p,raid}=setup(t);
 const loot=raid.floorLoot.find(l=>l.items.some(it=>it.kind==='ammo'&&it.quantity>=8));
 assert.ok(loot);
 const ammoItem=loot.items.find(it=>it.kind==='ammo'&&it.quantity>=8);
 Object.assign(p,{x:loot.x,y:loot.y||0,z:loot.z,protectedUntil:Infinity});
 const before=ammoItem.quantity;
 const ack=service.action(id,{type:'take',seq:1,sourceId:loot.id,itemId:ammoItem.id,quantity:5});
 assert.equal(ack.accepted,true);
 assert.equal(ammoItem.quantity,before-5,'the source stack shrinks by exactly the requested quantity');
 const taken=p.pack.find(it=>it.kind==='ammo'&&it.ammo===ammoItem.ammo);
 assert.equal(taken.quantity,5);
 p.weightCap=service.weight(p)+itemWeight({kind:'ammo',quantity:1})-.0001;
 assert.throws(()=>service.action(id,{type:'take',seq:2,sourceId:loot.id,itemId:ammoItem.id,quantity:1}),/Weight limit/i);
 assert.equal(p.pack.find(it=>it.id===taken.id).quantity,5,'weight rejection leaves inventory unchanged');
});
test('machine bases own deterministic walkable patrol routes and idle machines follow them',t=>{
 const {service,p,raid,setTime}=setup(t);
 const machine=raid.machines.filter(m=>m.hp>0&&!m.approach).sort((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)-Math.hypot(a.x-p.x,a.z-p.z))[0];
 const route=machineRoute(raid,machine);
 assert.ok(route.length>=3,'the patrol route has at least three waypoints');
 assert.deepEqual(machineRoute(raid,machine),route,'the route is cached and deterministic');
 for(const point of route){
  assert.equal(blocked(raid.world,point.x,point.z,.4,point.y),false,'route waypoints sit on walkable ground');
  assert.ok(findPath(raid.world,{x:machine.home.x,y:machine.home.y||0,z:machine.home.z},{x:point.x,y:point.y,z:point.z},{radius:.4,height:1.4,maxNodes:640000}).length,'route waypoints are reachable from home');
 }
 const before={x:machine.x,z:machine.z};
 for(let frame=0;frame<220;frame++){
  const now=1000+frame*.05;setTime(now);advanceMachines(service,raid,.05,now);
 }
 assert.ok(Math.hypot(machine.x-before.x,machine.z-before.z)>1,'an idle machine patrols away from its home');
});
test('machine destruction and armory breaches draw bounded reinforcements',t=>{
 const {service,p,raid,setTime}=setup(t);
 const machine=raid.machines.find(m=>m.hp>0&&m.kind!=='overlord'&&!m.approach)||raid.machines.find(m=>m.hp>0&&m.kind!=='overlord');
 machine.hp=1;hitMachine(service,raid,machine,999,(machine.y||0)+MACHINES[machine.kind].core,p.team);
 const aliveAfterHit=raid.machines.filter(m=>m.hp>0).length;
 assert.ok(raid.reinforcements.length>=1,'the loss queues a response');
 assert.ok(raid.events.some(e=>/reinforcement|response/i.test(e.text)),'the response is announced');
 for(let frame=0;frame<400&&raid.reinforcements.length;frame++){
  const now=1000+frame*.05;setTime(Math.max(now,1015));advanceMachines(service,raid,.05,Math.max(now,1015));
 }
 assert.ok(raid.machines.filter(m=>m.hp>0).length>aliveAfterHit,'a replacement machine arrives');
 assert.ok(raid.machines.filter(m=>m.hp>0).length<=MACHINE_CAP,'the sector never exceeds its machine cap');
 // Flood the queue to prove the cap is enforced under sustained pressure.
 for(let n=0;n<8;n++)raid.reinforcements.push({at:2000,x:machine.x+20+n,z:machine.z,kind:'scout',reason:'probe_'+n,until:2005});
 for(let frame=0;frame<120;frame++){
  const now=2000+frame*.05;setTime(now);advanceMachines(service,raid,.05,now);
 }
 assert.ok(raid.machines.filter(m=>m.hp>0).length<=MACHINE_CAP,'reinforcement spawns stay capped');
});
test('weapon armories use three distinct archetypes and ground loot has an overrun outpost',()=>{
 for(const world of RAID_WORLDS){
  const caches=createWeaponCaches(world,'loop-seed');
  assert.equal(new Set(caches.map(c=>c.searchSeconds)).size,3,'each armory has its own search time');
  assert.equal(new Set(caches.map(c=>c.archetype)).size,3,'each armory has a distinct loot archetype');
  const kinds=new Set();
  for(const cache of caches){
   assert.ok(cache.items.filter(it=>it.kind==='weapon').length>=2);
   assert.ok(cache.items.some(it=>it.kind==='weapon'&&(it.attachments||[]).length>0),`${cache.id} has a modded weapon`);
   for(const band of cache.items.filter(it=>it.kind==='weapon'))assert.ok(cache.items.some(a=>a.kind==='ammo'&&a.ammo===WEAPONS[band.weapon].ammo));
   for(const it of cache.items)kinds.add(it.kind==='utility'?'utility:valor':it.kind);
  }
  assert.ok(kinds.has('mod')&&kinds.has('armor')&&kinds.has('med')&&kinds.has('utility:valor')&&kinds.has('valuable'));
  const normalize=rows=>rows.map(({items,...cache})=>({...cache,items:items.map(({id,...it})=>({...it,attachments:(it.attachments||[]).map(({id,...a})=>a)}))}));
  assert.deepEqual(normalize(createWeaponCaches(world,'loop-seed')),normalize(caches),'armory loot is reproducible from the seed');
  const loot=createSectorGroundLoot(world,'loop-seed');
  world.spawns.forEach(([sx,sz],index)=>{
   const outpost=loot.find(l=>l.spawn===index&&l.slot===3);
   assert.ok(outpost&&outpost.label==='Overrun outpost','every spawn has an overrun outpost pile');
   assert.ok(outpost.items.some(it=>it.kind==='mod')&&outpost.items.some(it=>it.kind==='armor')&&outpost.items.some(it=>it.kind==='valuable'));
   assert.ok(findPath(world,{x:sx,y:0,z:sz},{x:outpost.x,y:outpost.y,z:outpost.z}).length,'the outpost is reachable from spawn');
  });
 }
});
test('rivals patrol armories and exits, appear in snapshots, and attack sighted operators',t=>{
 const {id,service,p,raid,setTime}=setup(t);
 assert.equal(raid.rivals.length,2,'two rival scavengers per sector');
 assert.deepEqual(raid.rivals.map(r=>r.name),['Scavenger Ratchet','Marauder Vex']);
 assert.ok(raid.rivals.every(r=>r.alive&&r.targets.some(id=>id.startsWith('armory_'))&&r.targets.some(id=>id==='call'||id==='transport')));
 const rival=raid.rivals[0],start={x:rival.x,z:rival.z};
 for(let frame=0;frame<300;frame++){
  const now=1000+frame*.05;setTime(now);advanceRivals(service,raid,.05,now);
 }
 assert.ok(Math.hypot(rival.x-start.x,rival.z-start.z)>4,'the rival walks toward its target');
 assert.equal(rival.contestedId,'armory_0','the rival contests the first armory');
 assert.ok(raid.events.some(e=>/contesting/i.test(e.text)),'the contest is announced');
 // A nearby operator is detected through the same sight/cover rules as machines.
 let vantage;
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4]){
  const x=rival.x+Math.sin(angle)*4,z=rival.z+Math.cos(angle)*4,y=supportAt(raid.world,x,z,(rival.y||0)+.7,.5);
  const candidate={x,y,z};
  if(!blocked(raid.world,x,z,.4,y,1.8)&&raidSight(raid,candidate,rival,{eye:1.55,body:1.15,head:1.7},1000)){vantage=candidate;break}
 }
 assert.ok(vantage,'a clear vantage point exists for the sight test');
 Object.assign(p,{x:vantage.x,y:vantage.y,z:vantage.z,protectedUntil:Infinity});
 assert.ok(service.snapshot(id).rivals.some(r=>r.id===rival.id&&r.rival),'the rival appears in the live snapshot');
 p.protectedUntil=0;
 setTime(1150);advanceRivals(service,raid,.05,1150);
 setTime(1150.5);advanceRivals(service,raid,.05,1150.5);
 assert.ok(p.hp<100,'a sighted operator takes rival fire');
 const exit=raid.exits.find(e=>e.id==='call');
 p.protectedUntil=Infinity;rival.x=exit.x-4;rival.y=exit.y||0;rival.z=exit.z;rival.targetIndex=rival.targets.indexOf('call');rival.contestedId=null;rival.holdUntil=0;rival.attack=null;
 setTime(1400);advanceRivals(service,raid,.05,1400);
 assert.ok(exit.rivalContestedUntil>1400,'the rival contests the extraction exit');
});
test('rival operators can be killed with the existing fire action and drop matching salvage',t=>{
 const {id,service,p,raid,setTime}=setup(t);
 const rival=raid.rivals[0],gun=item('weapon',{weapon:'ar',condition:100,loaded:30});
 p.equipment=[gun];p.pack=[];p.equipment.forEach(it=>it.attachments=[]);p.weaponId=gun.id;p.weapon=weaponStats(gun);p.ammo=gun.loaded;p.nextFire=0;p.protectedUntil=0;
 let vantage;
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,3*Math.PI/4]){
  const x=rival.x+Math.sin(angle)*2,z=rival.z+Math.cos(angle)*2,y=supportAt(raid.world,x,z,(rival.y||0)+.7,.5);
  const candidate={x,y,z};
  if(!blocked(raid.world,x,z,.4,y,1.8)&&raidSight(raid,candidate,rival,{eye:1.55,body:1.15,head:1.7},1000)){vantage=candidate;break}
 }
 assert.ok(vantage,'a clear firing lane exists');
 Object.assign(p,{x:vantage.x,y:vantage.y,z:vantage.z,protectedUntil:0});
 const dx=rival.x-p.x,dz=rival.z-p.z,horizontal=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),pitch=Math.atan2((rival.y||0)+1-((p.y||0)+1.55),horizontal);
 let seq=p.seq;
 for(let shot=0;shot<6&&rival.alive;shot++){
  const now=1000+shot*.3;setTime(now);
  service.action(id,{type:'fire',seq:++seq,yaw,pitch});
 }
 assert.equal(rival.alive,false,'rival operators die from ordinary fire');
 const bag=raid.bags.find(b=>b.id===rival.id+'_salvage');
 assert.ok(bag,'the rival drops salvage');
 const weapon=bag.items.find(it=>it.kind==='weapon'),ammo=bag.items.find(it=>it.kind==='ammo');
 assert.equal(weapon.weapon,'smg');assert.equal(ammo.ammo,WEAPONS.smg.ammo);
});
