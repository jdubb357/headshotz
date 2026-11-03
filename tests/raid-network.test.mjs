import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {createRaidServer} from '../server/main.mjs';
import {ReliableActions} from '../raid-transport.mjs';
import {LocalPrediction} from '../raid-prediction.mjs';
import {RAID_PROTOCOL,RECEIPT_LIMIT} from '../shared/raid-protocol.mjs';
function setup(t){const store=new RaidStore();t.after(()=>store.close());const id=store.register('network_operator','a long network password').id;let now=1000;const raids=new RaidService(store,{now:()=>now});raids.deploy(id,{requestId:'network_deploy',mapId:'relay',recovery:true});const player=()=>raids.byAccount.get(id),packet=(type,seq,extra={})=>({type,seq,protocol:RAID_PROTOCOL,raidId:player().raidId,deploymentId:player().deploymentId,...extra});return {store,raids,id,player,packet,time:value=>now=value}}
test('lost-success retries reuse a committed action without firing, healing or taking twice',t=>{
 const {raids,id,player,packet}=setup(t);const fire=packet('fire',1);assert.equal(raids.action(id,fire).duplicate,false);assert.equal(raids.action(id,fire).duplicate,true);assert.equal(player().ammo,29);
 player().hp=40;const med=player().equipment.find(it=>it.kind==='med'),use=packet('use',2,{itemId:med.id});raids.action(id,use);raids.action(id,use);assert.equal(player().hp,75);assert.equal(player().facts.medkitsUsed,1);
 const raid=raids.raids.get(player().raidId),cache=raid.caches[0];Object.assign(player(),{x:cache.x,y:cache.y,z:cache.z});cache.open=true;const take=packet('take',3,{sourceId:cache.id,itemId:cache.items[0].id});raids.action(id,take);raids.action(id,take);assert.equal(player().pack.length,1);assert.throws(()=>raids.action(id,{...take,itemId:'forged'}),/already used/);
});
test('failed action outcomes replay their original rejection even after eligibility changes',t=>{
 const {raids,id,player,packet}=setup(t),raid=raids.raids.get(player().raidId),cache=raid.caches[0],search=packet('search',1,{sourceId:cache.id});let first;
 try{raids.action(id,search)}catch(error){first=error}assert.ok(first);assert.equal(first.ack.accepted,false);assert.equal(player().seq,1);Object.assign(player(),{x:cache.x,y:cache.y,z:cache.z});let repeat;try{raids.action(id,search)}catch(error){repeat=error}assert.equal(repeat.message,first.message);assert.equal(repeat.ack.duplicate,true);assert.equal(raids.raids.get(player().raidId).caches[0].searcher,null);assert.equal(raids.action(id,packet('search',2,{sourceId:cache.id})).accepted,true);
});
test('raid and deployment bindings reject stale-account inputs and receipt windows stay bounded',t=>{
 const {raids,id,player,packet}=setup(t);assert.throws(()=>raids.action(id,{...packet('fire',1),deploymentId:'other-deployment'}),/another deployment/);assert.equal(player().ammo,30);assert.throws(()=>raids.action(id,{...packet('move',1,{x:0,z:0,yaw:0}),hp:999}),/Unknown action field/);
 for(let i=1;i<=RECEIPT_LIMIT+3;i++)raids.action(id,packet('move',i,{x:0,z:0,yaw:i*.01}));assert.equal(player().receipts.length,RECEIPT_LIMIT);assert.throws(()=>raids.action(id,packet('move',1,{x:0,z:0,yaw:.01})),/Stale/);assert.equal(raids.action(id,packet('move',RECEIPT_LIMIT+3,{x:0,z:0,yaw:(RECEIPT_LIMIT+3)*.01})).duplicate,true);
});
test('snapshot reads, firing and replayed moves cannot extend expired movement input',t=>{
 const {raids,id,player,packet,time}=setup(t),r=raids.raids.get(player().raidId);r.world={...r.world,blocks:[],ramps:[],hazards:[]};r.machines=[];const move=packet('move',1,{x:0,z:1,yaw:0});raids.action(id,move);time(1000.2);raids.tick(.05);const at=player().z;assert.ok(player().move.z>0);time(1000.5);assert.deepEqual(raids.snapshot(id).self.move,{x:0,z:0});raids.action(id,packet('fire',2));raids.tick(.05);assert.equal(player().z,at);
 for(let i=0;i<8;i++){time(1000.6+i*.1);raids.snapshot(id);raids.tick(.05)}assert.equal(player().z,at);assert.equal(raids.action(id,move).duplicate,true);raids.tick(.05);assert.equal(player().z,at);assert.equal(player().lastMoveAt,1000);time(1002);raids.action(id,packet('move',3,{x:0,z:1,yaw:0}));raids.tick(.05);assert.ok(player().z>at);
});
test('movement checkpoints only its raid and does not rewrite unchanged inventory, while shots persist wear',t=>{
 const {store,raids,id,player,packet}=setup(t),other=store.register('other_checkpoint_raid','a long network password');
 raids.deploy(other.id,{requestId:'other_network_deploy',mapId:'reservoir',recovery:true});
 store.db.exec('CREATE TABLE test_inventory_writes(id TEXT); CREATE TRIGGER count_inventory_writes AFTER UPDATE ON inventory BEGIN INSERT INTO test_inventory_writes VALUES(new.id); END;');
 const checkpoint=store.checkpoint.bind(store),saved=[];store.checkpoint=raid=>{saved.push(raid.id);return checkpoint(raid)};
 raids.action(id,packet('move',1,{x:0,z:1,yaw:0}));assert.deepEqual(saved,[player().raidId]);assert.equal(store.db.prepare('SELECT count(*) n FROM test_inventory_writes').get().n,0);
 const weapon=player().equipment.find(it=>it.kind==='weapon');raids.action(id,packet('fire',2));assert.deepEqual(store.db.prepare('SELECT id FROM test_inventory_writes').all().map(row=>row.id),[weapon.id]);assert.equal(JSON.parse(store.db.prepare('SELECT payload FROM inventory WHERE id=?').get(weapon.id).payload).loaded,29);
 // Optimization must still reject a canonical item banked outside this raid.
 store.db.prepare("UPDATE inventory SET location='stash' WHERE id=?").run(weapon.id);assert.throws(()=>raids.action(id,packet('move',3,{x:0,z:0,yaw:0})),/already banked/);assert.equal(raids.snapshot(id).self.seq,2);
});
test('committed receipts survive a database restart and failed checkpoint writes commit no receipt',()=>{
 const root=mkdtempSync(join(tmpdir(),'raid-receipts-')),file=join(root,'raid.sqlite');let store=new RaidStore(file),raids=new RaidService(store,{now:()=>1000});
 try{const id=store.register('receipt_restart','a long network password').id,state=raids.deploy(id,{requestId:'receipt_deploy',mapId:'relay',recovery:true}),packet={protocol:RAID_PROTOCOL,raidId:state.raidId,deploymentId:state.self.deploymentId,type:'fire',seq:1};raids.action(id,packet);raids.close();store.close();store=new RaidStore(file);raids=new RaidService(store,{now:()=>1001});assert.equal(raids.action(id,packet).duplicate,true);assert.equal(raids.snapshot(id).self.ammo,29);
 store.db.exec("CREATE TRIGGER fail_network BEFORE UPDATE ON raid_checkpoints BEGIN SELECT RAISE(ABORT,'disk failure'); END;");assert.throws(()=>raids.action(id,{...packet,seq:2}),/disk failure/);assert.equal(raids.snapshot(id).self.seq,1);assert.equal(raids.snapshot(id).self.ammo,29);store.db.exec('DROP TRIGGER fail_network');assert.equal(raids.action(id,{...packet,seq:2}).duplicate,false);assert.equal(raids.snapshot(id).self.ammo,28);
 }finally{raids.close();store.close();rmSync(root,{recursive:true,force:true})}
});
const baseState=()=>({protocol:RAID_PROTOCOL,raidId:'raid-test',map:'relay',mapVersion:2,self:{deploymentId:'deployment-test',seq:0,x:-68,y:0,z:-68,move:{x:0,z:0},alive:true,grounded:true}});
test('client retries identical sequence/payload after an accepted response is lost',async()=>{
 const state=baseState(),packets=[];let publications=0,calls=0;const channel=new ReliableActions({state,now:()=>100,sleep:async()=>{},onState:()=>publications++,request:async packet=>{packets.push(JSON.stringify(packet));calls++;if(calls===1)throw new Error('response lost');return {ack:{protocol:RAID_PROTOCOL,sequence:packet.seq,accepted:true,duplicate:true},state:{...state,self:{...state.self,seq:packet.seq}}}}});
 const result=await channel.send({type:'fire',yaw:0,pitch:0});assert.equal(result.ack.duplicate,true);assert.equal(packets[0],packets[1]);assert.equal(publications,1);assert.equal(channel.sequence,1);
});
test('client serializes commands, bounds failure retries, and publishes no response after close',async()=>{
 const state=baseState();let count=0,resolve;const deferred=new Promise(r=>resolve=r),channel=new ReliableActions({state,sleep:async()=>{},request:async()=>{count++;throw new Error('offline')}});await assert.rejects(channel.send({type:'jump'}),/offline/);assert.equal(count,3);
 let publications=0;const other=new ReliableActions({state,request:()=>deferred,onState:()=>publications++}),pending=other.send({type:'fire'});await Promise.resolve();other.close();resolve({ack:{protocol:RAID_PROTOCOL,sequence:1,accepted:true},state});await assert.rejects(pending,/canceled/);assert.equal(publications,0);
});
test('client rejects wrong deployment state and protocol instead of rendering it',async()=>{
 const state=baseState(),channel=new ReliableActions({state,request:async packet=>({ack:{protocol:RAID_PROTOCOL,sequence:packet.seq,accepted:true},state:{...state,self:{...state.self,deploymentId:'another'}}})});await assert.rejects(channel.send({type:'reload'}),/Mismatched/);assert.equal(channel.closed,true);
});
test('queued movement samples the released controls when dispatched, and retries preserve that sample',async()=>{
 const state=baseState(),packets=[];let release,held=true,attempts=0;const blocked=new Promise(resolve=>release=resolve);
 const channel=new ReliableActions({state,sleep:async()=>{},request:async packet=>{packets.push(structuredClone(packet));if(packet.type==='reload')await blocked;else if(++attempts===1)throw new Error('lost response');return {ack:{protocol:RAID_PROTOCOL,sequence:packet.seq,accepted:true},state:{...state,self:{...state.self,seq:packet.seq}}}}});
 const reload=channel.send({type:'reload'}),move=channel.send(()=>({type:'move',x:0,z:held?1:0,yaw:0}));await Promise.resolve();held=false;release();await reload;await move;
 assert.equal(packets.length,3);assert.equal(packets[1].z,0);assert.deepEqual(packets[1],packets[2]);assert.equal(packets[1].seq,2);
});
test('visual prediction moves immediately, respects collision, freezes unconfirmed motion and reconciles',()=>{
 let now=1000;const state=baseState(),prediction=new LocalPrediction(state,()=>now);prediction.world={size:160,blocks:[],ramps:[]};now+=16;assert.ok(prediction.frame({x:0,z:1},now).z>state.self.z);const frozenInventory=structuredClone(state.self);for(let i=0;i<12;i++){now+=40;prediction.frame({x:0,z:1},now)}const stopped=prediction.position.z;now+=1000;prediction.frame({x:0,z:1},now);assert.equal(prediction.position.z,stopped);assert.deepEqual(state.self,frozenInventory);
 prediction.reconcile({...state,self:{...state.self,x:0,z:0}});prediction.world={size:160,blocks:[[0,2,10,1,4]],ramps:[]};for(let i=0;i<7;i++){now+=40;prediction.frame({x:0,z:1},now)}assert.ok(prediction.position.z<1.05);prediction.reconcile({...state,self:{...state.self,x:8,z:9}});assert.equal(prediction.position.x,8);assert.equal(prediction.position.z,9);
});
test('wire protocol gates deployment before escrow and combines state with replay-safe action acknowledgements',async t=>{
 const store=new RaidStore(),{server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.close();await once(server,'close');store.close()});const account=store.register('wire_user','a long network password'),auth=store.login(account.username,'a long network password'),base='http://127.0.0.1:'+server.address().port,post=(path,data)=>fetch(base+'/api/'+path,{method:'POST',headers:{cookie:'raid_session='+auth.token,'content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await post('deploy',{requestId:'old_client_deploy',mapId:'relay',recovery:true})).status,426);assert.equal(store.profile(account.id).activeDeployment,null);const before=store.profile(account.id);assert.equal((await post('deploy',{protocol:2,requestId:'old_geometry_client',mapId:'relay',itemIds:[before.items[0].id]})).status,426);assert.deepEqual(store.profile(account.id),before);assert.equal((await post('deploy',{protocol:RAID_PROTOCOL-1,requestId:'old_utility_client',mapId:'relay',itemIds:[before.items[0].id]})).status,426);assert.deepEqual(store.profile(account.id),before);const state=await(await post('deploy',{protocol:RAID_PROTOCOL,requestId:'new_client_deploy',mapId:'relay',recovery:true})).json();
 const packet={protocol:RAID_PROTOCOL,raidId:state.raidId,deploymentId:state.self.deploymentId,type:'fire',seq:1,includeState:true};const first=await(await post('action',packet)).json(),retry=await(await post('action',packet)).json();assert.equal(first.state.self.ammo,29);assert.equal(retry.state.self.ammo,29);assert.equal(retry.ack.duplicate,true);assert.equal((await post('action',{...packet,protocol:1})).status,426);assert.equal((await post('action',{...packet,deploymentId:'other'})).status,409);
});
