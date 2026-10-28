// HeadShotz v57 SIDEKICKS: cute low-poly buddies that follow you. Original models built in code (no third-party assets).
// Each sidekick has ONE ability (see AB). Passive abilities are resolved by the match host (guard / medic / shield / magnet / lucky / finder),
// active ones (scout / decoy) use the ability button / X key, sprinter + tracker run on the client. Equipped pet id travels in the weapon-skin
// object (ws.pet) so it syncs everywhere ws already syncs (join, lobby, 'ws' messages).
import {THREE} from './gfx.js';
export const RAR_N=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
export const RAR_C=['#9aa4b2','#4cd964','#4dabff','#b37bff','#ffb020'];
export const AB={
 guard:{n:'Guard',ic:'⚡',act:0,d:p=>`Zaps the closest enemy within ${(5+p).toFixed(0)} m for ${Math.round(6+4*p)} damage every ${(5.4-p*1.2).toFixed(1)} s.`},
 scout:{n:'Scout',ic:'📡',act:1,d:p=>`Ability button / X: scan pulse marks every enemy through walls for ${Math.round(5*p)} s (${Math.round(26/p)} s cooldown).`},
 tracker:{n:'Tracker',ic:'👣',act:0,d:p=>`Enemy footprints glow on the ground for ${Math.round(5*p)} s so you can follow where they ran.`},
 sprinter:{n:'Sprinter',ic:'💨',act:0,d:p=>`You run ${Math.round(6*p)}% faster, everywhere.`},
 lucky:{n:'Lucky',ic:'🍀',act:0,d:p=>`Royale: ${Math.round(18*p)}% of the guns and melee you pick up (and chest guns) come out one rarity higher.`},
 medic:{n:'Medic',ic:'💚',act:0,d:p=>`Heals ${(1.4*p).toFixed(1)} HP per second after 4 s without taking damage.`},
 shield:{n:'Shield',ic:'🛡️',act:0,d:p=>`Gives you a 20-point shield bubble every ${Math.round(42/p)} s when it is down.`},
 magnet:{n:'Magnet',ic:'🧲',act:0,d:p=>`Royale: auto-grabs ammo and medkits that land within 3.4 m of you.`},
 decoy:{n:'Decoy',ic:'🎭',act:1,d:p=>`Ability button / X: drops a hologram of you; bots farther than 8 m lose you for ${Math.round(6*p)} s (${Math.round(32/p)} s cooldown).`},
 finder:{n:'Diamond Finder',ic:'💎',act:0,d:p=>`Sniffs out 1 💎 every ${Math.round(85/p)} s while you play a match (max 4 per match).`}};
// pw = power multiplier of the ability (kept modest so nothing is overpowered)
export const SK_DEFS=[
 {id:'dog',name:'Biscuit',kind:'Puppy',ab:'guard',pw:1,rar:0,price:120,col:0xc99a5b},
 {id:'cat',name:'Mochi',kind:'Kitten',ab:'lucky',pw:1,rar:0,price:120,col:0x9aa0a8},
 {id:'bunny',name:'Hopper',kind:'Bunny',ab:'magnet',pw:1,rar:0,price:140,col:0xf4f0ea},
 {id:'bat',name:'Echo',kind:'Bat',ab:'scout',pw:1,rar:1,price:240,col:0x5a3a8a},
 {id:'fox',name:'Ember',kind:'Fox',ab:'tracker',pw:1,rar:1,price:240,col:0xe8742a},
 {id:'penguin',name:'Waddles',kind:'Penguin',ab:'medic',pw:1,rar:1,price:260,col:0x2a3140},
 {id:'bear',name:'Bruno',kind:'Bear',ab:'shield',pw:1,rar:2,price:420,col:0x7a4a2a},
 {id:'tiger',name:'Stripes',kind:'Tiger',ab:'decoy',pw:1,rar:2,price:440,col:0xf08a24},
 {id:'hedgehog',name:'Zippy',kind:'Speedy Hedgehog',ab:'sprinter',pw:1.5,rar:2,price:460,col:0x1fa8c9,orig:1},
 {id:'lion',name:'Leo',kind:'Lion Cub',ab:'finder',pw:1,rar:3,price:700,col:0xe0a640},
 {id:'superdog',name:'Captain Woof',kind:'Caped Hero Pup',ab:'guard',pw:1.5,rar:3,price:720,col:0xb98a5a,orig:1},
 {id:'twohead',name:'Purrbark',kind:'Two-Headed Cat-Dog',ab:'tracker',pw:1.5,rar:3,price:700,col:0xc9a27a,orig:1},
 {id:'robot',name:'Bolt',kind:'Robot Buddy',ab:'scout',pw:1.4,rar:3,price:750,col:0x7fa6d8,orig:1},
 {id:'ghost',name:'Boo',kind:'Friendly Ghost',ab:'decoy',pw:1.3,rar:4,price:1000,col:0xe8f4ff,orig:1},
 {id:'dragon',name:'Pyro',kind:'Baby Dragon',ab:'lucky',pw:1.6,rar:4,price:1100,col:0x3fbf5a,orig:1}];
export const SK_BY=Object.fromEntries(SK_DEFS.map(d=>[d.id,d]));
export const SK_IDS=SK_DEFS.map(d=>d.id);
export const SK_FLAVOR={dog:'Loyal and a little bit grumpy.',cat:'Always lands on a good drop.',bunny:'Collects everything that bounces.',bat:'Hears enemies through the walls.',fox:'Never loses a trail.',penguin:'Waddles over with bandages.',bear:'Big hugs, bigger bubbles.',tiger:'Makes a very convincing double of you.',hedgehog:'Zoom zoom! Original speedy hedgehog.',lion:'Sniffs diamonds from across the map.',superdog:'Cape on, ears up, zap zap!',twohead:'Two heads, one very good nose.',robot:'Beep boop, scanning...',ghost:'Boo! Now you see me, now you don\'t.',dragon:'Hoards luck instead of gold.'};
export const abOf=id=>{const d=SK_BY[id];return d?{...AB[d.ab],key:d.ab,pw:d.pw,text:AB[d.ab].d(d.pw)}:null};
// ---------------------------------------------------------------- models (shared geometry + cached materials: cheap on phones)
const GE={sph:new THREE.SphereGeometry(1,10,8),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,8),cyl:new THREE.CylinderGeometry(1,1,1,10),tor:new THREE.TorusGeometry(1,.18,6,14)};
const MC={};function mat(c,o={}){const k=c+'|'+(o.em||0)+'|'+(o.op||1)+'|'+(o.ro??.7);if(MC[k])return MC[k];const m=new THREE.MeshStandardMaterial({color:c,roughness:o.ro??.7,metalness:o.me||0,flatShading:!!o.flat,transparent:(o.op||1)<1,opacity:o.op||1,emissive:o.em?c:0x000000,emissiveIntensity:o.em||0});if(o.op&&o.op<1)m.depthWrite=false;return MC[k]=m}
function P(par,t,col,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,o){const m=new THREE.Mesh(GE[t],o&&o.m?o.m:mat(col,o));m.position.set(x,y,z);m.scale.set(sx,sy??sx,sz??sx);m.rotation.set(rx,ry,rz);par.add(m);return m}
const G=(par,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);par.add(g);return g};
const EYE=mat(0x14141c,{ro:.3}),EYEW=mat(0xffffff,{ro:.4});
function eyes(h,x,y,z,r=.045,sp=1){for(const s of[-1,1]){P(h,'sph',0,s*x,y,z,r*1.0,r*1.15,r*.7,0,0,0,{m:EYE});P(h,'sph',0,s*x+s*r*.15,y+r*.45,z+r*.38,r*.32,r*.32,r*.25,0,0,0,{m:EYEW})}}
// generic four-legged buddy; o: body/belly/head colours + ear/tail/snout style. Faces +Z.
function quad(o){const root=new THREE.Group(),b=G(root);const L=o.leg??.13,BH=o.bh??.2,BL=o.bl??.3,BW=o.bw??.17,HR=o.hr??.15;const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,sc:o.sc??1};
 const body=P(b,'sph',o.col,0,L+BH,0,BW,BH,BL);if(o.belly)P(b,'sph',o.belly,0,L+BH*.62,.03,BW*.85,BH*.7,BL*.82);
 if(o.chest)P(b,'sph',o.chest,0,L+BH*.95,BL*.66,BW*.7,BH*.8,BL*.3);
 const hd=G(b,0,L+BH*1.35,BL*.82);rig.head=hd;P(hd,'sph',o.hcol??o.col,0,0,0,HR);
 if(o.snout!==false)P(hd,'sph',o.mcol??o.belly??o.col,0,-HR*.28,HR*.78,HR*.52,HR*.4,HR*.5);P(hd,'sph',o.nose??0x2a1a1a,0,-HR*.12,HR*1.2,HR*.17,HR*.13,HR*.12,0,0,0,{ro:.3});
 eyes(hd,HR*.42,HR*.2,HR*.78,HR*.3);
 const E=o.ear||'point',ec=o.ecol??o.col;for(const s of[-1,1]){let e;
  if(E==='point'){e=P(hd,'cone',ec,s*HR*.62,HR*.95,-HR*.1,HR*.38,HR*.7,HR*.3,0,0,-s*.35);P(hd,'cone',o.inner??0xf5a5b5,s*HR*.62,HR*.9,-HR*.02,HR*.2,HR*.4,HR*.12,0,0,-s*.35)}
  else if(E==='round'){e=P(hd,'sph',ec,s*HR*.72,HR*.85,-HR*.05,HR*.3,HR*.3,HR*.16);P(hd,'sph',o.inner??0xe6b9a0,s*HR*.72,HR*.85,HR*.02,HR*.17,HR*.17,HR*.1)}
  else if(E==='floppy'){e=P(hd,'sph',ec,s*HR*.92,HR*.3,-HR*.1,HR*.2,HR*.55,HR*.3,0,0,s*.22)}
  else if(E==='long'){e=P(hd,'sph',ec,s*HR*.38,HR*1.5,-HR*.15,HR*.2,HR*.95,HR*.14,0,0,-s*.12);P(hd,'sph',o.inner??0xf5a5b5,s*HR*.38,HR*1.5,-HR*.05,HR*.11,HR*.7,HR*.08,0,0,-s*.12)}
  if(e)rig.ears.push(e)}
 const lp=[[1,1],[-1,1],[1,-1],[-1,-1]];lp.forEach(([sx,sz],i)=>{const g=G(b,sx*BW*.62,L,sz*BL*.52);P(g,'cyl',o.lcol??o.col,0,-L*.5,0,.036,L*.5,.036);P(g,'sph',o.pcol??o.lcol??o.belly??o.col,0,-L,.02,.05,.035,.065);rig.legs.push({g,ph:i%3===0?0:Math.PI})});
 const T=o.tail||'cur';const tg=G(b,0,L+BH*1.05,-BL*.92);rig.tail=tg;
 if(T==='cur'){P(tg,'cyl',o.col,0,.07,-.03,.03,.1,.03,-.7)}else if(T==='up'){P(tg,'cyl',o.col,0,.12,-.02,.028,.15,.028,-.2);P(tg,'sph',o.tcol??o.col,0,.28,-.04,.034)}
 else if(T==='fluff'){P(tg,'sph',o.tcol??o.col,0,.02,-.07,.09,.09,.12)}else if(T==='long'){P(tg,'cyl',o.col,0,.05,-.1,.025,.17,.025,-1.1);P(tg,'sph',o.tcol??o.col,0,.12,-.28,.04)}
 else if(T==='bush'){P(tg,'sph',o.col,0,.04,-.12,.07,.08,.2,-.5);P(tg,'sph',o.tcol??0xffffff,0,.14,-.3,.065,.07,.1)}else if(T==='tuft'){P(tg,'cyl',o.col,0,.05,-.1,.022,.16,.022,-1.0);P(tg,'sph',o.tcol??0x8a4a1a,0,.1,-.27,.045,.045,.07)}
 else if(T==='stub'){P(tg,'sph',o.col,0,.02,-.03,.045)}
 root.userData.rig=rig;return{root,b,hd,rig,L,BH,BL,BW,HR}}
const B={
dog(){const q=quad({col:0xc99a5b,belly:0xf1e3c7,mcol:0xf1e3c7,ear:'floppy',ecol:0x7a4a24,tail:'up',tcol:0xc99a5b,bl:.3,hr:.155,chest:0xf1e3c7});P(q.hd,'sph',0x7a4a24,.09,.08,.06,.05,.04,.04);return q.root},
cat(){const q=quad({col:0x9aa0a8,belly:0xe9e9ee,mcol:0xf1d8d8,ear:'point',tail:'long',tcol:0x6f757d,hr:.14,bl:.26,bw:.15,leg:.12,nose:0xe08a9a});for(const s of[-1,1])for(let i=0;i<3;i++)P(q.hd,'box',0x6f757d,s*.14,.04+i*.026,.08,.008,.007,.06,0,0,s*.3);for(let i=0;i<3;i++)P(q.b,'box',0x6f757d,0,.3+.0,-.02-.07*i+.1,.14,.012,.02);return q.root},
bunny(){const q=quad({col:0xf4f0ea,belly:0xffffff,mcol:0xfff4f4,ear:'long',tail:'fluff',tcol:0xffffff,hr:.15,bl:.24,bw:.16,leg:.1,nose:0xf08aa0,inner:0xf6b6c6});q.rig.hop=1;return q.root},
fox(){const q=quad({col:0xe8742a,belly:0xfff1e0,mcol:0xfff1e0,ear:'point',ecol:0xe8742a,inner:0x2a1a14,tail:'bush',tcol:0xffffff,hr:.14,bl:.28,leg:.14,lcol:0x2a1a14,nose:0x1a1010});return q.root},
penguin(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,waddle:1};
 P(b,'sph',0x2a3140,0,.24,0,.19,.24,.17);P(b,'sph',0xffffff,0,.22,.07,.14,.2,.1);const hd=G(b,0,.5,.02);rig.head=hd;P(hd,'sph',0x2a3140,0,0,0,.13);P(hd,'sph',0xffffff,0,-.02,.07,.1,.09,.06);P(hd,'cone',0xff9a1a,0,-.02,.15,.05,.07,.05,Math.PI/2);eyes(hd,.055,.04,.1,.035);
 for(const s of[-1,1]){const w=G(b,s*.19,.3,0);P(w,'sph',0x2a3140,s*.025,-.08,0,.04,.12,.08);rig.wings.push(w);rig.legs.push({g:G(b,s*.07,.05,.03),ph:s>0?0:Math.PI});P(rig.legs[rig.legs.length-1].g,'sph',0xff9a1a,0,-.02,.05,.06,.025,.09)}root.userData.rig=rig;return root},
bear(){const q=quad({col:0x7a4a2a,belly:0x9a6a44,mcol:0xd8b48a,ear:'round',inner:0xd8b48a,tail:'stub',hr:.17,bl:.3,bw:.2,bh:.23,leg:.12,nose:0x1a1010,chest:0x8a5a34});q.rig.sc=1.1;return q.root},
tiger(){const q=quad({col:0xf08a24,belly:0xfff1e0,mcol:0xfff1e0,ear:'round',inner:0xfff1e0,tail:'tuft',hr:.16,bl:.3,bw:.18,leg:.13,nose:0x2a1a1a});for(let i=0;i<5;i++){const z=-.2+i*.12;for(const s of[-1,1])P(q.b,'box',0x1a1210,s*.15,.34,z,.03,.13,.03,0,0,s*.45)}for(const s of[-1,1])for(let i=0;i<2;i++)P(q.hd,'box',0x1a1210,s*.14,.08+i*.04,.1,.012,.02,.05,0,0,s*.6);P(q.hd,'box',0x1a1210,0,.16,.1,.015,.05,.02);for(let i=0;i<3;i++)P(q.rig.tail,'tor',0x1a1210,0,.04,-.1-i*.05,.026,.026,.026);return q.root},
hedgehog(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,speedy:1};
 const TEAL=0x1fa8c9,DK=0x146a86,CRM=0xf6e6cc,OR=0xff8a1a,YL=0xffd23f;P(b,'sph',TEAL,0,.19,-.02,.15,.15,.16);P(b,'sph',CRM,0,.16,.07,.11,.11,.08);
 const hd=G(b,0,.33,.07);rig.head=hd;P(hd,'sph',TEAL,0,0,0,.14);P(hd,'sph',CRM,0,-.035,.075,.105,.085,.085);P(hd,'sph',0xe86a8a,0,-.015,.152,.024,.02,.02,0,0,0,{ro:.3});
 for(const s of[-1,1]){P(hd,'sph',0x14141c,s*.058,.04,.1,.045,.058,.035,0,0,0,{ro:.3});P(hd,'sph',0xffffff,s*.066,.062,.128,.017,.017,.012);P(hd,'sph',DK,s*.095,.12,-.02,.05,.05,.03)}
 P(hd,'tor',YL,0,.07,-.0,.15,.15,.15,Math.PI/2,0,0);P(hd,'box',OR,.0,.09,.14,.06,.035,.012);P(hd,'box',OR,.03,.07,.145,.025,.04,.01,0,0,.5);// headband + bolt badge
 for(let r=0;r<4;r++)for(let i=0;i<7-r;i++){const a=(i-(6-r)/2)/3;P(b,'cone',r%2?DK:TEAL,a*.17*(1-r*.1),.31-r*.04+Math.abs(a)*-.03,-.16-r*.05,.04,.13,.04,-1.9+Math.abs(a)*.3-r*.05,a*.35,0)}
 for(const s of[-1,1]){rig.legs.push({g:G(b,s*.08,.1,.03),ph:s>0?0:Math.PI});const lg=rig.legs[rig.legs.length-1].g;P(lg,'cyl',CRM,0,-.04,0,.032,.05,.032);P(lg,'sph',OR,0,-.09,.03,.055,.04,.085);P(lg,'box',YL,0,-.075,.0,.058,.012,.045)}
 for(const s of[-1,1]){const a=G(b,s*.15,.2,.05);P(a,'cyl',CRM,s*.02,-.04,.03,.026,.07,.026,.6,0,s*.3);P(a,'sph',0xffffff,s*.04,-.1,.07,.042);rig.wings.push(a)}
 rig.tail=G(b,0,.12,-.17);P(rig.tail,'sph',DK,0,0,-.0,.035);root.userData.rig=rig;return root},
lion(){const q=quad({col:0xe0a640,belly:0xf3d9a0,mcol:0xf3d9a0,ear:'round',ecol:0xe0a640,inner:0xb86b1e,tail:'tuft',tcol:0xb86b1e,hr:.15,bl:.3,bw:.19,leg:.14,nose:0x3a1a10});for(let i=0;i<12;i++){const a=i/12*6.28;P(q.hd,'sph',i%2?0xb86b1e:0x9a5516,Math.sin(a)*.17,Math.cos(a)*.17-.02,-.06,.09,.09,.09)}P(q.hd,'sph',0xb86b1e,0,0,-.1,.17,.17,.08);return q.root},
superdog(){const q=quad({col:0xb98a5a,belly:0xf1e3c7,mcol:0xf1e3c7,ear:'floppy',ecol:0x6a3a1a,tail:'up',tcol:0xb98a5a,bl:.3,hr:.155,chest:0xf1e3c7});
 P(q.hd,'box',0x1a1a24,0,.06,.1,.17,.04,.04);for(const s of[-1,1])P(q.hd,'sph',0xffffff,s*.045,.06,.126,.03,.025,.012);// hero mask
 const cp=G(q.b,0,.4,.15);const cape=P(cp,'box',0x12b5a6,0,-.13,-.19,.32,.32,.02,.35,0,0);cape.name='cape';q.rig.cape=cp;P(q.b,'tor',0xffd23f,0,.38,.2,.1,.1,.1,0,0,0);P(q.b,'cone',0xffd23f,0,.3,.43,.06,.04,.03,Math.PI/2,0,Math.PI);P(q.b,'sph',0xffd23f,0,.3,.43,.04,.04,.02);return q.root},
twohead(){const q=quad({col:0xc9a27a,belly:0xf1e3c7,mcol:0xf1e3c7,ear:'floppy',ecol:0x7a4a24,tail:'long',tcol:0xc9a27a,hr:.135,bl:.3,bw:.2,bh:.22,leg:.13,chest:0xf1e3c7});q.hd.position.x=-.11;q.hd.rotation.y=.2;
 const h2=G(q.b,.11,.13+.22*1.35,.3*.82);h2.rotation.y=-.2;P(h2,'sph',0x9aa0a8,0,0,0,.13);P(h2,'sph',0xf1d8d8,0,-.035,.1,.07,.05,.06);P(h2,'sph',0xe08a9a,0,-.016,.15,.02,.015,.015);eyes(h2,.055,.03,.1,.04);for(const s of[-1,1]){P(h2,'cone',0x9aa0a8,s*.08,.12,-.02,.05,.1,.04,0,0,-s*.3);P(h2,'cone',0xf5a5b5,s*.08,.115,0,.025,.06,.02,0,0,-s*.3)}q.rig.head2=h2;return q.root},
robot(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.1,spin:1};const M=mat(0x8fb6e8,{me:.1,ro:.45}),D=mat(0x3a4560,{me:.1,ro:.5}),Gl=mat(0x2fd5ff,{em:1.2});
 P(b,'box',0,0,.27,0,.2,.16,.16,0,0,0,{m:M});P(b,'box',0,0,.34,.082,.13,.06,.02,0,0,0,{m:D});P(b,'box',0,0,.2,.082,.04,.02,.02,0,0,0,{m:Gl});
 const hd=G(b,0,.5,0);rig.head=hd;P(hd,'box',0,0,0,0,.17,.12,.14,0,0,0,{m:M});P(hd,'box',0,0,.0,.073,.13,.07,.02,0,0,0,{m:D});for(const s of[-1,1])P(hd,'sph',0,s*.045,.005,.085,.03,.03,.018,0,0,0,{m:Gl});
 P(hd,'cyl',0,0,.14,0,.01,.06,.01,0,0,0,{m:D});rig.ant=P(hd,'sph',0,0,.21,0,.03,.03,.03,0,0,0,{m:Gl});
 for(const s of[-1,1]){P(b,'cyl',0,s*.14,.1,0,.07,.045,.07,0,0,Math.PI/2,{m:D});P(b,'sph',0,s*.2,.27,0,.04,.04,.04,0,0,0,{m:M});const a=G(b,s*.16,.31,0);P(a,'cyl',0,s*.03,-.07,0,.022,.08,.022,0,0,s*.3,{m:D});rig.wings.push(a)}
 P(b,'cyl',0,0,.16,0,.06,.035,.06,0,0,0,{m:D});root.userData.rig=rig;return root},
ghost(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.22,wob:1};const W=mat(0xe8f4ff,{op:.82,ro:.3,em:.25});
 P(b,'sph',0,0,.3,0,.17,.2,.16,0,0,0,{m:W});P(b,'cone',0,0,.1,0,.17,.3,.16,Math.PI,0,0,{m:W});for(let i=0;i<5;i++){const a=i/5*6.28;P(b,'sph',0,Math.sin(a)*.12,.05,Math.cos(a)*.12,.06,.07,.06,0,0,0,{m:W})}
 for(const s of[-1,1]){P(b,'sph',0,s*.065,.34,.13,.03,.045,.02,0,0,0,{m:EYE});const a=G(b,s*.17,.27,0);P(a,'sph',0,s*.04,-.04,0,.05,.09,.04,0,0,s*.4,{m:W});rig.wings.push(a);P(b,'sph',0xffa6c0,s*.12,.27,.14,.03,.02,.01,0,0,0,{op:.7})}P(b,'sph',0,0,.27,.15,.02,.03,.015,0,0,0,{m:EYE});root.userData.rig=rig;return root},
dragon(){const q=quad({col:0x3fbf5a,belly:0xffe28a,mcol:0x5fd37a,ear:'none',tail:'long',tcol:0x2f9a46,hr:.15,bl:.3,bw:.17,leg:.12,lcol:0x2f9a46,nose:0x1a3a20,snout:true});
 for(const s of[-1,1]){P(q.hd,'cone',0xfff1c0,s*.07,.15,-.03,.032,.12,.032,-.4,0,-s*.3);const w=G(q.b,s*.12,.34,.0);P(w,'cone',0x2f9a46,s*.1,.02,-.05,.1,.22,.025,0,0,-s*1.1);P(w,'cone',0x5fd37a,s*.12,.0,-.04,.07,.16,.02,0,0,-s*1.1);q.rig.wings.push(w)}
 for(let i=0;i<5;i++)P(q.b,'cone',0xffd23f,0,.4-i*.015,.2-i*.09,.028,.07,.028);P(q.b,'cone',0xffd23f,0,.0,0,.001,.001,.001);q.rig.fly=0;return q.root}};
B.bat=()=>{const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.3,flap:1};const C=0x5a3a8a,C2=0x3a2466;
 P(b,'sph',C,0,.3,0,.12,.13,.12);const hd=G(b,0,.43,.04);rig.head=hd;P(hd,'sph',C,0,0,0,.115);P(hd,'sph',0xd8b0e8,0,-.04,.08,.06,.04,.04);P(hd,'sph',0x2a1a3a,0,-.01,.115,.02,.015,.012);eyes(hd,.05,.03,.09,.035);
 for(const s of[-1,1]){P(hd,'cone',C,s*.07,.13,-.02,.05,.13,.025,0,0,-s*.15);P(hd,'cone',0xf0b8d8,s*.07,.12,0,.025,.08,.015,0,0,-s*.15);P(hd,'cone',0xffffff,s*.02,-.1,.1,.012,.03,.012,Math.PI)}
 for(const s of[-1,1]){const w=G(b,s*.1,.34,0);P(w,'cone',C2,s*.18,0,-.02,.1,.28,.01,0,0,-s*Math.PI/2);P(w,'cone',C,s*.1,.02,-.02,.05,.16,.012,0,0,-s*Math.PI/2);rig.wings.push(w)}
 rig.sc=1.45;root.userData.rig=rig;return root};
export function makePet(id){const f=B[id];const g=new THREE.Group();if(!f)return g;const m=f();m.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});const sc=(m.userData.rig&&m.userData.rig.sc)||1;m.scale.setScalar(sc*1.15);g.add(m);g.userData.rig=m.userData.rig;g.userData.inner=m;g.userData.id=id;return g}
export function animPet(g,t,mv,dt){const r=g.userData.rig;if(!r)return;const m=Math.min(1,mv);const ph=t*(r.speedy?20:r.waddle?10:12);
 for(const l of r.legs)l.g.rotation.x=Math.sin(ph+l.ph)*.8*m*(r.waddle?.6:1);
 if(r.tail)r.tail.rotation.y=Math.sin(t*(m>.1?11:6))*(r.waddle?0:.55);if(r.tail&&r.speedy)r.tail.rotation.x=Math.sin(t*15)*.2;
 if(r.head){r.head.rotation.y=Math.sin(t*1.3)*.25*(1-m);r.head.rotation.x=Math.sin(t*2.1)*.05}
 if(r.head2)r.head2.rotation.y=-.2-Math.sin(t*1.7+1)*.25*(1-m);
 for(let i=0;i<r.wings.length;i++){const w=r.wings[i],s=i?1:-1;if(r.flap||r.fly&&!r.spin&&!r.wob)w.rotation.z=s*(.1+Math.sin(t*(r.flap?22:14))*.7);else if(r.wob)w.rotation.z=s*Math.sin(t*5)*.25;else if(r.waddle)w.rotation.z=s*(.15+Math.abs(Math.sin(ph))*.4*m);else w.rotation.z=s*Math.sin(t*(m>.1?14:2))*.2*(m>.1?1:.4)}
 const inner=g.userData.inner;inner.position.y=(r.fly||0)+Math.abs(Math.sin(ph))*(r.hop?.09:.03)*m+Math.sin(t*2.2)*(r.fly?.035:.004);
 inner.rotation.z=r.waddle?Math.sin(ph)*.14*m:r.wob?Math.sin(t*2.4)*.1:0;inner.rotation.x=r.hop?-Math.abs(Math.sin(ph))*.12*m:m>.3&&r.speedy?.18:0;
 if(r.cape)r.cape.rotation.x=.25+m*.5+Math.sin(t*9)*.08*m;if(r.ant)r.ant.scale.setScalar(.03*(1+.4*Math.sin(t*6)));}
// ---------------------------------------------------------------- follower world + client abilities
const _v=new THREE.Vector3();
function texPrint(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.ellipse(32,40,13,19,0,0,7);x.fill();for(let i=0;i<4;i++){x.beginPath();x.ellipse(19+i*8.5,13+Math.abs(i-1.5)*3,4.2,5.5,0,0,7);x.fill()}const t=new THREE.CanvasTexture(c);return t}
function texMark(){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.lineWidth=9;x.strokeStyle='#ff3b3b';x.fillStyle='rgba(255,59,59,.25)';x.beginPath();x.arc(48,48,34,0,7);x.fill();x.stroke();x.fillStyle='#fff';x.beginPath();x.moveTo(48,70);x.lineTo(30,34);x.lineTo(66,34);x.closePath();x.fill();return new THREE.CanvasTexture(c)}
export function initSidekicks(A){
 const scene=A.scene,me=A.me,C=A.C,P0=A.PROG;const F=new Map();let t0=0,clock=0;
 const blobGeo=new THREE.CircleGeometry(1,16),blobMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 const root=new THREE.Group();root.name='sidekicks';scene.add(root);
 // ---- footprints (Tracker)
 const PRN=[];let prI=0;let prT=null;function prints(){if(PRN.length)return;prT=texPrint();const m=new THREE.MeshBasicMaterial({map:prT,color:0xff6a3a,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,blending:THREE.AdditiveBlending});const g=new THREE.PlaneGeometry(.22,.3);g.rotateX(-Math.PI/2);for(let i=0;i<70;i++){const o=new THREE.Mesh(g,m.clone());o.visible=false;o.renderOrder=3;o.userData.t=-9;root.add(o);PRN.push(o)}}
 // ---- scan markers (Scout)
 const MK=[];let mkT=null;let ring=null;function markers(){if(MK.length)return;mkT=texMark();for(let i=0;i<24;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:mkT,depthTest:false,depthWrite:false,transparent:true}));s.visible=false;s.renderOrder=999;root.add(s);MK.push(s)}
  ring=new THREE.Mesh(new THREE.TorusGeometry(1,.03,6,48),new THREE.MeshBasicMaterial({color:0x7fe8ff,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));ring.rotation.x=Math.PI/2;ring.visible=false;root.add(ring)}
 let scan=null,zaps=[],holos=[];
 const beamG=new THREE.CylinderGeometry(.03,.03,1,6);beamG.rotateX(Math.PI/2);beamG.translate(0,0,.5);
 function holoMk(){const g=new THREE.Group();const m=new THREE.MeshBasicMaterial({color:0x46e0ff,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending,wireframe:false});const add=(geo,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o)};add(GE.sph,0,1.62,0,.16,.19,.16);add(GE.box,0,1.2,0,.3,.5,.18);for(const s of[-1,1]){add(GE.box,s*.2,1.15,0,.08,.5,.1);add(GE.box,s*.09,.45,0,.12,.85,.14)}g.userData.m=m;return g}
 // ---- ability state
 let cdUntil=0,dur=0;const btn=document.getElementById('bPet');
 const myDef=()=>SK_BY[P0.pet];
 function activeDef(){const d=myDef();return d&&AB[d.ab].act?d:null}
 function setBtn(){if(!btn)return;const d=activeDef();const show=!!d&&A.inGame()&&!C.hub&&me.alive;btn.classList.toggle('hidden',!show);if(!show)return;const nowMs=performance.now();const left=Math.max(0,cdUntil-nowMs);btn.innerHTML=`<span class="pi">${AB[d.ab].ic}</span>`;btn.style.setProperty('--cd',left?String(Math.round(100*(1-left/(dur||1)))):'100');btn.classList.toggle('cool',left>0);btn.title=AB[d.ab].n}
 function use(){const d=activeDef();if(!d||!A.inGame()||C.hub||!me.alive)return false;const now=performance.now();if(now<cdUntil)return false;const pw=d.pw;
  if(d.ab==='scout'){markers();scan={t:now,d:5000*pw};dur=26000/pw;cdUntil=now+dur;A.toast&&A.toast(`${d.name} scans the area 📡`)}
  else if(d.ab==='decoy'){dur=32000/pw;cdUntil=now+dur;A.send({t:'pab',k:'decoy'});A.toast&&A.toast(`${d.name} drops a decoy 🎭`)}
  A.sfx&&A.sfx('ping');return true}
 if(btn){const dn=e=>{e.stopPropagation();e.preventDefault();btn.classList.add('down');use()};btn.addEventListener('pointerdown',dn);const up=()=>btn.classList.remove('down');btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up)}
 addEventListener('keydown',e=>{if(e.code==='KeyX'&&!e.repeat&&!/INPUT|TEXTAREA/.test((e.target&&e.target.tagName)||'')&&A.canAct()){use()}});
 function onFx(m){if(!m)return;if(m.k==='zap'){const o=F.get(m.id===me.id?'me':m.id),q=m.v===me.id?{rp:me.pos}:C.players[m.v];if(!o||!q)return;const g=new THREE.Mesh(beamG,new THREE.MeshBasicMaterial({color:0xffe45a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));g.userData={t:performance.now(),a:o,v:q};root.add(g);zaps.push(g)}
  else if(m.k==='decoy'){const h=holoMk();h.position.set(m.x,m.y,m.z);h.rotation.y=m.yaw||0;h.userData.t=performance.now();h.userData.d=(m.d||6)*1000;root.add(h);holos.push(h)}}
 // ---- followers
 function ownersNow(){const out=[];const mine=P0.pet;if(mine&&SK_BY[mine]&&(me.alive||C.hub)&&!me.air&&!(A.spectating&&A.spectating()))out.push({key:'me',pet:mine,pos:me.pos,ground:me.ground,vel:me.vel,own:1});
  for(const id in C.players){if(id===me.id)continue;const q=C.players[id];const pet=q.ws&&q.ws.pet;if(!pet||!SK_BY[pet]||!q.rp||!q.model||!q.model.visible||(!q.alive&&!C.hub)||q.air)continue;out.push({key:id,pet,pos:q.rp,ground:true,vel:null,q})}return out}
 function mk(o){const g=makePet(o.pet);g.userData.blob=new THREE.Mesh(blobGeo,blobMat);g.userData.blob.rotation.x=-Math.PI/2;root.add(g.userData.blob);root.add(g);const f={key:o.key,pet:o.pet,g,pos:new THREE.Vector3(o.pos.x-1,o.pos.y,o.pos.z+1),vel:new THREE.Vector3(),yaw:0,home:0,gy:o.pos.y,age:0,lp:new THREE.Vector3(o.pos.x,o.pos.y,o.pos.z),mv:0};f.hp=new THREE.Vector3();F.set(o.key,f);return f}
 function drop(f){root.remove(f.g);root.remove(f.g.userData.blob);F.delete(f.key)}
 function pushOut(f,cols){if(!cols)return;const r=.22,y=f.gy;for(let i=0;i<cols.length;i++){const c=cols[i];if(c.y0>y+.45||c.y1<y+.08)continue;if(f.pos.x+r<c.x0||f.pos.x-r>c.x1||f.pos.z+r<c.z0||f.pos.z-r>c.z1)continue;
   const l=f.pos.x+r-c.x0,rr=c.x1-(f.pos.x-r),u=f.pos.z+r-c.z0,d=c.z1-(f.pos.z-r);const m=Math.min(l,rr,u,d);if(m===l)f.pos.x=c.x0-r;else if(m===rr)f.pos.x=c.x1+r;else if(m===u)f.pos.z=c.z0-r;else f.pos.z=c.z1+r}}
 function step(f,o,dt,cols){const O=o.pos;f.age+=dt;
  // heading = owner's movement direction (smoothed), so the buddy trails behind instead of orbiting when you look around
  let hx=0,hz=0;if(o.vel){hx=o.vel.x;hz=o.vel.z}else{hx=(O.x-f.lp.x)/Math.max(dt,.001);hz=(O.z-f.lp.z)/Math.max(dt,.001)}f.lp.set(O.x,O.y,O.z);const hs=Math.hypot(hx,hz);if(hs>1.2){let da=Math.atan2(hx,hz)-f.home;da=Math.atan2(Math.sin(da),Math.cos(da));f.home+=da*Math.min(1,dt*2.2)}
  const sh=Math.sin(f.home),ch=Math.cos(f.home);const tx=O.x-sh*1.5+ch*1.05,tz=O.z-ch*1.5-sh*1.05;
  if(o.ground){f.gy+=(O.y-f.gy)*Math.min(1,dt*6)}if(Math.abs(O.y-f.gy)>5)f.gy=O.y;
  let dx=tx-f.pos.x,dz=tz-f.pos.z,dist=Math.hypot(dx,dz);
  f.far=dist>5?(f.far||0)+dt:0;if(dist>12||f.far>1.6){f.pos.set(tx,f.gy,tz);f.age=0;f.far=0;dx=dz=dist=0;f.vel.set(0,0,0)}
  const want=dist<.18?0:Math.min(12.5,.6+dist*3.6);const a=1-Math.exp(-9*dt);const wx=dist>.01?dx/dist*want:0,wz=dist>.01?dz/dist*want:0;f.vel.x+=(wx-f.vel.x)*a;f.vel.z+=(wz-f.vel.z)*a;f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;pushOut(f,cols);
  const sp=Math.hypot(f.vel.x,f.vel.z);f.mv+=((sp>.35?Math.min(1.4,sp/2.2):0)-f.mv)*Math.min(1,dt*10);
  let ty=sp>.5?Math.atan2(f.vel.x,f.vel.z):Math.atan2(O.x-f.pos.x,O.z-f.pos.z);let dy=ty-f.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));f.yaw+=dy*Math.min(1,dt*(sp>.5?10:3.5));
  const g=f.g;g.position.set(f.pos.x,f.gy,f.pos.z);g.rotation.y=f.yaw;const sc=Math.min(1,f.age/.4);const pop=sc<1?(1-Math.pow(1-sc,3))*(1+Math.sin(sc*3.14)*.12):1;g.scale.setScalar(Math.max(.01,pop));
  const bl=g.userData.blob;bl.position.set(f.pos.x,f.gy+.025,f.pos.z);const bs=.2*pop*((g.userData.rig&&g.userData.rig.fly)?1-(g.userData.rig.fly*1.2):1);bl.scale.set(bs*1.3,bs*1.3,bs);
  animPet(g,clock,f.mv,dt)}
 function update(dt,now){clock+=dt;const on=A.inGame();root.visible=on;if(!on){setBtn();return}const cols=A.cols();const own=ownersNow();const seen=new Set();
  for(const o of own){seen.add(o.key);let f=F.get(o.key);if(f&&f.pet!==o.pet){drop(f);f=null}if(!f)f=mk(o);if(f.pos.distanceToSquared(o.pos)>150*150){f.g.visible=false;f.g.userData.blob.visible=false;continue}f.g.visible=true;f.g.userData.blob.visible=true;step(f,o,Math.min(dt,.05),cols)}
  for(const [k,f] of F)if(!seen.has(k))drop(f);
  // scan markers / ring
  if(scan){const e=now-scan.t;if(e>scan.d){scan=null;for(const s of MK)s.visible=false;if(ring)ring.visible=false}else{let i=0;for(const id in C.players){const q=C.players[id];if(i>=MK.length)break;if(!q.alive||!q.rp||q.air||!A.isEnemy(q))continue;const s=MK[i++];s.visible=true;const d=Math.hypot(q.rp.x-me.pos.x,q.rp.z-me.pos.z);s.position.set(q.rp.x,q.rp.y+2.25,q.rp.z);const sz=.55+Math.min(d,80)*.028;s.scale.set(sz,sz,1);s.material.opacity=Math.min(1,(scan.d-e)/600)}for(;i<MK.length;i++)MK[i].visible=false;
    if(e<900){ring.visible=true;const r=1+e/900*40;ring.position.set(me.pos.x,me.pos.y+.3,me.pos.z);ring.scale.set(r,r,r);ring.material.opacity=.9*(1-e/900)}else ring.visible=false}}
  // tracker: footprints of enemies near you
  const d0=myDef();if(d0&&d0.ab==='tracker'&&me.alive&&!C.hub){prints();const life=5000*d0.pw;for(const id in C.players){const q=C.players[id];if(id===me.id||!q.alive||!q.rp||q.air||!A.isEnemy(q))continue;if(Math.hypot(q.rp.x-me.pos.x,q.rp.z-me.pos.z)>45)continue;const L=q._pl||(q._pl={x:q.rp.x,z:q.rp.z,s:1});if(Math.hypot(q.rp.x-L.x,q.rp.z-L.z)>.95&&q.rp.y<me.pos.y+8){const o=PRN[prI=(prI+1)%PRN.length];const hd=Math.atan2(q.rp.x-L.x,q.rp.z-L.z);L.s=-L.s;o.position.set(q.rp.x+Math.cos(hd)*.12*L.s,q.rp.y+.045,q.rp.z-Math.sin(hd)*.12*L.s);o.rotation.y=hd;o.userData.t=now;o.userData.life=life;o.visible=true;L.x=q.rp.x;L.z=q.rp.z}}
   for(const o of PRN)if(o.visible){const a=1-(now-o.userData.t)/(o.userData.life||5000);if(a<=0)o.visible=false;else o.material.opacity=Math.min(1,a*1.4)*.85}}
  else if(PRN.length)for(const o of PRN)o.visible=false;
  // zap beams + holograms
  for(let i=zaps.length-1;i>=0;i--){const z=zaps[i],e=(performance.now()-z.userData.t)/1000;if(e>.28){root.remove(z);z.material.dispose();zaps.splice(i,1);continue}const a=z.userData.a.g.position,v=z.userData.v.rp;z.position.set(a.x,a.y+.3,a.z);_v.set(v.x,v.y+1.1,v.z);z.lookAt(_v);z.scale.set(1+Math.random()*.6,1+Math.random()*.6,z.position.distanceTo(_v));z.material.opacity=.95*(1-e/.28)}
  for(let i=holos.length-1;i>=0;i--){const h=holos[i],e=performance.now()-h.userData.t;if(e>h.userData.d){root.remove(h);holos.splice(i,1);continue}h.userData.m.opacity=.45*Math.min(1,(h.userData.d-e)/500)*(.8+.2*Math.sin(e/90));h.position.y+=0}
  setBtn()}
 return{update,use,onFx,speedMul:()=>{const d=myDef();return d&&d.ab==='sprinter'&&A.inGame()?1+.06*d.pw:1},root,followers:F,state:()=>({scan:!!scan,cd:Math.max(0,cdUntil-performance.now())|0,holos:holos.length,zaps:zaps.length,prints:PRN.filter(o=>o.visible).length,markers:MK.filter(s=>s.visible).length}),def:myDef,reset(){scan=null;cdUntil=0}}}
// ---------------------------------------------------------------- host side (passive abilities, resolved for every human with a sidekick)
export function luck(p){const d=SK_BY[p&&p.ws&&p.ws.pet];return d&&d.ab==='lucky'?.18*d.pw:0}
export function hostPets(X,dt){const H=X.H();if(!H||H.phase!=='play')return;const t=H.t;
 for(const p of X.plist()){if(p.bot||!p.alive||p.down||p.air||p.elim)continue;const id=p.ws&&p.ws.pet;const d=SK_BY[id];if(!d)continue;const S=(p._pk&&p._pk.id===id)?p._pk:(p._pk={id,a:t+(d.ab==='magnet'||d.ab==='guard'?1:6),fl:[],dc:0});const pw=d.pw;
  if(d.ab==='guard'){if(t<S.a||H.noFight)continue;const R=5+pw;let best=null,bd=1e9;for(const q of X.plist()){if(q.id===p.id||!q.alive||q.down||q.air||(q.prot&&t<q.prot)||!X.enemy(p,q))continue;const dd=Math.hypot(q.p[0]-p.p[0],q.p[1]-p.p[1],q.p[2]-p.p[2]);if(dd>R||dd>=bd||!X.los(p,q))continue;bd=dd;best=q}
   if(best){S.a=t+5.4-pw*1.2;X.bcast({t:'pfx',k:'zap',id:p.id,v:best.id});X.damage(best,Math.round(6+4*pw),p.id,false,'fists')}else S.a=t+.4}
  else if(d.ab==='medic'){if(p.hp<100&&t-(p.hurtT||0)>4){const o=Math.floor(p.hp);p.hp=Math.min(100,p.hp+1.4*pw*dt);if(Math.floor(p.hp)!==o)X.bcast({t:'hp',id:p.id,hp:Math.round(p.hp)})}}
  else if(d.ab==='shield'){if(t>=S.a&&(p.sh||0)<20){S.a=t+42/pw;p.sh=20;X.toPlayer(p.id,{t:'shd',sh:20});X.bcast({t:'pfx',k:'shield',id:p.id})}else if(t>=S.a)S.a=t+3}
  else if(d.ab==='magnet'){const E=H.br;if(!E||!E.items||t<S.a)continue;S.a=t+.45;let n=0;for(const k in E.items){const it=E.items[k];if(it[1]!==1&&it[1]!==2)continue;if(Math.hypot(p.p[0]-it[4],p.p[2]-it[6])>3.4||Math.abs(p.p[1]-it[5])>2.5)continue;if(X.take(p,+k)&&++n>=2)break}}
  else if(d.ab==='finder'){if(H.noFight!==undefined&&0)continue;if(t<S.a)continue;S.fl=S.fl.filter(x=>t-x<360);if(S.fl.length>=4){S.a=t+30;continue}S.fl.push(t);S.a=t+85/pw;X.toPlayer(p.id,{t:'pdia',n:1})}}}
export function hostAbility(X,p,m){const H=X.H();if(!H||!p||!p.alive||H.phase!=='play')return;const d=SK_BY[p.ws&&p.ws.pet];if(!d)return;const S=(p._pk&&p._pk.id===d.id)?p._pk:(p._pk={id:d.id,a:H.t+6,fl:[],dc:0});
 if(d.ab==='decoy'&&m.k==='decoy'&&H.t>=S.dc-.6){S.dc=H.t+32/d.pw;p.decoy=H.t+6*d.pw;X.bcast({t:'pfx',k:'decoy',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],yaw:p.p[3]||0,d:6*d.pw})}}
