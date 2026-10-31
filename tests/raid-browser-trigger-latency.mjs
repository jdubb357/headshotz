import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const runtimeRoot=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',runtimeRoot)),{createRaidServer}=await import(new URL('server/main.mjs',runtimeRoot));
const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness(),sleep=ms=>new Promise(r=>setTimeout(r,ms));let page;
const key=(p,code,down)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:code.charCodeAt(3)});
try{
 const p=page=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='fire_latency_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long latency browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())"),gun=profile.items.find(it=>it.kind==='weapon');
 await p.evaluate(`document.querySelector('#stash [data-equip][value="${gun.id}"]').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()`);
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const actor=()=>runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(actor().raidId);raid.machines=[];
 await key(p,'KeyB',true);await key(p,'KeyB',false);await p.evaluate("document.getElementById('view').focus()");
 await p.evaluate(`(()=>{const original=window.fetch.bind(window),wait=ms=>new Promise(r=>setTimeout(r,ms));window.__lag={inFlight:0,maxInFlight:0,requests:[],rejections:[]};window.fetch=async(url,options)=>{if(!String(url).endsWith('/api/action'))return original(url,options);const data=JSON.parse(options.body),entry={type:data.type,seq:data.seq,at:performance.now()};window.__lag.requests.push(entry);window.__lag.inFlight++;window.__lag.maxInFlight=Math.max(window.__lag.maxInFlight,window.__lag.inFlight);try{await wait(75);const response=await original(url,options);if(!response.ok){const failure=await response.clone().json();window.__lag.rejections.push({status:response.status,message:failure.error})}await wait(75);return response}finally{window.__lag.inFlight--}}})()`);
 await sleep(1300);const before=actor().facts.roundsFired||0;
 await key(p,'KeyF',true);await sleep(4000);await key(p,'KeyF',false);await sleep(350);
 const stationaryRounds=(actor().facts.roundsFired||0)-before,stationary=await p.evaluate("({maxInFlight:window.__lag.maxInFlight,rejections:window.__lag.rejections,requests:window.__lag.requests.map(({type,seq})=>({type,seq}))})");
 const atRelease=actor().facts.roundsFired||0;await sleep(400);assert.equal(actor().facts.roundsFired||0,atRelease,'release must stop held automatic fire after the in-flight action settles');

 const start={x:actor().x,z:actor().z};await key(p,'KeyW',true);await key(p,'KeyF',true);await sleep(800);await key(p,'KeyF',false);await key(p,'KeyW',false);await sleep(700);
 const movementDistance=Math.hypot(actor().x-start.x,actor().z-start.z),stopped=actor().move.x===0&&actor().move.z===0;
 const report={runtimeRoot:runtimeRoot.href,latencyMs:150,holdMs:4000,stationaryRounds,stationaryFireRequests:stationary.requests.filter(r=>r.type==='fire').length,stationaryMoveRequests:stationary.requests.filter(r=>r.type==='move').length,maxInFlight:stationary.maxInFlight,rejections:stationary.rejections,movementDistance,stopped,ammoConserved:actor().ammo===30-(actor().facts.roundsFired||0),browserErrors:p.errors,scope:'Real Chrome keyboard/HTTP/service with 75 ms request and response delays, machines removed, one paid rifle. This is application delay over loopback, not packet-level WAN or human weapon-feel acceptance.'};
 if(process.env.RAID_TRIGGER_REPORT)await writeFile(process.env.RAID_TRIGGER_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
 assert.ok(stationaryRounds>=17,'stationary rifle should not queue idle polls between every shot');assert.equal(report.maxInFlight,1);assert.equal(report.ammoConserved,true);assert.ok(movementDistance>=1,'movement must still reach authority while firing');assert.equal(stopped,true);assert.deepEqual(p.errors,[]);
}catch(error){console.error(JSON.stringify({errors:page?.errors,state:await page?.evaluate("({message:document.getElementById('message').textContent,hint:document.getElementById('hint').textContent})")}));throw error}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
