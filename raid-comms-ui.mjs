import {PING_TYPES,REPORT_REASONS} from './shared/raid-comms.mjs';
import {RaidVoice} from './raid-voice.mjs';
export function communicationUI({api,run,button,getProfile,action,getRaid}){
 const $=id=>document.getElementById(id);let prefs={controls:[],scope:'squad'},voicePeers=[],people=new Map(),rosterKey='';
 const voice=new RaidVoice({api,accountId:()=>getProfile()?.id,onStatus:text=>{if($('voiceStatus').textContent!==text)$('voiceStatus').textContent=text;$('voiceEnable').textContent=voice.joined||voice.starting?'Disable voice':'Enable voice';$('voiceScope').disabled=voice.joined||voice.starting},onPeers:peers=>{voicePeers=peers;render()}});
 for(const [value,label]of Object.entries(PING_TYPES)){const o=document.createElement('option');o.value=value;o.textContent=label;$('pingKind').append(o)}
 for(const value of REPORT_REASONS){const o=document.createElement('option');o.value=value;o.textContent=value.replaceAll('_',' ');$('reportReason').append(o)}
 async function refresh(){const account=getProfile()?.id,updated=await api('social');if(getProfile()?.id!==account)return;prefs=updated;$('voiceScope').value=prefs.scope;render()}
 const control=id=>prefs.controls.find(c=>c.target===id);
 async function toggle(id,type){voice.closePeer(id);prefs=await api('social',{type,target:id});rosterKey='';render()}
 function report(id){const person=people.get(id);$('reportTarget').value=id;$('reportName').textContent=person?.name||'Player';$('reportDetail').value='';$('reportResult').textContent='';$('reportDialog').showModal()}
 function render(){
  const raid=getRaid();people=new Map();
  for(const p of raid?.squad||[])people.set(p.id,p);
  for(const p of raid?.players||[])if(!people.has(p.id))people.set(p.id,{...p,alive:true});
  for(const p of voicePeers)if(!people.has(p.id))people.set(p.id,{...p,voice:true});
  for(const p of prefs.controls)if(!people.has(p.target))people.set(p.target,{id:p.target,name:p.username,controlled:true});
  for(const p of (lastParty?.members||[]))if(!people.has(p.account))people.set(p.account,{id:p.account,name:p.username,preparing:true,ready:p.ready});
  people.delete(getProfile()?.id);
  const key=JSON.stringify([...people.values()].map(p=>[p.id,p.name,control(p.id)?.mode]));
  if(key!==rosterKey){rosterKey=key;$('commsRoster').replaceChildren();for(const p of people.values()){
   const row=document.createElement('div');row.className='item';row.dataset.person=p.id;row.setAttribute('role','group');row.setAttribute('aria-label',p.name+' communication controls');const text=document.createElement('span');row.append(text);
   const mode=control(p.id)?.mode;row.append(button(mode==='mute'?'Unmute':'Mute',()=>toggle(p.id,mode==='mute'?'unmute':'mute')),button(mode==='block'?'Unblock':'Block',()=>toggle(p.id,mode==='block'?'unblock':'block')),button('Report',()=>report(p.id)));$('commsRoster').append(row);
  }}
  for(const row of $('commsRoster').children){const p=people.get(row.dataset.person),vp=voicePeers.find(q=>q.id===p.id);row.firstChild.textContent=`${p.name} · ${p.controlled?'saved control':p.preparing?p.ready?'ready':'preparing':p.alive===false?p.outcome||'eliminated':p.downed?'DOWNED · '+Math.ceil(p.bleedLeft||0)+'s':p.boarding?'boarding':p.connected===false?'connection lost':Math.ceil(p.hp||100)+' HP'}${vp?' · '+vp.channel+' voice '+vp.state:''}${control(p.id)?' · '+control(p.id).mode+'d':''}`}
  const pings=raid?.pings||[],pingText=pings.map(p=>p.name+': '+PING_TYPES[p.kind]).join(' · ');if($('squadPings').textContent!==pingText)$('squadPings').textContent=pingText;
 }
 let lastParty=null;
 $('voiceEnable').onclick=()=>{if(voice.joined||voice.starting)voice.leave();else run(()=>voice.join($('voiceScope').value))};
 $('voiceScope').onchange=()=>run(async()=>{prefs=await api('social',{type:'preferences',scope:$('voiceScope').value})});
 $('voiceVolume').oninput=()=>voice.setVolume($('voiceVolume').value);
 $('voiceResume').onclick=()=>voice.resumeAudio();
 $('pushTalk').onpointerdown=e=>{e.preventDefault();$('pushTalk').setPointerCapture(e.pointerId);voice.setTalking(true,'touch')};
 $('pushTalk').onpointerup=$('pushTalk').onpointercancel=()=>voice.setTalking(false,'touch');
 $('sendPing').onclick=()=>run(()=>action({type:'ping',kind:$('pingKind').value}));
 $('reportCancel').onclick=()=>$('reportDialog').close();
 $('reportForm').onsubmit=e=>{e.preventDefault();run(async()=>{const result=await api('social',{type:'report',target:$('reportTarget').value,reason:$('reportReason').value,detail:$('reportDetail').value});$('reportResult').textContent='Report saved: '+result.reportId;})};
 function panel(open){$('communications').hidden=!open;$('commsToggle').setAttribute('aria-expanded',String(open));if(open){document.exitPointerLock?.();dispatchEvent(new Event('raidmenuopen'));$('voiceEnable').focus()}else $('commsToggle').focus()}
 $('commsToggle').onclick=()=>panel($('communications').hidden);$('commsClose').onclick=()=>panel(false);
 addEventListener('blur',()=>voice.quiet());document.addEventListener('visibilitychange',()=>{if(document.hidden)voice.quiet()});
 addEventListener('pagehide',()=>{voice.quiet();voice.leave()});
 return {voice,refresh,update(raid,party){if(party!==undefined)lastParty=party;$('pingControls').hidden=!raid;render()},async reset(){await voice.leave();prefs={controls:[],scope:'squad'};voicePeers=[];lastParty=null;rosterKey='';$('communications').hidden=true;$('commsToggle').hidden=true;render()}};
}
