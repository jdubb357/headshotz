// HeadShotz v103 pets, built in code (no third-party models): Celestial Chimera, Spin Capybara,
// Storm Wolf, Rocket Ostrich, Raptor, plus fur/scale/feather detail on the original 15 sidekicks.
import {THREE,GQ} from './gfx.js';
import {P,G,mat,glowEye,GE} from './petkit.js';
const em=(c,e)=>mat(c,{em:e,ro:.35,me:.25});
function legs4(b,rig,x,z,y,m,dk,h=.12){for(const s of[-1,1])for(const q of[1,-1]){const g=G(b,s*x,y,q*z);P(g,'cyl',0,0,-h/2,0,.028,h/2,.028,0,0,0,{m});P(g,'sph',0,0,-h,.02,.04,.03,.055,0,0,0,{m:dk});rig.legs.push({g,ph:s*q>0?0:Math.PI})}}
function hueRGB(h,s,l){const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h*12)%12;return l-a*Math.max(Math.min(k-3,9-k,1),-1)};return[f(0),f(8),f(4)]}
function rainbowSkin(){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.32,metalness:.06,emissive:0xffffff,emissiveIntensity:.45});const hue={value:0};m.userData.hue=hue;m.onBeforeCompile=sh=>{sh.uniforms.uHue=hue;sh.fragmentShader='uniform float uHue;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n{vec3 c=diffuseColor.rgb;float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn+1e-4;float H=mx==c.r?mod((c.g-c.b)/d,6.):mx==c.g?(c.b-c.r)/d+2.:(c.r-c.g)/d+4.;H=fract(H/6.+uHue);vec3 k=abs(mod(H*6.+vec3(0.,4.,2.),6.)-3.);diffuseColor.rgb=mix(vec3(mn),vec3(mx),clamp(k-1.,0.,1.));}`).replace('#include <lights_fragment_begin>','#include <lights_fragment_begin>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.72;');};return m}
function loftCham(keys,S,A){const st=[];for(let i=0;i<S;i++){const t=i/(S-1)*(keys.length-1),i0=t|0,i1=Math.min(keys.length-1,i0+1),f=t-i0,a=keys[i0],b=keys[i1];const m=k=>a[k]*(1-f)+b[k]*f;st.push({z:m('z'),cy:m('cy'),rx:m('rx'),ry:m('ry'),crest:m('crest'),casque:m('casque')})}
 const pos=new Float32Array(S*A*3),col=new Float32Array(S*A*3),idx=[];const z0=st[0].z,z1=st[S-1].z;
 for(let i=0;i<S;i++){const s=st[i];for(let j=0;j<A;j++){const ang=j/A*Math.PI*2,ct=Math.cos(ang),sn=Math.sin(ang),up=Math.max(0,ct);let rx=s.rx,ry=s.ry;if(up>.45)ry+=s.crest*Math.min(1,(up-.45)/.4)*Math.abs(Math.sin(j*3.1));if(s.casque&&up>.6){const k=(up-.6)/.4;ry+=s.casque*k;rx*=1-k*.35}if(ct<0)ry*=.92;const k=(i*A+j)*3;pos[k]=sn*rx;pos[k+1]=s.cy+ct*ry;pos[k+2]=s.z;const along=(s.z-z0)/((z1-z0)||1);const rgb=hueRGB((1-along)*.82,.88,.52);col[k]=rgb[0];col[k+1]=rgb[1];col[k+2]=rgb[2]}}
 for(let i=0;i<S-1;i++)for(let j=0;j<A;j++){const a=i*A+j,b=i*A+(j+1)%A,c=(i+1)*A+j,d=(i+1)*A+(j+1)%A;idx.push(a,c,b,b,c,d)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g}
function hueTube(pts,segs,radial,radius,hue0,hue1){const curve=new THREE.CatmullRomCurve3(pts);const geo=new THREE.TubeGeometry(curve,segs,radius,radial,false);const pos=geo.attributes.position,R=radial+1,col=new Float32Array(pos.count*3);
 for(let i=0;i<=segs;i++){const t=Math.min(.999,Math.max(.001,i/segs)),c=curve.getPointAt(t),tap=1-t*.78;for(let j=0;j<=radial;j++){const k=i*R+j;const x=pos.getX(k)-c.x,y=pos.getY(k)-c.y,z=pos.getZ(k)-c.z,len=Math.hypot(x,y,z)||1;pos.setXYZ(k,c.x+x/len*len*tap,c.y+y/len*len*tap,c.z+z/len*len*tap);const rgb=hueRGB(hue0+(hue1-hue0)*t,.88,.52);col[k*3]=rgb[0];col[k*3+1]=rgb[1];col[k*3+2]=rgb[2]}}
 geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();return geo}
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
 root.userData.rig=rig;return root},
novamoth(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.35,flap:1,glow:[],sc:1.05};
 const bd=mat(0x6a2a88,{ro:.45}),wk=em(0xd456ff,1.1),gd=em(0xffd23f,.8);
 P(b,'sph',0,0,.28,0,.1,.08,.16,0,0,0,{m:bd});P(b,'sph',0,0,.24,.04,.06,.05,.08,0,0,0,{m:mat(0xfff1c8,{ro:.5})});
 const hd=G(b,0,.38,.12);rig.head=hd;P(hd,'sph',0,0,0,0,.07,.06,.08,0,0,0,{m:bd});
 for(const s of[-1,1]){glowEye(hd,rig,0xfff3a0,s*.03,.01,.05,.016,false);P(hd,'cyl',0,s*.02,.08,-.02,.004,.06,.004,0,0,s*.4,{m:gd})}
 for(const s of[-1,1]){const w=G(b,s*.08,.3,0);P(w,'cone',0,s*.12,0,-.02,.1,.18,.012,Math.PI/2,0,s*1.2,{m:wk});P(w,'cone',0,s*.08,.02,0,.05,.1,.008,Math.PI/2,0,s*1.1,{m:em(0x7cf0ff,.7)});rig.wings.push(w)}
 root.userData.rig=rig;return root},
seahorse(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.2,glow:[],sc:1.1};
 const co=mat(0xff6b6b,{ro:.4}),tl=mat(0x2ee0c5,{ro:.35}),rb=em(0xffd1dc,.6);
 for(let i=0;i<5;i++)P(b,'sph',0,0,.22+i*.045,-.02+i*.02,.07-i*.006,.08,.06,0,0,0,{m:i%2?co:tl});
 const hd=G(b,0,.46,.08);rig.head=hd;P(hd,'sph',0,0,0,.04,.06,.05,.07,0,0,0,{m:tl});P(hd,'cone',0,0,-.01,.08,.02,.05,.02,Math.PI/2,0,0,{m:co});
 glowEye(hd,rig,0xfff6a0,.025,.02,.04,.014,false);glowEye(hd,rig,0xfff6a0,-.025,.02,.04,.014,false);
 for(const s of[-1,1]){const w=G(b,s*.06,.32,0);P(w,'cone',0,s*.08,0,0,.04,.1,.02,0,0,s*.6,{m:rb});rig.wings.push(w)}
 const tg=G(b,0,.18,-.08);rig.tail=tg;P(tg,'cyl',0,.02,-.02,-.08,.012,.16,.012,-1.2,0,.4,{m:tl});P(tg,'sph',0,.04,-.08,-.16,.03,0,0,0,{m:co});
 root.userData.rig=rig;return root},
scorpion(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:0,glow:[],sc:1.05};
 const am=mat(0xffb703,{ro:.35,me:.2}),gl=em(0xc77dff,.8),dk=mat(0x5a3a10,{ro:.5});
 P(b,'sph',0,0,.22,0,.1,.07,.14,0,0,0,{m:am});P(b,'sph',0,0,.2,.08,.07,.05,.08,0,0,0,{m:gl});
 for(const s of[-1,1]){P(b,'cone',0,s*.1,.18,.1,.03,.04,.05,0,0,s*.8,{m:dk});glowEye(b,rig,0xfff3a0,s*.04,.24,.1,.012,true)}
 for(const s of[-1,1])for(const q of[1,-1]){const g=G(b,s*.08,.16,q*.06);P(g,'cyl',0,s*.04,-.04,0,.012,.06,.012,0,0,s*.5,{m:dk});rig.legs.push({g,ph:s*q>0?0:Math.PI})}
 const tg=G(b,0,.28,-.12);rig.tail=tg;P(tg,'cyl',0,0,.06,-.04,.012,.12,.012,-.8,0,0,{m:am});P(tg,'sph',0,0,.14,-.08,.028,0,0,0,{m:gl});P(tg,'cone',0,0,.16,-.1,.012,.04,.012,0,0,0,{m:em(0xff4d6a,1)});
 root.userData.rig=rig;return root},
peacock(){const root=new THREE.Group(),b=G(root);const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.05,glow:[],sc:1.08};
 const bd=mat(0x1d4e89,{ro:.45}),nk=mat(0x3d7dff,{ro:.4});
 const cols=[em(0x3d7dff,.7),em(0x2ee0c5,.7),em(0xffd23f,.8),em(0xff4d8d,.7)];
 P(b,'sph',0,0,.32,0,.1,.12,.14,0,0,0,{m:bd});
 const hd=G(b,0,.5,.12);rig.head=hd;P(hd,'sph',0,0,0,0,.06,.05,.07,0,0,0,{m:nk});P(hd,'cone',0,0,-.01,.06,.015,.04,.015,Math.PI/2,0,0,{m:em(0xffd23f,.6)});
 for(const s of[-1,1])glowEye(hd,rig,0xfff6a0,s*.025,.01,.04,.012,false);
 for(let i=0;i<7;i++){const a=(i-3)*.22;P(b,'cone',0,Math.sin(a)*.04,.34,-.08-Math.abs(i-3)*.01,.04,.16,.012,-.4,a,0,{m:cols[i%cols.length]})}
 for(const s of[-1,1]){const g=G(b,s*.04,.2,0);P(g,'cyl',0,0,-.08,0,.012,.08,.012,0,0,0,{m:bd});rig.legs.push({g,ph:s>0?0:Math.PI})}
 root.userData.rig=rig;return root},
fizzy(){const root=new THREE.Group(),b=G(root);const lite=GQ.level==='low';
 const skin=rainbowSkin();
 const rig={legs:[],tail:null,ears:[],wings:[],head:null,fly:.02,glow:[],eyes:[],tongue:null,casque:1,curl:1,turret:1,rainbow:1,coil:1,hue:skin.userData.hue,sc:.78};
 rig.glow.push(skin);
 const keys=[{z:-.02,cy:.16,rx:.026,ry:.038,crest:.007,casque:0},{z:.05,cy:.17,rx:.038,ry:.058,crest:.011,casque:0},{z:.12,cy:.182,rx:.04,ry:.066,crest:.012,casque:0},{z:.18,cy:.192,rx:.034,ry:.05,crest:.007,casque:0},{z:.23,cy:.205,rx:.03,ry:.04,crest:.004,casque:.026},{z:.3,cy:.192,rx:.016,ry:.022,crest:0,casque:.004},{z:.37,cy:.186,rx:.005,ry:.009,crest:0,casque:0}];
 b.add(new THREE.Mesh(loftCham(keys,lite?14:26,lite?8:14),skin));
 const hd=G(b,0,.205,.24);rig.head=hd;
 for(const s of[-1,1]){const e=G(hd,s*.02,.01,0);e.userData.ph=s;e.userData.turret=1;P(e,'cone',0,s*.02,0,0,.02,.04,.02,0,0,s>0?-Math.PI/2:Math.PI/2,{m:skin});const ball=G(e,s*.04,0,0);e.userData.lid=ball;P(ball,'sph',0,0,0,0,.016,.016,.012,0,0,0,{m:mat(0xf4f7ef,{ro:.2,em:.2,ec:0xffffff})});const iris=new THREE.MeshStandardMaterial({color:s<0?0x3dff6a:0xffc24a,emissive:s<0?0x3dff6a:0xffc24a,emissiveIntensity:1.1,roughness:.2});P(ball,'sph',0,0,0,s*.008,.008,.009,.006,0,0,0,{m:iris});const pupil=P(ball,'sph',0,0,0,s*.014,.0035,.004,.003,0,0,0,{m:mat(0x111418,{ro:.15})});e.userData.pupil=pupil;rig.eyes.push(e);rig.glow.push(iris)}
 const mouth=G(hd,0,-.02,.1);P(mouth,'box',0,0,0,0,.034,.006,.07,0,0,0,{m:mat(0x2a1218,{ro:.45})});
 const tongue=G(mouth,0,-.004,.02);rig.tongue=tongue;P(tongue,'cyl',0,0,0,.08,.004,.16,.003,-Math.PI/2,0,0,{m:mat(0xff4d6a,{ro:.3,em:.4,ec:0xff4d6a})});P(tongue,'sph',0,0,0,.16,.008,.005,.006,0,0,0,{m:mat(0xff9aab,{ro:.25,em:.3,ec:0xff9aab})});
 const curl=G(b,0,.16,-.04);rig.tail=curl;const n=lite?16:28,turns=lite?1.35:1.7,pts=[];
 for(let i=0;i<=n;i++){const t=i/n,ang=t*Math.PI*2*turns,R=.055*(1-t*.4);pts.push(new THREE.Vector3(Math.sin(ang)*R*.18,-.02*t-(1-Math.cos(ang))*R,-.02*t-Math.sin(ang)*R))}
 curl.add(new THREE.Mesh(hueTube(pts,lite?14:26,lite?5:8,.013,.78,.05),skin));
 const up=new THREE.Vector3(0,1,0);
 for(const sx of[-1,1])for(const sz of[1,-1]){const z0=sz>0?.12:.03;const g=G(b,sx*.015,.15,z0);const wrist=new THREE.Vector3(sx*.045,-.075,sz*.012);const limb=[new THREE.Vector3(0,0,0),new THREE.Vector3(sx*.055,-.02,sz*.01),wrist];g.add(new THREE.Mesh(hueTube(limb,lite?3:5,5,.014,.15,.45),skin));
  for(let k=0;k<2;k++){const yaw=(k?1:-1)*.55+(sz>0?.2:-.2);const dir=new THREE.Vector3(Math.sin(yaw)*sx,-.35,Math.cos(yaw)*sz).normalize();const len=.028;const toe=new THREE.Mesh(GE.cone,skin);toe.scale.set(.008,len,.006);toe.position.copy(wrist).addScaledVector(dir,len*.5);toe.quaternion.setFromUnitVectors(up,dir);g.add(toe)}
  rig.legs.push({g,ph:sx*sz>0?0:Math.PI})}
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
