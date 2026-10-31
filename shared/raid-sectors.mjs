// Original sector content. These definitions are shared for route planning, not client loot grants.
export const ARTIFACTS={
 relay_log:{name:'Relay telemetry core',map:'relay',site:'Sealed relay vault',contract:'relay_signal',description:'The sealed relay vault holds the last flight recordings. Extract it intact for Scrapwright.',value:45},
 water_sample:{name:'Intake water sample',map:'reservoir',site:'Tower equipment',contract:'reservoir_sample',description:'A sealed sample from the Intake Tower. Survive extraction before delivering it to Field Medic.',value:40},
 freight_manifest:{name:'Freight dispatch ledger',map:'switchyard',site:'Depot roof strongbox',contract:'switchyard_ledger',description:'Reach the depot roof and recover the missing freight ledger for the Outfitter.',value:50}
};
export const SECTORS={
 relay:{summary:'Salvage the abandoned relay network: wire, light/medium ammunition and survey optics.',materials:{wire:5,steel:2,fuel:1,chem:1},ammunition:{light:5,medium:4,heavy:1,shell:1},weapons:{smg:4,pistol:3,ar:3,sniper:1},valuable:'Phase capacitor',artifact:'relay_log'},
 reservoir:{summary:'Explore the dry basin and intake works: chemicals, medicine and field survival supplies.',materials:{chem:5,fuel:3,steel:2,wire:1},ammunition:{shell:4,light:3,medium:2,heavy:1},weapons:{shotgun:4,pistol:2,sniper:2,smg:1},valuable:'Purifier cartridge',artifact:'water_sample'},
 switchyard:{summary:'Search the freight ruins: steel, fuel, heavy ammunition and support weapons.',materials:{steel:5,fuel:3,wire:2,chem:1},ammunition:{medium:4,heavy:4,shell:1,light:1},weapons:{lmg:4,ar:4,sniper:2,shotgun:1},valuable:'Signal regulator',artifact:'freight_manifest'}
};
export function contractItemReserved(state,it){const artifact=it.kind==='contract'&&ARTIFACTS[it.artifact];return it.kind==='contract'&&(!artifact||!state.contracts?.[artifact.contract]?.completed)}
