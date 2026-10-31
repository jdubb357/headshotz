import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const runtimeRoot=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',runtimeRoot));
const {createRaidServer}=await import(new URL('server/main.mjs',runtimeRoot));
import {browserHarness} from './browser-harness.mjs';

let now=1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now:()=>now});
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();let page;
const idle=p=>p.wait("document.body.getAttribute('aria-busy')==='false'");
try{
 const p=page=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='rescue_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long rescue browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('partyMode').value='trio';document.getElementById('partyCreate').click()");await idle(p);
 const party=store.partyFor(profile.id),patientId=store.register('rescue_browser_patient','a long patient password').id,supportId=store.register('rescue_browser_support','a long support password').id;
 for(const id of [patientId,supportId])runtime.raids.party(id,{type:'join',code:party.id});
 for(const id of [patientId,supportId])runtime.raids.party(id,{type:'ready',ready:true,loadout:{itemIds:[],recovery:true}});
 await p.evaluate("document.getElementById('partyReady').click()");await idle(p);await p.wait("!document.getElementById('deploy').disabled");await p.evaluate("document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const actor=()=>runtime.raids.byAccount.get(profile.id),patient=()=>runtime.raids.byAccount.get(patientId),support=()=>runtime.raids.byAccount.get(supportId),raid=()=>runtime.raids.raids.get(actor().raidId);
 raid().world={...raid().world,blocks:[[0,.7132,5,.001,3]],ramps:[],hazards:[]};raid().machines=[];
 for(const [index,operator]of [actor(),patient(),support()].entries())Object.assign(operator,{x:0,y:0,z:index===1?1.5:index===2?5:0,move:{x:0,z:0},protectedUntil:0});
 Object.assign(patient(),{downed:true,hp:0,bleedUntil:1025});
 const row=`document.querySelector('[data-rescue="${patientId}"]')`,revive=`[...${row}.querySelectorAll('button')].find(b=>b.textContent==='Revive')`,carry=`[...${row}.querySelectorAll('button')].find(b=>b.textContent==='Carry squadmate')`;
 await p.wait(`${row} && ${revive}.disabled && ${carry}.disabled`);
 assert.ok(await p.evaluate(`${row}.textContent.includes('clear access')`));
 raid().world.blocks=[];await p.wait(`${revive} && !${revive}.disabled && !${carry}.disabled`);
 await p.evaluate(`${revive}.click()`);await idle(p);assert.ok(actor().reviving);
 now=1001;runtime.raids.atomic(()=>runtime.raids.damage(raid(),patient(),2));assert.equal(actor().reviving,null);
 await p.wait("!document.getElementById('interactionStatus').textContent.includes('Reviving')");
 await p.evaluate(`${revive}.click()`);await idle(p);now=1006;
 await p.wait(`!${row}`);assert.equal(patient().downed,false);assert.equal(patient().hp,30);

 runtime.raids.atomic(()=>runtime.raids.damage(raid(),patient(),101,{zone:'head'}));
 await p.wait(`${row} && ${carry} && !${carry}.disabled`);await p.evaluate(`${carry}.focus();${carry}.click()`);await idle(p);
 await p.wait(`${row}.textContent.includes('Drop squadmate')`);assert.equal(actor().carrying,patientId);assert.equal(await p.evaluate("document.activeElement.dataset.rescueAction"),'carry');assert.equal(await p.evaluate("document.activeElement.textContent"),'Drop squadmate');
 runtime.raids.atomic(()=>runtime.raids.damage(raid(),actor(),101,{zone:'head'}));assert.equal(actor().carrying,null);assert.equal(patient().carrier,null);
 await p.wait("document.getElementById('hud').textContent.startsWith('DOWNED')");
 Object.assign(support(),{x:actor().x,y:actor().y,z:actor().z});runtime.raids.action(supportId,{type:'revive',seq:1,targetId:profile.id});now=1011;
 await p.wait("document.getElementById('hud').textContent.startsWith('HP 30')");
 patient().z=10;runtime.raids.tick(.05);assert.equal(patient().z,10,'recovered carrier must not teleport the dropped patient');

 Object.assign(patient(),{x:actor().x,y:actor().y,z:actor().z});raid().caches=[];raid().bags=[];
 const exit=raid().exits.find(e=>e.kind==='call');Object.assign(exit,{x:actor().x,y:actor().y,z:actor().z,openAt:1010,closeAt:1040});
 await p.wait(`${row} && ${carry} && !${carry}.disabled`);await p.evaluate(`${carry}.click()`);await idle(p);
 await p.evaluate("document.getElementById('interact').click()");await idle(p);assert.ok(actor().board);now=1014;
 await p.wait("document.getElementById('hint').textContent.includes('EXTRACT')");
 assert.equal(store.results(profile.id)[0].outcome,'extract');assert.equal(store.results(patientId)[0].outcome,'extract');assert.notEqual(store.results(profile.id)[0].id,store.results(patientId)[0].id);assert.equal(exit.usedSeats,2);
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({runtimeRoot:runtimeRoot.href,throughCoverControlsDisabled:true,clearAccessUpdatesWithoutInventoryChange:true,patientDamageInterrupts:true,fiveSecondRevive:true,carryDropLabel:true,rescueKeyboardFocusPreserved:true,downedCarrierReleases:true,noRecoveryTeleport:true,carriedPairExtracts:true,separateSettlements:true,browserErrors:p.errors,scope:'Isolated Chrome trio; two support accounts, positions, cover and time are authoritative server fixtures. Not human rescue balance or physical-device acceptance.'}));
}catch(error){console.error(JSON.stringify({errors:page?.errors,state:await page?.evaluate("({message:document.getElementById('message').textContent,roster:document.getElementById('partyRoster').textContent,hint:document.getElementById('hint').textContent,pack:document.getElementById('pack').textContent})")}));throw error}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
