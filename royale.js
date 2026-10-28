// HeadShotz Royale: own menu entry + lobby (3D hero showcase on a pedestal, PLAY, solo/squad, party, locker with outfits + emotes).
// Standalone module: game.js hands it the few hooks it needs (see initRoyale call at the end of game.js).
import {THREE,GQ} from './gfx.js';
import {makeToon,animToon,OUTFITS,RARN,EMOTES,EMOTE_DUR} from './toon.js';
const RC=['#9aa4b2','#4cd964','#4dabff','#b37bff','#ffb020'];// common..legendary
const EMO_LBL={wave:'👋 Wave',dance:'🕺 Dance',flex:'💪 Flex',cheer:'🎉 Cheer',sit:'🪑 Sit',salute:'🫡 Salute',spin:'🌀 Spin',clap:'👏 Clap'};
export function initRoyale(A){
 const $=A.$,el=$('royale');if(!el)return null;
 const S={tab:'lobby',mode:A.LS('royMode')==='brs'?'brs':'br',diff:A.LS('royDiff')||'normal',fit:0,gun:A.LS('royGun')||'ar',ry:-.85,vry:0,emote:null,et:0,on:false,mates:[],drag:null};
 const getFit=()=>{const f=parseInt(A.LS('fit')||'0');return isNaN(f)?0:((f%OUTFITS.length)+OUTFITS.length)%OUTFITS.length};
 let R=null,scene=null,cam=null,hero=null,mates=[],raf=0,t0=0,ped=null,ring=null,thumbs=null,lastKey='';
 const cvHost=$('royStage');
 function build(){if(scene)return;R=A.r2();scene=new THREE.Scene();cam=new THREE.PerspectiveCamera(30,1,.1,60);
  scene.add(new THREE.HemisphereLight(0xdff2ff,0x7a6aa8,1.25));
  const key=new THREE.DirectionalLight(0xfff0d8,2.6);key.position.set(-2.5,4,-3.5);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9fd0ff,1.8);rim.position.set(3,2.5,3.5);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffc2e8,.7);fill.position.set(3,1,-3);scene.add(fill);
  ped=new THREE.Group();
  const top=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.05,.16,40),new THREE.MeshStandardMaterial({color:0xfdf3ff,roughness:.25,metalness:.15}));top.position.y=-.08;ped.add(top);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.3,.22,40),new THREE.MeshStandardMaterial({color:0x5b2bbf,roughness:.4,metalness:.2}));base.position.y=-.27;ped.add(base);
  ring=new THREE.Mesh(new THREE.TorusGeometry(1.0,.035,8,64),new THREE.MeshBasicMaterial({color:0xffd23f}));ring.rotation.x=Math.PI/2;ring.position.y=.005;ped.add(ring);
  const glow=new THREE.Mesh(new THREE.CircleGeometry(1.7,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.18,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=-.37;ped.add(glow);
  scene.add(ped)}
 function nm(){return (($('nameIn')&&$('nameIn').value)||'Player').slice(0,12)}
 function gunFor(m,id){const u=m.userData;if(!u.gunMount||!A.gun)return;u.gunMount.clear();const g=A.gun(id,u.outfit&&u.outfit.glove);if(g){u.gunMount.add(g);u.gunId=id}}
 function mkHero(){if(hero){scene.remove(hero)}hero=makeToon(0xffffff,nm(),'roy-me','#ffffff',S.fit);gunFor(hero,S.gun);hero.userData.tag.scale.set(1.3,.325,1);hero.position.set(0,0,0);scene.add(hero);hero.userData.args=null}
 function mkMates(){for(const m of mates)scene.remove(m);mates=[];const P=A.party&&A.party();const list=(P&&P.m?P.m:[]).filter(x=>x.code!==A.myCode()).slice(0,3);S.mates=list;
  list.forEach((x,i)=>{const m=makeToon(0xffffff,x.name||'Friend','mate-'+x.code,'#ffd23f',null);m.userData.tag.scale.set(1.1,.275,1);const sd=i===0?-1:i===1?1:0;m.position.set(sd?sd*1.55:0,0,sd?.55:1.4);gunFor(m,S.gun);m.scale.setScalar(.92);m.rotation.y=.5-sd*.25;scene.add(m);mates.push(m)})}
 function layout(){const w=cvHost.clientWidth||600,h=cvHost.clientHeight||400;const dpr=Math.min(window.devicePixelRatio||1,2);R.setPixelRatio(dpr);R.setSize(w,h);cam.aspect=w/h;
  // hero a bit left-of-centre on wide screens, framed head-to-toe
  const wide=w/h>1.2;cam.fov=wide?26:32;cam.position.set(0,1.35,-6.9+(wide?0:-.8));cam.lookAt(wide?-.05:0,1.02,0);cam.updateProjectionMatrix();if(R.domElement.parentNode!==cvHost){cvHost.innerHTML='';cvHost.appendChild(R.domElement)}R.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none'}
 function playEmote(n){S.emote=n;S.et=0}
 let idleT=0;
 function frame(now){if(!S.on)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-(t0||now))/1000);t0=now;
  S.ry+=S.vry*dt;S.vry*=Math.exp(-dt*2.5);if(!S.drag&&Math.abs(S.vry)<.05)S.ry+=Math.sin(now/2400)*.0015;
  if(hero){hero.rotation.y=S.ry;const st={speed:0,hold:true,pitch:-.22,lz:-1,lx:0,noTag:false,dist:3,emote:S.emote,lobby:1};if(S.emote){S.et+=dt;if(S.et>(EMOTE_DUR[S.emote]||3)+.2)S.emote=null}else{idleT+=dt;if(idleT>7&&!S.still){idleT=0;playEmote(['wave','cheer','flex'][Math.random()*3|0])}}animToon(hero,st,dt)}
  mates.forEach((m,i)=>{animToon(m,{speed:0,hold:true,pitch:0,lz:-1,lx:0,dist:3,emote:null},dt)});
  if(ring)ring.rotation.z=now/3000;
  R.setClearColor(0,0);R.render(scene,cam)}
 function start(){if(S.on)return;S.on=true;build();S.fit=getFit();mkHero();mkMates();layout();t0=0;raf=requestAnimationFrame(frame);playEmote('wave')}
 function stop(){S.on=false;cancelAnimationFrame(raf);if(R)R.setPixelRatio(1)}
 // ---- UI
 function rarTag(o){return `<i style="background:${RC[o.rar||0]}">${RARN[o.rar||0]}</i>`}
 function makeThumbs(){if(thumbs)return;thumbs=[];const was=hero;const w=R.domElement.width,h=R.domElement.height;const dpr=R.getPixelRatio();R.setPixelRatio(1);R.setSize(150,190);const c2=new THREE.PerspectiveCamera(26,150/190,.1,40);c2.position.set(0,1.05,-5.2);c2.lookAt(0,.95,0);
  if(hero)hero.visible=false;for(const m of mates)m.visible=false;if(ped)ped.visible=false;
  OUTFITS.forEach((o,i)=>{const m=makeToon(0xffffff,'','th'+i,'#fff',i,{noTag:true});m.rotation.y=.5;scene.add(m);animToon(m,{speed:0,hold:false,relax:true,pitch:0,lz:-1,lx:0,noTag:true},.016);R.setClearColor(0,0);R.render(scene,c2);thumbs[i]=R.domElement.toDataURL('image/png');scene.remove(m)});
  if(hero)hero.visible=true;for(const m of mates)m.visible=true;if(ped)ped.visible=true;R.setPixelRatio(dpr);layout()}
 function GUNS(){const Ws=A.W||{};return ['ar','ak47','smg','shotgun','sniper','dmr','handgun','revolver','lmg','rpg','knife','katana'].filter(k=>Ws[k]).map(k=>({id:k,n:Ws[k].name}))}
 function setGun(id){S.gun=id;A.LSS('royGun',id);gunFor(hero,id);mates.forEach(m=>gunFor(m,id));playEmote(null);S.emote=null;render()}
 function renderLocker(){const cur=S.fit;let h='<div class="rl">OUTFITS</div><div class="outGrid">';
  OUTFITS.forEach((o,i)=>{h+=`<button class="outCard ${i===cur?'sel':''}" data-o="${i}" style="--rc:${RC[o.rar||0]}"><img alt="" src="${thumbs?thumbs[i]:''}"><b>${o.name}</b>${rarTag(o)}${i===cur?'<span class="eq">✔ EQUIPPED</span>':''}</button>`});
  h+='</div><div class="rl">SHOWCASE WEAPON <small>tap to hold</small></div><div class="emoRow">'+GUNS().map(g=>`<button class="pill ${g.id===S.gun?'yellow':''}" data-g="${g.id}">${g.n}</button>`).join('')+'</div>';
  h+='<div class="rl">EMOTES <small>tap to preview</small></div><div class="emoRow">'+EMOTES.map(e=>`<button class="pill" data-e="${e}">${EMO_LBL[e]||e}</button>`).join('')+'</div>';
  $('royLocker').innerHTML=h}
 function party(){const P=A.party&&A.party();const lead=A.partyLead&&A.partyLead();const sq=S.mode==='brs';
  let h=`<div class="pMemRow"><b>👥 ${P?'PARTY '+P.m.length+'/4':'NO PARTY'}</b>`;if(P)h+=P.m.map(x=>`<span class="${x.code===P.lead?'lead':''}">${x.code===P.lead?'👑 ':''}${A.esc(x.name)}</span>`).join('');h+='</div>';
  h+=`<div class="royBtns"><button id="royInvite" class="pill yellow">➕ INVITE FRIENDS</button>${P?'<button id="royLeave" class="pill">LEAVE PARTY</button>':''}</div>`;
  h+=`<p class="royHint">${sq?'Squad: you and your party drop together; empty slots are filled by bots.':'Solo: every hero for themselves — 24 players, last one standing wins.'}${P&&!lead?' <b>Only the party leader can press PLAY.</b>':''}</p>`;return h}
 function render(){const sq=S.mode==='brs';const P=A.party&&A.party();const canPlay=!P||A.partyLead();
  $('royTabs').innerHTML=`<button data-t="lobby" class="${S.tab==='lobby'?'sel':''}">🏝️ LOBBY</button><button data-t="locker" class="${S.tab==='locker'?'sel':''}">🎒 LOCKER</button>`;
  $('royLobby').style.display=S.tab==='lobby'?'':'none';$('royLocker').style.display=S.tab==='locker'?'':'none';
  if(S.tab==='lobby'){$('royLobby').innerHTML=`<div class="royMode"><button data-m="br" class="${!sq?'sel':''}">🧍 SOLO</button><button data-m="brs" class="${sq?'sel':''}">👥 SQUAD</button></div>
   <div class="royInfo">🏝️ Skyline Island · 24 players · loot · storm</div>${party()}
   <div class="royDiff"><span>BOTS</span>${['easy','normal','hard'].map(d=>`<button data-d="${d}" class="${S.diff===d?'sel':''}">${d.toUpperCase()}</button>`).join('')}</div>
   <button id="royPlay" class="btnBig yellow royPlay" ${canPlay?'':'disabled'}>▶ PLAY</button>`}
  else renderLocker();
  $('royName').textContent=OUTFITS[S.fit].name;$('royRar').innerHTML=rarTag(OUTFITS[S.fit])}
 function setFit(i){S.fit=i;A.LSS('fit',String(i));mkHero();playEmote('cheer');render()}
 function open(){A.audioInit&&A.audioInit();el.classList.remove('hidden');$('menu').classList.add('hidden');S.tab='lobby';S.fit=getFit();
  requestAnimationFrame(()=>{start();render();if(!thumbs)setTimeout(()=>{if(S.on){makeThumbs();if(S.tab==='locker')renderLocker()}},400)})}
 function close(){el.classList.add('hidden');stop();$('menu').classList.remove('hidden')}
 function play(){const P=A.party&&A.party();if(P&&!A.partyLead())return;A.LSS('royMode',S.mode);A.LSS('royDiff',S.diff);el.classList.add('hidden');stop();A.play(S.mode,{diff:S.diff,pub:true})}
 el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.t){S.tab=b.dataset.t;render();if(S.tab==='locker'&&!thumbs&&S.on){setTimeout(()=>{makeThumbs();renderLocker()},30)}}
  else if(b.dataset.m){S.mode=b.dataset.m;A.LSS('royMode',S.mode);render();mkMates()}
  else if(b.dataset.d){S.diff=b.dataset.d;render()}
  else if(b.dataset.o!=null)setFit(+b.dataset.o);
  else if(b.dataset.g)setGun(b.dataset.g);
  else if(b.dataset.e)playEmote(b.dataset.e);
  else if(b.id==='royPlay')play();else if(b.id==='royBack')close();else if(b.id==='royInvite')A.openFriends();else if(b.id==='royLeave'){A.partyLeave();render();mkMates()}});
 // drag to spin, tap hero to emote
 cvHost.addEventListener('pointerdown',e=>{S.drag={x:e.clientX,t:performance.now(),m:0};S.vry=0;try{cvHost.setPointerCapture(e.pointerId)}catch(x){}});
 cvHost.addEventListener('pointermove',e=>{if(!S.drag)return;const dx=e.clientX-S.drag.x;S.drag.x=e.clientX;S.drag.m+=Math.abs(dx);S.ry+=dx*.012;S.vry=dx*.012*60*.5});
 cvHost.addEventListener('pointerup',()=>{if(S.drag&&S.drag.m<6)playEmote(['wave','dance','flex','cheer'][Math.random()*4|0]);S.drag=null});
 addEventListener('resize',()=>{if(S.on)layout()});
 const api={get hero(){return hero},open,close,render,state:S,start,stop,refresh:()=>{if(S.on){mkMates();render()}}};return api}
