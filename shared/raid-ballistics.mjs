export const SHOT_EYE_HEIGHT=1.55;
// The ray parameter is horizontal distance; range/damage use true 3D distance.
export function intersectBody(origin,yaw,pitch,target,radius,height,range){
 const dx=Math.sin(yaw),dz=Math.cos(yaw),slope=Math.tan(pitch),x=origin.x-target.x,z=origin.z-target.z,b=x*dx+z*dz,d=b*b-(x*x+z*z-radius*radius);if(d<0)return null;
 let start=Math.max(0,-b-Math.sqrt(d)),end=Math.min(-b+Math.sqrt(d),range/Math.hypot(1,slope));
 const low=target.y||0,high=low+height;
 if(Math.abs(slope)<1e-10){if(origin.y<low||origin.y>high)return null}
 else{const a=(low-origin.y)/slope,c=(high-origin.y)/slope;start=Math.max(start,Math.min(a,c));end=Math.min(end,Math.max(a,c))}
 if(start>end||end<0)return null;
 return {x:origin.x+dx*start,y:origin.y+slope*start,z:origin.z+dz*start,distance:start*Math.hypot(1,slope)};
}
export function shotRays(yaw,pitch,stats,ordinal=1){
 if(!(stats.pellets>1))return [{yaw,pitch}];
 // Eight fixed-area pellets, rotated by the authoritative shot ordinal. A retry
 // uses the same accepted action, not a new client-selected random seed.
 return Array.from({length:stats.pellets},(_,i)=>{const angle=i*Math.PI/2+(i<4?0:Math.PI/4)+ordinal*2.399963229728653,radius=stats.spread*(i<4?1/3:1);return {yaw:yaw+Math.cos(angle)*radius,pitch:pitch+Math.sin(angle)*radius}});
}
export function distanceDamage(stats,distance){const start=stats.falloffStart??stats.range,minimum=stats.minDamageScale??1;return stats.damage*(distance<=start||start>=stats.range?1:Math.max(minimum,1-(1-minimum)*(distance-start)/(stats.range-start)))}
export function aimFieldOfView(base,stats){return Math.atan(Math.tan(base*Math.PI/360)/Math.max(1,stats?.zoom||1.3))*360/Math.PI}
function clipped(interval,start,delta,min,max){
 if(Math.abs(delta)<1e-12)return start>=min&&start<=max;
 const a=(min-start)/delta,b=(max-start)/delta;interval[0]=Math.max(interval[0],Math.min(a,b));interval[1]=Math.min(interval[1],Math.max(a,b));return interval[0]<=interval[1];
}
export function bulletClear(world,origin,point){
 const delta={x:point.x-origin.x,y:point.y-origin.y,z:point.z-origin.z};
 for(const [x,z,w,d,h,base=0]of world.blocks){const t=[0,1];if(clipped(t,origin.x,delta.x,x-w/2,x+w/2)&&clipped(t,origin.z,delta.z,z-d/2,z+d/2)&&clipped(t,origin.y,delta.y,base,base+h)&&t[1]>1e-7&&t[0]<1-1e-7)return false}
 for(const ramp of world.ramps||[]){const t=[0,1],slope=(ramp.to-ramp.from)/(ramp.axis==='x'?ramp.w:ramp.d),level=ramp.from+(ramp.to-ramp.from)*.5+slope*((ramp.axis==='x'?origin.x:origin.z)-(ramp.axis==='x'?ramp.x:ramp.z)),relativeDelta=delta.y-slope*(ramp.axis==='x'?delta.x:delta.z);
  if(clipped(t,origin.x,delta.x,ramp.x-ramp.w/2,ramp.x+ramp.w/2)&&clipped(t,origin.z,delta.z,ramp.z-ramp.d/2,ramp.z+ramp.d/2)&&clipped(t,origin.y-level,relativeDelta,-.12,0)&&t[1]>1e-7&&t[0]<1-1e-7)return false;
 }
 return true;
}
