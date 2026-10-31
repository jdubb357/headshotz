import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
function setup(t){const store=new RaidStore(),id=store.register('ready_operator','a long ready password').id,service=new RaidService(store,{now:()=>1000});service.party(id,{type:'create',mode:'solo',mapId:'relay',region:'local',match:{maxRttMs:0}});t.after(()=>{service.close();store.close()});const gun=store.profile(id).items.find(it=>it.kind==='weapon');return {store,service,id,gun,ready:loadout=>service.party(id,{type:'ready',ready:true,loadout})}}
test('invalid readiness is rejected before gear, money, revision or ready state changes',t=>{const f=setup(t),before=f.store.profile(f.id);for(const loadout of [{itemIds:[]},{itemIds:['forged']},{itemIds:[f.gun.id,f.gun.id]},{itemIds:[f.gun.id],insureIds:['forged']},{itemIds:[f.gun.id],recovery:true},{itemIds:[],recovery:true,insureIds:[f.gun.id]},{itemIds:[f.gun.id],recovery:'false'}])assert.throws(()=>f.ready(loadout),/Equip|owned|Invalid|Recovery|Insurance/);assert.deepEqual(f.store.profile(f.id),before);assert.equal(f.store.partyFor(f.id).members[0].ready,false);assert.equal(f.store.db.prepare('SELECT count(*) n FROM deployments').get().n,0)});
test('valid readiness quotes but does not debit insurance, equipment or inventory revision',t=>{const f=setup(t),before=f.store.profile(f.id);const party=f.ready({itemIds:[f.gun.id],insureIds:[f.gun.id]});assert.equal(party.members[0].ready,true);assert.deepEqual(f.store.profile(f.id),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM insurance').get().n,0)});
test('broken or overweight gear and unaffordable insurance cannot become ready',t=>{const f=setup(t);f.store.transaction(()=>{const s=f.store.state(f.id);s.items.find(it=>it.id===f.gun.id).condition=0;f.store.save(f.id,s)});assert.throws(()=>f.ready({itemIds:[f.gun.id]}),/Broken/);f.store.transaction(()=>{const s=f.store.state(f.id);s.items.find(it=>it.id===f.gun.id).condition=100;s.credits=0;s.grantCredits=0;f.store.save(f.id,s)});assert.throws(()=>f.ready({itemIds:[f.gun.id],insureIds:[f.gun.id]}),/insurance credits/);assert.equal(f.ready({itemIds:[],recovery:true}).members[0].ready,true);f.service.party(f.id,{type:'ready',ready:false});f.store.transaction(()=>{const s=f.store.state(f.id);s.items.push(...Array.from({length:5},()=>item('armor',{armor:'heavy'})));f.store.save(f.id,s)});assert.throws(()=>f.ready({itemIds:f.store.profile(f.id).items.filter(it=>it.kind==='armor').map(it=>it.id).concat(f.gun.id)}),/armor|weight/)});
test('readiness can always be revoked without a currently valid replacement loadout',t=>{const f=setup(t);f.ready({itemIds:[f.gun.id]});f.store.transaction(()=>{const s=f.store.state(f.id);s.items=s.items.filter(it=>it.id!==f.gun.id);f.store.save(f.id,s)});assert.equal(f.service.party(f.id,{type:'ready',ready:false,loadout:null}).members[0].ready,false);assert.equal(f.service.party(f.id,{type:'ready',ready:false,loadout:{itemIds:['forged'],recovery:'invalid'}}).members[0].ready,false)});
test('a deployed operator cannot re-enter ready state',t=>{const f=setup(t);f.ready({itemIds:[],recovery:true});f.service.deploy(f.id,{requestId:'ready_active_body',recovery:true,itemIds:[]});assert.throws(()=>f.ready({itemIds:[],recovery:true}),/only one raid|already deployed|Return/);assert.equal(f.store.partyFor(f.id).members[0].ready,false)});
test('contract delivery clears readiness but accepting or claiming rewards alone does not',t=>{const f=setup(t);f.store.transaction(()=>{const s=f.store.state(f.id);s.items.push(item('material',{material:'steel',quantity:4}));f.store.save(f.id,s)});f.ready({itemIds:[f.gun.id]});f.store.trade(f.id,{type:'contract',contract:'salvage',operation:'accept'});assert.equal(f.store.partyFor(f.id).members[0].ready,true);f.store.trade(f.id,{type:'contract',contract:'salvage',operation:'deliver'});assert.equal(f.store.partyFor(f.id).members[0].ready,false);f.ready({itemIds:[f.gun.id]});f.store.trade(f.id,{type:'contract',contract:'salvage',operation:'claim'});assert.equal(f.store.partyFor(f.id).members[0].ready,true)});
test('stale persisted ready flags are revalidated without exposing another members finances',t=>{const f=setup(t);f.ready({itemIds:[f.gun.id],insureIds:[f.gun.id]});f.store.transaction(()=>{const s=f.store.state(f.id);s.credits=0;s.grantCredits=0;f.store.save(f.id,s)});const own=f.store.partyFor(f.id).members[0];assert.equal(own.ready,false);assert.match(own.readinessError,/insurance credits/);assert.throws(()=>f.service.deploy(f.id,{requestId:'stale_ready_recheck'}),/must be ready/);assert.equal(f.store.profile(f.id).activeDeployment,null)});
test('teammates see a generic readiness problem without learning another operators balance',t=>{
 const f=setup(t),friend=f.store.register('ready_friend','a long friend password').id;
 f.service.party(f.id,{type:'leave'});const party=f.service.party(f.id,{type:'create',mode:'duo',mapId:'relay',region:'local',match:{maxRttMs:0}});
 f.service.party(friend,{type:'join',code:party.id});f.ready({itemIds:[f.gun.id],insureIds:[f.gun.id]});
 f.store.transaction(()=>{const s=f.store.state(f.id);s.credits=0;s.grantCredits=0;f.store.save(f.id,s)});
 const revision=f.store.profile(f.id).revision,other=f.store.partyFor(friend).members.find(m=>m.account===f.id);
 assert.equal(other.ready,false);assert.equal(other.readinessError,'Loadout needs review');
 assert.match(f.store.partyFor(f.id).members.find(m=>m.account===f.id).readinessError,/insurance credits/);
 assert.equal(f.store.profile(f.id).revision,revision);assert.equal(f.store.db.prepare('SELECT ready FROM party_members WHERE account=?').get(f.id).ready,1,'read-only presentation must not mutate persisted readiness');
});
test('returning insured gear invalidates an otherwise valid recovery readiness exactly once',t=>{
 const f=setup(t),deployment=f.store.deploy(f.id,{requestId:'ready_insurance_return',itemIds:[f.gun.id],insureIds:[f.gun.id]});
 f.store.settle(deployment.id,{outcome:'death'});f.store.db.prepare("UPDATE inventory SET location='lost' WHERE id=?").run(f.gun.id);
 f.ready({recovery:true,itemIds:[]});assert.equal(f.store.partyFor(f.id).members[0].ready,true);
 assert.equal(f.store.processInsurance(Date.now()+200000),1);assert.equal(f.store.partyFor(f.id).members[0].ready,false);
 f.ready({recovery:true,itemIds:[]});assert.equal(f.store.processInsurance(Date.now()+200000),0);assert.equal(f.store.partyFor(f.id).members[0].ready,true);
});
test('overweight stacks and protected overflow block readiness including free recovery',t=>{
 const f=setup(t);f.store.transaction(()=>{const s=f.store.state(f.id),mods=()=>['scope','suppressor','magazine'].map(mod=>item('mod',{mod}));s.items.find(it=>it.id===f.gun.id).attachments=mods();s.items.push(item('weapon',{weapon:'ar',attachments:mods()}),item('armor',{armor:'heavy'}),...Array.from({length:5},()=>item('material',{material:'steel',quantity:20})));f.store.save(f.id,s)});
 assert.throws(()=>f.ready({itemIds:f.store.profile(f.id).items.filter(it=>it.kind==='weapon'||it.kind==='material'||it.armor==='heavy').map(it=>it.id)}),/weight limit/);
 const valuable=item('valuable',{value:10});f.store.db.prepare("INSERT INTO inventory(id,account,location,payload) VALUES(?,?,'overflow',?)").run(valuable.id,f.id,JSON.stringify(valuable));
 assert.throws(()=>f.ready({itemIds:[],recovery:true}),/protected overflow/);
});
test('ready requires a boolean and revoke preserves the last validated loadout even during a raid',t=>{
 const f=setup(t),loadout={itemIds:[],recovery:true,insureIds:[]};f.ready(loadout);
 for(const ready of [1,'true',null])assert.throws(()=>f.service.party(f.id,{type:'ready',ready,loadout}),/Invalid ready state/);
 f.service.deploy(f.id,{requestId:'ready_revoke_active'});
 const party=f.service.party(f.id,{type:'ready',ready:false,loadout:{itemIds:['invalid']}});
 assert.equal(party.members[0].ready,false);assert.deepEqual(party.members[0].loadout,loadout);
});
