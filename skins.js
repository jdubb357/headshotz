// HeadShotz v53 Skin Shop catalogue: cosmetic player skins bought with in-game diamonds (no real money, no ads).
// One definition renders in BOTH worlds: Royale toon heroes (toon.js builds a hero outfit from it) and the main-game humans
// (humans.js/chars.js take shirt/pants/camo + a head piece). `tint` re-colours the accent pieces / shirt (9 choices, 0 = original).
export const RAR_N=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
export const RAR_C=['#9aa4b2','#4cd964','#4dabff','#b37bff','#ffb020'];
export const TINTS=[null,0xff4d4d,0xff9a2e,0xffd23f,0x4cd964,0x2fd5ff,0x4d7cff,0xb36bff,0xff5fb5];
export const TINT_N=['Original','Red','Orange','Gold','Green','Cyan','Blue','Violet','Pink'];
// c: [primary (shirt/top), secondary (pants), accent]; hat = head piece (toon + human); pat = chest pattern (toon) ; camo = pants pattern on humans (1-4)
export const SKIN_DEFS=[
 {id:'sky',name:'Street Athlete',rar:0,price:40,c:[0xf4f4f4,0x1f3fa0,0xff3b30],hat:'',pat:'',pack:''},
 {id:'sunset',name:'Road Biker',rar:0,price:50,c:[0x1b1b1d,0x2a3350,0xff7a1a],hat:'helmet',hatc:0x1b1b1d,pat:'',pack:''},
 {id:'ranger',name:'Ghillie Sniper',rar:0,price:60,c:[0x4f6b33,0x3c4a28,0x8a7a45],hat:'bandana',hatc:0x4f6b33,pat:'',pack:'box',packc:0x3c4a28},
 {id:'cherry',name:'Firefighter',rar:0,price:60,c:[0xd9c231,0x2b2d33,0xe5333f],hat:'helmet',hatc:0xe5333f,pat:'',pack:'tank',packc:0xcfd4da},
 {id:'tiger',name:'Cowboy',rar:1,price:100,c:[0x7a4a22,0x3b4a6b,0xd9b36a],hat:'tophat',hatc:0x7a4a22,pat:'',pack:''},
 {id:'frost',name:'Scuba Diver',rar:1,price:100,c:[0x14181f,0x14181f,0x2fd5ff],hat:'visor',hatc:0x2fd5ff,pat:'',pack:'tank',packc:0x2fd5ff},
 {id:'hazard',name:'Hazmat Tech',rar:1,price:110,c:[0xffd23f,0xffd23f,0x222222],hat:'helmet',hatc:0xffd23f,pat:'',pack:'tank',packc:0x222222},
 {id:'grape',name:'Tactical Operator',rar:1,price:120,c:[0x2b2f33,0x2b2f33,0xff6b00],hat:'helmet',hatc:0x2b2f33,pat:'',pack:'box',packc:0x2b2f33},
 {id:'ronin',name:'Wandering Ronin',rar:2,price:170,c:[0x3a4a5a,0x20232a,0xcaa24a],hat:'mask',hatc:0x101010,pat:'',pack:'quiver',packc:0x6b4226},
 {id:'cyber',name:'Cyberpunk',rar:2,price:200,c:[0x15131f,0x11101a,0x19f0ff],hat:'mohawk',hatc:0xff2fb4,pat:'',pack:''},
 {id:'pirate',name:'Pirate Captain',rar:2,price:180,c:[0x7a1f1f,0x2b2118,0xd9b36a],hat:'pirate',hatc:0x20232e,pat:'',pack:''},
 {id:'chef',name:'Head Chef',rar:2,price:160,c:[0xffffff,0x4a5a77,0xe5333f],hat:'chef',hatc:0xffffff,pat:'',pack:''},
 {id:'inferno',name:'Demon Lord',rar:3,price:340,c:[0x2a0f10,0x1a0a0a,0xff6a1a],hat:'horns',hatc:0x1a1210,pat:'',pack:'wings2',packc:0x3a0e0e},
 {id:'starpilot',name:'Astronaut',rar:3,price:320,c:[0xe8ecf2,0xdde3ec,0x3a74ff],hat:'helmet',hatc:0xe8ecf2,pat:'',pack:'tank',packc:0xe8ecf2},
 {id:'candy',name:'Pharaoh',rar:3,price:360,c:[0xf1e7c8,0xf1e7c8,0xd4a83a],hat:'crown',hatc:0x2a6bd0,pat:'',pack:''},
 {id:'punk',name:'Android',rar:3,price:300,c:[0xe6e8ec,0x3a3f48,0x35d4ff],hat:'visor',hatc:0x35d4ff,pat:'',pack:''},
 {id:'solar',name:'Plate Knight',rar:4,price:560,c:[0xb0202a,0x2a2a2e,0xffd23f],hat:'helmet',hatc:0xb8bcc4,pat:'',pack:'cape',packc:0xb0202a},
 {id:'void',name:'Skeleton Warrior',rar:4,price:600,c:[0x2a2430,0x1a1720,0x8cffd8],hat:'mask',hatc:0xe6dfc8,pat:'',pack:'cape',packc:0x0a0a0c},
 {id:'lemon',name:'Mummy',rar:0,price:40,c:[0xd8c9a0,0xcbbd90,0x6b5a3a],hat:'bandana',hatc:0xd8c9a0,pat:'',pack:''},
 {id:'forest',name:'Zombie',rar:0,price:50,c:[0x5a6a48,0x3a3a30,0x8a2020],hat:'',pat:'',pack:''},
 {id:'ocean',name:'Mechanic',rar:0,price:50,c:[0x2a5fa8,0x2a5fa8,0xffb020],hat:'bandana',hatc:0xc83a2a,pat:'',pack:'box',packc:0x3a2a1a},
 {id:'rose',name:'Field Medic',rar:1,price:100,c:[0xe8f4ee,0x2f8a6a,0xc0262b],hat:'beanie',hatc:0x2f8a6a,pat:'',pack:'box',packc:0xc0262b},
 {id:'steel',name:'Riot Guard',rar:1,price:110,c:[0x23272d,0x23272d,0x7fb3d5],hat:'helmet',hatc:0x2f353c,pat:'',pack:''},
 {id:'jungle',name:'Alien',rar:1,price:120,c:[0x7fa080,0x2a3340,0x7bff9c],hat:'',pat:'',pack:''},
 {id:'moonmage',name:'Wizard',rar:2,price:180,c:[0x3b2a8c,0x1a1440,0xffd23f],hat:'tophat',hatc:0x2a1a6c,pat:'',pack:'cape',packc:0x2a1a6c},
 {id:'viking',name:'Viking Raider',rar:2,price:170,c:[0x6a4a2a,0x3a2a1a,0xc9b27a],hat:'horns',hatc:0xc9b27a,pat:'',pack:'round',packc:0x6b4226},
 {id:'samurai',name:'Crimson Samurai',rar:2,price:190,c:[0xb3202a,0x1b1d21,0xffd23f],hat:'mask',hatc:0x1b1d21,pat:'',pack:'quiver',packc:0x1b1d21},
 {id:'galaxy',name:'Star Drifter',rar:3,price:340,c:[0x2a3b5c,0x151c2c,0x2fd5ff],hat:'halo',hatc:0x2fd5ff,pat:'',pack:'cape',packc:0x1a1a40},
 {id:'gladiator',name:'Gladiator',rar:3,price:320,c:[0xb98a4a,0x6b2a1a,0xcfa43a],hat:'helmet',hatc:0xcfa43a,pat:'',pack:'cape',packc:0xb3202a},
 {id:'dragon',name:'Dragon Slayer',rar:4,price:580,c:[0x7a1a1a,0x2a0e0e,0xffb020],hat:'horns',hatc:0xe0d6bc,pat:'',pack:'cape',packc:0x5a1010},
 {id:'aurora',name:'Frost Queen',rar:4,price:570,c:[0x9fe8ff,0x3a6a8a,0xffffff],hat:'crown',hatc:0xbff0ff,pat:'',pack:'cape',packc:0xc8ecff},
 // classic human outfits (these existed before the shop; they now also have hero versions)
 {id:'ninja',name:'Shadow Ninja',rar:1,price:100,c:[0x1b1d21,0x111214,0xa31515],hat:'mask',hatc:0x1b1d21,pat:'',pack:'quiver',packc:0x2a2d3a,legacy:1},
 {id:'desert',name:'Desert Raider',rar:0,price:100,c:[0xcbb386,0x8b7a55,0x6b3a1a],hat:'bandana',hatc:0xcbb386,pat:'',pack:'',legacy:1},
 {id:'arctic',name:'Arctic Explorer',rar:1,price:120,c:[0xd8e6f0,0x39506a,0xff7a2a],hat:'beanie',hatc:0xd8e6f0,pat:'',pack:'box',packc:0xff7a2a,legacy:1},
 {id:'royal',name:'The King',rar:2,price:160,c:[0x5b1a86,0x2a1040,0xffd23f],hat:'crown',hatc:0xffd23f,pat:'',pack:'cape',packc:0x5b1a86,legacy:1},
 {id:'neon',name:'Neon Racer',rar:2,price:200,c:[0xff2d6f,0x15151a,0x19f0ff],hat:'visor',hatc:0x19f0ff,pat:'',pack:'',legacy:1},
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
export function humanOutfit(id,tint=0){const def=SKIN_BY[id];if(!def)return null;const k=skinColors(def,tint);const o=[k.top,k.pants];o.camo=def.camo||0;o.x={hat:def.hat||'',hatc:k.hatc||k.acc,acc:k.acc,vest:mixc(k.top,0x1c1f22,.55),pat:def.pat||'',fx:def.fx||'',kit:id,c:{top:k.top,pants:k.pants,acc:k.acc,hat:k.hatc||k.acc,pack:k.packc||k.acc}};o.skinId=id;return o}
// composite id used on the wire + in saves: "ember" or "ember~3" (tint index)
export function splitSkin(s){s=String(s||'default');const i=s.indexOf('~');const id=i<0?s:s.slice(0,i);let t=i<0?0:parseInt(s.slice(i+1));if(!(t>=0&&t<TINTS.length))t=0;return{id,tint:t}}
export const joinSkin=(id,tint)=>tint>0?id+'~'+tint:id;
