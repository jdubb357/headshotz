// Compare identical private fixtures under two runtime roots. No player data.
import {spawn} from 'node:child_process';
import {mkdtemp,copyFile,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import v8 from 'node:v8';
const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2)options[args[i].replace(/^--/,'')]=args[i+1];
const ticks=Number(options.ticks||500),worlds=Number(options.worlds||60);if(!Number.isInteger(ticks)||ticks<10||ticks>10000||!Number.isInteger(worlds)||worlds<1||worlds>300)throw new Error('Invalid probe size');
const turn=()=>new Promise(r=>setImmediate(r)),self=fileURLToPath(import.meta.url);
if(options.worker==='yes'){
 const db=await realpath(options.db);if(!/^\/(?:private\/)?tmp\/hs-idle-worlds-[^/]+$/.test(dirname(db))||!['before.sqlite','after.sqlite'].includes(basename(db))||typeof global.gc!=='function')throw new Error('Internal worker requires private fixture and --expose-gc');
 const root=pathToFileURL(resolve(options.runtime)+'/'),{RaidStore}=await import(new URL('server/store.mjs',root)),{RaidService}=await import(new URL('server/raids.mjs',root)),store=new RaidStore(db),service=new RaidService(store,{now:()=>1300});
 let checkpointCalls=0,checkpointBytes=0;const checkpoint=store.checkpoint;store.checkpoint=function(raid){checkpointCalls++;checkpointBytes+=Buffer.byteLength(JSON.stringify(raid));return checkpoint.call(this,raid)};
 const samples=[],start=performance.now(),sample=phase=>{const h=v8.getHeapStatistics(),s={phase,seconds:(performance.now()-start)/1000,...process.memoryUsage(),v8Physical:h.total_physical_size,checkpointCalls,checkpointBytes};samples.push(s);console.log(JSON.stringify({progress:s}));};
 global.gc();await turn();sample('start-after-gc');for(let i=0;i<ticks;i++){service.tick(.05);if((i+1)%100===0){sample('ticks-'+(i+1));await turn()}}sample('before-final-gc');global.gc();await turn();global.gc();await turn();sample('after-final-gc');
 const report={runtimeRoot:root.href,ticks,worlds,elapsedSeconds:(performance.now()-start)/1000,checkpointCalls,checkpointBytes,samples,raidCount:service.raids.size,activeRaids:[...service.raids.values()].filter(r=>[...r.players.values()].some(p=>p.alive||p.pending)).length};service.close();store.close();await writeFile(options.out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({summary:report}));
}else{
 const current=resolve(options.after||fileURLToPath(new URL('../',import.meta.url))),prior=resolve(options.before||current),directory=await mkdtemp('/tmp/hs-idle-worlds-'),baseline=join(directory,'baseline.sqlite');
 const {RaidStore}=await import(pathToFileURL(join(prior,'server/store.mjs'))),{RaidService}=await import(pathToFileURL(join(prior,'server/raids.mjs'))),store=new RaidStore(baseline);let clock=1000,service=new RaidService(store,{now:()=>clock});
 try{
  const archived=store.register('archived_operator','a private archived operator password').id;
  for(let i=0;i<worlds;i++){clock=1000+i*.1;service.deploy(archived,{requestId:'idle_archived_'+i,mapId:['relay','reservoir','switchyard'][i%3],recovery:true});const p=service.byAccount.get(archived),r=service.raids.get(p.raidId);service.atomic(()=>service.end(r,p,'death'));}
  clock=1300;for(let i=0;i<9;i++){const id=store.register('active_operator_'+i,'a private active operator password').id;service.deploy(id,{requestId:'idle_active_'+i,mapId:['relay','reservoir','switchyard'][i%3],recovery:true})}
  service.close();service=null;store.close();const results=[];
  for(const [label,runtime]of [['before',prior],['after',current]]){
   const db=join(directory,label+'.sqlite'),out=join(directory,label+'.json');await copyFile(baseline,db);const child=spawn(process.execPath,['--expose-gc',self,'--worker','yes','--runtime',runtime,'--db',db,'--out',out,'--ticks',String(ticks),'--worlds',String(worlds)],{stdio:['ignore','inherit','inherit']});
   const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});if(code!==0)throw new Error('Probe failed: '+label);results.push({label,...JSON.parse(await readFile(out,'utf8'))});
  }
  const report={format:1,at:new Date().toISOString(),worlds,ticks,results,scope:'Identical cloned file-backed fixture: completed/unjoinable worlds plus nine active bodies, fixed simulation time, original AI/events and real tick/checkpoint transactions. Independent worker processes, explicit GC diagnostics. Not real-time human gameplay or full long-session memory proof.'};if(options.out)await writeFile(resolve(options.out),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({comparison:results.map(r=>({label:r.label,seconds:r.elapsedSeconds,checkpointCalls:r.checkpointCalls,checkpointBytes:r.checkpointBytes,rss:r.samples.at(-1).rss,heap:r.samples.at(-1).heapUsed}))}));
 }finally{service?.close();try{store.close()}catch{}await rm(directory,{recursive:true,force:true})}
}
