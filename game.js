// HeadShotz – free browser multiplayer FPS. Three.js + PeerJS (host-authoritative star).
import {THREE,FX,TX,MC,G,mergeParts,GQ,texMat,swapMats,WT,GRASS_T,scatterGrass,makeSky,RET,GLASS,camoTex} from './gfx.js';
import {Post} from './post.js';
import {TURN} from './ice.js';
import {MAPS,buildMap,HUB_PADS,HUB_ST,HUB_I,padCircles} from './maps.js';
import {W,CLASSES,LIMB,falloff,stats,gunParts,handParts} from './weapons.js';
import {makeCharacter,animate} from './chars.js';
const $=id=>document.getElementById(id);
const GAME='HeadShotz';
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const MODES={duel:['1v1 Duel','⚔️'],team:['2v2 Teams','👥'],t3:['3v3 Teams','🛡️'],t4:['4v4 Teams','🚩'],t5:['5v5 Teams','🏰'],ffa:['Free-For-All','💥']};
const MODEMAX={duel:2,team:4,t3:6,t4:8,t5:10,ffa:10},MAXP=10;const isTeamMode=m=>m!=='ffa'&&m!=='duel';
// down-and-revive (team modes): bleed-out 20 s, downed HP pool 50, revive = stand within 1.5 m for 5 s (progress resets if the reviver leaves), revived with 30 HP
const DOWN={bleed:20,hp:50,r:1.5,revive:5,revHp:30};
const DIFF={easy:{hit:.22,react:.9,turn:3.5,head:.06},normal:{hit:.4,react:.6,turn:6,head:.14},hard:{hit:.58,react:.35,turn:9,head:.24}};
const WIN_ROUNDS=5,FFA_ROUND_KILLS=3;
const TEAMCOL={A:0x3fa9ff,B:0xff5a6b};
const FFACOL=[0x3fa9ff,0xff5a6b,0x2ee59d,0xffd23f,0xb06bff,0xff9f43,0x1dd1a1,0xff79c6,0xf8f8f8,0x8d6e63];
const hex=c=>'#'+new THREE.Color(c).getHexString();
const LS=k=>{try{return localStorage.getItem('hsz_'+k)}catch(e){return null}},LSS=(k,v)=>{try{localStorage.setItem('hsz_'+k,v)}catch(e){}};
// ---------------- settings ----------------
const S=Object.assign({sens:1,zsens:1,aimAssist:true,quality:'auto'},JSON.parse(LS('settings')||'{}'));
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
 const sk=d.indoor?makeSky(0x6b7a8c,0x3b4656,0x262b33,null,0xffffff,{clouds:false}):makeSky(d.sky[0],d.sky[1],d.sky[2],cur.sunDir,d.sun[0],{clouds:false});sc.add(sk);
 const gnd=new THREE.Mesh(new THREE.CircleGeometry(300,24),new THREE.MeshBasicMaterial({color:new THREE.Color(d.hemi[1]).multiplyScalar(.6)}));gnd.rotation.x=-Math.PI/2;gnd.position.y=-6;sc.add(gnd);
 if(d.indoor)for(let k=0;k<6;k++){const p=new THREE.Mesh(new THREE.PlaneGeometry(6,1.2),new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3)}));p.rotation.x=Math.PI/2;p.position.set((k%3-1)*8,6,k<3?-4:4);sc.add(p)}
 return envCache[i]=pmrem.fromScene(sc,.02).texture}
const fx=new FX(scene);
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
 const el=document.elementFromPoint(e.clientX,e.clientY);const b=el&&el.closest(TAPSEL);if(b!==d.b||b.disabled)return;b.__tap=performance.now();tapSynth=true;try{b.click()}finally{tapSynth=false}},true);
document.addEventListener('pointercancel',e=>{if(tapDown&&e.pointerId===tapDown.id)tapDown=null},true);
document.addEventListener('click',e=>{if(tapSynth)return;const b=e.target.closest&&e.target.closest(TAPSEL);if(b&&b.__tap&&performance.now()-b.__tap<800){e.stopPropagation();e.preventDefault()}},true);
let lastTouchEnd=0;document.addEventListener('touchend',e=>{const n=Date.now();if(inGame&&n-lastTouchEnd<300&&!e.target.closest('button,input'))e.preventDefault();lastTouchEnd=n},{passive:false});
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
if(isIOS&&!standalone)$('iosTip').classList.remove('hidden');
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
// ---------------- audio ----------------
let AC=null,noiseBuf=null,master=null,verb=null;
function audioInit(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();
 noiseBuf=AC.createBuffer(1,AC.sampleRate*.6,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 master=AC.createGain();master.gain.value=.8;const comp=AC.createDynamicsCompressor();master.connect(comp);comp.connect(AC.destination);
 // cheap "room" tail: feedback delay
 const dl=AC.createDelay(.5);dl.delayTime.value=.09;const fb=AC.createGain();fb.gain.value=.28;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1600;
 verb=AC.createGain();verb.gain.value=.35;verb.connect(dl);dl.connect(lp);lp.connect(fb);fb.connect(dl);lp.connect(master)}catch(e){}}
function out(pan){if(!AC)return null;let n=master;if(pan&&AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));p.connect(master);n=p}return n}
function env(node,vol,dur,dest,att=.002){const g=AC.createGain();const t=AC.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+att);g.gain.exponentialRampToValueAtTime(.0008,t+dur);node.connect(g);g.connect(dest);return g}
function noise(type,freq,q,dur,vol,dest,wet=0,att){if(!AC)return;const s=AC.createBufferSource();s.buffer=noiseBuf;s.playbackRate.value=.8+Math.random()*.4;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;s.connect(f);
 const g=env(f,vol,dur,dest,att);if(wet&&verb){const w=AC.createGain();w.gain.value=wet;g.connect(w);w.connect(verb)}s.start();s.stop(AC.currentTime+dur+.05)}
function tone(freq,dur,vol,type,slide,dest,att){if(!AC)return;const o=AC.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(freq,AC.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(slide,AC.currentTime+dur);env(o,vol,dur,dest,att);o.start();o.stop(AC.currentTime+dur+.05)}
const SFX={
 // layered gunshot: punch (body thump) + crack (supersonic snap) + mechanical (action clack) + tail (room/outdoor decay).
 // dist>0 = someone else's shot: high frequencies roll off, mechanics vanish, tail delayed slightly (speed of sound feel)
 gun(id,vol=1,pan=0,dist=0){const w=W[id];if(!AC||!w)return;const s=w.snd||{f:1500,d:.1,b:120,v:.5};let d=out(pan);const v=s.v*vol;
  if(s.pop){tone(s.b*2.2,.05,v,'sine',s.b,d,.001);noise('bandpass',s.f*2,2,.05,v*.7,d,.2,.001);return}
  if(s.zap){tone(s.f,.09,v*.7,'sawtooth',s.f*.25,d,.001);tone(s.f*1.5,.06,v*.4,'square',s.f*.5,d,.001);noise('highpass',5000,1,.04,v*.3,d,.2,.001);return}
  if(dist>4){const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.max(700,9000-dist*95);lp.connect(d);d=lp}
  const big=w.cls==='sniper'||w.pellets||w.cls==='lmg'||w.proj,pis=w.cls==='pistol';
  tone(s.b*1.6,.07,v*1.1,'sine',s.b*.35,d,.001);noise('lowpass',s.f*.55,.9,s.d*.7,v*1.05,d,.25,.001);
  noise('bandpass',s.f*1.7,1.1,Math.min(.05,s.d*.45),v*(dist>30?.35:.85),d,.15,.0008);
  if(s.crack||w.cls==='sniper'||w.cls==='marksman')noise('highpass',3800,.8,.045,v*.75,d,.2,.0005);
  if(!dist||dist<8){setTimeout(()=>{noise('bandpass',pis?3400:2600,6,.025,v*.22,d);tone(pis?1800:1300,.02,v*.08,'square',0,d)},12+Math.random()*10)}
  const tl=(big?.55:.32)+s.d,del=dist>15?Math.min(.12,dist/340*.5):0;const tail=()=>noise('lowpass',big?700:1100,.6,tl,v*(dist?.55:.38),d,.9,.01);del?setTimeout(tail,del*1000):tail();
  if(w.pellets)noise('lowpass',480,.5,s.d*1.6,v*.6,d,.5)},
 dry(){tone(2400,.015,.12,'square',0,out());noise('bandpass',3000,6,.02,.12,out())},
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
 head(){tone(1700,.07,.22,'square',0,out());setTimeout(()=>tone(2600,.1,.2,'triangle',0,out()),45)},
 hurt(){tone(180,.18,.25,'sawtooth',90,out());noise('lowpass',400,.5,.12,.2,out())},
 step(){noise('lowpass',260+Math.random()*120,.8,.06,.14,out())},land(){noise('lowpass',200,.8,.1,.25,out())},
 jump(){noise('lowpass',500,.6,.08,.12,out())},slide(){noise('bandpass',1500,.5,.4,.12,out(),0,.05)},
 magOut(){SFX.click(2300,.14);setTimeout(()=>noise('bandpass',900,2,.06,.12,out()),60)},magIn(){noise('bandpass',1500,3,.05,.15,out());setTimeout(()=>{SFX.click(1300,.26);noise('lowpass',600,1,.04,.15,out())},70)},
 bolt(){noise('bandpass',3000,3,.05,.2,out());setTimeout(()=>noise('bandpass',2200,3,.06,.2,out()),110)},
 shell(t){const sh=t==='shot';setTimeout(()=>{sh?noise('bandpass',700,2,.06,.05,out()):tone((t==='pistol'?6200:5200)+Math.random()*1500,.06,.03,'sine',0,out())},380+Math.random()*200)},
 swap(){noise('bandpass',2000,2,.06,.12,out())},
 boom(vol=1,pan=0){const d=out(pan);noise('lowpass',380,.6,1,.9*vol,d,.7);tone(70,.8,.7*vol,'sine',28,d);noise('bandpass',1500,.8,.25,.4*vol,d,.5)},
 bang(vol=1){const d=out();noise('highpass',1200,.5,.4,.9*vol,d,.6);tone(3600,2.5*vol,.06*vol,'sine',3400,d)},
 whoosh(){noise('bandpass',700,.6,.6,.35,out(),.3,.05)},hiss(){noise('highpass',2500,.5,1.5,.12,out(),0,.2)},
 kill(){tone(660,.09,.2,'triangle',0,out());setTimeout(()=>tone(990,.14,.2,'triangle',0,out()),90)},
 beep(f=700){tone(f,.12,.18,'sine',0,out())},heal(){tone(500,.25,.2,'sine',1000,out())},throw(){noise('bandpass',600,.8,.18,.2,out(),0,.03)}};
// ---------------- map / collision ----------------
let cur=null,cols=[],groundHalf=[1e9,1e9],ladders=[],hides=[];
const inVol=(L,p,pad=0)=>{for(const v of L)if(p.x>v.x0-pad&&p.x<v.x1+pad&&p.z>v.z0-pad&&p.z<v.z1+pad&&p.y>v.y0&&p.y<v.y1)return v;return null};
function loadMap(i){qGrace=performance.now()+5000;if(cur){scene.remove(cur.group);if(cur.sky)scene.remove(cur.sky)}cur=buildMap(i);cols=cur.cols;groundHalf=cur.groundHalf;ladders=cur.ladders||[];hides=cur.hides||[];
 scene.add(cur.group);if(cur.sky)scene.add(cur.sky);const d=cur.def;
 scene.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);scene.fog=new THREE.Fog(d.fog[0],d.fog[1],d.fog[2]);
 hemi.color.set(d.hemi[0]);hemi.groundColor.set(d.hemi[1]);hemi.intensity=d.hemi[2];sun.color.set(d.sun[0]);sun.intensity=d.sun[1];sun.position.copy(cur.sunDir).multiplyScalar(50);
 fx.dec.count=0;fx.decI=0;fx.scor.count=0;fx.scorI=0;smokes.length=0;fires.length=0;applyQuality()}
function applyQuality(){const lvl=qLevel();GQ.level=lvl;const hi=lvl!=='low';qGrace=performance.now()+4500;
 const shOn=lvl==='high'&&!(cur&&cur.def.indoor);renderer.shadowMap.enabled=shOn;sun.castShadow=shOn;renderer.shadowMap.needsUpdate=true;
 swapMats(scene);resetVMs();document.body.dataset.q=lvl;
 if(cur){const d=cur.def;const env=hi?envFor(cur.def.name):null;scene.environment=env;vmScene.environment=lvl!=='low'?envFor(cur.def.name):null;
  hemi.intensity=d.hemi[2]*(hi?.62:1);vmHemi.color.set(d.hemi[0]);vmHemi.groundColor.set(d.hemi[1]);vmHemi.intensity=d.hemi[2]*(lvl!=='low'?.75:.9);vmSun.color.set(d.sun[0]);vmSun.intensity=d.sun[1]*.95;vmFill.intensity=lvl!=='low'?.9:.4;
  if(cur.water)cur.water.material=hi?cur.water.userData.hi:cur.water.userData.lo;
  // grass (built once per map per density)
  const want=lvl==='high'?1:lvl==='medium'?.5:0;if(cur.grassK!==want){if(cur.grassMesh){for(const gm of cur.grassMesh)cur.group.remove(gm)}cur.grassMesh=[];cur.grassK=want;
   if(want)for(const gd of cur.grassDefs){const gm=scatterGrass(cur.group,cur.cols,{...gd,count:Math.round(gd.count*want)});if(gm){gm.castShadow=false;cur.group.add(gm);cur.grassMesh.push(gm)}}}
  for(const o of cur.group.children)if(o.material&&o.material.map===TX.shadow)o.material.opacity=(d.indoor?.35:.5)*(lvl==='high'?.55:1);
  if(lvl==='high'){if(!post)post=new Post(renderer);post.grade(d.grade,1.0)}}
 dust.visible=lvl==='high'&&!!cur;pixelRatio=basePR();renderer.setPixelRatio(pixelRatio);resize()}
// ambient dust motes (high)
const DN=260,dustPos=new Float32Array(DN*3);for(let i=0;i<DN*3;i++)dustPos[i]=(Math.random()-.5)*24;
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({size:.045,map:TX.soft,color:0xfff1d6,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));dust.frustumCulled=false;dust.visible=false;scene.add(dust);
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
 for(const c of cols){if(!overlaps(p,c,PH))continue;if(v.y<=0&&p.y>c.y1-.6){p.y=c.y1;e.ground=true}else if(v.y>0&&e.ladTop!=null&&c.y1<=e.ladTop+.7){p.y=c.y1;e.ground=true}else if(v.y>0){const ny=c.y0-PH-.001;if(ny>=py0-.05)p.y=ny;else p.y=Math.max(py0,c.y1)}v.y=Math.min(0,v.y)}
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
const SURF={metal:'metal',hazard:'metal',window:'metal',planks:'wood',crate:'wood',wood:'wood',leaves:'wood',grass:'dirt',sand:'dirt',rock:'concrete',water:'water',carpet:'soft'};
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
function gunGroup(id,o={}){if(o===true)o={hands:true};const{hands=false,sleeve,lod=0,lit=false}=o;const{parts,info}=gunParts(id,lod);const g=new THREE.Group();const Gp={};
 const all=hands?parts.concat(handParts(info,sleeve)):parts;const B={};for(const pt of all){const k=(pt.grp||'')+'|'+pt.mat;(B[k]||(B[k]=[])).push(pt)}
 for(const k in B){const[grp,mat]=k.split('|');let holder=g;
  if(grp){if(!Gp[grp]){const pv=new THREE.Group();pv.position.set(...((info.piv&&info.piv[grp])||[0,0,0]));pv.userData.base=pv.position.clone();g.add(pv);Gp[grp]=pv}holder=Gp[grp]}
  const off=holder===g?null:holder.position;
  if(mat==='ret'||mat==='glass'){for(const pt of B[k]){const geo=bakePart(pt);if(off)geo.translate(-off.x,-off.y,-off.z);const m=new THREE.Mesh(geo,mat==='ret'?RET[pt.ret||'dot']:GLASS);m.renderOrder=mat==='ret'?3:2;m.userData.fx=1;holder.add(m)}continue}
  const geo=mergeParts(B[k],{uv:true});if(off)geo.translate(-off.x,-off.y,-off.z);const tm=TMAP[mat]||'gunPoly';
  const mesh=new THREE.Mesh(geo,lit?texMat(tm):o.icon?ICM[SHINY[mat]?1:0]:(SHINY[mat]?MC.metal:MC.matte));mesh.userData.tm=lit?tm:null;mesh.userData.mk=mat;if(mat==='glove'||mat==='sleeve')mesh.userData.hand=1;holder.add(mesh)}
 if(Gp.mag){const bb=new THREE.Box3();Gp.mag.updateMatrixWorld(true);for(const c of Gp.mag.children)if(c.geometry){c.geometry.computeBoundingBox();bb.union(c.geometry.boundingBox)}Gp.mag.userData.c=bb.isEmpty()?new THREE.Vector3():bb.getCenter(new THREE.Vector3()).add(Gp.mag.position)}
 g.userData.info=info;g.userData.G=Gp;g.userData.optic=parts.some(p=>p.mat==='ret');return g}
const ICON={};
function fitCam(obj,cam,side=true,pad=1.15){const bb=new THREE.Box3().setFromObject(obj);const c=bb.getCenter(new THREE.Vector3()),s=bb.getSize(new THREE.Vector3());
 const r=Math.max(s.z/cam.aspect,s.y,s.x*.6)*pad;const dist=r/(2*Math.tan(cam.fov*Math.PI/360));if(side){cam.position.set(c.x+dist,c.y+dist*.12,c.z+dist*.06)}else cam.position.set(c.x+dist*.85,c.y+dist*.35,c.z+dist*.5);cam.lookAt(c)}
function renderIcons(){const R=r2();R.setSize(192,96);prevCam.aspect=2;prevCam.updateProjectionMatrix();
 for(const id in W){const g=gunGroup(id,{icon:true});if(id==='fists'){const{info}=gunParts('fists');const hp=handParts(info);g.add(new THREE.Mesh(mergeParts(hp),ICM[0]));g.rotation.y=-Math.PI/2}
  if(W[id].cls==='util')g.scale.setScalar(2.2);prevScene.add(g);fitCam(g,prevCam,true,W[id].cls==='util'?1.6:1.08);R.setClearColor(0,0);R.render(prevScene,prevCam);ICON[id]=R.domElement.toDataURL();prevScene.remove(g);
  g.traverse(o=>o.geometry&&o.geometry.dispose())}}
let prevObj=null,prevOn=false,prevT=0;
function startPreview(id){const R=r2();const box=$('arsPrev');if(R.domElement.parentNode!==box){box.innerHTML='';box.appendChild(R.domElement)}
 const w=box.clientWidth||320,h=box.clientHeight||150;R.setSize(w,h);prevCam.aspect=w/h;prevCam.updateProjectionMatrix();
 if(prevObj){prevScene.remove(prevObj);prevObj.traverse(o=>o.geometry&&o.geometry.dispose())}prevObj=gunGroup(id,{icon:true});if(id==='fists'){const hp=handParts(gunParts('fists').info);prevObj.add(new THREE.Mesh(mergeParts(hp),ICM[0]))}
 if(W[id].cls==='util')prevObj.scale.setScalar(2.4);const piv=new THREE.Group();piv.add(prevObj);const bb=new THREE.Box3().setFromObject(prevObj);prevObj.position.sub(bb.getCenter(new THREE.Vector3()));prevObj=piv;prevScene.add(piv);
 fitCam(piv,prevCam,false,1.25);prevCam.position.set(0,.05,1);const s=new THREE.Box3().setFromObject(piv).getSize(new THREE.Vector3());const r=Math.max(s.x,s.y,s.z);const hf=2*Math.atan(Math.tan(prevCam.fov*Math.PI/360)*prevCam.aspect),vf=prevCam.fov*Math.PI/180;const dist=Math.max((r/2)/Math.tan(hf/2),(Math.max(s.y,r*.3)/2)/Math.tan(vf/2))*1.25;prevCam.position.set(dist,dist*.12,0);prevCam.lookAt(0,0,0);prevT=0;
 if(!prevOn){prevOn=true;const loop=()=>{if(!prevOn)return;requestAnimationFrame(loop);if(prevObj){prevT+=.016;prevObj.rotation.y=Math.sin(prevT*.9)*.5}R.setClearColor(0,0);R.render(prevScene,prevCam)};loop()}}
function stopPreview(){prevOn=false}
const THUMB={};
function renderThumbs(cb){let i=0;const next=()=>{if(i>=MAPS.length){cb&&cb();return}const k=i++;if(THUMB[k]){next();return}
  try{const R=r2();R.setSize(320,180);const m=buildMap(k);const sc=new THREE.Scene();sc.add(m.group);if(m.sky)sc.add(m.sky);const d=m.def;sc.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);
   sc.add(new THREE.HemisphereLight(d.hemi[0],d.hemi[1],d.hemi[2]));const sl=new THREE.DirectionalLight(d.sun[0],d.sun[1]);sl.position.copy(m.sunDir);sc.add(sl);
   const cam=new THREE.PerspectiveCamera(50,16/9,.5,800);const[sx,sz]=d.size;if(d.indoor){cam.position.set(0,sz*1.3,sz*.6);R.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),3.1)]}else cam.position.set(-sx*.15,Math.max(sx,sz)*.55,sz*.75);cam.lookAt(0,0,0);
   R.setClearColor(0,1);R.render(sc,cam);R.clippingPlanes=[];THUMB[k]=R.domElement.toDataURL('image/jpeg',.8);sc.clear();if(cur===m){scene.add(m.group);if(m.sky)scene.add(m.sky)}}catch(e){console.warn(e)}
  renderLobby();setTimeout(next,30)};next()}
// ---------------- viewmodel (separate pass so it never clips into walls) ----------------
const vmScene=new THREE.Scene(),vmCam=new THREE.PerspectiveCamera(62,1,.01,10);const vmRoot=new THREE.Group();vmRoot.scale.setScalar(.5);vmScene.add(vmRoot);
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
function getVM(id){const sl=vmSleeve();const key=id+'|'+sl;if(!VM[key]){const g=gunGroup(id,{hands:true,sleeve:sl,lit:true});camoize(g,id);VM[key]=g}return VM[key]}
function resetVMs(){for(const k in VM)delete VM[k];if(me.load[me.cur])setViewModel(me.load[me.cur])}
const VA={};const WIDS=Object.keys(W),WIDX={};WIDS.forEach((k,i)=>WIDX[k]=i);
// third-person guns: low-detail, matcap-lit, shared geometry per weapon
const TPG={};function tpGun(id){if(!TPG[id]){const g=gunGroup(id,{lod:1});g.traverse(o=>{if(o.isMesh&&!o.userData.fx){o.castShadow=true}});TPG[id]=g}const c=TPG[id].clone();c.userData.info=TPG[id].userData.info;return c}
function setRemoteGun(q,wid){const id=WIDS[wid]||'ar';if(!q.model||q.gunId===id)return;const mt=q.model.userData.gunMount;if(!mt)return;mt.clear();if(!(W[id]&&W[id].cls==='util')||true){const g=tpGun(id);mt.add(g);q.gunObj=g}q.gunId=id}// viewmodel animation state
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
function impact(p,n,player,surf){if(player){fx.spark(p,8,0xff6a4d,3,.25);fx.sprite({p:p.clone(),s0:.1,s1:.4,life:.25,op:.6,color:0xb02020,rise:-.5});return}
 const k=SURF[surf||hitS]||'concrete';const off=_v.copy(p).addScaledVector(n,.08);
 if(k==='water'){for(let i=0;i<3;i++)fx.sprite({p:off.clone().add(_v2.set((Math.random()-.5)*.2,.1+i*.15,(Math.random()-.5)*.2)),s0:.1,s1:.5,life:.5,op:.7,color:0xdfefff,rise:1.4-i*.3});fx.spark(p,10,0xcfe6ff,3.2,.45);return}
 fx.decal(p,n);
 if(k==='metal'){fx.spark(p,12,0xffe2a0,6,.35);fx.sprite({p:off,tex:TX.flash,add:true,s0:.12,s1:.22,life:.06,op:1,color:0xffd090})}
 else if(k==='wood'){fx.spark(p,7,0x8a5a30,3,.5);fx.sprite({p:off,s0:.1,s1:.35,life:.35,op:.45,color:0xa48460,rise:.2})}
 else if(k==='dirt'){fx.spark(p,6,0x9a8060,2.5,.45);fx.sprite({p:off,s0:.2,s1:.9,life:.6,op:.55,color:0xc8b08a,rise:.5})}
 else if(k==='soft'){fx.sprite({p:off,s0:.08,s1:.3,life:.3,op:.35,color:0xbbbbbb,rise:.2})}
 else{fx.spark(p,5,0xffd27a,3.5,.3);fx.spark(p,4,0x999088,2.5,.45);fx.sprite({p:off,s0:.15,s1:.7,life:.55,op:.6,color:0xc4b8a6,rise:.4})}}
// ---------------- throwables & utilities ----------------
const thrownTpl={};function thrownMesh(kind){if(!thrownTpl[kind]){const PJ=W[kind]&&W[kind].proj;const g=gunGroup(PJ?'proj_'+PJ:kind);g.scale.setScalar(PJ?1.6:1.5);thrownTpl[kind]=g}return thrownTpl[kind].clone()}
let nades=[];const FUSE={grenade:1.8,smoke:1.4,flash:1.3,molotov:9,gl:4,rpg:4};
function spawnNade(owner,kind,p,v){const m=thrownMesh(kind);m.position.copy(p);scene.add(m);nades.push({owner,kind,m,v:v.clone(),t:FUSE[kind]||1.8,spin:new THREE.Vector3(Math.random()*8,Math.random()*8,0)})}
function updNades(dt){for(const n of nades){n.t-=dt;const PJ=W[n.kind]&&W[n.kind].proj;n.v.y-=(PJ==='rpg'?0:PJ==='gl'?9:20)*dt;const p=n.m.position;let bounced=false;
  if(PJ){if(n.v.lengthSq()>1)n.m.lookAt(_v.copy(p).add(n.v));if(PJ==='rpg'&&Math.random()<.7)fx.sprite({p:p.clone(),s0:.25,s1:1.2,life:.7,op:.5,color:0xcfcfcf,rise:.3});
   for(const id in C.players){const q=C.players[id];if(!q.alive||id===n.owner)continue;const c=_v2.copy(q.rp);c.y+=1;if(c.distanceTo(p)<.9){n.t=0;break}}}
  for(const ax of['x','y','z']){const old=p[ax];p[ax]+=n.v[ax]*dt;let hit=false;for(const c of cols)if(p.x>c.x0-.08&&p.x<c.x1+.08&&p.y>c.y0-.08&&p.y<c.y1+.08&&p.z>c.z0-.08&&p.z<c.z1+.08){hit=true;break}
   if(ax==='y'&&p.y<.1&&onFloor(p))hit=true;if(hit){p[ax]=old;n.v[ax]*=-.38;n.v.x*=.75;n.v.z*=.75;bounced=true}}
  n.m.rotation.x+=n.spin.x*dt;n.m.rotation.y+=n.spin.y*dt;if(bounced){n.spin.multiplyScalar(.7);if(n.kind==='molotov'||PJ)n.t=0}
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
 fx.spark(p,40,0xffb347,9,.6);fx.scorch(p,2.2);const d=camera.position.distanceTo(p);SFX.boom(Math.max(.15,1-d/60),panOf(p));shake=Math.min(1.2,shake+Math.max(0,1-d/18)*1.2)}
function utilFX(m){const p=new THREE.Vector3(...m.p);
 if(m.kind==='smoke'){smokes.push({p:p.clone().setY(p.y+1.2),r:4.2,t:0,life:13});SFX.hiss();for(let i=0;i<16;i++){const a=i/16*6.28,r=Math.random()*2.6;fx.sprite({p:_v.set(p.x+Math.cos(a)*r,p.y+.4+Math.random()*2.2,p.z+Math.sin(a)*r),s0:1,s1:4.5+Math.random()*1.5,life:12+Math.random()*1.5,op:.92,color:0xd8dce2,rise:.03})}}
 if(m.kind==='molotov'){fires.push({p,r:m.small?2:3.4,t:0,life:m.small?4.5:7,emit:0});SFX.whoosh();fx.scorch(p,3.2);fx.sprite({p,tex:TX.flash,add:true,s0:1,s1:4,life:.4,op:.9,color:0xff8a30})}
 if(m.kind==='flash'){fx.sprite({p,tex:TX.flash,add:true,s0:.5,s1:9,life:.25,op:1,color:0xffffff});const eye=camera.position;const d=eye.distanceTo(p);
  if(me.alive&&d<32&&losClear(p.clone().setY(p.y+.2),eye.clone())){const dir=p.clone().sub(eye).normalize();const facing=Math.max(0,dir.dot(fwd()));const k=Math.min(1,(.35+.65*facing)*(1-d/32)*1.4);flashAmt=Math.max(flashAmt,k*3.2);SFX.bang(k)}else SFX.boom(.4,panOf(p))}}
function updUtil(dt){for(const s of smokes)s.t+=dt;for(let i=smokes.length-1;i>=0;i--)if(smokes[i].t>smokes[i].life)smokes.splice(i,1);
 for(const f of fires){f.t+=dt;f.emit-=dt;if(f.emit<=0&&f.t<f.life){f.emit=.07;const a=Math.random()*6.28,r=Math.sqrt(Math.random())*f.r;fx.sprite({p:_v.set(f.p.x+Math.cos(a)*r,f.p.y+.2,f.p.z+Math.sin(a)*r),tex:TX.flash,add:true,s0:.7,s1:1.6,life:.55,op:.9,color:Math.random()<.5?0xff7a1a:0xffb03a,rise:2.2});
   if(Math.random()<.25)fx.sprite({p:_v.set(f.p.x+(Math.random()-.5)*f.r,f.p.y+1.5,f.p.z+(Math.random()-.5)*f.r),s0:1,s1:2.6,life:1.4,op:.35,color:0x333333,rise:1.2})}}
 for(let i=fires.length-1;i>=0;i--)if(fires[i].t>fires[i].life)fires.splice(i,1);
 // in-smoke overlay
 let sm=0;for(const s of smokes){if(s.t<1)continue;const d=camera.position.distanceTo(s.p);if(d<s.r)sm=Math.max(sm,Math.min(.88,(1-d/s.r)*1.6)*Math.min(1,(s.life-s.t)/2))}
 $('smokeOv').style.opacity=sm.toFixed(2);flashAmt=Math.max(0,flashAmt-dt);$('flashOv').style.opacity=Math.min(1,flashAmt).toFixed(2)}
let flashAmt=0,shake=0;
function panOf(p){const r=_v2.set(1,0,0).applyQuaternion(camera.quaternion);const d=_v.copy(p).sub(camera.position).normalize();return d.dot(r)*.8}
// ---------------- state ----------------
const DEFAULT_LOAD=['ar','handgun','fists','grenade'];
// ---------------- progression: diamonds (earned only by playing, stored on this device; no real money anywhere) ----------------
// economy: online match (first to 5) pays roughly 60-90 💎; mid-tier guns ~500-900 (5-8 matches), top tier ~1500-2000 (15-25). Offline / practice vs bots: everything x0.5 (kill 3→2 rounded)
const ECON={kill:3,head:2,round:8,win:20,play:5,mul:()=>(H&&H.offline)||C.practice?.5:1};
const CAMOS={factory:['Factory',0,null],desert:['Desert',150,0xc8a96a],forest:['Forest',150,0x4f6b3a],arctic:['Arctic',220,0xdfe8ee],crimson:['Crimson',300,0xb3202a],cobalt:['Cobalt',300,0x2a62c9],gold:['Gold',900,0xe8b923],neon:['Neon',650,0x39ff88]};
const SKINS={default:['Default',0,null],ninja:['Ninja',100,[0x1b1d21,0x111214]],desert:['Desert Ops',100,[0xb59a6a,0x7d6a4a]],arctic:['Arctic',120,[0xe6edf2,0x9aa6b0]],royal:['Royal',160,[0x5b2a86,0xd4a83a]],neon:['Neon',200,[0x18e07a,0x101010]]};
const UPG={mag:{name:'Extended Mag',per:.15,cost:[200,450]},reload:{name:'Fast Hands',per:.08,cost:[200,450]}};
// one wallet + inventory per device, shared by offline, hub and online play. Versioned key; migrates the old 'prog' save.
const WALLET_V=2;const PROG=(()=>{const base={v:WALLET_V,dia:0,owned:[],upg:{},camo:{},camos:{},skin:'default',skins:['default']};let w=null;try{w=JSON.parse(LS('wallet')||'null')}catch(e){}
 if(!w||!w.v){let old={};try{old=JSON.parse(LS('prog')||'{}')||{}}catch(e){}w=Object.assign({},old,w||{});}
 const P=Object.assign(base,w);P.v=WALLET_V;P.dia=Math.max(0,P.dia|0);for(const k of['owned','skins'])if(!Array.isArray(P[k]))P[k]=[];if(!P.skins.includes('default'))P.skins.push('default');LSS('wallet',JSON.stringify(P));return P})();
function saveProg(){PROG.v=WALLET_V;LSS('wallet',JSON.stringify(PROG));updDiaUI()}
addEventListener('storage',e=>{if(e.key==='hsz_wallet'&&e.newValue){try{Object.assign(PROG,JSON.parse(e.newValue));updDiaUI()}catch(x){}}});
const owns=id=>!W[id].price||PROG.owned.includes(id);
function tier(id,k){return(PROG.upg[id]||{})[k]||0}
function magOf(id){const w=W[id];return w.mag?Math.max(w.mag,Math.round(w.mag*(1+UPG.mag.per*tier(id,'mag')))):0}
function reloadOf(id){const w=W[id];return +(w.reload*(1-UPG.reload.per*tier(id,'reload'))).toFixed(2)}
function updDiaUI(){for(const e of document.querySelectorAll('.diaBal'))e.textContent=PROG.dia}
let diaToastT=null;
function addDia(n,why){(window.__dlog||(window.__dlog=[])).push([n,why]);if(!n)return;PROG.dia+=n;C.matchDia=(C.matchDia||0)+n;saveProg();const t=$('diaToast');if(t){t.textContent=`+${n} 💎 ${why||''}`;t.classList.remove('show');void t.offsetWidth;t.classList.add('show')}}
const me={id:null,pos:new THREE.Vector3(),vel:new THREE.Vector3(),ground:false,yaw:0,pitch:0,hp:100,alive:false,
 load:DEFAULT_LOAD.slice(),utilN:2,cur:0,ammo:[0,0,0],cool:0,reloadT:0,reloadStage:0,switchT:0,slideT:0,slideCd:0,camH:1.62,stepT:0,zoomT:0,frozen:true,burst:0,burstT:0,shots:0,lastShot:0};
try{const l=JSON.parse(LS('load2')||'null');if(l&&l.length===4&&l.every((k,i)=>W[k]&&W[k].slot===i&&owns(k)))me.load=l}catch(e){}
const C={byOrd:{},players:{},phase:'lobby',map:0,mode:'team',score:{},round:0,hostId:null,roundT:0,sb:{}};
let isHost=false,peer=null,conn=null,roomCode='';
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
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name,skin:PROG.skin,hid:hubSelfId})});conn.on('data',clientHandle);conn.on('close',hostGone)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){menuMsg(auto?'Setting up the match…':'Room '+code+' not found — creating it so friends can join you!');peer.destroy();setTimeout(()=>createRoom(code,auto),auto?Math.random()*500:600)}else menuMsg('Network error: '+e.type)})}
function hostGone(){if(isHost)return;if(C.fromHub){location.href=hubUrl();return}alert('The host left the game. Tap OK to go back to the room link.');location.href=location.pathname+'?room='+roomCode}
// ================= HOST =================
const H={players:{},mode:'team',phase:'lobby',map:0,score:{},round:0,t:0,next:0,roundEnd:0,botN:0,order:0,fires:[],smokes:[],fireT:0,sideFlip:false};
const BOTNAMES=['Bolt','Ziggy','Rex','Nova','Pip','Tank','Moxie','Echo','Juno','Blaze','Kit','Ace'];const BOTGUNS=['ar','smg','battle','bullpup','pdw','vector','paintball','laser','freeze','bat','chainsaw'];
function hostInit(name,noUrl){C.hostId=me.id;H.players[me.id]=newP(me.id,name);H.players[me.id].skin=PROG.skin;H.players[me.id].hid=hubSelfId;sendLobby();showLobby();if(!noUrl)history.replaceState(null,'','?room='+roomCode)}
function newP(id,name,bot){return{id,name,team:'A',color:0xffffff,hp:100,alive:false,kills:0,deaths:0,pts:0,hs:0,rk:0,vote:-1,bot:!!bot,p:[0,-50,0,0,0,0,0],respawn:0,ord:H.order++,gun:bot?BOTGUNS[(Math.random()*BOTGUNS.length)|0]:null}}
function plist(){return Object.values(H.players).sort((a,b)=>a.ord-b.ord)}
function assignTeams(){let i=0;const AT=H.auto&&H.auto.teams;for(const p of plist()){if(AT&&p.hid&&AT[p.hid]&&H.mode!=='ffa'){p.team=AT[p.hid];p.color=TEAMCOL[p.team];i++;continue}if(H.mode==='ffa'){p.team=p.id;p.color=FFACOL[i%10]}else{p.team=i%2?'B':'A';p.color=TEAMCOL[p.team]}i++}}
function lobbyData(){return{t:'lobby',mode:H.mode,phase:H.phase,hostId:me.id,diff:H.diff||'normal',fill:!!H.fill,pub:!!H.pub,offline:!!H.offline,players:plist().map(p=>({id:p.id,name:p.name,team:p.team,color:p.color,bot:p.bot,vote:p.vote}))}}
function sendLobby(){if(H.phase==='lobby')assignTeams();bcast(lobbyData())}
function sbData(){return{t:'sb',p:plist().map(p=>[p.id,p.kills,p.deaths,p.pts,p.alive?1:0,p.hs]),r:H.score}}
function sendSB(){bcast(sbData())}
function hostLeave(id){if(!H.players[id])return;delete H.players[id];delete conns[id];bcast({t:'bye',id});if(H.phase==='lobby')sendLobby();else{sendSB();checkRound()}}
function hostHandle(from,m){const p=H.players[from];
 switch(m.t){
 case 'hello':{if(Object.keys(H.players).length>=MAXP){conns[from]?.send({t:'full'});return}if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}
  const np=H.players[from]=newP(from,String(m.name||'Player').slice(0,12));np.skin=SKINS[m.skin]?m.skin:'default';np.hid=m.hid||null;
  if(H.phase==='lobby')sendLobby();else{if(H.mode==='ffa'){np.team=from;np.color=FFACOL[plist().length%10]}else{np.team=teamSmaller();np.color=TEAMCOL[np.team]}
   bcast(lobbyData());sendTo(from,startData());bcast({t:'join',id:from,name:np.name,team:np.team,color:np.color,o:np.ord,sk:np.skin},from);
   sendTo(from,{t:'round',round:H.round,score:H.score,spawns:{},count:0});sendSB();if(H.mode==='ffa')np.respawn=H.t+1}break}
 case 'mode':if(from===me.id&&H.phase==='lobby'&&MODES[m.mode]){H.mode=m.mode;sendLobby();regRoom()}break;
 case 'opt':if(from===me.id){if(DIFF[m.diff])H.diff=m.diff;if('fill' in m)H.fill=!!m.fill;if('pub' in m&&!H.offline){H.pub=!!m.pub;regRoom()}sendLobby()}break;
 case 'vote':if(p&&H.phase==='lobby'){p.vote=m.map|0;sendLobby()}break;
 case 'bot':if(from===me.id&&H.phase==='lobby'){if(m.add&&Object.keys(H.players).length<MAXP){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}
  else if(!m.add){const b=plist().filter(x=>x.bot).pop();if(b)delete H.players[b.id]}sendLobby()}break;
 case 'start':if(from===me.id&&H.phase==='lobby')startMatch();break;
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
function teamSmaller(){let a=0,b=0;for(const p of plist()){if(p.team==='A')a++;else if(p.team==='B')b++}return a<=b?'A':'B'}
function damage(v,dmg,by,head,w){if(!v.alive)return;{const ww=W[w];if(ww&&(ww.slow||ww.push)&&by!==v.id)hitFX(v,ww,by)}
 if(v.down){if(by===v.id&&w!=='fall'&&w!=='bleed')return;v.dhp-=dmg;bcast({t:'hp',id:v.id,hp:0,by,dmg,head,d:1});if(v.dhp>0&&w!=='fall'&&w!=='bleed')return;
  v.down=false;v.rev=null;v.alive=false;const k=H.players[by];const fin=k&&by!==v.id;if(fin)k.pts+=25;bcast({t:'kill',k:by,v:v.id,head,w,fin:fin?1:0,bleed:w==='bleed'?1:0});sendSB();checkRound();return}
 v.hp-=dmg;bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg,head});
 if(v.hp<=0&&isTeamMode(H.mode)&&H.phase==='play'&&w!=='fall'&&by!==v.id&&plist().some(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down)){
  v.hp=0;v.down=true;v.dhp=DOWN.hp;v.downT=H.t+DOWN.bleed;v.rev=null;v.deaths++;const k=H.players[by];if(k){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w,dn:1});sendSB();checkRound();return}
 if(v.hp<=0){v.alive=false;v.deaths++;const k=H.players[by];const self=!k||by===v.id;if(!self){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w});if(H.mode==='ffa'&&H.phase==='play')v.respawn=H.t+2.5;sendSB();checkRound()}}
function toPlayer(id,msg){if(conns[id]&&conns[id].open)conns[id].send(msg);else if(id===me.id)clientHandle(msg)}
function hitFX(v,w,by){const k=H.players[by];if(w.slow){if(v.bot){v.slowT=H.t+w.slow[1];v.slowF=w.slow[0]}else toPlayer(v.id,{t:'slow',f:w.slow[0],d:w.slow[1]})}
 if(w.push&&k){const dx=v.p[0]-k.p[0],dz=v.p[2]-k.p[2],l=Math.hypot(dx,dz)||1;const px=dx/l*w.push,pz=dz/l*w.push;if(v.bot&&v.e){v.e.vel.x+=px;v.e.vel.z+=pz;v.e.vel.y=Math.max(v.e.vel.y,1.2)}else toPlayer(v.id,{t:'push',v:[px,pz]})}}
function startData(){return{t:'start',map:H.map,mode:H.mode,players:Object.fromEntries(plist().map(p=>[p.id,{name:p.name,team:p.team,color:p.color,bot:p.bot,o:p.ord,sk:p.skin}]))}}
function startMatch(){{const mx=MODEMAX[H.mode]||10;const bots=plist().filter(p=>p.bot);while(plist().length>mx&&bots.length){const b=bots.pop();delete H.players[b.id];bcast({t:'bye',id:b.id})}}if(H.fill){const want=MODEMAX[H.mode]||4;while(Object.keys(H.players).length<want){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%BOTNAMES.length]+'Bot',true)}}assignTeams();const votes=MAPS.map(()=>0);for(const p of plist())if(p.vote>=0)votes[p.vote]++;
 const mx=Math.max(...votes);const best=votes.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);H.map=best[Math.random()*best.length|0];if(H.auto&&H.auto.map!=null)H.map=H.auto.map;
 H.score={};H.round=0;H.fires=[];H.smokes=[];for(const p of plist()){p.kills=p.deaths=p.pts=p.hs=0}const m=buildMap(H.map);cols=m.cols;groundHalf=m.groundHalf;ladders=m.ladders||[];hides=m.hides||[];
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
 for(const p of plist()){p.hp=100;p.alive=true;p.down=false;p.rev=null;p.rk=0;p.respawn=0;const s=spawns[p.id];p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s)}
 H.next=H.t+3;H.roundEnd=H.t+3+(H.mode==='ffa'?120:90);bcast({t:'round',round:H.round,score:H.score,spawns,count:3});sendSB();window.__lastSpawns=spawns}
function teamAlive(){const a={};for(const p of plist())if(p.alive&&!p.down)a[p.team]=(a[p.team]||0)+p.hp;return a}
function checkRound(){if(H.phase!=='play')return;let win=null;
 if(H.mode==='ffa'){for(const p of plist())if(p.rk>=FFA_ROUND_KILLS)win=p.id}
 else{const a=teamAlive(),ks=Object.keys(a);const teams=new Set(plist().map(p=>p.team));if(teams.size<2){if(!ks.length)win='draw'}else if(ks.length<=1)win=ks[0]||'draw'}
 if(win)endRound(win)}
function endRound(win){H.phase='roundEnd';if(win!=='draw')H.score[win]=(H.score[win]||0)+1;const champ=win!=='draw'&&H.score[win]>=WIN_ROUNDS;
 const nm=H.mode==='ffa'?(H.players[win]?.name||'?'):(win==='A'?'BLUE TEAM':win==='B'?'RED TEAM':'');
 bcast({t:'roundEnd',win,name:nm,score:H.score,match:champ});sendSB();
 setTimeout(()=>{if(champ){if(H.phase!=='roundEnd')return;H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}else startRound()},champ?(H.offline?13500:13500):3500)}
function hostTick(dt){H.t+=dt;
 if(H.auto&&H.phase==='lobby'&&H.autoAt){const humans=plist().filter(p=>!p.bot).length;if(humans>=H.auto.expect||H.t>H.autoAt){H.autoAt=0;startMatch()}}
 if(H.phase==='count'&&H.t>=H.next){H.phase='play';bcast({t:'go'})}
 if(H.phase==='play'){
  for(const v of plist()){if(!v.down)continue;if(H.t>=v.downT){damage(v,999,v.id,false,'bleed');continue}
   const rv=plist().filter(q=>q.team===v.team&&q.id!==v.id&&q.alive&&!q.down&&Math.hypot(q.p[0]-v.p[0],q.p[1]-v.p[1],q.p[2]-v.p[2])<=DOWN.r);
   if(rv.length){if(!v.rev||!rv.some(q=>q.id===v.rev.by))v.rev={by:rv[0].id,t0:H.t};if(H.t-v.rev.t0>=DOWN.revive){(window.__rv=window.__rv||[]).push(+(H.t-v.rev.t0).toFixed(3));v.down=false;v.hp=DOWN.revHp;const by=v.rev.by;v.rev=null;bcast({t:'revive',id:v.id,by,hp:v.hp});bcast({t:'hp',id:v.id,hp:v.hp});sendSB();continue}}
   else v.rev=null;
   if((v.dsT=(v.dsT||0)+dt)>.15){v.dsT=0;bcast({t:'dst',id:v.id,left:Math.max(0,v.downT-H.t),rv:v.rev?Math.min(1,(H.t-v.rev.t0)/DOWN.revive):0,by:v.rev?v.rev.by:null})}}
  if(H.t>=H.roundEnd){let win='draw';if(H.mode==='ffa'){let b=-1;for(const p of plist())if(p.rk>b){b=p.rk;win=p.id}}else{const a=teamAlive();win=(a.A||0)>(a.B||0)?'A':(a.B||0)>(a.A||0)?'B':'draw'}endRound(win)}
  if(H.mode==='ffa')for(const p of plist()){if(!p.alive&&p.respawn&&H.t>=p.respawn){p.respawn=0;p.alive=true;p.hp=100;const s=respawnPoint(p);p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s);bcast({t:'spawn',id:p.id,s});sendSB()}}
  for(const p of plist())if(p.bot&&p.alive)botTick(p,dt);
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
  if(best&&bd<35){b.revT=best.id;b.goal=[best.p[0],best.p[2],best.p[1]];b.via=null}else b.revT=null}else b.revT=null}b.blind=Math.max(0,(b.blind||0)-dt);const w=W[b.gun]||W.ar;
 if(b.blind<=0&&!H.noFight)for(const q of plist()){if(!q.alive||q.id===b.id||(H.mode!=='ffa'&&q.team===b.team))continue;const dx=q.p[0]-e.pos.x,dz=q.p[2]-e.pos.z,dy=q.p[1]-e.pos.y,dd=Math.hypot(dx,dy,dz);if(dd>55||dd>=td)continue;if(dd>4.5&&hides.length&&inVol(hides,{x:q.p[0],y:q.p[1]+.5,z:q.p[2]})&&!(q.shotT>H.t-1.5))continue;
  _o.set(e.pos.x,e.pos.y+1.5,e.pos.z);if(!rayClearHost(_o,_d.set(q.p[0],q.p[1]+(q.down?.4:1.4),q.p[2])))continue;const sc=dd+(q.down?12:0);if(sc>=td)continue;td=sc;tgt=q}
 let wx=0,wz=0;b.st-=dt;if(b.st<=0){b.st=.5+Math.random()*1.2;b.strafe=Math.random()<.5?-1:1}
 if(tgt){const dx=tgt.p[0]-e.pos.x,dz=tgt.p[2]-e.pos.z;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*DIFF[H.diff||'normal'].turn);
  const fx2=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);wx=-fz*b.strafe;wz=fx2*b.strafe;if(td>14||(w.melee&&td>w.melee*.7)){wx+=fx2*(w.melee?3:1);wz+=fz*(w.melee?3:1)}
  b.react-=dt;b.cool-=dt;if(b.react<=0&&b.cool<=0&&!(w.melee&&td>w.melee+.4)){b.cool=w.rate*1.25;const D=DIFF[H.diff||'normal'];const hit=Math.random()<Math.max(.08,D.hit-td/100);_o.set(e.pos.x,e.pos.y+1.4,e.pos.z);
   const end=[tgt.p[0]+(hit?0:(Math.random()-.5)*2),tgt.p[1]+1.2+(hit?0:Math.random()),tgt.p[2]+(hit?0:(Math.random()-.5)*2)];
   bcast({t:'fx',id:b.id,a:[_o.x,_o.y,_o.z],b:end,w:b.gun});if(hit){const head=Math.random()<D.head;damage(tgt,Math.round((head?w.head:w.body)*falloff(w,td)),b.id,head,b.gun)}}}
 else{b.react=DIFF[H.diff||'normal'].react;const m=buildMap(H.map);if(!b.revT&&(!b.goal||(Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2&&Math.abs((b.goal[2]||0)-e.pos.y)<1.6)||(!H.noFight&&(Math.random()<dt*.05||(b.goalT=(b.goalT||0)+dt)>25)))){const all=allSpawns(m);const foes=plist().filter(q=>q.alive&&q.id!==b.id&&(H.mode==='ffa'||q.team!==b.team));if(foes.length&&Math.random()<.65){const f=foes[Math.random()*foes.length|0];b.goal=[f.p[0]+(Math.random()-.5)*3,f.p[2]+(Math.random()-.5)*3,f.p[1]]}else if(m.nav&&m.nav.length&&Math.random()<.5)b.goal=m.nav[Math.random()*m.nav.length|0].slice();else b.goal=all[Math.random()*all.length|0].slice();b.via=null;b.goalT=0}
  const nt=navTarget(b,e,m);const dx=nt[0]-e.pos.x,dz=nt[2]-e.pos.z;b.climbY=nt[1];const l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*4)}
 if(b.detour>0){b.detour-=dt;wx=b.dd[0];wz=b.dd[1]}
 if(b.revT&&!tgt){const q=H.players[b.revT];if(q&&Math.hypot(q.p[0]-e.pos.x,q.p[2]-e.pos.z)<.9){wx=wz=0;b.detour=0}}
 const l=Math.hypot(wx,wz);if(l>0){wx/=l;wz/=l}const sp=(b.blind>0?2:5.2)*(b.slowT>H.t?b.slowF:1);e.vel.x+=(wx*sp-e.vel.x)*Math.min(1,dt*10);e.vel.z+=(wz*sp-e.vel.z)*Math.min(1,dt*10);
 {const L=inVol(ladders,e.pos);e.ladTop=L&&(b.climbY??0)>e.pos.y+.3?L.y1:null;if(L){const ty=b.climbY??e.pos.y;if(ty>e.pos.y+.3){e.vel.y=4.4;e.vel.x-=L.n[0]*1.5;e.vel.z-=L.n[1]*1.5}else if(ty<e.pos.y-.3)e.vel.y=Math.min(e.vel.y,-2.5);else e.vel.y=Math.max(e.vel.y,0)}}
 if(e.ground&&!(b.via&&b.via.down)){const px=e.pos.x+e.vel.x*.45,pz=e.pos.z+e.vel.z*.45;if(!supportAt(px,e.pos.y,pz)){e.vel.x*=-.3;e.vel.z*=-.3;if(!b.via)b.goal=null}}
 if(e.ground&&supportAt(e.pos.x,e.pos.y,e.pos.z))b.lastG=[e.pos.x,e.pos.z];else if(!e.ground&&b.lastG&&!inVol(ladders,e.pos,.4)&&!(b.via&&b.via.down)&&!supportAt(e.pos.x,e.pos.y,e.pos.z)){const gx=b.lastG[0]-e.pos.x,gz=b.lastG[1]-e.pos.z,gl=Math.hypot(gx,gz)||1;e.vel.x=gx/gl*5;e.vel.z=gz/gl*5;if(!b.via)b.goal=null}
 e.bump=0;{const n=Math.ceil(dt/.02);for(let i=0;i<n;i++){const bb=e.bump;physStep(e,dt/n);e.bump=e.bump||bb}}if(e.bump&&e.ground){e.vel.y=8;b.stuckN=(b.stuckN||0)+1;if(b.stuckN>1&&!(b.detour>0)){const sg=Math.random()<.5?1:-1;const vl=Math.hypot(wx,wz)||1;b.dd=[-wz/vl*sg,wx/vl*sg];b.detour=.7+Math.random()*.6;b.stuckN=0}if(Math.random()<.15&&!b.via&&!inVol(ladders,e.pos,.6))b.goal=null}else if(!e.bump)b.stuckN=Math.max(0,(b.stuckN||0)-dt);if(e.pos.y<-3)damage(b,999,b.id,false,'fall');
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,WIDX[b.gun]|0,e.ground?0:2]}
// ================= CLIENT =================
let lastLobby=null;
function clientHandle(m){switch(m.t){
 case 'lobby':lastLobby=m;C.hostId=m.hostId;C.mode=m.mode;if(m.phase==='lobby'){if(inGame)leaveToLobby();showLobby()}renderLobby();break;
 case 'full':menuMsg('Room is full (10 players max).');break;
 case 'start':startGame(m);break;
 case 'join':addRemote(m.id,{name:m.name,team:m.team,color:m.color,o:m.o,sk:m.sk});renderSB();feed(`${m.name} joined`);break;
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
 case 'kill':{const k=C.players[m.k],v=C.players[m.v];(window.__klog||(window.__klog=[])).push([m.k,m.v,C.map,m.w,m.dn?'down':m.fin?'fin':m.bleed?'bleed':'']);
  if(m.dn){if(v){v.down=true;v.hp=0;sbDirty=1}if(m.k===me.id)addDia(Math.round((m.head?ECON.kill+ECON.head:ECON.kill)*ECON.mul()),m.head?'headshot down':'down');
   feed(`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[${esc(W[m.w]?W[m.w].name:'')}${m.head?' 🎯':''} · downed]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
   if(m.v===me.id){me.down=true;me.hp=0;me.slideT=0;me.zoomT=0;updHP();updDown();center('DOWNED!\nWaiting for a teammate…',1800)}if(m.k===me.id){SFX.kill();center('DOWNED '+(v?.name||''),1000)}break}
  if(v){v.down=false;v.dst=null}if(m.v===me.id){me.down=false;me.dst=null;updDown()}
  if(m.fin||m.bleed){if(m.fin&&m.k===me.id)addDia(Math.max(1,Math.round(1*ECON.mul())),'finish');if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
   feed(m.bleed?`<b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b> <span class="k">[bled out]</span>`:`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[finished]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
   if(m.v===me.id){me.alive=false;me.hp=0;updHP();center(m.bleed?'BLED OUT':'FINISHED by '+(k?.name||'?'),2000)}if(m.fin&&m.k===me.id){SFX.kill();center('FINISHED '+(v?.name||''),900)}break}
  if(m.k===me.id&&m.v!==me.id)addDia(Math.round((m.head?ECON.kill+ECON.head:ECON.kill)*ECON.mul()),m.head?'headshot':'kill');if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
  const wn=m.w==='fall'?'fell':m.w==='molotov'?'🔥':W[m.w]?W[m.w].name:'';
  if(m.w==='fall'||m.k===m.v)feed(`${v?.name||'?'} ${m.w==='fall'?'fell off':'eliminated themselves'}`);else feed(`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[${esc(wn)}${m.head?' 🎯':''}]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
  if(m.v===me.id){me.alive=false;me.hp=0;updHP();me.killer=m.k;center('ELIMINATED'+(k&&m.k!==m.v?'\nby '+k.name:'')+(C.mode==='ffa'?'\nRespawning…':''),2200)}
  if(m.k===me.id&&m.v!==me.id){SFX.kill();center(m.head?'🎯 HEADSHOT!':'ELIMINATED '+(v?.name||''),1000)}break}
 case 'roundEnd':{C.phase='roundEnd';C.score=m.score;me.frozen=true;const mine=C.mode==='ffa'?m.win===me.id:m.win===C.players[me.id]?.team;
  {if(mine)addDia(Math.round(ECON.round*ECON.mul()),'round win');if(m.match)addDia(Math.round((mine?ECON.win+ECON.play:ECON.play)*ECON.mul()),mine?'match win':'match played')}
  center(m.win==='draw'?'DRAW':(m.match?`${m.name}\nWINS THE MATCH!\n💎 +${C.matchDia||0} diamonds this match`:`${m.name} WINS THE ROUND`)+(mine?' 🏆':''),m.match?6000:3300);if(m.match)setTimeout(()=>showEnd(m,mine),2600);else showRL(true);if(mine)SFX.kill();renderSB();break}
 case 'fx':{const a=new THREE.Vector3(...m.a),b=new THREE.Vector3(...m.b);const fw=W[m.w];addTracer(a,b,fw&&fw.tracer);if(fw&&fw.paint)paintSplat(b,null,m.id);fx.sprite({p:a,tex:TX.flash,add:true,s0:.4,s1:.6,life:.05,op:1,color:0xffd080});
  const d=camera.position.distanceTo(a);if(d<120)SFX.gun(m.w,Math.max(.06,1-d/120)*.75,panOf(a),d);const dir=b.clone().sub(a).normalize();const t=rayWorld(a,dir,a.distanceTo(b)+.5);if(t<a.distanceTo(b)+.4)impact(a.clone().addScaledVector(dir,t),hitN.clone());break}
 case 'nade':spawnNade(m.id,m.k||'grenade',new THREE.Vector3(...m.p),new THREE.Vector3(...m.v));break;
 case 'util':utilFX(m);break;
 case 'sb':C.sb={};for(const r of m.p)C.sb[r[0]]={k:r[1],d:r[2],pts:r[3],alive:!!r[4],hs:r[5]};C.score=m.r||{};renderSB();if(!$('pause').classList.contains('hidden'))renderBoard();break;
 }}
function addRemote(id,info){if(C.players[id]?.model)scene.remove(C.players[id].model);
 const q={id,name:info.name,team:info.team,color:info.color??0xffffff,bot:info.bot,alive:false,hp:100,rp:new THREE.Vector3(0,-50,0),tp:new THREE.Vector3(0,-50,0),lp:new THREE.Vector3(),yaw:0,tyaw:0,pitch:0,tpitch:0,flags:0};
 if(id!==me.id){q.model=makeCharacter(q.color,info.name,id,undefined,(SKINS[info.sk]||[])[2]||undefined);q.model.visible=false;scene.add(q.model)}C.players[id]=q;if(info.o!=null)C.byOrd[info.o]=q}
function startGame(m){for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.byOrd={};C.mode=m.mode;C.map=m.map;C.score={};C.sb={};C.matchDia=0;
 loadMap(m.map);for(const id in m.players)addRemote(id,m.players[id]);
 for(const s of['menu','lobby','arsenal','settings'])$(s).classList.add('hidden');stopPreview();$('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);
 inGame=true;resize();me.alive=false;me.frozen=true;feed(`${MAPS[m.map].icon} ${MAPS[m.map].name} · ${MODES[m.mode][0]}`);center(MAPS[m.map].name.toUpperCase(),1500);renderSB();buildSlots();
 goFS()}
// face the most open direction, biased toward the map centre (never stare at a wall)
function faceYaw(x,z){const o=new THREE.Vector3(x,1.6,z),d=new THREE.Vector3();const cy=Math.atan2(x,z);let best=cy,bs=-1;
 for(let i=0;i<16;i++){const y=i/16*Math.PI*2;d.set(-Math.sin(y),0,-Math.cos(y));const free=Math.min(rayWorld(o,d,60),60);let dy=Math.abs(((y-cy+Math.PI*3)%(Math.PI*2))-Math.PI);const sc=free*(1.25-dy/Math.PI*.6);if(sc>bs){bs=sc;best=y}}
 return Math.hypot(x,z)<1?best:best}
function spawnMe(s){me.pos.set(s[0],0,s[1]);me.vel.set(0,0,0);me.yaw=faceYaw(s[0],s[1]);me.pitch=0;me.hp=100;me.alive=true;me.slideT=0;me.reloadT=0;me.killer=null;recoilP=recoilY=0;
 me.ammo=me.load.slice(0,3).map(w=>magOf(w));me.utilN=W[me.load[3]].count;me.cur=0;me.zoomT=0;me.zoomOn=false;updZoomBtn();setViewModel(me.load[0]);me.switchT=.35;updHP();buildSlots()}
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
 $('board').innerHTML=`<div class="cardHead sm">${MODES[C.mode][0]} · ${MAPS[C.map].name} · ROOM ${roomCode}</div><table><tr style="opacity:.7;font-size:11px"><td>PLAYER</td><td>PTS</td><td>K</td><td>D</td><td>🎯</td>${C.mode==='ffa'?'<td>★</td>':''}</tr>`+
 ps.map(p=>{const s=C.sb[p.id]||{k:0,d:0,pts:0,hs:0};return`<tr class="${p.id===me.id?'me':''}"><td style="color:${hex(p.color)}">${esc(p.name)}${p.bot?' 🤖':''}</td><td>${s.pts}</td><td>${s.k}</td><td>${s.d}</td><td>${s.hs}</td>${C.mode==='ffa'?`<td>${C.score[p.id]||0}</td>`:''}</tr>`}).join('')+'</table>'}
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
function openArsenal(cls,mode){audioInit();arsMode=mode||'arsenal';arsCls=(cls&&cls!=='char')?cls:W[me.load[0]].cls;$('arsTitle').textContent=ARS_T[arsMode];$('arsenal').dataset.mode=arsMode;$('arsenal').classList.remove('hidden');renderArsenal();updDiaUI()}
function swatch(c){return c?'#'+new THREE.Color(c).getHexString():'linear-gradient(135deg,#555,#999)'}
function renderArsenal(){const cls=CLASSES.filter(c=>arsMode!=='upgrade'||c.id!=='util');
 $('arsTabs').innerHTML=cls.map(c=>`<button data-c="${c.id}" class="${c.id===arsCls?'sel':''}">${c.name}</button>`).join('')+(arsMode==='upgrade'?`<button data-c="char" class="${arsCls==='char'?'sel':''}">🧍 Character</button>`:'');
 updDiaUI();
 if(arsCls==='char'){const ks=Object.keys(SKINS);if(!skinSel)skinSel=PROG.skin;
  $('arsGrid').innerHTML=ks.map(k=>{const[n,p,c]=SKINS[k];const own=PROG.skins.includes(k);return`<button class="wc${k===skinSel?' sel':''}" data-sk="${k}"><span class="sw big" style="background:${c?`linear-gradient(135deg,${swatch(c[0])} 50%,${swatch(c[1])} 50%)`:'#4b5344'}"></span>${n}<span class="eq">${PROG.skin===k?'WEARING':own?'OWNED':'💎 '+p}</span></button>`}).join('');
  const[n,p]=SKINS[skinSel];const own=PROG.skins.includes(skinSel);$('arsName').textContent=n+' outfit';$('arsDesc').textContent='Cosmetic only. Other players see it in matches and the hub.';$('arsStats').innerHTML='';$('arsUpg').innerHTML='';
  const b=$('arsEquip');b.dataset.act=own?'wear':'buyskin';b.textContent=PROG.skin===skinSel?'✓ WEARING':own?'WEAR':PROG.dia>=p?`BUY 💎 ${p}`:`NEED 💎 ${p-PROG.dia} MORE`;b.classList.toggle('poor',!own&&PROG.dia<p);stopPreview();$('arsPrev').innerHTML='<div class="skinPrev">🧍</div>';return}
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
function equip(w){me.load[w.slot]=w.id;LSS('load2',JSON.stringify(me.load));renderLoadoutMini();if(inGame&&!C.hub)feed(`${w.name} equipped — active on next spawn`);if(C.hub)hubEquip()}
$('arsTabs').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;arsCls=b.dataset.c;arsSel=null;renderArsenal();SFX.swap()});
$('arsGrid').addEventListener('click',e=>{const s=e.target.closest('[data-sk]');if(s){skinSel=s.dataset.sk;renderArsenal();SFX.swap();return}
 if(e.target.closest('[data-act="goshop"]')){openArsenal(arsCls,'shop');return}const b=e.target.closest('[data-w]');if(!b)return;arsSel=b.dataset.w;renderArsenal();SFX.swap()});
function denied(){SFX.beep&&SFX.beep();const b=$('arsEquip');b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake')}
$('arsDetail').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;const w=W[arsSel];
 if(act==='equip'){equip(w);SFX.magIn()}
 else if(act==='buy'){if(PROG.dia<w.price)return denied();PROG.dia-=w.price;PROG.owned.push(w.id);saveProg();equip(w);SFX.kill();center(`🔓 ${w.name} unlocked!`,1400)}
 else if(act==='up'){const k=b.dataset.k,t=tier(w.id,k),c=UPG[k].cost[t];if(t>=2)return;if(PROG.dia<c)return denied();PROG.dia-=c;(PROG.upg[w.id]=PROG.upg[w.id]||{})[k]=t+1;saveProg();SFX.magIn()}
 else if(act==='camo'){const k=b.dataset.k,[n,p]=CAMOS[k];const own=PROG.camos[w.id]||(PROG.camos[w.id]=['factory']);if(!own.includes(k)){if(PROG.dia<p)return denied();PROG.dia-=p;own.push(k)}PROG.camo[w.id]=k;saveProg();delete VM[w.id];if(me.load[me.cur]===w.id)setViewModel(w.id);SFX.swap()}
 else if(act==='buyskin'){const p=SKINS[skinSel][1];if(PROG.dia<p)return denied();PROG.dia-=p;PROG.skins.push(skinSel);PROG.skin=skinSel;saveProg();SFX.kill();hubEquip&&hubEquip()}
 else if(act==='wear'){PROG.skin=skinSel;saveProg();hubEquip&&hubEquip()}
 renderArsenal()});
$('arsClose').onclick=()=>{$('arsenal').classList.add('hidden');stopPreview()};
$('openArsenal').onclick=()=>openArsenal();$('lobArsenal').onclick=()=>openArsenal();$('openShop').onclick=()=>openArsenal(null,'shop');$('openUpg').onclick=()=>openArsenal(null,'upgrade');$('lobShop').onclick=()=>openArsenal(null,'shop');
// ---- settings ----
function openSettings(){$('settings').classList.remove('hidden');$('sens').value=S.sens;$('sensVal').textContent=(+S.sens).toFixed(2);$('aimAssist').checked=S.aimAssist;
 for(const b of $('qualBtns').children)b.classList.toggle('sel',b.dataset.q===S.quality);$('zsens').value=S.zsens;$('zsensVal').textContent=(+S.zsens).toFixed(2);$('qualNow').textContent=S.quality==='auto'?'(auto: '+qLevel()+')':''}
$('zsens').oninput=e=>{S.zsens=+e.target.value;$('zsensVal').textContent=S.zsens.toFixed(2);saveS()};
$('sens').oninput=e=>{S.sens=+e.target.value;$('sensVal').textContent=S.sens.toFixed(2);saveS()};$('aimAssist').onchange=e=>{S.aimAssist=e.target.checked;saveS()};
$('qualBtns').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;const wasLow=qLevel()==='low';S.quality=b.dataset.q;saveS();applyQuality();openSettings()};
$('setClose').onclick=()=>$('settings').classList.add('hidden');$('openSettings').onclick=openSettings;$('lobSettings').onclick=openSettings;
// ================= INPUT =================
const keys={};const inp={mx:0,mz:0,fire:false,jump:false,slide:false,sprint:false,zoom:false};
let lookPX=0,lookPY=0;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(!(inGame&&paused&&!['Escape','Tab','KeyP'].includes(e.code)))keys[e.code]=true;if(!inGame)return;if(paused&&!['Escape','Tab','KeyP'].includes(e.code))return;
 if(e.code==='Space'){inp.jump=true;e.preventDefault()}if(e.code==='KeyC'||e.code==='ControlLeft'){inp.slide=true;e.preventDefault()}
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchTo((me.cur+1)%3);if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=3)switchTo(n-1);if(n===4)useUtil()}
 if(e.code==='KeyG'||e.code==='KeyF')useUtil();if(e.code==='Tab'||e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(e.repeat)return;
  if(!$('arsenal').classList.contains('hidden')){$('arsClose').click();return}if(!$('settings').classList.contains('hidden')){$('setClose').click();return}
  if(e.code==='Tab')openPause(true);else openPause(!paused)}
 if(e.code==='KeyZ'&&!e.repeat)toggleZoom()});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')openPause(false)});
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
for(const id of['bJump','bSwap','bNade']){const b=$(id);
 b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audioInit();b.classList.add('down');if(id==='bSwap')switchTo((me.cur+1)%3);else if(id==='bNade')useUtil();else inp.jump=true});
 const up=()=>b.classList.remove('down');b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
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
 const f=fwd();const p=camera.position.clone().addScaledVector(f,.6);const v=f.clone().multiplyScalar(k==='molotov'?15:17);v.y+=4;v.add(_v.copy(me.vel).multiplyScalar(.5));
 spawnNade(me.id,k,p,v);send({t:'nade',k,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});SFX.throw();throwT=.35}
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
  if(best){const head=part==='head';const dmg=head?w.head:w.body;if(w.bonk)SFX.bonk();if(w.saw)fx.spark(best.rp.clone().setY(best.rp.y+1.1),4,0xb01818,2,.25);send({t:'hit',id:best.id,dmg,head,w:id});showHit(best.rp.clone().setY(best.rp.y+1.5),dmg,head);fx.spark(best.rp.clone().setY(best.rp.y+1.2),6,0xff6a4d,3,.2)}return}
 if(w.proj){me.ammo[me.cur]--;SFX.gun(id,1,0);SFX.whoosh&&SFX.whoosh();kickImp(1.4,w);recoilP+=w.rc[0];muzzle.visible=true;muzzleT=.08;flashOn(1.4);if(vmInfo.cyc==='gl'){VA.cycD=VA.cyc=.35;VA.glFrom=VA.glRot}const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket&&me.ammo[me.cur]<=0)Gr.rocket.visible=false;for(let i=0;i<4;i++)fx.sprite({p:camera.position.clone().addScaledVector(fwd(),-.2).add(_v2.set((Math.random()-.5)*.6,-.1,(Math.random()-.5)*.6)),s0:.3,s1:1.4,life:.8,op:.4,color:0xdddddd,rise:.4});
  const f=fwd();const p=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());p.lerp(camera.position,.5).addScaledVector(f,.4);const v=f.clone().multiplyScalar(w.proj==='rpg'?44:30);if(w.proj==='gl')v.y+=2.5;
  spawnNade(me.id,id,p,v);send({t:'nade',k:id,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});return}
 me.ammo[me.cur]--;SFX.gun(id,1,0);kickImp(1,w);muzzle.visible=true;muzzleT=.045;muzzle.rotation.z=Math.random()*6;muzzle.scale.setScalar(.8+Math.random()*.5+(w.pellets?.45:0)+(vmInfo.pistol?-.2:0));muzzleVariant(w);flashOn(w.pellets?1.3:1);smokeWisp();afterShot(w);
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
  const end=o.clone().addScaledVector(d,Math.min(bt,400));if(w.paint&&(bq||wtt<400))paintSplat(end,wn,me.id);if(i<3){addTracer(mz,end,w.tracer);if(i===0)send({t:'fx',a:mz.toArray().map(v=>+v.toFixed(2)),b:end.toArray().map(v=>+v.toFixed(2)),w:id})}
  if(bq){let dmg=(bp==='head'?w.head:w.body)*falloff(w,bt)*(bp==='legs'?LIMB:1);const h=hits[bq.id]||(hits[bq.id]={dmg:0,head:false,pos:end});h.dmg+=dmg;if(bp==='head')h.head=true;impact(end,wn,true)}
  else if(wtt<400)impact(end,wn,false,ws)}
 for(const k in hits){const h=hits[k];const dmg=Math.max(1,Math.round(h.dmg));send({t:'hit',id:k,dmg,head:h.head,w:id});showHit(h.pos,dmg,h.head)}
 if(me.ammo[me.cur]<=0)setTimeout(reload,180)}
let muzzleT=0;
function updateMe(dt){const id=me.load[me.cur],w=W[id];
 if(isTouch)applyTouchLook(dt);
 let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
 const sprint=(keys.ShiftLeft||keys.ShiftRight||inp.sprint)&&mz<-.3&&me.zoomT<.3&&!paused;
 if(!me.alive||me.frozen){mx=mz=0}
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 const speed=me.down?1.3:(sprint?8.6:5.8)*(me.zoomT>.5?.7:1)*(w.slowSelf||1)*(me.slowT>performance.now()?me.slowF:1);const hs=Math.hypot(me.vel.x,me.vel.z);me.slideCd-=dt;
 if(inp.slide&&me.alive&&!me.frozen&&me.ground&&me.slideT<=0&&me.slideCd<=0&&hs>3.5){const ns=Math.min(14,Math.max(hs,7)*1.5);me.vel.x=me.vel.x/hs*ns;me.vel.z=me.vel.z/hs*ns;me.slideT=.75;me.slideCd=1;SFX.slide()}
 inp.slide=false;
 if(me.slideT>0){me.slideT-=dt;const k=Math.max(0,1-1.4*dt);me.vel.x*=k;me.vel.z*=k;me.vel.x+=wx*dt*6;me.vel.z+=wz*dt*6;if(Math.hypot(me.vel.x,me.vel.z)<4)me.slideT=0}
 else if(me.ground){const a=Math.min(1,dt*13);me.vel.x+=(wx*speed-me.vel.x)*a;me.vel.z+=(wz*speed-me.vel.z)*a}
 else{me.vel.x+=wx*speed*dt*2.5;me.vel.z+=wz*speed*dt*2.5;const n=Math.hypot(me.vel.x,me.vel.z);const cap=Math.max(hs,speed);if(n>cap){me.vel.x*=cap/n;me.vel.z*=cap/n}}
 if(me.down){inp.jump=false;inp.slide=false}if(inp.jump&&me.ground&&me.alive&&!me.frozen){me.vel.y=8.3;if(me.slideT>0){me.vel.x*=1.08;me.vel.z*=1.08;me.slideT=0}SFX.jump()}inp.jump=false;
 {const L=me.alive&&!me.frozen&&inVol(ladders,me.pos);me.onLadder=!!L;me.ladTop=L&&mz<-.25?L.y1:null;if(L){if(mz<-.25||inp.jump)me.vel.y=4.4;else if(mz>.25)me.vel.y=-3.2;else me.vel.y=24*dt;if(mz<-.25){me.vel.x-=L.n[0]*1.5;me.vel.z-=L.n[1]*1.5}}}
 if(me.alive){physStep(me,dt);if(me.landed){SFX.land();landDip=.08}}
 if(me.alive&&me.pos.y<-3){me.alive=false;send({t:'fall'})}
 if(me.ground&&hs>2&&me.slideT<=0){me.stepT-=dt*hs;if(me.stepT<=0){me.stepT=sprint?3.3:2.9;SFX.step()}}
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
 me.cool-=dt;if(me.switchT>0)me.switchT-=dt;throwT=Math.max(0,throwT-dt);meleeT=Math.max(0,meleeT-dt*3);muzzleT-=dt;if(muzzleT<=0)muzzle.visible=false;
 if(me.reloadT>0){const k=1-me.reloadT/reloadOf(id);const cs=VA.cues||[];while(VA.cue<cs.length&&k>=cs[VA.cue][0]){const[,snd,x]=cs[VA.cue++];SFX[snd]&&SFX[snd]();
   if(x==='ammo')me.ammo[me.cur]=Math.min(magOf(id),me.ammo[me.cur]+1);else if(x==='cylEject')for(let i=0;i<6;i++)setTimeout(()=>{if(vmCur)fx.shell(vmToWorld([0,.02,-.02],new THREE.Vector3()),_v.set((Math.random()-.5)*.6,-1.5,(Math.random()-.5)*.6).add(me.vel),'pistol')},i*25);
   else if(x==='hulls')for(let i=0;i<2;i++)fx.shell(vmToWorld([i?.012:-.012,.03,.02],new THREE.Vector3()),_v.set((Math.random()-.5),2.5,1.2).applyQuaternion(camera.quaternion).add(me.vel),'shot')}
  me.reloadT-=dt;if(me.reloadT<=0){me.ammo[me.cur]=magOf(id);const Gr=vmCur&&vmCur.userData.G;if(Gr&&Gr.rocket)Gr.rocket.visible=true}}
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
 if(!w.melee&&me.ammo[me.cur]<=0&&me.reloadT<=0&&me.alive)reload();
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
 const hold=I.hold||'rifle';const hip=I.pistol?[.11,-.11,-.34]:hold==='launcher'?[.13,-.1,-.26]:I.melee||I.util?[.15,-.16,-.36]:[.12,-.13,-.3];
 const sg=I.sight||[0,.06,.15];const adsP=[-sg[0]*.5,-sg[1]*.5,-(I.pistol?.09:vmCur.userData.optic?.07:.06)-sg[2]*.5];
 // reload pose (whole-gun motion) + parts
 let rx=0,ry=0,rz=0,ly=0;for(const k in Gp){const g=Gp[k];g.position.copy(g.userData.base);g.rotation.set(0,0,0)}
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
 vmRoot.visible=me.alive&&!me.down&&!(w.cls==='sniper'&&me.zoomT>.8);vmCam.fov=62;}
function deathCam(dt){const q=me.killer&&C.players[me.killer];// spectate teammate in team modes, else look at killer
 const mates=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!isEnemy(p));
 if(C.mode!=='ffa'&&mates.length&&C.phase==='play'){const t=mates[0];const back=_v.set(Math.sin(t.yaw),0,Math.cos(t.yaw)).multiplyScalar(3.2);camera.position.lerp(_v2.copy(t.rp).add(back).setY(t.rp.y+2.2),Math.min(1,dt*6));camera.lookAt(t.rp.x,t.rp.y+1.4,t.rp.z);return}
 camera.position.y+=((me.pos.y+.6)-camera.position.y)*Math.min(1,dt*3);if(q&&q.alive){const m=new THREE.Matrix4().lookAt(camera.position,_v.copy(q.rp).setY(q.rp.y+1.4),new THREE.Vector3(0,1,0));_q.setFromRotationMatrix(m);camera.quaternion.slerp(_q,Math.min(1,dt*3))}}
function updRemotes(dt){const a=Math.min(1,dt*14);for(const id in C.players){const q=C.players[id];if(!q.model)continue;const u=q.model.userData;
 if(!q.alive&&!u.dead){q.model.visible=false;continue}if(u.dead>3){q.model.visible=false;continue}q.model.visible=true;
 if(q.alive){if(q.rp.distanceTo(q.tp)>6)q.rp.copy(q.tp);else q.rp.lerp(q.tp,a);let dy=q.tyaw-q.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));q.yaw+=dy*a;q.pitch+=(q.tpitch-q.pitch)*a}
 const sp=Math.hypot(q.rp.x-q.lp.x,q.rp.z-q.lp.z)/Math.max(dt,.001);q.lp.copy(q.rp);q.spd=(q.spd||0)+(sp-(q.spd||0))*Math.min(1,dt*8);
 if(q.wid!=null)setRemoteGun(q,q.wid);q.model.position.copy(q.rp);q.model.rotation.y=q.yaw;animate(q.model,{speed:q.spd,air:!!(q.flags&2),slide:!!(q.flags&5),pitch:q.pitch},dt);if(q.flags&4){q.model.position.y-=.35;q.model.rotation.x=-.35}else q.model.rotation.x=0}}
// ================= LOOP =================
renderer.autoClear=false;renderer.info.autoReset=false;
let last=performance.now(),acc=0,frames=0,fpsShown=0;const fpsLog=[];
function floorAt(p){return 0}
let lastHostTick=performance.now();function hostStep(){const n=performance.now();const dt=Math.min(.1,(n-lastHostTick)/1000);lastHostTick=n;if(isHost)hostTick(dt)}
// keep host simulation alive even when its tab/frame loop is throttled
setInterval(()=>{if(performance.now()-lastHostTick>120)hostStep()},50);
let slowWin=0;function loop(now){requestAnimationFrame(loop);const el=now-last;if(el<15.2)return;last=now;const dt=Math.min(.05,el/1000);
 hostStep();
 if(inGame){updateMe(dt);updRemotes(dt);updTracers(dt);updNades(dt);updUtil(dt);updHub(dt,now);fx.update(dt,floorAt);updDmg(dt);if(cur&&cur.water&&cur.water.material.map)cur.water.material.map.offset.x+=dt*.01;WT.value=now/1000%1000;GRASS_T.value=now/1000%1000;updDust(dt,now/1000);
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
function hubSendHi(){hubSend({t:'hi',kind:hubKind,name:myName(),skin:PROG.skin})}
function hubEquip(){if(C.hub)hubSend({t:'eq',name:myName(),skin:PROG.skin})}
class HubServer{constructor(peer,n){this.peer=peer;this.n=n;this.cl={};this.ord=0;this.rooms={};this.sel={};this.ffaT=Date.now();this.ffaN=0;this.lastPads='';
  peer.on('connection',c=>{c.on('data',d=>this.recv(c.peer,d,c));c.on('close',()=>this.drop(c.peer));c.on('error',()=>this.drop(c.peer))});this.iv=setInterval(()=>this.tick(),125)}
 shutdown(){clearInterval(this.iv);try{this.peer.destroy()}catch(e){}}
 send(c,m){if(c.local)queueMicrotask(()=>hubRecv(m));else if(c.conn&&c.conn.open)c.conn.send(m)}
 players(){return Object.values(this.cl).filter(c=>c.kind==='player')}
 bc(m,except){for(const id in this.cl){const c=this.cl[id];if(c.kind==='player'&&id!==except)this.send(c,m)}}
 recv(id,m,conn){let c=this.cl[id];
  if(m.t==='hi'){if(c&&c.kind!==m.kind&&m.kind==='player'){c.kind='player'}
   else if(!c){if(m.kind==='player'&&this.players().length>=HUB_MAX){conn&&conn.send({t:'hubfull'});return}
    c=this.cl[id]={id,conn,local:!conn,kind:m.kind,ord:++this.ord,pos:[0,0,5,0],busy:false}}
   c.name=String(m.name||'Player').slice(0,12);c.skin=SKINS[m.skin]?m.skin:'default';
   if(c.kind==='player'){this.send(c,{t:'hw',you:c.ord,n:this.n,players:this.players().filter(p=>p!==c).map(p=>[p.ord,p.name,p.skin,...p.pos])});this.bc({t:'hj',p:[c.ord,c.name,c.skin]},id);this.lastPads=''}
   else this.send(c,{t:'hw',you:c.ord,n:this.n});return}
  if(!c)return;
  switch(m.t){
   case 'pos':if(Array.isArray(m.p))c.pos=m.p.slice(0,4).map(v=>+v||0);break;
   case 'eq':c.skin=SKINS[m.skin]?m.skin:c.skin;c.name=String(m.name||c.name).slice(0,12);this.bc({t:'hj',p:[c.ord,c.name,c.skin]},id);break;
   case 'vote':{const s=this.sel[m.sid];if(s&&s.ids.includes(id)&&s.maps.includes(m.map)){s.votes[id]=m.map;this.toSel(s,{t:'votes',sid:s.id,votes:Object.values(s.votes)})}break}
   case 'reg':if(m.room&&m.room.code)this.rooms[m.room.code]={...m.room,at:Date.now(),by:id};break;
   case 'unreg':delete this.rooms[m.code];break;
   case 'list':this.send(c,{t:'rooms',list:this.roomList(),hub:this.players().length});break;
   case 'ping':this.send(c,{t:'pong',ts:m.ts});break}}
 roomList(){const now=Date.now();for(const k in this.rooms)if(now-this.rooms[k].at>16000)delete this.rooms[k];return Object.values(this.rooms).map(r=>({code:r.code,host:r.host,mode:r.mode,map:r.map,n:r.n,max:r.max,phase:r.phase}))}
 drop(id){const c=this.cl[id];if(!c)return;delete this.cl[id];for(const k in this.rooms)if(this.rooms[k].by===id)delete this.rooms[k];if(c.kind==='player'){this.bc({t:'hl',o:c.ord});this.lastPads=''}}
 tick(){const now=Date.now();const ps=this.players();const free=ps.filter(p=>!p.busy);
  // queue = who is physically standing inside each circle (server-side check, so leaving a circle unqueues instantly)
  const st={};for(const p of HUB_PADS){st[p.k]={};for(const c of padCircles(p))st[p.k][c.side]=free.filter(q=>Math.hypot(q.pos[0]-c.x,q.pos[2]-c.z)<c.r).sort((a,b)=>a.ord-b.ord).slice(0,p.n).map(q=>q.id)}
  const key=JSON.stringify(st);if(key!==this.lastPads){this.lastPads=key;const o={};for(const k in st){o[k]={};for(const s in st[k])o[k][s]=st[k][s].map(id=>this.cl[id].ord)}this.bc({t:'pads',q:o});
   if(st.ffa.F.length!==this.ffaN){this.ffaN=st.ffa.F.length;this.ffaT=now}}
  for(const p of HUB_PADS){const s=st[p.k];if(p.single){const n=s.F.length;if(n>=p.n||(n>=2&&now-this.ffaT>15000)){this.startSel(p,s);this.ffaT=now}}else if(s.A.length>=p.n&&s.B.length>=p.n)this.startSel(p,s)}
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
  this.toSel(s,{t:'go',code,map,mode:s.mode,host:alive[0],teams,expect:alive.length})}}
// ---------- hub client ----------
let lastPad=null;let hubVis=null,padLabels={},myPads=null,hubSel=null,hubPosT=0,brCb=null;
function enterHub(){if(qLevel()==='low'&&false)return;audioInit();C.hub=true;menuMsg('Connecting to the hub…');hubKind='player';hubLink('player')}
function hubRecv(m){switch(m.t){
 case 'hw':hubOrd=m.you;if(hubKind==='player'&&C.hub)enterHubWorld(m);if(brCb)hubSend({t:'list'});if(regIv&&H.pub)hubSend({t:'reg',room:roomInfo()});break;
 case 'hubfull':if(hubN<HUB_LIMIT){hubN++;if(hubConn&&!hubConn.local)hubConn.close();hubConn=null;tryHub()}else menuMsg('All hubs are full — try Quick Join');break;
 case 'hj':if(C.hub&&C.phase==='hub'&&m.p[0]!==hubOrd){const[o,n,sk]=m.p;const id='h'+o;const old=C.players[id];addRemote(id,{name:n,team:'A',color:FFACOL[o%10],sk,o:'h'+o});const q=C.players[id];q.alive=true;if(old){q.tp.copy(old.tp);q.rp.copy(old.rp)}if(q.model)q.model.visible=true}break;
 case 'hl':{const q=C.players['h'+m.o];if(q){if(q.model)scene.remove(q.model);delete C.players['h'+m.o]}break}
 case 'hpos':if(C.phase==='hub')for(const r of m.p){const q=C.players['h'+r[0]];if(!q)continue;q.tp.set(r[1]/100,r[2]/100,r[3]/100);q.tyaw=r[4]/100;if(!q.seen){q.seen=1;q.rp.copy(q.tp)}}break;
 case 'pads':myPads=m.q;updPadLabels();break;
 case 'sel':openMapSel(m);break;
 case 'votes':if(hubSel&&hubSel.sid===m.sid){hubSel.votes=m.votes;renderMapSel()}break;
 case 'go':startHubMatch(m);break;
 case 'rooms':if(brCb)brCb(m.list,m.hub);break}}
function enterHubWorld(m){setTimeout(()=>{if(C.hub&&Object.keys(THUMB).length<MAPS.length)renderThumbs()},2500);for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.byOrd={};C.mode='hub';C.phase='hub';C.map=HUB_I;C.sb={};C.score={};
 loadMap(HUB_I);buildPadVis();for(const s of['menu','lobby','arsenal','settings','browser'])$(s).classList.add('hidden');
 $('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);$('hubUI').classList.remove('hidden');document.body.classList.add('hub');
 inGame=true;resize();const a=Math.random()*6.28;me.pos.set(Math.cos(a)*2.5,0,4+Math.sin(a)*2);me.vel.set(0,0,0);me.yaw=Math.PI;me.pitch=-.05;me.hp=100;me.alive=true;me.frozen=false;me.id='hub-me';
 if(sessionStorage.getItem('hsz_requeue')){sessionStorage.removeItem('hsz_requeue');try{const lp=JSON.parse(sessionStorage.getItem('hsz_pad')||'null');const P=lp&&HUB_PADS.find(p=>p.k===lp[0]);const c=P&&padCircles(P).find(c=>c.side===lp[1]);if(c){me.pos.set(c.x,0,c.z);me.yaw=c.side==='A'?-Math.PI/2:c.side==='B'?Math.PI/2:Math.PI;center('⚔️ Re-queued — waiting for players',2500)}}catch(e){}}
 setViewModel(me.load[0]);buildSlots();updHP();for(const r of m.players||[]){hubRecv({t:'hj',p:[r[0],r[1],r[2]]});const q=C.players['h'+r[0]];if(q){q.tp.set(r[3],r[4],r[5]);q.rp.copy(q.tp);q.seen=1}}
 center('🏠 HEADSHOTZ HUB\nWalk onto a glowing circle to queue',3500);updHubInfo()}
function updHubInfo(){const n=Object.keys(C.players).length+1;$('hubInfo').innerHTML=`<b>HUB #${hubN}</b> · ${n} online · 💎 <b class="diaBal">${PROG.dia}</b>${hubSrv?' · <small>you host the hub</small>':''}`}
function labelTex(lines,col){const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');x.textAlign='center';x.fillStyle='rgba(10,14,35,.6)';x.beginPath();x.roundRect?x.roundRect(16,16,480,160,36):x.rect(16,16,480,160);x.fill();
 x.fillStyle=col;x.font='900 70px system-ui,Arial Black,sans-serif';x.fillText(lines[0],256,88);x.fillStyle='#fff';x.font='800 50px system-ui,sans-serif';x.fillText(lines[1]||'',256,150);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function buildPadVis(){if(hubVis){scene.remove(hubVis.g)}const g=new THREE.Group();hubVis={g,rings:[],labels:{}};
 const COL={A:0x3fa9ff,B:0xff5a6b,F:0xffd23f};
 for(const p of HUB_PADS)for(const c of padCircles(p)){const col=new THREE.Color(COL[c.side]);
  const ring=new THREE.Mesh(new THREE.RingGeometry(c.r-.16,c.r,56),new THREE.MeshBasicMaterial({color:col.clone().multiplyScalar(2.6),side:THREE.DoubleSide,toneMapped:true}));ring.rotation.x=-Math.PI/2;ring.position.set(c.x,.1,c.z);
  const fill=new THREE.Mesh(new THREE.CircleGeometry(c.r-.16,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending}));fill.rotation.x=-Math.PI/2;fill.position.set(c.x,.09,c.z);
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex([MODES[p.k][0].split(' ')[0],'0/'+p.n],'#'+col.getHexString()),depthWrite:false,transparent:true}));spr.scale.set(3.2,1.2,1);spr.position.set(c.x,2.9,c.z);
  g.add(ring,fill,spr);hubVis.rings.push({ring,fill,c,p});hubVis.labels[p.k+c.side]={spr,col:'#'+col.getHexString(),p,c}}
 for(const s of HUB_ST){const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex([s.name.split(' ')[0],s.name.split(' ').slice(1).join(' ')],'#ffd23f'),depthWrite:false,transparent:true}));spr.scale.set(3.6,1.35,1);spr.position.set(s.x+(s.k==='practice'?0:1.2),4.3,s.z);g.add(spr)}
 scene.add(g);updPadLabels()}
function updPadLabels(){if(!hubVis)return;for(const k in hubVis.labels){const L=hubVis.labels[k];const n=myPads&&myPads[L.p.k]?(myPads[L.p.k][L.c.side]||[]).length:0;const side=L.c.side==='A'?'BLUE':L.c.side==='B'?'RED':'FFA';
  const key=n+'';if(L.k===key)continue;L.k=key;L.spr.material.map.dispose();L.spr.material.map=labelTex([MODES[L.p.k][0].split(' ')[0]+' '+side,`${n}/${L.p.n}`],L.col);L.spr.material.needsUpdate=true}
 let mine=null;if(myPads)for(const k in myPads)for(const s in myPads[k])if(myPads[k][s].includes(hubOrd))mine=[k,s];if(mine)lastPad=mine;
 $('padInfo').textContent=mine?`Queued: ${MODES[mine[0]][0]} · ${mine[1]==='A'?'BLUE':mine[1]==='B'?'RED':'FFA'} side — waiting for players… step off to leave`:''}
function updHub(dt,now){if(C.phase!=='hub')return;hubPosT+=dt;if(hubPosT>=.125){hubPosT=0;hubSend({t:'pos',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(2)]})}
 if(hubVis)for(const r of hubVis.rings){const inside=Math.hypot(me.pos.x-r.c.x,me.pos.z-r.c.z)<r.c.r;const s=1+Math.sin(now/300+r.c.x)*.015;r.ring.scale.setScalar(s);r.fill.material.opacity=inside?.34+Math.sin(now/150)*.08:.14}
 let st=null,bd=3.2;for(const s of HUB_ST){const d=Math.hypot(me.pos.x-s.x,me.pos.z-s.z);if(d<bd){bd=d;st=s}}const b=$('stationBtn');if(st){b.textContent='TAP: '+st.name;b.dataset.k=st.k;b.classList.remove('hidden')}else b.classList.add('hidden');
 if(Math.random()<dt)updHubInfo()}
function useStation(k){if(k==='shop')openArsenal(null,'shop');else if(k==='upgrade')openArsenal(null,'upgrade');else if(k==='arsenal')openArsenal();else if(k==='practice'){location.href=location.pathname+'?offline=1'+(/[?&]net=local/.test(location.search)?'&net=local':'')}}
$('stationBtn').onclick=()=>useStation($('stationBtn').dataset.k);
// ---------- map selection (5 s, majority wins, random tie-break on the hub host) ----------
let mapSelIv=null;
function openMapSel(m){hubSel={sid:m.sid,maps:m.maps,votes:[],mine:-1,end:performance.now()+m.ms,mode:m.mode,names:m.names};$('mapSel').classList.remove('hidden');SFX.kill();renderMapSel();
 clearInterval(mapSelIv);mapSelIv=setInterval(()=>{const left=Math.max(0,Math.ceil((hubSel.end-performance.now())/1000));$('mapSelT').textContent=left;if(left<=0)clearInterval(mapSelIv)},200);if(Object.keys(THUMB).length<MAPS.length)renderThumbs(()=>renderMapSel())}
function renderMapSel(){if(!hubSel)return;$('mapSelSub').textContent=`${MODES[hubSel.mode][0]} · ${hubSel.names.join(', ')}`;
 const tv=hubSel.votes.length;$('mapSelList').innerHTML=hubSel.maps.map(i=>{const v=hubSel.votes.filter(x=>x===i).length;const pct=tv?Math.round(v/tv*100):Math.round(100/hubSel.maps.length);return`<button class="map${hubSel.mine===i?' sel':''}" data-ms="${i}" style="${THUMB[i]?`background-image:url(${THUMB[i]})`:''}"><span class="vc">${pct}%${v?` · ${v}🗳️`:''}</span><span class="mn">${MAPS[i].icon} ${MAPS[i].name}<small>${MAPS[i].desc}</small></span></button>`}).join('')}
$('mapSelList').addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b||!hubSel)return;hubSel.mine=+b.dataset.ms;hubSend({t:'vote',sid:hubSel.sid,map:hubSel.mine});SFX.swap();renderMapSel()});
function startHubMatch(m){clearInterval(mapSelIv);$('mapSelT').textContent='GO';center(`${MAPS[m.map].icon} ${MAPS[m.map].name}\nStarting ${MODES[m.mode][0]}…`,3000);
 const auto={mode:m.mode,map:m.map,teams:m.teams,expect:m.expect,fromHub:1};
 setTimeout(()=>{$('mapSel').classList.add('hidden');hubUnlink();leaveHubWorld();C.fromHub=true;sessionStorage.setItem('hsz_fromHub','1');sessionStorage.setItem('hsz_pad',JSON.stringify(lastPad));
  if(m.host===hubSelfId)createRoom(m.code,auto);else setTimeout(()=>joinRoom(m.code,auto),900+Math.random()*400)},900)}
function leaveHubWorld(){C.hub=false;document.body.classList.remove('hub');$('hubUI').classList.add('hidden');if(hubVis){scene.remove(hubVis.g);hubVis=null}for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};inGame=false;C.phase='lobby';$('hud').classList.add('hidden')}
function setupAuto(){const a=H.auto;H.mode=a.mode;H.fill=true;H.pub=false;H.diff='normal';H.autoAt=H.t+12;sendLobby()}
let sbDirty=0;setInterval(()=>{if(sbDirty&&inGame){sbDirty=0;renderSB()}},250);
// between-round loadout pick (like duel games: swap weapons while the next round loads)
function showRL(on){$('rlBtn').classList.toggle('hidden',!on||C.hub||!inGame)}
$('rlBtn').onclick=()=>{if(typeof openArsenal==='function')openArsenal()};
// end-of-match results screen: VICTORY/DEFEAT, score, your stats, diamonds, rematch / lobby
let endIv=null;function hideEnd(){$('endScr').classList.add('hidden');document.body.classList.remove('endOn');if(endIv){clearInterval(endIv);endIv=null}}
function showEnd(m,mine){showRL(false);const s=C.sb[me.id]||{k:0,d:0,hs:0,pts:0};const sc=C.score||{};
 const ffa=C.mode==='ffa';$('endT').textContent=mine?'VICTORY':'DEFEAT';$('endScr').classList.toggle('win',!!mine);
 $('endScore').innerHTML=ffa?`<b>${esc(m.name)}</b> wins`:`<span class="a">${sc.A||0}</span> – <span class="b">${sc.B||0}</span>`;
 const ps=Object.values(C.players).map(q=>[q,C.sb[q.id]||{k:0,d:0,pts:0}]).sort((a,b)=>b[1].pts-a[1].pts);const mvp=ps[0];
 $('endStats').innerHTML=`<div><b>${s.k}</b><small>KILLS</small></div><div><b>${s.d}</b><small>DEATHS</small></div><div><b>${s.hs||0}</b><small>HEADSHOTS</small></div><div><b>💎 ${C.matchDia||0}</b><small>EARNED</small></div>`+(mvp?`<p>⭐ MVP: <b style="color:${hex(mvp[0].color)}">${esc(mvp[0].name)}</b></p>`:'');
 let t=12;const lb=$('endLobby');lb.textContent=`LOBBY (${t})`;$('endScr').classList.remove('hidden');document.body.classList.add('endOn');if(document.pointerLockElement)document.exitPointerLock();
 endIv=setInterval(()=>{t--;lb.textContent=`LOBBY (${t})`;if(t<=0){hideEnd();endGo(false)}},1000)}
function endGo(again){hideEnd();if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');if(again)sessionStorage.setItem('hsz_requeue','1');location.href=hubUrl();return}
 if(isHost&&H.phase==='roundEnd'){H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}}
$('endAgain').onclick=()=>endGo(true);$('endLobby').onclick=()=>endGo(false);
function afterMatch(){if(C.fromHub||sessionStorage.getItem('hsz_fromHub')){sessionStorage.removeItem('hsz_fromHub');location.href=hubUrl()}}
// ---------- public rooms: registry, browser, quick join ----------
let regIv=null;
function roomInfo(){return{code:roomCode,host:H.players[me.id]?.name||'Host',mode:H.mode,map:H.phase==='lobby'?'Voting':MAPS[H.map].name,n:plist().filter(p=>!p.bot).length,max:MODEMAX[H.mode]||10,phase:H.phase}}
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
{const q=new URLSearchParams(location.search);if(q.get('hub'))setTimeout(enterHub,50);else if(q.get('offline'))setTimeout(()=>$('offlineBtn').click(),50)}
window.__hsz={inp,PROG,shootAt:(pid)=>{const q=(H&&H.players[pid])||C.players[pid];if(!q||!me.alive)return 'na';let p=(q.e&&q.e.pos)||q.pos;if(Array.isArray(p))p={x:p[0],y:p[1],z:p[2]};if(!p&&q.p)p={x:q.p[0],y:q.p[1],z:q.p[2]};if(!p||!isFinite(p.x))return 'nopos';const e=new THREE.Vector3(me.pos.x,me.pos.y+1.62,me.pos.z);const dx=p.x-e.x,dy=(p.y+1.3)-e.y,dz=p.z-e.z;me.yaw=Math.atan2(-dx,-dz);me.pitch=Math.atan2(dy,Math.hypot(dx,dz));camera.position.copy(e);camera.rotation.set(me.pitch,me.yaw,0,'YXZ');camera.updateMatrixWorld();me.cool=0;fire();return 'ok'},gunGroup,THREE,endGo:(a)=>endGo(a),damage:(...a)=>damage(...a),VA,reload,setViewModel,get vmCur(){return vmCur},fireTest:(id)=>{const o=window.__spy;const realSend=send;setViewModel(id);camera.position.set(me.pos.x,me.pos.y+1.62,me.pos.z);camera.rotation.set(me.pitch,me.yaw,0);camera.updateMatrixWorld();__spyOn=o;try{fire()}finally{__spyOn=null}},C,H,me,send,W,MAPS,buildMap,fpsLog,renderer,get isHost(){return isHost},get cols(){return cols},setCols:(c)=>{cols=c},roundSpawns,respawnPoint,switchTo,fire,useUtil,setLoad:(l)=>{me.load=l},toggleZoom,camera,get paused(){return paused},get qLevel(){return qLevel()},S,applyQuality,get cur(){return cur}};

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
