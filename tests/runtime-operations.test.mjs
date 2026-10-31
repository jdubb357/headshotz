import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {startControlSocket,controlRequest} from '../server/control.mjs';
const execute=promisify(execFile);
async function setup(t){const store=new RaidStore(),runtime=createRaidServer(store,{build:'ops-test'});runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');const base='http://127.0.0.1:'+runtime.server.address().port;t.after(async()=>{runtime.server.close();await once(runtime.server,'close');store.close()});return {store,...runtime,base}}
test('public health checks reveal minimal status and reflect draining or simulation failure',async t=>{
 const {store,operations,base}=await setup(t);assert.deepEqual(await(await fetch(base+'/health/live')).json(),{status:'alive'});assert.deepEqual(await(await fetch(base+'/health/ready')).json(),{status:'ready'});
 operations.setDraining(true,{operator:'test',reason:'maintenance'});assert.equal((await fetch(base+'/health/ready')).status,503);assert.deepEqual(await(await fetch(base+'/health/ready')).json(),{status:'not_ready'});operations.setDraining(false,{operator:'test'});operations.tick(1,true);assert.equal(operations.ready(),false);operations.tick(1,false);assert.equal(operations.ready(),false,'an idle tick cannot prove failed writes recovered');store.transaction(()=>store.audit('operator:test','durability_probe',{}));operations.tick(1,false);assert.equal(operations.ready(),true);
});
test('drain rejects new deployments without debiting gear, but active retry/actions/extraction continue',async t=>{
 const {store,raids,operations,base}=await setup(t),a=store.register('drain_a','a long drain password'),b=store.register('drain_b','a long drain password'),aa=store.login(a.username,'a long drain password'),bb=store.login(b.username,'a long drain password');
 const post=(path,data,auth)=>fetch(base+'/api/'+path,{method:'POST',headers:{cookie:'raid_session='+auth.token,'content-type':'application/json'},body:JSON.stringify(path==='deploy'?{...data,protocol:RAID_PROTOCOL}:path==='action'?{...data,protocol:RAID_PROTOCOL,raidId:raids.byAccount.get(a.id).raidId,deploymentId:raids.byAccount.get(a.id).deploymentId}:data)});
 const request={requestId:'drain_existing',mapId:'relay',recovery:true};assert.equal((await post('deploy',request,aa)).status,200);const before=store.profile(b.id);operations.setDraining(true,{operator:'test',reason:'deployment'});assert.equal((await post('deploy',{requestId:'drain_new',mapId:'relay',itemIds:[before.items[0].id]},bb)).status,503);assert.deepEqual(store.profile(b.id),before);assert.equal((await post('deploy',request,aa)).status,200);assert.equal((await post('action',{type:'move',x:0,z:0,yaw:0,seq:1},aa)).status,200);
 const p=raids.byAccount.get(a.id),raid=raids.raids.get(p.raidId);raids.end(raid,p,'extract');assert.equal(store.results(a.id)[0].outcome,'extract');operations.setDraining(false,{operator:'test'});assert.equal((await post('deploy',{requestId:'drain_new',mapId:'relay',recovery:true},bb)).status,200);
});
test('operation metrics normalize arbitrary paths and exclude credentials, usernames and queries',async t=>{
 const {store,operations,base}=await setup(t),a=store.register('private_metric_user','a long metric password'),auth=store.login(a.username,'a long metric password');await fetch(base+'/api/profile?private=must-not-appear',{headers:{cookie:'raid_session='+auth.token}});for(let i=0;i<8;i++)await fetch(base+'/api/unknown'+i+'?private=secret');await fetch(base+'/api/profile');await new Promise(r=>setTimeout(r,10));const status=operations.summary(),text=JSON.stringify(status);assert.ok(status.requests>=10);assert.ok(status.http.length<8);for(const secret of ['must-not-appear','private_metric_user',auth.token,'unknown1'])assert.ok(!text.includes(secret));assert.ok(status.http.some(m=>m.route==='other_api'&&m.count>=8));assert.ok(status.http.some(m=>m.route==='/api/profile'&&m.statusGroup==='4xx'));
});
test('private simulation metrics distinguish fast work from delayed tick scheduling',async t=>{
 const {operations}=await setup(t);operations.tick(2,false,180);const status=operations.summary();assert.equal(status.tick.p95Ms,5);assert.equal(status.tickInterval.p95Ms,250);assert.ok(status.alerts.includes('tick_interval_p95_over_75ms'));assert.ok(status.memory.rss>0);assert.ok(status.cpu.user>=0);
});
test('private control socket supports audited lifecycle/status and refuses unsafe or active paths',async t=>{
 const {store,operations}=await setup(t),root=mkdtempSync(join(process.platform==='darwin'?'/tmp':tmpdir(),'hs-control-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const path=join(root,'private','control.sock'),control=await startControlSocket({path,operations});
 try{assert.equal(statSync(path).mode&0o777,0o600);assert.equal((await controlRequest(path,{command:'status'})).build,'ops-test');assert.equal((await controlRequest(path,{command:'drain',operator:'operator',reason:'deployment'})).draining,true);assert.equal(store.db.prepare("SELECT count(*) n FROM audit WHERE event='server_draining'").get().n,1);assert.equal((await controlRequest(path,{command:'resume',operator:'operator'})).draining,false);await assert.rejects(controlRequest(path,{command:'destroy_database'}),/Unknown/);await assert.rejects(startControlSocket({path,operations}),/active/)}finally{await control.close()}assert.equal(existsSync(path),false);
 const unsafe=join(root,'public');mkdirSync(unsafe,{mode:0o755});await assert.rejects(startControlSocket({path:join(unsafe,'control.sock'),operations}),/private/);const file=join(root,'private','keep');writeFileSync(file,'keep');await assert.rejects(startControlSocket({path:file,operations}),/replace/);assert.equal(readFileSync(file,'utf8'),'keep');
});
test('operations CLI reads local status and writes a secret-free snapshot without overwriting output',async t=>{
 const {operations}=await setup(t),root=mkdtempSync(join(process.platform==='darwin'?'/tmp':tmpdir(),'hs-dashboard-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const path=join(root,'control.sock'),control=await startControlSocket({path,operations});
 try{const out=join(root,'ops.html');const result=await execute(process.execPath,['scripts/ops.mjs','dashboard','--socket',path,'--out',out]);assert.ok(JSON.parse(result.stdout).file.endsWith('ops.html'));assert.match(readFileSync(out,'utf8'),/HeadShotz operations snapshot/);assert.equal(statSync(out).mode&0o777,0o600);await assert.rejects(execute(process.execPath,['scripts/ops.mjs','dashboard','--socket',path,'--out',out]));await assert.rejects(execute(process.execPath,['scripts/ops.mjs','drain','--socket',path]));assert.equal(operations.draining,false)}finally{await control.close()}
});
test('drain still fences admission if audit storage fails, and resume requires a successful audit',async t=>{
 const {store,operations}=await setup(t),audit=store.audit;store.audit=()=>{throw new Error('storage unavailable')};
 const result=operations.setDraining(true,{operator:'test',reason:'incident'});assert.equal(result.draining,true);assert.equal(result.lifecycleAuditFailed,true);assert.equal(operations.ready(),false);assert.throws(()=>operations.setDraining(false,{operator:'test'}),/audited/);assert.equal(operations.draining,true);
 store.audit=audit;operations.setDraining(true,{operator:'test',reason:'incident'});assert.equal(operations.summary().lifecycleAuditFailed,false);operations.setDraining(false,{operator:'test'});assert.equal(operations.ready(),true);
});
