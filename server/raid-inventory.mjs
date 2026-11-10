import {randomUUID} from 'node:crypto';
import {maxStack,itemWeight,weaponStats} from '../shared/raid-catalog.mjs';
import {stackable,compatibleStacks} from '../shared/raid-inventory.mjs';
import {requireRule} from './rules.mjs';
import {canRecoverGrant,clearForeignGrantAmmo} from '../shared/raid-grants.mjs';
export function stackPortion(source,quantity){requireRule(stackable(source)&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<source.quantity&&source.quantity<=maxStack(source),'Invalid split quantity');return {...structuredClone(source),id:randomUUID(),quantity,splitFrom:source.splitFrom||source.id}}
export function carriedItem(p,id){for(const name of ['equipment','pack','secure']){const item=p[name].find(it=>it.id===id);if(item)return {name,list:p[name],item}}return null}
export function splitCarried(p,id,quantity){const found=carriedItem(p,id);requireRule(found,'Item not owned');requireRule(p.pack.length<p.cap,'Backpack full');const child=stackPortion(found.item,quantity);found.item.quantity-=quantity;p.pack.push(child);return {itemId:id,childId:child.id,quantity,source:found.name,target:'pack'}}
export function unsecure(p,id){const index=p.secure.findIndex(it=>it.id===id);requireRule(index>=0,'Item not in protected pocket');requireRule(p.pack.length<p.cap,'Backpack full');const [it]=p.secure.splice(index,1);p.pack.push(it);return {itemId:id,quantity:it.quantity,source:'secure',target:'pack'}}
export function dropCarried(raid,p,id,now){const found=carriedItem(p,id);requireRule(found&&found.name!=='secure','Move protected items to the backpack before dropping');requireRule(!(found.name==='equipment'&&found.item.kind==='armor'),'Remove armor before dropping it');const [it]=found.list.splice(found.list.indexOf(found.item),1),bag={id:randomUUID(),x:p.x,y:p.y||0,z:p.z,kind:'gear',team:p.team,label:'Dropped gear',items:[it]};raid.bags.push(bag);
 if(p.weaponId===id){const replacement=[...p.equipment,...p.pack].find(it=>it.kind==='weapon');p.weaponId=replacement?.id??null;p.weapon=replacement?weaponStats(replacement):null;p.ammo=replacement?.loaded||0;p.nextFire=Math.max(p.nextFire||0,now+.5)}return {itemId:id,quantity:it.quantity,source:found.name,target:bag.id};
}
// Hand-off transfers are whole stacks and stay server-authoritative: the
// recipient's slot and weight budgets are checked against the same rules as
// salvage pickups, and bound starter gear never drifts to another operator.
export function giveCarried(p,target,id){
 const source=p.pack.find(it=>it.id===id);
 requireRule(source,'Item not in your backpack');
 requireRule(!source.recovery,'Recovery supplies stay with their original operator');
 requireRule(target&&target!==p&&target.alive&&!target.downed&&target.team===p.team,'Hand off gear to a living squadmate');
 requireRule(canRecoverGrant(source,target.account),'Starter supplies belong to another operator');
 const stack=target.pack.find(it=>it.id!==source.id&&compatibleStacks(it,source)&&it.quantity+source.quantity<=maxStack(it));
 requireRule(stack||target.pack.length<target.cap,'Squadmate backpack is full');
 const recipientWeight=[...target.equipment,...target.pack,...target.secure].reduce((n,it)=>n+itemWeight(it),0)+itemWeight(source);
 requireRule(recipientWeight<=(target.weightCap||40),'Squadmate weight limit exceeded');
 p.pack.splice(p.pack.indexOf(source),1);
 let mergedInto=null;
 if(stack){mergedInto=stack.id;stack.quantity+=source.quantity;stack.favorite=!!(stack.favorite||source.favorite)}
 else target.pack.push(source);
 if(p.weaponId===source.id){const replacement=[...p.equipment,...p.pack].find(it=>it.kind==='weapon'&&it.condition>0);p.weaponId=replacement?.id??null;p.weapon=replacement?weaponStats(replacement):null;p.ammo=replacement?.loaded||0}
 let equipped=false;
 if(source.kind==='weapon'&&!([...target.equipment,...target.pack].find(it=>it.id===target.weaponId&&it.kind==='weapon'&&it.condition>0))){source.loaded??=0;target.weaponId=source.id;target.weapon=weaponStats(source);target.ammo=source.loaded||0;equipped=true}
 return {itemId:id,quantity:source.quantity,source:'pack',target:target.account,...(mergedInto?{mergedInto}:{}),...(equipped?{equipped:true}:{})};
}
export function mergeCarried(p,id,targetId){const source=p.pack.find(it=>it.id===id),target=p.pack.find(it=>it.id===targetId);requireRule(compatibleStacks(source,target),'Incompatible stacks');requireRule(source.quantity+target.quantity<=maxStack(target),'Stack limit exceeded');const quantity=source.quantity;target.quantity+=quantity;target.favorite=!!(target.favorite||source.favorite);p.pack.splice(p.pack.indexOf(source),1);return {itemId:id,targetId,quantity,source:'pack',target:'pack'}}
// A downed enemy operator's body becomes a searchable container once it has
// been searched for the standard 2.4 seconds. Equipped gear is exposed; the
// secure pocket and recovery equipment are never lootable.
export function lootableBody(raid,id){const body=raid.players?.get(id);return body&&body.alive&&body.downed&&body.bodyOpen?body:null}
export function bodyLootItems(body){return [...body.equipment,...body.pack].filter(it=>!it.recovery)}
export function takeLoot(service,raid,p,request){
 const body=lootableBody(raid,request.sourceId);
 const source=raid.caches.find(c=>c.id===request.sourceId&&c.open)||(raid.floorLoot||[]).find(l=>l.id===request.sourceId)||raid.bags.find(b=>b.id===request.sourceId)||(body&&body.team!==p.team&&service.canInteract(raid,p,body,3)?{id:body.account,x:body.x,y:body.y||0,z:body.z,items:bodyLootItems(body),body}:null);
 requireRule(source&&service.canInteract(raid,p,source,3),'Loot out of reach');requireRule(p.pack.length<p.cap,'Backpack full');const it=source.items.find(it=>it.id===request.itemId);requireRule(it,'Item already claimed');requireRule(canRecoverGrant(it,p.account),'Starter supplies belong to another operator');const quantity=request.quantity??it.quantity;requireRule(Number.isSafeInteger(it.quantity)&&it.quantity>0&&it.quantity<=maxStack(it),'Invalid item stack');requireRule(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=it.quantity,'Invalid pickup quantity');const child=quantity===it.quantity?it:stackPortion(it,quantity),grantRoundsBefore=child.grantLoaded||0;clearForeignGrantAmmo(child,p.account);const discardedGrantAmmo=grantRoundsBefore-(child.grantLoaded||0);requireRule(service.weight(p)+itemWeight(child)<=(p.weightCap||40),'Weight limit exceeded');service.store.claimLoot(it.id,p.account);
 if(child===it){const own=source.body?(source.body.equipment.includes(it)?source.body.equipment:source.body.pack):source.items;own.splice(own.indexOf(it),1)}else it.quantity-=quantity;
 if(source.body&&child.kind==='weapon'&&source.body.weaponId===it.id)source.body.weaponId=null;
 p.pack.push(child);
 let equipped=false;
 if(child.kind==='weapon'&&!([...p.equipment,...p.pack].find(active=>active.id===p.weaponId&&active.kind==='weapon'&&active.condition>0))){child.loaded??=0;p.weaponId=child.id;p.weapon=weaponStats(child);p.ammo=child.loaded||0;equipped=true}
 return {itemId:it.id,childId:child.id,quantity,source:source.id,target:'pack',...(equipped?{equipped:true}:{}),...(discardedGrantAmmo?{discardedGrantAmmo}:{})};
}
