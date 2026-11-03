import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();let page;
const idle=p=>p.wait("document.body.getAttribute('aria-busy')==='false'");
try{
 const p=page=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='ready_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long readiness browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())"),gun=profile.items.find(it=>it.kind==='weapon');
 await p.evaluate(`(()=>{document.getElementById('recovery').checked=false;document.getElementById('recovery').dispatchEvent(new Event('change',{bubbles:true}));for(const kind of ['equip','insure']){const input=[...document.querySelectorAll('#stash [data-'+kind+']')].find(e=>e.value===${JSON.stringify(gun.id)});input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))}})()`);
 await idle(p);
 await p.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('partyMode').value='solo';document.getElementById('partyCreate').click()");await idle(p);
 const before=store.profile(profile.id);
 await p.evaluate("document.getElementById('partyReady').click()");await idle(p);
 assert.equal(store.partyFor(profile.id).members[0].ready,true);
 assert.deepEqual(store.profile(profile.id),before,'ready must not charge insurance or change inventory');

 // Simulate a stale persisted ready flag from another process/older client.
 store.transaction(()=>{const state=store.state(profile.id);state.credits=0;state.grantCredits=0;store.save(profile.id,state)});
 await p.wait("document.getElementById('partyRoster').textContent.includes('Insufficient insurance credits') && document.getElementById('deploy').disabled");
 await p.evaluate("document.getElementById('partyReady').click()");await idle(p);
 assert.match(await p.evaluate("document.getElementById('message').textContent"),/Insufficient insurance credits/);
 assert.equal(store.profile(profile.id).activeDeployment,null);
 assert.equal(store.db.prepare('SELECT count(*) n FROM insurance').get().n,0);

 // The page still holds this gear selection while a second device sells it.
 store.trade(profile.id,{type:'sell',itemId:gun.id});
 await p.evaluate("document.getElementById('partyReady').click()");await idle(p);
 assert.match(await p.evaluate("document.getElementById('message').textContent"),/not owned/);
 assert.equal(await p.evaluate(`!![...document.querySelectorAll('#stash [data-equip]')].find(e=>e.value===${JSON.stringify(gun.id)})`),false,'rejected readiness refreshes the actual stash');
 assert.equal(await p.evaluate("document.getElementById('deploy').disabled"),true);
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('recovery').dispatchEvent(new Event('change',{bubbles:true}))");await idle(p);
 await p.evaluate("document.getElementById('partyReady').click()");await idle(p);
 assert.equal(store.partyFor(profile.id).members[0].ready,true);
 assert.equal(await p.evaluate("document.getElementById('deploy').disabled"),false);
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({readyWithoutDebit:true,staleReadyRevalidated:true,invalidInsuranceBlocksDeploy:true,rejectedReadyRefreshesSoldGear:true,recoveryStillWorks:true,browserErrors:p.errors,scope:'Isolated Chrome; second-device balance and sale changes are server fixtures.'}));
}catch(error){console.error(JSON.stringify({errors:page?.errors,state:await page?.evaluate("({message:document.getElementById('message').textContent,roster:document.getElementById('partyRoster').textContent})")}));throw error}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
