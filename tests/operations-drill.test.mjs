import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {SCHEMA_VERSION} from '../server/schema.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,rmSync,existsSync,statSync,readFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBackup,restoreBackup,verifyBackup} from '../server/backup.mjs';
import {controlRequest} from '../server/control.mjs';
const execute=promisify(execFile);
async function launch(data){
 const child=spawn(process.execPath,['server/main.mjs'],{env:{...process.env,RAID_DATA_DIR:data,HOST:'127.0.0.1',PORT:'0',RAID_BUILD_ID:'restore-drill'},stdio:['ignore','pipe','pipe']});let output='',errors='';let exited;
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{exited={code,signal};resolve(exited)}));child.stderr.on('data',chunk=>{errors+=chunk.toString().slice(0,1000)});
 const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Drill service startup timed out'))},10000);child.once('error',error=>{clearTimeout(timeout);reject(error)});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Drill service exited during startup: '+errors))});child.stdout.on('data',chunk=>{output+=chunk.toString();const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(match[0])}})});
 return {child,url,exit,get exited(){return exited},get errors(){return errors},async stop(signal='SIGTERM'){if(!exited)child.kill(signal);const result=await exit;return result}};
}
test('process drill backs up a live WAL, survives a crash, restores owned state and drains/restarts cleanly',async t=>{
 const root=mkdtempSync(join(process.platform==='darwin'?'/tmp':tmpdir(),'hs-drill-')),source=join(root,'source'),bundle=join(root,'backup'),target=join(root,'restored'),children=[];
 t.after(async()=>{for(const process of children)if(!process.exited)await process.stop('SIGKILL');rmSync(root,{recursive:true,force:true})});
 let running=await launch(source);children.push(running);let cookie,actor;
 const request=async(path,data,auth=cookie)=>{if(path==='/api/deploy')data={...data,protocol:RAID_PROTOCOL};if(path==='/api/action')data={...data,protocol:RAID_PROTOCOL,raidId:actor.raidId,deploymentId:actor.self.deploymentId};const response=await fetch(running.url+path,{method:data?'POST':'GET',headers:{...(data?{'content-type':'application/json'}:{}),...(auth?{cookie:auth}:{})},body:data?JSON.stringify(data):undefined});const value=await response.json();if((path==='/api/deploy'||path==='/api/raid')&&response.ok)actor=value;return {response,data:value}};
 let result=await request('/api/register',{username:'drill_operator',password:'a long process drill password'},null);assert.equal(result.response.status,200);cookie=result.response.headers.get('set-cookie').split(';')[0];const account=(await request('/api/profile')).data,weapon=account.items[0].id;
 const codes=(await request('/api/recovery-codes',{currentPassword:'a long process drill password'})).data.codes;assert.equal(codes.length,8);
 result=await request('/api/deploy',{requestId:'process_drill_deploy',mapId:'relay',itemIds:[weapon]});assert.equal(result.response.status,200);assert.equal((await request('/api/action',{type:'fire',seq:1})).response.status,200);assert.equal((await request('/api/raid')).data.self.ammo,29);
 for(const suffix of ['', '-wal','-shm'])assert.equal(statSync(join(source,'raid.sqlite')+suffix).mode&0o777,0o600);
 const backup=await createBackup({source:join(source,'raid.sqlite'),destination:bundle,build:'restore-drill'});assert.equal((await verifyBackup(bundle)).counts.activeDeployments,1);await new Promise(resolve=>setTimeout(resolve,200));assert.equal((await request('/api/action',{type:'fire',seq:2})).response.status,200);assert.equal((await request('/api/raid')).data.self.ammo,28);
 assert.equal((await running.stop('SIGKILL')).signal,'SIGKILL');assert.equal(existsSync(join(source,'.ops/control.sock')),true,'crash leaves a stale control socket');
 const restored=await restoreBackup({directory:bundle,destination:target,operator:'restore_drill',raidPolicy:'resume'});assert.equal(restored.invalidatedSessions,1);assert.equal(restored.invalidatedCodes,8);
 running=await launch(target);children.push(running);assert.equal((await request('/api/profile')).response.status,401);assert.equal((await request('/api/recover',{username:'drill_operator',code:codes[0],newPassword:'another long drill password'},null)).response.status,401);
 result=await request('/api/login',{username:'drill_operator',password:'a long process drill password'},null);assert.equal(result.response.status,200);cookie=result.response.headers.get('set-cookie').split(';')[0];const raid=(await request('/api/raid')).data;assert.equal(raid.self.ammo,29);assert.equal(raid.self.equipment[0].id,weapon);assert.equal(raid.self.seq,1);assert.equal((await request('/api/action',{type:'fire',seq:1})).response.status,200);
 const socket=join(target,'.ops/control.sock');assert.equal((await controlRequest(socket,{command:'drain',operator:'restore_drill',reason:'deployment'})).activeOperators,1);assert.equal((await request('/health/ready',null,null)).response.status,503);assert.equal((await request('/api/action',{type:'move',x:0,z:0,yaw:0,seq:2})).response.status,200);
 const dashboard=join(root,'dashboard.html');await execute(process.execPath,['scripts/ops.mjs','dashboard','--socket',socket,'--out',dashboard]);const html=readFileSync(dashboard,'utf8');for(const secret of [cookie,'drill_operator','a long process drill password',codes[0]])assert.ok(!html.includes(secret));copyFileSync(dashboard,join(process.platform==='darwin'?'/tmp':tmpdir(),'headshotz-ops-dashboard.html'));
 assert.equal((await running.stop()).code,0);assert.equal(existsSync(socket),false);running=await launch(target);children.push(running);assert.equal((await request('/health/ready',null,null)).response.status,200);const resumed=(await request('/api/raid')).data;assert.equal(resumed.self.ammo,29);assert.equal(resumed.self.equipment[0].id,weapon);assert.equal((await request('/api/profile')).data.id,account.id);assert.equal((await request('/api/results')).data.length,0);assert.equal((await running.stop()).code,0);assert.equal(running.errors,'');assert.equal(backup.schema,SCHEMA_VERSION);
});
