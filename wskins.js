// HeadShotz weapon skins: static PBR skins + cheap animated shader skins (Lightning, Fire, Galaxy, Neon Pulse, Toxic).
// One shared material per skin+quality; a single time uniform drives every animated skin.
import {THREE,GQ,camoTex} from './gfx.js';
// key: [name, price, kind, swatch css, premium]
export const WSKINS={
 default:['Factory',0,'none','linear-gradient(135deg,#555,#999)'],
 carbon:['Carbon Fiber',125,'shader','repeating-linear-gradient(45deg,#111 0 4px,#2b2b2b 4px 8px)'],
 tiger:['Tiger Camo',150,'camo','linear-gradient(120deg,#d07a1e 30%,#222 30% 40%,#d07a1e 40% 70%,#222 70% 80%,#d07a1e 80%)'],
 ice:['Glacier Ice',200,'std','linear-gradient(135deg,#e8f8ff,#7fd3ff 60%,#3a8fc0)'],
 toxic:['Toxic',225,'shader','radial-gradient(circle at 30% 30%,#c6ff3a,#3c9a12 60%,#14300a)'],
 neon:['Neon Pulse',250,'shader','linear-gradient(135deg,#0b0b1a,#ff2bd6 45%,#28f0ff 55%,#0b0b1a)'],
 gold:['Solid Gold',300,'std','linear-gradient(135deg,#fff1a8,#e8b923 45%,#9a6b0c)'],
 lightning:['Lightning',450,'shader','linear-gradient(135deg,#0a1030,#3a7bff 50%,#e8f4ff 52%,#0a1030)',1],
 fire:['Inferno',550,'shader','linear-gradient(0deg,#3a0500,#ff3c00 45%,#ffb000 75%,#fff3a0)',1],
 galaxy:['Galaxy',650,'shader','radial-gradient(circle at 60% 40%,#ff7ad9,#6a2bd1 35%,#120a3a 70%,#05030f)',1],
 galaxy_blue:['Galaxy Azure',700,'shader','radial-gradient(circle at 60% 40%,#7ae8ff,#2a6bff 35%,#0a1a4a 70%,#02061a)',1],
 galaxy_red:['Galaxy Crimson',700,'shader','radial-gradient(circle at 60% 40%,#ffb06a,#e0243a 35%,#3a0814 70%,#14030a)',1],
 galaxy_gold:['Galaxy Gold',900,'shader','radial-gradient(circle at 60% 40%,#fff3b0,#e8a21a 35%,#4a2c05 70%,#1a0f02)',1]};
export const WSKIN_IDS=Object.keys(WSKINS);export const WSKIN_FEAT=WSKIN_IDS.filter(k=>WSKINS[k][4]);
export const skinU={uT:{value:0}};
export function tickSkins(t){skinU.uT.value=t%600}
const VS=`varying vec3 vP;varying vec3 vN;varying vec3 vV;
void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const NOISE=`float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<OCT;i++){s+=a*n3(p);p=p*2.03+1.7;a*=.5;}return s;}`;
const SHADE=`vec3 N=normalize(vN);float dif=.45+.55*max(0.,dot(N,normalize(vec3(.35,.8,.45))));float rim=pow(1.-max(0.,dot(N,normalize(vV))),2.5);`;
const FS={
carbon:`void main(){${SHADE}vec2 q=vP.xz*120.+vP.y*60.;vec2 cq=floor(q);vec2 fq=fract(q);float w=step(.5,fract(q.x*.5+step(.5,fract(q.y*.5))*.5));float sh=w>.5?fq.y:fq.x;float tow=.55+.45*sin(sh*3.1416);
 vec3 c=mix(vec3(.035),vec3(.17,.17,.18),w)*tow*dif;vec3 H=normalize(normalize(vec3(.2,.9,.4))+normalize(vV));float sp=pow(max(0.,dot(N,H)),60.);c+=vec3(.55)*sp+vec3(.18)*pow(max(0.,dot(N,H)),8.)*tow;
#ifdef HQ
 c+=vec3(.25,.27,.3)*pow(rim,1.5)*.5;
#endif
 c+=rim*.12;gl_FragColor=vec4(c,1.);}`,
toxic:`void main(){${SHADE}float t=uT;vec3 p=vP*22.;float b=fbm(p+vec3(0.,-t*.6,t*.2));float bub=smoothstep(.62,.7,n3(p*2.2+vec3(0.,-t*1.4,0.)));vec3 c=mix(vec3(.05,.18,.02),vec3(.45,1.,.12),b)*dif;c+=vec3(.7,1.,.3)*bub*.8;c+=vec3(.4,1.,.2)*rim*(.6+.4*sin(t*3.));gl_FragColor=vec4(c,1.);}`,
neon:`void main(){${SHADE}float t=uT;vec3 p=vP*40.;vec3 g=abs(fract(p)-.5);float m=min(min(g.x,g.y),g.z);float l=1.-smoothstep(.0,.07,m);float glow=1.-smoothstep(.0,.22,m);float pul=.5+.5*sin(t*4.-vP.z*30.);vec3 hue=.5+.5*cos(6.2832*(vec3(0.,.33,.67)+t*.15+vP.z*3.));
 float scan=.85+.15*sin(vP.y*900.+t*20.);vec3 c=vec3(.02,.02,.05)*dif+hue*(l*(.5+1.3*pul)+glow*.35*pul)*scan+hue*rim*.9;gl_FragColor=vec4(c,1.);}`,
lightning:`void main(){${SHADE}float t=uT;vec3 p=vP*16.;float tt=floor(t*10.);float fl=step(.3,fract(sin(tt*12.9898)*43758.5453));float fl2=.6+.4*sin(t*37.)*sin(t*23.);
 float f=fbm(p+vec3(tt*.37,tt*.71,t*.6));float d1=abs(f-.5);float arc=pow(clamp(.0045/max(d1,.0005),0.,1.8),1.4);float halo=exp(-d1*28.)*.35;
 float f2=fbm(p*1.9+vec3(-t*1.1,tt*.53,0.));float d2=abs(f2-.5);float arc2=pow(clamp(.003/max(d2,.0005),0.,1.5),1.4);
 float br=0.;
#ifdef HQ
 float f3=fbm(p*4.3+vec3(tt*.9,-t*.8,tt*.2));br=pow(clamp(.0022/max(abs(f3-.5),.0004),0.,1.3),1.3)*smoothstep(.09,.0,d1);
#endif
 vec3 base=vec3(.015,.03,.10)*dif+vec3(.03,.07,.25)*fbm(p*.4+t*.25);vec3 c=base+vec3(.45,.7,1.)*arc*(.55+fl*.9)*fl2+vec3(.3,.5,1.)*halo*(.5+fl)+vec3(.85,.92,1.)*arc2*fl+vec3(.7,.85,1.)*br*(.4+fl*.8)+vec3(.2,.4,1.)*rim*(.3+.4*fl);gl_FragColor=vec4(c,1.);}`,
fire:`void main(){${SHADE}float t=uT;vec3 p=vP*14.;vec3 q=p+vec3(0.,-t*2.6,0.);float f=fbm(q+fbm(q*1.3+vec3(0.,-t*1.5,0.))*1.4);float h=clamp(f*1.35-.15+(vP.y*3.),0.,1.);
#ifdef HQ
 float f2=fbm(p*2.2+vec3(t*.3,-t*4.,0.));h=clamp(max(h,f2*1.25-.25+vP.y*2.)*.7+h*.4,0.,1.);
#endif
 vec3 c=mix(vec3(.08,.01,0.),vec3(.9,.12,0.),smoothstep(.2,.5,h));c=mix(c,vec3(1.,.55,0.),smoothstep(.5,.75,h));c=mix(c,vec3(1.,.95,.6),smoothstep(.78,.95,h));c*= .65+.35*dif;
 float glow=.5+.5*sin(t*2.3+vP.z*9.);c+=vec3(.35,.06,0.)*glow*(1.-h);
 vec3 ep=vP*45.+vec3(0.,-t*2.2,0.);vec3 ec=floor(ep);float er=h3(ec);float em=step(.93,er)*(1.-smoothstep(0.,.3,length(fract(ep)-.5)))*(.5+.5*sin(t*9.+er*50.));c+=vec3(1.,.75,.3)*em*1.6;
 c+=vec3(1.,.4,.05)*rim*.7;gl_FragColor=vec4(c,1.);}`};

// ---------- v55 animated GALAXY: ONE shader function shared by weapons, Royale heroes and realistic soldiers ----------
// nebula swirls (domain-warped fbm scrolling over time) + two layers of twinkling parallax stars (view-dependent) + rim glow (+ rare shooting star on HQ).
// Stars fade with their pixel footprint (fwidth) so nothing shimmers/flickers at range. Palette is 4 uniforms, so every colourway shares one program.
export const GX_PAL={purple:[[.04,.02,.15],[.3,.12,.82],[1,.35,.75],[.25,.6,1]],blue:[[.01,.04,.15],[.1,.35,.95],[.2,.85,1],[.6,.4,1]],red:[[.13,.01,.03],[.85,.08,.15],[1,.5,.2],[1,.2,.6]],gold:[[.1,.06,.01],[.85,.55,.08],[1,.85,.35],[1,.4,.15]]};
export const GX_GLSL=`uniform float uT;uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec3 uC3;
float gh(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float gn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float gf(vec3 p){float a=.5,s=0.;for(int i=0;i<GXOCT;i++){s+=a*gn(p);p=p*2.03+1.7;a*=.5;}return s*(GXOCT==1?1.5:1.);}
vec3 gxCol(vec3 vp,vec3 V,float dif,float rim){float t=uT;vec3 vp0=vp;vp*=GXS;vec3 p=vp*8.;
#ifdef GXFANCY
 {float sa=.6*sin(vp.y*5.+t*.35)+t*.06+length(vp.xz)*3.;float cs=cos(sa),sn=sin(sa);p.xz=mat2(cs,-sn,sn,cs)*p.xz;}// v98 nebula swirl: the clouds spiral around the body and drift
#endif
 float n=clamp((gf(p*1.6+vec3(t*.06,0.,t*.04))-.5)*GXK+.5,0.,1.);
#ifdef GXLO
 float n2=n*n*.9;
#else
 float n2=clamp((gf(p*2.6-vec3(0.,t*.05,0.)+n*1.5)-.5)*2.6+.5,0.,1.);
#endif
 vec3 c=uC0;c=mix(c,uC1,smoothstep(.42,.62,n));c=mix(c,uC2,smoothstep(.55,.7,n2)*.4);c=mix(c,uC0*.35,smoothstep(.45,.3,n2)*.7);c=mix(c,uC3,smoothstep(.5,.8,n*n2*2.)*.45);
#ifdef GXFANCY
 {float dust=smoothstep(.2,.6,gf(p*.65+vec3(5.,t*.02,1.)));c*=.5+.5*dust;// dark dust lanes
  float rid=1.-abs(gf(p*.55+vec3(0.,t*.07,0.)+n*.9)*2.-1.);float seam=smoothstep(.972,.998,rid);float pulse=.6+.4*sin(t*2.3+vp.y*9.+rid*6.);
  c+=mix(uC3,uC2,.5)*(seam*pulse*2.4+smoothstep(.93,.99,rid)*.12);// glowing energy veins
  }
#endif
#ifdef GXHQ
 float n3v=clamp((gf(p*4.+V*1.2+vec3(0.,0.,t*.08))-.5)*3.+.5,0.,1.);c=mix(c,mix(uC3,uC2,.5)*1.1,smoothstep(.6,.85,n3v)*.35);c+=uC2*pow(n*n2,3.)*.35;
#endif
 c*=.5+.35*dif;
 // screen-space cosmos: stars are pinned to the VIEW (angle from the camera), so they stay put while the model moves/turns and the suit reads as a window onto deep space
 vec2 sc=V.xy/max(V.z,.05);float dn=GXSM>1.2?1.35:1.;
 vec2 s1=sc*92.*dn;float fw1=fwidth(s1.x)+fwidth(s1.y);float aa=1.-smoothstep(.45,1.1,fw1);
 vec2 i1=floor(s1);vec2 f1=fract(s1)-.5;float r1=gh(vec3(i1,3.));vec2 j1=(vec2(gh(vec3(i1,9.)),gh(vec3(i1,5.)))-.5)*.5;float d1=length(f1-j1);
 float tw1=.3+.7*(.5+.5*sin(t*(1.6+r1*5.)+r1*50.));float st1=step(.74,r1)*(1.-smoothstep(.02,.2+.1*step(.94,r1),d1));
 vec3 scol=mix(vec3(1.,.97,.9),mix(uC3,vec3(1.),.45),step(.55,fract(r1*7.3)));c+=scol*st1*tw1*1.9*GXSTARS*aa;
#ifdef GXHQ
 vec2 s2=sc*150.*dn;float fw2=fwidth(s2.x)+fwidth(s2.y);float aa2=1.-smoothstep(.5,1.2,fw2);vec2 i2=floor(s2);vec2 f2=fract(s2)-.5;float r2=gh(vec3(i2,17.));float st2=step(.8,r2)*(1.-smoothstep(0.,.26,length(f2)));c+=vec3(.8,.88,1.)*st2*(.35+.65*(.5+.5*sin(t*3.+r2*30.)))*aa2*.9;
#endif
 vec2 s3=sc*26.*dn;float fw3=fwidth(s3.x)+fwidth(s3.y);float aa3=1.-smoothstep(.2,.6,fw3);vec2 i3=floor(s3);float r3=gh(vec3(i3,41.));vec2 d3=fract(s3)-.5-(vec2(gh(vec3(i3,43.)),gh(vec3(i3,47.)))-.5)*.5;
 float pl=pow(.5+.5*sin(t*(1.1+r3*2.)+r3*60.),5.);float core3=exp(-length(d3)*26.);float fl3=exp(-abs(d3.x)*34.)*exp(-abs(d3.y)*6.)+exp(-abs(d3.y)*34.)*exp(-abs(d3.x)*6.);
 c+=vec3(1.,.96,.9)*(core3*1.1+fl3*.8)*pl*step(.955,r3)*3.*GXSTARS*aa3;
 c+=vec3(1.,.97,.9)*.04*(1.-aa)*GXSTARS;
#ifdef GXFANCY
 // v98 parallax depth: three object-space star layers at different depths, each shifted by the view vector so they slide against each other as the camera/model moves
 for(int L=0;L<3;L++){float dp=float(L)+1.;vec3 q=vp0*(34.+dp*26.)+V*(.7*dp)+vec3(dp*7.3,dp*1.7,dp*3.1);vec3 ic=floor(q);float r=gh(ic+dp*13.);float fwq=fwidth(q.x)+fwidth(q.y);float aq=1.-smoothstep(.4,1.1,fwq);
  vec3 fq=fract(q)-.5-(vec3(gh(ic+3.),gh(ic+5.),gh(ic+9.))-.5)*.5;float d=length(fq);float tw=.35+.65*(.5+.5*sin(t*(1.2+r*5.)+r*60.));float st=step(.86-.02*dp,r)*(1.-smoothstep(.0,.15+.04*dp,d));
  c+=mix(vec3(1.,.95,.85),mix(uC3,vec3(1.),.5),step(.5,fract(r*9.1)))*st*tw*aq*(1.5-.25*dp);}
#endif
#ifdef GXHQ
 float ph=floor(t/1.8);float pt=fract(t/1.8);vec3 dir=normalize(vec3(gh(vec3(ph,1.,2.))-.5,gh(vec3(ph,3.,1.))-.5,gh(vec3(2.,ph,5.))-.5));vec3 up=normalize(cross(dir,vec3(.3,1.,.2)));
 float u=dot(vp,dir)*10.,v=dot(vp,up)*10.-(gh(vec3(ph,9.,9.))-.5)*2.;float head=(pt*3.-1.5);float tail=clamp((head-u)/.6,0.,1.);float ss=step(0.,head-u)*(1.-tail)*exp(-abs(v)*90.)*smoothstep(1.,.6,pt);c+=vec3(1.,.95,.85)*ss*2.5*aa;
#endif
 c=mix(c,c*vec3(.7,.8,1.3),smoothstep(.5,.2,n)*.6);vec3 rc=mix(uC3,uC2,smoothstep(-.35,.35,sc.x+sc.y*.4));c+=rc*(rim*.55+rim*rim*.9);return c;}`;
export const gxDefs=(scale,lo,sm=1,fancy=false)=>`${fancy&&!lo?'#define GXFANCY\n':''}#define GXSM ${sm.toFixed(2)}\n#define GXK ${lo?'1.5':'2.6'}\n#define GXOCT ${lo?1:2}\n#define GXS ${scale.toFixed(2)}\n#define GXSTARS ${lo?'0.6':'1.0'}\n${lo?'#define GXLO\n':'#define GXHQ\n'}`;
const GXM={};
// mode 'gun' (weapons, plain), 'toon' (Royale hero suit: modulated by the part's vertex colours so belts/emblems keep their shape)
export function gxMat(pal,mode='gun'){const lo=GQ.level==='low',k=pal+mode+(lo?'L':'H');if(GXM[k])return GXM[k];const P=GX_PAL[pal]||GX_PAL.purple,toon=mode==='toon';
 const vs=`varying vec3 vP;varying vec3 vN;varying vec3 vV;${toon?'varying vec3 vC;':''}void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;${toon?'vC=color;':''}gl_Position=projectionMatrix*mv;}`;
 const fs=gxDefs(toon?1.5:1.6,lo,toon?1:1.7,toon)+`varying vec3 vP;varying vec3 vN;varying vec3 vV;${toon?'varying vec3 vC;':''}\n`+GX_GLSL+`
void main(){vec3 N=normalize(vN),V=normalize(vV);float dif=.45+.55*max(0.,dot(N,normalize(vec3(.35,.8,.45))));float rim=pow(1.-max(0.,dot(N,V)),2.5);vec3 c=gxCol(vP,V,dif,rim);
 ${toon?'float sm=step(.99,min(min(vC.r,vC.g),vC.b));c*=.5+1.0*dot(vC,vec3(.3,.59,.11))+.15*vC;c=mix(c,mix(uC3,uC2,.55)*(1.5+.5*sin(uT*3.+vP.y*9.))+vec3(.06),sm);':''}gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
 const m=new THREE.ShaderMaterial({uniforms:{uT:skinU.uT,uC0:{value:new THREE.Vector3(...P[0])},uC1:{value:new THREE.Vector3(...P[1])},uC2:{value:new THREE.Vector3(...P[2])},uC3:{value:new THREE.Vector3(...P[3])}},vertexShader:vs,fragmentShader:fs,vertexColors:toon});m.userData.anim=1;m.userData.skin='galaxy';return GXM[k]=m}
const cache={};
export function skinMat(key){const lo=GQ.level==='low';const ck=key+(lo?'_lo':'');if(cache[ck])return cache[ck];const S=WSKINS[key];if(!S||S[2]==='none')return null;let m;
 if(key==='gold')m=lo?new THREE.MeshStandardMaterial({color:0xffc93c,metalness:.6,roughness:.26,emissive:0x5a3a00,emissiveIntensity:.7}):new THREE.MeshPhysicalMaterial({color:0xffcf4a,metalness:.85,roughness:.2,clearcoat:1,clearcoatRoughness:.08,emissive:0x4a2e00,emissiveIntensity:.55,sheen:.3,sheenColor:new THREE.Color(0xfff0b0)});
 else if(key==='ice')m=lo?new THREE.MeshStandardMaterial({color:0xdaf5ff,metalness:.25,roughness:.1,emissive:0x2f7aa6,emissiveIntensity:.75}):new THREE.MeshPhysicalMaterial({color:0xd6f3ff,metalness:.1,roughness:.18,clearcoat:1,clearcoatRoughness:.02,iridescence:.6,iridescenceIOR:1.3,emissive:0x2f7aa6,emissiveIntensity:.6,sheen:.6,sheenColor:new THREE.Color(0xbfefff)});
 else if(key.startsWith('galaxy'))m=gxMat(({galaxy:'purple',galaxy_blue:'blue',galaxy_red:'red',galaxy_gold:'gold'})[key]||'purple','gun');
 else if(key==='tiger')m=new THREE.MeshStandardMaterial({map:camoTex(0xd07a1e),metalness:.15,roughness:.6});
 else{const fs=`uniform float uT;varying vec3 vP;varying vec3 vN;varying vec3 vV;#define OCT ${lo?2:(key==='fire'?3:2)}\n#define STARS ${lo?'0.6':'1.0'}\n${lo?'':'#define HQ\n'}`.replace('#define','\n#define')+NOISE+FS[key].replace(/gl_FragColor=vec4\(c,1\.\);\}$/,'gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}');
  m=new THREE.ShaderMaterial({uniforms:skinU,vertexShader:VS,fragmentShader:fs});m.userData.anim=1}
 m.userData.skin=key;return cache[ck]=m}
export function clearSkinCache(){for(const k in cache)delete cache[k]}
// apply a skin to a gun group (hands / fx / glass / sights left alone)
export function applySkin(g,key){const m=skinMat(key);if(!m)return false;g.traverse(o=>{if(!o.isMesh||o.userData.hand||o.userData.fx)return;if(o.material&&(o.material.transparent||o.material.blending===THREE.AdditiveBlending))return;o.material=m;o.userData.tm=null});return true}
