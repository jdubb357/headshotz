// Render the real synth graph through Chrome's offline Web Audio engine.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const root=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',root)),{createRaidServer}=await import(new URL('server/main.mjs',root));
const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
try{
 const p=await h.page('/raid-privacy.html');
 const result=await p.evaluate(`(async()=>{
  const {RaidAudio,MACHINE_CUES,UTILITY_CUES,WEAPON_CUES,ACTION_CUES}=await import('./raid-audio.mjs');
  async function render(kind,{pan=0,mute=false,count=1}={}){
   const ctx=new OfflineAudioContext(2,48000*2,48000),audio=new RaidAudio();
   // Offline rendering starts suspended; expose scheduling state without changing
   // any oscillator, envelope, routing, panner or real DSP implementation.
   audio.context={state:'running',currentTime:0,destination:ctx.destination,createGain:()=>ctx.createGain(),createStereoPanner:()=>ctx.createStereoPanner(),createOscillator:()=>ctx.createOscillator()};audio.volume=mute?0:.7;
   for(let i=0;i<count;i++)audio.play(kind,{gain:1,pan});const peakVoices=audio.active,buffer=await ctx.startRendering();
   const channels=[...Array(2)].map((_,i)=>buffer.getChannelData(i)),rms=channels.map(a=>Math.sqrt(a.reduce((n,v)=>n+v*v,0)/a.length));
   let hash=0;for(let i=0;i<channels[0].length;i+=7)hash=(Math.imul(hash,31)+Math.round(channels[0][i]*1e8))|0;
   return {rms,hash,peakVoices,remaining:audio.active};
  }
  const cues={};for(const kind of Object.keys(MACHINE_CUES))cues[kind]=await render(kind);
  const utilities={};for(const kind of Object.keys(UTILITY_CUES))utilities[kind]=await render(kind);
  const weapons={};for(const kind of Object.keys(WEAPON_CUES))weapons[kind]=await render('shot:'+kind);
  const actions={};for(const kind of Object.keys(ACTION_CUES))actions[kind]=await render(kind);
  return {cues,utilities,weapons,actions,right:await render('hunter',{pan:1}),muted:await render('overlord',{mute:true}),mutedWeapon:await render('shot:ar',{mute:true}),mutedAction:await render('boarding',{mute:true}),bounded:await render('scout',{count:30})};
 })()`);
 for(const cue of [...Object.values(result.cues),...Object.values(result.utilities),...Object.values(result.weapons),...Object.values(result.actions)]){assert.ok(cue.rms.every(v=>v>.0001));assert.equal(cue.remaining,0)}
 assert.equal(new Set(Object.values(result.cues).map(c=>c.hash)).size,5,'each archetype renders a different original waveform');
 assert.equal(new Set(Object.values(result.weapons).map(c=>c.hash)).size,6,'each owned firearm has a distinct rendered signature');
 assert.equal(new Set(Object.values(result.actions).map(c=>c.hash)).size,12,'important actions/statuses have distinct rendered signatures');
 assert.deepEqual(result.mutedWeapon.rms,[0,0]);assert.deepEqual(result.mutedAction.rms,[0,0]);
 assert.ok(result.right.rms[1]>result.right.rms[0]*10);assert.deepEqual(result.muted.rms,[0,0]);assert.equal(result.muted.peakVoices,0);assert.equal(result.bounded.peakVoices,12);assert.equal(result.bounded.remaining,0);assert.deepEqual(p.errors,[]);
 const game=await h.page();await game.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await game.evaluate("document.querySelector('[name=username]').value='audio_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long browser audio password';document.getElementById('register').click()");
 await game.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const account=await game.evaluate("fetch('/api/profile').then(r=>r.json())");store.trade(account.id,{type:'buy',trader:'outfitter',sku:'ammo_medium'});
 await game.command('Page.reload');await game.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await game.evaluate("fetch('/api/profile').then(r=>r.json())");
 await game.evaluate("(async()=>{const {RaidAudio}=await import('./raid-audio.mjs');const original=RaidAudio.prototype.play;window.__cues=[];RaidAudio.prototype.play=function(kind,spatial){window.__cues.push(kind);return original.call(this,kind,spatial)}})()");
 await game.evaluate(`for(const input of document.querySelectorAll('#stash [data-equip]'))input.checked=${JSON.stringify(profile.items.filter(i=>i.kind==='weapon'||i.kind==='ammo').map(i=>i.id))}.includes(input.value);document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()`);
 await game.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const actor=()=>runtime.raids.byAccount.get(profile.id);runtime.raids.raids.get(actor().raidId).machines=[];
 const key=async code=>{for(const type of ['keyDown','keyUp']){await game.command('Input.dispatchKeyEvent',{type,code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:code.charCodeAt(3)});if(type==='keyDown')await new Promise(r=>setTimeout(r,80))}};
 await key('KeyB');await game.evaluate("document.getElementById('view').focus()");await key('KeyF');
 await game.wait("window.__cues.includes('shot:ar')");await new Promise(r=>setTimeout(r,250));await key('KeyR');
 await game.wait("window.__cues.includes('reload')");assert.equal(actor().ammo,30);
 await new Promise(r=>setTimeout(r,2200));const reloads=await game.evaluate("window.__cues.filter(k=>k==='reload').length");await key('KeyR');
 await new Promise(r=>setTimeout(r,350));assert.equal(await game.evaluate("window.__cues.filter(k=>k==='reload').length"),reloads,'rejected full-magazine reload must not play an accepted action cue');
 actor().hp-=10;await game.wait("window.__cues.includes('hurt')");assert.equal(await game.evaluate("window.__cues.includes('hit')"),false,'damage must not play both old and new cues');
 assert.deepEqual(game.errors,[]);
 console.log(JSON.stringify({runtimeRoot:root.href,distinctMachineCues:5,utilityCuesRendered:4,distinctWeaponCues:6,distinctActionCues:12,realWebAudioRendering:true,directionalStereo:true,muteSilent:true,boundedVoices:true,nodesReleased:true,nativeFireAndAcceptedReload:true,rejectedReloadSilent:true,damageCueNotDoubled:true,browserErrors:[...p.errors,...game.errors],scope:'Actual offline Web Audio rendering and local authoritative native-input integration; not human mix/readability acceptance.'}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
