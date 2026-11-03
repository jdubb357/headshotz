import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
function setup(t){const store=new RaidStore();let now=1000;const service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});const a=store.register('leader','a long leader password').id,b=store.register('friend','a long friend password').id;return {store,service,a,b,advance:n=>{now+=n;service.tick(.05)}}}
function readyPair({store,service,a,b},loadoutB={itemIds:[],recovery:true}){
 const party=service.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});
 service.party(b,{type:'join',code:party.id});
 service.party(a,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true}});
 service.party(b,{type:'ready',ready:true,loadout:loadoutB});return party;
}
test('a new deployment cannot respawn an eliminated player into their previous raid',t=>{
 const {store,service,a,b}=setup(t);service.deploy(a,{requestId:'no_respawn_first',mapId:'relay',recovery:true});service.deploy(b,{requestId:'no_respawn_survivor',mapId:'relay',recovery:true});const prior=service.byAccount.get(a),raid=service.raids.get(prior.raidId);service.atomic(()=>service.end(raid,prior,'death'));
 const next=service.deploy(a,{requestId:'no_respawn_new',mapId:'relay',recovery:true});assert.notEqual(next.raidId,raid.id);assert.equal(raid.players.get(a).alive,false);assert.equal(service.byAccount.get(b).alive,true);assert.equal(store.results(a).length,1);
});
test('party matching excludes a previous raid of any member, including a new leaders eliminated invitee',t=>{
 const {store,service,a,b}=setup(t),c=store.register('new_squad_leader','a long new leader password').id;service.deploy(a,{requestId:'invitee_first_raid',mapId:'relay',recovery:true});service.deploy(b,{requestId:'invitee_old_survivor',mapId:'relay',recovery:true});const prior=service.byAccount.get(a),raid=service.raids.get(prior.raidId);service.atomic(()=>service.end(raid,prior,'death'));
 const party=service.party(c,{type:'create',mode:'duo',region:'local',mapId:'relay'});service.party(a,{type:'join',code:party.id});for(const id of [a,c])service.party(id,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true}});const next=service.deploy(c,{requestId:'invitee_new_squad',mapId:'relay',recovery:true});assert.notEqual(next.raidId,raid.id);assert.equal(service.byAccount.get(a).raidId,next.raidId);assert.equal(raid.players.get(a).alive,false);assert.equal(service.byAccount.get(b).raidId,raid.id);
});
test('ready party enters the same raid and team, with idempotent deployment',t=>{
 const s=setup(t),{service,a,b}=s;readyPair(s);
 service.deploy(a,{requestId:'party_deploy_0001'});
 const first=service.snapshot(a),second=service.snapshot(b);
 assert.equal(first.raidId,second.raidId);assert.equal(first.self.team,second.self.team);
 assert.equal(service.deploy(a,{requestId:'party_deploy_0001'}).raidId,first.raidId);
});
test('unready members and nonleaders cannot deploy a party',t=>{
 const s=setup(t),{service,a,b}=s;const party=service.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});service.party(b,{type:'join',code:party.id});
 assert.throws(()=>service.deploy(a,{requestId:'party_deploy_0001'}),/must be ready/);
 assert.throws(()=>service.deploy(b,{requestId:'party_deploy_0001'}),/leader/);
});
test('invalid teammate loadout rolls back the whole group deployment',t=>{
 const s=setup(t),{store,service,a,b}=s;readyPair(s);
 const gun=store.profile(a).items.find(it=>it.kind==='weapon');service.party(a,{type:'ready',ready:true,loadout:{itemIds:[gun.id],insureIds:[gun.id]}});
 const before=store.profile(a),original=store.deploy.bind(store);let leaderCommitted=false;
 store.deploy=(account,request)=>{if(account===b){assert.equal(leaderCommitted,true);assert.ok(store.profile(a).credits<before.credits);return original(account,{...request,itemIds:['forged'],recovery:false})}const result=original(account,request);leaderCommitted=true;return result};
 assert.throws(()=>service.deploy(a,{requestId:'party_deploy_0001'}),/not owned/);
 assert.equal(store.profile(a).activeDeployment,null);assert.equal(store.profile(b).activeDeployment,null);
 assert.deepEqual(store.profile(a),before);assert.equal(store.db.prepare('SELECT count(*) n FROM insurance').get().n,0);assert.equal(store.db.prepare('SELECT count(*) n FROM deployments').get().n,0);assert.equal(service.byAccount.size,0);assert.equal(service.raids.size,0);store.deploy=original;
});
test('inventory mutations invalidate a party ready check',t=>{
 const s=setup(t),{store,service,a}=s;readyPair(s);assert.equal(store.partyFor(a).members.find(m=>m.account===a).ready,true);
 store.trade(a,{type:'buy',trader:'medic',sku:'med'});
 assert.equal(store.partyFor(a).members.find(m=>m.account===a).ready,false);
 assert.throws(()=>service.deploy(a,{requestId:'party_deploy_0001'}),/must be ready/);
});
test('clients cannot choose another player team or force an arbitrary raid',t=>{
 const {service,a,b}=setup(t);
 service.deploy(a,{requestId:'party_deploy_0001',mapId:'relay',recovery:true});
 service.deploy(b,{requestId:'party_deploy_0002',mapId:'relay',recovery:true,team:a,leaderRaid:'forged'});
 assert.notEqual(service.snapshot(a).self.team,service.snapshot(b).self.team);
});
test('squadmate can revive a downed operator after five uninterrupted seconds',t=>{
 const s=setup(t),{service,a,b,advance}=s;readyPair(s);service.deploy(a,{requestId:'party_deploy_0001'});
 const p=service.byAccount.get(a),q=service.byAccount.get(b),r=service.raids.get(p.raidId);r.machines=[];advance(6);q.x=p.x;q.z=p.z;
 service.atomic(()=>service.damage(r,q,200));assert.equal(q.downed,true);assert.equal(q.alive,true);
 service.action(a,{type:'revive',targetId:b,seq:1});advance(5.1);
 assert.equal(q.downed,false);assert.equal(q.hp,30);assert.equal(q.bleedUntil,0);
});
test('damage interrupts revival and expired bleed timer causes final death',t=>{
 const s=setup(t),{service,a,b,advance}=s;readyPair(s);service.deploy(a,{requestId:'party_deploy_0001'});
 const p=service.byAccount.get(a),q=service.byAccount.get(b),r=service.raids.get(p.raidId);r.machines=[];advance(6);q.x=p.x;q.z=p.z;
 service.atomic(()=>service.damage(r,q,200));service.action(a,{type:'revive',targetId:b,seq:1});advance(1);
 service.atomic(()=>service.damage(r,p,5));advance(5);
 assert.equal(q.downed,true);advance(20);
 assert.equal(q.result.outcome,'death');
});
test('carrier and downed squadmate receive distinct extraction settlements',t=>{
 const s=setup(t),{store,service,a,b,advance}=s;readyPair(s);service.deploy(a,{requestId:'party_deploy_0001'});
 const p=service.byAccount.get(a),q=service.byAccount.get(b),r=service.raids.get(p.raidId),exit=r.exits[0];r.machines=[];
 advance(6);p.x=q.x=exit.x;p.z=q.z=exit.z;exit.openAt=999;exit.closeAt=1100;
 service.atomic(()=>service.damage(r,q,200));service.action(a,{type:'carry',targetId:b,seq:1});service.action(a,{type:'extract',exitId:exit.id,seq:2});advance(3);
 assert.equal(p.result.outcome,'extract');assert.equal(q.result.outcome,'extract');assert.notEqual(p.result.id,q.result.id);
 assert.equal(store.profile(a).activeDeployment,null);assert.equal(store.profile(b).activeDeployment,null);
});
test('party capacity, active-party mutations and unavailable regions are rejected',t=>{
 const s=setup(t),{store,service,a,b}=s;const party=readyPair(s);
 const c=store.register('third','a long third password').id;assert.throws(()=>service.party(c,{type:'join',code:party.id}),/full/);
 assert.throws(()=>service.party(c,{type:'create',mode:'solo',region:'eu',mapId:'relay'}),/preferred region/);
 service.deploy(a,{requestId:'party_deploy_0001'});assert.throws(()=>service.party(b,{type:'leave'}),/Return from/);
});
