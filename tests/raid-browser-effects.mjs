// Combat effects grader: exercises the pooled muzzle/tracer/impact burst, the
// frag detonation blast, animated smoke, reduced-motion rendering, and bounded
// resource ownership through repeated fire and disposal.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const priorUrl=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const screenshot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in') && document.getElementById('register').onclick!==null && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate(`document.querySelector('[name=username]').value='effects_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long combat effects password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("import('./raid-view.mjs').then(({RaidView})=>{const start=RaidView.prototype.start;RaidView.prototype.start=function(...args){const result=start.apply(this,args);window.__fxView=this;return result}})");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("const m=document.getElementById('map');m.value='relay';m.dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && window.__fxView?.snapshot && document.body.getAttribute('aria-busy')==='false'");
 await p.wait("window.__fxView.selfActor && window.__fxView.shotEffects.length===16 && window.__fxView.blastEffects.length===6");
 // Fire one consciously downward shot in a synchronous task so the animation
 // loop cannot overwrite the wheel-controlled aim between setup and fire.
 const fired=await p.evaluate(`(()=>{const v=window.__fxView,s=v.snapshot.self;
  v.viewMode='first';v.fireYaw=0;v.firePitch=-.12;v.fireOrigin.set(s.x,(s.y||0)+1.55,s.z);
  const cueLog=[],priorPlay=v.audio.play;v.audio.play=(kind,spatial)=>{cueLog.push([kind,spatial?.gain??null,spatial?.pan??null]);return false};v.fire();v.audio.play=priorPlay;
  const e=v.shotEffects.find(slot=>slot.started!==null);const now=performance.now();v.updateCombatEffects(now+30);
  const l=v.shotMuzzleLight,lightEarly=l?{type:l.type,visible:l.visible,intensity:l.intensity,color:l.color.getHex(),distance:l.distance,decay:l.decay,uuid:l.uuid,parentScene:l.parent===v.scene,position:l.position.toArray()}:null;
  const poolLightCount=v.scene.children.filter(o=>o.isPointLight&&o.userData.raidCombatLight).length;
  const muzzleScale=e.muzzle.scale.x;
  const styles=['concrete','metal','brick','planks','rock','dirt','forest','gravel','container','crate','hazard'].map(kind=>v.impactStyle(kind));
  const blocks=(v.world?.blocks||[]).filter(b=>b[6]&&['metal','brick','planks','container','crate','hazard','rock'].includes(b[6]));
  const resolved=blocks.length?blocks.slice(0,Math.min(6,blocks.length)).map(b=>v.shotSurface(b[0],(b[5]||0)+.2,b[1],false)===b[6]):[true];
  const early={muzzle:e.muzzle.visible,tracer:e.tracer.visible,sparks:e.sparks.visible,dust:e.dust.visible,trail:e.trailRoot.visible,debris:e.debris.visible};
  const dustEarly=e.dust.scale.x,debrisOpacityEarly=e.debris.material.opacity,chipsEarly=Array.from(e.debris.geometry.attributes.position.array.slice(0,6));
  v.updateCombatEffects(performance.now()+150);
  const lightLate=l?{visible:l.visible,intensity:l.intensity,uuid:l.uuid}:null;
  return {pool:v.shotEffects.length,blasts:v.blastEffects.length,lightEarly,poolLightCount,muzzleScale,muzzleScaleLate:e.muzzle.scale.x,lightLate,muzzleVisible:early.muzzle,tracerVisible:early.tracer,sparksVisible:early.sparks,dustVisible:early.dust,trailVisible:early.trail,debrisVisible:early.debris,debrisCount:e.chipCount,debrisColor:e.debrisMaterial.color.getHex(),debrisOpacityEarly,debrisOpacityLate:e.debris.material.opacity,chipsEarly,chipsLate:Array.from(e.debris.geometry.attributes.position.array.slice(0,6)),cueLog,trailSprites:e.trailSprites.length,sparkCount:e.sparkCount,surface:e.surface,dustColor:e.dustMaterial.color.getHex(),sparkColor:e.sparks.material.color.getHex(),dustEarly,dustLate:e.dust.scale.x,dustOpacity:e.dust.material.opacity,styles,resolved,origin:e.origin.toArray(),endpoint:e.end.toArray(),tracerPoints:e.tracer.geometry.attributes.position.count,started:e.started};})()`);
 assert.equal(fired.pool,16,'shots use a fixed pool');
 assert.equal(fired.blasts,6,'blasts use a fixed pool');
 assert.ok(fired.lightEarly,'accepted shots expose a pooled world muzzle light');
 assert.equal(fired.poolLightCount,1,'local shots reuse exactly one pooled world light');
 assert.equal(fired.lightEarly.type,'PointLight','the muzzle light is a real point light');
 assert.equal(fired.lightEarly.visible,true,'the muzzle light is live immediately after the shot');
 assert.ok(fired.lightEarly.intensity>1&&fired.lightEarly.intensity<=5.5,'the muzzle light starts at a bounded intensity');
 assert.ok((fired.lightEarly.color>>16&255)>(fired.lightEarly.color>>8&255)&&(fired.lightEarly.color>>8&255)>=(fired.lightEarly.color&255)&&(fired.lightEarly.color&255)<180,'the muzzle light is warm, not a red hazard lamp');
 assert.ok(fired.lightEarly.distance>0&&fired.lightEarly.distance<=8&&fired.lightEarly.decay===2,'the muzzle light uses bounded physical falloff');
 assert.equal(fired.lightEarly.parentScene,true,'the pooled light belongs to the raid scene');
 assert.deepEqual(fired.lightEarly.position,fired.origin,'the light snaps to the authoritative shot muzzle');
 assert.ok(fired.muzzleScale>=.04&&fired.muzzleScale<=.11,'the additive muzzle billboard stays screen-bounded');
 assert.ok(fired.muzzleScaleLate>=.04&&fired.muzzleScaleLate<=.11,'the muzzle billboard remains bounded as the flash fades');
 assert.equal(fired.lightLate.visible,false,'the muzzle light shuts off within the 120 ms flash');
 assert.equal(fired.lightLate.intensity,0,'the expired muzzle light emits no intensity');
 assert.equal(fired.lightLate.uuid,fired.lightEarly.uuid,'the muzzle light object is reused in place');
 assert.equal(fired.muzzleVisible,true,'accepted shots expose a muzzle glow');
 assert.equal(fired.tracerVisible,true,'accepted shots expose a fading tracer');
 assert.equal(fired.trailVisible,true,'accepted shots expose a soft tracer bloom');
 assert.equal(fired.trailSprites,8,'the tracer bloom uses its fixed sprite chain');
 assert.equal(fired.sparksVisible,true,'accepted shots expose an impact spark burst');
 assert.equal(fired.dustVisible,true,'accepted shots expose a surface dust plume');
 assert.ok(fired.dustLate>fired.dustEarly,'the dust plume expands away from the impact');
 assert.ok(fired.dustOpacity>0&&fired.dustOpacity<.5,'the dust plume fades over its short lifetime');
 assert.equal(fired.debrisVisible,true,'accepted shots expose a kinetic debris burst');
 assert.ok(fired.debrisCount>=6,'the debris burst carries several fragments');
 assert.notEqual(fired.debrisColor,fired.dustColor,'debris is shaded darker than the soft dust plume');
 assert.notDeepEqual(fired.chipsEarly,fired.chipsLate,'debris fragments move after the impact');
 assert.ok(fired.debrisOpacityLate>0&&fired.debrisOpacityLate<fired.debrisOpacityEarly,'debris fades within the shot lifetime');
 const impactCue=fired.cueLog.find(([kind])=>kind==='impact:'+fired.surface);
 assert.ok(impactCue,'the hit plays the resolved surface impact cue');
 assert.ok(impactCue[1]>0&&impactCue[1]<=1&&Number.isFinite(impactCue[2]),'the impact cue is spatialised from the listener');
 assert.ok(['concrete','gravel','dirt','forest','foliage','brick','planks','metal','rock','container','crate','hazard','tiles','asphalt'].includes(fired.surface),'the shot resolves a known surface');
 assert.deepEqual(fired.resolved,new Array(fired.resolved.length).fill(true),'shotSurface resolves authoritative block materials');
 const distinctStyling=new Set(fired.styles.map(pair=>pair.join(','))).size;
 assert.ok(distinctStyling>=8,'the impact palette distinguishes the block and terrain families');
 const cueMap=await p.evaluate(`import('./raid-audio.mjs').then(m=>{const expected=['metal','planks','brick','rock','forest','foliage','dirt','gravel','container','crate'];const map=m.IMPACT_CUES;return {keys:expected.every(k=>map[k]&&map[k].wave&&map[k].start&&map[k].end&&map[k].duration),distinct:new Set(expected.map(k=>JSON.stringify(map[k]))).size}})`);
 assert.equal(cueMap.keys,true,'the material impact palette covers metal, wood, brick, rock, foliage, soil and containers');
 assert.ok(cueMap.distinct>=10,'every material family maps to its own waveform and envelope');
 assert.ok(fired.sparkCount>=8,'impact bursts carry a particle set');
 assert.equal(fired.tracerPoints,2,'the tracer is one short line segment');
 assert.ok(Math.hypot(fired.endpoint[0]-fired.origin[0],fired.endpoint[1]-fired.origin[1],fired.endpoint[2]-fired.origin[2])<20,'the tracer terminates on terrain instead of running to the 72 m cap');
 assert.ok(fired.endpoint[1]<fired.origin[1]+1,'the downward tracer ends below eye height');
 // The live game clears a 260 ms shot before a headless capture can serialise
 // the surface, so render one held frame of the same production effect pool on
 // an isolated evidence canvas for inspection. Lifetime and collision are
 // asserted above against the live raid view; this frame shows the authored look.
 await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const canvas=document.createElement('canvas');canvas.id='fxEvidence';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
  document.body.append(canvas);
  const fresh=new mod.RaidView(canvas);fresh.start(snapshot);fresh.settings={...window.__fxView.settings};fresh.viewMode='third';
  fresh.fireOrigin.set(snapshot.self.x,(snapshot.self.y||0)+1.55,snapshot.self.z);fresh.fireYaw=1.05;fresh.firePitch=-.18;fresh.fire();
  fresh.updateCombatEffects(performance.now()+60);
  fresh.frame(performance.now()+60,0,-.18,null,false);
  const impact=fresh.shotEffects.find(slot=>slot.started!==null)?.end;
  if(impact){fresh.camera.position.set(impact.x+2.6,Math.max(1.2,impact.y+1.5),impact.z-2.9);fresh.camera.lookAt(impact.x,impact.y,impact.z);fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera)}
  window.__fxEvidence=fresh;window.__fxView=live;return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-shot.png');
 await p.evaluate("[window.__fxEvidence.canvas,window.__fxEvidence].forEach((o,i)=>{if(i===1){o.clear();o.renderer.dispose()}else o.remove()});delete window.__fxEvidence");
 // Muzzle evidence frame: hold the flash at 30 ms from a close side camera so
 // the compact additive bloom and the warm pooled light on nearby ground are
 // inspectable together without the old full-screen billboard wash.
 await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const canvas=document.createElement('canvas');canvas.id='fxMuzzle';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
  document.body.append(canvas);
  const fresh=new mod.RaidView(canvas);fresh.start(snapshot);fresh.settings={...live.settings};fresh.viewMode='third';
  fresh.fireOrigin.set(snapshot.self.x,(snapshot.self.y||0)+1.55,snapshot.self.z);fresh.fireYaw=1.05;fresh.firePitch=-.18;fresh.fire();
  const held=fresh.shotEffects.find(slot=>slot.started!==null),now=performance.now();fresh.updateCombatEffects(now+30);
  if(held){const o=held.origin,freshCamera=fresh.camera;held.tracer.visible=false;held.trailRoot.visible=false;held.sparks.visible=false;held.dust.visible=false;held.debris.visible=false;if(fresh.selfActor)fresh.selfActor.visible=false;
   // Stand on the unobstructed shot corridor just ahead of the muzzle, elevated
   // enough to see the ground the pooled light is warming.
   freshCamera.position.set(o.x+held.dir.x*2,o.y-held.dir.y*2+1.8,o.z+held.dir.z*2);
   freshCamera.lookAt(o.x,o.y-.35,o.z);freshCamera.updateProjectionMatrix();
   fresh.renderer.clear();fresh.renderer.render(fresh.scene,freshCamera)}
  window.__fxMuzzle=fresh;window.__fxMuzzleLight=held?{visible:fresh.shotMuzzleLight.visible,intensity:fresh.shotMuzzleLight.intensity,origin:held.origin.toArray(),muzzleScale:held.muzzle.scale.x}:null;window.__fxView=live;return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-muzzle.png');
 await p.evaluate("[window.__fxMuzzle.canvas,window.__fxMuzzle].forEach((o,i)=>{if(i===1){o.clear();o.renderer.dispose()}else o.remove()});delete window.__fxMuzzle;delete window.__fxMuzzleLight");
 // A second held frame shows three simultaneous production impacts so the
 // surface-specific spark/dust hues can be compared side by side.
 await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const canvas=document.createElement('canvas');canvas.id='fxCluster';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
  document.body.append(canvas);
  const fresh=new mod.RaidView(canvas);fresh.start(snapshot);fresh.settings={...live.settings};fresh.viewMode='third';
  for(let i=0;i<3;i++){fresh.fireOrigin.set(snapshot.self.x+i*.8,(snapshot.self.y||0)+1.55,snapshot.self.z-i*.6);fresh.fireYaw=1.05+i*.5;fresh.firePitch=-.16-.04*i;fresh.fire()}
  fresh.updateCombatEffects(performance.now()+55);
  fresh.frame(performance.now()+55,0,-.18,null,false);
  const active=fresh.shotEffects.filter(slot=>slot.started!==null),focus={x:0,y:0,z:0};
  for(const shot of active){focus.x+=shot.end.x;focus.y+=shot.end.y;focus.z+=shot.end.z}
  if(active.length){focus.x/=active.length;focus.y/=active.length;focus.z/=active.length;fresh.camera.position.set(focus.x+5.2,Math.max(1.2,focus.y+2.1),focus.z-5.5);fresh.camera.lookAt(focus.x,focus.y,focus.z);fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera)}
  window.__fxCluster=fresh;window.__fxView=live;return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-cluster.png');
 await p.evaluate("[window.__fxCluster.canvas,window.__fxCluster].forEach((o,i)=>{if(i===1){o.clear();o.renderer.dispose()}else o.remove()});delete window.__fxCluster");
 const cleared=await p.evaluate(`(async()=>{const v=window.__fxView;await new Promise(r=>setTimeout(r,380));v.updateCombatEffects(performance.now());return v.shotEffects.every(e=>e.started===null&&!e.muzzle.visible&&!e.tracer.visible&&!e.sparks.visible&&!e.dust.visible&&!e.debris.visible)})()`);
 assert.equal(cleared,true,'shot effects clear within 350 ms plus one frame');
 // Drive the authored utility transitions: inert frag first, then detonated.
 const blast=await p.evaluate(`(()=>{const v=window.__fxView,s=v.snapshot.self,base={serverTime:999999,utilities:[{id:'fx-frag',kind:'frag',x:s.x+4,y:0,z:s.z+4,radius:3,activeAt:0,detonated:false}]};
  v.blastEffects.forEach(e=>{e.started=null;e.scorchStarted=null;e.ring.visible=e.flash.visible=e.embers.visible=e.scorch.visible=false;e.light.visible=false;e.light.intensity=0});
  v.syncUtilities(base);const before=v.blastEffects.filter(e=>e.started!==null).length;
  base.utilities[0].detonated=true;v.syncUtilities(base);
  const first=v.blastEffects.find(e=>e.started!==null),now=performance.now();v.updateCombatEffects(now+40);
  const chunksEarly=Array.from(first.chunks.geometry.attributes.position.array.slice(0,6)),chunkVisible=first.chunks.visible,chunkOpacity=first.chunks.material.opacity;
  const ringVisible=first.ring.visible,flashVisible=first.flash.visible,embersVisible=first.embers.visible;
  const lightVisible=first.light.visible,lightIntensityEarly=first.light.intensity,lightColor=first.light.color.getHex(),lightDistance=first.light.distance,lightDecay=first.light.decay,lightPosition=first.light.position.toArray();
  v.updateCombatEffects(now+150);const chunksLate=Array.from(first.chunks.geometry.attributes.position.array.slice(0,6));
  const lightIntensityLate=first.light.intensity,lightVisibleLate=first.light.visible,lightPositionLate=first.light.position.toArray();
  v.updateCombatEffects(now+220);const lightExpired=!first.light.visible&&first.light.intensity===0;
  return {before,after:v.blastEffects.filter(e=>e.started!==null).length,ringVisible,flashVisible,embersVisible,emberCount:first.emberCount,plumeVisible:first.plume.visible,plumeCount:first.plumeCount,plumeOpacity:first.plume.material.opacity,plumeScale:first.plume.material.size,plumeMapped:!!first.plume.material.map,plumeAdditive:first.plume.material.blending===2,chunkVisible,chunkCount:first.chunkCount,chunkOpacity,chunkMapped:!!first.chunks.material.map,chunkAdditive:first.chunks.material.blending===2,chunksEarly,chunksLate,lightVisible,lightVisibleLate,lightIntensityEarly,lightIntensityLate,lightExpired,lightColor,lightDistance,lightDecay,lightPosition,lightPositionLate,blastOrigin:first.origin.toArray(),ringScale:first.ring.scale.x,radius:first.radius,ringColor:first.ring.material.color.getHex(),ringAdditive:first.ring.material.blending===2,scorchVisible:first.scorch.visible,scorchScale:first.scorch.scale.x,scorchOpacity:first.scorch.material.opacity,scorchAdditive:first.scorch.material.blending===2,metadata:first.ring.userData.raidOwned===true||first.ring.geometry.userData.raidOwned===true};})()`);
 assert.equal(blast.before,0,'an inert frag does not detonate');
 assert.equal(blast.after,1,'the detonated transition spawns one pooled blast');
 assert.equal(blast.ringVisible,true,'the shock ring renders');
 assert.equal(blast.flashVisible,true,'the detonation flash renders');
 assert.equal(blast.embersVisible,true,'the blast emits upward embers');
 assert.ok(blast.emberCount>=12,'the blast ember layer carries particles');
 assert.equal(blast.plumeVisible,true,'the detonation emits a powder-smoke plume');
 assert.ok(blast.plumeCount>=12,'the plume layer carries a bounded particle set');
 assert.ok(blast.plumeOpacity>0&&blast.plumeOpacity<1,'the plume reads as soft matte smoke');
 assert.equal(blast.plumeMapped,true,'the plume samples the authored smoke canvas');
 assert.equal(blast.plumeAdditive,false,'powder smoke uses normal blending, not additive glow');
 assert.ok(blast.plumeScale>0,'the plume particle footprint expands from the core');
 assert.equal(blast.chunkVisible,true,'the detonation throws a debris chunk burst');
 assert.ok(blast.chunkCount>=10,'the chunk burst carries a bounded particle set');
 assert.ok(blast.chunkOpacity>0&&blast.chunkOpacity<1,'matte chunks fade over the blast lifetime');
 assert.equal(blast.chunkMapped,true,'the chunk burst samples the authored chip canvas');
 assert.equal(blast.chunkAdditive,false,'debris chunks use matte normal blending');
 assert.notDeepEqual(blast.chunksEarly,blast.chunksLate,'the chunk burst moves under gravity after detonation');
 assert.ok(blast.chunksLate.every(Number.isFinite),'chunk positions stay finite through the arc');
 assert.ok(blast.chunksLate[1]>-0.05,'the chunk field settles near the ground instead of falling through it');
 assert.equal(blast.lightVisible,true,'the detonation lights nearby geometry');
 assert.ok(blast.lightIntensityEarly>0,'the flash light starts at a visible intensity');
 assert.ok(blast.lightIntensityLate>0&&blast.lightIntensityLate<blast.lightIntensityEarly,'the flash light decays with the flare');
 assert.equal(blast.lightVisibleLate,true,'the light is still live while the flare burns');
 assert.equal(blast.lightExpired,true,'the light shuts off when the flare ends');
 assert.ok((blast.lightColor>>16&255)>(blast.lightColor>>8&255)&&(blast.lightColor>>8&255)>=(blast.lightColor&255)&&(blast.lightColor&255)<120,'the detonation light is a warm orange hue');
 assert.ok(blast.lightDistance>0&&blast.lightDecay===2,'the light uses bounded physical distance falloff');
 assert.equal(blast.lightPosition[0],blast.blastOrigin[0],'the light anchors to the authoritative blast X');
 assert.equal(blast.lightPosition[2],blast.blastOrigin[2],'the light anchors to the authoritative blast Z');
 assert.equal(blast.lightPosition[1],blast.blastOrigin[1]+1.15,'the light floats above the detonation origin');
 assert.ok(blast.ringScale>blast.radius*.15,'the shock ring expands');
 assert.notEqual(blast.ringColor,0xff3d32,'blast rings differ from hazard telegraph colour');
 assert.equal(blast.ringAdditive,true,'the blast ring uses additive energy blending');
 assert.equal(blast.scorchVisible,true,'the detonation leaves a ground scorch decal');
 assert.ok(blast.scorchScale>0&&blast.scorchOpacity>0,'the scorch decal is visible at the blast origin');
 assert.equal(blast.scorchAdditive,false,'the scorch uses matte soot blending');
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-blast.png');
 // Chunk-focused evidence frame: hold the burst at mid-arc with a close camera
 // so the matte chip fragments are inspectable alongside the receding plume.
 await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const canvas=document.createElement('canvas');canvas.id='fxChunks';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
  document.body.append(canvas);
  const fresh=new mod.RaidView(canvas);fresh.start(snapshot);fresh.settings={...live.settings};
  const s=snapshot.self,x=s.x+2,y=0,z=s.z+2;
  fresh.spawnBlast(x,y,z,3);fresh.updateCombatEffects(performance.now()+320);
  fresh.camera.position.set(x+4.4,Math.max(1.7,y+2.5),z-4.8);fresh.camera.lookAt(x,y+.5,z);
  fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera);
  window.__fxChunks=fresh;window.__fxView=live;return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-chunks.png');
 await p.evaluate("[window.__fxChunks.canvas,window.__fxChunks].forEach((o,i)=>{if(i===1){o.clear();o.renderer.dispose()}else o.remove()});delete window.__fxChunks");
 // Detonation light evidence frame: hold the first 70 ms of the flare so the
 // warm point-light wash on nearby ground and cover is inspectable.
 await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const canvas=document.createElement('canvas');canvas.id='fxLight';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#000';
  document.body.append(canvas);
  const fresh=new mod.RaidView(canvas);fresh.start(snapshot);fresh.settings={...live.settings};
  const s=snapshot.self,x=s.x+2,y=0,z=s.z+2;
  fresh.spawnBlast(x,y,z,3);fresh.updateCombatEffects(performance.now()+70);
  const held=fresh.blastEffects.find(e=>e.started!==null);
  if(held){held.plume.visible=false;held.chunks.visible=false;held.embers.visible=false;held.flash.visible=false}
  fresh.camera.position.set(x+4.4,Math.max(1.7,y+2.5),z-4.8);fresh.camera.lookAt(x,y+.5,z);
  fresh.renderer.clear();fresh.renderer.render(fresh.scene,fresh.camera);
  window.__fxLight=fresh;window.__fxView=live;return true})()`);
 await new Promise(r=>setTimeout(r,30));
 await screenshot(p,'/tmp/hs-fx-light.png');
 await p.evaluate("[window.__fxLight.canvas,window.__fxLight].forEach((o,i)=>{if(i===1){o.clear();o.renderer.dispose()}else o.remove()});delete window.__fxLight");
 // The scorch decal must outlive the 900 ms flash/ring explosion and settle to
 // a static readable mark when reduced motion is active.
 const scorch=await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs'),live=window.__fxView;
  const snapshot=JSON.parse(JSON.stringify(live.snapshot));snapshot.camera=null;
  const fresh=new mod.RaidView(document.createElement('canvas'));fresh.start(snapshot);fresh.settings={...live.settings};
  fresh.spawnBlast(snapshot.self.x,0,snapshot.self.z,3);
  const effect=fresh.blastEffects.find(e=>e.scorchStarted!==null),now=performance.now();
  fresh.updateCombatEffects(now+60);const early={visible:effect.scorch.visible,scale:effect.scorch.scale.x,opacity:effect.scorch.material.opacity};
  fresh.updateCombatEffects(now+960);const persisted=effect.scorch.visible&&effect.scorchStarted!==null&&effect.scorch.material.opacity>0;
  fresh.updateCombatEffects(now+1900);const expired=!effect.scorch.visible&&effect.scorchStarted===null;
  fresh.applySettings({...fresh.settings,reduced:true});fresh.spawnBlast(snapshot.self.x,0,snapshot.self.z,3);
  const quiet=fresh.blastEffects.find(e=>e.scorchStarted!==null),quietNow=performance.now();fresh.updateCombatEffects(quietNow+40);const firstScale=quiet.scorch.scale.x;
  fresh.updateCombatEffects(quietNow+600);const staticScale=quiet.scorch.scale.x,readable=quiet.scorch.visible&&quiet.scorch.material.opacity>0;
  window.__fxView=live;fresh.clear();fresh.renderer.dispose();
  return {early,persisted,expired,static:firstScale===staticScale,readable};})()`);
 assert.equal(scorch.early.visible,true,'the scorch decal appears after detonation');
 assert.ok(scorch.early.scale>0&&scorch.early.opacity>0,'the scorch decal is opaque enough to read');
 assert.equal(scorch.persisted,true,'the scorch outlives the 900 ms blast flash');
 assert.equal(scorch.expired,true,'the scorch clears after its 1.8 s lifetime');
 assert.equal(scorch.static,true,'reduced motion leaves a static scorch signature');
 assert.equal(scorch.readable,true,'the reduced-motion scorch remains readable');
 // Smoke expands from its deployment seed and shimmers without losing the
 // authoritative parent radius.
 const smoke=await p.evaluate(`(()=>{const v=window.__fxView,s=v.snapshot.self,base={serverTime:999999,utilities:[{id:'fx-smoke',kind:'smoke',x:s.x+8,y:0,z:s.z+8,radius:2.6,activeAt:0}]};
  v.syncUtilities(base);const mesh=v.utilityEffects.get('fx-smoke'),initial=mesh.scale.x,t0=performance.now();
  v.updateCombatEffects(t0+10);v.updateCombatEffects(t0+210);
  const puff=mesh.children[2];return {kind:mesh.userData.kind,initial,scale:mesh.scale.x,radius:mesh.userData.radius,puffs:mesh.children.length,shimmer:Math.abs(puff.position.y-puff.userData.baseY)>0||Math.abs(puff.position.x-puff.userData.baseX)>0,opacity:puff.material.opacity};})()`);
 assert.equal(smoke.kind,'smoke');
 assert.equal(smoke.puffs,9,'smoke keeps its layered puffs');
 assert.equal(smoke.radius,2.6,'the authoritative radius is preserved');
 assert.ok(smoke.scale>smoke.initial&&smoke.scale<=2.6,'smoke expands toward its authoritative radius: '+JSON.stringify(smoke));
 assert.equal(smoke.shimmer,true,'smoke puffs shimmer around their authored offsets');
 assert.ok(smoke.opacity>0&&smoke.opacity<.8,'smoke stays softly translucent');
 await screenshot(p,'/tmp/hs-fx-smoke.png');
 // Reduced motion keeps a readable static blast indication and suppresses
 // muzzle/tracer flashing.
 const reduced=await p.evaluate(`(()=>{const v=window.__fxView,normal=v.settings;
  v.applySettings({...normal,reduced:true});v.blastEffects.forEach(e=>{e.started=null});v.spawnBlast(v.snapshot.self.x,0,v.snapshot.self.z,3);v.updateCombatEffects(performance.now()+40);
  const b=v.blastEffects.find(e=>e.started!==null);
  const plumeStart=Array.from(b.plume.geometry.attributes.position.array.slice(0,6)),plumeSize=b.plume.material.size,plumeOpacity=b.plume.material.opacity;
  const chunkVisible=b.chunks.visible,chunkOpacity=b.chunks.material.opacity,chunkStart=Array.from(b.chunks.geometry.attributes.position.array.slice(0,6));
  const blastLight=b.light.visible,blastLightIntensity=b.light.intensity;
  v.updateCombatEffects(performance.now()+500);
  const plumeStable=JSON.stringify(plumeStart)===JSON.stringify(Array.from(b.plume.geometry.attributes.position.array.slice(0,6)))&&plumeSize===b.plume.material.size&&plumeOpacity===b.plume.material.opacity;
  const chunkStable=JSON.stringify(chunkStart)===JSON.stringify(Array.from(b.chunks.geometry.attributes.position.array.slice(0,6)));
  v.fire();v.updateCombatEffects(performance.now()+30);const s=v.shotEffects.find(e=>e.started!==null),worldLight=v.shotMuzzleLight;
  v.applySettings(normal);
  return {worldLight:worldLight?{visible:worldLight.visible,intensity:worldLight.intensity}:null,blastRing:b.ring.visible,blastFlash:b.flash.visible,blastOpacity:b.ring.material.opacity,blastPlume:b.plume.visible,plumeCount:b.plumeCount,plumeStable,chunkVisible,chunkOpacity,chunkStable,blastLight,blastLightIntensity,muzzle:s.muzzle.visible,tracer:s.tracer.visible,sparks:s.sparks.visible,dust:s.dust.visible,debris:s.debris.visible,sparkOpacity:s.sparks.material.opacity};})()`);
 assert.equal(reduced.blastRing,true,'reduced motion keeps a static detonation ring');
 assert.equal(reduced.blastFlash,false,'reduced motion suppresses the detonation flash');
 assert.equal(reduced.blastPlume,true,'reduced motion keeps a readable settled smoke plume');
 assert.ok(reduced.plumeCount>=12,'the reduced plume keeps its authored particle set');
 assert.equal(reduced.plumeStable,true,'reduced motion freezes plume positions, size and opacity');
 assert.equal(reduced.chunkVisible,false,'reduced motion suppresses the kinetic debris chunk burst');
 assert.equal(reduced.chunkOpacity,0,'reduced-motion chunks leave no ghost opacity');
 assert.equal(reduced.blastLight,false,'reduced motion suppresses the detonation light wash');
 assert.equal(reduced.blastLightIntensity,0,'reduced-motion light emits no intensity');
 assert.ok(reduced.blastOpacity>=.5,'the static detonation indication remains readable');
 assert.equal(reduced.muzzle,false,'reduced motion suppresses the muzzle flash');
 assert.equal(reduced.worldLight.visible,false,'reduced motion suppresses the pooled world muzzle light');
 assert.equal(reduced.worldLight.intensity,0,'reduced-motion muzzle light emits no intensity');
 assert.equal(reduced.tracer,false,'reduced motion suppresses the tracer flash');
 assert.equal(reduced.sparks,true,'reduced motion retains a quiet spark cue');
 assert.ok(reduced.sparkOpacity<.3,'reduced-motion sparks are dimmed rather than flashing');
 assert.equal(reduced.dust,false,'reduced motion suppresses the expansive dust plume');
 assert.equal(reduced.debris,false,'reduced motion suppresses the kinetic debris burst');
 // Pool and ownership verification: sustained fire must not grow either the
 // pool or the GPU geometry register, and clear() must release the owned pool.
 const memory=await p.evaluate(`(async()=>{const mod=await import('./raid-view.mjs');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const fresh=new mod.RaidView(canvas);const snapshot=JSON.parse(JSON.stringify(window.__fxView.snapshot));
  fresh.start(snapshot);fresh.settings={...window.__fxView.settings};
  const tracerIds=fresh.shotEffects.map(e=>e.tracer.uuid).join(','),blastIds=fresh.blastEffects.map(e=>e.ring.uuid).join(','),lightIds=fresh.blastEffects.map(e=>e.light.uuid).join(','),shotLightId=fresh.shotMuzzleLight?.uuid,shotLightIds=[...fresh.scene.children].filter(o=>o.isPointLight&&o.userData.raidCombatLight).map(o=>o.uuid).join(',');
  const before={geometries:fresh.renderer.info.memory.geometries,textures:fresh.renderer.info.memory.textures};
  for(let i=0;i<60;i++){fresh.fireYaw=i*.19;fresh.firePitch=-.35;fresh.fireOrigin.set(snapshot.self.x,1.55,snapshot.self.z);fresh.fire();fresh.updateCombatEffects(performance.now()+i*5)}
  for(let i=0;i<40;i++){fresh.spawnBlast(snapshot.self.x+i,0,snapshot.self.z,2.5);fresh.updateCombatEffects(performance.now()+i*6)}
  const ownedElements=[...fresh.shotEffects.flatMap(e=>[e.muzzle,e.tracer,e.sparks,e.dust,e.debris,...e.trailSprites]),...fresh.blastEffects.flatMap(e=>[e.ring,e.flash,e.embers,e.plume,e.chunks,e.scorch])].filter(Boolean);
  const sustained={geometries:fresh.renderer.info.memory.geometries,textures:fresh.renderer.info.memory.textures,shots:fresh.shotEffects.length,blasts:fresh.blastEffects.length,tracerIds:fresh.shotEffects.map(e=>e.tracer.uuid).join(',')===tracerIds,blastIds:fresh.blastEffects.map(e=>e.ring.uuid).join(',')===blastIds,lightIds:fresh.blastEffects.map(e=>e.light.uuid).join(',')===lightIds,lightsHidden:fresh.blastEffects.every(e=>!e.light.visible&&e.light.intensity===0),shotLightStable:fresh.shotMuzzleLight?.uuid===shotLightId,shotLightPools:[...fresh.scene.children].filter(o=>o.isPointLight&&o.userData.raidCombatLight).map(o=>o.uuid).join(',')===shotLightIds&&[...fresh.scene.children].filter(o=>o.isPointLight&&o.userData.raidCombatLight).length===1,shotLightHidden:!fresh.shotMuzzleLight?.visible&&(fresh.shotMuzzleLight?.intensity||0)===0,untagged:ownedElements.filter(o=>o.material?.userData?.raidOwned!==true&&o.geometry?.userData?.raidOwned!==true).length,tagged:ownedElements.length};
  fresh.clear();const released={geometries:fresh.renderer.info.memory.geometries,textures:fresh.renderer.info.memory.textures,shots:fresh.shotEffects.length,blasts:fresh.blastEffects.length,scene:fresh.scene};
  fresh.renderer.dispose();
  return {before,sustained,released};})()`);
 assert.equal(memory.sustained.shots,16,'sustained fire keeps the shot pool fixed');
 assert.equal(memory.sustained.blasts,6,'sustained detonations keep the blast pool fixed');
 assert.equal(memory.sustained.tracerIds,true,'shot effect objects are reused in place');
 assert.equal(memory.sustained.blastIds,true,'blast effect objects are reused in place');
 assert.equal(memory.sustained.lightIds,true,'detonation lights are reused in place');
 assert.equal(memory.sustained.shotLightStable,true,'the muzzle light object is reused across sustained fire');
 assert.equal(memory.sustained.shotLightPools,true,'exactly one pooled world muzzle light exists');
 assert.equal(memory.sustained.shotLightHidden,true,'the muzzle light returns to rest between shots');
 assert.equal(memory.sustained.lightsHidden,true,'detonation lights return to rest between blasts');
 assert.equal(memory.sustained.untagged,0,'every pooled effect is tag-disposable');
 assert.equal(memory.sustained.tagged,16*(5+8)+6*6,'all pooled effect owners participate in disposal');
 assert.ok(memory.sustained.geometries<=memory.before.geometries,'fire does not allocate new GPU geometry');
 assert.ok(Math.abs(memory.sustained.textures-memory.before.textures)<=1,'fire does not allocate new textures');
 assert.equal(memory.released.shots,0,'clear() releases shot pool references');
 assert.equal(memory.released.blasts,0,'clear() releases blast pool references');
 assert.equal(memory.released.scene,null,'clear() releases the effects scene');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({shots:{pooled:true,pool:fired.pool,muzzleLight:{count:fired.poolLightCount,type:fired.lightEarly.type,color:fired.lightEarly.color,distance:fired.lightEarly.distance,intensity:fired.lightEarly.intensity,bounded:true,expires:!fired.lightLate.visible,reducedOff:!reduced.worldLight.visible},clearsWithin350ms:cleared,tracerCollision:true,surface:fired.surface,impactFamilies:distinctStyling,dust:{expands:fired.dustLate>fired.dustEarly,fades:fired.dustOpacity>0&&fired.dustOpacity<.5},debris:{count:fired.debrisCount,moves:fired.chipsEarly.some((v,i)=>v!==fired.chipsLate[i]),fades:fired.debrisOpacityLate>0&&fired.debrisOpacityLate<fired.debrisOpacityEarly},audio:{shotCue:fired.cueLog[0]?.[0],impactCue:fired.cueLog.find(([kind])=>kind.startsWith('impact:'))?.[0]??null,spatial:!!fired.cueLog.find(([kind])=>kind.startsWith('impact:'))}},blast:{layers:['ring','flash','embers','plume','chunks','light','scorch'],pooled:true,transition:true,embers:blast.emberCount,plume:{count:blast.plumeCount,mapped:blast.plumeMapped,matte:!blast.plumeAdditive,reducedStatic:reduced.plumeStable},chunks:{count:blast.chunkCount,mapped:blast.chunkMapped,matte:!blast.chunkAdditive,moves:JSON.stringify(blast.chunksEarly)!==JSON.stringify(blast.chunksLate),reducedHidden:!reduced.chunkVisible},light:{color:blast.lightColor,distance:blast.lightDistance,decay:blast.lightDecay,early:blast.lightIntensityEarly,late:blast.lightIntensityLate,expires:blast.lightExpired,reducedOff:!reduced.blastLight},scorch:{persists:scorch.persisted,expires:scorch.expired,reducedStatic:scorch.static}},smoke:{puffs:smoke.puffs,expands:true,shimmers:true},reducedMotion:true,resources:{before:memory.before,sustained:memory.sustained,released:memory.released},screenshots:['/tmp/hs-fx-shot.png','/tmp/hs-fx-muzzle.png','/tmp/hs-fx-cluster.png','/tmp/hs-fx-blast.png','/tmp/hs-fx-chunks.png','/tmp/hs-fx-light.png','/tmp/hs-fx-smoke.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(priorUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=priorUrl}
