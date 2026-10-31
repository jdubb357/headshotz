// Exit rules apply to newly created raids. Existing checkpoint exits keep their saved rules.
const RULES={
 call:{seats:3,maxActivations:2,arrival:35,duration:30,boarding:2.2},
 timed:{seats:6,maxActivations:1,arrival:180,duration:60,boarding:2.2},
 key:{seats:1,maxActivations:2,arrival:0,duration:45,boarding:2.2,cost:{kind:'key',quantity:1}},
 resource:{seats:2,maxActivations:1,arrival:0,duration:40,boarding:3,cost:{kind:'material',material:'fuel',quantity:2}}
};
export function createRaidExits(world,started){return world.exits.map(exit=>{
 const rule=structuredClone(RULES[exit.kind]);return {...exit,...rule,rulesVersion:1,activations:exit.kind==='timed'?1:0,wave:exit.kind==='timed'?1:0,usedSeats:0,openAt:exit.kind==='timed'?started+rule.arrival:0,closeAt:exit.kind==='timed'?started+rule.arrival+rule.duration:0};
})}
export function exitState(exit,now){
 const capped=Number.isSafeInteger(exit.seats),remaining=capped?Math.max(0,exit.seats-(exit.usedSeats||0)):null,available=capped?Math.max(0,remaining-(exit.reservedSeats||0)):null;
 let phase;
 if(exit.openAt<=now&&exit.closeAt>now)phase=remaining===0?'full':'open';
 else if(exit.openAt>now)phase='inbound';
 else if(exit.kind==='timed')phase='departed';
 else if(exit.maxActivations!=null&&(exit.activations||0)>=exit.maxActivations)phase='exhausted';
 else phase=exit.kind==='call'?'ready':'locked';
 return {phase,remaining,available,usesRemaining:exit.maxActivations==null?null:Math.max(0,exit.maxActivations-(exit.activations||0))};
}
export function exitCost(exit){const cost=exit.cost||(exit.kind==='key'?{kind:'key',quantity:1}:null);return !cost?'No access cost':cost.kind==='key'?'1 access key':cost.quantity+' '+cost.material}
const counted=(n,word)=>n+' '+word+(n===1?'':'s');
export function exitDescription(exit,now){
 const state=exitState(exit,now),capacity=state.remaining==null?'':` · ${state.available}/${exit.seats} ${exit.seats===1?'seat':'seats'} available${exit.reservedSeats?' · '+exit.reservedSeats+' boarding':''}`,contested=exit.contested?' · CONTESTED':'';
 if(state.phase==='open')return 'OPEN · departs in '+Math.ceil(exit.closeAt-now)+'s'+capacity+contested;
 if(state.phase==='full')return 'FULL · departure in '+Math.ceil(exit.closeAt-now)+'s'+capacity+contested;
 if(state.phase==='inbound')return (exit.kind==='call'?'Inbound':'Scheduled')+' · opens in '+Math.ceil(exit.openAt-now)+'s'+(exit.seats?' · '+counted(exit.seats,'seat'):'');
 if(state.phase==='departed')return 'DEPARTED · no further service';
 if(state.phase==='exhausted')return 'EXHAUSTED · no uses remain';
 const uses=state.usesRemaining==null?'':' · '+counted(state.usesRemaining,'activation')+' left';
 return (exit.kind==='call'?'Call transport · '+(exit.arrival||35)+'s arrival':exitCost(exit)+' to open')+(exit.seats?' · '+counted(exit.seats,'seat'):'')+uses;
}
export function exitColor(exit,now){const state=exitState(exit,now);return exit.contested?0xff805b:state.phase==='open'&&state.available!==0?0x86efbb:['full','departed','exhausted'].includes(state.phase)?0x7d8793:0xd7a650}
