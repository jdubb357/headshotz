export const ACTIONS={forward:'Move forward',back:'Move backward',left:'Strafe left',right:'Strafe right',lookLeft:'Look left',lookRight:'Look right',lookUp:'Look up',lookDown:'Look down',fire:'Fire',aim:'Aim down sights',jump:'Jump',vault:'Vault / mantle',interact:'Interact',reload:'Reload',slot1:'Weapon slot 1',slot2:'Weapon slot 2',heal:'Use medicine',utility:'Throw utility',pack:'Backpack',map:'Tactical map',ping:'Squad ping',sprint:'Sprint',slide:'Slide',pushTalk:'Push to talk',communications:'Squad / voice',settings:'Settings',help:'Field guide',status:'Read raid status'};
export const DEFAULT_BINDINGS={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',lookLeft:'ArrowLeft',lookRight:'ArrowRight',lookUp:'ArrowUp',lookDown:'ArrowDown',fire:'KeyF',aim:'ShiftLeft',jump:'Space',vault:'KeyJ',interact:'KeyE',reload:'KeyR',slot1:'Digit1',slot2:'Digit2',heal:'Digit3',utility:'KeyG',pack:'KeyB',map:'KeyM',ping:'KeyQ',sprint:'KeyX',slide:'KeyZ',pushTalk:'KeyV',communications:'KeyC',settings:'F2',help:'F1',status:'KeyH'};
export const KEY_CODES=[...Array.from({length:26},(_,i)=>'Key'+String.fromCharCode(65+i)),...Array.from({length:10},(_,i)=>'Digit'+i),'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','F1','F2','F3','F4','F6','F7','F8','F9','F10','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash','Backslash','Backquote'];
export const DEFAULT_SETTINGS={version:1,bindings:DEFAULT_BINDINGS,sensitivity:1,hudScale:1,fov:75,sfxVolume:.7,voiceVolume:.7,invertY:false,reducedMotion:'system',captions:true,highContrast:false,onboardingDismissed:false,viewMode:'third',hudLayout:'auto'};
const clamp=(n,min,max,fallback)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export function normalizeSettings(value){
 const s=value&&typeof value==='object'?value:{},bindings={...DEFAULT_BINDINGS};
 // Apply a complete valid permutation atomically; a corrupt partial map cannot strand a control.
 const saved=s.bindings,known=Object.keys(ACTIONS),additions=['utility','aim','sprint','slide','vault','map'];
 if(saved&&known.every(a=>KEY_CODES.includes(saved[a]))&&Object.keys(saved).length===known.length&&new Set(Object.values(saved)).size===known.length)for(const action of known)bindings[action]=saved[action];
 else if(saved){
  // Older keymaps predate some actions. Keep their bindings and give every new
  // action a distinct key, even when a saved new-action default conflicts with
  // an older control that already uses it.
  const present=known.filter(a=>Object.hasOwn(saved,a)),missing=known.filter(a=>!Object.hasOwn(saved,a)),older=present.filter(a=>!additions.includes(a)),newer=present.filter(a=>additions.includes(a));
  if(missing.every(a=>additions.includes(a))&&Object.keys(saved).length===present.length&&older.every(a=>KEY_CODES.includes(saved[a]))&&new Set(older.map(a=>saved[a])).size===older.length){
   const used=new Set();for(const action of older){bindings[action]=saved[action];used.add(saved[action])}
   for(const action of [...newer,...missing]){
    const preferred=saved[action],code=preferred&&KEY_CODES.includes(preferred)&&!used.has(preferred)?preferred:used.has(DEFAULT_BINDINGS[action])?KEY_CODES.find(code=>!used.has(code)):DEFAULT_BINDINGS[action];
    bindings[action]=code;used.add(code);
   }
  }
 }
 return {version:1,bindings,sensitivity:clamp(s.sensitivity,.2,3,1),hudScale:clamp(s.hudScale,.8,1.6,1),fov:clamp(s.fov,60,100,75),sfxVolume:clamp(s.sfxVolume,0,1,.7),voiceVolume:clamp(s.voiceVolume,0,1,.7),invertY:s.invertY===true,reducedMotion:['system','on','off'].includes(s.reducedMotion)?s.reducedMotion:'system',captions:s.captions!==false,highContrast:s.highContrast===true,onboardingDismissed:s.onboardingDismissed===true,viewMode:['first','third'].includes(s.viewMode)?s.viewMode:'third',hudLayout:['auto','compact','full'].includes(s.hudLayout)?s.hudLayout:'auto'};
}
export function rebind(settings,action,code){if(!Object.hasOwn(ACTIONS,action)||!KEY_CODES.includes(code))throw new Error('Choose a supported key. Escape and Tab remain browser navigation controls.');const next=normalizeSettings(settings),other=Object.keys(ACTIONS).find(a=>next.bindings[a]===code);if(other)next.bindings[other]=next.bindings[action];next.bindings[action]=code;return next}
export const keyName=code=>code?.replace(/^Key|^Digit/,'').replace('Arrow','Arrow ').replace(/(Left|Right)$/,' $1').replace(/\s+/g,' ').trim()||'Unassigned';

export function aimDelta(view,dx,dy,{sensitivity=1,invertY=false}={}){return {yaw:view.yaw-dx*sensitivity,pitch:Math.max(-1.2,Math.min(1.2,view.pitch-dy*sensitivity*(invertY?-1:1)))}}
