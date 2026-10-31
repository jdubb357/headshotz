export const ACTIONS={forward:'Move forward',back:'Move backward',left:'Strafe left',right:'Strafe right',lookLeft:'Look left',lookRight:'Look right',lookUp:'Look up',lookDown:'Look down',fire:'Fire',aim:'Aim down sights',jump:'Jump',interact:'Interact',reload:'Reload',slot1:'Weapon slot 1',slot2:'Weapon slot 2',heal:'Use medicine',utility:'Throw utility',pack:'Backpack',ping:'Squad ping',pushTalk:'Push to talk',communications:'Squad / voice',settings:'Settings',help:'Field guide',status:'Read raid status'};
export const DEFAULT_BINDINGS={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',lookLeft:'ArrowLeft',lookRight:'ArrowRight',lookUp:'ArrowUp',lookDown:'ArrowDown',fire:'KeyF',aim:'ShiftLeft',jump:'Space',interact:'KeyE',reload:'KeyR',slot1:'Digit1',slot2:'Digit2',heal:'Digit3',utility:'KeyG',pack:'KeyB',ping:'KeyQ',pushTalk:'KeyV',communications:'KeyC',settings:'F2',help:'F1',status:'KeyH'};
export const KEY_CODES=[...Array.from({length:26},(_,i)=>'Key'+String.fromCharCode(65+i)),...Array.from({length:10},(_,i)=>'Digit'+i),'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','F1','F2','F3','F4','F6','F7','F8','F9','F10','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote','Comma','Period','Slash','Backslash','Backquote'];
export const DEFAULT_SETTINGS={version:1,bindings:DEFAULT_BINDINGS,sensitivity:1,hudScale:1,fov:75,sfxVolume:.7,voiceVolume:.7,invertY:false,reducedMotion:'system',captions:true,highContrast:false,onboardingDismissed:false};
const clamp=(n,min,max,fallback)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
export function normalizeSettings(value){
 const s=value&&typeof value==='object'?value:{},bindings={...DEFAULT_BINDINGS};
 // Apply a complete valid permutation atomically; a corrupt partial map cannot strand a control.
 const saved=s.bindings,known=Object.keys(ACTIONS),additions=['utility','aim'];
 if(saved&&known.every(a=>KEY_CODES.includes(saved[a]))&&Object.keys(saved).length===known.length&&new Set(Object.values(saved)).size===known.length)for(const action of known)bindings[action]=saved[action];
 else if(saved){
  const present=known.filter(a=>Object.hasOwn(saved,a)),missing=known.filter(a=>!Object.hasOwn(saved,a));
  if(missing.length&&missing.every(a=>additions.includes(a))&&Object.keys(saved).length===present.length&&present.every(a=>KEY_CODES.includes(saved[a]))&&new Set(Object.values(saved)).size===present.length){
   for(const action of present)bindings[action]=saved[action];const used=new Set(Object.values(saved));
   for(const action of missing){const code=used.has(DEFAULT_BINDINGS[action])?KEY_CODES.find(code=>!used.has(code)):DEFAULT_BINDINGS[action];bindings[action]=code;used.add(code)}
  }
 }
 return {version:1,bindings,sensitivity:clamp(s.sensitivity,.2,3,1),hudScale:clamp(s.hudScale,.8,1.6,1),fov:clamp(s.fov,60,100,75),sfxVolume:clamp(s.sfxVolume,0,1,.7),voiceVolume:clamp(s.voiceVolume,0,1,.7),invertY:s.invertY===true,reducedMotion:['system','on','off'].includes(s.reducedMotion)?s.reducedMotion:'system',captions:s.captions!==false,highContrast:s.highContrast===true,onboardingDismissed:s.onboardingDismissed===true};
}
export function rebind(settings,action,code){if(!Object.hasOwn(ACTIONS,action)||!KEY_CODES.includes(code))throw new Error('Choose a supported key. Escape and Tab remain browser navigation controls.');const next=normalizeSettings(settings),other=Object.keys(ACTIONS).find(a=>next.bindings[a]===code);if(other)next.bindings[other]=next.bindings[action];next.bindings[action]=code;return next}
export const keyName=code=>code?.replace(/^Key|^Digit/,'').replace('Arrow','Arrow ').replace(/(Left|Right)$/,' $1').replace(/\s+/g,' ').trim()||'Unassigned';

export function aimDelta(view,dx,dy,{sensitivity=1,invertY=false}={}){return {yaw:view.yaw-dx*sensitivity,pitch:Math.max(-1.2,Math.min(1.2,view.pitch-dy*sensitivity*(invertY?-1:1)))}}
