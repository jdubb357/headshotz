import {ARMOR,MEDICAL,armorStats} from './raid-combat.mjs';
export {ARMOR,MEDICAL,armorStats} from './raid-combat.mjs';
import {UTILITIES} from './raid-utilities.mjs';
export {UTILITIES} from './raid-utilities.mjs';
// Raid balance is independent of arena unlocks, classes, cosmetics and pets.
export const WEAPONS={
 ar:{name:'Assault Rifle',class:'rifle',automatic:true,damage:24,delay:.16,mag:30,ammo:'medium',reload:2,range:65,price:100},
 smg:{name:'Compact SMG',class:'smg',automatic:true,damage:15,delay:.09,mag:36,ammo:'light',reload:1.6,range:40,price:120},
 shotgun:{name:'Pump Shotgun',class:'shotgun',pellets:8,spread:.06,falloffStart:7,minDamageScale:.25,damage:65,delay:.85,mag:6,ammo:'shell',reload:2.8,range:20,price:140},
 sniper:{name:'Scout Rifle',class:'sniper',zoom:2.5,damage:85,delay:1.3,mag:5,ammo:'heavy',reload:3,range:95,price:220},
 pistol:{name:'Sidearm',class:'pistol',damage:22,delay:.26,mag:12,ammo:'light',reload:1.4,range:35,price:60},
 lmg:{name:'Support Gun',class:'lmg',automatic:true,damage:20,delay:.12,mag:60,ammo:'medium',reload:4,range:60,price:250}
};
export const MODS={
 scope:{name:'Survey Optic',slot:'optic',classes:['rifle','sniper','lmg'],range:1.2,zoom:1.5,price:65},
 suppressor:{name:'Sound Suppressor',slot:'muzzle',classes:['rifle','smg','pistol'],noise:.4,price:80},
 magazine:{name:'Extended Magazine',slot:'magazine',classes:['rifle','smg','lmg'],mag:1.25,price:75}
};
export const TRADERS={
 outfitter:{name:'The Outfitter',description:'Weapons, armor and field ammunition.',stock:{ar:4,smg:3,pistol:5,shotgun:2,sniper:1,lmg:1,armor:4,armor_light:4,armor_heavy:2,ammo_light:12,ammo_medium:12,ammo_heavy:6,ammo_shell:8},unlocks:{sniper:3,lmg:5}},
 medic:{name:'Field Medic',description:'Medical supplies and protective equipment.',stock:{med:12,bandage:10,splint:6,trauma:4,armor:2,chem:10,wire:8}},
 engineer:{name:'Scrapwright',description:'Salvage, access cards and weapon attachments.',stock:{steel:12,wire:12,chem:8,fuel:8,key:2,scope:3,suppressor:2,magazine:3,smoke:6,decoy:6,frag:4},unlocks:{suppressor:2,magazine:2}}
};
export const RECIPES={
 pistol_blueprint:{name:'Sidearm assembly',materials:{steel:3,wire:1},credits:18,bench:0,rank:2,output:{kind:'weapon',weapon:'pistol'}},
 ar_blueprint:{name:'Assault rifle assembly',materials:{steel:5,wire:2,fuel:1},credits:25,bench:1,rank:3,output:{kind:'weapon',weapon:'ar'}},
 smg_blueprint:{name:'Compact SMG assembly',materials:{steel:5,wire:3},credits:30,bench:1,rank:3,output:{kind:'weapon',weapon:'smg'}},
 shotgun_blueprint:{name:'Pump shotgun assembly',materials:{steel:6,wire:2,fuel:2},credits:35,bench:1,rank:4,output:{kind:'weapon',weapon:'shotgun'}},
 sniper_blueprint:{name:'Scout rifle assembly',materials:{steel:9,wire:4,fuel:3},credits:55,bench:2,rank:5,output:{kind:'weapon',weapon:'sniper'}},
 lmg_blueprint:{name:'Support gun assembly',materials:{steel:12,wire:4,fuel:4},credits:65,bench:2,rank:7,output:{kind:'weapon',weapon:'lmg'}},
 armor_light:{name:'Scout Harness',materials:{steel:2,wire:1},credits:12,bench:0,output:{kind:'armor',armor:'light'}},
 armor_heavy:{name:'Bulwark Rig',materials:{steel:7,wire:3},credits:25,bench:2,output:{kind:'armor',armor:'heavy'}},
 bandage:{name:'Pressure Dressing',materials:{chem:1},credits:2,bench:0,output:{kind:'med',medical:'bandage'}},
 splint:{name:'Field Splint',materials:{steel:1,wire:1},credits:3,bench:0,output:{kind:'med',medical:'splint'}},
 trauma:{name:'Trauma Pack',materials:{chem:3,wire:1},credits:10,bench:1,output:{kind:'med',medical:'trauma'}},
 smoke:{name:'Ashveil Canister',materials:{chem:2,fuel:1},credits:8,bench:0,output:{kind:'utility',utility:'smoke'}},
 decoy:{name:'Scrapchatter Lure',materials:{wire:2,steel:1},credits:8,bench:0,output:{kind:'utility',utility:'decoy'}},
 frag:{name:'Shatter Charge',materials:{steel:2,fuel:1},credits:15,bench:1,output:{kind:'utility',utility:'frag'}},
 med:{name:'Field Medkit',materials:{steel:1,chem:1},credits:5,bench:0,output:{kind:'med'}},
 ammo_medium:{name:'Medium ammunition ×30',materials:{steel:1,fuel:1},credits:5,bench:0,output:{kind:'ammo',ammo:'medium',quantity:30}},
 ammo_light:{name:'Light ammunition ×40',materials:{steel:1},credits:5,bench:0,output:{kind:'ammo',ammo:'light',quantity:40}},
 ammo_heavy:{name:'Heavy ammunition ×10',materials:{steel:2,fuel:1},credits:8,bench:1,output:{kind:'ammo',ammo:'heavy',quantity:10}},
 ammo_shell:{name:'Shells ×12',materials:{steel:1,chem:1},credits:5,bench:0,output:{kind:'ammo',ammo:'shell',quantity:12}},
 armor:{name:'Body Armor',materials:{steel:3,wire:2},credits:20,bench:1,output:{kind:'armor'}},
 scope:{name:'Survey Optic',materials:{wire:2,steel:2},credits:15,bench:1,output:{kind:'mod',mod:'scope'}},
 suppressor:{name:'Sound Suppressor',materials:{steel:4,fuel:1},credits:20,bench:2,output:{kind:'mod',mod:'suppressor'}},
 magazine:{name:'Extended Magazine',materials:{steel:3,wire:1},credits:15,bench:1,output:{kind:'mod',mod:'magazine'}}
};
export const CONTRACTS={
 survey:{name:'Chart the Ruins',description:'Visit three loot sites, claim the survey, then extract with a keycard.',stages:[{event:'explore',need:3,reward:40,xp:30},{event:'extractKey',need:1,reward:80,xp:60}],trader:'engineer'},
 salvage:{name:'Stock the Workshop',description:'Deliver four steel salvage from your stash.',stages:[{event:'deliverSteel',need:4,reward:60,xp:40}],trader:'engineer'},
 valuables:{name:'Recovery Run',description:'Extract with three recovered valuables.',stages:[{event:'extractValuable',need:3,reward:70,xp:50}],trader:'outfitter'},
 machines:{name:'Clear the Patrols',description:'Destroy six machines. Nearby squad members share credit.',stages:[{event:'machine',need:6,reward:90,xp:70}],trader:'medic'},
 warden:{name:'Break the Overlord',description:'Destroy an Overlord and survive extraction.',stages:[{event:'extractBoss',need:1,reward:150,xp:100}],trader:'outfitter'},
 relay_signal:{name:'Recover the Silent Relay',description:'Survey three Relay Graveyard caches, then deliver the telemetry core from its sealed vault. Keys and core must be carried out at risk.',stages:[{event:'explore',map:'relay',need:3,reward:35,xp:25},{event:'deliverArtifact',artifact:'relay_log',need:1,reward:120,xp:80}],trader:'engineer'},
 reservoir_sample:{name:'A Drink of Tomorrow',description:'Extract the Intake Tower water sample from Dry Reservoir, then deliver that owned sample to Field Medic.',stages:[{event:'extractArtifact',artifact:'water_sample',need:1,reward:45,xp:35},{event:'deliverArtifact',artifact:'water_sample',need:1,reward:100,xp:75}],trader:'medic'},
 switchyard_ledger:{name:'The Missing Freight',description:'Destroy three machines in Ember Switchyard, then deliver the ledger from the depot roof strongbox. Nearby squad members share combat credit.',stages:[{event:'machine',map:'switchyard',need:3,reward:45,xp:40},{event:'deliverArtifact',artifact:'freight_manifest',need:1,reward:140,xp:90}],trader:'outfitter'}
};
export const STACK_LIMIT={ammo:200,med:5,material:20,valuable:1,key:1,weapon:1,armor:1,mod:1,contract:1,utility:3};
export const stashCapacity=s=>20+8*(s.upgrades?.stash||0);
export function itemWeight(it){if(it.kind==='armor')return armorStats(it).weight; if(it.kind==='utility')return (UTILITIES[it.utility]?.weight||.7)*(it.quantity||1);return ({weapon:4,armor:6,mod:.4,med:.4,key:.1,valuable:1,contract:.8,ammo:.02,material:.2}[it.kind]||1)*(it.quantity||1)+(it.attachments||[]).reduce((n,it)=>n+itemWeight(it),0)}
export const maxStack=it=>STACK_LIMIT[it.kind]||1;
export function weaponStats(it){
 const base=WEAPONS[it?.weapon]||WEAPONS.ar,stats={...base,noise:1,zoom:base.zoom||1.3};
 for(const attachment of it?.attachments||[]){const mod=MODS[attachment.mod];if(!mod||!mod.classes.includes(base.class))continue;for(const key of ['range','noise','mag','zoom'])if(mod[key])stats[key]*=mod[key]}
 stats.mag=Math.round(stats.mag);stats.damage*=.75+.25*Math.max(0,Math.min(100,it?.condition??100))/100;return stats;
}
export function skuDefinition(sku){
 if(typeof sku!=='string')return null;
 if(sku.startsWith('armor_')&&Object.hasOwn(ARMOR,sku.slice(6)))return {kind:'armor',armor:sku.slice(6),price:ARMOR[sku.slice(6)].price};
 if(Object.hasOwn(MEDICAL,sku)&&sku!=='field')return {kind:'med',medical:sku,price:MEDICAL[sku].price};
 if(Object.hasOwn(UTILITIES,sku))return {kind:'utility',utility:sku,price:UTILITIES[sku].price};
 if(Object.hasOwn(WEAPONS,sku))return {kind:'weapon',weapon:sku,loaded:WEAPONS[sku].mag,price:WEAPONS[sku].price};
 if(Object.hasOwn(MODS,sku))return {kind:'mod',mod:sku,price:MODS[sku].price};
 if(sku.startsWith('ammo_')&&['light','medium','heavy','shell'].includes(sku.slice(5)))return {kind:'ammo',ammo:sku.slice(5),quantity:sku==='ammo_heavy'?10:sku==='ammo_shell'?12:30,price:sku==='ammo_heavy'?18:12};
 if(['steel','wire','chem','fuel'].includes(sku))return {kind:'material',material:sku,quantity:3,price:18};
 if(sku==='med')return {kind:'med',price:25};if(sku==='armor')return {kind:'armor',price:70};if(sku==='key')return {kind:'key',price:90};return null;
}

export const equipmentPrice=it=>it?.kind==='armor'?armorStats(it).price:WEAPONS[it?.weapon]?.price||0;
