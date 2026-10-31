import {bulletClear} from '../shared/raid-ballistics.mjs';
import {clearLine} from '../shared/raid-worlds.mjs';
import {smokeClear} from '../shared/raid-utilities.mjs';
// Legacy checkpoints keep their original sampling behavior. Current raid cover
// is shared by visibility, interactions, AI and utilities, not only firearms.
export function raidLine(raid,x,z,tx,tz,fromY=1.6,toY=1.6){return raid.ballisticsVersion===1?bulletClear(raid.world,{x,y:fromY,z},{x:tx,y:toY,z:tz}):clearLine(raid.world,x,z,tx,tz,fromY,toY)}
export function raidSight(raid,observer,target,{eye=1.55,body=1,head=null}={},now){
 const from={x:observer.x,y:(observer.y||0)+eye,z:observer.z},heights=raid.ballisticsVersion===1&&head!==null&&head!==body?[body,head]:[body];
 // Cover and smoke must be clear on the same ray. Mixing two independent clear
 // rays would reveal an operator whose body is covered and whose head is smoked.
 return heights.some(height=>{const to={x:target.x,y:(target.y||0)+height,z:target.z};return raidLine(raid,from.x,from.z,to.x,to.z,from.y,to.y)&&smokeClear(raid.utilities,from,to,now)});
}
