import {sameLoadout,describeLoadout} from './shared/raid-loadout.mjs';
import {RaidTrigger,deferIdleMovement} from './raid-trigger.mjs';
import {reasonText,settlementText,insuranceText} from './shared/raid-report.mjs';
import {grantBalance,canRecoverGrant} from './shared/raid-grants.mjs';
import {stackable,compatibleStacks} from './shared/raid-inventory.mjs';
import {quantityUI,inventoryFocus,restoreInventoryFocus} from './raid-quantity-ui.mjs';
import {ARMOR,MEDICAL,armorStats,medicalNeed} from './shared/raid-combat.mjs';
import {matchPreferences} from './shared/raid-matchmaking.mjs';
import {UTILITIES} from './shared/raid-utilities.mjs';
import {RAID_PROTOCOL} from './shared/raid-protocol.mjs';
import {ReliableActions} from './raid-transport.mjs';
import {LocalPrediction} from './raid-prediction.mjs';
import {ARTIFACTS,SECTORS} from './shared/raid-sectors.mjs';
import {createRaidExits,exitDescription,exitColor} from './shared/raid-exits.mjs';
import {accountUI} from './raid-account-ui.mjs';
import {installDialogNavigation} from './raid-dialogs.mjs';
import {settingsUI} from './raid-settings-ui.mjs';
import {raidInput} from './raid-input.mjs';
import {keyName,aimDelta} from './shared/raid-settings.mjs';
import {communicationUI} from './raid-comms-ui.mjs';
import {RaidView,BasePreview} from './raid-view.mjs';
import {RAID_WORLDS,getWorld} from './shared/raid-worlds.mjs';
import {baseController} from './raid-base.mjs';
import {WEAPONS,MODS,weaponStats,itemWeight} from './shared/raid-catalog.mjs';
installDialogNavigation();
const chooseQuantity=quantityUI();
document.getElementById('previewTurn').onclick=()=>preview?.turn();
const $=id=>document.getElementById(id),message=text=>$('message').textContent=text;
let baseUI,previewLoadout={primary:null,secondary:null,armor:null};
let profile,party,snapshot,view,preview,yaw=0,pitch=0,seq=0,busy=false,tickBusy=false,inRaid=false,nearest=null,awaitingParty=false,notice={text:'',until:0};
let latencyProof=null,probeWork=null,matchInfo=null;
let aimMouse=false,aimTouch=false,aiming=false;
let trigger,weaponWork=null,stateAt=performance.now();
let identityUI,authChecking=false,raidGeneration=0,authGeneration=0,wire,prediction;

const comms=communicationUI({api,run,button,getProfile:()=>profile,action,getRaid:()=>inRaid?snapshot:null});
const preferences=settingsUI({onChange:settings=>{view?.applySettings(settings);preview?.applySettings(settings);comms.voice.setVolume(settings.voiceVolume);$('voiceVolume').value=settings.voiceVolume}});
const input=raidInput({settings:()=>preferences.get(),allowed:kind=>!preferences.isModal()&&(['pushTalk','communications'].includes(kind)?!!profile:['settings','help'].includes(kind)?true:inRaid&&$('communications').hidden),onTalk:active=>comms.voice.setTalking(active),onClear:stopHeldInput,onMove:sendHeldMovement,onRelease:kind=>{if(kind==='fire')trigger?.release('keyboard')},onAction:controlAction});
trigger=new RaidTrigger({getState:()=>{const s=snapshot?.self;return s?{deploymentId:s.deploymentId,alive:s.alive,downed:s.downed,nextFire:s.nextFire,weapon:[...s.equipment,...s.pack].find(it=>it.id===s.weaponId),serverTime:snapshot.serverTime,sampledAt:stateAt,rttMs:wire?.rtt||0}:null},allowed:()=>!weaponWork&&inRaid&&!!wire&&!wire.closed&&!!snapshot?.self.alive&&!snapshot.self.downed&&!preferences.isModal()&&$('communications').hidden&&!document.hidden,send:factory=>action(()=>({...factory(),yaw,pitch})),onEffect:()=>view?.fire(),onError:e=>{input.clear();notice={text:e.message,until:performance.now()+3500};$('hint').textContent=e.message}});
$('voiceVolume').addEventListener('change',()=>preferences.update({voiceVolume:Number($('voiceVolume').value)}));
addEventListener('raidsettingschange',()=>{if(inRaid)setPack(!$('pack').hidden)});

identityUI=accountUI({api,run,getProfile:()=>profile,onRotated:async()=>{authGeneration++;await comms.voice.leave('Voice off after account security update.');await refresh()},onRecovered:async()=>{await signedOut('Account recovered. Sign in with your new password.')},onSignOut:async()=>{await api('logout',{});await signedOut('Signed out.')}});
async function signedOut(text){
 const wasAlive=inRaid&&snapshot?.self.alive;authGeneration++;wire?.close();wire=null;prediction=null;inRaid=false;raidGeneration++;awaitingParty=false;input.clear();profile=null;party=null;snapshot=null;baseUI?.selectLoadout({recovery:false,itemIds:[],insureIds:[]});previewLoadout={primary:null,secondary:null,armor:null,recovery:false};preview?.clear();document.body.dataset.inRaid='false';document.querySelector('main').inert=false;document.exitPointerLock?.();$('play').style.display='none';
 view?.clear();await comms.reset();identityUI.reset();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();$('base').hidden=true;$('auth').hidden=false;$('login').reset();$('identity').textContent='';
 for(const id of ['stash','records','partyRoster','contracts','insurance','overflow','trader','workshop','upgrades','installedMods','primaryWeapon','weaponSlots','basePreviewCaption','presetStatus','riskSummary','stashCapacity','readyMismatch','pack','hud','conditions','events','hint','interactionStatus'])$(id).replaceChildren();
 $('restoreReady').hidden=true;$('readyMismatch').hidden=true;latencyProof=null;$('latencyStatus').textContent='Check connection before deploying.';
 message(text+(wasAlive?' Your operator remains vulnerable in the raid. Sign in and reconnect to continue.':''));
}
async function validateSession(){
 if(authChecking||!profile)return;authChecking=true;const generation=authGeneration;try{const response=await fetch('/api/profile',{cache:'no-store'});if(response.status===401&&generation===authGeneration)await signedOut('Session expired or signed out from another device.')}catch{}finally{authChecking=false}
}

async function api(path,body,{timeoutMs=15000}={}){
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
function itemRow(it,parent,buttons=[]){const row=document.createElement('div');row.className='item';row.dataset.itemId=it.id;row.setAttribute('role','group');row.setAttribute('aria-label',label(it));const span=document.createElement('span');span.textContent=label(it);row.append(span,...buttons);parent.append(row);return row}
async function refresh(){
 const generation=authGeneration,updated=await api('profile');if(generation!==authGeneration)return;profile=updated;$('commsToggle').hidden=false;$('accountOpen').hidden=false;$('auth').hidden=true;$('base').hidden=false;$('identity').textContent=`${profile.username} · ${profile.credits} credits (${grantBalance(profile)} starter · ${profile.credits-grantBalance(profile)} earned)`;
 await baseUI.render(profile);if(generation!==authGeneration)return;
 $('resume').hidden=!profile.activeDeployment;$('deploy').disabled=!!profile.activeDeployment;
 const records=await api('results');if(generation!==authGeneration)return;$('records').replaceChildren();for(const r of records){
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=`${new Date(r.at).toLocaleString()} · ${r.outcome} · ${r.items.length} returned · ${(r.lostItems||[]).length} dropped/lost · +${r.credits} credits · +${r.xp||0} XP`;details.append(summary);
  if(r.progression){const progress=document.createElement('p'),p=r.progression;progress.textContent='Experience '+p.xpBefore+' → '+p.xpAfter+' XP · Rank '+p.rankBefore+' → '+p.rankAfter+' '+p.rankName+(p.unlockedBlueprints.length?' · Blueprints unlocked: '+p.unlockedBlueprints.join(', '):'');details.append(progress)}
  if(r.raid){const context=document.createElement('p');context.textContent=(getWorld(r.raid.map,r.raid.mapVersion)?.name||r.raid.map)+' · '+Math.round(r.raid.durationSeconds||0)+' seconds deployed';details.append(context)}
  for(const text of [reasonText(r),settlementText(r),insuranceText(r)]){const line=document.createElement('p');line.textContent=text;details.append(line)}
  const costs=document.createElement('p');costs.textContent=`Insurance premium ${r.insurancePremium||0}; refund ${r.refund||0}. ${r.facts?.roundsFired||0} rounds fired, ${r.facts?.medkitsUsed||0} medical supplies used, ${r.facts?.keysUsed||0} access keys used, ${r.facts?.utilitiesUsed||0} utilities thrown.${r.facts?.exitCosts?.length?' Exit access: '+r.facts.exitCosts.map(cost=>cost.exitId+' ('+cost.quantity+' '+(cost.material||cost.kind)+')').join(', ')+'.':''}${r.facts?.extractionExit?' Departed via '+r.facts.extractionExit+'.':''}`;details.append(costs);if(r.facts?.healthDamageTaken||r.facts?.damageAbsorbed||r.facts?.damageDealt){const damage=document.createElement('p');damage.textContent='Damage dealt '+Math.round(r.facts.damageDealt||0)+' · shots hit '+(r.facts.shotsHit||0)+'/'+(r.facts.roundsFired||0)+' · health damage '+Math.round(r.facts.healthDamageTaken||0)+' · armor absorbed '+Math.round(r.facts.damageAbsorbed||0)+' · bleeding wounds '+(r.facts.bleedingWounds||0)+' · leg injuries '+(r.facts.legWounds||0)+(r.facts.pelletsFired>(r.facts.roundsFired||0)?' · pellets hit '+(r.facts.pelletsHit||0)+'/'+r.facts.pelletsFired:'');details.append(damage)}if(r.contracts?.length){const progress=document.createElement('p');progress.textContent='Contract progress this raid: '+r.contracts.map(c=>c.name+' stage '+(c.stage+1)+': +'+c.delta+' → '+c.progress+'/'+c.need+(c.requirementsMet?' (requirements met)':'')).join('; ');details.append(progress)}
  for(const [name,items]of [...(r.committedItems?[['Committed loadout (deployment snapshot)',r.committedItems]]:[]),['Banked / protected overflow',r.items],['Dropped or lost',r.lostItems||[]]]){const title=document.createElement('strong');title.textContent=name;details.append(title);const list=document.createElement('ul');for(const it of items){const entry=document.createElement('li');entry.textContent=label(it)+(it.recovery?' · temporary recovery kit (not bankable)':'')+(r.overflow?.includes(it.id)?' · overflow storage':'')+((r.insuranceAtSettlement||[]).some(c=>c.item===it.id)?' · insured (see claim status above)':'');list.append(entry)}details.append(list)}
  $('records').append(details);
 }
 await refreshParty();if(generation!==authGeneration)return;await comms.refresh();
}
function selectedLoadout(){const recovery=$('recovery').checked,raw=[...$('stash').querySelectorAll('input[data-equip]:checked')].map(e=>e.value),ordered=baseUI?.orderedIds(raw)||raw;return {recovery,itemIds:recovery?[]:ordered,insureIds:recovery?[]:[...$('stash').querySelectorAll('input[data-insure]:checked')].map(e=>e.value)}}
baseUI=baseController({api,run,button,label,getProfile:()=>profile,refresh,selectedLoadout,onLoadoutChanged:unready,chooseQuantity,onInspect:inspect,onSelectionChanged:()=>{awaitingParty=false;updateReadyMismatch()},onPreviewLoadout:loadout=>{previewLoadout=loadout;preview?.setLoadout(loadout)}});
function updateReadyMismatch(){const member=party?.members.find(m=>m.account===profile?.id),mismatch=!!(member?.ready&&!profile?.activeDeployment&&!sameLoadout(member.loadout,selectedLoadout()));$('readyMismatch').hidden=!mismatch;$('restoreReady').hidden=!mismatch;$('readyMismatch').textContent=mismatch?'Your current selection differs from your readied loadout. Ready again or restore it before deploying.':'';if(mismatch)$('deploy').disabled=true;return mismatch}
$('restoreReady').onclick=()=>run(async()=>{const account=profile?.id;await refresh();if(profile?.id!==account)return;const member=party?.members.find(m=>m.account===account);if(!member?.ready||profile.activeDeployment)throw new Error('The readied loadout is no longer available. Review your squad.');if((member.loadout.itemIds||[]).some(id=>!profile.items.some(it=>it.id===id)))throw new Error('Readied equipment is no longer in your stash. Select equipment and ready again.');baseUI.selectLoadout(member.loadout);await refreshParty()});
function selectedMatch(){return matchPreferences(party?.match??{allowMixed:$('allowMixed').checked,maxRttMs:Number($('maxRtt').value)})}
async function measureLatency(){
 const generation=authGeneration,account=profile?.id;if(!account)throw new Error('Sign in to check your connection');if(probeWork?.generation===generation&&probeWork?.account===account)return probeWork.promise;
 const task={generation,account};task.promise=(async()=>{const challenge=await api('matchmaking',{operation:'probe'});if(authGeneration!==generation||profile?.id!==account)throw new Error('Connection check canceled after sign-out');const measured=await api('matchmaking',{operation:'measure',nonce:challenge.nonce});if(authGeneration!==generation||profile?.id!==account)throw new Error('Connection check canceled after sign-out');latencyProof={...measured,at:performance.now(),generation,account};const limit=selectedMatch().maxRttMs;$('latencyStatus').textContent='Server-measured round trip: '+measured.rttMs+' ms'+(limit&&measured.rttMs>limit?' · above your limit; change the limit or try again.':' · checked just now.');return latencyProof})().finally(()=>{if(probeWork===task)probeWork=null});probeWork=task;return task.promise;
}
$('checkLatency').onclick=()=>run(measureLatency);
for(const id of ['allowMixed','maxRtt'])$(id).addEventListener('change',()=>{latencyProof=null;if(party)return run(async()=>{const match=matchPreferences({allowMixed:$('allowMixed').checked,maxRttMs:Number($('maxRtt').value)});await api('party',{type:'configure',match});awaitingParty=false;await refreshParty();message('Squad preferences changed. Everyone must ready again.')});renderMatchSummary()});
function renderMatchSummary(){const match=selectedMatch(),size=party?.members.length||1;$('matchSummary').textContent='Connected region: '+(matchInfo?.region||'checking')+'. '+size+' operator'+(size===1?'':'s')+' · 10-minute raid · up to 9 operators. Same-size squads preferred; '+(match.allowMixed?'mixed-size fallback allowed.':'same-size sessions only.')+' Gear/skill matching is open. If no safe compatible session exists, a fresh raid starts without a minimum human population. Conditions are assigned by the selected raid.'}
async function refreshParty(){
 const generation=authGeneration,updated=await api('party');if(generation!==authGeneration)return;party=updated;if(!matchInfo)matchInfo=await api('matchmaking');if(generation!==authGeneration)return;for(const id of ['allowMixed','maxRtt'])$(id).disabled=!!party&&party.leader!==profile.id;if(party){$('allowMixed').checked=party.match?.allowMixed??true;$('maxRtt').value=String(party.match?.maxRttMs??0)}renderMatchSummary();$('partyState').textContent=party?`Invite ${party.id} · ${party.mode} · ${party.region}`:'Playing solo.';
 $('partyRoster').replaceChildren();
 for(const m of party?.members||[]){const p=document.createElement('p');p.textContent=`${m.username}${m.account===party.leader?' · leader':''} · ${m.ready?'READY':'preparing'}${m.latency?.rttMs!=null?' · '+m.latency.rttMs+' ms':''}${m.ready&&!m.latency?.withinLimit?' · needs connection check':''}${m.ready?' · '+(m.loadout.recovery?'free recovery kit':m.loadout.itemIds.length+' owned items'):''}${m.readinessError?' · '+m.readinessError:''}`;$('partyRoster').append(p)}
 comms.update(inRaid?snapshot:null,party);
 $('partyCreate').hidden=!!party;$('partyJoin').hidden=!!party;$('partyReady').hidden=!party;$('partyLeave').hidden=!party;
 $('map').disabled=!!party;if(party)$('map').value=party.mapId;drawMap($('mapPreview'),$('map').value);
 $('deploy').textContent=party?'Deploy ready squad':'Deploy selected equipment';
 $('deploy').disabled=!!profile.activeDeployment||!!(party&&(party.leader!==profile.id||!party.members.every(m=>m.ready&&m.latency?.withinLimit!==false)));updateReadyMismatch();
}
$('partyCreate').onclick=()=>run(async()=>{const info=await api('capabilities');await api('party',{type:'create',mode:$('partyMode').value,region:info.region,mapId:$('map').value,match:selectedMatch()});await refreshParty()});
$('partyJoin').onclick=()=>run(async()=>{await api('party',{type:'join',code:$('partyCode').value.trim()});await refreshParty()});
$('partyLeave').onclick=()=>run(async()=>{await api('party',{type:'leave'});awaitingParty=false;await refreshParty()});
$('partyReady').onclick=()=>run(async()=>{const generation=authGeneration,account=profile?.id,measured=selectedMatch().maxRttMs?await measureLatency():null;
 try{await api('party',{type:'ready',ready:true,loadout:selectedLoadout(),latencyProof:measured?.proofId})}catch(error){awaitingParty=false;if(error.status===409&&generation===authGeneration&&profile?.id===account)await refresh();throw error}
 if(generation!==authGeneration||profile?.id!==account)return;awaitingParty=true;await refreshParty()});
async function unready(){awaitingParty=false;updateReadyMismatch();if(party?.members.find(m=>m.account===profile.id)?.ready){$('deploy').disabled=true;await api('party',{type:'ready',ready:false,loadout:selectedLoadout()});await refreshParty()}}
$('stash').addEventListener('change',()=>run(unready));$('recovery').addEventListener('change',()=>run(unready));
let partyPolling=false;
setInterval(async()=>{if(!profile||inRaid||partyPolling||busy)return;partyPolling=true;try{const generation=authGeneration,wasActive=profile.activeDeployment,updated=await api('profile');if(generation!==authGeneration||!profile)return;profile.activeDeployment=updated.activeDeployment;if(!wasActive&&updated.activeDeployment)baseUI.risk();$('resume').hidden=!profile.activeDeployment;if(wasActive&&!updated.activeDeployment){await refresh();message('Raid settled. Review your item losses and rewards below.')}else await refreshParty();if(generation!==authGeneration||!profile)return;if(!profile.activeDeployment&&party?.members.find(m=>m.account===profile.id)?.ready&&selectedMatch().maxRttMs&&(!latencyProof||latencyProof.generation!==authGeneration||performance.now()-latencyProof.at>8000))await measureLatency();if(generation!==authGeneration||!profile)return;if(awaitingParty&&profile.activeDeployment){const resumed=await api('raid');if(generation!==authGeneration||!profile||inRaid)return;snapshot=resumed;awaitingParty=false;start()}}catch(e){message(e.message)}finally{partyPolling=false}},2000);
async function auth(register){const data=Object.fromEntries(new FormData($('login')));await api(register?'register':'login',data);authGeneration++;$('login').reset();message('Signed in.');await refresh()}
$('login').onsubmit=e=>{e.preventDefault();run(()=>auth(false))};$('register').onclick=()=>run(()=>auth(true));
$('logout').onclick=()=>run(async()=>{await api('logout',{});await signedOut('Signed out.')});
for(const w of RAID_WORLDS){const o=document.createElement('option');o.value=w.id;o.textContent=w.name;$('map').append(o)}
$('deploy').onclick=()=>run(async()=>{const generation=authGeneration,measured=selectedMatch().maxRttMs?await measureLatency():null;if(generation!==authGeneration||!profile)throw new Error('Deployment canceled after account change');const deployed=await api('deploy',{protocol:RAID_PROTOCOL,requestId:crypto.randomUUID(),mapId:$('map').value,match:selectedMatch(),latencyProof:measured?.proofId,...selectedLoadout()});if(generation!==authGeneration||!profile)return;snapshot=deployed;awaitingParty=false;start()});
$('resume').onclick=()=>run(async()=>{const generation=authGeneration,resumed=await api('raid');if(generation!==authGeneration||!profile)return;snapshot=resumed;start()});
let packKey='',frame=0,controlsDisabled=false;
function stopHeldInput(){aimMouse=aimTouch=aiming=false;$('aim').setAttribute('aria-pressed','false');trigger?.clear();comms.voice.quiet();if(inRaid&&snapshot?.self.alive&&wire&&!wire.closed&&wire.actor.deploymentId===snapshot.self.deploymentId)wire.send({type:'move',x:0,z:0,yaw,pitch}).catch(()=>{})}
function sendHeldMovement(){if(inRaid&&snapshot?.self.alive&&wire&&!wire.closed&&wire.actor.deploymentId===snapshot.self.deploymentId)wire.send(()=>({type:'move',...movementInput(),yaw,pitch})).catch(()=>{})}
function start(){
 if(snapshot.protocol!==RAID_PROTOCOL)throw new Error('Client update required. Reload to reconnect safely.');
 if(!getWorld(snapshot.map,snapshot.mapVersion===undefined?1:snapshot.mapVersion))throw new Error('Map update required. Reload to reconnect safely.');
 wire?.close();stateAt=performance.now();controlsDisabled=false;inRaid=true;raidGeneration++;document.body.dataset.inRaid='true';lastHealth=snapshot.self.hp;lastOutcome='';lastBoard=false;document.querySelector('main').inert=true;seq=snapshot.self.seq;yaw=snapshot.self.yaw;pitch=snapshot.self.pitch||0;input.clear();$('play').style.display='block';
 view||=new RaidView($('view'));view.start(snapshot);view.applySettings(preferences.get());prediction=new LocalPrediction(snapshot);wire?.close();const generation=raidGeneration;wire=new ReliableActions({state:snapshot,request:packet=>api('action',packet,{timeoutMs:2500}),onState:(state,network)=>{if(!inRaid||generation!==raidGeneration)return;snapshot=state;stateAt=performance.now();seq=state.self.seq;prediction?.reconcile(state,network);updateUI()},onNetwork:network=>{if(inRaid&&generation===raidGeneration)$('networkStatus').textContent=network.status==='connected'?'Connected · '+Math.round(network.rttMs/10)*10+' ms RTT':network.status==='retrying'?'Connection interrupted · retrying safely':network.status==='update_required'?'Client update required · reload to reconnect safely':'Connection lost · movement prediction paused'}});setPack(!matchMedia('(pointer:coarse)').matches);packKey='';seenEvents.clear();$('events').textContent='';$('view').focus();updateUI();
}
let lastFrame=0;
function renderFrame(time){
 const dt=Math.min(.2,(time-lastFrame)/1000||.016);lastFrame=time;aiming=!!(inRaid&&snapshot?.self.alive&&!snapshot.self.downed&&snapshot.self.weaponId&&!weaponWork&&!preferences.isModal()&&$('communications').hidden&&(aimMouse||aimTouch||input.held('aim')));$('aim').setAttribute('aria-pressed',String(aiming));$('play').dataset.aiming=String(aiming);trigger.hold('keyboard',input.held('fire'));trigger.tick();if(inRaid&&!preferences.isModal()&&$('communications').hidden){yaw-=(Number(input.held('lookRight'))-Number(input.held('lookLeft')))*dt*1.7*(aiming?.45:1);pitch=Math.max(-1.2,Math.min(1.2,pitch+(Number(input.held('lookUp'))-Number(input.held('lookDown')))*dt*1.4*(aiming?.45:1)))}
 frame=requestAnimationFrame(renderFrame);
 if(inRaid)view?.frame(time,yaw,pitch,prediction?.frame(movementInput(),time),aiming);
 else if(profile&&!$('base').hidden){preview||=new BasePreview($('basePreview'));preview.setLoadout(previewLoadout);preview.applySettings(preferences.get());preview.frame(time,true)}
}
requestAnimationFrame(renderFrame);
const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
const seenEvents=new Set();let spectateId='';
$('spectate').onclick=()=>{const teammates=snapshot.players.filter(p=>p.team===snapshot.self.team);if(!teammates.length)return;const i=teammates.findIndex(p=>p.id===(spectateId||snapshot.camera?.follow));spectateId=teammates[(i+1)%teammates.length].id};
function updateUI(){
 if(!snapshot)return;const s=snapshot.self,disabled=!s.alive||s.downed;if(disabled&&!controlsDisabled)input.clear();controlsDisabled=disabled;comms.update(snapshot);
 $('fire').disabled=!s.weaponId;$('reload').disabled=!s.weaponId;
 $('hud').textContent=`${s.downed?'DOWNED · bleed '+Math.ceil(s.bleedLeft)+'s':'HP '+Math.max(0,Math.ceil(s.hp))}${s.armor?' · Armor '+Math.ceil(s.armor.protection)+'/'+s.armor.capacity:''}${s.wounds?.bleedingUntil>snapshot.serverTime?' · BLEEDING':''}${s.wounds?.limpUntil>snapshot.serverTime?' · LEG INJURY':''} · ${s.weaponId?'Ammo '+s.ammo:'UNARMED'} · ${Math.ceil(snapshot.left)}s · Pack ${s.pack.length}/${s.cap} · ${(s.weight||0).toFixed(1)}/${s.weightCap||40} kg`;
 view?.sync(snapshot);$('spectate').hidden=s.alive||!snapshot.camera;if(snapshot.camera)$('spectate').textContent='Watching '+snapshot.camera.name+' · next squadmate';
 for(const event of snapshot.events||[])if(!seenEvents.has(event.id)){
  seenEvents.add(event.id);$('events').textContent=event.text||event.message||event.kind||event.type;view?.audio.play('warning');
 }
 if(seenEvents.size>200){const recent=[...seenEvents].slice(-100);seenEvents.clear();for(const id of recent)seenEvents.add(id)}
 $('conditions').textContent=`${RAID_WORLDS.find(w=>w.id===snapshot.map)?.name||snapshot.map} · ${snapshot.conditions?.clock? snapshot.conditions.clock+' · ':''}${snapshot.conditions?.name||snapshot.conditions?.weather||'clear'}`;
 drawMap($('minimap'),snapshot.map,snapshot);
 const sources=[...snapshot.caches,...snapshot.bags].filter(c=>distance(c,s)<3);
 const downed=snapshot.players.filter(p=>p.team===s.team&&p.downed&&(distance(p,s)<=2||p.rescue?.carriedByYou));
 nearest=[...sources.map(c=>({...c,source:true})),...snapshot.exits.filter(e=>distance(e,s)<4)].sort((a,b)=>distance(a,s)-distance(b,s))[0];
 updateInteraction(s);
 const nextPackKey=JSON.stringify([s.alive,s.downed,s.weaponId,s.equipment,s.pack,s.secure,sources.map(c=>[c.id,c.open,c.items]),downed.map(p=>[p.id,p.name,p.rescue]),[...s.equipment,...s.pack].filter(it=>it.kind==='med').map(it=>s.combatVersion!==2||!!medicalNeed(s,it,snapshot.serverTime)&&snapshot.serverTime>=s.nextMedicalAt)]);
 if(nextPackKey!==packKey){packKey=nextPackKey;renderPack(s,sources,downed)}
 for(const exit of snapshot.exits){const text=$('pack').querySelector('[data-exit="'+exit.id+'"]');if(text)text.textContent=(exit.name||exit.kind)+': '+exitDescription(exit,snapshot.serverTime)}
 $('hint').textContent=performance.now()<notice.until?notice.text:s.result?`${s.result.outcome.toUpperCase()} · ${s.result.items.length} items returned. Use Back to base.`:nearest?nearest.source?`${keyName(preferences.get().bindings.interact)} / Interact: search ${nearest.label||nearest.id}`:`${keyName(preferences.get().bindings.interact)} / Interact: ${nearest.kind} exit · ${exitDescription(nearest,snapshot.serverTime)}`: 'Move / aim · '+keyName(preferences.get().bindings.fire)+' fire · '+keyName(preferences.get().bindings.interact)+' interact · '+keyName(preferences.get().bindings.pack)+' backpack · '+keyName(preferences.get().bindings.help)+' field guide';
}
async function chooseRaidQuantity(type,it,extra={}){const generation=raidGeneration,deployment=snapshot?.self.deploymentId,quantity=await chooseQuantity({label:(type==='take'?'Take ':'Split ')+label(it),max:type==='take'?it.quantity:it.quantity-1,initial:type==='take'?1:Math.floor(it.quantity/2)});if(quantity==null||!inRaid||generation!==raidGeneration||deployment!==snapshot?.self.deploymentId)return;return action({type,itemId:it.id,quantity,...extra})}
function renderPack(s,sources,downed){
 const priorFocus=inventoryFocus($('pack'));
 $('pack').replaceChildren();const title=document.createElement('strong');title.textContent='Backpack '+s.pack.length+'/'+s.cap+' · protected '+s.secure.length+'/'+(s.secureCap??(s.cap===8?1:2));$('pack').append(title);
 for(const it of [...s.equipment,...s.pack]){
  const controls=[button('Inspect',()=>inspect(it))];
  if(it.kind==='utility')controls.push(button('Throw toward aim',()=>throwHeldUtility(it)));
  if(it.kind==='med'){const use=button('Use',()=>action({type:'use',itemId:it.id}));use.disabled=s.downed||!s.alive||s.combatVersion===2&&(!medicalNeed(s,it,snapshot.serverTime)||snapshot.serverTime<s.nextMedicalAt);controls.push(use)}
  if(it.kind==='armor'&&s.combatVersion===2)controls.push(button(s.equipment.some(e=>e.id===it.id)?'Remove armor':'Wear armor',()=>action({type:s.equipment.some(e=>e.id===it.id)?'removeArmor':'wear',...(s.pack.some(e=>e.id===it.id)?{itemId:it.id}:{})})));
  if(it.kind==='weapon'&&it.id!==s.weaponId)controls.push(button('Equip',()=>action({type:'equip',itemId:it.id})));
  if(!(it.kind==='armor'&&s.equipment.some(p=>p.id===it.id)))controls.push(button('Drop',()=>action({type:'drop',itemId:it.id})));
  if(stackable(it)&&it.quantity>1)controls.push(button('Split stack',()=>chooseRaidQuantity('split',it)));
  if(s.pack.some(p=>p.id===it.id)){
   if(['key','material','valuable','med','mod'].includes(it.kind)&&!it.recovery)controls.push(button('Secure',()=>action({type:'secure',itemId:it.id})));
   const target=s.pack.find(p=>p.id!==it.id&&compatibleStacks(p,it));
   if(target&&['med','material','ammo','utility'].includes(it.kind))controls.push(button('Merge stack',()=>action({type:'stack',itemId:it.id,targetId:target.id})));
  }
  itemRow(it,$('pack'),controls);
 }
 for(const it of s.secure){const controls=[button('Inspect',()=>inspect(it)),button('Move to backpack',()=>action({type:'unsecure',itemId:it.id}))];if(stackable(it)&&it.quantity>1)controls.push(button('Split to backpack',()=>chooseRaidQuantity('split',it)));itemRow(it,$('pack'),controls)}
 for(const p of downed){
  const row=document.createElement('div');row.dataset.rescue=p.id;row.setAttribute('role','group');row.setAttribute('aria-label',(p.name||'Squadmate')+' rescue controls');row.textContent=(p.name||'Squadmate')+' · DOWNED';const revive=button('Revive',()=>action({type:'revive',targetId:p.id})),carry=button(p.rescue?.carriedByYou?'Drop squadmate':'Carry squadmate',()=>action({type:'carry',targetId:p.id}));revive.dataset.rescueAction='revive';carry.dataset.rescueAction='carry';revive.disabled=!s.alive||s.downed||p.rescue?.revive===false;carry.disabled=!s.alive||s.downed||p.rescue?.carry===false;row.append(revive,carry);if(p.rescue&&!p.rescue.revive&&!p.rescue.carry){const reason=document.createElement('small');reason.textContent='Move within 2 m with clear access. Only one operator can carry a squadmate.';row.append(reason)}$('pack').append(row);
 }
 for(const c of sources){const heading=document.createElement('p');heading.textContent=(c.label||'Loot bag')+(c.open?' · searched':' · unsearched');$('pack').append(heading);if(!c.open&&!snapshot.bags.some(b=>b.id===c.id))$('pack').append(button('Search '+(c.label||'cache'),()=>action({type:'search',sourceId:c.id})));for(const it of c.items){const controls=[button('Inspect',()=>inspect(it)),button('Take',()=>action({type:'take',sourceId:c.id,itemId:it.id}))];if(stackable(it)&&it.quantity>1)controls.push(button('Take amount',()=>chooseRaidQuantity('take',it,{sourceId:c.id})));if(!canRecoverGrant(it,profile.id))for(const control of controls.slice(1)){control.disabled=true;control.title='Starter supplies can only be recovered by their original operator'}itemRow(it,$('pack'),controls)}}
 const exitTitle=document.createElement('h3');exitTitle.textContent='Extraction sites';$('pack').append(exitTitle);for(const exit of snapshot.exits){const text=document.createElement('p');text.dataset.exit=exit.id;$('pack').append(text)}restoreInventoryFocus($('pack'),priorFocus);
}
function movementInput(){const forward=Number(input.held('forward'))-Number(input.held('back')),side=Number(input.held('right'))-Number(input.held('left'));return {x:Math.sin(yaw)*forward-Math.cos(yaw)*side,z:Math.cos(yaw)*forward+Math.sin(yaw)*side}}
async function action(data){
 if(!inRaid||!wire)throw new Error('Raid input canceled after leaving this session.');
 const actor=wire,generation=raidGeneration;
 const send=async()=>{
  const result=await actor.send(data);
  if(inRaid&&wire===actor&&raidGeneration===generation){
   const caption={reload:'Reloading. Wait for the weapon cooldown.',equip:'Weapon equipped.',search:'Searching. Keep still.',take:'Item recovered.',use:'Medical supplies used.'}[data?.type];
   if(caption){view?.audio.play(data.type);$('statusAnnouncement').textContent=caption;if(preferences.get().captions)$('events').textContent=caption}
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
async function interact(){if(!nearest)return;if(nearest.source){setPack(true);return action({type:'search',sourceId:nearest.id})}const now=snapshot.serverTime;return action({type:nearest.openAt<=now&&nearest.closeAt>now?'extract':['key','resource'].includes(nearest.kind)?'unlock':nearest.kind==='call'?'call':'extract',exitId:nearest.id})}
setInterval(async()=>{
 if(!inRaid||tickBusy)return;tickBusy=true;const generation=raidGeneration;
 try{
  if(snapshot.self.alive){if(!deferIdleMovement({input:movementInput(),confirmed:snapshot.self.move,engaged:trigger.engaged,sampleAgeMs:performance.now()-stateAt}))await action(()=>({type:'move',...movementInput(),yaw,pitch}))}
  else{const updated=await api('raid'+(spectateId?'?spectate='+encodeURIComponent(spectateId):''));if(!inRaid||generation!==raidGeneration)return;snapshot=updated;stateAt=performance.now();prediction?.reconcile(updated);updateUI()}

 }catch(e){if(inRaid&&!snapshot?.self.result)$('hint').textContent=e.message}finally{tickBusy=false}
},150);

function controlAction(kind){
 if(kind==='settings')return preferences.open();if(kind==='help')return $('helpOpen').click();if(kind==='communications')return $('commsToggle').click();if(kind==='pack')return setPack($('pack').hidden,true);
 if(kind==='status'){$('statusAnnouncement').textContent=$('hud').textContent+'. '+$('conditions').textContent+'. '+$('hint').textContent+'. '+$('interactionStatus').textContent+'. '+$('networkStatus').textContent;return}
 if(kind==='ping')return run(()=>action({type:'ping',kind:$('pingKind').value}));
 if(kind==='fire')return trigger.press('keyboard');if(kind==='jump'){prediction?.jump();return run(()=>action({type:'jump'}))}if(kind==='reload')return run(()=>action({type:kind}));if(kind==='interact')return run(interact);
 const items=[...snapshot.self.equipment,...snapshot.self.pack];if(kind==='slot1'||kind==='slot2'){const item=items.filter(i=>i.kind==='weapon')[kind==='slot1'?0:1];if(item)run(()=>action({type:'equip',itemId:item.id}))}
 if(kind==='utility')return run(()=>throwHeldUtility(items.find(i=>i.kind==='utility')));
 if(kind==='heal'){const item=items.find(i=>i.kind==='med'&&(snapshot.self.combatVersion!==2||medicalNeed(snapshot.self,i,snapshot.serverTime)));if(item)run(()=>action({type:'use',itemId:item.id}))}
}
function setPack(open,focus=false){$('play').dataset.packOpen=String(open);if(open)input.clear();$('pack').hidden=!open;$('packToggle').setAttribute('aria-expanded',String(open));$('packToggle').textContent=(open?'Hide backpack':'Backpack')+' / '+keyName(preferences.get().bindings.pack);if(focus){if(open)($('pack').querySelector('button')||$('pack')).focus();else $('view').focus()}}
$('packToggle').onclick=()=>setPack($('pack').hidden,true);
$('view').onclick=e=>{if(e.pointerType==='touch'||preferences.isModal()||!$('communications').hidden)return;if(inRaid){if(document.pointerLockElement!==$('view')){const request=$('view').requestPointerLock();request?.catch(()=>{notice={text:'Mouse capture was unavailable. Use arrow keys, touch aim, or click the view to retry.',until:performance.now()+5000}})}}};
addEventListener('mousemove',e=>{if(document.pointerLockElement===$('view'))aim(e.movementX,e.movementY,.003)});
function aim(dx,dy,multiplier){const settings=preferences.get();if(aiming)multiplier*=view?.camera.fov/settings.fov||.45;({yaw,pitch}=aimDelta({yaw,pitch},dx*multiplier,dy*multiplier,settings))}
$('jump').onclick=()=>controlAction('jump');
$('fire').onclick=e=>{if(e.detail===0)trigger.tap()};$('reload').onclick=()=>run(()=>action({type:'reload'}));$('interact').onclick=()=>run(interact);
$('leave').onclick=()=>run(async()=>{const alive=snapshot.self.alive;inRaid=false;wire?.close();wire=null;prediction=null;raidGeneration++;document.body.dataset.inRaid='false';document.querySelector('main').inert=false;await comms.voice.leave();comms.update(null);input.clear();document.exitPointerLock?.();$('play').style.display='none';view?.clear();snapshot=null;message(alive?'Your operator remains in the raid. Reconnect within 45 seconds to continue.':'Raid recorded.');await refresh()});
busy=true;document.body.setAttribute('aria-busy','true');try{await refresh()}catch(error){message(error.status===401?'Sign in or create an account.':error.message)}finally{busy=false;document.body.setAttribute('aria-busy','false')}

$('aim').onclick=()=>{if(inRaid&&snapshot?.self.alive&&!snapshot.self.downed)aimTouch=!aimTouch};
$('view').addEventListener('contextmenu',e=>e.preventDefault());
$('view').addEventListener('pointerdown',e=>{if(e.button===2&&document.pointerLockElement===$('view')){e.preventDefault();aimMouse=true}});
addEventListener('pointerup',e=>{if(e.button===2)aimMouse=false});$('view').addEventListener('pointercancel',()=>{aimMouse=false});
for(const element of [$('fire'),$('view')]){
 element.addEventListener('pointerdown',e=>{if(e.button!==0||element===$('view')&&(e.pointerType==='touch'||document.pointerLockElement!==$('view')))return;if(!inRaid||preferences.isModal()||!$('communications').hidden)return;e.preventDefault();if(element!==$('view'))element.setPointerCapture?.(e.pointerId);trigger.press('pointer:'+e.pointerId)});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>trigger.release('pointer:'+e.pointerId));
}
addEventListener('pointerup',e=>trigger.release('pointer:'+e.pointerId));
let look=null;
$('view').addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();look={id:e.pointerId,x:e.clientX,y:e.clientY};$('view').setPointerCapture(e.pointerId);view?.audio.resume()}});
$('view').addEventListener('pointermove',e=>{if(preferences.isModal()||!$('communications').hidden){look=null;return}if(look?.id===e.pointerId){aim(e.clientX-look.x,e.clientY-look.y,.006);look={id:e.pointerId,x:e.clientX,y:e.clientY}}});
for(const type of ['pointerup','pointercancel'])$('view').addEventListener(type,()=>look=null);
function drawMap(canvas,id,state){
 const world=state?getWorld(id,state.mapVersion===undefined?1:state.mapVersion):RAID_WORLDS.find(w=>w.id===id);if(!world)return;
 const ctx=canvas.getContext('2d'),n=canvas.width,k=n/world.size;ctx.fillStyle='#172c32';ctx.fillRect(0,0,n,n);ctx.save();ctx.translate(n/2,n/2);ctx.scale(k,k);
 ctx.fillStyle='#6b7e7e';for(const [x,z,w,d]of world.blocks)ctx.fillRect(x-w/2,z-d/2,w,d);
 const point=(x,z,color,r)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,r,0,Math.PI*2);ctx.fill()};
 for(const exit of state?.exits||world.exits){point(exit.x,exit.z,state?'#'+exitColor(exit,state.serverTime).toString(16).padStart(6,'0'):'#83efc2',2);ctx.fillStyle='#fff';ctx.font='5px system-ui';ctx.fillText('E',exit.x+2,exit.z)}
 if(state){for(const p of state.players.filter(p=>p.team===state.self.team))point(p.x,p.z,'#77c5ff',1.7);for(const ping of state.pings||[]){point(ping.x,ping.z,'#f3b9ff',2);ctx.fillStyle='#fff';ctx.font='5px system-ui';ctx.fillText(ping.kind==='danger'?'!':ping.kind==='needAmmo'?'A':ping.kind==='needMed'?'+':'P',ping.x+2,ping.z)}point(state.self.x,state.self.z,'#ffcf61',2.1)}
 ctx.restore();
}
function deploymentExitPlan(){const world=getWorld($('map').value),sector=SECTORS[world.id],artifact=ARTIFACTS[sector.artifact];$('sectorPlan').textContent=sector.summary+' Recovery objective: '+artifact.name+' at '+artifact.site+'. Light and weather change during the raid; check the sector clock after deployment.';$('exitPlan').replaceChildren();for(const exit of createRaidExits(world,0)){const line=document.createElement('p');line.textContent=exit.name+': '+exitDescription(exit,0);$('exitPlan').append(line)}}
$('map').addEventListener('change',()=>{drawMap($('mapPreview'),$('map').value);deploymentExitPlan()});deploymentExitPlan();
drawMap($('mapPreview'),$('map').value);

let lastHealth=100,lastOutcome='',lastBoard=false,lastWounds='';
function updateInteraction(s){
 const searching=snapshot.caches.find(c=>c.searchRemaining!=null),text=s.board?'Boarding · '+Math.max(0,Math.ceil(s.board.until-snapshot.serverTime))+'s · keep still in the exit':s.reviving?'Reviving squadmate · '+Math.max(0,Math.ceil(s.reviving.until-snapshot.serverTime))+'s · keep still':searching?'Searching '+searching.label+' · '+Math.ceil(searching.searchRemaining)+'s · keep still':s.downed?'Downed · wait for a squadmate to revive or carry you':'';
 if($('interactionStatus').textContent!==text)$('interactionStatus').textContent=text;
 if(s.hp<lastHealth){if(preferences.get().captions)$('events').textContent='Taking damage · '+Math.max(0,Math.ceil(s.hp))+' health';if(s.hp<=30||s.downed)$('statusAnnouncement').textContent=s.downed?'You are downed. Call for help.':'Low health. '+Math.ceil(s.hp)+' remaining.'}
 const wounds=s.alive&&!s.downed?[s.wounds?.bleedingUntil>snapshot.serverTime?'Bleeding: use a dressing or medkit.':'',s.wounds?.limpUntil>snapshot.serverTime?'Leg injury: use a splint or trauma pack.':''].filter(Boolean).join(' '):'';if(wounds&&wounds!==lastWounds){$('statusAnnouncement').textContent=wounds;if(preferences.get().captions)$('events').textContent=wounds}else if(!wounds&&lastWounds&&s.alive&&!s.downed){$('statusAnnouncement').textContent='No active bleeding or leg injury.';if(preferences.get().captions)$('events').textContent='No active bleeding or leg injury.'}lastWounds=wounds;
 if(s.result?.outcome&&s.result.outcome!==lastOutcome){lastOutcome=s.result.outcome;$('statusAnnouncement').textContent='Raid '+lastOutcome+'. Back to base is available.';$('leave').focus()}
 if(!!s.board!==lastBoard){lastBoard=!!s.board;$('statusAnnouncement').textContent=s.board?'Boarding started. Stay in the exit.':'Boarding ended.'}
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
