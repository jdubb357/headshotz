// Original synthesized cues: no downloaded samples or machine positions beyond
// the visibility-filtered snapshot. Sound never replaces the warning captions.
export const MACHINE_CUES={
 scout:{wave:'square',start:880,end:420,duration:.3,pulses:3},
 hunter:{wave:'sawtooth',start:110,end:270,duration:.55,pulses:1},
 heavy:{wave:'triangle',start:85,end:42,duration:.8,pulses:2},
 flyer:{wave:'sine',start:1250,end:330,duration:.45,pulses:2},
 overlord:{wave:'sawtooth',start:65,end:155,duration:1.1,pulses:3}
};
export const BOSS_PHASE_CUES={
 furnace:{wave:'triangle',start:120,end:520,duration:.7,pulses:2},
 meltdown:{wave:'sine',start:560,end:60,duration:1.1,pulses:3}
};
export const UTILITY_CUES={decoy:{wave:'square',start:700,end:1000,duration:.18,pulses:2},smoke:{wave:'triangle',start:210,end:55,duration:.5,pulses:1},frag:{wave:'sine',start:420,end:900,duration:.3,pulses:2},blast:{wave:'sawtooth',start:130,end:30,duration:.4,pulses:3}};
export const IMPACT_CUES={
 metal:{wave:'triangle',start:920,end:180,duration:.26,pulses:2},
 planks:{wave:'square',start:260,end:88,duration:.17,pulses:2},
 brick:{wave:'square',start:180,end:54,duration:.2,pulses:2},
 rock:{wave:'sine',start:130,end:42,duration:.22,pulses:1},
 forest:{wave:'triangle',start:240,end:72,duration:.24,pulses:2},
 foliage:{wave:'triangle',start:300,end:110,duration:.2,pulses:1},
 dirt:{wave:'sine',start:96,end:34,duration:.24,pulses:1},
 gravel:{wave:'sawtooth',start:150,end:46,duration:.19,pulses:2},
 container:{wave:'triangle',start:520,end:96,duration:.24,pulses:2},
 crate:{wave:'square',start:348,end:102,duration:.16,pulses:1},
 concrete:{wave:'sawtooth',start:170,end:50,duration:.18,pulses:1},
 hazard:{wave:'sine',start:440,end:140,duration:.22,pulses:1},
 tiles:{wave:'sine',start:660,end:230,duration:.2,pulses:2},
 asphalt:{wave:'sawtooth',start:108,end:30,duration:.18,pulses:2}
};
export const WEAPON_CUES={
 ar:{wave:'sawtooth',start:230,end:48,duration:.13,pulses:1},
 smg:{wave:'square',start:330,end:85,duration:.075,pulses:1},
 shotgun:{wave:'sawtooth',start:105,end:24,duration:.34,pulses:2},
 sniper:{wave:'triangle',start:460,end:38,duration:.42,pulses:1},
 pistol:{wave:'square',start:310,end:65,duration:.14,pulses:1},
 lmg:{wave:'sawtooth',start:150,end:32,duration:.19,pulses:1}
};
export const ACTION_CUES={
 reload:{wave:'square',start:180,end:460,duration:.48,pulses:3},
 equip:{wave:'triangle',start:220,end:410,duration:.2,pulses:2},
 search:{wave:'triangle',start:170,end:260,duration:.24,pulses:2},
 take:{wave:'sine',start:620,end:850,duration:.12,pulses:1},
 lootRare:{wave:'triangle',start:780,end:1360,duration:.34,pulses:2},
 lootEpic:{wave:'triangle',start:660,end:1480,duration:.5,pulses:3},
 lootLegendary:{wave:'sawtooth',start:520,end:1760,duration:.7,pulses:4},
 use:{wave:'sine',start:350,end:680,duration:.32,pulses:2},
 door:{wave:'square',start:150,end:260,duration:.2,pulses:1},
 objective:{wave:'sine',start:520,end:1180,duration:.32,pulses:2},
 objectiveSecured:{wave:'triangle',start:680,end:1460,duration:.5,pulses:3},
 hurt:{wave:'triangle',start:90,end:35,duration:.18,pulses:1},
 hit:{wave:'triangle',start:620,end:870,duration:.09,pulses:1},
 weak:{wave:'square',start:1060,end:1580,duration:.13,pulses:2},
 headshot:{wave:'square',start:980,end:1420,duration:.11,pulses:2},
 kill:{wave:'sawtooth',start:420,end:1080,duration:.22,pulses:2},
 downed:{wave:'sine',start:340,end:85,duration:.65,pulses:3},
 revived:{wave:'sine',start:260,end:780,duration:.48,pulses:3},
 boarding:{wave:'sine',start:520,end:1040,duration:.4,pulses:2},
 interrupted:{wave:'square',start:360,end:150,duration:.24,pulses:2},
 extracted:{wave:'triangle',start:440,end:1320,duration:.75,pulses:3},
 eliminated:{wave:'sine',start:240,end:40,duration:.7,pulses:2},
 footstep:{wave:'triangle',start:110,end:46,duration:.09,pulses:1},
 machineStep:{wave:'square',start:96,end:38,duration:.14,pulses:1}
};
export function spatialCue(listener,source){
 const dx=source.x-listener.x,dz=source.z-listener.z,distance=Math.hypot(dx,dz,(source.y||0)-(listener.y||0));
 if(!Number.isFinite(distance)||distance>55)return null;
 // View forward is +Z at yaw zero; positive pan is the listener's right.
 return {gain:1/(1+(distance/12)**2),pan:distance?Math.max(-1,Math.min(1,(-dx*Math.cos(listener.yaw||0)+dz*Math.sin(listener.yaw||0))/distance)):0};
}
export class RaidAudio {
 constructor(){this.enabled=true;this.volume=.7;this.context=null;this.active=0;this.seen=new Map();this.fieldCues=new Map();this.bossPhases=new Map();this.previousSelf=null}
 resume(){if(!this.context)try{this.context=new (window.AudioContext||window.webkitAudioContext)()}catch{}this.context?.resume().catch(()=>{})}
 play(kind='warning',spatial=null){
  const ctx=this.context;if(!this.enabled||this.volume<=0||!ctx||ctx.state!=='running'||this.active>=12)return false;
  const cue=MACHINE_CUES[kind]||BOSS_PHASE_CUES[kind]||UTILITY_CUES[kind]||ACTION_CUES[kind]||IMPACT_CUES[kind.replace(/^impact:/,'')]||WEAPON_CUES[kind.replace(/^shot:/,'')]||{wave:kind==='shot'?'sawtooth':kind==='hit'?'triangle':'sine',start:kind==='shot'?180:kind==='hit'?70:600,end:kind==='shot'?45:kind==='hit'?35:350,duration:.16,pulses:1};
  const at=ctx.currentTime,output=ctx.createGain(),pan=ctx.createStereoPanner();output.gain.value=.045*Math.min(1,Math.max(0,this.volume))*(spatial?.gain??1);pan.pan.value=spatial?.pan??0;output.connect(pan).connect(ctx.destination);this.active++;
  let remaining=cue.pulses;
  for(let i=0;i<cue.pulses;i++){
   const start=at+i*cue.duration/cue.pulses,length=cue.duration/cue.pulses*.8,osc=ctx.createOscillator(),envelope=ctx.createGain();
   osc.type=cue.wave;osc.frequency.setValueAtTime(cue.start,start);osc.frequency.exponentialRampToValueAtTime(cue.end,start+length);
   envelope.gain.setValueAtTime(.001,start);envelope.gain.linearRampToValueAtTime(1,start+.008);envelope.gain.exponentialRampToValueAtTime(.001,start+length);
   osc.connect(envelope).connect(output);osc.onended=()=>{osc.disconnect();envelope.disconnect();if(!--remaining){output.disconnect();pan.disconnect();this.active--}};osc.start(start);osc.stop(start+length+.01);
  }
  return true;
 }
 observe(snapshot){
  const now=snapshot.serverTime;
  const self=snapshot.self,previous=this.previousSelf;
  // Compare copied facts, not mutable snapshot objects. Reconnect/reset starts
  // silently; only current operator transitions can produce these local cues.
  const current={deploymentId:self.deploymentId,hp:self.hp,alive:self.alive,downed:!!self.downed,board:self.board?.exit||null,outcome:self.result?.outcome||null,hit:self.hit?{token:self.hit.token,headshot:!!self.hit.headshot,weak:!!self.hit.weak,kill:!!self.hit.kill}:null};
  this.previousSelf=current;
  if(previous&&previous.deploymentId===current.deploymentId){
   if(previous.alive&&!current.alive)this.play(current.outcome==='extract'?'extracted':'eliminated');
   else if(current.alive){
    if(!previous.downed&&current.downed)this.play('downed');
    else if(previous.downed&&!current.downed)this.play('revived');
    else if(current.hp<previous.hp)this.play('hurt');
    if(current.board&&current.board!==previous.board)this.play('boarding');
    else if(previous.board&&!current.board)this.play('interrupted');
   }
   // A hit cue follows the server's monotonic hit token. Repeating the same
   // token on later polls never re-triggers it; a miss has no token at all.
   if(current.hit&&current.hit.token!==(previous.hit?.token||0))this.play(current.hit.kill?'kill':current.hit.weak?'weak':current.hit.headshot?'headshot':'hit');
  }
  for(const [id,until]of this.seen)if(until<now)this.seen.delete(id);
  if(!snapshot.self.alive)return;
  const listener={...snapshot.self,...(snapshot.camera||{})};
  const bossAlive=new Set();
  for(const machine of snapshot.machines||[]){
   if(machine.kind!=='overlord')continue;
   bossAlive.add(machine.id);const phase=machine.bossPhase||null,prior=this.bossPhases.get(machine.id);
   // The cue marks an observed phase change; unchanged phases and first sightings
   // never retrigger it, and a lost poll cannot replay a stale sting.
   if(phase&&phase!=='approach'&&prior&&prior!==phase){
    const spatial=spatialCue(listener,machine);if(spatial)this.play(phase==='meltdown'?'meltdown':'furnace',spatial);
   }
   if(phase)this.bossPhases.set(machine.id,phase);else this.bossPhases.delete(machine.id);
  }
  for(const id of this.bossPhases.keys())if(!bossAlive.has(id))this.bossPhases.delete(id);
  for(const machine of snapshot.machines||[]){
   if(machine.state!=='windup'||!Object.hasOwn(MACHINE_CUES,machine.kind))continue;
   const prior=this.seen.get(machine.id);if(prior!=null)continue;
   const spatial=spatialCue(listener,machine);if(spatial)this.play(machine.kind,spatial);
   // One cue per observed charge. A lost intermediate poll cannot retrigger it.
   this.seen.set(machine.id,now+4);
  }
  const fields=new Set();for(const e of snapshot.utilities||[]){
   if(now>=e.until)continue;fields.add(e.id);const active=now>=e.activeAt;if(e.kind!=='frag'&&!active)continue;
   const phase=e.kind==='decoy'?Math.floor(now-e.activeAt):e.kind==='frag'&&e.detonated?'blast':e.kind;
   if(this.fieldCues.get(e.id)===phase)continue;this.fieldCues.set(e.id,phase);const spatial=spatialCue(listener,e);if(spatial)this.play(phase==='blast'?'blast':e.kind,spatial);
  }
  for(const id of this.fieldCues.keys())if(!fields.has(id))this.fieldCues.delete(id);
  const charging=new Set((snapshot.machines||[]).filter(m=>m.state==='windup').map(m=>m.id));
  for(const id of this.seen.keys())if(!charging.has(id))this.seen.delete(id);
 }
 reset(){this.seen.clear();this.fieldCues.clear();this.bossPhases.clear();this.previousSelf=null}
}
