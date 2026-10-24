// HeadShotz arsenal: stats + procedural low-poly weapon models. Everything free/unlocked.
import {THREE,G} from './gfx.js';
export const CLASSES=[
 {id:'ar',name:'Assault Rifles',slot:0},{id:'smg',name:'SMGs',slot:0},{id:'sniper',name:'Snipers',slot:0},{id:'marksman',name:'Marksman Rifles',slot:0},
 {id:'shotgun',name:'Shotguns',slot:0},{id:'pistol',name:'Pistols',slot:1},{id:'melee',name:'Melee & Knives',slot:2},{id:'util',name:'Utilities',slot:3}];
// body/head = per bullet (per pellet for shotguns) close range. fall=[start,end] metres, min=body dmg at end. rc=[vertical kick rad, horizontal sway]
export const W={
 ar:{name:'Assault Rifle',cls:'ar',auto:1,rate:.1,mag:30,reload:1.8,body:12,head:15,fall:[20,60],min:4,spread:.012,rc:[.012,.006],snd:{f:1900,d:.11,b:150,v:.55},desc:'Reliable full-auto starter rifle.'},
 bullpup:{name:'Bullpup Carbine',cls:'ar',auto:1,rate:.08,mag:32,reload:2,body:10,head:13,fall:[18,55],min:3,spread:.011,rc:[.009,.007],snd:{f:2300,d:.09,b:170,v:.5},desc:'Fast-firing compact rifle, lower damage.'},
 battle:{name:'Battle Rifle',cls:'ar',auto:1,rate:.15,mag:20,reload:2.2,body:18,head:26,fall:[30,80],min:7,spread:.01,rc:[.02,.008],snd:{f:1400,d:.15,b:110,v:.65},desc:'Heavy hitting, slower, kicks hard.'},
 smg:{name:'Uzi',cls:'smg',auto:1,rate:.065,mag:32,reload:1.6,body:9,head:12,fall:[12,35],min:3,spread:.03,rc:[.008,.012],snd:{f:2600,d:.06,b:200,v:.45},desc:'Classic spray-and-pray SMG.'},
 vector:{name:'Viper SMG',cls:'smg',auto:1,rate:.05,mag:30,reload:1.7,body:8,head:11,fall:[10,30],min:2,spread:.026,rc:[.006,.008],snd:{f:2900,d:.05,b:210,v:.42},desc:'Insane fire rate, melts up close.'},
 pdw:{name:'PDW-40',cls:'smg',auto:1,rate:.08,mag:40,reload:2.1,body:11,head:14,fall:[16,45],min:3,spread:.02,rc:[.007,.006],snd:{f:2400,d:.07,b:180,v:.45},desc:'Big top-loaded mag, steady recoil.'},
 sniper:{name:'Bolt Sniper',cls:'sniper',rate:1.2,mag:5,reload:2.4,body:50,head:150,spread:.04,scope:22,rc:[.06,.01],snd:{f:900,d:.35,b:70,v:.8,crack:1},desc:'One headshot, one elimination. No falloff.'},
 heavy:{name:'Heavy Sniper',cls:'sniper',rate:1.8,mag:3,reload:3,body:70,head:200,spread:.05,scope:18,rc:[.09,.015],snd:{f:700,d:.45,b:55,v:.9,crack:1},desc:'Huge damage, slow bolt, small mag.'},
 light:{name:'Light Sniper',cls:'sniper',rate:.7,mag:8,reload:2.2,body:40,head:110,spread:.03,scope:28,rc:[.04,.01],snd:{f:1100,d:.28,b:80,v:.75,crack:1},desc:'Faster follow-ups, lighter hits.'},
 dmr:{name:'DMR',cls:'marksman',rate:.3,mag:15,reload:2,body:28,head:48,fall:[40,90],min:18,spread:.006,scope:40,rc:[.03,.008],snd:{f:1300,d:.18,b:100,v:.7},desc:'Semi-auto precision with a 3x optic.'},
 lever:{name:'Lever Rifle',cls:'marksman',rate:.6,mag:8,reload:2.6,body:38,head:70,fall:[35,80],min:20,spread:.005,scope:50,rc:[.045,.006],snd:{f:1200,d:.22,b:90,v:.72},desc:'Old-school iron sights, big punch.'},
 shotgun:{name:'Pump Shotgun',cls:'shotgun',rate:.8,mag:6,reload:2.2,body:10,head:14,pellets:8,fall:[7,25],min:2,spread:.075,rc:[.07,.01],snd:{f:1000,d:.25,b:80,v:.85},desc:'~80 damage up close. Pump it.'},
 autoshot:{name:'Auto Shotgun',cls:'shotgun',auto:1,rate:.3,mag:8,reload:2.5,body:7,head:10,pellets:8,fall:[6,20],min:1.5,spread:.085,rc:[.05,.015],snd:{f:1100,d:.2,b:90,v:.8},desc:'Full-auto room clearer.'},
 double:{name:'Double Barrel',cls:'shotgun',rate:.35,mag:2,reload:1.8,body:13,head:18,pellets:8,fall:[5,18],min:2,spread:.09,rc:[.09,.02],snd:{f:850,d:.3,b:65,v:.95},desc:'Two shells of pure power.'},
 handgun:{name:'Handgun',cls:'pistol',rate:.2,mag:12,reload:1.3,body:12,head:16,fall:[18,50],min:4,spread:.01,rc:[.02,.006],snd:{f:2100,d:.09,b:160,v:.5},desc:'Trusty starter sidearm.'},
 revolver:{name:'Revolver',cls:'pistol',rate:.5,mag:6,reload:2,body:30,head:50,fall:[25,60],min:12,spread:.006,rc:[.05,.01],snd:{f:1150,d:.2,b:90,v:.75},desc:'Six shots, big damage.'},
 burst:{name:'Burst Pistol',cls:'pistol',burst:3,rate:.42,mag:18,reload:1.5,body:10,head:14,fall:[15,40],min:3,spread:.012,rc:[.012,.008],snd:{f:2400,d:.07,b:180,v:.45},desc:'Three-round bursts.'},
 cannon:{name:'Hand Cannon',cls:'pistol',rate:.7,mag:7,reload:2,body:42,head:70,fall:[20,55],min:15,spread:.008,rc:[.07,.015],snd:{f:950,d:.25,b:75,v:.85},desc:'Absurdly powerful pistol.'},
 fists:{name:'Fists',cls:'melee',melee:2.6,rate:.35,body:22,head:30,desc:'Bare-knuckle brawling.'},
 knife:{name:'Knife',cls:'melee',melee:3,rate:.45,body:35,head:50,desc:'Quick and deadly.'},
 katana:{name:'Katana',cls:'melee',melee:3.6,rate:.7,body:45,head:60,desc:'Long reach, clean cuts.'},
 axe:{name:'Fire Axe',cls:'melee',melee:3,rate:.9,body:55,head:80,desc:'Slow swing, huge hit.'},
 grenade:{name:'Frag Grenade',cls:'util',count:2,desc:'Explodes after 1.8s. Up to ~100 damage.'},
 molotov:{name:'Molotov',cls:'util',count:1,desc:'Bursts into flames on impact. Burns over time.'},
 smoke:{name:'Smoke',cls:'util',count:2,desc:'Thick cloud that blocks vision for 12s.'},
 flash:{name:'Flashbang',cls:'util',count:2,desc:'Blinds anyone looking at it.'},
 medkit:{name:'Med Kit',cls:'util',count:1,heal:50,desc:'Instantly heal 50 HP.'},
};
for(const k in W){const w=W[k];w.id=k;w.slot=CLASSES.find(c=>c.id===w.cls).slot}
export const LIMB=.85;
export function falloff(w,d){if(!w.fall)return 1;const[a,b]=w.fall;if(d<=a)return 1;if(d>=b)return w.min/w.body;return 1-(d-a)/(b-a)*(1-w.min/w.body)}
// stats normalised 0..1 for arsenal bars
export function stats(w){if(w.cls==='util')return null;const p=w.pellets||1;const dps=w.melee?w.body/w.rate:w.body*p/w.rate*(w.burst?1.8:1);
 return[['Damage',Math.min(1,w.body*p/90),Math.round(w.body*p)+(p>1?' total':'')],['Headshot',Math.min(1,w.head*p/160),Math.round(w.head*p)+''],['Fire rate',Math.min(1,.06/w.rate*1.0+.05),Math.round(60/w.rate)+' rpm'],
  ['Range',w.melee?w.melee/4:Math.min(1,(w.fall?w.fall[1]:150)/110),w.melee?w.melee+'m':(w.fall?w.fall[1]+'m':'∞')],['Magazine',w.melee?1:Math.min(1,w.mag/40),w.melee?'∞':w.mag+''],['Reload',w.melee?1:Math.min(1,1.3/w.reload),w.melee?'-':w.reload+'s'],['DPS',Math.min(1,dps/220),Math.round(dps)+'']]}
// ---------------- models ----------------
const C={gun:0x4b5058,blk:0x33363b,poly:0x3e4247,tan:0xb69c6e,wood:0x7b4a27,wood2:0x5e3519,olive:0x5a6240,chrome:0xc9ced6,brass:0xd2a640,glass:0x6fb7ff,red:0xd63031,steel:0x9aa1aa,wrap:0x1e1e1e,grey:0x5a5f66};
const parts=[];let MAT='metal';
const box=(w,h,d,x,y,z,c,rx=0,ry=0,rz=0)=>parts.push({g:G('box',w,h,d),p:[x,y,z],r:[rx,ry,rz],c,mat:MAT});
const cylZ=(r,l,x,y,z,c,seg=8,r2)=>parts.push({g:G('cyl',r,r2??r,l,seg),p:[x,y,z],r:[Math.PI/2,0,0],c,mat:MAT});
const cylX=(r,l,x,y,z,c,seg=8)=>parts.push({g:G('cyl',r,r,l,seg),p:[x,y,z],r:[0,0,Math.PI/2],c,mat:MAT});
const cylY=(r,l,x,y,z,c,seg=8,r2)=>parts.push({g:G('cyl',r,r2??r,l,seg),p:[x,y,z],c,mat:MAT});
const sph=(r,x,y,z,c,s=[1,1,1])=>parts.push({g:G('sph',r,8,6),p:[x,y,z],s,c,mat:MAT});
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0),_q=new THREE.Quaternion(),_m=new THREE.Matrix4();
function limb(a,b,r1,r2,c,seg=7){_a.set(...a);_b.set(...b);const d=_b.clone().sub(_a),l=d.length();_q.setFromUnitVectors(_up,d.normalize());const mid=_a.clone().add(_b).multiplyScalar(.5);
 _m.compose(mid,_q,new THREE.Vector3(1,1,1));parts.push({g:G('cyl',r2,r1,l,seg),m:_m.clone(),c,mat:'matte'})}
const metal=()=>MAT='metal',matte=()=>MAT='matte';
function rail(z0,z1,y,c=C.blk){for(let z=z0;z>z1;z-=.022)box(.03,.008,.012,0,y,z,c)}
function grip(c,ang=.32){matte();box(.034,.105,.046,0,-.058,.055,c,ang);box(.036,.012,.05,0,-.112,.072,c,ang)}
function tguard(){metal();box(.006,.006,.06,0,-.035,.005,C.blk);box(.006,.03,.006,0,-.02,-.025,C.blk)}
function curvedMag(z,c,n=3,len=.055){matte();for(let i=0;i<n;i++)box(.028,len,.05,0,-.045-i*len*.92,z-i*.018,c,-.28-i*.12)}
function straightMag(z,c,l=.12){matte();box(.026,l,.042,0,-.02-l/2,z,c,-.06)}
function redDot(z,y){metal();box(.032,.034,.05,0,y+.017,z,C.blk);box(.026,.02,.004,0,y+.024,z-.026,C.glass);box(.026,.02,.004,0,y+.024,z+.026,C.glass)}
function acog(z,y){metal();box(.022,.012,.06,0,y+.006,z,C.blk);cylZ(.019,.11,0,y+.034,z,C.poly,10);cylZ(.024,.025,0,y+.034,z-.062,C.poly,10);cylZ(.017,.003,0,y+.034,z-.076,C.glass,10)}
function longScope(z,y,len=.3,r=.02){metal();box(.014,.018,.03,0,y+.009,z-.08,C.blk);box(.014,.018,.03,0,y+.009,z+.08,C.blk);cylZ(r,len,0,y+.04,z,C.blk,12);
 cylZ(r*1.45,.07,0,y+.04,z-len/2-.02,C.blk,12,r);cylZ(r*1.25,.05,0,y+.04,z+len/2+.015,C.blk,12);cylZ(r*1.3,.003,0,y+.04,z-len/2-.056,C.glass,12);cylY(.008,.03,0,y+.07,z,C.blk);cylX(.008,.03,.025,y+.04,z,C.blk)}
function ironSights(zf,zr,y,c=C.blk){metal();box(.006,.022,.006,0,y+.011,zf,c);box(.026,.014,.008,0,y+.007,zr,c);box(.006,.006,.008,-.009,y+.016,zr,c);box(.006,.006,.008,.009,y+.016,zr,c)}
// rifle composer. origin = trigger area, forward = -z
function rifle(o){const rl=o.rl||.24,bl=o.bl||.3,col=o.col||C.gun,acc=o.acc||C.poly;const top=.07;
 metal();box(.05,.07,rl,0,.03,.1-rl/2,col);box(.046,.02,rl*.7,0,top-.004,.08-rl*.35,col);// upper/lower
 box(.004,.022,.05,.026,.04,-.02,C.blk);// eject port cover
 const hgL=o.hgL||.2,hz=.1-rl-hgL/2;
 if(o.hg==='wood'){matte();box(.048,.05,hgL,0,.02,hz,C.wood)}else if(o.hg==='pump'){matte();box(.05,.045,hgL*.6,0,-.005,hz-.03,acc);for(let i=0;i<5;i++)box(.052,.004,.006,0,-.005,hz-.03-hgL*.25+i*.03,C.blk)}
 else{matte();box(.054,.058,hgL,0,.025,hz,acc);metal();for(const s of[-1,1])for(let i=0;i<4;i++)box(.004,.012,.03,s*.028,.03,hz-hgL/2+.03+i*.045,C.blk)}
 if(o.rail!==false)rail(.08,.1-rl-hgL+.02,top+.006);
 const bz=.1-rl-hgL;metal();cylZ(o.br||.011,bl,0,.035,bz-bl/2,C.blk,8);
 const mz=bz-bl;if(o.brake){box(.034,.034,.06,0,.035,mz-.02,C.blk);for(const s of[-1,1])box(.006,.02,.035,s*.018,.035,mz-.02,0x111111)}else{cylZ((o.br||.011)*1.6,.05,0,.035,mz-.015,C.blk,8)}
 if(o.mag==='curved')curvedMag(-.06,o.magCol||C.poly);else if(o.mag==='straight')straightMag(-.06,o.magCol||C.poly,o.magL||.12);else if(o.mag==='box')straightMag(-.06,o.magCol||C.blk,.06);
 else if(o.mag==='tube'){metal();cylZ(.011,bl*.85,0,.005,bz-bl*.42,C.blk,8)}
 grip(o.gripCol||C.poly);tguard();
 matte();const sc=o.stockCol||C.poly;
 if(o.stock==='solid'){box(.04,.06,.2,0,.02,.2,sc);box(.044,.085,.03,0,.005,.31,C.blk);box(.03,.02,.1,0,.058,.18,sc)}
 else if(o.stock==='skeleton'){box(.012,.012,.22,0,.045,.21,sc);box(.012,.012,.22,0,-.01,.21,sc,.18);box(.04,.09,.025,0,.015,.32,C.blk)}
 else if(o.stock==='wood'){box(.042,.07,.28,0,.0,.24,C.wood,.12);box(.044,.09,.02,0,-.02,.38,C.wood2,.12);box(.03,.025,.12,0,.05,.2,C.wood)}
 else if(o.stock==='tube'){metal();cylZ(.014,.14,0,.04,.17,C.blk);matte();box(.04,.07,.03,0,.02,.25,sc)}
 if(o.bolt){metal();cylX(.007,.05,.04,.045,.04,C.steel);sph(.011,.066,.045,.04,C.steel)}
 if(o.bipod){metal();box(.01,.01,.12,.012,.0,bz+.03,C.blk);box(.01,.01,.12,-.012,.0,bz+.03,C.blk)}
 if(o.sight==='red')redDot(.0,top+.012);else if(o.sight==='acog')acog(.0,top+.012);else if(o.sight==='long')longScope(.0,top+.012,o.scopeL||.3,o.scopeR||.02);else ironSights(bz+.02,.06,top+.004);
 const sy=o.sight==='red'?top+.04:o.sight==='acog'?top+.046:o.sight==='long'?top+.052:top+.022;
 return{muzzle:[0,.035,mz-.05],eject:[.03,.045,-.02],sightY:sy,lh:[0,-.005,hz-.02],len:rl+hgL+bl}}
const BUILD={
 ar:()=>rifle({rl:.24,bl:.2,hgL:.2,mag:'curved',stock:'solid',sight:'red'}),
 bullpup:()=>{const r=rifle({rl:.16,bl:.18,hgL:.16,mag:'none',stock:'none',sight:'red',col:C.olive,acc:C.olive});matte();box(.055,.09,.22,0,.015,.2,C.olive);box(.05,.1,.03,0,.0,.32,C.blk);straightMag(.18,C.poly,.1);return r},
 battle:()=>rifle({rl:.26,bl:.3,hgL:.22,mag:'straight',magL:.1,stock:'solid',sight:'acog',col:C.tan,acc:C.tan,stockCol:C.tan,br:.013,brake:1}),
 smg:()=>{metal();box(.052,.075,.25,0,.025,-.02,C.gun);box(.03,.012,.2,0,.068,-.02,C.blk);cylZ(.012,.08,0,.03,-.18,C.blk);cylZ(.02,.04,0,.03,-.15,C.gun);ironSights(-.13,.08,.063);
  matte();box(.034,.13,.05,0,-.07,.02,C.poly,.08);metal();box(.026,.1,.036,0,-.17,.024,C.blk,.08);tguard();box(.01,.01,.2,.02,.03,.18,C.steel);box(.01,.01,.2,-.02,.03,.18,C.steel);box(.05,.04,.01,0,.03,.28,C.steel);
  return{muzzle:[0,.03,-.23],eject:[.03,.05,-.02],sightY:.08,lh:[0,-.02,-.11],len:.35}},
 vector:()=>{metal();box(.05,.1,.26,0,.01,-.04,C.blk);box(.046,.03,.14,0,.075,-.05,C.blk);rail(.05,-.16,.094);matte();box(.05,.06,.1,0,-.06,-.12,C.poly,-.3);redDot(-.02,.094);
  metal();cylZ(.016,.1,0,.03,-.22,C.blk);grip(C.poly,.18);tguard();straightMag(-.08,C.poly,.18);matte();box(.012,.012,.18,0,.05,.18,C.blk);box(.04,.07,.03,0,.03,.28,C.blk);
  return{muzzle:[0,.03,-.28],eject:[.03,.05,-.02],sightY:.134,lh:[0,-.09,-.13],len:.4}},
 pdw:()=>{matte();box(.06,.1,.4,0,.01,.0,C.tan);box(.05,.035,.3,0,.08,-.02,C.blk);box(.045,.05,.08,0,-.06,-.06,C.tan);metal();cylZ(.011,.1,0,.03,-.24,C.blk);cylZ(.017,.04,0,.03,-.29,C.blk);redDot(-.02,.098);
  matte();box(.034,.1,.05,0,-.06,.05,C.tan,.2);box(.06,.1,.03,0,0,.2,C.tan);tguard();return{muzzle:[0,.03,-.32],eject:[0,-.04,.08],sightY:.135,lh:[0,-.04,-.1],len:.45}},
 sniper:()=>rifle({rl:.26,bl:.45,hgL:.18,mag:'box',stock:'wood',sight:'long',scopeL:.3,hg:'wood',bolt:1,rail:false,stockCol:C.wood,gripCol:C.wood,br:.012}),
 heavy:()=>rifle({rl:.3,bl:.5,hgL:.24,mag:'box',stock:'skeleton',sight:'long',scopeL:.34,scopeR:.025,bolt:1,brake:1,br:.017,bipod:1,col:C.grey,acc:C.grey}),
 light:()=>rifle({rl:.24,bl:.38,hgL:.18,mag:'box',stock:'solid',sight:'long',scopeL:.24,scopeR:.017,bolt:1,col:C.olive,acc:C.olive,stockCol:C.olive}),
 dmr:()=>rifle({rl:.25,bl:.34,hgL:.24,mag:'straight',magL:.09,stock:'skeleton',sight:'acog',col:C.blk}),
 lever:()=>{const r=rifle({rl:.22,bl:.42,hgL:.18,mag:'tube',stock:'wood',sight:'iron',hg:'wood',rail:false,col:C.steel,gripCol:C.wood});metal();parts.push({g:G('tor',.032,.006,5,10,Math.PI*1.3),p:[0,-.06,.03],r:[0,Math.PI/2,0],c:C.steel,mat:'metal'});return r},
 shotgun:()=>{const r=rifle({rl:.22,bl:.4,hgL:.16,mag:'tube',stock:'solid',sight:'iron',hg:'pump',rail:false,br:.014,acc:C.wood,stockCol:C.wood});return r},
 autoshot:()=>rifle({rl:.26,bl:.32,hgL:.2,mag:'straight',magL:.09,stock:'solid',sight:'red',br:.016,magCol:C.blk}),
 double:()=>{metal();box(.06,.05,.12,0,.02,.03,C.steel);cylZ(.013,.55,-.013,.04,-.3,C.blk,8);cylZ(.013,.55,.013,.04,-.3,C.blk,8);box(.006,.006,.5,0,.056,-.3,C.blk);
  matte();box(.05,.04,.18,0,.005,-.14,C.wood);box(.04,.075,.3,0,-.01,.22,C.wood,.18);box(.042,.1,.02,0,-.04,.37,C.wood2,.18);tguard();return{muzzle:[0,.04,-.6],eject:[0,.05,.0],sightY:.065,lh:[0,-.01,-.15],len:.75}},
 handgun:()=>{metal();box(.03,.034,.19,0,.045,-.06,C.blk);for(let i=0;i<5;i++)box(.032,.02,.004,0,.048,.01+i*.006,0x111111);box(.028,.022,.17,0,.016,-.06,C.poly);cylZ(.008,.012,0,.045,-.158,0x111111);
  ironSights(-.145,.025,.062);grip(C.poly,.22);tguard();return{muzzle:[0,.045,-.17],eject:[.02,.055,-.05],sightY:.084,lh:[-.0,-.075,.06],len:.2,pistol:1}},
 burst:()=>{metal();box(.032,.036,.2,0,.045,-.06,C.tan);box(.03,.022,.18,0,.016,-.06,C.blk);cylZ(.009,.03,0,.045,-.17,0x111111);redDot(-.02,.063);grip(C.blk,.22);straightMag(.07,C.blk,.04);tguard();
  return{muzzle:[0,.045,-.19],eject:[.02,.055,-.05],sightY:.103,lh:[0,-.075,.06],len:.22,pistol:1}},
 revolver:()=>{metal();cylZ(.011,.18,0,.045,-.15,C.chrome,8);box(.012,.02,.17,0,.06,-.15,C.chrome);cylZ(.025,.05,0,.035,-.03,C.chrome,8);box(.03,.06,.07,0,.03,.03,C.chrome);box(.006,.016,.008,0,.072,-.23,C.chrome);
  box(.01,.02,.01,0,.07,.06,C.steel,-.5);matte();box(.03,.1,.045,0,-.04,.08,C.wood,.35);tguard();return{muzzle:[0,.045,-.25],eject:[0,.04,-.03],sightY:.08,lh:[0,-.07,.09],len:.3,pistol:1,noShell:1}},
 cannon:()=>{metal();box(.04,.045,.25,0,.05,-.08,C.chrome);box(.036,.03,.22,0,.015,-.08,C.steel);box(.042,.02,.03,0,.05,-.205,C.chrome);ironSights(-.19,.03,.074,C.blk);grip(C.blk,.22);tguard();
  return{muzzle:[0,.05,-.22],eject:[.025,.06,-.06],sightY:.098,lh:[0,-.075,.06],len:.27,pistol:1}},
 knife:()=>{matte();box(.026,.03,.1,0,0,.03,C.blk);box(.04,.035,.01,0,0,-.025,C.steel);metal();box(.006,.03,.16,0,.003,-.11,C.chrome);box(.006,.016,.04,0,.0,-.205,C.chrome,0,0,0);
  return{muzzle:[0,0,-.2],sightY:0,lh:null,melee:1}},
 katana:()=>{matte();box(.028,.032,.22,0,0,.08,C.wrap);for(let i=0;i<6;i++)box(.03,.034,.008,0,0,.0+i*.035,C.red);metal();cylY(.045,.008,0,0,-.035,C.brass,10);parts[parts.length-1].r=[Math.PI/2,0,0];
  for(let i=0;i<3;i++)box(.006,.03,.25,0,.0+i*.012,-.16-i*.24,C.chrome,-.04*i);return{muzzle:[0,0,-.6],sightY:0,lh:[0,0,.14],melee:1}},
 axe:()=>{matte();box(.03,.03,.5,0,0,-.12,C.wood);metal();box(.012,.09,.11,0,.045,-.36,C.red);box(.01,.1,.03,0,.045,-.42,C.chrome);box(.02,.03,.05,0,.0,-.31,C.blk);
  return{muzzle:[0,0,-.4],sightY:0,lh:[0,0,-.02],melee:1}},
 fists:()=>({sightY:0,lh:null,melee:1,fists:1}),
 grenade:()=>{metal();sph(.035,0,0,0,C.olive,[1,1.15,1]);cylY(.014,.02,0,.045,0,C.steel);box(.008,.06,.016,.02,.025,0,C.steel,0,0,-.2);parts.push({g:G('tor',.012,.003,4,8),p:[-.02,.05,0],c:C.steel,mat:'metal'});return{util:1}},
 molotov:()=>{metal();cylY(.032,.12,0,0,0,0x3d8b37,8);cylY(.012,.06,0,.09,0,0x3d8b37,8);matte();box(.03,.05,.03,0,.13,0,0xefe6d0,.2);return{util:1}},
 smoke:()=>{metal();cylY(.03,.12,0,0,0,C.grey,10);box(.062,.02,.062,0,.02,0,0xdddddd);cylY(.012,.02,0,.07,0,C.steel);return{util:1}},
 flash:()=>{metal();cylY(.03,.11,0,0,0,C.blk,10);for(let i=0;i<4;i++)cylY(.031,.006,0,-.03+i*.02,0,C.steel,10);cylY(.012,.02,0,.065,0,C.steel);return{util:1}},
 medkit:()=>{matte();box(.12,.08,.04,0,0,0,0xffffff);box(.02,.06,.042,0,0,0,C.red);box(.06,.02,.042,0,0,0,C.red);box(.05,.012,.01,0,.046,0,C.blk);return{util:1}},
};
export function gunParts(id){parts.length=0;const info=(BUILD[id]||BUILD.ar)();return{parts:parts.splice(0),info}}
// viewmodel hands (gloves + sleeves) attached to a weapon
export function handParts(info,sleeve=0x3d4a5c){parts.length=0;const glove=0x2f3236,skin=0xe0ac7e;
 const hand=(x,y,z,rx=0,ry=0)=>{MAT='matte';box(.05,.085,.05,x,y,z,glove,rx,ry);box(.052,.03,.06,x,y-.02,z-.03,glove,rx,ry);box(.018,.04,.02,x+.026,y+.02,z-.015,glove,rx,ry)};
 if(info.fists){for(const s of[-1,1]){const x=s<0?-.2:.0;box(.075,.07,.085,x,0,0,glove);box(.08,.025,.03,x,.025,-.04,glove);limb([x,-.02,.04],[x+s*.03,-.18,.42],.034,.045,sleeve);limb([x,-.02,.04],[x,-.02,.1],.032,.032,skin)}return parts.splice(0)}
 if(info.util){hand(0,-.02,.02);limb([0,-.05,.05],[.06,-.25,.42],.032,.045,sleeve);return parts.splice(0)}
 // right hand on grip
 hand(0,-.065,.07,.3);limb([0,-.09,.1],[.07,-.28,.48],.033,.046,sleeve);
 if(info.melee){return parts.splice(0)}
 if(info.lh){const[x,y,z]=info.lh;if(info.pistol){hand(-.03,-.085,.075,.3,.3);limb([-.04,-.11,.1],[-.16,-.3,.45],.033,.046,sleeve)}else{MAT='matte';box(.06,.04,.08,x-.012,y-.02,z,glove);box(.02,.045,.06,x+.03,y+.005,z,glove);box(.02,.045,.06,x-.035,y+.005,z,glove);limb([x-.01,y-.04,z+.02],[x-.18,-.3,z+.5],.033,.046,sleeve)}}
 return parts.splice(0)}
