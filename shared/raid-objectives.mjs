// Optional, per-deployment field objectives. The catalog is derived
// deterministically from the frozen sector landmarks, so every raid uses the
// same marker coordinates and wire-safe ids without mutating shared worlds.
// Only the server advances progress; snapshots are the sole client source.

const slug=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const HOLD_SECONDS=12;

export function objectivesFor(world){
 if(!world?.landmarks?.length)return [];
 return world.landmarks.map((site,index)=>{
  const id=world.id+'-field-'+slug(site.name);
  const holdSeconds=HOLD_SECONDS+(index%3)*2;
  return {
   id,map:world.id,name:'Secure '+site.name,site:site.name,
   description:'Reach '+site.name+', hold the marker for '+holdSeconds+' seconds, then extract to claim the bonus.',
   x:site.x,z:site.z,radius:7,holdSeconds,
   rewardCredits:30+holdSeconds,rewardXp:20+(index%3)*5
  };
 });
}

export function objectiveFor(world,id){
 if(id==null)return null;
 return objectivesFor(world).find(objective=>objective.id===id)||null;
}

export function createObjectiveState(definition,now=0){
 return {id:definition.id,map:definition.map,name:definition.name,site:definition.site,description:definition.description,
  x:definition.x,z:definition.z,radius:definition.radius,holdSeconds:definition.holdSeconds,
  rewardCredits:definition.rewardCredits,rewardXp:definition.rewardXp,
  stage:'approach',hold:0,progress:0,reachedAt:null,securedAt:null,outcome:null,failedReason:null};
}

// Returns 'reached' the first time the marker is entered, and 'secured' once the
// authored hold completes. A downed or dead operator never advances progress;
// leaving the marker pauses it rather than resetting the work already done.
export function advanceObjectiveState(objective,{now=0,dt=0,alive=true,downed=false,inside=false}={}){
 if(!objective||objective.stage==='secured'||objective.stage==='failed')return null;
 if(!alive||downed)return null;
 if(objective.stage==='approach'){
  if(!inside)return null;
  objective.stage='secure';objective.reachedAt=now;objective.hold=0;objective.progress=0;
  return 'reached';
 }
 if(inside&&dt>0){
  objective.hold=Math.min(objective.holdSeconds,objective.hold+dt);
  objective.progress=objective.hold/objective.holdSeconds;
  if(objective.hold>=objective.holdSeconds){objective.stage='secured';objective.securedAt=now;objective.progress=1;return 'secured'}
 }
 return null;
}

export function settleObjectiveState(objective,outcome,reason=null){
 if(!objective)return null;
 const secured=objective.stage==='secured',completed=outcome==='extract'&&secured;
 objective.outcome=completed?'completed':'failed';
 objective.failedReason=completed?null:(outcome==='extract'?'extracted_before_securing':(reason||outcome||'unknown'));
 return {id:objective.id,name:objective.name,site:objective.site,map:objective.map,stage:objective.stage,
  progress:Math.min(1,Math.max(0,objective.progress||0)),hold:objective.hold||0,holdSeconds:objective.holdSeconds,
  rewardCredits:objective.rewardCredits,rewardXp:objective.rewardXp,completed,outcome:objective.outcome,
  failedReason:objective.failedReason};
}
