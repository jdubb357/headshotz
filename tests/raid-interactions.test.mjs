import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';

function setup(t){
 const store=new RaidStore();let now=1000;
 const service=new RaidService(store,{now:()=>now}),ids=['channel_helper','channel_patient','channel_friend'].map(name=>store.register(name,'a long channel password').id);
 const party=service.party(ids[0],{type:'create',mode:'trio',mapId:'relay',region:'local',match:{maxRttMs:0}});
 for(const id of ids.slice(1))service.party(id,{type:'join',code:party.id});
 for(const id of ids)service.party(id,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true}});
 service.deploy(ids[0],{requestId:'interaction_trio_deploy'});
 const p=(i=0)=>service.byAccount.get(ids[i]),r=()=>service.raids.get(p().raidId),cache=(i=0)=>r().caches[i];
 const {x,y,z}=p();for(const id of ids)Object.assign(service.byAccount.get(id),{x,y,z,protectedUntil:0,move:{x:0,z:0},lastMoveAt:0});
 Object.assign(p(1),{downed:true,hp:0,bleedUntil:1025});r().machines=[];
 r().caches=[0,1].map(i=>({id:'channel_cache_'+i,x:x+i,y,z,open:false,vault:false,items:[],searcher:null,searchUntil:0}));
 const exit=r().exits[0];Object.assign(exit,{x,y,z,openAt:999,closeAt:1100});
 t.after(()=>{service.close();store.close()});
 return {store,service,ids,p,r,cache,action:(type,extra={},i=0)=>service.action(ids[i],{type,seq:p(i).seq+1,...extra}),time:n=>{now=n},tick:()=>service.tick(.05)};
}
const search=(f,i=0)=>f.action('search',{sourceId:f.cache(i).id});
test('starting another cache search releases the prior claim and only the selected cache opens',t=>{
 const f=setup(t);search(f);search(f,1);assert.equal(f.cache().searcher,null);assert.equal(f.cache(1).searcher,f.ids[0]);f.time(1002.5);f.tick();assert.equal(f.cache().open,false);assert.equal(f.cache(1).open,true);
});
test('stationary movement keepalives, pings and repeating the same search do not restart it',t=>{
 const f=setup(t);search(f);const until=f.cache().searchUntil;f.time(1001);f.action('move',{x:0,z:0,yaw:0});f.action('ping',{kind:'needAmmo'});search(f);assert.equal(f.cache().searchUntil,until);assert.equal(f.cache().searcher,f.ids[0]);
});
test('searching, reviving and boarding are mutually exclusive',t=>{
 const f=setup(t);search(f);f.action('revive',{targetId:f.ids[1]});assert.equal(f.cache().searcher,null);assert.ok(f.p().reviving);search(f);assert.equal(f.p().reviving,null);
 f.action('extract',{exitId:f.r().exits[0].id});assert.equal(f.cache().searcher,null);assert.ok(f.p().board);search(f);assert.equal(f.p().board,null);assert.equal(f.cache().searcher,f.ids[0]);
});
for(const channel of ['search','revive','board'])test('deliberate movement cancels '+channel,t=>{
 const f=setup(t);if(channel==='search')search(f);else if(channel==='revive')f.action('revive',{targetId:f.ids[1]});else f.action('extract',{exitId:f.r().exits[0].id});
 f.action('move',{x:1,z:0,yaw:0});assert.equal(f.cache().searcher,null);assert.equal(f.p().reviving??null,null);assert.equal(f.p().board??null,null);
});
for(const action of ['fire','jump'])test(action+' interrupts a container search',t=>{
 const f=setup(t);search(f);f.action(action);assert.equal(f.cache().searcher,null);assert.equal(f.cache().searchUntil,0);
});
test('damage in the same timestamp releases a search claim before a competitor tries',t=>{
 const f=setup(t);search(f);assert.throws(()=>f.action('search',{sourceId:f.cache().id},2),/being searched/);
 f.service.atomic(()=>f.service.damage(f.r(),f.p(),2));assert.equal(f.cache().searcher,null);
 f.action('search',{sourceId:f.cache().id},2);assert.equal(f.cache().searcher,f.ids[2]);
});
test('a downed searcher never finishes a loaded search claim',t=>{
 const f=setup(t);search(f);Object.assign(f.p(),{downed:true,hp:0,bleedUntil:1025});f.time(1003);f.tick();assert.equal(f.cache().open,false);assert.equal(f.cache().searcher,null);
});
test('a rejected action leaves the existing interaction and its timer intact',t=>{
 const f=setup(t);search(f);const until=f.cache().searchUntil;assert.throws(()=>f.action('equip',{itemId:'not_owned'}),/not owned/);assert.equal(f.cache().searcher,f.ids[0]);assert.equal(f.cache().searchUntil,until);
});
test('a checkpoint failure rolls back interaction replacement and keeps the original claim',t=>{
 const f=setup(t);search(f);const until=f.cache().searchUntil,checkpoint=f.store.checkpoint;
 f.store.checkpoint=()=>{throw new Error('interaction checkpoint failure')};assert.throws(()=>search(f,1),/interaction checkpoint failure/);f.store.checkpoint=checkpoint;
 assert.equal(f.cache().searcher,f.ids[0]);assert.equal(f.cache().searchUntil,until);assert.equal(f.cache(1).searcher,null);assert.equal(f.p().seq,1);
});
test('retrying an older search receipt does not replace the operators current interaction',t=>{
 const f=setup(t),packet={type:'search',seq:1,sourceId:f.cache().id};f.service.action(f.ids[0],packet);search(f,1);const until=f.cache(1).searchUntil;
 assert.equal(f.service.action(f.ids[0],packet).duplicate,true);assert.equal(f.cache().searcher,null);assert.equal(f.cache(1).searcher,f.ids[0]);assert.equal(f.cache(1).searchUntil,until);assert.equal(f.p().seq,2);
});
test('final elimination releases a search immediately without waiting for another tick',t=>{
 const f=setup(t);search(f);f.service.atomic(()=>f.service.end(f.r(),f.p(),'death'));assert.equal(f.cache().searcher,null);assert.equal(f.cache().open,false);
 f.action('search',{sourceId:f.cache().id},2);assert.equal(f.cache().searcher,f.ids[2]);
});
test('historical parallel claims are reduced to one before a tick can open multiple caches',t=>{
 const f=setup(t);for(const c of f.r().caches)Object.assign(c,{searcher:f.ids[0],searchUntil:1001});f.time(1002);f.tick();
 assert.equal(f.r().caches.filter(c=>c.open).length,1);assert.equal(f.r().caches.filter(c=>c.searcher).length,0);
});
test('vault unlock payment rolls back on write failure and stays spent after search interruption',t=>{
 const f=setup(t),key=item('key');Object.assign(f.cache(1),{open:true,items:[key]});f.action('take',{sourceId:f.cache(1).id,itemId:key.id});f.cache().vault=true;
 const checkpoint=f.store.checkpoint;f.store.checkpoint=()=>{throw new Error('vault checkpoint failure')};assert.throws(()=>search(f),/vault checkpoint failure/);f.store.checkpoint=checkpoint;
 assert.equal(f.cache().vault,true);assert.equal(f.p().pack.some(it=>it.id===key.id),true);assert.equal(f.p().facts.keysUsed||0,0);
 search(f);assert.equal(f.cache().vault,false);assert.equal(f.p().pack.some(it=>it.id===key.id),false);assert.equal(f.p().facts.keysUsed,1);
 f.action('move',{x:1,z:0,yaw:0});assert.equal(f.cache().searcher,null);assert.equal(f.cache().open,false);
 search(f);assert.equal(f.p().facts.keysUsed,1);f.time(1002.5);f.tick();assert.equal(f.cache().open,true);assert.equal(f.store.db.prepare('SELECT location FROM inventory WHERE id=?').get(key.id).location,'consumed');
});
