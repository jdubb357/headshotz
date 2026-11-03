import {createHash} from 'node:crypto';
import {mkdir,lstat,readdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {resolve,relative,dirname,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCHEMA_VERSION} from '../../server/schema.mjs';
import {RAID_PROTOCOL} from '../../shared/raid-protocol.mjs';
export const SOURCE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
// Deliberate runtime inventory. New entry points must be reviewed here rather
// than allowing arbitrary root files, credentials or developer exports through.
export const RELEASE_FILES=[
 'index.html','style.css','manifest.json','sw.js','raid-online.html','raid-privacy.html',
 'airship.js','assets.js','br.js','br2.js','chars.js','chests.js','game.js','gear.js','gfx.js','humans.js','ice.js','kits.js','mapdress.js','maps.js','maps2.js','photoguns.js','post.js','royale.js','sidekicks.js','sidekickshop.js','skins.js','skinshop.js','toon.js','weapons.js','wskins.js',
 'raid-account-ui.mjs','raid-audio.mjs','raid-base.mjs','raid-comms-ui.mjs','raid-dialogs.mjs','raid-environment.mjs','raid-input.mjs','raid-models.mjs','raid-online.mjs','raid-prediction.mjs','raid-quantity-ui.mjs','raid-settings-ui.mjs','raid-transport.mjs','raid-trigger.mjs','raid-view.mjs','raid-voice.mjs',
 'scripts/release.mjs','scripts/start-release.mjs','scripts/lib/release.mjs','scripts/backup.mjs','scripts/moderation.mjs','scripts/ops.mjs',
 'README.md','SERVER.md','OPERATIONS.md','RAID_RULES.md','WORLD_CONTENT.md','MATCHMAKING.md','COMBAT.md','PROGRESSION.md','LOADOUTS.md','INVENTORY.md','ECONOMY.md','ECONOMY_MODEL.md','STABILITY_REVIEW.md','RELEASE.md'
];
const TREES={assets:new Set(['.glb','.jpg','.jpeg','.png','.webp']),icons:new Set(['.png']),lib:new Set(['.js','.mjs']),server:new Set(['.mjs']),shared:new Set(['.mjs'])};
const digest=data=>createHash('sha256').update(data).digest('hex');
const inside=(root,path)=>path===root||path.startsWith(root+sep);
const fail=message=>{throw new Error(message)};
const validPath=path=>typeof path==='string'&&path.length<240&&!path.includes('\\')&&!path.startsWith('/')&&path.split('/').every(p=>/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(p)&&p!=='.'&&p!=='..');
async function regularFile(root,path){
 if(!validPath(path))fail('Invalid release file path');const full=resolve(root,path);
 for(let parent=dirname(full);parent!==root;parent=dirname(parent)){const info=await lstat(parent);if(!info.isDirectory()||info.isSymbolicLink())fail('Release contains a linked directory')}
 const info=await lstat(full);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1)fail('Release requires independent regular files: '+path);
 if(!inside(root,await realpath(full)))fail('Release file escaped its root');return info;
}
async function sourceInventory(root){
 const files=[...RELEASE_FILES];
 for(const [tree,extensions]of Object.entries(TREES)){
  async function visit(path){const directory=await lstat(join(root,path));if(!directory.isDirectory()||directory.isSymbolicLink())fail('Runtime trees must be real directories');for(const entry of await readdir(join(root,path),{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const child=path+'/'+entry.name;if(entry.isSymbolicLink())fail('Runtime asset/source links are not allowed');if(entry.isDirectory())await visit(child);else if(extensions.has(extname(entry.name)))files.push(child)}}
  await visit(tree);
 }
 if(files.length>10000)fail('Release inventory is too large');return [...new Set(files)].sort();
}
function payload(manifest){return {format:manifest.format,label:manifest.label,nodeMinimum:manifest.nodeMinimum,schema:manifest.schema,protocol:manifest.protocol,files:manifest.files}}
async function entries(root,paths){
 let total=0;const result=[];for(const path of paths){const before=await regularFile(root,path);if(before.size>32*1024*1024||(total+=before.size)>256*1024*1024)fail('Release exceeds size limits');const data=await readFile(join(root,path)),after=await lstat(join(root,path));if(before.ino!==after.ino||before.dev!==after.dev||before.size!==after.size||before.mtimeMs!==after.mtimeMs||data.length!==after.size)fail('Source changed during release build');result.push({path,bytes:data.length,sha256:digest(data)})}return result;
}
// Closure checking catches forgotten new relative modules without evaluating
// source code. Dynamic asset names are covered by the explicit public trees.
async function checkReferences(root,paths){
 const known=new Set(paths);
 for(const path of paths.filter(p=>/\.(?:m?js|html|css)$/.test(p))){const source=await readFile(join(root,path),'utf8'),references=[];
  if(/\.m?js$/.test(path))for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"\n]+)['"]/g))references.push(match[1]);
  if(path.endsWith('.css'))for(const match of source.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/g))if(!/^(?:[a-z]+:|\/\/)/i.test(match[1]))references.push(match[1].trim());
  if(path.endsWith('.html'))for(const match of source.matchAll(/(?:src|href)\s*=\s*['"]([^'"#]+)['"]/g))if(!/^(?:[a-z]+:|\/\/)/i.test(match[1]))references.push(match[1]);
  for(const reference of references){const clean=reference.split(/[?#]/)[0],file=clean.startsWith('/')?resolve(root,'.'+clean):resolve(dirname(join(root,path)),clean||path.split('/').at(-1));let target=relative(root,file).split(sep).join('/');if(!target||clean.endsWith('/'))target=(target?target+'/':'')+'index.html';if(!known.has(target))fail('Missing packaged reference from '+path+': '+target)}
 }
}
export async function buildRelease({source=SOURCE_ROOT,destination,label='candidate'}={}){
 const root=await realpath(resolve(source));if(!destination||!/^[-a-zA-Z0-9_]{1,64}$/.test(label))fail('Use a new output directory and a simple release label');
 const target=resolve(destination),parent=await realpath(dirname(target)),canonical=join(parent,target.split(sep).at(-1));if(inside(root,canonical)||inside(canonical,root))fail('Release output must be separate from the source checkout');
 const paths=await sourceInventory(root);const original=await entries(root,paths);await checkReferences(root,paths);
 await mkdir(canonical,{mode:0o700});
 try{
  for(const entry of original){await mkdir(dirname(join(canonical,entry.path)),{recursive:true,mode:0o700});const data=await readFile(join(root,entry.path));if(digest(data)!==entry.sha256)fail('Source changed during release build');await writeFile(join(canonical,entry.path),data,{flag:'wx',mode:0o600})}
  if(JSON.stringify(await entries(root,paths))!==JSON.stringify(original)||JSON.stringify(await sourceInventory(root))!==JSON.stringify(paths))fail('Source changed during release build');
  const manifest={format:1,label,nodeMinimum:24,schema:SCHEMA_VERSION,protocol:RAID_PROTOCOL,files:original};manifest.id=digest(JSON.stringify(payload(manifest)));
  await writeFile(join(canonical,'release.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});await verifyRelease({root:canonical,expectedId:manifest.id});return {id:manifest.id,label,path:canonical,files:paths.length,bytes:original.reduce((n,e)=>n+e.bytes,0),schema:manifest.schema,protocol:manifest.protocol};
 }catch(error){await rm(canonical,{recursive:true,force:true});throw error}
}
export async function verifyRelease({root,expectedId}={}){
 const directory=await realpath(resolve(root));await regularFile(directory,'release.json');const info=await lstat(join(directory,'release.json'));if(info.size>2*1024*1024)fail('Invalid release manifest');let m;try{m=JSON.parse(await readFile(join(directory,'release.json'),'utf8'))}catch{fail('Invalid release manifest')}
 if(m.format!==1||m.nodeMinimum!==24||!/^[-a-zA-Z0-9_]{1,64}$/.test(m.label)||!Number.isSafeInteger(m.schema)||m.schema<1||!Number.isSafeInteger(m.protocol)||m.protocol<1||!Array.isArray(m.files)||m.files.length<1||m.files.length>10000||! /^[a-f0-9]{64}$/.test(m.id||''))fail('Invalid release manifest');
 if(Object.keys(m).sort().join(',')!=='files,format,id,label,nodeMinimum,protocol,schema')fail('Unexpected release manifest fields');
 const paths=m.files.map(e=>e.path);if(paths.some(p=>!validPath(p)||p==='release.json')||new Set(paths).size!==paths.length||paths.join('\n')!==[...paths].sort().join('\n')||m.files.some(e=>Object.keys(e).sort().join(',')!=='bytes,path,sha256'||!Number.isSafeInteger(e.bytes)||e.bytes<0||! /^[a-f0-9]{64}$/.test(e.sha256)))fail('Invalid release file inventory');
 if(digest(JSON.stringify(payload(m)))!==m.id||expectedId!=null&&m.id!==expectedId)fail('Release identity mismatch');
 const expected=new Set([...paths,'release.json']),directories=new Set(['']);for(const path of paths)for(let parent=dirname(path);parent!=='.';parent=dirname(parent))directories.add(parent);
 async function walk(path=''){for(const entry of await readdir(join(directory,path),{withFileTypes:true})){const child=path?path+'/'+entry.name:entry.name;if(entry.isSymbolicLink())fail('Release contains a link');if(entry.isDirectory()){if(!directories.has(child))fail('Unexpected release directory');await walk(child)}else if(!entry.isFile()||!expected.has(child))fail('Unexpected release file')}}await walk();
 if(JSON.stringify(await entries(directory,paths))!==JSON.stringify(m.files))fail('Release file contents do not match the manifest');await checkReferences(directory,paths);return m;
}
export async function releaseEnvironment(root,manifest,environment){
 if(manifest.schema!==SCHEMA_VERSION||manifest.protocol!==RAID_PROTOCOL)fail('Release metadata does not match its runtime');
 if(Number(process.versions.node.split('.')[0])<manifest.nodeMinimum)fail('Node.js 24 or later is required');
 const data=environment.RAID_DATA_DIR;if(!data||!data.startsWith(sep))fail('RAID_DATA_DIR must be an absolute path outside the release');
 const path=resolve(data);let canonical;try{canonical=await realpath(path)}catch(error){if(error.code!=='ENOENT')throw error;canonical=join(await realpath(dirname(path)),path.split(sep).at(-1))}
 if(inside(root,canonical)||inside(canonical,root))fail('Save data and release files must be separate');
 if(Buffer.byteLength(join(canonical,'.ops/control.sock'))>96)fail('Save path is too long for the private control socket; use a shorter RAID_DATA_DIR');
 const port=environment.PORT??'8020',host=environment.HOST||'127.0.0.1',secure=environment.RAID_SECURE_COOKIES??'0',region=environment.RAID_REGION||'local';
 if(!/^\d{1,5}$/.test(port)||Number(port)>65535)fail('Invalid service port');if(!/^[a-zA-Z0-9.:[\]_-]{1,253}$/.test(host)||!['0','1'].includes(secure)||!/^[-a-zA-Z0-9_]{1,40}$/.test(region))fail('Invalid service configuration');
 if(!['127.0.0.1','::1','localhost'].includes(host)&&secure!=='1')fail('A non-loopback release requires secure cookies and an HTTPS reverse proxy');
 let ice;try{ice=JSON.parse(environment.RAID_ICE_SERVERS||'[]')}catch{fail('Invalid voice relay configuration')}
 if(!Array.isArray(ice)||ice.length>16||ice.some(server=>!server||typeof server!=='object'||!['string','object'].includes(typeof server.urls)||!(typeof server.urls==='string'?[server.urls]:Array.isArray(server.urls)?server.urls:[]).length||(typeof server.urls==='string'?[server.urls]:server.urls).some(url=>typeof url!=='string'||url.length>2048||!/^(?:stun|stuns|turn|turns):[^\s]+$/.test(url))||server.username!=null&&typeof server.username!=='string'||server.credential!=null&&typeof server.credential!=='string'))fail('Invalid voice relay configuration');
 const maxOperators=environment.RAID_MAX_OPERATORS??'27';if(!/^[1-9][0-9]*$/.test(maxOperators)||Number(maxOperators)>1024)fail('Invalid host operator limit');
 return {PATH:environment.PATH||'',RAID_DATA_DIR:canonical,HOST:host,PORT:port,RAID_REGION:region,RAID_SECURE_COOKIES:secure,RAID_ICE_SERVERS:JSON.stringify(ice),RAID_BUILD_ID:manifest.id,RAID_MAX_OPERATORS:String(maxOperators)};
}
