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
