// Measured protected-disconnect versus extraction behavior. This runner owns its
// disposable service and never grants positions, loot, damage or settlements.
import {mkdtemp,mkdir,rm,readFile,readdir,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir,platform} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {RaidStore} from '../server/store.mjs';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {contractItemReserved} from '../shared/raid-sectors.mjs';
import {ReliableActions} from '../raid-transport.mjs';
import {RaidPilot,gameplayRejection} from './lib/raid-pilot.mjs';
import {RaidEconomyObserver,economyReport} from './lib/raid-economy-observer.mjs';
import {isolatedRaidService} from './lib/isolated-raid-service.mjs';
const eligible=it=>!it.recovery&&!it.grantOwner&&['valuable','key','material','med','mod'].includes(it.kind);
export class ProtectedRoutePilot extends RaidPilot {
 lootScore(it,stats){return eligible(it)?1000+super.lootScore(it,stats):it.kind==='contract'?-1000:super.lootScore(it,stats)}
 intent(state){if(state.self.secure.length)this.phase='extract';return super.intent(state)}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fingerprint(){
 const root=fileURLToPath(new URL('../',import.meta.url)),paths=['scripts/raid-strategy-load.mjs','scripts/lib/raid-pilot.mjs','scripts/lib/raid-economy-observer.mjs','scripts/lib/isolated-raid-service.mjs','raid-transport.mjs'];
 for(const directory of ['server','shared'])for(const file of await readdir(join(root,directory),{recursive:true}))if(file.endsWith('.mjs'))paths.push(directory+'/'+file);
 const files=await Promise.all(paths.sort().map(async path=>({path,sha256:createHash('sha256').update(await readFile(join(root,path))).digest('hex')})));
 return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export async function runStrategyLoad({seconds=900,onProgress=()=>{},signal}={}){
 if(!Number.isFinite(seconds)||seconds<1||seconds>7200)throw new Error('Invalid strategy duration');
 if(signal?.aborted)throw new Error('Strategy run canceled');
 const source=await fingerprint(),directory=await mkdtemp(join(platform()==='darwin'?'/tmp':tmpdir(),'hs-strategy-')),data=join(directory,'data');await mkdir(data,{mode:0o700});
 const seedStore=new RaidStore(join(data,'raid.sqlite')),agents=[];let service;
 try{
  for(const strategy of ['protected_disconnect','extract'])for(const map of ['relay','reservoir','switchyard']){
   const index=agents.length,username='strategy_'+index,id=seedStore.register(username,'a private strategy fixture password').id,auth=seedStore.login(username,'a private strategy fixture password');
   agents.push({index,map,strategy,id,cookie:'raid_session='+auth.token,observer:new RaidEconomyObserver(index),deploys:0,actions:0,secureReached:0,voluntaryDisconnects:0,seen:new Set(),attempts:[],rejections:{},failures:[],navigation:[],initialIds:new Set(),bytes:0});
  }
  seedStore.close();service=await isolatedRaidService(data,{build:'strategy-'+source.sha256.slice(0,16)});if((await fingerprint()).sha256!==source.sha256)throw new Error('Sources changed during startup');
  onProgress({phase:'starting',startedAt:new Date().toISOString(),sourceSha256:source.sha256,servicePid:service.child.pid,seconds,accounts:agents.length});
  const direct=async(a,path,body)=>{
   if(signal?.aborted)throw new Error('Strategy run canceled');
   const timeout=AbortSignal.timeout(5000),response=await fetch(service.url+'/api/'+path,{method:body?'POST':'GET',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{cookie:a.cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   const text=await response.text(),value=JSON.parse(text);a.bytes+=Buffer.byteLength(text);if(!response.ok)throw Object.assign(new Error(value.error||'Request rejected'),{status:response.status,state:value.state,ack:value.ack});return value;
  };
  const profile=async(a,phase)=>a.observer.observe(await direct(a,'profile'),phase);
  const collect=async a=>{
   const results=(await direct(a,'results')).filter(r=>!a.seen.has(r.id));if(!results.length)return;
   let p=await profile(a,'settlement');
   for(const r of results){a.seen.add(r.id);a.observer.settlement(r,p);a.attempts.push({outcome:r.outcome,durationSeconds:r.raid?.durationSeconds,returnedStacks:r.items.length,credits:r.credits,xp:r.xp,securedBeforeQuit:a.quitting,secureSeconds:a.secureSeconds??null});}
   for(const it of p.overflow||[]){await direct(a,'trade',{type:'claimOverflow',itemId:it.id});p=await profile(a,'claim_overflow');}
   const ids=p.items.filter(it=>!a.initialIds.has(it.id)&&!it.grantOwner&&!it.recovery&&!it.favorite&&!contractItemReserved(p,it)).map(it=>it.id);
   if(ids.length){await direct(a,'trade',{type:'bulkSell',itemIds:ids});await profile(a,'recovered_loot_sale');}
  };
  const deploy=async a=>{
   await collect(a);const p=await profile(a,'preparation');if(!a.initialIds.size)for(const it of p.items)a.initialIds.add(it.id);
   a.state=await direct(a,'deploy',{protocol:RAID_PROTOCOL,requestId:'strategy_'+a.index+'_'+a.deploys++,mapId:a.map,recovery:true,itemIds:[],insureIds:[]});
   a.observer.deployment(a.state.self.deploymentId,a.state.self.equipment.map(i=>i.id),{recovery:true});await profile(a,'deployment');
   if(a.pilot)a.navigation.push({...a.pilot.stats});a.pilot=new ProtectedRoutePilot({index:a.index,account:a.id,surveySites:1});a.quitting=false;a.reached=false;a.secureSeconds=null;a.deployedAt=performance.now();
   a.channel=new ReliableActions({state:a.state,onState:state=>a.state=state,request:packet=>direct(a,'action',packet)});
  };
  for(const a of agents)await deploy(a);
  const started=performance.now(),deadline=started+seconds*1000;
  const progress=setInterval(()=>onProgress({elapsedSeconds:(performance.now()-started)/1000,agents:agents.map(a=>({index:a.index,map:a.map,strategy:a.strategy,actions:a.actions,deployments:a.deploys,settlements:a.attempts.length,secureReached:a.secureReached,voluntaryDisconnects:a.voluntaryDisconnects,failures:a.failures.length}))}),15000);progress.unref();
  try{
   await Promise.all(agents.map(async a=>{
    try{
     while(performance.now()<deadline){
      if(!a.state.self.alive){await collect(a);if(performance.now()>=deadline)break;await deploy(a);continue;}
      if(a.state.self.secure.length&&!a.reached){a.reached=true;a.secureReached++;a.secureSeconds=(performance.now()-a.deployedAt)/1000;}
      if(a.reached&&a.strategy==='protected_disconnect'){
       if(!a.quitting){await a.channel.send({type:'move',x:0,z:0,yaw:a.state.self.yaw||0,pitch:0});a.quitting=true;a.voluntaryDisconnects++;}
       // Raid snapshots count as reconnect heartbeats. Observe only the base
       // profile until the vulnerable body has actually settled.
       await sleep(Math.min(1000,Math.max(0,deadline-performance.now())));if(!(await direct(a,'profile')).activeDeployment)a.state=await direct(a,'raid');continue;
      }
      const at=performance.now(),intent=a.pilot.intent(a.state);
      try{await a.channel.send(intent);a.actions++;a.pilot.accepted(intent,a.state)}catch(e){if(e.state)a.state=e.state;const kind=!a.state.self.alive?'terminal_race':gameplayRejection(e);if(!kind)throw e;a.rejections[kind]=(a.rejections[kind]||0)+1;a.pilot.rejected(intent,a.state)}
      await sleep(Math.min(Math.max(0,deadline-performance.now()),Math.max(0,150-(performance.now()-at))));
     }
    }catch(error){a.failures.push({status:error.status||null,message:error.message.slice(0,160)})}
   }));
   // Include the real 45-second disconnect risk/delay in wall-time returns.
   const drainAt=performance.now();while(agents.some(a=>a.state.self.alive)&&performance.now()-drainAt<47000){await sleep(1000);for(const a of agents)if(a.state.self.alive&&!(await direct(a,'profile')).activeDeployment)a.state=await direct(a,'raid');}
   for(const a of agents){await collect(a);await profile(a,'final');if(a.pilot)a.navigation.push({...a.pilot.stats});}
  }finally{clearInterval(progress)}
  const elapsedSeconds=(performance.now()-started)/1000,economy=economyReport(agents.map(a=>a.observer));
  const players=agents.map(a=>{const r=a.observer.report();return {index:a.index,map:a.map,strategy:a.strategy,actions:a.actions,deployments:a.deploys,secureReached:a.secureReached,voluntaryDisconnects:a.voluntaryDisconnects,attempts:a.attempts,acceptedBytes:a.bytes,rejections:a.rejections,failures:a.failures,navigation:a.navigation,activeAtEnd:!!r.final.active,earnedCreditsDelta:r.final.earnedCredits-r.initial.earnedCredits,starterCreditsDelta:r.final.starterCredits-r.initial.starterCredits,xpDelta:r.final.xp-r.initial.xp,earnedCreditsPerHour:(r.final.earnedCredits-r.initial.earnedCredits)*3600/elapsedSeconds}});
  return {format:1,source,requestedSeconds:seconds,elapsedSeconds,drainSeconds:elapsedSeconds-seconds,players,economy,checks:{noUnexpectedFailures:players.every(p=>!p.failures.length),allBodiesSettled:players.every(p=>!p.activeAtEnd),starterAllowanceUnspent:players.every(p=>p.starterCreditsDelta===0),observedConservation:economy.checks.allObservedBalancesConserved},scope:'Six synthetic persistent accounts: one per map/strategy. Normal public geometry, authenticated API actions, AI/PvP, loot/search/protection, 45-second disconnect exposure and real settlement/trading; no granted loot, movement, damage or outcomes. Recovery kits for both strategies. Loot is sold while original starter items remain untouched. No contracts, insurance, paid equipment or network impairment. Different unseeded raids/spawns and small cohort prevent human balance or universal strategy-dominance conclusions. Final drain time is included in hourly rates.'};
 }finally{try{seedStore.close()}catch{}await service?.close();await rm(directory,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--seconds','--out'].includes(args[i])||args[i+1]==null)throw new Error('Use --seconds NUMBER --out NEW_FILE');options[args[i].slice(2)]=args[i+1]}
 if(options.out)try{await access(options.out);throw new Error('Use a new report filename')}catch(e){if(e.code!=='ENOENT')throw e}
 const cancellation=new AbortController();for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>cancellation.abort());
 const result=await runStrategyLoad({signal:cancellation.signal,seconds:Number(options.seconds||900),onProgress:p=>console.log(JSON.stringify({progress:p}))});if(options.out)await writeFile(options.out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({summary:{checks:result.checks,elapsedSeconds:result.elapsedSeconds,players:result.players.map(({index,map,strategy,earnedCreditsPerHour,deployments,secureReached,voluntaryDisconnects,attempts,failures})=>({index,map,strategy,earnedCreditsPerHour,deployments,secureReached,voluntaryDisconnects,settled:attempts.length,failures}))}}));if(Object.values(result.checks).some(v=>!v))process.exitCode=1;
}
