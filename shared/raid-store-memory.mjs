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
import {bindGrant,grantBalance,canRecoverGrant} from './raid-grants.mjs';
import {sellValue} from './raid-appraisal.mjs';

const STARTER_CREDITS=250;
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
    this.checkpoints=new Map();
    this.leases=new Map();
    this.auditLog=[];
    this.maxAudit=maxAudit;
    this.depth=0;
    this.commitSerial=0;
  }

  close(){this.leases.clear();this.depth=0}

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

  checkpoint(raid){
    this.checkpoints.set(raid.id,structuredClone(raid));
  }

  recoverInterrupted(retained=new Set()){
    let count=0;
    for(const deployment of this.deployments.values()){
      if(deployment.active&&!retained.has(deployment.id)){deployment.active=false;count++}
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

  profile(id){
    const row=this.account(id);
    const state=this.state(id);
    const active=this.activeDeployment(id);
    const overflow=[];
    for(const entry of this.inventory.values())if(entry.account===id&&entry.location==='overflow'&&entry.payload)overflow.push(structuredClone(entry.payload));
    return {
      id:row.id,
      username:row.username,
      ...state,
      sellValues:Object.fromEntries(state.items.map(it=>[it.id,sellValue(it)])),
      overflow,
      insurance:[],
      activeDeployment:active?{id:active.id,...structuredClone(active.state)}:null,
    };
  }

  partyFor(){return null}

  audit(account,event,data){
    this.auditLog.push({account,event,data,at:Date.now()});
    if(this.auditLog.length>this.maxAudit)this.auditLog.splice(0,this.auditLog.length-this.maxAudit);
  }
}
