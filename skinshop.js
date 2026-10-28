// HeadShotz v54 SKIN SHOP: buy cosmetic skins with in-game diamonds (no real money, no ads), equip one, pick a colour tint,
// rotating 3D preview (Hero = Royale toon / Soldier = realistic main-game human). Same wallet as the rest of the game (PROG).
import {THREE} from './gfx.js';
import {SKIN_DEFS,SKIN_BY,TINTS,TINT_N,RAR_N,RAR_C,humanOutfit,skinColors} from './skins.js';
import {makeToon,animToon,BASE_N} from './toon.js';
import {makeCharacter,animate as animHum} from './chars.js';
const hex=c=>'#'+(c>>>0).toString(16).padStart(6,'0');
const FIL=[['all','ALL'],['fx','✨ GALAXY'],['owned','OWNED'],['0','COMMON'],['1','UNCOMMON'],['2','RARE'],['3','EPIC'],['4','LEGENDARY']];
export function initSkinShop(A){
 const $=A.$;const el=$('skinShop');if(!el)return null;const P=A.PROG;
 const S={sel:SKIN_DEFS[0].id,tint:0,view:'hero',fil:'all',on:false,ry:.5,drag:null,from:'menu'};
 const own=id=>P.skins.includes(id);const toast=(m)=>{const t=$('ssToast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800)};
 const eqId=()=>String(P.skin||'default').split('~')[0],eqTint=()=>{const s=String(P.skin||'');const i=s.indexOf('~');return i<0?0:(parseInt(s.slice(i+1))||0)};
 // ---------- 3D preview
 let R=null,scene=null,cam=null,model=null,raf=0,last=0,cv=null,clock=0;
 function mkLights(sc){sc.add(new THREE.HemisphereLight(0xdff2ff,0x7a6aa8,1.3));const k=new THREE.DirectionalLight(0xfff0d8,2.6);k.position.set(-2.5,4,-3.5);sc.add(k);const r=new THREE.DirectionalLight(0x9fd0ff,1.7);r.position.set(3,2.5,3.5);sc.add(r);const f=new THREE.DirectionalLight(0xffc2e8,.7);f.position.set(3,1,-3);sc.add(f)}
 function build(){if(R)return;cv=$('ssCv');R=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true,powerPreference:'low-power'});R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;R.setClearColor(0,0);
  scene=new THREE.Scene();cam=new THREE.PerspectiveCamera(30,1,.1,60);mkLights(scene);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.05,.16,36),new THREE.MeshStandardMaterial({color:0xfdf3ff,roughness:.25,metalness:.15}));top.position.y=-.08;scene.add(top);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.3,.22,36),new THREE.MeshStandardMaterial({color:0x19b8a6,roughness:.4,metalness:.2}));base.position.y=-.27;scene.add(base);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.0,.035,8,48),new THREE.MeshBasicMaterial({color:0xffd23f}));ring.rotation.x=Math.PI/2;ring.position.y=.005;scene.add(ring)}
 function resize(){if(!R)return;const b=cv.parentElement.getBoundingClientRect();const w=Math.max(120,b.width|0),h=Math.max(120,b.height|0);R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.setSize(w,h,false);cam.aspect=w/h;
  const soldier=S.view==='soldier';cam.fov=soldier?(h>w?32:25):(h>w?34:28);cam.position.set(0,soldier?1.1:1.1,soldier?-5.9:-5.2);cam.lookAt(0,soldier?.98:.92,0);cam.updateProjectionMatrix()}
 function disposeModel(){if(!model)return;scene.remove(model);model.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&o.geometry)o.geometry.dispose()});model=null}
 function gunFor(m){const u=m.userData;if(!u.gunMount||!A.gun)return;u.gunMount.clear();const g=A.gun('ar',u.outfit&&u.outfit.glove);if(g)u.gunMount.add(g)}
 function mkModel(){if(!scene)return;const keepRy=model?model.rotation.y:S.ry;disposeModel();const def=SKIN_BY[S.sel];if(!def)return;
  if(S.view==='hero'){model=makeToon(0xffffff,'','shop-'+def.id,'#fff',BASE_N+SKIN_DEFS.indexOf(def)+64*S.tint,{noTag:true})}
  else{const o=window.__toonOn;window.__toonOn=null;try{model=makeCharacter(0xffffff,'','shop-'+def.id,undefined,humanOutfit(def.id,S.tint),'soldier')}finally{window.__toonOn=o}if(model.userData.tag)model.userData.tag.visible=false}
  gunFor(model);model.rotation.y=keepRy;scene.add(model);resize();pose(0.016)}
 function pose(dt){if(!model)return;const st={speed:0,hold:true,pitch:0,lz:-1,lx:0,noTag:true,dist:3,lobby:1};if(model.userData.kind==='toon')animToon(model,st,dt);else animHum(model,st,dt)}
 function frame(t){if(!S.on)return;raf=requestAnimationFrame(frame);if(!S.uv&&((S.fc=(S.fc||0)+1)%10===0)){const want=window.__humans&&window.__humans.ok?'soldier':'hero';if(want!==S.view){S.view=want;mkModel();renderSide()}}const dt=Math.min(.05,(t-last)/1000||.016);last=t;clock+=dt;if(model){if(!S.drag)model.rotation.y+=dt*.8;pose(dt)}R.render(scene,cam)}
 // ---------- thumbnails (hero render of every skin; generated once in small batches by a throw-away renderer)
 const TH={};let thBusy=false;
 function makeThumbs(){if(thBusy)return;const todo=SKIN_DEFS.filter(d=>!TH[d.id]);if(!todo.length)return;thBusy=true;
  let tr=null;try{tr=new THREE.WebGLRenderer({antialias:false,alpha:true,preserveDrawingBuffer:true});tr.setPixelRatio(1);tr.setSize(110,160);tr.outputColorSpace=THREE.SRGBColorSpace;tr.toneMapping=THREE.ACESFilmicToneMapping;tr.setClearColor(0,0)}catch(e){thBusy=false;return}
  const sc=new THREE.Scene();mkLights(sc);const c2=new THREE.PerspectiveCamera(33,110/160,.1,40);c2.position.set(0,1.1,-5.8);c2.lookAt(0,.92,0);const SOLD=!!(window.__humans&&window.__humans.ok);let i=0;
  const step=()=>{const d=todo[i++];if(!d){try{tr.dispose();tr.forceContextLoss&&tr.forceContextLoss()}catch(e){}thBusy=false;return}
   try{let m;if(SOLD){const o=window.__toonOn;window.__toonOn=null;try{m=makeCharacter(0xffffff,'','th-'+d.id,undefined,humanOutfit(d.id,0),'soldier')}finally{window.__toonOn=o}if(m.userData.tag)m.userData.tag.visible=false;m.rotation.y=.5;sc.add(m);for(let q=0;q<4;q++)animHum(m,{speed:0,hold:false,relax:true,pitch:0,lz:-1,lx:0,noTag:true,dist:3,lobby:1},.05)}else{m=makeToon(0xffffff,'','th-'+d.id,'#fff',BASE_N+SKIN_DEFS.indexOf(d),{noTag:true});m.rotation.y=.55;sc.add(m);animToon(m,{speed:0,hold:false,relax:true,pitch:0,lz:-1,lx:0,noTag:true},.016)}tr.render(sc,c2);TH[d.id]=tr.domElement.toDataURL('image/png');sc.remove(m);m.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&o.geometry)o.geometry.dispose()});
    const img=el.querySelector(`.ssCard[data-id="${d.id}"] img`);if(img)img.src=TH[d.id]}catch(e){}
   setTimeout(step,S.on?30:200)};step()}
 // ---------- UI
 function card(d){const o=own(d.id),eq=eqId()===d.id,k=skinColors(d,0);return `<button class="ssCard${d.id===S.sel?' sel':''}${eq?' eqd':''}" data-id="${d.id}" style="--rc:${RAR_C[d.rar]};--a:${hex(k.top)};--b:${hex(k.pants)};--c:${hex(k.acc)}"><span class="ph"><img alt="" src="${TH[d.id]||''}"></span><b>${A.esc(d.name)}</b><i style="background:${RAR_C[d.rar]}">${RAR_N[d.rar]}</i>${d.fx?'<s class="fxTag">✨ MOVING</s>':''}<em>${eq?'✔ WEARING':o?'OWNED':'💎 '+d.price}</em></button>`}
 function list(){return SKIN_DEFS.filter(d=>S.fil==='all'||(S.fil==='owned'?own(d.id):S.fil==='fx'?!!d.fx:d.rar===+S.fil)).sort((a,b)=>a.rar-b.rar||a.price-b.price)}
 function renderGrid(){const L=list();$('ssGrid').innerHTML=L.length?L.map(card).join(''):'<p class="ssEmpty">Nothing here yet — buy a skin or open a chest!</p>';$('ssCount').textContent=`${SKIN_DEFS.filter(d=>own(d.id)).length}/${SKIN_DEFS.length} owned`}
 function renderSide(){const d=SKIN_BY[S.sel],o=own(d.id),eq=eqId()===d.id&&eqTint()===S.tint;$('ssDia').textContent=P.dia;
  $('ssName').textContent=d.name;$('ssRar').textContent=RAR_N[d.rar]+(d.fx?' · ✨ ANIMATED GALAXY':'');$('ssRar').style.background=RAR_C[d.rar];
  $('ssFil').innerHTML=FIL.map(f=>`<button data-f="${f[0]}" class="${S.fil===f[0]?'sel':''}">${f[1]}</button>`).join('');
  $('ssTints').innerHTML='<span>COLOR</span>'+TINTS.map((c,i)=>`<button class="tw${i===S.tint?' sel':''}" data-t="${i}" title="${TINT_N[i]}" style="background:${c==null?`conic-gradient(${hex(d.c[0])} 0 33%,${hex(d.c[1])} 0 66%,${hex(d.c[2])} 0)`:hex(c)}"></button>`).join('');
  document.querySelectorAll('#ssView button').forEach(b=>b.classList.toggle('sel',b.dataset.v===S.view));
  const b=$('ssBuy');b.classList.remove('poor','own');
  if(o){b.textContent=eq?'✔ WEARING':'EQUIP';b.dataset.act=eq?'none':'equip';b.classList.add('own')}
  else if(P.dia>=d.price){b.textContent=`BUY · 💎 ${d.price}`;b.dataset.act='buy'}
  else{b.textContent=`NEED 💎 ${d.price-P.dia} MORE`;b.dataset.act='poor';b.classList.add('poor')}
  $('ssDef').classList.toggle('hidden',eqId()==='default')}
 function render(){renderGrid();renderSide()}
 function select(id){S.sel=id;S.tint=(P.stint&&P.stint[id])||(eqId()===id?eqTint():0);mkModel();render()}
 function buy(){const d=SKIN_BY[S.sel];if(own(d.id)||P.dia<d.price){A.denied&&A.denied();return}P.dia-=d.price;P.skins.push(d.id);A.SFX&&A.SFX.kill&&A.SFX.kill();toast(`✨ ${d.name} unlocked!`);equip()}
 function equip(){const d=SKIN_BY[S.sel];if(!own(d.id))return;P.stint=P.stint||{};P.stint[d.id]=S.tint;A.equip(d.id,S.tint);render();toast(`Wearing ${d.name}${S.tint?' · '+TINT_N[S.tint]:''}`)}
 function open(from){A.audioInit&&A.audioInit();try{document.exitPointerLock&&document.exitPointerLock()}catch(e){}S.from=from||'menu';if(!S.vSet){S.vSet=1;S.view=window.__humans&&window.__humans.ok?'soldier':'hero'}build();el.classList.remove('hidden');S.on=true;
  const cur=eqId();const start=SKIN_BY[cur]?cur:(SKIN_BY[S.sel]?S.sel:SKIN_DEFS[0].id);S.sel=start;S.tint=SKIN_BY[cur]&&cur===start?eqTint():(P.stint&&P.stint[start])||0;render();
  requestAnimationFrame(()=>{resize();mkModel();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);setTimeout(makeThumbs,120)})}
 function close(){S.on=false;cancelAnimationFrame(raf);el.classList.add('hidden');disposeModel();if(R){try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}R=null;scene=null;cam=null}A.onClose&&A.onClose(S.from)}
 el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='ssClose')close();
  else if(b.dataset.id)select(b.dataset.id);
  else if(b.dataset.f!=null){S.fil=b.dataset.f;render()}
  else if(b.dataset.t!=null){S.tint=+b.dataset.t;mkModel();renderSide()}
  else if(b.dataset.v){S.uv=1;S.view=b.dataset.v;mkModel();renderSide()}
  else if(b.id==='ssBuy'){const a=b.dataset.act;if(a==='buy')buy();else if(a==='equip')equip();else if(a==='poor')A.denied&&A.denied()}
  else if(b.id==='ssDef'){A.equip('default',0);render();toast('Wearing the default outfit')}});
 const cvEl=$('ssStage');cvEl.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;S.drag={x:e.clientX};try{cvEl.setPointerCapture(e.pointerId)}catch(x){}});
 cvEl.addEventListener('pointermove',e=>{if(S.drag&&model){model.rotation.y+=(e.clientX-S.drag.x)*.012;S.drag.x=e.clientX}});
 const up=()=>{S.drag=null};cvEl.addEventListener('pointerup',up);cvEl.addEventListener('pointercancel',up);
 addEventListener('resize',()=>{if(S.on)resize()});
 return{open,close,isOpen:()=>S.on,owned:own,thumb:id=>TH[id]||'',makeThumbs,state:S,select,buy,equip}}
