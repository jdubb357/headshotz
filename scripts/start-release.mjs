import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRelease,releaseEnvironment} from './lib/release.mjs';
try{
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--id'||!/^[a-f0-9]{64}$/.test(args[1]))throw new Error('Use start-release.mjs --id EXPECTED_RELEASE_ID');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),manifest=await verifyRelease({root,expectedId:args[1]}),env=await releaseEnvironment(root,manifest,process.env);
 const child=spawn(process.execPath,[resolve(root,'server/main.mjs')],{cwd:root,env,stdio:'inherit'});
 let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;child.kill(signal)});
 child.once('error',()=>{console.error('Release process failed to launch');process.exitCode=1});child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0)});
}catch(error){console.error('Release startup refused: '+error.message);process.exitCode=1}
