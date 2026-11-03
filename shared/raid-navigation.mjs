import {blocked,floorAt,rampLevel,supportAt} from './raid-worlds.mjs';
const caches=new WeakMap();
function navigationCache(world,step,radius,height){
 const signature=JSON.stringify([world.size,world.blocks,world.ramps||[]]);let cached=caches.get(world);if(!cached||cached.signature!==signature){cached={signature,profiles:new Map()};caches.set(world,cached)}
 const key=[step,radius,height].join(':');let profile=cached.profiles.get(key);if(!profile){if(cached.profiles.size>=16)cached.profiles.delete(cached.profiles.keys().next().value);profile={levels:new Map(),edges:new Map()};cached.profiles.set(key,profile)}return profile;
}
class Heap {
 constructor(){this.items=[]}
 push(value){const a=this.items;a.push(value);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].score<=value.score)break;a[i]=a[p];i=p}a[i]=value}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].score<a[j].score)j++;if(a[j].score>=last.score)break;a[i]=a[j];i=j}a[i]=last}return first}
 get length(){return this.items.length}
}
function levels(world,x,z,radius,height){
 const values=[0];
 for(const [bx,bz,w,d,h,base=0]of world.blocks)if(Math.abs(x-bx)<=w/2&&Math.abs(z-bz)<=d/2)values.push(base+h);
 for(const ramp of world.ramps||[]){const y=rampLevel(ramp,x,z),clear=ramp.axis==='x'?Math.abs(z-ramp.z)<=ramp.d/2-radius:Math.abs(x-ramp.x)<=ramp.w/2-radius;if(y!=null&&clear)values.push(y)}
 return [...new Set(values.map(y=>Math.round(y*100)/100))].filter(y=>!blocked(world,x,z,radius,y,height));
}
function stableFloorPoint(world,point){
 const p={...point};for(const [x,z,w,d,h,base=0]of world.blocks)if(Math.abs(p.y-base-h)<.015&&Math.abs(p.x-x)<=w/2+.001&&Math.abs(p.z-z)<=d/2+.001){
  if(Math.abs(Math.abs(p.x-x)-w/2)<.001)p.x+=Math.sign(x-p.x)*.03;
  if(Math.abs(Math.abs(p.z-z)-d/2)<.001)p.z+=Math.sign(z-p.z)*.03;
 }return p;
}
export function canWalkSegment(world,a,b,{radius=.4,height=1.7}={}){
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4));let x=a.x,z=a.z,y=supportAt(world,a.x,a.z,(a.y||0)+.65,radius),valid=true;
  for(let i=1;i<=count;i++){
   const nx=a.x+(b.x-a.x)*i/count,nz=a.z+(b.z-a.z)*i/count,xf=Math.max(supportAt(world,nx,z,y+.65,radius),floorAt(world,nx+Math.sign(nx-x)*radius,z,y+.65)),zf=Math.max(supportAt(world,nx,nz,y+.65,radius),floorAt(world,nx,nz+Math.sign(nz-z)*radius,y+.65));
   if(nx!==x&&blocked(world,nx,z,radius,Math.max(y,xf),height)||nz!==z&&blocked(world,nx,nz,radius,Math.max(y,zf),height)){valid=false;break}
   const floor=supportAt(world,nx,nz,y+.65,radius);if(floor-y>.6||y-floor>.7){valid=false;break}x=nx;z=nz;y=floor;
  }
  return valid&&Math.abs(y-(b.y||0))<.15;
}
export function findPath(world,from,to,{step=world.version===2?1:2,radius=.4,height=1.7,maxNodes=world.version===2?40000:16000}={}){
 const cache=navigationCache(world,step,radius,height),at=(x,z)=>{const key=x+':'+z;if(!cache.levels.has(key))cache.levels.set(key,levels(world,x,z,radius,height));return cache.levels.get(key)};
 const offset=world.version===2?.5:0,key=p=>`${p.x},${p.z},${p.y}`,snap=v=>Math.round((v-offset)/step)*step+offset;
 function reachable(a,b,memo=false){
  const edge=key(a)+'>'+key(b);if(memo&&cache.edges.has(edge))return cache.edges.get(edge);const valid=canWalkSegment(world,a,b,{radius,height});if(memo)cache.edges.set(edge,valid);return valid;
 }
 function nearest(point){let best=null,score=Infinity;for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
  const x=snap(point.x)+dx*step,z=snap(point.z)+dz*step;
  for(const y of at(x,z))if(Math.abs(y-(point.y||0))<=.8){const cost=Math.hypot(x-point.x,z-point.z)+Math.abs(y-(point.y||0))*3;if(cost<score&&reachable(point,{x,y,z})){score=cost;best={x,y,z}}}
 }return best}
 const start=nearest(from),goal=nearest(to);if(!start||!goal)return [];
 const heap=new Heap(),cost=new Map([[key(start),0]]),parents=new Map(),nodes=new Map([[key(start),start]]),closed=new Set();
 const heuristic=p=>Math.abs(p.x-goal.x)+Math.abs(p.z-goal.z)+Math.abs(p.y-goal.y)*2;
 heap.push({key:key(start),score:heuristic(start)});let visited=0;
 while(heap.length&&visited++<maxNodes){
  const current=heap.pop();if(closed.has(current.key))continue;closed.add(current.key);const p=nodes.get(current.key);
  if(current.key===key(goal)){
   const path=[];let k=current.key;while(k){path.push(nodes.get(k));k=parents.get(k)}path.reverse();
   if(!blocked(world,to.x,to.z,radius,to.y||0,height)&&Math.hypot(path.at(-1).x-to.x,path.at(-1).z-to.z)>0.1){if(!reachable(path.at(-1),to))return [];path.push({x:to.x,y:to.y||0,z:to.z})}return path.map(p=>stableFloorPoint(world,p));
  }
  for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){
   const x=p.x+dx,z=p.z+dz;if(Math.abs(x)>world.size/2-radius||Math.abs(z)>world.size/2-radius)continue;
   for(const y of at(x,z)){
    if(Math.abs(y-p.y)>.7)continue;
    const middleY=floorAt(world,(x+p.x)/2,(z+p.z)/2,Math.max(y,p.y)+.05);
    if(blocked(world,(x+p.x)/2,(z+p.z)/2,radius,Math.max(middleY,Math.min(y,p.y)),height)||!reachable(p,{x,y,z},true))continue;
    const next={x,y,z},k=key(next),value=cost.get(current.key)+step+Math.abs(y-p.y)*2;
    if(value>=(cost.get(k)??Infinity))continue;cost.set(k,value);parents.set(k,current.key);nodes.set(k,next);heap.push({key:k,score:value+heuristic(next)});
   }
  }
 }
 return [];
}
export function safePoint(world,x,z,{radius=.5,y=0,height=1.7,avoid=[],distance=4}={}){
 for(let ring=0;ring<16;ring++)for(let i=0;i<Math.max(1,ring*8);i++){
  const angle=i/Math.max(1,ring*8)*Math.PI*2,px=x+Math.cos(angle)*ring,pz=z+Math.sin(angle)*ring,py=floorAt(world,px,pz,y+.65);
  if(!blocked(world,px,pz,radius,py,height)&&avoid.every(a=>Math.hypot(px-a.x,pz-a.z)>=distance))return {x:px,y:py,z:pz};
 }
 return null;
}
