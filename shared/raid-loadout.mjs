// Selection order is part of the loadout: its first weapon becomes primary.
// Presentation sorting must not change that order.
export function orderedSelection(ids,previous=[]){const selected=new Set(ids),ordered=previous.filter((id,i)=>selected.has(id)&&previous.indexOf(id)===i);for(const id of ids)if(!ordered.includes(id))ordered.push(id);return ordered}
export function sameLoadout(a,b){
 const valid=value=>value&&typeof value==='object'&&(value.recovery===undefined||typeof value.recovery==='boolean')&&['itemIds','insureIds'].every(key=>value[key]===undefined||Array.isArray(value[key])&&value[key].every(id=>typeof id==='string'));
 return !!(valid(a)&&valid(b)&&!!a.recovery===!!b.recovery&&JSON.stringify(a.itemIds||[])===JSON.stringify(b.itemIds||[])&&JSON.stringify([...(a.insureIds||[])].sort())===JSON.stringify([...(b.insureIds||[])].sort()));
}
export function describeLoadout(profile,loadout){const chosen=(loadout.itemIds||[]).map(id=>profile.items.find(it=>it.id===id)).filter(Boolean),weapons=chosen.filter(it=>it.kind==='weapon');return {chosen,weapons,primary:weapons[0]||null,secondary:weapons[1]||null,armor:chosen.find(it=>it.kind==='armor')||null}}
