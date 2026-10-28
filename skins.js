// HeadShotz v53 Skin Shop catalogue: cosmetic player skins bought with in-game diamonds (no real money, no ads).
// One definition renders in BOTH worlds: Royale toon heroes (toon.js builds a hero outfit from it) and the main-game humans
// (humans.js/chars.js take shirt/pants/camo + a head piece). `tint` re-colours the accent pieces / shirt (9 choices, 0 = original).
export const RAR_N=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
export const RAR_C=['#9aa4b2','#4cd964','#4dabff','#b37bff','#ffb020'];
export const TINTS=[null,0xff4d4d,0xff9a2e,0xffd23f,0x4cd964,0x2fd5ff,0x4d7cff,0xb36bff,0xff5fb5];
export const TINT_N=['Original','Red','Orange','Gold','Green','Cyan','Blue','Violet','Pink'];
// c: [primary (shirt/top), secondary (pants), accent]; hat = head piece (toon + human); pat = chest pattern (toon) ; camo = pants pattern on humans (1-4)
export const SKIN_DEFS=[
 {id:'sky',name:'Sky Rookie',rar:0,price:40,c:[0x4fb3ff,0x2c3e6b,0xffffff],hat:'beanie',hatc:0xffffff,pat:'',pack:'round',packc:0xffffff},
 {id:'sunset',name:'Sunset Stripe',rar:0,price:50,c:[0xff7a45,0x3a2a4f,0xffd23f],hat:'',pat:'stripe',pack:'',hs:0},
 {id:'ranger',name:'Mossy Ranger',rar:0,price:60,c:[0x5f8f3a,0x4a3b2a,0xd9c48a],hat:'bandana',hatc:0xc0392b,pat:'',camo:1,pack:'box',packc:0x4a3b2a},
 {id:'cherry',name:'Cherry Pop',rar:0,price:60,c:[0xe5333f,0x2b2f3a,0xffffff],hat:'',pat:'dots',pack:'round',packc:0xffffff,hs:2},
 {id:'tiger',name:'Tiger Tamer',rar:1,price:100,c:[0xff8c1a,0x20232e,0x111111],hat:'ears',hatc:0xff8c1a,pat:'stripe',camo:3,pack:'',hs:7},
 {id:'frost',name:'Frost Byte',rar:1,price:100,c:[0xbfe8ff,0x3b5b8c,0x2fd5ff],hat:'headphones',hatc:0x2fd5ff,pat:'',pack:'tank',packc:0x2fd5ff},
 {id:'hazard',name:'Hazard Tech',rar:1,price:110,c:[0xffd23f,0x2b2f3a,0x111111],hat:'visor',hatc:0x2fd5ff,pat:'hazard',pack:'box',packc:0x111111},
 {id:'grape',name:'Grape Soda',rar:1,price:120,c:[0x9b59ff,0x3b2a6b,0xffffff],hat:'bunny',hatc:0xffb7e6,pat:'dots',pack:'round',packc:0xffb7e6},
 {id:'ronin',name:'Jade Ronin',rar:2,price:170,c:[0x1f7a5a,0x1b2b27,0xffd23f],hat:'mask',hatc:0x101010,pat:'',camo:4,pack:'quiver',packc:0x6b4226},
 {id:'cyber',name:'Cyber Pulse',rar:2,price:200,c:[0x1b1f2e,0x10131c,0x19f0ff],hat:'visor',hatc:0x19f0ff,pat:'bolt',pack:'tank',packc:0x19f0ff},
 {id:'pirate',name:'Captain Pete',rar:2,price:180,c:[0x7a3b1d,0x2b2f3a,0xffd23f],hat:'pirate',hatc:0x20232e,pat:'stripe',pack:'',hs:1},
 {id:'chef',name:'Chef Chaos',rar:2,price:160,c:[0xffffff,0x2b3a55,0xe5333f],hat:'chef',hatc:0xffffff,pat:'',pack:'',hs:4},
 {id:'inferno',name:'Inferno',rar:3,price:340,c:[0x20232e,0x14161d,0xff6a1a],hat:'horns',hatc:0xff6a1a,pat:'bolt',pack:'wings2',packc:0xff6a1a},
 {id:'starpilot',name:'Star Pilot',rar:3,price:320,c:[0x23306b,0x151c3f,0xdfe6ff],hat:'halo',hatc:0xffd23f,pat:'stars',pack:'wings',packc:0xdfe6ff},
 {id:'candy',name:'Candy Royale',rar:3,price:360,c:[0xff8fcf,0x6ee7c8,0xffffff],hat:'tophat',hatc:0xff4fa3,pat:'dots',pack:'cape',packc:0xff4fa3},
 {id:'punk',name:'Midnight Punk',rar:3,price:300,c:[0x111118,0x1a1030,0xb36bff],hat:'mohawk',hatc:0xb36bff,pat:'bolt',pack:'',hs:-1},
 {id:'solar',name:'Solar Emperor',rar:4,price:560,c:[0xffd23f,0xf2f2f2,0xffffff],hat:'crown',hatc:0xffd23f,pat:'stars',pack:'cape',packc:0xe5333f},
 {id:'void',name:'Void Phantom',rar:4,price:600,c:[0x120a24,0x0a0614,0xb36bff],hat:'horns',hatc:0xb36bff,pat:'bolt',pack:'wings2',packc:0x4a1a8c},
 {id:'lemon',name:'Lemon Zest',rar:0,price:40,c:[0xffe14a,0x4a4a6b,0xffffff],hat:'headphones',hatc:0x4a4a6b,pat:'stripe',pack:'',hs:3},
 {id:'forest',name:'Forest Scout',rar:0,price:50,c:[0x3f6b34,0x3a2f22,0xc9b27a],hat:'beanie',hatc:0x3a2f22,pat:'',camo:1,pack:'round',packc:0x3a2f22},
 {id:'ocean',name:'Ocean Wave',rar:0,price:50,c:[0x2a8fbd,0x1b3a52,0xffffff],hat:'bandana',hatc:0xffffff,pat:'stripe',pack:'',hs:0},
 {id:'rose',name:'Rose Quartz',rar:1,price:100,c:[0xff7aa8,0x4a2a4f,0xffffff],hat:'bunny',hatc:0xff7aa8,pat:'dots',pack:'round',packc:0xffd0e2},
 {id:'steel',name:'Steel Sentinel',rar:1,price:110,c:[0x8a96a6,0x2b3340,0x2fd5ff],hat:'visor',hatc:0x2fd5ff,pat:'hazard',pack:'tank',packc:0x2b3340},
 {id:'jungle',name:'Jungle Cat',rar:1,price:120,c:[0x2f7a3a,0x2a2a1a,0xffd23f],hat:'ears',hatc:0x2f7a3a,pat:'dots',camo:1,pack:'',hs:7},
 {id:'moonmage',name:'Moon Mage',rar:2,price:180,c:[0x3b2a8c,0x1a1440,0xffd23f],hat:'tophat',hatc:0x2a1a6c,pat:'stars',pack:'cape',packc:0x2a1a6c},
 {id:'viking',name:'Viking Chief',rar:2,price:170,c:[0x8a5a2b,0x3a2a1a,0xd9c48a],hat:'horns',hatc:0xd9c48a,pat:'stripe',pack:'round',packc:0x6b4226,hs:1},
 {id:'samurai',name:'Crimson Samurai',rar:2,price:190,c:[0xb3202a,0x1b1d21,0xffd23f],hat:'mask',hatc:0x1b1d21,pat:'bolt',camo:4,pack:'quiver',packc:0x1b1d21},
 {id:'galaxy',name:'Galaxy Drifter',rar:3,price:340,c:[0x2a1a5c,0x120a30,0x2fd5ff],hat:'halo',hatc:0x2fd5ff,pat:'stars',pack:'wings',packc:0x6a4ae0},
 {id:'gladiator',name:'Gold Gladiator',rar:3,price:320,c:[0xc9a13a,0x6b2a1a,0xffffff],hat:'helmet',hatc:0xc9a13a,pat:'stripe',pack:'cape',packc:0xb3202a},
 {id:'dragon',name:'Dragon Lord',rar:4,price:580,c:[0x1f9a4a,0x0e2a1a,0xffb020],hat:'horns',hatc:0xffb020,pat:'bolt',pack:'wings2',packc:0x0e5a2a},
 {id:'aurora',name:'Aurora Queen',rar:4,price:570,c:[0x19e0c8,0x0a2a3a,0xb36bff],hat:'crown',hatc:0xb36bff,pat:'stars',pack:'wings',packc:0xb36bff},
 // classic human outfits (these existed before the shop; they now also have hero versions)
 {id:'ninja',name:'Ninja',rar:1,price:100,c:[0x1b1d21,0x111214,0xa31515],hat:'mask',hatc:0x1b1d21,pat:'',pack:'quiver',packc:0x2a2d3a,legacy:1},
 {id:'desert',name:'Desert Ops',rar:0,price:100,c:[0xb59a6a,0x7d6a4a,0xd9c48a],hat:'bandana',hatc:0xd9c48a,pat:'',camo:2,pack:'box',packc:0x7d6a4a,legacy:1},
 {id:'arctic',name:'Arctic',rar:1,price:120,c:[0xe6edf2,0x9aa6b0,0x2fd5ff],hat:'beanie',hatc:0xe6edf2,pat:'',pack:'round',packc:0x9aa6b0,legacy:1},
 {id:'royal',name:'Royal',rar:2,price:160,c:[0x5b2a86,0xd4a83a,0xffd23f],hat:'crown',hatc:0xd4a83a,pat:'stripe',pack:'cape',packc:0x5b2a86,legacy:1},
 {id:'neon',name:'Neon',rar:2,price:200,c:[0x18e07a,0x101010,0xffffff],hat:'visor',hatc:0x18e07a,pat:'bolt',pack:'tank',packc:0x18e07a,legacy:1},
 {id:'gxv',name:'Nebula Walker',rar:4,price:700,c:[0x3a1a7a,0x1a0f3a,0xff7ad9],hat:'halo',hatc:0xc58bff,pat:'',pack:'wings',packc:0x6a2bd1,hs:4,fx:'purple'},
 {id:'gxb',name:'Azure Nova',rar:4,price:700,c:[0x153a8a,0x0a1a40,0x2fd5ff],hat:'halo',hatc:0x2fd5ff,pat:'',pack:'wings',packc:0x2a6bff,hs:0,fx:'blue'},
 {id:'gxr',name:'Crimson Eclipse',rar:4,price:700,c:[0x7a1020,0x2a0810,0xff6a3a],hat:'horns',hatc:0xff6a3a,pat:'',pack:'wings2',packc:0xe0243a,hs:7,fx:'red'},
 {id:'gxg',name:'Golden Quasar',rar:4,price:900,c:[0x8a5a10,0x2a1a05,0xffe27a],hat:'crown',hatc:0xffd23f,pat:'',pack:'cape',packc:0xe8a21a,hs:2,fx:'gold'}];
export const SKIN_BY=Object.fromEntries(SKIN_DEFS.map(d=>[d.id,d]));
export const SKIN_IDS=SKIN_DEFS.map(d=>d.id);
const mixc=(a,b,t)=>{const ar=a>>16&255,ag=a>>8&255,ab=a&255,br=b>>16&255,bg=b>>8&255,bb=b&255;return(Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t)};
// tinted colours: tint 0 keeps the original; otherwise the accent pieces take the tint (and the shirt leans toward it)
export function skinColors(def,tint=0){const [p,s,a]=def.c;const T=tint>0?TINTS[tint]:null;
 return{top:T?mixc(p,T,def.rar>=3?.45:.62):p,pants:s,acc:T||a,hatc:T&&def.hat?(def.hatc===0xffffff||def.hatc===0x101010||def.hatc===0x20232e?def.hatc:T):def.hatc,packc:T&&def.pack?T:def.packc}}
// toon hero definition (appended to toon.js OUTFITS)
export function toonDef(def){const [p,s,a]=def.c;return{name:def.name,top:p,acc:a,pants:s,shoes:mixc(s,0x000000,.35),glove:a===0x111111?s:a,skin:[0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0xffdbac,0xd4a373][def.id.length%6],hair:[0x5a3825,0x111111,0x2b1d14,0xf2c94c,0x7a3b1d][def.id.charCodeAt(0)%5],hs:def.hs??(def.id.charCodeAt(1)%4),hat:def.hat||'none',hatc:def.hatc||0,iris:0x3a7bd5,pack:def.pack||'none',packc:def.packc||0,pat:def.pat||'',sleeve:1,rar:def.rar,skinId:def.id,fx:def.fx||''}}
// human outfit descriptor consumed by chars.js/humans.js: an array [shirt,pants] carrying extras
export function humanOutfit(id,tint=0){const def=SKIN_BY[id];if(!def)return null;const k=skinColors(def,tint);const o=[k.top,k.pants];o.camo=def.camo||0;o.x={hat:def.hat||'',hatc:k.hatc||k.acc,acc:k.acc,vest:mixc(k.top,0x1c1f22,.55),pat:def.pat||'',fx:def.fx||''};o.skinId=id;return o}
// composite id used on the wire + in saves: "ember" or "ember~3" (tint index)
export function splitSkin(s){s=String(s||'default');const i=s.indexOf('~');const id=i<0?s:s.slice(0,i);let t=i<0?0:parseInt(s.slice(i+1));if(!(t>=0&&t<TINTS.length))t=0;return{id,tint:t}}
export const joinSkin=(id,tint)=>tint>0?id+'~'+tint:id;
