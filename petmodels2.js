// HeadShotz v95 detailed pets, batch 2: Wisp (ghost), Frost Fox, Thunder Hawk. Original designs built in code.
import {THREE} from './gfx.js';
import {P,G,mat,bone,fan,glowEye} from './petkit.js';
const em=(c,e,o={})=>mat(c,{em:e,ro:.4,...o});
export const NB2={
specter(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.3,wob:1,glow:[]};
 const W=mat(0xdff6ff,{op:.82,ro:.25,em:.35,ec:0x7fe8ff}),W2=mat(0xb8ecff,{op:.7,ro:.3,em:.5,ec:0x40d0ff}),dk=mat(0x1a4a6a,{ro:.4});
 P(b,'sph',0,0,.32,0,.17,.2,.16,0,0,0,{m:W});P(b,'cone',0,0,.12,0,.17,.3,.16,Math.PI,0,0,{m:W});
 for(let i=0;i<5;i++){const a=i/5*6.283;const w=G(b,Math.sin(a)*.1,.02,Math.cos(a)*.08);P(w,'cone',0,0,-.0,0,.04,.14+.03*(i%2),.04,Math.PI,0,0,{m:W2});}
 const hd=G(b,0,.44,.02);rig.head=hd;P(hd,'sph',0,0,0,.06,.12,.115,.11,0,0,0,{m:W});
 for(const s of[-1,1]){glowEye(hd,rig,0x40e8ff,s*.052,.015,.145,.034,false);P(hd,'sph',0,s*.05,.045,.15,.035,.012,.012,.3*s,0,0,{m:dk})}
 P(hd,'sph',0,0,-.045,.16,.03,.018,.015,0,0,0,{m:dk});
 for(let i=0;i<5;i++){const a=(i-2)*.32;P(hd,'cone',0,Math.sin(a)*.1,.14+Math.cos(a)*.03,.0,.025,.1+.03*(i===2),.02,0,0,-a,{m:em(0x7fe8ff,1.3)})}
 for(const s of[-1,1]){const a=G(b,s*.17,.34,.03);P(a,'sph',0,s*.04,-.06,.03,.035,.1,.04,0,0,s*.4,{m:W2});P(a,'sph',0,s*.07,-.15,.04,.045,.04,.04,0,0,0,{m:W});rig.wings.push(a)}
 const tl=G(b,0,.1,-.12);rig.tail=tl;for(let i=0;i<4;i++)P(tl,'sph',0,0,-.02*i,-.05-.07*i,.06-.01*i,.06-.01*i,.06-.01*i,0,0,0,{m:W2});
 root.userData.rig=rig;return root},
frostfox(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[]};
 const fur=mat(0xa8d8ff,{ro:.85}),fw=mat(0xf4fbff,{ro:.9}),ice=mat(0x6fd8ff,{op:.82,ro:.15,em:.9,ec:0x3fb8ff}),dk=mat(0x2a5a9a,{ro:.7});
 P(b,'sph',0,0,.3,0,.14,.14,.26,0,0,0,{m:fur});P(b,'sph',0,0,.25,.04,.11,.1,.2,0,0,0,{m:fw});P(b,'sph',0,0,.34,.17,.12,.12,.12,0,0,0,{m:fw});
 const hd=G(b,0,.4,.25);rig.head=hd;P(hd,'sph',0,0,0,0,.115,.105,.11,0,0,0,{m:fur});P(hd,'sph',0,0,-.03,.095,.06,.045,.075,0,0,0,{m:fw});P(hd,'sph',0,0,-.0,.17,.02,.016,.014,0,0,0,{m:dk});
 for(const s of[-1,1]){glowEye(hd,rig,0x3fc8ff,s*.05,.03,.085,.028,true);const e=P(hd,'cone',0,s*.07,.13,-.03,.05,.17,.025,0,0,-s*.25,{m:fur});P(hd,'cone',0,s*.07,.12,-.01,.03,.12,.012,0,0,-s*.25,{m:dk});rig.ears.push(e);P(hd,'cone',0,s*.1,-.01,.04,.012,.05,.01,0,0,s*1.2,{m:fw})}
 P(hd,'cone',0,0,.1,.04,.025,.1,.02,-.15,0,0,{m:ice});
 for(const s of[-1,1])for(const z of[1,-1]){const g=G(b,s*.08,.2,z*.15);P(g,'cyl',0,0,-.09,0,.026,.1,.026,0,0,0,{m:fur});P(g,'sph',0,0,-.19,.02,.035,.026,.05,0,0,0,{m:dk});rig.legs.push({g,ph:(s*z>0)?0:Math.PI})}
 for(let i=0;i<5;i++)P(b,'cone',0,0,.43-Math.abs(i-2)*.012,.12-i*.07,.032-i*.002,.1-Math.abs(i-2)*.012,.03,-.12,0,0,{m:ice});
 const tg=G(b,0,.3,-.26);rig.tail=tg;P(tg,'sph',0,0,.03,-.14,.09,.09,.2,.35,0,0,{m:fur});P(tg,'sph',0,0,.08,-.3,.075,.075,.14,.5,0,0,{m:fw});P(tg,'cone',0,0,.12,-.42,.03,.12,.03,-1.1,0,0,{m:ice});
 root.userData.rig=rig;return root},
thunderhawk(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.32,flap:1,glow:[]};
 const bl=mat(0x2c4a9a,{ro:.7}),lt=mat(0x7fb0ff,{ro:.7}),wh=mat(0xf4f1e6,{ro:.8}),yl=mat(0xffd23a,{ro:.45}),bolt=em(0xfff27a,1.8);
 P(b,'sph',0,0,.3,0,.12,.13,.19,0,0,0,{m:bl});P(b,'sph',0,0,.27,.07,.095,.1,.13,0,0,0,{m:wh});for(let i=0;i<3;i++)P(b,'box',0,0,.34-i*.03,.1+i*.0,.1-i*.02,.005,.02,.0,.4*(i-1),0,{m:lt});
 const hd=G(b,0,.43,.14);rig.head=hd;P(hd,'sph',0,0,0,0,.085,.08,.085,0,0,0,{m:wh});P(hd,'sph',0,0,.025,-.03,.075,.06,.07,0,0,0,{m:bl});
 P(hd,'cone',0,0,-.02,.12,.032,.075,.028,Math.PI/2+.45,0,0,{m:yl});
 for(const s of[-1,1]){glowEye(hd,rig,0xfff27a,s*.044,.022,.06,.02,true);P(hd,'box',0,s*.05,.045,.07,.04,.01,.03,0,0,s*.4,{m:bl})}
 for(let i=0;i<3;i++)P(hd,'cone',0,(i-1)*.03,.07+(i===1?.03:0),-.03,.014,.08,.014,-.3,0,-(i-1)*.3,{m:bolt});
 for(const s of[-1,1]){const w=G(b,s*.1,.33,.02);for(let i=0;i<6;i++){const L=.2+i*.035,x=s*(.06+i*.065);P(w,'box',0,x,-.0-i*.004,-.02-i*.026,.07,.012,L,0,s*(.1+i*.02),0,{m:i%2?bl:lt});P(w,'box',0,x,.004-i*.004,-.0-i*.026,.02,.006,L*.7,0,s*(.1+i*.02),0,{m:i===3?bolt:wh})}rig.wings.push(w)}
 const tg=G(b,0,.28,-.18);rig.tail=tg;for(let i=0;i<5;i++)P(tg,'box',0,(i-2)*.03,-.0,-.1,.03,.008,.2-Math.abs(i-2)*.025,0,(i-2)*.12,0,{m:i===2?bolt:(i%2?bl:lt)});
 for(const s of[-1,1]){const g=G(b,s*.05,.2,.02);P(g,'cyl',0,0,-.04,0,.014,.05,.014,0,0,0,{m:yl});for(const k of[-1,0,1])P(g,'cone',0,k*.016,-.09,.025,.008,.04,.008,Math.PI/2+.4,0,0,{m:yl});rig.legs.push({g,ph:s>0?0:Math.PI})}
 root.userData.rig=rig;return root}};
