// Starter support is useful to its recipient without becoming a free stream of
// tradeable equipment from newly registered accounts. Legacy items are unbound.
export const grantBalance=s=>Math.max(0,Math.min(s.credits||0,s.grantCredits||0));
export const grantCost=(s,amount)=>Math.max(0,amount-((s.credits||0)-grantBalance(s)));
export function spendCredits(s,amount){const balance=grantBalance(s),grant=grantCost(s,amount);s.credits-=amount;s.grantCredits=balance-grant;return grant}
export function awardCredits(s,amount,{grant=false}={}){s.credits+=amount;s.grantCredits=(s.grantCredits||0)+(grant?amount:0)}
export const bindGrant=(it,account,bound)=>bound?{...it,grantOwner:account}:it;
// A repair target of 100 is the workshop's full restoration. A field patch
// restores at most 25 points (capped at 100) and costs credits plus wire
// instead of steel, letting a short-handed operator trade a weaker result for
// lower upfront material demand.
export const patchTarget=it=>Math.min(100,Math.max(0,it.condition??100)+25);
export const repairCost=(s,it,target=100)=>Math.ceil(Math.ceil(Math.max(0,Math.min(100,target)-(it.condition??100))/10)*5*(1-.15*(s.upgrades?.bay||0)));
export const usesGrantMaterials=(s,requirements)=>Object.entries(requirements).some(([material,amount])=>s.items.filter(it=>it.kind==='material'&&it.material===material&&!it.grantOwner).reduce((sum,it)=>sum+it.quantity,0)<amount&&s.items.some(it=>it.kind==='material'&&it.material===material&&it.grantOwner));
export const grantRecoverable=(it,account)=>!it.grantOwner||it.grantOwner===account;
export function canRecoverGrant(it,account){return grantRecoverable(it,account)&&(it.attachments||[]).every(child=>canRecoverGrant(child,account))}
export function clearForeignGrantAmmo(it,account){
 if(it.kind==='weapon'&&it.grantAmmoOwner!==account){if(it.grantLoaded>0){it.loaded=Math.max(0,(it.loaded||0)-it.grantLoaded);it.grantLoaded=0}delete it.grantAmmoOwner}
 return it;
}
