import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {recyclingQuote} from '../shared/raid-inventory.mjs';
import {auditEconomy} from '../scripts/economy-audit.mjs';
function setup(t){const store=new RaidStore(),id=store.register('recycling_owner','a long recycling password').id;t.after(()=>store.close());return {store,id}}
function fixture(store,id,items){store.transaction(()=>{const state=store.state(id);state.items.push(...items);store.save(id,state)})}
test('purchased medium ammunition cannot be split into profitable single-round salvage',t=>{
 const {store,id}=setup(t);store.trade(id,{type:'buy',trader:'outfitter',sku:'ammo_medium'});let profile=store.profile(id),ammo=profile.items.find(it=>it.kind==='ammo');store.trade(id,{type:'split',itemId:ammo.id,quantity:1,expectedRevision:profile.revision});profile=store.profile(id);const fragment=profile.items.find(it=>it.splitFrom===ammo.id);
 for(const it of [fragment,profile.items.find(it=>it.id===ammo.id)]){const before=store.profile(id);assert.throws(()=>store.trade(id,{type:'recycle',itemId:it.id}),/at least 30 rounds/);assert.deepEqual(store.profile(id),before)}
 store.trade(id,{type:'stack',itemId:fragment.id,targetId:ammo.id,expectedRevision:store.profile(id).revision});store.trade(id,{type:'recycle',itemId:ammo.id});const salvage=store.profile(id).items.find(it=>it.kind==='material');assert.equal(salvage.quantity,1);assert.equal(store.db.prepare('SELECT location FROM inventory WHERE id=?').get(ammo.id).location,'consumed');store.trade(id,{type:'sell',itemId:salvage.id});assert.equal(store.profile(id).credits,240);
});
test('recycling consumes complete batches and preserves the original leftover identity',t=>{
 const {store,id}=setup(t),ammo=item('ammo',{ammo:'medium',quantity:65});fixture(store,id,[ammo]);store.trade(id,{type:'recycle',itemId:ammo.id});const after=store.profile(id),left=after.items.find(it=>it.id===ammo.id),output=after.items.find(it=>it.kind==='material');assert.equal(left.quantity,5);assert.equal(output.quantity,2);assert.equal(output.material,'steel');assert.equal(store.db.prepare('SELECT location FROM inventory WHERE id=?').get(ammo.id).location,'stash');const audit=JSON.parse(store.db.prepare("SELECT data FROM audit WHERE event='item_recycled'").get().data);assert.equal(audit.consumed,60);assert.equal(audit.remaining,5);assert.equal(audit.outputId,output.id);
});
test('a full stash rejects leftover-plus-salvage creation atomically but allows whole-batch replacement',t=>{
 const {store,id}=setup(t),ammo=item('ammo',{ammo:'medium',quantity:31});fixture(store,id,[ammo,...Array.from({length:15},()=>item('med'))]);const before=store.profile(id);assert.equal(before.items.length,20);assert.throws(()=>store.trade(id,{type:'recycle',itemId:ammo.id}),/Stash full/);assert.deepEqual(store.profile(id),before);assert.equal(store.db.prepare("SELECT count(*) n FROM audit WHERE event='item_recycled'").get().n,0);
 store.trade(id,{type:'sell',itemId:before.items.find(it=>it.kind==='med').id});store.trade(id,{type:'recycle',itemId:ammo.id});assert.equal(store.profile(id).items.length,20);assert.equal(store.profile(id).items.find(it=>it.id===ammo.id).quantity,1);
 const whole=store.profile(id).items.find(it=>it.kind==='med');store.trade(id,{type:'recycle',itemId:whole.id});assert.equal(store.profile(id).items.length,20);
});
test('medical and utility stack yields do not depend on first splitting into individual items',t=>{
 const {store,id}=setup(t),med=item('med',{quantity:5}),utility=item('utility',{utility:'smoke',quantity:3});fixture(store,id,[med,utility]);store.trade(id,{type:'recycle',itemId:med.id});store.trade(id,{type:'recycle',itemId:utility.id});const state=store.profile(id);assert.equal(state.items.find(it=>it.material==='chem').quantity,5);assert.equal(state.items.find(it=>it.material==='steel').quantity,3);assert.equal(recyclingQuote({...med,quantity:2}).quantity+recyclingQuote({...med,quantity:3}).quantity,5);
});
test('existing salvage cannot be transmuted into another material and loaned equipment yields no salvage',t=>{
 const {store,id}=setup(t),wire=item('material',{material:'wire',quantity:20});fixture(store,id,[wire]);const before=store.profile(id);assert.throws(()=>store.trade(id,{type:'recycle',itemId:wire.id}),/use salvage directly/);assert.deepEqual(store.profile(id),before);assert.equal(recyclingQuote(item('weapon',{weapon:'ar',recovery:true})),null);
});
test('failed recycling audit rolls back consumed items, leftover, new salvage and revision',t=>{
 const {store,id}=setup(t),ammo=item('ammo',{ammo:'heavy',quantity:21});fixture(store,id,[ammo]);const before=store.profile(id),audit=store.audit;store.audit=function(account,event,data){if(event==='item_recycled')throw new Error('recycling audit failed');return audit.call(this,account,event,data)};assert.throws(()=>store.trade(id,{type:'recycle',itemId:ammo.id}),/audit failed/);store.audit=audit;assert.deepEqual(store.profile(id),before);assert.equal(store.db.prepare("SELECT count(*) n FROM inventory WHERE account=? AND location='stash'").get(id).n,before.items.length);
});
test('static buy/craft/recycle/resale and split salvage audits find no positive loops',()=>{
 const audit=auditEconomy();assert.deepEqual(audit.profitableLoops,[]);assert.ok(audit.recyclingTrades.some(r=>r.sku==='ammo_light'&&r.purchases===2));assert.ok(audit.recyclingRecipes.length>=10);assert.equal(audit.recyclingSplits.filter(r=>r.sku.startsWith('ammo_')).length,4);assert.ok(audit.recyclingSplits.reduce((n,r)=>n+r.cases,0)>79000);assert.ok(audit.recyclingSplits.every(r=>r.profit===0));
});
