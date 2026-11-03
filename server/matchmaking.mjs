import {randomUUID} from 'node:crypto';
import {MATCH_POLICY} from '../shared/raid-matchmaking.mjs';
import {requireRule} from './rules.mjs';
// A server-clock nonce round trip. A client can delay its answer, but cannot
// claim a latency below the time needed to receive and return this nonce.
export class MatchmakingProbes {
 constructor(store,{now=()=>performance.now()}={}){this.store=store;this.now=now;this.challenges=new Map();this.measurements=new Map()}
 prune(){const now=this.now();for(const [id,p]of this.challenges)if(p.expires<=now)this.challenges.delete(id);for(const [id,p]of this.measurements)if(p.expires<=now)this.measurements.delete(id)}
 issue(account,session){this.prune();for(const [id,p]of this.challenges)if(p.account===account&&p.session===session)this.challenges.delete(id);requireRule(this.challenges.size<10000,'Latency service busy',503);const nonce=randomUUID(),at=this.now();this.challenges.set(nonce,{account,session,at,expires:at+10000});return {nonce,expiresInMs:10000}}
 finish(account,session,nonce){this.prune();const p=this.challenges.get(nonce);requireRule(p&&p.account===account&&p.session===session,'Latency check expired; check again');this.challenges.delete(nonce);const at=this.now(),rttMs=Math.max(1,Math.ceil(at-p.at)),proofId=randomUUID();for(const [id,m]of this.measurements)if(m.account===account&&m.session===session)this.measurements.delete(id);requireRule(this.measurements.size<10000,'Latency service busy',503);this.measurements.set(proofId,{account,session,at,rttMs,expires:at+MATCH_POLICY.probeValidMs});return {proofId,rttMs,validForMs:MATCH_POLICY.probeValidMs}}
 valid(m){return m&&m.expires>this.now()&&this.store.db.prepare('SELECT 1 FROM sessions WHERE token=? AND account=? AND expires>?').get(m.session,m.account,Date.now())}
 status(account,maxRttMs){this.prune();const m=[...this.measurements.values()].filter(m=>m.account===account&&this.valid(m)).sort((a,b)=>b.at-a.at)[0];return {rttMs:m?.rttMs??null,fresh:!!m,withinLimit:!maxRttMs||!!m&&m.rttMs<=maxRttMs}}
 require(account,maxRttMs,{session,proofId}={}){
  if(!maxRttMs)return null;this.prune();const m=proofId?this.measurements.get(proofId):[...this.measurements.values()].filter(m=>m.account===account&&this.valid(m)).sort((a,b)=>b.at-a.at)[0];
  requireRule(m&&m.account===account&&(!session||m.session===session)&&this.valid(m),'A squad member needs a fresh latency check before deployment');requireRule(m.rttMs<=maxRttMs,'Measured latency exceeds the chosen limit; choose a higher limit or try again');return m.rttMs;
 }
}
