import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {createRaidServer} from '../server/main.mjs';
function setup(t){
 const store=new RaidStore();t.after(()=>store.close());const {id}=store.register('tester','a long test password');
 let now=1000;const raids=new RaidService(store,{now:()=>now});
 return {store,id,raids,advance:n=>{now+=n;raids.tick(.05)}};
}
test('only owned equipment enters the authoritative simulation',t=>{
 const {store,id,raids}=setup(t);const weapon=store.profile(id).items[0].id;
 const state=raids.deploy(id,{requestId:'deploy_0001',mapId:'relay',itemIds:[weapon]});
 assert.equal(state.self.equipment[0].id,weapon);assert.equal(store.profile(id).items.length,3);
 assert.throws(()=>raids.deploy(id,{requestId:'deploy_0002',mapId:'relay',recovery:true}),/Already deployed/);
});
test('server movement is bounded and walls reject movement',t=>{
 const {id,raids,advance}=setup(t);raids.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=raids.byAccount.get(id);p.x=-34;p.z=-15;
 raids.action(id,{type:'move',x:100000,z:0,yaw:0,seq:1});advance(.05);
 assert.ok(p.x<=-33.5);assert.throws(()=>raids.action(id,{type:'move',x:Infinity,z:0,yaw:0,seq:2}),/Invalid movement/);
});
test('contested loot has one owner and stale claims cannot duplicate it',t=>{
 const {store,id,raids}=setup(t);const other=store.register('second','a second long password').id;
 raids.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});raids.deploy(other,{requestId:'deploy_0002',mapId:'relay',recovery:true});
 const a=raids.byAccount.get(id),b=raids.byAccount.get(other),r=raids.raids.get(a.raidId),c=r.caches[0];
 a.x=b.x=c.x;a.z=b.z=c.z;c.open=true;const itemId=c.items[0].id;
 raids.action(id,{type:'take',sourceId:c.id,itemId,seq:1});
 assert.throws(()=>raids.action(other,{type:'take',sourceId:c.id,itemId,seq:1}),/already claimed/);
 assert.equal(a.pack.filter(it=>it.id===itemId).length,1);assert.equal(b.pack.length,0);
});
test('extraction settles independently and another raid can be started',t=>{
 const {store,id,raids,advance}=setup(t);const other=store.register('second','a second long password').id;
 raids.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});raids.deploy(other,{requestId:'deploy_0002',mapId:'relay',recovery:true});
 const a=raids.byAccount.get(id),b=raids.byAccount.get(other),r=raids.raids.get(a.raidId),exit=r.exits[0];r.machines=[];
 a.x=exit.x;a.z=exit.z;exit.openAt=999;exit.closeAt=1100;
 raids.action(id,{type:'extract',exitId:exit.id,seq:1});advance(3);
 assert.equal(a.result.outcome,'extract');assert.equal(b.alive,true);assert.equal(store.profile(id).credits,270);
 assert.ok(raids.deploy(id,{requestId:'deploy_0003',mapId:'relay',recovery:true}).self.alive);
});
test('failed writes retain pending settlement and retry without duplication',t=>{
 const {store,id,raids,advance}=setup(t);raids.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=raids.byAccount.get(id),r=raids.raids.get(p.raidId);r.machines=[];
 store.db.exec("CREATE TRIGGER fail_result BEFORE UPDATE ON deployments WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT,'temporary unavailable'); END;");
 raids.end(r,p,'death');assert.ok(p.pending);assert.equal(store.results(id).length,0);
 store.db.exec('DROP TRIGGER fail_result');advance(.1);advance(.1);
 assert.equal(p.result.outcome,'death');assert.equal(store.results(id).length,1);assert.equal(p.pending,null);
});
test('HTTP enforces authentication, origin checks and private source boundaries',async t=>{
 const store=new RaidStore();const {server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.close();await once(server,'close');store.close()});
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(route,data,extra={})=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(route==='/api/deploy'?{...data,protocol:RAID_PROTOCOL}:data)});
 assert.equal((await fetch(base+'/api/profile')).status,401);
 const response=await post('/api/register',{username:'http_user',password:'a long test password'});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await fetch(base+'/api/profile',{headers:{cookie}})).status,200);
 assert.equal((await post('/api/deploy',{requestId:'deploy_0001',mapId:'relay',recovery:true},{cookie,origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/deploy',{requestId:'deploy_0001',mapId:'relay',recovery:true},{cookie})).status,200);
 assert.equal((await post('/api/settle',{credits:1000000},{cookie})).status,404);
 for(const route of ['/server/store.mjs','/scripts/economy-audit.mjs','/.raid-data/raid.sqlite','/.git/config'])assert.equal((await fetch(base+route)).status,404);
 assert.equal((await fetch(base+'/raid-online.html')).status,200);
});
