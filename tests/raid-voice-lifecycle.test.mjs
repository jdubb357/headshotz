import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaidVoice} from '../raid-voice.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const media=()=>{const track={enabled:true,readyState:'live',stop(){this.readyState='ended'}};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]}};
function globals(t,getUserMedia){
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'window',{configurable:true,value:{RTCPeerConnection:true}});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia}}});
 t.after(()=>{for(const [key,old]of [['window',oldWindow],['navigator',oldNavigator]])if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key]});
}
function setup(api){let clock=10000,timer;const voice=new RaidVoice({api,accountId:()=> 'speaker',now:()=>clock,schedule:fn=>{timer=fn;return 1},cancel:()=>{timer=null}});return {voice,clock:value=>clock=value,watchdog:()=>timer?.()}}
function apiReply(path,data){return Promise.resolve(data?.type==='join'?{epoch:'epoch',joined:true}:path.startsWith('voice?')?{epoch:'epoch',joined:true,peers:[],signals:[],cursor:0}:{ok:true})}
test('voice requests no microphone until enabled and stops capture on disable',async t=>{
 const stream=media();let requests=0;globals(t,async()=>{requests++;return stream});const {voice}=setup(apiReply);assert.equal(requests,0);await voice.join('squad');assert.equal(requests,1);assert.equal(stream.track.enabled,false);voice.setTalking(true);assert.equal(stream.track.enabled,true);voice.quiet();assert.equal(stream.track.enabled,false);await voice.leave();assert.equal(stream.track.readyState,'ended');assert.equal(voice.joined,false);
});
test('canceling a pending microphone prompt stops a late stream without joining voice',async t=>{
 const pending=deferred(),stream=media(),calls=[];globals(t,()=>pending.promise);const {voice}=setup(async(path,data)=>{calls.push(data);return apiReply(path,data)});const joining=voice.join('squad');await voice.leave();pending.resolve(stream);await joining;assert.equal(stream.track.readyState,'ended');assert.ok(!calls.some(c=>c?.type==='join'));
});
test('late join response cannot leave or release a newer microphone session',async t=>{
 const first=media(),second=media(),pending=deferred(),calls=[];let requests=0,joins=0;globals(t,async()=>requests++?second:first);
 const {voice}=setup(async(path,data)=>{calls.push(data);if(data?.type==='join'&&joins++===0)return pending.promise;return apiReply(path,data)});
 const one=voice.join('squad');await Promise.resolve();await Promise.resolve();const old=voice.clientId;await voice.leave();await voice.join('squad');const current=voice.clientId;pending.resolve({epoch:'old_epoch',joined:true});await one;
 assert.notEqual(old,current);assert.equal(voice.clientId,current);assert.equal(first.track.readyState,'ended');assert.equal(second.track.readyState,'live');assert.equal(voice.joined,true);assert.ok(!calls.some(c=>c?.type==='leave'&&c.clientId===current));await voice.leave();
});
test('independent watchdog releases microphone while a signaling fetch is stalled',async t=>{
 const stream=media(),pending=deferred();let stalled=false;globals(t,async()=>stream);const {voice,clock,watchdog}=setup((path,data)=>stalled&&path.startsWith('voice?')?pending.promise:apiReply(path,data));
 await voice.join('squad');voice.setTalking(true);stalled=true;clock(11000);const poll=voice.poll();await Promise.resolve();clock(18000);watchdog();assert.equal(stream.track.readyState,'ended');assert.equal(voice.joined,false);pending.resolve({joined:false,peers:[],signals:[],cursor:0});await poll;
});
test('a revoked old voice poll cannot block a new join or overwrite its peer/cursor state',async t=>{
 const first=media(),second=media(),oldReply=deferred(),newReply=deferred();let mediaCalls=0,polls=0;globals(t,async()=>mediaCalls++?second:first);
 const {voice}=setup((path,data)=>{if(path.startsWith('voice?')){polls++;if(polls===2)return oldReply.promise;if(polls===3)return newReply.promise}return apiReply(path,data)});
 await voice.join('squad');const old=voice.poll();await Promise.resolve();await voice.leave();const joining=voice.join('squad');for(let i=0;i<12&&polls<3;i++)await Promise.resolve();assert.equal(polls,3,'new join polls independently of the old in-flight request');
 oldReply.resolve({joined:true,epoch:'epoch',peers:[],signals:[],cursor:999});await old;assert.equal(voice.joined,true);assert.ok(voice.polling,'old cleanup cannot unlock the newer in-flight poll');assert.equal(second.track.readyState,'live');
 newReply.resolve({joined:true,epoch:'epoch',peers:[],signals:[],cursor:3});await joining;assert.equal(voice.cursor,3);assert.equal(first.track.readyState,'ended');await voice.leave();
});
