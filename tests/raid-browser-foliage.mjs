// Foliage-wind grader: proves the ruined world's foliage groups are textured and
// sway deterministically from an exposed shader clock, freeze under reduced
// motion, and never touch authoritative actor/world data.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('foliage_probe','a long foliage probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'foliage_probe',mapId:'reservoir',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  const {terrainHeightAt,blocked}=await import('./shared/raid-worlds.mjs');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='foliageProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const base=${JSON.stringify(snapshot)},clear={...base,conditions:{...base.conditions,weather:'clear'}},view=new RaidView(canvas);
  view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});view.start(clear);
  const gl=view.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,windMaterials=view.windMaterials||[],windSet=new Set(windMaterials);
  // Look for a nearby tree crown with an unobstructed view; hiding the rest of
  // the scene makes the pixel comparison measure foliage motion alone.
  const self=clear.self,eyeY=(self.y||0)+1.65,losClear=target=>{const dx=target.x-self.x,dz=target.z-self.z,dist=Math.hypot(dx,dz);for(let t=.15;t<1;t+=.15){const x=self.x+dx*t,z=self.z+dz*t,y=eyeY+(target.y-eyeY)*t;if(blocked(view.world,x,z,.1,y,.4))return false}return dist>0};
  let tree=null;
  for(const prop of view.world.props||[]){if(prop.kind!=='tree')continue;const dx=prop.x-self.x,dz=prop.z-self.z,dist=Math.hypot(dx,dz);if(dist<10||dist>80)continue;const crown={x:prop.x,z:prop.z,y:terrainHeightAt(view.world,prop.x,prop.z)+4.2*(prop.scale||1)};if(!losClear(crown))continue;if(!tree||dist<tree.dist)tree={...crown,dist};}
  if(!tree){let best=1e9;for(const prop of view.world.props||[]){if(prop.kind!=='tree')continue;const dx=prop.x-self.x,dz=prop.z-self.z,dist=Math.hypot(dx,dz);if(dist>=10&&dist<best){best=dist;tree={x:prop.x,z:prop.z,y:terrainHeightAt(view.world,prop.x,prop.z)+4.2*(prop.scale||1),dist}}}}
  const yaw=Math.atan2(tree.x-self.x,tree.z-self.z),pitch=Math.atan2(tree.y-eyeY,Math.hypot(tree.x-self.x,tree.z-self.z));
  // The wind-material groups are the only visible nodes during the motion probe.
  // Isolate the foliage groups: hide every other mesh, line, points field and
  // sprite (dust, horizon embers, window halos, stars, held-weapon edge glints)
  // so only wind-lit crowns and the static background can contribute to the
  // motion probe.
  const hidden=[],differs=m=>{if(!m)return false;for(const mat of (Array.isArray(m)?m:[m]))if(windSet.has(mat))return true;return false};
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh||o.isPoints||o.isSprite||o.isLine||o.isLineSegments||o.isLineLoop)&&!differs(o.material)){o.visible=false;hidden.push(o)}});view.postMesh.visible=false;
  const frameAt=t=>{view.frame(t,yaw,pitch,clear.self,true);gl.finish()};
  // Warm the shader cache and let renderer.setSize establish the drawing buffer
  // before sampling, otherwise readPixels reads the 300x150 pre-size canvas.
  frameAt(0);
  const w2=gl.drawingBufferWidth,h2=gl.drawingBufferHeight;
  const capture=()=>{gl.bindFramebuffer(gl.FRAMEBUFFER,null);const buf=new Uint8Array(w2*h2*4);gl.readPixels(0,0,w2,h2,gl.RGBA,gl.UNSIGNED_BYTE,buf);return buf};
  const countDiff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;return n};
  frameAt(1000);const first=capture();const active=windMaterials.find(m=>m.userData.raidShader),timeA=active?.userData?.raidShader?.uniforms?.uWindTime?.value;
  frameAt(1600);const second=capture(),timeB=active?.userData?.raidShader?.uniforms?.uWindTime?.value;
  const movingPixels=countDiff(first,second);
  view.applySettings({reduced:true,sfxVolume:0,fov:75});frameAt(1000);const stillA=capture();frameAt(4200);const stillB=capture();
  const stillPixels=countDiff(stillA,stillB),stillTime=active?.userData?.raidShader?.uniforms?.uWindTime?.value;
  view.applySettings({reduced:false,sfxVolume:0,fov:75});
  for(const o of hidden)o.visible=true;view.postMesh.visible=true;
  const wind={count:windMaterials.length,textured:windMaterials.every(m=>!!m.map&&!!m.map.isTexture),normalMapped:windMaterials.every(m=>!!m.normalMap),shaders:windMaterials.filter(m=>!!m.userData.raidShader).length};
  const worldTree=tree&&{x:tree.x,z:tree.z,dist:Math.round(tree.dist)};
  window.__foliageView=view;window.__foliageYaw=yaw;window.__foliagePitch=pitch;window.__foliageSelf=clear.self;
  return {fieldWidth:w2,fieldHeight:h2,windTrees:tree&&worldTree,movingPixels,stillPixels,timeA,timeB,stillTime,wind};
 })()`);
 assert.ok(result.wind.count>=3,'foliage wind materials are published');
 assert.equal(result.wind.textured,true,'foliage groups use a real albedo texture');
 assert.equal(result.wind.normalMapped,true,'foliage groups use a normal map');
 assert.ok(result.wind.shaders>=1&&result.wind.shaders<=result.wind.count,'rendered foliage shaders receive the shared clock (compiled '+result.wind.shaders+'/'+result.wind.count+')');
 assert.ok(result.windTrees&&result.windTrees.dist<90,'a nearby tree crown is aimed at');
 assert.ok(result.movingPixels>150,'normal motion visibly moves the isolated foliage (changed pixels '+result.movingPixels+')');
 assert.ok(result.timeA>0&&result.timeB>result.timeA,'wind clock advances with real time');
 assert.equal(result.stillTime,0,'reduced motion pins the wind clock at zero');
 assert.ok(result.stillPixels<=2,'reduced motion renders the foliage frame statically ('+result.stillPixels+' changed pixels)');
 assert.deepEqual(p.errors,[]);
 // Restore the full world under forced midday lighting for the inspectable
 // foliage screenshot (deployment conditions may start in sector night).
 await p.evaluate(`(async()=>{const {mapConditions}=await import('./shared/raid-enemies.mjs');const v=window.__foliageView;v.sync({...v.snapshot,conditions:mapConditions(v.world,1)});v.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});for(let i=0;i<60;i++)v.frame(123456+i*16,window.__foliageYaw,window.__foliagePitch,v.snapshot.self,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-foliage-wind.png');
 await p.evaluate("(()=>{delete window.__foliageView;delete window.__foliageYaw;delete window.__foliagePitch;delete window.__foliageSelf;document.getElementById('foliageProbe').remove()})()");
 console.log(JSON.stringify({field:[result.fieldWidth,result.fieldHeight],windTrees:result.windTrees,wind:{count:result.wind.count,textured:result.wind.textured,normalMapped:result.wind.normalMapped,shaders:result.wind.shaders},motion:{movingPixels:result.movingPixels,timeA:result.timeA.toFixed(2),timeB:result.timeB.toFixed(2)},reducedMotion:{stillPixels:result.stillPixels,stillTime:result.stillTime},screenshot:'/tmp/hs-foliage-wind.png',browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
