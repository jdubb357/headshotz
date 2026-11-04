// HeadShotz v91: Battle Royale BIOMES. Every named area of the island has its own atmosphere (sky / fog / light tint that blends as you walk between areas),
// ambient particles (one pooled THREE.Points + one pooled LineSegments for the whole island: 2 draw calls), lightning, and an area-name banner.
// Everything is generated in code (no third-party assets).
import {THREE} from './gfx.js';
const H=c=>new THREE.Color(c);
// sky:[top,mid,bottom] (blended into the sky dome), fog colour + [near,far] multipliers, hemisphere light (sky,ground,intensity x), sun (colour,intensity x), p = particle kind, pc = particle colours
export const BIOMES={
 'Neon City':{ico:'🌃',c:'#ff3df0',sky:[0x120630,0x4a1280,0xff4fd8],fog:0x2b0f4d,fk:[.5,.62],hemi:0xe0b0ff,hg:0x3a1060,hk:.9,sun:0xff8fe8,sk:.65,p:'rain',pc:[0x7fd8ff,0xff7fe8],glow:0xff3df0},
 'Inferno Forge':{ico:'🔥',c:'#ff5a1a',sky:[0x3a0a00,0xc8400f,0xff8a2a],fog:0x3a1408,fk:[.5,.62],hemi:0xffb070,hg:0x4a1404,hk:.95,sun:0xff7a30,sk:.9,p:'ember',pc:[0xff5a14,0xffb030],glow:0xff5a14},
 'Golden Savanna':{ico:'🌾',c:'#ffc23a',sky:[0xd8782a,0xffc060,0xffe0a0],fog:0xf2d089,fk:[.8,.85],hemi:0xfff0c0,hg:0x9a7a30,hk:1.05,sun:0xffe0a0,sk:1.05,p:'pollen',pc:[0xfff0a0,0xffd060],glow:0xffc23a},
 'Nebula Realm':{ico:'🌌',c:'#b36bff',sky:[0x0a0224,0x3b1a8a,0xc46bff],fog:0x2a1060,fk:[.45,.55],hemi:0xcaa0ff,hg:0x2a0f5a,hk:.9,sun:0xc88aff,sk:.6,p:'sparkle',pc:[0xc78bff,0x7fd8ff,0xff9bf0],glow:0xb36bff},
 'Moonlit Lagoon':{ico:'🌙',c:'#3ee0d0',sky:[0x061a3a,0x0e5a7a,0x6fe8e0],fog:0x0e4a5a,fk:[.5,.62],hemi:0x9ff0ff,hg:0x0a3a4a,hk:.85,sun:0x9ff0ff,sk:.6,p:'bubble',pc:[0x7ff5ea,0xbafcff],glow:0x3ee0d0},
 'Thunder Isle':{ico:'⚡',c:'#6fa0ff',sky:[0x0a0f1e,0x2a3550,0x6a7a9a],fog:0x2a3548,fk:[.4,.5],hemi:0xa8b8d8,hg:0x2a3140,hk:.75,sun:0xb0c4ff,sk:.45,p:'rain',pc:[0xbcd0ff,0xe8f0ff],glow:0x8fb0ff,storm:1},
 'Crystal Caverns':{ico:'💎',c:'#4fe8ff',sky:[0x08143a,0x1a4a8a,0xff8fe0],fog:0x1a3a6a,fk:[.5,.6],hemi:0xb8e8ff,hg:0x5a2a6a,hk:.9,sun:0xc8f0ff,sk:.7,p:'sparkle',pc:[0x6ff0ff,0xff8fe8,0xffffff],glow:0x4fe8ff},
 'Aurora Ridge':{ico:'🌠',c:'#5affb0',sky:[0x05123a,0x1a8a6a,0xa86bff],fog:0x1a4a5a,fk:[.55,.65],hemi:0xb0ffe0,hg:0x1a3a5a,hk:.9,sun:0xb0ffd8,sk:.65,p:'sparkle',pc:[0x5affb0,0xb08aff,0xffffff],glow:0x5affb0,sky2:[0x1a0a5a,0x6a2ab0,0x5affb0]},
 'Firefly Hollow':{ico:'🌿',c:'#b6ff4a',sky:[0x061a22,0x1a4a3a,0x7ad06a],fog:0x1a4030,fk:[.55,.65],hemi:0xc8ffc0,hg:0x1a4020,hk:.85,sun:0xe8ffb0,sk:.7,p:'firefly',pc:[0xd8ff5a,0xfff08a],glow:0xb6ff4a},
 'Phantom Keep':{ico:'👻',c:'#9affc8',sky:[0x0a0a18,0x2a2a4a,0x6a7a8a],fog:0x1a2230,fk:[.4,.5],hemi:0xa8c0c8,hg:0x1a2a2a,hk:.7,sun:0xa0ffd0,sk:.4,p:'wisp',pc:[0x9affc8,0xc29aff],glow:0x9affc8},
 'Rust Valley':{ico:'🏭',c:'#e8803a',sky:[0x4a3a30,0xc07a4a,0xe8b88a],fog:0xb8845a,fk:[.5,.65],hemi:0xffd0a0,hg:0x6a4a30,hk:.95,sun:0xffb070,sk:.85,p:'ash',pc:[0xc79a5c,0x8a7a6a],glow:0xe8803a},
 'Blossom Village':{ico:'🌸',c:'#ff8fc0',sky:[0xd870a8,0xffb0d0,0xfff0f4],fog:0xffd8e8,fk:[.7,.8],hemi:0xfff0f8,hg:0x9a6a8a,hk:1.05,sun:0xffe0f0,sk:1.0,p:'petal',pc:[0xffb7d5,0xffd9e8],glow:0xff8fc0},
 'Toxic Swamp':{ico:'☣️',c:'#8aff3a',sky:[0x0a1a08,0x3a5a10,0x9ad030],fog:0x3a5a18,fk:[.3,.45],hemi:0xc8ff90,hg:0x2a4010,hk:.85,sun:0xc8ff70,sk:.6,p:'bubble',pc:[0x9aff3a,0xd8ff7a],glow:0x8aff3a},
 'Frostbite Peaks':{ico:'🏔️',c:'#bfe8ff',sky:[0x2a5a9a,0xbfdcf5,0xf4fbff],fog:0xdcecf8,fk:[.35,.55],hemi:0xe8f6ff,hg:0x8aa0b8,hk:1.1,sun:0xf0f8ff,sk:.85,p:'snow',pc:[0xffffff,0xdbefff],glow:0xbfe8ff},
 'Jungle Ruins':{ico:'🌴',c:'#2fd06a',sky:[0x0a3a2a,0x2a8a50,0x9ae0a0],fog:0x2a6a40,fk:[.45,.6],hemi:0xc0ffd0,hg:0x1a4a20,hk:.9,sun:0xffffc0,sk:.8,p:'firefly',pc:[0xe8ff6a,0xb6ff4a],glow:0x2fd06a},
 'Sandstorm Dunes':{ico:'🏜️',c:'#f2b45a',sky:[0xd09050,0xe8b070,0xffd8a0],fog:0xd8a868,fk:[.2,.4],hemi:0xffe0b0,hg:0x9a7040,hk:1.0,sun:0xffd090,sk:.9,p:'sand',pc:[0xe8c68a,0xd7a860],glow:0xf2b45a}
};
const KIND={
 ember:{up:[1.2,3.2],dr:.9,sz:[.14,.3],life:[2,4.2],add:1},
 snow:{up:[-2.1,-1],dr:1.1,sz:[.14,.26],life:[5,9],add:0},
 firefly:{up:[-.2,.2],dr:.4,wander:1,sz:[.16,.3],life:[3,7],pulse:1,add:1},
 sparkle:{up:[.05,.4],dr:.25,sz:[.12,.34],life:[2.5,6],pulse:1,add:1},
 petal:{up:[-1,-.45],dr:1.4,sway:1,sz:[.2,.32],life:[5,9],add:0},
 bubble:{up:[.45,1.1],dr:.3,sz:[.16,.46],life:[3,6],add:1},
 sand:{up:[-.15,.15],dr:2,wind:[8,12],sz:[.2,.45],life:[1.5,3],add:0},
 ash:{up:[-.4,.5],dr:.8,sz:[.12,.24],life:[3,6],add:0},
 wisp:{up:[.25,.7],dr:.4,sway:1,sz:[.28,.55],life:[3,6],pulse:1,add:1},
 pollen:{up:[.05,.35],dr:.5,wander:.5,sz:[.12,.22],life:[4,8],pulse:1,add:1},
 rain:{up:[0,0],dr:0,sz:[.1,.1],life:[1,1],add:0}
};
const VS=`attribute float size;attribute float alpha;attribute vec3 col;varying float vA;varying vec3 vC;uniform float scale;void main(){vA=alpha;vC=col;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*scale/max(.5,-mv.z),2.5,70.);gl_Position=projectionMatrix*mv;}`;
const FS=`varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d);a*=a;if(a<.01)discard;gl_FragColor=vec4(vC,a*vA);}`;

// ---- procedural ground textures (one per biome, built lazily the first time you come near an area)
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hexs=n=>'#'+('000000'+n.toString(16)).slice(-6);
function groundCanvas(name,S){const cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');let sd=0;for(const ch of name)sd=sd*31+ch.charCodeAt(0);const r=mulberry(sd),u=S/512;
 const blot=(cols,n,a,b,al)=>{for(let i=0;i<n;i++){const px=r()*S,py=r()*S,rad=(a+r()*(b-a))*u,g=x.createRadialGradient(px,py,0,px,py,rad);const c=cols[(r()*cols.length)|0];g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=al;x.fillStyle=g;x.fillRect(px-rad,py-rad,rad*2,rad*2)}x.globalAlpha=1};
 const dots=(cols,n,a,b,al)=>{for(let i=0;i<n;i++){x.globalAlpha=al==null?1:al;x.fillStyle=cols[(r()*cols.length)|0];x.beginPath();x.arc(r()*S,r()*S,(a+r()*(b-a))*u,0,6.3);x.fill()}x.globalAlpha=1};
 const strokes=(cols,n,len,w,al,ang)=>{x.lineCap='round';for(let i=0;i<n;i++){const px=r()*S,py=r()*S,a=ang==null?r()*6.3:ang+(r()-.5)*.8,l=len*u*(.5+r());x.globalAlpha=al;x.strokeStyle=cols[(r()*cols.length)|0];x.lineWidth=w*u;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}x.globalAlpha=1};
 const cracks=(core,glow,n,w)=>{for(let i=0;i<n;i++){let px=r()*S,py=r()*S,a=r()*6.3;const path=[[px,py]];for(let k=0;k<14;k++){a+=(r()-.5)*1.1;px+=Math.cos(a)*(18+r()*26)*u;py+=Math.sin(a)*(18+r()*26)*u;path.push([px,py])}
   for(const[lw,c,bl]of[[w*2.6,glow,0],[w,core,0]]){x.strokeStyle=c;x.lineWidth=lw*u;x.lineJoin='round';x.globalAlpha=lw>w?.45:1;x.beginPath();x.moveTo(path[0][0],path[0][1]);for(const p of path)x.lineTo(p[0],p[1]);x.stroke()}}x.globalAlpha=1};
 const grid=(c,n,w,al)=>{x.strokeStyle=c;x.globalAlpha=al;x.lineWidth=w*u;for(let i=0;i<=n;i++){const p=i*S/n;x.beginPath();x.moveTo(p,0);x.lineTo(p,S);x.stroke();x.beginPath();x.moveTo(0,p);x.lineTo(S,p);x.stroke()}x.globalAlpha=1};
 const facets=(cols,n,sz,al)=>{for(let i=0;i<n;i++){const px=r()*S,py=r()*S,a0=r()*6.3;x.beginPath();for(let k=0;k<3;k++){const a=a0+k*2.1+r()*.6,l=sz*u*(.5+r());k?x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l):x.moveTo(px+Math.cos(a)*l,py+Math.sin(a)*l)}x.closePath();x.globalAlpha=al;x.fillStyle=cols[(r()*cols.length)|0];x.fill();x.globalAlpha=al*1.6;x.strokeStyle='#ffffff';x.lineWidth=1.2*u;x.stroke()}x.globalAlpha=1};
 const ripples=(c,n,amp,al,w)=>{x.strokeStyle=c;x.globalAlpha=al;x.lineWidth=w*u;for(let i=0;i<n;i++){const y0=i*S/n;x.beginPath();for(let px=0;px<=S;px+=6){const y=y0+Math.sin(px/S*6.28*3+i*1.7)*amp*u+Math.sin(px/S*6.28*7+i)*amp*.3*u;px?x.lineTo(px,y):x.moveTo(px,y)}x.stroke()}x.globalAlpha=1};
 const fill=c=>{x.fillStyle=c;x.fillRect(0,0,S,S)};
 switch(name){
  case 'Neon City':fill('#241448');blot(['#3a1c70','#2a1458'],40,30,90,.8);grid('#ff3df0',16,3,.7);grid('#35e0ff',8,4.5,.8);blot(['#ff3df0','#35e0ff','#8a3dff'],14,14,34,.55);dots(['#fff'],60,1,2,.8);break;
  case 'Inferno Forge':fill('#241210');blot(['#3a1c14','#120806','#4a2418'],60,20,70,.9);cracks('#ffd060','#ff4a10',16,2.4);blot(['#ff5a14'],10,10,24,.5);break;
  case 'Golden Savanna':fill('#c9a050');blot(['#d8b560','#b88c40','#e8c878'],50,30,80,.8);strokes(['#e8d080','#a8803a','#f0dc90','#8a6a2a'],900,16,1.6,.7);dots(['#6a5020'],40,1,3,.5);break;
  case 'Nebula Realm':fill('#240c50');blot(['#5a22b8','#b050ff','#2a1a90','#ff70e0','#38a8ff'],46,40,110,.7);cracks('#e8c8ff','#a050ff',8,1.6);dots(['#fff','#d8b8ff','#9ae8ff'],110,1,2.6,.9);break;
  case 'Moonlit Lagoon':fill('#0c4458');blot(['#14707a','#0a3048','#3ac8c0'],40,30,90,.7);ripples('#9ffcf2',16,10,.35,2);dots(['#fff','#bafcff'],50,1,2.4,.8);break;
  case 'Thunder Isle':fill('#333b4c');blot(['#4a5468','#252c3a','#5a6a84'],55,25,80,.8);cracks('#8a96b0','#171c26',12,1.4);blot(['#7a90c0','#a8c0f0'],10,16,40,.35);break;
  case 'Crystal Caverns':fill('#142e5c');blot(['#244a8a','#0c1e44'],30,40,100,.8);facets(['#4fe8ff','#ff8fe8','#8a9aff','#b8f8ff'],150,50,.38);dots(['#fff'],70,1,2.4,.9);break;
  case 'Aurora Ridge':fill('#d8ecf4');blot(['#ffffff','#b8dcee'],40,30,90,.8);blot(['#5affb0','#b08aff','#4ad8ff'],24,40,100,.45);ripples('#7affd0',8,26,.28,6);dots(['#fff'],80,1,2.4,.9);break;
  case 'Firefly Hollow':fill('#173a1e');blot(['#256a30','#0e2a14','#3a8a3a'],60,20,70,.85);strokes(['#4aa04a','#1a5a24'],400,14,1.8,.7);dots(['#d8ff5a','#fff08a'],40,1.4,3,.9);dots(['#b86aff','#ff8fd0'],14,3,6,.85);break;
  case 'Phantom Keep':fill('#323a42');for(let i=0;i<8;i++)for(let j=0;j<8;j++){x.fillStyle=['#3a444c','#2a3238','#46525a'][((i*3+j*7)%3)];x.fillRect(i*S/8+2,j*S/8+2,S/8-4,S/8-4)}blot(['#4a8a70','#6affc0'],36,14,50,.35);cracks('#10161a','#10161a',10,1.4);dots(['#9affc8'],24,1.5,3.2,.7);break;
  case 'Rust Valley':fill('#7a4026');blot(['#9a5a30','#5a2c1a','#b8703a','#3a1c10'],60,20,70,.85);strokes(['#c88a50','#4a2010'],240,70,2.4,.45,1.57);cracks('#2a1208','#2a1208',9,1.6);break;
  case 'Blossom Village':fill('#7cc060');blot(['#8cd070','#62a84a','#a0dc84'],50,25,70,.8);strokes(['#6aa850','#4a8a3a'],500,12,1.4,.6);dots(['#ffb7d5','#ff8fc0','#ffe0ee'],240,1.8,4.2,.9);break;
  case 'Toxic Swamp':fill('#26381a');blot(['#365a1e','#16260e','#4a7a24'],55,25,80,.85);blot(['#8aff3a','#c8ff60'],26,14,42,.5);blot(['#0a1408'],12,16,40,.7);dots(['#d8ff7a'],40,2,6,.5);break;
  case 'Frostbite Peaks':fill('#e8f2fa');blot(['#ffffff','#cfe4f4','#a8ccec'],50,30,90,.8);facets(['#8ac8f0','#bfe4ff'],70,40,.3);cracks('#a8d4f0','#cfe8ff',7,1.2);dots(['#fff'],100,1,2.2,.9);break;
  case 'Jungle Ruins':fill('#1c4a26');blot(['#2a7034','#123a1a','#3a8a40'],50,20,70,.85);for(let i=0;i<46;i++){x.save();x.translate(r()*S,r()*S);x.rotate(r()*6.3);x.fillStyle=['#2f9a4a','#1f7a38','#48b45a'][i%3];x.globalAlpha=.8;x.beginPath();x.ellipse(0,0,(12+r()*14)*u,(5+r()*5)*u,0,0,6.3);x.fill();x.restore()}x.globalAlpha=1;for(let i=0;i<10;i++){x.fillStyle='#8a8a78';x.globalAlpha=.7;const a=(20+r()*34)*u;x.fillRect(r()*S,r()*S,a,a*.8)}x.globalAlpha=1;dots(['#ffe86a'],14,1.5,3,.9);break;
  case 'Sandstorm Dunes':fill('#e0b068');blot(['#f0c882','#cc9a50'],40,30,90,.8);ripples('#f8dca0',22,10,.5,2.4);ripples('#a8782e',22,12,.35,2);dots(['#fff2d0'],50,1,2,.6);break;
  default:fill('#667');}
 // soft circular mask
 x.globalCompositeOperation='destination-in';const g=x.createRadialGradient(S/2,S/2,S*.28,S/2,S/2,S*.5);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.62,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,S,S);x.globalCompositeOperation='source-over';return cv}
const rnd=(a,b)=>a+Math.random()*(b-a);
const sm=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)};
export function initBiomes(o){const{scene,camera,renderer,hemi,sun,zones:getZones,isTouch,qLevel,thunder,show}=o;
 let ZN=[],base=null,on=false;const S={t:0,b:null,flash:0,nextL:6,bolt:0,shown:null,timeI:0,time:0};
 const q=qLevel();const N0=isTouch?150:(q==='low'?160:q==='medium'?260:360),NR=isTouch?90:(q==='low'?100:220);
 // ---- pooled particles (1 draw call)
 const N=N0,P=new Float32Array(N*3),V=new Float32Array(N*3),L=new Float32Array(N*2),Z=new Float32Array(N),PH=new Float32Array(N),Cc=new Float32Array(N*3),Al=new Float32Array(N);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('size',new THREE.BufferAttribute(Z,1));geo.setAttribute('alpha',new THREE.BufferAttribute(Al,1));geo.setAttribute('col',new THREE.BufferAttribute(Cc,3));
 const mat=new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{scale:{value:400}}});
 const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.visible=false;pts.renderOrder=20;scene.add(pts);
 // ---- pooled rain streaks (1 draw call)
 const RP=new Float32Array(NR*6),rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(RP,3));
 const rm=new THREE.LineBasicMaterial({color:0xbcd8ff,transparent:true,opacity:.0,depthWrite:false,fog:false});const rain=new THREE.LineSegments(rg,rm);rain.frustumCulled=false;rain.visible=false;rain.renderOrder=21;scene.add(rain);
 const RX=new Float32Array(NR*3);
 // ---- lightning bolt (1 object, 3 jittered strands)
 const BS=14,bp=new Float32Array(3*BS*2*2*3),bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bp,3));
 const bm=new THREE.LineBasicMaterial({color:0xdfe9ff,transparent:true,opacity:0,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});const bolt=new THREE.LineSegments(bg,bm);bolt.frustumCulled=false;bolt.visible=false;bolt.renderOrder=22;scene.add(bolt);
 const grp=new THREE.Group();scene.add(grp);const dMade={};const TS=isTouch||q==='low'?256:512,glowSet=new Set(['Neon City','Inferno Forge','Crystal Caverns','Nebula Realm','Toxic Swamp','Aurora Ridge']);
 function decal(z){if(dMade[z.n]||!BIOMES[z.n])return;dMade[z.n]=1;const tex=new THREE.CanvasTexture(groundCanvas(z.n,TS));tex.anisotropy=2;if(THREE.SRGBColorSpace)tex.colorSpace=THREE.SRGBColorSpace;
  const gl=glowSet.has(z.n),m=new THREE.MeshLambertMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:gl?.8:.3});
  const R=z.r*1.18,mesh=new THREE.Mesh(new THREE.PlaneGeometry(R*2,R*2),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(z.x,.05,z.z);mesh.renderOrder=1;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();grp.add(mesh)}
 const col=new THREE.Color(),tmp=new THREE.Color();
 let kind=null,pcs=[0xffffff];const BOX=26,BH=16;
 function setKind(bi){const b=bi?BIOMES[bi]:null;kind=b?KIND[b.p]:null;pcs=b?b.pc:[0xffffff];for(let i=0;i<N;i++){L[i*2+1]=0;Al[i]=0}}
 function spawn(i,cx,cy,cz,first){const k=kind||KIND.sparkle;const a=i*3;P[a]=cx+rnd(-BOX,BOX);P[a+2]=cz+rnd(-BOX,BOX);
  const fall=k.up[1]<0,rise=k.up[0]>.2;P[a+1]=cy+(first?rnd(-4,BH):(fall?rnd(BH*.6,BH):rise?rnd(-5,2):rnd(-3,BH*.7)));
  const up=rnd(k.up[0],k.up[1]);V[a]=rnd(-k.dr,k.dr)+(k.wind?rnd(k.wind[0],k.wind[1]):0);V[a+1]=up;V[a+2]=rnd(-k.dr,k.dr);L[i*2]=0;L[i*2+1]=rnd(k.life[0],k.life[1])*(first?rnd(.2,1):1);Z[i]=rnd(k.sz[0],k.sz[1])*(isTouch?2.4:2.1);PH[i]=rnd(0,6.28);
  col.set(pcs[(Math.random()*pcs.length)|0]);Cc[a]=col.r;Cc[a+1]=col.g;Cc[a+2]=col.b}
 function begin(def,sky,cloudMat,horMat,cloud2){base={cm:cloudMat||null,cc:cloudMat?cloudMat.color.clone():null,co:cloudMat?cloudMat.opacity:1,c2o:cloud2?cloud2.opacity:1,c2:cloud2||null,c2c:cloud2?cloud2.color.clone():null,hm:horMat||null,hc2:horMat?horMat.color.clone():null,fog:scene.fog?scene.fog.color.clone():H(0xbcd8ee),near:scene.fog?scene.fog.near:110,far:scene.fog?scene.fog.far:330,bg:scene.background&&scene.background.isColor?scene.background.clone():H(0x86cbff),
   hc:hemi.color.clone(),hg:hemi.groundColor.clone(),hi:hemi.intensity,sc:sun.color.clone(),si:sun.intensity,sky:sky?[sky.top.value.clone(),sky.mid.value.clone(),sky.bot.value.clone()]:null,sunC:sky&&sky.sunCol?sky.sunCol.value.clone():null,sunI:sky&&sky.sunI?sky.sunI.value:1,skyU:sky};
  ZN=getZones()||[];grp.visible=true;S.t=0;S.b=null;S.shown=null;S.flash=0;on=true;for(let i=0;i<N;i++){L[i*2+1]=0;Al[i]=0}
  const w=renderer.getSize(new THREE.Vector2());mat.uniforms.scale.value=w.y*.5;}
 function end(){if(!on)return;on=false;grp.visible=false;pts.visible=false;rain.visible=false;bolt.visible=false;if(base){apply(0,null,0)}base=null}
 function apply(t,b,flash){if(!base)return;const k=Math.min(1,t*.95),ks=Math.min(1,t*1.12);
  if(scene.fog){scene.fog.color.copy(base.fog);if(b)scene.fog.color.lerp(tmp.set(b.fog),k);if(flash)scene.fog.color.lerp(tmp.set(0xdfe9ff),flash*.45);const f=b?1+(b.fk[0]-1)*k:1,f2=b?1+(b.fk[1]-1)*k:1;scene.fog.near=base.near*f;scene.fog.far=base.far*f2}
  if(scene.background&&scene.background.isColor){scene.background.copy(base.bg);if(b)scene.background.lerp(tmp.set(b.sky[1]),ks);if(flash)scene.background.lerp(tmp.set(0xdfe9ff),flash*.5)}
  hemi.color.copy(base.hc);hemi.groundColor.copy(base.hg);if(b){hemi.color.lerp(tmp.set(b.hemi),k);hemi.groundColor.lerp(tmp.set(b.hg),k)}hemi.intensity=base.hi*(b?1+(b.hk-1)*k:1)*(1+flash*2.2);
  sun.color.copy(base.sc);if(b)sun.color.lerp(tmp.set(b.sun),k);sun.intensity=base.si*(b?1+(b.sk-1)*k:1)*(1+flash*1.2);
  if(base.cm){base.cm.color.copy(base.cc);base.cm.opacity=base.co*(1-.55*(b?ks:0));if(b)base.cm.color.lerp(tmp.set(b.sky[1]).lerp(col.set(0xffffff),.1),ks*.95);if(flash)base.cm.color.lerp(col.set(0xdfe9ff),flash*.6)}
  if(base.c2){base.c2.color.copy(base.c2c);base.c2.opacity=base.c2o*(1-.6*(b?ks:0));if(b)base.c2.color.lerp(tmp.set(b.sky[1]).lerp(col.set(0xffffff),.1),ks*.95);if(flash)base.c2.color.lerp(col.set(0xdfe9ff),flash*.6)}
  if(base.hm){base.hm.color.copy(base.hc2);if(b)base.hm.color.lerp(tmp.set(b.fog).lerp(col.set(0xffffff),.3),ks*.8)}
  if(base.skyU&&base.sunC){const U=base.skyU;U.sunCol.value.copy(base.sunC);if(b)U.sunCol.value.lerp(tmp.set(b.sun),ks*.6).multiplyScalar(1-.65*ks);U.sunI.value=base.sunI*(b?1-.5*ks:1)}
  if(base.skyU){const U=base.skyU,al=b&&b.sky2?(Math.sin(S.time*.35)+1)/2:0;for(let i=0;i<3;i++){const u=[U.top,U.mid,U.bot][i];u.value.copy(base.sky[i]);if(b){const tgt=b.sky2?tmp.set(b.sky[i]).lerp(col.set(b.sky2[i]),al):tmp.set(b.sky[i]);u.value.lerp(tgt,ks)}if(flash)u.value.lerp(col.set(0xdfe9ff),flash*.55)}}}
 function update(dt,pos,air){if(!on||!base)return;dt=Math.min(dt,.1);S.time+=dt;S.mk=0;
  let best=null,bw=0;for(const z of ZN){if(!dMade[z.n]&&Math.hypot(pos.x-z.x,pos.z-z.z)<z.r*2.6&&!S.mk){decal(z);S.mk=1}const d=Math.hypot(pos.x-z.x,pos.z-z.z),w=1-d/(z.r*1.45);if(w>bw){bw=w;best=z}}
  const tgtB=best&&BIOMES[best.n]?best.n:null,want=tgtB?sm(0,.3,bw):0;
  if(tgtB!==S.b){if(S.t<.07){S.b=tgtB;setKind(tgtB)}}
  const goal=(tgtB===S.b)?want:0;S.t+=(goal-S.t)*Math.min(1,dt*(goal<S.t?4:1.8));const b=S.b?BIOMES[S.b]:null;
  // banner: first time you are well inside a new area
  if(tgtB&&bw>.3&&S.shown!==tgtB){S.shown=tgtB;show&&show(tgtB,BIOMES[tgtB])}else if(!tgtB&&bw<=0&&S.shown&&S.t<.05)S.shown=null;
  // lightning
  if(b&&b.storm&&S.t>.35){S.nextL-=dt;if(S.nextL<=0){S.nextL=rnd(3.5,9);strike(pos)}}
  if(S.flash>0){S.flash=Math.max(0,S.flash-dt*(S.flash>.5?3.2:2.2));if(S.f2&&S.flash<.28){S.f2=0;S.flash=.95}}
  if(S.bolt>0){S.bolt-=dt;bm.opacity=Math.max(0,S.bolt/.32)*.95;if(S.bolt<=0)bolt.visible=false}
  apply(S.t,b,S.flash);
  // particles
  const show1=!!kind&&S.t>.03&&!!b;pts.visible=show1;if(show1){const k=kind,cx=pos.x,cy=pos.y,cz=pos.z,tt=S.time;
   for(let i=0;i<N;i++){const a=i*3;L[i*2]+=dt;let age=L[i*2];
    if(age>=L[i*2+1]||Math.abs(P[a]-cx)>BOX+2||Math.abs(P[a+2]-cz)>BOX+2||P[a+1]<cy-9||P[a+1]>cy+BH+4){spawn(i,cx,cy,cz,L[i*2+1]===0);age=0}
    let vx=V[a],vy=V[a+1],vz=V[a+2];
    if(k.wander){vx+=Math.sin(tt*.9+PH[i])*.9;vz+=Math.cos(tt*.8+PH[i]*1.7)*.9;vy+=Math.sin(tt*1.3+PH[i]*2.1)*.5}
    if(k.sway){vx+=Math.sin(tt*1.6+PH[i])*.8;vz+=Math.cos(tt*1.4+PH[i])*.6}
    P[a]+=vx*dt;P[a+1]+=vy*dt;P[a+2]+=vz*dt;
    const lf=age/L[i*2+1];let al=Math.min(1,lf*5)*Math.min(1,(1-lf)*4);if(k.pulse)al*=.55+.45*Math.sin(tt*3.2+PH[i]*3);
    const dx=P[a]-cx,dz=P[a+2]-cz,edge=1-Math.min(1,Math.hypot(dx,dz)/(BOX+2));al*=sm(0,.35,edge);Al[i]=al*S.t*(k.add?.95:.8)}
   geo.attributes.position.needsUpdate=true;geo.attributes.alpha.needsUpdate=true;geo.attributes.size.needsUpdate=true;geo.attributes.col.needsUpdate=true;
   mat.blending=k.add?THREE.AdditiveBlending:THREE.NormalBlending}
  // rain streaks
  const rv=!!b&&b.p==='rain'&&S.t>.05;rain.visible=rv;if(rv){rm.opacity=.7*S.t;const sp=b.storm?34:26,len=b.storm?1.6:1.1;for(let i=0;i<NR;i++){const a=i*3,c=i*6;if(RX[a]===0&&RX[a+1]===0||RX[a+1]<pos.y-6){RX[a]=pos.x+rnd(-22,22);RX[a+1]=pos.y+rnd(2,14);RX[a+2]=pos.z+rnd(-22,22)}RX[a+1]-=sp*dt;RX[a]-=2.5*dt;
    RP[c]=RX[a];RP[c+1]=RX[a+1];RP[c+2]=RX[a+2];RP[c+3]=RX[a]+len*.09;RP[c+4]=RX[a+1]+len;RP[c+5]=RX[a+2]}rg.attributes.position.needsUpdate=true}
 }
 function strike(pos){const a=Math.random()*6.283,d=rnd(55,150),bx=pos.x+Math.cos(a)*d,bz=pos.z+Math.sin(a)*d;let k=0;const strands=3;
  for(let s=0;s<strands;s++){let x=bx+rnd(-1,1)*(s?1.2:0),y=150,z=bz+rnd(-1,1)*(s?1.2:0);const step=150/BS;for(let i=0;i<BS;i++){const nx=x+rnd(-5,5)*(s?1.4:1),ny=y-step,nz=z+rnd(-5,5)*(s?1.4:1);const j=((s*BS+i)*2)*3;bp[j]=x;bp[j+1]=y;bp[j+2]=z;bp[j+3]=nx;bp[j+4]=ny;bp[j+5]=nz;x=nx;y=ny;z=nz}}
  bg.attributes.position.needsUpdate=true;bolt.visible=true;S.bolt=.32;bm.opacity=.95;S.flash=.95;S.f2=Math.random()<.6?1:0;thunder&&thunder(d)}
 function dispose(){end();scene.remove(pts);scene.remove(grp);for(const m of grp.children){m.material.map.dispose();m.material.dispose();m.geometry.dispose()}scene.remove(rain);scene.remove(bolt);geo.dispose();mat.dispose();rg.dispose();rm.dispose();bg.dispose();bm.dispose()}
 function setHi(v){if(base)base.hi=v}
 return{setHi,begin,end,update,strike,dispose,state:S,get on(){return on},pts,rain,bolt,kind:()=>kind}}
