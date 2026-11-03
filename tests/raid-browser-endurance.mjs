// Whole-client loopback endurance, including live API/UI/rendering and repeated
// field/base transitions. Fixture cutoffs are explicit, not gameplay successes.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const seconds=Number(process.env.RAID_CLIENT_SECONDS||1800),cycleSeconds=Number(process.env.RAID_CLIENT_CYCLE_SECONDS||60);
assert.ok(Number.isFinite(seconds)&&seconds>=15&&seconds<=7200);
assert.ok(Number.isFinite(cycleSeconds)&&cycleSeconds>=8&&cycleSeconds<=300);
const output=process.env.RAID_CLIENT_REPORT;if(output){try{await access(output);assert.fail('Use a new report filename')}catch(e){if(e.code!=='ENOENT')throw e}}
const root=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',root)),{createRaidServer}=await import(new URL('server/main.mjs',root)),{RAID_WORLDS}=await import(new URL('shared/raid-worlds.mjs',root));
const directory=await mkdtemp(join(tmpdir(),'hs-client-endurance-')),store=new RaidStore(join(directory,'raid.sqlite')),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness(),samples=[],cycles=[];let failure,page,account,measuredAt;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(p,code,down)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code});
const idle=p=>p.wait("document.body.getAttribute('aria-busy')==='false'");
try{
 const p=page=await h.page();await p.command('Page.bringToFront');await p.command('Performance.enable');
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='endurance_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long isolated endurance password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 account=(await p.evaluate("fetch('/api/profile').then(r=>r.json())")).id;
 await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs'),start=RaidView.prototype.start,frame=RaidView.prototype.frame;
  window.__endurance={frames:[],renderCpu:[],contextsLost:0,requests:0,statuses:{},expectedTerminalRaces:0,cooldownRefusals:0,otherFailures:[],starts:0};
  RaidView.prototype.start=function(...args){window.__field=this;window.__endurance.starts++;const result=start.apply(this,args);if(!this.canvas.__enduranceWatched){this.canvas.__enduranceWatched=true;this.canvas.addEventListener('webglcontextlost',()=>window.__endurance.contextsLost++)}return result};
  RaidView.prototype.frame=function(time,...args){const e=window.__endurance;if(e.lastFrame!=null)e.frames.push(time-e.lastFrame);e.lastFrame=time;const at=performance.now();const result=frame.call(this,time,...args);e.renderCpu.push(performance.now()-at);if(e.frames.length>7200)e.frames.shift();if(e.renderCpu.length>7200)e.renderCpu.shift();return result};
  const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).startsWith('/api/')){const e=window.__endurance;e.requests++;e.statuses[response.status]=(e.statuses[response.status]||0)+1;if(!response.ok){const body=await response.clone().json().catch(()=>({}));if(body.state?.self?.alive===false)e.expectedTerminalRaces++;else if(body.error==='Weapon not ready')e.cooldownRefusals++;else if(e.otherFailures.length<20)e.otherFailures.push({status:response.status,message:String(body.error||'Unknown error').slice(0,120)})}}return response};
 })()`);
 const actor=()=>runtime.raids.byAccount.get(account),sample=async phase=>{
  const metrics=await p.command('Performance.getMetrics'),dom=await p.command('Memory.getDOMCounters');
  const value=await p.evaluate(`(()=>{const e=window.__endurance,v=window.__field,quantile=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor((b.length-1)*q)]||0};return {phase:${JSON.stringify(phase)},frames:e.frames.length,frameP95Ms:quantile(e.frames,.95),frameP99Ms:quantile(e.frames,.99),renderCpuP95Ms:quantile(e.renderCpu,.95),contextsLost:e.contextsLost,requests:e.requests,statuses:{...e.statuses},expectedTerminalRaces:e.expectedTerminalRaces,cooldownRefusals:e.cooldownRefusals,otherFailures:[...e.otherFailures],recordCount:document.getElementById('records').children.length,recordNodes:(()=>{const walker=document.createTreeWalker(document.getElementById('records'),NodeFilter.SHOW_ALL);let n=0;while(walker.nextNode())n++;return n})(),starts:e.starts,resources:v?{...v.renderer.info.memory}:null,actors:v?.actors.size,audioActive:v?.audio.active,audioState:v?.audio.context?.state,fieldCleared:!v?.scene&&!v?.snapshot}})()`);
  value.elapsedSeconds=(performance.now()-measuredAt)/1000;value.jsHeapUsedBytes=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value;value.dom=dom;samples.push(value);console.log(JSON.stringify({progress:value}));return value;
 };
 measuredAt=performance.now();
 while(performance.now()-measuredAt<seconds*1000){
  const index=cycles.length,map=RAID_WORLDS[index%RAID_WORLDS.length].id;
  await p.evaluate(`document.getElementById('map').value=${JSON.stringify(map)};document.getElementById('map').dispatchEvent(new Event('change'));document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('recovery').dispatchEvent(new Event('change'))`);await idle(p);
  await p.evaluate("document.getElementById('deploy').click()");await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  const deployment=actor().deploymentId;const raid=runtime.raids.raids.get(actor().raidId);assert.equal(raid.world.id,map);
  await p.evaluate("document.getElementById('view').focus();window.__endurance.lastFrame=null");
  const cycleAt=performance.now();let resumed=false;
  while(actor().alive&&performance.now()-cycleAt<cycleSeconds*1000&&performance.now()-measuredAt<seconds*1000){
   if(!resumed&&performance.now()-cycleAt>cycleSeconds*350){
    await p.evaluate("window.__oldContext=window.__field.renderer.getContext();window.__oldAudio=window.__field.audio.context;document.getElementById('leave').click()");await idle(p);
    assert.equal(await p.evaluate("window.__field.scene===null && (!window.__oldAudio||window.__oldAudio.state==='closed')"),true);
    await p.evaluate("document.getElementById('resume').click()");await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
    assert.equal(await p.evaluate("window.__field.renderer.getContext()===window.__oldContext"),true);assert.equal(actor().deploymentId,deployment);resumed=true;
   }
   if(!actor().alive)break;
   await p.evaluate("document.getElementById('view').focus()");
   await key(p,index%2?'KeyD':'KeyW',true);await sleep(300);await key(p,index%2?'KeyD':'KeyW',false);
   await key(p,'ArrowRight',true);await sleep(150);await key(p,'ArrowRight',false);
   if(actor().ammo>0){await key(p,'KeyF',true);await sleep(90);await key(p,'KeyF',false)}
   await sleep(Math.min(1500,Math.max(0,seconds*1000-(performance.now()-measuredAt))));
  }
  let fixtureCutoff=false;if(actor().alive){fixtureCutoff=true;runtime.raids.atomic(()=>runtime.raids.end(raid,actor(),'timeout'))}
  await p.wait("window.__field.snapshot.self.result");const field=await sample('field');
  await p.evaluate("document.getElementById('leave').click()");await idle(p);
  await p.command('HeapProfiler.collectGarbage');const base=await sample('base-after-explicit-gc');
  assert.equal(base.fieldCleared,true);assert.equal(base.actors,0);assert.equal(base.audioActive,0);
  cycles.push({map,deploymentCount:index+1,outcome:actor().result?.outcome,fixtureCutoff,resumed,fieldSample:samples.length-2,baseSample:samples.length-1});
  assert.equal(field.contextsLost,0);assert.deepEqual(p.errors,[]);
 }
}catch(error){failure={message:error.message};}
const elapsedSeconds=measuredAt?(performance.now()-measuredAt)/1000:0,baseSamples=samples.filter(s=>s.phase==='base-after-explicit-gc'),warm=baseSamples.slice(0,3),tail=baseSamples.slice(-3),max=a=>Math.max(0,...a);
const retainedHeapGrowthBytes=baseSamples.length>3?max(tail.map(s=>s.jsHeapUsedBytes))-max(warm.map(s=>s.jsHeapUsedBytes)):null;
const report={format:1,runtimeRoot:root.href,requestedSeconds:seconds,elapsedSeconds,cycleSeconds,cycles,samples,retainedHeapGrowthBytes,checks:{completed:!failure&&elapsedSeconds>=seconds,noBrowserErrors:!page?.errors.length,allMapsCovered:cycles.length>=3?new Set(cycles.map(c=>c.map)).size===RAID_WORLDS.length:null,reentryObserved:cycles.some(c=>c.resumed),noLostContexts:samples.every(s=>s.contextsLost===0),baseCleanup:baseSamples.every(s=>s.fieldCleared&&s.actors===0&&s.audioActive===0),retainedHeapBudget:retainedHeapGrowthBytes===null?null:retainedHeapGrowthBytes<=32*1024*1024,domGrowthBudget:baseSamples.length>3?max(tail.map(s=>s.dom.nodes-s.recordNodes))-max(warm.map(s=>s.dom.nodes-s.recordNodes))<=200:null,historyBound:samples.every(s=>s.recordCount<=20),noUnexpectedApiFailures:samples.every(s=>s.otherFailures.length===0),fieldFrameP95:samples.filter(s=>s.phase==='field').every(s=>s.frameP95Ms<=35)},failure,browserErrors:page?.errors||[],scope:'One real Chrome whole client, live file-backed loopback API/simulation, native movement/look/fire, all maps, recovery deployments and repeated field/base/resume. Authority fixture cutoffs force timeout for map cycling and are not successful extractions. Retained heap is sampled after explicit GC; raw field heap is also retained. DOM growth excludes visible result-history nodes and separately enforces its 20-record cap. Frame quantiles cover the last 7200 frames. Not human, physical mobile, WAN, voice or multi-client rendering acceptance.'};
try{if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({summary:{...report.checks,elapsedSeconds,cycles:cycles.length,retainedHeapGrowthBytes,failure}}));}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();await rm(directory,{recursive:true,force:true});if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
assert.ok(Object.values(report.checks).every(v=>v===true||v===null),'Whole-client endurance missed a declared check; retain the report');
