import {ACTION_FIELDS} from '../../shared/raid-protocol.mjs';
const actions=new Set(Object.keys(ACTION_FIELDS)),maps=new Set(['relay','reservoir','switchyard']),kinds=new Set(['weapon','armor','ammo','material','valuable','key','med','mod','utility','contract']);
const reasons=new Map([
 ['Utility not ready','utility_cooldown'],['Utility not owned','utility_missing'],['Too many active utilities','utility_limit'],['Protected pocket full','protected_capacity'],['Item not owned','item_missing'],['Item cannot be protected','protected_eligibility'],['Backpack full','backpack_capacity'],['Item already claimed','loot_claimed'],['Loot out of reach','loot_reach'],['Weapon not ready','weapon_cooldown'],['Medical supplies not ready','medical_cooldown'],['No active operator','raid_ended'],['Downed operators can crawl or await revival','downed'],['Stale action','stale_sequence'],['Action belongs to another deployment','wrong_deployment'],['Sequence already used for another action','conflicting_sequence'],['Starter supplies belong to another operator','foreign_starter'],['Server could not complete the request','server_failure']
]);
const expected=new Set(['cooldown','loot_changed','search_changed','exit_changed','seats_taken','treatment_changed','downed','capacity_changed','raid_end']);
const number=value=>Number.isFinite(value)&&Math.abs(value)<=1e6?Math.round(value*1000)/1000:null;
const list=value=>Array.isArray(value)?value:[];
function context(state,intent){
 const p=state?.self||{};let item,location='absent';for(const name of ['equipment','pack','secure']){const found=list(p[name]).find(it=>it?.id===intent.itemId);if(found){item=found;location=name;break}}
 const source=list(state?.caches).find(c=>c?.id===intent.sourceId)||list(state?.bags).find(c=>c?.id===intent.sourceId);
 return {map:maps.has(state?.map)?state.map:'unknown',position:{x:number(p.x),y:number(p.y),z:number(p.z)},alive:!!p.alive,downed:!!p.downed,packSlots:list(p.pack).length,secureSlots:list(p.secure).length,packCapacity:number(p.cap),secureCapacity:number(p.secureCap),item:{location,kind:kinds.has(item?.kind)?item.kind:'unknown',quantity:number(item?.quantity),recovery:!!item?.recovery,starter:!!item?.grantOwner},...(source?{source:{kind:list(state?.caches).includes(source)?'cache':'bag',position:{x:number(source.x),y:number(source.y),z:number(source.z)},open:!!source.open,itemPresent:list(source.items).some(it=>it?.id===intent.itemId)}}:{})};
}
// Only reviewed reason labels and selected numeric/boolean state are retained.
// Raw messages, credentials, names, identities, item IDs and request bodies never
// enter a report. Unexpected rules have their own sample budget so packet loss
// cannot use every slot before a late, rare gameplay failure occurs.
export class RaidFailureDiagnostics {
 constructor(index){this.index=Number.isInteger(index)&&index>=0&&index<72?index:null;this.counts=new Map();this.samples={delivery:[],expected:[],unexpected:[],server:[]};this.sampleCounts=new Map();this.overflow=0}
 record(error,intent,before,{classification='unexpected',elapsedSeconds=0,pilot}={}){
  const action=actions.has(intent?.type)?intent.type:'unknown',status=Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:0,reason=reasons.get(error?.message)||(status?'unrecognized_rule':'transport_failure'),knownClass=expected.has(classification)?classification:'unexpected',category=!status?'delivery':status>=500?'server':knownClass==='unexpected'?'unexpected':'expected',key=[status||'delivery',action,reason,knownClass].join(':');
  if(this.counts.has(key)||this.counts.size<256)this.counts.set(key,(this.counts.get(key)||0)+1);else this.overflow++;
  const limit=category==='unexpected'?24:8;if(this.samples[category].length>=limit||(this.sampleCounts.get(key)||0)>=2)return;this.sampleCounts.set(key,(this.sampleCounts.get(key)||0)+1);
  this.samples[category].push({category,action,status:status||'delivery',reason,classification:knownClass,elapsedSeconds:number(elapsedSeconds),acknowledgedRejection:!!(error?.ack&&error.ack.accepted===false),duplicate:!!error?.ack?.duplicate,before:context(before,intent||{}),after:context(error?.state||before,intent||{}),clientUtilityWait:number(Math.max(0,(pilot?.nextUtility||0)-(before?.serverTime||0)))});
 }
 report(){return {index:this.index,counts:Object.fromEntries(this.counts),overflow:this.overflow,samples:Object.values(this.samples).flat(),scope:'Bounded, redacted client-observed failure context. Reviewed reason labels only; unknown messages remain unrecognized. State does not reconstruct missing original outcomes or prove a race cause.'}}
}
