// IndexedDB snapshot backend for the static-Pages offline raid store.
//
// One small object store holds the entire MemoryRaidStore snapshot under a fixed
// key. This is deliberately not a per-table schema: the authoritative state is
// already a structured-clone-safe object, and a single atomic put keeps profile,
// stash, deployment records and active-raid checkpoints consistent across a
// reload. The online Node store keeps its own SQLite schema and is untouched.
//
// DOM-free; references `indexedDB` only when a backend method is called, so the
// module can be imported and tested in Node.

export const RAID_IDB_NAME='headshotz-raid-offline';
export const RAID_IDB_VERSION=1;
export const RAID_IDB_STORE='raid-state-v1';
export const RAID_IDB_KEY='store';

export function createIndexedDbBackend({name=RAID_IDB_NAME,version=RAID_IDB_VERSION,storeName=RAID_IDB_STORE,key=RAID_IDB_KEY}={}){
  let opening=null;
  const open=()=>{
    if(opening)return opening;
    if(typeof indexedDB==='undefined'){
      return Promise.reject(new Error('IndexedDB is unavailable in this browser'));
    }
    opening=new Promise((resolve,reject)=>{
      const request=indexedDB.open(name,version);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(storeName))db.createObjectStore(storeName);
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Could not open the offline raid database'));
      request.onblocked=()=>reject(new Error('The offline raid database is blocked by another tab'));
    });
    opening.catch(()=>{opening=null});
    return opening;
  };

  return {
    name:'indexeddb',
    database:name,
    async load(){
      const db=await open();
      return await new Promise((resolve,reject)=>{
        const transaction=db.transaction(storeName,'readonly');
        const request=transaction.objectStore(storeName).get(key);
        request.onsuccess=()=>resolve(request.result??null);
        request.onerror=()=>reject(request.error||new Error('Could not read the offline raid save'));
      });
    },
    async save(snapshot){
      const db=await open();
      // Clone before the transaction so a caller cannot mutate what IDB stores.
      const copy=structuredClone(snapshot);
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction(storeName,'readwrite');
        transaction.oncomplete=()=>resolve();
        transaction.onerror=()=>reject(transaction.error||new Error('Could not write the offline raid save'));
        transaction.onabort=()=>reject(transaction.error||new Error('Offline raid save was aborted'));
        transaction.objectStore(storeName).put(copy,key);
      });
    },
    async discard(){
      const db=await open();
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction(storeName,'readwrite');
        transaction.oncomplete=()=>resolve();
        transaction.onerror=()=>reject(transaction.error||new Error('Could not clear the offline raid save'));
        transaction.onabort=()=>reject(transaction.error||new Error('Offline raid save clear was aborted'));
        transaction.objectStore(storeName).delete(key);
      });
    },
  };
}
