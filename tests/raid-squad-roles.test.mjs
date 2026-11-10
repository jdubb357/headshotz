import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {SQUAD_ROLES,SQUAD_ROLE_IDS,squadRole,roleLabel,pingSecondsFor,reviveSecondsFor,engineerPicks} from '../shared/raid-roles.mjs';

function setup(t){
 const store=new RaidStore();let now=1000;const service=new RaidService(store,{now:()=>now});
 t.after(()=>{service.close();store.close()});
 const a=store.register('leader','a long leader password').id,b=store.register('friend','a long friend password').id;
 return {store,service,a,b,now:()=>now,advance:n=>{now+=n;service.tick(.05)}};
}
function readyPair(s,roleA=null,roleB=null){
 const {service,a,b}=s;const party=service.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});
 service.party(b,{type:'join',code:party.id});
 service.party(a,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true,...(roleA?{role:roleA}:{})}});
 service.party(b,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true,...(roleB?{role:roleB}:{})}});
 return party;
}

test('role catalog exposes the three opt-in roles with summaries',()=>{
 assert.deepEqual(SQUAD_ROLE_IDS,['scout','medic','engineer']);
 for(const id of SQUAD_ROLE_IDS){assert.equal(squadRole(id),id);assert.ok(roleLabel(id));assert.ok(SQUAD_ROLES[id].summary)}
 assert.equal(squadRole('sniper'),null);assert.equal(squadRole(42),null);assert.equal(squadRole(undefined),null);
 assert.equal(pingSecondsFor('scout'),30);assert.equal(pingSecondsFor('medic'),20);assert.equal(pingSecondsFor(null),20);
 assert.equal(reviveSecondsFor('medic'),3.5);assert.equal(reviveSecondsFor('scout'),5);assert.equal(reviveSecondsFor(undefined),5);
 assert.equal(engineerPicks('engineer'),true);assert.equal(engineerPicks('medic'),false);assert.equal(engineerPicks(null),false);
});

test('party readiness validates and persists a squad role in the member loadout',t=>{
 const s=setup(t),{store,service,a,b}=s;const party=service.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});service.party(b,{type:'join',code:party.id});
 assert.throws(()=>service.party(a,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true,role:'sniper'}}),/Unknown squad role/);
 assert.throws(()=>service.party(a,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true,role:42}}),/Unknown squad role/);
 service.party(a,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true,role:'scout'}});
 const member=store.partyFor(a).members.find(m=>m.account===a);
 assert.equal(member.ready,true);assert.equal(member.loadout.role,'scout');
 const stored=JSON.parse(store.db.prepare('SELECT loadout FROM party_members WHERE account=?').get(a).loadout);
 assert.equal(stored.role,'scout');
});

test('deployed operators carry only their own persisted role into snapshots',t=>{
 const s=setup(t),{service,a,b}=s;readyPair(s,'scout','medic');
 const snap=service.deploy(a,{requestId:'roles_deploy_0001'});
 assert.equal(snap.self.role,'scout');
 assert.equal(service.snapshot(a).squad.find(q=>q.id===a).role,'scout');
 assert.equal(service.snapshot(a).squad.find(q=>q.id===b).role,'medic');
 assert.equal(service.snapshot(b).self.role,'medic');
});

test('solo deployments never receive a client role and reject invalid ones server-side',t=>{
 const s=setup(t),{store,service}=s,c=store.register('solo','a long solo password').id;
 const snap=service.deploy(c,{requestId:'roles_solo_0001',mapId:'relay',recovery:true,role:'scout'});
 assert.equal(snap.self.role,null);
 assert.throws(()=>service.deployPlayer(store.register('bad','a long bad password').id,{requestId:'roles_bad_0001',mapId:'relay',recovery:true,role:'sniper'}),/Unknown squad role/);
});

test('scout pings last 30 seconds while base pings last 20',t=>{
 const s=setup(t),{service,a,b}=s;readyPair(s,'scout','medic');service.deploy(a,{requestId:'roles_ping_0001'});
 const p=service.byAccount.get(a),q=service.byAccount.get(b),r=service.raids.get(p.raidId);r.machines=[];
 const t0=s.now();service.action(a,{type:'ping',kind:'rally',seq:1});service.action(b,{type:'ping',kind:'rally',seq:1});
 const scoutPing=r.pings.find(x=>x.owner===a),basePing=r.pings.find(x=>x.owner===b);
 assert.equal(scoutPing.until-t0,30);assert.equal(basePing.until-t0,20);
 assert.equal(service.snapshot(a).pings.length,2);
 s.advance(21);
 assert.deepEqual(service.snapshot(a).pings.map(x=>x.owner),[a]);
 s.advance(10);
 assert.equal(service.snapshot(a).pings.length,0);
});

test('medic revive completes at 3.5 seconds instead of the base 5',t=>{
 const s=setup(t),{service,a,b,advance}=s;readyPair(s,'medic','scout');service.deploy(a,{requestId:'roles_revive_0001'});
 const p=service.byAccount.get(a),q=service.byAccount.get(b),r=service.raids.get(p.raidId);r.machines=[];advance(6);q.x=p.x;q.z=p.z;
 service.atomic(()=>service.damage(r,q,200));assert.equal(q.downed,true);
 service.action(a,{type:'revive',targetId:b,seq:1});
 advance(3.4);assert.equal(q.downed,true);
 advance(.2);assert.equal(q.downed,false);assert.equal(q.hp,30);assert.equal(p.reviving,null);
});

test('roleless operators still cannot unlock a locked door without a key',t=>{
 const s=setup(t),{service,a,b,advance}=s;readyPair(s,null,'scout');service.deploy(a,{requestId:'roles_door_0001'});
 const p=service.byAccount.get(a),r=service.raids.get(p.raidId);r.machines=[];advance(6);
 const door=r.world.doors.find(d=>d.locked);assert.ok(door);
 p.x=door.x;p.z=door.z;
 assert.throws(()=>service.action(a,{type:'door',doorId:door.id,seq:1}),/A key is required to unlock this door/);
 assert.equal(door.locked,true);
});

test('engineer picks a locked door without spending a key and raises noise',t=>{
 const s=setup(t),{service,a,b,advance}=s;readyPair(s,'engineer','medic');service.deploy(a,{requestId:'roles_pick_0001'});
 const p=service.byAccount.get(a),r=service.raids.get(p.raidId);r.machines=[];advance(6);
 const door=r.world.doors.find(d=>d.locked);assert.ok(door);
 p.x=door.x;p.z=door.z;const keysBefore=p.equipment.filter(it=>it.kind==='key').length+p.pack.filter(it=>it.kind==='key').length;
 assert.equal(keysBefore,0);
 service.action(a,{type:'door',doorId:door.id,seq:1});
 assert.equal(door.locked,false);assert.equal(door.closed,false);assert.equal(p.facts.doorsPicked,1);
 assert.equal(p.facts.keysUsed||0,0);
 assert.equal(p.equipment.filter(it=>it.kind==='key').length+p.pack.filter(it=>it.kind==='key').length,0);
 assert.ok(r.events.some(e=>e.kind==='door'&&/pick/i.test(e.text||'')));
 assert.ok((r.noises||[]).some(n=>Math.hypot(n.x-door.x,n.z-door.z)<.01));
});
