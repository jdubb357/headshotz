import {MEDICAL,armorStats,healthMaximum,medicalNeed} from '../shared/raid-combat.mjs';
import {requireRule} from './rules.mjs';
export function changeArmor(p,request,now){
 requireRule(now>=(p.nextArmorAt||0)&&now-p.hurtAt>=1,'Find cover before changing armor');requireRule(!p.board&&!p.reviving&&!p.carrying,'Finish the current interaction first');
 const old=p.equipment.find(it=>it.kind==='armor'),next=request.type==='wear'?p.pack.find(it=>it.id===request.itemId&&it.kind==='armor'&&it.condition>0):null;
 requireRule(request.type==='wear'?next:old,'Usable armor not carried');requireRule(!old||next||p.pack.length<p.cap,'Backpack full');
 if(next)p.pack.splice(p.pack.indexOf(next),1);if(old){p.equipment.splice(p.equipment.indexOf(old),1);p.pack.push(old)}if(next)p.equipment.push(next);p.nextArmorAt=now+2;p.nextFire=Math.max(p.nextFire,now+1);
}
export function useMedical(p,itemId,now){
 const list=[p.equipment,p.pack].find(items=>items.some(it=>it.id===itemId&&it.kind==='med')),it=list?.find(it=>it.id===itemId);requireRule(it,'Medkit not owned');
 if(p.combatVersion!==2){it.quantity--;if(it.quantity<=0)list.splice(list.indexOf(it),1);p.hp=Math.min(healthMaximum(p),p.hp+35);p.facts.medkitsUsed=(p.facts.medkitsUsed||0)+1;return}
 requireRule(now>=(p.nextMedicalAt||0),'Medical supplies not ready');requireRule(medicalNeed(p,it,now),'Nothing this supply can treat');const def=MEDICAL[it.medical]||MEDICAL.field;
 it.quantity--;if(!it.quantity)list.splice(list.indexOf(it),1);p.hp=Math.min(healthMaximum(p),p.hp+def.heal);p.wounds||={};if(def.stopsBleed){p.wounds.bleedingUntil=0;p.wounds.bleedNextAt=0}if(def.treatsLimp)p.wounds.limpUntil=0;p.nextMedicalAt=now+2;p.facts.medkitsUsed=(p.facts.medkitsUsed||0)+1;p.facts.medicalUsed||={};const key=it.medical||'field';p.facts.medicalUsed[key]=(p.facts.medicalUsed[key]||0)+1;
}
export function absorbDamage(p,amount,{kind='combat',zone='body'}={}){
 p.facts||={};const armor=p.equipment.find(it=>it.kind==='armor'&&it.condition>0);let absorbed=0;
 if(armor&&zone==='body'&&['combat','blast'].includes(kind)){const stats=armorStats(armor);absorbed=Math.min(stats.protection,amount*stats.absorption);armor.condition=Math.max(0,armor.condition-absorbed/stats.capacity*100)}
 p.facts.damageAbsorbed=(p.facts.damageAbsorbed||0)+absorbed;return amount-absorbed;
}
export function applyWound(p,healthDamage,kind,zone,now){
 p.wounds||={};if(p.hp<=0)return;
 if(kind==='combat'&&healthDamage>=25){if(!(p.wounds.bleedingUntil>now)){p.wounds.bleedNextAt=now+1;p.facts.bleedingWounds=(p.facts.bleedingWounds||0)+1}p.wounds.bleedingUntil=now+20}
 if(kind==='fall'&&healthDamage>=24||kind==='combat'&&zone==='leg'&&healthDamage>=15){if(!(p.wounds.limpUntil>now))p.facts.legWounds=(p.facts.legWounds||0)+1;p.wounds.limpUntil=now+90}
}
export function advanceWounds(service,raid,p,now){
 if(p.combatVersion!==2||!p.alive||p.downed||!p.wounds?.bleedNextAt)return;const end=Math.min(now,p.wounds.bleedingUntil),ticks=Math.max(0,Math.floor(end-p.wounds.bleedNextAt)+1);if(ticks){p.wounds.bleedNextAt+=ticks;service.damage(raid,p,ticks,{kind:'bleed'})}if(now>=p.wounds.bleedingUntil){p.wounds.bleedingUntil=0;p.wounds.bleedNextAt=0}
}
