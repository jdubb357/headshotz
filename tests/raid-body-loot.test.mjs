import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {earnedPurchase} from './earned-fixture.mjs';

function setup(t,{file=null}={}){
 const store=new RaidStore(file||undefined);let now=1000;
 const service=new RaidService(store,{now:()=>now});
 const register=name=>store.register(name,'a long body password').id;
 const victim=register('body_victim');
 const earnedWeapon=earnedPurchase(store,victim,{sku:'smg'}),earnedAmmo=earnedPurchase(store,victim,{sku:'ammo_medium'}),earnedArmor=earnedPurchase(store,victim,{sku:'armor_light'}),earnedMed=earnedPurchase(store,victim,{trader:'medic',sku:'med'});
 service.deploy(victim,{mapId:'relay',requestId:'body_victim_deployment',itemIds:[earnedWeapon.id,earnedAmmo.id,earnedArmor.id,earnedMed.id]});
 const mate=register('body_mate'),looter=register('body_looter'),second=register('body_second');
 for(const [i,id] of [mate,looter,second].entries())service.deploy(id,{mapId:'relay',requestId:'body_helper_'+(i+1)+'_'+id,recovery:true});
 const player=id=>service.byAccount.get(id),raid=service.raids.get(player(victim).raidId);
 assert.ok([mate,looter,second].every(id=>player(id).raidId===raid.id),'helpers share the victim raid');
 raid.machines=[];raid.rivals=[];raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};
 for(const p of raid.players.values())Object.assign(p,{protectedUntil:0,move:{x:0,z:0},lastInput:now});
 const v=player(victim);
 Object.assign(v,{x:0,y:0,z:0,team:'enemy_team',hp:100,alive:true,downed:false,bleedUntil:0});
 Object.assign(player(mate),{x:0,y:0,z:1.5,team:'enemy_team'});
 Object.assign(player(looter),{x:0,y:0,z:-2,team:'looter_team'});
 Object.assign(player(second),{x:-2,y:0,z:0,team:'looter_team'});
 const down=()=>{Object.assign(v,{alive:true,downed:false,hp:100,protectedUntil:0,drops:{}});service.damage(raid,v,200,{source:'operator'});assert.equal(v.alive,true);assert.equal(v.downed,true)};
 t.after(()=>{service.close();store.close()});
 return {store,service,victim,mate,looter,second,player,raid,down,time:value=>now=value,act:(id,type,extra={})=>service.action(id,{type,seq:player(id).seq+1,...extra})};
}

test('a downed enemy body is exposed as a searchable container',t=>{
 const f=setup(t);f.down();
 const body=f.service.snapshot(f.looter).bodies.find(b=>b.id===f.victim);
 assert.ok(body,'downed enemy body is exposed');
 assert.equal(body.open,false);
 assert.equal(body.lootable,true);
 assert.deepEqual(body.items,[],'gear is hidden until the body is searched');
 const weapon=f.player(f.victim).equipment.find(it=>it.kind==='weapon');
 assert.throws(()=>f.act(f.looter,'take',{sourceId:f.victim,itemId:weapon.id}),/Loot out of reach/);
 assert.throws(()=>f.act(f.mate,'search',{sourceId:f.victim}),/Revive or carry/, 'squadmates revive instead of looting');
});

test('downed body search claims are exclusive, cancellable and announce a countdown',t=>{
 const f=setup(t);f.down();
 f.act(f.looter,'search',{sourceId:f.victim});
 assert.equal(f.player(f.victim).bodySearcher,f.looter);
 assert.ok(Math.abs(f.service.snapshot(f.looter).bodies[0].searchRemaining-2.4)<1e-6);
 assert.throws(()=>f.act(f.second,'search',{sourceId:f.victim}),/being searched/);
 f.act(f.looter,'move',{x:0,z:1,yaw:0,pitch:0});
 assert.equal(f.player(f.victim).bodySearcher,null,'movement releases the claim');
 f.act(f.second,'search',{sourceId:f.victim});
 assert.equal(f.player(f.victim).bodySearcher,f.second,'another operator can claim it immediately');
 f.time(1002.5);f.service.tick(.05);
 assert.equal(f.player(f.victim).bodyOpen,true,'search completes after 2.4 s');
 assert.equal(f.player(f.victim).bodySearcher,null);
 const opened=f.service.snapshot(f.second).bodies.find(b=>b.id===f.victim);
 assert.equal(opened.open,true);
 assert.ok(opened.items.some(it=>it.kind==='weapon'),'equipped weapon is exposed');
 assert.deepEqual(f.service.snapshot(f.mate).bodies.find(b=>b.id===f.victim).items,[],'squadmates keep rescue controls, not loot');
});

test('taking from a body follows slot, weight, stack and ownership rules',t=>{
 const f=setup(t);f.down();
 f.act(f.looter,'search',{sourceId:f.victim});
 f.time(1002.5);f.service.tick(.05);
 const p=f.player(f.looter),v=f.player(f.victim);
 const ammo=[...v.equipment,...v.pack].find(it=>it.kind==='ammo'),total=ammo.quantity;
 const packet={type:'take',seq:p.seq+1,sourceId:f.victim,itemId:ammo.id,quantity:5};
 assert.equal(f.service.action(f.looter,packet).duplicate,false);
 const child=p.pack.find(it=>it.splitFrom===ammo.id);
 assert.equal(child.quantity,5);
 const remaining=[...v.equipment,...v.pack].filter(it=>it.id===ammo.id).reduce((n,it)=>n+it.quantity,0);
 assert.equal(remaining+5,total,'partial take preserves the body remainder');
 assert.equal(f.service.action(f.looter,packet).duplicate,true,'an identical retry does not take the remainder');
 assert.equal(p.pack.find(it=>it.splitFrom===ammo.id).quantity,5);
 assert.equal(f.store.db.prepare('SELECT account FROM inventory WHERE id=?').get(child.id).account,f.looter,'checkpoint records new ownership');

 const ownWeapon=[...p.equipment,...p.pack].find(it=>it.kind==='weapon'),weapon=v.equipment.find(it=>it.kind==='weapon');
 f.act(f.looter,'take',{sourceId:f.victim,itemId:weapon.id});
 assert.equal(v.equipment.some(it=>it.id===weapon.id),false,'equipped weapon left the body');
 assert.equal(v.weaponId,null,'the downed operator no longer aims a taken weapon');
 assert.ok(p.pack.some(it=>it.id===weapon.id));
 assert.equal(p.weaponId,ownWeapon.id,'looting another gun does not replace the taker weapon');
 assert.equal(f.store.db.prepare('SELECT account FROM inventory WHERE id=?').get(weapon.id).account,f.looter);

 const armor=v.equipment.find(it=>it.kind==='armor');
 f.act(f.looter,'take',{sourceId:f.victim,itemId:armor.id});
 assert.equal(v.equipment.some(it=>it.id===armor.id),false,'equipped armor is lootable');

 // A rejected transfer restores the raid from its checkpoint, so re-read the
 // operators before continuing instead of holding stale in-memory references.
 const body=f.player(f.victim),med=[...body.equipment,...body.pack].find(it=>it.kind==='med');
 const looter=f.player(f.looter),cap=looter.cap;looter.cap=looter.pack.length;
 assert.throws(()=>f.act(f.looter,'take',{sourceId:f.victim,itemId:med.id}),/Backpack full/);
 const intact=f.player(f.victim);
 assert.ok([...intact.equipment,...intact.pack].some(it=>it.id===med.id),'a rejected take leaves the body intact');
 f.player(f.looter).cap=cap;

 const secured=f.player(f.victim),secure=item('med',{medical:'trauma',quantity:1});secured.secure.push(secure);
 assert.equal(f.service.snapshot(f.looter).bodies[0].items.some(it=>it.id===secure.id),false,'secure pocket is never exposed');
 assert.throws(()=>f.act(f.looter,'take',{sourceId:f.victim,itemId:secure.id}),/Item already claimed/);
 const recovered=f.player(f.victim),recovery=item('weapon',{weapon:'smg',recovery:true});recovered.pack.push(recovery);
 assert.equal(f.service.snapshot(f.looter).bodies[0].items.some(it=>it.id===recovery.id),false,'recovery equipment is never exposed');
});

test('failed body transfers roll back the body and the taker',t=>{
 const f=setup(t);f.down();f.act(f.looter,'search',{sourceId:f.victim});f.time(1002.5);f.service.tick(.05);
 const ammo=[...f.player(f.victim).equipment,...f.player(f.victim).pack].find(it=>it.kind==='ammo'),total=ammo.quantity;
 const auditBefore=f.store.db.prepare("SELECT count(*) n FROM audit WHERE event='raid_transfer'").get().n;
 const checkpoint=f.store.checkpoint;f.store.checkpoint=()=>{throw new Error('body transfer checkpoint failure')};
 assert.throws(()=>f.act(f.looter,'take',{sourceId:f.victim,itemId:ammo.id,quantity:3}),/checkpoint failure/);
 f.store.checkpoint=checkpoint;
 const v=f.player(f.victim),p=f.player(f.looter);
 assert.equal([...v.equipment,...v.pack].filter(it=>it.id===ammo.id).reduce((n,it)=>n+it.quantity,0),total,'body quantity restored');
 assert.equal(p.pack.length,0,'taker backpack restored');
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM audit WHERE event='raid_transfer'").get().n,auditBefore,'audit rolled back');
 f.act(f.looter,'take',{sourceId:f.victim,itemId:ammo.id,quantity:3});
 assert.equal(f.player(f.looter).pack.length,1);
});

test('an opened downed body and its loot survive a service restart',t=>{
 const root=mkdtempSync('/tmp/hs-body-restart-'),file=join(root,'raid.sqlite');
 try{
  let store=new RaidStore(file),now=1000,service=new RaidService(store,{now:()=>now});
  try{
   const victim=store.register('restart_victim','a long body password').id;
   const earnedWeapon=earnedPurchase(store,victim,{sku:'smg'}),earnedAmmo=earnedPurchase(store,victim,{sku:'ammo_medium'});
   service.deploy(victim,{mapId:'relay',requestId:'restart_victim_deployment',itemIds:[earnedWeapon.id,earnedAmmo.id]});
   const mate=store.register('restart_mate','a long body password').id,looter=store.register('restart_looter','a long body password').id;
   service.deploy(mate,{mapId:'relay',requestId:'restart_mate_deployment',recovery:true});
   service.deploy(looter,{mapId:'relay',requestId:'restart_looter_deployment',recovery:true});
   let p=service.byAccount.get(victim),q=service.byAccount.get(looter),m=service.byAccount.get(mate),raid=service.raids.get(p.raidId);
   raid.machines=[];raid.rivals=[];raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};
   for(const x of raid.players.values())Object.assign(x,{protectedUntil:0,move:{x:0,z:0}});
   Object.assign(p,{x:0,y:0,z:0,team:'enemy_team',hp:100,downed:false,bleedUntil:0});
   Object.assign(m,{x:0,z:1,team:'enemy_team'});
   Object.assign(q,{x:0,z:-2,team:'looter_team'});
   service.damage(raid,p,200,{source:'operator'});
   assert.equal(p.downed,true);
   service.action(looter,{type:'search',seq:1,sourceId:victim});
   now=1002.5;service.tick(.05);
   assert.equal(p.bodyOpen,true);
   const weaponId=p.equipment.find(it=>it.kind==='weapon').id;
   service.action(looter,{type:'take',seq:2,sourceId:victim,itemId:weaponId});
   assert.equal(p.equipment.some(it=>it.id===weaponId),false);
   service.close();store.close();
   store=new RaidStore(file);now=1003;service=new RaidService(store,{now:()=>now});
   p=service.byAccount.get(victim);q=service.byAccount.get(looter);raid=service.raids.get(p.raidId);
   assert.equal(p.bodyOpen,true,'searched body persists');
   assert.equal(q.pack.some(it=>it.id===weaponId),true,'taken weapon persists');
   const ammo=[...p.equipment,...p.pack].find(it=>it.kind==='ammo');
   service.action(looter,{type:'take',seq:3,sourceId:victim,itemId:ammo.id,quantity:4});
   assert.equal(q.pack.some(it=>it.splitFrom===ammo.id),true);
  }finally{service.close();store.close()}
 }finally{rmSync(root,{recursive:true,force:true})}
});
