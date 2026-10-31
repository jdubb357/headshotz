// Local operator tool. No report content is exposed through a player HTTP endpoint.
import {DatabaseSync} from 'node:sqlite';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const [command,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]==null)throw new Error('Options require --name value');options[args[i].slice(2)]=args[i+1]}
if(!['list','show','review'].includes(command)){console.log('Usage: node scripts/moderation.mjs list|show|review [--db /path/raid.sqlite] [--report ID] [--status open|reviewed|dismissed] [--operator NAME] [--note TEXT]');process.exitCode=1}
else{
 const db=new DatabaseSync(resolve(options.db||resolve(dirname(fileURLToPath(import.meta.url)),'../.raid-data/raid.sqlite')),{readOnly:command!=='review'});
 try{
  if(command==='list'){
   const status=options.status||'open';if(!['open','reviewed','dismissed'].includes(status))throw new Error('Invalid report status');
   console.log(JSON.stringify(db.prepare('SELECT r.id,r.reason,r.status,r.context,r.at,a.username reporter,b.username target FROM player_reports r JOIN accounts a ON a.id=r.reporter JOIN accounts b ON b.id=r.target WHERE r.status=? ORDER BY r.at DESC LIMIT 100').all(status),null,2));
  }else{
   const report=db.prepare('SELECT * FROM player_reports WHERE id=?').get(options.report||'');if(!report)throw new Error('Report not found');
   if(command==='show')console.log(JSON.stringify({...report,evidence:JSON.parse(report.evidence)},null,2));
   else{
    if(!['open','reviewed','dismissed'].includes(options.status))throw new Error('Choose an allowed status');
    if(typeof options.operator!=='string'||!/^[a-zA-Z0-9_.-]{1,64}$/.test(options.operator))throw new Error('Supply --operator with your operator identifier');
    if((options.note||'').length>1000)throw new Error('Review note is too long');
    db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE player_reports SET status=? WHERE id=?').run(options.status,report.id);db.prepare('INSERT INTO audit(account,event,data,at) VALUES(?,?,?,?)').run('operator:'+options.operator,'report_review',JSON.stringify({report:report.id,status:options.status,note:options.note||''}),Date.now());db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
    console.log(JSON.stringify({id:report.id,status:options.status}));
   }
  }
 }finally{db.close()}
}
