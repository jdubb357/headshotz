// Progression opens ways to assemble equipment; it never multiplies field stats.
export const RANKS=[
 {level:1,name:'Wayfarer',xp:0},
 {level:2,name:'Salvager',xp:60},
 {level:3,name:'Surveyor',xp:160},
 {level:4,name:'Pathfinder',xp:320},
 {level:5,name:'Specialist',xp:560},
 {level:6,name:'Veteran',xp:900},
 {level:7,name:'Quartermaster',xp:1400}
];
export function rankProgress(value){const xp=Number.isSafeInteger(value)&&value>=0?value:0,index=RANKS.findLastIndex(rank=>xp>=rank.xp),rank=RANKS[index],next=RANKS[index+1]||null;return {...rank,totalXp:xp,next,nextXp:next?next.xp-xp:0,progress:next?(xp-rank.xp)/(next.xp-rank.xp):1}}
