import * as THREE from './lib/three.module.min.js';
import {getTex} from './gfx.js';
const palettes={industrial:{ground:0x6c7469,brick:0x92968b,roof:0x354951,metal:0x748889,container:0x426a72,rock:0x6d6a60,crate:0x9c7b4d,barrier:0xc6ab65},wilderness:{ground:0x6c795b,brick:0x9a9a7e,roof:0x455f5b,metal:0x7e9292,container:0x716645,rock:0x8a8777,crate:0x8d7850,barrier:0x9c956c},settlement:{ground:0x756a60,brick:0xb08063,roof:0x50505b,metal:0x7e8a90,container:0x6d5751,rock:0x766f64,crate:0x9b744a,barrier:0xc4a86e}};
export function buildEnvironment(world){
 const root=new THREE.Group(),palette=palettes[world.theme]||palettes.industrial,groups=new Map(),materials=new Map();
 const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,10),sphere:new THREE.IcosahedronGeometry(1,1),cone:new THREE.ConeGeometry(1,1,8),ring:new THREE.TorusGeometry(1,.08,4,20)};
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),euler=new THREE.Euler();
 function add(type,color,x,y,z,sx,sy,sz,ry=0,texture='plain',rx=0){const key=type+'|'+color+'|'+texture;let group=groups.get(key);if(!group){
   const mat=new THREE.MeshStandardMaterial({color,roughness:.88,metalness:texture==='metal'?.4:0,map:getTex(texture)});mat.userData.raidOwned=true;materials.set(key,mat);group={type,transforms:[],material:mat};groups.set(key,group);
  }
  position.set(x,y,z);scale.set(sx,sy,sz);euler.set(rx,ry,0);quaternion.setFromEuler(euler);matrix.compose(position,quaternion,scale);group.transforms.push(matrix.clone());
 }
 add('box',palette.ground,0,-.12,0,world.size,.2,world.size,0,world.theme==='wilderness'?'forest':'gravel');
 for(const [x,z,w,d,h,y=0,kind='concrete']of world.blocks)add('box',palette[kind]||palette.brick,x,y+h/2,z,w,h,d,0,['metal','roof','container'].includes(kind)?'metal':kind==='crate'?'crate':kind==='rock'?'rock':'brick');
 for(const ramp of world.ramps||[]){const count=20;for(let i=0;i<count;i++){const t=(i+.5)/count,x=ramp.x+(ramp.axis==='x'?(t-.5)*ramp.w:0),z=ramp.z+(ramp.axis==='z'?(t-.5)*ramp.d:0),y=ramp.from+(ramp.to-ramp.from)*t;
  add('box',palette.metal,x,y-.08,z,ramp.axis==='x'?ramp.w/count:ramp.w,.16,ramp.axis==='z'?ramp.d/count:ramp.d,0,'metal');
  if(i%4===0)for(const side of [-1,1])add('box',palette.metal,x+(ramp.axis==='z'?side*ramp.w/2:0),y+.55,z+(ramp.axis==='x'?side*ramp.d/2:0),.1,1.1,.1);
 }}
 // Roads and lane paint establish readable routes through every district.
 for(const axis of ['x','z']){add('box',0x3e4546,0,.012,0,axis==='x'?world.size-4:7,.025,axis==='z'?world.size-4:7,0,'asphalt');for(let i=-world.size/2+8;i<world.size/2;i+=8)add('box',0xc8ba79,axis==='x'?i:0,.032,axis==='z'?i:0,axis==='x'?3:.12,.015,axis==='z'?3:.12)}
 for(const prop of world.props||[]){const{x,y=0,z,scale:s=1}=prop;
  if(prop.kind==='floor')add('box',prop.color||palette.ground,x,y,z,prop.w,.03,prop.d,0,'tiles');
  else if(prop.kind==='tree'){add('cylinder',0x6b5842,x,y+1.5*s,z,.23*s,3*s,.23*s,0,'planks');for(let i=0;i<3;i++)add('cone',0x3c5745,x,y+(3+i)*s,z,(2-i*.4)*s,3*s,(2-i*.4)*s)}
  else if(prop.kind==='scrap'){add('box',0x536368,x,.45,z,1.8,.9,1.2,.3,'metal');add('cylinder',0x977d58,x+.5,.8,z,.4,1.2,.4,0,'metal')}
  else if(prop.kind==='dish'){add('sphere',0xbdc5b6,x,y+1.2,z,2.8,.5,2.8,0,'metal');add('box',0x415259,x,y+2,z,.2,3,.2)}
  else if(prop.kind==='turbine'){add('cylinder',0x7d8b87,x,y+1.1,z,1,2.2,1,0,'metal');for(let i=0;i<4;i++)add('box',0x424d52,x+Math.sin(i*Math.PI/2)*1.7,y+2.3,z+Math.cos(i*Math.PI/2)*1.7,.65,.18,3,i*Math.PI/2,'metal')}
  else if(prop.kind==='waterTower'){for(const sx of [-1.3,1.3])for(const sz of [-1.3,1.3])add('box',0x687d7b,x+sx,3,z+sz,.25,6,.25);add('cylinder',0x8d9b8a,x,6.5,z,2.2,3,2.2,0,'metal');add('cone',0x435754,x,8.5,z,2.4,1.2,2.4)}
  else if(prop.kind==='pump'){add('box',0x79918a,x,1,z,4,2,2,0,'metal');for(const side of [-1,1])add('cylinder',0x3e5156,x+side*2,.65,z,.4,5,.4,0,'metal',Math.PI/2)}
  else if(prop.kind==='basin')add('box',0x547776,x,y,z,prop.w,.03,prop.d,0,'tiles');
  else if(prop.kind==='rail'){for(const side of [-1,1])add('box',0x6c7778,x,y+.1,z+side*.8,prop.w,.2,.12,0,'metal');for(let i=-prop.w/2;i<prop.w/2;i+=2)add('box',0x5d4b3d,x+i,y+.02,z,.3,.14,2.6,0,'planks')}
  else if(prop.kind==='signal'){add('cylinder',0x53646a,x,2.4,z,.12,4.8,.12);add('box',0x29383d,x,4.4,z,.65,1.2,.4);add('sphere',0xc67b4e,x,4.5,z+.25,.18,.18,.1)}
  else if(prop.kind==='lamp'){add('box',0xf6ddac,x,y,z,1.2,.12,.25)}
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
