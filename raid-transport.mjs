import {RAID_PROTOCOL} from './shared/raid-protocol.mjs';
export class ReliableActions {
 constructor({state,request,onState=()=>{},onNetwork=()=>{},now=()=>performance.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){this.actor={raidId:state.raidId,deploymentId:state.self.deploymentId};this.sequence=state.self.seq;this.request=request;this.onState=onState;this.onNetwork=onNetwork;this.now=now;this.sleep=sleep;this.chain=Promise.resolve();this.closed=false;this.rtt=0}
 close(){this.closed=true}
 accept(state){if(!state)return;if(state.protocol!==RAID_PROTOCOL||state.raidId!==this.actor.raidId||state.self?.deploymentId!==this.actor.deploymentId)throw Object.assign(new Error('Mismatched raid state. Reload to reconnect safely.'),{retryable:false});this.sequence=Math.max(this.sequence,state.self.seq);if(!this.closed)this.onState(state,{rttMs:this.rtt})}
 send(data){
  const work=async()=>{
   if(this.closed)throw new Error('Raid input canceled after leaving this session.');
   const intent=typeof data==='function'?data():data,packet={...intent,...this.actor,protocol:RAID_PROTOCOL,seq:++this.sequence,includeState:true};let lastError;
   for(let attempt=0;attempt<3;attempt++){
    if(this.closed)throw new Error('Raid input canceled after leaving this session.');const start=this.now();
    try{const result=await this.request(packet);if(this.closed)throw Object.assign(new Error('Raid input canceled after leaving this session.'),{retryable:false});if(result.ack?.protocol!==RAID_PROTOCOL||result.ack.sequence!==packet.seq||!result.ack.accepted||!result.state)throw Object.assign(new Error('Invalid action acknowledgement. Reload to reconnect safely.'),{retryable:false});const elapsed=this.now()-start;this.rtt=this.rtt?this.rtt*.75+elapsed*.25:elapsed;this.accept(result.state);this.onNetwork({status:'connected',rttMs:this.rtt,retries:attempt});return result;
    }catch(error){if(this.closed)throw error;if(error.state)this.accept(error.state);lastError=error;if(error.retryable===false||error.status===426){this.closed=true;this.onNetwork({status:'update_required',rttMs:this.rtt,retries:attempt});throw error}if(error.status&&error.status<500)throw error;this.onNetwork({status:'retrying',rttMs:this.rtt,retries:attempt+1});if(attempt<2)await this.sleep(100*(attempt+1))}
   }
   if(!this.closed)this.onNetwork({status:'offline',rttMs:this.rtt,retries:3});throw lastError;
  };
  this.chain=this.chain.catch(()=>{}).then(work);return this.chain;
 }
}
