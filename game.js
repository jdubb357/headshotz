// HeadShotz – free browser multiplayer FPS. Three.js + PeerJS (host-authoritative star).
import {THREE,FX,TX,MC,G,mergeParts} from './gfx.js';
import {MAPS,buildMap} from './maps.js';
import {W,CLASSES,LIMB,falloff,stats,gunParts,handParts} from './weapons.js';
import {makeCharacter,animate} from './chars.js';
const $=id=>document.getElementById(id);
const GAME='HeadShotz';
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const MODES={duel:['1v1 Duel','⚔️'],team:['2v2 Teams','👥'],ffa:['Free-For-All','💥']};
const WIN_ROUNDS=5,FFA_ROUND_KILLS=3;
const TEAMCOL={A:0x3fa9ff,B:0xff5a6b};
const FFACOL=[0x3fa9ff,0xff5a6b,0x2ee59d,0xffd23f,0xb06bff,0xff9f43,0x1dd1a1,0xff79c6];
const hex=c=>'#'+new THREE.Color(c).getHexString();
const LS=k=>{try{return localStorage.getItem('hsz_'+k)}catch(e){return null}},LSS=(k,v)=>{try{localStorage.setItem('hsz_'+k,v)}catch(e){}};
// ---------------- settings ----------------
const S=Object.assign({sens:1,aimAssist:true,quality:'auto'},JSON.parse(LS('settings')||'{}'));
function saveS(){LSS('settings',JSON.stringify(S))}
// ---------------- renderer ----------------
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch,powerPreference:'high-performance',stencil:false});
let pixelRatio=1;function basePR(){return S.quality==='low'?Math.min(devicePixelRatio,1):S.quality==='high'?Math.min(devicePixelRatio,2):Math.min(devicePixelRatio,isTouch?1.3:1.5)}
pixelRatio=basePR();renderer.setPixelRatio(pixelRatio);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75,1,.03,600);camera.rotation.order='YXZ';scene.add(camera);
const hemi=new THREE.HemisphereLight(0xffffff,0x666666,1.3);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.6);scene.add(sun);
const fx=new FX(scene);
let inGame=false;
function resize(){document.body.classList.toggle('playing',inGame);const vv=window.visualViewport;const w=Math.round(vv?vv.width:innerWidth)||innerWidth,h=Math.round(vv?vv.height:innerHeight)||innerHeight;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();$('rotate').classList.toggle('need',isTouch&&inGame)}
addEventListener('resize',resize);addEventListener('orientationchange',()=>{resize();setTimeout(resize,300);setTimeout(resize,900)});
if(window.visualViewport)visualViewport.addEventListener('resize',resize);
// iOS gesture guards (menus still scroll)
for(const ev of['gesturestart','gesturechange','gestureend'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1){e.preventDefault();return}if(inGame&&!e.target.closest('#pause,#arsenal,#settings'))e.preventDefault()},{passive:false});
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
 gun(id,vol=1,pan=0){const w=W[id];if(!AC||!w)return;const s=w.snd||{f:1500,d:.1,b:120,v:.5};const d=out(pan);const v=s.v*vol;
  noise('bandpass',s.f*1.6,.9,s.d*.5,v*.9,d,.4);noise('lowpass',s.f,.7,s.d,v,d,.6);tone(s.b,s.d*.9,v*.9,'sine',s.b*.4,d);
  if(s.crack)noise('highpass',3500,.7,.05,v*.7,d,.2);if(w.pellets)noise('lowpass',500,.5,s.d*1.4,v*.6,d,.5)},
 melee(){noise('bandpass',900,1.2,.14,.25,out(),0,.04)},hit(){tone(1250,.05,.18,'square',0,out());tone(2500,.04,.08,'sine',0,out())},
 head(){tone(1700,.07,.22,'square',0,out());setTimeout(()=>tone(2600,.1,.2,'triangle',0,out()),45)},
 hurt(){tone(180,.18,.25,'sawtooth',90,out());noise('lowpass',400,.5,.12,.2,out())},
 step(){noise('lowpass',260+Math.random()*120,.8,.06,.14,out())},land(){noise('lowpass',200,.8,.1,.25,out())},
 jump(){noise('lowpass',500,.6,.08,.12,out())},slide(){noise('bandpass',1500,.5,.4,.12,out(),0,.05)},
 magOut(){tone(900,.03,.12,'square',0,out());noise('bandpass',2500,4,.04,.15,out())},magIn(){tone(600,.03,.15,'square',0,out());noise('bandpass',1800,4,.05,.2,out())},
 bolt(){noise('bandpass',3000,3,.05,.2,out());setTimeout(()=>noise('bandpass',2200,3,.06,.2,out()),110)},
 shell(){setTimeout(()=>tone(5200+Math.random()*1500,.05,.03,'sine',0,out()),300+Math.random()*200)},
 swap(){noise('bandpass',2000,2,.06,.12,out())},
 boom(vol=1,pan=0){const d=out(pan);noise('lowpass',380,.6,1,.9*vol,d,.7);tone(70,.8,.7*vol,'sine',28,d);noise('bandpass',1500,.8,.25,.4*vol,d,.5)},
 bang(vol=1){const d=out();noise('highpass',1200,.5,.4,.9*vol,d,.6);tone(3600,2.5*vol,.06*vol,'sine',3400,d)},
 whoosh(){noise('bandpass',700,.6,.6,.35,out(),.3,.05)},hiss(){noise('highpass',2500,.5,1.5,.12,out(),0,.2)},
 kill(){tone(660,.09,.2,'triangle',0,out());setTimeout(()=>tone(990,.14,.2,'triangle',0,out()),90)},
 beep(f=700){tone(f,.12,.18,'sine',0,out())},heal(){tone(500,.25,.2,'sine',1000,out())},throw(){noise('bandpass',600,.8,.18,.2,out(),0,.03)}};
// ---------------- map / collision ----------------
let cur=null,cols=[],groundHalf=[1e9,1e9];
function loadMap(i){if(cur){scene.remove(cur.group);if(cur.sky)scene.remove(cur.sky)}cur=buildMap(i);cols=cur.cols;groundHalf=cur.groundHalf;
 scene.add(cur.group);if(cur.sky)scene.add(cur.sky);const d=cur.def;
 scene.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);scene.fog=new THREE.Fog(d.fog[0],d.fog[1],d.fog[2]);
 hemi.color.set(d.hemi[0]);hemi.groundColor.set(d.hemi[1]);hemi.intensity=d.hemi[2];sun.color.set(d.sun[0]);sun.intensity=d.sun[1];sun.position.copy(cur.sunDir).multiplyScalar(50);
 fx.dec.count=0;fx.decI=0;fx.scor.count=0;fx.scorI=0;smokes.length=0;fires.length=0}
const PR=.35,PH=1.8;
function overlaps(p,c,h){return p.x+PR>c.x0&&p.x-PR<c.x1&&p.z+PR>c.z0&&p.z-PR<c.z1&&p.y+h>c.y0&&p.y<c.y1}
function onFloor(p){return Math.abs(p.x)<groundHalf[0]&&Math.abs(p.z)<groundHalf[1]}
function physStep(e,dt){const p=e.pos,v=e.vel;v.y-=24*dt;if(v.y<-40)v.y=-40;const wasG=e.ground;
 for(const ax of['x','z']){p[ax]+=v[ax]*dt;for(const c of cols){if(!overlaps(p,c,PH))continue;
   if(c.y1-p.y<=.55&&(e.ground||v.y<=0)){let ok=true;const oy=p.y;p.y=c.y1+.001;for(const c2 of cols)if(c2!==c&&overlaps(p,c2,PH)){ok=false;break}if(ok)continue;p.y=oy}
   const mid=ax==='x'?(c.x0+c.x1)/2:(c.z0+c.z1)/2;if(p[ax]<mid)p[ax]=(ax==='x'?c.x0:c.z0)-PR-.001;else p[ax]=(ax==='x'?c.x1:c.z1)+PR+.001;v[ax]=0;e.bump=1}}
 p.y+=v.y*dt;e.ground=false;
 for(const c of cols){if(!overlaps(p,c,PH))continue;if(v.y<=0&&p.y>c.y1-.6){p.y=c.y1;e.ground=true}else if(v.y>0){p.y=c.y0-PH-.001}v.y=Math.min(0,v.y)}
 if(p.y<0&&onFloor(p)&&p.y>-1){p.y=0;v.y=0;e.ground=true}
 e.landed=!wasG&&e.ground}
let hitN=new THREE.Vector3();
function rayBox(o,d,x0,y0,z0,x1,y1,z1,n){let tmin=0,tmax=1e9,ax=-1,sg=0;
 for(let a=0;a<3;a++){const od=a===0?o.x:a===1?o.y:o.z,dd=a===0?d.x:a===1?d.y:d.z,lo=a===0?x0:a===1?y0:z0,hi=a===0?x1:a===1?y1:z1;
  if(Math.abs(dd)<1e-9){if(od<lo||od>hi)return Infinity;continue}let t1=(lo-od)/dd,t2=(hi-od)/dd,s=-1;if(t1>t2){const t=t1;t1=t2;t2=t;s=1}if(t1>tmin){tmin=t1;ax=a;sg=s}if(t2<tmax)tmax=t2;if(tmin>tmax)return Infinity}
 if(n){n.set(0,0,0);if(ax>=0)n.setComponent(ax,sg)}return tmin}
const _n=new THREE.Vector3();
function rayWorld(o,d,max=400){let t=max;hitN.set(0,1,0);for(const c of cols){const r=rayBox(o,d,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1,_n);if(r<t&&r>0){t=r;hitN.copy(_n)}}
 if(d.y<0&&onFloor(o)&&o.y>=0){const g=-o.y/d.y;if(g<t){t=g;hitN.set(0,1,0)}}return t}
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
function gunGroup(id,withHands=false,sleeve){const{parts,info}=gunParts(id);const g=new THREE.Group();
 const metal=parts.filter(p=>p.mat==='metal'),matte=parts.filter(p=>p.mat!=='metal');
 if(metal.length)g.add(new THREE.Mesh(mergeParts(metal),MC.metal));if(matte.length)g.add(new THREE.Mesh(mergeParts(matte),MC.matte));
 if(withHands){const hp=handParts(info,sleeve);if(hp.length)g.add(new THREE.Mesh(mergeParts(hp),MC.matte))}g.userData.info=info;return g}
const ICON={};
function fitCam(obj,cam,side=true,pad=1.15){const bb=new THREE.Box3().setFromObject(obj);const c=bb.getCenter(new THREE.Vector3()),s=bb.getSize(new THREE.Vector3());
 const r=Math.max(s.z/cam.aspect,s.y,s.x*.6)*pad;const dist=r/(2*Math.tan(cam.fov*Math.PI/360));if(side){cam.position.set(c.x+dist,c.y+dist*.12,c.z+dist*.06)}else cam.position.set(c.x+dist*.85,c.y+dist*.35,c.z+dist*.5);cam.lookAt(c)}
function renderIcons(){const R=r2();R.setSize(192,96);prevCam.aspect=2;prevCam.updateProjectionMatrix();
 for(const id in W){const g=gunGroup(id);if(id==='fists'){const{info}=gunParts('fists');const hp=handParts(info);g.add(new THREE.Mesh(mergeParts(hp),MC.matte));g.rotation.y=-Math.PI/2}
  if(W[id].cls==='util')g.scale.setScalar(2.2);prevScene.add(g);fitCam(g,prevCam,true,W[id].cls==='util'?1.6:1.08);R.setClearColor(0,0);R.render(prevScene,prevCam);ICON[id]=R.domElement.toDataURL();prevScene.remove(g);
  g.traverse(o=>o.geometry&&o.geometry.dispose())}}
let prevObj=null,prevOn=false,prevT=0;
function startPreview(id){const R=r2();const box=$('arsPrev');if(R.domElement.parentNode!==box){box.innerHTML='';box.appendChild(R.domElement)}
 const w=box.clientWidth||320,h=box.clientHeight||150;R.setSize(w,h);prevCam.aspect=w/h;prevCam.updateProjectionMatrix();
 if(prevObj){prevScene.remove(prevObj);prevObj.traverse(o=>o.geometry&&o.geometry.dispose())}prevObj=gunGroup(id);if(id==='fists'){const hp=handParts(gunParts('fists').info);prevObj.add(new THREE.Mesh(mergeParts(hp),MC.matte))}
 if(W[id].cls==='util')prevObj.scale.setScalar(2.4);const piv=new THREE.Group();piv.add(prevObj);const bb=new THREE.Box3().setFromObject(prevObj);prevObj.position.sub(bb.getCenter(new THREE.Vector3()));prevObj=piv;prevScene.add(piv);
 fitCam(piv,prevCam,false,1.25);prevCam.position.set(0,.05,1);const s=new THREE.Box3().setFromObject(piv).getSize(new THREE.Vector3());const r=Math.max(s.x,s.y,s.z);const hf=2*Math.atan(Math.tan(prevCam.fov*Math.PI/360)*prevCam.aspect),vf=prevCam.fov*Math.PI/180;const dist=Math.max((r/2)/Math.tan(hf/2),(Math.max(s.y,r*.3)/2)/Math.tan(vf/2))*1.25;prevCam.position.set(dist,dist*.12,0);prevCam.lookAt(0,0,0);prevT=0;
 if(!prevOn){prevOn=true;const loop=()=>{if(!prevOn)return;requestAnimationFrame(loop);if(prevObj){prevT+=.016;prevObj.rotation.y=Math.sin(prevT*.9)*.5}R.setClearColor(0,0);R.render(prevScene,prevCam)};loop()}}
function stopPreview(){prevOn=false}
const THUMB={};
function renderThumbs(cb){let i=0;const next=()=>{if(i>=MAPS.length){cb&&cb();return}const k=i++;if(THUMB[k]){next();return}
  try{const R=r2();R.setSize(320,180);const m=buildMap(k);const sc=new THREE.Scene();sc.add(m.group);if(m.sky)sc.add(m.sky);const d=m.def;sc.background=new THREE.Color(d.indoor?d.fog[0]:d.sky[1]);
   sc.add(new THREE.HemisphereLight(d.hemi[0],d.hemi[1],d.hemi[2]));const sl=new THREE.DirectionalLight(d.sun[0],d.sun[1]);sl.position.copy(m.sunDir);sc.add(sl);
   const cam=new THREE.PerspectiveCamera(50,16/9,.5,800);const[sx,sz]=d.size;if(d.indoor){cam.position.set(0,sz*1.3,sz*.6);R.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),3.1)]}else cam.position.set(-sx*.15,Math.max(sx,sz)*.55,sz*.75);cam.lookAt(0,0,0);
   R.setClearColor(0,1);R.render(sc,cam);R.clippingPlanes=[];THUMB[k]=R.domElement.toDataURL('image/jpeg',.8);sc.clear()}catch(e){console.warn(e)}
  renderLobby();setTimeout(next,30)};next()}
// ---------------- viewmodel (separate pass so it never clips into walls) ----------------
const vmScene=new THREE.Scene(),vmCam=new THREE.PerspectiveCamera(62,1,.01,10);const vmRoot=new THREE.Group();vmRoot.scale.setScalar(.5);vmScene.add(vmRoot);
const VM={};let vmCur=null,vmInfo={};
const flashMat=new THREE.MeshBasicMaterial({map:TX.flash,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const muzzle=new THREE.Group();{const p1=new THREE.Mesh(new THREE.PlaneGeometry(.16,.16),flashMat),p2=p1.clone(),p3=new THREE.Mesh(new THREE.PlaneGeometry(.1,.3),flashMat),p4=p3.clone();p2.rotation.y=Math.PI/2;
 p3.rotation.x=Math.PI/2;p3.position.z=-.1;p4.rotation.set(Math.PI/2,Math.PI/2,0);p4.position.z=-.1;muzzle.add(p1,p3,p4);muzzle.visible=false}
function getVM(id){if(!VM[id]){const g=gunGroup(id,true);VM[id]=g}return VM[id]}
function setViewModel(id){if(vmCur)vmRoot.remove(vmCur);vmCur=getVM(id);vmRoot.add(vmCur);vmInfo=vmCur.userData.info||{};vmCur.add(muzzle);muzzle.position.set(...(vmInfo.muzzle||[0,0,-.5]));muzzle.visible=false}
const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_q=new THREE.Quaternion();
function vmToWorld(local,out){vmRoot.updateMatrixWorld(true);out.set(...local);vmCur.localToWorld(out);return camera.localToWorld(out)}
// ---------------- tracers ----------------
const TR=48,trPos=new Float32Array(TR*6),trCol=new Float32Array(TR*6),trLife=new Float32Array(TR);let trI=0;
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(trPos,3));trGeo.setAttribute('color',new THREE.BufferAttribute(trCol,3));
const tracers=new THREE.LineSegments(trGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));tracers.frustumCulled=false;scene.add(tracers);
function addTracer(a,b){const i=trI++%TR;// shorten start to a streak
 trPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);trCol.set([1,.85,.45,1,1,.8],i*6);trLife[i]=.06;trGeo.attributes.position.needsUpdate=true;trGeo.attributes.color.needsUpdate=true}
function updTracers(dt){let ch=false;for(let i=0;i<TR;i++)if(trLife[i]>0){trLife[i]-=dt;if(trLife[i]<=0){trPos.fill(0,i*6,i*6+6);ch=true}}if(ch)trGeo.attributes.position.needsUpdate=true}
// ---------------- impacts ----------------
function impact(p,n,player){if(player){fx.spark(p,8,0xff6a4d,3,.25);return}fx.decal(p,n);fx.spark(p,5,0xffd27a,3.5,.3);
 fx.sprite({p:_v.copy(p).addScaledVector(n,.08),s0:.15,s1:.6,life:.45,op:.55,color:0xbfb3a0,rise:.4})}
// ---------------- throwables & utilities ----------------
const thrownTpl={};function thrownMesh(kind){if(!thrownTpl[kind]){const g=gunGroup(kind);g.scale.setScalar(1.5);thrownTpl[kind]=g}return thrownTpl[kind].clone()}
let nades=[];const FUSE={grenade:1.8,smoke:1.4,flash:1.3,molotov:9};
function spawnNade(owner,kind,p,v){const m=thrownMesh(kind);m.position.copy(p);scene.add(m);nades.push({owner,kind,m,v:v.clone(),t:FUSE[kind]||1.8,spin:new THREE.Vector3(Math.random()*8,Math.random()*8,0)})}
function updNades(dt){for(const n of nades){n.t-=dt;n.v.y-=20*dt;const p=n.m.position;let bounced=false;
  for(const ax of['x','y','z']){const old=p[ax];p[ax]+=n.v[ax]*dt;let hit=false;for(const c of cols)if(p.x>c.x0-.08&&p.x<c.x1+.08&&p.y>c.y0-.08&&p.y<c.y1+.08&&p.z>c.z0-.08&&p.z<c.z1+.08){hit=true;break}
   if(ax==='y'&&p.y<.1&&onFloor(p))hit=true;if(hit){p[ax]=old;n.v[ax]*=-.38;n.v.x*=.75;n.v.z*=.75;bounced=true}}
  n.m.rotation.x+=n.spin.x*dt;n.m.rotation.y+=n.spin.y*dt;if(bounced){n.spin.multiplyScalar(.7);if(n.kind==='molotov')n.t=0}
  if(p.y<-8)n.t=-1;if(n.t<=0)detonate(n)}
 nades=nades.filter(n=>n.t>0)}
function detonate(n){scene.remove(n.m);const p=n.m.position.clone();if(n.t<-.5)return;
 if(n.kind==='grenade')explosionFX(p);
 if(n.owner!==me.id)return; // utility effects are announced by the thrower
 if(n.kind==='grenade'){const R=6.5;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=q.rp.clone();c.y+=1;const dd=c.distanceTo(p);if(dd>R)continue;
   if(!losClear(p.clone().setY(p.y+.2),c))continue;const dmg=Math.round(95*(1-dd/R)+10);send({t:'hit',id,dmg,head:false,w:'grenade'});showHit(c,dmg,false)}}
 else send({t:'util',kind:n.kind,p:[+p.x.toFixed(2),+Math.max(p.y,0).toFixed(2),+p.z.toFixed(2)]})}
function explosionFX(p){fx.sprite({p,tex:TX.flash,add:true,s0:1,s1:6,life:.35,op:1,color:0xffc070});for(let i=0;i<8;i++)fx.sprite({p:_v.set(p.x+(Math.random()-.5)*2,p.y+.3+Math.random(),p.z+(Math.random()-.5)*2),s0:1,s1:3.5,life:1.4+Math.random(),op:.7,color:0x5b5b5b,rise:.8});
 fx.spark(p,40,0xffb347,9,.6);fx.scorch(p,2.2);const d=camera.position.distanceTo(p);SFX.boom(Math.max(.15,1-d/60),panOf(p));shake=Math.min(1.2,shake+Math.max(0,1-d/18)*1.2)}
function utilFX(m){const p=new THREE.Vector3(...m.p);
 if(m.kind==='smoke'){smokes.push({p:p.clone().setY(p.y+1.2),r:4.2,t:0,life:13});SFX.hiss();for(let i=0;i<16;i++){const a=i/16*6.28,r=Math.random()*2.6;fx.sprite({p:_v.set(p.x+Math.cos(a)*r,p.y+.4+Math.random()*2.2,p.z+Math.sin(a)*r),s0:1,s1:4.5+Math.random()*1.5,life:12+Math.random()*1.5,op:.92,color:0xd8dce2,rise:.03})}}
 if(m.kind==='molotov'){fires.push({p,r:3.4,t:0,life:7,emit:0});SFX.whoosh();fx.scorch(p,3.2);fx.sprite({p,tex:TX.flash,add:true,s0:1,s1:4,life:.4,op:.9,color:0xff8a30})}
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
const me={id:null,pos:new THREE.Vector3(),vel:new THREE.Vector3(),ground:false,yaw:0,pitch:0,hp:100,alive:false,
 load:DEFAULT_LOAD.slice(),utilN:2,cur:0,ammo:[0,0,0],cool:0,reloadT:0,reloadStage:0,switchT:0,slideT:0,slideCd:0,camH:1.62,stepT:0,zoomT:0,frozen:true,burst:0,burstT:0,shots:0,lastShot:0};
try{const l=JSON.parse(LS('load2')||'null');if(l&&l.length===4&&l.every((k,i)=>W[k]&&W[k].slot===i))me.load=l}catch(e){}
const C={players:{},phase:'lobby',map:0,mode:'team',score:{},round:0,hostId:null,roundT:0,sb:{}};
let isHost=false,peer=null,conn=null,roomCode='';
function isEnemy(q){if(q.id===me.id)return false;if(C.mode==='ffa')return true;const mt=C.players[me.id]?.team;return q.team!==mt}
// ---------------- network ----------------
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},
 {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},{urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]};
const PREFIX='headshotz-v1-';const conns={};
let __spyOn=null;function send(m){if(__spyOn){__spyOn(m);return}if(isHost)hostHandle(me.id,m);else if(conn&&conn.open)conn.send(m)}
function sendTo(id,m){if(id===me.id)clientHandle(m);else if(conns[id]&&conns[id].open)conns[id].send(m)}
function bcast(m,except){for(const id in conns)if(id!==except&&conns[id].open)conns[id].send(m);if(except!==me.id)clientHandle(m)}
function genCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.random()*a.length|0];return s}
function myName(){let n=$('nameIn').value.trim().slice(0,12);if(!n)n='Player'+(Math.random()*900+100|0);LSS('name',n);return n}
function menuMsg(t){$('menuMsg').textContent=t}
function createRoom(code){audioInit();const name=myName();roomCode=code||genCode();menuMsg('Creating room…');
 peer=new Peer(PREFIX+roomCode,{config:ICE,debug:0});
 peer.on('open',id=>{isHost=true;me.id=id;hostInit(name)});
 peer.on('connection',c=>{c.on('data',d=>hostHandle(c.peer,d));c.on('open',()=>{conns[c.peer]=c});c.on('close',()=>hostLeave(c.peer));c.on('error',()=>hostLeave(c.peer))});
 peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();if(code)joinRoom(code);else createRoom()}else if(!isHost)menuMsg('Network error: '+e.type)});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}})}
function joinRoom(code){audioInit();code=(code||'').toUpperCase().trim();if(code.length<4){menuMsg('Enter a room code');return}
 const name=myName();roomCode=code;menuMsg('Joining '+code+'…');peer=new Peer({config:ICE,debug:0});
 peer.on('open',id=>{me.id=id;conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});
  const to=setTimeout(()=>{if(!conn.open)menuMsg('Could not reach room '+code+'. Check the code or try again.')},12000);
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name})});conn.on('data',clientHandle);conn.on('close',hostGone)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){menuMsg('Room '+code+' not found — creating it so friends can join you!');peer.destroy();setTimeout(()=>createRoom(code),600)}else menuMsg('Network error: '+e.type)})}
function hostGone(){if(isHost)return;alert('The host left the game. Tap OK to go back to the room link.');location.href=location.pathname+'?room='+roomCode}
// ================= HOST =================
const H={players:{},mode:'team',phase:'lobby',map:0,score:{},round:0,t:0,next:0,roundEnd:0,botN:0,order:0,fires:[],smokes:[],fireT:0,sideFlip:false};
const BOTNAMES=['Bolt','Ziggy','Rex','Nova','Pip','Tank','Moxie','Echo'];const BOTGUNS=['ar','smg','battle','bullpup','pdw','vector'];
function hostInit(name){C.hostId=me.id;H.players[me.id]=newP(me.id,name);sendLobby();showLobby();history.replaceState(null,'','?room='+roomCode)}
function newP(id,name,bot){return{id,name,team:'A',color:0xffffff,hp:100,alive:false,kills:0,deaths:0,pts:0,hs:0,rk:0,vote:-1,bot:!!bot,p:[0,-50,0,0,0,0,0],respawn:0,ord:H.order++,gun:bot?BOTGUNS[(Math.random()*BOTGUNS.length)|0]:null}}
function plist(){return Object.values(H.players).sort((a,b)=>a.ord-b.ord)}
function assignTeams(){let i=0;for(const p of plist()){if(H.mode==='ffa'){p.team=p.id;p.color=FFACOL[i%8]}else{p.team=i%2?'B':'A';p.color=TEAMCOL[p.team]}i++}}
function lobbyData(){return{t:'lobby',mode:H.mode,phase:H.phase,hostId:me.id,players:plist().map(p=>({id:p.id,name:p.name,team:p.team,color:p.color,bot:p.bot,vote:p.vote}))}}
function sendLobby(){if(H.phase==='lobby')assignTeams();bcast(lobbyData())}
function sbData(){return{t:'sb',p:plist().map(p=>[p.id,p.kills,p.deaths,p.pts,p.alive?1:0,p.hs]),r:H.score}}
function sendSB(){bcast(sbData())}
function hostLeave(id){if(!H.players[id])return;delete H.players[id];delete conns[id];bcast({t:'bye',id});if(H.phase==='lobby')sendLobby();else{sendSB();checkRound()}}
function hostHandle(from,m){const p=H.players[from];
 switch(m.t){
 case 'hello':{if(Object.keys(H.players).length>=8){conns[from]?.send({t:'full'});return}if(!conns[from]){const c=peer.connections?.[from]?.[0];if(c)conns[from]=c}
  const np=H.players[from]=newP(from,String(m.name||'Player').slice(0,12));
  if(H.phase==='lobby')sendLobby();else{if(H.mode==='ffa'){np.team=from;np.color=FFACOL[plist().length%8]}else{np.team=teamSmaller();np.color=TEAMCOL[np.team]}
   bcast(lobbyData());sendTo(from,startData());bcast({t:'join',id:from,name:np.name,team:np.team,color:np.color},from);
   sendTo(from,{t:'round',round:H.round,score:H.score,spawns:{},count:0});sendSB();if(H.mode==='ffa')np.respawn=H.t+1}break}
 case 'mode':if(from===me.id&&H.phase==='lobby'&&MODES[m.mode]){H.mode=m.mode;sendLobby()}break;
 case 'vote':if(p&&H.phase==='lobby'){p.vote=m.map|0;sendLobby()}break;
 case 'bot':if(from===me.id&&H.phase==='lobby'){if(m.add&&Object.keys(H.players).length<8){const id='bot'+(++H.botN);H.players[id]=newP(id,BOTNAMES[H.botN%8]+'Bot',true)}
  else if(!m.add){const b=plist().filter(x=>x.bot).pop();if(b)delete H.players[b.id]}sendLobby()}break;
 case 'start':if(from===me.id&&H.phase==='lobby')startMatch();break;
 case 'st':if(p&&Array.isArray(m.p))p.p=m.p;break;
 case 'fx':bcast({t:'fx',id:from,a:m.a,b:m.b,w:m.w},from);break;
 case 'nade':bcast({t:'nade',id:from,k:m.k,p:m.p,v:m.v},from);break;
 case 'util':{if(!p||H.phase==='lobby')return;const pos=new THREE.Vector3(...m.p);if(m.kind==='molotov')H.fires.push({p:pos,r:3.4,t:0,life:7,owner:from});
  if(m.kind==='smoke')H.smokes.push({p:pos.clone().setY(pos.y+1.2),r:4.2,t:0,life:13});
  if(m.kind==='flash')for(const b of plist())if(b.bot&&b.alive&&b.e){const e=_v.set(b.e.pos.x,b.e.pos.y+1.5,b.e.pos.z);if(e.distanceTo(pos)<26&&rayClearHost(pos,e))b.blind=2.8}
  bcast({t:'util',id:from,kind:m.kind,p:m.p});break}
 case 'hit':{const v=H.players[m.id];if(!p||!v||H.phase!=='play'||!p.alive||!v.alive)return;if(H.mode!=='ffa'&&p.team===v.team)return;
  damage(v,Math.min(220,Math.max(0,m.dmg|0)),from,!!m.head,String(m.w||''));break}
 case 'heal':if(p&&p.alive){p.hp=Math.min(100,p.hp+50);bcast({t:'hp',id:from,hp:p.hp})}break;
 case 'fall':if(p&&p.alive&&H.phase==='play')damage(p,999,from,false,'fall');break;
 }}
function rayClearHost(a,b){const d=b.clone().sub(a);const l=d.length();d.divideScalar(l);if(rayWorld(a,d,l)<l-.3)return false;for(const s of H.smokes){if(s.t<1.2)continue;const lx=s.p.x-a.x,ly=s.p.y-a.y,lz=s.p.z-a.z;const tc=lx*d.x+ly*d.y+lz*d.z;const d2=lx*lx+ly*ly+lz*lz-tc*tc;const r=s.r*.8;if(d2<r*r&&tc>-r&&tc<l+r)return false}return true}
function teamSmaller(){let a=0,b=0;for(const p of plist()){if(p.team==='A')a++;else if(p.team==='B')b++}return a<=b?'A':'B'}
function damage(v,dmg,by,head,w){if(!v.alive)return;v.hp-=dmg;bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg,head});
 if(v.hp<=0){v.alive=false;v.deaths++;const k=H.players[by];const self=!k||by===v.id;if(!self){k.kills++;k.rk++;k.pts+=100+(head?50:0);if(head)k.hs++}
  bcast({t:'kill',k:by,v:v.id,head,w});if(H.mode==='ffa'&&H.phase==='play')v.respawn=H.t+2.5;sendSB();checkRound()}}
function startData(){return{t:'start',map:H.map,mode:H.mode,players:Object.fromEntries(plist().map(p=>[p.id,{name:p.name,team:p.team,color:p.color,bot:p.bot}]))}}
function startMatch(){assignTeams();const votes=MAPS.map(()=>0);for(const p of plist())if(p.vote>=0)votes[p.vote]++;
 const mx=Math.max(...votes);const best=votes.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);H.map=best[Math.random()*best.length|0];
 H.score={};H.round=0;H.fires=[];H.smokes=[];for(const p of plist()){p.kills=p.deaths=p.pts=p.hs=0}const m=buildMap(H.map);cols=m.cols;groundHalf=m.groundHalf;
 H.phase='starting';bcast(lobbyData());bcast(startData());sendSB();setTimeout(startRound,900)}
// ---- spawn selection ----
function allSpawns(m){return[...m.spawnsA,...m.spawnsB,...m.spawnsM]}
function faceCenter(s){return Math.atan2(s[0],s[1])}
function minDistTo(s,pts){let d=1e9;for(const q of pts)d=Math.min(d,Math.hypot(q[0]-s[0],q[1]-s[1]));return d}
// pick spawn maximising distance from given points (with a little randomness among the best)
function farthest(cands,pts,used){const sc=cands.filter(s=>!used||!used.some(u=>u[0]===s[0]&&u[1]===s[1])).map(s=>[s,pts.length?minDistTo(s,pts):Math.random()*100]).sort((a,b)=>b[1]-a[1]);
 const top=sc.slice(0,Math.max(1,Math.min(2,sc.length))).filter(x=>x[1]>=sc[0][1]*.85);return(top[Math.random()*top.length|0]||sc[0])[0]}
function roundSpawns(){const m=buildMap(H.map);const ps=plist();const out={};const all=allSpawns(m);
 if(H.mode==='team'){const flip=Math.random()<.5;const sideOf=t=>(t==='A')!==flip?m.spawnsA:m.spawnsB;
  for(const t of['A','B']){const mates=ps.filter(p=>p.team===t);if(!mates.length)continue;const list=sideOf(t);const anchor=list[Math.random()*list.length|0];
   const byNear=list.slice().sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1]));mates.forEach((p,i)=>out[p.id]=byNear[i%byNear.length])}}
 else{// duel & FFA: random first, then each next as far as possible from everyone already placed
  const order=ps.slice().sort(()=>Math.random()-.5);const used=[];for(const p of order){const s=used.length?farthest(all,used,used):all[Math.random()*all.length|0];used.push(s);out[p.id]=s}}
 for(const id in out){const s=out[id];out[id]=[s[0],s[1],faceCenter(s)]}return out}
function respawnPoint(p){const m=buildMap(H.map);const enemies=plist().filter(q=>q.alive&&q.id!==p.id).map(q=>[q.p[0],q.p[2]]);const s=farthest(allSpawns(m),enemies);return[s[0],s[1],faceCenter(s)]}
function startRound(){if(!Object.keys(H.players).length)return;H.round++;H.phase='count';H.fires=[];H.smokes=[];const spawns=roundSpawns();
 for(const p of plist()){p.hp=100;p.alive=true;p.rk=0;p.respawn=0;const s=spawns[p.id];p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s)}
 H.next=H.t+3;H.roundEnd=H.t+3+(H.mode==='ffa'?120:90);bcast({t:'round',round:H.round,score:H.score,spawns,count:3});sendSB();window.__lastSpawns=spawns}
function teamAlive(){const a={};for(const p of plist())if(p.alive)a[p.team]=(a[p.team]||0)+p.hp;return a}
function checkRound(){if(H.phase!=='play')return;let win=null;
 if(H.mode==='ffa'){for(const p of plist())if(p.rk>=FFA_ROUND_KILLS)win=p.id}
 else{const a=teamAlive(),ks=Object.keys(a);const teams=new Set(plist().map(p=>p.team));if(teams.size<2){if(!ks.length)win='draw'}else if(ks.length<=1)win=ks[0]||'draw'}
 if(win)endRound(win)}
function endRound(win){H.phase='roundEnd';if(win!=='draw')H.score[win]=(H.score[win]||0)+1;const champ=win!=='draw'&&H.score[win]>=WIN_ROUNDS;
 const nm=H.mode==='ffa'?(H.players[win]?.name||'?'):(win==='A'?'BLUE TEAM':win==='B'?'RED TEAM':'');
 bcast({t:'roundEnd',win,name:nm,score:H.score,match:champ});sendSB();
 setTimeout(()=>{if(champ){H.phase='lobby';for(const p of plist())p.vote=-1;sendLobby()}else startRound()},champ?7000:3500)}
function hostTick(dt){H.t+=dt;
 if(H.phase==='count'&&H.t>=H.next){H.phase='play';bcast({t:'go'})}
 if(H.phase==='play'){
  if(H.t>=H.roundEnd){let win='draw';if(H.mode==='ffa'){let b=-1;for(const p of plist())if(p.rk>b){b=p.rk;win=p.id}}else{const a=teamAlive();win=(a.A||0)>(a.B||0)?'A':(a.B||0)>(a.A||0)?'B':'draw'}endRound(win)}
  if(H.mode==='ffa')for(const p of plist()){if(!p.alive&&p.respawn&&H.t>=p.respawn){p.respawn=0;p.alive=true;p.hp=100;const s=respawnPoint(p);p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s);bcast({t:'spawn',id:p.id,s});sendSB()}}
  for(const p of plist())if(p.bot&&p.alive)botTick(p,dt);
  // molotov damage over time
  H.fireT+=dt;for(const f of H.fires)f.t+=dt;H.fires=H.fires.filter(f=>f.t<f.life);for(const s of H.smokes)s.t+=dt;H.smokes=H.smokes.filter(s=>s.t<s.life);
  if(H.fireT>=.5){H.fireT=0;for(const f of H.fires){const o=H.players[f.owner];for(const p of plist()){if(!p.alive)continue;if(o&&H.mode!=='ffa'&&p.team===o.team&&p.id!==f.owner)continue;if(p.id===f.owner)continue;
    if(Math.hypot(p.p[0]-f.p.x,p.p[2]-f.p.z)<f.r&&Math.abs(p.p[1]-f.p.y)<1.6)damage(p,7,f.owner,false,'molotov')}}}}
 if(H.phase!=='lobby'){H.snapT=(H.snapT||0)+dt;if(H.snapT>=.05){H.snapT=0;const arr=[];for(const p of plist())arr.push([p.id,...p.p.map(v=>Math.round(v*100)/100),p.alive?1:0]);
  bcast({t:'snap',p:arr,rt:Math.max(0,H.roundEnd-H.t)|0})}}}
// ---- bots ----
function botReset(b,s){b.e={pos:new THREE.Vector3(s[0],0,s[1]),vel:new THREE.Vector3(),ground:true};b.yaw=s[2];b.cool=1;b.goal=null;b.strafe=1;b.st=0;b.react=.7;b.blind=0;b.shots=0}
const _o=new THREE.Vector3(),_d=new THREE.Vector3();
function botTick(b,dt){const e=b.e;let tgt=null,td=1e9;b.blind=Math.max(0,(b.blind||0)-dt);const w=W[b.gun]||W.ar;
 if(b.blind<=0)for(const q of plist()){if(!q.alive||q.id===b.id||(H.mode!=='ffa'&&q.team===b.team))continue;const dx=q.p[0]-e.pos.x,dz=q.p[2]-e.pos.z,dy=q.p[1]-e.pos.y,dd=Math.hypot(dx,dy,dz);if(dd>55||dd>=td)continue;
  _o.set(e.pos.x,e.pos.y+1.5,e.pos.z);if(!rayClearHost(_o,_d.set(q.p[0],q.p[1]+1.4,q.p[2])))continue;td=dd;tgt=q}
 let wx=0,wz=0;b.st-=dt;if(b.st<=0){b.st=.5+Math.random()*1.2;b.strafe=Math.random()<.5?-1:1}
 if(tgt){const dx=tgt.p[0]-e.pos.x,dz=tgt.p[2]-e.pos.z;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*6);
  const fx2=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);wx=-fz*b.strafe;wz=fx2*b.strafe;if(td>14){wx+=fx2;wz+=fz}
  b.react-=dt;b.cool-=dt;if(b.react<=0&&b.cool<=0){b.cool=w.rate*1.25;const hit=Math.random()<Math.max(.1,.4-td/100);_o.set(e.pos.x,e.pos.y+1.4,e.pos.z);
   const end=[tgt.p[0]+(hit?0:(Math.random()-.5)*2),tgt.p[1]+1.2+(hit?0:Math.random()),tgt.p[2]+(hit?0:(Math.random()-.5)*2)];
   bcast({t:'fx',id:b.id,a:[_o.x,_o.y,_o.z],b:end,w:b.gun});if(hit){const head=Math.random()<.14;damage(tgt,Math.round((head?w.head:w.body)*falloff(w,td)),b.id,head,b.gun)}}}
 else{b.react=.6;const m=buildMap(H.map);if(!b.goal||Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2||Math.random()<dt*.08){const all=allSpawns(m);b.goal=all[Math.random()*all.length|0].slice()}
  const dx=b.goal[0]-e.pos.x,dz=b.goal[1]-e.pos.z;const l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*4)}
 const l=Math.hypot(wx,wz);if(l>0){wx/=l;wz/=l}const sp=b.blind>0?2:5.2;e.vel.x+=(wx*sp-e.vel.x)*Math.min(1,dt*10);e.vel.z+=(wz*sp-e.vel.z)*Math.min(1,dt*10);
 e.bump=0;physStep(e,dt);if(e.bump&&e.ground){e.vel.y=8;if(Math.random()<.3)b.goal=null}if(e.pos.y<-3)damage(b,999,b.id,false,'fall');
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,0,e.ground?0:2]}
// ================= CLIENT =================
let lastLobby=null;
function clientHandle(m){switch(m.t){
 case 'lobby':lastLobby=m;C.hostId=m.hostId;C.mode=m.mode;if(m.phase==='lobby'){if(inGame)leaveToLobby();showLobby()}renderLobby();break;
 case 'full':menuMsg('Room is full (8 players max).');break;
 case 'start':startGame(m);break;
 case 'join':addRemote(m.id,{name:m.name,team:m.team,color:m.color});renderSB();feed(`${m.name} joined`);break;
 case 'bye':{const q=C.players[m.id];if(q){if(q.model)scene.remove(q.model);feed(q.name+' left');delete C.players[m.id];delete C.sb[m.id];renderSB()}break}
 case 'round':{C.round=m.round;C.score=m.score;C.phase=m.count?'count':'play';for(const n of nades)scene.remove(n.m);nades=[];smokes.length=0;fires.length=0;
  for(const id in C.players){const q=C.players[id];const s=m.spawns[id];if(s){q.alive=true;q.hp=100;q.rp.set(s[0],0,s[1]);q.tp.copy(q.rp);q.yaw=q.tyaw=s[2];if(q.model){q.model.userData.dead=0;q.model.visible=true}}}
  if(m.spawns[me.id])spawnMe(m.spawns[me.id]);else if(!m.count){me.alive=false;center('Joined mid-round\nYou spawn next round')}
  if(m.count){me.frozen=true;let n=m.count;const tick=()=>{if(C.phase!=='count')return;center('ROUND '+C.round+'\n'+n);SFX.beep(600);n--;if(n>0)setTimeout(tick,1000)};tick()}renderSB();break}
 case 'go':C.phase='play';me.frozen=false;center('FIGHT!',800);SFX.beep(1200);break;
 case 'spawn':{const q=C.players[m.id];if(q){q.alive=true;q.hp=100;q.rp.set(m.s[0],0,m.s[1]);q.tp.copy(q.rp);if(q.model){q.model.userData.dead=0;q.model.visible=true}}if(m.id===me.id){spawnMe(m.s);me.frozen=false}break}
 case 'snap':C.roundT=m.rt;for(const a of m.p){const q=C.players[a[0]];if(!q||a[0]===me.id)continue;q.tp.set(a[1],a[2],a[3]);q.tyaw=a[4];q.tpitch=a[5];q.flags=a[7]|0;
  const al=!!a[8];if(al&&!q.alive&&q.model){q.model.userData.dead=0;q.model.visible=true}if(!al&&q.alive&&q.model&&!q.model.userData.dead)q.model.userData.dead=.001;q.alive=al}break;
 case 'hp':{const q=C.players[m.id];if(q){if(m.hp<q.hp&&q.model)q.model.userData.flinch=1;q.hp=m.hp}if(m.id===me.id){if(m.hp<me.hp){SFX.hurt();flashV();shake=Math.min(1,shake+.5)}me.hp=m.hp;updHP()}break}
 case 'kill':{const k=C.players[m.k],v=C.players[m.v];if(v){v.alive=false;if(v.model&&!v.model.userData.dead)v.model.userData.dead=.001}
  const wn=m.w==='fall'?'fell':m.w==='molotov'?'🔥':W[m.w]?W[m.w].name:'';
  if(m.w==='fall'||m.k===m.v)feed(`${v?.name||'?'} ${m.w==='fall'?'fell off':'eliminated themselves'}`);else feed(`<b style="color:${hex(k?.color||0xffffff)}">${esc(k?.name||'?')}</b> <span class="k">[${esc(wn)}${m.head?' 🎯':''}]</span> <b style="color:${hex(v?.color||0xffffff)}">${esc(v?.name||'?')}</b>`,true);
  if(m.v===me.id){me.alive=false;me.hp=0;updHP();me.killer=m.k;center('ELIMINATED'+(k&&m.k!==m.v?'\nby '+k.name:'')+(C.mode==='ffa'?'\nRespawning…':''),2200)}
  if(m.k===me.id&&m.v!==me.id){SFX.kill();center(m.head?'🎯 HEADSHOT!':'ELIMINATED '+(v?.name||''),1000)}break}
 case 'roundEnd':{C.phase='roundEnd';C.score=m.score;me.frozen=true;const mine=C.mode==='ffa'?m.win===me.id:m.win===C.players[me.id]?.team;
  center(m.win==='draw'?'DRAW':(m.match?`${m.name}\nWINS THE MATCH!`:`${m.name} WINS THE ROUND`)+(mine?' 🏆':''),3300);if(mine)SFX.kill();renderSB();break}
 case 'fx':{const a=new THREE.Vector3(...m.a),b=new THREE.Vector3(...m.b);addTracer(a,b);fx.sprite({p:a,tex:TX.flash,add:true,s0:.4,s1:.6,life:.05,op:1,color:0xffd080});
  const d=camera.position.distanceTo(a);if(d<80)SFX.gun(m.w,Math.max(.08,1-d/80)*.7,panOf(a));const dir=b.clone().sub(a).normalize();const t=rayWorld(a,dir,a.distanceTo(b)+.5);if(t<a.distanceTo(b)+.4)impact(a.clone().addScaledVector(dir,t),hitN.clone());break}
 case 'nade':spawnNade(m.id,m.k||'grenade',new THREE.Vector3(...m.p),new THREE.Vector3(...m.v));break;
 case 'util':utilFX(m);break;
 case 'sb':C.sb={};for(const r of m.p)C.sb[r[0]]={k:r[1],d:r[2],pts:r[3],alive:!!r[4],hs:r[5]};C.score=m.r||{};renderSB();if(!$('pause').classList.contains('hidden'))renderBoard();break;
 }}
function addRemote(id,info){if(C.players[id]?.model)scene.remove(C.players[id].model);
 const q={id,name:info.name,team:info.team,color:info.color??0xffffff,bot:info.bot,alive:false,hp:100,rp:new THREE.Vector3(0,-50,0),tp:new THREE.Vector3(0,-50,0),lp:new THREE.Vector3(),yaw:0,tyaw:0,pitch:0,tpitch:0,flags:0};
 if(id!==me.id){q.model=makeCharacter(q.color,info.name,id);q.model.visible=false;scene.add(q.model)}C.players[id]=q}
function startGame(m){for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.mode=m.mode;C.map=m.map;C.score={};C.sb={};
 loadMap(m.map);for(const id in m.players)addRemote(id,m.players[id]);
 for(const s of['menu','lobby','arsenal','settings'])$(s).classList.add('hidden');stopPreview();$('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);
 inGame=true;resize();me.alive=false;me.frozen=true;feed(`${MAPS[m.map].icon} ${MAPS[m.map].name} · ${MODES[m.mode][0]}`);center(MAPS[m.map].name.toUpperCase(),1500);renderSB();buildSlots();
 if(isTouch){const d=document.documentElement;try{(d.requestFullscreen||d.webkitRequestFullscreen)?.call(d)?.catch?.(()=>{})}catch(e){}}}
// face the most open direction, biased toward the map centre (never stare at a wall)
function faceYaw(x,z){const o=new THREE.Vector3(x,1.6,z),d=new THREE.Vector3();const cy=Math.atan2(x,z);let best=cy,bs=-1;
 for(let i=0;i<16;i++){const y=i/16*Math.PI*2;d.set(-Math.sin(y),0,-Math.cos(y));const free=Math.min(rayWorld(o,d,60),60);let dy=Math.abs(((y-cy+Math.PI*3)%(Math.PI*2))-Math.PI);const sc=free*(1.25-dy/Math.PI*.6);if(sc>bs){bs=sc;best=y}}
 return Math.hypot(x,z)<1?best:best}
function spawnMe(s){me.pos.set(s[0],0,s[1]);me.vel.set(0,0,0);me.yaw=faceYaw(s[0],s[1]);me.pitch=0;me.hp=100;me.alive=true;me.slideT=0;me.reloadT=0;me.killer=null;recoilP=recoilY=0;
 me.ammo=me.load.slice(0,3).map(w=>W[w].mag||0);me.utilN=W[me.load[3]].count;me.cur=0;me.zoomT=0;setViewModel(me.load[0]);me.switchT=.35;updHP();buildSlots()}
function leaveToLobby(){inGame=false;$('hud').classList.add('hidden');$('pause').classList.add('hidden');for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};
 for(const n of nades)scene.remove(n.m);nades=[];if(document.pointerLockElement)document.exitPointerLock();resize()}
// ---------------- HUD ----------------
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
let centerTO=null;function center(t,ms){$('center').textContent=t;clearTimeout(centerTO);if(ms)centerTO=setTimeout(()=>$('center').textContent='',ms)}
function feed(t,html){const d=document.createElement('div');if(html)d.innerHTML=t;else d.textContent=t;$('feed').prepend(d);while($('feed').children.length>4)$('feed').lastChild.remove();setTimeout(()=>d.remove(),5000)}
function updHP(){const h=Math.max(0,me.hp);$('hpFill').style.width=h+'%';$('hpFill').style.background=h>60?'#2ee59d':h>30?'#ffd23f':'#ff5a6b';$('hpTxt').textContent=Math.ceil(h)}
function flashV(){const v=$('vign');v.style.transition='none';v.style.opacity=.75;requestAnimationFrame(()=>{v.style.transition='opacity .6s';v.style.opacity=0})}
function chip(q){const s=C.sb[q.id]||{k:0,pts:0,alive:q.alive};const rw=C.mode==='ffa'&&C.score[q.id]?`<i>★${C.score[q.id]}</i>`:'';
 return `<div class="chip${q.id===me.id?' me':''}${s.alive?'':' dead'}" style="--c:${hex(q.color)}"><b>${esc(q.name)}</b>${rw}<span>${s.pts}</span></div>`}
function renderSB(){if(!inGame)return;const ps=Object.values(C.players);let h='';
 if(C.mode==='ffa'){ps.sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));h=`<div class="rounds"><small>R${C.round||1}</small></div>`+ps.map(chip).join('')}
 else{const A=ps.filter(p=>p.team==='A'),B=ps.filter(p=>p.team==='B');h=A.map(chip).join('')+`<div class="rounds"><span class="a">${C.score.A||0}</span><small>R${C.round||1}<br>FT${WIN_ROUNDS}</small><span class="b">${C.score.B||0}</span></div>`+B.map(chip).join('')}
 $('sbar').innerHTML=h}
function renderBoard(){const ps=Object.values(C.players).sort((a,b)=>(C.sb[b.id]?.pts||0)-(C.sb[a.id]?.pts||0));
 $('board').innerHTML=`<div class="cardHead sm">${MODES[C.mode][0]} · ${MAPS[C.map].name} · ROOM ${roomCode}</div><table><tr style="opacity:.7;font-size:11px"><td>PLAYER</td><td>PTS</td><td>K</td><td>D</td><td>🎯</td>${C.mode==='ffa'?'<td>★</td>':''}</tr>`+
 ps.map(p=>{const s=C.sb[p.id]||{k:0,d:0,pts:0,hs:0};return`<tr class="${p.id===me.id?'me':''}"><td style="color:${hex(p.color)}">${esc(p.name)}${p.bot?' 🤖':''}</td><td>${s.pts}</td><td>${s.k}</td><td>${s.d}</td><td>${s.hs}</td>${C.mode==='ffa'?`<td>${C.score[p.id]||0}</td>`:''}</tr>`}).join('')+'</table>'}
function openPause(on){$('pause').classList.toggle('hidden',!on);if(on){renderBoard();if(document.pointerLockElement)document.exitPointerLock()}}
$('menuBtn').onclick=()=>openPause($('pause').classList.contains('hidden'));$('pResume').onclick=()=>openPause(false);$('pLeave').onclick=()=>{location.href=location.pathname};
$('pArsenal').onclick=()=>openArsenal();$('pSettings').onclick=()=>openSettings();
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
 $('pCount').textContent=`${m.players.length}/8`;
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
$('startBtn').onclick=()=>send({t:'start'});$('botAdd').onclick=()=>send({t:'bot',add:1});$('botDel').onclick=()=>send({t:'bot',add:0});
$('leaveLobby').onclick=()=>{location.href=location.pathname};
$('shareBtn').onclick=async()=>{const url=location.origin+location.pathname+'?room='+roomCode;
 try{if(navigator.share&&isTouch){await navigator.share({title:GAME,text:`Join my ${GAME} match! Room ${roomCode}`,url});return}await navigator.clipboard.writeText(url);$('lobbyMsg').textContent='Link copied: '+url}catch(e){$('lobbyMsg').textContent='Invite link: '+url}};
$('nameIn').value=LS('name')||'';
const qRoom=new URLSearchParams(location.search).get('room');if(qRoom){$('codeIn').value=qRoom.toUpperCase().slice(0,5);$('joinBtn').textContent='JOIN '+qRoom.toUpperCase().slice(0,5)}
$('createBtn').onclick=()=>createRoom();$('joinBtn').onclick=()=>joinRoom($('codeIn').value);
// ---- arsenal ----
let arsCls='ar',arsSel=null;
function openArsenal(cls){audioInit();arsCls=cls||W[me.load[0]].cls;$('arsenal').classList.remove('hidden');renderArsenal();}
function renderArsenal(){$('arsTabs').innerHTML=CLASSES.map(c=>`<button data-c="${c.id}" class="${c.id===arsCls?'sel':''}">${c.name}</button>`).join('');
 const list=Object.values(W).filter(w=>w.cls===arsCls);if(!arsSel||W[arsSel].cls!==arsCls)arsSel=(list.find(w=>me.load.includes(w.id))||list[0]).id;
 $('arsGrid').innerHTML=list.map(w=>`<button class="wc${w.id===arsSel?' sel':''}" data-w="${w.id}"><img src="${ICON[w.id]||''}">${w.name}${me.load.includes(w.id)?'<span class="eq">EQUIPPED</span>':''}</button>`).join('');
 const w=W[arsSel];$('arsName').textContent=w.name;$('arsDesc').textContent=w.desc+(w.slot===0?' · Primary':w.slot===1?' · Secondary':w.slot===2?' · Melee':' · Utility');
 const st=stats(w);$('arsStats').innerHTML=st?st.map(([n,v,t])=>`<div class="st"><span>${n}</span><div class="bar"><i style="width:${Math.round(Math.max(.04,Math.min(1,v))*100)}%"></i></div><span>${t}</span></div>`).join(''):
  `<div class="st"><span>Count</span><div class="bar"><i style="width:${w.count*40}%"></i></div><span>×${w.count}</span></div>`;
 const eq=me.load[w.slot]===w.id;$('arsEquip').textContent=eq?'✓ EQUIPPED':'EQUIP';$('arsEquip').classList.toggle('yellow',!eq);startPreview(arsSel)}
$('arsTabs').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;arsCls=b.dataset.c;arsSel=null;renderArsenal();SFX.swap()});
$('arsGrid').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b)return;arsSel=b.dataset.w;renderArsenal();SFX.swap()});
$('arsEquip').onclick=()=>{const w=W[arsSel];me.load[w.slot]=w.id;LSS('load2',JSON.stringify(me.load));SFX.magIn();renderArsenal();renderLoadoutMini();if(inGame)feed(`${w.name} equipped — active on next spawn`)};
$('arsClose').onclick=()=>{$('arsenal').classList.add('hidden');stopPreview()};
$('openArsenal').onclick=()=>openArsenal();$('lobArsenal').onclick=()=>openArsenal();
// ---- settings ----
function openSettings(){$('settings').classList.remove('hidden');$('sens').value=S.sens;$('sensVal').textContent=(+S.sens).toFixed(2);$('aimAssist').checked=S.aimAssist;
 for(const b of $('qualBtns').children)b.classList.toggle('sel',b.dataset.q===S.quality)}
$('sens').oninput=e=>{S.sens=+e.target.value;$('sensVal').textContent=S.sens.toFixed(2);saveS()};$('aimAssist').onchange=e=>{S.aimAssist=e.target.checked;saveS()};
$('qualBtns').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;S.quality=b.dataset.q;saveS();pixelRatio=basePR();renderer.setPixelRatio(pixelRatio);resize();openSettings()};
$('setClose').onclick=()=>$('settings').classList.add('hidden');$('openSettings').onclick=openSettings;$('lobSettings').onclick=openSettings;
// ================= INPUT =================
const keys={};const inp={mx:0,mz:0,fire:false,jump:false,slide:false,sprint:false,zoom:false};
let lookPX=0,lookPY=0;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;keys[e.code]=true;if(!inGame)return;
 if(e.code==='Space'){inp.jump=true;e.preventDefault()}if(e.code==='KeyC'||e.code==='ControlLeft'){inp.slide=true;e.preventDefault()}
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchTo((me.cur+1)%3);if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=3)switchTo(n-1);if(n===4)useUtil()}
 if(e.code==='KeyG'||e.code==='KeyF')useUtil();if(e.code==='Tab'||e.code==='Escape'){e.preventDefault();if(e.code==='Tab')openPause(true)}});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')openPause(false)});
canvas.addEventListener('mousedown',e=>{audioInit();if(!inGame||isTouch)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return}if(e.button===0)inp.fire=true;if(e.button===2)inp.zoom=true});
addEventListener('mouseup',e=>{if(e.button===0)inp.fire=false;if(e.button===2)inp.zoom=false});
addEventListener('contextmenu',e=>{if(inGame)e.preventDefault()});
addEventListener('wheel',e=>{if(inGame&&document.pointerLockElement)switchTo((me.cur+(e.deltaY>0?1:2))%3)},{passive:true});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;const s=.0021*S.sens*zoomSens();me.yaw-=e.movementX*s;me.pitch-=e.movementY*s;clampPitch()});
function clampPitch(){me.pitch=Math.max(-1.5,Math.min(1.5,me.pitch))}
function zoomSens(){const w=W[me.load[me.cur]];return 1-me.zoomT*(1-(w.scope?Math.min(.6,w.scope/75):.75))}
// touch
const touchEl=$('touch');let joyId=null,lookId=null,joyC=[0,0],lookL=[0,0];
for(const id of['bJump','bSwap','bNade']){const b=$(id);
 b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audioInit();b.classList.add('down');if(id==='bSwap')switchTo((me.cur+1)%3);else if(id==='bNade')useUtil();else inp.jump=true});
 const up=()=>b.classList.remove('down');b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
touchEl.addEventListener('pointerdown',e=>{if(e.target!==touchEl&&!e.target.closest('#joyBase'))return;audioInit();
 if(e.clientX<innerWidth*.42&&joyId===null){joyId=e.pointerId;joyC=[e.clientX,e.clientY];const jb=$('joyBase');const r=$('hud').getBoundingClientRect();jb.style.left=(e.clientX-r.left-62)+'px';jb.style.top=(e.clientY-r.top-62)+'px';jb.style.bottom='auto';jb.style.opacity=1}
 else if(lookId===null){lookId=e.pointerId;lookL=[e.clientX,e.clientY]}});
touchEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId){let dx=e.clientX-joyC[0],dy=e.clientY-joyC[1];const l=Math.hypot(dx,dy),mx=52;if(l>mx){dx*=mx/l;dy*=mx/l}
  $('joyKnob').style.transform=`translate(${dx}px,${dy}px)`;inp.mx=dx/mx;inp.mz=dy/mx;inp.sprint=l>mx*.92&&dy<-mx*.4}
 else if(e.pointerId===lookId){lookPX+=e.clientX-lookL[0];lookPY+=e.clientY-lookL[1];lookL=[e.clientX,e.clientY]}});
const tEnd=e=>{if(e.pointerId===joyId){joyId=null;inp.mx=inp.mz=0;inp.sprint=false;$('joyKnob').style.transform='';const jb=$('joyBase');jb.style.opacity=.7;jb.style.left='36px';jb.style.top='auto';jb.style.bottom='40px'}if(e.pointerId===lookId)lookId=null};
touchEl.addEventListener('pointerup',tEnd);touchEl.addEventListener('pointercancel',tEnd);
function applyTouchLook(dt){if(!lookPX&&!lookPY)return;// light smoothing: consume most of the pending delta each frame
 const k=Math.min(1,dt*38);let ax=lookPX*k,ay=lookPY*k;lookPX-=ax;lookPY-=ay;if(Math.abs(lookPX)<.05)lookPX=0;if(Math.abs(lookPY)<.05)lookPY=0;
 let s=.0052*S.sens*zoomSens();if(S.aimAssist&&me.alive&&nearAim(.06))s*=.55;
 const sp=Math.hypot(ax,ay)/Math.max(dt,.001);const accel=1+Math.min(.5,sp/4000);me.yaw-=ax*s*accel;me.pitch-=ay*s*accel*.9;clampPitch()}
// ================= LOCAL PLAYER =================
function switchTo(i){if(i===me.cur||!me.alive)return;me.cur=i;me.reloadT=0;me.switchT=.32;me.zoomT=0;inp.zoom=false;me.burst=0;setViewModel(me.load[i]);SFX.swap()}
function reload(){const w=W[me.load[me.cur]];if(w.melee||me.reloadT>0||me.ammo[me.cur]>=w.mag||!me.alive)return;me.reloadT=w.reload;me.reloadStage=0;me.burst=0}
function useUtil(){if(!me.alive||me.frozen||me.utilN<=0)return;const k=me.load[3];me.utilN--;buildSlots();
 if(k==='medkit'){send({t:'heal'});SFX.heal();center('+50 HP',700);return}
 const f=fwd();const p=camera.position.clone().addScaledVector(f,.6);const v=f.clone().multiplyScalar(k==='molotov'?15:17);v.y+=4;v.add(_v.copy(me.vel).multiplyScalar(.5));
 spawnNade(me.id,k,p,v);send({t:'nade',k,p:p.toArray().map(x=>+x.toFixed(2)),v:v.toArray().map(x=>+x.toFixed(2))});SFX.throw();throwT=.35}
let throwT=0;
function fwd(){return new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion)}
function nearAim(cosr){const o=camera.position,d=fwd();for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const c=_v2.copy(q.rp);c.y+=1.25;const to=c.sub(o);const l=to.length();if(l>140)continue;to.divideScalar(l);
  if(1-to.dot(d)<cosr*cosr/2&&rayWorld(o,to,l)>=l-.5&&!smokeBlock(o,to,l))return true}return false}
function aimTarget(maxD){const o=camera.position,d=fwd();const wt=rayWorld(o,d,maxD);let best=null,bt=wt;
 for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&1);if(r.t<bt){bt=r.t;best=q}}if(best&&smokeBlock(o,d,bt))return null;return best}
let recoilP=0,recoilY=0,kick=0,meleeT=0,bob=0,stTimer=0,swayX=0,swayY=0,lastYaw=0,lastPitch=0;
function fire(){const id=me.load[me.cur],w=W[id];me.cool=w.rate;me.lastShot=performance.now();me.shots++;
 const o=camera.position.clone();
 if(w.melee){SFX.melee();meleeT=1;const d=fwd();let best=null,bd=w.melee+.4,part='torso';for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;
   const c=q.rp.clone();c.y+=1.2;const to=c.clone().sub(o);const dist=to.length();if(dist>w.melee+.4)continue;if(to.normalize().dot(d)<.78)continue;if(!losClear(o,c))continue;
   const r=rayPlayer(o,d,q.rp,q.flags&1);if(dist<bd){bd=dist;best=q;part=r.part==='head'?'head':'torso'}}
  if(best){const head=part==='head';const dmg=head?w.head:w.body;send({t:'hit',id:best.id,dmg,head,w:id});showHit(best.rp.clone().setY(best.rp.y+1.5),dmg,head);fx.spark(best.rp.clone().setY(best.rp.y+1.2),6,0xff6a4d,3,.2)}return}
 me.ammo[me.cur]--;SFX.gun(id,1,0);kick=1;muzzle.visible=true;muzzleT=.045;muzzle.rotation.z=Math.random()*6;muzzle.scale.setScalar(.8+Math.random()*.5+(w.pellets?.4:0));
 // recoil pattern: climbs vertically, sways side to side
 const ads=me.zoomT>.5;recoilP+=w.rc[0]*(ads?.65:1);recoilY+=Math.sin(me.shots*.9)*w.rc[1]*(ads?.6:1);
 if(!vmInfo.noShell&&!w.pellets){const ep=vmToWorld(vmInfo.eject||[.03,.04,0],new THREE.Vector3());const r=_v2.set(1,0,0).applyQuaternion(camera.quaternion);fx.shell(ep,r.multiplyScalar(2+Math.random()).add(_v.set(0,1.6+Math.random(),0)).add(me.vel));SFX.shell()}
 const hits={};const n=w.pellets||1;let spread=w.spread;if(w.scope&&w.cls==='sniper')spread=me.zoomT>.85?0:w.spread;else spread*=ads?.45:1;if(!me.ground)spread*=1.5;else if(Math.hypot(me.vel.x,me.vel.z)>6)spread*=1.25;
 const mz=vmToWorld(vmInfo.muzzle||[0,0,-.5],new THREE.Vector3());
 for(let i=0;i<n;i++){const d=fwd();d.x+=(Math.random()-.5)*2*spread;d.y+=(Math.random()-.5)*2*spread;d.z+=(Math.random()-.5)*2*spread;d.normalize();
  const wt=rayWorld(o,d,400);const wn=hitN.clone();let bt=wt,bq=null,bp=null;
  for(const k in C.players){const q=C.players[k];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp,q.flags&1);if(r.t<bt){bt=r.t;bq=q;bp=r.part}}
  if(bq&&smokeBlock(o,d,bt)){bq=null;bt=wt}
  const end=o.clone().addScaledVector(d,Math.min(bt,400));if(i<3){addTracer(mz,end);if(i===0)send({t:'fx',a:mz.toArray().map(v=>+v.toFixed(2)),b:end.toArray().map(v=>+v.toFixed(2)),w:id})}
  if(bq){let dmg=(bp==='head'?w.head:w.body)*falloff(w,bt)*(bp==='legs'?LIMB:1);const h=hits[bq.id]||(hits[bq.id]={dmg:0,head:false,pos:end});h.dmg+=dmg;if(bp==='head')h.head=true;impact(end,wn,true)}
  else if(wt<400)impact(end,wn,false)}
 for(const k in hits){const h=hits[k];const dmg=Math.max(1,Math.round(h.dmg));send({t:'hit',id:k,dmg,head:h.head,w:id});showHit(h.pos,dmg,h.head)}
 if(me.ammo[me.cur]<=0)setTimeout(reload,180)}
let muzzleT=0;
function updateMe(dt){const id=me.load[me.cur],w=W[id];
 if(isTouch)applyTouchLook(dt);
 let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
 const sprint=(keys.ShiftLeft||keys.ShiftRight||inp.sprint)&&mz<-.3&&me.zoomT<.3;
 if(!me.alive||me.frozen){mx=mz=0}
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 const speed=(sprint?8.6:5.8)*(me.zoomT>.5?.7:1);const hs=Math.hypot(me.vel.x,me.vel.z);me.slideCd-=dt;
 if(inp.slide&&me.alive&&!me.frozen&&me.ground&&me.slideT<=0&&me.slideCd<=0&&hs>3.5){const ns=Math.min(14,Math.max(hs,7)*1.5);me.vel.x=me.vel.x/hs*ns;me.vel.z=me.vel.z/hs*ns;me.slideT=.75;me.slideCd=1;SFX.slide()}
 inp.slide=false;
 if(me.slideT>0){me.slideT-=dt;const k=Math.max(0,1-1.4*dt);me.vel.x*=k;me.vel.z*=k;me.vel.x+=wx*dt*6;me.vel.z+=wz*dt*6;if(Math.hypot(me.vel.x,me.vel.z)<4)me.slideT=0}
 else if(me.ground){const a=Math.min(1,dt*13);me.vel.x+=(wx*speed-me.vel.x)*a;me.vel.z+=(wz*speed-me.vel.z)*a}
 else{me.vel.x+=wx*speed*dt*2.5;me.vel.z+=wz*speed*dt*2.5;const n=Math.hypot(me.vel.x,me.vel.z);const cap=Math.max(hs,speed);if(n>cap){me.vel.x*=cap/n;me.vel.z*=cap/n}}
 if(inp.jump&&me.ground&&me.alive&&!me.frozen){me.vel.y=8.3;if(me.slideT>0){me.vel.x*=1.08;me.vel.z*=1.08;me.slideT=0}SFX.jump()}inp.jump=false;
 if(me.alive){physStep(me,dt);if(me.landed){SFX.land();landDip=.08}}
 if(me.alive&&me.pos.y<-3){me.alive=false;send({t:'fall'})}
 if(me.ground&&hs>2&&me.slideT<=0){me.stepT-=dt*hs;if(me.stepT<=0){me.stepT=sprint?3.3:2.9;SFX.step()}}
 bob+=dt*hs*(me.ground&&me.slideT<=0?1.55:0);landDip=Math.max(0,landDip-dt*.4);
 me.camH+=((me.slideT>0?.95:1.62)-me.camH)*Math.min(1,dt*12);
 // recoil recovery
 const since=(performance.now()-me.lastShot)/1000;const rec=since>.08?Math.min(1,dt*7):Math.min(1,dt*1.2);recoilP-=recoilP*rec;recoilY-=recoilY*rec;if(since>.25)me.shots=0;
 shake=Math.max(0,shake-dt*2.6);const sh=shake*shake*.035;
 if(me.alive){camera.position.set(me.pos.x,me.pos.y+me.camH+Math.sin(bob)*.035-landDip,me.pos.z);camera.rotation.set(me.pitch+recoilP+(Math.random()-.5)*sh,me.yaw+recoilY+(Math.random()-.5)*sh,(me.slideT>0?.07:0)+Math.sin(bob*.5)*.004+(Math.random()-.5)*sh)}
 else deathCam(dt);
 // zoom / ADS / auto-scope
 const scoped=!!w.scope;let wantZoom=inp.zoom&&!w.melee;if(isTouch)wantZoom=scoped&&me.alive&&!me.frozen&&me.reloadT<=0&&me.switchT<=0&&nearAim(w.cls==='sniper'?.09:.07);
 if(!me.alive||me.reloadT>0)wantZoom=false;me.zoomT+=((wantZoom?1:0)-me.zoomT)*Math.min(1,dt*(wantZoom?12:16));
 const zf=w.scope||(w.melee?75:58);const tf=75+(zf-75)*me.zoomT;if(Math.abs(camera.fov-tf)>.05){camera.fov=tf;camera.updateProjectionMatrix()}
 const scopeOn=scoped&&w.cls==='sniper'&&me.zoomT>.8;$('scope').classList.toggle('hidden',!scopeOn);$('cross').style.opacity=scopeOn?0:me.zoomT>.6?.5:1;
 // weapon timers / reload stages
 me.cool-=dt;if(me.switchT>0)me.switchT-=dt;throwT=Math.max(0,throwT-dt);meleeT=Math.max(0,meleeT-dt*3);muzzleT-=dt;if(muzzleT<=0)muzzle.visible=false;
 if(me.reloadT>0){const k=1-me.reloadT/w.reload;if(me.reloadStage===0&&k>.12){me.reloadStage=1;SFX.magOut()}if(me.reloadStage===1&&k>.68){me.reloadStage=2;SFX.magIn()}
  me.reloadT-=dt;if(me.reloadT<=0){me.ammo[me.cur]=w.mag;if(w.cls==='sniper'||w.cls==='shotgun'||id==='lever')SFX.bolt()}}
 // auto-fire when crosshair is on an enemy (primary mobile control)
 const range=w.melee?w.melee:(w.pellets?32:250);const tgt=(me.alive&&!me.frozen)?aimTarget(range):null;$('cross').classList.toggle('on',!!tgt);
 let trigger=(tgt||inp.fire)&&me.alive&&!me.frozen&&C.phase==='play';if(isTouch&&scoped&&w.cls==='sniper'&&tgt&&me.zoomT<.85)trigger=false;
 if(me.burst>0){me.burstT-=dt;if(me.burstT<=0&&me.ammo[me.cur]>0&&me.reloadT<=0){me.burst--;me.burstT=.06;fire();me.cool=w.rate}}
 else if(trigger&&me.cool<=0&&me.switchT<=0&&me.reloadT<=0&&throwT<=0&&(w.melee||me.ammo[me.cur]>0)){if(w.burst){me.burst=w.burst-1;me.burstT=.06}fire()}
 if(!w.melee&&me.ammo[me.cur]<=0&&me.reloadT<=0&&me.alive)reload();
 updViewModel(dt,w,hs,sprint);
 stTimer+=dt;if(stTimer>=.05&&C.phase!=='lobby'&&me.alive){stTimer=0;send({t:'st',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(3),+me.pitch.toFixed(2),me.cur,(me.slideT>0?1:0)|(me.ground?0:2)]})}
 updAmmo();$('timer').textContent=C.phase==='play'?(Math.floor(C.roundT/60)+':'+String(C.roundT%60).padStart(2,'0')):''}
let landDip=0;
function updViewModel(dt,w,hs,sprint){if(!vmCur)return;
 let dyw=me.yaw-lastYaw;dyw=Math.atan2(Math.sin(dyw),Math.cos(dyw));swayX+=(-dyw*1.2-swayX)*Math.min(1,dt*9);swayY+=((me.pitch-lastPitch)*1.2-swayY)*Math.min(1,dt*9);lastYaw=me.yaw;lastPitch=me.pitch;
 swayX=Math.max(-.05,Math.min(.05,swayX));swayY=Math.max(-.05,Math.min(.05,swayY));kick=Math.max(0,kick-dt*10);
 const z=me.zoomT,ads=w.scope?0:z;const rl=me.reloadT>0?Math.sin(Math.min(1,(1-me.reloadT/w.reload))*Math.PI):0;const bx=Math.sin(bob*.5)*.011*(1-ads*.8),by=Math.abs(Math.cos(bob*.5))*.011*(1-ads*.8);
 const sw=me.switchT>0?me.switchT/.32:0;const spr=sprint&&me.ground?1:0;
 const hipX=vmInfo.pistol?.15:.17,hipY=vmInfo.pistol?-.135:-.175,hipZ=vmInfo.pistol?-.42:-.36;
 const tx=hipX*(1-ads)+bx+swayX-spr*.04,ty=(hipY*(1-ads)+(-(vmInfo.sightY||.06)*.5)*ads)+by-swayY-rl*.08-sw*.25+(me.ground?0:.015)-landDip*.4,tz=(hipZ*(1-ads)+(-.26)*ads)+kick*.045*(w.pellets?1.6:1);
 vmRoot.position.set(tx,ty,tz);
 vmRoot.rotation.set(kick*.09+rl*.55-spr*.25+meleeT*-.9+throwT*-1.5,swayX*1.5+(1-ads)*.05+spr*.5+meleeT*.6,rl*.45+(me.slideT>0?.25:0)+meleeT*.4);
 vmRoot.visible=me.alive&&!(w.cls==='sniper'&&me.zoomT>.8);vmCam.fov=62;}
function deathCam(dt){const q=me.killer&&C.players[me.killer];// spectate teammate in team modes, else look at killer
 const mates=Object.values(C.players).filter(p=>p.alive&&p.id!==me.id&&!isEnemy(p));
 if(C.mode!=='ffa'&&mates.length&&C.phase==='play'){const t=mates[0];const back=_v.set(Math.sin(t.yaw),0,Math.cos(t.yaw)).multiplyScalar(3.2);camera.position.lerp(_v2.copy(t.rp).add(back).setY(t.rp.y+2.2),Math.min(1,dt*6));camera.lookAt(t.rp.x,t.rp.y+1.4,t.rp.z);return}
 camera.position.y+=((me.pos.y+.6)-camera.position.y)*Math.min(1,dt*3);if(q&&q.alive){const m=new THREE.Matrix4().lookAt(camera.position,_v.copy(q.rp).setY(q.rp.y+1.4),new THREE.Vector3(0,1,0));_q.setFromRotationMatrix(m);camera.quaternion.slerp(_q,Math.min(1,dt*3))}}
function updRemotes(dt){const a=Math.min(1,dt*14);for(const id in C.players){const q=C.players[id];if(!q.model)continue;const u=q.model.userData;
 if(!q.alive&&!u.dead){q.model.visible=false;continue}if(u.dead>3){q.model.visible=false;continue}q.model.visible=true;
 if(q.alive){if(q.rp.distanceTo(q.tp)>6)q.rp.copy(q.tp);else q.rp.lerp(q.tp,a);let dy=q.tyaw-q.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));q.yaw+=dy*a;q.pitch+=(q.tpitch-q.pitch)*a}
 const sp=Math.hypot(q.rp.x-q.lp.x,q.rp.z-q.lp.z)/Math.max(dt,.001);q.lp.copy(q.rp);q.spd=(q.spd||0)+(sp-(q.spd||0))*Math.min(1,dt*8);
 q.model.position.copy(q.rp);q.model.rotation.y=q.yaw;animate(q.model,{speed:q.spd,air:!!(q.flags&2),slide:!!(q.flags&1),pitch:q.pitch},dt)}}
// ================= LOOP =================
renderer.autoClear=false;renderer.info.autoReset=false;
let last=performance.now(),acc=0,frames=0,fpsShown=0;const fpsLog=[];
function floorAt(p){return 0}
let lastHostTick=performance.now();function hostStep(){const n=performance.now();const dt=Math.min(.1,(n-lastHostTick)/1000);lastHostTick=n;if(isHost)hostTick(dt)}
// keep host simulation alive even when its tab/frame loop is throttled
setInterval(()=>{if(performance.now()-lastHostTick>120)hostStep()},50);
function loop(now){requestAnimationFrame(loop);const el=now-last;if(el<15.2)return;last=now;const dt=Math.min(.05,el/1000);
 hostStep();
 if(inGame){updateMe(dt);updRemotes(dt);updTracers(dt);updNades(dt);updUtil(dt);fx.update(dt,floorAt);updDmg(dt);if(cur&&cur.water)cur.water.material.map.offset.x+=dt*.01;
  if(cur&&cur.sky)cur.sky.position.copy(camera.position);
  if(vmCam.aspect!==camera.aspect){vmCam.aspect=camera.aspect;vmCam.updateProjectionMatrix()}
  renderer.info.reset();renderer.clear();renderer.render(scene,camera);renderer.clearDepth();renderer.render(vmScene,vmCam);
  acc+=el;frames++;if(acc>2000){const avg=acc/frames;fpsLog.push(Math.round(1000/avg));if(fpsLog.length>30)fpsLog.shift();
   if(S.quality==='auto'&&avg>19.5&&pixelRatio>.75){pixelRatio=Math.max(.75,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);resize()}acc=0;frames=0}}}
// boot
try{renderIcons()}catch(e){console.warn('icons',e)}
renderLoadoutMini();resize();requestAnimationFrame(loop);
window.__hsz={fireTest:(id)=>{const o=window.__spy;const realSend=send;setViewModel(id);camera.position.set(me.pos.x,me.pos.y+1.62,me.pos.z);camera.rotation.set(me.pitch,me.yaw,0);camera.updateMatrixWorld();__spyOn=o;try{fire()}finally{__spyOn=null}},C,H,me,send,W,MAPS,buildMap,fpsLog,renderer,get isHost(){return isHost},get cols(){return cols},setCols:(c)=>{cols=c},roundSpawns,respawnPoint,switchTo,fire,useUtil,setLoad:(l)=>{me.load=l}};
