import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {giveCarried} from '../server/raid-inventory.mjs';
import {normalizePackOrder,orderPack,movePackItem} from '../shared/raid-pack-order.mjs';

function cred(prefix){return (prefix+'_'+randomUUID().slice(0,6)).slice(0,24)}
function makeItem(kind='ammo',extra={}){
 return kind==='weapon'?{id:randomUUID(),kind:'weapon',weapon:'smg',quantity:1,condition:100,loaded:10,rarity:1,label:'SMG',...extra}
  :kind==='material'?{id:randomUUID(),kind:'material',material:'steel',quantity:2,condition:100,rarity:1,label:'Steel',...extra}
  :{id:randomUUID(),kind:'ammo',ammo:'light',quantity:6,condition:100,rarity:1,label:'Light ammo',...extra};
}
function setup(t,{file=null}={}){
 const store=new RaidStore(file||undefined);let now=1000;
 const service=new RaidService(store,{now:()=>now});
 const sender=store.register(cred('give_sender'),'a long give password').id;
 const recipient=store.register(cred('give_recipient'),'a long give password').id;
 const rival=store.register(cred('give_rival'),'a long give password').id;
 service.deploy(sender,{mapId:'relay',requestId:'give_sender_deploy_'+sender,recovery:true});
 service.deploy(recipient,{mapId:'relay',requestId:'give_recipient_deploy_'+recipient,recovery:true});
 service.deploy(rival,{mapId:'relay',requestId:'give_rival_deploy_'+rival,recovery:true});
 const P=id=>service.byAccount.get(id),s=P(sender),r=P(recipient),v=P(rival);
 assert.ok(s&&r&&v,'operators deployed');
 const raid=service.raids.get(s.raidId);
 assert.equal(r.raidId,raid.id,'the recipient shares the sender raid');assert.equal(v.raidId,raid.id,'the rival shares the raid');
 raid.machines=[];raid.rivals=[];raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};raid.caches=[];raid.bags=[];raid.floorLoot=[];
 const shared='give-team';
 for(const p of [s,r])Object.assign(p,{team:shared,x:0,y:0,z:0,protectedUntil:0,move:{x:0,z:0},lastInput:now,hp:100,alive:true,downed:false,bleedUntil:0});
 for(const p of [v])Object.assign(p,{team:'other-team',x:20,y:0,z:0,protectedUntil:0,move:{x:0,z:0},lastInput:now,hp:100,alive:true,downed:false,bleedUntil:0});
 const act=(id,type,extra={})=>service.action(id,{type,seq:P(id).seq+1,...extra});
 t.after(()=>{service.close();store.close()});
 return {store,service,sender,recipient,rival,P,raid,act,time:value=>now=value,shared};
}

test('a valid hand-off moves one pack item to a living squadmate',t=>{
 const f=setup(t),item=makeItem('material'),sender=f.P(f.sender),recipient=f.P(f.recipient);
 sender.pack.push(item);
 const reference=structuredClone(recipient.pack);
 f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id});
 const s=f.P(f.sender),r=f.P(f.recipient);
 assert.equal(s.pack.some(it=>it.id===item.id),false,'the sender loses the item');
 assert.equal(r.pack.some(it=>it.id===item.id),true,'the recipient receives the same item instance');
 assert.deepEqual(r.pack.find(it=>it.id===item.id),item,'the transfer does not duplicate or alter the item');
 assert.equal(f.store.db.prepare('SELECT account FROM inventory WHERE id=?').get(item.id).account,f.store.profile(f.recipient).id,'ownership checkpoint names the recipient');
 assert.ok(r.pack.length>=reference.length,'the recipient backpack grew by one slot');
 const audit=f.store.db.prepare("SELECT data FROM audit WHERE event='raid_transfer' ORDER BY id DESC LIMIT 1").get();
 assert.match(audit.data,/give/,'the hand-off is audited');
});

test('give rejects an item that is not in the sender backpack',t=>{
 const f=setup(t),sender=f.P(f.sender),item=makeItem('ammo');
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/Item not in your backpack/);
 sender.secure.push(item);
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/Item not in your backpack/,'secure pocket items cannot be handed off');
});

test('give enforces recipient slot capacity and weight limits',t=>{
 const f=setup(t);
 let recipient=f.P(f.recipient),sender=f.P(f.sender);
 recipient.pack.splice(0,recipient.pack.length);
 for(let i=0;i<recipient.cap;i++)recipient.pack.push(makeItem('material'));
 const source=makeItem('weapon');
 sender.pack.push(source);
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:source.id}),/backpack is full/);
 recipient=f.P(f.recipient);sender=f.P(f.sender);
 recipient.pack.splice(0,recipient.pack.length);
 recipient.weightCap=1;
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:source.id}),/weight limit/i);
});

test('give refuses recovery items and starter gear bound to another account',t=>{
 const f=setup(t),sender=f.P(f.sender);
 const recovery=makeItem('ammo',{recovery:true}),bound=makeItem('material',{grantOwner:f.sender});
 sender.pack.push(recovery,bound);
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:recovery.id}),/Recovery supplies/);
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:bound.id}),/Starter supplies/,'a bound grant cannot drift away from its owner');
});

test('a failed checkpoint rolls back the hand-off and duplicate retries cannot clone the item',t=>{
 const f=setup(t),item=makeItem('weapon'),sender=f.P(f.sender);
 sender.pack.push(item);
 const before=structuredClone(f.P(f.recipient).pack),checkpoint=f.store.checkpoint;
 f.store.checkpoint=()=>{throw new Error('give checkpoint failure')};
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/give checkpoint failure/);
 f.store.checkpoint=checkpoint;
 const s=f.P(f.sender),r=f.P(f.recipient);
 assert.ok(s.pack.some(it=>it.id===item.id),'sender keeps the item after rollback');
 assert.deepEqual(r.pack,before,'recipient is unchanged after rollback');
 f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id});
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/Item not in your backpack/);
 const held=f.P(f.recipient).pack.filter(it=>it.id===item.id);
 assert.equal(held.length,1,'the recipient holds exactly one copy');
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/Item not in your backpack/);
});

test('give rejects downed, rival, stale and self targets without mutating state',t=>{
 const f=setup(t);
 let sender=f.P(f.sender),recipient=f.P(f.recipient),rival=f.P(f.rival);
 const item=makeItem('material');
 sender.pack.push(item);
 recipient.downed=true;
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.recipient,itemId:item.id}),/living squadmate/);
 recipient.downed=false;
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.rival,itemId:item.id}),/living squadmate/);
 assert.throws(()=>f.act(f.sender,'give',{targetId:f.sender,itemId:item.id}),/living squadmate/);
 assert.equal(f.P(f.sender).pack.filter(it=>it.id===item.id).length,1,'failed transfers leave the sender backpack intact');
 assert.equal(f.P(f.recipient).pack.some(it=>it.id===item.id),false,'failed transfers leave the recipient backpack intact');
});

test('a handed-off item and ownership survive a service restart',t=>{
 const root=mkdtempSync('/tmp/hs-give-restart-'),file=join(root,'raid.sqlite');
 try{
  let store=new RaidStore(file),now=1000,service=new RaidService(store,{now:()=>now});
  try{
   const sender=store.register(cred('restart_sender'),'a long give password').id;
   const recipient=store.register(cred('restart_recipient'),'a long give password').id;
   service.deploy(sender,{mapId:'relay',requestId:'restart_sender_'+sender,recovery:true});
   service.deploy(recipient,{mapId:'relay',requestId:'restart_recipient_'+recipient,recovery:true});
   let s=service.byAccount.get(sender),r=service.byAccount.get(recipient),raid=service.raids.get(s.raidId);
   raid.machines=[];raid.rivals=[];raid.caches=[];raid.bags=[];raid.floorLoot=[];raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};
   for(const p of [s,r])Object.assign(p,{team:'restart_squad',x:0,y:0,z:0,protectedUntil:0,move:{x:0,z:0}});
   const item=makeItem('weapon');s.pack.push(item);
   service.action(sender,{type:'give',seq:1,targetId:recipient,itemId:item.id});
   assert.equal(r.pack.some(it=>it.id===item.id),true);
   service.close();store.close();
   store=new RaidStore(file);now=1001;service=new RaidService(store,{now:()=>now});
   s=service.byAccount.get(sender);r=service.byAccount.get(recipient);
   assert.equal(s.pack.some(it=>it.id===item.id),false,'restart preserves that the sender handed the item away');
   assert.equal(r.pack.filter(it=>it.id===item.id).length,1,'restart preserves exactly one received item');
   assert.equal(store.db.prepare('SELECT account FROM inventory WHERE id=?').get(item.id).account,store.profile(recipient).id,'restart ownership follows the recipient');
   service.action(recipient,{type:'equip',seq:1,itemId:item.id});
   assert.equal(service.byAccount.get(recipient).weaponId,item.id,'the recipient equips the received weapon in the next round-trip');
  }finally{service.close();store.close()}
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('giveCarried merges a compatible stack instead of consuming a new recipient slot',t=>{
 const p={pack:[{id:'give-src',kind:'ammo',ammo:'light',quantity:5,condition:100,rarity:1}],equipment:[],secure:[],cap:4,weightCap:40,team:'t',alive:true,downed:false};
 const target={account:'mate',alive:true,downed:false,team:'t',pack:[{id:'give-dst',kind:'ammo',ammo:'light',quantity:5,condition:100,rarity:1}],equipment:[],secure:[],cap:4,weightCap:40};
 const result=giveCarried(p,target,'give-src');
 assert.equal(p.pack.length,0);
 assert.equal(target.pack.length,1);
 assert.equal(target.pack[0].quantity,10);
 assert.equal(result.mergedInto,'give-dst');
});

test('pack reorder is presentation-only, stable and clamps untrusted order lists',()=>{
 const items=[{id:'a'},{id:'b'},{id:'c'}];
 assert.deepEqual(orderPack(items,[]),items,'items without a saved order keep server order');
 assert.deepEqual(orderPack(items,['c','a']).map(it=>it.id),['c','a','b'],'unranked items stay in server order at the end');
 assert.deepEqual(normalizePackOrder(['a','a','b',7,'']),['a','b'],'saved orders are deduplicated and typed');
 assert.deepEqual(movePackItem(['a','b','c'],'a','c',true),['b','c','a'],'moving a row after another finds the target');
 assert.deepEqual(movePackItem(['a','b','c'],'a','c',false),['b','a','c'],'moving a row before another finds the target');
 assert.equal(orderPack(items,['c']).length,items.length,'reordering never adds or removes items');
});
