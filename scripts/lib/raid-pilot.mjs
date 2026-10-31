import {medicalNeed} from '../../shared/raid-combat.mjs';
import {canRecoverGrant} from '../../shared/raid-grants.mjs';
// Synthetic player driven only by public geometry and authenticated player snapshots.
// It never reads the fixture database or grants positions, items, damage or outcomes.
import {getWorld,blocked,clearLine} from '../../shared/raid-worlds.mjs';
import {findPath,canWalkSegment} from '../../shared/raid-navigation.mjs';
import {OPERATOR_RADIUS} from '../../shared/raid-motion.mjs';
import {MACHINES} from '../../shared/raid-enemies.mjs';
import {weaponStats,itemWeight} from '../../shared/raid-catalog.mjs';
import {exitState} from '../../shared/raid-exits.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z),zero=p=>({type:'move',x:0,z:0,yaw:p.yaw||0,pitch:p.pitch||0}),moving=p=>Math.hypot(p.move?.x||0,p.move?.z||0)>.01;
function routeContext(state,world,target){const p=state.self,position=q=>Object.fromEntries(['x','y','z'].map(k=>[k,Number.isFinite(q?.[k])&&Math.abs(q[k])<10000?q[k]:0])),armor=p.equipment.find(it=>it.kind==='armor');return {map:world.id,mapVersion:world.version,position:position(p),grounded:!!p.grounded,vy:p.vy||0,combatVersion:p.combatVersion||1,armor:armor?(['light','standard','heavy'].includes(armor.armor)?armor.armor:'standard'):'none',injured:!!(p.wounds?.limpUntil>state.serverTime),carrying:!!p.carrying,target:/^cache\d+$/.test(target.id)||world.exits.some(e=>e.id===target.id)?target.id:'dynamic_loot',targetPosition:position(target)}}
export class RaidPilot {
 constructor({index=0,account=null,surveySites=1,prioritySite=null}={}){this.index=index;this.account=account;this.surveySites=surveySites;this.prioritySite=prioritySite;this.visited=new Set();this.avoid=new Map();this.phase='loot';this.nextFire=0;this.nextUtility=0;this.stats={paths:0,replans:0,offRouteReplans:0,pathMs:0,maxPathMs:0,stalls:0,unreachable:0,unreachableSamples:[],airborneDeferrals:0,airborneStalls:0};this.goal=null;this.path=[];this.progressAt=0}
 stopFor(p,intent){return moving(p)?zero(p):intent}
 evade(state,world){
  const p=state.self,danger=[...(state.telegraphs||[]),...(state.hazards||[]).filter(h=>h.active||h.warning)].find(h=>distance(p,h)<h.radius+1);if(!danger)return null;
  const candidates=[];for(let i=0;i<8;i++){const angle=this.index+i*Math.PI/4,x=Math.sin(angle),z=Math.cos(angle),point={x:p.x+x*2,y:p.y,z:p.z+z*2};if(!blocked(world,point.x,point.z,.5,p.y||0))candidates.push({x,z,score:distance(point,danger)})}candidates.sort((a,b)=>b.score-a.score);return candidates[0]?{type:'move',x:candidates[0].x,z:candidates[0].z,yaw:p.yaw||0,pitch:p.pitch||0}:null;
 }
 chooseLoot(state){
  const p=state.self,hasKey=[...p.equipment,...p.pack,...p.secure].some(it=>it.kind==='key');
  const choices=[...state.caches,...(state.bags||[]).map(b=>({...b,open:true,vault:false}))].filter(c=>!this.visited.has(c.id)&&(this.avoid.get(c.id)||0)<=state.serverTime&&(!c.vault||hasKey)&&(!c.open||c.items.some(it=>canRecoverGrant(it,this.account))));const current=choices.find(c=>c.id===this.lootGoal);if(current)return current;
  const next=choices.sort((a,b)=>Number(b.label===this.prioritySite)-Number(a.label===this.prioritySite)||distance(p,a)-distance(p,b))[0];this.lootGoal=next?.id;return next;
 }
 chooseExit(state){
  const p=state.self,carried=[...p.equipment,...p.pack,...p.secure],keys=carried.some(it=>it.kind==='key'),fuel=carried.filter(it=>it.material==='fuel').reduce((n,it)=>n+it.quantity,0);
  const choices=state.exits.filter(e=>{
   const s=exitState(e,state.serverTime);return s.phase==='open'&&s.available!==0||s.phase==='inbound'&&e.openAt-state.serverTime<90||s.phase==='ready'&&e.kind==='call'||s.phase==='locked'&&(e.kind==='key'&&keys||e.kind==='resource'&&fuel>=2);
  }).filter(e=>(this.avoid.get(e.id)||0)<=state.serverTime);const current=choices.find(e=>e.id===this.exitGoal);if(current)return current;const next=choices.sort((a,b)=>distance(p,a)+(exitState(a,state.serverTime).phase==='open'?0:20)-distance(p,b)-(exitState(b,state.serverTime).phase==='open'?0:20))[0];this.exitGoal=next?.id;return next;
 }
 navigate(state,world,target){
  const p=state.self,now=state.serverTime,key=target.id+':'+(target.y||0);
  if(p.grounded===false){this.airborneSince??=now;this.stats.airborneDeferrals++;if(now-this.airborneSince>3&&!this.airborneReported){this.stats.airborneStalls++;this.stats.lastAirborne=routeContext(state,world,target);this.airborneReported=true}this.goal=null;this.path=[];this.progressAt=now;this.progressPoint={x:p.x,y:p.y,z:p.z};this.lastNavigationAt=now;return zero(p)}
  this.airborneSince=null;this.airborneReported=false;
  if(this.lastNavigationAt!=null&&now-this.lastNavigationAt>.6){this.progressAt=now;this.progressPoint={x:p.x,y:p.y,z:p.z}}this.lastNavigationAt=now;
  if(this.path.length&&Math.abs((this.path[0].y||0)-(p.y||0))>.8){this.goal=null;this.path=[]}
  while(this.path.length&&distance(p,this.path[0])<.35)this.path.shift();
  if(this.path.length&&!canWalkSegment(world,p,this.path[0],{radius:OPERATOR_RADIUS})){this.stats.offRouteReplans++;this.stats.replans++;this.goal=null;this.path=[]}
  if(this.goal!==key||!this.path.length){const at=performance.now();this.path=findPath(world,p,target,{radius:OPERATOR_RADIUS,maxNodes:world.version===2?40000:16000});const elapsed=performance.now()-at;this.stats.paths++;this.stats.pathMs+=elapsed;this.stats.maxPathMs=Math.max(this.stats.maxPathMs,elapsed);this.goal=key;this.progressAt=now;this.progressPoint={x:p.x,y:p.y,z:p.z};if(!this.path.length){this.stats.unreachable++;if(this.stats.unreachableSamples.length<8)this.stats.unreachableSamples.push(routeContext(state,world,target));this.avoid.set(target.id,now+15);return zero(p)}}
  while(this.path.length&&distance(p,this.path[0])<.35)this.path.shift();
  if(distance(p,this.progressPoint)>.7){this.progressAt=now;this.progressPoint={x:p.x,y:p.y,z:p.z}}
  if(now-this.progressAt>3){this.stats.stalls++;this.stats.replans++;this.stats.lastStall={map:state.map,x:p.x,y:p.y||0,z:p.z,target:target.id,waypoint:this.path[0]||null};this.path=[];this.avoid.set(target.id,now+8);this.goal=null;return zero(p)}
  const next=this.path[0]||target,dx=next.x-p.x,dz=next.z-p.z,len=Math.max(.01,Math.hypot(dx,dz)),scale=Math.min(1,len/.8);return {type:'move',x:dx/len*scale,z:dz/len*scale,yaw:Math.atan2(dx,dz),pitch:0};
 }
 intent(state){
  const p=state.self,world=getWorld(state.map,state.mapVersion),now=state.serverTime;if(!world)throw new Error('Pilot cannot use an unsupported map');if(!p.alive||p.downed||p.board)return zero(p);
  const evade=this.evade(state,world);if(evade){this.goal=null;this.path=[];return evade;}
  const gear=[...p.equipment,...p.pack],weapon=gear.find(it=>it.id===p.weaponId)||gear.find(it=>it.kind==='weapon'),stats=weaponStats(weapon),med=gear.filter(it=>it.kind==='med'&&it.quantity>0&&(!p.combatVersion||p.combatVersion!==2||medicalNeed(p,it,now))).sort((a,b)=>Number(b.medical==null||b.medical==='trauma')-Number(a.medical==null||a.medical==='trauma'))[0];
  if((p.hp<65||p.wounds?.bleedingUntil>now||p.wounds?.limpUntil>now)&&med&&now>=(p.nextMedicalAt||0))return {type:'use',itemId:med.id};
  if(weapon&&p.weaponId!==weapon.id&&now>=this.nextFire)return this.stopFor(p,{type:'equip',itemId:weapon.id});
  if(p.ammo===0&&weapon){const other=gear.find(it=>it.kind==='weapon'&&it.id!==weapon.id&&it.loaded>0);if(other&&now>=this.nextFire)return this.stopFor(p,{type:'equip',itemId:other.id});if(gear.some(it=>it.kind==='ammo'&&it.ammo===stats.ammo&&it.quantity>0)&&now>=this.nextFire)return this.stopFor(p,{type:'reload'})}
  const threats=[...(state.machines||[]).map(m=>({...m,machine:true})),...(state.players||[]).filter(q=>q.team!==p.team)].filter(q=>distance(p,q)<Math.min(stats.range,q.machine?30:18)&&(!q.machine||q.kind!=='overlord'||q.state==='windup')&&clearLine(world,p.x,p.z,q.x,q.z,(p.y||0)+1.55,(q.y||0)+1)).sort((a,b)=>distance(p,a)-distance(p,b));
  const utility=gear.find(it=>it.kind==='utility'&&it.quantity>0);if(utility&&now>=this.nextUtility){
   const target=threats.find(t=>distance(p,t)>6&&distance(p,t)<18);
   if(utility.utility==='frag'&&target){const d=Math.hypot(target.x-p.x,target.z-p.z);return this.stopFor(p,{type:'throw',itemId:utility.id,yaw:Math.atan2(target.x-p.x,target.z-p.z),pitch:(d-10)/8})}
   if(utility.utility==='smoke'&&threats.length&&p.hp<80)return this.stopFor(p,{type:'throw',itemId:utility.id,yaw:p.yaw,pitch:-1});
   if(utility.utility==='decoy'&&!threats.length)return this.stopFor(p,{type:'throw',itemId:utility.id,yaw:p.yaw+Math.PI/2,pitch:0});
  }
  if(threats.length&&p.ammo>0){if(now<this.nextFire)return zero(p);const target=threats[0],height=target.machine?MACHINES[target.kind].core:1.25,horizontal=Math.max(.1,Math.hypot(target.x-p.x,target.z-p.z));return this.stopFor(p,{type:'fire',yaw:Math.atan2(target.x-p.x,target.z-p.z),pitch:Math.max(-1.2,Math.min(1.2,Math.atan2((target.y||0)+height-(p.y||0)-1.55,horizontal)))})}
  const secured=p.secure.length<p.secureCap&&p.pack.find(it=>!it.recovery&&['valuable','key','material','med','mod'].includes(it.kind));if(secured)return {type:'secure',itemId:secured.id};
  if(state.left<100||p.hp<30||p.pack.some(it=>it.kind==='contract')||p.pack.length>=3&&this.visited.size>=this.surveySites||p.pack.length>=p.cap)this.phase='extract';
  let target=this.phase==='extract'?this.chooseExit(state):this.chooseLoot(state);
  if(!target&&this.phase==='loot'){this.phase='extract';target=this.chooseExit(state)}
  if(!target)return zero(p);
  if(this.phase==='extract'&&distance(p,target)<2.6){const status=exitState(target,now);if(status.phase==='open')return this.stopFor(p,{type:'extract',exitId:target.id});if(status.phase==='ready')return this.stopFor(p,{type:'call',exitId:target.id});if(status.phase==='locked')return this.stopFor(p,{type:'unlock',exitId:target.id});return zero(p)}
  if(this.phase==='loot'&&distance(p,target)<2.5&&clearLine(world,p.x,p.z,target.x,target.z,(p.y||0)+1,(target.y||0)+.6)){
   if(target.searchRemaining!=null)return zero(p);
   if(!target.open)return this.stopFor(p,{type:'search',sourceId:target.id});
   this.visited.add(target.id);
   const useful=target.items.filter(it=>canRecoverGrant(it,this.account)&&(p.weight||0)+itemWeight(it)<=p.weightCap).sort((a,b)=>this.lootScore(b,stats)-this.lootScore(a,stats));
   if(useful.length&&p.pack.length<p.cap)return this.stopFor(p,{type:'take',sourceId:target.id,itemId:useful[0].id});
   this.goal=null;return zero(p);
  }
  return this.navigate(state,world,target);
 }
 lootScore(it,stats){return it.kind==='contract'?100:it.kind==='weapon'&&it.loaded?70:it.kind==='ammo'&&it.ammo===stats.ammo?60:it.kind==='key'?55:it.kind==='valuable'?45:it.kind==='med'?40:it.kind==='mod'?35:10}
 accepted(packet,state){const p=state.self,weapon=[...p.equipment,...p.pack].find(it=>it.id===p.weaponId);if(packet.type==='throw')this.nextUtility=state.serverTime+1.5;if(packet.type==='fire')this.nextFire=state.serverTime+weaponStats(weapon).delay;if(packet.type==='reload')this.nextFire=state.serverTime+weaponStats(weapon).reload;if(packet.type==='equip')this.nextFire=state.serverTime+.5}
 rejected(packet,state){if(packet.sourceId)this.avoid.set(packet.sourceId,state.serverTime+3);if(packet.exitId)this.avoid.set(packet.exitId,state.serverTime+3);if(packet.type==='fire'||packet.type==='reload')this.nextFire=state.serverTime+.5;this.goal=null;this.path=[]}
}
export function gameplayRejection(error){
 if(error.status!==409||!error.state||error.ack?.accepted!==false)return null;
 if(/Weapon not ready|Finish the current weapon action|Utility not ready/.test(error.message))return 'cooldown';
 if(error.message==='Protected pocket full'&&Array.isArray(error.state.self?.secure)&&error.state.self.secure.length>=error.state.self.secureCap)return 'capacity_changed';
 if(/Item already claimed|Loot out of reach|Item not in backpack|Item not owned/.test(error.message))return 'loot_changed';
 if(/Cache being searched|Cache out of reach/.test(error.message))return 'search_changed';
 if(/Exit is closed|Exit out of reach|already inbound|already open|No .* (uses|calls) remain/.test(error.message))return 'exit_changed';
 if(/Not enough extraction seats/.test(error.message))return 'seats_taken';
 if(/Medical supplies not ready|Nothing this supply can treat|Medkit not owned/.test(error.message))return 'treatment_changed';
 if(/Downed operators/.test(error.message))return 'downed';
 return null;
}
