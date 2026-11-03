import assert from 'node:assert/strict';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {browserHarness} from './browser-harness.mjs';
const runtimeRoot=process.env.RAID_TEST_ROOT?pathToFileURL(resolve(process.env.RAID_TEST_ROOT)+'/'):new URL('../',import.meta.url);
const {RaidStore}=await import(new URL('server/store.mjs',runtimeRoot));
const {createRaidServer}=await import(new URL('server/main.mjs',runtimeRoot));
let now=1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now:()=>now});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness(),pages=[];
const idle=p=>p.wait("document.body.getAttribute('aria-busy')==='false'");
const button=text=>`[...document.querySelectorAll('#pack button')].find(b=>b.textContent===${JSON.stringify(text)})`;
const key=(p,down)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
try{
 const ids=[];
 for(let i=0;i<2;i++){
  const p=await h.page();pages.push(p);await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await p.evaluate(`document.querySelector('[name=username]').value='interact_${i}_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long interaction browser password';document.getElementById('register').click()`);
  await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");ids.push((await p.evaluate("fetch('/api/profile').then(r=>r.json())")).id);
  await p.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 }
 const [a,b]=pages,operator=i=>runtime.raids.byAccount.get(ids[i]),raid=()=>runtime.raids.raids.get(operator(0).raidId),cache=i=>raid().caches[i];
 assert.equal(operator(0).raidId,operator(1).raidId);
 raid().machines=[];const {x,y,z}=operator(0);
 for(const i of [0,1])Object.assign(operator(i),{x,y,z,protectedUntil:0,move:{x:0,z:0}});
 for(const i of [0,1])Object.assign(cache(i),{x:x+i,y,z,label:i?'Second salvage':'First salvage',open:false,vault:false,searcher:null,searchUntil:0});
 for(const p of pages)await p.wait(`${button('Search First salvage')} && ${button('Search Second salvage')}`);
 await a.evaluate(`${button('Search First salvage')}.click()`);await idle(a);assert.equal(cache(0).searcher,ids[0]);
 await a.evaluate(`${button('Search Second salvage')}.click()`);await idle(a);assert.equal(cache(0).searcher,null);assert.equal(cache(1).searcher,ids[0]);
 await b.evaluate(`${button('Search Second salvage')}.click()`);await idle(b);assert.match(await b.evaluate("document.getElementById('message').textContent"),/being searched/);
 await a.command('Page.bringToFront');await a.evaluate("document.getElementById('view').focus()");await key(a,true);
 await a.wait("!document.getElementById('interactionStatus').textContent.includes('Searching')");await key(a,false);assert.equal(cache(1).searcher,null);
 await b.evaluate(`${button('Search Second salvage')}.click()`);await idle(b);assert.equal(cache(1).searcher,ids[1]);now=1002.5;
 await b.wait(`!${button('Search Second salvage')}`);assert.equal(cache(1).open,true);assert.equal(cache(0).open,false);

 const loot=cache(1).items[0],take=`[...document.querySelector('[data-item-id="${loot.id}"]').querySelectorAll('button')].find(b=>b.textContent==='Take')`;
 for(const p of pages){await p.wait(take);await p.evaluate(`window.__contestedTake=${take}`)}
 await Promise.all(pages.map(p=>p.evaluate('window.__contestedTake.click()')));for(const p of pages)await idle(p);
 assert.equal([0,1].reduce((n,i)=>n+operator(i).pack.filter(it=>it.id===loot.id).length,0),1);assert.equal(cache(1).items.some(it=>it.id===loot.id),false);
 assert.equal(store.db.prepare('SELECT count(*) n FROM inventory WHERE id=?').get(loot.id).n,1);

 await a.evaluate(`${button('Search First salvage')}.click()`);await idle(a);runtime.raids.atomic(()=>runtime.raids.damage(raid(),operator(0),2));assert.equal(cache(0).searcher,null);
 await a.wait("!document.getElementById('interactionStatus').textContent.includes('Searching')");
 await a.evaluate(`${button('Search First salvage')}.click()`);await idle(a);const loaded=operator(0).ammo;
 await a.evaluate("document.getElementById('fire').click()");await a.wait(`fetch('/api/raid').then(r=>r.json()).then(r=>r.self.ammo===${loaded-1})`);assert.equal(cache(0).searcher,null);

 for(const c of raid().caches){c.x+=100;c.z+=100}const exit=raid().exits[0];Object.assign(exit,{x:operator(0).x,y:operator(0).y,z:operator(0).z,openAt:1002,closeAt:1040});
 await a.wait("document.getElementById('hint').textContent.includes('exit')");await a.evaluate("document.getElementById('interact').click()");await idle(a);assert.ok(operator(0).board);
 await a.command('Page.bringToFront');await a.evaluate("document.getElementById('view').focus()");await key(a,true);await a.wait("!document.getElementById('interactionStatus').textContent.includes('Boarding')");await key(a,false);assert.equal(operator(0).board,null);
 await a.evaluate("document.getElementById('interact').click()");await idle(a);assert.ok(operator(0).board);now=1005;
 await a.wait("document.getElementById('hint').textContent.includes('EXTRACT')");assert.equal(store.results(ids[0])[0].outcome,'extract');assert.equal(operator(1).alive,true);
 assert.deepEqual(pages.flatMap(p=>p.errors),[]);
 console.log(JSON.stringify({runtimeRoot:runtimeRoot.href,oneSearchAtATime:true,contestedClaimRejected:true,keyboardMovementCancelsSearch:true,claimImmediatelyReusable:true,contestedItemHasOneOwner:true,damageCancelsSearch:true,firingCancelsSearch:true,keyboardMovementCancelsBoarding:true,boardingCanRestart:true,rivalContinuesAfterExtraction:true,browserErrors:[],scope:'Two isolated authenticated Chrome contexts. Positions, cache placement and time are server fixtures; not human balance or real WAN acceptance.'}));
}catch(error){console.error(JSON.stringify({states:await Promise.all(pages.map(p=>p.evaluate("({message:document.getElementById('message').textContent,hint:document.getElementById('hint').textContent,interaction:document.getElementById('interactionStatus').textContent})"))),errors:pages.flatMap(p=>p.errors)}));throw error}
finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
