// HeadShotz weapon skins: static PBR skins + cheap animated shader skins (Lightning, Fire, Galaxy, Neon Pulse, Toxic).
// One shared material per skin+quality; a single time uniform drives every animated skin.
import {THREE,GQ,camoTex} from './gfx.js';
// key: [name, price, kind, swatch css, premium]
export const WSKINS={
 default:['Factory',0,'none','linear-gradient(135deg,#555,#999)'],
 carbon:['Carbon Fiber',450,'shader','repeating-linear-gradient(45deg,#111 0 4px,#2b2b2b 4px 8px)'],
 tiger:['Tiger Camo',500,'camo','linear-gradient(120deg,#d07a1e 30%,#222 30% 40%,#d07a1e 40% 70%,#222 70% 80%,#d07a1e 80%)'],
 ice:['Glacier Ice',800,'std','linear-gradient(135deg,#e8f8ff,#7fd3ff 60%,#3a8fc0)'],
 toxic:['Toxic',900,'shader','radial-gradient(circle at 30% 30%,#c6ff3a,#3c9a12 60%,#14300a)'],
 neon:['Neon Pulse',1000,'shader','linear-gradient(135deg,#0b0b1a,#ff2bd6 45%,#28f0ff 55%,#0b0b1a)'],
 gold:['Solid Gold',1200,'std','linear-gradient(135deg,#fff1a8,#e8b923 45%,#9a6b0c)'],
 lightning:['Lightning',2000,'shader','linear-gradient(135deg,#0a1030,#3a7bff 50%,#e8f4ff 52%,#0a1030)',1],
 fire:['Inferno',2500,'shader','linear-gradient(0deg,#3a0500,#ff3c00 45%,#ffb000 75%,#fff3a0)',1],
 galaxy:['Galaxy',3000,'shader','radial-gradient(circle at 60% 40%,#ff7ad9,#6a2bd1 35%,#120a3a 70%,#05030f)',1]};
export const WSKIN_IDS=Object.keys(WSKINS);
export const skinU={uT:{value:0}};
export function tickSkins(t){skinU.uT.value=t%600}
const VS=`varying vec3 vP;varying vec3 vN;varying vec3 vV;
void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<OCT;i++){s+=a*n3(p);p=p*2.03+1.7;a*=.5;}return s;}`;
const SHADE=`vec3 N=normalize(vN);float dif=.45+.55*max(0.,dot(N,normalize(vec3(.35,.8,.45))));float rim=pow(1.-max(0.,dot(N,normalize(vV))),2.5);`;
const FS={
carbon:`void main(){${SHADE}vec2 q=vP.xz*120.+vP.y*60.;float w=step(.5,fract(q.x*.5+step(.5,fract(q.y*.5))*.5));vec3 c=mix(vec3(.05),vec3(.16),w)*dif+vec3(.35)*pow(max(0.,dot(N,normalize(vec3(.2,.9,.4)))),24.)+rim*.15;gl_FragColor=vec4(c,1.);}`,
toxic:`void main(){${SHADE}float t=uT;vec3 p=vP*22.;float b=fbm(p+vec3(0.,-t*.6,t*.2));float bub=smoothstep(.62,.7,n3(p*2.2+vec3(0.,-t*1.4,0.)));vec3 c=mix(vec3(.05,.18,.02),vec3(.45,1.,.12),b)*dif;c+=vec3(.7,1.,.3)*bub*.8;c+=vec3(.4,1.,.2)*rim*(.6+.4*sin(t*3.));gl_FragColor=vec4(c,1.);}`,
neon:`void main(){${SHADE}float t=uT;vec3 p=vP*40.;vec3 g=abs(fract(p)-.5);float l=1.-smoothstep(.0,.08,min(min(g.x,g.y),g.z));float pul=.5+.5*sin(t*4.-vP.z*30.);vec3 hue=.5+.5*cos(6.2832*(vec3(0.,.33,.67)+t*.15+vP.z*3.));vec3 c=vec3(.03,.03,.07)*dif+hue*l*(.4+1.2*pul)+hue*rim*.8;gl_FragColor=vec4(c,1.);}`,
lightning:`void main(){${SHADE}float t=uT;vec3 p=vP*16.;float tt=floor(t*10.);float f=fbm(p+vec3(tt*.37,tt*.71,t*.6));float d1=abs(f-.5);float arc=pow(clamp(.0045/max(d1,.0005),0.,1.8),1.4);float f2=fbm(p*1.9+vec3(-t*1.1,tt*.53,0.));float arc2=pow(clamp(.003/max(abs(f2-.5),.0005),0.,1.5),1.4);
 float fl=step(.3,fract(sin(tt*12.9898)*43758.5453));vec3 base=vec3(.015,.03,.10)*dif+vec3(.03,.07,.25)*fbm(p*.4+t*.25);vec3 c=base+vec3(.45,.7,1.)*arc*(.55+fl*.9)+vec3(.85,.92,1.)*arc2*fl+vec3(.2,.4,1.)*rim*(.3+.4*fl);gl_FragColor=vec4(c,1.);}`,
fire:`void main(){${SHADE}float t=uT;vec3 p=vP*14.;vec3 q=p+vec3(0.,-t*2.6,0.);float f=fbm(q+fbm(q*1.3+vec3(0.,-t*1.5,0.))*1.4);float h=clamp(f*1.35-.15+(vP.y*3.),0.,1.);
 vec3 c=mix(vec3(.08,.01,0.),vec3(.9,.12,0.),smoothstep(.2,.5,h));c=mix(c,vec3(1.,.55,0.),smoothstep(.5,.75,h));c=mix(c,vec3(1.,.95,.6),smoothstep(.78,.95,h));c*= .65+.35*dif;c+=vec3(1.,.4,.05)*rim*.6;gl_FragColor=vec4(c,1.);}`,
galaxy:`void main(){${SHADE}float t=uT;vec3 p=vP*8.;float n=clamp((fbm(p*1.6+vec3(t*.06,0.,t*.04))-.5)*2.6+.5,0.,1.);float n2=clamp((fbm(p*2.6-vec3(0.,t*.05,0.)+n*1.5)-.5)*2.6+.5,0.,1.);vec3 c=vec3(.05,.02,.14);c=mix(c,vec3(.5,.1,.85),smoothstep(.42,.62,n));c=mix(c,vec3(1.,.35,.75),smoothstep(.55,.7,n2)*.85);c=mix(c,vec3(.02,.01,.06),smoothstep(.45,.3,n2)*.7);c=mix(c,vec3(.25,.6,1.),smoothstep(.5,.8,n*n2*2.)*.6);c*=.7+.4*dif;
 vec3 sp=vP*28.;vec3 cell=floor(sp);float r=h3(cell);vec3 fp=fract(sp)-.5;float st=step(.84,r)*(1.-smoothstep(.0,.36,length(fp)));float tw=.4+.6*sin(t*(2.+r*5.)+r*40.);c+=vec3(1.,.97,.9)*st*max(tw,0.)*1.6*STARS;vec3 sp2=vP*70.;float r2=h3(floor(sp2)+7.);float st2=step(.82,r2)*(1.-smoothstep(0.,.25,length(fract(sp2)-.5)));c+=vec3(.85,.9,1.)*st2*(.5+.5*sin(t*3.+r2*30.))*STARS;c=mix(c,c*vec3(.7,.8,1.3),smoothstep(.5,.2,n));c+=vec3(.6,.4,1.)*rim*.6;gl_FragColor=vec4(c,1.);}`};
const cache={};
export function skinMat(key){const lo=GQ.level==='low';const ck=key+(lo?'_lo':'');if(cache[ck])return cache[ck];const S=WSKINS[key];if(!S||S[2]==='none')return null;let m;
 if(key==='gold')m=new THREE.MeshStandardMaterial({color:0xffc93c,metalness:.6,roughness:.26,emissive:0x5a3a00,emissiveIntensity:.7});
 else if(key==='ice')m=new THREE.MeshStandardMaterial({color:0xdaf5ff,metalness:.25,roughness:.1,emissive:0x2f7aa6,emissiveIntensity:.75});
 else if(key==='tiger')m=new THREE.MeshStandardMaterial({map:camoTex(0xd07a1e),metalness:.15,roughness:.6});
 else{const fs=`uniform float uT;varying vec3 vP;varying vec3 vN;varying vec3 vV;#define OCT ${lo?1:(key==='fire'?3:2)}\n#define STARS ${lo?'0.6':'1.0'}\n`.replace('#define','\n#define')+NOISE+FS[key].replace(/gl_FragColor=vec4\(c,1\.\);\}$/,'gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}');
  m=new THREE.ShaderMaterial({uniforms:skinU,vertexShader:VS,fragmentShader:fs});m.userData.anim=1}
 m.userData.skin=key;return cache[ck]=m}
export function clearSkinCache(){for(const k in cache)delete cache[k]}
// apply a skin to a gun group (hands / fx / glass / sights left alone)
export function applySkin(g,key){const m=skinMat(key);if(!m)return false;g.traverse(o=>{if(!o.isMesh||o.userData.hand||o.userData.fx)return;if(o.material&&(o.material.transparent||o.material.blending===THREE.AdditiveBlending))return;o.material=m;o.userData.tm=null});return true}
