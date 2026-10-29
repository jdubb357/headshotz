// v58b: detailed Royale loot chest kit (original procedural geometry, PBR wood + metal materials from the shared texture set).
// Geometry is built once, origin at the centre of the base on the ground; the lid is hinge-local (hinge at y=.5, z=-.36).
import {THREE,mergeParts,texMat,GQ} from './gfx.js';
export const CHEST_HINGE=[0,.5,-.36];
export const TIERC=[0xe6dcc0,0x3b9cff,0xb35cff,0xffb81c,0xff2b2b]; // chest tiers 0..3 = common/rare/epic/legendary, 4 = secret
let KIT=null;
const bx=(w,h,d,x,y,z,o={})=>({g:new THREE.BoxGeometry(w,h,d),p:[x,y,z],...o});
function halfDisc(r,len,seg){const sh=new THREE.Shape();sh.moveTo(-r,0);sh.absarc(0,0,r,Math.PI,0,true);sh.lineTo(-r,0);const g=new THREE.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false,curveSegments:seg});g.translate(0,0,-len/2);g.rotateY(Math.PI/2);return g}
function arc(r,tube,a,x,seg){const g=new THREE.TorusGeometry(r,tube,6,seg,a);g.rotateY(Math.PI/2);g.translate(x,0,0);return g} // arch over the lid, in the YZ plane
export function chestKit(){if(KIT)return KIT;
 const W=0xc08850,W2=0x9a6a3a,M=0x6b7078,D=0x34373c,G=0xd8b04a;const q=GQ.level==='low';
 const bodyW=[bx(1.1,.5,.7,0,.25,0,{c:W,uv:true,us:.55}),bx(1.0,.05,.62,0,.02,0,{c:W2,uv:true})];
 const bodyM=[];for(const sx of[-1,1])for(const sz of[-1,1])bodyM.push(bx(.1,.54,.1,sx*.52,.27,sz*.32,{c:M,uv:true}));
 bodyM.push(bx(1.16,.06,.76,0,.03,0,{c:D,uv:true}),bx(1.16,.05,.76,0,.475,0,{c:M,uv:true}));
 for(const sx of[-.3,.3])bodyM.push(bx(.1,.46,.02,sx,.25,.355,{c:M,uv:true}),bx(.1,.46,.02,sx,.25,-.355,{c:M,uv:true}));
 bodyM.push(bx(.2,.2,.04,0,.38,.365,{c:G,uv:true}),bx(.07,.09,.05,0,.36,.39,{c:D,uv:true}));
 for(const sx of[-.3,.3])for(const sy of[.08,.4])bodyM.push({g:new THREE.CylinderGeometry(.018,.018,.03,6),p:[sx,sy,.37],r:[Math.PI/2,0,0],c:G});
 const lidW=[{g:halfDisc(.36,1.1,q?8:16),p:[0,0,.36],c:W,uv:true,us:.55},bx(1.12,.05,.74,0,.025,.36,{c:W2,uv:true})];
 const lidM=[];for(const sx of[-.46,-.2,.2,.46]){lidM.push({g:arc(.37,.022,Math.PI,sx,q?8:14),p:[0,0,.36],c:M,uv:true})}
 lidM.push(bx(1.14,.06,.04,0,.03,.735,{c:M,uv:true}),bx(1.14,.06,.04,0,.03,-.015,{c:D,uv:true}),bx(.16,.14,.04,0,.04,.745,{c:G,uv:true}));
 for(const sx of[-.35,.35])lidM.push({g:new THREE.CylinderGeometry(.03,.03,.14,8),p:[sx,0,-.01],r:[0,0,Math.PI/2],c:D});
 const glow=[bx(1.1,.02,.02,0,.5,.355,{c:0xffffff}),bx(.02,.02,.7,-.545,.5,0,{c:0xffffff}),bx(.02,.02,.7,.545,.5,0,{c:0xffffff})];
 const inner=new THREE.PlaneGeometry(.96,.6);inner.rotateX(-Math.PI/2);inner.translate(0,.485,0);
 KIT={bodyW:mergeParts(bodyW,{uv:true}),bodyM:mergeParts(bodyM,{uv:true}),lidW:mergeParts(lidW,{uv:true}),lidM:mergeParts(lidM,{uv:true}),glow:mergeParts(glow),inner};
 return KIT}
export function chestMats(){return{wood:texMat('planks'),metal:texMat('metal')}}
