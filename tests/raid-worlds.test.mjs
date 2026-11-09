import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAID_WORLDS,ARCHIVED_RAID_WORLDS,LEGACY_RAID_WORLDS,blocked,floorAt,getWorld,terrainHeightAt,raidScenery} from '../shared/raid-worlds.mjs';
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
test('procedural scenery is deterministic, dense, non-colliding and evenly spread',()=>{
 const foliage=new Set(['fern','shrub','moss','stump']),kinds=new Set(['fern','shrub','stump','moss','ruin','rubble']);
 const roads=world=>world.props.filter(p=>['road','sidewalk','crosswalk','plaza'].includes(p.kind)&&p.w&&p.d);
 for(const world of RAID_WORLDS){
  const scenery=raidScenery(world),once=raidScenery(world);
  assert.deepEqual(scenery,once,'scenery is deterministic for a sector');
  assert.ok(scenery.length>=500,`${world.id} gains dense scenery (${scenery.length})`);
  const counts={};for(const p of scenery)counts[p.kind]=(counts[p.kind]||0)+1;
  assert.deepEqual(new Set(Object.keys(counts)),kinds,'all six scenery kinds render');
  assert.ok(scenery.filter(p=>foliage.has(p.kind)).length/scenery.length>=.6,'foliage dominates the scenery pass');
  assert.ok(counts.ruin>=1&&counts.rubble>=1,'ruin walls and rubble fields accompany destroyed structures');
  const quadrants=[0,0,0,0];const roadProps=roads(world);
  for(const p of scenery){
   assert.ok(Math.abs(p.x)<world.size/2-17&&Math.abs(p.z)<world.size/2-17,`${world.id} scenery stays inside the sector edge`);
   assert.equal(blocked(world,p.x,p.z,.1,0,.2),false,`${world.id} scenery never overlaps collision solids (${p.kind} at ${p.x},${p.z})`);
   for(const road of roadProps)assert.ok(!(Math.abs(p.x-road.x)<road.w/2+2&&Math.abs(p.z-road.z)<road.d/2+2),`${world.id} scenery stays off roads and sidewalks`);
   quadrants[(p.x>=0?1:0)+(p.z>=0?2:0)]++;
  }
  assert.ok(quadrants.every(n=>n>0),`${world.id} scenery covers every quadrant (${quadrants})`);
  for(const [x,z]of world.spawns)assert.ok(scenery.every(p=>Math.hypot(p.x-x,p.z-z)>=15),`${world.id} spawn pad stays clear`);
  for(const [x,z]of world.caches)assert.ok(scenery.every(p=>Math.hypot(p.x-x,p.z-z)>=11),`${world.id} cache pad stays clear`);
  for(const exit of world.exits)assert.ok(scenery.every(p=>Math.hypot(p.x-exit.x,p.z-exit.z)>=13),`${world.id} exit pad stays clear`);
 }
});
test('old checkpoints retain their original world layout version',()=>{
 for(const old of LEGACY_RAID_WORLDS){assert.equal(getWorld(old.id,1),old);assert.notEqual(getWorld(old.id,2),old)}
});

test('v2 roof landings remain archived while v3 keeps corrected landings',()=>{
 for(const old of ARCHIVED_RAID_WORLDS){const next=getWorld(old.id,3);assert.equal(getWorld(old.id,2),old);assert.equal(old.version,2);assert.equal(next.version,3);assert.notStrictEqual(next.blocks,old.blocks);for(const ramp of old.ramps.filter(r=>r.axis==='z'&&r.w===4&&r.d===16)){assert.ok(old.blocks.some(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+7&&w===7&&d===4&&h===.18));assert.ok(next.blocks.some(([x,z,w,d,h])=>x===ramp.x-3&&z===ramp.z+9&&w===7&&d===4&&h===.18))}}
});
test('new deployments use full-sector v10 terrain districts while archived checkpoints keep their layouts',()=>{
 const clusterCenters=[-600,-360,-120,120,360,600],propKinds=new Set();
 for(const world of RAID_WORLDS){
  for(const p of world.props)propKinds.add(p.kind);
  assert.equal(world.version,10);assert.equal(world.size,1440);assert.ok(world.blocks.length>=50);
  const v9=getWorld(world.id,9);assert.equal(v9.version,9);assert.equal(v9.size,1440);
  assert.deepEqual(world.blocks,v9.blocks,'v10 terrain leaves every v9 building block unchanged');
  assert.deepEqual(world.props,v9.props,'v10 terrain leaves every v9 prop unchanged');
  assert.deepEqual(world.spawns,v9.spawns);assert.deepEqual(world.caches,v9.caches);assert.deepEqual(world.exits,v9.exits);
  assert.deepEqual(world.ramps,v9.ramps,'v10 terrain leaves every ramp unchanged');assert.deepEqual(world.hazards,v9.hazards,'v10 terrain leaves every hazard unchanged');
  assert.deepEqual(world.landmarks,v9.landmarks,'v10 terrain leaves every landmark unchanged');assert.deepEqual(world.supply,v9.supply,'v10 terrain leaves the supply site unchanged');
  for(const [x,z,w,d]of world.blocks)assert.ok(terrainHeightAt(world,x,z)<.26,`${world.id} block at ${x},${z} sits on a flat terrain pad (${terrainHeightAt(world,x,z).toFixed(2)} m)`);
  for(const ramp of world.ramps)assert.ok(terrainHeightAt(world,ramp.x,ramp.z)<.26,`${world.id} ramp at ${ramp.x},${ramp.z} sits on a flat terrain pad`);
  for(const [x,z]of world.spawns)assert.ok(terrainHeightAt(world,x,z)<.26,`${world.id} spawn at ${x},${z} sits on a flat terrain pad`);
  for(const [x,z]of world.caches)assert.ok(terrainHeightAt(world,x,z)<.26,`${world.id} cache at ${x},${z} sits on a flat terrain pad`);
  for(const exit of world.exits)assert.ok(terrainHeightAt(world,exit.x,exit.z)<.26,`${world.id} exit at ${exit.x},${exit.z} sits on a flat terrain pad`);
  let maxHeight=0,deep=0,total=0;for(let x=-680;x<=680;x+=15)for(let z=-680;z<=680;z+=15){const height=terrainHeightAt(world,x,z);total++;maxHeight=Math.max(maxHeight,height);if(height>1)deep++}
  assert.ok(maxHeight>=10,`${world.id} sculpts hills of at least 10 m (${maxHeight.toFixed(1)} m)`);
  assert.ok(deep/total>=.2,`${world.id} lifts at least 20% of the sampled ground above 1 m (${(100*deep/total).toFixed(1)}%)`);
  assert.ok(Math.max(...world.spawns.flatMap(p=>p.map(Math.abs)))+0>=600,'spawns reach the massive sector edges');
  assert.ok(Math.max(...world.caches.flatMap(c=>[Math.abs(c[0]),Math.abs(c[2])]))+0>=450,'caches spread across the massive sector');
  assert.ok(world.ramps.length>0);assert.ok(world.exits.every(e=>Math.abs(e.x)>640||Math.abs(e.z)>640),'exits sit at the outer sector edge');
  const v8=getWorld(world.id,8);assert.equal(v8.version,8);assert.equal(v8.size,1440);
  assert.deepEqual(world.blocks.slice(0,v8.blocks.length),v8.blocks,'v10 retains the entire frozen v8 settlement layer');
  assert.ok(world.blocks.length>=v8.blocks.length*1.6,`v9 adds district buildings (${world.blocks.length} vs ${v8.blocks.length})`);
  assert.ok(world.props.length>=v8.props.length*1.4,`v9 adds district props (${world.props.length} vs ${v8.props.length})`);
  assert.ok(world.props.filter(p=>p.kind==='window').length>1000,'v9 districts have a dense facade window count');
  for(const kind of ['road','sidewalk','window','lamp','powerPole','fence'])assert.ok(world.props.some(p=>p.kind===kind),`${world.id} has a readable street layer with ${kind}`);
  const addedBlocks=world.blocks.slice(v8.blocks.length);
  assert.ok(addedBlocks.filter(([, , , , ,base=0])=>base===0).length>=30,`v9 authors at least 30 ground structures in ${world.id}`);
  for(const cx of clusterCenters)for(const cz of clusterCenters){
   const cell=addedBlocks.filter(([x,z])=>x>=cx-120&&x<cx+120&&z>=cz-120&&z<cz+120);
   assert.ok(cell.some(([,,,,,base=0])=>base===0),`${world.id} cell ${cx},${cz} is an authored district with ground-block geometry`);
  }
  const v7=getWorld(world.id,7);assert.equal(v7.version,7);assert.equal(v7.size,1440);
  for(const [x,z,w,d,h,base=0,kind='concrete']of v7.blocks)assert.ok(v8.blocks.some(([bx,bz,bw,bd,bh,bb=0,bk='concrete'])=>bx===x&&bz===z&&bw===w&&bd===d&&bh===h&&bb===base&&bk===kind),'v8 retains every v7 dressing block');
  assert.ok(v8.blocks.length>v7.blocks.length,'v8 adds settlement buildings');
  assert.ok(v8.props.length>v7.props.length,'v8 adds roads, windows, lamps and street furniture');
  assert.ok(world.props.length>v8.props.length,'v9 adds district roads, fields and street furniture');
  assert.notStrictEqual(world.blocks,v8.blocks);assert.notStrictEqual(world.props,v8.props);
  const v6=getWorld(world.id,6);assert.equal(v6.version,6);assert.equal(v6.size,1440);
  const previous=getWorld(world.id,5);assert.equal(previous.version,5);assert.equal(previous.size,720);assert.notStrictEqual(previous.blocks,v6.blocks);
  assert.deepEqual(previous.blocks.map(([x,z,w,d,h,base=0,kind])=>[x*2,z*2,w*2,d*2,h,base,kind]),v6.blocks);
  assert.equal(getWorld(world.id),world);
  assert.equal(getWorld(world.id,7),v7);
  assert.equal(getWorld(world.id,8),v8);
  assert.equal(getWorld(world.id,4).version,4);assert.equal(getWorld(world.id,4).size,480);
 }
 for(const kind of ['field','fence','hedge','billboard','truck','pallet','hay','planter','stall'])assert.ok(propKinds.has(kind),`the v9 district layer uses a ${kind} prop`);
});
test('navigation cache invalidates when geometry changes',()=>{
 const world={version:3,size:20,blocks:[],ramps:[]},from={x:-5,y:0,z:0},to={x:5,y:0,z:0};assert.ok(findPath(world,from,to).length);world.blocks.push([0,0,2,20,4]);assert.equal(findPath(world,from,to).length,0);world.blocks.pop();assert.ok(findPath(world,from,to).length);
});
