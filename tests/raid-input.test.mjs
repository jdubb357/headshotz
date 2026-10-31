import test from 'node:test';
import assert from 'node:assert/strict';
import {raidInput} from '../raid-input.mjs';
import {DEFAULT_BINDINGS} from '../shared/raid-settings.mjs';

function setup(t){
 class Surface extends EventTarget {typing=false;matches(){return this.typing}closest(){return null}}
 const window=new Surface(),document=new Surface(),priorDocument=globalThis.document,priorListener=globalThis.addEventListener,actions=[],talk=[],released=[];let moves=0,clears=0;
 document.querySelectorAll=()=>[];document.hidden=false;document.pointerLockElement={};globalThis.document=document;globalThis.addEventListener=window.addEventListener.bind(window);
 t.after(()=>{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorListener===undefined)delete globalThis.addEventListener;else globalThis.addEventListener=priorListener});
 const controls=raidInput({settings:()=>({bindings:DEFAULT_BINDINGS}),allowed:()=>true,onAction:action=>actions.push(action),onTalk:active=>talk.push(active),onRelease:action=>released.push(action),onMove:()=>moves++,onClear:()=>clears++});
 const key=(code,{up=false,repeat=false}={})=>{const event=new Event(up?'keyup':'keydown',{cancelable:true});Object.assign(event,{code,repeat,ctrlKey:false,metaKey:false});window.dispatchEvent(event)};
 return {window,document,controls,key,actions,talk,released,get moves(){return moves},get clears(){return clears}};
}
test('OS repeat cannot restore a fire key after controls were cleared',t=>{
 const f=setup(t);f.key('KeyF');assert.equal(f.controls.held('fire'),true);f.controls.clear();f.key('KeyF',{repeat:true});assert.equal(f.controls.held('fire'),false);assert.deepEqual(f.actions,['fire']);f.key('KeyF',{up:true});f.key('KeyF');assert.equal(f.controls.held('fire'),true);assert.deepEqual(f.actions,['fire','fire']);
});
test('opening a menu clears movement until a new physical press',t=>{
 const f=setup(t);f.key('KeyW');f.window.dispatchEvent(new Event('raidmenuopen'));f.key('KeyW',{repeat:true});assert.equal(f.controls.held('forward'),false);f.key('KeyW',{up:true});f.key('KeyW');assert.equal(f.controls.held('forward'),true);assert.equal(f.moves,2);
});
test('releasing fire for reload preserves movement but blocks old fire repeats',t=>{
 const f=setup(t);f.key('KeyW');f.key('KeyF');f.controls.release('fire');f.key('KeyF',{repeat:true});assert.equal(f.controls.held('forward'),true);assert.equal(f.controls.held('fire'),false);assert.deepEqual(f.released,['fire']);
});
test('a key pressed while typing cannot turn into game input when focus changes',t=>{
 const f=setup(t);f.window.typing=true;f.key('KeyF');f.window.typing=false;f.key('KeyF',{repeat:true});assert.equal(f.controls.held('fire'),false);assert.deepEqual(f.actions,[]);
});
test('focus loss cannot let push-to-talk repeat turn the microphone back on',t=>{
 const f=setup(t);f.key('KeyV');assert.equal(f.talk.at(-1),true);f.window.dispatchEvent(new Event('blur'));f.key('KeyV',{repeat:true});assert.equal(f.talk.at(-1),false);assert.equal(f.controls.held('pushTalk'),false);f.key('KeyV',{up:true});f.key('KeyV');assert.equal(f.talk.at(-1),true);
});
test('ordinary repeat preserves an existing movement hold without duplicate edges',t=>{
 const f=setup(t);f.key('KeyW');for(let i=0;i<5;i++)f.key('KeyW',{repeat:true});assert.equal(f.controls.held('forward'),true);assert.equal(f.moves,1);f.key('KeyW',{up:true});assert.equal(f.controls.held('forward'),false);assert.equal(f.moves,2);
});
test('losing pointer lock clears held input and does not accept an old repeat',t=>{
 const f=setup(t);f.key('KeyF');f.document.dispatchEvent(new Event('pointerlockchange'));assert.equal(f.controls.held('fire'),true);f.document.pointerLockElement=null;f.document.dispatchEvent(new Event('pointerlockchange'));f.key('KeyF',{repeat:true});assert.equal(f.controls.held('fire'),false);
});
