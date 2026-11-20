import {MACHINES} from '../shared/raid-enemies.mjs';

// Presentation metadata derived only from the authoritative shot resolution.
// It never decides damage, kills or target visibility; those rules stay in the
// service. The token is monotonic per operator so repeated snapshots of the
// same hit can be presented exactly once and a reconnect starts a fresh window.
export function hitFeedback(shooter,target,point,now=0,{weak=false}={}){
 const y=target.y||0,relative=(point?.y??y)-y;
 const height=target.account?(target.downed?.65:1.8):target.rival?1.8:(MACHINES[target.kind]?.height||2);
 const human=!!target.account||!!target.rival;
 const zone=human?(relative>1.6?'head':relative<.65?'leg':'body'):(relative>height*.72?'head':'body');
 const killed=target.rival?target.alive===false:target.account?!target.alive:(target.hp??0)<=0;
 // A weak core hit and a confirmed machine kill both report the authoritative
 // machine core position so the raid client can anchor its burst where the
 // machine actually died, instead of guessing from the camera or the nearest
 // actor. Ordinary tokens keep their exact prior shape; only machine weak hits
 // and machine kills gain coordinates, and kills also name the machine class so
 // the client can scale its wreck presentation.
 const core=!human&&(weak||killed)&&MACHINES[target.kind]&&Number.isFinite(target.x)&&Number.isFinite(target.z)?{x:target.x,y:(target.y||0)+MACHINES[target.kind].core,z:target.z}:null;
 const next={token:(shooter.hitFeedback?.token||0)+1,at:now,zone,headshot:zone==='head',target:target.rival?'rival':target.account?'operator':'machine',kill:!!killed,boss:target.kind==='overlord',elite:!!target.elite,...(!human&&weak?{weak:true}:{}),...(!human&&killed&&core?{kind:target.kind}:{}),...(core?{core}:{})};
 shooter.hitFeedback=next;
 return next;
}

// Pick the most consequential hit in a shot so a pellet burst reports a kill
// rather than merely the first pellet that connected. The service's damage
// resolution already ran before this is called.
export function recordShotHit(shooter,hits,now=m=>m){
 if(!hits.length)return null;
 const targetOf=hit=>hit.target;
 const fall=hit=>targetOf(hit).rival?targetOf(hit).alive===false:targetOf(hit).account?!targetOf(hit).alive:(targetOf(hit).hp??0)<=0;
 const chosen=hits.find(fall)||hits[0];
 return hitFeedback(shooter,chosen.target,chosen.point,typeof now==='function'?now():now,{weak:!!chosen.weak});
}
