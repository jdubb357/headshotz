import * as THREE from './lib/three.module.min.js';
import {MAPS} from './maps.js';
const $=id=>document.getElementById(id);
const GAME='HeadShotz';
// ================= WEAPONS =================
const W={
 ar:{name:'Assault Rifle',slot:0,auto:1,rate:.1,mag:30,reload:1.8,body:12,head:15,fall:[20,60],min:4,spread:.012,col:0x2d3436,snd:[1800,.09]},
 shotgun:{name:'Shotgun',slot:0,rate:.8,mag:6,reload:2.2,body:10,head:14,pellets:8,fall:[7,25],min:2,spread:.075,col:0x8e5a2b,snd:[900,.2]},
 sniper:{name:'Sniper',slot:0,rate:1.2,mag:5,reload:2.4,body:50,head:150,spread:.04,zspread:.0,col:0x1e3d59,snd:[600,.3]},
 smg:{name:'Uzi SMG',slot:0,auto:1,rate:.065,mag:32,reload:1.6,body:9,head:12,fall:[12,35],min:3,spread:.03,col:0x555555,snd:[2400,.06]},
 handgun:{name:'Handgun',slot:1,rate:.2,mag:12,reload:1.3,body:12,head:16,fall:[18,50],min:4,spread:.01,col:0x444444,snd:[2000,.08]},
 revolver:{name:'Revolver',slot:1,rate:.5,mag:6,reload:2,body:30,head:50,fall:[25,60],min:12,spread:.006,col:0xb2bec3,snd:[1100,.16]},
 fists:{name:'Fists',slot:2,melee:2.6,rate:.35,body:22,head:30,col:0xf5cba7},
 knife:{name:'Knife',slot:2,melee:3,rate:.45,body:35,head:50,col:0xdfe6e9},
 grenade:{name:'Grenade',slot:3,count:2},
 medkit:{name:'Med Kit',slot:3,count:1,heal:50},
};
const SLOTN=['Primary','Secondary','Melee','Utility'];
const LIMB=.85;
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const MODES={duel:'1v1 Duel',team:'2v2 Teams',ffa:'Free-For-All'};
const WIN_ROUNDS=5, FFA_ROUND_KILLS=3;
const TEAMCOL={A:0x3fa9ff,B:0xff5a5a};
const FFACOL=[0x3fa9ff,0xff5a5a,0x2ecc71,0xf1c40f,0x9b59b6,0xe67e22,0x1abc9c,0xff79c6];
// ================= RENDERER =================
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio,isTouch?1.25:1.5);
renderer.setPixelRatio(pixelRatio);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75,1,.05,300);camera.rotation.order='YXZ';scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff,0x667788,1.6));
const sun=new THREE.DirectionalLight(0xffffff,1.5);sun.position.set(30,60,20);scene.add(sun);
function resize(){document.body.classList.toggle('playing',inGame);const vw=window.visualViewport;const w=Math.round(vw?vw.width:innerWidth)||innerWidth,h=Math.round(vw?vw.height:innerHeight)||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(false)camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 $('rotate').classList.toggle('need',isTouch&&inGame)}
addEventListener('resize',resize);addEventListener('orientationchange',()=>{resize();setTimeout(resize,300);setTimeout(resize,800)});
if(window.visualViewport)visualViewport.addEventListener('resize',resize);
// iOS gesture guards: no pinch/double-tap zoom anywhere; no page scroll/bounce during matches (menus still scroll)
for(const ev of['gesturestart','gesturechange','gestureend'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1){e.preventDefault();return}if(inGame&&!e.target.closest('#board'))e.preventDefault()},{passive:false});
let lastTouchEnd=0;document.addEventListener('touchend',e=>{const n=Date.now();if(inGame&&n-lastTouchEnd<300&&!e.target.closest('button,input'))e.preventDefault();lastTouchEnd=n},{passive:false});
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
if(isIOS&&!standalone)document.getElementById('iosTip').classList.remove('hidden');
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
// merged box geometry with vertex colors -> 1 draw call
const _c=new THREE.Color();
function boxGeo(list){const n=list.length*36,P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3);let k=0;
 const faces=[[0,1,0,.0],[0,-1,0,.35],[1,0,0,.12],[-1,0,0,.12],[0,0,1,.2],[0,0,-1,.2]];
 for(const b of list){const[x,y,z,w,h,d,col]=b;const x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;_c.set(col);
  const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const F=[[3,7,6,2],[0,1,5,4],[1,2,6,5],[0,4,7,3],[4,5,6,7],[0,3,2,1]];
  for(let f=0;f<6;f++){const q=F[f],s=1-faces[f][3];for(const i of[0,1,2,0,2,3]){const p=v[q[i]];
   P[k*3]=p[0];P[k*3+1]=p[1];P[k*3+2]=p[2];N[k*3]=faces[f][0];N[k*3+1]=faces[f][1];N[k*3+2]=faces[f][2];
   C[k*3]=_c.r*s;C[k*3+1]=_c.g*s;C[k*3+2]=_c.b*s;k++}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));return g}
const vcMat=new THREE.MeshLambertMaterial({vertexColors:true});
// ================= AUDIO =================
let AC=null,noiseBuf=null;
function audioInit(){if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();noiseBuf=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);
 const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}catch(e){}}
function env(node,vol,dur){const g=AC.createGain();g.gain.setValueAtTime(vol,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+dur);node.connect(g);g.connect(AC.destination);return g}
function sNoise(freq,dur,vol){if(!AC)return;const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=freq;s.connect(f);env(f,vol,dur);s.start();s.stop(AC.currentTime+dur)}
function sTone(freq,dur,vol,type='sine',slide){if(!AC)return;const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,AC.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(slide,AC.currentTime+dur);env(o,vol,dur);o.start();o.stop(AC.currentTime+dur)}
const SFX={
 shot(w,vol=1){const s=W[w].snd||[1500,.1];sNoise(s[0],s[1],.5*vol);sTone(160,s[1]*.8,.35*vol,'triangle',50)},
 melee(){sNoise(700,.08,.3)},hit(){sTone(1000,.06,.25,'square')},head(){sTone(1400,.08,.3,'square');setTimeout(()=>sTone(2100,.1,.25,'square'),50)},
 hurt(){sTone(220,.15,.3,'sawtooth',110)},step(){sNoise(300,.05,.12)},jump(){sTone(300,.1,.12,'triangle',500)},
 slide(){sNoise(1200,.35,.15)},reload(){sTone(800,.04,.15,'square');setTimeout(()=>sTone(500,.05,.15,'square'),180)},
 boom(vol=1){sNoise(400,.7,.8*vol);sTone(90,.6,.6*vol,'sine',30)},kill(){sTone(600,.1,.25);setTimeout(()=>sTone(900,.15,.25),100)},
 beep(f=700){sTone(f,.12,.2)},heal(){sTone(500,.2,.2,'sine',900)}};
// ================= MAP / COLLISION =================
let mapGroup=null,cols=[],curMap=null,groundHalf=[1e9,1e9];
function buildMap(i){if(mapGroup){scene.remove(mapGroup);mapGroup.traverse(o=>o.geometry&&o.geometry.dispose())}
 const m=MAPS[i];curMap=m;mapGroup=new THREE.Group();
 const gs=m.groundSize||[220,220];groundHalf=m.groundSize?[gs[0]/2,gs[1]/2]:[1e9,1e9];
 const list=[[0,-1,0,gs[0],1,gs[1],m.ground]];
 // checker tiles for ground readability
 for(let x=-gs[0]/2+2.5;x<gs[0]/2&&Math.abs(x)<60;x+=10)for(let z=-gs[1]/2+2.5;z<gs[1]/2&&Math.abs(z)<60;z+=10)list.push([x,-0.99,z,5,1,5,new THREE.Color(m.ground).multiplyScalar(.93).getHex()]);
 list.push(...m.boxes);
 mapGroup.add(new THREE.Mesh(boxGeo(list),vcMat));
 if(m.water){const w=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({color:m.water}));w.rotation.x=-Math.PI/2;w.position.y=-.8;mapGroup.add(w)}
 scene.add(mapGroup);scene.background=new THREE.Color(m.sky);scene.fog=new THREE.Fog(m.sky,m.fog[0],m.fog[1]);
 cols=m.boxes.map(b=>({x0:b[0]-b[3]/2,x1:b[0]+b[3]/2,y0:b[1],y1:b[1]+b[4],z0:b[2]-b[5]/2,z1:b[2]+b[5]/2}));}
const PR=.35,PH=1.8;
function overlaps(p,c,h){return p.x+PR>c.x0&&p.x-PR<c.x1&&p.z+PR>c.z0&&p.z-PR<c.z1&&p.y+h>c.y0&&p.y<c.y1}
function onFloor(p){return Math.abs(p.x)<groundHalf[0]&&Math.abs(p.z)<groundHalf[1]}
// entity: {pos:Vector3, vel:Vector3, ground:bool}
function physStep(e,dt){const p=e.pos,v=e.vel;v.y-=24*dt;if(v.y<-40)v.y=-40;
 for(const ax of['x','z']){p[ax]+=v[ax]*dt;for(const c of cols){if(!overlaps(p,c,PH))continue;
   if(c.y1-p.y<=.55&&e.ground){p.y=c.y1+.001;continue}
   if(v[ax]>0)p[ax]=(ax==='x'?c.x0:c.z0)-PR-.001;else if(v[ax]<0)p[ax]=(ax==='x'?c.x1:c.z1)+PR+.001;else{p[ax]+= (p[ax]<(ax==='x'?(c.x0+c.x1)/2:(c.z0+c.z1)/2)?-.05:.05)}
   v[ax]=0;e.bump=1}}
 p.y+=v.y*dt;e.ground=false;
 for(const c of cols){if(!overlaps(p,c,PH))continue;if(v.y<=0){p.y=c.y1;e.ground=true}else{p.y=c.y0-PH-.001}v.y=0}
 if(p.y<0&&onFloor(p)&&p.y>-1){p.y=0;v.y=0;e.ground=true}}
function rayBox(o,d,x0,y0,z0,x1,y1,z1){let tmin=0,tmax=1e9;
 for(const[a,lo,hi]of[['x',x0,x1],['y',y0,y1],['z',z0,z1]]){const od=o[a],dd=d[a];
  if(Math.abs(dd)<1e-9){if(od<lo||od>hi)return Infinity;continue}
  let t1=(lo-od)/dd,t2=(hi-od)/dd;if(t1>t2){const t=t1;t1=t2;t2=t}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;if(tmin>tmax)return Infinity}
 return tmin}
function rayWorld(o,d,max=300){let t=max;for(const c of cols){const r=rayBox(o,d,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1);if(r<t)t=r}
 if(d.y<0&&onFloor(o)){const g=-o.y/d.y;if(g<t)t=g}return t}
// returns {t,part} vs player hitboxes at feet position fp
function rayPlayer(o,d,fp){let best=Infinity,part=null;
 const hb=[['head',.2,1.45,1.9],['torso',.32,.85,1.45],['legs',.27,0,.85]];
 for(const[n,r,y0,y1]of hb){const t=rayBox(o,d,fp.x-r,fp.y+y0,fp.z-r,fp.x+r,fp.y+y1,fp.z+r);if(t<best){best=t;part=n}}
 return {t:best,part}}
// ================= MODELS =================
function playerModel(col,name){const skin=0xffd8b1,dark=0x2d3436;
 const L=[[-.14,0,0,.24,.85,.28,0x34495e],[.14,0,0,.24,.85,.28,0x34495e],[0,.85,0,.62,.62,.36,col],[-.42,.88,0,.2,.56,.22,col],[.42,.88,0,.2,.56,.22,col],
  [0,1.47,0,.42,.42,.42,skin],[-.09,1.66,-.215,.07,.08,.02,dark],[.09,1.66,-.215,.07,.08,.02,dark],[0,1.85,0,.46,.1,.46,col],[.3,1.15,-.35,.12,.16,.6,dark]];
 const g=new THREE.Group();g.add(new THREE.Mesh(boxGeo(L),vcMat));
 const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x=cv.getContext('2d');x.font='bold 40px sans-serif';x.textAlign='center';
 x.lineWidth=8;x.strokeStyle='#000';x.strokeText(name,128,46);x.fillStyle='#'+new THREE.Color(col).getHexString();x.fillText(name,128,46);
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthWrite:false}));sp.scale.set(1.6,.4,1);sp.position.y=2.3;g.add(sp);
 return g}
// viewmodel
const vm=new THREE.Group();camera.add(vm);vm.position.set(.28,-.28,-.5);let vmMesh=null;
function setViewModel(w){if(vmMesh){vm.remove(vmMesh);vmMesh.geometry.dispose()}const d=W[w];let L;
 if(d.melee)L=w==='knife'?[[0,-.05,0,.07,.1,.16,0x2d3436],[0,-.02,-.2,.03,.06,.28,d.col]]:[[0,-.05,0,.16,.16,.18,d.col],[-.3,-.05,0,.16,.16,.18,d.col]];
 else{const len=w==='sniper'?.8:w==='shotgun'?.6:w==='ar'?.55:.3;L=[[0,0,-len/2,.08,.1,len,d.col],[0,-.12,-.05,.07,.14,.08,0x333333],[0,.05,-len*.4,.05,.05,.15,0x111111]];
  if(w==='sniper')L.push([0,.08,-.25,.06,.06,.3,0x111111]);if(w==='ar'||w==='smg')L.push([0,-.12,-.22,.06,.14,.06,0x222222])}
 vmMesh=new THREE.Mesh(boxGeo(L),vcMat);vm.add(vmMesh)}
// tracers (single draw call)
const TR=40,trPos=new Float32Array(TR*6),trLife=new Float32Array(TR);let trI=0;
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(trPos,3));
const tracers=new THREE.LineSegments(trGeo,new THREE.LineBasicMaterial({color:0xfff3a0}));tracers.frustumCulled=false;scene.add(tracers);
function addTracer(a,b){const i=trI++%TR;trPos.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6);trLife[i]=.07;trGeo.attributes.position.needsUpdate=true}
function updTracers(dt){let ch=false;for(let i=0;i<TR;i++)if(trLife[i]>0){trLife[i]-=dt;if(trLife[i]<=0){trPos.fill(0,i*6,i*6+6);ch=true}}if(ch)trGeo.attributes.position.needsUpdate=true}
// grenades & explosions
const nadeGeo=new THREE.SphereGeometry(.15,8,6),nadeMat=new THREE.MeshLambertMaterial({color:0x2e7d32});
const boomMat=new THREE.MeshBasicMaterial({color:0xffa502,transparent:true,opacity:.8});const boomGeo=new THREE.SphereGeometry(1,12,8);
let nades=[],booms=[];
function spawnNade(owner,p,v){const m=new THREE.Mesh(nadeGeo,nadeMat);m.position.copy(p);scene.add(m);nades.push({owner,m,v:v.clone(),t:1.8})}
function updNades(dt){for(const n of nades){n.t-=dt;n.v.y-=20*dt;const p=n.m.position;
  for(const ax of['x','y','z']){const old=p[ax];p[ax]+=n.v[ax]*dt;let hit=false;for(const c of cols)if(p.x>c.x0&&p.x<c.x1&&p.y>c.y0&&p.y<c.y1&&p.z>c.z0&&p.z<c.z1){hit=true;break}
   if(ax==='y'&&p.y<.15&&onFloor(p))hit=true;if(hit){p[ax]=old;n.v[ax]*=-.4;n.v.x*=.8;n.v.z*=.8}}
  if(n.t<=0)explode(n)}
 nades=nades.filter(n=>n.t>0);
 for(const b of booms){b.t-=dt;b.m.scale.setScalar(1+(.5-b.t)*10);b.m.material.opacity=Math.max(0,b.t*1.6)}booms=booms.filter(b=>{if(b.t<=0){scene.remove(b.m);b.m.material.dispose();return false}return true})}
function explode(n){scene.remove(n.m);const p=n.m.position;const m=new THREE.Mesh(boomGeo,boomMat.clone());m.position.copy(p);scene.add(m);booms.push({m,t:.5});
 const dist=camera.position.distanceTo(p);SFX.boom(Math.max(.15,1-dist/50));
 if(n.owner===me.id){const R=6.5;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;
   const c=q.rp.clone();c.y+=1;const dd=c.distanceTo(p);if(dd>R)continue;const dir=c.clone().sub(p).normalize();if(rayWorld(p,dir,dd)<dd-.2)continue;
   const dmg=Math.round(95*(1-dd/R)+10);send({t:'hit',id,dmg,head:false,w:'grenade'});showHit(c,dmg,false)}}}
// ================= STATE =================
const me={id:null,pos:new THREE.Vector3(),vel:new THREE.Vector3(),ground:false,yaw:0,pitch:0,hp:100,alive:false,
 slots:['ar','handgun','fists'],util:'grenade',utilN:2,cur:0,ammo:[0,0,0],cool:0,reloadT:0,switchT:0,slideT:0,slideCd:0,camH:1.6,stepT:0,zoom:false,frozen:true};
const C={players:{},phase:'lobby',map:0,mode:'team',score:{},round:0,hostId:null,roundT:0};
let inGame=false,isHost=false,peer=null,conn=null,roomCode='';
const LS=k=>localStorage.getItem('hsz_'+k),LSS=(k,v)=>localStorage.setItem('hsz_'+k,v);
try{const l=JSON.parse(LS('load')||'null');if(l&&W[l[0]]&&W[l[1]]&&W[l[2]]&&W[l[3]]){me.slots=l.slice(0,3);me.util=l[3]}}catch(e){}
function isEnemy(q){return q.id!==me.id&&(C.mode==='ffa'||q.team!==C.players[me.id]?.team)}
// ================= NETWORK =================
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},
 {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
 {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]};
const PREFIX='headshotz-v1-';
const conns={};
function send(m){if(isHost)hostHandle(me.id,m);else if(conn&&conn.open)conn.send(m)}
function sendTo(id,m){if(id===me.id)clientHandle(m);else if(conns[id]&&conns[id].open)conns[id].send(m)}
function bcast(m,except){for(const id in conns)if(id!==except&&conns[id].open)conns[id].send(m);if(except!==me.id)clientHandle(m)}
function genCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.random()*a.length|0];return s}
function myName(){let n=$('nameIn').value.trim().slice(0,12);if(!n)n='Player'+(Math.random()*900+100|0);LSS('name',n);return n}
function menuMsg(t){$('menuMsg').textContent=t}
function createRoom(code){audioInit();goFull();const name=myName();roomCode=code||genCode();menuMsg('Creating room…');
 peer=new Peer(PREFIX+roomCode,{config:ICE,debug:0});
 peer.on('open',id=>{isHost=true;me.id=id;hostInit(name);});
 peer.on('connection',c=>{c.on('data',d=>hostHandle(c.peer,d));c.on('open',()=>{conns[c.peer]=c});c.on('close',()=>hostLeave(c.peer));c.on('error',()=>hostLeave(c.peer))});
 peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();if(code)joinRoom(code);else createRoom()}else if(!isHost)menuMsg('Network error: '+e.type)});
 peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}})}
function joinRoom(code){audioInit();goFull();code=code.toUpperCase().trim();if(code.length<4){menuMsg('Enter a room code');return}
 const name=myName();roomCode=code;menuMsg('Joining '+code+'…');
 peer=new Peer({config:ICE,debug:0});
 peer.on('open',id=>{me.id=id;conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json'});
  const to=setTimeout(()=>{if(!conn.open)menuMsg('Could not reach room '+code+'. Check the code or try again.')},12000);
  conn.on('open',()=>{clearTimeout(to);conn.send({t:'hello',name})});conn.on('data',clientHandle);
  conn.on('close',hostGone)});
 peer.on('error',e=>{if(e.type==='peer-unavailable'){menuMsg('Room '+code+' not found — creating it so friends can join you!');peer.destroy();setTimeout(()=>createRoom(code),600)}else menuMsg('Network error: '+e.type)})}
function hostGone(){if(isHost)return;alert('The host left the game. You can create a new room or join another.');location.href=location.pathname+'?room='+roomCode}
function goFull(){if(isTouch){const d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)?.catch?.(()=>{});try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}}
// ================= HOST =================
const H={players:{},mode:'team',phase:'lobby',map:0,score:{},round:0,t:0,next:0,roundEnd:0,botN:0};
function hostInit(name){C.hostId=me.id;H.players[me.id]=newP(me.id,name);sendLobby();showLobby();history.replaceState(null,'','?room='+roomCode)}
function newP(id,name,bot){return{id,name,team:'A',hp:100,alive:false,kills:0,deaths:0,rk:0,vote:-1,bot:!!bot,p:[0,0,0,0,0,0,0],respawn:0}}
function assignTeams(){let i=0;for(const id in H.players){const p=H.players[id];p.team=H.mode==='ffa'?id:(i++%2?'B':'A')}}
function lobbyData(){return{t:'lobby',mode:H.mode,phase:H.phase,hostId:me.id,players:Object.values(H.players).map(p=>({id:p.id,name:p.name,team:p.team,bot:p.bot,vote:p.vote}))}}
function sendLobby(){if(H.phase==='lobby')assignTeams();bcast(lobbyData())}
function hostLeave(id){if(!H.players[id])return;delete H.players[id];delete conns[id];bcast({t:'bye',id});if(H.phase==='lobby')sendLobby();else checkRound()}
function hostHandle(from,m){const p=H.players[from];
 switch(m.t){
 case 'hello':{if(Object.keys(H.players).length>=8){conns[from]?.send({t:'full'});return}
  H.players[from]=newP(from,String(m.name).slice(0,12));if(!conns[from]){/*conn open race*/const c=peer.connections[from]?.[0];if(c)conns[from]=c}
  if(H.phase==='lobby')sendLobby();else{const np=H.players[from];np.team=H.mode==='ffa'?from:teamSmaller();bcast(lobbyData());
   sendTo(from,startData());sendTo(from,{t:'round',round:H.round,score:H.score,spawns:{},count:0});bcast({t:'join',id:from,name:np.name,team:np.team});
   if(H.mode==='ffa')np.respawn=H.t+1}break}
 case 'mode':if(from===me.id&&H.phase==='lobby'&&MODES[m.mode]){H.mode=m.mode;sendLobby()}break;
 case 'vote':if(p&&H.phase==='lobby'){p.vote=m.map|0;sendLobby()}break;
 case 'bot':if(from===me.id&&H.phase==='lobby'){if(m.add&&Object.keys(H.players).length<8){const id='bot'+(++H.botN);H.players[id]=newP(id,['Bolt','Ziggy','Rex','Nova','Pip','Tank','Moxie'][H.botN%7]+'Bot',true)}
  else if(!m.add){const b=Object.values(H.players).filter(x=>x.bot).pop();if(b)delete H.players[b.id]}sendLobby()}break;
 case 'start':if(from===me.id&&H.phase==='lobby'&&Object.keys(H.players).length>=1)startMatch();break;
 case 'st':if(p)p.p=m.p;break;
 case 'fx':bcast({t:'fx',id:from,a:m.a,b:m.b,w:m.w},from);break;
 case 'nade':bcast({t:'nade',id:from,p:m.p,v:m.v},from);break;
 case 'hit':{const v=H.players[m.id];if(!p||!v||H.phase!=='play'||!p.alive||!v.alive)return;if(H.mode!=='ffa'&&p.team===v.team)return;
  damage(v,Math.min(200,Math.max(0,m.dmg|0)),from,!!m.head,m.w);break}
 case 'heal':if(p&&p.alive){p.hp=Math.min(100,p.hp+50);bcast({t:'hp',id:from,hp:p.hp})}break;
 case 'fall':if(p&&p.alive&&H.phase==='play')damage(p,999,from,false,'fall');break;
 }}
function teamSmaller(){let a=0,b=0;for(const id in H.players){const t=H.players[id].team;if(t==='A')a++;else if(t==='B')b++}return a<=b?'A':'B'}
function damage(v,dmg,by,head,w){v.hp-=dmg;bcast({t:'hp',id:v.id,hp:Math.max(0,v.hp),by,dmg,head});
 if(v.hp<=0){v.alive=false;v.deaths++;const k=H.players[by];if(k&&by!==v.id){k.kills++;k.rk++}
  bcast({t:'kill',k:by,v:v.id,head,w});if(H.mode==='ffa'&&H.phase==='play')v.respawn=H.t+2.5;checkRound()}}
function startData(){return{t:'start',map:H.map,mode:H.mode,players:Object.fromEntries(Object.values(H.players).map(p=>[p.id,{name:p.name,team:p.team,bot:p.bot}]))}}
function startMatch(){assignTeams();const votes=MAPS.map(()=>0);for(const id in H.players){const v=H.players[id].vote;if(v>=0)votes[v]++}
 const mx=Math.max(...votes);const best=votes.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);H.map=best[Math.random()*best.length|0];
 H.score={};H.round=0;for(const id in H.players){const p=H.players[id];p.kills=p.deaths=0}
 H.phase='starting';bcast(lobbyData());bcast(startData());setTimeout(startRound,800)}
function spawnPoint(team,i){const m=MAPS[H.map];const list=H.mode==='ffa'?[...m.spawnsA,...m.spawnsB]:(team==='A'?m.spawnsA:m.spawnsB);
 const s=list[i%list.length];return[s[0]+(Math.random()-.5),s[1]+(Math.random()-.5),s[0]<0?-Math.PI/2:Math.PI/2]}
function ffaSpawn(){const m=MAPS[H.map];const all=[...m.spawnsA,...m.spawnsB];let best=all[0],bd=-1;
 for(const s of all){let d=1e9;for(const id in H.players){const q=H.players[id];if(q.alive)d=Math.min(d,Math.hypot(q.p[0]-s[0],q.p[2]-s[1]))}if(d>bd){bd=d;best=s}}
 return[best[0],best[1],best[0]<0?-Math.PI/2:Math.PI/2]}
function startRound(){if(!Object.keys(H.players).length)return;H.round++;H.phase='count';const spawns={};const cnt={};let fi=0;
 for(const id in H.players){const p=H.players[id];p.hp=100;p.alive=true;p.rk=0;p.respawn=0;
  const k=H.mode==='ffa'?'all':p.team;cnt[k]=(cnt[k]||0);const s=spawnPoint(p.team,H.mode==='ffa'?fi++:cnt[k]++);spawns[id]=s;p.p=[s[0],0,s[1],s[2],0,0,0];
  if(p.bot)botReset(p,s)}
 H.next=H.t+3;H.roundEnd=H.t+3+(H.mode==='ffa'?120:90);bcast({t:'round',round:H.round,score:H.score,spawns,count:3})}
function teamAlive(){const a={};for(const id in H.players){const p=H.players[id];if(p.alive)a[p.team]=(a[p.team]||0)+p.hp}return a}
function checkRound(){if(H.phase!=='play')return;let win=null;
 if(H.mode==='ffa'){for(const id in H.players)if(H.players[id].rk>=FFA_ROUND_KILLS)win=id}
 else{const a=teamAlive(),ks=Object.keys(a);const teams=new Set(Object.values(H.players).map(p=>p.team));
  if(teams.size<2){if(!ks.length)win='draw'}else if(ks.length<=1)win=ks[0]||'draw'}
 if(win)endRound(win)}
function endRound(win){H.phase='roundEnd';if(win!=='draw')H.score[win]=(H.score[win]||0)+1;const champ=win!=='draw'&&H.score[win]>=WIN_ROUNDS;
 const nm=H.mode==='ffa'?(H.players[win]?.name||'?'):(win==='A'?'Blue Team':win==='B'?'Red Team':'');
 bcast({t:'roundEnd',win,name:nm,score:H.score,match:champ});
 setTimeout(()=>{if(champ){H.phase='lobby';for(const id in H.players)H.players[id].vote=-1;sendLobby()}else startRound()},champ?7000:3500)}
function hostTick(dt){H.t+=dt;
 if(H.phase==='count'&&H.t>=H.next){H.phase='play';bcast({t:'go'})}
 if(H.phase==='play'){
  if(H.t>=H.roundEnd){let win='draw';if(H.mode==='ffa'){let b=-1;for(const id in H.players){const p=H.players[id];if(p.rk>b){b=p.rk;win=id}}}
   else{const a=teamAlive();win=(a.A||0)>(a.B||0)?'A':(a.B||0)>(a.A||0)?'B':'draw'}endRound(win)}
  if(H.mode==='ffa')for(const id in H.players){const p=H.players[id];if(!p.alive&&p.respawn&&H.t>=p.respawn){p.respawn=0;p.alive=true;p.hp=100;const s=ffaSpawn();
   p.p=[s[0],0,s[1],s[2],0,0,0];if(p.bot)botReset(p,s);bcast({t:'spawn',id,s})}}
  for(const id in H.players){const p=H.players[id];if(p.bot&&p.alive)botTick(p,dt)}}
 if(H.phase!=='lobby'){H.snapT=(H.snapT||0)+dt;if(H.snapT>=.05){H.snapT=0;
  const arr=[];for(const id in H.players){const p=H.players[id];arr.push([id,...p.p.map(v=>Math.round(v*100)/100),p.alive?1:0])}
  bcast({t:'snap',p:arr,rt:Math.max(0,H.roundEnd-H.t)|0})}}}
// ---- bots ----
function botReset(b,s){b.e={pos:new THREE.Vector3(s[0],0,s[1]),vel:new THREE.Vector3(),ground:true};b.yaw=s[2];b.cool=1;b.goal=null;b.strafe=1;b.st=0;b.react=.6}
const _o=new THREE.Vector3(),_d=new THREE.Vector3();
function botTick(b,dt){const e=b.e;let tgt=null,td=1e9;
 for(const id in H.players){const q=H.players[id];if(!q.alive||id===b.id||(H.mode!=='ffa'&&q.team===b.team))continue;
  const dx=q.p[0]-e.pos.x,dz=q.p[2]-e.pos.z,dy=q.p[1]-e.pos.y,dd=Math.hypot(dx,dy,dz);if(dd>50||dd>=td)continue;
  _o.set(e.pos.x,e.pos.y+1.5,e.pos.z);_d.set(dx,dy,dz).normalize();if(rayWorld(_o,_d,dd)<dd-.5)continue;td=dd;tgt=q}
 let wx=0,wz=0;b.st-=dt;if(b.st<=0){b.st=.6+Math.random()*1.2;b.strafe=Math.random()<.5?-1:1}
 if(tgt){const dx=tgt.p[0]-e.pos.x,dz=tgt.p[2]-e.pos.z;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*6);
  const fx=-Math.sin(b.yaw),fz=-Math.cos(b.yaw);wx=-fz*b.strafe;wz=fx*b.strafe;if(td>14){wx+=fx;wz+=fz}
  b.react-=dt;b.cool-=dt;if(b.react<=0&&b.cool<=0){b.cool=.14;const hit=Math.random()<Math.max(.12,.42-td/90);
   _o.set(e.pos.x,e.pos.y+1.4,e.pos.z);const end=[tgt.p[0]+(hit?0:(Math.random()-.5)*2),tgt.p[1]+1.2+(hit?0:Math.random()),tgt.p[2]+(hit?0:(Math.random()-.5)*2)];
   bcast({t:'fx',id:b.id,a:[_o.x,_o.y,_o.z],b:end,w:'ar'});if(hit){const w=W.ar;let f=1;if(td>w.fall[0])f=td>=w.fall[1]?w.min/w.body:1-(td-w.fall[0])/(w.fall[1]-w.fall[0])*(1-w.min/w.body);
    const head=Math.random()<.15;damage(tgt,Math.round((head?w.head:w.body)*f),b.id,head,'ar')}}}
 else{b.react=.5;const m=MAPS[H.map];if(!b.goal||Math.hypot(b.goal[0]-e.pos.x,b.goal[1]-e.pos.z)<2||Math.random()<dt*.1){const all=[...m.spawnsA,...m.spawnsB,[0,0]];const s=all[Math.random()*all.length|0];b.goal=[s[0]*.6+(Math.random()-.5)*10,s[1]*.6+(Math.random()-.5)*10]}
  const dx=b.goal[0]-e.pos.x,dz=b.goal[1]-e.pos.z;const l=Math.hypot(dx,dz)||1;wx=dx/l;wz=dz/l;const ty=Math.atan2(-dx,-dz);let dy=ty-b.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));b.yaw+=dy*Math.min(1,dt*4)}
 const l=Math.hypot(wx,wz);if(l>0){wx/=l;wz/=l}const sp=5;e.vel.x+=(wx*sp-e.vel.x)*Math.min(1,dt*10);e.vel.z+=(wz*sp-e.vel.z)*Math.min(1,dt*10);
 e.bump=0;physStep(e,dt);if(e.bump&&e.ground){e.vel.y=8;if(Math.random()<.3)b.goal=null}
 if(e.pos.y<-3)damage(b,999,b.id,false,'fall');
 b.p=[e.pos.x,e.pos.y,e.pos.z,b.yaw,0,0,0]}
// ================= CLIENT =================
let lastLobby=null;
function clientHandle(m){switch(m.t){
 case 'lobby':lastLobby=m;C.hostId=m.hostId;C.mode=m.mode;if(m.phase==='lobby'){if(inGame)leaveToLobby();showLobby();renderLobby()}else if(!inGame)renderLobby();break;
 case 'full':menuMsg('Room is full (8 players max).');break;
 case 'start':startGame(m);break;
 case 'join':addRemote(m.id,{name:m.name,team:m.team});break;
 case 'bye':{const q=C.players[m.id];if(q){if(q.model)scene.remove(q.model);feed(q.name+' left');delete C.players[m.id]}break}
 case 'round':C.round=m.round;C.score=m.score;C.phase=m.count?'count':'play';updScore();
  for(const id in C.players){const q=C.players[id];if(m.spawns[id]){q.alive=true;q.hp=100;const s=m.spawns[id];q.rp.set(s[0],0,s[1]);q.tp.copy(q.rp)}}
  if(m.spawns[me.id])spawnMe(m.spawns[me.id]);else if(!m.count){me.alive=false;center('Joined mid-round\nWait for next round')}
  if(m.count){me.frozen=true;let n=m.count;const tick=()=>{if(C.phase!=='count')return;center('Round '+C.round+'\n'+n);SFX.beep(600);n--;if(n>0)setTimeout(tick,1000)};tick()}break;
 case 'go':C.phase='play';me.frozen=false;center('FIGHT!',800);SFX.beep(1200);break;
 case 'spawn':{const q=C.players[m.id];if(q){q.alive=true;q.hp=100;q.rp.set(m.s[0],0,m.s[1]);q.tp.copy(q.rp)}if(m.id===me.id){spawnMe(m.s);me.frozen=false}break}
 case 'snap':C.roundT=m.rt;for(const a of m.p){const q=C.players[a[0]];if(!q||a[0]===me.id)continue;q.tp.set(a[1],a[2],a[3]);q.tyaw=a[4];q.slide=a[6];q.alive=!!a[8]}break;
 case 'hp':{const q=C.players[m.id];if(q)q.hp=m.hp;if(m.id===me.id){if(m.hp<me.hp){SFX.hurt();flashV()}me.hp=m.hp;updHP()}break}
 case 'kill':{const k=C.players[m.k],v=C.players[m.v];if(v)v.alive=false;
  feed(m.w==='fall'||m.k===m.v?(v?.name+' fell'):((k?.name||'?')+(m.head?' 🎯 ':' ➜ ')+(v?.name||'?')));
  if(m.v===me.id){me.alive=false;me.hp=0;updHP();center('ELIMINATED'+(k&&m.k!==m.v?'\nby '+k.name:'')+(C.mode==='ffa'?'\nRespawning…':''),2000)}
  if(m.k===me.id&&m.v!==me.id){SFX.kill();center(m.head?'HEADSHOT KILL!':'KILL!',900)}if(k)k.kills=(k.kills||0)+1;if(v)v.deaths=(v.deaths||0)+1;break}
 case 'roundEnd':{C.phase='roundEnd';C.score=m.score;updScore();me.frozen=true;const mine=C.mode==='ffa'?m.win===me.id:m.win===C.players[me.id]?.team;
  const txt=m.win==='draw'?'DRAW':(m.match?(m.name+' WINS THE MATCH!'):(m.name+' wins the round'));center(txt+(m.win!=='draw'?(mine?'\n🏆':''):''),3200);if(mine)SFX.kill();break}
 case 'fx':{const a=new THREE.Vector3(...m.a),b=new THREE.Vector3(...m.b);addTracer(a,b);const d=camera.position.distanceTo(a);if(d<60)SFX.shot(m.w,Math.max(.1,1-d/60)*.6);break}
 case 'nade':spawnNade(m.id,new THREE.Vector3(...m.p),new THREE.Vector3(...m.v));break;
 }}
function addRemote(id,info){if(C.players[id]?.model)scene.remove(C.players[id].model);
 const q={id,name:info.name,team:info.team,bot:info.bot,alive:false,hp:100,rp:new THREE.Vector3(0,-50,0),tp:new THREE.Vector3(0,-50,0),yaw:0,tyaw:0,kills:0,deaths:0};
 if(id!==me.id){const ids=Object.keys(C.players);const col=C.mode==='ffa'?FFACOL[(ids.length)%8]:TEAMCOL[info.team];q.model=playerModel(col,info.name);scene.add(q.model)}
 C.players[id]=q}
function startGame(m){for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};C.mode=m.mode;C.map=m.map;C.score={};
 buildMap(m.map);for(const id in m.players)addRemote(id,m.players[id]);
 $('menu').classList.add('hidden');$('lobby').classList.add('hidden');$('hud').classList.remove('hidden');$('hud').classList.toggle('touch',isTouch);$('touch').classList.toggle('hidden',!isTouch);
 inGame=true;resize();me.alive=false;me.frozen=true;feed('Map: '+MAPS[m.map].name+' · '+MODES[m.mode]);center(MAPS[m.map].name,1500);updScore();buildSlots()}
function spawnMe(s){me.pos.set(s[0],0,s[1]);me.vel.set(0,0,0);me.yaw=s[2];me.pitch=0;me.hp=100;me.alive=true;me.slideT=0;me.reloadT=0;
 me.ammo=me.slots.map(w=>W[w].mag||0);me.utilN=W[me.util].count;me.cur=0;setViewModel(me.slots[0]);updHP();buildSlots()}
function leaveToLobby(){inGame=false;$('hud').classList.add('hidden');for(const id in C.players)if(C.players[id].model)scene.remove(C.players[id].model);C.players={};nades.forEach(n=>scene.remove(n.m));nades=[];if(document.pointerLockElement)document.exitPointerLock();resize()}
// ================= LOBBY UI =================
function showLobby(){$('menu').classList.add('hidden');$('lobby').classList.remove('hidden');$('roomCode').textContent=roomCode;renderLobby();renderLoadout()}
function renderLobby(){const m=lastLobby;if(!m)return;const host=m.hostId===me.id;
 $('pCount').textContent='('+m.players.length+'/8)';
 $('pList').innerHTML=m.players.map(p=>`<li class="${m.mode==='ffa'?'':p.team}">${esc(p.name)}${p.id===m.hostId?' 👑':''}${p.id===me.id?' (you)':''}${p.bot?' 🤖':''}</li>`).join('');
 $('hostCtl').style.display=host?'flex':'none';
 $('modeBtns').innerHTML=Object.entries(MODES).map(([k,v])=>`<button data-mode="${k}" class="${m.mode===k?'sel':''}" ${host?'':'disabled'}>${v}</button>`).join('');
 const votes=MAPS.map(()=>0);let mine=-1;for(const p of m.players){if(p.vote>=0)votes[p.vote]++;if(p.id===me.id)mine=p.vote}
 $('mapBtns').innerHTML=MAPS.map((mp,i)=>`<button data-map="${i}" class="${mine===i?'sel':''}">${mp.name}<br><small>${mp.desc} · ${votes[i]} vote${votes[i]===1?'':'s'}</small></button>`).join('');
 $('startBtn').style.display=host?'':'none';
 $('lobbyMsg').textContent=host?(m.players.length<2?'Share the invite link, or add bots to practice!':'Ready? Hit START when everyone is in.'):(m.phase==='lobby'?'Waiting for the host to start…':'Match in progress — joining…')}
function renderLoadout(){let h='';for(let s=0;s<4;s++){h+=`<div class="slotRow"><b>${SLOTN[s]}</b>`;for(const k in W)if(W[k].slot===s){const sel=s<3?me.slots[s]===k:me.util===k;h+=`<button data-w="${k}" class="${sel?'sel':''}">${W[k].name}</button>`}h+='</div>'}$('loadout').innerHTML=h}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
$('lobby').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;audioInit();
 if(b.dataset.mode)send({t:'mode',mode:b.dataset.mode});
 if(b.dataset.map)send({t:'vote',map:+b.dataset.map});
 if(b.dataset.w){const w=b.dataset.w,s=W[w].slot;if(s<3)me.slots[s]=w;else me.util=w;LSS('load',JSON.stringify([...me.slots,me.util]));renderLoadout()}});
$('startBtn').onclick=()=>send({t:'start'});
$('botAdd').onclick=()=>send({t:'bot',add:1});$('botDel').onclick=()=>send({t:'bot',add:0});
$('shareBtn').onclick=async()=>{const url=location.origin+location.pathname+'?room='+roomCode;
 try{if(navigator.share&&isTouch){await navigator.share({title:GAME,text:'Join my '+GAME+' match! Room '+roomCode,url});return}await navigator.clipboard.writeText(url);$('lobbyMsg').textContent='Link copied: '+url}catch(e){$('lobbyMsg').textContent='Invite link: '+url}};
$('nameIn').value=LS('name')||'';
const qRoom=new URLSearchParams(location.search).get('room');if(qRoom){$('codeIn').value=qRoom.toUpperCase().slice(0,5);$('joinBtn').textContent='Join '+qRoom.toUpperCase()}
$('createBtn').onclick=()=>createRoom();$('joinBtn').onclick=()=>joinRoom($('codeIn').value);
// ================= HUD =================
let centerTO=null;function center(t,ms){$('center').textContent=t;clearTimeout(centerTO);if(ms)centerTO=setTimeout(()=>$('center').textContent='',ms)}
function feed(t){const d=document.createElement('div');d.textContent=t;$('feed').prepend(d);while($('feed').children.length>5)$('feed').lastChild.remove();setTimeout(()=>d.remove(),5000)}
function updHP(){const h=Math.max(0,me.hp);$('hpFill').style.width=h+'%';$('hpFill').style.background=h>60?'#2ecc71':h>30?'#f1c40f':'#e74c3c';$('hpTxt').textContent=Math.ceil(h)}
function flashV(){const v=$('vign');v.style.transition='none';v.style.opacity=.7;requestAnimationFrame(()=>{v.style.transition='opacity .5s';v.style.opacity=0})}
function updScore(){const s=C.score||{};if(C.mode==='ffa'){let lead='-',lv=0;for(const id in s)if(s[id]>lv){lv=s[id];lead=C.players[id]?.name||'?'}
  $('scA').textContent='You '+(s[me.id]||0);$('scB').textContent=lead==='-'?'Leader -':lead+' '+lv}
 else{const myT=C.players[me.id]?.team||'A';$('scA').textContent='Blue '+(s.A||0);$('scB').textContent='Red '+(s.B||0);$('scA').style.outline=myT==='A'?'2px solid #fff':'';$('scB').style.outline=myT==='B'?'2px solid #fff':''}
 $('roundInfo').textContent='Round '+C.round+' · first to '+WIN_ROUNDS}
let hudCache='';function updAmmo(){const w=W[me.slots[me.cur]];const txt=w.melee?'∞':me.reloadT>0?'Reloading…':me.ammo[me.cur]+' / '+w.mag;const s=w.name+'|'+txt+'|'+me.utilN;
 if(s===hudCache)return;hudCache=s;$('wName').textContent=w.name;$('ammo').textContent=txt;buildSlots()}
function buildSlots(){$('slots').innerHTML=me.slots.map((w,i)=>`<div data-s="${i}" class="${i===me.cur?'cur':''}">${i+1} ${W[w].name}</div>`).join('')+`<div data-s="3">4 ${W[me.util].name} ×${me.utilN}</div>`}
$('slots').addEventListener('pointerdown',e=>{const d=e.target.closest('[data-s]');if(!d)return;e.stopPropagation();const s=+d.dataset.s;if(s<3)switchTo(s);else useUtil()});
const dmgPool=[];function showHit(pos,dmg,head){const hx=$('hitX');hx.className=head?'head':'';hx.style.transition='none';hx.style.opacity=1;requestAnimationFrame(()=>{hx.style.transition='opacity .25s';hx.style.opacity=0});
 head?SFX.head():SFX.hit();const d=document.createElement('div');d.textContent=dmg;if(head)d.className='h';$('dmgLayer').appendChild(d);
 dmgPool.push({el:d,p:pos.clone().add(new THREE.Vector3((Math.random()-.5)*.5,.3,0)),t:.8})}
const _v=new THREE.Vector3();function updDmg(dt){for(const n of dmgPool){n.t-=dt;n.p.y+=dt*.8;_v.copy(n.p).project(camera);
  if(_v.z>1||n.t<=0){n.el.style.display='none'}else{n.el.style.left=((_v.x+1)/2*innerWidth)+'px';n.el.style.top=((1-_v.y)/2*innerHeight)+'px';n.el.style.opacity=Math.min(1,n.t*3)}}
 for(let i=dmgPool.length-1;i>=0;i--)if(dmgPool[i].t<=0){dmgPool[i].el.remove();dmgPool.splice(i,1)}}
function showBoard(on){const b=$('board');if(!on){b.classList.add('hidden');return}b.classList.remove('hidden');
 const rows=Object.values(C.players).sort((a,b)=>b.kills-a.kills).map(p=>`<tr style="color:#${new THREE.Color(C.mode==='ffa'?0xffffff:TEAMCOL[p.team]||0xffffff).getHexString()}"><td>${esc(p.name)}${p.id===me.id?' (you)':''}</td><td>${p.kills} K</td><td>${p.deaths} D</td></tr>`).join('');
 b.innerHTML=`<h3>${MODES[C.mode]} · ${MAPS[C.map].name} · Room ${roomCode}</h3><table>${rows}</table><p><button id="closeB">Close</button> <button id="leaveB">Leave game</button></p>`;
 $('closeB').onclick=()=>showBoard(false);$('leaveB').onclick=()=>{location.href=location.pathname}}
$('menuBtn').onclick=()=>showBoard($('board').classList.contains('hidden'));
// ================= INPUT =================
const keys={};const inp={mx:0,mz:0,fire:false,jump:false,slide:false,sprint:false,zoom:false};
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;keys[e.code]=true;if(!inGame)return;
 if(e.code==='Space'){inp.jump=true;e.preventDefault()}if(e.code==='KeyC'||e.code==='ControlLeft'){inp.slide=true;e.preventDefault()}
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchTo((me.cur+1)%3);if(e.code.startsWith('Digit')){const n=+e.code.slice(5);if(n>=1&&n<=3)switchTo(n-1);if(n===4)useUtil()}
 if(e.code==='KeyG')useUtil();if(e.code==='Tab'){e.preventDefault();showBoard(true)}});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')showBoard(false)});
canvas.addEventListener('mousedown',e=>{audioInit();if(!inGame||isTouch)return;if(!document.pointerLockElement){canvas.requestPointerLock();return}if(e.button===0)inp.fire=true;if(e.button===2)inp.zoom=true});
addEventListener('mouseup',e=>{if(e.button===0)inp.fire=false;if(e.button===2)inp.zoom=false});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{if(inGame)switchTo((me.cur+(e.deltaY>0?1:2))%3)});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;const s=.0022*(me.zoom?.35:1);me.yaw-=e.movementX*s;me.pitch-=e.movementY*s;clampPitch()});
function clampPitch(){me.pitch=Math.max(-1.5,Math.min(1.5,me.pitch))}
// touch
const touchEl=$('touch');let joyId=null,lookId=null,joyC=[0,0],lookL=[0,0];
const btnMap={bFire:'fire',bJump:'jump',bSlide:'slide',bZoom:'zoom'};
for(const id of['bFire','bJump','bSlide','bReload','bSwap','bNade','bZoom']){const b=$(id);
 b.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audioInit();b.classList.add('down');
  if(id==='bReload')reload();else if(id==='bSwap')switchTo((me.cur+1)%3);else if(id==='bNade')useUtil();else if(id==='bZoom')inp.zoom=!inp.zoom;else inp[btnMap[id]]=true});
 const up=e=>{b.classList.remove('down');if(id==='bFire')inp.fire=false};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
touchEl.addEventListener('pointerdown',e=>{if(e.target!==touchEl&&e.target.id!=='joyBase'&&e.target.id!=='joyKnob')return;audioInit();
 if(e.clientX<innerWidth*.4&&joyId===null){joyId=e.pointerId;joyC=[e.clientX,e.clientY];const jb=$('joyBase');jb.style.left=(e.clientX-65)+'px';jb.style.top=(e.clientY-65)+'px';jb.style.bottom='auto';jb.style.opacity=1}
 else if(lookId===null){lookId=e.pointerId;lookL=[e.clientX,e.clientY]}});
touchEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId){let dx=e.clientX-joyC[0],dy=e.clientY-joyC[1];const l=Math.hypot(dx,dy),mx=55;if(l>mx){dx*=mx/l;dy*=mx/l}
  $('joyKnob').style.transform=`translate(${dx}px,${dy}px)`;inp.mx=dx/mx;inp.mz=dy/mx;inp.sprint=l>mx*.95}
 else if(e.pointerId===lookId){const s=.0055*(me.zoom?.35:1);me.yaw-=(e.clientX-lookL[0])*s;me.pitch-=(e.clientY-lookL[1])*s;clampPitch();lookL=[e.clientX,e.clientY]}});
const tEnd=e=>{if(e.pointerId===joyId){joyId=null;inp.mx=inp.mz=0;inp.sprint=false;$('joyKnob').style.transform='';$('joyBase').style.opacity=.6}if(e.pointerId===lookId)lookId=null};
touchEl.addEventListener('pointerup',tEnd);touchEl.addEventListener('pointercancel',tEnd);
// ================= LOCAL PLAYER =================
function switchTo(i){if(i===me.cur||!me.alive)return;me.cur=i;me.reloadT=0;me.switchT=.3;me.zoom=false;inp.zoom=false;setViewModel(me.slots[i]);SFX.reload()}
function reload(){const w=W[me.slots[me.cur]];if(w.melee||me.reloadT>0||me.ammo[me.cur]>=w.mag||!me.alive)return;me.reloadT=w.reload;SFX.reload()}
function useUtil(){if(!me.alive||me.frozen||me.utilN<=0)return;const u=W[me.util];me.utilN--;
 if(me.util==='medkit'){send({t:'heal'});SFX.heal()}else{const f=fwd();const p=camera.position.clone().addScaledVector(f,.6);const v=f.clone().multiplyScalar(17);v.y+=4;v.add(me.vel.clone().multiplyScalar(.5));
  spawnNade(me.id,p,v);send({t:'nade',p:p.toArray(),v:v.toArray()});SFX.jump()}}
function fwd(){return new THREE.Vector3(0,0,-1).applyEuler(camera.rotation)}
const _ray=new THREE.Vector3();
function aimTarget(maxD){const o=camera.position,d=fwd();const wt=rayWorld(o,d,maxD);let best=null,bt=wt;
 for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp);if(r.t<bt){bt=r.t;best=q}}return best}
function fire(){const wk=me.slots[me.cur],w=W[wk];me.cool=w.rate;kick=1;
 const o=camera.position.clone();
 if(w.melee){SFX.melee();const d=fwd();let best=null,bt=w.melee,part;for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;
   // generous melee: cone check
   const c=q.rp.clone();c.y+=1.2;const to=c.clone().sub(o);const dist=to.length();if(dist>w.melee+.4)continue;if(to.normalize().dot(d)<.8)continue;
   const r=rayPlayer(o,d,q.rp);if(dist<bt+.4){bt=dist;best=q;part=r.part==='head'?'head':'torso'}}
  if(best){const head=part==='head';const dmg=head?w.head:w.body;send({t:'hit',id:best.id,dmg,head,w:wk});showHit(best.rp.clone().setY(best.rp.y+1.6),dmg,head)}return}
 me.ammo[me.cur]--;SFX.shot(wk);const hits={};const n=w.pellets||1;const spread=wk==='sniper'?(me.zoom?0:w.spread):w.spread*(me.zoom?.5:1)*(me.ground?1:1.6);
 for(let i=0;i<n;i++){const d=fwd();d.x+=(Math.random()-.5)*2*spread;d.y+=(Math.random()-.5)*2*spread;d.z+=(Math.random()-.5)*2*spread;d.normalize();
  const wt=rayWorld(o,d,300);let bt=wt,bq=null,bp=null;
  for(const id in C.players){const q=C.players[id];if(!q.alive||!isEnemy(q))continue;const r=rayPlayer(o,d,q.rp);if(r.t<bt){bt=r.t;bq=q;bp=r.part}}
  const end=o.clone().addScaledVector(d,Math.min(bt,300));if(i<3){const a=o.clone().addScaledVector(fwd(),.6).add(new THREE.Vector3(0,-.15,0));addTracer(a,end);if(i===0)send({t:'fx',a:a.toArray().map(v=>+v.toFixed(2)),b:end.toArray().map(v=>+v.toFixed(2)),w:wk})}
  if(bq){let f=1;if(w.fall){const[a,b]=w.fall;if(bt>a)f=bt>=b?w.min/w.body:1-(bt-a)/(b-a)*(1-w.min/w.body)}
   let dmg=(bp==='head'?w.head:w.body)*f*(bp==='legs'?LIMB:1);const h=hits[bq.id]||(hits[bq.id]={dmg:0,head:false,pos:end});h.dmg+=dmg;if(bp==='head')h.head=true}}
 for(const id in hits){const h=hits[id];const dmg=Math.max(1,Math.round(h.dmg));send({t:'hit',id,dmg,head:h.head,w:wk});showHit(h.pos,dmg,h.head)}
 if(me.ammo[me.cur]<=0)setTimeout(reload,150)}
let kick=0,bob=0,stTimer=0;
function updateMe(dt){const w=W[me.slots[me.cur]];
 // input vector
 let mx=inp.mx,mz=inp.mz;if(keys.KeyW||keys.ArrowUp)mz-=1;if(keys.KeyS||keys.ArrowDown)mz+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
 const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
 const sprint=(keys.ShiftLeft||inp.sprint||(isTouch&&ml>.9))&&mz<0;
 if(!me.alive||me.frozen){mx=mz=0}
 const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);const wx=mx*cy+mz*sy,wz=-mx*sy+mz*cy;
 const speed=sprint?8.6:5.6;const hs=Math.hypot(me.vel.x,me.vel.z);
 me.slideCd-=dt;
 if(inp.slide&&me.alive&&!me.frozen&&me.ground&&me.slideT<=0&&me.slideCd<=0&&hs>3.5){const l=hs||1;const ns=Math.min(14,Math.max(hs,7)*1.5);me.vel.x=me.vel.x/l*ns;me.vel.z=me.vel.z/l*ns;me.slideT=.75;me.slideCd=1;SFX.slide()}
 inp.slide=false;
 if(me.slideT>0){me.slideT-=dt;const k=Math.max(0,1-1.4*dt);me.vel.x*=k;me.vel.z*=k;me.vel.x+=wx*dt*6;me.vel.z+=wz*dt*6;if(Math.hypot(me.vel.x,me.vel.z)<4)me.slideT=0}
 else if(me.ground){const a=Math.min(1,dt*14);me.vel.x+=(wx*speed-me.vel.x)*a;me.vel.z+=(wz*speed-me.vel.z)*a}
 else{const cur=hs;me.vel.x+=wx*speed*dt*2.5;me.vel.z+=wz*speed*dt*2.5;const n=Math.hypot(me.vel.x,me.vel.z);const cap=Math.max(cur,speed);if(n>cap){me.vel.x*=cap/n;me.vel.z*=cap/n}}
 if(inp.jump&&me.ground&&me.alive&&!me.frozen){me.vel.y=8.2;if(me.slideT>0){me.vel.x*=1.08;me.vel.z*=1.08;me.slideT=0}SFX.jump()}inp.jump=false;
 if(me.alive)physStep(me,dt);
 if(me.alive&&me.pos.y<-3){me.alive=false;send({t:'fall'})}
 // footsteps
 if(me.ground&&hs>2&&me.slideT<=0){me.stepT-=dt*hs;if(me.stepT<=0){me.stepT=sprint?3.2:2.8;SFX.step()}}
 bob+=dt*hs*(me.ground&&me.slideT<=0?1.6:0);
 me.camH+=((me.slideT>0?.9:1.6)-me.camH)*Math.min(1,dt*12);
 camera.position.set(me.pos.x,me.pos.y+me.camH+Math.sin(bob)*.04,me.pos.z);
 if(!me.alive){camera.position.y=me.pos.y+2.6}
 camera.rotation.set(me.pitch+kick*.03,me.yaw,me.slideT>0?.06:0);
 // zoom
 me.zoom=me.alive&&inp.zoom&&!w.melee;const tf=me.zoom?(me.slots[me.cur]==='sniper'?22:55):75;if(Math.abs(camera.fov-tf)>.1){camera.fov+=(tf-camera.fov)*Math.min(1,dt*15);camera.updateProjectionMatrix()}
 $('scope').classList.toggle('hidden',!(me.zoom&&me.slots[me.cur]==='sniper'));vm.visible=!(me.zoom&&me.slots[me.cur]==='sniper')&&me.alive;
 // weapon timers
 me.cool-=dt;if(me.switchT>0)me.switchT-=dt;
 if(me.reloadT>0){me.reloadT-=dt;if(me.reloadT<=0){me.ammo[me.cur]=w.mag;SFX.reload()}}
 // auto-fire when crosshair on enemy
 const range=w.melee?w.melee:(me.slots[me.cur]==='shotgun'?30:200);const tgt=(me.alive&&!me.frozen)?aimTarget(range):null;$('cross').classList.toggle('on',!!tgt);
 const wantFire=(tgt||inp.fire)&&me.alive&&!me.frozen&&C.phase==='play';
 if(wantFire&&me.cool<=0&&me.switchT<=0&&me.reloadT<=0&&(w.melee||me.ammo[me.cur]>0)){if(w.auto||tgt||inp.fireEdge!==false)fire()}
 if(!w.melee&&me.ammo[me.cur]<=0&&me.reloadT<=0&&me.alive)reload();
 kick=Math.max(0,kick-dt*10);vm.position.set(.28+Math.sin(bob*.5)*.01,-.28+Math.abs(Math.cos(bob*.5))*.01+(me.reloadT>0?-.15:0)-(me.switchT>0?me.switchT:0),-.5+kick*.06);vm.rotation.x=kick*.15;
 stTimer+=dt;if(stTimer>=.05&&C.phase!=='lobby'){stTimer=0;send({t:'st',p:[+me.pos.x.toFixed(2),+me.pos.y.toFixed(2),+me.pos.z.toFixed(2),+me.yaw.toFixed(3),+me.pitch.toFixed(2),me.cur,me.slideT>0?1:0]})}
 updAmmo();$('timer').textContent=C.phase==='play'?(Math.floor(C.roundT/60)+':'+String(C.roundT%60).padStart(2,'0')):''}
function updRemotes(dt){const a=Math.min(1,dt*15);for(const id in C.players){const q=C.players[id];if(!q.model)continue;
 q.model.visible=q.alive;if(!q.alive)continue;if(q.rp.distanceTo(q.tp)>6)q.rp.copy(q.tp);else q.rp.lerp(q.tp,a);let dy=q.tyaw-q.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));q.yaw+=dy*a;
 q.model.position.copy(q.rp);q.model.rotation.y=q.yaw;q.model.scale.y=q.slide?.6:1}}
// ================= LOOP =================
let last=performance.now(),acc=0,frames=0,slowT=0;
function loop(now){requestAnimationFrame(loop);const el=now-last;if(el<15.5)return; // cap at ~60fps on 90/120Hz screens
 last=now;const dt=Math.min(.05,el/1000);
 if(isHost)hostTick(dt);
 if(inGame){updateMe(dt);updRemotes(dt);updTracers(dt);updNades(dt);updDmg(dt);renderer.render(scene,camera);
  // adaptive resolution: drop pixel ratio if consistently slow
  acc+=el;frames++;if(acc>2000){const avg=acc/frames;if(avg>19&&pixelRatio>.7){pixelRatio=Math.max(.7,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);resize()}acc=0;frames=0}}}
resize();requestAnimationFrame(loop);
window.__hsz={C,H,me,send,get isHost(){return isHost}};
