// Extraction/inventory card grader: proves the premium backpack summary and
// per-exit status cards derive from authoritative snapshot data, update in
// place through ready/inbound/open/full phases, preserve access rules, expose
// rarity/condition metadata on item rows, and never add gameplay behavior.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const username='extract_'+Date.now().toString(36),password='a long extraction panel password';
store.register(username,password);
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await p.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.getElementById('login').requestSubmit()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('HP') && document.querySelectorAll('#pack .extractCard').length===4");
 const account=await p.evaluate("fetch('/api/profile').then(r=>r.json()).then(x=>x.id)");
 const operator=runtime.raids.byAccount.get(account),raid=runtime.raids.raids.get(operator.raidId);
 const cardInfo=async()=>p.evaluate(`(()=>({phases:[...document.querySelectorAll('#pack .extractCard')].map(c=>[c.dataset.exit,c.dataset.phase,c.querySelector('.exitBadge').textContent,c.getAttribute('aria-label'),c.querySelector('[data-exit-fill]').style.getPropertyValue('--exit-fill')]),
   cards:document.querySelectorAll('#pack .extractCard').length,
   meters:[...document.querySelectorAll('#pack .packMeter')].map(m=>[m.querySelector('.meterLabel').textContent,m.querySelector('b').textContent]),
   items:[...document.querySelectorAll('#pack [data-item-id]')].map(r=>[r.dataset.itemId,r.dataset.kind,r.dataset.rarity,r.dataset.condition,r.dataset.conditionValue,getComputedStyle(r.querySelector('.itemCondition')).borderTopLeftRadius]),
   packOverflow:document.getElementById('pack').scrollWidth>document.getElementById('pack').clientWidth+1,
   cardOverflow:[...document.querySelectorAll('#pack .extractCard')].some(c=>c.getBoundingClientRect().width>document.getElementById('pack').clientWidth+1)
 }))()`);
 const initial=await cardInfo();
 assert.equal(initial.cards,4,'all four relay exits render as cards');
 const initialPhases=initial.phases.map(x=>x[1]);
 assert.ok(initialPhases.includes('ready')&&initialPhases.includes('inbound')&&initialPhases.includes('locked'),'cards show ready, inbound and access-locked phases ('+initialPhases.join(',')+')');
 assert.equal(initial.phases.filter(([, , badge])=>badge).length,4,'every card has a phase badge');
 assert.ok(initial.phases.every(([, p, , label])=>label.includes('. Access:')),'every card exposes a phase and access label to assistive tech');
 assert.ok(initial.phases.every(([, , , , fill])=>fill.endsWith('%')&&parseFloat(fill)>=0&&parseFloat(fill)<=100),'every card has a bounded progress value');
 assert.equal(initial.meters.length,3,'backpack renders slots, weight and protected meters');
 assert.equal(initial.meters[0][1],'0/8','slot meter uses authoritative pack capacity');
 assert.equal(initial.items.length>=1,true,'backpack renders item rows');
 assert.ok(initial.items.every(([,kind,rarity,condition,conditionValue,radius])=>kind&&rarity!==undefined&&condition&&conditionValue&&radius),'item rows expose kind, rarity and condition state');
 assert.equal(initial.packOverflow,false,'no horizontal overflow inside the backpack');
 assert.equal(initial.cardOverflow,false,'extraction cards stay within the panel');
 const timed=raid.exits.find(e=>e.kind==='timed'),beforeFill=parseFloat(initial.phases.find(([id])=>id===timed.id)[4]);
 await new Promise(r=>setTimeout(r,1800));
 const progressed=(await cardInfo()).phases.find(([id])=>id===timed.id);
 const afterFill=parseFloat(progressed[4]);
 assert.ok(afterFill<beforeFill,'the inbound extraction countdown visibly shrinks the progress track ('+beforeFill+'→'+afterFill+')');
 const hatch=raid.exits.find(e=>e.id==='hatch');hatch.openAt=Date.now()/1000-2;hatch.closeAt=Date.now()/1000+43;
 await p.wait("document.querySelector('[data-exit=hatch]').dataset.phase==='open'");
 const open=await cardInfo();
 assert.equal(open.phases.find(([id])=>id==='hatch')[2],'Boarding','the open exit announces Boarding');
 assert.match(open.phases.find(([id])=>id==='hatch')[3],/Boarding/,'the accessible label follows the phase');
 assert.ok(open.phases.find(([id])=>id==='hatch')[4].endsWith('%'),'open exits draw a closing progress track');
 hatch.usedSeats=1;
 await p.wait("document.querySelector('[data-exit=hatch]').dataset.phase==='full'");
 const full=await cardInfo();
 assert.equal(full.phases.find(([id])=>id==='hatch')[2],'Full','a consumed seat turns the card full');
 assert.match(full.phases.find(([id])=>id==='hatch')[3],/Full/,'the accessible label follows the full phase');
 await p.evaluate("document.getElementById('pack').scrollTop=0");
 await new Promise(r=>setTimeout(r,250));
 await shot(p,'/tmp/hs-inventory-rows.png');
 await p.evaluate("document.getElementById('pack').scrollTop=document.getElementById('pack').scrollHeight");
 await new Promise(r=>setTimeout(r,250));
 await shot(p,'/tmp/hs-extraction-panel.png');
 const reduced=await p.evaluate(`(()=>{document.documentElement.dataset.reducedMotion='true';const card=document.querySelector('[data-exit=hatch]'),fill=card.querySelector('.exitProgress span'),style=getComputedStyle(fill);return {transition:style.transitionProperty,duration:style.transitionDuration,label:card.getAttribute('aria-label')}})()`);
 assert.equal(reduced.transition,'none','reduced motion removes the extraction progress animation');
 assert.equal(reduced.duration,'0s','reduced motion freezes progress interpolation');
 assert.match(reduced.label,/Full/,'reduced motion keeps the accessible phase');
 await p.evaluate("delete document.documentElement.dataset.reducedMotion");
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({cards:initial.cards,phases:initialPhases,meters:initial.meters,items:initial.items.length,progress:{before:beforeFill,after:afterFill},openBadge:open.phases.find(([id])=>id==='hatch')[2],fullBadge:full.phases.find(([id])=>id==='hatch')[2],reducedMotion:reduced.transition,screenshots:['/tmp/hs-inventory-rows.png','/tmp/hs-extraction-panel.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
