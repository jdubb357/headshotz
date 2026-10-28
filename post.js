// HeadShotz post pipeline (High quality): HDR scene RT (MSAA) -> bloom (1/4 + 1/8 res) -> ACES + grading + vignette + dither.
import {THREE} from './gfx.js';
const VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const mk=(fs,u)=>new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:fs,uniforms:u,depthTest:false,depthWrite:false,toneMapped:false});
const BRIGHT=`uniform sampler2D t;uniform float thr;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=max(l-thr,0.)/max(l,1e-4);gl_FragColor=vec4(min(c*k,vec3(12.)),1.);}`;
const BLUR=`uniform sampler2D t;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.2270;
 c+=texture2D(t,vUv+dir*1.3846).rgb*.3162;c+=texture2D(t,vUv-dir*1.3846).rgb*.3162;c+=texture2D(t,vUv+dir*3.2308).rgb*.0703;c+=texture2D(t,vUv-dir*3.2308).rgb*.0703;gl_FragColor=vec4(c,1.);}`;
const COMP=`uniform sampler2D tS,tB1,tB2;uniform float exposure,bloom,sat,con,vig,time;uniform vec3 tint;varying vec2 vUv;
vec3 RRT(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
vec3 aces(vec3 c){const mat3 I=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));const mat3 O=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
 c*=exposure/.6;c=I*c;c=RRT(c);c=O*c;return clamp(c,0.,1.);}
vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){vec3 c=texture2D(tS,vUv).rgb;c+=(texture2D(tB1,vUv).rgb*.65+texture2D(tB2,vUv).rgb*.9)*bloom;
 c=aces(c);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,sat)*tint;
 vec3 s=srgb(clamp(c,0.,1.));s=clamp((s-.5)*con+.5,0.,1.);
 vec2 d=vUv-.5;s*=1.-vig*smoothstep(.2,.85,dot(d,d)*2.2);
 float n=fract(sin(dot(gl_FragCoord.xy+time,vec2(12.9898,78.233)))*43758.5453);s+=(n-.5)/255.;gl_FragColor=vec4(s,1.);}`;
export class Post{
 constructor(r){this.r=r;const gl2=r.capabilities.isWebGL2;const o={type:THREE.HalfFloatType,depthBuffer:false};
  this.rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:gl2?4:0});
  this.a=new THREE.WebGLRenderTarget(4,4,o);this.b=new THREE.WebGLRenderTarget(4,4,o);this.c=new THREE.WebGLRenderTarget(4,4,o);this.d=new THREE.WebGLRenderTarget(4,4,o);
  this.mB=mk(BRIGHT,{t:{value:null},thr:{value:1.05}});this.mBl=mk(BLUR,{t:{value:null},dir:{value:new THREE.Vector2()}});
  this.mC=mk(COMP,{tS:{value:this.rt.texture},tB1:{value:this.b.texture},tB2:{value:this.d.texture},exposure:{value:1},bloom:{value:.55},sat:{value:1.1},con:{value:1.05},vig:{value:.32},tint:{value:new THREE.Vector3(1,1,1)},time:{value:0}});
  this.q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.mC);this.q.frustumCulled=false;this.sc=new THREE.Scene();this.sc.add(this.q);this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.v=new THREE.Vector2();this.w=0;this.h=0}
 grade(g,exposure){if(!g)g=[1,1,1,1.1,1.05];this.mC.uniforms.tint.value.set(g[0],g[1],g[2]);this.mC.uniforms.sat.value=g[3];this.mC.uniforms.con.value=g[4];this.mC.uniforms.exposure.value=exposure;this.mC.uniforms.bloom.value=g[5]!=null?g[5]:.55}
 size(){this.r.getDrawingBufferSize(this.v);const w=this.v.x|0,h=this.v.y|0;if(w===this.w&&h===this.h)return;this.w=w;this.h=h;this.rt.setSize(w,h);
  const w4=Math.max(1,w>>2),h4=Math.max(1,h>>2),w8=Math.max(1,w>>3),h8=Math.max(1,h>>3);this.a.setSize(w4,h4);this.b.setSize(w4,h4);this.c.setSize(w8,h8);this.d.setSize(w8,h8);this.s4=[w4,h4];this.s8=[w8,h8]}
 begin(){this.size();this.r.setRenderTarget(this.rt);this.r.clear()}
 pass(m,target){this.q.material=m;this.r.setRenderTarget(target);this.r.render(this.sc,this.cam)}
 end(t){const r=this.r;this.mB.uniforms.t.value=this.rt.texture;this.pass(this.mB,this.a);
  const bl=this.mBl.uniforms;bl.t.value=this.a.texture;bl.dir.value.set(1/this.s4[0],0);this.pass(this.mBl,this.b);bl.t.value=this.b.texture;bl.dir.value.set(0,1/this.s4[1]);this.pass(this.mBl,this.a);
  bl.t.value=this.a.texture;bl.dir.value.set(1/this.s8[0],0);this.pass(this.mBl,this.c);bl.t.value=this.c.texture;bl.dir.value.set(0,1/this.s8[1]);this.pass(this.mBl,this.d);
  this.mC.uniforms.tB1.value=this.a.texture;this.mC.uniforms.time.value=t%100;this.pass(this.mC,null)}}
