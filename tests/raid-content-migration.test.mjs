import {SCHEMA_VERSION} from '../server/schema.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {AccountSecurity} from '../server/account-security.mjs';
import {getWorld} from '../shared/raid-worlds.mjs';
import {LocalPrediction} from '../raid-prediction.mjs';
test('unknown map versions reject before replacing live state and failed startup releases its own lease',()=>{
 const store=new RaidStore();let service=new RaidService(store,{now:()=>1000});try{
  const id=store.register('future_map','a long future map password').id;service.deploy(id,{requestId:'future_map_deploy',mapId:'relay',recovery:true});const current=service.byAccount.get(id),saved=structuredClone(service.serialize()),state=service.snapshot(id),prediction=new LocalPrediction(state),world=prediction.world;saved[0].worldVersion=99;for(const version of [0,4,99,-1,'2',null])assert.equal(getWorld('relay',version),undefined);assert.throws(()=>service.restore(saved),/unknown map version/);for(const version of [0,null])assert.throws(()=>service.restore(saved.map(r=>({...r,worldVersion:version}))),/unknown map version/);assert.strictEqual(service.byAccount.get(id),current);assert.throws(()=>prediction.reconcile({...state,mapVersion:99}),/Map update required/);assert.strictEqual(prediction.world,world);
  service.close();service=null;store.db.prepare('UPDATE raid_checkpoints SET payload=? WHERE id=?').run(JSON.stringify(saved[0]),saved[0].id);assert.throws(()=>new RaidService(store,{now:()=>1001}),/unknown map version/);assert.equal(store.db.prepare('SELECT count(*) n FROM leases').get().n,0);assert.equal(store.profile(id).activeDeployment.id,state.self.deploymentId);assert.equal(store.results(id).length,0);
 }finally{service?.close();store.close()}
});
test('v5 content-boundary migration preserves accounts, credentials, owned gear and legacy checkpoints',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-content-migration-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service;
 try{
  const account=store.register('content_migration','a long content password'),auth=store.login(account.username,'a long content password');new AccountSecurity(store).generateCodes(auth.token,'a long content password');service=new RaidService(store,{now:()=>1000});service.deploy(account.id,{requestId:'content_migration_raid',mapId:'relay',itemIds:[store.profile(account.id).items.find(it=>it.kind==='weapon').id]});
  const raid=service.raids.get(service.byAccount.get(account.id).raidId);delete raid.lootSeed;delete raid.contentVersion;delete raid.conditionPlan;raid.conditions={name:'Nightfall front',weather:'rain',sky:0x526a83,fog:0x667d90,visibility:.65,light:.85};for(const cache of raid.caches)cache.items=cache.items.filter(it=>it.kind!=='contract');service.close();service=null;store.db.exec('PRAGMA user_version=5');const before=store.profile(account.id),checkpoints=store.loadRaids();store.close();store=new RaidStore(file);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.deepEqual(store.profile(account.id),before);assert.deepEqual(store.loadRaids(),checkpoints);assert.equal(store.authenticate(auth.token),account.id);assert.equal(new AccountSecurity(store).list(auth.token).recoveryRemaining,8);assert.deepEqual(JSON.parse(store.db.prepare("SELECT data FROM audit WHERE event='schema_migrated' ORDER BY id DESC LIMIT 1").get().data),{from:5,to:SCHEMA_VERSION});
  service=new RaidService(store,{now:()=>1001});const restored=service.raids.get(service.byAccount.get(account.id).raidId);assert.equal(restored.conditionPlan,undefined);assert.equal(restored.lootSeed,undefined);assert.equal(restored.caches.flatMap(c=>c.items).some(it=>it.kind==='contract'),false);
 }finally{service?.close();store.close();rmSync(root,{recursive:true,force:true})}
});
test('schema migration refuses an unexpired simulation lease before changing data',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-content-live-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service;
 try{const account=store.register('content_live','a long content password');service=new RaidService(store,{now:()=>1000});service.deploy(account.id,{requestId:'content_live_deploy',mapId:'relay',recovery:true});store.db.exec('PRAGMA user_version=5');const lease=store.db.prepare('SELECT * FROM leases').get(),before=store.profile(account.id);assert.throws(()=>new RaidStore(file),/Stop the active simulation/);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,5);assert.deepEqual(store.db.prepare('SELECT * FROM leases').get(),lease);assert.deepEqual(store.profile(account.id),before);service.close();service=null;store.close();store=new RaidStore(file);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION)}finally{service?.close();store.close();rmSync(root,{recursive:true,force:true})}
});
test('v9 inventory migration preserves a paid armed deployment and session before normal settlement',()=>{
 const root=mkdtempSync(join(tmpdir(),'hs-inventory-migration-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),service;
 try{
  const account=store.register('inventory_migration','a long inventory migration password'),auth=store.login(account.username,'a long inventory migration password'),weapon=store.profile(account.id).items.find(it=>it.kind==='weapon');
  service=new RaidService(store,{now:()=>1000});service.deploy(account.id,{requestId:'inventory_migration_raid',mapId:'relay',itemIds:[weapon.id]});service.action(account.id,{type:'fire',seq:1});service.close();service=null;
  const before=store.profile(account.id),checkpoints=store.loadRaids(),rows=store.db.prepare('SELECT * FROM inventory ORDER BY id').all();store.db.exec('PRAGMA user_version=9');store.close();store=new RaidStore(file);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.deepEqual(store.profile(account.id),before);assert.deepEqual(store.loadRaids(),checkpoints);assert.deepEqual(store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),rows);assert.equal(store.authenticate(auth.token),account.id);
  assert.deepEqual(JSON.parse(store.db.prepare("SELECT data FROM audit WHERE event='schema_migrated' ORDER BY id DESC LIMIT 1").get().data),{from:9,to:SCHEMA_VERSION});
  service=new RaidService(store,{now:()=>1001});const p=service.byAccount.get(account.id);assert.equal(p.weaponId,weapon.id);assert.equal(p.ammo,29);service.end(service.raids.get(p.raidId),p,'extract');assert.equal(store.profile(account.id).items.filter(it=>it.id===weapon.id).length,1);assert.equal(store.profile(account.id).items.find(it=>it.id===weapon.id).loaded,29);
 }finally{service?.close();store.close();rmSync(root,{recursive:true,force:true})}
});
