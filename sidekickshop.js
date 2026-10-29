// HeadShotz v57 SIDEKICK BOOTH screen: buy buddies with diamonds, equip one at a time, rotating 3D preview + shopkeeper chat.
import {THREE} from './gfx.js';
import {SK_DEFS,SK_BY,AB,RAR_N,RAR_C,SK_FLAVOR,makePet,animPet} from './sidekicks.js';
const FIL=[['all','ALL'],['owned','OWNED'],['0','COMMON'],['1','UNCOMMON'],['2','RARE'],['3','EPIC'],['4','LEGENDARY']];
const KEEPER=['Welcome to my Sidekick Booth! Every buddy has one special trick.','Pick one to take along. You can only bring one buddy at a time!','Buddies also drop from chests. Doubles turn into diamonds.','Tap EQUIP and your buddy will trot along behind you.'];
export function initSidekickShop(A){
 const $=A.$;const el=$('pkShop');if(!el)return null;const P=A.PROG;
 const S={sel:SK_DEFS[0].id,fil:'all',on:false,drag:null,from:'menu',ki:0};
 const own=id=>P.pets.includes(id);const eq=()=>P.pet||'';
 const toast=m=>{const t=$('pkToast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)};
 let R=null,scene=null,cam=null,model=null,raf=0,last=0,cv=null,clock=0;
 function freshCanvas(){const o=$('pkCv');if(!o)return null;const n=o.cloneNode(false);o.replaceWith(n);return n}
 function build(){if(R)return;cv=$('pkCv');try{R=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true,powerPreference:'low-power'})}catch(e){cv=freshCanvas();R=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true,powerPreference:'low-power'})}R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.setClearColor(0,0);
  scene=new THREE.Scene();cam=new THREE.PerspectiveCamera(30,1,.05,30);scene.add(new THREE.HemisphereLight(0xdff2ff,0x7a6aa8,1.4));const k=new THREE.DirectionalLight(0xfff0d8,2.6);k.position.set(-2,3,3);scene.add(k);const r=new THREE.DirectionalLight(0x9fd0ff,1.4);r.position.set(3,2,-3);scene.add(r);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.55,.6,.07,36),new THREE.MeshStandardMaterial({color:0xfdf3ff,roughness:.25,metalness:.15}));top.position.y=-.035;scene.add(top);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.66,.75,.1,36),new THREE.MeshStandardMaterial({color:0xff8a3a,roughness:.4,metalness:.2}));base.position.y=-.12;scene.add(base);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.57,.018,8,48),new THREE.MeshBasicMaterial({color:0xffd23f}));ring.rotation.x=Math.PI/2;ring.position.y=.004;scene.add(ring)}
 function resize(){if(!R)return;const b=cv.parentElement.getBoundingClientRect();const w=Math.max(120,b.width|0),h=Math.max(120,b.height|0);R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.setSize(w,h,false);cam.aspect=w/h;cam.fov=h>w?36:30;cam.position.set(0,.6,h>w?2.9:2.4);cam.lookAt(0,.3,0);cam.updateProjectionMatrix()}
 function disposeModel(){if(model){scene.remove(model);model=null}}
 function mkModel(){if(!scene)return;const ry=model?model.rotation.y:.7;disposeModel();model=makePet(S.sel);model.rotation.y=ry;scene.add(model)}
 function frame(t){if(!S.on)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(t-last)/1000||.016);last=t;clock+=dt;if(model){if(!S.drag)model.rotation.y+=dt*.7;animPet(model,clock,0,dt)}R.render(scene,cam)}
 // thumbnails: one throw-away renderer, rendered in small batches
 const TH={};let thBusy=false;
 function makeThumbs(){if(thBusy)return;const todo=SK_DEFS.filter(d=>!TH[d.id]);if(!todo.length)return;thBusy=true;let tr=null;try{tr=new THREE.WebGLRenderer({antialias:false,alpha:true,preserveDrawingBuffer:true});tr.setPixelRatio(1);tr.setSize(120,110);tr.outputColorSpace=THREE.SRGBColorSpace;tr.toneMapping=THREE.ACESFilmicToneMapping;tr.setClearColor(0,0)}catch(e){thBusy=false;return}
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xdff2ff,0x7a6aa8,1.5));const k=new THREE.DirectionalLight(0xfff0d8,2.6);k.position.set(-2,3,3);sc.add(k);const c2=new THREE.PerspectiveCamera(30,120/110,.05,20);c2.position.set(0,.75,2.9);c2.lookAt(0,.36,0);let i=0;
  const step=()=>{const d=todo[i++];if(!d){try{tr.dispose();tr.forceContextLoss&&tr.forceContextLoss()}catch(e){}thBusy=false;return}
   try{const m=makePet(d.id);m.rotation.y=.7;sc.add(m);animPet(m,1.1,0,.016);tr.render(sc,c2);TH[d.id]=tr.domElement.toDataURL('image/png');sc.remove(m);const img=el.querySelector(`.ssCard[data-id="${d.id}"] img`);if(img)img.src=TH[d.id]}catch(e){}
   setTimeout(step,S.on?25:200)};step()}
 const hex=c=>'#'+(c>>>0).toString(16).padStart(6,'0');
 function card(d){const o=own(d.id),e=eq()===d.id;return `<button class="ssCard${d.id===S.sel?' sel':''}${e?' eqd':''}" data-id="${d.id}" style="--rc:${RAR_C[d.rar]};--a:${hex(d.col)}"><span class="ph"><img alt="" src="${TH[d.id]||''}"></span><b>${A.esc(d.name)}</b><i style="background:${RAR_C[d.rar]}">${RAR_N[d.rar]}</i><s class="fxTag" style="color:#9ff">${AB[d.ab].ic} ${AB[d.ab].n}</s><em>${e?'✔ WITH YOU':o?'OWNED':'💎 '+d.price}</em></button>`}
 const list=()=>SK_DEFS.filter(d=>S.fil==='all'||(S.fil==='owned'?own(d.id):d.rar===+S.fil)).sort((a,b)=>a.rar-b.rar||a.price-b.price);
 function renderGrid(){const L=list();$('pkGrid').innerHTML=L.length?L.map(card).join(''):'<p class="ssEmpty">No buddies here yet — buy one or open a chest!</p>';$('pkCount').textContent=`${SK_DEFS.filter(d=>own(d.id)).length}/${SK_DEFS.length} owned`}
 function renderSide(){const d=SK_BY[S.sel],o=own(d.id),e=eq()===d.id;$('pkDia').textContent=P.dia;$('pkName').textContent=d.name+' · '+d.kind;$('pkRar').textContent=RAR_N[d.rar]+(d.orig?' · ORIGINAL':'');$('pkRar').style.background=RAR_C[d.rar];
  const ab=AB[d.ab];$('pkAbil').innerHTML=`<b>${ab.ic} ${ab.n}</b> <span>${ab.act?'ACTIVE · button / X':'PASSIVE'}</span><p>${A.esc(ab.d(d.pw))}</p>`;
  $('pkSay').textContent='Penny: “'+(S.say||SK_FLAVOR[d.id]||KEEPER[0])+'”';
  $('pkFil').innerHTML=FIL.map(f=>`<button data-f="${f[0]}" class="${S.fil===f[0]?'sel':''}">${f[1]}</button>`).join('');
  const b=$('pkBuy');b.classList.remove('poor','own');
  if(o){b.textContent=e?'✔ WITH YOU':'EQUIP';b.dataset.act=e?'none':'equip';b.classList.add('own')}
  else if(P.dia>=d.price){b.textContent=`BUY · 💎 ${d.price}`;b.dataset.act='buy'}
  else{b.textContent=`NEED 💎 ${d.price-P.dia} MORE`;b.dataset.act='poor';b.classList.add('poor')}
  $('pkNone').classList.toggle('hidden',!eq())}
 const render=()=>{renderGrid();renderSide()};
 function select(id){S.sel=id;S.say=null;mkModel();render()}
 function buy(){const d=SK_BY[S.sel];if(own(d.id)||P.dia<d.price){A.denied&&A.denied();return}P.dia-=d.price;P.pets.push(d.id);A.SFX&&A.SFX.kill&&A.SFX.kill();S.say='Yay! '+d.name+' is yours. Take good care of them!';toast(`✨ ${d.name} joined your team!`);equip()}
 function equip(){const d=SK_BY[S.sel];if(!own(d.id))return;A.equip(d.id);render();toast(`${d.name} is following you`)}
 function open(from){A.audioInit&&A.audioInit();try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}S.from=from||'menu';el.classList.remove('hidden');if(S.on){cancelAnimationFrame(raf);disposeModel();if(R){try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}R=null;scene=null;cam=null;freshCanvas()}}try{build()}catch(e){console.error('sidekick preview unavailable',e)}S.on=true;S.say=KEEPER[S.ki++%KEEPER.length];
  const cur=eq();S.sel=SK_BY[cur]?cur:(SK_BY[S.sel]?S.sel:SK_DEFS[0].id);render();requestAnimationFrame(()=>{resize();mkModel();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);setTimeout(makeThumbs,120)})}
 function close(){S.on=false;cancelAnimationFrame(raf);el.classList.add('hidden');disposeModel();if(R){try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}R=null;scene=null;cam=null}freshCanvas();A.onClose&&A.onClose(S.from)}
 el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='pkClose')close();else if(b.dataset.id)select(b.dataset.id);else if(b.dataset.f!=null){S.fil=b.dataset.f;render()}
  else if(b.id==='pkBuy'){const a=b.dataset.act;if(a==='buy')buy();else if(a==='equip')equip();else if(a==='poor'){S.say='Come back with a few more diamonds!';renderSide();A.denied&&A.denied()}}
  else if(b.id==='pkNone'){A.equip('');render();toast('Your buddy is resting at home')}});
 const st=$('pkStage');st.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;S.drag={x:e.clientX};try{st.setPointerCapture(e.pointerId)}catch(x){}});
 st.addEventListener('pointermove',e=>{if(S.drag&&model){model.rotation.y+=(e.clientX-S.drag.x)*.012;S.drag.x=e.clientX}});const up=()=>{S.drag=null};st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
 addEventListener('resize',()=>{if(S.on)resize()});
 return{name:id=>(SK_BY[id]||{}).name||'',open,close,isOpen:()=>S.on,owned:own,thumb:id=>TH[id]||'',makeThumbs,state:S,select,buy,equip}}
