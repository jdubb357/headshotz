// Arrange earned purchasing power for tests of ordinary tradeable equipment.
// The starter allowance remains intact; production has no credit-grant API.
export function earnedPurchase(store,account,{sku='ar',trader='outfitter'}={}){
 const offer=store.market(account).find(t=>t.id===trader).stock.find(it=>it.sku===sku),before=new Set(store.profile(account).items.map(it=>it.id));
 store.transaction(()=>{const s=store.state(account);s.credits+=offer.price;store.save(account,s)});
 store.trade(account,{type:'buy',trader,sku});return store.profile(account).items.find(it=>!before.has(it.id));
}
