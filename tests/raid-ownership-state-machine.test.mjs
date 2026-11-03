import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {compatibleStacks,stackable} from '../shared/raid-inventory.mjs';
import {maxStack} from '../shared/raid-catalog.mjs';
import {canRecoverGrant} from '../shared/raid-grants.mjs';
import {earnedPurchase} from './earned-fixture.mjs';
const inventory=store=>store.db.prepare('SELECT * FROM inventory ORDER BY id').all();
function mass(store){
 const totals={};for(const row of inventory(store))if(row.location!=='consumed'){
  const it=JSON.parse(row.payload),key=JSON.stringify(['kind','weapon','armor','medical','mod','ammo','material','utility','artifact','value','grantOwner','recovery'].map(k=>it[k]??null));
  totals[key]=(totals[key]||0)+it.quantity;
 }
 return Object.fromEntries(Object.entries(totals).sort(([a],[b])=>a.localeCompare(b)));
}
function ownership(store,service,accounts){
 const rows=new Map(inventory(store).map(r=>[r.id,r])),seen=new Set();
 const visit=(it,location,account,raid=null,deployment=null)=>{
  assert.ok(!seen.has(it.id),'a live item identity appears in two places');seen.add(it.id);
  assert.ok(Number.isSafeInteger(it.quantity)&&it.quantity>0&&it.quantity<=maxStack(it));
  const row=rows.get(it.id);assert.ok(row,'live item has a canonical row');assert.equal(row.location,location);assert.equal(row.account,account);assert.equal(row.raid,raid);assert.equal(row.deployment,deployment);assert.deepEqual(JSON.parse(row.payload),it);
  for(const child of it.attachments||[])visit(child,location==='raid'?'raid':'attached',account,raid,location==='raid'?deployment:it.id);
 };
 for(const account of accounts){const p=store.profile(account);for(const it of p.items)visit(it,'stash',account);for(const it of p.overflow)visit(it,'overflow',account);}
 for(const r of service.raids.values()){
  for(const p of r.players.values())if(p.alive||p.pending)for(const it of [...p.equipment,...p.pack,...p.secure])visit(it,'raid',p.account,r.id,p.deploymentId);
  for(const source of [...r.caches,...r.bags])for(const it of source.items)visit(it,'raid',null,r.id,null);
 }
 for(const row of rows.values())if(!['lost','consumed'].includes(row.location))assert.ok(seen.has(row.id),'a usable canonical item is orphaned');
}
for(const seed of [1,7,23,61,101,307,911,20261030])test('ownership/insurance state machine conserves item quantities through transfers, failures, replay and restart; seed '+seed,t=>{
 const store=new RaidStore();let now=1000,service=new RaidService(store,{now:()=>now}),randomState=seed;
 const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296),pick=values=>values[Math.floor(random()*values.length)];
 const accounts=[],insured=new Map(),claimed=new Set(),stats={};
 const fixtures=()=>{for(const r of service.raids.values()){r.world={...r.world,blocks:[],ramps:[],hazards:[]};r.machines=[];for(const c of r.caches)c.open=true}};
 try{
  for(let i=0;i<2;i++){
   const id=store.register('ownership_'+i,'a long ownership state machine password').id,gun=earnedPurchase(store,id),ammo=earnedPurchase(store,id,{sku:'ammo_medium'}),mod=earnedPurchase(store,id,{sku:'scope',trader:'engineer'});accounts.push(id);insured.set(gun.id,id);
   store.trade(id,{type:'attach',weaponId:gun.id,itemId:mod.id});
   service.deploy(id,{requestId:'ownership_deploy_'+i,mapId:'relay',itemIds:[gun.id,ammo.id],insureIds:[gun.id]});
  }
  fixtures();service.atomic(()=>{});const baseline=mass(store);
  const verify=()=>{assert.deepEqual(mass(store),baseline,'no operation creates, destroys or transmutes inventory quantity');ownership(store,service,accounts)};
  verify();
  for(let step=0;step<180;step++){
   now+=.01;if(step&&step%37===0){service.close();service=new RaidService(store,{now:()=>now});fixtures();stats.restart=(stats.restart||0)+1;verify();}
   const account=pick(accounts),p=service.byAccount.get(account),r=service.raids.get(p.raidId),all=[...p.equipment,...p.pack,...p.secure],choices=[{type:'move',x:0,z:0,yaw:0}];
   const split=all.filter(it=>stackable(it)&&it.quantity>1);if(split.length&&p.pack.length<p.cap){const it=pick(split);choices.push({type:'split',itemId:it.id,quantity:1+Math.floor(random()*(it.quantity-1))})}
   const drops=[...p.equipment,...p.pack].filter(it=>it.kind!=='armor');if(drops.length)choices.push({type:'drop',itemId:pick(drops).id});
   if(p.secure.length&&p.pack.length<p.cap)choices.push({type:'unsecure',itemId:pick(p.secure).id});
   const secure=p.pack.filter(it=>!it.recovery&&['valuable','key','material','med','mod'].includes(it.kind));if(secure.length&&p.secure.length<p.secureCap)choices.push({type:'secure',itemId:pick(secure).id});
   const pairs=p.pack.flatMap(a=>p.pack.filter(b=>compatibleStacks(a,b)&&a.quantity+b.quantity<=maxStack(b)).map(b=>[a,b]));if(pairs.length){const [a,b]=pick(pairs);choices.push({type:'stack',itemId:a.id,targetId:b.id})}
   const loot=[...r.caches,...r.bags].flatMap(source=>source.items.filter(it=>canRecoverGrant(it,account)).map(it=>({source,it})));if(loot.length&&p.pack.length<p.cap){const {source,it}=pick(loot);choices.push({type:'take',sourceId:source.id,itemId:it.id,...(stackable(it)&&it.quantity>1?{quantity:1+Math.floor(random()*it.quantity)}:{})})}
   const intent=pick(choices);if(intent.type==='take'){const source=[...r.caches,...r.bags].find(s=>s.id===intent.sourceId);Object.assign(p,{x:source.x,y:source.y||0,z:source.z})}
   const packet={...intent,seq:p.seq+1};
   if(step%29===0){
    const before=inventory(store),checkpoint=store.checkpoint;store.checkpoint=function(...args){checkpoint.apply(this,args);throw new Error('injected post-write checkpoint failure')};
    assert.throws(()=>service.action(account,packet),/injected post-write/);store.checkpoint=checkpoint;fixtures();assert.deepEqual(inventory(store),before);stats.rollback=(stats.rollback||0)+1;
   }else{
    let accepted=false;try{service.action(account,packet);accepted=true}catch(error){assert.equal(error.status,409,'only a deliberate rule guard may reject a generated action');stats.rejected=(stats.rejected||0)+1;}
    if(accepted){
     stats[intent.type]=(stats[intent.type]||0)+1;
     if(intent.type==='take'&&insured.has(intent.itemId)&&insured.get(intent.itemId)!==account)claimed.add(intent.itemId);
     if(random()<.3){const before=inventory(store);assert.equal(service.action(account,packet).duplicate,true);assert.deepEqual(inventory(store),before);stats.replay=(stats.replay||0)+1;}
    }
   }
   verify();
   if(step%17===0){const other=accounts.find(id=>id!==account),foreign=store.profile(other).items[0],current=service.byAccount.get(account),before=mass(store);assert.throws(()=>service.action(account,{type:'drop',seq:current.seq+1,itemId:foreign.id}),/protected|owned/);assert.deepEqual(mass(store),before);verify();}
  }
  const returned=new Set();for(let i=0;i<accounts.length;i++){const p=service.byAccount.get(accounts[i]),r=service.raids.get(p.raidId),outcome=i?'death':'extract';if(!i)for(const it of [...p.equipment,...p.pack,...p.secure])returned.add(it.id);service.atomic(()=>service.end(r,p,outcome));verify();}
  assert.equal(store.processInsurance(Date.now()+1000000),0,'gear still in a live raid cannot return');
  now=Math.max(...[...service.raids.values()].map(r=>r.deadline))+121;service.tick();verify();
  const expected=[...insured].filter(([id])=>!claimed.has(id)&&!returned.has(id)).length;
  assert.equal(store.processInsurance(Date.now()+1000000),expected);assert.equal(store.processInsurance(Date.now()+1000000),0);verify();
  for(const [id,owner]of insured){const claim=store.profile(owner).insurance.find(c=>c.item===id);assert.equal(claim.status,claimed.has(id)?'claimed_by_other':returned.has(id)?'not_needed':'returned');}
  assert.ok(['split','drop','take','secure','unsecure','stack','rollback','replay','restart'].every(key=>stats[key]>0),'seed exercised the complete transfer/recovery matrix');
  t.diagnostic(JSON.stringify({seed,steps:180,...stats}));
 }finally{service.close();store.close()}
});
