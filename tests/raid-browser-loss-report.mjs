import assert from 'node:assert/strict';
import {browserHarness} from './browser-harness.mjs';
const browser=await browserHarness();
try{
 const p=await browser.page();await p.command('Page.bringToFront');await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const name='report_'+Date.now().toString(36);
 await p.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long report test password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())"),weapon=profile.items.find(it=>it.kind==='weapon');
 await p.evaluate(`(()=>{const input=[...document.querySelectorAll('#stash [data-equip]')].find(e=>e.value===${JSON.stringify(weapon.id)});input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await p.wait("document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("document.getElementById('deploy').click()");await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("document.getElementById('leave').click()");await p.wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
 const until=Date.now()+60000;let settled=false;
 while(Date.now()<until){settled=await p.evaluate("!!document.querySelector('#records summary')");if(settled)break;await new Promise(r=>setTimeout(r,500))}
 assert.equal(settled,true,'Base automatically refreshed after operator death or disconnect grace expiry');
 const records=await p.evaluate("fetch('/api/results').then(r=>r.json())");assert.equal(records.length,1);assert.ok(['death','disconnect'].includes(records[0].outcome));
 assert.equal(records[0].lostItems.some(it=>it.id===weapon.id),true);
 const after=await p.evaluate("fetch('/api/profile').then(r=>r.json())");assert.equal(after.items.some(it=>it.id===weapon.id),false);
 assert.equal(await p.evaluate("document.getElementById('records').textContent.includes('Dropped or lost')"),true);assert.equal(records[0].reportVersion,1);assert.equal(records[0].committedItems.some(it=>it.id===weapon.id),true);assert.ok(records[0].reason);assert.equal(records[0].ledger.after.total-records[0].ledger.before.total,0);assert.equal(await p.evaluate("document.getElementById('records').textContent.includes('Committed loadout (deployment snapshot)') && document.getElementById('records').textContent.includes('Settlement credits:') && document.getElementById('records').textContent.includes('No equipment was insured') && !document.getElementById('records').textContent.includes('cause was not recorded')"),true);assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({leftScreenWithoutEscape:true,realOperatorSettlement:true,automaticBaseRefresh:true,ownedWeaponLost:true,itemizedReport:true,browserErrors:[]}));
}finally{await browser.close()}
