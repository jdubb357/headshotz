import * as THREE from './lib/three.module.min.js';
import {getTex,normalTex,TX} from './gfx.js';
import {terrainHeightAt,raidScenery,raidDoorwaySites,raidSpawnDressing,uniqueWindowProps} from './shared/raid-worlds.mjs';
const palettes={industrial:{ground:0x969684,concrete:0xadb0a8,brick:0x9b8272,planks:0x8a7c68,roof:0x44565f,metal:0x8ea0a1,container:0x4e7b81,rock:0x7f7c72,crate:0xac8755,barrier:0xccb173},wilderness:{ground:0x8a9375,concrete:0xb0b0a4,brick:0xa88977,planks:0x8a7357,roof:0x4c6662,metal:0x8fa2a2,container:0x7c7050,rock:0x99958a,crate:0x9c8559,barrier:0xa8a176},settlement:{ground:0x9c8d78,concrete:0xb3ada3,brick:0xb0836a,planks:0x94785c,roof:0x5c5f6a,metal:0x8d989d,container:0x7a625a,rock:0x857d70,crate:0xac8252,barrier:0xceb379}};
const blockTex=kind=>kind==='metal'||kind==='roof'||kind==='container'?'metal':kind==='crate'?'crate':kind==='rock'?'rock':kind==='barrier'?'hazard':kind==='planks'?'planks':kind==='brick'?'brick':'concrete';
// Photographed surfaces store their real colour in assets/tex/*_d.jpg. Their
// materials carry only an exposure tint, not a pale palette dye, so brick stays
// brick red and planks stay timber brown instead of greyscale x tint.
const PHOTO_SURFACES=new Set(['concrete','brick','planks','asphalt','rock','tiles','metal','sand','plaster','crate','forest','dirt','gravel','cobble']);
// One texture tile in metres. Block faces are stretched by their instance size,
// so the shader below repeats the photographed map at real brick/board scale
// rather than smearing one 12 m sheet across a whole façade.
const PHOTO_TILE={concrete:2.8,brick:1.9,planks:1.8,asphalt:3.5,dirt:3.5,gravel:3.0,forest:3.2,cobble:1.8,tiles:2.4,metal:2.0,rock:2.8,plaster:2.2,sand:2.4,crate:1.0};
// Per-surface physical response: [roughness, metalness, normalScale]. Asphalt and
// barriers keep a wet sheen so the sky environment map reads as surface reflection,
// while concrete/rock stay diffuse. The table also feeds terrain shading.
const SURFACE_PBR={concrete:[.93,0,.45],tiles:[.55,.02,.4],planks:[.82,.02,.55],metal:[.38,.62,.35],steel:[.46,.55,.25],drum:[.62,.55,.35],brick:[.9,0,.6],rock:[.9,0,.7],hazard:[.62,.25,.3],forest:[.97,0,.5],dirt:[.97,0,.45],gravel:[.96,0,.55],asphalt:[.86,.04,.45],crate:[.8,.02,.55],window:[.18,.88,0],plain:[.86,0,0],glow:[.35,.1,0]};
// How strongly each surface responds to rain: roofs/asphalt/stone wet hardest,
// vegetation and timber only dampen. The value scales the shared wetness state
// against a material's authored dry baseline.
const WET_RESPONSE={asphalt:1,gravel:.92,tiles:.88,window:.85,concrete:.78,rock:.7,brick:.62,dirt:.5,forest:.38,planks:.55,crate:.42,steel:.34,drum:.32};
// The sector terrain is one vertex-shaded heightfield rather than a flat slab.
// Heights are sampled from shared world data, so hills match authoritative
// collision and offline/raid-minimap previews. Line tint keeps ridges readable
// and a subtle noise modulation breaks up the texture tiling.
function terrainMesh(world,palette){
 const segments=160,step=world.size/segments,vertices=segments+1,count=vertices*vertices;
 const position=new Float32Array(count*3),uv=new Float32Array(count*2),index=[];
 for(let j=0;j<vertices;j++)for(let i=0;i<vertices;i++){
  const k=j*vertices+i,x=-world.size/2+i*step,z=-world.size/2+j*step;
  position[k*3]=x;position[k*3+1]=terrainHeightAt(world,x,z);position[k*3+2]=z;
  uv[k*2]=i/segments;uv[k*2+1]=j/segments;
 }
 for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){const a=j*vertices+i,above=a+vertices;index.push(a,above,a+1,a+1,above,above+1)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
 const normals=geometry.attributes.normal,colors=new Float32Array(count*3);
 const low=new THREE.Color(palette.ground),high=new THREE.Color(world.theme==='wilderness'?0x93a083:world.theme==='settlement'?0xa5917b:0x8c978d),rock=new THREE.Color(0x706f68),tint=new THREE.Color();
 for(let i=0;i<count;i++){
  const height=position[i*3+1],slope=1-normals.array[i*3+1];
  tint.copy(low).lerp(high,Math.min(1,height/34));
  if(slope>0)tint.lerp(rock,Math.min(.55,slope*1.5));
  const variation=(Math.sin(position[i*3]*.23)+Math.cos(position[i*3+2]*.19))*0.13;
  tint.multiplyScalar(1+variation);
  colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geometry.userData.raidOwned=true;
 const map=getTex(world.theme==='wilderness'?'forest':world.theme==='settlement'?'dirt':'gravel').clone();
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(200,200);map.anisotropy=8;map.needsUpdate=true;
 // The terrain grid is large enough that a single normal tile would smear; tile
 // the relief texture at the same density as the albedo so sun-lit ridges and
 // gravel keep readable surface detail at first-person range.
 const normal=normalTex(world.theme==='wilderness'?'forest':world.theme==='settlement'?'dirt':'gravel',1.6).clone();
 normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(200,200);normal.anisotropy=8;normal.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map,normalMap:normal,normalScale:new THREE.Vector2(.55,.55),vertexColors:true,roughness:.93,metalness:.04,envMapIntensity:.4,side:THREE.FrontSide});
 material.userData.raidOwned=true;material.userData.raidOwnTexture=true;material.userData.raidOwnNormalTexture=true;
 material.userData.raidDry={roughness:.93,metalness:.04,envMapIntensity:.4,normalScale:.55};material.userData.raidWet=1;
 const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.castShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
 return mesh;
}
// Tangent-plane normal of the authored height field at a fixture position. The
// finite difference spans several terrain cells so wet glints follow the broad
// street/hill relief instead of the first triangle's normal.
export function terrainNormalAt(world,x,z,target=new THREE.Vector3()){
 const step=Math.max(1.2,(world.terrain?.cell||2.4)*.9);
 const dx=(terrainHeightAt(world,x+step,z)-terrainHeightAt(world,x-step,z))/(step*2);
 const dz=(terrainHeightAt(world,x,z+step)-terrainHeightAt(world,x,z-step))/(step*2);
 // Malformed/degenerate samples (NaN heights, exhausted seams) fall back to the
 // horizon so no glint or pool ever receives a non-finite orientation.
 if(!Number.isFinite(dx)||!Number.isFinite(dz))return target.set(0,1,0);
 return target.set(-dx,1,-dz).normalize();
}
// Soft vertical sheen used for wet-ground glints. The radial gradient is drawn
// with a narrow x scale so filtered reads stay smooth, while the instanced quad
// applies the authored stretch without per-frame billboarding.
function wetGlintTexture(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;
 const context=canvas.getContext('2d');
 context.save();context.translate(32,64);context.scale(.34,1);context.translate(-32,-64);
 const gradient=context.createRadialGradient(32,64,0,32,64,54);
 gradient.addColorStop(0,'rgba(255,252,236,1)');
 gradient.addColorStop(.32,'rgba(255,245,218,.62)');
 gradient.addColorStop(.72,'rgba(255,219,160,.16)');
 gradient.addColorStop(1,'rgba(255,205,140,0)');
 context.fillStyle=gradient;context.fillRect(0,0,64,128);context.restore();
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
// Trailside grass is a clump of flat tapered blades arranged in crossed planes,
// not a cone. From eye level the blades catch the sky and shade like bent stems,
// and the clump never presents the hard pyramid silhouette a cone does at close
// range. The whole clump is one geometry, so vegetation stays a single instance
// per clump and keeps the instanced draw budget unchanged.
function tuftGeometry(){
 // Four blades at different heights and lean directions: from eye level at
 // least two planes always face the camera, and the uneven tips keep the clump
 // from reading as a stamped cone or a lone spike.
 const blades=[[0,.96,1.00,.20],[Math.PI*.25,.82,1.12,.30],[Math.PI*.5,1.02,.94,.18],[Math.PI*.75,.76,1.16,.34]],positions=[],uvs=[],indices=[];let base=0;
 for(const [angle,height,width,lean] of blades){
  const cos=Math.cos(angle),sin=Math.sin(angle);
  // [height, width factor, sideways lean] from rooted base to tip.
  const rows=[[-.5,width,0],[-.5+height*.55,width*.52,lean*.34],[-.5+height,width*.09,lean]];
  for(const [y,w,l] of rows)for(let side=-1;side<=1;side+=2){
   const lx=side*w*.5;
   positions.push(lx*cos+l*sin,y,-lx*sin+l*cos);
   uvs.push(side>0?1:0,(y+.5)/height);
  }
  indices.push(base,base+2,base+1,base+2,base+3,base+1,base+2,base+4,base+3,base+4,base+5,base+3);
  base+=6;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);
 // Blades are lit like a canopy rather than like their own vertical faces:
 // an upward normal keeps every tuft readable under the flat rain-sky light.
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(base*3).fill(0).map((_,k)=>k%3===1?1:0),3));
 return geometry;
}
// Wind response: foliage-only instanced groups get a small vertex-shader sway.
// The phase comes from each instance's world position, so it is deterministic
// and rebuilds identically; it never changes bases, routes or actor data.
const WIND_VERTEX=`
#ifdef USE_INSTANCING
 float windPhase=instanceMatrix[3][0]*.11+instanceMatrix[3][2]*.13;
 float windHeight=max(0.,position.y+.5);
 transformed.x+=sin(uWindTime*1.5+windPhase)*.055*windHeight;
 transformed.z+=cos(uWindTime*1.15+windPhase*1.37)*.045*windHeight;
#endif`;
// The frozen relay data repeats many window props at the exact same footprint
// (the same opening authored once for each nearby block face). Two identical
// panes and trim overlap in depth and z-fight, so the presentation layer keeps
// one window per footprint, preferring the warm/lit copy when the pair disagrees.
// It never mutates world.props: the collision, navigation and loot data still
// see every authored prop.
export function buildEnvironment(world){
 const root=new THREE.Group(),palette=palettes[world.theme]||palettes.industrial,groups=new Map(),materials=new Map(),windMaterials=[];
 // Authored practicals: lamp heads, floodlights and campfires each contribute a
 // warm halo. One additive Points field keeps hundreds of glows in a single draw
 // call; the field is presentation-only and derives strictly from authored props.
 const glowPositions=[],glowColors=[],poolPositions=[],poolColors=[],poolRadii=[];
 // Wet reflections share the fixture palette but are a separate presentation
 // field: one elongated additive glint per ground lamp/campfire, floodlight and
 // lit window, anchored to the sampled terrain beneath the source. Static,
 // deterministic streak directions keep the field view-independent and free of
 // per-frame matrix work; wetness alone controls the whole field's opacity.
 const reflectPositions=[],reflectColors=[],reflectWidths=[],reflectLengths=[];
 const wetReflect=(x,z,color,width,length)=>{
  reflectPositions.push(x,terrainHeightAt(world,x,z)+.06,z);
  const c=new THREE.Color(color);reflectColors.push(c.r,c.g,c.b);
  reflectWidths.push(Math.max(.55,width));reflectLengths.push(Math.max(1.5,length));
 };
 const glow=(x,y,z,color)=>{glowPositions.push(x,y,z);const c=new THREE.Color(color);glowColors.push(c.r,c.g,c.b)};
 const lightPool=(prop,color,radius)=>{
  if(prop.y!=null&&prop.y!==0)return;
  poolPositions.push(prop.x,terrainHeightAt(world,prop.x,prop.z)+.04,prop.z);
  poolColors.push(...new THREE.Color(color).toArray());poolRadii.push(radius);
  wetReflect(prop.x,prop.z,color,Math.max(1.4,radius*.65),Math.min(10,Math.max(4.4,radius*2.8)));
 };
 const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,16),sphere:new THREE.IcosahedronGeometry(1,1),cone:new THREE.ConeGeometry(1,1,8),tuft:tuftGeometry(),ring:new THREE.TorusGeometry(1,.08,4,20)};
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),euler=new THREE.Euler();
 // Daytime windows are dark glass that mirrors the sky; a lit window carries its
 // authored lamp colour in the group tag so RaidView can restore its warm emissive
 // only after the sun goes down. One material per distinct glow colour, no per-frame
 // texture or matrix updates.
 const windowMaterials=[],WLIT='windowLit:';
 function add(type,color,x,y,z,sx,sy,sz,ry=0,texture='plain',rx=0,rz=0,wind=false,tag=''){const key=type+'|'+color+'|'+texture+(wind?'|wind':'')+(tag?'|'+tag:'');let group=groups.get(key);if(!group){
   const glow=texture==='glow',glass=texture==='window',spec=SURFACE_PBR[texture]||SURFACE_PBR.plain;
  const windowLit=tag.startsWith(WLIT)?(Number(tag.slice(WLIT.length))||0xffd79a):null;
  const mat=new THREE.MeshStandardMaterial(glow
    ?{color,emissive:color,emissiveIntensity:1.7,roughness:spec[0],metalness:spec[1]}
    :glass
    ?{color,map:getTex(texture),roughness:spec[0],metalness:spec[1],envMapIntensity:1.8,emissive:windowLit??0x000000,emissiveIntensity:0}
    :{color,map:getTex(texture),roughness:spec[0],metalness:spec[1],envMapIntensity:spec[1]>.1?1.3:.55,side:type==='tuft'?THREE.DoubleSide:THREE.FrontSide,...(spec[2]>0?{normalMap:normalTex(texture),normalScale:new THREE.Vector2(spec[2],spec[2])}:{})});
  if(windowLit!==null){mat.userData.raidWindowGlass=true;mat.userData.raidWindowGlowColor=windowLit;windowMaterials.push(mat)}
  mat.userData.raidSurface=texture;mat.userData.raidAuthoredColor=color;
  // Unit-cube instances are stretched to tens of metres, so the photographed
  // map is repeated per instance footprint at the authored tile size. This one
  // hook also chains the foliage wind shader, keeping both edits alive.
  const tile=PHOTO_TILE[texture];
  if(tile||wind){
   mat.onBeforeCompile=shader=>{
    if(tile){
     shader.uniforms.uTile={value:tile};
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTile;').replace('#include <uv_vertex>',`#include <uv_vertex>
#ifdef USE_INSTANCING
 vec3 surfaceScale=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
 vec2 surfaceRep=vec2(1.0);
 if(abs(normal.x)>.5)surfaceRep=vec2(surfaceScale.z,surfaceScale.y);
 else if(abs(normal.y)>.5)surfaceRep=vec2(surfaceScale.x,surfaceScale.z);
 else surfaceRep=vec2(surfaceScale.x,surfaceScale.y);
 surfaceRep=max(vec2(1.0),surfaceRep/uTile);
 #ifdef USE_MAP
  vMapUv*=surfaceRep;
 #endif
 #ifdef USE_NORMALMAP
  vNormalMapUv*=surfaceRep;
 #endif
#endif`);
    }
    if(wind){
     shader.uniforms.uWindTime={value:0};
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;').replace('#include <begin_vertex>','#include <begin_vertex>'+WIND_VERTEX);
     mat.userData.raidShader=shader;
    }
   };
   mat.customProgramCacheKey=()=>'raid'+(tile?'T'+tile:'')+(wind?'W':'');
  }
  mat.userData.raidOwned=true;mat.userData.raidDry={roughness:mat.roughness,metalness:mat.metalness,envMapIntensity:mat.envMapIntensity??1,normalScale:mat.normalScale?mat.normalScale.x:null};mat.userData.raidWet=glow?0:(WET_RESPONSE[texture]||0);
  if(tag)mat.userData.raidStructure=tag;
  if(wind){mat.userData.raidWind=true;windMaterials.push(mat)}
  materials.set(key,mat);group={type,transforms:[],material:mat,tag};groups.set(key,group);
  }
  position.set(x,y,z);scale.set(sx,sy,sz);euler.set(rx,ry,rz);quaternion.setFromEuler(euler);matrix.compose(position,quaternion,scale);group.transforms.push(matrix.clone());
 }
 // Cheap additive tint for timber detail (lid, battens, bracing). Keyed through
 // the same add() instancing path so one colour is one draw group.
 const shade=(color,k)=>{const r=Math.min(255,Math.round(((color>>16)&255)*k)),g=Math.min(255,Math.round(((color>>8)&255)*k)),b=Math.min(255,Math.round((color&255)*k));return (r<<16)|(g<<8)|b};
 // Painted-steel drum: pressed rib bands, welded seam, lid rim and a ground
 // flange. The flange and lid pitch give the barrel an unmissable top/bottom
 // rather than letting the raw cylinder fade into the pavement.
 const drumProp=(x,y,z,r,h,color)=>{
  add('cylinder',color,x,y+h*.5,z,r,h,r,0,'drum');
  add('cylinder',0x2c322c,x,y+h*.08,z,r*1.03,.11,r*1.03,0,'steel');
  add('cylinder',0x353d35,x,y+h*.35,z,r*1.025,.055,r*1.025,0,'steel');
  add('cylinder',0x353d35,x,y+h*.68,z,r*1.025,.055,r*1.025,0,'steel');
  add('cylinder',0x2a302b,x,y+h-.05,z,r*1.02,.10,r*1.02,0,'steel');
  add('cylinder',0x202621,x,y+h+.02,z,r*1.035,.035,r*1.035,0,'steel');
 };
 // Wooden supply crate: board body, overhanging lid, four corner battens and
 // crossed bracing on the two broad faces. Detail is real geometry so the crate
 // keeps its silhouette and reads as timber under the flat overcast light.
 const crateProp=(x,y,z,w,h,d,color)=>{
  const lid=shade(color,1.34),batten=shade(color,.65),brace=shade(color,.9);
  add('box',color,x,y+h*.5,z,w,h,d,0,'crate');
  add('box',lid,x,y+h+.015,z,w+.045,.075,d+.045,0,'planks');
  for(const sx of [-1,1])for(const sz of [-1,1])add('box',batten,x+sx*(w*.5-.008),y+h*.5,z+sz*(d*.5-.008),.115,h*.99,.115,0,'planks');
  add('box',brace,x,y+h*.5,z+d*.5+.016,Math.hypot(w,h)*.93,.115,.04,0,'planks',0,Math.PI/4);
  add('box',brace,x,y+h*.5,z-d*.5-.016,Math.hypot(w,h)*.93,.115,.04,0,'planks',0,-Math.PI/4);
 };
 add('box',palette.ground,0,-.12,0,world.size,.2,world.size,0,world.theme==='wilderness'?'forest':'gravel');
 const terrain=world.terrain?terrainMesh(world,palette):null;if(terrain)root.add(terrain);
 root.userData.raidTerrainMaterial=terrain?terrain.material:null;
  // A handful of generated street props (0.45 m posts) are authored twice at the
 // exact same footprints. Both copies are identical collision volumes, so the
 // authoritative world data stays frozen; drawing one avoids two coincident
 // meshes fighting for the same depth plane.
 const renderedBlocks=new Set();
 for(const [x,z,w,d,h,y=0,kind='concrete',tint]of world.blocks){
  const signature=x+','+z+','+w+','+d+','+h+','+y+','+kind+','+tint;
  if(renderedBlocks.has(signature))continue;
  renderedBlocks.add(signature);
  if(kind==='barrier'&&h>=2.4){
   // Tall hazard slabs used to be raw yellow/black tiled boxes: a full-height
   // chevron wash that read as a broken billboard. Render them as weathered
   // concrete boundary walls instead, with panel seams, a steel cap and small
   // hazard placards at eye level so the quarantine still reads deliberately.
   const base=tint??0x969a8e,courseH=3.6,courses=Math.max(1,Math.round(h/courseH)),hh=h/courses;
   // Lay the wall in alternating pours. Each course re-tiles the concrete map
   // instead of stretching one sheet over 27 m, and the recess line between
   // pours gives the slab readable construction joints at distance.
   for(let i=0;i<courses;i++){
    add('box',i%2?shade(base,.85):base,x,y+hh*(i+.5),z,w,hh-.045,d,0,'concrete');
    add('box',0x4f554c,x,y+hh*(i+1)-.025,z,w+.018,.05,d+.018,0,'plain');
   }
   add('box',0x565b53,x,y+.2,z,w+.10,.4,d+.10,0,'concrete');
   add('box',0x596262,x,y+h-.07,z,w+.06,.14,d+.06,0,'steel');
   const wide=w>=d,plate=Math.min(1,Math.max(.6,Math.min(2.4,(wide?w:d)*.22)));
   // A continuous painted ochre line replaces the old billboard-wide chevrons:
   // it marks the boundary at eye level without shouting.
   if(wide)for(const sz of [-1,1]){add('box',0xb7a25f,x,y+1.12,z+sz*(d*.5+.02),w,.11,.04,0,'plain');add('box',0xd4bd77,x,y+.55,z+sz*(d*.5+.035),plate,.52,.035,0,'hazard')}
   else for(const sx of [-1,1]){add('box',0xb7a25f,x+sx*(w*.5+.02),y+1.12,z,.04,.11,d,0,'plain');add('box',0xd4bd77,x+sx*(w*.5+.035),y+.55,z,.035,.52,plate,0,'hazard')}
  }
  else add('box',tint??(palette[kind]||palette.brick),x,y+h/2,z,w,h,d,0,blockTex(kind));
 }
 // Presentation-only structure weathering derived from the frozen block layer:
 // solid street-level buildings gain a dark foundation plinth and an overhanging
 // roof cornice, then a deterministic share of roof vents, antenna masts and
 // tilted debris. These groups add silhouette depth at first-person range and
 // never alter blocks, props, collision, navigation, routes or actor data.
 const structureDetail={structures:0,plinths:0,cornices:0,vents:0,antennas:0,debris:0,beacons:0};const roofPlantList=[],groundGritList=[],shutterSites=[],sillSites=[];let shutteredWindows=0;
 const hash01=n=>{const v=Math.sin(n)*43758.5453123;return v-Math.floor(v)};
 for(const block of world.blocks){
  const [x,z,w,d,h,y=0,kind='concrete']=block;
  if(y>0.4||h<2.6||w<5||d<5)continue;
  if(kind!=='brick'&&kind!=='concrete'&&kind!=='planks')continue;
  const hash=hash01(x*12.9898+z*78.233+world.id.length*1.7+h*3.7),roofY=y+h;
  // Weather staining at the base reads as a damp foundation band; the cornice
  // overhangs slightly so rooflines cast a crisp shadow instead of a flat cap.
  add('box',0x474b44,x,y+.18,z,w+.22,.36,d+.22,0,'concrete',0,0,false,'plinth');
  add('box',0x303a3b,x,roofY+.10,z,w+.34,.22,d+.34,0,'metal',0,0,false,'cornice');
  structureDetail.structures++;structureDetail.plinths++;structureDetail.cornices++;
  if(hash>.3){
   const vx=x+(hash-.5)*w*.55,vz=z+((hash*11)%1-.5)*d*.55;
   add('box',0x4e625f,vx,roofY+.34,vz,.95,.44,.8,0,'metal',0,0,false,'vent');
   structureDetail.vents++;
  }
  if(h>=6&&hash>.68){
   const ax=x+((hash*7)%1-.5)*w*.5,az=z+((hash*13)%1-.5)*d*.5;
   add('cylinder',0x5f7075,ax,roofY+1.35,az,.08,2.7,.08,0,'metal',0,0,false,'antenna');
   structureDetail.antennas++;
   // A single hazard beacon marks tall abandoned masts for readability at night.
   if(hash>.86){add('sphere',0xd86d4d,ax,roofY+2.78,az,.22,.18,.22,0,'glow',0,0,false,'beacon');structureDetail.beacons++}
  }
  if(hash<.18){
   add('box',0x77746a,x+(hash-.5)*w*.6,roofY+.22,z+((hash*17)%1-.5)*d*.6,1.7,.16,1,.15,'rock',.16,.08,false,'debris');
   if(hash<.08)add('box',0x8a8777,x+((hash*19)%1-.5)*w*.7,roofY+.12,z+((hash*23)%1-.5)*d*.7,.6,.34,.7,0,'rock',0,0,false,'debris');
   structureDetail.debris++;
  }
  // Rooftop mechanical plant: a deterministic share of standing blocks keeps a
  // galvanised water tank, an HVAC condenser or a bolted exhaust stack above the
  // cornice, adding an industrial silhouette at skyline range. Each plant is
  // inset from the parapet so it never overhangs the footprint, uses the PBR
  // metal/concrete maps, and derives only from the frozen block dimensions.
  const plantHash=hash01(x*31.7+z*91.3+world.id.length*7.1+h*5.3);
  if(h>=5&&plantHash<.34){
   const px2=hash01(plantHash*3.13)>.5?1:-1,pz2=hash01(plantHash*8.27)>.5?1:-1;
   const cx2=x+px2*(w/2-1.05),cz2=z+pz2*(d/2-1.05),baseY=roofY+.24,pk=hash01(plantHash*53.1+world.id.length*.7);
   if(pk<.40){
    for(const [sx2,sz2] of [[-.55,-.55],[.55,-.55],[-.55,.55],[.55,.55]])add('box',0x545e5e,cx2+sx2,baseY+.45,cz2+sz2,.11,.90,.11,0,'metal',0,0,false,'roofPlant');
    add('cylinder',0x8c9594,cx2,baseY+1.66,cz2,.70,1.52,.70,0,'metal',0,0,false,'roofPlant');
    for(const yy of [baseY+1.06,baseY+2.02])add('cylinder',0x5d5445,cx2,yy,cz2,.717,.13,.717,0,'metal',0,0,false,'roofPlant');
    add('cylinder',0x929b99,cx2,baseY+2.59,cz2,.72,.16,.72,0,'metal',0,0,false,'roofPlant');
    add('box',0x717b79,cx2,baseY+2.72,cz2,.40,.12,.40,0,'metal',0,0,false,'roofPlant');
    // A ladder rail and inlet pipe on one flank make the tank read as serviced.
    add('box',0x6b7773,cx2+.74,baseY+1.72,cz2-.19,.08,1.16,.08,0,'metal',0,0,false,'roofPlant');
    add('box',0x6b7773,cx2+.74,baseY+1.72,cz2+.19,.08,1.16,.08,0,'metal',0,0,false,'roofPlant');
    for(const yy of [.34,1.32,2.28])add('box',0x8a9693,cx2+.74,baseY+yy,cz2,.06,.05,.46,0,'metal',0,0,false,'roofPlant');
    add('box',0x606a68,cx2+.55,baseY+.55,cz2-.74,.14,.10,.42,0,'metal',0,0,false,'roofPlant');
    add('box',0x606a68,cx2+.86,baseY+.55,cz2-.74,.10,1.28,.10,0,'metal',0,0,false,'roofPlant');
    roofPlantList.push({x:cx2,y:baseY,z:cz2,roof:roofY,h,kind:'tank',ox:px2,oz:pz2,top:baseY+2.78});
   }else if(pk<.72){
    add('box',0x6c6f68,cx2,baseY+.11,cz2,1.80,.22,1.40,0,'concrete',0,0,false,'roofPlant');
    add('box',0x818d8c,cx2,baseY+.63,cz2,1.55,1.00,1.15,0,'metal',0,0,false,'roofPlant');
    add('box',0x4c5657,cx2,baseY+1.16,cz2,1.60,.06,1.20,0,'metal',0,0,false,'roofPlant');
    for(let i=0;i<5;i++)add('box',0x5a6664,cx2-.52+i*.26,baseY+.64,cz2+.585,.07,.82,.04,0,'metal',0,0,false,'roofPlant');
    add('box',0x56605e,cx2-.86,baseY+.48,cz2,.20,.16,.20,0,'metal',0,0,false,'roofPlant');
    add('box',0x7c8885,cx2-.86,baseY+.30,cz2,.42,.10,.10,0,'metal',0,0,false,'roofPlant');
    add('box',0x7c8885,cx2-.65,baseY+.10,cz2,.10,.50,.10,0,'metal',0,0,false,'roofPlant');
    roofPlantList.push({x:cx2,y:baseY,z:cz2,roof:roofY,h,kind:'condenser',ox:px2,oz:pz2,top:baseY+1.24});
   }else{
    add('cylinder',0x6e7b7a,cx2,baseY+1.28,cz2,.28,2.20,.28,0,'metal',0,0,false,'roofPlant');
    for(const yy of [baseY+.36,baseY+2.16])add('cylinder',0x55605f,cx2,yy,cz2,.37,.11,.37,0,'metal',0,0,false,'roofPlant');
    add('box',0x8b9592,cx2,baseY+2.42,cz2,.70,.10,.70,0,'metal',0,0,false,'roofPlant');
    for(const a of [-.7,.7])add('box',0x5b6564,cx2+a*.36,baseY+1.0,cz2,.06,1.7,.06,0,'metal',0,0,false,'roofPlant');
    roofPlantList.push({x:cx2,y:baseY,z:cz2,roof:roofY,h,kind:'stack',ox:px2,oz:pz2,top:baseY+2.50});
   }
   structureDetail.roofPlants=(structureDetail.roofPlants||0)+1;
  }
  // Tall street-level blocks carry a deterministic fire-escape frame: a deck,
  // railing and ladder add readable industrial silhouette depth at street
  // range. Presentation-only, derived only from the frozen block layer.
  if(h>=5&&hash>.52){
   const face=Math.floor(hash*4)%4,onZ=face<2,nx=face===2?-1:face===3?1:0,nz=face===0?1:face===1?-1:0;
   const pw=Math.min(3.2,Math.max(2,(onZ?w:d)*.55)),deck=.78,yaw=onZ?0:Math.PI/2,levels=h>=7.5?2:1;
   const cx=x+nx*(w/2+.52),cz=z+nz*(d/2+.52);
   for(let level=0;level<levels;level++){
    const py=y+2.3+level*2.5;if(py>roofY-.5)break;
    add('box',0x6b797c,cx,py,cz,pw,.1,deck,yaw,'metal',0,0,false,'fireEscape');
    add('box',0x879499,cx+nx*deck*.37,py+.86,cz+nz*deck*.37,pw,.06,.10,yaw,'metal',0,0,false,'fireEscape');
    for(const side of [-1,1])add('box',0x516165,cx+(onZ?side*pw*.42:0),py+.5,cz+(onZ?0:side*pw*.42),.08,1,.08,yaw,'metal',0,0,false,'fireEscape');
    if(level===0){
     const lx=cx+nx*.22+(onZ?pw*.38:0),lz=cz+nz*.22+(onZ?0:pw*.38);
     add('box',0x3f4e52,lx,(y+py)/2,lz,.09,py-y,.09,yaw,'metal',0,0,false,'fireEscape');
     for(let rung=0;rung<4;rung++)add('box',0x819196,lx,y+.35+rung*.4,lz,.36,.05,.36,yaw,'metal',0,0,false,'fireEscape');
    }
   }
   structureDetail.fireEscapes=(structureDetail.fireEscapes||0)+1;
  }
  // A deterministic share of facades is reclaimed by climbing vines: a damp
  // foundation mat plus staggered leafy clumps reaching up the wall. The
  // spheres reuse the foliage wind shader so they sway with the world
  // and freeze under reduced motion. Presentation-only, block-data derived.
  const vineHash=hash01(x*4.71+z*9.13+world.id.length*.61+h*2.3);
  if(vineHash<.30){
   const face=Math.floor(hash01(vineHash*7.13)*4)%4,onZ=face<2,nx=face===2?-1:face===3?1:0,nz=face===0?1:face===1?-1:0;
   const span=onZ?w:d,wallX=x+nx*(w/2+.11),wallZ=z+nz*(d/2+.11);
   const baseAlong=(hash01(vineHash*9.7)-.5)*span*.6;
   // A damp, spreading moss mat seeds the growth along the foundation.
   for(let i=0;i<4;i++){
    const t=hash01(vineHash*11.17+i*4.31),along=baseAlong+(t-.5)*1.5;
    add('sphere',0x3d5834,wallX+(onZ?along:0),y+.20+hash01(vineHash*5.7+i)*.22,wallZ+(onZ?0:along),(.95+t*.55),.42,.62,0,'forest',0,0,true,'vines');
   }
   // Overlapping clumps climb a single column, forming a continuous ivy strip
   // instead of disconnected balls. Slight jitter keeps it organic.
   const reach=Math.min(h-.3,4.6),steps=7+Math.floor(hash01(vineHash*19.1)*3);
   for(let i=0;i<steps;i++){
    const t=i/(steps-1),along=baseAlong+(hash01(vineHash*23.7+i*2.73)-.5)*.5*(1-t*.4)+Math.sin(i*1.4)*.14;
    add('sphere',t>.66?0x41603a:0x4f6f45,wallX+(onZ?along:0)-nx*.08,Math.max(y+.45,y+.55+t*(reach-.4)),wallZ+(onZ?0:along)-nz*.08,.86-t*.18,.9,.38,0,'forest',0,0,true,'vines');
   }
   structureDetail.vines=(structureDetail.vines||0)+1;
  }
  // Street-level ground grit: loose masonry, a plank splinter and weed tufts
  // settle on the pavement at one deterministic outer corner. Pieces are seated
  // on sampled terrain height outside the footprint, derive only from the frozen
  // block dimensions, and the weeds share the frozen wind clock.
  const gritHash=hash01(x*19.3+z*61.7+world.id.length*9.1+h*.8);
  if(gritHash<.62){
   const gc1=hash01(gritHash*5.71)>.5?1:-1,gc2=hash01(gritHash*13.17)>.5?1:-1;
   const gx=x+gc1*(w/2+.34),gz=z+gc2*(d/2+.34),gy=terrainHeightAt(world,gx,gz);
   for(let i=0;i<3;i++){
    const a=hash01(gritHash*21.7+i*3.9)*Math.PI*2,r=hash01(gritHash*3.1+i*.73)*.42;
    const cw=.26+hash01(gritHash*4.71+i)*.24,ch=.10+hash01(gritHash*9.13+i)*.16,cd=.22+hash01(gritHash*7.37+i)*.18;
    add('box',i===2?0x7c6a4f:0x837f74,gx+Math.cos(a)*r,gy+ch/2,gz+Math.sin(a)*r,cw,ch,cd,hash01(gritHash*8.3+i)*1.4,'rock',.12,.05,false,'groundGrit');
   }
   add('box',0x6f5a3f,gx+.55,gy+.14,gz+.17,.72,.06,.14,gritHash*1.9,'planks',.1,0,false,'groundGrit');
   for(let i=0;i<4;i++){
    const a=hash01(gritHash*31.3+i*5.1)*Math.PI*2,r=.16+hash01(gritHash*6.7+i)*.4;
    add('tuft',i%2?0x556046:0x455138,gx+Math.cos(a)*r,gy+.26+hash01(gritHash*2.9+i)*.10,gz+Math.sin(a)*r,.26+hash01(gritHash*8.9+i)*.16,.48+hash01(gritHash*4.4+i)*.18,.26,a*1.7,'forest',.10,0,true,'groundGrit');
   }
   groundGritList.push({x:gx,y:gy,z:gz,ox:gc1,oz:gc2,h});
   structureDetail.streetGritClusters=(structureDetail.streetGritClusters||0)+1;
  }
 }
 root.userData.raidStructureDetail=structureDetail;root.userData.raidRoofPlants=roofPlantList;root.userData.raidStreetGrit=groundGritList;root.userData.raidWindowShutters=shutterSites;root.userData.raidWindowSills=sillSites;
 for(const ramp of world.ramps||[]){const count=20;for(let i=0;i<count;i++){const t=(i+.5)/count,x=ramp.x+(ramp.axis==='x'?(t-.5)*ramp.w:0),z=ramp.z+(ramp.axis==='z'?(t-.5)*ramp.d:0),y=ramp.from+(ramp.to-ramp.from)*t;
  add('box',palette.metal,x,y-.08,z,ramp.axis==='x'?ramp.w/count:ramp.w,.16,ramp.axis==='z'?ramp.d/count:ramp.d,0,'metal');
  if(i%4===0)for(const side of [-1,1])add('box',palette.metal,x+(ramp.axis==='z'?side*ramp.w/2:0),y+.55,z+(ramp.axis==='x'?side*ramp.d/2:0),.1,1.1,.1);
 }}
 // Roads and lane paint establish readable routes through every district.
 for(const axis of ['x','z']){add('box',0x8d9189,0,.012,0,axis==='x'?world.size-4:7,.025,axis==='z'?world.size-4:7,0,'asphalt');for(let i=-world.size/2+8;i<world.size/2;i+=8)add('box',0xc8ba79,axis==='x'?i:0,.032,axis==='z'?i:0,axis==='x'?3:.12,.015,axis==='z'?3:.12)}
 // Window props are authored 0.27 m proud of their parent block face. Scanning
 // every block for every window would be quadratic at relay scale (≈8.8k windows
 // × 10k blocks), so a coarse footprint grid narrows each lookup to the blocks
 // beside the opening. The grid is presentation-only and never mutates world data.
 const FACADE_CELL=12,facadeGrid=new Map();
 for(const b of world.blocks||[]){
  const [bx,bz,bw,bd]=b;
  const x0=Math.floor((bx-bw/2-1)/FACADE_CELL),x1=Math.floor((bx+bw/2+1)/FACADE_CELL);
  const z0=Math.floor((bz-bd/2-1)/FACADE_CELL),z1=Math.floor((bz+bd/2+1)/FACADE_CELL);
  for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){
   const key=ix+','+iz,list=facadeGrid.get(key);
   if(list)list.push(b);else facadeGrid.set(key,[b]);
  }
 }
 const windowOutward=(prop,onZ)=>{
  const cx=Math.floor(prop.x/FACADE_CELL),cz=Math.floor(prop.z/FACADE_CELL);
  for(let ix=cx-1;ix<=cx+1;ix++)for(let iz=cz-1;iz<=cz+1;iz++){
   const list=facadeGrid.get(ix+','+iz);if(!list)continue;
   for(const b of list){
    const [bx,bz,bw,bd]=b;
    if(onZ){
     if(Math.abs(prop.x-bx)>bw/2+.2)continue;
     if(prop.z>bz&&Math.abs(prop.z-(bz+bd/2+.27))<.6)return 1;
     if(prop.z<bz&&Math.abs(prop.z-(bz-bd/2-.27))<.6)return -1;
    }else{
     if(Math.abs(prop.z-bz)>bd/2+.2)continue;
     if(prop.x>bx&&Math.abs(prop.x-(bx+bw/2+.27))<.6)return 1;
     if(prop.x<bx&&Math.abs(prop.x-(bx-bw/2-.27))<.6)return -1;
    }
   }
  }
  return 0;
 };
 // Sign faces are painted into one cached, readable texture per name. The
 // lettering sits on a value-contrast panel (dark slate against cream) so the
 // notices read under daylight, dusk and emergency lighting without bloom.
 const signPlaneGeometry=new THREE.PlaneGeometry(1,1),signMaterials=new Map();
 const signMaterial=name=>{
  let material=signMaterials.get(name);if(material)return material;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d'),bg=ctx.createLinearGradient(0,0,0,128);
  bg.addColorStop(0,'#2a4146');bg.addColorStop(1,'#17282c');ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);
  ctx.fillStyle='#d8b867';ctx.fillRect(0,0,512,7);ctx.fillRect(0,121,512,7);
  ctx.strokeStyle='#cdb378';ctx.lineWidth=4;ctx.strokeRect(10,10,492,108);
  ctx.fillStyle='#f2e3bc';ctx.font='bold 42px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(name,256,68,462);
  ctx.fillStyle='#c9c0a1';for(const [rx,rz] of [[20,20],[492,20],[20,108],[492,108]]){ctx.beginPath();ctx.arc(rx,rz,4,0,Math.PI*2);ctx.fill()}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  material=new THREE.MeshStandardMaterial({map:texture,roughness:.72,metalness:.08,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.17});
  material.userData.raidOwned=true;material.userData.raidOwnTexture=true;signMaterials.set(name,material);
  return material;
 };
 const scenery=raidScenery(world);
 for(const prop of uniqueWindowProps([...(world.props||[]),...scenery])){const{x,z,scale:s=1}=prop,baseY=prop.y??0,lift=(prop.y==null||prop.y===0)?terrainHeightAt(world,x,z):0,y=baseY+lift;
  if(prop.kind==='floor')add('box',prop.color||palette.ground,x,y,z,prop.w,.03,prop.d,0,'tiles');
  // Trees use the swappable foliage texture plus three offset crown blobs; the
  // layered silhouette reads as an organic canopy instead of stacked cones.
  else if(prop.kind==='tree'){const leaf=prop.leaf||0x3c5745;add('cylinder',0x6b5842,x,y+1.5*s,z,.23*s,3*s,.23*s,0,'planks');for(let i=0;i<3;i++)add('cone',leaf,x,y+(3+i)*s,z,(2-i*.4)*s,3*s,(2-i*.4)*s,0,'forest',0,0,true);for(let i=0;i<3;i++){const a=i*2.1;add('sphere',leaf,x+Math.sin(a)*.8*s,y+(3.1+i*.9)*s,z+Math.cos(a)*.7*s,(1.2-i*.12)*s,.72*s,(1.1-i*.1)*s,0,'forest',0,0,true)}}
  else if(prop.kind==='bush'){const c=prop.color||0x3e9b4f;for(let i=0;i<3;i++)add('sphere',c,x+(i-1)*.55*s,y+(.7+i*.1)*s,z+(i%2?-.4:.3)*s,1.25*s,.85*s,1.1*s,0,'forest',0,0,true)}
  // Presentation-only undergrowth and building ruins derived from
  // raidScenery(); they never add collision and use fixed offsets so the
  // online and offline builders agree.
  else if(prop.kind==='fern'){const c=prop.color||0x587446,n=4;for(let i=0;i<n;i++){const a=(prop.ry||0)+i*Math.PI*2/n;add('tuft',c,x+Math.sin(a)*.32*s,y+.32*s,z+Math.cos(a)*.32*s,.30*s,1.05*s,.30*s,a,'forest',Math.PI*.10,0,true)}}
  else if(prop.kind==='shrub'){const c=prop.color||0x45673d;for(let i=0;i<4;i++){const a=(prop.ry||0)+i*1.65;add('sphere',c,x+Math.sin(a)*.42*s,y+(.5+i*.1)*s,z+Math.cos(a)*.38*s,(1.15-i*.08)*s,(.85-i*.05)*s,(1.05-i*.06)*s,0,'forest',0,0,true)}}
  else if(prop.kind==='stump'){const s2=prop.scale||1;add('cylinder',0x5b4936,x,y+.62*s2,z,.28*s2,1.24*s2,.28*s2,0,'planks');add('cylinder',0x7c6a4f,x,y+1.24*s2,z,.31*s2,.08*s2,.31*s2,0,'planks');add('box',0x6b5842,x+(prop.ry?Math.sin(prop.ry)*.55*s2:.55*s2),y+.28*s2,z+(prop.ry?Math.cos(prop.ry)*.55*s2:0),1.1*s2,.16*s2,.18*s2,prop.ry||0,'planks',0,Math.PI*.12)}
  // Moss used to be a flat sphere (a 3 m-wide pancake at street scale) that
  // read as a printed sticker on the photo asphalt. Five upright blades keep
  // the colour and the wind sway while giving the growth real silhouette.
  else if(prop.kind==='moss'){const c=prop.color||0x5d7248;for(let i=0;i<5;i++){const a=(prop.ry||0)+i*Math.PI*2/5,r=(i%2?.34:.16)*s;add('tuft',c,x+Math.sin(a)*r,y+.2*s,z+Math.cos(a)*r,.22*s,.38*s,.22*s,a,'forest',0,0,true)}}
  else if(prop.kind==='ruin'){const c=prop.color||0x8b8c84,ry=prop.ry||0,off=1.25*s,px=x+Math.sin(ry)*off,pz=z+Math.cos(ry)*off;add('box',c,x,y+.85*s,z,.55*s,1.7*s,2.4*s,ry,'brick',0,0);add('box',c,px,y+.58*s,pz,.5*s,1.16*s,1.5*s,ry,'brick',0,0);add('box',0x74736c,x-Math.cos(ry)*.95*s,y+.12*s,z+Math.sin(ry)*.95*s,1.9*s,.2*s,.62*s,ry+.35,'rock',0,Math.PI*.06)}
  else if(prop.kind==='rubble'){const c=prop.color||0x8a8777,ry=prop.ry||0;for(let i=0;i<3;i++){const a=ry+i*2.1;add('box',c,x+Math.cos(a)*.38*s,y+(.18+i*.11)*s,z+Math.sin(a)*.44*s,.55*s*(1-i*.12),.22*s*(1+i*.35),.68*s*(1-i*.18),a,'rock',0,Math.PI*.08)}add('sphere',0x777268,x-.3*s,y+.12*s,z+.25*s,.34*s,.18*s,.28*s,0,'rock')}
  else if(prop.kind==='rock'){add('sphere',prop.color||0x8a8777,x,y+.55*s,z,1.5*s,.85*s,1.2*s,0,'rock',0)}
  else if(prop.kind==='barrel')drumProp(x,y,z,.5*s,1.3*s,prop.color||0x4b5344)
  else if(prop.kind==='crate')crateProp(x,y,z,prop.w||1.15*s,prop.h||1.1*s,prop.d||1.15*s,prop.color||0x9c7b4d)
  else if(prop.kind==='tank'){const c=prop.color||0x748889;add('cylinder',c,x,y+1.5*s,z,1.1*s,3*s,1.1*s,0,'metal');add('sphere',c,x,y+3*s,z,1.1*s,.55*s,1.1*s,0,'metal');add('box',0x4d5f63,x,y+.25,z,2.5*s,.3*s,2.5*s,0,'metal')}
  else if(prop.kind==='tent'){add('cone',prop.color||0x8a9b7a,x,y+1.25*s,z,1.7*s,2.5*s,1.7*s)}
  else if(prop.kind==='campfire'){add('cylinder',0x5a4632,x,y+.12,z,.75*s,.18*s,.75*s,0,'rock');add('sphere',prop.color||0xffb64d,x,y+.42*s,z,.42*s,.55*s,.42*s,0,'glow');add('box',0x3e342c,x,y+.1,z,1.1*s,.12*s,.16*s,0,'planks',0,Math.PI/5);glow(x,y+.42*s,z,prop.color||0xff9b52);lightPool(prop,0xff9444,2.2*s)}
  else if(prop.kind==='car'){add('box',prop.color||0x647082,x,y+.5*s,z,2.2*s,1*s,1.1*s,0,'metal');add('box',prop.color||0x647082,x-.1*s,y+1.25*s,z,.9*s,.55*s,.95*s,0,'metal');for(const sx of [-1,1])for(const sz of [-1,1])add('cylinder',0x1f2420,x+sx*.7*s,y+.28*s,z+sz*.45*s,.24*s,.5*s,.24*s,0,'metal')}
  else if(prop.kind==='scrap'){add('box',0x536368,x,.45,z,1.8,.9,1.2,.3,'metal');add('cylinder',0x977d58,x+.5,.8,z,.4,1.2,.4,0,'metal')}
  else if(prop.kind==='dish'){add('sphere',0xbdc5b6,x,y+1.2,z,2.8,.5,2.8,0,'metal');add('box',0x415259,x,y+2,z,.2,3,.2)}
  else if(prop.kind==='turbine'){add('cylinder',0x7d8b87,x,y+1.1,z,1,2.2,1,0,'metal');for(let i=0;i<4;i++)add('box',0x424d52,x+Math.sin(i*Math.PI/2)*1.7,y+2.3,z+Math.cos(i*Math.PI/2)*1.7,.65,.18,3,i*Math.PI/2,'metal')}
  else if(prop.kind==='waterTower'){for(const sx of [-1.3,1.3])for(const sz of [-1.3,1.3])add('box',0x687d7b,x+sx,3,z+sz,.25,6,.25);add('cylinder',0x8d9b8a,x,6.5,z,2.2,3,2.2,0,'metal');add('cone',0x435754,x,8.5,z,2.4,1.2,2.4)}
  else if(prop.kind==='pump'){add('box',0x79918a,x,1,z,4,2,2,0,'metal');for(const side of [-1,1])add('cylinder',0x3e5156,x+side*2,.65,z,.4,5,.4,0,'metal',Math.PI/2)}
  else if(prop.kind==='basin')add('box',0x547776,x,y,z,prop.w,.03,prop.d,0,'tiles');
  else if(prop.kind==='rail'){for(const side of [-1,1])add('box',0x6c7778,x,y+.1,z+side*.8,prop.w,.2,.12,0,'metal');for(let i=-prop.w/2;i<prop.w/2;i+=2)add('box',0x5d4b3d,x+i,y+.02,z,.3,.14,2.6,0,'planks')}
  else if(prop.kind==='signal'){add('cylinder',0x53646a,x,2.4,z,.12,4.8,.12);add('box',0x29383d,x,4.4,z,.65,1.2,.4);add('sphere',0xc67b4e,x,4.5,z+.25,.18,.18,.1)}
  else if(prop.kind==='floodlight'){add('cylinder',0x3e4c53,x,y+3.2,z,.16,6.4,.16,0,'metal');add('box',0xf4e3ac,x,y+6.4,z,1.4,.2,.7,0,'glow');glow(x,y+6.4,z,0xf6ecd4);if(prop.y==null||prop.y===0)wetReflect(x,z,0xf6ecd4,2.6,9.2)}
  else if(prop.kind==='crane'){add('box',0x4d5f63,x,y+2,z,.5,4,.5,0,'metal');add('box',0x4d5f63,x+8,y+4,z,.5,.35,9,0,'metal');add('box',0x2c3a40,x+12,y+3.4,z,.15,1.2,.15,0,'metal');add('box',0xa08a59,x+8,y+3.8,z,3,.18,.5,0,'metal')}
  else if(prop.kind==='antenna'){add('cylinder',0x5f7075,x,y+7,z,.2,14,.2,0,'metal');add('box',0x26363b,x,y+12,z,2.4,.24,.24,0,'metal');add('sphere',0xdf6b4e,x,y+13,z,.35,.35,.35,0,'glow')}
  else if(prop.kind==='wreck'){add('box',0x3d302c,x,y+.8,z,6,1.4,2.4,0,'metal');add('box',0x6e4c38,x+1.6,y+1.6,z-.4,2.6,.4,1.6,0,'metal');add('cylinder',0x24201f,x-1.8,y+.5,z+.9,.45,.6,.45,0,'metal');add('box',0x3f4446,x+2.4,y+1.1,z+.2,2.2,.5,2.2,0,'metal')}
  else if(prop.kind==='road'||prop.kind==='sidewalk'||prop.kind==='plaza'){
   const color=prop.kind==='sidewalk'?0xb5afa2:prop.kind==='plaza'?0x9a9080:0x93978c;
   add('box',color,x,y,z,prop.w,.024,prop.d,prop.ry||0,prop.kind==='road'?'asphalt':prop.kind==='plaza'?'tiles':'concrete');
   if(prop.kind==='road'){
    // Deterministic street wear so the near asphalt holds readable detail even
    // when the sun pass is in shadow: worn dark patches, pothole scars, cracked
    // seams and pale gravel chips lying just above the road plane. Presentation
    // only — no collision, no authored prop or frozen data is touched.
    const seed=Math.abs(Math.round(Math.sin(x*12.9898+z*78.233)*43758.5453)),h=i=>hash01(seed*.013+i*5.37+.21),ry=prop.ry||0,cosR=Math.cos(ry),sinR=Math.sin(ry);
    const place=(lx,lz)=>[x+lx*cosR+lz*sinR,y,z-lx*sinR+lz*cosR];
    // Faded municipal paint: a dashed centre line and worn edge lines give the
    // long diagonal approach a vanishing guide as readable as the buildings.
    for(let lx=-prop.w/2+5;lx<prop.w/2-5;lx+=7.4){
     const [px,py,pz]=place(lx,0);
     add('box',0xbfb176,px,py+.038,pz,3.1,.012,.11,ry,'concrete',0,0,false,'');
    }
    for(const side of [-1,1]){const [px,py,pz]=place(0,side*(prop.d/2-.42));add('box',0xd5c7a2,px,py+.036,pz,Math.max(1,prop.w-7),.012,.10,ry,'concrete',0,0,false,'')}
    // Broad shelled-out repairs and crossing cracks keep the surface from reading
    // as a flat black slab at first-person range; chips catch the overhead sky.
    const spots=6+Math.floor(h(2)*5);
    for(let i=0;i<spots;i++){
     const lx=(h(i*2+3)-.5)*prop.w*.86,lz=(h(i*2+4)-.5)*prop.d*.7,px=x+lx*cosR+lz*sinR,pz=z-lx*sinR+lz*cosR,spin=h(i*3+9)*Math.PI;
     if(i%3===0)add('sphere',0x72766a,px,y+.021,pz,.35+h(i+11)*.7,.012,.28+h(i+13)*.4,spin,'rock');
     else if(i%3===1)add('box',0xb2b1a4,px,y+.024,pz,.42+h(i+15)*.55,.012,.18+h(i+17)*.3,spin,'gravel');
     else add('box',0x55594f,px,y+.022,pz,.045,.012,.55+h(i+21)*1.7,spin,'rock');
    }
    // Weathered shoulder aggregate sits just outside the paint so the road edge
    // separates from the sidewalk instead of ending in another dark band.
    for(const side of [-1,1])for(let i=0;i<4;i++){
     const [px,py,pz]=place((h(i+31)-.5)*prop.w*.82,side*(prop.d/2+.10));
     add('box',0xb8b8aa,px,py+.024,pz,.24+h(i+33)*.34,.012,.18+h(i+35)*.22,h(i+37)*Math.PI,'gravel',0,0,false,'');
    }
    // Ragged verge: the grass or dirt beyond the asphalt used to meet it in one
    // clean box edge. Scatter low tufts, dirt shoulders and gravel chips along
    // both shoulders, sampled from the authored terrain so they sit on the hill
    // instead of floating, and let some cross onto the paint. Hashed from the
    // road position, so every deploy sees the same broken, organic edge.
    for(const side of [-1,1])for(let i=0,lx=-prop.w/2+1.2;lx<prop.w/2-1.2;i++,lx+=1.75){
     const j=h(i*2+57),k=h(i*3+61);
     // Immediate border: grass and dirt straddle the paint so the asphalt line,
     // and the pavement beyond it, dissolves into tufts and aggregate instead of
     // a ruled box edge. The farther clump reaches the verge past any sidewalk.
     for(const off of [prop.d/2+j*.9-.3,prop.d/2+2.6+j*2.4]){
      const px=x+lx*cosR+side*off*sinR,pz=z-lx*sinR+side*off*cosR;
      const top=Math.max(y,terrainHeightAt(world,px,pz));
      if(k<.5){
       const green=j>.55?0x6e7246:0x565d3a;
       for(const ti of [0,1,2]){
        const ox=side*(ti-1)*.16+j*.08,oz=(ti-1)*.30;
        add('tuft',ti===1?green:0x4d5936,px+ox,top+.14+j*.08,pz+oz,.10+j*.09,.30+j*.22,.10+j*.09,ti*2.1,'forest',0,0,true);
       }
       if(j>.55)add('tuft',green,px-side*.18,top+.20+j*.14,pz,.15+j*.11,.40+j*.22,.15+j*.11,j*6.28,'forest',Math.PI*.16,0,true);
      }else if(k<.82){
       for(let di=0;di<3;di++){
        const [dx,dz]=[Math.cos(j*6.28+di*2.1)*.3,Math.sin(j*6.28+di*2.1)*.24];
        add('box',di?0x5b5345:0x6b5f4d,px+dx,top+.045,pz+dz,.22+j*.2,.055+di*.012,.16+j*.16,j*Math.PI,'dirt',0,0,false,'');
       }
      }else{
       add('box',0x9a9a8d,px,top+.03,pz,.2+j*.4,.012,.15+j*.25,j*Math.PI,'gravel',0,0,false,'');
       if(j>.6)add('box',0x6c6f60,px+side*.25,top+.027,pz,.5+j*.5,.01,.2+j*.3,j*8.4,'rock',0,0,false,'');
      }
     }
    }
    // Loose verge cover on the cut-and-fill slope beyond the sidewalk: terrain
    // that rises above the flattened corridor gets scattered brush and stone
    // only where it is actually elevated, so the hill reads as ground and its
    // base no longer forms a clean ruled line against the road corridor.
    for(const side of [-1,1])for(let i=0,lx=-prop.w/2+2;lx<prop.w/2-2;i++,lx+=2.6){
     const j=h(i*5+101),k=h(i*7+103),off=side*(prop.d/2+4.4+j*12.5),px=x+lx*cosR+off*sinR,pz=z-lx*sinR+off*cosR;
     const gy=terrainHeightAt(world,px,pz);
     if(gy<.28)continue;
     const green=j>.5?0x596442:0x475238;
     for(let ti=0;ti<3;ti++){
      const a=j*5.1+ti*2.09,r=.18+j*.58;
      add('tuft',ti===1?green:0x414c32,px+Math.cos(a)*r,gy+.24+j*.16,pz+Math.sin(a)*r,.16+j*.11,.42+j*.3,.16+j*.11,a,'forest',Math.PI*.14,0,true);
     }
     if(k>.45)add('tuft',green,px+side*.25,gy+.25+j*.2,pz,.24+j*.16,.55+j*.35,.24+j*.16,j*6.28,'forest',Math.PI*.18,0,true);
     if(k<.3)add('box',0x8d8b80,px-side*.3,gy+.03,pz,.28+j*.4,.06,.2+j*.3,j*7.1,'rock',0,0,false,'');
    }
   }
  }
  else if(prop.kind==='crosswalk'){
   const n=5,step=prop.w/(n*2.2);
   for(let i=0;i<n;i++)add('box',0xded7b5,x-prop.w/2+step*(i+.5)*2.2,y,z,prop.w/(n*3),.03,prop.d,0,'concrete');
  }
  else if(prop.kind==='window'){
   const w=prop.w||.16,d=prop.d||1.15,h=prop.h||1.3,lit=!!(prop.lit&&prop.color!=null);
   // Dark glazing by daylight, warm lamp by night: the pane keeps the same material
   // and the authored colour travels in the tag, so nothing changes shape or per-window
   // draw state when the sun sets.
   add('box',0x56727d,x,y+h/2,z,w,h,d,0,'window',0,0,false,lit?'windowLit:'+(prop.color&0xffffff):'windowDark');
   // Presentation-only masonry reveal: a sill, a lintel and two jambs turn the
   // flat opening into an authored window frame. The trim faces outward by a
   // few centimetres so rain wetness and lamplight catch it, and it is derived
   // only from the frozen window prop.
   const onZ=w>=d,wide=onZ?w:d,thick=onZ?d:w,frame=onZ?[wide+.30,.09,thick+.16]:[thick+.16,.09,wide+.30];
   add('box',0x746e63,x,y-.045,z,frame[0],frame[1],frame[2],0,'concrete',0,0,false,'framing');
   add('box',0x746e63,x,y+h+.045,z,frame[0],frame[1],frame[2],0,'concrete',0,0,false,'framing');
   const jamb=onZ?[.15,h+.18,thick+.16]:[thick+.16,h+.18,.15];
   add('box',0x746e63,x-(onZ?wide/2+.075:0),y+h/2,z-(onZ?0:wide/2+.075),jamb[0],jamb[1],jamb[2],0,'concrete',0,0,false,'framing');
   add('box',0x746e63,x+(onZ?wide/2+.075:0),y+h/2,z+(onZ?0:wide/2+.075),jamb[0],jamb[1],jamb[2],0,'concrete',0,0,false,'framing');
   structureDetail.frames=(structureDetail.frames||0)+4;
   // Abandoned dark openings are sealed with nailed planks from the frozen prop
   // data: a broad horizontal board plus two crossed diagonals. The overlay sits
   // outside the glazing on both sides so it reads from any approach; lit windows
   // stay clear to preserve the practical-light budget. Presentation-only.
   if(!lit){
    const boardSeed=hash01(prop.x*127.1+prop.z*311.7+world.id.length*4.3);
    if(boardSeed<.22){
     const blen=wide*(1.06+boardSeed*.18),boardDepth=thick+.03;
     for(let i=0;i<4;i++){
      const dy=h*[-.43,-.14,.14,.43][i],len=blen*(.96+boardSeed*.06),sx=onZ?len:boardDepth,sz=onZ?boardDepth:len;
      add('box',i%2?0x8a6f52:0x745d43,x,y+h/2+dy,z,sx,.17,sz,0,'planks',0,0,false,'boarding');
     }
     // Two crossed braces sit just proud of the stacked planks so the seal is
     // legible at street range without washing out the window-framing trim.
     for(const angle of [-.58,.58]){
      const len=blen*1.14,sx=onZ?len:boardDepth+.03,sz=onZ?boardDepth+.03:len;
      add('box',0x8f7455,x,y+h/2,z,sx,.14,sz,0,'planks',onZ?0:angle,onZ?angle:0,false,'boarding');
     }
     structureDetail.boardedWindows=(structureDetail.boardedWindows||0)+1;
    }
   }
   // Presentation-only weathered shutters: a deterministic share of dark
   // openings keep plank panels hung outside the frame on both sides (or one,
   // when a leaf has rotted away), each with louver slats and two metal hinges.
   // Panels sit proud of the masonry on the verified façade side so they can
   // never z-fight, cover the glazing or overlap the window trim. Derived only
   // from the frozen window prop and its parent block.
   if(!lit&&wide>0&&thick>0){
    const shutterSeed=hash01(prop.x*111.7+prop.z*203.9+(prop.y||0)*47.1+world.id.length*9.3);
    if(shutterSeed<.22){
     let outward=0;
     for(const b of world.blocks||[]){
      const bx=b[0],bz=b[1],bw=b[2],bd=b[3];
      if(onZ){
       if(Math.abs(prop.x-bx)>bw/2+.2)continue;
       if(prop.z>bz&&Math.abs(prop.z-(bz+bd/2+.27))<.6){outward=1;break}
       if(prop.z<bz&&Math.abs(prop.z-(bz-bd/2-.27))<.6){outward=-1;break}
      }else{
       if(Math.abs(prop.z-bz)>bd/2+.2)continue;
       if(prop.x>bx&&Math.abs(prop.x-(bx+bw/2+.27))<.6){outward=1;break}
       if(prop.x<bx&&Math.abs(prop.x-(bx-bw/2-.27))<.6){outward=-1;break}
      }
     }
     if(outward){
      const outX=onZ?0:outward,outZ=onZ?outward:0;
      const dims=(sx,sy,sz)=>onZ?[sx,sy,sz]:[sz,sy,sx];
      const sides=shutterSeed<.07?[(hash01(shutterSeed*5.3+1.1)>.5?1:-1)]:[-1,1];
      for(const side of sides){
       const pw=.54+hash01(shutterSeed*3.7+side+1)*.16;
       const ph=Math.max(.55,h*(.86+hash01(shutterSeed*7.1+side+1.7)*.12));
       const off=side*(wide/2+.21+pw/2);
       const px=onZ?prop.x+off+outX*.15:prop.x+outX*.15;
       const pz=onZ?prop.z+outZ*.15:prop.z+off+outZ*.15;
       const midY=prop.y+h/2;
       const board=side>0?0x7d6548:0x65543f;
       add('box',board,px,midY,pz,...dims(pw,ph,.055),0,'planks',0,0,false,'windowShutter');
       // Three horizontal louvres give the panel a readable slatted silhouette.
       for(let i=0;i<3;i++){
        const dy=ph*(i/2-.5)*.36;
        add('box',side>0?0x6d5840:0x5e4c38,px+outX*.049,midY+dy,pz+outZ*.049,...dims(pw*.88,.055,.032),0,'planks',0,0,false,'windowShutter');
       }
       // Two oxidized hinge plates pin the leaf to the frame reveal.
       for(const hy of [-ph*.34,ph*.34]){
        const hx=onZ?prop.x+side*(wide/2+.23)+outX*.19:prop.x+outX*.19;
        const hz=onZ?prop.z+outZ*.19:prop.z+side*(wide/2+.23)+outZ*.19;
        add('box',0x4a4b44,hx,midY+hy,hz,...dims(.11,.22,.06),0,'metal',0,0,false,'windowShutter');
       }
      }
      shutteredWindows++;shutterSites.push({x:prop.x,y:prop.y+h/2,z:prop.z,onZ,outX,outZ,wide,h,panels:sides.length});
      structureDetail.windowShutters=(structureDetail.windowShutters||0)+1;
     }
    }
   }
   // Presentation-only sill ledges and hanging flower boxes ground each façade
   // opening: a two-tier stone ledge projects proud of the masonry, and a
   // deterministic share carries a sun-bleached planter with soil, foliage that
   // shares the frozen wind clock and warm flower clusters. Both sit outside the
   // glazing plane and derive only from the frozen window prop and parent block.
   const sillOutward=windowOutward(prop,onZ);
   if(sillOutward){
    const outX=onZ?0:sillOutward,outZ=onZ?sillOutward:0;
    const since=(sx,sy,sz)=>onZ?[sx,sy,sz]:[sz,sy,sx];
    add('box',0x8a8276,x+outX*.06,prop.y-.105,z+outZ*.06,...since(wide+.42,.08,.32),0,'concrete',0,0,false,'windowSill');
    add('box',0x5b5750,x+outX*.02,prop.y-.16,z+outZ*.02,...since(wide+.30,.06,.28),0,'concrete',0,0,false,'windowSill');
    structureDetail.windowSills=(structureDetail.windowSills||0)+1;
    const planterSeed=hash01(prop.x*17.3+prop.z*29.7+prop.y*6.1+world.id.length*3.9);
    const hasPlanter=planterSeed<.22&&wide>=.95;
    if(hasPlanter){
     const pw=Math.min(1.12,wide*.76),ph=.22,pd=.30;
     const planX=prop.x+outX*.30,planZ=prop.z+outZ*.30,planY=prop.y-.21;
     add('box',0x684d38,planX,planY,planZ,...since(pw,ph,pd),0,'planks',0,0,false,'flowerBox');
     add('box',0x403327,planX+outX*.012,planY+ph/2-.015,planZ+outZ*.012,...since(pw*.90,.05,pd*.88),0,'dirt',0,0,false,'flowerBox');
     for(let i=0;i<2;i++){
      const along=(hash01(planterSeed*7.13+i*2.61)-.5)*pw*.46;
      add('sphere',i?0x4c6c43:0x3f5c3a,planX+(onZ?along:0)+outX*.04,planY+.30,planZ+(onZ?0:along)+outZ*.04,...since(.19,.16,.17),0,'forest',0,0,true,'flowerBox');
     }
     for(const [fc,along] of [[0xb8583e,-.30],[0xd8a24f,.06],[0x8c5f82,.32]]){
      const a=along*pw*.55;
      add('sphere',fc,planX+(onZ?a:0)+outX*.10,planY+.34,planZ+(onZ?0:a)+outZ*.10,...since(.085,.065,.085),0,'forest',0,0,false,'flowerBox');
     }
     structureDetail.flowerBoxes=(structureDetail.flowerBoxes||0)+1;
    }
    sillSites.push({x:prop.x,z:prop.z,y:prop.y-.105,onZ,outX,outZ,wide,h,planter:hasPlanter});
   }
   // Lit windows join the shared practical halo budget so night facades bloom
   // cohesively. Halos are depth-tested (with a fixture bias) rather than depth-
   // independent, so a window behind a solid wall no longer ghosts through it.
   if(lit){glow(x,y+h/2,z,prop.color||0xffd79a);wetReflect(x,z,prop.color||0xffd79a,Math.max(.82,d*.72),h*1.8)}
  }
  else if(prop.kind==='awning'){add('box',prop.color||0x8d382e,x,y+.18,z,prop.w||3,0.14,prop.d||2,0,'metal')}
  else if(prop.kind==='field'){add('box',prop.color||(world.theme==='wilderness'?0x5d7248:0x6d745f),x,y+.01,z,prop.w||20,.02,prop.d||20,0,world.theme==='wilderness'?'forest':'dirt')}
  else if(prop.kind==='fence'){const c=prop.color||0x7e8a90,ry=prop.ry||0,fw=prop.w||6,fd=prop.d||.2,horiz=fw>=fd,len=Math.max(fw,fd),thick=Math.min(fw,fd);
   for(const hh of [.55,1.15])add('box',c,x,y+hh,z,horiz?len:thick,.1,horiz?thick:len,ry,'metal');
   const posts=Math.max(2,Math.round(len/3)+1);
   for(let i=0;i<posts;i++){const t=(i/(posts-1)-.5)*len,px=x+Math.cos(ry)*t,pz=z-Math.sin(ry)*t;add('box',c,px,y+.8,pz,.14,1.6,.14,ry,'metal')}}
  else if(prop.kind==='hedge'){const c=prop.color||0x4b7046;add('box',c,x,y+.52,z,prop.w||2,1.05,prop.d||2,prop.ry||0,'forest');add('box',0x3d5c3a,x,y+.09,z,(prop.w||2)*.92,.18,(prop.d||2)*.92,prop.ry||0,'dirt')}
  else if(prop.kind==='billboard'){const c=prop.color||0x6e8a7d;for(const sx of [-1,1])add('box',0x384349,x+sx*2.1,y+2.2,z,.22,4.4,.22,0,'metal');
   add('box',0x2b3539,x,y+4.6,z,5.6,.28,1,0,'metal');add('box',c,x,y+3.1,z,5.2,2.8,.24,0,'plain');if(prop.name){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#1f3036';ctx.fillRect(0,0,512,192);ctx.fillStyle='#e8dfc4';ctx.font='bold 34px system-ui';ctx.textAlign='center';ctx.fillText(prop.name,256,105,470);ctx.strokeStyle='#cfb87c';ctx.lineWidth=8;ctx.strokeRect(4,4,504,184);const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture});material.userData.raidOwned=true;material.userData.raidOwnTexture=true;const sprite=new THREE.Sprite(material);sprite.position.set(x,y+3.1,z);sprite.scale.set(8.4,3.2,1);root.add(sprite)}}
  else if(prop.kind==='truck'){const c=prop.color||0x55606b,s=prop.scale||1;add('box',0x22282b,x-.4*s,y+.35*s,z,5.4*s,1.2*s,2.4*s,0,'metal');add('box',c,x+2.2*s,y+.55*s,z,1.6*s,1.6*s,2.2*s,0,'metal');add('box',0xb9c3c4,x+2.2*s,y+1.65*s,z,1.5*s,.7*s,2*s,0,'concrete');for(const sx of [-1.8,.6,2.2])for(const sz of [-.9,.9])add('cylinder',0x1f2420,x+sx*s,y+.28*s,z+sz*s*.8,.28*s,.55*s,.28*s,0,'metal')}
  else if(prop.kind==='pallet'){const s=prop.scale||1,c=0xb08c5a;for(let i=0;i<3;i++)add('box',c,x,y+.12+i*.22,z,1.4*s,.08,1.05*s,0,'planks');for(const px of [-.55,.55])add('box',0x8a6a45,x+px*s,y+.02,z,1.35*s,.12,1.05*s,0,'planks')}
  else if(prop.kind==='hay'){const s=prop.scale||1;add('box',0xb69a56,x,y+.6*s,z,1.9*s,1.2*s,1.2*s,0,'planks');for(const yy of [.2,.55,.9])add('box',0x937a3d,x,y+yy*s,z,1.94*s,.06,1.24*s,0,'planks')}
  else if(prop.kind==='planter'){const s=prop.scale||1,w=prop.w||3*s,d=prop.d||1.4*s;add('box',0x7c6152,x,y+.28,z,w,.56,d,prop.ry||0,'brick');add('box',0x4b7046,x,y+.6,z,w*.82,.7,d*.82,prop.ry||0,'forest')}
  else if(prop.kind==='stall'){const c=prop.color||0xff6b6b,s=prop.scale||1;add('box',0x8a603a,x,y+.5,z,2.8*s,.9*s,1.2*s,0,'planks');for(const sx of [-1.25,1.25])for(const sz of [-.5,.5])add('box',0x6b4423,x+sx*s,y+1.2*s,z+sz*s,.1,2.4*s,.1,0,'planks');add('box',c,x,y+2.35*s,z,3.2*s,.12,1.8*s,0,'hazard')}
  else if(prop.kind==='powerPole'){add('cylinder',0x384349,x,y+3,z,.13,6,.13,0,'metal');add('box',0x384349,x,y+5.7,z,2.2,.16,.16,0,'metal');for(const s of [-.9,.9])add('sphere',0xd8d5c8,x+s,y+6.1,z,.13,.13,.13,0,'metal')}
  else if(prop.kind==='sandbag'){const s=prop.scale||1;for(const [dx,dy,dz] of [[0,0,0],[.38,0,.08],[.18,.34,.24],[.55,.34,.02]])add('box',0xb6a57a,x+dx*s,y+dy*s,z+dz*s,.52*s,.28*s,.36*s,0,'concrete')}
  else if(prop.kind==='checkpoint'){const s=prop.scale||1;add('box',0x77725f,x,y+1.15*s,z,3.4*s,2.3*s,2.4*s,0,'concrete');add('box',0x2d3336,x,y+2.42*s,z,3.6*s,.16*s,2.6*s,0,'metal');add('box',0xf0d18b,x,y+2.32*s,z,.8*s,.16*s,.8*s,0,'glow')}
  else if(prop.kind==='lamp'){add('cylinder',0x2d3436,x,y+2.3,z,.1,4.6,.1,0,'metal');add('box',0x2d3436,x,y+4.65,z,.7,.1,.1,0,'metal');add('box',0xffe4a3,x,y+4.76,z,.34,.16,.34,0,'glow');glow(x,y+4.76,z,0xffcf8a);lightPool(prop,0xffc487,3.2)}
  else if(prop.kind==='bench'){add('box',0xb07a45,x,y+.45,z,2.1,.12,.45,0,'planks');add('box',0xb07a45,x,y+.66,z-.18,2.1,.32,.08,0,'planks');for(const s of [-.8,.8])add('box',0x31383c,x+s,y+.2,z,.08,.4,.4,0,'metal')}
  else if(prop.kind==='dumpster'){const s=prop.scale||1,c=prop.color||0x4e6550;add('box',c,x,y+.7*s,z,2.1*s,1.4*s,1.25*s,0,'metal');add('box',0x333d3f,x,y+1.42*s,z,2.15*s,.1*s,1.3*s,0,'metal');for(const s2 of [-.7,.7])add('cylinder',0x1f2420,x+s2*s,y+.22*s,z+.52*s,.2*s,.2*s,.2*s,0,'metal')}
  else if(prop.kind==='sign'){
   const name=String(prop.name||'SECTOR').toUpperCase();
   let boardY=Number.isFinite(prop.y)?prop.y:2.8;
   let host=null;
   // Street signs are authored a short distance outside a building face. Find
   // that façade from the same coarse block index used for window trim; the sign
   // then keeps its readable offset but gains two metal jibs tying it back to the
   // wall. Free-standing notices get real posts and footings below.
   for(let ix=Math.floor(prop.x/FACADE_CELL)-1;ix<=Math.floor(prop.x/FACADE_CELL)+1&&!host;ix++){
    for(let iz=Math.floor(prop.z/FACADE_CELL)-1;iz<=Math.floor(prop.z/FACADE_CELL)+1&&!host;iz++){
     const list=facadeGrid.get(ix+','+iz);if(!list)continue;
     for(const [bx,bz,bw,bd,bh,base=0] of list){
      if((base||0)>.3||bh<Math.max(2.6,boardY-1.2)||bw<5||bd<5)continue;
      const xInside=Math.abs(prop.x-bx)<=bw/2+.15,zInside=Math.abs(prop.z-bz)<=bd/2+.15;
      if(xInside&&Math.abs(prop.z-bz)>=bd/2-.1&&Math.abs(prop.z-bz)<bd/2+1.05){
       const nz=prop.z>bz?1:-1;host={nx:0,nz,onZ:true,wallX:bx,wallZ:bz+nz*bd/2,top:base+bh};break;
      }
      if(zInside&&Math.abs(prop.x-bx)>=bw/2-.1&&Math.abs(prop.x-bx)<bw/2+1.75){
       const nx=prop.x>bx?1:-1;host={nx,nz:0,onZ:false,wallX:bx+nx*bw/2,wallZ:bz,top:base+bh};break;
      }
     }
    }
   }
   let toX=prop.x,toZ=prop.z-1,best=Infinity;
   if(!host)for(const [px2,pz2] of world.spawns||[]){const dist=Math.hypot(px2-prop.x,pz2-prop.z);if(dist<best){best=dist;toX=px2;toZ=pz2}}
   const ry=host?Math.atan2(host.nx,host.nz):Math.atan2(toX-prop.x,toZ-prop.z);
   const nx=Math.sin(ry),nz=Math.cos(ry),panelW=host?3.6:5.2,panelH=host?.86:1.24;
   if(host)boardY=Math.max(1.4,Math.min(boardY,host.top-.35));
   else boardY=Math.max(terrainHeightAt(world,prop.x,prop.z)+2.15,boardY);
   if(host){
    const off=Math.max(.22,host.nx?Math.abs(prop.x-host.wallX):Math.abs(prop.z-host.wallZ));
    // The two mounting jibs sit just outside the board edge so they stay visible
    // from the street instead of disappearing behind the panel.
    for(const side of [-1,1]){
     const lateral=side*(panelW/2+.12);
     if(host.onZ)add('box',0x46565b,prop.x+lateral,boardY,prop.z-host.nz*off/2,off+.10,.08,.08,0,'metal',0,0,false,'');
     else add('box',0x46565b,prop.x-host.nx*off/2,boardY,prop.z+lateral,.08,.08,off+.10,0,'metal',0,0,false,'');
    }
   }else{
    // The posts sit well outside the board footprint with a tall hazard band so
    // the sign reads as a built street fixture from the insertion distance, not
    // a flat panel hovering above the road. Each post samples its own terrain
    // height, so a sign on a grade stays planted at both feet.
    for(const side of [-1,1]){
     const lateral=side*(panelW/2+.58),px2=prop.x+Math.cos(ry)*lateral,pz2=prop.z-Math.sin(ry)*lateral;
     const ground=terrainHeightAt(world,px2,pz2),postH=boardY+panelH/2+.05-ground;
     add('box',0x7d8883,px2,ground+postH/2,pz2,.28,postH,.28,0,'metal',0,0,false,'');
     add('box',palette.barrier,px2,ground+.95,pz2,.31,1.86,.31,0,'hazard',0,0,false,'');
     add('box',0x8d8b80,px2,ground+.10,pz2,.72,.20,.72,0,'concrete',0,0,false,'');
    }
    add('box',0x384b52,prop.x,boardY+panelH/2+.10,prop.z,panelW+1.4,.12,.14,ry,'metal',0,0,false,'');
    add('box',0x384b52,prop.x,boardY-panelH/2-.12,prop.z,panelW+.9,.09,.11,ry,'metal',0,0,false,'');
   }
   add('box',0x26363b,prop.x,boardY,prop.z,panelW+.14,panelH+.14,.08,ry,'metal',0,0,false,'');
   const panel=new THREE.Mesh(signPlaneGeometry,signMaterial(name));
   panel.position.set(prop.x+nx*.052,boardY,prop.z+nz*.052);panel.rotation.y=ry;panel.scale.set(panelW,panelH,1);
   panel.castShadow=true;panel.receiveShadow=true;panel.userData.raidOwned=true;root.add(panel);
  }
 }
 // Street-level doorways derived from the frozen block and window layers: a
 // recessed dark opening framed by masonry, an entry stoop, and a weathered
 // plank door hung ajar. The façade is chosen deterministically and the door
 // is centred in a verified gap between authored window openings, so trim never
 // overlaps a window. The shared doorway data also carries the stoop colliders.
 const doorwayWindows=uniqueWindowProps(world.props||[]).filter(p=>p.kind==='window');
 const doorwayList=[];let doorways=0;const doorwaySigns=[];
 for(const site of raidDoorwaySites(world)){
  const {face,onZ,x:ddx,z:ddz,y:doorBase,w:doorW,h:doorH,outX,outZ,awning:awn,doorHash,windows:doorWindows,top:blockTop}=site;
  const since=(sx,sy,sz)=>onZ?[sx,sy,sz]:[sz,sy,sx];
   // Dark recess and masonry trim.
   add('box',0x12191a,ddx,doorBase+doorH/2,ddz,...since(doorW,doorH,.08),0,'metal',0,0,false,'doorway');
   add('box',0x6c6a64,ddx,doorBase+doorH+.06,ddz,...since(doorW+.38,.12,.30),0,'concrete',0,0,false,'doorway');
   add('box',0x777368,ddx,doorBase-.05,ddz,...since(doorW+.38,.10,.30),0,'concrete',0,0,false,'doorway');
   for(const side of [-1,1]){
    add('box',0x6c6a64,ddx+(onZ?side*(doorW/2+.08):0),doorBase+doorH/2,ddz+(onZ?0:side*(doorW/2+.08)),...since(.16,doorH+.18,.30),0,'concrete',0,0,false,'doorway');
   }
   // A weathered plank door hangs slightly ajar on one jamb. The slab carries
   // five real board faces, iron hinge straps and a mounted handle so the timber
   // silhouette survives rain and dim light instead of reading as a flat box.
   const swing=(outZ||outX)*.24,cosSwing=Math.cos(swing),sinSwing=Math.sin(swing);
   const doorCX=ddx+outX*.12,doorCZ=ddz+outZ*.12,doorCY=doorBase+doorH/2-.06;
   // Wall-plane offset (along the door) to a point proud of the ajar face.
   const faceAt=(along,out)=>onZ
    ?[doorCX+along*cosSwing+outZ*out*sinSwing,doorCZ-along*sinSwing+outZ*out*cosSwing]
    :[doorCX+outX*out*cosSwing+along*sinSwing,doorCZ-outX*out*sinSwing+along*cosSwing];
   const doorH2=(doorH-.24)/2,doorW2=(doorW-.14)/2;
   add('box',0x1c120a,doorCX,doorCY,doorCZ,...since(doorW-.14,doorH-.24,.08),swing,'planks',0,0,false,'doorway');
   const bay=(doorW-.17)/5,boardTone=[0x5b4227,0x472f1c,0x664a2d];
   for(let i=0;i<5;i++){
    const along=-doorW2+bay*(.5+i),[bx,bz]=faceAt(along,.052);
    add('box',boardTone[i%3],bx,doorCY,bz,...since(bay-.006,doorH-.38,.02),swing,'planks',0,0,false,'doorBoard');
   }
   // Top and bottom rails pin the boards; three hinge straps plate the jamb.
   for(const dy of [-1,1]){const [bx,bz]=faceAt(0,.065);
    add('box',0x2d2116,bx,doorCY+dy*(doorH2-.06),bz,...since(doorW-.20,.055,.024),swing,'planks',0,0,false,'doorRail')}
   for(const dy of [-.32,0,.32]){const [bx,bz]=faceAt(-doorW2+.17,.072);
    add('box',0x5c615c,bx,doorCY+dy*doorH*.48,bz,...since(.34,.055,.028),swing,'metal',0,0,false,'doorIron')}
   const [hx,hz]=faceAt(doorW*.28,.10);
   add('box',0x44483f,hx,doorCY,hz,...since(.11,.26,.026),swing,'metal',0,0,false,'doorway');
   add('sphere',0xa9aca9,hx+(onZ?outZ*.018:outX*.018),doorCY,hz+(onZ?outZ*.018:outX*.018),.06,.06,.06,0,'metal',0,0,false,'doorway');
   // Timber-clad stoops: plank treads and riser faces over the masonry core. The
   // lived-in threshold now reads as timber boards rather than bare pale boxes.
   for(const [stepOut,stepY,stepW,stepD] of [[.34,doorBase-.26,doorW+.7,.68],[.22,doorBase-.14,doorW+.5,.46]]){
    const sx=ddx+outX*stepOut,sz=ddz+outZ*stepOut,top=stepY+.09;
    const rise=stepD/3+.004;
    for(let i=0;i<3;i++){const off=(i-1)*rise,px=sx+(onZ?0:off),pz=sz+(onZ?off:0);
     add('box',i===1?0x6e5537:i?0x5d472d:0x674e31,px,top+.021,pz,...since(stepW-.03,.042,stepD/3-.009),0,'planks',0,0,false,'doorStoop')}
    const riserX=sx+outX*(stepD/2+.012),riserZ=sz+outZ*(stepD/2+.012);
    add('box',0x5e472e,riserX,stepY,riserZ,...since(stepW-.03,.16,.018),0,'planks',0,0,false,'doorStoop');
    // A darker worn nose strip marks the front lip of the tread.
    add('box',0x4b3926,sx+outX*(stepD/2-.02),top+.023,sz+outZ*(stepD/2-.02),...since(stepW-.05,.028,.055),0,'planks',0,0,false,'doorStoop');
   }
   if(awn){
    const depth=.92,awW=doorW+1.1,awY=Math.min(doorBase+doorH+.38,blockTop-.22),awOut=.05+depth/2;
    add('box',0x7d5f42,ddx+outX*awOut,awY,ddz+outZ*awOut,...since(awW,.14,depth),0,'planks',onZ?outZ*.19:0,onZ?0:-outX*.19,false,'doorAwning');
    // A lighter outer fascia lip catches the key light, so the canopy reads as
    // a distinct silhouette instead of a shadow band above the doorway.
    add('box',0x9a7958,ddx+outX*(.05+depth-.02),awY-.07+outZ*.012,ddz+outZ*(.05+depth-.02)+outX*.012,...since(awW+.18,.16,.12),0,'planks',onZ?outZ*.19:0,onZ?0:-outX*.19,false,'doorAwning');
    // Exposed cross-ties under the boards read as a framed timber canopy from
    // beneath, where the player actually sees the awning at eye level.
    for(const inward of [.18,.50,.82]){
     const ax=ddx+outX*(.05+inward),az=ddz+outZ*(.05+inward);
     add('box',0x5a4329,onZ?ddx:ax,awY-.10,onZ?az:ddz,...since(awW-.14,.05,.055),0,'planks',0,0,false,'doorAwning');
    }
    for(const side of [-1,1]){
     add('box',0x6b5137,onZ?ddx+side*(awW/2-.3):ddx+outX*(.05+depth*.35),awY-.30,onZ?ddz+outZ*(.05+depth*.35):ddz+side*(awW/2-.3),...since(.12,.52,.12),0,'planks',0,0,false,'doorAwning');
     add('box',0x7b837d,onZ?ddx+side*(awW/2-.3):ddx+outX*.04,awY-.26,onZ?ddz+outZ*.04:ddz+side*(awW/2-.3),...since(.14,.40,.10),0,'metal',0,0,false,'doorAwning');
    }
   }
   if(awn)structureDetail.awningDoors=(structureDetail.awningDoors||0)+1;
   // Storefront blade signs: a thin painted board projects from the façade on a
   // short metal bracket, adding readable commercial silhouette above the door.
   // The board is centred on the door and edge-on to the wall, so it never
   // covers an authored window; a deterministic share of doors qualifies only
   // where the lintel/canopy leave at least 0.93 m of headroom below the roof.
   const awningTop=awn?Math.min(doorBase+doorH+.38,blockTop-.22)+.07:doorBase+doorH+.06;
   const signHash=hash01(doorHash*43.7+face*11.3);
   if(signHash<.44&&blockTop-awningTop>=.93){
    const teal=signHash<.22,panel=teal?0x4d6159:0x6b5238,band=teal?0xb9a878:0xc8a87b,frame=teal?0x6f7e7c:0x7b8580;
    const sy=awningTop+.50,sD=.84,sT=.07,sH=.60,sX=ddx+outX*.52,sZ=ddz+outZ*.52;
    add('box',panel,sX,sy,sZ,...since(sT,sH,sD),0,'planks',0,0,false,'facadeSign');
    // Faded paint bands and metal rail trim read as a weathered shop sign.
    add('box',band,sX+outX*.006,sy-.11,sZ+outZ*.006,...since(sT+.018,.12,sD*.58),0,'concrete',0,0,false,'facadeSign');
    add('box',band,sX+outX*.007,sy+.10,sZ+outZ*.007,...since(sT+.018,.07,sD*.72),0,'concrete',0,0,false,'facadeSign');
    add('box',frame,sX,sy+sH/2-.02,sZ,...since(sT+.03,.05,sD+.05),0,'metal',0,0,false,'facadeSign');
    add('box',frame,sX,sy-sH/2+.02,sZ,...since(sT+.03,.05,sD+.05),0,'metal',0,0,false,'facadeSign');
    // Corner rivets sit proud of the painted board on both blade faces.
    for(const along of [-.36,.36])for(const dy of [-.21,.21]){
     add('box',0xa7afa5,sX+(onZ?0:along*outX),sy+dy,sZ+(onZ?along*outZ:0),...since(.10,.055,.055),0,'metal',0,0,false,'facadeSign');
    }
    // Bracket arm and wall anchor plate; the arm passes above the canopy.
    add('box',frame,ddx+outX*.30,sy+.18,ddz+outZ*.30,...since(.10,.09,.60),0,'metal',0,0,false,'facadeSign');
    add('box',0x4b5657,ddx+outX*.05,sy-.02,ddz+outZ*.05,...since(.10,.34,.10),0,'metal',0,0,false,'facadeSign');
    doorwaySigns.push({x:sX,y:sy,z:sZ,face,onZ,outX,outZ,panel});
   }
   doorwayList.push({x:ddx,y:doorBase,z:ddz,face,onZ,outX,outZ,w:doorW,h:doorH,windows:doorWindows,awning:awn});
   doorways++;
 }
 structureDetail.doorways=doorways;root.userData.raidDoorways=doorwayList;
 structureDetail.facadeSigns=doorwaySigns.length;root.userData.raidFacadeSigns=doorwaySigns;
 // Façade weathering: rain/oxide streaks below dark windows, a ragged damp
 // foundation band and faded efflorescence drips beneath the cornice settle on
 // one deterministic wall plane. Every piece is a thin box proud of the masonry
 // so it can never z-fight, overlap window glass or door trim, and uses the
 // rock/concrete PBR maps plus normal maps. Presentation-only, derived from
 // frozen blocks and authored window props.
 const weatherList=[];let facadeStains=0;
 for(const block of world.blocks){
  const [x,z,w,d,h,y=0,kind='concrete']=block;
  if(y>.4||h<2.8||w<6||d<6)continue;
  if(kind!=='brick'&&kind!=='concrete'&&kind!=='planks'&&kind!=='metal')continue;
  const rust=kind==='metal';
  const weatherHash=hash01(x*29.7+z*67.3+world.id.length*4.1+h*7.9);
  if(weatherHash>=.62)continue;
  let face=-1,onZ=false,nx=0,nz=0,wallX=0,wallZ=0,span=0,wins=null,outX=0,outZ=0;
  for(let attempt=0;attempt<4;attempt++){
   const f=(Math.floor(hash01(weatherHash*9.17+x*2.1)*4)%4+attempt)%4;
   const oZ=f<2,nx2=f===2?-1:f===3?1:0,nz2=f===0?1:f===1?-1:0;
   const wx=oZ?x:x+nx2*w/2,wz=oZ?z:z+nz2*d/2;
   const onFace=doorwayWindows.filter(p=>{
    if(p.kind!=='window'||p.lit||p.y==null)return false;
    if(nx2)return Math.abs(p.x-(x+nx2*(w/2+.27)))<.8&&p.z>=z-d/2-.1&&p.z<=z+d/2+.1;
    return Math.abs(p.z-(z+nz2*(d/2+.27)))<.8&&p.x>=x-w/2-.1&&p.x<=x+w/2+.1;
   });
   if(onFace.length){face=f;onZ=oZ;nx=nx2;nz=nz2;wallX=wx;wallZ=wz;span=onZ?w:d;outX=onZ?0:nx2;outZ=onZ?nz2:0;wins=onFace;break}
  }
  if(face<0)continue;
  const since=(sx,sy,sz)=>onZ?[sx,sy,sz]:[sz,sy,sx];
  const roofY=y+h,streakCount=1+Math.floor(hash01(weatherHash*17.3+1.7)*3);
  wins.sort((a,b)=>(onZ?a.x:b.z)-(onZ?b.x:b.z));
  for(let i=0;i<Math.min(streakCount,wins.length);i++){
   const p=wins[i],along=(onZ?p.x:p.z)+(hash01(weatherHash*31.1+i*5.3)-.5)*.18;
   const top=Math.min(p.y-.10,roofY-.30),bot=Math.max(y+.30,top-(.55+hash01(weatherHash*7.7+i*3.1)*.9));
   if(top-bot<.28)continue;
   const sw=.15+hash01(weatherHash*11.9+i*2.7)*.13;
   add('box',rust?(i%2?0x9a6749:0x6f4a37):(i%2?0xb5ae9b:0x77806b),onZ?along:wallX+outX*.014,(top+bot)/2,onZ?wallZ+outZ*.014:along,...since(sw,top-bot,.024),0,rust?'concrete':i%2?'concrete':'rock',0,0,false,'facadeWeather');
  }
  // A ragged damp foundation instead of one flat slab: overlapping stains of
  // varying width and shallow height key the wall to the pavement above the plinth.
  for(let i=0;i<5;i++){
   const t=hash01(weatherHash*13.7+i*2.93),sw2=.55+t*.35,sh2=.18+hash01(weatherHash*5.3+i)*.38;
   const off=(i/4-.5)*Math.min(span*.55,2.4)+(hash01(weatherHash*7.1+i*1.9)-.5)*.16;
   add('box',rust?(i%2?0x6d4b36:0x563c2c):(i%2?0x59614e:0x495646),onZ?wallX+off:wallX+outX*.012,y+.37+sh2/2,onZ?wallZ+outZ*.012:wallZ+off,...since(sw2,sh2,.02),0,rust?'concrete':'rock',0,0,false,'facadeWeather');
  }
  // Faded efflorescence drips under the cornice weep onto the masonry; on metal
  // they read as zinc bloom and run-off instead of lime, so keep them dull.
  for(let i=0;i<4;i++){
   const t=hash01(weatherHash*23.9+i*3.1),sw2=.12+t*.16,sh2=.34+hash01(weatherHash*6.7+i)*.86;
   const off=(i/3-.5)*Math.min(span*.42,1.9)+(hash01(weatherHash*11.3+i)-.5)*.12,top=roofY-.22;
   add('box',rust?(i%2?0x8a8272:0x665f52):(i%2?0x928c78:0x616956),onZ?wallX+off:wallX+outX*.014,top-sh2/2,onZ?wallZ+outZ*.014:wallZ+off,...since(sw2,sh2,.02),0,'concrete',0,0,false,'facadeWeather');
  }
  weatherList.push({x:wallX,z:wallZ,y:y+.62,face,onZ,outX,outZ,span,h:roofY});
  facadeStains++;
 }
 structureDetail.facadeStains=facadeStains;root.userData.raidFacadeWeather=weatherList;
 // Façade utilities: corner downpipes and wall cabinets make the abandoned
 // blocks read as built, serviced infrastructure. Both placements are derived
 // from frozen blocks and authored window/door positions, use the same façade
 // coordinate logic as doors, and are presentation-only.
 const utilityList=[];let facadeUtilities=0,downpipes=0,utilityBoxes=0;
 for(const block of world.blocks){
  const [x,z,w,d,h,y=0,kind='concrete']=block;
  if(y>.4||h<3||w<6||d<6)continue;
  if(kind!=='brick'&&kind!=='concrete'&&kind!=='planks'&&kind!=='metal')continue;
  const uHash=hash01(x*41.3+z*73.9+world.id.length*5.1+h*2.7);
  const pipeShare=uHash<.40,boxShare=hash01(uHash*17.3+x*3.7-z*5.9)<.28;
  if(!pipeShare&&!boxShare)continue;
  facadeUtilities++;
  const face=Math.floor(hash01(uHash*5.13)*4)%4,onZ=face<2,nx=face===2?-1:face===3?1:0,nz=face===0?1:face===1?-1:0;
  const span=onZ?w:d,outX=onZ?0:nx,outZ=onZ?nz:0,wallX=onZ?x:x+nx*(w/2),wallZ=onZ?z+nz*(d/2):z;
  const since=(sx,sy,sz)=>onZ?[sx,sy,sz]:[sz,sy,sx];
  if(pipeShare){
   const side=hash01(uHash*11.1)>.5?1:-1,along=side*(span/2-.32);
   const pipeX=onZ?x+along:wallX+nx*.10,pipeZ=onZ?wallZ+nz*.10:z+along;
   add('box',0x5f5548,pipeX,y+.12+h*.5,pipeZ,...since(.20,h-.24,.22),0,'metal',0,0,false,'facadeUtility');
   // Two rust bands plus the floor shoe and roof elbow break the pipe into
   // readable weathered segments against the masonry.
   for(let i=0;i<2;i++){
    add('box',0x524130,pipeX,y+.32+h*(.24+.44*i),pipeZ,...since(.225,.16,.245),0,'metal',0,0,false,'facadeUtility');
   }
   add('box',0x574f45,pipeX+outX*.09,y+.20,pipeZ+outZ*.09,...since(.30,.30,.46),0,'metal',0,0,false,'facadeUtility');
   add('box',0x79735f,pipeX+outX*.26,y+h-.12,pipeZ+outZ*.26,...since(.22,.22,.62),0,'metal',onZ?outZ*.22:0,onZ?0:-outX*.22,false,'facadeUtility');
   for(let i=0;i<3;i++){
    add('box',0x8c8578,pipeX,y+.35+h*(.17+.31*i),pipeZ,...since(.15,.10,.26),0,'metal',0,0,false,'facadeUtility');
   }
   downpipes++;
   utilityList.push({kind:'downpipe',x:pipeX,z:pipeZ,face,onZ,y,height:h});
  }
  if(boxShare){
   const minA=(onZ?x:z)-span/2+.60,maxA=(onZ?x:z)+span/2-.60,occupied=[];
   for(const p of doorwayWindows){
    if(onZ){if(Math.abs(p.z-wallZ-nz*.27)<.75&&p.x>=x-w/2-.1&&p.x<=x+w/2+.1)occupied.push([p.x-(p.w||1.2)/2,p.x+(p.w||1.2)/2])}
    else if(Math.abs(p.x-wallX-nx*.27)<.75&&p.z>=z-d/2-.1&&p.z<=z+d/2+.1)occupied.push([p.z-(p.d||1.2)/2,p.z+(p.d||1.2)/2]);
   }
   for(const door of doorwayList){
    if(door.onZ!==onZ)continue;
    if(onZ&&Math.abs(door.z-wallZ)<.8)occupied.push([door.x-door.w/2,door.x+door.w/2]);
    if(!onZ&&Math.abs(door.x-wallX)<.8)occupied.push([door.z-door.w/2,door.z+door.w/2]);
   }
   occupied.sort((a,b)=>a[0]-b[0]);
   const gaps=[];let cursor=minA;
   for(const [s,e] of occupied){if(s-.35-cursor>=.95)gaps.push([cursor,s-.35]);cursor=Math.max(cursor,e+.35)}
   if(maxA-cursor>=.95)gaps.push([cursor,maxA]);
   if(gaps.length){
    gaps.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
    const gx=(gaps[0][0]+gaps[0][1])/2,boxX=onZ?x+gx:wallX+nx*.12,boxZ=onZ?wallZ+nz*.12:z+gx;
    const boxY=y+1.05,boxW=.82,boxH=.92;
    add('box',0x4a5450,boxX,boxY,boxZ,...since(boxW,boxH,.26),0,'metal',0,0,false,'facadeUtility');
    // Cabinet plate seam and faded hazard plate sit proud of the front plane so
    // they remain readable at night; the conduit rises to a small roof elbow.
    add('box',0x202724,boxX+outX*.14+(onZ?.18:0),boxY-.02,boxZ+outZ*.14+(onZ?0:.18),...since(.05,boxH*.72,.05),0,'metal',0,0,false,'facadeUtility');
    add('box',0xbfa96d,boxX+outX*.15,boxY+boxH*.26,boxZ+outZ*.15,...since(.30,.13,.04),0,'concrete',0,0,false,'facadeUtility');
    const conduitY=boxY+boxH*.5+.55;
    add('box',0x6b675d,boxX+outX*.14,conduitY,boxZ+outZ*.14,...since(.10,1.15,.10),0,'metal',0,0,false,'facadeUtility');
    add('box',0x6b675d,boxX+outX*.34,conduitY+.45,boxZ+outZ*.34,...since(.10,.10,.48),0,'metal',onZ?outZ*.2:0,onZ?0:-outX*.2,false,'facadeUtility');
    for(const dy of [-.22,.22]){
     add('box',0x8c8578,boxX+outX*.16,conduitY+dy,boxZ+outZ*.16,...since(.18,.10,.18),0,'metal',0,0,false,'facadeUtility');
    }
    utilityBoxes++;
    utilityList.push({kind:'cabinet',x:boxX,z:boxZ,face,onZ,y:boxY,height:boxH});
   }
  }
 }
 structureDetail.facadeUtilities=facadeUtilities;structureDetail.downpipes=downpipes;structureDetail.utilityBoxes=utilityBoxes;
 root.userData.raidFacadeUtilities=utilityList;
 // Metal halls read as clipped industrial siding rather than planks: slender
 // vertical ribs run the height of each face at a deterministic pitch, and a
 // horizontal belt ties them at mid-eave. The rib depth is real geometry (not a
 // texture swap) so daylight throws a fine highlight/shadow line down every
 // panel; all ribs share one instanced draw call.
 const sidingRibs=[];
 for(const block of world.blocks){
  const [x,z,w,d,h,y=0,kind='concrete']=block;
  if(kind!=='metal'||y>.4||h<2.8||w<5||d<5)continue;
  for(const side of ['n','s','e','w']){
   const along=(side==='n'||side==='s')?w:d;
   const count=Math.max(2,Math.min(6,Math.round(along/2.6)));
   for(let i=0;i<count;i++){
    const offset=(i+.5)/count*along-along/2;
    if(side==='n')add('box',0x667878,x+offset,y+.12+h*.5,z-d/2-.035,.075,h-.24,.07,0,'metal',0,0,false,'sidingRib');
    else if(side==='s')add('box',0x667878,x+offset,y+.12+h*.5,z+d/2+.035,.075,h-.24,.07,0,'metal',0,0,false,'sidingRib');
    else if(side==='e')add('box',0x667878,x+w/2+.035,y+.12+h*.5,z+offset,.07,h-.24,.075,0,'metal',0,0,false,'sidingRib');
    else add('box',0x667878,x-w/2-.035,y+.12+h*.5,z+offset,.07,h-.24,.075,0,'metal',0,0,false,'sidingRib');
   }
  }
  add('box',0x7c8d8c,x,y+.10+h*.52,z,w+.09,.11,d+.09,0,'metal',0,0,false,'sidingBelt');
  sidingRibs.push({x,z,w,d,h,y});
 }
 structureDetail.sidingRibs=sidingRibs.length;
 // Spawn dressing: a knot of drums and a supply crate on the apron beside each
 // insertion point. The shared list also lowers these into decor colliders, so
 // what the player sees matches what stops a body, bullet or machine leg.
 for(const item of raidSpawnDressing(world)){
  if(item.kind==='drum')drumProp(item.x,item.y,item.z,item.radius,item.height,item.color);
  else crateProp(item.x,item.y,item.z,item.w,item.h,item.d,item.color);
 }
 // Perimeter hills and warning posts frame the playable region without blocking routes.
 for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=Math.sin(angle)*(world.size/2+15),z=Math.cos(angle)*(world.size/2+15);add('cone',palette.rock,x,7,z,15,18,15,angle,'rock')}
 const sceneryCounts={};for(const item of scenery)sceneryCounts[item.kind]=(sceneryCounts[item.kind]||0)+1;
 root.userData.raidScenery={count:scenery.length,kinds:sceneryCounts};
 // One additive dust-sprite field supplies every warm practical halo. Because
 // all points share geometry and material, the entire glow budget is one draw
 // call; the parent group inherits scene fog so far lamps blend into the night.
 if(glowPositions.length){
  const glowGeometry=new THREE.BufferGeometry();
  glowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(glowPositions,3));
  glowGeometry.setAttribute('color',new THREE.Float32BufferAttribute(glowColors,3));
  glowGeometry.userData.raidOwned=true;
  const glowMaterial=new THREE.PointsMaterial({map:TX.soft,size:1.7,transparent:true,opacity:0,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,sizeAttenuation:true,fog:true});
  glowMaterial.userData.raidOwned=true;glowMaterial.userData.raidGlowBias=.9;
  // Fixture geometry (lamp head boxes, window quads) sits a few tenths of a
  // metre inside its own halo centre, so a plain depth test clips the glow.
  // Bias the sprite toward the camera by a small fixed distance: the fixture
  // no longer occludes its own bloom, while walls and ruins with real depth
  // separation still hide it. Depth writes remain off for additive blending.
  glowMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n {float glowDepth=-mvPosition.z;mvPosition.xyz*=max(1.0,glowDepth-.9)/max(glowDepth,1.0);gl_Position=projectionMatrix*mvPosition;}')};
  const glowPoints=new THREE.Points(glowGeometry,glowMaterial);
  glowPoints.frustumCulled=false;glowPoints.renderOrder=2;glowPoints.visible=false;glowPoints.userData.raidGlow=true;
  root.add(glowPoints);root.userData.raidGlowPoints=glowPoints;
 }
 // Ground light pools keep the practicals anchored to the street instead of
 // floating sparks. One instanced plane per lamp/campfire shares a single soft
 // radial additive material, so the whole pool budget remains one draw call.
 if(poolPositions.length){
  const poolGeometry=new THREE.PlaneGeometry(1,1);poolGeometry.rotateX(-Math.PI/2);poolGeometry.userData.raidOwned=true;
  const poolMaterial=new THREE.MeshBasicMaterial({map:TX.soft,color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  poolMaterial.userData.raidOwned=true;
  const poolMesh=new THREE.InstancedMesh(poolGeometry,poolMaterial,poolRadii.length);
  const poolPosition=new THREE.Vector3(),poolQuaternion=new THREE.Quaternion(),poolScale=new THREE.Vector3(),poolMatrix=new THREE.Matrix4(),poolColor=new THREE.Color(),poolUp=new THREE.Vector3(0,1,0),poolNormal=new THREE.Vector3();
  for(let i=0;i<poolRadii.length;i++){
   poolPosition.set(poolPositions[i*3],poolPositions[i*3+1],poolPositions[i*3+2]);
   // Ground pools follow the same terrain tangent plane as the wet glints, so
   // a lamp or campfire on a hillside casts a flush, ellipse-shaped pool rather
   // than a horizontal disc embedded in the slope.
   terrainNormalAt(world,poolPosition.x,poolPosition.z,poolNormal);
   poolQuaternion.setFromUnitVectors(poolUp,poolNormal);
   poolScale.set(poolRadii[i]*2,1,poolRadii[i]*2);
   poolMatrix.compose(poolPosition,poolQuaternion,poolScale);
   poolMesh.setMatrixAt(i,poolMatrix);
   poolColor.setRGB(poolColors[i*3],poolColors[i*3+1],poolColors[i*3+2]);
   poolMesh.setColorAt(i,poolColor);
  }
  poolMesh.instanceMatrix.needsUpdate=true;poolMesh.instanceColor.needsUpdate=true;
  poolMesh.frustumCulled=false;poolMesh.renderOrder=1;poolMesh.userData.raidGlowPools=true;
  root.add(poolMesh);root.userData.raidGlowPools=poolMesh;
 }
 // Wet-reflection companion field: the same practical fixtures but stretched
 // along a deterministic ground axis. One instanced additive draw call, with
 // the material opacity driven by RaidView's smoothed wetness state.
 if(reflectPositions.length){
  const glintGeometry=new THREE.PlaneGeometry(1,1);glintGeometry.rotateX(-Math.PI/2);glintGeometry.userData.raidOwned=true;
  const glintMaterial=new THREE.MeshBasicMaterial({map:wetGlintTexture(),color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,fog:true,forceSinglePass:true});
  glintMaterial.userData.raidOwned=true;glintMaterial.userData.raidOwnTexture=true;
  // Distant glints shrink toward a single filtered texel and shimmer as the
  // camera/point-of-view moves. Attenuate the additive colour when the
  // projected streak footprint is below roughly 2 px, while keeping near
  // streaks at full authored intensity. Resolution is fed by RaidView; the
  // shader is deterministic for a fixed camera, size and instance block.
  glintMaterial.onBeforeCompile=(shader,renderer)=>{
   // Seed from the live drawing buffer so the first compiled frame already has
   // the correct viewport height; RaidView refreshes it again on later frames.
   const buffer=renderer&&renderer.getDrawingBufferSize?renderer.getDrawingBufferSize(new THREE.Vector2()):new THREE.Vector2(1,1);
   shader.uniforms.uGlintResolution={value:new THREE.Vector2(Math.max(1,buffer.x||1),Math.max(1,buffer.y||1))};
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nuniform vec2 uGlintResolution;varying float vGlintFade;')
    .replace('#include <project_vertex>',`#include <project_vertex>
     float glintFade=1.;
     #ifdef USE_INSTANCING
      float focus=.5*uGlintResolution.y*projectionMatrix[1][1];
      float footprint=max(length(instanceMatrix[0].xyz),length(instanceMatrix[2].xyz))*focus/max(.001,-mvPosition.z);
      glintFade=smoothstep(.6,2.6,footprint);
     #endif
     vGlintFade=glintFade;`);
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\nvarying float vGlintFade;')
    .replace('#include <dithering_fragment>','#include <dithering_fragment>\n gl_FragColor.rgb*=vGlintFade;');
   glintMaterial.userData.raidGlintShader=shader;
  };
  const glintMesh=new THREE.InstancedMesh(glintGeometry,glintMaterial,reflectWidths.length);
  const glintPosition=new THREE.Vector3(),glintQuaternion=new THREE.Quaternion(),glintScale=new THREE.Vector3(),glintMatrix=new THREE.Matrix4(),glintColor=new THREE.Color(),glintAxis=new THREE.Vector3(0,1,0),glintUp=new THREE.Vector3(0,1,0),glintNormal=new THREE.Vector3(),glintTilt=new THREE.Quaternion(),glintSpin=new THREE.Quaternion();
  for(let i=0;i<reflectWidths.length;i++){
   const seed=Math.sin(reflectPositions[i*3]*12.9898+reflectPositions[i*3+2]*78.233)*43758.5453;
   const angle=(seed-Math.floor(seed))*Math.PI;
   glintPosition.set(reflectPositions[i*3],reflectPositions[i*3+1],reflectPositions[i*3+2]);
   // Tilt the quad's local +Y onto the sampled terrain normal, then spin it
   // around that normal. Streaks therefore lie flush on streets and hillsides
   // instead of intersecting the ground on sloped sectors.
   terrainNormalAt(world,glintPosition.x,glintPosition.z,glintNormal);
   glintTilt.setFromUnitVectors(glintUp,glintNormal);
   glintSpin.setFromAxisAngle(glintAxis,angle);
   glintQuaternion.multiplyQuaternions(glintTilt,glintSpin);
   glintScale.set(reflectWidths[i],1,reflectLengths[i]);
   glintMatrix.compose(glintPosition,glintQuaternion,glintScale);
   glintMesh.setMatrixAt(i,glintMatrix);
   glintColor.setRGB(reflectColors[i*3],reflectColors[i*3+1],reflectColors[i*3+2]).multiplyScalar(.82);
   glintMesh.setColorAt(i,glintColor);
  }
  glintMesh.instanceMatrix.needsUpdate=true;glintMesh.instanceColor.needsUpdate=true;
  glintMesh.frustumCulled=false;glintMesh.renderOrder=1;glintMesh.visible=false;glintMesh.userData.raidWetReflections=true;
  root.add(glintMesh);root.userData.raidWetReflections=glintMesh;
 }
 root.userData.raidWindMaterials=windMaterials;root.userData.raidWindowMaterials=windowMaterials;
 for(const {type,transforms,material,tag}of groups.values()){
  const geometry=geometries[type],mesh=new THREE.InstancedMesh(geometry,material,transforms.length);geometry.userData.raidOwned=true;mesh.castShadow=true;mesh.receiveShadow=true;if(tag&&tag!=='windowDark'&&!tag.startsWith(WLIT))mesh.userData.raidStructure=tag;for(let i=0;i<transforms.length;i++)mesh.setMatrixAt(i,transforms[i]);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.materials=materials;return root;
}
// Once the CC0 photographs are decoded, strip the old pale palette dye from the
// photographed surfaces. The map supplies the colour; the tint keeps only a
// small authored exposure difference so buildings do not all read identical.
const LUM=.2126;
export function applyPhotoLook(root){
 if(!root||root.userData.raidPhotoLook)return;
 root.userData.raidPhotoLook=true;
 for(const mat of root.userData.materials?.values()||[]){
  const surface=mat.userData.raidSurface;
  if(!PHOTO_SURFACES.has(surface)||mat.userData.raidStructure||mat.userData.raidAuthoredColor==null)continue;
  // Neutral exposure = the old tint's luminance. The legacy greyscale map was
  // effectively the photograph's luminance, so this keeps the scene's authored
  // brightness while the photograph now supplies hue (red brick, brown timber).
  const hex=mat.userData.raidAuthoredColor,r=(hex>>16&255)/255,g=(hex>>8&255)/255,b=(hex&255)/255;
  const lum=LUM*r+.7152*g+.0722*b,v=Math.max(70,Math.min(232,Math.round((lum*.94+.05)*255)));
  mat.color.setHex((v<<16)|(v<<8)|v);mat.needsUpdate=true;
 }
 const terrain=root.userData.raidTerrainMaterial,mesh=terrain&&root.children.find(m=>m.isMesh&&m.material===terrain);
 const colors=mesh?.geometry?.attributes?.color;
 // Terrain vertex colour is linear working space; use its luminance as a neutral
 // exposure so hills and verges keep their original shade and gain photo tint.
 if(colors)for(let i=0;i<colors.count;i++){const r=colors.getX(i),g=colors.getY(i),b=colors.getZ(i),v=Math.max(.18,Math.min(.5,LUM*r+.7152*g+.0722*b));colors.setXYZ(i,v,v,v);colors.needsUpdate=true}
 return root;
}
