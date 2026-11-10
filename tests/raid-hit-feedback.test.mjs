import test from 'node:test';
import assert from 'node:assert/strict';
import {hitFeedback,recordShotHit} from '../server/raid-hit-feedback.mjs';
import {hitToken,shouldShowHit,hitCaption} from '../shared/raid-hit-presentation.mjs';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';

test('hit tokens are monotonic and describe only server-resolved outcomes',()=>{
 const shooter={};
 const operator={account:'enemy-1',alive:true,hp:80,downed:false};
 assert.equal(recordShotHit(shooter,[],1000),null,'a miss never creates a token');
 assert.equal(shooter.hitFeedback,undefined,'a miss leaves no stale token');
 const body=hitFeedback(shooter,operator,{y:1},1001);
 assert.deepEqual(body,{token:1,at:1001,zone:'body',headshot:false,target:'operator',kill:false,boss:false,elite:false});
 const head=hitFeedback(shooter,operator,{y:1.65},1002);
 assert.equal(head.token,2,'each accepted hit advances the token');
 assert.equal(head.zone,'head');assert.equal(head.headshot,true);
 const leg=hitFeedback(shooter,operator,{y:.4},1003);
 assert.equal(leg.zone,'leg');assert.equal(leg.headshot,false);
 const rival={rival:true,alive:true,hp:40};
 assert.equal(hitFeedback(shooter,rival,{y:1},1004).target,'rival');
 rival.alive=false;
 assert.equal(hitFeedback(shooter,rival,{y:1},1005).kill,true,'a verified rival death is a kill');
 const machine={kind:'overlord',hp:0,elite:true,y:0};
 const boss=hitFeedback(shooter,machine,{y:1.5},1006);
 assert.deepEqual([boss.target,boss.kill,boss.boss,boss.elite],['machine',true,true,true]);
});

test('reconnect baselines the current token and only later tokens replay',()=>{
 const stale={token:4,zone:'body',headshot:false,target:'operator',kill:false,boss:false,elite:false};
 assert.equal(hitToken(stale),4);
 assert.equal(shouldShowHit(stale,hitToken(stale)),false,'a reconnect baseline suppresses an already-visible hit');
 assert.equal(shouldShowHit(null,4),false,'a miss with no token never replays');
 assert.equal(shouldShowHit({...stale,token:5},4),true,'a newer authoritative token replays exactly once');
 assert.equal(shouldShowHit({...stale,token:5},hitToken({...stale,token:5})),false,'polling the same token does not replay it');
 assert.equal(shouldShowHit({...stale,token:0},0),false,'a malformed/reset token is ignored');
 assert.equal(hitCaption({...stale,kill:true,boss:true,headshot:true}),'Boss destroyed');
 assert.equal(hitCaption({...stale,target:'machine',elite:true,kill:true}),'Elite machine destroyed');
 assert.equal(hitCaption({...stale,headshot:true}),'Headshot confirmed · operator');
 assert.equal(hitCaption({...stale,target:'machine',elite:true}),'Hit confirmed · machine · elite');
});

test('recordShotHit prefers the lethal pellet over an earlier body hit',()=>{
 const shooter={};
 const live={account:'live',alive:true,hp:80};
 const dead={account:'dead',alive:false,hp:0};
 const hit=recordShotHit(shooter,[{target:live,point:{y:1}},{target:dead,point:{y:1.7}}],1200);
 assert.equal(hit.target,'operator');assert.equal(hit.zone,'head');assert.equal(hit.kill,true);assert.equal(shooter.hitFeedback.token,1);
});

function setup(t,{shotgun=false}={}){
 const store=new RaidStore(),id=store.register('hit_owner','a long hit feedback password').id;
 if(shotgun)store.trade(id,{type:'buy',trader:'outfitter',sku:'shotgun'});
 let now=1000;
 const service=new RaidService(store,{now:()=>now}),gun=store.profile(id).items.find(it=>it.kind==='weapon'&&it.weapon===(shotgun?'shotgun':'ar'));
 service.deploy(id,{requestId:'hit_owner_deploy',mapId:'relay',itemIds:[gun.id]});
 const enemy=store.register('hit_enemy','a long hit enemy password').id;
 service.deploy(enemy,{requestId:'hit_enemy_deploy',mapId:'relay',recovery:true});
 const p=()=>service.byAccount.get(id),q=()=>service.byAccount.get(enemy),r=()=>service.raids.get(p().raidId);
 const world={...r().world,blocks:[],ramps:[]};r().world=world;
 Object.assign(p(),{x:0,y:0,z:0,yaw:0,pitch:0,protectedUntil:0,hitFeedback:undefined});
 Object.assign(q(),{x:0,y:0,z:4,protectedUntil:0});
 r().machines=[];r().rivals=[];
 t.after(()=>{service.close();store.close()});
 return {store,service,id,p,q,r,time:v=>now=v,fire:(extra={})=>service.action(id,{type:'fire',seq:p().seq+1,...extra}),snapshot:()=>service.snapshot(id)};
}

test('a body hit exposes an authoritative operator hit token and snapshot expiry',t=>{
 const f=setup(t);
 assert.equal(f.snapshot().self.hit,undefined,'an empty raid has no hit token');
 f.fire({pitch:0});
 const hit=f.snapshot().self.hit;
 assert.ok(hit,'the server records the hit in the shooter snapshot');
 assert.equal(hit.token,1);assert.equal(hit.target,'operator');assert.equal(hit.zone,'body');assert.equal(hit.headshot,false);assert.equal(hit.kill,false);
 f.time(2000);assert.equal(f.snapshot().self.hit,undefined,'hit feedback expires after the presentation window');
});

test('a head hit reports headshot without inventing a kill',t=>{
 const f=setup(t);
 f.fire({pitch:Math.atan2(1.7-1.55,4)});
 const hit=f.snapshot().self.hit;
 assert.equal(hit.headshot,true);assert.equal(hit.zone,'head');assert.equal(hit.kill,false);assert.equal(hit.target,'operator');
});

test('a miss produces no hit token and does not disturb an earlier one',t=>{
 const f=setup(t);
 f.fire({pitch:0});assert.equal(f.snapshot().self.hit.token,1);
 f.time(1001);f.p().yaw=Math.PI/2;f.fire({pitch:0});
 assert.equal(f.snapshot().self.hit.token,1,'a miss cannot increment or replace the confirmed hit');
});

test('a machine kill reports machine kill and elite flags from authoritative state',t=>{
 const f=setup(t);
 f.r().machines=[{id:'hit_elite',kind:'hunter',x:0,y:0,z:4,hp:1,state:'patrol',elite:true}];
 f.fire({pitch:0});
 const hit=f.snapshot().self.hit;
 assert.equal(hit.target,'machine');assert.equal(hit.kill,true);assert.equal(hit.elite,true);assert.equal(hit.boss,false);
 assert.ok(f.r().machines[0].hp<=0,'the machine is destroyed by authoritative damage');
});

test('legacy active raids also report server-resolved hit feedback',t=>{
 const f=setup(t);
 delete f.r().ballisticsVersion;
 f.fire({pitch:0});
 const hit=f.snapshot().self.hit;
 assert.equal(hit.target,'operator');assert.equal(hit.token,1);assert.equal(hit.zone,'body');
});
