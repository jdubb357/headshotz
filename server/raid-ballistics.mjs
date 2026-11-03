import {SHOT_EYE_HEIGHT,intersectBody,shotRays,distanceDamage,bulletClear} from '../shared/raid-ballistics.mjs';
import {MACHINES} from '../shared/raid-enemies.mjs';
import {hitMachine} from './raid-ai.mjs';
export function resolveShot(service,raid,shooter,stats){
 const origin={x:shooter.x,y:(shooter.y||0)+SHOT_EYE_HEIGHT,z:shooter.z},targets=[...raid.players.values()].filter(p=>p!==shooter&&p.alive&&p.team!==shooter.team).concat(raid.machines.filter(m=>m.hp>0)),hits=[];
 for(const ray of shotRays(shooter.yaw,shooter.pitch||0,stats,shooter.facts.roundsFired)){
  const candidates=targets.map(target=>({target,point:intersectBody(origin,ray.yaw,ray.pitch,target,target.account?.5:MACHINES[target.kind]?.radius||.65,target.account?(target.downed?.65:1.8):MACHINES[target.kind]?.height||2,stats.range)})).filter(hit=>hit.point).sort((a,b)=>a.point.distance-b.point.distance);
  const hit=candidates.find(({point})=>bulletClear(raid.world,origin,point));if(hit)hits.push(hit);
 }
 const groups=new Map();let pelletsHit=0,damageDealt=0;
 for(const {target,point}of hits){
  if(target.account){
   if((target.protectedUntil||0)>service.now())continue;
   const zone=point.y-(target.y||0)>1.6?'head':point.y-(target.y||0)<.65?'leg':'body',key=target.account+':'+zone;let group=groups.get(key);if(!group){group={target,zone,damage:0};groups.set(key,group)}group.damage+=distanceDamage(stats,point.distance)/(stats.pellets||1)*(zone==='head'?1.6:1);pelletsHit++;
  }else{pelletsHit++;if(target.hp>0){const before=Math.max(0,target.hp);hitMachine(service,raid,target,distanceDamage(stats,point.distance)/(stats.pellets||1),point.y,shooter.team);damageDealt+=before-Math.max(0,target.hp)}}
 }
 for(const {target,zone,damage}of groups.values())if(target.alive){const before=Math.max(0,target.hp),absorbed=target.facts?.damageAbsorbed||0;service.damage(raid,target,damage,{source:'operator',zone});damageDealt+=before-Math.max(0,target.hp)+Math.max(0,(target.facts?.damageAbsorbed||0)-absorbed)}
 if(pelletsHit)shooter.facts.shotsHit=(shooter.facts.shotsHit||0)+1;
 shooter.facts.pelletsFired=(shooter.facts.pelletsFired||0)+(stats.pellets||1);shooter.facts.pelletsHit=(shooter.facts.pelletsHit||0)+pelletsHit;shooter.facts.damageDealt=(shooter.facts.damageDealt||0)+damageDealt;
}
