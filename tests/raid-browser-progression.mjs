import assert from 'node:assert/strict';
import {browserHarness} from './browser-harness.mjs';
const browser=await browserHarness();
try{
 const page=await browser.page();await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const name='economy_'+Date.now().toString(36);
 await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long economy test password';document.getElementById('register').click()`);
 await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const state=()=>page.evaluate("fetch('/api/profile').then(r=>r.json())");
 async function clickText(parent,text){
  const clicked=await page.evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(parent+' button')})].find(b=>b.textContent.includes(${JSON.stringify(text)})&&!b.disabled);if(!b)return false;b.click();return true})()`);assert.equal(clicked,true,`Available control: ${text}`);
  await page.wait("document.body.getAttribute('aria-busy')==='false'");
 }
 assert.equal(await page.evaluate("document.querySelectorAll('#trader section').length"),3);
 for(const material of ['steel','wire','chem'])await clickText('#trader','Buy '+material);
 await clickText('#workshop','Craft Field Medkit');
 await clickText('#upgrades','bench 0/2');
 await clickText('#trader','Buy steel');
 await clickText('#workshop','Craft Survey Optic');
 let profile=await state();const weapon=profile.items.find(it=>it.kind==='weapon'),mod=profile.items.find(it=>it.kind==='mod');assert.ok(mod);
 await page.evaluate(`document.getElementById('attachmentWeapon').value=${JSON.stringify(weapon.id)};document.getElementById('attachmentMod').value=${JSON.stringify(mod.id)};document.getElementById('attach').click()`);
 await page.wait("document.body.getAttribute('aria-busy')==='false' && document.getElementById('installedMods').textContent.includes('Survey Optic')");
 profile=await state();assert.equal(profile.items.find(it=>it.id===weapon.id).attachments[0].id,mod.id);
 await page.evaluate("document.getElementById('stashSearch').value='rifle';document.getElementById('stashSearch').dispatchEvent(new Event('input'))");
 assert.equal(await page.evaluate("[...document.getElementById('stash').children].filter(el=>getComputedStyle(el).display!=='none').length"),1);
 await page.evaluate("document.getElementById('stashSearch').value='';document.getElementById('stashSearch').dispatchEvent(new Event('input'))");
 await page.evaluate(`(()=>{const input=[...document.querySelectorAll('#stash [data-equip]')].find(e=>e.value===${JSON.stringify(weapon.id)});input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('presetName').value='Scout run'})()`);
 await page.wait("document.body.getAttribute('aria-busy')==='false'");await clickText('main','Save selected loadout');
 profile=await state();assert.deepEqual(profile.presets['Scout run'],[weapon.id]);
 await page.evaluate("for(const input of document.querySelectorAll('#stash [data-equip]'))input.checked=false;document.getElementById('presets').value='Scout run';document.getElementById('applyPreset').click()");
 await page.wait("document.body.getAttribute('aria-busy')==='false'");
 assert.equal(await page.evaluate(`document.querySelector('#stash [data-equip]:checked')?.value===${JSON.stringify(weapon.id)}`),true);
 await page.evaluate(`(()=>{const input=[...document.querySelectorAll('#stash [data-insure]')].find(e=>e.value===${JSON.stringify(weapon.id)});input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
 await page.wait("document.body.getAttribute('aria-busy')==='false'");
 assert.ok(await page.evaluate("document.getElementById('riskSummary').textContent.includes('Insurance premium 20 credits')"));
 const before=profile.credits;await clickText('main','Deploy selected equipment');await page.wait("document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('HP')");
 profile=await state();assert.equal(profile.credits,before-20);assert.equal(profile.insurance[0].status,'covered');
 const raid=await page.evaluate("fetch('/api/raid').then(r=>r.json())");assert.equal(raid.self.equipment.find(it=>it.id===weapon.id).attachments[0].id,mod.id);
 assert.deepEqual(page.errors,[]);
 console.log(JSON.stringify({threeTraders:true,inventoryCrafting:true,workbenchUpgrade:true,attachmentInstall:true,stashSearch:true,loadoutPreset:true,insuranceQuote:true,insuredDeployment:true,browserErrors:[]}));
}finally{await browser.close()}
