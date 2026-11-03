import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export async function isolatedRaidService(data,{build='network-load'}={}){
 const main=fileURLToPath(new URL('../../server/main.mjs',import.meta.url)),child=spawn(process.execPath,[main],{env:{PATH:process.env.PATH,RAID_DATA_DIR:data,HOST:'127.0.0.1',PORT:'0',RAID_BUILD_ID:build},stdio:['ignore','pipe','pipe']});let stderr='',exited;
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{exited={code,signal};resolve(exited)}));child.stderr.on('data',chunk=>stderr=(stderr+chunk.toString()).slice(-16000));
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Isolated service startup timed out'))},10000);child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Isolated service failed to start'))});child.stdout.on('data',chunk=>{const match=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0])}})});
 return {url,child,exit,get stderr(){return stderr},get exited(){return exited},async close(){if(exited)return exited;child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),12000);try{return await exit}finally{clearTimeout(timer)}}};
}
