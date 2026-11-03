import {RuleError} from './rules.mjs';
export class RateLimiter {
 constructor({now=()=>Date.now(),maxKeys=20000}={}){this.now=now;this.maxKeys=maxKeys;this.windows=new Map()}
 check(key,limit,windowMs=60000){
  const now=this.now();let entry=this.windows.get(key);
  if(!entry||entry.until<=now){
   if(this.windows.size>=this.maxKeys)for(const [key,value]of this.windows)if(value.until<=now)this.windows.delete(key);
   if(!entry&&this.windows.size>=this.maxKeys)throw new RuleError('Service busy; retry later',429);
   entry={count:0,until:now+windowMs};this.windows.set(key,entry);
  }
  if(entry.count>=limit)throw new RuleError('Too many requests; retry later',429);entry.count++;
 }
}
