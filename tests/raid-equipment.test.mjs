import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore,item} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
function setup(t){const store=new RaidStore();let now=1000;const service=new RaidService(store,{now:()=>now});t.after(()=>{service.close();store.close()});const {id}=store.register('equipment','a long equipment password');return {store,service,id,advance:n=>{now+=n;service.tick(.05)}}}
function fixture(s,fn){s.store.transaction(()=>{const state=s.store.state(s.id);fn(state);s.store.save(s.id,state)})}
test('redeployment never refills an owned magazine',t=>{
 const s=setup(t),{store,service,id,advance}=s,weapon=store.profile(id).items[0];
 service.deploy(id,{requestId:'deploy_0001',mapId:'relay',itemIds:[weapon.id]});const p=service.byAccount.get(id),r=service.raids.get(p.raidId);r.machines=[];
 for(let seq=1;seq<=3;seq++){service.action(id,{type:'fire',seq});advance(.2)}
 service.atomic(()=>service.end(r,p,'extract'));service.deploy(id,{requestId:'deploy_0002',mapId:'relay',itemIds:[weapon.id]});
 assert.equal(service.snapshot(id).self.ammo,27);
});
test('reload without compatible ammunition cannot create rounds',t=>{
 const {service,id}=setup(t);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});service.action(id,{type:'fire',seq:1});
 const p=service.byAccount.get(id);p.nextFire=0;
 assert.throws(()=>service.action(id,{type:'reload',seq:2}),/No compatible/);
 assert.equal(service.snapshot(id).self.ammo,29);
});
test('stack merge conserves quantity and consumes the source item identity',t=>{
 const {service,store,id}=setup(t);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),a=item('ammo',{ammo:'medium',quantity:20}),b=item('ammo',{ammo:'medium',quantity:30});service.atomic(()=>{p.pack.push(a,b)});
 service.action(id,{type:'stack',itemId:a.id,targetId:b.id,seq:1});
 assert.equal(p.pack.length,1);assert.equal(p.pack[0].quantity,50);assert.equal(store.db.prepare('SELECT location FROM inventory WHERE id=?').get(a.id).location,'consumed');
});
test('oversized merges and protected ammunition are rejected without losing items',t=>{
 const {service,id}=setup(t);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),a=item('ammo',{ammo:'medium',quantity:150}),b=item('ammo',{ammo:'medium',quantity:100});service.atomic(()=>p.pack.push(a,b));
 assert.throws(()=>service.action(id,{type:'stack',itemId:a.id,targetId:b.id,seq:1}),/Stack limit/);
 assert.throws(()=>service.action(id,{type:'secure',itemId:a.id,seq:2}),/cannot be protected/);
 assert.equal(service.snapshot(id).self.pack.reduce((n,it)=>n+it.quantity,0),250);
});
test('spawn protection expires and firing cancels it immediately',t=>{
 const {service,id,advance}=setup(t);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),r=service.raids.get(p.raidId);r.machines=[];service.atomic(()=>service.damage(r,p,20));assert.equal(p.hp,100);
 service.action(id,{type:'fire',seq:1});service.atomic(()=>service.damage(r,p,20));assert.equal(p.hp,80);advance(6);
 service.atomic(()=>service.damage(r,p,20));assert.equal(p.hp,60);
});
test('suppressors reduce investigation range without allowing AI to see through walls',t=>{
 const {service,id,advance}=setup(t);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});
 const p=service.byAccount.get(id),r=service.raids.get(p.raidId);r.world={...r.world,blocks:[[0,0,2,10,4]]};p.x=-10;p.z=0;p.yaw=Math.PI/2;
 const machine={id:'listener',x:10,z:0,hp:80,kind:'scout',nextAttack:0};r.machines=[machine];
 service.action(id,{type:'fire',seq:1});advance(.05);assert.ok(machine.investigate);assert.equal(p.hp,100);
 machine.investigate=null;r.noises=[];p.nextFire=0;service.currentWeapon(p).attachments.push(item('mod',{mod:'suppressor'}));
 service.action(id,{type:'fire',seq:2});advance(.05);assert.equal(machine.investigate,null);assert.equal(p.hp,100);
});
test('boss kills and exploration facts advance only server-backed contracts',t=>{
 const {store,service,id}=setup(t);store.trade(id,{type:'contract',contract:'warden',operation:'accept'});
 service.deploy(id,{requestId:'deploy_0001',mapId:'relay',recovery:true});const p=service.byAccount.get(id),r=service.raids.get(p.raidId);p.x=-48;p.z=0;p.yaw=0;
 r.machines=[{id:'boss',x:-48,z:10,hp:1,kind:'overlord'}];service.action(id,{type:'fire',seq:1});
 service.atomic(()=>service.end(r,p,'extract'));assert.equal(store.profile(id).contracts.warden.progress,1);
 const before=store.profile(id).credits;store.trade(id,{type:'contract',contract:'warden',operation:'claim'});assert.equal(store.profile(id).credits,before+150);
 assert.throws(()=>store.trade(id,{type:'contract',contract:'warden',operation:'claim'}),/No active contract/);
});
test('bulk sale protects favorites and is atomic across the whole selection',t=>{
 const {store,id}=setup(t),profile=store.profile(id);store.trade(id,{type:'favorite',itemId:profile.items[0].id,favorite:true});
 assert.throws(()=>store.trade(id,{type:'bulkSell',itemIds:profile.items.map(it=>it.id)}),/favorited/);
 assert.equal(store.profile(id).items.length,4);assert.equal(store.profile(id).credits,250);
});
test('insurance selection cannot insure equipment outside the committed loadout',t=>{
 const {store,id}=setup(t),profile=store.profile(id);
 assert.throws(()=>store.deploy(id,{requestId:'deploy_0001',itemIds:[profile.items[0].id],insureIds:[profile.items[1].id]}),/owned deployed/);
 assert.equal(store.profile(id).items.length,4);assert.equal(store.profile(id).credits,250);assert.equal(store.profile(id).insurance.length,0);
});
test('death report reconciles protected returns and dropped items without mutable aliases',t=>{
 const {store,service,id}=setup(t),gear=store.profile(id).items.map(it=>it.id);service.deploy(id,{requestId:'deploy_0001',mapId:'relay',itemIds:gear});
 const p=service.byAccount.get(id),r=service.raids.get(p.raidId),protectedItem=item('material',{material:'steel',quantity:2}),loot=item('valuable',{value:30});
 service.atomic(()=>{p.secure.push(protectedItem);p.pack.push(loot);service.end(r,p,'death')});
 assert.equal(p.result.items.length,1);assert.equal(p.result.items[0].id,protectedItem.id);assert.equal(p.result.lostItems.length,5);assert.equal(store.profile(id).items.length,1);
 const recorded=p.result.lostItems[0].condition;r.bags[0].items[0].condition=1;assert.equal(p.result.lostItems[0].condition,recorded);
 assert.equal(store.results(id)[0].lostItems.length,5);
});
