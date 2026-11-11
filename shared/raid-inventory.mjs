import {maxStack,RECIPES} from './raid-catalog.mjs';
export const stackable=it=>!!it&&maxStack(it)>1;
export function compatibleStacks(a,b){return !!a&&!!b&&a!==b&&stackable(a)&&a.kind===b.kind&&a.ammo===b.ammo&&a.material===b.material&&a.utility===b.utility&&(a.medical||'field')===(b.medical||'field')&&!!a.recovery===!!b.recovery&&a.grantOwner===b.grantOwner&&(a.condition??100)===(b.condition??100)}
// Worn equipment dismantles into fewer salvage units. A pristine weapon or
// armor returns three steel, gear above half condition two, and anything lower
// only one. The base UI and the authoritative store quote from this one
// function, so repair-versus-scrap carries the same price in both places.
export function equipmentSalvage(condition){
 const value=Number(condition??100),c=Number.isFinite(value)?Math.max(0,Math.min(100,value)):100;
 return c>=75?3:c>=50?2:1;
}
// Ammunition is dismantled in complete manufacturing batches. In particular,
// dividing a stack cannot turn every single round into one unit of salvage.
export function recyclingQuote(it){
 if(!it||it.recovery||!Number.isSafeInteger(it.quantity)||it.quantity<1||it.quantity>maxStack(it)||!['weapon','armor','med','mod','ammo','key','valuable','contract','utility'].includes(it.kind))return null;
 const batchSize=it.kind==='ammo'?RECIPES['ammo_'+it.ammo]?.output.quantity:1;
 if(!batchSize)return null;
 const batches=Math.floor(it.quantity/batchSize),consumed=batches*batchSize,equipment=it.kind==='weapon'||it.kind==='armor';
 return {material:it.kind==='med'?'chem':it.kind==='mod'?'wire':'steel',quantity:equipment?equipmentSalvage(it.condition):batches,consumed,remaining:it.quantity-consumed,batchSize};
}
