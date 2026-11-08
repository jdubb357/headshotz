// HeadShotz v103 pets, built in code (no third-party models): Celestial Chimera, Spin Capybara,
// Storm Wolf, Rocket Ostrich, Raptor, plus fur/scale/feather detail on the original 15 sidekicks.
import {THREE} from './gfx.js';
import {P,G,mat,glowEye} from './petkit.js';
const em=(c,e)=>mat(c,{em:e,ro:.35,me:.25});
function legs4(b,rig,x,z,y,m,dk,h=.12){for(const s of[-1,1])for(const q of[1,-1]){const g=G(b,s*x,y,q*z);P(g,'cyl',0,0,-h/2,0,.028,h/2,.028,0,0,0,{m});P(g,'sph',0,0,-h,.02,.04,.03,.055,0,0,0,{m:dk});rig.legs.push({g,ph:s*q>0?0:Math.PI})}}
export const NB4={
chimera(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.05,glow:[],sc:1.15};
 const gd=mat(0xf0c14a,{me:.72,ro:.28,em:.25,ec:0xffb000}),dk=mat(0xb8860b,{me:.6,ro:.35}),wh=mat(0xfff6d0,{ro:.45}),mn=mat(0x6a3a18,{ro:.5});
 P(b,'sph',0,0,.32,0,.18,.16,.28,0,0,0,{m:gd});P(b,'sph',0,0,.26,.08,.12,.1,.16,0,0,0,{m:wh});
 for(let i=0;i<6;i++)P(b,'cone',0,(i%2?.08:-.08),.42,-.1+i*.07,.03,.1,.03,-.4,0,0,{m:i%2?dk:gd});
 const hd=G(b,0,.5,.22);rig.head=hd;P(hd,'sph',0,0,0,0,.14,.13,.15,0,0,0,{m:gd});P(hd,'sph',0,0,-.02,.1,.08,.06,.07,0,0,0,{m:wh});
 for(const s of[-1,1]){glowEye(hd,rig,0xfff0a0,s*.06,.03,.1,.028,true);P(hd,'cone',0,s*.08,.12,-.02,.04,.1,.03,0,0,-s*.25,{m:dk})}
 const hd2=G(b,.16,.46,.08);hd2.rotation.y=-.5;P(hd2,'sph',0,0,0,0,.08,.07,.09,0,0,0,{m:wh});P(hd2,'cone',0,0,.02,.08,.025,.05,.02,Math.PI/2,0,0,{m:dk});glowEye(hd2,rig,0xffe08a,.03,.02,.07,.018,false);rig.head2=hd2;
 for(const s of[-1,1]){const w=G(b,s*.14,.4,-.02);for(let i=0;i<4;i++)P(w,'cone',0,s*(.06+i*.05),-.02,-.02,.04,.16+i*.02,.012,Math.PI/2,0,s*1.3,{m:i%2?em(0xffd23f,1.1):gd});rig.wings.push(w)}
 const tg=G(b,0,.3,-.28);rig.tail=tg;P(tg,'cyl',0,0,.04,-.08,.02,.16,.02,-1.1,0,0,{m:mn});P(tg,'sph',0,0,.14,-.22,.045,.04,.06,0,0,0,{m:em(0x7dff6a,.8)});
 legs4(b,rig,.1,.14,.2,gd,dk,.13);
 root.userData.rig=rig;return root},
spincapy(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],spin:1,sc:1.05};
 const fu=mat(0xc48a4a,{ro:.75}),dk=mat(0x8a5a2a,{ro:.8}),cr=mat(0xf3d2a2,{ro:.6}),nk=mat(0x3a2414,{ro:.4});
 P(b,'sph',0,0,.28,0,.2,.16,.26,0,0,0,{m:fu});P(b,'sph',0,0,.22,.06,.14,.1,.16,0,0,0,{m:cr});
 const hd=G(b,0,.4,.2);rig.head=hd;P(hd,'box',0,0,-.02,0,.16,.12,.14,0,0,0,{m:fu});P(hd,'box',0,0,-.04,.1,.12,.08,.1,0,0,0,{m:cr});P(hd,'sph',0,0,-.02,.16,.04,.035,.04,0,0,0,{m:nk});
 for(const s of[-1,1]){glowEye(hd,rig,0x1a120c,s*.06,.02,.12,.02,false);P(hd,'sph',0,s*.1,.08,-.02,.035,.035,.02,0,0,0,{m:dk})}
 P(b,'tor',0,0,.18,0,.28,.28,.28,Math.PI/2,0,0,{m:em(0xffd23f,.7)});
 legs4(b,rig,.1,.12,.16,fu,dk,.08);rig.tail=G(b,0,.22,-.24);P(rig.tail,'sph',0,0,0,0,.04,0,0,0,{m:dk});
 root.userData.rig=rig;return root},
stormwolf(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],speedy:1,sc:1.12};
 const fu=mat(0x4a5568,{ro:.7}),dk=mat(0x2c3340,{ro:.65}),st=em(0x8ecbff,1.2),cr=mat(0xd5dde8,{ro:.6});
 P(b,'sph',0,0,.32,.02,.14,.15,.3,0,0,0,{m:fu});P(b,'sph',0,0,.26,.08,.1,.09,.18,0,0,0,{m:cr});
 const hd=G(b,0,.46,.26);rig.head=hd;P(hd,'sph',0,0,0,.04,.1,.09,.14,0,0,0,{m:fu});P(hd,'sph',0,0,-.02,.12,.06,.05,.08,0,0,0,{m:cr});P(hd,'sph',0,0,.01,.18,.025,.02,.02,0,0,0,{m:dk});
 for(const s of[-1,1]){glowEye(hd,rig,0x9ad7ff,s*.045,.03,.1,.02,false);P(hd,'cone',0,s*.06,.1,-.02,.035,.09,.025,0,0,-s*.2,{m:dk})}
 for(let i=0;i<4;i++)P(b,'cone',0,0,.42,-.05+i*.08,.02,.08,.02,-.2,0,0,{m:st});
 const tg=G(b,0,.34,-.28);rig.tail=tg;P(tg,'cyl',0,0,.06,-.1,.02,.16,.02,-.8,0,0,{m:fu});P(tg,'sph',0,0,.16,-.22,.04,0,0,0,{m:st});
 legs4(b,rig,.08,.16,.2,fu,dk,.14);
 root.userData.rig=rig;return root},
rocketrich(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.08,glow:[],speedy:1,sc:1.2};
 const fe=mat(0xf4f7fb,{ro:.55}),bk=mat(0x1c1f26,{ro:.4,me:.4}),rk=em(0xff6a2a,1.3),be=mat(0xffb703,{ro:.4});
 P(b,'sph',0,0,.55,0,.12,.14,.16,0,0,0,{m:fe});P(b,'sph',0,0,.5,.04,.08,.1,.1,0,0,0,{m:bk});
 const hd=G(b,0,.72,.12);rig.head=hd;P(hd,'sph',0,0,0,0,.08,.08,.09,0,0,0,{m:fe});P(hd,'cone',0,0,-.01,.1,.02,.08,.02,Math.PI/2,0,0,{m:be});
 for(const s of[-1,1])glowEye(hd,rig,0xffe08a,s*.035,.02,.06,.016,false);
 for(const s of[-1,1]){const w=G(b,s*.1,.58,0);P(w,'cone',0,s*.12,0,-.02,.08,.2,.012,Math.PI/2,0,s*1.4,{m:fe});rig.wings.push(w)}
 P(b,'cyl',0,.14,.48,-.08,.05,.12,.05,0,0,0,{m:bk});P(b,'cone',0,.14,.42,-.08,.04,.08,.04,Math.PI,0,0,{m:rk});P(b,'sph',0,.14,.36,-.08,.03,0,0,0,{m:rk});
 for(const s of[-1,1]){const g=G(b,s*.05,.28,.02);P(g,'cyl',0,0,-.12,0,.015,.14,.015,0,0,0,{m:be});P(g,'sph',0,0,-.26,.02,.03,.02,.04,0,0,0,{m:bk});rig.legs.push({g,ph:s>0?0:Math.PI})}
 rig.tail=G(b,0,.5,-.16);P(rig.tail,'cone',0,0,.02,-.1,.03,.16,.02,-1.2,0,0,{m:fe});
 root.userData.rig=rig;return root},
raptor(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],speedy:1,sc:1.15};
 const sc=mat(0x3ddc97,{ro:.45,me:.15}),dk=mat(0x127a52,{ro:.5}),fe=em(0xff4d6a,.8),bk=mat(0xf2c14e,{ro:.4});
 P(b,'sph',0,0,.42,.04,.12,.13,.22,0,0,0,{m:sc});P(b,'sph',0,0,.36,.1,.08,.08,.12,0,0,0,{m:dk});
 const hd=G(b,0,.58,.2);rig.head=hd;P(hd,'sph',0,0,0,.06,.09,.08,.12,0,0,0,{m:sc});P(hd,'cone',0,0,-.02,.12,.025,.07,.02,Math.PI/2,0,0,{m:bk});
 for(let i=0;i<4;i++)P(hd,'cone',0,(i-1.5)*.02,-.04,.08,.008,.02,.008,Math.PI,0,0,{m:whSafe()});
 for(const s of[-1,1])glowEye(hd,rig,0xfff3a0,s*.04,.03,.07,.018,true);
 for(const s of[-1,1]){const a=G(b,s*.1,.48,.02);P(a,'cone',0,s*.08,-.02,0,.02,.12,.05,0,0,s*.8,{m:fe});rig.wings.push(a)}
 const tg=G(b,0,.4,-.2);rig.tail=tg;P(tg,'cyl',0,0,.02,-.16,.015,.2,.015,-1.15,0,0,{m:sc});
 for(const s of[-1,1]){const g=G(b,s*.06,.28,.04);P(g,'cyl',0,0,-.1,0,.02,.12,.02,.15,0,0,{m:dk});P(g,'cone',0,0,-.22,.04,.03,.04,.05,Math.PI/2,0,0,{m:bk});rig.legs.push({g,ph:s>0?0:Math.PI})}
 root.userData.rig=rig;return root}
};
function whSafe(){return mat(0xf7f7f2,{ro:.4})}
const FUR={dog:1,cat:1,bunny:1,fox:1,bear:1,tiger:1,lion:1,hedgehog:1,superdog:1,twohead:1};
const FEATHER={penguin:1,bat:1};
const SCALE={dragon:1};
export function detailOriginal(root,id,col,tier=1){if(!root)return;const fam=FUR[id]?'fur':FEATHER[id]?'feather':SCALE[id]?'scale':(id==='robot'||id==='ghost')?'glow':null;if(!fam)return;
 const rig=root.userData.rig||(root.userData.rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[]});
 const body=(root.children&&root.children[0])||root;
 const accent=fam==='feather'?0xffd23f:fam==='scale'?0x7dff6a:fam==='glow'?0x7fe8ff:(col||0xf2d2a2);
 const glow=tier>=3?1.45:tier>=2?.75:.08;
 const m=fam==='glow'?em(accent,1.1+glow):mat(accent,{ro:fam==='scale'?.32:.78,em:glow,ec:accent,me:fam==='scale'?.25:0});
 const touch=typeof navigator!=='undefined'&&(navigator.maxTouchPoints|0)>1;
 const n=touch?6:tier>=3?12:9;
 for(let i=0;i<n;i++){const a=(i/n)*6.2,z=-.16+(i%4)*.08;P(body,fam==='scale'?'sph':'cone',0,Math.cos(a)*.11,.36+(i%3)*.015,z,.018,fam==='feather'?.1:.055,.014,fam==='feather'?-.9:-.35,0,a,{m})}
 if(fam==='fur')P(body,'sph',0,0,.3,.14,.07,.045,.06,0,0,0,{m:mat(0xfff6ea,{ro:.55,em:tier>=2?.2:0,ec:0xfff6ea})});
 if(fam==='scale')for(let i=0;i<4;i++)P(body,'sph',0,(i-1.5)*.035,.4,-.12+i*.06,.028,.018,.028,0,0,0,{m});
 if(fam==='feather'&&rig.wings)for(const w of rig.wings)P(w,'cone',0,0,.02,0,.02,.08,.01,-.4,0,.2,{m});
 if(tier>=2&&rig.ears)for(const e of rig.ears)P(e,'sph',0,0,.04,0,.02,.02,.02,0,0,0,{m:em(accent,glow)});
 if(id==='robot')P(body,'tor',0,0,.42,0,.12,.12,.12,Math.PI/2,0,0,{m:em(0x7fe8ff,1.2+glow)});
 if(id==='ghost')P(body,'sph',0,0,.46,0,.045,.045,.045,0,0,0,{m:em(0xb8f0ff,1.4)});
 rig.glow=rig.glow||[];
}
