// Snapshot persistence for the static-Pages offline raid store.
//
// MemoryRaidStore is authoritative in the page; this subclass writes the same
// state to an async backend (IndexedDB in browsers, or an injected test backend)
// after each committed transaction. IndexedDB write failures are recorded but
// never break gameplay: the in-memory store remains the source of truth, and the
// caller can fall back to localStorage on the next boot (slice 12).
//
// DOM-free and `node:*`-free so Node unit tests can inject a small fake backend.
import {requireRule} from './raid-rules.mjs';
import {MemoryRaidStore} from './raid-store-memory.mjs';

const backendShape=backend=>backend&&typeof backend.load==='function'&&typeof backend.save==='function';

// A snapshot that cannot be imported is quarantined, not fatal: boot continues
// from a fresh in-memory store and the next flush replaces the bad save.
export function snapshotRecoveryReason(error){
 const text=String(error?.message||error||'');
 return /Unsupported persisted raid state version/.test(text)?'unsupported-version':'malformed';
}

export class PersistentRaidStore extends MemoryRaidStore {
  constructor({backend, flushDelayMs=80, ...options}={}){
    requireRule(backendShape(backend),'Persistent raid store needs a snapshot backend',500);
    super(options);
    this.backend=backend;
    this.flushDelayMs=Math.max(0,Number(flushDelayMs)||0);
    this.flushTimer=null;
    this.flushChain=Promise.resolve();
    this.lastPersistenceError=null;
    this.lastRecoveryError=null;
    this.recoveredSnapshot=null;
    this.savedState=null;
  }

  async hydrate(){
    const snapshot=await this.backend.load();
    if(snapshot){
      try{
        this.importState(snapshot);
        this.savedState=structuredClone(snapshot);
      }catch(error){
        // Stale, truncated or future-version state must never block the raid.
        // Import is atomic, so the store is still clean; best-effort discard
        // removes the poisoned snapshot so it cannot shadow a fallback save.
        this.lastRecoveryError=error;
        this.recoveredSnapshot={reason:snapshotRecoveryReason(error),message:String(error?.message||error)};
        this.resetState();
        this.savedState=null;
        try{await this.backend.discard?.()}catch{}
      }
    }
    return this;
  }

  transaction(fn){
    const value=super.transaction(fn);
    if(this.depth===0)this.scheduleFlush();
    return value;
  }

  scheduleFlush(){
    if(this.flushTimer!==null)return;
    this.flushTimer=setTimeout(()=>{this.flushTimer=null;this.flush().catch(()=>{})},this.flushDelayMs);
    if(this.flushTimer&&typeof this.flushTimer.unref==='function')this.flushTimer.unref();
  }

  // Serialise every committed change exactly once per write. If a flush is
  // already queued, the chained write picks up the newer state; a transient
  // backend failure clears the chain so the next change can retry.
  flush(){
    if(this.depth>0)return Promise.resolve();
    if(this.flushTimer!==null){clearTimeout(this.flushTimer);this.flushTimer=null}
    this.flushChain=this.flushChain.catch(()=>{}).then(async()=>{
      const snapshot=this.exportState();
      if(this.savedState&&JSON.stringify(snapshot)===JSON.stringify(this.savedState))return;
      try{
        await this.backend.save(snapshot);
        this.savedState=structuredClone(snapshot);
        this.lastPersistenceError=null;
      }catch(error){
        this.lastPersistenceError=error;
        throw error;
      }
    });
    return this.flushChain;
  }

  async flushNow(){
    await this.flush();
    return this;
  }

  close(){
    const pending=this.flush().catch(()=>{});
    super.close();
    return pending;
  }
}

// Pick a durable backend once: IndexedDB when it opens, localStorage when it is
// missing or refuses the first read, and the same fallback after a failed write.
// A missing second backend propagates, telling the runtime to stay in memory.
export function createFallbackSnapshotBackend(primary, fallback){
  requireRule(backendShape(primary)&&backendShape(fallback),'Fallback raid persistence needs two snapshot backends',500);
  let active=primary;
  return {
    name:'indexeddb+localStorage',
    getActiveName(){return active===primary?(primary.name||'primary'):(fallback.name||'fallback')},
    async load(){
      if(active===primary){
        try{
          const value=await primary.load();
          if(value!=null)return value;
        }
        catch{active=fallback}
      }
      // An empty primary does not rule out a degraded save the fallback kept
      // when the last IndexedDB write failed; prefer restoring it.
      try{return await fallback.load()}catch{return null}
    },
    async save(snapshot){
      if(active===primary){
        try{await primary.save(snapshot);return}
        catch{active=fallback}
      }
      await fallback.save(snapshot);
    },
    async discard(){
      for(const backend of [primary,fallback]){
        try{await backend.discard?.()}catch{}
      }
    },
  };
}

// Minimal in-memory backend used by Node tests and by the browser persistence
// test harness. It copies snapshots so callers cannot mutate saved state.
export function createMemorySnapshotBackend(){
  let snapshot=null;
  return {
    async load(){return snapshot===null?null:structuredClone(snapshot)},
    async save(state){snapshot=structuredClone(state)},
    peek(){return snapshot===null?null:structuredClone(snapshot)},
  };
}

