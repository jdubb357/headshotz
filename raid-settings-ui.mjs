import {ACTIONS,DEFAULT_SETTINGS,normalizeSettings,rebind,keyName} from './shared/raid-settings.mjs';
const STORAGE='headshotz.raid.settings.v1';
export function settingsUI({onChange}){
 const $=id=>document.getElementById(id);let value;try{value=normalizeSettings(JSON.parse(localStorage.getItem(STORAGE)||'null'))}catch{value=normalizeSettings(null)}
 let capture=null,returnFocus=null;const media=matchMedia('(prefers-reduced-motion: reduce)');
 const effective=()=>({...value,reduced:value.reducedMotion==='on'||value.reducedMotion==='system'&&media.matches});
 function apply(){document.documentElement.style.setProperty('--hud-scale',value.hudScale);document.documentElement.dataset.reducedMotion=String(effective().reduced);document.documentElement.dataset.highContrast=String(value.highContrast);$('welcome').hidden=value.onboardingDismissed;onChange?.(effective());dispatchEvent(new Event('raidsettingschange'))}
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify(value));$('settingsStatus').textContent='Settings saved on this device.'}catch{$('settingsStatus').textContent='Browser storage unavailable. Settings apply for this visit.'}apply()}
 function render(){
  for(const [id,key]of Object.entries({sensitivity:'sensitivity',hudScale:'hudScale',fieldOfView:'fov',sfxVolume:'sfxVolume',settingsVoiceVolume:'voiceVolume'})){$(id).value=value[key];$(id+'Value').textContent=value[key]}
  $('invertY').checked=value.invertY;$('reduceMotion').value=value.reducedMotion;$('captions').checked=value.captions;$('highContrast').checked=value.highContrast;
  for(const b of $('bindings').querySelectorAll('[data-bind]')){b.textContent=keyName(value.bindings[b.dataset.bind]);b.setAttribute('aria-label',ACTIONS[b.dataset.bind]+': '+b.textContent+'. Change key')}
  for(const e of document.querySelectorAll('[data-key-label]'))e.textContent=keyName(value.bindings[e.dataset.keyLabel]);
 }
 for(const [action,name]of Object.entries(ACTIONS)){
  const row=document.createElement('div');row.className='binding';const label=document.createElement('span');label.textContent=name;const b=document.createElement('button');b.type='button';b.dataset.bind=action;b.onclick=()=>{capture=action;b.textContent='Press a key…';$('settingsStatus').textContent='Press a key for '+name+'. Escape cancels. Duplicate bindings swap places.'};row.append(label,b);$('bindings').append(row);
 }
 addEventListener('keydown',e=>{if(!capture)return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){capture=null;render();$('settingsStatus').textContent='Key change canceled.';return}if(e.repeat||e.ctrlKey||e.metaKey)return;try{value=rebind(value,capture,e.code);capture=null;render();save()}catch(error){$('settingsStatus').textContent=error.message}},true);
 for(const [id,key]of Object.entries({sensitivity:'sensitivity',hudScale:'hudScale',fieldOfView:'fov',sfxVolume:'sfxVolume',settingsVoiceVolume:'voiceVolume'}))$(id).oninput=()=>{value=normalizeSettings({...value,[key]:Number($(id).value)});render();save()};
 for(const [id,key]of Object.entries({invertY:'invertY',captions:'captions',highContrast:'highContrast'}))$(id).onchange=()=>{value[key]=$(id).checked;save()};
 $('reduceMotion').onchange=()=>{value.reducedMotion=$('reduceMotion').value;save()};
 function open(){returnFocus=document.activeElement;document.exitPointerLock?.();dispatchEvent(new Event('raidmenuopen'));capture=null;render();$('settingsDialog').showModal();$('settingsClose').focus()}
 function close(){capture=null;$('settingsDialog').close();returnFocus?.focus();render()}
 $('settingsOpen').onclick=open;$('settingsClose').onclick=close;$('settingsDialog').addEventListener('cancel',()=>{capture=null});$('settingsDialog').addEventListener('close',()=>{capture=null;returnFocus?.focus()});
 $('settingsReset').onclick=()=>{value=normalizeSettings({...DEFAULT_SETTINGS,onboardingDismissed:value.onboardingDismissed});render();save()};
 $('dismissWelcome').onclick=()=>{value.onboardingDismissed=true;save()};
 $('helpOpen').onclick=()=>{document.exitPointerLock?.();dispatchEvent(new Event('raidmenuopen'));render();$('helpDialog').showModal()};$('welcomeGuide').onclick=()=>$('helpOpen').click();$('helpClose').onclick=()=>$('helpDialog').close();
 media.addEventListener('change',apply);render();apply();
 return {get:effective,open,update(patch){value=normalizeSettings({...value,...patch});render();save()},isModal:()=>!!document.querySelector('dialog[open]')};
}
