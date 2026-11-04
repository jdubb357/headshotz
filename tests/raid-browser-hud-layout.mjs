// HUD docking regression: the field-guide hint, backup toggle, backpack and touch
// controls must not overlap or obscure each other at supported viewport sizes.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),{server}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');const previousUrl=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+server.address().port;const h=await browserHarness();
const overlaps=async p=>p.evaluate(`(()=>{const ids=['pack','hint','touch','minimap','packToggle','telemetry','spectate','commsToggle'];const rects=ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id,visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0,x:r.x,y:r.y,right:r.right,bottom:r.bottom}});return rects.flatMap((a,i)=>rects.slice(i+1).filter(b=>a.visible&&b.visible&&a.x<b.right&&a.y<b.bottom&&a.right>b.x&&a.bottom>b.y).map(b=>a.id+'/'+b.id))})()`);
const obstructedTouch=async p=>p.evaluate(`[...document.querySelectorAll('#touch button')].filter(b=>{const r=b.getBoundingClientRect();if(!r.width||!r.height)return false;const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !hit||(hit!==b&&!b.contains(hit))}).map(b=>b.textContent)`);
const edgeObstructed=async p=>p.evaluate(`[...document.querySelectorAll('#touch button')].flatMap(b=>{const r=b.getBoundingClientRect();if(!r.width||!r.height)return[];return [[r.x+r.width/2,r.y+1],[r.x+r.width/2,r.bottom-1]].filter(([x,y])=>{const hit=document.elementFromPoint(x,y);return !hit||(hit!==b&&!b.contains(hit))}).map(()=>b.textContent)}).filter((v,i,a)=>a.indexOf(v)===i)`);
const undersized=async p=>p.evaluate(`(()=>{const small=[];for(const b of document.querySelectorAll('#touch button')){const r=b.getBoundingClientRect(),s=getComputedStyle(b);if(s.display!=='none'&&s.visibility!=='hidden'&&r.width&&r.height&&(r.width<44||r.height<44))small.push(b.textContent+':'+Math.round(r.width)+'x'+Math.round(r.height))}for(const id of ['packToggle','spectate']){const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);if(s.display!=='none'&&s.visibility!=='hidden'&&r.width&&r.height&&(r.width<44||r.height<44))small.push(id+':'+Math.round(r.width)+'x'+Math.round(r.height))}return small})()`);
const size=async(p,width,height,mobile)=>{await p.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});if(mobile)await p.command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});else await p.command('Emulation.setTouchEmulationEnabled',{enabled:false});await new Promise(r=>setTimeout(r,200))};
const setPack=async(p,open)=>{if(await p.evaluate("document.getElementById('pack').hidden")===open)await p.evaluate("document.getElementById('packToggle').click()");await p.wait(`document.getElementById('pack').hidden===${!open}`);await new Promise(r=>setTimeout(r,150))};
const check=async(p,label)=>{const found=await overlaps(p);assert.deepEqual(found,[],label+' layout overlaps: '+found);assert.deepEqual(await obstructedTouch(p),[],label+' touch controls obscured');assert.deepEqual(await edgeObstructed(p),[],label+' touch control edges obscured');assert.deepEqual(await undersized(p),[],label+' undersized touch targets')};
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='hudlay_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long layout testing password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 await size(p,1280,800,false);
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('hud').textContent.includes('HP')");
 await check(p,'1280x800 desktop');
 await size(p,756,468,false);await check(p,'756x468 desktop');
 assert.equal(await p.evaluate("document.getElementById('telemetry').getBoundingClientRect().right<document.getElementById('minimap').getBoundingClientRect().left"),true,'short viewport keeps map clear of captions');
 await size(p,390,844,true);await setPack(p,false);await check(p,'390x844 mobile closed');
 await setPack(p,true);await check(p,'390x844 mobile open');
 assert.equal(await p.evaluate("['hint','touch','minimap'].every(id=>getComputedStyle(document.getElementById(id)).display==='none')"),true,'pack overlay hides unrelated HUD');
 await setPack(p,false);
 await p.evaluate("document.getElementById('hudScale').value='1.6';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 await new Promise(r=>setTimeout(r,250));await check(p,'390x844 enlarged text');
 await p.evaluate("document.getElementById('hudScale').value='1';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 await size(p,360,640,true);await setPack(p,false);await check(p,'360x640 mobile closed');
 await size(p,320,568,true);await check(p,'320x568 mobile closed');
 await p.evaluate("document.getElementById('hudScale').value='1.6';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 await new Promise(r=>setTimeout(r,250));await check(p,'320x568 enlarged text');assert.equal(await p.evaluate("getComputedStyle(document.getElementById('hint')).display==='none'"),true,'enlarged compact HUD removes the clipped hint');
 await p.evaluate("document.getElementById('hudScale').value='1';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 await size(p,320,480,true);await check(p,'320x480 mobile closed');
 await setPack(p,true);await check(p,'320x480 mobile open');
 await setPack(p,false);
 await p.evaluate("document.getElementById('hudScale').value='1.6';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 await new Promise(r=>setTimeout(r,250));await check(p,'320x480 enlarged text');
 await p.evaluate("document.getElementById('hudScale').value='1';document.getElementById('hudScale').dispatchEvent(new Event('input'))");
 assert.deepEqual(p.errors,[]);console.log(JSON.stringify({desktop1280:true,desktopShort756:true,mapClearOfCaptions:true,mobile390Closed:true,mobile390Open:true,mobileEnlargedText:true,mobile360:true,mobile320Closed:true,mobile320Enlarged:true,mobile320ShortClosed:true,mobile320ShortOpen:true,mobile320ShortEnlarged:true,browserErrors:[]}));
}finally{await h.close();server.close();await once(server,'close');store.close();if(previousUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previousUrl}
