import {raidLine,raidSight} from './raid-cover.mjs';
import {MACHINES,hazardState,mapConditions} from '../shared/raid-enemies.mjs';
import {WEAPONS,MODS} from '../shared/raid-catalog.mjs';
import {blocked,floorAt,supportAt} from '../shared/raid-worlds.mjs';
import {findPath,safePoint} from '../shared/raid-navigation.mjs';
import {item} from './rules.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y||0)-(b.y||0));
export const MACHINE_CAP=12;
export function event(raid,now,text,kind='info'){raid.eventSeq=(raid.eventSeq||0)+1;raid.events.push({id:raid.eventSeq,at:now,text,kind});if(raid.events.length>24)raid.events.shift()}
// Each machine owns a fixed four-point sweep around its home. The route is
// derived from the raid and machine ids, sampled on walkable support, and
// cached so patrols are reproducible across reconnects and server restarts.
export function machineRoute(raid,machine){
 if(Array.isArray(machine.route)&&machine.route.length>=3)return machine.route;
 const seed=(raid.id||'raid')+':'+machine.id,radius=Math.max(5,machine.patrolRadius||10),route=[];
 let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;
 const home=machine.home||machine;
 for(let slot=0;slot<4;slot++){
  value=(Math.imul(value,1664525)+1013904223)>>>0;
  const angle=(slot*Math.PI/2)+(value/4294967296-0.5)*.6;
  const ring=radius*(.45+(value%1000)/1000*.45);
  const point=safePoint(raid.world,home.x+Math.cos(angle)*ring,home.z+Math.sin(angle)*ring,{radius:.5,y:home.y||0,height:1.4});
  const previous=route.at(-1)||home;
  if(point&&!route.some(p=>distance(p,point)<1.5)&&findPath(raid.world,previous,{x:point.x,y:point.y||0,z:point.z},{radius:.5,height:1.4,maxNodes:640000}).length)route.push({x:point.x,y:point.y||0,z:point.z});
 }
 // A dense sector can block several samples; walk the home ring in fixed
 // steps until the route still has at least three reachable waypoints.
 for(let slot=0;route.length<3&&slot<8;slot++){
  const angle=slot*Math.PI/4,point=safePoint(raid.world,home.x+Math.cos(angle)*radius,home.z+Math.sin(angle)*radius,{radius:.5,y:home.y||0,height:1.4});
  if(point&&!route.some(p=>distance(p,point)<1.5)&&findPath(raid.world,home,{x:point.x,y:point.y||0,z:point.z},{radius:.5,height:1.4,maxNodes:640000}).length)route.push({x:point.x,y:point.y||0,z:point.z});
 }
 machine.route=route;return route;
}
export function scheduleReinforcement(raid,x,z,now,{kind='hunter',delay=12,reason='alert'}={}){
 const queue=raid.reinforcements||=[];const existing=queue.find(q=>q.reason===reason&&Math.hypot(q.x-x,q.z-z)<6);
 if(existing){existing.until=now+delay;return existing}
 const entry={at:now+delay,x,z,kind,reason,until:now+delay};
 queue.push(entry);
 event(raid,now,reason==='breach'?'Machine network response inbound to the breached armory.':'Machine network dispatching reinforcements to the contact.','alarm');
 return entry;
}
export function spawnMachine(raid,kind,x,z,now){
 const def=MACHINES[kind]||MACHINES.scout,point=safePoint(raid.world,x,z,{radius:def.radius,height:def.height,avoid:[...raid.world.spawns.map(([x,z])=>({x,z})),...[...raid.players.values()].filter(p=>p.alive)],distance:24});if(!point)return null;
 raid.machineSeq=(raid.machineSeq||0)+1;
 const machine={id:'machine_'+raid.machineSeq,kind,x:point.x,z:point.z,y:def.flight||point.y,hp:def.hp,maxHp:def.hp,yaw:0,nextAttack:now+5,state:'patrol',home:point,path:[],pathAt:0};raid.machines.push(machine);return machine;
}
const V5_MACHINE_POSITIONS={relay:[[-120,-80],[80,80],[100,-80],[-120,60],[0,160],[60,-180],[-80,140]],reservoir:[[-100,-80],[60,100],[100,-40],[-100,40],[0,180],[80,-200],[-100,180]],switchyard:[[-120,-40],[60,60],[120,-40],[-100,60],[-40,180],[80,-160],[-100,200]]};
export function populateMachines(raid,now){
 const version=raid.world.version||1,positions=version>=5
  ? V5_MACHINE_POSITIONS[raid.world.id].map(([x,z])=>[x*(version>=6?2:1),z*(version>=6?2:1)])
  : (raid.world.id==='relay'?[[-36,-28],[35,30],[36,-20],[-24,28],[-6,36],[18,-26],[-28,22]]:raid.world.id==='reservoir'?[[-30,-20],[34,30],[30,-38],[-32,28],[8,18],[34,-20],[-28,26]]:[[-34,-28],[32,30],[38,-28],[-24,30],[-6,30],[18,-26],[-28,22]]).map(([x,z])=>[x*(raid.world.size/160),z*(raid.world.size/160)]);
 ['scout','hunter','heavy','flyer','overlord'].forEach((kind,i)=>spawnMachine(raid,kind,...positions[i],now));
 spawnMachine(raid,'scout',...positions[5],now);spawnMachine(raid,'hunter',...positions[6],now);
 raid.conditions=raid.conditionPlan?conditionsAt(raid.world,raid.conditionPlan,0):mapConditions(raid.world,raid.id.charCodeAt(0));raid.lastLightPhase=raid.conditions.period;raid.telegraphs=[];raid.noises=[];raid.nextSupply=now+180;raid.nextPatrol=now+150;raid.weatherAt=now+300;raid.hazardTicks={};
}
function ratio(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}
const MACHINE_WEAPONS={scout:['pistol','smg'],hunter:['smg','ar','shotgun'],heavy:['shotgun','lmg'],flyer:['sniper','smg'],overlord:['ar','sniper','lmg']};
const MACHINE_AMMO_ROUNDS={light:30,medium:30,heavy:18,shell:12};
export function hitMachine(service,raid,machine,damage,hitY,team){
 const def=MACHINES[machine.kind]||MACHINES.scout,now=service.now();
 const weak=Math.abs(hitY-(machine.y||0)-def.core)<.35&&(machine.state==='windup'||!def.armor);
 machine.hp-=damage*(weak?2.5:1-def.armor);machine.hurtUntil=now+.15;
 if(machine.hp>0){if(machine.kind==='overlord'&&machine.hp<def.hp*.5&&!machine.enraged){machine.enraged=true;event(raid,now,'The Warden has opened its furnace core. Reinforcements inbound.','boss');spawnMachine(raid,'scout',machine.x+8,machine.z+4,now)}return}
 const roll=ratio((raid.id||'raid')+':'+machine.id),pool=MACHINE_WEAPONS[machine.kind]||['pistol'],weapon=pool[Math.floor(roll*pool.length)%pool.length],ammo=WEAPONS[weapon].ammo;
 const salvage=[item('valuable',{value:machine.kind==='overlord'?150:20,rarity:machine.kind==='overlord'?4:1}),item('material',{material:machine.kind==='flyer'?'wire':'steel',quantity:machine.kind==='overlord'?8:2}),item('weapon',{weapon,condition:35+Math.floor(roll*50),rarity:Math.max(1,Math.floor(roll*3)),loaded:WEAPONS[weapon].mag}),item('ammo',{ammo,quantity:Math.max(6,Math.round(MACHINE_AMMO_ROUNDS[ammo]*(.5+roll)))})];
 if(machine.kind==='overlord')salvage.push(item('mod',{mod:Object.keys(MODS)[Math.floor(roll*3)%3],rarity:3}));
 raid.bags.push({id:machine.id+'_salvage',x:machine.x,y:floorAt(raid.world,machine.x,machine.z,machine.y||0),z:machine.z,items:salvage});
 event(raid,now,def.name+' destroyed',machine.kind==='overlord'?'boss':'combat');
 const contact={x:machine.x,y:machine.y||0,z:machine.z,until:now+9};
 for(const other of raid.machines)if(other!==machine&&other.hp>0&&distance(other,machine)<55){other.investigate={...contact};other.state='investigate'}
 scheduleReinforcement(raid,machine.x,machine.z,now,{kind:machine.kind==='overlord'?'scout':'hunter',delay:machine.kind==='overlord'?8:14,reason:'destroyed:'+machine.id});
 for(const ally of raid.players.values())if(ally.alive&&ally.team===team&&distance(ally,machine)<60){ally.facts||={explorations:[],machines:0,bosses:0};ally.facts.machines++;ally.facts.mapMachines||={};ally.facts.mapMachines[raid.world.id]=(ally.facts.mapMachines[raid.world.id]||0)+1;if(machine.kind==='overlord')ally.facts.bosses++}
}
function visible(raid,m,p,def){
 if(!p.alive||(p.protectedUntil||0)>raid.now)return false;
 const range=def.sight*(raid.conditions?.visibility||1);if(distance(m,p)>range)return false;
 const angle=Math.atan2(p.x-m.x,p.z-m.z),delta=Math.abs(Math.atan2(Math.sin(angle-m.yaw),Math.cos(angle-m.yaw)));
 if(m.kind!=='scout'&&delta>Math.PI*.8&&distance(m,p)>5)return false;
 return raidSight(raid,m,p,{eye:Math.min(def.height*.65,2),body:p.downed?.35:1.1,head:p.downed?.5:1.7},raid.now);
}
function walk(raid,m,goal,def,dt,now){
 if(def.flight){const d=Math.hypot(goal.x-m.x,goal.z-m.z)||1;m.y=def.flight+Math.sin(now*1.3)*.5;m.x+=((goal.x-m.x)/d)*def.speed*dt;m.z+=((goal.z-m.z)/d)*def.speed*dt;return}
 if(now>=m.pathAt||!m.pathGoal||Math.hypot(goal.x-m.pathGoal.x,goal.z-m.pathGoal.z)>5){
  m.pathAt=now+2;m.pathGoal={x:goal.x,y:goal.y||0,z:goal.z};
  m.path=findPath(raid.world,m,m.pathGoal,{radius:def.radius,height:def.height,maxNodes:raid.world.version>=6?640000:raid.world.version>=5?60000:raid.world.version===4?24000:9000});
 }
 while(m.path?.length&&distance(m,m.path[0])<.75)m.path.shift();const target=m.path?.[0];if(!target)return;
 const dx=target.x-m.x,dz=target.z-m.z,d=Math.hypot(dx,dz)||1,step=Math.min(d,def.speed*dt),x=m.x+dx/d*step,z=m.z+dz/d*step;
 const y=supportAt(raid.world,x,z,(m.y||0)+.65,def.radius);if(!blocked(raid.world,x,z,def.radius,y,def.height)){m.x=x;m.z=z;m.y=y;m.yaw=Math.atan2(dx,dz)}
}
export function advanceMachines(service,raid,dt,now){
 raid.now=now;raid.telegraphs=(raid.telegraphs||[]).filter(t=>t.until>now);raid.noises=(raid.noises||[]).filter(n=>n.until>now);
 // Machine losses and armory breaches queue a bounded response. Spawning waits
 // until the arrival clock and never exceeds the sector's machine cap.
 const aliveMachines=()=>raid.machines.filter(m=>m.hp>0).length;
 for(const [index,order]of (raid.reinforcements||[]).entries())if(now>=order.at){
  if(aliveMachines()<MACHINE_CAP){
   const spawn=spawnMachine(raid,order.kind,order.x+(order.reason.startsWith('destroyed')?6:0),order.z+(order.reason.startsWith('destroyed')?4:0),now);
   if(spawn){spawn.investigate={x:order.x,y:order.y||0,z:order.z,until:now+16};spawn.state='investigate';event(raid,now,'A machine response team arrived at the contact.','alarm')}
  }
  raid.reinforcements.splice(index,1);break;
 }
 for(const m of raid.machines){
  if(m.hp<=0)continue;const def=MACHINES[m.kind]||MACHINES.scout;
  const target=[...raid.players.values()].filter(p=>visible(raid,m,p,def)).sort((a,b)=>distance(a,m)-distance(b,m))[0];
  if(target){m.lastSeen={x:target.x,y:target.y||0,z:target.z,until:now+6};m.target=target.account;m.yaw=Math.atan2(target.x-m.x,target.z-m.z);m.state=m.attack?'windup':'pursue';
   for(const other of raid.machines)if(other!==m&&other.hp>0&&distance(other,m)<18&&!other.lastSeen)other.investigate={...m.lastSeen,until:now+4};
  }
  if(m.attack){
   m.state='windup';if(now<m.attack.at)continue;
   const shot=m.attack;m.attack=null;m.nextAttack=now+def.cooldown*(m.enraged?.7:1);m.state='recover';
   if(def.attack==='pounce'&&raidLine(raid,m.x,m.z,shot.point.x,shot.point.z,(m.y||0)+1,(shot.point.y||0)+1)){
    const at=safePoint(raid.world,shot.point.x,shot.point.z,{radius:def.radius,height:def.height,y:shot.point.y||0});if(at){m.x=at.x;m.y=at.y;m.z=at.z}
   }
   for(const p of raid.players.values())if(p.alive&&distance(p,shot.point)<shot.radius&&raidLine(raid,shot.point.x,shot.point.z,p.x,p.z,(shot.point.y||0)+1,(p.y||0)+1))service.damage(raid,p,def.damage,{source:'machine'});
   continue;
  }
  if(target&&distance(m,target)<=def.range&&now>=m.nextAttack){
   const point={x:target.x,y:target.y||0,z:target.z},radius=['mortar','barrage'].includes(def.attack)?3.5:def.attack==='pounce'?2.3:1.15;
   m.attack={at:now+def.windup,point,radius};m.state='windup';raid.telegraphs.push({id:m.id+'_'+now,x:point.x,y:point.y,z:point.z,radius,until:m.attack.at,kind:def.attack});
   event(raid,now,def.name+' '+(def.attack==='pounce'?'is preparing to pounce':'is charging an attack'),'warning');continue;
  }
  if(target&&distance(m,target)>Math.max(3,def.range*.65)){walk(raid,m,target,def,dt,now);continue}
  if(target){if(def.flight)walk(raid,m,{x:target.x+Math.sin(now*.7)*14,z:target.z+Math.cos(now*.7)*14,y:target.y||0},def,dt,now);continue}
  const noise=raid.noises.find(n=>distance(m,n)<n.radius);if(noise)m.investigate={x:noise.x,y:noise.y||0,z:noise.z,until:now+5};
  const goal=m.lastSeen?.until>now?m.lastSeen:m.investigate?.until>now?m.investigate:null;
  if(goal){m.state='investigate';walk(raid,m,goal,def,dt,now)}
  else{
   m.target=null;m.lastSeen=null;m.state=m.guard?'guard':'patrol';
   const route=machineRoute(raid,m),home=m.home||m,fallback={x:home.x,y:home.y||0,z:home.z};
   if(!route.length)route.push(fallback);
   m.routeIndex=(m.routeIndex||0)%route.length;
   let waypoint=route[m.routeIndex];
   if(distance(m,waypoint)<1.1){m.routeIndex=(m.routeIndex+1)%route.length;waypoint=route[m.routeIndex]}
   walk(raid,m,waypoint||fallback,def,dt,now);
  }
 }
}
export function advanceEvents(service,raid,now){
 const alive=[...raid.players.values()].filter(p=>p.alive);if(!alive.length)return;
 if(raid.conditionPlan?.version===1&&raid.conditionsSecond!==Math.floor(now-raid.started)){
  raid.conditionsSecond=Math.floor(now-raid.started);raid.conditions=conditionsAt(raid.world,raid.conditionPlan,now-raid.started);
  if(raid.lastLightPhase!==raid.conditions.period){raid.lastLightPhase=raid.conditions.period;event(raid,now,raid.conditions.period[0].toUpperCase()+raid.conditions.period.slice(1)+' over the sector. Sight and machine detection follow visibility.','daylight')}
 }
 if(raid.conditionPlan&&raid.weatherAt&&now>=raid.weatherAt-30&&now<raid.weatherAt&&!raid.weatherWarned){raid.weatherWarned=true;event(raid,now,'Weather front approaching in '+Math.ceil(raid.weatherAt-now)+' seconds. Sight lines may change.','weather_warning')}
 if(raid.nextSupply&&now>=raid.nextSupply){
  raid.nextSupply=0;const at=raid.world.supply||{x:0,y:0,z:40};raid.caches.push({id:'supply',...at,open:true,vault:false,label:'Signal supply drop',items:[item('mod',{mod:'scope',rarity:3}),item('ammo',{ammo:'medium',quantity:60}),item('med',{quantity:2})]});event(raid,now,'A signal supply drop has landed. Other squads can see the beacon.','supply');
 }
 if(raid.nextPatrol&&now>=raid.nextPatrol){
  raid.nextPatrol=now+150;if(raid.machines.filter(m=>m.hp>0).length<12){const at=raid.world.caches[5]||[20,20];spawnMachine(raid,'hunter',at[0],at[1],now);event(raid,now,'A new machine patrol has entered the sector.','patrol')}
 }
 if(raid.weatherAt&&now>=raid.weatherAt){raid.weatherAt=0;if(raid.conditionPlan)event(raid,now,'Weather front arrived: '+raid.conditions.name+'.','weather');else{raid.conditions={...mapConditions(raid.world,1),name:'Nightfall front',light:.85,visibility:.65};event(raid,now,'Nightfall front incoming. Visibility is falling.','weather')}}
 for(const h of raid.world.hazards||[]){const state=hazardState(h,now-raid.started);if(!state.active)continue;
  for(const p of alive)if(distance(p,h)<h.radius&&(raid.hazardTicks[p.account+':'+h.id]||0)<=now){raid.hazardTicks[p.account+':'+h.id]=now+1;service.damage(raid,p,h.damage,{kind:'hazard'})}
 }
}
