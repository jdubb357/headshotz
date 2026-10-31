import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {AccountSecurity} from '../server/account-security.mjs';
import {RaidService} from '../server/raids.mjs';
import {createRaidServer} from '../server/main.mjs';
import {digest,sessionLabel} from '../server/credentials.mjs';
const PASSWORD='original long password',NEXT='replacement long password';
function setup(t){const store=new RaidStore();t.after(()=>store.close());const account=store.register('security_tester',PASSWORD),security=new AccountSecurity(store),first=store.login(account.username,PASSWORD,'Browser one'),second=store.login(account.username,PASSWORD,'Browser two');return {store,account,security,first,second}}
test('sessions expose public identifiers and coarse metadata, never session credentials',t=>{
 const {store,security,account,first,second}=setup(t),result=security.list(first.token);assert.equal(result.sessions.length,2);assert.equal(result.sessions.filter(s=>s.current).length,1);assert.ok(result.sessions.every(s=>s.id&&s.created&&s.seen&&s.expires&&!s.token));
 const payload=JSON.stringify(result);for(const secret of [first.token,second.token,digest(first.token)])assert.ok(!payload.includes(secret));assert.equal(sessionLabel('Mozilla/5.0 (Macintosh) Chrome/156.0.0.0 Safari/537.36'),'Chrome on Mac');
 for(let i=0;i<22;i++)store.login(account.username,PASSWORD);assert.equal(security.list(store.login(account.username,PASSWORD).token).sessions.length,20);
});
test('password change rotates the current credential, revokes other sessions and preserves owned equipment',t=>{
 const {store,security,account,first,second}=setup(t),before=store.profile(account.id),auth=security.changePassword(first.token,{currentPassword:PASSWORD,newPassword:NEXT},'Refreshed browser');
 for(const token of [first.token,second.token])assert.throws(()=>store.authenticate(token),/Sign in/);assert.equal(store.authenticate(auth.token),account.id);assert.throws(()=>store.login(account.username,PASSWORD),/Invalid/);assert.equal(store.login(account.username,NEXT).account.id,account.id);assert.deepEqual(store.profile(account.id),before);
});
test('security mutations require current password and cannot revoke another account session',t=>{
 const {store,security,first}=setup(t),other=store.register('another_account',PASSWORD),foreign=store.login(other.username,PASSWORD),id=security.list(foreign.token).sessions[0].id;
 assert.throws(()=>security.generateCodes(first.token,'wrong'),/did not match/);assert.throws(()=>security.changePassword(first.token,{currentPassword:'wrong',newPassword:NEXT}),/did not match/);assert.throws(()=>security.revoke(first.token,{currentPassword:PASSWORD,id}),/not found/);assert.equal(store.authenticate(foreign.token),other.id);assert.equal(security.list(first.token).recoveryRemaining,0);
});
test('recovery codes are hashed, single-use, account-bound and absent from durable audit payloads',t=>{
 const {store,security,account,first,second}=setup(t),{codes}=security.generateCodes(first.token,PASSWORD);assert.equal(codes.length,8);assert.equal(new Set(codes).size,8);
 const stored=JSON.stringify(store.db.prepare('SELECT * FROM recovery_codes').all()),audit=JSON.stringify(store.db.prepare('SELECT * FROM audit').all());for(const code of codes){assert.ok(!stored.includes(code));assert.ok(!audit.includes(code));assert.ok(!stored.includes(code.replaceAll('-','')))}
 assert.throws(()=>security.recover({username:'missing',code:codes[0],newPassword:NEXT}),/Username or recovery code is invalid/);
 security.recover({username:account.username,code:codes[0].toUpperCase().replaceAll('-',' '),newPassword:NEXT});for(const token of [first.token,second.token])assert.throws(()=>store.authenticate(token),/Sign in/);assert.throws(()=>security.recover({username:account.username,code:codes[0],newPassword:PASSWORD}),/invalid/);
 const next=store.login(account.username,NEXT);assert.equal(security.list(next.token).recoveryRemaining,7);security.generateCodes(next.token,NEXT);assert.throws(()=>security.recover({username:account.username,code:codes[1],newPassword:PASSWORD}),/invalid/);
});
test('failed recovery transaction preserves the code, password, sessions and inventory',t=>{
 const {store,security,account,first}=setup(t),{codes}=security.generateCodes(first.token,PASSWORD),before=store.profile(account.id);
 store.db.exec("CREATE TRIGGER reject_recovery BEFORE INSERT ON audit WHEN NEW.event='account_recovered' BEGIN SELECT RAISE(ABORT,'database unavailable'); END;");
 assert.throws(()=>security.recover({username:account.username,code:codes[0],newPassword:NEXT}),/unavailable/);assert.equal(store.authenticate(first.token),account.id);assert.equal(security.list(first.token).recoveryRemaining,8);assert.equal(store.login(account.username,PASSWORD).account.id,account.id);assert.deepEqual(store.profile(account.id),before);
 store.db.exec('DROP TRIGGER reject_recovery');assert.equal(security.recover({username:account.username,code:codes[0],newPassword:NEXT}).ok,true);
});
test('failed password rotation leaves all previous sessions usable',t=>{
 const {store,security,account,first,second}=setup(t);store.db.exec("CREATE TRIGGER reject_password BEFORE INSERT ON audit WHEN NEW.event='password_changed' BEGIN SELECT RAISE(ABORT,'database unavailable'); END;");assert.throws(()=>security.changePassword(first.token,{currentPassword:PASSWORD,newPassword:NEXT}),/unavailable/);assert.equal(store.authenticate(first.token),account.id);assert.equal(store.authenticate(second.token),account.id);assert.equal(store.login(account.username,PASSWORD).account.id,account.id);
});
test('recovery preserves the vulnerable active operator and cannot manufacture escrow or settlements',t=>{
 const {store,security,account,first}=setup(t),raids=new RaidService(store,{now:()=>1000}),{codes}=security.generateCodes(first.token,PASSWORD),weapon=store.profile(account.id).items[0].id;
 raids.deploy(account.id,{requestId:'security_raid',mapId:'relay',itemIds:[weapon]});const p=raids.byAccount.get(account.id);p.hp=41;p.pack=[];const before=store.profile(account.id);
 security.recover({username:account.username,code:codes[0],newPassword:NEXT});assert.equal(p.hp,41);assert.equal(p.alive,true);assert.deepEqual(store.profile(account.id),before);assert.equal(store.results(account.id).length,0);assert.throws(()=>raids.deploy(account.id,{requestId:'security_again',mapId:'relay',recovery:true}),/Already deployed/);assert.equal(raids.byAccount.get(account.id).hp,41);
});
test('revoking other sessions rotates this browser and clears readiness without touching a raid',t=>{
 const {store,security,account,first,second}=setup(t);store.party(account.id,{type:'create',mode:'solo',region:'local',mapId:'relay'});store.party(account.id,{type:'ready',ready:true,loadout:{recovery:true,itemIds:[]}});
 const result=security.revoke(first.token,{allOthers:true,currentPassword:PASSWORD},'Current browser');assert.equal(store.authenticate(result.auth.token),account.id);for(const token of [first.token,second.token])assert.throws(()=>store.authenticate(token),/Sign in/);assert.equal(store.partyFor(account.id).members[0].ready,false);
});
test('v4 migration retains sessions, inventory and active checkpoints; recovery use survives restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'raid-security-')),file=join(dir,'raid.sqlite');let store=new RaidStore(file);
 try{const account=store.register('migration_account',PASSWORD),auth=store.login(account.username,PASSWORD),raids=new RaidService(store,{now:()=>1000});raids.deploy(account.id,{requestId:'migration_raid',mapId:'relay',recovery:true});raids.close();const before=store.profile(account.id),checkpoint=store.loadRaids();
  store.db.exec('DROP TABLE recovery_codes;DROP INDEX session_public_id;DROP INDEX session_owner;ALTER TABLE sessions DROP COLUMN id;ALTER TABLE sessions DROP COLUMN created;ALTER TABLE sessions DROP COLUMN seen;ALTER TABLE sessions DROP COLUMN label;PRAGMA user_version=4;');store.close();store=new RaidStore(file);assert.equal(store.authenticate(auth.token),account.id);assert.deepEqual(store.profile(account.id),before);assert.deepEqual(store.loadRaids(),checkpoint);assert.equal(new AccountSecurity(store).list(auth.token).sessions[0].label,'Existing session');
  const security=new AccountSecurity(store),{codes}=security.generateCodes(auth.token,PASSWORD);security.recover({username:account.username,code:codes[0],newPassword:NEXT});store.close();store=new RaidStore(file);assert.throws(()=>new AccountSecurity(store).recover({username:account.username,code:codes[0],newPassword:PASSWORD}),/invalid/);assert.equal(new AccountSecurity(store).list(store.login(account.username,NEXT).token).recoveryRemaining,7);
  store.db.exec('PRAGMA user_version=99');store.close();assert.throws(()=>new RaidStore(file),/newer/);store=new RaidStore(':memory:');
 }finally{store.close();rmSync(dir,{recursive:true,force:true})}
});
test('HTTP recovery, session revocation and password rotation never return auth credentials in JSON',async t=>{
 const store=new RaidStore(),{server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.close();await once(server,'close');store.close()});const base='http://127.0.0.1:'+server.address().port;
 const post=(route,data,cookie)=>fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)}),login=async password=>{const response=await post('login',{username:'http_security',password});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0]};
 store.register('http_security',PASSWORD);let cookie=await login(PASSWORD);const other=await login(PASSWORD);
 assert.equal((await fetch(base+'/api/sessions')).status,401);const response=await post('recovery-codes',{currentPassword:PASSWORD},cookie);assert.equal(response.headers.get('cache-control'),'no-store');const {codes}=await response.json();assert.equal(codes.length,8);
 const changed=await post('change-password',{currentPassword:PASSWORD,newPassword:NEXT},cookie);assert.deepEqual(await changed.json(),{ok:true});const refreshed=changed.headers.get('set-cookie').split(';')[0];assert.ok(refreshed!==cookie);for(const old of [cookie,other])assert.equal((await fetch(base+'/api/profile',{headers:{cookie:old}})).status,401);cookie=refreshed;
 assert.equal((await post('recover',{username:'http_security',code:codes[0],newPassword:PASSWORD})).status,401);const fresh=await(await post('recovery-codes',{currentPassword:NEXT},cookie)).json();assert.equal((await post('recover',{username:'http_security',code:fresh.codes[0],newPassword:PASSWORD})).status,200);assert.equal((await fetch(base+'/api/profile',{headers:{cookie}})).status,401);cookie=await login(PASSWORD);
 const batch=await(await post('recovery-codes',{currentPassword:PASSWORD},cookie)).json();assert.equal(batch.codes.length,8);for(let i=0;i<5;i++)assert.equal((await post('recover',{username:'unknown',code:'invalid',newPassword:PASSWORD})).status,401);assert.equal((await post('recover',{username:'unknown',code:'invalid',newPassword:PASSWORD})).status,429);
});
test('a request body opened before revocation cannot mutate account state afterwards',async t=>{
 const store=new RaidStore(),{server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.close();await once(server,'close');store.close()});const account=store.register('slow_body',PASSWORD),auth=store.login(account.username,PASSWORD),before=store.profile(account.id),port=server.address().port;
 const content=JSON.stringify({requestId:'old_slow_deploy',mapId:'relay',recovery:true});let status;const req=request({host:'127.0.0.1',port,path:'/api/deploy',method:'POST',headers:{cookie:'raid_session='+auth.token,'content-type':'application/json','content-length':Buffer.byteLength(content)}},res=>{status=res.statusCode;res.resume()});const finished=once(req,'close');req.flushHeaders();req.write(content.slice(0,10));await new Promise(r=>setTimeout(r,30));store.logout(auth.token);req.end(content.slice(10));await finished;assert.equal(status,401);assert.deepEqual(store.profile(account.id),before);
});
