import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryRaidStore} from '../shared/raid-store-memory.mjs';
import {PersistentRaidStore,createMemorySnapshotBackend,createFallbackSnapshotBackend} from '../shared/raid-store-persist.mjs';
import {createLocalStorageBackend,RAID_LOCAL_KEY} from '../shared/raid-store-local.mjs';
import {RaidService} from '../server/raids.mjs';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {WEAPONS} from '../shared/raid-catalog.mjs';

const fakeLocalStorage=()=>{
  const values=new Map();
  return {values,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
};

const deployRequest=(profile,requestId)=>{
  const itemIds=[profile.items.find(it=>it.kind==='weapon').id,profile.items.find(it=>it.kind==='armor').id];
  return {requestId,mapId:RAID_WORLDS[0].id,itemIds,recovery:false,insureIds:[]};
};

test('exportState/importState round-trip the guest profile, stash and active deployment', () => {
  const store=new MemoryRaidStore();
  const guest=store.createGuest('persist_round_trip');
  let clock=1000;const service=new RaidService(store,{now:()=>clock,owner:'round-trip'});
  const before=store.profile(guest.id);
  const snapshot=service.deploy(guest.id,deployRequest(before,'persist_round_0001'));
  const moved=service.action(guest.id,{type:'move',x:0,z:0,yaw:0,pitch:0,sprint:false,seq:1,raidId:snapshot.raidId,deploymentId:snapshot.self.deploymentId,protocol:RAID_PROTOCOL});
  assert.equal(moved.accepted,true);
  clock+=.05;
  service.tick(.05);

  const expected=store.profile(guest.id);
  const restored=new MemoryRaidStore().importState(store.exportState());
  const profile=restored.profile(guest.id);
  assert.equal(profile.username,'persist_round_trip');
  assert.ok(profile.activeDeployment,'the unfinished deployment is present');
  assert.equal(profile.activeDeployment.id,snapshot.self.deploymentId);
  assert.deepEqual(profile.items,expected.items,'the stash survives the snapshot');
  assert.equal(profile.credits,expected.credits);
  assert.equal(restored.loadRaids().some(raid=>raid.id===snapshot.raidId),true,'the raid checkpoint survives');
  service.close();
});

test('a persistent store can hydrate, resume an unfinished raid, and settle on a fresh store', async () => {
  const backend=createMemorySnapshotBackend();
  let clock=2000;
  const store=new PersistentRaidStore({backend,flushDelayMs:5});
  await store.hydrate();
  const guest=store.createGuest('persist_reload');
  const service=new RaidService(store,{now:()=>clock,owner:'persist-first'});
  const snapshot=service.deploy(guest.id,deployRequest(store.profile(guest.id),'persist_reload_0001'));
  service.action(guest.id,{type:'move',x:1,z:0,yaw:0,pitch:0,sprint:false,seq:2,raidId:snapshot.raidId,deploymentId:snapshot.self.deploymentId,protocol:RAID_PROTOCOL});
  clock+=.05;
  service.tick(.05);
  const beforeClose=service.snapshot(guest.id).self;
  await store.flushNow();
  assert.ok(backend.peek(),'the committed store snapshot was written');
  service.close();

  const reopened=new PersistentRaidStore({backend,flushDelayMs:5});
  await reopened.hydrate();
  assert.equal(reopened.createGuest('persist_reload').id,guest.id,'the guest account is restored by name');
  const resumedService=new RaidService(reopened,{now:()=>clock,owner:'persist-second'});
  const resumed=resumedService.snapshot(guest.id);
  assert.equal(resumed.raidId,snapshot.raidId,'the active checkpoint is restored');
  assert.equal(resumed.self.deploymentId,snapshot.self.deploymentId);
  assert.ok(Math.hypot(resumed.self.x-beforeClose.x,resumed.self.z-beforeClose.z)<0.01,'the authoritative last position survives');
  assert.equal(resumed.self.hp,beforeClose.hp);

  const exit=resumedService.raids.get(resumed.raidId).exits[0];
  const player=resumedService.byAccount.get(guest.id);
  player.x=exit.x;player.y=exit.y||0;player.z=exit.z;
  exit.openAt=clock-1;exit.closeAt=clock+60;exit.seats=10;
  resumedService.action(guest.id,{type:'extract',seq:3,exitId:exit.id,protocol:RAID_PROTOCOL});
  clock+=4;
  resumedService.tick(.05);
  assert.equal(player.result.outcome,'extract','the restored deployment still settles');
  await reopened.flushNow();
  resumedService.close();

  const finalStore=new PersistentRaidStore({backend,flushDelayMs:5});
  const snapshotState=await finalStore.hydrate();
  assert.equal(snapshotState.profile(guest.id).activeDeployment,null,'settlement clears the active deployment durably');
  assert.equal(snapshotState.profile(guest.id).credits,270,'settled credits persist');
  assert.equal(snapshotState.profile(guest.id).items.some(it=>WEAPONS[it.weapon]?.name),true,'returned gear stays in the stash');
  await finalStore.flushNow();
  finalStore.close();
});

test('importState rejects a malformed snapshot instead of accepting partial state', () => {
  const store=new MemoryRaidStore();
  assert.throws(()=>store.importState({version:1,accounts:[]}),/missing byUsername/);
  assert.throws(()=>store.importState({version:2}),/Unsupported persisted raid state version/);
  assert.throws(()=>store.importState(null),/Invalid persisted raid state/);
});

test('the persistent adapter remains free of node: imports', async () => {
  const {readFileSync}=await import('node:fs');
  for(const name of ['shared/raid-store-persist.mjs','shared/raid-store-idb.mjs']){
    assert.equal(/from\s+['"]node:/.test(readFileSync(new URL('../'+name,import.meta.url),'utf8')),false,name+' must not import node:*');
  }
});

test('a missing IndexedDB falls back to localStorage and restores the guest by name', async () => {
  const storage=fakeLocalStorage();
  const unavailable={name:'indexeddb',async load(){throw new Error('IndexedDB is unavailable')},async save(){throw new Error('IndexedDB is unavailable')}};
  const backend=createFallbackSnapshotBackend(unavailable,createLocalStorageBackend({storage}));
  const store=new PersistentRaidStore({backend,flushDelayMs:5});
  await store.hydrate();
  const guest=store.createGuest('local_fallback');
  const items=store.profile(guest.id).items.map(it=>it.id);
  await store.flushNow();
  assert.equal(backend.getActiveName(),'localStorage','the fallback backend was selected');
  assert.ok(storage.getItem(RAID_LOCAL_KEY),'the snapshot was persisted under the localStorage key');

  const reopened=new PersistentRaidStore({backend:createFallbackSnapshotBackend(unavailable,createLocalStorageBackend({storage})),flushDelayMs:5});
  await reopened.hydrate();
  assert.equal(reopened.createGuest('local_fallback').id,guest.id,'the guest account is restored from localStorage');
  assert.deepEqual(reopened.profile(guest.id).items.map(it=>it.id),items,'the stash survives the localStorage round-trip');
  reopened.close();
});

test('a failed IndexedDB write degrades to localStorage without throwing', async () => {
  const storage=fakeLocalStorage();
  const failingSave={name:'indexeddb',async load(){return null},async save(){throw new Error('Quota exceeded')}};
  const backend=createFallbackSnapshotBackend(failingSave,createLocalStorageBackend({storage}));
  const store=new PersistentRaidStore({backend,flushDelayMs:5});
  await store.hydrate();
  const guest=store.createGuest('local_degrade');
  await store.flushNow();
  assert.equal(backend.getActiveName(),'localStorage','the failed primary is bypassed for later writes');
  assert.equal(JSON.parse(storage.getItem(RAID_LOCAL_KEY)).accounts[0][0],guest.id,'the last state is durable in localStorage');
  store.close();
});
