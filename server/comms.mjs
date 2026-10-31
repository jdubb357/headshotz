import {randomUUID} from 'node:crypto';
import {requireRule as check} from './rules.mjs';
import {REPORT_REASONS,VOICE_SCOPES,hearsSquad,hearsProximity} from '../shared/raid-comms.mjs';
export function blockedBetween(store,a,b){return !!store.db.prepare("SELECT 1 FROM comm_blocks WHERE mode='block' AND ((account=? AND target=?) OR (account=? AND target=?))").get(a,b,b,a)}
export class RaidComms {
 constructor(store,raids,{now=()=>Date.now()/1000,iceServers=[]}={}){this.store=store;this.raids=raids;this.now=now;this.iceServers=iceServers;this.presences=new Map();this.messages=new Map();this.cursor=0}
 revoke(account,sessionKey){const p=this.presences.get(account);if(p&&(!sessionKey||p.sessionKey===sessionKey)){this.presences.delete(account);this.messages.delete(account)}for(const [id,list]of this.messages)this.messages.set(id,list.filter(m=>m.from!==account))}
 validPresence(p){return p&&p.expires>this.now()&&(!p.sessionKey||this.store.db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').get(p.sessionKey,Date.now()))}
 prune(){const now=this.now();for(const [id,p]of this.presences)if(p.expires<=now||!this.validPresence(p)){this.presences.delete(id);this.messages.delete(id)}for(const [id,list]of this.messages){const kept=list.filter(m=>m.until>now);if(kept.length)this.messages.set(id,kept);else this.messages.delete(id)}}
 preferences(account){return {scope:this.store.db.prepare('SELECT scope FROM comm_preferences WHERE account=?').get(account)?.scope||'squad',controls:this.store.db.prepare('SELECT b.target,b.mode,a.username FROM comm_blocks b JOIN accounts a ON a.id=b.target WHERE b.account=?').all(account),privacy:'/raid-privacy.html'}}
 relationship(a,b){
  if(a===b)return null;
  const p=this.raids.byAccount.get(a),q=this.raids.byAccount.get(b),r=p&&this.raids.raids.get(p.raidId);
  if(p&&q&&r&&p.raidId===q.raidId&&this.now()<r.deadline+120)return {context:r.id,squad:p.team===q.team,near:p.alive&&q.alive&&Math.hypot(p.x-q.x,(p.y||0)-(q.y||0),p.z-q.z)<=24,name:q.name||'Operator',p,q};
  if(p?.alive||q?.alive)return null;
  const party=this.store.partyFor(a),member=party?.members.find(m=>m.account===b);return member?{context:'party:'+party.id,squad:true,near:false,name:member.username}:null;
 }
 canVoice(a,b){
  const from=this.presences.get(a),to=this.presences.get(b);if(!this.validPresence(from)||!this.validPresence(to))return null;
  const relation=this.relationship(a,b);if(!relation||blockedBetween(this.store,a,b))return null;
  // A local mute prevents both incoming delivery and negotiation with that peer.
  if(this.store.db.prepare('SELECT 1 FROM comm_blocks WHERE (account=? AND target=?) OR (account=? AND target=?)').get(a,b,b,a))return null;
  return relation.squad&&hearsSquad(from.scope)&&hearsSquad(to.scope)?{...relation,channel:'squad'}:relation.near&&hearsProximity(from.scope)&&hearsProximity(to.scope)?{...relation,channel:'proximity'}:null;
 }
 social(account,data){
  if(data.type==='preferences'){
   check(VOICE_SCOPES.includes(data.scope),'Invalid voice scope',400);this.store.db.prepare('INSERT INTO comm_preferences VALUES(?,?) ON CONFLICT(account) DO UPDATE SET scope=excluded.scope').run(account,data.scope);return this.preferences(account);
  }
  check(typeof data.target==='string'&&data.target!==account&&this.store.db.prepare('SELECT id FROM accounts WHERE id=?').get(data.target),'Unknown player',400);
  if(['mute','block','unblock','unmute'].includes(data.type)){
   const old=this.store.db.prepare('SELECT mode FROM comm_blocks WHERE account=? AND target=?').get(account,data.target);
   check(old||this.relationship(account,data.target),'Player is not in your squad or raid',403);
   check(!(old?.mode==='block'&&data.type==='mute'),'Unblock this player before muting voice');
   if(data.type==='unblock'||data.type==='unmute')this.store.db.prepare('DELETE FROM comm_blocks WHERE account=? AND target=? AND mode=?').run(account,data.target,data.type==='unblock'?'block':'mute');
   else{check(this.store.db.prepare('SELECT count(*) n FROM comm_blocks WHERE account=?').get(account).n<500||old,'Communication control limit reached');this.store.db.prepare('INSERT INTO comm_blocks VALUES(?,?,?) ON CONFLICT(account,target) DO UPDATE SET mode=excluded.mode').run(account,data.target,data.type)}
   // Never retain buffered signaling from a newly muted/blocked peer.
   for(const [id,list]of this.messages)this.messages.set(id,list.filter(m=>!((m.from===account&&id===data.target)||(m.from===data.target&&id===account))));
   this.store.audit(account,'communication_control',{target:data.target,type:data.type});return this.preferences(account);
  }
  if(data.type==='report'){
   check(REPORT_REASONS.includes(data.reason),'Choose a report category',400);check(typeof data.detail==='string'&&data.detail.length<=1000,'Report detail is too long',400);
   const relation=this.relationship(account,data.target);check(relation,'Player is not in your squad or raid',403);
   return this.store.transaction(()=>{
    const prior=this.store.db.prepare('SELECT id FROM player_reports WHERE reporter=? AND target=? AND context=? AND reason=?').get(account,data.target,relation.context,data.reason);if(prior)return {reportId:prior.id};
    const id=randomUUID();this.store.db.prepare('INSERT INTO player_reports(id,reporter,target,context,reason,detail,evidence,at) VALUES(?,?,?,?,?,?,?,?)').run(id,account,data.target,relation.context,data.reason,data.detail.trim(),JSON.stringify({sameSquad:relation.squad,nearby:relation.near,raid:relation.p?.raidId||null}),Date.now());this.store.audit(account,'player_report',{id,target:data.target,reason:data.reason});return {reportId:id};
   });
  }
  check(false,'Unknown communication control',400);
 }
 presence(account,data,sessionKey=null){
  this.prune();check(typeof data.clientId==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(data.clientId),'Invalid voice session',400);
  const old=this.presences.get(account);
  if(data.type==='leave'){if(old?.clientId===data.clientId){this.presences.delete(account);this.messages.delete(account)}return {joined:false}}
  check(['join','renew'].includes(data.type),'Unknown voice action',400);
  if(data.type==='renew')check(old?.clientId===data.clientId,'Voice session expired; join again',409);
  else{check(!old||old.clientId===data.clientId,'Voice is already enabled in another tab',409);check(VOICE_SCOPES.includes(data.scope),'Invalid voice scope',400);check(this.presences.size<2000||old,'Voice service busy',503)}
  const presence={clientId:data.clientId,sessionKey,epoch:old?.epoch||randomUUID(),scope:data.type==='join'?data.scope:old.scope,expires:this.now()+6};this.presences.set(account,presence);
  return {joined:true,epoch:presence.epoch,scope:presence.scope};
 }
 signal(account,data){
  this.prune();const from=this.presences.get(account),to=this.presences.get(data.target);
  check(from&&from.clientId===data.clientId&&from.epoch===data.epoch,'Voice session expired',409);check(to&&to.epoch===data.targetEpoch&&this.canVoice(account,data.target),'Voice peer unavailable',403);
  check(['offer','answer','candidate'].includes(data.kind),'Invalid voice signal',400);let payload;
  if(data.kind==='candidate'){
   check(data.payload&&typeof data.payload.candidate==='string'&&data.payload.candidate.length<=1200,'Invalid ICE candidate',400);
   check(data.payload.sdpMid===null||typeof data.payload.sdpMid==='string'&&data.payload.sdpMid.length<=20,'Invalid candidate mid',400);check(data.payload.sdpMLineIndex===null||Number.isInteger(data.payload.sdpMLineIndex)&&data.payload.sdpMLineIndex>=0&&data.payload.sdpMLineIndex<=8,'Invalid candidate index',400);
   payload={candidate:data.payload.candidate,sdpMid:data.payload.sdpMid,sdpMLineIndex:data.payload.sdpMLineIndex};
  }else{
   check(typeof data.payload==='string'&&data.payload.length<=6000&&data.payload.startsWith('v=0')&&!/^m=(?!audio )/m.test(data.payload),'Only audio session descriptions are allowed',400);payload=data.payload;
  }
  const list=this.messages.get(data.target)||[];check(list.length<64,'Voice peer queue is full',429);
  list.push({id:++this.cursor,from:account,epoch:from.epoch,targetEpoch:to.epoch,kind:data.kind,payload,until:this.now()+12});this.messages.set(data.target,list);return {ok:true};
 }
 poll(account,clientId,after=0){
  this.prune();check(Number.isSafeInteger(after)&&after>=0,'Invalid voice cursor',400);
  const own=this.presences.get(account);if(!own||own.clientId!==clientId)return {joined:false,peers:[],signals:[],cursor:this.cursor};
  const peers=[];for(const [id,to]of this.presences){const relation=this.canVoice(account,id);if(relation)peers.push({id,epoch:to.epoch,name:relation.name,channel:relation.channel,gain:relation.channel==='proximity'?Math.max(.05,1-Math.hypot(relation.p.x-relation.q.x,(relation.p.y||0)-(relation.q.y||0),relation.p.z-relation.q.z)/24):1})}
  const ids=new Set(peers.map(p=>p.id));const signals=(this.messages.get(account)||[]).filter(m=>m.id>after&&m.targetEpoch===own.epoch&&ids.has(m.from)).map(({until,...m})=>m);
  this.messages.set(account,(this.messages.get(account)||[]).filter(m=>m.id>after));
  return {joined:true,epoch:own.epoch,peers,signals,cursor:this.cursor,iceServers:this.iceServers};
 }
}
