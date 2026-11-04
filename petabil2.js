// HeadShotz v96 pet abilities registry (batch 3): Stone Golem wall, Phoenix rebirth, Shark dash, Mirror Monkey clones, Gravity Owl low-g, Magnet Raccoon pull, Magnet Drone vacuum.
// The host validates cooldowns and applies anything that touches other players; clients only render and move themselves.
import {THREE} from './gfx.js';
import {spriteMat,mat,P,G} from './petkit.js';
export const TV3={wall:{dur:[8,12,16],cd:40,len:5.2,h:2.6},swim:{dur:[5,7,9],mul:[1.5,1.7,1.9],cd:28},mirror:{n:[2,3,4],dur:[6,8,10],cd:34},lowg:{dur:[8,12,16],g:.32,jm:[1.35,1.5,1.65],cd:30},pull:{r:[14,20,26],n:[5,8,12],cd:24},rebirth:{hp:[35,50,65],cd:150,prot:2.5},vacuum:{r:[5,6.5,8]}};
export const NAB3={
 wall:{n:'Stone Wall',ic:'🧱',act:1,d:(p,t=1)=>`Ability button / X: raises a ${TV3.wall.len} m stone shield wall in front of you for ${TV3.wall.dur[t-1]} s. It blocks bullets and movement for everybody. ${TV3.wall.cd} s cooldown.`},
 rebirth:{n:'Phoenix Rebirth',ic:'🔥',act:0,d:(p,t=1)=>`Automatic: when a hit would kill you, you rise again with ${TV3.rebirth.hp[t-1]} HP and ${TV3.rebirth.prot} s of protection. Works once every ${TV3.rebirth.cd} s.`},
 swim:{n:'Shark Dash',ic:'🦈',act:1,d:(p,t=1)=>`Ability button / X: swim across the ground at ${Math.round((TV3.swim.mul[t-1]-1)*100)}% extra speed for ${TV3.swim.dur[t-1]} s, trailing a shark fin. ${TV3.swim.cd} s cooldown.`},
 mirror:{n:'Mirror Clones',ic:'🪞',act:1,d:(p,t=1)=>`Ability button / X: ${TV3.mirror.n[t-1]} mirror clones run off in different directions for ${TV3.mirror.dur[t-1]} s; bots farther than 8 m lose you. ${TV3.mirror.cd} s cooldown.`},
 lowg:{n:'Gravity Flip',ic:'🌌',act:1,d:(p,t=1)=>`Ability button / X: low gravity and a super-jump (×${TV3.lowg.jm[t-1]}) for ${TV3.lowg.dur[t-1]} s. You can still shoot. ${TV3.lowg.cd} s cooldown.`},
 pull:{n:'Loot Pull',ic:'🧲',act:1,d:(p,t=1)=>`Royale: ability button / X pulls up to ${TV3.pull.n[t-1]} ammo and medkit drops from ${TV3.pull.r[t-1]} m straight into your bag. ${TV3.pull.cd} s cooldown.`},
 vacuum:{n:'Magnet Aura',ic:'🧲',act:0,d:(p,t=1)=>`Royale: automatically sucks up ammo and medkits within ${TV3.vacuum.r[t-1]} m. Not rideable, always on.`}};
// ---------- host ----------
let WID=0;
export function hostUse3(X,p,d,S,H,tr){const t=H.t;if(t<(S.cd||0)||p.down||p.air)return;const ab=d.ab;
 if(ab==='wall'){const V=TV3.wall,yaw=p.p[3]||0,fx=-Math.sin(yaw),fz=-Math.cos(yaw),cx=p.p[0]+fx*2.7,cz=p.p[2]+fz*2.7,ax=Math.abs(fx)>Math.abs(fz),hl=V.len/2,ht=.32;const y0=p.p[1]-.02;
  const w=ax?[cx-ht,cx+ht,cz-hl,cz+hl,y0,y0+V.h]:[cx-hl,cx+hl,cz-ht,cz+ht,y0,y0+V.h];const du=V.dur[tr-1];S.cd=t+du+V.cd;X.bcast({t:'pfx',k:'wall',id:p.id,w,d:du,cd:du+V.cd,wid:p.id+':'+(++WID)})}
 else if(ab==='swim'){const V=TV3.swim,du=V.dur[tr-1];S.cd=t+du+V.cd;X.bcast({t:'pfx',k:'swim',id:p.id,d:du,mul:V.mul[tr-1],cd:du+V.cd})}
 else if(ab==='mirror'){const V=TV3.mirror,n=V.n[tr-1],du=V.dur[tr-1];S.cd=t+du+V.cd;p.decoy=Math.max(p.decoy||0,t+du);const cl=[];const a0=Math.random()*6.283;for(let i=0;i<n;i++){const a=a0+i/n*6.283,s=2.6+Math.random()*.8,v=2.6+Math.random()*1.4;cl.push([Math.cos(a)*s,Math.sin(a)*s,Math.cos(a+.6)*v,Math.sin(a+.6)*v])}
  X.bcast({t:'pfx',k:'mirror',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],yaw:p.p[3]||0,d:du,cl,cd:du+V.cd})}
 else if(ab==='lowg'){const V=TV3.lowg,du=V.dur[tr-1];S.cd=t+du+V.cd;X.bcast({t:'pfx',k:'lowg',id:p.id,d:du,jm:V.jm[tr-1],g:V.g,cd:du+V.cd})}
 else if(ab==='pull'){const V=TV3.pull,E=H.br;let n=0;if(E&&E.items){const R=V.r[tr-1];for(const k in E.items){const it=E.items[k];if(it[1]!==1&&it[1]!==2)continue;if(Math.hypot(p.p[0]-it[4],p.p[2]-it[6])>R||Math.abs(p.p[1]-it[5])>6)continue;if(X.take(p,+k)&&++n>=V.n[tr-1])break}}
  if(!n){S.cd=t+2;X.toPlayer(p.id,{t:'pfx',k:'nopull',id:p.id});return}S.cd=t+V.cd;X.bcast({t:'pfx',k:'pullring',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],r:V.r[tr-1],n,cd:V.cd})}}
// ---------- client ----------
const WALLS=[],FINS=new Map(),CLONES=[],RINGS=[],LGS=new Map();let lg=null;
const stone=()=>mat(0x8e929c,{ro:.95}),stone2=()=>mat(0x6a6e78,{ro:.95}),runeM=mat(0x6fe0ff,{em:1.5,ro:.4});
function wallMesh(w){const g=new THREE.Group();const sx=w[1]-w[0],sz=w[3]-w[2],sy=w[5]-w[4];const along=sx>sz;const L=along?sx:sz,T=along?sz:sx;
 const rows=3,cols=Math.round(L/1.3);for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const bw=L/cols-.05,bh=sy/rows-.05;const m=new THREE.Mesh(new THREE.BoxGeometry(along?bw:T,bh,along?T:bw),(r+c)%2?stone():stone2());const o=-L/2+(c+.5)*(L/cols)+((r%2)?L/cols*.25:0);m.position.set(along?o:0,(r+.5)*(sy/rows),along?0:o);g.add(m)}
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(along?L*.5:T+.03,.07,along?T+.03:L*.5),runeM);m.position.set(0,sy*(.25+i*.25),0);g.add(m)}
 g.position.set((w[0]+w[1])/2,w[4],(w[2]+w[3])/2);return g}
function ringFx(root,x,y,z,r,col,now){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.06,6,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.95,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(x,y+.25,z);root.add(ring);RINGS.push({ring,t:now,r})}
const keyPos=(X,id)=>id===X.me.id?X.me.pos:(X.C.players[id]&&X.C.players[id].rp);
export function clientFx3(m,X){const{A,me,C,root,puff,now}=X;const mine=m.id===me.id,n=now();
 if(m.k==='wall'){const c={x0:m.w[0],x1:m.w[1],z0:m.w[2],z1:m.w[3],y0:m.w[4],y1:m.w[5],s:'concrete',dyn:1};if(WALLS.some(o=>o.wid===m.wid))return;const g=wallMesh(m.w);g.scale.y=.05;root.add(g);if(X.addCol)X.addCol(c);WALLS.push({wid:m.wid,g,c,t:n,d:m.d*1000});if(mine){X.setCd(m.cd*1000);A.toast&&A.toast('🧱 Stone Wall!')}puff(new THREE.Vector3((m.w[0]+m.w[1])/2,m.w[4]+.2,(m.w[2]+m.w[3])/2),0xb8bcc8,10,.9)}
 else if(m.k==='swim'){const key=m.id;const f=new THREE.Group();const fin=new THREE.Mesh(new THREE.ConeGeometry(.28,.9,4),mat(0x4a74a8,{ro:.4}));fin.position.y=.4;fin.scale.z=.35;f.add(fin);const w=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,6,24),new THREE.MeshBasicMaterial({color:0xbfe8ff,transparent:true,opacity:.6,depthWrite:false}));w.rotation.x=Math.PI/2;w.position.y=.06;f.add(w);root.add(f);const o=FINS.get(key);if(o)root.remove(o.g);FINS.set(key,{g:f,until:n+m.d*1000,last:0});
  if(mine){me.spb={until:n+m.d*1000,mul:m.mul};X.setCd(m.cd*1000);A.toast&&A.toast('🦈 Shark Dash!')}}
 else if(m.k==='mirror'){const h0=X.holo();for(let i=0;i<m.cl.length;i++){const h=X.holo();h.position.set(m.x+m.cl[i][0]*.3,m.y,m.z+m.cl[i][1]*.3);h.rotation.y=m.yaw;root.add(h);CLONES.push({h,x:m.x+m.cl[i][0]*.3,z:m.z+m.cl[i][1]*.3,vx:m.cl[i][2],vz:m.cl[i][3],y:m.y,t:n,d:m.d*1000})}if(mine){X.setCd(m.cd*1000);A.toast&&A.toast('🪞 Mirror Clones!')}h0.userData&&0}
 else if(m.k==='lowg'){const u=n+m.d*1000;if(mine){lg={until:u};me.gm=m.g;me.jm=m.jm;X.setCd(m.cd*1000);A.toast&&A.toast('🌌 Gravity Flip!')}LGS.set(m.id,{until:u,last:0})}
 else if(m.k==='pullring'){ringFx(root,m.x,m.y,m.z,m.r,0xff4a4a,n);ringFx(root,m.x,m.y+.1,m.z,m.r*.7,0x4a6aff,n);if(mine){X.setCd(m.cd*1000);A.toast&&A.toast('🧲 Pulled '+m.n+' items')}}
 else if(m.k==='nopull'){A.toast&&A.toast('🧲 No loot in range')}
 else if(m.k==='phx'){const q=keyPos(X,m.id);if(q){for(let i=0;i<5;i++)puff(new THREE.Vector3(q.x,q.y+.5+i*.3,q.z),i%2?0xffd23a:0xff5a10,5,.9);ringFx(root,q.x,q.y,q.z,5,0xff8a1a,n)}if(mine)A.toast&&A.toast('🔥 Phoenix Rebirth!')}}
export function updateFx3(X,dt){const{me,C,root,puff}=X,n=X.now();
 for(let i=WALLS.length-1;i>=0;i--){const o=WALLS[i],e=n-o.t;if(e>=o.d){root.remove(o.g);if(X.delCol)X.delCol(o.c);WALLS.splice(i,1);continue}const up=Math.min(1,e/350),dn=o.d-e<700?(o.d-e)/700:1;o.g.scale.y=Math.max(.02,up*dn);o.g.position.y=o.c.y0-(1-dn)*.2}
 for(const [k,f] of FINS){const p=keyPos(X,k);if(n>f.until||!p){root.remove(f.g);FINS.delete(k);if(k===me.id&&me.spb)me.spb=null;continue}f.g.position.set(p.x,p.y,p.z);f.g.rotation.y=Math.atan2(p.x-(f.px??p.x),p.z-(f.pz??p.z))||f.g.rotation.y;f.px=p.x;f.pz=p.z;f.g.scale.setScalar(.9+Math.sin(n/90)*.06);if(n-f.last>90){f.last=n;puff(new THREE.Vector3(p.x,p.y+.15,p.z),0xcfeaff,1,.45)}}
 if(me.spb&&n>me.spb.until)me.spb=null;
 for(let i=CLONES.length-1;i>=0;i--){const o=CLONES[i],e=(n-o.t)/1000;if(n-o.t>o.d){root.remove(o.h);CLONES.splice(i,1);continue}o.x+=o.vx*dt;o.z+=o.vz*dt;o.h.position.set(o.x,o.y+Math.abs(Math.sin(n/160+i))*.1,o.z);o.h.rotation.y=Math.atan2(o.vx,o.vz)+Math.PI;if(o.h.userData.m)o.h.userData.m.opacity=.5*Math.min(1,(o.d-(n-o.t))/600)*(.8+.2*Math.sin(n/70+i))}
 for(let i=RINGS.length-1;i>=0;i--){const o=RINGS[i],e=(n-o.t)/800;if(e>=1){root.remove(o.ring);RINGS.splice(i,1);continue}const r=o.r*(1-Math.pow(1-e,3));o.ring.scale.set(r,r,r);o.ring.material.opacity=.95*(1-e*e)}
 for(const [k,f] of LGS){const p=keyPos(X,k);if(n>f.until||!p){LGS.delete(k);continue}if(n-f.last>140){f.last=n;puff(new THREE.Vector3(p.x+(Math.random()-.5)*.8,p.y+.2,p.z+(Math.random()-.5)*.8),0xb08aff,1,.35)}}
 if(lg&&n>lg.until){lg=null;if(!me.pf){me.gm=1}me.jm=1}}
export function resetFx3(me){lg=null;if(me){me.jm=1;me.spb=null}}
