import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {RELEASE_FILES,buildRelease,verifyRelease,releaseEnvironment} from '../scripts/lib/release.mjs';
async function fixture(t){const root=await mkdtemp('/tmp/hs-rlt-'),source=join(root,'source');t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(source);for(const path of RELEASE_FILES){await mkdir(join(source,path,'..'),{recursive:true});await writeFile(join(source,path),path.endsWith('.json')?'{}':'// fixture\n')}for(const path of ['assets/tex/fixture.jpg','icons/fixture.png','lib/fixture.js','server/main.mjs','shared/fixture.mjs']){await mkdir(join(source,path,'..'),{recursive:true});await writeFile(join(source,path),'fixture')}return {root,source,output:join(root,'candidate')}}
test('release inventory excludes personal/development data and reproduces identical builds',async t=>{
 const f=await fixture(t);for(const path of ['.env','.raid-data/raid.sqlite','shots/old.png','tests/private.json','credentials.json','assets/.DS_Store','assets/tex/private.key']){await mkdir(join(f.source,path,'..'),{recursive:true});await writeFile(join(f.source,path),'private fixture sentinel')}
 const a=await buildRelease({source:f.source,destination:f.output}),b=await buildRelease({source:f.source,destination:join(f.root,'second')});assert.equal(a.id,b.id);assert.equal(a.bytes,b.bytes);const m=await verifyRelease({root:a.path,expectedId:a.id});assert.equal(m.files.length,a.files);assert.ok(m.files.some(e=>e.path==='server/main.mjs'));assert.ok(m.files.some(e=>e.path==='game.js'));assert.ok(!JSON.stringify(m).includes('private'));assert.ok(!m.files.some(e=>e.path.includes('shots')||e.path.startsWith('.')));
});
test('builder never overwrites a destination or writes into the source',async t=>{
 const f=await fixture(t);await mkdir(f.output);await writeFile(join(f.output,'sentinel'),'keep');await assert.rejects(buildRelease({source:f.source,destination:f.output}),/EEXIST/);assert.equal(await readFile(join(f.output,'sentinel'),'utf8'),'keep');await assert.rejects(buildRelease({source:f.source,destination:join(f.source,'candidate')}),/separate/);
});
test('concurrent source edits abort the candidate and preserve the edited source',async t=>{
 const f=await fixture(t),file=join(f.source,'game.js');let edits=0;const writer=setInterval(()=>writeFileSync(file,'// concurrent edit '+(++edits)+'\n'),1);
 try{await assert.rejects(buildRelease({source:f.source,destination:f.output}),/Source changed/)}finally{clearInterval(writer)}
 assert.ok(edits>0);assert.match(await readFile(file,'utf8'),/concurrent edit/);await assert.rejects(readFile(join(f.output,'release.json')));
});
test('runtime symlinks, linked parents and hardlinks are refused before copying data',async t=>{
 const f=await fixture(t),file=join(f.source,'assets/tex/fixture.jpg'),outside=join(f.root,'outside');await writeFile(outside,'private');await unlink(file);await symlink(outside,file);await assert.rejects(buildRelease({source:f.source,destination:f.output}),/links/);await unlink(file);await link(outside,file);await assert.rejects(buildRelease({source:f.source,destination:f.output}),/independent regular files/);await unlink(file);await writeFile(file,'fixture');await rm(join(f.source,'server'),{recursive:true});await mkdir(join(f.root,'linked-server'));await symlink(join(f.root,'linked-server'),join(f.source,'server'));await assert.rejects(buildRelease({source:f.source,destination:f.output}),/real directories/);
});
test('new relative module and CSS dependencies must be deliberately packaged',async t=>{
 const f=await fixture(t);await writeFile(join(f.source,'game.js'),"import './forgotten-module.js';");await assert.rejects(buildRelease({source:f.source,destination:f.output}),/Missing packaged reference/);await writeFile(join(f.source,'game.js'),'// fixture');await writeFile(join(f.source,'style.css'),'body{background:url(assets/tex/missing.jpg)}');await assert.rejects(buildRelease({source:f.source,destination:f.output}),/Missing packaged reference/);
});
test('root-relative browser links resolve within the release',async t=>{
 const f=await fixture(t);await writeFile(join(f.source,'raid-online.html'),'<a href="/">Base</a><script type="module" src="/raid-online.mjs?version=1"></script>');const a=await buildRelease({source:f.source,destination:f.output});assert.equal((await verifyRelease({root:a.path,expectedId:a.id})).id,a.id);
});
test('verification rejects altered, missing and extra contents, changed metadata and wrong pinned identity',async t=>{
 const f=await fixture(t),a=await buildRelease({source:f.source,destination:f.output}),file=join(a.path,'game.js'),original=await readFile(file),manifest=join(a.path,'release.json'),originalManifest=await readFile(manifest);await assert.rejects(verifyRelease({root:a.path,expectedId:'0'.repeat(64)}),/identity mismatch/);
 await writeFile(file,'changed');await assert.rejects(verifyRelease({root:a.path}),/contents/);await rm(file);await assert.rejects(verifyRelease({root:a.path}),/ENOENT/);await writeFile(file,original);await writeFile(join(a.path,'.env'),'private');await assert.rejects(verifyRelease({root:a.path}),/Unexpected release file/);await unlink(join(a.path,'.env'));
 const m=JSON.parse(originalManifest);m.label='substituted';await writeFile(manifest,JSON.stringify(m));await assert.rejects(verifyRelease({root:a.path}),/identity mismatch/);await writeFile(manifest,originalManifest);await mkdir(join(a.path,'data'));await assert.rejects(verifyRelease({root:a.path}),/Unexpected release directory/);
});
test('manifest traversal and substitution links are rejected without touching outside data',async t=>{
 const f=await fixture(t),a=await buildRelease({source:f.source,destination:f.output}),outside=join(f.root,'outside');await writeFile(outside,'keep');const file=join(a.path,'game.js');await unlink(file);await symlink(outside,file);await assert.rejects(verifyRelease({root:a.path}),/link/);await unlink(file);await writeFile(file,'// fixture\n');const m=JSON.parse(await readFile(join(a.path,'release.json'),'utf8'));m.files[0].path='../outside';await writeFile(join(a.path,'release.json'),JSON.stringify(m));await assert.rejects(verifyRelease({root:a.path}),/Invalid release file inventory/);assert.equal(await readFile(outside,'utf8'),'keep');
});
test('release startup validates separate saves and settings and does not forward unrelated credentials/loaders',async t=>{
 const f=await fixture(t),a=await buildRelease({source:f.source,destination:f.output}),m=await verifyRelease({root:a.path}),base={RAID_DATA_DIR:join(f.root,'data'),GITHUB_TOKEN:'fixture-not-a-real-token',NODE_OPTIONS:'--require /untrusted.js',RAID_BUILD_ID:'wrong'};const env=await releaseEnvironment(a.path,m,base);assert.equal(env.GITHUB_TOKEN,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.RAID_BUILD_ID,a.id);assert.equal(env.HOST,'127.0.0.1');
 await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_DATA_DIR:join(a.path,'data')}),/separate/);await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_DATA_DIR:'relative'}),/absolute/);await assert.rejects(releaseEnvironment(a.path,m,{...base,PORT:'99999'}),/port/);await assert.rejects(releaseEnvironment(a.path,m,{...base,HOST:'0.0.0.0'}),/secure cookies/);assert.equal((await releaseEnvironment(a.path,m,{...base,HOST:'0.0.0.0',RAID_SECURE_COOKIES:'1'})).RAID_SECURE_COOKIES,'1');await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_ICE_SERVERS:'not-json-secret-fixture'}),error=>error.message==='Invalid voice relay configuration');await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_ICE_SERVERS:JSON.stringify([{urls:null}])}),/voice/);
 const longParent=join(f.root,'x'.repeat(75));await mkdir(longParent);await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_DATA_DIR:join(longParent,'data')}),/too long/);
 assert.equal(env.RAID_MAX_OPERATORS,'27');assert.equal((await releaseEnvironment(a.path,m,{...base,RAID_MAX_OPERATORS:'9'})).RAID_MAX_OPERATORS,'9');
 for(const value of ['0','-1','1.5','1025','','Infinity','invalid-private-value'])await assert.rejects(releaseEnvironment(a.path,m,{...base,RAID_MAX_OPERATORS:value}),e=>e.message==='Invalid host operator limit');
});
