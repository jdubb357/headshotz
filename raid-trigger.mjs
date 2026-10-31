import {weaponStats} from './shared/raid-catalog.mjs';
export function deferIdleMovement({input,confirmed,engaged,sampleAgeMs}){return !!(engaged&&input?.x===0&&input.z===0&&confirmed?.x===0&&confirmed.z===0&&Number.isFinite(sampleAgeMs)&&sampleAgeMs>=0&&sampleAgeMs<350)}
// At most one outstanding shot. The authority still owns rounds and cadence.
export class RaidTrigger {
 constructor({getState,allowed,send,onEffect=()=>{},onError=()=>{},now=()=>performance.now()}){Object.assign(this,{getState,allowed,send,onEffect,onError,now});this.sources=new Map();this.epoch=0;this.nextAt=0;this.pending=null;this.identity=null;this.tapped=false;this.pressSerial=0;this.useRtt=true}
 get engaged(){const state=this.getState();return !!(this.pending||state?.weapon?.loaded>0&&state.weapon.condition>0&&(this.tapped||[...this.sources.values()].some(input=>weaponStats(state.weapon).automatic||!input.consumed)))}
 clear(){this.sources.clear();this.tapped=false;this.epoch++}
 press(source){if(!this.allowed())return; if(!this.sources.has(source))this.sources.set(source,{consumed:false,id:++this.pressSerial});this.tick()}
 release(source){this.sources.delete(source)}
 hold(source,active){if(active){if(!this.sources.has(source))this.press(source)}else this.release(source)}
 tap(){if(!this.allowed())return;this.tapped=true;this.tick()}
 tick(){
  if(!this.allowed()){this.clear();return}
  const state=this.getState();if(!state?.alive||state.downed||!state.weapon){this.clear();return}
  if(state.weapon.loaded<=0||state.weapon.condition<=0){this.tapped=false;for(const input of this.sources.values())input.consumed=true;return}
  const identity=state.deploymentId+':'+state.weapon.id;
  if(this.identity!==identity){if(this.identity!==null)this.epoch++;this.identity=identity;this.nextAt=0;this.useRtt=true}
  const stats=weaponStats(state.weapon),eligible=this.tapped||[...this.sources.values()].some(input=>stats.automatic||!input.consumed);
  // Credit transit time only until an authoritative cooldown refusal shows the
  // estimate is too optimistic for this weapon/path. The server owns readiness.
  const rtt=Number.isFinite(state.rttMs)?Math.max(0,Math.min(2500,state.rttMs)):0,authorityAt=state.sampledAt+Math.max(0,(state.nextFire||0)-state.serverTime)*1000-(this.useRtt?rtt:0);
  if(!eligible||this.pending||this.now()<Math.max(this.nextAt,authorityAt)||state.weapon.loaded<=0||state.weapon.condition<=0)return;
  const epoch=this.epoch,weaponId=state.weapon.id,deploymentId=state.deploymentId,tapped=this.tapped,sources=[...this.sources].filter(([,input])=>stats.automatic||!input.consumed).map(([key,input])=>({key,id:input.id}));this.tapped=false;for(const input of this.sources.values())input.consumed=true;
  const token={};this.pending=token;
  // The send factory runs only when earlier reliable actions have completed.
  Promise.resolve().then(()=>this.send(()=>{
   const current=this.getState();
   if((!tapped&&!sources.some(({key,id})=>this.sources.get(key)?.id===id))||epoch!==this.epoch||!this.allowed()||!current?.alive||current.downed||current.deploymentId!==deploymentId||current.weapon?.id!==weaponId||current.weapon.loaded<=0||current.weapon.condition<=0)throw Object.assign(new Error('Shot canceled after input changed.'),{canceled:true});
   this.nextAt=this.now()+stats.delay*1000+10;this.onEffect();return {type:'fire'};
  })).catch(error=>{if(epoch===this.epoch&&!error.canceled){
   const current=this.getState();
   if(error.status===409&&error.ack?.accepted===false&&error.message==='Weapon not ready'&&this.allowed()&&current?.alive&&!current.downed&&current.deploymentId===deploymentId&&current.weapon?.id===weaponId&&current.weapon.loaded>0&&current.weapon.condition>0&&current.nextFire>current.serverTime){
    this.useRtt=false;this.nextAt=Math.max(this.nextAt,this.now()+(current.nextFire-current.serverTime)*1000+10);if(tapped)this.tapped=true;for(const {key,id}of sources){const input=this.sources.get(key);if(input?.id===id)input.consumed=false}return;
   }
   this.clear();this.onError(error)
  }}).finally(()=>{if(this.pending===token)this.pending=null});
 }
}
