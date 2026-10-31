const typing=target=>target?.matches('input,textarea,select,[contenteditable="true"]');
export function raidInput({settings,allowed,onAction,onTalk,onClear,onMove,onRelease}){
 const keyboard=new Map(),touch=new Set();
 const movement=action=>['forward','back','left','right'].includes(action);
 const held=action=>touch.has(action)||[...keyboard.values()].includes(action);
 function clear(){keyboard.clear();touch.clear();onTalk(false);onClear?.()}
 addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||typing(e.target))return;
  // A repeat cannot recreate a key cleared by a menu, reload or focus loss.
  if(e.repeat&&!keyboard.has(e.code))return;
  const action=Object.keys(settings().bindings).find(a=>settings().bindings[a]===e.code);if(!action||!allowed(action))return;
  // Space on a focused button keeps its normal activation behavior.
  if(e.code==='Space'&&e.target.closest?.('button,a,summary'))return;
  e.preventDefault();keyboard.set(e.code,action);
  if(!e.repeat&&movement(action))onMove?.();
  if(action==='pushTalk'){onTalk(true);return}
  if(!e.repeat&&!['forward','back','left','right','lookLeft','lookRight','lookUp','lookDown','aim'].includes(action))onAction(action);
 });
 addEventListener('keyup',e=>{const action=keyboard.get(e.code);keyboard.delete(e.code);if(action==='pushTalk')onTalk(false);if(action)onRelease?.(action);if(movement(action))onMove?.()});
 addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});addEventListener('raidmenuopen',clear);document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)clear()});
 for(const b of document.querySelectorAll('[data-move],[data-look]')){
  const action=b.dataset.move||b.dataset.look;
  b.onpointerdown=e=>{if(!allowed(action))return;e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(action);if(movement(action))onMove?.()};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{if(touch.delete(action)&&movement(action))onMove?.()};
 }
 return {held,clear,release(action){for(const [code,value]of keyboard)if(value===action)keyboard.delete(code);touch.delete(action);onRelease?.(action)}};
}
