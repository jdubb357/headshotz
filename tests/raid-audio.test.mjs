import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidAudio,spatialCue} from '../raid-audio.mjs';
test('local status audio follows authoritative transitions once and starts silently on reconnect',()=>{
 const audio=new RaidAudio(),heard=[];audio.play=kind=>heard.push(kind);
 const s={serverTime:1,self:{deploymentId:'a',x:0,z:0,hp:100,alive:true},machines:[]};
 const observe=change=>{Object.assign(s.self,change);s.serverTime+=.15;audio.observe(s)};
 observe({board:{exit:'north'}});assert.deepEqual(heard,[],'joining an already boarding body is silent');
 observe({board:null});observe({});assert.deepEqual(heard,['interrupted']);
 observe({board:{exit:'south'}});observe({});observe({hp:80});observe({});
 observe({hp:1,downed:true,board:null});observe({});observe({hp:35,downed:false});
 assert.deepEqual(heard,['interrupted','boarding','hurt','downed','interrupted','revived']);
 observe({alive:false,result:{outcome:'extract'}});observe({});assert.equal(heard.at(-1),'extracted');assert.equal(heard.filter(k=>k==='extracted').length,1);
 audio.reset();const count=heard.length;observe({});assert.equal(heard.length,count,'reset does not replay terminal results');
 observe({deploymentId:'b',alive:true,hp:100,result:null});assert.equal(heard.length,count,'new deployment does not play revival');
 observe({alive:false,result:{outcome:'timeout'}});assert.equal(heard.at(-1),'eliminated');
});
test('terminal outcome does not sound an extraction interruption or leak spectator damage',()=>{
 const audio=new RaidAudio(),heard=[];audio.play=kind=>heard.push(kind);
 const s={serverTime:1,self:{deploymentId:'a',hp:100,alive:true,board:{exit:'north'}}};audio.observe(s);
 audio.observe({...s,self:{...s.self,alive:false,hp:0,board:null,result:{outcome:'dead'}}});
 audio.observe({...s,self:{...s.self,alive:false,hp:-10,board:null,result:{outcome:'dead'}},camera:{x:5,z:5}});
 assert.deepEqual(heard,['eliminated']);
});
test('machine cue direction follows the actual first-person right axis and falls off with distance',()=>{
 const front={x:0,z:0,yaw:0};assert.equal(spatialCue(front,{x:-5,z:0}).pan,1);assert.equal(spatialCue(front,{x:5,z:0}).pan,-1);
 assert.equal(spatialCue({...front,yaw:Math.PI/2},{x:0,z:5}).pan,1);
 assert.ok(spatialCue(front,{x:0,z:3}).gain>spatialCue(front,{x:0,z:30}).gain);
 assert.equal(spatialCue(front,{x:0,z:56}),null);assert.equal(spatialCue(front,{x:NaN,z:0}),null);
});
test('visible machine charge sounds once, re-arms after charge and respects death/reset',()=>{
 const audio=new RaidAudio(),heard=[];audio.play=(kind,spatial)=>heard.push({kind,spatial});
 const s={serverTime:10,self:{x:0,z:0,alive:true},machines:[{id:'a',kind:'hunter',x:-4,z:0,state:'windup'}]};
 audio.observe(s);audio.observe({...s,serverTime:10.15});assert.equal(heard.length,1);assert.equal(heard[0].kind,'hunter');assert.equal(heard[0].spatial.pan,1);
 audio.observe({...s,machines:[{...s.machines[0],state:'pursue'}]});audio.observe(s);assert.equal(heard.length,2);
 audio.reset();audio.observe({...s,self:{...s.self,alive:false}});assert.equal(heard.length,2);
 audio.observe({...s,machines:[{...s.machines[0],x:100}]});assert.equal(heard.length,2);
});
test('utility sounds follow activation, lure pulse and blast transitions without poll duplication',()=>{
 const audio=new RaidAudio(),heard=[];audio.play=(kind)=>heard.push(kind);const snapshot={serverTime:10,self:{x:0,z:0,alive:true},machines:[],utilities:[{id:'lure',kind:'decoy',x:0,y:0,z:5,activeAt:10,until:22}]};
 audio.observe(snapshot);audio.observe({...snapshot,serverTime:10.2});assert.deepEqual(heard,['decoy']);audio.observe({...snapshot,serverTime:11.1});assert.deepEqual(heard,['decoy','decoy']);
 snapshot.utilities=[{id:'charge',kind:'frag',x:0,y:0,z:5,activeAt:12,until:12.5,detonated:false}];audio.observe(snapshot);snapshot.serverTime=12.1;snapshot.utilities[0].detonated=true;audio.observe(snapshot);audio.observe(snapshot);assert.deepEqual(heard,['decoy','decoy','frag','blast']);audio.reset();assert.equal(audio.fieldCues.size,0);
});
