import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RaidPilot} from './lib/raid-pilot.mjs';
import {getWorld,clearLine,supportAt} from '../shared/raid-worlds.mjs';
import {stepOperator} from '../shared/raid-motion.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y||0)-(b.y||0));
function stateAt(sample,world,profile){
 const p={x:sample.x,y:sample.y||0,z:sample.z,yaw:0,pitch:0,hp:100,alive:true,vy:0,grounded:Math.abs(supportAt(world,sample.x,sample.z,(sample.y||0)+.65)-(sample.y||0))<.1,fallPeak:sample.y||0,move:{x:0,z:0},lastMoveAt:1000,pack:[],secure:[],equipment:[{id:'fixture_rifle',kind:'weapon',weapon:'ar',loaded:30,condition:100}],weaponId:'fixture_rifle',ammo:30,combatVersion:profile==='legacy'?1:2,wounds:{}};
 if(profile==='heavy_injured'){p.equipment.push({kind:'armor',armor:'heavy',condition:100});p.wounds.limpUntil=100000}
 return {map:world.id,mapVersion:world.version,serverTime:1000,self:p};
}
function advance(world,state,intent){state.self.move={x:intent.x,z:intent.z};state.self.lastMoveAt=state.serverTime;for(let i=0;i<3;i++){state.serverTime+=.05;stepOperator(world,state.self,.05,state.serverTime)}}
function segment(sample,world,profile){
 if(!sample.waypoint)return {available:false};const state=stateAt(sample,world,profile),goal=sample.waypoint;
 for(let i=0;i<80;i++){if(distance(state.self,goal)<.35)return {available:true,reached:true,seconds:state.serverTime-1000};const dx=goal.x-state.self.x,dz=goal.z-state.self.z,len=Math.max(.01,Math.hypot(dx,dz)),scale=Math.min(1,len/.8);advance(world,state,{x:dx/len*scale,z:dz/len*scale})}
 return {available:true,reached:false,final:{x:state.self.x,y:state.self.y,z:state.self.z},distance:distance(state.self,goal)};
}
function route(sample,world,profile){
 const match=/^cache(\d+)$/.exec(sample.target),cache=match&&world.caches[Number(match[1])],goal=cache?{id:sample.target,x:cache[0],z:cache[1],y:cache[2]||0}:world.exits.find(e=>e.id===sample.target);
 if(!goal)return {available:false,reason:'Dynamic target position was not recorded'};
 const state=stateAt(sample,world,profile),pilot=new RaidPilot();
 for(let i=0;i<1400;i++){
  if(distance(state.self,goal)<2.4&&clearLine(world,state.self.x,state.self.z,goal.x,goal.z,state.self.y+1,(goal.y||0)+.6))return {available:true,reached:true,seconds:state.serverTime-1000,stalls:pilot.stats.stalls};
  const intent=pilot.navigate(state,world,goal);if(pilot.stats.unreachable)break;advance(world,state,intent);
 }
 return {available:true,reached:false,final:{x:state.self.x,y:state.self.y,z:state.self.z},distance:distance(state.self,goal),stats:pilot.stats};
}
function recoverWaypoint(sample,world,profile){
 if(!sample.waypoint)return {available:false};const state=stateAt(sample,world,profile),pilot=new RaidPilot(),goal={id:'recorded_waypoint',...sample.waypoint};pilot.path=[{...sample.waypoint}];pilot.goal=goal.id+':'+goal.y;pilot.progressAt=state.serverTime;pilot.progressPoint={x:state.self.x,y:state.self.y,z:state.self.z};
 for(let i=0;i<400;i++){if(distance(state.self,goal)<.35)return {available:true,reached:true,seconds:state.serverTime-1000,stalls:pilot.stats.stalls,offRouteReplans:pilot.stats.offRouteReplans||0};const intent=pilot.navigate(state,world,goal);if(pilot.stats.unreachable)break;advance(world,state,intent)}return {available:true,reached:false,final:{x:state.self.x,y:state.self.y,z:state.self.z},stats:pilot.stats};
}
export function replayStalls(input,{profiles=['legacy','heavy_injured']}={}){
 const report=input.report||input;if(!Array.isArray(report.navigation))throw new Error('Missing navigation report');const samples=report.navigation.filter(n=>n.stalls>0&&n.lastStall).map(n=>n.lastStall),results=[];
 for(const [index,sample]of samples.entries()){
  const world=getWorld(sample.map,3);if(!world||![sample.x,sample.y||0,sample.z].every(Number.isFinite))throw new Error('Unsupported recorded stall pose');for(const profile of profiles){if(!['legacy','heavy_injured'].includes(profile))throw new Error('Unknown movement profile');results.push({index,sample,profile,waypoint:segment(sample,world,profile),recoveredWaypoint:recoverWaypoint(sample,world,profile),route:route(sample,world,profile)})}
 }
 return {scope:'Static current physics/navigation replay of recorded positions. Fresh replanning and the recorded immediate waypoint are tested independently. Original velocity, held input, complete path, combat, network timing and dynamic target locations were not recorded. Success does not establish the original cause.',recordedStalls:report.navigation.reduce((n,p)=>n+(p.stalls||0),0),recordedPoses:samples.length,results,summary:{waypointReached:results.filter(r=>r.waypoint.reached).length,waypointFailed:results.filter(r=>r.waypoint.available&&!r.waypoint.reached).length,routesReached:results.filter(r=>r.route.reached).length,routesFailed:results.filter(r=>r.route.available&&!r.route.reached).length,dynamicTargetsMissing:results.filter(r=>!r.route.available).length}};
}
export async function replaySource(){const root=fileURLToPath(new URL('../',import.meta.url)),files=[];for(const path of ['scripts/replay-raid-stalls.mjs','scripts/lib/raid-pilot.mjs','shared/raid-worlds.mjs','shared/raid-motion.mjs','shared/raid-combat.mjs','shared/raid-navigation.mjs'])files.push({path,sha256:createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')});return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const options={};for(let i=2;i<process.argv.length;i+=2){if(!['--report','--out'].includes(process.argv[i])||!process.argv[i+1]||options[process.argv[i]])throw new Error('Use unique --report FILE [--out NEW_FILE]');options[process.argv[i]]=process.argv[i+1]}if(!options['--report'])throw new Error('Missing --report FILE');const input=JSON.parse(await readFile(resolve(options['--report']),'utf8')),source=await replaySource(),report=input.report||input,replay=replayStalls(input);replay.source=source;replay.recordedGeometryMatches=source.files.find(f=>f.path==='shared/raid-worlds.mjs').sha256===report.source?.files.find(f=>f.path==='shared/raid-worlds.mjs')?.sha256;if((await replaySource()).sha256!==source.sha256)throw new Error('Source changed during replay');if(options['--out'])await writeFile(resolve(options['--out']),JSON.stringify(replay,null,2)+'\n',{flag:'wx',mode:0o600});else console.log(JSON.stringify(replay,null,2))}catch(error){console.error('Stall replay failed: '+error.message);process.exitCode=1}
}
