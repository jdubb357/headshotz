// Presentation-only rarity mapping for loot pickups. It is shared so the raid
// client and its graders agree about when a pickup is merely recovered versus
// worth celebrating, without granting loot, value or ownership itself.
export const LOOT_TIERS=['common','uncommon','rare','epic','legendary','special'];
export const LOOT_PRESENTATION={
 common:{label:'Common',accent:'#94a6ae',cue:'take',celebrate:false},
 uncommon:{label:'Uncommon',accent:'#72e2b0',cue:'take',celebrate:false},
 rare:{label:'Rare',accent:'#63d9f2',cue:'lootRare',celebrate:true},
 epic:{label:'Epic',accent:'#c790ff',cue:'lootEpic',celebrate:true},
 legendary:{label:'Legendary',accent:'#ffb44a',cue:'lootLegendary',celebrate:true},
 special:{label:'Special',accent:'#ff645f',cue:'lootRare',celebrate:true}
};
function rarityIndex(value){
 return Number.isFinite(value)?Math.max(0,Math.min(5,Math.trunc(value))):0;
}
export function lootPresentation(item){
 const rarity=rarityIndex(item?.rarity),tier=LOOT_TIERS[rarity],meta=LOOT_PRESENTATION[tier];
 return {rarity,tier,...meta};
}
// Numeric form for renderers: the same authoritative tier accent used by
// pickup celebration, so a cache's tier marking and a dropped item agree.
export function lootTierColor(value){
 const rarity=rarityIndex(value);
 return parseInt(LOOT_PRESENTATION[LOOT_TIERS[rarity]].accent.slice(1),16);
}
export function lootCelebrationText(item,name='Item'){
 const presentation=lootPresentation(item);
 return presentation.celebrate?presentation.label+' haul: '+name+' recovered.':presentation.label+' item recovered: '+name+'.';
}
