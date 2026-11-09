// Premium HUD theme grader: proves the tactical glass language reaches every
// raid surface and menu, captures inspection screenshots, and confirms the
// visual layer never altered control wiring, labels, or touch target sizes.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),{server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');
const previousUrl=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+server.address().port;
const h=await browserHarness();
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
const size=async(p,width,height,mobile)=>{await p.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await p.command('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await new Promise(r=>setTimeout(r,300))};
try{
 const p=await h.page();
 await p.command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in') && document.getElementById('register').onclick!==null");
 await p.evaluate(`document.querySelector('[name=username]').value='theme_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long cohesive theme password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await p.wait("document.getElementById('identity').textContent.includes('credits')");
 await new Promise(r=>setTimeout(r,250));
 const base=await p.evaluate(`(()=>{const card=getComputedStyle(document.querySelector('.card')),h1=getComputedStyle(document.querySelector('h1'));return {cardRadius:card.borderTopLeftRadius,cardBorder:card.borderTopColor,h1Gradient:h1.backgroundImage.includes('linear-gradient'),cardBackground:card.backgroundImage.includes('gradient')}})()`);
 assert.ok(parseFloat(base.cardRadius)>=14,'base cards use premium radius');
 assert.ok(base.cardBackground,'base cards use layered surface fill');
 assert.equal(base.h1Gradient,true,'heading uses the amber brand gradient');
 await shot(p,'/tmp/hs-theme-base.png');
 await p.wait("document.querySelectorAll('#stash .item').length>0");
 await p.evaluate("document.getElementById('stash').scrollIntoView({block:'start'})");
 await new Promise(r=>setTimeout(r,350));
 const stash=await p.evaluate(`(()=>{const first=document.querySelector('#stash .item'),style=first&&getComputedStyle(first),span=first?.querySelector('span');return {rows:document.querySelectorAll('#stash .item').length,radius:style?.borderTopLeftRadius||'0',label:span?.textContent||'',controls:document.querySelectorAll('#stash .item button').length}})()`);
 assert.ok(stash.rows>=2,'base stash renders item rows');
 assert.ok(parseFloat(stash.radius)>=8,'base inventory rows share the rounded surface');
 assert.ok(stash.controls>=2,'base inventory rows retain their action controls');
 await shot(p,'/tmp/hs-theme-base-stash.png');
 await p.evaluate('window.scrollTo(0,0)');
 await p.evaluate("const m=document.getElementById('map');m.value='relay';m.dispatchEvent(new Event('change'));document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('hud').textContent.includes('HP')");
 await new Promise(r=>setTimeout(r,1200));
 const raid=await p.evaluate(`(async()=>{const tele=getComputedStyle(document.getElementById('telemetry')),hud=getComputedStyle(document.getElementById('hud')),cond=getComputedStyle(document.getElementById('conditions')),fire=getComputedStyle(document.getElementById('fire')),map=getComputedStyle(document.getElementById('minimap')),pack=getComputedStyle(document.getElementById('pack')),header=getComputedStyle(document.getElementById('globalTools'));
   const targets=[...document.querySelectorAll('#touch button')].filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.height});
   const packItem=document.querySelector('#pack .item'),packSpan=packItem&&getComputedStyle(packItem.querySelector('span')),packButtons=packItem?[...packItem.querySelectorAll('button')]:[];
   const mod=await import('./raid-online.mjs');
   const vital=document.querySelector('#hud [data-metric=vital]'),vitalVal=vital&&vital.querySelector('.hudVal'),vitalKey=vital&&vital.querySelector('.hudKey');
   const hudText=document.getElementById('hud').textContent;
   const metrics=[...document.querySelectorAll('#hud [data-metric]')].map(el=>el.dataset.metric);
   const hp=parseInt(vitalVal?.textContent||'0',10);
   return {teleRadius:tele.borderTopLeftRadius,teleGradient:tele.backgroundImage.includes('linear-gradient'),teleBorder:tele.boxShadow!=='none',hudWeight:hud.fontWeight,condColor:cond.color,fireGradient:fire.backgroundImage.includes('linear-gradient'),fireInk:fire.color,minimapRadius:map.borderTopLeftRadius,packRadius:pack.borderTopLeftRadius,undersized:targets.filter(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44}).map(b=>b.textContent),packSpanBasis:packSpan?.flexBasis,packUndersized:packButtons.filter(b=>b.getBoundingClientRect().height<44).length,extraTargets:[...document.querySelectorAll('#packToggle,#spectate')].filter(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return s.display!=='none'&&s.visibility!=='hidden'&&r.width&&r.height&&(r.width<44||r.height<44)}).map(b=>b.id),ids:['leave','packToggle','spectate','minimap','hint','pack','telemetry','globalTools'].every(id=>document.getElementById(id)),
   hudText,hudMetrics:metrics,hudVitalKey:vitalKey?.textContent,hudVitalValue:vitalVal?.textContent,hudVitalState:vital?.dataset.state,hudVitalColor:vitalVal&&getComputedStyle(vitalVal).color,hudStates:{at100:mod.hudVitalState(100,false),at60:mod.hudVitalState(60,false),at61:mod.hudVitalState(61,false),at30:mod.hudVitalState(30,false),at29:mod.hudVitalState(29,false),downed:mod.hudVitalState(0,true)},
   teleWidth:tele.width,viewWidth:innerWidth,headerBg:header.backgroundImage,headerRadius:parseFloat(header.borderTopLeftRadius),headerBackdrop:header.backdropFilter,headerButtonBg:getComputedStyle(document.querySelector('#globalTools button')).backgroundColor}})()`);
 assert.ok(parseFloat(raid.teleRadius)>=12,'telemetry wears the glass panel');
 assert.equal(raid.teleGradient,true,'telemetry uses a layered gradient');
 assert.equal(raid.teleBorder,true,'telemetry has an inset hairline');
 assert.equal(raid.hudWeight,'600','telemetry numbers use the tactical weight');
 assert.equal(raid.condColor,'rgb(99, 217, 242)','conditions use the cyan voice');
 assert.equal(raid.fireGradient,true,'the fire control uses the amber action treatment');
 assert.equal(raid.fireInk,'rgb(35, 22, 4)','the fire control keeps dark high-contrast ink');
 assert.ok(parseFloat(raid.minimapRadius)>=12,'minimap is framed');
 assert.ok(parseFloat(raid.packRadius)>=12,'backpack shares the panel radius');
 assert.deepEqual(raid.undersized,[],'touch actions stay at least 44x44');
 assert.equal(raid.packSpanBasis,'100%','backpack item labels use the full row');
 assert.equal(raid.packUndersized,0,'backpack row actions stay at least 44px tall');
 assert.deepEqual(raid.extraTargets,[],'bag toggle and squadmate switch stay at least 44x44');
 assert.equal(raid.ids,true,'all raid control ids remain mounted');
 // Structured telemetry scoreboard: labelled tokens keep the old text contract
 // (HP first) while adding health tone without colour-only signalling.
 assert.ok(raid.hudText.startsWith('HP ')||raid.hudText.startsWith('DOWNED'),'the scoreboard leads with HP or DOWNED ('+raid.hudText.slice(0,24)+')');
 assert.ok(['vital','ammo','time','pack','weight'].every(metric=>raid.hudMetrics.includes(metric)),'HP, ammo, clock, pack and weight render as tokens ('+raid.hudMetrics.join(',')+')');
 assert.match(raid.hudVitalKey,/^(HP|DOWNED)\s$/,'the vital label is an uppercase key');
 assert.deepEqual(raid.hudStates,{at100:'ok',at60:'warn',at61:'ok',at30:'critical',at29:'critical',downed:'downed'},'vitality tones follow the <=30/<=60 thresholds');
 const hpShown=parseInt(raid.hudVitalValue,10),hpTone=raid.hudVitalState==='downed'?'downed':hpShown<=30?'critical':hpShown<=60?'warn':'ok';
 assert.equal(raid.hudVitalState,hpTone,'the rendered HP token carries its computed tone ('+raid.hudVitalState+')');
 assert.notEqual(raid.hudVitalColor,'rgb(247, 251, 252)','the HP value is colour-coded distinct from the default ink');
 // Capped desktop glass panel + one opaque header capsule.
 assert.ok(parseFloat(raid.teleWidth)<=701,'desktop telemetry is capped instead of spanning the viewport ('+raid.teleWidth+' of '+raid.viewWidth+' px)');
 assert.ok(parseFloat(raid.teleWidth)>=400,'the capped telemetry card keeps a readable width ('+raid.teleWidth+' px)');
 assert.equal(raid.headerBg.includes('linear-gradient'),true,'global tools sit on one layered glass capsule');
 assert.ok(raid.headerRadius>=20,'the header capsule is fully rounded');
 assert.ok(String(raid.headerBackdrop).includes('blur'),'the header capsule blurs scrolled content behind it');
 assert.equal(raid.headerButtonBg,'rgba(0, 0, 0, 0)','header buttons are borderless inside the capsule');
 await shot(p,'/tmp/hs-theme-raid-desktop.png');
 await p.evaluate("document.getElementById('pack').hidden=false;document.getElementById('packToggle').setAttribute('aria-expanded','true')");
 await new Promise(r=>setTimeout(r,300));
 await shot(p,'/tmp/hs-theme-raid-pack.png');
 await p.evaluate("document.getElementById('settingsOpen').click()");
 await p.wait("document.getElementById('settingsDialog').open===true");
 const dialogStyle=await p.evaluate(`(()=>{const d=getComputedStyle(document.getElementById('settingsDialog')),field=document.querySelector('#settingsDialog select'),i=getComputedStyle(field);field.focus();return {gradient:d.backgroundImage.includes('linear-gradient'),radius:parseFloat(d.borderTopLeftRadius),inputRadius:parseFloat(i.borderTopLeftRadius),inputBackground:i.backgroundColor,inputOutline:getComputedStyle(field).outlineWidth}})()`);
 assert.equal(dialogStyle.gradient,true,'dialogs share the glass surface');
 assert.ok(dialogStyle.radius>=14,'dialogs keep the premium radius');
 assert.ok(dialogStyle.inputRadius>=8,'dialog fields share the rounded field treatment');
 assert.ok(dialogStyle.inputBackground.includes('13, 21, 30')||dialogStyle.inputBackground.includes('13, 23, 30'),'dialog fields use the dark fill');
 assert.ok(parseFloat(dialogStyle.inputOutline)>=2,'dialog fields keep a visible focus ring');
 await shot(p,'/tmp/hs-theme-settings.png');
 await p.evaluate("document.getElementById('settingsClose').click()");
 await p.wait("document.getElementById('settingsDialog').open===false");
 await size(p,390,844,true);
 // Close through the real toggle so data-pack-open and the dock CSS stay honest;
 // forcing hidden alone would leave the mobile controls suppressed.
 await p.evaluate("if(!document.getElementById('pack').hidden)document.getElementById('packToggle').click()");
 await p.wait("document.getElementById('pack').hidden===true && document.getElementById('play').dataset.packOpen==='false'");
 await new Promise(r=>setTimeout(r,350));
 const mobile=await p.evaluate(`(()=>{const tele=getComputedStyle(document.getElementById('telemetry')),fire=getComputedStyle(document.getElementById('fire')),touch=getComputedStyle(document.getElementById('touch')),map=getComputedStyle(document.getElementById('minimap'));return {teleRadius:parseFloat(tele.borderTopLeftRadius),teleWidth:parseFloat(tele.width),viewWidth:innerWidth,fireGradient:fire.backgroundImage.includes('linear-gradient'),fireDisplay:fire.display,touchDisplay:touch.display,mapDisplay:map.display,touchTargets:[...document.querySelectorAll('#touch button')].filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.height&&(r.width<44||r.height<44)}).length}})()`);
 assert.ok(mobile.teleRadius>=8,'mobile telemetry keeps the glass frame');
 assert.ok(mobile.teleWidth>=mobile.viewWidth-30,'mobile telemetry keeps its full-width dock ('+mobile.teleWidth+' of '+mobile.viewWidth+' px)');
 assert.equal(mobile.fireGradient,true,'mobile holds the action treatment');
 assert.notEqual(mobile.touchDisplay,'none','mobile keeps its control deck visible');
 assert.equal(mobile.touchTargets,0,'mobile controls stay at least 44x44');
 await shot(p,'/tmp/hs-theme-raid-mobile.png');
 await p.evaluate("document.getElementById('leave').click()");
 await p.wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
 await new Promise(r=>setTimeout(r,400));
 await shot(p,'/tmp/hs-theme-base-mobile.png');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({baseTheme:true,raidTheme:true,dialogTheme:true,mobileTheme:true,touchTargets:true,controlIdsIntact:true,screenshots:['/tmp/hs-theme-base.png','/tmp/hs-theme-base-stash.png','/tmp/hs-theme-raid-desktop.png','/tmp/hs-theme-raid-pack.png','/tmp/hs-theme-settings.png','/tmp/hs-theme-raid-mobile.png','/tmp/hs-theme-base-mobile.png'],browserErrors:p.errors}));
}finally{await h.close();server.close();await once(server,'close');store.close();if(previousUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previousUrl}
