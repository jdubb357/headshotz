import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const runtimeRoot=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',runtimeRoot));
const {createRaidServer}=await import(new URL('server/main.mjs',runtimeRoot));
const {RAID_WORLDS}=await import(new URL('shared/raid-worlds.mjs',runtimeRoot));
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const snapshots=RAID_WORLDS.map(world=>{const id=store.register('render_'+world.id,'a long benchmark password').id;return runtime.raids.deploy(id,{requestId:'render_benchmark_'+world.id,mapId:world.id,recovery:true})});
const h=await browserHarness(),results=[];
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");await p.command('Page.bringToFront');await p.command('Performance.enable');
 const browser=await p.command('Browser.getVersion');
 await p.evaluate(`(async()=>{const {RaidView}=await import('./raid-view.mjs');document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);window.__renderProbe=new RaidView(canvas);window.__renderProbe.applySettings({reduced:false,sfxVolume:0,fov:75});window.__renderSnapshots=${JSON.stringify(snapshots)}})()`);
 for(const viewport of [{name:'desktop',width:1280,height:720,deviceScaleFactor:2,mobile:false,frameBudgetMs:20,cpuBudgetMs:12},{name:'mobile-sized',width:390,height:844,deviceScaleFactor:2,mobile:true,frameBudgetMs:35,cpuBudgetMs:20}]){
  await p.command('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:viewport.deviceScaleFactor,mobile:viewport.mobile});
  for(let index=0;index<snapshots.length;index++){
   const result=await p.evaluate(`(async()=>{
    const {MACHINES}=await import('./shared/raid-enemies.mjs'),view=window.__renderProbe,state=structuredClone(window.__renderSnapshots[${index}]),self=state.self;
    state.players=Array.from({length:8},(_,i)=>({id:'render_peer_'+i,name:'Operator '+i,team:i<2?self.team:'render_rival',x:self.x+Math.sin((i-3.5)*.18)*10,y:self.y,z:self.z+8+Math.cos((i-3.5)*.18)*6,hp:100,weapon:i%2?'ar':'smg',yaw:Math.PI}));
    state.machines=Array.from({length:10},(_,i)=>{const kind=Object.keys(MACHINES)[i%5];return {id:'render_machine_'+i,kind,x:self.x+Math.sin((i-4.5)*.16)*15,y:(self.y||0)+(kind==='flyer'?4:0),z:self.z+17+Math.cos((i-4.5)*.16)*8,hp:MACHINES[kind].hp,state:i%3?'patrol':'windup',yaw:Math.PI}});
    view.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));view.renderer.info.autoReset=false;const startCpu=performance.now();view.start(state);view.frame(performance.now(),0,0,self);const coldStartCpuMs=performance.now()-startCpu;
    const intervals=[],cpu=[],drawCalls=[],triangles=[],resourceSamples=[];let first,last;const warmupMs=1000,sampleMs=8000;
    await new Promise(resolve=>{const step=time=>{first??=time;const elapsed=time-first;view.renderer.info.reset();const at=performance.now();view.frame(time,Math.sin(elapsed/3500)*.45,-.025,self,Math.floor(elapsed/2000)%2===1);const spent=performance.now()-at;
     if(elapsed>=warmupMs){if(last!=null)intervals.push(time-last);cpu.push(spent);drawCalls.push(view.renderer.info.render.calls);triangles.push(view.renderer.info.render.triangles);if(resourceSamples.length<2||cpu.length%120===0)resourceSamples.push({...view.renderer.info.memory})}last=time;
     if(elapsed<warmupMs+sampleMs)requestAnimationFrame(step);else resolve()};requestAnimationFrame(step)});
    const quantiles=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,p50:sorted[Math.floor(sorted.length*.5)]||0,p95:sorted[Math.floor(sorted.length*.95)]||0,max:sorted.at(-1)||0}},context=view.renderer.getContext(),extension=context.getExtension('WEBGL_debug_renderer_info');
    return {map:state.map,coldStartCpuMs,frameIntervalMs:quantiles(intervals),renderCpuMs:quantiles(cpu),drawCalls:quantiles(drawCalls),triangles:quantiles(triangles),resources:{...view.renderer.info.memory},resourceSamples,renderer:extension?context.getParameter(extension.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER),pixelRatio:view.renderer.getPixelRatio(),canvas:{width:view.canvas.width,height:view.canvas.height},actors:view.actors.size};
   })()`);
   const metrics=await p.command('Performance.getMetrics');result.jsHeapUsedBytes=metrics.metrics.find(m=>m.name==='JSHeapUsedSize')?.value;
   result.viewport=viewport;result.targets={drawingBufferMatchesRequestedDensity:result.pixelRatio===1.5&&result.canvas.width===Math.round(viewport.width*1.5)&&result.canvas.height===Math.round(viewport.height*1.5),enoughFrames:result.frameIntervalMs.count>=180,frameP95WithinBudget:result.frameIntervalMs.p95<=viewport.frameBudgetMs,renderCpuP95WithinBudget:result.renderCpuMs.p95<=viewport.cpuBudgetMs};results.push(result);console.log(JSON.stringify({progress:result}));
  }
 }
 const report={format:1,runtimeRoot:runtimeRoot.href,browser,results,checks:{allTargets:results.every(r=>Object.values(r.targets).every(Boolean)),noBrowserErrors:p.errors.length===0},browserErrors:p.errors,scope:'Renderer-only fixed snapshots: three real authored maps, nine operators including self, ten machine models, animated camera/aim, 1s warmup and 8s sample. Headless Chrome on the current workstation with a concurrent 27-client server soak. Not physical mobile hardware, whole-client input/network performance or human acceptance.'};
 if(process.env.RAID_RENDER_REPORT)await writeFile(process.env.RAID_RENDER_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({summary:report.checks}));assert.equal(report.checks.noBrowserErrors,true);assert.equal(report.checks.allTargets,true,'rendering missed a declared development target; retain and investigate the report');
 await p.evaluate("(async()=>{const {disposeOwned}=await import('./raid-models.mjs');disposeOwned(window.__renderProbe.scene);disposeOwned(window.__renderProbe.overlay);window.__renderProbe.renderer.dispose();await window.__renderProbe.audio.context?.close()})()");
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
