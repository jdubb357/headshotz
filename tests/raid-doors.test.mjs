import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {item,RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {RAID_PROTOCOL,validateAction} from '../shared/raid-protocol.mjs';
import {RAID_WORLDS,blocked,clearLine,getWorld,terrainHeightAt} from '../shared/raid-worlds.mjs';
import {findPath} from '../shared/raid-navigation.mjs';
import {bulletClear} from '../shared/raid-ballistics.mjs';

function setup(t){
 const store=new RaidStore();let now=1000;
 const service=new RaidService(store,{now:()=>now});
 const id=store.register('doors_'+randomUUID().slice(0,8),'a long interactive door password').id;
 service.deploy(id,{requestId:'door_deploy_'+id,mapId:'relay',recovery:true});
 const p=()=>service.byAccount.get(id),r=()=>service.raids.get(p().raidId);
 r().machines=[];r().rivals=[];
 Object.assign(p(),{protectedUntil:0,hp:100,alive:true,downed:false,bleedUntil:0});
 const lockedDoor=()=>r().world.doors.find(d=>d.locked),openDoor=()=>r().world.doors.find(d=>!d.locked);
 const place=door=>Object.assign(p(),{x:door.x,y:door.y||0,z:door.z+(door.w>door.d?1.5:0),move:{x:0,z:0},lastInput:now});
 const act=(type,extra)=>service.action(id,{type,seq:p().seq+1,...extra});
 t.after(()=>{service.close();store.close()});
 return {store,service,id,raidId:r().id,p,r,lockedDoor,openDoor,place,act,time:value=>now=value};
}

test('every sector authors stable door identities and a key-gated route',()=>{
 for(const world of RAID_WORLDS){
  const doors=world.doors||[];
  assert.ok(doors.length>=6,world.id+' has interactive doors');
  assert.equal(new Set(doors.map(door=>door.id)).size,doors.length,'door ids are unique in '+world.id);
  assert.ok(doors.every(door=>/^[a-z0-9-]+$/.test(door.id)),'door ids are wire-safe');
  assert.ok(doors.some(door=>door.locked&&door.label),world.id+' has at least one locked route');
  assert.ok(doors.every(door=>door.closed===false),'the frozen template stays open for legacy route checks');
 }
});

test('per-raid door state is cloned and locked doors deploy physically closed',t=>{
 const f=setup(t),base=RAID_WORLDS.find(w=>w.id==='relay'),raid=f.r();
 assert.notStrictEqual(raid.world,base);
 assert.notStrictEqual(raid.world.doors,base.doors);
 const locked=raid.world.doors.find(d=>d.locked),open=raid.world.doors.find(d=>!d.locked);
 assert.equal(locked.closed,true,'locked doors are closed on deployment');
 assert.equal(locked.locked,true);
 assert.equal(open.closed,false,'unlocked doors preserve existing routes until used');
 locked.closed=false;
 assert.equal(base.doors.find(d=>d.id===locked.id).closed,false,'opening a raid door never mutates the frozen sector');
});

test('out-of-reach doors are rejected by the service and the wire action validates',t=>{
 const f=setup(t),door=f.lockedDoor();
 Object.assign(f.p(),{x:door.x+20,y:0,z:door.z+20,move:{x:0,z:0},lastInput:1000});
 const before=structuredClone(f.r().world.doors),pack=structuredClone(f.p().pack);
 assert.throws(()=>f.act('door',{doorId:door.id}),/out of reach/i,'a door more than 3 m away cannot be operated');
 assert.throws(()=>f.act('door',{doorId:'not-a-door'}),/out of reach/i,'unknown door ids are rejected exactly like unreachable doors');
 assert.deepEqual(f.r().world.doors,before,'out-of-reach rejects leave every door unchanged');
 assert.deepEqual(f.p().pack,pack,'out-of-reach rejects leave inventory unchanged');
 const action={type:'door',doorId:'relay-door-01',seq:1,protocol:RAID_PROTOCOL};
 assert.equal(validateAction(action),validateAction({...action}));
 assert.throws(()=>validateAction({...action,doorId:'bad door'}),/Invalid action identifier/,'the wire protocol constrains door ids');
 assert.throws(()=>validateAction({...action,extra:true}),/Unknown action field/,'unknown door fields are rejected');
});
test('door actions reject without a key, preserve state, and consume one carried key',t=>{
 const f=setup(t),door=f.lockedDoor();f.place(door);
 const before=[...f.r().world.doors],pack=f.p().pack.length,events=f.r().events.length;
 assert.throws(()=>f.act('door',{doorId:door.id}),/key is required/i,'locked doors reject without a key');
 assert.deepEqual(f.r().world.doors,before,'a rejected unlock leaves every door unchanged');
 assert.equal(f.p().pack.length,pack,'a rejected unlock cannot consume inventory');
 assert.equal(f.r().events.length,events,'a rejected unlock emits no event');
 const key=item('key',{quantity:2});f.p().pack.push(key);
 assert.equal(f.act('door',{doorId:door.id}).accepted,true);
 const unlocked=f.r().world.doors.find(d=>d.id===door.id);
 assert.equal(unlocked.locked,false);assert.equal(unlocked.closed,false);
 assert.equal(f.p().facts.keysUsed,1);
 assert.ok(!f.p().pack.some(it=>it.id===key.id&&it.quantity===0),'one key is consumed');
 const wire=f.service.snapshot(f.id).doors.find(d=>d.id===door.id);
 assert.ok(wire,'the accepted unlock is visible in the client snapshot');
 assert.equal(wire.locked,false);assert.equal(wire.closed,false);
});

test('unlocked doors toggle and snapshots expose open, closed and locked state',t=>{
 const f=setup(t),door=f.openDoor();f.place(door);
 assert.equal(f.act('door',{doorId:door.id}).accepted,true);
 let wire=f.service.snapshot(f.id).doors.find(d=>d.id===door.id);
 assert.equal(wire.closed,true);assert.equal(wire.locked,false);
 assert.equal(f.act('door',{doorId:door.id}).accepted,true);
 wire=f.service.snapshot(f.id).doors.find(d=>d.id===door.id);
 assert.equal(wire.closed,false);assert.equal(wire.locked,false);
 assert.ok(f.service.snapshot(f.id).doors.some(d=>d.locked&&d.closed),'locked doors are visible to the client');
});

test('door state is preserved across serialize and restore',t=>{
 const f=setup(t),door=f.openDoor();f.place(door);
 f.act('door',{doorId:door.id});assert.equal(f.r().world.doors.find(d=>d.id===door.id).closed,true);
 const saved=f.service.serialize();
 assert.ok(Array.isArray(saved[0].doors)&&saved[0].doors.some(d=>d.id===door.id&&d.closed));
 f.service.restore(saved);
 assert.equal(f.service.raids.get(f.raidId)?.world.doors.find(d=>d.id===door.id).closed,true,'restore retains the authoritative door state');
});

test('closed doors block movement, sight, ballistics and navigation until opened',()=>{
 const door={id:'test-door',x:0,y:0,z:0,w:.4,d:40,h:3,locked:true,closed:true,label:'Test door'};
 const world={version:3,size:40,blocks:[],ramps:[],doors:[door]};
 assert.equal(blocked(world,0,0,.4,0,1.7),true);
 assert.equal(clearLine(world,-10,0,10,0,1.6,1.6),false);
 assert.equal(bulletClear(world,{x:-10,y:1.6,z:0},{x:10,y:1.6,z:0}),false);
 assert.equal(findPath(world,{x:-10,y:0,z:0},{x:10,y:0,z:0}).length,0,'closed doors gate navigation');
 door.closed=false;
 assert.equal(blocked(world,0,0,.4,0,1.7),false);
 assert.equal(clearLine(world,-10,0,10,0,1.6,1.6),true);
 assert.equal(bulletClear(world,{x:-10,y:1.6,z:0},{x:10,y:1.6,z:0}),true);
 assert.ok(findPath(world,{x:-10,y:0,z:0},{x:10,y:0,z:0}).length,'open doors restore the route');
});

test('locked rooms gate a real sector route while spawns and extraction routes stay reachable',()=>{
 for(const world of RAID_WORLDS){
  const doors=world.doors.map(door=>door.locked?{...door,locked:true,closed:true}:{...door,locked:false,closed:!!door.closed});
  const gated={...world,doors},door=doors.find(d=>d.locked),insideNorth=door.side==='n';
  const start={x:door.x,y:terrainHeightAt(world,door.x,door.z+(insideNorth?-5:5)),z:door.z+(insideNorth?-5:5)};
  const goal={x:door.x,y:terrainHeightAt(world,door.x,door.z+(insideNorth?5:-5)),z:door.z+(insideNorth?5:-5)};
  assert.equal(findPath(gated,start,goal).length,0,world.id+' locked room route is genuinely gated');
  const opened={...gated,doors:doors.map(d=>d.id===door.id?{...d,locked:false,closed:false}:d)};
  assert.ok(findPath(opened,start,goal).length,world.id+' opens a walkable route after the keyed unlock');
  const spawn=world.spawns[0],from={x:spawn[0],y:terrainHeightAt(world,...spawn),z:spawn[1]};
  for(const exit of world.exits)assert.ok(findPath(gated,from,{x:exit.x,y:exit.y||0,z:exit.z}).length,world.id+' keeps '+exit.id+' reachable while the room is locked');
 }
});
test('the client prediction and view can read door state instead of mutating the sector',()=>{
 const base=getWorld('relay',10),doors=[{...base.doors[0],closed:true}],overlay={...base,doors};
 assert.equal(blocked(base,doors[0].x,doors[0].z,0,0,1.7),false,'the frozen base world remains open');
 assert.equal(blocked(overlay,doors[0].x,doors[0].z,0,0,1.7),true,'the per-raid overlay enforces the door');
});
