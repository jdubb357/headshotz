import {item} from './rules.mjs';
import {randomBytes,toHex} from '../shared/raid-crypto.mjs';
import {SECTORS,ARTIFACTS} from '../shared/raid-sectors.mjs';
import {WEAPONS,MODS} from '../shared/raid-catalog.mjs';
import {safePoint,findPath} from '../shared/raid-navigation.mjs';
function generator(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}
function weighted(values,random){let remaining=random()*Object.values(values).reduce((n,v)=>n+v,0);for(const [key,weight]of Object.entries(values)){remaining-=weight;if(remaining<0)return key}return Object.keys(values).at(-1)}
const WEAPON_CACHE_NAMES={relay:['Relay signal armory','Courier arms locker','Antenna munitions cache'],reservoir:['Intake arms locker','Basin weapons cache','Purifier munitions store'],switchyard:['Freight arms locker','Turntable weapons cache','Furnace munitions depot']};
const CACHE_SITES=[[-400,0],[0,400],[240,-240]];
const AMMO_ROUNDS={light:30,medium:30,heavy:18,shell:12};
function weaponClass(sector,index,slot){const kinds=Object.keys(sector.weapons);return kinds[(index+slot)%kinds.length]}
function cacheWeapons(sector,random){return weighted(sector.weapons,random)}
// Deterministic, reachable ground pickups: every spawn gets an immediately visible
// weapon drop plus a supply pile and a fallen-operator kit along its approach line.
// They live outside raid.bags so the existing bag semantics stay intact.
export function createSectorGroundLoot(world,seed){
 const sector=SECTORS[world.id],loot=[],seen=new Set();
 const clear=(sx,sz,p)=>{
  if(!p||seen.has(p.x.toFixed(2)+':'+p.z.toFixed(2)))return false;
  const path=findPath(world,{x:sx,y:0,z:sz},{x:p.x,y:p.y||0,z:p.z},{radius:.5,height:1.2,maxNodes:640000});
  return path.length>0;
 };
 world.spawns.forEach(([sx,sz],index)=>{
  const dx=-sx,dz=-sz,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len,sideX=-uz,sideZ=ux;
  const slots=[
   {distance:5,side:0,label:'Dropped weapon',weapons:1,supplies:['ammo']},
   {distance:17,side:2.5,label:'Field supply',weapons:0,supplies:['ammo','med','material']},
   {distance:32,side:-4,label:"Fallen operator's kit",weapons:1,supplies:['ammo','mod']},
   {distance:38,side:7,label:'Overrun outpost',weapons:0,supplies:['mod','armor','valuable']}
  ];
  for(const [slot,spec]of slots.entries()){
   const candidates=[[spec.distance,spec.side],[spec.distance,spec.side+5],[spec.distance,spec.side-5],[Math.max(4,spec.distance-5),spec.side],[Math.min(42,spec.distance+5),spec.side]];
   for(const [distance,side]of candidates){
    const desiredX=sx+ux*distance+sideX*side,desiredZ=sz+uz*distance+sideZ*side;
    const p=safePoint(world,desiredX,desiredZ,{radius:.5,y:0,height:1.2});
    if(!clear(sx,sz,p))continue;
    seen.add(p.x.toFixed(2)+':'+p.z.toFixed(2));
    const random=generator(seed+':'+world.id+':ground:'+index+':'+slot),items=[];
    const ammoKinds=[];
    for(let n=0;n<spec.weapons;n++){
     const weapon=weaponClass(sector,index,slot+n),def=WEAPONS[weapon],ammo=def.ammo;
     items.push(item('weapon',{weapon,condition:55+Math.floor(random()*41),rarity:1+Math.floor(random()*2),loaded:Math.max(1,Math.round(def.mag*(.35+random()*.65)))}));
     ammoKinds.push(ammo);
    }
    for(const supply of spec.supplies){
     if(supply==='ammo'){const ammo=ammoKinds[0]||weighted(sector.ammunition,random);const quantity=Math.round(AMMO_ROUNDS[ammo]*(.5+random()*.8));items.push(item('ammo',{ammo,quantity:Math.max(8,quantity)}))}
     else if(supply==='med')items.push(item('med',{medical:random()>.5?'bandage':'trauma'}));
     else if(supply==='material')items.push(item('material',{material:weighted(sector.materials,random),quantity:1+Math.floor(random()*3)}));
     else if(supply==='mod')items.push(item('mod',{mod:Object.keys(MODS)[Math.floor(random()*3)],rarity:1+Math.floor(random()*2)}));
     else if(supply==='armor')items.push(item('armor',{armor:world.id==='reservoir'?'light':'standard',condition:50+Math.floor(random()*45),rarity:2}));
     else if(supply==='valuable')items.push(item('valuable',{label:sector.valuable,value:35+Math.floor(random()*40),rarity:2}));
    }
    loot.push({id:'ground_'+index+'_'+slot,x:p.x,y:p.y||0,z:p.z,label:spec.label+(spec.weapons?' · '+WEAPONS[items[0].weapon].name:''),spawn:index,slot,ground:true,items});
    break;
   }
  }
 });
 return loot;
}
// The walk out is the game: drop small, readable pickups at a fixed cadence
// along the insertion-to-exit path so the first three minutes have something to
// walk toward, not an empty street. Positions are chosen by the raid service
// from the walkable route; this function only authors the contents.
export const ROUTE_LOOT_MARKS=[55,95,140,185];
export function createRouteLoot(world,seed,spawnIndex,points){
 const sector=SECTORS[world.id],loot=[];
 const random=generator(seed+':'+world.id+':route:'+spawnIndex);
 points.forEach((point,slot)=>{
  const items=[];
  if(slot%3===0){
   const weapon=weighted(sector.weapons,random),def=WEAPONS[weapon],ammo=def.ammo;
   items.push(item('weapon',{weapon,condition:55+Math.floor(random()*46),rarity:1+Math.floor(random()*2),loaded:Math.max(1,Math.round(def.mag*(.35+random()*.65)))}));
   items.push(item('ammo',{ammo,quantity:Math.max(8,Math.round(AMMO_ROUNDS[ammo]*(.5+random()*.8)))}));
  }else if(slot%3===1){
   const ammo=weighted(sector.ammunition,random);
   items.push(item('ammo',{ammo,quantity:Math.max(8,Math.round(AMMO_ROUNDS[ammo]*(.5+random()*.8)))}));
   items.push(item('med',{medical:random()>.5?'bandage':'trauma'}));
   items.push(item('material',{material:weighted(sector.materials,random),quantity:1+Math.floor(random()*3)}));
  }else{
   items.push(item('mod',{mod:Object.keys(MODS)[Math.floor(random()*3)],rarity:1+Math.floor(random()*2)}));
   items.push(item('valuable',{label:sector.valuable,value:18+Math.floor(random()*32),rarity:2}));
  }
  const weapon=items.find(it=>it.kind==='weapon'),label=weapon?'Dropped weapon · '+WEAPONS[weapon.weapon].name:slot%3===1?'Field supply':'Route salvage';
  loot.push({id:'route_'+spawnIndex+'_'+slot,x:point.x,y:point.y||0,z:point.z,label,spawn:spawnIndex,slot:10+slot,ground:true,items});
 });
 return loot;
}
const ARMORY_ARCHETYPES=[
 {tag:'Assault pattern',search:3.4,attachment:0,utility:'smoke',med:null,armor:null,extraMod:false},
 {tag:'Field pattern',search:4.4,attachment:1,utility:null,med:'trauma',armor:'light',extraMod:true},
 {tag:'Covert pattern',search:3.2,attachment:0,utility:'decoy',med:null,armor:'standard',extraMod:false}
];
export function createWeaponCaches(world,seed){
 const sector=SECTORS[world.id],names=WEAPON_CACHE_NAMES[world.id]||['Weapons cache','Arms locker','Munitions store'],pool=Object.keys(sector.weapons);
 return CACHE_SITES.map(([x,z],index)=>{
  const random=generator(seed+':'+world.id+':weapon-cache:'+index),arch=ARMORY_ARCHETYPES[index%ARMORY_ARCHETYPES.length],items=[],weapons=[];
  for(let slot=0;slot<2;slot++){
   let choice;
   for(let offset=0;offset<pool.length;offset++){
    const weapon=pool[(index*2+slot+offset)%pool.length];if(weapons.some(picked=>picked.weapon===weapon))continue;
    const mod=Object.keys(MODS).find(key=>MODS[key].classes.includes(WEAPONS[weapon].class));
    if(slot===arch.attachment&&!mod)continue;
    choice={weapon,mod};break;
   }
   if(!choice)continue;
   weapons.push(choice);
  }
  for(const [slot,{weapon,mod}]of weapons.entries()){
   const def=WEAPONS[weapon],ammo=def.ammo;
   items.push(item('weapon',{weapon,condition:70+Math.floor(random()*31),rarity:2+Math.floor(random()*2),loaded:def.mag,...(slot===arch.attachment&&mod?{attachments:[item('mod',{mod,rarity:2})]}:{})}));
   items.push(item('ammo',{ammo,quantity:AMMO_ROUNDS[ammo]+Math.floor(random()*18)}));
  }
  if(arch.utility)items.push(item('utility',{utility:arch.utility,quantity:1,rarity:2}));
  if(arch.med)items.push(item('med',{medical:arch.med,rarity:2}));
  if(arch.armor)items.push(item('armor',{armor:world.id==='reservoir'?'light':arch.armor,condition:80,rarity:2}));
  if(arch.extraMod)items.push(item('mod',{mod:Object.keys(MODS)[(index+Math.floor(random()*2))%3],rarity:2+Math.floor(random()*2)}));
  items.push(item('valuable',{label:sector.valuable,value:55+index*25,rarity:3}));
  return {id:'armory_'+index,x,z,y:0,open:false,vault:false,label:names[index]+' · '+arch.tag,tier:3,weaponCache:true,archetype:arch.tag,searchSeconds:arch.search,searcher:null,searchUntil:0,items};
 });
}
export function createSectorCaches(world,raidId,seed=toHex(randomBytes(16))){
 const sector=SECTORS[world.id];return world.caches.map(([x,z,y=0],index)=>{
  const meta=world.cacheMeta?.[index]||{},tier=meta.tier||0,random=generator(seed+':'+world.id+':'+index),ammo=weighted(sector.ammunition,random),material=index===7?'fuel':weighted(sector.materials,random),rarity=Math.min(4,tier+(meta.vault?1:0));
  const items=[index===0?item('key'):item('valuable',{label:sector.valuable,value:12+tier*18+Math.floor(random()*12),rarity}),item('material',{material,quantity:2+Math.floor(random()*(tier+1)),rarity:Math.min(2,tier)}),item('ammo',{ammo,quantity:ammo==='heavy'?10:ammo==='shell'?12:30})];
  if(index%3===1||meta.vault)items.push(item('weapon',{weapon:weighted(sector.weapons,random),condition:65+Math.floor(random()*36),rarity:Math.max(1,rarity)}));
  if(world.id==='reservoir'&&(index%3===2||meta.vault))items.push(item('med',{quantity:1+Number(tier>=2)}));
  if(tier>=2&&(index%2===0||meta.vault))items.push(item('mod',{mod:world.id==='relay'?'scope':world.id==='switchyard'?'magazine':'suppressor',rarity:Math.max(2,rarity)}));
  if([3,6,9].includes(index))items.push(item('utility',{utility:index===3?'smoke':index===6?'decoy':'frag'}));
  if(meta.vault||tier>=2&&index%4===2)items.push(item('armor',{armor:meta.vault?'heavy':world.id==='reservoir'?'light':'standard',condition:65+Math.floor(random()*36)}));
  if(index%4===1)items.push(item('med',{medical:world.id==='reservoir'?'trauma':index%3?'bandage':'splint'}));
  const artifact=ARTIFACTS[sector.artifact];if(meta.name===artifact.site)items.push(item('contract',{artifact:sector.artifact,originMap:world.id,originRaid:raidId,rarity:3}));
  return {id:'cache'+index,x,y,z,open:false,vault:!!meta.vault,label:meta.name||'Salvage cache',tier,searcher:null,searchUntil:0,items};
 });
}
