import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const runtimeRoot=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',runtimeRoot));
const {createRaidServer}=await import(new URL('server/main.mjs',runtimeRoot));
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('render_resource_probe','a long render probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'render_resource_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1024,height:576,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs'),{disposeOwned,humanModel,characterGeometryStats}=await import('./raid-models.mjs'),{makeCharacter}=await import('./chars.js');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false}),buffers=new Set(),createBuffer=gl.createBuffer.bind(gl),deleteBuffer=gl.deleteBuffer.bind(gl);gl.createBuffer=()=>{const buffer=createBuffer();buffers.add(buffer);return buffer};gl.deleteBuffer=buffer=>{buffers.delete(buffer);return deleteBuffer(buffer)};
  const base=${JSON.stringify(snapshot)};Object.assign(base,{players:[],machines:[],caches:[],bags:[],exits:[],telegraphs:[],hazards:[],utilities:[]});
  const view=new RaidView(canvas);view.start(base);view.applySettings({reduced:true,sfxVolume:0,fov:75});
  const render=()=>view.frame(performance.now(),0,0,base.self);render();const baseline={...view.renderer.info.memory},samples=[],churnCpuMs=[];
  for(let i=0;i<40;i++){
   const started=performance.now();
   view.sync({...base,players:[{id:'render_subject_'+i,name:'Operator '+i,team:base.self.team,x:base.self.x,y:base.self.y,z:base.self.z+8,yaw:Math.PI,hp:100,weapon:'ar'}]});render();
   view.sync(base);render();samples.push({...view.renderer.info.memory});churnCpuMs.push(performance.now()-started);
  }
  const bodyGeometry=root=>{let geometry;root.traverse(node=>{if(!geometry&&node.isMesh)geometry=node.geometry});return geometry};
  const ordinary=makeCharacter(0x5e9cb2,'Ordinary','shared_render_subject',0x8ce6ff,null,'soldier'),ordinaryGeometry=bodyGeometry(ordinary);let ordinaryDisposals=0,raidDisposals=0;ordinaryGeometry.addEventListener('dispose',()=>ordinaryDisposals++);
  const first=humanModel('First','shared_render_subject',true),second=humanModel('Second','shared_render_subject',true),raidGeometry=bodyGeometry(first);raidGeometry.addEventListener('dispose',()=>raidDisposals++);
  const sharedBetweenLiveActors=raidGeometry===bodyGeometry(second),ordinaryIsSeparate=raidGeometry!==ordinaryGeometry;
  for(const actor of [first,second]){actor.position.set(base.self.x,base.self.y,base.self.z+8);view.scene.add(actor)}render();
  view.scene.remove(first);disposeOwned(first);render();const firstRemovalKeptPeerGeometry=raidDisposals===0;
  view.scene.remove(second);disposeOwned(second);render();const lastRemovalDisposed=raidDisposals===1;
  const returned=humanModel('Returned','shared_render_subject',true),recentAppearanceReused=bodyGeometry(returned)===raidGeometry;disposeOwned(returned);const characterCache=characterGeometryStats();
  const ordinaryAgain=makeCharacter(0x5e9cb2,'Ordinary again','shared_render_subject',0x8ce6ff,null,'soldier'),ordinaryCacheUnaffected=ordinaryDisposals===0&&bodyGeometry(ordinaryAgain)===ordinaryGeometry;
  const after={...view.renderer.info.memory},context=view.renderer.getContext(),extension=context.getExtension('WEBGL_debug_renderer_info');
  const renderer=extension?context.getParameter(extension.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER);
  const buffersAfterClear=[];for(let i=0;i<4;i++){view.clear();buffersAfterClear.push(buffers.size);view.start(base);render()}view.clear();view.renderer.dispose();await view.audio.context?.close();
  churnCpuMs.sort((a,b)=>a-b);return {runtimeRoot:${JSON.stringify(runtimeRoot.href)},baseline,after,samples,renderer,buffersAfterClear,churnCpuMs:{p50:churnCpuMs[20],p95:churnCpuMs[38],max:churnCpuMs.at(-1)},characterCache,recentAppearanceReused,sharedBetweenLiveActors,ordinaryIsSeparate,firstRemovalKeptPeerGeometry,lastRemovalDisposed,ordinaryCacheUnaffected,scope:'40 distinct procedural operators enter/leave one rendered field view, shared live appearance ownership, bounded CPU reuse, ordinary-cache isolation and explicit WebGL buffer deletion across four world clears. Fixed snapshot/positions; no human or physical-device acceptance.'};
 })()`);
 console.log(JSON.stringify(result));assert.ok(result.after.geometries<=result.baseline.geometries+4,'removed operators must release their GPU geometry');assert.ok(result.after.textures<=result.baseline.textures,'removed operator tags must release their GPU textures');assert.ok(result.buffersAfterClear.every(n=>n===result.buffersAfterClear[0]),'clearing and rebuilding worlds must not retain additional GPU buffers');assert.ok(result.characterCache.idle<=result.characterCache.idleLimit);assert.ok(result.characterCache.cached<=result.characterCache.active+result.characterCache.idle);for(const name of ['recentAppearanceReused','sharedBetweenLiveActors','ordinaryIsSeparate','firstRemovalKeptPeerGeometry','lastRemovalDisposed','ordinaryCacheUnaffected'])assert.equal(result[name],true,name);assert.deepEqual(p.errors,[]);
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
