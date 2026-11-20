// Three isolated Chrome contexts in one opt-in raid party: each operator picks a
// squad role in the party card, the authoritative snapshots carry those roles, and
// the roles change real behavior (scout ping lifetime, medic revive speed,
// engineer keyless door pick) through the normal client controls.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

let now=1000;
const store=new RaidStore(),{server,raids}=createRaidServer(store,{now:()=>now});
server.listen(0,'127.0.0.1');await once(server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+server.address().port;
const h=await browserHarness();
const idle=p=>p.wait("document.body.getAttribute('aria-busy')==='false'");
async function register(p,suffix){
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate(`document.querySelector('[name=username]').value='roles_${suffix}_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long squad roles password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 return p.evaluate("fetch('/api/profile').then(r=>r.json())");
}
let a,b,c;
try{
 a=await h.page();b=await h.page();c=await h.page();
 for(const p of [a,b,c])await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 const leader=await register(a,'scout'),medic=await register(b,'medic'),engineer=await register(c,'engineer');
 assert.deepEqual(await a.evaluate("(()=>{const s=document.getElementById('partyRole');return [s&&s.options.length,[...s.options].slice(1).map(o=>o.value).join(',')]})()"),[5,'scout,medic,engineer,hauler']);
 assert.match(await a.evaluate("document.getElementById('partyRole').querySelector('option[value=hauler]').title"),/4 more slots and 8 kg/,'the hauler option names its authoritative bonus');
 await a.evaluate("document.getElementById('partyMode').value='trio';document.getElementById('partyCreate').click()");await idle(a);
 await a.wait("document.getElementById('partyState').textContent.includes('Invite')");
 const party=await a.evaluate("fetch('/api/party').then(r=>r.json())");
 for(const p of [b,c]){await p.evaluate(`document.getElementById('partyCode').value=${JSON.stringify(party.id)};document.getElementById('partyJoin').click()`);await idle(p)}
 for(const [p,role] of [[a,'scout'],[b,'medic'],[c,'engineer']]){
  await p.evaluate(`document.getElementById('recovery').checked=true;document.getElementById('partyRole').value=${JSON.stringify(role)};document.getElementById('partyReady').click()`);
  await p.wait("document.getElementById('partyRoster').textContent.includes('READY') && document.body.getAttribute('aria-busy')==='false'");
 }
 const roster=await c.evaluate("document.getElementById('partyRoster').textContent");
 for(const label of ['Scout','Medic','Engineer'])assert.ok(roster.includes(label),'party roster names the '+label+' role');
 const readyLoadouts=JSON.parse(store.db.prepare('SELECT loadout FROM party_members WHERE account=?').get(leader.id).loadout);
 assert.equal(readyLoadouts.role,'scout');
 await a.wait("!document.getElementById('deploy').disabled");await a.evaluate("document.getElementById('deploy').click()");
 for(const p of [a,b,c])await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const operator=id=>raids.byAccount.get(id),raid=()=>raids.raids.get(operator(leader.id).raidId);
 const snap=await a.evaluate("fetch('/api/raid').then(r=>r.json())");
 for(const [id,role] of [[leader.id,'scout'],[medic.id,'medic'],[engineer.id,'engineer']]){
  assert.equal(snap.squad.find(q=>q.id===id).role,role);
  assert.equal(operator(id).role,role);
 }
 assert.equal(snap.self.role,'scout');
 assert.equal(await b.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>s.self.role)"),'medic');
 assert.equal(await c.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>s.self.role)"),'engineer');
 for(const [p,id,role] of [[a,medic.id,'Medic'],[a,engineer.id,'Engineer']])await p.wait(`(()=>{const z=document.querySelector('[data-target-id="${id}"]');return !!z&&z.textContent.includes('${role}')&&/\\b${role}\\b/.test(z.getAttribute('aria-label')||'')})()`);
 assert.match(await a.evaluate("document.querySelector('[data-target-id=\""+engineer.id+"\"]').getAttribute('aria-label')"),/Engineer role/);

 raid().machines=[];raid().caches=[];raid().bags=[];raid().world={...raid().world,blocks:[],ramps:[],hazards:[]};
 const t0=now;
 await a.evaluate("document.getElementById('pingKind').value='rally';document.getElementById('sendPing').click()");await idle(a);
 const scoutPing=raid().pings.find(x=>x.owner===leader.id);
 assert.equal(scoutPing.until-t0,30,'scout ping lifetime is 30 seconds');

 Object.assign(operator(leader.id),{x:0,y:0,z:0,move:{x:0,z:0},protectedUntil:0,downed:true,hp:0,bleedUntil:now+25,alive:true});
 Object.assign(operator(medic.id),{x:0,y:0,z:1.5,move:{x:0,z:0},protectedUntil:0});
 const row=`document.querySelector('[data-rescue="${leader.id}"]')`,revive=`[...${row}.querySelectorAll('button')].find(b=>b.textContent==='Revive')`;
 await b.wait(`${row} && ${revive} && !${revive}.disabled`);
 assert.match(await b.evaluate(`${row}.textContent`),/Scout/,'the downed roster names the squadmate role');
 assert.match(await b.evaluate(`${revive}.getAttribute('title')`),/Medic role: revive completes in 3.5 seconds/);
 assert.match(await b.evaluate(`${revive}.getAttribute('aria-label')`),/Revive .* \(Medic: 3.5 seconds\)/);
 await b.evaluate(`${revive}.click()`);await idle(b);
 assert.equal(operator(medic.id).reviving.target,leader.id);
 now=t0+3.4;raids.tick(.05);
 await b.wait("document.getElementById('interactionStatus').textContent.includes('Reviving squadmate')");
 assert.equal(operator(leader.id).downed,true,'revive is still in progress at 3.4 seconds');
 now=t0+3.6;raids.tick(.05);
 await b.wait(`!${row}`);
 assert.equal(operator(leader.id).downed,false);assert.equal(operator(leader.id).hp,30);

 const door=raid().world.doors.find(d=>d.locked);
 assert.ok(door,'the raid has a locked door');
 Object.assign(operator(engineer.id),{x:door.x,y:door.y||0,z:door.z,move:{x:0,z:0},protectedUntil:0});
 const keysBefore=operator(engineer.id).equipment.filter(it=>it.kind==='key').length+operator(engineer.id).pack.filter(it=>it.kind==='key').length;
 const doorControl=`document.querySelector('[data-door-id="${door.id}"]')`;
 await c.wait(`${doorControl} && [...${doorControl}.querySelectorAll('button')].some(b=>b.textContent==='Pick lock')`);
 await c.evaluate(`[...${doorControl}.querySelectorAll('button')].find(b=>b.textContent==='Pick lock').click()`);await idle(c);
 assert.equal(door.locked,false,'the engineer picks the locked door');
 assert.equal(operator(engineer.id).facts.doorsPicked,1);
 assert.equal(operator(engineer.id).facts.keysUsed||0,0);
 assert.equal(operator(engineer.id).equipment.filter(it=>it.kind==='key').length+operator(engineer.id).pack.filter(it=>it.kind==='key').length,keysBefore,'no key is consumed');
 for(const p of [a,b,c])assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({roleSelectOptions:true,haulerRoleOption:true,rosterRoles:true,snapshotRoles:true,scoutPingSeconds:30,medicReviveSeconds:3.5,engineerKeylessPick:true,keysBeforeAfter:keysBefore,browserErrors:[]}));
}catch(error){
 const state=await c.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>({self:s.self,x:s.self.x,z:s.self.z,doors:s.doors,reviving:s.self.reviving,error:document.getElementById('message').textContent,hint:document.getElementById('hint').textContent,pack:document.getElementById('pack').textContent.slice(0,400),play:document.getElementById('play').style.display,errors:window.__errors}))").catch(e=>String(e));
 console.error(JSON.stringify({state}));throw error
}finally{await h.close();server.close();await once(server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
