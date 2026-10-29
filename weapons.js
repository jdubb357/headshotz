// HeadShotz arsenal: stats + procedural low-poly weapon models. Starter weapons free; new ones unlock with 💎 earned by playing (no real money).
import {THREE,G} from './gfx.js';
export const CLASSES=[
 {id:'ar',name:'Assault Rifles',slot:0},{id:'smg',name:'SMGs',slot:0},{id:'sniper',name:'Snipers',slot:0},{id:'marksman',name:'Marksman Rifles',slot:0},
 {id:'shotgun',name:'Shotguns',slot:0},{id:'heavy',name:'Heavy & Launchers',slot:0},{id:'fun',name:'Fun & Sci-Fi',slot:0},{id:'pistol',name:'Pistols',slot:1},{id:'melee',name:'Melee & Knives',slot:2},{id:'util',name:'Utilities',slot:3}];
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
 // ---- shop weapons (price in diamonds, earned only by playing) ----
 m4:{name:'M4 Carbine',cls:'ar',price:500,auto:1,rate:.085,mag:30,reload:1.9,body:11,head:15,fall:[25,70],min:4,spread:.009,rc:[.01,.005],snd:{f:2100,d:.1,b:150,v:.55},desc:'Smooth, accurate, easy to control.'},
 ak47:{name:'AK-47',cls:'ar',price:650,auto:1,rate:.1,mag:30,reload:2.1,body:14,head:19,fall:[22,65],min:5,spread:.014,rc:[.017,.01],snd:{f:1500,d:.13,b:120,v:.62},desc:'Hard-hitting classic. Big kick.'},
 scar:{name:'SCAR-H',cls:'ar',price:900,auto:1,rate:.12,mag:20,reload:2.2,body:16,head:23,fall:[30,80],min:6,spread:.01,rc:[.018,.007],snd:{f:1350,d:.14,b:110,v:.64},desc:'Battle-grade 7.62 punch with an ACOG.'},
 mp5:{name:'MP5',cls:'smg',price:500,auto:1,rate:.07,mag:30,reload:1.8,body:10,head:13,fall:[14,40],min:3,spread:.02,rc:[.006,.006],snd:{f:2500,d:.07,b:190,v:.45},desc:'Legendary control and accuracy.'},
 mp7:{name:'MP7',cls:'smg',price:600,auto:1,rate:.06,mag:40,reload:1.9,body:9,head:12,fall:[15,40],min:3,spread:.019,rc:[.006,.007],snd:{f:2800,d:.06,b:200,v:.44},desc:'Tiny, fast, 40-round mag.'},
 kriss:{name:'KRISS Vector .45',cls:'smg',price:800,auto:1,rate:.045,mag:25,reload:1.8,body:9,head:12,fall:[10,30],min:2,spread:.023,rc:[.004,.006],snd:{f:2300,d:.06,b:170,v:.46},desc:'Crazy fire rate, almost no recoil.'},
 p90:{name:'P90',cls:'smg',price:800,auto:1,rate:.055,mag:50,reload:2.3,body:9,head:12,fall:[14,38],min:3,spread:.021,rc:[.005,.006],snd:{f:2700,d:.06,b:190,v:.44},desc:'50-round top mag. Never stop shooting.'},
 aa12:{name:'AA-12',cls:'shotgun',price:1100,auto:1,rate:.2,mag:20,reload:2.8,body:6,head:9,pellets:8,fall:[6,20],min:1.5,spread:.09,rc:[.04,.016],snd:{f:1050,d:.18,b:85,v:.8},desc:'Full-auto drum shotgun. Total chaos.'},
 glock18:{name:'Glock 18',cls:'pistol',price:450,auto:1,rate:.05,mag:20,reload:1.4,body:8,head:11,fall:[12,35],min:2,spread:.028,rc:[.01,.012],snd:{f:2500,d:.06,b:190,v:.44},desc:'Full-auto machine pistol.'},
 deagle:{name:'Desert Eagle',cls:'pistol',price:650,rate:.45,mag:7,reload:1.9,body:36,head:60,fall:[25,60],min:14,spread:.007,rc:[.07,.015],snd:{f:900,d:.26,b:70,v:.88},desc:'.50 cal hand cannon.'},
 crossbow:{name:'Crossbow',cls:'marksman',price:900,rate:1,mag:1,reload:1.3,body:65,head:130,spread:.003,scope:45,rc:[.02,.004],snd:{f:700,d:.12,b:220,v:.5},noShell:1,desc:'Silent bolts. One-shot headshots.'},
 lmg:{name:'LMG',cls:'heavy',price:1200,auto:1,rate:.09,mag:100,reload:4,body:13,head:17,fall:[30,80],min:5,spread:.022,rc:[.011,.01],snd:{f:1600,d:.13,b:120,v:.62},desc:'100-round belt. Suppress everything.'},
 gl:{name:'Grenade Launcher',cls:'heavy',price:1500,proj:'gl',rate:.9,mag:6,reload:3,body:0,head:0,splash:85,radius:5,spread:0,rc:[.06,.01],snd:{f:500,d:.2,b:60,v:.7},noShell:1,desc:'Lobs explosive rounds that pop on impact.'},
 rpg:{name:'Rocket Launcher',cls:'heavy',price:1900,proj:'rpg',rate:1.4,mag:1,reload:2.6,body:0,head:0,splash:120,radius:5.5,spread:0,rc:[.09,.015],snd:{f:380,d:.45,b:50,v:.85},noShell:1,desc:'Rocket with big splash. Self-damage reduced.'},
 m16:{name:'M16A4',cls:'ar',price:550,burst:3,rate:.34,mag:30,reload:2.1,body:14,head:20,fall:[30,85],min:5,spread:.006,rc:[.012,.004],snd:{f:2000,d:.11,b:140,v:.58},desc:'3-round burst, long barrel, laser accurate.'},
 mk18:{name:'MK18 CQB',cls:'ar',price:600,auto:1,rate:.075,mag:30,reload:1.8,body:10,head:14,fall:[18,50],min:3,spread:.011,rc:[.009,.006],snd:{f:1500,d:.07,b:120,v:.32},desc:'Short suppressed carbine. Quiet and quick.'},
 mini14:{name:'Ranch Rifle',cls:'marksman',price:500,rate:.22,mag:20,reload:2,body:24,head:40,fall:[40,90],min:14,spread:.005,rc:[.025,.006],snd:{f:1700,d:.14,b:110,v:.62},desc:'Wood-stocked semi-auto. Classic.'},
 ump45:{name:'UMP-45',cls:'smg',price:500,auto:1,rate:.09,mag:25,reload:1.9,body:13,head:17,fall:[12,35],min:4,spread:.02,rc:[.008,.007],snd:{f:1900,d:.08,b:130,v:.5},desc:'Hard-hitting .45 SMG with a holo sight.'},
 tommy:{name:'Tommy Gun',cls:'smg',price:700,auto:1,rate:.07,mag:50,reload:2.6,body:10,head:13,fall:[12,32],min:3,spread:.028,rc:[.009,.012],snd:{f:1700,d:.09,b:120,v:.55},desc:'50-round drum, wood and steel.'},
 saiga:{name:'Saiga-12',cls:'shotgun',price:900,rate:.3,mag:8,reload:2.3,body:9,head:12,pellets:8,fall:[7,22],min:1.5,spread:.08,rc:[.06,.014],snd:{f:1000,d:.22,b:80,v:.82},desc:'Semi-auto mag-fed shotgun.'},
 ksg:{name:'KSG',cls:'shotgun',price:1000,rate:.75,mag:14,reload:3.2,body:11,head:15,pellets:8,fall:[8,26],min:2,spread:.07,rc:[.07,.01],snd:{f:950,d:.26,b:75,v:.86},desc:'Bullpup pump with twin tubes: 14 shells.'},
 barrett:{name:'Barrett .50',cls:'sniper',price:1600,rate:.9,mag:5,reload:3.2,body:65,head:150,spread:.05,scope:16,rc:[.11,.02],snd:{f:600,d:.5,b:50,v:.95,crack:1},desc:'Semi-auto anti-materiel. Massive kick.'},
 awp:{name:'Arctic Magnum',cls:'sniper',price:1900,rate:1.6,mag:5,reload:3.4,body:100,head:200,spread:.06,scope:18,rc:[.1,.015],snd:{f:650,d:.5,b:52,v:.95,crack:1},desc:'One shot, one elimination. Slow bolt.'},
 minigun:{name:'Minigun',cls:'heavy',price:2000,auto:1,rate:.045,mag:150,reload:5,body:8,head:11,fall:[25,60],min:4,spread:.032,rc:[.006,.012],snd:{f:1800,d:.06,b:130,v:.5},desc:'6 spinning barrels. 150-round box.'},
 // ---- fun & sci-fi (v7) ----
 paintball:{name:'Paintball Marker',cls:'fun',price:450,auto:1,rate:.11,mag:40,reload:2,body:7,head:10,fall:[15,45],min:3,spread:.02,rc:[.004,.004],paint:1,noShell:1,tracer:0xff4fd8,snd:{f:700,d:.05,b:320,v:.32,pop:1},desc:'Pop-pop! Low damage, splats paint everywhere.'},
 water:{name:'Water Blaster',cls:'fun',price:300,auto:1,rate:.06,mag:90,reload:2.5,body:1,head:1,fall:[8,18],min:1,spread:.03,rc:[.002,.002],push:3.2,noShell:1,tracer:0x6ab8ff,snd:{f:500,d:.05,b:200,v:.18,pop:1},desc:'Tiny damage, big knockback. Soak them!'},
 freeze:{name:'Freeze Ray',cls:'fun',price:1100,auto:1,rate:.08,mag:60,reload:2.4,body:4,head:5,fall:[10,22],min:1,spread:.01,rc:[.002,.002],slow:[.55,1.2],noShell:1,tracer:0xa8e8ff,snd:{f:3800,d:.05,b:900,v:.22,zap:1},desc:'Chilly beam: slows targets by 45% for a moment.'},
 laser:{name:'Laser Rifle',cls:'fun',price:1400,auto:1,rate:.1,mag:36,reload:2.2,body:12,head:16,spread:.006,rc:[.006,.004],noShell:1,tracer:0x34e7ff,snd:{f:3200,d:.08,b:600,v:.36,zap:1},desc:'Sci-fi pulse rifle. Hitscan, no falloff.'},
 taser:{name:'Taser',cls:'pistol',price:600,rate:1.1,mag:1,reload:1.6,body:15,head:18,maxR:14,spread:.004,rc:[.03,.006],slow:[.3,2],noShell:1,tracer:0xfff36a,snd:{f:4200,d:.12,b:1200,v:.3,zap:1},desc:'Short-range darts that stun (big slow) for 2s.'},
 flare:{name:'Flare Gun',cls:'pistol',price:700,proj:'flare',rate:1,mag:1,reload:1.6,body:0,head:0,splash:20,radius:1.6,spread:0,rc:[.05,.01],noShell:1,fire:1,snd:{f:600,d:.15,b:90,v:.6},desc:'Fires a flare that sets a small fire.'},
 bat:{name:'Baseball Bat',cls:'melee',price:350,melee:3.1,rate:.6,body:40,head:55,desc:'Swing for the fences.'},
 pan:{name:'Frying Pan',cls:'melee',price:400,melee:2.6,rate:.55,body:36,head:70,bonk:1,desc:'BONK. Headshots ring loud.'},
 scythe:{name:'Scythe',cls:'melee',price:900,melee:4.2,rate:1,body:58,head:75,desc:'Huge reach, slow reap.'},
 trident:{name:'Trident',cls:'melee',price:1000,melee:4.6,rate:.85,body:50,head:70,desc:'Longest reach of any melee.'},
 chainsaw:{name:'Chainsaw',cls:'melee',price:1300,melee:2.4,auto:1,rate:.1,body:9,head:12,saw:1,slowSelf:.82,desc:'Hold to rip (~90 dps). Loud and a bit heavy.'},
 grenade:{name:'Frag Grenade',cls:'util',count:2,desc:'Explodes after 1.8s. Up to ~100 damage.'},
 molotov:{name:'Molotov',cls:'util',count:1,desc:'Bursts into flames on impact. Burns over time.'},
 smoke:{name:'Smoke',cls:'util',count:2,desc:'Thick cloud that blocks vision for 12s.'},
 flash:{name:'Flashbang',cls:'util',count:2,desc:'Blinds anyone looking at it.'},
 decoy:{name:'Decoy',cls:'util',count:1,desc:'Non-lethal. Fakes gunfire from where it lands for 8s.'},
 medkit:{name:'Med Kit',cls:'util',count:1,heal:50,desc:'Instantly heal 50 HP.'},
};
for(const k in W){const w=W[k];w.id=k;w.slot=CLASSES.find(c=>c.id===w.cls).slot}
export const STARTER=Object.keys(W).filter(k=>!W[k].price);
export const LIMB=.85;
export function falloff(w,d){if(!w.fall)return 1;const[a,b]=w.fall;if(d<=a)return 1;if(d>=b)return w.min/w.body;return 1-(d-a)/(b-a)*(1-w.min/w.body)}
// stats normalised 0..1 for arsenal bars
export function stats(w){if(w.cls==='util')return null;
 if(w.proj)return[['Splash dmg',Math.min(1,w.splash/120),w.splash+''],['Radius',w.radius/6,w.radius+'m'],['Fire rate',Math.min(1,.06/w.rate+.05),Math.round(60/w.rate)+' rpm'],['Magazine',Math.min(1,w.mag/40),w.mag+''],['Reload',Math.min(1,1.3/w.reload),w.reload+'s']];const p=w.pellets||1;const dps=w.melee?w.body/w.rate:w.body*p/w.rate*(w.burst?1.8:1);
 return[['Damage',Math.min(1,w.body*p/90),Math.round(w.body*p)+(p>1?' total':'')],['Headshot',Math.min(1,w.head*p/160),Math.round(w.head*p)+''],['Fire rate',Math.min(1,.06/w.rate*1.0+.05),Math.round(60/w.rate)+' rpm'],
  ['Range',w.melee?w.melee/4:Math.min(1,(w.fall?w.fall[1]:150)/110),w.melee?w.melee+'m':(w.fall?w.fall[1]+'m':'∞')],['Magazine',w.melee?1:Math.min(1,w.mag/40),w.melee?'∞':w.mag+''],['Reload',w.melee?1:Math.min(1,1.3/w.reload),w.melee?'-':w.reload+'s'],['DPS',Math.min(1,dps/220),Math.round(dps)+'']]}
// ======================= MODELS (v5 realism pass) =======================
// Every gun is procedural geometry built at real-world scale (metres). Origin = trigger, forward = -z, bore ~ y .04.
// Side silhouettes are authored as 2D profiles (with filleted corners) extruded with a small bevel; round parts are lathed.
// Parts carry a material kind (mat) and an optional animation group (grp) so the viewmodel can move mags, bolts, slides, pumps…
// Everything with the same (grp, mat) is merged into one mesh -> ~8-14 draw calls per first-person gun, 1 for third-person LOD.
const C={blk:0x2b2d31,park:0x3a3c40,alu:0x2f3236,poly:0x2a2c2f,tan:0xb39a70,fde:0x8f7a58,od:0x535a3c,wood:0x8c5530,woodD:0x5b351b,woodL:0xa86e3c,
 steel:0x8d939b,chrome:0xd7dbe0,brass:0xc9a24c,rub:0x1d1e20,red:0xc42b2b,olive:0x5b6142,grey:0x585c62,dark:0x141518,bake:0x6a3420,orange:0xd86a1e,
 glass:0x0b1626,wrap:0x1c1c1c,gun:0x3a3c40,glove:0x3b3a35,pad:0x24252a};
const parts=[];let MAT='metal',GRP=null,LOD=0,XF=null,TRG=null;
const _M=new THREE.Matrix4(),_M2=new THREE.Matrix4(),_V=new THREE.Vector3(),_V2=new THREE.Vector3(),_Q=new THREE.Quaternion(),_E=new THREE.Euler();
const mat=m=>MAT=m,grp=g=>GRP=g;
const metal=()=>MAT='metal',matte=()=>MAT='poly';
function push(g,p,r,c,ex){const pt={g,p:p||[0,0,0],r:r||[0,0,0],c,mat:MAT,grp:GRP,us:9};if(XF)pt.m=XF.clone();if(ex)Object.assign(pt,ex);parts.push(pt);return pt}
// run fn with an extra transform (sub-assembly placement / rotation about a pivot)
function under(m,fn){const o=XF;XF=o?o.clone().multiply(m):m.clone();fn();XF=o}
const T=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z);
const RX=a=>new THREE.Matrix4().makeRotationX(a),RY=a=>new THREE.Matrix4().makeRotationY(a),RZ=a=>new THREE.Matrix4().makeRotationZ(a);
const about=(px,py,pz,R)=>T(px,py,pz).multiply(R).multiply(T(-px,-py,-pz));
// polygon (z,y[,fillet]) -> THREE.Shape (shape x = z, shape y = y)
function area(p){let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2}
function orient(p,ccw){return(area(p)>0)===ccw?p:p.slice().reverse()}
function shapeOf(pts,S){pts=orient(pts,!S);const s=S||new THREE.Shape();const n=pts.length;
 for(let i=0;i<n;i++){const[z,y,r=0]=pts[i];if(!r||LOD){i?s.lineTo(z,y):s.moveTo(z,y);continue}
  const A=pts[(i-1+n)%n],B=pts[(i+1)%n];const la=Math.hypot(A[0]-z,A[1]-y),lb=Math.hypot(B[0]-z,B[1]-y);const rr=Math.min(r,la*.5,lb*.5);
  const p1=[z+(A[0]-z)/la*rr,y+(A[1]-y)/la*rr],p2=[z+(B[0]-z)/lb*rr,y+(B[1]-y)/lb*rr];i?s.lineTo(p1[0],p1[1]):s.moveTo(p1[0],p1[1]);s.quadraticCurveTo(z,y,p2[0],p2[1])}
 s.closePath();return s}
function extr(shape,w,b,cs){const bb=LOD?0:b;const depth=Math.max(.0004,w-2*bb);return[new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bb>0,bevelThickness:bb,bevelSize:bb*.8,bevelSegments:LOD?1:2,curveSegments:LOD?2:(cs||6),steps:1}),depth]}
// side profile, extruded across x (thickness w, centred at x0)
function prof(pts,w,x0,c,o={}){const sh=shapeOf(pts);if(o.holes)for(const h of o.holes)sh.holes.push(shapeOf(h,new THREE.Path()));
 const[g,depth]=extr(sh,w,o.b??Math.min(.0016,w*.18),o.cs);g.applyMatrix4(_M.set(0,0,-1,x0+depth/2,0,1,0,0,1,0,0,0,0,0,0,1));return push(g,o.p,o.r,c,o.ex)}
// front profile (x,y) extruded along z (length len, centred at z0)
function profF(pts,len,z0,c,o={}){const sh=shapeOf(pts);if(o.holes)for(const h of o.holes)sh.holes.push(shapeOf(h,new THREE.Path()));
 const[g,depth]=extr(sh,len,o.b??.0012,o.cs);g.translate(0,0,z0-depth/2);return push(g,o.p,o.r,c,o.ex)}
// top profile (x,z) extruded along y (height h, centred at y0)
function profT(pts,h,y0,c,o={}){const sh=shapeOf(pts.map(([x,z,r])=>[x,-z,r]));const[g,depth]=extr(sh,h,o.b??.0012,o.cs);g.applyMatrix4(_M.set(1,0,0,0,0,0,1,y0-depth/2,0,-1,0,0,0,0,0,1));return push(g,o.p,o.r,c,o.ex)}
// rounded box
function rbox(w,h,d,x,y,z,c,r=.002,rx=0,ry=0,rz=0,b){r=Math.min(r,h*.45,d*.45);return prof([[-d/2,-h/2,r],[d/2,-h/2,r],[d/2,h/2,r],[-d/2,h/2,r]],w,0,c,{p:[x,y,z],r:[rx,ry,rz],b:b??Math.min(.0012,w*.2)})}
const box=(w,h,d,x,y,z,c,rx=0,ry=0,rz=0)=>push(new THREE.BoxGeometry(w,h,d),[x,y,z],[rx,ry,rz],c);
const SEG=n=>LOD?Math.max(5,Math.round(n/3)):n;
// cylinder along z (default), x or y
function cyl(r,len,x,y,z,c,o={}){const g=new THREE.CylinderGeometry(o.r2??r,r,len,SEG(o.seg||16),1,!!o.open);const ax=o.ax||'z';
 return push(g,[x,y,z],ax==='z'?[-Math.PI/2,0,0]:ax==='x'?[0,0,Math.PI/2]:[0,0,0],c,o.ex)}
// lathe along z: pr=[[radius, z],...] (z relative, increasing = towards the rear)
function lathe(pr,x,y,z,c,o={}){const g=new THREE.LatheGeometry(pr.map(([r,zz])=>new THREE.Vector2(Math.max(1e-4,r),zz)),SEG(o.seg||18));g.rotateX(Math.PI/2);
 return push(g,[x,y,z],o.r||[0,0,0],c,o.ex)}
const sph=(r,x,y,z,c,s=[1,1,1],seg=10)=>push(new THREE.SphereGeometry(r,SEG(seg),Math.max(4,SEG(seg)*.7|0)),[x,y,z],[0,0,0],c,{s});
const tor=(R,r,x,y,z,c,arc=Math.PI*2,rx=0,ry=0,rz=0,seg=[8,20])=>push(new THREE.TorusGeometry(R,r,SEG(seg[0]),SEG(seg[1]),arc),[x,y,z],[rx,ry,rz],c);
const det=()=>!LOD;// fine details only on first-person / icons
// ---------- components ----------
// picatinny rail along z on top of y (rotate with under(about(...)) for side rails)
function rail(z0,z1,y,c=C.alu,w=.021){const L=z0-z1;rbox(w*.78,.004,L,0,y+.002,(z0+z1)/2,c,.001);
 if(det()){for(let z=z0-.004;z>z1+.003;z-=.01)prof([[-.0026,0],[.0026,0],[.0021,.003],[-.0021,.003]],w,0,c,{p:[0,y+.003,z],b:.0004})}else rbox(w,.006,L,0,y+.004,(z0+z1)/2,c,.001)}
// screw / pin heads on a side
const pin=(x,y,z,r=.0025,c=C.steel)=>{if(det())cyl(r,.003,x,y,z,c,{ax:'x',seg:10})};
// trigger + guard loop (z0 front, z1 rear of the guard, y top of guard)
function trig(z0=-.03,z1=.03,y=-.012,c=C.blk,th=.005){if(det()){const zf=z0,zr=z1;prof([[zf,y],[zf+.004,y-.03,.008],[zr-.006,y-.034,.006],[zr,y-.022,.004],[zr,y],[zr-.004,y],[zr-.004,y-.02],[zr-.008,y-.028,.004],[zf+.008,y-.025,.006],[zf+.004,y]],th,0,c,{b:.0008})}
 const tz=(z0+z1)/2+.002;TRG=[0,y-.012,tz-.004];prof([[tz-.004,y+.002],[tz-.006,y-.01,.004],[tz-.002,y-.02,.003],[tz+.002,y-.019],[tz-.001,y-.01,.004],[tz+.002,y+.002]],.006,0,C.dark,{b:.0006})}
// AR-style pistol grip (rake a), top centre at (y0,z0)
function gripAR(y0,z0,c,a=.38,L=.11,w=.03){const ca=Math.cos(a),sa=Math.sin(a);// u = front(-)/back(+) across the grip, v = down the grip axis
 const pts=[[-.024,0],[.022,0],[.026,.03],[.028,L*.75],[.02,L,.01],[-.016,L,.01],[-.021,L*.82],[-.018,L*.62,.006],[-.024,L*.5,.006],[-.019,L*.32],[-.024,L*.18,.008]];
 prof(pts.map(([u,v,r])=>[z0+u*ca+v*sa,y0+u*sa-v*ca,r]),w,0,c,{b:.0022});
 return{c:[0,y0-.04*ca,z0+.04*sa],a,w}}
// rubber butt pad
function buttPad(z,y0,y1,w,c=C.rub){rbox(w,y1-y0,.018,0,(y0+y1)/2,z,c,.006)}
// straight / slightly curved box magazine (top front at z0,y0; depth d; length L; curve = forward shift at bottom)
function boxMag(z0,y0,d,L,w,c,curve=0,base=true){const n=LOD?2:6;const pts=[];for(let i=0;i<=n;i++){const t=i/n;pts.push([z0-curve*t*t,y0-L*t])}const back=[];for(let i=n;i>=0;i--){const t=i/n;back.push([z0+d-curve*t*t*.8,y0-L*t])}
 prof([...pts,...back],w,0,c,{b:.0015});if(base)rbox(w+.004,.008,d+.008,0,y0-L-.002,z0+d/2-curve*.9,c,.002);
 if(det())for(let i=1;i<4;i++){const t=i/4.5;prof([[z0+.004-curve*t*t,y0-L*t],[z0+d-.004-curve*t*t*.8,y0-L*t],[z0+d-.004-curve*t*t*.8,y0-L*t-.006],[z0+.004-curve*t*t,y0-L*t-.006]],w+.0016,0,c,{b:.0004})}}
// banana mag (AK): arc centred in front of the mag
function bananaMag(z0,y0,R,deg,d,w,c){const n=LOD?3:12,A=deg*Math.PI/180;const cz=z0-R,cy=y0;const front=[],back=[];
 for(let i=0;i<=n;i++){const a=-A*i/n;front.push([cz+(R-d*.5)*Math.cos(a)+(-d*.5)+d*.5,cy+(R-d*.5)*Math.sin(a)])}
 for(let i=n;i>=0;i--){const a=-A*i/n;back.push([cz+(R+d*.5)*Math.cos(a),cy+(R+d*.5)*Math.sin(a)])}
 prof([...front,...back],w,0,c,{b:.0016});const e=-A;rbox(w+.004,.012,d+.01,0,cy+R*Math.sin(e)-.004,cz+R*Math.cos(e),c,.003,-e);
 if(det())for(let i=1;i<=3;i++){const a=-A*i/4;rbox(w+.0016,.01,d*.85,0,cy+R*Math.sin(a),cz+R*Math.cos(a),c,.002,-a)}}
// barrel with steps: [[r, zFront->],..] built as lathe; muzzle at zm (most negative)
function barrel(zs,ze,r,y=.04,c=C.park,steps){lathe(steps||[[r,0],[r,ze-zs]],0,y,zs,c,{seg:18})}
// A2 birdcage flash hider
function birdcage(z,y,r=.0105,c=C.park){lathe([[r*.85,-.045],[r,-.044],[r,-.004],[r*.9,0]],0,y,z,c,{seg:16});if(det())for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.3;rbox(.003,.003,.026,Math.cos(a)*r*.98,y+Math.sin(a)*r*.98,z-.024,C.dark,.0008,0,0,a)}}
function brake(z,y,r=.014,c=C.park,len=.055){rbox(r*2.2,r*1.8,len,0,y,z-len/2,c,.004);if(det())for(let i=0;i<3;i++)for(const s of[-1,1])rbox(.003,r*1.2,.007,s*r*1.1,y,z-.01-i*.016,C.dark,.001)}
function comp(z,y,r=.012,c=C.park){lathe([[r*.9,-.035],[r,-.032],[r,0]],0,y,z,c,{seg:16});if(det())for(let i=0;i<3;i++)rbox(.004,.004,.006,0,y+r*.9,z-.008-i*.009,C.dark,.001)}
function suppressor(z,y,r=.018,len=.16,c=C.blk){lathe([[r*.6,-len],[r,-len+.01],[r,-.01],[r*.7,0]],0,y,z,c,{seg:20})}
// ---------- optics (return eye point) ----------
const RET=(kind,x,y,z,s)=>{const g=new THREE.PlaneGeometry(s,s);g.translate(x,y,z);const pt=push(g,null,null,0xffffff);pt.mat='ret';pt.ret=kind;pt.keepUV=true;return pt};
const GLS=(r,x,y,z,sq)=>{const g=sq?new THREE.PlaneGeometry(sq[0],sq[1]):new THREE.CircleGeometry(r,SEG(20));g.translate(x,y,z);const pt=push(g,null,null,0xffffff);pt.mat='glass';pt.keepUV=true;return pt};
function holo(z,yb){metal();// EOTech EXPS-style: base, battery hood, window hood
 rbox(.03,.008,.09,0,yb+.004,z-.02,C.alu,.002);rbox(.036,.012,.05,0,yb+.01,z-.045,C.alu,.003);
 profF([[-.019,0],[.019,0],[.019,.034,.004],[-.019,.034,.004]],.042,z+.006,C.alu,{p:[0,yb+.012,0],holes:[[[-.015,.004],[.015,.004],[.015,.03,.002],[-.015,.03,.002]]]});rbox(.036,.008,.042,0,yb+.012,z-.015,C.alu,.002);
 if(det()){rbox(.006,.008,.012,.021,yb+.02,z-.05,C.alu,.002);for(let i=0;i<3;i++)rbox(.004,.004,.004,-.02,yb+.012,z-.035-i*.008,C.dark,.001)}
 const ey=yb+.012+.017;GLS(0,0,ey,z-.012,[.03,.026]);RET('holo',0,ey,z-.0135,.026);return[0,ey,z+.03]}
function t2(z,yb){metal();// Aimpoint T-2 micro on riser
 rbox(.022,.012,.04,0,yb+.006,z,C.alu,.002);const cy=yb+.012+.018;lathe([[.0155,-.026],[.016,-.022],[.0145,-.004],[.0145,.004],[.016,.022],[.0155,.026]],0,cy,z,C.alu,{seg:20});
 cyl(.007,.012,.019,cy,z,C.alu,{ax:'x',seg:12});cyl(.007,.012,0,cy+.019,z,C.alu,{ax:'y',seg:12});
 if(det()){rbox(.03,.006,.026,0,cy-.0165,z,C.alu,.002)}GLS(.0125,0,cy,z-.0245);RET('dot',0,cy,z-.022,.014);return[0,cy,z+.03]}
function acog(z,yb){metal();// Trijicon TA31-style 4x
 rbox(.026,.012,.07,0,yb+.006,z,C.alu,.002);const cy=yb+.012+.024;
 lathe([[.023,-.06],[.023,-.04],[.017,-.03],[.0165,.03],[.0185,.04],[.0185,.06]],0,cy,z,C.alu,{seg:22});rbox(.01,.008,.06,0,cy+.02,z,C.alu,.002);
 if(det()){cyl(.005,.012,0,cy+.022,z-.005,C.red,{ax:'y',seg:8});cyl(.006,.01,.019,cy,z+.0,C.alu,{ax:'x',seg:10})}
 GLS(.021,0,cy,z-.0595);GLS(.017,0,cy,z+.0595);RET('chev',0,cy-.002,z+.03,.022);return[0,cy,z+.09]}
function scope(z,yb,len=.32,r=.0127,ob=.025,c=C.blk){metal();const cy=yb+.03;// rings
 for(const s of[-1,1]){rbox(.02,.022,.016,0,yb+.011,z+s*len*.22,C.alu,.003);tor(r+.003,.003,0,cy,z+s*len*.22,C.alu,Math.PI*2,0,0,0,[6,20])}
 lathe([[ob,-len/2-.01],[ob+.001,-len/2+.03],[r,-len/2+.075],[r,len/2-.075],[r*1.4,len/2-.03],[r*1.45,len/2]],0,cy,z,c,{seg:24});
 cyl(.009,.018,0,cy+r+.008,z,c,{ax:'y',seg:14});cyl(.009,.018,r+.008,cy,z,c,{ax:'x',seg:14});if(det()){cyl(.008,.012,-r-.005,cy,z,c,{ax:'x',seg:12});rbox(.012,.004,.012,0,cy+r+.018,z,C.alu,.001)}
 GLS(ob-.002,0,cy,z-len/2-.0102);GLS(r*1.35,0,cy,z+len/2+.0005);return[0,cy,z+len/2+.06]}
// iron sights: AR front sight base (A-frame) + flip rear
function fsbAR(z,yb,yTop){metal();prof([[z+.012,yb],[z-.012,yb],[z-.008,yTop-.012],[z-.004,yTop],[z+.004,yTop],[z+.008,yTop-.012]],.012,0,C.park,{b:.001});
 profF([[-.008,0],[.008,0],[.008,.016,.003],[-.008,.016,.003]],.008,z,C.park,{p:[0,yTop-.004,0],holes:[[[-.005,.002],[.005,.002],[.005,.013],[-.005,.013]]]});box(.002,.012,.002,0,yTop+.004,z,C.dark);return yTop+.01}
function buis(z,yb){metal();rbox(.024,.008,.03,0,yb+.004,z,C.alu,.002);profF([[-.01,0],[.01,0],[.008,.016,.003],[-.008,.016,.003]],.006,z+.004,C.alu,{p:[0,yb+.008,0],holes:[[[-.0018,.008],[.0018,.008],[.0018,.0116],[-.0018,.0116]]]});return yb+.018}
// ---------- AR-15 / AR-10 family ----------
function AR(o){const R=o.rc??C.alu,F=o.fc??C.poly,big=o.big?1.12:1,yb=.04,hgL=o.hgL||.2,zr=-.105*big,zh=zr-hgL,bl=o.bl||.36,zm=zr-bl;metal();
 // lower receiver (mag well flare, pivot lugs)
 prof([[.072,.014],[.072,0,.004],[.058,-.008],[.03,-.012],[-.03,-.012],[-.032,-.046],[-.04,-.052,.002],[-.094*big,-.052,.002],[-.1*big,-.04],[-.097*big,-.012],[-.078*big,-.004],[-.078*big,.014]],.026,0,R,{b:.0014});
 // upper receiver + brass deflector + forward assist
 prof([[.076,.014],[.076,.05,.003],[.07,.056],[zr,.056],[zr,.014]],.0235,0,R,{b:.0012});
 if(det()){prof([[.03,.044],[.012,.05],[.004,.044]],.006,.0135,R,{b:.0008});cyl(.0062,.026,.0155,.045,.052,R,{seg:12});cyl(.0068,.006,.0155,.045,.039,C.dark,{seg:12})}
 rail(.074,zr+.002,.056,R);
 // ejection port (dark) with the bolt face visible (moves with 'bolt'), dust cover hinged open below it
 box(.002,.013,.046,.0118,.034,-.027,C.dark);if(det())rbox(.0014,.004,.05,.0128,.024,-.027,R,.0008);
 grp('bolt');metal();rbox(.004,.011,.04,.0108,.034,-.03,C.steel,.0015);// bolt carrier through port
 rbox(.032,.007,.012,0,.051,.083,R,.002);rbox(.009,.006,.012,-.014,.051,.086,R,.002);grp(null);// charging handle (pulls back on reload)
 // takedown pins, mag release, bolt catch, selector
 if(det()){pin(.0135,.006,.058);pin(.0135,.006,-.07*big);pin(-.0135,.006,.058);pin(-.0135,.006,-.07*big);cyl(.0045,.004,.0145,-.004,-.022,C.blk,{ax:'x',seg:10});
  prof([[-.03,.005],[-.012,.012],[-.012,.0],[-.03,-.006]],.003,-.0145,R,{b:.0005});prof([[.03,.006],[.044,.012],[.046,.004],[.032,.0]],.003,-.0145,C.blk,{b:.0005})}
 trig(-.032,.03,-.012,R);
 const g=gripAR(-.01,.052,F,.4,.105);
 // stock
 cyl(.0145,.2,0,.04,.175,R,{seg:16});cyl(.018,.009,0,.04,.08,R,{seg:12});
 if(o.stock==='prs'){prof([[.09,.06],[.34,.058,.004],[.35,-.055,.006],[.33,-.065],[.27,-.065],[.27,-.035,.006],[.2,-.02],[.12,.02],[.09,.03]],.04,0,F,{b:.003});buttPad(.355,-.062,.056,.044)}
 else if(o.stock==='a2'){prof([[.075,.058],[.34,.055,.004],[.35,-.06,.006],[.32,-.065],[.075,-.01]],.042,0,F,{b:.003});buttPad(.354,-.062,.054,.044)}
 else{const sopmod=o.stock==='sopmod';prof([[.19,.058],[.305,.056,.004],[.31,-.052,.004],[.29,-.056],[.255,-.03,.004],[.21,-.01],[.19,.024]],sopmod?.05:.04,0,F,{b:.003});
  if(det()){rbox(.012,.014,.1,0,.03,.22,F,.003)}buttPad(.315,-.055,.056,sopmod?.052:.044)}
 // handguard
 metal();const hz=(zr+zh)/2;
 if(o.hg==='quad'){profF([[-.019,-.019,.006],[.019,-.019,.006],[.019,.019,.006],[-.019,.019,.006]],hgL,hz,R,{p:[0,yb,0]});rail(zr,zh,yb+.019,R);
  for(const a of[Math.PI/2,-Math.PI/2,Math.PI])under(about(0,yb,0,RZ(a)),()=>rail(zr-.01,zh+.01,yb+.019,R))}
 else{const r=o.hg==='sr25'?.026:.021;profF([[-r*.42,-r],[r*.42,-r],[r,-r*.42],[r,r*.42],[r*.42,r],[-r*.42,r],[-r,r*.42],[-r,-r*.42]],hgL,hz,R,{p:[0,yb,0],b:.002});rail(zr,zh+.004,yb+r,R);
  if(det())for(let i=0;i<Math.floor(hgL/.045);i++)for(const s of[-1,1]){rbox(.002,.007,.026,s*r*1.0,yb,zr-.03-i*.045,C.dark,.003);under(about(0,yb,0,RZ(s*Math.PI/4)),()=>rbox(.002,.006,.022,s*r*.94,yb,zr-.03-i*.045,C.dark,.003))}}
 // barrel, gas block / front sight, muzzle
 lathe([[.0085,zm-zh],[.0092,(zm-zh)*.5],[.0095,0],[.0095,.02]],0,yb,zh,C.park,{seg:16});
 let fy=0;if(o.fsb)fy=fsbAR(zh-.02,yb+.01,yb+.046);else if(det())rbox(.016,.016,.02,0,yb,zh-.012,C.park,.003);
 if(o.muz==='brake')brake(zm,yb,.0125);else if(o.muz==='supp')suppressor(zm+.01,yb,.019,.15);else birdcage(zm,yb);
 // magazine
 grp('mag');matte();const mz=-.095*big;
 if(o.mag==='sr25')boxMag(mz,-.012,.07,.12,.024,o.magC??C.poly,.012);else boxMag(mz,-.012,.06,.165,.022,o.magC??C.poly,.024);grp(null);
 // optic / sights
 let eye;if(o.optic==='holo')eye=holo(.0,.06);else if(o.optic==='acog')eye=acog(.0,.06);else if(o.optic==='t2')eye=t2(-.01,.06);else if(o.optic==='scope')eye=scope(.0,.06,.3,.0127,.024);
 if(o.buis!==false&&o.optic!=='scope'){buis(.062,.06)}
 if(!eye){const ry=buis(.062,.06);eye=[0,ry-.004,.15]}
 if(o.bipod&&det()){for(const s of[-1,1])rbox(.008,.008,.13,s*.01,yb-.03,zh+.07,C.blk,.002)}
 return{muzzle:[0,yb,zm-.05],eject:[.013,.036,-.03],sight:eye,grip:g,lh:[0,yb,zr-hgL*.55],lhT:'under',lhR:o.hg==='quad'?.024:.026,len:.8,rl:'mag',hold:'rifle',piv:{mag:[0,-.01,mz+.03]},boltBack:.045,shellT:'rifle'}}
// ---------- AK-47 ----------
function AK(o={}){metal();const R=C.park,W=o.wood??C.wood,yb=.034;
 prof([[.095,.004],[.095,.046,.004],[.086,.054,.006],[-.155,.054],[-.155,.004]],.03,0,R,{b:.0014});// receiver
 prof([[.108,.046],[.1,.064,.01],[-.09,.064,.012],[-.096,.05],[-.096,.046]],.032,0,R,{b:.0018});// dust cover
 if(det()){for(let i=0;i<3;i++)rbox(.0335,.003,.11-i*.02,0,.052+i*.004,.0-i*.004,R,.001);sph(.004,0,.06,.109,R)}
 prof([[-.096,.054],[-.155,.054],[-.155,.07],[-.14,.072],[-.1,.064]],.026,0,R,{b:.0012});// rear sight block
 if(det()){rbox(.012,.004,.05,0,.07,-.12,R,.001);rbox(.016,.006,.006,0,.072,-.098,R,.001)}
 grp('bolt');rbox(.005,.008,.08,.017,.034,-.04,C.steel,.002);cyl(.005,.016,.026,.034,-.072,C.steel,{ax:'x',seg:10});sph(.0065,.034,.034,-.072,C.steel);grp(null);// charging handle
 box(.002,.016,.07,.0152,.03,-.03,C.dark);// ejection port
 if(det()){prof([[.07,.042],[-.02,.03],[-.024,.02],[.07,.032]],.003,.0158,R,{b:.0005});for(const z of[.06,.03,-.12])pin(.0155,.012,z)}// selector lever
 trig(-.04,.05,.004,R,.006);
 matte();const g=gripAR(.0,.062,o.gripC??C.woodD,.3,.1,.03);
 mat('wood');prof([[.095,.046],[.2,.036],[.44,.022,.006],[.452,.02],[.452,-.106,.004],[.44,-.11],[.3,-.052],[.16,-.008,.01],[.095,0]],.036,0,W,{b:.004});
 metal();rbox(.04,.13,.006,0,-.044,.456,R,.003);
 // handguards (wood), gas tube, front sight, muzzle
 mat('wood');prof([[-.155,.046],[-.36,.046],[-.37,.036,.01],[-.36,-.004,.012],[-.18,-.006,.01],[-.155,.0]],.042,0,W,{b:.006,cs:8});
 if(det())for(let i=0;i<3;i++)rbox(.0435,.004,.01,0,-.002,-.21-i*.05,C.woodD,.002);
 prof([[-.165,.05],[-.34,.05],[-.345,.064,.008],[-.17,.074,.01]],.032,0,W,{b:.005});metal();
 cyl(.0085,.07,0,.066,-.375,R,{seg:12});prof([[-.405,.074],[-.43,.074],[-.43,.02],[-.405,.02]],.022,0,R,{b:.0015});
 lathe([[.0085,-.15],[.009,-.05],[.0095,0]],0,yb,-.405,R,{seg:14});
 prof([[-.505,.024],[-.535,.024],[-.53,.07],[-.512,.07]],.02,0,R,{b:.0014});tor(.009,.0018,0,.078,-.522,R,Math.PI,0,Math.PI/2,0,[6,12]);box(.0025,.012,.0025,0,.078,-.522,R);
 lathe([[.008,-.03],[.0105,-.028],[.0105,0]],0,yb,-.555,R,{seg:12});
 if(det())cyl(.0028,.17,0,.017,-.46,C.steel,{seg:8});
 grp('mag');mat('poly');bananaMag(-.075,.004,.3,40,.062,.026,o.magC??0x7b3a1d);grp(null);
 return{muzzle:[0,yb,-.6],eject:[.016,.03,-.03],sight:[0,.075,.12],grip:g,lh:[0,.018,-.27],lhT:'under',lhR:.03,len:.88,rl:'mag',hold:'rifle',piv:{mag:[0,0,-.07]},boltBack:.07,shellT:'rifle'}}
// ---------- SCAR-H ----------
function SCAR(){const F=C.fde,R=C.fde,yb=.042;metal();
 prof([[.08,.02],[.08,.066,.003],[-.25,.066],[-.26,.05],[-.26,.02]],.034,0,R,{b:.0025});rail(.078,-.258,.066,C.fde);
 for(const s of[-1,1])under(about(0,yb,0,RZ(s*Math.PI/2)),()=>rail(-.15,-.255,yb+.017,C.fde));
 box(.002,.014,.05,.0172,.04,-.01,C.dark);grp('bolt');rbox(.012,.008,.012,-.022,.052,-.08,C.blk,.003);rbox(.004,.012,.012,-.017,.052,-.08,C.blk,.002);rbox(.004,.01,.04,.0158,.04,-.012,C.steel,.002);grp(null);
 matte();prof([[.07,.02],[.07,0,.004],[.03,-.012],[-.034,-.012],[-.036,-.05],[-.1,-.05,.003],[-.106,-.02],[-.1,.02]],.03,0,C.blk,{b:.0016});trig(-.034,.03,-.012,C.blk);
 const g=gripAR(-.01,.052,C.blk,.36,.1);
 prof([[.08,.062],[.33,.06,.004],[.335,-.05,.006],[.31,-.058],[.22,-.008],[.12,.01],[.08,.024]],.04,0,F,{b:.003,holes:[[[.13,.022],[.26,.022],[.26,.04,.006],[.13,.04,.006]]]});
 rbox(.03,.012,.1,0,.068,.22,C.blk,.004);buttPad(.34,-.056,.058,.046);
 metal();lathe([[.0095,-.17],[.01,0]],0,yb,-.26,C.park,{seg:16});brake(-.43,yb,.013);
 grp('mag');matte();boxMag(-.103,-.012,.07,.12,.024,C.blk,.014);grp(null);
 const eye=acog(-.01,.066);
 return{muzzle:[0,yb,-.49],eject:[.017,.04,-.01],sight:eye,grip:g,lh:[0,yb-.004,-.2],lhT:'under',lhR:.024,len:.9,rl:'mag',hold:'rifle',piv:{mag:[0,-.01,-.07]},boltBack:.05,shellT:'rifle'}}
// ---------- HK G3 battle rifle (olive furniture, ACOG on claw mount) ----------
function G3(){const R=C.park,F=C.od,yb=.034;metal();
 prof([[.1,.002],[.1,.05,.006],[.09,.06,.006],[-.2,.06,.008],[-.2,.002]],.03,0,R,{b:.0016});
 if(det())for(const s of[-1,1])rbox(.0012,.008,.26,s*.0155,.05,-.05,C.blk,.002);
 cyl(.0115,.18,0,.068,-.29,R,{seg:16});grp('bolt');cyl(.006,.03,-.018,.068,-.25,R,{ax:'x',seg:10});sph(.0065,-.034,.068,-.25,R);grp(null);
 box(.002,.012,.05,.0152,.032,-.03,C.dark);
 // drum rear sight + hooded front post
 cyl(.011,.012,0,.07,.075,R,{ax:'x',seg:16});profF([[-.012,0],[.012,0],[.008,.028,.006],[-.008,.028,.006]],.01,-.38,R,{p:[0,.055,0],holes:[[[-.006,.008],[.006,.008],[.004,.022,.004],[-.004,.022,.004]]]});
 matte();prof([[.09,.002],[.09,-.012,.004],[.03,-.014],[-.032,-.014],[-.04,-.008],[-.04,.002]],.032,0,F,{b:.0016});trig(-.032,.03,-.014,F);
 const g=gripAR(-.012,.055,F,.32,.1);
 prof([[.1,.058],[.39,.05,.006],[.4,-.075,.006],[.37,-.08],[.1,-.012]],.04,0,F,{b:.003});buttPad(.404,-.078,.052,.044,C.blk);
 prof([[-.2,.056],[-.4,.054],[-.405,.0,.01],[-.2,-.006,.01]],.046,0,F,{b:.004});if(det())for(let i=0;i<5;i++)rbox(.047,.003,.008,0,.025,-.23-i*.032,C.blk,.001);
 metal();lathe([[.0085,-.13],[.0095,0]],0,yb,-.4,R,{seg:14});birdcage(-.53,yb,.011);
 grp('mag');boxMag(-.11,.002,.066,.13,.026,C.park,.012);grp(null);
 metal();rbox(.028,.014,.07,0,.064,-.03,R,.002);const eye=acog(-.03,.071);
 return{muzzle:[0,yb,-.6],eject:[.016,.032,-.03],sight:eye,grip:g,lh:[0,.024,-.3],lhT:'under',lhR:.028,len:.98,rl:'mag',hold:'rifle',piv:{mag:[0,0,-.08]},boltBack:.05,shellT:'rifle'}}
// ---------- Steyr AUG A3 (bullpup) ----------
function AUG(){const F=C.od,yb=.04;matte();
 prof([[.38,.058,.01],[.38,-.062,.012],[.3,-.075,.018],[.16,-.055,.012],[.07,-.03,.01],[-.05,-.022],[-.13,-.012,.01],[-.15,.02,.01],[-.14,.04],[.1,.05,.02],[.25,.062,.03]],.052,0,F,{b:.006,cs:8});
 // enclosed grip + big trigger guard loop
 prof([[-.03,-.02],[.03,-.02],[.04,-.13,.012],[.0,-.135,.01],[-.13,-.11,.02],[-.15,-.03,.012],[-.12,-.02]],.03,0,F,{b:.003,holes:[[[-.115,-.035,.01],[-.03,-.035,.006],[-.012,-.11,.01],[-.11,-.098,.016],[-.128,-.05,.01]]]});
 const g={c:[0,-.065,.01],a:.15,w:.03};
 metal();rbox(.032,.024,.26,0,.068,-.02,C.blk,.004);rail(.1,-.14,.08,C.blk);
 lathe([[.0095,-.3],[.011,-.05],[.017,-.04],[.017,0]],0,yb,-.13,C.park,{seg:16});if(det())for(let i=0;i<4;i++)lathe([[.0115,-.004],[.0115,.004]],0,yb,-.25-i*.035,C.blk,{seg:14});
 birdcage(-.43,yb,.0115);
 // folding foregrip
 matte();prof([[-.255,.025],[-.225,.025],[-.226,-.08,.008],[-.256,-.08,.008]],.026,0,F,{b:.003});
 grp('bolt');rbox(.012,.012,.014,-.03,.05,-.08,C.blk,.004);grp(null);
 grp('mag');mat('trans');boxMag(.05,-.03,.056,.15,.022,0x30343a,.02);grp(null);
 const eye=t2(-.0,.08);
 return{muzzle:[0,yb,-.48],eject:[.027,.03,.12],sight:eye,grip:g,lh:[0,-.03,-.24],lhT:'vert',len:.79,rl:'mag',hold:'rifle',piv:{mag:[0,-.03,.08]},boltBack:.05,shellT:'rifle'}}
// ---------- Uzi ----------
function UZI(){const R=C.park,yb=.038;metal();
 prof([[.12,.002],[.12,.058,.006],[-.13,.058,.006],[-.13,.002]],.036,0,R,{b:.002});
 if(det())for(let i=0;i<6;i++)rbox(.03,.002,.012,0,.059,.09-i*.035,C.blk,.001);
 grp('bolt');rbox(.008,.012,.016,0,.066,-.02,R,.004);grp(null);
 box(.002,.014,.04,.0182,.04,-.04,C.dark);
 cyl(.016,.02,0,yb,-.14,R,{seg:16});if(det())for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rbox(.004,.004,.022,Math.cos(a)*.016,yb+Math.sin(a)*.016,-.14,R,.001)}
 cyl(.0075,.04,0,yb,-.17,R,{seg:12});
 for(const s of[-1,1])rbox(.004,.018,.01,s*.01,.068,-.115,R,.001);box(.002,.01,.002,0,.066,-.115,R);rbox(.016,.01,.012,0,.064,.1,R,.002);
 matte();const g=gripAR(.002,.035,C.poly,.12,.11,.032);trig(-.04,.012,.002,R);
 if(det())rbox(.008,.05,.012,0,-.02,.052,R,.002,.12);// grip safety
 metal();for(const s of[-1,1])rbox(.005,.006,.2,s*.019,.03,.22,R,.002);rbox(.05,.07,.008,0,.01,.32,R,.003);
 grp('mag');boxMag(.022,-.002,.032,.2,.022,C.park,0,true);grp(null);
 return{muzzle:[0,yb,-.19],eject:[.018,.04,-.04],sight:[0,.074,.2],grip:g,lh:[0,.0,-.1],lhT:'under',lhR:.026,len:.47,rl:'mag',hold:'rifle',piv:{mag:[0,-.05,.04]},boltBack:.05,shellT:'pistol',magInGrip:1}}
// ---------- CZ Scorpion EVO 3 ("Viper") ----------
function EVO(){const yb=.04;matte();
 prof([[.07,.01],[.07,.064,.004],[-.15,.064,.004],[-.18,.05],[-.18,.012],[-.12,.0],[-.03,.0]],.034,0,C.poly,{b:.0025});rail(.068,-.15,.064,C.blk);
 if(det()){for(let i=0;i<4;i++)rbox(.035,.006,.012,0,.035,-.14+i*.016,C.dark,.002)}
 prof([[-.03,.002],[-.07,.002],[-.1,-.03],[-.06,-.03]],.03,0,C.poly,{b:.002});trig(-.04,.02,.0,C.poly);const g=gripAR(.0,.04,C.poly,.3,.1,.03);
 grp('bolt');rbox(.012,.012,.016,-.022,.05,-.14,C.blk,.004);grp(null);
 metal();cyl(.008,.03,0,yb,-.195,C.park,{seg:12});comp(-.21,yb,.012);
 matte();prof([[.07,.06],[.24,.054,.004],[.25,-.05,.006],[.22,-.055],[.1,-.0],[.07,.0]],.03,0,C.poly,{b:.003,holes:[[[.1,.012],[.2,.012],[.2,.04,.006],[.1,.044,.006]]]});buttPad(.252,-.05,.052,.036);
 grp('mag');mat('trans');boxMag(-.085,-.0,.04,.15,.022,0x3a3e44,.035);grp(null);
 const eye=t2(-.02,.064);
 return{muzzle:[0,yb,-.25],eject:[.018,.045,-.05],sight:eye,grip:g,lh:[0,.02,-.15],lhT:'under',lhR:.025,len:.55,rl:'mag',hold:'rifle',piv:{mag:[0,-.01,-.065]},boltBack:.05,shellT:'pistol'}}
// ---------- PP-19 Bizon (helical mag) ----------
function BIZON(){const R=C.park,yb=.04;metal();
 prof([[.09,.0],[.09,.048,.004],[.082,.056,.006],[-.12,.056],[-.12,.0]],.03,0,R,{b:.0014});prof([[.1,.048],[.094,.062,.008],[-.06,.062,.01],[-.066,.048]],.032,0,R,{b:.0018});
 grp('bolt');rbox(.005,.008,.05,.017,.034,-.03,C.steel,.002);sph(.006,.028,.034,-.055,C.steel);grp(null);box(.002,.016,.05,.0152,.03,-.03,C.dark);
 trig(-.035,.04,.0,R,.006);matte();const g=gripAR(-.002,.058,C.poly,.3,.1,.03);
 metal();for(const s of[-1,1])prof([[.09,.04],[.3,.03],[.3,-.06],[.27,-.06],[.27,.016],[.1,.02]],.006,s*.016,R,{b:.001});rbox(.04,.1,.008,0,-.012,.3,R,.003);
 lathe([[.0085,-.2],[.009,0]],0,yb,-.12,R,{seg:12});prof([[-.29,.03],[-.31,.03],[-.305,.075],[-.295,.075]],.016,0,R);lathe([[.012,-.04],[.012,0]],0,yb,-.32,R,{seg:12});
 rbox(.024,.016,.03,0,.064,-.08,R,.002);
 grp('mag');matte();lathe([[.02,-.3],[.028,-.29],[.029,-.02],[.026,0]],0,-.01,-.02,0x2e3033,{seg:22});if(det())for(let i=0;i<7;i++)lathe([[.0295,-.003],[.0295,.003]],0,-.01,-.06-i*.032,C.dark,{seg:22});grp(null);
 return{muzzle:[0,yb,-.36],eject:[.016,.03,-.03],sight:[0,.072,.15],grip:g,lh:[0,-.01,-.2],lhT:'under',lhR:.032,len:.66,rl:'mag',hold:'rifle',piv:{mag:[0,-.01,-.15]},magFwd:1,boltBack:.05,shellT:'pistol'}}
// ---------- HK MP5A3 ----------
function MP5(){const R=C.park,yb=.04;metal();
 prof([[.075,.012],[.075,.056,.008],[-.16,.06,.012],[-.16,.012]],.03,0,R,{b:.0018});// stamped receiver
 cyl(.0105,.12,0,.066,-.21,R,{seg:16});// cocking tube
 grp('bolt');cyl(.0045,.03,-.02,.066,-.19,R,{ax:'x',seg:10});sph(.006,-.036,.066,-.19,R);grp(null);
 box(.002,.012,.04,.0152,.036,-.03,C.dark);
 // rear drum sight + hooded front ("drum-front") sight ring
 cyl(.011,.012,0,.072,.06,R,{ax:'x',seg:18});rbox(.022,.01,.02,0,.062,.06,R,.002);
 tor(.0115,.0025,0,.088,-.25,R,Math.PI*2,0,0,0,[6,20]);prof([[-.24,.064],[-.26,.064],[-.256,.08],[-.244,.08]],.012,0,R);box(.002,.01,.002,0,.086,-.25,R);
 // slimline handguard
 matte();prof([[-.16,.05],[-.25,.05],[-.255,.03,.008],[-.25,.0,.01],[-.17,-.004,.01],[-.16,.0]],.04,0,C.poly,{b:.006,cs:8});
 if(det())for(let i=0;i<4;i++)rbox(.041,.003,.006,0,.014,-.18-i*.018,C.dark,.001);
 metal();lathe([[.009,-.05],[.0095,0]],0,yb,-.255,R,{seg:14});for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2;if(det())rbox(.004,.004,.012,Math.cos(a)*.011,yb+Math.sin(a)*.011,-.29,R,.001)}
 // Navy lower w/ integral trigger guard
 matte();prof([[.075,.012],[.075,-.006,.004],[.035,-.012],[-.04,-.012],[-.044,.012]],.032,0,C.poly,{b:.002});trig(-.04,.03,-.012,C.poly);const g=gripAR(-.012,.052,C.poly,.3,.1,.032);
 // A3 retractable stock
 metal();for(const s of[-1,1])rbox(.006,.008,.2,s*.015,.04,.17,R,.002);rbox(.05,.11,.012,0,.0,.275,R,.004);buttPad(.285,-.055,.055,.044);
 grp('mag');boxMag(-.09,.012,.036,.16,.02,C.park,.05);grp(null);
 return{muzzle:[0,yb,-.31],eject:[.016,.036,-.03],sight:[0,.078,.15],grip:g,lh:[0,.02,-.2],lhT:'under',lhR:.026,len:.66,rl:'mag',hold:'rifle',piv:{mag:[0,0,-.07]},boltBack:.06,shellT:'pistol'}}
// ---------- HK MP7 ----------
function MP7(){const yb=.042;matte();
 prof([[.07,.0],[.07,.066,.006],[-.12,.066,.006],[-.135,.05],[-.135,.012],[-.1,.0]],.04,0,C.poly,{b:.004});rail(.066,-.12,.066,C.blk);
 for(const s of[-1,1])under(about(0,.042,0,RZ(s*Math.PI/2)),()=>rail(-.06,-.125,.042+.02,C.blk));
 const g=gripAR(-.0,.025,C.poly,.18,.11,.032);trig(-.045,.008,.0,C.poly);
 prof([[-.095,.0],[-.12,.0],[-.13,-.08,.006],[-.105,-.08,.006]],.026,0,C.poly,{b:.003});// folding foregrip
 metal();cyl(.008,.04,0,yb,-.155,C.park,{seg:12});lathe([[.011,-.02],[.011,0]],0,yb,-.17,C.park,{seg:12});
 grp('bolt');rbox(.03,.008,.012,0,.06,.072,C.blk,.002);grp(null);
 for(const s of[-1,1])rbox(.006,.008,.14,s*.017,.03,.13,C.blk,.002);rbox(.046,.07,.012,0,.02,.2,C.poly,.004);
 grp('mag');boxMag(.012,-.02,.034,.17,.022,C.poly,.0);grp(null);
 const eye=t2(-.03,.066);
 return{muzzle:[0,yb,-.2],eject:[.02,.045,-.03],sight:eye,grip:g,lh:[0,-.04,-.118],lhT:'vert',len:.42,rl:'mag',hold:'rifle',piv:{mag:[0,-.05,.03]},boltBack:.04,shellT:'pistol',magInGrip:1}}
// ---------- KRISS Vector (boxy Super-V lower) ----------
function VECTOR(){const yb=.03;matte();
 prof([[.08,.02],[.08,.074,.004],[-.18,.074,.004],[-.18,.03],[-.12,.02]],.04,0,C.poly,{b:.003});rail(.078,-.178,.074,C.blk);
 prof([[.05,.022],[.05,-.01,.004],[.02,-.03],[-.06,-.03],[-.1,-.07,.006],[-.17,-.07,.006],[-.19,-.02,.01],[-.18,.022]],.044,0,C.poly,{b:.004});
 if(det())for(let i=0;i<3;i++)rbox(.045,.004,.03,0,-.05,-.12-i*.006,C.dark,.001,-.6);
 metal();lathe([[.0085,-.06],[.01,0]],0,yb,-.18,C.park,{seg:14});lathe([[.012,-.035],[.012,0]],0,yb,-.235,C.park,{seg:14});
 matte();const g=gripAR(-.025,.045,C.poly,.18,.1,.032);trig(-.04,.022,-.025,C.poly);
 for(const s of[-1,1])rbox(.006,.012,.2,s*.012,.05,.18,C.blk,.003);rbox(.04,.1,.012,0,.02,.285,C.poly,.004);
 grp('bolt');rbox(.012,.012,.014,-.026,.06,-.12,C.blk,.004);grp(null);
 grp('mag');boxMag(-.07,-.03,.036,.15,.022,C.poly,.02);grp(null);
 const eye=t2(-.03,.078);
 return{muzzle:[0,yb,-.27],eject:[.022,.05,-.02],sight:eye,grip:g,lh:[0,-.07,-.135],lhT:'vert',len:.6,rl:'mag',hold:'rifle',piv:{mag:[0,-.05,-.05]},boltBack:.04,shellT:'pistol'}}
// ---------- FN P90 (bulbous bullpup, top mag, thumbhole) ----------
function P90(){const yb=.0,F=0x2c2f33;matte();
 prof([[.2,.05,.02],[.212,-.02,.03],[.19,-.122,.025],[-.14,-.126,.02],[-.17,-.04,.02],[-.24,-.012,.01],[-.24,.03,.006],[-.06,.05,.02]],.056,0,F,
  {b:.007,cs:8,holes:[[[.075,-.036,.01],[.15,-.036,.012],[.165,-.1,.014],[.08,-.106,.01]],[[-.004,-.046,.008],[-.11,-.046,.01],[-.13,-.1,.014],[-.06,-.108,.01],[-.008,-.104,.008]]]});
 prof([[-.006,-.05],[-.012,-.062,.004],[-.006,-.074,.003],[-.001,-.072],[-.004,-.062,.004],[.001,-.05]],.006,0,C.dark,{b:.0006});
 const g={c:[0,-.075,.034],a:.1,w:.034};
 grp('mag');mat('trans');rbox(.044,.022,.3,0,.062,-.01,0x6a6040,.006);if(det()){mat('brass');for(let i=0;i<14;i++)box(.012,.006,.012,0,.06,.12-i*.02,C.brass)}grp(null);
 metal();rbox(.03,.012,.14,0,.08,-.02,C.blk,.003);const eye=(()=>{const cy=.105;rbox(.03,.03,.04,0,.09,-.0,C.blk,.006);GLS(0,0,cy,-.021,[.022,.016]);RET('dot',0,cy,-.022,.012);return[0,cy,.06]})();
 cyl(.008,.03,0,.012,-.255,C.park,{seg:12});lathe([[.011,-.012],[.011,0]],0,.012,-.27,C.park,{seg:12});
 grp('bolt');for(const s of[-1,1])rbox(.008,.008,.016,s*.032,.02,-.18,C.blk,.003);grp(null);
 return{muzzle:[0,.012,-.29],eject:[0,-.1,.11],ejDown:1,sight:eye,grip:g,trigP:[0,-.062,-.004],lh:[0,-.07,-.14],lhT:'vert',len:.5,rl:'mag',hold:'rifle',piv:{mag:[0,.062,-.01]},magTop:1,boltBack:.03,shellT:'pistol'}}
// ---------- bolt-action family (Remington 700 / AWM / Scout) ----------
function BOLTGUN(o){const yb=.056,S=o.sc;
 if(o.kind==='awm'){matte();// chassis stock with thumbhole + adjustable cheek
  prof([[-.38,.046],[-.38,.006,.01],[-.06,-.012],[-.03,-.03],[.12,-.03],[.36,-.06],[.48,-.075,.004],[.49,-.075],[.49,.05,.006],[.44,.056],[.3,.056,.01],[.2,.045],[.07,.046]],.044,0,S,
   {b:.004,holes:[[[.07,.02],[.16,.012,.01],[.18,-.02,.01],[.12,-.022],[.075,-.006,.006]],[[.22,.02],[.4,.02,.01],[.42,-.045,.01],[.3,-.04,.01]]]});
  buttPad(.495,-.073,.048,.048);if(det())for(let i=0;i<5;i++)rbox(.045,.004,.03,0,.03,-.3+i*.05,C.dark,.002)}
 else if(o.kind==='scout'){matte();prof([[-.32,.046],[-.32,.006,.012],[-.04,-.012],[.0,-.03],[.04,-.04],[.1,-.11,.01],[.135,-.106,.01],[.13,-.06],[.17,-.05],[.42,-.088,.006],[.43,-.09],[.43,.04,.006],[.38,.046],[.15,.05,.02],[.07,.046]],.042,0,S,{b:.005});buttPad(.435,-.088,.04,.044)}
 else{mat('wood');prof([[-.4,.046],[-.4,.01,.012],[-.3,-.006],[-.06,-.02],[-.02,-.036],[.04,-.044],[.075,-.112,.01],[.11,-.11,.01],[.105,-.07],[.15,-.058],[.37,-.1],[.47,-.112,.006],[.48,-.112],[.48,.036,.006],[.42,.05,.01],[.2,.052,.02],[.1,.034,.01],[.07,.046]],.044,0,S,{b:.005,cs:8});
  if(det()){for(let i=0;i<3;i++)rbox(.0442,.002,.03,0,-.075-i*.008,.08+i*.004,C.woodD,.001,.3)}buttPad(.485,-.11,.034,.046,C.rub)}
 metal();const g={c:[0,-.07,.085],a:.35,w:.034};
 cyl(.018,.21,0,yb,-.025,C.park,{seg:20});// receiver
 box(.002,.012,.05,.018,yb+.006,-.0,C.dark);
 lathe([[o.br*.78,o.zm+.13],[o.br*.85,(o.zm+.13)*.5],[o.br,0]],0,yb,-.13,o.bc??C.park,{seg:18});
 if(o.fluted&&det())for(let i=0;i<6;i++){const a=i/6*Math.PI*2;rbox(.002,.002,.22,Math.cos(a)*o.br*.86,yb+Math.sin(a)*o.br*.86,-.32,C.dark,.0008,0,0,a)}
 if(o.brake)brake(o.zm,yb,o.br*1.2,C.park,.06);else lathe([[o.br*.6,-.005],[o.br*.8,0]],0,yb,o.zm,C.park);
 trig(-.03,.04,-.02,C.blk);
 grp('bolt');cyl(.009,.05,0,yb,.1,C.steel,{seg:14});under(about(0,yb,.07,RZ(-.12)),()=>{cyl(.0045,.045,.024,yb,.07,C.steel,{ax:'x',seg:10});sph(.009,.048,yb,.07,C.blk)});grp(null);
 grp('mag');boxMag(-.075,-.012,.064,.06,.024,C.blk,0);grp(null);
 if(o.bipod&&det()){for(const s of[-1,1])rbox(.008,.008,.17,s*.012,-.005,-.27,C.blk,.002);cyl(.012,.02,0,.01,-.35,C.blk,{ax:'x',seg:12})}
 const eye=scope(-.03,.074,o.sl||.34,.0127,o.ob||.026);
 return{muzzle:[0,yb,o.zm-.06],eject:[.02,yb+.006,.0],sight:eye,grip:g,lh:[0,.03,-.25],lhT:'under',lhR:.03,len:1,rl:'bolt',cyc:'bolt',hold:'rifle',piv:{bolt:[0,yb,.07],mag:[0,-.02,-.04]},boltBack:.08,shellT:'rifle'}}
// ---------- Henry lever action (brass receiver, octagon barrel, tube mag) ----------
function LEVER(){const yb=.045;mat('brass');
 prof([[.07,.0],[.075,.04,.012],[.06,.06,.008],[-.1,.06],[-.1,.0]],.03,0,C.brass,{b:.002});
 if(det()){metal();box(.002,.014,.05,.0152,.045,-.02,C.dark);rbox(.006,.016,.012,0,.07,.062,C.park,.002,.4);pin(.0155,.02,-.06,.003,C.park);pin(.0155,.02,.04,.003,C.park)}
 metal();cyl(.011,.45,0,yb,-.325,C.park,{seg:8});cyl(.0085,.42,0,.023,-.31,C.park,{seg:14});mat('brass');cyl(.0095,.02,0,.023,-.52,C.brass,{seg:14});
 metal();rbox(.006,.008,.02,0,.06,-.15,C.park,.002);rbox(.004,.01,.004,0,.059,-.53,C.park,.001);
 mat('wood');prof([[-.1,.04],[-.29,.04],[-.3,.015,.01],[-.29,.004,.008],[-.1,.0]],.036,0,C.wood,{b:.005});
 prof([[.07,.052],[.43,.03,.006],[.44,-.1,.006],[.4,-.105],[.16,-.035,.02],[.07,-.002]],.04,0,C.wood,{b:.005});mat('brass');rbox(.042,.13,.006,0,-.035,.442,C.brass,.002,0,0,.0);
 grp('lever');metal();prof([[-.04,.0],[.07,.0],[.11,-.03,.02],[.1,-.075,.02],[.05,-.08,.014],[.035,-.03,.008],[-.04,-.008]],.008,0,C.park,{b:.0014,holes:[[[.045,-.012],[.095,-.016,.012],[.09,-.066,.014],[.055,-.068,.01],[.048,-.04,.006]]]});grp(null);
 trig(-.02,.02,.0,C.park);
 return{muzzle:[0,yb,-.56],eject:[0,.07,-.02],ejUp:1,sight:[0,.072,.15],grip:{c:[0,-.02,.13],a:.9,w:.034},lh:[0,.02,-.2],lhT:'under',lhR:.028,len:.98,rl:'shells',cyc:'lever',hold:'rifle',piv:{lever:[-.035,-.004,0]},shellT:'rifle',loadPort:[.02,.02,-.04]}}
// ---------- Remington 870 / Benelli M4 ----------
function SHOTGUN(o){const yb=.05,R=o.rc??C.blk;metal();
 prof([[.075,.0],[.075,.05,.012],[.06,.066,.01],[-.13,.066],[-.13,.0]],.032,0,R,{b:.002});box(.002,.02,.06,.0162,.042,-.04,C.dark);
 if(det()){pin(.0165,.012,.04,.003);pin(.0165,.012,-.08,.003);box(.002,.012,.05,-.0162,.02,-.04,C.dark)}
 lathe([[.0115,o.zm+.13],[.0125,0]],0,yb,-.13,C.park,{seg:18});lathe([[.012,-.02],[.0125,0]],0,yb,o.zm,C.park,{seg:18});
 if(o.rib&&det()){rbox(.006,.004,-(o.zm+.13),0,yb+.014,(o.zm-.13)/2,C.park,.001);sph(.0022,0,yb+.018,o.zm+.005,C.chrome)}
 cyl(.011,-(o.zm+.13)-.06,0,.022,(o.zm-.13)/2+.03,C.park,{seg:14});lathe([[.008,-.012],[.0115,-.006],[.0115,0]],0,.022,o.zm+.06,C.park);
 trig(-.03,.04,.0,R);
 grp('pump');if(o.pump){mat(o.wood?'wood':'poly');lathe([[.018,-.19],[.022,-.18],[.023,-.02],[.019,0]],0,.024,-.14,o.fc,{seg:20});if(det())for(let i=0;i<7;i++)lathe([[.0235,-.003],[.0235,.003]],0,.024,-.18-i*.018,C.dark,{seg:20})}grp(null);
 if(!o.pump){matte();prof([[-.13,.05],[-.32,.05],[-.33,.02,.01],[-.32,-.0,.01],[-.13,.0]],.044,0,o.fc,{b:.006});rail(.07,-.12,.066,C.blk)}
 let g;if(o.wood){mat('wood');prof([[.075,.054],[.2,.04],[.43,.03,.006],[.44,-.11,.006],[.41,-.115],[.18,-.05,.01],[.12,-.075,.01],[.09,-.075,.008],[.075,-.002]],.042,0,o.fc,{b:.005,cs:8});buttPad(.445,-.112,.028,.046);g={c:[0,-.04,.11],a:.6,w:.036}}
 else{matte();g=gripAR(-.004,.055,C.poly,.36,.105,.03);cyl(.0145,.2,0,.04,.17,C.blk,{seg:14});prof([[.18,.058],[.31,.056,.004],[.315,-.055,.004],[.29,-.058],[.18,.022]],.044,0,C.poly,{b:.003});buttPad(.32,-.055,.056,.046)}
 let eye;if(o.optic)eye=t2(.0,.066);else eye=[0,yb+.02,.2];
 return{muzzle:[0,yb,o.zm-.02],eject:[.017,.042,-.04],sight:eye,grip:g,lh:[0,.024,o.pump?-.23:-.24],lhT:'under',lhR:.032,lhPump:!!o.pump,len:.95,rl:'shells',cyc:o.pump?'pump':null,hold:'rifle',piv:{},shellT:'shot',loadPort:[0,-.004,-.06]}}
// ---------- side-by-side coach gun ----------
function DOUBLE(){const yb=.05;metal();
 prof([[.07,.0],[.07,.05,.01],[.05,.064],[-.02,.064],[-.02,.0]],.044,0,C.steel,{b:.002});
 if(det()){for(const s of[-1,1]){under(about(s*.012,.07,.06,RX(-.3)),()=>rbox(.008,.02,.012,s*.012,.075,.06,C.park,.003))}rbox(.012,.006,.03,0,.068,.05,C.park,.002)}
 trig(-.025,.04,.0,C.steel);trig(-.015,.05,.0,C.steel,.004);
 mat('wood');prof([[.07,.054],[.42,.03,.006],[.43,-.11,.006],[.4,-.115],[.18,-.05,.01],[.12,-.075,.01],[.09,-.075,.008],[.07,-.0]],.042,0,C.wood,{b:.005});buttPad(.435,-.112,.028,.046,C.woodD);
 grp('barrel');metal();for(const s of[-1,1])lathe([[.0115,-.5],[.0125,-.02],[.0135,0]],s*.0128,yb,-.02,C.park,{seg:18});rbox(.008,.006,.49,0,yb+.012,-.27,C.park,.001);sph(.0025,0,yb+.017,-.51,C.chrome);
 rbox(.024,.024,.03,0,yb-.012,-.035,C.steel,.004);mat('wood');prof([[-.04,.04],[-.24,.04],[-.25,.022,.01],[-.24,.012,.01],[-.04,.008]],.04,0,C.wood,{b:.006});grp(null);
 return{muzzle:[0,yb,-.53],sight:[0,yb+.03,.2],grip:{c:[0,-.04,.11],a:.6,w:.036},lh:[0,.02,-.15],lhT:'under',lhR:.03,lhBarrel:1,len:.95,rl:'break',hold:'rifle',piv:{barrel:[0,.03,-.025]},noShell:1,shellT:'shot'}}
// ---------- pistols (origin = trigger; bore y .046) ----------
const pgrip={c:[0,-.04,.046],a:.3,w:.032};
function pistolMag(z0,z1,yBot,w,c,top=.0){grp('mag');matte();const sl=.3;prof([[z0,top],[z1,top],[z1+(-yBot+top)*sl,yBot],[z0+(-yBot+top)*sl,yBot]],w,0,c,{b:.0012});rbox(w+.004,.008,z1-z0+.008,0,yBot-.003,(z0+z1)/2+(-yBot)*sl,c,.002);grp(null)}
// Beretta M9 / 93R
function BERETTA(o={}){const R=C.blk,yb=.046;const L=o.r93?-.185:-.165;
 grp('slide');metal();prof([[.046,.028],[.046,.054,.006],[.04,.06],[-.06,.06],[-.072,.045,.006],[L+.002,.045,.004],[L,.036,.006],[L+.002,.028]],.027,0,R,{b:.0016});
 if(det()){for(let i=0;i<7;i++)rbox(.0275,.016,.002,0,.044,.02+i*.0035,C.dark,.0005);for(const s of[-1,1])rbox(.006,.006,.016,s*.015,.052,.03,R,.002);rbox(.004,.007,.008,0,.064,.036,R,.001);
  box(.002,.01,.03,.0138,.054,-.035,C.dark)}
 prof([[L+.016,.045],[L+.006,.045],[L+.008,.053],[L+.014,.053]],.004,0,R,{b:.0005});
 if(o.r93&&det())for(let i=0;i<3;i++)rbox(.016,.003,.006,0,.051,L+.012+i*.008,C.dark,.001);grp(null);
 metal();cyl(.0085,-L-.06,0,yb,(L-.06)/2,C.park,{seg:14});
 metal();prof([[.04,.03],[.05,.024,.006],[.056,.012],[.052,-.0],[.075,-.09,.008],[.07,-.098],[.03,-.1,.006],[.022,-.09],[.012,-.006],[-.045,-.0],[L+.025,.014],[L+.025,.03]],.026,0,R,{b:.0016});
 mat('rubber');prof([[.038,-.01],[.064,-.086],[.034,-.09],[.018,-.014]],.031,0,C.rub,{b:.002});
 trig(-.05,.006,.002,R,.006);if(det()){prof([[.045,.05],[.055,.062],[.062,.058],[.052,.044]],.008,0,R,{b:.001})}
 if(o.r93){metal();prof([[-.05,.0],[-.075,-.0],[-.075,-.05,.008],[-.055,-.05,.008]],.012,0,R,{b:.0015});pistolMag(.016,.048,-.17,.024,C.blk)}else pistolMag(.016,.048,-.1,.024,C.blk);
 return{muzzle:[0,yb,L-.01],eject:[.014,.056,-.035],sight:[0,.07,.16],grip:pgrip,lh:o.r93?[0,-.03,-.063]:null,lhT:o.r93?'vert':'pistol',len:.21,pistol:1,rl:'mag',hold:'pistol',slide:.028,piv:{mag:[0,-.05,.04]},shellT:'pistol'}}
// Glock 18
function GLOCK(){const yb=.046;grp('slide');metal();prof([[.045,.03],[.045,.062,.003],[-.14,.062,.003],[-.142,.032,.003]],.025,0,0x2b2d31,{b:.0028});
 if(det()){for(let i=0;i<6;i++)rbox(.0255,.026,.0018,0,.046,.022+i*.004,C.dark,.0004);box(.002,.012,.034,.0122,.054,-.03,C.dark);rbox(.006,.005,.006,0,.066,.04,C.dark,.001);rbox(.004,.006,.004,0,.065,-.132,C.dark,.001);rbox(.002,.006,.01,.0125,.05,.036,C.red,.0005)}
 metal();cyl(.007,.012,0,yb,-.138,C.dark,{seg:12});grp(null);
 matte();prof([[.046,.03],[.046,.02,.004],[.056,.012,.006],[.058,.004],[.052,-.01],[.074,-.085,.008],[.068,-.094],[.032,-.098,.006],[.026,-.088],[.028,-.076,.004],[.02,-.066,.004],[.022,-.054,.004],[.014,-.044,.004],[.016,-.03,.004],[.006,-.004],[-.045,.008],[-.14,.012],[-.14,.03]],.026,0,C.poly,{b:.002});
 if(det())rail(-.07,-.13,.008,C.poly,.018);
 trig(-.048,.006,.004,C.poly,.006);pistolMag(.02,.05,-.19,.024,C.poly);
 return{muzzle:[0,yb,-.15],eject:[.013,.056,-.03],sight:[0,.07,.16],grip:pgrip,lh:null,lhT:'pistol',len:.19,pistol:1,rl:'mag',hold:'pistol',slide:.026,piv:{mag:[0,-.05,.04]},shellT:'pistol'}}
// AutoMag-style stainless hand cannon (rotating bolt with rear ears, vent rib barrel)
function AUTOMAG(){const yb=.05,S=C.chrome;metal();mat('chrome');
 prof([[.05,.022],[.05,.066,.004],[-.04,.066],[-.04,.022]],.03,0,S,{b:.0018});
 cyl(.0105,.2,0,yb,-.14,S,{seg:18});rbox(.01,.01,.2,0,yb+.014,-.14,S,.002);if(det())for(let i=0;i<6;i++)rbox(.011,.005,.012,0,yb+.014,-.06-i*.03,C.dark,.001);
 rbox(.006,.012,.008,0,yb+.024,-.235,S,.001);
 grp('slide');rbox(.024,.02,.05,0,.06,.04,S,.003);for(const s of[-1,1])rbox(.008,.014,.012,s*.019,.062,.06,S,.003);grp(null);
 prof([[.04,.025],[.05,.02,.006],[.056,.01],[.052,-.0],[.075,-.095,.008],[.07,-.104],[.03,-.106,.006],[.022,-.095],[.012,-.006],[-.05,.0],[-.06,.022]],.028,0,S,{b:.0016});
 mat('rubber');prof([[.038,-.01],[.065,-.092],[.034,-.096],[.018,-.014]],.033,0,C.rub,{b:.002});trig(-.055,.006,.002,S,.007);
 pistolMag(.016,.05,-.105,.026,C.steel);
 return{muzzle:[0,yb,-.25],eject:[.016,.06,.0],sight:[0,.074,.16],grip:pgrip,lh:null,lhT:'pistol',len:.3,pistol:1,rl:'mag',hold:'pistol',slide:.03,piv:{mag:[0,-.05,.04]},shellT:'rifle'}}
// Desert Eagle (triangular fixed barrel up front, polygonal slide, rubber grip)
function DEAGLE(){const yb=.048,S=0xb9bfc7;mat('chrome');
 grp('slide');prof([[.056,.022],[.056,.06,.006],[.05,.068],[-.06,.068],[-.06,.022]],.034,0,S,{b:.0045});
 if(det()){for(let i=0;i<6;i++)rbox(.0345,.03,.0022,0,.045,.02+i*.005,0x6a7078,.0005);for(const s of[-1,1])rbox(.006,.008,.016,s*.018,.058,.04,S,.002);rbox(.006,.008,.008,0,.072,.05,C.blk,.001)}grp(null);
 profF([[-.0175,-.022],[.0175,-.022],[.0175,.006],[.0065,.022],[-.0065,.022],[-.0175,.006]],.145,-.1325,S,{p:[0,yb,0],b:.002});if(det())rbox(.009,.004,.13,0,yb+.024,-.13,S,.001);
 metal();cyl(.0085,.004,0,yb-.004,-.205,C.dark,{seg:14});mat('chrome');rbox(.005,.01,.008,0,yb+.03,-.198,S,.001);
 prof([[.05,.022],[.06,.016,.006],[.064,.0],[.058,-.008],[.08,-.1,.008],[.074,-.11],[.03,-.112,.006],[.022,-.1],[.012,-.006],[-.06,.004],[-.2,.006],[-.2,.022]],.03,0,S,{b:.002});
 mat('rubber');prof([[.042,-.012],[.07,-.098],[.034,-.102],[.016,-.016]],.035,0,C.rub,{b:.003});if(det())for(let i=0;i<3;i++)rbox(.036,.004,.012,0,-.035-i*.022,.026+i*.007,C.dark,.001,.3);
 metal();trig(-.06,.008,.004,S,.008);pistolMag(.016,.052,-.112,.026,C.steel);
 return{muzzle:[0,yb-.004,-.215],eject:[.017,.06,-.02],sight:[0,.08,.16],grip:{c:[0,-.045,.05],a:.3,w:.034},lh:null,lhT:'pistol',len:.27,pistol:1,rl:'mag',hold:'pistol',slide:.034,piv:{mag:[0,-.05,.04]},shellT:'rifle'}}
// Colt Python-style revolver (swing-out cylinder 'cyl', vent rib, full underlug)
function PYTHON(){const R=0x2a3038,yb=.049;metal();
 prof([[.05,.068,.006],[-.042,.068],[-.042,.03],[-.036,.0],[-.01,-.004],[.02,-.006],[.05,.0,.006],[.062,.03,.01]],.03,0,R,{b:.0018,holes:[[[.03,.016],[-.034,.016],[-.034,.06],[.03,.06]]]});
 cyl(.0085,.15,0,yb,-.117,R,{seg:16});rbox(.009,.008,.15,0,.062,-.117,R,.002);if(det())for(let i=0;i<4;i++)rbox(.0095,.005,.018,0,.062,-.07-i*.03,C.dark,.001);
 prof([[-.04,.044],[-.192,.044],[-.192,.03,.006],[-.04,.026]],.017,0,R,{b:.002});prof([[-.18,.066],[-.192,.066],[-.19,.078,.002],[-.184,.078]],.004,0,R,{b:.0005});
 rbox(.008,.006,.008,0,.071,.038,R,.001);
 grp('cyl');lathe([[.017,-.03],[.0205,-.027],[.0205,.026],[.018,.029]],0,.039,.0,R,{seg:24});
 if(det()){for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;rbox(.004,.004,.03,Math.cos(a)*.02,.039+Math.sin(a)*.02,.0,C.dark,.0015,0,0,a)}for(let i=0;i<6;i++){const a=i/6*Math.PI*2;cyl(.0042,.002,Math.cos(a)*.0115,.039+Math.sin(a)*.0115,-.03,C.dark,{seg:10})}}
 rbox(.01,.016,.008,0,.024,-.034,R,.002);grp(null);
 prof([[.052,.055],[.07,.072,.004],[.074,.068],[.06,.048]],.008,0,R,{b:.001});trig(-.025,.028,.0,R,.006);
 mat('wood');prof([[.04,.0],[.06,.0],[.068,-.02],[.09,-.1,.01],[.06,-.112,.012],[.04,-.1],[.035,-.07,.006],[.026,-.06,.006],[.028,-.045,.006],[.02,-.035,.006],[.022,-.02]],.034,0,C.woodL,{b:.004});
 return{muzzle:[0,yb,-.2],sight:[0,.078,.16],grip:{c:[0,-.045,.05],a:.38,w:.034},lh:null,lhT:'pistol',len:.29,pistol:1,rl:'cyl',hold:'pistol',piv:{cyl:[0,.022,0]},noShell:1,cylSpin:1}}
// ---------- AA-12 (drum, straight-line stock, vented shroud) ----------
function AA12(){const F=C.od,yb=.046;matte();
 prof([[.36,.07,.006],[.36,-.07,.008],[.3,-.075],[.12,-.02],[.08,-.02],[-.03,-.02],[-.06,-.03],[-.2,-.03],[-.22,-.01],[-.22,.07]],.05,0,F,{b:.005});
 prof([[.1,.07],[.1,.11,.008],[-.16,.11,.008],[-.16,.07]],.024,0,F,{b:.003,holes:[[[.07,.078],[-.12,.078],[-.12,.096,.006],[.07,.096,.006]]]});rail(.09,-.15,.11,C.blk);
 buttPad(.365,-.068,.068,.054,C.rub);const g=gripAR(-.02,.06,C.blk,.3,.1,.032);trig(-.03,.04,-.02,C.blk);
 metal();lathe([[.022,-.2],[.023,0]],0,yb,-.22,C.blk,{seg:20});if(det())for(let i=0;i<5;i++)for(let k=0;k<6;k++){const a=k/6*Math.PI*2;cyl(.004,.002,Math.cos(a)*.023,yb+Math.sin(a)*.023,-.26-i*.03,C.dark,{seg:8,ax:Math.abs(Math.cos(a))>.7?'x':'y'})}
 lathe([[.0135,-.04],[.0135,0]],0,yb,-.42,C.park);
 grp('mag');matte();cyl(.085,.064,0,-.105,-.115,C.poly,{ax:'x',seg:28});cyl(.04,.068,0,-.105,-.115,C.blk,{ax:'x',seg:20});rbox(.05,.04,.06,0,-.035,-.11,C.poly,.006);
 if(det())for(let i=0;i<10;i++){const a=i/10*Math.PI*2;rbox(.066,.01,.004,0,-.105+Math.sin(a)*.083,-.115+Math.cos(a)*.083,C.dark,.001,-a)}grp(null);
 const eye=t2(-.02,.11);
 return{muzzle:[0,yb,-.46],eject:[.026,.04,-.06],sight:eye,grip:g,lh:[0,yb,-.3],lhT:'under',lhR:.03,len:.96,rl:'mag',hold:'rifle',piv:{mag:[0,-.06,-.11]},boltBack:.05,shellT:'shot'}}
// ---------- M249 SAW ----------
function M249(){const R=C.park,yb=.04;metal();
 prof([[.1,.0],[.1,.066,.004],[-.16,.066],[-.16,.0]],.05,0,R,{b:.002});
 grp('lid');prof([[.1,.066],[.1,.084,.006],[-.1,.086,.006],[-.105,.066]],.05,0,R,{b:.002});if(det())rbox(.018,.016,.016,0,.094,.07,R,.002);grp(null);
 if(det()){for(let i=0;i<3;i++)rbox(.0505,.004,.008,0,.03,.05-i*.06,C.dark,.001)}
 matte();const g=gripAR(-.0,.07,C.blk,.36,.1);trig(-.02,.05,.0,R);
 prof([[.1,.062],[.38,.05,.006],[.39,-.06,.006],[.36,-.066],[.2,-.02],[.1,.0]],.044,0,C.blk,{b:.003,holes:[[[.15,.018],[.3,.012,.008],[.31,-.025,.008],[.2,-.004]]]});buttPad(.395,-.064,.048,.046);
 prof([[-.16,.05],[-.27,.05],[-.27,-.01,.01],[-.16,-.01]],.05,0,C.blk,{b:.005});if(det())for(let i=0;i<5;i++)rbox(.051,.004,.008,0,.0,-.18-i*.018,C.dark,.001);
 metal();lathe([[.0105,-.27],[.0115,0]],0,yb,-.27,R,{seg:16});birdcage(-.54,yb,.0125);
 prof([[-.27,.06],[-.45,.06],[-.45,.068,.004],[-.27,.074,.004]],.034,0,R,{b:.0015});if(det())for(let i=0;i<5;i++)rbox(.035,.004,.016,0,.07,-.29-i*.032,C.dark,.001);
 cyl(.009,.2,0,.018,-.37,R,{seg:12});prof([[-.17,.076],[-.21,.13,.012],[-.29,.13,.012],[-.33,.076]],.008,0,R,{b:.0014,holes:[[[-.19,.08],[-.215,.118,.008],[-.285,.118,.008],[-.31,.08]]]});
 if(det())for(const s of[-1,1])rbox(.008,.008,.17,s*.012,.002,-.42,C.blk,.002);
 grp('mag');matte();rbox(.07,.1,.11,-.045,-.04,-.05,C.od,.012);if(det())rbox(.072,.02,.1,-.045,.0,-.05,0x454b31,.004);mat('brass');if(det())for(let i=0;i<5;i++)box(.006,.012,.006,-.016+i*.003,.02+i*.008,-.04,C.brass);grp(null);
 const eye=[0,.11,.12];
 return{muzzle:[0,yb,-.6],eject:[0,-.01,-.02],ejDown:1,sight:eye,grip:g,lh:[0,.02,-.22],lhT:'under',lhR:.032,len:1,rl:'belt',hold:'rifle',piv:{lid:[0,.075,-.1],mag:[-.045,-.04,-.05]},boltBack:.05,shellT:'rifle'}}
// ---------- modern crossbow ----------
function XBOW(){matte();const yb=.045;
 prof([[.07,.06],[.32,.058,.004],[.33,-.055,.006],[.3,-.06],[.2,-.01],[.07,.02]],.04,0,C.poly,{b:.003,holes:[[[.12,.024],[.25,.022],[.25,.042,.006],[.12,.044,.006]]]});buttPad(.334,-.058,.056,.044);
 prof([[.07,.06],[.07,.02,.004],[-.4,.03],[-.42,.045],[-.42,.06]],.03,0,C.blk,{b:.002});rail(.06,-.1,.06,C.blk);const g=gripAR(.02,.05,C.poly,.36,.1);trig(-.03,.03,.02,C.blk);
 prof([[-.15,.02],[-.32,.02],[-.32,-.02,.01],[-.15,-.02,.01]],.034,0,C.poly,{b:.004});
 metal();rbox(.06,.05,.04,0,.035,-.42,C.blk,.006);
 for(const s of[-1,1]){profT([[0,-.42],[s*.12,-.38,.06],[s*.25,-.31],[s*.255,-.325],[s*.12,-.4,.06],[0,-.44]],.016,.04,C.blk,{b:.003});cyl(.016,.012,s*.255,.04,-.318,C.alu,{ax:'y',seg:16})}
 profF([[-.025,0],[.025,0],[.025,.006],[-.025,.006]],.005,-.44,C.blk);tor(.03,.004,0,.04,-.47,C.blk,Math.PI,0,0,Math.PI);
 for(const s of[-1,1]){_V.set(s*.255,.042,-.318);_V2.set(0,.062,-.06);const d=_V2.clone().sub(_V),L=d.length();_Q.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  const pt=push(new THREE.CylinderGeometry(.0018,.0018,L,5),[(_V.x+_V2.x)/2,(_V.y+_V2.y)/2,(_V.z+_V2.z)/2],null,0xdddddd);_E.setFromQuaternion(_Q);pt.r=[_E.x,_E.y,_E.z]}
 grp('bolt');cyl(.004,.4,0,.068,-.26,C.alu,{seg:8});push(new THREE.ConeGeometry(.009,.04,SEG(4)),[0,.068,-.48],[-Math.PI/2,0,0],C.steel);if(det())for(const a of[0,2.1,4.2])rbox(.001,.012,.04,Math.cos(a)*.006,.068+Math.sin(a)*.006,-.07,C.red,.002,0,0,a);grp(null);
 const eye=scope(-.02,.066,.24,.0127,.022);
 return{muzzle:[0,.068,-.5],sight:eye,grip:g,lh:[0,.0,-.24],lhT:'under',lhR:.024,len:.9,rl:'xbow',hold:'rifle',piv:{},noShell:1}}
// ---------- M32 MGL 6-shot revolving launcher ----------
function MGL(){const yb=.04;metal();
 prof([[.07,.0],[.07,.07,.006],[.05,.075],[.05,-.045],[.07,-.045]],.08,0,C.blk,{b:.004});prof([[-.11,.075],[-.13,.075],[-.13,-.045],[-.11,-.045]],.08,0,C.blk,{b:.004});
 rbox(.03,.012,.2,0,.08,-.03,C.blk,.003);rail(.06,-.13,.086,C.blk);
 grp('cyl');lathe([[.06,-.12],[.066,-.11],[.066,-.01],[.06,0]],0,.0,.045,C.od,{seg:24});if(det())for(let i=0;i<6;i++){const a=i/6*Math.PI*2;rbox(.012,.012,.1,Math.cos(a)*.064,Math.sin(a)*.064,-.015,0x3d4229,.004,0,0,a);cyl(.02,.003,Math.cos(a)*.035,Math.sin(a)*.035,-.077,C.dark,{seg:14})}grp(null);
 lathe([[.026,-.22],[.028,-.2],[.028,0]],0,yb,-.13,C.blk,{seg:22});
 matte();prof([[-.22,.012],[-.25,.012],[-.255,-.08,.008],[-.225,-.08,.008]],.028,0,C.blk,{b:.003});const g=gripAR(-.045,.08,C.blk,.36,.1);trig(-.0,.06,-.045,C.blk);
 cyl(.0145,.18,0,.03,.17,C.blk,{seg:14});prof([[.18,.05],[.31,.048,.004],[.315,-.06,.004],[.29,-.062],[.18,.014]],.044,0,C.poly,{b:.003});buttPad(.32,-.06,.05,.046);
 const eye=holo(-.03,.086);
 return{muzzle:[0,yb,-.36],sight:eye,grip:g,lh:[0,-.035,-.237],lhT:'vert',len:.76,rl:'gl',cyc:'gl',hold:'rifle',piv:{cyl:[0,.0,0]},noShell:1}}
// ---------- RPG-7 ----------
function RPG(){metal();const yb=0;
 lathe([[.024,-.3],[.022,-.28],[.022,.32],[.03,.4],[.046,.52],[.044,.53],[.026,.42]],0,yb,-.08,C.od,{seg:22});
 mat('wood');for(const z of[-.06,.12])lathe([[.03,-.08],[.033,-.07],[.033,.07],[.03,.08]],0,yb,z,C.wood,{seg:20});
 metal();lathe([[.026,-.02],[.026,.02]],0,yb,-.39,C.od,{seg:20});
 matte();const g=gripAR(-.022,-.02,C.woodD,.3,.1,.03);trig(-.06,.0,-.022,C.park,.006);
 metal();rbox(.03,.05,.08,-.04,.03,.05,C.blk,.008);cyl(.012,.04,-.045,.045,.11,C.blk,{seg:14});mat('rubber');cyl(.016,.03,-.045,.045,.14,C.rub,{seg:14});metal();GLS(.01,-.045,.045,.155);
 rbox(.004,.03,.008,0,.04,-.33,C.park,.001);rbox(.012,.026,.008,0,.04,-.15,C.park,.001);
 grp('rocket');metal();lathe([[.02,0],[.035,-.02],[.0425,-.06],[.0425,-.12],[.034,-.18],[.012,-.27],[.006,-.33],[.004,-.34]],0,yb,-.38,C.od,{seg:22});cyl(.005,.03,0,yb,-.72,C.steel,{seg:8});grp(null);
 return{muzzle:[0,yb,-.72],sight:[0,.054,.15],grip:g,lh:[0,yb,.1],lhT:'under',lhR:.034,len:1,rl:'rocket',hold:'launcher',piv:{},noShell:1}}
// ---------- melee ----------
function KNIFE(){const D=det();mat('rubber');lathe([[.011,-.0],[.013,.02],[.0125,.06],[.014,.09],[.012,.105]],0,0,.0,0x2a2522,{seg:14});
 if(D){for(let i=0;i<9;i++){tor(.0128,.0016,0,0,.008+i*.0105,0x3c342c,Math.PI*2,0,0,0,[4,14])}
  metal();for(const z of[.03,.075]){cyl(.0035,.03,0,0,z,C.brass,{ax:'x',seg:8})}
  mat('chrome');rbox(.003,.0035,.075,0,.0005,-.06,0xffffff,.001);// fuller highlight
  metal();prof([[-.03,.004],[-.13,.004],[-.13,.0],[-.03,.0]],.0062,0,0x6f757c,{b:.0005});// fuller groove
  mat('chrome');prof([[-.02,-.0115],[-.15,-.0115],[-.187,-.0045],[-.183,-.0065],[-.15,-.0135],[-.02,-.0135]],.0058,0,0xf4f7fa,{b:.0005});// edge bevel shine
  metal();for(let i=0;i<5;i++)rbox(.0062,.004,.0025,0,.0125,-.02-i*.006,0x6a6f75,.0005);// spine jimping
  for(let i=0;i<6;i++)rbox(.0061,.0004,.012,0,-.004+i*.0025,-.09-i*.012,0xb7bcc2,0,(i%2?.2:-.15));// scratches
 }
 metal();rbox(.044,.013,.009,0,.0,-.003,C.steel,.003);if(D){sph(.0055,.023,0,-.003,C.steel,[1,1,1],10);sph(.0055,-.023,0,-.003,C.steel,[1,1,1],10)}
 mat('chrome');prof([[-.006,.012],[-.16,.012],[-.2,.0],[-.185,-.006,.004],[-.15,-.012],[-.006,-.012]],.005,0,C.chrome,{b:.0015});
 metal();lathe([[.013,0],[.014,.006],[.012,.016],[.006,.02]],0,0,.105,C.steel,{seg:14});if(D)tor(.004,.0012,0,0,.127,C.steel,Math.PI*2,0,Math.PI/2,0,[4,10]);
 return{muzzle:[0,0,-.2],sight:[0,0,0],grip:{c:[0,0,.05],a:0,w:.028},hold:'knife',melee:1}}
function KATANA(){const D=det();mat('rubber');rbox(.026,.03,.25,0,0,.09,0xe9e2d0,.012);// same-gawa ray skin
 if(D)for(let i=0;i<8;i++){mat('poly');rbox(.028,.032,.006,0,0,-.015+i*.03,0x1a1a22,.003,0,0,.7);rbox(.028,.032,.006,0,0,-.015+i*.03,0x1a1a22,.003,0,0,-.7)}else{mat('poly');rbox(.027,.031,.24,0,0,.09,0x1a1a22,.012)}
 if(D){metal();mat('brass');rbox(.03,.012,.03,.0,-.0,.1,C.brass,.004);cyl(.0035,.034,0,0,.045,C.brass,{ax:'x',seg:8})}// menuki & mekugi
 metal();mat('brass');lathe([[.016,0],[.017,.01],[.012,.02]],0,0,.215,C.brass,{seg:14});// kashira
 // tsuba: ornate guard
 metal();cyl(.042,.008,0,0,-.04,0x2a2a2e,{seg:24});if(D){tor(.041,.0028,0,0,-.04,C.brass,Math.PI*2,0,0,0,[5,28]);for(let k=0;k<4;k++){const a=k*Math.PI/2+.785;cyl(.008,.0085,Math.cos(a)*.026,Math.sin(a)*.026,-.04,0x111114,{seg:10})}}
 mat('brass');cyl(.016,.03,0,0,-.06,C.brass,{seg:12});lathe([[.016,0],[.013,.014]],0,0,-.075,C.brass,{seg:12});// habaki
 mat('chrome');prof([[-.075,.014],[-.4,.022],[-.7,.012],[-.76,-.004],[-.72,-.008],[-.4,-.006],[-.075,-.014]],.006,0,C.chrome,{b:.002,cs:10});
 if(D){metal();prof([[-.09,.011],[-.55,.016],[-.55,.012],[-.09,.007]],.0068,0,0x7d838a,{b:.0005});// bo-hi groove
  mat('chrome');const hp=[];for(let i=0;i<=14;i++){const t=i/14,z=-.08-t*.64;hp.push([z,-.002+Math.sin(i*1.9)*.0025+t*.006])}const ret=[];for(let i=14;i>=0;i--){const t=i/14;ret.push([-.08-t*.64,-.0125+t*.009])}prof(hp.concat(ret),.0066,0,0xf6f8fb,{b:.0004});}// hamon
 return{muzzle:[0,0,-.6],sight:[0,0,0],grip:{c:[0,0,.07],a:0,w:.03},hold:'katana',melee:1}}
function AXE(){const D=det();mat('wood');lathe([[.015,-.0],[.017,.2],[.018,.42],[.02,.45]],0,0,-.36,C.woodL,{seg:12});
 if(D){mat('rubber');for(let i=0;i<10;i++)tor(.0175,.0026,0,0,-.0+.0-.0+.05-i*.012+.0,0x1a1a1a,Math.PI*2,0,0,0,[4,14]);lathe([[.019,0],[.021,.01],[.012,.02]],0,0,.09,0x1a1a1a,{seg:14});
  mat('wood');for(let i=0;i<5;i++)rbox(.0006,.001,.05,.0172*(i%2?1:-1),.006*(i-2),-.2+i*.04,0x6b4426);}
 metal();mat('poly');prof([[-.33,.02],[-.42,.02],[-.44,.11,.01],[-.42,.12,.006],[-.38,.03],[-.33,.03]],.016,0,C.red,{b:.003,p:[0,-.025,0]});prof([[-.33,.0],[-.39,-.005],[-.44,-.08],[-.4,-.06],[-.33,-.02]],.014,0,C.red,{b:.003});
 mat('chrome');prof([[-.43,.11],[-.452,.112],[-.452,.0],[-.438,.0]],.012,0,C.chrome,{b:.002,p:[0,-.025,0]});
 if(D){mat('chrome');prof([[-.447,.085],[-.4535,.087],[-.4535,-.02],[-.447,-.02]],.0128,0,0xffffff,{b:.0005});
  metal();for(const z of[-.345,-.37])for(const s of[1,-1])cyl(.0042,.004,s*.009,.012,z,C.steel,{ax:'x',seg:10});
  rbox(.018,.02,.03,0,.0,-.345,0x2b2d31,.004);// eye wedge
  for(let i=0;i<5;i++)rbox(.0165,.0005,.02,0,.04+i*.012,-.39-i*.004,0x7a1d1d,0,0,0,.4);}
 return{muzzle:[0,0,-.4],sight:[0,0,0],grip:{c:[0,0,.03],a:0,w:.032},hold:'axe',melee:1}}
// ---------- utilities ----------
// Shared fuze assembly: threaded fuze, striker housing, spoon (lever) & pin+ring in their own pivot groups so the throw can pull the pin and flick the spoon.
function FUZE(y,col=C.steel,lever=.06){const D=det();metal();cyl(.0105,.012,0,y+.004,0,0x60656b,{ax:'y',seg:14});if(D)for(let i=0;i<3;i++)tor(.0108,.0011,0,y+.0005+i*.0035,0,0x50555a,Math.PI*2,Math.PI/2,0,0,[3,14]);
 cyl(.0085,.014,0,y+.016,0,col,{ax:'y',seg:12});rbox(.012,.012,.02,0,y+.02,0,col,.003);
 grp('spoon');prof([[-.009,y+.03],[.012,y+.032],[.016,y+.024],[.032,y-lever*.4],[.034,y-lever],[.03,y-lever-.004],[.026,y-lever*.4],[.008,y+.024]],.015,0,col,{b:.001,r:[0,Math.PI/2,0]});
 if(D){rbox(.0006,.004,.01,.0,y+.025,-.0,0x2d3034)}
 grp('pin');metal();cyl(.0016,.03,-.0,y+.016,0,C.chrome,{ax:'x',seg:6});mat('chrome');tor(.0115,.0016,-.026,y+.016,0,C.chrome,Math.PI*2,0,Math.PI/2,0,[5,16]);
 if(D){tor(.0026,.0009,.016,y+.016,0,C.chrome,Math.PI*2,0,Math.PI/2,0,[3,8])}
 grp(null);return{spoon:[.02,y+.03,0],pin:[0,y+.016,0]}}
function NADE(){const D=det();metal();
 lathe([[0,-.042],[.016,-.04],[.028,-.03],[.034,-.012],[.034,.008],[.029,.024],[.018,.034],[.011,.036]],0,0,0,C.od,{seg:D?24:12,r:[-Math.PI/2,0,0]});
 if(D){for(const y of[-.026,-.012,.004,.019])tor(.0352*Math.sqrt(Math.max(.05,1-((y+.003)/.04)**2)),.0016,0,y,0,0x3f4530,Math.PI*2,Math.PI/2,0,0,[3,24]);
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2;rbox(.003,.036,.0035,Math.cos(a)*.0335,-.008,Math.sin(a)*.0335,0x3a4029,.001,0,-a,0)}
  cyl(.0345,.006,0,-.002,0,0xd8b830,{ax:'y',seg:24});// yellow HE band
  matte();rbox(.001,.012,.024,-.0345,-.018,0,0xd8d2b0,.0005);}
 const pv=FUZE(.034);return{util:1,piv:pv,nade:1}}
function MOLO(){const D=det();mat('trans');lathe([[.0,-.0],[.032,.0],[.034,.01],[.034,.1],[.03,.12],[.013,.14],[.012,.18],[.014,.185]],0,0,0,0x2e7a3a,{r:[-Math.PI/2,0,0]});
 if(D){matte();lathe([[.0,.0],[.031,.004],[.032,.07],[.0,.07]],0,0,0,0x8a4a12,{seg:16,r:[-Math.PI/2,0,0]});// fuel inside
  cyl(.0345,.045,0,.055,0,0xe6d7a8,{ax:'y',seg:20});rbox(.002,.03,.03,-.035,.055,0,0xb21d1d,.002);// label
  mat('rubber');tor(.0135,.002,0,.168,0,0x3a2b1c,Math.PI*2,Math.PI/2,0,0,[3,12]);}
 matte();rbox(.03,.06,.03,0,.2,0,0xe8dcc0,.008,.25);if(D){rbox(.02,.045,.02,.008,.235,.004,0xd6c49e,.006,-.3,0,.4);rbox(.018,.035,.016,-.008,.225,-.006,0xa3835e,.006,.5,0,-.3);RET('gorange',0,.255,0,.05)}
 return{util:1}}
function SMOKEC(){const D=det();metal();cyl(.031,.11,0,0,0,C.grey,{ax:'y',seg:18});cyl(.032,.024,0,.025,0,0xdddddd,{ax:'y',seg:18});
 if(D){lathe([[.031,0],[.033,.004],[.033,.008],[.031,.01]],0,-.058,0,0x50555a,{seg:18,r:[-Math.PI/2,0,0]});
  for(let k=0;k<6;k++){const a=k/6*Math.PI*2;cyl(.0045,.004,Math.cos(a)*.031,.048,Math.sin(a)*.031,C.dark,{ax:Math.abs(Math.cos(a))>.7?'x':'z',seg:8})}
  for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;cyl(.0045,.004,Math.cos(a)*.0005,-.058,Math.sin(a)*.016,C.dark,{ax:'y',seg:8})}
  matte();rbox(.001,.03,.028,-.0315,-.012,0,0x101010,.0005);cyl(.0325,.004,0,-.035,0,0x2a6ad8,{ax:'y',seg:18});}
 const pv=FUZE(.055);return{util:1,piv:pv,nade:1}}
function FLASHC(){const D=det();metal();cyl(.026,.1,0,0,0,C.blk,{ax:'y',seg:18});if(D){for(let i=0;i<4;i++)for(let k=0;k<6;k++){const a=k/6*Math.PI*2;cyl(.0045,.004,Math.cos(a)*.026,-.03+i*.02,Math.sin(a)*.026,C.dark,{ax:Math.abs(Math.cos(a))>.7?'x':'z',seg:8})}
  for(const y of[-.048,.042])cyl(.0275,.006,0,y,0,0x55595e,{ax:'y',seg:18});cyl(.0268,.004,0,-.04,0,0xc8c8c8,{ax:'y',seg:18});}
 const pv=FUZE(.05);return{util:1,piv:pv,nade:1}}
function DECOY(){const D=det();metal();cyl(.03,.085,0,0,0,0x2a3a4a,{ax:'y',seg:18});cyl(.0315,.012,0,-.036,0,0xff5a2a,{ax:'y',seg:18});cyl(.0315,.012,0,.03,0,0xff5a2a,{ax:'y',seg:18});
 if(D){for(let k=0;k<8;k++){const a=k/8*Math.PI*2;cyl(.0035,.004,Math.cos(a)*.03,0,Math.sin(a)*.03,C.dark,{ax:Math.abs(Math.cos(a))>.7?'x':'z',seg:8})}cyl(.002,.07,.016,.075,0,C.steel,{ax:'y',seg:6});sph(.004,.016,.112,0,0xff3030)}
 const pv=FUZE(.048);return{util:1,piv:pv,nade:1}}
function MEDKIT(){const D=det();matte();rbox(.12,.08,.045,0,0,0,0xf2f2f2,.01);rbox(.122,.06,.016,0,0,0,C.red,.003);rbox(.122,.016,.047,0,0,0,C.red,.003);rbox(.05,.012,.01,0,.046,0,C.blk,.004);
 if(D){for(const s of[1,-1]){rbox(.124,.004,.004,0,.038,s*.0215,0x777777,.001);}metal();rbox(.008,.012,.006,.045,.038,.023,C.steel,.002);
  matte();for(const x of[-.045,.045])rbox(.012,.084,.049,x,0,0,0x3a3d42,.003);metal();for(const x of[-.045,.045])rbox(.014,.012,.05,x,-.02,0,C.blk,.002);
  matte();rbox(.03,.03,.002,-.03,.012,.0236,0x2a2a2a,.003);}
 return{util:1}}
// ---------- HK UMP-45 ----------
function UMP(){const F=C.poly,yb=.042;matte();
 prof([[.07,.0],[.07,.062,.006],[-.2,.062,.006],[-.21,.03,.006],[-.2,.0]],.036,0,F,{b:.003});rail(.05,-.17,.062,C.blk);
 if(det())for(let i=0;i<5;i++)rbox(.037,.004,.008,0,.03,-.12-i*.014,C.dark,.001);
 prof([[.07,.0],[.07,-.01],[.04,-.012],[-.05,-.012],[-.06,.0]],.032,0,F,{b:.002});trig(-.045,.02,-.008,F);const g=gripAR(-.005,.05,F,.32,.1,.032);
 metal();lathe([[.009,-.05],[.0095,0]],0,yb,-.21,C.park,{seg:14});grp('bolt');rbox(.01,.012,.02,-.022,.05,-.16,C.blk,.003);grp(null);
 matte();prof([[.07,.05],[.27,.045,.004],[.28,-.04,.006],[.26,-.045],[.24,.025],[.09,.03],[.07,0]],.02,0,F,{b:.002});buttPad(.282,-.045,.045,.03);
 grp('mag');boxMag(-.085,.0,.036,.16,.022,F,.02);grp(null);const eye=holo(-.02,.064);
 return{muzzle:[0,yb,-.26],eject:[.018,.045,-.04],sight:eye,grip:g,lh:[0,.02,-.17],lhT:'under',lhR:.026,len:.6,rl:'mag',hold:'rifle',piv:{mag:[0,-.01,-.07]},boltBack:.05,shellT:'pistol'}}
// ---------- Thompson M1928 ----------
function TOMMY(){const R=C.park,Wd=C.wood,yb=.04;metal();
 prof([[.05,.012],[.05,.058,.006],[-.16,.058,.006],[-.17,.03],[-.16,.012]],.032,0,R,{b:.002});rbox(.012,.008,.03,0,.063,.03,R,.002);
 grp('bolt');sph(.007,0,.065,-.07,R);grp(null);
 barrel(-.17,-.38,.0095,yb,R);if(det())for(let i=0;i<10;i++)lathe([[.014,-.004],[.014,0]],0,yb,-.18-i*.012,R,{seg:16});
 rbox(.024,.022,.04,0,yb,-.395,R,.006);rbox(.004,.012,.004,0,.062,-.39,R,.001);
 mat('wood');gripAR(.012,-.25,Wd,.08,.085,.03);const g=gripAR(.012,.05,Wd,.35,.1,.032);metal();trig(-.03,.03,.012,R);
 mat('wood');prof([[.05,.055],[.3,.03,.01],[.31,-.06,.01],[.28,-.065],[.06,.0]],.034,0,Wd,{b:.004});metal();buttPad(.312,-.06,.03,.034,R);
 grp('mag');cyl(.06,.036,0,-.045,-.06,R,{ax:'x',seg:28});cyl(.022,.042,0,-.045,-.06,C.steel,{ax:'x',seg:14});grp(null);
 return{muzzle:[0,yb,-.42],eject:[.018,.05,-.04],sight:[0,.072,.15],grip:g,lh:[0,-.04,-.25],lhT:'vert',len:.85,rl:'mag',hold:'rifle',piv:{mag:[0,-.045,-.06]},magFwd:1,boltBack:.05,shellT:'pistol'}}
// ---------- Kel-Tec KSG (bullpup pump, twin tubes) ----------
function KSG(){const F=C.poly,yb=.05;matte();
 prof([[.26,.08],[.27,-.055,.008],[.23,-.06],[.2,-.005],[-.02,-.005],[-.03,.03],[-.12,.03],[-.12,.08]],.05,0,F,{b:.004});rail(.2,-.11,.08,C.blk);
 metal();for(const s of[-1,1])cyl(.013,.25,s*.014,.012,-.2,C.blk,{seg:14});barrel(-.12,-.5,.011,yb,C.blk);
 grp('pump');matte();rbox(.05,.04,.14,0,.012,-.22,F,.008);gripAR(-.008,-.2,F,.05,.08,.03);grp(null);
 trig(-.04,.02,-.005,F);const g=gripAR(-.005,.03,F,.3,.1,.032);buttPad(.272,-.055,.08,.05);const eye=t2(-.02,.084);
 return{muzzle:[0,yb,-.5],eject:[0,-.03,.15],ejDown:1,sight:eye,grip:g,lh:[0,-.05,-.2],lhT:'vert',lhPump:true,len:.68,rl:'shells',cyc:'pump',hold:'rifle',piv:{},shellT:'shot',loadPort:[0,-.01,.15]}}
// ---------- Barrett M82 ----------
function BARRETT(){const R=0x3a3c38,yb=.06;metal();
 prof([[.2,.03],[.2,.09,.006],[-.36,.09,.01],[-.38,.06,.008],[-.36,.03]],.05,0,R,{b:.003});prof([[.17,.03],[.17,-.0,.006],[.02,-.005],[-.1,.0],[-.12,.03]],.046,0,R,{b:.003});
 rail(.1,-.25,.09,R,.024);if(det())for(let i=0;i<6;i++)rbox(.051,.008,.03,0,.06,-.12-i*.04,C.dark,.002);
 barrel(-.38,-.86,.014,yb,R);brake(-.86,yb,.024,R,.09);for(const s of[-1,1])rbox(.008,.2,.012,s*.022,-.03,-.33,R,.002,0,0,s*.25);
 trig(-.03,.03,-.005,R);matte();const g=gripAR(-.005,.05,C.poly,.35,.11,.034);
 metal();prof([[.2,.09],[.36,.08,.01],[.37,-.04,.01],[.34,-.05],[.2,.0]],.044,0,R,{b:.004});buttPad(.372,-.045,.08,.05);matte();rbox(.03,.02,.1,0,.1,.28,C.rub,.006);
 metal();grp('bolt');rbox(.014,.02,.03,.03,.065,-.05,R,.004);grp(null);grp('mag');boxMag(-.06,.0,.06,.12,.04,R,0);grp(null);
 const eye=scope(.0,.094,.36,.015,.03);
 return{muzzle:[0,yb,-.92],eject:[.03,.07,-.08],sight:eye,grip:g,lh:[0,-.03,.2],lhT:'under',lhR:.03,len:1.3,rl:'mag',hold:'rifle',piv:{mag:[0,-.03,-.06]},boltBack:.06,shellT:'rifle'}}
// ---------- M134-style hand-held minigun ----------
function MINIGUN(){const R=0x2b2d31,yb=.03;metal();
 prof([[.12,-.04],[.12,.08,.02],[-.14,.08,.02],[-.14,-.04,.02]],.12,0,R,{b:.006});cyl(.035,.14,.07,.03,.0,C.steel,{seg:18});
 grp('cyl');for(let i=0;i<6;i++){const a=i/6*Math.PI*2;lathe([[.0095,0],[.0095,-.56]],Math.cos(a)*.03,yb+Math.sin(a)*.03,-.14,R,{seg:LOD?6:10})}
 lathe([[.046,0],[.046,-.025]],0,yb,-.3,R,{seg:20});lathe([[.046,0],[.046,-.03]],0,yb,-.66,R,{seg:20});cyl(.012,.6,0,yb,-.42,C.steel,{seg:10});grp(null);
 matte();rbox(.02,.02,.2,0,.15,-.0,C.blk,.006);for(const z of[-.08,.08])rbox(.02,.07,.02,0,.11,z,C.blk,.004);
 const g=gripAR(-.04,.1,C.poly,.25,.11,.034);trig(.04,.09,-.04,R);gripAR(-.04,-.12,C.poly,.0,.1,.032);
 grp('mag');rbox(.1,.12,.14,-.11,-.06,.02,C.od,.008);grp(null);metal();rbox(.03,.02,.12,-.065,.04,.02,R,.004);
 return{muzzle:[0,yb,-.72],eject:[.06,-.03,.05],ejDown:1,sight:[0,.19,.25],grip:g,lh:[0,-.04,-.12],lhT:'vert',len:.85,rl:'belt',hold:'rifle',piv:{cyl:[0,yb,-.4],mag:[-.11,-.06,.02]},spin:1,boltBack:0,shellT:'rifle'}}

// ======================= FUN & SCI-FI (v7) =======================
function PAINTBALL(){const B=0x1f6fd1,Bd=0x164f99,yb=.04;matte();// speedball marker: milled body, eye pipe screws, clamp feedneck, loader with balls, HPA tank + regulator, ported barrel
 prof([[.08,.0],[.08,.06,.008],[-.12,.06,.008],[-.13,.02,.006],[-.12,.0]],.04,0,B,{b:.004});
 if(det()){for(const s of[-1,1]){for(let i=0;i<3;i++)rbox(.004,.022,.03,s*.019,.03,-.07+i*.05,Bd,.006);for(const z of[-.1,.06])cyl(.004,.004,s*.021,.045,z,0xd0d4da,{ax:'x',seg:8})}
  rbox(.042,.006,.02,0,.003,.07,Bd,.002);cyl(.006,.012,.022,.05,-.105,0xff3b30,{ax:'x',seg:10})}// milling, screws, eye cover LED
 rbox(.014,.008,.17,0,.066,-.03,C.blk,.002);if(det())for(let i=0;i<9;i++)rbox(.016,.004,.006,0,.072,-.1+i*.018,C.dark,.001);// dovetail rail + slots
 metal();lathe([[.016,0],[.016,-.02],[.0135,-.025],[.0135,-.06],[.012,-.062]],0,yb,-.12,0x2b2d31,{seg:18});lathe([[.0125,0],[.0125,-.24],[.014,-.245],[.014,-.26]],0,yb,-.18,0x23272c,{seg:18});
 if(det())for(let i=0;i<10;i++)for(const s of[-1,1])rbox(.004,.003,.008,s*.012,yb,-.3-i*.012,C.dark,.001);// ported tip
 matte();cyl(.017,.045,0,.083,-.0,C.blk,{ax:'y',seg:14});if(det()){rbox(.006,.012,.03,.02,.085,.0,0xc0c4ca,.002);cyl(.004,.006,.026,.085,.013,0xc0c4ca,{ax:'x',seg:8})}// feedneck + clamp lever
 matte();sph(.05,0,.12,.01,0x1a1d22,[1.1,.35,1.5],18);mat('trans');sph(.06,0,.155,.01,0x8fd3ff,[1.02,.82,1.37],18);matte();rbox(.11,.012,.03,0,.18,.07,C.blk,.005);// loader shell + lid
 if(det())for(let i=0;i<12;i++){const a=i*2.4;sph(.0085,Math.cos(a)*.03,.13+(i%3)*.016,.0+Math.sin(a)*.05,i%2?0xffd23f:0xff7a1a,[1,1,1],8)}// paintballs inside
 trig(-.03,.03,.0,C.blk);const g=gripAR(.0,.05,C.blk,.3,.1,.032);gripAR(.0,-.1,C.blk,.0,.08,.03);
 metal();rbox(.03,.02,.035,0,-.012,.09,0x3a3d42,.004);mat('chrome');cyl(.028,.22,0,-.005,.21,0xc8ccd2,{seg:20});lathe([[.028,0],[.016,.03]],0,-.005,.32,0xc8ccd2,{seg:16});// ASA + tank
 if(det()){metal();cyl(.012,.006,.0,.02,.11,0x111111,{ax:'y',seg:14});mat('glass');cyl(.01,.002,0,.024,.11,0xeaf6ff,{ax:'y',seg:14});metal();for(let i=0;i<4;i++)rbox(.058,.004,.004,0,-.005,.13+i*.04,0x9aa0a8,.001)}// gauge + tank bands
 return{muzzle:[0,yb,-.43],sight:[0,.1,.15],grip:g,lh:[0,-.05,-.1],lhT:'vert',len:.6,rl:'mag',hold:'rifle',piv:{},boltBack:0,noShell:1}}
function LASERR(){const W1=0xe9edf2,G1=0x34e7ff,yb=.045;matte();
 prof([[.22,.0],[.24,.07,.02],[-.05,.08,.02],[-.2,.06,.02],[-.32,.05,.01],[-.33,.02],[-.1,.0]],.05,0,W1,{b:.006});
 mat('poly');for(const s of[-1,1])rbox(.004,.012,.3,s*.026,.05,-.05,G1,.003);rbox(.054,.008,.05,0,.075,-.28,G1,.002);
 metal();barrel(-.3,-.46,.014,yb,0x4a4f57);for(let i=0;i<3;i++)lathe([[.022,0],[.022,-.012]],0,yb,-.34-i*.04,0x2b2d31,{seg:16});
 mat('poly');lathe([[.016,0],[.016,-.006]],0,yb,-.463,G1,{seg:16});
 trig(-.03,.03,.0,C.blk);matte();const g=gripAR(.0,.05,0x2b2d31,.32,.11,.033);buttPad(.24,-.0,.07,.05,0x2b2d31);const eye=holo(-.06,.08);
 return{muzzle:[0,yb,-.47],sight:eye,grip:g,lh:[0,.0,-.2],lhT:'under',lhR:.03,len:.75,rl:'mag',hold:'rifle',piv:{},boltBack:0,noShell:1}}
function FREEZER(){const B=0xbfe9ff,D=0x2c3e50,yb=.04;matte();
 prof([[.12,.0],[.12,.07,.012],[-.16,.07,.012],[-.17,.0]],.05,0,D,{b:.004});
 mat('trans');cyl(.035,.2,0,.11,-.02,0x7fd3ff,{seg:18});metal();for(const z of[-.11,.07])cyl(.038,.02,0,.11,z,0x95a5a6,{seg:18});
 metal();barrel(-.17,-.4,.016,yb,0x95a5a6);for(let i=0;i<5;i++)tor(.024,.004,0,yb,-.22-i*.035,0x7fd3ff,Math.PI*2,0,0,0,[6,18]);
 mat('poly');lathe([[.03,0],[.012,-.04]],0,yb,-.4,B,{seg:16});
 trig(-.03,.03,.0,C.blk);matte();const g=gripAR(.0,.05,D,.32,.1,.032);gripAR(.0,-.12,D,.0,.08,.03);
 return{muzzle:[0,yb,-.44],sight:[0,.15,.15],grip:g,lh:[0,-.05,-.12],lhT:'vert',len:.62,rl:'mag',hold:'rifle',piv:{},boltBack:0,noShell:1}}
function WATERG(){const O=0xff8c1a,Bl=0x2e86de,yb=.04;matte();
 prof([[.1,.0],[.1,.06,.02],[-.2,.06,.02],[-.22,.03,.015],[-.2,.0]],.05,0,Bl,{b:.006});
 mat('trans');sph(.075,0,.14,.05,0x6ab8ff,[1,.8,1.4],16);matte();cyl(.02,.03,0,.075,.05,O,{ax:'y',seg:12});
 rbox(.05,.04,.1,0,-.02,-.16,O,.012);metal();barrel(-.22,-.36,.01,yb,O);lathe([[.016,0],[.008,-.02]],0,yb,-.36,O,{seg:12});
 trig(-.03,.03,.0,O);matte();const g=gripAR(.0,.05,O,.32,.1,.034);
 return{muzzle:[0,yb,-.38],sight:[0,.1,.15],grip:g,lh:[0,-.02,-.16],lhT:'under',lhR:.03,lhPump:true,len:.5,rl:'mag',hold:'rifle',piv:{},boltBack:0,noShell:1}}
function TASER(){const Y=0xffd23f,yb=.04;matte();
 prof([[.045,.02],[.045,.06,.006],[-.1,.06,.008],[-.11,.02,.006]],.034,0,Y,{b:.004});rbox(.036,.03,.03,0,.04,-.12,C.blk,.006);
 if(det())for(const s of[-1,1])rbox(.008,.008,.004,s*.01,.04,-.137,0x9aa0a6,.002);rbox(.002,.01,.05,.018,.05,-.02,C.blk,.001);
 matte();prof([[.04,.02],[.07,-.08,.01],[.03,-.09,.008],[.015,-.02],[-.03,.02]],.03,0,C.blk,{b:.003});trig(-.04,.006,.008,C.blk,.006);
 return{muzzle:[0,yb,-.14],sight:[0,.07,.12],grip:pgrip,lh:null,lhT:'pistol',len:.18,pistol:1,rl:'mag',hold:'pistol',piv:{},noShell:1}}
function FLAREG(){const O=0xff6a00,yb=.045;matte();
 prof([[.04,.02],[.04,.07,.01],[-.03,.07,.01],[-.03,.02]],.04,0,O,{b:.004});lathe([[.024,0],[.024,-.16],[.028,-.165]],0,yb,-.02,O,{seg:20});
 lathe([[.018,0],[.018,-.17]],0,yb,-.02,0x3a2a1a,{seg:16,open:1});metal();rbox(.01,.016,.02,0,.08,.035,C.blk,.003);
 matte();prof([[.04,.02],[.075,-.08,.01],[.035,-.09,.008],[.015,-.02],[-.02,.02]],.034,0,O,{b:.004});trig(-.04,.006,.008,C.blk,.006);
 return{muzzle:[0,yb,-.19],sight:[0,.08,.12],grip:pgrip,lh:null,lhT:'pistol',len:.2,pistol:1,rl:'mag',hold:'pistol',piv:{},noShell:1}}
function BAT(){const D=det();mat('wood');lathe([[.0,.12],[.018,.118],[.014,.1],[.013,.0],[.016,-.2],[.025,-.38],[.033,-.55],[.034,-.66],[.03,-.69],[.0,-.695]],0,0,0,0xd9b27c,{seg:18});
 mat('rubber');if(D){for(let i=0;i<6;i++)lathe([[.0145,0],[.0145,-.014]],0,0,.1-i*.016,0x222222,{seg:14});lathe([[.019,0],[.02,.004],[.016,.01]],0,0,.106,0x8b1a1a,{seg:16});
  matte();rbox(.002,.012,.07,.0285,0,-.47,0x111111,.001,0,0,0);rbox(.0021,.006,.05,.0287,0,-.47,0xd8b040,.001);
  mat('wood');for(let i=0;i<4;i++)rbox(.0005,.0012,.06,.033*(i%2?-1:1),.01-i*.006,-.6+i*.02,0x9a6e3c);}
 return{muzzle:[0,0,-.6],sight:[0,0,0],grip:{c:[0,0,.06],a:0,w:.03},hold:'katana',melee:1}}
function PAN(){const D=det();mat('rubber');rbox(.026,.016,.16,0,0,.06,0x2b1b12,.006);if(D){metal();tor(.006,.0018,0,0,.13,C.steel,Math.PI*2,Math.PI/2,0,0,[4,12])}metal();rbox(.02,.012,.06,0,.0,-.04,0x55595e,.004);
 if(D)for(const z of[-.06,-.075])for(const y of[-.003,.003])sph(.0035,.0105,y,z+.0,C.steel,[1,1,1],8);
 metal();cyl(.115,.012,0,.0,-.2,0x2b2d31,{ax:'x',seg:28});tor(.115,.009,0,0,-.2,0x1f2124,Math.PI*2,0,Math.PI/2,0,[6,28]);cyl(.1,.004,.008,.0,-.2,0x3a3d42,{ax:'x',seg:28});
 if(D){for(let i=1;i<4;i++)tor(.025*i,.0007,.0105,0,-.2,0x4a4d52,Math.PI*2,0,Math.PI/2,0,[3,28]);cyl(.098,.003,-.0075,0,-.2,0x3a2a22,{ax:'x',seg:28})}
 return{muzzle:[0,0,-.3],sight:[0,0,0],grip:{c:[0,0,.08],a:0,w:.028},hold:'axe',melee:1,panHead:1}}
function SCYTHE(){const D=det();mat('wood');lathe([[.016,.25],[.015,.0],[.016,-.6],[.018,-1.1],[.02,-1.12]],0,0,0,0x6b4a2b,{seg:12});
 if(D){mat('rubber');for(let i=0;i<8;i++)tor(.0165,.0022,0,0,.2-i*.01,0x2a1c12,Math.PI*2,0,0,0,[3,12]);metal();lathe([[.0175,0],[.0185,.03],[.0175,.06]],0,0,-1.13,0x5a5d62,{seg:12});}
 metal();rbox(.03,.05,.05,0,0,-1.12,0x3a3c40,.008);if(D)for(const y of[-.015,.015])cyl(.005,.036,0,y,-1.12,C.steel,{ax:'x',seg:6});
 mat('chrome');prof([[-1.1,.0],[-1.13,.04],[-1.0,.35],[-.82,.52],[-.84,.46],[-.98,.2],[-1.08,.02]],.006,0,0xd5d9de,{b:.002,cs:10});
 if(D){mat('chrome');prof([[-.84,.46],[-.985,.205],[-1.085,.025],[-1.08,.04],[-.98,.22],[-.85,.47]],.0066,0,0xffffff,{b:.0004});metal();prof([[-1.12,.04],[-1.04,.25],[-1.03,.24],[-1.1,.04]],.0068,0,0x4a4d52,{b:.0004})}
 mat('wood');cyl(.012,.12,.06,0,-.35,0x6b4a2b,{ax:'x',seg:10});if(D){metal();rbox(.02,.03,.03,.0,0,-.35,0x3a3c40,.005);mat('rubber');cyl(.0135,.06,.08,0,-.35,0x2a1c12,{ax:'x',seg:10})}
 return{muzzle:[0,.3,-1],sight:[0,0,0],grip:{c:[0,0,.12],a:0,w:.032},hold:'axe',melee:1}}
function TRIDENT(){const D=det();metal();mat('brass');lathe([[.014,.3],[.013,0],[.014,-.9],[.02,-.95]],0,0,0,0xc9a24a,{seg:12});
 if(D){mat('rubber');for(let i=0;i<10;i++)tor(.0145,.0024,0,0,.14-i*.01,0x5a1a1a,Math.PI*2,0,0,0,[3,12]);for(let i=0;i<6;i++)tor(.0148,.0022,0,0,-.7-i*.009,0x5a1a1a,Math.PI*2,0,0,0,[3,12]);
  metal();mat('brass');for(const z of[-.6,-.88,.28])tor(.0155,.003,0,0,z,0xe6c870,Math.PI*2,0,0,0,[4,14]);lathe([[.016,0],[.012,.03],[.0,.045]],0,0,.3,0xe6c870,{seg:12});}
 metal();mat('brass');rbox(.03,.2,.03,0,0,-.97,0xc9a24a,.008);for(const y of[-.085,0,.085]){cyl(.011,.24,0,y,-1.1,0xd8b860,{seg:10});prof([[-1.21,y-.016],[-1.32,y],[-1.21,y+.016],[-1.235,y]],.014,0,0xe6c870,{b:.002});
  if(D&&y){const s=Math.sign(y);prof([[-1.19,y+s*.006],[-1.23,y+s*.024],[-1.2,y+s*.008]],.008,0,0xe6c870,{b:.001})}}
 if(D){for(const s of[-1,1])sph(.012,0,s*.1,-.97,0xe6c870,[1,1,1],10);sph(.01,.016,0,-.97,0x1a8a9a,[1,1,1],10)}
 return{muzzle:[0,0,-1.2],sight:[0,0,0],grip:{c:[0,0,.1],a:0,w:.03},hold:'katana',melee:1}}
function CHAINSAW(){const O=0xff7a00,Od=0xc85a00,yb=0;matte();
 prof([[.12,-.06],[.12,.06,.02],[-.06,.07,.02],[-.08,-.06,.01]],.1,0,O,{b:.008});
 if(det()){for(let i=0;i<5;i++)rbox(.102,.004,.012,0,-.03+i*.018,.1,C.blk,.001);// air filter vents
  rbox(.104,.03,.05,0,.04,.02,Od,.008);for(const s of[-1,1])for(const z of[-.04,.06])cyl(.004,.004,s*.052,-.03,z,0x9aa0a8,{ax:'x',seg:8});// top cover + screws
  metal();rbox(.03,.04,.05,-.058,-.01,.0,0x3a3d42,.006);for(let i=0;i<4;i++)rbox(.004,.03,.006,-.074,-.01,-.018+i*.012,0x111111,.001);// muffler + grille
  matte();cyl(.01,.03,.065,.02,.06,C.blk,{ax:'x',seg:10});rbox(.008,.012,.045,.082,.02,.06,C.blk,.004);rbox(.03,.004,.03,0,-.02,-.068,0xff3b30,.002)}// pull cord T-handle, chain brake tab
 metal();cyl(.035,.06,.055,.0,.02,0x2b2d31,{ax:'x',seg:16});tor(.06,.01,0,.11,.04,C.blk,Math.PI,0,Math.PI/2,0,[6,16]);
 mat('rubber');tor(.075,.011,0,.0,-.07,C.blk,Math.PI*1.2,0,0,-.3,[6,18]);// front wrap handle
 metal();rbox(.012,.06,.44,0,-.01,-.3,0xb8bcc2,.012);cyl(.03,.013,0,-.01,-.52,0xb8bcc2,{ax:'x',seg:18});if(det()){rbox(.0125,.02,.2,0,-.01,-.3,0x2b2d31,.004);cyl(.012,.014,0,-.01,-.52,0x6f747a,{ax:'x',seg:12})}// bar, nose, logo stripe, sprocket
 grp('chain');metal();const N=det()?17:8,sp=.44/N;for(let i=0;i<N;i++){const z=-.09-i*sp;rbox(.016,.008,.012,0,.024,z,0x3a3d42,.001);rbox(.016,.008,.012,0,-.044,z,0x3a3d42,.001);if(det()){rbox(.018,.006,.006,.004,.03,z-.003,0xd0d4da,.001);rbox(.018,.006,.006,-.004,-.05,z-.003,0xd0d4da,.001)}}grp(null);// chain links + cutter teeth
 const g=gripAR(-.02,.12,C.blk,.0,.1,.032);
 return{muzzle:[0,0,-.5],sight:[0,0,0],grip:g,lh:[0,.11,.04],lhT:'vert',hold:'axe',melee:1,saw:1,chainSp:sp}}
const BUILD={
 ar:()=>AR({hg:'mlok',hgL:.25,bl:.37,optic:'t2',stock:'sopmod'}),
 m4:()=>AR({hg:'quad',hgL:.18,bl:.36,fsb:false,optic:'holo',stock:'m4'}),
 dmr:()=>AR({big:1,hg:'sr25',hgL:.32,bl:.5,optic:'acog',stock:'prs',mag:'sr25',muz:'brake',bipod:1}),
 bullpup:AUG,battle:G3,ak47:()=>AK(),scar:SCAR,
 smg:UZI,vector:EVO,pdw:BIZON,mp5:MP5,mp7:MP7,kriss:VECTOR,p90:P90,
 sniper:()=>BOLTGUN({kind:'r700',sc:C.wood,br:.012,zm:-.64}),
 heavy:()=>BOLTGUN({kind:'awm',sc:C.od,br:.014,zm:-.66,brake:1,fluted:1,bipod:1,ob:.03,sl:.36}),
 light:()=>BOLTGUN({kind:'scout',sc:C.grey,br:.011,zm:-.5,brake:1,ob:.022,sl:.28}),
 lever:LEVER,
 m16:()=>AR({hgL:.3,bl:.5,fsb:true,stock:'a2'}),mk18:()=>AR({hg:'quad',hgL:.18,bl:.26,optic:'holo',stock:'m4',muz:'supp'}),
 mini14:()=>AR({wood:1,stock:'a2',fsb:true,hgL:.22,bl:.45,fc:C.wood}),saiga:()=>{const i=AK({wood:C.poly});i.shellT='shot';return i},
 awp:()=>BOLTGUN({kind:'awm',sc:0x55613f,br:.015,zm:-.72,brake:1,fluted:1,ob:.032,sl:.38}),
 ump45:UMP,tommy:TOMMY,ksg:KSG,barrett:BARRETT,minigun:MINIGUN,
 shotgun:()=>SHOTGUN({pump:1,wood:1,fc:C.wood,zm:-.62,rib:1,rc:C.blk}),
 autoshot:()=>SHOTGUN({fc:C.poly,zm:-.56,optic:1}),
 double:DOUBLE,
 handgun:()=>BERETTA(),burst:()=>BERETTA({r93:1}),glock18:GLOCK,cannon:AUTOMAG,deagle:DEAGLE,revolver:PYTHON,
 aa12:AA12,lmg:M249,crossbow:XBOW,gl:MGL,rpg:RPG,
 proj_gl:()=>{metal();mat('brass');cyl(.02,.05,0,0,.0,C.brass,{seg:14});metal();sph(.02,0,0,-.025,C.od);return{util:1}},
 proj_rpg:()=>{metal();lathe([[.02,0],[.035,-.02],[.0425,-.06],[.0425,-.12],[.034,-.18],[.012,-.27],[.006,-.33]],0,0,.06,C.od,{seg:16});cyl(.018,.2,0,0,.16,0x3b3f2a,{seg:12});for(let i=0;i<4;i++)rbox(.003,.05,.06,0,0,.26,C.blk,.001,0,0,i*Math.PI/4);return{util:1}},
 paintball:PAINTBALL,laser:LASERR,freeze:FREEZER,water:WATERG,taser:TASER,flare:FLAREG,bat:BAT,pan:PAN,scythe:SCYTHE,trident:TRIDENT,chainsaw:CHAINSAW,
 proj_flare:()=>{metal();cyl(.016,.07,0,0,0,0xff3b1a,{seg:12});sph(.016,0,0,-.035,0xffd23f);return{util:1}},
 knife:KNIFE,katana:KATANA,axe:AXE,fists:()=>({sight:[0,0,0],hold:'fists',melee:1,fists:1}),
 grenade:NADE,molotov:MOLO,smoke:SMOKEC,flash:FLASHC,decoy:DECOY,medkit:MEDKIT,
};
// ======================= HANDS =======================
// Gloved hands built from finger arcs that wrap the actual grip / handguard axis, so each weapon type gets a believable grip pose.
const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function arcF(c,d,e1,R,r,a0,arc,col,tip='start',ell=[1,1]){const g=new THREE.TorusGeometry(R,r,SEG(7),SEG(10),arc);g.rotateZ(a0);g.scale(ell[0],ell[1],1);
 const e2=V3().crossVectors(d,e1);const m=new THREE.Matrix4().makeBasis(e1,e2,d);m.setPosition(c.x,c.y,c.z);const pt=push(g,null,null,col);pt.m=XF?XF.clone().multiply(m):m;
 const a=tip==='start'?a0:a0+arc;const tp=V3(Math.cos(a)*R*ell[0],Math.sin(a)*R*ell[1],0).applyMatrix4(m);sph(r*1.04,tp.x,tp.y,tp.z,col,[1,1,1],8);
 const ka=tip==='start'?a0+arc:a0;const kp=V3(Math.cos(ka)*R*ell[0],Math.sin(ka)*R*ell[1],0).applyMatrix4(m);sph(r*1.12,kp.x,kp.y,kp.z,col,[1,1,1],8);return{tip:tp,knuckle:kp}}
function seg(a,b,r1,r2,col,n=8){const d=b.clone().sub(a),L=d.length();_Q.setFromUnitVectors(V3(0,1,0),d.normalize());_E.setFromQuaternion(_Q);
 return push(new THREE.CylinderGeometry(r2,r1,L,SEG(n)),[(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2],[_E.x,_E.y,_E.z],col)}
function orBox(w,h,d,c,dirY,col,r=.006){// box whose local +y points along dirY (rotation from y axis)
 _Q.setFromUnitVectors(V3(0,1,0),dirY.clone().normalize());_E.setFromQuaternion(_Q);return rbox(w,h,d,c.x,c.y,c.z,col,r,_E.x,_E.y,_E.z)}
let NOFA=false,WSIDE=null;export const wristOut={};
function forearm(w,e,sleeve,glove){const m0=MAT;const dir=e.clone().sub(w).normalize();wristOut[WSIDE||(GRP==='lh'?'L':'R')]={w:[w.x,w.y,w.z],e:[e.x,e.y,e.z]};
 if(!NOFA){MAT='sleeve';seg(w,e,.03,.044,sleeve,10);
 const cf=w.clone().addScaledVector(dir,.05);seg(cf,cf.clone().addScaledVector(dir,.018),.0405,.041,new THREE.Color(sleeve).multiplyScalar(.7).getHex(),10)}MAT='glove';seg(w.clone().addScaledVector(dir,-.012),w.clone().addScaledVector(dir,.022),.031,.032,glove,10);MAT=m0}
// right hand on a pistol grip (rake a), index finger on the trigger
function rightGrip(g,trg,sleeve,glove,pad,two){const a=g.a,d=V3(0,-Math.cos(a),Math.sin(a)),e1=V3(1,0,0),e2=V3().crossVectors(d,e1);const c=V3(...g.c);const R=.026,ell=[.72,1];
 const D=Math.PI/180;
 [[-.004,.0098],[.016,.0096],[.034,.0088]].forEach(([t,r],i)=>arcF(c.clone().addScaledVector(d,t),d,e1,R-(i===2?.002:0),r,160*D,215*D,glove,'start',ell));
 // palm + back of hand armour pad
 orBox(.024,.08,.05,c.clone().addScaledVector(e1,.019).addScaledVector(e2,.012).addScaledVector(d,.006),d.clone().negate(),glove,.012);
 if(det())orBox(.008,.05,.034,c.clone().addScaledVector(e1,.033).addScaledVector(e2,.006).addScaledVector(d,.0),d.clone().negate(),pad,.006);
 // thumb wraps over the top-left of the grip
 arcF(c.clone().addScaledVector(d,-.03),d,e1,R+.002,.0095,40*D,170*D,glove,'end',ell);
 // index finger to the trigger (two phalanges)
 const p0=c.clone().addScaledVector(d,-.026).addScaledVector(e1,.016).addScaledVector(e2,-.014);const t=trg?V3(...trg):c.clone().addScaledVector(d,-.04).addScaledVector(e2,-.05);
 const p1=V3((p0.x+t.x)/2+.012,(p0.y+t.y)/2-.002,(p0.z+t.z)/2);seg(p0,p1,.0098,.0094,glove);seg(p1,t.clone().add(V3(.004,0,0)),.0094,.0088,glove);sph(.0098,p1.x,p1.y,p1.z,glove);sph(.009,t.x+.004,t.y,t.z,glove);
 const w=c.clone().addScaledVector(d,.03).addScaledVector(e2,.04).addScaledVector(e1,.012);forearm(w,two?V3(.05,-.3,.5):V3(.09,-.28,.5),sleeve,glove);return{c,d,e1,e2}}
// left hand clamping a horizontal tube (handguard / pump / launcher tube)
function leftUnder(lh,R0,sleeve,glove,pad){const D=Math.PI/180;const c=V3(...lh),d=V3(0,0,-1),e1=V3(0,-1,0),e2=V3().crossVectors(d,e1);const R=R0+.009;
 [-.028,-.009,.01,.028].forEach((t,i)=>arcF(c.clone().addScaledVector(d,t),d,e1,R-(i===0?.001:0),i===0?.0085:.0095,225*D,(i===0?120:135)*D,glove,'start'));
 orBox(.05,.02,.075,c.clone().addScaledVector(e1,R*.72).addScaledVector(e2,R*.72),V3(.707,-.707,0),glove,.009);
 if(det())orBox(.03,.008,.05,c.clone().addScaledVector(e1,R*.95+.006).addScaledVector(e2,R*.95+.006),V3(.707,-.707,0),pad,.004);
 arcF(c.clone().addScaledVector(d,.022),d,e1,R+.001,.0098,40*D,105*D,glove,'end');
 const w=c.clone().addScaledVector(e1,R*.9).addScaledVector(e2,R*.6).add(V3(0,0,.05));forearm(w,V3(c.x-.2,-.33,c.z+.48),sleeve,glove)}
// left hand on a vertical foregrip
function leftVert(lh,sleeve,glove,pad){const D=Math.PI/180;const c=V3(...lh),d=V3(0,-1,0),e1=V3(-1,0,0),e2=V3().crossVectors(d,e1);const R=.024;
 [.004,.022,.04,.056].forEach((t,i)=>arcF(c.clone().addScaledVector(d,t),d,e1,R-(i===3?.002:0),i===3?.0085:.0095,-20*D,215*D,glove,'end'));
 orBox(.022,.07,.05,c.clone().addScaledVector(e1,.019).addScaledVector(e2,-.012).addScaledVector(d,.03),V3(0,1,0),glove,.011);
 arcF(c.clone().addScaledVector(d,-.008),d,e1,R+.002,.0095,200*D,120*D,glove,'start');
 const w=c.clone().addScaledVector(e1,.02).addScaledVector(e2,-.035).addScaledVector(d,.06);forearm(w,V3(c.x-.2,-.34,c.z+.48),sleeve,glove)}
// support hand cupping the shooting hand (pistols)
function leftCup(g,sleeve,glove,pad){const D=Math.PI/180;const a=g.a,d=V3(0,-Math.cos(a),Math.sin(a)),e1=V3(1,0,0);const c=V3(...g.c);const R=.026+.018,ell=[.8,1];
 [.0,.018,.035,.05].forEach((t,i)=>arcF(c.clone().addScaledVector(d,t),d,e1,R,.0095,172*D,(i===3?160:200)*D,glove,'end',ell));
 const e2=V3().crossVectors(d,e1);orBox(.024,.075,.05,c.clone().addScaledVector(e1,-.034).addScaledVector(e2,.008).addScaledVector(d,.02),d.clone().negate(),glove,.012);
 const t0=c.clone().addScaledVector(e1,-.026).addScaledVector(d,-.02).addScaledVector(e2,-.006);const t1=t0.clone().add(V3(.008,.012,-.04));seg(t0,t1,.0098,.009,glove);sph(.0092,t1.x,t1.y,t1.z,glove);
 const w=c.clone().addScaledVector(e1,-.03).addScaledVector(d,.04).addScaledVector(e2,.035);forearm(w,V3(-.15,-.32,.48),sleeve,glove)}
// fist around a handle along z (knife / katana / axe); side = 1 right, -1 left
function fistZ(cz,R0,side,sleeve,glove,pad,elbow){const D=Math.PI/180;const c=V3(0,0,cz),d=V3(0,0,-1),e1=V3(side,0,0),e2=V3().crossVectors(d,e1);const R=R0+.0095;
 [-.026,-.008,.01,.027].forEach((t,i)=>arcF(c.clone().addScaledVector(d,t),d,e1,R,i===3?.0085:.0096,(side>0?-10:10)*D*side,215*D,glove,'end'));
 orBox(.022,.05,.08,c.clone().addScaledVector(e1,R*.8),V3(0,1,0),glove,.01);arcF(c.clone().addScaledVector(d,-.03),d,e1,R+.001,.0095,(side>0?250:110)*D,80*D,glove,'end');
 forearm(c.clone().addScaledVector(e1,.016).add(V3(0,-.01,.05)),elbow,sleeve,glove)}
export function handParts(info,sleeve=0x3d4a5c,glove=C.glove,pad=C.pad,nofa=false){NOFA=nofa;wristOut.R=wristOut.L=null;WSIDE=null;parts.length=0;LOD=0;XF=null;MAT='glove';GRP=null;
 if(info.fists){for(const s of[1,-1]){WSIDE=s>0?'R':'L';const x=s>0?0:-.2;const D=Math.PI/180;rbox(.07,.06,.08,x,0,0,glove,.02);for(let i=0;i<4;i++)arcF(V3(x-.026+i*.017,-.005,-.04),V3(1,0,0),V3(0,0,-1),.016,.0095,0,200*D,glove,'end');
  if(det())rbox(.06,.012,.05,x,.032,-.005,pad,.005);forearm(V3(x,-.01,.045),V3(x+s*.04,-.2,.45),sleeve,glove)}return parts.splice(0)}
 if(info.util){const D=Math.PI/180;for(let i=0;i<4;i++)arcF(V3(0,-.015+i*.0,0+(i-1.5)*.0),V3(0,1,0),V3(1,0,0),.045,.0095,(i*12-30)*D,160*D,glove,'end');rbox(.025,.08,.06,.045,-.02,.015,glove,.012);forearm(V3(.05,-.05,.05),V3(.08,-.27,.45),sleeve,glove);return parts.splice(0)}
 const h=info.hold;
 if(h==='knife'||h==='axe'){fistZ(info.grip.c[2],info.grip.w/2,1,sleeve,glove,pad,V3(.09,-.28,.5));return parts.splice(0)}
 if(h==='katana'){fistZ(.02,.015,1,sleeve,glove,pad,V3(.09,-.28,.5));GRP='lh';fistZ(.12,.015,-1,sleeve,glove,pad,V3(-.1,-.3,.5));return parts.splice(0)}
 rightGrip(info.grip,info.trigP,sleeve,glove,pad,info.pistol);
 GRP='lh';
 if(info.pistol&&!info.lh)leftCup(info.grip,sleeve,glove,pad);
 else if(info.lhT==='vert')leftVert(info.lh,sleeve,glove,pad);
 else if(info.lh)leftUnder(info.lh,info.lhR||.026,sleeve,glove,pad);
 return parts.splice(0)}
// ======================= exports =======================
const PC={};
// ======================= PER-MODEL DETAIL EXTRAS (first-person / close-up builds only; third-person LOD skips them) =======================
const GLW=(kind,w,h,x,y,z,rx=0,ry=0)=>{const pt=push(new THREE.PlaneGeometry(w,h),[x,y,z],[rx,ry,0],0xffffff);pt.mat='ret';pt.ret=kind;pt.keepUV=true;return pt};
function GAUGE(x,y,z,r,side=1){const M=MAT;metal();cyl(r,.008,x,y,z,C.steel,{ax:'x',seg:16});matte();cyl(r*.82,.002,x+side*.0042,y,z,0xf2efe6,{ax:'x',seg:16});
 rbox(.0012,r*.7,.0016,x+side*.0055,y+r*.22,z-r*.12,0xd0201a,.0004,-.5,0,0);for(let i=0;i<5;i++){const a=-2.2+i*1.1;rbox(.001,.0012,r*.22,x+side*.0053,y+Math.cos(a)*r*.6,z+Math.sin(a)*r*.6,0x111111,0,a)}MAT=M}
function SWIVEL(x,y,z,R=.008){metal();tor(R,.0016,x,y,z,C.steel,Math.PI*2,0,Math.PI/2,0,[4,12]);rbox(.006,.006,.01,x,y+R,z,C.steel,.002)}
function SHELLS(x,y,z,n=4,dz=.016){matte();rbox(.004,.032,n*dz+.006,x+.002,y,z,C.poly,.002);for(let i=0;i<n;i++){const zz=z-(n-1)*dz/2+i*dz;mat('poly');cyl(.0058,.022,x-.004,y+.004,zz,0xb3261e,{ax:'y',seg:10});metal();mat('brass');cyl(.006,.008,x-.004,y-.011,zz,C.brass,{ax:'y',seg:10})}metal()}
function PSIGHTS(info,zr){const[,yb,zm]=info.muzzle,sy=info.sight[1];metal();rbox(.004,.008,.006,0,sy-.006,zm+.022,C.blk,.0015);GLW('ggreen',.004,.004,0,sy-.004,zm+.0255);
 rbox(.024,.009,.007,0,sy-.006,zr,C.blk,.002);for(const s of[-1,1])GLW('ggreen',.0035,.0035,s*.0065,sy-.0055,zr+.0036)}
function LANYARD(info){const c=info.grip.c,a=info.grip.a||.25;const y=c[1]-.052,z=c[2]+.052*Math.sin(a)+.01;metal();rbox(.024,.006,.03,0,y,z-.004,C.blk,.002);tor(.006,.0014,0,y-.007,z+.008,C.steel,Math.PI*2,0,Math.PI/2,0,[4,10])}
const EXTRA={
 handgun:i=>{PSIGHTS(i,.045);LANYARD(i)},burst:i=>{PSIGHTS(i,.045);LANYARD(i);matte();rbox(.03,.012,.03,0,i.muzzle[1]-.03,-.12,C.blk,.003)},
 glock18:i=>{PSIGHTS(i,.04);LANYARD(i);metal();rbox(.004,.005,.012,.0135,i.muzzle[1]+.008,-.01,0x8d939b,.001)},
 deagle:i=>{PSIGHTS(i,.06);LANYARD(i);metal();for(let k=0;k<5;k++)rbox(.0365,.003,.004,0,i.muzzle[1]+.004,.03+k*.006,0x55595e,.001)},
 cannon:i=>{PSIGHTS(i,.05);LANYARD(i)},revolver:i=>{PSIGHTS(i,.06);LANYARD(i)},
 shotgun:i=>{metal();mat('brass');sph(.0032,0,i.muzzle[1]+.016,i.muzzle[2]+.01,C.brass,[1,1,1],10);SHELLS(-.024,.035,.0,4);SWIVEL(0,i.muzzle[1]-.03,i.muzzle[2]+.12)},
 autoshot:i=>{metal();mat('brass');sph(.0032,0,i.muzzle[1]+.016,i.muzzle[2]+.01,C.brass,[1,1,1],10);SHELLS(-.024,.035,.0,4);SWIVEL(0,i.muzzle[1]-.03,i.muzzle[2]+.12)},
 saiga:i=>{SHELLS(-.024,.03,.15,3);SWIVEL(-.02,.0,.25)},
 aa12:i=>{metal();mat('brass');sph(.0032,0,i.muzzle[1]+.018,i.muzzle[2]+.01,C.brass,[1,1,1],10);SHELLS(-.03,.03,.02,3)},
 double:i=>{metal();mat('brass');sph(.003,0,i.muzzle[1]+.016,i.muzzle[2]+.01,C.brass,[1,1,1],10);mat('rubber');rbox(.04,.03,.07,-.0,i.grip.c[1]+.02,.3,0x3a2a1a,.006);SHELLS(-.024,i.grip.c[1]+.02,.3,3,.018)},
 ksg:i=>{metal();for(let k=0;k<6;k++)rbox(.05,.004,.004,0,-.05-.0,-.17-k*.012,C.blk,.001)},
 sniper:i=>SNX(i),heavy:i=>SNX(i),light:i=>SNX(i),awp:i=>SNX(i),barrett:i=>SNX(i),lever:i=>{SWIVEL(0,i.muzzle[1]-.025,i.muzzle[2]+.15);mat('brass');metal();sph(.003,0,i.muzzle[1]+.014,i.muzzle[2]+.012,C.brass,[1,1,1],8)},
 smg:i=>SMX(i),vector:i=>SMX(i),pdw:i=>SMX(i),mp5:i=>SMX(i),mp7:i=>SMX(i),kriss:i=>SMX(i),p90:i=>SMX(i),ump45:i=>SMX(i),tommy:i=>{SWIVEL(-.0,i.muzzle[1]-.03,i.muzzle[2]+.18);metal();for(let k=0;k<8;k++)rbox(.03,.003,.006,0,i.muzzle[1]+.012,i.muzzle[2]+.03+k*.01,C.steel,.001)},
 lmg:i=>{const[,yb,zm]=i.muzzle;metal();for(let k=0;k<6;k++)rbox(.028,.004,.012,0,yb+.02,zm*.62+k*.03,0x3a3c40,.001);rbox(.014,.04,.012,0,yb+.04,zm*.55,C.blk,.003);rbox(.012,.012,.1,0,yb+.062,zm*.55,C.poly,.005);
  for(const s of[-1,1])rbox(.006,.08,.006,s*.012,yb-.05,zm*.8,C.blk,.002,s*.0,0,s*.25)},
 gl:i=>{SWIVEL(-.044,.0,.12);metal();rbox(.004,.03,.004,0,.11,-.15,C.blk,.001);GLW('gorange',.006,.006,0,.124,-.147)},
 rpg:i=>{metal();for(let k=0;k<4;k++)rbox(.016,.003,.003,0,.056-k*.005,-.149,0xd8d0b0,.0005);GLW('gorange',.005,.005,0,.056,-.326);
  for(let k=0;k<6;k++)tor(.0236,.0014,0,0,-.28+k*.03,0x434934,Math.PI*2,0,0,0,[3,20]);matte();rbox(.03,.012,.06,0,-.03,.0,C.blk,.003);SWIVEL(0,-.032,-.3);SWIVEL(0,-.032,.3)},
 crossbow:i=>{metal();for(const s of[-1,1]){cyl(.012,.008,s*.255,.05,-.318,C.steel,{ax:'y',seg:14});rbox(.02,.006,.02,s*.12,.05,-.388,C.blk,.002)}tor(.04,.004,0,.035,-.47,C.blk,Math.PI,0,0,Math.PI);rbox(.008,.012,.02,.02,.05,.04,C.red,.002);
  mat('rubber');for(const s of[-1,1])rbox(.004,.012,.03,s*.016,.03,-.25,C.rub,.003)},
 minigun:i=>{const yb=.03;metal();for(let k=0;k<5;k++)rbox(.122,.004,.012,0,.06-k*.02,-.12,0x1c1d20,.001);GAUGE(.062,.0,.06,.016,1);
  for(let k=0;k<6;k++)rbox(.03,.02,.018,-.075+k*.005,-.02+k*.012,.02,0x3a3c40,.003,0,0,-.5);GLW('gred',.006,.006,.03,.07,.121);GLW('ggreen',.006,.006,.045,.07,.121)},
 water:i=>{GAUGE(.026,.04,.06,.014,1);matte();cyl(.008,.05,0,.1,.13,0xff8c1a,{seg:10});metal();for(let k=0;k<3;k++)tor(.0105,.002,0,.04,-.25-k*.03,0x1b5fa8,Math.PI*2,0,0,0,[3,14]);
  matte();for(const s of[-1,1])rbox(.003,.012,.2,s*.026,.03,-.05,0xfff1c4,.002)},
 taser:i=>{matte();for(let k=0;k<3;k++)rbox(.038,.032,.004,0,.04,-.11-k*.008,k%2?C.blk:0xffd23f,.002);GLW('gcyan',.006,.006,-.01,.04,-.1372);GLW('gcyan',.006,.006,.01,.04,-.1372);
  for(let k=0;k<3;k++)GLW(k<2?'ggreen':'gred',.005,.005,-.008+k*.008,.064,.046);metal();rbox(.008,.006,.012,-.018,.055,.0,C.red,.002)},
 flare:i=>{metal();cyl(.004,.046,0,.025,.0,C.steel,{ax:'x',seg:8});rbox(.014,.018,.016,0,.075,.05,C.blk,.003,.4);mat('brass');cyl(.0195,.004,0,.045,-.016,C.brass,{seg:20});GLW('gorange',.03,.03,0,.045,-.205)},
 freeze:i=>{const yb=.04;GAUGE(.026,.06,.07,.014,1);GAUGE(-.026,.06,.07,.014,-1);mat('rubber');for(let k=0;k<6;k++)cyl(.006,.035,.03,.1-k*.012,-.12-k*.016,0x1a1a1a,{seg:8});
  for(let k=0;k<5;k++)GLW('gcyan',.05,.05,0,yb,-.22-k*.035);GLW('gcyan',.05,.04,.036,.11,-.02,0,Math.PI/2);GLW('gcyan',.05,.04,-.036,.11,-.02,0,-Math.PI/2);
  metal();for(let k=0;k<4;k++)rbox(.052,.003,.012,0,.072,-.1+k*.03,0x95a5a6,.001)},
 laser:i=>{const yb=.045;for(const s of[-1,1])GLW('gcyan',.3,.014,s*.0285,.05,-.05,0,s*Math.PI/2);GLW('gcyan',.04,.04,0,yb,-.468);GLW('gcyan',.05,.012,0,.08,-.28,-Math.PI/2);
  metal();for(let k=0;k<6;k++)rbox(.058,.004,.008,0,.03,-.2-k*.018,0x8a9098,.001);matte();rbox(.03,.03,.06,-.034,.03,.1,0x2b2d31,.004);GLW('gcyan',.04,.016,-.0495,.03,.1,0,-Math.PI/2)},
 paintball:()=>{},chainsaw:()=>{},
};
function SNX(i){const[,yb,zm]=i.muzzle;const sy=i.sight[1],sz=i.sight[2];metal();rbox(.012,.008,.02,.024,sy-.022,sz-.17,C.blk,.002);GLW('ggreen',.006,.004,.024,sy-.017,sz-.159);
 SWIVEL(0,yb-.028,zm*.55);SWIVEL(0,yb-.05,.3);mat('rubber');rbox(.03,.01,.06,0,yb-.02,.42,C.rub,.003)}
function SMX(i){const[,yb,zm]=i.muzzle;SWIVEL(-.022,yb,i.grip.c[2]+.06,.007);metal();rbox(.004,.012,.03,.022,yb+.01,i.grip.c[2]-.06,C.steel,.001)}
export function gunParts(id,lod=0){const k=id+'|'+lod;if(!PC[k]){parts.length=0;LOD=lod;XF=null;MAT='metal';GRP=null;TRG=null;const info=(BUILD[id]||BUILD.ar)();if(!info.sight)info.sight=[0,info.sightY||.06,.15];if(!lod&&EXTRA[id]){const M=MAT,G=GRP;GRP=null;XF=null;MAT='metal';EXTRA[id](info);MAT=M;GRP=G}info.trigP=info.trigP||TRG;LOD=0;
  if(!info.sight)info.sight=[0,info.sightY||.06,.15];info.sightY=info.sight[1];PC[k]={parts:parts.splice(0),info}}
 return{parts:PC[k].parts,info:PC[k].info}}
export const GUN_MATS=['metal','alu','poly','wood','rubber','brass','chrome','trans','glass','glove','sleeve'];
