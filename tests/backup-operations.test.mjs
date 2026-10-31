import {earnedPurchase} from './earned-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,statSync,existsSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {AccountSecurity} from '../server/account-security.mjs';
import {createBackup,verifyBackup,restoreBackup} from '../server/backup.mjs';
import {SCHEMA_VERSION} from '../server/schema.mjs';
function setup(t){const directory=mkdtempSync(join(tmpdir(),'headshotz-ops-')),source=join(directory,'source.sqlite'),store=new RaidStore(source);t.after(()=>{try{store.close()}catch{}rmSync(directory,{recursive:true,force:true})});return {directory,source,store}}
test('old-schema backup migration clears only the copied lease and leaves the live source untouched',async t=>{
 const {directory,source,store}=setup(t);store.register('old_backup_owner','a long backup password');store.acquireLease('old-service');store.db.exec('PRAGMA user_version=5');const lease=store.db.prepare('SELECT * FROM leases').get(),bundle=join(directory,'old-bundle'),target=join(directory,'migrated-copy');await createBackup({source,destination:bundle,build:'old-test'});
 const restored=await restoreBackup({directory:bundle,destination:target,operator:'test',raidPolicy:'abort'});assert.equal(restored.schema,SCHEMA_VERSION);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,5);assert.deepEqual(store.db.prepare('SELECT * FROM leases').get(),lease);const copy=new RaidStore(join(target,'raid.sqlite'));try{assert.equal(copy.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.equal(copy.db.prepare('SELECT count(*) n FROM leases').get().n,0)}finally{copy.close()}store.releaseLease('old-service');
});
test('online backup includes committed WAL data, checkpoints and hashes without modifying live ownership',async t=>{
 const {directory,source,store}=setup(t),account=store.register('backup_user','a long backup password'),raids=new RaidService(store,{now:()=>1000});
 const weapon=store.profile(account.id).items[0].id;raids.deploy(account.id,{requestId:'backup_raid',mapId:'relay',itemIds:[weapon]});const before=store.profile(account.id),checkpoint=store.loadRaids();assert.ok(existsSync(source+'-wal'));
 const out=join(directory,'backup'),manifest=await createBackup({source,destination:out,build:'test-build'}),verified=await verifyBackup(out);assert.equal(verified.verified,true);assert.equal(manifest.counts.activeDeployments,1);assert.equal(manifest.counts.checkpoints,1);assert.deepEqual(store.profile(account.id),before);assert.deepEqual(store.loadRaids(),checkpoint);
 const copy=new DatabaseSync(join(out,'raid.sqlite'),{readOnly:true});try{assert.equal(copy.prepare('SELECT id FROM accounts').get().id,account.id);assert.equal(copy.prepare('SELECT payload FROM raid_checkpoints').get().payload,JSON.stringify(checkpoint[0]))}finally{copy.close()}
 assert.equal(statSync(out).mode&0o777,0o700);for(const name of ['raid.sqlite','manifest.json'])assert.equal(statSync(join(out,name)).mode&0o777,0o600);raids.close();
});
test('restore to a fresh directory invalidates sign-ins/codes and preserves resume state without overwriting a destination',async t=>{
 const {directory,source,store}=setup(t),account=store.register('resume_user','a long backup password'),auth=store.login(account.username,'a long backup password'),security=new AccountSecurity(store);security.generateCodes(auth.token,'a long backup password');
 const raids=new RaidService(store,{now:()=>1000});raids.deploy(account.id,{requestId:'resume_raid',mapId:'relay',recovery:true});const before=store.profile(account.id);raids.byAccount.get(account.id).hp=43;raids.tick(.05);const backup=join(directory,'backup');await createBackup({source,destination:backup});
 const target=join(directory,'restored');const restored=await restoreBackup({directory:backup,destination:target,operator:'test_operator',raidPolicy:'resume'});assert.equal(restored.invalidatedSessions,1);assert.equal(restored.invalidatedCodes,8);const copy=new RaidStore(join(target,'raid.sqlite'));
 try{assert.throws(()=>copy.authenticate(auth.token),/Sign in/);const fresh=copy.login(account.username,'a long backup password');assert.equal(new AccountSecurity(copy).list(fresh.token).recoveryRemaining,0);assert.deepEqual(copy.profile(account.id),before);const recovered=new RaidService(copy,{now:()=>1001});assert.equal(recovered.byAccount.get(account.id).hp,43);assert.equal(recovered.byAccount.get(account.id).alive,true);recovered.close();assert.equal(copy.db.prepare("SELECT count(*) n FROM audit WHERE event='backup_restored'").get().n,1)}finally{copy.close()}
 const receipt=readFileSync(join(target,'restore-receipt.json'),'utf8');await assert.rejects(restoreBackup({directory:backup,destination:target,operator:'test_operator',raidPolicy:'resume'}),/exist/);assert.equal(readFileSync(join(target,'restore-receipt.json'),'utf8'),receipt);raids.close();
});
test('abort restore refunds escrow once, preserves items banked elsewhere and grants no scavenging rewards',async t=>{
 const {directory,source,store}=setup(t),a=store.register('abort_a','a long backup password'),b=store.register('abort_b','a long backup password'),raids=new RaidService(store,{now:()=>1000});
 const original=earnedPurchase(store,a.id);raids.deploy(a.id,{requestId:'abort_deploy_a',mapId:'relay',itemIds:[original.id],insureIds:[original.id]});raids.deploy(b.id,{requestId:'abort_deploy_b',mapId:'relay',recovery:true});
 // Simulate an authoritative transfer/settlement: another account already banked A's gun.
 const p=raids.byAccount.get(a.id),other=raids.byAccount.get(b.id),raid=raids.raids.get(p.raidId);p.equipment=[];other.pack.push(original);raids.end(raid,other,'extract');raids.tick(.05);
 const backup=join(directory,'backup');await createBackup({source,destination:backup});const target=join(directory,'restored');const result=await restoreBackup({directory:backup,destination:target,operator:'test_operator',raidPolicy:'abort'});assert.equal(result.aborted,1);
 const copy=new RaidStore(join(target,'raid.sqlite'));try{assert.equal(copy.profile(a.id).activeDeployment,null);assert.ok(!copy.profile(a.id).items.some(it=>it.id===original.id));assert.equal(copy.profile(b.id).items.filter(it=>it.id===original.id).length,1);assert.equal(copy.results(a.id)[0].outcome,'aborted');assert.equal(copy.results(a.id)[0].xp,0);assert.equal(copy.results(a.id)[0].refund,20);assert.equal(copy.loadRaids().length,0);const before=copy.profile(a.id);copy.recoverInterrupted();assert.deepEqual(copy.profile(a.id),before)}finally{copy.close()}raids.close();
});
test('backup verification rejects tampering and restore never creates a target for bad input',async t=>{
 const {directory,source,store}=setup(t);store.register('checksum_user','a long backup password');const out=join(directory,'backup');await createBackup({source,destination:out});const file=join(out,'raid.sqlite'),bytes=readFileSync(file);bytes[bytes.length-5]^=1;writeFileSync(file,bytes);
 await assert.rejects(verifyBackup(out),/checksum/);await assert.rejects(restoreBackup({directory:out,destination:join(directory,'invalid-restore'),operator:'test_operator',raidPolicy:'abort'}),/checksum/);assert.equal(existsSync(join(directory,'invalid-restore')),false);
});
test('backup refuses existing, public-root and symlink file outputs and cleans failed new bundles',async t=>{
 const {directory,source,store}=setup(t);store.register('path_user','a long backup password');const out=join(directory,'exists');mkdirSync(out);writeFileSync(join(out,'keep.txt'),'preserve');await assert.rejects(createBackup({source,destination:out}),/exist/);assert.equal(readFileSync(join(out,'keep.txt'),'utf8'),'preserve');
 await assert.rejects(createBackup({source,destination:resolve('assets/unsafe-backup')}),/private output/);
 const bad=join(directory,'bad.sqlite');writeFileSync(bad,'not a database');await assert.rejects(createBackup({source:bad,destination:join(directory,'failed')}));assert.equal(existsSync(join(directory,'failed')),false);
 const valid=join(directory,'valid');await createBackup({source,destination:valid});const file=join(valid,'manifest.json'),content=readFileSync(file);rmSync(file);const alternate=join(directory,'manifest.json');writeFileSync(alternate,content);symlinkSync(alternate,file);await assert.rejects(verifyBackup(valid),/symlink/);
});
test('a writer commits during multi-step online backup without producing a mixed snapshot',async t=>{
 const {directory,source,store}=setup(t);store.register('concurrent_backup','a long backup password');store.db.exec('CREATE TABLE backup_probe(id INTEGER PRIMARY KEY,batch INTEGER NOT NULL,payload BLOB NOT NULL)');store.transaction(()=>{const insert=store.db.prepare('INSERT INTO backup_probe VALUES(?,0,zeroblob(8192))');for(let i=0;i<512;i++)insert.run(i)});
 let wrote=false;const out=join(directory,'concurrent');await createBackup({source,destination:out,onProgress:({remainingPages})=>{if(!wrote&&remainingPages>0){store.db.exec('UPDATE backup_probe SET batch=1');wrote=true}}});assert.equal(wrote,true,'the separate live connection wrote while backup pages remained');assert.equal(store.db.prepare('SELECT min(batch) n FROM backup_probe').get().n,1);
 const copy=new DatabaseSync(join(out,'raid.sqlite'),{readOnly:true});try{const groups=copy.prepare('SELECT batch,count(*) n FROM backup_probe GROUP BY batch').all();assert.equal(groups.length,1);assert.equal(groups[0].n,512);assert.equal(groups[0].batch,0,'the backup retains its pinned snapshot before the concurrent write')}finally{copy.close()}
});
test('backup CLI creates, verifies and restores only fresh explicit destinations',async t=>{
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),execute=promisify(execFile),{directory,source,store}=setup(t);store.register('cli_backup','a long backup password');const bundle=join(directory,'cli-backup'),target=join(directory,'cli-restore');
 const invoke=async(...args)=>JSON.parse((await execute(process.execPath,['scripts/backup.mjs',...args])).stdout);
 assert.equal((await invoke('create','--db',source,'--out',bundle,'--build','cli-test')).build,'cli-test');assert.equal((await invoke('verify','--backup',bundle)).verified,true);assert.equal((await invoke('restore','--backup',bundle,'--out',target,'--operator','test','--raid-policy','abort')).schema,SCHEMA_VERSION);
 await assert.rejects(invoke('restore','--backup',bundle,'--out',target,'--operator','test','--raid-policy','abort'));await assert.rejects(invoke('restore','--backup',bundle,'--out',join(directory,'missing-policy'),'--operator','test'));assert.equal(existsSync(join(directory,'missing-policy')),false);
});
