import {movementSpeed} from './raid-combat.mjs';
import {blocked,floorAt,supportAt} from './raid-worlds.mjs';
export const OPERATOR_RADIUS=.45;
// Pure positional simulation shared by authority and visual prediction. No inventory or health mutation.
export function stepOperator(world,p,dt,now){
 dt=Math.min(.1,Math.max(0,dt));p.y??=0;p.vy??=0;p.grounded??=true;const move=p.move||{x:0,z:0},speed=movementSpeed(p,now);
 if(now-(p.lastMoveAt??p.lastInput)<.4){const x=p.x+move.x*speed*dt,z=p.z+move.z*speed*dt,xFloor=Math.max(supportAt(world,x,p.z,p.y+.65,OPERATOR_RADIUS),floorAt(world,x+Math.sign(move.x)*OPERATOR_RADIUS,p.z,p.y+.65)),zFloor=Math.max(supportAt(world,p.x,z,p.y+.65,OPERATOR_RADIUS),floorAt(world,p.x,z+Math.sign(move.z)*OPERATOR_RADIUS,p.y+.65));
  if(!blocked(world,x,p.z,OPERATOR_RADIUS,Math.max(p.y,xFloor)))p.x=x;if(!blocked(world,p.x,z,OPERATOR_RADIUS,Math.max(p.y,zFloor)))p.z=z;
 }
 const floor=supportAt(world,p.x,p.z,p.y+.65,OPERATOR_RADIUS);if(p.grounded&&floor>=p.y-.5){p.y=floor;p.vy=0;p.fallPeak=p.y;return 0}
 p.grounded=false;p.fallPeak=Math.max(p.fallPeak||p.y,p.y);p.vy-=14*dt;const y=p.y+p.vy*dt;
 if(y<=floor){const fall=p.fallPeak-floor;p.y=floor;p.vy=0;p.grounded=true;p.fallPeak=floor;return fall>4?(fall-4)*12:0}
 if(blocked(world,p.x,p.z,.4,y))p.vy=Math.min(0,p.vy);else p.y=y;return 0;
}
