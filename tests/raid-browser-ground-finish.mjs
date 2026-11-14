// Ground-finish grader for DIRECTOR_NOTES item 4. Serves the game as plain
// static Pages files (no Node API), deploys the shipped offline raid client,
// pins the deterministic clear-noon condition, then measures four
// presentation-only criteria in the actual gameplay frame:
//   1. street slabs keep a mid-tone tone-down instead of a bare white tint,
//      and bright pavement pixels stay below clipping;
//   2. real curb meshes are instanced along the road/sidewalk edge with a
//      visible vertical face;
//   3. near-spawn shrub/fern/grass coverage is materially denser than the
//      previous pass and seated on the drawn terrain;
//   4. two to four near-full-size scanned tree_small_02 trees are placed at
//      the spawn, with at least two projecting inside the opening view.
// Presentation only: no collision, rule, UI or server state is changed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {browserHarness} from './browser-harness.mjs';
import {conditionsAt} from '../shared/raid-conditions.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const MIME={'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.bin':'application/octet-stream','.gltf':'model/gltf+json'};

// Minimal PNG decoder (8-bit RGB/RGBA, filters 0-4). Runs the same pixels the
// player would see, so the grader can refuse a clipped white pavement sheet.
function decodePNG(buf){
 if(buf.readUInt32BE(0)!==0x89504e47)throw new Error('not png');
 let off=8,ihdr=null,idats=[];
 while(off<buf.length){
  const len=buf.readUInt32BE(off),type=buf.toString('ascii',off+4,off+8),data=buf.subarray(off+8,off+8+len);
  if(type==='IHDR')ihdr={w:data.readUInt32BE(0),h:data.readUInt32BE(4),depth:data[8],color:data[9],interlace:data[12]};
  else if(type==='IDAT')idats.push(data);
  else if(type==='IEND')break;
  off+=12+len;
 }
 if(!ihdr||ihdr.depth!==8||(ihdr.color!==6&&ihdr.color!==2))throw new Error('unsupported png');
 const ch=ihdr.color===6?4:3,stride=ihdr.w*ch,raw=inflateSync(Buffer.concat(idats)),out=Buffer.alloc(ihdr.h*stride);
 let pos=0;
 for(let y=0;y<ihdr.h;y++){
  const filter=raw[pos++],row=raw.subarray(pos,pos+stride),dest=out.subarray(y*stride,(y+1)*stride);pos+=stride;
  for(let x=0;x<stride;x++){
   const a=x>=ch?dest[x-ch]:0,b=y>0?out[(y-1)*stride+x]:0,c=y>0&&x>=ch?out[(y-1)*stride+x-ch]:0;
   const v=row[x];
   if(filter===0)dest[x]=v;
   else if(filter===1)dest[x]=(v+a)&255;
   else if(filter===2)dest[x]=(v+b)&255;
   else if(filter===3)dest[x]=(v+((a+b)>>1))&255;
   else if(filter===4){const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);dest[x]=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255}
  }
 }
 return {width:ihdr.w,height:ihdr.h,channels:ch,data:out};
}
const pixelSum=(png,x,y)=>{if(x<0||y<0||x>=png.width||y>=png.height)return null;const i=(y*png.width+x)*png.channels;return png.data[i]+png.data[i+1]+png.data[i+2]};
const pavementMetrics=(png,samples)=>{let max=0,sum=0,n=0,clip=0;const by={streetRoad:{sum:0,n:0,max:0},streetSidewalk:{sum:0,n:0,max:0}};
 for(const s of samples){const v=pixelSum(png,s.x,s.y);if(v==null)continue;const b=by[s.tag]||null;if(b){b.sum+=v;b.n++;if(v>b.max)b.max=v}sum+=v;n++;if(v>max)max=v;if(v>=745)clip++}
 return {max,mean:n?sum/n:0,clip,n,by};
};

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
assert.equal(noon.clock,'12:00');

const {server,url}=await staticServer();
process.env.RAID_TEST_URL=url;
const harness=await browserHarness();
try{
 const page=await harness.page('/');
 await page.command('Emulation.setDeviceMetricsOverride',{width:1024,height:720,deviceScaleFactor:1,mobile:false});
 await page.wait('!!window.__hsz?.raid');
 await page.evaluate("document.getElementById('raidBtn').click()");
 await page.wait("location.pathname==='/raid-online.html' && new URLSearchParams(location.search).get('offline')==='1'");
 await page.wait("document.body.dataset.raidTransport==='offline'");
 await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await page.wait("!!window.__hszOfflineRaid && window.__hszOfflineRaid.mode==='offline'");
 // Patch on the raid page before deploy instantiates RaidView. A patch on the
 // hub realm is not carried across to raid-online.html.
 await page.evaluate(`(async()=>{const {RaidView}=await import('./raid-view.mjs');const start=RaidView.prototype.start;RaidView.prototype.start=function(...args){const result=start.apply(this,args);window.__raidView=this;return result}})()`);
 await page.wait("!!document.querySelector('#stash input[data-equip]')");
 await page.evaluate("document.querySelector('#stash input[data-equip]').click()");
 await page.evaluate("document.getElementById('deploy').click()");
 await page.wait("document.getElementById('play').style.display==='block'");
 await page.wait("document.body.getAttribute('aria-busy')==='false'");
 await page.wait("!!window.__hszOfflineRaid.snapshot()");
 await page.wait('window.__raidArt?.humans===true');
 await page.wait('!!window.__raidView?.environmentRoot');
 await sleep(400);
 // Pin noon and stage the spawn street. The action ack from a real KeyW press
 // forces the client snapshot to refresh, so the frame really renders noon.
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

 const fixture=await page.evaluate(`(async()=>{
  const THREE=await import('./lib/three.module.min.js');
  const {HQP}=await import('./assets.js');
  const v=window.__raidView,root=v.environmentRoot,spawn=(v.world.spawns||[[-600,-600]])[0];
  const slabs=[];
  for(const mat of root.userData.materials?.values()||[])if(mat.userData.raidStructure==='streetRoad'||mat.userData.raidStructure==='streetSidewalk')slabs.push({tag:mat.userData.raidStructure,color:mat.color.getHex(),authored:mat.userData.raidAuthoredColor});
  const curbMeshes=[];
  root.traverse(o=>{if(!o.isInstancedMesh||!/^streetCurb/.test(o.userData.raidStructure||''))return;const m=o.instanceMatrix.array,sy=Math.hypot(m[4],m[5],m[6]);curbMeshes.push({tag:o.userData.raidStructure,count:o.count,visible:o.visible,height:sy,baseY:m[13]-sy/2,topY:m[13]+sy/2})});
  const sites=root.userData.raidNatureSites||[];
  const near=sites.filter(s=>Math.hypot(s.x-spawn[0],s.z-spawn[1])<=38);
  const nearCounts=near.reduce((a,s)=>(a[s.kind]=(a[s.kind]||0)+1,a),{});
  const terrain=root.children.find(n=>n.isMesh&&n.material===v.terrainMaterial&&n.geometry?.attributes?.position?.count>1000);
  const meshY=(x,z)=>{if(!terrain)return null;const pos=terrain.geometry.attributes.position.array,segments=160,span=v.world?.size||1440,step=span/segments,half=span/2,verts=segments+1,fx=(x+half)/step,fz=(z+half)/step,i=Math.floor(fx),j=Math.floor(fz);if(i<0||j<0||i>=segments||j>=segments)return null;const tx=fx-i,tz=fz-j,at=(ii,jj)=>(jj*verts+ii)*3+1;const ha=pos[at(i,j)],hc=pos[at(i+1,j)],hb=pos[at(i,j+1)],he=pos[at(i+1,j+1)];return tx+tz<=1?ha*(1-tx-tz)+hc*tx+hb*tz:hc*(1-tz)+hb*(1-tx)+he*(tx+tz-1)};
  const seat={sampled:0,floating:0,worst:0};
  if(v.natureRoot)v.natureRoot.traverse(o=>{if(!o.isInstancedMesh)return;const kind=o.userData.raidNature;if(!['shrub','fern','grass','tree'].includes(kind))return;const m=o.instanceMatrix.array;for(let i=0;i<o.count;i++){const x=m[i*16+12],y=m[i*16+13],z=m[i*16+14];if(Math.hypot(x-spawn[0],z-spawn[1])>38)continue;const g=meshY(x,z);if(g==null)continue;seat.sampled++;const err=Math.abs(y-g);if(err>.06)seat.floating++;if(err>seat.worst)seat.worst=err}});
  const trees=(root.userData.raidSpawnTrees||[]).filter(t=>t.spawnIndex===0);
  const cam=v.renderCamera||v.camera;cam.updateMatrixWorld();
  const projected=trees.map(t=>{const p=new THREE.Vector3(t.x,t.y+t.s*5.2*0.5,t.z).project(cam);return {inFrame:p.z<1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1,ndcX:p.x,ndcY:p.y,s:t.s,x:t.x,z:t.z}});
  // Pavement pixel points: raycast the full environment so only the first
  // (unoccluded) surface counts, and keep points where that surface is a real
  // street slab. A stride of 10 keeps the full-scene cast inside the browser
  // command budget while still sampling hundreds of visible pavement pixels.
  const pavRay=new THREE.Raycaster(),samples=[],pavT0=performance.now();
  for(let y=Math.round(innerHeight*.56);y<Math.round(innerHeight*.80);y+=10)for(let x=Math.round(innerWidth*.20);x<Math.round(innerWidth*.74);x+=10){
   pavRay.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),cam);
   const first=pavRay.intersectObject(root,true)[0];
   const tag=first?.object?.userData?.raidStructure;
   if(tag==='streetRoad'||tag==='streetSidewalk')samples.push({x,y,tag});
  }
  return {wall:{x:innerWidth,y:innerHeight},slabs,curbMeshes,trees,projected,seat:{...seat,worst:+seat.worst.toFixed(3)},nearCounts,totalNear:near.length,samples:samples.slice(0,4000),asset:{url:HQP.nature?.tree?.source,height:HQP.nature?.tree?.height}};
 })()`);
 const shot=await page.command('Page.captureScreenshot',{format:'png'});
 await writeFile('/tmp/headshotz-ground-finish-1024.png',Buffer.from(shot.data,'base64'));
 const png=decodePNG(Buffer.from(shot.data,'base64'));
 const pm=pavementMetrics(png,fixture.samples||[]);

 assert.deepEqual(page.errors,[],'no browser errors during the ground-finish frame');
 assert.equal(fixture.wall.x,1024);assert.equal(fixture.wall.y,720);
 assert.match(fixture.asset.url||'',/tree_small_02\.glb$/,'spawn trees use the real scanned tree asset');
 assert.equal(fixture.asset.height,5.2);

 // 1. Tone-down slab material instead of a pure white tint, mid-tone pavement
 //    pixels, zero pure-white clipping.
 const slab=p=>fixture.slabs.find(s=>s.tag===p);
 const road=slab('streetRoad'),walk=slab('streetSidewalk');
 assert.ok(road,'road slab material exists');
 assert.ok(walk,'sidewalk slab material exists');
 const lum=hex=>{const r=((hex>>16)&255)/255,g=((hex>>8)&255)/255,b=(hex&255)/255;return .2126*r+.7152*g+.0722*b};
 assert.ok(road.color!==0xffffff&&walk.color!==0xffffff,'street slabs skip the bare white tint');
 assert.ok(lum(road.color)<.93&&lum(walk.color)<.93,'slab tone-down keeps pavement below peak white');
 assert.notEqual(road.color,road.authored,'road photo tint is independently toned down');
 assert.notEqual(walk.color,walk.authored,'sidewalk photo tint is independently toned down');
 assert.ok(pm.n>=500,'enough unoccluded pavement pixels sampled');
 assert.ok(pm.by.streetRoad.n>0&&pm.by.streetSidewalk.n>0,'road and sidewalk samples both present');
 assert.equal(pm.clip,0,'no pavement pixel clips to pure white');
 assert.ok(pm.max<=700,`pavement peak stays below clipping (max ${pm.max})`);
 const roadMean=pm.by.streetRoad.sum/pm.by.streetRoad.n,walkMean=pm.by.streetSidewalk.sum/pm.by.streetSidewalk.n;
 assert.ok(roadMean>=300&&roadMean<=520,`road stays photographed mid-tone (mean ${roadMean.toFixed(1)})`);
 assert.ok(walkMean>=300&&walkMean<=520,`sidewalk stays photographed mid-tone (mean ${walkMean.toFixed(1)})`);

 // 2. Real curbs: instanced raised strips with a visible vertical face.
 const base=fixture.curbMeshes.find(m=>m.tag==='streetCurb'),top=fixture.curbMeshes.find(m=>m.tag==='streetCurbTop');
 assert.ok(base&&top,'curb body and curb top meshes exist');
 assert.ok(base.visible&&top.visible,'curbs are visible');
 assert.ok(base.count>=100,'curbs are instanced along the road network');
 assert.ok(base.count===top.count,'a top strip is instanced per curb body');
 assert.ok(base.height>=.1,'curb body has a visible vertical face');
 assert.ok(base.baseY>=-.02,'curb body sits at the shared road/sidewalk plane');
 assert.ok(Math.abs(top.topY-base.topY)>=.01,'curb top sits proud of the body for a readable raised edge');

 // 3. Denser, greener near-spawn undergrowth than the previous pass, seated on
 //    the drawn terrain (no floating instances).
 const nc=fixture.nearCounts;
 assert.ok(nc.shrub>=30,`near-bank shrub mix densified (${nc.shrub})`);
 assert.ok(nc.fern>=6,`near-bank fern mix densified (${nc.fern})`);
 assert.ok(nc.grass>=260,`near-bank grass mix densified (${nc.grass})`);
 assert.ok(nc.tree>=4,`near-spawn tree mix densified (${nc.tree})`);
 assert.ok((nc.shrub||0)+(nc.fern||0)+(nc.grass||0)>=300,'near-spawn green layer is materially denser than the previous 269');
 assert.ok(fixture.seat.sampled>200&&fixture.seat.floating===0,`furniture sits on the drawn terrain (worst ${fixture.seat.worst} m)`);

 // 4. Two to four near-full-size scanned trees at the spawn, at least two in
 //    the opening camera frustum.
 assert.ok(fixture.trees.length>=2&&fixture.trees.length<=4,`spawn trees ${fixture.trees.length} within 2-4`);
 assert.ok(fixture.trees.every(t=>t.s>=.9),'spawn trees are near-full-size, not scaled horizon stand-ins');
 const inFrame=fixture.projected.filter(t=>t.inFrame).length;
 assert.ok(inFrame>=2,`at least two spawn trees project in frame (${inFrame}/${fixture.projected.length})`);
 assert.ok(fixture.projected.every(t=>Number.isFinite(t.s)&&t.s>=.9),'all spawn trees carry a real scale');

 console.log(JSON.stringify({slabs:{road:road.color,sidewalk:walk.color},curbs:{body:base.count,top:top.count,height:base.height},pavement:{mean:pm.mean,roadMean,walkMean,max:pm.max,clip:pm.clip,n:pm.n},near:{...nc,trees:fixture.trees.length,inFrame,seat:fixture.seat},browserErrors:page.errors}));
} finally {
 await harness.close();
 await server.close();
}
