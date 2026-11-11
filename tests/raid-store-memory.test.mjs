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
