// Two isolated Chrome contexts aboard one authoritative raid: the squad link-up
// card is advertised from the server snapshot, boarding captions name the bonus,
// and both boarding squadmates settle the authoritative credit/XP award.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),{server,raids}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+server.address().port;
const h=await browserHarness();
const ready=p=>p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
const interact=async p=>{await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyE',key:'e'});await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyE',key:'e'})};
async function register(p,suffix){
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate(`document.querySelector('[name=username]').value='squadlink_${suffix}_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long squad link browser password';document.getElementById('register').click()`);
 await ready(p);return p.evaluate("fetch('/api/profile').then(r=>r.json())");
}
try{
 const a=await h.page(),b=await h.page();for(const p of [a,b])await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 const first=await register(a,'a'),second=await register(b,'b');
 const operator=id=>raids.byAccount.get(id),raid=()=>raids.raids.get(operator(first.id).raidId),exit=()=>raid().exits.find(e=>e.kind==='call');
 await a.evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await a.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 await b.evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await b.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 assert.equal(operator(first.id).raidId,operator(second.id).raidId,'both operators share one raid');
 const e=exit();Object.assign(e,{openAt:Date.now()/1000-2,closeAt:Date.now()/1000+120,seats:6});
 raid().machines=[];raid().caches=[];raid().floorLoot=[];raid().bags=[];
 for(const id of [first.id,second.id])Object.assign(operator(id),{team:operator(second.id).team,x:e.x,y:e.y||0,z:e.z,move:{x:0,z:0},protectedUntil:Date.now()/1000+120});
 const cardExpr=(id)=>`(()=>{const c=document.querySelector('[data-exit="${id}"]');return c&&{phase:c.dataset.phase,link:c.querySelector('[data-exit-link]')?.textContent||'',hidden:c.querySelector('[data-exit-link]')?.hidden,label:c.getAttribute('aria-label')}})()`;
 for(const p of [a,b])await p.wait(`(()=>{const c=document.querySelector('[data-exit="${e.id}"]');return c&&c.querySelector('[data-exit-link]')&&!c.querySelector('[data-exit-link]').hidden && c.querySelector('[data-exit-link]').textContent==='Squad link +6'})()`);
 const cardA=await a.evaluate(cardExpr(e.id)),cardB=await b.evaluate(cardExpr(e.id));
 assert.equal(cardA.phase,'open','the call exit is open for both clients');
 assert.equal(cardA.link,'Squad link +6','the card advertises the per-squadmate credit bonus');
 assert.match(cardA.label,/Squad link bonus available with 1 squadmate/,'assistive tech receives the recruitment hint');
 assert.equal(cardB.link,'Squad link +6','the second client sees the same authoritative signal');

 await interact(a);
 await a.wait("document.getElementById('interactionStatus').textContent.includes('Boarding') && document.getElementById('interactionStatus').textContent.includes('squad link +6 credits')");
 assert.match(await a.evaluate("document.getElementById('statusAnnouncement').textContent"),/Squad link-up bonus active with 1 squadmate/,'the polite live region announces the bonus');
 await interact(b);
 await b.wait("document.getElementById('interactionStatus').textContent.includes('Boarding') && document.getElementById('interactionStatus').textContent.includes('squad link +6 credits')");
 await a.wait("document.getElementById('hint').textContent.includes('EXTRACT')",'the first client settles');
 await b.wait("document.getElementById('hint').textContent.includes('EXTRACT')",'the second client settles');
 const firstResult=store.results(first.id)[0],secondResult=store.results(second.id)[0];
 assert.equal(firstResult.outcome,'extract');
 assert.equal(secondResult.outcome,'extract');
 for(const result of [firstResult,secondResult]){
  assert.equal(result.facts.squadLink,1,'one squadmate is linked at settlement');
  assert.equal(result.facts.squadLinkBonus,6);
  assert.equal(result.facts.squadLinkXp,10);
  assert.equal(result.credits,26,'base extraction credits + squad link bonus');
  assert.equal(result.xp,30,'base extraction XP + squad link XP');
 }
 await a.evaluate("document.getElementById('leave').click()");await ready(a);
 const records=await a.evaluate("document.getElementById('records').textContent");
 assert.match(records,/Squad link-up extraction: 1 squadmate shared the exit \(\+6 credits, \+10 XP\)/,'the authoritative settlement report explains the bonus');
 for(const p of [a,b])assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({sharedRaid:true,cardLink:cardA.link,cardLabel:cardA.label,boardingCaption:true,boardingAnnouncement:true,settledCredits:26,settledXp:30,squadLinkFacts:firstResult.facts.squadLink,reportExplainsBonus:true,browserErrors:[]}));
}finally{await h.close();server.close();await once(server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
