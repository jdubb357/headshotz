// Premium base-lobby grader: proves the signed-in between-raid base is one
// hero deploy screen with a one-panel-at-a-time tab bar, amber card rails and
// an operator banner drawn from presentation CSS only — while preserving all
// controls, ids, focus order and accessibility contracts.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const username='deck_'+Date.now().toString(36),password='a long command deck password';
store.register(username,password);
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
const size=async(p,width,height,mobile)=>{await p.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await p.command('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await new Promise(r=>setTimeout(r,250))};
const deckExpr=`(()=>{
 const base=document.getElementById('base'),style=getComputedStyle(base),main=document.querySelector('main'),identity=getComputedStyle(document.getElementById('identity')),
  before=getComputedStyle(document.getElementById('identity'),'::before'),
  rail=getComputedStyle(document.querySelector('#basePanels>.card>h2'),'::before');
 const buttons=[...base.querySelectorAll('button')].filter(b=>getComputedStyle(b).display!=='none'&&b.offsetWidth&&b.offsetHeight);
 const deployCard=document.getElementById('deployCard'),deploy=document.getElementById('deploy');
 const shownCards=[...document.querySelectorAll('#basePanels>.card')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getClientRects().length);
 return {display:style.display,mainDisplay:getComputedStyle(main).display,lobby:document.body.dataset.baseLobby==='true',gap:style.gap,
  scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth,
  baseOverflow:base.scrollWidth>base.clientWidth+1,
  baseWidth:Math.round(base.getBoundingClientRect().width),
  bannerRadius:parseFloat(getComputedStyle(base.querySelector('.row')).borderTopLeftRadius),
  identityPadLeft:parseFloat(identity.paddingLeft),identityCase:identity.textTransform,
  emblem:before.content!==''&&((before.backgroundImage||before.background)||'').includes('gradient'),
  railWidth:parseFloat(rail.width),railGradient:((rail.backgroundImage||rail.background)||'').includes('gradient'),
  starterAccent:getComputedStyle(document.getElementById('starterRules')).borderLeftWidth,
  buttonMin:Math.min(...buttons.map(b=>Math.round(b.getBoundingClientRect().height))),
  buttons:buttons.length,
  deployFull:Math.abs(deployCard.getBoundingClientRect().width-base.getBoundingClientRect().width)<2,
  deployH:Math.round(deploy.getBoundingClientRect().height),deployW:Math.round(deploy.getBoundingClientRect().width),
  heroStats:['heroCredits','heroStash','heroLoadout','heroSector'].every(id=>document.getElementById(id).textContent.trim()&&document.getElementById(id).textContent.trim()!=='—'),
  tabs:[...document.querySelectorAll('#baseTabs [role=tab]')].filter(t=>!t.hidden).map(t=>t.dataset.baseTab),
  activeTabs:[...document.querySelectorAll('#baseTabs [role=tab][aria-selected=true]')].map(t=>t.dataset.baseTab),
  shownTabs:shownCards.map(card=>card.dataset.panel),
  pageScroll:document.documentElement.scrollHeight>innerHeight+1,
  ids:['starterRules','identity','logout','welcomeGuide','previewTurn','basePreview','partyMode','partyCreate','partyJoin','partyReady','partyLeave','stash','stashSearch','stashFilter','stashSort','bulkSell','savePreset','presets','applyPreset','map','checkLatency','latencyStatus','mapPreview','sectorPlan','exitPlan','recovery','primaryWeapon','deploy','resume','trader','workshop','attachmentWeapon','attachmentMod','attach','installedMods','contracts','insurance','records'].every(id=>document.getElementById(id)),
  headOrder:[...document.querySelectorAll('#identity,#logout')].map(e=>e.id)};
})()`;
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await size(p,1280,800,false);
 await p.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.getElementById('login').requestSubmit()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.wait("document.getElementById('identity').textContent.includes('credits')");
 await new Promise(r=>setTimeout(r,300));
 const deck=async()=>p.evaluate(deckExpr);
 const desktop=await deck();
 assert.equal(desktop.display,'flex','the base screen is a lobby, not a card grid');
 assert.equal(desktop.lobby,true,'the base paints in lobby mode');
 assert.equal(desktop.baseOverflow,false,'the lobby never overflows horizontally');
 assert.equal(desktop.deployFull,true,'the hero deploy card spans the lobby');
 assert.ok(desktop.deployH>=44&&desktop.deployW>=110,'DEPLOY is a big hero target: '+desktop.deployW+'x'+desktop.deployH);
 assert.equal(desktop.heroStats,true,'credits, stash, loadout and sector are summarised at a glance');
 assert.equal(desktop.tabs.join(','),'loadout,traders,workshop,contracts,records,sector,squad','the lobby keeps its compact tab set');
 assert.deepEqual(desktop.activeTabs,['loadout'],'online lobby starts on the loadout tab');
 assert.ok(desktop.shownTabs.length>0&&desktop.shownTabs.every(tab=>tab==='loadout'),'one tab panel paints at a time: '+desktop.shownTabs.join(','));
 assert.equal(desktop.pageScroll,false,'the lobby fits the desktop viewport without page scrolling');
 assert.ok(desktop.bannerRadius>=14,'the operator banner uses the premium radius');
 assert.ok(desktop.identityPadLeft>=36,'the operator banner reserves room for the emblem');
 assert.equal(desktop.emblem,true,'the operator emblem glyph is painted');
 assert.ok(desktop.railWidth>=3&&desktop.railGradient,'card headings carry the amber rail');
 assert.equal(desktop.starterAccent,'3px','the starter briefing keeps its accent edge');
 assert.ok(desktop.buttonMin>=44,'base controls stay at least 44px tall');
 assert.deepEqual(desktop.headOrder,['identity','logout'],'the operator row keeps its polite DOM order');
 assert.equal(desktop.ids,true,'every base control id is still mounted');
 assert.equal(desktop.scrollWidth>desktop.innerWidth+1,false,'the deck fits the desktop viewport');
 await p.evaluate("document.querySelector('#baseTabs [data-base-tab=records]').click()");
 await new Promise(r=>setTimeout(r,120));
 const recordsTab=await deck();
 assert.deepEqual(recordsTab.activeTabs,['records'],'clicking a tab moves the selected state');
 assert.ok(recordsTab.shownTabs.length>0&&recordsTab.shownTabs.every(tab=>tab==='records'),'records panels replace loadout panels: '+recordsTab.shownTabs.join(','));
 await p.evaluate("document.querySelector('#baseTabs [data-base-tab=loadout]').click()");
 await p.evaluate("window.scrollTo(0,0);document.getElementById('base').scrollIntoView({block:'start'})");
 await new Promise(r=>setTimeout(r,300));
 await shot(p,'/tmp/hs-menu-desktop.png');
 // Settled frames must be pixel-identical. Crop to the operator banner: it is
 // static deck chrome and contains no continuously-authored canvas.
 const clip=JSON.parse(await p.evaluate('(()=>{const r=document.querySelector("#base>.row").getBoundingClientRect();return JSON.stringify({x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.max(1,Math.ceil(r.width)),height:Math.max(1,Math.ceil(r.height)),scale:1})})()'));
 const frame=async()=>{const png=await p.command('Page.captureScreenshot',{format:'png',clip});return png.data};
 const f1=await frame();await new Promise(r=>setTimeout(r,180));const f2=await frame();
 assert.equal(f1,f2,'settled deck banner is pixel-identical');
 const still=await p.evaluate('JSON.stringify([Math.round(document.getElementById("base").getBoundingClientRect().width),document.documentElement.scrollHeight])');
 await new Promise(r=>setTimeout(r,180));
 const still2=await p.evaluate('JSON.stringify([Math.round(document.getElementById("base").getBoundingClientRect().width),document.documentElement.scrollHeight])');
 assert.equal(still,still2,'the deck layout is stable between frames');
 await size(p,390,844,true);
 await new Promise(r=>setTimeout(r,300));
 const mobile=await deck();
 assert.equal(mobile.lobby,true,'mobile keeps the single-screen lobby');
 assert.equal(mobile.baseOverflow,false,'the mobile lobby never overflows horizontally');
 assert.equal(mobile.scrollWidth>mobile.innerWidth+1,false,'the lobby fits the mobile viewport');
 assert.ok(mobile.buttonMin>=44,'mobile base controls stay at least 44px tall');
 assert.ok(mobile.deployH>=44&&mobile.deployW>=110,'mobile DEPLOY stays a big target: '+mobile.deployW+'x'+mobile.deployH);
 assert.equal(mobile.deployFull,true,'the hero deploy card still spans the lobby');
 assert.equal(mobile.pageScroll,false,'mobile lobby fits without page scrolling');
 assert.equal(mobile.ids,true,'mobile keeps every base control id mounted');
 await p.evaluate("window.scrollTo(0,0);document.getElementById('base').scrollIntoView({block:'start'})");
 await new Promise(r=>setTimeout(r,300));
 await shot(p,'/tmp/hs-menu-mobile.png');
 const reduced=await p.evaluate(`(()=>{document.documentElement.dataset.reducedMotion='true';const card=getComputedStyle(document.querySelector('#base .card')),row=getComputedStyle(document.querySelector('#base .row'));const out={card:card.transitionProperty,row:row.transitionProperty};delete document.documentElement.dataset.reducedMotion;return out})()`);
 assert.equal(reduced.card,'none','reduced motion suppresses card transitions');
 assert.equal(reduced.row,'none','reduced motion suppresses banner transitions');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({desktop:{lobby:desktop.lobby,baseOverflow:desktop.baseOverflow,deployFull:desktop.deployFull,deployH:desktop.deployH,heroStats:desktop.heroStats,tabs:desktop.tabs,bannerRadius:desktop.bannerRadius,railWidth:desktop.railWidth,buttonMin:desktop.buttonMin,buttons:desktop.buttons,pageScroll:desktop.pageScroll},mobile:{lobby:mobile.lobby,baseOverflow:mobile.baseOverflow,buttonMin:mobile.buttonMin,deployFull:mobile.deployFull,deployH:mobile.deployH,pageScroll:mobile.pageScroll},screenshots:['/tmp/hs-menu-desktop.png','/tmp/hs-menu-mobile.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
