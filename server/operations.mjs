import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {SCHEMA_VERSION} from './schema.mjs';
import {operatorCapacity} from './admission.mjs';
const ROUTES=new Set(['register','login','recover','worlds','capabilities','sessions','profile','results','market','raid','social','voice','party','logout','change-password','recovery-codes','revoke-session','deploy','action','trade'].map(p=>'/api/'+p).concat(['/health/live','/health/ready']));
const BOUNDS=[5,10,25,50,75,100,150,250,500,1000];
class Histogram {
 constructor(){this.count=0;this.sum=0;this.max=0;this.buckets=BOUNDS.map(()=>0).concat(0)}
 add(value){const n=Math.max(0,Number(value)||0);this.count++;this.sum+=n;this.max=Math.max(this.max,n);let i=BOUNDS.findIndex(b=>n<=b);this.buckets[i<0?BOUNDS.length:i]++}
 view(){const percentile=p=>{if(!this.count)return 0;let sum=0;for(let i=0;i<this.buckets.length;i++){sum+=this.buckets[i];if(sum>=Math.ceil(this.count*p))return BOUNDS[i]??this.max}return this.max};return {count:this.count,meanMs:this.count?this.sum/this.count:0,maxMs:this.max,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),boundsMs:BOUNDS,buckets:[...this.buckets]}}
}
export class Operations {
 constructor({store,raids,rates,comms,region,build='development',now=()=>Date.now()}){
  if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(build))throw new Error('Invalid build identifier');Object.assign(this,{store,raids,rates,comms,region,build,now});this.started=now();this.lastTick=now();this.lastTickFailed=false;this.failedAtCommit=-1;this.listening=false;this.draining=false;this.reason=null;this.lifecycleAuditFailed=false;this.tickErrors=0;this.requests=0;this.abortedRequests=0;this.bytes=0;this.http=new Map();this.ticks=new Histogram();this.tickIntervals=new Histogram();this.pendingSince=new Map();this.loop=monitorEventLoopDelay({resolution:20});this.loop.enable();
 }
 track(req,res){
  const start=performance.now();let path;try{path=new URL(req.url,'http://local').pathname}catch{path='invalid'}const route=ROUTES.has(path)?path:path.startsWith('/api/')?'other_api':'static',method=['GET','POST'].includes(req.method)?req.method:'OTHER';let bytes=0,recorded=false;
  for(const name of ['write','end']){const original=res[name];res[name]=function(chunk,...args){if(typeof chunk==='string')bytes+=Buffer.byteLength(chunk);else if(Buffer.isBuffer(chunk)||chunk instanceof Uint8Array)bytes+=chunk.byteLength;return original.call(this,chunk,...args)}}
  const finish=aborted=>{if(recorded)return;recorded=true;this.requests++;this.bytes+=bytes;if(aborted)this.abortedRequests++;const status=aborted?499:res.statusCode,key=method+' '+route+' '+Math.floor(status/100)+'xx';let metric=this.http.get(key);if(!metric){metric={method,route,statusGroup:Math.floor(status/100)+'xx',bytes:0,latency:new Histogram()};this.http.set(key,metric)}metric.bytes+=bytes;metric.latency.add(performance.now()-start)};
  res.once('finish',()=>finish(false));res.once('close',()=>finish(!res.writableFinished));
 }
 tick(duration,error,intervalMs=50){this.ticks.add(duration);this.tickIntervals.add(intervalMs);this.lastTick=this.now();if(error){this.lastTickFailed=true;this.failedAtCommit=this.store.commitSerial;this.tickErrors++}else if(this.store.commitSerial>this.failedAtCommit)this.lastTickFailed=false}
 databaseReady(){try{if(this.store.db.prepare('PRAGMA user_version').get().user_version!==SCHEMA_VERSION)return false;const lease=this.store.db.prepare("SELECT owner,expires FROM leases WHERE name='simulation'").get();return lease?.owner===this.raids.owner&&lease.expires>this.now()}catch{return false}}
 ready(){return this.listening&&!this.draining&&!this.lifecycleAuditFailed&&!this.lastTickFailed&&this.now()-this.lastTick<2000&&this.databaseReady()}
 setDraining(draining,{operator='local',reason='manual'}={}){
  if(typeof draining!=='boolean'||!/^[a-zA-Z0-9_.-]{1,64}$/.test(operator)||!['manual','deployment','maintenance','incident'].includes(reason))throw new Error('Invalid lifecycle command');if(draining===this.draining&&!this.lifecycleAuditFailed)return this.summary();
  try{this.store.transaction(()=>this.store.audit('operator:'+operator,draining?'server_draining':'server_resumed',{reason,build:this.build}))}catch{this.lifecycleAuditFailed=true;if(draining){this.draining=true;this.reason=reason;console.error(JSON.stringify({event:'drain_audit_failed',operator,reason}));return this.summary()}throw new Error('Lifecycle change could not be audited')}this.lifecycleAuditFailed=false;this.draining=draining;this.reason=draining?reason:null;return this.summary();
 }
 summary(){
  let activeOperators=0,activeRaids=0,pendingSettlements=0;const pending=new Set();for(const r of this.raids.raids.values()){let live=false;for(const p of r.players.values()){if(p.alive){activeOperators++;live=true}if(p.pending){pendingSettlements++;pending.add(p.deploymentId);if(!this.pendingSince.has(p.deploymentId))this.pendingSince.set(p.deploymentId,this.now())}}if(live)activeRaids++}
  for(const id of this.pendingSince.keys())if(!pending.has(id))this.pendingSince.delete(id);const oldestPendingMs=Math.max(0,...[...this.pendingSince.values()].map(at=>this.now()-at));
  const capacity=operatorCapacity(this.raids.raids,this.raids.maxOperators);
  let reportsOpen=null;try{reportsOpen=this.store.db.prepare("SELECT count(*) n FROM player_reports WHERE status='open'").get().n}catch{}
  const loopMs=n=>Number.isFinite(n)?n/1e6:0;
  return {memory:process.memoryUsage(),cpu:process.cpuUsage(),at:this.now(),startedAt:this.started,uptimeSeconds:(this.now()-this.started)/1000,build:this.build,region:this.region,schema:SCHEMA_VERSION,protocol:RAID_PROTOCOL,listening:this.listening,ready:this.ready(),draining:this.draining,reason:this.reason,lifecycleAuditFailed:this.lifecycleAuditFailed,operatorCapacity:capacity,activeOperators,activeRaids,pendingSettlements,oldestPendingMs,reportsOpen,voiceSessions:this.comms.presences.size,rateLimiterKeys:this.rates.windows.size,requests:this.requests,abortedRequests:this.abortedRequests,responseBytes:this.bytes,tickErrors:this.tickErrors,tickAgeMs:this.now()-this.lastTick,tick:this.ticks.view(),tickInterval:this.tickIntervals.view(),eventLoop:{meanMs:loopMs(this.loop.mean),p99Ms:loopMs(this.loop.percentile(99)),maxMs:loopMs(this.loop.max)},http:[...this.http.values()].map(m=>({method:m.method,route:m.route,statusGroup:m.statusGroup,bytes:m.bytes,...m.latency.view()})),alerts:[...(capacity.overCapacity?['operator_capacity_exceeded']:[]),...(this.lifecycleAuditFailed?['lifecycle_audit_failed']:[]),...(this.lastTickFailed?['simulation_tick_failed']:[]),...(oldestPendingMs>30000?['settlement_pending_over_30s']:[]),...(this.ticks.view().p95Ms>50?['tick_p95_over_50ms']:[]),...(this.tickIntervals.view().p95Ms>75?['tick_interval_p95_over_75ms']:[])]};
 }
 close(){this.listening=false;this.loop.disable()}
}
