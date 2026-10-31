import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAID_WORLDS,ARCHIVED_RAID_WORLDS,LEGACY_RAID_WORLDS,blocked,floorAt,getWorld} from '../shared/raid-worlds.mjs';
import {findPath} from '../shared/raid-navigation.mjs';
for(const world of RAID_WORLDS){
 test(`${world.name}: all spawns, caches and exits have walkable support`,()=>{
  assert.ok(world.blocks.length>=50);assert.ok(world.landmarks.length>=4);assert.ok(world.ramps.length>0);
  for(const [x,z,y=0]of [...world.spawns,...world.caches,...world.exits.map(e=>[e.x,e.z,e.y])]){
   assert.equal(blocked(world,x,z,.4,y),false,`Blocked point ${x},${y},${z}`);assert.ok(Math.abs(floorAt(world,x,z,y+.1)-y)<.1);
  }
 });
 test(`${world.name}: routes reach every ground/interior/roof cache and extraction`,()=>{
  const [x,z]=world.spawns[0],from={x,z,y:0};
  for(const [x,z,y=0]of [...world.caches,...world.exits.map(e=>[e.x,e.z,e.y])])assert.ok(findPath(world,from,{x,y,z}).length,`No route to ${x},${y},${z}`);
 });
}
test('old checkpoints retain their original world layout version',()=>{
 for(const old of LEGACY_RAID_WORLDS){assert.equal(getWorld(old.id,1),old);assert.notEqual(getWorld(old.id,2),old)}
});

test('v2 roof landings remain archived while new v3 landings join the ramp tops',()=>{
 for(const old of ARCHIVED_RAID_WORLDS){const next=getWorld(old.id);assert.equal(getWorld(old.id,2),old);assert.equal(old.version,2);assert.equal(next.version,3);assert.notStrictEqual(next.blocks,old.blocks);for(const ramp of old.ramps.filter(r=>r.axis==='z'&&r.w===4&&r.d===16)){assert.ok(old.blocks.some(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+7&&w===7&&d===4&&h===.18));assert.ok(next.blocks.some(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+9&&w===7&&d===4&&h===.18))}}
});
test('navigation cache invalidates when geometry changes',()=>{
 const world={version:3,size:20,blocks:[],ramps:[]},from={x:-5,y:0,z:0},to={x:5,y:0,z:0};assert.ok(findPath(world,from,to).length);world.blocks.push([0,0,2,20,4]);assert.equal(findPath(world,from,to).length,0);world.blocks.pop();assert.ok(findPath(world,from,to).length);
});
