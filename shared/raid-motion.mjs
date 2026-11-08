import {movementSpeed} from './raid-combat.mjs';
import {blocked,floorAt,supportAt} from './raid-worlds.mjs';
export const OPERATOR_RADIUS=.45;
export const VAULT_DURATION=.46;
const VAULT_ARC=.28,VAULT_REACH=1.65,VAULT_RISE_MIN=.65,VAULT_RISE_MAX=1.3;
export function vaultDirection(p){
 const move=p.move||{};
 if(Math.hypot(move.x,move.z)>.01)return {x:move.x,z:move.z};
 return {x:Math.sin(p.yaw||0),z:Math.cos(p.yaw||0)};
}
// Find the near edge of a low ledge directly ahead. The caller commits a short
// authoritative interpolation onto its top; this is deliberately not a teleport
// through walls, and anything taller than a shallow mantle is rejected.
export function vaultTarget(world,p,direction=vaultDirection(p)){
 const feet=p.y||0,dir=direction,len=Math.hypot(dir.x,dir.z)||1,dx=dir.x/len,dz=dir.z/len;
 for(let distance=.4;distance<=VAULT_REACH;distance+=.12){
  const x=p.x+dx*distance,z=p.z+dz*distance;
  if(!blocked(world,x,z,OPERATOR_RADIUS*.7,feet,1.7))continue;
  const landing=floorAt(world,x,z,feet+VAULT_RISE_MAX+.05),rise=landing-feet;
  if(rise<VAULT_RISE_MIN||rise>VAULT_RISE_MAX)continue;
  const onBlock=(world.blocks||[]).some(([bx,bz,w,d,h,base=0])=>Math.abs(x-bx)<=w/2+.01&&Math.abs(z-bz)<=d/2+.01&&Math.abs(base+h-landing)<=.01);
  if(!onBlock)continue;
  // Land just inside the footprint and require headroom above the ledge.
  const tx=p.x+dx*Math.min(distance+.24,VAULT_REACH),tz=p.z+dz*Math.min(distance+.24,VAULT_REACH);
  if(floorAt(world,tx,tz,feet+VAULT_RISE_MAX+.05)<landing-.05)continue;
  if(blocked(world,tx,tz,OPERATOR_RADIUS*.6,landing+.05,1.55))continue;
  return {x:tx,y:landing,z:tz,dir:{x:dx,z:dz},distance};
 }
 return null;
}
export function beginVault(p,target,now){
 p.vault={x:target.x,y:target.y,z:target.z,dirX:target.dir.x,dirZ:target.dir.z,fromX:p.x,fromY:p.y||0,fromZ:p.z,start:now,end:now+VAULT_DURATION};
 p.vaultUntil=now+VAULT_DURATION;p.grounded=false;p.vy=0;p.slideUntil=0;p.fallPeak=target.y;p.move={x:target.dir.x,z:target.dir.z};
 return p.vault;
}
// Pure positional simulation shared by authority and visual prediction. No inventory or health mutation.
export function stepOperator(world,p,dt,now){
 dt=Math.min(.1,Math.max(0,dt));p.y??=0;p.vy??=0;p.grounded??=true;
 if(p.vault){
  const vault=p.vault,span=Math.max(.01,(vault.end||0)-(vault.start||0)),t=Math.max(0,Math.min(1,(now-(vault.start||0))/span));
  p.x=vault.fromX+(vault.x-vault.fromX)*t;p.z=vault.fromZ+(vault.z-vault.fromZ)*t;p.y=vault.fromY+(vault.y-vault.fromY)*t+Math.sin(Math.PI*t)*VAULT_ARC;
  p.vy=0;p.grounded=false;
  if(t>=1){
   p.x=vault.x;p.y=vault.y;p.z=vault.z;p.vy=0;p.grounded=true;p.vault=null;p.vaultUntil=0;p.fallPeak=p.y;p.move={x:0,z:0};
  }
  return 0;
 }
 const sliding=(p.slideUntil||0)>now,move=sliding&&p.slideDir?p.slideDir:p.move||{x:0,z:0},speed=movementSpeed(p,now);
 if(sliding||now-(p.lastMoveAt??p.lastInput)<.4){const x=p.x+move.x*speed*dt,z=p.z+move.z*speed*dt,xFloor=Math.max(supportAt(world,x,p.z,p.y+.65,OPERATOR_RADIUS),floorAt(world,x+Math.sign(move.x)*OPERATOR_RADIUS,p.z,p.y+.65)),zFloor=Math.max(supportAt(world,p.x,z,p.y+.65,OPERATOR_RADIUS),floorAt(world,p.x,z+Math.sign(move.z)*OPERATOR_RADIUS,p.y+.65));
  if(!blocked(world,x,p.z,OPERATOR_RADIUS,Math.max(p.y,xFloor)))p.x=x;if(!blocked(world,p.x,z,OPERATOR_RADIUS,Math.max(p.y,zFloor)))p.z=z;
 }
 const floor=supportAt(world,p.x,p.z,p.y+.65,OPERATOR_RADIUS);if(p.grounded&&floor>=p.y-.5){p.y=floor;p.vy=0;p.fallPeak=p.y;return 0}
 p.grounded=false;p.fallPeak=Math.max(p.fallPeak||p.y,p.y);p.vy-=14*dt;const y=p.y+p.vy*dt;
 if(y<=floor){const fall=p.fallPeak-floor;p.y=floor;p.vy=0;p.grounded=true;p.fallPeak=floor;return fall>4?(fall-4)*12:0}
 if(blocked(world,p.x,p.z,.4,y))p.vy=Math.min(0,p.vy);else p.y=y;return 0;
}
