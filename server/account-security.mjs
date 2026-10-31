import {randomBytes,randomUUID} from 'node:crypto';
import {digest,encodePassword,verifyPassword} from './credentials.mjs';
import {requireRule as check} from './rules.mjs';
const normalizedCode=value=>typeof value==='string'&&value.length<=80?value.replace(/[\s-]/g,'').toLowerCase():'';
const codeHash=(account,value)=>digest('raid-recovery:'+account+':'+normalizedCode(value));
export class AccountSecurity {
 constructor(store){this.store=store;this.db=store.db}
 account(session){const id=this.store.authenticate(session);return this.db.prepare('SELECT id,username,password FROM accounts WHERE id=?').get(id)}
 verify(account,password){check(verifyPassword(password,account.password),'Current password did not match',403)}
 list(session){const account=this.account(session),current=digest(session),now=Date.now();return {sessions:this.db.prepare('SELECT id,label,created,seen,expires,token FROM sessions WHERE account=? AND expires>? ORDER BY created DESC,rowid DESC').all(account.id,now).map(({token,...row})=>({...row,current:token===current})),recoveryRemaining:this.db.prepare('SELECT count(*) n FROM recovery_codes WHERE account=? AND used IS NULL').get(account.id).n}}
 unready(account){this.db.prepare('UPDATE party_members SET ready=0 WHERE account=?').run(account)}
 rotate(account,label){this.db.prepare('DELETE FROM sessions WHERE account=?').run(account);this.unready(account);return this.store.issueSession(account,label)}
 changePassword(session,data,label){return this.store.transaction(()=>{
  const account=this.account(session);this.verify(account,data.currentPassword);check(!verifyPassword(data.newPassword,account.password),'Choose a different new password',400);const password=encodePassword(data.newPassword);
  this.db.prepare('UPDATE accounts SET password=? WHERE id=?').run(password,account.id);this.db.prepare('DELETE FROM recovery_codes WHERE account=?').run(account.id);const auth=this.rotate(account.id,label);this.store.audit(account.id,'password_changed',{});return auth;
 })}
 generateCodes(session,currentPassword){return this.store.transaction(()=>{
  const account=this.account(session);this.verify(account,currentPassword);const codes=Array.from({length:8},()=>randomBytes(20).toString('hex').match(/.{1,4}/g).join('-'));
  this.db.prepare('DELETE FROM recovery_codes WHERE account=?').run(account.id);for(const code of codes)this.db.prepare('INSERT INTO recovery_codes(id,account,code,created) VALUES(?,?,?,?)').run(randomUUID(),account.id,codeHash(account.id,code),Date.now());
  this.store.audit(account.id,'recovery_codes_replaced',{count:codes.length});return {codes};
 })}
 recover({username,code,newPassword}){return this.store.transaction(()=>{
  const account=this.db.prepare('SELECT id FROM accounts WHERE username=?').get(String(username||'').trim().toLowerCase()),encoded=codeHash(account?.id||'unknown',code),row=this.db.prepare('SELECT id FROM recovery_codes WHERE account=? AND code=? AND used IS NULL').get(account?.id||'unknown',encoded);
  check(account&&row,'Username or recovery code is invalid',401);const password=encodePassword(newPassword);
  check(this.db.prepare('UPDATE recovery_codes SET used=? WHERE id=? AND used IS NULL').run(Date.now(),row.id).changes===1,'Username or recovery code is invalid',401);
  this.db.prepare('UPDATE accounts SET password=? WHERE id=?').run(password,account.id);this.db.prepare('DELETE FROM sessions WHERE account=?').run(account.id);this.unready(account.id);this.store.audit(account.id,'account_recovered',{});return {ok:true,account:account.id};
 })}
 revoke(session,data,label){return this.store.transaction(()=>{
  const account=this.account(session);this.verify(account,data.currentPassword);
  if(data.allOthers===true){const auth=this.rotate(account.id,label);this.store.audit(account.id,'other_sessions_revoked',{});return {auth}}
  check(typeof data.id==='string','Choose a session',400);const target=this.db.prepare('SELECT token FROM sessions WHERE id=? AND account=? AND expires>?').get(data.id,account.id,Date.now());check(target,'Session not found',404);check(target.token!==digest(session),'Use Sign out to end your current session',400);
  this.db.prepare('DELETE FROM sessions WHERE id=? AND account=?').run(data.id,account.id);this.store.audit(account.id,'session_revoked',{id:data.id});return {ok:true,revokedToken:target.token};
 })}
}
