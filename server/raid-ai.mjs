import {raidLine,raidSight} from './raid-cover.mjs';
import {MACHINES,hazardState,mapConditions,bossPhaseFor} from '../shared/raid-enemies.mjs';
import {WEAPONS,MODS} from '../shared/raid-catalog.mjs';
import {blocked,floorAt,supportAt} from '../shared/raid-worlds.mjs';
import {findPath,safePoint} from '../shared/raid-navigation.mjs';
import {item} from './rules.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y||0)-(b.y||0));
export const MACHINE_CAP=12;
// Encounter escalation tuning. Alarm responses are deliberately bounded: the
// sector can only field MACHINE_CAP living machines, and every wave entry is
// staggered so a single frame cannot spawn an arbitrary number of contacts.
export const ESCALATION={alarmWaveCap:4,eliteInterval:180,eliteCap:3,hazardWindowInterval:150,hazardWarning:18,hazardDuration:22,hazardDamage:2,squeezeLead:180,squeezeWaveInterval:45};
// A weak-point hit while a machine charges its attack pushes that attack and
// its telegraph back. The per-charge cap keeps a sustained burst from freezing
// the machine indefinitely; the counter resets on resolution or next charge.
export const STAGGER={delay:.22,hits:3};
const HAZARD_WINDOWS={
 relay:{name:'Ashfall squall',damage:2,radius:26},
 reservoir:{name:'Acid rain cell',damage:2,radius:24},
 switchyard:{name:'Arc-flash storm',damage:3,radius:22}
};
const machineDef=machine=>{
 const base=MACHINES[machine.kind]||MACHINES.scout;
 if(!machine.elite)return base;
 return {...base,hp:machine.maxHp||Math.round(base.hp*1.4),maxHp:machine.maxHp||Math.round(base.hp*1.4),sight:(base.sight||0)+8,range:Math.round((base.range||0)*1.15),damage:Math.round((base.damage||0)*1.35),cooldown:Math.max(1,(base.cooldown||3)*.85),speed:(base.speed||0)*1.18,armor:Math.min(.7,(base.armor||0)+.1)};
};
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
export function scheduleReinforcement(raid,x,z,now,{kind='hunter',delay=12,reason='alert',count=1,elite=false}={}){
 const queue=raid.reinforcements||=[];const existing=queue.find(q=>q.reason===reason||q.reason?.startsWith(reason+'#'));
 if(existing){existing.at=now+delay;existing.until=existing.at;return existing}
 const wave=Math.max(1,Math.min(ESCALATION.alarmWaveCap,count)),entries=[];
 for(let i=0;i<wave;i++){
  const entry={at:now+delay+i*3,x,z,kind:i===0?kind:(kind==='heavy'?'hunter':'scout'),reason:i?reason+'#'+i:reason,until:now+delay+i*3,elite:!!elite&&i===0};
  queue.push(entry);entries.push(entry);
 }
 event(raid,now,(wave>1?'Machine network is dispatching a '+wave+'-unit response wave.':'Machine network dispatching reinforcements to the contact.'),(reason.startsWith('breach')?'alarm':'alarm'));
 return entries[0];
}
// Every alarm response grows one layer stronger, capped at four units. Elite
// hunters replace the point unit on every third alarm so a contested sector
// escalates instead of merely spawning more identical patrols.
export function escalate(raid,now,x,z,reason){
 raid.alarms=(raid.alarms||0)+1;
 const level=Math.min(4,Math.ceil(raid.alarms/2));
 if(level>(raid.alarmLevel||0)){raid.alarmLevel=level;event(raid,now,'Machine security response escalating to threat level '+level+'.','escalation')}
 return scheduleReinforcement(raid,x,z,now,{kind:'hunter',delay:12+3*(level-1),reason,count:Math.min(ESCALATION.alarmWaveCap,Math.ceil(raid.alarms/2)+1),elite:raid.alarms>=3&&raid.alarms%3===0});
}
export function spawnMachine(raid,kind,x,z,now,options={}){
 const def=MACHINES[kind]||MACHINES.scout,point=safePoint(raid.world,x,z,{radius:def.radius,height:def.height,avoid:[...raid.world.spawns.map(([x,z])=>({x,z})),...[...raid.players.values()].filter(p=>p.alive)],distance:24});if(!point)return null;
 raid.machineSeq=(raid.machineSeq||0)+1;
 const elite=options.elite===true,hp=elite?Math.round(def.hp*1.4):def.hp;
 const machine={id:'machine_'+raid.machineSeq,kind,x:point.x,z:point.z,y:def.flight||point.y,hp,maxHp:hp,yaw:0,nextAttack:now+5,state:'patrol',home:point,path:[],pathAt:0,bossPhase:kind==='overlord'?'approach':null,elite};
 if(elite){machine.speed=(def.speed||0)*1.18;machine.sight=(def.sight||0)+8;machine.range=Math.round((def.range||0)*1.15);machine.damage=Math.round((def.damage||0)*1.35);machine.cooldown=Math.max(1,(def.cooldown||3)*.85)}
 raid.machines.push(machine);return machine;
}
// Elite sweeps are periodic and bounded. They spawn at a cache or exit anchor
// and investigate it, giving squads a recognisable patrol rather than a
// nameless extra bot.
export function spawnElitePatrol(raid,now){
 const machines=raid.machines||[],cap=ESCALATION.eliteCap;
 if(machines.filter(m=>m.hp>0&&m.elite).length>=cap)return null;
 const anchors=[...(raid.caches||[]),...(raid.exits||[])];
 if(!anchors.length)return null;
 const pick=anchors[Math.floor(ratio((raid.id||'raid')+':elite:'+(raid.eliteSpawns||0))*anchors.length)%anchors.length];
 const machine=spawnMachine(raid,'hunter',pick.x+14,pick.z-12,now,{elite:true});
 if(!machine)return null;
 raid.eliteSpawns=(raid.eliteSpawns||0)+1;
 machine.sweeping=true;machine.investigate={x:pick.x,y:pick.y||0,z:pick.z,until:now+60};
 event(raid,now,'An elite Prowler patrol is sweeping the sector.','elite');
 return machine;
}
const V5_MACHINE_POSITIONS={relay:[[-120,-80],[80,80],[100,-80],[-120,60],[0,160],[60,-180],[-80,140]],reservoir:[[-100,-80],[60,100],[100,-40],[-100,40],[0,180],[80,-200],[-100,180]],switchyard:[[-120,-40],[60,60],[120,-40],[-100,60],[-40,180],[80,-160],[-100,200]]};
export function populateMachines(raid,now){
 const version=raid.world.version||1,positions=version>=5
  ? V5_MACHINE_POSITIONS[raid.world.id].map(([x,z])=>[x*(version>=6?2:1),z*(version>=6?2:1)])
  : (raid.world.id==='relay'?[[-36,-28],[35,30],[36,-20],[-24,28],[-6,36],[18,-26],[-28,22]]:raid.world.id==='reservoir'?[[-30,-20],[34,30],[30,-38],[-32,28],[8,18],[34,-20],[-28,26]]:[[-34,-28],[32,30],[38,-28],[-24,30],[-6,30],[18,-26],[-28,22]]).map(([x,z])=>[x*(raid.world.size/160),z*(raid.world.size/160)]);
 ['scout','hunter','heavy','flyer','overlord'].forEach((kind,i)=>spawnMachine(raid,kind,...positions[i],now));
 // Keep one of the two trailing contacts: the insertion route authors its own
 // scout/hunter pair, so one far base patrol slot stays free for them.
 spawnMachine(raid,'hunter',...positions[6],now);
 raid.conditions=raid.conditionPlan?conditionsAt(raid.world,raid.conditionPlan,0):mapConditions(raid.world,raid.id.charCodeAt(0));raid.lastLightPhase=raid.conditions.period;raid.telegraphs=[];raid.noises=[];raid.nextSupply=now+180;raid.nextPatrol=now+150;raid.weatherAt=now+300;raid.hazardTicks={};
 raid.alarms=0;raid.alarmLevel=0;raid.dynamicHazards=[];raid.nextElite=now+ESCALATION.eliteInterval;raid.nextHazardWindow=now+ESCALATION.hazardWindowInterval;raid.nextSqueeze=0;raid.squeezeAt=0;raid.eliteSpawns=0;raid.hazardWindows=0;
}
function ratio(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}
const MACHINE_WEAPONS={scout:['pistol','smg'],hunter:['smg','ar','shotgun'],heavy:['shotgun','lmg'],flyer:['sniper','smg'],overlord:['ar','sniper','lmg']};
const MACHINE_AMMO_ROUNDS={light:30,medium:30,heavy:18,shell:12};
const bossCapLeft=raid=>raid.machines.filter(m=>m.hp>0).length<MACHINE_CAP;
function addBossHazard(raid,machine,phase,now){
 const hazards=raid.phaseHazards||=[],id='warden_'+phase+'_'+machine.id;
 if(hazards.some(h=>h.id===id))return;
 const shape=phase==='furnace'?{name:'Furnace vent',radius:9,damage:4,until:now+14}:{name:'Meltdown core',radius:14,damage:7,until:now+18};
 hazards.push({id,name:shape.name,x:machine.x,y:machine.y||0,z:machine.z,radius:shape.radius,damage:shape.damage,until:shape.until,phase,boss:machine.id});
}
export function advanceBossPhase(raid,machine,now){
 if(machine.kind!=='overlord'||machine.hp<=0)return;
 const order=['approach','furnace','meltdown'],target=bossPhaseFor(machine),goal=order.indexOf(target);
 let index=order.indexOf(machine.bossPhase||'approach');
 // A single overwhelming hit still steps through every threshold so clients never
 // miss a phase, and each arrival emits exactly one event.
 while(index<goal){
  index++;machine.bossPhase=order[index];addBossHazard(raid,machine,machine.bossPhase,now);
  if(machine.bossPhase==='furnace'){
   machine.enraged=true;
   event(raid,now,'The Warden has opened its furnace core. Reinforcements inbound.','boss');
   if(bossCapLeft(raid))spawnMachine(raid,'scout',machine.x+8,machine.z+4,now);
  }else{
   machine.enraged=true;
   event(raid,now,"The Warden's core is exposed. Meltdown venting — heavy response inbound.",'boss');
   if(bossCapLeft(raid))spawnMachine(raid,'heavy',machine.x-9,machine.z-5,now);
  }
 }
}
export function hitMachine(service,raid,machine,damage,hitY,team){
 const def=machineDef(machine),now=service.now(),phase=machine.kind==='overlord'?(machine.bossPhase||'approach'):null;
 // The meltdown core is exposed: core hits always count as weak and body hits
 // keep less armor, so the boss is vulnerable without waiting for a windup.
 const armor=phase==='meltdown'?.3:phase==='furnace'?.55:def.armor;
 const weak=Math.abs(hitY-(machine.y||0)-def.core)<.35&&(phase==='meltdown'||machine.state==='windup'||!def.armor);
 machine.hp-=damage*(weak?2.5:1-armor);machine.hurtUntil=now+(weak?.32:.15);
 // A core hit before a charged attack resolves staggers it: the telegraphed
 // attack and its warning ring move back by a fixed delay, capped so sustained
 // fire can never hold a machine in an indefinite windup. The counter resets
 // when the attack fires or a new charge starts.
 let staggered=false;
 if(machine.hp>0&&weak&&machine.attack&&machine.attack.at>now&&(machine.staggerHits||0)<STAGGER.hits){
  machine.staggerHits=(machine.staggerHits||0)+1;machine.attack.at+=STAGGER.delay;staggered=true;
  machine.nextAttack=Math.max(machine.nextAttack||0,machine.attack.at);
  const telegraph=(raid.telegraphs||[]).find(t=>t.id===machine.attack.telegraph);
  if(telegraph)telegraph.until=machine.attack.at;
 }
 if(machine.hp>0){advanceBossPhase(raid,machine,now);return {weak,staggered,killed:false}}
 const roll=ratio((raid.id||'raid')+':'+machine.id),pool=MACHINE_WEAPONS[machine.kind]||['pistol'],weapon=pool[Math.floor(roll*pool.length)%pool.length],ammo=WEAPONS[weapon].ammo;
 const salvage=[item('valuable',{value:machine.kind==='overlord'?150:20,rarity:machine.kind==='overlord'?4:1}),item('material',{material:machine.kind==='flyer'?'wire':'steel',quantity:machine.kind==='overlord'?8:2}),item('weapon',{weapon,condition:35+Math.floor(roll*50),rarity:Math.max(1,Math.floor(roll*3)),loaded:WEAPONS[weapon].mag}),item('ammo',{ammo,quantity:Math.max(6,Math.round(MACHINE_AMMO_ROUNDS[ammo]*(.5+roll)))})];
 if(machine.kind==='overlord')salvage.push(item('mod',{mod:Object.keys(MODS)[Math.floor(roll*3)%3],rarity:3}));
 if(machine.elite)salvage.push(item('valuable',{value:75,rarity:3}),item('mod',{mod:Object.keys(MODS)[Math.floor(roll*5)%3],rarity:2}));
 raid.bags.push({id:machine.id+'_salvage',x:machine.x,y:floorAt(raid.world,machine.x,machine.z,machine.y||0),z:machine.z,kind:'machine',label:def.name+' salvage',items:salvage});
 event(raid,now,(machine.elite?'Elite ':'')+def.name+' destroyed',machine.kind==='overlord'?'boss':'combat');
 const contact={x:machine.x,y:machine.y||0,z:machine.z,until:now+9};
 for(const other of raid.machines)if(other!==machine&&other.hp>0&&distance(other,machine)<55){other.investigate={...contact};other.state='investigate'}
 escalate(raid,now,machine.x,machine.z,'destroyed:'+machine.id);
 for(const ally of raid.players.values())if(ally.alive&&ally.team===team&&distance(ally,machine)<60){ally.facts||={explorations:[],machines:0,bosses:0};ally.facts.machines++;ally.facts.mapMachines||={};ally.facts.mapMachines[raid.world.id]=(ally.facts.mapMachines[raid.world.id]||0)+1;if(machine.kind==='overlord')ally.facts.bosses++}
 return {weak,staggered,killed:true};
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
   const spawn=spawnMachine(raid,order.kind,order.x+(order.reason.startsWith('destroyed')?6:0),order.z+(order.reason.startsWith('destroyed')?4:0),now,{elite:order.elite});
   if(spawn){spawn.investigate={x:order.x,y:order.y||0,z:order.z,until:now+16};spawn.state='investigate';event(raid,now,'A machine response team arrived at the contact.','alarm')}
  }
  raid.reinforcements.splice(index,1);break;
 }
 for(const m of raid.machines){
  if(m.hp<=0)continue;const def=machineDef(m);
  const target=[...raid.players.values()].filter(p=>visible(raid,m,p,def)).sort((a,b)=>distance(a,m)-distance(b,m))[0];
  if(target){m.lastSeen={x:target.x,y:target.y||0,z:target.z,until:now+6};m.target=target.account;m.yaw=Math.atan2(target.x-m.x,target.z-m.z);m.state=m.attack?'windup':'pursue';
   for(const other of raid.machines)if(other!==m&&other.hp>0&&distance(other,m)<18&&!other.lastSeen)other.investigate={...m.lastSeen,until:now+4};
  }
  if(m.attack){
   m.state='windup';if(now<m.attack.at)continue;
   const shot=m.attack,from={x:m.x,z:m.z};m.attack=null;m.staggerHits=0;m.nextAttack=now+def.cooldown*(m.bossPhase==='meltdown'?.55:m.enraged?.7:1);m.state='recover';
   if(def.attack==='pounce'&&raidLine(raid,m.x,m.z,shot.point.x,shot.point.z,(m.y||0)+1,(shot.point.y||0)+1)){
    const at=safePoint(raid.world,shot.point.x,shot.point.z,{radius:def.radius,height:def.height,y:shot.point.y||0});if(at){m.x=at.x;m.y=at.y;m.z=at.z}
   }
   for(const p of raid.players.values())if(p.alive&&distance(p,shot.point)<shot.radius&&raidLine(raid,shot.point.x,shot.point.z,p.x,p.z,(shot.point.y||0)+1,(p.y||0)+1))service.damage(raid,p,def.damage,{source:'machine',from});
   continue;
  }
  if(target&&distance(m,target)<=def.range&&now>=m.nextAttack){
   const point={x:target.x,y:target.y||0,z:target.z},radius=['mortar','barrage'].includes(def.attack)?3.5:def.attack==='pounce'?2.3:1.15;
   m.attack={at:now+def.windup,point,radius,telegraph:m.id+'_'+now};m.staggerHits=0;m.state='windup';raid.telegraphs.push({id:m.attack.telegraph,x:point.x,y:point.y,z:point.z,radius,until:m.attack.at,kind:def.attack});
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
function createHazardWindow(raid,now){
 const def=HAZARD_WINDOWS[raid.world.id]||{name:'Containment breach',damage:2,radius:24};
 const anchors=[...(raid.caches||[]).filter(c=>!c.open),...(raid.exits||[])];
 const index=(raid.hazardWindows||0)%Math.max(1,anchors.length),base=anchors[index]||{x:0,z:0,y:0},sign=index%2?1:-1;
 const at=safePoint(raid.world,base.x+12*sign,base.z-12*sign,{radius:.5,y:base.y||0,height:1.2})||{x:base.x,y:base.y||0,z:base.z};
 raid.hazardWindows=(raid.hazardWindows||0)+1;
 return {id:'front_'+raid.id+'_'+raid.hazardWindows,name:def.name,x:at.x,y:at.y||0,z:at.z,radius:def.radius,damage:def.damage,start:now+ESCALATION.hazardWarning,until:now+ESCALATION.hazardWarning+ESCALATION.hazardDuration,boss:null};
}
export function advanceEvents(service,raid,now){
 const alive=[...raid.players.values()].filter(p=>p.alive);if(!alive.length)return;
 if(raid.nextElite&&now>=raid.nextElite){raid.nextElite=now+ESCALATION.eliteInterval;spawnElitePatrol(raid,now)}
 if(raid.nextHazardWindow&&now>=raid.nextHazardWindow){
  raid.nextHazardWindow=now+ESCALATION.hazardWindowInterval;
  const hazard=createHazardWindow(raid,now);(raid.dynamicHazards||=[]).push(hazard);
  event(raid,now,hazard.name+' warning. The front reaches the sector in '+Math.round(hazard.start-now)+' seconds.', 'hazard_warning');
 }
 const squeezeLeft=raid.deadline-now;
 if(!raid.squeezeAt&&squeezeLeft>0&&squeezeLeft<=ESCALATION.squeezeLead){
  raid.squeezeAt=now;raid.squeezeSeq=0;raid.nextSqueeze=now;
  event(raid,now,'Containment is closing. Every extraction site is contested — chain of command movements are being detected.','squeeze');
 }
 if(raid.squeezeAt&&squeezeLeft>0&&now>=raid.nextSqueeze&&raid.machines.filter(m=>m.hp>0).length<MACHINE_CAP){
  raid.nextSqueeze=now+ESCALATION.squeezeWaveInterval;
  const exits=[...raid.exits].sort((a,b)=>String(a.id).localeCompare(String(b.id))),exit=exits[(raid.squeezeSeq||0)%Math.max(1,exits.length)];
  raid.squeezeSeq=(raid.squeezeSeq||0)+1;
  if(exit){
   const machine=spawnMachine(raid,'hunter',exit.x+18,exit.z+12,now,{elite:true});
   if(machine){machine.ambush=true;machine.patrolRadius=10;machine.investigate={x:exit.x,y:exit.y||0,z:exit.z,until:now+30}}
   event(raid,now,'Sector collapse in '+Math.ceil(squeezeLeft)+'s. Extraction is contested · elite ambush inbound.','squeeze');
  }
 }
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
  for(const p of alive)if(distance(p,h)<h.radius&&(raid.hazardTicks[p.account+':'+h.id]||0)<=now){raid.hazardTicks[p.account+':'+h.id]=now+1;service.damage(raid,p,h.damage,{kind:'hazard',from:{x:h.x,z:h.z}})}
 }
 // Boss phase hazards are authored by authoritative phase transitions rather
 // than the world; each id is ticked once a second like a static hazard.
 for(const h of raid.phaseHazards||[]){
  if(h.until<=now)continue;
  for(const p of alive)if(distance(p,h)<h.radius&&(raid.hazardTicks[p.account+':'+h.id]||0)<=now){raid.hazardTicks[p.account+':'+h.id]=now+1;service.damage(raid,p,h.damage,{kind:'hazard',from:{x:h.x,z:h.z}})}
 }
 for(const h of raid.dynamicHazards||[]){
  if(now>=h.until)continue;
  if(now>=h.start&&!h.announced){h.announced=true;event(raid,now,h.name+' is active · '+Math.round(h.until-now)+' seconds.','hazard')}
  if(now<h.start)continue;
  for(const p of alive)if(distance(p,h)<h.radius&&(raid.hazardTicks[p.account+':'+h.id]||0)<=now){raid.hazardTicks[p.account+':'+h.id]=now+1;service.damage(raid,p,h.damage,{kind:'hazard',from:{x:h.x,z:h.z}})}
 }
 raid.dynamicHazards=(raid.dynamicHazards||[]).filter(h=>h.until>now);
}
