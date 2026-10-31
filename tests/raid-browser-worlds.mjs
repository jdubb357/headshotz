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
  assert.equal(before.mapVersion,3);
  assert.ok(Array.isArray(before.machines),'machine snapshots are visibility-filtered');
  await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '});
  await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '});
  await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.y>.25)");
  const aimPoint=await p.evaluate("(()=>{for(let y=160;y<innerHeight-70;y+=35)for(let x=150;x<innerWidth-50;x+=35)if(document.elementFromPoint(x,y)?.id==='view'&&document.elementFromPoint(x+30,y-30)?.id==='view')return {x,y};return null})()");assert.ok(aimPoint,'A visible canvas area supports touch aiming');
  await p.command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aimPoint]});
  await p.command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:aimPoint.x+30,y:aimPoint.y-30}]});
  await p.command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.pitch>.1)");
  // Let the first animation render complete before inspecting pixels.
  await p.evaluate("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Animation frames did not resume')),5000))])");
  const shot=await p.command('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/headshotz-'+map+'.png',Buffer.from(shot.data,'base64'));
  await p.evaluate("document.getElementById('leave').click()");
  await p.wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
 }
 assert.deepEqual(p.errors,[]);console.log(JSON.stringify({maps:maps.length,jump:true,touchAim:true,rendered:true,browserErrors:p.errors}));
}finally{await h.close()}
