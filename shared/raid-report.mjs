// Stable public categories only: no attacker identity, position or private state.
const REASONS={extracted:'Successfully extracted.',raid_expired:'The raid deadline passed before extraction.',connection_expired:'The operator stopped contacting the raid service for 45 seconds.',service_interrupted:'The service could not recover this deployment; eligible committed gear and the insurance premium were refunded.',operator:'Eliminated by operator gunfire.',machine:'Eliminated by a machine attack.',blast:'Eliminated by an explosive blast.',fall:'Eliminated by fall damage.',hazard:'Eliminated by an environmental hazard.',bleed:'Eliminated by untreated bleeding.',finished_downed:'Further damage exhausted the downed survival timer.',downed_expired:'The downed survival timer expired before revival or extraction.',combat:'Eliminated by combat damage.',unknown:'The cause was not recorded.'};
const DEATH=new Set(['operator','machine','blast','fall','hazard','bleed','finished_downed','downed_expired','combat']);
export function outcomeReason(outcome,reason){return ({extract:'extracted',timeout:'raid_expired',disconnect:'connection_expired',aborted:'service_interrupted'})[outcome]||(outcome==='death'&&DEATH.has(reason)?reason:'unknown')}
export function reasonText(result){return REASONS[outcomeReason(result.outcome,result.reason)]}
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
