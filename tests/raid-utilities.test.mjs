import {earnedPurchase} from './earned-fixture.mjs';
import {SCHEMA_VERSION} from '../server/schema.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {advanceUtilities} from '../server/raid-utilities.mjs';
import {advanceMachines} from '../server/raid-ai.mjs';
import {validateAction} from '../shared/raid-protocol.mjs';
import {normalizeSettings,DEFAULT_BINDINGS} from '../shared/raid-settings.mjs';
import {smokeClear} from '../shared/raid-utilities.mjs';
function setup(t,{file=':memory:',earned=false}={}){
 const store=new RaidStore(file);let now=1000;const id=store.register('utility_owner','a long utility password').id;
 for(const sku of ['smoke','decoy','frag'])if(earned)earnedPurchase(store,id,{trader:'engineer',sku});else store.trade(id,{type:'buy',trader:'engineer',sku});
 const profile=store.profile(id),service=new RaidService(store,{now:()=>now});service.deploy(id,{mapId:'relay',requestId:'utility_deployment',itemIds:profile.items.filter(it=>['weapon','utility'].includes(it.kind)).map(it=>it.id)});
 const p=service.byAccount.get(id),raid=service.raids.get(p.raidId);raid.world={...raid.world,blocks:[],ramps:[]};raid.machines=[];raid.conditions={...raid.conditions,visibility:1};Object.assign(p,{x:0,y:0,z:0,yaw:0,pitch:0,protectedUntil:0});
 t.after(()=>{try{service.close()}finally{store.close()}});
 return {store,service,id,p,raid,setNow:value=>now=value,throw:(kind,seq=1)=>service.action(id,{type:'throw',seq,itemId:service.byAccount.get(id).equipment.find(it=>it.utility===kind)?.id,yaw:0,pitch:0})};
}
test('owned utilities debit once, cannot be protected, reject client effects and replay safely',t=>{
 const f=setup(t),id=f.p.equipment.find(it=>it.utility==='smoke').id,packet={type:'throw',seq:1,itemId:id,yaw:0,pitch:0};f.service.action(f.id,packet);assert.equal(f.raid.utilities.length,1);assert.equal(f.p.facts.utilitiesUsed,1);assert.equal(f.p.equipment.some(it=>it.id===id),false);assert.equal(f.store.db.prepare('SELECT location FROM inventory WHERE id=?').get(id).location,'consumed');assert.equal(f.service.action(f.id,packet).duplicate,true);assert.equal(f.raid.utilities.length,1);
 for(const forged of [{damage:1000},{x:50},{owner:'other'},{until:9999}])assert.throws(()=>validateAction({...packet,...forged}),/Unknown action field/);
 const decoy=f.service.byAccount.get(f.id).equipment.find(it=>it.utility==='decoy');assert.throws(()=>f.service.action(f.id,{type:'throw',seq:2,itemId:decoy.id}),/not ready/);
 const p=f.service.byAccount.get(f.id);p.pack.push(p.equipment.splice(p.equipment.findIndex(it=>it.id===decoy.id),1)[0]);assert.throws(()=>f.service.action(f.id,{type:'secure',seq:3,itemId:decoy.id}),/cannot be protected/);
});
test('failed checkpoint restores consumed utility, cooldown, effects and action sequence',t=>{
 const f=setup(t),checkpoint=f.store.checkpoint;f.store.checkpoint=()=>{throw new Error('utility storage failure')};assert.throws(()=>f.throw('smoke'),/utility storage failure/);f.store.checkpoint=checkpoint;
 const p=f.service.byAccount.get(f.id),raid=f.service.raids.get(p.raidId);assert.equal(p.seq,0);assert.equal(p.nextUtility,undefined);assert.ok(p.equipment.some(it=>it.utility==='smoke'));assert.equal(raid.utilities?.length||0,0);assert.equal(p.facts.utilitiesUsed,undefined);
 f.throw('smoke');assert.equal(f.service.raids.get(p.raidId).utilities.length,1);
});
test('smoke obscures rival snapshots and machine perception while bullets remain valid',t=>{
 const f=setup(t),enemy=f.store.register('utility_rival','a long rival password').id;f.service.deploy(enemy,{requestId:'utility_rival_deploy',mapId:'relay',recovery:true});const rival=f.service.byAccount.get(enemy);Object.assign(rival,{x:0,y:0,z:20,protectedUntil:0});
 f.raid.conditions.visibility=1;assert.ok(f.service.snapshot(f.id).players.some(q=>q.id===enemy));f.throw('smoke');f.setNow(1001);f.p.z=9;f.raid.telegraphs.push({id:'nearby_locked_attack',x:0,y:0,z:9,radius:2,until:1003});
 assert.ok(f.service.snapshot(f.id).telegraphs.some(t=>t.id==='nearby_locked_attack'),'smoke does not hide a nearby incoming strike warning');assert.ok(!f.service.snapshot(f.id).players.some(q=>q.id===enemy));assert.equal(f.service.snapshot(f.id).utilities[0].owner,undefined);
 const m={id:'smoke_scout',kind:'scout',hp:75,x:0,y:0,z:19,yaw:Math.PI,nextAttack:0,home:{x:0,y:0,z:19}};f.raid.machines=[m];rival.alive=false;advanceMachines(f.service,f.raid,.05,1001);assert.equal(m.attack,undefined);
 const hp=rival.hp;rival.alive=true;f.service.action(f.id,{type:'fire',seq:2,yaw:0,pitch:0});assert.ok(rival.hp<hp||m.hp<75,'smoke is not bulletproof cover');
 f.raid.machines=[m];rival.alive=false;f.setNow(1020);advanceUtilities(f.service,f.raid,1020);advanceMachines(f.service,f.raid,.05,1020);assert.equal(m.target,f.id);assert.ok(m.attack);
});
test('noise lure attracts idle machines but never overrides a visible operator',t=>{
 const f=setup(t);f.throw('decoy');f.setNow(1001);advanceUtilities(f.service,f.raid,1001);const lure=f.raid.utilities[0];Object.assign(f.p,{x:-60,z:-60});
 const m={id:'lure_scout',kind:'scout',hp:75,x:15,y:0,z:10,yaw:0,nextAttack:2000,home:{x:15,y:0,z:10}};f.raid.machines=[m];advanceMachines(f.service,f.raid,.05,1001);assert.equal(m.state,'investigate');assert.equal(m.investigate.x,lure.x);assert.equal(m.investigate.z,lure.z);
 Object.assign(f.p,{x:15,z:15});advanceMachines(f.service,f.raid,.05,1001.1);assert.equal(m.target,f.id);assert.equal(m.lastSeen.x,f.p.x);f.setNow(1014);advanceUtilities(f.service,f.raid,1014);assert.equal(f.raid.utilities.length,0);
});
test('charge blast uses server distance/cover, protects squadmates and can injure its owner',t=>{
 const f=setup(t);f.throw('frag');const charge=f.raid.utilities[0],friend={...structuredClone(f.p),account:'friend',hp:100,equipment:[],x:charge.x,z:charge.z},enemy={...structuredClone(friend),account:'enemy',team:'enemy',x:charge.x+1},covered={...structuredClone(enemy),account:'covered',x:charge.x-2};f.raid.players.set(friend.account,friend);f.raid.players.set(enemy.account,enemy);f.raid.players.set(covered.account,covered);
 f.raid.world.blocks.push([charge.x-1,charge.z,.3,3,3]);Object.assign(f.p,{x:charge.x,z:charge.z});f.setNow(1002);advanceUtilities(f.service,f.raid,1002);
 assert.equal(friend.hp,100);assert.equal(covered.hp,100);assert.ok(enemy.hp<100);assert.ok(f.p.hp<100);const health=enemy.hp;advanceUtilities(f.service,f.raid,1002.1);assert.equal(enemy.hp,health,'blast never repeats');
});
test('utility placement stops before walls and downed operators cannot throw',t=>{
 const f=setup(t);f.raid.world.blocks=[[0,5,12,1,5]];f.throw('smoke');assert.ok(f.raid.utilities[0].z<4.5);f.p.downed=true;f.setNow(1002);assert.throws(()=>f.throw('decoy',2),/Downed/);
});
test('legacy remaps retain their keys when the utility action is added',()=>{
 const bindings={...DEFAULT_BINDINGS,fire:'KeyG',utility:undefined};delete bindings.utility;const s=normalizeSettings({bindings});assert.equal(s.bindings.fire,'KeyG');assert.notEqual(s.bindings.utility,'KeyG');assert.equal(new Set(Object.values(s.bindings)).size,Object.keys(s.bindings).length);
});
test('smoke segment occlusion honors activation, expiry, height and tangents',()=>{
 const smoke={kind:'smoke',x:0,y:0,z:5,radius:4,activeAt:10,until:20},a={x:0,y:1.5,z:0},b={x:0,y:1.5,z:10};assert.equal(smokeClear([smoke],a,b,9),true);assert.equal(smokeClear([smoke],a,b,10),false);assert.equal(smokeClear([smoke],a,b,20),true);assert.equal(smokeClear([smoke],{...a,y:8},{...b,y:8},11),true);
});
test('active effects survive file-backed checkpoint restart without regranting their item',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-utility-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service;try{
  const id=store.register('utility_restart','a long utility password').id;store.trade(id,{type:'buy',trader:'engineer',sku:'frag'});const items=store.profile(id).items.filter(it=>it.kind==='weapon'||it.kind==='utility');service=new RaidService(store,{now:()=>1000});service.deploy(id,{mapId:'relay',requestId:'utility_restart_deploy',itemIds:items.map(it=>it.id)});const packet={type:'throw',seq:1,itemId:items.find(it=>it.kind==='utility').id,yaw:0,pitch:0};service.action(id,packet);const saved=structuredClone(service.serialize());service.close();store.close();store=new RaidStore(file);service=new RaidService(store,{now:()=>1001});assert.deepEqual(service.serialize(),saved);assert.equal(service.action(id,packet).duplicate,true);assert.equal(service.raids.get(service.byAccount.get(id).raidId).utilities.length,1);assert.ok(!service.byAccount.get(id).equipment.some(it=>it.id===packet.itemId));
 }finally{service?.close();store.close();rmSync(root,{recursive:true,force:true})}
});
test('a delayed charge detonates once after a missed fuse window and rolls back a failed tick',t=>{
 const f=setup(t);f.throw('frag');const charge=f.raid.utilities[0];Object.assign(f.p,{x:charge.x,z:charge.z});f.setNow(1005);const hp=f.p.hp,checkpoint=f.store.checkpoint;f.store.checkpoint=()=>{throw new Error('blast checkpoint failure')};
 assert.throws(()=>f.service.tick(.05),/blast checkpoint failure/);f.store.checkpoint=checkpoint;assert.equal(f.service.byAccount.get(f.id).hp,hp);assert.equal(f.service.raids.get(f.p.raidId).utilities[0].detonated,false);
 f.service.tick(.05);const after=f.service.byAccount.get(f.id).hp;assert.ok(after<hp);assert.equal(f.service.raids.get(f.p.raidId).utilities.length,0);f.setNow(1005.1);f.service.tick(.05);assert.equal(f.service.byAccount.get(f.id).hp,after);
});
test('v6 to v7 migration preserves prior profiles, sessions and checkpoints verbatim',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-utility-migration-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service;try{
  const id=store.register('utility_migration','a long migration password').id,auth=store.login('utility_migration','a long migration password');service=new RaidService(store,{now:()=>1000});service.deploy(id,{requestId:'utility_migration_deploy',mapId:'relay',recovery:true});service.close();service=null;
  const before=store.profile(id),saved=store.loadRaids();store.db.exec('PRAGMA user_version=6');store.close();store=new RaidStore(file);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.deepEqual(store.profile(id),before);assert.deepEqual(store.loadRaids(),saved);assert.equal(store.authenticate(auth.token),id);assert.deepEqual(JSON.parse(store.db.prepare("SELECT data FROM audit WHERE event='schema_migrated' ORDER BY id DESC LIMIT 1").get().data),{from:6,to:SCHEMA_VERSION});
 }finally{service?.close();store.close();rmSync(root,{recursive:true,force:true})}
});
for(const [recipe,materials]of Object.entries({smoke:['chem','fuel'],decoy:['wire','steel'],frag:['steel','steel','wire','fuel']}))test(`${recipe} crafting consumes owned salvage and produces an owned deployable utility`,()=>{
 const store=new RaidStore();try{const id=store.register('utility_crafter','a long craft password').id;for(const sku of materials)store.trade(id,{type:'buy',trader:'engineer',sku});if(recipe==='frag')store.trade(id,{type:'upgrade',upgrade:'bench'});const before=store.profile(id);store.trade(id,{type:'craft',recipe});const after=store.profile(id),utility=after.items.find(it=>it.utility===recipe);assert.ok(utility);assert.equal(utility.quantity,1);assert.ok(after.credits<before.credits);assert.ok(after.items.filter(it=>it.kind==='material').reduce((n,it)=>n+it.quantity,0)<before.items.filter(it=>it.kind==='material').reduce((n,it)=>n+it.quantity,0));
  const weapon=after.items.find(it=>it.kind==='weapon');assert.ok(store.deploy(id,{requestId:'crafted_utility_raid',itemIds:[weapon.id,utility.id]}).equipment.some(it=>it.id===utility.id));
 }finally{store.close()}
});
test('unused utilities can transfer through a death bag once and bank with their new owner',t=>{
 const f=setup(t,{earned:true}),enemy=f.store.register('utility_looter','a long looter password').id;f.service.deploy(enemy,{mapId:'relay',requestId:'utility_looter_raid',recovery:true});const rival=f.service.byAccount.get(enemy);Object.assign(rival,{x:f.p.x,y:f.p.y,z:f.p.z,protectedUntil:0});const item=f.p.equipment.find(it=>it.utility==='decoy');f.service.end(f.raid,f.p,'death');const bag=f.raid.bags.find(b=>b.items.some(it=>it.id===item.id));
 f.service.action(enemy,{type:'take',seq:1,sourceId:bag.id,itemId:item.id});assert.equal(rival.pack.find(it=>it.id===item.id).utility,'decoy');assert.throws(()=>f.service.action(enemy,{type:'take',seq:2,sourceId:bag.id,itemId:item.id}),/already claimed/);
 const current=f.service.byAccount.get(enemy);f.service.end(f.raid,current,'extract');assert.ok(f.store.profile(enemy).items.some(it=>it.id===item.id));assert.ok(!f.store.profile(f.id).items.some(it=>it.id===item.id));assert.equal(f.store.db.prepare('SELECT count(*) n FROM inventory WHERE id=?').get(item.id).n,1);
});
