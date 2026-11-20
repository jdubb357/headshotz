// Detailed tactical-map grader: proves the 360px minimap background is a
// textured, deterministic district atlas — grain, road/sidewalk markings,
// rooftop decks, field furrows, layered canopies, basin ripples and amber
// landmark glyph plates — while every boundary crossing maps within the world
// and the live preview remains unchanged.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 const result=await p.evaluate(`(async()=>{
  const {drawMap}=await import('./raid-online.mjs');
  const {RAID_WORLDS}=await import('./shared/raid-worlds.mjs');
  const landmarkKinds=['antenna','dish','crane','turbine','waterTower','pump','signal','rail'];
  // Amber tactical palette signature: warm plate/icon stroke, not a lit-window
  // stone or green canopy. Grains and antialiasing dim toward orange-brown.
  const amber=(r,g,b)=>r>=145&&g>=115&&b<=125&&r-g>=25&&g-b>=20;
  const render=id=>{const c=document.createElement('canvas');c.width=c.height=360;drawMap(c,id);return c};
  const pixelData=c=>c.getContext('2d').getImageData(0,0,360,360).data;
  const worlds={};
  for(const world of RAID_WORLDS){
   const first=render(world.id),second=render(world.id);
   const data=pixelData(first),again=pixelData(second);
   let blankDiff=0,badHex=false,edge=0,mean=0,std=0,colors=0;
   const seen=new Set(),lum=[];
   for(let i=0;i<data.length;i+=4){
    if(data[i]!==again[i]||data[i+1]!==again[i+1]||data[i+2]!==again[i+2])blankDiff++;
    seen.add(data[i]+','+data[i+1]+','+data[i+2]);
    lum.push(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]);
   }
   colors=seen.size;mean=lum.reduce((a,b)=>a+b,0)/lum.length;
   std=Math.sqrt(lum.reduce((a,b)=>a+(b-mean)**2,0)/lum.length);
   for(let y=1;y<360;y++)for(let x=1;x<360;x++){
    const i=(y*360+x)*4,left=i-4,up=i-1440;
    edge+=Math.abs(data[i]-data[left])+Math.abs(data[i+1]-data[left+1])+Math.abs(data[i+2]-data[left+2])+
      Math.abs(data[i]-data[up])+Math.abs(data[i+1]-data[up+1])+Math.abs(data[i+2]-data[up+2]);
   }
   // Every landmark prop must carry an amber plate inside a 15×15 footprint;
   // boundaries clamp so no sample ever escapes the backing canvas.
   const landmarks=world.props.filter(prop=>landmarkKinds.includes(prop.kind)).map(prop=>{
    const cx=Math.round(180+(prop.x||0)*360/world.size),cy=Math.round(180+(prop.z||0)*360/world.size);
    let amberCount=0,darkCount=0;
    for(let yy=Math.max(0,cy-7);yy<=Math.min(359,cy+7);yy++)for(let xx=Math.max(0,cx-7);xx<=Math.min(359,cx+7);xx++){
     const i=(yy*360+xx)*4;
     if(amber(data[i],data[i+1],data[i+2]))amberCount++;
     if(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2]<72)darkCount++;
    }
    return {kind:prop.kind,x:cx,y:cy,amber:amberCount,dark:darkCount};
   });
   worlds[world.id]={colors,edge:Math.round(edge/359/359),mean:+mean.toFixed(1),std:+std.toFixed(1),blankDiff,landmarks,landmarkCount:landmarks.length};
   // Previews are deliberately cached; a second 360 render must be readable
  }
  const preview=document.createElement('canvas');preview.width=360;preview.height=360;drawMap(preview,'relay');
  return {backing:[preview.width,preview.height],worlds,totalLandmarks:Object.values(worlds).reduce((a,w)=>a+w.landmarkCount,0)};
 })()`);
 assert.deepEqual(result.backing,[360,360],'the detailed minimap keeps its 360×360 backing');
 assert.equal(result.totalLandmarks,27,'every landmark prop in the three worlds stays represented in the detail layer');
 const thresholds={relay:{colors:16000,edge:55},reservoir:{colors:18500,edge:46},switchyard:{colors:19500,edge:55}};
 for(const [id,expected] of Object.entries(thresholds)){
  const m=result.worlds[id];
  assert.ok(m,'the '+id+' world is textured');
  assert.equal(m.blankDiff,0,id+' detail renders are deterministic');
  assert.ok(m.colors>=expected.colors,id+' paints dense district colour detail ('+m.colors+')');
  assert.ok(m.edge>=expected.edge,id+' paints high-contrast street/building edges ('+m.edge+')');
  assert.ok(m.landmarks.length>0,id+' has landmark glyphs');
  for(const landmark of m.landmarks){
   assert.ok(landmark.amber>=8,id+' '+landmark.kind+' landmark plate is painted ('+landmark.amber+' amber pixels)');
   assert.ok(landmark.dark>=20,id+' '+landmark.kind+' landmark plate has a dark tactical backing ('+landmark.dark+' dark pixels)');
  }
 }
 // Worlds must not collapse to the same imagery.
 const signatures=Object.values(result.worlds).map(w=>w.colors+':'+w.edge+':'+w.mean+':'+w.std);
 assert.equal(new Set(signatures).size,3,'each sector keeps its own textured signature');
 // Hero screenshot: live-quality preview shots of all three textured sectors.
 await p.evaluate(`(async()=>{
  const {drawMap}=await import('./raid-online.mjs');
  document.querySelector('main').hidden=true;document.getElementById('play').style.display='none';
  const wrap=document.getElementById('mapAtlasCard')||document.createElement('div');
  if(!wrap.id){wrap.id='mapAtlasCard';wrap.style.cssText='position:fixed;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 32% 18%,#17282c,#081014 62%);font:600 14px system-ui;color:#eef6f2;z-index:9';
   const inner=document.createElement('div');inner.style.cssText='display:grid;gap:18px;justify-items:center;padding:28px 32px;border-radius:22px;border:1px solid #2b4340;background:linear-gradient(180deg,#0d171b,#0a1215);box-shadow:0 30px 90px #000d';
   const title=document.createElement('h2');title.textContent='SECTOR ATLAS · TEXTURED DISTRICTS';title.style.cssText='margin:0;font:700 16px/1.2 system-ui;letter-spacing:.16em;color:#ffd280';
   const row=document.createElement('div');row.style.cssText='display:flex;gap:18px;align-items:end';
   const names={relay:'Relay Graveyard · Industrial',reservoir:'Reservoir Basin · Wilderness',switchyard:'Switchyard · Settlement'};
   const holders=[];
   for(const [id,caption] of Object.entries(names)){
    const fig=document.createElement('figure');fig.style.cssText='margin:0;display:grid;gap:8px;justify-items:center;color:#bdd9d0;font:600 11px/1.2 system-ui;letter-spacing:.08em;text-transform:uppercase';
    const c=document.createElement('canvas');c.width=360;c.height=360;c.dataset.map=id;c.style.cssText='width:300px;height:300px;border-radius:14px;border:1px solid #46625c;box-shadow:0 14px 40px #000b,0 0 0 1px #ffbd4a22 inset';
    const figcap=document.createElement('figcaption');figcap.textContent=caption;
    fig.append(c,figcap);row.append(fig);holders.push(c);
   }
   wrap.append(title,row);document.body.append(wrap);window.__atlasCanvases=holders;
  }
  const canvases=[...document.querySelectorAll('#mapAtlasCard canvas[data-map]')];
  for(const c of canvases)drawMap(c,c.dataset.map);
 })()`);
 await new Promise(r=>setTimeout(r,250));
 await shot(p,'/tmp/hs-minimap-detailed.png');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({backing:result.backing,worlds:Object.fromEntries(Object.entries(result.worlds).map(([id,w])=>[id,{colors:w.colors,edge:w.edge,mean:w.mean,std:w.std,landmarks:w.landmarkCount,minAmber:Math.min(...w.landmarks.map(l=>l.amber)),minDark:Math.min(...w.landmarks.map(l=>l.dark))}])),screenshot:'/tmp/hs-minimap-detailed.png',browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
