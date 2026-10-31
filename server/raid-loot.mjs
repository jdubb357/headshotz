import {item} from './rules.mjs';
import {randomBytes} from 'node:crypto';
import {SECTORS,ARTIFACTS} from '../shared/raid-sectors.mjs';
function generator(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}
function weighted(values,random){let remaining=random()*Object.values(values).reduce((n,v)=>n+v,0);for(const [key,weight]of Object.entries(values)){remaining-=weight;if(remaining<0)return key}return Object.keys(values).at(-1)}
export function createSectorCaches(world,raidId,seed=randomBytes(16).toString('hex')){
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
