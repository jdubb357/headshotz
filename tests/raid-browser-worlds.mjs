import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browserHarness} from './browser-harness.mjs';
const h=await browserHarness();
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate(`document.querySelector('[name=username]').value='world_'+Date.now().toString(36);document.querySelector('[name=password]').value='a world testing password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.wait("document.getElementById('basePreview').width>300");
 const maps=await p.evaluate("[...document.getElementById('map').options].map(o=>o.value)");
 for(const map of maps){
  // Separate authenticated account per map, so no active deployment is discarded.
  if(map!==maps[0]){
   await p.evaluate("document.getElementById('logout').click()");
   await p.wait("!document.getElementById('auth').hidden && document.body.getAttribute('aria-busy')==='false'");
   await p.evaluate(`document.querySelector('[name=username]').value='world_'+Date.now().toString(36);document.querySelector('[name=password]').value='a world testing password';document.getElementById('register').click()`);
   await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  }
  await p.evaluate(`document.getElementById('map').value=${JSON.stringify(map)};document.getElementById('map').dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('deploy').click()`);
  await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('hud').textContent.includes('HP')");
  const before=await p.evaluate("fetch('/api/raid').then(r=>r.json())");
  assert.equal(before.mapVersion,10,'new deployments use the terrain district layout');
  assert.ok(Array.isArray(before.machines),'machine snapshots are visibility-filtered');
  const aimPoint=await p.evaluate("(()=>{for(let y=160;y<innerHeight-70;y+=35)for(let x=150;x<innerWidth-50;x+=35)if(document.elementFromPoint(x,y)?.id==='view'&&document.elementFromPoint(x+30,y-30)?.id==='view')return {x,y};return null})()");assert.ok(aimPoint,'A visible canvas area supports touch aiming');
  await p.command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aimPoint]});
  await p.command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aimPoint.x+30,y:aimPoint.y-30}]});
  await p.command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.pitch>.1)");
  // Real Space binding: focus the canvas, then poll from Node because a
  // headless page throttles timers/evaluation after the prior screenshot.
  await p.command('Page.bringToFront');
  await p.evaluate("window.focus();document.getElementById('view').focus()");
  await p.evaluate(`(()=>{
   const prior=window.fetch;
   window.__jumpSeen=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('No jump acknowledgement from the server on ${map}')),8000);
    window.fetch=(url,opts)=>{
     const result=prior(url,opts);
     if(String(url).endsWith('/api/action')&&String(opts?.body||'').includes('"type":"jump"'))result.then(r=>r.clone().json()).then(payload=>{
      if(payload.ack?.accepted&&payload.state?.self?.vy>0&&payload.state.self.grounded===false){clearTimeout(timer);resolve(true)}
     }).catch(()=>{});
     return result;
    };
   });
  })()`);
  await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '});
  // Hold the key briefly, as a real operator does; headless instant key
  // press/release can coalesce before the jump action leaves the chain.
  await new Promise(r=>setTimeout(r,60));
  await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '});
  let jumpSeen=false;
  try{jumpSeen=await p.evaluate("window.__jumpSeen")}catch(error){jumpSeen=false}
  assert.ok(jumpSeen,`Space jump is accepted by the server on ${map}`);
  // Let the first animation render complete before inspecting pixels.
  await p.evaluate("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Animation frames did not resume')),5000))])");
  const shot=await p.command('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/headshotz-'+map+'.png',Buffer.from(shot.data,'base64'));
  await p.evaluate("document.getElementById('leave').click()");
  await p.wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
 }
 assert.deepEqual(p.errors,[]);console.log(JSON.stringify({maps:maps.length,jump:true,touchAim:true,rendered:true,browserErrors:p.errors}));
}finally{await h.close()}
