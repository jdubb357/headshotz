import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MemoryRaidStore} from '../shared/raid-store-memory.mjs';
import {item,RuleError} from '../shared/raid-rules.mjs';
import {RaidService} from '../server/raids.mjs';

const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('the memory adapter stays free of Node-only imports', () => {
  for(const name of ['shared/raid-store-memory.mjs','shared/raid-rules.mjs','server/rules.mjs']){
    const text=source(name);
    assert.equal(/from\s+['"]node:/.test(text),false,name+' must not import node:*');
  }
});

test('a fresh store constructs the authoritative RaidService', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  const service=new RaidService(store,{now:()=>0});
  assert.ok(service instanceof RaidService);
  assert.equal(service.store,store);
  assert.equal(service.raids.size,0);
  service.close();
  assert.equal(store.leases.size,0,'closing releases the simulation lease');
});

test('a guest profile mirrors the online starter account and has no earned loot', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  const profile=store.profile(guest.id);
  assert.equal(profile.id,guest.id);
  assert.equal(profile.username,'guest');
  assert.equal(profile.credits,250);
  assert.equal(profile.grantCredits,250);
  assert.equal(profile.items.length,4);
  assert.deepEqual(profile.items.map(it=>it.kind),['weapon','armor','med','med']);
  assert.equal(profile.items[0].weapon,'ar');
  assert.ok(profile.items.every(it=>it.grantOwner===guest.id));
  assert.equal(profile.revision,1);
  assert.deepEqual(profile.overflow,[]);
  assert.deepEqual(profile.insurance,[]);
  assert.equal(profile.activeDeployment,null);
  assert.equal(Object.keys(profile.sellValues).length,4);
  assert.ok(Object.values(profile.sellValues).every(value=>Number.isInteger(value)&&value>=0));
  assert.deepEqual(profile.upgrades,{stash:0,bay:0,bench:0});
  assert.deepEqual(profile.materials,{steel:0,wire:0,chem:0,fuel:0});
});

test('creating the same guest name reuses the account; a different name creates another', () => {
  const store=new MemoryRaidStore();
  const first=store.createGuest('Guest');
  const same=store.createGuest('guest');
  assert.deepEqual(same,first);
  assert.equal(store.accounts.size,1);
  const second=store.createGuest('guest_two');
  assert.notEqual(second.id,first.id);
  assert.equal(store.accounts.size,2);
});

test('state and inventory round-trip through save without node:sqlite', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  const state=store.state(guest.id);
  state.items.splice(1,1);
  state.items.push(item('med',{medical:'bandage'}));
  state.credits+=25;
  store.save(guest.id,state);
  const profile=store.profile(guest.id);
  assert.equal(profile.items.length,4,'one starter item removed, one earned med added');
  assert.deepEqual(profile.items.map(it=>it.kind),['weapon','med','med','med']);
  assert.equal(profile.credits,275);
  assert.equal(profile.revision,2);
});

test('the in-memory checkpoint and lease methods satisfy the service contract', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  store.checkpoint({id:'raid-1',world:'relay',players:[{account:guest.id}]});
  assert.equal(store.loadRaids().length,1);
  assert.deepEqual(store.loadRaids()[0].players,[{account:guest.id}]);
  assert.equal(store.recoverInterrupted(),0);
  assert.equal(store.acquireLease('owner-a'),true);
  assert.throws(()=>store.acquireLease('owner-b'),RuleError);
  assert.equal(store.acquireLease('owner-a'),true);
  store.releaseLease('owner-a');
  assert.equal(store.acquireLease('owner-b'),true);
});

test('candidate profile has no active deployment and an empty audit history for fresh reads', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  assert.equal(store.profile(guest.id).activeDeployment,null);
  assert.deepEqual(store.auditLog.map(entry=>entry.event),['account_created']);
  assert.throws(()=>store.profile('missing'),RuleError);
});

test('claimLoot invalidates rival insurance claims, matching the online store', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest();
  const rival=store.createGuest('rival');
  store.insurance.set('claim-covered',{account:rival.id,item:'loot-1',deployment:'d1',status:'covered',due:null,premium:5});
  store.insurance.set('claim-pending',{account:rival.id,item:'loot-1',deployment:'d2',status:'pending',due:0,premium:5});
  store.insurance.set('claim-own',{account:guest.id,item:'loot-1',deployment:'d3',status:'covered',due:null,premium:5});
  store.insurance.set('claim-returned',{account:rival.id,item:'loot-1',deployment:'d4',status:'returned',due:null,premium:5});
  store.claimLoot('loot-1',guest.id);
  assert.equal(store.insurance.get('claim-covered').status,'claimed_by_other');
  assert.equal(store.insurance.get('claim-pending').status,'claimed_by_other');
  assert.equal(store.insurance.get('claim-own').status,'covered','the taker keeps their own claim');
  assert.equal(store.insurance.get('claim-returned').status,'returned','settled claims are untouched');
});

const deployRequest=(profile,requestId)=>({
  itemIds:[profile.items.find(it=>it.kind==='weapon').id,profile.items.find(it=>it.kind==='armor').id],
  mapId:'relay',requestId,recovery:false,insureIds:[],
});

test('a guest can deploy, act, board an extraction and settle through the authoritative service', () => {
  const store=new MemoryRaidStore();const guest=store.createGuest();let clock=1000;
  const service=new RaidService(store,{now:()=>clock,owner:'offline-owner'});
  const request=deployRequest(store.profile(guest.id),'deploy-0001');
  const snapshot=service.deploy(guest.id,request);
  assert.equal(snapshot.self.alive,true);
  assert.equal(snapshot.self.equipment.length,2);
  assert.equal(snapshot.self.ammo,30);
  assert.equal(service.raids.size,1);
  assert.equal(store.profile(guest.id).items.length,2,'deployed gear leaves the stash');
  assert.equal(store.profile(guest.id).activeDeployment.equipment.length,2);
  assert.throws(()=>store.deploy(guest.id,{...request,requestId:'deploy-0002'}),RuleError,'one active deployment at a time');

  service.action(guest.id,{type:'move',seq:1,x:0,z:1,yaw:0,pitch:0,protocol:11});
  clock+=.5;service.tick(.05);
  service.action(guest.id,{type:'fire',seq:2,yaw:0,pitch:0,protocol:11});
  clock+=1;
  const raid=service.raids.get(snapshot.raidId),player=service.byAccount.get(guest.id);
  const exit=raid.exits[0];
  player.x=exit.x;player.y=exit.y||0;player.z=exit.z;
  exit.openAt=clock-1;exit.closeAt=clock+60;exit.seats=10;
  service.action(guest.id,{type:'extract',seq:3,exitId:exit.id,protocol:11});
  assert.ok(player.board,'boarding action is authoritative');
  clock+=4;
  service.tick(.05);
  assert.equal(player.result.outcome,'extract');
  assert.equal(player.result.credits,20);
  assert.equal(player.result.items.length,2);
  assert.equal(player.result.lostItems.length,0);
  const finished=store.profile(guest.id);
  assert.equal(finished.items.length,4,'two starter meds and both deployed items return');
  assert.equal(finished.items.every(it=>it.grantOwner===guest.id),true);
  assert.equal(finished.credits,270);
  assert.equal(finished.xp,20);
  assert.equal(finished.activeDeployment,null);
  assert.equal(store.results(guest.id).length,1,'authoritative results are recorded');
  service.close();
});

test('a death settlement drops raid gear to lost inventory instead of returning it', () => {
  const store=new MemoryRaidStore();const guest=store.createGuest();const clock=1000;
  const service=new RaidService(store,{now:()=>clock,owner:'offline-owner'});
  const snapshot=service.deploy(guest.id,deployRequest(store.profile(guest.id),'deploy-0003'));
  const raid=service.raids.get(snapshot.raidId),player=service.byAccount.get(guest.id);
  service.end(raid,player,'death','machine_fire');
  assert.equal(player.result.outcome,'death');
  assert.equal(player.result.items.length,0,'no secure pocket item survives this run');
  assert.equal(player.result.credits,0);
  const profile=store.profile(guest.id);
  assert.equal(profile.items.length,2,'only the two starter meds remain in the stash');
  assert.equal(profile.items.every(it=>it.kind==='med'),true);
  const lost=[...store.inventory.values()].filter(entry=>entry.location==='lost');
  assert.equal(lost.length,2,'both deployed gear items are lost, not silently returned');
  assert.equal(store.results(guest.id)[0].lostItems.length,2);
  assert.equal(store.profile(guest.id).activeDeployment,null);
  service.close();
});

const stockGuest=(materials={},mutate=()=>{})=>{
  const store=new MemoryRaidStore(),guest=store.createGuest();
  const state=store.state(guest.id);
  for(const [material,quantity]of Object.entries(materials))state.items.push(item('material',{material,quantity}));
  mutate(state);
  store.save(guest.id,state);
  return {store,guest,revision:store.state(guest.id).revision};
};

test('offline trade crafts from salvage under the authoritative recipe rules', () => {
  const {store,guest,revision}=stockGuest({steel:2,chem:1});
  assert.throws(()=>store.trade(guest.id,{type:'craft',recipe:'med',expectedRevision:revision-1}),RuleError,'a stale stash revision is rejected');
  const profile=store.trade(guest.id,{type:'craft',recipe:'med',expectedRevision:revision});
  assert.equal(profile.credits,245,'the recipe cost is charged once');
  assert.equal(profile.items.filter(it=>it.kind==='med').length,3,'the starter meds plus the crafted medkit');
  assert.equal(profile.items.filter(it=>it.kind==='material'&&it.material==='steel').reduce((n,it)=>n+it.quantity,0),1);
  assert.equal(profile.items.filter(it=>it.kind==='material'&&it.material==='chem').length,0,'consumed materials leave the stash');
  assert.equal(store.profile(guest.id).items.filter(it=>it.kind==='med').length,3,'the craft persists through the profile');
  assert.throws(()=>store.trade(guest.id,{type:'craft',recipe:'sniper_blueprint',expectedRevision:store.state(guest.id).revision}),RuleError,'rank gating still applies offline');
});

test('offline trade repairs damage through the shared repair rules', () => {
  const {store,guest,revision}=stockGuest({steel:1,wire:1},state=>{state.items.find(it=>it.kind==='weapon').condition=40});
  const weapon=store.state(guest.id).items.find(it=>it.kind==='weapon');
  const repaired=store.trade(guest.id,{type:'repair',itemId:weapon.id,quality:'full',expectedRevision:revision});
  assert.equal(repaired.items.find(it=>it.id===weapon.id).condition,100,'full repair restores the weapon');
  assert.equal(repaired.credits,220,'the 30-credit repair cost is charged');
  assert.equal(repaired.items.filter(it=>it.kind==='material'&&it.material==='steel').length,0,'one steel is consumed');
  assert.throws(()=>store.trade(guest.id,{type:'repair',itemId:weapon.id,quality:'patch',expectedRevision:repaired.revision}),RuleError,'pristine equipment cannot be repaired');
});

test('offline trade upgrades the workbench when credits and salvage are available', () => {
  const {store,guest,revision}=stockGuest({steel:2,wire:1});
  const upgraded=store.trade(guest.id,{type:'upgrade',upgrade:'bench',expectedRevision:revision});
  assert.equal(upgraded.upgrades.bench,1);
  assert.equal(upgraded.credits,150,'the next workbench tier costs 100 credits');
  assert.equal(upgraded.items.filter(it=>it.kind==='material').length,0,'the upgrade consumes two steel and one wire');
});

test('offline trade moves stackable salvage and persists favorites', () => {
  const {store,guest,revision}=stockGuest({steel:5});
  const steel=store.state(guest.id).items.find(it=>it.kind==='material'&&it.material==='steel');
  const split=store.trade(guest.id,{type:'split',itemId:steel.id,quantity:2,expectedRevision:revision});
  const stacks=split.items.filter(it=>it.kind==='material'&&it.material==='steel');
  assert.equal(stacks.length,2,'splitting creates a second stack');
  assert.deepEqual(stacks.map(it=>it.quantity).sort(),[2,3]);
  const target=stacks.find(it=>it.quantity===3);
  const merged=store.trade(guest.id,{type:'stack',itemId:stacks.find(it=>it.quantity===2).id,targetId:target.id,expectedRevision:split.revision});
  assert.equal(merged.items.filter(it=>it.kind==='material'&&it.material==='steel').length,1);
  const favorited=store.trade(guest.id,{type:'favorite',itemId:target.id,favorite:true,expectedRevision:merged.revision});
  assert.equal(favorited.items.find(it=>it.id===target.id).favorite,true);
});

test('offline trade rejects trading during an active deployment and stubs online-only actions', () => {
  const store=new MemoryRaidStore(),guest=store.createGuest();
  assert.throws(()=>store.trade(guest.id,{type:'buy',trader:'outfitter',sku:'steel'}),error=>error.status===501,'traders stay unavailable offline');
  assert.throws(()=>store.trade(guest.id,{type:'contract',contract:'survey',operation:'accept'}),error=>error.status===501,'contracts stay unavailable offline');
  const service=new RaidService(store,{now:()=>1000,owner:'offline-owner'});
  service.deploy(guest.id,deployRequest(store.profile(guest.id),'deploy-local-1'));
  assert.throws(()=>store.trade(guest.id,{type:'favorite',itemId:'whatever',favorite:true}),/Return from your raid/);
  service.close();
});
