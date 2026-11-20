// Presentation-only backpack ordering. The server remains the source of truth
// for item ownership and slot budgets; a reorder never adds or removes items.
export function normalizePackOrder(value){
 const ids=Array.isArray(value)?value:typeof value==='string'?(()=>{try{return JSON.parse(value)}catch{return []}})():[];
 return [...new Set(ids.filter(id=>typeof id==='string'&&id.length>0))].slice(0,512);
}
export function orderPack(items,order){
 const rank=new Map(normalizePackOrder(order).map((id,index)=>[id,index]));
 return items.map((item,index)=>({item,index})).sort((a,b)=>{
  const ai=rank.has(a.item.id)?rank.get(a.item.id):Infinity,bi=rank.has(b.item.id)?rank.get(b.item.id):Infinity;
  if(ai===bi)return a.index-b.index;
  if(ai===Infinity)return 1;
  if(bi===Infinity)return -1;
  return ai-bi;
 }).map(({item})=>item);
}
export function movePackItem(order,itemId,targetId,after=false){
 const ids=normalizePackOrder(order).filter(id=>id!==itemId);
 const index=ids.indexOf(targetId);
 if(index<0)ids.push(itemId);
 else ids.splice(after?index+1:index,0,itemId);
 return ids;
}
