export const UTILITIES={
 smoke:{name:'Ashveil Canister',price:45,weight:.5,radius:4,duration:18,fuse:.8,description:'Throws an opaque smoke screen. It blocks machine sight and distant enemy identification, but bullets still pass through. Allies keep squad markers.'},
 decoy:{name:'Scrapchatter Lure',price:35,weight:.4,radius:32,duration:12,fuse:.5,description:'Throws a pulsing noise lure. Machines without a visible target investigate it; it does not override a machine already watching an operator.'},
 frag:{name:'Shatter Charge',price:65,weight:.7,radius:4,duration:.5,fuse:1.5,description:'Throws a delayed explosive with distance falloff and cover protection. It can injure you; squadmates are protected. Machines take armor-aware damage.'}
};
// Segment/sphere occlusion, independent of rendering. Walls are checked by the
// caller. Smoke obscures sight, not bullet collision or inventory interactions.
export function smokeClear(effects,from,to,now){
 const dx=to.x-from.x,dy=(to.y||0)-(from.y||0),dz=to.z-from.z,length=dx*dx+dy*dy+dz*dz;
 return !(effects||[]).some(e=>{
  if(e.kind!=='smoke'||now<e.activeAt||now>=e.until)return false;
  const cx=e.x,cy=(e.y||0)+1.5,cz=e.z,t=length?Math.max(0,Math.min(1,((cx-from.x)*dx+(cy-(from.y||0))*dy+(cz-from.z)*dz)/length)):0;
  return Math.hypot(from.x+dx*t-cx,(from.y||0)+dy*t-cy,from.z+dz*t-cz)<e.radius;
 });
}
