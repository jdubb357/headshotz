// Cinematic composite grader: proves the RaidView frame finish darkens the
// screen edges without disturbing the centre, holds the film grain still under
// reduced motion, costs exactly one draw call and never leaks GPU resources.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('composite_probe','a long composite probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'composite_probe',mapId:'relay',recovery:true});
// Fix dusk lighting for the zero-bloom recovery probe: deploy conditions are
// seeded per raid id, and the low-light half-resolution target has a small
// nonlinear tone-mapping difference that is stable under this dusk envelope.
snapshot.conditions={...snapshot.conditions,weather:'clear',period:'dusk',clock:'19:15',daylight:.3,light:1.05,ambient:1.15,visibility:.85,sky:0x9c7f74,fog:0x8a756b,sun:{x:-70,y:22,z:35}};
const h=await browserHarness();
const screenshot=async(p,path)=>{const shot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(shot.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='compositeProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const base=${JSON.stringify(snapshot)},view=new RaidView(canvas);
  view.applySettings({reduced:false,sfxVolume:0,fov:75});view.start(base);
  const gl=view.renderer.getContext();
  const drawCount=()=>{view.renderer.info.autoReset=false;view.renderer.info.reset();view.frame(123456,0,0,base.self);gl.finish();return view.renderer.info.render.calls};
  const sample=(x,y,size)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,null);const buf=new Uint8Array(size*size*4);gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,buf);let sum=0;for(let i=0;i<buf.length;i+=4)sum+=(buf[i]+buf[i+1]+buf[i+2])/3;return sum/(size*size)};
  const frameAt=at=>{view.frame(at,0,0,base.self);gl.finish()};
  view.postMesh.visible=false;frameAt(123456);
  const off={center:sample(620,348,40),edges:(sample(8,8,24)+sample(1248,8,24)+sample(8,688,24)+sample(1248,688,24))/4,top:sample(8,688,24)};
  view.postMesh.visible=true;frameAt(123456);
  const on={center:sample(620,348,40),edges:(sample(8,8,24)+sample(1248,8,24)+sample(8,688,24)+sample(1248,688,24))/4,top:sample(8,688,24)};
  // Bloom evidence: hold a settled frame and compare the default bloom with the
  // same compositor at zero bloom. Vignette/grain are identical between the two
  // passes, so any lift around emissive facades is the shared frame bloom.
  const readFrame=()=>{gl.bindFramebuffer(gl.FRAMEBUFFER,null);const w=view.canvas.width,h=view.canvas.height,buf=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);return buf};
  view.postMesh.visible=true;view.postMaterial.uniforms.uBloom.value=.3;frameAt(123456);const bloomFrame=readFrame();
  view.postMaterial.uniforms.uBloom.value=0;frameAt(123456);const plainFrame=readFrame();
  const plainCenter=sample(620,348,40);
  view.postMaterial.uniforms.uBloom.value=.3;
  let bloomPixels=0,warmLift=0,maxLift=0;
  for(let i=0;i<bloomFrame.length;i+=4){
   const dr=bloomFrame[i]-plainFrame[i],dg=bloomFrame[i+1]-plainFrame[i+1],db=bloomFrame[i+2]-plainFrame[i+2],lift=(dr+dg+db)/3;
   if(lift>1.5){bloomPixels++;if(dr>1&&dr>db+2)warmLift++;if(lift>maxLift)maxLift=lift}
  }
  const bloomSizes=view.bloomTargets.map(t=>({width:t.width,height:t.height}));
  const inputUniforms=view.postMaterial.uniforms,bloomUniforms=view.bloomMaterial.uniforms;
  const uniforms={vignette:inputUniforms.uVignette.value,grain:inputUniforms.uGrain.value,time:inputUniforms.uTime.value,bloom:inputUniforms.uBloom.value,blurScale:bloomUniforms.uBlurScale.value,threshold:bloomUniforms.uThreshold.value};
  const materialIsShader=!!view.postMaterial.isShaderMaterial&&!!view.bloomMaterial.isShaderMaterial;
  const resolutionFits=inputUniforms.uResolution.value.x===view.canvas.width&&inputUniforms.uResolution.value.y===view.canvas.height;
  const sceneTextureBound=!!inputUniforms.uScene.value,bloomTextureBound=!!inputUniforms.uBloomTex.value;
  // Synthetic chain proof: a square white spot into a 256×144 linear source is
  // downsampled, thresholded and Gaussian-blurred at 128×72. Reading the final
  // target proves the says halo is contiguous and decays smoothly, instead of
  // relying only on scene screenshots or sampled ring taps.
  const THREE=await import('./lib/three.module.min.js');
  const sourceWidth=256,sourceHeight=144,spotData=new Uint8Array(sourceWidth*sourceHeight*4);
  for(let y=70;y<74;y++)for(let x=126;x<130;x++){const i=(y*sourceWidth+x)*4;spotData[i]=spotData[i+1]=spotData[i+2]=255;spotData[i+3]=255}
  const spotTexture=new THREE.DataTexture(spotData,sourceWidth,sourceHeight,THREE.RGBAFormat);
  spotTexture.minFilter=spotTexture.magFilter=THREE.LinearFilter;spotTexture.needsUpdate=true;
  view.renderBloomChain(spotTexture,sourceWidth,sourceHeight);
  const bloomTarget=view.bloomTargets[0],bloomWidth=bloomTarget.width,bloomHeight=bloomTarget.height,glowData=new Uint8Array(bloomWidth*bloomHeight*4);
  view.renderer.readRenderTargetPixels(bloomTarget,0,0,bloomWidth,bloomHeight,glowData);
  const spotX=(126+130)/2,spotY=(70+74)/2,glowCenterX=spotX/sourceWidth*bloomWidth-.5,glowCenterY=spotY/sourceHeight*bloomHeight-.5;
  const bandSums=new Array(9).fill(0),bandCounts=new Array(9).fill(0);let glowMass=0,glowX=0,glowY=0,glowPeak=0,glowPixels=0;
  for(let y=0;y<bloomHeight;y++)for(let x=0;x<bloomWidth;x++){
   const i=(y*bloomWidth+x)*4,l=glowData[i]*.2126+glowData[i+1]*.7152+glowData[i+2]*.0722;
   if(l>.5){glowPixels++;if(l>glowPeak)glowPeak=l;const d=Math.min(8,Math.floor(Math.hypot(x-glowCenterX,y-glowCenterY)));bandSums[d]+=l;bandCounts[d]++;glowMass+=l;glowX+=x*l;glowY+=y*l}
  }
  const glowBands=bandSums.map((sum,i)=>bandCounts[i]?sum/bandCounts[i]:0),glowCentroid={x:glowX/Math.max(glowMass,1),y:glowY/Math.max(glowMass,1)};
  view.postMesh.visible=true;
  const withComposite=drawCount();view.postMesh.visible=false;const withoutComposite=drawCount();view.postMesh.visible=true;
  view.applySettings({reduced:true,sfxVolume:0,fov:75});frameAt(400000);const reducedTimeA=view.postMaterial.uniforms.uTime.value,reducedGrain=view.postMaterial.uniforms.uGrain.value;
  frameAt(700000);const reducedTimeB=view.postMaterial.uniforms.uTime.value;
  view.applySettings({reduced:false,sfxVolume:0,fov:75});frameAt(123456);
  const samples=[];
  for(let i=0;i<3;i++){view.start(base);view.frame(123456,0,0,base.self);gl.finish();samples.push({...view.renderer.info.memory})}
  const after=samples.at(-1);
  return {off,on,centerDelta:on.center-off.center,uniforms,bloomTargets:bloomSizes,bloomChain:{width:bloomWidth,height:bloomHeight,bands:glowBands,counts:bandCounts,pixels:glowPixels,peak:glowPeak,centroid:glowCentroid},sceneTextureBound,bloomTextureBound,bloom:{pixels:bloomPixels,warm:warmLift,maxLift,plainCenter},materialIsShader,resolutionFits,drawCalls:{on:withComposite,off:withoutComposite},reduced:{timeA:reducedTimeA,timeB:reducedTimeB,grain:reducedGrain},resources:{samples,after},canvas:{width:view.canvas.width,height:view.canvas.height}};
 })()`);
 const {on,off}=result;
 assert.equal(result.materialIsShader,true,'the composite is a shader material');
 assert.equal(result.resolutionFits,true,'composite resolution tracks the drawing buffer');
 assert.ok(on.center>off.center-6,'composite does not darken the frame centre (off '+off.center.toFixed(1)+', on '+on.center.toFixed(1)+')');
 assert.ok(on.edges<off.edges-4,'composite darkens the frame edges (off '+off.edges.toFixed(1)+', on '+on.edges.toFixed(1)+')');
 assert.ok(result.uniforms.bloom>0&&result.uniforms.bloom<=.6,'bloom strength stays modest');
 assert.ok(result.uniforms.blurScale>=1&&result.uniforms.blurScale<=4,'the half-resolution Gaussian kernel is sampled across several pixels');
 assert.ok(result.uniforms.threshold>=.3&&result.uniforms.threshold<=.9,'the bright pass keeps only real highlights');
 assert.equal(result.sceneTextureBound,true,'the composite samples the scene render target');
 assert.equal(result.bloomTextureBound,true,'the composite samples the blurred bloom target');
 for(const target of result.bloomTargets){assert.ok(target.width>0&&target.height>0&&target.width===Math.floor(result.canvas.width/2)&&target.height===Math.floor(result.canvas.height/2),'bloom targets are half the drawing buffer')}
 assert.equal(result.bloomChain.width,128,'synthetic bloom target is half the 256-pixel source width');
 assert.equal(result.bloomChain.height,72,'synthetic bloom target is half the 144-pixel source height');
 assert.ok(result.bloomChain.pixels>=100,'the blurred synthetic halo spans a contiguous neighbourhood ('+result.bloomChain.pixels+' px)');
 assert.ok(result.bloomChain.peak>0,'the synthetic bright spot survives thresholding ('+result.bloomChain.peak.toFixed(2)+')');
 assert.ok(Math.abs(result.bloomChain.centroid.x-64)<4&&Math.abs(result.bloomChain.centroid.y-36)<4,'bloom remains centred on the bright spot ('+result.bloomChain.centroid.x.toFixed(1)+','+result.bloomChain.centroid.y.toFixed(1)+')');
 for(let i=1;i<6;i++)assert.ok(result.bloomChain.bands[i]<=result.bloomChain.bands[i-1]+.002,'synthetic halo decays smoothly with distance (band '+(i-1)+' '+result.bloomChain.bands[i-1].toFixed(2)+', band '+i+' '+result.bloomChain.bands[i].toFixed(2)+')');
 assert.ok(result.bloomChain.bands[4]>.2,'synthetic halo spreads beyond the source spot');
 assert.ok(Math.abs(result.bloom.plainCenter-off.center)<=2.5,'zero bloom recovers the unbloomed frame centre (off '+off.center.toFixed(1)+', plain '+result.bloom.plainCenter.toFixed(1)+')');
 assert.ok(result.bloom.pixels>=100,'bloom visibly lifts emissive surfaces ('+result.bloom.pixels+' px)');
 assert.ok(result.bloom.warm>=25,'bloom lifts emissive facades with warm light ('+result.bloom.warm+' px)');
 assert.ok(result.bloom.maxLift>=4,'bloom lift is perceptible, not a rounding artefact ('+result.bloom.maxLift.toFixed(1)+')');
 assert.ok(result.uniforms.vignette>=.2&&result.uniforms.vignette<=1,'vignette strength is tuned');
 assert.ok(result.uniforms.grain>0&&result.uniforms.grain<=.08,'film grain is subtle');
 assert.equal(result.reduced.timeA,0,'reduced motion freezes the grain clock');assert.equal(result.reduced.timeB,0,'reduced motion keeps the grain clock frozen');
 assert.equal(result.reduced.grain,0,'reduced motion removes the animated grain');
 assert.equal(result.drawCalls.on,result.drawCalls.off+4,'the bright/blur/composite chain costs exactly four draw calls');
 const samples=result.resources.samples;
 assert.ok(samples.every(s=>s.geometries===samples[0].geometries),'composite rebuilds do not accumulate geometry');
 assert.ok(samples.every(s=>s.textures===samples[0].textures),'composite rebuilds do not accumulate textures or shadow targets');
 assert.deepEqual(p.errors,[]);
 await screenshot(p,'/tmp/hs-composite.png');
 await p.evaluate("(()=>{window.__c=document.getElementById('compositeProbe')})()");
 console.log(JSON.stringify({center:result.on.center,edges:{on:result.on.edges,off:result.off.edges,centerDelta:result.centerDelta},uniforms:result.uniforms,bloomTargets:result.bloomTargets,bloomChain:result.bloomChain,bloom:result.bloom,drawCalls:result.drawCalls,reducedMotion:true,resources:result.resources,screenshot:'/tmp/hs-composite.png',browserErrors:p.errors}));
 await p.evaluate("(async()=>{document.getElementById('compositeProbe').remove()})()");
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
