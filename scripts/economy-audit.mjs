import {pathToFileURL} from 'node:url';
import {RaidStore,item} from '../server/store.mjs';
import {TRADERS,RECIPES,skuDefinition,maxStack} from '../shared/raid-catalog.mjs';
import {recyclingQuote} from '../shared/raid-inventory.mjs';
export function auditEconomy(){
 const store=new RaidStore();try{
  const trades=Object.values(TRADERS).flatMap(t=>Object.keys(t.stock)).filter((v,i,a)=>a.indexOf(v)===i).map(sku=>{
   const def=skuDefinition(sku),buyAtMaximumDiscount=Math.ceil(def.price*.8),resale=store.value(item(def.kind,def));return {sku,buyAtMaximumDiscount,resale,profit:resale-buyAtMaximumDiscount};
  });
  const recipes=Object.entries(RECIPES).map(([id,recipe])=>{
   const salvageResale=Object.values(recipe.materials).reduce((sum,n)=>sum+n*2,0),output=store.value(item(recipe.output.kind,recipe.output));
   return {id,creditCost:recipe.credits,salvageResale,outputResale:output,profit:output-recipe.credits-salvageResale};
  });
  const splits=trades.map(({sku})=>{const def=skuDefinition(sku),limit=maxStack(def);if(limit<=1)return null;let profit=0,cases=0;for(let total=2;total<=limit;total++)for(let quantity=1;quantity<total;quantity++){const base={kind:def.kind,...def};const gain=store.value({...base,quantity})+store.value({...base,quantity:total-quantity})-store.value({...base,quantity:total});profit=Math.max(profit,gain);cases++}return {sku,profit,cases}}).filter(Boolean);
  const recycledValue=(it,quote)=>store.value(item('material',{material:quote.material,quantity:quote.quantity}))+(quote.remaining?store.value({...it,quantity:quote.remaining}):0);
  const recyclingTrades=trades.map(({sku,buyAtMaximumDiscount})=>{
   const def=skuDefinition(sku),unit=def.quantity||1;let worst=null;
   for(let purchases=1;purchases*unit<=maxStack(def);purchases++){const it=item(def.kind,{...def,quantity:purchases*unit}),quote=recyclingQuote(it);if(!quote?.quantity)continue;const cost=purchases*buyAtMaximumDiscount,resale=recycledValue(it,quote),row={sku,purchases,quantity:it.quantity,cost,resale,profit:resale-cost};if(!worst||row.profit>worst.profit)worst=row}return worst;
  }).filter(Boolean);
  const recyclingRecipes=Object.entries(RECIPES).map(([id,recipe])=>{
   const it=item(recipe.output.kind,recipe.output),quote=recyclingQuote(it);if(!quote?.quantity)return null;const cost=recipe.credits+Object.values(recipe.materials).reduce((sum,n)=>sum+n*2,0),resale=recycledValue(it,quote);return {id,cost,resale,profit:resale-cost};
  }).filter(Boolean);
  const recyclingSplits=trades.map(({sku})=>{
   const def=skuDefinition(sku),limit=maxStack(def);if(limit<=1||!recyclingQuote(item(def.kind,def)))return null;let profit=0,cases=0;
   for(let total=2;total<=limit;total++)for(let quantity=1;quantity<total;quantity++){const base={kind:def.kind,...def},whole=recyclingQuote({...base,quantity:total}),a=recyclingQuote({...base,quantity}),b=recyclingQuote({...base,quantity:total-quantity});profit=Math.max(profit,(a.quantity+b.quantity-whole.quantity)*2);cases++}return {sku,profit,cases};
  }).filter(Boolean);
  return {trades,recipes,splits,recyclingTrades,recyclingRecipes,recyclingSplits,profitableLoops:[...trades,...recipes,...splits,...recyclingTrades,...recyclingRecipes,...recyclingSplits].filter(r=>r.profit>0),scope:'Static buy/craft/sell and buy/craft/recycle/sell at maximum discounts, including merged purchases and every legal binary stack split. Raid reward rates, new-account grants and player behavior require separate audits/playtests.'};
 }finally{store.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(auditEconomy(),null,2));
