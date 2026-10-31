import {grantBalance} from '../../shared/raid-grants.mjs';
const sum=values=>values.reduce((total,value)=>total+value,0);
function balance(profile){
 const starter=grantBalance(profile),items=profile.items||[],quotes=profile.sellValues||{};
 return {credits:profile.credits,starterCredits:starter,earnedCredits:profile.credits-starter,xp:profile.xp||0,stashSlots:items.length,overflowSlots:profile.overflow?.length||0,active:!!profile.activeDeployment,starterStashResale:sum(items.filter(it=>it.grantOwner).map(it=>quotes[it.id]||0)),ordinaryStashResale:sum(items.filter(it=>!it.grantOwner).map(it=>quotes[it.id]||0)),upgrades:{...profile.upgrades},reputation:{...profile.reputation},completedContracts:Object.values(profile.contracts||{}).filter(c=>c.completed).length};
}
// Observes only authenticated API responses. It does not grant anything or infer
// a player's total wealth from a stash while their equipment is still at risk.
export class RaidEconomyObserver {
 constructor(index){this.index=index;this.flows={};this.deployments=new Map();this.results=new Set();this.stats={paidDeployments:0,recoveryDeployments:0,settled:0,extractions:0,emptyExtractions:0,broughtBackStacks:0,recoveredStacks:0,unclassifiedReturnedStacks:0,quotedRecoveredResale:0,unquotedRecoveredStacks:0};this.initial=null;this.final=null}
 observe(profile,phase){
  const next=balance(profile);if(!this.initial)this.initial=structuredClone(next);
  if(this.final){const flow=this.flows[phase]||={observations:0,credits:0,starterCredits:0,earnedCredits:0,xp:0,income:0,spending:0};flow.observations++;for(const key of ['credits','starterCredits','earnedCredits','xp'])flow[key]+=next[key]-this.final[key];const delta=next.credits-this.final.credits;flow.income+=Math.max(0,delta);flow.spending+=Math.max(0,-delta)}
  this.final=next;return profile;
 }
 deployment(id,itemIds,{recovery=false}={}){if(this.deployments.has(id))return;this.deployments.set(id,new Set(itemIds));this.stats[recovery?'recoveryDeployments':'paidDeployments']++}
 settlement(result,profile){
  if(this.results.has(result.id))return;this.results.add(result.id);this.stats.settled++;const original=this.deployments.get(result.deploymentId);if(result.outcome==='extract')this.stats.extractions++;
  if(!original){this.stats.unclassifiedReturnedStacks+=result.items.length;return}
  const recovered=result.items.filter(it=>!original.has(it.id));this.stats.broughtBackStacks+=result.items.length-recovered.length;this.stats.recoveredStacks+=recovered.length;
  if(result.outcome==='extract'&&!recovered.length)this.stats.emptyExtractions++;
  for(const it of recovered){const value=profile.sellValues?.[it.id];if(Number.isSafeInteger(value)&&value>=0)this.stats.quotedRecoveredResale+=value;else this.stats.unquotedRecoveredStacks++}
 }
 report(){
  const deltas=Object.values(this.flows),checks={observedBalanceConserved:!this.initial||this.final.credits===this.initial.credits+sum(deltas.map(f=>f.credits)),starterBalanceConserved:!this.initial||this.final.starterCredits===this.initial.starterCredits+sum(deltas.map(f=>f.starterCredits)),earnedBalanceConserved:!this.initial||this.final.earnedCredits===this.initial.earnedCredits+sum(deltas.map(f=>f.earnedCredits))};
  return {index:this.index,initial:this.initial,final:this.final,flows:this.flows,...this.stats,checks};
 }
}
export function economyReport(observers){
 const players=observers.map(observer=>observer.report()),total=key=>sum(players.map(p=>p[key]||0)),balances=when=>Object.fromEntries(['credits','starterCredits','earnedCredits','xp','stashSlots','overflowSlots','starterStashResale','ordinaryStashResale'].map(key=>[key,sum(players.map(p=>p[when]?.[key]||0))]));
 const phases=[...new Set(players.flatMap(p=>Object.keys(p.flows)))],flows=Object.fromEntries(phases.map(phase=>[phase,Object.fromEntries(['observations','credits','starterCredits','earnedCredits','xp','income','spending'].map(key=>[key,sum(players.map(p=>p.flows[phase]?.[key]||0))]))]));
 return {scope:'Client-observed wallet deltas and stash sale quotes from authenticated APIs. Final balances may include active raids; stash quotes exclude deployed/overflow equipment, attachments and future insurance. Returned bring-in items are not counted as newly recovered loot. Phase attribution is observational, not the server audit ledger. Conservation checks validate observer arithmetic, not fraud resistance.',initial:balances('initial'),final:balances('final'),flows,activeAtEnd:players.filter(p=>p.final?.active).length,totals:Object.fromEntries(['paidDeployments','recoveryDeployments','settled','extractions','emptyExtractions','broughtBackStacks','recoveredStacks','unclassifiedReturnedStacks','quotedRecoveredResale','unquotedRecoveredStacks'].map(key=>[key,total(key)])),players,checks:{allObservedBalancesConserved:players.every(p=>Object.values(p.checks).every(Boolean))}};
}
