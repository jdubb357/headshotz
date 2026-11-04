// HeadShotz v96 detailed pets, batch 3: Stone Golem pup, Phoenix chick, Shark-Pup, Mirror Monkey, Gravity Owl, Magnet Raccoon, Magnet Drone. Original designs built in code.
import {THREE} from './gfx.js';
import {P,G,mat,bone,fan,glowEye} from './petkit.js';
const em=(c,e,o={})=>mat(c,{em:e,ro:.4,...o});
const legs=(b,rig,x,z,y,m,dk,n=4,r=.03,h=.1)=>{for(const s of[-1,1])for(const q of(n===4?[1,-1]:[0])){const g=G(b,s*x,y,q*z);P(g,'cyl',0,0,-h/2,0,r,h/2,r,0,0,0,{m});P(g,'sph',0,0,-h,.02,r*1.25,r*.8,r*1.6,0,0,0,{m:dk||m});rig.legs.push({g,ph:(s*q>0)?0:Math.PI})}};
export const NB3={
stonegolem(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],waddle:1};
 const st=mat(0x8c8f98,{ro:.95}),st2=mat(0x6c6f78,{ro:.95}),mo=mat(0x4f7a3a,{ro:.9}),rn=em(0x6fe0ff,1.4);
 P(b,'box',0,0,.28,0,.2,.15,.24,0,0,0,{m:st});P(b,'box',0,0,.2,.02,.17,.1,.2,0,.2,0,{m:st2});P(b,'sph',0,.04,.4,-.04,.1,.05,.12,0,0,0,{m:mo});P(b,'sph',0,-.07,.39,.06,.05,.03,.05,0,0,0,{m:mo});
 P(b,'box',0,0,.3,0,.04,.04,.04,0,.7,.7,{m:rn});P(b,'box',0,.1,.3,.05,.025,.12,.025,0,.1,0,{m:rn});
 const hd=G(b,0,.44,.17);rig.head=hd;P(hd,'box',0,0,0,0,.12,.1,.11,0,0,0,{m:st});P(hd,'box',0,0,-.04,.07,.1,.05,.04,0,0,0,{m:st2});P(hd,'box',0,0,.065,.05,.14,.025,.12,0,0,0,{m:st2});
 for(const s of[-1,1]){glowEye(hd,rig,0x6fe0ff,s*.045,.02,.115,.026,false);P(hd,'box',0,s*.06,.075,-.01,.03,.04,.03,0,0,s*.4,{m:st2})}
 P(hd,'cone',0,0,.1,.01,.03,.07,.03,0,0,0,{m:mo});
 for(const s of[-1,1]){const a=G(b,s*.2,.32,.05);P(a,'box',0,0,-.08,0,.05,.12,.05,0,0,0,{m:st});P(a,'box',0,0,-.17,.01,.07,.06,.07,0,0,0,{m:st2});rig.wings.push(a)}
 legs(b,rig,.1,.12,.17,st,st2,4,.045,.14);P(b,'box',0,0,.22,-.25,.06,.05,.07,0,0,0,{m:st2});
 for(let i=0;i<4;i++)P(b,'cone',0,(i%2?.07:-.07)+(i-1.5)*.03,.37,-.12+i*.1,.03,.07,.03,0,0,0,{m:rn});
 root.userData.rig=rig;return root},
phoenix(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.12,flap:1,glow:[]};
 const fl=mat(0xff8a1a,{ro:.7,em:.35,ec:0xff5a00}),fy=mat(0xffd23a,{ro:.7,em:.6,ec:0xffa500}),rd=mat(0xe0301a,{ro:.7,em:.4,ec:0xff2200}),bk=mat(0xffb040,{ro:.4});
 P(b,'sph',0,0,.28,0,.14,.14,.16,0,0,0,{m:fl});P(b,'sph',0,0,.25,.07,.1,.1,.1,0,0,0,{m:fy});
 const hd=G(b,0,.42,.1);rig.head=hd;P(hd,'sph',0,0,0,0,.1,.095,.1,0,0,0,{m:fl});P(hd,'cone',0,0,-.015,.1,.03,.07,.028,Math.PI/2+.1,0,0,{m:bk});
 for(const s of[-1,1])glowEye(hd,rig,0xfff0a0,s*.05,.02,.068,.024,true);
 for(let i=0;i<5;i++){const a=(i-2)*.3;P(hd,'cone',0,0,Math.sin(a)*.04,.1+Math.cos(a)*.01-Math.abs(i-2)*.008,-.04,.02,.12-Math.abs(i-2)*.02,-.5,0,-a,{m:i%2?rd:fy})}
 for(const s of[-1,1]){const w=G(b,s*.12,.32,0);for(let i=0;i<5;i++){const L=.16+i*.03,x=s*(.05+i*.055);P(w,'cone',0,x,-.01*i,-.02-i*.03,.035,L,.012,Math.PI/2+.1,0,s*(1.4),{m:i%2?rd:fl});P(w,'cone',0,x*.9,.005,-.02-i*.03,.02,L*.6,.01,Math.PI/2,0,s*1.4,{m:fy})}rig.wings.push(w)}
 const tg=G(b,0,.26,-.15);rig.tail=tg;for(let i=0;i<5;i++){const a=(i-2)*.28;P(tg,'cone',0,Math.sin(a)*.08,-.01*Math.abs(i-2),-.08,.022,.22-Math.abs(i-2)*.025,.012,-Math.PI/2-.2,0,-a,{m:i%2?rd:i===2?fy:fl})}
 for(const s of[-1,1]){const g=G(b,s*.05,.17,.02);P(g,'cyl',0,0,-.04,0,.012,.05,.012,0,0,0,{m:bk});rig.legs.push({g,ph:s>0?0:Math.PI})}
 root.userData.rig=rig;return root},
sharkpup(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],speedy:1};
 const sk=mat(0x5d86b8,{ro:.5}),bl=mat(0xe8f1fa,{ro:.5}),dk=mat(0x2a4a78,{ro:.5}),wh=mat(0xffffff,{ro:.4});
 P(b,'sph',0,0,.27,0,.12,.13,.26,0,0,0,{m:sk});P(b,'sph',0,0,.22,.02,.1,.09,.22,0,0,0,{m:bl});
 const hd=G(b,0,.31,.22);rig.head=hd;P(hd,'sph',0,0,0,0,.115,.1,.12,0,0,0,{m:sk});P(hd,'sph',0,0,-.03,.075,.09,.06,.07,0,0,0,{m:bl});P(hd,'box',0,0,-.045,.1,.085,.01,.012,0,0,0,{m:dk});
 for(const x of[-.06,-.03,0,.03,.06])P(hd,'cone',0,x,-.05,.1,.008,.022,.008,Math.PI,0,0,{m:wh});
 for(const s of[-1,1]){glowEye(hd,rig,0x1a1a2a,s*.065,.03,.075,.022,false);P(hd,'sph',0,s*.065,.036,.085,.008,.008,.006,0,0,0,{m:wh})}
 P(b,'cone',0,0,.42,.05,.04,.17,.1,-.35,0,0,{m:sk});for(const s of[-1,1])P(b,'cone',0,s*.12,.2,.12,.03,.12,.07,0,0,s*1.2,{m:dk});
 const tg=G(b,0,.26,-.26);rig.tail=tg;P(tg,'cone',0,0,.04,-.04,.025,.14,.07,-.9,0,0,{m:sk});P(tg,'cone',0,0,-.04,-.05,.02,.1,.06,.9,0,0,{m:sk});
 legs(b,rig,.07,.14,.18,sk,dk,4,.03,.12);
 root.userData.rig=rig;return root},
mirrormonkey(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],hop:1};
 const fu=mat(0xb8bcc8,{ro:.35,me:.7}),fu2=mat(0x8a90a0,{ro:.3,me:.8}),fc=mat(0xf0d8c0,{ro:.7}),gl=em(0x9fe8ff,.9,{op:.85});
 P(b,'sph',0,0,.3,0,.12,.14,.1,0,0,0,{m:fu});P(b,'sph',0,0,.28,.05,.08,.1,.05,0,0,0,{m:fc});
 const hd=G(b,0,.46,.03);rig.head=hd;P(hd,'sph',0,0,0,0,.115,.105,.105,0,0,0,{m:fu});P(hd,'sph',0,0,-.02,.07,.085,.07,.045,0,0,0,{m:fc});
 for(const s of[-1,1]){P(hd,'sph',0,s*.12,0,0,.05,.05,.025,0,0,0,{m:fu2});P(hd,'sph',0,s*.12,0,.015,.032,.032,.015,0,0,0,{m:fc});glowEye(hd,rig,0xa0f0ff,s*.045,.025,.088,.024,false)}
 P(hd,'sph',0,0,-.045,.11,.02,.012,.012,0,0,0,{m:fu2});
 P(hd,'sph',0,0,.09,.0,.04,.05,.04,0,0,0,{m:gl});
 for(const s of[-1,1]){const a=G(b,s*.14,.34,0);P(a,'cyl',0,0,-.1,0,.025,.11,.025,0,0,0,{m:fu});P(a,'sph',0,0,-.22,0,.035,.035,.035,0,0,0,{m:fc});rig.wings.push(a);
  const g=G(b,s*.07,.2,-.01);P(g,'cyl',0,0,-.07,0,.03,.08,.03,0,0,0,{m:fu});P(g,'sph',0,0,-.16,.03,.035,.03,.05,0,0,0,{m:fc});rig.legs.push({g,ph:s>0?0:Math.PI})}
 const tg=G(b,0,.26,-.08);rig.tail=tg;for(let i=0;i<6;i++)P(tg,'sph',0,0,.03*i-.02,-.06-.05*i,.028,.028,.04,0,0,0,{m:i%2?fu2:fu});
 P(b,'tor',0,0,.3,.0,.19,.19,.19,Math.PI/2,0,0,{m:gl});
 root.userData.rig=rig;return root},
gravityowl(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.18,flap:1,glow:[],wob:0};
 const fe=mat(0x5a3f8a,{ro:.8}),fl=mat(0x9a7fd0,{ro:.8}),wh=mat(0xe8e0f4,{ro:.8}),yl=mat(0xffc83a,{ro:.45}),ring=em(0xb08aff,1.2,{op:.8});
 P(b,'sph',0,0,.28,0,.14,.17,.12,0,0,0,{m:fe});P(b,'sph',0,0,.26,.07,.1,.13,.05,0,0,0,{m:wh});for(let i=0;i<3;i++)P(b,'cone',0,0,.3-i*.05,.1,.02,.03,.012,Math.PI,0,0,{m:fl});
 const hd=G(b,0,.46,.03);rig.head=hd;P(hd,'sph',0,0,0,0,.14,.11,.11,0,0,0,{m:fe});P(hd,'sph',0,0,0,.05,.115,.09,.05,0,0,0,{m:wh});
 for(const s of[-1,1]){P(hd,'sph',0,s*.055,.012,.085,.045,.045,.02,0,0,0,{m:wh});glowEye(hd,rig,0xc0a0ff,s*.055,.012,.1,.032,true);P(hd,'cone',0,s*.08,.1,-.01,.035,.1,.03,0,0,-s*.35,{m:fe})}
 P(hd,'cone',0,0,-.015,.12,.022,.05,.02,Math.PI/2+.5,0,0,{m:yl});
 for(const s of[-1,1]){const w=G(b,s*.14,.34,0);for(let i=0;i<5;i++){const L=.2+i*.02,x=s*(.07+i*.055);P(w,'box',0,x,-.01*i,-.03-i*.02,.05,.01,L,0,s*(.1+i*.04),0,{m:i%2?fe:fl})}rig.wings.push(w)}
 const tg=G(b,0,.22,-.12);rig.tail=tg;for(let i=0;i<3;i++)P(tg,'box',0,(i-1)*.03,0,-.07,.03,.008,.16,0,(i-1)*.15,0,{m:i%2?fe:fl});
 for(const s of[-1,1]){const g=G(b,s*.05,.15,.02);P(g,'cyl',0,0,-.04,0,.013,.05,.013,0,0,0,{m:yl});rig.legs.push({g,ph:s>0?0:Math.PI})}
 const orb=P(b,'tor',0,0,.52,0,.1,.1,.1,Math.PI/2,0,0,{m:ring});rig.orb=orb;
 root.userData.rig=rig;return root},
raccoon(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[]};
 const fu=mat(0x8a8f98,{ro:.9}),dk=mat(0x3a3e48,{ro:.9}),wh=mat(0xf0f0f0,{ro:.9}),rd=mat(0xe03030,{ro:.4,me:.3}),bl=mat(0x3050e0,{ro:.4,me:.3}),gl=em(0xffe45a,1.2);
 P(b,'sph',0,0,.25,0,.13,.12,.2,0,0,0,{m:fu});P(b,'sph',0,0,.21,.04,.1,.09,.17,0,0,0,{m:wh});
 const hd=G(b,0,.34,.2);rig.head=hd;P(hd,'sph',0,0,0,0,.115,.1,.105,0,0,0,{m:fu});P(hd,'sph',0,0,-.03,.09,.06,.05,.06,0,0,0,{m:wh});P(hd,'sph',0,0,-.01,.145,.024,.018,.018,0,0,0,{m:dk});
 for(const s of[-1,1]){P(hd,'sph',0,s*.05,.025,.08,.05,.034,.025,0,0,s*.3,{m:dk});glowEye(hd,rig,0xffe45a,s*.05,.027,.1,.02,false);P(hd,'cone',0,s*.075,.1,-.02,.035,.06,.03,0,0,-s*.2,{m:dk})}
 // horseshoe magnet backpack
 const mg=G(b,0,.32,-.1);P(mg,'tor',0,0,.03,0,.075,.075,.075,0,Math.PI/2,0,{m:rd});P(mg,'box',0,-.07,-.04,0,.032,.05,.032,0,0,0,{m:bl});P(mg,'box',0,.07,-.04,0,.032,.05,.032,0,0,0,{m:bl});P(mg,'sph',0,0,.12,0,.02,.02,.02,0,0,0,{m:gl});
 for(const s of[-1,1]){const a=G(b,s*.12,.27,.1);P(a,'cyl',0,0,-.07,0,.022,.08,.022,0,0,0,{m:fu});P(a,'sph',0,0,-.15,.01,.03,.03,.035,0,0,0,{m:dk});rig.wings.push(a)}
 legs(b,rig,.07,.13,.15,fu,dk,4,.028,.1);
 const tg=G(b,0,.28,-.2);rig.tail=tg;for(let i=0;i<5;i++)P(tg,'sph',0,0,.02+.02*i,-.06-.05*i,.05-.004*i,.05-.004*i,.05,0,0,0,{m:i%2?dk:fu});
 root.userData.rig=rig;return root},
magnetdrone(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.3,wob:1,glow:[],spin:1};
 const m=mat(0xc8ccd6,{ro:.35,me:.7}),d=mat(0x3a3e4c,{ro:.5,me:.5}),rd=mat(0xe03030,{ro:.4,me:.3}),bl=mat(0x3060f0,{ro:.4,me:.3}),gl=em(0x9fe8ff,1.3);
 P(b,'sph',0,0,.3,0,.15,.12,.15,0,0,0,{m:m});P(b,'tor',0,0,.3,0,.17,.17,.17,Math.PI/2,0,0,{m:d});
 P(b,'sph',0,0,.3,.14,.05,.05,.03,0,0,0,{m:gl});rig.ant=P(b,'sph',0,0,.46,0,.03,.03,.03,0,0,0,{m:gl});P(b,'cyl',0,0,.41,0,.008,.05,.008,0,0,0,{m:d});
 const mg=G(b,0,.12,0);P(mg,'tor',0,0,.0,0,.1,.1,.1,0,0,Math.PI,{m:rd});P(mg,'box',0,-.1,.06,0,.035,.045,.035,0,0,0,{m:bl});P(mg,'box',0,.1,.06,0,.035,.045,.035,0,0,0,{m:bl});
 for(const s of[-1,1]){const a=G(b,s*.17,.34,0);P(a,'cyl',0,0,0,0,.09,.008,.03,0,0,s*.1,{m:d});P(a,'cyl',0,s*.02,0,0,.05,.01,.05,0,0,0,{m:gl});rig.wings.push(a)}
 root.userData.rig=rig;return root}};
