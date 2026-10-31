import {createServer,createConnection} from 'node:net';
import {mkdir,lstat,unlink,chmod,realpath} from 'node:fs/promises';
import {dirname,resolve,join,basename} from 'node:path';
async function exists(path){try{return await lstat(path)}catch(error){if(error.code==='ENOENT')return null;throw error}}
export async function startControlSocket({path,operations}){
 if(process.platform==='win32')throw new Error('Local control socket requires macOS or Linux');
 const parent=dirname(resolve(path));await mkdir(parent,{recursive:true,mode:0o700});const parentInfo=await lstat(parent);if(parentInfo.isSymbolicLink()||!parentInfo.isDirectory()||(parentInfo.mode&0o077)||parentInfo.uid!==process.getuid())throw new Error('Control directory must be private and owned by this user');
 const socketPath=join(await realpath(parent),basename(path));if(Buffer.byteLength(socketPath)>96)throw new Error('Control path exceeds the supported 96-byte limit; use a shorter RAID_DATA_DIR');const previous=await exists(socketPath);
 if(previous){
  if(!previous.isSocket()||previous.uid!==process.getuid())throw new Error('Refusing to replace the control path');
  const stale=await new Promise((resolve,reject)=>{const client=createConnection(socketPath);client.setTimeout(500);client.once('connect',()=>{client.destroy();resolve(false)});client.once('timeout',()=>{client.destroy();reject(new Error('Existing control socket did not respond'))});client.once('error',error=>error.code==='ECONNREFUSED'?resolve(true):reject(error))});
  if(!stale)throw new Error('Another control listener is active');const latest=await lstat(socketPath);if(latest.ino!==previous.ino||latest.dev!==previous.dev)throw new Error('Control path changed');await unlink(socketPath);
 }
 const server=createServer(socket=>{
  socket.setTimeout(2000,()=>socket.destroy());let text='',done=false;const reply=value=>{if(done)return;done=true;socket.end(JSON.stringify(value)+'\n')};
  socket.on('error',()=>{});socket.on('data',chunk=>{if(done)return;text+=chunk.toString();if(Buffer.byteLength(text)>2048){reply({ok:false,error:'Control request too large'});return}if(!text.includes('\n'))return;
   try{const data=JSON.parse(text.slice(0,text.indexOf('\n')));if(data.command==='status')reply({ok:true,status:operations.summary()});else if(['drain','resume'].includes(data.command))reply({ok:true,status:operations.setDraining(data.command==='drain',{operator:data.operator,reason:data.reason||'manual'})});else reply({ok:false,error:'Unknown control command'})}catch{reply({ok:false,error:'Invalid control request'})}
  });
 });server.maxConnections=32;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve)});await chmod(socketPath,0o600);const owned=await lstat(socketPath);
 return {path:socketPath,async close(){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));const current=await exists(socketPath);if(current?.ino===owned.ino&&current.dev===owned.dev)await unlink(socketPath)}};
}
export function controlRequest(path,data){return new Promise((resolve,reject)=>{
 const socket=createConnection(path);let text='',finished=false;const finish=(error,value)=>{if(finished)return;finished=true;socket.destroy();error?reject(error):resolve(value)};
 socket.setTimeout(3000,()=>finish(new Error('Control request timed out')));socket.once('error',error=>finish(error));socket.once('connect',()=>socket.write(JSON.stringify(data)+'\n'));socket.on('data',chunk=>{text+=chunk.toString();if(Buffer.byteLength(text)>262144)return finish(new Error('Control response too large'));if(!text.includes('\n'))return;try{const response=JSON.parse(text.slice(0,text.indexOf('\n')));if(!response.ok)throw new Error(response.error||'Control request rejected');finish(null,response.status)}catch(error){finish(error)}});socket.once('end',()=>{if(!finished)finish(new Error('Control connection ended before its response'))});
})}
