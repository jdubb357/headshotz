import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {createRaidServer} from '../server/main.mjs';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
function setup(t,limit){const store=new RaidStore();let service=new RaidService(store,{now:()=>1000,maxOperators:limit}),serial=0;const account=()=>store.register('capacity_'+serial++,'a long capacity test password').id;const deploy=(id,mapId='relay',requestId='capacity_deploy_'+serial++)=>service.deploy(id,{mapId,requestId,recovery:true});t.after(()=>{service.close();store.close()});return {store,get service(){return service},account,deploy,restart:limit=>{service.close();service=new RaidService(store,{now:()=>1000,maxOperators:limit})}}}
test('global capacity covers every map and denies before equipment or premiums are debited',t=>{
 const f=setup(t,1),a=f.account(),b=f.account();f.deploy(a);const gun=f.store.profile(b).items.find(i=>i.kind==='weapon'),before=f.store.profile(b),count=f.store.db.prepare('SELECT count(*) n FROM deployments').get().n;
 assert.throws(()=>f.service.deploy(b,{requestId:'capacity_paid_rejected',mapId:'switchyard',itemIds:[gun.id],insureIds:[gun.id]}),e=>e.status===503&&/server is full/.test(e.message));
 assert.deepEqual(f.store.profile(b),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM deployments').get().n,count);assert.equal(f.store.profile(b).insurance.length,0);assert.deepEqual(f.service.capacity(),{limit:1,used:1,available:0,overCapacity:false});
});
test('whole squad capacity is checked before even the first store deployment',t=>{
 const f=setup(t,3),solo=f.account();f.deploy(solo);const members=[f.account(),f.account(),f.account()],party=f.service.party(members[0],{type:'create',mode:'trio',region:'local',mapId:'relay'});
 for(const id of members.slice(1))f.service.party(id,{type:'join',code:party.id});
 for(const id of members){const gun=f.store.profile(id).items.find(i=>i.kind==='weapon');f.service.party(id,{type:'ready',ready:true,loadout:{itemIds:[gun.id],insureIds:[gun.id]}})}
 const before=members.map(id=>f.store.profile(id)),deploy=f.store.deploy;let calls=0;f.store.deploy=function(...args){calls++;return deploy.apply(this,args)};
 assert.throws(()=>f.service.deploy(members[0],{requestId:'capacity_trio_rejected'}),e=>e.status===503);assert.equal(calls,0);assert.deepEqual(members.map(id=>f.store.profile(id)),before);assert.ok(f.store.partyFor(members[0]).members.every(m=>m.ready));
 f.store.deploy=deploy;const p=f.service.byAccount.get(solo);f.service.atomic(()=>f.service.end(f.service.raids.get(p.raidId),p,'death'));
 const squad=f.service.deploy(members[0],{requestId:'capacity_trio_admitted'});assert.equal(f.service.capacity().used,3);assert.ok(members.every(id=>f.service.byAccount.get(id).raidId===squad.raidId));
 const profiles=members.map(id=>f.store.profile(id));assert.equal(f.service.deploy(members[0],{requestId:'capacity_trio_admitted'}).self.deploymentId,squad.self.deploymentId);assert.deepEqual(members.map(id=>f.store.profile(id)),profiles);
});
test('reconnect and idempotent deployment remain possible at capacity without a new debit',t=>{
 const f=setup(t,1),id=f.account(),state=f.deploy(id,'relay','capacity_same_request'),before=f.store.profile(id);assert.equal(f.service.snapshot(id).self.deploymentId,state.self.deploymentId);assert.equal(f.deploy(id,'relay','capacity_same_request').self.deploymentId,state.self.deploymentId);assert.deepEqual(f.store.profile(id),before);assert.equal(f.service.capacity().used,1);
});
test('pending settlement retains a slot until its durable result succeeds',t=>{
 const f=setup(t,1),a=f.account(),b=f.account();f.deploy(a);const p=f.service.byAccount.get(a),r=f.service.raids.get(p.raidId),flush=f.service.flush;f.service.flush=()=>{};f.service.atomic(()=>f.service.end(r,p,'death'));assert.equal(p.alive,false);assert.ok(p.pending);assert.equal(f.service.capacity().used,1);assert.throws(()=>f.deploy(b),e=>e.status===503);f.service.flush=flush;f.service.atomic(()=>f.service.flush(f.service.byAccount.get(a)));assert.equal(f.service.capacity().used,0);f.deploy(b);assert.equal(f.service.capacity().used,1);
});
test('a lower configured limit after restart preserves all existing bodies and prevents new admissions',t=>{
 const f=setup(t,2),a=f.account(),b=f.account(),c=f.account(),sa=f.deploy(a),sb=f.deploy(b);f.restart(1);assert.equal(f.service.snapshot(a).self.deploymentId,sa.self.deploymentId);assert.equal(f.service.snapshot(b).self.deploymentId,sb.self.deploymentId);assert.deepEqual(f.service.capacity(),{limit:1,used:2,available:0,overCapacity:true});assert.throws(()=>f.deploy(c),e=>e.status===503);assert.equal(f.service.snapshot(a).self.alive,true);
});
for(const invalid of [0,-1,1.5,NaN,Infinity,'2',1025])test('invalid operator limit fails without acquiring a simulation lease: '+String(invalid),()=>{const store=new RaidStore();try{assert.throws(()=>new RaidService(store,{maxOperators:invalid}),/operator limit/);assert.equal(store.db.prepare('SELECT count(*) n FROM leases').get().n,0)}finally{store.close()}});
test('simultaneous HTTP admissions cannot overfill the global cap and existing actions stay available',async()=>{
 const store=new RaidStore(),runtime=createRaidServer(store,{maxOperators:2});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port;
 try{
  const clients=[];for(let i=0;i<5;i++){const response=await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'http_capacity_'+i,password:'a long HTTP capacity password'})});const profile=await response.json();assert.equal(response.status,200);clients.push({id:profile.id,cookie:response.headers.get('set-cookie').split(';')[0]})}
  const post=async(c,path,body)=>{const response=await fetch(base+'/api/'+path,{method:'POST',headers:{cookie:c.cookie,'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}};
  const results=await Promise.all(clients.map((c,i)=>post(c,'deploy',{protocol:RAID_PROTOCOL,requestId:'capacity_http_'+i,mapId:i%2?'relay':'reservoir',recovery:true})));
  assert.equal(results.filter(r=>r.status===200).length,2);assert.equal(results.filter(r=>r.status===503).length,3);assert.equal(runtime.raids.capacity().used,2);
  for(let i=0;i<clients.length;i++)if(results[i].status===503){assert.equal(store.profile(clients[i].id).activeDeployment,null);assert.equal(store.profile(clients[i].id).credits,250)}
  const i=results.findIndex(r=>r.status===200),state=results[i].body,client=clients[i];assert.equal((await post(client,'action',{protocol:RAID_PROTOCOL,raidId:state.raidId,deploymentId:state.self.deploymentId,type:'move',seq:1,x:0,z:0,yaw:0})).status,200);
  assert.equal((await fetch(base+'/health/ready')).status,200,'full is healthy for existing players');const capabilities=await(await fetch(base+'/api/capabilities')).json();assert.equal(capabilities.maxPlayers,9);assert.equal(capabilities.maxOperators,2);assert.equal(runtime.operations.summary().operatorCapacity.available,0);
 }finally{runtime.server.close();await once(runtime.server,'close');store.close()}
});
