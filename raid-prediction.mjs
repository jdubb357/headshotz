import {getWorld} from './shared/raid-worlds.mjs';
import {stepOperator} from './shared/raid-motion.mjs';
export class LocalPrediction {
 constructor(state,now=()=>performance.now()){this.now=now;this.lastJump=-Infinity;this.reconcile(state)}
 reconcile(state,{rttMs=0}={}){
  const world=getWorld(state.map,state.mapVersion===undefined?1:state.mapVersion);if(!world)throw Object.assign(new Error('Map update required. Reload to reconnect safely.'),{retryable:false});this.world=world;this.self=state.self;this.at=this.now();this.lastFrame=this.at;const s=state.self;this.position={combatVersion:s.combatVersion,equipment:s.equipment,wounds:{limpUntil:s.wounds?.limpUntil>state.serverTime?(s.wounds.limpUntil-state.serverTime)+this.at/1000:0},x:s.x,y:s.y||0,z:s.z,vy:s.vy||0,fallPeak:s.fallPeak??s.y??0,grounded:s.grounded!==false,downed:s.downed,carrying:s.carrying,move:{...(s.move||{x:0,z:0})},lastInput:0};
  let age=Math.min(.2,Math.max(0,rttMs/2000));if(s.alive&&!s.carrier)while(age>0){const dt=Math.min(.05,age);stepOperator(this.world,this.position,dt,0);age-=dt}
 }
 frame(input,time=this.now()){
  const elapsed=Math.max(0,Math.min(.05,(time-this.lastFrame)/1000));this.lastFrame=time;
  if(!this.self.alive||this.self.carrier||time-this.at>350)return this.position;
  const len=Math.max(1,Math.hypot(input.x,input.z));this.position.move={x:input.x/len,z:input.z/len};this.position.lastInput=time/1000;stepOperator(this.world,this.position,elapsed,time/1000);return this.position;
 }
 jump(){if(!this.self.alive||this.self.downed||this.self.carrying||this.self.carrier||!this.position.grounded||this.now()-this.lastJump<500)return;this.lastJump=this.now();this.position.vy=6;this.position.grounded=false}
}
