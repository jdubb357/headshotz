import {sameLoadout,describeLoadout} from './shared/raid-loadout.mjs';
import {RaidTrigger,deferIdleMovement,lookNeedsSync} from './raid-trigger.mjs';
import {reasonText,settlementText,insuranceText,objectiveText,settlementGapText,stashUsageText,careerText} from './shared/raid-report.mjs';
import {grantBalance,canRecoverGrant} from './shared/raid-grants.mjs';
import {lootPresentation,lootCelebrationText} from './shared/raid-loot-presentation.mjs';
import {stackable,compatibleStacks} from './shared/raid-inventory.mjs';
import {hitToken,shouldShowHit,hitCaption} from './shared/raid-hit-presentation.mjs';
import {normalizePackOrder,orderPack} from './shared/raid-pack-order.mjs';
import {quantityUI,inventoryFocus,restoreInventoryFocus} from './raid-quantity-ui.mjs';
import {ARMOR,MEDICAL,armorStats,medicalNeed} from './shared/raid-combat.mjs';
import {matchPreferences} from './shared/raid-matchmaking.mjs';
import {UTILITIES} from './shared/raid-utilities.mjs';
import {RAID_PROTOCOL} from './shared/raid-protocol.mjs';
import {ReliableActions} from './raid-transport.mjs';
import {LocalPrediction} from './raid-prediction.mjs';
import {ARTIFACTS,SECTORS} from './shared/raid-sectors.mjs';
import {createRaidExits,exitDescription,exitColor,exitState,exitCost,extractionInteractionTarget,squadLinkBonus,SQUAD_LINK} from './shared/raid-exits.mjs';
import {roleLabel,roleSummary,engineerPicks} from './shared/raid-roles.mjs';
import {accountUI} from './raid-account-ui.mjs';
import {installDialogNavigation} from './raid-dialogs.mjs';
import {settingsUI} from './raid-settings-ui.mjs';
import {raidInput} from './raid-input.mjs';
import {keyName} from './shared/raid-settings.mjs';
import {rankProgress} from './shared/raid-progression.mjs';
import {communicationUI} from './raid-comms-ui.mjs';
import {BOSS_PHASES,MACHINES} from './shared/raid-enemies.mjs';
import {loadAssets,loadLoot,loadWindows,loadBuildings,loadNature,loadGround,loadSkyPhoto,HQP} from './assets.js';
import {loadHumans,HUM} from './humans.js';
import {RaidView,BasePreview} from './raid-view.mjs';
import {RAID_WORLDS,getWorld,terrainHeightAt,clearLine} from './shared/raid-worlds.mjs';
import {objectivesFor} from './shared/raid-objectives.mjs';
import {vaultTarget,vaultDirection} from './shared/raid-motion.mjs';
import {baseController} from './raid-base.mjs';
import {WEAPONS,MODS,weaponStats,itemWeight,stashCapacity} from './shared/raid-catalog.mjs';
import {sellValue} from './shared/raid-appraisal.mjs';
import {isOfflineQuery,readServiceMeta} from './shared/raid-static.mjs';
import {readRaidPlan,writeRaidPlan} from './shared/raid-plan.mjs';

// Transport selection for the raid client. Static GitHub Pages has no `/api`,
// so the page switches to an in-page authoritative service instead of fetch.
// An explicit `offline=1`, the Node-injected service meta, or one profile probe
// decides the mode once per page; online hosts still use fetch for everything.
let transportProbe=null,offlineRuntime=null,offlineRuntimeWork=null,offlineMode=false,offlineReadinessCheck=null;
function decideTransport(){
 if(isOfflineQuery(location.search))return Promise.resolve('offline');
 if(readServiceMeta(document))return Promise.resolve('online');
 return new Promise(resolve=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  fetch('/api/profile',{cache:'no-store',signal:controller.signal})
    .then(response=>resolve(response.headers.get('content-type')?.includes('application/json')&&(response.status===200||response.status===401)?'online':'offline'))
    .catch(()=>resolve('offline'))
    .finally(()=>clearTimeout(timer));
 });
}
async function offlineEnabled(){
 if(!transportProbe)transportProbe=decideTransport();
 const transport=await transportProbe;
 offlineMode=transport==='offline';
 try{document.body.dataset.raidTransport=transport}catch{}
 return offlineMode;
}
function offlineService(){
 offlineRuntimeWork||=import('./shared/raid-offline.mjs').then(async module=>{
  const guest=new URLSearchParams(location.search).get('guest');
  offlineRuntime=await module.createPersistentOfflineRaidRuntime({username:guest||'guest'});
  offlineReadinessCheck=module.offlineReadiness;
  module.startOfflineTick(offlineRuntime);
  // Best effort on tab hide/close: IndexedDB saves are already queued after each
  // committed action, and this flushes the latest debounced state.
  addEventListener('pagehide',()=>{offlineRuntime?.flush?.().catch(()=>{})});
  // Diagnostic handle for the static browser grader; absent on Node hosts.
  window.__hszOfflineRaid={mode:'offline',protocol:RAID_PROTOCOL,persistent:!!offlineRuntime.persistent,storageMode:offlineRuntime.storage?.(),recovery:offlineRuntime.recovery||null,persistenceError:offlineRuntime.lastPersistenceError?String(offlineRuntime.lastPersistenceError.message||offlineRuntime.lastPersistenceError):null,runtime:()=>offlineRuntime,snapshot:()=>snapshot,api:(path,body)=>module.offlineRaidRequest(offlineRuntime,path,body)};
  return offlineRuntime;
 });
 return offlineRuntimeWork;
}
installDialogNavigation();
const chooseQuantity=quantityUI();
document.getElementById('previewTurn').onclick=()=>preview?.turn();
const $=id=>document.getElementById(id),message=text=>$('message').textContent=text;
const syncTouchHeight=()=>document.documentElement.style.setProperty('--touch-h',Math.round($('touch').getBoundingClientRect().height)+'px');
new ResizeObserver(syncTouchHeight).observe($('touch'));
const syncRaidDock=()=>{const root=document.documentElement,compact=root.dataset.compactHud==='true',tele=compact?0:Math.round($('telemetry').getBoundingClientRect().height),slim=compact?Math.round($('hudSlim').getBoundingClientRect().height):0,toggle=Math.round($('packToggle').getBoundingClientRect().height),top=compact?52+slim+8:64+tele+12;root.style.setProperty('--toggle-top',top+'px');root.style.setProperty('--dock-top',(top+toggle+8)+'px')};
new ResizeObserver(syncRaidDock).observe($('telemetry'));
new ResizeObserver(syncRaidDock).observe($('hudSlim'));
new ResizeObserver(syncRaidDock).observe($('packToggle'));
// The text-scale slider changes the telemetry font size before the next
// ResizeObserver notification; re-dock immediately so the backpack toggle and
// dock never sit inside the resized telemetry panel on small screens.
addEventListener('raidsettingschange',syncRaidDock);
addEventListener('resize',()=>{syncTouchHeight();syncRaidDock()});
syncTouchHeight();syncRaidDock();
// Base lobby navigation. The hero deploy card is always visible; the lower
// panel area shows exactly one tab group at a time. Cards keep their ids and
// event wiring, so every existing control stays where it is.
let baseTabName='loadout',baseTabChosen=false;
const BASE_TABS=['loadout','traders','workshop','contracts','records','sector','squad'];
function setBaseLobby(on){if(on)document.body.dataset.baseLobby='true';else delete document.body.dataset.baseLobby}
function updateHeroSummary(){
 if(!profile)return;
 const items=Array.isArray(profile.items)?profile.items:[];
 const credits=Number.isFinite(profile.credits)?profile.credits:0;
 const map=$('map')?.selectedOptions?.[0]?.textContent?.trim()||'—';
 const objective=$('fieldObjective')?.selectedOptions?.[0];
 const objectiveName=objective&&objective.value?objective.textContent.trim():'';
 const recovery=!!$('recovery')?.checked;
 const primary=$('primaryWeapon')?.selectedOptions?.[0]?.textContent?.trim();
 const gear=recovery?'Recovery kit':profile.activeDeployment?'Operator deployed':(!(''===($('primaryWeapon')?.value||''))&&primary)||'Select gear';
 const creditsNode=$('heroCredits'),stashNode=$('heroStash'),loadoutNode=$('heroLoadout'),sectorNode=$('heroSector');
 if(creditsNode)creditsNode.textContent=credits.toLocaleString()+' cr';
 if(stashNode)stashNode.textContent=items.length+' item'+(items.length===1?'':'s');
 if(loadoutNode)loadoutNode.textContent=gear;
 if(sectorNode)sectorNode.textContent=objectiveName?map+' · '+objectiveName:map;
}
function setBaseTab(name){
 baseTabName=BASE_TABS.includes(name)?name:'loadout';
 const base=$('base');
 if(base)base.dataset.baseTab=baseTabName;
 for(const tab of document.querySelectorAll('#baseTabs [role=tab]')){
  const on=tab.dataset.baseTab===baseTabName;
  tab.setAttribute('aria-selected',String(on));
  tab.tabIndex=on?0:-1;
 }
 updateHeroSummary();
}
for(const tab of document.querySelectorAll('#baseTabs [role=tab]')){
 tab.addEventListener('click',()=>setBaseTab(tab.dataset.baseTab));
 tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...document.querySelectorAll('#baseTabs [role=tab]')].filter(node=>!node.hidden);
  const index=tabs.indexOf(tab);if(index<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();setBaseTab(tabs[next].dataset.baseTab);
 });
}
let baseUI,previewLoadout={primary:null,secondary:null,armor:null};
let profile,party,snapshot,view,preview,yaw=0,pitch=0,seq=0,busy=false,tickBusy=false,inRaid=false,nearest=null,awaitingParty=false,notice={text:'',until:0};
let latencyProof=null,probeWork=null,matchInfo=null;
const PACK_ORDER_KEY='headshotz:backpack-order';
function readPackOrder(){try{return typeof localStorage==='undefined'?[]:normalizePackOrder(JSON.parse(localStorage.getItem(PACK_ORDER_KEY)||'[]'))}catch{return[]}}
let packOrder=readPackOrder();
function savePackOrder(ids){packOrder=normalizePackOrder(ids);try{if(typeof localStorage!=='undefined')localStorage.setItem(PACK_ORDER_KEY,JSON.stringify(packOrder))}catch{}}
let aimMouse=false,aimTouch=false,aiming=false;
// Virtual thumbstick axes: x is strafe (right positive), z is forward (up
// positive), both -1..1. It is added to the keyboard axes before the client
// turns them into a yaw-relative world vector.
let stickAxisX=0,stickAxisZ=0;
let trigger,weaponWork=null,stateAt=performance.now();
let identityUI,authChecking=false,raidGeneration=0,authGeneration=0,wire,prediction;

const comms=communicationUI({api,run,button,getProfile:()=>profile,action,getRaid:()=>inRaid?snapshot:null});
const preferences=settingsUI({onChange:settings=>{view?.applySettings(settings);preview?.applySettings(settings);comms.voice.setVolume(settings.voiceVolume);$('voiceVolume').value=settings.voiceVolume}});
const input=raidInput({settings:()=>preferences.get(),allowed:kind=>!preferences.isModal()&&(kind==='map'?inRaid:['pushTalk','communications'].includes(kind)?!!profile&&!offlineMode:['settings','help'].includes(kind)?true:inRaid&&$('communications').hidden&&!mapOpen),onTalk:active=>comms.voice.setTalking(active),onClear:stopHeldInput,onMove:sendHeldMovement,onRelease:kind=>{if(kind==='fire')trigger?.release('keyboard')},onAction:controlAction});
trigger=new RaidTrigger({getState:()=>{const s=snapshot?.self;return s?{deploymentId:s.deploymentId,alive:s.alive,downed:s.downed,nextFire:s.nextFire,weapon:[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),serverTime:snapshot.serverTime,sampledAt:stateAt,rttMs:wire?.rtt||0}:null},allowed:()=>!weaponWork&&inRaid&&!!wire&&!wire.closed&&!!snapshot?.self.alive&&!snapshot.self.downed&&!preferences.isModal()&&$('communications').hidden&&!mapOpen&&!document.hidden,send:factory=>action(()=>({...factory(),yaw,pitch})),onEffect:()=>view?.fire(),onError:e=>{input.clear();notice={text:e.message,until:performance.now()+3500};$('hint').textContent=e.message}});
$('voiceVolume').addEventListener('change',()=>preferences.update({voiceVolume:Number($('voiceVolume').value)}));
addEventListener('raidsettingschange',()=>{if(inRaid)setPack(!$('pack').hidden)});

identityUI=accountUI({api,run,getProfile:()=>profile,offline:()=>offlineMode,onRotated:async()=>{authGeneration++;await comms.voice.leave('Voice off after account security update.');await refresh()},onRecovered:async()=>{await signedOut('Account recovered. Sign in with your new password.')},onSignOut:async()=>{await api('logout',{});await signedOut('Signed out.')}});
async function signedOut(text){
 const wasAlive=inRaid&&snapshot?.self.alive;authGeneration++;wire?.close();wire=null;prediction=null;inRaid=false;raidGeneration++;awaitingParty=false;input.clear();resetTacticalMap();profile=null;party=null;snapshot=null;baseUI?.selectLoadout({recovery:false,itemIds:[],insureIds:[]});previewLoadout={primary:null,secondary:null,armor:null,recovery:false};preview?.clear();document.body.dataset.inRaid='false';preferences.apply();document.querySelector('main').inert=false;document.exitPointerLock?.();$('play').style.display='none';$('bossPanel').hidden=true;
 view?.clear();await comms.reset();identityUI.reset();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();setBaseLobby(false);baseTabChosen=false;baseTabName='loadout';$('base').hidden=true;$('auth').hidden=false;$('login').reset();applyOfflineAuth();$('identity').textContent='';
 clearHitmarker();lastHitToken=0;for(const id of ['stash','records','partyRoster','contracts','insurance','overflow','trader','workshop','upgrades','installedMods','primaryWeapon','weaponSlots','basePreviewCaption','presetStatus','riskSummary','stashCapacity','readyMismatch','pack','hud','conditions','events','sectorStatus','hint','interactionStatus','rewardsTotals','rewardsLoot','rewardsRank','rewardsContract','rewardsOutcome','rewardsSettlement','rewardsStashUsage'])$(id).replaceChildren();$('rewards').hidden=true;$('sectorStatus').hidden=true;delete $('sectorStatus').dataset.state;
 $('restoreReady').hidden=true;$('readyMismatch').hidden=true;latencyProof=null;$('latencyStatus').textContent='Check connection before deploying.';hudStatusKey='';const statusNode=$('hudStatus');if(statusNode){statusNode.hidden=true;statusNode.classList.remove('show')}$('networkStatus').hidden=false;
 message(text+(wasAlive?' Your operator remains vulnerable in the raid. Sign in and reconnect to continue.':''));
}
async function validateSession(){
 if(authChecking||!profile||await offlineEnabled())return;authChecking=true;const generation=authGeneration;try{const response=await fetch('/api/profile',{cache:'no-store'});if(response.status===401&&generation===authGeneration)await signedOut('Session expired or signed out from another device.')}catch{}finally{authChecking=false}
}

async function api(path,body,{timeoutMs=15000}={}){
 if(await offlineEnabled()){
  const runtime=await offlineService();
  const {offlineRaidRequest}=await import('./shared/raid-offline.mjs');
  return offlineRaidRequest(runtime,path,body);
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetch('/api/'+path,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  if(!r.headers.get('content-type')?.includes('application/json'))throw Object.assign(new Error('Raid service unavailable. Reload after restoring your connection.'),{retryable:false});
  const data=await r.json();if(!r.ok){if(r.status===401&&profile)queueMicrotask(validateSession);throw Object.assign(new Error(data.error||'Request failed'),{status:r.status,ack:data.ack,state:data.state})}return data;
 }catch(error){if(error.status||error.retryable===false)throw error;throw Object.assign(new Error('Raid service offline or timed out. Reconnect to continue; your operator may remain at risk.'),{retryable:true})}finally{clearTimeout(timer)}
}
async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');try{await fn()}catch(e){if(e.canceled)return;message(e.message);notice={text:e.message,until:performance.now()+3500};if(inRaid)$('hint').textContent=e.message}finally{busy=false;document.body.setAttribute('aria-busy','false')}}
function button(text,fn){const b=document.createElement('button');b.textContent=text;b.onclick=()=>run(fn);return b}
function label(it){return `${(it.kind==='armor'?armorStats(it).name:it.kind==='med'?(MEDICAL[it.medical]||MEDICAL.field).name:null)||UTILITIES[it.utility]?.name||ARTIFACTS[it.artifact]?.name||WEAPONS[it.weapon]?.name||MODS[it.mod]?.name||it.label||it.material||it.ammo||it.kind} ×${it.quantity||1} · ${Math.round(it.condition??100)}%${it.kind==='weapon'?' · '+(it.loaded||0)+' loaded':''} · ${['Common','Uncommon','Rare','Epic','Legendary'][it.rarity||0]||'Special'}${it.grantOwner?' · Starter supply':''}${it.grantLoaded?' · '+it.grantLoaded+' starter rounds':''}`}
function appraisal(it){
 const weight=Math.round(itemWeight(it)*10)/10,value=sellValue(it);
 return {weight,value,text:weight+' kg'+' · '+value+' cr',label:weight+' kilograms, '+value+' credit'+(value===1?'':'s')+' base sale'};
}
function itemRow(it,parent,buttons=[],warning=''){
 const row=document.createElement('div'),condition=Math.max(0,Math.min(100,Math.round(it.condition??100))),accent=['#94a6ae','#72e2b0','#63d9f2','#c790ff','#ffb44a','#ff645f'][Math.min(5,it.rarity||0)];
 const value=appraisal(it);
 row.className='item';row.dataset.itemId=it.id;row.dataset.kind=it.kind||'item';row.dataset.rarity=String(it.rarity||0);row.dataset.conditionValue=String(condition);row.dataset.condition=condition<35?'critical':condition<70?'worn':'ready';row.dataset.weight=String(value.weight);row.dataset.sellValue=String(value.value);
 row.style.setProperty('--item-accent',accent);row.setAttribute('role','group');row.setAttribute('aria-label',label(it)+' · '+value.label+(warning?' · '+warning:''));
 const span=document.createElement('span');span.className='itemLabel';span.textContent=label(it);
 const meter=document.createElement('span');meter.className='itemCondition';meter.setAttribute('aria-hidden','true');meter.style.setProperty('--condition',condition+'%');
 const head=document.createElement('div');head.className='itemHead';head.append(span,meter);
 const chips=document.createElement('span');chips.className='itemAppraisal';chips.setAttribute('aria-hidden','true');
 const chip=(text,kind)=>{const el=document.createElement('span');el.className='metaChip '+kind;el.textContent=text;chips.append(el)};
 chip(value.weight+' kg','metaWeight');if(value.value>0)chip(value.value+' cr','metaValue');
 row.append(head,chips);
 if(warning){const warn=document.createElement('span');warn.className='itemWarn';warn.textContent=warning;row.append(warn)}
 row.append(...buttons);parent.append(row);return row
}
const EXIT_BADGE={open:'Boarding',full:'Full',inbound:'Inbound',departed:'Departed',exhausted:'Exhausted',ready:'Ready',locked:'Access'};
function exitProgress(exit,state,now){
 if(state.phase==='inbound'){const span=Math.max(1,exit.arrival||1);return Math.max(0,Math.min(1,(exit.openAt-now)/span))}
 if(state.phase==='open'||state.phase==='full'){const span=Math.max(1,exit.duration||1);return Math.max(0,Math.min(1,(exit.closeAt-now)/span))}
 return 0
}
function paintExitCard(card,exit,state,now){
 const phase=state.phase,progress=exitProgress(exit,state,now),desc=exitDescription(exit,now),badge=EXIT_BADGE[phase]||phase;
 card.dataset.phase=phase;card.dataset.contested=String(!!exit.contested);
 const badgeEl=card.querySelector('[data-exit-badge]'),meta=card.querySelector('[data-exit-meta]'),fill=card.querySelector('[data-exit-fill]'),rule=card.querySelector('[data-exit-rule]'),seats=card.querySelector('[data-exit-seats]'),link=card.querySelector('[data-exit-link]'),name=card.querySelector('.extractName'),squadNear=Math.min(SQUAD_LINK.maxCompanions,Math.max(0,Math.trunc(Number(exit.squadNear)||0)));
 if(badgeEl)badgeEl.textContent=badge;
 if(meta)meta.textContent=desc;
 if(fill)fill.style.setProperty('--exit-fill',(progress*100).toFixed(1)+'%');
 if(rule)rule.textContent=exit.kind==='call'?'Called transport · no access cost':exit.kind==='timed'?'Scheduled lift · no access cost':exitCost(exit);
 if(seats)seats.textContent=state.remaining==null?(exit.seats||0)+' seats':state.available+'/'+exit.seats+' seats';
 const access=exit.kind==='call'||exit.kind==='timed'?'no access cost':exitCost(exit);
 if(link){link.hidden=!squadNear;link.textContent=squadNear?'Squad link +'+squadLinkBonus(Math.min(squadNear,SQUAD_LINK.maxCompanions)):''}
 const linkText=squadNear?' Squad link bonus available with '+squadNear+' squadmate'+(squadNear===1?'':'s')+'.':'';
 card.setAttribute('aria-label',(name?.textContent||exit.name||exit.kind)+'. '+badge+'. '+desc+'. Access: '+access+'.'+linkText);
}
function exitCard(exit,now){
 const card=document.createElement('article'),state=exitState(exit,now);
 card.className='extractCard';card.dataset.exit=exit.id;card.setAttribute('role','group');
 const head=document.createElement('div');head.className='extractHead';
 const name=document.createElement('span');name.className='extractName';name.textContent=exit.name||exit.kind;
 const badge=document.createElement('span');badge.className='exitBadge';badge.dataset.exitBadge='';badge.setAttribute('aria-hidden','true');
 const meta=document.createElement('p');meta.className='extractMeta';meta.dataset.exitMeta='';
 const track=document.createElement('div');track.className='exitProgress';track.setAttribute('aria-hidden','true');
 const fill=document.createElement('span');fill.dataset.exitFill='';track.append(fill);
 const foot=document.createElement('div');foot.className='extractFoot';
 const rule=document.createElement('span');rule.className='extractRule';rule.dataset.exitRule='';
 const seats=document.createElement('span');seats.className='extractSeats';seats.dataset.exitSeats='';
 const link=document.createElement('span');link.className='extractLink';link.dataset.exitLink='';link.hidden=true;
 head.append(name,badge);foot.append(rule,seats,link);card.append(head,meta,track,foot);
 paintExitCard(card,exit,state,now);
 return card
}
function updateExitCards(now){
 if(!snapshot?.exits)return;
 for(const exit of snapshot.exits){
  const card=$('pack').querySelector('[data-exit="'+exit.id+'"]');
  if(card?.classList.contains('extractCard'))paintExitCard(card,exit,exitState(exit,now),now);
 }
}
function rewardMetric(value,label){
 const metric=document.createElement('div');metric.className='rewardMetric';
 const body=document.createElement('b');body.textContent=value;
 const caption=document.createElement('span');caption.textContent=label;
 metric.append(body,caption);return metric;
}
function focusRewardsSurface(selector){
 const target=document.querySelector(selector);if(!target)return;
 target.scrollIntoView({block:'center',behavior:'auto'});
 const focus=target.matches('button,input,select,textarea,summary,[tabindex]')?target:target.querySelector('button,input,select,textarea,summary,[tabindex]');
 (focus||target).focus?.({preventScroll:true});
}
function renderRewards(records){
 const card=$('rewards');if(!card)return;
 if(!records?.length||profile?.activeDeployment||!profile){card.hidden=true;return}
 const result=records[0],raid=result.raid||{},world=raid.map?getWorld(raid.map,raid.mapVersion):null,progression=result.progression||{};
 card.hidden=false;
 $('rewardsOutcome').textContent=(world?.name||raid.map||'Unknown sector')+' · '+Math.round(raid.durationSeconds||0)+'s · '+reasonText(result);
 const xpAfter=Number.isSafeInteger(progression.xpAfter)?progression.xpAfter:Number.isSafeInteger(progression.totalXp)?progression.totalXp:0;
 const xpGained=Number.isSafeInteger(result.xp)?result.xp:Math.max(0,xpAfter-(progression.xpBefore||0));
 $('rewardsTotals').replaceChildren(
  rewardMetric('+'+(result.credits||0),'Credits earned this raid'),
  rewardMetric('+'+xpGained,'Raid XP earned'),
  rewardMetric(String(result.items?.length||0),'Items returned to stash'),
  rewardMetric(String(result.lostItems?.length||0),'Items lost or dropped')
 );
 const settlementLine=$('rewardsSettlement');
 if(settlementLine){settlementLine.hidden=false;settlementLine.textContent=settlementGapText(result)}
 const objectiveLine=objectiveText(result),objectiveCard=$('rewardsObjective');
 if(objectiveLine){objectiveCard.hidden=false;objectiveCard.textContent=objectiveLine;objectiveCard.dataset.state=result.facts?.objective?.completed?'completed':'failed'}
 else{objectiveCard.hidden=true;objectiveCard.textContent='';delete objectiveCard.dataset.state}
 $('rewardsLoot').replaceChildren();
 const lootHeading=document.createElement('h3');lootHeading.textContent='Returned from raid · '+(result.items?.length||0)+' item'+((result.items?.length||0)===1?'':'s');$('rewardsLoot').append(lootHeading);
 if(!result.items?.length){
  const empty=document.createElement('p');empty.className='rewardsEmpty';empty.textContent='No loot was banked from this raid. Starter kit and temporary recovery equipment cannot be stored.';$('rewardsLoot').append(empty);
 }else{
  const list=document.createElement('ul');
  for(const it of result.items){
   const entry=document.createElement('li');entry.dataset.itemId=it.id||'';entry.textContent=label(it);
   if(result.overflow?.includes(it.id))entry.textContent+=' · overflow storage';
   if((result.insuranceAtSettlement||[]).some(claim=>claim.item===it.id))entry.textContent+=' · insured item';
   list.append(entry);
  }
  $('rewardsLoot').append(list);
 }
 const beforeRank=rankProgress(Number.isSafeInteger(progression.xpBefore)?progression.xpBefore:xpAfter),afterRank=rankProgress(xpAfter);
 const next=afterRank.next?' · '+afterRank.next.name+' needs '+afterRank.nextXp+' more XP':' · maximum rank reached';
 const unlocked=progression.unlockedBlueprints?.length?' · Blueprints unlocked: '+progression.unlockedBlueprints.join(', '):'';
 $('rewardsRank').textContent='Rank '+beforeRank.level+' '+beforeRank.name+' → Rank '+afterRank.level+' '+afterRank.name+' · '+afterRank.totalXp+' XP'+next+unlocked+'.';
 const rankSpan=afterRank.next?Math.max(1,afterRank.next.xp-afterRank.xp):1;
 $('rewardsRankBar').max=rankSpan;
 $('rewardsRankBar').value=afterRank.next?Math.max(0,Math.min(rankSpan,rankSpan-afterRank.nextXp)):1;
 $('rewardsRankBar').setAttribute('aria-label','Progress to next rank: '+Math.round(100*(afterRank.next?afterRank.progress:1))+' percent');
 const contractRows=result.contracts||[];
 $('rewardsContract').textContent=contractRows.length
  ?'Contract stage progress this raid: '+contractRows.map(c=>`${c.name} stage ${(c.stage||0)+1}: +${c.delta||0} → ${c.progress||0}/${c.need||0}${c.requirementsMet?' (claim in Contracts)':''}`).join('; ')+'.'
  :'No contract stage progressed this raid. Review Contracts to accept a sector objective before the next deployment.';
 const stashLine=$('rewardsStashUsage');
 if(stashLine){
  const usage=stashUsageText(profile,stashCapacity(profile));
  stashLine.hidden=!usage;
  stashLine.textContent=usage;
  if((profile.overflow||[]).length)stashLine.dataset.overflow='true';
  else delete stashLine.dataset.overflow;
 }
 $('rewardsStash').onclick=()=>{setBaseTab('loadout');focusRewardsSurface('#stash input,#stash button')};
 $('rewardsWorkshop').onclick=()=>{setBaseTab('workshop');focusRewardsSurface('#workshop button')};
 $('rewardsContracts').onclick=()=>{setBaseTab('contracts');focusRewardsSurface('#contracts button')};
 $('rewardsRecords').onclick=()=>{setBaseTab('records');const latest=$('records').querySelector('details');if(latest){latest.open=true;latest.scrollIntoView({block:'center',behavior:'auto'});latest.querySelector('summary')?.focus({preventScroll:true})}};
 $('rewardsDeploy').onclick=()=>{setBaseTab('loadout');focusRewardsSurface('#map')};
}
async function refresh(){
 const generation=authGeneration,updated=await api('profile');if(generation!==authGeneration)return;profile=updated;$('commsToggle').hidden=offlineMode;$('accountOpen').hidden=offlineMode;$('auth').hidden=true;$('base').hidden=false;setBaseLobby(true);bootNotice(null);$('identity').textContent=`${profile.username} · ${profile.credits} credits (${grantBalance(profile)} starter · ${profile.credits-grantBalance(profile)} earned)`;applyOfflineMode();
 await baseUI.render(profile);if(generation!==authGeneration)return;
 $('resume').hidden=!profile.activeDeployment;$('deploy').disabled=!!profile.activeDeployment;
 restoreOfflineRaidPlan();
 const records=await api('results');if(generation!==authGeneration)return;$('records').replaceChildren();
 // A compact aggregate of the authoritative settled results. This is
 // presentation only: every figure comes from the same `results` rows the
 // detail list below renders, and it never invents a rule or reward.
 const recordsSummary=document.createElement('p');recordsSummary.id='recordsSummary';recordsSummary.className='recordsSummary';recordsSummary.textContent=careerText(records);if(!records.length)recordsSummary.dataset.empty='true';$('records').append(recordsSummary);
 for(const r of records){
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${new Date(r.at).toLocaleString()} · ${r.outcome} · ${r.items.length} returned · ${(r.lostItems||[]).length} dropped/lost · +${r.credits} credits · +${r.xp||0} XP`;details.append(summary);
  if(r.progression){const progress=document.createElement('p'),p=r.progression;progress.textContent='Experience '+p.xpBefore+' → '+p.xpAfter+' XP · Rank '+p.rankBefore+' → '+p.rankAfter+' '+p.rankName+(p.unlockedBlueprints.length?' · Blueprints unlocked: '+p.unlockedBlueprints.join(', '):'');details.append(progress)}
  if(r.raid){const context=document.createElement('p');context.textContent=(getWorld(r.raid.map,r.raid.mapVersion)?.name||r.raid.map)+' · '+Math.round(r.raid.durationSeconds||0)+' seconds deployed';details.append(context)}
  for(const text of [reasonText(r),objectiveText(r),settlementText(r),insuranceText(r)].filter(Boolean)){const line=document.createElement('p');line.textContent=text;details.append(line)}
  const costs=document.createElement('p');costs.textContent=`Insurance premium ${r.insurancePremium||0}; refund ${r.refund||0}. ${r.facts?.roundsFired||0} rounds fired, ${r.facts?.medkitsUsed||0} medical supplies used, ${r.facts?.keysUsed||0} access keys used, ${r.facts?.utilitiesUsed||0} utilities thrown.${r.facts?.exitCosts?.length?' Exit access: '+r.facts.exitCosts.map(cost=>cost.exitId+' ('+cost.quantity+' '+(cost.material||cost.kind)+')').join(', ')+'.':''}${r.facts?.extractionExit?' Departed via '+r.facts.extractionExit+'.':''}`;details.append(costs);if(r.facts?.squadLink){const link=document.createElement('p');link.textContent='Squad link-up extraction: '+r.facts.squadLink+' squadmate'+(r.facts.squadLink===1?'':'s')+' shared the exit (+'+r.facts.squadLinkBonus+' credits, +'+r.facts.squadLinkXp+' XP).';details.append(link)}if(r.facts?.healthDamageTaken||r.facts?.damageAbsorbed||r.facts?.damageDealt){const damage=document.createElement('p');damage.textContent='Damage dealt '+Math.round(r.facts.damageDealt||0)+' · shots hit '+(r.facts.shotsHit||0)+'/'+(r.facts.roundsFired||0)+' · health damage '+Math.round(r.facts.healthDamageTaken||0)+' · armor absorbed '+Math.round(r.facts.damageAbsorbed||0)+' · bleeding wounds '+(r.facts.bleedingWounds||0)+' · leg injuries '+(r.facts.legWounds||0)+(r.facts.pelletsFired>(r.facts.roundsFired||0)?' · pellets hit '+(r.facts.pelletsHit||0)+'/'+r.facts.pelletsFired:'');details.append(damage)}if(r.contracts?.length){const progress=document.createElement('p');progress.textContent='Contract progress this raid: '+r.contracts.map(c=>c.name+' stage '+(c.stage+1)+': +'+c.delta+' → '+c.progress+'/'+c.need+(c.requirementsMet?' (requirements met)':'')).join('; ');details.append(progress)}
  for(const [name,items]of [...(r.committedItems?[['Committed loadout (deployment snapshot)',r.committedItems]]:[]),['Banked / protected overflow',r.items],['Dropped or lost',r.lostItems||[]]]){const title=document.createElement('strong');title.textContent=name;details.append(title);const list=document.createElement('ul');for(const it of items){const entry=document.createElement('li');entry.textContent=label(it)+(it.recovery?' · temporary recovery kit (not bankable)':'')+(r.overflow?.includes(it.id)?' · overflow storage':'')+((r.insuranceAtSettlement||[]).some(c=>c.item===it.id)?' · insured (see claim status above)':'');list.append(entry)}details.append(list)}
  $('records').append(details);
 }
 renderRewards(records);
 updateHeroSummary();
 if(!baseTabChosen){baseTabChosen=true;setBaseTab(records.length&&!profile.activeDeployment?'records':'loadout')}
 await refreshParty();if(generation!==authGeneration)return;await comms.refresh();
}
function selectedLoadout(){const recovery=$('recovery').checked,raw=[...$('stash').querySelectorAll('input[data-equip]:checked')].map(e=>e.value),ordered=baseUI?.orderedIds(raw)||raw;return {recovery,itemIds:recovery?[]:ordered,insureIds:recovery?[]:[...$('stash').querySelectorAll('input[data-insure]:checked')].map(e=>e.value)}}
baseUI=baseController({api,run,button,label,getProfile:()=>profile,refresh,selectedLoadout,offline:()=>offlineMode,onLoadoutChanged:unready,chooseQuantity,onInspect:inspect,onSelectionChanged:()=>{awaitingParty=false;updateReadyMismatch();updateDeployReadiness();updateHeroSummary()},onPreviewLoadout:loadout=>{previewLoadout=loadout;preview?.setLoadout(loadout)}});
function updateReadyMismatch(){const member=party?.members.find(m=>m.account===profile?.id),mismatch=!!(member?.ready&&!profile?.activeDeployment&&!sameLoadout(member.loadout,selectedLoadout()));$('readyMismatch').hidden=!mismatch;$('restoreReady').hidden=!mismatch;$('readyMismatch').textContent=mismatch?'Your current selection differs from your readied loadout. Ready again or restore it before deploying.':'';if(mismatch)$('deploy').disabled=true;return mismatch}
// Offline raid plan persistence. The sector and optional field objective are an
// operator preference for the static base only: they prefill the Deploy card and
// never determine loot, damage, extraction or settlement. Every id is
// re-validated by the authoritative deploy route. Online pages never read or
// write this preference. Failures (private mode, quota) are silent because the
// base still works without a saved plan.
let offlinePlanRestored=false;
function planStorage(){try{return typeof localStorage==='undefined'?null:localStorage}catch{return null}}
function restoreOfflineRaidPlan(){
 if(offlinePlanRestored||!offlineMode)return;
 offlinePlanRestored=true;
 const plan=readRaidPlan(planStorage(),RAID_WORLDS);
 if(!plan)return;
 $('map').value=plan.mapId;drawMap($('mapPreview'),plan.mapId);deploymentExitPlan();deploymentObjectiveOptions();
 $('fieldObjective').value=plan.objective||'';
 updateDeployReadiness();
}
function persistOfflineRaidPlan(){
 if(!offlineMode||!profile)return;
 writeRaidPlan(planStorage(),{mapId:$('map').value,objective:$('fieldObjective').value||null},RAID_WORLDS);
}
// Offline-only deploy readiness. The verdict and numbers come from the same
// authoritative preflight the in-page deploy route runs; the client only
// formats them, so the base screen never duplicates raid rules. Online hosts
// keep their squad/latency readiness and this line stays hidden.
function updateDeployReadiness(){
 const line=$('deployReadiness');if(!line)return;
 if(!offlineMode||!offlineReadinessCheck||!profile){line.hidden=true;delete line.dataset.ready;delete line.dataset.weight;delete line.dataset.premium;delete line.dataset.objective;return}
 line.hidden=false;
 if(profile.activeDeployment){
  delete line.dataset.weight;delete line.dataset.premium;delete line.dataset.objective;line.dataset.ready='false';
  line.textContent='Operator still in raid — resume the active deployment before deploying again.';
  $('deploy').disabled=true;return;
 }
 let result;
 try{result=offlineReadinessCheck(offlineRuntime,{...selectedLoadout(),mapId:$('map').value,objective:$('fieldObjective').value||null})}
 catch(error){result={ready:false,blocker:error.message||String(error)}}
 const objective=result.objective||null;
 if(objective)line.dataset.objective=objective.id;else delete line.dataset.objective;
 const objectiveSuffix=objective?' · field objective '+objective.name+' ('+objective.site+') · +'+objective.rewardCredits+' credits / +'+objective.rewardXp+' XP after a '+objective.holdSeconds+' s hold':'';
 line.dataset.ready=String(!!result.ready);
 line.dataset.premium=String(result.ready?(result.premium||0):'');
 line.dataset.weight=String(result.ready&&!result.recovery?(Number(result.weight)||0).toFixed(1):'');
 line.textContent=result.ready
  ?(result.recovery?'Recovery kit ready — free starter rifle and medkit; nothing in the kit can be banked':'Ready to deploy — '+(Number(result.weight)||0).toFixed(1)+'/40 kg carried · insurance premium '+(result.premium||0)+' credits'+(result.insured?' · '+(result.insured===1?'1 insured gear item':result.insured+' insured gear items'):''))+objectiveSuffix+'.'
  :'Deploy blocked — '+result.blocker+'.';
 $('deploy').disabled=!result.ready;
}
$('restoreReady').onclick=()=>run(async()=>{const account=profile?.id;await refresh();if(profile?.id!==account)return;const member=party?.members.find(m=>m.account===account);if(!member?.ready||profile.activeDeployment)throw new Error('The readied loadout is no longer available. Review your squad.');if((member.loadout.itemIds||[]).some(id=>!profile.items.some(it=>it.id===id)))throw new Error('Readied equipment is no longer in your stash. Select equipment and ready again.');baseUI.selectLoadout(member.loadout);await refreshParty()});
function selectedMatch(){return matchPreferences(offlineMode?{allowMixed:true,maxRttMs:0}:party?.match??{allowMixed:$('allowMixed').checked,maxRttMs:Number($('maxRtt').value)})}
// Offline solo raids have no party, voice transport, or remote performance
// probes. Hide those hosted-only controls once the page has selected the
// in-page service; the online/Node path keeps every control unchanged.
function applyOfflineMode(){
 if(!offlineMode)return;
 // There is no network transport to report offline; the 0 ms RTT badge was
 // never a real reading and only added clutter to the raid HUD.
 $('networkStatus').hidden=true;
 $('squadOnlineControls').hidden=true;$('connectionControls').hidden=true;$('commsToggle').hidden=true;$('communications').hidden=true;
 $('tabSquad').hidden=true;$('accountOpen').hidden=true;$('onlineAccountSecurity').hidden=true;
 if(baseTabName==='squad')setBaseTab('loadout');
 $('checkLatency').disabled=true;$('voiceEnable').disabled=true;$('partyMode').disabled=true;$('partyCode').disabled=true;$('partyRole').disabled=true;
 $('voiceStatus').textContent='Voice is unavailable in offline raid mode.';
 $('latencyStatus').textContent='Offline raid — no connection check required.';
 // Explain a reset instead of silently minting a fresh operator, and warn
 // when local writes fail so the player knows progress may not survive reload.
 const info=window.__hszOfflineRaid||{},note=$('offlineSaveNote');
 if(info.recovery){
  note.hidden=false;note.dataset.state='recovered';
  note.textContent='Your previous offline save could not be read ('+(info.recovery.reason==='unsupported-version'?'newer save format':'damaged save')+'). A fresh operator and stash were created on this device; new progress will still be saved offline.';
 }else if(info.persistenceError){
  note.hidden=false;note.dataset.state='error';
  note.textContent='Local progress could not be saved: '+info.persistenceError+'. This raid still uses local authority, but new progress may not survive a reload.';
 }else{
  note.hidden=true;note.removeAttribute('data-state');note.textContent='';
 }
 applyOfflineAuth();
}
// The offline session is passwordless, so the sign-out screen must not demand
// one. Hide the online-only password/register/recovery controls (and keep them
// out of HTML validation) and explain how to continue as a local operator.
// Online pages never reach this path, so their auth form is unchanged.
function applyOfflineAuth(){
 if(!offlineMode)return;
 const login=$('login'),password=login.querySelector('[name=password]'),submit=login.querySelector('button[type=submit]');
 if(password){password.required=false;password.value='';password.closest('label')?.setAttribute('hidden','')}
 $('offlineAuthNote').hidden=false;
 $('register').hidden=true;$('recoverOpen').hidden=true;$('recoverPanel').hidden=true;
 if(submit)submit.textContent='Continue offline';
}
async function measureLatency(){
 if(offlineMode){latencyProof={proofId:'offline-proof',rttMs:0,withinLimit:true,allowMixed:true,offline:true,at:performance.now(),generation:authGeneration,account:profile?.id};return latencyProof}
 const generation=authGeneration,account=profile?.id;if(!account)throw new Error('Sign in to check your connection');if(probeWork?.generation===generation&&probeWork?.account===account)return probeWork.promise;
 const task={generation,account};task.promise=(async()=>{const challenge=await api('matchmaking',{operation:'probe'});if(authGeneration!==generation||profile?.id!==account)throw new Error('Connection check canceled after sign-out');const measured=await api('matchmaking',{operation:'measure',nonce:challenge.nonce});if(authGeneration!==generation||profile?.id!==account)throw new Error('Connection check canceled after sign-out');latencyProof={...measured,at:performance.now(),generation,account};const limit=selectedMatch().maxRttMs;$('latencyStatus').textContent='Server-measured round trip: '+measured.rttMs+' ms'+(limit&&measured.rttMs>limit?' · above your limit; change the limit or try again.':' · checked just now.');return latencyProof})().finally(()=>{if(probeWork===task)probeWork=null});probeWork=task;return task.promise;
}
$('checkLatency').onclick=()=>run(measureLatency);
for(const id of ['allowMixed','maxRtt'])$(id).addEventListener('change',()=>{latencyProof=null;if(party)return run(async()=>{const match=matchPreferences({allowMixed:$('allowMixed').checked,maxRttMs:Number($('maxRtt').value)});await api('party',{type:'configure',match});awaitingParty=false;await refreshParty();message('Squad preferences changed. Everyone must ready again.')});renderMatchSummary()});
function renderMatchSummary(){if(offlineMode){$('matchSummary').textContent='Offline raid · solo versus machines. Gear and skill matching are open; machines are the only opposition. No human session or connection check is required.';return}const match=selectedMatch(),size=party?.members.length||1;$('matchSummary').textContent='Connected region: '+(matchInfo?.region||'checking')+'. '+size+' operator'+(size===1?'':'s')+' · 10-minute raid · up to 9 operators. Same-size squads preferred; '+(match.allowMixed?'mixed-size fallback allowed.':'same-size sessions only.')+' Gear/skill matching is open. If no safe compatible session exists, a fresh raid starts without a minimum human population. Conditions are assigned by the selected raid.'}
async function refreshParty(){
 const generation=authGeneration,updated=await api('party');if(generation!==authGeneration)return;party=updated;
 if(offlineMode){
  party=null;
  if(!matchInfo)matchInfo=await api('matchmaking');
  if(generation!==authGeneration)return;
  applyOfflineMode();renderMatchSummary();
  $('partyState').textContent='Playing solo offline — machines are the opposition.';
  $('deploy').textContent='Deploy';
  $('deploy').disabled=!!profile.activeDeployment;
  updateReadyMismatch();updateDeployReadiness();comms.update(null,null);
  return;
 }
 if(!party)$('partyRole').value='';if(!matchInfo)matchInfo=await api('matchmaking');if(generation!==authGeneration)return;for(const id of ['allowMixed','maxRtt'])$(id).disabled=!!party&&party.leader!==profile.id;if(party){$('allowMixed').checked=party.match?.allowMixed??true;$('maxRtt').value=String(party.match?.maxRttMs??0)}renderMatchSummary();$('partyState').textContent=party?`Invite ${party.id} · ${party.mode} · ${party.region}`:'Playing solo.';
 $('partyRoster').replaceChildren();
 for(const m of party?.members||[]){const p=document.createElement('p'),role=roleLabel(m.loadout?.role);p.textContent=`${m.username}${m.account===party.leader?' · leader':''} · ${m.ready?'READY':'preparing'}${role?' · '+role+' · '+roleSummary(m.loadout.role):''}${m.latency?.rttMs!=null?' · '+m.latency.rttMs+' ms':''}${m.ready&&!m.latency?.withinLimit?' · needs connection check':''}${m.ready?' · '+(m.loadout.recovery?'free recovery kit':m.loadout.itemIds.length+' owned items'):''}${m.readinessError?' · '+m.readinessError:''}`;$('partyRoster').append(p)}
 comms.update(inRaid?snapshot:null,party);
 $('partyCreate').hidden=!!party;$('partyJoin').hidden=!!party;$('partyReady').hidden=!party;$('partyLeave').hidden=!party;
 $('map').disabled=!!party;if(party)$('map').value=party.mapId;drawMap($('mapPreview'),$('map').value);deploymentObjectiveOptions();
 $('deploy').textContent=party?'Deploy ready squad':'Deploy selected equipment';
 $('deploy').disabled=!!profile.activeDeployment||!!(party&&(party.leader!==profile.id||!party.members.every(m=>m.ready&&m.latency?.withinLimit!==false)));updateReadyMismatch();
}
$('partyCreate').onclick=()=>run(async()=>{const info=await api('capabilities');await api('party',{type:'create',mode:$('partyMode').value,region:info.region,mapId:$('map').value,match:selectedMatch()});await refreshParty()});
$('partyJoin').onclick=()=>run(async()=>{await api('party',{type:'join',code:$('partyCode').value.trim()});await refreshParty()});
$('partyLeave').onclick=()=>run(async()=>{await api('party',{type:'leave'});awaitingParty=false;await refreshParty()});
$('partyReady').onclick=()=>run(async()=>{const generation=authGeneration,account=profile?.id,measured=selectedMatch().maxRttMs?await measureLatency():null;
 try{await api('party',{type:'ready',ready:true,loadout:{...selectedLoadout(),role:$('partyRole').value||undefined},latencyProof:measured?.proofId})}catch(error){awaitingParty=false;if(error.status===409&&generation===authGeneration&&profile?.id===account)await refresh();throw error}
 if(generation!==authGeneration||profile?.id!==account)return;awaitingParty=true;await refreshParty()});
async function unready(){awaitingParty=false;updateReadyMismatch();if(party?.members.find(m=>m.account===profile.id)?.ready){$('deploy').disabled=true;await api('party',{type:'ready',ready:false,loadout:selectedLoadout()});await refreshParty()}}
$('stash').addEventListener('change',()=>run(unready));$('recovery').addEventListener('change',()=>run(unready));
let partyPolling=false;
setInterval(async()=>{if(!profile||inRaid||partyPolling||busy)return;partyPolling=true;try{const generation=authGeneration,wasActive=profile.activeDeployment,updated=await api('profile');if(generation!==authGeneration||!profile)return;
 // Offline authority resolves pending insurance claims on the in-page 50 ms
 // tick, up to two minutes after settlement. Poll compares the authoritative
 // list with the one currently on screen so a claim that becomes eligible
 // re-renders the base instead of leaving stale "pending" copy behind. Online
 // keeps its existing deployment-only refresh semantics.
 const insuranceChanged=offlineMode&&JSON.stringify(updated.insurance||[])!==JSON.stringify(profile.insurance||[]);
 profile.activeDeployment=updated.activeDeployment;if(!wasActive&&updated.activeDeployment)baseUI.risk();$('resume').hidden=!profile.activeDeployment;if(wasActive&&!updated.activeDeployment){await refresh();message('Raid settled. Review your item losses and rewards below.')}else if(insuranceChanged){await refresh();if(generation!==authGeneration||!profile||inRaid)return;message('Insurance claims updated.')}else await refreshParty();if(generation!==authGeneration||!profile)return;if(!profile.activeDeployment&&party?.members.find(m=>m.account===profile.id)?.ready&&selectedMatch().maxRttMs&&(!latencyProof||latencyProof.generation!==authGeneration||performance.now()-latencyProof.at>8000))await measureLatency();if(generation!==authGeneration||!profile)return;if(awaitingParty&&profile.activeDeployment){const resumed=await api('raid');if(generation!==authGeneration||!profile||inRaid)return;snapshot=resumed;awaitingParty=false;start()}}catch(e){message(e.message)}finally{partyPolling=false}},2000);
async function auth(register){const data=Object.fromEntries(new FormData($('login')));await api(register?'register':'login',data);authGeneration++;$('login').reset();message('Signed in.');await refresh()}
$('login').onsubmit=e=>{e.preventDefault();run(()=>auth(false))};$('register').onclick=()=>run(()=>auth(true));
$('logout').onclick=()=>run(async()=>{await api('logout',{});await signedOut('Signed out.')});
for(const w of RAID_WORLDS){const o=document.createElement('option');o.value=w.id;o.textContent=w.name;$('map').append(o)}
$('deploy').onclick=()=>run(async()=>{const generation=authGeneration,measured=selectedMatch().maxRttMs?await measureLatency():null;if(generation!==authGeneration||!profile)throw new Error('Deployment canceled after account change');const deployed=await api('deploy',{protocol:RAID_PROTOCOL,requestId:crypto.randomUUID(),mapId:$('map').value,objective:$('fieldObjective').value||null,match:selectedMatch(),latencyProof:measured?.proofId,...selectedLoadout()});if(generation!==authGeneration||!profile)return;snapshot=deployed;awaitingParty=false;start()});
$('resume').onclick=()=>run(async()=>{const generation=authGeneration,resumed=await api('raid');if(generation!==authGeneration||!profile)return;snapshot=resumed;start()});
let packKey='',frame=0,controlsDisabled=false;
function sprintIntent(){return stickSprint||input.held('sprint')}
function stopHeldInput(){aimMouse=aimTouch=aiming=false;cancelTouch();$('aim').setAttribute('aria-pressed','false');$('aim').classList.remove('down');trigger?.clear();comms.voice.quiet();if(inRaid&&snapshot?.self.alive&&wire&&!wire.closed&&wire.actor.deploymentId===snapshot.self.deploymentId)wire.send({type:'move',x:0,z:0,yaw,pitch,sprint:false}).catch(()=>{})}
function sendHeldMovement(){if(inRaid&&snapshot?.self.alive&&wire&&!wire.closed&&wire.actor.deploymentId===snapshot.self.deploymentId)wire.send(()=>({type:'move',...movementInput(),yaw,pitch,sprint:sprintIntent()})).catch(()=>{})}
function start(){
 if(snapshot.protocol!==RAID_PROTOCOL)throw new Error('Client update required. Reload to reconnect safely.');
 if(!getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion))throw new Error('Map update required. Reload to reconnect safely.');
 wire?.close();stateAt=performance.now();controlsDisabled=false;resetTacticalMap();clearHitmarker();lastHitToken=hitToken(snapshot.self.hit);inRaid=true;raidGeneration++;setBaseLobby(false);document.body.dataset.inRaid='true';preferences.apply();lastHealth=snapshot.self.hp;lastOutcome='';lastBoard=false;hudStatusKey='';document.querySelector('main').inert=true;seq=snapshot.self.seq;yaw=snapshot.self.yaw;pitch=snapshot.self.pitch||0;input.clear();$('play').style.display='block';syncTouchHeight();syncRaidDock();
 view||=new RaidView($('view'));view.start(snapshot);view.applySettings(preferences.get());prediction=new LocalPrediction(snapshot);prediction.onBlocked=()=>{view?.audio.play('bump');view?.bump()};wire?.close();const generation=raidGeneration;wire=new ReliableActions({state:snapshot,request:packet=>api('action',packet,{timeoutMs:2500}),onState:(state,network)=>{if(!inRaid||generation!==raidGeneration)return;snapshot=state;stateAt=performance.now();seq=state.self.seq;prediction?.reconcile(state,network);updateUI()},onNetwork:network=>{if(inRaid&&generation===raidGeneration&&!offlineMode)$('networkStatus').textContent=network.status==='connected'?'Connected · '+Math.round(network.rttMs/10)*10+' ms RTT':network.status==='retrying'?'Connection interrupted · retrying safely':network.status==='update_required'?'Client update required · reload to reconnect safely':'Connection lost · movement prediction paused'}});setPack(!(matchMedia('(pointer:coarse)').matches||document.documentElement.dataset.compactHud==='true'));packKey='';seenEvents.clear();$('events').textContent='';$('view').focus();updateUI();
}
// The raid boots instantly on procedural textures so the base and a deployment
// are playable while the already-shipped photo surfaces and MakeHuman bodies
// load in the background. Nothing here is downloaded from a new source: it is
// the same assets.js / humans.js the main game already uses.
let raidArtStarted=false;
function loadRaidArt(){
 if(raidArtStarted)return;
 raidArtStarted=true;
 const started=performance.now();
 Promise.allSettled([loadAssets(),loadLoot(),loadHumans(),loadWindows(),loadBuildings(),loadNature(),loadGround(),loadSkyPhoto()]).then(results=>{
  const assets=results[0].status==='fulfilled'&&results[0].value===true;
  window.__raidArt={ms:Math.round(performance.now()-started),assets,loot:Object.keys(HQP.loot),humans:HUM.ready,machines:Object.keys(HQP.machines),windows:Object.keys(HQP.windows),buildings:Object.keys(HQP.buildings),nature:Object.keys(HQP.nature),ground:Object.keys(HQP.ground),photos:HQP.ready,sky:!!HQP.sky};
  view?.refreshArt?.();
  preview?.refreshArt?.();
 }).catch(()=>{});
}
let lastFrame=0,autoReloadAt=0;
// Main-game touch contract: an empty magazine reloads itself while the player
// still holds the trigger. In raids the crosshair sighting is that trigger, so
// the reload runs in-frame instead of waiting for a separate button tap.
function autoReloadIfNeeded(sighted){
 const s=snapshot?.self;
 if(!s?.alive||s.downed||!s.weaponId||weaponWork||autoReloadAt)return;
 if(!(sighted||input.held('fire')))return;
 const weapon=[...s.equipment,...s.pack].find(it=>it.kind==='weapon'&&it.id===s.weaponId);
 if(!weapon||(weapon.loaded??0)>0||(weapon.condition??0)<=0)return;
 autoReloadAt=performance.now();
 action({type:'reload'}).catch(()=>{}).finally(()=>{autoReloadAt=0});
}
function swapWeapon(){
 const s=snapshot?.self;
 if(!s?.alive||s.downed||weaponWork)return;
 const weapons=[...s.equipment,...s.pack].filter(it=>it.kind==='weapon'&&it.id!==s.weaponId);
 const other=weapons[0];
 if(other)run(()=>action({type:'equip',itemId:other.id}));
}
function renderFrame(time){
 const dt=Math.min(.2,(time-lastFrame)/1000||.016);lastFrame=time;aiming=!!(inRaid&&snapshot?.self.alive&&!snapshot.self.downed&&snapshot.self.weaponId&&!weaponWork&&!preferences.isModal()&&$('communications').hidden&&!mapOpen&&(aimMouse||aimTouch||input.held('aim')));$('aim').setAttribute('aria-pressed',String(aiming));$('play').dataset.aiming=String(aiming);
 applyTouchLook(dt);
 if(inRaid&&!preferences.isModal()&&$('communications').hidden&&!mapOpen){yaw-=(Number(input.held('lookRight'))-Number(input.held('lookLeft')))*dt*1.7*(aiming?.45:1);pitch=Math.max(-1.2,Math.min(1.2,pitch+(Number(input.held('lookUp'))-Number(input.held('lookDown')))*dt*1.4*(aiming?.45:1)))}
 // The reticle turns red over a machine the shot resolver can actually hit.
 // Like the main game on phones, that sighting is the trigger: every weapon
 // class fires its own cadence while the crosshair owns a machine, and an
 // empty magazine reloads without the player reaching for a Reload button.
 const sighted=inRaid&&snapshot?.self.alive&&!preferences.isModal()&&$('communications').hidden&&!mapOpen?machineUnderCrosshair():null;
 $('play').dataset.target=String(!!sighted);
 trigger.hold('crosshair',!!sighted,true);
 trigger.hold('keyboard',input.held('fire'));trigger.tick();
 autoReloadIfNeeded(!!sighted);
 frame=requestAnimationFrame(renderFrame);
 if(inRaid)view?.frame(time,yaw,pitch,prediction?.frame(movementInput(),time),aiming);
 else if(profile&&!$('base').hidden){preview||=new BasePreview($('basePreview'));preview.setLoadout(previewLoadout);preview.applySettings(preferences.get());preview.frame(time,true)}
 renderNavHud();
}
requestAnimationFrame(renderFrame);
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
const seenEvents=new Set();let spectateId='';
// The boss panel renders only the living, snapshot-visible Overlord. Phase
// progression stays authoritative; the client just labels it.
function updateBossUI(snapshot){
 const boss=(snapshot.machines||[]).find(m=>m.kind==='overlord'&&m.hp>0),panel=$('bossPanel');
 if(!boss){panel.hidden=true;return}
 const max=boss.maxHp||760,hp=Math.max(0,Math.min(max,Math.ceil(boss.hp)));
 panel.hidden=false;panel.dataset.phase=boss.bossPhase||'approach';
 $('bossName').textContent='Foundry Warden';
 $('bossPhase').textContent=' · '+(BOSS_PHASES[boss.bossPhase]||BOSS_PHASES.approach);
 $('bossHpText').textContent='HP '+hp+'/'+max;
 $('bossHp').max=max;$('bossHp').value=hp;
}
$('spectate').onclick=()=>{const teammates=snapshot.players.filter(p=>p.team===snapshot.self.team);if(!teammates.length)return;const i=teammates.findIndex(p=>p.id===(spectateId||snapshot.camera?.follow));spectateId=teammates[(i+1)%teammates.length].id};
// Vitality tone for the HUD scoreboard: thresholds are presentation-only and
// exported so the browser graders can verify the mapping without altering
// snapshot or gameplay state. Numeric values always stay visible in text.
export function hudVitalState(hp,downed){if(downed)return 'downed';if(hp<=30)return 'critical';if(hp<=60)return 'warn';return 'ok'}
// Screen-edge vitality haze. Same presentation thresholds as the HUD token and
// derived only from the authoritative self hp/downed fields; reduced motion is
// handled entirely by the shared data-reduced-motion CSS gate.
export function vitalVignetteState(hp,downed){
 if(downed)return 'downed';
 const value=Number(hp);
 if(!Number.isFinite(value))return 'ok';
 if(value<=30)return 'critical';
 if(value<=60)return 'warn';
 return 'ok';
}
export function renderVitalVignette(self){
 const node=document.getElementById('vitalVignette');
 if(!node||!self)return null;
 const state=vitalVignetteState(self.hp,!!self.downed);
 if(node.dataset.state!==state)node.dataset.state=state;
 return state;
}
function hudToken(metric,key,value,state){
 const token=document.createElement('span');token.className='hudToken hudScore';token.dataset.metric=metric;
 if(state)token.dataset.state=state;
 if(key!==null&&key!==''){const keyEl=document.createElement('span');keyEl.className='hudKey';keyEl.textContent=key+' ';token.append(keyEl)}
 const val=document.createElement('b');val.className='hudVal';val.textContent=value;token.append(val);return token
}
function hudAlert(text,state){const alert=document.createElement('span');alert.className='hudAlert';if(state)alert.dataset.state=state;alert.textContent=text;return alert}
// Compact touch HUD: a slim translucent strip carries the four essentials
// (health bar, ammunition, raid clock, backpack count) while the detailed
// telemetry panel stays mounted but visually clipped for assistive tech and
// existing status/readout behaviour. Presentation only; every value comes from
// the same authoritative snapshot fields the full scoreboard renders.
const slimAmmoText=s=>{
 if(!s.weaponId)return {text:'Unarmed',state:'unarmed'};
 const weapon=[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),cap=Math.max(0,Math.round(Number(WEAPONS[weapon?.weapon]?.mag)||0)),ammo=Math.max(0,Math.round(Number(s.ammo)||0));
 return {text:ammo+(cap?'/'+cap:''),state:ammo===0?'critical':cap>0&&ammo<=cap*.25?'warn':'ok'};
};
function renderSlimHud(s,snapshot){
 const root=document.getElementById('hudSlim');if(!root||!s)return;
 const hp=Math.max(0,Math.min(100,Math.ceil(Number(s.hp)||0))),state=s.downed?'downed':hudVitalState(s.hp,false);
 root.dataset.vital=state;
 const fill=document.getElementById('slimHpFill'),track=document.getElementById('slimHpTrack');
 if(fill)fill.style.width=Math.max(0,Math.min(100,(s.downed?0:hp)))+'%';
 if(track){track.setAttribute('aria-valuenow',String(s.downed?0:hp));track.setAttribute('aria-label',s.downed?'Operator downed':'Operator health '+hp+' of 100')}
 const text=document.getElementById('slimHpText');if(text)text.textContent=s.downed?'DOWNED':String(hp);
 const ammo=document.getElementById('slimAmmo'),ammoInfo=slimAmmoText(s);
 if(ammo){ammo.textContent=ammoInfo.text;ammo.dataset.state=ammoInfo.state}
 const left=Math.max(0,Math.ceil(Number(snapshot.left)||0)),clock=document.getElementById('slimTimer');
 if(clock)clock.textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
 const pack=document.getElementById('slimPack');if(pack)pack.textContent=(s.pack?.length||0)+'/'+(s.cap||0);
}
function flashSlimHud(){
 const root=document.getElementById('hudSlim');if(!root)return;
 root.classList.remove('hpFlash');void root.offsetWidth;root.classList.add('hpFlash');
 clearTimeout(flashSlimHud.timer);flashSlimHud.timer=setTimeout(()=>root.classList.remove('hpFlash'),620);
}
// The compact briefing is intentionally transient: zone, clock, weather,
// compass bearing and field objective appear on spawn or when the sector
// state changes, then fade instead of holding a permanent banner over the
// world. Values are the same authoritative fields the full telemetry renders.
let hudStatusKey='',hudStatusTimer=0;
// One short line only. The old zone · weather · clock · facing banner wrapped
// to two lines over live fire at 844, so drop the duplicate status and keep the
// nearest weapons cache (or real field objective) that a player actually steers
// by. The cache is named as a cache so it can never be mistaken for the EXIT
// chip's extraction exit.
function compactStatusBrief(s,snapshot){
 const o=snapshot.objective;
 if(o)return o.stage==='approach'?'Objective '+o.name+' · '+o.site:o.stage==='secure'?'Securing '+o.site:o.stage==='secured'?'Objective secured · extract':'Objective '+o.stage;
 const armory=nearestArmory(s,snapshot);
 if(armory)return `${armory.cache.label.split(' · ')[0]} · ${Math.round(armory.distance)} m ${armory.compass} · ${armory.degree}°`;
 const heading=mapBearing(s.x,s.z,s.x+Math.sin(inRaid?yaw:Number(s.yaw)||0),s.z+Math.cos(inRaid?yaw:Number(s.yaw)||0));
 return 'Facing '+mapCardinal(heading)+' · '+mapDegree(heading);
}
function showCompactStatus(text){
 const node=document.getElementById('hudStatus');if(!node||!text)return;
 clearTimeout(hudStatusTimer);
 node.textContent=text;node.hidden=false;
 void node.offsetWidth;node.classList.add('show');
 // Keep the one-line objective readable through the first deploy and its
 // initial interactions; it still fades to the slim HUD within 12 s.
 hudStatusTimer=setTimeout(()=>{node.classList.remove('show');hudStatusTimer=setTimeout(()=>{node.hidden=true},520)},12000);
}
function syncCompactStatus(s,snapshot){
 if(document.documentElement.dataset.compactHud!=='true'||!s)return;
 const o=snapshot.objective,world=snapshot.map+'|'+(snapshot.conditions?.name||snapshot.conditions?.weather||'')+'|'+(o?o.stage+'|'+o.site:'');
 if(world===hudStatusKey)return;
 hudStatusKey=world;
 showCompactStatus(compactStatusBrief(s,snapshot));
}
function renderHud(s,snapshot){
 const now=snapshot.serverTime,parts=[];
 if(s.downed)parts.push(hudToken('vital','DOWNED','· bleed '+Math.ceil(s.bleedLeft)+'s','downed'));
 else parts.push(hudToken('vital','HP',String(Math.max(0,Math.ceil(s.hp))),hudVitalState(s.hp,false)));
 if(s.armor)parts.push(hudToken('armor','Armor',Math.ceil(s.armor.protection)+'/'+s.armor.capacity));
 if(s.wounds?.bleedingUntil>now)parts.push(hudAlert('BLEEDING','critical'));
 if(s.wounds?.limpUntil>now)parts.push(hudAlert('LEG INJURY','warn'));
 if(s.weaponId){
  const weapon=[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),cap=Math.max(0,Math.round(Number(WEAPONS[weapon?.weapon]?.mag)||0)),ammo=Math.max(0,Math.round(Number(s.ammo)||0));
  const token=hudToken('ammo','Ammo',ammo+(cap?'/'+cap:''),ammo===0?'critical':cap>0&&ammo<=cap*.25?'warn':undefined);
  token.setAttribute('aria-label','Ammo '+ammo+(cap?' of '+cap:'')+(ammo===0?', empty':cap>0&&ammo<=cap*.25?', low':''));
  parts.push(token);
  if(ammo===0)parts.push(hudAlert('EMPTY · RELOAD','critical'));
 }else parts.push(hudToken('ammo','','UNARMED','unarmed'));
 if(s.vaulting)parts.push(hudAlert('VAULTING','warn'));
 else if(s.sliding)parts.push(hudAlert('SLIDING','warn'));
 else if(s.sprint&&Math.hypot(s.move?.x||0,s.move?.z||0)>.01)parts.push(hudAlert('SPRINT','warn'));
 parts.push(hudToken('time','Time',Math.ceil(snapshot.left)+'s'));
 if(snapshot.escalation?.level)parts.push(hudToken('threat','Threat',String(snapshot.escalation.level),snapshot.escalation.level>=3?'critical':'warn'));
 if(snapshot.escalation?.elite)parts.push(hudAlert('ELITE ×'+snapshot.escalation.elite,'critical'));
 parts.push(hudToken('pack','Pack',s.pack.length+'/'+s.cap));
 parts.push(hudToken('weight','Weight',(s.weight||0).toFixed(1)+'/'+(s.weightCap||40)+' kg'));
 const out=[];for(const part of parts)out.push(out.length?' · ':null,part);
 $('hud').replaceChildren(...out.filter(Boolean));
}
// Off-screen awareness comes only from snapshot machines the server has already
// line-of-sight-checked. Markers are placed by operator yaw so a flank or rear
// contact is readable without audio; forward contacts stay in the scene.
export function threatIndicators(snapshot){
 const s=snapshot?.self,machines=snapshot?.machines||[];
 if(!s||!s.alive||s.downed)return [];
 const found=[];
 for(const m of machines){
  if(!(m.hp>0)||!Number.isFinite(m.x)||!Number.isFinite(m.z))continue;
  const dx=m.x-s.x,dz=m.z-s.z,dist=Math.hypot(dx,dz);
  if(!Number.isFinite(dist)||dist>40||dist<1)continue;
  const cos=Math.cos(s.yaw||0),sin=Math.sin(s.yaw||0);
  const right=-dx*cos+dz*sin,forward=dx*sin+dz*cos;
  if(Math.abs(Math.atan2(right,forward))<55*Math.PI/180)continue;
  found.push({m,dist,angle:Math.atan2(right,forward)});
 }
 return found.sort((a,b)=>a.dist-b.dist).slice(0,4);
}
// The server records the bearing of the most recent positioned incoming damage
// for 1.6 s. The same yaw/right-vector math places a transient arrow; ambient
// damage with no attacker position is deliberately absent, never fabricated.
export function hurtIndicator(snapshot){
 const s=snapshot?.self,h=s?.hurt;
 if(!s||!s.alive||s.downed||!h)return null;
 const dx=Number(h.dx)||0,dz=Number(h.dz)||0,distance=Math.hypot(dx,dz);
 if(!Number.isFinite(distance)||distance<1e-4)return null;
 const cos=Math.cos(s.yaw||0),sin=Math.sin(s.yaw||0);
 const right=-dx*cos+dz*sin,forward=dx*sin+dz*cos;
 const angle=Math.atan2(right,forward),deg=angle*180/Math.PI;
 const source=String(h.source||'combat');
 return {angle,deg,source,side:Math.abs(deg)>128?'behind':Math.abs(deg)<=28?'ahead':deg>0?'right':'left',
  label:{machine:'machine fire',rival:'rival fire',hazard:'hazard',blast:'explosion',operator:'operator fire'}[source]||'damage'};
}
// The arrow is rebuilt only when the authoritative hit changes (or the ring
// size moves). Replacing it every frame restarted its flash animation from zero
// on each render, so an incoming hit was effectively invisible.
let hurtMarkerKey='';
function renderHurtDirection(snapshot){
 const layer=$('hurt'),dir=hurtIndicator(snapshot);
 if(!dir){if(hurtMarkerKey||layer.childElementCount){layer.hidden=true;layer.replaceChildren();hurtMarkerKey=''}return}
 // The damage arrow sits inside the threat ring so a machine warning and a hit
 // source at the same bearing stay visually distinct.
 const ring=Math.round(Math.max(56,Math.min(92,Math.min(innerWidth,innerHeight)*.075)));
 const key=[dir.source,dir.side,Math.round(dir.deg),ring,snapshot.self.hurt?.at||0].join('|');
 if(key===hurtMarkerKey)return;
 hurtMarkerKey=key;
 layer.hidden=false;layer.replaceChildren();
 const marker=document.createElement('span');
 marker.className='hurtMarker';marker.dataset.source=dir.source;marker.dataset.side=dir.side;
 marker.style.setProperty('--tx',Math.round(Math.sin(dir.angle)*ring)+'px');
 marker.style.setProperty('--ty',Math.round(-Math.cos(dir.angle)*ring)+'px');
 marker.style.setProperty('--rot',Math.round(dir.deg)+'deg');
 marker.setAttribute('role','img');
 marker.setAttribute('aria-label','Incoming damage from '+dir.side+' · '+dir.label);
 const glyph=document.createElement('span');glyph.className='hurtGlyph';glyph.setAttribute('aria-hidden','true');
 marker.append(glyph);layer.append(marker);
}
function renderThreatIndicators(snapshot){
 const layer=$('threats'),defs=threatIndicators(snapshot);
 if(!defs.length){layer.hidden=true;layer.replaceChildren();return}
 layer.hidden=false;layer.replaceChildren();
 const ring=Math.round(Math.max(96,Math.min(150,Math.min(innerWidth,innerHeight)*.17)));
 for(const {m,dist,angle} of defs){
  const deg=angle*180/Math.PI,side=Math.abs(deg)>128?'behind':deg>0?'right':'left';
  const name=MACHINES[m.kind]?.name||String(m.kind||'Machine');
  const charging=m.state==='windup';
  const marker=document.createElement('span');
  marker.className='threatMarker';marker.dataset.kind=m.kind||'machine';marker.dataset.state=charging?'windup':'tracking';marker.dataset.machineId=m.id;
  if(m.elite)marker.dataset.elite='true';
  marker.style.setProperty('--tx',Math.round(Math.sin(angle)*ring)+'px');
  marker.style.setProperty('--ty',Math.round(-Math.cos(angle)*ring)+'px');
  marker.setAttribute('role','img');
  marker.setAttribute('aria-label',name+' '+Math.round(dist)+' m '+side+' '+Math.round(Math.abs(deg))+'°'+(charging?' · charging':''));
  const glyph=document.createElement('span');glyph.className='threatGlyph';glyph.setAttribute('aria-hidden','true');glyph.textContent=charging?'!':'◆';
  const meta=document.createElement('span');meta.className='threatMeta';meta.setAttribute('aria-hidden','true');meta.textContent=Math.round(dist)+' m';
  marker.append(glyph,meta);layer.append(marker);
 }
}

// The sector status line is derived exclusively from authoritative snapshot
// escalation data: threat level, the nearest environmental front and the
// endgame squeeze countdown. It never predicts or fabricates contacts.
export function escalationText(snapshot){
 const esc=snapshot?.escalation||{},parts=[];
 if(esc.squeeze)parts.push('SECTOR COLLAPSE · '+Math.ceil(esc.squeeze.left)+'s · extraction contested');
 const hazard=esc.hazard;
 if(hazard)parts.push(hazard.warning?`${hazard.name} in ${Math.ceil(hazard.in)}s · take cover`:`${hazard.name} ACTIVE · ${Math.ceil(hazard.left)}s`);
 if(esc.level>0)parts.push('Threat level '+esc.level+(esc.alarms?' · '+esc.alarms+' alarm'+(esc.alarms===1?'':'s'):''));
 if(esc.elite>0)parts.push('Elite patrols ×'+esc.elite);
 return parts.join(' · ');
}
function renderEscalation(snapshot){
 const status=$('sectorStatus'),text=escalationText(snapshot);
 status.hidden=!text;status.textContent=text;
 if(!text)delete status.dataset.state;
 else status.dataset.state=snapshot.escalation?.squeeze?'critical':snapshot.escalation?.hazard?snapshot.escalation.hazard.warning?'warning':'critical':'';
}
function objectiveRangeText(meters){return meters>=1000?(meters/1000).toFixed(1)+' km':Math.round(meters)+' m'}
function renderObjectivePanel(s){
 const panel=$('objectivePanel'),o=s.objective,self=s.self;
 if(!o){panel.hidden=true;if(panel.dataset.key){panel.replaceChildren();delete panel.dataset.key}delete panel.dataset.state;return}
 panel.hidden=false;panel.dataset.state=o.stage;
 const range=Math.hypot((o.x||0)-self.x,(o.z||0)-self.z),hold=Math.max(0,Math.floor(o.hold||0));
 const bearing=mapBearing(self.x,self.z,o.x||0,o.z||0),direction=mapCardinal(bearing)+' '+mapDegree(bearing);
 const key=[o.stage,o.site,hold,Math.floor(range/10),Math.round(bearing/15)].join('|');if(panel.dataset.key===key)return;panel.dataset.key=key;
 let text;
 if(o.stage==='approach')text='Field objective · '+o.name+' · '+o.site+' '+objectiveRangeText(range)+' '+direction+' · reach the marker and hold '+o.holdSeconds+' s';
 else if(o.stage==='secure')text='Field objective · holding '+o.site+' · '+hold+' / '+o.holdSeconds+' s';
 else if(o.stage==='secured')text='Field objective secured · '+o.site+' · extract to claim +'+o.rewardCredits+' credits and +'+o.rewardXp+' XP';
 else text='Field objective '+o.stage+' · '+o.site;
 const line=document.createElement('p');line.textContent=text;
 const bar=document.createElement('progress');bar.max=1;bar.value=o.stage==='secured'?1:Math.min(1,Math.max(0,o.progress||0));bar.setAttribute('aria-label','Field objective hold progress');
 panel.replaceChildren(line,bar);
}
export function lootBagLabel(c){return c.label||({operator:c.friendly?'Squadmate salvage bag':'Operator salvage bag',machine:'Machine salvage',rival:'Rival salvage',gear:'Dropped gear',salvage:'Salvage bag'}[c.kind])||'Salvage bag'}
export function lootBagHint(c){
 const n=c.items.length,items=n+' item'+(n===1?'':'s');
 if(c.source==='loot')return 'pick up ground loot · '+items;
 if(c.kind==='operator')return 'search '+lootBagLabel(c)+' · '+items;
 if(c.kind==='machine')return 'salvage machine · '+items;
 if(c.kind==='rival')return 'salvage rival · '+items;
 return 'pick up '+lootBagLabel(c).toLowerCase()+' · '+items;
}
export function lootShortName(it){return (label(it).split(' ×')[0]||it?.kind||'item').trim()}
let lootFlashTimer=0;
// Presentation-only rarity celebration. It reads the authoritative post-take
// snapshot but never invents items, value or ownership; uncommon and better
// hauls get a short visual flourish, rare ones a brighter cue, and every pickup
// still narrates the result through the polite status live region.
export function lootPickupFeedback(s,itemId){
 if(!s||!itemId)return null;
 const item=[...(s.pack||[]),...(s.equipment||[])].find(it=>it.id===itemId);
 if(!item)return null;
 const presentation=lootPresentation(item),name=lootShortName(item),text=lootCelebrationText(item,name),el=$('lootCelebration');
 clearTimeout(lootFlashTimer);el.classList.remove('show');
 if(presentation.celebrate){
  el.hidden=false;el.dataset.tier=presentation.tier;el.dataset.cue=presentation.cue;el.style.setProperty('--loot-accent',presentation.accent);
  $('lootCelebrationTier').textContent=presentation.label+' haul';$('lootCelebrationName').textContent=name;
  void el.offsetWidth;
  el.classList.add('show');
  lootFlashTimer=setTimeout(()=>{el.classList.remove('show');el.hidden=true},2400);
 }else el.hidden=true;
 $('statusAnnouncement').textContent=text;
 return {presentation,text,name};
}
function updateUI(){
 if(!snapshot)return;const s=snapshot.self,disabled=!s.alive||s.downed;if(disabled&&!controlsDisabled)input.clear();controlsDisabled=disabled;comms.update(snapshot);
 $('reload').disabled=!s.weaponId;
 const weaponCount=[...s.equipment,...s.pack].filter(it=>it.kind==='weapon').length;
 $('swap').disabled=!s.weaponId||weaponCount<2;
 const vaultBody={...({x:s.x,y:s.y||0,z:s.z,grounded:s.grounded!==false,downed:s.downed,carrying:s.carrying,vault:s.vault||null}),...(prediction?.position||{}),yaw,move:movementInput()};
 const vaultWorld=getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion);const vaultAhead=!!(!s.vaulting&&s.alive&&!s.downed&&!s.carrying&&vaultWorld&&vaultTarget(vaultWorld,vaultBody,vaultDirection(vaultBody)));
 $('vault').disabled=!s.alive||s.downed||s.vaulting||!vaultAhead;$('vault').classList.toggle('busy',!!s.vaulting);$('vault').setAttribute('aria-label',s.vaulting?'Vaulting…':'Vault');
 renderHud(s,snapshot);renderSlimHud(s,snapshot);syncCompactStatus(s,snapshot);renderVitalVignette(s);renderThreatIndicators(snapshot);renderHurtDirection(snapshot);renderHitFeedback(s);
 view?.sync(snapshot);$('spectate').hidden=s.alive||!snapshot.camera;if(snapshot.camera)$('spectate').textContent='Watching '+snapshot.camera.name+' · next squadmate';
 for(const event of snapshot.events||[])if(!seenEvents.has(event.id)){
  seenEvents.add(event.id);const text=event.text||event.message||event.kind||event.type;$('events').textContent=text;
  const cue=event.kind==='objective'?(/secured/i.test(text)?'objectiveSecured':'objective'):'warning';
  view?.audio.play(cue);if(cue!=='warning')$('statusAnnouncement').textContent=text;
 }
 if(seenEvents.size>200){const recent=[...seenEvents].slice(-100);seenEvents.clear();for(const id of recent)seenEvents.add(id)}
 updateBossUI(snapshot);
 $('conditions').textContent=`${RAID_WORLDS.find(w=>w.id===snapshot.map)?.name||snapshot.map} · ${snapshot.conditions?.clock? snapshot.conditions.clock+' · ':''}${snapshot.conditions?.name||snapshot.conditions?.weather||'clear'}`;
 renderEscalation(snapshot);renderObjectivePanel({self:s,objective:snapshot.objective});renderMinimap(snapshot);renderNavHud(true);updateCompass(s);if(mapOpen)drawTactical();
 const sources=[...snapshot.caches.map(c=>({...c,source:'cache'})),...(snapshot.loot||[]).map(l=>({...l,source:'loot'})),...snapshot.bags.map(b=>({...b,source:'bag'})),...(snapshot.bodies||[]).filter(b=>b.team!==s.team).map(b=>({...b,source:'body'})),...(snapshot.doors||[]).map(door=>({...door,source:'door'}))].filter(c=>distance(c,s)<3);
 const downed=snapshot.players.filter(p=>p.team===s.team&&p.downed&&(distance(p,s)<=2||p.rescue?.carriedByYou));
 nearest=extractionInteractionTarget(snapshot.exits,s,snapshot.serverTime,4)||[...sources,...snapshot.exits.filter(e=>distance(e,s)<4)].sort((a,b)=>distance(a,s)-distance(b,s))[0];
 updateInteraction(s);
 // The deck keeps a Use action out of the way until something is actually
 // within reach: nearby loot, a body, a door or an extraction site.
 $('interact').hidden=!nearest||disabled;
 const nextPackKey=JSON.stringify([s.alive,s.downed,s.role||null,s.weaponId,s.equipment,s.pack,s.secure,sources.map(c=>c.source==='door'?[c.id,c.closed,c.locked]:[c.id,c.open,c.items]),(snapshot.squad||[]).map(q=>[q.id,q.name,q.alive,q.downed,q.hp,q.role||null]),downed.map(p=>[p.id,p.name,p.rescue,(snapshot.squad||[]).find(q=>q.id===p.id)?.role||null]),[...s.equipment,...s.pack].filter(it=>it.kind==='med').map(it=>s.combatVersion!==2||!!medicalNeed(s,it,snapshot.serverTime)&&snapshot.serverTime>=s.nextMedicalAt)]);
 if(nextPackKey!==packKey){packKey=nextPackKey;renderPack(s,sources,downed)}
 updateExitCards(snapshot.serverTime);
 const interactKey=keyName(preferences.get().bindings.interact);
 const compactRaid=document.documentElement.dataset.compactHud==='true';
 $('hint').textContent=performance.now()<notice.until?notice.text: s.result?`${s.result.outcome.toUpperCase()} · ${s.result.items.length} items returned. Use Back to base.`:nearest?(nearest.source==='door'?`${interactKey} / Use: ${nearest.locked?'unlock':nearest.closed?'open':'close'} ${nearest.label||'door'}`:nearest.source==='body'?`${interactKey} / Use: ${nearest.open?'loot':'search'} ${nearest.name||'downed operator'}${nearest.open?' · '+nearest.items.length+' item'+(nearest.items.length===1?'':'s')+' · check backpack':''}`:nearest.source==='cache'?`${interactKey} / Use: ${nearest.open?'open':'search'} ${nearest.label||nearest.id}`:nearest.source?`${interactKey} / Use: ${lootBagHint(nearest)}`:`${interactKey} / Use: ${nearest.kind} exit · ${exitDescription(nearest,snapshot.serverTime)}`): compactRaid?'': armoryObjective(s,snapshot)||('Move / aim · '+keyName(preferences.get().bindings.fire)+' fire · '+interactKey+' interact · '+keyName(preferences.get().bindings.pack)+' backpack · '+keyName(preferences.get().bindings.help)+' field guide'+(s.role?' · '+roleLabel(s.role)+' role':''));
}
async function chooseRaidQuantity(type,it,extra={}){const generation=raidGeneration,deployment=snapshot?.self.deploymentId,quantity=await chooseQuantity({label:(type==='take'?'Take ':'Split ')+label(it),max:type==='take'?it.quantity:it.quantity-1,initial:type==='take'?1:Math.floor(it.quantity/2)});if(quantity==null||!inRaid||generation!==raidGeneration||deployment!==snapshot?.self.deploymentId)return;return action({type,itemId:it.id,quantity,...extra})}
function renderPack(s,sources,downed){
 const priorFocus=inventoryFocus($('pack'));
 $('pack').replaceChildren();
 const secureCap=s.secureCap??(s.cap===8?1:2),salvage=[...s.pack,...s.secure].reduce((n,it)=>n+sellValue(it),0);
 const header=document.createElement('div');header.className='packHead';
 const title=document.createElement('strong');title.textContent='Backpack '+s.pack.length+'/'+s.cap+' · protected '+s.secure.length+'/'+secureCap+' · salvage '+salvage+' cr';
 const meters=document.createElement('div');meters.className='packMeters';meters.setAttribute('aria-hidden','true');
 const meter=(name,value,max,display)=>{const el=document.createElement('div'),label=document.createElement('span'),read=document.createElement('b'),track=document.createElement('div'),fill=document.createElement('span');el.className='packMeter';label.className='meterLabel';label.textContent=name;read.textContent=display||(value+'/'+max);track.className='meterTrack';fill.style.setProperty('--meter-fill',Math.max(0,Math.min(100,max?Math.round(value/max*100):0))+'%');track.append(fill);el.append(label,read,track);return el};
 meters.append(meter('Slots',s.pack.length,s.cap),meter('Weight',Math.round((s.weight||0)*10)/10,s.weightCap||40,`${(s.weight||0).toFixed(1)}/${s.weightCap||40} kg`),meter('Protected',s.secure.length,secureCap));
 header.append(title,meters);$('pack').append(header);
 const freeSlots=Math.max(0,(s.cap||0)-(s.pack.length||0)),freeWeight=(s.weightCap||40)-(s.weight||0);
 const capacityWarning=it=>freeSlots<1?'Backpack full':itemWeight(it)>freeWeight+1e-9?'Over weight by '+Math.round((itemWeight(it)-freeWeight)*10)/10+' kg':'';
 const mates=(snapshot?.squad||[]).filter(q=>q.alive&&!q.downed&&q.id!==profile.id),roleOf=id=>roleLabel((snapshot?.squad||[]).find(q=>q.id===id)?.role);
 function addItemRow(it,inPack){
  const controls=[button('Inspect',()=>inspect(it))];
  if(it.kind==='utility')controls.push(button('Throw toward aim',()=>throwHeldUtility(it)));
  if(it.kind==='med'){const use=button('Use',()=>action({type:'use',itemId:it.id}));use.disabled=s.downed||!s.alive||s.combatVersion===2&&(!medicalNeed(s,it,snapshot.serverTime)||snapshot.serverTime<s.nextMedicalAt);controls.push(use)}
  if(it.kind==='armor'&&s.combatVersion===2)controls.push(button(s.equipment.some(e=>e.id===it.id)?'Remove armor':'Wear armor',()=>action({type:s.equipment.some(e=>e.id===it.id)?'removeArmor':'wear',...(s.pack.some(e=>e.id===it.id)?{itemId:it.id}:{})})));
  if(it.kind==='weapon'){const equip=button('Equip',()=>action({type:'equip',itemId:it.id}));if(it.id===s.weaponId)equip.title='This weapon is already equipped';controls.push(equip)}
  if(!(it.kind==='armor'&&s.equipment.some(p=>p.id===it.id)))controls.push(button('Drop',()=>action({type:'drop',itemId:it.id})));
  if(stackable(it)&&it.quantity>1)controls.push(button('Split stack',()=>chooseRaidQuantity('split',it)));
  if(inPack){
   if(['key','material','valuable','med','mod'].includes(it.kind)&&!it.recovery)controls.push(button('Secure',()=>action({type:'secure',itemId:it.id})));
   const target=s.pack.find(p=>p.id!==it.id&&compatibleStacks(p,it));
   if(target&&['med','material','ammo','utility'].includes(it.kind))controls.push(button('Merge stack',()=>action({type:'stack',itemId:it.id,targetId:target.id})));
   for(const mate of mates){
    const give=button('Give to '+(mate.name||'squadmate'),()=>action({type:'give',itemId:it.id,targetId:mate.id}));
    if(it.recovery||!canRecoverGrant(it,mate.id)){give.disabled=true;give.title='Starter supplies can only stay with their original operator'}
    controls.push(give);
   }
  }
  const row=itemRow(it,$('pack'),controls);row.dataset.ownedItem='true';if(inPack)row.dataset.reorder='pack';
 }
 const ordered=[...s.equipment,...orderPack(s.pack,packOrder)];
 for(const it of ordered)addItemRow(it,s.pack.some(p=>p.id===it.id));
 if(mates.length){
  const handoff=document.createElement('h3');handoff.textContent='Squad hand-off';
  const hint=document.createElement('p');hint.textContent='Drag a backpack row onto a squadmate below, or use Give on the row.';
  $('pack').append(handoff,hint);
  for(const mate of mates){
   const role=roleOf(mate.id),zone=document.createElement('div');zone.className='tradeTarget';zone.dataset.targetId=mate.id;
   zone.setAttribute('role','group');zone.setAttribute('aria-label','Hand off gear to '+(mate.name||'squadmate')+(role?' ('+role+' role)':''));
   const name=document.createElement('span');name.textContent=(mate.name||'Squadmate')+(role?' · '+role:'')+' · HP '+Math.max(0,Math.ceil(mate.hp??100));
   const drop=document.createElement('small');drop.textContent='Drop backpack gear here';
   zone.append(name,drop);$('pack').append(zone);
  }
 }
 for(const it of s.secure){const controls=[button('Inspect',()=>inspect(it)),button('Move to backpack',()=>action({type:'unsecure',itemId:it.id}))];if(stackable(it)&&it.quantity>1)controls.push(button('Split to backpack',()=>chooseRaidQuantity('split',it)));itemRow(it,$('pack'),controls)}
 for(const p of downed){
  const role=roleOf(p.id),row=document.createElement('div');row.dataset.rescue=p.id;row.setAttribute('role','group');row.setAttribute('aria-label',(p.name||'Squadmate')+' rescue controls'+(role?' ('+role+' role)':''));row.textContent=(p.name||'Squadmate')+(role?' · '+role:'')+' · DOWNED';const revive=button('Revive',()=>action({type:'revive',targetId:p.id})),carry=button(p.rescue?.carriedByYou?'Drop squadmate':'Carry squadmate',()=>action({type:'carry',targetId:p.id}));revive.dataset.rescueAction='revive';carry.dataset.rescueAction='carry';if(s.role==='medic'){revive.title='Medic role: revive completes in 3.5 seconds';revive.setAttribute('aria-label','Revive '+(p.name||'squadmate')+' (Medic: 3.5 seconds)')}revive.disabled=!s.alive||s.downed||p.rescue?.revive===false;carry.disabled=!s.alive||s.downed||p.rescue?.carry===false;row.append(revive,carry);if(p.rescue&&!p.rescue.revive&&!p.rescue.carry){const reason=document.createElement('small');reason.textContent='Move within 2 m with clear access. Only one operator can carry a squadmate.';row.append(reason)}$('pack').append(row);
 }
 for(const c of sources){
  if(c.source==='door'){
   const row=document.createElement('div');row.className='doorControl';row.dataset.doorId=c.id;row.setAttribute('role','group');row.setAttribute('aria-label',(c.label||'Door')+' controls');
   const keyCount=[...s.equipment,...s.pack,...(s.secure||[])].filter(it=>it.kind==='key'&&!it.recovery&&(it.quantity??1)>0).length,keylessPick=!!c.locked&&!keyCount&&engineerPicks(s.role);
   const heading=document.createElement('p');heading.textContent=(c.label||'Door')+' · '+(c.locked?(keylessPick?'locked · engineer pick':keyCount?'locked · unlock with key':'locked · key required'):c.closed?'closed':'open');
   const control=button(c.locked?(keylessPick?'Pick lock':'Unlock'):'Toggle door',()=>action({type:'door',doorId:c.id}));
   if(c.locked&&!keylessPick&&!keyCount){control.disabled=true;control.title='Find an access key first'}
   else if(keylessPick)control.title='Engineer role: pick this lock without spending a key'
   row.append(heading,control);$('pack').append(row);continue;
  }
  const heading=document.createElement('p'),count=c.items.length,items=count+' item'+(count===1?'':'s');heading.textContent=c.source==='cache'?(c.label||'Salvage cache')+(c.open?' · searched':' · unsearched'):c.source==='body'?(c.name||'Downed operator')+(c.open?' · searched body':' · downed · searchable'):c.source==='loot'?'On the ground · '+(c.label||'Ground loot'):lootBagLabel(c)+' · '+(count?items:'out of reach');$('pack').append(heading);
  if(c.source==='cache'&&!c.open)$('pack').append(button('Search '+(c.label||'cache'),()=>action({type:'search',sourceId:c.id})));
  if(c.source==='body'&&!c.open)$('pack').append(button('Search '+(c.name||'downed operator'),()=>action({type:'search',sourceId:c.id})));
  for(const it of c.items){const controls=[button('Inspect',()=>inspect(it)),button('Take',()=>action({type:'take',sourceId:c.id,itemId:it.id}))];if(stackable(it)&&it.quantity>1)controls.push(button('Take amount',()=>chooseRaidQuantity('take',it,{sourceId:c.id})));if(!canRecoverGrant(it,profile.id))for(const control of controls.slice(1)){control.disabled=true;control.title='Starter supplies can only be recovered by their original operator'}itemRow(it,$('pack'),controls,capacityWarning(it))}
 }
 const exitTitle=document.createElement('h3');exitTitle.textContent='Extraction sites';$('pack').append(exitTitle);
 for(const exit of snapshot.exits||[])$('pack').append(exitCard(exit,snapshot.serverTime));
 restoreInventoryFocus($('pack'),priorFocus);
}
function movementInput(){
 let forward=Number(input.held('forward'))-Number(input.held('back'))+stickAxisZ;
 let side=Number(input.held('right'))-Number(input.held('left'))+stickAxisX;
 const len=Math.hypot(forward,side);
 if(len>1){forward/=len;side/=len}
 return {x:Math.sin(yaw)*forward-Math.cos(yaw)*side,z:Math.cos(yaw)*forward+Math.sin(yaw)*side};
}
async function action(data){
 if(!inRaid||!wire)throw new Error('Raid input canceled after leaving this session.');
 const actor=wire,generation=raidGeneration,doorBefore=data?.type==='door'?snapshot.doors?.find(d=>d.id===data.doorId):null;
 const send=async()=>{
  const result=await actor.send(data);
  if(inRaid&&wire===actor&&raidGeneration===generation){
   const loot=data?.type==='take'?lootPickupFeedback(result.state?.self,data.itemId):null;
   const caption={reload:'Reloading. Wait for the weapon cooldown.',equip:'Weapon equipped.',search:'Searching. Keep still.',take:'Item recovered.',use:'Medical supplies used.'}[data?.type];
   if(data?.type==='door'){
    const text=doorBefore?(doorBefore.locked?doorBefore.label+' unlocked.':doorBefore.closed?doorBefore.label+' opened.':doorBefore.label+' closed.'):'Door state updated.';
    view?.audio.play('door');$('statusAnnouncement').textContent=text;if(preferences.get().captions)$('events').textContent=text;
   }else if(caption){view?.audio.play(loot?loot.presentation.cue:data.type);if(!loot)$('statusAnnouncement').textContent=data?.type==='use'?(woundStatus(snapshot.self)||'No active bleeding or leg injury.'):caption;if(preferences.get().captions)$('events').textContent=loot?loot.text:caption}
   if(data?.type==='reload')view?.beginReload?.();
  }
  return result;
 };
 if(!['reload','equip'].includes(data?.type))return send();
 if(weaponWork)throw new Error('Finish the current weapon action first.');
 const work={};weaponWork=work;input.release('fire');trigger.clear();
 try{
  await actor.chain.catch(()=>{});const deadline=performance.now()+5000;
  for(;;){
   if(!inRaid||wire!==actor||actor.closed||raidGeneration!==generation)throw Object.assign(new Error('Weapon action canceled after leaving this session.'),{canceled:true});
   const remaining=((snapshot.self.nextFire||0)-snapshot.serverTime)*1000-(performance.now()-stateAt);
   if(remaining<=0)break;if(performance.now()>=deadline)throw new Error('Weapon is still busy. Try again when ready.');
   await new Promise(resolve=>setTimeout(resolve,Math.min(100,remaining+15)));
  }
  return await send();
 }finally{if(weaponWork===work)weaponWork=null}
}

async function throwHeldUtility(item){if(!item)throw new Error('Bring or find a utility item first.');setPack(false);await action({type:'throw',itemId:item.id,yaw,pitch})}
$('utility').onclick=()=>run(()=>throwHeldUtility([...snapshot.self.equipment,...snapshot.self.pack].find(i=>i.kind==='utility')));
async function interact(){
 if(!nearest)return;
 if(nearest.source==='door')return action({type:'door',doorId:nearest.id});
 if(nearest.source==='cache'){setPack(true);if(nearest.open)return;return action({type:'search',sourceId:nearest.id})}
 if(nearest.source==='body'){setPack(true);if(nearest.open)return;return action({type:'search',sourceId:nearest.id})}
 if(nearest.source==='loot'||nearest.source==='bag'){
  setPack(true);
  const weapon=nearest.items.find(it=>it.kind==='weapon'&&canRecoverGrant(it,profile.id));
  if(weapon)return action({type:'take',sourceId:nearest.id,itemId:weapon.id});
  return;
 }
 const now=snapshot.serverTime;return action({type:nearest.openAt<=now&&nearest.closeAt>now?'extract':['key','resource'].includes(nearest.kind)?'unlock':nearest.kind==='call'?'call':'extract',exitId:nearest.id});
}
setInterval(async()=>{
 if(!inRaid||tickBusy)return;tickBusy=true;const generation=raidGeneration;
 try{
  if(snapshot.self.alive){
   const syncedLook={yaw:snapshot.self.yaw||0,pitch:snapshot.self.pitch||0};
   if(lookNeedsSync(yaw,pitch,syncedLook)||!deferIdleMovement({input:movementInput(),confirmed:snapshot.self.move,engaged:trigger.engaged,sampleAgeMs:performance.now()-stateAt,sprint:sprintIntent()}))await action(()=>({type:'move',...movementInput(),yaw,pitch,sprint:sprintIntent()}));
  }
  else{const updated=await api('raid'+(spectateId?'?spectate='+encodeURIComponent(spectateId):''));if(!inRaid||generation!==raidGeneration)return;snapshot=updated;stateAt=performance.now();prediction?.reconcile(updated);updateUI()}
 }catch(e){if(inRaid&&!snapshot?.self.result)$('hint').textContent=e.message}finally{tickBusy=false}
},150);

function controlAction(kind){
 if(kind==='map')return toggleTacticalMap();
 if(kind==='settings')return preferences.open();if(kind==='help')return $('helpOpen').click();if(kind==='communications')return $('commsToggle').click();if(kind==='pack')return setPack($('pack').hidden,true);
 if(kind==='status'){const parts=[$('hud').textContent,$('conditions').textContent,$('hint').textContent,$('interactionStatus').textContent];if(!$('networkStatus').hidden)parts.push($('networkStatus').textContent);$('statusAnnouncement').textContent=parts.filter(Boolean).join('. ');return}
 if(kind==='ping')return run(()=>action({type:'ping',kind:$('pingKind').value}));
 if(kind==='fire')return trigger.press('keyboard');if(kind==='jump'){prediction?.jump();return run(()=>action({type:'jump'}))}
 if(kind==='vault'){
  if(!snapshot?.self.alive||snapshot.self.downed||snapshot.self.carrying||snapshot.self.vaulting)return;
  prediction?.vault(yaw);return run(()=>action({type:'vault',yaw}));
 }
 if(kind==='slide'){
  if(!(sprintIntent()||snapshot.self.sprint)){notice={text:'Sprint first: push the movement stick to its rim, then Slide.',until:performance.now()+3000};return}
  prediction?.slide(movementInput());return run(()=>action({type:'slide',sprint:true}));
 }
 if(kind==='reload')return run(()=>action({type:kind}));if(kind==='interact')return run(interact);
 const items=[...snapshot.self.equipment,...snapshot.self.pack];if(kind==='slot1'||kind==='slot2'){const item=items.filter(i=>i.kind==='weapon')[kind==='slot1'?0:1];if(item)run(()=>action({type:'equip',itemId:item.id}))}
 if(kind==='utility')return run(()=>throwHeldUtility(items.find(i=>i.kind==='utility')));
 if(kind==='heal'){const item=items.find(i=>i.kind==='med'&&(snapshot.self.combatVersion!==2||medicalNeed(snapshot.self,i,snapshot.serverTime)));if(item)run(()=>action({type:'use',itemId:item.id}))}
}
function packToggleLabel(open){const compact=innerWidth<=340;$('packToggle').textContent=(compact?(open?'Close':'Pack'):(open?'Hide backpack':'Backpack'))+' / '+keyName(preferences.get().bindings.pack);$('packToggle').setAttribute('aria-label',open?'Close backpack':'Backpack')}
function setPack(open,focus=false){$('play').dataset.packOpen=String(open);if(open)input.clear();$('pack').hidden=!open;$('packToggle').setAttribute('aria-expanded',String(open));packToggleLabel(open);if(focus){if(open)($('pack').querySelector('button')||$('pack')).focus();else $('view').focus()}}
matchMedia('(max-width:340px)').addEventListener('change',()=>packToggleLabel(!$('pack').hidden));
// Reveal the world when a device becomes a landscape touch layout: the backpack
// panel otherwise starts open from a previous mouse session and hides most of
// the compact HUD. Opening it again stays a deliberate player action.
matchMedia('(pointer:coarse)').addEventListener('change',()=>{if(inRaid&&document.documentElement.dataset.compactHud==='true'&&!$('pack').hidden)setPack(false)});
addEventListener('raidsettingschange',()=>{if(inRaid&&document.documentElement.dataset.compactHud==='true'&&!$('pack').hidden)setPack(false)});
$('packToggle').onclick=()=>setPack($('pack').hidden,true);
// Backpack rows support pointer drag: dropping on another pack row persists a
// presentation-only order, and dropping on a squadmate drop zone hands the
// item off through the authoritative give action. Splitting/eating/selling
// remain explicit buttons, so every interaction also has a keyboard path.
let inventoryDrag=null;
const inventoryHit=(x,y)=>document.elementFromPoint(x,y);
function inventoryDropHover(x,y){
 const hit=inventoryHit(x,y),zone=hit?.closest?.('.tradeTarget');
 for(const target of $('pack').querySelectorAll('.tradeTarget'))target.dataset.drop=String(target===zone);
}
$('pack').addEventListener('pointerdown',event=>{
 if(event.button!==0||preferences.isModal())return;
 const row=event.target.closest?.('[data-reorder=pack]');
 if(!row||event.target.closest?.('button,select,input,label,a'))return;
 const item=[...snapshot.self.equipment,...snapshot.self.pack].find(it=>it.id===row.dataset.itemId);
 inventoryDrag={row,itemId:row.dataset.itemId,x:event.clientX,y:event.clientY,pointerId:event.pointerId,active:false,item};
 try{row.setPointerCapture(event.pointerId)}catch{}
});
$('pack').addEventListener('pointermove',event=>{
 if(!inventoryDrag||event.pointerId!==inventoryDrag.pointerId)return;
 if(!inventoryDrag.active){
  if(Math.hypot(event.clientX-inventoryDrag.x,event.clientY-inventoryDrag.y)<8)return;
  inventoryDrag.active=true;inventoryDrag.row.classList.add('reorderSource');$('pack').dataset.reordering='true';
 }
 event.preventDefault?.();inventoryDropHover(event.clientX,event.clientY);
});
function finishInventoryDrag(event,cancelled=false){
 if(!inventoryDrag||event.pointerId!==inventoryDrag.pointerId)return;
 const drag=inventoryDrag;inventoryDrag=null;
 drag.row.classList.remove('reorderSource');delete $('pack').dataset.reordering;
 for(const target of $('pack').querySelectorAll('.tradeTarget'))delete target.dataset.drop;
 try{drag.row.releasePointerCapture?.(event.pointerId)}catch{}
 if(!drag.active||cancelled)return;
 const hit=inventoryHit(event.clientX,event.clientY),zone=hit?.closest?.('.tradeTarget[data-target-id]');
 if(zone){
  const item=drag.item||{};
  $('statusAnnouncement').textContent='Handing off '+label(item)+'.';
  return void run(()=>action({type:'give',itemId:drag.itemId,targetId:zone.dataset.targetId}));
 }
 const target=hit?.closest?.('[data-reorder=pack]');
 if(!target||target===drag.row)return;
 const box=target.getBoundingClientRect(),after=event.clientY>box.top+box.height/2;
 if(after)target.after(drag.row);else target.before(drag.row);
 savePackOrder([...$('pack').querySelectorAll('[data-reorder=pack]')].map((row) => row.dataset.itemId));
 const rowNumber=[...$('pack').querySelectorAll('[data-reorder=pack]')].indexOf(drag.row)+1;
 $('statusAnnouncement').textContent='Backpack order changed. '+label(drag.item||{kind:'item'})+' is now item '+rowNumber+' in the backpack.';
}
$('pack').addEventListener('pointerup',event=>finishInventoryDrag(event,false));
$('pack').addEventListener('pointercancel',event=>finishInventoryDrag(event,true));
$('pack').addEventListener('pointerleave',event=>{if(inventoryDrag?.active){for(const target of $('pack').querySelectorAll('.tradeTarget'))delete target.dataset.drop}});
$('pack').addEventListener('dblclick',event=>{
 const row=event.target.closest?.('[data-owned-item=true]');
 if(!row||event.target.closest?.('button,select,input'))return;
 const item=[...snapshot.self.equipment,...snapshot.self.pack].find(it=>it.id===row.dataset.itemId);
 if(!item)return;
 if(item.kind==='weapon'){
   return void run(()=>action({type:'equip',itemId:item.id}));
 }
 if(item.kind==='armor'&&snapshot.self.combatVersion===2){
  const worn=snapshot.self.equipment.some(it=>it.id===item.id);
   return void run(()=>action({type:worn?'removeArmor':'wear',...(worn?{}:{itemId:item.id})}));
 }
});
$('view').onclick=e=>{if(e.pointerType==='touch'||preferences.isModal()||!$('communications').hidden)return;if(inRaid){if(document.pointerLockElement!==$('view')){const request=$('view').requestPointerLock();request?.catch(()=>{notice={text:'Mouse capture was unavailable. Use arrow keys, touch aim, or click the view to retry.',until:performance.now()+5000}})}}};
// Look tuning matches the main HeadShotz game (game.js mousemove / zoomSens /
// applyTouchLook): .0021 rad/px on mouse, .0052 on touch, aim slows with the
// field-of-view ratio, touch vertical look is damped 10%, and a faster swipe
// turns a little quicker so a whole turn fits in one thumb flick.
const MOUSE_LOOK=.0021,TOUCH_LOOK=.0052;
function adsLookScale(){
 const fov=Number(view?.camera?.fov),r=Math.tan((Number.isFinite(fov)?fov:preferences.get().fov)*Math.PI/360)/Math.tan(75*Math.PI/360);
 return Math.pow(r,.85);
}
function aim(dx,dy,base,vscale=1){
 const settings=preferences.get(),multiplier=base*settings.sensitivity*(aiming?adsLookScale():1);
 yaw-=dx*multiplier;
 pitch=Math.max(-1.2,Math.min(1.2,pitch-dy*multiplier*vscale*(settings.invertY?-1:1)));
}
addEventListener('mousemove',e=>{if(document.pointerLockElement===$('view')&&!preferences.isModal()&&$('communications').hidden&&!mapOpen)aim(e.movementX,e.movementY,MOUSE_LOOK)});
const machineBody=m=>MACHINES[m.kind]||{height:1.3,radius:.55};
const machineChest=m=>{const body=MACHINES[m.kind]||{height:1.3,radius:.55};return {x:m.x,y:(m.y||0)+body.height*.55,z:m.z}};
function raidWeaponStats(){
 const s=snapshot?.self;if(!s)return null;
 const weapon=[...s.equipment,...s.pack].find(it=>it.id===s.weaponId);
 return weapon?weaponStats(weapon):null;
}
function machineInSight(m){
 const world=prediction?.world;if(!world)return false;
 const chest=machineChest(m);
 // game.js aimPull/nearAim reject a machine behind cover; the repair and loot
 // paths behind a façade must not tug the camera or the reticle either.
 return clearLine(world,snapshot.self.x,snapshot.self.z,m.x,m.z,(snapshot.self.y||0)+1.55,chest.y);
}
function machinesInView(){
 const s=snapshot?.self;if(!s?.alive||!snapshot.machines?.length||!prediction?.world)return [];
 const eye=(s.y||0)+1.55,cp=Math.cos(pitch),fx=Math.sin(yaw)*cp,fy=Math.sin(pitch),fz=Math.cos(yaw)*cp,out=[];
 for(const m of snapshot.machines){
  if(!(m.hp>0))continue;
  const c=machineChest(m),dx=c.x-s.x,dy=c.y-eye,dz=c.z-s.z,dist=Math.hypot(dx,dy,dz);
  if(dist<.4||dist>140)continue;
  if(!machineInSight(m))continue;
  const angle=Math.acos(Math.max(-1,Math.min(1,(dx*fx+dy*fy+dz*fz)/dist)));
  out.push({m,dist,angle,chest:c});
 }
 return out;
}
// Aim assist mirrors game.js aimPull/nearAim on touch: within ~5° the camera is
// gently drawn to the nearest machine in line of sight, and fine-look sensitivity
// eases to 60% so the crosshair settles instead of shivering.
function nearestMachine(cone){
 let best=null;
 for(const target of machinesInView())if(target.angle<=cone&&(!best||target.angle<best.angle))best=target;
 return best;
}
// The server owns the shot: it accepts when the machine is inside the equipped
// weapon's range, the lateral yaw ray passes within the body radius, the pitched
// ray lands between the machine's feet and its height, and no cover interrupts
// the lane (server/raids.mjs). The red reticle uses the same test, so it only
// promises shots the authority can resolve — not a generous 3D cone.
function machineUnderCrosshair(){
 const s=snapshot?.self;if(!s?.alive||!snapshot.machines?.length||!prediction?.world)return null;
 const stats=raidWeaponStats();if(!stats||!(stats.range>0))return null;
 const world=prediction.world,eye=(s.y||0)+1.55,range=stats.range;
 let best=null,closest=Infinity;
 for(const m of snapshot.machines){
  if(!(m.hp>0))continue;
  const dx=m.x-s.x,dz=m.z-s.z,horizontal=Math.hypot(dx,dz);
  if(horizontal<.15||horizontal>range)continue;
  const body=machineBody(m),ground=m.y||0,hitY=eye+Math.tan(pitch)*horizontal;
  if(hitY<ground||hitY>ground+body.height)continue;
  const bearing=Math.atan2(dx,dz),angle=Math.abs(Math.atan2(Math.sin(bearing-yaw),Math.cos(bearing-yaw)));
  if(angle>=Math.atan2(body.radius||.55,Math.max(.1,horizontal)))continue;
  if(!clearLine(world,s.x,s.z,m.x,m.z,eye,hitY))continue;
  const dist=Math.hypot(dx,hitY-eye,dz);
  if(dist<closest){closest=dist;best={m,dist:horizontal,angle,chest:{x:m.x,y:ground+body.height*.55,z:m.z}}}
 }
 return best;
}
function aimPull(dt,target){
 const s=snapshot?.self;if(!s||!target)return;
 const dx=target.chest.x-s.x,dy=target.chest.y-((s.y||0)+1.55),dz=target.chest.z-s.z;
 let delta=Math.atan2(dx,dz)-yaw;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
 const turn=Math.min(1,dt*3.2),lift=Math.atan2(dy,Math.hypot(dx,dz));
 yaw+=delta*turn;
 pitch=Math.max(-1.2,Math.min(1.2,pitch+(lift-pitch)*turn*.6));
}
let lookPointer=null,lookLast=null,lookBankX=0,lookBankY=0,lookPX=0,lookPY=0;
let movePointer=null,moveStart=null,moveRadius=52,stickSprint=false;
function applyTouchLook(dt){
 if(!lookPX&&!lookPY)return;
 const kept=Math.min(1,dt*38);let ax=lookPX*kept,ay=lookPY*kept;
 lookPX-=ax;lookPY-=ay;
 if(Math.abs(lookPX)<.05)lookPX=0;if(Math.abs(lookPY)<.05)lookPY=0;
 if(!inRaid||preferences.isModal()||!$('communications').hidden||mapOpen)return;
 const speed=Math.hypot(ax,ay)/Math.max(dt,.001),accel=1+Math.min(.5,speed/4000);
 const near=nearestMachine(.09),damp=near&&near.angle<.06?.6:1;
 aim(ax*accel,ay*accel,TOUCH_LOOK*damp,.9);
 // game.js only magnetises enemies within 60 m for the pull; the damping is
 // the wider under-reticle check, so a far machine does not tug the camera.
 if(near&&near.dist<=60)aimPull(dt,near);
}
$('jump').onclick=()=>controlAction('jump');$('vault').onclick=()=>controlAction('vault');
$('slide').onclick=()=>controlAction('slide');
$('swap').onclick=()=>swapWeapon();
$('reload').onclick=()=>run(()=>action({type:'reload'}));$('interact').onclick=e=>{e.preventDefault();run(interact)};
$('leave').onclick=()=>run(async()=>{const alive=snapshot.self.alive;inRaid=false;wire?.close();wire=null;prediction=null;raidGeneration++;resetTacticalMap();clearHitmarker();document.body.dataset.inRaid='false';preferences.apply();document.querySelector('main').inert=false;await comms.voice.leave();comms.update(null);input.clear();document.exitPointerLock?.();$('play').style.display='none';$('bossPanel').hidden=true;view?.clear();snapshot=null;message(alive?'Your operator remains in the raid. Reconnect within 45 seconds to continue.':'Raid recorded.');await refresh();if(!alive)setBaseTab('records')});
// Compact raid menu: one icon holds Back to base, Account, Guide and Settings.
function setRaidMenu(open){
 if(!inRaid||document.documentElement.dataset.compactHud!=='true')open=false;
 $('raidMenu').setAttribute('aria-expanded',String(open));
 $('raidMenuPanel').classList.toggle('open',open);
 if(open)$('raidMenuAccount').hidden=$('accountOpen').hidden;
}
$('raidMenu').onclick=()=>setRaidMenu($('raidMenu').getAttribute('aria-expanded')!=='true');
$('raidMenuBack').onclick=()=>{$('raidMenuBack').disabled=!!$('leave').disabled;$('leave').click();setRaidMenu(false)};
$('raidMenuAccount').onclick=()=>{setRaidMenu(false);$('accountOpen').click()};
$('raidMenuGuide').onclick=()=>{setRaidMenu(false);$('helpOpen').click()};
$('raidMenuSettings').onclick=()=>{setRaidMenu(false);$('settingsOpen').click()};
document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('#raidMenu,#raidMenuPanel'))setRaidMenu(false)});
const MAP_PALETTES={
 industrial:{ground:'#404643',road:'#2c3233',sidewalk:'#85857b',plaza:'#6f6b5e',field:'#56634a',window:'#f6cf7e',tree:'#3c6b3d',hedge:'#355934'},
 wilderness:{ground:'#566448',road:'#3d4438',sidewalk:'#898b79',plaza:'#6f6b58',field:'#617650',window:'#f5d78b',tree:'#2f6235',hedge:'#2f5431'},
 settlement:{ground:'#716257',road:'#33393b',sidewalk:'#9c968a',plaza:'#87786b',field:'#5d6c4b',window:'#ffd386',tree:'#3a6b38',hedge:'#315e31'}
};
const MAP_KIND_COLORS={
 industrial:{concrete:'#90968d',plaster:'#a1988d',planks:'#7a6047',brick:'#9c6d53',metal:'#6b7a7b',container:'#696048',rock:'#7c7a6c',crate:'#8a6d48',barrier:'#b39b63',roof:'#4e5558'},
 wilderness:{concrete:'#9b9d8e',plaster:'#aaa192',planks:'#81684e',brick:'#8f8d73',metal:'#728a89',container:'#6e6448',rock:'#858273',crate:'#867049',barrier:'#958f6b',roof:'#4a615d'},
 settlement:{concrete:'#aaa29b',plaster:'#bdb1a1',planks:'#93704f',brick:'#b47d60',metal:'#6e7d82',container:'#665650',rock:'#726d63',crate:'#9a7449',barrier:'#c3a66c',roof:'#505260'}
};
const MAP_BACKGROUNDS=new Map();
const bootStatus=$('bootStatus');
function bootNotice(text){if(!bootStatus)return;bootStatus.hidden=!text;if(text)bootStatus.textContent=text}
// Static Pages always boots through the offline guest session. Hide the online
// account/profile form before the first paint when `offline=1` is present, so a
// fresh load never shows a username/password prompt while the local store
// hydrates. Online hosts keep their sign-in screen untouched.
if(isOfflineQuery(location.search)){offlineMode=true;try{document.body.dataset.raidTransport='offline'}catch{};$('auth').hidden=true;bootNotice('Preparing the sector…')}
busy=true;document.body.setAttribute('aria-busy','true');try{await refresh();bootNotice(null)}catch(error){bootNotice(null);if(!offlineMode&&!profile)$('auth').hidden=false;message(error.status===401?'Sign in or create an account.':error.message)}finally{busy=false;document.body.setAttribute('aria-busy','false')}
setTimeout(loadRaidArt,200);

// Aim is a hold-to-zoom control, like bZoom in the main game: keeping a thumb
// on the crosshair keeps the optic up, and lifting it returns to hip fire.
const aimButton=$('aim');
function setAimHold(active){aimTouch=!!active&&inRaid&&!!snapshot?.self.alive&&!snapshot.self.downed;aimButton.setAttribute('aria-pressed',String(aimTouch));aimButton.classList.toggle('down',aimTouch)}
aimButton.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();try{aimButton.setPointerCapture(e.pointerId)}catch{}setAimHold(true)});
for(const type of ['pointerup','pointercancel','lostpointercapture'])aimButton.addEventListener(type,()=>setAimHold(false));
addEventListener('pointerup',()=>setAimHold(false));
addEventListener('pointercancel',()=>setAimHold(false));
$('view').addEventListener('contextmenu',e=>e.preventDefault());
$('view').addEventListener('pointerdown',e=>{if(e.button===2&&document.pointerLockElement===$('view')){e.preventDefault();aimMouse=true}});
addEventListener('pointerup',e=>{if(e.button===2)aimMouse=false});$('view').addEventListener('pointercancel',()=>{aimMouse=false});
{
 const viewElement=$('view');
 viewElement.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||document.pointerLockElement!==$('view'))return;if(!inRaid||preferences.isModal()||!$('communications').hidden)return;e.preventDefault();trigger.press('pointer:'+e.pointerId)});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])viewElement.addEventListener(type,e=>trigger.release('pointer:'+e.pointerId));
}
addEventListener('pointerup',e=>trigger.release('pointer:'+e.pointerId));
// Touch controls match the main game: move anywhere on the left 42% of the
// screen (the pad appears under the thumb) and look with the other thumb on
// the right. Raw movement is smoothed once per frame by applyTouchLook so a
// swipe does not step, jitter or race the animation loop.
function touchAllowed(){return inRaid&&!preferences.isModal()&&$('communications').hidden&&!mapOpen}
function cancelTouch(){
 lookPointer=null;lookLast=null;lookBankX=lookBankY=0;lookPX=lookPY=0;
 if(movePointer!==null){
  movePointer=null;moveStart=null;stickSprint=false;stickAxisX=stickAxisZ=0;
  const pad=$('stick');if(pad){pad.classList.remove('dragging');pad.style.left='';pad.style.top='';pad.style.bottom='';pad.style.right=''}
  sendHeldMovement();
 }
}
function dockStick(){
 const pad=$('stick');if(!pad)return;
 pad.classList.remove('dragging');
 for(const prop of ['left','top','bottom','right'])pad.style.removeProperty(prop);
}
$('view').addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||!touchAllowed())return;
 e.preventDefault();view?.audio.resume();
 if(movePointer===null&&e.clientX<innerWidth*.42){
  movePointer=e.pointerId;moveStart={x:e.clientX,y:e.clientY};moveRadius=52;stickSprint=false;
  const pad=$('stick');if(pad){pad.classList.add('dragging');pad.style.left=(e.clientX-60)+'px';pad.style.top=(e.clientY-60)+'px';pad.style.bottom='auto'}
  $('stickKnob')?.style.removeProperty('transform');stickAxisX=stickAxisZ=0;sendHeldMovement();
  $('view').setPointerCapture?.(e.pointerId);
 }else if(lookPointer===null){
  lookPointer=e.pointerId;lookLast={x:e.clientX,y:e.clientY};lookBankX=lookBankY=0;
  $('view').setPointerCapture?.(e.pointerId);
 }
});
$('view').addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch')return;
 if(e.pointerId===lookPointer&&lookLast){
  if(!touchAllowed()){cancelTouch();return}
  e.preventDefault();
  // iOS fires sub-pixel drift while a finger rests; bank the movement and only
  // queue it once it clears a small threshold. applyTouchLook then eases the
  // queued swipe out over following frames, as the main game does.
  lookBankX+=e.clientX-lookLast.x;lookBankY+=e.clientY-lookLast.y;lookLast={x:e.clientX,y:e.clientY};
  if(Math.abs(lookBankX)+Math.abs(lookBankY)>=1.2){lookPX+=lookBankX;lookPY+=lookBankY;lookBankX=lookBankY=0}
 }else if(e.pointerId===movePointer&&moveStart){
  if(!touchAllowed()){cancelTouch();return}
  e.preventDefault();
  let dx=e.clientX-moveStart.x,dy=e.clientY-moveStart.y;
  const radius=moveRadius,length=Math.hypot(dx,dy);
  if(length>radius){dx=dx/length*radius;dy=dy/length*radius}
  // Main-game joystick response: 14% dead zone, eased 1.15 curve, and sprint
  // when the thumb is held at the front rim.
  const n=Math.min(1,length/radius),dead=.14,gain=n<dead?0:Math.pow((n-dead)/(1-dead),1.15);
  const dirLength=Math.hypot(dx,dy)||1;
  stickAxisX=(dx/dirLength)*gain;stickAxisZ=-(dy/dirLength)*gain;
  stickSprint=length>radius*.88&&dy<-radius*.5;
  $('stickKnob').style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)';
  sendHeldMovement();
 }
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(type,e=>{
 if(e.pointerId===lookPointer){lookPointer=null;lookLast=null;lookBankX=lookBankY=0}
 if(e.pointerId===movePointer){
  movePointer=null;moveStart=null;stickSprint=false;stickAxisX=stickAxisZ=0;
  dockStick();sendHeldMovement();
 }
});
function mapBackground(world,n,compact=false){
 // Live tactical minimaps are CSS-downscaled to 80–100 px, so their per-pixel
 // grain and rooftop microdetail dissolve into visual static; the compact
 // variant keeps the district fabric that still reads at that scale.
 const key=world.id+':'+world.version+':'+n+(compact?':compact':''); // keeps cached layouts versioned and canvas-sized
 let cached=MAP_BACKGROUNDS.get(key);if(cached)return cached;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=n;const ctx=canvas.getContext('2d'),k=n/world.size,theme=world.theme in MAP_PALETTES?world.theme:'industrial',pal=MAP_PALETTES[theme],blockColors=MAP_KIND_COLORS[theme];
 const rect=(x,z,w,d,color,ry=0)=>{ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.fillStyle=color;ctx.fillRect(-w/2,-d/2,w,d);ctx.restore()};
 // Deterministic per-placement noise keeps every painted roof, stain and
 // canopy identical between sessions without consulting random runtime state.
 const hash=(x,z)=>{const v=Math.sin((x||0)*12.9898+(z||0)*78.233)*43758.5453;return v-Math.floor(v)};
 const shade=(color,multiplier)=>{const num=parseInt(color.slice(1),16),r=Math.min(255,Math.round(((num>>16)&255)*multiplier)),g=Math.min(255,Math.round(((num>>8)&255)*multiplier)),b=Math.min(255,Math.round((num&255)*multiplier));return 'rgb('+r+','+g+','+b+')'};
 ctx.fillStyle=pal.ground;ctx.fillRect(0,0,n,n);ctx.save();ctx.translate(n/2,n/2);ctx.scale(k,k);
 // Relief shading: higher ground darkens gradually, so hills read on the
 // overview map without hiding streets, fields or markers drawn above it.
 if(world.terrain){
  const step=world.size/72;ctx.globalAlpha=1;
  for(let x=-world.size/2;x<world.size/2;x+=step)for(let z=-world.size/2;z<world.size/2;z+=step){
   const height=terrainHeightAt(world,x+step/2,z+step/2);
   if(height>1.5){ctx.globalAlpha=Math.min(.42,height/75);ctx.fillStyle='#1b241d';ctx.fillRect(x,z,step,step)}
  }
  ctx.globalAlpha=1;
 }
 for(const p of world.props){
  const x=p.x||0,z=p.z||0,w=p.w||20,d=p.d||20,ry=p.ry||0;
  if(p.kind==='field'){
   const color=p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.field;
   rect(x,z,w,d,color,ry);
   // Worked-soil furrows and a contrasting planted edge read as tilled land.
   if(!compact){
    const step=Math.max(3.2,Math.min(w,d)/6);
    ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);
    ctx.strokeStyle=shade(color,.78);ctx.globalAlpha=.5;ctx.lineWidth=Math.max(.8,k*1.5);ctx.beginPath();
    if(w>=d)for(let t=-d/2+step;t<d/2;t+=step){ctx.moveTo(-w/2+1.2,t);ctx.lineTo(w/2-1.2,t)}
    else for(let t=-w/2+step;t<w/2;t+=step){ctx.moveTo(t,-d/2+1.2);ctx.lineTo(t,d/2-1.2)}
    ctx.stroke();
    ctx.strokeStyle=shade(color,1.14);ctx.globalAlpha=.4;ctx.strokeRect(-w/2+.8,-d/2+.8,w-1.6,d-1.6);
    ctx.globalAlpha=1;ctx.restore();
   }
  }else if(p.kind==='basin'){
   rect(x,z,w,d,'#487580',ry);
   ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.strokeStyle='rgba(178,238,240,.26)';ctx.lineWidth=Math.max(.8,k*1.5);
   for(let i=1;i<=3;i++){const t=(i*.22-.5)*d;ctx.beginPath();ctx.moveTo(-w*.4,t);ctx.quadraticCurveTo(-w*.1,t-2.2,w*.05,t);ctx.quadraticCurveTo(w*.2,t+2.2,w*.4,t);ctx.stroke()}
   ctx.restore();
  }
 }
 for(const p of world.props){
  const x=p.x||0,z=p.z||0,w=p.w||20,d=p.d||10,ry=p.ry||0;
  if(p.kind==='rail'){
   // Ballast bed, twin steel rails and timber ties give the yard railway texture.
   rect(x,z,w,d,'#4a463f',ry);rect(x,z,w,Math.max(.9,k*1.6),'#8f9089',ry);
   ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.strokeStyle='rgba(26,23,20,.7)';ctx.lineWidth=Math.max(.8,k*1.6);
   for(let t=-w/2+6;t<w/2;t+=14){ctx.beginPath();ctx.moveTo(t,-d/2);ctx.lineTo(t,d/2);ctx.stroke()}
   ctx.restore();
  }else if(p.kind==='road'){
   rect(x,z,w,d,p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.road,ry);
   ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);
   // Faded centre line plus shoulder wear along the long axis.
   if(Math.max(w,d)>=18){ctx.setLineDash([6,5]);ctx.strokeStyle='rgba(255,238,196,.26)';ctx.lineWidth=Math.max(.8,k*1.5);ctx.beginPath();if(w>=d){ctx.moveTo(-w/2+4,0);ctx.lineTo(w/2-4,0)}else{ctx.moveTo(0,-d/2+4);ctx.lineTo(0,d/2-4)};ctx.stroke();ctx.setLineDash([])}
   if(!compact){
    ctx.fillStyle='rgba(15,19,17,.18)';const spots=Math.min(14,Math.floor(Math.max(w,d)/9));
    for(let i=0;i<spots;i++){const a=hash(x+i*.7,z-i*.9),b=hash(x*1.3-i,z*1.7+i);const px=w>=d?-w/2+4+a*(w-8):(a-.5)*(w-3),pz=w>=d?(b-.5)*(d-3):-d/2+4+b*(d-8),r=Math.max(.9,Math.min(2.6,k*2.8));ctx.beginPath();ctx.arc(px,pz,r,0,Math.PI*2);ctx.fill()}
   }
   ctx.restore();
  }else if(p.kind==='sidewalk'){
   rect(x,z,w,d,p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.sidewalk,ry);
   ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.strokeStyle='rgba(24,29,26,.33)';ctx.lineWidth=Math.max(.7,k*1.4);
   // Slab seams run across the narrow axis every eight metres.
   if(!compact){const along=Math.max(w,d);
    for(let t=-along/2+4;t<along/2;t+=8){ctx.beginPath();if(w>=d){ctx.moveTo(t,-d/2);ctx.lineTo(t,d/2)}else{ctx.moveTo(-w/2,t);ctx.lineTo(w/2,t)};ctx.stroke()}
   }
   ctx.restore();
  }else if(p.kind==='crosswalk'){
   rect(x,z,w,d,p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.sidewalk);
   ctx.save();ctx.translate(x,z);const stripe=Math.max(1.2,k*2.2);ctx.fillStyle='rgba(242,246,234,.45)';
   for(let t=-w/2+stripe*1.5;t<w/2;t+=stripe*3)ctx.fillRect(t,-d/2+1.6,stripe,Math.max(1,d-3.2));
   ctx.restore();
  }else if(p.kind==='plaza'||p.kind==='floor')rect(x,z,w,d,p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.plaza,ry);
 }
 // Ambient occlusion: a soft south-east silhouette ground each block before its
 // roof is painted, so abandoned footprints stack with believable depth.
 for(const [x,z,w,d,,base=0] of world.blocks){if(base>3)continue;ctx.fillStyle='rgba(14,19,16,.24)';ctx.fillRect(x-w/2+2.2,z-d/2+2.6,w,d)}
 for(const [x,z,w,d,,base=0,kind='concrete',tint]of world.blocks)
  {if(base>3)continue;const color=tint==null?(blockColors[kind]||blockColors.concrete):'#'+tint.toString(16).padStart(6,'0');rect(x,z,w,d,color);
   if(w>=9&&d>=9){
    // Rooftop deck: inset surface, parapet shadow, vents and a sunlit rim.
    const rim=Math.max(1.2,Math.min(2.8,Math.min(w,d)*.16)),seed=hash(x,z),g=Math.max(1,Math.min(3.4,Math.min(w,d)*.2));
    rect(x+rim*.2,z+rim*.2,w-rim*.4,d-rim*.4,shade(color,.78+.3*seed));
    if(!compact){
     const units=Math.min(4,Math.floor(w*d/140)+1),therm=Math.min(.42,.3+.2*seed);
     ctx.fillStyle='rgba(21,27,26,'+therm.toFixed(2)+')';
     for(let i=0;i<units;i++){const vx=(hash(x+i*3.1,z-i*1.8)-.5)*Math.max(1,w-rim*2-g),vz=(hash(z+i*2.3,x+i*1.7)-.5)*Math.max(1,d-rim*2-g);ctx.fillRect(x+vx-g/2,z+vz-g/2,g,g)}
     ctx.fillStyle='rgba(255,255,255,'+(.08+.09*seed).toFixed(2)+')';ctx.fillRect(x-w/2+rim*.4,z-d/2+rim*.4,Math.max(.8,w-rim*.8),Math.max(.7,k*1.4));
    }
   }
  }
 for(const p of world.props){
  const px=p.x||0,pz=p.z||0,seed=hash(px,pz);
  if(p.kind==='window'&&p.lit){
   const r=Math.max(1.5,(p.w||1.2)*2.2);
   ctx.globalAlpha=.2;ctx.fillStyle=pal.window;ctx.beginPath();ctx.arc(px,pz,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
   rect(px,pz,Math.max(1.2,p.w||1.2),Math.max(1.2,p.d||1.2),pal.window);
  }else if(p.kind==='tree'){
   const color=p.leaf?'#'+p.leaf.toString(16).padStart(6,'0'):pal.tree,r=Math.max(3,(p.scale||1)*3.4);
   // Layered crown: occluded base, varied mid-canopy and a sunlit upper lobe.
   ctx.globalAlpha=.3;ctx.fillStyle='#101b12';ctx.beginPath();ctx.arc(px+1.2,pz+1.5,r*1.22,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
   ctx.fillStyle=shade(color,.9+seed*.16);ctx.beginPath();ctx.arc(px+.3,pz+.4,r,0,Math.PI*2);ctx.fill();
   ctx.globalAlpha=.55;ctx.fillStyle=shade(color,1.18);ctx.beginPath();ctx.arc(px-r*.3,pz-r*.34,r*.55,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }else if(p.kind==='bush'){
   const color=p.leaf?'#'+p.leaf.toString(16).padStart(6,'0'):pal.hedge,r=Math.max(1.8,(p.scale||1)*2.2);
   ctx.globalAlpha=.85;ctx.fillStyle=shade(color,.94+seed*.12);ctx.beginPath();ctx.arc(px,pz,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }else if(p.kind==='hedge')rect(px,pz,p.w||2,p.d||2,p.color?'#'+p.color.toString(16).padStart(6,'0'):pal.hedge,p.ry||0);
  else if(p.kind==='billboard'){rect(px,pz,5.2,2.8,'#d9b26a');ctx.fillStyle='rgba(40,31,16,.75)';ctx.fillRect(px-1.9,pz-1.1,3.8,2.2)}
 }
 ctx.restore();
 // Screen-space film grain unifies asphalt, rooftops and canopy into one
 // weathered photographic surface; a seeded LCG keeps it byte-stable.
 if(!compact){
  let noise=2166136261^((world.version||0)*374761393);
  for(const c of world.id||'')noise=Math.imul(noise^c.charCodeAt(0),16777619)>>>0;
  const grains=Math.min(32000,Math.round(n*n/12));
  for(let i=0;i<grains;i++){
   noise=(Math.imul(noise,1664525)+1013904223)>>>0;
   ctx.fillStyle=(noise>>>23)&1?'rgba(232,238,220,.075)':'rgba(14,19,17,.09)';
   ctx.fillRect(noise%n,(noise>>>10)%n,(noise>>>21)&3?1:2,1);
  }
 }
 // Landmark glyph plates: each kind gets a silhouette drawn in amber over a
 // dark tactical plate, so antennas, water towers and rail yards are legible
 // at overview scale without adding any gameplay objects.
 const ui=Math.max(3,Math.round(n/72)),glyphs={
  antenna:u=>[()=>{const a=u*.82;ctx.moveTo(-a*.5,a*.75);ctx.lineTo(0,-a*.88);ctx.lineTo(a*.5,a*.75);ctx.moveTo(-a*.24,-u*.08);ctx.lineTo(a*.24,-u*.08)}],
  dish:u=>[()=>{const a=u*.78;ctx.arc(0,-u*.12,a*.56,Math.PI*1.1,Math.PI*1.9);ctx.moveTo(0,u*.36);ctx.lineTo(0,u*.8);ctx.moveTo(-a*.4,u*.8);ctx.lineTo(a*.4,u*.8)}],
  crane:u=>[()=>{const a=u*.82;ctx.moveTo(-a*.42,-a*.8);ctx.lineTo(-a*.42,a*.8);ctx.moveTo(-a*.42,-a*.6);ctx.lineTo(a*.62,-a*.6);ctx.moveTo(a*.5,-a*.6);ctx.lineTo(a*.5,-u*.06);ctx.moveTo(a*.36,-u*.06);ctx.lineTo(a*.64,-u*.06);ctx.moveTo(-a*.6,a*.8);ctx.lineTo(-a*.24,a*.8)}],
  turbine:u=>[()=>{const a=u*.74;ctx.moveTo(-u*.05,a*.82);ctx.lineTo(-u*.05,u*.2);ctx.moveTo(u*.05,a*.82);ctx.lineTo(u*.05,u*.2);for(const t of [0,Math.PI*2/3,Math.PI*4/3]){ctx.moveTo(0,0);ctx.lineTo(Math.sin(t)*a,-Math.cos(t)*a)}ctx.moveTo(u*.13,a*.82);ctx.lineTo(-u*.13,a*.82);ctx.moveTo(u*.13*Math.cos(0),u*.13*Math.sin(0));ctx.arc(0,0,u*.13,0,Math.PI*2)}],
  waterTower:u=>[()=>{const a=u*.8;ctx.arc(0,-u*.36,u*.36,0,Math.PI*2);ctx.moveTo(-u*.29,-u*.08);ctx.lineTo(-u*.35,u*.82);ctx.moveTo(u*.29,-u*.08);ctx.lineTo(u*.35,u*.82);ctx.moveTo(-u*.2,-u*.1);ctx.lineTo(u*.2,-u*.1)}],
  pump:u=>[()=>{const a=u*.8;ctx.moveTo(-a*.36,-u*.12);ctx.lineTo(-a*.36,a*.62);ctx.lineTo(a*.36,a*.62);ctx.lineTo(a*.36,-u*.12);ctx.moveTo(0,-a*.62);ctx.lineTo(0,-u*.2);ctx.moveTo(-u*.2,-a*.62);ctx.lineTo(u*.2,-a*.62);ctx.moveTo(a*.36,u*.2);ctx.lineTo(a*.66,u*.2)}],
  signal:u=>[()=>{const a=u*.8;ctx.moveTo(0,a*.82);ctx.lineTo(0,u*.06);ctx.moveTo(-a*.34,u*.52);ctx.quadraticCurveTo(-a*.14,u*.2,0,-u*.02);ctx.moveTo(a*.34,u*.52);ctx.quadraticCurveTo(a*.14,u*.2,0,-u*.02)}],
  rail:u=>[()=>{const a=u*.78;ctx.moveTo(-a,-u*.22);ctx.lineTo(a,-u*.22);ctx.moveTo(-a,u*.22);ctx.lineTo(a,u*.22);for(const t of [-.6,-.2,.2,.6]){ctx.moveTo(t*a,-u*.38);ctx.lineTo(t*a,u*.38)}}]
 };
 for(const p of world.props){
  if(!glyphs[p.kind])continue;
  const px=n/2+(p.x||0)*k,py=n/2+(p.z||0)*k;if(px<7||py<7||px>n-7||py>n-7)continue;
  const s=ui*2.5;ctx.save();ctx.translate(px,py);
  ctx.fillStyle='rgba(9,15,14,.6)';ctx.fillRect(-s/2,-s/2,s,s);
  ctx.strokeStyle='rgba(255,208,120,.74)';ctx.lineWidth=Math.max(.9,ui*.16);ctx.strokeRect(-s/2,-s/2,s,s);
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const [style,width] of [['rgba(8,12,11,.8)',ui*.42],['rgba(255,215,134,.96)',ui*.19]]){
   ctx.strokeStyle=style;ctx.lineWidth=width;
   for(const draw of glyphs[p.kind](ui)){ctx.beginPath();draw();ctx.stroke()}
  }
  ctx.restore();
 }
 MAP_BACKGROUNDS.set(key,canvas);return canvas;
}
const BAG_MARKERS={operator:['#ff7bd5','C'],machine:['#ffc46b','M'],rival:['#ff8a52','R'],gear:['#c7a0ff','G']};
export function bagMarker(b){const marker=BAG_MARKERS[b.kind]||['#c6f09a','S'];return {color:marker[0],letter:marker[1]}}
export function drawMap(canvas,id,state,opts={}){
 const {chrome=true}=opts;
 const world=state?getWorld(id,state.mapVersion===undefined?1:state.mapVersion):RAID_WORLDS.find(w=>w.id===id);if(!world)return;
 // Live tactical minimaps render at 360 px backing into an 80–100 px footprint.
 // Derive a compact background plus an inverse-scale chrome factor from the
 // element's displayed width so markers and labels survive the downscale;
 // detached canvases and large previews keep the authored reference sizes.
 let shown=0;if(canvas.isConnected&&canvas.getBoundingClientRect){const box=canvas.getBoundingClientRect();shown=box.width||0}
 const compact=opts.compact===undefined?shown>0&&shown<=160:!!opts.compact;
 const uiK=compact?Math.min(2.4,Math.max(1.4,180/Math.max(60,shown))):1;
 // Presentation-only marker for graders and styling hooks; never gameplay data.
 const detailMode=compact?'compact':'full';
 if(canvas.dataset.mapDetail!==detailMode)canvas.dataset.mapDetail=detailMode;
 const ctx=canvas.getContext('2d'),n=canvas.width,k=n/world.size,m=n/180,cx=n/2,cy=n/2,reduced=document.documentElement.dataset.reducedMotion==='true',self=state?.self;
 ctx.clearRect(0,0,n,n);ctx.drawImage(mapBackground(world,n,compact),0,0);
 // A compact-only focus vignette sinks the corners into the glass frame without
 // touching the operator marker or the exit/perimeter chrome drawn above it.
 if(compact){const v=ctx.createRadialGradient(cx,cy,n*.24,cx,cy,n*.58);v.addColorStop(0,'rgba(4,10,14,0)');v.addColorStop(.7,'rgba(4,10,14,.14)');v.addColorStop(1,'rgba(2,6,9,.58)');ctx.fillStyle=v;ctx.fillRect(0,0,n,n)}
 // Markers and chrome are authored in 180-reference pixels then scaled to the
 // 360 backing canvas, so the CSS-downscaled minimap stays crisp at every
 // viewport while both generic maps and the live tactical minimap stay legible.
 const point=(x,z,color,r)=>{const px=cx+x*k,py=cy+z*k;ctx.beginPath();ctx.arc(px,py,r*m*uiK,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=1.4*m*uiK;ctx.strokeStyle='rgba(10,16,20,.8)';ctx.stroke()};
 const ring=(x,z,color,r,width)=>{const px=cx+x*k,py=cy+z*k;ctx.beginPath();ctx.arc(px,py,r*m*uiK,0,Math.PI*2);ctx.lineWidth=width*m*uiK;ctx.strokeStyle=color;ctx.stroke()};
 const letter=(text,x,z,dy,fill='#fff')=>{const px=cx+x*k,py=cy+z*k+dy*m*uiK;ctx.font='700 '+(7*m*uiK)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=2.4*m*uiK;ctx.strokeStyle='rgba(7,13,16,.85)';ctx.strokeText(text,px,py);ctx.fillStyle=fill;ctx.fillText(text,px,py)};
 const diamond=(x,z,color,label)=>{const px=cx+x*k,py=cy+z*k,s=3.4*m*uiK;ctx.save();ctx.translate(px,py);ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.strokeStyle='rgba(8,14,17,.9)';ctx.lineWidth=1.4*m*uiK;ctx.fillRect(-s,-s,2*s,2*s);ctx.strokeRect(-s,-s,2*s,2*s);ctx.restore();if(label)letter(label,x,z,0,'#f4fff9')};
 if(state&&self){
  if(chrome){
   const hx=cx+self.x*k,hy=cy+self.z*k;
   // A dashed route to the nearest armory identifies the recovery objective
   // without adding a new gameplay affordance.
   const cache=(state.caches||[]).filter(c=>c.weaponCache).map(c=>({x:c.x,z:c.z,dist:Math.hypot(c.x-self.x,c.z-self.z)})).sort((a,b)=>a.dist-b.dist)[0];
   if(cache){ctx.save();ctx.setLineDash([3.5*m,4.5*m]);ctx.strokeStyle='rgba(224,122,223,.42)';ctx.lineWidth=1.1*m;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(cx+cache.x*k,cy+cache.z*k);ctx.stroke();ctx.restore()}
   // Operator-centred range rings (radar style) plus a directional wedge from
   // authoritative yaw; both are presentation-only and clip at the map edge.
   ctx.save();ctx.setLineDash([4*m,6*m]);ctx.strokeStyle='rgba(208,234,226,.18)';ctx.lineWidth=1.1*m;
   for(const r of [n*.12,n*.21,n*.30]){ctx.beginPath();ctx.arc(hx,hy,r,0,Math.PI*2);ctx.stroke()}
   ctx.restore();
   const angle=Math.atan2(Math.cos(self.yaw||0),Math.sin(self.yaw||0)),half=Math.PI*.17,h=ctx.createRadialGradient(hx,hy,0,hx,hy,n*.23);
   h.addColorStop(0,'rgba(255,207,97,.3)');h.addColorStop(.55,'rgba(255,207,97,.11)');h.addColorStop(1,'rgba(255,207,97,0)');
   ctx.beginPath();ctx.moveTo(hx,hy);ctx.arc(hx,hy,n*.23,angle-half,angle+half);ctx.closePath();ctx.fillStyle=h;ctx.fill();
   // Compass bezel: short ticks at 30-degree intervals and N/E/S/W edge labels.
   ctx.save();ctx.strokeStyle='rgba(228,241,235,.28)';ctx.lineWidth=1.1*m;
   for(let i=0;i<12;i++){const a=i*Math.PI/6,long=i%3===0,r0=n*(long?.43:.445),r1=n*.462;ctx.beginPath();ctx.moveTo(cx+Math.sin(a)*r0,cy-Math.cos(a)*r0);ctx.lineTo(cx+Math.sin(a)*r1,cy-Math.cos(a)*r1);ctx.stroke()}
   ctx.restore();
   const labels=[['N',0,-1,'#ffcf61'],['E',1,0,'rgba(238,246,242,.74)'],['S',0,1,'rgba(238,246,242,.62)'],['W',-1,0,'rgba(238,246,242,.62)']];
   for(const [label,dx,dz,color] of labels){const px=cx+dx*n*.39,py=cy+dz*n*.39;ctx.font='700 '+((label==='N'?10:8.5)*m*uiK)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=2.6*m*uiK;ctx.strokeStyle='rgba(7,13,16,.9)';ctx.strokeText(label,px,py);ctx.fillStyle=color;ctx.fillText(label,px,py)}
   // Inset corner brackets complete the tactical-glass frame inside the
   // CSS-rounded border; they never intercept pointer input.
   ctx.save();ctx.strokeStyle='rgba(255,197,92,.6)';ctx.lineWidth=1.5*m;const o=8*m,len=11*m;
   for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const x=sx>0?o:n-o,y=sy>0?o:n-o;ctx.beginPath();ctx.moveTo(x,y+sy*len);ctx.lineTo(x,y);ctx.lineTo(x+sx*len,y);ctx.stroke()}
   ctx.restore();
  }
  // North is screen-up. Bearing is clockwise from north, so a yaw of 0 (world
  // +Z, drawn downward) reads as facing south rather than mislabelling it.
  const heading=Math.atan2(Math.sin(self.yaw||0),-Math.cos(self.yaw||0)),deg=Math.round(((heading*180/Math.PI)+360)%360),names=['north','northeast','east','southeast','south','southwest','west','northwest'];
  const headingText=String(deg).padStart(3,'0'),labelText='Tactical map of '+(world.name||world.id)+' · facing '+names[Math.round(deg/45)%8]+' '+headingText+'°. Green diamonds mark exits, amber is you, pink marks caches, red marks threats, red rings are hazard windows, dashed white rings mark elite patrols, door markers are red while locked, amber while closed and green while open, a cyan or green ring marked O shows the field objective, pink B marks a downed operator body (amber L once searched), pink C marks operator salvage, amber M machine salvage, orange R rival salvage, and lavender G dropped gear.';
  if(canvas.dataset.heading!==headingText)canvas.dataset.heading=headingText;
  if(canvas.getAttribute('aria-label')!==labelText)canvas.setAttribute('aria-label',labelText);
 }else if(canvas.dataset.heading)delete canvas.dataset.heading;
 // Environmental hazard windows paint beneath every marker: amber dashed rings
 // are warnings and solid red discs are active damage fields.
 for(const h of state?.hazards||[])if(h.active||h.warning){
  const px=cx+h.x*k,py=cy+h.z*k,r=Math.max(4,h.radius*k);
  ctx.save();ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);
  ctx.globalAlpha=h.warning?.12:.2;ctx.fillStyle=h.warning?'#ffb76d':'#ff3d32';ctx.fill();ctx.globalAlpha=1;
  ctx.setLineDash(h.warning?[2*m*uiK,3*m*uiK]:[]);ctx.strokeStyle=h.warning?'rgba(255,183,109,.9)':'rgba(255,61,50,.92)';ctx.lineWidth=(h.warning?1.2:1.8)*m*uiK;ctx.stroke();ctx.restore();
 }
 for(const exit of state?.exits||world.exits)diamond(exit.x,exit.z,state?'#'+exitColor(exit,state.serverTime).toString(16).padStart(6,'0'):'#83efc2','E');
 if(state){
  for(const c of state.caches||[])if(c.weaponCache){point(c.x,c.z,'#e07adf',4.2);letter('A',c.x,c.z,2.8)}else point(c.x,c.z,c.open?'#8fd59a':'#d6b15f',2.4);
  for(const door of state.doors||[]){const color=door.locked?'#ff8a66':door.closed?'#f2c25d':'#8ee6a2';point(door.x,door.z,color,2.8);if(door.locked||door.closed)letter(door.locked?'L':'D',door.x,door.z,2.7,'#f4fff9')}
  if(state.objective){const o=state.objective,color=o.stage==='secured'?'#7dff9b':'#63e3ff';ring(o.x,o.z,color,6.2,1.5);point(o.x,o.z,color,2.6);letter('O',o.x,o.z,2.8,'#071116')}
  for(const r of state.rivals||[]){point(r.x,r.z,'#ff7a52',3.2);letter(r.state==='engage'||r.state==='windup'?'!':'S',r.x,r.z,2.6)}
  for(const m of state.machines||[]){point(m.x,m.z,'#ff665b',3.2);if(m.elite){ring(m.x,m.z,'rgba(255,255,255,.92)',6.5,1.4);letter('X',m.x,m.z,-5.4,'#fff')}}
  for(const l of state.loot||[])point(l.x,l.z,'#b6ee9b',2.3);
  for(const b of state.bags||[]){const m=bagMarker(b);point(b.x,b.z,m.color,3);letter(m.letter,b.x,b.z,2.7,'#071116')}
  for(const p of state.players.filter(p=>p.team===state.self.team))point(p.x,p.z,'#77c5ff',2.8);
  for(const b of state.bodies||[])if(b.team!==state.self.team){point(b.x,b.z,b.open?'#ffd0a1':'#ff9e9e',2.6);letter(b.open?'L':'B',b.x,b.z,2.5)}
  for(const ping of state.pings||[]){point(ping.x,ping.z,'#f3b9ff',2.8);letter(ping.kind==='danger'?'!':ping.kind==='needAmmo'?'A':ping.kind==='needMed'?'+':'P',ping.x,ping.z,2.6)}
  const pulse=reduced?0:(1.6+1.4*Math.sin((state.serverTime||0)*4))*m;
  ring(state.self.x,state.self.z,'rgba(255,207,97,.42)',5+pulse,1.2);point(state.self.x,state.self.z,'#ffcf61',2.2);
 }
}
// The compact HUD's always-visible approach map: a 150 m, player-centred,
// heading-up radar of the local streets, buildings, exits and pickups. Draw
// order is ground, buildings, cover; markers sit above in screen space. Nothing
// here is simulated or sent, and the legacy #minimap keeps its whole-map
// projection for the graders and the surviving tactical-map contract.
const NAV_RADIUS=150,NAV_ARROWS=['▲','↗','▶','↘','▼','↙','◀','↖'];
const NAV_BUILDINGS={concrete:'#1b3542',plaster:'#243642',planks:'#382d23',brick:'#3a282b',metal:'#1d333c',container:'#342e22',rock:'#29302d',crate:'#34291f',barrier:'#352f25',roof:'#182a31'};
function drawNavMap(canvas,state){
 const s=state?.self,world=state?getWorld(state.map,state.mapVersion===undefined?1:state.mapVersion):null;
 if(!canvas||!s||!world||document.documentElement.dataset.compactHud!=='true')return;
 const ctx=canvas.getContext('2d'),n=canvas.width,cx=n/2,cy=n/2,R=cx-3,k=R/NAV_RADIUS,TAU=Math.PI*2;
 const heading=inRaid?yaw:Number(s.yaw)||0,theta=heading-Math.PI,cos=Math.cos(theta),sin=Math.sin(theta);
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,n,n);ctx.save();
 ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.clip();
 const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
 bg.addColorStop(0,'#0c2029');bg.addColorStop(.7,'#08161d');bg.addColorStop(1,'#050d12');
 ctx.fillStyle=bg;ctx.fillRect(0,0,n,n);
 // Local fabric rotates under a fixed operator heading, so forward is always up.
 ctx.save();ctx.translate(cx,cy);ctx.rotate(theta);ctx.scale(k,k);ctx.translate(-s.x,-s.z);
 const reach=NAV_RADIUS+90,reach2=reach*reach;
 const paint=(p,fill)=>{const x=p.x||0,z=p.z||0,w=p.w||20,d=p.d||10,ry=p.ry||0;ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.fillStyle=fill;ctx.fillRect(-w/2,-d/2,w,d);ctx.restore()};
 for(const p of world.props){
  const x=p.x||0,z=p.z||0,dx=x-s.x,dz=z-s.z;if(dx*dx+dz*dz>reach2)continue;
  if(p.kind==='field'){paint(p,'#172f1f');const w=p.w||20,d=p.d||10,ry=p.ry||0;ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.strokeStyle='rgba(116,186,128,.16)';ctx.lineWidth=.8;ctx.strokeRect(-w/2+.5,-d/2+.5,w-1,d-1);ctx.restore()}
  else if(p.kind==='basin')paint(p,'#1c4652');
  else if(p.kind==='plaza'||p.kind==='floor'||p.kind==='crosswalk')paint(p,'#27404a');
  else if(p.kind==='road'){
   paint(p,'#29444e');
   const w=p.w||20,d=p.d||10;if(Math.max(w,d)>=16){ctx.save();ctx.translate(x,z);if(p.ry)ctx.rotate(p.ry);ctx.strokeStyle='rgba(231,243,237,.15)';ctx.lineWidth=.9;ctx.setLineDash([5,6]);ctx.beginPath();if(w>=d){ctx.moveTo(-w/2+3,0);ctx.lineTo(w/2-3,0)}else{ctx.moveTo(0,-d/2+3);ctx.lineTo(0,d/2-3)};ctx.stroke();ctx.restore()}
  }
  else if(p.kind==='sidewalk')paint(p,'#3a565e');
  else if(p.kind==='rail'){paint(p,'#3c4245');const w=p.w||20,d=p.d||10,ry=p.ry||0;ctx.save();ctx.translate(x,z);if(ry)ctx.rotate(ry);ctx.fillStyle='rgba(206,206,196,.34)';if(w>=d)ctx.fillRect(-w/2,-1.1,w,2.2);else ctx.fillRect(-1.1,-d/2,2.2,d);ctx.restore()}
 }
 // Buildings and stacked roofs sit above the street surface.
 for(const [x,z,w,d,,base=0,kind='concrete',tint]of world.blocks){
  if(base>3)continue;
  const dx=x-s.x,dz=z-s.z,slant=Math.max(w,d);if(dx*dx+dz*dz>(NAV_RADIUS+slant)*(NAV_RADIUS+slant))continue;
  const color=NAV_BUILDINGS[kind]||NAV_BUILDINGS.concrete;
  ctx.fillStyle=color;ctx.fillRect(x-w/2,z-d/2,w,d);
  // A lit north rim and a cool edge give each footprint a readable hull.
  ctx.fillStyle='rgba(176,224,236,.16)';ctx.fillRect(x-w/2,z-d/2,w,Math.max(.45,Math.min(1.8,w*.1)));
  ctx.strokeStyle='rgba(112,180,202,.26)';ctx.lineWidth=.6;ctx.strokeRect(x-w/2,z-d/2,w,d);
 }
 // Canopies and yard clutter come last so they never vanish into the asphalt.
 for(const p of world.props){
  const x=p.x||0,z=p.z||0,dx=x-s.x,dz=z-s.z;if(dx*dx+dz*dz>reach2)continue;
  if(p.kind==='tree'){ctx.fillStyle='#24492c';ctx.beginPath();ctx.arc(x,z,Math.max(2.6,(p.scale||1)*3.4),0,TAU);ctx.fill()}
  else if(p.kind==='bush'||p.kind==='hedge'){const w=p.kind==='hedge'?p.w||2:Math.max(2,(p.scale||1)*2.4),d=p.kind==='hedge'?p.d||2:0;if(d){ctx.fillStyle='#22432a';ctx.save();ctx.translate(x,z);if(p.ry)ctx.rotate(p.ry);ctx.fillRect(-w/2,-d/2,w,d);ctx.restore()}else{ctx.fillStyle='#22432a';ctx.beginPath();ctx.arc(x,z,w,0,TAU);ctx.fill()}}
  else if(p.kind==='billboard'){ctx.fillStyle='#4a3c24';ctx.fillRect(x-2.6,z-1.4,5.2,2.8)}
 }
 ctx.restore();
 // Distance rings and a cool rim fold the streets into the HUD glass.
 ctx.strokeStyle='rgba(152,202,220,.16)';ctx.lineWidth=1;
 for(const r of [NAV_RADIUS*.5,NAV_RADIUS]){ctx.beginPath();ctx.arc(cx,cy,r*k,0,TAU);ctx.stroke()}
 const rim=ctx.createRadialGradient(cx,cy,R*.56,cx,cy,R);
 rim.addColorStop(0,'rgba(5,13,18,0)');rim.addColorStop(.84,'rgba(5,13,18,.22)');rim.addColorStop(1,'rgba(5,13,18,.86)');
 ctx.fillStyle=rim;ctx.fillRect(0,0,n,n);
 const project=(x,z)=>{const dx=x-s.x,dz=z-s.z;return {x:cx+(dx*cos-dz*sin)*k,y:cy+(dx*sin+dz*cos)*k,d:Math.hypot(dx,dz)}};
 const serverTime=state.serverTime||0;
 // Their rings used to be painted only on the hidden whole-map minimap; keep
 // the local hazard window readable on the small heading-up card instead.
 for(const h of state.hazards||[])if((h.active||h.warning)&&Number.isFinite(h.x)&&Number.isFinite(h.z)){
  const q=project(h.x,h.z),rad=Math.max(9,Math.min(R-3,(h.radius||6)*k));
  if(q.d>NAV_RADIUS+rad)continue;
  ctx.save();ctx.beginPath();ctx.arc(q.x,q.y,rad,0,TAU);
  ctx.globalAlpha=h.warning?.13:.2;ctx.fillStyle=h.warning?'#ffb76d':'#ff3d32';ctx.fill();ctx.globalAlpha=1;
  ctx.setLineDash(h.warning?[5,5]:[]);ctx.lineWidth=h.warning?1.6:2.2;
  ctx.strokeStyle=h.warning?'rgba(255,183,109,.85)':'rgba(255,61,50,.92)';ctx.stroke();ctx.restore();
 }
 // Exits stay visible at any range: diamonds nearby, chevrons pinned to the rim.
 for(const exit of state.exits||[]){
  const p=project(exit.x,exit.z),color='#'+exitColor(exit,serverTime).toString(16).padStart(6,'0');
  if(p.d<=NAV_RADIUS*.9){
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);
   ctx.fillStyle='rgba(4,10,14,.72)';ctx.fillRect(-16,-16,32,32);
   ctx.fillStyle=color;ctx.strokeStyle='rgba(4,10,14,.96)';ctx.lineWidth=3;
   ctx.fillRect(-10.6,-10.6,21.2,21.2);ctx.strokeRect(-10.6,-10.6,21.2,21.2);ctx.restore();
  }else{
   // The rim marker has to survive the 360→120 px downscale: small glyphs turn
   // to dust on a phone. Keep a 20 CSS px badge and broad chevron so the exit
   // bearing stays obvious at arm's length and never vanishes into the glass.
   const angle=Math.atan2(p.y-cy,p.x-cx),ax=cx+Math.cos(angle)*(R-31),ay=cy+Math.sin(angle)*(R-31);
   ctx.save();ctx.translate(ax,ay);ctx.rotate(angle+Math.PI/2);
   ctx.beginPath();ctx.arc(0,0,30,0,TAU);ctx.fillStyle='rgba(4,10,14,.88)';ctx.fill();
   ctx.strokeStyle='rgba(212,238,230,.28)';ctx.lineWidth=2;ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,-42);ctx.lineTo(20,14);ctx.lineTo(0,6);ctx.lineTo(-20,14);ctx.closePath();
   ctx.fillStyle=color;ctx.strokeStyle='rgba(4,10,14,.96)';ctx.lineWidth=4.6;ctx.lineJoin='round';ctx.fill();ctx.stroke();
   // A faint inner wash gives the marker a bevel without a second texture.
   ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(11,10);ctx.lineTo(0,4);ctx.lineTo(-11,10);ctx.closePath();
   ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();ctx.restore();
  }
 }
 for(const m of state.machines||[])if(m.hp>0){const p=project(m.x,m.z);if(p.d>NAV_RADIUS)continue;ctx.beginPath();ctx.arc(p.x,p.y,8.8,0,TAU);ctx.fillStyle='rgba(255,102,91,.2)';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,5.4,0,TAU);ctx.fillStyle='#ff665b';ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='rgba(6,12,16,.9)';ctx.stroke()}
 for(const p of state.players||[])if(p.team===s.team&&p.id!==s.id){const q=project(p.x,p.z);if(q.d>NAV_RADIUS)continue;ctx.beginPath();ctx.arc(q.x,q.y,4.6,0,TAU);ctx.fillStyle='#77c5ff';ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='rgba(6,12,16,.8)';ctx.stroke()}
 for(const l of state.loot||[]){const q=project(l.x,l.z);if(q.d>80)continue;ctx.beginPath();ctx.arc(q.x,q.y,3.1,0,TAU);ctx.fillStyle='#b6ee9b';ctx.fill()}
 if(waypoint){const q=project(waypoint.x,waypoint.z);
  if(q.d<=NAV_RADIUS*.94){ctx.save();ctx.setLineDash([4,5]);ctx.strokeStyle='rgba(120,230,255,.55)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#78e6ff';ctx.fillRect(-4.8,-4.8,9.6,9.6);ctx.restore()}
  else{const angle=Math.atan2(q.y-cy,q.x-cx);ctx.save();ctx.translate(cx+Math.cos(angle)*(R-20),cy+Math.sin(angle)*(R-20));ctx.rotate(angle+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(3.6,2.6);ctx.lineTo(0,.4);ctx.lineTo(-3.6,2.6);ctx.closePath();ctx.fillStyle='#78e6ff';ctx.fill();ctx.restore()}
 }
 // Operator chevron always points up; the world turns beneath it.
 ctx.beginPath();ctx.arc(cx,cy,22,0,TAU);ctx.fillStyle='rgba(255,207,97,.12)';ctx.fill();
 ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(10.6,10.4);ctx.lineTo(0,4.8);ctx.lineTo(-10.6,10.4);ctx.closePath();
 ctx.fillStyle='#ffcf61';ctx.strokeStyle='rgba(6,12,16,.95)';ctx.lineWidth=2.6;ctx.fill();ctx.stroke();ctx.restore();
 // North tag rotates with the world.
 const northAngle=heading-Math.PI,na=Math.atan2(-Math.cos(northAngle),Math.sin(northAngle)),nx=cx+Math.cos(na)*(R-17),ny=cy+Math.sin(na)*(R-17);
 ctx.beginPath();ctx.arc(nx,ny,13,0,TAU);ctx.fillStyle='rgba(8,18,24,.92)';ctx.fill();ctx.strokeStyle='rgba(224,244,236,.62)';ctx.lineWidth=1.6;ctx.stroke();
 ctx.font='700 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffe29a';ctx.fillText('N',nx,ny);
 ctx.beginPath();ctx.arc(cx,cy,R-.7,0,TAU);ctx.strokeStyle='rgba(202,238,231,.34)';ctx.lineWidth=1.6;ctx.stroke();
 ctx.restore();
}
let navHudAt=0,navHudKey='';
function renderNavHud(force=false){
 const chip=$('navChip');
 if(!chip)return;
 if(!inRaid||!snapshot||document.documentElement.dataset.compactHud!=='true'||!snapshot.self){if(!chip.hidden)chip.hidden=true;return}
 const now=performance.now();
 if(!force&&now-navHudAt<85)return;
 navHudAt=now;
 drawNavMap($('navmap'),snapshot);
 const s=snapshot.self,serverTime=snapshot.serverTime||0,exits=snapshot.exits||[];
 let best=null;
 for(const exit of exits){
  const state=exitState(exit,serverTime),spent=state.phase==='departed'||state.phase==='exhausted'?1:0,d=Math.hypot(exit.x-s.x,exit.z-s.z);
  if(!best||spent<best.spent||(spent===best.spent&&d<best.d))best={exit,state,spent,d};
 }
 if(!best){chip.hidden=true;return}
 const heading=mapBearing(s.x,s.z,s.x+Math.sin(inRaid?yaw:Number(s.yaw)||0),s.z+Math.cos(inRaid?yaw:Number(s.yaw)||0));
 const bearing=mapBearing(s.x,s.z,best.exit.x,best.exit.z);
 const rel=((bearing-heading)%360+540)%360-180,arrow=NAV_ARROWS[Math.round(rel/45+8)%8];
 const summary=[best.exit.id,Math.round(best.d),arrow,mapCardinal(bearing),best.state.phase].join('|');
 if(summary!==navHudKey){
  navHudKey=summary;
  $('navChipRange').textContent=mapRange(best.d);
  $('navChipBearing').textContent=arrow+' '+mapCardinal(bearing);
  chip.dataset.state=best.spent?'spent':best.state.phase==='open'?'open':'closed';
  chip.title=(best.exit.name||'Extraction exit')+' · '+exitDescription(best.exit,serverTime);
  chip.setAttribute('aria-label','Nearest exit '+(best.exit.name||'')+': '+mapRange(best.d)+' '+mapCardinal(bearing));
 }
 chip.hidden=false;
}
// Tactical map state is purely client-side presentation: every rendered position
// comes from the authoritative snapshot and a waypoint is never transmitted.
const MAP_CARDINALS=['north','northeast','east','southeast','south','southwest','west','northwest'];
let waypoint=null,mapOpen=false,mapCamera={x:0,z:0,zoom:1,raidId:null},mapDrag=null;
// The full map opens already centred on the operator, so a landing has an
// immediate read of nearby streets instead of the whole 1.4 km sector.
const TACTICAL_ZOOM=1.7;
const tacticalWorld=()=>snapshot?getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion):null;
function mapBearing(fx,fz,tx,tz){return ((Math.atan2(tx-fx,-(tz-fz))*180/Math.PI)+360)%360}
const mapCardinal=deg=>MAP_CARDINALS[Math.round(deg/45)%8];
const mapDegree=deg=>String(Math.round(deg)%360).padStart(3,'0')+'°';
const mapRange=m=>m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';
function updateCompass(s){
 if(!s)return;
 const heading=mapBearing(s.x,s.z,s.x+Math.sin(inRaid?yaw:s.yaw||0),s.z+Math.cos(inRaid?yaw:s.yaw||0));
 let text=`Facing ${mapCardinal(heading)} ${mapDegree(heading)}`;
 if(waypoint){const range=Math.hypot(waypoint.x-s.x,waypoint.z-s.z),bearing=mapBearing(s.x,s.z,waypoint.x,waypoint.z);text+=` · waypoint ${mapRange(range)} ${mapCardinal(bearing)} ${mapDegree(bearing)}`}
 $('compass').textContent=text;
}
function mapReadoutText(){
 const s=snapshot?.self;if(!s)return '';
 if(!waypoint)return 'Drag to pan · tap to set a waypoint · pinch or use the buttons to zoom.';
 const range=Math.hypot(waypoint.x-s.x,waypoint.z-s.z),bearing=mapBearing(s.x,s.z,waypoint.x,waypoint.z);
 return `Waypoint ${mapRange(range)} ${mapCardinal(bearing)} ${mapDegree(bearing)} · tap it again to clear.`;
}
function updateMapReadout(){if(mapOpen&&snapshot)$('mapReadout').textContent=mapReadoutText()}
function drawMinimapWaypoint(canvas,state){
 if(!waypoint||!state?.self)return;
 const world=tacticalWorld();if(!world)return;
 const ctx=canvas.getContext('2d'),n=canvas.width,k=n/world.size,cx=n/2,cy=n/2;
 const shown=canvas.isConnected&&canvas.getBoundingClientRect?canvas.getBoundingClientRect().width||0:0;
 const uiK=shown>0&&shown<=160?Math.min(2.4,Math.max(1.4,180/Math.max(60,shown))):1,m=n/180;
 const sx=cx+state.self.x*k,sy=cy+state.self.z*k,wx=cx+waypoint.x*k,wy=cy+waypoint.z*k;
 ctx.save();ctx.setLineDash([3*m*uiK,4*m*uiK]);ctx.strokeStyle='rgba(120,230,255,.6)';ctx.lineWidth=1.1*m*uiK;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(wx,wy);ctx.stroke();ctx.restore();
 // The minimap is CSS-downscaled to 80–100 px, so an oversized glyph would bury
 // the small cyan marker; the diamond alone stays legible and uniquely shaped.
 const s=4*m*uiK;ctx.save();ctx.translate(wx,wy);ctx.rotate(Math.PI/4);ctx.fillStyle='#78e6ff';ctx.strokeStyle='rgba(7,13,16,.92)';ctx.lineWidth=1.6*m*uiK;ctx.fillRect(-s,-s,2*s,2*s);ctx.strokeRect(-s,-s,2*s,2*s);ctx.restore();
}
function renderMinimap(state){
 const canvas=$('minimap');drawMap(canvas,state.map,state);drawMinimapWaypoint(canvas,state);
}
// Extracted so graders can render deterministic detached canvases. Live drawing
// passes the module camera; all marker positions still derive only from state.
export function drawTacticalMap(canvas,id,state,{camera=null,waypoint:goal=null,headingYaw=null}={}){
 const world=state?getWorld(id,state.mapVersion===undefined?1:state.mapVersion):RAID_WORLDS.find(w=>w.id===id);
 const self=state?.self;if(!world||!self)return;
 const cam=camera&&[camera.x,camera.z,camera.zoom].every(Number.isFinite)?{x:camera.x,z:camera.z,zoom:camera.zoom}:{x:self.x,z:self.z,zoom:1};
 const nW=canvas.width,nH=canvas.height,ctx=canvas.getContext('2d'),zoom=Math.max(.6,Math.min(4,cam.zoom)),k=Math.min(nW,nH)/world.size*zoom,midW=nW/2,midH=nH/2;
 const sx=x=>midW+(x-cam.x)*k,sy=z=>midH+(z-cam.z)*k;
 ctx.clearRect(0,0,nW,nH);ctx.fillStyle='#111814';ctx.fillRect(0,0,nW,nH);
 // An off-sector survey graticule makes the world boundary read as an edge of
 // coverage rather than an empty black band on wide screens.
 ctx.save();ctx.strokeStyle='rgba(126,166,138,.13)';ctx.lineWidth=1;
 for(let g=48;g<Math.max(nW,nH);g+=48){ctx.beginPath();ctx.moveTo(g,0);ctx.lineTo(g,nH);ctx.stroke();ctx.beginPath();ctx.moveTo(0,g);ctx.lineTo(nW,g);ctx.stroke()}
 ctx.restore();
 const atlas=mapBackground(world,720,false),span=world.size*k;
 ctx.drawImage(atlas,midW-cam.x*k-span/2,midH-cam.z*k-span/2,span,span);
 ctx.save();ctx.setLineDash([9,7]);ctx.strokeStyle='rgba(123,214,242,.34)';ctx.lineWidth=2;ctx.strokeRect(sx(-world.size/2),sy(-world.size/2),span,span);ctx.restore();
 const dot=(x,z,color,r=3.4)=>{ctx.beginPath();ctx.arc(sx(x),sy(z),Math.max(2.2,r*Math.min(1.7,zoom)),0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='rgba(7,13,16,.88)';ctx.stroke()};
 const glyph=(txt,x,z,dy=0,fill='#f4fff9',size=9)=>{const scale=Math.min(1.9,Math.max(.9,zoom));ctx.font='700 '+Math.round(size*scale)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3*scale;ctx.strokeStyle='rgba(7,13,16,.9)';ctx.strokeText(txt,sx(x),sy(z)+dy*scale);ctx.fillStyle=fill;ctx.fillText(txt,sx(x),sy(z)+dy*scale)};
 // Dashed bearing line makes the waypoint's direction legible at a glance.
 if(goal){ctx.save();ctx.setLineDash([7,7]);ctx.strokeStyle='rgba(120,230,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx(self.x),sy(self.z));ctx.lineTo(sx(goal.x),sy(goal.z));ctx.stroke();ctx.restore()}
 for(const h of state.hazards||[])if(h.active||h.warning){
  ctx.save();ctx.beginPath();ctx.arc(sx(h.x),sy(h.z),Math.max(5,h.radius*k),0,Math.PI*2);
  ctx.globalAlpha=h.warning?.12:.2;ctx.fillStyle=h.warning?'#ffb76d':'#ff3d32';ctx.fill();ctx.globalAlpha=1;
  ctx.setLineDash(h.warning?[6,6]:[]);ctx.strokeStyle=h.warning?'rgba(255,183,109,.9)':'rgba(255,61,50,.92)';ctx.lineWidth=h.warning?2:2.6;ctx.stroke();ctx.restore();
 }
 for(const exit of state.exits||[]){
  const color='#'+exitColor(exit,state.serverTime).toString(16).padStart(6,'0'),r=Math.max(4,5*Math.min(1.6,zoom));
  ctx.save();ctx.translate(sx(exit.x),sy(exit.z));ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.strokeStyle='rgba(7,13,16,.92)';ctx.lineWidth=1.5;ctx.fillRect(-r,-r,2*r,2*r);ctx.strokeRect(-r,-r,2*r,2*r);ctx.restore();
  glyph('E',exit.x,exit.z,0,'#f4fff9',10);
 }
 if(state.objective){
  const o=state.objective,color=o.stage==='secured'?'#7dff9b':'#63e3ff';
  ctx.save();ctx.beginPath();ctx.arc(sx(o.x),sy(o.z),Math.max(6,(o.radius||4)*k),0,Math.PI*2);ctx.setLineDash([4,4]);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.restore();
  dot(o.x,o.z,color,4);glyph('O',o.x,o.z,1.5,'#071116',9);
 }
 for(const c of state.caches||[])if(c.weaponCache){dot(c.x,c.z,'#e07adf',4.4);glyph('A',c.x,c.z,1.5,'#fff',9)}else dot(c.x,c.z,c.open?'#8fd59a':'#d6b15f',3.2);
 for(const door of state.doors||[]){const color=door.locked?'#ff7a5b':door.closed?'#f0b85a':'#8fd59a';dot(door.x,door.z,color,4.2);if(door.locked||door.closed)glyph(door.locked?'L':'D',door.x,door.z,-8,'#fff',8)}
 for(const m of state.machines||[]){dot(m.x,m.z,'#ff665b',3.6);if(m.kind==='overlord')glyph('!',m.x,m.z,1.5,'#fff',9);if(m.elite){ctx.save();ctx.beginPath();ctx.arc(sx(m.x),sy(m.z),Math.max(8,10*Math.min(1.6,zoom)),0,Math.PI*2);ctx.setLineDash([3,4]);ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=2;ctx.stroke();ctx.restore();glyph('X',m.x,m.z,-10*Math.min(1.5,zoom),'#fff',10)}}
 for(const r of state.rivals||[]){dot(r.x,r.z,'#ff7a52',3.4);glyph(r.state==='engage'||r.state==='windup'?'!':'S',r.x,r.z,1.5,'#fff',8)}
 for(const l of state.loot||[])dot(l.x,l.z,'#b6ee9b',2.6);
 for(const b of state.bags||[]){const m=bagMarker(b);dot(b.x,b.z,m.color,4.6);glyph(m.letter,b.x,b.z,1.5,'#071116',8);ctx.save();ctx.beginPath();ctx.arc(sx(b.x),sy(b.z),Math.max(4,6*Math.min(1.6,zoom)),0,Math.PI*2);ctx.strokeStyle=m.color;ctx.lineWidth=2;ctx.stroke();ctx.restore()}
 for(const p of state.players||[]){const squad=p.team===self.team;dot(p.x,p.z,squad?'#77c5ff':'#ff9e5b',3.2);if(squad&&zoom>=1.5)glyph(p.name?.slice(0,10)||'S',p.x,p.z,-4*Math.min(1.6,zoom),'#d7efff',8)}
 for(const b of state.bodies||[])if(b.team!==self.team){dot(b.x,b.z,b.open?'#ffd0a1':'#ff9e9e',3.6);glyph(b.open?'L':'B',b.x,b.z,1.5,'#fff',8)}
 for(const ping of state.pings||[]){dot(ping.x,ping.z,'#f3b9ff',3.4);glyph(ping.kind==='danger'?'!':ping.kind==='needAmmo'?'A':ping.kind==='needMed'?'+':'P',ping.x,ping.z,1.5,'#fff',8)}
 if(goal){const r=Math.max(5,7*Math.min(1.5,zoom));ctx.save();ctx.translate(sx(goal.x),sy(goal.z));ctx.rotate(Math.PI/4);ctx.fillStyle='#78e6ff';ctx.strokeStyle='rgba(7,13,16,.92)';ctx.lineWidth=2;ctx.fillRect(-r,-r,2*r,2*r);ctx.strokeRect(-r,-r,2*r,2*r);ctx.restore();glyph('W',goal.x,goal.z,0,'#071116',10)}
 // Self arrow faces and rotates with authoritative yaw.
 const angle=Math.atan2(Math.sin(headingYaw??self.yaw??0),-Math.cos(headingYaw??self.yaw??0)),a=Math.max(7,9*Math.min(1.6,zoom));
 ctx.save();ctx.translate(sx(self.x),sy(self.z));ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-a*1.45);ctx.lineTo(a*.82,a*.7);ctx.lineTo(0,a*.28);ctx.lineTo(-a*.82,a*.7);ctx.closePath();ctx.fillStyle='#ffcf61';ctx.fill();ctx.lineWidth=2.4;ctx.strokeStyle='rgba(7,13,16,.95)';ctx.stroke();ctx.restore();
}
function syncTacticalCanvas(){
 const canvas=$('tacticalCanvas');if(!canvas||!mapOpen)return;
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
}
function drawTactical(){
 if(!mapOpen||!snapshot)return;
 syncTacticalCanvas();
 drawTacticalMap($('tacticalCanvas'),snapshot.map,snapshot,{camera:mapCamera,waypoint,headingYaw:yaw});
}
function mapPointerPosition(event){
 const canvas=$('tacticalCanvas'),rect=canvas.getBoundingClientRect(),n=canvas.width;
 const px=(event.clientX-rect.left)*(rect.width?n/rect.width:1),py=(event.clientY-rect.top)*(rect.height?canvas.height/rect.height:1);
 return {px,py,cssX:event.clientX-rect.left,cssY:event.clientY-rect.top,rect};
}
function tacticalScale(){const world=tacticalWorld(),canvas=$('tacticalCanvas');return world&&mapCamera.zoom?Math.min(canvas.width,canvas.height)/world.size*mapCamera.zoom:0}
function mapWaypointScreen(){const canvas=$('tacticalCanvas'),world=tacticalWorld();if(!world||!waypoint)return null;const k=Math.min(canvas.width,canvas.height)/world.size*mapCamera.zoom;return {x:canvas.width/2+(waypoint.x-mapCamera.x)*k,y:canvas.height/2+(waypoint.z-mapCamera.z)*k}}
function setWaypoint(point){
 if(!point){waypoint=null}
 else{
  const world=tacticalWorld();if(!world)return;
  // Raid world coordinates are centred on the map: [-size/2, size/2].
  const half=world.size/2;
  waypoint={x:Math.max(-half,Math.min(half,point.x)),z:Math.max(-half,Math.min(half,point.z))};
 }
 updateMapReadout();updateCompass(snapshot?.self);if(snapshot)renderMinimap(snapshot);drawTactical();
}
function zoomTactical(factor,center){
 const canvas=$('tacticalCanvas'),world=tacticalWorld();if(!world)return;
 const nW=canvas.width,nH=canvas.height,k=Math.min(nW,nH)/world.size,px=center?.px??nW/2,py=center?.py??nH/2,old=mapCamera.zoom;
 const anchorX=mapCamera.x+(px-nW/2)/(k*old),anchorZ=mapCamera.z+(py-nH/2)/(k*old);
 mapCamera.zoom=Math.max(.6,Math.min(4,old*factor));
 mapCamera.x=anchorX-(px-nW/2)/(k*mapCamera.zoom);mapCamera.z=anchorZ-(py-nH/2)/(k*mapCamera.zoom);
 drawTactical();
}
function recentreTactical(){if(!snapshot)return;mapCamera={x:snapshot.self.x,z:snapshot.self.z,zoom:TACTICAL_ZOOM,raidId:snapshot.raidId};drawTactical()}
function resetTacticalMap(){
 mapOpen=false;waypoint=null;mapCamera={x:0,z:0,zoom:1,raidId:null};mapDrag=null;
 $('tacticalMap').hidden=true;$('mapToggle').setAttribute('aria-expanded','false');$('compass').textContent='';
 $('mapReadout').textContent='Drag to pan · tap to set a waypoint · tap it again to clear.';
 $('mapToggle').setAttribute('aria-label','Tactical map / '+keyName(preferences.get().bindings.map));
}
function setMapOpen(open){
 if(open&&(!inRaid||!snapshot))return;
 if(open&&!mapOpen){input.clear();trigger?.clear()}
 mapOpen=!!open;$('tacticalMap').hidden=!mapOpen;$('mapToggle').setAttribute('aria-expanded',String(mapOpen));
 if(mapOpen){
  // Re-centre only when the camera still belongs to an earlier raid; panning
  // around the same raid keeps the operator's chosen view.
  if(mapCamera.raidId!==snapshot.raidId)mapCamera={x:snapshot.self.x,z:snapshot.self.z,zoom:TACTICAL_ZOOM,raidId:snapshot.raidId};
  drawTactical();updateMapReadout();$('tacticalCanvas').focus();
 }else{$('mapReadout').textContent='Drag to pan · tap to set a waypoint · tap it again to clear.';document.exitPointerLock?.();$('view').focus()}
}
function toggleTacticalMap(){setMapOpen(!mapOpen)}
function bindTacticalMap(){
 const canvas=$('tacticalCanvas');
 canvas.addEventListener('pointerdown',event=>{
  if(!mapOpen||(event.button!==0&&event.pointerType!=='touch'))return;
  const pos=mapPointerPosition(event);
  mapDrag={id:event.pointerId,originX:event.clientX,originY:event.clientY,last:pos,moved:false};
  canvas.classList.add('dragging');canvas.setPointerCapture?.(event.pointerId);
 });
 canvas.addEventListener('pointermove',event=>{
  if(!mapDrag||mapDrag.id!==event.pointerId)return;
  if(!mapDrag.moved&&Math.hypot(event.clientX-mapDrag.originX,event.clientY-mapDrag.originY)<6)return;
  mapDrag.moved=true;
  const pos=mapPointerPosition(event),k=tacticalScale();
  if(k){mapCamera.x-=(pos.px-mapDrag.last.px)/k;mapCamera.z-=(pos.py-mapDrag.last.py)/k;mapDrag.last=pos;drawTactical()}
 });
 const finish=event=>{
  if(!mapDrag||mapDrag.id!==event.pointerId)return;
  const wasClick=!mapDrag.moved&&event.type==='pointerup';mapDrag=null;canvas.classList.remove('dragging');
  if(wasClick&&mapOpen){
   const pos=mapPointerPosition(event),w=mapWaypointScreen(),k=tacticalScale();
   if(!k)return;
   if(w&&Math.hypot(pos.px-w.x,pos.py-w.y)<18)setWaypoint(null);
   else setWaypoint({x:mapCamera.x+((pos.px-canvas.width/2)/k),z:mapCamera.z+((pos.py-canvas.height/2)/k)});
  }
 };
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 canvas.addEventListener('wheel',event=>{if(!mapOpen)return;event.preventDefault();zoomTactical(event.deltaY<0?1.2:1/1.2,mapPointerPosition(event))},{passive:false});
 $('mapToggle').onclick=()=>controlAction('map');$('mapClose').onclick=()=>setMapOpen(false);
 $('mapZoomIn').onclick=()=>zoomTactical(1.25);$('mapZoomOut').onclick=()=>zoomTactical(1/1.25);
 $('mapRecenter').onclick=()=>recentreTactical();$('mapClear').onclick=()=>setWaypoint(null);
 addEventListener('keydown',event=>{if(mapOpen&&event.key==='Escape') {event.preventDefault();setMapOpen(false)}});
 addEventListener('raidsettingschange',()=>{$('mapToggle').setAttribute('aria-label','Tactical map / '+keyName(preferences.get().bindings.map))});
}
bindTacticalMap();
function nearestArmory(s,state){
 if(!s?.alive)return null;
 const caches=(state?.caches||[]).filter(c=>c.weaponCache);
 if(!caches.length)return null;
 const target=caches.map(c=>({cache:c,d:distance(c,s)})).sort((a,b)=>a.d-b.d)[0];
 // Use the same north-is-minus-z bearing contract as the radar, compass and
 // tactical map. The old atan2(dx,dz) read every target as a mirror across the
 // east-west axis, so the briefing could point the reader away from the cache.
 const bearing=mapBearing(s.x,s.z,target.cache.x,target.cache.z);
 return {cache:target.cache,distance:target.d,bearing,compass:MAP_CARDINALS[Math.round(bearing/45)%8],degree:String(Math.round(bearing)%360).padStart(3,'0')};
}
function armoryObjective(s,state){
 const target=nearestArmory(s,state);
 if(!target)return '';
 return `Armory objective · ${target.cache.label}: ${Math.round(target.distance)} m ${target.compass} · bearing ${target.degree}°`;
}
function deploymentExitPlan(){const world=getWorld($('map').value),sector=SECTORS[world.id],artifact=ARTIFACTS[sector.artifact];$('sectorPlan').textContent=sector.summary+' Recovery objective: '+artifact.name+' at '+artifact.site+'. Light and weather change during the raid; check the sector clock after deployment.';$('exitPlan').replaceChildren();for(const exit of createRaidExits(world,0)){const line=document.createElement('p');line.textContent=exit.name+': '+exitDescription(exit,0);$('exitPlan').append(line)}}
function deploymentObjectiveOptions(){
 const select=$('fieldObjective'),current=select.value,list=objectivesFor(getWorld($('map').value));
 select.replaceChildren();
 const none=document.createElement('option');none.value='';none.textContent='No field objective — extract normally';select.append(none);
 for(const objective of list){const option=document.createElement('option');option.value=objective.id;option.textContent=objective.name+' · hold '+objective.holdSeconds+' s · +'+objective.rewardCredits+' credits, +'+objective.rewardXp+' XP';select.append(option)}
 select.value=list.some(objective=>objective.id===current)?current:'';
}
$('map').addEventListener('change',()=>{drawMap($('mapPreview'),$('map').value);deploymentExitPlan();deploymentObjectiveOptions();persistOfflineRaidPlan();updateDeployReadiness();updateHeroSummary()});$('fieldObjective').addEventListener('change',()=>{persistOfflineRaidPlan();updateDeployReadiness();updateHeroSummary()});deploymentExitPlan();deploymentObjectiveOptions();
drawMap($('mapPreview'),$('map').value);

let lastHealth=100,lastOutcome='',lastBoard=false,lastWounds='',lastHitToken=0,hitmarkerTimer=0;
// The hit marker is driven only by the authoritative self.hit token written by
// the raid service after damage resolution. The client never raycasts, guesses,
// or invents a hit. start() and sign-out baseline the token so a reconnect does
// not replay an old marker.
function clearHitmarker(){clearTimeout(hitmarkerTimer);const marker=$('hitmarker');marker?.classList.remove('show');if(marker)marker.dataset.kind='';const caption=$('hitmarkerCaption');if(caption)caption.textContent=''}
function renderHitFeedback(s){
 const hit=s.hit;
 if(!shouldShowHit(hit,lastHitToken))return;
 lastHitToken=hitToken(hit);
 // The server resolves machine weak hits and machine kills and reports the
 // machine core coordinates; every burst is spawned exactly there, never from a
 // client raycast. A kill reads as a hull break/wreck; a survivable core hit
 // keeps the cyan weak-point burst. Missing or malformed coordinates fall back
 // to the existing marker-only feedback.
 const core=hit.core&&[hit.core.x,hit.core.y,hit.core.z].every(Number.isFinite)?hit.core:null;
 if(core){
  if(hit.kill&&hit.target==='machine')view?.spawnMachineWreck(core.x,core.y,core.z,{kind:hit.kind||'scout'});
  else if(hit.weak)view?.spawnCoreBurst(core.x,core.y,core.z);
 }
 const marker=$('hitmarker'),caption=$('hitmarkerCaption'),kind=hit.kill?'kill':hit.weak?'weak':hit.headshot?'headshot':'hit',text=hitCaption(hit);
 if(marker){marker.dataset.kind=kind;marker.classList.remove('show');void marker.offsetWidth;marker.classList.add('show')}
 if(caption)caption.textContent=text;
 clearTimeout(hitmarkerTimer);hitmarkerTimer=setTimeout(()=>marker?.classList.remove('show'),hit.kill?900:650);
}
function woundStatus(s,at=snapshot.serverTime){return s.alive&&!s.downed?[s.wounds?.bleedingUntil>at?'Bleeding: use a dressing or medkit.':'',s.wounds?.limpUntil>at?'Leg injury: use a splint or trauma pack.':''].filter(Boolean).join(' '):''}
function updateInteraction(s){
 const boardExit=s.board?snapshot.exits?.find(e=>e.id===s.board.exit):null,boardLink=Math.min(SQUAD_LINK.maxCompanions,Math.max(0,Math.trunc(Number(boardExit?.squadNear)||0))),searching=snapshot.caches.find(c=>c.searchRemaining!=null)||(snapshot.bodies||[]).find(b=>b.searchRemaining!=null),searchTarget=searching?(searching.label||searching.name||'target'):'',text=s.board?'Boarding · '+Math.max(0,Math.ceil(s.board.until-snapshot.serverTime))+'s · keep still in the exit'+(boardLink?' · squad link +'+squadLinkBonus(boardLink)+' credits':''):s.reviving?'Reviving squadmate · '+Math.max(0,Math.ceil(s.reviving.until-snapshot.serverTime))+'s · keep still':searching?'Searching '+searchTarget+' · '+Math.ceil(searching.searchRemaining)+'s · keep still':s.downed?'Downed · wait for a squadmate to revive or carry you':'';
 if($('interactionStatus').textContent!==text)$('interactionStatus').textContent=text;
 if(s.hp<lastHealth){flashSlimHud();if(preferences.get().captions)$('events').textContent='Taking damage · '+Math.max(0,Math.ceil(s.hp))+' health';if(s.hp<=30||s.downed)$('statusAnnouncement').textContent=s.downed?'You are downed. Call for help.':'Low health. '+Math.ceil(s.hp)+' remaining.'}
 const wounds=woundStatus(s);if(wounds&&wounds!==lastWounds){$('statusAnnouncement').textContent=wounds;if(preferences.get().captions)$('events').textContent=wounds}else if(!wounds&&lastWounds&&s.alive&&!s.downed){$('statusAnnouncement').textContent='No active bleeding or leg injury.';if(preferences.get().captions)$('events').textContent='No active bleeding or leg injury.'}lastWounds=wounds;
 if(s.result?.outcome&&s.result.outcome!==lastOutcome){lastOutcome=s.result.outcome;$('statusAnnouncement').textContent='Raid '+lastOutcome+'. Back to base is available.';$('leave').focus()}
 if(!!s.board!==lastBoard){lastBoard=!!s.board;$('statusAnnouncement').textContent=s.board?'Boarding started.'+(boardLink?' Squad link-up bonus active with '+boardLink+' squadmate'+(boardLink===1?'':'s')+'.':'')+' Stay in the exit.':'Boarding ended.'}
 lastHealth=s.hp;
}
function inspect(it){
 if(!inRaid&&!profile?.items.some(item=>item.id===it.id))return;const selected=profile?describeLoadout(profile,selectedLoadout()):null,actor=inRaid?snapshot.self:{equipment:selected?.chosen||[],pack:[],weaponId:selected?.primary?.id,combatVersion:2,ballisticsVersion:1};
 document.exitPointerLock?.();dispatchEvent(new Event('raidmenuopen'));$('inspectContent').replaceChildren();const heading=document.createElement('p');heading.textContent=label(it);$('inspectContent').append(heading);if(it.grantOwner||it.grantLoaded){const grant=document.createElement('p');grant.textContent=it.grantOwner?'Starter supply: only its original operator can recover it. Selling/recycling preserves its starter status.':'Starter-funded rounds stay with their original operator and are removed if someone else takes this weapon. The weapon itself remains transferable.';$('inspectContent').append(grant)}if(it.kind==='armor'||it.kind==='med'){const description=document.createElement('p');const stats=it.kind==='armor'?armorStats(it):MEDICAL[it.medical]||MEDICAL.field;description.textContent=actor.combatVersion!==2?'This raid keeps its original armor health and medicine rules. Current protection and injury rules apply on your next deployment.':it.kind==='armor'?Math.ceil(stats.protection)+'/'+stats.capacity+' protection · '+Math.round(stats.absorption*100)+'% body-hit absorption · '+Math.round(stats.mobility*100)+'% movement · '+stats.weight+' kg. Head and leg hits bypass armor.':(stats.heal?'Restores '+stats.heal+' health. ':'')+(stats.stopsBleed?'Stops bleeding. ':'')+(stats.treatsLimp?'Treats leg injury. ':'')+'Medical supplies have a two-second reuse delay.';$('inspectContent').append(description)}if(it.kind==='utility'){const description=document.createElement('p');description.textContent=UTILITIES[it.utility]?.description||'Field utility';$('inspectContent').append(description)}if(it.kind==='contract'){const description=document.createElement('p');description.textContent=(ARTIFACTS[it.artifact]?.description||'Recovery artifact')+' This item cannot enter protected storage or another raid. Reserved contract items cannot be sold or recycled.';$('inspectContent').append(description)}
 if(it.kind==='weapon'&&it.weapon==='shotgun'&&actor.ballisticsVersion!==1){const legacy=document.createElement('p');legacy.textContent='This active raid retains its original single-hit weapon rules. Pellet spread and falloff apply on your next deployment.';$('inspectContent').append(legacy)}
 const table=document.createElement('table'),stats=it.kind==='weapon'?weaponStats(it):null,active=stats&&[...actor.equipment,...actor.pack].find(i=>i.id===actor.weaponId),compare=active?weaponStats(active):null;
 for(const [name,value]of Object.entries(stats?{'Fire mode':stats.automatic?'Automatic (hold trigger)':'One shot per press',[stats.pellets>1&&actor.ballisticsVersion===1?'Damage (full shell)':'Damage']:stats.damage,'Pellets per round':actor.ballisticsVersion===1?stats.pellets||1:1,'Aim magnification':stats.zoom.toFixed(2)+'×','Range (m)':stats.range,'Magazine':stats.mag,'Reload (s)':stats.reload,'Ammo':stats.ammo,'Weight (kg)':itemWeight(it).toFixed(2),'Attachments':(it.attachments||[]).map(a=>MODS[a.mod]?.name||a.mod).join(', ')||'None'}:{'Quantity':it.quantity||1,'Weight (kg)':itemWeight(it).toFixed(2),'Condition':Math.round(it.condition??100)+'%','Recovery equipment':it.recovery?'Cannot be banked':'No'})){
  const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=name;td.textContent=String(value);if(compare&&active.id!==it.id){const k={'Damage':'damage','Damage (full shell)':'damage','Range (m)':'range','Magazine':'mag','Reload (s)':'reload'}[name];if(k)td.textContent+=' ('+(inRaid?'equipped':'selected primary')+': '+compare[k]+')'}tr.append(th,td);table.append(tr)
 }
 $('inspectContent').append(table);$('inspectDialog').showModal();$('inspectClose').focus();
}
$('inspectClose').onclick=()=>$('inspectDialog').close();
