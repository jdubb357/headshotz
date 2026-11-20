// Premium aim-aware reticle grader: proves the raid HUD crosshair is geometry
// and CSS (no text glyph), contracts and brightens in the authoritative aiming
// state, keeps contrast over bright/dark terrain, and respects reduced motion.
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
const screenshot=async(p,path)=>{const shot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(shot.data,'base64'))};
const read=async p=>await p.evaluate(`(()=>{
 const c=document.getElementById('cross'),cs=getComputedStyle(c),hb=getComputedStyle(c,'::before'),va=getComputedStyle(c,'::after');
 return {spread:parseFloat(cs.getPropertyValue('--reticle-spread')),gap:parseFloat(cs.getPropertyValue('--reticle-gap')),
  dot:parseFloat(cs.getPropertyValue('--reticle-dot')),tick:parseFloat(hb.height),
  width:parseFloat(hb.width),vwidth:parseFloat(va.width),vheight:parseFloat(va.height),
  opacity:parseFloat(cs.opacity),transform:cs.transform,transition:cs.transitionProperty,duration:cs.transitionDuration,
  background:cs.backgroundImage,contentH:hb.content,contentV:va.content};
})()`);
const scaleOf=transform=>{const m=/matrix\(([-0-9.]+),/.exec(transform);return m?Math.abs(Number(m[1])):1};
try{
 const p=await h.page('/raid-online.html');
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='crosshair_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long crosshair browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 const weapon=profile.items.find(it=>it.kind==='weapon');
 await p.evaluate(`(()=>{const m=document.getElementById('maxRtt');m.value='0';m.dispatchEvent(new Event('change'));for(const c of document.querySelectorAll('#stash [data-equip]'))c.checked=c.value===${JSON.stringify(weapon.id)};document.getElementById('deploy').click()})()`);
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const actor=runtime.raids.byAccount.get(profile.id);if(actor){const raid=runtime.raids.raids.get(actor.raidId);raid.machines=[]}
 await p.evaluate("['touch','hint'].forEach(id=>document.getElementById(id).style.display='none')");
 await p.evaluate("document.getElementById('view').focus()");
 await p.wait("document.getElementById('play').dataset.aiming==='false'");
 await new Promise(r=>setTimeout(r,220));
 const hip=await read(p);const hipShot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/hs-crosshair-hip.png',Buffer.from(hipShot.data,'base64'));
 const hipCrop=await p.command('Page.captureScreenshot',{format:'png',clip:{x:600,y:320,width:80,height:80,scale:4}});await writeFile('/tmp/hs-crosshair-hip-crop.png',Buffer.from(hipCrop.data,'base64'));
 assert.equal(hip.spread,26,'the hip reticle keeps the wide search spread');
 assert.equal(hip.gap,6,'the hip reticle leaves an open center gap');
 assert.equal(hip.dot,1.6,'the hip reticle renders a center dot');
 assert.equal(hip.tick,2,'hip ticks are two pixels thick');
 assert.ok(hip.width>=24&&hip.width<=28,'the horizontal tick spans the authored spread');
 assert.ok(hip.vwidth>=1.5&&hip.vwidth<=2.5&&hip.vheight>=24&&hip.vheight<=28,'the vertical tick mirrors the horizontal geometry');
 assert.equal(hip.contentH,'""');assert.equal(hip.contentV,'""');
 assert.match(hip.background,/radial-gradient\(/,'the center dot is drawn with a gradient, not a glyph');
 assert.ok(hip.transition.includes('opacity')&&hip.transition.includes('transform'),'hip reticle animates opacity and scale');
 assert.ok(parseFloat(hip.duration)>0,'hip reticle transitions are enabled');
 assert.ok(Math.abs(hip.opacity-.78)<.01,'the hip reticle is deliberately translucent ('+hip.opacity+')');
 assert.ok(scaleOf(hip.transform)>.99,'the hip reticle renders at its open scale');
 assert.deepEqual(p.errors,[]);

 await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft'});
 await p.wait("document.getElementById('play').dataset.aiming==='true'");
 await new Promise(r=>setTimeout(r,240));
 const aim=await read(p);const aimShot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/hs-crosshair-aim.png',Buffer.from(aimShot.data,'base64'));
 const aimCrop=await p.command('Page.captureScreenshot',{format:'png',clip:{x:600,y:320,width:80,height:80,scale:4}});await writeFile('/tmp/hs-crosshair-aim-crop.png',Buffer.from(aimCrop.data,'base64'));
 assert.equal(await p.evaluate("document.getElementById('play').dataset.aiming"),'true','the reticle is driven by the authoritative aiming state');
 assert.equal(aim.spread,15,'aiming contracts the reticle to a precision spread');
 assert.equal(aim.gap,2,'aiming closes the center gap');
 assert.equal(aim.dot,1,'aiming tightens the center dot');
 assert.equal(aim.tick,1,'aiming thins the ticks');
 assert.ok(aim.width<hip.width-.5,'the aimed reticle is visibly tighter than the hip reticle ('+hip.width+' -> '+aim.width+')');
 assert.ok(aim.vheight<hip.vheight-.5,'the aimed vertical tick contracts as well');
 assert.ok(aim.opacity>=.95,'the aimed reticle brightens for readability ('+aim.opacity+')');
 assert.ok(Math.abs(scaleOf(aim.transform)-.86)<.02,'the aimed reticle settles at a tighter scale ('+scaleOf(aim.transform)+')');
 assert.match(aim.transform,/matrix\(0\.8[4-8]/,'the aimed transform is a real CSS matrix transition');
 assert.deepEqual(p.errors,[]);

 await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft'});
 await p.wait("document.getElementById('play').dataset.aiming==='false'");
 await new Promise(r=>setTimeout(r,240));
 const release=await read(p);
 assert.equal(release.spread,hip.spread,'releasing aim restores the hip spread');
 assert.ok(Math.abs(release.opacity-hip.opacity)<.01,'releasing aim restores hip translucency ('+release.opacity+')');
 assert.ok(scaleOf(release.transform)>.99,'releasing aim restores the open scale');
 assert.equal(await p.evaluate("document.getElementById('play').getAttribute('data-aiming')"),'false');

 await p.evaluate("document.documentElement.dataset.reducedMotion='true'");
 await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'ShiftLeft'});
 await p.wait("document.getElementById('play').dataset.aiming==='true'");
 const reduced=await read(p);const reducedShot=await p.command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/hs-crosshair-reduced.png',Buffer.from(reducedShot.data,'base64'));
 assert.equal(reduced.duration,'0s','reduced motion disables the reticle cross-fade');
 assert.equal(reduced.transition,'none','reduced motion removes the reticle transition');
 assert.equal(reduced.spread,15,'reduced motion swaps straight to the aimed geometry');
 assert.ok(Math.abs(scaleOf(reduced.transform)-.86)<.02,'reduced motion swaps straight to the aimed scale');
 await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'ShiftLeft'});
 await p.wait("document.getElementById('play').dataset.aiming==='false'");
 await p.evaluate("document.documentElement.dataset.reducedMotion='false'");
 await p.evaluate("document.documentElement.dataset.highContrast='true'");
 await new Promise(r=>setTimeout(r,220));
 const contrast=await read(p);
 assert.equal(contrast.opacity,1,'high contrast makes the reticle fully opaque');
 assert.match(contrast.background,/radial-gradient\(/,'high contrast keeps the center dot');
 await p.evaluate("document.documentElement.dataset.highContrast='false'");
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({geometry:true,precisionContraction:true,stateDrivenByEngine:true,contrastBackdrop:true,reducedMotionInstant:true,screenshots:['/tmp/hs-crosshair-hip.png','/tmp/hs-crosshair-hip-crop.png','/tmp/hs-crosshair-aim.png','/tmp/hs-crosshair-aim-crop.png','/tmp/hs-crosshair-reduced.png'],hip:{spread:hip.spread,gap:hip.gap,tick:hip.tick,opacity:hip.opacity},aim:{spread:aim.spread,gap:aim.gap,tick:aim.tick,scale:scaleOf(aim.transform),opacity:aim.opacity},browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
