// One authoritative base salvage value for raid items. The store uses this for
// sales and ledger summaries, and the raid client uses the same arithmetic only
// to display what the player would receive at the base sale price. No rarity,
// ownership or condition multiplier is invented here; unusable condition is a
// deployment/sale rule handled elsewhere.
import {WEAPONS,MODS,UTILITIES,MEDICAL,armorStats} from './raid-catalog.mjs';
import {ARTIFACTS} from './raid-sectors.mjs';

export function sellValue(it){
 return it.kind==='utility'?Math.floor((UTILITIES[it.utility]?.price||0)*.3)*(it.quantity||1)
  :it.kind==='contract'?(ARTIFACTS[it.artifact]?.value||0)
  :it.kind==='valuable'?(it.value||1)
  :it.kind==='weapon'?Math.floor((WEAPONS[it.weapon]?.price||100)*.3)
  :it.kind==='armor'?Math.floor(armorStats(it).price*.3)
  :it.kind==='med'?Math.floor((MEDICAL[it.medical]?.price||25)*.2)*(it.quantity||1)
  :it.kind==='mod'?Math.floor((MODS[it.mod]?.price||30)*.3)
  :it.kind==='ammo'?Math.floor((it.quantity||1)*.1)
  :Math.max(1,Math.floor((it.quantity||1)*(it.kind==='material'?2:5)));
}
