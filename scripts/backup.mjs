import {resolve,dirname} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createBackup,verifyBackup,restoreBackup} from '../server/backup.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..'),[command,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]==null)throw new Error('Options require --name value');options[args[i].slice(2)]=args[i+1]}
try{
 let result;
 if(command==='create'){
  let destination=options.out;if(!destination){const parent=resolve(ROOT,'.raid-backups');await mkdir(parent,{recursive:true,mode:0o700});destination=resolve(parent,new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8))}
  result=await createBackup({source:resolve(options.db||resolve(ROOT,'.raid-data/raid.sqlite')),destination,build:options.build||process.env.RAID_BUILD_ID||'development'});
 }else if(command==='verify'){if(!options.backup)throw new Error('Supply --backup directory');result=await verifyBackup(options.backup)}
 else if(command==='restore'){if(!options.backup||!options.out)throw new Error('Supply --backup and a new --out directory');result=await restoreBackup({directory:options.backup,destination:options.out,operator:options.operator,raidPolicy:options['raid-policy']})}
 else throw new Error('Usage: backup.mjs create [--db file] [--out new-directory] | verify --backup directory | restore --backup directory --out new-private-directory --operator name --raid-policy resume|abort');
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error('Backup operation failed: '+error.message);process.exitCode=1}
