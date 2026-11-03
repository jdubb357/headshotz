// Controlled SQLite/statement experiment. This is not a live gameplay soak.
import {spawn} from 'node:child_process';
import {mkdtemp,copyFile,readFile,writeFile,rm,realpath,lstat} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import v8 from 'node:v8';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
const self=fileURLToPath(import.meta.url),args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2)options[args[i].replace(/^--/,'')]=args[i+1];
const actions=Number(options.actions||50000);if(!Number.isInteger(actions)||actions<1000||actions>500000)throw new Error('Use 1000–500000 actions');
const turn=()=>new Promise(r=>setImmediate(r));
if(options.worker==='yes'){
 if(typeof global.gc!=='function')throw new Error('Internal worker requires --expose-gc');
 const path=await realpath(options.db),parent=dirname(path),info=await lstat(options.db);if(!/^\/(?:private\/)?tmp\/hs-memory-[^/]+$/.test(parent)||!['uncached.sqlite','cached.sqlite'].includes(basename(path))||info.isSymbolicLink()||!info.isFile()||info.nlink!==1)throw new Error('Worker only accepts its disposable memory fixture');
 const store=new RaidStore(options.db),prepare=store.db.prepare.bind(store.db),counts=new Map(),cache=new Map();let compiled=0,hits=0;
 store.db.prepare=sql=>{counts.set(sql,(counts.get(sql)||0)+1);if(options.variant==='cached'&&cache.has(sql)){hits++;return cache.get(sql)}const stmt=prepare(sql);compiled++;if(options.variant==='cached'&&cache.size<256)cache.set(sql,stmt);return stmt};
 const service=new RaidService(store,{now:()=>1000});for(const raid of service.raids.values()){raid.machines=[];raid.world={...raid.world,hazards:[]}}
 const ids=[...service.byAccount.keys()],tokens=ids.map(id=>store.issueSession(id).token),samples=[],started=performance.now();
 const sample=phase=>{const memory=process.memoryUsage(),heap=v8.getHeapStatistics(),value={phase,elapsedSeconds:(performance.now()-started)/1000,...memory,v8Malloced:heap.malloced_memory,v8Physical:heap.total_physical_size,compiled,cacheEntries:cache.size,hits};samples.push(value);console.log(JSON.stringify({progress:value}));};
 try{
  global.gc();await turn();sample('start-after-gc');
  for(let i=0;i<actions;i++){
   const account=ids[i%ids.length],p=service.byAccount.get(account);service.action(account,{type:'move',x:0,z:0,yaw:(i%600)/100,seq:p.seq+1});
   store.authenticate(tokens[i%tokens.length]);
   if(i%27===0)service.tick(.05);
   if((i+1)%5000===0){sample('actions-'+(i+1));await turn()}
  }
  sample('before-final-gc');global.gc();await turn();global.gc();await turn();sample('after-final-gc');
 }finally{service.close();cache.clear();store.close()}
 global.gc();await turn();global.gc();await turn();sample('after-database-close');
 const report={variant:options.variant,actions,elapsedSeconds:(performance.now()-started)/1000,samples,prepares:[...counts.values()].reduce((n,x)=>n+x,0),compiled,cacheHits:hits,uniqueSql:counts.size,topSql:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([sql,count])=>({sql,count})),scope:'Private cloned file-backed 27-account fixture, zero movement, no AI/hazards, fixed simulation clock and synchronous actions/checkpoints with regular event-loop yields. Cached variant is experimental in this process only. Explicit GC phases are diagnostic, not production behavior.'};
 await writeFile(options.out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({summary:{variant:options.variant,actions,compiled,cacheHits:hits,elapsedSeconds:report.elapsedSeconds}}));
}else{
 const directory=await mkdtemp('/tmp/hs-memory-'),baseline=join(directory,'baseline.sqlite'),store=new RaidStore(baseline);let service;
 try{
  service=new RaidService(store,{now:()=>1000});for(let i=0;i<27;i++){const id=store.register('memory_fixture_'+i,'a private memory fixture password').id;service.deploy(id,{requestId:'memory_fixture_deploy_'+i,mapId:['relay','reservoir','switchyard'][i%3],recovery:true})}service.close();service=null;store.close();
  const results=[];
  for(const variant of ['uncached','cached']){
   const db=join(directory,variant+'.sqlite'),out=join(directory,variant+'.json');await copyFile(baseline,db);
   const child=spawn(process.execPath,['--expose-gc',self,'--worker','yes','--variant',variant,'--db',db,'--out',out,'--actions',String(actions)],{stdio:['ignore','inherit','inherit']});
   const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});if(code!==0)throw new Error('Memory worker failed: '+variant);results.push(JSON.parse(await readFile(out,'utf8')));
  }
  const report={format:1,actions,at:new Date().toISOString(),results,scope:'Controlled experiment with identical cloned databases and independent sequential processes. Not a proof that statement churn causes long-session RSS growth.'};
  if(options.out)await writeFile(resolve(options.out),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({summary:results.map(r=>({variant:r.variant,seconds:r.elapsedSeconds,compiled:r.compiled,rssBeforeGC:r.samples.find(s=>s.phase==='before-final-gc').rss,rssAfterGC:r.samples.find(s=>s.phase==='after-final-gc').rss,rssClosed:r.samples.at(-1).rss}))}));
 }finally{service?.close();try{store.close()}catch{}await rm(directory,{recursive:true,force:true})}
}
