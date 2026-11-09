// Offline raid scenery grader: builds all three raid environments through the
// production maps.js path and proves that the deterministic procedural
// undergrowth/ruins from raidScenery() are actually consumed offline.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const started=Date.now(),now=()=>1000+(Date.now()-started)/1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now});
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const screenshot=async(p,path)=>{const shot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(shot.data,'base64'))};
try{
 const p=await h.page('/raid-online.html');
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await p.wait("document.readyState==='complete'");
 const maps=await p.evaluate(`(async()=>{const m=await import('./maps.js'),worlds=await import('./shared/raid-worlds.mjs');
  const builds=m.RAID_MAPS.map((map,i)=>({map,b:m.buildMap(map.index),w:worlds.RAID_WORLDS[i]}));
  window.__sceneryBuilds=builds;window.__sceneryWorlds=worlds;
  return builds.map(({map,b,w})=>({id:w.id,name:w.name,meta:b.group.userData.raidScenery,children:b.group.children.length,terrain:!!b.groundAt,blockCollision:b.cols.length}));})()`);
 assert.equal(maps.length,3,'all three raid sectors build through maps.js');
 for(const map of maps){
  assert.equal(map.children>1000,true,`${map.name} builds a populated offline sector`);
  assert.equal(map.terrain,true,`${map.name} offline sector is terrain-backed`);
  assert.ok(map.meta&&map.meta.count>=500,`${map.name} offline scenery is dense (${map.meta?.count})`);
  for(const kind of ['fern','shrub','stump','moss','ruin','rubble'])assert.ok(map.meta.kinds[kind]>0,`${map.name} offline scenery renders ${kind}`);
  assert.ok(map.blockCollision>0,`${map.name} offline collision data is preserved`);
 }
 await p.evaluate(`(async()=>{const THREE=await import('./lib/three.module.min.js');const canvas=document.createElement('canvas');canvas.id='sceneryEvidence';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';document.body.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  window.__sceneryEvidence={renderer,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,700),THREE};return true})()`);
 const shots=await p.evaluate(`(()=>{const e=window.__sceneryEvidence,THREE=e.THREE,worlds=window.__sceneryWorlds,out=[],ruins=[];
  for(let i=0;i<window.__sceneryBuilds.length;i++){const {b,w}=window.__sceneryBuilds[i],sc=worlds.raidScenery(w);
   let best=null;for(const p of sc){if(p.kind==='ruin'||p.kind==='rubble')continue;let n=0;for(const q of sc)if(q.kind!=='ruin'&&q.kind!=='rubble'&&Math.hypot(q.x-p.x,q.z-p.z)<24)n++;if(!best||n>best.n)best={p,n}}
   const t=best.p,ground=worlds.terrainHeightAt(w,t.x,t.z),ruinPts=sc.filter(p=>p.kind==='ruin'||p.kind==='rubble');
   let ruinBest=null;for(const p of sc){if(p.kind!=='ruin')continue;let n=0;for(const q of ruinPts)if(Math.hypot(q.x-p.x,q.z-p.z)<22)n++;if(!ruinBest||n>ruinBest.n)ruinBest={x:p.x,z:p.z,near:n,kind:'ruin'}}
   out.push({id:w.id,kind:t.kind,near:best.n,x:t.x,z:t.z,index:i,ground});
   if(ruinBest)ruins.push({id:w.id,x:ruinBest.x,z:ruinBest.z,near:ruinBest.near,index:i,height:2.4,dist:7});
  }
  window.__ruinShots=ruins;
  window.__sceneryRender=function(i,spot){const e=window.__sceneryEvidence,THREE=e.THREE,{b}=window.__sceneryBuilds[i],shot=spot||out[i];
   const scene=e.scene;while(scene.children.length)scene.remove(scene.children[0]);
   const def=b.def;scene.background=new THREE.Color(def.sky[1]);scene.fog=new THREE.Fog(def.fog[0],28,200);
   scene.add(b.group);if(b.sky)scene.add(b.sky);
   scene.add(new THREE.HemisphereLight(def.hemi[0],def.hemi[1],def.hemi[2]*2.2));
   const sun=new THREE.DirectionalLight(def.sun[0],def.sun[1]*2);sun.position.set(def.sun[2][0],def.sun[2][1],def.sun[2][2]).multiplyScalar(80);scene.add(sun);
   const ground=window.__sceneryWorlds.terrainHeightAt(window.__sceneryBuilds[i].w,shot.x,shot.z);
   const reach=shot.dist||10;e.camera.position.set(shot.x+reach,ground+(shot.height||5.5),shot.z+reach);e.camera.lookAt(shot.x,ground+1,shot.z);
   e.renderer.render(scene,e.camera);return true};
  return {out,ruins}})()`);
 assert.deepEqual(p.errors,[]);
 assert.ok(shots.out.every(s=>s.near>=3),'screenshot viewpoints select real scenery clusters');
 assert.equal(shots.ruins.length,3,'every sector supplies a ruin-focused evidence viewpoint');
 assert.ok(shots.ruins.every(s=>s.near>=2),'ruin evidence viewpoints select real ruined clusters');
 for(const shot of shots.out){await p.evaluate('window.__sceneryRender('+shot.index+','+JSON.stringify(shot)+')');await new Promise(r=>setTimeout(r,90));await screenshot(p,'/tmp/hs-scenery-'+shot.id+'.png');}
 for(const shot of shots.ruins){await p.evaluate('window.__sceneryRender('+shot.index+','+JSON.stringify(shot)+')');await new Promise(r=>setTimeout(r,90));await screenshot(p,'/tmp/hs-scenery-ruin-'+shot.id+'.png');}
 // Return to the supporting app UI after the offline evidence render.
 await p.evaluate("(()=>{const e=window.__sceneryEvidence;e.renderer.dispose();const c=document.getElementById('sceneryEvidence');if(c)c.remove();delete window.__sceneryEvidence;delete window.__sceneryBuilds;delete window.__sceneryWorlds;delete window.__ruinShots})()");
 console.log(JSON.stringify({maps:maps.map(m=>({id:m.id,scenery:m.meta.count,kinds:m.meta.kinds,children:m.children,terrain:m.terrain})),screenshots:[...shots.out.map(s=>'/tmp/hs-scenery-'+s.id+'.png'),...shots.ruins.map(s=>'/tmp/hs-scenery-ruin-'+s.id+'.png')],ruinClusters:shots.ruins.map(s=>({id:s.id,near:s.near})),browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
