export function installDialogNavigation(){
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.defaultPrevented)return;
  const controls=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length);
  const first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();dialog.focus();return}
  if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
 });
}
