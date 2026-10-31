import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
function setup(t,age=61){
 const store=new RaidStore();let time=1000;const service=new RaidService(store,{now:()=>time}),id=store.register('idle_world_owner','a long idle world password').id;
 service.deploy(id,{requestId:'idle_world_first',mapId:'relay',recovery:true});const prior=service.byAccount.get(id),old=service.raids.get(prior.raidId);old.machines=[];service.atomic(()=>service.end(old,prior,'death'));
 time=1000+age;service.deploy(id,{requestId:'idle_world_second',mapId:'reservoir',recovery:true});const current=service.byAccount.get(id),live=service.raids.get(current.raidId);live.machines=[];t.after(()=>{service.close();store.close()});
 return {store,service,id,old,live,current,time:value=>time=value,checkpoint:id=>store.db.prepare('SELECT payload FROM raid_checkpoints WHERE id=?').get(id)?.payload};
}
test('settled unjoinable worlds retain their checkpoint/loot without simulation or checkpoint churn',t=>{
 const f=setup(t),before=structuredClone(f.service.serialize(f.old.id)),payload=f.checkpoint(f.old.id),written=[],checkpoint=f.store.checkpoint;f.store.checkpoint=function(raid){written.push(raid.id);return checkpoint.call(this,raid)};
 for(let i=0;i<10;i++)f.service.tick(.05);
 assert.deepEqual(f.service.serialize(f.old.id),before);assert.equal(f.checkpoint(f.old.id),payload);assert.deepEqual(new Set(written),new Set([f.live.id]));assert.equal(written.length,10);assert.equal(f.service.snapshot(f.id).self.deploymentId,f.current.deploymentId);
});
test('a settled world inside its admission window still advances and accepts another player',t=>{
 const f=setup(t,30),written=[],checkpoint=f.store.checkpoint;f.store.checkpoint=function(raid){written.push(raid.id);return checkpoint.call(this,raid)};f.service.tick(.05);assert.ok(written.includes(f.old.id));
 const other=f.store.register('late_idle_world_join','a long late world password').id,state=f.service.deploy(other,{requestId:'idle_world_late_join',mapId:'relay',recovery:true});assert.equal(state.raidId,f.old.id);assert.equal(f.service.snapshot(f.id).self.deploymentId,f.current.deploymentId);
});
test('scoped tick failure rolls back active worlds while leaving settled worlds and latest identity intact',t=>{
 const f=setup(t),before=structuredClone(f.service.serialize()),rows=f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),checkpoint=f.store.checkpoint;
 f.store.checkpoint=function(raid){checkpoint.call(this,raid);throw new Error('idle scoped checkpoint failure')};assert.throws(()=>f.service.tick(.05),/scoped checkpoint failure/);f.store.checkpoint=checkpoint;
 assert.deepEqual(f.service.serialize(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),rows);assert.equal(f.service.snapshot(f.id).self.deploymentId,f.current.deploymentId);
});
test('tick admission/cleanup selection and advance share one time sample across a deadline boundary',t=>{
 const f=setup(t),boundary=f.old.deadline+120,before=f.checkpoint(f.old.id),checkpoint=f.store.checkpoint;let reads=0;f.service.now=()=>reads++===0?boundary:boundary+1;
 f.store.checkpoint=function(raid){checkpoint.call(this,raid);throw new Error('boundary checkpoint failure')};assert.throws(()=>f.service.tick(.05),/boundary checkpoint failure/);f.store.checkpoint=checkpoint;
 assert.ok(f.service.raids.has(f.old.id),'an unselected world cannot disappear during rollback');assert.equal(f.checkpoint(f.old.id),before);assert.equal(f.service.byAccount.get(f.id).alive,true);assert.equal(f.service.byAccount.get(f.id).deploymentId,f.current.deploymentId);
 f.service.now=()=>boundary+1;f.service.tick(.05);assert.equal(f.service.raids.has(f.old.id),false,'normal expiry cleanup still retires settled worlds');assert.equal(f.checkpoint(f.old.id),undefined);
});
test('a pending settlement is selected even when all bodies are down and admission is closed',t=>{
 const f=setup(t),p=f.service.byAccount.get(f.id),r=f.live,flush=f.service.flush;f.service.flush=()=>{};f.service.atomic(()=>f.service.end(r,p,'death'));assert.ok(p.pending);f.time(r.started+61);const written=[],checkpoint=f.store.checkpoint;f.store.checkpoint=function(raid){written.push(raid.id);return checkpoint.call(this,raid)};f.service.tick(.05);assert.ok(written.includes(r.id));assert.ok(f.service.byAccount.get(f.id).pending);f.service.flush=flush;f.service.tick(.05);assert.equal(f.service.byAccount.get(f.id).pending,null);assert.ok(f.service.byAccount.get(f.id).result);
});
test('failed expiry cleanup restores deleted worlds, map ordering and canonical ownership together',t=>{
 const f=setup(t),before=structuredClone(f.service.serialize()),rows=f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),checkpoint=f.store.checkpoint;f.time(f.old.deadline+121);
 f.store.checkpoint=function(raid){checkpoint.call(this,raid);throw new Error('cleanup checkpoint failure')};assert.throws(()=>f.service.tick(.05),/cleanup checkpoint failure/);f.store.checkpoint=checkpoint;
 assert.deepEqual(f.service.serialize(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),rows);assert.equal(f.service.snapshot(f.id).self.deploymentId,f.current.deploymentId);
});
test('a later checkpoint failure rolls back both selected active worlds without touching a paused world',t=>{
 const f=setup(t),other=f.store.register('other_active_world','a long other active password').id;f.service.deploy(other,{requestId:'other_active_deployment',mapId:'switchyard',recovery:true});
 const p=f.service.byAccount.get(f.id),q=f.service.byAccount.get(other),second=f.service.raids.get(q.raidId);second.machines=[];
 for(const [r,player]of [[f.live,p],[second,q]]){r.world={...r.world,blocks:[],ramps:[],hazards:[]};Object.assign(player,{x:0,y:0,z:0,move:{x:.5,z:0},lastMoveAt:1061})}
 const before=structuredClone(f.service.serialize()),oldCheckpoint=f.checkpoint(f.old.id),rows=f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),checkpoint=f.store.checkpoint,written=[];
 f.store.checkpoint=function(raid){written.push(raid.id);checkpoint.call(this,raid);if(raid.id===second.id)throw new Error('second selected world failed')};assert.throws(()=>f.service.tick(.05),/second selected world failed/);f.store.checkpoint=checkpoint;
 assert.deepEqual(written,[f.live.id,second.id]);assert.deepEqual(f.service.serialize(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM inventory ORDER BY id').all(),rows);assert.equal(f.checkpoint(f.old.id),oldCheckpoint);assert.equal(f.service.byAccount.get(f.id).deploymentId,p.deploymentId);assert.equal(f.service.byAccount.get(other).deploymentId,q.deploymentId);
});
