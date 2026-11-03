import {resolve} from 'node:path';
import {buildRelease,verifyRelease} from './lib/release.mjs';
const [command,...args]=process.argv.slice(2),options={};
try{
 for(let i=0;i<args.length;i+=2){if(!['--out','--label','--root','--id'].includes(args[i])||args[i+1]==null||options[args[i]])throw new Error('Use unique --name value options');options[args[i]]=args[i+1]}
 if(command==='build'){if(!options['--out']||options['--root']||options['--id'])throw new Error('Use build --out NEW_DIRECTORY [--label NAME]');console.log(JSON.stringify(await buildRelease({destination:resolve(options['--out']),label:options['--label']})))}
 else if(command==='verify'){if(!options['--root']||options['--out']||options['--label'])throw new Error('Use verify --root RELEASE_DIRECTORY [--id EXPECTED_ID]');const m=await verifyRelease({root:options['--root'],expectedId:options['--id']});console.log(JSON.stringify({verified:true,id:m.id,files:m.files.length,schema:m.schema,protocol:m.protocol}))}
 else throw new Error('Choose build or verify');
}catch(error){console.error('Release operation failed: '+error.message);process.exitCode=1}
