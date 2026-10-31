import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayStalls} from '../scripts/replay-raid-stalls.mjs';
import {RaidPilot} from '../scripts/lib/raid-pilot.mjs';
import {getWorld,blocked,clearLine} from '../shared/raid-worlds.mjs';
import {findPath} from '../shared/raid-navigation.mjs';
import {stepOperator,OPERATOR_RADIUS} from '../shared/raid-motion.mjs';
const evidence=JSON.parse(readFileSync(new URL('./evidence/2026-10-30-two-hour-soak.json',import.meta.url),'utf8'));
test('recorded static destinations remain reachable with original and heavy/injured mobility',()=>{
 const replay=replayStalls(evidence);assert.equal(replay.recordedStalls,42);assert.equal(replay.recordedPoses,42);assert.equal(replay.summary.routesReached,80);assert.equal(replay.summary.routesFailed,0);assert.equal(replay.summary.dynamicTargetsMissing,4);assert.equal(replay.summary.waypointFailed,2);assert.ok(replay.results.filter(r=>r.waypoint.available&&!r.waypoint.reached).every(r=>r.index===41));
});
test('controller discards the recorded ramp-side segment before waiting for a stall timeout',()=>{
 const report={navigation:[evidence.report.navigation.filter(n=>n.lastStall).at(-1)]},replay=replayStalls(report);for(const row of replay.results){assert.equal(row.recoveredWaypoint.reached,true);assert.equal(row.recoveredWaypoint.stalls,0);assert.ok(row.recoveredWaypoint.offRouteReplans>0)}
});
function simulate(sample,{grounded=true,vy=0}={}){
 const world=getWorld(sample.map,3),state={map:world.id,mapVersion:3,serverTime:1000,self:{...sample.position,grounded,vy,fallPeak:sample.position.y,combatVersion:2,equipment:[{kind:'weapon',weapon:'ar',loaded:30,condition:100}],wounds:{},move:{x:0,z:0}}},pilot=new RaidPilot(),goal={id:sample.target,...sample.targetPosition};let reached=false;
 for(let i=0;i<1600;i++){if(Math.hypot(state.self.x-goal.x,state.self.z-goal.z,state.self.y-goal.y)<2.4&&clearLine(world,state.self.x,state.self.z,goal.x,goal.z,state.self.y+1,goal.y+.6)){reached=true;break}const intent=pilot.navigate(state,world,goal);state.self.move={x:intent.x,z:intent.z};state.self.lastMoveAt=state.serverTime;for(let j=0;j<3;j++){state.serverTime+=.05;stepOperator(world,state.self,.05,state.serverTime)}}return {reached,pilot};
}
test('a body-valid wall clearance from the follow-up is planned with the actual operator radius',()=>{
 const sample={map:'reservoir',position:{x:38.76860151432171,y:0,z:37.7013679386203},target:'cache6',targetPosition:{x:28,y:0,z:-38}},world=getWorld(sample.map,3);assert.equal(OPERATOR_RADIUS,.45);assert.equal(blocked(world,sample.position.x,sample.position.z,OPERATOR_RADIUS,0),false);assert.equal(blocked(world,sample.position.x,sample.position.z,.48,0),true);assert.equal(findPath(world,sample.position,sample.targetPosition,{radius:.48}).length,0);assert.ok(findPath(world,sample.position,sample.targetPosition,{radius:OPERATOR_RADIUS}).length>0);const result=simulate(sample);assert.equal(result.reached,true);assert.equal(result.pilot.stats.unreachable,0);
});
test('recorded falling poses land before ground planning rather than declaring valid goals unreachable',()=>{
 for(const sample of [
  {map:'relay',position:{x:-.01666832264805387,y:4.184834546125204,z:8.94427506769946},target:'call',targetPosition:{x:-70,y:0,z:0},vy:-.7016525880000263},
  {map:'reservoir',position:{x:-3.778882252725721,y:1.6949210982959384,z:5.741143353743276},target:'cache3',targetPosition:{x:0,y:1.8,z:12},vy:-1.4004900000000489},
  {map:'reservoir',position:{x:-4.3312076129682975,y:1.2662069969227678,z:5.264104825723012},target:'cache0',targetPosition:{x:-30,y:0,z:-22},vy:-3.5291153380001776}
 ]){const result=simulate(sample,{grounded:false,vy:sample.vy});assert.equal(result.reached,true);assert.equal(result.pilot.stats.unreachable,0);assert.equal(result.pilot.stats.airborneStalls,0);assert.ok(result.pilot.stats.airborneDeferrals>0)}
});
test('a genuinely prolonged unsupported body remains a reported failure rather than disappearing in the landing wait',()=>{
 const world=getWorld('relay',3),state={map:'relay',serverTime:1000,self:{x:0,y:10,z:0,grounded:false,vy:0,equipment:[],move:{x:0,z:0}}},pilot=new RaidPilot(),goal={id:'call',...world.exits[0]};pilot.navigate(state,world,goal);state.serverTime+=4;pilot.navigate(state,world,goal);assert.equal(pilot.stats.airborneStalls,1);assert.equal(pilot.stats.lastAirborne.grounded,false);state.serverTime+=1;pilot.navigate(state,world,goal);assert.equal(pilot.stats.airborneStalls,1);
});
