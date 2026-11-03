export const ARMOR={
 light:{name:'Scout Harness',capacity:25,absorption:.55,mobility:1,weight:3.5,price:55},
 standard:{name:'Field Vest',capacity:45,absorption:.65,mobility:.96,weight:6,price:70},
 heavy:{name:'Bulwark Rig',capacity:75,absorption:.7,mobility:.85,weight:10,price:130}
};
export const MEDICAL={
 field:{name:'Field Medkit',heal:35,stopsBleed:true,price:25},
 bandage:{name:'Pressure Dressing',heal:0,stopsBleed:true,price:12},
 splint:{name:'Field Splint',heal:0,treatsLimp:true,price:18},
 trauma:{name:'Trauma Pack',heal:60,stopsBleed:true,treatsLimp:true,price:50}
};
export function armorStats(item){const def=ARMOR[item?.armor]||ARMOR.standard;return {...def,tier:ARMOR[item?.armor]?item.armor:'standard',protection:def.capacity*Math.max(0,Math.min(100,item?.condition??100))/100}}
export function healthMaximum(p){return p.combatVersion===2?100:p.equipment.some(it=>it.kind==='armor'&&it.condition>0)?130:100}
export function movementSpeed(p,now){const base=p.downed?1:p.carrying?3:5;if(p.combatVersion!==2||p.downed)return base;const armor=p.equipment.find(it=>it.kind==='armor'),mobility=armor?armorStats(armor).mobility:1;return base*mobility*(p.wounds?.limpUntil>now?.7:1)}
export function medicalNeed(p,it,now){const def=MEDICAL[it?.medical]||MEDICAL.field;return p.hp<healthMaximum(p)&&def.heal>0||def.stopsBleed&&p.wounds?.bleedingUntil>now||def.treatsLimp&&p.wounds?.limpUntil>now}
