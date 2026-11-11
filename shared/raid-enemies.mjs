export const MACHINES={
 scout:{name:'Needle Scout',hp:75,height:1.35,radius:.55,speed:3.2,sight:30,range:20,damage:7,cooldown:1.5,windup:.55,armor:0,core:.9,attack:'pulse',color:0xe4b24d},
 hunter:{name:'Prowler',hp:140,height:1.8,radius:.7,speed:4.1,sight:38,range:8,damage:22,cooldown:3,windup:.9,armor:.15,core:1.2,attack:'pounce',color:0xd77845},
 heavy:{name:'Bulwark',hp:280,height:2.8,radius:1.05,speed:1.5,sight:38,range:30,damage:27,cooldown:4,windup:1.25,armor:.5,core:1.9,attack:'mortar',color:0x829c8c},
 flyer:{name:'Skimmer',hp:65,height:1.1,radius:.7,speed:4.2,sight:45,range:28,damage:13,cooldown:2,windup:.7,armor:0,core:.5,attack:'beam',color:0x8fc5d1,flight:7.5},
 overlord:{name:'Foundry Warden',hp:760,height:5.2,radius:1.8,speed:1.15,sight:50,range:36,damage:35,cooldown:4,windup:1.8,armor:.65,core:3.1,attack:'barrage',color:0xa97865}
};
// Boss phases advance only on authoritative health damage; clients render the
// label from the snapshot they already receive.
export const BOSS_PHASES={approach:'Sentry posture',furnace:'Furnace vents open',meltdown:'Meltdown · core exposed'};
export function bossPhaseFor(machine){
 if(machine?.kind!=='overlord'||machine.hp<=0)return null;
 const max=machine.maxHp||MACHINES.overlord.hp,ratio=Math.max(0,Math.min(1,machine.hp/max));
 return ratio>.5?'approach':ratio>.25?'furnace':'meltdown';
}
export function hazardState(hazard,elapsed){const phase=((elapsed%hazard.period)+hazard.period)%hazard.period;return {...hazard,active:phase>=hazard.period-hazard.active,warning:phase>=hazard.period-hazard.active-hazard.warning&&phase<hazard.period-hazard.active}}
export function mapConditions(world,seed=0){
 // Daylight fronts are cool blue with a pale ground haze so silhouettes and
 // lit facades read sharply; the second front in each theme stays overcast or
 // wet and carries the grit. Light values are scaled by RaidView's sun pass.
 const variants=world.theme==='wilderness'?[{name:'Morning mist',sky:0xa8c0c7,fog:0xb1c0bb,visibility:.82,light:1.8,weather:'mist'},{name:'Clear midday',sky:0x7fafd2,fog:0xb0c3c8,visibility:1,light:2.3,weather:'clear'}]:world.theme==='industrial'?[{name:'Clear afternoon',sky:0x83b2d4,fog:0xb2c1c3,visibility:1,light:2.35,weather:'clear'},{name:'Electrical squall',sky:0x5a7690,fog:0x708591,visibility:.7,light:1.35,weather:'rain'}]:[{name:'Clear afternoon',sky:0x85b3d4,fog:0xb4c1be,visibility:1,light:2.25,weather:'clear'},{name:'Blue-hour rain',sky:0x4f6882,fog:0x667d90,visibility:.7,light:1.2,weather:'rain'}];
 return variants[Math.abs(seed)%variants.length];
}
