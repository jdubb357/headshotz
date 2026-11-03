import {DatabaseSync,backup} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,constants} from 'node:fs';
import {mkdir,open,writeFile,readFile,lstat,realpath,chmod,rm,copyFile} from 'node:fs/promises';
import {resolve,dirname,basename,relative,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RaidStore} from './store.mjs';
import {BACKUP_SCHEMAS,SCHEMA_VERSION} from './schema.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fail=message=>{throw new Error(message)};
function parse(text){try{return JSON.parse(text)}catch{fail('Invalid serialized database or manifest record')}}
async function outputPath(path){
 const parent=await realpath(dirname(resolve(path))),target=join(parent,basename(resolve(path))),inside=relative(ROOT,target);
 if(inside&&!inside.startsWith('..'+sep)&&inside!=='..'&&!inside.startsWith('.raid-backups'+sep)&&inside!=='.raid-backups')fail('Choose a private output outside the repository or inside .raid-backups');
 if(target===ROOT)fail('Refusing the repository root as an output');return target;
}
async function regularFile(path){const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink())fail('Expected a regular file, not a symlink');return info}
async function checksum(path){const hash=createHash('sha256');for await(const part of createReadStream(path))hash.update(part);return hash.digest('hex')}
async function syncFile(path){const file=await open(path,'r');try{await file.sync()}finally{await file.close()}}
async function syncDirectory(path){const file=await open(path,'r');try{await file.sync()}finally{await file.close()}}
function analyze(db){
 const schema=db.prepare('PRAGMA user_version').get().user_version;if(!BACKUP_SCHEMAS.includes(schema))fail('Unsupported backup schema');
 const integrity=db.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')fail('Database integrity check failed');
 if(db.prepare('PRAGMA foreign_key_check').all().length)fail('Database foreign-key check failed');
 const count=table=>db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
 if(db.prepare("SELECT 1 FROM inventory WHERE location NOT IN ('stash','overflow','attached','raid','consumed','lost') LIMIT 1").get())fail('Invalid inventory location');
 const counts={accounts:count('accounts'),inventory:count('inventory'),deployments:count('deployments'),activeDeployments:db.prepare('SELECT count(*) n FROM deployments WHERE active=1').get().n,checkpoints:count('raid_checkpoints'),audit:count('audit'),auditHead:db.prepare('SELECT coalesce(max(id),0) n FROM audit').get().n,inventoryLocations:db.prepare('SELECT location,count(*) n FROM inventory GROUP BY location ORDER BY location').all()};
 if(db.prepare("SELECT count(*) n FROM inventory WHERE location IN ('stash','overflow','attached') AND account IS NULL").get().n)fail('Owned inventory lacks an account');
 if(db.prepare('SELECT account FROM deployments WHERE active=1 GROUP BY account HAVING count(*)>1 LIMIT 1').get())fail('Duplicate active account deployment');
 // Validate serialized records without emitting their contents or credentials.
 for(const {state}of db.prepare('SELECT state FROM accounts').iterate())parse(state);
 for(const {state,result}of db.prepare('SELECT state,result FROM deployments').iterate()){parse(state);if(result)parse(result)}
 for(const {id,payload}of db.prepare('SELECT id,payload FROM inventory').iterate()){const item=parse(payload);if(item.id!==id||!Number.isSafeInteger(item.quantity)||item.quantity<1)fail('Invalid item identity or quantity')}
 for(const {payload}of db.prepare('SELECT payload FROM raid_checkpoints').iterate()){const r=parse(payload);if(!r.id||!Array.isArray(r.players))fail('Invalid raid checkpoint');for(const p of r.players)if(p.alive||p.pending){const deployment=db.prepare('SELECT account,active FROM deployments WHERE id=?').get(p.deploymentId);if(!deployment?.active||deployment.account!==p.account)fail('Checkpoint deployment is inconsistent')}}
 return {schema,counts};
}
export async function verifyBackup(directory){
 const folder=await realpath(resolve(directory));await regularFile(join(folder,'manifest.json'));
 const manifest=parse(await readFile(join(folder,'manifest.json'),'utf8'));if(!manifest||typeof manifest!=='object'||!/^[a-f0-9-]{36}$/.test(manifest.id||'')||!Number.isFinite(Date.parse(manifest.createdAt))||!/^[a-zA-Z0-9_.-]{1,80}$/.test(manifest.build||'')||!/^v[0-9a-zA-Z_.-]{1,60}$/.test(manifest.node||'')||!Number.isSafeInteger(manifest.pages)||manifest.pages<1||manifest.format!==1||manifest.file!=='raid.sqlite'||!/^[a-f0-9]{64}$/.test(manifest.sha256)||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0)fail('Invalid backup manifest');
 const path=join(folder,'raid.sqlite'),info=await regularFile(path);if(info.size!==manifest.bytes||await checksum(path)!==manifest.sha256)fail('Backup checksum mismatch');
 const db=new DatabaseSync(path,{readOnly:true});let actual;try{actual=analyze(db)}finally{db.close()}
 if(actual.schema!==manifest.schema||JSON.stringify(actual.counts)!==JSON.stringify(manifest.counts))fail('Backup metadata mismatch');return {format:1,id:manifest.id,createdAt:manifest.createdAt,build:manifest.build,node:manifest.node,schema:actual.schema,counts:actual.counts,file:'raid.sqlite',bytes:manifest.bytes,sha256:manifest.sha256,pages:manifest.pages,verified:true};
}
export async function createBackup({source,destination,build='development',onProgress}){
 if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(build))fail('Invalid build identifier');const sourceFile=await realpath(resolve(source));await regularFile(sourceFile);const target=await outputPath(destination);let created=false,db;
 try{
  await mkdir(target,{mode:0o700});created=true;
  const copy=join(target,'raid.sqlite'),placeholder=await open(copy,'wx',0o600);await placeholder.close();
  db=new DatabaseSync(sourceFile,{readOnly:true});db.exec('PRAGMA busy_timeout=5000;BEGIN');db.prepare('SELECT count(*) n FROM sqlite_schema').get();
  const pages=await backup(db,copy,{rate:100,...(typeof onProgress==='function'?{progress:onProgress}:{})});db.exec('COMMIT');db.close();db=null;await chmod(copy,0o600);
  const snapshot=new DatabaseSync(copy,{readOnly:true});let info;try{info=analyze(snapshot)}finally{snapshot.close()}
  const manifest={format:1,id:randomUUID(),createdAt:new Date().toISOString(),build,node:process.version,...info,file:'raid.sqlite',bytes:(await lstat(copy)).size,sha256:await checksum(copy),pages};
  await syncFile(copy);await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});await syncFile(join(target,'manifest.json'));await syncDirectory(target);await syncDirectory(dirname(target));await verifyBackup(target);return {directory:target,...manifest};
 }catch(error){if(db)try{db.close()}catch{}if(created)await rm(target,{recursive:true,force:true});throw error}
}
export async function restoreBackup({directory,destination,operator,raidPolicy}){
 if(typeof operator!=='string'||!/^[a-zA-Z0-9_.-]{1,64}$/.test(operator))fail('Supply an operator identifier');if(!['resume','abort'].includes(raidPolicy))fail('Choose raid policy resume or abort');
 const verified=await verifyBackup(directory),target=await outputPath(destination);let created=false,store;
 try{
  await mkdir(target,{mode:0o700});created=true;const file=join(target,'raid.sqlite');await copyFile(join(await realpath(directory),'raid.sqlite'),file,constants.COPYFILE_EXCL);await chmod(file,0o600);if(await checksum(file)!==verified.sha256)fail('Backup changed while restoring');
  // This is the verified private copy, never the live source. A restored lease
  // cannot belong to a live process here and must not block supported migrations.
  const copied=new DatabaseSync(file);try{copied.exec('DELETE FROM leases')}finally{copied.close()}
  store=new RaidStore(file);const result=store.transaction(()=>{
   const invalidatedSessions=store.db.prepare('DELETE FROM sessions').run().changes,invalidatedCodes=store.db.prepare('DELETE FROM recovery_codes').run().changes;
   store.db.prepare('DELETE FROM leases').run();store.db.prepare('UPDATE party_members SET ready=0').run();
   const aborted=raidPolicy==='abort'?store.recoverInterrupted():0;
   if(raidPolicy==='abort'){store.db.prepare('DELETE FROM raid_checkpoints').run();store.db.prepare("UPDATE inventory SET account=NULL,location='lost' WHERE location='raid'").run()}
   const details={backup:verified.id,sourceChecksum:verified.sha256,raidPolicy,aborted,invalidatedSessions,invalidatedCodes,schema:SCHEMA_VERSION};store.audit('operator:'+operator,'backup_restored',details);return details;
  });
  store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');const checks=analyze(store.db);store.close();store=null;await syncFile(file);await syncDirectory(target);
  const receipt={restoredAt:new Date().toISOString(),operator,...result,checks};await writeFile(join(target,'restore-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});await syncFile(join(target,'restore-receipt.json'));await syncDirectory(target);return {directory:target,...receipt};
 }catch(error){if(store)try{store.close()}catch{}if(created)await rm(target,{recursive:true,force:true});throw error}
}
