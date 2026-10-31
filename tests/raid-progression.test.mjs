import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {weaponStats} from '../shared/raid-catalog.mjs';
function setup(t){const store=new RaidStore();t.after(()=>store.close());const {id}=store.register('progression','a long progression password');return {store,id}}
function fixture(store,id,fn){store.transaction(()=>{const s=store.state(id);fn(s);store.save(id,s)})}
function salvage(store,id){fixture(store,id,s=>{s.credits=1000;for(const material of ['steel','wire','chem','fuel'])s.items.push(item('material',{material,quantity:20}))})}
test('trader stocks, distinct inventories, reputation locks and discounts are enforced',t=>{
 const {store,id}=setup(t);const markets=store.market(id);assert.equal(markets.length,3);
 assert.equal(markets.find(t=>t.id==='outfitter').stock.some(it=>it.sku==='med'),false);
 assert.throws(()=>store.trade(id,{type:'buy',trader:'outfitter',sku:'sniper'}),/reputation/);
 const first=store.trade(id,{type:'buy',trader:'medic',sku:'med'});assert.equal(first.credits,225);
 const offer=store.market(id).find(t=>t.id==='medic').stock.find(it=>it.sku==='med');assert.equal(offer.quantity,11);assert.equal(first.reputation.medic,1);
 const next=store.market(id,Date.now()+3600001).find(t=>t.id==='medic').stock.find(it=>it.sku==='med');assert.equal(next.quantity,12);
});
test('crafting consumes actual salvage and station upgrades unlock more recipes',t=>{
 const {store,id}=setup(t);salvage(store,id);
 assert.throws(()=>store.trade(id,{type:'craft',recipe:'scope'}),/workbench/);
 const before=store.profile(id).credits;store.trade(id,{type:'upgrade',upgrade:'bench'});
 const crafted=store.trade(id,{type:'craft',recipe:'scope'});
 assert.equal(crafted.upgrades.bench,1);assert.ok(crafted.items.some(it=>it.kind==='mod'&&it.mod==='scope'));
 assert.equal(crafted.items.find(it=>it.material==='steel').quantity,16);assert.equal(crafted.credits,before-115);
});
test('failed crafting leaves credits and materials unchanged',t=>{
 const {store,id}=setup(t),before=store.profile(id);
 assert.throws(()=>store.trade(id,{type:'craft',recipe:'med'}),/salvage/);
 assert.equal(store.profile(id).credits,before.credits);assert.equal(store.profile(id).items.length,before.items.length);
});
test('attachments keep their unique IDs across attach, deployment, extraction and detach',t=>{
 const {store,id}=setup(t);salvage(store,id);store.trade(id,{type:'upgrade',upgrade:'bench'});store.trade(id,{type:'craft',recipe:'scope'});
 const s=store.profile(id),weapon=s.items.find(it=>it.kind==='weapon'),mod=s.items.find(it=>it.kind==='mod');
 store.trade(id,{type:'attach',weaponId:weapon.id,itemId:mod.id});
 const configured=store.profile(id).items.find(it=>it.id===weapon.id);assert.equal(configured.attachments[0].id,mod.id);assert.equal(weaponStats(configured).range,78);
 assert.equal(store.db.prepare('SELECT location FROM inventory WHERE id=?').get(mod.id).location,'attached');
 const dep=store.deploy(id,{requestId:'deploy_0001',itemIds:[weapon.id]});store.settle(dep.id,{outcome:'extract',items:dep.equipment});
 store.trade(id,{type:'detach',weaponId:weapon.id,itemId:mod.id});
 assert.equal(store.profile(id).items.filter(it=>it.id===mod.id).length,1);assert.equal(store.profile(id).items.find(it=>it.id===weapon.id).attachments.length,0);
});
test('favorites prevent accidental sales and recycling; damaged equipment needs paid repair',t=>{
 const {store,id}=setup(t);salvage(store,id);const weapon=store.profile(id).items[0];
 store.trade(id,{type:'favorite',itemId:weapon.id,favorite:true});
 assert.throws(()=>store.trade(id,{type:'sell',itemId:weapon.id}),/Unfavorite/);
 assert.throws(()=>store.trade(id,{type:'recycle',itemId:weapon.id}),/Unfavorite/);
 fixture(store,id,s=>{s.items.find(it=>it.id===weapon.id).condition=50});
 const s=store.trade(id,{type:'repair',itemId:weapon.id});assert.equal(s.items.find(it=>it.id===weapon.id).condition,100);assert.equal(s.credits,975);
});
test('contracts use server facts, stage claims and inventory-backed deliveries',t=>{
 const {store,id}=setup(t);salvage(store,id);store.trade(id,{type:'contract',contract:'survey',operation:'accept'});
 const dep=store.deploy(id,{requestId:'deploy_0001',recovery:true});
 store.settle(dep.id,{outcome:'extract',facts:{explorations:['relay:a','relay:b','relay:c']}});
 assert.equal(store.profile(id).contracts.survey.progress,3);
 store.trade(id,{type:'contract',contract:'survey',operation:'claim'});assert.equal(store.profile(id).contracts.survey.stage,1);
 assert.throws(()=>store.trade(id,{type:'contract',contract:'survey',operation:'claim'}),/requirements/);
 store.trade(id,{type:'contract',contract:'salvage',operation:'accept'});store.trade(id,{type:'contract',contract:'salvage',operation:'deliver'});
 const s=store.trade(id,{type:'contract',contract:'salvage',operation:'claim'});assert.equal(s.contracts.salvage.completed,true);assert.equal(s.items.find(it=>it.material==='steel').quantity,16);
});
test('full stash extraction uses protected overflow without selling or losing items',t=>{
 const {store,id}=setup(t);fixture(store,id,s=>{while(s.items.length<20)s.items.push(item('med'))});
 const dep=store.deploy(id,{requestId:'deploy_0001',recovery:true}),loot=item('valuable',{value:150});
 const result=store.settle(dep.id,{outcome:'extract',items:[loot]});assert.deepEqual(result.overflow,[loot.id]);assert.equal(store.profile(id).credits,250);
 assert.equal(store.profile(id).overflow[0].id,loot.id);assert.throws(()=>store.trade(id,{type:'claimOverflow',itemId:loot.id}),/Stash full/);
 assert.throws(()=>store.deploy(id,{requestId:'deploy_0002',recovery:true}),/Resolve protected overflow/);
 store.trade(id,{type:'sell',itemId:store.profile(id).items.find(it=>it.kind==='med').id});store.trade(id,{type:'claimOverflow',itemId:loot.id});
 assert.equal(store.profile(id).overflow.length,0);assert.equal(store.profile(id).items.filter(it=>it.id===loot.id).length,1);
});
test('insurance waits for lost equipment, respects claims and cannot award twice',t=>{
 const {store,id}=setup(t),weapon=store.profile(id).items[0];
 const dep=store.deploy(id,{requestId:'deploy_0001',itemIds:[weapon.id],insureIds:[weapon.id]});assert.equal(store.profile(id).credits,230);
 store.settle(dep.id,{outcome:'death'});const future=Date.now()+200000;
 assert.equal(store.processInsurance(future),0);
 store.db.prepare("UPDATE inventory SET location='lost' WHERE id=?").run(weapon.id);
 assert.equal(store.processInsurance(future),1);assert.equal(store.processInsurance(future),0);
 assert.equal(store.profile(id).items.filter(it=>it.id===weapon.id).length,1);assert.equal(store.profile(id).insurance[0].status,'returned');
});
test('equipment claimed by another operator is permanently excluded from insurance',t=>{
 const {store,id}=setup(t),weapon=store.profile(id).items[0],other=store.register('looter','a long looter password').id;
 const dep=store.deploy(id,{requestId:'deploy_0001',itemIds:[weapon.id],insureIds:[weapon.id]});store.settle(dep.id,{outcome:'death'});
 store.claimLoot(weapon.id,other);store.db.prepare("UPDATE inventory SET location='lost' WHERE id=?").run(weapon.id);
 assert.equal(store.processInsurance(Date.now()+200000),0);assert.equal(store.profile(id).insurance[0].status,'claimed_by_other');
});
test('aborted insured deployment refunds its premium without an insurance payout',t=>{
 const {store,id}=setup(t),weapon=store.profile(id).items[0];const dep=store.deploy(id,{requestId:'deploy_0001',itemIds:[weapon.id],insureIds:[weapon.id]});
 store.settle(dep.id,{outcome:'aborted'});assert.equal(store.profile(id).credits,250);assert.equal(store.profile(id).insurance[0].status,'not_needed');
});
test('server reload consumes owned ammunition and weapon use persists wear',t=>{
 const store=new RaidStore(),id=store.register('reload','a long reload password').id;fixture(store,id,s=>s.items.push(item('ammo',{ammo:'medium',quantity:30})));
 let now=1000;const service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});
 const gear=store.profile(id).items.filter(it=>['weapon','ammo'].includes(it.kind)).map(it=>it.id);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',itemIds:gear});
 const p=service.byAccount.get(id),r=service.raids.get(p.raidId);r.machines=[];
 service.action(id,{type:'fire',seq:1});now+=1;service.action(id,{type:'reload',seq:2});
 assert.equal(p.ammo,30);assert.equal(p.equipment.find(it=>it.kind==='ammo').quantity,29);assert.ok(p.equipment.find(it=>it.kind==='weapon').condition<100);
 service.atomic(()=>service.end(r,p,'extract'));const saved=store.profile(id).items.find(it=>it.kind==='weapon');assert.ok(saved.condition<99);assert.equal(saved.loaded,30);
});
