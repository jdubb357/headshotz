// Optional development dependency supplied outside the checkout. No npm runtime
// dependency is added to the game. Test fixtures arrange positions/exit timing.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
if(!process.env.RAID_PLAYWRIGHT_MODULE)throw new Error('Set RAID_PLAYWRIGHT_MODULE to an installed Playwright index.mjs outside this checkout');
const engines=await import(pathToFileURL(resolve(process.env.RAID_PLAYWRIGHT_MODULE))),root=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',root)),{createRaidServer}=await import(new URL('server/main.mjs',root));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
async function until(fn,label){const deadline=Date.now()+20000;while(Date.now()<deadline){if(await fn())return;await sleep(50)}throw new Error('Timed out: '+label)}
for(const scenario of [{engine:'chromium',mobile:false},{engine:'firefox',mobile:false},{engine:'webkit',mobile:false},{engine:'webkit',mobile:true}]){
 const store=new RaidStore(),runtime=createRaidServer(store);runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port;
 const result={...scenario,runtimeRoot:root.href,passed:false,errors:[]};let browser,page;
 try{
  browser=await engines[scenario.engine].launch({headless:true,...(scenario.engine==='chromium'?{channel:'chrome'}:{})});result.browserVersion=browser.version();
  const context=await browser.newContext({viewport:scenario.mobile?{width:390,height:844}:{width:1280,height:720},deviceScaleFactor:scenario.mobile?2:1,...(scenario.mobile?{isMobile:true,hasTouch:true}:{}),reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
  await page.goto(base+'/raid-online.html');await page.waitForFunction(()=>document.getElementById('message')?.textContent.includes('Sign in'));
  const username='engine_'+scenario.engine+'_'+Number(scenario.mobile)+'_'+Date.now().toString(36),password='a long isolated engine password';
  await page.locator('[name=username]').fill(username);await page.locator('[name=password]').fill(password);await page.locator('#register').click();
  const idle=()=>page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');await page.waitForFunction(()=>!document.getElementById('base').hidden&&document.body.getAttribute('aria-busy')==='false');
  await page.evaluate(async()=>{const r=await fetch('/api/trade',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'buy',trader:'outfitter',sku:'ammo_medium'})});if(!r.ok)throw new Error('Could not buy reserve ammo')});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('base').hidden&&document.body.getAttribute('aria-busy')==='false');
  const profile=await page.evaluate(()=>fetch('/api/profile').then(r=>r.json())),gun=profile.items.find(i=>i.kind==='weapon'),ids=profile.items.filter(i=>i.kind==='weapon'||i.kind==='ammo').map(i=>i.id);
  await page.evaluate(async()=>{const {RaidView}=await import('./raid-view.mjs'),start=RaidView.prototype.start;RaidView.prototype.start=function(...args){window.__engineView=this;return start.apply(this,args)}});
  await page.evaluate(({ids,gun})=>{for(const input of document.querySelectorAll('#stash [data-equip]'))input.checked=ids.includes(input.value);document.querySelector('#stash [data-insure][value="'+gun+'"]').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'))},{ids,gun:gun.id});
  await idle();await page.locator('#deploy').click();await page.waitForFunction(()=>document.getElementById('play').style.display==='block'&&window.__engineView?.snapshot&&document.body.getAttribute('aria-busy')==='false');
  const actor=()=>runtime.raids.byAccount.get(profile.id),raid=()=>runtime.raids.raids.get(actor().raidId);raid().machines=[];raid().world={...raid().world,blocks:[],ramps:[],hazards:[]};
  result.graphics=await page.evaluate(()=>{const v=window.__engineView;return {lost:v.renderer.getContext().isContextLost(),geometries:v.renderer.info.memory.geometries,drawCalls:v.renderer.info.render.calls}});assert.equal(result.graphics.lost,false);assert.ok(result.graphics.geometries>0);
  await page.locator('#view').focus();if(scenario.mobile){await page.locator('#fire').tap();await until(()=>actor().facts.roundsFired>0,'touch shot')}else{await page.keyboard.down('KeyF');await until(()=>actor().facts.roundsFired>0,'keyboard shot');await page.keyboard.up('KeyF')}
  await sleep(300);const fired=actor().facts.roundsFired;assert.equal(actor().ammo,30-fired);await sleep(200);assert.equal(actor().facts.roundsFired,fired,'release stops firing');
  await page.locator('#view').focus();await page.keyboard.press('KeyR');await until(()=>actor().ammo===30,'owned ammo reload');result.nativeFireReload=true;
  const source=raid().caches.find(c=>!(c.y>0)&&c.items.some(i=>i.kind==='material'));assert.ok(source);const sourceId=source.id,material=source.items.find(i=>i.kind==='material');Object.assign(actor(),{x:source.x,y:source.y||0,z:source.z,move:{x:0,z:0}});
  if(await page.locator('#pack').isHidden())await page.locator('#packToggle').click();
  await page.locator('#pack').getByRole('button',{name:'Search '+source.label,exact:true}).click();await until(()=>raid().caches.find(c=>c.id===sourceId).open,'container search');await idle();
  await page.locator('#pack [data-item-id="'+material.id+'"]').getByRole('button',{name:'Take',exact:true}).click();await until(()=>actor().pack.some(i=>i.id===material.id),'pickup');await idle();
  await page.locator('#pack [data-item-id="'+material.id+'"]').getByRole('button',{name:'Secure',exact:true}).click();await until(()=>actor().secure.some(i=>i.id===material.id),'protect');await idle();result.searchTakeSecure=true;
  const exit=raid().exits.find(e=>e.kind==='call');exit.arrival=.1;exit.boarding=.2;Object.assign(actor(),{x:exit.x,y:exit.y||0,z:exit.z,move:{x:0,z:0}});await sleep(300);await page.locator('#view').focus();await page.keyboard.press('KeyE');
  await page.waitForFunction(id=>{const s=window.__engineView.snapshot,e=s.exits.find(e=>e.id===id);return e.openAt>0&&e.openAt<=s.serverTime&&e.closeAt>s.serverTime},exit.id);
  await page.keyboard.press('KeyE');await until(()=>actor().result?.outcome==='extract','authoritative extraction');result.extraction=true;
  await page.locator('#leave').click();await page.waitForFunction(()=>!document.getElementById('base').hidden&&document.getElementById('play').style.display==='none'&&document.body.getAttribute('aria-busy')==='false');
  const bank=await page.evaluate(()=>fetch('/api/profile').then(r=>r.json()));assert.ok(bank.items.some(i=>i.id===material.id));assert.ok(bank.items.some(i=>i.id===gun.id));assert.equal(bank.activeDeployment,null);result.bankReturned=true;
  await page.reload();await page.waitForFunction(()=>!document.getElementById('base').hidden&&document.body.getAttribute('aria-busy')==='false');assert.equal((await page.evaluate(()=>fetch('/api/results').then(r=>r.json())))[0].outcome,'extract');result.reloadPersistence=true;
  result.horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(result.horizontalOverflow,false);assert.deepEqual(result.errors,[]);result.passed=true;
 }catch(error){result.failure=error.message;if(page)result.message=await page.locator('#message').textContent().catch(()=>null)}
 finally{await browser?.close();runtime.server.close();await once(runtime.server,'close');store.close();results.push(result);console.log(JSON.stringify({progress:result}))}
}
const report={format:1,at:new Date().toISOString(),runtimeRoot:root.href,results,checks:{allScenariosPass:results.every(r=>r.passed)},scope:'Pinned Playwright engines on this Mac: branded Chrome, Firefox and WebKit, plus a WebKit touch/mobile viewport. Real browser UI/API/WebGL/input and paid/insured raid loop, with controlled container/exit positions, no machines and shortened exit timers. WebKit engine is not branded Safari or physical iOS; no real WAN/microphone/human balance acceptance.'};if(process.env.RAID_ENGINE_REPORT)await writeFile(process.env.RAID_ENGINE_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});assert.equal(report.checks.allScenariosPass,true,'Browser compatibility failure: retain the engine report');
