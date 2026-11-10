import {getWorld} from './shared/raid-worlds.mjs';
import {stepOperator,beginVault,vaultTarget} from './shared/raid-motion.mjs';
export class LocalPrediction {
 constructor(state,now=()=>performance.now()){this.now=now;this.lastJump=-Infinity;this.lastFrameInput=null;this.inputAt=-Infinity;this.reconcile(state)}
 reconcile(state,{rttMs=0}={}){
  const base=getWorld(state.map,state.mapVersion===undefined?1:state.mapVersion);if(!base)throw Object.assign(new Error('Map update required. Reload to reconnect safely.'),{retryable:false});
  const world={...base,doors:(state.doors||[]).map(door=>({...door,closed:!!door.closed,locked:!!door.locked}))};this.world=world;this.self=state.self;this.at=this.now();this.lastFrame=this.at;const s=state.self;this.position={combatVersion:s.combatVersion,equipment:s.equipment,wounds:{limpUntil:s.wounds?.limpUntil>state.serverTime?(s.wounds.limpUntil-state.serverTime)+this.at/1000:0},x:s.x,y:s.y||0,z:s.z,vy:s.vy||0,fallPeak:s.fallPeak??s.y??0,grounded:s.grounded!==false,downed:s.downed,carrying:s.carrying,sprint:s.sprint===true,slideUntil:s.sliding&&s.slideLeft>0?this.at/1000+s.slideLeft:0,slideDir:s.slideDir?{x:s.slideDir.x,z:s.slideDir.z}:null,move:{...(s.move||{x:0,z:0})},lastInput:0,vault:s.vault?s.vault:null};
  if(this.position.vault){const v=this.position.vault,left=Math.max(0,s.vaultLeft||0);this.position.vault={...v,start:this.at/1000-(state.serverTime-(v.start||0)),end:this.at/1000+left}}
  let age=Math.min(.2,Math.max(0,rttMs/2000));if(s.alive&&!s.carrier)while(age>0){const dt=Math.min(.05,age);stepOperator(this.world,this.position,dt,0);age-=dt}
 }
 frame(input,time=this.now()){
  const elapsed=Math.max(0,Math.min(.05,(time-this.lastFrame)/1000));this.lastFrame=time;
  if(!this.self.alive||this.self.carrier)return this.position;
  if(this.position.vault){stepOperator(this.world,this.position,elapsed,time/1000);return this.position}
  // A fresh movement input is evidence of current intent even when the last
  // authoritative sample has gone stale (for example while its request is held
  // in flight). Predict that press for the same short window; releasing the key
  // or changing nothing afterwards falls back to the stale-sample freeze.
  const steering=!!(input.x||input.z),changed=!this.lastFrameInput||this.lastFrameInput.x!==input.x||this.lastFrameInput.z!==input.z;
  this.lastFrameInput={x:input.x,z:input.z};if(steering&&changed)this.inputAt=time;
  if(time-this.at>350&&!(steering&&time-this.inputAt<=350))return this.position;
  const len=Math.max(1,Math.hypot(input.x,input.z));this.position.move={x:input.x/len,z:input.z/len};this.position.lastInput=time/1000;stepOperator(this.world,this.position,elapsed,time/1000);return this.position;
 }
 jump(){if(!this.self.alive||this.self.downed||this.self.carrying||this.self.carrier||!this.position.grounded||this.now()-this.lastJump<500)return;this.lastJump=this.now();this.position.slideUntil=0;this.position.vy=6;this.position.grounded=false}
 vault(yaw=this.self.yaw||0){if(!this.self.alive||this.self.downed||this.self.carrying||this.self.carrier||!this.position.grounded||this.position.vault)return false;const target=vaultTarget(this.world,this.position,{x:Math.sin(yaw),z:Math.cos(yaw)});if(!target)return false;beginVault(this.position,target,this.now()/1000);return true}
 slide(input){if(!this.self.alive||this.self.downed||this.self.carrying||this.self.carrier||!this.position.grounded||this.position.slideUntil>this.now()/1000)return;const dx=input?.x||Math.sin(this.self.yaw||0),dz=input?.z||Math.cos(this.self.yaw||0),len=Math.max(1,Math.hypot(dx,dz));this.position.slideDir={x:dx/len,z:dz/len};this.position.slideUntil=this.now()/1000+.8}
}
