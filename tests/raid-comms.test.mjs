import {SCHEMA_VERSION} from '../server/schema.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RaidStore} from '../server/store.mjs';
import {RaidService} from '../server/raids.mjs';
import {RaidComms} from '../server/comms.mjs';
function setup(t){
 const store=new RaidStore();t.after(()=>store.close());let now=1000;const raids=new RaidService(store,{now:()=>now}),comms=new RaidComms(store,raids,{now:()=>now});
 const a=store.register('speaker_a','a long test password').id,b=store.register('speaker_b','a long test password').id,c=store.register('speaker_c','a long test password').id;
 for(const [i,id]of [a,b,c].entries())raids.deploy(id,{mapId:'relay',requestId:'voice_deploy_'+i,recovery:true});
 const player=id=>raids.byAccount.get(id);player(a).team=player(b).team='squad';player(a).x=player(b).x=0;player(a).z=0;player(b).z=10;player(c).x=0;player(c).z=12;
 const joinVoice=(id,scope='squad')=>comms.presence(id,{type:'join',clientId:'client_'+id,scope});
 return {store,raids,comms,a,b,c,player,joinVoice,time:value=>now=value};
}
test('voice requires mutual opt-in and each requested channel must be eligible',t=>{
 const {comms,a,b,c,joinVoice,player}=setup(t);assert.equal(comms.poll(a,'client_'+a).joined,false);joinVoice(a);assert.equal(comms.poll(a,'client_'+a).peers.length,0);joinVoice(b);joinVoice(c);
 assert.deepEqual(comms.poll(a,'client_'+a).peers.map(p=>p.id),[b]);
 joinVoice(a,'both');joinVoice(c,'proximity');assert.equal(comms.poll(a,'client_'+a).peers.find(p=>p.id===c).channel,'proximity');player(c).z=25;
 assert.ok(!comms.poll(a,'client_'+a).peers.some(p=>p.id===c));player(c).z=10;player(c).alive=false;assert.ok(!comms.poll(a,'client_'+a).peers.some(p=>p.id===c));
});
test('signaling authenticates both live session epochs, validates audio and stays out of durable records',t=>{
 const {comms,store,a,b,c,joinVoice}=setup(t);const aa=joinVoice(a),bb=joinVoice(b);joinVoice(c);
 const offer={type:'signal',clientId:'client_'+a,epoch:aa.epoch,target:b,targetEpoch:bb.epoch,kind:'offer',payload:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};
 assert.throws(()=>comms.signal(a,{...offer,epoch:'stale'}),/expired/);assert.throws(()=>comms.signal(a,{...offer,target:c}),/unavailable/);assert.throws(()=>comms.signal(a,{...offer,payload:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 111\r\n'}),/Only audio/);
 comms.signal(a,offer);const data=comms.poll(b,'client_'+b);assert.equal(data.signals.length,1);assert.equal(data.signals[0].from,a);assert.equal(comms.poll(c,'client_'+c).signals.length,0);assert.equal(comms.poll(b,'client_'+b,data.cursor).signals.length,0);
 assert.ok(!store.db.prepare('SELECT data FROM audit').all().some(row=>row.data.includes('UDP/TLS')));
});
test('voice expires and old tabs cannot renew or close a replacement session',t=>{
 const {comms,a,b,joinVoice,time}=setup(t);const first=joinVoice(a);joinVoice(b);assert.throws(()=>comms.presence(a,{type:'join',clientId:'another_tab',scope:'squad'}),/another tab/);
 time(1007);assert.equal(comms.poll(a,'client_'+a).joined,false);assert.throws(()=>comms.presence(a,{type:'renew',clientId:'client_'+a}),/expired/);
 const next=comms.presence(a,{type:'join',clientId:'another_tab',scope:'squad'});assert.notEqual(next.epoch,first.epoch);comms.presence(a,{type:'leave',clientId:'client_'+a});assert.equal(comms.poll(a,'another_tab').joined,true);
});
test('voice queues are bounded, expire, and cannot be delivered after proximity is lost',t=>{
 const {comms,a,c,joinVoice,time,player}=setup(t);const aa=joinVoice(a,'proximity'),cc=joinVoice(c,'proximity');
 const signal={clientId:'client_'+a,epoch:aa.epoch,target:c,targetEpoch:cc.epoch,kind:'candidate',payload:{candidate:'candidate:test',sdpMid:'0',sdpMLineIndex:0}};
 for(let i=0;i<64;i++)comms.signal(a,signal);assert.throws(()=>comms.signal(a,signal),/queue is full/);player(c).z=30;assert.equal(comms.poll(c,'client_'+c).signals.length,0);assert.throws(()=>comms.signal(a,signal),/unavailable/);time(1014);comms.prune();assert.equal(comms.messages.size,0);assert.equal(comms.presences.size,0);
});
test('mute and block stop negotiation immediately and reports are context-bound and deduplicated',t=>{
 const {comms,store,a,b,c,joinVoice}=setup(t);joinVoice(a);joinVoice(b);comms.social(a,{type:'mute',target:b});assert.equal(comms.poll(a,'client_'+a).peers.length,0);comms.social(a,{type:'unmute',target:b});assert.equal(comms.poll(a,'client_'+a).peers.length,1);comms.social(b,{type:'block',target:a});assert.equal(comms.poll(a,'client_'+a).peers.length,0);
 const report={type:'report',target:b,reason:'voice_abuse',detail:'Repeated abuse in this raid.'},one=comms.social(a,report),two=comms.social(a,report);assert.equal(one.reportId,two.reportId);assert.equal(store.db.prepare('SELECT count(*) n FROM player_reports').get().n,1);
 assert.throws(()=>comms.social(a,{...report,reason:'invented'}),/category/);assert.throws(()=>comms.social(a,{...report,detail:'x'.repeat(1001)}),/too long/);
 const stranger=store.register('stranger','a long test password').id;assert.throws(()=>comms.social(a,{...report,target:stranger}),/not in your/);assert.equal(comms.preferences(c).controls.length,0);
});
test('communication preferences and blocks survive a database restart without enabling voice',()=>{
 const dir=mkdtempSync(join(tmpdir(),'raid-comms-')),file=join(dir,'test.sqlite');let store=new RaidStore(file);
 try{const a=store.register('persist_a','a long test password').id,b=store.register('persist_b','a long test password').id;
  store.db.prepare('INSERT INTO comm_preferences VALUES(?,?)').run(a,'both');store.db.prepare('INSERT INTO comm_blocks VALUES(?,?,?)').run(a,b,'block');store.close();store=new RaidStore(file);
  const comms=new RaidComms(store,{byAccount:new Map()});assert.equal(comms.preferences(a).scope,'both');assert.equal(comms.preferences(a).controls[0].target,b);assert.equal(comms.poll(a,'old_client').joined,false);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
 }finally{store.close();rmSync(dir,{recursive:true,force:true})}
});
test('blocked accounts cannot rejoin a party through the party endpoint',t=>{
 const store=new RaidStore();t.after(()=>store.close());const a=store.register('party_a','a long test password').id,b=store.register('party_b','a long test password').id;
 const p=store.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});store.db.prepare('INSERT INTO comm_blocks VALUES(?,?,?)').run(a,b,'block');assert.throws(()=>store.party(b,{type:'join',code:p.id}),/unavailable/);
});
test('squad pings use authoritative aim, stay private, expire and respect cooldown and block',t=>{
 const {raids,store,a,b,c,player,time}=setup(t);player(a).yaw=0;player(a).pitch=0;
 assert.throws(()=>raids.action(a,{type:'ping',kind:'needAmmo',x:999,z:999,seq:1}),/Unknown action field/);raids.action(a,{type:'ping',kind:'needAmmo',seq:1});const first=raids.snapshot(a).pings[0];assert.equal(first.x,0);assert.equal(first.z,0);assert.equal(raids.snapshot(b).pings.length,1);assert.equal(raids.snapshot(c).pings.length,0);
 assert.throws(()=>raids.action(a,{type:'ping',kind:'danger',seq:2}),/Wait/);time(1003);raids.action(a,{type:'ping',kind:'danger',seq:3});const mark=raids.snapshot(b).pings.at(-1);assert.ok(Math.hypot(mark.x-player(a).x,mark.z-player(a).z)<=40);
 for(let i=0;i<4;i++){time(1006+i*3);raids.action(a,{type:'ping',kind:'needMed',seq:4+i})}assert.equal(raids.snapshot(b).pings.length,3);
 store.db.prepare('INSERT INTO comm_blocks VALUES(?,?,?)').run(b,a,'block');assert.equal(raids.snapshot(b).pings.length,0);time(1040);assert.equal(raids.snapshot(a).pings.length,0);
});
test('moderation tool reads reports locally and records operator review without altering evidence',async()=>{
 const {execFileSync}=await import('node:child_process');const dir=mkdtempSync(join(tmpdir(),'raid-moderation-')),file=join(dir,'test.sqlite');const store=new RaidStore(file);
 try{
  const a=store.register('report_a','a long test password').id,b=store.register('report_b','a long test password').id,party=store.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});store.party(b,{type:'join',code:party.id});
  const comms=new RaidComms(store,{byAccount:new Map()}),report=comms.social(a,{type:'report',target:b,reason:'other',detail:'Operator verification test'});
  const call=(...args)=>JSON.parse(execFileSync(process.execPath,['scripts/moderation.mjs',...args,'--db',file],{encoding:'utf8'}));
  assert.equal(call('list')[0].id,report.reportId);const before=call('show','--report',report.reportId);
  assert.equal(call('review','--report',report.reportId,'--status','reviewed','--operator','test_operator','--note','Review drill').status,'reviewed');const after=call('show','--report',report.reportId);
  assert.deepEqual(after.evidence,before.evidence);assert.equal(after.detail,before.detail);assert.equal(store.db.prepare("SELECT count(*) n FROM audit WHERE event='report_review'").get().n,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true})}
});
test('HTTP communication routes authenticate users and do not expose reports or operator tools',async t=>{
 const {once}=await import('node:events'),{createRaidServer}=await import('../server/main.mjs');const store=new RaidStore();const {server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.close();await once(server,'close');store.close()});
 const a=store.register('http_speaker','a long test password').id,b=store.register('http_friend','a long test password').id,party=store.party(a,{type:'create',mode:'duo',region:'local',mapId:'relay'});store.party(b,{type:'join',code:party.id});
 const cookie='raid_session='+store.login('http_speaker','a long test password').token,base='http://127.0.0.1:'+server.address().port;
 const post=(route,data,extra={})=>fetch(base+route,{method:'POST',headers:{cookie,'content-type':'application/json',...extra},body:JSON.stringify(data)});
 for(const path of ['/api/social','/api/voice'])assert.equal((await fetch(base+path)).status,401);
 assert.equal((await post('/api/voice',{type:'join',clientId:'http_client',scope:'squad'},{origin:'https://other.example'})).status,403);
 assert.equal((await post('/api/voice',{type:'join',clientId:'http_client',scope:'squad'})).status,200);
 const joined=await(await fetch(base+'/api/voice?clientId=http_client',{headers:{cookie}})).json();assert.equal(joined.joined,true);assert.equal(joined.peers.length,0);
 assert.equal((await post('/api/voice',{type:'join',clientId:'bad',scope:'squad'})).status,400);
 const reported=await post('/api/social',{type:'report',target:b,reason:'other',detail:'<svg onload=alert(1)> is stored as text'});assert.equal(reported.status,200);assert.ok((await reported.json()).reportId);
 for(const path of ['/api/reports','/scripts/moderation.mjs'])assert.equal((await fetch(base+path,{headers:{cookie}})).status,404);
 assert.equal((await fetch(base+'/raid-privacy.html')).status,200);
});
