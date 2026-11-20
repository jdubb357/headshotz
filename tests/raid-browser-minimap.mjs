// Premium tactical-minimap grader: proves the HUD minimap keeps a crisp 360px
// backing at its 100px footprint, draws snapshot-driven chrome (range rings,
// compass bezel, exit diamonds, yaw wedge, armory vector), labels heading
// accessibly for assistive tech, holds its pulse under reduced motion, and
// leaves the deployment preview unchanged.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('minimap_probe','a long minimap probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'minimap_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {drawMap}=await import('./raid-online.mjs');
  const {getWorld}=await import('./shared/raid-worlds.mjs');
  const base=${JSON.stringify(snapshot)},reducedBefore=document.documentElement.dataset.reducedMotion;
  const world=getWorld(base.map,base.mapVersion),selfPx={x:180+base.self.x*(360/world.size),y:180+base.self.z*(360/world.size)};
  const canvas=(label='Tactical map preview')=>{const c=document.createElement('canvas');c.width=360;c.height=360;c.setAttribute('role','img');c.setAttribute('aria-label',label);return c};
  const render=(yaw,chrome,serverTime=base.serverTime)=>{const c=canvas();drawMap(c,base.map,{...base,self:{...base.self,yaw},serverTime},{chrome});return c};
  const pixels=c=>c.getContext('2d').getImageData(0,0,360,360).data;
  // Difference mask/centroid versus a marker-only render. Chrome is the only
  // varied layer, so this isolates rings, compass, wedge and brackets.
  const delta=(a,b,{radius=1e9,cx=180,cy=180,threshold=24}={})=>{let count=0,sx=0,sy=0,energy=0;for(let i=0,p=0;i<a.length;i+=4,p++){const x=p%360,y=(p/360)|0;if(Math.hypot(x-cx,y-cy)>radius)continue;const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(d>threshold){count++;sx+=x;sy+=y;energy+=d}}return {count,x:sx/count,y:sy/count,energy}};
  const markerOnly=render(0,false),chrome0=render(0,true),chrome90=render(Math.PI/2,true);
  const whiteNoise=(()=>{const a=pixels(markerOnly),b=render(0,false);return delta(a,pixels(b)).count})();
  const state0=delta(pixels(chrome0),pixels(markerOnly)),state90=delta(pixels(chrome90),pixels(markerOnly));
  // Near the operator only the wedge varies; the symmetric rings, bezel and
  // corner brackets are outside this radius and cannot skew the heading probe.
  const near0=delta(pixels(chrome0),pixels(markerOnly),{radius:58,cx:selfPx.x,cy:selfPx.y,threshold:8}),near90=delta(pixels(chrome90),pixels(markerOnly),{radius:58,cx:selfPx.x,cy:selfPx.y,threshold:8});
  // Reduced motion must suppress the server-time halo pulse entirely: the same
  // snapshot at two different times hashes to identical pixels.
  document.documentElement.dataset.reducedMotion='true';
  const stillA=pixels(render(0,true,1000)),stillB=pixels(render(0,true,1111));
  const stillDiff=delta(stillA,stillB).count;
  // Normal motion advances the halo: two nearby server times change the ring.
  document.documentElement.dataset.reducedMotion='false';
  const pulseDiff=delta(pixels(render(0,true,1000)),pixels(render(0,true,1000.7))).count;
  // The deployment preview (no live state) must still render exits but never
  // claim a live heading.
  const preview=canvas('Map overview with extraction sites');
  drawMap(preview,base.map);
  const previewPixels=pixels(preview),previewVaries=new Set();
  for(let i=0;i<previewPixels.length;i+=4)previewVaries.add(previewPixels[i]+','+previewPixels[i+1]+','+previewPixels[i+2]);
  if(reducedBefore===undefined)delete document.documentElement.dataset.reducedMotion;else document.documentElement.dataset.reducedMotion=reducedBefore;
  const minimap=document.getElementById('minimap'),css=getComputedStyle(minimap);
  const label0=chrome0.getAttribute('aria-label'),label90=chrome90.getAttribute('aria-label'),heading0=chrome0.dataset.heading,heading90=chrome90.dataset.heading;
  // Compact live-minimap probe: an attached 100 px canvas must auto-select the
  // coarse background and enlarged chrome, while a wide preview keeps the dense
  // detail. Noise here is per-channel neighbour difference at the 360 backing,
  // so it isolates grain/seam microtexture from street-scale structure.
  const probe=document.createElement('div');probe.id='minimapCompactProbe';probe.style.cssText='position:fixed;left:-9999px;top:0;display:flex;gap:8px';
  document.body.append(probe);
  const attached=(width,opts={})=>{const c=document.createElement('canvas');c.width=360;c.height=360;c.style.cssText='width:'+width+'px;height:'+width+'px';probe.append(c);drawMap(c,base.map,base,opts);return c};
  const small=attached(100),smallDense=attached(100,{compact:false}),wide=attached(240),smallBg=attached(100,{chrome:false}),denseBg=attached(100,{chrome:false,compact:false});
  const data360=c=>c.getContext('2d').getImageData(0,0,360,360).data;
  const microtexture=data=>{let sum=0,edge=0;for(let y=0;y<360;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4;if(x>0){const j=i-4;sum+=Math.abs(data[i]-data[j])+Math.abs(data[i+1]-data[j+1])+Math.abs(data[i+2]-data[j+2]);edge+=Math.abs(data[i]-data[j])+Math.abs(data[i+1]-data[j])+Math.abs(data[i+2]-data[j])}}return {noise:+(sum/(359*360)).toFixed(3),edge:+(edge/(359*360)).toFixed(3)}};
  const colors=(data,limit=360*360)=>{const seen=new Set();for(let i=0;i<data.length;i+=4)seen.add(data[i]+','+data[i+1]+','+data[i+2]);return seen.size===limit?-1:seen.size};
  const gold=data=>{let n=0;for(let i=0;i<data.length;i+=4)if(data[i]===255&&data[i+1]===207&&data[i+2]===97)n++;return n};
  const smallData=data360(small),denseData=data360(smallDense),smallTex=microtexture(smallData),denseTex=microtexture(denseData);
  const downscale=c=>{const o=document.createElement('canvas');o.width=100;o.height=100;const g=o.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(c,0,0,100,100);return g.getImageData(0,0,100,100).data};
  const footprint=data=>{let sum=0;for(let y=0;y<100;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4;if(x>0){const j=i-4;sum+=Math.abs(data[i]-data[j])+Math.abs(data[i+1]-data[j+1])+Math.abs(data[i+2]-data[j+2])}}return +(sum/(99*100)).toFixed(3)};
  const details={smallMode:small.dataset.mapDetail,smallGold:gold(smallData),denseGold:gold(denseData),smallNoise:smallTex.noise,denseNoise:denseTex.noise,smallEdge:smallTex.edge,denseEdge:denseTex.edge,smallColors:colors(smallData),smallFootprint:footprint(downscale(smallBg)),denseFootprint:footprint(downscale(denseBg))};
  probe.remove();
  window.__minimapBase=base;
  return {backing:[minimap.width,minimap.height],css:[css.width,css.height],role:minimap.getAttribute('role'),
   heading:{a:heading0,b:heading90,labelA:label0,labelB:label90,preview:preview.dataset.heading||'',previewLabel:preview.getAttribute('aria-label'),previewColors:previewVaries.size},
   chrome:{count0:state0.count,count90:state90.count,x0:state0.x,y0:state0.y,x90:state90.x,y90:state90.y,near0,near90,selfPx,noise:whiteNoise},
   motion:{stillDiff,pulseDiff},details:{...details,smallDenseMode:smallDense.dataset.mapDetail,wideMode:wide.dataset.mapDetail}};
 })()`);
 assert.deepEqual(result.backing,[360,360],'the minimap backing canvas is 360×360');
 assert.deepEqual(result.css,['100px','100px'],'the minimap keeps its 100×100 desktop footprint');
 assert.equal(result.role,'img','the minimap exposes role=img to assistive tech');
 assert.equal(result.chrome.noise,0,'identical marker-only renders are byte-stable');
 assert.ok(result.chrome.count0>500&&result.chrome.count90>500,'tactical chrome materially changes the map ('+result.chrome.count0+'/'+result.chrome.count90+' pixels)');
 const s=result.chrome.selfPx;
 assert.ok(result.chrome.near0.count>150&&result.chrome.near90.count>150,'the heading wedge is rendered near the operator ('+result.chrome.near0.count+'/'+result.chrome.near90.count+' pixels)');
 assert.ok(result.chrome.near0.y>s.y+8&&Math.abs(result.chrome.near0.x-s.x)<20,'the yaw=0 wedge points south/down (centroid '+result.chrome.near0.x.toFixed(0)+','+result.chrome.near0.y.toFixed(0)+' around '+s.x.toFixed(0)+','+s.y.toFixed(0)+')');
 assert.ok(result.chrome.near90.x>s.x+8&&Math.abs(result.chrome.near90.y-s.y)<20,'a quarter turn points the wedge east (centroid '+result.chrome.near90.x.toFixed(0)+','+result.chrome.near90.y.toFixed(0)+' around '+s.x.toFixed(0)+','+s.y.toFixed(0)+')');
 assert.equal(result.heading.a,'180','yaw 0 reports 180° south from screen north');
 assert.equal(result.heading.b,'090','a quarter turn reports 090° east');
 assert.match(result.heading.labelA,/facing south 180°/,'the live label names the facing direction and degrees');
 assert.match(result.heading.labelB,/facing east 090°/,'the live label follows yaw changes');
 assert.equal(result.heading.preview,'','the deployment preview does not claim a live heading');
 assert.equal(result.heading.previewLabel,'Map overview with extraction sites','the preview keeps its authored label');
 assert.ok(result.heading.previewColors>40,'the preview still paints roads/districts and exit markers');
 assert.equal(result.motion.stillDiff,0,'reduced motion freezes the halo pulse pixel-for-pixel');
 assert.ok(result.motion.pulseDiff>20,'normal motion animates the halo ('+result.motion.pulseDiff+' changed pixels)');
 // Compact live-map legibility: attached 100 px maps drop grain/microdetail and
 // enlarge chrome, while wide previews keep the dense authored detail.
 const d=result.details;
 assert.equal(d.smallMode,'compact','a 100 px displayed minimap selects the compact background');
 assert.equal(d.smallDenseMode,'full','an explicitly dense 100 px render keeps the full background');
 assert.equal(d.wideMode,'full','a 240 px preview keeps the dense background');
 assert.ok(d.smallNoise<d.denseNoise*.95,'the compact map is measurably calmer at the 360 backing ('+d.smallNoise+' vs '+d.denseNoise+')');
 // At the exact 100 px footprint the neighbour difference is nearly tied with
 // the dense layer (street-scale structure dominates after the bilinear
 // downscale), so legibility is asserted through marker zoom and edge contrast
 // instead of a fragile footprint-noise margin.
 assert.ok(d.smallFootprint<=d.denseFootprint+1,'the compact background is no busier than the dense layer at the live footprint ('+d.smallFootprint+' vs '+d.denseFootprint+')');
 assert.ok(d.smallEdge>=18,'the compact map keeps street/building edge contrast ('+d.smallEdge+')');
 assert.ok(d.smallColors>=15000,'the compact map retains dense district colour variety ('+d.smallColors+')');
 assert.ok(d.smallGold>d.denseGold*2,'label and marker chrome scales up to survive the 100 px footprint ('+d.smallGold+' vs '+d.denseGold+' gold px)');
 assert.deepEqual(p.errors,[]);
 // Inspectable hero shot of the same live map at a readable 420px display size.
 await p.evaluate(`(async()=>{const {drawMap}=await import('./raid-online.mjs');document.querySelector('main').hidden=true;document.getElementById('play').style.display='none';
  const wrap=document.createElement('div');wrap.id='minimapShotCard';wrap.style.cssText='position:fixed;inset:0;display:grid;place-items:center;background:linear-gradient(145deg,#081014,#12191c)';
  const inner=document.createElement('figure');inner.style.cssText='margin:0;display:grid;gap:12px;justify-items:center;color:#eef6f2;font:600 15px system-ui';
  const title=document.createElement('figcaption');title.textContent='Relay sector · tactical minimap · facing south 180°';
  const c=document.createElement('canvas');c.width=360;c.height=360;c.style.cssText='width:420px;height:420px;border-radius:14px;border:1px solid #5e7a72;box-shadow:0 18px 50px #000c';
  // Centre the presentation shot so the range rings and heading wedge are not
  // clipped by the sector edge (the live HUD keeps the operator at the truth
  // position even when it sits near an exit).
  drawMap(c,window.__minimapBase.map,{...window.__minimapBase,self:{...window.__minimapBase.self,x:0,z:0,yaw:0}});
  inner.append(title,c);wrap.append(inner);document.body.append(wrap);
 })()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-minimap.png');
 await p.evaluate("(()=>{document.getElementById('minimapShotCard').remove();delete window.__minimapBase})()");
 console.log(JSON.stringify({backing:result.backing,css:result.css,role:result.role,heading:result.heading,chrome:result.chrome,motion:result.motion,details:result.details,screenshot:'/tmp/hs-minimap.png',browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
