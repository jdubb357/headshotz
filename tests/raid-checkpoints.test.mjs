import {earnedPurchase} from './earned-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';

test('restart and rejected-action rollback select the latest deployment across historical raids',t=>{
 const store=new RaidStore();let service=new RaidService(store,{now:()=>1000});t.after(()=>{service.close();store.close()});
 const id=store.register('historical_bodies','a long historical password').id,deploy=(requestId,mapId)=>service.deploy(id,{requestId,mapId,recovery:true});
 deploy('history_first','relay');service.atomic(()=>{const p=service.byAccount.get(id);service.end(service.raids.get(p.raidId),p,'death')});
 deploy('history_second','reservoir');service.atomic(()=>{const p=service.byAccount.get(id);service.end(service.raids.get(p.raidId),p,'death')});
 const latest=deploy('history_third','switchyard');service.raids=new Map([...service.raids].reverse());assert.equal(service.raids.size,3);assert.equal([...service.raids.values()].at(-1).players.get(id).alive,false,'checkpoint iteration can put an older dead body after the current body');
 assert.throws(()=>service.action(id,{type:'use',itemId:'not_owned',seq:1}),/not owned/);assert.equal(service.snapshot(id).self.deploymentId,latest.self.deploymentId);assert.equal(service.snapshot(id).self.alive,true);
 service.close();store.db.prepare('UPDATE raid_checkpoints SET updated=CASE WHEN id=? THEN 0 ELSE 1 END').run(latest.raidId);service=new RaidService(store,{now:()=>1001});assert.equal(service.snapshot(id).self.deploymentId,latest.self.deploymentId);assert.equal(service.snapshot(id).self.alive,true);assert.equal(service.snapshot(id).self.seq,1);assert.equal(store.results(id).length,2);
 const ammo=service.snapshot(id).self.ammo;service.action(id,{type:'fire',seq:2});assert.equal(service.snapshot(id).self.ammo,ammo-1);
});

test('action rollback leaves other raid simulations and operator bindings untouched',t=>{
 const store=new RaidStore(),service=new RaidService(store,{now:()=>1000});t.after(()=>{service.close();store.close()});
 const a=store.register('isolated_action_a','a long isolated password').id,b=store.register('isolated_action_b','a long isolated password').id;service.deploy(a,{requestId:'isolated_first',mapId:'relay',recovery:true});service.deploy(b,{requestId:'isolated_second',mapId:'reservoir',recovery:true});
 const other=service.byAccount.get(b),world=service.raids.get(other.raidId),before=structuredClone(service.snapshot(b));assert.throws(()=>service.action(a,{type:'use',itemId:'not_owned',seq:1}),/not owned/);assert.strictEqual(service.byAccount.get(b),other);assert.strictEqual(service.raids.get(other.raidId),world);assert.deepEqual(service.snapshot(b),before);
 store.db.exec("CREATE TRIGGER isolated_failure BEFORE UPDATE ON raid_checkpoints BEGIN SELECT RAISE(ABORT,'isolated disk failure'); END;");assert.throws(()=>service.action(a,{type:'fire',seq:2}),/disk failure/);store.db.exec('DROP TRIGGER isolated_failure');assert.strictEqual(service.byAccount.get(b),other);assert.strictEqual(service.raids.get(other.raidId),world);assert.deepEqual(service.snapshot(b),before);assert.equal(service.snapshot(a).self.seq,1);
});

test('checkpoint resumes loot, protected storage and replay protection after restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'headshotz-checkpoint-')),file=join(dir,'raid.sqlite');let store,service;
 try{
  store=new RaidStore(file);let now=1000;service=new RaidService(store,{now:()=>now});
  const {id}=store.register('restart','a long restart password');service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
  const p=service.byAccount.get(id),r=service.raids.get(p.raidId),c=r.caches[0];r.machines=[];p.x=c.x;p.z=c.z;c.open=true;
  const itemId=c.items[0].id;
  service.action(id,{type:'take',sourceId:c.id,itemId,seq:1});service.action(id,{type:'secure',itemId,seq:2});
  const deployment=p.deploymentId;service.close();store.close();
  store=new RaidStore(file);now=1001;service=new RaidService(store,{now:()=>now});
  const resumed=service.snapshot(id);
  assert.equal(resumed.self.secure[0].id,itemId);assert.equal(resumed.self.seq,2);
  assert.equal(store.profile(id).activeDeployment.id,deployment);assert.equal(store.results(id).length,0);
  assert.equal(service.action(id,{type:'secure',itemId,seq:2}).duplicate,true);
  assert.equal(service.snapshot(id).self.secure.length,1);
  const restored=service.byAccount.get(id),raid=service.raids.get(restored.raidId);
  service.atomic(()=>service.end(raid,restored,'death'));
  assert.equal(store.profile(id).items.filter(it=>it.id===itemId).length,1);
  assert.equal(store.results(id).length,1);
 }finally{service?.close();store?.close();rmSync(dir,{recursive:true,force:true})}
});

test('failed checkpoint atomically rolls back a loot pickup in memory and SQLite',t=>{
 const store=new RaidStore();const service=new RaidService(store,{now:()=>1000});t.after(()=>{service.close();store.close()});
 const {id}=store.register('rollback','a long rollback password');service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),r=service.raids.get(p.raidId),c=r.caches[0];p.x=c.x;p.z=c.z;c.open=true;service.atomic(()=>{});
 const itemId=c.items[0].id;
 store.db.exec("CREATE TRIGGER failed_checkpoint BEFORE UPDATE ON raid_checkpoints BEGIN SELECT RAISE(ABORT,'checkpoint disk failure'); END;");
 assert.throws(()=>service.action(id,{type:'take',sourceId:c.id,itemId,seq:1}),/checkpoint disk failure/);
 store.db.exec('DROP TRIGGER failed_checkpoint');
 const restored=service.byAccount.get(id),raid=service.raids.get(restored.raidId);
 assert.equal(restored.pack.length,0);assert.equal(restored.seq,0);assert.equal(raid.caches[0].items[0].id,itemId);
 service.action(id,{type:'take',sourceId:c.id,itemId,seq:1});assert.equal(service.snapshot(id).self.pack.length,1);
});

test('database lease prevents two simulations from spending the same equipment',t=>{
 const store=new RaidStore(),service=new RaidService(store);t.after(()=>{service.close();store.close()});
 assert.throws(()=>new RaidService(store),/Another simulation/);
});

test('expired process lease permits recovery after an unclean shutdown',()=>{
 const dir=mkdtempSync(join(tmpdir(),'headshotz-unclean-')),file=join(dir,'raid.sqlite');let store,service;
 try{
  store=new RaidStore(file);service=new RaidService(store,{now:()=>1000});
  const {id}=store.register('crashed','a long crashed password');service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
  const raidId=service.snapshot(id).raidId;
  // Simulate process termination without close(), followed by lease timeout.
  store.close();store=new RaidStore(file);store.db.exec('UPDATE leases SET expires=0');
  service=new RaidService(store,{now:()=>1002});
  assert.equal(service.snapshot(id).raidId,raidId);assert.equal(store.results(id).length,0);
 }finally{service?.close();store?.close();rmSync(dir,{recursive:true,force:true})}
});

test('indexed inventory prohibits banking one item into two accounts',t=>{
 const store=new RaidStore();t.after(()=>store.close());
 const a=store.register('first','a long first password').id,b=store.register('second','a long second password').id;
 const earned=earnedPurchase(store,a);const depA=store.deploy(a,{requestId:'deploy_0001',itemIds:[earned.id]});
 const depB=store.deploy(b,{requestId:'deploy_0002',recovery:true});
 store.settle(depB.id,{outcome:'extract',items:depA.equipment});
 assert.throws(()=>store.settle(depA.id,{outcome:'extract',items:depA.equipment}),/already owned/);
 assert.equal(store.profile(b).items.filter(it=>it.id===depA.equipment[0].id).length,1);
});
