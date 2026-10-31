import {earnedPurchase} from './earned-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
function setup(t){const store=new RaidStore();t.after(()=>store.close());const account=store.register('austin','a long test password');return {store,id:account.id}}
test('accounts authenticate without storing raw session credentials',t=>{
 const {store,id}=setup(t),login=store.login('austin','a long test password');
 assert.equal(store.authenticate(login.token),id);
 assert.throws(()=>store.login('austin','wrong password'),/Invalid/);
 assert.notEqual(store.db.prepare('SELECT token FROM sessions').get().token,login.token);
 store.logout(login.token);assert.throws(()=>store.authenticate(login.token),/Sign in/);
});
test('deployment removes owned items once and locks concurrent sessions',t=>{
 const {store,id}=setup(t),gear=store.profile(id).items.slice(0,3).map(it=>it.id);
 const first=store.deploy(id,{requestId:'request_0001',itemIds:gear});
 assert.equal(store.profile(id).items.length,1);
 assert.equal(store.deploy(id,{requestId:'request_0001',itemIds:gear}).id,first.id);
 assert.throws(()=>store.deploy(id,{requestId:'request_0002',recovery:true}),/only one raid/);
});
test('forged and duplicate equipment IDs are rejected before any debit',t=>{
 const {store,id}=setup(t),gear=store.profile(id).items[0].id;
 assert.throws(()=>store.deploy(id,{requestId:'request_0001',itemIds:['forged']}),/not owned/);
 assert.throws(()=>store.deploy(id,{requestId:'request_0002',itemIds:[gear,gear]}),/Invalid equipment/);
 assert.equal(store.profile(id).items.length,4);assert.equal(store.profile(id).activeDeployment,null);
});
test('death loses committed equipment and settlement retries never duplicate rewards',t=>{
 const {store,id}=setup(t),gear=store.profile(id).items.map(it=>it.id);
 const dep=store.deploy(id,{requestId:'request_0001',itemIds:gear});
 const result=store.settle(dep.id,{outcome:'death'});
 assert.equal(store.profile(id).items.length,0);
 assert.equal(store.settle(dep.id,{outcome:'extract',items:dep.equipment,credits:999}).id,result.id);
 assert.equal(store.profile(id).credits,250);
 assert.throws(()=>store.deploy(id,{requestId:'request_0002',itemIds:gear}),/not owned/);
 assert.ok(store.deploy(id,{requestId:'request_0003',recovery:true}).active);
});
test('extraction preserves item identities and grants rewards exactly once',t=>{
 const {store,id}=setup(t),gear=store.profile(id).items.slice(0,1).map(it=>it.id);
 const dep=store.deploy(id,{requestId:'request_0001',itemIds:gear});
 const result=store.settle(dep.id,{outcome:'extract',items:dep.equipment,credits:20});
 assert.equal(store.profile(id).items.filter(it=>it.id===gear[0]).length,1);
 store.settle(dep.id,{outcome:'extract',items:dep.equipment,credits:20});
 assert.equal(store.profile(id).credits,270);assert.equal(store.results(id)[0].id,result.id);
});
test('database restart retains accounts and settlement deduplication',()=>{
 const dir=mkdtempSync(join(tmpdir(),'headshotz-store-')),filename=join(dir,'test.sqlite');let store;
 try{
  store=new RaidStore(filename);const {id}=store.register('austin','a long test password');
  const dep=store.deploy(id,{requestId:'request_0001',itemIds:[store.profile(id).items[0].id]});
  const first=store.settle(dep.id,{outcome:'extract',items:dep.equipment,credits:20});store.close();
  store=new RaidStore(filename);
  assert.equal(store.settle(dep.id,{outcome:'extract',items:dep.equipment,credits:20}).id,first.id);
  assert.equal(store.profile(id).credits,270);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true})}
});
test('failed database mutation rolls back inventory and deployment together',t=>{
 const {store,id}=setup(t),gear=store.profile(id).items.map(it=>it.id);
 store.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit WHEN NEW.event='deployment_committed' BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
 assert.throws(()=>store.deploy(id,{requestId:'request_0001',itemIds:gear}),/injected failure/);
 assert.equal(store.profile(id).items.length,4);assert.equal(store.profile(id).activeDeployment,null);
});
test('startup compensation restores only escrowed equipment once',t=>{
 const {store,id}=setup(t);store.deploy(id,{requestId:'request_0001',itemIds:[store.profile(id).items[0].id]});
 assert.equal(store.recoverInterrupted(),1);assert.equal(store.recoverInterrupted(),0);
 assert.equal(store.profile(id).items.length,4);assert.equal(store.results(id)[0].outcome,'aborted');
});
test('aborted recovery deployment cannot manufacture bankable equipment',t=>{
 const {store,id}=setup(t);store.deploy(id,{requestId:'request_0001',recovery:true});
 store.recoverInterrupted();assert.equal(store.profile(id).items.length,4);assert.equal(store.results(id)[0].items.length,0);
});
test('restart compensation excludes equipment already extracted by another account',t=>{
 const {store,id}=setup(t),other=store.register('second','another long test password').id;
 const earned=earnedPurchase(store,id);const a=store.deploy(id,{requestId:'request_0001',itemIds:[earned.id]});
 const b=store.deploy(other,{requestId:'request_0002',recovery:true});
 store.settle(b.id,{outcome:'extract',items:a.equipment});
 store.recoverInterrupted();
 assert.equal(store.profile(id).items.some(it=>it.id===a.equipment[0].id),false);
 assert.equal(store.profile(other).items.filter(it=>it.id===a.equipment[0].id).length,1);
});
