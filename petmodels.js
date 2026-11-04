// HeadShotz v94 detailed pets (original designs, built in code). Each builder returns a Group with userData.rig (legs/wings/head/tail/fly/glow) used by animPet.
import {THREE} from './gfx.js';
import {P,G,mat,bone,fan,glowEye} from './petkit.js';
const mem=(c,e,ec)=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.6,side:THREE.DoubleSide,emissive:ec??c,emissiveIntensity:e||0,transparent:true,opacity:.94});return m};
function wing(par,s,x,y,z,mm,bm,k=1){const g=G(par,x*s,y,z);const T=[[0,0,0],[.55,.24,0],[1.02,.34,.16],[.9,.14,.06],[1.06,.02,-.12],[.9,-.1,-.1],[.86,-.2,-.3],[.62,-.16,-.22],[.4,-.24,-.28],[.2,-.14,-.2]];
 const pts=T.map(p=>[p[0]*s*k*.3,p[1]*k*.3,p[2]*k*.3]);const hub=pts[1];const poly=[hub,...pts.slice(2),pts[0]];const m=fan(poly,mm);g.add(m);
 const bs=pts;bone(g,bs[0],bs[1],.012,bm);for(const i of[2,4,6,8])bone(g,bs[1],bs[i],.007,bm);return g}
export const NB={
shadowbat(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.2,flap:1,glow:[],sc:.9};
 const fur=mat(0x4a2f8a,{ro:.9}),furL=mat(0x8a66d8,{ro:.92}),pink=mat(0xd77ab0,{ro:.6}),dark=mat(0x150c26,{ro:.7});
 P(b,'sph',0,0,.3,0,.15,.16,.2,0,0,0,{m:fur});P(b,'sph',0,0,.28,.09,.11,.12,.1,0,0,0,{m:furL});P(b,'sph',0,0,.4,.08,.115,.09,.1,0,0,0,{m:furL});
 const hd=G(b,0,.45,.15);rig.head=hd;P(hd,'sph',0,0,0,0,.125,.115,.12,0,0,0,{m:fur});P(hd,'sph',0,0,-.035,.09,.065,.05,.055,0,0,0,{m:furL});P(hd,'sph',0,0,-.012,.14,.02,.014,.014,0,0,0,{m:pink});
 for(const s of[-1,1]){P(hd,'cone',0,s*.028,-.082,.125,.011,.04,.011,Math.PI,0,0,{m:mat(0xffffff)});glowEye(hd,rig,0xff3a8a,s*.052,.03,.095,.032);
  const e=P(hd,'cone',0,s*.075,.15,-.02,.055,.2,.03,-.1,0,-s*.25,{m:fur});P(hd,'cone',0,s*.075,.145,.0,.032,.15,.015,-.1,0,-s*.25,{m:pink});rig.ears.push(e);
  P(b,'cone',0,s*.05,.12,.06,.014,.05,.014,Math.PI,0,0,{m:dark})}
 const wm=mem(0x3a1f66,.35,0x8a3df0),bm=mat(0x1a0f2e);const wl=wing(b,-1,.12,.36,0,wm,bm,1.6),wr=wing(b,1,.12,.36,0,wm,bm,1.6);rig.wings.push(wl,wr);
 root.userData.rig=rig;return root},
emberdragon(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.18,flap:0,glow:[],dragon:1};
 const sc=mat(0xe0502a,{ro:.55,me:.1}),sd=mat(0x7a2014,{ro:.6}),bel=mat(0xffc46a,{ro:.5}),horn=mat(0xf3e2b8,{ro:.5}),ember=mat(0xffa21a,{em:1.4,ro:.4});
 P(b,'sph',0,0,.3,0,.17,.17,.27,0,0,0,{m:sc});P(b,'sph',0,0,.23,.04,.14,.11,.22,0,0,0,{m:bel});for(let i=0;i<6;i++)P(b,'box',0,0,.15,-.14+i*.055,.2-Math.abs(i-2.5)*.012,.012,.02,0,0,0,{m:mat(0xe3a24a,{ro:.5})});
 P(b,'sph',0,0,.4,.19,.075,.09,.1,.5,0,0,{m:sc});P(b,'sph',0,0,.49,.25,.065,.08,.085,.5,0,0,{m:sc});P(b,'sph',0,0,.55,.3,.06,.07,.07,.4,0,0,{m:sc});
 for(let i=0;i<9;i++){const z=.22-i*.07,y=.46-i*.01+(i>5?-.03*(i-5):0),s=.034-i*.002;P(b,'cone',0,0,y+.04,z,s,s*2.8,s,-.25,0,0,{m:i%2?sd:horn});}
 const hd=G(b,0,.62,.38);rig.head=hd;rig.mouth=hd;P(hd,'sph',0,0,0,0,.11,.095,.125,0,0,0,{m:sc});P(hd,'sph',0,0,-.016,.115,.062,.046,.08,0,0,0,{m:sc});P(hd,'sph',0,0,-.05,.1,.055,.024,.08,.12,0,0,{m:sd});
 for(const s of[-1,1]){glowEye(hd,rig,0xffd23a,s*.052,.034,.075,.03,true);P(hd,'sph',0,s*.022,.0,.185,.012,.012,.012,0,0,0,{m:sd});P(hd,'box',0,s*.052,.065,.08,.04,.012,.03,0,0,s*.3,{m:sd});
  P(hd,'cone',0,s*.05,.1,-.06,.026,.12,.024,-.9,0,-s*.2,{m:horn});P(hd,'cone',0,s*.075,.17,-.14,.018,.1,.016,-1.15,0,-s*.25,{m:horn});P(hd,'sph',0,s*.095,.0,-.04,.05,.012,.04,0,0,s*.7,{m:ember});
  for(const q of[-1,1])P(hd,'cone',0,s*.034,-.036,.15+q*.0,.008,.025,.008,Math.PI,0,0,{m:mat(0xffffff)})}
 const wm=mem(0xc23a1c,.4,0xff6a1a),bm=mat(0xf3e2b8);rig.wings.push(wing(b,-1,.13,.4,-.02,wm,bm,1.5),wing(b,1,.13,.4,-.02,wm,bm,1.5));
 for(const s of[-1,1])for(const z of[1,-1]){const g=G(b,s*.11,.2,z*.15);P(g,'sph',0,0,-.03,0,.05,.062,.065,0,0,0,{m:sc});P(g,'cyl',0,0,-.1,.02,.02,.07,.02,.2,0,0,{m:sd});P(g,'sph',0,0,-.18,.05,.04,.025,.06,0,0,0,{m:sd});for(const k of[-1,0,1])P(g,'cone',0,k*.02,-.19,.1,.008,.03,.008,Math.PI/2,0,0,{m:horn});rig.legs.push({g,ph:(s*z>0)?0:Math.PI})}
 const tg=G(b,0,.27,-.25);rig.tail=tg;let y=0,z=0,r=.075;for(let i=0;i<6;i++){P(tg,'sph',0,0,y,z,r,r,r*1.6,0,0,0,{m:i%2?sd:sc});z-=r*1.7;y+=i<3?.012:-.015;r*=.84}P(tg,'cone',0,0,y,z-.04,.05,.13,.012,-Math.PI/2,0,0,{m:ember});P(tg,'sph',0,0,y,z-.01,.035,.035,.035,0,0,0,{m:ember});
 root.userData.rig=rig;return root}};
