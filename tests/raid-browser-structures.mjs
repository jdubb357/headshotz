// Structure-weathering grader: proves the frozen block layer gains
// presentation-only foundation plinths, roof cornices, vents, antennas and
// debris whose instanced meshes are textured PBR groups, visibly reduce a
// building frame's pixels, remain deterministic across rebuilds, and never
// touch authoritative world/actor state.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const account=store.register('structures_probe','a long structures probe password').id;
const snapshot=runtime.raids.deploy(account,{requestId:'structures_probe',mapId:'relay',recovery:true});
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {RaidView}=await import('./raid-view.mjs');
  const {buildEnvironment}=await import('./raid-environment.mjs');
  const {terrainHeightAt}=await import('./shared/raid-worlds.mjs');
  document.querySelector('main').hidden=true;const canvas=document.createElement('canvas');canvas.id='structuresProbe';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%';document.body.append(canvas);
  const base=${JSON.stringify(snapshot)},clear={...base,conditions:{...base.conditions,weather:'clear'}},view=new RaidView(canvas);
  view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});view.start(clear);
  const detail=view.environmentRoot.userData.raidStructureDetail||{},worldSig=JSON.stringify([view.world.blocks?.length,view.world.props?.length,view.world.size]);
  const structureMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure)structureMeshes.push(o)});
  const tagCounts={};for(const m of structureMeshes)tagCounts[m.userData.raidStructure]=(tagCounts[m.userData.raidStructure]||0)+m.count;
  const pbr=structureMeshes.filter(m=>m.userData.raidStructure!=='beacon').every(m=>m.material?.isMeshStandardMaterial===true&&m.material?.map?.isTexture===true&&m.material?.normalMap?.isTexture===true);
  // A deterministic side view of a nearby authored building: camera one step
  // to the side of its footprint, aimed at the cornice. The probe pose is
  // presentation-only and never submitted to the authoritative snapshot.
  const self=clear.self;
  let building=null,best=1e9;
  for(const [x,z,w,d,hh,y=0,kind='concrete'] of view.world.blocks||[]){
   if(y>.4||hh<2.6||w<5||d<5)continue;
   if(kind!=='brick'&&kind!=='concrete'&&kind!=='planks')continue;
   const dist=Math.hypot(x-self.x,z-self.z);
   if(dist<best){best=dist;building={x,z,w,d,h:hh,roof:y+hh,y,dist}}
  }
  const bx=building.x,bz=building.z,px=bx+building.w/2+5,pz=bz+building.d/2+5,py=terrainHeightAt(view.world,px,pz)+2;
  const yaw=Math.atan2(bx-px,bz-pz),pitch=Math.atan2(building.roof+1-py,Math.hypot(bx-px,bz-pz));
  const gl=view.renderer.getContext(),frameAt=t=>{view.frame(t,yaw,pitch,{x:px,y:py,z:pz},true);gl.finish()},frameAtPose=(t,yw,pt,po)=>{view.frame(t,yw,pt,po,true);gl.finish()};
  frameAt(1000);
  const w2=gl.drawingBufferWidth,h2=gl.drawingBufferHeight;
  const capture=()=>{gl.bindFramebuffer(gl.FRAMEBUFFER,null);const buf=new Uint8Array(w2*h2*4);gl.readPixels(0,0,w2,h2,gl.RGBA,gl.UNSIGNED_BYTE,buf);return buf};
  const countDiff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)n++;return n};
  frameAt(1200);const withDetail=capture();
  const vineMeshes=structureMeshes.filter(m=>m.userData.raidStructure==='vines');
  for(const m of vineMeshes)m.visible=false;frameAt(1200);const withoutVines=capture();
  const vinePixels=countDiff(withDetail,withoutVines);for(const m of vineMeshes)m.visible=true;
  const boardingMeshes=structureMeshes.filter(m=>m.userData.raidStructure==='boarding');
  for(const m of boardingMeshes)m.visible=false;frameAt(1200);const withoutBoarding=capture();
  const boardingPixels=countDiff(withDetail,withoutBoarding);for(const m of boardingMeshes)m.visible=true;
  const doorwayMeshes=structureMeshes.filter(m=>m.userData.raidStructure==='doorway');
  for(const m of doorwayMeshes)m.visible=false;frameAt(1200);const withoutDoorways=capture();
  const doorwayPixels=countDiff(withDetail,withoutDoorways);for(const m of doorwayMeshes)m.visible=true;
  const awningMeshes=structureMeshes.filter(m=>m.userData.raidStructure==='doorAwning');let awningPixels=0;
  const utilityMeshes=structureMeshes.filter(m=>m.userData.raidStructure==='facadeUtility');let utilityPixels=0,utilityHero=null;
  for(const m of structureMeshes)m.visible=false;frameAt(1200);const withoutDetail=capture();
  const detailPixels=countDiff(withDetail,withoutDetail);for(const m of structureMeshes)m.visible=true;
  // A second, independent environment build of the same frozen world must be
  // identical; it also proves structure detail is derived only from block data.
  const rebuilt=buildEnvironment(view.world),detailAgain=rebuilt.userData.raidStructureDetail||{};
  const deterministic=JSON.stringify(detailAgain)===JSON.stringify(detail);
  // Reduced motion is only a presentation clock; the static structure layer
  // must stay fully rendered and unchanged.
  view.applySettings({reduced:true,sfxVolume:0,fov:75});
  const matrixSum=()=>structureMeshes.reduce((sum,m)=>sum+m.instanceMatrix.array.reduce((s,v,i)=>i%7===0?s+v:s,0),0);
  frameAt(1400);const reducedA=matrixSum(),reducedFirst=capture();frameAt(2600);const reducedB=matrixSum(),reducedSecond=capture();
  view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  // The lifecycle rebuild must dispose the previous environment and publish the
  // same structure counts for the new one.
  const memBefore={...view.renderer.info.memory};view.clear();view.start(clear);const detailRestart=view.environmentRoot.userData.raidStructureDetail||{},memAfter={...view.renderer.info.memory};
  // Choose the nearest authored building whose deterministic vine facade also
  // carries a framed window, then aim the evidence camera at that wall so the
  // climbing overgrowth and masonry window trim are both inspectable.
  let hero=null,heroWindow=null;
  let heroDist=Infinity;
  for(const [x,z,w,d,hh,y=0,kind='concrete'] of view.world.blocks||[]){
   if(y>.4||w<8||d<7||hh<4||!['brick','concrete','planks'].includes(kind))continue;
   const vn=x*4.71+z*9.13+view.world.id.length*.61+hh*2.3,vh=Math.sin(vn)*43758.5453123,vineHash=vh-Math.floor(vh);
   if(vineHash>=.30)continue;
   const face=Math.floor((Math.sin(vineHash*7.13)*43758.5453123%1+1)%1*4)%4,onZ=face<2,nx=face===2?-1:face===3?1:0,nz=face===0?1:face===1?-1:0;
   const windowsOnFace=(view.world.props||[]).filter(p=>{
    if(p.kind!=='window'||p.y==null)return false;
    if(nx)return Math.abs(p.x-(x+nx*(w/2+.27)))<.9&&p.z>=z-d/2-.1&&p.z<=z+d/2+.1;
    return Math.abs(p.z-(z+nz*(d/2+.27)))<.9&&p.x>=x-w/2-.1&&p.x<=x+w/2+.1;
   });
   const boarded=windowsOnFace.filter(p=>{
    if(p.lit)return false;
    const bv=Math.sin(p.x*127.1+p.z*311.7+view.world.id.length*4.3)*43758.5453123;
    return bv-Math.floor(bv)<.22;
   });
   if(!boarded.length)continue;
   const span=onZ?w:d,baseAlong=(((Math.sin(vineHash*9.7)*43758.5453123)%1+1)%1-.5)*span*.6;
   const candidate=boarded.find(p=>Math.abs((onZ?p.z-z:p.x-x)-baseAlong)<6)||boarded[0];
   const dist=Math.hypot(x-self.x,z-self.z);
   if(candidate&&dist<heroDist){heroDist=dist;hero={x,z,w,d,h:hh,y,face};heroWindow=candidate}
  }
  let hx,hz,hy,heroYaw,heroPitch;
  if(hero){
   const onZ=hero.face<2,nx=hero.face===2?-1:hero.face===3?1:0,nz=hero.face===0?1:hero.face===1?-1:0;
   hx=heroWindow.x+nx*7.4+(onZ?2.2:0);hz=heroWindow.z+nz*7.4+(onZ?0:2.2);
   hy=terrainHeightAt(view.world,hx,hz)+2.0;
   const tx=heroWindow.x,ty=heroWindow.y+(heroWindow.h||1.3)*.5,tz=heroWindow.z,dist=Math.hypot(tx-hx,tz-hz);
   heroYaw=Math.atan2(tx-hx,tz-hz);heroPitch=Math.atan2(ty-hy,dist);
  }else if(heroWindow){
   hx=heroWindow.x-4.2;hz=heroWindow.z+3.2;hy=terrainHeightAt(view.world,hx,hz)+1.6;
   const tx=heroWindow.x,ty=heroWindow.y+.65,tz=heroWindow.z,dist=Math.hypot(tx-hx,tz-hz);
   heroYaw=Math.atan2(tx-hx,tz-hz);heroPitch=Math.atan2(ty-hy,dist);
  }else{
   hx=building.x-building.w/2-14;hz=building.z;hy=terrainHeightAt(view.world,hx,hz)+2.6;
   const dist=Math.hypot(building.x-hx,building.z-hz);
   heroYaw=Math.atan2(building.x-hx,building.z-hz);heroPitch=Math.atan2(building.y+building.h*.55-hy,dist);
  }
  window.__structureView=view;window.__structureHero={yaw:heroYaw,pitch:heroPitch,pose:{x:hx,y:hy,z:hz}};
  const doorwayHero=view.environmentRoot.userData.raidDoorways?.filter(d=>(d.windows||0)>3&&d.awning).reduce((best,d)=>!best||Math.hypot(d.x-self.x,d.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?d:best,null)||null;
  if(doorwayHero){
   const outX=doorwayHero.outX||0,outZ=doorwayHero.outZ||0,hdx=doorwayHero.x+outX*5.2+(doorwayHero.onZ?1.8:0),hdz=doorwayHero.z+outZ*5.2+(doorwayHero.onZ?0:1.8);
   const hdy=terrainHeightAt(view.world,hdx,hdz)+1.75,dtx=doorwayHero.x,dty=doorwayHero.y+doorwayHero.h+0.30,dtz=doorwayHero.z,dd=Math.hypot(dtx-hdx,dtz-hdz);
   const dYaw=Math.atan2(dtx-hdx,dtz-hdz),dPitch=Math.atan2(dty-hdy,dd),dPose={x:hdx,y:hdy,z:hdz};
   window.__structureDoor={yaw:dYaw,pitch:dPitch,pose:dPose};
   frameAt(1250,dYaw,dPitch,dPose,true);const withDoor=capture();
   for(const m of awningMeshes)m.visible=false;frameAt(1250,dYaw,dPitch,dPose,true);const withoutAwning=capture();
   awningPixels=countDiff(withDoor,withoutAwning);for(const m of awningMeshes)m.visible=true;
  }
  // The utility evidence camera frames a cabinet (and any nearby downpipe) from
  // the pavement; utility pixels are isolated by hiding only that tag group.
  const utilitySite=(view.environmentRoot.userData.raidFacadeUtilities||[]).filter(u=>u.kind==='downpipe').reduce((best,u)=>!best||Math.hypot(u.x-self.x,u.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?u:best,null)||null;
  if(utilitySite){
   const onZ=utilitySite.onZ,nx=utilitySite.face===2?-1:utilitySite.face===3?1:0,nz=utilitySite.face===0?1:utilitySite.face===1?-1:0;
   const outX=onZ?0:nx,outZ=onZ?nz:0;
   const hux=utilitySite.x+outX*4.2+(onZ?1.6:0),huz=utilitySite.z+outZ*4.2+(onZ?0:1.6);
   const huy=terrainHeightAt(view.world,hux,huz),ux=utilitySite.x,uy=utilitySite.y+Math.min(utilitySite.height*.60,2.7),uz=utilitySite.z,ud=Math.hypot(ux-hux,uz-huz);
   const uYaw=Math.atan2(ux-hux,uz-huz),uPitch=Math.atan2(uy-(huy+1.65),ud),uPose={x:hux,y:huy,z:huz};
   window.__structureUtility={yaw:uYaw,pitch:uPitch,pose:uPose,fov:70};
   view.applySettings({reduced:true,sfxVolume:0,fov:70,viewMode:'third'});
   for(let i=0;i<24;i++)frameAtPose(1350,uYaw,uPitch,uPose);const withUtility=capture();
   for(const m of utilityMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(1350,uYaw,uPitch,uPose);const withoutUtility=capture();
   utilityPixels=countDiff(withUtility,withoutUtility);for(const m of utilityMeshes)m.visible=true;
   utilityHero={x:utilitySite.x,z:utilitySite.z,kind:utilitySite.kind};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  const cabinetSite=(view.environmentRoot.userData.raidFacadeUtilities||[]).filter(u=>u.kind==='cabinet').reduce((best,u)=>!best||Math.hypot(u.x-self.x,u.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?u:best,null)||null;
  if(cabinetSite){
   const onZ=cabinetSite.onZ,nx=cabinetSite.face===2?-1:cabinetSite.face===3?1:0,nz=cabinetSite.face===0?1:cabinetSite.face===1?-1:0;
   const outX=onZ?0:nx,outZ=onZ?nz:0;
   const cx=cabinetSite.x+outX*2.6+(onZ?.9:0),cz=cabinetSite.z+outZ*2.6+(onZ?0:.9);
   const cy=terrainHeightAt(view.world,cx,cz),dx=cabinetSite.x,dy=cabinetSite.y+0.1,dz=cabinetSite.z,cd=Math.hypot(dx-cx,dz-cz);
   window.__structureCabinet={yaw:Math.atan2(dx-cx,dz-cz),pitch:Math.atan2(dy-(cy+1.65),cd),pose:{x:cx,y:cy,z:cz},fov:60};
  }
  // Blade-sign evidence: an oblique first-person pose that sees the projected
  // board face and its bracket. The weapon overlay is hidden so it cannot cover
  // the façade evidence; sign pixels are isolated by hiding only that tag.
  const signSite=(view.environmentRoot.userData.raidFacadeSigns||[]).reduce((best,u)=>!best||Math.hypot(u.x-self.x,u.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?u:best,null)||null;
  let signPixels=0,signHero=null;
  // Re-collect after the lifecycle restart: the previous environment (and its
  // instanced meshes) was disposed, so toggling stale objects proves nothing.
  const signMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='facadeSign')signMeshes.push(o)});
  if(signSite){
   const tx=signSite.onZ?1:0,tz=signSite.onZ?0:1;
   const hx=signSite.x+signSite.outX*3.0+tx*2.4,hz=signSite.z+signSite.outZ*3.0+tz*2.4;
   const hy=terrainHeightAt(view.world,hx,hz),dx=signSite.x-hx,dz=signSite.z-hz,sd=Math.hypot(dx,dz);
   const signYaw=Math.atan2(dx,dz),signPitch=Math.atan2(signSite.y+0.05-(hy+1.65),sd),signPose={x:hx,y:hy,z:hz};
   window.__structureSign={yaw:signYaw,pitch:signPitch,pose:signPose,fov:65};
   view.applySettings({reduced:true,sfxVolume:0,fov:65,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(1500,signYaw,signPitch,signPose);const withSign=capture();
   for(const m of signMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(1500,signYaw,signPitch,signPose);const withoutSign=capture();
   signPixels=countDiff(withSign,withoutSign);for(const m of signMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   signHero={x:signSite.x,z:signSite.z,face:signSite.face};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  // Rooftop-plant evidence: an oblique ground-level view of a low-rise roof
  // silhouetted against the sky. Fresh instanced meshes are collected because
  // the lifecycle restart disposed the previous environment's groups.
  const roofPlants=view.environmentRoot.userData.raidRoofPlants||[];
  const roofSite=roofPlants.filter(p=>p.h<=16).reduce((best,u)=>!best||Math.hypot(u.x-self.x,u.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?u:best,null)||roofPlants[0]||null;
  let roofPlantPixels=0,roofPlantHero=null;
  const roofPlantMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='roofPlant')roofPlantMeshes.push(o)});
  if(roofSite){
   const hx=roofSite.x+roofSite.ox*8.5,hz=roofSite.z+roofSite.oz*8.5;
   const hy=terrainHeightAt(view.world,hx,hz),dx=roofSite.x-hx,dz=roofSite.z-hz,pd=Math.hypot(dx,dz);
   const aimY=roofSite.y+(roofSite.kind==='tank'?1.45:roofSite.kind==='stack'?1.35:0.72);
   const rYaw=Math.atan2(dx,dz),rPitch=Math.atan2(aimY-(hy+1.65),pd),rPose={x:hx,y:hy,z:hz};
   window.__structureRoof={yaw:rYaw,pitch:rPitch,pose:rPose,fov:70};
   view.applySettings({reduced:true,sfxVolume:0,fov:70,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(1700,rYaw,rPitch,rPose);const withPlant=capture();
   for(const m of roofPlantMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(1700,rYaw,rPitch,rPose);const withoutPlant=capture();
   roofPlantPixels=countDiff(withPlant,withoutPlant);for(const m of roofPlantMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   roofPlantHero={x:roofSite.x,z:roofSite.z,kind:roofSite.kind,roof:roofSite.roof};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  // Ground-grit evidence: a close first-person street pose looking down at a
  // foundation corner so the masonry chunks and weed tufts are inspectable.
  const gritSites=view.environmentRoot.userData.raidStreetGrit||[];
  const gritSite=gritSites.reduce((best,u)=>!best||Math.hypot(u.x-self.x,u.z-self.z)<Math.hypot(best.x-self.x,best.z-self.z)?u:best,null)||null;
  let streetGritPixels=0,streetGritHero=null;
  const gritMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='groundGrit')gritMeshes.push(o)});
  if(gritSite){
   const hx=gritSite.x+gritSite.ox*2.5,hz=gritSite.z+gritSite.oz*2.5;
   const hy=terrainHeightAt(view.world,hx,hz),dx=gritSite.x-hx,dz=gritSite.z-hz,gd=Math.hypot(dx,dz);
   const gYaw=Math.atan2(dx,dz),gPitch=Math.atan2(gritSite.y+0.28-(hy+1.65),gd),gPose={x:hx,y:hy,z:hz};
   window.__structureGrit={yaw:gYaw,pitch:gPitch,pose:gPose,fov:55};
   view.applySettings({reduced:true,sfxVolume:0,fov:55,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(1900,gYaw,gPitch,gPose);const withGrit=capture();
   for(const m of gritMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(1900,gYaw,gPitch,gPose);const withoutGrit=capture();
   streetGritPixels=countDiff(withGrit,withoutGrit);for(const m of gritMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   streetGritHero={x:gritSite.x,z:gritSite.z};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  // Façade-weathering evidence: a first-person wall view of the nearest stain
  // site. Fresh meshes are collected after the lifecycle restart, and only the
  // facadeWeather tag is hidden so its pixel contribution is isolated.
  const weatherSites=view.environmentRoot.userData.raidFacadeWeather||[];
  // Pick the clearest façade for evidence: skip sites whose front plane is
  // buried inside another block or crowded by a street prop, prefer broad walls.
  const weatherBlockers=new Set(['tree','lamp','powerPole','truck','wreck','car','tank','waterTower','tent','fence','hedge','planter','dumpster','checkpoint','billboard','scrap','barrel','crate']);
  let weatherSite=null,weatherBias=-1;
  for(const u of weatherSites){
   const hx=u.x+u.outX*4.6,hz=u.z+u.outZ*4.6;
   let inside=false;
   for(const b of view.world.blocks||[]){
    if(Math.abs(hx-b[0])<=b[2]/2+.4&&Math.abs(hz-b[1])<=b[3]/2+.4){inside=true;break}
   }
   if(inside)continue;
   let clearance=1e9;
   for(const p of view.world.props||[]){
    if(!weatherBlockers.has(p.kind))continue;
    const dx=(p.x||0)-hx,dz=(p.z||0)-hz,dd=Math.hypot(dx,dz);
    if(dd<clearance)clearance=dd;
   }
   const score=10*Math.min(u.span||0,3.2)+clearance;
   if(score>weatherBias){weatherBias=score;weatherSite=u}
  }
  let weatherPixels=0,weatherHero=null;
  const weatherMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='facadeWeather')weatherMeshes.push(o)});
  if(weatherSite){
   const hx=weatherSite.x+weatherSite.outX*4.6,hz=weatherSite.z+weatherSite.outZ*4.6;
   const hy=terrainHeightAt(view.world,hx,hz),dx=weatherSite.x-hx,dz=weatherSite.z-hz,wd=Math.hypot(dx,dz);
   const wYaw=Math.atan2(dx,dz),wPitch=Math.atan2(weatherSite.y-(hy+1.65),wd),wPose={x:hx,y:hy,z:hz};
   window.__structureWeather={yaw:wYaw,pitch:wPitch,pose:wPose,fov:65};
   view.applySettings({reduced:true,sfxVolume:0,fov:65,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(2000,wYaw,wPitch,wPose);const withWeather=capture();
   for(const m of weatherMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(2000,wYaw,wPitch,wPose);const withoutWeather=capture();
   weatherPixels=countDiff(withWeather,withoutWeather);for(const m of weatherMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   weatherHero={x:weatherSite.x,z:weatherSite.z,face:weatherSite.face,siteY:weatherSite.y};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  // Window-shutter evidence: a straight-on first-person view of a shuttered
  // opening after the lifecycle restart. The tag group is hidden alternately so
  // its changed-pixel contribution is isolated from the frame and boarding.
  const shutterSites=view.environmentRoot.userData.raidWindowShutters||[];
  let shutterSite=null,shutterBias=-1;
  for(const u of shutterSites){
   const hx=u.x+u.outX*2.9,hz=u.z+u.outZ*2.9;
   let inside=false;
   for(const b of view.world.blocks||[]){
    if(Math.abs(hx-b[0])<=b[2]/2+.4&&Math.abs(hz-b[1])<=b[3]/2+.4){inside=true;break}
   }
   if(inside)continue;
   let clearance=1e9;
   for(const p of view.world.props||[]){
    if(!weatherBlockers.has(p.kind))continue;
    const dx=(p.x||0)-hx,dz=(p.z||0)-hz,dd=Math.hypot(dx,dz);
    if(dd<clearance)clearance=dd;
   }
   const score=(u.panels>=2?18:0)+(u.wide||0)+clearance-Math.max(0,(u.y||0)-2.4)*4;
   if(score>shutterBias){shutterBias=score;shutterSite=u}
  }
  let windowShutterPixels=0,shutterHero=null;
  const shutterMeshes=[];
  view.scene.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='windowShutter')shutterMeshes.push(o)});
  if(shutterSite){
   const hx=shutterSite.x+shutterSite.outX*2.9,hz=shutterSite.z+shutterSite.outZ*2.9;
   const hy=terrainHeightAt(view.world,hx,hz),dx=shutterSite.x-hx,dz=shutterSite.z-hz,wd=Math.hypot(dx,dz);
   const sYaw=Math.atan2(dx,dz),sPitch=Math.atan2(shutterSite.y-(hy+1.65),wd),sPose={x:hx,y:hy,z:hz};
   window.__structureShutter={yaw:sYaw,pitch:sPitch,pose:sPose,fov:60};
   view.applySettings({reduced:true,sfxVolume:0,fov:60,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(2000,sYaw,sPitch,sPose);const withShutters=capture();
   for(const m of shutterMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(2000,sYaw,sPitch,sPose);const withoutShutters=capture();
   windowShutterPixels=countDiff(withShutters,withoutShutters);for(const m of shutterMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   shutterHero={x:shutterSite.x,z:shutterSite.z,onZ:shutterSite.onZ,panels:shutterSite.panels,siteY:shutterSite.y};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  // Window-sill and flower-box evidence: a close first-person street pose looking
  // up at an opening with a planter so both the projecting stone ledge and the
  // hanging flower box are inspectable. Each tag group is hidden independently
  // so its changed-pixel contribution is isolated after the lifecycle restart.
  const sillSites=view.environmentRoot.userData.raidWindowSills||[];
  let sillSite=null,sillBias=-1;
  for(const u of sillSites){
   const hx=u.x+u.outX*3.0,hz=u.z+u.outZ*3.0;
   let inside=false;
   for(const b of view.world.blocks||[]){
    if(Math.abs(hx-b[0])<=b[2]/2+.4&&Math.abs(hz-b[1])<=b[3]/2+.4){inside=true;break}
   }
   if(inside)continue;
   let clearance=1e9;
   for(const p of view.world.props||[]){
    if(!weatherBlockers.has(p.kind))continue;
    const dx=(p.x||0)-hx,dz=(p.z||0)-hz,dd=Math.hypot(dx,dz);
    if(dd<clearance)clearance=dd;
   }
   const score=(u.planter?24:0)+10*Math.min(u.wide||0,1.15)+clearance-Math.max(0,(u.y||0)-2.4)*4;
   if(score>sillBias){sillBias=score;sillSite=u}
  }
  let sillPixels=0,flowerBoxPixels=0,sillHero=null;
  const sillMeshes=[],flowerBoxMeshes=[];
  view.scene.traverse(o=>{
   if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='windowSill')sillMeshes.push(o);
   if((o.isMesh||o.isInstancedMesh)&&o.userData.raidStructure==='flowerBox')flowerBoxMeshes.push(o);
  });
  if(sillSite){
   const hx=sillSite.x+sillSite.outX*3.0,hz=sillSite.z+sillSite.outZ*3.0;
   const hy=terrainHeightAt(view.world,hx,hz),dx=sillSite.x-hx,dz=sillSite.z-hz,wd=Math.hypot(dx,dz);
   const sYaw=Math.atan2(dx,dz),sPitch=Math.atan2(sillSite.y-(hy+1.65),wd),sPose={x:hx,y:hy,z:hz};
   window.__structureSill={yaw:sYaw,pitch:sPitch,pose:sPose,fov:58};
   view.applySettings({reduced:true,sfxVolume:0,fov:58,viewMode:'first'});
   const overlayVisible=view.overlay?view.overlay.visible:true;if(view.overlay)view.overlay.visible=false;
   for(let i=0;i<24;i++)frameAtPose(2100,sYaw,sPitch,sPose);const withSill=capture();
   for(const m of sillMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(2100,sYaw,sPitch,sPose);const withoutSill=capture();
   sillPixels=countDiff(withSill,withoutSill);for(const m of sillMeshes)m.visible=true;
   for(const m of flowerBoxMeshes)m.visible=false;for(let i=0;i<24;i++)frameAtPose(2100,sYaw,sPitch,sPose);const withoutFlowerBox=capture();
   flowerBoxPixels=countDiff(withSill,withoutFlowerBox);for(const m of flowerBoxMeshes)m.visible=true;
   if(view.overlay)view.overlay.visible=overlayVisible;
   sillHero={x:sillSite.x,z:sillSite.z,onZ:sillSite.onZ,planter:sillSite.planter,siteY:sillSite.y,wide:sillSite.wide};
   view.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});
  }
  return {fieldWidth:w2,fieldHeight:h2,alive:!!view.snapshot?.self?.alive,selfPose:[clear.self.x,clear.self.y||0,clear.self.z],utilityPose:utilityHero&&window.__structureUtility&&window.__structureUtility.pose,cabinetPose:window.__structureCabinet&&window.__structureCabinet.pose,signPose:window.__structureSign&&window.__structureSign.pose,roofPose:window.__structureRoof&&window.__structureRoof.pose,gritPose:window.__structureGrit&&window.__structureGrit.pose,weatherPose:window.__structureWeather&&window.__structureWeather.pose,building:{dist:Math.round(building.dist),w:building.w,d:building.d,h:building.h},detail,detailPixels,vinePixels,boardingPixels,doorwayPixels,awningPixels,utilityPixels,signPixels,roofPlantPixels,streetGritPixels,weatherPixels,windowShutterPixels,sillPixels,flowerBoxPixels,doorwayHero:doorwayHero&&{x:doorwayHero.x,z:doorwayHero.z,face:doorwayHero.face,windows:doorwayHero.windows,awning:doorwayHero.awning},utilityHero,signHero,roofPlantHero,streetGritHero,weatherHero,shutterHero,sillHero,deterministic,detailRestart,tagCounts,pbr,changesDetailOnly:{meshes:structureMeshes.length},reduced:{sameMatrices:Math.abs(reducedA-reducedB)<1e-5,changed:countDiff(reducedFirst,reducedSecond)<=2},memory:{before:memBefore,after:memAfter},stateUntouched:worldSig===JSON.stringify([view.world.blocks?.length,view.world.props?.length,view.world.size])};
 })()`);
 assert.ok(result.detail.structures>=250,'relay reports the authored structure count (got '+result.detail.structures+')');
 assert.equal(result.detail.plinths,result.detail.structures,'every structure gets a foundation plinth');
 assert.equal(result.detail.cornices,result.detail.structures,'every structure gets a roof cornice');
 assert.ok(result.detail.vents>100&&result.detail.antennas>20&&result.detail.debris>20&&result.detail.beacons>10,'rooftop vents, masts, debris and beacons are populated');
 assert.deepEqual(Object.keys(result.tagCounts).sort(),['antenna','beacon','boarding','cornice','debris','doorAwning','doorway','facadeSign','facadeUtility','facadeWeather','fireEscape','flowerBox','framing','groundGrit','plinth','roofPlant','sidingBelt','sidingRib','vent','vines','windowShutter','windowSill'],'all detail tags are grouped as instanced meshes');
 assert.ok((result.detail.frames||0)>200,'window openings gain four authored frame pieces each ('+result.detail.frames+')');
 assert.ok((result.detail.fireEscapes||0)>10,'tall blocks carry readable fire escapes ('+result.detail.fireEscapes+')');
 assert.ok((result.detail.vines||0)>20,'facades are reclaimed by climbing vines ('+result.detail.vines+' blocks)');
 assert.ok((result.detail.boardedWindows||0)>500,'abandoned dark windows are boarded with planks ('+result.detail.boardedWindows+' windows)');
 assert.ok((result.detail.doorways||0)>80,'street-level facades carry framed doorways and stoops ('+result.detail.doorways+' doorways)');
 assert.ok((result.detail.awningDoors||0)>50,'a mechanical share of doorways gains entry canopies ('+result.detail.awningDoors+' awnings)');
 assert.ok((result.detail.facadeUtilities||0)>100,'street-level blocks carry façade utilities ('+result.detail.facadeUtilities+' blocks)');
 assert.ok((result.detail.downpipes||0)>70,'corner downpipes service the standing buildings ('+result.detail.downpipes+' pipes)');
 assert.ok((result.detail.utilityBoxes||0)>50,'wall utility cabinets are mounted in window gaps ('+result.detail.utilityBoxes+' cabinets)');
 assert.ok((result.detail.facadeSigns||0)>35,'street-level banners hang projected storefront signs ('+result.detail.facadeSigns+' blade signs)');
 assert.ok((result.detail.roofPlants||0)>20,'standing roofs carry mechanical plant ('+result.detail.roofPlants+' rooftop plants)');
 assert.ok((result.detail.streetGritClusters||0)>100,'foundations collect masonry and weed clusters ('+result.detail.streetGritClusters+' ground-grit clusters)');
 assert.ok((result.detail.facadeStains||0)>100,'weathered façades carry damp stains and rain streaks ('+result.detail.facadeStains+' façade stain sites)');
 assert.ok((result.detail.windowShutters||0)>100,'a deterministic share of dark windows gain weathered plank shutters ('+result.detail.windowShutters+' shuttered openings)');
 assert.ok((result.detail.windowSills||0)>7800,'every façade opening gains a projecting stone sill ledge ('+result.detail.windowSills+' sill ledges)');
 assert.ok((result.detail.flowerBoxes||0)>1500,'a deterministic share of window sills carries a hanging flower box ('+result.detail.flowerBoxes+' planters)');
 assert.ok(result.tagCounts.framing>0&&result.tagCounts.fireEscape>0&&result.tagCounts.vines>100&&result.tagCounts.boarding>1500&&result.tagCounts.doorway>800&&result.tagCounts.doorAwning>150&&result.tagCounts.facadeUtility>500&&result.tagCounts.facadeSign>250&&result.tagCounts.roofPlant>200&&result.tagCounts.groundGrit>800&&result.tagCounts.facadeWeather>1200&&result.tagCounts.windowShutter>1000&&result.tagCounts.windowSill>15000&&result.tagCounts.flowerBox>10000,'frame, fire-escape, vine, boarding, doorway, awning, utility, sign, roof-plant, ground-grit, weathering, shutter, sill and flower-box instances are rendered');
 assert.ok(result.changesDetailOnly.meshes>=7,'detail groups are separate instanced meshes ('+result.changesDetailOnly.meshes+')');
 assert.equal(result.pbr,true,'detail surfaces (except the beacon glow) use textured PBR materials + normal maps');
 assert.ok(result.building.dist<100,'a nearby authored building is aimed at (dist '+result.building.dist+' m)');
 assert.ok(result.detailPixels>500,'the structure-layer detail is visibly rendered (changed pixels '+result.detailPixels+')');
 assert.ok(result.vinePixels>250,'climbing vines visibly contribute to the facade (changed pixels '+result.vinePixels+')');
 assert.ok(result.boardingPixels>150,'boarded windows visibly contribute to the facade (changed pixels '+result.boardingPixels+')');
 assert.ok(result.doorwayPixels>120,'doorways visibly contribute to the facade (changed pixels '+result.doorwayPixels+')');
 assert.ok(result.awningPixels>100,'entry canopies visibly contribute to the facade (changed pixels '+result.awningPixels+')');
 assert.ok(result.utilityPixels>150,'façade utilities visibly contribute to the facade (changed pixels '+result.utilityPixels+')');
 assert.ok(result.signPixels>150,'projected storefront signs visibly contribute to the facade (changed pixels '+result.signPixels+')');
 assert.ok(result.roofPlantPixels>150,'rooftop mechanical plant contributes to the skyline silhouette (changed pixels '+result.roofPlantPixels+')');
 assert.ok(result.streetGritPixels>150,'foundation grit and weeds visibly break up the street ('+result.streetGritPixels+' changed pixels)');
 assert.ok(result.weatherPixels>150,'façade rain streaks and damp stains visibly weather the wall ('+result.weatherPixels+' changed pixels)');
 assert.ok(result.windowShutterPixels>150,'weathered shutters visibly frame dark windows ('+result.windowShutterPixels+' changed pixels)');
 assert.ok(result.sillPixels>100,'projecting stone sill ledges visibly ground the façade openings ('+result.sillPixels+' changed pixels)');
 assert.ok(result.flowerBoxPixels>60,'hanging flower boxes with foliage and blooms contribute to the street façade ('+result.flowerBoxPixels+' changed pixels)');
 assert.ok(result.shutterHero,'a window-shutter evidence pose is available for inspection');
 assert.ok(result.sillHero&&result.sillHero.planter,'a flower-box sill evidence pose is available for inspection');
 assert.ok(result.doorwayHero,'a doorway evidence pose is available for inspection');
 assert.ok(result.utilityHero,'a facade utility evidence pose is available for inspection');
 assert.ok(result.signHero,'a storefront blade-sign evidence pose is available for inspection');
 assert.ok(result.roofPlantHero,'a rooftop-plant evidence pose is available for inspection');
 assert.ok(result.streetGritHero,'a ground-grit evidence pose is available for inspection');
 assert.ok(result.weatherHero,'a façade-weathering evidence pose is available for inspection');
 assert.equal(result.deterministic,true,'structure detail rebuilds identically from frozen world data');
 assert.deepEqual(result.detailRestart,result.detail,'lifecycle restart republishes identical structure counts');
 assert.equal(result.reduced.sameMatrices,true,'reduced motion leaves the static structure layer untouched');
 assert.equal(result.reduced.changed,true,'reduced motion keeps the structure view static');
 assert.equal(result.stateUntouched,true,'presentation-only detail does not clone or mutate shared world data');
 assert.deepEqual(p.errors,[]);
 await p.evaluate(`(async()=>{const {mapConditions}=await import('./shared/raid-enemies.mjs');const v=window.__structureView,h=window.__structureHero;v.sync({...v.snapshot,conditions:mapConditions(v.world,0)});v.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});v.selfActor.visible=false;v.chase=null;for(let i=0;i<60;i++)v.frame(300000+i*16,h.yaw,h.pitch,h.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-structure-detail.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,d=window.__structureDoor;if(!d)return;v.applySettings({reduced:false,sfxVolume:0,fov:75,viewMode:'third'});v.selfActor.userData.actor='none';v.selfActor.visible=false;for(let i=0;i<60;i++)v.frame(301000+i*16,d.yaw,d.pitch,d.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-doorway.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,u=window.__structureUtility;if(!u)return;v.applySettings({reduced:false,sfxVolume:0,fov:u.fov||70,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(302000+i*16,u.yaw,u.pitch,u.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-facade-utility.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,c=window.__structureCabinet;if(!c)return;v.applySettings({reduced:false,sfxVolume:0,fov:c.fov||60,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(303000+i*16,c.yaw,c.pitch,c.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-facade-cabinet.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,s=window.__structureSign;if(!s)return;v.applySettings({reduced:false,sfxVolume:0,fov:s.fov||65,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(304000+i*16,s.yaw,s.pitch,s.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-facade-sign.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,r=window.__structureRoof;if(!r)return;v.applySettings({reduced:false,sfxVolume:0,fov:r.fov||70,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(305000+i*16,r.yaw,r.pitch,r.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-roof-plant.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,r=window.__structureGrit;if(!r)return;v.applySettings({reduced:false,sfxVolume:0,fov:r.fov||55,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(306000+i*16,r.yaw,r.pitch,r.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-street-grit.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,w=window.__structureWeather;if(!w)return;v.applySettings({reduced:false,sfxVolume:0,fov:w.fov||65,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(307000+i*16,w.yaw,w.pitch,w.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-facade-weather.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,s=window.__structureShutter;if(!s)return;v.applySettings({reduced:false,sfxVolume:0,fov:s.fov||60,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(308000+i*16,s.yaw,s.pitch,s.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-window-shutters.png');
 await p.evaluate(`(async()=>{const v=window.__structureView,s=window.__structureSill;if(!s)return;v.applySettings({reduced:false,sfxVolume:0,fov:s.fov||58,viewMode:'first'});v.selfActor.userData.actor='none';v.selfActor.visible=false;if(v.overlay)v.overlay.visible=false;for(let i=0;i<60;i++)v.frame(309000+i*16,s.yaw,s.pitch,s.pose,false);v.renderer.getContext().finish()})()`);
 await new Promise(r=>setTimeout(r,200));await shot(p,'/tmp/hs-window-sills.png');
 await p.evaluate("(()=>{delete window.__structureView;delete window.__structureHero;delete window.__structureDoor;delete window.__structureUtility;delete window.__structureCabinet;delete window.__structureSign;delete window.__structureRoof;delete window.__structureGrit;delete window.__structureWeather;delete window.__structureShutter;delete window.__structureSill;document.getElementById('structuresProbe').remove()})()");
 console.log(JSON.stringify({field:[result.fieldWidth,result.fieldHeight],alive:result.alive,selfPose:result.selfPose,utilityPose:result.utilityPose,cabinetPose:result.cabinetPose,signPose:result.signPose,roofPose:result.roofPose,gritPose:result.gritPose,weatherPose:result.weatherPose,building:result.building,detail:result.detail,doorwayHero:result.doorwayHero,utilityHero:result.utilityHero,signHero:result.signHero,roofPlantHero:result.roofPlantHero,streetGritHero:result.streetGritHero,weatherHero:result.weatherHero,shutterHero:result.shutterHero,sillHero:result.sillHero,tagCounts:result.tagCounts,detailPixels:result.detailPixels,vinePixels:result.vinePixels,boardingPixels:result.boardingPixels,doorwayPixels:result.doorwayPixels,awningPixels:result.awningPixels,utilityPixels:result.utilityPixels,signPixels:result.signPixels,roofPlantPixels:result.roofPlantPixels,streetGritPixels:result.streetGritPixels,weatherPixels:result.weatherPixels,windowShutterPixels:result.windowShutterPixels,sillPixels:result.sillPixels,flowerBoxPixels:result.flowerBoxPixels,pbr:result.pbr,deterministic:result.deterministic,restart:result.detailRestart,reduced:result.reduced,memory:result.memory,screenshots:['/tmp/hs-structure-detail.png','/tmp/hs-doorway.png','/tmp/hs-facade-utility.png','/tmp/hs-facade-cabinet.png','/tmp/hs-facade-sign.png','/tmp/hs-roof-plant.png','/tmp/hs-street-grit.png','/tmp/hs-facade-weather.png','/tmp/hs-window-shutters.png','/tmp/hs-window-sills.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
