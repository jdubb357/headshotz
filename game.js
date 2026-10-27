// HeadShotz – free browser multiplayer FPS. Three.js + PeerJS (host-authoritative star).
import {THREE,FX,TX,MC,G,mergeParts,GQ,texMat,swapMats,WT,GRASS_T,scatterGrass,makeSky,RET,GLASS,camoTex} from './gfx.js';
import {WSKINS,WSKIN_IDS,WSKIN_FEAT,applySkin,tickSkins,clearSkinCache} from './wskins.js';
import {Post} from './post.js';
import {loadAssets,HQP} from './assets.js';import * as ASSETS from './assets.js';
import {TURN} from './ice.js';
import {rebuildForProps,MAPS,buildMap,HUB_PADS,HUB_ST,HUB_I,padCircles,inPad,PAD_COL} from './maps.js';
import {W,CLASSES,LIMB,falloff,stats,gunParts,handParts} from './weapons.js';
import {makeCharacter,animate,LOOKS,HUM} from './chars.js';import {loadHumans} from './humans.js';
// player classes: cosmetic look + small balanced perk. Host enforces HP/regen/revive; movement perks apply on the owner's client.
export const PCL={soldier:{n:'Soldier',p:0,ic:'🪖',perk:'No perk — the classic all-rounder.'},scout:{n:'Scout',p:700,ic:'🎯',perk:'Higher jump · slide recharges 2× faster.',jump:9.6,slideCd:.5},engineer:{n:'Engineer',p:800,ic:'🔧',perk:'+1 grenade / utility each life.',util:1},ninja:{n:'Ninja',p:900,ic:'🥷',perk:'+12% move speed · quiet footsteps · full 100 HP.',spd:1.12,quiet:1},medic:{n:'Medic',p:1100,ic:'⛑️',perk:'Revives teammates in 3 s (not 5) · regen 3 HP/s after 4 s unhurt.',rev:3,regen:3},juggernaut:{n:'Juggernaut',p:1500,ic:'🛡️',perk:'140 HP · 12% slower.',spd:.88,hp:140}};
const PCL_IDS=Object.keys(PCL);const clOf=k=>PCL[k]?k:'soldier';
const $=id=>document.getElementById(id);
const GAME='HeadShotz';
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const MODES={duel:['1v1 Duel','⚔️'],team:['2v2 Teams','👥'],t3:['3v3 Teams','🛡️'],t4:['4v4 Teams','🚩'],t5:['5v5 Teams','🏰'],ffa:['Free-For-All','💥']};
const MODEMAX={duel:2,team:4,t3:6,t4:8,t5:10,ffa:10},MAXP=10;const isTeamMode=m=>m!=='ffa'&&m!=='duel';
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
const S=Object.assign({sens:1,zsens:1,aimAssist:true,quality:'auto',vol:.85,sfx:1},JSON.parse(LS('settings')||'{}'));{const qq=new URLSearchParams(location.search).get('q');if(['low','medium','high'].includes(qq))S.quality=qq}
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
function resize(){document.body.classList.toggle('playing',inGame);const vv=window.visualViewport;const w=Math.round(vv?vv.width:innerWidth)||innerWidth,h=Math.round(vv?vv.height:innerHeight)||innerHeight;
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
 jump(){noise('lowpass',500,.6,.08,.12,out())},slide(){noise('bandpass',1500,.5,.4,.12,out(),0,.05)},
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
function loadMap(i){qGrace=performance.now()+5000;if(cur){scene.remove(cur.group);if(cur.sky)scene.remove(cur.sky)}cur=buildMap(i);cols=cur.cols;groundHalf=cur.groundHalf;ladders=cur.ladders||[];hides=cur.hides||[];ambSetup();setVerb(!!(cur.def&&cur.def.indoor));initFireLights();
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
function supportAt(x,y,z){if(Math.abs(x)<groundHalf[0]&&Math.abs(z)<groundHalf[1]&&y<1.5)return true;for(const c of cols)if(x>c.x0-.2&&x<c.x1+.2&&z>c.z0-.2&&z<c.z1+.2&&c.y1<=y+.6&&c.y1>y-2.5)return true;return false}
function onFloor(p){return Math.abs(p.x)<groundHalf[0]&&Math.abs(p.z)<groundHalf[1]}
function physStep(e,dt){dt=Math.min(dt,.25);const n=Math.ceil(dt/(1/60)-1e-6);if(n>1){let b=0,l=0;for(let i=0;i<n;i++){physStep1(e,dt/n);b=b||e.bump;l=l||e.landed}e.bump=b;e.landed=l;return}physStep1(e,dt)}
function physStep1(e,dt){const p=e.pos,v=e.vel;const py0=p.y;if(!(isFinite(p.x)&&isFinite(p.y)&&isFinite(p.z))){const L=e.lastG||[0,0,0];p.x=L[0];p.y=L[1];p.z=L[2];v.x=v.y=v.z=0}if(!isFinite(v.x+v.y+v.z))v.x=v.y=v.z=0;v.y-=24*dt;if(v.y<-40)v.y=-40;const wasG=e.ground;
 for(const ax of['x','z']){p[ax]+=v[ax]*dt;for(const c of cols){if(!overlaps(p,c,PH))continue;
   if(c.y1-p.y<=.55&&(e.ground||v.y<=0)){let ok=true;const oy=p.y;p.y=c.y1+.001;for(const c2 of cols)if(c2!==c&&overlaps(p,c2,PH)){ok=false;break}if(ok)continue;p.y=oy}
   const mid=ax==='x'?(c.x0+c.x1)/2:(c.z0+c.z1)/2;if(p[ax]<mid)p[ax]=(ax==='x'?c.x0:c.z0)-PR-.001;else p[ax]=(ax==='x'?c.x1:c.z1)+PR+.001;v[ax]=0;e.bump=1}}
 p.y+=v.y*dt;e.ground=false;
 // swept landing: feet crossed a top surface this step (prevents sinking/tunnelling at high fall speed or low FPS)
 if(v.y<=0){let top=-1e9;for(const c of cols){if(p.x+PR>c.x0&&p.x-PR<c.x1&&p.z+PR>c.z0&&p.z-PR<c.z1&&py0>=c.y1-.06&&p.y<c.y1&&c.y1>top)top=c.y1}if(top>-1e9){p.y=top;v.y=0;e.ground=true}}
 for(const c of cols){if(!overlaps(p,c,PH))continue;if(v.y<=0&&p.y>c.y1-.6){p.y=c.y1;e.ground=true}else if(v.y>0&&e.ladTop!=null&&c.y1<=e.ladTop+.7){p.y=c.y1;e.ground=true}else if(v.y>0){const ny=c.y0-PH-.001;if(ny>=py0-.05)p.y=ny;else p.y=Math.max(py0,c.y1)}v.y=Math.min(0,v.y)}
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
function rayWorld(o,d,max=400){let t=max;hitN.set(0,1,0);hitS='concrete';for(const c of cols){const r=rayBox(o,d,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1,_n);if(r<t&&r>0){t=r;hitN.copy(_n);hitS=c.s||'concrete'}}
 if(d.y<0&&o.y>=0){const g=-o.y/d.y;if(g<t){const hx=o.x+d.x*g,hz=o.z+d.z*g;if(Math.abs(hx)<groundHalf[0]&&Math.abs(hz)<groundHalf[1]){t=g;hitN.set(0,1,0);hitS=(cur&&cur.def.ground&&cur.def.ground[0])||'concrete'}}}
 if(cur&&cur.waterY!=null&&d.y<0&&o.y>cur.waterY){const g=(cur.waterY-o.y)/d.y;if(g<t){t=g;hitN.set(0,1,0);hitS='water'}}return t}
const SURF={metal:'metal',hazard:'metal',window:'glass',planks:'wood',crate:'wood',wood:'wood',leaves:'wood',grass:'dirt',sand:'dirt',rock:'concrete',water:'water',carpet:'soft'};
// smoke clouds block sight
const smokes=[],fires=[];
function smokeBlock(o,d,max){for(const s of smokes){if(s.t<1.2)continue;const r=s.r*.8;const lx=s.p.x-o.x,ly=s.p.y-o.y,lz=s.p.z-o.z;const tc=lx*d.x+ly*d.y+lz*d.z;const d2=lx*lx+ly*ly+lz*lz-tc*tc;if(d2>r*r)continue;
  const th=Math.sqrt(r*r-d2);const t0=tc-th;if(t0<max&&tc+th>0)return true}return false}
function losClear(a,b){const d=b.clone().sub(a);const l=d.length();d.divideScalar(l);return rayWorld(a,d,l)>=l-.3&&!smokeBlock(a,d,l)}
// player hitboxes relative to feet
function rayPlayer(o,d,fp,slide){const k=slide?.62:1;let best=Infinity,part=null;
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
function gunGroup(id,o={}){if(o===true)o={hands:true};const{hands=false,sleeve,lod=0,lit=false}=o;const{parts,info}=gunParts(id,lod);const g=new THREE.Group();const Gp={};
 const all=hands?parts.concat(handParts(info,sleeve)):parts;const B={};for(const pt of all){const k=(pt.grp||'')+'|'+pt.mat;(B[k]||(B[k]=[])).push(pt)}
 for(const k in B){const[grp,mat]=k.split('|');let holder=g;
  if(grp){if(!Gp[grp]){const pv=new THREE.Group();pv.position.set(...((info.piv&&info.piv[grp])||[0,0,0]));pv.name='G_'+grp;pv.userData.base=pv.position.clone();g.add(pv);Gp[grp]=pv}holder=Gp[grp]}
  const off=holder===g?null:holder.position;
  if(mat==='ret'||mat==='glass'){for(const pt of B[k]){const geo=bakePart(pt);if(off)geo.translate(-off.x,-off.y,-off.z);const m=new THREE.Mesh(geo,mat==='ret'?RET[pt.ret||'dot']:GLASS);m.renderOrder=mat==='ret'?3:2;m.userData.fx=1;holder.add(m)}continue}
  const geo=mergeParts(B[k],{uv:true});if(off)geo.translate(-off.x,-off.y,-off.z);const tm=TMAP[mat]||'gunPoly';
  const mesh=new THREE.Mesh(geo,lit?texMat(tm):o.icon?ICM[SHINY[mat]?1:0]:(SHINY[mat]?MC.metal:MC.matte));mesh.userData.tm=lit?tm:null;mesh.userData.mk=mat;if(mat==='glove'||mat==='sleeve')mesh.userData.hand=1;holder.add(mesh)}
 if(Gp.mag){const bb=new THREE.Box3();Gp.mag.updateMatrixWorld(true);for(const c of Gp.mag.children)if(c.geometry){c.geometry.computeBoundingBox();bb.union(c.geometry.boundingBox)}Gp.mag.userData.c=bb.isEmpty()?new THREE.Vector3():bb.getCenter(new THREE.Vector3()).add(Gp.mag.position)}
 if(lit&&!lod)addMarkings(g,id,info);g.userData.info=info;g.userData.G=Gp;g.userData.optic=parts.some(p=>p.mat==='ret');return g}
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
const muzzle=new THREE.Group();{const fm=flashMat;const core=new THREE.Mesh(new THREE.PlaneGeometry(.13,.13),fm);core.userData.k='core';
 const pet=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.075,.3),fm);m.geometry.translate(0,.12,0);m.rotation.set(Math.PI/2,i*Math.PI/3,0);m.position.z=-.01;m.userData.k='petal';pet.push(m)}
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
const TPG={};function tpGun(id,sk){const k=id+'|'+(sk||'')+'|'+GQ.level;if(!TPG[k]){const g=gunGroup(id,{lod:1});if(sk)applySkin(g,sk);g.traverse(o=>{if(o.isMesh&&!o.userData.fx){o.castShadow=true}});TPG[k]=g}const c=TPG[k].clone();c.userData.info=TPG[k].userData.info;return c}
function skOf(q,id){const w=q&&q.ws;const k=w&&(w[id]||w['*']);return WSKINS[k]&&k!=='default'?k:''}
function cleanWS(ws){const o={};if(ws&&typeof ws==='object')for(const k in ws)if((W[k]||k==='*')&&WSKINS[ws[k]]&&ws[k]!=='default')o[k]=ws[k];return o}
function setRemoteGun(q,wid){const id=WIDS[wid]||'ar';const sk=skOf(q,id);if(!q.model||(q.gunId===id&&q.gunSk===sk))return;q.gunSk=sk;const mt=q.model.userData.gunMount;if(!mt)return;mt.clear();if(!(W[id]&&W[id].cls==='util')||true){const g=tpGun(id,sk);mt.add(g);q.gunObj=g}q.gunId=id}// viewmodel animation state
function setViewModel(id){if(vmCur)vmRoot.remove(vmCur);vmCur=getVM(id);vmRoot.add(vmCur);vmInfo=vmCur.userData.info||{};vmCur.add(muzzle);muzzle.position.set(...(vmInfo.muzzle||[0,0,-.5]));muzzle.visible=false;
 const Gp=vmCur.userData.G;for(const k in Gp){Gp[k].position.copy(Gp[k].userData.base);Gp[k].rotation.set(0,0,0);Gp[k].visible=true}
 Object.assign(VA,{cyc:0,cycD:0,slide:0,glRot:0,inspect:0,shellN:0,ejected:false,emptyRl:false,boltF:0});}
const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_q=new THREE.Quaternion();
function vmToWorld(local,out){vmRoot.updateMatrixWorld(true);out.set(...local);vmCur.localToWorld(out);return camera.localToWorld(out)}
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
let nades=[];const FUSE={grenade:1.8,smoke:1.4,flash:1.3,molotov:9,gl:4,rpg:4};
function spawnNade(owner,kind,p,v){const m=thrownMesh(kind);m.position.copy(p);scene.add(m);if(kind!=='molotov')spawnSpoon(kind,p,v);nades.push({owner,kind,m,v:v.clone(),t:FUSE[kind]||1.8,spin:new THREE.Vector3(Math.random()*8,Math.random()*8,0)})}
function updNades(dt){for(const n of nades){n.t-=dt;const PJ=W[n.kind]&&W[n.kind].proj;n.v.y-=(PJ==='rpg'?0:PJ==='gl'?9:20)*dt;const p=n.m.position;let bounced=false;
  if(PJ){if(n.v.lengthSq()>1)n.m.lookAt(_v.copy(p).add(n.v));if(PJ==='rpg'&&Math.random()<.7)fx.sprite({p:p.clone(),s0:.25,s1:1.2,life:.7,op:.5,color:0xcfcfcf,rise:.3});
   for(const id in C.players){const q=C.players[id];if(!q.alive||id===n.owner)continue;const c=_v2.copy(q.rp);c.y+=1;if(c.distanceTo(p)<.9){n.t=0;break}}}
  for(const ax of['x','y','z']){const old=p[ax];p[ax]+=n.v[ax]*dt;let hit=false;for(const c of cols)if(p.x>c.x0-.08&&p.x<c.x1+.08&&p.y>c.y0-.08&&p.y<c.y1+.08&&p.z>c.z0-.08&&p.z<c.z1+.08){hit=true;break}
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
 if(m.kind==='flash'){fx.sprite({p,tex:TX.flash,add:true,s0:.5,s1:9,life:.25,op:1,color:0xffffff});const eye=camera.position;const d=eye.distanceTo(p);
  if(me.alive&&d<32&&losClear(p.clone().setY(p.y+.2),eye.clone())){const dir=p.clone().sub(eye).normalize();const facing=Math.max(0,dir.dot(fwd()));const k=Math.min(1,(.35+.65*facing)*(1-d/32)*1.4);flashAmt=Math.max(flashAmt,k*3.2);SFX.bang(k);SFX.ring(k)}else SFX.boom(.4,panOf(p))}}
function updUtil(dt){for(const s of smokes)s.t+=dt;for(let i=smokes.length-1;i>=0;i--)if(smokes[i].t>smokes[i].life)smokes.splice(i,1);
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
const SKINS={default:['Default',0,null],ninja:['Ninja',100,[0x1b1d21,0x111214]],desert:['Desert Ops',100,[0xb59a6a,0x7d6a4a]],arctic:['Arctic',120,[0xe6edf2,0x9aa6b0]],royal:['Royal',160,[0x5b2a86,0xd4a83a]],neon:['Neon',200,[0x18e07a,0x101010]]};
const UPG={mag:{name:'Extended Mag',per:.15,cost:[200,450]},reload:{name:'Fast Hands',per:.08,cost:[200,450]}};
// one wallet + inventory per device, shared by offline, hub and online play. Versioned key; migrates the old 'prog' save.
const WALLET_V=3;const PROG=(()=>{const base={v:WALLET_V,dia:0,owned:[],upg:{},camo:{},camos:{},skin:'default',skins:['default'],wskin:{},wskins:{},fr:null,pc:'soldier',pcs:['soldier']};let w=null;try{w=JSON.parse(LS('wallet')||'null')}catch(e){}
 if(!w||!w.v){let old={};try{old=JSON.parse(LS('prog')||'{}')||{}}catch(e){}w=Object.assign({},old,w||{});}
 const P=Object.assign(base,w);P.v=WALLET_V;P.dia=Math.max(0,P.dia|0);for(const k of['owned','skins','pcs'])if(!Array.isArray(P[k]))P[k]=[];if(!P.pcs.includes('soldier'))P.pcs.push('soldier');if(!PCL[P.pc]||!P.pcs.includes(P.pc))P.pc='soldier';for(const k of['upg','camo','camos','wskin','wskins'])if(!P[k]||typeof P[k]!=='object'||Array.isArray(P[k]))P[k]={};
if(!P.skins.includes('default'))P.skins.push('default');LSS('wallet',JSON.stringify(P));return P})();

function saveProg(){PROG.v=WALLET_V;LSS('wallet',JSON.stringify(PROG));updDiaUI()}
addEventListener('storage',e=>{if(e.key===LSP+'wallet'&&e.newValue){try{Object.assign(PROG,JSON.parse(e.newValue));updDiaUI()}catch(x){}}});
const owns=id=>!W[id].price||PROG.owned.includes(id);
function tier(id,k){return(PROG.upg[id]||{})[k]||0}
function magOf(id){const w=W[id];return w.mag?Math.max(w.mag,Math.round(w.mag*(1+UPG.mag.per*tier(id,'mag')))):0}
function reloadOf(id){const w=W[id];return +(w.reload*(1-UPG.reload.per*tier(id,'reload'))).toFixed(2)}
function updDiaUI(){for(const e of document.querySelectorAll('.diaBal'))e.textContent=PROG.dia}
let diaToastT=null;
function addDia(n,why){if(n>0&&isWknd()){n*=2;why=(why||'')+' ×2 weekend'}(window.__dlog||(window.__dlog=[])).push([n,why]);if(!n)return;PROG.dia+=n;C.matchDia=(C.matchDia||0)+n;saveProg();const t=$('diaToast');if(t){t.textContent=`+${n} 💎 ${why||''}`;t.classList.remove('show');void t.offsetWidth;t.classList.add('show')}}
const me={id:null,pos:new THREE.Vector3(),vel:new THREE.Vector3(),ground:false,yaw:0,pitch:0,hp:100,alive:false,
 load:DEFAULT_LOAD.slice(),utilN:2,cur:0,ammo:[0,0,0],cool:0,reloadT:0,reloadStage:0,switchT:0,slideT:0,slideCd:0,camH:1.62,stepT:0,zoomT:0,frozen:true,burst:0,burstT:0,shots:0,lastShot:0};
try{const l=JSON.parse(LS('load2')||'null');if(l&&l.length===4&&l.every((k,i)=>W[k]&&W[k].slot===i&&owns(k)))me.load=l}catch(e){}
const C={byOrd:{},players:{},phase:'lobby',map:0,mode:'team',score:{},round:0,hostId:null,roundT:0,sb:{}};
let isHost=false,peer=null,conn=null,roomCode='';
function gndAt(x,z,y){let g=y<.6?0:-1e9;for(const c of cols)if(x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1&&c.y1<=y+.45&&c.y1>y-1.2&&c.y1>g)g=c.y1;return g<-1e8?y:g}
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
 peer.on('open',id=>{isHost=true;me.id=id;hostInit(name);if(H.auto)setupAuto();else if(H.pub)regRoom()});
 peer.on('connection',c=>{c.on('data',d=>hostHandle(c.peer,d));c.on('open',()=>{conns[c.peer]=c});c.on('close',()=>hostLeave(c.peer));c.on('error',()=>hostLeave(c.peer))});
 peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();if(code)joinRoom(code,auto);else createRoom()}else if(!isHost)menuMsg('Network error: '+e.type)});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}})}
// OFFLINE: host locally with no PeerJS object at all (zero network); all messages loop back in-process
function startOffline(){audioInit();const name=myName();roomCode='OFFLINE';isHost=true;peer=null;me.id='me-offline';H.offline=true;H.fill=true;H.diff=H.diff||'normal';hostInit(name,true);for(let i=0;i<3;i++)send({t:'bot',add:1})}
function joinRoom(code,auto){audioInit();code=(code||'').toUpperCase().trim();if(code.length<4){menuMsg('Enter a room code');return}
 const name=myName();roomCode=code;menuMsg('Joining '+code+'…');peer=new Peer({config:ICE,debug:0});
 peer.on('open',id=>{me.id=id;conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});
  const to=setTimeout(()=>{if(!conn.open)menuMsg('Could not reach room '+code+'. Check the code or try again.')},12000);
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name,skin:PROG.skin,hid:hubSelfId,ws:PROG.wskin,cl:PROG.pc})});conn.on('data',clientHandle);conn.on('close',hostGone)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){menuMsg(auto?'Setting up the match…':'Room '+code+' not found — creating it so friends can join you!');peer.destroy();setTimeout(()=>createRoom(code,auto),auto?Math.random()*500:600)}else menuMsg('Network error: '+e.type)})}
function hostGone(){if(isHost)return;if(C.fromHub){location.href=hubUrl();return}alert('The host left the game. Tap OK to go back to the room link.');location.href=location.pathname+'?room='+roomCode}
// ================= HOST =================
const H={players:{},mode:'team',phase:'lobby',map:0,score:{},round:0,t:0,next:0,roundEnd:0,botN:0,order:0,fires:[],smokes:[],fireT:0,sideFlip:false};
const BOTNAMES=['Bolt','Ziggy','Rex','Nova','Pip','Tank','Moxie','Echo','Juno','Blaze','Kit','Ace'];const BOTGUNS=['ar','smg','battle','bullpup','pdw','vector','paintball','laser','freeze','bat','chainsaw'];
function hostInit(name,noUrl){C.hostId=me.id;H.players[me.id]=newP(me.id,name);H.players[me.id].skin=PROG.skin;H.players[me.id].ws=cleanWS(PROG.wskin);H.players[me.id].cl=clOf(PROG.pc);H.players[me.id].hid=hubSelfId;sendLobby();showLobby();if(!noUrl)history.replaceState(null,'','?room='+roomCode)}
function newP(id,name,bot){return{id,name,team:'A',color:0xffffff,hp:100,alive:false,kills:0,deaths:0,pts:0,hs:0,rk:0,vote:-1,bot:!!bot,p:[0,-50,0,0,0,0,0],respawn:0,ord:H.order++,gun:bot?BOTGUNS[(Math.random()*BOTGUNS.length)|0]:null,cl:bot?PCL_IDS[Math.random()*PCL_IDS.length|0]:'soldier',ws:bot&&Math.random()<.35?{'*':WSKIN_IDS[1+(Math.random()*(WSKIN_IDS.length-1))|0]}:{}}}
function plist(){return Object.values(H.players).sort((a,b)=>a.ord-b.ord)}
function assignTeams(){let i=0;const AT=H.auto&&H.auto.teams;for(const p of plist()){if(AT&&p.hid&&AT[p.hid]&&H.mode!=='ffa'){p.team=AT[p.hid];p.color=TEAMCOL[p.team];i++;continue}if(H.mode==='ffa'){p.team=p.id;p.color=FFACOL[i%10]}else{p.team=i%2?'B':'A';p.color=TEAMCOL[p.team]}i++}}
function lobbyData(){return{t:'lobby',mode:H.mode,phase:H.phase,hostId:me.id,diff:H.diff||'normal',fill:!!H.fill,pub:!!H.pub,offline:!!H.offline,players:plist().map(p=>({id:p.id,name:p.name,team:p.team,color:p.color,bot:p.bot,vote:p.vote}))}}
function sendLobby(){if(H.phase==='lobby')assignTeams();bcast(lobbyData())}
function sbData(){return{t:'sb',p:plist().map(p=>[p.id,p.kills,p.deaths,p.pts,p.alive?1:0,p.hs,p.as||0]),r:H.score}}
function sendSB(){bcast(sbData())}
function hostLeave(id){if(!H.players[id])return;delete H.players[id];delete conns[id];bcast({t:'bye',id});if(H.phase==='lobby')sendLobby();else{sendSB();checkRound();remCheck()}}
function hostHandle(from,m){const p=H.players[from];
 switch(m.t){
 case 'hello':{if(Object.values(H.players).filter(q=>!q.bot).length>=MAXP){conns[from]?.send({t:'full'});return}if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}
  const np=H.players[from]=newP(from,String(m.name||'Player').slice(0,12));np.skin=SKINS[m.skin]?m.skin:'default';np.ws=cleanWS(m.ws);np.cl=clOf(m.cl);np.hid=m.hid||null;
  if(H.phase==='lobby')sendLobby();else{if(H.mode==='ffa'){np.team=from;np.color=FFACOL[plist().length%10]}else{np.team=teamForJoiner(from);np.color=TEAMCOL[np.team]}
   {const mx=MODEMAX[H.mode]||MAXP;if(plist().length>mx){const bs=plist().filter(q=>q.bot&&(H.mode==='ffa'||q.team===np.team));const bt=bs.find(q=>!q.alive)||bs[0];if(bt){delete H.players[bt.id];bcast({t:'bye',id:bt.id})}}}
   bcast(lobbyData());sendTo(from,startData());bcast({t:'join',id:from,name:np.name,team:np.team,color:np.color,o:np.ord,sk:np.skin,ws:np.ws,cl:np.cl},from);
   sendTo(from,{t:'round',round:H.round,score:H.score,spawns:{},count:0});sendSB();if(H.mode==='ffa')np.respawn=H.t+1}break}
 case 'mode':if(from===me.id&&H.phase==='lobby'&&MODES[m.mode]){H.mode=m.mode;sendLobby();regRoom()}break;
 case 'opt':if(from===me.id){if(DIFF[m.diff])H.diff=m.diff;if('fill' in m)H.fill=!!m.fill;if('pub' in m&&!H.offline){H.pub=!!m.pub;regRoom()}sendLobby()}break;
 case 'vote':if(p&&H.phase==='lobby'){p.vote=m.map|0;sendLobby()}break;
 case 'bot':if(from===me.id&&H.phase==='lobby'){if(m.add&&Object.keys(H.players).length<MAXP){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}
  else if(!m.add){const b=plist().filter(x=>x.bot).pop();if(b)delete H.players[b.id]}sendLobby()}break;
 case 'start':if(from===me.id&&H.phase==='lobby')startMatch();break;
 case 'rem':if(p&&H.matchOver){H.rem[from]=m.v?1:0;remCheck()}break;
 case 'ws':if(p){p.ws=cleanWS(m.ws);bcast({t:'ws',id:from,ws:p.ws})}break;
 case 'cl':if(p){p.cl=clOf(m.cl);bcast({t:'cl',id:from,cl:p.cl})}break;
 case 'ping':conns[from]?.send({t:'pong',ts:m.ts,n:plist().length});break;
 case 'st':if(p&&Array.isArray(m.p))p.p=m.p;break;
 case 'fx':if(p)p.shotT=H.t;bcast({t:'fx',id:from,a:m.a,b:m.b,w:m.w},from);break;
 case 'nade':bcast({t:'nade',id:from,k:m.k,p:m.p,v:m.v},from);break;
 case 'util':{if(!p||H.phase==='lobby')return;const pos=new THREE.Vector3(...m.p);if(m.kind==='molotov')H.fires.push({p:pos,r:m.small?2:3.4,t:0,life:m.small?4.5:7,owner:from});
  if(m.kind==='smoke')H.smokes.push({p:pos.clone().setY(pos.y+1.2),r:4.2,t:0,life:13});
  if(m.kind==='flash')for(const b of plist())if(b.bot&&b.alive&&b.e){const e=_v.set(b.e.pos.x,b.e.pos.y+1.5,b.e.pos.z);if(e.distanceTo(pos)<26&&rayClearHost(pos,e))b.blind=2.8}
  bcast({t:'util',id:from,kind:m.kind,p:m.p});break}
 case 'hit':{const v=H.players[m.id];if(!p||!v||H.phase!=='play'||!p.alive||!v.alive||p.down)return;if(m.id===from){if(!m.splash||!W[m.w]||!W[m.w].splash)return;m.dmg=Math.min(40,m.dmg|0)}else if(H.mode!=='ffa'&&p.team===v.team)return;
  damage(v,Math.min(220,Math.max(0,m.dmg|0)),from,!!m.head,String(m.w||''));break}
 case 'heal':if(p&&p.alive){p.hp=Math.min(100,p.hp+50);bcast({t:'hp',id:from,hp:p.hp})}break;
 case 'fall':if(p&&p.alive&&H.phase==='play')damage(p,999,from,false,'fall');break;
 }}
function rayClearHost(a,b){const d=b.clone().sub(a);const l=d.length();d.divideScalar(l);if(rayWorld(a,d,l)<l-.3)return false;for(const s of H.smokes){if(s.t<1.2)continue;const lx=s.p.x-a.x,ly=s.p.y-a.y,lz=s.p.z-a.z;const tc=lx*d.x+ly*d.y+lz*d.z;const d2=lx*lx+ly*ly+lz*lz-tc*tc;const r=s.r*.8;if(d2<r*r&&tc>-r&&tc<l+r)return false}return true}
function teamForJoiner(id){const h={A:0,B:0},n={A:0,B:0};for(const p of plist()){if(p.id===id||!(p.team in n))continue;n[p.team]++;if(!p.bot)h[p.team]++}return h.A!==h.B?(h.A<h.B?'A':'B'):(n.A<=n.B?'A':'B')}
function teamSmaller(){let a=0,b=0;for(const p of plist()){if(p.team==='A')a++;else if(p.team==='B')b++}return a<=b?'A':'B'}
const AS_WIN=10,AS_MIN=25;
function asRec(v,dmg,by,w){if(!by||by===v.id||w==='fall'||w==='bleed'||!H.players[by])return;const D=v.dmgBy||(v.dmgBy={});const e=D[by]||(D[by]={d:0,t:-99});if(H.t-e.t>AS_WIN)e.d=0;e.d+=v.down?dmg*.5:dmg;e.t=H.t}
function asTake(v,k){const D=v.dmgBy||{};v.dmgBy={};const tm=isTeamMode(H.mode);const out=Object.entries(D).filter(([id,e])=>id!==k&&id!==v.id&&e.d>=AS_MIN&&H.t-e.t<=AS_WIN&&H.players[id]&&!(tm&&H.players[id].team===v.team)).sort((a,b)=>b[1].d-a[1].d).slice(0,2).map(x=>x[0]);
 for(const id of out){const a=H.players[id];a.as=(a.as||0)+1;a.pts+=50}return out}
function damage(v,dmg,by,head,w){if(!v.alive)return;asRec(v,dmg,by,w);{const pc=PCL[v.cl];if(pc&&pc.hp&&w!=='fall'&&w!=='bleed')dmg=Math.max(1,Math.round(dmg*100/pc.hp));v.hurtT=H.t}{const ww=W[w];if(ww&&(ww.slow||ww.push)&&by!==v.id)hitFX(v,ww,by)}
 if(v.down){if(by===v.id&&w!=='fall'&&w!=='bleed')return;v.dhp-=dmg;bcast({t:'hp',id:v.id,hp:0,by,dmg,head,d:1});if(v.dhp>0&&w!=='fall'&&w!=='bleed')return;
  v.down=false;v.rev=null;v.alive=false;const k=H.players[by];const fin=k&&by!==v.id;if(fin)k.pts+=25;v.dmgBy={};bcast({t:'kill',k:by,v:v.id,head,w,fin:fin?1:0,bleed:w==='bleed'?1:0});sendSB();checkRound();return}
 v.hp-=dmg;bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg,head});
 if(v.hp<=0&&isTeamMode(H.mode)&&H.phase==='play'&&w!=='fall'&&by!==v.id&&plist().some(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down)){
  v.hp=0;v.down=true;v.dhp=DOWN.hp;v.downT=H.t+DOWN.bleed;v.rev=null;for(const q of plist())if(q.rev&&q.rev.by===v.id){q.rev=null;(window.__rvc=window.__rvc||[]).push(q.id)}v.deaths++;const k=H.players[by];if(k){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w,dn:1,as:asTake(v,by)});sendSB();checkRound();return}
 if(v.hp<=0){v.alive=false;v.deaths++;const k=H.players[by];const self=!k||by===v.id;if(!self){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w,as:self?(v.dmgBy={},[]):asTake(v,by)});if(H.mode==='ffa'&&H.phase==='play')v.respawn=H.t+2.5;sendSB();checkRound()}}
function toPlayer(id,msg){if(conns[id]&&conns[id].open)conns[id].send(msg);else if(id===me.id)clientHandle(msg)}
function hitFX(v,w,by){const k=H.players[by];if(w.slow){if(v.bot){v.slowT=H.t+w.slow[1];v.slowF=w.slow[0]}else toPlayer(v.id,{t:'slow',f:w.slow[0],d:w.slow[1]})}
 if(w.push&&k){const dx=v.p[0]-k.p[0],dz=v.p[2]-k.p[2],l=Math.hypot(dx,dz)||1;const px=dx/l*w.push,pz=dz/l*w.push;if(v.bot&&v.e){v.e.vel.x+=px;v.e.vel.z+=pz;v.e.vel.y=Math.max(v.e.vel.y,1.2)}else toPlayer(v.id,{t:'push',v:[px,pz]})}}
function startData(){return{t:'start',map:H.map,mode:H.mode,players:Object.fromEntries(plist().map(p=>[p.id,{name:p.name,team:p.team,color:p.color,bot:p.bot,o:p.ord,sk:p.skin,ws:p.ws||{},cl:p.cl||'soldier'}]))}}
function startMatch(){{const mx=MODEMAX[H.mode]||10;const bots=plist().filter(p=>p.bot);while(plist().length>mx&&bots.length){const b=bots.pop();delete H.players[b.id];bcast({t:'bye',id:b.id})}}if(H.fill){const want=MODEMAX[H.mode]||4;while(Object.keys(H.players).length<want){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}}if(!H.rematch)assignTeams();const votes=MAPS.map(()=>0);for(const p of plist())if(p.vote>=0)votes[p.vote]++;
 const mx=Math.max(...votes);const best=votes.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);H.map=best[Math.random()*best.length|0];if(H.auto&&H.auto.map!=null)H.map=H.auto.map;if(H.rematch&&H.prevMap!=null)H.map=H.prevMap;H.rematch=0;
 H.score={};H.round=0;H.fires=[];H.smokes=[];for(const p of plist()){p.kills=p.deaths=p.pts=p.hs=p.as=0}const m=buildMap(H.map);cols=m.cols;groundHalf=m.groundHalf;ladders=m.ladders||[];hides=m.hides||[];
 H.phase='starting';bcast(lobbyData());bcast(startData());sendSB();setTimeout(startRound,900)}
// ---- spawn selection ----
function allSpawns(m){return[...m.spawnsA,...m.spawnsB,...m.spawnsM]}
function faceCenter(s){return Math.atan2(s[0],s[1])}
function minDistTo(s,pts){let d=1e9;for(const q of pts)d=Math.min(d,Math.hypot(q[0]-s[0],q[1]-s[1]));return d}
// pick spawn maximising distance from given points (with a little randomness among the best)
function farthest(cands,pts,used){const sc=cands.filter(s=>!used||!used.some(u=>u[0]===s[0]&&u[1]===s[1])).map(s=>[s,pts.length?minDistTo(s,pts):Math.random()*100]).sort((a,b)=>b[1]-a[1]);
 const top=sc.slice(0,Math.max(1,Math.min(2,sc.length))).filter(x=>x[1]>=sc[0][1]*.85);return(top[Math.random()*top.length|0]||sc[0])[0]}
function roundSpawns(){const m=buildMap(H.map);const ps=plist();const out={};const all=allSpawns(m);
 if(isTeamMode(H.mode)){const flip=Math.random()<.5;const sideOf=t=>(t==='A')!==flip?m.spawnsA:m.spawnsB;
  for(const t of['A','B']){const mates=ps.filter(p=>p.team===t);if(!mates.length)continue;const list=sideOf(t);const anchor=list[Math.random()*list.length|0];
   const byNear=list.slice().sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]));mates.forEach((p,i)=>out[p.id]=byNear[i%byNear.length])}}
 else{// duel & FFA: random first, then each next as far as possible from everyone already placed
  const order=ps.slice().sort(()=>Math.random()-.5);const used=[];for(const p of order){const s=used.length?farthest(all,used,used):all[Math.random()*all.length|0];used.push(s);out[p.id]=s}}
 for(const id in out){const s=out[id];out[id]=[s[0],s[1],faceCenter(s)]}return out}
function respawnPoint(p){const m=buildMap(H.map);const enemies=plist().filter(q=>q.alive&&q.id!==p.id).map(q=>[q.p[0],q.p[2]]);const s=farthest(allSpawns(m),enemies);return[s[0],s[1],faceCenter(s)]}
function startRound(){if(!Object.keys(H.players).length)return;H.round++;H.phase='count';H.fires=[];H.smokes=[];const spawns=roundSpawns();
 for(const p of plist()){p.dmgBy={};p.hp=100;p.alive=true;p.down=false;p.rev=null;p.rk=0;p.respawn=0;const s=spawns[p.id];p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s)}
 H.next=H.t+3;H.roundEnd=H.t+3+(H.mode==='ffa'?120:90);bcast({t:'round',round:H.round,score:H.score,spawns,count:3});sendSB();window.__lastSpawns=spawns}
function teamAlive(){const a={};for(const p of plist())if(p.alive&&!p.down)a[p.team]=(a[p.team]||0)+p.hp;return a}
function checkRound(){if(H.phase!=='play')return;let win=null;
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
function hostTick(dt){H.t+=dt;if(H.phase==='play')for(const p of plist()){const pc=PCL[p.cl];if(pc&&pc.regen&&p.alive&&!p.down&&p.hp<100&&H.t-(p.hurtT||0)>4){const o=Math.floor(p.hp);p.hp=Math.min(100,p.hp+pc.regen*dt);if(Math.floor(p.hp)!==o&&Math.floor(p.hp)%3===0||p.hp>=100)bcast({t:'hp',id:p.id,hp:Math.round(p.hp)})}}
 if(H.auto&&H.phase==='lobby'&&H.autoAt){const humans=plist().filter(p=>!p.bot).length;if(humans>=H.auto.expect||H.t>H.autoAt){H.autoAt=0;startMatch()}}
 if(H.phase==='count'&&H.t>=H.next){H.phase='play';bcast({t:'go'})}
 if(H.phase==='play'){
  for(const v of plist()){if(!v.down)continue;if(H.t>=v.downT){damage(v,999,v.id,false,'bleed');continue}
   const rv=plist().filter(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down&&Math.hypot(q.p[0]-v.p[0],q.p[1]-v.p[1],q.p[2]-v.p[2])<=DOWN.r);
   if(rv.length){if(!v.rev||!rv.some(q=>q.id===v.rev.by))v.rev={by:rv[0].id,t0:H.t};if(H.t-v.rev.t0>=((PCL[(H.players[v.rev.by]||{}).cl]||{}).rev||DOWN.revive)){(window.__rv=window.__rv||[]).push(+(H.t-v.rev.t0).toFixed(3));(window.__rvBy=window.__rvBy||[]).push({id:v.id,by:v.rev.by});v.down=false;v.hp=DOWN.revHp;v.dmgBy={};const by=v.rev.by;v.rev=null;bcast({t:'revive',id:v.id,by,hp:v.hp});bcast({t:'hp',id:v.id,hp:v.hp});sendSB();continue}}
   else v.rev=null;
   if((v.dsT=(v.dsT||0)+dt)>.15){v.dsT=0;bcast({t:'dst',id:v.id,left:Math.max(0,v.downT-H.t),rv:v.rev?Math.min(1,(H.t-v.rev.t0)/((PCL[(H.players[v.rev.by]||{}).cl]||{}).rev||DOWN.revive)):0,by:v.rev?v.rev.by:null})}}
  if(H.t>=H.roundEnd){let win='draw';if(H.mode==='ffa'){let b=-1;for(const p of plist())if(p.rk>b){b=p.rk;win=p.id}}else{const a=teamAlive();win=(a.A||0)>(a.B||0)?'A':(a.B||0)>(a.A||0)?'B':'draw'}endRound(win)}
  if(H.mode==='ffa')for(const p of plist()){if(!p.alive&&p.respawn&&H.t>=p.respawn){p.respawn=0;p.dmgBy={};p.alive=true;p.hp=100;const s=respawnPoint(p);p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s);bcast({t:'spawn',id:p.id,s});sendSB()}}
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
function botTick(b,dt){const e=b.e;let tgt=null,td=1e9;
 if(b.down){// crawl toward the nearest standing teammate
  const mates=plist().filter(q=>q.team===b.team&&q.id!==b.id&&q.alive&&!q.down);let m=null,md=1e9;for(const q of mates){const d=Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z);if(d<md){md=d;m=q}}
  let wx=0,wz=0;if(m&&md>1){wx=(m.p[0]-e.pos.x)/md;wz=(m.p[2]-e.pos.z)/md;b.yaw=Math.atan2(-wx,-wz)}e.vel.x=wx*1.1;e.vel.z=wz*1.1;e.bump=0;physStep(e,dt);b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX[b.gun]|0,0];return}
 // go revive a downed teammate when no enemy is in sight
 if(isTeamMode(H.mode)){const dn=plist().filter(q=>q.down&&q.alive&&q.team===b.team&&q.id!==b.id);if(dn.length){let best=null,bd=1e9;for(const q of dn){const d=Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z);if(d<bd){bd=d;best=q}}
  if(best&&bd<60){b.revT=best.id;b.goal=[best.p[0],best.p[2],best.p[1]];b.via=null}else b.revT=null}else b.revT=null}b.blind=Math.max(0,(b.blind||0)-dt);const w=W[b.gun]||W.ar;
 if(b.blind<=0&&!H.noFight)for(const q of plist()){if(!q.alive||q.id===b.id||(H.mode!=='ffa'&&q.team===b.team))continue;const dx=q.p[0]-e.pos.x,dz=q.p[2]-e.pos.z,dy=q.p[1]-e.pos.y,dd=Math.hypot(dx,dy,dz);if(dd>55||dd>=td)continue;if(dd>4.5&&hides.length&&inVol(hides,{x:q.p[0],y:q.p[1]+.5,z:q.p[2]})&&!(q.shotT>H.t-1.5))continue;
  _o.set(e.pos.x,e.pos.y+1.5,e.pos.z);if(!rayClearHost(_o,_d.set(q.p[0],q.p[1]+(q.down?.4:1.4),q.p[2])))continue;const sc=dd+(q.down?12:0);if(sc>=td)continue;td=sc;tgt=q}
 let wx=0,wz=0;b.st-=dt;if(b.st<=0){b.st=.5+Math.random()*1.2;b.strafe=Math.random()<.5?-1:1}
 if(tgt){const dx=tgt.p[0]-e.pos.x,dz=tgt.p[2]-e.pos.z;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*DIFF[H.diff||'normal'].turn);
  const fx2=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);wx=-fz*b.strafe;wz=fx2*b.strafe;if(td>14||(w.melee&&td>w.melee*.7)){wx+=fx2*(w.melee?3:1);wz+=fz*(w.melee?3:1)}
  b.react-=dt;b.cool-=dt;if(b.react<=0&&b.cool<=0&&!(w.melee&&td>w.melee+.4)){b.cool=w.rate*1.25;const D=DIFF[H.diff||'normal'];const hit=Math.random()<Math.max(.08,D.hit-td/100);const BS=window.__botStat||(window.__botStat={s:0,h:0,hd:0});BS.s++;if(hit)BS.h++;_o.set(e.pos.x,e.pos.y+1.4,e.pos.z);
   const end=[tgt.p[0]+(hit?0:(Math.random()-.5)*2),tgt.p[1]+1.2+(hit?0:Math.random()),tgt.p[2]+(hit?0:(Math.random()-.5)*2)];
   bcast({t:'fx',id:b.id,a:[_o.x,_o.y,_o.z],b:end,w:b.gun});if(hit){const head=Math.random()<D.head;if(head)BS.hd++;damage(tgt,Math.round((head?w.head:w.body)*falloff(w,td)),b.id,head,b.gun)}}}
 else{b.react=DIFF[H.diff||'normal'].react;const m=buildMap(H.map);if(b.goal&&b.hold>0&&Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2&&Math.abs((b.goal[2]||0)-e.pos.y)<1.6)b.hold-=dt;if(!b.revT&&!(b.hold>0&&b.goal&&Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2.5)&&(!b.goal||(Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2&&Math.abs((b.goal[2]||0)-e.pos.y)<1.6)||(!H.noFight&&(Math.random()<dt*.05||(b.goalT=(b.goalT||0)+dt)>25)))){const all=allSpawns(m);const foes=plist().filter(q=>q.alive&&q.id!==b.id&&(H.mode==='ffa'||q.team!==b.team));const hi=m.nav?m.nav.filter(n=>(n[2]||0)>2):[];if(hi.length&&Math.random()<.4){b.goal=hi[Math.random()*hi.length|0].slice();b.hold=4+Math.random()*6}else if(foes.length&&Math.random()<.55){const f=foes[Math.random()*foes.length|0];b.goal=[f.p[0]+(Math.random()-.5)*3,f.p[2]+(Math.random()-.5)*3,f.p[1]]}else if(m.nav&&m.nav.length&&Math.random()<.5)b.goal=m.nav[Math.random()*m.nav.length|0].slice();else b.goal=all[Math.random()*all.length|0].slice();b.via=null;b.goalT=0}
  const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z;b.climbY=nt[1];const l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*4)}
 // revive takes priority over fighting unless an enemy is very close (<7 m): keep aiming/shooting, but walk to the downed mate and hold
 let revHold=false;if(b.revT){const q=H.players[b.revT];if(q&&q.down&&(!tgt||td>7)){const m=buildMap(H.map);if(tgt){const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z,l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;b.climbY=nt[1]}
   if(Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z)<.9&&Math.abs(q.p[1]-e.pos.y)<1.2){wx=wz=0;b.detour=0;revHold=true}}}
 if(b.detour>0&&!revHold){b.detour-=dt;wx=b.dd[0];wz=b.dd[1]}
 const l=Math.hypot(wx,wz);if(l>0){wx/=l;wz/=l}const sp=(b.blind>0?2:5.2)*(b.slowT>H.t?b.slowF:1);{const cs=(PCL[b.cl]||{}).spd||1;e.vel.x+=(wx*sp*cs-e.vel.x)*Math.min(1,dt*10);e.vel.z+=(wz*sp*cs-e.vel.z)*Math.min(1,dt*10)}
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
function clientHandle(m){switch(m.t){
 case 'lobby':lastLobby=m;C.hostId=m.hostId;C.mode=m.mode;if(m.phase==='lobby'){if(inGame)leaveToLobby();showLobby()}renderLobby();break;
 case 'full':menuMsg('Room is full (10 players max).');break;
 case 'start':startGame(m);break;
 case 'rematch':center('REMATCH!\nSame room, same players',1800);remWait=false;break;
 case 'remv':{const b=$('endAgain');if(b&&remWait)b.textContent=`⏳ WAITING (${m.y}/${m.n})`;break}
 case 'cl':{const q=C.players[m.id];if(q&&q.model&&m.id!==me.id){const vis=q.model.visible;scene.remove(q.model);q.cl=clOf(m.cl);q.model=makeCharacter(q.color,q.name,m.id,undefined,undefined,q.cl);q.model.visible=vis;scene.add(q.model);q.gunId=null}else if(q)q.cl=clOf(m.cl);break}
 case 'ws':{const q=C.players[m.id];if(q){q.ws=m.ws||{};q.gunSk=null;if(q.gunId){const g=q.gunId;q.gunId=null;setRemoteGun(q,WIDX[g])}}break}
 case 'join':addRemote(m.id,{name:m.name,team:m.team,color:m.color,o:m.o,sk:m.sk,ws:m.ws,cl:m.cl});renderSB();feed(`${m.name} joined`);break;
 case 'bye':{const q=C.players[m.id];if(q){if(q.model)scene.remove(q.model);feed(q.name+' left');delete C.players[m.id];delete C.sb[m.id];renderSB()}break}
 case 'round':{C.round=m.round;for(const k in C.players){C.players[k].hp=100;C.players[k].down=false;C.players[k].dst=null}me.down=false;me.dst=null;updDown();hideEnd();C.score=m.score;C.phase=m.count?'count':'play';for(const n of nades)scene.remove(n.m);nades=[];smokes.length=0;fires.length=0;
  for(const id in C.players){const q=C.players[id];const s=m.spawns[id];if(s){q.alive=true;q.hp=100;q.rp.set(s[0],0,s[1]);q.tp.copy(q.rp);q.yaw=q.tyaw=s[2];if(q.model){q.model.userData.dead=0;q.model.visible=true}}}
  if(m.spawns[me.id])spawnMe(m.spawns[me.id]);else if(!m.count){me.alive=false;center('Joined mid-round\nYou spawn next round')}
  if(m.count){me.frozen=true;let n=m.count;const tick=()=>{if(C.phase!=='count')return;center('ROUND '+C.round+'\n'+n);SFX.beep(600);n--;if(n>0)setTimeout(tick,1000)};tick()}renderSB();break}
 case 'go':C.phase='play';me.frozen=false;center('FIGHT!',800);SFX.beep(1200);showRL(false);break;
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
   if(m.v===me.id){me.down=true;me.hp=0;me.slideT=0;me.zoomT=0;updHP();updDown();center('DOWNED!\nWaiting for a teammate…',1800)}if(m.k===me.id){SFX.kill();center('DOWNED '+(v?.name||''),1000)}break}
  if(v){v.down=false;v.dst=null}if(m.v===me.id){me.down=false;me.dst=null;updDown()}
  if(m.fin||m.bleed){if(m.fin&&m.k===me.id)addDia(Math.max(1,Math.round(1*ECON.mul())),'finish');if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
   feed(m.bleed?`<b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b> <span class="k">[bled out]</span>`:`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[finished]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
   if(m.v===me.id){me.alive=false;me.hp=0;updHP();center(m.bleed?'BLED OUT':'FINISHED by '+(k?.name||'?'),2000)}if(m.fin&&m.k===me.id){SFX.kill();center('FINISHED '+(v?.name||''),900)}break}
  if(m.k===me.id&&m.v!==me.id)addDia(Math.round((m.head?ECON.kill+ECON.head:ECON.kill)*ECON.mul()*(v&&v.bot?ECON.bot:1)),(m.head?'headshot':'kill')+(v&&v.bot?' (bot)':''));if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
  const wn=m.w==='fall'?'fell':m.w==='molotov'?'🔥':W[m.w]?W[m.w].name:'';
  if(m.w==='fall'||m.k===m.v)feed(`${v?.name||'?'} ${m.w==='fall'?'fell off':'eliminated themselves'}`);else feed(`${KN} <span class="k">[${esc(wn)}${m.head?' 🎯':''}]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
  if(m.v===me.id){me.alive=false;me.hp=0;updHP();me.killer=m.k;center('ELIMINATED'+(k&&m.k!==m.v?'\nby '+k.name:'')+(C.mode==='ffa'?'\nRespawning…':''),2200)}
  if(m.k===me.id&&m.v!==me.id){SFX.kill();center(m.head?'🎯 HEADSHOT!':'ELIMINATED '+(v?.name||''),1000)}break}
 case 'roundEnd':{C.phase='roundEnd';C.score=m.score;me.frozen=true;const mine=C.mode==='ffa'?m.win===me.id:m.win===C.players[me.id]?.team;
  {if(mine)addDia(Math.round(ECON.round*ECON.mul()),'round win');if(m.match)addDia(Math.round((mine?ECON.win+ECON.play:ECON.play)*ECON.mul()),mine?'match win':'match played')}
  center(m.win==='draw'?'DRAW':(m.match?`${m.name}\nWINS THE MATCH!\n💎 +${C.matchDia||0} diamonds this match`:`${m.name} WINS THE ROUND`)+(mine?' 🏆':''),m.match?6000:3300);if(m.match)setTimeout(()=>showEnd(m,mine),2600);else showRL(true);if(mine)SFX.kill();renderSB();break}
 case 'fx':{const a=new THREE.Vector3(...m.a),b=new THREE.Vector3(...m.b);const fw=W[m.w];addTracer(a,b,fw&&fw.tracer);if(fw&&fw.paint)paintSplat(b,null,m.id);fx.sprite({p:a,tex:TX.flash,add:true,s0:.4,s1:.6,life:.05,op:1,color:0xffd080});
  const d=camera.position.distanceTo(a);if(d<120)SFX.gun(m.w,Math.max(.06,1-d/120)*.75,panOf(a),d);if(m.id!==me.id&&me.alive)nearMiss(a,b,fw);funFX(m.w,a,b);const dir=b.clone().sub(a).normalize();const t=rayWorld(a,dir,a.distanceTo(b)+.5);if(t<a.distanceTo(b)+.4)impact(a.clone().addScaledVector(dir,t),hitN.clone());break}
 case 'nade':spawnNade(m.id,m.k||'grenade',new THREE.Vector3(...m.p),new THREE.Vector3(...m.v));break;
 case 'util':utilFX(m);break;
 case 'sb':C.sb={};for(const r of m.p)C.sb[r[0]]={k:r[1],d:r[2],pts:r[3],alive:!!r[4],hs:r[5],as:r[6]||0};C.score=m.r||{};renderSB();if(!$('pause').classList.contains('hidden'))renderBoard();break;
 }}
function addRemote(id,info){if(C.players[id]?.model)scene.remove(C.players[id].model);
 const q={id,cl:clOf(info.cl),ws:info.ws||{},name:info.name,team:info.team,color:info.color??0xffffff,bot:info.bot,alive:false,hp:100,rp:new THREE.Vector3(0,-50,0),tp:new THREE.Vector3(0,-50,0),lp:new THREE.Vector3(),yaw:0,tyaw:0,pitch:0,tpitch:0,flags:0};
 if(id!==me.id){q.model=makeCharacter(q.color,info.name,id,undefined,(SKINS[info.sk]||[])[2]||undefined,info.cl);q.model.visible=false;scene.add(q.model)}C.players[id]=q;if(info.o!=null)C.byOrd[info.o]=q}
function startGame(m){hideEnd();remWait=false;{const rt=$('roomTag');if(rt){const online=!(H&&H.offline)&&roomCode&&roomCode!=='OFFLINE'&&!C.hub;rt.classList.toggle('hidden',!online);if(online){const pub=lastLobby?!!lastLobby.pub:!!H.pub;rt.textContent=(pub?'🌐 PUBLIC · ':'🔒 PRIVATE · ')+roomCode+' · tap to invite'}}}for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.byOrd={};C.mode=m.mode;C.map=m.map;C.score={};C.sb={};C.matchDia=0;
 loadMap(m.map);for(const id in m.players)addRemote(id,m.players[id]);
 for(const s of['menu','lobby','arsenal','settings'])$(s).classList.add('hidden');stopPreview();$('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);
 inGame=true;resize();me.alive=false;me.frozen=true;feed(`${MAPS[m.map].icon} ${MAPS[m.map].name} · ${MODES[m.mode][0]}`);center(MAPS[m.map].name.toUpperCase(),1500);renderSB();buildSlots();
 goFS()}
// face the most open direction, biased toward the map centre (never stare at a wall)
function faceYaw(x,z){const o=new THREE.Vector3(x,1.6,z),d=new THREE.Vector3();const cy=Math.atan2(x,z);let best=cy,bs=-1;
 for(let i=0;i<16;i++){const y=i/16*Math.PI*2;d.set(-Math.sin(y),0,-Math.cos(y));const free=Math.min(rayWorld(o,d,60),60);let dy=Math.abs(((y-cy+Math.PI*3)%(Math.PI*2))-Math.PI);const sc=free*(1.25-dy/Math.PI*.6);if(sc>bs){bs=sc;best=y}}
 return Math.hypot(x,z)<1?best:best}
function spawnMe(s){me.pos.set(s[0],0,s[1]);me.lad=null;me.mountT=0;me.vel.set(0,0,0);me.yaw=faceYaw(s[0],s[1]);me.pitch=0;me.hp=100;me.alive=true;me.slideT=0;me.reloadT=0;me.killer=null;recoilP=recoilY=0;
 me.ammo=me.load.slice(0,3).map(w=>magOf(w));me.utilN=W[me.load[3]].count+((PCL[PROG.pc]||{}).util||0);me.cur=0;me.zoomT=0;me.zoomOn=false;updZoomBtn();setViewModel(me.load[0]);me.switchT=.35;updHP();buildSlots()}
function leaveToLobby(){hideEnd();inGame=false;paused=false;$('hud').classList.remove('paused');$('hud').classList.add('hidden');$('pause').classList.add('hidden');for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};
 for(const n of nades)scene.remove(n.m);nades=[];if(document.pointerLockElement)document.exitPointerLock();resize()}
// ---------------- HUD ----------------
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let centerTO=null;function center(t,ms){$('center').textContent=t;clearTimeout(centerTO);if(ms)centerTO=setTimeout(()=>$('center').textContent='',ms)}
function feed(t,html){const d=document.createElement('div');if(html)d.innerHTML=t;else d.textContent=t;$('feed').prepend(d);while($('feed').children.length>4)$('feed').lastChild.remove();setTimeout(()=>d.remove(),5000)}
function updHP(){const h=Math.max(0,me.hp);$('hpFill').style.width=h+'%';$('hpFill').style.background=h>60?'#2ee59d':h>30?'#ffd23f':'#ff5a6b';$('hpTxt').textContent=Math.ceil(h)}
function flashV(){const v=$('vign');v.style.transition='none';v.style.opacity=.75;requestAnimationFrame(()=>{v.style.transition='opacity .6s';v.style.opacity=0})}
function chip(q){const s=C.sb[q.id]||{k:0,pts:0,alive:q.alive};const rw=C.mode==='ffa'&&C.score[q.id]?`<i>★${C.score[q.id]}</i>`:'';
 const hp=s.alive?Math.max(0,Math.min(100,q.id===me.id?me.hp:(q.hp??100))):0;
 const dn=(q.id===me.id?me.down:q.down)&&s.alive;
 return `<div class="chip${q.id===me.id?' me':''}${s.alive?'':' dead'}${dn?' down':''}" style="--c:${hex(q.color)}"><b>${dn?'🩸 ':''}${esc(q.name)}</b>${rw}<span>${s.pts}</span><u style="width:${hp}%"></u></div>`}
function renderSB(){if(!inGame)return;const ps=Object.values(C.players);let h='';
 if(C.mode==='ffa'){ps.sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));h=`<div class="rounds"><small>R${C.round||1}</small></div>`+ps.map(chip).join('')}
 else{const A=ps.filter(p=>p.team==='A'),B=ps.filter(p=>p.team==='B');h=A.map(chip).join('')+`<div class="rounds"><span class="a">${C.score.A||0}</span><small>R${C.round||1}<br>FT${WIN_ROUNDS}</small><span class="b">${C.score.B||0}</span></div>`+B.map(chip).join('')}
 $('sbar').innerHTML=h}
function renderBoard(){const ps=Object.values(C.players).sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));
 $('board').innerHTML=`<div class="cardHead sm">${MODES[C.mode][0]} · ${MAPS[C.map].name} · ROOM ${roomCode}</div><table><tr style="opacity:.7;font-size:11px"><td>PLAYER</td><td>PTS</td><td>K</td><td>D</td><td>A</td><td>🎯</td>${C.mode==='ffa'?'<td>★</td>':''}</tr>`+
 ps.map(p=>{const s=C.sb[p.id]||{k:0,d:0,pts:0,hs:0,as:0};return`<tr class="${p.id===me.id?'me':''}"><td style="color:${hex(p.color)}">${esc(p.name)}${p.bot?' 🤖':''}</td><td>${s.pts}</td><td>${s.k}</td><td>${s.d}</td><td>${s.as||0}</td><td>${s.hs}</td>${C.mode==='ffa'?`<td>${C.score[p.id]||0}</td>`:''}</tr>`}).join('')+'</table>'}
let paused=false;
function openPause(on){paused=!!on;$('pause').classList.toggle('hidden',!on);$('hud').classList.toggle('paused',paused);
 // drop any held input so nothing keeps firing/moving behind the menu
 for(const k in keys)keys[k]=false;inp.fire=false;inp.mx=inp.mz=0;inp.sprint=false;inp.jump=false;lookPX=lookPY=0;joyId=lookId=null;$('joyKnob').style.transform='';
 if(on){renderBoard();if(document.pointerLockElement)document.exitPointerLock()}
 else if(!isTouch&&inGame&&canvas.requestPointerLock){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
$('menuBtn').onclick=()=>openPause(!paused);$('pResume').onclick=()=>openPause(false);
// desktop: Esc releases pointer lock without a keydown, so treat an unexpected unlock as "pause"
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&inGame&&!paused&&$('arsenal').classList.contains('hidden')&&$('settings').classList.contains('hidden'))openPause(true)});$('pLeave').onclick=()=>{location.href=location.pathname};
$('pArsenal').onclick=()=>openArsenal();$('pShop').onclick=()=>openArsenal(null,'shop');$('pSettings').onclick=()=>openSettings();
let hudKey='';function updAmmo(){const k=me.cur+'|'+me.ammo.join(',')+'|'+(me.reloadT>0)+'|'+me.utilN+'|'+me.load.join();if(k!==hudKey){hudKey=k;buildSlots()}}
function buildSlots(){let h='';for(let i=0;i<3;i++){const id=me.load[i],w=W[id];const a=i===me.cur&&!w.melee?`<span>${me.reloadT>0?'⟳':me.ammo[i]}</span>`:'';h+=`<div class="sl${i===me.cur?' cur':''}" data-s="${i}"><img src="${ICON[id]||''}" alt="${w.name}">${a}</div>`}
 h+=`<div class="sl util" data-s="3"><img src="${ICON[me.load[3]]||''}" alt=""><span>×${me.utilN}</span></div>`;$('slots').innerHTML=h;
 $('bNade').innerHTML=`<img src="${ICON[me.load[3]]||''}" alt=""><span>${me.utilN}</span>`;$('bNade').style.opacity=me.utilN>0?1:.4}
$('slots').addEventListener('pointerdown',e=>{const d=e.target.closest('[data-s]');if(!d)return;e.stopPropagation();e.preventDefault();const s=+d.dataset.s;if(s<3)switchTo(s);else useUtil()});
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
function sendWS(){if(inGame&&!C.hub)send({t:'ws',ws:cleanWS(PROG.wskin)})}
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
function equip(w){me.load[w.slot]=w.id;LSS('load2',JSON.stringify(me.load));renderLoadoutMini();if(inGame&&!C.hub)feed(`${w.name} equipped — active on next spawn`);if(C.hub)hubEquip()}
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
 else if(act==='buyskin'){const p=SKINS[skinSel][1];if(PROG.dia<p)return denied();PROG.dia-=p;PROG.skins.push(skinSel);PROG.skin=skinSel;saveProg();SFX.kill();hubEquip&&hubEquip()}
 else if(act==='wear'){PROG.skin=skinSel;saveProg();hubEquip&&hubEquip()}
 renderArsenal()});
$('arsClose').onclick=()=>{$('arsenal').classList.add('hidden');stopPreview()};
$('openArsenal').onclick=()=>openArsenal();$('lobArsenal').onclick=()=>openArsenal();$('openShop').onclick=()=>openArsenal(null,'shop');$('openUpg').onclick=()=>openArsenal(null,'upgrade');$('lobShop').onclick=()=>openArsenal(null,'shop');
// ---- settings ----
function openSettings(){$('settings').classList.remove('hidden');$('sens').value=S.sens;$('sensVal').textContent=(+S.sens).toFixed(2);$('aimAssist').checked=S.aimAssist;$('vol').value=S.vol;$('volVal').textContent=Math.round(S.vol*100)+'%';$('sfxv').value=S.sfx;$('sfxVal').textContent=Math.round(S.sfx*100)+'%';
 for(const b of $('qualBtns').children)b.classList.toggle('sel',b.dataset.q===S.quality);$('zsens').value=S.zsens;$('zsensVal').textContent=(+S.zsens).toFixed(2);$('qualNow').textContent=S.quality==='auto'?'(auto: '+qLevel()+')':''}
$('vol').oninput=e=>{S.vol=+e.target.value;$('volVal').textContent=Math.round(S.vol*100)+'%';saveS();setVolumes()};$('sfxv').oninput=e=>{S.sfx=+e.target.value;$('sfxVal').textContent=Math.round(S.sfx*100)+'%';saveS();setVolumes();SFX.click()};
$('zsens').oninput=e=>{S.zsens=+e.target.value;$('zsensVal').textContent=S.zsens.toFixed(2);saveS()};
$('sens').oninput=e=>{S.sens=+e.target.value;$('sensVal').textContent=S.sens.toFixed(2);saveS()};$('aimAssist').onchange=e=>{S.aimAssist=e.target.checked;saveS()};
$('qualBtns').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;const wasLow=qLevel()==='low';S.quality=b.dataset.q;saveS();applyQuality();openSettings()};
$('setClose').onclick=()=>$('settings').classList.add('hidden');$('openSettings').onclick=openSettings;$('lobSettings').onclick=openSettings;
// ================= INPUT =================
const SLIDE={boost:1.5,cap:14.5,tap:.7,max:1.6};window.__SLIDE=SLIDE;const keys={};const inp={mx:0,mz:0,fire:false,jump:false,slide:false,sprint:false,zoom:false};
let lookPX=0,lookPY=0;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(!(inGame&&paused&&!['Escape','Tab','KeyP'].includes(e.code)))keys[e.code]=true;if(!inGame)return;if(paused&&!['Escape','Tab','KeyP'].includes(e.code))return;
 if(e.code==='Space'){inp.jump=true;e.preventDefault()}if(e.code==='KeyC'||e.code==='ControlLeft'){if(!e.repeat)inp.slide=true;inp.slideHold=true;e.preventDefault()}
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchTo((me.cur+1)%3);if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=3)switchTo(n-1);if(n===4)useUtil()}
 if(e.code==='KeyG'||e.code==='KeyF')useUtil();if(e.code==='Tab'||e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(e.repeat)return;
  if(!$('arsenal').classList.contains('hidden')){$('arsClose').click();return}if(!$('settings').classList.contains('hidden')){$('setClose').click();return}
  if(e.code==='Tab')openPause(true);else openPause(!paused)}
 if(e.code==='KeyZ'&&!e.repeat)toggleZoom()});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyC'||e.code==='ControlLeft')inp.slideHold=false;if(e.code==='Tab')openPause(false)});
canvas.addEventListener('mousedown',e=>{audioInit();if(!inGame||isTouch)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return}if(e.button===0)inp.fire=true;if(e.button===2)zoomPress()});
addEventListener('mouseup',e=>{if(e.button===0)inp.fire=false;if(e.button===2)zoomRelease()});
addEventListener('contextmenu',e=>{if(inGame)e.preventDefault()});
addEventListener('wheel',e=>{if(inGame&&document.pointerLockElement)switchTo((me.cur+(e.deltaY>0?1:2))%3)},{passive:true});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;const s=.0021*S.sens*zoomSens();me.yaw-=e.movementX*s;me.pitch-=e.movementY*s;clampPitch()});
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
for(const id of['bJump','bSwap','bNade','bSlide']){const b=$(id);
 b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audioInit();b.classList.add('down');if(id==='bSwap')switchTo((me.cur+1)%3);else if(id==='bNade')useUtil();else if(id==='bSlide'){inp.slide=true;inp.slideHold=true}else inp.jump=true});
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
function switchTo(i){if(i===me.cur||!me.alive)return;me.cur=i;me.reloadT=0;me.switchT=.32;me.zoomT=0;me.zoomOn=false;updZoomBtn();me.burst=0;setViewModel(me.load[i]);SFX.swap()}
function reload(){const w=W[me.load[me.cur]];if(w.melee||me.reloadT>0||me.ammo[me.cur]>=magOf(w.id)||!me.alive)return;me.reloadT=reloadOf(w.id);me.reloadStage=0;me.burst=0;
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
function useUtil(){if(C.hub||!me.alive||me.frozen||me.utilN<=0)return;const k=me.load[3];me.utilN--;buildSlots();
 if(k==='medkit'){send({t:'heal'});SFX.heal();center('+50 HP',700);return}
 throwT=.55;SFX.pin&&SFX.pin();startThrow(k,()=>{if(!me.alive)return;const f=fwd();const p=camera.position.clone().addScaledVector(f,.6);const v=f.clone().multiplyScalar(k==='molotov'?15:17);v.y+=4;v.add(_v.copy(me.vel).multiplyScalar(.5));
 spawnNade(me.id,k,p,v);send({t:'nade',k,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});SFX.throw();window.__throws=(window.__throws||0)+1})}
let throwT=0;
function fwd(){return new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion)}
function nearAim(cosr){const o=camera.position,d=fwd();for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=_v2.copy(q.rp);c.y+=1.25;const to=c.sub(o);const l=to.length();if(l>140)continue;to.divideScalar(l);
  if(1-to.dot(d)<cosr*cosr/2&&rayWorld(o,to,l)>=l-.5&&!smokeBlock(o,to,l))return true}return false}
// gentle aim magnetism while the player is actively looking (touch only): pulls toward the nearest visible enemy's chest within ~5°
function aimPull(dt){const o=camera.position,d=fwd();let best=null,bd=.09;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=_v2.copy(q.rp);c.y+=1.2;const to=c.sub(o);const l=to.length();if(l>60)continue;to.divideScalar(l);const a=Math.acos(Math.min(1,to.dot(d)));if(a<bd&&rayWorld(o,to,l)>=l-.5){bd=a;best=to.clone()}}
 if(!best)return;const ty=Math.atan2(-best.x,-best.z),tp=Math.asin(best.y);let dy=ty-me.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const k=Math.min(1,dt*3.2);me.yaw+=dy*k;me.pitch+=(tp-me.pitch)*k*.6}
function aimTarget(maxD){const o=camera.position,d=fwd();const wt=rayWorld(o,d,maxD);let best=null,bt=wt;
 for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&5);if(r.t<bt){bt=r.t;best=q}}if(best&&smokeBlock(o,d,bt))return null;return best}
let recoilP=0,recoilY=0,kick=0,meleeT=0,bob=0,stTimer=0,swayX=0,swayY=0,lastYaw=0,lastPitch=0;
function fire(){if(me.down)return;const id=me.load[me.cur],w=W[id];me.cool=w.rate;me.lastShot=performance.now();me.shots++;
 const o=camera.position.clone();
 if(w.melee){if(w.saw){SFX.saw();meleeT=Math.max(meleeT,.35)}else{SFX.melee();meleeT=1}const d=fwd();let best=null,bd=w.melee+.4,part='torso';for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;
   const c=q.rp.clone();c.y+=1.2;const to=c.clone().sub(o);const dist=to.length();if(dist>w.melee+.4)continue;if(to.normalize().dot(d)<.78)continue;if(!losClear(o,c))continue;
   const r=rayPlayer(o,d,q.rp,q.flags&5);if(dist<bd){bd=dist;best=q;part=r.part==='head'?'head':'torso'}}
  if(best){const head=part==='head';const dmg=head?w.head:w.body;if(w.bonk)SFX.bonk();if(w.saw)fx.spark(best.rp.clone().setY(best.rp.y+1.1),4,0xb01818,2,.25);SFX.mHit();send({t:'hit',id:best.id,dmg,head,w:id});showHit(best.rp.clone().setY(best.rp.y+1.5),dmg,head);fx.spark(best.rp.clone().setY(best.rp.y+1.2),6,0xff6a4d,3,.2)}return}
 if(w.proj){me.ammo[me.cur]--;SFX.gun(id,1,0);SFX.whoosh&&SFX.whoosh();kickImp(1.4,w);recoilP+=w.rc[0];muzzle.visible=true;muzzleT=.08;flashOn(1.4);if(vmInfo.cyc==='gl'){VA.cycD=VA.cyc=.35;VA.glFrom=VA.glRot}const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket&&me.ammo[me.cur]<=0)Gr.rocket.visible=false;for(let i=0;i<4;i++)fx.sprite({p:camera.position.clone().addScaledVector(fwd(),-.2).add(_v2.set((Math.random()-.5)*.6,-.1,(Math.random()-.5)*.6)),s0:.3,s1:1.4,life:.8,op:.4,color:0xdddddd,rise:.4});
  const f=fwd();const p=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());p.lerp(camera.position,.5).addScaledVector(f,.4);const v=f.clone().multiplyScalar(w.proj==='rpg'?44:30);if(w.proj==='gl')v.y+=2.5;
  spawnNade(me.id,id,p,v);send({t:'nade',k:id,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});return}
 me.ammo[me.cur]--;SFX.gun(id,1,0);if(me.ammo[me.cur]===0&&w.cls!=='fun'&&!w.melee)setTimeout(SFX.ping,60);heat=Math.min(12,heat+1);heatOff=0;kickImp(1,w);muzzle.visible=true;muzzleT=.045;muzzle.rotation.z=Math.random()*6;muzzle.scale.setScalar(.8+Math.random()*.5+(w.pellets?.45:0)+(vmInfo.pistol?-.2:0));muzzleVariant(w);if(SUPP[id]){muzzle.scale.multiplyScalar(.22);flashOn(.15)}else flashOn(w.pellets?1.3:(w.cls==='sniper'?1.5:vmInfo.pistol?.8:1));smokeWisp();afterShot(w);
 // recoil pattern: climbs vertically, sways side to side
 const ads=me.zoomT>.5;recoilP+=w.rc[0]*(ads?.65:1);recoilY+=Math.sin(me.shots*.9)*w.rc[1]*(ads?.6:1);
 if(!vmInfo.noShell&&!vmInfo.cyc)ejectShell();
 const hits={};const n=w.pellets||1;let spread=w.spread;if(w.cls==='sniper'){spread=me.zoomT>.85?(Math.hypot(me.vel.x,me.vel.z)>3?.012:0):.075+.03*(1-me.zoomT)}else if(w.cls==='marksman')spread*=me.zoomT>.8?.15:2.2;else spread*=ads?.45:1;if(!me.ground)spread*=1.5;else if(Math.hypot(me.vel.x,me.vel.z)>6)spread*=1.25;
 const mz=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());
 for(let i=0;i<n;i++){const d=fwd();d.x+=(Math.random()-.5)*2*spread;d.y+=(Math.random()-.5)*2*spread;d.z+=(Math.random()-.5)*2*spread;d.normalize();
  const wt=rayWorld(o,d,400);const wn=hitN.clone();const ws=hitS;let bt=wt,bq=null,bp=null;
  for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&5);if(r.t<bt){bt=r.t;bq=q;bp=r.part}}
  if(bq&&smokeBlock(o,d,bt)){bq=null;bt=wt}
  let wtt=wt;if(w.maxR&&bt>w.maxR){bq=null;bt=Math.min(bt,w.maxR);if(wtt>w.maxR)wtt=401}
  const end=o.clone().addScaledVector(d,Math.min(bt,400));if(w.paint&&(bq||wtt<400))paintSplat(end,wn,me.id);if(i<3){addTracer(mz,end,w.tracer);if(i===0)funFX(id,mz,end);if(i===0)send({t:'fx',a:mz.toArray().map(v=>+v.toFixed(2)),b:end.toArray().map(v=>+v.toFixed(2)),w:id})}
  if(bq){let dmg=(bp==='head'?w.head:w.body)*falloff(w,bt)*(bp==='legs'?LIMB:1);const h=hits[bq.id]||(hits[bq.id]={dmg:0,head:false,pos:end});h.dmg+=dmg;if(bp==='head')h.head=true;impact(end,wn,true)}
  else if(wtt<400)impact(end,wn,false,ws)}
 for(const k in hits){const h=hits[k];const dmg=Math.max(1,Math.round(h.dmg));send({t:'hit',id:k,dmg,head:h.head,w:id});showHit(h.pos,dmg,h.head)}
 if(me.ammo[me.cur]<=0)setTimeout(reload,180)}
let muzzleT=0;
// sticky ladders: attach on contact, climb with forward input regardless of look, hold position, mount onto the top smoothly
function freeAt(x,y,z){const q={x,y,z};for(const c of cols)if(overlaps(q,c,PH-.05))return false;return true}
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
 if(up&&me.pos.y>=top-.55){for(const d of[.75,1.0,.55,1.3,-.4,-.25]){const bx=me.pos.x-n[0]*(.4+d),bz=me.pos.z-n[1]*(.4+d);let gy=-1;for(const c of cols)if(bx>c.x0&&bx<c.x1&&bz>c.z0&&bz<c.z1&&c.y1<=top+.8&&c.y1>top-1.2&&c.y1>gy)gy=c.y1;if(gy<0)continue;if(!freeAt(bx,gy+.01,bz))continue;
   me.mountA=[me.pos.x,me.pos.y,me.pos.z];me.mountB=[bx,gy+.01,bz];me.mountD=me.mountT=.28;me.lad=null;me.onLadder=false;me.ladTop=null;inp.ladUp=false;return}}
}
function updateMe(dt){const id=me.load[me.cur],w=W[id];
 if(isTouch)applyTouchLook(dt);
 let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
 const sprint=(keys.ShiftLeft||keys.ShiftRight||inp.sprint)&&mz<-.3&&me.zoomT<.3&&!paused;
 if(!me.alive||me.frozen){mx=mz=0}
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 const myC=PCL[PROG.pc]||{};const speed=me.down?1.3:(sprint?8.6:5.8)*(myC.spd||1)*(me.zoomT>.5?.7:1)*(w.slowSelf||1)*(me.slowT>performance.now()?me.slowF:1);const hs=Math.hypot(me.vel.x,me.vel.z);me.slideCd-=dt;
 if(inp.slide&&me.alive&&!me.frozen&&me.ground&&me.slideT<=0&&me.slideCd<=0&&hs>3.5){const ns=Math.min(SLIDE.cap,Math.max(hs,6.5)*SLIDE.boost);me.vel.x=me.vel.x/hs*ns;me.vel.z=me.vel.z/hs*ns;me.slideT=SLIDE.max;me.slideAge=0;window.__slides=(window.__slides||0)+1;me.slideCd=9;SFX.slide()}
 inp.slide=false;
 // v41 slide: ~+50% burst; a tap lasts SLIDE.tap (0.7 s); holding C / the Slide button stretches it to SLIDE.max (1.6 s) with gradual decay; releasing after the tap window ends it. Cooldown starts when the slide ends.
 if(me.slideT>0){me.slideT-=dt;me.slideAge+=dt;const a=me.slideAge;const k=Math.max(0,1-(a<SLIDE.tap?1.25:.8)*dt);me.vel.x*=k;me.vel.z*=k;me.vel.x+=wx*dt*6;me.vel.z+=wz*dt*6;
  if(Math.hypot(me.vel.x,me.vel.z)<4||(a>=SLIDE.tap&&!inp.slideHold)||me.lad||me.mountT>0||(!me.ground&&a>=SLIDE.tap)||me.down)me.slideT=0;
  if(me.slideT<=0){me.slideT=0;me.slideCd=(myC.slideCd||1)*(.3+.5*Math.max(0,a-SLIDE.tap)/(SLIDE.max-SLIDE.tap));window.__slideLast=+a.toFixed(2)}}
 else if(me.slideCd>2)me.slideCd=(myC.slideCd||1)*.7;
 else if(me.ground){const a=Math.min(1,dt*13);me.vel.x+=(wx*speed-me.vel.x)*a;me.vel.z+=(wz*speed-me.vel.z)*a}
 else{me.vel.x+=wx*speed*dt*2.5;me.vel.z+=wz*speed*dt*2.5;const n=Math.hypot(me.vel.x,me.vel.z);const cap=Math.max(hs,speed);if(n>cap){me.vel.x*=cap/n;me.vel.z*=cap/n}}
 if(me.down){inp.jump=false;inp.slide=false}if(inp.jump&&me.ground&&me.alive&&!me.frozen){me.vel.y=(myC.jump||8.3);if(me.slideT>0){me.vel.x*=1.08;me.vel.z*=1.08;me.slideT=0}SFX.jump()}inp.jump=false;
 ladderMe(dt,mx,mz);if(me.mountT>0){me.mountT-=dt;const k=1-Math.max(0,me.mountT)/me.mountD;const a=me.mountA,b=me.mountB;me.pos.set(a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*Math.min(1,k*2),a[2]+(b[2]-a[2])*k);me.vel.set(0,0,0);if(me.mountT<=0){me.pos.set(b[0],b[1],b[2]);me.ground=true;me.lastG=[b[0],b[1],b[2]]}}
 if(me.alive&&!(me.mountT>0)){physStep(me,dt);if(me.landed){SFX.land();landDip=.08}}
 if(me.alive&&me.pos.y<-3){me.alive=false;send({t:'fall'})}
 if(me.ground&&hs>2&&me.slideT<=0){me.stepT-=dt*hs;if(me.stepT<=0){me.stepT=sprint?3.3:2.9;if(!myC.quiet||(me.qStep=!me.qStep))SFX.step()}}
 bob+=dt*hs*(me.ground&&me.slideT<=0?1.55:0);landDip=Math.max(0,landDip-dt*.4);
 me.camH+=((me.slideT>0?.95:1.62)-me.camH)*Math.min(1,dt*12);
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
 const scopeOn=isSn&&me.zoomT>.85;$('scope').classList.toggle('hidden',!scopeOn);$('cross').style.opacity=scopeOn?0:me.zoomT>.6?(vmCur&&vmCur.userData.optic?0:.55):1;$('cross').classList.toggle('ads',me.zoomT>.6&&!scopeOn);
 // scope sway (breathing figure-8), smaller for marksman optics; applied to the camera so the shot follows the reticle
 if(me.zoomT>.6&&(isSn||w.cls==='marksman')){swayT+=dt;const mv=Math.min(1,Math.hypot(me.vel.x,me.vel.z)/5);const a=(isSn?.0042:.002)*(1+mv*2.5)*Math.min(1,me.zoomT);
  camera.rotation.y+=Math.sin(swayT*1.05)*a;camera.rotation.x+=Math.sin(swayT*2.1)*a*.55;camera.updateMatrixWorld()}
 // weapon timers / reload stages
 me.cool-=dt;if(me.switchT>0)me.switchT-=dt;throwT=Math.max(0,throwT-dt);updThrow(dt);updSpoons(dt);meleeT=Math.max(0,meleeT-dt*3);muzzleT-=dt;if(muzzleT<=0)muzzle.visible=false;
 if(me.reloadT>0){const k=1-me.reloadT/reloadOf(id);const cs=VA.cues||[];while(VA.cue<cs.length&&k>=cs[VA.cue][0]){const[,snd,x]=cs[VA.cue++];SFX[snd]&&SFX[snd]();
   if(x==='ammo')me.ammo[me.cur]=Math.min(magOf(id),me.ammo[me.cur]+1);else if(x==='cylEject')for(let i=0;i<6;i++)setTimeout(()=>{if(vmCur)fx.shell(vmToWorld([0,.02,-.02],new THREE.Vector3()),_v.set((Math.random()-.5)*.6,-1.5,(Math.random()-.5)*.6).add(me.vel),'pistol')},i*25);
   else if(x==='hulls')for(let i=0;i<2;i++)fx.shell(vmToWorld([i?.012:-.012,.03,.02],new THREE.Vector3()),_v.set((Math.random()-.5),2.5,1.2).applyQuaternion(camera.quaternion).add(me.vel),'shot')}
  me.reloadT-=dt;if(me.reloadT<=0){me.ammo[me.cur]=magOf(id);if(['ar','smg','lmg'].includes(w.cls))SFX.charge();const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket)Gr.rocket.visible=true}}
 // action cycling (bolt / pump / lever / launcher cylinder) runs between shots
 if(VA.cyc>0){const p0=1-VA.cyc/VA.cycD;VA.cyc-=dt;const p1=1-Math.max(0,VA.cyc)/VA.cycD;const c=vmInfo.cyc;
  if(c==='bolt'){if(p0<.02&&p1>=.02)SFX.boltUp();if(p0<.2&&p1>=.2)SFX.boltBack();if(p0<.6&&p1>=.6)SFX.boltFwd()}
  else if(c==='pump'){if(p0<.05&&p1>=.05)SFX.pump()}else if(c==='lever'){if(p0<.05&&p1>=.05)SFX.lever()}
  if(!VA.ejected&&p1>=(c==='bolt'?.38:.35)&&c!=='gl'){VA.ejected=true;if(!vmInfo.noShell)ejectShell()}}
 VA.slide=Math.max(0,VA.slide-dt*14);if(vmInfo.spin&&vmCur){const Gc=vmCur.userData.G.cyl;VA.spin=Math.max(0,(VA.spin||0)-dt*1.2);if(performance.now()-me.lastShot<150)VA.spin=1;VA.spinA=((VA.spinA||0)+dt*VA.spin*40)%(Math.PI*2)}if(VA.inspect>0)VA.inspect-=dt;
 // auto-fire when crosshair is on an enemy (primary mobile control)
 const range=w.melee?w.melee:(w.pellets?32:250);const tgt=(me.alive&&!me.frozen)?aimTarget(range):null;$('cross').classList.toggle('on',!!tgt);
 let trigger=(tgt||inp.fire)&&!paused&&me.alive&&!me.frozen&&C.phase==='play';
 if(me.burst>0){me.burstT-=dt;if(me.burstT<=0&&me.ammo[me.cur]>0&&me.reloadT<=0){me.burst--;me.burstT=.06;fire();me.cool=w.rate}}
 else if(trigger&&!C.hub&&me.cool<=0&&me.switchT<=0&&me.reloadT<=0&&throwT<=0&&(w.melee||me.ammo[me.cur]>0)){if(w.burst){me.burst=w.burst-1;me.burstT=.06}fire()}
 if(!w.melee&&me.ammo[me.cur]<=0&&me.reloadT<=0&&me.alive){if(trigger)SFX.dry();reload()}
 updViewModel(dt,w,hs,sprint);
 stTimer+=dt;if(stTimer>=.05&&C.phase!=='lobby'&&me.alive){stTimer=0;send({t:'st',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(3),+me.pitch.toFixed(2),WIDX[me.load[me.cur]]|0,(me.slideT>0?1:0)|(me.ground?0:2)]})}
 updAmmo();$('timer').textContent=C.phase==='play'?(Math.floor(C.roundT/60)+':'+String(C.roundT%60).padStart(2,'0')):''}
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
 vmRoot.visible=me.alive&&!me.down&&!TH&&!(w.cls==='sniper'&&me.zoomT>.8);vmCam.fov=54;}
function deathCam(dt){const q=me.killer&&C.players[me.killer];// spectate teammate in team modes, else look at killer
 const mates=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!isEnemy(p));
 if(C.mode!=='ffa'&&mates.length&&C.phase==='play'){const t=mates[0];const back=_v.set(Math.sin(t.yaw),0,Math.cos(t.yaw)).multiplyScalar(3.2);camera.position.lerp(_v2.copy(t.rp).add(back).setY(t.rp.y+2.2),Math.min(1,dt*6));camera.lookAt(t.rp.x,t.rp.y+1.4,t.rp.z);return}
 camera.position.y+=((me.pos.y+.6)-camera.position.y)*Math.min(1,dt*3);if(q&&q.alive){const m=new THREE.Matrix4().lookAt(camera.position,_v.copy(q.rp).setY(q.rp.y+1.4),new THREE.Vector3(0,1,0));_q.setFromRotationMatrix(m);camera.quaternion.slerp(_q,Math.min(1,dt*3))}}
function updRemotes(dt){const a=Math.min(1,dt*14);for(const id in C.players){const q=C.players[id];if(!q.model)continue;const u=q.model.userData;
 if(!q.alive&&!u.dead){q.model.visible=false;continue}if(u.dead>3){q.model.visible=false;continue}q.model.visible=true;
 if(q.alive){if(q.rp.distanceTo(q.tp)>6)q.rp.copy(q.tp);else q.rp.lerp(q.tp,a);let dy=q.tyaw-q.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));q.yaw+=dy*a;q.pitch+=(q.tpitch-q.pitch)*a}
 const sp=Math.hypot(q.rp.x-q.lp.x,q.rp.z-q.lp.z)/Math.max(dt,.001);q.lp.copy(q.rp);q.spd=(q.spd||0)+(sp-(q.spd||0))*Math.min(1,dt*8);
 if(q.wid!=null)setRemoteGun(q,q.wid);q.model.position.copy(q.rp);q.model.rotation.y=q.yaw;{const dn=!!(q.flags&4);const cl=!dn&&!!inVol(ladders,q.rp,.15);animate(q.model,{speed:q.spd,air:!!(q.flags&2)&&!cl,slide:!!(q.flags&1)&&!dn,pitch:q.pitch,climb:cl,down:dn,slope:dn?downSlope(q):null,dist:camera.position.distanceTo(q.rp)},dt);q.model.rotation.x=0;downMark(q,dn)}}}
// ================= LOOP =================
renderer.autoClear=false;renderer.info.autoReset=false;
let last=performance.now(),acc=0,frames=0,fpsShown=0;const fpsLog=[];
function floorAt(p){return 0}
let lastHostTick=performance.now();function hostStep(){const n=performance.now();const dt=Math.min(.1,(n-lastHostTick)/1000);lastHostTick=n;if(isHost)hostTick(dt)}
// keep host simulation alive even when its tab/frame loop is throttled
setInterval(()=>{if(performance.now()-lastHostTick>120)hostStep()},50);
let slowWin=0;function loop(now){requestAnimationFrame(loop);const el=now-last;if(el<15.2)return;last=now;const dt=Math.min(.05,el/1000);tickSkins(now/1000);
 hostStep();
 if(inGame){updateMe(dt);updRemotes(dt);updTracers(dt);updNades(dt);updUtil(dt);updHub(dt,now);fx.update(dt,floorAt);listen();updHeat(dt);updFireLights(dt);updRings(dt);updAmb(dt,now/1000);updDmg(dt);if(cur&&cur.water&&cur.water.material.map)cur.water.material.map.offset.x+=dt*.01;WT.value=now/1000%1000;GRASS_T.value=now/1000%1000;updDust(dt,now/1000);
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
   c.name=String(m.name||'Player').slice(0,12);c.skin=SKINS[m.skin]?m.skin:'default';c.cl=clOf(m.cl);
   if(c.kind==='player'){this.send(c,{t:'hw',you:c.ord,n:this.n,players:this.players().filter(p=>p!==c).map(p=>[p.ord,p.name,p.skin,...[0,1,2,3].map(i=>(p.pos&&p.pos[i])||0),p.cl])});this.bc({t:'hj',p:[c.ord,c.name,c.skin,c.cl]},id);this.lastPads=''}
   else this.send(c,{t:'hw',you:c.ord,n:this.n});return}
  if(!c){if(conn&&conn.open)conn.send({t:'rehi'});else if(!conn)queueMicrotask(()=>hubRecv({t:'rehi'}));return}
  switch(m.t){
   case 'pos':if(Array.isArray(m.p))c.pos=m.p.slice(0,4).map(v=>+v||0);break;
   case 'eq':c.skin=SKINS[m.skin]?m.skin:c.skin;c.cl=clOf(m.cl||c.cl);c.name=String(m.name||c.name).slice(0,12);this.bc({t:'hj',p:[c.ord,c.name,c.skin,c.cl]},id);break;
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
  const fp=HUB_PADS.find(p=>p.single);if(fp){const F=st[fp.k].F;this.soloSeen=this.soloSeen||{};for(const id in this.soloSeen)if(!F.includes(id))delete this.soloSeen[id];
   // anyone stepping on the FFA pad while a hub solo/online FFA room is open joins it in progress
   const hr=this.roomList().find(r=>r.hubffa&&r.n<r.max&&r.phase!=='roundEnd');if(hr&&F.length){for(const id of F){const c=this.cl[id];if(c){c.busy=true;this.send(c,{t:'go',code:hr.code,map:-1,mode:'ffa',host:'',teams:{},expect:1,join:1});setTimeout(()=>{if(this.cl[id])this.cl[id].busy=false},8000)}}this.ffaEnd=0;this.lastPads=''}
   const n=F.length;if(n===1&&this.soloSeen[F[0]]){this.ffaEnd=0}else if(n<1)this.ffaEnd=0;else if(n===1){if(!this.ffaEnd)this.ffaEnd=now+10000}else{if(!this.ffaEnd||this.ffaN<2)this.ffaEnd=now+10000;else if(n>this.ffaN)this.ffaEnd=now+Math.max(this.ffaEnd-now,5000);if(n>=fp.n)this.ffaEnd=now}this.ffaN=n}
  const key=JSON.stringify(st)+'|'+this.ffaEnd;if(key!==this.lastPads){this.lastPads=key;const o={};for(const k in st){o[k]={};for(const s in st[k])o[k][s]=st[k][s].map(id=>this.cl[id].ord)}this.bc({t:'pads',q:o,ffa:this.ffaEnd?Math.max(0,this.ffaEnd-now):0})}
  for(const p of HUB_PADS){const s=st[p.k];if(p.single){if(this.ffaEnd&&now>=this.ffaEnd&&s.F.length>=2){this.ffaEnd=0;this.ffaN=0;this.startSel(p,s)}else if(this.ffaEnd&&now>=this.ffaEnd&&s.F.length===1){this.ffaEnd=0;const id=s.F[0];this.soloSeen[id]=1;const c=this.cl[id];if(c)this.send(c,{t:'solo'});this.lastPads=''}}else if(s.A.length>=p.n&&s.B.length>=p.n)this.startSel(p,s)}
  for(const k in this.sel)if(now>=this.sel[k].until)this.finish(this.sel[k]);
  // hub positions at 8 Hz, compact ints
  if(ps.length>1){const rows=ps.map(p=>[p.ord,Math.round(p.pos[0]*100),Math.round(p.pos[1]*100),Math.round(p.pos[2]*100),Math.round(p.pos[3]*100)]);for(const p of ps)this.send(p,{t:'hpos',p:rows.filter(r=>r[0]!==p.ord)})}}
 startSel(pad,s){const ids=[...(s.A||[]),...(s.B||[]),...(s.F||[])];if(!ids.length)return;for(const id of ids)this.cl[id].busy=true;
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
 case 'pads':myPads=m.q;window.__pads3=!!(m.q.ffa&&m.q.ffa.F&&m.q.ffa.F.length>=3);ffaEndAt=m.ffa?Date.now()+m.ffa:0;updPadLabels(true);break;
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
 for(const s of HUB_ST){const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex([s.name.split(' ')[0],s.name.split(' ').slice(1).join(' ')],'#'+new THREE.Color(s.col||0xffd23f).getHexString()),depthWrite:false,transparent:true}));spr.scale.set(3.6,1.35,1);spr.position.set(s.x+(s.k==='practice'?0:1.2),5.3,s.z);g.add(spr);
  if(s.npc){const m=makeCharacter(s.col,s.npc,'npc'+s.k,0xffffff,null,s.cls);m.position.set(s.x+.35,0,s.z);m.rotation.y=-Math.PI/2;g.add(m);hubVis.npcs.push({m,s,wave:0,near:false})}}
 scene.add(g);updPadLabels()}
function updNPCs(dt,now){if(!hubVis)return;const t=now/1000;for(const n of hubVis.npcs){const u=n.m.userData;const ps=[me.pos,...Object.values(C.players).filter(q=>q.rp).map(q=>q.rp)];let best=null,bd=7;for(const p of ps){const d=Math.hypot(p.x-n.m.position.x,p.z-n.m.position.z);if(d<bd){bd=d;best=p}}
  animate(n.m,{speed:0,pitch:0,dist:camera.position.distanceTo(n.m.position)},dt);
  const near=!!best;if(near&&!n.near)n.wave=1.6;n.near=near;
  if(best){const dx=best.x-n.m.position.x,dz=best.z-n.m.position.z;let a=Math.atan2(-dx,-dz)-n.m.rotation.y;a=Math.atan2(Math.sin(a),Math.cos(a));a=Math.max(-1,Math.min(1,a));u.head.rotation.y+=(a-u.head.rotation.y)*Math.min(1,dt*5);if(u.torso)u.torso.rotation.y=a*.3}else u.head.rotation.y*=.95;
  if(n.wave>0){n.wave-=dt;u.aim.rotation.x=-1.9+Math.sin(t*12)*.25;u.aim.rotation.z=Math.sin(t*12)*.15}else{u.aim.rotation.x+=(.55-u.aim.rotation.x)*Math.min(1,dt*4);u.aim.rotation.z*=.9}}}
let ffaEndAt=0,ffaSecs=-1;function ffaLeft(){return ffaEndAt?Math.max(0,Math.ceil((ffaEndAt-Date.now())/1000)):0}
function updPadLabels(){if(!hubVis)return;const fs=ffaLeft();for(const k in hubVis.labels){const L=hubVis.labels[k];const n=myPads&&myPads[L.p.k]?(myPads[L.p.k][L.c.side]||[]).length:0;const side=L.c.side==='A'?'BLUE':L.c.side==='B'?'RED':'FFA';const cd=L.p.single&&fs>0;
  const key=n+'|'+(cd?fs:'');if(L.k===key)continue;L.k=key;L.spr.material.map.dispose();L.spr.material.map=labelTex([MODES[L.p.k][0].split(' ')[0]+' '+side,cd?`${n}/${L.p.n}  ⏱ ${fs}`:`${n}/${L.p.n}`],L.col);L.spr.material.needsUpdate=true}
 let mine=null;if(myPads)for(const k in myPads)for(const s in myPads[k])if(myPads[k][s].includes(hubOrd))mine=[k,s];if(mine)lastPad=mine;
 const ffaCd=fs>0&&HUB_PADS.find(p=>p.single&&p.k===(mine&&mine[0]));$('padInfo').textContent=mine?(ffaCd?`FFA STARTS IN ${fs}… (${(myPads[mine[0]][mine[1]]||[]).length} players) — step off to leave`:`Queued: ${MODES[mine[0]][0]} · ${mine[1]==='A'?'BLUE':mine[1]==='B'?'RED':'FFA'} side — waiting for players… step off to leave`):'';$('padInfo').classList.toggle('cd',!!ffaCd)}
function updHub(dt,now){if(C.phase!=='hub')return;{const fs=ffaLeft();if(fs!==ffaSecs){if(fs>0&&ffaSecs!==-1&&myPads)SFX.beep(fs<=3?990:660);ffaSecs=fs;updPadLabels()}}hubPosT+=dt;if(hubPosT>=.125){hubPosT=0;hubSend({t:'pos',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(2)]})}
 if(hubVis){updNPCs(dt,now);for(const r of hubVis.rings){const inside=inPad(r.c,me.pos.x,me.pos.z);const n=myPads&&myPads[r.p.k]?(myPads[r.p.k][r.c.side]||[]).length:0;const fr=n/r.p.n;const rate=150+450*(1-fr);const pl=.5+.5*Math.sin(now/rate+r.c.x);
  r.em.opacity=.55+.45*pl;r.edge.scale.set(1+pl*.012*(1+fr),1+fr*1.5,1+pl*.012*(1+fr));r.fill.material.opacity=(inside?.3:.1)+fr*.25+pl*.06;
  if(r.pts){const pa=r.pts.geometry.attributes.position,sd=r.pts.userData.seed;for(let i=0;i<pa.count;i++){let y=((now/1000)*(.6+fr*1.2+sd[i]*.4)+sd[i]*3)%2.2;pa.array[i*3+1]=.1+y}pa.needsUpdate=true;r.pts.material.opacity=.5+fr*.5}}}
 let st=null,bd=3.2;for(const s of HUB_ST){const d=Math.hypot(me.pos.x-s.x,me.pos.z-s.z);if(d<bd){bd=d;st=s}}const b=$('stationBtn');if(st){b.textContent='TAP: '+st.name;b.dataset.k=st.k;b.classList.remove('hidden')}else b.classList.add('hidden');
 if(Math.random()<dt)updHubInfo()}
function useStation(k){if(k==='shop')openArsenal(null,'shop');else if(k==='upgrade')openArsenal(null,'upgrade');else if(k==='arsenal')openArsenal();else if(k==='classes')openClasses();else if(k==='chest')openChests();else if(k==='skins')openArsenal('skins');else if(k==='practice'){location.href=location.pathname+'?offline=1'+(/[?&]net=local/.test(location.search)?'&net=local':'')}}
$('stationBtn').onclick=()=>useStation($('stationBtn').dataset.k);
// ---------- map selection (5 s, majority wins, random tie-break on the hub host) ----------
let mapSelIv=null;
function openMapSel(m){hubSel={sid:m.sid,maps:m.maps,votes:[],mine:-1,end:performance.now()+m.ms,mode:m.mode,names:m.names};$('mapSel').classList.remove('hidden');SFX.kill();renderMapSel();
 clearInterval(mapSelIv);mapSelIv=setInterval(()=>{const left=Math.max(0,Math.ceil((hubSel.end-performance.now())/1000));$('mapSelT').textContent=left;if(left<=0)clearInterval(mapSelIv)},200);if(Object.keys(THUMB).length<MAPS.length)renderThumbs(()=>renderMapSel())}
function renderMapSel(){if(!hubSel)return;$('mapSelSub').textContent=`${MODES[hubSel.mode][0]} · ${hubSel.names.join(', ')}`;
 const tv=hubSel.votes.length;$('mapSelList').innerHTML=hubSel.maps.map(i=>{const v=hubSel.votes.filter(x=>x===i).length;const pct=tv?Math.round(v/tv*100):Math.round(100/hubSel.maps.length);return`<button class="map${hubSel.mine===i?' sel':''}" data-ms="${i}" style="${THUMB[i]?`background-image:url(${THUMB[i]})`:''}"><span class="vc">${pct}%${v?` · ${v}🗳️`:''}</span><span class="mn">${MAPS[i].icon} ${MAPS[i].name}<small>${MAPS[i].desc}</small></span></button>`}).join('')}
$('mapSelList').addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b||!hubSel)return;hubSel.mine=+b.dataset.ms;hubSend({t:'vote',sid:hubSel.sid,map:hubSel.mine});SFX.swap();renderMapSel()});
function startHubMatch(m){clearInterval(mapSelIv);$('mapSelT').textContent='GO';$('soloSel').classList.add('hidden');center(m.join?'Joining FFA in progress…':`${MAPS[m.map].icon} ${MAPS[m.map].name}\nStarting ${MODES[m.mode][0]}…`,3000);
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
 const ffa=C.mode==='ffa';$('endT').textContent=mine?'VICTORY':'DEFEAT';$('endScr').classList.toggle('win',!!mine);
 $('endScore').innerHTML=ffa?`<b>${esc(m.name)}</b> wins`:`<span class="a">${sc.A||0}</span> – <span class="b">${sc.B||0}</span>`;
 const ps=Object.values(C.players).map(q=>[q,C.sb[q.id]||{k:0,d:0,pts:0}]).sort((a,b)=>b[1].pts-a[1].pts);const mvp=ps[0];
 $('endStats').innerHTML=`<div><b>${s.k}</b><small>KILLS</small></div><div><b>${s.d}</b><small>DEATHS</small></div><div><b>${s.hs||0}</b><small>HEADSHOTS</small></div><div><b>💎 ${C.matchDia||0}</b><small>EARNED</small></div>`+(mvp?`<p>⭐ MVP: <b style="color:${hex(mvp[0].color)}">${esc(mvp[0].name)}</b></p>`:'');
 let t=16;const lb=$('endLobby');remWait=false;$('endAgain').disabled=false;$('endAgain').textContent='⚔️ REMATCH';lb.textContent=`LOBBY (${t})`;$('endScr').classList.remove('hidden');document.body.classList.add('endOn');if(document.pointerLockElement)document.exitPointerLock();
 endIv=setInterval(()=>{t--;lb.textContent=`LOBBY (${Math.max(0,t)})`;if(t<=0){clearInterval(endIv);endIv=null;if(isHost)hostDecide();else if(!remWait&&(C.fromHub||sessionStorage.getItem('hsz_fromHub'))){hideEnd();location.href=hubUrl()}}},1000)}
function endGo(again){
 if(isHost){if(again){if(!H.matchOver){hideEnd();return}hostRematch();return}
  hideEnd();H.rem=H.rem||{};H.rem[me.id]=0;if(H.matchOver){clearTimeout(H.remT);H.matchOver=false;clearTimeout(H.lobbyT);if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl();return}if(H.phase==='roundEnd'){H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}}return}
 if(again){remWait=true;send({t:'rem',v:1});$('endAgain').disabled=true;$('endAgain').textContent='⏳ WAITING FOR HOST…';return}
 send({t:'rem',v:0});hideEnd();if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl()}}
$('endAgain').onclick=()=>endGo(true);$('endLobby').onclick=()=>endGo(false);
function afterMatch(){if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl()}}
// ---------- public rooms: registry, browser, quick join ----------
let regIv=null;
function roomInfo(){return{code:roomCode,host:H.players[me.id]?.name||'Host',mode:H.mode,map:H.phase==='lobby'?'Voting':MAPS[H.map].name,n:plist().filter(p=>!p.bot).length,max:MODEMAX[H.mode]||10,phase:H.phase,hubffa:!!(H.auto&&H.auto.solo&&H.mode==='ffa')}}
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
addEventListener('keydown',e=>{if(e.code==='KeyE'&&C.phase==='hub'&&!$('stationBtn').classList.contains('hidden'))useStation($('stationBtn').dataset.k)});
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
  <button class="pill ${s&&s.join?'yellow':'poor'}" data-fr="join" ${s&&s.join?'':'disabled'}>${s&&s.join&&s.join.hub?'GO TO HUB':'JOIN'}</button><button class="pill red sm" data-fr="rm" title="Remove">✕</button></div>`}).join(''):'<p class="msg">No friends yet — share your code or add theirs.</p>');
 $('frInc').innerHTML=FR.inc.map(f=>`<div class="frRow" data-code="${f.code}"><div class="frWho"><b>${esc(f.name)}</b><small>${f.code}</small></div><span class="frSt">wants to be friends</span><button class="pill green" data-fr="acc">ACCEPT</button><button class="pill red sm" data-fr="dec">DECLINE</button></div>`).join('')+FR.out.map(f=>`<div class="frRow out" data-code="${f.code}"><div class="frWho"><b>${esc(f.name)}</b><small>${f.code}</small></div><span class="frSt">⏳ Pending${f.del?' · delivered':' · sends when they are online'}</span><button class="pill red sm" data-fr="rm">CANCEL</button></div>`).join('');
 $('frReqHead').classList.toggle('hidden',!FR.inc.length&&!FR.out.length)}
function updFrBadge(){const n=FR.inc.length;document.querySelectorAll('.frBadge').forEach(b=>{b.textContent=n||'';b.classList.toggle('hidden',!n)});const on=FR.list.filter(f=>frStat[f.code]).length;document.querySelectorAll('.frOnline').forEach(b=>b.textContent=FR.list.length?`${on}/${FR.list.length} online`:'Add friends by code')}
function openFriends(){audioInit&&audioInit();frOpen=true;$('friends').classList.remove('hidden');renderFriends();frMsg('');frPoll();frSchedule()}
function closeFriends(){frOpen=false;$('friends').classList.add('hidden');frSchedule()}
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.classList.add('out'),2600);setTimeout(()=>el.remove(),3200)}
$('frClose').onclick=closeFriends;$('frAddBtn').onclick=()=>{frAdd($('frIn').value);$('frIn').value=''};$('frIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('frAddBtn').click()});
$('frCopy').onclick=async()=>{try{await navigator.clipboard.writeText(FR.code);frMsg('Code copied!')}catch(e){frMsg('Your code: '+FR.code)}};
$('friends').addEventListener('click',e=>{const b=e.target.closest('[data-fr]');if(!b)return;const code=b.closest('[data-code]').dataset.code;const a=b.dataset.fr;if(a==='join')frJoin(code);else if(a==='rm')frRemove(code);else if(a==='acc')frAccept(code);else if(a==='dec')frDecline(code)});
for(const id of['openFriends','lobFriends','pFriends','hubFriends'])if($(id))$(id).onclick=openFriends;
addEventListener('storage',e=>{if(e.key===LSP+FRK)frReload()});
setTimeout(()=>{frServe();frSchedule();updFrBadge();if(FR.list.length||FR.out.length)setTimeout(frPoll,1500)},800);
window.__hsz={SFXT:SFX,PCL,openClasses,vmSkin:()=>{let k=null;if(vmCur)vmCur.traverse(o=>{if(o.material&&o.material.userData&&o.material.userData.skin)k=o.material.userData.skin});return k},vmId:()=>me.load[me.cur],FRIENDS:()=>({frPeerOpen:!!(frPeer&&frPeer.open),FR,frStat,myStatus:myStatus(),frPoll,frAdd,frAccept,frRemove,frJoin}),inp,PROG,shootAt:(pid,hy)=>{const q=(H&&H.players[pid])||C.players[pid];if(!q||!me.alive)return 'na';let p=(q.e&&q.e.pos)||q.pos;if(Array.isArray(p))p={x:p[0],y:p[1],z:p[2]};if(!p&&q.p)p={x:q.p[0],y:q.p[1],z:q.p[2]};if(!p||!isFinite(p.x))return 'nopos';const e=new THREE.Vector3(me.pos.x,me.pos.y+1.62,me.pos.z);const dx=p.x-e.x,dy=(p.y+(hy||1.3))-e.y,dz=p.z-e.z;me.yaw=Math.atan2(-dx,-dz);me.pitch=Math.atan2(dy,Math.hypot(dx,dz));camera.position.copy(e);camera.rotation.set(me.pitch,me.yaw,0,'YXZ');camera.updateMatrixWorld();me.cool=0;fire();return 'ok'},gunGroup,THREE,endGo:(a)=>endGo(a),damage:(...a)=>damage(...a),VA,reload,setViewModel,get vmCur(){return vmCur},fireTest:(id)=>{const o=window.__spy;const realSend=send;setViewModel(id);camera.position.set(me.pos.x,me.pos.y+1.62,me.pos.z);camera.rotation.set(me.pitch,me.yaw,0);camera.updateMatrixWorld();__spyOn=o;try{fire()}finally{__spyOn=null}},C,H,me,send,W,MAPS,buildMap,fpsLog,renderer,get isHost(){return isHost},get cols(){return cols},setCols:(c)=>{cols=c},roundSpawns,respawnPoint,switchTo,fire,useUtil,setLoad:(l)=>{me.load=l},toggleZoom,camera,get paused(){return paused},get qLevel(){return qLevel()},S,applyQuality,get cur(){return cur}};
window.__hsz.useUtil=useUtil;window.__hsz.damage=(v,d,by,h,w)=>damage(v,d,by,h,w);window.__hsz.scene=scene;window.__hsz.ffaLeft=()=>ffaLeft();window.__hsz.FXT={SFX,VOX:()=>VOX,AC:()=>AC&&AC.state,explosionFX,utilFX,impact,funFX,nearMiss,fire:()=>fire(),muzzle,fires:()=>fires.length,smokes:()=>smokes.length,flash:()=>flashAmt,setVerb,outdoor:()=>outdoor,vol:()=>mVol&&mVol.gain.value,FL:()=>FL.length,spawnNade};window.__hsz.throwSt=()=>({th:!!TH,t:TH&&TH.t,nades:nades.length,spoons:spoons.length,pin:!!(TH&&TH.G.pin),throws:window.__throws||0});

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
 if(!skipA)loadAssets((f)=>{fa=f;upd()}).then(ok=>{fin();window.__assets={ok,ms:Math.round(performance.now()-t0),ready:HQP.ready};for(const k in envCache)delete envCache[k];if(HQP.ready){const ids=rebuildForProps();window.__propSwap=ids;if(cur&&!C.hub&&ids.includes(C.map)){const nm=buildMap(C.map);scene.remove(cur.group);scene.add(nm.group);cur.group=nm.group;cur.hqProps=true;window.__propSwapLive=1}}if(cur)applyQuality()})},+(new URLSearchParams(location.search).get('assetdelay')||400));
$('openCredits').onclick=()=>$('credits').classList.remove('hidden');$('credClose').onclick=()=>$('credits').classList.add('hidden');

// ---- solo on the hub FFA pad: choose online (public, bots, friends/pad can join) or offline bots ----
function openSolo(){if(!C.hub)return;SFX.beep(880);$('soloSel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock()}
$('soloOn').onclick=()=>{$('soloSel').classList.add('hidden');startHubMatch({code:genCode(),map:Math.random()*5|0,mode:'ffa',teams:{},expect:1,solo:1,host:hubSelfId})};
$('soloOff').onclick=()=>{$('soloSel').classList.add('hidden');hubUnlink();leaveHubWorld();C.fromHub=true;sessionStorage.setItem('hsz_fromHub','1');startOffline();H.mode='ffa';H.auto={mode:'ffa',map:Math.random()*5|0,expect:1,fromHub:1};H.autoAt=H.t+.5;sendLobby()};
$('soloX').onclick=()=>$('soloSel').classList.add('hidden');
Object.defineProperty(window.__hsz,'room',{get:()=>({code:roomCode,inGame,offline:!!(H&&H.offline),pub:!!(H&&H.pub),host:isHost})});

// ---- Play Online with Bots (menu + hub): host a public, bot-filled match; joiners replace a bot (team modes: on the team that needs them) ----
// setup state is remembered; every open rebuilds the whole screen from scratch so nothing can be left over from an earlier game
const POB_MODES=['ffa','team','t3','t4','t5','duel'];let POB={mode:'team',map:-1,diff:'normal',pub:true},pobBusy=false;
try{const s=JSON.parse(LS('pob')||'null');if(s)POB=Object.assign(POB,s)}catch(e){}
function pobSum(){const mp=POB.map<0?'🎲 random map':MAPS[POB.map].icon+' '+MAPS[POB.map].name;$('pobSum').textContent=`${MODES[POB.mode][1]} ${MODES[POB.mode][0]} · ${mp} · bots ${POB.diff.toUpperCase()} · ${POB.pub?'🌐 public':'🔒 private (join by code)'}`}
function renderPob(){if(!MODES[POB.mode])POB.mode='team';if(POB.map>=MAPS.length)POB.map=-1;
 $('pobModes').innerHTML=POB_MODES.filter(k=>MODES[k]).map(k=>`<button data-pm="${k}" class="${POB.mode===k?'sel':''}">${MODES[k][1]} ${MODES[k][0]}</button>`).join('');
 $('pobMaps').innerHTML=`<button data-pmap="-1" class="${POB.map<0?'sel':''}">🎲 Random</button>`+MAPS.map((m,i)=>`<button data-pmap="${i}" class="${POB.map===i?'sel':''}" style="${THUMB[i]?`background-image:linear-gradient(#0006,#000a),url(${THUMB[i]})`:''}">${m.icon} ${m.name}</button>`).join('');
 $('pobDiff').innerHTML=['easy','normal','hard'].map(d=>`<button data-pd="${d}" class="${POB.diff===d?'sel':''}">${d.toUpperCase()}</button>`).join('');
 $('pobPub').innerHTML=`<button data-pp="1" class="${POB.pub?'sel':''}">🌐 PUBLIC</button><button data-pp="0" class="${POB.pub?'':'sel'}">🔒 PRIVATE</button>`;pobSum();$('pobGo').disabled=false}
function openPob(){audioInit();pobBusy=false;renderPob();$('pobSel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();if(Object.keys(THUMB).length<MAPS.length&&!C.hub)setTimeout(()=>{if(!$('pobSel').classList.contains('hidden'))renderThumbs(()=>renderPob())},300)}
function closePob(){$('pobSel').classList.add('hidden')}
function playOnlineBots(mode,opts){if(pobBusy)return;pobBusy=true;closePob();if(mode)POB.mode=mode;if(opts)Object.assign(POB,opts);LSS('pob',JSON.stringify(POB));
 const map=POB.map<0?Math.random()*MAPS.length|0:POB.map;const auto={mode:POB.mode,map,diff:POB.diff,pub:POB.pub,teams:{},expect:1,solo:1};const code=genCode();window.__lastPob={...auto,code};
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
 loot:{common:[['dia',80,4],['dia',120,3],['wsk','carbon',2],['wsk','tiger',2],['wpn','water',1],['wpn','bat',1]],
  rare:[['dia',200,3],['wsk','ice',2],['wsk','toxic',2],['wsk','neon',2],['wpn','m4',1],['wpn','mp5',1],['wpn','ump45',1],['wpn','pan',1],['cls','scout',1]],
  epic:[['dia',350,2],['wsk','gold',2],['wsk','lightning',1],['wpn','ak47',1],['wpn','scar',1],['wpn','kriss',1],['wpn','p90',1],['wpn','deagle',1],['cls','engineer',1],['cls','ninja',1]],
  legendary:[['dia',600,2],['wsk','lightning',2],['wsk','fire',2],['wpn','aa12',1],['wpn','lmg',1],['wpn','freeze',1],['wpn','laser',1],['wpn','barrett',1],['wpn','chainsaw',1],['cls','medic',2]],
  secret:[['dia',1200,1],['wsk','galaxy',3],['wsk','fire',2],['wsk','lightning',2],['cls','juggernaut',3],['wpn','minigun',1.5],['wpn','awp',1.5],['wpn','rpg',1.5],['wpn','gl',1.5]]},
 dupe:{common:40,rare:90,epic:160,legendary:280,secret:500}};
function chestTier(r=Math.random()){let a=0;for(const t of CHEST.tiers){a+=t[3]/100;if(r<a)return t[0]}return 'common'}
function chestPick(tier,r=Math.random()){const L=CHEST.loot[tier];const tot=L.reduce((s,x)=>s+x[2],0);let a=0;for(const x of L){a+=x[2]/tot;if(r<a)return x}return L[L.length-1]}
const ownedWeapons=()=>Object.keys(W).filter(id=>W[id].cls!=='util'&&owns(id));
// apply one loot item to the shared wallet (PROG, same save offline + online); returns a description
function chestGrant(tier,it){const [ty,v]=it;let dup=false,name='',icon='💎',dia=0;
 if(ty==='dia'){dia=v;name=v+' Diamonds'}
 else if(ty==='wpn'){if(!W[v]){dia=CHEST.dupe[tier];name='Bonus'}else{name=W[v].name;icon='🔫';if(owns(v))dup=true;else PROG.owned.push(v)}}
 else if(ty==='cls'){name=PCL[v].n+' class';icon=PCL[v].ic||'🎭';if(PROG.pcs.includes(v))dup=true;else PROG.pcs.push(v)}
 else if(ty==='wsk'){const sk=WSKINS[v];name=(sk?sk[0]:v)+' skin';icon='🎨';const cand=ownedWeapons().filter(id=>!(PROG.wskins[id]||[]).includes(v));
  const pref=cand.includes(me.load[0])?me.load[0]:cand[Math.floor(Math.random()*cand.length)];if(!pref)dup=true;else{(PROG.wskins[pref]=PROG.wskins[pref]||[]).push(v);name+=' · '+W[pref].name;it.w=pref}}
 if(dup)dia=CHEST.dupe[tier];PROG.dia+=dia;(PROG.chestLog=PROG.chestLog||[]).push([tier,ty,v,dup?1:0,Date.now()]);if(PROG.chestLog.length>50)PROG.chestLog.shift();saveProg();
 return {tier,ty,v,name,icon,dup,dia}}
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
 $('chOdds').innerHTML=CHEST.tiers.map(t=>`<div class="odd" style="--c:${t[2]}"><i></i><b>${t[1]}</b><span>${t[3]}%</span><small>${CHEST.loot[t[0]].filter(x=>x[0]!=='dia').slice(0,4).map(x=>x[0]==='wpn'?W[x[1]]?.name:x[0]==='cls'?PCL[x[1]].n:(WSKINS[x[1]]||[x[1]])[0]).join(' · ')}…</small></div>`).join('')+`<p class="msg">Odds total ${tot}%. Duplicates turn into diamonds. Diamonds only — no real money.</p>`;
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
