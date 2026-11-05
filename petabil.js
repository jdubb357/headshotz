// HeadShotz v95 pet abilities registry (batch 2): Phantom Phase (Wisp), Frost Ring (Frost Fox), Thunder Mark (Thunder Hawk).
// The host validates cooldowns/targets/damage; clients only render and move themselves. Wired into sidekicks.js via NAB/TV2/hostTick2/hostUse2/clientFx2.
import {THREE} from './gfx.js';
import {spriteMat,bone,mat} from './petkit.js';
export const TV2={phase:{dur:[4,7,10],cd:36},frostring:{r:[10,13,16],f:[.6,.5,.4],d:[3,4,5],cd:30},thunder:{dmg:35,n:[1,2,3],cd:28,range:60}};
export const NAB={
 phase:{n:'Phantom Phase',ic:'👻',act:1,d:(p,t=1)=>`Ability button / X: turn invisible and drift through walls and buildings for ${TV2.phase.dur[t-1]} s (T1 4 s · T2 7 s · T3 10 s). Bots lose you. You cannot shoot while phased, and you are moved to the nearest safe spot when it ends so you never get stuck. ${TV2.phase.cd} s cooldown.`},
 frostring:{n:'Frost Ring',ic:'❄️',act:1,d:(p,t=1)=>`Ability button / X: a freezing ring bursts out ${TV2.frostring.r[t-1]} m around you and slows every enemy inside to ${Math.round(TV2.frostring.f[t-1]*100)}% speed for ${TV2.frostring.d[t-1]} s. ${TV2.frostring.cd} s cooldown.`},
 thunder:{n:'Thunder Mark',ic:'⚡',act:1,d:(p,t=1)=>`Ability button / X: marks the nearest visible enemy within ${TV2.thunder.range} m; lightning strikes it ${TV2.thunder.n[t-1]}× for ${TV2.thunder.dmg} damage each. ${TV2.thunder.cd} s cooldown.`}};
// ---------- host ----------
export function hostUse2(X,p,d,S,H,tr){const t=H.t;if(t<(S.cd||0)||p.down||p.air)return;
 if(d.ab==='phase'){const du=TV2.phase.dur[tr-1];S.cd=t+du+TV2.phase.cd;p.decoy=Math.max(p.decoy||0,t+du);p.phase=t+du;X.bcast({t:'pfx',k:'phase',id:p.id,d:du,cd:du+TV2.phase.cd})}
 else if(d.ab==='frostring'){const V=TV2.frostring,r=V.r[tr-1],du=V.d[tr-1];S.cd=t+V.cd;let n=0;for(const q of X.plist()){if(q.id===p.id||!q.alive||q.down||q.air||(q.prot&&t<q.prot)||!X.enemy(p,q))continue;if(Math.hypot(q.p[0]-p.p[0],q.p[2]-p.p[2])>r||Math.abs(q.p[1]-p.p[1])>5)continue;n++;if(q.bot){q.slowT=t+du;q.slowF=V.f[tr-1]}else X.toPlayer(q.id,{t:'slow',f:V.f[tr-1],d:du})}
  X.bcast({t:'pfx',k:'frost',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],r,cd:V.cd,n})}
 else if(d.ab==='thunder'){const V=TV2.thunder;let best=null,bd=1e9;for(const q of X.plist()){if(q.id===p.id||!q.alive||q.down||q.air||(q.prot&&t<q.prot)||!X.enemy(p,q))continue;const dd=Math.hypot(q.p[0]-p.p[0],q.p[1]-p.p[1],q.p[2]-p.p[2]);if(dd>V.range||dd>=bd||!X.los(p,q))continue;bd=dd;best=q}
  if(!best){X.toPlayer(p.id,{t:'pfx',k:'nomark',id:p.id});return}S.cd=t+V.cd+V.n[tr-1]*.7;S.th={left:V.n[tr-1],next:t+.9,v:best.id};X.bcast({t:'pfx',k:'mark',id:p.id,v:best.id,cd:V.cd+V.n[tr-1]*.7})}}
export function hostTick2(X,p,d,S,H,tr){const t=H.t;if(d.ab==='thunder'&&S.th&&t>=S.th.next){const q=X.plist().find(o=>o.id===S.th.v);if(!q||!q.alive||q.down){S.th=null;return}
  X.bcast({t:'pfx',k:'bolt',id:p.id,v:q.id});X.damage(q,TV2.thunder.dmg,p.id,false,'fists');S.th.left--;S.th.next=t+.7;if(S.th.left<=0)S.th=null}
 else if(d.ab==='phase'&&p.phase&&t>=p.phase){p.phase=0}}
// ---------- client ----------
const GH=new Map();// key -> until(ms): phased players (hidden from everyone else)
export const unghost=id=>{GH.delete(id)};export const ghosted=id=>{const u=GH.get(id);return !!u&&performance.now()<u};
export function clientFx2(m,X){const{A,me,C,root,F,puff,now}=X;const key=m.id===me.id?'me':m.id;
 if(m.k==='phase'){const u=now()+m.d*1000;GH.set(m.id,u);if(m.id===me.id){me.pf={ph:1,until:u,up:0};X.setCd(m.cd*1000);A.toast&&A.toast('👻 Phantom Phase!');document.body.classList.add('phasing')}const f=F.get(key);if(f){f.g.visible=false;f.g.userData.blob.visible=false}}
 else if(m.k==='frost'){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.06,6,48),new THREE.MeshBasicMaterial({color:0x3fc8ff,transparent:true,opacity:.9,depthWrite:false,blending:THREE.NormalBlending}));ring.rotation.x=Math.PI/2;ring.position.set(m.x,m.y+.25,m.z);root.add(ring);RINGS.push({ring,t:now(),r:m.r});
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x7fdcff,transparent:true,opacity:.4,depthWrite:false,blending:THREE.NormalBlending}));disc.rotation.x=-Math.PI/2;disc.position.set(m.x,m.y+.08,m.z);root.add(disc);RINGS.push({ring:disc,t:now(),r:m.r,disc:1});
  for(let i=0;i<14;i++){const a=i/14*6.283;puff(new THREE.Vector3(m.x+Math.cos(a)*m.r*.55,m.y+.3,m.z+Math.sin(a)*m.r*.55),0xcff4ff,1,.5)}if(m.id===me.id)X.setCd(m.cd*1000)}
 else if(m.k==='mark'){const q=m.v===me.id?{rp:me.pos}:C.players[m.v];if(m.id===me.id)X.setCd(m.cd*1000);if(!q)return;const s=new THREE.Sprite(spriteMat(0xfff27a,1));s.scale.setScalar(1.3);root.add(s);MARKS.push({s,q,t:now(),v:m.v})}
 else if(m.k==='bolt'){const q=m.v===me.id?{rp:me.pos}:C.players[m.v];if(!q)return;bolt(root,q.rp.x,q.rp.y,q.rp.z,now());puff(new THREE.Vector3(q.rp.x,q.rp.y+1,q.rp.z),0xbfe8ff,8,.7);for(let i=MARKS.length-1;i>=0;i--)if(MARKS[i].v===m.v&&MARKS[i].hit==null)MARKS[i].hit=now()}
 else if(m.k==='nomark'){A.toast&&A.toast('⚡ No enemy in sight')}}
const RINGS=[],MARKS=[],BOLTS=[];
function bolt(root,x,y,z,t){const g=new THREE.Group();const m=new THREE.MeshBasicMaterial({color:0xcfeaff,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});let a=[x+(Math.random()-.5)*2,y+46,z+(Math.random()-.5)*2];for(let i=1;i<=9;i++){const k=1-i/9;const b=[x+(Math.random()-.5)*5*k,y+46*k,z+(Math.random()-.5)*5*k];bone(g,a,b,.11*(1+k),m);a=b}
 const flash=new THREE.Sprite(spriteMat(0xdff4ff,1));flash.position.set(x,y+1,z);flash.scale.setScalar(5);g.add(flash);root.add(g);BOLTS.push({g,m,t,flash})}
export function updateFx2(X,dt){const n=X.now();
 for(let i=RINGS.length-1;i>=0;i--){const o=RINGS[i],e=(n-o.t)/900;if(e>=1){o.ring.parent&&o.ring.parent.remove(o.ring);RINGS.splice(i,1);continue}const r=o.r*(1-Math.pow(1-e,3));o.ring.scale.set(r,r,o.disc?1:r);o.ring.material.opacity=(o.disc?.4:.95)*(1-e*e)}
 for(let i=MARKS.length-1;i>=0;i--){const o=MARKS[i],e=(n-o.t)/1000;const q=o.q;if((o.hit!=null&&n-o.hit>200)||e>6||!q){o.s.parent&&o.s.parent.remove(o.s);MARKS.splice(i,1);continue}o.s.position.set(q.rp.x,q.rp.y+2.6+Math.sin(n/120)*.12,q.rp.z);o.s.material=spriteMat(Math.floor(n/90)%2?0xfff27a:0xff9a2a,1);o.s.scale.setScalar(1.2+.2*Math.sin(n/80))}
 for(let i=BOLTS.length-1;i>=0;i--){const o=BOLTS[i],e=(n-o.t)/320;if(e>=1){o.g.parent&&o.g.parent.remove(o.g);BOLTS.splice(i,1);continue}o.m.opacity=(1-e)*(Math.floor(n/45)%2?1:.55);o.flash.scale.setScalar(5*(1-e*.6))}
 if(!document.body.classList.contains('phasing'))return}
export function phaseClear(){document.body.classList.remove('phasing')}
