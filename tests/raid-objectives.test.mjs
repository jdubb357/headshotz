import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {RAID_WORLDS,floorAt} from '../shared/raid-worlds.mjs';
import {objectivesFor,objectiveFor,createObjectiveState,advanceObjectiveState,settleObjectiveState} from '../shared/raid-objectives.mjs';
import {objectiveText} from '../shared/raid-report.mjs';

const relay=worldId=>RAID_WORLDS.find(w=>w.id===worldId);

function context(t){
 const store=new RaidStore();let now=1000;
 const service=new RaidService(store,{now:()=>now});
 t.after(()=>{service.close();store.close()});
 const account=label=>store.register(label+'_'+randomUUID().slice(0,8),'a long objective audit password').id;
 const deploy=(id,request={})=>service.deploy(id,{requestId:'obj_'+id+'_'+Math.random().toString(36).slice(2,10),mapId:'relay',recovery:true,...request});
 return {store,service,account,deploy,now:()=>now,time:value=>now=value};
}

test('the shared catalog derives one wire-safe objective per authored sector landmark',()=>{
 for(const world of RAID_WORLDS){
  const objectives=objectivesFor(world);
  assert.equal(objectives.length,(world.landmarks||[]).length,world.id+' exposes one objective per landmark');
  assert.equal(new Set(objectives.map(o=>o.id)).size,objectives.length,'objective ids are unique in '+world.id);
  for(const objective of objectives){
   assert.match(objective.id,/^[a-z0-9-]{1,80}$/,'objective ids are wire-safe');
   assert.equal(objective.map,world.id,'objective map id matches the sector');
   assert.ok((world.landmarks||[]).some(site=>site.name===objective.site),'objective points at an authored site');
   assert.ok(objective.holdSeconds>=12&&objective.holdSeconds<=16,'hold durations stay in the authored range');
   assert.ok(objective.rewardCredits>0&&objective.rewardXp>0,'objective rewards are positive');
   assert.ok(objective.radius>0,'the capture radius is positive');
  }
  assert.equal(objectiveFor(world,objectives[0].id).id,objectives[0].id,'lookup returns the catalog entry');
  assert.equal(objectiveFor(world,'nope'),null,'lookup rejects unknown ids');
 }
});

test('deployments opt into an objective or remain objective-free',t=>{
 const f=context(t),definition=objectivesFor(relay('relay'))[0];
 const plainId=f.account('plain'),plain=f.deploy(plainId,{});
 assert.equal(plain.objective,null,'a deployment without an objective is unchanged');
 assert.equal(plain.self.alive,true,'the objective-free deployment is playable');
 const activeId=f.account('active'),active=f.deploy(activeId,{objective:definition.id});
 assert.equal(active.objective.id,definition.id);
 assert.equal(active.objective.stage,'approach');
 assert.equal(active.objective.progress,0);
 assert.equal(active.objective.hold,0);
 assert.ok(active.objective.x===definition.x&&active.objective.z===definition.z,'snapshot carries marker coordinates');
 assert.equal(active.objective.holdSeconds,definition.holdSeconds);
 assert.equal(active.objective.holdLeft,definition.holdSeconds,'the snapshot shows the remaining hold');
});

test('objective deployment rejects unsafe and unknown ids without starting a raid',t=>{
 const f=context(t),id=f.account('bad');
 for(const bad of ['Bad Id','_leading','trailing!','x'.repeat(81)]){
  assert.throws(()=>f.deploy(id,{objective:bad}),/Invalid field objective/,'unsafe objective id is rejected');
 }
 assert.throws(()=>f.deploy(id,{objective:'relay-field-missing'}),/Unknown field objective/);
 assert.equal(f.service.byAccount.get(id),undefined,'rejected requests create no deployment');
 assert.ok(!f.store.profile(id).activeDeployment,'rejected requests leave no active deployment');
});

test('progression pauses while downed or outside and secures after the authored hold',()=>{
 const definition=objectivesFor(relay('relay'))[0];
 const o=createObjectiveState(definition);
 assert.equal(advanceObjectiveState(o,{now:1,dt:.1,inside:false}),null,'approach does not advance outside');
 assert.equal(advanceObjectiveState(o,{now:2,dt:.1,inside:true}),'reached');
 assert.equal(o.stage,'secure');
 assert.equal(advanceObjectiveState(o,{now:2.1,dt:.1,inside:true}),null);
 assert.equal(o.hold,.1,'the first inside tick advances the hold');
 const paused=o.hold;
 assert.equal(advanceObjectiveState(o,{now:2.2,dt:.1,inside:true,downed:true}),null,'a downed operator does not advance');
 assert.equal(advanceObjectiveState(o,{now:2.3,dt:.1,inside:false}),null,'leaving the site pauses progression');
 assert.equal(o.hold,paused,'pausing preserves accumulated hold');
 assert.equal(advanceObjectiveState(o,{now:2.4,dt:0,inside:true}),null,'zero-duration ticks do not count');
 for(let i=0;i<130&&o.stage!=='secured';i++)advanceObjectiveState(o,{now:3+i*.1,dt:.1,inside:true});
 assert.equal(o.stage,'secured');
 assert.equal(o.progress,1);
 assert.equal(advanceObjectiveState(o,{now:20,dt:.1,inside:true}),null,'secured is terminal');
});

test('settlement summaries fail without awarding a bonus',()=>{
 const definition=objectivesFor(relay('relay'))[0];
 const skipped=createObjectiveState(definition);skipped.stage='secure';skipped.hold=2;skipped.progress=2/definition.holdSeconds;
 const failed=settleObjectiveState(skipped,'extract','extracted');
 assert.equal(failed.completed,false);
 assert.equal(failed.failedReason,'extracted_before_securing');
 assert.equal(failed.outcome,'failed');
 assert.match(objectiveText({facts:{objective:failed}}),/No bonus was awarded/);
 const secured=createObjectiveState(definition);secured.stage='secured';secured.progress=1;
 const completed=settleObjectiveState(secured,'extract','extracted');
 assert.equal(completed.completed,true);
 assert.equal(completed.rewardCredits,definition.rewardCredits);
 assert.equal(settleObjectiveState(createObjectiveState(definition),'death','machine').failedReason,'machine');
});

test('the authoritative tick secures, announces, and snapshots the objective',t=>{
 const f=context(t),world=relay('relay'),definition=objectivesFor(world)[0];
 const id=f.account('tick');f.deploy(id,{objective:definition.id});
 const p=f.service.byAccount.get(id),r=f.service.raids.get(p.raidId);
 p.protectedUntil=0;r.machines=[];r.rivals=[];
 Object.assign(p,{x:definition.x,z:definition.z,y:floorAt(r.world,definition.x,definition.z)||0,move:{x:0,z:0},lastInput:f.now()});
 let reached=false;
 for(let i=0;i<140;i++){
  f.time(f.now()+.1);p.lastInput=f.now();f.service.advance(.1,f.now());
  if(p.objective.stage==='secure')reached=true;
  if(p.objective.stage==='secured')break;
 }
 assert.equal(reached,true,'the marker reached stage is entered');
 assert.equal(p.objective.stage,'secured','the authored hold completes');
 assert.equal(p.objective.progress,1);
 const snapshot=f.service.snapshot(id);
 assert.equal(snapshot.objective.stage,'secured');
 assert.equal(snapshot.objective.progress,1);
 assert.equal(snapshot.objective.hold,snapshot.objective.holdSeconds);
 assert.equal(snapshot.objective.holdLeft,0,'the secured snapshot has no hold remaining');
 assert.equal(snapshot.objective.x,definition.x);
 assert.equal(snapshot.objective.z,definition.z);
 assert.ok(r.events.some(e=>e.kind==='objective'&&/secured/i.test(e.text)),'a secure announcement is recorded');
});

test('extraction after securing pays catalog credits and XP in settlement',t=>{
 const f=context(t),world=relay('relay'),definition=objectivesFor(world)[0];
 const id=f.account('reward');f.deploy(id,{objective:definition.id});
 const p=f.service.byAccount.get(id),r=f.service.raids.get(p.raidId);
 p.protectedUntil=0;r.machines=[];r.rivals=[];
 Object.assign(p,{x:definition.x,z:definition.z,y:floorAt(world,definition.x,definition.z)||0,move:{x:0,z:0},lastInput:f.now()});
 for(let i=0;i<140&&p.objective.stage!=='secured';i++){f.time(f.now()+.1);p.lastInput=f.now();f.service.advance(.1,f.now())}
 assert.equal(p.objective.stage,'secured','the objective is secured before extraction');
 f.service.end(r,p,'extract');
 assert.equal(p.result.outcome,'extract');
 assert.equal(p.result.credits,20+definition.rewardCredits,'the bonus is paid with extraction credits');
 assert.equal(p.result.xp,20+definition.rewardXp,'the objective XP is awarded at settlement');
 assert.equal(p.result.facts.objective.completed,true);
 assert.match(objectiveText(p.result),/Field objective secured/);
 assert.match(objectiveText(p.result),new RegExp('\\+'+definition.rewardCredits+' credits'));
});

test('an objective skipped before extraction settles as failed with no bonus',t=>{
 const f=context(t),definition=objectivesFor(relay('relay'))[0];
 const id=f.account('skip');f.deploy(id,{objective:definition.id});
 const p=f.service.byAccount.get(id),r=f.service.raids.get(p.raidId);
 p.protectedUntil=0;r.machines=[];r.rivals=[];
 f.service.end(r,p,'extract');
 assert.equal(p.result.credits,20,'base extraction credits only');
 assert.equal(p.result.facts.objective.completed,false);
 assert.equal(p.result.facts.objective.failedReason,'extracted_before_securing');
 assert.match(objectiveText(p.result),/No bonus was awarded/);
});

test('a death before extraction fails the objective with the raid reason',t=>{
 const f=context(t),definition=objectivesFor(relay('relay'))[0];
 const id=f.account('death');f.deploy(id,{objective:definition.id});
 const p=f.service.byAccount.get(id),r=f.service.raids.get(p.raidId);
 p.protectedUntil=0;r.machines=[];r.rivals=[];
 f.service.end(r,p,'death','machine');
 assert.equal(p.result.credits,0,'no extraction reward on death');
 assert.equal(p.result.facts.objective.completed,false);
 assert.equal(p.result.facts.objective.failedReason,'machine');
 assert.match(objectiveText(p.result),/eliminated by a machine/);
});

test('timeout and disconnect settle the objective with explicit reasons',t=>{
 for(const [outcome,reason] of [['timeout','raid_expired'],['disconnect','connection_expired']]){const f=context(t),definition=objectivesFor(relay('relay'))[0];
  const id=f.account(outcome);f.deploy(id,{objective:definition.id});
  const p=f.service.byAccount.get(id),r=f.service.raids.get(p.raidId);
  p.protectedUntil=0;r.machines=[];r.rivals=[];
  f.service.end(r,p,outcome);
  assert.equal(p.result.credits,0,'no bonus on '+outcome);
  assert.equal(p.result.facts.objective.completed,false);
  assert.equal(p.result.facts.objective.failedReason,reason,'the objective carries the '+outcome+' reason');
  assert.match(objectiveText(p.result),/No bonus was awarded/);
 }
});
