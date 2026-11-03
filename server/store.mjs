import {rankProgress} from '../shared/raid-progression.mjs';
import {outcomeReason} from '../shared/raid-report.mjs';
import {stackPortion} from './raid-inventory.mjs';
import {compatibleStacks,recyclingQuote} from '../shared/raid-inventory.mjs';
import {grantBalance,spendCredits,awardCredits,bindGrant,canRecoverGrant,clearForeignGrantAmmo,repairCost} from '../shared/raid-grants.mjs';
import {matchPreferences} from '../shared/raid-matchmaking.mjs';
import {SCHEMA_VERSION} from './schema.mjs';
import {chmodSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {digest as hash,encodePassword,verifyPassword} from './credentials.mjs';
import {RuleError,requireRule,item} from './rules.mjs';
import {WEAPONS,MODS,UTILITIES,ARMOR,MEDICAL,armorStats,equipmentPrice,TRADERS,RECIPES,CONTRACTS,stashCapacity,maxStack,itemWeight,skuDefinition} from '../shared/raid-catalog.mjs';
import {ARTIFACTS,contractItemReserved} from '../shared/raid-sectors.mjs';

export {RuleError,item} from './rules.mjs';
const starter=account=>({credits:250,grantCredits:250,items:[item('weapon',{weapon:'ar'}),item('armor'),item('med'),item('med')].map(it=>bindGrant(it,account,true)),materials:{steel:0,wire:0,chem:0,fuel:0},upgrades:{stash:0,bay:0},revision:0});
const flatten=items=>items.flatMap(it=>[it,...flatten(it.attachments||[])]);

// All valuable mutations use one SQLite transaction, including the audit record.
// This service deliberately has no public endpoint accepting settlement/reward claims.
export class RaidStore {
 constructor(filename=':memory:'){
  this.db=new DatabaseSync(filename);this.depth=0;this.commitSerial=0;
  if(typeof filename==='string'&&filename!==':memory:')try{chmodSync(filename,0o600);for(const suffix of ['-wal','-shm'])if(existsSync(filename+suffix))chmodSync(filename+suffix,0o600)}catch(error){this.db.close();throw error}
  const version=this.db.prepare('PRAGMA user_version').get().user_version;
  if(version>SCHEMA_VERSION){this.db.close();throw new RuleError('Database schema is newer than this server')}
  if(version<SCHEMA_VERSION&&this.db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='leases'").get()&&this.db.prepare('SELECT 1 FROM leases WHERE expires>?').get(Date.now())){this.db.close();throw new RuleError('Stop the active simulation before migrating this database')}
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS deployments(id TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), request TEXT NOT NULL, active INTEGER NOT NULL, state TEXT NOT NULL, result TEXT, UNIQUE(account,request));
   CREATE UNIQUE INDEX IF NOT EXISTS active_deployment ON deployments(account) WHERE active=1;
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, account TEXT NOT NULL, event TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY, account TEXT REFERENCES accounts(id), location TEXT NOT NULL, deployment TEXT, payload TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS inventory_owner ON inventory(account,location);
   CREATE INDEX IF NOT EXISTS inventory_deployment ON inventory(deployment,location);
   CREATE TABLE IF NOT EXISTS raid_checkpoints(id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS leases(name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);`);
  this.db.exec(`CREATE TABLE IF NOT EXISTS parties(id TEXT PRIMARY KEY, leader TEXT NOT NULL REFERENCES accounts(id), settings TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS party_members(account TEXT PRIMARY KEY REFERENCES accounts(id), party TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE, ready INTEGER NOT NULL DEFAULT 0, loadout TEXT NOT NULL DEFAULT '{}');
   CREATE INDEX IF NOT EXISTS party_roster ON party_members(party);`);
  this.db.exec(`CREATE TABLE IF NOT EXISTS insurance(id TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), item TEXT NOT NULL, deployment TEXT NOT NULL, due INTEGER, status TEXT NOT NULL, premium INTEGER NOT NULL, UNIQUE(item,deployment));
   CREATE INDEX IF NOT EXISTS insurance_due ON insurance(status,due);`);
  if(version<2)this.transaction(()=>{
   for(const row of this.db.prepare('SELECT id,state FROM accounts').all()){
    const state=JSON.parse(row.state);
    for(const it of state.items||[])this.db.prepare('INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,?,?,?)').run(it.id,row.id,'stash',null,JSON.stringify(it));
    delete state.items;this.db.prepare('UPDATE accounts SET state=? WHERE id=?').run(JSON.stringify(state),row.id);
   }
   for(const row of this.db.prepare('SELECT id,account,state FROM deployments WHERE active=1').all())for(const it of JSON.parse(row.state).equipment){
    const exists=this.db.prepare('SELECT location FROM inventory WHERE id=?').get(it.id);
    requireRule(!exists,'Legacy deployment contains an item also present in a stash');
    this.db.prepare('INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,?,?,?)').run(it.id,row.account,'raid',row.id,JSON.stringify(it));
   }
   this.db.exec('PRAGMA user_version=2');
  });
  if(version<3)this.transaction(()=>{this.db.exec('ALTER TABLE inventory ADD COLUMN raid TEXT; CREATE INDEX inventory_raid ON inventory(raid,location); PRAGMA user_version=3;')});
  if(version<4)this.transaction(()=>{this.db.exec(`
   CREATE TABLE comm_preferences(account TEXT PRIMARY KEY REFERENCES accounts(id), scope TEXT NOT NULL DEFAULT 'squad');
   CREATE TABLE comm_blocks(account TEXT NOT NULL REFERENCES accounts(id), target TEXT NOT NULL REFERENCES accounts(id), mode TEXT NOT NULL, PRIMARY KEY(account,target));
   CREATE INDEX comm_block_target ON comm_blocks(target,account);
   CREATE TABLE player_reports(id TEXT PRIMARY KEY, reporter TEXT NOT NULL REFERENCES accounts(id), target TEXT NOT NULL REFERENCES accounts(id), context TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT NOT NULL, evidence TEXT NOT NULL, at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', UNIQUE(reporter,target,context,reason));
   CREATE INDEX reports_status ON player_reports(status,at);
   PRAGMA user_version=4;`)});
  if(version<5)this.transaction(()=>{
   this.db.exec(`ALTER TABLE sessions ADD COLUMN id TEXT; ALTER TABLE sessions ADD COLUMN created INTEGER; ALTER TABLE sessions ADD COLUMN seen INTEGER; ALTER TABLE sessions ADD COLUMN label TEXT;
    CREATE UNIQUE INDEX session_public_id ON sessions(id); CREATE INDEX session_owner ON sessions(account,expires);
    CREATE TABLE recovery_codes(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),code TEXT NOT NULL UNIQUE,created INTEGER NOT NULL,used INTEGER);
    CREATE INDEX recovery_owner ON recovery_codes(account,used);`);
   for(const s of this.db.prepare('SELECT token,expires FROM sessions').all())this.db.prepare('UPDATE sessions SET id=?,created=?,seen=?,label=? WHERE token=?').run(randomUUID(),s.expires-7*86400_000,s.expires-7*86400_000,'Existing session',s.token);
   this.db.exec('PRAGMA user_version=5');
  });
  // Version 6 fences older binaries from new quest-item and sector-content semantics.
  // Existing accounts, items, sessions and checkpoint policies need no rewriting.
  if(version<6)this.transaction(()=>{this.db.exec('PRAGMA user_version=6')});
  // New utility instances/effects must never be reinterpreted by older binaries.
  if(version<7)this.transaction(()=>{this.db.exec('PRAGMA user_version=7')});
  // Fence older binaries from ignoring persisted squad-size consent rules.
  if(version<8)this.transaction(()=>{this.db.exec('PRAGMA user_version=8')});
  if(version<9)this.transaction(()=>{this.db.exec('PRAGMA user_version=9')});
  if(version<10)this.transaction(()=>{this.db.exec('PRAGMA user_version=10')});
  if(version<11)this.transaction(()=>{this.db.exec('PRAGMA user_version=11')});
  if(version<12)this.transaction(()=>{if(version>0)this.audit('system','schema_migrated',{from:version,to:12});this.db.exec('PRAGMA user_version=12')});
 }
 close(){this.db.close()}
 transaction(fn){
  const nested=this.depth>0,name='raid_tx_'+this.depth;
  this.db.exec(nested?`SAVEPOINT ${name}`:'BEGIN IMMEDIATE');this.depth++;
  try{const result=fn();this.db.exec(nested?`RELEASE ${name}`:'COMMIT');if(!nested)this.commitSerial++;return result}
  catch(error){this.db.exec(nested?`ROLLBACK TO ${name}`:'ROLLBACK');if(nested)this.db.exec(`RELEASE ${name}`);throw error}
  finally{this.depth--}
 }
 audit(account,event,data){this.db.prepare('INSERT INTO audit(account,event,data,at) VALUES(?,?,?,?)').run(account,event,JSON.stringify(data),Date.now())}
 register(username,password){
  username=String(username||'').trim().toLowerCase();
  requireRule(/^[a-z0-9_]{3,24}$/.test(username),'Username must have 3–24 letters, numbers, or underscores',400);
  const encoded=encodePassword(password);
  return this.transaction(()=>{
   requireRule(!this.db.prepare('SELECT id FROM accounts WHERE username=?').get(username),'Username unavailable');
   const id=randomUUID(),state=starter(id);this.db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(id,username,encoded,'{}');this.save(id,state);
   this.audit(id,'account_created',{});return {id,username};
  });
 }
 login(username,password,label='Browser session'){
  const account=this.db.prepare('SELECT * FROM accounts WHERE username=?').get(String(username||'').trim().toLowerCase());
  requireRule(verifyPassword(password,account?.password),'Invalid username or password',401);
  return this.transaction(()=>this.issueSession(account.id,label));
 }
 issueSession(account,label='Browser session'){
  const now=Date.now();this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
  const old=this.db.prepare('SELECT token FROM sessions WHERE account=? ORDER BY created DESC,rowid DESC').all(account);for(const s of old.slice(19))this.db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);
  const token=randomBytes(32).toString('hex'),expires=now+7*86400_000,id=randomUUID(),safeLabel=String(label).replace(/[\x00-\x1f]/g,'').slice(0,80)||'Browser session';
  this.db.prepare('INSERT INTO sessions(token,account,expires,id,created,seen,label) VALUES(?,?,?,?,?,?,?)').run(hash(token),account,expires,id,now,now,safeLabel);
  this.audit(account,'session_started',{id,label:safeLabel});return {token,expires,account:this.db.prepare('SELECT id,username FROM accounts WHERE id=?').get(account)};
 }
 authenticate(token){const key=hash(token||''),now=Date.now(),s=this.db.prepare('SELECT account,seen FROM sessions WHERE token=? AND expires>?').get(key,now);requireRule(s,'Sign in required',401);if(s.seen<now-60000)this.db.prepare('UPDATE sessions SET seen=? WHERE token=?').run(now,key);return s.account}

 logout(token){this.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token||''))}
 profile(id){
  const row=this.db.prepare('SELECT id,username,state FROM accounts WHERE id=?').get(id);requireRule(row,'Unknown account',404);
  const active=this.db.prepare('SELECT id,state FROM deployments WHERE account=? AND active=1').get(id);
  const claims=this.db.prepare('SELECT i.id,i.item,i.due,i.status,i.premium,v.payload FROM insurance i LEFT JOIN inventory v ON v.id=i.item WHERE i.account=? ORDER BY i.rowid DESC LIMIT 30').all(id).map(({payload,...claim})=>{const it=payload?JSON.parse(payload):null;return {...claim,label:WEAPONS[it?.weapon]?.name||(it?.kind==='armor'?armorStats(it).name:'Equipment')}});
  const state=this.state(id);return {id:row.id,username:row.username,...state,sellValues:Object.fromEntries(state.items.map(it=>[it.id,this.value(it)])),overflow:this.db.prepare("SELECT payload FROM inventory WHERE account=? AND location='overflow'").all(id).map(it=>JSON.parse(it.payload)),insurance:claims,activeDeployment:active?{id:active.id,...JSON.parse(active.state)}:null};
 }
 state(id){const row=this.db.prepare('SELECT state FROM accounts WHERE id=?').get(id);requireRule(row,'Unknown account',404);const s=JSON.parse(row.state);return {...s,xp:s.xp||0,reputation:{outfitter:0,medic:0,engineer:0,...s.reputation},contracts:s.contracts||{},presets:s.presets||{},upgrades:{stash:0,bay:0,bench:0,...s.upgrades},items:this.db.prepare("SELECT payload FROM inventory WHERE account=? AND location='stash' ORDER BY rowid").all(id).map(it=>JSON.parse(it.payload))}}
 save(id,state){
  state.grantCredits=grantBalance(state);
  const ids=new Set(state.items.map(it=>it.id));requireRule(ids.size===state.items.length,'Duplicate stash items');
  for(const it of this.db.prepare("SELECT id FROM inventory WHERE account=? AND location='stash'").all(id))if(!ids.has(it.id))this.db.prepare("UPDATE inventory SET location='consumed',account=NULL WHERE id=?").run(it.id);
  for(const it of state.items){
   requireRule(canRecoverGrant(it,id),'Starter supplies belong to another operator');
   const existing=this.db.prepare('SELECT account,location FROM inventory WHERE id=?').get(it.id);
   requireRule(!existing||(existing.account===id&&existing.location==='stash'),'Item is not available in this stash');
   this.db.prepare("INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,'stash',NULL,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(it.id,id,JSON.stringify(it));
  }
  state.revision=(state.revision||0)+1;const {items,...metadata}=state;
  this.db.prepare('UPDATE accounts SET state=? WHERE id=?').run(JSON.stringify(metadata),id);
 }
 preflightLoadout(account,loadout={}){
  requireRule(loadout&&typeof loadout==='object'&&!Array.isArray(loadout),'Invalid ready loadout',400);
  const {itemIds=[],recovery=false,insureIds=[]}=loadout;
  requireRule(typeof recovery==='boolean','Invalid recovery selection',400);
  requireRule(Array.isArray(itemIds)&&itemIds.length<=8&&itemIds.every(id=>typeof id==='string')&&new Set(itemIds).size===itemIds.length,'Invalid equipment list',400);
  requireRule(Array.isArray(insureIds)&&insureIds.length<=3&&insureIds.every(id=>typeof id==='string')&&new Set(insureIds).size===insureIds.length,'Invalid insurance selection',400);
  requireRule(!this.db.prepare('SELECT id FROM deployments WHERE account=? AND active=1').get(account),'An account can enter only one raid at a time');
  requireRule(!this.db.prepare("SELECT id FROM inventory WHERE account=? AND location='overflow' LIMIT 1").get(account),'Resolve protected overflow storage before deploying again');
  const state=this.state(account);
  let equipment=[];
  if(recovery)requireRule(itemIds.length===0&&insureIds.length===0,'Recovery kits cannot include paid gear or insurance');
  else{
   equipment=itemIds.map(id=>state.items.find(it=>it.id===id));requireRule(equipment.every(Boolean),'Equipment is not owned or is already deployed');
   requireRule(equipment.filter(it=>it.kind==='weapon').length>=1&&equipment.filter(it=>it.kind==='weapon').length<=2,'Equip one or two weapons');
   requireRule(equipment.filter(it=>it.kind==='armor').length<=1,'Equip at most one armor item');
   requireRule(equipment.every(it=>['weapon','armor','med','key','ammo','mod','material','utility'].includes(it.kind)&&it.condition>0),'Broken or invalid equipment');
   requireRule(equipment.every(it=>Number.isSafeInteger(it.quantity)&&it.quantity>0&&it.quantity<=maxStack(it)),'Invalid equipment stack');
   requireRule(equipment.reduce((n,it)=>n+itemWeight(it),0)<=40,'Deployment weight limit exceeded');
  }
  const insured=insureIds.map(id=>equipment.find(it=>it.id===id&&['weapon','armor'].includes(it.kind)&&!it.recovery));
  requireRule(insured.every(Boolean),'Insurance requires owned deployed equipment');
  const premium=insured.reduce((sum,it)=>sum+Math.ceil(equipmentPrice(it)*.2),0);requireRule(state.credits>=premium,'Insufficient insurance credits');
  return {state,equipment,insured,premium};
 }
 deploy(account,{requestId,itemIds=[],recovery=false,insureIds=[]}={}){
  requireRule(typeof requestId==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(requestId),'Invalid deployment request ID',400);
  requireRule(Array.isArray(itemIds)&&itemIds.length<=8&&new Set(itemIds).size===itemIds.length,'Invalid equipment list',400);
  requireRule(Array.isArray(insureIds)&&insureIds.length<=3&&new Set(insureIds).size===insureIds.length,'Invalid insurance selection',400);
  return this.transaction(()=>{
   const old=this.db.prepare('SELECT * FROM deployments WHERE account=? AND request=?').get(account,requestId);
   if(old)return {id:old.id,active:!!old.active,...JSON.parse(old.state),result:old.result?JSON.parse(old.result):null};
   const {state,insured,premium,equipment:owned}=this.preflightLoadout(account,{itemIds,recovery,insureIds});
   const equipment=recovery?[item('weapon',{weapon:'ar',recovery:true}),item('med',{recovery:true})]:owned;
   if(!recovery)state.items=state.items.filter(it=>!itemIds.includes(it.id));
   const premiumGrant=spendCredits(state,premium);
   const id=randomUUID(),deployment={equipment,recovery,premium,premiumGrant,insureIds,created:Date.now()};
   for(const it of insured)this.db.prepare("INSERT INTO insurance VALUES(?,?,?,?,NULL,'covered',?)").run(randomUUID(),account,it.id,id,Math.ceil(equipmentPrice(it)*.2));
   for(const it of flatten(equipment))this.db.prepare("INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,'raid',?,?) ON CONFLICT(id) DO UPDATE SET location='raid',deployment=excluded.deployment").run(it.id,account,id,JSON.stringify(it));
   this.db.prepare('INSERT INTO deployments VALUES(?,?,?,?,?,?)').run(id,account,requestId,1,JSON.stringify(deployment),null);
   this.save(account,state);this.audit(account,'deployment_committed',{deployment:id,itemIds:equipment.map(it=>it.id),recovery});
   return {id,active:true,...deployment};
  });
 }
 // Only authoritative server simulation calls this method. Never expose it as a client API.
 settle(deploymentId,{outcome,items=[],credits=0,facts={},lostItems=[],reason=null,raid=null}={}){
  requireRule(['extract','death','timeout','disconnect','aborted'].includes(outcome),'Invalid outcome',400);
  requireRule(Number.isSafeInteger(credits)&&credits>=0,'Invalid rewards',400);
  return this.transaction(()=>{
   const row=this.db.prepare('SELECT * FROM deployments WHERE id=?').get(deploymentId);requireRule(row,'Unknown deployment',404);
   if(row.result)return JSON.parse(row.result);
   requireRule(new Set(items.map(it=>it.id)).size===items.length&&items.every(it=>typeof it.id==='string'&&it.quantity>0),'Invalid item settlement');
   const state=this.state(row.account),deployed=JSON.parse(row.state),balanceBefore={total:state.credits,starter:grantBalance(state)},xpBefore=state.xp;
   const returned=(outcome==='aborted'?deployed.equipment.filter(it=>!it.recovery&&this.db.prepare('SELECT location FROM inventory WHERE id=?').get(it.id)?.location==='raid'):items.filter(it=>!it.recovery)).map(it=>{const copy=clearForeignGrantAmmo(structuredClone(it),row.account),removed=(it.grantLoaded||0)-(copy.grantLoaded||0);if(removed>0)this.audit(row.account,'starter_ammo_removed',{itemId:it.id,rounds:removed,reason:'foreign_settlement'});return copy});
   const overflow=[];
   for(const it of returned){
    requireRule(canRecoverGrant(it,row.account),'Starter supplies belong to another operator');
    const existing=this.db.prepare('SELECT account,location FROM inventory WHERE id=?').get(it.id);
    requireRule(!existing||existing.location==='raid','Item already owned or consumed');
    requireRule(!state.items.some(x=>x.id===it.id),'Item already in stash');
    const location=state.items.length>=stashCapacity(state)?'overflow':'stash';if(location==='overflow')overflow.push(it.id);
    this.db.prepare('INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,?,NULL,?) ON CONFLICT(id) DO UPDATE SET account=excluded.account,location=excluded.location,deployment=NULL,raid=NULL,payload=excluded.payload').run(it.id,row.account,location,JSON.stringify(it));
    for(const child of flatten(it.attachments||[])){
     const old=this.db.prepare('SELECT location FROM inventory WHERE id=?').get(child.id);requireRule(!old||old.location==='raid','Attachment already owned or consumed');
     this.db.prepare("INSERT INTO inventory(id,account,location,deployment,payload) VALUES(?,?,'attached',?,?) ON CONFLICT(id) DO UPDATE SET account=excluded.account,location='attached',deployment=excluded.deployment,raid=NULL,payload=excluded.payload").run(child.id,row.account,it.id,JSON.stringify(child));
    }
    if(location==='stash')state.items.push(it);
   }
   if(outcome==='aborted'){awardCredits(state,(deployed.premium||0)-(deployed.premiumGrant||0));awardCredits(state,deployed.premiumGrant||0,{grant:true})}else awardCredits(state,credits);
   const xp=outcome==='aborted'?0:(outcome==='extract'?20:0)+Math.min(50,(facts.machines||0)*5+(facts.explorations||[]).length*3);
   state.xp+=xp;const previousContracts=structuredClone(state.contracts);this.applyContractFacts(state,facts);
   const contracts=Object.entries(state.contracts).filter(([id,p])=>p.progress>(previousContracts[id]?.progress||0)).map(([id,p])=>{const definition=CONTRACTS[id],stage=definition.stages[p.stage];return {id,name:definition.name,stage:p.stage,progress:p.progress,need:stage.need,delta:p.progress-(previousContracts[id]?.progress||0),requirementsMet:p.progress>=stage.need}});
   this.db.prepare("UPDATE insurance SET status=?,due=? WHERE deployment=? AND status='covered'").run(outcome==='aborted'?'not_needed':'pending',Date.now()+120000,deploymentId);
   for(const it of returned)this.db.prepare("UPDATE insurance SET status='not_needed' WHERE deployment=? AND item=? AND status='pending'").run(deploymentId,it.id);
   const insuranceAtSettlement=this.db.prepare('SELECT id,item,status,due,premium FROM insurance WHERE deployment=? AND account=? ORDER BY rowid').all(deploymentId,row.account).map(claim=>{const it=deployed.equipment.find(it=>it.id===claim.item);return {...claim,label:WEAPONS[it?.weapon]?.name||(it?.kind==='armor'?armorStats(it).name:'Equipment')}});
   const beforeRank=rankProgress(xpBefore),afterRank=rankProgress(state.xp),progression={xpBefore,xpAfter:state.xp,rankBefore:beforeRank.level,rankAfter:afterRank.level,rankName:afterRank.name,unlockedBlueprints:Object.values(RECIPES).filter(recipe=>recipe.rank>beforeRank.level&&recipe.rank<=afterRank.level).map(recipe=>recipe.name)};
   const result={progression,reportVersion:1,reason:outcomeReason(outcome,reason),raid,ledger:{scope:'settlement',before:balanceBefore,after:{total:state.credits,starter:grantBalance(state)},reward:outcome==='aborted'?0:credits,refund:outcome==='aborted'?(deployed.premium||0):0,refundStarter:outcome==='aborted'?(deployed.premiumGrant||0):0,premium:deployed.premium||0,premiumStarter:deployed.premiumGrant||0},insuranceAtSettlement,committedItems:structuredClone(deployed.equipment),id:randomUUID(),deploymentId,outcome,items:returned,overflow,lostItems:structuredClone(lostItems),credits:outcome==='aborted'?0:credits,insurancePremium:deployed.premium||0,refund:outcome==='aborted'?(deployed.premium||0):0,xp,facts,contracts,at:Date.now()};
   this.db.prepare('UPDATE deployments SET active=0,result=? WHERE id=?').run(JSON.stringify(result),deploymentId);
   this.save(row.account,state);this.audit(row.account,'raid_settled',result);return result;
  });
 }
 recoverInterrupted(retained=new Set()){
  const rows=this.db.prepare('SELECT id FROM deployments WHERE active=1').all();
  let count=0;for(const row of rows)if(!retained.has(row.id)){this.settle(row.id,{outcome:'aborted'});count++}
  return count;
 }
 acquireLease(owner,now=Date.now(),ttl=15000){return this.transaction(()=>{
  const lease=this.db.prepare("SELECT * FROM leases WHERE name='simulation'").get();requireRule(!lease||lease.owner===owner||lease.expires<=now,'Another simulation process owns this database');
  this.db.prepare("INSERT INTO leases VALUES('simulation',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires").run(owner,now+ttl);
 })}
 releaseLease(owner){this.db.prepare("DELETE FROM leases WHERE name='simulation' AND owner=?").run(owner)}
 loadRaids(){return this.db.prepare('SELECT payload FROM raid_checkpoints ORDER BY updated').all().map(r=>JSON.parse(r.payload))}
 checkpoint(raid){
  // Reuse statements and leave unchanged registry rows untouched. Every item is still
  // checked against canonical ownership in this transaction before it is checkpointed.
  const sql=this.checkpointStatements??={
   save:this.db.prepare('INSERT INTO raid_checkpoints VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated'),
   find:this.db.prepare('SELECT account,location,deployment,payload,raid FROM inventory WHERE id=?'),
   record:this.db.prepare("INSERT INTO inventory(id,account,location,deployment,payload,raid) VALUES(?,?,'raid',?,?,?) ON CONFLICT(id) DO UPDATE SET account=excluded.account,location='raid',deployment=excluded.deployment,payload=excluded.payload,raid=excluded.raid"),
   items:this.db.prepare("SELECT id FROM inventory WHERE raid=? AND location='raid'"),
   consume:this.db.prepare("UPDATE inventory SET location='consumed',account=NULL WHERE id=?")
  };
  sql.save.run(raid.id,JSON.stringify(raid),Date.now());
  const seen=new Set();
  const record=(it,account,deployment)=>{
   requireRule(!seen.has(it.id),'Duplicate item in active raid');seen.add(it.id);
   const old=sql.find.get(it.id);requireRule(!old||(old.location==='raid'&&(!old.raid||old.raid===raid.id)),'Raid item is already banked, consumed, or in another raid');
   const payload=JSON.stringify(it);if(!old||old.raid!==raid.id||old.account!==account||old.deployment!==deployment||old.payload!==payload)sql.record.run(it.id,account,deployment,payload,raid.id);
   for(const child of it.attachments||[])record(child,account,deployment);
  };
  for(const p of raid.players)if(p.alive||p.pending)for(const it of [...p.equipment,...p.pack,...p.secure,...(p.pending?.items||[])])record(it,p.account,p.deploymentId);
  for(const c of [...raid.caches,...raid.bags])for(const it of c.items)record(it,null,null);
  for(const it of sql.items.all(raid.id))if(!seen.has(it.id))sql.consume.run(it.id);
 }
 results(account){return this.db.prepare('SELECT result FROM deployments WHERE account=? AND result IS NOT NULL ORDER BY rowid DESC LIMIT 20').all(account).map(row=>JSON.parse(row.result))}
 partyFor(account){
  const row=this.db.prepare('SELECT p.* FROM parties p JOIN party_members m ON m.party=p.id WHERE m.account=?').get(account);if(!row)return null;
  return {id:row.id,leader:row.leader,...JSON.parse(row.settings),members:this.db.prepare('SELECT m.account,a.username,m.ready,m.loadout FROM party_members m JOIN accounts a ON a.id=m.account WHERE m.party=? ORDER BY m.rowid').all(row.id).map(m=>{const member={...m,ready:!!m.ready,loadout:JSON.parse(m.loadout)};if(member.ready)try{this.preflightLoadout(m.account,member.loadout)}catch(error){if(!(error instanceof RuleError))throw error;member.ready=false;member.readinessError=m.account===account?error.message:'Loadout needs review'}return member})};
 }
 party(account,action){return this.transaction(()=>{
  const current=this.partyFor(account);
  const active=id=>this.db.prepare('SELECT id FROM deployments WHERE account=? AND active=1').get(id);
  const revoking=action.type==='ready'&&action.ready===false;
  if(!revoking){requireRule(!active(account),'Return from your raid before changing parties');if(current)requireRule(current.members.every(m=>!active(m.account)),'Party is deployed')}
  if(action.type==='create'){
   requireRule(!current,'Leave your existing party first');requireRule(['solo','duo','trio'].includes(action.mode),'Choose solo, duo or trio');
   requireRule(typeof action.region==='string'&&/^[-a-zA-Z0-9_]{1,40}$/.test(action.region),'Choose a valid configured region');
   let match;try{match=matchPreferences(action.match)}catch(error){throw new RuleError(error.message,400)}
   const id=randomBytes(5).toString('hex').toUpperCase();
   this.db.prepare('INSERT INTO parties VALUES(?,?,?)').run(id,account,JSON.stringify({mode:action.mode,region:action.region,mapId:action.mapId||'relay',match}));
   this.db.prepare('INSERT INTO party_members(account,party) VALUES(?,?)').run(account,id);
  }else if(action.type==='configure'){
   requireRule(current&&current.leader===account,'Only the squad leader can change matching preferences');let match;try{match=matchPreferences(action.match)}catch(error){throw new RuleError(error.message,400)}const row=this.db.prepare('SELECT settings FROM parties WHERE id=?').get(current.id);this.db.prepare('UPDATE parties SET settings=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.settings),match}),current.id);this.db.prepare('UPDATE party_members SET ready=0 WHERE party=?').run(current.id);
  }else if(action.type==='join'){
   requireRule(!current,'Leave your existing party first');const row=this.db.prepare('SELECT * FROM parties WHERE id=?').get(String(action.code||'').toUpperCase());requireRule(row,'Party not found',404);
   const settings=JSON.parse(row.settings),members=this.db.prepare('SELECT account FROM party_members WHERE party=?').all(row.id);
   requireRule(members.every(m=>!this.db.prepare("SELECT 1 FROM comm_blocks WHERE mode='block' AND ((account=? AND target=?) OR (account=? AND target=?))").get(account,m.account,m.account,account)),'Party unavailable',403);
   requireRule(members.every(m=>!active(m.account)),'Party is deployed');requireRule(members.length<({solo:1,duo:2,trio:3}[settings.mode]),'Party is full');
   this.db.prepare('INSERT INTO party_members(account,party) VALUES(?,?)').run(account,row.id);
   this.db.prepare('UPDATE party_members SET ready=0 WHERE party=?').run(row.id);
  }else if(action.type==='leave'){
   requireRule(current,'Not in a party');this.db.prepare('DELETE FROM party_members WHERE account=?').run(account);
   const next=this.db.prepare('SELECT account FROM party_members WHERE party=? ORDER BY rowid LIMIT 1').get(current.id);
   if(!next)this.db.prepare('DELETE FROM parties WHERE id=?').run(current.id);
   else{if(current.leader===account)this.db.prepare('UPDATE parties SET leader=? WHERE id=?').run(next.account,current.id);this.db.prepare('UPDATE party_members SET ready=0 WHERE party=?').run(current.id)}
  }else if(action.type==='ready'){
   requireRule(current,'Create or join a party first');
   requireRule(typeof action.ready==='boolean','Invalid ready state',400);
   if(!action.ready)this.db.prepare('UPDATE party_members SET ready=0 WHERE account=?').run(account);
   else{this.preflightLoadout(account,action.loadout);const {itemIds=[],recovery=false,insureIds=[]}=action.loadout||{};
    this.db.prepare('UPDATE party_members SET ready=1,loadout=? WHERE account=?').run(JSON.stringify({itemIds,recovery,insureIds}),account)}
  }else throw new RuleError('Unknown party action',400);
  this.audit(account,'party_changed',{type:action.type});return this.partyFor(account);
 })}
 applyContractFacts(state,facts){
  for(const [id,progress]of Object.entries(state.contracts)){
   if(progress.completed)continue;const stage=CONTRACTS[id]?.stages[progress.stage];if(!stage)continue;
   if(stage.event==='explore'){
    const seen=new Set(progress.seen||[]);for(const name of facts.explorations||[])if(!stage.map||name.startsWith(stage.map+':'))seen.add(name);progress.seen=[...seen];progress.progress=Math.min(stage.need,seen.size);
   }else{const count={machine:stage.map?facts.mapMachines?.[stage.map]||0:facts.machines||0,extractArtifact:facts.artifacts?.[stage.artifact]||0,extractBoss:facts.extractBoss||0,extractKey:facts.extractKey||0,extractValuable:facts.extractValuable||0}[stage.event]||0;progress.progress=Math.min(stage.need,progress.progress+count)}
  }
 }
 claimLoot(itemId,account){for(const row of this.db.prepare("SELECT id FROM insurance WHERE item=? AND account<>? AND status IN ('covered','pending')").all(itemId,account))this.db.prepare("UPDATE insurance SET status='claimed_by_other' WHERE id=?").run(row.id)}
 processInsurance(now=Date.now()){
  return this.transaction(()=>{
   let count=0;
   for(const claim of this.db.prepare("SELECT * FROM insurance WHERE status='pending' AND due<=?").all(now)){
    const row=this.db.prepare('SELECT * FROM inventory WHERE id=?').get(claim.item);
    if(row?.location==='raid')continue;
    if(!row||row.location!=='lost'){this.db.prepare("UPDATE insurance SET status='unavailable' WHERE id=?").run(claim.id);continue}
    const s=this.state(claim.account),it=JSON.parse(row.payload);if(it.condition<=0||it.recovery){this.db.prepare("UPDATE insurance SET status='destroyed' WHERE id=?").run(claim.id);continue}
    const location=s.items.length<stashCapacity(s)?'stash':'overflow';
    this.db.prepare('UPDATE inventory SET account=?,location=?,deployment=NULL,raid=NULL WHERE id=?').run(claim.account,location,it.id);
    if(location==='stash')s.items.push(it);
    for(const child of flatten(it.attachments||[]))this.db.prepare("UPDATE inventory SET account=?,location='attached',deployment=?,raid=NULL WHERE id=?").run(claim.account,it.id,child.id);
    this.save(claim.account,s);this.db.prepare('UPDATE party_members SET ready=0 WHERE account=?').run(claim.account);this.db.prepare("UPDATE insurance SET status='returned' WHERE id=?").run(claim.id);this.audit(claim.account,'insurance_returned',{claim:claim.id,item:it.id,location});count++;
   }
   return count;
  });
 }
 market(account,now=Date.now()){
  const s=this.state(account),epoch=Math.floor(now/3600000);
  return Object.entries(TRADERS).map(([id,trader])=>({id,name:trader.name,description:trader.description,reputation:s.reputation[id],restockAt:(epoch+1)*3600000,
   stock:Object.entries(trader.stock).map(([sku,quantity])=>({sku,...skuDefinition(sku),packQuantity:skuDefinition(sku).quantity||1,quantity:Math.max(0,quantity-(s.stock?.[id]?.epoch===epoch?s.stock[id].bought[sku]||0:0)),price:Math.ceil(skuDefinition(sku).price*(1-Math.min(.2,s.reputation[id]*.01))),locked:s.reputation[id]<(trader.unlocks?.[sku]||0)}))}));
 }
 consumeMaterials(s,requirements,{earnedOnly=false}={}){
  const sources=s.items.filter(it=>it.kind==='material'&&(!earnedOnly||!it.grantOwner)).sort((a,b)=>Number(!!a.grantOwner)-Number(!!b.grantOwner));let bound=false;
  for(const [material,amount]of Object.entries(requirements))requireRule(sources.filter(it=>it.material===material).reduce((n,it)=>n+it.quantity,0)>=amount,'Missing '+(earnedOnly?'earned ':'')+material+' salvage');
  for(const [material,amount]of Object.entries(requirements)){let remaining=amount;for(const it of sources)if(it.material===material&&remaining>0){const n=Math.min(it.quantity,remaining);it.quantity-=n;remaining-=n;if(n&&it.grantOwner)bound=true}}
  s.items=s.items.filter(it=>it.quantity>0);return bound;
 }
 addItem(s,it){requireRule(s.items.length<stashCapacity(s),'Stash full; sell, recycle or expand storage');s.items.push(it)}
 value(it){return it.kind==='utility'?Math.floor((UTILITIES[it.utility]?.price||0)*.3)*(it.quantity||1):it.kind==='contract'?(ARTIFACTS[it.artifact]?.value||0):it.kind==='valuable'?(it.value||1):it.kind==='weapon'?Math.floor((WEAPONS[it.weapon]?.price||100)*.3):it.kind==='armor'?Math.floor(armorStats(it).price*.3):it.kind==='med'?Math.floor((MEDICAL[it.medical]?.price||25)*.2)*(it.quantity||1):it.kind==='mod'?Math.floor((MODS[it.mod]?.price||30)*.3):it.kind==='ammo'?Math.floor((it.quantity||1)*.1):Math.max(1,Math.floor((it.quantity||1)*(it.kind==='material'?2:5)))}
 trade(account,action){
  return this.transaction(()=>{
   const s=this.state(account);requireRule(!this.db.prepare('SELECT id FROM deployments WHERE account=? AND active=1').get(account),'Return from your raid before trading');
   if(action.expectedRevision!==undefined)requireRule(Number.isSafeInteger(action.expectedRevision)&&action.expectedRevision===s.revision,'Stash changed; review the refreshed balance and try again');
   if(['split','stack'].includes(action.type)){
    requireRule(Number.isSafeInteger(action.expectedRevision)&&action.expectedRevision===s.revision,'Stash changed; refresh before moving stacks');const source=s.items.find(it=>it.id===action.itemId);requireRule(source,'Item not owned');
    if(action.type==='split'){const child=stackPortion(source,action.quantity);requireRule(s.items.length<stashCapacity(s),'Stash full');source.quantity-=action.quantity;s.items.push(child);this.audit(account,'stash_transfer',{kind:'split',itemId:source.id,childId:child.id,quantity:child.quantity})}
    else{const target=s.items.find(it=>it.id===action.targetId);requireRule(compatibleStacks(source,target),'Incompatible stacks');requireRule(source.quantity+target.quantity<=maxStack(target),'Stack limit exceeded');const quantity=source.quantity;target.quantity+=quantity;target.favorite=!!(target.favorite||source.favorite);s.items=s.items.filter(it=>it!==source);this.audit(account,'stash_transfer',{kind:'stack',itemId:source.id,targetId:target.id,quantity})}
   }else if(action.type==='buy'){
    const trader=action.trader||'outfitter';requireRule(Object.hasOwn(TRADERS,trader),'Unknown trader');
    const offer=this.market(account).find(t=>t.id===trader).stock.find(it=>it.sku===action.sku);
    requireRule(offer&&offer.quantity>0&&!offer.locked,'Stock unavailable or reputation too low');requireRule(s.credits>=offer.price,'Insufficient credits');
    const {price,...definition}=skuDefinition(action.sku),grant=spendCredits(s,offer.price);this.addItem(s,bindGrant(item(definition.kind,definition),account,grant>0));
    s.stock||={};const epoch=Math.floor(Date.now()/3600000);if(s.stock[trader]?.epoch!==epoch)s.stock[trader]={epoch,bought:{}};
    s.stock[trader].bought[action.sku]=(s.stock[trader].bought[action.sku]||0)+1;s.reputation[trader]=Math.min(20,s.reputation[trader]+1);
   }else if(action.type==='sell'){
    const i=s.items.findIndex(it=>it.id===action.itemId&&!it.recovery);requireRule(i>=0,'Item not owned');const it=s.items[i];requireRule(!it.favorite||action.confirmFavorite===true,'Unfavorite this item before selling');
    requireRule(!contractItemReserved(s,it),'Contract item reserved: deliver it or complete its contract before selling');s.items.splice(i,1);awardCredits(s,this.value(it),{grant:!!it.grantOwner});
    for(const child of flatten(it.attachments||[]))this.db.prepare("UPDATE inventory SET location='consumed',account=NULL WHERE id=?").run(child.id);
   }else if(action.type==='bulkSell'){
    requireRule(Array.isArray(action.itemIds)&&action.itemIds.length>0&&action.itemIds.length<=64&&new Set(action.itemIds).size===action.itemIds.length,'Choose a valid item selection');
    const sold=action.itemIds.map(id=>s.items.find(it=>it.id===id&&!it.favorite&&!it.recovery));requireRule(sold.every(Boolean),'Selection contains unowned or favorited items');
    requireRule(sold.every(it=>!contractItemReserved(s,it)),'Selection contains reserved contract items');for(const it of sold){awardCredits(s,this.value(it),{grant:!!it.grantOwner});for(const child of flatten(it.attachments||[]))this.db.prepare("UPDATE inventory SET location='consumed',account=NULL WHERE id=?").run(child.id)}
    s.items=s.items.filter(it=>!action.itemIds.includes(it.id));
   }else if(action.type==='favorite'){
    const it=s.items.find(it=>it.id===action.itemId);requireRule(it,'Item not owned');it.favorite=!!action.favorite;
   }else if(action.type==='repair'){
    const it=s.items.find(it=>it.id===action.itemId&&['weapon','armor'].includes(it.kind));requireRule(it,'Equipment not owned');
    const cost=repairCost(s,it);requireRule(cost>0&&s.credits>=cost,'Repair unavailable');const bound=this.consumeMaterials(s,{steel:1}),grant=spendCredits(s,cost);if(bound||grant)it.grantOwner=account;it.condition=100;
   }else if(action.type==='craft'){
    requireRule(Object.hasOwn(RECIPES,action.recipe),'Unknown recipe');const recipe=RECIPES[action.recipe];requireRule(rankProgress(s.xp).level>=(recipe.rank||1),'Earn rank '+(recipe.rank||1)+' to unlock this blueprint');requireRule(s.upgrades.bench>=recipe.bench,'Upgrade the workbench for this recipe');requireRule(s.credits>=recipe.credits,'Insufficient credits');
    const bound=this.consumeMaterials(s,recipe.materials),grant=spendCredits(s,recipe.credits);this.addItem(s,bindGrant(item(recipe.output.kind,recipe.output),account,bound||grant>0));s.reputation.engineer=Math.min(20,s.reputation.engineer+1);
   }else if(action.type==='recycle'){
    const i=s.items.findIndex(it=>it.id===action.itemId&&!it.recovery&&!it.favorite);requireRule(i>=0,'Unfavorite an owned item before recycling');const it=s.items[i];
    requireRule(!contractItemReserved(s,it),'Contract item reserved: deliver it or complete its contract before recycling');const quote=recyclingQuote(it);requireRule(quote,'Item cannot be recycled; use salvage directly');requireRule(quote.quantity>0,'Need at least '+quote.batchSize+' rounds of this ammunition to recycle');
    if(quote.remaining)it.quantity=quote.remaining;else s.items.splice(i,1);
    for(const child of flatten(it.attachments||[]))this.db.prepare("UPDATE inventory SET location='consumed',account=NULL WHERE id=?").run(child.id);
    const output=bindGrant(item('material',{material:quote.material,quantity:quote.quantity}),account,!!it.grantOwner);this.addItem(s,output);this.audit(account,'item_recycled',{itemId:it.id,outputId:output.id,...quote});
   }else if(action.type==='upgrade'){
    requireRule(['stash','bay','bench'].includes(action.upgrade),'Unknown base upgrade');const level=s.upgrades[action.upgrade],max=action.upgrade==='stash'?3:2;
    requireRule(level<max,'Upgrade already at maximum');const cost=100+50*level;requireRule(s.credits>=cost,'Insufficient credits');this.consumeMaterials(s,{steel:2+level,wire:1});spendCredits(s,cost);s.upgrades[action.upgrade]++;
   }else if(action.type==='attach'){
    const weapon=s.items.find(it=>it.id===action.weaponId&&it.kind==='weapon'),mod=s.items.find(it=>it.id===action.itemId&&it.kind==='mod');requireRule(weapon&&mod,'Weapon or attachment not owned');
    const def=MODS[mod.mod];requireRule(def?.classes.includes(WEAPONS[weapon.weapon]?.class),'Incompatible attachment');weapon.attachments||=[];requireRule(!weapon.attachments.some(it=>MODS[it.mod]?.slot===def.slot),'Attachment slot occupied');
    if(mod.grantOwner)weapon.grantOwner=account;weapon.attachments.push(mod);s.items=s.items.filter(it=>it!==mod);this.db.prepare("UPDATE inventory SET location='attached',deployment=? WHERE id=?").run(weapon.id,mod.id);
   }else if(action.type==='detach'){
    const weapon=s.items.find(it=>it.id===action.weaponId&&it.kind==='weapon'),index=weapon?.attachments?.findIndex(it=>it.id===action.itemId);requireRule(index>=0,'Attachment not owned');
    const [mod]=weapon.attachments.splice(index,1);this.addItem(s,mod);this.db.prepare("UPDATE inventory SET location='stash',deployment=NULL WHERE id=? AND account=?").run(mod.id,account);
   }else if(action.type==='claimOverflow'){
    const row=this.db.prepare("SELECT payload FROM inventory WHERE id=? AND account=? AND location='overflow'").get(action.itemId,account);requireRule(row,'Item not in overflow storage');const it=JSON.parse(row.payload);this.addItem(s,it);this.db.prepare("UPDATE inventory SET location='stash' WHERE id=?").run(it.id);
   }else if(action.type==='contract'){
    requireRule(Object.hasOwn(CONTRACTS,action.contract),'Unknown contract');const id=action.contract,definition=CONTRACTS[id];
    if(action.operation==='accept'){requireRule(!s.contracts[id],'Contract already accepted');s.contracts[id]={stage:0,progress:0,completed:false}}
    else{
     const progress=s.contracts[id];requireRule(progress&&!progress.completed,'No active contract');const stage=definition.stages[progress.stage];
     if(action.operation==='deliver'){
      requireRule(progress.progress<stage.need,'Delivery already complete');
      if(stage.event==='deliverSteel')this.consumeMaterials(s,{steel:stage.need-progress.progress},{earnedOnly:true});
      else if(stage.event==='deliverArtifact'){
       const artifact=ARTIFACTS[stage.artifact],owned=s.items.filter(it=>it.kind==='contract'&&it.artifact===stage.artifact&&it.originMap===artifact?.map&&typeof it.originRaid==='string');requireRule(owned.length>=stage.need-progress.progress,'Missing recovered '+(artifact?.name||'contract item'));
       const delivered=new Set(owned.slice(0,stage.need-progress.progress).map(it=>it.id));s.items=s.items.filter(it=>!delivered.has(it.id));
      }else throw new RuleError('This contract does not accept deliveries');progress.progress=stage.need;
     }
     else if(action.operation==='claim'){
      requireRule(progress.progress>=stage.need,'Contract requirements not met');s.credits+=stage.reward;s.xp+=stage.xp;s.reputation[definition.trader]=Math.min(20,s.reputation[definition.trader]+2);
      progress.stage++;progress.progress=0;progress.seen=[];progress.completed=progress.stage>=definition.stages.length;
     }else throw new RuleError('Unknown contract operation',400);
    }
   }else if(action.type==='preset'){
    requireRule(typeof action.name==='string'&&/^[a-zA-Z0-9 _-]{1,32}$/.test(action.name),'Invalid preset name');
    requireRule(Array.isArray(action.itemIds)&&action.itemIds.length<=8&&action.itemIds.every(id=>s.items.some(it=>it.id===id&&it.kind!=='contract')),'Preset items must be deployable items in your stash');requireRule(Object.keys(s.presets).length<12||Object.hasOwn(s.presets,action.name),'At most twelve presets');Object.defineProperty(s.presets,action.name,{value:action.itemIds,enumerable:true,configurable:true,writable:true});
   }else throw new RuleError('Unknown trade action',400);
   this.save(account,s);if(!['favorite','contract','preset'].includes(action.type)||(action.type==='contract'&&action.operation==='deliver'))this.db.prepare('UPDATE party_members SET ready=0 WHERE account=?').run(account);
   const auditFields=['type','sku','trader','itemId','itemIds','weaponId','recipe','upgrade','contract','operation','favorite','name','quantity','targetId','expectedRevision'];
   this.audit(account,'trade',Object.fromEntries(auditFields.filter(key=>action[key]!==undefined).map(key=>[key,action[key]])));return s;
  });
 }
}
