// Interactive doors through the real client: normal Interact input toggles an
// unlocked door, a key-gated door exposes its locked prompt, consumes the key,
// and both live maps repaint from authoritative door state.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {browserHarness} from './browser-harness.mjs';
const root=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore,item}=await import(new URL('server/store.mjs',root));
const {createRaidServer}=await import(new URL('server/main.mjs',root));
const {terrainHeightAt}=await import(new URL('shared/raid-worlds.mjs',root));
let now=1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now:()=>now});
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const key=(p,code,down=true)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:code.charCodeAt(3)});
const tapKey=async(p,code)=>{await key(p,code,true);await key(p,code,false)};
const rgbCode=(rgb)=>`${rgb[0]},${rgb[1]},${rgb[2]}`;
// The compact minmap draws a wide door disc then paints a glyph over its
// centre, so scan the marker footprint instead of sampling one literal pixel.
const minimapHasColor=(x,z,rgb)=>`(()=>{const c=document.getElementById('minimap'),ctx=c.getContext('2d'),k=c.width/1440,px=Math.round(c.width/2+(${x})*k),py=Math.round(c.height/2+(${z})*k),r=[${rgbCode(rgb)}],left=Math.max(0,px-18),top=Math.max(0,py-18),right=Math.min(c.width,px+19),bottom=Math.min(c.height,py+19),d=ctx.getImageData(left,top,right-left,bottom-top).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-r[0])<4&&Math.abs(d[i+1]-r[1])<4&&Math.abs(d[i+2]-r[2])<4)return true;return false})()`;
// Tactical camera is centred on the authoritative operator, so its marker
// footprint is offset from map centre by the door minus the current self.
const tacticalHasColor=(x,z,rgb)=>`(async()=>{const state=await fetch('/api/raid').then(r=>r.json()),c=document.getElementById('tacticalCanvas'),ctx=c.getContext('2d'),k=c.width/1440,px=Math.round(c.width/2+((${x})-state.self.x)*k),py=Math.round(c.height/2+((${z})-state.self.z)*k),r=[${rgbCode(rgb)}];if(px<0||py<0||px>=c.width||py>=c.height)return false;const left=Math.max(0,px-16),top=Math.max(0,py-16),right=Math.min(c.width,px+17),bottom=Math.min(c.height,py+17),d=ctx.getImageData(left,top,right-left,bottom-top).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-r[0])<4&&Math.abs(d[i+1]-r[1])<4&&Math.abs(d[i+2]-r[2])<4)return true;return false})()`;
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='doors_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long interactive door browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const player=runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(player.raidId);
 raid.machines=[];raid.rivals=[];
 const door=()=>raid.world.doors.find(d=>d.id==='relay-door-03');
 const locked=()=>raid.world.doors.find(d=>d.id==='relay-door-01');
 assert.equal(raid.world.doors.filter(d=>d.locked).length,2,'relay authors two key-gated door routes');
 assert.equal(raid.world.doors.filter(d=>!d.locked).length,4,'relay still exposes four ordinary doors');
 assert.equal(locked().closed,true,'locked doors deploy physically closed');
 assert.equal(door().closed,false,'ordinary doors deploy open so existing routes stay walkable');

 // Spy on the accepted-action presentation without changing the synthesis or UI.
 await p.evaluate("(async()=>{const {RaidAudio}=await import('./raid-audio.mjs');window.__doorCues=[];const original=RaidAudio.prototype.play;RaidAudio.prototype.play=function(kind,spatial){if(kind==='door')window.__doorCues.push(kind);return original.call(this,kind,spatial)}})()");

 const place=async(x,z)=>{
  await p.wait(`fetch('/api/raid').then(r=>r.json()).then(r=>Math.abs(r.self.x-(${x}))<.25&&Math.abs(r.self.z-(${z}))<.25)`);
  await p.evaluate("document.getElementById('view').focus()");
 };
 const approachDoor=async d=>{
  // Approach from outside the room so the doorway gap itself is the nearest source.
  const x=d.x,z=d.side==='n'||d.side==='w'?d.z-1.6:d.z+1.6;
  Object.assign(player,{x,y:0,z,move:{x:0,z:0},yaw:d.side==='n'||d.side==='w'?0:Math.PI,pitch:0,grounded:true,alive:true,downed:false,protectedUntil:now+300,lastMoveAt:0});
  await place(x,z);
 };
 // Land well away from other sources so the operator halo never covers the
 // marker being inspected and the authoritative snapshot updates normally.
 const park=async()=>{
  const x=-360,z=-200,y=terrainHeightAt(raid.world,x,z);
  Object.assign(player,{x,y,z,move:{x:0,z:0},protectedUntil:now+300,lastMoveAt:0});
  await place(x,z);
 };

 // A normal door is open at the start. Press the real interaction binding to
 // close it, then inspect authoritative state, pack, maps and announcement.
 await approachDoor(door());
 await p.wait("document.getElementById('hint').textContent.includes('close Freight hall door')");
 assert.ok(await p.evaluate("document.getElementById('hint').textContent.startsWith('E / Use: close Freight hall door')"),'the interaction affordance names the ordinary door');
 await tapKey(p,'KeyE');
 await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.doors.find(d=>d.id==='relay-door-03').closed===true)",'keyboard closes the door');
 await p.wait("document.getElementById('statusAnnouncement').textContent.includes('Freight hall door closed.')");
 await writeFile('/tmp/headshotz-doors-world-closed.png',Buffer.from((await p.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.equal(await p.evaluate("document.querySelector('[data-door-id=\"relay-door-03\"] button').textContent"),'Toggle door','closed ordinary door keeps an always-available toggle');
 assert.equal(await p.evaluate("document.querySelector('[data-door-id=\"relay-door-03\"] p').textContent"),'Freight hall door · closed');
 await park();
 await p.wait(minimapHasColor(-360,60,[242,194,93]),'the live minimap paints the closed door amber');

 // The full tactical map paints the same state and explains its door colors.
 await p.evaluate("document.getElementById('mapToggle').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===false");
 assert.match(await p.evaluate("document.getElementById('minimap').getAttribute('aria-label')"),/door markers are red while locked, amber while closed and green while open/);
await p.wait(tacticalHasColor(-360,60,[240,184,90]),'the live tactical map paints the closed door amber');
 await writeFile('/tmp/headshotz-doors-tactical.png',Buffer.from((await p.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await p.evaluate("document.getElementById('mapClose').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===true");

 // Reopen through normal Interact; the marker returns to green.
 await approachDoor(door());
 await p.wait("document.getElementById('hint').textContent.includes('open Freight hall door')");
 await tapKey(p,'KeyE');
 await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.doors.find(d=>d.id==='relay-door-03').closed===false)",'keyboard reopens the door');
 await p.wait("document.getElementById('statusAnnouncement').textContent.includes('Freight hall door opened.')");
 await park();
 await p.wait(minimapHasColor(-360,60,[142,230,162]),'the live minimap paints the open door green');
 assert.equal(player.facts?.keysUsed||0,0,'ordinary door toggling never consumes a key');
 await p.wait("window.__doorCues.filter(k=>k==='door').length>=2",'accepted open and close play the door cue');

 // The locked relay door rejects an inventory-less unlock and explains why.
 await approachDoor(locked());
 await p.wait("document.getElementById('hint').textContent.includes('unlock Relay control door')");
 const disabled=await p.evaluate("(()=>{const row=document.querySelector('[data-door-id=\"relay-door-01\"]'),b=row?.querySelector('button');return {heading:row?.querySelector('p')?.textContent,label:b?.textContent,disabled:b?.disabled,title:b?.title}})()");
 assert.equal(disabled.heading,'Relay control door · locked · key required');
 assert.equal(disabled.label,'Unlock');assert.equal(disabled.disabled,true);assert.equal(disabled.title,'Find an access key first');
 assert.equal(await p.evaluate("window.__doorCues.filter(k=>k==='door').length"),2,'the disabled control never plays a cue');

 // A carried key turns the same prompt into an accepted unlock. The server
 // snapshot carries the raw authored label; the UI derives the locked wording.
 player.pack.push(item('key',{quantity:1}));
 await p.wait("document.querySelector('[data-door-id=\"relay-door-01\"] button:not([disabled])')",'the unlock control enables once a key is carried');
 await p.evaluate("document.getElementById('interact').click()");
 await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>{const d=r.doors.find(d=>d.id==='relay-door-01');return d.locked===false&&d.closed===false})",'the real Interact button consumes the carried key and opens the door');
 await p.wait("document.getElementById('statusAnnouncement').textContent.includes('Relay control door unlocked.')");
 assert.equal(player.pack.some(it=>it.kind==='key'),false,'the carried access key was consumed');
 assert.equal(player.facts?.keysUsed||0,1,'the unlock is recorded as a used key');
 const fresh=await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.doors.find(d=>d.id==='relay-door-01'))");
 assert.equal(fresh.label,'Relay control door','the wire label is the authored door name, not a duplicated adjective');
 assert.equal(fresh.locked,false);assert.equal(fresh.closed,false);
 await park();
 await p.wait(minimapHasColor(0,-24,[142,230,162]),'the unlocked door repaints green on the live minimap');
 assert.equal(await p.evaluate("window.__doorCues.filter(k=>k==='door').length"),3,'the successful unlock plays exactly one door cue');

 // A still-locked neighbour paints red while the unlocked door paints green on
 // the open tactical map, which is the last visual state check.
 await p.evaluate("document.getElementById('mapToggle').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===false");
 await p.wait(tacticalHasColor(0,24,[255,122,91]),'the tactical map paints the remaining locked door red');
 await p.wait(tacticalHasColor(0,-24,[143,213,154]),'the tactical map paints the unlocked door green');
 await writeFile('/tmp/headshotz-doors-tactical-final.png',Buffer.from((await p.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await p.evaluate("document.getElementById('mapClose').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===true");

 // Leave and resume the same live deployment: the resumed snapshot must carry
 // the already-consumed unlock rather than a stale locked-door assumption.
 await p.evaluate("document.getElementById('leave').click()");
 await p.wait("document.getElementById('play').style.display==='none' && document.getElementById('resume').hidden===false");
 await p.evaluate("document.getElementById('resume').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const resumed=await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>{const d=r.doors.find(d=>d.id==='relay-door-01');return {locked:d.locked,closed:d.closed}})");
 assert.deepEqual(resumed,{locked:false,closed:false},'reconnect reads the authoritative unlocked door');
 await approachDoor(locked());
 await p.wait("document.getElementById('hint').textContent.includes('close Relay control door')",'the resumed operator can toggle the unlocked door through the normal prompt');
 assert.equal(await p.evaluate("document.querySelector('[data-door-id=\"relay-door-01\"] button').textContent"),'Toggle door','the resumed pack exposes a toggle, never a stale unlock');
 await park();

 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({runtimeRoot:root.href,ordinaryDoorClosedWithE:true,ordinaryDoorOpenedWithE:true,lockedDoorDisabledWithoutKey:true,noticeAnnounced:true,minimapClosedAmber:true,minimapOpenGreen:true,tacticalMapDoorMarkers:true,reconnectAuthoritative:true,keyConsumed:true,keysUsed:1,doorCues:3,browserErrorCount:p.errors.length,htmlScreenshots:['/tmp/headshotz-doors-world-closed.png','/tmp/headshotz-doors-tactical.png','/tmp/headshotz-doors-tactical-final.png'],scope:'One isolated authenticated headless Chrome context against a local authoritative service. Door coordinates and time are server fixtures; map markers are read from the live canvases. Audio witnesses the native synthesis call; human mix and real-network acceptance remain unverified.'}));
}catch(error){console.error(JSON.stringify({error:error.message}));throw error}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
