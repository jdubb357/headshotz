// Opt-in field objectives through the real deployment UI and in-raid HUD.
// A fresh operator selects a catalog objective, sees its approach bearing and
// hold progress, watches the maps paint its marker, secures it through the
// authoritative tick, reconnects to a server-owned secured state, and settles
// with the bonus credits and XP visible in the rewards card.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFile} from 'node:fs/promises';
import {RaidStore,item} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
import {getWorld,floorAt} from '../shared/raid-worlds.mjs';
import {objectivesFor} from '../shared/raid-objectives.mjs';

let now=1000;
const store=new RaidStore(),runtime=createRaidServer(store,{now:()=>now});
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness();
const world=getWorld('relay'),objectives=objectivesFor(world),objective=objectives[1];
const rgbCode=rgb=>`${rgb[0]},${rgb[1]},${rgb[2]}`;
const minimapHasColor=(x,z,rgb)=>`(()=>{const c=document.getElementById('minimap'),ctx=c.getContext('2d'),k=c.width/1440,px=Math.round(c.width/2+(${x})*k),py=Math.round(c.height/2+(${z})*k);if(px<0||py<0||px>=c.width||py>=c.height)return false;const r=[${rgbCode(rgb)}],left=Math.max(0,px-24),top=Math.max(0,py-24),right=Math.min(c.width,px+25),bottom=Math.min(c.height,py+25),d=ctx.getImageData(left,top,right-left,bottom-top).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-r[0])<10&&Math.abs(d[i+1]-r[1])<10&&Math.abs(d[i+2]-r[2])<10)return true;return false})()`;
const tacticalColorAt=(selfX,selfZ,x,z,rgb)=>`(()=>{const c=document.getElementById('tacticalCanvas'),ctx=c.getContext('2d'),k=c.width/1440,px=Math.round(c.width/2+((${x})-(${selfX}))*k),py=Math.round(c.height/2+((${z})-(${selfZ}))*k);if(px<0||py<0||px>=c.width||py>=c.height)return false;const r=[${rgbCode(rgb)}],left=Math.max(0,px-18),top=Math.max(0,py-18),right=Math.min(c.width,px+19),bottom=Math.min(c.height,py+19),d=ctx.getImageData(left,top,right-left,bottom-top).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-r[0])<10&&Math.abs(d[i+1]-r[1])<10&&Math.abs(d[i+2]-r[2])<10)return true;return false})()`;
const shot=async(p,path)=>{const png=await p.command('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(png.data,'base64'))};
const place=(player,x,z)=>{Object.assign(player,{x,z,y:floorAt(world,x,z)||0,move:{x:0,z:0},lastMoveAt:0,protectedUntil:now+600,alive:true,downed:false})};
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const username='objective_'+Date.now().toString(36);
 await p.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value='a long objective browser password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 assert.equal(await p.evaluate("document.getElementById('fieldObjective').hidden"),false,'the deployment form exposes the optional objective selector');
 assert.equal(await p.evaluate(`document.getElementById('fieldObjective').options.length`),objectives.length+1,'the selector lists an opt-out and every catalog objective');
 assert.equal(await p.evaluate(`[...document.getElementById('fieldObjective').options].some(o=>o.value===${JSON.stringify(objective.id)} && o.textContent.includes(${JSON.stringify(objective.site)}))`),true,'the authored site is selectable');

 await p.evaluate("localStorage.setItem('headshotz.raid.settings.v1',localStorage.getItem('headshotz.raid.settings.v1')||'{}')");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('fieldObjective').value="+JSON.stringify(objective.id)+";document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'))");
 await p.evaluate("document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 const player=runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(player.raidId);
 assert.ok(player,'the UI deployment reached the authoritative service');
 assert.equal(player.objective.id,objective.id,'the selected objective is committed server-side');
 raid.machines=[];raid.rivals=[];
 await p.wait("document.getElementById('objectivePanel').hidden===false",'the objective panel appears once the first snapshot arrives');

 // Approach from 20 m east so the objective marker is not hidden by the
 // operator halo, and check the panel's server-supplied coordinates/bearing.
 place(player,objective.x+20,objective.z);
 await p.wait("document.getElementById('objectivePanel').textContent.includes("+JSON.stringify(objective.site)+")",'the panel names the authored site');
 await p.wait(`document.getElementById('objectivePanel').textContent.includes('20 m west 270°')`,'the panel shows range and clockwise bearing');
 await p.wait(minimapHasColor(objective.x,objective.z,[99,227,255]),'the live minimap paints the objective cyan');
 await shot(p,'/tmp/headshotz-objectives-approach.png');

 await p.evaluate("document.getElementById('view').focus();document.getElementById('mapToggle').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===false");
 await p.wait(tacticalColorAt(player.x,player.z,objective.x,objective.z,[99,227,255]),'the tactical map paints the objective marker');
 await shot(p,'/tmp/headshotz-objectives-tactical.png');
 await p.evaluate("document.getElementById('mapClose').click()");
 await p.wait("document.getElementById('tacticalMap').hidden===true");

 // Walk onto the marker, then tick the authoritative service through the hold.
 place(player,objective.x,objective.z);
 for(let i=0;i<objective.holdSeconds*10+30;i++){now+=.1;player.lastInput=now;runtime.raids.advance(.1,now);if(player.objective.stage==='secured')break}
 assert.equal(player.objective.stage,'secured','the authoritative hold completes');
 await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.objective?.stage==='secured')",'the client sees the secured stage');
 await p.wait("document.getElementById('objectivePanel').textContent.includes('secured')",'the panel announces the secured objective');
 await p.wait("document.getElementById('statusAnnouncement').textContent.includes('Field objective secured') || document.getElementById('events').textContent.includes('Field objective secured')",'the secure event is announced');
 await p.wait(minimapHasColor(objective.x,objective.z,[125,255,155]),'the map repaints the secured marker green');
 await shot(p,'/tmp/headshotz-objectives-secured.png');
 const securedSnapshot=await p.evaluate("fetch('/api/raid').then(r=>r.json())");
 assert.equal(securedSnapshot.objective.progress,1,'the snapshot carries completed progress');
 assert.equal(securedSnapshot.objective.hold,objective.holdSeconds,'the snapshot carries the authored hold');
 assert.equal(securedSnapshot.objective.holdLeft,0,'the secured snapshot has no hold remaining');
 assert.deepEqual([securedSnapshot.objective.x,securedSnapshot.objective.z],[objective.x,objective.z],'the snapshot carries the marker coordinates');

 // A real page reconnect must resume from the server-owned objective instead of
 // a stale local assumption.
 await p.evaluate('window.__objectiveReload=true');
 await p.command('Page.reload');
 await p.wait("!window.__objectiveReload && !document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'",'the authenticated base screen reloads');
 assert.equal(await p.evaluate("document.getElementById('resume').hidden"),false,'an active deployment offers reconnect');
 await p.evaluate("document.getElementById('resume').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
 await p.wait("document.getElementById('objectivePanel').textContent.includes('secured')",'reconnect reads the secured objective from the server');
 assert.equal(runtime.raids.byAccount.get(profile.id).objective.stage,'secured','the server state survives reconnect');

 // Settle with an authoritative extraction, return to base, and surface the
 // objective bonus in the rewards card and raid record.
 const still=runtime.raids.byAccount.get(profile.id);
 runtime.raids.atomic(()=>runtime.raids.end(raid,still,'extract'));
 const settled=store.results(profile.id)[0];
 assert.equal(settled.credits,20+objective.rewardCredits,'settlement pays the catalog bonus');
 assert.equal(settled.xp,20+objective.rewardXp,'settlement pays the objective XP');
 assert.equal(settled.facts.objective.completed,true);
 await p.wait("document.getElementById('hint').textContent.includes('EXTRACT')",'the client shows the settled extraction');
 await p.evaluate("document.getElementById('leave').click()");
 await p.wait("document.getElementById('play').style.display==='none' && document.getElementById('rewards').hidden===false");
 const reward=await p.evaluate("({text:document.getElementById('rewardsObjective').textContent,hidden:document.getElementById('rewardsObjective').hidden,outcome:document.getElementById('rewardsTotals').textContent})");
 assert.equal(reward.hidden,false,'the rewards card surfaces the objective settlement');
 assert.match(reward.text,/Field objective secured/);
 assert.match(reward.text,new RegExp('\\+'+objective.rewardCredits+' credits'));
 assert.ok(reward.outcome.includes('+'+(20+objective.rewardCredits))&&reward.outcome.includes('Credits earned this raid'),'the credits metric includes the objective bonus');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({objective:objective.id,site:objective.site,holdSeconds:objective.holdSeconds,rewardCredits:objective.rewardCredits,rewardXp:objective.rewardXp,uiBearing:'20 m west 270°',minimapApproach:true,tacticalApproach:true,securedHud:true,reconnectServerOwned:true,settlementCredits:settled.credits,settlementXp:settled.xp,rewardsCard:true,screenshots:['/tmp/headshotz-objectives-approach.png','/tmp/headshotz-objectives-tactical.png','/tmp/headshotz-objectives-secured.png'],browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
