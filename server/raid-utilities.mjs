import {raidLine} from './raid-cover.mjs';
import {randomUUID} from 'node:crypto';
import {UTILITIES} from '../shared/raid-utilities.mjs';
import {floorAt,blocked} from '../shared/raid-worlds.mjs';
import {requireRule} from './rules.mjs';
import {hitMachine,event} from './raid-ai.mjs';
export function throwUtility(service,raid,p,message,now){
 const list=[p.equipment,p.pack].find(items=>items.some(it=>it.id===message.itemId&&it.kind==='utility'&&it.quantity>0)),it=list?.find(it=>it.id===message.itemId),def=UTILITIES[it?.utility];
 requireRule(def,'Utility not owned');requireRule(now>=(p.nextUtility||0),'Utility not ready');
 raid.utilities=(raid.utilities||[]).filter(e=>e.until>now);requireRule(raid.utilities.length<48&&raid.utilities.filter(e=>e.owner===p.account).length<12,'Too many active utilities');
 const yaw=message.yaw??p.yaw,pitch=Math.max(-1.2,Math.min(1.2,message.pitch??p.pitch??0)),range=Math.max(3,Math.min(18,10+pitch*8)),originY=(p.y||0)+1.5;
 let point={x:p.x,y:p.y||0,z:p.z};
 // The server derives a short placement ray; clients cannot supply a target,
 // radius, damage, timer or ownership. Stop before cover, never through a roof.
 for(let d=.4;d<=range;d+=.4){
  const x=p.x+Math.sin(yaw)*d,z=p.z+Math.cos(yaw)*d,y=floorAt(raid.world,x,z,originY);
  if(blocked(raid.world,x,z,.15,y,.3)||!raidLine(raid,p.x,p.z,x,z,originY,y+.3))break;
  point={x,y,z};
 }
 it.quantity--;if(!it.quantity)list.splice(list.indexOf(it),1);p.nextUtility=now+1.5;p.protectedUntil=0;p.facts.utilitiesUsed=(p.facts.utilitiesUsed||0)+1;
 raid.utilities.push({id:randomUUID(),kind:it.utility,...point,radius:def.radius,activeAt:now+def.fuse,until:now+def.fuse+def.duration,owner:p.account,team:p.team,nextPulse:now+def.fuse,detonated:false});
 event(raid,now,def.name+' deployed','utility');
}
export function advanceUtilities(service,raid,now){
 for(const e of raid.utilities||[]){
  if(now<e.activeAt||now>=e.until&&e.kind!=='frag')continue;
  if(e.kind==='decoy'&&now>=e.nextPulse){raid.noises||=[];raid.noises.push({x:e.x,y:e.y,z:e.z,radius:e.radius,until:now+1.1});e.nextPulse=now+1}
  if(e.kind!=='frag'||e.detonated)continue;e.detonated=true;
  for(const p of raid.players.values())if(p.alive&&(p.team!==e.team||p.account===e.owner)){
   const distance=Math.hypot(p.x-e.x,p.z-e.z,(p.y||0)-e.y);if(distance<e.radius&&raidLine(raid,e.x,e.z,p.x,p.z,e.y+.3,(p.y||0)+1))service.damage(raid,p,70*(1-distance/e.radius),{kind:'blast'});
  }
  for(const m of raid.machines)if(m.hp>0){const distance=Math.hypot(m.x-e.x,m.z-e.z,(m.y||0)-e.y);if(distance<e.radius&&raidLine(raid,e.x,e.z,m.x,m.z,e.y+.3,(m.y||0)+1))hitMachine(service,raid,m,100*(1-distance/e.radius),(m.y||0)+.1,e.team)}
  event(raid,now,'Shatter Charge detonated','combat');
 }
 raid.utilities=(raid.utilities||[]).filter(e=>e.until>now);
}
