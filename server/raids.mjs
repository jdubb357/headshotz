import {sameLoadout} from '../shared/raid-loadout.mjs';
import {operatorLimit,operatorCapacity,requireOperatorRoom} from './admission.mjs';
import {raidLine,raidSight} from './raid-cover.mjs';
import {SHOT_EYE_HEIGHT} from '../shared/raid-ballistics.mjs';
import {resolveShot} from './raid-ballistics.mjs';
import {splitCarried,unsecure,dropCarried,mergeCarried,takeLoot} from './raid-inventory.mjs';
import {armorStats} from '../shared/raid-combat.mjs';
import {changeArmor,useMedical,absorbDamage,applyWound,advanceWounds} from './raid-medical.mjs';
import {MATCH_POLICY,matchPreferences,squadPool} from '../shared/raid-matchmaking.mjs';
import {throwUtility,advanceUtilities} from './raid-utilities.mjs';
import {stepOperator} from '../shared/raid-motion.mjs';
import {createRaidExits,exitState} from '../shared/raid-exits.mjs';
import {createSectorCaches} from './raid-loot.mjs';
import {ARTIFACTS} from '../shared/raid-sectors.mjs';
import {createConditionPlan,conditionsAt} from '../shared/raid-conditions.mjs';
import {RAID_PROTOCOL,RECEIPT_LIMIT,validateAction} from '../shared/raid-protocol.mjs';
import {createHash} from 'node:crypto';
import {PING_TYPES} from '../shared/raid-comms.mjs';
import {blockedBetween} from './comms.mjs';
import {randomUUID} from 'node:crypto';
import {item,RuleError} from './store.mjs';
import {RAID_WORLDS,getWorld,blocked,clearLine,floorAt} from '../shared/raid-worlds.mjs';
import {safePoint} from '../shared/raid-navigation.mjs';
import {MACHINES,hazardState} from '../shared/raid-enemies.mjs';
import {populateMachines,hitMachine,advanceMachines,advanceEvents,event} from './raid-ai.mjs';
import {WEAPONS,weaponStats,itemWeight,maxStack} from '../shared/raid-catalog.mjs';
const check=(v,m)=>{if(!v)throw new RuleError(m)};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y||0)-(b.y||0));
const near=(a,b,r)=>dist(a,b)<=r;
export class RaidService {
 constructor(store,{now=()=>Date.now()/1000,owner=randomUUID(),region='local',maxOperators}={}){
  this.maxOperators=operatorLimit(maxOperators);this.store=store;this.now=now;this.owner=owner;this.region=region;this.raids=new Map();this.byAccount=new Map();this.renewAt=Date.now()+5000;this.insuranceAt=0;store.acquireLease(owner);
  try{this.restore(store.loadRaids());const retained=new Set([...this.byAccount.values()].filter(p=>p.alive||p.pending).map(p=>p.deploymentId));store.recoverInterrupted(retained)}catch(error){try{store.releaseLease(owner)}catch{}throw error}
 }
 serialize(raidId=null){const ids=raidId===null?null:new Set(Array.isArray(raidId)?raidId:[raidId]);return [...this.raids.values()].filter(r=>!ids||ids.has(r.id)).map(r=>({...r,world:r.world.id,worldVersion:r.world.version||1,players:[...r.players.values()]}))}
 restore(saved,{partial=false,bindings=null,order=null}={}){
  const worlds=new Map(saved.map(data=>{check([undefined,0,1].includes(data.ballisticsVersion),'Checkpoint references unknown ballistics version');const world=getWorld(data.world,data.worldVersion===undefined?1:data.worldVersion);check(world,'Checkpoint references unknown map version');return [data.id,world]}));
  // A player may have historical bodies in several raids. Iteration order must
  // never choose the reconnect identity; rollback keeps its prior binding and
  // startup uses the account's latest durable deployment.
  const selected=bindings||new Map([...this.byAccount].map(([id,p])=>[id,p.deploymentId]));
  if(!partial){this.raids.clear();this.byAccount.clear()}
  else for(const data of saved)for(const p of this.raids.get(data.id)?.players.values()||[])if(this.byAccount.get(p.account)?.raidId===data.id)this.byAccount.delete(p.account);
  for(const data of saved){const world=worlds.get(data.id);const r={...data,world,pings:data.pings||[],hazardTicks:data.hazardTicks||{},noises:data.noises||[],players:new Map(data.players.map(p=>[p.account,{y:0,vy:0,grounded:true,pitch:0,downed:false,bleedUntil:0,hurtAt:0,team:p.account,facts:{explorations:[],machines:0,bosses:0},...p}]))};this.raids.set(r.id,r);
   for(const p of r.players.values()){
    p.receipts||=[];p.lastMoveAt??=p.lastInput;if(p.weaponId===undefined)p.weaponId=[...p.equipment,...p.pack].find(it=>it.kind==='weapon')?.id??null;
    for(const it of [...p.equipment,...p.pack])if(it.kind==='weapon'&&it.loaded==null)it.loaded=it.id===p.weaponId?(p.ammo??WEAPONS[it.weapon]?.mag??30):(WEAPONS[it.weapon]?.mag||30);
    if(!selected.has(p.account))selected.set(p.account,this.store.db.prepare('SELECT id FROM deployments WHERE account=? ORDER BY active DESC,rowid DESC LIMIT 1').get(p.account)?.id);
    if(selected.get(p.account)===p.deploymentId)this.byAccount.set(p.account,p);
   }
  }
  if(partial&&order){const remaining=new Map(this.raids);this.raids.clear();for(const id of order)if(remaining.has(id)){this.raids.set(id,remaining.get(id));remaining.delete(id)}for(const [id,r]of remaining)this.raids.set(id,r)}
 }
 atomic(fn,{raidId,raidIds}={}){
  const scope=Array.isArray(raidIds)?raidIds.filter(id=>this.raids.has(id)):raidId&&this.raids.has(raidId)?[raidId]:null,restoreOptions={partial:scope!==null,bindings:new Map([...this.byAccount].map(([id,p])=>[id,p.deploymentId])),order:scope===null?null:[...this.raids.keys()]},backup=structuredClone(this.serialize(scope));
  try{return this.store.transaction(()=>{this.store.acquireLease(this.owner);const value=fn(backup,restoreOptions);for(const r of this.serialize(scope))this.store.checkpoint(r);return value})}
  catch(error){this.restore(backup,restoreOptions);throw error}
 }
 close(){try{this.atomic(()=>{})}finally{this.store.releaseLease(this.owner)}}
 capacity(){return operatorCapacity(this.raids,this.maxOperators)}
 deploy(account,request){
  check(request.region==null||request.region===this.region,'Connect to a server in your preferred region');
  request={requestId:request.requestId,mapId:request.mapId,itemIds:request.itemIds,recovery:request.recovery,insureIds:request.insureIds,match:request.match,region:this.region};
  return this.atomic(()=>{
   const party=this.store.partyFor(account);
   if(!party)return this.deployPlayer(account,request);
   check(party.leader===account,'Only the party leader can deploy the squad');
   const known=this.byAccount.get(account);
   if(known&&known.requestId===request.requestId)return this.snapshot(account);
   check(party.region===this.region,'Connect to a server in your preferred region');
   check(party.members.every(m=>m.ready),'Every party member must be ready');
   if(request.itemIds!==undefined||request.recovery!==undefined||request.insureIds!==undefined)check(sameLoadout(request,party.members.find(m=>m.account===account).loadout),'Your selected loadout differs from your readied loadout. Ready again before deploying.');
   requireOperatorRoom(this.raids,this.maxOperators,party.members.length);
   for(const [i,m]of party.members.entries())this.deployPlayer(m.account,{...m.loadout,requestId:i?request.requestId+'_'+i:request.requestId,mapId:party.mapId,match:party.match,team:party.id,region:party.region,leaderRaid:i?this.byAccount.get(account).raidId:null});
   this.store.db.prepare('UPDATE party_members SET ready=0 WHERE party=?').run(party.id);
   return this.snapshot(account);
  });
 }
 party(account,request){
  if(request.type==='create'){check(RAID_WORLDS.some(w=>w.id===request.mapId),'Choose a valid map');check(request.region===this.region,'Connect to a server in your preferred region')}
  return this.store.party(account,request);
 }
 deployPlayer(account,request){
  const map=RAID_WORLDS.find(w=>w.id===request.mapId);check(map,'Choose a valid map');
  const known=this.byAccount.get(account);
  if(known&&(!known.result||known.requestId===request.requestId)){check(known.requestId===request.requestId,'Already deployed');return this.snapshot(account)}
  requireOperatorRoom(this.raids,this.maxOperators);
  const deployment=this.store.deploy(account,request);check(deployment.active,'Deployment already ended');
  const region=request.region||'local',members=this.store.partyFor(account)?.members||[{account}];
  let match;try{match=matchPreferences(request.match)}catch(error){throw new RuleError(error.message,400)}
  const size=members.length,team=request.team||account;
  const anchor=r=>{
   const enemies=[...r.players.values()].filter(p=>p.alive&&p.team!==team),used=r.spawnAnchors||[];
   const choices=map.spawns.map(([x,z],index)=>({x,z,index})).filter(p=>!used.includes(p.index)).sort((a,b)=>Math.min(...enemies.map(p=>Math.hypot(b.x-p.x,b.z-p.z)),1000)-Math.min(...enemies.map(p=>Math.hypot(a.x-p.x,a.z-p.z)),1000));
   for(const point of choices){const at=safePoint(map,point.x,point.z,{avoid:enemies,distance:MATCH_POLICY.spawnSeparation});if(at&&r.machines.every(m=>m.hp<=0||Math.hypot(m.x-at.x,m.z-at.z)>=16))return {...at,index:point.index}}return null;
  };
  let raid=request.leaderRaid?this.raids.get(request.leaderRaid):null,at;
  if(!raid){
   const candidates=[...this.raids.values()].filter(r=>r.world.id===map.id&&r.world.version===map.version&&(r.region||'local')===region&&(r.combatVersion||1)===2&&r.ballisticsVersion===1&&r.players.size+size<=MATCH_POLICY.maxPlayers&&members.every(m=>!r.players.has(m.account))&&this.now()-r.started<MATCH_POLICY.joinSeconds).filter(r=>r.matchmaking?.pool===squadPool(size)||match.allowMixed&&(r.matchmaking?.allowMixed??true)).sort((a,b)=>Number(b.matchmaking?.pool===squadPool(size))-Number(a.matchmaking?.pool===squadPool(size))||b.players.size-a.players.size||a.started-b.started);
   for(const candidate of candidates){const spawn=anchor(candidate);if(spawn){raid=candidate;at=spawn;break}}
   if(!raid){raid=this.create(map);this.raids.set(raid.id,raid);raid.matchmaking={version:1,pool:squadPool(size),squadSize:size,allowMixed:match.allowMixed};at=anchor(raid)}
   check(at,'No safe deployment point');raid.spawnAnchors||=[];raid.spawnAnchors.push(at.index);
   raid.matchmaking||={version:1,pool:'mixed',squadSize:null,allowMixed:true};if(raid.matchmaking.pool!==squadPool(size))raid.matchmaking.pool='mixed';raid.matchmaking.allowMixed&&=match.allowMixed;
  }else{
   const friends=[...raid.players.values()].filter(p=>p.alive&&p.team===team),leader=friends[0];check(leader,'Squad deployment anchor missing');const sign=friends.length%2?1:-1;
   for(const [dx,dz]of [[sign*1.5,1.5],[-sign*1.5,0],[0,-1.5],[sign*2.5,-1.5]]){const point=safePoint(map,leader.x+dx,leader.z+dz,{y:leader.y||0,avoid:friends,distance:1.1});if(point&&Math.hypot(point.x-leader.x,point.z-leader.z)<=6&&[...raid.players.values()].every(p=>!p.alive||p.team===team||Math.hypot(p.x-point.x,p.z-point.z)>=24)){at=point;break}}check(at,'No safe squad formation point');
  }
  check(!raid.players.has(account),'An operator cannot redeploy into a raid they already entered');raid.region=region;
  const player={account,name:this.store.profile(account).username,requestId:request.requestId,deploymentId:deployment.id,raidId:raid.id,...at,vy:0,grounded:true,pitch:0,yaw:0,hp:100,alive:true,ammo:30,nextFire:0,lastInput:this.now(),lastMoveAt:this.now(),seq:0,receipts:[],
   equipment:deployment.equipment,pack:[],secure:[],cap:deployment.recovery?8:18,weightCap:deployment.recovery?22:40,secureCap:deployment.recovery?1:2,move:{x:0,z:0},extracted:false,team,downed:false,bleedUntil:0,hurtAt:0,
   combatVersion:raid.combatVersion||1,wounds:{},facts:{explorations:[],machines:0,bosses:0},protectedUntil:this.now()+5};
  const weapon=player.equipment.find(it=>it.kind==='weapon');player.weaponId=weapon.id;weapon.loaded??=WEAPONS[weapon.weapon]?.mag||30;player.weapon=weaponStats(weapon);player.ammo=weapon.loaded;
  if(player.combatVersion!==2&&player.equipment.some(it=>it.kind==='armor'))player.hp=130;
  raid.players.set(account,player);this.byAccount.set(account,player);
  if(raid.conditionPlan)raid.conditions=conditionsAt(raid.world,raid.conditionPlan,this.now()-raid.started);
  this.store.audit(account,'raid_joined',{raid:raid.id,deployment:deployment.id,map:map.id});return this.snapshot(account);
 }
 create(world){
  const started=this.now(),id=randomUUID(),lootSeed=randomUUID(),caches=createSectorCaches(world,id,lootSeed);
  const raid={id,combatVersion:2,ballisticsVersion:1,contentVersion:2,lootSeed,conditionPlan:createConditionPlan(world,id),world,started,deadline:started+600,players:new Map(),caches,machines:[],bags:[],exits:createRaidExits(world,started),events:[],pings:[]};populateMachines(raid,started);return raid;
 }
 action(account,m){
  let canonical;try{canonical=validateAction(m)}catch(error){throw new RuleError(error.message,400)}
  const hash=createHash('sha256').update(canonical).digest('hex');
  const result=this.atomic((before,restoreOptions)=>{
   let p=this.byAccount.get(account);check(p,'No active operator');check((!m.raidId||m.raidId===p.raidId)&&(!m.deploymentId||m.deploymentId===p.deploymentId),'Action belongs to another deployment');
   const prior=(p.receipts||[]).find(receipt=>receipt.seq===m.seq);
   if(prior){check(prior.hash===hash,'Sequence already used for another action');p.lastInput=this.now();return {...prior,duplicate:true}}
   check(m.seq>p.seq,'Stale action');check(p.alive&&!p.pending,'No active operator');
   let failure;
   try{this.store.transaction(()=>this.performAction(account,m))}catch(error){if(!(error instanceof RuleError))throw error;this.restore(before,restoreOptions);p=this.byAccount.get(account);p.seq=m.seq;p.lastInput=this.now();failure={message:error.message,status:error.status}}
   const receipt={seq:m.seq,hash,...(failure?{error:failure}:{accepted:true})};p.receipts||=[];p.receipts.push(receipt);if(p.receipts.length>RECEIPT_LIMIT)p.receipts.splice(0,p.receipts.length-RECEIPT_LIMIT);return {...receipt,duplicate:false};
  },{raidId:this.byAccount.get(account)?.raidId});
  const ack={protocol:RAID_PROTOCOL,sequence:result.seq,accepted:!result.error,duplicate:result.duplicate};
  if(result.error){const error=new RuleError(result.error.message,result.error.status);error.ack=ack;throw error}return ack;
 }

 performAction(account,m){
  check(m&&typeof m==='object'&&!Array.isArray(m)&&typeof m.type==='string'&&m.type.length<=24,'Invalid action');
  check(m.protocol==null||m.protocol===RAID_PROTOCOL,'Incompatible game protocol');
  const p=this.byAccount.get(account);check(p&&p.alive&&!p.pending,'No active operator');const r=this.raids.get(p.raidId);
  check(Number.isSafeInteger(m.seq)&&m.seq>p.seq,'Stale action');p.seq=m.seq;p.lastInput=this.now();
  const now=this.now();
  check(!p.downed||['move','ping'].includes(m.type),'Downed operators can crawl or await revival');
  if(!['move','ping'].includes(m.type))this.interruptInteractions(r,p,m.type==='search'?{search:m.sourceId}:m.type==='revive'?{revive:true}:m.type==='extract'?{board:true}:{});
  if(['search','revive','extract'].includes(m.type))p.move={x:0,z:0};
  if(m.type!=='move')this.store.audit(account,'raid_action',{raid:r.id,type:m.type,seq:m.seq});
  if(m.type==='move'){
   check(Number.isFinite(m.x)&&Number.isFinite(m.z)&&Number.isFinite(m.yaw),'Invalid movement');
   check(m.pitch==null||Number.isFinite(m.pitch),'Invalid view angle');
   const len=Math.max(1,Math.hypot(m.x,m.z));if(m.x!==0||m.z!==0)this.interruptInteractions(r,p);p.lastMoveAt=now;p.move={x:m.x/len,z:m.z/len};p.yaw=m.yaw%(Math.PI*2);p.pitch=Math.max(-1.2,Math.min(1.2,m.pitch??p.pitch??0));return;
  }
  if(m.type==='ping'){
   check(Object.hasOwn(PING_TYPES,m.kind),'Unknown squad ping');check(now>=(p.nextPing||0),'Wait before sending another ping');p.nextPing=now+2;
   let point={x:p.x,y:p.y||0,z:p.z};
   if(!['needAmmo','needMed'].includes(m.kind)){
    const exit=m.exitId&&r.exits.find(e=>e.id===m.exitId);check(!m.exitId||exit&&near(p,exit,65)&&raidLine(r,p.x,p.z,exit.x,exit.z,(p.y||0)+1.5,(exit.y||0)+.7),'Exit cannot be marked from here');
    if(exit)point={x:exit.x,y:exit.y||0,z:exit.z};
    else for(let d=1;d<=40;d++){
     const x=p.x+Math.sin(p.yaw)*d,z=p.z+Math.cos(p.yaw)*d,y=(p.y||0)+1.55+Math.tan(p.pitch||0)*d;
     if(blocked(r.world,x,z,0,y,.05)||y<floorAt(r.world,x,z,y+.05))break;point={x,y:floorAt(r.world,x,z,y+.05),z};
    }
   }
   r.pings=(r.pings||[]).filter(q=>q.until>now);const own=r.pings.filter(q=>q.owner===account);if(own.length>=3)r.pings=r.pings.filter(q=>q.id!==own[0].id);
   r.pings.push({id:randomUUID(),owner:account,team:p.team,name:p.name||'Squadmate',kind:m.kind,...point,until:now+20});return;
  }
  if(m.type==='throw'){throwUtility(this,r,p,m,now);return}
  if(m.type==='jump'){check(p.grounded&&!p.downed&&!p.carrying&&now>=(p.nextJump||0),'Cannot jump now');p.vy=6;p.grounded=false;p.nextJump=now+.5;return}
  if(m.type==='fire'){
   if(m.yaw!=null)p.yaw=m.yaw%(Math.PI*2);if(m.pitch!=null)p.pitch=Math.max(-1.2,Math.min(1.2,m.pitch));
   const weapon=this.currentWeapon(p);p.weapon=weaponStats(weapon);
   check(now>=p.nextFire&&weapon.loaded>0&&weapon.condition>0,'Weapon not ready');p.nextFire=now+p.weapon.delay;weapon.loaded--;p.ammo=weapon.loaded;
   if(weapon.recoveryLoaded>0)weapon.recoveryLoaded--;else if(weapon.grantLoaded>0){weapon.grantLoaded--;if(!weapon.grantLoaded)delete weapon.grantAmmoOwner}weapon.condition=Math.max(0,weapon.condition-.08);p.protectedUntil=0;
   p.facts||={explorations:[],machines:0,bosses:0};p.facts.roundsFired=(p.facts.roundsFired||0)+1;
   r.noises||=[];r.noises.push({x:p.x,y:p.y||0,z:p.z,radius:40*p.weapon.noise,until:now+3});
   if(r.ballisticsVersion===1){resolveShot(this,r,p,p.weapon);return}
   const targets=[...r.players.values()].filter(q=>q!==p&&q.alive&&q.team!==p.team).concat(r.machines.filter(q=>q.hp>0));
   const originY=(p.y||0)+1.55;
   const hits=targets.map(q=>{const horizontal=Math.hypot(q.x-p.x,q.z-p.z),height=q.account?(q.downed?.65:1.8):(MACHINES[q.kind]?.height||2),radius=q.account?.5:(MACHINES[q.kind]?.radius||.65),hitY=originY+Math.tan(p.pitch||0)*horizontal;
    const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(q.x-p.x,q.z-p.z)-p.yaw),Math.cos(Math.atan2(q.x-p.x,q.z-p.z)-p.yaw)));
    return {target:q,hitY,valid:dist(p,q)<p.weapon.range&&angle<Math.atan2(radius,Math.max(.1,horizontal))&&hitY>=(q.y||0)&&hitY<=(q.y||0)+height&&clearLine(r.world,p.x,p.z,q.x,q.z,originY,hitY)};
   }).filter(hit=>hit.valid).sort((a,b)=>dist(p,a.target)-dist(p,b.target));
   if(hits.length){const {target,hitY}=hits[0],before=Math.max(0,target.hp),absorbed=target.facts?.damageAbsorbed||0;p.facts.shotsHit=(p.facts.shotsHit||0)+1;if(target.account)this.damage(r,target,p.weapon.damage*(hitY-(target.y||0)>1.6?1.6:1),{source:'operator',zone:hitY-(target.y||0)>1.6?'head':hitY-(target.y||0)<.65?'leg':'body'});else hitMachine(this,r,target,p.weapon.damage,hitY,p.team);p.facts.damageDealt=(p.facts.damageDealt||0)+before-Math.max(0,target.hp)+Math.max(0,(target.facts?.damageAbsorbed||0)-absorbed)}
   return;
  }
  if(m.type==='wear'||m.type==='removeArmor'){check(p.combatVersion===2,'Armor changes require a new deployment');changeArmor(p,m,now);return}
  if(m.type==='equip'){
   check(now>=p.nextFire,'Finish the current weapon action first');const weapon=[...p.equipment,...p.pack].find(it=>it.id===m.itemId&&it.kind==='weapon'&&it.condition>0);check(weapon,'Usable weapon not owned');
   p.weaponId=weapon.id;weapon.loaded??=0;p.weapon=weaponStats(weapon);p.ammo=weapon.loaded;p.nextFire=now+.5;return;
  }
  if(['drop','stack','split','unsecure'].includes(m.type)){
   const transfer=m.type==='drop'?dropCarried(r,p,m.itemId,now):m.type==='stack'?mergeCarried(p,m.itemId,m.targetId):m.type==='split'?splitCarried(p,m.itemId,m.quantity):unsecure(p,m.itemId);this.store.audit(account,'raid_transfer',{raid:r.id,kind:m.type,...transfer});return;
  }
  if(m.type==='revive'){
   const target=r.players.get(m.targetId);check(this.canRescue(r,p,target,now),'Downed squadmate out of reach');
   p.reviving={target:m.targetId,until:now+5,hurtAt:p.hurtAt,targetHurtAt:target.hurtAt};return;
  }
  if(m.type==='carry'){
   const target=r.players.get(m.targetId);
   if(target?.alive&&target.downed&&p.carrying===target.account&&target.carrier===account){this.releaseCarry(r,p);return}
   check(this.canRescue(r,p,target,now),'Downed squadmate out of reach');
   check(!target.carrier||target.carrier===account,'Squadmate already being carried');
   check(!p.carrying,'Already carrying a squadmate');p.carrying=target.account;target.carrier=account;p.board=null;return;
  }
  if(m.type==='reload'){
   const weapon=this.currentWeapon(p),stats=weaponStats(weapon);check(now>=p.nextFire&&weapon.loaded<stats.mag,'Weapon not ready or magazine full');
   const sources=[...p.equipment,...p.pack].filter(it=>it.kind==='ammo'&&it.ammo===stats.ammo&&it.quantity>0);check(sources.length,'No compatible ammunition');
   let needed=stats.mag-weapon.loaded;
   for(const source of sources){const take=Math.min(needed,source.quantity);source.quantity-=take;weapon.loaded+=take;needed-=take;if(source.recovery)weapon.recoveryLoaded=(weapon.recoveryLoaded||0)+take;else if(source.grantOwner){weapon.grantLoaded=(weapon.grantLoaded||0)+take;weapon.grantAmmoOwner=source.grantOwner}if(!needed)break}
   p.equipment=p.equipment.filter(it=>it.quantity>0);p.pack=p.pack.filter(it=>it.quantity>0);p.ammo=weapon.loaded;p.nextFire=now+stats.reload;return;
  }
  if(m.type==='use'){useMedical(p,m.itemId,now);return}
  if(m.type==='search'){
   const c=r.caches.find(c=>c.id===m.sourceId);check(c&&this.canInteract(r,p,c,3),'Cache out of reach');
   if(c.vault&&!c.open&&!c.searcher){const list=[p.equipment,p.pack,p.secure].find(list=>list.some(it=>it.kind==='key'));check(list,'A vault access key is required');list.splice(list.findIndex(it=>it.kind==='key'),1);p.facts.keysUsed=(p.facts.keysUsed||0)+1;c.vault=false;event(r,now,'A sealed vault has been opened. Machine patrols are investigating.','alarm');r.noises.push({x:p.x,y:p.y||0,z:p.z,radius:60,until:now+8})}
   if(!c.open){check(!c.searcher||c.searcher===account,'Cache being searched');c.searcher=account;if(!c.searchUntil)c.searchUntil=now+2.4}return;
  }
  if(m.type==='take'){const transfer=takeLoot(this,r,p,m);this.store.audit(account,'raid_transfer',{raid:r.id,kind:'take',...transfer});return}
  if(m.type==='secure'){
   check(p.secure.length<p.secureCap,'Protected pocket full');const i=p.pack.findIndex(it=>it.id===m.itemId);check(i>=0,'Item not owned');
   check(['key','material','valuable','med','mod'].includes(p.pack[i].kind)&&!p.pack[i].recovery&&p.pack[i].quantity<=maxStack(p.pack[i]),'Item cannot be protected');const it=p.pack.splice(i,1)[0];p.secure.push(it);this.store.audit(account,'raid_transfer',{raid:r.id,kind:'secure',itemId:it.id,quantity:it.quantity,source:'pack',target:'secure'});return;
  }
  const exit=r.exits.find(e=>e.id===m.exitId);check(exit&&this.canInteract(r,p,exit,4),'Exit out of reach');
  if(m.type==='call'){
   check(exit.kind==='call'&&now>=exit.closeAt,'Transport already inbound');check(exitState(exit,now).phase!=='exhausted','No transport calls remain');this.activateExit(exit,now);r.noises.push({x:exit.x,y:exit.y||0,z:exit.z,radius:65,until:now+20});event(r,now,'Evacuation beacon active. Machines and rival squads can hear the call.','extraction');return;
  }
  if(m.type==='unlock'){
   check(['key','resource'].includes(exit.kind)&&now>=exit.closeAt,'Exit already open');check(exitState(exit,now).phase!=='exhausted','No emergency exit uses remain');this.payExit(p,exit);this.activateExit(exit,now);event(r,now,(exit.name||'Emergency exit')+' is open. Access cost has been consumed.','extraction');return;
  }
  if(m.type==='extract'){
   check(now>=exit.openAt&&now<exit.closeAt,'Exit is closed');this.pruneBoarding(r,now);const passengers=this.boardingParty(r,p),reserved=this.reservedSeats(r,exit,p.account);check(passengers.every(id=>this.canInteract(r,r.players.get(id),exit,4)),'Carried squadmate is outside the boarding area');check(exit.seats==null||(exit.usedSeats||0)+reserved+passengers.length<=exit.seats,'Not enough extraction seats for you and any carried squadmate');
   if(!p.board||p.board.exit!==exit.id)p.board={exit:exit.id,wave:exit.wave||0,passengers,until:now+(exit.boarding||2.2)};return;
  }
  throw new RuleError('Unknown action',400);
 }
 activateExit(exit,now){exit.activations=(exit.activations||0)+1;exit.wave=(exit.wave||0)+1;exit.usedSeats=0;exit.openAt=now+(exit.arrival??(exit.kind==='call'?35:0));exit.closeAt=exit.openAt+(exit.duration??(exit.kind==='call'?30:45))}
 payExit(p,exit){
  const cost=exit.cost||{kind:'key',quantity:1},matches=it=>it.kind===cost.kind&&(!cost.material||it.material===cost.material)&&!it.recovery,lists=[p.equipment,p.pack,p.secure];
  check(lists.flat().filter(matches).reduce((n,it)=>n+it.quantity,0)>=cost.quantity,cost.kind==='key'?'Key required':cost.quantity+' '+cost.material+' required');
  let needed=cost.quantity;for(const list of lists)for(let i=list.length-1;i>=0&&needed;i--){const it=list[i];if(!matches(it))continue;const take=Math.min(needed,it.quantity);it.quantity-=take;needed-=take;if(!it.quantity)list.splice(i,1)}
  p.facts.exitCosts||=[];p.facts.exitCosts.push({exitId:exit.id,...cost});if(cost.kind==='key')p.facts.keysUsed=(p.facts.keysUsed||0)+cost.quantity;
 }
 boardingParty(r,p){const carried=r.players.get(p.carrying);return [p.account,...(carried?.alive&&carried.downed&&carried.carrier===p.account?[carried.account]:[])]}
 validBoarding(r,p,now){
  const b=p.board,e=b&&r.exits.find(e=>e.id===b.exit);if(!e||!p.alive||p.downed||now<e.openAt||now>=e.closeAt||(b.wave||0)!==(e.wave||0)||!this.canInteract(r,p,e,4))return false;
  const actual=this.boardingParty(r,p);return actual.every(id=>this.canInteract(r,r.players.get(id),e,4))&&(!b.passengers||actual.length===b.passengers.length&&actual.every((id,i)=>id===b.passengers[i]));
 }
 pruneBoarding(r,now){for(const p of r.players.values())if(p.board&&!this.validBoarding(r,p,now))p.board=null}
 reservedSeats(r,exit,except=null){return [...r.players.values()].filter(p=>p.account!==except&&p.board?.exit===exit.id).reduce((n,p)=>n+(p.board.passengers?.length||this.boardingParty(r,p).length),0)}
 end(r,p,outcome,reason=null){
  if(p.pending||p.result)return;
  this.interruptInteractions(r,p);
  for(const it of [...p.equipment,...p.pack])if(it.kind==='weapon'){it.loaded=Math.max(0,(it.loaded||0)-(it.recoveryLoaded||0));it.recoveryLoaded=0;it.condition=Math.max(0,it.condition-(outcome==='extract'?2:5))}
  const dropped=outcome==='extract'?[]:[...p.pack,...p.equipment].filter(it=>!it.recovery);
  if(dropped.length)r.bags.push({id:randomUUID(),x:p.x,y:p.y||0,z:p.z,items:dropped});
  const returned=outcome==='extract'?[...p.equipment,...p.pack,...p.secure]:p.secure;
  const artifacts={};if(outcome==='extract')for(const it of returned)if(it.kind==='contract'&&ARTIFACTS[it.artifact]?.map===r.world.id&&it.originRaid===r.id)artifacts[it.artifact]=(artifacts[it.artifact]||0)+1;
  const facts={...p.facts,artifacts,extractBoss:outcome==='extract'&&p.facts?.bosses?1:0,extractKey:outcome==='extract'&&returned.some(it=>it.kind==='key')?1:0,extractValuable:outcome==='extract'?returned.filter(it=>it.kind==='valuable').length:0};
  p.pending={outcome,reason:reason||({extract:'extracted',timeout:'raid_expired',disconnect:'connection_expired',aborted:'service_interrupted'}[outcome])||'unknown',raid:{map:r.world.id,mapVersion:r.world.version||1,durationSeconds:Math.max(0,this.now()-r.started)},items:returned.filter(it=>!it.recovery),lostItems:dropped,credits:outcome==='extract'?20:0,facts};
  p.alive=false;p.extracted=outcome==='extract';p.equipment=[];p.pack=[];p.secure=[];p.move={x:0,z:0};p.board=null;
  if(p.carrier){const carrier=r.players.get(p.carrier);if(carrier){carrier.carrying=null;carrier.board=null}p.carrier=null}
  this.flush(p);
  if(p.carrying){const carried=r.players.get(p.carrying);p.carrying=null;if(carried){carried.carrier=null;if(outcome==='extract'&&carried.alive)this.end(r,carried,'extract')}}
 }
 damage(r,p,amount,options={}){
  if(!Number.isFinite(amount)||amount<=0||(p.protectedUntil||0)>this.now())return;
  p.hurtAt=this.now();this.interruptInteractions(r,p);for(const helper of r.players.values())if(helper.reviving?.target===p.account)helper.reviving=null;
  if(p.carrier){const carrier=r.players.get(p.carrier);if(carrier)carrier.board=null}
  if(p.combatVersion!==2){const armor=p.equipment.find(it=>it.kind==='armor'&&it.condition>0);if(armor)armor.condition=Math.max(0,armor.condition-amount*.1)}
  if(p.downed){p.bleedUntil-=amount*.25;if(p.bleedUntil<=this.now())this.end(r,p,'death','finished_downed');return}
  const healthDamage=p.combatVersion===2?absorbDamage(p,amount,options):amount;p.facts||={};p.facts.healthDamageTaken=(p.facts.healthDamageTaken||0)+Math.min(Math.max(0,p.hp),healthDamage);p.hp-=healthDamage;if(p.combatVersion===2)applyWound(p,healthDamage,options.kind||'combat',options.zone||'body',this.now());
  if(p.hp<=0){if([...r.players.values()].some(q=>q!==p&&q.team===p.team&&q.alive&&!q.downed)){p.hp=0;p.downed=true;p.reviving=null;if(p.carrying)this.releaseCarry(r,p);if(p.wounds){p.wounds.bleedingUntil=0;p.wounds.bleedNextAt=0}p.bleedUntil=this.now()+25;p.move={x:0,z:0}}else this.end(r,p,'death',options.source||options.kind||'combat')}
 }
 flush(p){try{p.result=this.store.settle(p.deploymentId,p.pending);p.pending=null}catch(error){if(error instanceof RuleError)throw error;/* Retry an unavailable database on the next tick. */}}
 currentWeapon(p){const weapon=[...p.equipment,...p.pack].find(it=>it.id===p.weaponId&&it.kind==='weapon')||p.equipment.find(it=>it.kind==='weapon');check(weapon,'No equipped weapon');return weapon}
 weight(p){return [...p.equipment,...p.pack,...p.secure].reduce((n,it)=>n+itemWeight(it),0)}
 interruptInteractions(r,p,keep={}){if(!keep.revive)p.reviving=null;if(!keep.board)p.board=null;for(const cache of r.caches)if(cache.searcher===p.account&&cache.id!==keep.search){cache.searcher=null;cache.searchUntil=0}}
 canRescue(r,p,target,now=this.now()){return !!(p.alive&&!p.downed&&target&&target!==p&&target.alive&&target.downed&&target.bleedUntil>now&&target.team===p.team&&near(p,target,2)&&raidLine(r,p.x,p.z,target.x,target.z,(p.y||0)+1,(target.y||0)+.35))}
 releaseCarry(r,carrier){const passenger=r.players.get(carrier.carrying);carrier.carrying=null;carrier.board=null;if(passenger?.carrier===carrier.account)passenger.carrier=null}
 canInteract(r,p,target,radius){return p.alive&&near(p,target,radius)&&raidLine(r,p.x,p.z,target.x,target.z,(p.y||0)+1,(target.y||0)+.6)}
 movePlayer(r,p,dt,now){const damage=stepOperator(r.world,p,dt,now);if(damage)this.damage(r,p,damage,{kind:'fall'})}

 tick(dt=.05){
  if(Date.now()>=this.insuranceAt){this.store.processInsurance();this.insuranceAt=Date.now()+1000}
  const now=this.now(),raidIds=[];let active=false,expired=false;
  for(const r of this.raids.values()){
   const live=[...r.players.values()].some(p=>p.alive||p.pending),old=now>r.deadline+120;active||=live;expired||=old;
   if(live||old||now-r.started<MATCH_POLICY.joinSeconds)raidIds.push(r.id);
  }
  if(!active&&!expired){if(Date.now()>=this.renewAt){this.store.acquireLease(this.owner);this.renewAt=Date.now()+5000}return}
  return this.atomic(()=>this.advance(dt,now),{raidIds});
 }
 advance(dt=.05,now=this.now()){
  dt=Math.min(.1,Math.max(0,dt));
  for(const r of this.raids.values()){
   const live=[...r.players.values()].some(p=>p.alive||p.pending);
   if(now>r.deadline+120&&!live){
    this.store.db.prepare('DELETE FROM raid_checkpoints WHERE id=?').run(r.id);
    this.store.db.prepare("UPDATE inventory SET location='lost',account=NULL WHERE raid=? AND location='raid'").run(r.id);
    for(const p of r.players.values())if(this.byAccount.get(p.account)?.raidId===r.id)this.byAccount.delete(p.account);
    this.raids.delete(r.id);continue;
   }
   // Nobody can observe or enter this settled world after admissions close.
   // Retain its checkpoint/loot until normal cleanup without simulating it.
   if(!live&&now-r.started>=MATCH_POLICY.joinSeconds)continue;
   for(const p of r.players.values()){
    if(p.pending){this.flush(p);continue}if(!p.alive)continue;
    if(now>=r.deadline){this.end(r,p,'timeout');continue}
    if(now-p.lastInput>45){this.end(r,p,'disconnect');continue}
    if(p.downed&&now>=p.bleedUntil){this.end(r,p,'death','downed_expired');continue}
    p.facts||={explorations:[],machines:0,bosses:0};for(const c of r.caches)if(near(p,c,5)){const name=r.world.id+':'+c.id;if(!p.facts.explorations.includes(name))p.facts.explorations.push(name)}
    if(p.carrying){const passenger=r.players.get(p.carrying);if(p.downed||!passenger?.alive||!passenger.downed||passenger.team!==p.team||passenger.carrier!==p.account)this.releaseCarry(r,p)}
    const carrier=p.carrier&&r.players.get(p.carrier);
    if(carrier?.alive&&!carrier.downed&&p.downed&&carrier.team===p.team&&carrier.carrying===p.account){p.x=carrier.x;p.y=carrier.y||0;p.z=carrier.z}
    else{if(p.carrier){if(carrier?.carrying===p.account)this.releaseCarry(r,carrier);p.carrier=null}this.movePlayer(r,p,dt,now)}
    advanceWounds(this,r,p,now);if(!p.alive)continue;
    if(p.reviving){const target=r.players.get(p.reviving.target);if(p.hurtAt!==p.reviving.hurtAt||!this.canRescue(r,p,target,now)||target.hurtAt!==p.reviving.targetHurtAt)p.reviving=null;else if(now>=p.reviving.until){target.downed=false;target.hp=30;target.bleedUntil=0;if(target.carrier){const carrier=r.players.get(target.carrier);if(carrier?.carrying===target.account)this.releaseCarry(r,carrier)}target.carrier=null;p.reviving=null}}
    if(p.board){const e=r.exits.find(e=>e.id===p.board.exit);if(!this.validBoarding(r,p,now))p.board=null;else if(now>=p.board.until){const passengers=this.boardingParty(r,p),seats=passengers.length;if(e.seats!=null&&(e.usedSeats||0)+seats>e.seats)p.board=null;else{e.usedSeats=(e.usedSeats||0)+seats;for(const id of passengers)r.players.get(id).facts.extractionExit=e.id;this.end(r,p,'extract')}}}
   }
   const searching=new Set();for(const c of r.caches)if(c.searcher){const p=r.players.get(c.searcher);if(!p?.alive||p.downed||p.reviving||p.board||searching.has(p.account)||!this.canInteract(r,p,c,3)){c.searcher=null;c.searchUntil=0}else{searching.add(p.account);if(now>=c.searchUntil){c.open=true;c.searcher=null;c.searchUntil=0}}}
   r.bags=r.bags.filter(b=>b.items.length);advanceEvents(this,r,now);advanceUtilities(this,r,now);advanceMachines(this,r,dt,now);
  }
 }
 snapshot(account,spectate=null){
  const p=this.byAccount.get(account);check(p,'Not deployed');const r=this.raids.get(p.raidId);p.lastInput=this.now();
  const serverTime=this.now(),teammates=[...r.players.values()].filter(q=>q!==p&&q.alive&&q.team===p.team);
  const observer=p.alive?p:teammates.find(q=>q.account===spectate)||teammates[0];
  const visible=q=>{
   if(!observer||!near(observer,q,Math.max(24,85*(r.conditions?.visibility||1))))return false;
   const current=r.ballisticsVersion===1,machine=MACHINES[q.kind],body=current?(q.account&&q.downed?.35:machine?Math.min(1,machine.height*.55):1):1;
   return raidSight(r,observer,q,{eye:current?SHOT_EYE_HEIGHT:1.5,body,head:q.account?(q.downed?.5:1.7):machine?machine.height*.85:null},serverTime);
  };
  return {camera:!p.alive&&observer?{follow:observer.account,name:observer.name||'Squadmate',x:observer.x,y:observer.y||0,z:observer.z,yaw:observer.yaw,pitch:observer.pitch||0}:null,protocol:RAID_PROTOCOL,raidId:r.id,map:r.world.id,mapVersion:r.world.version||1,region:r.region||'local',matchmaking:r.matchmaking||{version:0,pool:'mixed'},serverTime,pings:(r.pings||[]).filter(q=>q.until>serverTime&&q.team===p.team&&!blockedBetween(this.store,account,q.owner)),squad:[...r.players.values()].filter(q=>q.team===p.team).map(q=>({id:q.account,name:q.name||'Operator',alive:q.alive,downed:q.downed,hp:q.hp,outcome:q.result?.outcome,boarding:!!q.board,carrying:!!q.carrying,bleedLeft:Math.max(0,q.bleedUntil-serverTime),connected:serverTime-q.lastInput<5})),left:Math.max(0,r.deadline-serverTime),conditions:r.conditions,utilities:(r.utilities||[]).filter(e=>observer&&near(observer,e,65)&&raidLine(r,observer.x,observer.z,e.x,e.z,(observer.y||0)+1.5,e.y+1)).map(({id,kind,x,y,z,radius,activeAt,until,detonated})=>({id,kind,x,y,z,radius,activeAt,until,detonated})),events:r.events.slice(-10),telegraphs:(r.telegraphs||[]).filter(q=>visible(q)||observer&&near(observer,q,(q.radius||1)+5)&&raidLine(r,observer.x,observer.z,q.x,q.z,(observer.y||0)+1.5,(q.y||0)+1)),hazards:(r.world.hazards||[]).map(h=>hazardState(h,serverTime-r.started)),self:{deploymentId:p.deploymentId,x:p.x,y:p.y||0,z:p.z,yaw:p.yaw,pitch:p.pitch||0,combatVersion:p.combatVersion||1,ballisticsVersion:r.ballisticsVersion||0,wounds:p.wounds||{},nextMedicalAt:p.nextMedicalAt||0,nextFire:p.nextFire||0,armor:p.combatVersion===2&&p.equipment.some(it=>it.kind==='armor')?armorStats(p.equipment.find(it=>it.kind==='armor')):null,hp:p.hp,ammo:p.ammo,alive:p.alive,grounded:p.grounded,vy:p.vy||0,fallPeak:p.fallPeak??p.y??0,move:serverTime-p.lastMoveAt<.4?p.move:{x:0,z:0},carrier:p.carrier,reviving:p.reviving?{until:p.reviving.until}:null,carrying:p.carrying,pack:p.pack,secure:p.secure,equipment:p.equipment,cap:p.cap,secureCap:p.secureCap,weight:this.weight(p),weightCap:p.weightCap||40,weaponId:p.weaponId,seq:p.seq,board:p.board,result:p.result,downed:p.downed,bleedLeft:Math.max(0,p.bleedUntil-serverTime),team:p.team},
   players:[...r.players.values()].filter(q=>q!==p&&q.alive&&(q.team===p.team||visible(q))).map(q=>{const reachable=q.team===p.team&&this.canRescue(r,p,q,serverTime),carriedByYou=!!(p.alive&&!p.downed&&q.downed&&p.carrying===q.account&&q.carrier===p.account);return {id:q.account,name:q.name||'Operator',x:q.x,y:q.y||0,z:q.z,yaw:q.yaw,weapon:[...q.equipment,...q.pack].find(it=>it.id===q.weaponId&&it.kind==='weapon')?.weapon??null,hp:q.hp,team:q.team,downed:q.downed,...(q.team===p.team&&q.downed?{rescue:{revive:reachable,carry:carriedByYou||!!(reachable&&!p.carrying&&!q.carrier),carriedByYou}}:{})}}),
   machines:r.machines.filter(q=>q.hp>0&&visible(q)).map(m=>({id:m.id,kind:m.kind,x:m.x,y:m.y||0,z:m.z,hp:m.hp,maxHp:m.maxHp||MACHINES[m.kind]?.hp,yaw:m.yaw||0,state:m.state,enraged:m.enraged,hurtUntil:m.hurtUntil})),caches:r.caches.map(c=>({id:c.id,x:c.x,y:c.y||0,z:c.z,open:c.open,tier:c.tier||0,label:c.label||'Salvage cache',vault:c.vault,searchRemaining:c.searcher===account?Math.max(0,c.searchUntil-serverTime):null,items:c.open&&this.canInteract(r,p,c,3)?c.items:[]})),
   bags:r.bags.filter(b=>b.items.length).map(b=>({id:b.id,x:b.x,y:b.y||0,z:b.z,items:this.canInteract(r,p,b,3)?b.items:[]})),exits:r.exits.map(e=>({...e,reservedSeats:[...r.players.values()].filter(q=>q.board?.exit===e.id&&this.validBoarding(r,q,serverTime)).reduce((n,q)=>n+(q.board.passengers?.length||this.boardingParty(r,q).length),0),contested:[...r.players.values()].some(q=>q.alive&&q.team!==p.team&&near(q,e,8)&&visible(q))}))};
 }
}
