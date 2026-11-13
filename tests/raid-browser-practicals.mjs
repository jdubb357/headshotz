// Practical-lighting grader: proves authored lamps, floodlights and campfires
// bloom as one deterministic additive sprite field, that the glow strengthens as
// daylight falls and is damped by heavy weather, that the frame gains warm pixels
// with the field enabled, and that lifecycle rebuilds do not leak resources.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('practicals_probe','a long practicals probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'practicals_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  const {buildEnvironment,terrainNormalAt}=await import('./raid-environment.mjs');
  const {RAID_WORLDS,terrainHeightAt,uniqueWindowProps}=await import('./shared/raid-worlds.mjs');
  const THREE=await import('./lib/three.module.min.js');
  const practicalKinds=['lamp','floodlight','campfire'],poolKinds=['lamp','campfire'];
  // Authored population and one deterministic build per frozen sector.
  const worlds={};
  for(const world of RAID_WORLDS){
   const authored={};for(const prop of world.props||[])if(practicalKinds.includes(prop.kind))authored[prop.kind]=(authored[prop.kind]||0)+1;
   const uniqueProps=uniqueWindowProps(world.props||[]);
   const windows=uniqueProps.filter(prop=>prop.kind==='window'&&prop.lit&&prop.color!=null).length;
   authored.window=windows;
   const expected=Object.values(authored).reduce((a,b)=>a+b,0);
   const poolProps=(world.props||[]).filter(prop=>poolKinds.includes(prop.kind)&&(prop.y==null||prop.y===0));
   const build=()=>buildEnvironment(world);
   const root=build(),glow=root.userData.raidGlowPoints,pools=root.userData.raidGlowPools,glints=root.userData.raidWetReflections;
   if(!glow||!pools||!glints)continue;
   const pos=glow.geometry.attributes.position,col=glow.geometry.attributes.color;
   const glintExpected=poolProps.length+windows+uniqueProps.filter(prop=>prop.kind==='floodlight'&&(prop.y==null||prop.y===0)).length;
   const signature=()=>{const r=build(),g=r.userData.raidGlowPoints,p=r.userData.raidGlowPools,w=r.userData.raidWetReflections;return {count:g.geometry.attributes.position.count,pos:Array.from(g.geometry.attributes.position.array),col:Array.from(g.geometry.attributes.color.array),poolCount:p.count,poolMat:Array.from(p.instanceMatrix.array),poolCol:Array.from(p.instanceColor.array),glintCount:w.count,glintMat:Array.from(w.instanceMatrix.array),glintCol:Array.from(w.instanceColor.array)}};
   const a=signature(),b=signature();
   const deterministic=a.count===b.count&&a.pos.every((v,i)=>v===b.pos[i])&&a.col.every((v,i)=>v===b.col[i]);
   const poolDeterministic=a.poolCount===b.poolCount&&a.poolMat.every((v,i)=>v===b.poolMat[i])&&a.poolCol.every((v,i)=>v===b.poolCol[i]);
   const glintDeterministic=a.glintCount===b.glintCount&&a.glintMat.every((v,i)=>v===b.glintMat[i])&&a.glintCol.every((v,i)=>v===b.glintCol[i]);
   // Ground pools and glints must sit exactly on sampled terrain, not float or sink.
   let poolBaseError=0,poolSlopeError=0,poolColorCount=0;const poolMatrices=pools.instanceMatrix.array;
   const slopeMatrix=new THREE.Matrix4(),slopePosition=new THREE.Vector3(),slopeRotation=new THREE.Quaternion(),slopeScale=new THREE.Vector3(),slopeUp=new THREE.Vector3(),slopeNormal=new THREE.Vector3();
   for(let i=0;i<pools.count;i++){
    const expectedY=terrainHeightAt(world,poolProps[i].x,poolProps[i].z)+.04;
    poolBaseError=Math.max(poolBaseError,Math.abs(poolMatrices[i*16+13]-expectedY));
    slopeMatrix.fromArray(poolMatrices,i*16);slopeMatrix.decompose(slopePosition,slopeRotation,slopeScale);
    slopeUp.set(0,1,0).applyQuaternion(slopeRotation);
    terrainNormalAt(world,slopePosition.x,slopePosition.z,slopeNormal);
    poolSlopeError=Math.max(poolSlopeError,1-slopeUp.dot(slopeNormal));
   }
   if(pools.instanceColor)poolColorCount=pools.instanceColor.count;
   let glintBaseError=0,glintSlopeError=0,glintColorCount=0,glintNormalLengthError=0,glintNormalYMin=1,glintSteepCount=0,glintFinite=true;const glintMatrices=glints.instanceMatrix.array;
   for(let i=0;i<glints.count;i++){
    const gx=glintMatrices[i*16+12],gy=glintMatrices[i*16+13],gz=glintMatrices[i*16+14];
    glintBaseError=Math.max(glintBaseError,Math.abs(gy-(terrainHeightAt(world,gx,gz)+.06)));
    slopeMatrix.fromArray(glintMatrices,i*16);slopeMatrix.decompose(slopePosition,slopeRotation,slopeScale);
    slopeUp.set(0,1,0).applyQuaternion(slopeRotation);
    terrainNormalAt(world,gx,gz,slopeNormal);
    glintFinite=glintFinite&&isFinite(slopeNormal.x)&&isFinite(slopeNormal.y)&&isFinite(slopeNormal.z)&&isFinite(gy);
    glintNormalLengthError=Math.max(glintNormalLengthError,Math.abs(slopeNormal.length()-1));
    glintNormalYMin=Math.min(glintNormalYMin,slopeNormal.y);
    if(slopeNormal.y<.9)glintSteepCount++;
    glintSlopeError=Math.max(glintSlopeError,1-slopeUp.dot(slopeNormal));
   }
   if(glints.instanceColor)glintColorCount=glints.instanceColor.count;
   // Every authored lamp/floodlight/campfire and lit window contributes one
   // point at its own fixture offset; one of each family proves placement.
   const offsets={lamp:4.76,floodlight:6.4,campfire:.42};
   const sample={};
   for(const kind of [...practicalKinds,'window']){
    const prop=(world.props||[]).find(item=>item.kind===kind&&(item.kind!=='window'||(item.lit&&item.color!=null&&(!item.w||item.w<=.9))));
    if(!prop)continue;
    const offset=prop.kind==='window'?(prop.h||1.3)/2:prop.kind==='campfire'?.42*(prop.scale||1):offsets[prop.kind];
    const lift=(prop.y==null||prop.y===0)?terrainHeightAt(world,prop.x,prop.z):0;
    let best=1e9,point=null;
    for(let i=0;i<pos.count;i++){
     const d=Math.hypot(pos.getX(i)-prop.x,pos.getY(i)-(prop.y||0)-lift-offset,pos.getZ(i)-prop.z);
     if(d<best){best=d;point={x:+pos.getX(i).toFixed(3),y:+pos.getY(i).toFixed(3),z:+pos.getZ(i).toFixed(3),dist:+d.toFixed(3)}}
    }
    sample[kind]={x:prop.x,z:prop.z,point};
   }
   worlds[world.id]={authored,count:pos.count,expected,deterministic,sample,poolCount:pools.count,poolExpected:poolProps.length,poolDeterministic,poolBaseError:+poolBaseError.toFixed(4),poolSlopeError:+poolSlopeError.toFixed(6),poolColorCount,glintCount:glints.count,glintExpected,glintDeterministic,glintBaseError:+glintBaseError.toFixed(4),glintSlopeError:+glintSlopeError.toFixed(6),glintNormalYMin:+glintNormalYMin.toFixed(4),glintNormalLengthError:+glintNormalLengthError.toFixed(8),glintSteepCount,glintFinite,glintColorCount,wetReflectionField:{isInstanced:!!glints.isInstancedMesh,map:!!glints.material.map,additive:glints.material.blending===THREE.AdditiveBlending,depthWrite:glints.material.depthWrite,depthTest:glints.material.depthTest,triangles:glints.count},poolField:{isInstanced:!!pools.isInstancedMesh,map:!!pools.material.map,additive:pools.material.blending===THREE.AdditiveBlending,depthWrite:pools.material.depthWrite,triangles:pools.count}};
  }
  // Malformed terrain: a corrupt height sample must not leak NaN into the
  // glint/pool orientation math; the tangent-plane helper falls back to the
  // horizon and still returns a unit vector.
  const degraded=terrainNormalAt({terrain:{resolution:2,cell:2.4,heights:[0,0,0,NaN]},size:10},0,0);
  const degradedFinite=Number.isFinite(degraded.x)&&Number.isFinite(degraded.y)&&Number.isFinite(degraded.z)&&Math.abs(degraded.length()-1)<1e-6&&degraded.y===1;
  const base=${JSON.stringify(snapshot)};
  const world=RAID_WORLDS[0];
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='practicalsProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const view=new RaidView(canvas);view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});view.start(base);
  const glow=view.glowPoints,pos=glow.geometry.attributes.position;
  const material={isPoints:!!glow.isPoints,map:!!glow.material.map,additive:glow.material.blending===THREE.AdditiveBlending,depthWrite:glow.material.depthWrite,depthTest:glow.material.depthTest,glowBias:glow.material.userData.raidGlowBias,vertexColors:glow.material.vertexColors,size:glow.material.size,count:pos.count};
  const state=(overrides,at={x:300,y:0,z:3})=>({...base,self:{...base.self,...at},conditions:{...base.conditions,...overrides}});
  const daylight=x=>{view.sync(state(x));view.updateEnvironment(1);const night=Math.pow(Math.max(0,Math.min(1,1-(view.environmentTarget.daylight||0))),1.35);return {opacity:view.glowPoints.material.opacity,poolOpacity:view.glowPools.material.opacity,night,visible:view.glowPoints.visible,poolVisible:view.glowPools.visible}};
  const noon=daylight({weather:'clear',period:'day',clock:'12:00',daylight:1,light:2.2,ambient:1.8,visibility:1,sky:0x9fb9c8,fog:0xadc2cc});
  const dusk=daylight({weather:'clear',period:'dusk',clock:'19:00',daylight:.3,light:1.1,ambient:1.25,visibility:.85,sky:0x9c7f74,fog:0x8a756b});
  const night=daylight({weather:'clear',period:'night',clock:'23:00',daylight:0,light:.16,ambient:.5,visibility:.7,sky:0x101a2f,fog:0x263349});
  const rain=daylight({weather:'rain',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75,sky:0x526a83,fog:0x667d90});
  const ash=daylight({weather:'ash',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.7,sky:0x7f6e63,fog:0x786f68});
  // Reduced motion keeps the authored static glow and ground pools (no animation).
  const reducedSettled=[...pos.array],reducedPoolSettled=Array.from(view.glowPools.instanceMatrix.array);view.applySettings({reduced:true,sfxVolume:0,fov:75});
  view.sync(state({weather:'clear',period:'night',clock:'23:00',daylight:0,light:.16,ambient:.5,visibility:.7,sky:0x101a2f,fog:0x263349}));view.updateEnvironment(1);
  const reduced={visible:view.glowPoints.visible,opacity:view.glowPoints.material.opacity,static:reducedSettled.every((v,i)=>v===pos.array[i]),poolVisible:view.glowPools.visible,poolOpacity:view.glowPools.material.opacity,poolStatic:reducedPoolSettled.every((v,i)=>v===view.glowPools.instanceMatrix.array[i])};
  view.applySettings({reduced:false,sfxVolume:0,fov:75});
  // Objective warm-pixel lift: stand beside the avenue's lamp line at night and
  // compare the same frame with the glow field visible and hidden.
  const cam=new THREE.PerspectiveCamera(62,640/360,.1,4000);cam.position.set(300,2.1,3);cam.lookAt(-300,2.1,3);
  const target=new THREE.WebGLRenderTarget(640,360);view.renderer.setRenderTarget(target);
  const capture=()=>{const data=new Uint8Array(640*360*4);view.renderer.readRenderTargetPixels(target,0,0,640,360,data);return data};
  view.glowPoints.visible=true;view.renderer.clear();view.renderer.render(view.scene,cam);const lit=capture();
  view.glowPoints.visible=false;view.renderer.clear();view.renderer.render(view.scene,cam);const unlit=capture();
  let changed=0,warm=0;for(let i=0;i<lit.length;i+=4){const dr=lit[i]-unlit[i],dg=lit[i+1]-unlit[i+1],db=lit[i+2]-unlit[i+2];if(Math.abs(dr)+Math.abs(dg)+Math.abs(db)>12)changed++;if(dr>4&&dr>db+3)warm++}
  // Ground pools: isolate the instanced planes and compare the same dusk frame.
  view.sync(state({weather:'clear',period:'dusk',clock:'19:00',daylight:.3,light:1.1,ambient:1.25,visibility:.85,sky:0x9c7f74,fog:0x8a756b}));view.updateEnvironment(1);view.updateWetness(10);
  view.glowPoints.visible=false;view.glowPools.visible=true;
  view.renderer.clear();view.renderer.render(view.scene,cam);const poolLit=capture();
  view.glowPools.visible=false;view.renderer.clear();view.renderer.render(view.scene,cam);const poolUnlit=capture();
  let poolChanged=0,poolWarm=0,poolGround=0;
  const rows=360,cols=640;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const i=(y*cols+x)*4,dr=poolLit[i]-poolUnlit[i],dg=poolLit[i+1]-poolUnlit[i+1],db=poolLit[i+2]-poolUnlit[i+2];
   if(Math.abs(dr)+Math.abs(dg)+Math.abs(db)>12)poolChanged++;
   if(dr>4&&dr>db+3){poolWarm++;if(y<rows*.55)poolGround++}
  }
  // Wet-reflection companion field: the same fixture sources stretched along
  // deterministic ground axes. Prove rain ignites it, clear weather preserves a
  // dry zero, the field costs one draw call and the whole field stays a single
  // instanced additive mesh with terrain-anchored quads.
  const wetField=view.wetReflections;
  if(!wetField)throw new Error('RaidView did not expose wet reflections');
  const reflectState=overrides=>{view.sync(state(overrides));view.updateEnvironment(1);view.updateWetness(10);return {opacity:wetField.material.opacity,visible:wetField.visible,wetness:view.wetness}};
  const wetDusk=reflectState({weather:'rain',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75,sky:0x526a83,fog:0x667d90});
  const wetNight=reflectState({weather:'rain',period:'night',clock:'23:00',daylight:0,light:.16,ambient:.5,visibility:.7,sky:0x101a2f,fog:0x263349});
  const wetNoon=reflectState({weather:'rain',period:'day',clock:'12:00',daylight:1,light:2.2,ambient:1.8,visibility:1,sky:0x9fb9c8,fog:0xadc2cc});
  const wetMist=reflectState({weather:'mist',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75,sky:0x6e7c83,fog:0x7f8d92});
  reflectState({weather:'rain',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75,sky:0x526a83,fog:0x667d90});
  view.glowPoints.visible=false;view.glowPools.visible=false;
  const glintDrawCalls=visible=>{wetField.visible=visible;view.renderer.info.autoReset=false;view.renderer.info.reset();view.renderer.clear();view.renderer.render(view.scene,cam);return view.renderer.info.render.calls};
  wetField.visible=true;view.renderer.clear();view.renderer.render(view.scene,cam);const glintOn=capture();
  wetField.visible=false;view.renderer.clear();view.renderer.render(view.scene,cam);const glintOff=capture();
  const glintCalls={on:glintDrawCalls(true),off:glintDrawCalls(false)};
  let glintChanged=0,glintWarm=0,glintBlue=0;
  for(let i=0;i<glintOn.length;i+=4){
   const dr=glintOn[i]-glintOff[i],dg=glintOn[i+1]-glintOff[i+1],db=glintOn[i+2]-glintOff[i+2];
   if(Math.abs(dr)+Math.abs(dg)+Math.abs(db)>10)glintChanged++;
   if(dr>3&&dr>db+2)glintWarm++;if(db>3&&db>dr+2)glintBlue++;
  }
  // The glint shader fades streaks whose projected footprint is smaller than a
  // few pixels. Force the smallest possible footprint to prove the program is
  // active on the instanced draw; a full-size refresh must restore the lift.
  const glintShader=wetField.material.userData.raidGlintShader;
  if(!glintShader||!glintShader.uniforms.uGlintResolution)throw new Error('wet glints are missing their projected-footprint shader');
  const glintResolution=glintShader.uniforms.uGlintResolution.value,savedResolution={x:glintResolution.x,y:glintResolution.y};
  glintResolution.set(.0001,.0001);wetField.visible=true;view.renderer.clear();view.renderer.render(view.scene,cam);const glintSubpixelOn=capture();
  glintResolution.set(savedResolution.x,savedResolution.y);view.renderer.clear();view.renderer.render(view.scene,cam);const glintRestored=capture();wetField.visible=false;
  let glintSubpixelChanged=0,glintRestoredChanged=0;
  for(let i=0;i<glintSubpixelOn.length;i+=4){
   if(Math.abs(glintSubpixelOn[i]-glintOff[i])+Math.abs(glintSubpixelOn[i+1]-glintOff[i+1])+Math.abs(glintSubpixelOn[i+2]-glintOff[i+2])>10)glintSubpixelChanged++;
   if(Math.abs(glintRestored[i]-glintOn[i])+Math.abs(glintRestored[i+1]-glintOn[i+1])+Math.abs(glintRestored[i+2]-glintOn[i+2])>10)glintRestoredChanged++;
  }
  // Clear weather drains wetness to zero; even a manually forced-visible quad
  // field must contribute no visible lift, proving the field is wetness-gated.
  const wetDry=reflectState({weather:'clear',period:'dusk',clock:'19:00',daylight:.3,light:1.1,ambient:1.25,visibility:.85,sky:0x9c7f74,fog:0x8a756b});
  wetField.visible=true;view.renderer.clear();view.renderer.render(view.scene,cam);const glintDryOn=capture();
  wetField.visible=false;view.renderer.clear();view.renderer.render(view.scene,cam);const glintDryOff=capture();
  let glintDryChanged=0;for(let i=0;i<glintDryOn.length;i+=4)if(Math.abs(glintDryOn[i]-glintDryOff[i])+Math.abs(glintDryOn[i+1]-glintDryOff[i+1])+Math.abs(glintDryOn[i+2]-glintDryOff[i+2])>10)glintDryChanged++;
  wetField.visible=false;
  // Reduced motion snaps a zero-wetness state straight to the rain target in a
  // single 16 ms update, instead of easing in; the glint field follows it.
  view.applySettings({reduced:true,sfxVolume:0,fov:75});
  view.sync(state({weather:'rain',period:'dusk',clock:'19:00',daylight:.3,light:.9,ambient:1,visibility:.75,sky:0x526a83,fog:0x667d90}));view.updateEnvironment(1);
  const reducedBefore=view.wetness;view.updateWetness(.016);
  const reducedWet={before:reducedBefore,after:view.wetness,opacity:wetField.material.opacity,visible:wetField.visible};
  view.applySettings({reduced:false,sfxVolume:0,fov:75});
  view.sync(state({weather:'clear',period:'dusk',clock:'19:00',daylight:.3,light:1.1,ambient:1.25,visibility:.85,sky:0x9c7f74,fog:0x8a756b}));view.updateEnvironment(1);view.updateWetness(10);wetField.visible=false;
  // Depth-culling evidence: disabling depth testing lets fixture and far-side
  // window halos paint through solid geometry. The enabled frame is therefore
  // measurably darker in those regions; this proves the field no longer ghosts.
  view.glowPoints.material.depthTestOption=view.glowPoints.material.depthTest;
  view.glowPoints.visible=true;view.renderer.clear();view.renderer.render(view.scene,cam);const depthOn=capture();
  view.glowPoints.material.depthTest=false;view.renderer.clear();view.renderer.render(view.scene,cam);const depthOff=capture();
  let depthCulled=0;for(let i=0;i<depthOn.length;i+=4)if(Math.abs(depthOff[i]-depthOn[i])+Math.abs(depthOff[i+1]-depthOn[i+1])+Math.abs(depthOff[i+2]-depthOn[i+2])>12)depthCulled++;
  view.glowPoints.material.depthTest=view.glowPoints.material.depthTestOption;
  view.glowPoints.visible=true;
  view.renderer.setRenderTarget(null);target.dispose();
  // Hero dusk frame: the same avenue with the low sun and lamp halos.
  const duskState=()=>state({weather:'clear',period:'dusk',clock:'19:15',daylight:.25,light:.8,ambient:1.05,visibility:.85,sky:0x4a3f42,fog:0x5e5049,sun:{x:-70,y:22,z:35}});
  const hero=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,4000);hero.position.set(300,2.1,3);hero.lookAt(-300,2.1,3);
  const renderHero=(heroState=duskState(),wet=false)=>{
   view.sync(heroState);view.updateEnvironment(1);if(wet)view.updateWetness(10);
   const anchor=new THREE.Vector3(300,0,3);view.sun.target.position.copy(anchor);view.sun.position.copy(anchor).addScaledVector(view.sunDirection,90);view.sun.target.updateMatrixWorld();
   view.renderer.setPixelRatio(1);view.renderer.setSize(innerWidth,innerHeight,false);view.selfActor.visible=false;
   const target=view.ensurePostTarget();
   view.renderer.setRenderTarget(target);view.renderer.clear();view.renderer.render(view.scene,hero);view.renderer.setRenderTarget(null);
   if(view.postScene&&view.postMesh){const u=view.postMaterial.uniforms;u.uScene.value=target.texture;u.uResolution.value.set(view.canvas.width,view.canvas.height);u.uTime.value=0;view.renderer.render(view.postScene,view.postCamera)}
  };
  window.__renderWetHero=stateIn=>renderHero(stateIn,true);
  renderHero();
  // Lifecycle must republish the same field without touching world data.
  const worldSig=JSON.stringify([view.world.blocks?.length,view.world.props?.length,view.world.size]);
  const lifecycle=[];
  for(let i=0;i<3;i++){view.clear();view.start(base);lifecycle.push({...view.renderer.info.memory})}
  const memoryStable=lifecycle.every(m=>m.geometries===lifecycle[0].geometries&&m.textures===lifecycle[0].textures);
  renderHero();
  window.__practicalView=view;
  return {worlds,material,poolField:view.glowPools?.isInstancedMesh?{isInstanced:true,map:!!view.glowPools.material.map,additive:view.glowPools.material.blending===THREE.AdditiveBlending,depthWrite:view.glowPools.material.depthWrite,count:view.glowPools.count}:null,wetReflections:{field:{isInstanced:!!wetField.isInstancedMesh,map:!!wetField.material.map,additive:wetField.material.blending===THREE.AdditiveBlending,depthWrite:wetField.material.depthWrite,depthTest:wetField.material.depthTest,count:wetField.count,colorCount:wetField.instanceColor?.count||0,textureOwned:!!wetField.material.userData.raidOwnTexture},rainDusk:wetDusk,rainNight:wetNight,noon:wetNoon,mist:wetMist,dry:wetDry,reducedWet,pixels:{changed:glintChanged,warm:glintWarm,blue:glintBlue,subpixelChanged:glintSubpixelChanged,restoredChanged:glintRestoredChanged,dryChanged:glintDryChanged},footprintShader:!!glintShader,drawCalls:glintCalls},noon,dusk,night,rain,ash,reduced,pixels:{changed,warm},poolPixels:{changed:poolChanged,warm:poolWarm,ground:poolGround},depthCulled,memoryStable,degradedFinite,stateUntouched:worldSig===JSON.stringify([view.world.blocks?.length,view.world.props?.length,view.world.size]),legend:{world:world.id},screenshot:'/tmp/hs-practicals.png'};
 })()`);
 assert.ok(result.worlds.relay,'the relay sector carries a practical-lighting field');
 const total=Object.values(result.worlds).reduce((sum,w)=>sum+w.count,0);
 assert.ok(total>2000,'all three sectors share the glow budget ('+total+' points)');
 for(const [id,w] of Object.entries(result.worlds)){
  assert.equal(w.count,w.expected,id+' glow points equal authored lamp/floodlight/campfire + lit-window count');
  assert.equal(w.deterministic,true,id+' practical halos are deterministic across rebuilds');
  for(const [kind,sample] of Object.entries(w.sample))assert.ok(sample.point.dist<.02,id+' '+kind+' halo is anchored to its authored fixture ('+sample.point.dist+' m)');
  assert.equal(w.sample.window!=null,true,id+' lit windows contribute a sampled bloom halo');
  assert.equal(w.poolField.isInstanced,true,id+' ground pools are a single instanced mesh');
  assert.equal(w.poolField.map,true,id+' ground pools use the shared soft falloff sprite');
  assert.equal(w.poolField.additive,true,id+' ground pools add warm light to the asphalt');
  assert.equal(w.poolField.depthWrite,false,id+' ground pools leave scene depth intact');
  assert.equal(w.poolCount,w.poolExpected,id+' ground pools equal authored lamp/campfire prop count');
  assert.equal(w.poolDeterministic,true,id+' ground pools rebuild deterministically');
  assert.equal(w.poolColorCount,w.poolCount,id+' every ground pool carries a warm instance colour');
  assert.ok(w.poolBaseError<.001,id+' ground pools sit exactly on sampled terrain (max error '+w.poolBaseError+' m)');
  assert.ok(w.poolSlopeError<.005,id+' ground pools lie flush on the terrain tangent plane (max up/normal error '+w.poolSlopeError+')');
  assert.equal(w.glintCount,w.glintExpected,id+' wet reflections equal authored ground practicals plus lit windows ('+w.glintCount+')');
  assert.equal(w.glintDeterministic,true,id+' wet-reflection instances rebuild deterministically');
  assert.equal(w.glintColorCount,w.glintCount,id+' every wet reflection carries its source colour');
  assert.ok(w.glintBaseError<.001,id+' wet reflections sit exactly on sampled terrain (max error '+w.glintBaseError+' m)');
  assert.ok(w.glintSlopeError<.005,id+' wet glints lie flush on the terrain tangent plane (max up/normal error '+w.glintSlopeError+')');
  assert.equal(w.glintFinite,true,id+' every wet glint and terrain sample is finite');
  assert.ok(w.glintNormalLengthError<1e-6,id+' terrain tangent normals are unit length (max error '+w.glintNormalLengthError+')');
  assert.ok(w.glintNormalYMin>.2,id+' terrain tangent normals never degenerate below the horizon (min y '+w.glintNormalYMin+')');
  assert.ok(w.glintSteepCount>0,id+' the audit covers steep terrain seams ('+w.glintSteepCount+' glints on slopes >25.8 degrees)');
  assert.equal(w.wetReflectionField.isInstanced,true,id+' wet reflections are one instanced mesh');
  assert.equal(w.wetReflectionField.map,true,id+' wet reflections use the authored glint sheen');
  assert.equal(w.wetReflectionField.additive,true,id+' wet reflections add light to the ground');
  assert.equal(w.wetReflectionField.depthWrite,false,id+' wet reflections leave scene depth intact');
  assert.equal(w.wetReflectionField.depthTest,true,id+' wet reflections respect scene depth');
  assert.equal(w.wetReflectionField.triangles,w.glintCount,id+' one quad per wet-reflection source');
 }
 assert.equal(result.material.isPoints,true,'practicals render as a static point field');
 assert.equal(result.material.map,true,'halos use the shared soft sprite');
 assert.equal(result.material.additive,true,'halos blend additively into the scene');
 assert.equal(result.material.depthWrite,false,'halos never write depth');
 assert.equal(result.material.depthTest,true,'halos respect scene depth');
 assert.ok(result.material.glowBias>0&&result.material.glowBias<1.5,'halo depth bias clears its own fixture ('+result.material.glowBias+' m)');
 assert.equal(result.material.vertexColors,true,'per-family warm colours are authored');
 assert.ok(result.material.size>=.4&&result.material.size<=2,'halo sprite size is tuned ('+result.material.size+')');
 assert.equal(result.poolField.isInstanced,true,'ground pools are instanced in the live view');
 assert.equal(result.poolField.count,result.worlds.relay.poolCount,'the live relay pool budget matches the authored field');
 const wetRefs=result.wetReflections;
 assert.equal(wetRefs.field.isInstanced,true,'wet reflections are instanced in the live view');
 assert.equal(wetRefs.field.count,result.worlds.relay.glintCount,'the live relay wet-reflection budget matches the authored field');
 assert.equal(wetRefs.field.colorCount,wetRefs.field.count,'every wet reflection keeps its source colour');
 assert.equal(wetRefs.field.map,true,'wet reflections use the generated glint sheen');
 assert.equal(wetRefs.field.textureOwned,true,'the glint texture is tagged for lifecycle disposal');
 assert.equal(wetRefs.field.additive,true,'wet reflections add light instead of occluding the road');
 assert.equal(wetRefs.field.depthWrite,false,'wet reflections leave scene depth intact');
 assert.equal(wetRefs.field.depthTest,true,'wet reflections are occluded by scene geometry');
 assert.ok(wetRefs.rainDusk.wetness>.9,'rain fully wets the reflective street state');
 assert.ok(wetRefs.rainDusk.visible,'rain at dusk shows the wet-reflection field');
 assert.ok(wetRefs.rainDusk.opacity>.3,'rain at dusk carries a strong wet reflected sheen ('+wetRefs.rainDusk.opacity.toFixed(3)+')');
 assert.ok(wetRefs.rainNight.opacity>=wetRefs.rainDusk.opacity-.01,'night rain keeps the wet-reflection sheen');
 assert.equal(wetRefs.noon.visible,false,'daytime rain turns the warm wet glints off');
 assert.ok(wetRefs.noon.opacity<.01,'daylight leaves no warm wet-reflection lift ('+wetRefs.noon.opacity.toFixed(3)+')');
 assert.ok(wetRefs.mist.wetness>.2,'mist wets the street towards a light sheen');
 assert.ok(wetRefs.mist.visible&&wetRefs.mist.opacity<wetRefs.rainDusk.opacity,'mist reflections stay weaker than rain ('+wetRefs.mist.opacity.toFixed(3)+')');
 assert.equal(wetRefs.dry.wetness,0,'clear weather drains wetness to zero');
 assert.equal(wetRefs.dry.visible,false,'dry ground hides the wet-reflection field');
 assert.ok(wetRefs.dry.opacity<.001,'dry ground has zero wet-reflection opacity');
 assert.ok(wetRefs.pixels.changed>=30,'wet reflections visibly lift the dusk roadway ('+wetRefs.pixels.changed+' px)');
 assert.ok(wetRefs.pixels.warm>=10,'wet reflections carry warm lamp/window light ('+wetRefs.pixels.warm+' warm px)');
 assert.equal(wetRefs.pixels.dryChanged,0,'zero-wetness is an exact wet-reflection recovery');
 assert.equal(wetRefs.drawCalls.on,wetRefs.drawCalls.off+1,'the wet-reflection field costs exactly one draw call');
 assert.equal(wetRefs.footprintShader,true,'wet glints carry a projected-footprint shader');
 assert.ok(wetRefs.pixels.subpixelChanged<10,'sub-pixel glint footprints fade to an invisible lift ('+wetRefs.pixels.subpixelChanged+' px)');
 assert.ok(wetRefs.pixels.restoredChanged<10,'restoring the drawing-buffer resolution restores the full-strength streaks ('+wetRefs.pixels.restoredChanged+' px)');
 assert.equal(result.degradedFinite,true,'malformed terrain samples fall back to a finite horizon normal');
 assert.equal(wetRefs.reducedWet.before,0,'the reduced-motion snap starts from a dry state');
 assert.equal(wetRefs.reducedWet.after,1,'reduced motion snaps to full wetness in one 16 ms update');
 assert.equal(wetRefs.reducedWet.visible,true,'reduced motion keeps the wet-reflection field visible');
 assert.ok(wetRefs.reducedWet.opacity>.3,'reduced motion reaches the rain sheen immediately ('+wetRefs.reducedWet.opacity.toFixed(3)+')');
 assert.ok(result.noon.poolOpacity<.01,'noon suppresses ground pools ('+result.noon.poolOpacity.toFixed(3)+')');
 assert.ok(result.dusk.poolOpacity>.25,'dusk ignites ground pools ('+result.dusk.poolOpacity.toFixed(3)+')');
 assert.ok(result.night.poolOpacity>.4,'night carries full ground pools ('+result.night.poolOpacity.toFixed(3)+')');
 assert.ok(result.rain.poolOpacity<result.dusk.poolOpacity*.7+1e-9,'rain damps ground pools ('+result.rain.poolOpacity.toFixed(3)+' vs '+result.dusk.poolOpacity.toFixed(3)+')');
 assert.ok(result.ash.poolOpacity<result.dusk.poolOpacity,'ash damps ground pools ('+result.ash.poolOpacity.toFixed(3)+')');
 assert.ok(result.poolPixels.changed>=100,'ground pools visibly change the dusk frame ('+result.poolPixels.changed+' px)');
 assert.ok(result.poolPixels.warm>=50,'ground pools lift the roadway with warm pixels ('+result.poolPixels.warm+' warm px)');
 assert.ok(result.poolPixels.ground>=50,'the warm pool lift lands on the road surface ('+result.poolPixels.ground+' px below the horizon)');
 assert.ok(result.noon.opacity<.01,'noon suppresses lamp halos ('+result.noon.opacity.toFixed(3)+')');
 assert.ok(result.dusk.opacity>.25,'dusk ignites lamp halos ('+result.dusk.opacity.toFixed(3)+')');
 assert.ok(result.night.opacity>.7,'night carries full practical glow ('+result.night.opacity.toFixed(3)+')');
 assert.ok(result.rain.opacity<result.dusk.opacity*.6+1e-9,'rain damps the practical glow ('+result.rain.opacity.toFixed(3)+' vs '+result.dusk.opacity.toFixed(3)+')');
 assert.ok(result.ash.opacity<result.dusk.opacity,'ash damps the practical glow ('+result.ash.opacity.toFixed(3)+')');
 assert.equal(result.reduced.visible,true,'reduced motion keeps the static practical glow');
 assert.ok(result.reduced.opacity>.7,'reduced motion keeps the night glow level');
 assert.equal(result.reduced.static,true,'reduced motion leaves halo positions static');
 assert.equal(result.reduced.poolVisible,true,'reduced motion keeps ground pools lit');
 assert.ok(result.reduced.poolOpacity>.5,'reduced motion keeps the night pool level');
 assert.equal(result.reduced.poolStatic,true,'reduced motion leaves ground pool geometry static');
 assert.ok(result.pixels.changed>=150,'the enabled field visibly changes the night frame ('+result.pixels.changed+' px)');
 assert.ok(result.pixels.warm>=50,'the field lifts the scene with warm pixels ('+result.pixels.warm+' warm px)');
 assert.ok(result.depthCulled>=100,'depth testing hides fixture and far-side halo ghosts ('+result.depthCulled+' px culled)');
 assert.equal(result.stateUntouched,true,'presentation halos do not touch world state');
 assert.equal(result.memoryStable,true,'lifecycle restarts publish a stable practical budget without GPU accumulation');
 assert.deepEqual(p.errors,[]);
 await new Promise(r=>setTimeout(r,250));
 await shot(p,'/tmp/hs-practicals.png');
 await p.evaluate(`(()=>{const b=${JSON.stringify(snapshot)};window.__renderWetHero({...b,conditions:{...b.conditions,weather:'rain',period:'dusk',clock:'19:15',daylight:.25,light:.8,ambient:1.05,visibility:.7,sky:0x4a3f42,fog:0x5e5049,sun:{x:-70,y:22,z:35}}})})()`);
 await new Promise(r=>setTimeout(r,250));await shot(p,'/tmp/hs-wet-reflections.png');
 console.log(JSON.stringify({points:total,noon:{halo:+result.noon.opacity.toFixed(3),pool:+result.noon.poolOpacity.toFixed(3)},dusk:{halo:+result.dusk.opacity.toFixed(3),pool:+result.dusk.poolOpacity.toFixed(3)},night:{halo:+result.night.opacity.toFixed(3),pool:+result.night.poolOpacity.toFixed(3)},rain:{halo:+result.rain.opacity.toFixed(3),pool:+result.rain.poolOpacity.toFixed(3)},ash:{halo:+result.ash.opacity.toFixed(3),pool:+result.ash.poolOpacity.toFixed(3)},reduced:{visible:result.reduced.visible,opacity:+result.reduced.opacity.toFixed(3),static:result.reduced.static,poolVisible:result.reduced.poolVisible,poolOpacity:+result.reduced.poolOpacity.toFixed(3),poolStatic:result.reduced.poolStatic},field:result.material,poolField:result.poolField,pixels:result.pixels,poolPixels:result.poolPixels,glints:{field:result.wetReflections.field,rainDusk:{opacity:+result.wetReflections.rainDusk.opacity.toFixed(3),wetness:+result.wetReflections.rainDusk.wetness.toFixed(3),visible:result.wetReflections.rainDusk.visible},rainNight:{opacity:+result.wetReflections.rainNight.opacity.toFixed(3)},noon:{opacity:+result.wetReflections.noon.opacity.toFixed(3),visible:result.wetReflections.noon.visible},mist:{opacity:+result.wetReflections.mist.opacity.toFixed(3),wetness:+result.wetReflections.mist.wetness.toFixed(3)},dry:{opacity:+result.wetReflections.dry.opacity.toFixed(3),visible:result.wetReflections.dry.visible},pixels:result.wetReflections.pixels,drawCalls:result.wetReflections.drawCalls,reducedWet:result.wetReflections.reducedWet},degradedFinite:result.degradedFinite,depthCulled:result.depthCulled,worlds:Object.fromEntries(Object.entries(result.worlds).map(([id,w])=>[id,{count:w.count,expected:w.expected,windows:w.authored.window,poolCount:w.poolCount,poolExpected:w.poolExpected,poolBaseError:w.poolBaseError,poolSlopeError:w.poolSlopeError,glintCount:w.glintCount,glintExpected:w.glintExpected,glintBaseError:w.glintBaseError,glintSlopeError:w.glintSlopeError,glintNormalYMin:w.glintNormalYMin,glintSteepCount:w.glintSteepCount,glintFinite:w.glintFinite,deterministic:w.deterministic,poolDeterministic:w.poolDeterministic,glintDeterministic:w.glintDeterministic}])),screenshots:['/tmp/hs-practicals.png','/tmp/hs-wet-reflections.png'],browserErrors:p.errors}));
 await p.evaluate("(()=>{const v=window.__practicalView;v.clear();v.renderer.dispose();document.getElementById('practicalsProbe').remove();delete window.__practicalView})()");
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
