// localStorage snapshot backend: the offline raid's storage fallback when
// IndexedDB is unavailable or refuses to open. It stores the same flattened
// MemoryRaidStore snapshot as raid-store-idb.mjs, serialised as JSON under one
// key. Gameplay rules remain in RaidService; this module only carries state.
//
// DOM-free; the storage object is injectable so Node tests can use a small fake.
export const RAID_LOCAL_KEY='headshotz.raid-offline.store.v1';

export function createLocalStorageBackend({key=RAID_LOCAL_KEY, storage=null}={}){
  const api=()=>storage||(typeof localStorage!=='undefined'?localStorage:null);
  const requireStorage=()=>{
    const store=api();
    if(!store)throw new Error('localStorage is unavailable in this browser');
    return store;
  };
  return {
    name:'localStorage',
    async load(){
      const raw=requireStorage().getItem(key);
      if(!raw)return null;
      return JSON.parse(raw);
    },
    async save(snapshot){
      // JSON drops undefined optional metadata, same as a JSON-over-the-wire
      // snapshot; the store contract treats absent optional fields as defaults.
      requireStorage().setItem(key,JSON.stringify(snapshot));
    },
  };
}
