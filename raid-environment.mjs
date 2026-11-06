import * as THREE from './lib/three.module.min.js';
import {getTex} from './gfx.js';
const palettes={industrial:{ground:0x6c7469,concrete:0x9ba0a0,brick:0x92968b,planks:0x8a6f52,roof:0x354951,metal:0x748889,container:0x426a72,rock:0x6d6a60,crate:0x9c7b4d,barrier:0xc6ab65},wilderness:{ground:0x6c795b,concrete:0x9d9d8f,brick:0x9a9a7e,planks:0x82684e,roof:0x455f5b,metal:0x7e9292,container:0x716645,rock:0x8a8777,crate:0x8d7850,barrier:0x9c956c},settlement:{ground:0x756a60,concrete:0x9f9b95,brick:0xb08063,planks:0x946f4f,roof:0x50505b,metal:0x7e8a90,container:0x6d5751,rock:0x766f64,crate:0x9b744a,barrier:0xc4a86e}};
const blockTex=kind=>kind==='metal'||kind==='roof'||kind==='container'?'metal':kind==='crate'?'crate':kind==='rock'?'rock':kind==='barrier'?'hazard':kind==='planks'?'planks':kind==='brick'?'brick':'concrete';
export function buildEnvironment(world){
 const root=new THREE.Group(),palette=palettes[world.theme]||palettes.industrial,groups=new Map(),materials=new Map();
 const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,10),sphere:new THREE.IcosahedronGeometry(1,1),cone:new THREE.ConeGeometry(1,1,8),ring:new THREE.TorusGeometry(1,.08,4,20)};
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),euler=new THREE.Euler();
 function add(type,color,x,y,z,sx,sy,sz,ry=0,texture='plain',rx=0){const key=type+'|'+color+'|'+texture;let group=groups.get(key);if(!group){
   const glow=texture==='glow',mat=new THREE.MeshStandardMaterial({color,roughness:.88,metalness:texture==='metal'?.4:0,map:glow?null:getTex(texture),...(glow?{emissive:color,emissiveIntensity:1.1}:{})});mat.userData.raidOwned=true;materials.set(key,mat);group={type,transforms:[],material:mat};groups.set(key,group);
  }
  position.set(x,y,z);scale.set(sx,sy,sz);euler.set(rx,ry,0);quaternion.setFromEuler(euler);matrix.compose(position,quaternion,scale);group.transforms.push(matrix.clone());
 }
 add('box',palette.ground,0,-.12,0,world.size,.2,world.size,0,world.theme==='wilderness'?'forest':'gravel');
 for(const [x,z,w,d,h,y=0,kind='concrete']of world.blocks)add('box',palette[kind]||palette.brick,x,y+h/2,z,w,h,d,0,blockTex(kind));
 for(const ramp of world.ramps||[]){const count=20;for(let i=0;i<count;i++){const t=(i+.5)/count,x=ramp.x+(ramp.axis==='x'?(t-.5)*ramp.w:0),z=ramp.z+(ramp.axis==='z'?(t-.5)*ramp.d:0),y=ramp.from+(ramp.to-ramp.from)*t;
  add('box',palette.metal,x,y-.08,z,ramp.axis==='x'?ramp.w/count:ramp.w,.16,ramp.axis==='z'?ramp.d/count:ramp.d,0,'metal');
  if(i%4===0)for(const side of [-1,1])add('box',palette.metal,x+(ramp.axis==='z'?side*ramp.w/2:0),y+.55,z+(ramp.axis==='x'?side*ramp.d/2:0),.1,1.1,.1);
 }}
 // Roads and lane paint establish readable routes through every district.
 for(const axis of ['x','z']){add('box',0x3e4546,0,.012,0,axis==='x'?world.size-4:7,.025,axis==='z'?world.size-4:7,0,'asphalt');for(let i=-world.size/2+8;i<world.size/2;i+=8)add('box',0xc8ba79,axis==='x'?i:0,.032,axis==='z'?i:0,axis==='x'?3:.12,.015,axis==='z'?3:.12)}
 for(const prop of world.props||[]){const{x,y=0,z,scale:s=1}=prop;
  if(prop.kind==='floor')add('box',prop.color||palette.ground,x,y,z,prop.w,.03,prop.d,0,'tiles');
  else if(prop.kind==='tree'){const leaf=prop.leaf||0x3c5745;add('cylinder',0x6b5842,x,y+1.5*s,z,.23*s,3*s,.23*s,0,'planks');for(let i=0;i<3;i++)add('cone',leaf,x,y+(3+i)*s,z,(2-i*.4)*s,3*s,(2-i*.4)*s)}
  else if(prop.kind==='bush'){const c=prop.color||0x3e9b4f;for(let i=0;i<3;i++)add('sphere',c,x+(i-1)*.55*s,y+(.7+i*.1)*s,z+(i%2?-.4:.3)*s,1.25*s,.85*s,1.1*s)}
  else if(prop.kind==='rock'){add('sphere',prop.color||0x8a8777,x,y+.55*s,z,1.5*s,.85*s,1.2*s,0,'rock',0)}
  else if(prop.kind==='barrel'){add('cylinder',prop.color||0x4b5344,x,y+.6*s,z,.5*s,1.3*s,.5*s,0,'metal');add('cylinder',0x1f2420,x,y+1.24*s,z,.52*s,.08*s,.52*s,0,'metal')}
  else if(prop.kind==='crate'){add('box',prop.color||0x9c7b4d,x,y+.55*s,z,1.15*s,1.1*s,1.15*s,0,'crate')}
  else if(prop.kind==='tank'){const c=prop.color||0x748889;add('cylinder',c,x,y+1.5*s,z,1.1*s,3*s,1.1*s,0,'metal');add('sphere',c,x,y+3*s,z,1.1*s,.55*s,1.1*s,0,'metal');add('box',0x4d5f63,x,y+.25,z,2.5*s,.3*s,2.5*s,0,'metal')}
  else if(prop.kind==='tent'){add('cone',prop.color||0x8a9b7a,x,y+1.25*s,z,1.7*s,2.5*s,1.7*s)}
  else if(prop.kind==='campfire'){add('cylinder',0x5a4632,x,y+.12,z,.75*s,.18*s,.75*s,0,'rock');add('sphere',prop.color||0xffb64d,x,y+.42*s,z,.42*s,.55*s,.42*s,0,'glow');add('box',0x3e342c,x,y+.1,z,1.1*s,.12*s,.16*s,0,'planks',0,Math.PI/5)}
  else if(prop.kind==='car'){add('box',prop.color||0x647082,x,y+.5*s,z,2.2*s,1*s,1.1*s,0,'metal');add('box',prop.color||0x647082,x-.1*s,y+1.25*s,z,.9*s,.55*s,.95*s,0,'metal');for(const sx of [-1,1])for(const sz of [-1,1])add('cylinder',0x1f2420,x+sx*.7*s,y+.28*s,z+sz*.45*s,.24*s,.5*s,.24*s,0,'metal')}
  else if(prop.kind==='scrap'){add('box',0x536368,x,.45,z,1.8,.9,1.2,.3,'metal');add('cylinder',0x977d58,x+.5,.8,z,.4,1.2,.4,0,'metal')}
  else if(prop.kind==='dish'){add('sphere',0xbdc5b6,x,y+1.2,z,2.8,.5,2.8,0,'metal');add('box',0x415259,x,y+2,z,.2,3,.2)}
  else if(prop.kind==='turbine'){add('cylinder',0x7d8b87,x,y+1.1,z,1,2.2,1,0,'metal');for(let i=0;i<4;i++)add('box',0x424d52,x+Math.sin(i*Math.PI/2)*1.7,y+2.3,z+Math.cos(i*Math.PI/2)*1.7,.65,.18,3,i*Math.PI/2,'metal')}
  else if(prop.kind==='waterTower'){for(const sx of [-1.3,1.3])for(const sz of [-1.3,1.3])add('box',0x687d7b,x+sx,3,z+sz,.25,6,.25);add('cylinder',0x8d9b8a,x,6.5,z,2.2,3,2.2,0,'metal');add('cone',0x435754,x,8.5,z,2.4,1.2,2.4)}
  else if(prop.kind==='pump'){add('box',0x79918a,x,1,z,4,2,2,0,'metal');for(const side of [-1,1])add('cylinder',0x3e5156,x+side*2,.65,z,.4,5,.4,0,'metal',Math.PI/2)}
  else if(prop.kind==='basin')add('box',0x547776,x,y,z,prop.w,.03,prop.d,0,'tiles');
  else if(prop.kind==='rail'){for(const side of [-1,1])add('box',0x6c7778,x,y+.1,z+side*.8,prop.w,.2,.12,0,'metal');for(let i=-prop.w/2;i<prop.w/2;i+=2)add('box',0x5d4b3d,x+i,y+.02,z,.3,.14,2.6,0,'planks')}
  else if(prop.kind==='signal'){add('cylinder',0x53646a,x,2.4,z,.12,4.8,.12);add('box',0x29383d,x,4.4,z,.65,1.2,.4);add('sphere',0xc67b4e,x,4.5,z+.25,.18,.18,.1)}
  else if(prop.kind==='floodlight'){add('cylinder',0x3e4c53,x,y+3.2,z,.16,6.4,.16,0,'metal');add('box',0xf4e3ac,x,y+6.4,z,1.4,.2,.7,0,'glow')}
  else if(prop.kind==='crane'){add('box',0x4d5f63,x,y+2,z,.5,4,.5,0,'metal');add('box',0x4d5f63,x+8,y+4,z,.5,.35,9,0,'metal');add('box',0x2c3a40,x+12,y+3.4,z,.15,1.2,.15,0,'metal');add('box',0xa08a59,x+8,y+3.8,z,3,.18,.5,0,'metal')}
  else if(prop.kind==='antenna'){add('cylinder',0x5f7075,x,y+7,z,.2,14,.2,0,'metal');add('box',0x26363b,x,y+12,z,2.4,.24,.24,0,'metal');add('sphere',0xdf6b4e,x,y+13,z,.35,.35,.35,0,'glow')}
  else if(prop.kind==='wreck'){add('box',0x3d302c,x,y+.8,z,6,1.4,2.4,0,'metal');add('box',0x6e4c38,x+1.6,y+1.6,z-.4,2.6,.4,1.6,0,'metal');add('cylinder',0x24201f,x-1.8,y+.5,z+.9,.45,.6,.45,0,'metal');add('box',0x3f4446,x+2.4,y+1.1,z+.2,2.2,.5,2.2,0,'metal')}
  else if(prop.kind==='road'||prop.kind==='sidewalk'||prop.kind==='plaza'){
   const color=prop.kind==='sidewalk'?0x9e9a90:prop.kind==='plaza'?0x7a7264:0x34393b;
   add('box',color,x,y,z,prop.w,.024,prop.d,prop.ry||0,prop.kind==='road'?'asphalt':prop.kind==='plaza'?'tiles':'concrete');
  }
  else if(prop.kind==='crosswalk'){
   const n=5,step=prop.w/(n*2.2);
   for(let i=0;i<n;i++)add('box',0xded7b5,x-prop.w/2+step*(i+.5)*2.2,y,z,prop.w/(n*3),.03,prop.d,0,'concrete');
  }
  else if(prop.kind==='window'){
   const w=prop.w||.16,d=prop.d||1.15,h=prop.h||1.3;
   add('box',prop.lit&&prop.color!=null?prop.color:0x11191d,x,y+h/2,z,w,h,d,0,prop.lit?'glow':'metal');
  }
  else if(prop.kind==='awning'){add('box',prop.color||0x8d382e,x,y+.18,z,prop.w||3,0.14,prop.d||2,0,'metal')}
  else if(prop.kind==='powerPole'){add('cylinder',0x384349,x,y+3,z,.13,6,.13,0,'metal');add('box',0x384349,x,y+5.7,z,2.2,.16,.16,0,'metal');for(const s of [-.9,.9])add('sphere',0xd8d5c8,x+s,y+6.1,z,.13,.13,.13,0,'metal')}
  else if(prop.kind==='sandbag'){const s=prop.scale||1;for(const [dx,dy,dz] of [[0,0,0],[.38,0,.08],[.18,.34,.24],[.55,.34,.02]])add('box',0xb6a57a,x+dx*s,y+dy*s,z+dz*s,.52*s,.28*s,.36*s,0,'concrete')}
  else if(prop.kind==='checkpoint'){const s=prop.scale||1;add('box',0x77725f,x,y+1.15*s,z,3.4*s,2.3*s,2.4*s,0,'concrete');add('box',0x2d3336,x,y+2.42*s,z,3.6*s,.16*s,2.6*s,0,'metal');add('box',0xf0d18b,x,y+2.32*s,z,.8*s,.16*s,.8*s,0,'glow')}
  else if(prop.kind==='lamp'){add('cylinder',0x2d3436,x,y+2.3,z,.1,4.6,.1,0,'metal');add('box',0x2d3436,x,y+4.65,z,.7,.1,.1,0,'metal');add('box',0xffe4a3,x,y+4.76,z,.34,.16,.34,0,'glow')}
  else if(prop.kind==='bench'){add('box',0xb07a45,x,y+.45,z,2.1,.12,.45,0,'planks');add('box',0xb07a45,x,y+.66,z-.18,2.1,.32,.08,0,'planks');for(const s of [-.8,.8])add('box',0x31383c,x+s,y+.2,z,.08,.4,.4,0,'metal')}
  else if(prop.kind==='dumpster'){const s=prop.scale||1,c=prop.color||0x4e6550;add('box',c,x,y+.7*s,z,2.1*s,1.4*s,1.25*s,0,'metal');add('box',0x333d3f,x,y+1.42*s,z,2.15*s,.1*s,1.3*s,0,'metal');for(const s2 of [-.7,.7])add('cylinder',0x1f2420,x+s2*s,y+.22*s,z+.52*s,.2*s,.2*s,.2*s,0,'metal')}
  else if(prop.kind==='sign'){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#25373c';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#ddbe7e';ctx.lineWidth=8;ctx.strokeRect(4,4,504,88);ctx.fillStyle='#f2e3bc';ctx.font='bold 38px system-ui';ctx.textAlign='center';ctx.fillText(prop.name.toUpperCase(),256,62,480);
   const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture});material.userData.raidOwned=true;material.userData.raidOwnTexture=true;const sprite=new THREE.Sprite(material);sprite.position.set(x,y,z);sprite.scale.set(7,1.32,1);root.add(sprite);
  }
 }
 // Perimeter hills and warning posts frame the playable region without blocking routes.
 for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=Math.sin(angle)*(world.size/2+15),z=Math.cos(angle)*(world.size/2+15);add('cone',palette.rock,x,7,z,15,18,15,angle,'rock')}
 for(const {type,transforms,material}of groups.values()){
  const geometry=geometries[type],mesh=new THREE.InstancedMesh(geometry,material,transforms.length);geometry.userData.raidOwned=true;for(let i=0;i<transforms.length;i++)mesh.setMatrixAt(i,transforms[i]);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.materials=materials;return root;
}
