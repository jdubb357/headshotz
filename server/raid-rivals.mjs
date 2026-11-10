import {raidSight} from './raid-cover.mjs';
import {WEAPONS} from '../shared/raid-catalog.mjs';
import {item} from './rules.mjs';
import {blocked,floorAt,supportAt} from '../shared/raid-worlds.mjs';
import {findPath,safePoint} from '../shared/raid-navigation.mjs';
import {event} from './raid-ai.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y||0)-(b.y||0));
function ratio(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}
const RIVALS=[
 {name:'Scavenger Ratchet',weapon:'smg',hp:95,sight:48,range:30,damage:12,cooldown:1.35,speed:4.8,route:['armory_0','armory_1','call']},
 {name:'Marauder Vex',weapon:'ar',hp:115,sight:58,range:38,damage:15,cooldown:1.8,speed:4.2,route:['armory_2','armory_1','transport']}
];
function targetOf(raid,rival){
 const id=rival.targets[rival.targetIndex%rival.targets.length];
 return raid.caches.find(c=>c.id===id)||raid.exits.find(e=>e.id===id)||null;
}
function rivalSees(raid,rival,player){
 if(!player.alive||player.downed||(player.protectedUntil||0)>raid.now)return false;
 if(distance(rival,player)>rival.sight*(raid.conditions?.visibility||1))return false;
 return raidSight(raid,rival,player,{eye:1.6,body:1.1,head:1.7},raid.now);
}
function walkRival(raid,rival,goal,dt,now){
 if(now>=rival.pathAt||!rival.pathGoal||distance(goal,rival.pathGoal)>5){
  rival.pathAt=now+2.5;rival.pathGoal={x:goal.x,y:goal.y||0,z:goal.z};
  rival.path=findPath(raid.world,rival,{x:goal.x,y:goal.y||0,z:goal.z},{radius:.5,height:1.8,maxNodes:640000});
 }
 while(rival.path?.length&&distance(rival,rival.path[0])<.8)rival.path.shift();
 const target=rival.path?.[0];if(!target)return;
 const dx=target.x-rival.x,dz=target.z-rival.z,d=Math.hypot(dx,dz)||1,step=Math.min(d,rival.speed*dt),x=rival.x+dx/d*step,z=rival.z+dz/d*step;
 const y=supportAt(raid.world,x,z,(rival.y||0)+.65,.5);
 if(!blocked(raid.world,x,z,.5,y,1.8)){rival.x=x;rival.y=y;rival.z=z;rival.yaw=Math.atan2(dx,dz)}
}
function contest(raid,rival,target,now){
 if(!target||rival.contestedId===target.id)return;
 rival.contestedId=target.id;rival.holdUntil=now+(target.weaponCache?18:14);
 if(target.weaponCache){target.rivalContestedBy=rival.id;target.rivalContestedUntil=rival.holdUntil;event(raid,now,rival.name+' is contesting '+target.label+'.','warning');return}
 target.rivalContestedUntil=rival.holdUntil;event(raid,now,rival.name+' is watching the '+(target.name||target.kind)+' extraction exit.','warning');
}
export function populateRivals(raid,now){
 if(Array.isArray(raid.rivals)&&raid.rivals.length)return raid.rivals;
 const avoid=[...raid.world.spawns.map(([x,z])=>({x,z})),...[...raid.players.values()].filter(p=>p.alive)];
 raid.rivals=RIVALS.map((def,index)=>{
  const first=raid.caches.find(c=>c.id===def.route[0]);
  const fallback=raid.exits.find(e=>e.id===def.route[0])||raid.exits[0]||{x:0,z:0};
  const base=first||fallback,side=index?-12:12;
  const point=safePoint(raid.world,base.x+side,base.z+(index?10:-10),{radius:.5,y:0,height:1.8,avoid,distance:12})||safePoint(raid.world,base.x+side,base.z+(index?10:-10),{radius:.5,y:0,height:1.8})||{x:base.x+side,y:0,z:base.z+(index?10:-10)};
  return {id:'rival_'+(index+1),name:def.name,rival:true,weapon:def.weapon,hp:def.hp,maxHp:def.hp,x:point.x,y:point.y||0,z:point.z,yaw:0,alive:true,state:'scavenge',speed:def.speed,sight:def.sight,range:def.range,damage:def.damage,cooldown:def.cooldown,nextFire:now+2,nextAttack:0,attack:null,path:[],pathAt:0,pathGoal:null,targets:def.route,targetIndex:0,contestedId:null,holdUntil:0,nextContestAt:now+2,hurtUntil:0};
 });
 return raid.rivals;
}
export function hitRival(raid,rival,damage,hitY,now=raid.now){
 if(!rival.alive||rival.hp<=0)return true;
 rival.hp-=damage*(hitY-(rival.y||0)>1.7?1.5:1);rival.hurtUntil=now+.2;
 if(rival.hp>0)return true;
 rival.hp=0;rival.alive=false;rival.state='down';rival.attack=null;rival.path=[];
 const roll=ratio((raid.id||'raid')+':rival:'+rival.id),weapon=rival.weapon||'smg',ammo=WEAPONS[weapon]?.ammo||'light';
 raid.bags.push({id:rival.id+'_salvage',x:rival.x,y:floorAt(raid.world,rival.x,rival.z,rival.y||0),z:rival.z,kind:'rival',label:rival.name+' salvage',items:[
  item('weapon',{weapon,condition:35+Math.floor(roll*50),rarity:2,loaded:WEAPONS[weapon]?.mag||30}),
  item('ammo',{ammo,quantity:Math.round(({light:30,medium:30,heavy:18,shell:12}[ammo]||30)*(.5+roll))})
 ]});
 event(raid,now,rival.name+' eliminated','combat');
 return false;
}
export function advanceRivals(service,raid,dt,now){
 raid.now=now;
 for(const rival of raid.rivals||[]){
  if(!rival.alive)continue;
  rival.hurtUntil=Math.max(0,rival.hurtUntil||0);
  const player=[...raid.players.values()].filter(p=>rivalSees(raid,rival,p)).sort((a,b)=>distance(rival,a)-distance(rival,b))[0];
  if(player){
   rival.state='engage';rival.yaw=Math.atan2(player.x-rival.x,player.z-rival.z);
   if(rival.attack){
    rival.state='windup';if(now<rival.attack.at)continue;
    const shot=rival.attack;rival.attack=null;rival.nextFire=now+rival.cooldown;
    const current=raid.players.get(shot.account);
    if(current&&rivalSees(raid,rival,current)&&distance(rival,current)<=rival.range){
     service.damage(raid,current,rival.damage,{source:'rival',zone:'body'});
    }
    continue;
   }
   if(distance(rival,player)<=rival.range){
    if(now>=rival.nextFire){rival.nextFire=now+rival.cooldown;rival.attack={at:now+.45,account:player.account};rival.state='windup'}
    else rival.state='aim';
    continue;
   }
   // Inside sight but outside weapon range: close the gap, then fire.
   walkRival(raid,rival,player,dt,now);continue;
  }
  rival.attack=null;
  let target=targetOf(raid,rival);
  if(!target){rival.targetIndex=0;target=targetOf(raid,rival)}
  if(!target)continue;
  if(distance(rival,target)>5){rival.state='scavenge';walkRival(raid,rival,target,dt,now);continue}
  if(rival.contestedId!==target.id)contest(raid,rival,target,now);
  rival.state=target.weaponCache?'search':'watch';
  if(now>=rival.holdUntil){rival.targetIndex=(rival.targetIndex+1)%rival.targets.length;rival.contestedId=null;rival.holdUntil=0;rival.nextContestAt=now+2}
 }
}
export function rivalSnapshotData(raid,observer,serverTime,visibility,needsSight){
 if(!observer)return [];
 return (raid.rivals||[]).filter(r=>r.alive&&needsSight(r,observer,serverTime)&&Math.hypot(observer.x-r.x,observer.z-r.z)<Math.max(30,90*visibility)).map(r=>({id:r.id,name:r.name,weapon:r.weapon,x:r.x,y:r.y||0,z:r.z,yaw:r.yaw||0,hp:Math.max(0,r.hp),maxHp:r.maxHp,state:r.state,rival:true,team:'scavenger'}));
}
