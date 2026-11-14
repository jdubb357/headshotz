// Held-rifle exposure grader for DIRECTOR_NOTES item 5 (weapon half). Serves
// the shipped offline raid client as static Pages files, pins the deterministic
// clear-noon spawn street, and proves the photoscanned viewmodel no longer
// renders as a baked-black cut-out:
//   1. the scan's own albedo map is sampled and its linear mean is very dark
//      (the photogrammetry master sheet really is ~58/58/58 sRGB);
//   2. the per-material worn-metal gain lifts that map into a mid-grey band and
//      metalness/roughness/env map are opened up so the receiver, grip and
//      stock catch the overlay's real key/rim lights;
//   3. the same treatment lands on every scan slot (30/30 AR has three), not
//      just the first; no pure-black or blown-white effective albedo remains;
//   4. 1024x720 and 844x390 render the actual gameplay frame without browser
//      errors, with screenshots written for review.
// Presentation only: no rule, collision, UI, server, audio or mode change.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const MIME={'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.bin':'application/octet-stream','.gltf':'application/gltf+json'};
async function staticServer(){
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/api/')){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({error:'static'}));return}
   const requested=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
   const file=resolve(ROOT,'.'+requested);
   if(file!==ROOT&&!(file+'/').startsWith(ROOT+'/'))throw new Error('escape');
   const content=await readFile(file);
   res.writeHead(200,{'content-type':MIME[extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-cache'});
   res.end(content);
  }catch{res.writeHead(404,{'content-type':'text/plain'});res.end('Not found')}
 });
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const world=RAID_WORLDS.find(w=>w.id==='relay');
const plan={version:1,startHour:12,hoursPerRaid:0,duration:600,weatherSeed:0,frontAt:3000};
const noon=conditionsAt(world,plan,0);
assert.equal(noon.period,'day');
const {server,url}=await staticServer();
process.env.RAID_TEST_URL=url;
const harness=await browserHarness();
async function stage(page,width,height){
 await page.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await page.wait('!!window.__hsz?.raid');
 await page.evaluate("document.getElementById('raidBtn').click()");
 await page.wait("location.pathname==='/raid-online.html' && new URLSearchParams(location.search).get('offline')==='1'");
 await page.wait("document.body.dataset.raidTransport==='offline'");
 await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await page.wait("!!window.__hszOfflineRaid && window.__hszOfflineRaid.mode==='offline'");
 await page.evaluate(`(async()=>{const {RaidView}=await import('./raid-view.mjs');const start=RaidView.prototype.start;RaidView.prototype.start=function(...args){const result=start.apply(this,args);window.__raidView=this;return result}})()`);
 await page.wait("!!document.querySelector('#stash input[data-equip]')");
 await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
 await page.evaluate("document.getElementById('deploy').click()");
 await page.wait("document.getElementById('play').style.display==='block'");
 await page.wait("document.body.getAttribute('aria-busy')==='false'");
 await page.wait('!!window.__raidArt?.humans===true && !!window.__raidView?.environmentRoot');
 await sleep(400);
 // Stable dusk-free noon street and spawn camera, shared with the ground
 // finish grader so before/after frames compare like for like.
 await page.evaluate(`(()=>{
  const rt=window.__hszOfflineRaid.runtime(),p=rt.raids.byAccount.get(rt.account),r=rt.raids.raids.get(p.raidId);
  r.conditionPlan=${JSON.stringify(plan)};
  r.conditionsSecond=-1;r.weatherAt=0;
  r.conditions=${JSON.stringify(noon)};
  r.lastLightPhase='day';
  p.x=-601;p.z=-596;p.y=0;p.yaw=0.72;p.pitch=-0.02;
 })()`);
 await page.command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});
 await sleep(220);
 await page.command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 await page.wait("(()=>{const c=window.__hszOfflineRaid.snapshot()?.conditions;return !!c&&c.period==='day'&&c.weather==='clear'&&c.clock==='12:00'})()");
 await sleep(1200);
}
const sampleMaterial=async page=>page.evaluate(`(()=>{
 const v=window.__raidView,out=[],seen=new Set();
 const sample=tex=>{
  if(!tex||!tex.image)return null;
  const img=tex.image,c=document.createElement('canvas');c.width=16;c.height=16;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,img.width||16,img.height||16,0,0,16,16);
  const d=ctx.getImageData(0,0,16,16).data;
  let sum=0;
  for(let i=0;i<d.length;i+=4)sum+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
  const srgb=sum/(d.length/4)/255;
  return {sRGB:+(srgb*255).toFixed(1),linear:+((srgb<=.04045?srgb/12.92:Math.pow((srgb+.055)/1.055,2.4))).toFixed(4)};
 };
 if(!v.gun)return {mats:out,meshes:0,visible:false};
 v.gun.traverse(n=>{
  if(!n.isMesh||seen.has(n.material))return;
  seen.add(n.material);const m=n.material,avg=sample(m.map);
  out.push({name:m.name,metalness:m.metalness,roughness:m.roughness,envMapIntensity:m.envMapIntensity,color:{r:m.color.r,g:m.color.g,b:m.color.b},albedo:avg,
   effective:avg?+(avg.linear*m.color.r*(1-m.metalness*.83)).toFixed(4):null});
 });
 return {mats:out,meshes:seen.size,visible:!!v.gunRoot?.visible,rootVisible:!!v.gunRoot?.visible};
})()`);
try{
 const page=await harness.page('/');
 await stage(page,1024,720);
 const gun=await sampleMaterial(page);
 assert.ok(gun.visible,'the first-person rifle root is visible at deploy');
 assert.ok(gun.meshes>=1,`the held rifle is real scan geometry (${gun.meshes} material groups)`);
 assert.ok(gun.mats.length===gun.meshes,'one inspected material per held scan mesh');
 // 1. The scan's baked albedo really is near-black; this is why the old shader
 //    flattened it to a silhouette rather than a rifle.
 assert.ok(gun.mats.every(m=>m.albedo&&m.albedo.sRGB<70),`scan albedo map stays the dark photogrammetry sheet (${gun.mats[0]?.albedo?.sRGB})`);
 // 2. Every held scan material is lifted into the worn-metal band and opened
 //    for the overlay key/rim lights instead of staying pure metalness-1.
 for(const m of gun.mats){
  assert.ok(m.envMapIntensity>=1.1,`${m.name} keeps photo-IBL (${m.envMapIntensity})`);
  assert.ok(m.metalness>=.15&&m.metalness<=.5,`${m.name} metalness opened to ${m.metalness}`);
  assert.ok(m.roughness>=.4&&m.roughness<=.8,`${m.name} roughness worn to ${m.roughness}`);
  assert.ok(m.effective>=.06&&m.effective<=.28,`${m.name} effective albedo stays worn mid-grey (${m.effective})`);
  assert.ok(m.color.r>1,`${m.name} carries the sampled lift gain instead of the old crushed tint (${m.color.r.toFixed(2)})`);
 }
 const shot1024=await page.command('Page.captureScreenshot',{format:'png'});
 await writeFile('/tmp/headshotz-gunlight-1024.png',Buffer.from(shot1024.data,'base64'));
 // Action frame: a real trigger press so recoil and muzzle flash land on the
 // lifted receiver instead of a black cut-out.
 await page.command('Input.dispatchMouseEvent',{type:'mousePressed',x:512,y:360,button:'left',clickCount:1});
 await sleep(60);
 const action=await page.command('Page.captureScreenshot',{format:'png'});
 await writeFile('/tmp/headshotz-gunlight-1024-action.png',Buffer.from(action.data,'base64'));
 await page.command('Input.dispatchMouseEvent',{type:'mouseReleased',x:512,y:360,button:'left',clickCount:1});
 // 3. The same worn-metal pass at the phone-landscape viewport.
 await page.command('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});
 await sleep(500);
 const mobile=await sampleMaterial(page);
 assert.equal(mobile.meshes,gun.meshes,'the same scanned rifle material groups survive the viewport change');
 assert.ok(mobile.mats.every(m=>m.effective>=.06&&m.effective<=.28),'phone viewport keeps the worn mid-grey albedo');
 const shot844=await page.command('Page.captureScreenshot',{format:'png'});
 await writeFile('/tmp/headshotz-gunlight-844.png',Buffer.from(shot844.data,'base64'));
 assert.deepEqual(page.errors,[],'no browser errors during the held-rifle frames');
 console.log(JSON.stringify({materials:gun.mats,meshes:gun.meshes,viewport:'1024x720 + 844x390',shots:['/tmp/headshotz-gunlight-1024.png','/tmp/headshotz-gunlight-1024-action.png','/tmp/headshotz-gunlight-844.png'],browserErrors:page.errors}));
}finally{
 await harness.close();
 await server.close();
}
