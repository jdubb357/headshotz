export const MACHINES={
 scout:{name:'Needle Scout',hp:75,height:1.35,radius:.55,speed:3.2,sight:30,range:20,damage:7,cooldown:1.5,windup:.55,armor:0,core:.9,attack:'pulse',color:0xe4b24d},
 hunter:{name:'Prowler',hp:140,height:1.8,radius:.7,speed:4.1,sight:38,range:8,damage:22,cooldown:3,windup:.9,armor:.15,core:1.2,attack:'pounce',color:0xd77845},
 heavy:{name:'Bulwark',hp:280,height:2.8,radius:1.05,speed:1.5,sight:38,range:30,damage:27,cooldown:4,windup:1.25,armor:.5,core:1.9,attack:'mortar',color:0x829c8c},
 flyer:{name:'Skimmer',hp:65,height:1.1,radius:.7,speed:4.2,sight:45,range:28,damage:13,cooldown:2,windup:.7,armor:0,core:.5,attack:'beam',color:0x8fc5d1,flight:7.5},
 overlord:{name:'Foundry Warden',hp:760,height:5.2,radius:1.8,speed:1.15,sight:50,range:36,damage:35,cooldown:4,windup:1.8,armor:.65,core:3.1,attack:'barrage',color:0xa97865}
};
export function hazardState(hazard,elapsed){const phase=((elapsed%hazard.period)+hazard.period)%hazard.period;return {...hazard,active:phase>=hazard.period-hazard.active,warning:phase>=hazard.period-hazard.active-hazard.warning&&phase<hazard.period-hazard.active}}
export function mapConditions(world,seed=0){
 const variants=world.theme==='wilderness'?[{name:'Morning mist',sky:0xb4c8bd,fog:0x9fb5a5,visibility:.8,light:1.6,weather:'mist'},{name:'Clear midday',sky:0x91b8ca,fog:0xb4ccd0,visibility:1,light:2,weather:'clear'}]:world.theme==='industrial'?[{name:'Golden hour',sky:0xc4a18d,fog:0xbfa491,visibility:1,light:1.9,weather:'clear'},{name:'Electrical squall',sky:0x657f8e,fog:0x6d8790,visibility:.7,light:1.3,weather:'rain'}]:[{name:'Ember dusk',sky:0x84717c,fog:0x8f7f80,visibility:.85,light:1.4,weather:'ash'},{name:'Blue-hour rain',sky:0x526a83,fog:0x667d90,visibility:.7,light:1.15,weather:'rain'}];
 return variants[Math.abs(seed)%variants.length];
}
