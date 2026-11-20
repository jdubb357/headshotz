import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {item,RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {hitMachine} from '../server/raid-ai.mjs';
import {hitRival} from '../server/raid-rivals.mjs';

function setup(t,count=3){
 const store=new RaidStore();let now=1000;
 const service=new RaidService(store,{now:()=>now});
 t.after(()=>{service.close();store.close()});
 const ids=[];
 for(let i=0;i<count;i++)ids.push(store.register('bag_audit_'+i+'_'+randomUUID().slice(0,8),'a long bag audit password').id);
 for(const [i,id] of ids.entries())service.deploy(id,{mapId:'relay',requestId:'bag_audit_'+i+'_'+id,recovery:true});
 const players=ids.map(id=>service.byAccount.get(id)),raid=service.raids.get(players[0].raidId);
 assert.ok(players.every(p=>p&&p.raidId===raid.id),'audit deployments share the raid');
 raid.machines=[];raid.rivals=[];raid.caches=[];raid.floorLoot=[];raid.bags=[];
 raid.world={...raid.world,blocks:[],ramps:[],hazards:[]};
 for(const p of raid.players.values())Object.assign(p,{x:0,y:0,z:0,protectedUntil:0,move:{x:0,z:0},lastInput:now});
 Object.assign(players[0],{x:0,z:0,team:'alpha_team'});
 Object.assign(players[1],{x:0,z:0,team:'beta_team'});
 Object.assign(players[2],{x:0,z:0,team:'alpha_team'});
 return {store,service,ids,raid,player:i=>service.byAccount.get(ids[i]),time:value=>now=value};
}

test('machine, rival and operator salvage carry stable source kinds and labels',t=>{
 const f=setup(t),raid=f.raid;
 const machine={id:'bag_scout',kind:'scout',x:0,y:0,z:0,hp:1,state:'patrol',maxHp:10};raid.machines=[machine];
 hitMachine(f.service,raid,machine,10,0,'alpha_team');
 const machineBag=raid.bags.find(b=>b.id==='bag_scout_salvage');
 assert.ok(machineBag,'a destroyed machine leaves salvage');
 assert.equal(machineBag.kind,'machine');
 assert.match(machineBag.label,/salvage/);
 const machineView=f.service.snapshot(f.ids[2]).bags.find(b=>b.id==='bag_scout_salvage');
 assert.equal(machineView.kind,'machine');
 assert.equal(machineView.label,machineBag.label);
 assert.equal(machineView.friendly,false);

 raid.machines=[];
 const rival={id:'bag_rival',name:'Rook',weapon:'smg',hp:1,alive:true,state:'scavenge',x:0,y:0,z:0};raid.rivals=[rival];
 hitRival(raid,rival,5,0,1000);
 const rivalBag=raid.bags.find(b=>b.id==='bag_rival_salvage');
 assert.ok(rivalBag,'an eliminated rival leaves salvage');
 assert.equal(rivalBag.kind,'rival');
 assert.match(rivalBag.label,/Rook salvage/);
 assert.equal(f.service.snapshot(f.ids[2]).bags.find(b=>b.id==='bag_rival_salvage').kind,'rival');
});

test('operator death creates one labeled salvage container without recovery or protected gear',t=>{
 const f=setup(t),raid=f.raid,p=f.player(0);
 const carried=item('valuable',{value:25}),recovery=item('weapon',{weapon:'smg',recovery:true}),secret=item('med',{medical:'trauma',quantity:1});
 p.pack.push(carried,recovery);p.secure.push(secret);
 f.service.end(raid,p,'death','machine');
 const bags=raid.bags.filter(b=>b.kind==='operator');
 assert.equal(bags.length,1,'exactly one operator salvage container is created');
 const bag=bags[0];
 assert.equal(bag.team,p.team);
 assert.deepEqual(bag.items.map(it=>it.id),[carried.id],'recovery supplies and the protected pocket never enter salvage');
 const mate=f.service.snapshot(f.ids[2]).bags.find(b=>b.id===bag.id);
 assert.equal(mate.kind,'operator');
 assert.equal(mate.friendly,true);
 assert.equal(mate.label,'Squadmate salvage bag');
 assert.ok(mate.items.some(it=>it.id===carried.id),'a teammate within reach can search the salvage');
 const enemy=f.service.snapshot(f.ids[1]).bags.find(b=>b.id===bag.id);
 assert.equal(enemy.friendly,false);
 assert.equal(enemy.label,'Operator salvage bag');
});

test('dropped gear is a distinct owned container',t=>{
 const f=setup(t),p=f.player(0);
 const dropped=item('valuable',{value:12});p.pack.push(dropped);
 f.service.action(f.ids[0],{type:'drop',seq:p.seq+1,itemId:dropped.id});
 const bag=f.raid.bags.find(b=>b.items.some(it=>it.id===dropped.id));
 assert.ok(bag,'dropping gear creates a container');
 assert.equal(bag.kind,'gear');
 assert.equal(bag.label,'Dropped gear');
 assert.equal(bag.team,p.team);
 const view=f.service.snapshot(f.ids[2]).bags.find(b=>b.id===bag.id);
 assert.equal(view.kind,'gear');
 assert.equal(view.friendly,true);
});

test('bag metadata is visible out of range while items stay private',t=>{
 const f=setup(t),raid=f.raid;
 const bag={id:'far_salvage',x:0,y:0,z:0,kind:'machine',label:'Scout salvage',items:[item('valuable',{value:10})]};raid.bags.push(bag);
 Object.assign(f.player(1),{x:120,z:120});
 const view=f.service.snapshot(f.ids[1]).bags.find(b=>b.id==='far_salvage');
 assert.ok(view,'the container marker metadata remains available');
 assert.equal(view.kind,'machine');
 assert.equal(view.label,'Scout salvage');
 assert.deepEqual(view.items,[],'items are hidden outside interaction range');
});

test('emptying a container removes it from the raid and the snapshot',t=>{
 const f=setup(t),raid=f.raid,p=f.player(0);
 const bag={id:'empty_me',x:0,y:0,z:0,kind:'gear',team:p.team,label:'Dropped gear',items:[item('valuable',{value:9})]};raid.bags.push(bag);
 f.service.action(f.ids[0],{type:'take',seq:p.seq+1,sourceId:bag.id,itemId:bag.items[0].id});
 assert.equal(raid.bags.find(b=>b.id===bag.id).items.length,0,'taking the last item empties the container');
 f.service.advance(.05,1000);
 assert.equal(raid.bags.some(b=>b.id===bag.id),false,'the empty container is pruned');
 assert.equal(f.service.snapshot(f.ids[0]).bags.some(b=>b.id===bag.id),false,'the snapshot no longer exposes it');
});

test('a downed operator is a body and never a phantom salvage bag',t=>{
 const f=setup(t),raid=f.raid,victim=f.player(1);
 Object.assign(f.player(2),{x:0,z:0,y:0,team:'beta_team'});
 Object.assign(victim,{hp:100,alive:true,downed:false,bleedUntil:0,protectedUntil:0,drops:{}});
 f.service.damage(raid,victim,200,{source:'operator'});
 assert.equal(victim.alive,true);
 assert.equal(victim.downed,true,'the operator is downed rather than killed');
 assert.equal(raid.bags.filter(b=>b.kind==='operator').length,0,'downing alone creates no salvage container');
 const body=f.service.snapshot(f.ids[0]).bodies.find(b=>b.id===f.ids[1]);
 assert.ok(body,'the downed enemy body is exposed as one container');
 assert.equal(body.team,victim.team);
 assert.deepEqual(raid.bags.filter(b=>b.kind==='operator').map(b=>b.id),[],'no phantom bag appears beside the body');
});
