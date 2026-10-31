// HeadShotz – free browser multiplayer FPS. Three.js + PeerJS (host-authoritative star).
import {THREE,FX,TX,MC,G,mergeParts,GQ,texMat,swapMats,WT,GRASS_T,scatterGrass,makeSky,RET,GLASS,camoTex} from './gfx.js';
import {WSKINS,WSKIN_IDS,WSKIN_FEAT,applySkin,tickSkins,clearSkinCache} from './wskins.js';
import {SKIN_DEFS,SKIN_BY,SKIN_IDS,humanOutfit,splitSkin,joinSkin} from './skins.js';
import {BASE_N} from './toon.js';
import {initSkinShop} from './skinshop.js';import {initSidekicks,hostPets,hostAbility,luck as petLuck,SK_BY,SK_DEFS} from './sidekicks.js';import {initSidekickShop} from './sidekickshop.js';
import {Post} from './post.js';
import {loadAssets,HQP} from './assets.js';import {photoItems,clearPhotoCache,PHOTO} from './photoguns.js';import {initRoyale} from './royale.js';import {chestKit,TIERC,CHEST_HINGE} from './chests.js';import {EMOTES,EMOTE_DUR} from './toon.js';import {makeBus,makeGlider,makeWind,makeCloudField} from './airship.js';import * as ASSETS from './assets.js';
import {TURN} from './ice.js';
import {rebuildForProps,MAPS,buildMap,HUB_PADS,HUB_ST,HUB_I,padCircles,inPad,PAD_COL,BR_I,BR_INFO,updateCells} from './maps.js';let BC=null;const BRM=m=>m==='br'||m==='brs';const MI=i=>MAPS[i]||BR_INFO;const isQ=p=>!!(p.single||p.q);
import {W,CLASSES,LIMB,falloff,stats,gunParts,handParts,wristOut} from './weapons.js';
import {makeCharacter,animate,LOOKS,HUM} from './chars.js';import {loadHumans} from './humans.js';
// player classes: cosmetic look + small balanced perk. Host enforces HP/regen/revive; movement perks apply on the owner's client.
export const PCL={soldier:{n:'Soldier',p:0,ic:'🪖',perk:'No perk — the classic all-rounder.'},scout:{n:'Scout',p:700,ic:'🎯',perk:'Higher jump · slide recharges 2× faster.',jump:9.6,slideCd:.5},engineer:{n:'Engineer',p:800,ic:'🔧',perk:'+1 grenade / utility each life.',util:1},ninja:{n:'Ninja',p:900,ic:'🥷',perk:'+12% move speed · quiet footsteps · full 100 HP.',spd:1.12,quiet:1},medic:{n:'Medic',p:1100,ic:'⛑️',perk:'Revives teammates in 3 s (not 5) · regen 3 HP/s after 4 s unhurt.',rev:3,regen:3},juggernaut:{n:'Juggernaut',p:1500,ic:'🛡️',perk:'140 HP · 12% slower.',spd:.88,hp:140}};
const PCL_IDS=Object.keys(PCL);const clOf=k=>PCL[k]?k:'soldier';
const $=id=>document.getElementById(id);
const GAME='HeadShotz';
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const MODES={duel:['1v1 Duel','⚔️'],team:['2v2 Teams','👥'],t3:['3v3 Teams','🛡️'],t4:['4v4 Teams','🚩'],t5:['5v5 Teams','🏰'],ffa:['Free-For-All','💥'],ctf:['Capture the Flag','🏁'],ext:['Extraction','🚁'],raid:['Extraction Raid','🏴'],br:['Battle Royale','🪂'],brs:['Squad Royale','🪂']};
const MODEMAX={duel:2,team:4,t3:6,t4:8,t5:10,ffa:10,ctf:8,ext:4,raid:9,br:24,brs:24},MAXP=10;const isTeamMode=m=>m!=='ffa'&&m!=='duel'&&m!=='br';
// down-and-revive (team modes): bleed-out 20 s, downed HP pool 50, revive = stand within 1.5 m for 5 s (progress resets if the reviver leaves), revived with 30 HP
const DOWN={bleed:20,hp:50,r:1.5,revive:5,revHp:30};
const DIFF={easy:{hit:.22,react:.9,turn:3.5,head:.06},normal:{hit:.33,react:.72,turn:5,head:.11},hard:{hit:.58,react:.35,turn:9,head:.24}};
window.__DIFF=DIFF;
const WIN_ROUNDS=5,FFA_ROUND_KILLS=3;
const TEAMCOL={A:0x3fa9ff,B:0xff5a6b};
const FFACOL=[0x3fa9ff,0xff5a6b,0x2ee59d,0xffd23f,0xb06bff,0xff9f43,0x1dd1a1,0xff79c6,0xf8f8f8,0x8d6e63];
const hex=c=>'#'+new THREE.Color(c).getHexString();
// optional local profile (?prof=2) = separate save on the same device (used for multi-tab friend tests); remembered per tab
const PROF=(()=>{let p=new URLSearchParams(location.search).get('prof');try{if(p!=null)sessionStorage.setItem('hsz_prof',p);else p=sessionStorage.getItem('hsz_prof')}catch(e){}return(p||'').replace(/[^a-z0-9]/gi,'').slice(0,8)})();const LSP='hsz'+PROF+'_';
const LS=k=>{try{return localStorage.getItem(LSP+k)}catch(e){return null}},LSS=(k,v)=>{try{localStorage.setItem(LSP+k,v)}catch(e){}};
// ---------------- settings ----------------
const S=Object.assign({sens:1,zsens:1,aimAssist:true,quality:'auto',vol:.85,sfx:1,voice:true,reduceMotion:false},JSON.parse(LS('settings')||'{}'));{const qq=new URLSearchParams(location.search).get('q');if(['low','medium','high'].includes(qq))S.quality=qq}
try{if(S.reduceMotion)document.body.classList.add('rm')}catch(e){}
function saveS(){LSS('settings',JSON.stringify(S))}
// ---------------- renderer ----------------
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:S.quality!=='low',powerPreference:'high-performance',stencil:false});
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
// quality presets: low (Lambert, no post), medium (PBR + env reflections + water shader + grass), high (+ sun shadows, bloom/grading post, dust)
let autoLevel='high',qGrace=0;
function qLevel(){return S.quality==='auto'?autoLevel:S.quality}
GQ.level=qLevel();
let pixelRatio=1;function basePR(){const l=qLevel();return l==='low'?Math.min(devicePixelRatio,1):l==='high'?Math.min(devicePixelRatio,isTouch?1.5:2):Math.min(devicePixelRatio,isTouch?1.3:1.5)}
pixelRatio=basePR();renderer.setPixelRatio(pixelRatio);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75,1,.03,600);camera.rotation.order='YXZ';scene.add(camera);
const hemi=new THREE.HemisphereLight(0xffffff,0x666666,1.3);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.6);scene.add(sun);scene.add(sun.target);
sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);{const c=sun.shadow.camera;c.left=c.bottom=-34;c.right=c.top=34;c.near=1;c.far=220}sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;
let post=null;const envCache={};let pmrem=null;
function envFor(i){if(envCache[i])return envCache[i];if(!pmrem)pmrem=new THREE.PMREMGenerator(renderer);const d=cur.def;const sc=new THREE.Scene();
 const sk=d.indoor?makeSky(0x6b7a8c,0x3b4656,0x262b33,null,0xffffff,{clouds:false}):makeSky(d.sky[0],d.sky[1],d.sky[2],cur.sunDir,d.sun[0],{clouds:false});sc.add(sk);if(ASSETS.skyTex&&!d.indoor){const hm=new THREE.Mesh(new THREE.SphereGeometry(350,32,16),new THREE.MeshBasicMaterial({map:ASSETS.skyTex,side:THREE.BackSide,transparent:true,opacity:.55,depthWrite:false,fog:false}));sc.add(hm)}
 const gnd=new THREE.Mesh(new THREE.CircleGeometry(300,24),new THREE.MeshBasicMaterial({color:new THREE.Color(d.hemi[1]).multiplyScalar(.6)}));gnd.rotation.x=-Math.PI/2;gnd.position.y=-6;sc.add(gnd);
 if(d.indoor)for(let k=0;k<6;k++){const p=new THREE.Mesh(new THREE.PlaneGeometry(6,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3)}));p.rotation.x=Math.PI/2;p.position.set((k%3-1)*8,6,k<3?-4:4);sc.add(p)}
 return envCache[i]=pmrem.fromScene(sc,.02).texture}
const fx=new FX(scene);
fx.onShellHit=(p,h)=>SFX.shellHit(p,h);
let inGame=false;
function resize(){document.body.classList.toggle('playing',inGame);try{updCamBtn()}catch(e){}const vv=window.visualViewport;const w=Math.round(vv?vv.width:innerWidth)||innerWidth,h=Math.round(vv?vv.height:innerHeight)||innerHeight;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();$('rotate').classList.toggle('need',isTouch&&inGame)}
addEventListener('resize',resize);addEventListener('orientationchange',()=>{resize();setTimeout(resize,300);setTimeout(resize,900)});
if(window.visualViewport)visualViewport.addEventListener('resize',resize);
// iOS gesture guards (menus still scroll)
for(const ev of['gesturestart','gesturechange','gestureend'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1&&!e.target.closest('#touch')){e.preventDefault();return}if(inGame&&!e.target.closest('#pause,#arsenal,#settings,#menuBtn'))e.preventDefault()},{passive:false});
// Reliable taps: on touch/pen, activate buttons on pointerup ourselves. iOS Safari drops the synthetic click when the finger moves a
// little, when another finger is down (thumb on the joystick), or when touchmove was prevented - that made the in-game menu feel dead.
const TAPSEL='button,.wc,.mode,.map,[data-q],[data-tap],#arsTabs > *';
let tapDown=null,tapSynth=false;
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){tapDown=null;return}const b=e.target.closest&&e.target.closest(TAPSEL);if(!b||b.closest('#touch')||b.closest('#slots')){tapDown=null;return}tapDown={b,id:e.pointerId,x:e.clientX,y:e.clientY}},true);
document.addEventListener('pointerup',e=>{const d=tapDown;if(!d||e.pointerId!==d.id)return;tapDown=null;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>26)return;
 const el=document.elementFromPoint(e.clientX,e.clientY);const b=el&&el.closest(TAPSEL);if(b!==d.b||b.disabled)return;b.__tap=performance.now();lastSynth={t:b.__tap,x:e.clientX,y:e.clientY};tapSynth=true;try{b.click()}finally{tapSynth=false}},true);
document.addEventListener('pointercancel',e=>{if(tapDown&&e.pointerId===tapDown.id)tapDown=null},true);
// ghost-click buster (v42): after a synthesized tap the browser still fires its own click at the same spot ~50-300 ms later. If the tap opened a modal, that
// click used to land on whatever button was now under the finger (e.g. Cancel on the Play Online picker) and close/choose it by accident. Swallow ANY native click that
// follows a synthesized tap near the same point, whatever the target is.
let lastSynth=null;document.addEventListener('click',e=>{if(tapSynth)return;const L=lastSynth;if(L&&performance.now()-L.t<700&&(e.clientX===0&&e.clientY===0||Math.hypot(e.clientX-L.x,e.clientY-L.y)<48)){window.__ghostClicks=(window.__ghostClicks||0)+1;lastSynth=null;e.stopPropagation();e.preventDefault();return}const b=e.target.closest&&e.target.closest(TAPSEL);if(b&&b.__tap&&performance.now()-b.__tap<800){e.stopPropagation();e.preventDefault()}},true);
let lastTouchEnd=0;document.addEventListener('touchend',e=>{const n=Date.now();if(inGame&&n-lastTouchEnd<300&&!e.target.closest('button,input'))e.preventDefault();lastTouchEnd=n},{passive:false});
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
if(isIOS&&!standalone)$('iosTip').classList.remove('hidden');
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{r.update().catch(()=>{});setInterval(()=>r.update().catch(()=>{}),15*60000)}).catch(()=>{});let swR=false;const had=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||swR)return;swR=true;const go=()=>{if(!inGame)location.reload();else setTimeout(go,5000)};go()})}
// ---------------- audio ----------------
let AC=null,noiseBuf=null,master=null,verb=null,mVol=null,VB={},VOX=0;const MAXV=isIOS?30:56;let outdoor=true;
// all sounds are synthesised live with Web Audio (no samples, no third-party assets)
function setVolumes(){if(!AC)return;mVol.gain.value=S.vol;master.gain.value=S.sfx*.8}
function setVerb(indoor){outdoor=!indoor;if(!AC||!VB.dl)return;const t=AC.currentTime;VB.dl.delayTime.setTargetAtTime(indoor?.045:.19,t,.05);VB.fb.gain.setTargetAtTime(indoor?.52:.2,t,.05);VB.lp.frequency.setTargetAtTime(indoor?2400:1200,t,.05);verb.gain.setTargetAtTime(indoor?.5:.3,t,.05)}
function audioUnlock(){if(!AC)return;try{const b=AC.createBuffer(1,1,22050),s=AC.createBufferSource();s.buffer=b;s.connect(AC.destination);s.start(0)}catch(e){}if(AC.state==='suspended')AC.resume()}
['touchend','pointerdown','keydown'].forEach(ev=>addEventListener(ev,function u(){audioInit();audioUnlock();if(AC&&AC.state==='running')removeEventListener(ev,u,true)},true));
function listen(){if(!AC||!AC.listener)return;const L=AC.listener,c=camera.position,f=_lv.set(0,0,-1).applyQuaternion(camera.quaternion),u=_lu.set(0,1,0).applyQuaternion(camera.quaternion);
 if(L.positionX){const t=AC.currentTime;L.positionX.setValueAtTime(c.x,t);L.positionY.setValueAtTime(c.y,t);L.positionZ.setValueAtTime(c.z,t);L.forwardX.setValueAtTime(f.x,t);L.forwardY.setValueAtTime(f.y,t);L.forwardZ.setValueAtTime(f.z,t);L.upX.setValueAtTime(u.x,t);L.upY.setValueAtTime(u.y,t);L.upZ.setValueAtTime(u.z,t)}else{L.setPosition(c.x,c.y,c.z);L.setOrientation(f.x,f.y,f.z,u.x,u.y,u.z)}}
const _lv=new THREE.Vector3(),_lu=new THREE.Vector3();
function audioInit(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();
 noiseBuf=AC.createBuffer(1,AC.sampleRate*.6,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 master=AC.createGain();mVol=AC.createGain();const comp=AC.createDynamicsCompressor();master.connect(mVol);mVol.connect(comp);comp.connect(AC.destination);setVolumes();
 // cheap "room" tail: feedback delay
 const dl=AC.createDelay(.5);dl.delayTime.value=.09;const fb=AC.createGain();fb.gain.value=.28;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1600;
 verb=AC.createGain();verb.gain.value=.35;verb.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(master);VB={dl,fb,lp};setVerb(!outdoor)}catch(e){}}
function out(pan){if(!AC)return null;let n=master;if(pan&&typeof pan==='object'){const P=AC.createPanner();P.panningModel=isIOS?'equalpower':'HRTF';P.distanceModel='linear';P.rolloffFactor=0;if(P.positionX){P.positionX.value=pan.x;P.positionY.value=pan.y;P.positionZ.value=pan.z}else P.setPosition(pan.x,pan.y,pan.z);P.connect(master);return P}if(pan&&AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));p.connect(master);n=p}return n}
function env(node,vol,dur,dest,att=.002){const g=AC.createGain();const t=AC.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0008,t+dur);node.connect(g);g.connect(dest);return g}
function noise(type,freq,q,dur,vol,dest,wet=0,att){if(!AC||!dest||VOX>=MAXV)return;VOX++;setTimeout(()=>VOX--,(dur+.06)*1000);const s=AC.createBufferSource();s.buffer=noiseBuf;s.playbackRate.value=.8+Math.random()*.4;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;s.connect(f);
 const g=env(f,vol,dur,dest,att);if(wet&&verb){const w=AC.createGain();w.gain.value=wet;g.connect(w);w.connect(verb)}s.start();s.stop(AC.currentTime+dur+.05)}
function tone(freq,dur,vol,type,slide,dest,att){if(!AC||!dest||VOX>=MAXV)return;VOX++;setTimeout(()=>VOX--,(dur+.06)*1000);const o=AC.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(freq,AC.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(slide,AC.currentTime+dur);env(o,vol,dur,dest,att);o.start();o.stop(AC.currentTime+dur+.05)}
const SUPP={mk18:1};const GV=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))|0;return .92+((h>>>0)%1000)/1000*.16};
const FUNV={
 water:(v,d)=>{noise('bandpass',1100,1.2,.09,v*.5,d,0,.01);noise('highpass',3000,.7,.05,v*.25,d)},
 paintball:(v,d)=>{tone(320,.05,v*.8,'sine',140,d,.001);noise('bandpass',1800,2,.04,v*.5,d,.15,.001);noise('highpass',4000,1,.03,v*.25,d,0,.001)},
 laser:(v,d)=>{tone(1900,.14,v*.4,'sawtooth',300,d,.001);tone(3800,.1,v*.2,'sine',900,d,.001);noise('highpass',6000,1,.05,v*.15,d,.3,.001)},
 freeze:(v,d)=>{noise('highpass',4500,.7,.12,v*.35,d,.2,.01);tone(2400+Math.random()*900,.12,v*.08,'sine',3200,d,.01)},
 flare:(v,d)=>{tone(160,.1,v*.7,'sine',60,d,.001);noise('bandpass',900,1,.08,v*.6,d,.3,.001);noise('highpass',2500,.6,.9,v*.2,d,0,.05)},
 taser:(v,d)=>{for(let i=0;i<5;i++)setTimeout(()=>{tone(90+Math.random()*60,.04,v*.5,'square',60,d,.001);noise('highpass',3500,2,.03,v*.35,d)},i*35)},
};
const SFX={
 // layered gunshot: punch (body thump) + crack (supersonic snap) + mechanical (action clack) + tail (room/outdoor decay).
 // dist>0 = someone else's shot: high frequencies roll off, mechanics vanish, tail delayed slightly (speed of sound feel)
 gun(id,vol=1,pan=0,dist=0){const w=W[id];if(!AC||!w)return;const s0=w.snd||{f:1500,d:.1,b:120,v:.5};const hv=GV(id);const s={...s0,f:s0.f*hv,b:s0.b*(2-hv)};let d=out(pan);const v=s.v*vol;
  if(FUNV[id]){FUNV[id](v,d,dist);return}
  if(SUPP[id]){tone(s.b*1.2,.06,v*.7,'sine',s.b*.4,d,.001);noise('lowpass',700,.8,.07,v*.75,d,.12,.001);noise('bandpass',2400,3,.03,v*.25,d,0,.001);if(!dist||dist<10)setTimeout(()=>SFX.click(1800,.16*vol),18);return}
  if(s.pop){tone(s.b*2.2,.05,v,'sine',s.b,d,.001);noise('bandpass',s.f*2,2,.05,v*.7,d,.2,.001);return}
  if(s.zap){tone(s.f,.09,v*.7,'sawtooth',s.f*.25,d,.001);tone(s.f*1.5,.06,v*.4,'square',s.f*.5,d,.001);noise('highpass',5000,1,.04,v*.3,d,.2,.001);return}
  if(dist>4){const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.max(700,9000-dist*95);lp.connect(d);d=lp}
  const big=w.cls==='sniper'||w.pellets||w.cls==='lmg'||w.proj,pis=w.cls==='pistol';
  tone(s.b*1.6,.07,v*1.1,'sine',s.b*.35,d,.001);noise('lowpass',s.f*.55,.9,s.d*.7,v*1.05,d,.25,.001);
  noise('bandpass',s.f*1.7,1.1,Math.min(.05,s.d*.45),v*(dist>30?.35:.85),d,.15,.0008);
  if(s.crack||w.cls==='sniper'||w.cls==='marksman')noise('highpass',3800,.8,.045,v*.75,d,.2,.0005);
  if(!dist||dist<8){setTimeout(()=>{noise('bandpass',pis?3400:2600,6,.025,v*.22,d);tone(pis?1800:1300,.02,v*.08,'square',0,d)},12+Math.random()*10)}
  if(big&&outdoor&&dist<200){const e=()=>noise('lowpass',420,.5,.5,v*.28,d,.4,.02);setTimeout(e,280+Math.random()*60);setTimeout(()=>noise('lowpass',300,.5,.7,v*.16,d,.3,.04),620)}
  const tl=(big?.55:.32)+s.d,del=dist>15?Math.min(.12,dist/340*.5):0;const tail=()=>noise('lowpass',big?700:1100,.6,tl,v*(dist?.55:.38),d,.9,.01);del?setTimeout(tail,del*1000):tail();
  if(w.pellets)noise('lowpass',480,.5,s.d*1.6,v*.6,d,.5)},
 dry(){tone(2400,.015,.12,'square',0,out());noise('bandpass',3000,6,.02,.12,out())},
 ping(){const d=out();tone(2950,.5,.09,'sine',2900,d,.001);tone(5900,.3,.04,'sine',0,d,.001)},
 charge(){noise('bandpass',1700,3,.06,.2,out());setTimeout(()=>{noise('bandpass',2300,3,.04,.2,out());SFX.click(1500,.24)},150)},
 pin(){const d=out();noise('bandpass',4200,5,.03,.12,d);setTimeout(()=>{tone(3600,.08,.05,'sine',3200,d);noise('highpass',5000,2,.05,.06,d)},70)},
 spoon(p){const d=out(p);tone(5200+Math.random()*600,.18,.06,'sine',4700,d,.001);setTimeout(()=>tone(4300,.12,.04,'sine',0,d),120)},
 clink(p,v=1){const d=out(p);tone(1900+Math.random()*900,.1,.08*v,'triangle',1500,d,.001);noise('bandpass',2600,4,.03,.08*v,d)},
 shellHit(p,hull){const dd=camera.position.distanceTo(p);if(dd>14)return;const v=1-dd/14;hull?noise('bandpass',650,2,.05,.07*v,out(p)):tone(5600+Math.random()*1600,.07,.04*v,'sine',5200,out(p),.001)},
 imp(k,p,v=1){if(!AC)return;const n=performance.now();if(n-(SFX._it||0)<28)return;SFX._it=n;const dd=camera.position.distanceTo(p);if(dd>45)return;v*=Math.max(.15,1-dd/45);const d=out(p);
  if(k==='metal'){tone(2600+Math.random()*2400,.16,.12*v,'triangle',2200,d,.001);noise('highpass',4000,1,.03,.12*v,d)}
  else if(k==='wood'){noise('bandpass',520,3,.06,.25*v,d);tone(260,.05,.12*v,'sine',180,d)}
  else if(k==='glass'){for(let i=0;i<4;i++)setTimeout(()=>tone(4500+Math.random()*3000,.12,.05*v,'sine',0,d,.001),i*25);noise('highpass',5000,1,.12,.15*v,d)}
  else if(k==='dirt'){noise('lowpass',320,.7,.08,.28*v,d)}else if(k==='water'){noise('bandpass',900,1,.15,.2*v,d,0,.01)}else if(k==='soft'){noise('lowpass',500,.7,.05,.15*v,d)}
  else{noise('bandpass',1900,1.2,.05,.25*v,d);noise('lowpass',420,.8,.05,.15*v,d)}},
 whizz(p,snap){const d=out(p);if(snap){noise('highpass',3500,.8,.03,.35,d,0,.001)}noise('bandpass',1400,3,.18,.18,d,0,.06);tone(900,.18,.05,'sine',500,d,.08)},
 mHit(){const d=out();noise('lowpass',380,.8,.09,.4,d,.1,.002);tone(140,.08,.25,'sine',70,d)},
 rumble(v=1,p){const d=out(p);tone(42,1.6,.35*v,'sine',26,d,.05);noise('lowpass',160,.5,1.8,.4*v,d,.5,.08)},
 ring(v=1){const d=out();tone(3800,2.2*v+.3,.035*v,'sine',3750,d,.02)},
 shatter(p,v=1){const d=out(p);noise('highpass',3000,.7,.25,.45*v,d,.2,.001);for(let i=0;i<7;i++)setTimeout(()=>tone(3500+Math.random()*4500,.15,.06*v,'sine',0,d,.001),i*22+Math.random()*30)},
 crackle(p,v=1){const d=out(p);for(let i=0;i<3;i++)setTimeout(()=>noise('bandpass',1800+Math.random()*2500,3,.012,.18*v,d),Math.random()*200);noise('lowpass',380,.6,.35,.06*v,d)},
 fwhoosh(p,v=1){const d=out(p);noise('lowpass',900,.6,1,.55*v,d,.3,.08);noise('bandpass',350,.8,.8,.35*v,d,0,.05)},
 click(f=2600,v=.16){noise('bandpass',f,7,.022,v,out());tone(f*.5,.012,v*.4,'square',0,out())},
 boltUp(){SFX.click(2200,.14)},boltBack(){noise('bandpass',1900,3,.06,.2,out());SFX.click(3200,.12)},boltFwd(){noise('bandpass',2400,3,.05,.2,out());setTimeout(()=>SFX.click(1700,.22),40)},
 slideRel(){noise('bandpass',2600,3,.05,.22,out());setTimeout(()=>SFX.click(1500,.22),30)},
 pump(){noise('bandpass',1100,2,.08,.25,out());setTimeout(()=>{noise('bandpass',1400,2,.07,.25,out());SFX.click(1200,.2)},140)},
 lever(){noise('bandpass',1500,2.5,.07,.2,out());setTimeout(()=>SFX.click(1900,.2),180)},
 shellIn(){noise('bandpass',1800,4,.035,.18,out());setTimeout(()=>SFX.click(2600,.1),35)},
 cylOpen(){SFX.click(2800,.14);noise('bandpass',3500,5,.05,.08,out())},cylClose(){SFX.click(1600,.24);setTimeout(()=>tone(4200,.15,.03,'sine',0,out()),20)},
 shellsOut(){for(let i=0;i<6;i++)setTimeout(()=>tone(4800+Math.random()*1800,.06,.035,'sine',0,out()),250+i*45+Math.random()*30)},
 breakOpen(){noise('bandpass',900,2,.08,.22,out());SFX.click(1500,.2)},breakClose(){SFX.click(1100,.3);noise('lowpass',800,1,.05,.2,out())},
 lid(){noise('bandpass',1200,3,.06,.2,out());SFX.click(1400,.2)},
 saw(v=1){tone(105+Math.random()*20,.13,.32*v,'sawtooth',85,out(),.005);tone(210,.12,.12*v,'square',160,out(),.005);noise('bandpass',1800,1.5,.12,.22*v,out(),.3,.005)},
 bonk(){tone(620,.25,.35,'sine',560,out());tone(1240,.2,.15,'sine',1100,out());noise('bandpass',2500,4,.03,.2,out())},
 melee(){noise('bandpass',900,1.2,.14,.25,out(),0,.04)},hit(){tone(1250,.05,.18,'square',0,out());tone(2500,.04,.08,'sine',0,out())},
 // headshot: sharp helmet/skull CRACK (bright transient) + short snap + small ding; throttled for rapid fire (crack only every 90 ms, ding every 160 ms)
 head(){const d=out();const n=performance.now(),H=SFX._hs||(SFX._hs={c:0,d:0});(window.__hsSfx=window.__hsSfx||{n:0,crack:0,kill:0}).n++;
  if(n-H.c>=90){H.c=n;window.__hsSfx.crack++;noise('highpass',5200,.7,.014,.55,d,0,.0005);noise('bandpass',3400,3.5,.045,.42,d,.05,.0008);tone(1900,.03,.14,'square',700,d,.0005);tone(210,.07,.16,'triangle',95,d,.001);
   setTimeout(()=>noise('bandpass',1800,6,.03,.28,d,.03,.0005),14)}
  if(n-H.d>=160){H.d=n;setTimeout(()=>{tone(2950,.24,.12,'sine',2920,d,.002);tone(5900,.14,.04,'sine',0,d,.002)},28)}},
 headKill(){const d=out();(window.__hsSfx=window.__hsSfx||{n:0,crack:0,kill:0}).kill++;noise('highpass',4500,.7,.02,.6,d,.1,.0005);noise('bandpass',2600,2.5,.07,.4,d,.15,.001);tone(160,.12,.2,'triangle',70,d,.001);
  setTimeout(()=>{tone(2350,.32,.15,'sine',2340,d,.002);tone(3520,.36,.11,'sine',0,d,.003)},40);setTimeout(()=>tone(4700,.4,.08,'sine',0,d,.003),120)},
 hurt(){tone(180,.18,.25,'sawtooth',90,out());noise('lowpass',400,.5,.12,.2,out())},
 step(){noise('lowpass',260+Math.random()*120,.8,.06,.14,out())},land(){noise('lowpass',200,.8,.1,.25,out())},
 jump(){noise('lowpass',500,.6,.08,.12,out())},slide(){noise('bandpass',1500,.5,.4,.12,out(),0,.05)},crouch(){noise('lowpass',700,.8,.07,.1,out())},door(open,p,v){const d=out(panOf(p));if(!d)return;if(open){tone(120,.4,.13*v,'sawtooth',175,d);noise('bandpass',900,2,.3,.07*v,d,0,.05)}else{noise('lowpass',380,1,.14,.4*v,d);tone(72,.14,.35*v,'sine',44,d);setTimeout(()=>tone(150,.2,.05*v,'sawtooth',110,d),40)}},
 magOut(){SFX.click(2300,.14);setTimeout(()=>noise('bandpass',900,2,.06,.12,out()),60)},magIn(){noise('bandpass',1500,3,.05,.15,out());setTimeout(()=>{SFX.click(1300,.26);noise('lowpass',600,1,.04,.15,out())},70)},
 bolt(){noise('bandpass',3000,3,.05,.2,out());setTimeout(()=>noise('bandpass',2200,3,.06,.2,out()),110)},
 shell(t){const sh=t==='shot';setTimeout(()=>{sh?noise('bandpass',700,2,.06,.05,out()):tone((t==='pistol'?6200:5200)+Math.random()*1500,.06,.03,'sine',0,out())},380+Math.random()*200)},
 swap(){noise('bandpass',2000,2,.06,.12,out())},
 boom(vol=1,pan=0){const d=out(pan);noise('highpass',1500,.6,.06,.6*vol,d,.2,.001);noise('lowpass',380,.6,1.1,.95*vol,d,.8);tone(70,.9,.75*vol,'sine',26,d);noise('bandpass',1500,.8,.25,.4*vol,d,.5);SFX.rumble(vol,pan);if(outdoor)setTimeout(()=>noise('lowpass',300,.5,.9,.25*vol,d,.5,.05),350)},
 bang(vol=1){const d=out();noise('highpass',1200,.5,.4,.9*vol,d,.6);tone(3600,2.5*vol,.06*vol,'sine',3400,d)},
 whoosh(){noise('bandpass',700,.6,.6,.35,out(),.3,.05)},hiss(p){const d=out(p);noise('highpass',2500,.5,1.5,.14,d,0,.05);setTimeout(()=>noise('highpass',3200,.5,2.5,.12,d,0,.3),1200);setTimeout(()=>noise('highpass',3000,.5,3,.08,d,0,.5),3200)},
 kill(){tone(660,.09,.2,'triangle',0,out());setTimeout(()=>tone(990,.14,.2,'triangle',0,out()),90)},
 beep(f=700){tone(f,.12,.18,'sine',0,out())},heal(){tone(500,.25,.2,'sine',1000,out())},throw(){noise('bandpass',600,.8,.18,.2,out(),0,.03)}};
// ---------------- map / collision ----------------
let cur=null,cols=[],groundHalf=[1e9,1e9],ladders=[],hides=[];
const inVol=(L,p,pad=0)=>{for(const v of L)if(p.x>v.x0-pad&&p.x<v.x1+pad&&p.z>v.z0-pad&&p.z<v.z1+pad&&p.y>v.y0&&p.y<v.y1)return v;return null};
function loadMap(i){qGrace=performance.now()+5000;if(cur){scene.remove(cur.group);if(cur.sky)scene.remove(cur.sky)}cur=buildMap(i);doorReset(cur);cols=cur.cols;groundHalf=cur.groundHalf;buildGrid();ladders=cur.ladders||[];hides=cur.hides||[];ambSetup();setVerb(!!(cur.def&&cur.def.indoor));initFireLights();
 scene.add(cur.group);if(cur.sky)scene.add(cur.sky);const d=cur.def;
 scene.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);scene.fog=new THREE.Fog(d.fog[0],d.fog[1],d.fog[2]);
 hemi.color.set(d.hemi[0]);hemi.groundColor.set(d.hemi[1]);hemi.intensity=d.hemi[2];sun.color.set(d.sun[0]);sun.intensity=d.sun[1];sun.position.copy(cur.sunDir).multiplyScalar(50);
 fx.dec.count=0;fx.decI=0;fx.scor.count=0;fx.scorI=0;smokes.length=0;fires.length=0;applyQuality()}
function applyQuality(){const lvl=qLevel();GQ.level=lvl;const hi=lvl!=='low';qGrace=performance.now()+4500;
 const shOn=lvl==='high'&&!(cur&&cur.def.indoor);renderer.shadowMap.enabled=shOn;sun.castShadow=shOn;renderer.shadowMap.needsUpdate=true;
 swapMats(scene);resetVMs();document.body.dataset.q=lvl;if(C.players)for(const k in C.players){const q=C.players[k];if(q.gunId){q.gunId=null;q.gunSk=null}}
 if(cur){const d=cur.def;const env=hi?envFor(cur.def.name):null;scene.environment=env;vmScene.environment=lvl!=='low'?envFor(cur.def.name):null;
  hemi.intensity=d.hemi[2]*(hi?.62:1);vmHemi.color.set(d.hemi[0]);vmHemi.groundColor.set(d.hemi[1]);vmHemi.intensity=d.hemi[2]*(lvl!=='low'?.75:.9);vmSun.color.set(d.sun[0]);vmSun.intensity=d.sun[1]*.95;vmFill.intensity=lvl!=='low'?.9:.4;
  if(cur.water)cur.water.material=hi?cur.water.userData.hi:cur.water.userData.lo;
  // grass (built once per map per density)
  const want=lvl==='high'?1:lvl==='medium'?.5:0;if(cur.grassK!==want){if(cur.grassMesh){for(const gm of cur.grassMesh)cur.group.remove(gm)}cur.grassMesh=[];cur.grassK=want;
   if(want)for(const gd of cur.grassDefs){const gm=scatterGrass(cur.group,cur.cols,{...gd,count:Math.round(gd.count*want)});if(gm){gm.castShadow=false;cur.group.add(gm);cur.grassMesh.push(gm)}}}
  for(const o of cur.group.children)if(o.material&&o.material.map===TX.shadow)o.material.opacity=(d.indoor?.35:.5)*(lvl==='high'?.55:1);
  if(lvl==='high'){if(!post)post=new Post(renderer);post.grade(d.grade,1.0)}}
 dust.visible=lvl==='high'&&!!cur;try{ambSetup()}catch(e){}pixelRatio=basePR();renderer.setPixelRatio(pixelRatio);resize()}
// ambient dust motes (high)
const DN=260,dustPos=new Float32Array(DN*3);for(let i=0;i<DN*3;i++)dustPos[i]=(Math.random()-.5)*24;
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({size:.045,map:TX.soft,color:0xfff1d6,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));dust.frustumCulled=false;dust.visible=false;scene.add(dust);
// ambient emitters (steam/smoke/mist/fire/dust/snow) per map, scaled by quality
const AMB={};{const mk=(n,size,map,add,op)=>{const g=new THREE.BufferGeometry();const p=new Float32Array(n*3),c=new Float32Array(n*3);g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
 const m=new THREE.PointsMaterial({size,map,vertexColors:true,transparent:true,opacity:op,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending});const o=new THREE.Points(g,m);o.frustumCulled=false;o.visible=false;scene.add(o);return{o,p,c,n,parts:[]}};
 AMB.puff=mk(260,1.6,TX.smoke||TX.soft,false,.32);AMB.fire=mk(120,.55,TX.soft,true,.9);AMB.fine=mk(420,.09,TX.soft,false,.85)}
let ambList=[];
function ambSetup(){for(const k in AMB){AMB[k].o.visible=false;AMB[k].parts=[]}ambList=[];if(!cur||!cur.fx||!cur.fx.length)return;const lvl=GQ.level;if(lvl==='low')return;const f=lvl==='high'?1:.55;
 const per={steam:14,smoke:18,mist:16,fire:10,dust:40,snow:300};
 for(const e of cur.fx){const sys=e.k==='fire'?AMB.fire:(e.k==='dust'||e.k==='snow')?AMB.fine:AMB.puff;let n=Math.round(per[e.k]*f*(e.big?2:1));n=Math.min(n,sys.n-sys.parts.length);for(let i=0;i<n;i++)sys.parts.push({e,a:Math.random(),s:Math.random()});sys.o.visible=sys.parts.length>0}}
function updAmb(dt,t){const c=camera.position;for(const k in AMB){const S=AMB[k];if(!S.o.visible)continue;const P=S.p,C=S.c;let i=0;
 for(const q of S.parts){const e=q.e;let life=e.k==='snow'?8:e.k==='dust'?10:e.k==='fire'?.9:e.k==='steam'?2.2:e.k==='mist'?4:4.5;q.a+=dt/life;if(q.a>1){q.a-=1;q.s=Math.random()}
  const a=q.a,s=q.s,j=i*3;let x,y,z,r=1,g=1,b=1,fade=Math.sin(a*Math.PI);
  if(e.k==='snow'){x=c.x+((s*97.3)%1-.5)*30;z=c.z+((s*53.1)%1-.5)*30;y=c.y+8-a*12;x+=Math.sin(t+s*20)*.4;fade=1}
  else if(e.k==='dust'){x=e.x+((s*97.3)%1-.5)*24;z=e.z+((s*53.1)%1-.5)*24;y=e.y+((s*31.7)%1-.5)*4+a*.6;r=1;g=.95;b=.85;fade*=.7}
  else if(e.k==='fire'){const sp=e.big?1.4:.35;x=e.x+Math.sin(s*40)*sp*(1-a)*.6;z=e.z+Math.cos(s*40)*sp*(1-a)*.6;y=e.y+a*(e.big?3.2:1.1);r=1;g=.75-a*.5;b=.2-a*.2;fade=(1-a)}
  else{const sp=e.k==='mist'?1.6:e.k==='steam'?.25:.4;x=e.x+Math.sin(s*30)*sp*(.3+a)+(e.k==='smoke'?a*1.2:0);z=e.z+Math.cos(s*30)*sp*(.3+a);y=e.y+a*(e.k==='steam'?2.4:e.k==='mist'?.6:5);
   const gr=e.k==='smoke'?.35:.92;r=g=b=gr;fade*=e.k==='mist'?.5:.8}
  P[j]=x;P[j+1]=y;P[j+2]=z;C[j]=r*fade;C[j+1]=g*fade;C[j+2]=b*fade;i++}
 for(;i<S.n;i++){P[i*3+1]=-999}S.o.geometry.attributes.position.needsUpdate=true;S.o.geometry.attributes.color.needsUpdate=true}}
function updDust(dt,t){if(!dust.visible)return;const c=camera.position;for(let i=0;i<DN;i++){let x=dustPos[i*3],y=dustPos[i*3+1],z=dustPos[i*3+2];x+=Math.sin(t*.3+i)*.06*dt;y+=(.05+Math.sin(i*1.7+t*.5)*.05)*dt;z+=Math.cos(t*.25+i*.7)*.06*dt;
  if(x-c.x>12)x-=24;if(x-c.x<-12)x+=24;if(y-c.y>6)y-=12;if(y-c.y<-6)y+=12;if(z-c.z>12)z-=24;if(z-c.z<-12)z+=24;dustPos[i*3]=x;dustPos[i*3+1]=y;dustPos[i*3+2]=z}dustGeo.attributes.position.needsUpdate=true}
const PR=.35,PH=1.8;
function overlaps(p,c,h){return p.x+PR>c.x0&&p.x-PR<c.x1&&p.z+PR>c.z0&&p.z-PR<c.z1&&p.y+h>c.y0&&p.y<c.y1}
// ---- v44 spatial grid for big maps (Battle Royale): near-collider lookups + grid-walked rays; small maps keep the plain array ----
let CG=null;const _cbA=[],_cbB=[],_cbC=[];
function buildGrid(){CG=null;if(cols.length<450)return;const hf=Math.ceil(((cur&&cur.def&&cur.def.size?Math.max(cur.def.size[0],cur.def.size[1]):480)/2+10)/10)*10,cs=10,ox=-hf,oz=-hf,nx=hf/5,nz=hf/5;const g={cs,ox,oz,nx,nz,cells:Array.from({length:nx*nz},()=>[]),stamp:1};
 for(const c of cols){const i0=Math.max(0,Math.floor((c.x0-ox)/cs)),i1=Math.min(nx-1,Math.floor((c.x1-ox)/cs)),j0=Math.max(0,Math.floor((c.z0-oz)/cs)),j1=Math.min(nz-1,Math.floor((c.z1-oz)/cs));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)g.cells[i+j*nx].push(c);c._s=0}CG=g}
function CN(x,z,r,buf){if(!CG)return cols;buf.length=0;const g=CG,st=++g.stamp;const i0=Math.max(0,Math.floor((x-r-g.ox)/g.cs)),i1=Math.min(g.nx-1,Math.floor((x+r-g.ox)/g.cs)),j0=Math.max(0,Math.floor((z-r-g.oz)/g.cs)),j1=Math.min(g.nz-1,Math.floor((z+r-g.oz)/g.cs));
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const L=g.cells[i+j*g.nx];for(let k=0;k<L.length;k++){const c=L[k];if(c._s!==st){c._s=st;buf.push(c)}}}return buf}
function rayCols(o,d,t){if(!CG){for(const c of cols){const r=rayBox(o,d,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1,_n);if(r<t&&r>0){t=r;hitN.copy(_n);hitS=c.s||'concrete'}}return t}
 const g=CG,st=++g.stamp,cs=g.cs;let ix=Math.floor((o.x-g.ox)/cs),iz=Math.floor((o.z-g.oz)/cs);const sx=d.x>0?1:-1,sz=d.z>0?1:-1;const tdx=Math.abs(d.x)<1e-9?1e9:cs/Math.abs(d.x),tdz=Math.abs(d.z)<1e-9?1e9:cs/Math.abs(d.z);
 let nx=Math.abs(d.x)<1e-9?1e9:(d.x>0?((ix+1)*cs+g.ox-o.x):(ix*cs+g.ox-o.x))/d.x,nz=Math.abs(d.z)<1e-9?1e9:(d.z>0?((iz+1)*cs+g.oz-o.z):(iz*cs+g.oz-o.z))/d.z;
 for(let guard=0;guard<260;guard++){if(ix>=0&&ix<g.nx&&iz>=0&&iz<g.nz){const L=g.cells[ix+iz*g.nx];for(let k=0;k<L.length;k++){const c=L[k];if(c._s!==st){c._s=st;const r=rayBox(o,d,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1,_n);if(r<t&&r>0){t=r;hitN.copy(_n);hitS=c.s||'concrete'}}}}
  else if((ix<0&&sx<0)||(ix>=g.nx&&sx>0)||(iz<0&&sz<0)||(iz>=g.nz&&sz>0))break;
  const tn=Math.min(nx,nz);if(tn>t)break;if(nx<nz){ix+=sx;nx+=tdx}else{iz+=sz;nz+=tdz}}return t}
function supportAt(x,y,z){if(Math.abs(x)<groundHalf[0]&&Math.abs(z)<groundHalf[1]&&y<1.5)return true;for(const c of CN(x,z,.6,_cbA))if(x>c.x0-.2&&x<c.x1+.2&&z>c.z0-.2&&z<c.z1+.2&&c.y1<=y+.6&&c.y1>y-2.5)return true;return false}
function onFloor(p){return Math.abs(p.x)<groundHalf[0]&&Math.abs(p.z)<groundHalf[1]}
function physStep(e,dt){dt=Math.min(dt,.25);const n=Math.ceil(dt/(1/60)-1e-6);if(n>1){let b=0,l=0;for(let i=0;i<n;i++){physStep1(e,dt/n);b=b||e.bump;l=l||e.landed}e.bump=b;e.landed=l;return}physStep1(e,dt)}
function physStep1(e,dt){const p=e.pos,v=e.vel;const py0=p.y;if(!(isFinite(p.x)&&isFinite(p.y)&&isFinite(p.z))){const L=e.lastG||[0,0,0];p.x=L[0];p.y=L[1];p.z=L[2];v.x=v.y=v.z=0}if(!isFinite(v.x+v.y+v.z))v.x=v.y=v.z=0;v.y-=24*dt;if(v.y<-40)v.y=-40;const wasG=e.ground;const cl=CN(p.x,p.z,Math.abs(v.x*dt)+Math.abs(v.z*dt)+PR+1.4,_cbB);
 for(const ax of['x','z']){p[ax]+=v[ax]*dt;for(const c of cl){if(!overlaps(p,c,PH))continue;
   if(c.y1-p.y<=.55&&(e.ground||v.y<=0)){let ok=true;const oy=p.y;p.y=c.y1+.001;for(const c2 of cl)if(c2!==c&&overlaps(p,c2,PH)){ok=false;break}if(ok)continue;p.y=oy}
   const mid=ax==='x'?(c.x0+c.x1)/2:(c.z0+c.z1)/2;if(p[ax]<mid)p[ax]=(ax==='x'?c.x0:c.z0)-PR-.001;else p[ax]=(ax==='x'?c.x1:c.z1)+PR+.001;v[ax]=0;e.bump=1}}
 p.y+=v.y*dt;e.ground=false;
 // swept landing: feet crossed a top surface this step (prevents sinking/tunnelling at high fall speed or low FPS)
 if(v.y<=0){let top=-1e9;for(const c of cl){if(p.x+PR>c.x0&&p.x-PR<c.x1&&p.z+PR>c.z0&&p.z-PR<c.z1&&py0>=c.y1-.06&&p.y<c.y1&&c.y1>top)top=c.y1}if(top>-1e9){p.y=top;v.y=0;e.ground=true}}
 for(const c of cl){if(!overlaps(p,c,PH))continue;if(v.y<=0&&p.y>c.y1-.6){p.y=c.y1;e.ground=true}else if(v.y>0&&e.ladTop!=null&&c.y1<=e.ladTop+.7){p.y=c.y1;e.ground=true}else if(v.y>0){const ny=c.y0-PH-.001;if(ny>=py0-.05)p.y=ny;else p.y=Math.max(py0,c.y1)}v.y=Math.min(0,v.y)}
 if(e.ground&&v.y<0)v.y=0;
 if(p.y<0&&onFloor(p)&&p.y>-1){p.y=0;v.y=0;e.ground=true}
 // safety net: below the floor but over solid ground (not water/off-pier) -> snap back to last grounded spot
 if(p.y<-.5&&onFloor(p)){const L=e.lastG;if(L){p.x=L[0];p.y=L[1];p.z=L[2]}else p.y=0;v.x=v.y=v.z=0;e.ground=true;(window.__snaps=(window.__snaps||0)+1)}
 if(e.ground)e.lastG=[p.x,p.y,p.z];
 e.landed=!wasG&&e.ground}
let hitN=new THREE.Vector3();
function rayBox(o,d,x0,y0,z0,x1,y1,z1,n){let tmin=0,tmax=1e9,ax=-1,sg=0;
 for(let a=0;a<3;a++){const od=a===0?o.x:a===1?o.y:o.z,dd=a===0?d.x:a===1?d.y:d.z,lo=a===0?x0:a===1?y0:z0,hi=a===0?x1:a===1?y1:z1;
  if(Math.abs(dd)<1e-9){if(od<lo||od>hi)return Infinity;continue}let t1=(lo-od)/dd,t2=(hi-od)/dd,s=-1;if(t1>t2){const t=t1;t1=t2;t2=t;s=1}if(t1>tmin){tmin=t1;ax=a;sg=s}if(t2<tmax)tmax=t2;if(tmin>tmax)return Infinity}
 if(n){n.set(0,0,0);if(ax>=0)n.setComponent(ax,sg)}return tmin}
const _n=new THREE.Vector3();
let hitS='concrete';
function rayWorld(o,d,max=400){let t=max;hitN.set(0,1,0);hitS='concrete';t=rayCols(o,d,t);
 if(d.y<0&&o.y>=0){const g=-o.y/d.y;if(g<t){const hx=o.x+d.x*g,hz=o.z+d.z*g;if(Math.abs(hx)<groundHalf[0]&&Math.abs(hz)<groundHalf[1]){t=g;hitN.set(0,1,0);hitS=(cur&&cur.def.ground&&cur.def.ground[0])||'concrete'}}}
 if(cur&&cur.waterY!=null&&d.y<0&&o.y>cur.waterY){const g=(cur.waterY-o.y)/d.y;if(g<t){t=g;hitN.set(0,1,0);hitS='water'}}return t}
const SURF={metal:'metal',hazard:'metal',window:'glass',planks:'wood',crate:'wood',wood:'wood',leaves:'wood',grass:'dirt',sand:'dirt',rock:'concrete',water:'water',carpet:'soft'};
// smoke clouds block sight
const smokes=[],fires=[];
function smokeBlock(o,d,max){for(const s of smokes){if(s.t<1.2)continue;const r=s.r*.8;const lx=s.p.x-o.x,ly=s.p.y-o.y,lz=s.p.z-o.z;const tc=lx*d.x+ly*d.y+lz*d.z;const d2=lx*lx+ly*ly+lz*lz-tc*tc;if(d2>r*r)continue;
  const th=Math.sqrt(r*r-d2);const t0=tc-th;if(t0<max&&tc+th>0)return true}return false}
function losClear(a,b){const d=b.clone().sub(a);const l=d.length();d.divideScalar(l);return rayWorld(a,d,l)>=l-.3&&!smokeBlock(a,d,l)}
// player hitboxes relative to feet
function rayPlayer(o,d,fp,slide){const k=(slide&5)?.62:(slide&64)?.82:1;let best=Infinity,part=null;
 const hb=[['head',.19,1.46,1.92],['torso',.3,.86,1.46],['legs',.24,0,.86]];
 for(const[n,r,y0,y1]of hb){const t=rayBox(o,d,fp.x-r,fp.y+y0*k,fp.z-r,fp.x+r,fp.y+y1*k,fp.z+r);if(t<best){best=t;part=n}}return{t:best,part}}
// ---------------- offscreen renderer (icons, arsenal preview, map thumbs) ----------------
let R2=null;const prevScene=new THREE.Scene();const prevCam=new THREE.PerspectiveCamera(30,2,.01,50);
function r2(){if(!R2){R2=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});R2.setPixelRatio(1)}return R2}
// gun assembly: one merged mesh per (animation group, material) so mags/bolts/slides can move; pivots from info.piv
const TMAP={metal:'gunMetalP',alu:'gunAlu',poly:'gunPoly',wood:'gunWood',rubber:'gunRubber',brass:'gunBrass',chrome:'gunChrome',trans:'gunTrans',glove:'gunGlove',sleeve:'gunSleeve'};
const SHINY={metal:1,alu:1,brass:1,chrome:1};const ICM=[new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:0}),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.35})];ICM[0].color.setScalar(1.5);ICM[1].color.setScalar(2.1);
prevScene.add(new THREE.HemisphereLight(0xffffff,0x6a6a80,1.6));{const l=new THREE.DirectionalLight(0xffffff,2.2);l.position.set(2,3,2);prevScene.add(l);const l2=new THREE.DirectionalLight(0x9fc4ff,1.2);l2.position.set(-2,1,-1);prevScene.add(l2)}const _bm=new THREE.Matrix4(),_be=new THREE.Euler(),_bq=new THREE.Quaternion(),_bs=new THREE.Vector3(),_bp=new THREE.Vector3();
function bakePart(pt){const g=pt.g.clone();_be.set(...(pt.r||[0,0,0]));_bq.setFromEuler(_be);_bs.set(...(pt.s||[1,1,1]));_bp.set(...(pt.p||[0,0,0]));_bm.compose(_bp,_bq,_bs);if(pt.m)_bm.premultiply(pt.m);g.applyMatrix4(_bm);return g}
const MKT={};function markTex(id){if(MKT[id])return MKT[id];const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');const w=W[id]||{};let h=7;for(const ch of id)h=h*31+ch.charCodeAt(0)|0;h=Math.abs(h);
 x.fillStyle='rgba(0,0,0,0)';x.fillRect(0,0,512,128);x.strokeStyle='rgba(225,228,232,.75)';x.lineWidth=3;x.strokeRect(6,6,500,116);x.fillStyle='rgba(230,232,236,.92)';x.font='bold 40px monospace';x.textBaseline='middle';
 x.fillText('HSZ ARMS  '+String(w.name||id).toUpperCase().slice(0,16),22,40);x.font='30px monospace';x.fillText('CAL '+({ar:'5.56',smg:'9MM',sniper:'.308',marksman:'7.62',shotgun:'12GA',pistol:'.45',heavy:'7.62'}[w.cls]||'—')+'   SN HSZ-'+String(h%900000+100000),22,92);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return MKT[id]=t}
const _mkv=new THREE.Vector3();
function addMarkings(g,id,info){if(!info.trigP||info.melee||info.util||GQ.level==='low')return;const[,Y0,Z0]=info.trigP;const Y=Y0+.026,Z=Z0-.02;let mx=0;
 g.updateMatrixWorld(true);g.traverse(o=>{if(!o.isMesh||o.userData.hand||o.userData.fx||!o.geometry)return;const pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i++){_mkv.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld);if(Math.abs(_mkv.y-Y)<.012&&Math.abs(_mkv.z-Z)<.02&&_mkv.x>mx)mx=_mkv.x}});
 if(mx<.006||mx>.06)return;const pm=new THREE.MeshStandardMaterial({map:markTex(id),transparent:true,roughness:.35,metalness:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 for(const sd of[1,-1]){const pl=new THREE.Mesh(new THREE.PlaneGeometry(.064,.016),pm);pl.position.set(sd*(mx+.0007),Y,Z);pl.rotation.y=sd*Math.PI/2;pl.renderOrder=2;pl.userData.fx=1;g.add(pl)}
 const met=texMat('gunMetalP'),dk=texMat('gunPoly');const pin=new THREE.CylinderGeometry(.0026,.0026,.0024,12);pin.rotateZ(Math.PI/2);const scr=new THREE.BoxGeometry(.0006,.0045,.0009);
 for(const sd of[1,-1])for(const dz of[-.05,.032]){const m=new THREE.Mesh(pin,met);m.position.set(sd*(mx+.0005),Y-.012,Z+dz);m.userData.fx=1;g.add(m);const sl=new THREE.Mesh(scr,dk);sl.position.set(sd*(mx+.0018),Y-.012,Z+dz);sl.rotation.x=.6;sl.userData.fx=1;g.add(sl)}
 const sel=new THREE.Mesh(new THREE.CylinderGeometry(.0055,.0055,.002,16).rotateZ(Math.PI/2),met);sel.position.set(-(mx+.0008),Y-.004,Z+.045);sel.userData.fx=1;g.add(sel);const lv=new THREE.Mesh(new THREE.BoxGeometry(.0022,.003,.013),met);lv.position.set(-(mx+.0018),Y-.004,Z+.04);lv.rotation.x=-.5;lv.userData.fx=1;g.add(lv)}
function gunGroup(id,o={}){if(o===true)o={hands:true};const{hands=false,sleeve,lod=0,lit=false,nofa=false,glove}=o;const{parts,info:info0}=gunParts(id,lod);const g=new THREE.Group();const Gp={};
 const PH=!o.noPhoto&&GQ.level!=='low'?photoItems(id,lod,HQP):null;const info=PH&&PHOTO[id].info?Object.assign({},info0,PHOTO[id].info):info0;const all0=hands?parts.concat(handParts(info,sleeve,glove==null?undefined:glove,undefined,nofa)):parts;const all=PH?all0.filter(pt=>pt.mat==='glove'||pt.mat==='sleeve'):all0;const wr=hands&&nofa?{R:wristOut.R,L:wristOut.L}:null;const B={};for(const pt of all){const k=(pt.grp||'')+'|'+pt.mat;(B[k]||(B[k]=[])).push(pt)}
 for(const k in B){const[grp,mat]=k.split('|');let holder=g;
  if(grp){if(!Gp[grp]){const pv=new THREE.Group();pv.position.set(...((info.piv&&info.piv[grp])||[0,0,0]));pv.name='G_'+grp;pv.userData.base=pv.position.clone();g.add(pv);Gp[grp]=pv}holder=Gp[grp]}
  const off=holder===g?null:holder.position;
  if(mat==='ret'||mat==='glass'){for(const pt of B[k]){const geo=bakePart(pt);if(off)geo.translate(-off.x,-off.y,-off.z);const m=new THREE.Mesh(geo,mat==='ret'?RET[pt.ret||'dot']:GLASS);m.renderOrder=mat==='ret'?3:2;m.userData.fx=1;holder.add(m)}continue}
  const geo=mergeParts(B[k],{uv:true});if(off)geo.translate(-off.x,-off.y,-off.z);const tm=TMAP[mat]||'gunPoly';
  const mesh=new THREE.Mesh(geo,lit?texMat(tm):o.icon?ICM[SHINY[mat]?1:0]:(SHINY[mat]?MC.metal:MC.matte));mesh.userData.tm=lit?tm:null;mesh.userData.mk=mat;if(mat==='glove'||mat==='sleeve')mesh.userData.hand=1;holder.add(mesh)}
 if(PH){for(const it of PH){let holder=g;if(it.grp){if(!Gp[it.grp]){const pv=new THREE.Group();pv.position.set(...((info.piv&&info.piv[it.grp])||[0,0,0]));pv.name='G_'+it.grp;pv.userData.base=pv.position.clone();g.add(pv);Gp[it.grp]=pv}holder=Gp[it.grp]}
  const geo=it.geo.clone();if(holder!==g){const off=holder.position;geo.translate(-off.x,-off.y,-off.z)}const mesh=new THREE.Mesh(geo,it.mat);mesh.userData.mk='photo';mesh.userData.photo=1;holder.add(mesh);if(it.mat.transparent)mesh.renderOrder=2}g.userData.photo=1}
 if(Gp.mag){const bb=new THREE.Box3();Gp.mag.updateMatrixWorld(true);for(const c of Gp.mag.children)if(c.geometry){c.geometry.computeBoundingBox();bb.union(c.geometry.boundingBox)}Gp.mag.userData.c=bb.isEmpty()?new THREE.Vector3():bb.getCenter(new THREE.Vector3()).add(Gp.mag.position)}
 if(lit&&!lod&&!PH)addMarkings(g,id,info);g.userData.info=info;g.userData.wr=wr;g.userData.G=Gp;g.userData.optic=parts.some(p=>p.mat==='ret');return g}
const ICON={};
function fitCam(obj,cam,side=true,pad=1.15){const bb=new THREE.Box3().setFromObject(obj);const c=bb.getCenter(new THREE.Vector3()),s=bb.getSize(new THREE.Vector3());
 const r=Math.max(s.z/cam.aspect,s.y,s.x*.6)*pad;const dist=r/(2*Math.tan(cam.fov*Math.PI/360));if(side){cam.position.set(c.x+dist,c.y+dist*.12,c.z+dist*.06)}else cam.position.set(c.x+dist*.85,c.y+dist*.35,c.z+dist*.5);cam.lookAt(c)}
function renderIcons(){const R=r2();R.setSize(192,96);prevCam.aspect=2;prevCam.updateProjectionMatrix();
 for(const id in W){const g=gunGroup(id,{icon:true});if(id==='fists'){const{info}=gunParts('fists');const hp=handParts(info);g.add(new THREE.Mesh(mergeParts(hp),ICM[0]));g.rotation.y=-Math.PI/2}
  if(W[id].cls==='util')g.scale.setScalar(2.2);prevScene.add(g);fitCam(g,prevCam,true,W[id].cls==='util'?1.6:1.08);R.setClearColor(0,0);R.render(prevScene,prevCam);ICON[id]=R.domElement.toDataURL();prevScene.remove(g);
  g.traverse(o=>o.geometry&&o.geometry.dispose())}}
let prevObj=null,prevOn=false,prevT=0;
function startPreview(id,sk){const R=r2();const box=$('arsPrev');if(R.domElement.parentNode!==box){box.innerHTML='';box.appendChild(R.domElement)}
 const w=box.clientWidth||320,h=box.clientHeight||150;R.setSize(w,h);prevCam.aspect=w/h;prevCam.updateProjectionMatrix();
 if(prevObj){prevScene.remove(prevObj);prevObj.traverse(o=>o.geometry&&o.geometry.dispose())}prevObj=gunGroup(id,{icon:true});if(sk)applySkin(prevObj,sk);if(id==='fists'){const hp=handParts(gunParts('fists').info);prevObj.add(new THREE.Mesh(mergeParts(hp),ICM[0]))}
 if(W[id].cls==='util')prevObj.scale.setScalar(2.4);const piv=new THREE.Group();piv.add(prevObj);const bb=new THREE.Box3().setFromObject(prevObj);prevObj.position.sub(bb.getCenter(new THREE.Vector3()));prevObj=piv;prevScene.add(piv);
 fitCam(piv,prevCam,false,1.25);prevCam.position.set(0,.05,1);const s=new THREE.Box3().setFromObject(piv).getSize(new THREE.Vector3());const r=Math.max(s.x,s.y,s.z);const hf=2*Math.atan(Math.tan(prevCam.fov*Math.PI/360)*prevCam.aspect),vf=prevCam.fov*Math.PI/180;const dist=Math.max((r/2)/Math.tan(hf/2),(Math.max(s.y,r*.3)/2)/Math.tan(vf/2))*1.25;prevCam.position.set(dist,dist*.12,0);prevCam.lookAt(0,0,0);prevT=0;
 if(!prevOn){prevOn=true;const loop=()=>{if(!prevOn)return;requestAnimationFrame(loop);if(prevObj){prevT+=.016;prevObj.rotation.y=Math.sin(prevT*.9)*.5}tickSkins(performance.now()/1000);R.setClearColor(0,0);R.render(prevScene,prevCam)};loop()}}
function stopPreview(){prevOn=false}
const THUMB={};
function renderThumbs(cb){let i=0;const next=()=>{if(i>=MAPS.length){cb&&cb();return}const k=i++;if(THUMB[k]){next();return}
  try{const R=r2();R.setSize(320,180);const m=buildMap(k);const sc=new THREE.Scene();sc.add(m.group);if(m.sky)sc.add(m.sky);const d=m.def;sc.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);
   sc.add(new THREE.HemisphereLight(d.hemi[0],d.hemi[1],d.hemi[2]));const sl=new THREE.DirectionalLight(d.sun[0],d.sun[1]);sl.position.copy(m.sunDir);sc.add(sl);
   const cam=new THREE.PerspectiveCamera(50,16/9,.5,800);const[sx,sz]=d.size;if(d.indoor){cam.position.set(0,sz*1.3,sz*.6);R.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),3.1)]}else cam.position.set(-sx*.15,Math.max(sx,sz)*.55,sz*.75);cam.lookAt(0,0,0);
   R.setClearColor(0,1);R.render(sc,cam);R.clippingPlanes=[];THUMB[k]=R.domElement.toDataURL('image/jpeg',.8);sc.clear();if(cur===m){scene.add(m.group);if(m.sky)scene.add(m.sky)}}catch(e){console.warn(e)}
  renderLobby();setTimeout(next,30)};next()}
// ---------------- viewmodel (separate pass so it never clips into walls) ----------------
const vmScene=new THREE.Scene(),vmCam=new THREE.PerspectiveCamera(54,1,.01,10);const vmRoot=new THREE.Group();vmRoot.scale.setScalar(.5);vmScene.add(vmRoot);
const vmHemi=new THREE.HemisphereLight(0xffffff,0x666666,1.2),vmSun=new THREE.DirectionalLight(0xffffff,1.5);vmSun.position.set(.4,1,.3);const vmFill=new THREE.DirectionalLight(0xdfe8ff,.9);vmFill.position.set(-.6,.3,1);vmScene.add(vmHemi,vmSun,vmFill);
const VM={};let vmCur=null,vmInfo={};
const flashMat=new THREE.MeshBasicMaterial({map:TX.flash,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const coreMat=new THREE.MeshBasicMaterial({map:TX.muzz,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const jetMat=new THREE.MeshBasicMaterial({map:TX.jet,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const muzzle=new THREE.Group();{const fm=flashMat;const core=new THREE.Mesh(new THREE.PlaneGeometry(.13,.13),coreMat);core.userData.k='core';
 const pet=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.085,.32),jetMat);m.geometry.translate(0,.12,0);m.rotation.set(Math.PI/2,i*Math.PI/3,0);m.position.z=-.01;m.userData.k='petal';pet.push(m)}
 const side=[];for(const a of[0,1,2,3]){const m=new THREE.Mesh(new THREE.PlaneGeometry(.05,.11),fm);m.geometry.translate(0,.06,0);m.rotation.z=a*Math.PI/2+Math.PI/4;m.userData.k='side';side.push(m)}
 muzzle.add(core,...pet,...side);muzzle.visible=false}
const vmFlash=new THREE.PointLight(0xffb060,0,1.6,2);vmScene.add(vmFlash);
const worldFlash=new THREE.PointLight(0xffa850,0,9,2);scene.add(worldFlash);
// camo: clean pattern map on furniture/receiver (vertex colours off so the pattern reads true), gold = everything polished gold
function camoize(g,id){const ck=PROG.camo[id]||'factory';const cm=CAMOS[ck];if(!cm||!cm[2])return;const gold=ck==='gold';
 g.traverse(o=>{if(!o.isMesh||o.userData.hand||o.userData.fx)return;const mk=o.userData.mk;if(!gold&&!['poly','alu','wood'].includes(mk))return;const m=o.material.clone();
  if(gold){m.vertexColors=false;m.map=null;m.color.set(0xd8a93a);if(m.metalness!==undefined){m.metalness=1;m.roughness=.22}}
  else{m.vertexColors=false;m.map=camoTex(cm[2]);m.color.setScalar(mk==='wood'?.8:1);if(m.metalness!==undefined){m.metalness=Math.min(m.metalness,.2);m.roughness=.6}}
  m.needsUpdate=true;o.material=m;o.userData.tm=null})}
function vmSleeve(){const q=C.players&&C.players[me.id];if(C.mode&&C.mode!=='ffa'&&q&&q.color!=null&&q.color!==0xffffff)return new THREE.Color(q.color).multiplyScalar(.62).getHex();return 0x3d4a5c}
function getVM(id){const sl=vmSleeve();const key=id+'|'+sl+'|'+(PROG.wskin[id]||'')+'|'+GQ.level;if(!VM[key]){const g=gunGroup(id,{hands:true,sleeve:sl,lit:true});if(!applySkin(g,PROG.wskin[id]))camoize(g,id);VM[key]=g}return VM[key]}
function resetVMs(){for(const k in VM)delete VM[k];if(me.load[me.cur])setViewModel(me.load[me.cur])}
const VA={};const WIDS=Object.keys(W),WIDX={};WIDS.forEach((k,i)=>WIDX[k]=i);
// third-person guns: low-detail, matcap-lit, shared geometry per weapon
const TPG={};function tpGun(id,sk,glove){const k=id+'|'+(sk||'')+'|'+GQ.level+'|'+(glove==null?'':glove);if(!TPG[k]){const g=gunGroup(id,{lod:1,hands:true,nofa:true,glove});if(sk)applySkin(g,sk);g.traverse(o=>{if(o.isMesh&&!o.userData.fx){o.castShadow=true}});
  g.updateMatrixWorld(true);const bb=new THREE.Box3(),t=new THREE.Box3();g.traverse(o=>{if(o.isMesh&&!o.userData.hand&&!o.userData.fx&&o.geometry){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);bb.union(t)}});g.userData.zr=bb.isEmpty()?.2:bb.max.z;g.userData.zf=bb.isEmpty()?-.4:bb.min.z;TPG[k]=g}
 const src=TPG[k],c=src.clone();c.traverse(o=>{o.frustumCulled=false});c.userData.info=src.userData.info;c.userData.wr=src.userData.wr;c.userData.zr=src.userData.zr;c.userData.zf=src.userData.zf;
 // clone() copies sub-group pivots by value: re-link the animation groups on the clone
 const Gp={};c.traverse(o=>{if(o.name&&o.name.startsWith('G_'))Gp[o.name.slice(2)]=o});c.userData.G=Gp;if(Gp.mag&&src.userData.G.mag)Gp.mag.userData.c=src.userData.G.mag.userData.c;return c}
function skOf(q,id){const w=q&&q.ws;const k=w&&(w[id]||w['*']);return WSKINS[k]&&k!=='default'?k:''}
function cleanWS(ws){const o={};if(ws&&typeof ws==='object')for(const k in ws)if(k==='pet'){if(SK_BY[ws[k]])o.pet=ws[k]}else if((W[k]||k==='*')&&WSKINS[ws[k]]&&ws[k]!=='default')o[k]=ws[k];return o}
function setRemoteGun(q,wid){const id=WIDS[wid]||'ar';const sk=skOf(q,id);if(!q.model||(q.gunId===id&&q.gunSk===sk))return;q.gunSk=sk;const mt=q.model.userData.gunMount;if(!mt)return;mt.clear();if(!(W[id]&&W[id].cls==='util')||true){const g=tpGun(id,sk,q.model.userData.outfit&&q.model.userData.outfit.glove);mt.add(g);q.gunObj=g}q.gunId=id}// viewmodel animation state
function setViewModel(id){if(vmCur)vmRoot.remove(vmCur);vmCur=getVM(id);vmCur.traverse(o=>{o.frustumCulled=false});vmRoot.add(vmCur);vmInfo=vmCur.userData.info||{};vmCur.add(muzzle);muzzle.position.set(...(vmInfo.muzzle||[0,0,-.5]));muzzle.visible=false;
 const Gp=vmCur.userData.G;for(const k in Gp){Gp[k].position.copy(Gp[k].userData.base);Gp[k].rotation.set(0,0,0);Gp[k].visible=true}
 Object.assign(VA,{cyc:0,cycD:0,slide:0,glRot:0,inspect:0,shellN:0,ejected:false,emptyRl:false,boltF:0});}
const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_q=new THREE.Quaternion();
function vmToWorld(local,out){if(TPV.on&&me.model&&me.model.userData.gunMount&&me.model.visible){const gm=me.model.userData.gunMount;gm.updateMatrixWorld(true);out.set(local[0]*.5,local[1]*.5,-.42+local[2]*.5);return gm.localToWorld(out)}vmRoot.updateMatrixWorld(true);out.set(...local);vmCur.localToWorld(out);return camera.localToWorld(out)}
// ---------------- tracers ----------------
const TR=48,trPos=new Float32Array(TR*6),trCol=new Float32Array(TR*6),trLife=new Float32Array(TR);let trI=0;
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(trPos,3));trGeo.setAttribute('color',new THREE.BufferAttribute(trCol,3));
const tracers=new THREE.LineSegments(trGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));tracers.frustumCulled=false;scene.add(tracers);
const trA=[],trB=[],trT=new Float32Array(TR),trL=new Float32Array(TR);for(let i=0;i<TR;i++){trA.push(new THREE.Vector3());trB.push(new THREE.Vector3())}
const _tc=new THREE.Color();function addTracer(a,b,col){const i=trI++%TR;trA[i].copy(a);trB[i].copy(b);trL[i]=a.distanceTo(b);trT[i]=0;trLife[i]=Math.max(.03,trL[i]/420)+.02+(col?.06:0);if(col){_tc.set(col);trCol.set([_tc.r,_tc.g,_tc.b,_tc.r,_tc.g,_tc.b],i*6)}else trCol.set([.9,.55,.2,1,.95,.75],i*6);trGeo.attributes.color.needsUpdate=true}
function updTracers(dt){let ch=false;for(let i=0;i<TR;i++){if(trLife[i]<=0)continue;ch=true;trLife[i]-=dt;trT[i]+=dt*420;if(trLife[i]<=0||trT[i]>trL[i]+4){trLife[i]=0;trPos.fill(0,i*6,i*6+6);continue}
  const L=trL[i]||1,h=Math.min(trT[i],L),t0=Math.max(0,trT[i]-Math.min(5,L*.35));const A=trA[i],B=trB[i];
  for(const[k,t]of[[0,t0],[1,h]]){trPos[i*6+k*3]=A.x+(B.x-A.x)*t/L;trPos[i*6+k*3+1]=A.y+(B.y-A.y)*t/L;trPos[i*6+k*3+2]=A.z+(B.z-A.z)*t/L}}
 if(ch)trGeo.attributes.position.needsUpdate=true}
// ---------------- impacts ----------------
function impact(p,n,player,surf){if(player){fx.spark(p,6,0xff7a6a,2.6,.22);fx.spark(p,4,0xffffff,2,.15);fx.sprite({p:p.clone(),s0:.08,s1:.32,life:.22,op:.5,color:0xd04848,rise:.2});return}
 const k=SURF[surf||hitS]||'concrete';const off=_v.copy(p).addScaledVector(n,.08);SFX.imp(k,p);
 if(k==='glass'){fx.decal(p,n);fx.spark(p,14,0xe8f6ff,3.5,.5);fx.sprite({p:off,tex:TX.flash,add:true,s0:.1,s1:.25,life:.06,op:.8,color:0xffffff});return}
 if(k==='water'){for(let i=0;i<3;i++)fx.sprite({p:off.clone().add(_v2.set((Math.random()-.5)*.2,.1+i*.15,(Math.random()-.5)*.2)),s0:.1,s1:.5,life:.5,op:.7,color:0xdfefff,rise:1.4-i*.3});fx.spark(p,10,0xcfe6ff,3.2,.45);return}
 fx.decal(p,n);
 if(k==='metal'){fx.spark(p,12,0xffe2a0,6,.35);fx.sprite({p:off,tex:TX.flash,add:true,s0:.12,s1:.22,life:.06,op:1,color:0xffd090})}
 else if(k==='wood'){fx.spark(p,7,0x8a5a30,3,.5);fx.sprite({p:off,s0:.1,s1:.35,life:.35,op:.45,color:0xa48460,rise:.2})}
 else if(k==='dirt'){fx.spark(p,6,0x9a8060,2.5,.45);fx.sprite({p:off,s0:.2,s1:.9,life:.6,op:.55,color:0xc8b08a,rise:.5})}
 else if(k==='soft'){fx.sprite({p:off,s0:.08,s1:.3,life:.3,op:.35,color:0xbbbbbb,rise:.2})}
 else if(k==='wood'){}else{fx.spark(p,5,0xffd27a,3.5,.3);fx.spark(p,4,0x999088,2.5,.45);fx.sprite({p:off,s0:.15,s1:.7,life:.55,op:.6,color:0xc4b8a6,rise:.4})}}
// ---------------- extra fx: heat wisps, fire lights, shockwave rings, fun-weapon beams, near-miss ----------------
let heat=0,heatOff=0,heatT=0;function updHeat(dt){heat=Math.max(0,heat-dt*2.2);heatOff+=dt;if(heat>4&&heatOff>.15&&vmCur&&vmRoot.visible){heatT-=dt;if(heatT<=0){heatT=.12;const p=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());fx.sprite({p,s0:.03,s1:.3,life:1.1,op:.18*Math.min(1,heat/8),color:0xdedede,rise:.35})}}}
const FL=[];function initFireLights(){if(FL.length||qLevel()==='low')return;for(let i=0;i<2;i++){const l=new THREE.PointLight(0xff8a30,0,9,2);scene.add(l);FL.push({l,t:0,life:0,I:0})}}
function fireLight(p,I,life,col){initFireLights();if(!FL.length)return;const f=FL.reduce((a,b)=>a.t<=0?a:(b.t<=0?b:(a.t<b.t?a:b)));f.l.position.set(p.x,p.y+.8,p.z);f.l.color.set(col||0xff8a30);f.I=I;f.t=f.life=life}
function updFireLights(dt){if(!FL.length){if(fires.length)initFireLights();if(!FL.length)return}let k=0;for(const f of fires){if(k>=FL.length)break;if(f.t>f.life)continue;const L=FL[k++];if(L.t>0&&L.life<1)continue;L.l.position.set(f.p.x,f.p.y+.7,f.p.z);L.l.color.set(0xff7a28);L.l.intensity=(2.2+Math.sin(performance.now()*.03+k)*.6+Math.random()*.7)*Math.min(1,(f.life-f.t)/1.5);L.life=9;L.t=.1}
 for(const f of FL){if(f.life<1&&f.t>0){f.t-=dt;f.l.intensity=f.I*Math.max(0,f.t/f.life)}else if(f.life>=1){f.t-=dt;if(f.t<=0){f.l.intensity=0;f.life=0}}}}
const RINGS=[];function ringFX(p,R){let r=RINGS.find(x=>x.t<=0);if(!r){if(RINGS.length>=3)r=RINGS[0];else{const m=new THREE.Mesh(new THREE.RingGeometry(.8,1,40),new THREE.MeshBasicMaterial({color:0xfff0d0,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;scene.add(m);r={m,t:0};RINGS.push(r)}}
 r.m.position.set(p.x,p.y+.12,p.z);r.R=R;r.t=r.life=.45;r.m.visible=true}
function updRings(dt){for(const r of RINGS){if(r.t<=0)continue;r.t-=dt;const k=1-Math.max(0,r.t)/r.life;r.m.scale.setScalar(.3+k*r.R);r.m.material.opacity=.7*(1-k);if(r.t<=0)r.m.visible=false}}
function nearMiss(a,b,fw){const ab=_v.copy(b).sub(a);const L=ab.length();if(L<2)return;ab.divideScalar(L);const t=Math.max(0,Math.min(L,_v2.copy(camera.position).sub(a).dot(ab)));const cp=a.clone().addScaledVector(ab,t);const dd=cp.distanceTo(camera.position);
 if(dd<2.2&&t>3&&t<L-.5){const sup=fw&&!['pistol','smg','fun'].includes(fw.cls);SFX.whizz(cp,sup&&dd<1.2)}}
function funFX(id,a,b){const w=W[id];if(!w)return;const lo=qLevel()==='low';
 if(id==='water'){fx.sprite({p:b.clone(),s0:.15,s1:.6,life:.35,op:.5,color:0xcfeaff,rise:-.4});fx.spark(b,lo?3:6,0xaad8ff,2.5,.4);if(!lo)fx.sprite({p:a.clone().lerp(b,.35),s0:.08,s1:.25,life:.2,op:.35,color:0xbfe2ff})}
 else if(id==='freeze'){fx.sprite({p:b.clone(),s0:.2,s1:.9,life:.6,op:.55,color:0xc8f4ff,rise:.1});fx.spark(b,lo?3:7,0xe8fbff,2,.5);fx.sprite({p:b.clone(),tex:TX.flash,add:true,s0:.15,s1:.35,life:.12,op:.8,color:0x7fe0ff})}
 else if(id==='laser'){fx.sprite({p:b.clone(),tex:TX.flash,add:true,s0:.15,s1:.4,life:.12,op:1,color:0x40f0ff});fx.spark(b,lo?3:6,0x9ff8ff,3,.25)}
 else if(id==='taser'){const n=lo?3:5;let p0=a.clone();const d=b.clone().sub(a);for(let i=1;i<=n;i++){const p1=a.clone().addScaledVector(d,i/n);if(i<n)p1.add(_v.set((Math.random()-.5)*.25,(Math.random()-.5)*.25,(Math.random()-.5)*.25));addTracer(p0,p1,0x9fe8ff);p0=p1}fx.sprite({p:b.clone(),tex:TX.flash,add:true,s0:.2,s1:.5,life:.15,op:1,color:0x9fe8ff});fx.spark(b,6,0xcff4ff,3,.25)}
 else if(id==='paintball'){fx.spark(b,lo?3:6,PAINT[Math.random()*PAINT.length|0],2.5,.35)}}
// ---------------- throwables & utilities ----------------
const thrownTpl={};function thrownMesh(kind){if(!thrownTpl[kind]){const PJ=W[kind]&&W[kind].proj;const g=gunGroup(PJ?'proj_'+PJ:kind,{lod:1});g.scale.setScalar(PJ?1.6:1.5);const G=g.userData.G||{};if(G.pin)G.pin.visible=false;if(G.spoon)G.spoon.visible=false;thrownTpl[kind]=g}return thrownTpl[kind].clone()}
// spoon (lever) flying off a thrown grenade
const spoons=[],spoonTpl={};function spawnSpoon(kind,p,v){if(!spoonTpl[kind]){const g=gunGroup(kind,{lod:1});const sp=g.userData.G&&g.userData.G.spoon;spoonTpl[kind]=sp?(()=>{const o=new THREE.Group();const c=sp.clone();c.position.set(0,0,0);c.visible=true;o.add(c);o.scale.setScalar(1.5);return o})():null}
 if(!spoonTpl[kind]||spoons.length>12)return;if(camera.position.distanceTo(p)<20)setTimeout(()=>SFX.spoon(p.clone()),60);const m=spoonTpl[kind].clone();m.position.copy(p);scene.add(m);spoons.push({m,v:v.clone().multiplyScalar(.35).add(new THREE.Vector3((Math.random()-.5)*3,3.5,(Math.random()-.5)*3)),t:1.6,w:new THREE.Vector3(14+Math.random()*10,Math.random()*8,9)})}
function updSpoons(dt){for(let i=spoons.length-1;i>=0;i--){const s=spoons[i];s.t-=dt;s.v.y-=14*dt;s.m.position.addScaledVector(s.v,dt);s.m.rotation.x+=s.w.x*dt;s.m.rotation.y+=s.w.y*dt;const gy=(typeof gndAt==='function'?gndAt(s.m.position):0)+.02;if(s.m.position.y<gy){s.m.position.y=gy;s.v.multiplyScalar(.3);s.v.y=Math.abs(s.v.y)*.4;s.w.multiplyScalar(.5)}
 if(s.t<=0){scene.remove(s.m);spoons.splice(i,1)}}}
// first-person throw: held grenade, pin pulled, then thrown (spoon flies once it leaves the hand)
const heldTpl={};let TH=null;function startThrow(k,go){if(TH){vmScene.remove(TH.g);TH.go&&TH.go()}if(!heldTpl[k])heldTpl[k]=gunGroup(k,{lit:true});const g=heldTpl[k].clone();g.scale.setScalar(.75);vmScene.add(g);TH={g,k,t:0,go,G:{}};
const G=heldTpl[k].userData.G||{};for(const n in G){g.traverse(o=>{if(o.name===('G_'+n))TH.G[n]=o})}TH.go=go}
function updThrow(dt){if(!TH)return;TH.t+=dt;if(window.__thrFreeze!=null)TH.t=Math.min(TH.t,window.__thrFreeze);const t=TH.t,g=TH.g;const pull=Math.min(1,t/.18),sw=Math.max(0,Math.min(1,(t-.2)/.14));
 g.position.set(.07-sw*.05,-.09+pull*.02+sw*.1,-.26-sw*.25);g.rotation.set(-.3+sw*1.4,.5-sw*.4,-.15+pull*.2);
 if(TH.G.pin){TH.G.pin.position.x=TH.G.pin.userData.base.x-pull*.06;TH.G.pin.position.y=TH.G.pin.userData.base.y+pull*.01;TH.G.pin.visible=pull<1||t<.24}
 if(t>=.26&&TH.go){TH.go();TH.go=null}if(TH.G.spoon)TH.G.spoon.visible=t<.26;g.visible=t<.36;if(t>.4){vmScene.remove(g);TH=null}}
let nades=[];const FUSE={grenade:1.8,smoke:1.4,flash:1.3,decoy:1.2,molotov:9,gl:4,rpg:4};const NLK=['smoke','flash','decoy'];
function spawnNade(owner,kind,p,v){const m=thrownMesh(kind);m.position.copy(p);scene.add(m);if(kind!=='molotov')spawnSpoon(kind,p,v);nades.push({owner,kind,m,v:v.clone(),t:FUSE[kind]||1.8,spin:new THREE.Vector3(Math.random()*8,Math.random()*8,0)})}
function updNades(dt){for(const n of nades){n.t-=dt;const PJ=W[n.kind]&&W[n.kind].proj;n.v.y-=(PJ==='rpg'?0:PJ==='gl'?9:20)*dt;const p=n.m.position;let bounced=false;
  if(PJ){if(n.v.lengthSq()>1)n.m.lookAt(_v.copy(p).add(n.v));if(PJ==='rpg'&&Math.random()<.7)fx.sprite({p:p.clone(),s0:.25,s1:1.2,life:.7,op:.5,color:0xcfcfcf,rise:.3});
   for(const id in C.players){const q=C.players[id];if(!q.alive||id===n.owner)continue;const c=_v2.copy(q.rp);c.y+=1;if(c.distanceTo(p)<.9){n.t=0;break}}}
  for(const ax of['x','y','z']){const old=p[ax];p[ax]+=n.v[ax]*dt;let hit=false;for(const c of CN(p.x,p.z,1.2,_cbC))if(p.x>c.x0-.08&&p.x<c.x1+.08&&p.y>c.y0-.08&&p.y<c.y1+.08&&p.z>c.z0-.08&&p.z<c.z1+.08){hit=true;break}
   if(ax==='y'&&p.y<.1&&onFloor(p))hit=true;if(hit){p[ax]=old;n.v[ax]*=-.38;n.v.x*=.75;n.v.z*=.75;bounced=true}}
  n.m.rotation.x+=n.spin.x*dt;n.m.rotation.y+=n.spin.y*dt;if(bounced&&!PJ&&n.kind!=='molotov'&&n.v.lengthSq()>1){const dd=camera.position.distanceTo(p);if(dd<30)SFX.clink(p.clone(),Math.min(1,n.v.length()/8)*(1-dd/30))}
  if(n.kind==='molotov'&&Math.random()<(qLevel()==='low'?.35:.8)){fx.sprite({p:p.clone(),tex:TX.fire,add:true,s0:.25,s1:.6,life:.25,op:.9,color:0xff9a3a,rise:.6});if(Math.random()<.3)fx.sprite({p:p.clone(),s0:.15,s1:.6,life:.6,op:.3,color:0x444444,rise:.6})}
  if(PJ==='gl'&&Math.random()<.5)fx.sprite({p:p.clone(),s0:.08,s1:.4,life:.5,op:.35,color:0xcfcfcf,rise:.1});if(PJ==='rpg'&&Math.random()<.8)fx.sprite({p:p.clone(),tex:TX.flash,add:true,s0:.25,s1:.1,life:.08,op:1,color:0xffb050});
  if(bounced){n.spin.multiplyScalar(.7);if(n.kind==='molotov'||PJ)n.t=0}
  if(p.y<-8)n.t=-1;if(n.t<=0)detonate(n)}
 nades=nades.filter(n=>n.t>0)}
function detonate(n){scene.remove(n.m);const p=n.m.position.clone();if(n.t<-.5)return;
 const SPL=W[n.kind]&&W[n.kind].splash;if(n.kind==='grenade'||SPL)explosionFX(p);
 if(n.owner!==me.id)return; // utility effects are announced by the thrower
 if(SPL){const w=W[n.kind],Rr=w.radius;for(const id in C.players){const q=C.players[id];if(!q.alive)continue;const self=id===me.id;if(!self&&!isEnemy(q))continue;
   const c=(self?me.pos.clone():q.rp.clone());c.y+=1;const dd=c.distanceTo(p);if(dd>Rr)continue;if(!losClear(p.clone().setY(p.y+.25),c))continue;let dmg=Math.round(w.splash*(1-.7*dd/Rr));
   if(self)dmg=Math.min(40,Math.round(dmg*.35));send({t:'hit',id,dmg,head:false,w:n.kind,splash:1});if(!self)showHit(c,dmg,false)}if(w.fire)send({t:'util',kind:'molotov',small:1,p:[+p.x.toFixed(2),+Math.max(p.y,0).toFixed(2),+p.z.toFixed(2)]});return}
 if(n.kind==='grenade'){const R=6.5;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=q.rp.clone();c.y+=1;const dd=c.distanceTo(p);if(dd>R)continue;
   if(!losClear(p.clone().setY(p.y+.2),c))continue;const dmg=Math.round(95*(1-dd/R)+10);send({t:'hit',id,dmg,head:false,w:'grenade'});showHit(c,dmg,false)}}
 else send({t:'util',kind:n.kind,p:[+p.x.toFixed(2),+Math.max(p.y,0).toFixed(2),+p.z.toFixed(2)]})}
function explosionFX(p){fx.sprite({p,tex:TX.flash,add:true,s0:1,s1:6,life:.35,op:1,color:0xffc070});for(let i=0;i<8;i++)fx.sprite({p:_v.set(p.x+(Math.random()-.5)*2,p.y+.3+Math.random(),p.z+(Math.random()-.5)*2),s0:1,s1:3.5,life:1.4+Math.random(),op:.7,color:0x5b5b5b,rise:.8});
 fx.spark(p,40,0xffb347,9,.6);fx.spark(p,qLevel()==='low'?10:26,0x2a2622,7,1.1);fx.scorch(p,2.2);const lo=qLevel()==='low';for(let i=0;i<(lo?3:7);i++){const a=Math.random()*6.28,r=1+Math.random()*2;fx.sprite({p:_v.set(p.x+Math.cos(a)*r,p.y+.15,p.z+Math.sin(a)*r),s0:.8,s1:3.2,life:2.2+Math.random(),op:.45,color:0xa89a86,rise:.25,v:_v2.set(Math.cos(a)*1.5,0,Math.sin(a)*1.5)})}
 for(let i=0;i<(lo?2:5);i++)fx.sprite({p:_v.set(p.x+(Math.random()-.5)*1.4,p.y+.5+Math.random(),p.z+(Math.random()-.5)*1.4),tex:TX.fire,add:true,s0:1,s1:3.6+Math.random()*1.5,life:.5+Math.random()*.3,op:.95,color:i%2?0xff7a20:0xffc060,rise:1.4});ringFX(p,lo?5:7);fireLight(p,8,.35,0xffa050);const d=camera.position.distanceTo(p);SFX.boom(Math.max(.15,1-d/60),panOf(p));if(d<9)SFX.ring(1-d/9);shake=Math.min(1.2,shake+Math.max(0,1-d/18)*1.2)}
function utilFX(m){const p=new THREE.Vector3(...m.p);
 if(m.kind==='smoke'){smokes.push({p:p.clone().setY(p.y+1.2),r:4.2,t:0,life:13});SFX.hiss(p);const NS=qLevel()==='low'?14:qLevel()==='high'?26:20;for(let i=0;i<NS;i++){const a=i/16*6.28,r=Math.random()*2.6;fx.sprite({p:_v.set(p.x+Math.cos(a)*r,p.y+.4+Math.random()*2.2,p.z+Math.sin(a)*r),s0:1,s1:4.5+Math.random()*1.5,life:12+Math.random()*1.5,op:.92,color:0xd8dce2,rise:.03})}}
 if(m.kind==='molotov'){fires.push({p,r:m.small?2:3.4,t:0,life:m.small?4.5:7,emit:0,cr:0});if(!m.small){SFX.shatter(p);fx.spark(_v.set(p.x,p.y+.2,p.z),18,0x9fe0a8,4,.5);fx.spark(p,10,0xffffff,3,.4)}SFX.fwhoosh(p);fx.scorch(p,3.2);fx.sprite({p,tex:TX.flash,add:true,s0:1,s1:4,life:.4,op:.9,color:0xff8a30})}
 if(m.kind==='decoy'){decoys.push({p:p.clone(),t:0,life:8,next:0,n:0});SFX.click&&SFX.click(1800,.2);fx.sprite({p:p.clone().setY(p.y+.15),tex:TX.flash,add:true,s0:.2,s1:.8,life:.2,op:.8,color:0x9fe0ff})}
 if(m.kind==='flash'){fx.sprite({p,tex:TX.flash,add:true,s0:.5,s1:9,life:.25,op:1,color:0xffffff});const eye=camera.position;const d=eye.distanceTo(p);
  if(me.alive&&d<32&&losClear(p.clone().setY(p.y+.2),eye.clone())){const dir=p.clone().sub(eye).normalize();const facing=Math.max(0,dir.dot(fwd()));const k=Math.min(1,(.35+.65*facing)*(1-d/32)*1.4);flashAmt=Math.max(flashAmt,k*3.2);SFX.bang(k);SFX.ring(k)}else SFX.boom(.4,panOf(p))}}
const decoys=[];const DECG=['ar','handgun','smg','shotgun'];
function updDecoys(dt){for(let i=decoys.length-1;i>=0;i--){const d=decoys[i];d.t+=dt;d.next-=dt;if(d.t>d.life){decoys.splice(i,1);continue}if(d.next<=0){d.n++;const burst=d.n%7;d.next=burst===0?.55+Math.random()*.5:.09+Math.random()*.07;const w=DECG[(d.n/7|0)%DECG.length];const a=d.p.clone();a.y+=1.3;const dist=camera.position.distanceTo(a);if(dist<120)SFX.gun(w,Math.max(.06,1-dist/120)*.75,panOf(a),dist);fx.sprite({p:a,tex:TX.flash,add:true,s0:.3,s1:.55,life:.05,op:1,color:0xffd080});if(Math.random()<.5){const b=a.clone();b.x+=(Math.random()-.5)*20;b.z+=(Math.random()-.5)*20;b.y=.2;addTracer(a,b,null)}}}}
function updUtil(dt){updDecoys(dt);for(const s of smokes)s.t+=dt;for(let i=smokes.length-1;i>=0;i--)if(smokes[i].t>smokes[i].life)smokes.splice(i,1);
 for(const f of fires){f.t+=dt;f.emit-=dt;f.cr=(f.cr||0)-dt;if(f.cr<=0&&f.t<f.life){f.cr=.22+Math.random()*.2;const dd=camera.position.distanceTo(f.p);if(dd<28)SFX.crackle(f.p,1-dd/28)}if(f.emit<=0&&f.t<f.life){f.emit=qLevel()==='low'?.09:.045;const a=Math.random()*6.28,r=Math.sqrt(Math.random())*f.r;fx.sprite({p:_v.set(f.p.x+Math.cos(a)*r,f.p.y+.2,f.p.z+Math.sin(a)*r),tex:TX.fire,add:true,s0:1,s1:2.3,life:.6,op:.95,color:Math.random()<.5?0xff7a1a:0xffb03a,rise:2});
   if(Math.random()<.25)fx.sprite({p:_v.set(f.p.x+(Math.random()-.5)*f.r,f.p.y+1.5,f.p.z+(Math.random()-.5)*f.r),s0:1,s1:2.6,life:1.4,op:.35,color:0x333333,rise:1.2})}}
 for(let i=fires.length-1;i>=0;i--)if(fires[i].t>fires[i].life)fires.splice(i,1);
 // in-smoke overlay
 let sm=0;for(const s of smokes){if(s.t<1)continue;const d=camera.position.distanceTo(s.p);if(d<s.r)sm=Math.max(sm,Math.min(.88,(1-d/s.r)*1.6)*Math.min(1,(s.life-s.t)/2))}
 $('smokeOv').style.opacity=sm.toFixed(2);flashAmt=Math.max(0,flashAmt-dt);$('flashOv').style.opacity=Math.min(1,flashAmt).toFixed(2)}
let flashAmt=0,shake=0;
function panOf(p){return p.clone();const r=_v2.set(1,0,0).applyQuaternion(camera.quaternion);const d=_v.copy(p).sub(camera.position).normalize();return d.dot(r)*.8}
// ---------------- state ----------------
const DEFAULT_LOAD=['ar','handgun','fists','grenade'];
// ---------------- progression: diamonds (earned only by playing, stored on this device; no real money anywhere) ----------------
// economy: online match (first to 5) pays roughly 60-90 💎; mid-tier guns ~500-900 (5-8 matches), top tier ~1500-2000 (15-25). Offline / practice vs bots: everything x0.5 (kill 3→2 rounded)
const ECON={kill:3,head:2,round:8,win:20,play:5,bot:2,mul:()=>(H&&H.offline)||C.practice?.5:1};
// v41: 2X DIAMOND WEEKEND — Saturday + Sunday in the player's local time (window.__mockNow lets tests fake the date)
const wkNow=()=>new Date(window.__mockNow!=null?window.__mockNow:Date.now());const isWknd=()=>{const d=wkNow().getDay();return d===0||d===6};window.__isWknd=isWknd;
const CAMOS={factory:['Factory',0,null],desert:['Desert',150,0xc8a96a],forest:['Forest',150,0x4f6b3a],arctic:['Arctic',220,0xdfe8ee],crimson:['Crimson',300,0xb3202a],cobalt:['Cobalt',300,0x2a62c9],gold:['Gold',900,0xe8b923],neon:['Neon',650,0x39ff88]};
// v54: one catalogue (skins.js) drives the shop, chests, humans and Royale heroes. SKINS[id]=[name,price,humanOutfit]; wire/save form is "id" or "id~tint"
const SKINS=Object.assign({default:['Default',0,null]},Object.fromEntries(SKIN_DEFS.map(d=>[d.id,[d.name,d.price,humanOutfit(d.id,0)]])));
const cleanSkin=s=>{const{id,tint}=splitSkin(s);return SKINS[id]?joinSkin(id,id==='default'?0:tint):'default'};
const skinOutfit=s=>{const{id,tint}=splitSkin(s);return id==='default'||!SKIN_BY[id]?null:humanOutfit(id,tint)};
const FIT_N=BASE_N+SKIN_DEFS.length;
const UPG={mag:{name:'Extended Mag',per:.15,cost:[200,450]},reload:{name:'Fast Hands',per:.08,cost:[200,450]}};
// one wallet + inventory per device, shared by offline, hub and online play. Versioned key; migrates the old 'prog' save.
const WALLET_V=3;const PROG=(()=>{const base={v:WALLET_V,dia:0,owned:[],upg:{},camo:{},camos:{},skin:'default',skins:['default'],pets:[],pet:'',wskin:{},wskins:{},fr:null,pc:'soldier',pcs:['soldier']};let w=null;try{w=JSON.parse(LS('wallet')||'null')}catch(e){}
 if(!w||!w.v){let old={};try{old=JSON.parse(LS('prog')||'{}')||{}}catch(e){}w=Object.assign({},old,w||{});}
 const P=Object.assign(base,w);P.v=WALLET_V;P.dia=Math.max(0,P.dia|0);for(const k of['owned','skins','pcs','pets'])if(!Array.isArray(P[k]))P[k]=[];P.pets=P.pets.filter(id=>SK_BY[id]);if(typeof P.pet!=='string'||!P.pets.includes(P.pet))P.pet='';if(!P.pcs.includes('soldier'))P.pcs.push('soldier');if(!PCL[P.pc]||!P.pcs.includes(P.pc))P.pc='soldier';for(const k of['upg','camo','camos','wskin','wskins'])if(!P[k]||typeof P[k]!=='object'||Array.isArray(P[k]))P[k]={};
if(!P.skins.includes('default'))P.skins.push('default');LSS('wallet',JSON.stringify(P));return P})();

const wsOut=()=>({...PROG.wskin,pet:PROG.pet||undefined});
function saveProg(){PROG.v=WALLET_V;LSS('wallet',JSON.stringify(PROG));updDiaUI()}
addEventListener('storage',e=>{if(e.key===LSP+'wallet'&&e.newValue){try{Object.assign(PROG,JSON.parse(e.newValue));updDiaUI()}catch(x){}}});
const owns=id=>!W[id].price||PROG.owned.includes(id);
function tier(id,k){return(PROG.upg[id]||{})[k]||0}
const curRarFr=()=>{if(!BC)return 1;const t=S2T[me.cur],g=t!=null?BC.inv.g[t]:BC.inv.m;return g&&RAR[g[1]|0]?RAR[g[1]|0].fr:1};
function magOf(id){const w=W[id];let m=w.mag?Math.max(w.mag,Math.round(w.mag*(1+UPG.mag.per*tier(id,'mag')))):0;if(BC&&m){const si=me.load.indexOf(id),g=si>=0&&S2T[si]!=null?BC.inv.g[S2T[si]]:null;if(g)m=Math.max(1,Math.round(m*RAR[g[1]].m))}return m}
function reloadOf(id){const w=W[id];let r=+(w.reload*(1-UPG.reload.per*tier(id,'reload'))).toFixed(2);if(BC){const si=me.load.indexOf(id),g=si>=0&&S2T[si]!=null?BC.inv.g[S2T[si]]:null;if(g)r=+(r*RAR[g[1]].rl).toFixed(2)}return r}
function updDiaUI(){for(const e of document.querySelectorAll('.diaBal'))e.textContent=PROG.dia}
let diaToastT=null;
function addDia(n,why){if(n>0&&isWknd()){n*=2;why=(why||'')+' ×2 weekend'}(window.__dlog||(window.__dlog=[])).push([n,why]);if(!n)return;PROG.dia+=n;C.matchDia=(C.matchDia||0)+n;saveProg();const t=$('diaToast');if(t){t.textContent=`+${n} 💎 ${why||''}`;t.classList.remove('show');void t.offsetWidth;t.classList.add('show')}}
const me={id:null,pos:new THREE.Vector3(),vel:new THREE.Vector3(),ground:false,yaw:0,pitch:0,hp:100,alive:false,
 load:DEFAULT_LOAD.slice(),utilN:2,nl:{smoke:1,flash:1,decoy:1,medkit:0},nlSel:'smoke',cur:0,ammo:[0,0,0],cool:0,reloadT:0,reloadStage:0,switchT:0,slideT:0,crouch:false,slideCd:0,camH:1.62,stepT:0,zoomT:0,frozen:true,burst:0,burstT:0,shots:0,lastShot:0};
try{const l=JSON.parse(LS('load2')||'null');if(l&&l.length===4&&l.every((k,i)=>W[k]&&W[k].slot===i&&owns(k)))me.load=l}catch(e){}
const C={byOrd:{},players:{},phase:'lobby',map:0,mode:'team',score:{},round:0,hostId:null,roundT:0,sb:{}};
let isHost=false,peer=null,conn=null,roomCode='';
function gndAt(x,z,y){let g=y<.6?0:-1e9;for(const c of CN(x,z,.5,_cbA))if(x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1&&c.y1<=y+.45&&c.y1>y-1.2&&c.y1>g)g=c.y1;return g<-1e8?y:g}
function downSlope(q){const t=performance.now();if(q.slT&&t-q.slT<250)return q.slV;const y=q.rp.y,fx=-Math.sin(q.yaw),fz=-Math.cos(q.yaw);const f=gndAt(q.rp.x+fx*.45,q.rp.z+fz*.45,y),b=gndAt(q.rp.x-fx*.45,q.rp.z-fz*.45,y);q.slT=t;q.slV=Math.max(-.5,Math.min(.5,Math.atan2(f-b,.9)));return q.slV}
let DMTEX=null;function downMark(q,dn){if(!dn){if(q.dnM)q.dnM.visible=false;return}
 if(!q.dnM){if(!DMTEX){const cv=document.createElement('canvas');cv.width=cv.height=128;const x=cv.getContext('2d');x.beginPath();x.arc(64,64,54,0,7);x.fillStyle='rgba(200,20,30,.92)';x.fill();x.lineWidth=8;x.strokeStyle='#fff';x.stroke();x.fillStyle='#fff';x.fillRect(52,28,24,72);x.fillRect(28,52,72,24);DMTEX=new THREE.CanvasTexture(cv)}
  q.dnM=new THREE.Sprite(new THREE.SpriteMaterial({map:DMTEX,transparent:true,depthWrite:false}));q.dnM.position.y=1.55;q.model.add(q.dnM)}
 const mate=!isEnemy(q);const m=q.dnM;m.visible=true;m.material.depthTest=!mate;m.renderOrder=mate?10:0;const pu=1+Math.sin(performance.now()/180)*.12;const sc=(mate?.55:.38)*pu;m.scale.set(sc,sc,1);m.material.opacity=mate?1:.75}
function isEnemy(q){if(q.id===me.id)return false;if(C.mode==='ffa')return true;const mt=C.players[me.id]?.team;return q.team!==mt}
// ---------------- network ----------------
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},...TURN]};
const PREFIX='headshotz-v1-';const conns={};
let __spyOn=null;function send(m){if(__spyOn){__spyOn(m);return}if(isHost)hostHandle(me.id,m);else if(conn&&conn.open)conn.send(m)}
function sendTo(id,m){if(id===me.id)clientHandle(m);else if(conns[id]&&conns[id].open)conns[id].send(m)}
function bcast(m,except){for(const id in conns)if(id!==except&&conns[id].open)conns[id].send(m);if(except!==me.id)clientHandle(m)}
function genCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.random()*a.length|0];return s}
function myName(){let n=$('nameIn').value.trim().slice(0,12);if(!n)n='Player'+(Math.random()*900+100|0);LSS('name',n);return n}
function menuMsg(t){$('menuMsg').textContent=t}
function createRoom(code,auto){audioInit();const name=myName();roomCode=code||genCode();menuMsg('Creating room…');if(auto)H.auto=auto;
 peer=new Peer(PREFIX+roomCode,{config:ICE,debug:0});
 peer.on('open',id=>{isHost=true;me.id=id;hostInit(name);if(H.auto)setupAuto();else if(H.pub)regRoom();if(!(H.auto&&H.auto.fromHub))partyGo(roomCode)});
 peer.on('connection',c=>{c.on('data',d=>hostHandle(c.peer,d));c.on('open',()=>{conns[c.peer]=c});c.on('close',()=>hostLeave(c.peer));c.on('error',()=>hostLeave(c.peer))});
 peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();if(code)joinRoom(code,auto);else createRoom()}else if(!isHost)menuMsg('Network error: '+e.type)});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}})}
// OFFLINE: host locally with no PeerJS object at all (zero network); all messages loop back in-process
function startOffline(){audioInit();const name=myName();roomCode='OFFLINE';isHost=true;peer=null;me.id='me-offline';H.offline=true;H.fill=true;H.diff=H.diff||'normal';hostInit(name,true);for(let i=0;i<3;i++)send({t:'bot',add:1})}
function joinRoom(code,auto){audioInit();code=(code||'').toUpperCase().trim();if(code.length<4){menuMsg('Enter a room code');return}
 const name=myName();roomCode=code;menuMsg('Joining '+code+'…');peer=new Peer({config:ICE,debug:0});
 peer.on('open',id=>{me.id=id;conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});
  const to=setTimeout(()=>{if(!conn.open)menuMsg('Could not reach room '+code+'. Check the code or try again.')},12000);
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name,fit:curFit(),skin:PROG.skin,hid:hubSelfId,ws:wsOut(),cl:PROG.pc,party:PARTY?PARTY.id:null})});conn.on('data',clientHandle);conn.on('close',hostGone)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){menuMsg(auto?'Setting up the match…':'Room '+code+' not found — creating it so friends can join you!');peer.destroy();setTimeout(()=>createRoom(code,auto),auto?Math.random()*500:600)}else menuMsg('Network error: '+e.type)})}
function hostGone(){if(isHost)return;if(C.fromHub){location.href=hubUrl();return}alert('The host left the game. Tap OK to go back to the room link.');location.href=location.pathname+'?room='+roomCode}
// ================= HOST =================
const H={players:{},mode:'team',phase:'lobby',map:0,score:{},round:0,t:0,next:0,roundEnd:0,botN:0,order:0,fires:[],smokes:[],fireT:0,sideFlip:false};
const BOTNAMES=['Bolt','Ziggy','Rex','Nova','Pip','Tank','Moxie','Echo','Juno','Blaze','Kit','Ace'];const BOTGUNS=['ar','smg','battle','bullpup','pdw','vector','paintball','laser','freeze','bat','chainsaw'];
function hostInit(name,noUrl){C.hostId=me.id;H.players[me.id]=newP(me.id,name);H.players[me.id].skin=PROG.skin;H.players[me.id].fit=curFit();H.players[me.id].ws=cleanWS(wsOut());H.players[me.id].cl=clOf(PROG.pc);H.players[me.id].hid=hubSelfId;H.players[me.id].party=PARTY?PARTY.id:null;sendLobby();showLobby();if(!noUrl)history.replaceState(null,'','?room='+roomCode)}
function newP(id,name,bot){return{id,name,team:'A',color:0xffffff,hp:100,alive:false,kills:0,deaths:0,pts:0,hs:0,rk:0,vote:-1,bot:!!bot,p:[0,-50,0,0,0,0,0],respawn:0,ord:H.order++,gun:bot?BOTGUNS[(Math.random()*BOTGUNS.length)|0]:null,cl:bot?PCL_IDS[Math.random()*PCL_IDS.length|0]:'soldier',ws:bot&&Math.random()<.35?{'*':WSKIN_IDS[1+(Math.random()*(WSKIN_IDS.length-1))|0]}:{}}}
function plist(){return Object.values(H.players).sort((a,b)=>a.ord-b.ord)}
function assignTeams(){let i=0;const AT=H.auto&&H.auto.teams;if(RAIDM(H.mode)){raidAssignSquads();return}for(const p of plist()){if(AT&&p.hid&&AT[p.hid]&&H.mode!=='ffa'){p.team=AT[p.hid];p.color=TEAMCOL[p.team];i++;continue}if(H.mode==='ffa'){p.team=p.id;p.color=FFACOL[i%10]}else{p.team=i%2?'B':'A';p.color=TEAMCOL[p.team]}i++}}
function lobbyData(){return{t:'lobby',mode:H.mode,phase:H.phase,hostId:me.id,diff:H.diff||'normal',fill:!!H.fill,pub:!!H.pub,offline:!!H.offline,players:plist().map(p=>({id:p.id,name:p.name,team:p.team,color:p.color,bot:p.bot,vote:p.vote}))}}
function sendLobby(){if(H.phase==='lobby')assignTeams();bcast(lobbyData())}
function sbData(){return{t:'sb',p:plist().map(p=>[p.id,p.kills,p.deaths,p.pts,p.alive?1:0,p.hs,p.as||0]),r:H.score}}
function sendSB(){bcast(sbData())}
// a bot takes over a leaver's spot (fill-with-bots rooms) so teams stay even and the match keeps its size
function botTakeover(team){if(!H.fill||H.phase==='lobby'||H.phase==='starting')return;const want=MODEMAX[H.mode]||4;if(plist().length>=want)return;const id='bot'+(++H.botN);const b=H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true);
 if(H.mode==='ffa'){b.team=id;b.color=FFACOL[plist().length%10]}else{b.team=team;b.color=TEAMCOL[team]}b.respawn=H.t+1.5;b.hp=100;bcast(lobbyData());bcast({t:'join',id,name:b.name,team:b.team,color:b.color,o:b.ord,sk:b.skin,ft:b.fit,ws:b.ws,cl:b.cl,bot:1});sendSB()}
function hostLeave(id){const lp=H.players[id];if(!lp)return;if(H.br&&BRM(H.mode)&&H.phase==='play'&&!lp.elim&&!lp.bot){lp.alive=false;brElim(lp)}
 if(RAIDM(H.mode)&&H.raid&&H.phase==='play'&&lp&&!lp.bot&&!lp.machine&&!lp.settled&&!lp.extracted){
  if(!lp.raiGhost){lp.raiGhost=1;lp.raiGone=H.t;
   bcast({t:'rghost',id,name:lp.name,left:RAID.reconnect});
   bcast({t:'rfeed',msg:'OPERATOR DISCONNECTED: '+lp.name+' — reconnect window '+RAID.reconnect+'s'});}
  delete conns[id];sendSB();sendRaidStat(H.raid);return;
 }
 delete H.players[id];delete conns[id];bcast({t:'bye',id});if(H.phase==='lobby')sendLobby();else{if(!lp.bot&&H.phase!=='roundEnd'&&!BRM(H.mode)&&!RAIDM(H.mode))botTakeover(lp.team);sendSB();checkRound();remCheck()}}
function hostHandle(from,m){const p=H.players[from];
 if(RAIDM(H.mode)&&p&&p.raiGhost&&m.t!=='hello'&&m.t!=='rsync'&&/^r/.test(m.t)){sendTo(from,{t:'rerr',msg:'Operator disconnected — reconnect within '+RAID.reconnect+'s to continue'});return}
 switch(m.t){
 case 'hello':{if(RAIDM(H.mode)&&H.phase!=='lobby'&&m.rv!==RAID.v){if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}conns[from]?.send({t:'rerr',msg:'Raid protocol mismatch — reload the game to update.'});return}if(BRM(H.mode)&&H.phase!=='lobby'){if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}conns[from]?.send({t:'full'});return}const humMax=RAIDM(H.mode)?RAID.maxP:MAXP;
  const depId=RAIDM(H.mode)?String(m.deployId||'').slice(0,40):'';
  const ghost=RAIDM(H.mode)&&depId?plist().find(q=>q.raiGhost&&q.raiDeploy===depId):null;
  if(!ghost&&Object.values(H.players).filter(q=>!q.bot&&!q.machine&&!q.raiGhost).length>=humMax){conns[from]?.send({t:'full'});return}
  if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}
  if(RAIDM(H.mode)&&H.phase!=='lobby'&&p&&!p.raiGhost){sendTo(from,{t:'rerr',msg:'Already joined this raid; request a state sync instead'});return}
  if(RAIDM(H.mode)&&!ghost&&m.party&&plist().filter(q=>q.id!==from&&!q.bot&&!q.machine&&q.party===String(m.party).slice(0,12)).length>=RAID.perSquad){conns[from]?.send({t:'full'});return}
  const oldRec=RAIDM(H.mode)&&H.raid?(H.raid.settle[depId]||H.raid.settle[from]):null;
  let np;
  if(oldRec&&!ghost){
   np=H.players[from]=newP(from,String(m.name||'Player').slice(0,12));
   np.party=m.party?String(m.party).slice(0,12):null;np.skin=cleanSkin(m.skin);np.ws=cleanWS(m.ws);np.cl=clOf(m.cl);np.fit=fitOf(m.fit);np.hid=m.hid||null;
   np.raiDeploy=depId;np.settled=1;np.alive=false;np.hp=0;
  }else if(ghost){
   const oldId=ghost.id;delete conns[oldId];
   ghost.raiGhost=0;ghost.raiGone=0;ghost.id=from;
   for(const it of Object.values(H.raid.items)){if(it.owner===oldId)it.owner=from}
   delete H.players[oldId];H.players[from]=ghost;np=ghost;
   bcast({t:'bye',id:oldId});
  }else{
   np=H.players[from]=newP(from,String(m.name||'Player').slice(0,12));
   np.party=m.party?String(m.party).slice(0,12):null;np.skin=cleanSkin(m.skin);np.ws=cleanWS(m.ws);np.cl=clOf(m.cl);np.fit=fitOf(m.fit);np.hid=m.hid||null;
   np.raiDeploy=depId;
  }
  if(H.phase==='lobby')sendLobby();else{
   if(!ghost){
    if(RAIDM(H.mode)){if(!raidJoinTeam(np)){delete H.players[from];conns[from]?.send({t:'full'});return}}
    else if(H.mode==='ffa'){np.team=from;np.color=FFACOL[plist().length%10]}
    else{np.team=H.mode==='ext'?'A':teamForJoiner(from);np.color=TEAMCOL[np.team]}
   }
   {const mx=MODEMAX[H.mode]||MAXP;if(plist().length>mx){const bs=plist().filter(q=>q.bot&&(H.mode==='ffa'||q.team===np.team));const bt=bs.find(q=>!q.alive&&!q.machine)||bs[0];if(bt){delete H.players[bt.id];bcast({t:'bye',id:bt.id})}}}
   bcast(lobbyData());sendTo(from,startData());bcast({t:'join',id:from,name:np.name,team:np.team,color:np.color,o:np.ord,sk:np.skin,ws:np.ws,cl:np.cl,machine:np.machine?1:0},from);
   let spawns={};let cnt=0;
   if(RAIDM(H.mode)){
    np.respawn=0;
    if(!ghost){np.raiLoaded=0;np.raiPack=[];np.raiSecure=[];np.raiGear=null;np.raiArm=0;np.raiMax=100;np.raiContract='cores';np.raiRecovery=0;np.raiCap=RAID.cap;np.raiSecureCap=RAID.secure}
    if(oldRec){np.alive=false}
    else if(ghost){spawns[from]=[np.p[0],np.p[2]||0,np.p[3]||0];cnt=H.phase==='count'?Math.max(1,Math.ceil((H.next||0)-H.t)):0}
    else if(H.phase==='play'||H.phase==='count'){const sp=raidJoinSpawn(np);np.alive=true;np.hp=100;np.p=[sp[0],0,sp[1],sp[2],0,0,0];spawns[from]=[sp[0],sp[1],sp[2]];cnt=H.phase==='count'?Math.max(1,Math.ceil((H.next||0)-H.t)):0}
    else np.alive=false;
   }else if(H.phase==='play'||H.mode==='ffa')np.respawn=H.t+1;
   sendTo(from,{t:'round',round:H.round,score:H.score,spawns,count:cnt});sendSB();
   if(RAIDM(H.mode)&&H.raid){
    const I=raidInfo();
    sendTo(from,{t:'rstart',run:I.run,t0:+H.raid.t0.toFixed(2),limit:Math.round(H.raid.limit),time:RAID.time,exits:I.exits,count:RAID.squads});
    const srec=H.raid.settle[depId]||H.raid.settle[from];
    if(srec)sendTo(from,{t:'rsettle',...srec});
    if(ghost)sendRaidStat(H.raid);
   }
  }break}
 case 'mode':if(from===me.id&&H.phase==='lobby'&&MODES[m.mode]){H.mode=m.mode;sendLobby();regRoom()}break;
 case 'opt':if(from===me.id){if(DIFF[m.diff])H.diff=m.diff;if('fill' in m)H.fill=!!m.fill;if('pub' in m&&!H.offline){H.pub=!!m.pub;regRoom()}sendLobby()}break;
 case 'vote':if(p&&H.phase==='lobby'){p.vote=m.map|0;sendLobby()}break;
 case 'bot':if(from===me.id&&H.phase==='lobby'){if(m.add&&Object.keys(H.players).length<MAXP){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}
  else if(!m.add){const b=plist().filter(x=>x.bot).pop();if(b)delete H.players[b.id]}sendLobby()}break;
 case 'start':if(from===me.id&&H.phase==='lobby')startMatch();break;
 case 'rem':if(p&&H.matchOver){H.rem[from]=m.v?1:0;remCheck()}break;
 case 'ws':if(p){p.ws=cleanWS(m.ws);bcast({t:'ws',id:from,ws:p.ws})}break;
 case 'pab':if(p)hostAbility(PETX,p,m);break;
 case 'cl':if(p){p.cl=clOf(m.cl);bcast({t:'cl',id:from,cl:p.cl})}break;
 case 'fit':if(p){p.fit=fitOf(m.fit);if(m.sk!=null)p.skin=cleanSkin(m.sk);bcast({t:'fit',id:from,ft:p.fit,sk:p.skin})}break;
 case 'emo':if(p&&p.alive!==false&&Number.isInteger(m.e)&&m.e>=-1&&m.e<EMOTES.length)bcast({t:'emo',id:from,e:m.e},from);break;
 case 'ping':conns[from]?.send({t:'pong',ts:m.ts,n:plist().length});break;
 case 'st':if(p&&Array.isArray(m.p))p.p=m.p;break;
 case 'fx':if(p)p.shotT=H.t;bcast({t:'fx',id:from,a:m.a,b:m.b,w:m.w},from);break;
 case 'nade':if(H.br&&p&&p.inv){if(p.inv.u&&WIDS[p.inv.u[0]]===m.k&&p.inv.u[1]>0)p.inv.u[1]--;else if(p.inv.n&&WIDS[p.inv.n[0]]===m.k&&p.inv.n[1]>0)p.inv.n[1]--}bcast({t:'nade',id:from,k:m.k,p:m.p,v:m.v},from);break;
 case 'util':{if(!p||H.phase==='lobby')return;const pos=new THREE.Vector3(...m.p);if(m.kind==='molotov')H.fires.push({p:pos,r:m.small?2:3.4,t:0,life:m.small?4.5:7,owner:from});
  if(m.kind==='smoke')H.smokes.push({p:pos.clone().setY(pos.y+1.2),r:4.2,t:0,life:13});
  if(m.kind==='flash')for(const b of plist())if(b.bot&&b.alive&&b.e){const e=_v.set(b.e.pos.x,b.e.pos.y+1.5,b.e.pos.z);if(e.distanceTo(pos)<26&&rayClearHost(pos,e))b.blind=2.8}
  bcast({t:'util',id:from,kind:m.kind,p:m.p});break}
 case 'hit':{const v=H.players[m.id];if(!p||!v||H.phase!=='play'||!p.alive||!v.alive||p.down)return;if(m.id===from){if(!m.splash||!W[m.w]||!W[m.w].splash)return;m.dmg=Math.min(40,m.dmg|0)}else if(H.mode!=='ffa'&&p.team===v.team)return;
  damage(v,Math.min(220,Math.max(0,(H.br&&BRM(H.mode)?brScale(p,m):m.dmg)|0)),from,!!m.head,String(m.w||''));break}
 case 'dr':{const D=(cur&&cur.doorsL||[])[m.i|0];if(!p||!p.alive||H.phase==='lobby'||!D||p.air)return;if(Math.hypot(p.p[0]-D.x,p.p[2]-D.z)>3.8||Math.abs(p.p[1]-D.y)>2.8)return;const want=D.o?0:1;if(!want&&doorBlocked(D))return;bcast({t:'dor',i:D.id,o:want,w:from});break}
 case 'heal':if(p&&p.alive){p.hp=Math.min(100,p.hp+50);bcast({t:'hp',id:from,hp:p.hp})}break;
 case 'bj':case 'bl':case 'pk':case 'co':case 'rs':case 'use':case 'bpm':brHostMsg(from,m,p);break;
 case 'fall':if(p&&p.alive&&H.phase==='play'&&!p.air)damage(p,999,from,false,'fall');break;
 case 'rload':raidLoad(from,m,p);break;
 case 'rsearch':raidSearch(from,m,p);break;
 case 'rtake':raidTake(from,m,p);break;
 case 'rlook':raidLook(from,m,p);break;
 case 'ruse':raidUse(from,m,p);break;
 case 'rsecure':raidSecure(from,m,p);break;
 case 'rdrop':raidDrop(from,m,p);break;
 case 'rcall':raidCall(from,m,p);break;
 case 'rkey':raidKey(from,m,p);break;
 case 'rext':raidExt(from,m,p);break;
 case 'rsync':{const sk=H.raid&&(H.raid.settle[m.deployId||'']||H.raid.settle[from]);if(RAIDM(H.mode)&&sk)sendTo(from,{t:'rsettle',...sk});break}
 }}
function rayClearHost(a,b){const d=b.clone().sub(a);const l=d.length();d.divideScalar(l);if(rayWorld(a,d,l)<l-.3)return false;for(const s of H.smokes){if(s.t<1.2)continue;const lx=s.p.x-a.x,ly=s.p.y-a.y,lz=s.p.z-a.z;const tc=lx*d.x+ly*d.y+lz*d.z;const d2=lx*lx+ly*ly+lz*lz-tc*tc;const r=s.r*.8;if(d2<r*r&&tc>-r&&tc<l+r)return false}return true}
function teamForJoiner(id){const h={A:0,B:0},n={A:0,B:0};for(const p of plist()){if(p.id===id||!(p.team in n))continue;n[p.team]++;if(!p.bot)h[p.team]++}return h.A!==h.B?(h.A<h.B?'A':'B'):(n.A<=n.B?'A':'B')}
function teamSmaller(){let a=0,b=0;for(const p of plist()){if(p.team==='A')a++;else if(p.team==='B')b++}return a<=b?'A':'B'}
const AS_WIN=10,AS_MIN=25;
function asRec(v,dmg,by,w){if(!by||by===v.id||w==='fall'||w==='bleed'||!H.players[by])return;const D=v.dmgBy||(v.dmgBy={});const e=D[by]||(D[by]={d:0,t:-99});if(H.t-e.t>AS_WIN)e.d=0;e.d+=v.down?dmg*.5:dmg;e.t=H.t}
function asTake(v,k){const D=v.dmgBy||{};v.dmgBy={};const tm=isTeamMode(H.mode);const out=Object.entries(D).filter(([id,e])=>id!==k&&id!==v.id&&e.d>=AS_MIN&&H.t-e.t<=AS_WIN&&H.players[id]&&!(tm&&H.players[id].team===v.team)).sort((a,b)=>b[1].d-a[1].d).slice(0,2).map(x=>x[0]);
 for(const id of out){const a=H.players[id];a.as=(a.as||0)+1;a.pts+=50}return out}
function damage(v,dmg,by,head,w){if(!v.alive)return;if(v.raiGhost)return;if(v.air&&w!=='storm'&&w!=='bleed')return;if(v.prot&&H.t<v.prot&&w!=='fall'&&w!=='bleed')return;asRec(v,dmg,by,w);{const pc=PCL[v.cl];if(pc&&pc.hp&&w!=='fall'&&w!=='bleed')dmg=Math.max(1,Math.round(dmg*100/pc.hp));v.hurtT=H.t;if(v.bot&&v.flag&&H.mode==='ctf'&&w!=='fall')dmg=Math.max(1,Math.round(dmg*.28))}{const ww=W[w];if(ww&&(ww.slow||ww.push)&&by!==v.id)hitFX(v,ww,by)}
 if(v.down){if(by===v.id&&w!=='fall'&&w!=='bleed')return;v.dhp-=dmg;bcast({t:'hp',id:v.id,hp:0,by,dmg,head,d:1});if(v.dhp>0&&w!=='fall'&&w!=='bleed')return;
  v.down=false;v.rev=null;v.alive=false;const k=H.players[by];const fin=k&&by!==v.id;if(fin)k.pts+=25;v.dmgBy={};bcast({t:'kill',k:by,v:v.id,head,w,fin:fin?1:0,bleed:w==='bleed'?1:0});{const rd=respawnDelay(v);if(rd&&H.phase==='play')v.respawn=H.t+rd}sendSB();if(BRM(H.mode)&&H.br)brElim(v,by);if(RAIDM(H.mode))raidOnDeath(v,by);checkRound();return}
 if(v.sh>0&&w!=='storm'&&w!=='fall'&&w!=='bleed'){const a=Math.min(v.sh,dmg);v.sh-=a;dmg-=a;if(!v.bot)toPlayer(v.id,{t:'shd',sh:Math.round(v.sh)});if(dmg<=0){bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg:0,head,sh:1});return}}
 v.hp-=dmg;bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg,head});
 if(v.hp<=0&&isTeamMode(H.mode)&&!v.raider&&!v.machine&&H.phase==='play'&&w!=='fall'&&by!==v.id&&plist().some(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down)){
  v.hp=0;v.down=true;v.dhp=DOWN.hp;v.downT=H.t+DOWN.bleed;v.rev=null;for(const q of plist())if(q.rev&&q.rev.by===v.id){q.rev=null;(window.__rvc=window.__rvc||[]).push(q.id)}v.deaths++;const k=H.players[by];if(k){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w,dn:1,as:asTake(v,by)});sendSB();checkRound();return}
 if(v.hp<=0){v.alive=false;v.deaths++;const k=H.players[by];const self=!k||by===v.id;if(!self){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w,as:self?(v.dmgBy={},[]):asTake(v,by)});{const rd=respawnDelay(v);if(rd&&H.phase==='play')v.respawn=H.t+rd}sendSB();if(BRM(H.mode)&&H.br)brElim(v,by);if(RAIDM(H.mode))raidOnDeath(v,by);checkRound()}}
function toPlayer(id,msg){if(conns[id]&&conns[id].open)conns[id].send(msg);else if(id===me.id)clientHandle(msg)}
function hitFX(v,w,by){const k=H.players[by];if(w.slow){if(v.bot){v.slowT=H.t+w.slow[1];v.slowF=w.slow[0]}else toPlayer(v.id,{t:'slow',f:w.slow[0],d:w.slow[1]})}
 if(w.push&&k){const dx=v.p[0]-k.p[0],dz=v.p[2]-k.p[2],l=Math.hypot(dx,dz)||1;const px=dx/l*w.push,pz=dz/l*w.push;if(v.bot&&v.e){v.e.vel.x+=px;v.e.vel.z+=pz;v.e.vel.y=Math.max(v.e.vel.y,1.2)}else toPlayer(v.id,{t:'push',v:[px,pz]})}}
function startData(){return{t:'start',map:H.map,mode:H.mode,players:Object.fromEntries(plist().map(p=>[p.id,{name:p.name,team:p.team,color:p.color,bot:p.bot,o:p.ord,sk:p.skin,ft:p.fit==null?null:p.fit,ws:p.ws||{},cl:p.cl||'soldier',rd:p.raider?1:0,mc:p.machine?1:0,arch:p.arch||null}])),ms:MISSION(H.mode)?mInfo():null,br:BRM(H.mode)&&H.br?brInfo():null,raid:RAIDM(H.mode)?raidInfo():null}}
function startMatch(){for(const p of plist())if(p.raider){delete H.players[p.id];bcast({t:'bye',id:p.id})}{const mx=MODEMAX[H.mode]||10;const bots=plist().filter(p=>p.bot);while(plist().length>mx&&bots.length){const b=bots.pop();delete H.players[b.id];bcast({t:'bye',id:b.id})}}if(H.fill||BRM(H.mode)){const want=MODEMAX[H.mode]||4;while(Object.keys(H.players).filter(p=>!p.machine).length<want){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}}if(!H.rematch)assignTeams();const votes=MAPS.map(()=>0);for(const p of plist())if(p.vote>=0)votes[p.vote]++;
 const mx=Math.max(...votes);const best=votes.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);H.map=best[Math.random()*best.length|0];if(H.auto&&H.auto.map!=null)H.map=H.auto.map;if(H.rematch&&H.prevMap!=null)H.map=H.prevMap;H.rematch=0;if(BRM(H.mode))H.map=BR_I;if(RAIDM(H.mode)&&H.raidMap!=null){H.map=H.raidMap;H.raidMap=null;H.map=Math.max(0,Math.min(MAPS.length-1,H.map|0))}
 H.score={};H.round=0;H.fires=[];H.smokes=[];for(const p of plist()){p.kills=p.deaths=p.pts=p.hs=p.as=0}const m=buildMap(H.map);doorReset(m);cols=m.cols;groundHalf=m.groundHalf;ladders=m.ladders||[];hides=m.hides||[];buildGrid();
 if(MISSION(H.mode))missionPrep();else if(RAIDM(H.mode))raidPrep(m);else if(BRM(H.mode))brPrep();else H.br=null;H.phase='starting';bcast(lobbyData());bcast(startData());sendSB();setTimeout(startRound,900)}
// ---- spawn selection ----
function allSpawns(m){return[...m.spawnsA,...m.spawnsB,...m.spawnsM]}
function faceCenter(s){return Math.atan2(s[0],s[1])}
function minDistTo(s,pts){let d=1e9;for(const q of pts)d=Math.min(d,Math.hypot(q[0]-s[0],q[1]-s[1]));return d}
// pick spawn maximising distance from given points (with a little randomness among the best)
function farthest(cands,pts,used){const sc=cands.filter(s=>!used||!used.some(u=>u[0]===s[0]&&u[1]===s[1])).map(s=>[s,pts.length?minDistTo(s,pts):Math.random()*100]).sort((a,b)=>b[1]-a[1]);
 const top=sc.slice(0,Math.max(1,Math.min(2,sc.length))).filter(x=>x[1]>=sc[0][1]*.85);return(top[Math.random()*top.length|0]||sc[0])[0]}
function roundSpawns(){if(MISSION(H.mode))return missionSpawns();if(BRM(H.mode)&&H.br){const hs=heliAt(0),yw=Math.atan2(-(H.br.heli.b[0]-H.br.heli.a[0]),-(H.br.heli.b[1]-H.br.heli.a[1]));const o={};for(const p of plist())o[p.id]=[hs[0],hs[1],yw];return o}const m=buildMap(H.map);const ps=plist();const out={};const all=allSpawns(m);
 if(isTeamMode(H.mode)){const flip=Math.random()<.5;const sideOf=t=>(t==='A')!==flip?m.spawnsA:m.spawnsB;
  for(const t of['A','B']){const mates=ps.filter(p=>p.team===t);if(!mates.length)continue;const list=sideOf(t);const anchor=list[Math.random()*list.length|0];
   const byNear=list.slice().sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]));mates.forEach((p,i)=>out[p.id]=byNear[i%byNear.length])}}
 else{// duel & FFA: random first, then each next as far as possible from everyone already placed
  const order=ps.slice().sort(()=>Math.random()-.5);const used=[];for(const p of order){const s=used.length?farthest(all,used,used):all[Math.random()*all.length|0];used.push(s);out[p.id]=s}}
 for(const id in out){const s=out[id];out[id]=[s[0],s[1],faceCenter(s)]}return out}
function respawnPoint(p){const m=buildMap(H.map);if(MISSION(H.mode))return missionRespawn(p,m);const enemies=plist().filter(q=>q.alive&&q.id!==p.id).map(q=>[q.p[0],q.p[2]]);const s=farthest(allSpawns(m),enemies);return[s[0],s[1],faceCenter(s)]}
function startRound(){if(!Object.keys(H.players).length)return;H.round++;H.phase='count';H.fires=[];H.smokes=[];const spawns=RAIDM(H.mode)?raidSpawns():roundSpawns();
 for(const p of plist()){p.dmgBy={};p.hp=p.machine?(p.raiMax||100):(RAIDM(H.mode)&&p.raiArm?130:100);p.alive=true;p.down=false;p.rev=null;p.rk=0;p.respawn=0;const s=spawns[p.id];p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s)}
 if(RAIDM(H.mode)){H.raid.t0=H.t+0;raidStartServer()}else H.raid=null;
 H.next=H.t+3;H.roundEnd=H.t+3+(RAIDM(H.mode)?RAID.time:H.mode==='ffa'?120:BRM(H.mode)?99999:H.mode==='ctf'?CTF.time:H.mode==='ext'?EXT.time:90);const hps={};for(const p of plist())hps[p.id]=Math.round(p.hp);bcast({t:'round',round:H.round,score:H.score,spawns,hp:hps,count:3});sendSB();window.__lastSpawns=spawns;if(BRM(H.mode)&&H.br)brStartRound()}
function teamAlive(){const a={};for(const p of plist())if(p.alive&&!p.down)a[p.team]=(a[p.team]||0)+p.hp;return a}
function checkRound(){if(H.phase!=='play')return;if(RAIDM(H.mode))return;if(BRM(H.mode)){brCheck();return}if(MISSION(H.mode)){missionCheck();return}let win=null;
 if(H.mode==='ffa'){for(const p of plist())if(p.rk>=FFA_ROUND_KILLS)win=p.id}
 else{const a=teamAlive(),ks=Object.keys(a);const teams=new Set(plist().map(p=>p.team));if(teams.size<2){if(!ks.length)win='draw'}else if(ks.length<=1)win=ks[0]||'draw'}
 if(win)endRound(win)}
function endRound(win){H.phase='roundEnd';if(win!=='draw')H.score[win]=(H.score[win]||0)+1;const champ=win!=='draw'&&H.score[win]>=WIN_ROUNDS;
 const nm=H.mode==='ffa'?(H.players[win]?.name||'?'):(win==='A'?'BLUE TEAM':win==='B'?'RED TEAM':'');
 bcast({t:'roundEnd',win,name:nm,score:H.score,match:champ});sendSB();
 if(champ){H.matchOver=true;H.rem={};H.prevMap=H.map;clearTimeout(H.lobbyT);H.lobbyT=setTimeout(hostDecide,19000)}else setTimeout(startRound,3500)}
// ---- rematch (v42): same room, same players, same mode/map/settings. Host keeps the room open; everyone still connected is carried into the new match. ----
const humansOther=()=>plist().filter(p=>!p.bot&&p.id!==me.id);const remYes=()=>humansOther().filter(p=>H.rem&&H.rem[p.id]===1).length;
function hostRematch(){if(!isHost||!H.matchOver||H.phase!=='roundEnd')return false;clearTimeout(H.lobbyT);clearTimeout(H.remT);H.matchOver=false;H.rem={};H.rematch=1;
 if(peer&&!H.offline&&peer.disconnected){try{peer.reconnect()}catch(e){}}// re-host: make sure the broker still knows this room before clients rejoin
 bcast({t:'rematch',n:plist().length});H.remStart=setTimeout(()=>{if(H.phase==='roundEnd'||H.phase==='lobby')startMatch()},700);window.__rematches=(window.__rematches||0)+1;return true}
function hostDecide(){if(!isHost||!H.matchOver)return;clearTimeout(H.remT);if(remYes()>0&&humansOther().length){hostRematch();return}
 H.matchOver=false;if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl();return}
 if(H.phase==='roundEnd'){H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}}
function remCheck(){if(!isHost||!H.matchOver)return;const hs=humansOther();bcast({t:'remv',y:remYes(),n:hs.length});clearTimeout(H.remT);if(hs.length&&remYes()===hs.length&&H.rem[me.id]!==0)H.remT=setTimeout(()=>{if(H.matchOver)hostRematch()},3000)}
function hostTick(dt){H.t+=dt;if(H.phase==='play'||H.phase==='starting')botDoors(dt);if(H.phase==='play')hostPets(PETX,dt);if(H.phase==='play')for(const p of plist()){const pc=PCL[p.cl];const maxp=p.machine?(p.raiMax||100):(RAIDM(H.mode)&&p.raiMax?p.raiMax:100);if(pc&&pc.regen&&p.alive&&!p.down&&p.hp<maxp&&H.t-(p.hurtT||0)>4){const o=Math.floor(p.hp);p.hp=Math.min(maxp,p.hp+pc.regen*dt);if(Math.floor(p.hp)!==o&&Math.floor(p.hp)%3===0||p.hp>=maxp)bcast({t:'hp',id:p.id,hp:Math.round(p.hp)})}}
 if(H.auto&&H.phase==='lobby'&&H.autoAt){const humans=plist().filter(p=>!p.bot).length;if(humans>=H.auto.expect||H.t>H.autoAt){H.autoAt=0;startMatch()}}
 if(H.phase==='count'&&H.t>=H.next){H.phase='play';bcast({t:'go'})}
 if(H.phase==='play'){
  for(const v of plist()){if(!v.down)continue;if(H.t>=v.downT){damage(v,999,v.id,false,'bleed');continue}
   const rv=plist().filter(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down&&Math.hypot(q.p[0]-v.p[0],q.p[1]-v.p[1],q.p[2]-v.p[2])<=DOWN.r);
   if(rv.length){if(!v.rev||!rv.some(q=>q.id===v.rev.by))v.rev={by:rv[0].id,t0:H.t};if(H.t-v.rev.t0>=((PCL[(H.players[v.rev.by]||{}).cl]||{}).rev||DOWN.revive)){(window.__rv=window.__rv||[]).push(+(H.t-v.rev.t0).toFixed(3));(window.__rvBy=window.__rvBy||[]).push({id:v.id,by:v.rev.by});v.down=false;v.hp=DOWN.revHp;v.dmgBy={};const by=v.rev.by;v.rev=null;bcast({t:'revive',id:v.id,by,hp:v.hp});bcast({t:'hp',id:v.id,hp:v.hp});sendSB();continue}}
   else v.rev=null;
   if((v.dsT=(v.dsT||0)+dt)>.15){v.dsT=0;bcast({t:'dst',id:v.id,left:Math.max(0,v.downT-H.t),rv:v.rev?Math.min(1,(H.t-v.rev.t0)/((PCL[(H.players[v.rev.by]||{}).cl]||{}).rev||DOWN.revive)):0,by:v.rev?v.rev.by:null})}}
  if(RAIDM(H.mode))raidTick(dt);else if(MISSION(H.mode))missionTick(dt);else if(BRM(H.mode)&&H.br)brTick(dt);else if(H.t>=H.roundEnd){let win='draw';if(H.mode==='ffa'){let b=-1;for(const p of plist())if(p.rk>b){b=p.rk;win=p.id}}else{const a=teamAlive();win=(a.A||0)>(a.B||0)?'A':(a.B||0)>(a.A||0)?'B':'draw'}endRound(win)}
  if(H.phase==='play')for(const p of plist()){if(!p.alive&&p.respawn&&H.t>=p.respawn){p.respawn=0;p.dmgBy={};p.alive=true;p.hp=100;p.prot=MISSION(H.mode)?H.t+CTF.prot:0;const s=respawnPoint(p);p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s);bcast({t:'spawn',id:p.id,s});sendSB()}}
  for(const p of plist())if(p.bot&&p.alive&&!(H.botFreeze&&H.botFreeze[p.id]))botTick(p,dt);
  // molotov damage over time
  H.fireT+=dt;for(const f of H.fires)f.t+=dt;H.fires=H.fires.filter(f=>f.t<f.life);for(const s of H.smokes)s.t+=dt;H.smokes=H.smokes.filter(s=>s.t<s.life);
  if(H.fireT>=.5){H.fireT=0;for(const f of H.fires){const o=H.players[f.owner];for(const p of plist()){if(!p.alive)continue;if(o&&H.mode!=='ffa'&&p.team===o.team&&p.id!==f.owner)continue;if(p.id===f.owner)continue;
    if(Math.hypot(p.p[0]-f.p.x,p.p[2]-f.p.z)<f.r&&Math.abs(p.p[1]-f.p.y)<1.6)damage(p,7,f.owner,false,'molotov')}}}}
 if(H.phase!=='lobby'){const ps=plist(),n=ps.length;const iv=n<=4?.05:n<=6?.066:.083;H.snapT=(H.snapT||0)+dt;if(H.snapT>=iv){H.snapT=0;H.snapN=(H.snapN||0)+1;
  const rows=ps.map(p=>{const a=p.p;return[p.ord,Math.round(a[0]*100),Math.round(a[1]*100),Math.round(a[2]*100),Math.round(a[3]*1000),Math.round(a[4]*100),a[5]|0,(a[6]|0)|(p.down?4:0),p.alive?1:0]});
  const rt=Math.max(0,H.roundEnd-H.t)|0;const odd=H.snapN&1;
  for(const id in conns){if(!conns[id].open)continue;const v=H.players[id];const vp=v&&v.p;
   // interest throttling: players >45m away from this viewer are only sent every other snapshot (they move little on screen)
   const arr=vp&&n>4?rows.filter((r,i)=>odd||ps[i].id===id||Math.hypot(r[1]/100-vp[0],r[3]/100-vp[2])<45):rows;conns[id].send({t:'snap',p:arr,rt})}
  clientHandle({t:'snap',p:rows,rt})}}}
// ---- bots ----
function botReset(b,s){b.e={pos:new THREE.Vector3(s[0],0,s[1]),vel:new THREE.Vector3(),ground:true};b.yaw=s[2];b.cool=1;b.goal=null;b.strafe=1;b.st=0;b.react=.7;b.blind=0;b.shots=0}
const _o=new THREE.Vector3(),_d=new THREE.Vector3();
function navTarget(b,e,m){const g=b.goal,gy=g[2]||0,py=e.pos.y;const d2=(p)=>Math.hypot(p[0]-e.pos.x,p[2]-e.pos.z);
 if(b.via){const v=b.via;const t=b.viaStage?v.b:v.a;if(d2(t)<1.1&&Math.abs(t[1]-py)<1.2){if(!b.viaStage){b.viaStage=1;return v.b}else{b.via=null;return[g[0],gy,g[1]]}}else{if((b.viaT=(b.viaT||0)+.016)>14)b.via=null;else return t}}
 if(Math.abs(gy-py)>1.6&&m.links&&m.links.length){const up=gy>py;let best=null,bs=1e9;for(const L of m.links){const s=up?L.a:L.b,t=up?L.b:L.a;if(Math.abs(s[1]-py)>1.3)continue;const sc=Math.abs(t[1]-gy)*4+d2(s)*.6+Math.hypot(t[0]-g[0],t[2]-g[1])*2;if(sc<bs){bs=sc;best=L}}
  if(best){b.via=up?{a:best.a,b:best.b}:{a:best.b,b:best.a,down:1};b.viaStage=0;b.viaT=0;return b.via.a}}
 return[g[0],gy,g[1]]}
function botTick(b,dt){const e=b.e;let tgt=null,td=1e9;if(b.air){brAirTick(b,dt);return}
 if(b.machine&&b.flyer)return;
 if(b.down){// crawl toward the nearest standing teammate
  const mates=plist().filter(q=>q.team===b.team&&q.id!==b.id&&q.alive&&!q.down);let m=null,md=1e9;for(const q of mates){const d=Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z);if(d<md){md=d;m=q}}
  let wx=0,wz=0;if(m&&md>1){wx=(m.p[0]-e.pos.x)/md;wz=(m.p[2]-e.pos.z)/md;b.yaw=Math.atan2(-wx,-wz)}e.vel.x=wx*1.1;e.vel.z=wz*1.1;e.bump=0;physStep(e,dt);b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX[b.gun]|0,0];return}
 // go revive a downed teammate when no enemy is in sight
 if(isTeamMode(H.mode)){const dn=plist().filter(q=>q.down&&q.alive&&q.team===b.team&&q.id!==b.id);if(dn.length){let best=null,bd=1e9;for(const q of dn){const d=Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z);if(d<bd){bd=d;best=q}}
  if(best&&bd<60){b.revT=best.id;b.goal=[best.p[0],best.p[2],best.p[1]];b.via=null}else b.revT=null}else b.revT=null}b.blind=Math.max(0,(b.blind||0)-dt);const w=W[b.gun]||W.ar;
 if(b.blind<=0&&!H.noFight&&!b.far)for(const q of plist()){if(!q.alive||q.id===b.id||q.air||(H.mode!=='ffa'&&q.team===b.team))continue;const dx=q.p[0]-e.pos.x,dz=q.p[2]-e.pos.z,dy=q.p[1]-e.pos.y,dd=Math.hypot(dx,dy,dz);if(dd>55||dd>=td||(q.decoy>H.t&&dd>8)||((b.flag||b.drive!=null||b.rush)&&dd>(b.rush===2?5:b.rush===1?14:9))||(b.inv&&(b.gun==='fists'||H.t<(b.calm||0))&&dd>9&&!(q.shotT>H.t-2)))continue;if(dd>4.5&&hides.length&&inVol(hides,{x:q.p[0],y:q.p[1]+.5,z:q.p[2]})&&!(q.shotT>H.t-1.5))continue;
  _o.set(e.pos.x,e.pos.y+1.5,e.pos.z);if(!rayClearHost(_o,_d.set(q.p[0],q.p[1]+(q.down?.4:1.4),q.p[2])))continue;const sc=dd+(q.down?12:0);if(sc>=td)continue;td=sc;tgt=q}
 let wx=0,wz=0;b.st-=dt;if(b.st<=0){b.st=.5+Math.random()*1.2;b.strafe=Math.random()<.5?-1:1}
 if(tgt){const dx=tgt.p[0]-e.pos.x,dz=tgt.p[2]-e.pos.z;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*DIFF[H.diff||'normal'].turn);
  const fx2=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);wx=-fz*b.strafe;wz=fx2*b.strafe;if(td>14||(w.melee&&td>w.melee*.7)){wx+=fx2*(w.melee?3:1);wz+=fz*(w.melee?3:1)}
  b.react-=dt;b.cool-=dt;if(b.react<=0&&b.cool<=0&&!(w.melee&&td>w.melee+.4)){b.cool=w.rate*1.25;const D=DIFF[H.diff||'normal'];const hit=Math.random()<Math.max(.08,D.hit-td/100);const BS=window.__botStat||(window.__botStat={s:0,h:0,hd:0});BS.s++;if(hit)BS.h++;_o.set(e.pos.x,e.pos.y+1.4,e.pos.z);
   const end=[tgt.p[0]+(hit?0:(Math.random()-.5)*2),tgt.p[1]+1.2+(hit?0:Math.random()),tgt.p[2]+(hit?0:(Math.random()-.5)*2)];
   bcast({t:'fx',id:b.id,a:[_o.x,_o.y,_o.z],b:end,w:b.gun});if(hit){const head=Math.random()<D.head;if(head)BS.hd++;damage(tgt,Math.round((head?w.head:w.body)*falloff(w,td)*(b.rarD||1)),b.id,head,b.gun)}}}
 else{b.react=DIFF[H.diff||'normal'].react;const m=buildMap(H.map);const og=MISSION(H.mode)&&!b.revT?botMission(b):(BRM(H.mode)&&H.br&&!b.revT?botBR(b,dt):(RAIDM(H.mode)?botRaid(b,dt):null));if(og){const g=b.goal;if(!g||Math.hypot(g[0]-og[0],g[1]-og[1])>3||Math.abs((g[2]||0)-(og[2]||0))>1.5){b.goal=og;b.via=null;b.hold=0}}if(b.goal&&b.hold>0&&Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2&&Math.abs((b.goal[2]||0)-e.pos.y)<1.6)b.hold-=dt;if(!og&&!b.revT&&!(b.hold>0&&b.goal&&Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2.5)&&(!b.goal||(Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2&&Math.abs((b.goal[2]||0)-e.pos.y)<1.6)||(!H.noFight&&(Math.random()<dt*.05||(b.goalT=(b.goalT||0)+dt)>25)))){const all=allSpawns(m);const foes=plist().filter(q=>q.alive&&q.id!==b.id&&(H.mode==='ffa'||q.team!==b.team));const hi=m.nav?m.nav.filter(n=>(n[2]||0)>2):[];if(hi.length&&Math.random()<.4){b.goal=hi[Math.random()*hi.length|0].slice();b.hold=4+Math.random()*6}else if(foes.length&&Math.random()<.55){const f=foes[Math.random()*foes.length|0];b.goal=[f.p[0]+(Math.random()-.5)*3,f.p[2]+(Math.random()-.5)*3,f.p[1]]}else if(m.nav&&m.nav.length&&Math.random()<.5)b.goal=m.nav[Math.random()*m.nav.length|0].slice();else b.goal=all[Math.random()*all.length|0].slice();b.via=null;b.goalT=0}
  const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z;b.climbY=nt[1];const l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*4)}
 if(tgt&&b.flag&&H.mode==='ctf'){const og=botMission(b),g=b.goal;if(og&&(!g||Math.hypot(g[0]-og[0],g[1]-og[1])>3)){b.goal=og;b.via=null}const m=buildMap(H.map);const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z,l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;b.climbY=nt[1]}
 // revive takes priority over fighting unless an enemy is very close (<7 m): keep aiming/shooting, but walk to the downed mate and hold
 let revHold=false;if(b.revT){const q=H.players[b.revT];if(q&&q.down&&(!tgt||td>7)){const m=buildMap(H.map);if(tgt){const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z,l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;b.climbY=nt[1]}
   if(Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z)<.9&&Math.abs(q.p[1]-e.pos.y)<1.2){wx=wz=0;b.detour=0;revHold=true}}}
 if(b.detour>0&&!revHold){b.detour-=dt;wx=b.dd[0];wz=b.dd[1]}
 const l=Math.hypot(wx,wz);if(l>0){wx/=l;wz/=l}const sp=(b.blind>0?2:5.2)*(b.slowT>H.t?b.slowF:1)*(b.flag?1.35:1);{const cs=(PCL[b.cl]||{}).spd||1;e.vel.x+=(wx*sp*cs-e.vel.x)*Math.min(1,dt*10);e.vel.z+=(wz*sp*cs-e.vel.z)*Math.min(1,dt*10)}
 {const L=inVol(ladders,e.pos);e.ladTop=L&&(b.climbY??0)>e.pos.y+.3?L.y1:null;if(L){const ty=b.climbY??e.pos.y;if(ty>e.pos.y+.3){e.vel.y=4.4;e.vel.x-=L.n[0]*1.5;e.vel.z-=L.n[1]*1.5}else if(ty<e.pos.y-.3)e.vel.y=Math.min(e.vel.y,-2.5);else e.vel.y=Math.max(e.vel.y,0)}}
 if(e.ground&&!(b.via&&b.via.down)){const px=e.pos.x+e.vel.x*.45,pz=e.pos.z+e.vel.z*.45;if(!supportAt(px,e.pos.y,pz)){e.vel.x*=-.3;e.vel.z*=-.3;if(!b.via)b.goal=null}}
 if(e.ground&&supportAt(e.pos.x,e.pos.y,e.pos.z))b.lastG=[e.pos.x,e.pos.z];else if(!e.ground&&b.lastG&&!inVol(ladders,e.pos,.4)&&!(b.via&&b.via.down)&&!supportAt(e.pos.x,e.pos.y,e.pos.z)){const gx=b.lastG[0]-e.pos.x,gz=b.lastG[1]-e.pos.z,gl=Math.hypot(gx,gz)||1;e.vel.x=gx/gl*5;e.vel.z=gz/gl*5;if(!b.via)b.goal=null}
 {const want=Math.hypot(wx,wz)>.1&&!revHold&&!(b.hold>0&&b.goal&&Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2.5)&&!b.down;
  const spd=Math.hypot(e.vel.x,e.vel.z);if(H.phase==='play'){const sw=b.sw||(b.sw={t:0,w:0,x:e.pos.x,z:e.pos.z});sw.t+=dt;if(want)sw.w+=dt;if(sw.t>=4){if(sw.w>3){H.moveSec=(H.moveSec||0)+4;if(Math.hypot(e.pos.x-sw.x,e.pos.z-sw.z)<1.5)H.stuckSec=(H.stuckSec||0)+4}sw.t=sw.w=0;sw.x=e.pos.x;sw.z=e.pos.z}}
  const pr=b.pr||(b.pr={t:0,x:e.pos.x,z:e.pos.z});pr.t+=dt;if(pr.t>=.8){const mv=Math.hypot(e.pos.x-pr.x,e.pos.z-pr.z);b.lowProg=want&&mv<.7;
   if(b.lowProg&&!H.noUnstick&&!inVol(ladders,e.pos,.6)){b.stk=(b.stk||0)+1;const sg=(b.stk&1)?1:-1,vl=Math.hypot(wx,wz)||1;
    // 1: back up + strafe + hop; 2+: also re-path (new goal); 4+: aim for the nearest reachable nav point; 6+: nudge to the last good ground
    b.dd=[(-wx*.7-wz*sg)/vl,(-wz*.7+wx*sg)/vl];b.detour=.6+Math.random()*.4;if(e.ground)e.vel.y=7.5;
    if(b.stk>=2&&!b.revT){b.goal=null;b.via=null}
    if(b.stk>=4){const m=buildMap(H.map);const N=(m.nav||[]).filter(n=>Math.abs((n[2]||0)-e.pos.y)<1.5);let bn=null,bd=1e9;for(const n of N){const d=Math.hypot(n[0]-e.pos.x,n[1]-e.pos.z);if(d>2&&d<bd){bd=d;bn=n}}if(bn&&!b.revT){b.goal=bn.slice();b.via=null}}
    if(b.stk>=6&&b.goodG&&supportAt(b.goodG[0],b.goodG[2],b.goodG[1])){e.pos.set(b.goodG[0],b.goodG[2],b.goodG[1]);e.vel.set(0,0,0);b.goal=null;b.via=null;b.stk=0}}
   else if(!b.lowProg){b.stk=0;if(e.ground)b.goodG=[e.pos.x,e.pos.z,e.pos.y]}pr.t=0;pr.x=e.pos.x;pr.z=e.pos.z}}
 e.bump=0;{const n=Math.ceil(dt/.02);for(let i=0;i<n;i++){const bb=e.bump;physStep(e,dt/n);e.bump=e.bump||bb}}if(e.bump&&e.ground){e.vel.y=8;b.stuckN=(b.stuckN||0)+1;if(b.stuckN>1&&!(b.detour>0)){const sg=Math.random()<.5?1:-1;const vl=Math.hypot(wx,wz)||1;b.dd=[-wz/vl*sg,wx/vl*sg];b.detour=.7+Math.random()*.6;b.stuckN=0}if(Math.random()<.15&&!b.via&&!inVol(ladders,e.pos,.6))b.goal=null}else if(!e.bump)b.stuckN=Math.max(0,(b.stuckN||0)-dt);if(e.pos.y<-3)damage(b,999,b.id,false,'fall');
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX[b.gun]|0,e.ground?0:2]}
// ================= CLIENT =================
let lastLobby=null;
function clientHandle(m){if(m.t==='pfx'){PETS&&PETS.onFx(m);return}if(m.t==='pdia'){if(m.n>0){addDia(m.n|0,'sidekick');center('🐾 '+((SK_BY[PROG.pet]||{}).name||'Buddy')+' found '+(m.n|0)+'💎!',1400)}return}if(BC&&brMsg(m))return;if(RC&&raidMsg(m))return;switch(m.t){
 case 'lobby':lastLobby=m;C.hostId=m.hostId;C.mode=m.mode;if(m.phase==='lobby'){if(RAIDM(m.mode)&&!inGame&&raidBaseVisible()){raidBaseSyncLobby(m);renderLobby();break}if(inGame)leaveToLobby();showLobby()}renderLobby();break;
 case 'full':menuMsg('Room is full (10 players max).');break;
 case 'start':startGame(m);break;
 case 'ms':if(MS){MS.s=m.s;MS.at=performance.now();updMsHud()}break;
 case 'mev':missionEvent(m);break;
 case 'rematch':center('REMATCH!\nSame room, same players',1800);remWait=false;break;
 case 'remv':{const b=$('endAgain');if(b&&remWait)b.textContent=`⏳ WAITING (${m.y}/${m.n})`;break}
 case 'emo':{const q=C.players[m.id];if(q&&m.id!==me.id)q.emo=m.e>=0&&EMOTES[m.e]?{id:EMOTES[m.e],until:performance.now()+((EMOTE_DUR[EMOTES[m.e]]||3)+.3)*1000}:null;break}
 case 'fit':{const q=C.players[m.id];if(q){q.fit=fitOf(m.ft);if(m.sk!=null&&m.id!==me.id&&q.sk!==m.sk){q.sk=m.sk;if(q.model&&q.model.userData.kind!=='toon'){const vis=q.model.visible;scene.remove(q.model);q.model=makeCharacter(q.color,q.name,m.id,undefined,skinOutfit(m.sk)||undefined,q.cl);q.model.visible=vis;scene.add(q.model);q.gunId=null}}if(q.model&&m.id!==me.id&&q.model.userData.kind==='toon'){const vis=q.model.visible;scene.remove(q.model);window.__fitNext=q.fit;q.model=makeCharacter(q.color,q.name,m.id,undefined,undefined,q.cl);q.model.visible=vis;scene.add(q.model);q.gunId=null}}break}
 case 'cl':{const q=C.players[m.id];if(q&&q.model&&m.id!==me.id){const vis=q.model.visible;scene.remove(q.model);q.cl=clOf(m.cl);q.model=makeCharacter(q.color,q.name,m.id,undefined,skinOutfit(q.sk)||undefined,q.cl);q.model.visible=vis;scene.add(q.model);q.gunId=null}else if(q)q.cl=clOf(m.cl);break}
 case 'ws':{const q=C.players[m.id];if(q){q.ws=m.ws||{};q.gunSk=null;if(q.gunId){const g=q.gunId;q.gunId=null;setRemoteGun(q,WIDX[g])}}break}
 case 'join':addRemote(m.id,{name:m.name,team:m.team,color:m.color,o:m.o,sk:m.sk,ws:m.ws,cl:m.cl,bot:m.bot,raider:m.raider,machine:m.machine,mc:m.machine,arch:m.arch});renderSB();feed(`${m.name} joined`);break;
 case 'bye':{const q=C.players[m.id];if(q){if(q.model)scene.remove(q.model);feed(q.name+' left');delete C.players[m.id];delete C.sb[m.id];renderSB()}break}
 case 'round':{C.round=m.round;const rh=m.hp||{};for(const k in C.players){C.players[k].hp=rh[k]!=null?rh[k]:100;C.players[k].down=false;C.players[k].dst=null}me.down=false;me.dst=null;updDown();hideEnd();C.score=m.score;C.phase=m.count?'count':'play';for(const n of nades)scene.remove(n.m);nades=[];smokes.length=0;fires.length=0;
  for(const id in C.players){const q=C.players[id];const s=m.spawns[id];if(s){q.alive=true;q.hp=rh[id]!=null?rh[id]:100;q.rp.set(s[0],0,s[1]);q.tp.copy(q.rp);q.yaw=q.tyaw=s[2];if(q.model){q.model.userData.dead=0;q.model.visible=true}}}
  if(m.spawns[me.id]){spawnMe(m.spawns[me.id]);if(rh[me.id]!=null){me.hp=rh[me.id];updHP()}}else if(!m.count){me.alive=false;center('Joined mid-round\nYou spawn next round')}if(BC&&m.count){for(const id in C.players)C.players[id].flags=32;brRoundStart()}
  if(m.count){me.frozen=true;let n=m.count;const tick=()=>{if(C.phase!=='count')return;center((C.mode==='raid'?'RAID DEPLOYMENT':(BRM(C.mode)?'AIR DROP':'ROUND'))+' '+n);SFX.beep(600);n--;if(n>0)setTimeout(tick,1000)};tick()}renderSB();break}
 case 'go':C.phase='play';me.frozen=false;center(BC?'🚁 DROP! Press JUMP':'FIGHT!',BC?1600:800);SFX.beep(1200);showRL(false);break;
 case 'spawn':{const q=C.players[m.id];if(q){q.alive=true;q.hp=100;q.rp.set(m.s[0],0,m.s[1]);q.tp.copy(q.rp);if(q.model){q.model.userData.dead=0;q.model.visible=true}}if(m.id===me.id){spawnMe(m.s);me.frozen=false}break}
 case 'snap':C.roundT=m.rt;for(const a of m.p){const q=C.byOrd[a[0]];if(!q||q.id===me.id)continue;q.tp.set(a[1]/100,a[2]/100,a[3]/100);q.tyaw=a[4]/1000;q.tpitch=a[5]/100;q.flags=a[7]|0;q.wid=a[6]|0;
  const al=!!a[8];if(al&&!q.alive&&q.model){q.model.userData.dead=0;q.model.visible=true}if(!al&&q.alive&&q.model&&!q.model.userData.dead)q.model.userData.dead=.001;q.alive=al}break;
 case 'hp':{const q=C.players[m.id];if(q){if(m.hp<q.hp&&q.model)q.model.userData.flinch=1;q.hp=m.hp;sbDirty=1}if(m.id===me.id){if(m.hp<me.hp){SFX.hurt();flashV();shake=Math.min(1,shake+.5)}me.hp=m.hp;updHP()}break}
 case 'revive':{const q=C.players[m.id],r=C.players[m.by];if(q){q.down=false;q.dst=null;q.hp=m.hp;sbDirty=1}feed(`<b style="color:${hex(r?.color||0xffffff)}">${esc(r?.name||'?')}</b> <span class="k">[✚ revived]</span> <b style="color:${hex(q?.color||0xffffff)}">${esc(q?.name||'?')}</b>`,true);
  if(m.id===me.id){me.down=false;me.dst=null;me.hp=m.hp;updHP();center('✚ REVIVED!',1200);updDown()}if(m.by===me.id){center('✚ TEAMMATE REVIVED',1200);SFX.kill()}break}
 case 'slow':me.slowT=performance.now()+m.d*1000;me.slowF=m.f;frost(m.d);break;
 case 'push':me.vel.x+=m.v[0];me.vel.z+=m.v[1];me.vel.y=Math.max(me.vel.y,1.5);me.ground=false;break;
 case 'dst':{const q=C.players[m.id];if(q)q.dst=m;if(m.id===me.id){me.dst=m;updDown()}break}
 case 'kill':{const k=C.players[m.k],v=C.players[m.v];if(m.k===me.id&&m.head&&m.v!==me.id){SFX.headKill();const hx=$('hitX');if(hx){hx.classList.add('hk');setTimeout(()=>hx.classList.remove('hk'),380)}}const asL=(m.as||[]).map(id=>C.players[id]).filter(Boolean);const KN=`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b>`+asL.map(a=>` <span class="as">+</span> <b class="asn" style="color:${hex(a.color)}">${esc(a.name)}</b>`).join('');if((m.as||[]).includes(me.id)&&m.k!==me.id&&!m.fin){addDia(1,'assist');center('ASSIST +1💎',800)}(window.__alog||(window.__alog=[])).push([m.k,m.as||[],m.v]);(window.__klog||(window.__klog=[])).push([m.k,m.v,C.map,m.w,m.dn?'down':m.fin?'fin':m.bleed?'bleed':'']);
  if(m.dn){if(v){v.down=true;v.hp=0;sbDirty=1}if(m.k===me.id)addDia(Math.round((m.head?ECON.kill+ECON.head:ECON.kill)*ECON.mul()*(v&&v.bot?ECON.bot:1)),(m.head?'headshot down':'down')+(v&&v.bot?' (bot)':''));
   feed(`${KN} <span class="k">[${esc(W[m.w]?W[m.w].name:'')}${m.head?' 🎯':''} · downed]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
   if(m.v===me.id){me.down=true;me.hp=0;me.slideT=0;me.crouch=false;me.zoomT=0;updHP();updDown();center('DOWNED!\nWaiting for a teammate…',1800)}if(m.k===me.id){SFX.kill();center('DOWNED '+(v?.name||''),1000)}break}
  if(v){v.down=false;v.dst=null}if(m.v===me.id){me.down=false;me.dst=null;updDown()}
  if(m.fin||m.bleed){if(m.fin&&m.k===me.id)addDia(Math.max(1,Math.round(1*ECON.mul())),'finish');if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
   feed(m.bleed?`<b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b> <span class="k">[bled out]</span>`:`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[finished]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
   if(m.v===me.id){me.alive=false;me.hp=0;updHP();center(m.bleed?'BLED OUT':'FINISHED by '+(k?.name||'?'),2000)}if(m.fin&&m.k===me.id){SFX.kill();center('FINISHED '+(v?.name||''),900)}break}
  if(m.k===me.id&&m.v!==me.id)addDia(Math.round((m.head?ECON.kill+ECON.head:ECON.kill)*ECON.mul()*(v&&v.bot?ECON.bot:1)),(m.head?'headshot':'kill')+(v&&v.bot?' (bot)':''));if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
  const wn=m.w==='fall'?'fell':m.w==='molotov'?'🔥':W[m.w]?W[m.w].name:'';
  if(m.w==='fall'||m.w==='storm'||m.k===m.v)feed(`${v?.name||'?'} ${m.w==='fall'?'fell off':m.w==='storm'?'was caught in the storm ☣':'eliminated themselves'}`);else feed(`${KN} <span class="k">[${esc(wn)}${m.head?' 🎯':''}]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
  if(m.v===me.id){me.alive=false;me.hp=0;updHP();me.killer=m.k;center('ELIMINATED'+(k&&m.k!==m.v?'\nby '+k.name:'')+(C.mode==='ffa'?'\nRespawning…':''),2200)}
  if(m.k===me.id&&m.v!==me.id){SFX.kill();center(m.head?'🎯 HEADSHOT!':'ELIMINATED '+(v?.name||''),1000)}break}
 case 'roundEnd':{if(C.mode==='raid'){raidFinalResult(m);break}C.phase='roundEnd';C.score=m.score;me.frozen=true;const mine=C.mode==='ffa'?m.win===me.id:m.win===C.players[me.id]?.team;
  {if(!m.br){if(mine)addDia(Math.round(ECON.round*ECON.mul()),'round win');if(m.match)addDia(Math.round((mine?ECON.win+ECON.play:ECON.play)*ECON.mul()),mine?'match win':'match played')}}
  center(m.win==='draw'?'DRAW':(m.title?`${m.title}\n${m.sub}\n💎 +${C.matchDia||0} diamonds this match`:m.match?`${m.name}\nWINS THE MATCH!\n💎 +${C.matchDia||0} diamonds this match`:`${m.name} WINS THE ROUND`)+(mine?' 🏆':''),m.match?6000:3300);if(m.match)setTimeout(()=>showEnd(m,mine),2600);else showRL(true);if(mine)SFX.kill();renderSB();break}
 case 'fx':{{const sq=C.players[m.id];if(sq)sq.shotAt=performance.now()}const a=new THREE.Vector3(...m.a),b=new THREE.Vector3(...m.b);const fw=W[m.w];addTracer(a,b,fw&&fw.tracer);if(fw&&fw.paint)paintSplat(b,null,m.id);fx.sprite({p:a,tex:TX.flash,add:true,s0:.4,s1:.6,life:.05,op:1,color:0xffd080});
  const d=camera.position.distanceTo(a);if(d<120)SFX.gun(m.w,Math.max(.06,1-d/120)*.75,panOf(a),d);if(m.id!==me.id&&me.alive)nearMiss(a,b,fw);funFX(m.w,a,b);const dir=b.clone().sub(a).normalize();const t=rayWorld(a,dir,a.distanceTo(b)+.5);if(t<a.distanceTo(b)+.4)impact(a.clone().addScaledVector(dir,t),hitN.clone());break}
 case 'dor':doorSet(m.i,!!m.o,true);break;
 case 'nade':spawnNade(m.id,m.k||'grenade',new THREE.Vector3(...m.p),new THREE.Vector3(...m.v));break;
 case 'util':utilFX(m);break;
 case 'sb':C.sb={};for(const r of m.p)C.sb[r[0]]={k:r[1],d:r[2],pts:r[3],alive:!!r[4],hs:r[5],as:r[6]||0};C.score=m.r||{};renderSB();if(!$('pause').classList.contains('hidden'))renderBoard();break;
 }}
function addRemote(id,info){if(C.players[id]?.model)scene.remove(C.players[id].model);
 const q={id,cl:clOf(info.cl),ws:info.ws||{},name:info.name,team:info.team,color:info.color??0xffffff,bot:info.bot,raider:info.raider||info.rd,machine:info.machine||info.mc||false,arch:info.arch||null,alive:false,hp:100,rp:new THREE.Vector3(0,-50,0),tp:new THREE.Vector3(0,-50,0),lp:new THREE.Vector3(),yaw:0,tyaw:0,pitch:0,tpitch:0,flags:0};
 q.fit=fitOf(info.ft);if(id!==me.id){window.__fitNext=q.fit;q.model=makeCharacter(q.color,info.name,id,undefined,skinOutfit(info.sk)||undefined,info.cl);q.sk=info.sk;q.model.visible=false;scene.add(q.model)}C.players[id]=q;if(info.o!=null)C.byOrd[info.o]=q}
function startGame(m){hideEnd();setTimeout(renderParty,50);remWait=false;{const rt=$('roomTag');if(rt){const online=!(H&&H.offline)&&roomCode&&roomCode!=='OFFLINE'&&!C.hub;rt.classList.toggle('hidden',!online);if(online){const pub=lastLobby?!!lastLobby.pub:!!H.pub;rt.textContent=(pub?'🌐 PUBLIC · ':'🔒 PRIVATE · ')+roomCode+' · tap to invite'}}}for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.byOrd={};C.mode=m.mode;C.map=m.map;C.score={};C.sb={};C.matchDia=0;
 loadMap(m.map);for(const id in m.players)addRemote(id,m.players[id]);missionClientInit(m.ms||null);if(m.br)brClientInit(m.br);else brClear();if(m.raid)raidClientInit(m.raid);else raidClientClear();tpSetup();
 for(const s of['menu','lobby','arsenal','settings','raid'])$(s).classList.add('hidden');stopPreview();$('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);
 inGame=true;resize();me.alive=false;me.frozen=true;feed(`${MI(m.map).icon} ${MI(m.map).name} · ${MODES[m.mode][0]}`);center(MI(m.map).name.toUpperCase(),1500);renderSB();buildSlots();
 goFS()}
// face the most open direction, biased toward the map centre (never stare at a wall)
function faceYaw(x,z){const o=new THREE.Vector3(x,1.6,z),d=new THREE.Vector3();const cy=Math.atan2(x,z);let best=cy,bs=-1;
 for(let i=0;i<16;i++){const y=i/16*Math.PI*2;d.set(-Math.sin(y),0,-Math.cos(y));const free=Math.min(rayWorld(o,d,60),60);let dy=Math.abs(((y-cy+Math.PI*3)%(Math.PI*2))-Math.PI);const sc=free*(1.25-dy/Math.PI*.6);if(sc>bs){bs=sc;best=y}}
 return Math.hypot(x,z)<1?best:best}
function spawnMe(s){me.pos.set(s[0],0,s[1]);me.lad=null;me.mountT=0;me.vel.set(0,0,0);me.yaw=faceYaw(s[0],s[1]);me.pitch=0;me.hp=100;me.alive=true;me.slideT=0;me.crouch=false;me.reloadT=0;me.killer=null;recoilP=recoilY=0;
 me.ammo=me.load.slice(0,3).map(w=>magOf(w));{const lk=me.load[3];me.nl={smoke:1,flash:1,decoy:1,medkit:0};if(NLK.includes(lk)||lk==='medkit'){me.nl[lk]+=W[lk].count;me.utilN=1+((PCL[PROG.pc]||{}).util||0)}else me.utilN=W[lk].count+((PCL[PROG.pc]||{}).util||0)}me.cur=0;me.zoomT=0;me.zoomOn=false;updZoomBtn();setViewModel(me.load[0]);me.switchT=.35;updHP();buildSlots()}
function leaveToLobby(){clearMission();if(typeof RC!=='undefined'&&RC)raidClientClear();hideEnd();inGame=false;paused=false;$('hud').classList.remove('paused');$('hud').classList.add('hidden');$('pause').classList.add('hidden');for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};
 for(const n of nades)scene.remove(n.m);nades=[];if(document.pointerLockElement)document.exitPointerLock();resize()}
// ---------------- HUD ----------------
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let centerTO=null;function center(t,ms){$('center').textContent=t;clearTimeout(centerTO);if(ms)centerTO=setTimeout(()=>$('center').textContent='',ms)}
function feed(t,html){const d=document.createElement('div');if(html)d.innerHTML=t;else d.textContent=t;$('feed').prepend(d);while($('feed').children.length>4)$('feed').lastChild.remove();setTimeout(()=>d.remove(),5000)}
function updHP(){const mx=(RC&&RC.maxhp)||100;const h=Math.max(0,Math.min(mx,me.hp));const r=h/Math.max(1,mx);$('hpFill').style.width=(r*100)+'%';$('hpFill').style.background=r>.6?'#2ee59d':r>.3?'#ffd23f':'#ff5a6b';$('hpTxt').textContent=Math.ceil(h)}
function flashV(){const v=$('vign');v.style.transition='none';v.style.opacity=.75;requestAnimationFrame(()=>{v.style.transition='opacity .6s';v.style.opacity=0})}
function chip(q){const s=C.sb[q.id]||{k:0,pts:0,alive:q.alive};const rw=C.mode==='ffa'&&C.score[q.id]?`<i>★${C.score[q.id]}</i>`:'';
 const hp=s.alive?Math.max(0,Math.min(100,q.id===me.id?me.hp:(q.hp??100))):0;
 const dn=(q.id===me.id?me.down:q.down)&&s.alive;
 return `<div class="chip${q.id===me.id?' me':''}${s.alive?'':' dead'}${dn?' down':''}" style="--c:${hex(q.color)}"><b>${dn?'🩸 ':''}${esc(q.name)}</b>${rw}<span>${s.pts}</span><u style="width:${hp}%"></u></div>`}
function renderSB(){if(!inGame)return;if(BC){$('sbar').innerHTML='';brHudUpd();return}if(C.mode==='raid'){raidHudUpd();$('sbar').innerHTML='';return}const ps=Object.values(C.players).filter(q=>!q.raider);let h='';
 if(C.mode==='ffa'){ps.sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));h=`<div class="rounds"><small>R${C.round||1}</small></div>`+ps.map(chip).join('')}
 else{const A=ps.filter(p=>p.team==='A'),B=ps.filter(p=>p.team==='B');h=A.map(chip).join('')+`<div class="rounds"><span class="a">${C.mode==='ext'?(MS?MS.s.sec:0):(C.score.A||0)}</span><small>${C.mode==='ctf'?'🏁<br>FT'+CTF.goal:C.mode==='ext'?'💾<br>'+EXT.need+' of '+EXT.n:'R'+(C.round||1)+'<br>FT'+WIN_ROUNDS}</small><span class="b">${C.mode==='ext'?(MS?MS.s.wave:0):(C.score.B||0)}</span></div>`+B.map(chip).join('')}
 $('sbar').innerHTML=h}
function renderBoard(){if(C.mode==='raid'){raidBoardRender();return}const ps=Object.values(C.players).filter(q=>!q.raider).sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));
 $('board').innerHTML=`<div class="cardHead sm">${MODES[C.mode][0]} · ${MI(C.map).name} · ROOM ${roomCode}</div><table><tr style="opacity:.7;font-size:11px"><td>PLAYER</td><td>PTS</td><td>K</td><td>D</td><td>A</td><td>🎯</td>${C.mode==='ffa'?'<td>★</td>':''}</tr>`+
 ps.map(p=>{const s=C.sb[p.id]||{k:0,d:0,pts:0,hs:0,as:0};return`<tr class="${p.id===me.id?'me':''}"><td style="color:${hex(p.color)}">${esc(p.name)}${p.bot?' 🤖':''}</td><td>${s.pts}</td><td>${s.k}</td><td>${s.d}</td><td>${s.as||0}</td><td>${s.hs}</td>${C.mode==='ffa'?`<td>${C.score[p.id]||0}</td>`:''}</tr>`}).join('')+'</table>'}
let paused=false;
function openPause(on){paused=!!on;$('pause').classList.toggle('hidden',!on);$('hud').classList.toggle('paused',paused);
 // drop any held input so nothing keeps firing/moving behind the menu
 for(const k in keys)keys[k]=false;inp.fire=false;inp.mx=inp.mz=0;inp.sprint=false;inp.jump=false;lookPX=lookPY=0;joyId=lookId=null;$('joyKnob').style.transform='';
 if(on){renderBoard();if(document.pointerLockElement)document.exitPointerLock()}
 else if(!isTouch&&inGame&&canvas.requestPointerLock){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
$('menuBtn').onclick=()=>openPause(!paused);$('pResume').onclick=()=>openPause(false);
// desktop: Esc releases pointer lock without a keydown, so treat an unexpected unlock as "pause"
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&inGame&&!paused&&!(BC&&(BC.bagOn||BC.mapOn))&&!(RC&&RC.modal)&&$('arsenal').classList.contains('hidden')&&$('settings').classList.contains('hidden'))openPause(true)});$('pLeave').onclick=()=>{try{if(BC||BRM(C.mode)){sessionStorage.setItem('hsz_royMenu','1');sessionStorage.setItem('hsz_squad',JSON.stringify({mode:BRM(C.mode)?C.mode:'br',diff:(H&&H.diff)||LS('royDiff')||'normal',n:PARTY?PARTY.m.length:1}))}}catch(e){}location.href=location.pathname+((BC||BRM(C.mode))&&/[?&]net=local/.test(location.search)?'?net=local':'')};
$('pArsenal').onclick=()=>openArsenal();$('pShop').onclick=()=>openArsenal(null,'shop');$('pSettings').onclick=()=>openSettings();
let hudKey='';function updAmmo(){const k=me.cur+'|'+me.ammo.join(',')+'|'+(me.reloadT>0)+'|'+me.utilN+'|'+me.load.join()+'|'+(BC?JSON.stringify(BC.inv.n)+BC.inv.c.join():JSON.stringify(me.nl))+'|'+me.nlSel+(BC?'|'+BC.res.join()+BC.gk.join():'');if(k!==hudKey){hudKey=k;buildSlots()}}
function buildSlots(){let h='';const bo=BC?BRORD:[0,1,2];$('slots').classList.toggle('br6',!!BC);
 for(const i of bo){const id=me.load[i],w=W[id];const t=BC?S2T[i]:null;const emp=BC&&((t!=null&&!BC.inv.g[t])||(i===2&&BC.inv.m[0]===WIDX.fists));const gun=!w.melee;const a=i===me.cur&&gun?`<span>${me.reloadT>0?'⟳':me.ammo[i]}${BC&&t!=null?'<small>/'+BC.res[ammoOf(id)]+'</small>':''}</span>`:'';
  const tag=BC?`<b class="tp">${t!=null?TYS[t]:'MELEE'}</b>`:'';const k=BC?BRORD.indexOf(i)+1:i+1;
  h+=`<div class="sl${i===me.cur?' cur':''}${emp?' empty':''}" data-s="${i}">${tag}${emp&&BC?`<em>${t!=null?TYN[t]:'MELEE'}</em>`:`<img src="${ICON[id]||''}" alt="${w.name}">`}${a}${!isTouch&&BC?`<u>${k}</u>`:''}</div>`}
 h+=`<div class="sl util" data-s="3"><img src="${ICON[lethalK()]||''}" alt=""><span>×${me.utilN}</span></div>`;{const e=nlSel(),L=nlList();h+=`<div class="sl nl${e?'':' empty'}" data-nl="1" title="Non-lethal (X use, N cycle)">${e?nlIcon(e)+`<span>×${e.n}</span>`:'<em>NON-LETHAL</em>'}${L.length>1?`<i class="nlc">${L.length}</i>`:''}${!isTouch?'<u>X</u>':''}</div>`;const bn=$('bNL');if(bn){bn.innerHTML=e?nlIcon(e)+`<span>${e.n}</span>`:'<b class="nlI">·</b>';bn.style.opacity=e?1:.4;const bc=$('bNLc');if(bc){bc.textContent=L.length>1?'⟳'+L.length:'';bc.style.display=L.length>1?'':'none'}}}$('slots').innerHTML=h;if(BC)brSlotStyle();
 $('bNade').innerHTML=`<img src="${ICON[lethalK()]||''}" alt=""><span>${me.utilN}</span>`;$('bNade').style.opacity=me.utilN>0?1:.4}
$('slots').addEventListener('pointerdown',e=>{const nl=e.target.closest('[data-nl]');if(nl){e.stopPropagation();e.preventDefault();if(e.target.closest('.nlc'))nlCycle();else nlUse();return}const d=e.target.closest('[data-s]');if(!d)return;e.stopPropagation();e.preventDefault();const s=+d.dataset.s;if(s!==3)switchTo(s);else useUtil()});
const dmgPool=[];function showHit(pos,dmg,head){const hx=$('hitX');hx.className=head?'head':'';hx.style.transition='none';hx.style.opacity=1;requestAnimationFrame(()=>{hx.style.transition='opacity .3s';hx.style.opacity=0});
 head?SFX.head():SFX.hit();shake=Math.min(1,shake+(head?.18:.08));const d=document.createElement('div');d.textContent=dmg;if(head)d.className='h';$('dmgLayer').appendChild(d);dmgPool.push({el:d,p:pos.clone().add(new THREE.Vector3((Math.random()-.5)*.4,.35,0)),t:.85})}
function updDmg(dt){for(const n of dmgPool){n.t-=dt;n.p.y+=dt*.9;_v.copy(n.p).project(camera);if(_v.z>1||n.t<=0)n.el.style.display='none';else{n.el.style.left=((_v.x+1)/2*innerWidth)+'px';n.el.style.top=((1-_v.y)/2*innerHeight)+'px';n.el.style.opacity=Math.min(1,n.t*3)}}
 for(let i=dmgPool.length-1;i>=0;i--)if(dmgPool[i].t<=0){dmgPool[i].el.remove();dmgPool.splice(i,1)}}
// ================= MENUS =================
function showLobby(){$('menu').classList.add('hidden');$('lobby').classList.remove('hidden');$('roomCode').textContent=roomCode;renderLobby();renderLoadoutMini();if(Object.keys(THUMB).length<MAPS.length)setTimeout(()=>renderThumbs(),200)}
function renderLobby(){const m=lastLobby;if(!m||$('lobby').classList.contains('hidden'))return;const host=m.hostId===me.id;
 $('pCount').textContent=`${m.players.length}/${MODEMAX[m.mode]||10}`;$('fillBtn').textContent='FILL WITH BOTS: '+(m.fill?'ON':'OFF');$('fillBtn').classList.toggle('yellow',!!m.fill);
 $('pubBtn').textContent='PUBLIC: '+(m.pub?'ON':'OFF');$('pubBtn').classList.toggle('yellow',!!m.pub);$('pubBtn').style.display=m.offline?'none':'';$('shareBtn').style.display=m.offline?'none':'';$('roomCode').textContent=m.offline?'OFFLINE':roomCode;
 for(const b of document.querySelectorAll('[data-diff]'))b.classList.toggle('yellow',b.dataset.diff===m.diff);
 $('pList').innerHTML=m.players.map(p=>`<div class="pl"><span class="av" style="background:${hex(p.color)}">${p.bot?'🤖':esc(p.name[0]||'?').toUpperCase()}</span>${esc(p.name)}${p.id===m.hostId?' 👑':''}${p.id===me.id?' <small style="opacity:.7">(you)</small>':''}</div>`).join('');
 $('hostCtl').style.display=host?'flex':'none';
 $('modeBtns').innerHTML=Object.entries(MODES).map(([k,[n,i]])=>`<button data-mode="${k}" class="mode${m.mode===k?' sel':''}" ${host?'':'disabled'}><span class="mi">${i}</span>${n}</button>`).join('');
 const votes=MAPS.map(()=>0);let mine=-1;for(const p of m.players){if(p.vote>=0)votes[p.vote]++;if(p.id===me.id)mine=p.vote}
 $('mapBtns').innerHTML=MAPS.map((mp,i)=>`<button data-map="${i}" class="map${mine===i?' sel':''}" style="${THUMB[i]?`background-image:url(${THUMB[i]})`:''}">${votes[i]?`<span class="vc">${votes[i]}</span>`:''}<span class="mn">${mp.icon} ${mp.name}<small>${mp.desc}</small></span></button>`).join('');
 $('startBtn').style.display=host?'':'none';
 $('lobbyMsg').textContent=host?(m.players.length<2?'Tap INVITE to share the link — or add bots to practice!':'Ready? Hit START MATCH when everyone is in.'):(m.phase==='lobby'?'Waiting for the host to start…':'Match in progress — joining…')}
function renderLoadoutMini(){$('loadoutMini').innerHTML=me.load.map((id,i)=>`<button class="lm" data-slot="${i}"><img src="${ICON[id]||''}"><b>${W[id].name}</b><small>${['PRIMARY','SECONDARY','MELEE','UTILITY'][i]}</small></button>`).join('')}
$('lobby').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;audioInit();
 if(b.dataset.mode)send({t:'mode',mode:b.dataset.mode});if(b.dataset.map)send({t:'vote',map:+b.dataset.map});
 if(b.dataset.slot){const s=+b.dataset.slot;openArsenal(CLASSES.find(c=>c.slot===s&&(s!==0||c.id===W[me.load[0]].cls)).id)}});
$('fillBtn').onclick=()=>send({t:'opt',fill:!lastLobby.fill});$('pubBtn').onclick=()=>send({t:'opt',pub:!lastLobby.pub});
$('hostCtl').addEventListener('click',e=>{const b=e.target.closest('[data-diff]');if(b)send({t:'opt',diff:b.dataset.diff})});
$('startBtn').onclick=()=>send({t:'start'});$('botAdd').onclick=()=>send({t:'bot',add:1});$('botDel').onclick=()=>send({t:'bot',add:0});
$('leaveLobby').onclick=()=>{location.href=location.pathname};
$('shareBtn').onclick=async()=>{const url=location.origin+location.pathname+'?room='+roomCode;
 try{if(navigator.share&&isTouch){await navigator.share({title:GAME,text:`Join my ${GAME} match! Room ${roomCode}`,url});return}await navigator.clipboard.writeText(url);$('lobbyMsg').textContent='Link copied: '+url}catch(e){$('lobbyMsg').textContent='Invite link: '+url}};
$('nameIn').value=LS('name')||'';
const qRoom=new URLSearchParams(location.search).get('room');if(qRoom){$('codeIn').value=qRoom.toUpperCase().slice(0,5);$('joinBtn').textContent='JOIN '+qRoom.toUpperCase().slice(0,5)}
$('createBtn').onclick=()=>createRoom();$('offlineBtn').onclick=()=>startOffline();$('joinBtn').onclick=()=>joinRoom($('codeIn').value);
// ---- arsenal ----
let arsCls='ar',arsSel=null,arsMode='arsenal',skinSel=null;
const ARS_T={arsenal:'ARSENAL',shop:'WEAPON SHOP',upgrade:'UPGRADES'};
function openArsenal(cls,mode){audioInit();arsMode=mode||'arsenal';arsCls=(cls&&cls!=='char')?cls:W[me.load[0]].cls;wskSel=null;$('arsTitle').textContent=ARS_T[arsMode];$('arsenal').dataset.mode=arsMode;$('arsenal').classList.remove('hidden');renderArsenal();updDiaUI()}
function swatch(c){return c?'#'+new THREE.Color(c).getHexString():'linear-gradient(135deg,#555,#999)'}
function renderArsenal(){const cls=CLASSES.filter(c=>arsMode!=='upgrade'||c.id!=='util');
 $('arsTabs').innerHTML=cls.map(c=>`<button data-c="${c.id}" class="${c.id===arsCls?'sel':''}">${c.name}</button>`).join('')+(arsMode==='upgrade'?`<button data-c="char" class="${arsCls==='char'?'sel':''}">🧍 Character</button>`:`<button data-c="skins" class="skinsTab${arsCls==='skins'?' sel':''}">🎨 Skins</button>`);
 updDiaUI();
 if(arsCls==='char'){const ks=Object.keys(SKINS);if(!skinSel)skinSel=PROG.skin;
  $('arsGrid').innerHTML=ks.map(k=>{const[n,p,c]=SKINS[k];const own=PROG.skins.includes(k);return`<button class="wc${k===skinSel?' sel':''}" data-sk="${k}"><span class="sw big" style="background:${c?`linear-gradient(135deg,${swatch(c[0])} 50%,${swatch(c[1])} 50%)`:'#4b5344'}"></span>${n}<span class="eq">${PROG.skin===k?'WEARING':own?'OWNED':'💎 '+p}</span></button>`}).join('');
  const[n,p]=SKINS[skinSel];const own=PROG.skins.includes(skinSel);$('arsName').textContent=n+' outfit';$('arsDesc').textContent='Cosmetic only. Other players see it in matches and the hub.';$('arsStats').innerHTML='';$('arsUpg').innerHTML='';
  const b=$('arsEquip');b.dataset.act=own?'wear':'buyskin';b.textContent=PROG.skin===skinSel?'✓ WEARING':own?'WEAR':PROG.dia>=p?`BUY 💎 ${p}`:`NEED 💎 ${p-PROG.dia} MORE`;b.classList.toggle('poor',!own&&PROG.dia<p);stopPreview();$('arsPrev').innerHTML='<div class="skinPrev">🧍</div>';return}
 if(arsCls==='skins'){renderSkins();return}
 let list=Object.values(W).filter(w=>w.cls===arsCls);if(arsMode!=='shop')list=list.filter(w=>owns(w.id));else list.sort((a,b)=>(a.price||0)-(b.price||0));
 if(!list.length){$('arsGrid').innerHTML=`<div class="empty">No ${CLASSES.find(c=>c.id===arsCls).name} owned yet.<br><button class="pill yellow" data-act="goshop">🛒 OPEN SHOP</button></div>`;$('arsDetail').classList.add('hidden');stopPreview();return}
 $('arsDetail').classList.remove('hidden');
 if(!arsSel||!list.some(w=>w.id===arsSel))arsSel=(list.find(w=>me.load.includes(w.id))||list[0]).id;
 const badge=w=>arsMode==='shop'?(owns(w.id)?'<span class="eq own">OWNED</span>':`<span class="eq price">💎 ${w.price}</span>`):me.load.includes(w.id)?'<span class="eq">EQUIPPED</span>':'';
 $('arsGrid').innerHTML=list.map(w=>`<button class="wc${w.id===arsSel?' sel':''}${owns(w.id)?'':' locked'}" data-w="${w.id}"><img src="${ICON[w.id]||''}">${w.name}${badge(w)}</button>`).join('');
 const w=W[arsSel];$('arsName').textContent=w.name;$('arsDesc').textContent=w.desc+(w.slot===0?' · Primary':w.slot===1?' · Secondary':w.slot===2?' · Melee':' · Utility');
 const st=stats(w);const up=(n,v,t)=>`<div class="st"><span>${n}</span><div class="bar"><i style="width:${Math.round(Math.max(.04,Math.min(1,v))*100)}%"></i></div><span>${t}</span></div>`;
 $('arsStats').innerHTML=st?st.map(([n,v,t])=>n==='Magazine'&&tier(w.id,'mag')?up(n,v,magOf(w.id)+' ⬆'):n==='Reload'&&tier(w.id,'reload')?up(n,v,reloadOf(w.id)+'s ⬆'):up(n,v,t)).join(''):up('Count',w.count*.4,'×'+w.count);
 let u='';
 if(arsMode==='upgrade'){if(w.mag&&!w.melee)for(const k of['mag','reload']){const t=tier(w.id,k),U=UPG[k];const pips='■'.repeat(t)+'□'.repeat(2-t);
    u+=`<div class="upRow"><b>${U.name}</b><span class="pips">${pips}</span><small>${k==='mag'?'+15% mag':'−8% reload'} per tier</small>${t<2?`<button class="pill ${PROG.dia>=U.cost[t]?'yellow':'poor'}" data-act="up" data-k="${k}">💎 ${U.cost[t]}</button>`:'<span class="max">MAX</span>'}</div>`}
  const ownC=PROG.camos[w.id]||['factory'];
  u+=`<div class="upRow camoRow"><b>Camo</b><div class="camos">`+Object.entries(CAMOS).map(([k,[n,p,c]])=>{const o=k==='factory'||ownC.includes(k);const on=(PROG.camo[w.id]||'factory')===k;
   return`<button class="camo${on?' on':''}${o?'':' lock'}" data-act="camo" data-k="${k}" title="${n}"><span class="sw" style="background:${swatch(c)}"></span><small>${o?n:'💎'+p}</small></button>`}).join('')+'</div></div>'}
 $('arsUpg').innerHTML=u;
 const b=$('arsEquip');b.classList.remove('poor');
 if(!owns(w.id)){b.dataset.act='buy';b.textContent=PROG.dia>=w.price?`BUY 💎 ${w.price}`:`NEED 💎 ${w.price-PROG.dia} MORE`;b.classList.toggle('poor',PROG.dia<w.price);b.classList.add('yellow')}
 else{const eq=me.load[w.slot]===w.id;b.dataset.act='equip';b.textContent=eq?'✓ EQUIPPED':'EQUIP';b.classList.toggle('yellow',!eq)}
 startPreview(arsSel)}
// ---- weapon skins (per weapon): buy with diamonds, equip; shown on view model, preview and third-person guns ----
let wskSel=null;const ownsSkin=(id,k)=>k==='default'||(PROG.wskins[id]||[]).includes(k);
function sendWS(){if(inGame&&!C.hub)send({t:'ws',ws:cleanWS(wsOut())})}
function renderSkins(){const list=Object.values(W).filter(w=>w.cls!=='util'&&w.id!=='fists'&&owns(w.id));$('arsDetail').classList.remove('hidden');
 if(!arsSel||!list.some(w=>w.id===arsSel))arsSel=(list.find(w=>w.id===me.load[me.cur])||list.find(w=>me.load.includes(w.id))||list[0]).id;
 const cur=id=>PROG.wskin[id]||'default';if(!wskSel||!WSKINS[wskSel]){wskSel=cur(arsSel);if(wskSel==='default')wskSel=WSKIN_FEAT[0]}
 $('arsGrid').innerHTML=list.map(w=>{const k=cur(w.id);return`<button class="wc${w.id===arsSel?' sel':''}" data-w="${w.id}"><img src="${ICON[w.id]||''}">${w.name}<span class="eq skinEq" style="background:${WSKINS[k][3]}">${WSKINS[k][0]}</span></button>`}).join('');
 const w=W[arsSel];$('arsName').textContent=w.name+' · '+WSKINS[wskSel][0];$('arsDesc').textContent=(WSKINS[wskSel][4]?'✨ Animated premium skin. ':'')+'Cosmetic only — everyone sees it on your gun.';$('arsStats').innerHTML='';
 const btn=k=>{const[n,p,,css,prem]=WSKINS[k];const o=ownsSkin(w.id,k);return`<button class="wsk${k===wskSel?' sel':''}${cur(w.id)===k?' on':''}${prem?' prem':''}" data-act="wsk" data-k="${k}"><span class="sw${prem?' anim':''}" style="background:${css}"></span><small>${n}</small><em>${cur(w.id)===k?'✓ ON':o?'OWNED':'💎'+p}</em></button>`};$('arsUpg').innerHTML='<div class="cardHead sm">✨ FEATURED · ANIMATED</div><div class="wskins feat">'+WSKIN_FEAT.map(btn).join('')+'</div><div class="cardHead sm">ALL SKINS</div><div class="wskins">'+WSKIN_IDS.filter(k=>!WSKINS[k][4]).map(btn).join('')+'</div>';
 const b=$('arsEquip');const o=ownsSkin(w.id,wskSel),p=WSKINS[wskSel][1];b.classList.remove('poor');
 if(!o){b.dataset.act='buywsk';b.textContent=PROG.dia>=p?`BUY 💎 ${p}`:`NEED 💎 ${p-PROG.dia} MORE`;b.classList.toggle('poor',PROG.dia<p);b.classList.add('yellow')}
 else{const on=cur(w.id)===wskSel;b.dataset.act='eqwsk';b.textContent=on?(wskSel==='default'?'✓ FACTORY FINISH':'✓ EQUIPPED ON '+w.name.toUpperCase()):'EQUIP SKIN';b.classList.toggle('yellow',!on)}
 startPreview(arsSel,wskSel==='default'?null:wskSel)}
function setWSkin(id,k){if(k==='default')delete PROG.wskin[id];else PROG.wskin[id]=k;saveProg();if(me.load[me.cur]===id&&inGame)setViewModel(id);sendWS()}
function equip(w){if(BC){feed('Loadout is locked in Battle Royale');return}me.load[w.slot]=w.id;LSS('load2',JSON.stringify(me.load));renderLoadoutMini();if(inGame&&!C.hub)feed(`${w.name} equipped — active on next spawn`);if(C.hub)hubEquip()}
$('arsTabs').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;arsCls=b.dataset.c;arsSel=null;wskSel=null;renderArsenal();SFX.swap()});
$('arsGrid').addEventListener('click',e=>{const s=e.target.closest('[data-sk]');if(s){skinSel=s.dataset.sk;renderArsenal();SFX.swap();return}
 if(e.target.closest('[data-act="goshop"]')){openArsenal(arsCls,'shop');return}const b=e.target.closest('[data-w]');if(!b)return;arsSel=b.dataset.w;wskSel=null;renderArsenal();SFX.swap()});
function denied(){SFX.beep&&SFX.beep();const b=$('arsEquip');b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake')}
$('arsDetail').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;const w=W[arsSel];
 if(act==='equip'){equip(w);SFX.magIn()}
 else if(act==='buy'){if(PROG.dia<w.price)return denied();PROG.dia-=w.price;PROG.owned.push(w.id);saveProg();equip(w);SFX.kill();center(`🔓 ${w.name} unlocked!`,1400)}
 else if(act==='up'){const k=b.dataset.k,t=tier(w.id,k),c=UPG[k].cost[t];if(t>=2)return;if(PROG.dia<c)return denied();PROG.dia-=c;(PROG.upg[w.id]=PROG.upg[w.id]||{})[k]=t+1;saveProg();SFX.magIn()}
 else if(act==='camo'){const k=b.dataset.k,[n,p]=CAMOS[k];const own=PROG.camos[w.id]||(PROG.camos[w.id]=['factory']);if(!own.includes(k)){if(PROG.dia<p)return denied();PROG.dia-=p;own.push(k)}PROG.camo[w.id]=k;saveProg();delete VM[w.id];if(me.load[me.cur]===w.id)setViewModel(w.id);SFX.swap()}
 else if(act==='wsk'){wskSel=b.dataset.k;SFX.swap()}
 else if(act==='buywsk'){const p=WSKINS[wskSel][1];if(PROG.dia<p)return denied();PROG.dia-=p;(PROG.wskins[w.id]=PROG.wskins[w.id]||[]).push(wskSel);setWSkin(w.id,wskSel);SFX.kill();center(`🎨 ${WSKINS[wskSel][0]} unlocked!`,1400)}
 else if(act==='eqwsk'){setWSkin(w.id,wskSel);SFX.magIn()}
 else if(act==='buyskin'){const p=SKINS[skinSel][1];if(PROG.dia<p)return denied();PROG.dia-=p;PROG.skins.push(skinSel);saveProg();equipSkin(skinSel,0);SFX.kill()}
 else if(act==='wear'){equipSkin(skinSel,0)}
 renderArsenal()});
$('arsClose').onclick=()=>{$('arsenal').classList.add('hidden');stopPreview()};
$('openArsenal').onclick=()=>openArsenal();$('lobArsenal').onclick=()=>openArsenal();$('openShop').onclick=()=>openArsenal(null,'shop');$('openUpg').onclick=()=>openArsenal(null,'upgrade');$('lobShop').onclick=()=>openArsenal(null,'shop');
// ---- settings ----
function openSettings(){$('settings').classList.remove('hidden');$('sens').value=S.sens;$('sensVal').textContent=(+S.sens).toFixed(2);$('aimAssist').checked=S.aimAssist;const vm=$('voiceAnn');if(vm)vm.checked=S.voice!==false;const rm=$('reduceMotion');if(rm)rm.checked=!!S.reduceMotion;$('vol').value=S.vol;$('volVal').textContent=Math.round(S.vol*100)+'%';$('sfxv').value=S.sfx;$('sfxVal').textContent=Math.round(S.sfx*100)+'%';
 for(const b of $('qualBtns').children)b.classList.toggle('sel',b.dataset.q===S.quality);$('zsens').value=S.zsens;$('zsensVal').textContent=(+S.zsens).toFixed(2);$('qualNow').textContent=S.quality==='auto'?'(auto: '+qLevel()+')':''}
$('vol').oninput=e=>{S.vol=+e.target.value;$('volVal').textContent=Math.round(S.vol*100)+'%';saveS();setVolumes()};$('sfxv').oninput=e=>{S.sfx=+e.target.value;$('sfxVal').textContent=Math.round(S.sfx*100)+'%';saveS();setVolumes();SFX.click()};
$('zsens').oninput=e=>{S.zsens=+e.target.value;$('zsensVal').textContent=S.zsens.toFixed(2);saveS()};
$('sens').oninput=e=>{S.sens=+e.target.value;$('sensVal').textContent=S.sens.toFixed(2);saveS()};$('aimAssist').onchange=e=>{S.aimAssist=e.target.checked;saveS()};
$('voiceAnn')&&($('voiceAnn').onchange=e=>{S.voice=e.target.checked;saveS();if(!S.voice){try{speechSynthesis.cancel()}catch(_){}};if(e.target.checked&&window.speechSynthesis){try{const u=new SpeechSynthesisUtterance('Voice announcements on');u.volume=Math.min(1,S.sfx);speechSynthesis.speak(u)}catch(_){}}});
$('reduceMotion')&&($('reduceMotion').onchange=e=>{S.reduceMotion=e.target.checked;document.body.classList.toggle('rm',S.reduceMotion);saveS()});
$('qualBtns').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;const wasLow=qLevel()==='low';S.quality=b.dataset.q;saveS();applyQuality();openSettings()};
$('setClose').onclick=()=>$('settings').classList.add('hidden');$('openSettings').onclick=openSettings;$('lobSettings').onclick=openSettings;
// ================= INPUT =================
const SLIDE={boost:1.5,cap:14.5,tap:.7,max:1.6};window.__SLIDE=SLIDE;const keys={};const inp={mx:0,mz:0,fire:false,jump:false,slide:false,sprint:false,zoom:false};
let lookPX=0,lookPY=0;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(!(inGame&&paused&&!['Escape','Tab','KeyP'].includes(e.code)))keys[e.code]=true;if(!inGame)return;if(paused&&!['Escape','Tab','KeyP'].includes(e.code))return;
 if(e.code==='Space'){inp.jump=true;e.preventDefault()}if(e.code==='KeyC'||e.code==='ControlLeft'){if(!e.repeat)inp.crouchP=true;inp.slideHold=true;e.preventDefault()}
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchTo(nxtSlot());if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(BC){if(n>=1&&n<=5)switchTo(BRORD[n-1])}else{if(n>=1&&n<=3)switchTo(n-1);if(n===4)useUtil()}}
 if(e.code==='Tab'&&RAIDM(C.mode)&&RC&&RC.modal)return;
 if(e.code==='KeyG'||e.code==='KeyF')useUtil();if(e.code==='KeyX'&&!e.repeat)nlUse();if(e.code==='KeyN'&&!e.repeat)nlCycle();if(e.code==='Tab'||e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(e.repeat)return;
  if(RAIDM(C.mode)&&e.code==='Tab'){raidPackToggle();return}
  if(RAIDM(C.mode)&&e.code==='Escape'&&RC&&RC.modal){raidCloseModal();return}
  if(!$('arsenal').classList.contains('hidden')){$('arsClose').click();return}if(!$('settings').classList.contains('hidden')){$('setClose').click();return}
  if(e.code==='Tab')openPause(true);else openPause(!paused)}
 if(e.code==='KeyZ'&&!e.repeat)toggleZoom()});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyC'||e.code==='ControlLeft')inp.slideHold=false;if(e.code==='Tab'&&!RAIDM(C.mode))openPause(false)});
canvas.addEventListener('mousedown',e=>{audioInit();if(!inGame||isTouch)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return}if(e.button===0)inp.fire=true;if(e.button===2)zoomPress()});
addEventListener('mouseup',e=>{if(e.button===0)inp.fire=false;if(e.button===2)zoomRelease()});
addEventListener('contextmenu',e=>{if(inGame)e.preventDefault()});
addEventListener('wheel',e=>{if(inGame&&document.pointerLockElement){if(BC){const n=BRORD.length;let i=BRORD.indexOf(me.cur),d=e.deltaY>0?1:n-1;for(let k=0;k<n;k++){i=(i+d)%n;if(brHas(BRORD[i])){switchTo(BRORD[i]);break}}}else switchTo((me.cur+(e.deltaY>0?1:2))%3)}},{passive:true});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;if(EM.wheel){emoMove(e.movementX,e.movementY);return}const s=.0021*S.sens*zoomSens();me.yaw-=e.movementX*s;me.pitch-=e.movementY*s;clampPitch()});
function clampPitch(){me.pitch=Math.max(-1.5,Math.min(1.5,me.pitch))}
// zoom sensitivity follows the FOV ratio (so aim feels the same on screen), a touch slower when fully scoped
function zoomSens(){const r=Math.tan(camera.fov*Math.PI/360)/Math.tan(75*Math.PI/360);const w=W[me.load[me.cur]];const scoped=w&&w.cls==='sniper'&&me.zoomT>.85;
 return Math.pow(r,.85)*(me.zoomT>.05?S.zsens:1)*(scoped?.85:1)}
// per-weapon ADS field of view
function adsFov(w){if(!w||w.melee||w.cls==='util')return 0;if(w.scope)return w.scope;return{pistol:62,smg:58,ar:50,shotgun:62}[w.cls]||58}
let zoomDownT=0,zoomWasOn=false;
function toggleZoom(){const w=W[me.load[me.cur]];if(!adsFov(w)||!me.alive){me.zoomOn=false;updZoomBtn();return}me.zoomOn=!me.zoomOn;updZoomBtn();if(me.zoomOn)SFX.swap&&tone(900,.03,.05,'sine',0,out())}
function zoomPress(){audioInit();zoomDownT=performance.now();zoomWasOn=me.zoomOn;toggleZoom()}
function zoomRelease(){if(!zoomWasOn&&me.zoomOn&&performance.now()-zoomDownT>320){me.zoomOn=false;updZoomBtn()}}
function updZoomBtn(){$('bZoom').classList.toggle('on',!!me.zoomOn)}
// touch
const touchEl=$('touch');let joyId=null,lookId=null,joyC=[0,0],lookL=[0,0];
$('bZoom').addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();$('bZoom').classList.add('down');zoomPress()});
for(const ev of['pointerup','pointercancel'])$('bZoom').addEventListener(ev,e=>{$('bZoom').classList.remove('down');if(ev==='pointerup')zoomRelease()});
for(const id of['bJump','bSwap','bNade','bSlide','bNL','bNLc']){const b=$(id);if(!b)continue;
 b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audioInit();b.classList.add('down');if(id==='bSwap')switchTo(nxtSlot());else if(id==='bNade')useUtil();else if(id==='bNL')nlUse();else if(id==='bNLc')nlCycle();else if(id==='bSlide'){inp.crouchP=true;inp.slideHold=true}else inp.jump=true});
 const up=()=>{b.classList.remove('down');if(id==='bSlide')inp.slideHold=false};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
touchEl.addEventListener('pointerdown',e=>{if(paused)return;if(e.target!==touchEl&&!e.target.closest('#joyBase'))return;audioInit();
 if(e.clientX<innerWidth*.42&&joyId===null){joyId=e.pointerId;joyC=[e.clientX,e.clientY];const jb=$('joyBase');const r=$('hud').getBoundingClientRect();jb.style.left=(e.clientX-r.left-62)+'px';jb.style.top=(e.clientY-r.top-62)+'px';jb.style.bottom='auto';jb.style.opacity=1}
 else if(lookId===null){lookId=e.pointerId;lookL=[e.clientX,e.clientY]}});
touchEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId){let dx=e.clientX-joyC[0],dy=e.clientY-joyC[1];const l=Math.hypot(dx,dy),mx=52;if(l>mx){dx*=mx/l;dy*=mx/l}
  $('joyKnob').style.transform=`translate(${dx}px,${dy}px)`;{const n=Math.min(1,l/mx),dz=.14,m=n<dz?0:Math.pow((n-dz)/(1-dz),1.15);const k=l>0?m/n:0;inp.mx=dx/mx*k;inp.mz=dy/mx*k}inp.sprint=l>mx*.88&&dy<-mx*.5}
 else if(e.pointerId===lookId){lookPX+=e.clientX-lookL[0];lookPY+=e.clientY-lookL[1];lookL=[e.clientX,e.clientY]}});
const tEnd=e=>{if(e.pointerId===joyId){joyId=null;inp.mx=inp.mz=0;inp.sprint=false;$('joyKnob').style.transform='';const jb=$('joyBase');jb.style.opacity=.7;jb.style.left='36px';jb.style.top='auto';jb.style.bottom='40px'}if(e.pointerId===lookId)lookId=null};
touchEl.addEventListener('pointerup',tEnd);touchEl.addEventListener('pointercancel',tEnd);
function applyTouchLook(dt){if(!lookPX&&!lookPY)return;// light smoothing: consume most of the pending delta each frame
 const k=Math.min(1,dt*38);let ax=lookPX*k,ay=lookPY*k;lookPX-=ax;lookPY-=ay;if(Math.abs(lookPX)<.05)lookPX=0;if(Math.abs(lookPY)<.05)lookPY=0;
 let s=.0052*S.sens*zoomSens();if(S.aimAssist&&me.alive&&nearAim(.06))s*=.6;if(S.aimAssist&&me.alive)aimPull(dt);
 const sp=Math.hypot(ax,ay)/Math.max(dt,.001);const accel=1+Math.min(.5,sp/4000);me.yaw-=ax*s*accel;me.pitch-=ay*s*accel*.9;clampPitch()}
// ================= LOCAL PLAYER =================
function nxtSlot(){if(!BC)return(me.cur+1)%3;const n=BRORD.length,i0=Math.max(0,BRORD.indexOf(me.cur));for(let k=1;k<=n;k++){const i=BRORD[(i0+k)%n];if(brHas(i))return i}return me.cur}
function switchTo(i){if(i===me.cur||!me.alive||(BC&&(BC.air||!brHas(i))))return;me.cur=i;me.reloadT=0;me.switchT=.32;me.zoomT=0;me.zoomOn=false;updZoomBtn();me.burst=0;setViewModel(me.load[i]);SFX.swap()}
function reload(){const w=W[me.load[me.cur]];if(w.melee||me.reloadT>0||me.ammo[me.cur]>=magOf(w.id)||!me.alive)return;if(BC){const t=ammoOf(me.load[me.cur]);if(BC.res[t]<=0){if(performance.now()-(BC.noAmmoT||0)>1500){BC.noAmmoT=performance.now();center('No '+AMN[t]+' ammo',900)}return}}me.reloadT=reloadOf(w.id);me.reloadStage=0;me.burst=0;
 VA.emptyRl=me.ammo[me.cur]<=0;VA.inspect=0;VA.cyc=0;VA.shellN=Math.max(1,Math.min(8,magOf(w.id)-me.ammo[me.cur]));VA.cue=0;VA.cues=reloadCues(vmInfo.rl||'mag',VA.shellN,VA.emptyRl)}
// timed reload events per action type: [progress, sound, side effect]
function reloadCues(rl,n,empty){const c=[];const add=(k,f,x)=>c.push([k,f,x]);
 if(rl==='shells'){for(let i=0;i<n;i++)add(.12+.76*(i+.55)/n,'shellIn','ammo');if(vmInfo.cyc==='pump'&&empty)add(.93,'pump');if(vmInfo.cyc==='lever'&&empty)add(.93,'lever')}
 else if(rl==='cyl'){add(.12,'cylOpen');add(.3,'shellsOut','cylEject');add(.6,'magIn');add(.86,'cylClose')}
 else if(rl==='break'){add(.14,'breakOpen','hulls');add(.42,'shellIn');add(.56,'shellIn');add(.86,'breakClose')}
 else if(rl==='bolt'){add(.08,'boltUp');add(.16,'boltBack');add(.3,'magOut');add(.62,'magIn');add(.8,'boltFwd');add(.88,'boltUp')}
 else if(rl==='belt'){add(.1,'lid');add(.26,'magOut');add(.58,'magIn');add(.78,'lid');add(.9,'boltBack')}
 else if(rl==='rocket'){add(.55,'magIn');add(.8,'boltFwd')}
 else if(rl==='gl'){add(.14,'cylOpen');add(.45,'shellIn');add(.6,'shellIn');add(.86,'cylClose')}
 else if(rl==='xbow'){add(.45,'boltBack');add(.75,'magIn')}
 else{add(.15,'magOut');add(.62,'magIn');if(empty){add(.8,vmInfo.pistol?'slideRel':'boltBack');if(!vmInfo.pistol)add(.88,'boltFwd')}}
 return c}
// ================= v58b DOORS: host-authoritative swinging doors (players interact, bots walk through) =================
function doorsL(){return cur&&cur.doorsL||[]}
function doorReset(m){for(const d of(m&&m.doorsL||[])){d.o=0;d.a=0;d.col.y0=d.oy0;d.col.y1=d.oy1;if(d.piv)for(const[p]of d.piv)p.rotation.y=0}}
function doorSet(i,o,fx){const d=doorsL()[i];if(!d||d.o===(o?1:0))return;d.o=o?1:0;if(d.o){d.col.y0=-60;d.col.y1=-59}else{d.col.y0=d.oy0;d.col.y1=d.oy1}
 if(fx){const p=new THREE.Vector3(d.x,d.y+1,d.z);const dd=camera.position.distanceTo(p);if(dd<48)SFX.door&&SFX.door(d.o,p,Math.max(.05,1-dd/48))}}
function updDoors(dt){for(const d of doorsL()){if(!d.piv)continue;const tg=d.o?1.75:0;if(Math.abs(d.a-tg)<.002)continue;const st=dt*(d.o?4.4:3.6);d.a=d.a<tg?Math.min(tg,d.a+st):Math.max(tg,d.a-st);for(const[p,dir]of d.piv)p.rotation.y=dir*d.outL*d.a}}
function doorBlocked(D){for(const q of plist()){if(!q.alive||q.elim)continue;const dx=Math.abs(q.p[0]-D.x),dz=Math.abs(q.p[2]-D.z);const a=D.ax==='x'?dx:dz,b=D.ax==='x'?dz:dx;if(a<D.w/2+.25&&b<.8&&Math.abs(q.p[1]-D.y)<2)return true}return false}
let botDoorT=0;function botDoors(dt){botDoorT-=dt;if(botDoorT>0)return;botDoorT=.2;const L=cur&&cur.doorsL;if(!L||!L.length||!isHost)return;for(const p of plist()){if(!p.bot||!p.alive||p.elim||!p.p||p.air)continue;for(const D of L){if(D.o)continue;if(Math.abs(p.p[0]-D.x)>2.6||Math.abs(p.p[2]-D.z)>2.6||Math.abs(p.p[1]-D.y)>2.2)continue;if(Math.hypot(p.p[0]-D.x,p.p[2]-D.z)<2.4){bcast({t:'dor',i:D.id,o:1,w:p.id});break}}}}
let doorNear=null,doorNearK='';
function doorScan(){let best=null,bd=2.5;if(inGame&&me.alive&&!paused&&!me.air&&!C.hub&&(C.phase==='play'||C.phase==='starting')){const fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw);for(const d of doorsL()){const dx=d.x-me.pos.x,dz=d.z-me.pos.z,dd=Math.hypot(dx,dz);if(dd>bd||Math.abs(me.pos.y-d.y)>2.2)continue;if(dd>1.1&&(dx*fx+dz*fz)/dd<.25)continue;bd=dd;best=d}}
 doorNear=best;const k=best?best.id+'|'+best.o:'';if(k!==doorNearK){doorNearK=k;const b=$('doorBtn');if(b){b.classList.toggle('hidden',!best);if(best)b.innerHTML='🚪 '+(best.o?'CLOSE':'OPEN')+' DOOR'+(isTouch?'':'<kbd>E</kbd>')}}}
{const b=document.getElementById('doorBtn');if(b)b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();doorAct()})}
function doorAct(){if(!doorNear)return;send({t:'dr',i:doorNear.id})}
function lethalK(){const k=me.load[3];return NLK.includes(k)||k==='medkit'?'grenade':k}
function throwUtil(k){throwT=.55;SFX.pin&&SFX.pin();startThrow(k,()=>{if(!me.alive)return;const f=fwd();const p=camera.position.clone().addScaledVector(f,.6);const v=f.clone().multiplyScalar(k==='molotov'?15:17);v.y+=4;v.add(_v.copy(me.vel).multiplyScalar(.5));
 spawnNade(me.id,k,p,v);send({t:'nade',k,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});SFX.throw();window.__throws=(window.__throws||0)+1})}
function useUtil(){if(C.hub||!me.alive||me.frozen||me.utilN<=0)return;const k=lethalK();me.utilN--;buildSlots();throwUtil(k)}
// v58b non-lethal slot: smoke, flash, decoy, med kit (non-BR) / smoke, flash, decoy + heals and shields (Royale). Separate from lethal grenades/molotovs.
function nlList(){const o=[];if(BC){const n=BC.inv.n;if(n&&n[1]>0)o.push({k:WIDS[n[0]],n:n[1]});for(let i=0;i<4;i++)if(BC.inv.c[i]>0)o.push({k:'c'+i,c:i,n:BC.inv.c[i]})}
 else for(const k of['smoke','flash','decoy','medkit'])if((me.nl[k]|0)>0)o.push({k,n:me.nl[k]});return o}
function nlSel(){const l=nlList();if(!l.length)return null;return l.find(e=>e.k===me.nlSel)||l[0]}
function nlCycle(){const l=nlList();if(l.length<2){buildSlots();return}const i=l.findIndex(e=>e.k===(nlSel()||{}).k);me.nlSel=l[(i+1)%l.length].k;SFX.swap&&SFX.swap();buildSlots()}
function nlUse(){if(C.hub||!me.alive||me.frozen||me.down||me.air)return;const e=nlSel();if(!e)return;
 if(e.c!=null){brUse(e.c);return}
 if(e.k==='medkit'){if(me.hp>=100){center('Health is full',700);return}me.nl.medkit--;send({t:'heal'});SFX.heal();center('+50 HP',700);buildSlots();return}
 if(BC){const n=BC.inv.n;if(!n||n[1]<=0)return;n[1]--;if(n[1]<=0)BC.inv.n=null}else me.nl[e.k]--;
 buildSlots();throwUtil(e.k)}
function nlIcon(e){return e.c!=null?`<b class="nlI">${CONI[e.c]}</b>`:e.k==='medkit'?`<b class="nlI">➕</b>`:`<img src="${ICON[e.k]||''}" alt="">`}
let throwT=0;
function fwd(){return new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion)}
function nearAim(cosr){const o=camera.position,d=fwd();for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=_v2.copy(q.rp);c.y+=1.25;const to=c.sub(o);const l=to.length();if(l>140)continue;to.divideScalar(l);
  if(1-to.dot(d)<cosr*cosr/2&&rayWorld(o,to,l)>=l-.5&&!smokeBlock(o,to,l))return true}return false}
// gentle aim magnetism while the player is actively looking (touch only): pulls toward the nearest visible enemy's chest within ~5°
function aimPull(dt){const o=camera.position,d=fwd();let best=null,bd=.09;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=_v2.copy(q.rp);c.y+=1.2;const to=c.sub(o);const l=to.length();if(l>60)continue;to.divideScalar(l);const a=Math.acos(Math.min(1,to.dot(d)));if(a<bd&&rayWorld(o,to,l)>=l-.5){bd=a;best=to.clone()}}
 if(!best)return;const ty=Math.atan2(-best.x,-best.z),tp=Math.asin(best.y);let dy=ty-me.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const k=Math.min(1,dt*3.2);me.yaw+=dy*k;me.pitch+=(tp-me.pitch)*k*.6}
function aimTarget(maxD){const o=camera.position,d=fwd();const wt=rayWorld(o,d,maxD);let best=null,bt=wt;
 for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&69);if(r.t<bt){bt=r.t;best=q}}if(best&&smokeBlock(o,d,bt))return null;return best}
let recoilP=0,recoilY=0,kick=0,meleeT=0,bob=0,stTimer=0,swayX=0,swayY=0,lastYaw=0,lastPitch=0;
function fire(){if(me.down)return;const id=me.load[me.cur],w=W[id];me.cool=w.rate*curRarFr();me.lastShot=performance.now();me.shots++;
 const o=camera.position.clone();
 if(w.melee){if(w.saw){SFX.saw();meleeT=Math.max(meleeT,.35)}else{SFX.melee();meleeT=1}const d=fwd();let best=null,bd=w.melee+.4,part='torso';for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;
   const c=q.rp.clone();c.y+=1.2;const to=c.clone().sub(o);const dist=to.length();if(dist>w.melee+.4)continue;if(to.normalize().dot(d)<.78)continue;if(!losClear(o,c))continue;
   const r=rayPlayer(o,d,q.rp,q.flags&69);if(dist<bd){bd=dist;best=q;part=r.part==='head'?'head':'torso'}}
  if(best){const head=part==='head';const dmg=head?w.head:w.body;if(w.bonk)SFX.bonk();if(w.saw)fx.spark(best.rp.clone().setY(best.rp.y+1.1),4,0xb01818,2,.25);SFX.mHit();send({t:'hit',id:best.id,dmg,head,w:id});showHit(best.rp.clone().setY(best.rp.y+1.5),dmg,head);fx.spark(best.rp.clone().setY(best.rp.y+1.2),6,0xff6a4d,3,.2)}return}
 if(w.proj){me.ammo[me.cur]--;SFX.gun(id,1,0);SFX.whoosh&&SFX.whoosh();kickImp(1.4,w);recoilP+=w.rc[0];muzzle.visible=true;muzzleT=.08;flashOn(1.4);if(vmInfo.cyc==='gl'){VA.cycD=VA.cyc=.35;VA.glFrom=VA.glRot}const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket&&me.ammo[me.cur]<=0)Gr.rocket.visible=false;for(let i=0;i<4;i++)fx.sprite({p:camera.position.clone().addScaledVector(fwd(),-.2).add(_v2.set((Math.random()-.5)*.6,-.1,(Math.random()-.5)*.6)),s0:.3,s1:1.4,life:.8,op:.4,color:0xdddddd,rise:.4});
  const f=fwd();const p=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());p.lerp(camera.position,.5).addScaledVector(f,.4);const v=f.clone().multiplyScalar(w.proj==='rpg'?44:30);if(w.proj==='gl')v.y+=2.5;
  spawnNade(me.id,id,p,v);send({t:'nade',k:id,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});return}
 me.ammo[me.cur]--;SFX.gun(id,1,0);if(me.ammo[me.cur]===0&&w.cls!=='fun'&&!w.melee)setTimeout(SFX.ping,60);heat=Math.min(12,heat+1);heatOff=0;kickImp(1,w);muzzle.visible=true;muzzleT=.045;muzzle.rotation.z=Math.random()*6;muzzle.scale.setScalar(.8+Math.random()*.5+(w.pellets?.45:0)+(vmInfo.pistol?-.2:0));muzzleVariant(w);if(SUPP[id]){muzzle.scale.multiplyScalar(.22);flashOn(.15)}else flashOn(w.pellets?1.3:(w.cls==='sniper'?1.5:vmInfo.pistol?.8:1));smokeWisp();afterShot(w);
 // recoil pattern: climbs vertically, sways side to side
 const ads=me.zoomT>.5;recoilP+=w.rc[0]*(ads?.65:1);recoilY+=Math.sin(me.shots*.9)*w.rc[1]*(ads?.6:1);
 if(!vmInfo.noShell&&!vmInfo.cyc)ejectShell();
 const hits={};const n=w.pellets||1;let spread=w.spread*(BC&&S2T[me.cur]!=null&&BC.inv.g[S2T[me.cur]]?RAR[BC.inv.g[S2T[me.cur]][1]].sp:1);if(w.cls==='sniper'){spread=me.zoomT>.85?(Math.hypot(me.vel.x,me.vel.z)>3?.012:0):.075+.03*(1-me.zoomT)}else if(w.cls==='marksman')spread*=me.zoomT>.8?.15:2.2;else spread*=ads?.45:1;if(!me.ground)spread*=1.5;else if(Math.hypot(me.vel.x,me.vel.z)>6)spread*=1.25;
 const mz=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());
 for(let i=0;i<n;i++){const d=fwd();d.x+=(Math.random()-.5)*2*spread;d.y+=(Math.random()-.5)*2*spread;d.z+=(Math.random()-.5)*2*spread;d.normalize();
  const wt=rayWorld(o,d,400);const wn=hitN.clone();const ws=hitS;let bt=wt,bq=null,bp=null;
  for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&69);if(r.t<bt){bt=r.t;bq=q;bp=r.part}}
  if(bq&&smokeBlock(o,d,bt)){bq=null;bt=wt}
  let wtt=wt;if(w.maxR&&bt>w.maxR){bq=null;bt=Math.min(bt,w.maxR);if(wtt>w.maxR)wtt=401}
  const end=o.clone().addScaledVector(d,Math.min(bt,400));if(w.paint&&(bq||wtt<400))paintSplat(end,wn,me.id);if(i<3){addTracer(mz,end,w.tracer);if(i===0)funFX(id,mz,end);if(i===0)send({t:'fx',a:mz.toArray().map(v=>+v.toFixed(2)),b:end.toArray().map(v=>+v.toFixed(2)),w:id})}
  if(bq){let dmg=(bp==='head'?w.head:w.body)*falloff(w,bt)*(bp==='legs'?LIMB:1);const h=hits[bq.id]||(hits[bq.id]={dmg:0,head:false,pos:end});h.dmg+=dmg;if(bp==='head')h.head=true;impact(end,wn,true)}
  else if(wtt<400)impact(end,wn,false,ws)}
 for(const k in hits){const h=hits[k];const dmg=Math.max(1,Math.round(h.dmg));send({t:'hit',id:k,dmg,head:h.head,w:id});showHit(h.pos,dmg,h.head)}
 if(me.ammo[me.cur]<=0)setTimeout(reload,180)}
let muzzleT=0;
// sticky ladders: attach on contact, climb with forward input regardless of look, hold position, mount onto the top smoothly
function freeAt(x,y,z){const q={x,y,z};for(const c of CN(x,z,1,_cbA))if(overlaps(q,c,PH-.05))return false;return true}
function ladderMe(dt,mx,mz){if(me.mountT>0)return;if(me.lad){const A=me.lad;if(Math.hypot(me.pos.x-(A.x0+A.x1)/2,me.pos.z-(A.z0+A.z1)/2)>2||me.pos.y<A.y0-1||me.pos.y>A.y1+1)me.lad=null}const ok=me.alive&&!me.frozen&&!me.down;let L=ok?inVol(ladders,me.pos,me.lad?.3:0):null;if(me.lad&&ok&&!L){const A=me.lad;if(me.pos.y>A.y0-.2&&me.pos.y<A.y1+.6&&inVol([A],{x:me.pos.x,y:A.y0+.5,z:me.pos.z},.45))L=A}
 const up=mz<-.25||inp.ladUp,dn=mz>.25;
 if(L&&!me.lad){const atTop=me.pos.y>L.y1-.7;if(atTop?(dn&&me.ground):(up||!me.ground))me.lad=L;else{me.onLadder=false;me.ladTop=null;return}}
 if(!L||L!==me.lad){if(me.lad&&!L){me.lad=null}me.onLadder=false;me.ladTop=null;if(!L)return;me.lad=L}
 const n=L.n,cx=(L.x0+L.x1)/2,cz=(L.z0+L.z1)/2,tx=-n[1],tz=n[0];const top=L.y1-.25;me.onLadder=true;me.ladTop=up?L.y1:null;
 // lateral (along wall) and depth from ladder centre line
 let lat=(me.pos.x-cx)*tx+(me.pos.z-cz)*tz,dep=(me.pos.x-cx)*n[0]+(me.pos.z-cz)*n[1];
 if(Math.abs(mx)>.75&&Math.abs(lat)>.3&&Math.sign(mx*((Math.cos(me.yaw))*tx+(-Math.sin(me.yaw))*tz))===Math.sign(lat)){me.lad=null;me.onLadder=false;me.ladTop=null;return}// deliberate side step off
 if(inp.jump&&!me.ground){const fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw);if(fx*n[0]+fz*n[1]>.5){me.lad=null;me.vel.set(n[0]*4,5,n[1]*4);me.onLadder=false;me.ladTop=null;return}}
 lat=Math.max(-.32,Math.min(.32,lat));dep=Math.max(-.03,Math.min(.1,dep));
 me.pos.x=cx+tx*lat+n[0]*dep;me.pos.z=cz+tz*lat+n[1]*dep;
 const ls=Math.abs(mx)>.3?mx*1.2:0;const sx=Math.cos(me.yaw),sz=-Math.sin(me.yaw);const along=(sx*tx+sz*tz)>=0?1:-1;me.vel.x=tx*ls*along;me.vel.z=tz*ls*along;
 if(up)me.vel.y=4.2;else if(dn){me.vel.y=-3.4;if(me.ground&&me.pos.y<L.y0+.4){me.lad=null}}else me.vel.y=24*dt;
 // reached the top: mount onto the surface behind the ladder
 if(up&&me.pos.y>=top-.55){for(const d of[.75,1.0,.55,1.3,-.4,-.25]){const bx=me.pos.x-n[0]*(.4+d),bz=me.pos.z-n[1]*(.4+d);let gy=-1;for(const c of CN(bx,bz,.6,_cbC))if(bx>c.x0&&bx<c.x1&&bz>c.z0&&bz<c.z1&&c.y1<=top+.8&&c.y1>top-1.2&&c.y1>gy)gy=c.y1;if(gy<0)continue;if(!freeAt(bx,gy+.01,bz))continue;
   me.mountA=[me.pos.x,me.pos.y,me.pos.z];me.mountB=[bx,gy+.01,bz];me.mountD=me.mountT=.28;me.lad=null;me.onLadder=false;me.ladTop=null;inp.ladUp=false;return}}
}
function updateMe(dt){const id=me.load[me.cur],w=W[id];if(BC&&me.air){brAirMe(dt);return}
 if(isTouch&&!(RC&&RC.modal))applyTouchLook(dt);
 let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 if(RC&&RC.modal){mx=mz=0;inp.fire=false;inp.jump=false;inp.slide=false}
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
 const sprint=(keys.ShiftLeft||keys.ShiftRight||inp.sprint)&&mz<-.3&&me.zoomT<.3&&!paused;
 if(!me.alive||me.frozen){mx=mz=0}
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 const myC=PCL[PROG.pc]||{};const speed=me.down?1.3:(sprint?8.6:me.crouch?3.2:5.8)*(myC.spd||1)*(PETS?PETS.speedMul():1)*(me.zoomT>.5?.7:1)*(w.slowSelf||1)*(me.slowT>performance.now()?me.slowF:1);const hs=Math.hypot(me.vel.x,me.vel.z);me.slideCd-=dt;
 if(inp.crouchP){inp.crouchP=false;if(me.alive&&!me.frozen&&!me.down){if(hs>7&&me.ground&&me.slideT<=0&&me.slideCd<=0)inp.slide=true;else if(me.slideT<=0){me.crouch=!me.crouch;SFX.crouch&&SFX.crouch();updCamBtn()}}}
 if(sprint&&me.crouch)me.crouch=false;
 if(inp.slide&&me.alive&&!me.frozen&&me.ground&&me.slideT<=0&&me.slideCd<=0&&hs>3.5){const ns=Math.min(SLIDE.cap,Math.max(hs,6.5)*SLIDE.boost);me.vel.x=me.vel.x/hs*ns;me.vel.z=me.vel.z/hs*ns;me.slideT=SLIDE.max;me.slideAge=0;window.__slides=(window.__slides||0)+1;me.slideCd=9;SFX.slide()}
 inp.slide=false;
 // v41 slide: ~+50% burst; a tap lasts SLIDE.tap (0.7 s); holding C / the Slide button stretches it to SLIDE.max (1.6 s) with gradual decay; releasing after the tap window ends it. Cooldown starts when the slide ends.
 if(me.slideT>0){me.slideT-=dt;me.slideAge+=dt;const a=me.slideAge;const k=Math.max(0,1-(a<SLIDE.tap?1.25:.8)*dt);me.vel.x*=k;me.vel.z*=k;me.vel.x+=wx*dt*6;me.vel.z+=wz*dt*6;
  if(Math.hypot(me.vel.x,me.vel.z)<4||(a>=SLIDE.tap&&!inp.slideHold)||me.lad||me.mountT>0||(!me.ground&&a>=SLIDE.tap)||me.down)me.slideT=0;
  if(me.slideT<=0){me.slideT=0;me.slideCd=(myC.slideCd||1)*(.3+.5*Math.max(0,a-SLIDE.tap)/(SLIDE.max-SLIDE.tap));window.__slideLast=+a.toFixed(2)}}
 else if(me.slideCd>2)me.slideCd=(myC.slideCd||1)*.7;
 else if(me.ground){const a=Math.min(1,dt*13);me.vel.x+=(wx*speed-me.vel.x)*a;me.vel.z+=(wz*speed-me.vel.z)*a}
 else{me.vel.x+=wx*speed*dt*2.5;me.vel.z+=wz*speed*dt*2.5;const n=Math.hypot(me.vel.x,me.vel.z);const cap=Math.max(hs,speed);if(n>cap){me.vel.x*=cap/n;me.vel.z*=cap/n}}
 if(me.down){inp.jump=false;inp.slide=false}if(inp.jump&&me.ground&&me.alive&&!me.frozen){me.crouch=false;me.vel.y=(myC.jump||8.3);if(me.slideT>0){me.vel.x*=1.08;me.vel.z*=1.08;me.slideT=0}SFX.jump()}inp.jump=false;
 ladderMe(dt,mx,mz);if(me.mountT>0){me.mountT-=dt;const k=1-Math.max(0,me.mountT)/me.mountD;const a=me.mountA,b=me.mountB;me.pos.set(a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*Math.min(1,k*2),a[2]+(b[2]-a[2])*k);me.vel.set(0,0,0);if(me.mountT<=0){me.pos.set(b[0],b[1],b[2]);me.ground=true;me.lastG=[b[0],b[1],b[2]]}}
 if(me.alive&&!(me.mountT>0)){physStep(me,dt);if(me.landed){SFX.land();landDip=.08}}
 if(me.alive&&me.pos.y<-3){me.alive=false;send({t:'fall'})}
 if(me.ground&&hs>2&&me.slideT<=0){me.stepT-=dt*hs;if(me.stepT<=0){me.stepT=sprint?3.3:2.9;if(!myC.quiet||(me.qStep=!me.qStep))SFX.step()}}
 bob+=dt*hs*(me.ground&&me.slideT<=0?1.55:0);landDip=Math.max(0,landDip-dt*.4);
 me.camH+=((me.slideT>0?.95:me.crouch?1.2:1.62)-me.camH)*Math.min(1,dt*12);
 // recoil recovery
 const since=(performance.now()-me.lastShot)/1000;const rec=since>.08?Math.min(1,dt*7):Math.min(1,dt*1.2);recoilP-=recoilP*rec;recoilY-=recoilY*rec;if(since>.25)me.shots=0;
 shake=Math.max(0,shake-dt*2.6);const sh=shake*shake*.035;
 if(me.alive){camera.position.set(me.pos.x,me.pos.y+(me.down?.55:me.camH)+Math.sin(bob)*.035-landDip,me.pos.z);camera.rotation.set(me.pitch+recoilP+(Math.random()-.5)*sh,me.yaw+recoilY+(Math.random()-.5)*sh,(me.slideT>0?.07:0)+Math.sin(bob*.5)*.004+(Math.random()-.5)*sh)}
 else deathCam(dt);
 // zoom / ADS / auto-scope
 // zoom / ADS (toggle button, every gun class has its own FOV)
 const zf=adsFov(w);if(!zf&&me.zoomOn){me.zoomOn=false;updZoomBtn()}if(!me.alive&&me.zoomOn){me.zoomOn=false;updZoomBtn()}
 const wantZoom=!!me.zoomOn&&!!zf&&me.alive&&me.reloadT<=0&&me.switchT<=0;const isSn=w.cls==='sniper';
 me.zoomT+=((wantZoom?1:0)-me.zoomT)*Math.min(1,dt*(wantZoom?(isSn?9:13):16));if(me.zoomT<.002)me.zoomT=0;
 const tf=75+((zf||75)-75)*me.zoomT;if(Math.abs(camera.fov-tf)>.02){camera.fov=tf;camera.updateProjectionMatrix()}
 const scopeOn=isSn&&me.zoomT>.85;$('scope').classList.toggle('hidden',!scopeOn);$('cross').style.opacity=scopeOn?0:me.zoomT>.6?(vmCur&&vmCur.userData.optic&&!TPV.on?0:.55):1;$('cross').classList.toggle('ads',me.zoomT>.6&&!scopeOn);
 // scope sway (breathing figure-8), smaller for marksman optics; applied to the camera so the shot follows the reticle
 if(me.zoomT>.6&&(isSn||w.cls==='marksman')){swayT+=dt;const mv=Math.min(1,Math.hypot(me.vel.x,me.vel.z)/5);const a=(isSn?.0042:.002)*(1+mv*2.5)*Math.min(1,me.zoomT);
  camera.rotation.y+=Math.sin(swayT*1.05)*a;camera.rotation.x+=Math.sin(swayT*2.1)*a*.55;camera.updateMatrixWorld()}
 if(TPV.on&&me.alive)tpCam(dt,w,scopeOn);
 // weapon timers / reload stages
 me.cool-=dt;if(me.switchT>0)me.switchT-=dt;throwT=Math.max(0,throwT-dt);updThrow(dt);updSpoons(dt);meleeT=Math.max(0,meleeT-dt*3);muzzleT-=dt;if(muzzleT<=0)muzzle.visible=false;
 if(me.reloadT>0){const k=1-me.reloadT/reloadOf(id);const cs=VA.cues||[];while(VA.cue<cs.length&&k>=cs[VA.cue][0]){const[,snd,x]=cs[VA.cue++];SFX[snd]&&SFX[snd]();
   if(x==='ammo')me.ammo[me.cur]=Math.min(magOf(id),me.ammo[me.cur]+1);else if(x==='cylEject')for(let i=0;i<6;i++)setTimeout(()=>{if(vmCur)fx.shell(vmToWorld([0,.02,-.02],new THREE.Vector3()),_v.set((Math.random()-.5)*.6,-1.5,(Math.random()-.5)*.6).add(me.vel),'pistol')},i*25);
   else if(x==='hulls')for(let i=0;i<2;i++)fx.shell(vmToWorld([i?.012:-.012,.03,.02],new THREE.Vector3()),_v.set((Math.random()-.5),2.5,1.2).applyQuaternion(camera.quaternion).add(me.vel),'shot')}
  me.reloadT-=dt;if(me.reloadT<=0){me.ammo[me.cur]=BC?brReloadDone(id):magOf(id);if(['ar','smg','lmg'].includes(w.cls))SFX.charge();const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket)Gr.rocket.visible=true}}
 // action cycling (bolt / pump / lever / launcher cylinder) runs between shots
 if(VA.cyc>0){const p0=1-VA.cyc/VA.cycD;VA.cyc-=dt;const p1=1-Math.max(0,VA.cyc)/VA.cycD;const c=vmInfo.cyc;
  if(c==='bolt'){if(p0<.02&&p1>=.02)SFX.boltUp();if(p0<.2&&p1>=.2)SFX.boltBack();if(p0<.6&&p1>=.6)SFX.boltFwd()}
  else if(c==='pump'){if(p0<.05&&p1>=.05)SFX.pump()}else if(c==='lever'){if(p0<.05&&p1>=.05)SFX.lever()}
  if(!VA.ejected&&p1>=(c==='bolt'?.38:.35)&&c!=='gl'){VA.ejected=true;if(!vmInfo.noShell)ejectShell()}}
 VA.slide=Math.max(0,VA.slide-dt*14);if(vmInfo.spin&&vmCur){const Gc=vmCur.userData.G.cyl;VA.spin=Math.max(0,(VA.spin||0)-dt*1.2);if(performance.now()-me.lastShot<150)VA.spin=1;VA.spinA=((VA.spinA||0)+dt*VA.spin*40)%(Math.PI*2)}if(VA.inspect>0)VA.inspect-=dt;
 // auto-fire when crosshair is on an enemy (primary mobile control)
 const range=w.melee?w.melee:(w.pellets?32:250);const tgt=(me.alive&&!me.frozen)?aimTarget(range):null;$('cross').classList.toggle('on',!!tgt);
 let trigger=(tgt||inp.fire)&&!paused&&me.alive&&!me.frozen&&C.phase==='play'&&!(RC&&RC.modal);
 if(me.burst>0){me.burstT-=dt;if(me.burstT<=0&&me.ammo[me.cur]>0&&me.reloadT<=0){me.burst--;me.burstT=.06;fire();me.cool=w.rate}}
 else if(trigger&&!C.hub&&me.cool<=0&&me.switchT<=0&&me.reloadT<=0&&throwT<=0&&(w.melee||me.ammo[me.cur]>0)){if(w.burst){me.burst=w.burst-1;me.burstT=.06}fire()}
 if(!w.melee&&me.ammo[me.cur]<=0&&me.reloadT<=0&&me.alive){if(trigger)SFX.dry();reload()}
 updViewModel(dt,w,hs,sprint);
 stTimer+=dt;if(stTimer>=.05&&C.phase!=='lobby'&&me.alive){stTimer=0;send({t:'st',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(3),+me.pitch.toFixed(2),WIDX[me.load[me.cur]]|0,(me.slideT>0?1:0)|(me.ground?0:2)|(me.crouch&&me.slideT<=0?64:0)]})}
 updAmmo();$('timer').textContent=C.phase==='play'&&!BC?(Math.floor(C.roundT/60)+':'+String(C.roundT%60).padStart(2,'0')):''}
let landDip=0,swayT=0;
// ---- viewmodel animation helpers ----
const RS={p:0,v:0,r:0,rv:0,y:0,yv:0,x:0,xv:0};
function kickImp(s,w){const h=w.cls==='sniper'?1.7:w.pellets?1.55:w.proj?1.4:vmInfo.pistol?1.15:w.cls==='lmg'?.75:w.cls==='smg'?.55:.7;const ad=me.zoomT>.5?.55:1;
 RS.v+=s*h*1.3*ad;RS.rv+=s*h*9*ad;RS.yv+=(Math.random()-.5)*s*h*4*ad;RS.xv+=(Math.random()-.5)*s*h*.4*ad;VA.slide=1}
function springStep(dt){const k=240,c=2*Math.sqrt(k)*.72;const n=dt>.02?3:1,h=dt/n;for(let i=0;i<n;i++)for(const[a,b]of[['p','v'],['r','rv'],['y','yv'],['x','xv']]){RS[b]+=(-k*RS[a]-c*RS[b])*h;RS[a]+=RS[b]*h}}
const _mw=new THREE.Vector3();
function flashOn(s){vmFlash.intensity=4*s;muzzle.updateMatrixWorld(true);muzzle.getWorldPosition(_mw);vmFlash.position.copy(_mw);
 if(GQ.level==='high'&&vmCur){vmToWorld(vmInfo.muzzle||[0,0,-.5],worldFlash.position);worldFlash.intensity=7*s}}
function muzzleVariant(w){const big=w.pellets||w.cls==='sniper'||w.cls==='lmg',small=vmInfo.pistol||w.cls==='smg';for(const m of muzzle.children){const k=m.userData.k;
  if(k==='core')m.scale.setScalar((big?1.35:small?.8:1)*(.85+Math.random()*.3));else if(k==='petal'){m.scale.set(big?1.4:1,(big?1.5:small?.7:1)*(.7+Math.random()*.6),1);m.rotation.y=Math.random()*Math.PI}
  else{m.visible=!small||Math.random()<.5;m.scale.setScalar((big?1.3:1)*(.6+Math.random()*.6))}}}
let wispT=0;function smokeWisp(){const t=performance.now();if(t-wispT<90)return;wispT=t;const p=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());fx.sprite({p,s0:.04,s1:.35,life:.9,op:.22,color:0xd8d8d8,rise:.35})}
function afterShot(w){const c=vmInfo.cyc;if(c==='bolt'||c==='pump'||c==='lever'){VA.cycD=VA.cyc=Math.max(.25,Math.min(w.rate*.85,.8));VA.ejected=false}}
function ejectShell(){if(!vmCur)return;const ep=vmToWorld(vmInfo.eject||[.03,.04,0],new THREE.Vector3());const q=camera.quaternion;const t=vmInfo.shellT||'rifle';
 const d=vmInfo.ejDown?_v2.set((Math.random()-.5)*.3,-1.2,.2):vmInfo.ejUp?_v2.set(.3,2.2,.3):_v2.set(2+Math.random(),1.4+Math.random(),.4);d.applyQuaternion(q).add(me.vel);fx.shell(ep,d,t);SFX.shell(t)}
const ease=x=>{x=x<0?0:x>1?1:x;return x*x*(3-2*x)},win=(k,a,b)=>ease((k-a)/(b-a)),bump=(k,a,b,c,d)=>win(k,a,b)*(1-win(k,c,d));
const _lh=new THREE.Vector3(),_tg=new THREE.Vector3();
function updViewModel(dt,w,hs,sprint){if(!vmCur)return;const I=vmInfo,Gp=vmCur.userData.G;
 let dyw=me.yaw-lastYaw;dyw=Math.atan2(Math.sin(dyw),Math.cos(dyw));swayX+=(-dyw*1.2-swayX)*Math.min(1,dt*9);swayY+=((me.pitch-lastPitch)*1.2-swayY)*Math.min(1,dt*9);lastYaw=me.yaw;lastPitch=me.pitch;
 swayX=Math.max(-.05,Math.min(.05,swayX));swayY=Math.max(-.05,Math.min(.05,swayY));springStep(dt);
 vmFlash.intensity*=Math.max(0,1-dt*30);worldFlash.intensity*=Math.max(0,1-dt*30);
 const z=me.zoomT,ads=w.cls==='sniper'?Math.min(z*1.15,1)*.6:z;const rk=me.reloadT>0?Math.min(1,1-me.reloadT/reloadOf(w.id)):-1;
 const bx=Math.sin(bob*.5)*.011*(1-ads*.85),by=Math.abs(Math.cos(bob*.5))*.011*(1-ads*.85);
 const sw=me.switchT>0?me.switchT/.32:0,dr=ease(sw);const spr=sprint&&me.ground&&rk<0?1:0;VA.spr=(VA.spr||0)+(spr-(VA.spr||0))*Math.min(1,dt*10);const sp=VA.spr;
 const right=_v.set(Math.cos(me.yaw),0,-Math.sin(me.yaw));const strafe=me.vel.dot(right);VA.roll=(VA.roll||0)+(-strafe*.012-(VA.roll||0))*Math.min(1,dt*8);
 const hold=I.hold||'rifle';const hip=I.pistol?[.1,-.095,-.31]:hold==='launcher'?[.12,-.09,-.25]:I.melee||I.util?[.14,-.14,-.34]:[.1,-.1,-.27];
 const sg=I.sight||[0,.06,.15];const adsP=[-sg[0]*.5,-sg[1]*.5,-(I.pistol?.09:vmCur.userData.optic?.07:.06)-sg[2]*.5];
 // reload pose (whole-gun motion) + parts
 let rx=0,ry=0,rz=0,ly=0;for(const k in Gp){const g=Gp[k];g.position.copy(g.userData.base);g.rotation.set(0,0,0)}
 if(Gp.chain&&I.chainSp){const run=inp.fire||performance.now()-me.lastShot<200;VA.chainA=((VA.chainA||0)+dt*(run?3:.35))%I.chainSp;Gp.chain.position.z-=VA.chainA}
 const lhG=Gp.lh,lhB=I.lh?_lh.set(...I.lh):_lh.set(0,-.04,.04);let lhT=null;
 const magMove=(k,a0,a1,b0,b1,dist)=>{// mag out a0..a1, new mag in b0..b1 (+seat)
  if(!Gp.mag)return 0;const dirY=I.magTop?1:-1,dz=I.magTop?.02:I.magInGrip?.03:.08;let d;if(k<(a1+b0)/2)d=win(k,a0,a1);else d=1-win(k,b0,b1);
  Gp.mag.position.y+=dirY*dist*d;Gp.mag.position.z+=dz*d;Gp.mag.rotation.x=(I.magTop?0:-.25)*d*(I.magInGrip?0:1);Gp.mag.visible=d<.97;return d};
 if(rk>=0){const k=rk,rl=I.rl||'mag';const env=bump(k,0,.14,.86,1);
  if(rl==='mag'){rz=.45*env;rx=.12*env;ly=-.02*env;const d=magMove(k,.12,.3,.4,.62,.24);
   if(Gp.mag){const c=Gp.mag.userData.c;const g=bump(k,.04,.14,.66,.8);_tg.copy(c).sub(lhB);_tg.y+=(I.magTop?1:-1)*.24*(k<.36?win(k,.12,.3):1-win(k,.4,.62))-.02;lhT=_tg.multiplyScalar(1).clone();lhT.multiplyScalar(g)}
   if(VA.emptyRl){const ch=bump(k,.76,.8,.84,.9);if(Gp.slide&&I.slide)Gp.slide.position.z+=I.slide*(k<.8?1:ch);if(Gp.bolt)Gp.bolt.position.z+=(I.boltBack||.05)*ch;rx+=ch*.06}}
  else if(rl==='shells'){rz=-.35*env;rx=.1*env;const n=VA.shellN||1;const f=Math.max(0,(k-.12)/.76)*n,fr=f%1;const port=I.loadPort||[0,0,-.05];
   if(k>.1&&k<.9){_tg.set(port[0]-lhB.x+.0,port[1]-lhB.y-.03,port[2]-lhB.z);lhT=_tg.clone().multiplyScalar(bump(fr,.05,.35,.6,.95))}
   if(k>.9&&VA.emptyRl){const p=bump(k,.9,.94,.96,1);if(I.cyc==='pump'&&Gp.pump){Gp.pump.position.z+=.075*p;lhT=_tg.set(0,0,.075*p).clone()}if(I.cyc==='lever'&&Gp.lever)Gp.lever.rotation.x=.9*p}}
  else if(rl==='cyl'){const o=bump(k,.06,.16,.84,.92);if(Gp.cyl)Gp.cyl.rotation.z=1.2*o;rz=-.5*env;rx=.55*bump(k,.18,.26,.32,.4)-.15*bump(k,.4,.48,.8,.9);
   _tg.set(-.04-lhB.x,.02-lhB.y,-.01-lhB.z);lhT=_tg.clone().multiplyScalar(bump(k,.42,.5,.72,.8))}
  else if(rl==='break'){const o=bump(k,.06,.16,.82,.9);if(Gp.barrel)Gp.barrel.rotation.x=-.6*o;rx=-.25*o;rz=.2*env;
   if(lhG){lhT=_tg.set(0,.02,.08).clone().multiplyScalar(bump(k,.32,.4,.6,.7))}}
  else if(rl==='bolt'){const up=bump(k,.04,.1,.86,.92),back=bump(k,.1,.18,.76,.84);if(Gp.bolt){Gp.bolt.rotation.z=1.1*up;Gp.bolt.position.z+=(I.boltBack||.08)*back}rz=.3*env;rx=.08*env;magMove(k,.26,.38,.46,.64,.16);
   if(Gp.mag){const c=Gp.mag.userData.c;_tg.copy(c).sub(lhB);_tg.y-=.16*(k<.42?win(k,.26,.38):1-win(k,.46,.64));lhT=_tg.clone().multiplyScalar(bump(k,.18,.26,.64,.74))}}
  else if(rl==='belt'){const o=bump(k,.06,.16,.74,.82);if(Gp.lid)Gp.lid.rotation.x=-1*o;rz=.35*env;rx=.1*env;magMove(k,.22,.36,.44,.62,.25);
   if(Gp.mag){const c=Gp.mag.userData.c;_tg.copy(c).sub(lhB);_tg.y-=.25*(k<.4?win(k,.22,.36):1-win(k,.44,.62));lhT=_tg.clone().multiplyScalar(bump(k,.14,.22,.66,.74))}
   const ch=bump(k,.86,.9,.92,.97);if(Gp.bolt)Gp.bolt.position.z+=.05*ch}
  else if(rl==='rocket'){rx=-.25*env;ly=-.04*env;if(Gp.rocket){Gp.rocket.visible=k>.25;const t=1-win(k,.28,.72);Gp.rocket.position.z+=-.35*t;Gp.rocket.position.y+=-.18*t;lhT=_tg.set(0,-.18*t-.02,-.35*t-.08).clone().multiplyScalar(bump(k,.2,.3,.74,.84))}}
  else if(rl==='gl'){if(Gp.cyl)Gp.cyl.rotation.z=VA.glRot+k*Math.PI*2;rz=-.3*env;rx=.15*env;lhT=_tg.set(.0,-.02,.12).clone().multiplyScalar(bump(k,.1,.2,.8,.9))}
  else{rx=.25*env;rz=.2*env;ly=-.04*env;if(Gp.bolt)Gp.bolt.position.z+=.05*bump(k,.4,.5,.7,.8)}}
 // action cycling between shots
 if(VA.cyc>0&&rk<0){const p=1-VA.cyc/VA.cycD,c=I.cyc;
  if(c==='bolt'&&Gp.bolt){Gp.bolt.rotation.z=1.1*bump(p,0,.14,.82,.96);Gp.bolt.position.z+=(I.boltBack||.08)*bump(p,.14,.34,.56,.8);rz+=.12*bump(p,0,.15,.85,1);rx+=.04*bump(p,0,.15,.85,1)}
  else if(c==='pump'&&Gp.pump){const q=.075*bump(p,0,.35,.45,.85);Gp.pump.position.z+=q;if(lhG)lhT=_tg.set(0,0,q).clone();rx+=.03*q/.075}
  else if(c==='lever'&&Gp.lever){Gp.lever.rotation.x=.9*bump(p,0,.38,.5,.9);rx+=.06*bump(p,0,.38,.5,.9)}
  else if(c==='gl'&&Gp.cyl){Gp.cyl.rotation.z=VA.glFrom+Math.PI/3*ease(p);VA.glRot=Gp.cyl.rotation.z}}
 else if(I.cyc==='gl'&&Gp.cyl&&rk<0)Gp.cyl.rotation.z=VA.glRot;
 if(I.spin&&Gp.cyl)Gp.cyl.rotation.z=VA.spinA||0;
 // semi-auto slide / rifle bolt reciprocation, pistol slide lock when empty
 const lock=I.pistol&&me.ammo[me.cur]<=0&&!(rk>=.8);if(Gp.slide&&I.slide&&rk<0)Gp.slide.position.z+=I.slide*(lock?1:Math.min(1,VA.slide*1.8));
 if(Gp.bolt&&!I.cyc&&rk<0)Gp.bolt.position.z+=(I.boltBack||.05)*Math.min(1,VA.slide*1.8);
 if(lhG){if(lhT)lhG.position.add(lhT)}
 // inspect (F)
 let ix=0,iy=0,iz=0;if(VA.inspect>0&&rk<0){const k=1-VA.inspect/2.6;const a=bump(k,0,.2,.45,.6),b=bump(k,.45,.6,.85,1);iy=.9*a-.4*b;iz=.55*a+.2*b;ix=-.15*a+.35*b}
 // compose
 const A=1-ads,mt=(I.melee||I.util)?1:0;
 const tx=hip[0]*A+adsP[0]*ads+bx+swayX-sp*.05+RS.x*.02,
  ty=hip[1]*A+adsP[1]*ads+by-swayY-sw*.25+ly+(me.ground?0:.015)-landDip*.4-sp*(I.pistol?.06:.02)+RS.p*.004,
  tz=hip[2]*A+adsP[2]*ads+RS.p*.032*(w.pellets?1.4:1)*(1-ads*.4);
 vmRoot.position.set(tx,ty,tz);
 vmRoot.rotation.set(RS.r*.032*(1-ads*.45)+rx-sp*(I.pistol?.5:.28)+meleeT*-.9+throwT*-1.5-dr*1.1+ix,swayX*1.5+A*.05+sp*(I.pistol?.2:.62)+meleeT*.6+RS.y*.01-dr*.3+iy,rz+(me.slideT>0?.25:0)+meleeT*.4+VA.roll*A+sp*.15+iz);
 vmRoot.visible=me.alive&&!me.down&&!TH&&!(w.cls==='sniper'&&me.zoomT>.8)&&!TPV.on;vmCam.fov=54;}
function deathCam(dt){if(BC&&brSpec(dt))return;const q=me.killer&&C.players[me.killer];// spectate teammate in team modes, else look at killer
 const mates=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!isEnemy(p));
 if(C.mode!=='ffa'&&mates.length&&C.phase==='play'){const t=mates[0];const back=_v.set(Math.sin(t.yaw),0,Math.cos(t.yaw)).multiplyScalar(3.2);camera.position.lerp(_v2.copy(t.rp).add(back).setY(t.rp.y+2.2),Math.min(1,dt*6));camera.lookAt(t.rp.x,t.rp.y+1.4,t.rp.z);return}
 camera.position.y+=((me.pos.y+.6)-camera.position.y)*Math.min(1,dt*3);if(q&&q.alive){const m=new THREE.Matrix4().lookAt(camera.position,_v.copy(q.rp).setY(q.rp.y+1.4),new THREE.Vector3(0,1,0));_q.setFromRotationMatrix(m);camera.quaternion.slerp(_q,Math.min(1,dt*3))}}
// animation LOD for remote players: full rate <70 m, every 2nd frame 70-150 m, every 3rd beyond (guns are NEVER culled by distance - v52 did, that made guns vanish at range)
function lodRun(q,dt,d){q.ld=d;q.lacc=(q.lacc||0)+dt;if(!window.__noLod&&d>70&&q.lwait>0&&!q.eo){q.lwait--;return false}q.lwait=window.__noLod?0:d>150?2:d>70?1:0;q.ldt=q.lacc;q.lacc=0;return true}
function updRemotes(dt){const a=Math.min(1,dt*14);for(const id in C.players){const q=C.players[id];if(!q.model)continue;const u=q.model.userData;
 if(!q.alive&&!u.dead){q.model.visible=false;continue}if(u.dead>3){q.model.visible=false;continue}q.model.visible=true;
 if(q.alive){if(q.rp.distanceTo(q.tp)>6)q.rp.copy(q.tp);else q.rp.lerp(q.tp,a);let dy=q.tyaw-q.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));q.yaw+=dy*a;q.pitch+=(q.tpitch-q.pitch)*a}
 const sp=Math.hypot(q.rp.x-q.lp.x,q.rp.z-q.lp.z)/Math.max(dt,.001);q.lp.copy(q.rp);q.spd=(q.spd||0)+(sp-(q.spd||0))*Math.min(1,dt*8);
 if(q.wid!=null)setRemoteGun(q,q.wid);q.model.position.copy(q.rp);{const eo=q.emo&&performance.now()<q.emo.until&&q.spd<1.5&&q.alive?q.emo.id:null;if(q.emo&&!eo)q.emo=null;q.ek=(q.ek||0)+((eo?1:0)-(q.ek||0))*a;q.model.rotation.y=q.yaw+Math.PI*q.ek;q.eo=eo}{const dn=!!(q.flags&4);const cl=!dn&&!!inVol(ladders,q.rp,.15);if(lodRun(q,dt,camera.position.distanceTo(q.rp)))animate(q.model,{emote:q.eo,pose:BC&&!(q.flags&32)?((q.flags&16)?'fall':(q.flags&8)?'glide':null):null,bank:0,shot:q.shotAt!==q.shotSeen,speed:q.spd,air:!!(q.flags&2)&&!cl,slide:!!(q.flags&1)&&!dn,crouch:!!(q.flags&64)&&!dn,pitch:q.pitch,climb:cl,down:dn,slope:dn?downSlope(q):null,dist:camera.position.distanceTo(q.rp)},q.ldt);q.shotSeen=q.shotAt;q.model.rotation.x=0;downMark(q,dn);if(BC)brRemote(q)}}}
// ================= LOOP =================
renderer.autoClear=false;renderer.info.autoReset=false;
let last=performance.now(),acc=0,frames=0,fpsShown=0;const fpsLog=[];
const brHalf=()=>{let h=0;try{h=(H&&H.br&&H.br.half)||(BC&&BC.half)||0}catch(e){}if(h)return h;const d=cur&&cur.def;return d&&d.br?d.size[0]/2:200};function floorAt(p){return 0}
let lastHostTick=performance.now();function hostStep(){const n=performance.now();const dt=Math.min(.1,(n-lastHostTick)/1000);lastHostTick=n;if(isHost)hostTick(dt)}
// keep host simulation alive even when its tab/frame loop is throttled
setInterval(()=>{if(performance.now()-lastHostTick>120)hostStep()},50);
let slowWin=0,cellT=0;function loop(now){requestAnimationFrame(loop);const el=now-last;if(el<15.2)return;last=now;const dt=Math.min(.05,el/1000);tickSkins(now/1000);
 hostStep();if(PETS)PETS.update(dt,now);
 if(inGame){updateMe(dt);tpBody(dt);updRemotes(dt);updTracers(dt);updNades(dt);updUtil(dt);updDoors(dt);doorScan();cellT-=dt;if(cellT<=0){cellT=.15;const cg=cur&&cur.group;if(cg&&cg.userData.cells&&cg.userData.cells.length)updateCells(cg,window.__camOv?window.__camOv.p[0]:camera.position.x,window.__camOv?window.__camOv.p[2]:camera.position.z,(scene.fog?Math.min(scene.fog.far,320):320)+4,window.__lodD||85)}updHub(dt,now);fx.update(dt,floorAt);listen();updHeat(dt);updFireLights(dt);updRings(dt);updAmb(dt,now/1000);updDmg(dt);updMission(dt,now);if(RAIDM(C.mode))raidFrame(dt,now);if(BC)brFrame(dt,now);if(cur&&cur.water&&cur.water.material.map)cur.water.material.map.offset.x+=dt*.01;WT.value=now/1000%1000;GRASS_T.value=now/1000%1000;updDust(dt,now/1000);
  if(sun.castShadow){const c=camera.position,sd=cur.sunDir;const s=68/2048;const tx=Math.round(c.x/s)*s,tz=Math.round(c.z/s)*s;sun.target.position.set(tx,0,tz);sun.position.set(tx+sd.x*90,sd.y*90,tz+sd.z*90);sun.target.updateMatrixWorld()}
  if(cur&&cur.sky)cur.sky.position.copy(camera.position);
  if(vmCam.aspect!==camera.aspect){vmCam.aspect=camera.aspect;vmCam.updateProjectionMatrix()}
  if(window.__camOv){const o=window.__camOv;camera.position.set(...o.p);camera.lookAt(...o.l);camera.updateMatrixWorld();vmRoot.visible=false}renderer.info.reset();if(post&&qLevel()==='high'){post.begin();renderer.render(scene,camera);if(!C.hub){renderer.clearDepth();renderer.render(vmScene,vmCam)}post.end(now/1000)}
  else{renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);if(!C.hub){renderer.clearDepth();renderer.render(vmScene,vmCam)}}
  acc+=el;frames++;if(acc>2000){const avg=acc/frames;fpsLog.push(Math.round(1000/avg));if(fpsLog.length>30)fpsLog.shift();
   if(S.quality==='auto'&&avg>19.5&&inGame&&!paused&&performance.now()>qGrace){if(pixelRatio>.8){pixelRatio=Math.max(.75,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);resize()}else if(autoLevel!=='low'&&++slowWin>=3){slowWin=0;autoLevel=autoLevel==='high'?'medium':'low';applyQuality();console.log('auto quality ->',autoLevel)}}else slowWin=0;acc=0;frames=0}}}
// ================= ONLINE HUB + MATCHMAKER =================
// Discovery with zero servers of our own: hub instance n lives at the well-known PeerJS id PREFIX+'hub-'+n. Whoever claims that id first
// runs a tiny relay (HubServer) for everyone: hub positions, queue pads, map vote, and the public-room registry used by Browse/Quick Join.
// When the hub host leaves, every connected client retries after a random back-off; the first to re-claim the id becomes the new hub host
// (hub players back off 0.3-1.5s, room hosts / browsers 2-4s so a hub player usually wins). A hub instance holds 20 players; more spill to hub-2...
const HUB_MAX=20,HUB_LIMIT=6;const hubPid=n=>PREFIX+'hub-'+n;
let net=null,netReady=false,hubConn=null,hubSrv=null,hubN=1,hubKind=null,hubWant=false,hubSelfId=null,hubClaiming=false,hubOrd=0;const netQ=[];
function hubUrl(){return location.pathname+'?hub=1'+(/[?&]net=local/.test(location.search)?'&net=local':'')}
function withNet(cb){if(net&&netReady){cb();return}netQ.push(cb);if(net)return;net=new Peer({config:ICE,debug:0});
 net.on('open',id=>{netReady=true;hubSelfId=id;while(netQ.length)netQ.shift()()});
 net.on('error',e=>{if(e.type==='peer-unavailable'&&String(e.message||'').includes(hubPid(hubN))&&hubWant&&!hubConn)claimHub(hubN)});
 net.on('disconnected',()=>{try{net.reconnect()}catch(e){}})}
function hubLink(kind){const prev=hubKind;hubKind=hubKind==='player'?'player':kind;hubWant=true;if(hubConn&&hubConn.open){if(prev!==hubKind)hubSendHi();return}withNet(tryHub)}
function hubUnlink(){hubWant=false;if(hubConn&&!hubConn.local)try{hubConn.close()}catch(e){}hubConn=null;if(hubSrv){hubSrv.shutdown();hubSrv=null}}
function tryHub(){if(!hubWant||hubConn)return;if(hubSrv&&hubSrv.n===hubN){attachLocal();return}
 const c=net.connect(hubPid(hubN),{reliable:true,serialization:'json'});
 c.on('open',()=>{if(hubConn&&hubConn!==c){c.close();return}hubConn=c;hubSendHi()});c.on('data',hubRecv);
 c.on('close',()=>{if(hubConn===c){hubConn=null;hubLost()}})}
function hubLost(){if(!hubWant)return;const k=hubKind==='player';setTimeout(tryHub,(k?300:2000)+Math.random()*(k?1200:2000))}
function claimHub(n){if(hubSrv||hubClaiming)return;hubClaiming=true;const sp=new Peer(hubPid(n),{config:ICE,debug:0});
 sp.on('open',()=>{hubClaiming=false;if(!hubWant||hubConn){sp.destroy();return}hubSrv=new HubServer(sp,n);attachLocal()});
 sp.on('error',e=>{if(e.type==='unavailable-id'){hubClaiming=false;try{sp.destroy()}catch(x){}setTimeout(tryHub,300+Math.random()*700)}})}
function attachLocal(){hubConn={local:true,open:true,send:m=>hubSrv&&hubSrv.recv(hubSelfId,m,null),close(){}};hubSendHi()}
function hubSend(m){if(hubConn&&hubConn.open)hubConn.send(m)}
function hubSendHi(){hubSend({t:'hi',kind:hubKind,name:myName(),skin:PROG.skin,cl:PROG.pc})}
function hubEquip(){if(C.hub)hubSend({t:'eq',name:myName(),skin:PROG.skin,cl:PROG.pc})}
class HubServer{constructor(peer,n){this.peer=peer;this.n=n;this.cl={};this.ord=0;this.rooms={};this.sel={};this.ffaT=Date.now();this.ffaN=0;this.ffaEnd=0;this.lastPads='';
  peer.on('connection',c=>{c.on('data',d=>this.recv(c.peer,d,c));c.on('close',()=>this.drop(c.peer));c.on('error',()=>this.drop(c.peer))});this.iv=setInterval(()=>this.tick(),125)}
 shutdown(){clearInterval(this.iv);try{this.peer.destroy()}catch(e){}}
 send(c,m){if(c.local)queueMicrotask(()=>hubRecv(m));else if(c.conn&&c.conn.open)c.conn.send(m)}
 players(){return Object.values(this.cl).filter(c=>c.kind==='player')}
 bc(m,except){for(const id in this.cl){const c=this.cl[id];if(c.kind==='player'&&id!==except)this.send(c,m)}}
 recv(id,m,conn){let c=this.cl[id];if(c)c.seen=Date.now();
  if(m.t==='hi'){if(c){c.busy=false;if(conn)c.conn=conn}if(c&&c.kind!==m.kind&&m.kind==='player'){c.kind='player'}
   else if(!c){if(m.kind==='player'&&this.players().length>=HUB_MAX){conn&&conn.send({t:'hubfull'});return}
    c=this.cl[id]={id,conn,local:!conn,kind:m.kind,ord:++this.ord,pos:[0,0,5,0],busy:false,seen:Date.now()}}
   c.name=String(m.name||'Player').slice(0,12);c.skin=cleanSkin(m.skin);c.cl=clOf(m.cl);
   if(c.kind==='player'){this.send(c,{t:'hw',you:c.ord,n:this.n,players:this.players().filter(p=>p!==c).map(p=>[p.ord,p.name,p.skin,...[0,1,2,3].map(i=>(p.pos&&p.pos[i])||0),p.cl])});this.bc({t:'hj',p:[c.ord,c.name,c.skin,c.cl]},id);this.lastPads=''}
   else this.send(c,{t:'hw',you:c.ord,n:this.n});return}
  if(!c){if(conn&&conn.open)conn.send({t:'rehi'});else if(!conn)queueMicrotask(()=>hubRecv({t:'rehi'}));return}
  switch(m.t){
   case 'pos':if(Array.isArray(m.p))c.pos=m.p.slice(0,4).map(v=>+v||0);break;
   case 'eq':c.skin=SKINS[splitSkin(m.skin).id]?cleanSkin(m.skin):c.skin;c.cl=clOf(m.cl||c.cl);c.name=String(m.name||c.name).slice(0,12);this.bc({t:'hj',p:[c.ord,c.name,c.skin,c.cl]},id);break;
   case 'vote':{const s=this.sel[m.sid];if(s&&s.ids.includes(id)&&s.maps.includes(m.map)){s.votes[id]=m.map;this.toSel(s,{t:'votes',sid:s.id,votes:Object.values(s.votes)})}break}
   case 'reg':if(m.room&&m.room.code)this.rooms[m.room.code]={...m.room,at:Date.now(),by:id};break;
   case 'unreg':delete this.rooms[m.code];break;
   case 'list':this.send(c,{t:'rooms',list:this.roomList(),hub:this.players().length});break;
   case 'ping':this.send(c,{t:'pong',ts:m.ts});break}}
 roomList(){const now=Date.now();for(const k in this.rooms)if(now-this.rooms[k].at>16000)delete this.rooms[k];return Object.values(this.rooms).map(r=>({code:r.code,host:r.host,mode:r.mode,map:r.map,n:r.n,max:r.max,phase:r.phase,hubffa:!!r.hubffa}))}
 drop(id){const c=this.cl[id];if(!c)return;delete this.cl[id];for(const k in this.rooms)if(this.rooms[k].by===id)delete this.rooms[k];if(c.kind==='player'){this.bc({t:'hl',o:c.ord});this.lastPads=''}}
 tick(){const now=Date.now();for(const id in this.cl){const c=this.cl[id];if(!c.local&&now-(c.seen||now)>6000)this.drop(id)}const ps=this.players();const free=ps.filter(p=>!p.busy);
  // queue = who is physically standing inside each circle (server-side check, so leaving a circle unqueues instantly)
  const st={};for(const p of HUB_PADS){st[p.k]={};for(const c of padCircles(p))st[p.k][c.side]=free.filter(q=>inPad(c,q.pos[0],q.pos[2])).sort((a,b)=>a.ord-b.ord).slice(0,p.n).map(q=>q.id)}
  // FFA countdown: 10 s once 2+ stand on the pad; a newcomer keeps at least 5 s left (never resets); full pad starts now; <2 cancels
  this.qEnd=this.qEnd||{};const fp=HUB_PADS.find(p=>p.single);if(fp){const F=st[fp.k].F;this.soloSeen=this.soloSeen||{};for(const id in this.soloSeen)if(!F.includes(id))delete this.soloSeen[id];
   // anyone stepping on the FFA pad while a hub solo/online FFA room is open joins it in progress
   const hr=this.roomList().find(r=>r.hubffa&&r.n<r.max&&r.phase!=='roundEnd');if(hr&&F.length){for(const id of F){const c=this.cl[id];if(c){c.busy=true;this.send(c,{t:'go',code:hr.code,map:-1,mode:'ffa',host:'',teams:{},expect:1,join:1});setTimeout(()=>{if(this.cl[id])this.cl[id].busy=false},8000)}}this.ffaEnd=0;this.lastPads=''}
   const n=F.length;if(n===1&&this.soloSeen[F[0]]){this.ffaEnd=0}else if(n<1)this.ffaEnd=0;else if(n===1){if(!this.ffaEnd)this.ffaEnd=now+10000}else{if(!this.ffaEnd||this.ffaN<2)this.ffaEnd=now+10000;else if(n>this.ffaN)this.ffaEnd=now+Math.max(this.ffaEnd-now,5000);if(n>=fp.n)this.ffaEnd=now}this.ffaN=n}
  const key=JSON.stringify(st)+'|'+this.ffaEnd+JSON.stringify(this.qEnd||{});if(key!==this.lastPads){this.lastPads=key;const o={};for(const k in st){o[k]={};for(const s in st[k])o[k][s]=st[k][s].map(id=>this.cl[id].ord)}const qe={};for(const k in this.qEnd)qe[k]=Math.max(0,this.qEnd[k]-now);this.bc({t:'pads',q:o,ffa:this.ffaEnd?Math.max(0,this.ffaEnd-now):0,qe})}
  for(const p of HUB_PADS){const s=st[p.k];if(p.q){const F=s.F;if(!F.length)delete this.qEnd[p.k];else if(F.length>=p.n)this.qEnd[p.k]=now;else if(!this.qEnd[p.k])this.qEnd[p.k]=now+(p.k==='ext'?10000:12000);if(this.qEnd[p.k]&&now>=this.qEnd[p.k]){delete this.qEnd[p.k];this.lastPads='';this.startSel(p,s)}continue}if(p.single){if(this.ffaEnd&&now>=this.ffaEnd&&s.F.length>=2){this.ffaEnd=0;this.ffaN=0;this.startSel(p,s)}else if(this.ffaEnd&&now>=this.ffaEnd&&s.F.length===1){this.ffaEnd=0;const id=s.F[0];this.soloSeen[id]=1;const c=this.cl[id];if(c)this.send(c,{t:'solo'});this.lastPads=''}}else if(s.A.length>=p.n&&s.B.length>=p.n)this.startSel(p,s)}
  for(const k in this.sel)if(now>=this.sel[k].until)this.finish(this.sel[k]);
  // hub positions at 8 Hz, compact ints
  if(ps.length>1){const rows=ps.map(p=>[p.ord,Math.round(p.pos[0]*100),Math.round(p.pos[1]*100),Math.round(p.pos[2]*100),Math.round(p.pos[3]*100)]);for(const p of ps)this.send(p,{t:'hpos',p:rows.filter(r=>r[0]!==p.ord)})}}
 startSel(pad,s){const ids=[...(s.A||[]),...(s.B||[]),...(s.F||[])];if(!ids.length)return;for(const id of ids)this.cl[id].busy=true;
  if(BRM(pad.k)){const sid=Math.random().toString(36).slice(2,8);const sel={id:sid,mode:pad.k,ids,teams:{A:[],B:[]},maps:[BR_I],votes:{},until:0};this.sel[sid]=sel;this.lastPads='';this.finish(sel);return}
  const order=[0,1,2,3,4].sort(()=>Math.random()-.5);if(pad.n>=4){order.sort((a,b)=>((b===4||b===2)?1:0)-((a===4||a===2)?1:0)+(Math.random()-.5)*.1)}const maps=order.slice(0,3);
  const sid=Math.random().toString(36).slice(2,8);const sel={id:sid,mode:pad.k,ids,teams:{A:s.A||[],B:s.B||[]},maps,votes:{},until:Date.now()+5000};this.sel[sid]=sel;this.lastPads='';
  this.toSel(sel,{t:'sel',sid,mode:pad.k,maps,ms:5000,names:ids.map(i=>this.cl[i].name)})}
 toSel(s,m){for(const id of s.ids){const c=this.cl[id];if(c)this.send(c,m)}}
 finish(s){delete this.sel[s.id];const cnt={};for(const v of Object.values(s.votes))cnt[v]=(cnt[v]||0)+1;let best=-1,bm=[];for(const mp of s.maps){const n=cnt[mp]||0;if(n>best){best=n;bm=[mp]}else if(n===best)bm.push(mp)}
  const map=bm[Math.random()*bm.length|0];const alive=s.ids.filter(id=>this.cl[id]);if(!alive.length)return;const code=genCode();const teams={};for(const id of s.teams.A)teams[id]='A';for(const id of s.teams.B)teams[id]='B';
  this.toSel(s,{t:'go',code,map,mode:s.mode,host:alive[0],teams,expect:alive.length});for(const id of s.ids)if(this.cl[id])this.cl[id].busy=false}}
// ---------- hub client ----------
let lastPad=null;let hubVis=null,padLabels={},myPads=null,hubSel=null,hubPosT=0,brCb=null;
function enterHub(){if(qLevel()==='low'&&false)return;audioInit();C.hub=true;menuMsg('Connecting to the hub…');hubKind='player';hubLink('player')}
function hubRecv(m){switch(m.t){
 case 'hw':hubOrd=m.you;if(C.phase==='hub')hubSend({t:'pos',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(2)]});if(hubKind==='player'&&C.hub)enterHubWorld(m);if(brCb)hubSend({t:'list'});if(regIv&&H.pub)hubSend({t:'reg',room:roomInfo()});break;
 case 'hubfull':if(hubN<HUB_LIMIT){hubN++;if(hubConn&&!hubConn.local)hubConn.close();hubConn=null;tryHub()}else menuMsg('All hubs are full — try Quick Join');break;
 case 'hj':if(C.hub&&C.phase==='hub'&&m.p[0]!==hubOrd){const[o,n,sk,cl]=m.p;const id='h'+o;const old=C.players[id];addRemote(id,{name:n,team:'A',color:FFACOL[o%10],sk,cl,o:'h'+o});const q=C.players[id];q.alive=true;if(old){q.tp.copy(old.tp);q.rp.copy(old.rp)}if(q.model)q.model.visible=true}break;
 case 'hl':{const q=C.players['h'+m.o];if(q){if(q.model)scene.remove(q.model);delete C.players['h'+m.o]}break}
 case 'hpos':if(C.phase==='hub')for(const r of m.p){const q=C.players['h'+r[0]];if(!q)continue;q.tp.set(r[1]/100,r[2]/100,r[3]/100);q.tyaw=r[4]/100;if(!q.seen){q.seen=1;q.rp.copy(q.tp)}}break;
 case 'rehi':hubSendHi();break;
 case 'pads':myPads=m.q;window.__pads3=!!(m.q.ffa&&m.q.ffa.F&&m.q.ffa.F.length>=3);ffaEndAt=m.ffa?Date.now()+m.ffa:0;qeAt={};for(const k in(m.qe||{}))qeAt[k]=Date.now()+m.qe[k];updPadLabels(true);break;
 case 'sel':openMapSel(m);break;
 case 'votes':if(hubSel&&hubSel.sid===m.sid){hubSel.votes=m.votes;renderMapSel()}break;
 case 'go':startHubMatch(m);break;
 case 'solo':openSolo();break;
 case 'rooms':if(brCb)brCb(m.list,m.hub);break}}
function enterHubWorld(m){setTimeout(()=>{if(C.hub&&Object.keys(THUMB).length<MAPS.length)renderThumbs()},2500);for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.byOrd={};C.mode='hub';C.phase='hub';C.map=HUB_I;C.sb={};C.score={};
 loadMap(HUB_I);buildPadVis();for(const s of['menu','lobby','arsenal','settings','browser'])$(s).classList.add('hidden');
 $('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);$('hubUI').classList.remove('hidden');document.body.classList.add('hub');
 inGame=true;resize();const a=Math.random()*6.28;me.pos.set(Math.cos(a)*2.5,0,4+Math.sin(a)*2);me.vel.set(0,0,0);me.yaw=Math.PI;me.pitch=-.05;me.hp=100;me.alive=true;me.frozen=false;me.id='hub-me';
 if(sessionStorage.getItem('hsz_requeue')){sessionStorage.removeItem('hsz_requeue');try{const lp=JSON.parse(sessionStorage.getItem('hsz_pad')||'null');const P=lp&&HUB_PADS.find(p=>p.k===lp[0]);const c=P&&padCircles(P).find(c=>c.side===lp[1]);if(c){me.pos.set(c.x,0,c.z);me.yaw=c.side==='A'?-Math.PI/2:c.side==='B'?Math.PI/2:Math.PI;center('⚔️ Re-queued — waiting for players',2500)}}catch(e){}}
 setViewModel(me.load[0]);buildSlots();updHP();for(const r of m.players||[]){hubRecv({t:'hj',p:[r[0],r[1],r[2],r[7]]});const q=C.players['h'+r[0]];if(q){q.tp.set(r[3],r[4],r[5]);q.rp.copy(q.tp);q.seen=1}}
 center('🏠 HEADSHOTZ HUB\nStep onto a glowing square to queue',3500);updHubInfo()}
function updHubInfo(){const n=Object.keys(C.players).length+1;$('hubInfo').innerHTML=`<b>HUB #${hubN}</b> · ${n} online · 💎 <b class="diaBal">${PROG.dia}</b>${hubSrv?' · <small>you host the hub</small>':''}`}
function labelTex(lines,col){const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');x.textAlign='center';x.fillStyle='rgba(10,14,35,.6)';x.beginPath();x.roundRect?x.roundRect(16,16,480,160,36):x.rect(16,16,480,160);x.fill();
 x.fillStyle=col;x.font='900 70px system-ui,Arial Black,sans-serif';x.fillText(lines[0],256,88);x.fillStyle='#fff';x.font='800 50px system-ui,sans-serif';x.fillText(lines[1]||'',256,150);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function buildPadVis(){if(hubVis){scene.remove(hubVis.g)}const g=new THREE.Group();hubVis={g,rings:[],labels:{},npcs:[]};
 const SIDE={A:0x3fa9ff,B:0xff5a6b,F:0xffd23f};const lo=GQ.level==='low';
 for(const p of HUB_PADS)for(const c of padCircles(p)){const col=new THREE.Color(PAD_COL[p.k]||0xffffff),h=c.h;
  const edge=new THREE.Group();const em=new THREE.MeshBasicMaterial({color:col.clone().multiplyScalar(2.4),transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
  for(const[w,d,x,z]of[[2*h,.14,0,-h],[2*h,.14,0,h],[.14,2*h,-h,0],[.14,2*h,h,0]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.05,d),em);m.position.set(x,0,z);edge.add(m)}
  for(const[x,z]of[[-h,-h],[h,-h],[-h,h],[h,h]]){const post=new THREE.Mesh(new THREE.BoxGeometry(.16,.9,.16),em);post.position.set(x,.45,z);edge.add(post)}
  edge.position.set(c.x,.11,c.z);
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(2*h-.2,2*h-.2),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending}));fill.rotation.x=-Math.PI/2;fill.position.set(c.x,.1,c.z);
  const sideBar=new THREE.Mesh(new THREE.PlaneGeometry(2*h-.6,.35),new THREE.MeshBasicMaterial({color:new THREE.Color(SIDE[c.side]).multiplyScalar(1.8),transparent:true,opacity:.8,depthWrite:false}));sideBar.rotation.x=-Math.PI/2;sideBar.position.set(c.x,.105,c.z+h-.45);
  let pts=null;if(!lo){const N=28,pos=new Float32Array(N*3),seed=new Float32Array(N);for(let i=0;i<N;i++){seed[i]=Math.random();const e=i%4,t=Math.random()*2-1;pos[i*3]=c.x+(e<2?t*h:(e===2?-h:h));pos[i*3+2]=c.z+(e<2?(e===0?-h:h):t*h)}
   const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(pos,3));pts=new THREE.Points(gg,new THREE.PointsMaterial({size:.16,map:TX.soft,color:col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));pts.userData.seed=seed;pts.frustumCulled=false;g.add(pts)}
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex([MODES[p.k][0].split(' ')[0],'0/'+p.n],'#'+col.getHexString()),depthWrite:false,transparent:true}));spr.scale.set(3.2,1.2,1);spr.position.set(c.x,2.9,c.z);
  g.add(edge,fill,sideBar,spr);hubVis.rings.push({edge,em,fill,pts,c,p});hubVis.labels[p.k+c.side]={spr,col:'#'+col.getHexString(),p,c}}
 for(const s of HUB_ST){const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex([s.name.split(' ')[0],s.name.split(' ').slice(1).join(' ')],'#'+new THREE.Color(s.col||0xffd23f).getHexString()),depthWrite:false,transparent:true}));spr.scale.set(3.6,1.35,1);spr.position.set(s.x+(s.k==='practice'?0:1.2*(s.sg||1)),5.3,s.z);g.add(spr);
  if(s.npc){const m=makeCharacter(s.col,s.npc,'npc'+s.k,0xffffff,s.k==='pskins'?humanOutfit('pirate',0):s.k==='pets'?humanOutfit('ranger',0):null,s.cls);m.position.set(s.x+.35*(s.sg||1),0,s.z);m.rotation.y=-Math.PI/2*(s.sg||1);g.add(m);hubVis.npcs.push({m,s,wave:0,near:false})}}
 scene.add(g);updPadLabels()}
function updNPCs(dt,now){if(!hubVis)return;const t=now/1000;for(const n of hubVis.npcs){const u=n.m.userData;const ps=[me.pos,...Object.values(C.players).filter(q=>q.rp).map(q=>q.rp)];let best=null,bd=7;for(const p of ps){const d=Math.hypot(p.x-n.m.position.x,p.z-n.m.position.z);if(d<bd){bd=d;best=p}}
  animate(n.m,{speed:0,pitch:0,dist:camera.position.distanceTo(n.m.position)},dt);
  const near=!!best;if(near&&!n.near)n.wave=1.6;n.near=near;
  if(best){const dx=best.x-n.m.position.x,dz=best.z-n.m.position.z;let a=Math.atan2(-dx,-dz)-n.m.rotation.y;a=Math.atan2(Math.sin(a),Math.cos(a));a=Math.max(-1,Math.min(1,a));u.head.rotation.y+=(a-u.head.rotation.y)*Math.min(1,dt*5);if(u.torso)u.torso.rotation.y=a*.3}else u.head.rotation.y*=.95;
  if(n.wave>0){n.wave-=dt;u.aim.rotation.x=-1.9+Math.sin(t*12)*.25;u.aim.rotation.z=Math.sin(t*12)*.15}else{u.aim.rotation.x+=(.55-u.aim.rotation.x)*Math.min(1,dt*4);u.aim.rotation.z*=.9}}}
let ffaEndAt=0,ffaSecs=-1,qeAt={};const qLeft=k=>qeAt[k]?Math.max(0,Math.ceil((qeAt[k]-Date.now())/1000)):0;function ffaLeft(){return ffaEndAt?Math.max(0,Math.ceil((ffaEndAt-Date.now())/1000)):0}
function updPadLabels(){if(!hubVis)return;const fs=ffaLeft();for(const k in hubVis.labels){const L=hubVis.labels[k];const n=myPads&&myPads[L.p.k]?(myPads[L.p.k][L.c.side]||[]).length:0;const side=L.p.q?'QUEUE':L.c.side==='A'?'BLUE':L.c.side==='B'?'RED':'FFA';const qs=L.p.q?qLeft(L.p.k):0;const cd=(L.p.single&&fs>0)||qs>0;const fs2=L.p.q?qs:fs;
  const key=n+'|'+(cd?fs2:'');if(L.k===key)continue;L.k=key;L.spr.material.map.dispose();L.spr.material.map=labelTex([MODES[L.p.k][0].split(' ')[0]+' '+side,cd?`${n}/${L.p.n}  ⏱ ${fs2}`:`${n}/${L.p.n}`],L.col);L.spr.material.needsUpdate=true}
 let mine=null;if(myPads)for(const k in myPads)for(const s in myPads[k])if(myPads[k][s].includes(hubOrd))mine=[k,s];if(mine)lastPad=mine;
 const qpad=mine&&HUB_PADS.find(p=>p.q&&p.k===mine[0]);const ffaCd=(fs>0&&HUB_PADS.find(p=>p.single&&p.k===(mine&&mine[0])))||(qpad&&qLeft(mine[0])>0);const fsx=qpad?qLeft(mine[0]):fs;$('padInfo').textContent=mine?(ffaCd?`${qpad?MODES[mine[0]][0].toUpperCase():'FFA'} STARTS IN ${fsx}… (${(myPads[mine[0]][mine[1]]||[]).length} players) — step off to leave`:`Queued: ${MODES[mine[0]][0]} · ${mine[1]==='A'?'BLUE':mine[1]==='B'?'RED':'FFA'} side — waiting for players… step off to leave`):'';$('padInfo').classList.toggle('cd',!!ffaCd)}
function updHub(dt,now){if(C.phase!=='hub')return;{const fs=ffaLeft();const qsig=qLeft('br')+qLeft('brs')*100+qLeft('ext')*10000;if(qsig!==updHub.qs){updHub.qs=qsig;updPadLabels()}if(fs!==ffaSecs){if(fs>0&&ffaSecs!==-1&&myPads)SFX.beep(fs<=3?990:660);ffaSecs=fs;updPadLabels()}}hubPosT+=dt;if(hubPosT>=.125){hubPosT=0;hubSend({t:'pos',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(2)]})}
 if(hubVis){updNPCs(dt,now);for(const r of hubVis.rings){const inside=inPad(r.c,me.pos.x,me.pos.z);const n=myPads&&myPads[r.p.k]?(myPads[r.p.k][r.c.side]||[]).length:0;const fr=n/r.p.n;const rate=150+450*(1-fr);const pl=.5+.5*Math.sin(now/rate+r.c.x);
  r.em.opacity=.55+.45*pl;r.edge.scale.set(1+pl*.012*(1+fr),1+fr*1.5,1+pl*.012*(1+fr));r.fill.material.opacity=(inside?.3:.1)+fr*.25+pl*.06;
  if(r.pts){const pa=r.pts.geometry.attributes.position,sd=r.pts.userData.seed;for(let i=0;i<pa.count;i++){let y=((now/1000)*(.6+fr*1.2+sd[i]*.4)+sd[i]*3)%2.2;pa.array[i*3+1]=.1+y}pa.needsUpdate=true;r.pts.material.opacity=.5+fr*.5}}}
 let st=null,bd=3.2;for(const s of HUB_ST){const d=Math.hypot(me.pos.x-s.x,me.pos.z-s.z);if(d<bd){bd=d;st=s}}const b=$('stationBtn');if(st){b.textContent='TAP: '+st.name;b.dataset.k=st.k;b.classList.remove('hidden')}else b.classList.add('hidden');
 if(Math.random()<dt)updHubInfo()}
let SHOP=null,PETSHOP=null,PETS=null;function useStation(k){if(k==='shop')openArsenal(null,'shop');else if(k==='upgrade')openArsenal(null,'upgrade');else if(k==='arsenal')openArsenal();else if(k==='classes')openClasses();else if(k==='chest')openChests();else if(k==='skins')openArsenal('skins');else if(k==='pskins')SHOP&&SHOP.open();else if(k==='pets')PETSHOP&&PETSHOP.open('hub');else if(k==='practice'){location.href=location.pathname+'?offline=1'+(/[?&]net=local/.test(location.search)?'&net=local':'')}}
$('stationBtn').onclick=()=>useStation($('stationBtn').dataset.k);
// ---------- map selection (5 s, majority wins, random tie-break on the hub host) ----------
let mapSelIv=null;
function openMapSel(m){hubSel={sid:m.sid,maps:m.maps,votes:[],mine:-1,end:performance.now()+m.ms,mode:m.mode,names:m.names};$('mapSel').classList.remove('hidden');SFX.kill();renderMapSel();
 clearInterval(mapSelIv);mapSelIv=setInterval(()=>{const left=Math.max(0,Math.ceil((hubSel.end-performance.now())/1000));$('mapSelT').textContent=left;if(left<=0)clearInterval(mapSelIv)},200);if(Object.keys(THUMB).length<MAPS.length)renderThumbs(()=>renderMapSel())}
function renderMapSel(){if(!hubSel)return;$('mapSelSub').textContent=`${MODES[hubSel.mode][0]} · ${hubSel.names.join(', ')}`;
 const tv=hubSel.votes.length;$('mapSelList').innerHTML=hubSel.maps.map(i=>{const v=hubSel.votes.filter(x=>x===i).length;const pct=tv?Math.round(v/tv*100):Math.round(100/hubSel.maps.length);return`<button class="map${hubSel.mine===i?' sel':''}" data-ms="${i}" style="${THUMB[i]?`background-image:url(${THUMB[i]})`:''}"><span class="vc">${pct}%${v?` · ${v}🗳️`:''}</span><span class="mn">${MI(i).icon} ${MI(i).name}<small>${MI(i).desc}</small></span></button>`}).join('')}
$('mapSelList').addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b||!hubSel)return;hubSel.mine=+b.dataset.ms;hubSend({t:'vote',sid:hubSel.sid,map:hubSel.mine});SFX.swap();renderMapSel()});
function startHubMatch(m){clearInterval(mapSelIv);$('mapSelT').textContent='GO';$('soloSel').classList.add('hidden');center(m.join?'Joining FFA in progress…':`${MI(m.map).icon} ${MI(m.map).name}\nStarting ${MODES[m.mode][0]}…`,3000);
 const auto=m.join?null:{mode:m.mode,map:m.map,teams:m.teams,expect:m.expect,fromHub:1,solo:m.solo?1:0,diff:m.diff,pub:m.pub};
 setTimeout(()=>{$('mapSel').classList.add('hidden');hubUnlink();leaveHubWorld();C.fromHub=true;sessionStorage.setItem('hsz_fromHub','1');sessionStorage.setItem('hsz_pad',JSON.stringify(lastPad));
  if(m.host===hubSelfId)createRoom(m.code,auto);else setTimeout(()=>joinRoom(m.code,auto),900+Math.random()*400)},900)}
function leaveHubWorld(){C.hub=false;document.body.classList.remove('hub');$('hubUI').classList.add('hidden');if(hubVis){scene.remove(hubVis.g);hubVis=null}for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};inGame=false;C.phase='lobby';$('hud').classList.add('hidden')}
function setupAuto(){const a=H.auto;H.mode=a.mode;H.fill=true;H.pub=a.pub!=null?!!a.pub:!!a.solo;H.diff=DIFF[a.diff]?a.diff:'normal';H.autoAt=a.solo?H.t+.5:H.t+12;sendLobby();if(a.solo){hubKind=null;regRoom()}}
let sbDirty=0;setInterval(()=>{if(sbDirty&&inGame){sbDirty=0;renderSB()}},250);
// between-round loadout pick (like duel games: swap weapons while the next round loads)
function showRL(on){$('rlBtn').classList.toggle('hidden',!on||C.hub||!inGame)}
$('rlBtn').onclick=()=>{if(typeof openArsenal==='function')openArsenal()};
// end-of-match results screen: VICTORY/DEFEAT, score, your stats, diamonds, rematch / lobby
let remWait=false;let endIv=null;function hideEnd(){$('endScr').classList.add('hidden');document.body.classList.remove('endOn');if(endIv){clearInterval(endIv);endIv=null}}
function showEnd(m,mine){showRL(false);const s=C.sb[me.id]||{k:0,d:0,hs:0,pts:0};const sc=C.score||{};
 const ffa=C.mode==='ffa';$('endT').textContent=C.mode==='ext'?(mine?'MISSION COMPLETE':'MISSION FAILED'):BC?(mine?'VICTORY ROYALE':'MATCH OVER'):mine?'VICTORY':'DEFEAT';$('endScr').classList.toggle('win',!!mine);
 $('endScore').innerHTML=m.title?`<b>${esc(m.title)}</b> · ${esc(m.sub)}`:ffa?`<b>${esc(m.name)}</b> wins`:`<span class="a">${sc.A||0}</span> – <span class="b">${sc.B||0}</span>`;
 const ps=Object.values(C.players).map(q=>[q,C.sb[q.id]||{k:0,d:0,pts:0}]).sort((a,b)=>b[1].pts-a[1].pts);const mvp=ps[0];
 $('endStats').innerHTML=`<div><b>${s.k}</b><small>KILLS</small></div><div><b>${s.d}</b><small>DEATHS</small></div><div><b>${s.hs||0}</b><small>HEADSHOTS</small></div><div><b>💎 ${C.matchDia||0}</b><small>EARNED</small></div>`+(mvp?`<p>⭐ MVP: <b style="color:${hex(mvp[0].color)}">${esc(mvp[0].name)}</b></p>`:'');
 let t=16;const lb=$('endLobby');remWait=false;$('endAgain').disabled=false;const brEnd=!!BC||BRM(C.mode);$('endAgain').textContent=brEnd?'🔁 PLAY AGAIN · SAME SQUAD':'⚔️ REMATCH';lb.textContent=brEnd?`🏝️ ROYALE MENU (${t})`:`LOBBY (${t})`;$('endScr').classList.remove('hidden');document.body.classList.add('endOn');if(document.pointerLockElement)document.exitPointerLock();
 endIv=setInterval(()=>{t--;lb.textContent=brEnd?`🏝️ ROYALE MENU (${Math.max(0,t)})`:`LOBBY (${Math.max(0,t)})`;if(t<=0){clearInterval(endIv);endIv=null;if(brEnd&&!remWait&&!(isHost&&remYes()>0&&humansOther().length)){brMenu();return}if(isHost)hostDecide();else if(!remWait&&(C.fromHub||sessionStorage.getItem('hsz_fromHub'))){hideEnd();location.href=hubUrl()}}},1000)}
function brMenu(){try{sessionStorage.setItem('hsz_royMenu','1');sessionStorage.setItem('hsz_squad',JSON.stringify({mode:BRM(C.mode)?C.mode:'br',diff:(H&&H.diff)||LS('royDiff')||'normal',n:PARTY?PARTY.m.length:1}))}catch(e){}hideEnd();location.href=location.pathname+(/[?&]net=local/.test(location.search)?'?net=local':'')}
function endGo(again){
 if(!again&&(BC||BRM(C.mode))){if(isHost){clearTimeout(H.remT);clearTimeout(H.lobbyT);H.matchOver=false}else send({t:'rem',v:0});brMenu();return}
 if(isHost){if(again){if(!H.matchOver){hideEnd();return}hostRematch();return}
  hideEnd();H.rem=H.rem||{};H.rem[me.id]=0;if(H.matchOver){clearTimeout(H.remT);H.matchOver=false;clearTimeout(H.lobbyT);if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl();return}if(H.phase==='roundEnd'){H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}}return}
 if(again){remWait=true;send({t:'rem',v:1});$('endAgain').disabled=true;$('endAgain').textContent='⏳ WAITING FOR HOST…';return}
 send({t:'rem',v:0});hideEnd();if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl()}}
$('endAgain').onclick=()=>endGo(true);$('endLobby').onclick=()=>endGo(false);
function afterMatch(){if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl()}}
// ---------- public rooms: registry, browser, quick join ----------
let regIv=null;
function roomInfo(){return{code:roomCode,host:H.players[me.id]?.name||'Host',mode:H.mode,map:H.phase==='lobby'?'Voting':MI(H.map).name,n:plist().filter(p=>!p.bot).length,max:MODEMAX[H.mode]||10,phase:H.phase,hubffa:!!(H.auto&&H.auto.solo&&H.mode==='ffa')}}
function regRoom(){if(!isHost||H.offline)return;if(!H.pub){if(regIv){clearInterval(regIv);regIv=null;hubSend({t:'unreg',code:roomCode})}return}
 hubLink(hubKind||'reg');hubSend({t:'reg',room:roomInfo()});if(!regIv)regIv=setInterval(()=>{if(H.pub)hubSend({t:'reg',room:roomInfo()})},5000)}
function fetchRooms(cb){brCb=cb;hubLink(hubKind||'browse');if(hubConn&&hubConn.open)hubSend({t:'list'})}
function openBrowser(){audioInit();$('menu').classList.add('hidden');$('browser').classList.remove('hidden');$('brList').innerHTML='<p class="msg">Searching for open games…</p>';fetchRooms(renderRooms);setTimeout(()=>{if($('brList').textContent.includes('Searching'))renderRooms([],0)},5000)}
function renderRooms(list,hubN2){const open=list.filter(r=>r.n<r.max);
 $('brList').innerHTML=(open.length?open.map(r=>`<button class="room" data-code="${esc(r.code)}"><b>${esc(r.host)}</b><span>${MODES[r.mode]?MODES[r.mode][0]:r.mode}</span><span>${esc(r.map)}</span><span>${r.n}/${r.max}</span><span class="ping" id="ping-${esc(r.code)}">…</span><span class="go">JOIN ▶</span></button>`).join(''):`<p class="msg">No open public games right now.<br>Tap ⚡ QUICK JOIN to start one — others will see it here.</p>`)+`<p class="msg small">${hubN2||0} players in the hub</p>`;
 for(const r of open.slice(0,6))pingRoom(r.code)}
function pingRoom(code){if(!net||!netReady)return;const c=net.connect(PREFIX+code,{reliable:true,serialization:'json'});const t0=performance.now();const kill=setTimeout(()=>{try{c.close()}catch(e){}},4000);
 c.on('open',()=>c.send({t:'ping',ts:t0}));c.on('data',d=>{if(d.t==='pong'){const e=document.getElementById('ping-'+code);if(e)e.textContent=Math.round(performance.now()-t0)+' ms';clearTimeout(kill);c.close()}})}
$('brList').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(!b)return;const code=b.dataset.code;brCb=null;$('browser').classList.add('hidden');$('menu').classList.remove('hidden');joinRoom(code)});
$('brRefresh').onclick=()=>fetchRooms(renderRooms);$('brClose').onclick=()=>{brCb=null;$('browser').classList.add('hidden');$('menu').classList.remove('hidden')};
function quickJoin(){audioInit();menuMsg('Finding a game…');let done=false;fetchRooms(list=>{if(done)return;done=true;brCb=null;pick(list)});setTimeout(()=>{if(!done){done=true;brCb=null;pick([])}},5000);
 function pick(list){const open=list.filter(r=>r.n<r.max&&r.phase!=='roundEnd');if(open.length){const r=open[Math.random()*open.length|0];menuMsg('Joining '+r.host+'…');$('browser').classList.add('hidden');$('menu').classList.remove('hidden');joinRoom(r.code)}
  else{menuMsg('No open games — creating a public one…');$('browser').classList.add('hidden');$('menu').classList.remove('hidden');H.pub=true;createRoom()}}}
$('hubBtn').onclick=()=>enterHub();$('quickBtn').onclick=()=>quickJoin();$('browseBtn').onclick=()=>openBrowser();$('brQuick').onclick=()=>quickJoin();
// boot
try{renderIcons()}catch(e){console.warn('icons',e)}
renderLoadoutMini();resize();requestAnimationFrame(loop);
addEventListener('keydown',e=>{if(e.code==='KeyF'&&inGame&&!paused&&me.alive&&me.reloadT<=0&&VA.inspect<=0&&me.zoomT<.1)VA.inspect=2.6});
addEventListener('keydown',e=>{if(e.code==='KeyE'&&!BC&&!RAIDM(C.mode)&&inGame&&!paused&&doorNear&&e.target.tagName!=='INPUT')doorAct()});
addEventListener('keydown',e=>{if(e.code==='KeyE'&&C.phase==='hub'&&!$('stationBtn').classList.contains('hidden'))useStation($('stationBtn').dataset.k)});
addEventListener('keydown',e=>{if(!RAIDM(C.mode)||!inGame||paused||e.target.tagName==='INPUT')return;if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)raidAction()}else if(e.code==='KeyI'){e.preventDefault();if(!e.repeat)raidPackToggle()}});
// keep keyboard focus inside the active raid dialog
addEventListener('keydown',e=>{if(e.code!=='Tab'||!RC||!RC.modal||RC.final)return;const box=RC.packOn?$('raidPack'):$('raidLoot');if(!box)return;
 const f=[...box.querySelectorAll('button:not([disabled])')].filter(b=>b.offsetParent!==null);if(!f.length)return;
 const i=f.indexOf(document.activeElement);
 if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus()}
 else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
});
{const q=new URLSearchParams(location.search);if(q.get('join')){const jc=q.get('join');setTimeout(()=>joinRoom(jc),300)}else if(q.get('hub'))setTimeout(enterHub,50);else if(q.get('offline'))setTimeout(()=>$('offlineBtn').click(),50)}

// ---- Class Booth: buy a class with 💎 and pick one before a match ----
const CLTH={};function classThumb(k){if(CLTH[k])return CLTH[k];const R=r2();R.setSize(220,300);prevCam.aspect=220/300;prevCam.updateProjectionMatrix();const m=makeCharacter(0x3a7bd5,'',k,undefined,undefined,k);m.userData.tag.visible=false;m.rotation.y=Math.PI+.5;
 animate(m,{speed:0,pitch:0,dist:1},.016);prevScene.add(m);prevCam.position.set(0,1.15,3.4);prevCam.lookAt(0,1.0,0);R.setClearColor(0,0);R.render(prevScene,prevCam);CLTH[k]=R.domElement.toDataURL();prevScene.remove(m);return CLTH[k]}
function openClasses(){audioInit&&audioInit();$('classes').classList.remove('hidden');renderClasses()}
function renderClasses(){$('clDia').textContent=PROG.dia;$('clGrid').innerHTML=PCL_IDS.map(k=>{const c=PCL[k],own=PROG.pcs.includes(k),on=PROG.pc===k;
  return`<div class="clCard${on?' on':''}" data-cl="${k}"><img src="${classThumb(k)}"><b>${c.ic} ${c.n}</b><small>${c.perk}</small>${on?'<button class="pill green" disabled>✓ SELECTED</button>':own?'<button class="pill yellow" data-ca="pick">SELECT</button>':`<button class="pill ${PROG.dia>=c.p?'yellow':'poor'}" data-ca="buy">💎 ${c.p}</button>`}</div>`}).join('');updClassBtn()}
function setClass(k){PROG.pc=k;saveProg();updClassBtn();if(C.hub)hubEquip();if((inGame||!$('lobby').classList.contains('hidden'))&&!C.hub&&roomCode)send({t:'cl',cl:k});if(inGame&&!C.hub)feed(`${PCL[k].n} selected — perk active on next spawn`)}
function updClassBtn(){document.querySelectorAll('.clBtnLbl').forEach(e=>e.textContent=PCL[PROG.pc].ic+' '+PCL[PROG.pc].n)}
$('clClose').onclick=()=>$('classes').classList.add('hidden');
$('clGrid').addEventListener('click',e=>{const b=e.target.closest('[data-ca]');if(!b)return;const k=b.closest('[data-cl]').dataset.cl,c=PCL[k];
 if(b.dataset.ca==='buy'){if(PROG.dia<c.p){b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');SFX.beep&&SFX.beep();return}PROG.dia-=c.p;PROG.pcs.push(k);saveProg();setClass(k);SFX.kill&&SFX.kill();center&&center(`${c.ic} ${c.n} unlocked!`,1400)}
 else setClass(k);renderClasses()});
for(const id of['openClasses','lobClass','pClass'])if($(id))$(id).onclick=openClasses;setTimeout(updClassBtn,0);
// ===================== FRIENDS =====================
// Every save has a friend code (PROG.fr.code). While the game is open, the page registers a presence peer whose id is derived
// from that code (PREFIX+'fr-'+code). Friends connect to it briefly to send requests/accepts/removals and to ask for status
// (menu / hub / lobby / match with mode+map, room code, player count). No backend: unreachable presence = Offline.
const frPid=c=>PREFIX+'fr-'+String(c).replace(/[^A-Z0-9]/g,'');const normCode=c=>{c=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return c.length===8?c.slice(0,4)+'-'+c.slice(4):null};
// Friends live under their OWN storage key (+ a backup key), never inside the wallet, so no other save can overwrite them.
// Every write first re-reads storage and merges (newest entry per friend code wins; removals are kept as tombstones), so a stale
// tab / back-forward-cached page / second window can't wipe newer data.
const FRK='friends',FRB='friends_bak';const CATS=['list','inc','out'];
function frRead(){for(const k of[FRK,FRB]){try{const o=JSON.parse(LS(k)||'null');if(o&&normCode(o.code))return o}catch(e){}}return null}
function frMergeInto(d,s){if(!s)return d;if(normCode(s.code))d.code=s.code;d.rm=d.rm||{};for(const k in(s.rm||{}))d.rm[k]=Math.max(d.rm[k]||0,s.rm[k]);
 const best={};for(const src of[d,s])for(const c of CATS)for(const e of(src[c]||[])){const code=normCode(e.code);if(!code)continue;const t=e.t||0;if(!best[code]||t>best[code].e.t||((t===best[code].e.t)&&CATS.indexOf(c)<CATS.indexOf(best[code].c)))best[code]={c,e:{...e,code,t}}}
 for(const c of CATS)d[c]=[];for(const code in best){const{c,e}=best[code];if((d.rm[code]||0)>=e.t)continue;d[c].push(e)}return d}
const FR=(()=>{let f=frRead();const w=PROG.fr;if(!f){f=w&&normCode(w.code)?{code:w.code,list:(w.list||[]).map(e=>({...e,t:1})),inc:(w.inc||[]).map(e=>({...e,t:1})),out:(w.out||[]).map(e=>({...e,t:1})),rm:{}}:null}
 if(!f){const code=normCode(PROG.frCode)||(()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<8;i++)c+=A[Math.random()*A.length|0];return c.slice(0,4)+'-'+c.slice(4)})();f={code,list:[],inc:[],out:[],rm:{}}}
 frMergeInto(f,{});return f})();
delete PROG.fr;PROG.frCode=FR.code;
let frPeer=null,frStat={},frPollT=null,frOpen=false,frBack=2000;
setTimeout(()=>{frWrite();saveProg()},0);
function frWrite(){const cur=frRead();if(cur&&cur.code!==FR.code&&normCode(cur.code))FR.code=cur.code;frMergeInto(FR,cur);const j=JSON.stringify({v:1,code:FR.code,list:FR.list,inc:FR.inc,out:FR.out,rm:FR.rm,at:Date.now()});LSS(FRK,j);LSS(FRB,j);if(PROG.frCode!==FR.code){PROG.frCode=FR.code;saveProg()}}
function frReload(){frMergeInto(FR,frRead());if(frOpen)renderFriends();updFrBadge()}
const frFind=(arr,c)=>arr.findIndex(f=>f.code===c);const frCat=c=>CATS.find(k=>frFind(FR[k],c)>=0)||null;
// set a friend's state (list / inc / out) or remove (null); saved immediately
function frSet(code,cat,name,extra){frWrite();const old=CATS.map(k=>FR[k][frFind(FR[k],code)]).find(Boolean);for(const k of CATS){const i=frFind(FR[k],code);if(i>=0)FR[k].splice(i,1)}
 const now=Math.max(Date.now(),(old&&old.t||0)+1);if(cat)FR[cat].push({code,name:String(name||old&&old.name||code).slice(0,12),t:now,...(extra||{})});else{FR.rm[code]=now}frWrite();if(frOpen)renderFriends();updFrBadge()}
function frSave(){frWrite();if(frOpen)renderFriends();updFrBadge()}
function frName(){return(LS('name')||$('nameIn').value||'Player').slice(0,12)}
function myStatus(){const lob=!$('lobby').classList.contains('hidden');
 if(C.hub)return{w:'hub',t:'In Hub',join:{hub:1}};
 if(inGame&&roomCode&&roomCode!=='OFFLINE'){const n=Object.values(C.players||{}).filter(q=>!q.bot).length,mx=MODEMAX[C.mode]||MAXP;return{w:'match',t:'In Match',mode:C.mode,map:cur&&cur.def?cur.def.name:'',n,mx,join:n<mx?{room:roomCode}:null}}
 if(inGame)return{w:'practice',t:'Practice vs Bots',mode:C.mode,map:cur&&cur.def?cur.def.name:'',join:null};
 if(lob&&roomCode&&roomCode!=='OFFLINE'){const n=Object.values((isHost?H.players:C.players)||{}).filter(q=>!q.bot).length;return{w:'lobby',t:'In Lobby',n,mx:MAXP,join:n<MAXP?{room:roomCode}:null}}
 return{w:'menu',t:'In Menu',join:null}}
function frServe(){if(frPeer||typeof Peer==='undefined')return;const p=new Peer(frPid(FR.code),{config:ICE,debug:0});frPeer=p;let ok=false;
 const retry=()=>{if(frPeer!==p)return;try{p.destroy()}catch(x){}frPeer=null;const d=frBack;frBack=Math.min(30000,frBack*2);setTimeout(frServe,d)};
 p.on('open',()=>{ok=true;frBack=2000;window.__frOnline=true});
 // id taken (old session not yet expired on the signalling server / another tab) or any other failure -> retry with backoff
 p.on('error',e=>{if(e.type==='unavailable-id'||!ok||['network','server-error','socket-error','socket-closed'].includes(e.type))retry()});
 p.on('disconnected',()=>{setTimeout(()=>{if(frPeer===p&&p.disconnected&&!p.destroyed){try{p.reconnect()}catch(e){retry()}}},1000)});p.on('close',retry);
 p.on('connection',c=>{c.on('data',m=>{if(!m||typeof m!=='object')return;const code=normCode(m.code);if(!code||code===FR.code)return;frReload();const name=String(m.name||'Player').slice(0,12);let r={t:'ok'};const cat=frCat(code);
  if(m.t==='req'){if(cat==='list'||cat==='out'){if(cat==='out')toast(`👥 ${name} is now your friend`);frSet(code,'list',name);r={t:'acc',code:FR.code,name:frName()}}else{if(cat!=='inc'){frSet(code,'inc',name);toast(`👥 Friend request from ${name}`)}r={t:'pend'}}}
  else if(m.t==='acc'){if(cat==='out'||cat==='inc'||cat==='list'){if(cat!=='list')toast(`👥 ${name} accepted — you're friends!`);frSet(code,'list',name)}else if(!(FR.rm[code])){frSet(code,'list',name)}r={t:'ok'}}
  else if(m.t==='dec'){if(cat==='out')frSet(code,null)}
  else if(m.t==='rm'){if(cat){frSet(code,null);delete frStat[code]}}
  else if(m.t==='pinv'||m.t==='pjoin'||m.t==='plv'||m.t==='pst'||m.t==='pdis'||m.t==='pgo'){r=partyMsg(m,code,name,cat)}
  else if(m.t==='st'){r=cat==='list'?{t:'st',name:frName(),s:myStatus()}:{t:'st',s:null,rel:cat==='out'?'req':cat==='inc'?'pend':null}}
  try{c.send(r)}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},400)})})}
function frRevive(){frReload();if(!frPeer||frPeer.destroyed||frPeer.disconnected){if(frPeer&&frPeer.disconnected&&!frPeer.destroyed){try{frPeer.reconnect()}catch(e){}}else{frPeer=null;frBack=2000;frServe()}}frPoll()}
addEventListener('visibilitychange',()=>{if(!document.hidden)frRevive()});addEventListener('pageshow',e=>{if(e.persisted)frRevive()});addEventListener('focus',()=>frReload());
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
// one short request to a friend's presence; resolves with reply or null (offline)
const frNet=()=>{if(!window.__frc||window.__frc.destroyed){window.__frc=new Peer({config:ICE,debug:0});window.__frc.on('error',()=>{});window.__frc.on('disconnected',()=>{try{window.__frc.reconnect()}catch(e){}})}return window.__frc};
function frAsk(code,msg){return new Promise(res=>{let done=false;const fin=v=>{if(done)return;done=true;clearTimeout(to);try{c&&c.close()}catch(e){}res(v)};let c=null;const to=setTimeout(()=>fin(null),msg.t==='st'?9000:15000);
 const go=()=>{c=frNet().connect(frPid(code),{reliable:true,serialization:'json'});c.on('open',()=>c.send({...msg,code:FR.code,name:frName()}));c.on('data',d=>fin(d));c.on('close',()=>fin(null));c.on('error',()=>fin(null))};
 const n=frNet();if(n.open)go();else n.on('open',go)})}
let frBusy=false;
async function frPoll(){if(frBusy)return;frBusy=true;try{frReload();
 // keep re-sending pending requests and accepts until the other side has them
 for(const f of FR.out.slice()){const r=await frAsk(f.code,{t:'req'});if(r&&r.t==='acc'){frSet(f.code,'list',r.name||f.name);toast(`👥 ${r.name||f.name} accepted — you're friends!`)}else if(r){const g=FR.out.find(x=>x.code===f.code);if(g&&!g.del){g.del=1;frSave()}}}
 for(const f of FR.list.filter(f=>f.pendAcc)){const r=await frAsk(f.code,{t:'acc'});if(r){const g=FR.list.find(x=>x.code===f.code);if(g){delete g.pendAcc;frSave()}}}
 await Promise.all(FR.list.map(async f=>{const r=await frAsk(f.code,{t:'st'});frStat[f.code]=r&&r.s?{...r.s,at:Date.now()}:null;if(r&&r.name&&r.name!==f.name){const g=FR.list.find(x=>x.code===f.code);if(g){g.name=r.name;frSave()}}}));
 if(frOpen)renderFriends();updFrBadge()}finally{frBusy=false}}
function frSchedule(){clearTimeout(frPollT);frPollT=setTimeout(async()=>{try{await frPoll()}catch(e){}frSchedule()},frOpen?5000:20000)}
function frAdd(raw){const code=normCode(raw);if(!code)return frMsg('Friend codes look like ABCD-1234');if(code===FR.code)return frMsg("That's your own code 🙂");const cat=frCat(code);if(cat==='list')return frMsg('Already friends ✓');
 if(cat==='inc')return frAccept(code);frSet(code,'out',code);frMsg('📨 Request sent! Saved — it shows as Pending until they accept.');toast('📨 Friend request sent');
 frAsk(code,{t:'req'}).then(r=>{if(r&&r.t==='acc'){frSet(code,'list',r.name||code);frMsg('✅ Added! You are now friends.');toast('✅ Friend added!')}else if(r){const g=FR.out.find(x=>x.code===code);if(g){g.del=1;frSave()}}frPoll()})}
function frAccept(code){const f=FR.inc.find(x=>x.code===code);if(!f)return;frSet(code,'list',f.name,{pendAcc:1});frMsg(`✅ Added ${f.name}!`);toast(`✅ ${f.name} added as a friend`);frAsk(code,{t:'acc'}).then(r=>{if(r){const g=FR.list.find(x=>x.code===code);if(g){delete g.pendAcc;frSave()}}frPoll()})}
function frDecline(code){if(frCat(code)!=='inc')return;frSet(code,null);frAsk(code,{t:'dec'})}
function frRemove(code){if(!frCat(code))return;frSet(code,null);delete frStat[code];frAsk(code,{t:'rm'})}
function frJoin(code){const s=frStat[code];if(!s||!s.join)return;const nl=/[?&]net=local/.test(location.search)?'&net=local':'';
 if(s.join.hub){if(C.hub)return frMsg('You are already in the hub');location.href=hubUrl();return}if(s.join.room){if(inGame||!$('lobby').classList.contains('hidden')){location.href=location.pathname+'?join='+s.join.room+nl}else{closeFriends();joinRoom(s.join.room)}}}
function frMsg(t){const m=$('frMsg');if(m)m.textContent=t}
const MODE_N={duel:'1v1',team:'2v2',t3:'3v3',t4:'4v4',t5:'5v5',ffa:'Free-for-all'};
function stText(s){if(!s)return'<span class="off">● Offline</span>';let t=s.t;if(s.w==='match'||s.w==='practice')t+=` · ${MODE_N[s.mode]||s.mode||''}${s.map?' · '+s.map:''}`;if(s.n)t+=` · ${s.n}/${s.mx}`;return`<span class="on ${s.w}">● ${t}</span>`}
function renderFriends(){$('frCode').textContent=FR.code;$('frMe').textContent=frName();
 const L=FR.list.slice().sort((a,b)=>(frStat[b.code]?1:0)-(frStat[a.code]?1:0));
 $('frList').innerHTML=(L.length?L.map(f=>{const s=frStat[f.code];return`<div class="frRow" data-code="${f.code}"><div class="frWho"><b>${esc(f.name)}</b><small>${f.code}</small></div><div class="frSt">${f.code in frStat?stText(s):'<span class="off">● checking…</span>'}</div>
  <button class="pill ${s&&s.join?'yellow':'poor'}" data-fr="join" ${s&&s.join?'':'disabled'}>${s&&s.join&&s.join.hub?'GO TO HUB':'JOIN'}</button><button class="pill sm" data-fr="party" ${s&&(!PARTY||partyLead())&&!(PARTY&&PARTY.m.some(x=>x.code===f.code))?'':'disabled'} title="Invite to party">➕👥</button><button class="pill red sm" data-fr="rm" title="Remove">✕</button></div>`}).join(''):'<p class="msg">No friends yet — share your code or add theirs.</p>');
 $('frInc').innerHTML=FR.inc.map(f=>`<div class="frRow" data-code="${f.code}"><div class="frWho"><b>${esc(f.name)}</b><small>${f.code}</small></div><span class="frSt">wants to be friends</span><button class="pill green" data-fr="acc">ACCEPT</button><button class="pill red sm" data-fr="dec">DECLINE</button></div>`).join('')+FR.out.map(f=>`<div class="frRow out" data-code="${f.code}"><div class="frWho"><b>${esc(f.name)}</b><small>${f.code}</small></div><span class="frSt">⏳ Pending${f.del?' · delivered':' · sends when they are online'}</span><button class="pill red sm" data-fr="rm">CANCEL</button></div>`).join('');
 $('frReqHead').classList.toggle('hidden',!FR.inc.length&&!FR.out.length)}
function updFrBadge(){const n=FR.inc.length;document.querySelectorAll('.frBadge').forEach(b=>{b.textContent=n||'';b.classList.toggle('hidden',!n)});const on=FR.list.filter(f=>frStat[f.code]).length;document.querySelectorAll('.frOnline').forEach(b=>b.textContent=FR.list.length?`${on}/${FR.list.length} online`:'Add friends by code')}
function openFriends(){audioInit&&audioInit();frOpen=true;$('friends').classList.remove('hidden');renderFriends();frMsg('');frPoll();frSchedule()}
function closeFriends(){frOpen=false;$('friends').classList.add('hidden');frSchedule()}
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.classList.add('out'),2600);setTimeout(()=>el.remove(),3200)}
$('frClose').onclick=closeFriends;$('frAddBtn').onclick=()=>{frAdd($('frIn').value);$('frIn').value=''};$('frIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('frAddBtn').click()});
$('frCopy').onclick=async()=>{try{await navigator.clipboard.writeText(FR.code);frMsg('Code copied!')}catch(e){frMsg('Your code: '+FR.code)}};
$('friends').addEventListener('click',e=>{const b=e.target.closest('[data-fr]');if(!b)return;const code=b.closest('[data-code]').dataset.code;const a=b.dataset.fr;if(a==='join')frJoin(code);else if(a==='party')partyInvite(code);else if(a==='rm')frRemove(code);else if(a==='acc')frAccept(code);else if(a==='dec')frDecline(code)});
for(const id of['openFriends','lobFriends','pFriends','hubFriends'])if($(id))$(id).onclick=openFriends;
addEventListener('storage',e=>{if(e.key===LSP+FRK)frReload()});
setTimeout(()=>{frServe();frSchedule();updFrBadge();if(FR.list.length||FR.out.length)setTimeout(frPoll,1500)},800);
window.__hsz={gg:(id,o)=>gunGroup(id,o),THREE,SFXT:SFX,scene,curDef:()=>cur&&cur.def,curSky:()=>cur&&cur.sky,PCL,openClasses,vmSkin:()=>{let k=null;if(vmCur)vmCur.traverse(o=>{if(o.material&&o.material.userData&&o.material.userData.skin)k=o.material.userData.skin});return k},vmId:()=>me.load[me.cur],FRIENDS:()=>({frPeerOpen:!!(frPeer&&frPeer.open),FR,frStat,myStatus:myStatus(),frPoll,frAdd,frAccept,frRemove,frJoin}),inp,PROG,shootAt:(pid,hy)=>{const q=(H&&H.players[pid])||C.players[pid];if(!q||!me.alive)return 'na';let p=(q.e&&q.e.pos)||q.pos;if(Array.isArray(p))p={x:p[0],y:p[1],z:p[2]};if(!p&&q.p)p={x:q.p[0],y:q.p[1],z:q.p[2]};if(!p||!isFinite(p.x))return 'nopos';const e=new THREE.Vector3(me.pos.x,me.pos.y+1.62,me.pos.z);const dx=p.x-e.x,dy=(p.y+(hy||1.3))-e.y,dz=p.z-e.z;me.yaw=Math.atan2(-dx,-dz);me.pitch=Math.atan2(dy,Math.hypot(dx,dz));camera.position.copy(e);camera.rotation.set(me.pitch,me.yaw,0,'YXZ');camera.updateMatrixWorld();me.cool=0;fire();return 'ok'},gunGroup,THREE,endGo:(a)=>endGo(a),damage:(...a)=>damage(...a),VA,reload,setViewModel,get vmCur(){return vmCur},fireTest:(id)=>{const o=window.__spy;const realSend=send;setViewModel(id);camera.position.set(me.pos.x,me.pos.y+1.62,me.pos.z);camera.rotation.set(me.pitch,me.yaw,0);camera.updateMatrixWorld();__spyOn=o;try{fire()}finally{__spyOn=null}},C,H,me,send,W,MAPS,buildMap,fpsLog,renderer,get isHost(){return isHost},get cols(){return cols},setCols:(c)=>{cols=c},roundSpawns,respawnPoint,switchTo,fire,useUtil,setLoad:(l)=>{me.load=l},toggleZoom,camera,get paused(){return paused},get qLevel(){return qLevel()},S,applyQuality,get cur(){return cur}};
window.__hsz.HQP=HQP;window.__hsz.useUtil=useUtil;window.__hsz.damage=(v,d,by,h,w)=>damage(v,d,by,h,w);window.__hsz.scene=scene;window.__hsz.ffaLeft=()=>ffaLeft();window.__hsz.FXT={SFX,VOX:()=>VOX,AC:()=>AC&&AC.state,explosionFX,utilFX,impact,funFX,nearMiss,fire:()=>fire(),muzzle,fires:()=>fires.length,smokes:()=>smokes.length,flash:()=>flashAmt,setVerb,outdoor:()=>outdoor,vol:()=>mVol&&mVol.gain.value,FL:()=>FL.length,spawnNade};window.__hsz.throwSt=()=>({th:!!TH,t:TH&&TH.t,nades:nades.length,spoons:spoons.length,pin:!!(TH&&TH.G.pin),throws:window.__throws||0});

// ---- fullscreen: Fullscreen API where it exists (Android Chrome, iPad Safari, desktop); iPhone Safari gets an Add-to-Home-Screen guide
const FS={api:!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen),
 standalone:matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,
 iphone:/iPhone|iPod/.test(navigator.userAgent),off:LS('fsOff')==='1'};
const isFS=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function goFS(force){if(FS.iphone||FS.standalone||isFS()||!FS.api||(FS.off&&!force))return;if(!force&&!isTouch&&!inGame)return;const d=document.documentElement;
 try{const r=(d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):d.webkitRequestFullscreen());Promise.resolve(r).then(()=>{try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{})}catch(e){}}).catch(()=>{})}catch(e){}}
window.__hsz.FS=FS;window.__hsz.goFS=goFS;
addEventListener('pointerup',e=>{if(isTouch)goFS()},{capture:true});
for(const id of['playBtn','offlineBtn','hubBtn','startBtn'])$(id)?.addEventListener('click',()=>goFS(true));
{const row=$('pResume')?.parentElement;if(row&&FS.api&&!FS.standalone){const b=document.createElement('button');b.id='pFull';b.className='pill';const lab=()=>b.textContent=isFS()?'🗗 EXIT FULL':'⛶ FULLSCREEN';lab();
 b.onclick=()=>{if(isFS()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);FS.off=true;LSS('fsOff','1')}else{FS.off=false;LSS('fsOff','0');goFS(true)}};
 for(const ev of['fullscreenchange','webkitfullscreenchange'])document.addEventListener(ev,()=>{lab();setTimeout(resize,100)});row.insertBefore(b,$('pLeave'))}}
if(FS.iphone&&!FS.standalone&&LS('a2hs')!=='1'){const o=document.createElement('div');o.id='a2hs';o.innerHTML=`<div class="a2card"><h2>📲 Play full screen!</h2>
<p>iPhone Safari keeps its bars on screen. Add HeadShotz to your Home Screen to play with no bars:</p>
<ol><li><span class="a2i">⬆️</span><span>Tap the <b>Share</b> button (square with an arrow) in Safari's toolbar</span></li><li><span class="a2i">➕</span><span>Scroll and tap <b>Add to Home Screen</b></span></li><li><span class="a2i">🎯</span><span>Open <b>HeadShotz</b> from your Home Screen</span></li></ol>
<div class="row"><button class="pill yellow" id="a2ok">GOT IT</button><button class="pill" id="a2skip">PLAY IN SAFARI</button></div><label><input type="checkbox" id="a2never" checked> Don't show again</label></div>`;
 document.body.appendChild(o);const close=e=>{e&&e.preventDefault();e&&e.stopPropagation();if($('a2never').checked)LSS('a2hs','1');o.style.opacity='0';o.style.transition='opacity .25s';setTimeout(()=>o.remove(),450)};$('a2ok').onclick=close;$('a2skip').onclick=close}

// ---- down & revive UI: downed overlay, reviver ring, world markers over downed teammates
function updDown(){let o=$('downOv');if(!o){o=document.createElement('div');o.id='downOv';o.innerHTML='<div class="dvT">DOWNED</div><div class="dvS">Waiting for teammate…</div><div class="dvR"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" class="bg"/><circle cx="20" cy="20" r="17" class="fg" id="dvFg"/></svg><b id="dvN">20</b></div>';document.body.appendChild(o)}
 o.classList.toggle('on',!!(me.down&&inGame));if(!me.down)return;const d=me.dst||{left:DOWN.bleed,rv:0};$('dvN').textContent=Math.ceil(d.left);$('dvFg').style.strokeDashoffset=(106.8*(1-(d.rv||0))).toFixed(1);o.querySelector('.dvS').textContent=d.rv>0?'Being revived…':'Waiting for teammate…';o.classList.toggle('rev',d.rv>0)}
const _mk={};const _mv=new THREE.Vector3();
function updDownMarkers(){if(!inGame){for(const k in _mk)_mk[k].style.display='none';return}const myT=C.players[me.id]?.team;let ring=0;
 for(const id in C.players){const q=C.players[id];let el=_mk[id];const show=q.down&&q.alive&&id!==me.id&&q.team===myT&&isTeamMode(C.mode);
  if(!show){if(el)el.style.display='none';continue}
  if(!el){el=_mk[id]=document.createElement('div');el.className='dmk';el.innerHTML='<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg"/></svg><span>✚</span>';document.body.appendChild(el)}
  _mv.set(q.rp.x,q.rp.y+1.1,q.rp.z).project(camera);if(_mv.z>1){el.style.display='none';continue}el.style.display='block';el.style.left=((_mv.x+1)/2*innerWidth)+'px';el.style.top=((1-_mv.y)/2*innerHeight)+'px';
  const rv=q.dst?q.dst.rv:0;el.querySelector('.fg').style.strokeDashoffset=(100.5*(1-rv)).toFixed(1);if(q.dst&&q.dst.by===me.id&&rv>0)ring=rv}
 let hr=$('revHud');if(!hr){hr=document.createElement('div');hr.id='revHud';hr.innerHTML='<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" class="bg"/><circle cx="20" cy="20" r="17" class="fg"/></svg><b>REVIVING</b>';document.body.appendChild(hr)}
 hr.classList.toggle('on',ring>0);if(ring>0)hr.querySelector('.fg').style.strokeDashoffset=(106.8*(1-ring)).toFixed(1)}
setInterval(()=>{if(me.down)updDown();updDownMarkers()},50);

// paint splats (paintball): coloured blobs on walls/players, shooter's colour or random
const PAINT=[0xff4fd8,0x2ee59d,0xffd23f,0x3fa9ff,0xff6a3d,0xa66bff];
function paintSplat(p,n,owner){const q=C.players[owner];const col=Math.random()<.5&&q?q.color:PAINT[Math.random()*PAINT.length|0];const pp=p.clone();if(n)pp.addScaledVector(n,.03);
 fx.sprite({p:pp,s0:.32,s1:.42,life:9,op:.95,color:col});for(let i=0;i<3;i++)fx.sprite({p:pp.clone().add(_v2.set((Math.random()-.5)*.35,(Math.random()-.5)*.35,(Math.random()-.5)*.35)),s0:.12,s1:.16,life:9,op:.9,color:col});if(camera.position.distanceTo(p)<25)SFX.click(900+Math.random()*400,.05)}
function frost(d){let o=$('frost');if(!o){o=document.createElement('div');o.id='frost';document.body.appendChild(o)}o.classList.add('on');clearTimeout(o._t);o._t=setTimeout(()=>o.classList.remove('on'),d*1000)}
setInterval(()=>{if(hubConn&&hubConn.open&&!hubConn.local)hubSend({t:'ka'})},2000);

// ---- lazy HD asset load (CC0, see ASSETS.md / Credits) ----
setTimeout(()=>{const bar=$('assetBar');const skipA=qLevel()==='low'||/noassets/.test(location.search),skipH=/nohum/.test(location.search);if(skipA&&skipH)return;if(bar)bar.classList.remove('hidden');const t0=performance.now();
 let fa=skipA?1:0,fh=skipH?1:0,left=(skipA?0:1)+(skipH?0:1);const upd=()=>{if(bar)bar.querySelector('i').style.width=Math.round((fa+fh)/2*100)+'%'},fin=()=>{if(--left<=0&&bar)bar.classList.add('hidden')};
 if(!skipH)loadHumans(f=>{fh=f;upd()}).then(ok=>{window.__humans={ok,ms:HUM.ms,tier:HUM.tier};if(ok)swapCharModels();fin()});
 if(!skipA)loadAssets((f)=>{fa=f;upd()}).then(ok=>{fin();window.__assets={ok,ms:Math.round(performance.now()-t0),ready:HQP.ready};for(const k in envCache)delete envCache[k];if(HQP.ready){const ids=rebuildForProps();window.__propSwap=ids;if(cur&&!C.hub&&ids.includes(C.map)){const nm=buildMap(C.map);scene.remove(cur.group);scene.add(nm.group);cur.group=nm.group;cur.hqProps=true;window.__propSwapLive=1}}if(HQP.guns&&Object.keys(HQP.guns).length){try{clearPhotoCache();for(const k in TPG)delete TPG[k];for(const k in heldTpl)delete heldTpl[k];resetVMs();renderIcons()}catch(e){console.warn('photo guns',e)}}if(cur)applyQuality()})},+(new URLSearchParams(location.search).get('assetdelay')||400));
$('openCredits').onclick=()=>$('credits').classList.remove('hidden');$('credClose').onclick=()=>$('credits').classList.add('hidden');

// ---- solo on the hub FFA pad: choose online (public, bots, friends/pad can join) or offline bots ----
function openSolo(){if(!C.hub)return;SFX.beep(880);$('soloSel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock()}
$('soloOn').onclick=()=>{$('soloSel').classList.add('hidden');startHubMatch({code:genCode(),map:Math.random()*5|0,mode:'ffa',teams:{},expect:1,solo:1,host:hubSelfId})};
$('soloOff').onclick=()=>{$('soloSel').classList.add('hidden');hubUnlink();leaveHubWorld();C.fromHub=true;sessionStorage.setItem('hsz_fromHub','1');startOffline();H.mode='ffa';H.auto={mode:'ffa',map:Math.random()*5|0,expect:1,fromHub:1};H.autoAt=H.t+.5;sendLobby()};
$('soloX').onclick=()=>$('soloSel').classList.add('hidden');
Object.defineProperty(window.__hsz,'room',{get:()=>({code:roomCode,inGame,offline:!!(H&&H.offline),pub:!!(H&&H.pub),host:isHost})});

// ---- Play Online with Bots (menu + hub): host a public, bot-filled match; joiners replace a bot (team modes: on the team that needs them) ----
// setup state is remembered; every open rebuilds the whole screen from scratch so nothing can be left over from an earlier game
const POB_MODES=['ffa','team','t3','t4','t5','duel','ctf','ext','br','brs'];let POB={mode:'team',map:-1,diff:'normal',pub:true},pobBusy=false;
try{const s=JSON.parse(LS('pob')||'null');if(s)POB=Object.assign(POB,s)}catch(e){}
function pobSum(){const mp=BRM(POB.mode)?BR_INFO.icon+' '+BR_INFO.name:POB.map<0?'🎲 random map':MAPS[POB.map].icon+' '+MAPS[POB.map].name;$('pobSum').textContent=`${MODES[POB.mode][1]} ${MODES[POB.mode][0]} · ${mp} · bots ${POB.diff.toUpperCase()} · ${POB.pub?'🌐 public':'🔒 private (join by code)'}`}
function renderPob(){if(!MODES[POB.mode])POB.mode='team';if(POB.map>=MAPS.length)POB.map=-1;
 $('pobModes').innerHTML=POB_MODES.filter(k=>MODES[k]).map(k=>`<button data-pm="${k}" class="${POB.mode===k?'sel':''}">${MODES[k][1]} ${MODES[k][0]}</button>`).join('');
 $('pobMaps').innerHTML=`<button data-pmap="-1" class="${POB.map<0?'sel':''}">🎲 Random</button>`+MAPS.map((m,i)=>`<button data-pmap="${i}" class="${POB.map===i?'sel':''}" style="${THUMB[i]?`background-image:linear-gradient(#0006,#000a),url(${THUMB[i]})`:''}">${m.icon} ${m.name}</button>`).join('');
 {const bm=BRM(POB.mode);$('pobMaps').style.display=bm?'none':'';if($('pobMaps').previousElementSibling)$('pobMaps').previousElementSibling.style.display=bm?'none':''}
 $('pobDiff').innerHTML=['easy','normal','hard'].map(d=>`<button data-pd="${d}" class="${POB.diff===d?'sel':''}">${d.toUpperCase()}</button>`).join('');
 $('pobPub').innerHTML=`<button data-pp="1" class="${POB.pub?'sel':''}">🌐 PUBLIC</button><button data-pp="0" class="${POB.pub?'':'sel'}">🔒 PRIVATE</button>`;pobSum();$('pobGo').disabled=false}
function openPob(){audioInit();pobBusy=false;renderPob();$('pobSel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();if(Object.keys(THUMB).length<MAPS.length&&!C.hub)setTimeout(()=>{if(!$('pobSel').classList.contains('hidden'))renderThumbs(()=>renderPob())},300)}
function closePob(){$('pobSel').classList.add('hidden')}
function playOnlineBots(mode,opts){if(pobBusy)return;pobBusy=true;closePob();if(mode)POB.mode=mode;if(opts)Object.assign(POB,opts);LSS('pob',JSON.stringify(POB));
 const map=BRM(POB.mode)?BR_I:POB.map<0?Math.random()*MAPS.length|0:POB.map;const pn=PARTY&&partyLead()?PARTY.m.length:1;const auto={mode:POB.mode,map,diff:POB.diff,pub:POB.pub,teams:{},expect:pn,solo:pn>1?0:1};const code=genCode();window.__lastPob={...auto,code};
 if(C.hub){startHubMatch({code,map,mode:POB.mode,teams:{},expect:1,solo:1,diff:POB.diff,pub:POB.pub,host:hubSelfId});return}
 $('menu').classList.add('hidden');createRoom(code,auto)}
$('pobSel').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
 if(t.dataset.pm){POB.mode=t.dataset.pm}else if(t.dataset.pmap!=null){POB.map=+t.dataset.pmap}else if(t.dataset.pd){POB.diff=t.dataset.pd}else if(t.dataset.pp!=null){POB.pub=t.dataset.pp==='1'}else return;LSS('pob',JSON.stringify(POB));const cid=t.parentElement&&t.parentElement.id;renderPob();const s=cid&&$(cid)&&$(cid).querySelector('.sel');if(s&&s.scrollIntoView)try{s.scrollIntoView({block:'nearest',inline:'nearest'})}catch(x){}});
$('pobGo').onclick=()=>playOnlineBots();
$('pobBtn').onclick=openPob;$('hubPob').onclick=openPob;$('pobX').onclick=closePob;$('roomTag').onclick=()=>{const b=$('shareBtn');if(b)b.click()};
window.__hsz.playOnlineBots=playOnlineBots;window.__hsz.POB=()=>POB;

// realistic humans arrived after some characters were built: rebuild remote players + hub NPCs with the new models
function swapCharModels(){for(const id in C.players){const q=C.players[id];if(!q.model||id===me.id||q.model.userData.kind==='hum')continue;const a=q.model.userData.args;if(!a)continue;const vis=q.model.visible,dead=q.model.userData.dead;scene.remove(q.model);q.model=makeCharacter(...a);q.model.visible=vis;q.model.userData.dead=dead;scene.add(q.model);q.gunId=null;if(q.wid!=null)setRemoteGun(q,q.wid)}
 if(hubVis&&hubVis.npcs)for(const n of hubVis.npcs){if(n.m.userData.kind==='hum'||!n.m.userData.args)continue;const p=n.m.parent,nm=makeCharacter(...n.m.userData.args);nm.position.copy(n.m.position);nm.rotation.copy(n.m.rotation);p.remove(n.m);p.add(nm);n.m=nm}
 for(const k in CLTH)delete CLTH[k];window.__humSwap=(window.__humSwap||0)+1}
window.__hsz.HUM=HUM;
addEventListener('blur',()=>{inp.slideHold=false});
// ---------------- v41 CHEST SHOP (diamonds only) ----------------
const CHEST={price:300,tiers:[['common','Common','#9aa3ad',45],['rare','Rare','#3b8bff',27],['epic','Epic','#a64dff',15],['legendary','Legendary','#ffc21a',8],['secret','Secret','#ff2b2b',5]],
 // loot: [type,id|amount,weight]; higher tiers hold rarer items. Duplicates convert to diamonds (DUPE per tier).
 loot:{common:[['pet','dog',1.3],['pet','cat',1.3],['pet','bunny',1.2],['dia',80,4],['dia',120,3],['wsk','carbon',2],['wsk','tiger',2],['wpn','water',1],['wpn','bat',1],['skin','sky',1.5],['skin','sunset',1.5],['skin','lemon',1.5],['skin','forest',1.2],['skin','ocean',1.2]],
  rare:[['pet','bat',1.3],['pet','fox',1.3],['pet','penguin',1.3],['dia',200,3],['wsk','ice',2],['wsk','toxic',2],['wsk','neon',2],['wpn','m4',1],['wpn','mp5',1],['wpn','ump45',1],['wpn','pan',1],['cls','scout',1],['skin','rose',1.5],['skin','steel',1.5],['skin','jungle',1.3],['skin','tiger',1.3],['skin','ranger',1.2],['skin','cherry',1.2]],
  epic:[['pet','bear',1.4],['pet','tiger',1.4],['pet','hedgehog',1.4],['dia',350,2],['wsk','gold',2],['wsk','lightning',1],['wpn','ak47',1],['wpn','scar',1],['wpn','kriss',1],['wpn','p90',1],['wpn','deagle',1],['cls','engineer',1],['cls','ninja',1],['skin','moonmage',1.4],['skin','viking',1.4],['skin','samurai',1.4],['skin','pirate',1.2],['skin','cyber',1.2],['skin','ronin',1.2]],
  legendary:[['pet','lion',1.4],['pet','superdog',1.4],['pet','twohead',1.3],['pet','robot',1.3],['dia',600,2],['wsk','lightning',2],['wsk','fire',2],['wpn','aa12',1],['wpn','lmg',1],['wpn','freeze',1],['wpn','laser',1],['wpn','barrett',1],['wpn','chainsaw',1],['cls','medic',2],['wsk','galaxy_blue',1.3],['wsk','galaxy_red',1.3],['skin','gxv',1.3],['skin','gxb',1.3],['skin','galaxy',1.6],['skin','gladiator',1.6],['skin','inferno',1.4],['skin','candy',1.4],['skin','starpilot',1.2]],
  secret:[['pet','ghost',2.2],['pet','dragon',2.2],['pet','superdog',1.4],['dia',1200,1],['wsk','galaxy',3],['wsk','galaxy_blue',2.2],['wsk','galaxy_red',2.2],['wsk','galaxy_gold',1.8],['skin','gxv',2.2],['skin','gxb',2.2],['skin','gxr',2.2],['skin','gxg',1.6],['wsk','fire',2],['wsk','lightning',2],['cls','juggernaut',3],['skin','dragon',2.5],['skin','aurora',2.5],['skin','void',2],['skin','solar',2],['wpn','minigun',1.5],['wpn','awp',1.5],['wpn','rpg',1.5],['wpn','gl',1.5]]},
 dupe:{common:40,rare:90,epic:160,legendary:280,secret:500}};
function chestTier(r=Math.random()){let a=0;for(const t of CHEST.tiers){a+=t[3]/100;if(r<a)return t[0]}return 'common'}
function chestPick(tier,r=Math.random()){const L=CHEST.loot[tier];const tot=L.reduce((s,x)=>s+x[2],0);let a=0;for(const x of L){a+=x[2]/tot;if(r<a)return x}return L[L.length-1]}
const ownedWeapons=()=>Object.keys(W).filter(id=>W[id].cls!=='util'&&owns(id));
// apply one loot item to the shared wallet (PROG, same save offline + online); returns a description
function chestGrant(tier,it){const [ty,v]=it;let dup=false,name='',icon='💎',dia=0;
 if(ty==='dia'){dia=v;name=v+' Diamonds'}
 else if(ty==='wpn'){if(!W[v]){dia=CHEST.dupe[tier];name='Bonus'}else{name=W[v].name;icon='🔫';if(owns(v))dup=true;else PROG.owned.push(v)}}
 else if(ty==='cls'){name=PCL[v].n+' class';icon=PCL[v].ic||'🎭';if(PROG.pcs.includes(v))dup=true;else PROG.pcs.push(v)}
 else if(ty==='pet'){const d=SK_BY[v];if(!d){dia=CHEST.dupe[tier];name='Bonus'}else{name=d.name+' the '+d.kind;icon='🐾';if(PROG.pets.includes(v))dup=true;else PROG.pets.push(v)}}
 else if(ty==='skin'){const d=SKIN_BY[v];if(!d){dia=CHEST.dupe[tier];name='Bonus'}else{name=d.name+' outfit';icon='👕';if(PROG.skins.includes(v))dup=true;else PROG.skins.push(v)}}
 else if(ty==='wsk'){const sk=WSKINS[v];name=(sk?sk[0]:v)+' skin';icon='🎨';const cand=ownedWeapons().filter(id=>!(PROG.wskins[id]||[]).includes(v));
  const pref=cand.includes(me.load[0])?me.load[0]:cand[Math.floor(Math.random()*cand.length)];if(!pref)dup=true;else{(PROG.wskins[pref]=PROG.wskins[pref]||[]).push(v);name+=' · '+W[pref].name;it.w=pref}}
 if(dup)dia=CHEST.dupe[tier];PROG.dia+=dia;(PROG.chestLog=PROG.chestLog||[]).push([tier,ty,v,dup?1:0,Date.now()]);if(PROG.chestLog.length>50)PROG.chestLog.shift();saveProg();
 return {tier,ty,v,name,icon,dup,dia}}
window.__hsz.chestGrant=chestGrant;window.__hsz.CHEST=CHEST;
function chestBuy(r1,r2){if(PROG.dia<CHEST.price)return null;PROG.dia-=CHEST.price;const t=chestTier(r1);return chestGrant(t,chestPick(t,r2))}
// sounds per tier (Web Audio, same synth as the rest)
const chestSFX=(tier)=>{const d=out();if(!d)return;const i=['common','rare','epic','legendary','secret'].indexOf(tier);const base=[523,587,659,698,440][i];
 if(tier==='secret'){tone(55,1.6,.35,'sawtooth',38,d,.05);noise('lowpass',300,.7,1.4,.4,d,.4,.2);setTimeout(()=>{noise('highpass',2500,.7,.25,.6,d,.6,.001);tone(110,.9,.3,'square',55,d,.001)},900);
  [0,4,7,12,16,19].forEach((s,k)=>setTimeout(()=>tone(220*Math.pow(2,s/12),1.2,.12,'sawtooth',0,d,.02),1100+k*90));setTimeout(()=>tone(1760,1.1,.12,'sine',0,d,.01),1700)}
 else{const n=2+i;for(let k=0;k<n;k++)setTimeout(()=>tone(base*Math.pow(2,[0,4,7,12,16][k]/12),.25+.08*i,.16,'triangle',0,d,.005),k*(110-i*10));if(i>=2)setTimeout(()=>noise('highpass',4000,.7,.4,.25,d,.3,.01),n*90);if(i>=3)setTimeout(()=>tone(base*4,.9,.1,'sine',0,d,.01),n*100)}};
function chestRollSFX(){const d=out();if(!d)return;for(let k=0;k<8;k++)setTimeout(()=>noise('bandpass',700+k*120,4,.05,.18,d,0,.001),k*120)}
let chestBusy=false;
function openChests(){audioInit&&audioInit();$('chests').classList.remove('hidden');renderChests()}
function renderChests(){$('chDia').textContent=PROG.dia;const tot=CHEST.tiers.reduce((s,t)=>s+t[3],0);
 $('chOdds').innerHTML=CHEST.tiers.map(t=>`<div class="odd" style="--c:${t[2]}"><i></i><b>${t[1]}</b><span>${t[3]}%</span><small>${CHEST.loot[t[0]].filter(x=>x[0]!=='dia').slice(0,4).map(x=>x[0]==='wpn'?W[x[1]]?.name:x[0]==='cls'?PCL[x[1]].n:x[0]==='skin'?(SKIN_BY[x[1]]||{name:x[1]}).name:(WSKINS[x[1]]||[x[1]])[0]).join(' · ')}…</small></div>`).join('')+`<p class="msg">Odds total ${tot}%. Duplicates turn into diamonds. Diamonds only — no real money.</p>`;
 const b=$('chBuy');b.disabled=chestBusy||PROG.dia<CHEST.price;b.textContent=PROG.dia<CHEST.price?`NEED 💎 ${CHEST.price}`:`OPEN CHEST · 💎 ${CHEST.price}`}
function chestAnim(res){const st=$('chStage'),c=CHEST.tiers.find(t=>t[0]===res.tier);chestBusy=true;renderChests();st.className='go';st.style.setProperty('--c',c[2]);st.innerHTML=`<div class="rays"></div><div class="box"><div class="lid"></div><div class="body"></div></div><div class="res hidden"></div>`;
 chestRollSFX();const secret=res.tier==='secret',dl=secret?2300:1150;st.classList.add('t-'+res.tier);if(secret)document.body.classList.add('chSecret');
 setTimeout(()=>{st.classList.add('open');chestSFX(res.tier);const r=st.querySelector('.res');r.classList.remove('hidden');r.innerHTML=`<em>${c[1].toUpperCase()}${secret?' !!!':''}</em><div class="it">${res.icon}</div><b>${res.name}</b>${res.dup?`<small>Duplicate → +${res.dia} 💎</small>`:res.ty==='dia'?'':'<small>NEW! Added to your collection</small>'}`;
  setTimeout(()=>{chestBusy=false;document.body.classList.remove('chSecret');renderChests()},secret?1400:600)},dl)}
$('chBuy').onclick=()=>{if(chestBusy)return;const r=chestBuy(window.__chestR1,window.__chestR2);window.__chestR1=window.__chestR2=undefined;if(!r){SFX.beep&&SFX.beep();return}window.__lastChest=r;chestAnim(r)};
if($('openChests'))$('openChests').onclick=openChests;
$('chClose').onclick=()=>$('chests').classList.add('hidden');
// weekend banners: menu, hub HUD and end screen
function updWknd(){const on=isWknd();for(const e of document.querySelectorAll('.wkBan'))e.classList.toggle('hidden',!on||(e.id==='wkHud'&&!(cur&&cur.def&&cur.def.hub)))}
setInterval(updWknd,1000);updWknd();
Object.assign(window.__hsz,{CHEST,chestTier,chestPick,chestGrant,chestBuy,openChests,chestAnim,endMatchTest:(win)=>{if(!isHost)return false;H.score[win]=WIN_ROUNDS-1;H.phase='play';endRound(win);return true},hostDecide,ECON,PROG,isWknd,addDia:(...a)=>addDia(...a)});

// ================= v42 MISSION MODES: Capture the Flag + Extraction (host side) =================
const MISSION=m=>m==='ctf'||m==='ext';
const CTF={goal:3,time:600,resp:5,pick:1.8,cap:2.4,ret:20,prot:2.5};
const EXT={time:420,n:3,need:2,callT:60,window:50,reinf:3,zone:7.5,maxRaid:7,garrison:1,call:240};
const hd2=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
function baseOf(m,team){const L=team==='A'?m.spawnsA:m.spawnsB;let cx=0,cz=0;for(const s of L){cx+=s[0];cz+=s[1]}cx/=L.length;cz/=L.length;let best=L[0],bd=1e9;for(const s of L){const d=Math.hypot(s[0]-cx,s[1]-cz);if(d<bd){bd=d;best=s}}return[best[0],0,best[1]]}
const mkFlag=h=>({st:'home',home:h,pos:h.slice(),car:null,t:0});
function missionPrep(){const m=buildMap(H.map);H.score={};if(H.mode==='ext')for(const p of plist()){p.team='A';p.color=TEAMCOL.A}
 for(const p of plist()){p.flag=null;p.drive=null;p.caps=0}
 for(const p of plist())if(p.raider){delete H.players[p.id]}
 if(H.mode==='ctf'){H.ctf={caps:{A:0,B:0},f:{A:mkFlag(baseOf(m,'A')),B:mkFlag(baseOf(m,'B'))},defPts:{}};H.score={A:0,B:0};
  for(const T of['A','B']){const h=H.ctf.f[T].home;H.ctf.defPts[T]=(m.nav||[]).filter(n=>Math.hypot(n[0]-h[0],n[1]-h[2])<16&&(n[2]||0)<1.5).map(n=>[n[0],0,n[1]])}}
 else extPrep(m)}
function extPrep(m){const lz=baseOf(m,'A');const cand=[...(m.nav||[]).filter(n=>(n[2]||0)<1.2).map(n=>[n[0],0,n[1]]),...(m.spawnsB||[]).map(s=>[s[0],0,s[1]]),...(m.spawnsM||[]).map(s=>[s[0],0,s[1]])].filter(c=>hd2(c,lz)>28);
 const ch=[];if(cand.length){cand.sort((a,b)=>hd2(b,lz)-hd2(a,lz));ch.push(cand[0]);while(ch.length<EXT.n){let best=null,bs=-1;for(const c of cand){const d=Math.min(...ch.map(x=>hd2(x,c)));if(d>bs){bs=d;best=c}}if(!best||bs<8)break;ch.push(best)}}
 while(ch.length<EXT.n)ch.push([lz[0]+30+ch.length*6,0,lz[2]]);
 H.ext={ph:'search',t0:0,lz,d:ch.map((h,i)=>({id:i,st:'home',home:h,pos:h.slice(),car:null})),sec:0,callAt:0,landAt:0,departAt:0,reinf:EXT.reinf,wave:0,nextWave:0,cand,res:null};H.score={};
 ch.forEach((h,i)=>{for(let k=0;k<EXT.garrison;k++)addRaider(i)})}
let raiderN=0;
function addRaider(post,hunt){const id='bot'+(++H.botN);const b=H.players[id]=newP(id,'Raider'+(++raiderN),true);b.raider=1;b.team='B';b.color=TEAMCOL.B;b.cl=PCL_IDS[Math.random()*PCL_IDS.length|0];b.gun=BOTGUNS[(Math.random()*BOTGUNS.length)|0];b.post=post;b.hunt=hunt?1:0;return b}
function raiderSpot(b){const m=buildMap(H.map),E=H.ext;if(b.hunt||b.post==null){const ops=plist().filter(q=>q.team==='A'&&q.alive);const pts=(m.spawnsB||[]).map(s=>[s[0],s[1]]);return farthest(pts.length?pts:allSpawns(m),ops.map(q=>[q.p[0],q.p[2]]))}
 const d=E.d[b.post];const near=E.cand.filter(c=>hd2(c,d.home)>2.5&&hd2(c,d.home)<14).sort((a,c)=>hd2(a,d.home)-hd2(c,d.home));const c=near[Math.random()*Math.min(3,near.length)|0]||d.home;return[c[0],c[2]]}
function missionSpawns(){const m=buildMap(H.map);const out={};
 if(H.mode==='ctf'){for(const T of['A','B']){const L=(T==='A'?m.spawnsA:m.spawnsB);const h=H.ctf.f[T].home;const near=L.slice().sort((a,b)=>Math.hypot(a[0]-h[0],a[1]-h[2])-Math.hypot(b[0]-h[0],b[1]-h[2]));plist().filter(p=>p.team===T).forEach((p,i)=>{const s=near[i%near.length];out[p.id]=[s[0],s[1],faceCenter(s)]})}}
 else{const L=m.spawnsA.slice().sort((a,b)=>Math.hypot(a[0]-H.ext.lz[0],a[1]-H.ext.lz[2])-Math.hypot(b[0]-H.ext.lz[0],b[1]-H.ext.lz[2]));let i=0;for(const p of plist()){if(p.raider){const s=raiderSpot(p);out[p.id]=[s[0],s[1],faceCenter(s)]}else{const s=L[i++%L.length];out[p.id]=[s[0],s[1],faceCenter(s)]}}}
 return out}
function mState(){if(H.mode==='ctf'){const f=H.ctf.f;const o=T=>[f[T].st,f[T].car,+f[T].pos[0].toFixed(1),+f[T].pos[1].toFixed(1),+f[T].pos[2].toFixed(1)];return{m:'ctf',c:H.ctf.caps,f:{A:o('A'),B:o('B')},left:Math.max(0,Math.round(H.roundEnd-H.t))}}
 const E=H.ext;return{m:'ext',ph:E.ph,sec:E.sec,reinf:E.reinf,wave:E.wave,left:Math.max(0,Math.round(H.roundEnd-H.t)),cl:E.ph==='called'?Math.max(0,Math.round(E.landAt-H.t)):E.ph==='extract'||E.ph==='leaving'?Math.max(0,Math.round(E.departAt-H.t)):0,d:E.d.map(d=>[d.st,d.car,+d.pos[0].toFixed(1),+d.pos[1].toFixed(1),+d.pos[2].toFixed(1)]),lz:E.lz}}
function mInfo(){const s=mState();if(H.mode==='ctf'){s.home={A:H.ctf.f.A.home,B:H.ctf.f.B.home}}else{s.home=H.ext.d.map(d=>d.home)}return s}
function mEv(k,o){bcast(Object.assign({t:'mev',k},o||{}))}
function mSync(){bcast({t:'ms',s:mState()})}
function respawnDelay(v){if(RAIDM(H.mode))return 0;if(BRM(H.mode))return 0;if(H.mode==='ffa')return 2.5;if(H.mode==='ctf')return CTF.resp;if(H.mode==='ext'){if(v.raider)return Math.max(10,22-H.ext.wave*2);if(H.ext.reinf>0){H.ext.reinf--;return 16}}return 0}
// --- CTF ---
function ctfTake(T,p){const F=H.ctf.f[T];F.st='carried';F.car=p.id;p.flag=T;mEv('take',{team:T,by:p.id});mSync()}
function ctfDrop(T,why){const F=H.ctf.f[T];const c=H.players[F.car];if(c)c.flag=null;F.st='dropped';F.car=null;F.t=H.t;mEv('drop',{team:T,by:c&&c.id,why});mSync()}
function ctfReturn(T,by){const F=H.ctf.f[T];F.st='home';F.pos=F.home.slice();F.car=null;if(by)by.pts+=20;mEv('return',{team:T,by:by&&by.id});mSync()}
function ctfCapture(T,c){const F=H.ctf.f[T];c.flag=null;F.st='home';F.pos=F.home.slice();F.car=null;H.ctf.caps[c.team]++;H.score[c.team]=H.ctf.caps[c.team];c.pts+=200;c.caps=(c.caps||0)+1;mEv('cap',{team:c.team,by:c.id,caps:H.ctf.caps});mSync();sendSB();
 if(H.ctf.caps[c.team]>=CTF.goal)endMission(c.team,'FLAG CAPTURED ×'+CTF.goal,H.ctf.caps.A+' – '+H.ctf.caps.B)}
function ctfTick(dt){for(const T of['A','B']){const F=H.ctf.f[T],O=T==='A'?'B':'A';
  if(F.st==='carried'){const c=H.players[F.car];if(!c||!c.alive||c.down||c.team===T){ctfDrop(T,'death');continue}F.pos=[c.p[0],c.p[1],c.p[2]];const OF=H.ctf.f[O];if(OF.st==='home'&&hd2(c.p,OF.home)<(c.bot?4.6:CTF.cap)&&Math.abs(c.p[1]-OF.home[1])<(c.bot?3.6:2.5))ctfCapture(T,c)}
  else{for(const p of plist()){if(!p.alive||p.down||p.hp<=0)continue;if(hd2(p.p,F.pos)>CTF.pick||Math.abs(p.p[1]-F.pos[1])>(p.bot?3.4:2.4))continue;if(p.team===T){if(F.st==='dropped'){ctfReturn(T,p);break}}else{ctfTake(T,p);break}}
   if(F.st==='dropped'&&H.t-F.t>CTF.ret)ctfReturn(T,null)}}}
function ctfTimeUp(){const c=H.ctf.caps;if(c.A!==c.B)endMission(c.A>c.B?'A':'B','TIME UP',c.A+' – '+c.B);else if(!H.ctf.sd){H.ctf.sd=1;H.roundEnd=H.t+60;mEv('sd')}else endMission('draw','DRAW',c.A+' – '+c.B)}
// --- Extraction ---
function extCall(){const E=H.ext;if(E.ph!=='search')return;E.ph='called';E.callAt=H.t;E.landAt=H.t+EXT.callT;mEv('call',{left:EXT.callT});mSync()}
function extTake(d,p){d.st='carried';d.car=p.id;p.drive=d.id;mEv('take',{d:d.id,by:p.id});mSync();extCall()}
function extDrop(d){const c=H.players[d.car];if(c)c.drive=null;d.st='dropped';d.car=null;mEv('drop',{d:d.id,by:c&&c.id});mSync()}
function extTick(dt){const E=H.ext;const ops=plist().filter(p=>p.team==='A');
 if(E.t0===0)E.t0=H.t;
 if(E.ph==='search'&&H.roundEnd-H.t<EXT.time-EXT.call)extCall();
 for(const d of E.d){if(d.st==='secured')continue;
  if(d.st==='carried'){const c=H.players[d.car];if(!c||!c.alive||c.down){extDrop(d);continue}d.pos=[c.p[0],c.p[1],c.p[2]];if((E.ph==='extract')&&hd2(c.p,E.lz)<EXT.zone){d.st='secured';c.drive=null;c.pts+=150;E.sec++;mEv('secure',{d:d.id,by:c.id,sec:E.sec});mSync();sendSB()}}
  else for(const p of ops){if(!p.alive||p.down||p.drive!=null||p.raider)continue;if(hd2(p.p,d.pos)<1.9&&Math.abs(p.p[1]-d.pos[1])<2.4){extTake(d,p);break}}}
 if(E.ph==='called'&&H.t>=E.landAt){E.ph='extract';E.departAt=H.t+EXT.window;mEv('land',{left:EXT.window});mSync()}
 if(E.ph==='extract'){const live=ops.filter(p=>p.alive&&!p.down);const all=live.length&&live.every(p=>hd2(p.p,E.lz)<EXT.zone+2);
  if(E.sec>=EXT.need&&all&&E.departAt-H.t>4){E.departAt=H.t+4;mEv('leaving');E.ph='leaving';mSync()}
  if(H.t>=E.departAt)extDepart()}
 if(E.ph==='leaving'&&H.t>=E.departAt)extDepart();
 // raider waves
 if(!E.nextWave)E.nextWave=H.t+40;
 if(H.t>=E.nextWave){E.nextWave=H.t+(E.ph==='search'?45:28);const alive=plist().filter(p=>p.raider&&p.alive).length;const dead=plist().filter(p=>p.raider&&!p.alive).length;
  let add=Math.min(2,EXT.maxRaid-alive-dead);if(add>0){E.wave++;for(let i=0;i<add;i++){const b=addRaider(null,true);b.respawn=H.t+.5;announceJoin(b)}mEv('wave',{n:E.wave})}else if(alive+dead>0){E.wave++;mEv('wave',{n:E.wave})}}}
function announceJoin(b){bcast(lobbyData());bcast({t:'join',id:b.id,name:b.name,team:b.team,color:b.color,o:b.ord,sk:b.skin,ws:b.ws,cl:b.cl,bot:1,raider:1});sendSB()}
function extDepart(){const E=H.ext;if(H.phase!=='play')return;if(E.sec>=EXT.need)endMission('A','EXTRACTED',E.sec+'/'+EXT.n+' drives secured'+(E.sec>=EXT.n?' · PERFECT':''));else endMission('B','EXTRACTION MISSED',E.sec+'/'+EXT.n+' secured (need '+EXT.need+')')}
function missionCheck(){if(H.phase!=='play')return;if(H.mode==='ext'){const ops=plist().filter(p=>p.team==='A');if(ops.length&&!ops.some(p=>p.alive||p.respawn>0))endMission('B','MISSION FAILED','all operators lost · '+H.ext.sec+'/'+EXT.n+' secured')}}
function missionTick(dt){if(H.mode==='ctf')ctfTick(dt);else extTick(dt);H.mT=(H.mT||0)+dt;if(H.mT>=.5){H.mT=0;mSync()}
 if(H.t>=H.roundEnd){if(H.mode==='ctf')ctfTimeUp();else{extDepart2()}}}
function extDepart2(){const E=H.ext;endMission('B','OUT OF TIME',E.sec+'/'+EXT.n+' secured')}
function endMission(win,title,sub){if(H.phase!=='play')return;H.phase='roundEnd';const nm=win==='A'?(H.mode==='ext'?'OPERATORS':'BLUE TEAM'):win==='B'?(H.mode==='ext'?'RAIDERS':'RED TEAM'):'';
 bcast({t:'roundEnd',win,name:nm,score:H.score,match:true,title,sub});sendSB();H.matchOver=true;H.rem={};H.prevMap=H.map;clearTimeout(H.lobbyT);H.lobbyT=setTimeout(hostDecide,19000)}
// bot objectives (return a goal [x,z,y] or null)
function botIdx(b){let i=0;for(const q of plist()){if(q.id===b.id)return i;if(q.bot&&q.team===b.team)i++}return i}
function botMission(b){if(H.mode==='ctf'){const T=b.team,O=T==='A'?'B':'A',mine=H.ctf.f[T],en=H.ctf.f[O];
  b.rush=0;if(b.flag===O)return[mine.home[0],mine.home[2],0];
  if(mine.st==='carried'){const c=H.players[mine.car];if(c)return[c.p[0],c.p[2],c.p[1]]}
  if(mine.st==='dropped')return[mine.pos[0],mine.pos[2],mine.pos[1]];
  if(en.st==='dropped'&&hd2(b.e.pos.toArray(),en.pos)<60)return[en.pos[0],en.pos[2],en.pos[1]];
  if(en.st==='carried'){const c=H.players[en.car];if(c&&c.id!==b.id){if(c.team===T)return[(c.p[0]+mine.home[0])/2*.5+c.p[0]*.5,(c.p[2]+mine.home[2])/2*.5+c.p[2]*.5,c.p[1]];return[c.p[0],c.p[2],c.p[1]]}}
  const i=botIdx(b);if(i%4===1&&plist().filter(q=>q.team===T).length>=5){const L=H.ctf.defPts[T];if(L&&L.length){const n=L[(i*7)%L.length];return[n[0],n[2],0]}return[mine.home[0],mine.home[2],0]}
  b.rush=en.st==='home'?((hd2(b.e.pos.toArray(),en.home)<24||botIdx(b)%2===0)?2:1):0;return[en.home[0],en.home[2],0]}
 const E=H.ext;if(!E)return null;const me_=b.e.pos.toArray();
 if(b.raider){if(b.hunt||E.ph==='called'||E.ph==='extract'){const ops=plist().filter(q=>q.team==='A'&&q.alive);let best=null,bd=1e9;for(const q of ops){const d=Math.hypot(q.p[0]-b.e.pos.x,q.p[2]-b.e.pos.z);if(d<bd){bd=d;best=q}}if(E.ph==='extract'&&(!best||bd>40))return[E.lz[0],E.lz[2],0];if(best)return[best.p[0],best.p[2],best.p[1]];return[E.lz[0],E.lz[2],0]}
  const d=E.d[b.post];if(!d)return null;if(!b.postPt)b.postPt=raiderSpot(b);return[b.postPt[0],b.postPt[1],0]}
 // operators
 if(b.drive!=null)return[E.lz[0],E.lz[2],0];
 if(E.ph==='extract'||E.ph==='leaving'){return[E.lz[0]+((botIdx(b)*3)%7-3),E.lz[2]+((botIdx(b)*5)%7-3),0]}
 const open=E.d.filter(d=>d.st==='home'||d.st==='dropped').sort((a,c)=>hd2(a.pos,me_)-hd2(c.pos,me_));
 if(open.length){const d=open[botIdx(b)%open.length];return[d.pos[0],d.pos[2],d.pos[1]]}
 return[E.lz[0],E.lz[2],0]}

function missionRespawn(p,m){if(H.mode==='ctf'){const L=(p.team==='A'?m.spawnsA:m.spawnsB);const h=H.ctf.f[p.team].home;const near=L.slice().sort((a,b)=>Math.hypot(a[0]-h[0],a[1]-h[2])-Math.hypot(b[0]-h[0],b[1]-h[2])).slice(0,4);const s=near[Math.random()*near.length|0];return[s[0],s[1],faceCenter(s)]}
 if(p.raider){const q=raiderSpot(p);return[q[0],q[1],faceCenter(q)]}
 const lz=H.ext.lz;const near=m.spawnsA.slice().sort((a,b)=>Math.hypot(a[0]-lz[0],a[1]-lz[2])-Math.hypot(b[0]-lz[0],b[1]-lz[2])).slice(0,4);const q=near[Math.random()*near.length|0];return[q[0],q[1],faceCenter(q)]}

// ================= v42 MISSION MODES (client side: flags, drives, chopper, markers, HUD, announcer, briefing) =================
let MS=null,MG=null;const MKEL={};let msTxt='',heliT=0;
function clearMission(){if(MG){scene.remove(MG);MG=null}MS=null;for(const k in MKEL){MKEL[k].remove();delete MKEL[k]}const h=$('msHud');if(h)h.classList.add('hidden');const b=$('briefBtn');if(b)b.classList.add('hidden');const br=$('brief');if(br)br.classList.add('hidden')}
const _w=new THREE.Vector3();const stdM=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.6,metalness:.2},o));
function mkBase(col,r){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.07,6,32),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9}));m.rotation.x=Math.PI/2;m.position.y=.09;return m}
function mkBeam(col,h=40,op=.22){const m=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,h,10,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.position.y=h/2;return m}
function mkFlagObj(col){const g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,3.3,6),stdM(0xcfd3d8,{metalness:.7,roughness:.35}));pole.position.y=1.65;g.add(pole);
 const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.8,8,1),stdM(col,{side:THREE.DoubleSide,emissive:col,emissiveIntensity:.3,roughness:.8}));cloth.position.set(.65,2.85,0);cloth.userData.p0=Float32Array.from(cloth.geometry.attributes.position.array);g.add(cloth);
 const beam=mkBeam(col);g.add(beam);const orb=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),new THREE.MeshBasicMaterial({color:0xffffff}));orb.position.y=3.35;g.add(orb);return{g,cloth,beam}}
function mkDriveObj(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.42),stdM(0x2b2f36,{metalness:.7,roughness:.35}));b.position.y=.55;g.add(b);
 const l=new THREE.Mesh(new THREE.BoxGeometry(.5,.04,.32),new THREE.MeshBasicMaterial({color:0x35ff9a}));l.position.y=.71;g.add(l);const pl=new THREE.Mesh(new THREE.CylinderGeometry(.5,.55,.5,10),stdM(0x3a3f47));pl.position.y=.25;g.add(pl);const beam=mkBeam(0xffd23b,40,.3);g.add(beam);g.userData.box=b;return{g,beam,box:b}}
function mkLZ(r){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.12,6,48),new THREE.MeshBasicMaterial({color:0x4de3ff,transparent:true,opacity:.9}));ring.rotation.x=Math.PI/2;g.add(ring);
 const disc=new THREE.Mesh(new THREE.CircleGeometry(r,40),new THREE.MeshBasicMaterial({color:0x4de3ff,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.y=.02;g.add(disc);
 const H1=new THREE.Mesh(new THREE.PlaneGeometry(r*.9,r*.9),new THREE.MeshBasicMaterial({map:hTex(),transparent:true,depthWrite:false,opacity:.8}));H1.rotation.x=-Math.PI/2;H1.position.y=.03;g.add(H1);g.add(mkBeam(0x4de3ff,60,.14));g.userData={ring,disc};return g}
let _hTex=null;function hTex(){if(_hTex)return _hTex;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.strokeStyle='#fff';x.lineWidth=10;x.strokeRect(14,14,100,100);x.fillStyle='#fff';x.fillRect(38,34,12,60);x.fillRect(78,34,12,60);x.fillRect(38,58,52,12);return _hTex=new THREE.CanvasTexture(c)}
function mkChopper(){const g=new THREE.Group();const dk=stdM(0x2f3a2f,{roughness:.5,metalness:.4}),lt=stdM(0x4b5a48);
 const body=new THREE.Mesh(new THREE.SphereGeometry(1.3,14,10),dk);body.scale.set(1.9,1,1);g.add(body);const cock=new THREE.Mesh(new THREE.SphereGeometry(.85,10,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x7fd0ff,roughness:.1,metalness:.6,transparent:true,opacity:.7}));cock.position.set(1.9,.25,0);cock.scale.set(1.1,.9,.9);g.add(cock);
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(.28,.12,3.8,8),dk);tail.rotation.z=Math.PI/2;tail.position.set(-3.6,.35,0);g.add(tail);const fin=new THREE.Mesh(new THREE.BoxGeometry(.18,1.2,.5),lt);fin.position.set(-5.3,.85,0);g.add(fin);
 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.6,6),lt);mast.position.y=1.5;g.add(mast);const rotor=new THREE.Group();rotor.position.y=1.85;for(let i=0;i<2;i++){const bl=new THREE.Mesh(new THREE.BoxGeometry(8.4,.05,.35),stdM(0x15181a));bl.rotation.y=i*Math.PI/2;rotor.add(bl)}g.add(rotor);
 const trot=new THREE.Group();trot.position.set(-5.3,.9,.3);const tb=new THREE.Mesh(new THREE.BoxGeometry(.06,1.4,.12),stdM(0x15181a));trot.add(tb);g.add(trot);
 for(const s of[-1,1]){const sk=new THREE.Mesh(new THREE.BoxGeometry(4.2,.1,.12),lt);sk.position.set(.2,-1.35,s*.9);g.add(sk);for(const x of[-1,1.4]){const st=new THREE.Mesh(new THREE.BoxGeometry(.1,.8,.1),lt);st.position.set(x,-.95,s*.9);g.add(st)}}
 const lamp=new THREE.PointLight(0xfff0c0,1.2,30);lamp.position.set(2,-1,0);g.add(lamp);g.scale.setScalar(1.15);return{g,rotor,trot}}
function showBrief(mode){const b=$('brief');if(!b)return;const T={ctf:['🏁 CAPTURE THE FLAG','<li>Two teams, one flag each, hidden in their base.</li><li><b>Grab the enemy flag</b> and run it back to <b>your own base</b> to score — your flag must be home to capture.</li><li>If a carrier dies the flag <b>drops</b>. Touch a dropped <i>enemy</i> flag to pick it up; touch your own dropped flag to <b>return</b> it instantly.</li><li>First team to <b>3 captures</b> wins (10 min limit).</li><li>Respawn 5 s after dying. Downed? A teammate can <b>revive</b> you.</li>'],
  ext:['🚁 EXTRACTION','<li>You and your squad are <b>Operators</b>. Raider bots guard 3 <b>data drives 💾</b> and attack in waves.</li><li>Walk over a drive to pick it up — <b>the first pickup calls the chopper</b> (it also comes at 3:00 left).</li><li>When the chopper <b>lands</b> in the cyan zone, carry drives inside to secure them. <b>Secure 2 of 3 to win.</b></li><li>Carriers drop drives when downed. Revive teammates; you have <b>3 reinforcements</b> for fallen operators.</li><li>Miss the window or lose everyone and the mission fails.</li>']}[mode];
 if(!T){b.classList.add('hidden');return}b.innerHTML=`<h3>${T[0]}</h3><ul>${T[1]}</ul><button id="briefOk" class="btnBig yellow">GOT IT</button>`;b.classList.remove('hidden');$('briefBtn').classList.remove('hidden');clearTimeout(showBrief.t);showBrief.t=setTimeout(()=>b.classList.add('hidden'),14000);$('briefOk').onclick=()=>{b.classList.add('hidden')}}
function setMark(id,wp,html,col){let el=MKEL[id];if(!el){el=MKEL[id]=document.createElement('div');el.className='mk';$('markers').appendChild(el)}
 _v.copy(wp).project(camera);let x=_v.x,y=_v.y;const behind=_v.z>1;if(behind){x=-x;y=-y}const ax=Math.abs(x),ay=Math.abs(y);let off=false;if(behind||ax>.92||ay>.84){off=true;const k=Math.max(ax/.92,ay/.84,1e-3);x/=k;y/=k}
 el.style.display='';el.style.left=((x+1)/2*innerWidth)+'px';el.style.top=((1-y)/2*innerHeight)+'px';el.style.color=col;el.classList.toggle('off',off);if(el.__h!==html){el.innerHTML=html;el.__h=html}el.__u=1}
const myTeam=()=>(C.players[me.id]&&C.players[me.id].team)||'A';
function missionClientInit(info){clearMission();if(!info)return;MS={info,s:info,flags:{},drives:[],heli:null,at:performance.now()};MG=new THREE.Group();scene.add(MG);
 if(info.m==='ctf'){for(const T of['A','B']){const o=mkFlagObj(TEAMCOL[T]);const base=mkBase(TEAMCOL[T],1.4);base.position.set(info.home[T][0],.09,info.home[T][2]);MG.add(base);o.g.position.set(...info.home[T]);MG.add(o.g);MS.flags[T]=o}}
 else{info.home.forEach(h=>{const o=mkDriveObj();o.g.position.set(h[0],0,h[2]);MG.add(o.g);MS.drives.push(o)});const lz=mkLZ(EXT.zone);lz.position.set(info.lz[0],.06,info.lz[2]);MG.add(lz);MS.lz=lz;MS.heli=mkChopper();MS.heli.g.visible=false;MG.add(MS.heli.g)}
 showBrief(info.m);updMsHud()}
const fmtT=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
function updMsHud(){const h=$('msHud');if(!h||!MS){return}const s=MS.s;let t='';
 if(s.m==='ctf'){const my=myTeam(),en=my==='A'?'B':'A';const st=(T)=>{const f=s.f[T];return f[0]==='home'?'<b class="ok">AT BASE</b>':f[0]==='carried'?'<b class="warn">TAKEN'+(f[1]===me.id?' (YOU)':'')+'</b>':'<b class="warn">DROPPED</b>'};
  t=`<span style="color:${hex(TEAMCOL[my])}">🚩 YOUR FLAG</span> ${st(my)}<br><span style="color:${hex(TEAMCOL[en])}">🚩 ENEMY FLAG</span> ${st(en)}${C.players[me.id]&&s.f[en][0]==='carried'&&s.f[en][1]===me.id?'<br><b class="ok">RUN IT HOME!</b>':''}`}
 else{const taken=s.d.filter(d=>d[0]==='carried').length;const ph=s.ph;t=`💾 DRIVES  <b>${s.sec}/${EXT.need}</b> secured <small>(${taken} carried · need ${EXT.need} of ${EXT.n})</small><br>`+(ph==='search'?'🚁 Grab a drive to call the chopper':ph==='called'?`🚁 CHOPPER ETA <b class="warn">${s.cl}s</b>`:ph==='extract'?`🚁 LANDED — get in the zone! <b class="warn">${s.cl}s</b>`:'🚁 TAKING OFF…')+`<br><small>Reinforcements ${s.reinf} · Raider wave ${s.wave}</small>`}
 if(t!==msTxt){msTxt=t;h.innerHTML=t}h.classList.remove('hidden')}
function ANN(txt,kind,col){center(txt.replace(/\n/g,' · '),1900);window.__ann=(window.__ann||[]);window.__ann.push([kind,txt]);try{SFX.ann(kind)}catch(e){}
 try{if(window.speechSynthesis&&S.voice!==false&&S.sfx>0&&kind!=='tick'){const u=new SpeechSynthesisUtterance(txt.replace(/\n.*/,'').replace(/[^\w\s!?']/g,''));u.rate=1.1;u.pitch=.75;u.volume=Math.min(1,S.sfx);speechSynthesis.cancel();speechSynthesis.speak(u)}}catch(e){}}
function missionEvent(m){if(!MS)return;const my=myTeam(),nm=id=>(id===me.id?'You':(C.players[id]?.name||'?'));
 if(MS.info.m==='ctf'){const mineF=m.team===my;
  if(m.k==='take'){if(m.by===me.id)ANN('YOU HAVE THE ENEMY FLAG!\nRun it home','take');else if(mineF)ANN('YOUR FLAG HAS BEEN TAKEN!','warn');else ANN('ENEMY FLAG TAKEN\n'+nm(m.by),'take');feed(`🚩 ${nm(m.by)} took the ${mineF?'your':'enemy'} flag`)}
  else if(m.k==='drop'){ANN(mineF?'YOUR FLAG DROPPED\nReturn it!':'ENEMY FLAG DROPPED\nGrab it!','drop');feed(`🚩 flag dropped${m.by?' by '+nm(m.by):''}`)}
  else if(m.k==='return'){ANN(mineF?'YOUR FLAG IS BACK':'ENEMY FLAG RETURNED','ret');if(m.by)feed(`🚩 ${nm(m.by)} returned the flag`)}
  else if(m.k==='cap'){const mine=m.team===my;ANN(`${mine?'YOUR TEAM':'ENEMY TEAM'} SCORES!\n${m.caps.A} – ${m.caps.B}`,mine?'cap':'warn');feed(`🏁 ${nm(m.by)} captured the flag`)}
  else if(m.k==='sd'){ANN('SUDDEN DEATH\nNext capture wins','warn')}}
 else{if(m.k==='call')ANN('CHOPPER INBOUND\nETA '+m.left+' s','heli');else if(m.k==='land')ANN('CHOPPER HAS LANDED\nGet the drives into the zone!','heli');else if(m.k==='leaving')ANN('CHOPPER TAKING OFF!','warn');
  else if(m.k==='take'){if(m.by===me.id)ANN('DRIVE PICKED UP\nBring it to the landing zone','take');feed(`💾 ${nm(m.by)} picked up a drive`)}
  else if(m.k==='drop'){ANN('DRIVE DROPPED\nGrab it!','drop')}
  else if(m.k==='secure'){ANN(`DRIVE SECURED ${m.sec}/${EXT.need}`,'cap');feed(`💾 ${nm(m.by)} secured a drive`)}
  else if(m.k==='wave'){ANN('RAIDER WAVE '+m.n,'warn')}}
 updMsHud()}
function updMission(dt,now){if(!MS)return;const s=MS.s,t=now/1000;const used={};
 if(s.m==='ctf'){const my=myTeam();for(const T of['A','B']){const o=MS.flags[T],f=s.f[T];let x=f[2],y=f[3],z=f[4];
   if(f[0]==='carried'){const P=f[1]===me.id?me.pos:(C.players[f[1]]&&C.players[f[1]].rp);if(P){x=P.x;y=P.y+.9;z=P.z}}
   o.g.position.set(x,y,z);o.g.scale.setScalar(f[0]==='carried'?.55:1);o.beam.visible=f[0]!=='carried';o.g.rotation.y=f[0]==='carried'?(f[1]===me.id?me.yaw:(C.players[f[1]]?.yaw||0))+Math.PI:0;
   const pa=o.cloth.geometry.attributes.position,p0=o.cloth.userData.p0;for(let i=0;i<pa.count;i++){const u=(p0[i*3]+.625)/1.25;pa.array[i*3+2]=Math.sin(t*5+u*5)*.12*u}pa.needsUpdate=true;
   const mine=T===my;const lab=f[0]==='home'?'':f[0]==='carried'?(f[1]===me.id?' (YOU)':' ⚠'):' ↓';
   const wp=_w.set(x,y+3.6,z);const dist=Math.round(Math.hypot(x-me.pos.x,z-me.pos.z));used['f'+T]=1;setMark('f'+T,wp,`🚩<br><small>${mine?'YOUR':'ENEMY'}${lab}<br>${dist}m</small>`,hex(TEAMCOL[T]))}}
 else{s.d.forEach((d,i)=>{const o=MS.drives[i];let x=d[2],y=d[3],z=d[4];const sec=d[0]==='secured';o.g.visible=!sec;if(d[0]==='carried'){const P=d[1]===me.id?me.pos:(C.players[d[1]]&&C.players[d[1]].rp);if(P){x=P.x;y=P.y+1.6;z=P.z}o.beam.visible=false;o.g.scale.setScalar(.6)}else{o.beam.visible=true;o.g.scale.setScalar(1);o.g.rotation.y=t*1.2;o.g.position.y=0}
   o.g.position.set(x,d[0]==='carried'?y:y,z);if(!sec){const dist=Math.round(Math.hypot(x-me.pos.x,z-me.pos.z));used['d'+i]=1;setMark('d'+i,_w.set(x,y+(d[0]==='carried'?1.2:2.2),z),`💾<br><small>${d[0]==='carried'?'CARRIED':'DRIVE '+(i+1)}<br>${dist}m</small>`,d[0]==='carried'?'#ffd23b':'#ffe27a')}});
  const L=s.lz;MS.lz.userData.ring.scale.setScalar(1+Math.sin(t*3)*.03);MS.lz.userData.disc.material.opacity=.1+(s.ph==='extract'?.12:0)+Math.sin(t*3)*.03;
  used.lz=1;setMark('lz',_w.set(L[0],3,L[2]),`🚁<br><small>LZ ${s.ph==='called'||s.ph==='extract'?s.cl+'s':''}<br>${Math.round(Math.hypot(L[0]-me.pos.x,L[2]-me.pos.z))}m</small>`,'#4de3ff');
  const hl=MS.heli;if(hl){let vis=false;if(s.ph==='called'){const u=1-(s.cl-(now-MS.at)/1000)/EXT.callT;const k=Math.max(0,Math.min(1,u));const e=1-Math.pow(1-k,2);hl.g.position.set(L[0]+(1-e)*160,L[1]+3.2+(1-e)*45,L[2]-(1-e)*90);hl.g.rotation.y=Math.atan2(-(1-e)*90,-(1-e)*160)*0+Math.PI*(1-e)*.0;vis=true;hl.g.rotation.z=(1-e)*.12}
   else if(s.ph==='extract'){hl.g.position.set(L[0],L[1]+2.9+Math.sin(t*1.5)*.04,L[2]);hl.g.rotation.z=0;vis=true}
   else if(s.ph==='leaving'){const k=Math.min(1,(now-MS.at)/1000/4);hl.g.position.set(L[0]-k*20,L[1]+3+k*k*60,L[2]+k*30);vis=true}
   hl.g.visible=vis;if(vis){hl.rotor.rotation.y+=dt*38;hl.trot.rotation.z+=dt*45;const d=Math.hypot(hl.g.position.x-me.pos.x,hl.g.position.z-me.pos.z);heliT-=dt;if(heliT<=0&&d<170){heliT=.17;const v=Math.max(0,1-d/170);const dst=out();if(dst){tone(68,.1,.3*v,'sine',44,dst);noise('bandpass',380,1.1,.07,.18*v,dst)}}}}}
 for(const k in MKEL){if(!used[k]){MKEL[k].style.display='none'}}
 MS.hudT=(MS.hudT||0)+dt;if(MS.hudT>.25){MS.hudT=0;updMsHud()}}
SFX.ann=function(kind){const d=out();if(!d)return;const T=(f,t,v,ty='triangle')=>setTimeout(()=>tone(f,.22,v,ty,0,d,.005),t);
 if(kind==='take'){T(523,0,.2);T(784,110,.22)}else if(kind==='drop'){T(659,0,.2);T(392,120,.22)}else if(kind==='ret'){T(523,0,.18);T(659,90,.18);T(784,180,.2)}
 else if(kind==='cap'){[523,659,784,1047].forEach((f,i)=>T(f,i*110,.22));setTimeout(()=>noise('highpass',4500,.7,.3,.2,d,.3,.01),420)}
 else if(kind==='warn'){T(440,0,.22,'square');T(330,160,.22,'square');T(440,320,.22,'square')}else if(kind==='heli'){noise('lowpass',500,.8,.7,.35,d,.2,.05);T(196,0,.2,'sawtooth');T(262,200,.2,'sawtooth')}}
$('briefBtn')&&($('briefBtn').onclick=()=>{const m=MS&&MS.info.m;if(m)showBrief(m)});
Object.assign(window.__hsz,{MSX:()=>({MS,H,CTF,EXT}),damage:(...a)=>damage(...a),extCall,missionTick,endMission,addRaider});
// ================= v44 BATTLE ROYALE (host side) =================
const RAR=[{n:'COMMON',c:0xb8bcc4,d:1,m:1,rl:1,sp:1,fr:1},{n:'UNCOMMON',c:0x4cd964,d:1.1,m:1.06,rl:.95,sp:.95,fr:.98},{n:'RARE',c:0x3b9cff,d:1.2,m:1.12,rl:.9,sp:.9,fr:.96},{n:'EPIC',c:0xb35cff,d:1.32,m:1.2,rl:.85,sp:.84,fr:.94},{n:'LEGENDARY',c:0xffb81c,d:1.45,m:1.3,rl:.8,sp:.78,fr:.92},{n:'SECRET',c:0xff2b2b,d:1.6,m:1.4,rl:.75,sp:.7,fr:.9}];
const BRC={secret:4,pop:24,sq:4,heliY:230,busDur:52,chuteY:70,ft:48,cd:3};
const AMN=['Light','Medium','Shells','Heavy'],AMV=[36,30,8,6];
const CONS=['band','med','shd','mini'],CONN=['Bandage','Medkit','Shield Potion','Mini Shield'],CONMAX=[15,3,3,6],CONT=[2.5,6,4,2],CONI=['🩹','🧰','🧪','🧃'];
const GUNW=[['ar',24],['smg',18],['shotgun',14],['pistol',14],['marksman',10],['sniper',8],['heavy',3]];
const POOLS={ar:['ar','bullpup','battle','m4','ak47','scar','m16','mk18'],smg:['smg','vector','pdw','mp5','mp7','kriss','p90','ump45','tommy'],shotgun:['shotgun','autoshot','double','aa12','saiga','ksg'],pistol:['handgun','revolver','burst','cannon','glock18','deagle'],marksman:['dmr','lever','mini14','crossbow'],sniper:['sniper','heavy','light','barrett','awp'],heavy:['lmg','gl','rpg','minigun']};
const MELEES=['knife','katana','axe','bat','pan'];
const SQCOL=[0x3fa9ff,0xff5a6b,0x2ee59d,0xffd23f,0xb06bff,0xff9f43,0x1dd1a1,0xff79c6];
const STORM=[{wait:42,shrink:55,r:210,dmg:1},{wait:45,shrink:45,r:140,dmg:2},{wait:40,shrink:38,r:80,dmg:3},{wait:35,shrink:30,r:36,dmg:5},{wait:30,shrink:25,r:14,dmg:8},{wait:25,shrink:25,r:3,dmg:10}];
const rrand=(a,b)=>a+Math.random()*(b-a);
const wrand=a=>{let t=0;for(const x of a)t+=x[1];let r=Math.random()*t;for(const x of a){r-=x[1];if(r<=0)return x[0]}return a[0][0]};
const ammoOf=id=>{const c=W[id].cls;return c==='smg'||c==='pistol'||c==='fun'?0:c==='ar'||c==='marksman'?1:c==='shotgun'?2:3};
function rollRar(chest,cls){const T=chest?[.12,.28,.30,.20,.10]:[.55,.25,.12,.06,.02];let r=Math.random(),k=0;for(;k<4;k++){r-=T[k];if(r<=0)break}if(cls==='sniper'||cls==='heavy')k=Math.max(k,chest?1:2);return Math.min(4,k)}
const gunItem=chest=>{const cls=wrand(GUNW);const id=POOLS[cls][Math.random()*POOLS[cls].length|0];return[0,WIDX[id],rollRar(chest,cls)]};
const gunScore=(id,r)=>{const w=W[id];if(!w)return 0;const per=w.pellets?w.body*w.pellets*.55:w.body;const dps=(per*(w.cls==='sniper'?1.2:1))/Math.max(.045,w.rate*(w.burst?1.15:1));return dps*RAR[r|0].d*(w.proj?.9:1)};
function rollItem(chest){const r=Math.random();
 if(r<.36)return gunItem(chest);
 if(r<.58)return[1,wrand([[0,30],[1,35],[2,15],[3,20]]),AMV[0]*0+0];// ammo (count filled below)
 if(r<.82)return[2,wrand([[0,45],[3,25],[1,15],[2,15]]),0];
 if(r<.94)return[3,WIDX[wrand([['grenade',32],['smoke',22],['molotov',20],['flash',14],['decoy',12]])],0];
 return[4,WIDX[MELEES[Math.random()*MELEES.length|0]],rollRar(chest,'m')]}
function fixItem(it,chest){if(it[0]===1)it[2]=Math.round(AMV[it[1]]*(chest?1.5:1));else if(it[0]===2)it[2]=it[1]===0?(chest?5:3):it[1]===3?(chest?3:2):1;else if(it[0]===3)it[2]=W[WIDS[it[1]]].count||1;return it}
// v58 typed quick slots: g = [rifle,smg,shotgun,sniper] (one each), m = melee, bp = backpack (guns + melee). In Royale me.load = [rifle,smg,melee,util,shotgun,sniper].
const TS=[0,1,4,5],S2T={0:0,1:1,4:2,5:3},BRORD=[0,1,4,5,2],TYN=['RIFLE','SMG','SHOTGUN','SNIPER'],TYS=['AR','SMG','SG','SNP'],BPN=5;
const typeOfW=id=>{const c=W[id].cls;return c==='smg'||c==='pistol'?1:c==='shotgun'?2:c==='sniper'||c==='marksman'?3:0};
const newInv=()=>({g:[null,null,null,null],bp:[],m:[WIDX.fists,0],u:null,n:null,c:[0,0,0,0],res:[0,0,0,0]});
const brBetter=(a,ra,b,rb)=>ra>rb||(ra===rb&&a!==b&&gunScore(WIDS[a],ra)>gunScore(WIDS[b],rb)*1.12);
function brPickPlan(inv,it,bot){const k=it[1],a=it[2],b=it[3];const bpRoom=!bot&&(inv.bp||[]).length<BPN;
 if(k===0){const t=typeOfW(WIDS[a]);const old=inv.g[t];if(!old)return{act:'equip',t};if(brBetter(a,b,old[0],old[1]))return{act:'swap',t,old};if(old[0]===a&&old[1]>=b)return{act:'none',why:'dup'};return bpRoom?{act:'stash',t}:{act:'none',why:bot?'worse':'full'}}
 if(k===4){const old=inv.m;if(old[0]===WIDX.fists)return{act:'equip'};if(b>old[1])return{act:'swap',old};if(old[0]===a&&old[1]>=b)return{act:'none',why:'dup'};return bpRoom?{act:'stash'}:{act:'none',why:bot?'worse':'full'}}
 return{act:'take'}}
function brItem(k,a,b,x,y,z,bd){const E=H.br;const id=E.nid++;const it=[id,k,a,b,+(+x).toFixed(1),+(+y).toFixed(2),+(+z).toFixed(1)];it.bd=bd;E.items[id]=it;return it}
function brPrep(){const m=buildMap(H.map);const E=H.br={half:m.size[0]/2,ph:'bus',items:{},chests:[],nid:1,t0:0,y:BRC.heliY,spd:1,over:0,kills:{},placed:0,doors:m.doors||[],zones:m.zones||[],lastBru:0,stTick:0,farT:0,fightT:0};
 // teams
 const ps=plist();if(H.mode==='br'){let i=0;for(const p of ps){p.team=p.id;p.color=FFACOL[i++%10]}}
 else{const hum=ps.filter(p=>!p.bot),bots=ps.filter(p=>p.bot);const par={};for(const p of hum){const k=p.party||('~'+p.id);(par[k]=par[k]||[]).push(p)}
  const groups=Object.values(par).sort((a,b)=>b.length-a.length);const sq=[];let bi=0;
  for(const g of groups){let s=sq.find(s=>s.length+g.length<=BRC.sq&&s.hum);if(!s||g.length>1&&false){s=[];s.hum=1;sq.push(s)}s.push(...g)}
  for(const b of bots){let s=sq.find(s=>s.length<BRC.sq);if(!s){s=[];sq.push(s)}s.push(b)}
  sq.forEach((s,i)=>s.forEach(p=>{p.team='S'+(i+1);p.color=SQCOL[i%SQCOL.length]}));}
 // loot
 const sp=m.lootSpots||[];for(const s of sp){const n=Math.random()<.5?2:1;for(let k=0;k<n;k++){const it=fixItem(rollItem(false),false);brItem(it[0],it[1],it[2],s[0]+(k?rrand(-.8,.8):0),s[1],s[2]+(k?rrand(-.8,.8):0),s[3])}}
 (m.chestSpots||[]).forEach((c,i)=>E.chests.push({id:i,x:c[0],y:c[1],z:c[2],ry:c[3],bd:c[4],open:0,tier:wrand([[0,52],[1,29],[2,14],[3,5]])}));
 {const pool=E.chests.slice().sort(()=>Math.random()-.5),pick=[];for(const c of pool){if(pick.length>=BRC.secret)break;if(Math.hypot(c.x,c.z)>brHalf()*.88)continue;if(pick.every(q=>Math.hypot(q.x-c.x,q.z-c.z)>brHalf()*.45)){c.sec=1;pick.push(c)}}}
 // helicopter flight path: random edge-to-edge line near the middle
 const ang=Math.random()*Math.PI*2,off=rrand(-80,80),len=brHalf()*1.5;const dx=Math.cos(ang),dz=Math.sin(ang),px=-dz*off,pz=dx*off;E.heli={a:[+(px-dx*len).toFixed(1),+(pz-dz*len).toFixed(1)],b:[+(px+dx*len).toFixed(1),+(pz+dz*len).toFixed(1)],dur:BRC.busDur};
 E.storm=stormInit();H.score={}}
const heliAt=t=>{const h=H.br.heli,k=Math.max(0,Math.min(1,t/h.dur));return[h.a[0]+(h.b[0]-h.a[0])*k,h.a[1]+(h.b[1]-h.a[1])*k]};
function brInfo(){const E=H.br;return{half:E.half,y:E.y,heli:E.heli,items:Object.values(E.items).map(i=>i.slice(0,7)),chests:E.chests.map(c=>[c.id,c.x,c.y,c.z,c.ry,c.open,c.sec?1:0,c.tier|0]),zones:E.zones}}
function stormInit(){const R0=Math.round(brHalf()*1.5),s={ph:-1,state:'wait',cx:0,cz:0,r:R0,tcx:0,tcz:0,tr:R0,fcx:0,fcz:0,fr:R0,t:0,tEnd:0,dmg:0,tick:0};stormNext(s,true);return s}
function stormNext(s,first){const n=s.ph+1;const P=STORM[Math.min(n,STORM.length-1)];s.ph=n;s.state='wait';s.fcx=s.cx;s.fcz=s.cz;s.fr=s.r;const rr_=Math.max(0,s.r-P.r)*.8;const a=Math.random()*6.283,d=Math.random()*rr_;s.tcx=s.cx+Math.cos(a)*d;s.tcz=s.cz+Math.sin(a)*d;s.tr=P.r;s.dmg=P.dmg;s.t=0;s.waitT=P.wait+(first?BRC.busDur+BRC.cd:0);s.shrinkT=P.shrink;s.tEnd=s.waitT}
function stormTick(dt){const E=H.br,s=E.storm,sdt=dt*E.spd;s.t+=sdt;
 if(s.state==='wait'){if(s.t>=s.waitT){s.state='shrink';s.t=0}}
 else if(s.state==='shrink'){const k=Math.min(1,s.t/s.shrinkT);s.cx=s.fcx+(s.tcx-s.fcx)*k;s.cz=s.fcz+(s.tcz-s.fcz)*k;s.r=s.fr+(s.tr-s.fr)*k;if(k>=1){s.cx=s.tcx;s.cz=s.tcz;s.r=s.tr;if(s.ph>=STORM.length-1){s.state='final';s.t=0}else stormNext(s)}}
 s.tick+=sdt;if(s.tick>=1){s.tick=0;if(s.ph>=0)for(const p of plist()){if(!p.alive||p.elim||p.air==='bus')continue;if(Math.hypot(p.p[0]-s.cx,p.p[2]-s.cz)>s.r)damage(p,s.state==='final'?10:Math.max(1,s.dmg),'storm',false,'storm')}}}
function stormState(){const s=H.br.storm;return{ph:s.ph,state:s.state,cx:+s.cx.toFixed(1),cz:+s.cz.toFixed(1),r:+s.r.toFixed(1),tcx:+s.tcx.toFixed(1),tcz:+s.tcz.toFixed(1),tr:s.tr,left:Math.max(0,Math.round(((s.state==='wait'?s.waitT:s.shrinkT)-s.t)/H.br.spd)),dmg:s.dmg}}
function brStartRound(){const E=H.br;E.t0=H.t+BRC.cd;E.ph='bus';E.over=0;E.placed=0;E.kills={};
 const hs=heliAt(0);const yaw=Math.atan2(-(E.heli.b[0]-E.heli.a[0]),-(E.heli.b[1]-E.heli.a[1]));
 for(const p of plist()){p.air='bus';p.elim=0;p.sh=0;p.down=false;p.inv=newInv();p.prot=0;p.p=[hs[0],E.y,hs[1],yaw,0,WIDX.fists,32];
  if(p.bot){p.air='bus';const pool=E.zones.length?E.zones:[{x:0,z:0,r:40}];const z=pool[Math.random()*pool.length|0];const ds=E.doors.filter(d=>Math.hypot((d.x0+d.x1)/2-z.x,(d.z0+d.z1)/2-z.z)<z.r);const d=ds.length?ds[Math.random()*ds.length|0]:null;
   p.tgt=d?[d.out[0],d.out[1]]:[z.x+rrand(-z.r,z.r)*.6,z.z+rrand(-z.r,z.r)*.6];p.glide=rrand(125,185);p.jumpT=rrand(5,BRC.busDur-2);p.gun='fists';p.rarD=1;p.e.pos.set(hs[0],E.y,hs[1]);p.yaw=yaw;p.sit=null}
  else {}}}
function brGive(p,it,sl){const inv=p.inv;if(!inv)return{ok:false};const k=it[1],a=it[2],b=it[3];let dropped=null;
 if(!inv.bp)inv.bp=[];
 if(k===0||k===4){let pl=brPickPlan(inv,it,!!p.bot);
  if(sl===9&&!p.bot&&inv.bp.length<BPN&&pl.act!=='none')pl={act:'stash'};
  if(pl.act==='none')return{ok:false,why:pl.why};
  if(pl.act==='stash')inv.bp.push([k,a,b]);
  else if(k===0){if(pl.old)dropped=[0,pl.old[0],pl.old[1]];inv.g[pl.t]=[a,b]}
  else{if(pl.old&&pl.old[0]!==WIDX.fists)dropped=[4,pl.old[0],pl.old[1]];inv.m=[a,b]}}
 else if(k===1){if(inv.res[a]>=240)return{ok:false,why:'full'};inv.res[a]+=b}
 else if(k===2){if(inv.c[a]>=CONMAX[a])return{ok:false,why:'full'};inv.c[a]=Math.min(CONMAX[a],inv.c[a]+b)}
 else if(k===3){const nl=NLK.includes(WIDS[a]);const f=nl?'n':'u';const u=inv[f];if(!u||u[0]===a||u[1]<=0){inv[f]=[a,Math.min(8,(u&&u[0]===a?u[1]:0)+b)]}else{dropped=[3,u[0],u[1]];inv[f]=[a,b]}}
 if(p.bot)brBotEquip(p);return{ok:true,dropped}}
const invOut=p=>({t:'inv',inv:{g:p.inv.g,bp:p.inv.bp||[],m:p.inv.m,u:p.inv.u,n:p.inv.n||null,c:p.inv.c},res:p.inv.res});
function brBp(p,m){const inv=p&&p.inv;if(!inv||!p.alive||p.elim||p.air||p.bot)return;if(!inv.bp)inv.bp=[];const A_=String(m.a||''),i=m.i|0,w=String(m.w||'');const E=H.br;
 const drop=(k,a,b)=>{const d=brItem(k,a,b,p.p[0]+rrand(-.7,.7),p.p[1],p.p[2]+rrand(-.7,.7),-1);bcast({t:'ld',it:d.slice(0,7)})};
 if(A_==='eq'){const e=inv.bp[i];if(!e)return;if(e[0]===0){const t=typeOfW(WIDS[e[1]]);const old=inv.g[t];inv.g[t]=[e[1],e[2]];if(old)inv.bp[i]=[0,old[0],old[1]];else inv.bp.splice(i,1)}
  else{const old=inv.m;inv.m=[e[1],e[2]];if(old[0]!==WIDX.fists)inv.bp[i]=[4,old[0],old[1]];else inv.bp.splice(i,1)}}
 else if(A_==='st'){if(inv.bp.length>=BPN)return;if(w==='m'){if(inv.m[0]===WIDX.fists)return;inv.bp.push([4,inv.m[0],inv.m[1]]);inv.m=[WIDX.fists,0]}else{const t=i;if(!(t>=0&&t<4)||!inv.g[t])return;inv.bp.push([0,inv.g[t][0],inv.g[t][1]]);inv.g[t]=null}}
 else if(A_==='dr'){if(w==='b'){const e=inv.bp[i];if(!e)return;inv.bp.splice(i,1);drop(e[0],e[1],e[2])}else if(w==='m'){if(inv.m[0]===WIDX.fists)return;drop(4,inv.m[0],inv.m[1]);inv.m=[WIDX.fists,0]}else{const t=i;if(!(t>=0&&t<4)||!inv.g[t])return;drop(0,inv.g[t][0],inv.g[t][1]);inv.g[t]=null}}
 else return;
 sendTo(p.id,invOut(p))}
function brBotEquip(b){const inv=b.inv;let best=null,bs=-1;for(const g of inv.g)if(g){const s=gunScore(WIDS[g[0]],g[1]);if(s>bs){bs=s;best=g}}
 if(best){b.gun=WIDS[best[0]];b.rarD=RAR[best[1]].d}else{b.gun=WIDS[inv.m[0]];b.rarD=RAR[inv.m[1]].d}}
function brTake(p,iid,sl){const E=H.br;const it=E.items[iid];if(!it||!p||!p.alive||p.elim)return false;const dx=p.p[0]-it[4],dz=p.p[2]-it[6];if(Math.hypot(dx,dz)>3.6||Math.abs(p.p[1]-it[5])>3)return false;
 if(!it._lk&&(it[1]===0||it[1]===4)){it._lk=1;const lk=petLuck(p);if(lk&&it[3]<4&&Math.random()<lk)it[3]++}const r=brGive(p,it,sl);if(!r.ok){if(!p.bot&&r.why==='full')sendTo(p.id,{t:'bpf'});return false}delete E.items[iid];bcast({t:'lp',i:iid,by:p.id});
 if(r.dropped){const d=brItem(r.dropped[0],r.dropped[1],r.dropped[2],p.p[0]+rrand(-.6,.6),p.p[1],p.p[2]+rrand(-.6,.6),-1);bcast({t:'ld',it:d.slice(0,7)})}
 if(!p.bot)sendTo(p.id,{...invOut(p),it:it.slice(0,4)});return true}
function brOpen(p,cid){const E=H.br;const c=E.chests[cid];if(!c||c.open||!p||!p.alive||p.elim)return false;if(Math.hypot(p.p[0]-c.x,p.p[2]-c.z)>3.8||Math.abs(p.p[1]-c.y)>3)return false;
 c.open=1;if(c.sec)return brOpenSecret(p,c,cid);const out=[];const gi=gunItem(true);{const lk=petLuck(p);if(lk&&gi[2]<4&&Math.random()<lk*1.3)gi[2]++}{const mr=[0,2,3,4][c.tier|0]||0;if(gi[2]<mr)gi[2]=mr}out.push(gi);const ai=[1,ammoOf(WIDS[gi[1]]),0];out.push(ai);out.push(Math.random()<.5?[2,wrand([[0,35],[3,25],[1,20],[2,20]]),0]:[3,WIDX[wrand([['grenade',32],['smoke',22],['molotov',20],['flash',14],['decoy',12]])],0]);if(Math.random()<.4)out.push(gunItem(true));if(Math.random()<.5)out.push([2,wrand([[2,40],[3,60]]),0]);
 const items=out.map((o,i)=>{fixItem(o,true);const a=i/out.length*6.283+c.ry,r=1.1+Math.random()*.5;return brItem(o[0],o[1],o[2],c.x+Math.cos(a)*r,c.y,c.z+Math.sin(a)*r,-1).slice(0,7)});
 bcast({t:'cop',c:cid,it:items,by:p.id});return true}
const SECW=[['ar',24],['smg',18],['shotgun',14],['marksman',10],['sniper',10]];
function brOpenSecret(p,c,cid){const E=H.br;const out=[];const slotOf=c=>c==='smg'?1:c==='shotgun'?2:c==='sniper'||c==='marksman'?3:0;const c1=wrand(SECW),c2=wrand(SECW.filter(x=>slotOf(x[0])!==slotOf(c1)));
 for(const cl of [c1,c2]){const id=POOLS[cl][Math.random()*POOLS[cl].length|0];out.push([0,WIDX[id],5]);out.push([1,ammoOf(id),Math.round(AMV[ammoOf(id)]*2)])}
 out.push([2,2,1]);out.push([2,3,2]);out.push([2,1,1]);
 const items=out.map((o,i)=>{const a=i/out.length*6.283+c.ry,r=1.2+Math.random()*.5;return brItem(o[0],o[1],o[2],c.x+Math.cos(a)*r,c.y,c.z+Math.sin(a)*r,-1).slice(0,7)});
 bcast({t:'cop',c:cid,it:items,by:p.id,sec:1});return true}
function brDeathDrop(v){const E=H.br;if(!v.inv)return;const out=[];for(const g of v.inv.g)if(g)out.push([0,g[0],g[1]]);for(const e of(v.inv.bp||[]))out.push([e[0],e[1],e[2]]);if(v.inv.m[0]!==WIDX.fists&&v.inv.m[1]>0)out.push([4,v.inv.m[0],v.inv.m[1]]);if(v.inv.u&&v.inv.u[1]>0)out.push([3,v.inv.u[0],v.inv.u[1]]);if(v.inv.n&&v.inv.n[1]>0)out.push([3,v.inv.n[0],v.inv.n[1]]);
 for(let i=0;i<4;i++)if(v.inv.c[i]>0)out.push([2,i,v.inv.c[i]]);for(let i=0;i<4;i++)if(v.inv.res[i]>=10)out.push([1,i,v.inv.res[i]]);
 const items=out.map((o,i)=>{const a=i/out.length*6.283,r=.8+Math.random()*.6;return brItem(o[0],o[1],o[2],v.p[0]+Math.cos(a)*r,Math.max(0,v.p[1]),v.p[2]+Math.sin(a)*r,-1).slice(0,7)});if(items.length)bcast({t:'ldm',it:items});v.inv=newInv()}
function brElim(v,by){const E=H.br;if(!E||E.over||v.elim)return;v.elim=1;v.air=null;v.down=false;if(!v.bot||true)brDeathDrop(v);
 const k=H.players[by];if(k&&k!==v)E.kills[k.id]=(E.kills[k.id]||0)+1;
 const mates=H.mode==='brs'?plist().filter(q=>q.team===v.team):[v];const wiped=mates.every(q=>q.elim);let place=0,ids=[v.id];
 if(H.mode==='br'){place=plist().filter(q=>!q.elim).length+1}
 else if(wiped){const teams=new Set(plist().filter(q=>!q.elim).map(q=>q.team));place=teams.size+1;ids=mates.map(q=>q.id)}
 if(place){bcast({t:'brp',ids,place,n:plist().length,k:E.kills});}
 brCount();brCheck()}
function brCount(){const E=H.br;const al=plist().filter(q=>!q.elim);E.alive=al.length;E.squads=new Set(al.map(q=>q.team)).size;E.humans=al.filter(q=>!q.bot).length}
let brChk=0;
function brCheck(){const E=H.br;if(!E||E.over||H.phase!=='play'||brChk)return;brChk=1;try{
 // a squad with nobody left standing (everyone downed/dead) loses its downed members at once
 if(H.mode==='brs'){const by={};for(const q of plist())if(!q.elim)(by[q.team]=by[q.team]||[]).push(q);for(const t in by){const L=by[t];if(L.length&&L.every(q=>q.down)){for(const q of L)damage(q,9999,'storm',false,'bleed')}}}
 brCount();const teams=new Set(plist().filter(q=>!q.elim).map(q=>q.team));
 if(teams.size<=1&&E.ph==='play'){const win=[...teams][0];E.over=1;const names=plist().filter(q=>q.team===win&&!q.elim).map(q=>q.name);brEnd(win||'draw',names.join(' & '))}}finally{brChk=0}}
function brEnd(win,names){const E=H.br;H.phase='roundEnd';const ids=plist().filter(q=>q.team===win).map(q=>q.id);bcast({t:'brp',ids,place:1,n:plist().length,k:E.kills,win:1});
 const tk=ids.reduce((a,i)=>a+(E.kills[i]||0),0);bcast({t:'roundEnd',win,name:names||'',score:{},match:true,br:1,title:'VICTORY ROYALE',sub:(names||'nobody')+' · '+tk+' elimination'+(tk===1?'':'s'),k:E.kills});sendSB();
 H.matchOver=true;H.rem={};H.prevMap=H.map;clearTimeout(H.lobbyT);H.lobbyT=setTimeout(hostDecide,22000)}
function brJump(p){if(!p||p.air!=='bus')return;p.air='fall';const E=H.br;const hp=heliAt(H.t-E.t0);p.p[0]=hp[0];p.p[1]=E.y-3;p.p[2]=hp[1]}
// ---- bots ----
function brAirTick(b,dt){const e=b.e,E=H.br;
 if(b.air==='bus'){const hp=heliAt(H.t-E.t0);e.pos.set(hp[0],E.y,hp[1]);b.p=[hp[0],E.y,hp[1],b.yaw,0,WIDX.fists,32];if(H.t<E.t0)return;
  const dd=Math.hypot(hp[0]-b.tgt[0],hp[1]-b.tgt[1]);if(H.t-E.t0>=BRC.busDur-1||(H.t-E.t0>=b.jumpT&&dd<b.glide)||dd<b.glide*.55){b.air='fall'}return}
 const tx=b.tgt[0],tz=b.tgt[1];const dx=tx-e.pos.x,dz=tz-e.pos.z,dd=Math.hypot(dx,dz);const sp=b.air==='fall'?24:14;if(dd>.8){const k=Math.min(sp*dt,dd)/dd;e.pos.x+=dx*k;e.pos.z+=dz*k;b.yaw=Math.atan2(-dx,-dz)}
 if(b.air==='fall'){e.pos.y-=BRC.ft*dt;if(e.pos.y<=BRC.chuteY)b.air='chute'}else e.pos.y-=8*dt;
 if(e.pos.y<=.05){e.pos.y=0;b.air=null;e.ground=true;e.vel.set(0,0,0);b.goal=null;b.lootT=null;b.pickT=H.t;b.calm=H.t+12}
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX.fists,b.air==='fall'?16:b.air==='chute'?8:0]}
function brRoam(b,E){const s=E.storm;const cx=s.state==='shrink'||s.state==='final'?s.tcx:s.tcx,cz=s.state==='shrink'||s.state==='final'?s.tcz:s.tcz;const tr=Math.max(s.state==='wait'?s.tr:s.tr,3);const a=Math.random()*6.283,d=Math.random()*Math.max(2,tr*.7);return[cx+Math.cos(a)*d,cz+Math.sin(a)*d,0]}
function botBR(b,dt){const E=H.br,e=b.e,s=E.storm;if(!b.inv)b.inv=newInv();const px=e.pos.x,pz=e.pos.z;
 b.sitT=(b.sitT||0)-dt;
 // stuck watchdog: abandon the current loot target when we are not making progress
 b.wt=(b.wt||0)+dt;if(b.wt>3.5){b.wt=0;const m=Math.hypot(px-(b.wx||0),pz-(b.wz||0));b.wx=px;b.wz=pz;if(m<1.1&&b.goal){if(b.lootT){(b.bad=b.bad||{})[b.lootT]=1;b.lootT=null;b.stage=0}b.goal=null;b.stuck=(b.stuck||0)+1}}
 // 1) storm: leave the danger zone / head for the next safe circle
 const dC=Math.hypot(px-s.cx,pz-s.cz),fut=s.state==='wait'&&s.waitT-s.t>25&&dC<s.r-10?null:[s.tcx,s.tcz,s.tr];
 const toNext=fut&&Math.hypot(px-fut[0],pz-fut[1])>fut[2]-10;
 if(dC>s.r-4||toNext){const c=fut||[s.cx,s.cz];const dx=c[0]-px,dz=c[1]-pz,l=Math.hypot(dx,dz)||1;const d=Math.min(l,18);b.lootT=null;return[px+dx/l*d,pz+dz/l*d,0]}
 // 2) heal when hurt
 if(b.hp<65&&H.t>(b.healT||0)&&b.inv.c[0]+b.inv.c[1]>0&&!b.tgtNow){b.healT=H.t+6;const k=b.hp<40&&b.inv.c[1]>0?1:b.inv.c[0]>0?0:1;if(b.inv.c[k]>0){b.inv.c[k]--;b.hp=Math.min(k===0?75:100,b.hp+(k===0?15:100));bcast({t:'hp',id:b.id,hp:b.hp})}}
 if(b.hp>0&&(b.sh||0)<50&&H.t>(b.shT||0)&&b.inv.c[2]+b.inv.c[3]>0){b.shT=H.t+5;const k=b.inv.c[2]>0?2:3;b.inv.c[k]--;b.sh=Math.min(k===2?100:50,(b.sh||0)+(k===2?50:25))}
 // 3) squad bots stick near a human mate in squads
 if(H.mode==='brs'&&!b.lootT){const hm=plist().filter(q=>q.team===b.team&&!q.bot&&q.alive&&!q.elim);if(hm.length){const q=hm[0];const d=Math.hypot(q.p[0]-px,q.p[2]-pz);if(d>22)return[q.p[0]+rrand(-3,3),q.p[2]+rrand(-3,3),q.p[1]]}}
 // 4) loot
 if(!b.lootT||!E.items[b.lootT]){b.lootT=null;if(H.t>=(b.pickT||0)){b.pickT=H.t+1.2;let best=null,bd=1e9;const need=b.inv.g.filter(Boolean).length<2;
  for(const id in E.items){const it=E.items[id];if(b.bad&&b.bad[id])continue;if(it.claim&&it.claim!==b.id&&E.items[id])continue;const d=Math.hypot(it[4]-px,it[6]-pz)+Math.abs(it[5]-e.pos.y)*3;if(d>(b.sit?60:95))continue;
   let sc=d;const k=it[1];if(k===0){const tt=typeOfW(WIDS[it[2]]),og=b.inv.g[tt];const mine=gunScore(WIDS[it[2]],it[3]);if(!og)sc-=(need?18:8);else if(mine<=gunScore(WIDS[og[0]],og[1])*1.12)continue}
   else if(k===1){if(b.inv.res[it[2]]>90)continue;sc+=8}else if(k===2){if(b.inv.c[it[2]]>=CONMAX[it[2]])continue;sc+=4}else if(k===3){sc+=14}else if(k===4){if(b.inv.m[0]!==WIDX.fists)continue;sc+=10}
   if(sc<bd){bd=sc;best=id}}
  // chests are worth a detour
  let bch=null,cd=1e9;for(const c of E.chests){if(c.open||c.claim&&c.claim!==b.id)continue;const d=Math.hypot(c.x-px,c.z-pz)+Math.abs(c.y-e.pos.y)*3;if(d<cd&&d<(b.inv.g[0]?55:85)){cd=d;bch=c}}
  if(bch&&(!best||cd<bd+30)){b.lootC=bch.id;bch.claim=b.id;b.lootT=null;b.stage=0}else if(best){b.lootT=+best;E.items[best].claim=b.id;b.lootC=null;b.stage=0}}}
 // chest target
 if(b.lootC!=null&&!b.lootT){const c=E.chests[b.lootC];if(!c||c.open){b.lootC=null}else{const d=Math.hypot(c.x-px,c.z-pz);if(d<2.4&&Math.abs(c.y-e.pos.y)<2.5){brOpen(b,c.id);b.lootC=null;b.pickT=H.t+.6;return null}return brRoute(b,c.x,c.y,c.z,c.bd)}}
 if(b.lootT){const it=E.items[b.lootT];if(it){const d=Math.hypot(it[4]-px,it[6]-pz);if(d<1.6&&Math.abs(it[5]-e.pos.y)<2.5){brTake(b,it[0],b.inv.g[0]&&b.inv.g[1]?(gunScore(WIDS[b.inv.g[0][0]],b.inv.g[0][1])<=gunScore(WIDS[b.inv.g[1][0]],b.inv.g[1][1])?0:1):0);b.lootT=null;b.pickT=H.t+.15;return null}return brRoute(b,it[4],it[5],it[6],it.bd)}}
 // 5) roam the safe zone
 if(!b.goal||b.sitT<=0&&Math.random()<dt*.04){b.sitT=6+Math.random()*8;return brRoam(b,E)}
 return b.goal}
function brRoute(b,x,y,z,bd){const e=b.e;const d=bd>=0?H.br.doors[bd]:null;
 if(d){const inside=e.pos.x>d.x0-.3&&e.pos.x<d.x1+.3&&e.pos.z>d.z0-.3&&e.pos.z<d.z1+.3&&Math.abs(e.pos.y-(d.y||0))<4;const roof=y>(d.y||0)+2.2;
  if(!inside&&!roof){if(Math.hypot(e.pos.x-d.out[0],e.pos.z-d.out[1])>1.6&&!b.doorIn){return[d.out[0],d.out[1],d.y||0]}b.doorIn=1;return[d.in[0],d.in[1],d.y||0]}
  if(inside)b.doorIn=0}
 return[x,z,y]}
function brFar(){const E=H.br;const hum=plist().filter(q=>!q.bot&&q.alive&&!q.elim);for(const b of plist())if(b.bot){if(!b.alive||!b.e){b.far=0;continue}b.far=hum.length?!hum.some(q=>Math.hypot(q.p[0]-b.e.pos.x,q.p[2]-b.e.pos.z)<115):true}}
function brAbstract(){// bots far from every human fight abstractly (cheap): nearest enemy bot within 28 m trades damage
 const E=H.br;const bs=plist().filter(b=>b.bot&&b.alive&&!b.elim&&b.far&&!b.air&&b.e);for(const a of bs){let tg=null,td=28;for(const c of bs){if(c===a||c.team===a.team)continue;const d=Math.hypot(c.e.pos.x-a.e.pos.x,c.e.pos.z-a.e.pos.z);if(d<td){td=d;tg=c}}
  if(tg&&Math.random()<.7){const w=W[a.gun]||W.fists;const base=(w.pellets?w.body*w.pellets*.5:w.body)*Math.max(.3,1-td/60)*(w.melee?.5:1)*(a.rarD||1);const n=Math.max(1,Math.round(base*(w.rate<.15?4:2.5)*(.6+Math.random()*.8)));damage(tg,n,a.id,Math.random()<.12,a.gun)}}}
function brTick(dt){const E=H.br;if(!E)return;
 if(E.ph==='bus'&&H.t>=E.t0&&H.t-E.t0>=BRC.busDur){for(const p of plist())if(p.air==='bus'&&!p.bot){brJump(p);sendTo(p.id,{t:'bjf'})}E.ph='play'}
 if(H.t>=E.t0)stormTick(dt);
 E.farT+=dt;if(E.farT>.6){E.farT=0;brFar();brCount();if(E.humans===0)E.spd=Math.max(E.spd,4)}
 E.fightT+=dt;if(E.fightT>1.4){E.fightT=0;brAbstract()}
 E.lastBru+=dt;if(E.lastBru>.5){E.lastBru=0;bcast({t:'bru',bt:+(H.t-E.t0).toFixed(2),st:stormState(),al:E.alive,sq:E.squads})}}

function brScale(p,m){const wi=WIDX[m.w];let r=1;if(p.inv){const g=p.inv.g.find(g=>g&&g[0]===wi);if(g)r=RAR[g[1]].d;else if(p.inv.m[0]===wi)r=RAR[p.inv.m[1]].d}return(m.dmg|0)*r}

// ================= v44 BATTLE ROYALE (client side) =================
const RARC=['#b8bcc4','#4cd964','#3b9cff','#b35cff','#ffb81c','#ff2b2b'],RARH=[0xb8bcc4,0x4cd964,0x3b9cff,0xb35cff,0xffb81c,0xff2b2b];
const AMC=[0xf0b040,0x4cc07a,0xe0503a,0xa070e0];
const itemName=it=>{const k=it[1],a=it[2],b=it[3];if(k===0||k===4)return`${RAR[b|0].n[0]+RAR[b|0].n.slice(1).toLowerCase()} ${W[WIDS[a]].name}`;if(k===1)return`${b} ${AMN[a]} ammo`;if(k===2)return`${b}× ${CONN[a]}`;return`${W[WIDS[a]].name} ×${b}`};
const itemIcon=it=>{const k=it[1];return k===0||k===4?(ICON[WIDS[it[2]]]||''):k===1?'':k===2?'':(ICON[WIDS[it[2]]]||'')};
const itemCol=it=>{const k=it[1];return k===0||k===4?RARC[it[3]|0]:k===1?'#'+AMC[it[2]].toString(16).padStart(6,'0'):k===2?'#6ef0a0':'#ff9a40'};
const hash1=n=>{let x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const heliPos=(bt)=>{const h=BC.heli,k=bt/h.dur;return[h.a[0]+(h.b[0]-h.a[0])*k,h.a[1]+(h.b[1]-h.a[1])*k]};
function brBuild(){const B=BC;const g=B.g=new THREE.Group();g.name='brFx';scene.add(g);const CAP=1400;
 const mkIM=(geo,mat,n)=>{const im=new THREE.InstancedMesh(geo,mat,n);im.count=0;im.frustumCulled=false;im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);g.add(im);return im};
 B.imItem=mkIM(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff}),CAP);
 const ringG=new THREE.RingGeometry(.52,.66,24);ringG.rotateX(-Math.PI/2);
 B.imRing=mkIM(ringG,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}),CAP);
 const beamG=new THREE.CylinderGeometry(.09,.16,1,6,1,true);beamG.translate(0,.5,0);
 B.imBeam=mkIM(beamG,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),CAP);
 const nC=B.chests.length;
 {const K=chestKit(),n_=nC+4;const mk2=(geo,tm,mat)=>{const im=new THREE.InstancedMesh(geo,texMat(tm),n_);im.userData.tm=tm;im.count=0;im.frustumCulled=false;im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);g.add(im);return im};
  B.chBW=mk2(K.bodyW,'planks');B.chBM=mk2(K.bodyM,'metal');B.chLW=mk2(K.lidW,'planks');B.chLM=mk2(K.lidM,'metal');
  const gm=new THREE.MeshBasicMaterial({color:0xffffff,fog:false,toneMapped:false});B.chG=new THREE.InstancedMesh(K.glow,gm,n_);B.chG.count=0;B.chG.frustumCulled=false;B.chG.instanceMatrix.setUsage(THREE.DynamicDrawUsage);g.add(B.chG);
  const im2=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide});B.chI=new THREE.InstancedMesh(K.inner,im2,n_);B.chI.count=0;B.chI.frustumCulled=false;B.chI.instanceMatrix.setUsage(THREE.DynamicDrawUsage);g.add(B.chI);
}
  for(const c of B.chests){brChestGround(c);c.lidT=c.open?1:0}
 const cbm=new THREE.CylinderGeometry(.3,.5,1,8,1,true);cbm.translate(0,.5,0);
 B.imCBeam=mkIM(cbm,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),nC+4);
 // v58 secret weapon crates: glowing red, red beam
 B.sec=[];for(const c of B.chests)if(c.sec){const gr=new THREE.Group();const K=chestKit();
  const rm=(col,em,ei,met,rou)=>new THREE.MeshStandardMaterial({color:col,metalness:met,roughness:rou,emissive:em,emissiveIntensity:ei});const mb=rm(0x3a0a0a,0xff1010,.35,.55,.4),mm=rm(0x1a0404,0xff2020,.6,.8,.3);
  const sc=1.25;const root=new THREE.Group();root.scale.setScalar(sc);gr.add(root);
  root.add(new THREE.Mesh(K.bodyW,mb),new THREE.Mesh(K.bodyM,mm));const pivot=new THREE.Group();pivot.position.set(...CHEST_HINGE);root.add(pivot);pivot.add(new THREE.Mesh(K.lidW,mb),new THREE.Mesh(K.lidM,mm));
  const gl=new THREE.Mesh(K.glow,new THREE.MeshBasicMaterial({color:0xff4040,fog:false}));root.add(gl);
  const inner=new THREE.Mesh(K.inner,new THREE.MeshBasicMaterial({color:0xff3030,transparent:true,opacity:.0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));root.add(inner);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.17),new THREE.MeshBasicMaterial({color:0xff6a6a}));gem.position.y=1.45;gr.add(gem);
  const beamG2=new THREE.CylinderGeometry(.22,.55,70,10,1,true);beamG2.translate(0,35,0);const beam=new THREE.Mesh(beamG2,new THREE.MeshBasicMaterial({color:0xff1f1f,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));gr.add(beam);
  const rg=new THREE.RingGeometry(.9,1.15,28);rg.rotateX(-Math.PI/2);const ring=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({color:0xff2a2a,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));ring.position.y=.04;gr.add(ring);
  gr.position.set(c.x,c.fy,c.z);root.quaternion.copy(c.nq);gr.rotation.y=0;g.add(gr);B.sec.push({c,gr,root,pivot,beam,ring,gem,inner})}
 // storm wall + next safe-zone marker
 B.stormM=new THREE.Mesh(new THREE.CylinderGeometry(1,1,300,56,1,true),new THREE.MeshBasicMaterial({color:0x7a2cff,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false,fog:false}));B.stormM.position.y=140;B.stormM.frustumCulled=false;g.add(B.stormM);
 const rp=[];for(let i=0;i<=64;i++){const a=i/64*6.2832;rp.push(new THREE.Vector3(Math.cos(a),0,Math.sin(a)))}
 B.nextM=new THREE.Line(new THREE.BufferGeometry().setFromPoints(rp),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9,fog:false}));B.nextM.position.y=.6;B.nextM.frustumCulled=false;g.add(B.nextM);
 B.nextW=new THREE.Mesh(new THREE.CylinderGeometry(1,1,60,48,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false,fog:false}));B.nextW.position.y=30;B.nextW.frustumCulled=false;g.add(B.nextW);
 // battle airship (v48) + wind streaks + low clouds
 {const bus=makeBus();bus.visible=false;g.add(bus);B.heliM=bus;B.rotor={rotation:{y:0}};B.tail={rotation:{x:0}};
  B.wind=makeWind(GQ.level==='low'?40:90);g.add(B.wind);if(GQ.level!=='low'){B.clouds=makeCloudField(0,0,210,95,205);g.add(B.clouds)}}
 // my parachute canopy
 const cm=new THREE.Mesh(new THREE.SphereGeometry(2.6,14,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshLambertMaterial({color:0xff6a2a,side:THREE.DoubleSide,emissive:0x3a1000}));cm.scale.set(1,.7,1);cm.visible=false;g.add(cm);B.canopy=cm;
 brBaseMap();brRefresh()}
function brBaseMap(){const S=brHalf()*2,N=320,HF=S/2,cv=document.createElement('canvas');cv.width=cv.height=N;const x=cv.getContext('2d');const k=N/S;
 x.fillStyle='#2d5a7a';x.fillRect(0,0,N,N);x.fillStyle='#d9c88f';x.fillRect(3,3,N-6,N-6);x.fillStyle='#6b9a52';x.fillRect(9,9,N-18,N-18);
 for(const z of BC.zones){const g=x.createRadialGradient((z.x+HF)*k,(z.z+HF)*k,2,(z.x+HF)*k,(z.z+HF)*k,z.r*k);g.addColorStop(0,'rgba(120,120,110,.55)');g.addColorStop(1,'rgba(120,120,110,0)');x.fillStyle=g;x.beginPath();x.arc((z.x+HF)*k,(z.z+HF)*k,z.r*k,0,6.3);x.fill()}
 x.fillStyle='#8a8176';for(const c of cols){if(c.y1-c.y0<2.2||c.y0>1||c.x1-c.x0<2.4)continue;x.fillRect((c.x0+HF)*k,(c.z0+HF)*k,Math.max(1,(c.x1-c.x0)*k),Math.max(1,(c.z1-c.z0)*k))}
 BC.base=cv}
const MAP_ZC={};
function brDrawMap(cv,full){const B=BC;if(!B||!B.base)return;const x=cv.getContext('2d'),W_=cv.width,Hh=cv.height;x.clearRect(0,0,W_,Hh);
 let view,cx=0,cz=0;const BH=brHalf();if(full){view=BH*2+20;}else view=240;const px=me.pos.x,pz=me.pos.z;if(!full){cx=px;cz=pz}const sc=W_/view;
 const T=(wx,wz)=>[(wx-cx)*sc+W_/2,(wz-cz)*sc+Hh/2];
 x.save();if(!full){x.beginPath();x.arc(W_/2,Hh/2,W_/2-1,0,6.3);x.clip()}
 x.fillStyle='#2d5a7a';x.fillRect(0,0,W_,Hh);const o=T(-BH,-BH);x.imageSmoothingEnabled=true;x.drawImage(B.base,o[0],o[1],BH*2*sc,BH*2*sc);
 if(full){x.font='bold 13px sans-serif';x.textAlign='center';x.textBaseline='middle';for(const z of B.zones){const p=T(z.x,z.z);x.lineWidth=3;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(z.name,p[0],p[1]);x.fillStyle='#fff';x.fillText(z.name,p[0],p[1])}}
 const s=B.sdisp;if(B.storm){x.fillStyle='rgba(122,44,255,.38)';x.beginPath();x.rect(0,0,W_,Hh);const p=T(s.cx,s.cz);x.moveTo(p[0]+s.r*sc,p[1]);x.arc(p[0],p[1],Math.max(1,s.r*sc),0,6.2832,true);x.fill('evenodd');
  const n=T(B.storm.tcx,B.storm.tcz);x.strokeStyle='#fff';x.lineWidth=full?2:1.5;x.beginPath();x.arc(n[0],n[1],Math.max(1,B.storm.tr*sc),0,6.2832);x.stroke()}
 // helicopter path
 {const a=T(B.heli.a[0],B.heli.a[1]),b=T(B.heli.b[0],B.heli.b[1]);x.strokeStyle='rgba(255,230,120,.95)';x.setLineDash([6,5]);x.lineWidth=2;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();x.setLineDash([]);
  const bt=B.btNow||0;if(bt>-1&&bt<B.heli.dur+8){const hp=heliPos(bt),p=T(hp[0],hp[1]);x.fillStyle='#ffe066';x.beginPath();x.arc(p[0],p[1],5,0,6.3);x.fill();x.fillStyle='#000';x.font='bold 9px sans-serif';x.textAlign='center';x.fillText('🚁',p[0],p[1]-8)}}
 // v58 secret crate ping (nearby only)
 {const tt=performance.now()/1000;for(const o of(B.sec||[])){if(o.c.open)continue;const d=Math.hypot(o.c.x-px,o.c.z-pz);if(d>95)continue;const p=T(o.c.x,o.c.z);const k=(tt*1.3)%1;x.strokeStyle=`rgba(255,40,40,${(1-k)*.9})`;x.lineWidth=2;x.beginPath();x.arc(p[0],p[1],(full?6:5)+k*(full?18:14),0,6.3);x.stroke();x.fillStyle='#ff2b2b';x.strokeStyle='#fff';x.lineWidth=1;x.beginPath();x.moveTo(p[0],p[1]-6);x.lineTo(p[0]+5,p[1]);x.lineTo(p[0],p[1]+6);x.lineTo(p[0]-5,p[1]);x.closePath();x.fill();x.stroke()}}
 // squad mates + me
 for(const id in C.players){const q=C.players[id];if(id===me.id||!q.alive||isEnemy(q)||q.raider)continue;const p=T(q.rp.x,q.rp.z);x.fillStyle='#4aa8ff';x.beginPath();x.arc(p[0],p[1],4,0,6.3);x.fill();x.strokeStyle='#fff';x.lineWidth=1;x.stroke()}
 {const p=T(px,pz);x.save();x.translate(p[0],p[1]);x.rotate(-me.yaw);x.fillStyle='#ffd23f';x.strokeStyle='#000';x.lineWidth=1.5;x.beginPath();x.moveTo(0,-8);x.lineTo(6,6);x.lineTo(0,3);x.lineTo(-6,6);x.closePath();x.fill();x.stroke();x.restore()}
 x.restore();if(!full){x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=2;x.beginPath();x.arc(W_/2,Hh/2,W_/2-1,0,6.3);x.stroke()}}
function brHudInit(){let h=$('brHud');if(!h){h=document.createElement('div');h.id='brHud';$('hud').insertBefore(h,$('touch').nextSibling)}
 h.className='';h.innerHTML=`<canvas id="brMini" width="220" height="220"></canvas><div id="brAl"></div><div id="brStormT"></div><div id="brAir" class="hidden"></div><div id="brNear"></div><div id="brCons"></div><div id="brShBar"><i></i></div><div id="brCast" class="hidden"><i></i><span></span></div><button id="brMapBtn" class="pill">🗺️ MAP</button><button id="brBagBtn" class="pill">🎒 <span>0</span>/5<kbd>I</kbd></button><button id="brJumpBtn" class="btnBig yellow hidden">🚁 JUMP</button><div id="brOut" class="hidden"></div><div id="brMapWrap" class="hidden"><canvas id="brMapCv" width="720" height="720"></canvas><button id="brMapX" class="pill">✕ CLOSE</button></div><div id="brStormFx"></div><div id="brBag" class="hidden"></div>`;
 $('brMapBtn').onpointerdown=e=>{e.stopPropagation();e.preventDefault();brMap(true)};$('brMapX').onpointerdown=e=>{e.stopPropagation();e.preventDefault();brMap(false)};$('brMini').onpointerdown=e=>{e.stopPropagation();e.preventDefault();brMap(true)};
 $('brJumpBtn').onpointerdown=e=>{e.stopPropagation();e.preventDefault();inp.jump=true};
 $('brBagBtn').onpointerdown=e=>{e.stopPropagation();e.preventDefault();if(BC&&BC.air)return;brBag(!BC.bagOn)};brBagInit();
 const cb=$('brCons');cb.innerHTML=CONS.map((c,i)=>`<button class="bc" data-k="${i}"><b>${CONI[i]}</b><span>0</span></button>`).join('');
 cb.querySelectorAll('.bc').forEach(b=>b.onpointerdown=e=>{e.stopPropagation();e.preventDefault();brUse(+b.dataset.k)});
 $('brNear').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();e.preventDefault();brAct(b.dataset.k,+b.dataset.i)})}
const rn=r=>{const n=RAR[r|0].n;return n[0]+n.slice(1).toLowerCase()};
function gunStat(wi,r){const w=W[WIDS[wi]],R=RAR[r|0];const per=w.body*(w.pellets||1);return{dmg:Math.round(per*R.d),mag:w.mag?Math.round(w.mag*R.m):0,rl:w.reload?+(w.reload*R.rl).toFixed(1):0,rate:Math.round(60/(w.rate*R.fr)),melee:!!w.melee}}
function statLine(a,r,o){const x=gunStat(a,r);if(!o){return x.melee?`DMG ${x.dmg}`:`DMG ${x.dmg} · MAG ${x.mag} · RLD ${x.rl}s`}const y=gunStat(o[0],o[1]);const pc=y.dmg?Math.round((x.dmg/y.dmg-1)*100):0;return x.melee?`DMG ${y.dmg} → ${x.dmg} (${pc>=0?'+':''}${pc}%)`:`DMG ${y.dmg} → ${x.dmg} (${pc>=0?'+':''}${pc}%) · MAG ${y.mag} → ${x.mag}`}
function brNearBtn(n,i){const it=n[2],B=BC,col=itemCol(it),key=i===0&&!isTouch?'<kbd>E</kbd>':'';
 if(it[1]!==0&&it[1]!==4)return`<button data-k="i" data-i="${it[0]}" class="nb" style="border-color:${col}"><i style="background:${col}"></i><b>${esc(itemName(it))}</b>${key}</button>`;
 const pl=brPickPlan(B.inv,it,false);let tag='',cls='';
 if(pl.act==='swap'){const o=pl.old,nm=it[1]===0?(WIDS[o[0]]&&W[WIDS[o[0]]].name):W[WIDS[o[0]]].name;tag=`<span class="sw">⇄ SWAP (${rn(o[1])} → ${rn(it[3])})</span><small>${statLine(it[2],it[3],o)}</small><small>replaces ${esc(nm)}</small>`;cls=' swap'}
 else if(pl.act==='stash'){tag=`<span class="st">🎒 TO BACKPACK</span><small>${statLine(it[2],it[3])}</small>`;cls=' stashO'}
 else if(pl.act==='none'){tag=`<span class="no">${pl.why==='full'?'🎒 BACKPACK FULL':pl.why==='dup'?'ALREADY HAVE':'WORSE'}</span>`;cls=' dim'}
 else tag=`<span class="eq">${it[1]===4?'MELEE':TYN[typeOfW(WIDS[it[2]])]} SLOT · ${rn(it[3]).toUpperCase()}</span><small>${statLine(it[2],it[3])}</small>`;
 const room=(B.inv.bp||[]).length<BPN&&(pl.act==='equip'||pl.act==='swap');
 return`<div class="nbw"><button data-k="i" data-i="${it[0]}" class="nb${cls}" style="border-color:${col}"><i style="background:${col}"></i><div class="nbt"><b>${esc(itemName(it))}</b>${tag}</div>${key}</button>${room?`<button data-k="s" data-i="${it[0]}" class="nb stashB" title="Stash in backpack">🎒</button>`:''}</div>`}
function brBagInit(){const w=$('brBag');if(!w||w._i)return;w._i=1;let dr=null;const GH=()=>w.querySelector('#bagGhost')||document.createElement('div');
 const send_=(a,wh,i)=>{send({t:'bpm',a,w:wh,i});SFX.swap&&SFX.swap()};
 const typeSlot=(wh,i)=>{const B=BC;if(wh==='b'){const e=B.inv.bp[i];return e?e[0]===4?'m':String(typeOfW(WIDS[e[1]])):null}if(wh==='m')return B.inv.m[0]!==WIDX.fists?'m':null;return B.inv.g[i]?String(i):null};
 const itemAt=(wh,i)=>{const B=BC;if(wh==='b')return B.inv.bp[i]?B.inv.bp[i].slice(1):null;if(wh==='m')return B.inv.m[0]!==WIDX.fists?B.inv.m:null;return B.inv.g[i]};
 w.addEventListener('pointerdown',e=>{e.stopPropagation();const B=BC;if(!B)return;if(e.target.closest('#bagX')){brBag(false);return}
  const act=e.target.closest('[data-act]');if(act){const sel=B.bagSel;if(!sel)return;if(act.dataset.act==='eq')send_('eq','b',sel.i);else if(act.dataset.act==='st')send_('st',sel.w,sel.i);else if(act.dataset.act==='dr')send_('dr',sel.w,sel.i);B.bagSel=null;return}
  const c=e.target.closest('.bq,.bb');if(!c){return}const wh=c.dataset.w,i=+c.dataset.i||0;
  if(itemAt(wh,i)){dr={wh,i,x:e.clientX,y:e.clientY,on:false,id:e.pointerId};try{c.setPointerCapture(e.pointerId)}catch(x){}}else{B.bagSel=null;brBagRender()}});
 w.addEventListener('pointermove',e=>{if(!dr||e.pointerId!==dr.id)return;if(!dr.on&&Math.hypot(e.clientX-dr.x,e.clientY-dr.y)>9){dr.on=true;const it=itemAt(dr.wh,dr.i),ghost=GH();ghost.innerHTML=`<img src="${ICON[WIDS[it[0]]]||''}" alt="">`;ghost.style.borderColor=RARC[it[1]|0];ghost.classList.remove('hidden');$('bagDrop')&&$('bagDrop').classList.add('on')}
  if(dr.on){const r=w.getBoundingClientRect(),ghost=GH();ghost.style.left=(e.clientX-r.left-30)+'px';ghost.style.top=(e.clientY-r.top-24)+'px'}});
 const end=e=>{if(!dr||e.pointerId!==dr.id)return;const B=BC,d=dr;dr=null;GH().classList.add('hidden');$('bagDrop')&&$('bagDrop').classList.remove('on');if(!B)return;
  if(!d.on){const same=B.bagSel&&B.bagSel.w===d.wh&&B.bagSel.i===d.i;B.bagSel=same?null:{w:d.wh,i:d.i};brBagRender();return}
  const el=document.elementFromPoint(e.clientX,e.clientY);const tq=el&&el.closest('.bq'),tb=el&&el.closest('.bb,.bagB'),td=el&&el.closest('#bagDrop');const ts=typeSlot(d.wh,d.i);
  if(td)send_('dr',d.wh,d.i);
  else if(tq&&d.wh==='b'){const want=tq.dataset.w==='m'?'m':tq.dataset.i;if(want===ts)send_('eq','b',d.i);else center('Wrong slot — that gun goes in '+(ts==='m'?'MELEE':TYN[+ts]),900)}
  else if(tb&&d.wh!=='b')send_('st',d.wh,d.i);
  else if(!el||!el.closest('#brBag .bagBox'))send_('dr',d.wh,d.i);
  B.bagSel=null;brBagRender()};
 w.addEventListener('pointerup',end);w.addEventListener('pointercancel',e=>{if(dr&&e.pointerId===dr.id){dr=null;GH().classList.add('hidden');$('bagDrop')&&$('bagDrop').classList.remove('on')}});w.addEventListener('dragstart',e=>e.preventDefault())}
function brBagRender(){const B=BC,w=$('brBag');if(!B||!w||!B.bagOn)return;const bp=B.inv.bp||[];const sel=B.bagSel;
 const cell=(cls,wh,i,it,label)=>{const on=sel&&sel.w===wh&&sel.i===i;if(!it)return`<div class="${cls} empty${on?' sel':''}" data-w="${wh}" data-i="${i}"><em>${label}</em></div>`;const id=WIDS[it[0]];const col=RARC[it[1]|0];return`<div class="${cls}${on?' sel':''}" data-w="${wh}" data-i="${i}" style="border-color:${col};box-shadow:0 0 8px ${col}66"><img src="${ICON[id]||''}" alt=""><b>${esc(W[id].name)}</b><small style="color:${col}">${rn(it[1])} · ${gunStat(it[0],it[1]).dmg}</small>${label?`<u>${label}</u>`:''}</div>`};
 let q='';for(let t=0;t<4;t++)q+=cell('bq','t',t,B.inv.g[t],TYN[t]);q+=cell('bq','m',0,B.inv.m[0]!==WIDX.fists?B.inv.m:null,'MELEE');
 let b='';for(let i=0;i<BPN;i++)b+=cell('bb','b',i,bp[i]?bp[i].slice(1):null,'');
 let act='<span class="hint">Tap an item, then choose — or drag it. Drag to ⬇ DROP to throw it away.</span>';
 if(sel){const it=sel.w==='b'?(bp[sel.i]&&bp[sel.i].slice(1)):sel.w==='m'?(B.inv.m[0]!==WIDX.fists?B.inv.m:null):B.inv.g[sel.i];if(it){act=sel.w==='b'?`<button data-act="eq" class="pill yellow">⇄ EQUIP</button>`:`<button data-act="st" class="pill" ${bp.length>=BPN?'disabled':''}>🎒 STASH</button>`;act+=`<button data-act="dr" class="pill red">⬇ DROP</button><b class="selN">${esc(itemName([0,sel.w==='m'?4:0,it[0],it[1]]))}</b>`}else B.bagSel=null}
 w.innerHTML=`<div class="bagBox"><div class="bagH"><b>🎒 INVENTORY</b><span class="bagN">${bp.length}/${BPN}</span><button id="bagX" class="pill sm">✕</button></div><div class="bagS">QUICK SLOTS</div><div class="bagQ">${q}</div><div class="bagS">BACKPACK</div><div class="bagB">${b}</div><div class="bagAct">${act}</div><div id="bagDrop">⬇ DROP</div></div><div id="bagGhost" class="hidden"></div>`;
 const g=w.querySelector('#bagGhost');if(g)w._g=g}
function brBag(on){const B=BC;if(!B)return;const w=$('brBag');if(!w)return;B.bagOn=!!on;w.classList.toggle('hidden',!on);if(on){if(document.pointerLockElement)document.exitPointerLock();B.bagSel=null;brBagRender()}}
function brMap(on){const w=$('brMapWrap');if(!w)return;w.classList.toggle('hidden',!on);if(on){brDrawMap($('brMapCv'),true);if(document.pointerLockElement)document.exitPointerLock()}BC.mapOn=on}
function brClear(){if(!BC)return;try{BC.bagOn=false}catch(e){}try{scene.remove(BC.g)}catch(e){}if(BC.saved)me.load=BC.saved;for(const k of['air'])me[k]=null;BC=null;const h=$('brHud');if(h)h.className='hidden';vmRoot.visible=true}
function brClientInit(info){brClear();BC={bank:0,half:info.half,y:info.y,heli:info.heli,zones:info.zones||[],items:new Map(),chests:info.chests.map(c=>({id:c[0],x:c[1],y:c[2],z:c[3],ry:c[4],open:!!c[5],sec:!!c[6],tier:c[6]?4:(c[7]|0)})),bt0:-3,btAt:performance.now(),btNow:-3,storm:null,sdisp:{cx:0,cz:0,r:300},
  inv:{g:[null,null,null,null],bp:[],m:[WIDX.fists,0],u:null,n:null,c:[0,0,0,0]},res:[0,0,0,0],sh:0,air:null,kills:0,al:0,sq:0,cast:null,paid:0,saved:me.load.slice(0,4),gk:['','','',''],bagOn:false,bagSel:null,near:[],nearK:'',pkT:{},dirty:1,placed:0,spec:null,scan:0,mapT:0,chT:0,hT:0,wT:0,stT:0,mapOn:false};
 for(const it of info.items)BC.items.set(it[0],it);me.load=['fists','fists','fists','grenade','fists','fists'];me.ammo=[0,0,0,0,0,0];me.utilN=0;brBuild();brHudInit();brApplyInv(true)}
function brRoundStart(){const B=BC;B.air='bus';me.air='bus';B.inv={g:[null,null,null,null],bp:[],m:[WIDX.fists,0],u:null,n:null,c:[0,0,0,0]};B.res=[0,0,0,0];B.sh=0;B.gk=['','','',''];brBag(false);B.cast=null;B.placed=0;B.paid=0;B.kills=0;B.spec=null;me.cur=2;brApplyInv(true);
 $('brOut').classList.add('hidden');me.frozen=false;me.hp=100;updHP();for(const k in B.pkT)delete B.pkT[k];
 center('🚁 YOU ARE ON THE BATTLE BUS\nPress JUMP to drop',3500)}
function brApplyInv(force){const B=BC,iv=B.inv;let changed=false;if(!iv.bp)iv.bp=[];
 for(let t=0;t<4;t++){const g=iv.g[t],key=g?g[0]+':'+g[1]:'',sl=TS[t];if(B.gk[t]!==key||force){B.gk[t]=key;me.load[sl]=g?WIDS[g[0]]:'fists';me.ammo[sl]=g?magOf(me.load[sl]):0;changed=true}}
 me.load[2]=WIDS[iv.m[0]];if(iv.u){me.load[3]=WIDS[iv.u[0]];me.utilN=iv.u[1]}else{me.load[3]='grenade';me.utilN=0}if(iv.n&&iv.n[1]<=0)iv.n=null;
 const anyG=iv.g.some(Boolean);if(!brHas(me.cur)||(me.cur===2&&anyG&&changed&&B.air==null)){me.cur=BRORD.find(s=>s!==2&&brHas(s))??2;changed=true}
 if(changed||force){me.reloadT=0;setViewModel(me.load[me.cur]);me.switchT=.3;VMkey=null}buildSlots();brHudUpd();if(B.bagOn)brBagRender()}
let VMkey=null;
function brSlotStyle(){if(!BC)return;document.querySelectorAll('#slots .sl').forEach(el=>{const sl=+el.dataset.s;if(sl===3)return;const t=S2T[sl];const g=t!=null?BC.inv.g[t]:(BC.inv.m[0]!==WIDX.fists?BC.inv.m:null);if(!g){el.style.borderColor='';el.style.boxShadow='';return}el.style.borderColor=RARC[(t!=null?g[1]:g[1])|0];el.style.boxShadow=`0 0 8px ${RARC[g[1]|0]}`})}
function brHas(s){return s===3||(s===2?true:!!BC.inv.g[S2T[s]])}
function brHudUpd(){const B=BC;if(!B)return;const bb=$('brBagBtn');if(bb)bb.firstElementChild.textContent=(B.inv.bp||[]).length;document.querySelectorAll('#brCons .bc').forEach((b,i)=>{b.querySelector('span').textContent=B.inv.c[i];b.classList.toggle('off',B.inv.c[i]<=0)});
 const sh=$('brShBar');if(sh){sh.firstChild.style.width=Math.min(100,B.sh)+'%';sh.style.opacity=B.sh>0?1:.35}
 $('brAl').innerHTML=`👥 <b>${B.al||'-'}</b>${C.mode==='brs'?` <small>${B.sq||'-'} squads</small>`:''} · ☠️ <b>${B.kills}</b>`}
function brJumpOut(){const B=BC;if(B.air!=='bus'||!me.alive)return;B.air=me.air='fall';me.vel.set(0,-10,0);send({t:'bj'});SFX.whoosh&&SFX.whoosh();center('FREEFALL',1200)}
function brLand(){const B=BC;B.air=me.air=null;B.cp=null;B.camLast=null;B.fT=0;TPV.dist=Math.max(TPV.dist||0,(TPV.d||3)+4);me.vel.set(0,0,0);send({t:'bl'});me.cur=BRORD.find(s=>s!==2&&brHas(s))??2;setViewModel(me.load[me.cur]);me.switchT=.3;SFX.land&&SFX.land();landDip=.25;center('Landed — find a weapon!',1800)}
function brSendSt(flags){send({t:'st',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(3),+me.pitch.toFixed(2),WIDX[me.load[me.cur]]|0,flags]})}
function brAirMe(dt){const B=BC;if(isTouch)applyTouchLook(dt);let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}if(!me.alive)mx=mz=0;vmRoot.visible=false;me.camH=1.62;
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 B.stT+=dt;let fl=0;
 if(B.air==='bus'){const hp=heliPos(B.btNow);me.pos.set(hp[0],B.y-2.4,hp[1]);me.vel.set(0,0,0);me.ground=false;fl=32;if(inp.jump&&C.phase==='play'&&B.btNow>-.5)brJumpOut();inp.jump=false}
 else{const fall=B.air==='fall';const hv=fall?(mz<-.3?24:20):14;me.vel.x+=(wx*hv-me.vel.x)*Math.min(1,dt*2.5);me.vel.z+=(wz*hv-me.vel.z)*Math.min(1,dt*2.5);me.vel.y=fall?-BRC.ft:-8.5;
  if(inp.jump){if(fall&&me.pos.y<B.y-18){B.air=me.air='chute';SFX.swap&&SFX.swap();center('GLIDER DEPLOYED',900)}inp.jump=false}
  if(B.air==='fall'&&me.pos.y<=BRC.chuteY){B.air=me.air='chute';SFX.swap&&SFX.swap();center('GLIDER DEPLOYED',900)}
  physStep(me,dt);me.pos.x=Math.max(-196,Math.min(196,me.pos.x));me.pos.z=Math.max(-196,Math.min(196,me.pos.z));fl=(B.air==='fall'?16:8)|2;
  if(me.ground||me.pos.y<=.02){me.pos.y=Math.max(me.pos.y,0);brLand();fl=0}
  else if(me.pos.y<-3){me.pos.y=0}}
 if(B.stT>=.05){B.stT=0;if(me.alive)brSendSt(fl)}
 B.bank+=((mx*(B.air==='chute'?1:.7))-B.bank)*Math.min(1,dt*4);
 if(TPV.on&&B.air)brAirCam(dt);else{camera.position.set(me.pos.x,me.pos.y+1.62,me.pos.z);camera.rotation.set(me.pitch,me.yaw,0)}
 const a=$('brAir');if(B.air){a.classList.remove('hidden');const alt=Math.max(0,Math.round(me.pos.y));a.innerHTML=B.air==='bus'?`🎈 BATTLE BUS<br><small>${B.btNow<0?'Departing…':'JUMP to drop · MAP to plan'}</small>`:`${B.air==='fall'?'🪂 FREEFALL':'🪂 GLIDING'} · <b>${alt}</b> m<br><small>${B.air==='fall'?'JUMP = deploy glider':'steer to your landing spot'}</small>`}else a.classList.add('hidden');
 $('brJumpBtn').classList.toggle('hidden',!(isTouch&&(B.air==='bus'||B.air==='fall')))}
const _bc=new THREE.Vector3(),_bd=new THREE.Vector3(),_bl=new THREE.Vector3();
// third-person air camera: orbit the airship, chase the skydiver, trail the glider (smoothed; look direction = mouse/touch look)
function brAirCam(dt){const B=BC,a=B.air,cy=Math.cos(me.pitch);_bd.set(-Math.sin(me.yaw)*cy,Math.sin(me.pitch),-Math.cos(me.yaw)*cy);TPV.hide=false;
 let dist,up,fov,ahead;
 if(a==='bus'){const hm=B.heliM;_bc.set(hm.position.x,hm.position.y+2.2,hm.position.z);dist=15;up=1.0;fov=64;ahead=0}
 else if(a==='fall'){_bc.set(me.pos.x,me.pos.y+1.1,me.pos.z);const sp=Math.min(1,(B.fT=(B.fT||0)+dt)/2);dist=6.8;up=1.5;fov=70+8*sp;ahead=3}
 else{_bc.set(me.pos.x,me.pos.y+1.6,me.pos.z);dist=8.6;up=1.6;fov=68;ahead=3}
 B.camGoal=B.camGoal||new THREE.Vector3();B.camGoal.copy(_bc).addScaledVector(_bd,-dist);B.camGoal.y+=up;B.camGoal.y=Math.max(B.camGoal.y,1.0);
 const k=B.camLast===a?Math.min(1,dt*(a==='bus'?20:9)):1;if(B.camLast!==a)B.camLast=a;
 if(!B.cp)B.cp=new THREE.Vector3().copy(B.camGoal);B.cp.lerp(B.camGoal,k);camera.position.copy(B.cp);
 _bl.copy(_bc).addScaledVector(_bd,ahead);camera.lookAt(_bl);if(a==='chute')camera.rotateZ(-B.bank*.1);
 if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*Math.min(1,dt*4);camera.updateProjectionMatrix()}}
function brRefresh(){const B=BC;if(!B)return;B.dirty=0;const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),sv=new THREE.Vector3(),pv=new THREE.Vector3(),col=new THREE.Color();let n=0,nb=0;const CAP=1400;const cx0=camera.position.x,cz0=camera.position.z;B.rfx=cx0;B.rfz=cz0;
 for(const it of B.items.values()){if(n>=CAP)break;const k=it[1];const r0=(k===0||k===4)?(it[3]|0):0;if(r0<1&&(it[4]-cx0)*(it[4]-cx0)+(it[6]-cz0)*(it[6]-cz0)>12100)continue;e.set(0,hash1(it[0])*6.28,0);q.setFromEuler(e);
  if(k===0)sv.set(.95,.12,.3);else if(k===4)sv.set(.7,.08,.16);else if(k===1)sv.set(.34,.24,.34);else sv.set(.3,.3,.3);
  pv.set(it[4],it[5]+sv.y/2+.06,it[6]);m4.compose(pv,q,sv);B.imItem.setMatrixAt(n,m4);col.set(itemCol(it));B.imItem.setColorAt(n,col);
  sv.set(1.1,1,1.1);pv.set(it[4],it[5]+.04,it[6]);q.identity();m4.compose(pv,q,sv);B.imRing.setMatrixAt(n,m4);B.imRing.setColorAt(n,col);n++;
  const r=(k===0||k===4)?(it[3]|0):0;if(r>=1&&nb<CAP){sv.set(1,2.5+r*1.6,1);pv.set(it[4],it[5],it[6]);m4.compose(pv,q,sv);B.imBeam.setMatrixAt(nb,m4);B.imBeam.setColorAt(nb,col);nb++}}
 B.imItem.count=n;B.imRing.count=n;B.imBeam.count=nb;for(const im of[B.imItem,B.imRing,B.imBeam]){im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true}
 brChestMats()}
const lidAng=t=>1.95*(1-Math.pow(1-Math.min(1,t),3))+(t<1?.16*Math.sin(Math.min(1,t)*Math.PI):0);
const _chM=new THREE.Matrix4(),_chH=new THREE.Matrix4(),_chR=new THREE.Matrix4(),_chL=new THREE.Matrix4(),_chS=new THREE.Vector3(1,1,1),_chP=new THREE.Vector3(),_chC=new THREE.Color();
function brChestMats(){const B=BC;if(!B||!B.chBW)return;let n=0,ni=0,nb=0;const cx0=camera.position.x,cz0=camera.position.z;
 for(const c of B.chests){if(c.sec||!c.nq)continue;if((c.x-cx0)*(c.x-cx0)+(c.z-cz0)*(c.z-cz0)>8100){if(!c.open){_chP.set(c.x,c.fy,c.z);_chS.set(1,16,1);_chL.compose(_chP,B.qId||(B.qId=new THREE.Quaternion()),_chS);_chS.set(1,1,1);B.imCBeam.setMatrixAt(nb,_chL);_chC.setHex(TIERC[c.tier|0]);B.imCBeam.setColorAt(nb,_chC);nb++}continue}_chP.set(c.x,c.fy,c.z);_chM.compose(_chP,c.nq,_chS);B.chBW.setMatrixAt(n,_chM);B.chBM.setMatrixAt(n,_chM);
  _chH.makeTranslation(CHEST_HINGE[0],CHEST_HINGE[1],CHEST_HINGE[2]);_chR.makeRotationX(-lidAng(c.lidT||0));_chL.copy(_chM).multiply(_chH).multiply(_chR);B.chLW.setMatrixAt(n,_chL);B.chLM.setMatrixAt(n,_chL);
  _chC.setHex(TIERC[c.tier|0]);_chC.multiplyScalar(c.open?.5:1.6);B.chG.setMatrixAt(n,_chM);B.chG.setColorAt(n,_chC);
  if(c.open&&(c.lidT||0)>.1){B.chI.setMatrixAt(ni,_chM);_chC.setHex(TIERC[c.tier|0]);B.chI.setColorAt(ni,_chC);ni++}
  if(!c.open){_chP.set(c.x,c.fy,c.z);_chS.set(1,16,1);_chL.compose(_chP,B.qId||(B.qId=new THREE.Quaternion()),_chS);_chS.set(1,1,1);B.imCBeam.setMatrixAt(nb,_chL);_chC.setHex(TIERC[c.tier|0]);B.imCBeam.setColorAt(nb,_chC);nb++}
  n++}
 B.chBW.count=B.chBM.count=B.chLW.count=B.chLM.count=B.chG.count=n;B.chI.count=ni;B.imCBeam.count=nb;
 for(const im of[B.chBW,B.chBM,B.chLW,B.chLM,B.chG,B.chI,B.imCBeam]){im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true}}
// flush placement: ray down from above onto the surface at the centre and four corners of the chest footprint, then tilt to the fitted plane
function chestH(x,z,y0){const o=new THREE.Vector3(x,y0+1.6,z);const t=rayWorld(o,new THREE.Vector3(0,-1,0),3.4);if(t<3.3)return o.y-t;return gndAt(x,z,y0)}
function brChestGround(c){const hx=.5,hz=.32,cs=Math.cos(c.ry),sn=Math.sin(c.ry);const P=[[0,0],[hx,hz],[-hx,hz],[hx,-hz],[-hx,-hz]];
 const h=P.map(([a,b])=>chestH(c.x+a*cs+b*sn,c.z-a*sn+b*cs,c.y));const lo=Math.min(...h),hi=Math.max(...h);const qy=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),c.ry);
 if(hi-lo<.45&&hi-lo>.01){const dA=((h[1]+h[3])-(h[2]+h[4]))/(4*hx),dB=((h[1]+h[2])-(h[3]+h[4]))/(4*hz),yc=(h[1]+h[2]+h[3]+h[4])/4;let lift=0;for(let i=0;i<5;i++)lift=Math.max(lift,h[i]-(yc+dA*P[i][0]+dB*P[i][1]));
  const nl=new THREE.Vector3(-dA,1,-dB).normalize();const qt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),nl);c.fy=yc+lift;c.nq=qy.clone().multiply(qt)}
 else{c.fy=hi;c.nq=qy}c.gy=c.fy}
function brAct(k,i){if(!BC||!me.alive||BC.air)return;if(k==='c'){send({t:'co',c:i});BC.chT=-1}else{BC.pkT[i]=performance.now();send({t:'pk',i,s:k==='s'?9:0});SFX.swap&&SFX.swap()}}
function brUse(k){const B=BC;if(!B||!me.alive||me.down||B.air||B.cast||B.inv.c[k]<=0)return;if(k===0&&me.hp>=75)return center('Health is above 75',700);if(k===1&&me.hp>=100)return center('Health is full',700);if(k===2&&B.sh>=100)return center('Shield is full',700);if(k===3&&B.sh>=50)return center('Shield is above 50 (mini)',700);
 B.cast={k,t:0,d:CONT[k]};$('brCast').classList.remove('hidden');$('brCast').querySelector('span').textContent='Using '+CONN[k]+'…';SFX.swap&&SFX.swap()}
function brCancelCast(){if(BC&&BC.cast){BC.cast=null;$('brCast').classList.add('hidden')}}
function brStormTick(){if(typeof noise==='function'&&AC)noise('lowpass',420,1,.25,.22,out())}
function brFrame(dt,now){const B=BC;if(!B)return;B.btNow=B.bt0+(now-B.btAt)/1000;const bt=B.btNow;
 if(B.dirty)brRefresh();
 // helicopter
 const hm=B.heliM;if(bt<B.heli.dur+14){const k=Math.max(0,bt);const h=B.heli,t=Math.min(k,h.dur+14)/h.dur;const x=h.a[0]+(h.b[0]-h.a[0])*t,z=h.a[1]+(h.b[1]-h.a[1])*t;hm.visible=true;hm.position.set(x,B.y-2.4,z);hm.rotation.y=Math.atan2(-(h.b[0]-h.a[0]),-(h.b[1]-h.a[1]));hm.userData.update(dt,performance.now()/1000);
  if(B.air==='bus'||bt<B.heli.dur){B.hT-=dt;if(B.hT<=0&&AC){B.hT=.16;const d=Math.hypot(camera.position.x-x,camera.position.y-B.y,camera.position.z-z);const v=Math.max(0,1-d/260);if(v>0)tone(58,.1,.2*v,'square',40,out())}}}else hm.visible=false;
 // my canopy
 B.canopy.visible=me.air==='chute'&&!TPV.on;if(B.canopy.visible)B.canopy.position.set(me.pos.x,me.pos.y+3.2,me.pos.z);
 if(B.wind){const fall=me.air==='fall',gl=me.air==='chute';B.wind.userData.update(dt,_v.set(me.pos.x,me.pos.y+1.2,me.pos.z),fall||gl?me.vel:_v2.set(0,-1,0),fall?1:gl?.22:0)}
 // storm
 const s=B.storm,sd=B.sdisp;if(s){const a=Math.min(1,dt*5);if(B.first){sd.cx=s.cx;sd.cz=s.cz;sd.r=s.r;B.first=0}else{sd.cx+=(s.cx-sd.cx)*a;sd.cz+=(s.cz-sd.cz)*a;sd.r+=(s.r-sd.r)*a}
  B.stormM.position.x=sd.cx;B.stormM.position.z=sd.cz;B.stormM.scale.set(sd.r,1,sd.r);B.nextM.position.x=s.tcx;B.nextM.position.z=s.tcz;B.nextM.scale.set(s.tr,1,s.tr);B.nextW.position.x=s.tcx;B.nextW.position.z=s.tcz;B.nextW.scale.set(s.tr,1,s.tr);
  const out_=Math.hypot(me.pos.x-sd.cx,me.pos.z-sd.cz)>sd.r&&me.alive&&B.air!=='bus';if(out_!==B.inStorm){B.inStorm=out_;$('brStormFx').style.opacity=out_?1:0;if(out_)center('⚠ YOU ARE IN THE STORM',1200)}
  if(out_){B.wT-=dt;if(B.wT<=0){B.wT=1;brStormTick()}}
  const t=$('brStormT');const lbl=s.state==='wait'?(s.ph<=0?'Storm forming':'Storm shrinks in'):s.state==='shrink'?'Storm closing':'Final circle';const txt=s.state==='final'?lbl:`${lbl} ${Math.max(0,Math.floor((s.left-(now-B.stAt)/1000)))}s`;if(t.textContent!==txt)t.textContent=txt;t.style.color=s.state==='shrink'?'#ff7a7a':'#fff'}
 // pickups / chests (5 Hz)
 B.scan-=dt;if(B.scan<=0&&me.alive&&!B.air){B.scan=.2;const near=[];const px=me.pos.x,py=me.pos.y,pz=me.pos.z;for(const it of B.items.values()){const dx=it[4]-px,dz=it[6]-pz;if(dx*dx+dz*dz>9||Math.abs(it[5]-py)>2.4)continue;near.push([dx*dx+dz*dz,'i',it])}
  for(const c of B.chests){if(c.open)continue;const dx=c.x-px,dz=c.z-pz;if(dx*dx+dz*dz>12||Math.abs(c.y-py)>2.4)continue;near.push([dx*dx+dz*dz-2,'c',c])}
  near.sort((a,b)=>a[0]-b[0]);B.near=near.slice(0,4);
  for(const n of near)if(n[1]==='i'&&n[2][1]===1&&n[0]<3.2&&performance.now()-(B.pkT[n[2][0]]||0)>900){B.pkT[n[2][0]]=performance.now();send({t:'pk',i:n[2][0],s:0})}
  const key=B.near.map(n=>n[1]+(n[1]==='i'?n[2][0]:n[2].id)).join(',')+'|'+B.inv.g.map(g=>g?g[0]+g[1]:'').join()+'|'+B.inv.m.join()+'|'+(B.inv.bp||[]).length;if(key!==B.nearK){B.nearK=key;const h=B.near.map((n,i)=>n[1]==='c'?`<button data-k="c" data-i="${n[2].id}" class="nb chest${n[2].sec?' secret':''}"><b>${n[2].sec?'🔴 OPEN SECRET CRATE':'📦 OPEN CHEST'}</b>${i===0&&!isTouch?'<kbd>E</kbd>':''}</button>`:brNearBtn(n,i)).join('');$('brNear').innerHTML=h}}
 else if(me.alive===false||B.air){if(B.nearK!==''){B.nearK='';$('brNear').innerHTML=''}}
 // secret crates: pulse + distinct alarm sound when close
 B.rfT=(B.rfT||0)-dt;if(B.rfT<=0){B.rfT=.5;if(Math.hypot(camera.position.x-(B.rfx??1e9),camera.position.z-(B.rfz??1e9))>8)brRefresh()}
  {let mv=false;for(const c of B.chests){const tg=c.open?1:0;if(c.lidT!==tg){const d=Math.sign(tg-c.lidT)*dt*1.8;c.lidT=Math.abs(tg-c.lidT)<=Math.abs(d)?tg:c.lidT+d;mv=true}}if(mv)brChestMats();if(B.sec)for(const o of B.sec){o.pivot.rotation.x=-lidAng(o.c.lidT||0);o.inner.material.opacity=.85*(o.c.lidT||0);o.beam.visible=o.ring.visible=o.gem.visible=!o.c.open}}
 if(B.sec){const tt=now/1000;for(const o of B.sec){if(o.c.open)continue;o.beam.material.opacity=.38+.16*Math.sin(tt*3+o.c.id);o.ring.scale.setScalar(1+.25*((tt*1.2+o.c.id*.3)%1));o.ring.material.opacity=.8*(1-((tt*1.2+o.c.id*.3)%1));o.gem.rotation.y=tt*2;o.gem.position.y=1.15+Math.sin(tt*2.4)*.08}
  B.sT=(B.sT||0)-dt;if(B.sT<=0&&me.alive&&AC&&!B.air){B.sT=1.05;let bd=1e9;for(const o of B.sec){if(o.c.open)continue;const d=Math.hypot(o.c.x-me.pos.x,o.c.z-me.pos.z);if(d<bd)bd=d}if(bd<45){const v=Math.max(.03,(1-bd/45))*.22;tone(196,.5,v,'sawtooth',98,out());setTimeout(()=>{tone(311,.35,v*.7,'square',0,out());tone(466,.5,v*.5,'triangle',233,out())},170)}}}
 // chest chimes
 B.chT-=dt;if(B.chT<=0&&me.alive&&AC&&!B.air){B.chT=1.3;let bd=1e9;for(const c of B.chests){if(c.open)continue;const d=Math.hypot(c.x-me.pos.x,c.z-me.pos.z);if(d<bd)bd=d}if(bd<26){const v=Math.max(.02,(1-bd/26))*.16;tone(1568,.12,v,'sine',0,out());setTimeout(()=>tone(2093,.16,v*.8,'sine',0,out()),110)}}
 // use cast
 if(B.cast){B.cast.t+=dt;const c=$('brCast');c.firstChild.style.width=Math.min(100,B.cast.t/B.cast.d*100)+'%';if(inp.fire||me.down||!me.alive||B.air){brCancelCast()}else if(B.cast.t>=B.cast.d){const k=B.cast.k;B.cast=null;c.classList.add('hidden');send({t:'use',k});SFX.heal&&SFX.heal()}}
 B.mapT-=dt;if(B.mapT<=0){B.mapT=.12;brDrawMap($('brMini'),false);if(B.mapOn)brDrawMap($('brMapCv'),true)}
 document.body.classList.toggle('brAirOn',!!B.air);if(!B.air){$('brAir').classList.add('hidden');$('brJumpBtn').classList.add('hidden')}}
// ---- messages ----
function brMsg(m){const B=BC;if(!B)return false;
 switch(m.t){
 case 'bru':B.bt0=m.bt;B.btAt=performance.now();B.btNow=m.bt;if(!B.storm)B.first=1;B.storm=m.st;B.stAt=performance.now();B.al=m.al;B.sq=m.sq;brHudUpd();renderSB();return true;
 case 'lp':{const it=B.items.get(m.i);B.items.delete(m.i);B.dirty=1;if(m.by===me.id&&it){const r=(it[1]===0||it[1]===4)?(it[3]|0):0;tone(700+r*180,.08,.18,'triangle',0,out());setTimeout(()=>tone(1000+r*220,.1,.16,'triangle',0,out()),70);feed('+ '+itemName(it))}return true}
 case 'ld':B.items.set(m.it[0],m.it);B.dirty=1;return true;
 case 'ldm':for(const it of m.it)B.items.set(it[0],it);B.dirty=1;return true;
 case 'cop':{const c=B.chests[m.c];if(c){c.open=true;if(m.sec||c.sec){const d0=Math.hypot(c.x-me.pos.x,c.z-me.pos.z);if(d0<70){const v=Math.max(.08,1-d0/70)*.4;tone(98,.9,v,'sawtooth',49,out());setTimeout(()=>{tone(392,.5,v*.8,'square',0,out());tone(587,.6,v*.7,'triangle',0,out());tone(988,.7,v*.5,'sine',0,out())},120);center('🔴 SECRET CRATE OPENED',1500)}}for(const it of m.it)B.items.set(it[0],it);B.dirty=1;const d=Math.hypot(c.x-me.pos.x,c.z-me.pos.z);if(d<40){const v=Math.max(.05,1-d/40)*.35;tone(180,.25,v,'sawtooth',90,out());setTimeout(()=>{tone(880,.3,v,'triangle',0,out());tone(1320,.35,v*.8,'sine',0,out())},180)}}return true}
 case 'inv':B.inv=m.inv;if(!B.inv.bp)B.inv.bp=[];B.res=m.res.slice();brApplyInv();return true;
 case 'bpf':center('🎒 Backpack full — drop something',1100);return true;
 case 'shd':B.sh=m.sh;brHudUpd();return true;
 case 'bjf':if(B.air==='bus'){B.air=me.air='fall';me.vel.set(0,-10,0)}return true;
 case 'brp':{if(m.k&&m.k[me.id]!=null)B.kills=m.k[me.id];if(m.ids.includes(me.id)&&!B.paid){B.paid=1;B.placed=m.place;const p=m.place,rw=m.win?50:p===2?30:p===3?20:p<=5?12:p<=10?6:2;addDia(Math.round(rw*ECON.mul()),'placement #'+p);if(!m.win)brOutShow(p,m.n)}brHudUpd();return true}
 case 'hp':if(m.id===me.id&&B.cast&&m.hp<me.hp)brCancelCast();return false}
 return false}
function brOutShow(p,n){const o=$('brOut');o.classList.remove('hidden');o.innerHTML=`<h2>#${p} <small>of ${n}</small></h2><p>${C.mode==='brs'?'Your squad was eliminated':'You were eliminated'}</p><p>☠️ ${BC.kills} eliminations · 💎 +${C.matchDia||0}</p><div class="row"><button class="pill yellow" id="brSpecB">👁 SPECTATE</button><button class="pill" id="brLeaveB">LEAVE</button></div>`;
 $('brSpecB').onpointerdown=e=>{e.stopPropagation();o.classList.add('hidden')};$('brLeaveB').onpointerdown=e=>{e.stopPropagation();$('pLeave').click()}}
function brSpec(dt){const B=BC;if(!B||C.phase!=='play')return false;let t=B.spec&&C.players[B.spec]&&C.players[B.spec].alive&&!C.players[B.spec].air?C.players[B.spec]:null;
 if(!t){const al=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!p.raider);t=al.find(p=>!isEnemy(p))||(me.killer&&C.players[me.killer]&&C.players[me.killer].alive?C.players[me.killer]:null)||al[0];if(!t)return false;B.spec=t.id}
 const back=_v.set(Math.sin(t.yaw),0,Math.cos(t.yaw)).multiplyScalar(3.4);camera.position.lerp(_v2.copy(t.rp).add(back).setY(t.rp.y+2.4),Math.min(1,dt*6));camera.lookAt(t.rp.x,t.rp.y+1.4,t.rp.z);return true}
function brSpecNext(){const B=BC;if(!B||me.alive)return;const al=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!p.raider);if(!al.length)return;const i=al.findIndex(p=>p.id===B.spec);B.spec=al[(i+1)%al.length].id}
function brRemote(q){const B=BC;if(!B)return;const mo=q.model;if(mo.rotation.order!=='YXZ')mo.rotation.order='YXZ';
 if(q.flags&32){mo.visible=false;return}
 if(mo.userData.kind==='toon'){gliderOf(mo,!!(q.flags&8),.016);return}
 if(q.flags&16){mo.rotation.x=-1.25;mo.position.y+=.9}
 if(q.flags&8){let c=mo.userData.chute;if(!c){c=new THREE.Mesh(new THREE.SphereGeometry(2.4,12,7,0,Math.PI*2,0,Math.PI/2),new THREE.MeshLambertMaterial({color:q.color,side:THREE.DoubleSide,emissive:0x222222}));c.scale.set(1,.7,1);c.position.y=3.4;mo.userData.chute=c;mo.add(c)}c.visible=true}
 else if(mo.userData.chute)mo.userData.chute.visible=false}
addEventListener('keydown',e=>{if(!BC||!inGame||paused||e.target.tagName==='INPUT')return;
 if(e.code==='KeyE'&&!BC.near.length&&doorNear&&me.alive&&!BC.air){doorAct()}
 else if(e.code==='KeyE'&&BC.near.length&&me.alive&&!BC.air){const n=BC.near[0];brAct(n[1]==='c'?'c':'i',n[1]==='c'?n[2].id:n[2][0])}
 else if(e.code==='KeyM'){brMap(!BC.mapOn)}
 else if(e.code==='Digit6')brUse(0);else if(e.code==='Digit7')brUse(1);else if(e.code==='Digit8')brUse(2);else if(e.code==='Digit9')brUse(3);else if(e.code==='KeyI'||e.code==='Tab'){e.preventDefault();brBag(!BC.bagOn)}else if(e.code==='Escape'&&BC.bagOn)brBag(false);
 else if(e.code==='KeyH'){BC.inv.c[1]>0&&me.hp<75?brUse(1):brUse(0)}else if(e.code==='KeyJ'){BC.inv.c[2]>0&&BC.sh<=50?brUse(2):brUse(3)}});
addEventListener('pointerdown',e=>{if(BC&&inGame&&!me.alive&&C.phase==='play'&&!e.target.closest('button'))brSpecNext()});
// ---- host: BR messages ----
function brHostMsg(from,m,p){if(!H.br||!p)return false;const E=H.br;
 switch(m.t){
 case 'bj':if(p.air==='bus'&&H.t>=E.t0)brJump(p);return true;
 case 'bl':if(p.air==='fall'||p.air==='chute'){p.air=null;p.prot=0}return true;
 case 'pk':brTake(p,m.i|0,m.s|0);return true;
 case 'co':brOpen(p,m.c|0);return true;
 case 'bpm':brBp(p,m);return true;
 case 'rs':if(Array.isArray(m.r)&&p.inv)p.inv.res=m.r.slice(0,4).map(x=>Math.max(0,Math.min(300,x|0)));return true;
 case 'use':if(p.alive&&p.inv&&!p.down&&!p.elim){const k=m.k|0;if(k>=0&&k<4&&p.inv.c[k]>0){let ok=0;if(k===0&&p.hp<75){p.hp=Math.min(75,p.hp+15);ok=1}else if(k===1&&p.hp<100){p.hp=100;ok=1}else if(k===2&&(p.sh||0)<100){p.sh=Math.min(100,(p.sh||0)+50);ok=1}else if(k===3&&(p.sh||0)<50){p.sh=Math.min(50,(p.sh||0)+25);ok=1}
   if(ok){p.inv.c[k]--;bcast({t:'hp',id:from,hp:Math.round(p.hp)});sendTo(from,{t:'shd',sh:Math.round(p.sh||0)});sendTo(from,invOut(p))}}}return true}
 return false}

function brReloadDone(id){const have=me.ammo[me.cur],need=magOf(id)-have,t=ammoOf(id),take=Math.max(0,Math.min(need,BC.res[t]));BC.res[t]-=take;send({t:'rs',r:BC.res});return have+take}

window.__hsz.toonMod=()=>import('./toon.js');window.__hsz.gx={tpGun,gunGroup,W,THREE};window.__hsz.BR=()=>BC;window.__hsz.ME=()=>me;window.__hsz.CC=()=>C;window.__hsz.brx={send,brBag,brBagRender,brBp,brPickPlan,brNearBtn,S2T,BRORD,typeOfW,TS,brLand,brScale,brJump,brOpen,brTake,brGive,brElim,brCheck,stormState,RAR,W,WIDX,WIDS,gunScore,damage,brApplyInv,brUse,brMap,rollItem,gunItem,fixItem,brItem,bcast,send,brAct,BRC,STORM,newInv,chestH,brChestGround,brChestMats,lidAng,rayWorld,nlList,nlUse,doorsL,doorAct,doorSet,doorBlocked,botDoors,doorScan,get doorNear(){return doorNear}};

// ================= v44 PARTY (clan) =================
// A party is up to 4 friends. The leader (creator) owns the roster and pushes it to everyone; everyone in it joins the leader's room together,
// and in Squad Royale party members always land in the same squad.
let PARTY=null,PINV=null;try{const ps=JSON.parse(sessionStorage.getItem('hsz_party')||'null');if(ps&&ps.m&&ps.m.length>1)PARTY=ps}catch(e){}
const partyLead=()=>!!PARTY&&PARTY.lead===FR.code;
const partyCodes=()=>PARTY?PARTY.m.map(x=>x.code).filter(c=>c!==FR.code):[];
function partyPush(){if(!partyLead())return;const msg={t:'pst',pid:PARTY.id,lead:PARTY.lead,m:PARTY.m};for(const c of partyCodes())frAsk(c,msg);renderParty()}
function partyInvite(code){if(frCat(code)!=='list')return;if(PARTY&&!partyLead())return frMsg('Only the party leader can invite');if(PARTY&&PARTY.m.some(x=>x.code===code))return;
 if(!PARTY)PARTY={id:FR.code,lead:FR.code,m:[{code:FR.code,name:frName()}]};if(PARTY.m.length>=4)return frMsg('Party is full (4)');
 frAsk(code,{t:'pinv',pid:PARTY.id,lead:PARTY.lead,m:PARTY.m}).then(r=>{if(!r)frMsg('They seem to be offline')});frMsg('👥 Party invite sent');renderParty();renderFriends()}
function partyAccept(){const v=PINV;PINV=null;if(!v){renderParty();return}PARTY={id:v.pid,lead:v.lead,m:v.m.filter(x=>x.code!==FR.code).concat([{code:FR.code,name:frName()}])};renderParty();frAsk(v.lead,{t:'pjoin',pid:v.pid})}
function partyLeave(){if(!PARTY)return;if(partyLead()){for(const c of partyCodes())frAsk(c,{t:'pdis'})}else frAsk(PARTY.lead,{t:'plv'});PARTY=null;renderParty();if(frOpen)renderFriends()}
function partyGo(room){if(!partyLead()||PARTY.m.length<2||!room||room==='OFFLINE')return;for(const c of partyCodes())frAsk(c,{t:'pgo',room})}
function partyMsg(m,code,name,cat){
 if(m.t==='pinv'){if(cat!=='list'||(PARTY&&PARTY.m.length>1)){return{t:'busy'}}PINV={pid:String(m.pid).slice(0,12),lead:code,name,m:(Array.isArray(m.m)?m.m:[]).slice(0,4).map(x=>({code:normCode(x.code)||'',name:String(x.name||'').slice(0,12)})).filter(x=>x.code)};toast(`👥 ${name} invited you to a party`);renderParty();return{t:'ok'}}
 if(m.t==='pjoin'){if(partyLead()&&PARTY.id===m.pid&&cat==='list'&&PARTY.m.length<4&&!PARTY.m.some(x=>x.code===code)){PARTY.m.push({code,name});toast(`👥 ${name} joined your party`);partyPush()}return{t:'ok'}}
 if(m.t==='plv'){if(partyLead()&&PARTY.m.some(x=>x.code===code)){PARTY.m=PARTY.m.filter(x=>x.code!==code);toast(`👥 ${name} left the party`);if(PARTY.m.length<2){PARTY=null;renderParty()}else partyPush()}return{t:'ok'}}
 if(m.t==='pst'){if(PARTY&&PARTY.lead===code&&PARTY.id===m.pid){const mm=(Array.isArray(m.m)?m.m:[]).slice(0,4).map(x=>({code:normCode(x.code)||'',name:String(x.name||'').slice(0,12)})).filter(x=>x.code);if(mm.some(x=>x.code===FR.code))PARTY.m=mm;else PARTY=null;renderParty();if(frOpen)renderFriends()}return{t:'ok'}}
 if(m.t==='pdis'){if(PARTY&&PARTY.lead===code){PARTY=null;toast('👥 Party disbanded');renderParty();if(frOpen)renderFriends()}return{t:'ok'}}
 if(m.t==='pgo'){if(PARTY&&PARTY.lead===code&&/^[A-Z0-9]{4,8}$/.test(String(m.room))&&roomCode!==m.room&&(!inGame||C.hub)){toast(`👥 ${name} started a match — joining`);const nl=/[?&]net=local/.test(location.search)?'&net=local':'';window.__partyGo=m.room;if(!$('lobby').classList.contains('hidden')||inGame||C.hub)location.href=location.pathname+'?join='+m.room+nl+(PROF?'&prof='+PROF:'');else{closeFriends();joinRoom(m.room)}}return{t:'ok'}}
 return{t:'ok'}}
let partyKey='';function renderParty(){try{if(PARTY)sessionStorage.setItem('hsz_party',JSON.stringify(PARTY));else sessionStorage.removeItem('hsz_party')}catch(e){}try{window.__hsz.royale&&window.__hsz.royale.refresh()}catch(e){}const b=$('partyBar');if(!b)return;const show=(PARTY||PINV)&&(!inGame||C.hub)&&!(PARTY&&PARTY.m.length<2&&!PINV&&false);
 let h='';if(PINV)h+=`<div class="pInv">👥 <b>${esc(PINV.name)}</b> invites you to a party <button data-p="acc" class="pill green sm">JOIN</button><button data-p="dec" class="pill red sm">✕</button></div>`;
 if(PARTY)h+=`<div class="pMem"><b>👥 PARTY ${PARTY.m.length}/4</b>${PARTY.m.map(x=>`<span class="${x.code===PARTY.lead?'lead':''}">${x.code===PARTY.lead?'👑 ':''}${esc(x.name)}</span>`).join('')}${partyLead()?'<button data-p="inv" class="pill sm">➕</button>':''}<button data-p="lv" class="pill red sm">LEAVE</button></div>`;
 const k=(show?'1':'0')+h;if(k===partyKey)return;partyKey=k;b.classList.toggle('hidden',!show);b.innerHTML=h}
document.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('#partyBar [data-p]');if(!b)return;e.stopPropagation();const a=b.dataset.p;if(a==='acc')partyAccept();else if(a==='dec'){PINV=null;renderParty()}else if(a==='lv')partyLeave();else if(a==='inv')openFriends()},true);
setInterval(renderParty,1200);
window.__hsz.PARTY=()=>PARTY;window.__hsz.partyInvite=partyInvite;window.__hsz.partyAccept=partyAccept;window.__hsz.partyLeave=partyLeave;

// ================= v45 THIRD-PERSON CAMERA =================
// Royale defaults to over-the-shoulder; the main game defaults to first person (V / button toggles, remembered per game).
// The camera orbits the player's head, is pushed in by world collision, pulls in + zooms when aiming, and shots start at the camera
// (so the crosshair is always where bullets go) while tracers leave the character's gun.
const TPV={on:false,d:3.2,side:.62,up:.18,sh:1,dist:3.2,k:1};
const royaleMode=()=>BRM(C.mode)||(!!BC);
const camPref=()=>royaleMode()?(LS('camR')!=='1'):(LS('cam3')==='1');
window.__toonOn=id=>royaleMode()||(id==='me'&&!!window.__toonMe);
window.__toonFit=id=>{if(id==='me')return curFit();const f=window.__fitNext;window.__fitNext=null;return f==null?null:f};
function fitOf(v){const f=parseInt(v);if(isNaN(f)||f<0)return null;const i=f&63,tn=f>>6;return(i<FIT_N?i:0)+64*(tn<=8?tn:0)}
function curFit(){return fitOf(LS('fit')||'0')||0}
function tpSetup(){TPV.on=camPref();TPV.dist=TPV.d;if(TPV.on)tpEnsure();else if(me.model)me.model.visible=false;updCamBtn()}
function tpEnsure(){const roy=royaleMode();const m=me.model;const kind=roy?'toon':'hum';const fit=curFit();if(m&&m.userData.mk===kind&&(!roy||m.userData.fitIdx===fit)&&m.parent===scene)return m;if(m)scene.remove(m);
 window.__toonMe=roy;const nm=(me.name||'You');const mm=makeCharacter(0xffffff,nm,'me',undefined,roy?undefined:skinOutfit(PROG.skin)||undefined,PROG.pc);window.__toonMe=false;mm.userData.mk=kind;mm.userData.fitIdx=fit;mm.userData.noTagMe=true;mm.visible=false;scene.add(mm);me.model=mm;me.gunKey='';return mm}
const _tp1=new THREE.Vector3(),_tp2=new THREE.Vector3(),_tp3=new THREE.Vector3(),_tp4=new THREE.Vector3();
function tpCam(dt,w,scopeOn){const eye=_tp1.copy(camera.position);const f=_tp2.set(0,0,-1).applyQuaternion(camera.quaternion);const r=_tp3.set(1,0,0).applyQuaternion(camera.quaternion);r.y=0;r.normalize();
 const ads=me.zoomT;const wantD=TPV.d+(1.95-TPV.d)*ads-EM.k*.5,wantS=(TPV.side+(.82-TPV.side)*ads)*TPV.sh*(1-EM.k),wantU=TPV.up*(1-ads*.4)+ (me.slideT>0?-.35:0);
 // sideways shoulder offset first (walls beside you), then back along the view direction
 const piv=_tp4.copy(eye);piv.y+=wantU;let sd=wantS;{const dr=r.clone().multiplyScalar(Math.sign(sd)||1);const t=rayWorld(piv,dr,Math.abs(sd)+.3);if(t<Math.abs(sd)+.3)sd=Math.sign(sd)*Math.max(0,t-.28)}
 piv.addScaledVector(r,sd);
 const back=f.clone().multiplyScalar(-1);let t=rayWorld(piv,back,wantD+.35);let limit=Math.max(.12,Math.min(wantD,t-.32));
 {const des=piv.clone().addScaledVector(back,wantD),dv=des.clone().sub(eye),L=dv.length();dv.divideScalar(L);const tb=rayWorld(eye,dv,L+.3);if(tb<L+.3){const fr=Math.max(0,(tb-.3)/L);limit=Math.min(limit,Math.max(.12,wantD*fr))}}
 // snap in instantly when blocked, ease out when free
 if(limit<TPV.dist)TPV.dist=limit;else TPV.dist+=(limit-TPV.dist)*Math.min(1,dt*5);
 const sc=scopeOn?1:0;const dd=TPV.dist*(1-sc);TPV.cd=dd;
 camera.position.copy(piv).addScaledVector(back,dd);if(scopeOn)camera.position.copy(eye);camera.updateMatrixWorld();TPV.hide=dd<.85}
const _tv=new THREE.Vector3();
let _cbk='';function tpBody(dt){{const k=inGame+'|'+C.hub+'|'+TPV.on;if(k!==_cbk){_cbk=k;updCamBtn()}}const m=me.model;if(!m)return;if(!TPV.on||!inGame||paused&&false){m.visible=false;return}
 const u=m.userData;const alive=me.alive;if(m.parent!==scene)scene.add(m);
 if(!alive){if(!u.dead)u.dead=.001}else if(u.dead){u.dead=0}
 m.visible=!(TPV.hide&&alive)&&!C.hub;if(!m.visible)return;const air=BC&&me.air;
 const id=me.load[me.cur];const key=id+'|'+(me.ws&&me.ws[id]||'');if((me.gunKey!==key||me.gunMdl!==m)&&u.gunMount){me.gunKey=key;me.gunMdl=m;u.gunMount.clear();const g=tpGun(id,'',u.outfit&&u.outfit.glove);u.gunMount.add(g);u.gunMount.scale.setScalar(u.kind==='toon'?1:1)}
 emoTick(dt);m.position.set(me.pos.x,me.pos.y,me.pos.z);m.rotation.y=me.yaw+Math.PI*EM.k;
 const vx=me.vel.x,vz=me.vel.z,hs=Math.hypot(vx,vz);const fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw),rx=Math.cos(me.yaw),rz=-Math.sin(me.yaw);
 const lx=hs>.1?(vx*rx+vz*rz)/hs:0,lz=hs>.1?-((vx*fx+vz*fz)/hs):-1;
 animate(m,{emote:me.emo?me.emo.id:null,pose:air==='fall'?'fall':air==='chute'?'glide':air==='bus'?'bus':null,bank:BC?BC.bank:0,speed:air==='bus'?0:hs,air:!me.ground&&!me.lad,slide:me.slideT>0,pitch:me.pitch+recoilP,climb:!!me.lad,down:!!me.down,lx,lz,hold:true,noTag:true,dist:5,crouch:!!me.crouch,ads:me.zoomT,shot:me.lastShot!==me.lsSeen,reload:me.reloadT>0?1-me.reloadT/reloadOf(id):0},dt);me.lsSeen=me.lastShot;m.rotation.x=0;gliderOf(m,air==='chute',dt);
 u.tag.visible=false}
function gliderOf(m,open,dt){const u=m.userData;if(u.kind!=='toon')return;if(!u.glider){const o=u.outfit||{};u.glider=makeGlider(o.top??0xff4fa3,o.acc??0xffd23f);u.glider.visible=false;u.gs=0;m.add(u.glider)}
 const tgt=open?1:0;u.gs+=(tgt-u.gs)*Math.min(1,dt*(open?9:12));const s=u.gs>.98?1:u.gs;u.glider.visible=u.gs>.02;const pop=open?1+Math.sin(Math.min(1,u.gs)*Math.PI)*.12:1;u.glider.scale.setScalar(Math.max(.01,s*pop));u.glider.userData.flex(BC?BC.bank:0,0,performance.now()/1000)}
setInterval(()=>{try{updCamBtn()}catch(e){}},250);
function updCamBtn(){{const bs=$('bSlide');if(bs)bs.classList.toggle('on',!!me.crouch)}document.body.classList.toggle('playing',!!inGame);const b=$('camBtn');if(!b)return;b.classList.toggle('hidden',!!(!inGame||C.hub));b.textContent=TPV.on?'👤':'👁️';b.title=TPV.on?'Third person (V)':'First person (V)'}
function camToggle(){if(!inGame||C.hub)return;TPV.on=!TPV.on;if(royaleMode())LSS('camR',TPV.on?'3':'1');else LSS('cam3',TPV.on?'1':'0');if(TPV.on)tpEnsure();else{if(me.model)me.model.visible=false;camera.fov=75;camera.updateProjectionMatrix()}updCamBtn();center(TPV.on?'Third person':'First person',700)}
(function(){const b=document.createElement('button');b.id='camBtn';b.className='hidden';b.textContent='👁️';document.body.appendChild(b);b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();camToggle()});
 addEventListener('keydown',e=>{if(e.code==='KeyV'&&!e.repeat&&inGame&&!paused&&e.target.tagName!=='INPUT')camToggle();if(e.code==='KeyT'&&TPV.on&&!e.repeat&&inGame&&!paused&&e.target.tagName!=='INPUT'){TPV.sh=-TPV.sh;center(TPV.sh>0?'Camera: right shoulder':'Camera: left shoulder',600)}})})();

// ===== v49 in-game emotes (Royale): hold B = wheel (mouse picks), tap B = replay last, touch button opens the wheel =====
const EM={wheel:false,sel:-1,last:'wave',fp:false,k:0,mx:0,my:0,t0:0,sticky:false};me.emo=null;
const EM_LBL={wave:['👋','Wave'],dance:['🕺','Dance'],flex:['💪','Flex'],cheer:['🎉','Cheer'],sit:['🪑','Sit'],salute:['🫡','Salute'],spin:['🌀','Spin'],clap:['👏','Clap']};
const emoCan=()=>royaleMode()&&inGame&&!paused&&!C.hub&&me.alive&&!me.down&&!me.air&&me.ground&&!me.lad&&me.slideT<=0&&C.phase==='play';
function startEmote(id){if(typeof id==='number')id=EMOTES[id];if(!id||!EMOTES.includes(id)||!emoCan())return false;EM.last=id;me.emo={id,t:0,hp:me.hp};if(!TPV.on){TPV.on=true;EM.fp=true;tpEnsure()}send({t:'emo',e:EMOTES.indexOf(id)});wheelShow(false);return true}
function stopEmote(){if(!me.emo)return;me.emo=null;send({t:'emo',e:-1});if(EM.fp){EM.fp=false;TPV.on=false;if(me.model)me.model.visible=false;camera.fov=75;camera.updateProjectionMatrix()}}
function emoTick(dt){EM.k+=((me.emo?1:0)-EM.k)*Math.min(1,dt*7);const e=me.emo;if(!e)return;e.t+=dt;
 const mv=Math.hypot(me.vel.x,me.vel.z)>1.5||keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||inp.mx||inp.mz;
 if(!emoCan()||mv||inp.fire||inp.jump||me.hp<e.hp||e.t>(EMOTE_DUR[e.id]||3)+.15)stopEmote()}
function wheelEl(){let w=$('emoWheel');if(w)return w;w=document.createElement('div');w.id='emoWheel';w.className='hidden';const n=EMOTES.length;
 w.innerHTML='<div class="ewHub">EMOTES</div>'+EMOTES.map((id,i)=>{const a=-Math.PI/2+i/n*Math.PI*2,l=EM_LBL[id]||['✨',id];return `<button class="ewB" data-i="${i}" style="left:calc(50% + ${Math.cos(a).toFixed(3)} * var(--ewR,140px));top:calc(50% + ${Math.sin(a).toFixed(3)} * var(--ewR,140px))"><span>${l[0]}</span><small>${l[1]}</small><i>${i+1}</i></button>`}).join('');
 document.body.appendChild(w);w.addEventListener('pointerdown',e=>{e.stopPropagation();const b=e.target.closest('.ewB');e.preventDefault();if(b)startEmote(+b.dataset.i);else wheelShow(false)});return w}
function wheelShow(on){const w=wheelEl();w.style.setProperty('--ewR',Math.max(92,Math.min(140,innerHeight/2-48))+'px');if(on&&!emoCan()&&!me.emo)on=false;EM.wheel=on;w.classList.toggle('hidden',!on);if(!on){EM.sticky=false;EM.sel=-1}else{EM.mx=EM.my=0;EM.sel=-1;EM.t0=performance.now();w.querySelectorAll('.ewB').forEach(b=>b.classList.toggle('on',false))}}
document.addEventListener('pointerdown',e=>{if(EM.wheel&&EM.sticky&&!e.target.closest('#emoWheel,#emoBtn'))wheelShow(false)},true);
function emoMove(dx,dy){EM.mx=Math.max(-90,Math.min(90,EM.mx+dx*.6));EM.my=Math.max(-90,Math.min(90,EM.my+dy*.6));let s=-1;if(Math.hypot(EM.mx,EM.my)>32){const n=EMOTES.length;let a=Math.atan2(EM.my,EM.mx)+Math.PI/2;a=((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);s=Math.round(a/(Math.PI*2)*n)%n}emoSel(s)}
function emoSel(s){EM.sel=s;wheelEl().querySelectorAll('.ewB').forEach((b,i)=>b.classList.toggle('on',i===s))}
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||!royaleMode()||!inGame||paused)return;
 if(e.code==='KeyB'&&!e.repeat){e.preventDefault();if(me.emo){stopEmote();return}if(emoCan())wheelShow(true)}
 else if(EM.wheel&&/^Digit[1-8]$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();startEmote(+e.code[5]-1)}},true);
addEventListener('keyup',e=>{if(e.code==='KeyB'&&EM.wheel&&!EM.sticky){const quick=performance.now()-EM.t0<260;if(EM.sel>=0)startEmote(EM.sel);else if(quick)startEmote(EM.last);else wheelShow(false)}});
(function(){const b=document.createElement('button');b.id='emoBtn';b.className='hidden';b.textContent='😀';document.body.appendChild(b);b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();if(me.emo){stopEmote();return}if(EM.wheel)wheelShow(false);else if(emoCan()){wheelShow(true);EM.sticky=true}});
 setInterval(()=>{b.classList.toggle('hidden',!(inGame&&!C.hub&&royaleMode()&&!paused));if(EM.wheel&&!emoCan()&&!me.emo)wheelShow(false)},400)})();
window.__hsz.EMOTE_DUR=EMOTE_DUR;window.__hsz.info=()=>({calls:renderer.info.render.calls,tris:renderer.info.render.triangles,geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures});window.__hsz.emote=startEmote;window.__hsz.emoStop=stopEmote;window.__hsz.EM=EM;
window.__hsz.TPV=TPV;window.__hsz.rayW=(o,d,m)=>rayWorld(o,d,m);window.__hsz.camera=camera;window.__hsz.vmRoot=vmRoot;window.__hsz.camToggle=camToggle;

// ---- v47 Royale menu entry + lobby ----
// ---- v54 skin shop wiring: equipping sets the main-game human outfit AND the Royale hero (LS 'fit' = outfit index + 64*tint), then syncs online
function equipSkin(id,tint=0){tint=tint|0;const full=id==='default'?'default':joinSkin(id,tint);PROG.skin=full;
 if(id!=='default'){const i=SKIN_IDS.indexOf(id);if(i>=0)LSS('fit',String(BASE_N+i+64*tint))}else if(curFit()>=BASE_N)LSS('fit','0');
 saveProg();if(me.model)me.model.userData.mk='stale';
 try{hubEquip&&hubEquip();const hp=H&&H.players&&H.players[me.id];if(hp&&C.hostId===me.id){hp.skin=cleanSkin(full);hp.fit=curFit();bcast({t:'fit',id:me.id,ft:hp.fit,sk:hp.skin})}else if(C.hostId&&C.hostId!==me.id&&!C.hub)send({t:'fit',fit:curFit(),sk:full})}catch(e){}}
window.__hsz.equipSkin=equipSkin;
const PETX={H:()=>H,plist,enemy:(p,q)=>H.mode==='ffa'||q.team!==p.team,los:(p,q)=>{_o.set(p.p[0],p.p[1]+1,p.p[2]);return rayClearHost(_o,_d.set(q.p[0],q.p[1]+1.1,q.p[2]))},damage:(v,d,by,h,w)=>damage(v,d,by,h,w),bcast:m=>bcast(m),toPlayer:(id,m)=>toPlayer(id,m),take:(p,id)=>H.br?brTake(p,id):false};
PETS=initSidekicks({scene,me,C,PROG,isEnemy,cols:()=>cur&&cur.cols,send,inGame:()=>inGame,toast:m=>center(m,1300),sfx:()=>{try{SFX.beep&&SFX.beep()}catch(e){}},canAct:()=>inGame&&!paused&&me.alive});window.__hsz.pets=PETS;
function equipPet(id){id=SK_BY[id]&&PROG.pets.includes(id)?id:'';PROG.pet=id;saveProg();try{sendWS();if(!inGame&&C.hostId&&C.hostId!==me.id)send({t:'ws',ws:cleanWS(wsOut())});if(!inGame||C.hub){const hp=H&&H.players&&H.players[me.id];if(hp&&C.hostId===me.id){hp.ws=cleanWS(wsOut());bcast({t:'ws',id:me.id,ws:hp.ws})}}}catch(e){}if(PETS)PETS.reset()}
window.__hsz.equipPet=equipPet;
SHOP=initSkinShop({$,PROG,saveProg,SFX,esc,audioInit,equip:equipSkin,gun:(id,gl)=>tpGun(id,skOf({ws:PROG.wskin},id),gl),denied:()=>{SFX.beep&&SFX.beep()},onClose:from=>{if(from==='royale'&&window.__hsz.royale)window.__hsz.royale.refresh()}});window.__hsz.shop=SHOP;if(SHOP&&$('openSkinShop'))$('openSkinShop').onclick=()=>SHOP.open('menu');
PETSHOP=initSidekickShop({$,PROG,saveProg,SFX,esc,audioInit,equip:equipPet,denied:()=>{SFX.beep&&SFX.beep()},onClose:from=>{if(from==='royale'&&window.__hsz.royale)window.__hsz.royale.refresh()}});window.__hsz.petshop=PETSHOP;if(PETSHOP&&$('openPets'))$('openPets').onclick=()=>PETSHOP.open('menu');
{const ROY=initRoyale({$,LS,LSS,audioInit,lastSquad:()=>{try{return JSON.parse(sessionStorage.getItem('hsz_squad')||'null')}catch(e){return null}},play:(m,o)=>playOnlineBots(m,o),party:()=>PARTY,partyLead,myCode:()=>FR.code,esc,openFriends,partyLeave,r2,gun:(id,gl)=>tpGun(id,skOf({ws:PROG.wskin},id),gl),W,shop:SHOP,pets:PETSHOP,equipSkin,PROG});window.__hsz.royale=ROY;if(ROY&&$('royaleBtn'))$('royaleBtn').onclick=()=>ROY.open();try{if(sessionStorage.getItem('hsz_royMenu')){sessionStorage.removeItem('hsz_royMenu');setTimeout(()=>{if(!inGame)ROY.open()},700)}}catch(e){}}

// ================= v62 EXTRACTION RAID =================
// PvPvE: safe base -> stash/contract/loadout -> one-life insertion -> shared hostile map ->
// machine factions + rival squads, loot caches and named extraction exits -> settlement/stash.
// Host-authoritative: the host generates loot ids, validates distance, owns all timers, exits,
// deaths, bags and settlements. Clients only request actions and mirror host messages.
const RAID={v:63,time:600,squads:3,perSquad:3,maxP:9,cost:15,insureCost:25,search:2.4,extR:5.5,board:2.2,wave:75,alarmWave:35,callEta:35,callWindow:30,timedAt:180,timedWindow:60,keyWindow:45,cap:18,secure:2,secureWeight:12,supplyAt:210,flyerY:7.5,reconnect:45,recCap:12,recSecure:1,test:false};
{const q=new URLSearchParams(location.search);if(q.get('raidtest')){RAID.test=true;Object.assign(RAID,{time:180,wave:30,alarmWave:45,callEta:10,callWindow:25,timedAt:45,timedWindow:30,keyWindow:20,supplyAt:70,search:1.2,board:1.4,reconnect:12,recCap:8});}}
const RAIDM=m=>m==='raid';
const RSQN=['ALPHA','BRAVO','CHARLIE'];
const RSQCOL=[0x3fa9ff,0xff5a6b,0x2ee59d];
const raidSquadOf=p=>RSQN[['A','B','C'].indexOf(p&&p.team)]||'SQUAD';
const RARCH={
 scout:{n:'MACHINE SCOUT',cl:'scout',gun:'smg',hp:70,color:0x6fe3ff,d:32},
 hunter:{n:'MACHINE HUNTER',cl:'ninja',gun:'dmr',hp:120,color:0xffb14a,d:58},
 heavy:{n:'MACHINE HEAVY',cl:'juggernaut',gun:'lmg',hp:240,color:0xff6b6b,d:52},
 flyer:{n:'MACHINE FLYER',cl:'scout',gun:'ar',hp:60,color:0xb79dff,d:60},
 boss:{n:'MACHINE OVERLORD',cl:'juggernaut',gun:'minigun',hp:650,color:0xff2a2a,d:70}
};
const RMS=['wire','steel','chem','fuel'];
const RMN={wire:'WIRE',steel:'STEEL',chem:'CHEMS',fuel:'FUEL'};
const RAID_MAX_HIST=8, RAID_STASH_V=1;
function raidClamp(v,a,b){return Math.max(a,Math.min(b,v))}
function raidPointOK(m,x,z){
 const hx=m.size[0]/2,hz=m.size[1]/2;
 if(Math.abs(x)>hx-2.5||Math.abs(z)>hz-2.5)return false;
 for(const c of m.cols||[]){if(x>c.x0-1&&x<c.x1+1&&z>c.z0-1&&z<c.z1+1&&c.y0<1.8&&c.y1>.05)return false}
 return true;
}
function raidSample(m,n,avoid){
 const out=[],hx=m.size[0]/2-5,hz=m.size[1]/2-5,sp=Math.max(4,Math.min(8,Math.min(hx,hz)/5));let tries=0;
 while(out.length<n&&tries<4000){tries++;const x=(Math.random()*2-1)*hx,z=(Math.random()*2-1)*hz;
  if(!raidPointOK(m,x,z))continue;if(avoid&&avoid.some(a=>Math.hypot(a[0]-x,a[1]-z)<sp))continue;
  if(out.some(a=>Math.hypot(a[0]-x,a[1]-z)<sp))continue;out.push([+x.toFixed(1),+z.toFixed(1)])}
 if(out.length<n){const gw=Math.ceil(Math.sqrt(n)),gh=Math.ceil(n/gw);for(let j=0;j<gh&&out.length<n;j++)for(let i=0;i<gw&&out.length<n;i++){const x=-hx+(i+.5)*(2*hx/gw),z=-hz+(j+.5)*(2*hz/gh);if(raidPointOK(m,x,z)&&!(avoid&&avoid.some(a=>Math.hypot(a[0]-x,a[1]-z)<sp))&&!out.some(a=>Math.hypot(a[0]-x,a[1]-z)<sp))out.push([+x.toFixed(1),+z.toFixed(1)])}}
 return out;
}
function raidOpenSpot(m,arr,off){
 const cand=(arr||[]).filter(s=>raidPointOK(m,s[0],s[1]));if(cand.length)return cand[Math.floor(Math.random()*cand.length)].slice(0,2);
 const pts=raidSample(m,1);if(pts.length)return pts[0];
 return [off?off[0]:0,off?off[1]:0];
}
function raidNewItem(R,kind,opt){
 const o=opt||{};const id=o.id||((R.run||'R')+'-'+(++R.nid));
 const it={id,kind,rar:raidClamp(o.rar|0,0,4),qty:Math.max(1,o.qty|0),owner:o.owner||null,taken:0,gear:!!o.gear,insure:!!o.insure,recovery:!!o.recovery,bag:null,src:null,secure:0};
 if(kind==='weapon'){it.w=W[o.w]?o.w:'ar';it.name=W[it.w].name}
 else if(kind==='armor'){it.name=o.name||'Body Armor'}
 else if(kind==='ammo'){it.a=raidClamp(o.a|0,0,3);it.name=AMN[it.a]+' Ammo'}
 else if(kind==='med'){it.t=o.t|0;it.name=it.t?'Stim Pack':'Field Medkit'}
 else if(kind==='mat'){it.m=RMN[o.m]?o.m:'wire';it.name=RMN[it.m]+' Salvage'}
 else if(kind==='val'){it.val=Math.max(1,o.v|0);it.name='Trade Goods'}
 else if(kind==='key'){it.name='Emergency Keycard'}
 else if(kind==='core'){it.name='Reactor Core'}
 R.items[id]=it;return it;
}
function raidItemPub(it){if(!it)return null;const o={id:it.id,k:it.kind,r:it.rar|0,q:it.qty||1,g:it.gear?1:0,sec:it.secure?1:0};
 if(it.kind==='weapon')o.w=it.w;else if(it.kind==='armor')o.n=it.name;else if(it.kind==='ammo')o.a=it.a;else if(it.kind==='med')o.t=it.t;
 else if(it.kind==='mat')o.m=it.m;else if(it.kind==='val')o.v=it.val;return o}
function raidLootPubs(R,ids){return (ids||[]).map(id=>raidItemPub(R.items[id])).filter(Boolean)}
function raidWeaponPool(){return WIDS.filter(id=>W[id]&&W[id].slot===0&&!W[id].util)}
function raidRollItem(R,tier){
 const t=raidClamp(tier|0,0,2),r=Math.random();let rar=t===0?1:t===1?2:2;
 if(Math.random()<.3)rar=Math.min(4,rar+1);
 const pool=raidWeaponPool();const pick=Math.random();
 if(pick<[.2,.32,.45][t])return raidNewItem(R,'weapon',{w:pool[Math.floor(Math.random()*pool.length)],rar:Math.min(4,rar+1)});
 if(pick<[.55,.62,.7][t])return raidNewItem(R,'ammo',{a:Math.random()*4|0,qty:8+t*4,rar});
 if(pick<[.72,.78,.82][t])return raidNewItem(R,'med',{t:Math.random()<.6?0:1,qty:t===2?2:1,rar});
 if(pick<[.92,.92,.92][t])return raidNewItem(R,'mat',{m:RMS[Math.random()*RMS.length|0],qty:1+t+(Math.random()*3|0),rar});
 return raidNewItem(R,'val',{v:8+t*18+(Math.random()*22|0),rar});
}
function raidFillContainer(R,c){
 const want=[2,3,4][c.tier]||2;
 if(c.vault){if(!c.items||!c.items.length){c.items=[raidNewItem(R,'key',{rar:2,qty:1}).id,raidNewItem(R,'core',{rar:2,qty:1}).id]}}
 while((c.items||[]).length<want){const it=raidRollItem(R,c.tier);c.items.push(it.id)}
 c.gen=1;
}
function raidAssignSquads(){
 const teams=['A','B','C'];const counts={A:0,B:0,C:0};
 const humans=plist().filter(p=>!p.machine&&!p.bot);
 const parties=new Map(),groups=[];
 for(const p of humans){if(!p.party){groups.push([p]);continue}let g=parties.get(p.party);if(!g){g=[];parties.set(p.party,g);groups.push(g)}g.push(p)}
 // Place complete parties first so singles cannot fragment the available squads.
 groups.sort((a,b)=>b.length-a.length);
 for(const g of groups){const t=teams.filter(t=>counts[t]+g.length<=RAID.perSquad).sort((a,b)=>counts[a]-counts[b]||teams.indexOf(a)-teams.indexOf(b))[0];
  if(!t)throw new Error('Raid party exceeds available squad capacity');
  for(const p of g){p.team=t;p.color=RSQCOL[teams.indexOf(t)];p.raidSq=t;counts[t]++}}
 const bots=plist().filter(p=>!p.machine&&p.bot);
 for(const b of bots){let t=teams.slice().sort((a,b)=>counts[a]-counts[b]||teams.indexOf(a)-teams.indexOf(b))[0];b.team=t;b.raidSq=t;b.color=RSQCOL[teams.indexOf(t)];counts[t]++}
 for(const p of plist())if(p.machine){p.team='M';const def=RARCH[p.arch]||RARCH.scout;p.color=def.color}
}
function raidJoinTeam(np){
 const teams=['A','B','C'],counts={A:0,B:0,C:0};let partyTeam=null;
 // Bots can be replaced by human joiners; reserve human/ghost slots only.
 for(const p of plist())if(p.id!==np.id&&!p.machine&&!p.bot){if(p.team in counts)counts[p.team]++;if(np.party&&p.party===np.party)partyTeam=p.team}
 const t=partyTeam?(counts[partyTeam]<RAID.perSquad?partyTeam:null):teams.filter(t=>counts[t]<RAID.perSquad).sort((a,b)=>counts[a]-counts[b]||teams.indexOf(a)-teams.indexOf(b))[0];
 if(!t)return null;
 np.team=t;np.color=RSQCOL[['A','B','C'].indexOf(t)];np.raidSq=t;
 return t;
}
function raidSpawnZones(m){
 const ok=a=>(a||[]).filter(s=>raidPointOK(m,s[0],s[1]));
 const zones=[];
 for(const arr of[ok(m.spawnsA),ok(m.spawnsB)]){
  if(!arr.length)continue;
  const c=arr.reduce((a,b)=>a+b[0],0)/arr.length,z=arr.reduce((a,b)=>a+b[1],0)/arr.length;
  zones.push([c,z]);
 }
 const far=ok(m.spawnsM).sort((a,b)=>Math.hypot(b[0],b[1])-Math.hypot(a[0],a[1]));
 if(far.length)zones.push(far[0]);
 if(!zones.length){const all=allSpawns(m).map(s=>[s[0],s[1]]);return all}
 return zones;
}
function raidZoneFor(team,zones){const i=['A','B','C'].indexOf(team);return zones[Math.max(0,Math.min(zones.length-1,Math.round(zones.length*i/3)))]}
function raidJoinSpawn(np){
 const m=buildMap(H.map),zones=raidSpawnZones(m),base=raidZoneFor(np.team||'A',zones);
 const a=(np.ord||0)*1.7,off=(np.slot=(np.slot||0)+1)%8;
 return [raidClamp(base[0]+Math.cos(a+off)*2.5,-m.size[0]/2+2,m.size[0]/2-2),0,raidClamp(base[1]+Math.sin(a+off)*2.5,-m.size[1]/2+2,m.size[1]/2-2),faceCenter(base)];
}
function raidSpawns(){
 const m=buildMap(H.map),zones=raidSpawnZones(m),out={},cn={};
 for(const p of plist()){
  if(p.machine){const s=p.raidSpawn||[0,0];out[p.id]=[s[0],0,s[1],faceCenter(s)];continue}
  const base=raidZoneFor(p.team||'A',zones);const n=(cn[p.team]=(cn[p.team]||0)+1);
  const a=(p.ord||0)*1.37;
  out[p.id]=[raidClamp(base[0]+Math.cos(a)*2.2,-m.size[0]/2+2,m.size[0]/2-2),0,raidClamp(base[1]+Math.sin(a)*2.2,-m.size[1]/2+2,m.size[1]/2-2),faceCenter(base)];
 }
 return out;
}
function raidPrep(m){
 const R=H.raid={run:'R'+Date.now().toString(36)+'_'+((Math.random()*1e6)|0),nid:0,sn:0,items:{},containers:[],exits:[],bags:[],settle:{},ph:'prep',t0:0,limit:0,waveAt:0,waveN:0,supplyAt:0,supplied:0,statT:0,alarmUntil:0,keyUsed:0,bossDead:0,board:[],machN:0,map:H.map,rep:null};
 for(const p of plist()){p.raiPack=[];p.raiSecure=[];p.raiGear=null;p.raiArm=0;p.raiMax=100;p.raiLoaded=0;p.raiDeploy='';p.raiRisk=0;p.raiContract='cores';p.settled=0;p.extracted=0;p.raiLootT=0;delete p.raidSq}
 const pts=raidSample(m,26);pts.sort((a,b)=>Math.hypot(a[0],a[1])-Math.hypot(b[0],b[1]));
 pts.forEach((s,i)=>{
  const tier=i<9?0:i<18?1:2;const c={id:'C'+i+1,x:s[0],z:s[1],tier,vault:0,st:'closed',items:[],gen:0,searchBy:null,searchAt:0,label:'CACHE '+String(i+1).padStart(2,'0')+' · '+['OUTER','MID','DEEP'][tier]};
  R.containers.push(c);
 });
 const deep=R.containers.filter(c=>c.tier===2);deep.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));R.vault=deep[0]||R.containers[0];if(R.vault){R.vault.vault=1;R.vault.items=[raidNewItem(R,'key',{rar:2,qty:1}).id,raidNewItem(R,'core',{rar:2,qty:1}).id]}
 const A=raidOpenSpot(m,m.spawnsA,[-m.size[0]/2+8,0]),B=raidOpenSpot(m,m.spawnsB,[m.size[0]/2-8,0]),M=raidOpenSpot(m,m.spawnsM,[0,m.size[1]/2-8]);
 const off=(a,b)=>{if(Math.hypot(a[0]-b[0],a[1]-b[1])<8)return [b[0]+(b[0]>=0?-6:6),b[1]];return b};
 const B2=off(A,B),M2=off(A,M);
 R.exits=[
  {id:'E1',kind:'call',x:A[0],z:A[1],st:'closed',openAt:0,closeAt:0,label:'CALL-IN LZ'},
  {id:'E2',kind:'timed',x:B2[0],z:B2[1],st:'timed',openAt:0,closeAt:0,label:'TIMED TRANSPORT'},
  {id:'E3',kind:'key',x:M2[0],z:M2[1],st:'closed',openAt:0,closeAt:0,label:'EMERGENCY PAD'}
 ];
 const spawnMach=(arch,x,z,guard)=>{
  const def=RARCH[arch];const p=addRaidMachine(R,arch,x,z,guard,false);return p;
 };
 const vr=R.vault?[R.vault.x,R.vault.z]:[0,0];
 spawnMach('boss',raidClamp(vr[0]+2,-m.size[0]/2+2,m.size[0]/2-2),raidClamp(vr[1]+2,-m.size[1]/2+2,m.size[1]/2-2),R.containers.indexOf(R.vault));
 spawnMach('heavy',vr[0]-4,vr[1]+1,null);spawnMach('heavy',vr[0]+4,vr[1]-2,null);
 const t1=R.containers.filter(c=>c.tier===1);
 spawnMach('hunter',t1[0]?t1[0].x-3:vr[0],t1[0]?t1[0].z+3:vr[1],null);
 spawnMach('hunter',t1[1]?t1[1].x+3:vr[0],t1[1]?t1[1].z-3:vr[1],null);
 const t0=R.containers.filter(c=>c.tier===0);
 spawnMach('scout',t0[0]?t0[0].x:vr[0]-10,t0[0]?t0[0].z:vr[1],null);
 spawnMach('scout',t0[1]?t0[1].x:vr[0]+10,t0[1]?t0[1].z:vr[1],null);
 spawnMach('flyer',vr[0]-8,vr[1]+6,null);spawnMach('flyer',vr[0]+8,vr[1]-6,null);
 R.machN=plist().filter(p=>p.machine).length;
}
function raidExitPub(R,e){const eta=e&&e.openAt?Math.max(0,Math.round(e.openAt-H.t)):0;const cl=e&&e.closeAt?Math.max(0,Math.round(e.closeAt-H.t)):0;return{e:e.id,id:e.id,x:+e.x.toFixed(1),z:+e.z.toFixed(1),k:e.kind,st:e.st,label:e.label,eta,cl}}
function raidInfo(){
 const R=H.raid;
 const e=R&&R.exits?R.exits.map(x=>raidExitPub(R,x)):[];
 return{run:R&&R.run,v:RAID.v,time:RAID.time,cap:RAID.cap,secure:RAID.secure,boardT:RAID.board,extR:RAID.extR,containers:R?R.containers.map(c=>[c.id,+c.x.toFixed(1),+c.z.toFixed(1),c.tier,c.st,c.label,c.vault?1:0]):[],exits:e,bags:[],squads:RSQN};
}
function raidStartServer(){
 const R=H.raid;if(!R)return;
 R.ph='active';R.t0=R.t0||H.t;R.limit=R.t0+RAID.time;R.waveAt=R.t0+RAID.wave;R.supplyAt=R.t0+RAID.supplyAt;R.statT=R.t0+1;
 const te=R.exits.find(e=>e.kind==='timed');if(te){te.openAt=R.t0+RAID.timedAt;te.closeAt=te.openAt+RAID.timedWindow}
 for(const p of plist())if(p.machine&&p.flyer&&p.e){p.e.pos.y=RAID.flyerY;p.e.ground=false;if(p.p)p.p[1]=p.e.pos.y}
 bcast({t:'rstart',run:R.run,t0:+R.t0.toFixed(2),limit:Math.round(R.limit),time:RAID.time,exits:R.exits.map(e=>raidExitPub(R,e)),count:RAID.squads});
 for(const p of plist())if(!p.machine&&p.raiArm){p.raiMax=130;p.hp=p.raiMax;bcast({t:'hp',id:p.id,hp:p.hp})}
 sendRaidStat(R);
}
function raidStatPub(R){
 return{t:'rstat',left:Math.max(0,Math.round(R.limit-H.t)),ph:R.ph,alarm:R.alarmUntil?Math.max(0,Math.round(R.alarmUntil-H.t)):0,
  c:R.containers.map(c=>[c.id,c.st,c.tier,c.searchBy?1:0]),
  e:R.exits.map(e=>[e.id,e.kind,e.st,e.openAt?Math.max(0,Math.round(e.openAt-H.t)):0,e.closeAt?Math.max(0,Math.round(e.closeAt-H.t)):0]),
  b:R.bags.map(b=>[b.id,+b.x.toFixed(1),+b.z.toFixed(1),b.items.reduce((n,id)=>n+(R.items[id]&&!R.items[id].taken?1:0),0)]),
  machines:plist().filter(p=>p.machine&&p.alive).length,humans:plist().filter(p=>!p.machine&&!p.bot&&p.alive&&!p.extracted&&!p.settled).length,
  boss:R.bossDead?1:0,open:R.containers.filter(c=>c.st==='open').length,extracted:plist().filter(p=>!p.machine&&!p.bot&&p.extracted).length};
}
function sendRaidStat(R){bcast(raidStatPub(R))}
function raidIsOpen(R,e){if(!e)return false;if(e.st==='open')return !e.closeAt||H.t<e.closeAt;return false}
function raidExitOpen(R,e,why){
 if(e.st==='open')return;e.st='open';bcast({t:'rstate',e:raidExitPub(R,e),why:why||''});
 bcast({t:'rfeed',msg:'EXIT OPEN: '+e.label+(e.closeAt?' · closes in '+Math.max(0,Math.round(e.closeAt-H.t))+'s':'')});
 if(e.kind==='call'){R.alarmUntil=H.t+RAID.alarmWave+15;bcast({t:'ralarm',e:e.id,eta:Math.max(0,Math.round(e.closeAt?e.closeAt-H.t:0)),msg:'EXTRACTION CALLED — MACHINES CONVERGING ON THE LZ'});raidAlarmWave(R,e)}
}
function raidAlarmWave(R,e){
 if(plist().filter(p=>p.machine&&p.alive).length>=17)return;
 const m=buildMap(H.map);const arch=Math.random()<.5?'hunter':'heavy';
 for(let i=0;i<2;i++){const s=raidOpenSpot(m,[[e.x+(i?6:-6),e.z+(i?3:-3)]],[e.x,e.z]);addRaidMachine(R,arch,s[0],s[1],null,true)}
 bcast({t:'rwave',n:2,arch:'alarm',msg:'ALARM — machine response inbound'});
}
function raidSpawnWave(R){
 if(plist().filter(p=>p.machine&&p.alive).length>=17)return;
 const cs=R.containers.filter(c=>c.st==='open');const arch=['scout','hunter','heavy','flyer'][Math.random()*4|0];
 const base=cs.length?cs[Math.random()*cs.length|0]:R.containers[Math.random()*R.containers.length|0];
 const names=[];
 for(let i=0;i<2;i++){const m=buildMap(H.map);const s={x:base.x+(i?4:-4)+((Math.random()-.5)*3),z:base.z+(i?-3:3)+((Math.random()-.5)*3)};const p=addRaidMachine(R,arch,s.x,s.z,null,true);names.push(p.name)}
 R.waveN++;R.waveAt=H.t+RAID.wave;
 bcast({t:'rwave',n:2,arch,msg:'MACHINE PATROL '+(arch.toUpperCase())+' — inbound'});
}
function addRaidMachine(R,arch,x,z,guard,announce){
 const def=RARCH[arch]||RARCH.scout;const id='bot'+(++H.botN);
 const b=H.players[id]=newP(id,def.n+' '+(++R.machN),true);
 b.machine=1;b.arch=arch;b.team='M';b.color=def.color;b.cl=def.cl;b.gun=def.gun;b.hp=def.hp;b.raiMax=def.hp;b.alive=true;
 b.raidSpawn=[+x.toFixed(1),+z.toFixed(1)];b.raidGuard=guard==null?null:guard;b.boss=arch==='boss'?1:0;b.flyer=arch==='flyer'?1:0;b.rarD=arch==='boss'?1.35:arch==='heavy'?1.15:1;
 botReset(b,[x,0,z,faceCenter([x,z])]);if(arch==='flyer'){b.e.pos.y=RAID.flyerY;b.e.ground=false}
 b.p=[b.e.pos.x,b.e.pos.y,b.e.pos.z,b.yaw,0,WIDX[b.gun]|0,arch==='flyer'?2:0];
 if(announce){bcast({t:'join',id,name:b.name,team:'M',color:def.color,o:b.ord,sk:'',ws:{},cl:def.cl,bot:1,machine:1,mc:1,arch});bcast({t:'spawn',id,s:[b.e.pos.x,b.e.pos.z,b.yaw]})}
 return b;
}
function raidTick(dt){
 const R=H.raid;if(!R||R.ph!=='active'||H.phase!=='play')return;
 if(H.t>=R.statT){R.statT=H.t+1;sendRaidStat(R)}
 // caches: finish or cancel searches
 for(const c of R.containers){
  if(c.st!=='searching')continue;
  const p=H.players[c.searchBy];
  if(!p||!p.alive||p.down||p.extracted||p.settled||Math.hypot(p.p[0]-c.x,p.p[2]-c.z)>5.2){
   const by=c.searchBy;c.st='closed';c.searchBy=null;c.searchAt=0;bcast({t:'rcstate',c:[c.id,'closed',c.tier]});if(by)sendTo(by,{t:'rerr',msg:'Search interrupted — stay beside the cache'});
  }else if(H.t>=c.searchAt){
   c.st='open';if(!c.gen)raidFillContainer(R,c);const items=raidLootPubs(R,c.items);sendTo(p.id,{t:'rfound',c:c.id,label:c.label,items});bcast({t:'rcstate',c:[c.id,'open',c.tier]});bcast({t:'rfeed',msg:'CACHE OPEN: '+c.label});
  }
 }
 // exits: timed/called open windows, then close
 for(const e of R.exits){
  if((e.st==='timed'||e.st==='called')&&e.openAt&&H.t>=e.openAt){e.st='open';bcast({t:'rstate',e:raidExitPub(R,e),why:e.kind});
   if(e.kind==='timed')bcast({t:'rfeed',msg:'TIMED TRANSPORT ARRIVED · '+e.label});}
  if(e.st==='open'&&e.closeAt&&H.t>=e.closeAt){e.st='closed';bcast({t:'rstate',e:raidExitPub(R,e),why:'closed'});bcast({t:'rfeed',msg:'EXIT CLOSED: '+e.label})}
 }
 // boarding progress
 for(let i=R.board.length-1;i>=0;i--){
  const bd=R.board[i],p=H.players[bd.pid],e=R.exits.find(x=>x.id===bd.e);
  if(!p||!e||!p.alive||p.down||p.extracted||p.settled||!raidIsOpen(R,e)||Math.hypot(p.p[0]-e.x,p.p[2]-e.z)>RAID.extR+.6){
   R.board.splice(i,1);sendTo(bd.pid,{t:'rfail',msg:'Extraction interrupted — stay at the exit'});continue;
  }
  bd.t=(bd.t||0)+dt;
  if((bd.t-(bd.sendT||0))>.12||bd.t>=RAID.board){bd.sendT=bd.t;sendTo(bd.pid,{t:'rboard',e:bd.e,p:Math.min(1,bd.t/RAID.board),left:Math.max(0,RAID.board-bd.t)})}
  if(bd.t>=RAID.board){R.board.splice(i,1);raidExtract(R,p,e)}
 }
 // supply drop opens one cache
 if(!R.supplied&&H.t>=R.supplyAt){
  R.supplied=1;const cs=R.containers.filter(c=>c.st==='closed');
  if(cs.length){const c=cs[Math.random()*cs.length|0];c.st='open';if(!c.gen)raidFillContainer(R,c);bcast({t:'rstate',e:null,c:[c.id,'open',c.tier]});bcast({t:'rcstate',c:[c.id,'open',c.tier]});bcast({t:'rsupply',c:c.id,label:c.label,msg:'SUPPLY CACHE OPENED: '+c.label})}
 }
 // machine waves
 if(H.t>=R.waveAt&&H.t<R.limit-20)raidSpawnWave(R);
 // airborne flyers
 for(const b of plist())if(b.machine&&b.flyer&&b.alive&&!b.down)raidFlyerTick(b,dt);
 // reconnect reservation: settle operators whose reconnect window expired
 for(const p of plist().slice()){
  if(!p.raiGhost||H.t-(p.raiGone||0)<RAID.reconnect)continue;
  raidDropBag(p);const rec=raidSettle(p,'disconnect');
  bcast({t:'rdead',id:p.id,by:'',name:p.name,why:'disconnect',dia:rec?rec.dia:0});
  delete H.players[p.id];bcast({t:'bye',id:p.id});
  sendSB();sendRaidStat(R);
 }
 // timer expiry: everyone still alive is killed/timed out (no respawn)
 if(H.t>=R.limit)raidEnd(R,'timeout');
 // no human operators left: the raid is over, bots stay for the outro
 else if(!plist().some(p=>!p.machine&&!p.bot&&!p.extracted&&!p.settled))raidEnd(R,'complete');
}
function raidFlyerTick(b,dt){
 const e=b.e;if(!e)return;const R=H.raid;const m=buildMap(H.map);
 e.pos.y=RAID.flyerY+Math.sin((H.t+b.ord)*1.1)*.7;e.ground=false;e.vel.set(0,0,0);
 let tgt=null,bd=1e9;
 for(const q of plist()){if(q.machine||!q.alive||q.down||q.raiGhost||q.extracted||q.settled)continue;const dd=Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z);if(dd<bd){bd=dd;tgt=q}}
 let wx=0,wz=0;
 if(tgt&&bd>4){wx=(tgt.p[0]-e.pos.x)/bd;wz=(tgt.p[2]-e.pos.z)/bd}
 else if(tgt&&bd>18){wx=-(tgt.p[0]-e.pos.x);wz=-(tgt.p[2]-e.pos.z);const l=Math.hypot(wx,wz)||1;wx/=l;wz/=l}
 else{const ex=R.exits.find(x=>x.st==='open')||R.containers[0];if(!ex)return;wx=(ex.x-e.pos.x);wz=(ex.z-e.pos.z);const l=Math.hypot(wx,wz)||1;wx/=l;wz/=l}
 const sp=3.1+(b.boss?0:0);e.pos.x=raidClamp(e.pos.x+wx*sp*dt,-m.size[0]/2+2,m.size[0]/2-2);e.pos.z=raidClamp(e.pos.z+wz*sp*dt,-m.size[1]/2+2,m.size[1]/2-2);
 b.yaw=Math.atan2(-wx,-wz);b.cool=(b.cool||0)-dt;
 if(tgt&&bd>4&&bd<55&&b.cool<=0){const w=W[b.gun]||W.ar;b.cool=1.5+Math.random()*.7;const dd=Math.hypot(tgt.p[0]-e.pos.x,tgt.p[1]-e.pos.y,tgt.p[2]-e.pos.z);_o.set(e.pos.x,e.pos.y,e.pos.z);if(rayClearHost(_o,_d.set(tgt.p[0],tgt.p[1]+1.2,tgt.p[2]))){bcast({t:'fx',id:b.id,a:[e.pos.x,e.pos.y,e.pos.z],b:[tgt.p[0],tgt.p[1]+1.2,tgt.p[2]],w:b.gun});damage(tgt,Math.round((w.body||8)*falloff(w,dd)),b.id,false,b.gun)}}
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX[b.gun]|0,2];
}
function raidSearch(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const c=R.containers.find(x=>x.id===m.c);if(!c)return;
 if(c.st==='open'){raidLook(from,m,p);return}
 if(c.st==='searching'){sendTo(from,{t:'rerr',msg:'Another squadmate is searching this cache'});return}
 if(Math.hypot(p.p[0]-c.x,p.p[2]-c.z)>5.2){sendTo(from,{t:'rerr',msg:'Move closer to the cache'});return}
 if(!raidSeqOK(p,'search'+c.id,m.sq))return;
 c.st='searching';c.searchBy=p.id;c.searchAt=H.t+RAID.search;
 bcast({t:'rsearch',c:c.id,label:c.label,by:p.name,eta:RAID.search});
}
function raidSource(R,msg){
 if(msg&&msg.b!=null){const b=R.bags.find(x=>x.id===msg.b&&!x.taken);return b?{type:'bag',id:b.id,x:b.x,z:b.z,label:b.label||'DEATH BAG',items:b.items,obj:b}:null}
 if(msg&&msg.c!=null){const c=R.containers.find(x=>x.id===msg.c&&x.st==='open');return c?{type:'cache',id:c.id,x:c.x,z:c.z,label:c.label,items:c.items,obj:c}:null}
 return null;
}
function raidLook(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const src=raidSource(R,m);if(!src){sendTo(from,{t:'rerr',msg:'That cache is not open'});return}
 if(Math.hypot(p.p[0]-src.x,p.p[2]-src.z)>(src.type==='bag'?4:5.2)){sendTo(from,{t:'rerr',msg:'Move closer'});return}
 const items=raidLootPubs(R,src.items.filter(id=>R.items[id]&&!R.items[id].taken));
 sendTo(from,{t:'rfound',c:src.type==='cache'?src.id:null,b:src.type==='bag'?src.id:null,label:src.label,items,type:src.type,total:items.length});
}
function raidTake(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const src=raidSource(R,m);if(!src)return;
 if(Math.hypot(p.p[0]-src.x,p.p[2]-src.z)>(src.type==='bag'?4:5.2)){sendTo(from,{t:'rerr',msg:'Move closer'});return}
 const cap=p.raiCap||RAID.cap;if(p.raiPack.length>=cap){sendTo(from,{t:'rerr',msg:'Backpack full ('+cap+' items)'});return}
 const it=R.items[m.i];if(!it||it.taken||src.items.indexOf(m.i)<0||it.owner!=null){sendTo(from,{t:'rerr',msg:'That item was already taken'});return}
 if(!raidSeqOK(p,'take'+it.id,m.sq))return;
 it.taken=1;it.owner=from;it.secure=0;p.raiPack.push(it.id);
 const remain=raidLootPubs(R,src.items.filter(id=>R.items[id]&&!R.items[id].taken));
 const rec={t:'rtook',i:it.id,item:raidItemPub(it),pack:p.raiPack.slice(),weight:p.raiPack.length,items:remain,total:remain.length,label:src.label};
 sendTo(from,rec);
 if(src.type==='bag'&&!remain.length){src.obj.taken=1;R.bags=R.bags.filter(x=>x!==src.obj);bcast({t:'rbaggone',b:src.id});bcast({t:'rfeed',msg:'DEATH BAG EMPTIED'})}
}
function raidSecure(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const id=m.i;const idx=p.raiPack.indexOf(id);const it=R.items[id];
 if(idx<0||!it||it.kind==='weapon'||it.kind==='armor'){sendTo(from,{t:'rerr',msg:'Only loot items can be secured'});return}
 const scap=p.raiSecureCap||RAID.secure;if(p.raiSecure.length>=scap){sendTo(from,{t:'rerr',msg:'Secure pocket full ('+scap+' items)'});return}
 if(!raidSeqOK(p,'sec'+id,m.sq))return;
 p.raiPack.splice(idx,1);it.secure=1;p.raiSecure.push(id);
 sendTo(from,{t:'rsecureok',i:id,pack:p.raiPack.slice(),secure:p.raiSecure.slice(),items:raidLootPubs(R,id!=null?[id]:[])});
 bcast({t:'rfeed',msg:p.name+' secured an item'});
}
function raidUse(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const id=m.i;const it=R.items[id];if(!it||it.kind!=='med'||it.owner!==from||p.raiPack.indexOf(id)<0)return;
 if(!raidSeqOK(p,'use'+id+(m.sq||0),m.sq))return;
 it.qty=(it.qty||1)-1;const mx=p.raiMax||(100+(p.raiArm?30:0));p.hp=Math.min(mx,p.hp+35);
 sendTo(from,{t:'ruseok',i:id,qty:it.qty,hp:p.hp,max:mx,pack:it.qty>0?p.raiPack.slice():p.raiPack.filter(x=>x!==id)});
 bcast({t:'hp',id:from,hp:Math.round(p.hp)});
 if(it.qty<=0){it.taken=1;it.owner=null;const k=p.raiPack.indexOf(id);if(k>=0)p.raiPack.splice(k,1);bcast({t:'rfeed',msg:p.name+' used a medkit'})}
}
function raidCall(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const e=R.exits.find(x=>x.id===m.e&&x.kind==='call');if(!e)return;
 if(e.st==='open'||e.st==='called'){sendTo(from,{t:'rerr',msg:'Extraction is already inbound'});return}
 if(H.t<e.openAt)return;
 if(Math.hypot(p.p[0]-e.x,p.p[2]-e.z)>RAID.extR+2.5){sendTo(from,{t:'rerr',msg:'Get to the call-in LZ first'});return}
 e.st='called';e.openAt=H.t+RAID.callEta;e.closeAt=e.openAt+RAID.callWindow;
 bcast({t:'rcall',e:raidExitPub(R,e),eta:RAID.callEta,window:RAID.callWindow,by:p.name});
}
function raidKey(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 const e=R.exits.find(x=>x.id===m.e&&x.kind==='key');if(!e)return;
 if(e.st==='open'){sendTo(from,{t:'rerr',msg:'The emergency pad is already open'});return}
 if(Math.hypot(p.p[0]-e.x,p.p[2]-e.z)>RAID.extR+1.5){sendTo(from,{t:'rerr',msg:'Bring the key to the emergency pad'});return}
 let id=null,where='';
 let i=p.raiPack.findIndex(x=>R.items[x]&&R.items[x].kind==='key');
 if(i>=0){id=p.raiPack[i];p.raiPack.splice(i,1);where='pack'}
 else{i=p.raiSecure.findIndex(x=>R.items[x]&&R.items[x].kind==='key');if(i>=0){id=p.raiSecure[i];p.raiSecure.splice(i,1);where='secure'}}
 if(!id){sendTo(from,{t:'rerr',msg:'No keycard in backpack or secure pocket'});return}
 if(!raidSeqOK(p,'key'+e.id,m.sq))return;
 const it=R.items[id];it.taken=1;it.owner=null;
 e.st='open';e.closeAt=H.t+RAID.keyWindow;R.keyUsed=1;
 bcast({t:'rkey',e:raidExitPub(R,e),i:id,where,closeAt:Math.max(0,Math.round(e.closeAt-H.t))});
 bcast({t:'rfeed',msg:'EMERGENCY PAD OPENED by '+p.name});
}
function raidExt(from,m,p){
 const R=H.raid;if(!R||H.phase!=='play'||!p||!p.alive||p.down||p.extracted||p.settled)return;
 if(R.board.some(b=>b.pid===from))return;
 const e=R.exits.find(x=>x.id===m.e);if(!e||!raidIsOpen(R,e)){sendTo(from,{t:'rerr',msg:'That exit is not open'});return}
 if(Math.hypot(p.p[0]-e.x,p.p[2]-e.z)>RAID.extR){sendTo(from,{t:'rerr',msg:'Move onto the extraction pad'});return}
 if(!raidSeqOK(p,'ext'+e.id,m.sq))return;
 R.board.push({pid:from,e:e.id,t:0,sendT:0});sendTo(from,{t:'rboard',e:e.id,p:0,left:RAID.board});
}
function raidDropBag(p){
 const R=H.raid;if(!R)return null;
 const ids=[];const add=id=>{const it=R.items[id];if(it&&it.owner===p.id&&ids.indexOf(id)<0)ids.push(id)};
 for(const id of p.raiPack||[])add(id);
 if(p.raiGear&&!p.raiRecovery){const wi=p.raiGear.weapon,ai=p.raiGear.armor;const w=R.items[wi];if(w&&!w.insure)add(wi);add(ai)}
 if(!ids.length)return null;
 const bag={id:R.run+'-B'+(++R.sn),x:+p.p[0].toFixed(1),y:Math.max(.2,p.p[1]||0),z:+p.p[2].toFixed(1),items:ids,taken:0,label:(p.name||'OPERATOR')+' · DEATH BAG',t:H.t,byName:p.name};
 for(const id of ids){const it=R.items[id];if(it){it.owner=null;it.bag=bag.id;it.taken=0}}
 R.bags.push(bag);p.raiPack=[];
 bcast({t:'rbagnew',b:bag.id,x:bag.x,z:bag.z,n:ids.length,label:bag.label});
 bcast({t:'rfeed',msg:'DEATH BAG DROPPED: '+p.name+' · '+ids.length+' items'});
 return bag;
}
function raidSettle(p,outcome){
 const R=H.raid;if(!R)return null;
 const opk=p.raiDeploy||p.id;
 if(R.settle[opk]){const old=R.settle[opk];toPlayer(p.id,old);return old}
 const items=[];
 const add=id=>{const it=R.items[id];if(it&&it.owner===p.id&&it.kind!=='armor'){it.taken=1;it.owner=null;items.push(it)}else if(it&&it.owner===p.id&&it.kind==='armor'&&outcome==='extract'){it.taken=1;it.owner=null;items.push(it)}};
 const secureN=(p.raiSecure||[]).length;
 for(const id of p.raiSecure||[])add(id);
 if(outcome==='extract')for(const id of p.raiPack||[])add(id);
 if(p.raiGear&&!p.raiRecovery){const wi=R.items[p.raiGear.weapon],ai=R.items[p.raiGear.armor];if(wi&&(outcome==='extract'||wi.insure))add(wi.id);if(ai&&outcome==='extract')add(ai.id)}
 p.raiPack=[];p.raiSecure=[];
 let cores=0,base=0;
 for(const it of items){if(it.kind==='core')cores+=it.qty||1;else if(it.kind==='val')base+=Math.max(1,Math.floor((it.val||0)/4))}
 let bonus=0;
 if(outcome==='extract'){
  if(p.raiContract==='cores'&&cores>0)bonus=cores*60;
  else if(p.raiContract==='boss'&&R.bossDead)bonus=120;
  else if(p.raiContract==='extract')bonus=30;
 }
 if(p.raiRisk)bonus=Math.round(bonus*1.5);
 const rec={t:'rsettle',id:p.id,name:p.name,outcome,token:R.run+'-S'+(++R.sn),map:MI(H.map).name,items:items.map(raidItemPub),dia:base+bonus,base,bonus,cores,contract:p.raiContract||'cores',risk:p.raiRisk?1:0,insured:!!(p.raiGear&&R.items[p.raiGear.weapon]&&R.items[p.raiGear.weapon].insure),secure:secureN,stash:outcome==='extract'?'EXTRACTED':'LOST'};
 R.settle[opk]=rec;
 p.settled=1;p.alive=false;if(outcome==='extract')p.extracted=1;
 toPlayer(p.id,rec);
 return rec;
}
function raidExtract(R,p,e){
 if(p.extracted||p.settled)return;
 p.alive=false;p.extracted=1;p.hp=0;p.down=false;p.rev=null;
 const bag=null;
 const rec=raidSettle(p,'extract');
 bcast({t:'rextracted',id:p.id,name:p.name,e:e.id,label:e.label,items:(rec&&rec.items||[]).length,dia:rec?rec.dia:0});
 bcast({t:'rfeed',msg:'EXTRACTED: '+p.name+' via '+e.label});
 sendSB();
}
function raidOnDeath(v,by){
 const R=H.raid;if(!R||!RAIDM(H.mode))return;
 if(v.machine){
  if(v.boss){R.bossDead=1;bcast({t:'rfeed',msg:'BOSS DESTROYED — reactor core contract secured'});sendRaidStat(R)}
  return;
 }
 if(v.raider||v.bot||v.extracted||v.settled)return;
 raidDropBag(v);
 const rec=raidSettle(v,'death');
 bcast({t:'rdead',id:v.id,by:by||'',name:v.name,why:'death',dia:rec?rec.dia:0});
 sendSB();
}
function raidEnd(R,reason){
 if(!R||R.ph==='over')return;
 R.ph='over';H.phase='roundEnd';
 for(const p of plist()){
  if(p.machine||p.bot||p.extracted||p.settled||!p.alive)continue;
  raidDropBag(p);const rec=raidSettle(p,'timeout');bcast({t:'rdead',id:p.id,by:'',name:p.name,why:reason, dia:rec?rec.dia:0});
 }
 bcast({t:'roundEnd',raid:1,reason,round:H.round,score:H.score,title:reason==='timeout'?'RAID TIMEOUT':'RAID COMPLETE',
  sub:reason==='timeout'?'No extraction before the storm timer expired':'Squad extraction complete',left:0});
 sendSB();
}
function raidSeqOK(p,key,seq){
 if(!p)return false;const k=key+'|'+(seq|0);const seen=p.raidSeen||(p.raidSeen={});
 if(seen[k])return false;seen[k]=1;return true;
}
function botRaid(b,dt){
 const R=H.raid;if(!R)return null;
 if(b.machine){
  if(b.raidGuard!=null){const c=R.containers[b.raidGuard];if(c&&c.st!=='open')return [c.x,0,c.z]}
  const m=buildMap(H.map);
  let near=null,nd=1e9;
  for(const q of plist()){if(q.machine||!q.alive||q.down||q.raiGhost||q.extracted||q.settled)continue;const d=Math.hypot(q.p[0]-b.e.pos.x,q.p[2]-b.e.pos.z);if(d<nd){nd=d;near=q}}
  if(near&&nd<38)return [near.p[0],0,near.p[2]];
  const e=R.exits.find(x=>x.st==='open');
  if(e)return [e.x,0,e.z];
  const c=R.containers[(b.ord*7)%R.containers.length];
  return c?[c.x,0,c.z]:null;
 }
 if(b.bot){
  const op=R.containers.filter(c=>c.st==='closed'&&c.tier>0);const c=op.length?op[(b.ord*3)%op.length]:null;
  if(c)return [c.x,0,c.z];
  const e=R.exits.find(x=>x.st==='open');
  return e?[e.x,0,e.z]:null;
 }
 return null;
}
function raidLoad(from,m,p){
 const R=H.raid;if(!R||!p||H.phase==='lobby'||H.phase==='roundEnd'||p.settled)return;
 if(m.rv!=null&&m.rv!==RAID.v){sendTo(from,{t:'rerr',msg:'Raid protocol mismatch — reload the game'});return}
 const g=m.gear||{};
 const deploy=String(m.deployId||g.deployId||'').slice(0,40);
 const opk=p.raiDeploy||deploy||p.id;
 if(p.settled||(deploy&&R.settle[deploy])){const s=R.settle[deploy]||R.settle[p.raiDeploy||'']||R.settle[from];if(s)sendTo(from,{t:'rsettle',...s});return}
 if((p.raiDeploy&&deploy&&p.raiDeploy!==deploy)||(p.raiLoaded&&deploy&&p.raiLoaded!==deploy)){sendTo(from,{t:'rerr',msg:'Loadout is locked to the original raid deployment'});return}
 if(p.raiLoaded){
  const gw=p.raiGear&&R.items[p.raiGear.weapon],aw=p.raiGear&&R.items[p.raiGear.armor];
  sendTo(from,{t:'rloadok',hp:p.hp,max:p.raiMax||100,armored:!!p.raiArm,weapon:gw?gw.w:null,gear:raidLootPubs(R,(p.raiGear&&p.raiGear.items)||[]),pack:raidLootPubs(R,p.raiPack||[]),secure:raidLootPubs(R,p.raiSecure||[]),contract:p.raiContract,insure:!!(gw&&gw.insure),cap:p.raiCap||RAID.cap,secureCap:p.raiSecureCap||RAID.secure,recovery:!!p.raiRecovery});
  return;
 }
 const rec=!!g.recovery;
 let w=rec?'ar':g.weapon;
 if(!W[w]||W[w].slot!==0)w='ar';
 p.raiArm=rec?0:(g.armor?1:0);p.raiInsure=rec?0:(g.insure?1:0);
 p.raiContract=rec?'cores':(['cores','boss','extract'].indexOf(m.contract||g.contract)>=0?(m.contract||g.contract):'cores');
 p.raiRisk=rec?0:(g.risk?1:0);p.raiDeploy=deploy||p.raiDeploy||'';p.raiLoaded=p.raiDeploy||('L'+Date.now());
 p.raiRecovery=rec?1:0;p.raiCap=rec?RAID.recCap:RAID.cap;p.raiSecureCap=rec?RAID.recSecure:RAID.secure;
 p.raiPack=[];p.raiSecure=[];p.raiGear={items:[],weapon:null,armor:null};p.raiMax=rec?100:100+(p.raiArm?30:0);
 const wi=raidNewItem(R,'weapon',{w,rar:1,gear:1,insure:!!(p.raiInsure&&!rec),owner:from,recovery:rec});p.raiGear.weapon=wi.id;p.raiGear.items.push(wi.id);
 if(p.raiArm){const ai=raidNewItem(R,'armor',{rar:1,gear:1,owner:from});p.raiGear.armor=ai.id;p.raiGear.items.push(ai.id)}
 const meds=rec?1:raidClamp(parseInt(g.meds)||0,0,3);
 for(let i=0;i<meds;i++){const it=raidNewItem(R,'med',{t:0,qty:1,rar:1,owner:from});p.raiPack.push(it.id)}
 if(g.key&&!rec){const ki=raidNewItem(R,'key',{rar:2,owner:from});p.raiPack.push(ki.id)}
 p.hp=p.raiMax;
 bcast({t:'hp',id:from,hp:p.hp});
 sendTo(from,{t:'rloadok',hp:p.hp,max:p.raiMax,armored:!!p.raiArm,weapon:w,gear:raidLootPubs(R,p.raiGear.items),pack:raidLootPubs(R,p.raiPack),secure:[],contract:p.raiContract,insure:!!(g.insure&&!rec),cap:p.raiCap,secureCap:p.raiSecureCap,recovery:rec?1:0});
 sendRaidStat(R);
}
window.__raid={RAID,RSQN,RSQCOL,RARCH,stopped:()=>H.raid};

// ================= v62 EXTRACTION RAID CLIENT =================
let RC=null, RAIDUI=false, RAO=null;
const RAID_ICON={call:'📞',timed:'⏱️',key:'🔑'};
const RAID_CCOL={call:0x38d6ff,timed:0xffa43a,key:0xcf8bff};
const RAID_TIERCOL=[0x8794a3,0x37a6ff,0xffb14a];
const RAID_STASH_V2=1;
function raidClamp2(v,a,b){return Math.max(a,Math.min(b,v))}
function raidStash(){
 let s=null;try{s=JSON.parse(LS('raidstash')||'null')}catch(e){}
 const base={v:RAID_STASH_V2,gear:{weapon:'ar',armor:false,meds:1,insure:false,contract:'cores',wcond:100,acond:100},mats:{wire:0,steel:0,chem:0,fuel:0},items:[],hist:[],map:0,recovery:false,base:{stash:0,bay:0},trader:{rep:0,stock:null}};
 if(!s||typeof s!=='object')s=Object.assign({},base);
 s.v=RAID_STASH_V2;s.gear=Object.assign({},base.gear,s.gear||{});s.mats=Object.assign({},base.mats,s.mats||{});
 s.gear.weapon=W[s.gear.weapon]&&W[s.gear.weapon].slot===0?s.gear.weapon:'ar';
 s.gear.meds=raidClamp2(parseInt(s.gear.meds)||0,0,3);s.gear.contract=['cores','boss','extract'].indexOf(s.gear.contract)>=0?s.gear.contract:'cores';
 s.gear.wcond=raidClamp2(Math.round(+s.gear.wcond),0,100);if(!isFinite(s.gear.wcond))s.gear.wcond=100;
 s.gear.acond=raidClamp2(Math.round(+s.gear.acond),0,100);if(!isFinite(s.gear.acond))s.gear.acond=100;
 s.armor=!!s.gear.armor;s.insure=!!s.gear.insure;s.map=raidClamp2(parseInt(s.map)||0,0,MATHSafe());
 s.base=Object.assign({},base.base,s.base||{});s.base.stash=raidClamp2(parseInt(s.base.stash)||0,0,3);s.base.bay=raidClamp2(parseInt(s.base.bay)||0,0,2);
 s.trader=Object.assign({},base.trader,s.trader||{});s.trader.rep=raidClamp2(parseInt(s.trader.rep)||0,0,20);
 if(!Array.isArray(s.trader.stock))s.trader.stock=raidTraderStock();
 s.trader.stock=s.trader.stock.filter(x=>x&&x.id&&(x.qty|0)>0).slice(0,8);
 s.items=Array.isArray(s.items)?s.items.filter(x=>x&&x.id):[];s.hist=Array.isArray(s.hist)?s.hist:[];s.recovery=!!s.recovery;return s;
}
function raidStashCap(st){return 20+8*(st.base.stash|0)}
function raidTraderStock(){return[
 {id:'stock_med',name:'Field Medkit',k:'med',q:1,qty:2,price:30},
 {id:'stock_wire',name:'Wire Bundle · 3 salvage',k:'mat',m:'wire',q:3,qty:3,price:18},
 {id:'stock_steel',name:'Steel Bundle · 3 salvage',k:'mat',m:'steel',q:3,qty:2,price:24},
 {id:'stock_armor',name:'Body Armor Plate',k:'armor',q:1,qty:1,price:70}
]}
function raidTraderDiscount(st){return Math.min(.30,((st.trader.rep|0)*.02))}
function raidTraderPrice(st,item){const p=Math.max(1,Math.round((item.price||0)*(1-raidTraderDiscount(st))));return p}
function raidRepairQuote(st,slot){
 const cond=slot==='w'?st.gear.wcond:st.gear.acond;
 const miss=Math.max(0,100-(cond|0));
 return{dia:Math.max(0,Math.round(Math.ceil(miss/10)*5*(1-Math.min(.30,.15*(st.base.bay|0))))),mat:slot==='w'?'steel':'wire',cond:cond|0};
}
function MATHSafe(){return Math.max(0,MAPS.length-1)}
function raidSaveStash(s){s.v=RAID_STASH_V2;try{LSS('raidstash',JSON.stringify(s))}catch(e){}}
function raidLocalId(){return 'st'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function raidPending(){
 try{const p=JSON.parse(sessionStorage.getItem('hsz_raidgear')||'null');return p&&p.v===1&&p.gear?p:null}catch(e){return null}
}
function raidSavePending(gear,deployId,map){
 try{sessionStorage.setItem('hsz_raidgear',JSON.stringify({v:1,gear,deployId,map,at:Date.now()}))}catch(e){}
}
function raidAppliedTokens(){
 let a=[];try{a=JSON.parse(sessionStorage.getItem('hsz_raidApplied')||'[]')}catch(e){}
 return Array.isArray(a)?a:[];
}
function raidAppliedAdd(tok){
 if(!tok)return;const a=raidAppliedTokens();if(a.indexOf(tok)>=0)return; a.push(tok);if(a.length>40)a.splice(0,a.length-40);
 try{sessionStorage.setItem('hsz_raidApplied',JSON.stringify(a))}catch(e){}
}
function raidMsgShow(t){const el=$('raidMsg');if(el)el.textContent=t||''}
function raidMsg(m){
 if(!RC||!m)return false;
 switch(m.t){
 case 'rstart':{
  RC.baseT=+m.t0||0;RC.srvAt=performance.now();RC.left=Math.max(0,(m.time|0)||RAID.time);RC.alarm=0;RC.board=null;RC.hudHtml='';
  for(const e of m.exits||[]){let q=RC.exits.find(x=>x.id===e.id);if(!q){q={id:e.id,x:+e.x,z:+e.z,k:e.k,st:e.st||'closed',label:e.label||'',eta:e.eta|0,cl:e.cl|0};RC.exits.push(q);try{raidMakeExit(q);RC.meshes.push(q.mesh)}catch(x){}}else{q.st=e.st||'closed';q.k=e.k||q.k;q.eta=e.eta|0;q.cl=e.cl|0;q.label=e.label||q.label;raidPaintExit(q)}}
  RC.phase='active';raidHudUpd();raidPromptUpd();feed('🚁 RAID LIVE · '+RAID.time+'s storm window');SFX.beep(1200);return true;
 }
 case 'rstat':{
  RC.stat=m;RC.left=Math.max(0,m.left|0);RC.alarm=Math.max(0,m.alarm|0);
  if(m.c)for(const r of m.c){const c=RC.containers.find(x=>x.id===r[0]);if(c){c.st=r[1];c.tier=r[2]|0;raidPaintCache(c);if(RC.search&&RC.search.c===c.id&&c.st!=='searching')RC.search=null}}
  if(m.e)for(const r of m.e){const e=RC.exits.find(x=>x.id===r[0]);if(e){e.k=r[1]||e.k;e.st=r[2]||e.st;e.eta=r[3]|0;e.cl=r[4]|0;raidPaintExit(e)}}
  if(m.b){const live={};for(const r of m.b){live[r[0]]=1;let b=RC.bags.find(x=>x.id===r[0]);if(!b){b={id:r[0],x:+r[1],z:+r[2],n:r[3]|0,label:'DEATH BAG',taken:0};RC.bags.push(b);try{raidMakeBag(b);RC.meshes.push(b.mesh)}catch(e){}}else b.n=r[3]|0}}
  for(const b of RC.bags.slice())if(m.b&&!m.b.some(r=>r[0]===b.id)){if(b.mesh){try{scene.remove(b.mesh)}catch(e){}const k=RC.meshes.indexOf(b.mesh);if(k>=0)RC.meshes.splice(k,1)}RC.bags=RC.bags.filter(x=>x!==b)}
  RC.hudHtml='';raidHudUpd();return true;
 }
 case 'rsearch':{
  const c=RC.containers.find(x=>x.id===m.c);if(c){c.st='searching';raidPaintCache(c);RC.search={c:c.id,label:m.label||c.label,eta:Math.max(.1,+m.eta||RAID.search),t0:performance.now()}}
  feed('🔍 '+String(m.by||'Operator')+' is searching '+String(m.label||'a cache'));SFX.beep(800);return true;
 }
 case 'rcstate':{
  const r=m.c;if(Array.isArray(r)){const c=RC.containers.find(x=>x.id===r[0]);if(c){c.st=r[1];c.tier=r[2]|0;raidPaintCache(c);if(RC.search&&RC.search.c===c.id&&c.st!=='searching')RC.search=null}}
  return true;
 }
 case 'rfound':{
  for(const it of m.items||[])raidItemDefAdd(it);
  let src={type:m.b?'bag':'cache',c:m.c,b:m.b,label:m.label||'CACHE',items:m.items||[]};
  if(src.type==='cache'){const c=RC.containers.find(x=>x.id===m.c);if(c)src.x=c.x,src.z=c.z}
  else{const b=RC.bags.find(x=>x.id===m.b);if(b)src.x=b.x,src.z=b.z}
  RC.search=null;
  raidLootOpen(src);
  feed('🎒 CACHE OPEN: '+String(m.label||'')+' · '+((m.items||[]).length)+' items');SFX.beep(880);return true;
 }
 case 'rtook':{
  raidItemDefAdd(m.item);if(m.pack)RC.pack=m.pack.slice();
  if(RC.loot){RC.loot.items=m.items||[];raidRenderLoot()}
  raidHudUpd();feed('🎒 TOOK '+(m.item?raidItemName(m.item):'item')+' · backpack '+(m.weight||(RC.pack.length))+'/'+(RC.cap||RAID.cap));SFX.beep(980);return true;
 }
 case 'rsecureok':{
  for(const it of m.items||[])raidItemDefAdd(it);
  RC.pack=m.pack||[];RC.secure=m.secure||[];
  if(RC.packOn)raidRenderPack();
  raidHudUpd();feed('🔐 SECURED LOOT · pocket '+RC.secure.length+'/'+(RC.secureCap||RAID.secure));SFX.beep(1060);return true;
 }
 case 'ruseok':{
  if(RC.items[m.i])RC.items[m.i].q=m.qty|0;
  RC.pack=m.pack||[];RC.maxhp=m.max|RC.maxhp|0;me.hp=m.hp;updHP();
  if(RC.packOn)raidRenderPack();
  feed('✚ TREATMENT APPLIED · HP '+Math.round(m.hp)+'/'+Math.round(m.max||100));SFX.beep(540);return true;
 }
 case 'rloadok':{
  for(const it of m.gear||[])raidItemDefAdd(it);for(const it of m.pack||[])raidItemDefAdd(it);for(const it of m.secure||[])raidItemDefAdd(it);
  RC.loaded=1;if(RC.loadTO){clearTimeout(RC.loadTO);RC.loadTO=null}if(RC.loadTO2){clearTimeout(RC.loadTO2);RC.loadTO2=null}
  RC.maxhp=m.max|0||100;RC.armored=!!m.armored;RC.gearArmor=!!m.armored;RC.gearInsure=!!m.insure;RC.contract=m.contract||RC.contract;
  RC.recovery=!!m.recovery;RC.cap=m.cap||RAID.cap;RC.secureCap=m.secureCap||RAID.secure;
  RC.pack=(m.pack||[]).map(it=>it.id);RC.secure=(m.secure||[]).map(it=>it.id);RC.gearIds=(m.gear||[]).map(it=>it.id);
  if(m.weapon&&W[m.weapon]&&W[m.weapon].slot===0){RC.gearWeapon=m.weapon;me.load[0]=m.weapon;me.ammo[0]=magOf(m.weapon);setViewModel(m.weapon)}
  me.hp=m.hp;updHP();buildSlots();raidHudUpd();
  feed('🛡 GEAR ISSUED · '+(W[RC.gearWeapon]?W[RC.gearWeapon].name:RC.gearWeapon)+(RC.armored?' · +30 armor':'')+' · '+RC.pack.length+' supplies');SFX.beep(1000);return true;
 }
 case 'rbagnew':{
  let b=RC.bags.find(x=>x.id===m.b);
  if(!b){b={id:m.b,x:+m.x,z:+m.z,n:m.n|0,label:m.label||'DEATH BAG',taken:0};RC.bags.push(b);try{raidMakeBag(b);RC.meshes.push(b.mesh)}catch(e){}}
  b.n=m.n|0;b.label=m.label||b.label;
  feed('💀 '+String(m.label||'DEATH BAG')+' · '+(m.n|0)+' items');SFX.beep(420);return true;
 }
 case 'rbaggone':{
  const b=RC.bags.find(x=>x.id===m.b);if(b){if(b.mesh){try{scene.remove(b.mesh)}catch(e){}const k=RC.meshes.indexOf(b.mesh);if(k>=0)RC.meshes.splice(k,1)}RC.bags=RC.bags.filter(x=>x!==b);feed('💀 DEATH BAG EMPTIED')}
  if(RC.loot&&RC.loot.b===m.b)raidLootClose(true);
  return true;
 }
 case 'rghost':{
  feed('📡 '+String(m.name||'Operator')+' disconnected · reconnect window '+String(m.left||0)+'s');if(m.id===me.id)center('CONNECTION LOST — reconnecting…',1800);raidHudUpd();return true;
 }
 case 'rdead':{
  const q=C.players[m.id];if(q){q.alive=false;q.down=false;q.hp=0;if(q.model&&!q.model.userData.dead)q.model.userData.dead=.001}
  if(m.id===me.id){me.alive=false;me.down=false;me.frozen=true;me.hp=0;updHP();updDown();center('💀 '+(m.why==='disconnect'?'CONNECTION LOST':'OPERATOR DOWN')+' — no respawn',1600)}
  raidHudUpd();feed('💀 '+String(m.name||'Operator')+' — '+String(m.why||'eliminated'));return true;
 }
 case 'rextracted':{
  const q=C.players[m.id];if(q){q.alive=false;q.down=false;q.hp=0;if(q.model&&!q.model.userData.dead)q.model.userData.dead=.001}
  if(m.id===me.id){me.alive=false;me.frozen=true;me.hp=0;updHP();RC.board=null}
  raidHudUpd();feed('🚁 '+String(m.name||'Operator')+' EXTRACTED via '+String(m.label||m.e||'exit')+' · 💎'+(m.dia|0));SFX.beep(1200);return true;
 }
 case 'rsettle':{
  raidApplySettle(m);return true;
 }
 case 'rboard':{
  RC.board={e:m.e,p:Math.max(0,Math.min(1,+m.p||0)),left:Math.max(0,+m.left||0)};RC.modal=false;raidPromptUpd();raidHudUpd();return true;
 }
 case 'rfail':{
  RC.board=null;feed('⚠️ '+String(m.msg||'Extraction interrupted'));SFX.beep(300);raidPromptUpd();return true;
 }
 case 'rcall':{
  if(m.e){let e=RC.exits.find(x=>x.id===m.e.id);if(e){e.st=m.e.st;e.eta=m.e.eta|0;e.cl=m.e.cl|0;raidPaintExit(e)}}
  RC.alarm=Math.max(0,+m.eta||0);
  feed('📞 EXTRACTION CALLED by '+String(m.by||'Operator')+' · arrives in '+String(m.eta||0)+'s');center('📞 EXTRACT CALLED · '+(m.eta||0)+'s',1700);SFX.beep(1400);return true;
 }
 case 'ralarm':{
  RC.alarm=Math.max(0,+m.eta||RC.alarm);
  feed('⚠️ '+String(m.msg||'MACHINES CONVERGING'));SFX.beep(700);raidHudUpd();return true;
 }
 case 'rkey':{
  if(m.e){let e=RC.exits.find(x=>x.id===m.e.id);if(e){e.st=m.e.st;e.eta=m.e.eta|0;e.cl=m.e.cl|0;raidPaintExit(e)}}
  RC.pack=RC.pack.filter(x=>x!==m.i);RC.secure=RC.secure.filter(x=>x!==m.i);
  if(RC.items[m.i])RC.items[m.i].q=0;
  if(RC.packOn)raidRenderPack();
  feed('🔑 EMERGENCY PAD OPENED · closes in '+String(m.closeAt||0)+'s');center('🔑 KEYCARD INSERTED',1200);SFX.beep(1300);raidHudUpd();return true;
 }
 case 'rstate':{
  if(m.e){let e=RC.exits.find(x=>x.id===m.e.id);if(e){e.st=m.e.st;e.eta=m.e.eta|0;e.cl=m.e.cl|0;raidPaintExit(e)}}
  if(m.c&&Array.isArray(m.c)){const c=RC.containers.find(x=>x.id===m.c[0]);if(c){c.st=m.c[1];c.tier=m.c[2]|0;raidPaintCache(c)}}
  raidHudUpd();return true;
 }
 case 'rwave':{
  feed('⚠️ MACHINE PATROL '+String(m.arch||'').toUpperCase()+' · '+String(m.msg||'inbound'));center('🤖 MACHINES INBOUND',1100);SFX.beep(680);return true;
 }
 case 'rsupply':{
  feed('🎁 SUPPLY CACHE OPENED · '+String(m.label||''));SFX.beep(1050);return true;
 }
 case 'rfeed':{
  feed('📻 '+String(m.msg||''));return true;
 }
 case 'rerr':{
  feed('⚠️ '+String(m.msg||'Raid error'));SFX.beep(300);return true;
 }
 case 'roundEnd':{
  raidFinalResult(m);return true;
 }
 default:return false;
 }
}
function raidDebit(n){
 n=Math.max(0,n|0);if(!n)return true;
 if(PROG.dia<n){raidMsgShow('Need 💎 '+n+' — you have '+PROG.dia+'. Earn diamonds in matches or sell loot in the stash.');SFX.beep&&SFX.beep(300);return false}
 return true;
}
function raidDebitNow(n){
 n=Math.max(0,n|0);if(!raidDebit(n))return false;PROG.dia-=n;saveProg();updDiaUI();raidRenderBase();return true;
}
function raidItemName(it){
 if(!it)return'Unknown item';const k=it.k;
 if(k==='weapon')return W[it.w]?W[it.w].name:'Weapon';
 if(k==='armor')return 'Body Armor';
 if(k==='ammo')return (AMN[it.a]||'Ammo')+' Ammo';
 if(k==='med')return it.t?'Stim Pack':'Field Medkit';
 if(k==='mat')return RMN[it.m]||'Salvage';
 if(k==='val')return 'Trade Goods';
 if(k==='key')return 'Emergency Keycard';
 if(k==='core')return 'Reactor Core';
 return 'Loot';
}
function raidItemSub(it){
 if(!it)return'';const r=RAR[raidClamp2(it.r|0,0,4)]||RAR[0];let x='';
 if(it.k==='weapon'&&W[it.w])x=W[it.w].cls.toUpperCase();
 else if(it.k==='ammo')x=AMN[it.a]||'';
 else if(it.k==='med')x=(it.t?'STIM':'MEDKIT')+' ×'+(it.q||1);
 else if(it.k==='mat')x='×'+(it.q||1);
 else if(it.k==='val')x='💎'+(it.v||0);
 else if(it.k==='key')x='sector gate';
 else if(it.k==='core')x='contract item';
 else if(it.k==='armor')x='+30 HP';
 return r.n+(x?' · '+x:'');
}
function raidItemIcon(it){
 if(!it)return'📦';const k=it.k;
 if(k==='weapon')return ICON[it.w]?'<img src="'+ICON[it.w]+'" alt="">':'🔫';
 if(k==='armor')return'🛡️';if(k==='ammo')return'📦';if(k==='med')return it.t?'💉':'🧰';if(k==='mat')return'⛙';
 if(k==='val')return'💎';if(k==='key')return'🔑';if(k==='core')return'⚙️';return'📦';
}
function raidItemValue(it){
 if(!it)return'';if(it.k==='val')return'💎'+(it.v||0);if(it.k==='core')return'⚙️';if(it.k==='key')return'🔑';if(it.k==='weapon')return W[it.w]&&W[it.w].price?'💎'+W[it.w].price:'LOOT';
 if(it.k==='ammo')return'×'+(it.q||1);if(it.k==='med')return'×'+(it.q||1);if(it.k==='mat')return'×'+(it.q||1);return'';
}
function raidItemRow(it,btn){
 if(!it)return'';const r=raidClamp2(it.r|0,0,4);
 return `<div class="raidIt rar${r}"><span class="ri">${raidItemIcon(it)}</span><span class="rn"><b>${esc(raidItemName(it))}</b><small>${esc(raidItemSub(it))}</small></span><span class="rr">${raidItemValue(it)}</span>${btn||''}</div>`;
}
function raidPaintCache(c){
 if(!c||!c.mesh)return;const col=c.st==='open'?0x2ee59d:c.st==='searching'?0xffd23f:RAID_TIERCOL[c.tier|0]||0x8794a3;
 if(c.body&&c.body.material)c.body.material.color.setHex(col);
 if(c.ring&&c.ring.material){c.ring.material.color.setHex(col);c.ring.material.opacity=c.st==='closed'?.2:c.st==='searching'?.7:.42}
}
function raidPaintExit(e){
 if(!e||!e.mesh)return;const col=RAID_CCOL[e.k]||0x38d6ff;const open=e.st==='open';
 if(e.body&&e.body.material){e.body.material.color.setHex(col);e.body.material.opacity=open?.82:e.st==='timed'||e.st==='called'?.52:.2}
 if(e.ring&&e.ring.material){e.ring.material.color.setHex(col);e.ring.material.opacity=open?.9:e.st==='timed'||e.st==='called'?.5:.28}
}
function raidPaintBag(b){if(!b||!b.mesh)return;const g=b.mesh;g.traverse(o=>{if(o.material&&o.userData&&o.userData.bb)o.material.color.setHex(b.taken?0x555555:0xff7a30)})}
function raidMakeCache(c){
 const g=new THREE.Group();const col=RAID_TIERCOL[c.tier|0]||0x8794a3;
 const body=new THREE.Mesh(new THREE.BoxGeometry(1.35,.75,1.15),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.95}));
 body.position.y=.55;body.userData.bb=1;g.add(body);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1.25,24),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.35,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
 g.position.set(c.x,.0,c.z);scene.add(g);c.mesh=g;c.body=body;c.ring=ring;raidPaintCache(c);
}
function raidMakeExit(e){
 const g=new THREE.Group();const col=RAID_CCOL[e.k]||0x38d6ff;
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.1,.16,7,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));
 body.position.y=3.5;body.userData.bb=1;g.add(body);
 const ring=new THREE.Mesh(new THREE.RingGeometry(1.1,1.55,28),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.5,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
 g.position.set(e.x,0,e.z);scene.add(g);e.mesh=g;e.body=body;e.ring=ring;raidPaintExit(e);
}
function raidMakeBag(b){
 const g=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(1,.55,.8),new THREE.MeshBasicMaterial({color:0xff7a30,transparent:true,opacity:.9}));
 body.position.y=.35;body.userData.bb=1;g.add(body);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.75,1.05,20),new THREE.MeshBasicMaterial({color:0xff7a30,transparent:true,opacity:.5,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
 g.position.set(b.x,0,b.z);scene.add(g);b.mesh=g;raidPaintBag(b);return g;
}
function raidClientInit(info){
 raidClientClear();
 info=info||{time:RAID.time,containers:[],exits:[]};
 const stash=raidStash(),pend=raidPending();const g=(pend&&pend.gear)||stash.gear||{};
 const rec=!!(g.recovery||stash.recovery);
 const gear=rec?{weapon:'ar',armor:0,meds:1,insure:0,contract:'cores',risk:0,recovery:1}:g;
 let w=gear.weapon;if(!W[w]||W[w].slot!==0)w=stash.gear.weapon||'ar';if(!W[w]||W[w].slot!==0)w='ar';
 const deploy=(pend&&pend.deployId)||('D'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
 RC={info,containers:[],exits:[],bags:[],items:{},pack:[],secure:[],gearIds:[],gearWeapon:w,gearArmor:rec?false:!!gear.armor,gearInsure:rec?false:!!gear.insure,armored:rec?false:!!gear.armor,maxhp:rec?100:100+(gear.armor?30:0),contract:rec?'cores':(gear.contract||stash.gear.contract||'cores'),risk:rec?false:!!gear.risk,meds:rec?1:raidClamp2(parseInt(gear.meds)||0,0,3),deployId:deploy,recovery:rec,cap:rec?RAID.recCap:RAID.cap,secureCap:rec?RAID.recSecure:RAID.secure,
  sq:0,seq:0,modal:false,packOn:false,loot:null,left:info.time|0,baseT:0,srvAt:performance.now(),board:null,search:null,settled:0,settle:null,final:false,stat:null,hudHtml:'',promptT:0,mkT:0,lastToken:'',loaded:0,loadTO:null,loadTO2:null,meshes:[]};
 RC.containers=(info.containers||[]).map(c=>({id:c[0],x:+c[1],z:+c[2],tier:c[3]|0,st:c[4],label:c[5]||('CACHE '+c[0]),vault:!!c[6]}));
 RC.exits=(info.exits||[]).map(e=>({...e,e:e.e||e.id,id:e.id})).map(e=>({id:e.id,x:+e.x,z:+e.z,k:e.k,st:e.st||'closed',label:e.label||'',eta:e.eta|0,cl:e.cl|0}));
 RC.containers.forEach(c=>{try{raidMakeCache(c)}catch(e){}});
 RC.exits.forEach(e=>{try{raidMakeExit(e)}catch(e){}});
 for(const c of RC.containers)if(c.mesh)RC.meshes.push(c.mesh);
 for(const e of RC.exits)if(e.mesh)RC.meshes.push(e.mesh);
 me.load=DEFAULT_LOAD.slice();me.load[0]=w;me.load[1]='handgun';me.load[2]='fists';me.load[3]='grenade';
 me.hp=100+(RC.armor?30:0);me.alive=false;me.frozen=true;updHP();buildSlots();
 try{sessionStorage.removeItem('hsz_raidjoin')}catch(e){}
 const sendLoad=()=>{
  if(!RC||RC.loaded||RC.settled||!inGame||C.mode!=='raid')return;
  raidSend({t:'rload',gear:{weapon:RC.gearWeapon,armor:RC.gearArmor?1:0,meds:RC.meds,insure:RC.gearInsure?1:0,contract:RC.contract,risk:RC.risk?1:0,key:0,recovery:RC.recovery?1:0},deployId:RC.deployId});
 };
 RC.loadTO=setTimeout(sendLoad,300);RC.loadTO2=setTimeout(()=>{if(!RC||RC.loaded)return;sendLoad()},1800);
 raidHudUpd();
}
function raidClientClear(){
 if(!RC)return;
 if(RC.loadTO)clearTimeout(RC.loadTO);if(RC.loadTO2)clearTimeout(RC.loadTO2);
 for(const m of RC.meshes||[]){try{scene.remove(m)}catch(e){}}
 for(const b of RC.bags||[])if(b.mesh){try{scene.remove(b.mesh)}catch(e){}}
 RC=null;RAID_LOCK(false);
 for(const id of['raidHud','raidPrompt','raidLoot','raidPack','raidResult']){const el=$(id);if(el)el.classList.add('hidden')}
 const bx=$('bRaidE');if(bx)bx.classList.add('hidden');const bb=$('bRaidBag');if(bb)bb.classList.add('hidden');
}
let raidReConnecting=0,raidReT0=0,raidReN=0,raidReT=null;
function raidConnLost(){
 if(raidReConnecting)return;
 if(C.mode==='raid'&&RC&&!RC.settled&&!RC.final&&!isHost&&!H.offline){raidReconnectStart();return}
 hostGone();
}
function raidReconnectLater(ms){
 if(raidReT)clearTimeout(raidReT);
 raidReT=setTimeout(()=>{raidReT=null;if(raidReConnecting)raidReconnectTry()},ms||1200);
}
function raidReconnectStart(){
 if(raidReConnecting||!RC||RC.settled||RC.final||isHost||H.offline)return;
 raidReConnecting=1;raidReT0=Date.now();raidReN=0;
 try{if(conn&&conn.open)conn.close()}catch(e){}
 raidMsgShow('📡 Connection lost — reconnecting to raid '+roomCode+'…');
 center('RECONNECTING…',1600);
 raidReconnectTry();
}
function raidReconnectTry(){
 if(!RC||RC.settled||RC.final){raidReConnecting=0;return}
 if(Date.now()-raidReT0>RAID.reconnect*2000){raidReConnecting=0;raidMsgShow('📡 Reconnect window expired — the host settles this run as a disconnect. Return to base.');return}
 raidReN++;
 try{if(peer&&!peer.destroyed)peer.destroy()}catch(e){}
 peer=null;
 try{
  peer=new Peer({config:ICE,debug:0});
  peer.on('open',id=>{
   if(!RAIDM(C.mode)||!RC||RC.settled||RC.final)return;
   me.id=id;
   const c2=peer.connect(PREFIX+roomCode,{reliable:true,serialization:'json'});
   const to=setTimeout(()=>{if(!c2||!c2.open)raidReconnectLater(1000)},6000);
   c2.on('open',()=>{clearTimeout(to);conn=c2;
    conn.send({t:'hello',name:myName(),fit:curFit(),skin:PROG.skin,hid:hubSelfId,ws:wsOut(),cl:PROG.pc,party:PARTY?PARTY.id:null,rv:RAID.v,deployId:RC.deployId});
    conn.on('data',clientHandle);conn.on('close',raidConnLost);
    raidReConnecting=0;raidMsgShow('📡 RECONNECTED — raid resumed');center('RECONNECTED',1200);
   });
   c2.on('close',()=>{if(raidReConnecting)raidReconnectLater(400)});
  });
  peer.on('error',e=>{if(raidReConnecting){try{peer.destroy()}catch(x){}peer=null;raidReconnectLater(1200)}});
 }catch(e){raidReconnectLater(1200)}
}
function raidSend(m){
 if(!RC)return;m.rv=RAID.v;m.sq=++RC.seq;try{send(m)}catch(e){}
}
function raidSrvNow(){return RC?RC.baseT+(performance.now()-RC.srvAt)/1000:0}
function raidFmtTime(s){s=Math.max(0,Math.round(s));const m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0')}
function raidExitStatus(e){
 const ic=RAID_ICON[e.k]||'🚁';
 if(e.st==='open')return `<span class="ok">${ic} OPEN${e.cl?' '+e.cl+'s':''}</span>`;
 if(e.st==='called'||e.st==='timed')return `<span class="rt">${ic} ${e.eta||0}s</span>`;
 return `<span class="bad">${ic} CLOSED</span>`;
}
function raidBoardRender(){
 const b=$('board');if(!b||!RC)return;
 const ch=RC.containers.filter(c=>c.st==='open').length;
 const lines=RSQN.map((nm,i)=>{
  const t=['A','B','C'][i];const ps=Object.values(C.players).filter(q=>!q.machine&&q.team===t);
  const live=ps.filter(q=>q.alive&&!q.down).length,dn=ps.filter(q=>q.alive&&q.down).length,gone=ps.filter(q=>!q.alive).length;
  return `<div class="raidHistRow"><b style="color:${hex(RSQCOL[i])}">${nm}</b><span>🧍 ${live} · 🩸 ${dn} · 💀 ${gone}</span><em>${ps.length} ops</em></div>`;
 }).join('');
 const ex=(RC.exits||[]).map(e=>`${RAID_ICON[e.k]||'🚁'} ${esc(e.label||'')} ${e.st==='open'?'<b class="ok">OPEN</b>':e.st==='closed'?'<b class="bad">CLOSED</b>':'<b class="rt">'+(e.eta||0)+'s</b>'}`).join('<br>');
 b.innerHTML=`<div class="cardHead sm">🚁 EXTRACTION RAID · ${esc(MI(C.map).name)} · ⏱ ${raidFmtTime(RC.left)}</div>`+
  `<div class="raidMini">🎒 ${RC.pack.length}/${RC.cap||RAID.cap} · 🔐 ${RC.secure.length}/${RC.secureCap||RAID.secure} · 📦 ${ch} caches open · 💀 ${RC.bags.length} bags</div>`+
  `<div class="raidMini">📜 ${esc(raidContractTarget())}</div>`+lines+
  `<div class="raidMini" style="margin-top:6px">EXITS</div><div class="raidMini">${ex}</div>`;
}
function raidContractTarget(){
 if(!RC)return'';const c=RC.contract;
 if(c==='cores'){const n=RC.pack.concat(RC.secure).filter(id=>RC.items[id]&&RC.items[id].k==='core').length;return 'CORES '+Math.min(1,n)+'/1'}
 if(c==='boss')return RC.stat&&RC.stat.boss?'OVERLORD DOWN':'KILL THE OVERLORD';
 return RC.settled?'EXTRACTED':'EXTRACT TO COLLECT';
}
function raidHudUpd(){
 if(!RC||!inGame||C.mode!=='raid')return;
 raidTouchButtons();
 const t=$('raidHud');if(!t)return;
 const stat=RC.stat||{};const mach=stat.machines!=null?stat.machines:0;
 const pack=RC.pack.length,secure=RC.secure.length;
 const ex=(RC.exits||[]).map(raidExitStatus).join(' ');
 const alarm=RC.alarm||stat.alarm||0;
 const html=`<div class="rt">⏱ <b>${raidFmtTime(RC.left)}</b> · 🧍 ${stat.humans!=null?stat.humans:1} ops · 🤖 ${mach}</div>`+
  (alarm>0?`<div class="warn">⚠️ EXTRACTION ALARM · ${alarm}s — machines inbound</div>`:'')+
  `<div class="rt">🎒 ${pack}/${RC.cap||RAID.cap} · 🔐 ${secure}/${RC.secureCap||RAID.secure} · 📜 ${esc(raidContractTarget())}</div>`+
  `<div class="rt exits">${ex}</div>`;
 if(html!==RC.hudHtml){RC.hudHtml=html;t.innerHTML=html}
 t.classList.toggle('hidden',!!RC.final||!!RC.modal);
}
function raidNearest(){
 if(!RC||!me.alive||RC.settled)return null;
 let best=null,bd=7.2;
 for(const c of RC.containers){const d=Math.hypot(me.pos.x-c.x,me.pos.z-c.z);if(d<bd){bd=d;best={type:'cache',c,d}}}
 for(const b of RC.bags||[]){const d=Math.hypot(me.pos.x-b.x,me.pos.z-b.z);if(d<=Math.min(5,bd)){bd=d;best={type:'bag',b,d}}}
 for(const e of RC.exits||[]){const d=Math.hypot(me.pos.x-e.x,me.pos.z-e.z);if(d<bd){bd=d;best={type:'exit',e,d}}}
 return best;
}
function raidHasKey(){
 if(!RC)return false;
 for(const id of RC.pack.concat(RC.secure))if(RC.items[id]&&RC.items[id].k==='key')return true;
 return false;
}
function raidTouchButtons(){
 const be=$('bRaidE'),bb=$('bRaidBag');
 const show=!!(isTouch&&RC&&!RC.modal&&!RC.final&&!RC.settled&&me.alive&&inGame&&C.mode==='raid');
 if(be)be.classList.toggle('hidden',!show);
 if(bb)bb.classList.toggle('hidden',!show);
}
function raidPromptUpd(){
 const p=$('raidPrompt');if(!p)return;
 raidTouchButtons();
 if(!RC||!inGame||C.mode!=='raid'||RC.modal||RC.final||!me.alive||RC.settled){p.classList.add('hidden');return}
 let html='';
 if(RC.board){const k=RC.board.p||0;html=`🚁 EXTRACTING… ${Math.round(k*100)}%<div class="bar"><i style="width:${Math.round(k*100)}%"></i></div>`}
 else if(RC.search){
  const c=RC.containers.find(x=>x.id===RC.search.c);
  if(c&&c.st==='searching'){const el=Math.max(0,(performance.now()-RC.search.t0)/1000),k=Math.min(1,el/Math.max(.1,RC.search.eta));html=`🔍 SEARCHING ${esc(c.label)}…<div class="bar"><i style="width:${Math.round(k*100)}%"></i></div>`}
 }
 if(!html){
  const n=raidNearest();
  if(n&&n.type==='cache')html=n.c.st==='open'?`🎒 LOOT CACHE ${esc(n.c.label)} — <b>E</b>`:n.c.st==='searching'?`🔍 CACHE BEING SEARCHED — hold position`: `🔍 SEARCH CACHE ${esc(n.c.label)} — <b>E</b>`;
  else if(n&&n.type==='bag')html=`🎒 LOOT DEATH BAG — <b>E</b>`;
  else if(n&&n.type==='exit'){
   const e=n.e;
   if(e.k==='call'&&e.st==='closed')html=`📞 CALL EXTRACTION — <b>E</b>`;
   else if(e.k==='key'&&e.st!=='open')html=raidHasKey()?`🔑 INSERT KEYCARD — <b>E</b>`:`🔒 NEED KEYCARD — find one in a cache`;
   else if(e.st==='timed'||e.st==='called')html=`⏱ EXTRACTION IN ${e.eta||0}s — hold the LZ`;
   else if(e.st==='open')html=`🚁 HOLD <b>E</b> TO EXTRACT${e.cl?' · closes '+e.cl+'s':''}`;
  }
 }
 if(!html){p.classList.add('hidden');return}
 p.innerHTML=html;p.classList.remove('hidden');
}
function raidFrame(dt,now){
 if(!RC||!inGame)return;
 for(const b of RC.bags||[])if(b.mesh)b.mesh.visible=!RC.modal;
 for(const c of RC.containers||[]){if(c.ring&&c.ring.material){const pu=1+Math.sin(now*.003+(c.tier||0))*.05;c.ring.scale.setScalar(pu)}}
 for(const e of RC.exits||[]){if(e.ring&&e.ring.material){const pu=1+Math.sin(now*.004+(e.k.length||0))*.06;e.ring.scale.setScalar(pu)}}
 if(now>RC.promptT+120){RC.promptT=now;raidPromptUpd();raidHudUpd()}
 raidTouchButtons();
}
function raidFocusFirst(which){
 const box=$(which);if(!box){return 0}
 const b=box.querySelector('[data-take],[data-sec],[data-use]')||box.querySelector('.raidBoxFoot .pill');
 if(b){try{b.focus({preventScroll:true})}catch(e){try{b.focus()}catch(_){}}return 1}
 return 0;
}
function raidLootOpen(src){
 if(!RC||!src)return;RC.loot=src;RC.packOn=false;const pk=$('raidPack');if(pk)pk.classList.add('hidden');
 if(!RC.modal)RC.focusBack=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
 RC.modal=true;RAID_LOCK(false);raidRenderLoot();
 $('raidLoot').classList.remove('hidden');
 raidFocusFirst('raidLoot');
}
function raidRenderLoot(){
 const box=$('raidLoot'),head=$('raidLootHead'),list=$('raidLootList'),foot=$('raidLootW');if(!box||!RC||!RC.loot)return;
 head.innerHTML=(RC.loot.type==='cache'?'📦 CACHE ':'💀 DEATH BAG ')+esc(RC.loot.label||'');
 const items=(RC.loot.items||[]).filter(Boolean);
 list.innerHTML=items.length?items.map(it=>raidItemRow(it,`<button class="pill sm" data-take="${esc(it.id)}" aria-label="Take ${esc(raidItemName(it))}">TAKE</button>`)).join(''):'<p class="raidMini">Empty — nothing left to take.</p>';
 foot.textContent=`🎒 ${RC.pack.length}/${RC.cap||RAID.cap}`+(RC.loot.type==='bag'?' · lootable once':'');
 raidFocusFirst('raidLoot');
}
function raidCloseModal(noLock){
 if(!RC)return;RC.loot=null;RC.packOn=false;
 for(const id of['raidLoot','raidPack','raidResult']){const el=$(id);if(el)el.classList.add('hidden')}
 if(RC.modal&&!RC.final&&!noLock)RAID_LOCK(true);else{raidHudUpd();raidPromptUpd()}
 const back=RC.focusBack;RC.focusBack=null;
 if(!RC.final){const t=back&&back.isConnected&&back!==document.body?back:canvas;try{t.focus({preventScroll:true})}catch(e){try{t.focus()}catch(_){}}}
}
function raidLootClose(noLock){raidCloseModal(noLock)}
function raidPackToggle(){
 if(!RC||!inGame||C.mode!=='raid'||RC.final)return;
 if(RC.loot)raidLootClose(true);
 if(RC.packOn){raidCloseModal();return}
 if(!RC.modal)RC.focusBack=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
 RC.packOn=true;RC.modal=true;RAID_LOCK(false);
 for(const id of['raidLoot']){const el=$(id);if(el)el.classList.add('hidden')}
 raidRenderPack();$('raidPack').classList.remove('hidden');
}
function raidPackClose(){
 if(!RC)return;RC.packOn=false;const el=$('raidPack');if(el)el.classList.add('hidden')}
function raidRenderPack(){
 if(!RC)return;const B=RC;const el=$('raidPackList');if(!el)return;
 let h=`<div class="raidMini">🛡 PRIMARY: ${esc(W[B.gearWeapon]?W[B.gearWeapon].name:B.gearWeapon||'Weapon')} ${B.gearInsure?'· INSURED':''}</div>`;
 h+=`<div class="raidMini">🎒 BACKPACK ${B.pack.length}/${B.cap||RAID.cap} · 🔐 SECURE ${B.secure.length}/${B.secureCap||RAID.secure}</div>`;
 const guts=B.pack.map(id=>B.items[id]).filter(Boolean);
 h+=`<div class="raidMini" style="margin-top:6px">CARRIED</div>`;
 h+=guts.length?guts.map(it=>raidItemRow(it,
   (it.k==='med'?`<button class="pill sm" data-use="${esc(it.id)}" aria-label="Use ${esc(raidItemName(it))}">USE</button>`:'')+
   `<button class="pill sm" data-sec="${esc(it.id)}" aria-label="Secure ${esc(raidItemName(it))}">SECURE</button>`)).join(''):`<p class="raidMini">Backpack empty.</p>`;
 const sec=B.secure.map(id=>B.items[id]).filter(Boolean);
 h+=`<div class="raidMini" style="margin-top:6px">SECURE POCKET — survives death</div>`;
 h+=sec.length?sec.map(it=>raidItemRow(it,'')).join(''):`<p class="raidMini">Secure pocket empty.</p>`;
 el.innerHTML=h;
 const w=$('raidPackW');if(w)w.textContent=`${B.pack.length}/${B.cap||RAID.cap}`;
 const s=$('raidPackSec');if(s)s.textContent=`🔐 ${B.secure.length}/${B.secureCap||RAID.secure}`;
 raidFocusFirst('raidPack');
}
function RAID_LOCK(on){
 if(!RC)return;
 if(on){
  RC.modal=false;RC.packOn=false;RC.loot=null;
  for(const id of['raidLoot','raidPack']){const el=$(id);if(el)el.classList.add('hidden')}
  RC.promptT=0;
  if(!isTouch&&me.alive&&inGame&&!RC.final&&document.pointerLockElement!==canvas){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
 }else{
  RC.modal=true;
  try{if(document.pointerLockElement===canvas)document.exitPointerLock()}catch(e){}
 }
 raidHudUpd();raidPromptUpd();
}
function raidAction(){
 if(!RC||!inGame||C.phase!=='play'||RC.modal||RC.final||!me.alive||RC.settled)return;
 if(RC.board)return;
 const n=raidNearest();if(!n){center('Nothing within reach',900);return}
 if(n.type==='cache'){
  const c=n.c;
  if(c.st==='searching'){center('Cache already being searched',900);return}
  if(c.st==='open'){raidSend({t:'rlook',c:c.id});return}
  raidSend({t:'rsearch',c:c.id});
 }else if(n.type==='bag'){raidSend({t:'rlook',b:n.b.id});return}
 else if(n.type==='exit'){
  const e=n.e;
  if(e.k==='call'&&e.st==='closed')raidSend({t:'rcall',e:e.id});
  else if(e.k==='key'&&e.st!=='open'){if(raidHasKey())raidSend({t:'rkey',e:e.id});else center('🔒 You need a keycard — find one in a cache',1400)}
  else if(e.st==='open')raidSend({t:'rext',e:e.id});
  else if(e.st==='timed'||e.st==='called')center(`⏱ Extraction arrives in ${e.eta||0}s — hold the exit`,1600);
 }
}
function raidItemDefAdd(it){
 if(!it||!it.id)return;RC.items[it.id]={id:it.id,k:it.k,r:it.r|0,q:it.q||1,w:it.w,a:it.a,t:it.t,m:it.m,v:it.v,g:it.g||0,sec:it.sec||0};
}
function raidApplySettle(m){
 if(!RC||!m)return;
 if(RC.lastToken===m.token){return}
 RC.lastToken=m.token;RC.settle=m;RC.settled=1;RC.pack=[];RC.secure=[];RC.board=null;RC.search=null;RC.modal=false;
 me.alive=false;me.down=false;me.frozen=true;me.hp=0;updHP();updDown();
 for(const it of m.items||[])raidItemDefAdd(it);
 const applied=raidAppliedTokens();
 const dup=applied.indexOf(m.token)>=0;
 if(!dup){
  const stash=raidStash();
  const overflow=[];
  for(const it of m.items||[]){
   if(it.k==='mat'){stash.mats[it.m]=(stash.mats[it.m]||0)+(it.q||1)}
   else if(!raidAddStashItem(stash,it))overflow.push(it);
  }
  let overDia=0;
  for(const it of overflow){const v=raidSellValue(it);if(v>0){overDia+=v;addDia(v,'trader stash overflow')}}
  if(overflow.length){stash.trader.rep=raidClamp2((stash.trader.rep|0)+1,0,20);m.stashOverflow=overflow.length;m.stashOverflowDia=overDia}
  if((m.dia|0)>0)addDia(m.dia,'raid '+m.outcome);
  if(!RC.recovery){
   const ww=m.outcome==='extract'?5:m.outcome==='death'?25:15,aw=m.outcome==='extract'?3:m.outcome==='death'?20:10;
   stash.gear.wcond=raidClamp2((stash.gear.wcond|0)-ww,0,100);
   if(stash.gear.armor)stash.gear.acond=raidClamp2((stash.gear.acond|0)-aw,0,100);
   stash.trader.rep=raidClamp2((stash.trader.rep|0)+(m.outcome==='extract'?2:1),0,20);
  }
  stash.gear.armor=!!stash.gear.armor;raidSaveStash(stash);
  raidAppliedAdd(m.token);
  const rec={at:Date.now(),map:m.map||MI(C.map).name,outcome:m.outcome,dia:m.dia|0,bonus:m.bonus|0,items:(m.items||[]).length,contract:m.contract||'',token:m.token,insured:!!m.insured};
  stash.hist.unshift(rec);if(stash.hist.length>RAID_MAX_HIST)stash.hist.length=RAID_MAX_HIST;raidSaveStash(stash);
 }else{
  const stash=raidStash();if(!stash.hist.some(h=>h.token===m.token)){stash.hist.unshift({at:Date.now(),map:m.map||MI(C.map).name,outcome:m.outcome,dia:m.dia|0,bonus:m.bonus||0,items:(m.items||[]).length,contract:m.contract||'',token:m.token,insured:!!m.insured});if(stash.hist.length>RAID_MAX_HIST)stash.hist.length=RAID_MAX_HIST;raidSaveStash(stash)}
 }
 RC.hudHtml='';raidHudUpd();
 raidSettleModal(m);
}
function raidSettleModal(m){
 if(!RC)return;
 RC.modal=true;RC.final=false;
 const head=$('raidResHead'),body=$('raidResBody'),box=$('raidResult');if(!head||!body||!box)return;
 const ok=m.outcome==='extract';
 head.innerHTML=(ok?'✅ EXTRACTED':'💀 '+String(m.outcome||'LOST').toUpperCase())+' · '+esc(m.map||'');
 let h=`<div class="raidMini">📜 Contract: <b>${esc((m.contract||'cores').toUpperCase())}</b> ${m.bonus?'· bonus 💎'+m.bonus:''} ${m.insured?'· weapon insured':''}</div>`;
 h+=`<div class="raidMini">💎 Settlement: <b>+${m.dia|0}</b> diamonds${ok?' · gear and backpack banked':' · insured gear and secure pocket returned'}</div>`;
 h+=`<div class="raidMini">RECORDED BACK TO STASH</div>`;
 if(m.stashOverflow)h+=`<div class="raidMini warn">Stash full — ${m.stashOverflow} overflow items sold to trader for 💎${m.stashOverflowDia|0}</div>`;
 h+=m.items&&m.items.length?m.items.map(it=>raidItemRow(it,'')).join(''):'<p class="raidMini">No items recovered.</p>';
 body.innerHTML=h;
 $('raidResX').textContent=me.alive?'CONTINUE':'SPECTATE';
 box.classList.remove('hidden');
 try{if(document.pointerLockElement===canvas)document.exitPointerLock()}catch(e){}
 const b=$('raidResX');if(b){try{b.focus({preventScroll:true})}catch(e){try{b.focus()}catch(_){}}}
}
function raidResClose(){
 const el=$('raidResult');if(el)el.classList.add('hidden');if(RC&&!RC.final)RAID_LOCK(true);
 try{canvas.focus({preventScroll:true})}catch(e){try{canvas.focus()}catch(_){}}
}
function raidFinalResult(m){
 if(!RC)return;
 RC.final=true;RC.modal=true;RC.board=null;RC.search=null;RC.settled=1;
 if(C.mode==='raid')C.phase='roundEnd';me.frozen=true;
 const rs=$('raidResult');if(rs)rs.classList.add('hidden');
 const head=$('raidFinalT'),body=$('raidFinalBody'),box=$('raidFinal');if(!head||!body||!box)return;
 const ok=m.reason!=='timeout';
 head.textContent=ok?'🏴 RAID COMPLETE':'⛈️ RAID TIMEOUT';
 const s=RC.settle;
 let h='';
 if(s)h+=`<p class="raidMini"><b>${esc((s.outcome||'LOST').toUpperCase())}</b> · ${esc(s.map||MI(C.map).name)} · 💎+${s.dia|0} · ${(s.items||[]).length} items banked</p>`;
 else h+=`<p class="raidMini">No settlement for this operator — eliminated or still serving.</p>`;
 h+=`<div class="raidFinalGrid"><div><b>🛡 SQUAD</b><br>${RSQN.map((n,i)=>`<span style="color:${hex(RSQCOL[i])}">${n}</span>`).join(' · ')}</div><div><b>🤖 MACHINES</b><br>${RC.stat&&RC.stat.machines!=null?RC.stat.machines:'?'} remaining</div><div><b>🚁 EXITS</b><br>${(RC.exits||[]).map(e=>RAID_ICON[e.k]||'🚁').join(' ')}</div></div>`;
 h+=`<p class="raidMini">${ok?'Squad extraction recorded.':esc(m.sub||'The storm timer closed every extraction window.')}</p>`;
 body.innerHTML=h;box.classList.remove('hidden');
 $('raidHud').classList.add('hidden');$('raidPrompt').classList.add('hidden');
 try{if(document.pointerLockElement===canvas)document.exitPointerLock()}catch(e){}
 const b=$('raidFinalBase');if(b){try{b.focus({preventScroll:true})}catch(e){try{b.focus()}catch(_){}}}
}
let raidLootBtnT=null,raidPackBtnT=null,raidStashT=null,raidTraderT=null;
function raidReturnBase(){
 try{sessionStorage.setItem('hsz_raidOpen','1')}catch(e){}
 location.href=location.pathname+'?raid=1'+(PROF?'&prof='+PROF:'');
}
function raidOpenBase(){
 if(inGame)return;
 if(document.querySelector('meta[name="headshotz-raid-service"]')){location.replace('raid-online.html');return}
 audioInit();RAIDUI=true;
 for(const id of['menu','lobby','arsenal','settings']){const el=$(id);if(el)el.classList.add('hidden')}
 $('raid').classList.remove('hidden');
 $('raidRisk')&&($('raidRisk').checked=false);
 raidMsgShow('');
 raidRenderBase();
 try{history.replaceState(null,'',location.pathname+'?raid=1'+(PROF?'&prof='+PROF:''))}catch(e){}
}
function raidCloseBase(){
 RAIDUI=false;
 const el=$('raid');if(el)el.classList.add('hidden');
 if(RAO&&!RAO.started){
  for(const id in conns){try{conns[id].close()}catch(e){}delete conns[id]}
  try{if(peer)peer.destroy()}catch(e){}peer=null;isHost=false;RAO=null;roomCode='';
 }
 if(!inGame){const m=$('menu');if(m)m.classList.remove('hidden');const m2=$('menu');if(m2&&$('lobby').classList.contains('hidden')){} }
 try{history.replaceState(null,'',location.pathname+(PROF?'?prof='+PROF:''))}catch(e){}
}
function raidBaseVisible(){const el=$('raid');return !!el&&!el.classList.contains('hidden')}
function raidBaseSyncLobby(m){
 if(!raidBaseVisible())return;
 if(m.hostId===me.id)raidMsgShow('ROOM '+roomCode+' · '+m.players.filter(p=>!p.bot).length+' sec ops connected. Share the code, then press START RAID.');
 else raidMsgShow('ROOM '+roomCode+' CONNECTED · waiting for host deployment');
}
function raidCostTotal(online){
 const rec=$('raidRecovery')&&$('raidRecovery').checked;
 const ins=!rec&&$('raidInsure')&&$('raidInsure').checked;
 return rec?0:(online?RAID.cost:0)+(ins?RAID.insureCost:0);
}
function raidCostText(){
 const el=$('raidCost');if(!el)return;
 const rec=$('raidRecovery')&&$('raidRecovery').checked;
 const ins=!rec&&$('raidInsure')&&$('raidInsure').checked;
 if(rec){el.innerHTML=`🎟️ FREE RECOVERY KIT · 💎0 entry · starter pistol · 1 medkit · no armor · ${RAID.recCap}-slot backpack`;return}
 el.innerHTML=`ENTRY ONLINE 💎${RAID.cost} · OFFLINE FREE · INSURANCE 💎${ins?RAID.insureCost:0}`+(ins?' · total online 💎'+(RAID.cost+RAID.insureCost):'');
}
function raidBrokeFallback(cost){
 if(cost>0&&PROG.dia<cost){
  const r=$('raidRecovery');if(r&&!r.checked){
   r.checked=true;const st=raidStash();st.recovery=true;raidSaveStash(st);raidRenderBase();
   raidMsgShow('💎 balance too low for paid entry — FREE RECOVERY KIT applied: free starter rifle, 1 medkit, no armor, '+RAID.recCap+'-slot backpack.');
   SFX.beep&&SFX.beep(420);
  }
  return true;
 }
 return false;
}
function raidFillSelects(){
 const ws=$('raidWeapon');if(ws&&!ws.dataset.ready){
  ws.innerHTML=WIDS.filter(id=>W[id]&&W[id].slot===0&&owns(id)).map(id=>`<option value="${id}">${esc(W[id].name)}${W[id].price?' · 💎'+W[id].price:''}</option>`).join('');ws.dataset.ready='1';
 }
 const ms=$('raidMap');if(ms&&!ms.dataset.ready){ms.innerHTML=MAPS.map((x,i)=>`<option value="${i}">${esc((MI(i)||{}).name||('Map '+(i+1)))}</option>`).join('');ms.dataset.ready='1'}
 const cs=$('raidContract');if(cs&&!cs.dataset.ready){cs.innerHTML='<option value="cores">REACTOR CORES · 💎60 per core</option><option value="boss">OVERLORD · 💎120 bounty</option><option value="extract">EXTRACT · 💎30 completion</option>';cs.dataset.ready='1'}
}
function raidUiGear(){
 const st=raidStash();
 const rec=!!($('raidRecovery')&&$('raidRecovery').checked);
 st.map=(parseInt($('raidMap')&&$('raidMap').value)||0);
 if(rec){st.recovery=true;raidSaveStash(st);return{weapon:'ar',armor:0,meds:1,insure:0,contract:'cores',map:st.map|0,risk:0,recovery:1}}
 const w=($('raidWeapon')&&$('raidWeapon').value)||st.gear.weapon;
 const armor=!!($('raidArmor')&&$('raidArmor').checked);
 const meds=raidClamp2(parseInt($('raidMeds')?$('raidMeds').value:0)||0,0,3);
 const insure=!!($('raidInsure')&&$('raidInsure').checked);
 const contract=($('raidContract')&&$('raidContract').value)||st.gear.contract;
 st.recovery=false;st.gear={...st.gear,weapon:w,armor,meds,insure,contract};
 raidSaveStash(st);
 return{weapon:w,armor:armor?1:0,meds,insure:insure?1:0,contract,map:st.map|0,risk:!!($('raidRisk')&&$('raidRisk').checked),recovery:0};
}
function raidRenderBase(){
 if(!raidBaseVisible())return;
 const el=$('raidDia');if(el)el.textContent=PROG.dia;
 const st=raidStash();raidFillSelects();
 const rec=!!st.recovery;
 const ws=$('raidWeapon');if(ws){ws.value=rec?'ar':st.gear.weapon;if(!ws.value)ws.value=ws.options[0]&&ws.options[0].value||'ar';ws.disabled=rec}
 const ms=$('raidMap');if(ms)ms.value=String(st.map|0);
 const cs=$('raidContract');if(cs){cs.value=rec?'cores':st.contract;cs.disabled=rec}
 if($('raidArmor')){$('raidArmor').checked=rec?false:!!st.gear.armor;$('raidArmor').disabled=rec}
 if($('raidMeds')){$('raidMeds').value=String(rec?1:st.gear.meds|0);$('raidMeds').disabled=rec}
 if($('raidInsure')){$('raidInsure').checked=rec?false:!!st.gear.insure;$('raidInsure').disabled=rec}
 if($('raidRecovery'))$('raidRecovery').checked=rec;
 raidCostText();
 const hint=$('raidLoadHint');if(hint){
  if(rec){hint.textContent=`FREE RECOVERY KIT · Free starter rifle · 1 medkit · no armor · ${RAID.recCap}-slot backpack · 💎0 entry · earn diamonds with cores or extracting`;}
  else{const wn=W[st.gear.weapon]?W[st.gear.weapon].name:st.gear.weapon;
  hint.textContent=`PRIMARY ${wn} · ${st.gear.armor?'+30 HP armor':'no armor'} · ${st.gear.meds} medkits · ${st.insure?'insured':'uninsured'} · ${(st.gear.contract||'cores').toUpperCase()} contract`;}
 }
 const mats=st.mats;const matTxt=RMN.wire+':'+(mats.wire||0)+' · '+RMN.steel+':'+(mats.steel||0)+' · '+RMN.chem+':'+(mats.chem||0)+' · '+RMN.fuel+':'+(mats.fuel||0);
 {const se=$('raidStash');if(se){let h=`<div class="raidStashRow"><b>PRIMARY</b><span>${esc(W[st.gear.weapon]?W[st.gear.weapon].name:st.gear.weapon)}</span><em>${st.gear.insure?'INSURED':'UNINSURED'} · COND ${st.gear.wcond}%</em></div>`;
  h+=`<div class="raidStashRow"><b>ARMOR</b><span>${st.gear.armor?'Body armor · +30 HP':'No armor'}</span><em>${st.gear.armor?'COND '+st.gear.acond+'%':'AUTO'}</em></div>`;
  h+=`<div class="raidStashRow"><b>MATERIALS</b><span>${esc(matTxt)}</span><em>${st.items.length}/${raidStashCap(st)} banked</em></div>`;
  h+=`<div class="raidBtnRow raidToolRow"><button class="pill sm" data-repair="w" ${st.gear.wcond>=100?'disabled':''}>🛠️ REPAIR WEAPON · 💎${raidRepairQuote(st,'w').dia} +1 STEEL</button>`;
  if(st.gear.armor)h+=`<button class="pill sm" data-repair="a" ${st.gear.acond>=100?'disabled':''}>🛠️ REPAIR ARMOR · 💎${raidRepairQuote(st,'a').dia} +1 WIRE</button>`;
  h+=`</div>`;
  h+=`<div class="raidStashRow"><b>STASH LVL ${st.base.stash}/3</b><span>${raidStashCap(st)} slots</span><button class="pill sm" data-upg="stash" ${st.base.stash>=3?'disabled':''}>🏗️ EXPAND · 💎${raidUpgradeCost('stash',st.base.stash)}</button></div>`;
  h+=`<div class="raidStashRow"><b>REPAIR BAY LVL ${st.base.bay}/2</b><span>${15*(st.base.bay|0)}% discount</span><button class="pill sm" data-upg="bay" ${st.base.bay>=2?'disabled':''}>🏗️ UPGRADE · 💎${raidUpgradeCost('bay',st.base.bay)}</button></div>`;
  const list=st.items.slice(0,12);
  h+=list.length?list.map(it=>`<div class="raidIt rar${raidClamp2((it.r|0),0,4)}"><span class="ri">${raidItemIcon(it)}</span><span class="rn"><b>${esc(raidItemName(it))}</b><small>${esc((it.sec?'SECURE · ':'')+raidItemSub(it))}</small></span><span class="rr">${raidItemValue(it)}</span>${it.g?'':`<button class="pill sm" data-sell="${esc(it.id)}">SELL</button>`}</div>`).join(''):'<p class="raidMini">Stash empty — go find loot.</p>';
  se.innerHTML=h}}
 {const tr=$('raidTrader');if(tr){
  let val=0,n=0;for(const it of st.items){if(it.g)continue;n++;val+=raidSellValue(it)}
  const disc=Math.round(raidTraderDiscount(st)*100);
  const stock=(st.trader.stock||[]).filter(x=>(x.qty|0)>0);
  const shop=stock.length?stock.map(x=>{const price=raidTraderPrice(st,x);const nm=x.k==='mat'?(RMN[x.m]||'SALVAGE')+' bundle':x.name;return `<div class="raidTraderRow"><span>${esc(nm)} · ×${x.qty|0}</span><em>💎${price}</em><button class="pill sm" data-buy="${esc(x.id)}">BUY</button></div>`}).join(''):'<p class="raidMini">Stock sold out — sell loot or check back after repairs.</p>';
  tr.innerHTML=`<div class="raidMini">🛒 TRADER · REPUTATION ${st.trader.rep|0}/20 · ${disc}% discount · ${n} sellable items (💎${val})</div>`+shop+`<div class="raidBtnRow"><button class="pill sm" data-sellall="1">SELL ALL</button></div>`;
 }}
 {const hl=$('raidHistList');if(hl){hl.innerHTML=st.hist.length?st.hist.map(h=>`<div class="raidHistRow"><b>${esc(h.map||'Raid')}</b><span class="${h.outcome==='extract'?'ok':'bad'}">${esc(String(h.outcome||'LOST').toUpperCase())}</span><em>💎${h.dia|0} · ${h.items|0} items</em></div>`).join(''):'<p class="raidMini">No raid reports yet.</p>'}}
}
function raidSellValue(it){
 if(!it)return 0;const k=it.k,q=it.q||1;
 if(k==='val')return Math.max(1,it.v||0);
 if(k==='weapon')return Math.max(5,Math.round(((W[it.w]&&W[it.w].price)||120)*.4));
 if(k==='core')return 50;if(k==='key')return 20;if(k==='med')return 8*q;if(k==='mat')return 3*q;if(k==='ammo')return 2*q;if(k==='armor')return 15;return 4;
}
function raidSellItem(id){
 const st=raidStash();const i=st.items.findIndex(x=>x.id===id);if(i<0)return;
 const it=st.items[i];if(it.g){raidMsgShow('Loaded gear cannot be sold.');return}
 const v=raidSellValue(it);st.items.splice(i,1);st.trader.rep=raidClamp2((st.trader.rep|0)+1,0,20);raidSaveStash(st);
 if(v>0)addDia(v,'traded '+raidItemName(it));raidRenderBase();SFX.beep&&SFX.beep(900);
}
function raidSellAll(){
 const st=raidStash();let sum=0,n=0;
 for(const it of st.items){if(it.g)continue;sum+=raidSellValue(it);n++}
 st.items=st.items.filter(x=>x.g);if(n>0)st.trader.rep=raidClamp2((st.trader.rep|0)+Math.max(1,Math.ceil(n/5)),0,20);
 raidSaveStash(st);if(sum>0)addDia(sum,'raid loot trader');
 raidMsgShow('Traded '+n+' items for 💎'+sum+'. · trader reputation '+st.trader.rep+'/20');raidRenderBase();SFX.kill&&SFX.kill();
}
function raidAddStashItem(st,it){
 if(!it||(!it.g&&st.items.length>=raidStashCap(st)))return false;
 if(it.k==='mat'){st.mats[it.m]=(st.mats[it.m]||0)+(it.q||1);return true}
 st.items.push({id:raidLocalId(),k:it.k,r:it.r|0,q:it.q||1,w:it.w,m:it.m,a:it.a,t:it.t,v:it.v,g:it.g||0,sec:it.sec||0,n:raidItemName(it)});
 if(it.g&&it.k==='weapon'&&W[st.gear.weapon])st.gear.weapon=it.w||st.gear.weapon;
 if(it.g&&it.k==='armor')st.gear.armor=true;
 return true;
}
function raidTraderBuy(id){
 const st=raidStash();const it=st.trader.stock.find(x=>x.id===id&&(x.qty|0)>0);
 if(!it){raidMsgShow('That trader stock item is sold out.');SFX.beep&&SFX.beep(300);return}
 if(st.items.length>=raidStashCap(st)&&it.k!=='mat'){raidMsgShow('Stash full ('+raidStashCap(st)+' slots) — expand storage first.');SFX.beep&&SFX.beep(300);return}
 const price=raidTraderPrice(st,it);if(PROG.dia<price){raidMsgShow('Need 💎'+price+' for '+it.name+'.');SFX.beep&&SFX.beep(300);return}
 PROG.dia-=price;saveProg();
 it.qty=(it.qty|0)-1;
 if(it.k==='mat')st.mats[it.m]=(st.mats[it.m]||0)+(it.q||1);
 else if(it.k==='armor'){raidAddStashItem(st,{k:'armor',q:1,r:2,v:it.price||0,n:'Body Armor Plate'});st.gear.armor=true}
 else raidAddStashItem(st,{k:'med',q:1,r:1,t:0,n:'Field Medkit'});
 st.trader.stock=st.trader.stock.filter(x=>(x.qty|0)>0);
 raidSaveStash(st);
 raidMsgShow('🛒 Bought '+it.name+' for 💎'+price+(raidTraderDiscount(st)?' (rep discount '+Math.round(raidTraderDiscount(st)*100)+'%)':'')+'.');
 raidRenderBase();SFX.beep&&SFX.beep(900);
}
function raidRepairGear(slot){
 const st=raidStash();if(slot==='a'&&!st.gear.armor){raidMsgShow('No armor to repair.');return}
 const q=raidRepairQuote(st,slot);if(q.cond>=100){raidMsgShow('Already at 100% condition.');SFX.beep&&SFX.beep(300);return}
 if((st.mats[q.mat]||0)<1){raidMsgShow('Repair needs 1 '+RMN[q.mat]+' salvage.');SFX.beep&&SFX.beep(300);return}
 if(PROG.dia<q.dia){raidMsgShow('Need 💎'+q.dia+' for the repair.');SFX.beep&&SFX.beep(300);return}
 st.mats[q.mat]=(st.mats[q.mat]||0)-1;PROG.dia-=q.dia;saveProg();
 if(slot==='w')st.gear.wcond=100;else st.gear.acond=100;
 raidSaveStash(st);raidMsgShow('🛠️ '+RMN[q.mat]+' repair complete · condition 100%.');raidRenderBase();SFX.beep&&SFX.beep(1100);
}
function raidUpgradeCost(kind,lvl){return kind==='stash'?120+40*lvl:100+50*lvl}
function raidUpgrade(kind){
 const st=raidStash();
 if(kind==='stash'){
  const lvl=st.base.stash|0;if(lvl>=3){raidMsgShow('Stash expansion is already maxed.');return}
  const cost=raidUpgradeCost(kind,lvl);if(PROG.dia<cost){raidMsgShow('Need 💎'+cost+' for stash expansion.');SFX.beep&&SFX.beep(300);return}
  PROG.dia-=cost;saveProg();st.base.stash=lvl+1;raidSaveStash(st);
  raidMsgShow('🏗️ STASH EXPANSION LVL '+(lvl+1)+' · capacity '+raidStashCap(st)+' slots.');raidRenderBase();SFX.beep&&SFX.beep(1200);
 }else{
  const lvl=st.base.bay|0;if(lvl>=2){raidMsgShow('Repair bay is already maxed.');return}
  const cost=raidUpgradeCost(kind,lvl);if(PROG.dia<cost){raidMsgShow('Need 💎'+cost+' for repair bay upgrade.');SFX.beep&&SFX.beep(300);return}
  PROG.dia-=cost;saveProg();st.base.bay=lvl+1;raidSaveStash(st);
  raidMsgShow('🏗️ REPAIR BAY LVL '+(lvl+1)+' · repair discount '+15*(lvl+1)+'%.');raidRenderBase();SFX.beep&&SFX.beep(1200);
 }
}
function raidBuyMed(){
 const st=raidStash();
 if(st.items.length>=raidStashCap(st)){raidMsgShow('Stash full ('+raidStashCap(st)+' slots) — expand storage first.');SFX.beep&&SFX.beep(300);return}
 if(PROG.dia<30){raidMsgShow('Need 💎30 for a medkit.');SFX.beep&&SFX.beep(300);return}
 PROG.dia-=30;saveProg();
 raidAddStashItem(st,{k:'med',q:1,r:1,t:0,n:'Field Medkit'});
 raidSaveStash(st);raidMsgShow('🧰 Field Medkit banked.');raidRenderBase();SFX.beep&&SFX.beep(1100);
}
function raidCraft(){
 const st=raidStash();
 if(st.items.length>=raidStashCap(st)){raidMsgShow('Stash full ('+raidStashCap(st)+' slots) — expand storage first.');SFX.beep&&SFX.beep(300);return}
 if((st.mats.steel||0)<1||(st.mats.wire||0)<1){raidMsgShow('Crafting needs 1 STEEL + 1 WIRE salvage.');SFX.beep&&SFX.beep(300);return}
 st.mats.steel--;st.mats.wire--;
 raidAddStashItem(st,{k:'med',q:1,r:1,t:0,n:'Field Medkit'});
 raidSaveStash(st);raidMsgShow('🛠️ Crafted a Field Medkit from salvage.');raidRenderBase();SFX.beep&&SFX.beep(1200);
}
function raidDeployOffline(){
 if(inGame)return;
 if(!($('raidRisk')&&$('raidRisk').checked)){raidMsgShow('Accept the risk brief before deploying.');SFX.beep&&SFX.beep(300);return}
 raidBrokeFallback(raidCostTotal(false));
 const gear=raidUiGear();
 const cost=raidCostTotal(false);
 if(cost>0&&!raidDebitNow(cost))return;
 const deploy='D'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);raidSavePending(gear,deploy,gear.map);
 audioInit();const name=myName();
 roomCode='OFFLINE';isHost=true;peer=null;conn=null;H.offline=true;H.fill=true;H.diff=H.diff||'normal';H.matchOver=false;H.rem={};
 H.players={};H.order=0;H.botN=0;H.raidMap=gear.map;H.mode='raid';H.phase='lobby';C.hostId=me.id='me-offline';C.mode='raid';C.map=gear.map;
 const np=H.players[me.id]=newP(me.id,name);np.skin=PROG.skin;np.fit=curFit();np.ws=cleanWS(wsOut());np.cl=clOf(PROG.pc);np.hid=hubSelfId;
 RAIDUI=false;
 startMatch();
}
function raidHostCreate(){
 if(inGame)return;
 if(!($('raidRisk')&&$('raidRisk').checked)){raidMsgShow('Accept the risk brief before deploying.');SFX.beep&&SFX.beep(300);return}
 if(RAO&&RAO.code&&!RAO.started){raidMsgShow('Raid room already open — press START RAID when ready.');return}
 const gear=raidUiGear();
 const code=genCode();RAO={code,started:0,gear};roomCode=code;
 const name=myName();audioInit();
 raidMsgShow('Creating raid room…');
 const btn=$('raidOnline');if(btn)btn.textContent='⏳ CREATING ROOM…';
 peer=new Peer(PREFIX+code,{config:ICE,debug:0});
 peer.on('open',id=>{
  isHost=true;me.id=id;H.offline=false;H.fill=true;H.diff=H.diff||'normal';H.matchOver=false;H.rem={};
  H.players={};H.order=0;H.botN=0;H.mode='raid';H.raidMap=gear.map;H.phase='lobby';
  C.hostId=id;C.mode='raid';C.map=gear.map;
  const np=H.players[id]=newP(id,name);np.skin=PROG.skin;np.fit=curFit();np.ws=cleanWS(wsOut());np.cl=clOf(PROG.pc);np.hid=hubSelfId;np.party=PARTY?String(PARTY.id).slice(0,12):null;
  roomCode=code;RAO.code=code;
  raidMsgShow('ROOM '+code+' READY · share this code with your squad, then press START RAID.');
  if(btn)btn.textContent='🚀 START RAID · '+code;
 });
 peer.on('connection',c=>{c.on('data',d=>hostHandle(c.peer,d));c.on('open',()=>{conns[c.peer]=c});c.on('close',()=>hostLeave(c.peer));c.on('error',()=>hostLeave(c.peer))});
 peer.on('error',e=>{
  if(e.type==='unavailable-id'){try{peer.destroy()}catch(x){}peer=null;isHost=false;RAO=null;roomCode='';raidMsgShow('That room code is busy — try again.');if(btn)btn.textContent='🌐 HOST ONLINE RAID'}
  else raidMsgShow('Network error: '+e.type);
 });
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
}
function raidHostBegin(){
 if(!RAO||!RAO.code||RAO.started||inGame)return;
 if(!($('raidRisk')&&$('raidRisk').checked)){raidMsgShow('Accept the risk brief before deploying.');SFX.beep&&SFX.beep(300);return}
 raidBrokeFallback(raidCostTotal(true));
 const gear=raidUiGear();const cost=raidCostTotal(true);if(cost>0&&!raidDebitNow(cost))return;
 const deploy='D'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 raidSavePending(gear,deploy,gear.map);
 RAO.started=1;RAO.gear=gear;
 H.raidMap=gear.map;H.mode='raid';H.fill=true;
 const btn=$('raidOnline');if(btn)btn.textContent='⏳ DEPLOYING…';
 RAIDUI=false;
 startMatch();
}
function raidJoinOnline(){
 if(inGame)return;
 if(!($('raidRisk')&&$('raidRisk').checked)){raidMsgShow('Accept the risk brief before deploying.');SFX.beep&&SFX.beep(300);return}
 const code=($('raidJoinIn')&&$('raidJoinIn').value||'').toUpperCase().trim();
 if(code.length<4){raidMsgShow('Enter the host’s 4-character raid code.');SFX.beep&&SFX.beep(300);return}
 raidBrokeFallback(raidCostTotal(true));
 const gear=raidUiGear();const cost=raidCostTotal(true);if(cost>0&&!raidDebitNow(cost))return;
 const deploy='D'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);raidSavePending(gear,deploy,gear.map);
 roomCode=code;const name=myName();audioInit();raidMsgShow('Joining raid room '+code+'…');
 try{sessionStorage.setItem('hsz_raidjoin','1')}catch(e){}
 peer=new Peer({config:ICE,debug:0});
 peer.on('open',id=>{me.id=id;conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});const to=setTimeout(()=>{if(!conn||!conn.open)raidMsgShow('Could not reach room '+code+'. Check the code or ask the host.')},12000);
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name,fit:curFit(),skin:PROG.skin,hid:hubSelfId,ws:wsOut(),cl:PROG.pc,party:PARTY?PARTY.id:null,rv:RAID.v,deployId:deploy})});conn.on('data',clientHandle);conn.on('close',raidConnLost)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){raidMsgShow('Raid room '+code+' not found. Ask the host for the code.');try{peer.destroy()}catch(x){}peer=null} else raidMsgShow('Network error: '+e.type)});
}
function raidFinalGoBase(){raidReturnBase()}
function raidFinalGoLobby(){location.href=location.pathname+(PROF?'?prof='+PROF:'')}
function raidBindUI(){
 $('raidBtn')&&($('raidBtn').onclick=()=>{if(document.querySelector('meta[name="headshotz-raid-service"]'))location.href='raid-online.html';else raidOpenBase()});
 $('raidClose')&&($('raidClose').onclick=()=>raidCloseBase());
 $('raidOffline')&&($('raidOffline').onclick=()=>raidDeployOffline());
 $('raidOnline')&&($('raidOnline').onclick=()=>{if(RAO&&RAO.code&&!RAO.started)raidHostBegin();else raidHostCreate()});
 $('raidJoinBtn')&&($('raidJoinBtn').onclick=()=>raidJoinOnline());
 $('raidJoinIn')&&$('raidJoinIn').addEventListener('keydown',e=>{if(e.key==='Enter')raidJoinOnline()});
 $('raidLootX')&&($('raidLootX').onclick=()=>{RC&&raidLootClose()});
 $('raidPackX')&&($('raidPackX').onclick=()=>{RC&&raidCloseModal()});
 $('raidResX')&&($('raidResX').onclick=()=>raidResClose());
 $('raidFinalBase')&&($('raidFinalBase').onclick=()=>raidFinalGoBase());
 $('raidFinalLobby')&&($('raidFinalLobby').onclick=()=>raidFinalGoLobby());
 for(const id of['raidWeapon','raidArmor','raidMeds','raidInsure','raidContract','raidRecovery']){const el=$(id);if(el)el.addEventListener('change',()=>{raidUiGear();raidRenderBase()})}
 $('raidMap')&&$('raidMap').addEventListener('change',()=>{raidUiGear();raidRenderBase()});
 $('raidInsure')&&$('raidInsure').addEventListener('change',raidCostText);
 $('raidBuyMed')&&($('raidBuyMed').onclick=()=>raidBuyMed());
 $('raidCraft')&&($('raidCraft').onclick=()=>raidCraft());
 $('raidLootList')&&$('raidLootList').addEventListener('click',e=>{
  const b=e.target.closest('[data-take]');if(!b||!RC||RC.settled)return;e.preventDefault();e.stopPropagation();
  raidSend({t:'rtake',c:RC.loot&&RC.loot.c,b:RC.loot&&RC.loot.b,i:b.dataset.take});
 });
 $('raidPackList')&&$('raidPackList').addEventListener('click',e=>{
  if(!RC||RC.settled)return;
  const u=e.target.closest('[data-use]');if(u){e.preventDefault();e.stopPropagation();raidSend({t:'ruse',i:u.dataset.use});return}
  const s=e.target.closest('[data-sec]');if(s){e.preventDefault();e.stopPropagation();raidSend({t:'rsecure',i:s.dataset.sec});return}
 });
 $('bRaidE')&&$('bRaidE').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();raidAction()});
 $('bRaidBag')&&$('bRaidBag').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();raidPackToggle()});
 $('raidStash')&&$('raidStash').addEventListener('click',e=>{const b=e.target.closest('[data-sell]');if(b){e.preventDefault();raidSellItem(b.dataset.sell);return}
  const r=e.target.closest('[data-repair]');if(r){e.preventDefault();raidRepairGear(r.dataset.repair);return}
  const u=e.target.closest('[data-upg]');if(u){e.preventDefault();raidUpgrade(u.dataset.upg)}});
 $('raidTrader')&&$('raidTrader').addEventListener('click',e=>{const b=e.target.closest('[data-sellall]');if(b){e.preventDefault();raidSellAll();return}
  const q=e.target.closest('[data-buy]');if(q){e.preventDefault();raidTraderBuy(q.dataset.buy)}});
 raidStashT=raidStash(); // force init
}
raidBindUI();
setTimeout(()=>{try{if(sessionStorage.getItem('hsz_raidOpen')||/[?&]raid=1/.test(location.search)){sessionStorage.removeItem('hsz_raidOpen');if(!inGame)raidOpenBase()}}catch(e){}},450);
window.__hsz.raid={open:raidOpenBase,close:raidCloseBase,state:()=>RC,base:()=>raidStash(),deployOffline:raidDeployOffline,host:raidHostCreate,action:raidAction,pack:()=>RC&&RC.pack,settle:()=>RC&&RC.settle,reconnect:raidReconnectStart,net:()=>({isHost,peer:!!peer,conn:!!(conn&&conn.open),roomCode,re:raidReConnecting})};
if(RAID.test)window.__hsz.raid.testCut=()=>{raidReConnecting=0;try{if(conn&&conn.open)conn.close()}catch(e){};return true};
