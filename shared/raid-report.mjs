// Stable public categories only: no attacker identity, position or private state.
const REASONS={extracted:'Successfully extracted.',raid_expired:'The raid deadline passed before extraction.',connection_expired:'The operator stopped contacting the raid service for 45 seconds.',service_interrupted:'The service could not recover this deployment; eligible committed gear and the insurance premium were refunded.',operator:'Eliminated by operator gunfire.',machine:'Eliminated by a machine attack.',blast:'Eliminated by an explosive blast.',fall:'Eliminated by fall damage.',hazard:'Eliminated by an environmental hazard.',bleed:'Eliminated by untreated bleeding.',finished_downed:'Further damage exhausted the downed survival timer.',downed_expired:'The downed survival timer expired before revival or extraction.',combat:'Eliminated by combat damage.',unknown:'The cause was not recorded.'};
const DEATH=new Set(['operator','machine','blast','fall','hazard','bleed','finished_downed','downed_expired','combat']);
export function outcomeReason(outcome,reason){return ({extract:'extracted',timeout:'raid_expired',disconnect:'connection_expired',aborted:'service_interrupted'})[outcome]||(outcome==='death'&&DEATH.has(reason)?reason:'unknown')}
export function reasonText(result){return REASONS[outcomeReason(result.outcome,result.reason)]}
const OBJECTIVE_FAIL={extracted_before_securing:'the raid ended before the hold completed',raid_expired:'the raid deadline passed',connection_expired:'the operator disconnected',service_interrupted:'the service interrupted the deployment',operator:'the operator was eliminated by gunfire',machine:'the operator was eliminated by a machine',blast:'the operator was eliminated by an explosive blast',fall:'the operator was eliminated by fall damage',hazard:'the operator was eliminated by an environmental hazard',bleed:'the operator bled out',finished_downed:'further damage exhausted the downed survival timer',downed_expired:'the downed survival timer expired',combat:'the operator was eliminated by combat damage'};
export function objectiveText(result){
 const o=result.facts?.objective;if(!o)return null;
 if(o.completed)return 'Field objective secured: '+o.name+' at '+o.site+' (+'+o.rewardCredits+' credits, +'+o.rewardXp+' XP).';
 const cause=OBJECTIVE_FAIL[o.failedReason]||'the raid did not end in extraction';
 return 'Field objective incomplete: '+o.name+' at '+o.site+' was not secured because '+cause+'. No bonus was awarded.';
}
export function settlementText(result){
 const l=result.ledger;if(!l)return 'Detailed credit reconciliation was not recorded for this older raid.';
 return `Settlement credits: ${l.before.total} → ${l.after.total} (${l.after.total-l.before.total>=0?'+':''}${l.after.total-l.before.total}). Starter ${l.before.starter} → ${l.after.starter}; earned ${l.before.total-l.before.starter} → ${l.after.total-l.after.starter}. Raid reward +${l.reward} earned; premium refund +${l.refund} (${l.refundStarter} starter). Insurance premium ${l.premium} (${l.premiumStarter} starter) was charged at deployment and is already excluded from the starting balance. Purchases, sales and contract reward claims are separate base transactions.`;
}
export function insuranceText(result){
 if(!Array.isArray(result.insuranceAtSettlement))return 'Insurance details were not recorded for this older raid.';
 if(!result.insuranceAtSettlement.length)return 'No equipment was insured for this deployment.';
 const labels={not_needed:'return not needed',pending:'pending eligibility check after the raid closes',claimed_by_other:'claimed by another operator',returned:'returned',unavailable:'unavailable',destroyed:'destroyed',covered:'covered'};
 return 'Insurance at settlement: '+result.insuranceAtSettlement.map(c=>(c.label||'Equipment')+': '+(labels[c.status]||'unknown status')).join('; ')+'. Pending claims are conditional, not guaranteed returns. Check the base insurance panel for current status.';
}
// Record list aggregates for the base "Raid records" card. Every number is read
// from the authoritative settled results (outcome, credits, XP, machine kills),
// so online and offline show the same record. Only outcomes the settlement
// contract defines are counted; unknown values are left uncounted rather than
// guessed.
const RECORD_LOSSES=new Set(['death','timeout','disconnect']);
export function careerSummary(results){
 const list=Array.isArray(results)?results:[];
 let extractions=0,losses=0,interrupted=0,credits=0,xp=0,machines=0;
 for(const result of list){
  if(!result||typeof result!=='object')continue;
  if(result.outcome==='extract')extractions++;
  else if(result.outcome==='aborted')interrupted++;
  else if(RECORD_LOSSES.has(result.outcome))losses++;
  if(Number.isSafeInteger(result.credits)&&result.credits>0)credits+=result.credits;
  if(Number.isSafeInteger(result.xp)&&result.xp>0)xp+=result.xp;
  const killed=result.facts?.machines;
  if(Number.isSafeInteger(killed)&&killed>0)machines+=killed;
 }
 return {raids:list.length,extractions,losses,interrupted,credits,xp,machines};
}
export function careerText(results){
 const summary=careerSummary(results);
 if(!summary.raids)return 'No raids recorded yet. Settled deployments appear here with returned, lost and insured items. Deploy to begin.';
 const counts=`${summary.raids} recorded ${summary.raids===1?'deployment':'deployments'} · ${summary.extractions} ${summary.extractions===1?'extraction':'extractions'} · ${summary.losses} ended without extraction${summary.interrupted?` · ${summary.interrupted} interrupted and refunded`:''}`;
 return counts+` · +${summary.credits} credits from raid rewards · +${summary.xp} XP · ${summary.machines} ${summary.machines===1?'machine destroyed':'machines destroyed'}.`;
}
// Compact one-line reconciliation for the post-raid rewards card. All numbers are
// read from the settlement record (ledger, progression, returned/lost lists), so
// offline and online settlement show the same authoritative gap.
export function settlementGapText(result){
 const items=Array.isArray(result.items)?result.items.length:0;
 const lost=Array.isArray(result.lostItems)?result.lostItems.length:0;
 const l=result.ledger,progression=result.progression||{};
 const beforeXp=Number.isSafeInteger(progression.xpBefore)?progression.xpBefore:null;
 const afterXp=Number.isSafeInteger(progression.xpAfter)?progression.xpAfter:(beforeXp!==null&&Number.isSafeInteger(result.xp)?beforeXp+result.xp:null);
 const xpLine=beforeXp!==null&&afterXp!==null?`XP ${beforeXp} → ${afterXp}`:`XP +${Number.isSafeInteger(result.xp)?result.xp:0}`;
 let creditLine;
 if(l&&Number.isFinite(l.before?.total)&&Number.isFinite(l.after?.total)){
  const delta=l.after.total-l.before.total;
  creditLine=`Credits ${l.before.total} → ${l.after.total} (${delta>=0?'+':''}${delta})`;
  if(l.reward>0)creditLine+=` (raid reward +${l.reward})`;
  if(l.premium>0)creditLine+=` · insurance premium ${l.premium} paid at deployment`;
  if(l.refund>0)creditLine+=` · insurance refund +${l.refund}`;
 }else creditLine=`Credits +${Number.isSafeInteger(result.credits)?result.credits:0}`;
 return `${creditLine} · ${xpLine} · ${items} ${items===1?'item':'items'} returned · ${lost} ${lost===1?'item':'items'} lost or dropped.`;
}
// Stash slots after settlement. A non-empty protected overflow means the stash
// was full and returned gear is not bankable until it is resolved.
export function stashUsageText(profile,capacity){
 if(!profile||!Number.isFinite(capacity)||capacity<=0)return '';
 const used=Array.isArray(profile.items)?profile.items.length:0;
 const overflow=Array.isArray(profile.overflow)?profile.overflow.length:0;
 return overflow>0
  ?`Stash ${used}/${capacity} slots · ${overflow} ${overflow===1?'item':'items'} in protected overflow — resolve before deploying again.`
  :`Stash ${used}/${capacity} slots · ${Math.max(0,capacity-used)} free after this raid.`;
}
