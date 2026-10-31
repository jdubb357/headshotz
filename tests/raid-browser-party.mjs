// Requires an isolated running raid service and Chrome with remote debugging.
import assert from 'node:assert/strict';
import {browserHarness} from './browser-harness.mjs';
const browser=await browserHarness();
async function register(p,suffix){
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const name='party_'+suffix+'_'+Date.now().toString(36);
 await p.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long party test password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
}
try{
 const leader=await browser.page(),friend=await browser.page();await register(leader,'a');await register(friend,'b');
 const owned=await leader.evaluate("fetch('/api/profile').then(r=>r.json())"),weapon=owned.items.find(it=>it.kind==='weapon');await leader.evaluate(`document.querySelector('#stash input[data-equip][value="${weapon.id}"]').checked=true;document.getElementById('presetName').value='Party primary';document.getElementById('savePreset').click()`);await leader.wait("document.body.getAttribute('aria-busy')==='false' && document.getElementById('presets').value==='Party primary'");
 await leader.evaluate("document.getElementById('partyMode').value='duo';document.getElementById('partyCreate').click()");
 await leader.wait("document.getElementById('partyState').textContent.includes('Invite') && document.body.getAttribute('aria-busy')==='false'");
 const party=await leader.evaluate("fetch('/api/party').then(r=>r.json())");
 await friend.evaluate(`document.getElementById('partyCode').value=${JSON.stringify(party.id)};document.getElementById('partyJoin').click()`);
 await friend.wait("!document.getElementById('partyReady').hidden && document.body.getAttribute('aria-busy')==='false'");
 for(const p of [leader,friend]){await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('partyReady').click()");await p.wait("document.getElementById('partyRoster').textContent.includes('READY') && document.body.getAttribute('aria-busy')==='false'")}
 await leader.evaluate("document.getElementById('applyPreset').click()");
 await leader.wait("document.body.getAttribute('aria-busy')==='false'");
 const unready=await leader.evaluate("Promise.all([fetch('/api/profile').then(r=>r.json()),fetch('/api/party').then(r=>r.json())]).then(([me,p])=>p.members.find(m=>m.account===me.id).ready)");assert.equal(unready,false);
 await leader.evaluate("document.getElementById('partyReady').click()");await leader.wait("document.body.getAttribute('aria-busy')==='false'");
 await leader.wait("!document.getElementById('deploy').disabled");await leader.evaluate("document.getElementById('deploy').click()");
 for(const p of [leader,friend])await p.wait("document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('HP 100')");
 const a=await leader.evaluate("fetch('/api/raid').then(r=>r.json())"),b=await friend.evaluate("fetch('/api/raid').then(r=>r.json())");
 assert.equal(a.raidId,b.raidId);assert.equal(a.self.team,b.self.team);assert.equal(a.players.filter(p=>p.team===a.self.team).length,1);
 assert.deepEqual(leader.errors,[]);assert.deepEqual(friend.errors,[]);
 console.log(JSON.stringify({partyInvite:true,separateAccounts:true,readyChecks:true,groupDeployment:true,sameRaid:true,sameTeam:true,browserErrors:[]}));
}finally{await browser.close()}
