// In-memory store adapter for the static-Pages offline raid.
//
// This module is the browser/Node-safe counterpart to server/store.mjs: it has no
// node:sqlite, node:fs or node:crypto imports and exposes the store contract the
// authoritative RaidService needs. Slice 3 covers construction, the guest account
// and profile/stash derivation; deployments and checkpoints land in slice 4, and
// IndexedDB/localStorage persistence in slices 11-12. Offline mode runs the same
// RaidService rule code, not a client-trusted shortcut.
import {randomUUID} from './raid-crypto.mjs';
import {item,RuleError,requireRule} from './raid-rules.mjs';
import {bindGrant,grantBalance,canRecoverGrant,spendCredits,awardCredits,clearForeignGrantAmmo,patchTarget,repairCost} from './raid-grants.mjs';
import {sellValue} from './raid-appraisal.mjs';
import {rankProgress} from './raid-progression.mjs';
import {squadLinkBonus} from './raid-exits.mjs';
import {outcomeReason} from './raid-report.mjs';
import {compatibleStacks,recyclingQuote,stackable} from './raid-inventory.mjs';
import {WEAPONS,MODS,armorStats,equipmentPrice,maxStack,itemWeight,stashCapacity,RECIPES,CONTRACTS} from './raid-catalog.mjs';
import {contractItemReserved} from './raid-sectors.mjs';

const STARTER_CREDITS=250;
const flatten=items=>items.flatMap(it=>[it,...flatten(it.attachments||[])]);
// Same starter kit the Node register grants a new account. Keeping it bound to
// the guest is what makes offline deployment/extraction match the online rules;
// "empty" here means no raid-earned loot or prior deployment, not no equipment.
const starterItems=account=>[item('weapon',{weapon:'ar'}),item('armor'),item('med'),item('med')]
  .map(it=>bindGrant(it,account,true));
const freshState=()=>({
  credits:STARTER_CREDITS,
  grantCredits:STARTER_CREDITS,
  materials:{steel:0,wire:0,chem:0,fuel:0},
  upgrades:{stash:0,bay:0},
  revision:0,
});

export class MemoryRaidStore {
  constructor({maxAudit=500}={}){
    this.accounts=new Map();
    this.byUsername=new Map();
    this.inventory=new Map();
    this.deployments=new Map();
    this.requests=new Map();
    this.insurance=new Map();
    this.checkpoints=new Map();
    this.leases=new Map();
    this.auditLog=[];
    this.maxAudit=maxAudit;
    this.depth=0;
    this.commitSerial=0;
    this.deploymentSerial=0;
  }

  close(){this.leases.clear();this.depth=0}

  // Browser persistence snapshots. Maps are flattened to entry arrays because
  // that is the shape IndexedDB/localStorage backends portably clone; nothing
  // here decides raid rules, it only carries the in-memory state across reloads.
  exportState(){
    return structuredClone({
      version:1,
      accounts:[...this.accounts.entries()],
      byUsername:[...this.byUsername.entries()],
      inventory:[...this.inventory.entries()],
      deployments:[...this.deployments.entries()],
      requests:[...this.requests.entries()],
      insurance:[...this.insurance.entries()],
      checkpoints:[...this.checkpoints.entries()],
      commitSerial:this.commitSerial,
      deploymentSerial:this.deploymentSerial,
      auditLog:this.auditLog,
    });
  }

  importState(snapshot){
    requireRule(snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot),'Invalid persisted raid state',500);
    requireRule(snapshot.version===1,'Unsupported persisted raid state version',500);
    const entries=name=>{
      requireRule(Array.isArray(snapshot[name]),'Persisted raid state is missing '+name,500);
      return snapshot[name].map(entry=>{
        requireRule(Array.isArray(entry)&&entry.length===2,'Persisted raid state has a malformed '+name,500);
        return entry;
      });
    };
    // Validate and clone every section before touching live maps. A rejected
    // snapshot leaves the store exactly as it was, so partial persisted state
    // never leaks into an otherwise fresh runtime.
    const sections={};
    for(const name of ['accounts','byUsername','inventory','deployments','requests','insurance','checkpoints'])sections[name]=entries(name);
    const commitSerial=Number.isSafeInteger(snapshot.commitSerial)?snapshot.commitSerial:0;
    const deploymentSerial=Number.isSafeInteger(snapshot.deploymentSerial)?snapshot.deploymentSerial:0;
    const auditLog=Array.isArray(snapshot.auditLog)?structuredClone(snapshot.auditLog):[];
    if(auditLog.length>this.maxAudit)auditLog.splice(0,auditLog.length-this.maxAudit);
    this.resetState();
    for(const [name,list]of Object.entries(sections))this[name]=new Map(structuredClone([...list]));
    this.commitSerial=commitSerial;
    this.deploymentSerial=deploymentSerial;
    this.auditLog=auditLog;
    return this;
  }

  // Drop every piece of persisted state and return to a clean in-memory store.
  // Persistence recovery calls this when a snapshot cannot be trusted.
  resetState(){
    this.accounts=new Map();
    this.byUsername=new Map();
    this.inventory=new Map();
    this.deployments=new Map();
    this.requests=new Map();
    this.insurance=new Map();
    this.checkpoints=new Map();
    this.commitSerial=0;
    this.deploymentSerial=0;
    this.auditLog=[];
    return this;
  }

  transaction(fn){
    this.depth++;
    try{const value=fn();if(this.depth===1)this.commitSerial++;return value}
    finally{this.depth--}
  }

  acquireLease(owner,now=Date.now(),ttl=15000){
    return this.transaction(()=>{
      const lease=this.leases.get('simulation');
      requireRule(!lease||lease.owner===owner||lease.expires<=now,'Another simulation process owns this store');
      this.leases.set('simulation',{owner,expires:now+ttl});
      return true;
    });
  }

  releaseLease(owner){
    if(this.leases.get('simulation')?.owner===owner)this.leases.delete('simulation');
  }

  loadRaids(){
    return [...this.checkpoints.values()].map(raid=>structuredClone(raid));
  }

  // Checkpoint the raid and canonically record every item it holds as location
  // 'raid' (online does the same), so settlement can prove ownership and a
  // dead operator's gear can become 'lost' for insurance processing.
  checkpoint(raid){
    this.checkpoints.set(raid.id,structuredClone(raid));
    const seen=new Set();
    const record=(it,account,deployment)=>{
      requireRule(!seen.has(it.id),'Duplicate item in active raid');
      seen.add(it.id);
      const old=this.inventory.get(it.id);
      // A deadly settlement marks the operator's dropped gear lost immediately
      // (offline has no later raid-cleanup pass), so a surviving bag copy is stale
      // rather than an ownership violation.
      if(old&&old.location!=='raid'&&old.raid===raid.id)return;
      requireRule(!old||(old.location==='raid'&&(!old.raid||old.raid===raid.id)),'Raid item is already banked, consumed, or in another raid');
      const current=old?{account:old.account,deployment:old.deployment,payload:old.payload}:null;
      if(!current||old.raid!==raid.id||current.account!==account||current.deployment!==deployment||JSON.stringify(current.payload)!==JSON.stringify(it))
        this.inventory.set(it.id,{account,location:'raid',deployment,raid:raid.id,payload:structuredClone(it)});
      for(const child of it.attachments||[])record(child,account,deployment);
    };
    for(const p of raid.players)if(p.alive||p.pending)for(const it of [...p.equipment,...p.pack,...p.secure,...(p.pending?.items||[])])record(it,p.account,p.deploymentId);
    for(const container of [...(raid.caches||[]),...(raid.bags||[])])for(const it of container.items||[])record(it,null,null);
    for(const [id,entry]of this.inventory)if(entry.raid===raid.id&&entry.location==='raid'&&!seen.has(id)){entry.location='consumed';entry.account=null;entry.payload=null}
  }

  recoverInterrupted(retained=new Set()){
    let count=0;
    for(const deployment of [...this.deployments.values()]){
      if(deployment.active&&!retained.has(deployment.id)){this.settle(deployment.id,{outcome:'aborted'});count++}
    }
    return count;
  }

  // Offline sessions are passwordless: the first guest is created automatically
  // and repeated calls with the same name reuse it. Accounts are lowercase to
  // match the online register rules.
  createGuest(username='guest'){
    const name=String(username??'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,24)||'guest';
    const existing=this.byUsername.get(name);
    if(existing)return {id:existing,username:name};
    const id=randomUUID(),state=freshState();
    this.accounts.set(id,{id,username:name,state});
    this.byUsername.set(name,id);
    this.save(id,{...state,items:starterItems(id)});
    this.audit(id,'account_created',{guest:true});
    return {id,username:name};
  }

  account(id){
    const row=this.accounts.get(id);
    requireRule(row,'Unknown account',404);
    return row;
  }

  state(id){
    const row=this.account(id);
    const state=structuredClone(row.state);
    state.grantCredits=grantBalance(state);
    state.items=[];
    for(const entry of this.inventory.values()){
      if(entry.account===id&&entry.location==='stash'&&entry.payload)state.items.push(structuredClone(entry.payload));
    }
    return {
      ...state,
      xp:state.xp||0,
      reputation:{outfitter:0,medic:0,engineer:0,...state.reputation},
      contracts:state.contracts||{},
      presets:state.presets||{},
      upgrades:{stash:0,bay:0,bench:0,...state.upgrades},
    };
  }

  save(id,state){
    const row=this.account(id);
    state.grantCredits=grantBalance(state);
    const ids=new Set(state.items.map(it=>it.id));
    requireRule(ids.size===state.items.length,'Duplicate stash items');
    for(const [itemId,entry] of this.inventory){
      if(entry.account===id&&entry.location==='stash'&&!ids.has(itemId)){entry.location='consumed';entry.account=null;entry.payload=null}
    }
    for(const it of state.items){
      requireRule(canRecoverGrant(it,id),'Starter supplies belong to another operator');
      const existing=this.inventory.get(it.id);
      requireRule(!existing||(existing.account===id&&existing.location==='stash'),'Item is not available in this stash');
      this.inventory.set(it.id,{account:id,location:'stash',deployment:null,raid:null,payload:structuredClone(it)});
    }
    state.revision=(state.revision||0)+1;
    const {items,...metadata}=state;
    row.state=metadata;
  }

  activeDeployment(id){
    for(const deployment of this.deployments.values())if(deployment.active&&deployment.account===id)return deployment;
    return null;
  }

  preflightLoadout(account,loadout={}){
    requireRule(loadout&&typeof loadout==='object'&&!Array.isArray(loadout),'Invalid ready loadout',400);
    const {itemIds=[],recovery=false,insureIds=[]}=loadout;
    requireRule(typeof recovery==='boolean','Invalid recovery selection',400);
    requireRule(Array.isArray(itemIds)&&itemIds.length<=8&&itemIds.every(id=>typeof id==='string')&&new Set(itemIds).size===itemIds.length,'Invalid equipment list',400);
    requireRule(Array.isArray(insureIds)&&insureIds.length<=3&&insureIds.every(id=>typeof id==='string')&&new Set(insureIds).size===insureIds.length,'Invalid insurance selection',400);
    requireRule(!this.activeDeployment(account),'An account can enter only one raid at a time');
    requireRule(![...this.inventory.values()].some(entry=>entry.account===account&&entry.location==='overflow'),'Resolve protected overflow storage before deploying again');
    const state=this.state(account);
    let equipment=[];
    if(recovery)requireRule(itemIds.length===0&&insureIds.length===0,'Recovery kits cannot include paid gear or insurance');
    else{
      equipment=itemIds.map(id=>state.items.find(it=>it.id===id));
      requireRule(equipment.every(Boolean),'Equipment is not owned or is already deployed');
      requireRule(equipment.filter(it=>it.kind==='weapon').length>=1&&equipment.filter(it=>it.kind==='weapon').length<=2,'Equip one or two weapons');
      requireRule(equipment.filter(it=>it.kind==='armor').length<=1,'Equip at most one armor item');
      requireRule(equipment.every(it=>['weapon','armor','med','key','ammo','mod','material','utility'].includes(it.kind)&&it.condition>0),'Broken or invalid equipment');
      requireRule(equipment.every(it=>Number.isSafeInteger(it.quantity)&&it.quantity>0&&it.quantity<=maxStack(it)),'Invalid equipment stack');
      requireRule(equipment.reduce((n,it)=>n+itemWeight(it),0)<=40,'Deployment weight limit exceeded');
    }
    const insured=insureIds.map(id=>equipment.find(it=>it.id===id&&['weapon','armor'].includes(it.kind)&&!it.recovery));
    requireRule(insured.every(Boolean),'Insurance requires owned deployed equipment');
    const premium=insured.reduce((sum,it)=>sum+Math.ceil(equipmentPrice(it)*.2),0);requireRule(state.credits>=premium,'Insufficient insurance credits');
    return {state,equipment,insured,premium};
  }

  deploy(account,{requestId,itemIds=[],recovery=false,insureIds=[]}={}){
    requireRule(typeof requestId==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(requestId),'Invalid deployment request ID',400);
    return this.transaction(()=>{
      const key=account+':'+requestId,oldId=this.requests.get(key),old=oldId&&this.deployments.get(oldId);
      if(old)return {id:old.id,active:!!old.active,...structuredClone(old.state),result:old.result?structuredClone(old.result):null};
      const {state,insured,premium,equipment:owned}=this.preflightLoadout(account,{itemIds,recovery,insureIds});
      const equipment=recovery?[item('weapon',{weapon:'ar',recovery:true}),item('med',{recovery:true})]:owned.slice();
      if(!recovery)state.items=state.items.filter(it=>!itemIds.includes(it.id));
      const premiumGrant=spendCredits(state,premium);
      const id=randomUUID(),deployment={equipment,recovery,premium,premiumGrant,insureIds,created:Date.now()};
      for(const it of insured)this.insurance.set(randomUUID(),{account,item:it.id,deployment:id,status:'covered',due:null,premium:Math.ceil(equipmentPrice(it)*.2)});
      for(const it of flatten(equipment))this.inventory.set(it.id,{account,location:'raid',deployment:id,raid:null,payload:structuredClone(it)});
      const record={id,account,requestId,active:true,state:structuredClone(deployment),result:null,serial:++this.deploymentSerial};
      this.deployments.set(id,record);this.requests.set(key,id);
      this.save(account,state);
      this.audit(account,'deployment_committed',{deployment:id,itemIds:equipment.map(it=>it.id),recovery});
      return {id,active:true,...deployment};
    });
  }

  settle(deploymentId,{outcome,items=[],credits=0,facts={},lostItems=[],reason=null,raid=null}={}){
    requireRule(['extract','death','timeout','disconnect','aborted'].includes(outcome),'Invalid outcome',400);
    requireRule(Number.isSafeInteger(credits)&&credits>=0,'Invalid rewards',400);
    return this.transaction(()=>{
      const row=this.deployments.get(deploymentId);requireRule(row,'Unknown deployment',404);
      if(row.result)return structuredClone(row.result);
      requireRule(new Set(items.map(it=>it.id)).size===items.length&&items.every(it=>typeof it.id==='string'&&it.quantity>0),'Invalid item settlement');
      const account=row.account,state=this.state(account),deployed=structuredClone(row.state),balanceBefore={total:state.credits,starter:grantBalance(state)},xpBefore=state.xp||0;
      // Read the authoritative payload, remove foreign starter ammo and never
      // let an aborted deployment claim gear that already left the raid.
      const returned=(outcome==='aborted'?deployed.equipment.filter(it=>!it.recovery&&this.inventory.get(it.id)?.location==='raid'):items.filter(it=>!it.recovery)).map(it=>{
        const copy=clearForeignGrantAmmo(structuredClone(it),account),removed=(it.grantLoaded||0)-(copy.grantLoaded||0);
        if(removed>0)this.audit(account,'starter_ammo_removed',{itemId:it.id,rounds:removed,reason:'foreign_settlement'});
        return copy;
      });
      const returnedIds=new Set(returned.map(it=>it.id)),overflow=[];
      for(const it of returned){
        requireRule(canRecoverGrant(it,account),'Starter supplies belong to another operator');
        const existing=this.inventory.get(it.id);
        requireRule(!existing||existing.location==='raid','Item already owned or consumed');
        requireRule(!state.items.some(x=>x.id===it.id),'Item already in stash');
        const location=state.items.length<stashCapacity(state)?'stash':'overflow';if(location==='overflow')overflow.push(it.id);
        this.inventory.set(it.id,{account,location,deployment:null,raid:null,payload:structuredClone(it)});
        for(const child of flatten(it.attachments||[])){
          const old=this.inventory.get(child.id);requireRule(!old||old.location==='raid','Attachment already owned or consumed');
          this.inventory.set(child.id,{account,location:'attached',deployment:it.id,raid:null,payload:structuredClone(child)});
        }
        if(location==='stash')state.items.push(it);
      }
      // Non-returned raid gear becomes lost, the same canonical state online
      // insurance waits for after raid cleanup.
      const lostGear=[];
      for(const [itemId,entry]of this.inventory)if(entry.account===account&&entry.deployment===deploymentId&&entry.location==='raid'&&!returnedIds.has(itemId)){
        lostGear.push(structuredClone(entry.payload));entry.location='lost';entry.account=null;
      }
      if(outcome==='aborted'){awardCredits(state,(deployed.premium||0)-(deployed.premiumGrant||0));awardCredits(state,deployed.premiumGrant||0,{grant:true})}else awardCredits(state,credits);
      const objectiveXp=facts.objective?.completed?(facts.objective.rewardXp||0):0;
      const xp=outcome==='aborted'?0:(outcome==='extract'?20:0)+objectiveXp+(outcome==='extract'?squadLinkBonus(facts.squadLink||0,'xp'):0)+Math.min(50,(facts.machines||0)*5+(facts.explorations||[]).length*3);
      state.xp=(state.xp||0)+xp;
      const previousContracts=structuredClone(state.contracts);this.applyContractFacts(state,facts);
      const contracts=Object.entries(state.contracts).filter(([id,p])=>p.progress>(previousContracts[id]?.progress||0)).map(([id,p])=>{const definition=CONTRACTS[id],stage=definition?.stages[p.stage];return {id,name:definition?.name||id,stage:p.stage,progress:p.progress,need:stage?.need||0,delta:p.progress-(previousContracts[id]?.progress||0),requirementsMet:!!stage&&p.progress>=stage.need}});
      const claims=[...this.insurance.values()].filter(claim=>claim.deployment===deploymentId&&claim.account===account);
      for(const claim of claims){claim.status=outcome==='aborted'?'not_needed':'pending';claim.due=outcome==='aborted'?null:Date.now()+120000;if(returnedIds.has(claim.item))claim.status='not_needed'}
      const insuranceAtSettlement=claims.map(claim=>{const it=deployed.equipment.find(entry=>entry.id===claim.item);return {id:claim.id,item:claim.item,status:claim.status,due:claim.due,premium:claim.premium,label:WEAPONS[it?.weapon]?.name||(it?.kind==='armor'?armorStats(it).name:'Equipment')}});
      const beforeRank=rankProgress(xpBefore),afterRank=rankProgress(state.xp);
      const progression={xpBefore,xpAfter:state.xp,rankBefore:beforeRank.level,rankAfter:afterRank.level,rankName:afterRank.name,unlockedBlueprints:Object.values(RECIPES).filter(recipe=>recipe.rank>beforeRank.level&&recipe.rank<=afterRank.level).map(recipe=>recipe.name)};
      const result={progression,reportVersion:1,reason:outcomeReason(outcome,reason),raid,ledger:{scope:'settlement',before:balanceBefore,after:{total:state.credits,starter:grantBalance(state)},reward:outcome==='aborted'?0:credits,refund:outcome==='aborted'?(deployed.premium||0):0,refundStarter:outcome==='aborted'?(deployed.premiumGrant||0):0,premium:deployed.premium||0,premiumStarter:deployed.premiumGrant||0},insuranceAtSettlement,committedItems:structuredClone(deployed.equipment),id:randomUUID(),deploymentId,outcome,items:returned,overflow,lostItems:outcome==='aborted'?[]:structuredClone(lostItems),credits:outcome==='aborted'?0:credits,insurancePremium:deployed.premium||0,refund:outcome==='aborted'?(deployed.premium||0):0,xp,facts,contracts,at:Date.now()};
      row.active=false;row.result=structuredClone(result);
      this.save(account,state);
      this.audit(account,'raid_settled',result);
      return result;
    });
  }

  applyContractFacts(state,facts){
    for(const [id,progress]of Object.entries(state.contracts)){
      if(progress.completed)continue;
      const stage=CONTRACTS[id]?.stages[progress.stage];if(!stage)continue;
      if(stage.event==='explore'){
        const seen=new Set(progress.seen||[]);
        for(const name of facts.explorations||[])if(!stage.map||name.startsWith(stage.map+':'))seen.add(name);
        progress.seen=[...seen];progress.progress=Math.min(stage.need,seen.size);
      }else{
        const count={machine:stage.map?facts.mapMachines?.[stage.map]||0:facts.machines||0,extractArtifact:facts.artifacts?.[stage.artifact]||0,extractBoss:facts.extractBoss||0,extractKey:facts.extractKey||0,extractValuable:facts.extractValuable||0}[stage.event]||0;
        progress.progress=Math.min(stage.need,progress.progress+count);
      }
    }
  }

  processInsurance(now=Date.now()){
    return this.transaction(()=>{
      let count=0;
      for(const claim of this.insurance.values()){
        if(claim.status!=='pending'||claim.due>now)continue;
        const entry=this.inventory.get(claim.item);
        if(entry?.location==='raid')continue;
        if(!entry||entry.location!=='lost'){claim.status='unavailable';continue}
        const it=structuredClone(entry.payload);
        if(!it||it.condition<=0||it.recovery){claim.status='destroyed';continue}
        const state=this.state(claim.account),location=state.items.length<stashCapacity(state)?'stash':'overflow';
        this.inventory.set(it.id,{account:claim.account,location,deployment:null,raid:null,payload:it});
        if(location==='stash')state.items.push(it);
        for(const child of flatten(it.attachments||[]))this.inventory.set(child.id,{account:claim.account,location:'attached',deployment:it.id,raid:null,payload:structuredClone(child)});
        this.save(claim.account,state);claim.status='returned';
        this.audit(claim.account,'insurance_returned',{claim:claim.id,item:it.id,location});
        count++;
      }
      return count;
    });
  }

  // Online parity for loot ownership: when any operator picks up an item, every
  // other account's live insurance claim on that item is invalidated. This runs
  // inside RaidService.takeLoot and must exist offline for `take` to settle.
  claimLoot(itemId,account){
    for(const claim of this.insurance.values())if(claim.item===itemId&&claim.account!==account&&['covered','pending'].includes(claim.status))claim.status='claimed_by_other';
  }

  // Base economy parity with server/store.mjs.trade. Crafting, damage repair,
  // workbench/storage upgrades and stash transfers use the same catalog rules as
  // the hosted store, so the static client cannot mint items or bypass costs.
  // Online-only authorities (traders, contracts) remain explicit stubs.
  consumeMaterials(s,requirements,{earnedOnly=false}={}){
    const sources=s.items.filter(it=>it.kind==='material'&&(!earnedOnly||!it.grantOwner))
      .sort((a,b)=>Number(!!a.grantOwner)-Number(!!b.grantOwner));
    let bound=false;
    for(const [material,amount]of Object.entries(requirements)){
      requireRule(sources.filter(it=>it.material===material).reduce((n,it)=>n+it.quantity,0)>=amount,'Missing '+(earnedOnly?'earned ':'')+material+' salvage');
    }
    for(const [material,amount]of Object.entries(requirements)){
      let remaining=amount;
      for(const it of sources)if(it.material===material&&remaining>0){
        const n=Math.min(it.quantity,remaining);it.quantity-=n;remaining-=n;if(n&&it.grantOwner)bound=true;
      }
    }
    s.items=s.items.filter(it=>it.quantity>0);
    return bound;
  }

  addItem(s,it){requireRule(s.items.length<stashCapacity(s),'Stash full; sell, recycle or expand storage');s.items.push(it)}

  trade(account,action){
    return this.transaction(()=>{
      const s=this.state(account);
      requireRule(!this.activeDeployment(account),'Return from your raid before trading');
      if(action.expectedRevision!==undefined){
        requireRule(Number.isSafeInteger(action.expectedRevision)&&action.expectedRevision===s.revision,'Stash changed; review the refreshed balance and try again');
      }
      if(['split','stack'].includes(action.type)){
        requireRule(Number.isSafeInteger(action.expectedRevision)&&action.expectedRevision===s.revision,'Stash changed; refresh before moving stacks');
        const source=s.items.find(it=>it.id===action.itemId);
        requireRule(source,'Item not owned');
        if(action.type==='split'){
          requireRule(stackable(source)&&Number.isSafeInteger(action.quantity)&&action.quantity>0&&action.quantity<source.quantity&&source.quantity<=maxStack(source),'Invalid split quantity');
          requireRule(s.items.length<stashCapacity(s),'Stash full');
          const child={...structuredClone(source),id:randomUUID(),quantity:action.quantity,splitFrom:source.splitFrom||source.id};
          source.quantity-=action.quantity;s.items.push(child);
          this.audit(account,'stash_transfer',{kind:'split',itemId:source.id,childId:child.id,quantity:child.quantity});
        }else{
          const target=s.items.find(it=>it.id===action.targetId);
          requireRule(compatibleStacks(source,target),'Incompatible stacks');
          requireRule(source.quantity+target.quantity<=maxStack(target),'Stack limit exceeded');
          const quantity=source.quantity;
          target.quantity+=quantity;target.favorite=!!(target.favorite||source.favorite);
          s.items=s.items.filter(it=>it!==source);
          this.audit(account,'stash_transfer',{kind:'stack',itemId:source.id,targetId:target.id,quantity});
        }
      }else if(action.type==='favorite'){
        const it=s.items.find(it=>it.id===action.itemId);requireRule(it,'Item not owned');it.favorite=!!action.favorite;
      }else if(action.type==='sell'){
        const i=s.items.findIndex(it=>it.id===action.itemId&&!it.recovery);requireRule(i>=0,'Item not owned');
        const it=s.items[i];
        requireRule(!it.favorite||action.confirmFavorite===true,'Unfavorite this item before selling');
        requireRule(!contractItemReserved(s,it),'Contract item reserved: deliver it or complete its contract before selling');
        s.items.splice(i,1);awardCredits(s,sellValue(it),{grant:!!it.grantOwner});
        for(const child of flatten(it.attachments||[]))this.inventory.delete(child.id);
      }else if(action.type==='bulkSell'){
        requireRule(Array.isArray(action.itemIds)&&action.itemIds.length>0&&action.itemIds.length<=64&&new Set(action.itemIds).size===action.itemIds.length,'Choose a valid item selection');
        const sold=action.itemIds.map(id=>s.items.find(it=>it.id===id&&!it.favorite&&!it.recovery));
        requireRule(sold.every(Boolean),'Selection contains unowned or favorited items');
        requireRule(sold.every(it=>!contractItemReserved(s,it)),'Selection contains reserved contract items');
        for(const it of sold){
          awardCredits(s,sellValue(it),{grant:!!it.grantOwner});
          for(const child of flatten(it.attachments||[]))this.inventory.delete(child.id);
        }
        s.items=s.items.filter(it=>!action.itemIds.includes(it.id));
      }else if(action.type==='repair'){
        const it=s.items.find(it=>it.id===action.itemId&&['weapon','armor'].includes(it.kind));requireRule(it,'Equipment not owned');
        const quality=action.quality||'full';requireRule(['full','patch'].includes(quality),'Unknown repair quality',400);
        const target=quality==='patch'?patchTarget(it):100;
        requireRule(target>it.condition,'Repair unavailable');
        const cost=repairCost(s,it,target);requireRule(cost>0&&s.credits>=cost,'Repair unavailable');
        const before=it.condition,bound=this.consumeMaterials(s,quality==='patch'?{wire:1}:{steel:1}),grant=spendCredits(s,cost);
        if(bound||grant)it.grantOwner=account;
        it.condition=target;
        this.audit(account,'equipment_repair',{itemId:it.id,quality,from:before,to:target,credits:cost,grant:!!grant||bound});
      }else if(action.type==='craft'){
        requireRule(Object.hasOwn(RECIPES,action.recipe),'Unknown recipe');
        const recipe=RECIPES[action.recipe];
        requireRule(rankProgress(s.xp||0).level>=(recipe.rank||1),'Earn rank '+(recipe.rank||1)+' to unlock this blueprint');
        requireRule((s.upgrades.bench||0)>=(recipe.bench||0),'Upgrade the workbench for this recipe');
        requireRule(s.credits>=recipe.credits,'Insufficient credits');
        const bound=this.consumeMaterials(s,recipe.materials),grant=spendCredits(s,recipe.credits);
        this.addItem(s,bindGrant(item(recipe.output.kind,recipe.output),account,bound||grant>0));
        s.reputation.engineer=Math.min(20,s.reputation.engineer+1);
      }else if(action.type==='recycle'){
        const i=s.items.findIndex(it=>it.id===action.itemId&&!it.recovery&&!it.favorite);requireRule(i>=0,'Unfavorite an owned item before recycling');
        const it=s.items[i];
        requireRule(!contractItemReserved(s,it),'Contract item reserved: deliver it or complete its contract before recycling');
        const quote=recyclingQuote(it);requireRule(quote,'Item cannot be recycled; use salvage directly');
        requireRule(quote.quantity>0,'Need at least '+quote.batchSize+' rounds of this ammunition to recycle');
        if(quote.remaining)it.quantity=quote.remaining;else s.items.splice(i,1);
        for(const child of flatten(it.attachments||[]))this.inventory.delete(child.id);
        const output=bindGrant(item('material',{material:quote.material,quantity:quote.quantity}),account,!!it.grantOwner);
        this.addItem(s,output);
        this.audit(account,'item_recycled',{itemId:action.itemId,outputId:output.id,...quote,condition:it.condition});
      }else if(action.type==='upgrade'){
        requireRule(['stash','bay','bench'].includes(action.upgrade),'Unknown base upgrade');
        const level=s.upgrades[action.upgrade]||0,max=action.upgrade==='stash'?3:2;
        requireRule(level<max,'Upgrade already at maximum');
        const cost=100+50*level;requireRule(s.credits>=cost,'Insufficient credits');
        this.consumeMaterials(s,{steel:2+level,wire:1});spendCredits(s,cost);s.upgrades[action.upgrade]=level+1;
      }else if(action.type==='preset'){
        requireRule(typeof action.name==='string'&&/^[a-zA-Z0-9 _-]{1,32}$/.test(action.name),'Invalid preset name');
        requireRule(Array.isArray(action.itemIds)&&action.itemIds.length<=8&&action.itemIds.every(id=>s.items.some(it=>it.id===id&&it.kind!=='contract')),'Preset items must be deployable items in your stash');
        requireRule(Object.keys(s.presets).length<12||Object.hasOwn(s.presets,action.name),'At most twelve presets');
        Object.defineProperty(s.presets,action.name,{value:action.itemIds,enumerable:true,configurable:true,writable:true});
      }else if(action.type==='claimOverflow'){
        const entry=this.inventory.get(action.itemId);
        requireRule(entry&&entry.account===account&&entry.location==='overflow'&&entry.payload,'Item not in overflow storage');
        const it=structuredClone(entry.payload);
        this.addItem(s,it);
        this.inventory.set(it.id,{account,location:'stash',deployment:null,raid:null,payload:it});
      }else if(action.type==='attach'){
        const weapon=s.items.find(it=>it.id===action.weaponId&&it.kind==='weapon'),mod=s.items.find(it=>it.id===action.itemId&&it.kind==='mod');
        requireRule(weapon&&mod,'Weapon or attachment not owned');
        const definition=MODS[mod.mod];requireRule(definition?.classes.includes(WEAPONS[weapon.weapon]?.class),'Incompatible attachment');
        weapon.attachments||=[];requireRule(!weapon.attachments.some(it=>MODS[it.mod]?.slot===definition.slot),'Attachment slot occupied');
        if(mod.grantOwner)weapon.grantOwner=account;
        weapon.attachments.push(mod);s.items=s.items.filter(it=>it!==mod);
        this.inventory.set(mod.id,{account,location:'attached',deployment:weapon.id,raid:null,payload:structuredClone(mod)});
      }else if(action.type==='detach'){
        const weapon=s.items.find(it=>it.id===action.weaponId&&it.kind==='weapon');
        const index=weapon?.attachments?.findIndex(it=>it.id===action.itemId);
        requireRule(index>=0,'Attachment not owned');
        const [mod]=weapon.attachments.splice(index,1);
        this.addItem(s,mod);
        this.inventory.set(mod.id,{account,location:'stash',deployment:null,raid:null,payload:structuredClone(mod)});
      }else if(action.type==='buy'){
        throw new RuleError('Traders are unavailable offline in this build. Craft from salvaged materials instead.',501);
      }else if(action.type==='contract'){
        throw new RuleError('Contracts are unavailable offline in this build.',501);
      }else{
        throw new RuleError('Unknown trade action',400);
      }
      this.save(account,s);
      const auditFields=['type','sku','trader','itemId','itemIds','weaponId','recipe','upgrade','quality','contract','operation','favorite','name','quantity','targetId','expectedRevision'];
      this.audit(account,'trade',Object.fromEntries(auditFields.filter(key=>action[key]!==undefined).map(key=>[key,action[key]])));
      return s;
    });
  }

  results(account){
    return [...this.deployments.values()].filter(deployment=>deployment.account===account&&deployment.result)
      .sort((a,b)=>b.serial-a.serial).slice(0,20).map(deployment=>structuredClone(deployment.result));
  }

  latestDeploymentId(account){
    const list=[...this.deployments.values()].filter(deployment=>deployment.account===account);
    if(!list.length)return null;
    list.sort((a,b)=>Number(b.active)-Number(a.active)||b.serial-a.serial);
    return list[0].id;
  }

  purgeRaid(raidId){
    this.checkpoints.delete(raidId);
    for(const entry of this.inventory.values())if(entry.raid===raidId&&entry.location==='raid'){entry.location='lost';entry.account=null}
  }

  // Offline parity with the online claim labels: a claim shows the equipment's
  // catalog name, falls back to the generic label if its inventory payload is gone.
  insuranceLabel(claim){
    const payload=this.inventory.get(claim.item)?.payload;
    if(!payload)return 'Equipment';
    return WEAPONS[payload.weapon]?.name||(payload.kind==='armor'?armorStats(payload).name:'Equipment');
  }

  profile(id){
    const row=this.account(id);
    const state=this.state(id);
    const active=this.activeDeployment(id);
    const overflow=[];
    for(const entry of this.inventory.values())if(entry.account===id&&entry.location==='overflow'&&entry.payload)overflow.push(structuredClone(entry.payload));
    const claims=[...this.insurance.values()].filter(claim=>claim.account===id).slice(-30).reverse()
      .map(claim=>({...claim,label:this.insuranceLabel(claim)}));
    return {
      id:row.id,
      username:row.username,
      ...state,
      sellValues:Object.fromEntries(state.items.map(it=>[it.id,sellValue(it)])),
      overflow,
      insurance:claims,
      activeDeployment:active?{id:active.id,...structuredClone(active.state)}:null,
    };
  }

  partyFor(){return null}
  blockedBetween(){return false}

  audit(account,event,data){
    this.auditLog.push({account,event,data,at:Date.now()});
    if(this.auditLog.length>this.maxAudit)this.auditLog.splice(0,this.auditLog.length-this.maxAudit);
  }
}
