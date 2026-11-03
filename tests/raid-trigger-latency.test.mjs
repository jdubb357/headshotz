import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {ReliableActions} from '../raid-transport.mjs';
import {RaidTrigger,deferIdleMovement} from '../raid-trigger.mjs';

const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
async function run(t,{weapon='ar',latency=150,asymmetric=false,seconds=3,optimizedPolling=true}={}){
 let now=0,receivedAt=0,serial=0,requests=0,inFlight=0,maxInFlight=0,polling=false,error=null;
 const events=[],sent=[],rejections=[],store=new RaidStore(),id=store.register('latency_operator','a long latency password').id;
 const gun=store.profile(id).items.find(it=>it.kind==='weapon');store.transaction(()=>{const s=store.state(id),owned=s.items.find(it=>it.id===gun.id);owned.weapon=weapon;owned.loaded=weapon==='smg'?36:30;store.save(id,s)});
 const service=new RaidService(store,{now:()=>1000+now/1000});service.deploy(id,{requestId:'latency_operator_deploy',mapId:'relay',itemIds:[gun.id]});service.raids.get(service.byAccount.get(id).raidId).machines=[];
 t.after(()=>{service.close();store.close()});let state=structuredClone(service.snapshot(id));
 const schedule=(delay,fn)=>events.push({at:now+delay,order:serial++,fn});
 const wire=new ReliableActions({state,now:()=>now,sleep:delay=>new Promise(resolve=>schedule(delay,resolve)),onState:next=>{state=next;receivedAt=now},request:packet=>new Promise((resolve,reject)=>{
  const index=requests++,outbound=asymmetric?(index%2?1:latency-1):latency/2,inbound=latency-outbound;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);sent.push({type:packet.type,seq:packet.seq,at:now});
  schedule(outbound,()=>{let response,failure;try{response={ack:service.action(id,packet),state:structuredClone(service.snapshot(id))}}catch(e){e.state=structuredClone(service.snapshot(id));failure=e;rejections.push({message:e.message,type:packet.type})}schedule(inbound,()=>{inFlight--;failure?reject(failure):resolve(response)})});
 })});
 const trigger=new RaidTrigger({getState:()=>({deploymentId:state.self.deploymentId,alive:state.self.alive,downed:state.self.downed,weapon:[...state.self.equipment,...state.self.pack].find(it=>it.id===state.self.weaponId),nextFire:state.self.nextFire,serverTime:state.serverTime,sampledAt:receivedAt,rttMs:wire.rtt}),allowed:()=>true,now:()=>now,send:factory=>wire.send(factory),onError:e=>{error=e}});
 trigger.press('keyboard');await settle();
 for(now=1;now<=seconds*1000;now++){
  for(;;){events.sort((a,b)=>a.at-b.at||a.order-b.order);if(!events.length||events[0].at>now)break;events.shift().fn();await settle()}
  if(now%50===0)service.tick(.05);
  if(now%16===0)trigger.tick();
  if(now%150===0&&!polling){const defer=optimizedPolling&&deferIdleMovement({input:{x:0,z:0},confirmed:state.self.move,engaged:trigger.engaged,sampleAgeMs:now-receivedAt});if(!defer){polling=true;wire.send(()=>({type:'move',x:0,z:0,yaw:0,pitch:0})).catch(e=>{error=e}).finally(()=>{polling=false})}}
  await settle();
 }
 trigger.release('keyboard');wire.close();await settle();
 const actor=service.byAccount.get(id);return {rounds:actor.facts.roundsFired||0,loaded:actor.equipment.find(it=>it.id===gun.id).loaded,maxInFlight,error,rejections,sent};
}
test('stationary rifle at 150 ms RTT avoids idle polling and a second full cooldown wait',async t=>{
 const result=await run(t);t.diagnostic(JSON.stringify({rounds:result.rounds,requests:result.sent.length,rejections:result.rejections.length}));assert.ok(result.rounds>=16,JSON.stringify({rounds:result.rounds,sent:result.sent.length,rejections:result.rejections}));assert.equal(result.maxInFlight,1);assert.equal(result.error,null);assert.equal(result.rejections.length,0);assert.equal(result.loaded,30-result.rounds);
});
test('SMG retains one outstanding action at 150 ms RTT rather than accumulating a burst',async t=>{
 const result=await run(t,{weapon:'smg'});t.diagnostic(JSON.stringify({rounds:result.rounds,requests:result.sent.length,rejections:result.rejections.length}));assert.ok(result.rounds>=17,JSON.stringify({rounds:result.rounds,rejections:result.rejections}));assert.ok(result.rounds<=21);assert.equal(result.maxInFlight,1);assert.equal(result.error,null);assert.equal(result.loaded,36-result.rounds);
});
test('changing path asymmetry can defer a cooldown rejection without stopping held fire',async t=>{
 const result=await run(t,{asymmetric:true});t.diagnostic(JSON.stringify({rounds:result.rounds,requests:result.sent.length,rejections:result.rejections.length}));assert.ok(result.rounds>=5,JSON.stringify({rounds:result.rounds,rejections:result.rejections}));assert.equal(result.error,null);assert.equal(result.maxInFlight,1);assert.equal(result.rejections.length,1,'the first early acknowledgement should switch to conservative timing instead of repeatedly probing');assert.ok(result.rejections.every(r=>r.type==='fire'&&r.message==='Weapon not ready'));assert.equal(result.loaded,30-result.rounds);
});
test('idle movement deferral never suppresses motion, a stop request or stale-state recovery',()=>{
 const base={input:{x:0,z:0},confirmed:{x:0,z:0},engaged:true,sampleAgeMs:150};assert.equal(deferIdleMovement(base),true);
 for(const patch of [{input:{x:1,z:0}},{input:{x:0,z:1}},{confirmed:{x:0,z:1}},{engaged:false},{sampleAgeMs:350},{sampleAgeMs:NaN},{sampleAgeMs:-1},{confirmed:null}])assert.equal(deferIdleMovement({...base,...patch}),false,JSON.stringify(patch));
});
