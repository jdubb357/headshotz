// Boss HUD: only a living, snapshot-visible Foundry Warden gets a panel, and its
// authoritative phase and health text track the server without touching controls.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {hitMachine} from '../server/raid-ai.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const previousUrl=process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const key=(p,code,down=true)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:code.charCodeAt(3)});
const panelState=p=>p.evaluate("(()=>{const b=document.getElementById('bossPanel'),hp=document.getElementById('bossHp');return {hidden:b.hidden,phase:document.getElementById('bossPhase').textContent,name:document.getElementById('bossName').textContent,hpText:document.getElementById('bossHpText').textContent,hpMax:hp.max,hpValue:hp.value,dataPhase:b.dataset.phase,aria:hp.getAttribute('aria-label')}})()");
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='boss_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long boss browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('hud').textContent.includes('HP 100')");
 const player=runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(player.raidId);
 raid.rivals=[];
 const boss={id:'warden_grader',kind:'overlord',x:player.x,y:player.y||0,z:player.z+1.2,hp:760,maxHp:760,yaw:Math.PI,nextAttack:1e12,state:'patrol',home:{x:player.x,y:player.y||0,z:player.z+1.2},bossPhase:'approach'};
 raid.machines=[boss];
 // Ping is a stationary reliable action: its response republishes the snapshot
 // without moving the operator away from the boss being observed.
 const refresh=async()=>{player.nextPing=0;await key(p,'KeyQ');await new Promise(r=>setTimeout(r,60));await key(p,'KeyQ',false);await new Promise(r=>setTimeout(r,300))};
 await p.wait("document.getElementById('view')!==null");
 await p.evaluate("document.getElementById('view').focus()");
 // Record client audio requests so phase stingers can be asserted without
 // depending on the headless browser's real speaker output.
 await p.evaluate("(async()=>{const {RaidAudio}=await import('./raid-audio.mjs');const original=RaidAudio.prototype.play;window.__cues=[];RaidAudio.prototype.play=function(kind,spatial){window.__cues.push(kind);return original.call(this,kind,spatial)}})()");
 await refresh();
 await p.wait("!document.getElementById('bossPanel').hidden",'the living visible Warden opens the panel');
 const approach=await panelState(p);
 assert.equal(approach.hidden,false);assert.equal(approach.name,'Foundry Warden');
 assert.ok(approach.phase.includes('Sentry posture'),approach.phase);
 assert.equal(approach.hpText,'HP 760/760');assert.equal(Number(approach.hpMax),760);assert.equal(Number(approach.hpValue),760);
 assert.equal(approach.dataPhase,'approach');assert.equal(approach.aria,'Foundry Warden health');
 boss.hp=381;hitMachine(runtime.raids,raid,boss,20,0,player.team);
 await refresh();
 await p.wait("document.getElementById('bossPanel').dataset.phase==='furnace'",'the furnace update reaches the HUD');
 await p.wait("window.__cues.filter(k=>k==='furnace').length===1",'one furnace audio sting');
 const furnace=await panelState(p);
 assert.ok(furnace.phase.includes('Furnace vents open'),furnace.phase);assert.equal(furnace.hpText,'HP 374/760');
 const furnaceHazard=await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.hazards.find(h=>h.id==='warden_furnace_warden_grader'))");
 assert.ok(furnaceHazard,'furnace hazard is published in the snapshot');
 assert.equal(furnaceHazard.active,true);assert.equal(furnaceHazard.phase,'furnace');assert.equal(Number(furnaceHazard.radius),9);
 boss.hp=191;hitMachine(runtime.raids,raid,boss,20,0,player.team);
 await refresh();
 await p.wait("document.getElementById('bossPanel').dataset.phase==='meltdown'",'the meltdown update reaches the HUD');
 await p.wait("window.__cues.filter(k=>k==='meltdown').length===1",'one meltdown audio sting');
 const meltdown=await panelState(p);
 assert.equal(meltdown.hidden,false);assert.ok(meltdown.phase.includes('Meltdown')&&meltdown.phase.includes('core exposed'),meltdown.phase);
 assert.equal(meltdown.hpText,'HP 182/760');assert.equal(Number(meltdown.hpValue),182);
 const meltdownHazard=await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>r.hazards.find(h=>h.id==='warden_meltdown_warden_grader'))");
 assert.ok(meltdownHazard,'meltdown hazard is published in the snapshot');
 assert.equal(meltdownHazard.active,true);assert.equal(meltdownHazard.phase,'meltdown');assert.equal(Number(meltdownHazard.radius),14);
 await refresh();
 assert.equal(await p.evaluate("window.__cues.filter(k=>k==='furnace').length"),1,'unchanged snapshots never repeat the furnace sting');
 assert.equal(await p.evaluate("window.__cues.filter(k=>k==='meltdown').length"),1,'unchanged snapshots never repeat the meltdown sting');
 const controls=await p.evaluate("({fire:!document.getElementById('fire').disabled,hud:document.getElementById('hud').textContent.startsWith('HP ')})");
 assert.equal(controls.fire,true,'boss panel does not touch weapon controls');assert.equal(controls.hud,true,'boss panel does not overwrite the HUD');
 // Exercise the render model directly: phase colors, beacon visibility and the
 // unchanged ordinary-machine windup core are deterministic model outputs.
 const visuals=await p.evaluate(`(async()=>{
  const {machineModel,updateActor,beaconModel}=await import('./raid-models.mjs');
  const root=machineModel('overlord');root.add(beaconModel());root.userData.beacon=root.children.at(-1);
  const sample=(phase,time,reduced=false)=>{root.userData.motionReduced=reduced;updateActor(root,{x:0,y:0,z:0,yaw:0,kind:'overlord',state:'patrol',bossPhase:phase},.016,time);return {core:root.userData.core.material.color.getHex(),beacon:root.userData.beacon.userData.beaconRing.material.color.getHex(),visible:root.userData.beacon.visible}};
  const approach=sample('approach',.2);const furnace=sample('furnace',.5);const strobe=sample('meltdown',.5);const still=sample('meltdown',.5,true);
  const scout=machineModel('scout');updateActor(scout,{x:0,y:0,z:0,yaw:0,kind:'scout',state:'windup'},.016,.5);
  return {approach,furnace,strobe,still,scoutCore:scout.userData.core.material.color.getHex()};
 })()`);
 assert.equal(visuals.approach.core,0xff6a52,'approach core stays cool red');
 assert.equal(visuals.furnace.core,0xff9a2f,'furnace core glows amber');assert.equal(visuals.furnace.beacon,0xffb04a);
 assert.equal(visuals.strobe.core,0xfff4ea,'meltdown strobes white');assert.equal(visuals.strobe.beacon,0xff3a2e);
 assert.equal(visuals.still.core,0xff2c1e,'reduced motion holds the meltdown core steady');assert.equal(visuals.still.visible,false,'reduced motion hides the boss beacon');
 assert.equal(visuals.scoutCore,0xffe28e,'ordinary machines keep the windup core cue');
 boss.hp=0;
 await refresh();
 await p.wait("document.getElementById('bossPanel').hidden",'a dead Warden clears the panel');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({approachPanel:true,furnacePanel:true,meltdownPanel:true,hpText:true,phaseUpdate:true,phaseHazards:true,audioStings:true,phaseVisuals:true,reducedMotionRespected:true,progressAccessible:true,clearedOnDeath:true,controlsIntact:true,browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(previousUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previousUrl}
