import {maxStack,RECIPES} from './raid-catalog.mjs';
export const stackable=it=>!!it&&maxStack(it)>1;
export function compatibleStacks(a,b){return !!a&&!!b&&a!==b&&stackable(a)&&a.kind===b.kind&&a.ammo===b.ammo&&a.material===b.material&&a.utility===b.utility&&(a.medical||'field')===(b.medical||'field')&&!!a.recovery===!!b.recovery&&a.grantOwner===b.grantOwner&&(a.condition??100)===(b.condition??100)}
// Ammunition is dismantled in complete manufacturing batches. In particular,
// dividing a stack cannot turn every single round into one unit of salvage.
export function recyclingQuote(it){
 if(!it||it.recovery||!Number.isSafeInteger(it.quantity)||it.quantity<1||it.quantity>maxStack(it)||!['weapon','armor','med','mod','ammo','key','valuable','contract','utility'].includes(it.kind))return null;
 const batchSize=it.kind==='ammo'?RECIPES['ammo_'+it.ammo]?.output.quantity:1;
 if(!batchSize)return null;
 const batches=Math.floor(it.quantity/batchSize),consumed=batches*batchSize;
 return {material:it.kind==='med'?'chem':it.kind==='mod'?'wire':'steel',quantity:batches*(['weapon','armor'].includes(it.kind)?3:1),consumed,remaining:it.quantity-consumed,batchSize};
}
