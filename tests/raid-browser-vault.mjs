// Authoritative mantle/vault: the fixed keyboard binding and the touch control
// both commit the shared server animation and land on the authored ledge top.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),runtime=createRaidServer(store);
runtime.server.listen(0,'127.0.0.1');await once(runtime.server,'listening');
const previousUrl=process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL='http://127.0.0.1:'+runtime.server.address().port;
const h=await browserHarness(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(p,code,down=true)=>p.command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:code.charCodeAt(3)});
try{
 const p=await h.page();
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='vault_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long vault browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('maxRtt').value='0';document.getElementById('maxRtt').dispatchEvent(new Event('change'));document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('HP 100') && document.body.getAttribute('aria-busy')==='false'");
 const player=runtime.raids.byAccount.get(profile.id),raid=runtime.raids.raids.get(player.raidId);
 raid.machines=[];raid.rivals=[];
 const approach=(x,z,d)=>({x,z:z-d/2-.7,y:0,vault:null,nextVault:0});
 const place=async fixture=>{
  const [x,z,w,d,h]=fixture;Object.assign(player,{...approach(x,z,d),move:{x:0,z:1},yaw:0,pitch:0,grounded:true,alive:true,downed:false,protectedUntil:Date.now()/1000+300,vaultUntil:0,fallPeak:0});
  await p.wait(`fetch('/api/raid').then(r=>r.json()).then(r=>Math.abs(r.self.x-(${x}))<.25&&Math.abs(r.self.z-(${z-d/2-.7}))<.25)`);
  await p.evaluate("document.getElementById('view').focus()");
 };
 const verify=async (fixture,label)=>{
  const [,,,d,h]=fixture;
  await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>r.self.vaulting===true)",label+' starts a server vault');
  const mid=await p.evaluate("({more:document.getElementById('hud').textContent.includes('VAULTING'),label:document.getElementById('vault').textContent,disabled:document.getElementById('vault').disabled})");
  assert.equal(mid.more,true,label+' HUD is vaulting');assert.equal(mid.label,'Vaulting…');assert.equal(mid.disabled,true);
  await sleep(650);
  const after=await p.evaluate("fetch('/api/raid').then(r=>r.json()).then(r=>({y:r.self.y,z:r.self.z,grounded:r.self.grounded,vaulting:r.self.vaulting,vault:r.self.vault}))");
  assert.equal(after.vaulting,false,label+' ends');assert.equal(after.grounded,true,label+' lands grounded');assert.ok(Math.abs(after.y-h)<.02,label+' lands on '+h+', got '+after.y);assert.equal(after.vault,null,label+' clears vault');
 };
 await place([-440,-520,8,4,1.2]);
 await p.wait("!document.getElementById('vault').disabled",'vault control becomes available at a ledge');
 const pre=await p.evaluate("({disabled:document.getElementById('vault').disabled,label:document.getElementById('vault').textContent})");
 assert.equal(pre.disabled,false);assert.equal(pre.label,'Vault');
 await key(p,'KeyJ');await verify([-440,-520,8,4,1.2],'keyboard');await key(p,'KeyJ',false);
 await place([434,-406,3.6,3.6,1.1]);
 await p.wait("!document.getElementById('vault').disabled",'touch vault becomes available');
 await p.evaluate("document.getElementById('vault').click()");await verify([434,-406,3.6,3.6,1.1],'touch');
 assert.deepEqual(p.errors,[]);
 console.log(JSON.stringify({keyboardVault:true,touchVault:true,firstLedgeY:1.2,secondLedgeY:1.1,hudVaulting:true,touchTarget:true,browserErrors:p.errors}));
}finally{await h.close();runtime.server.close();await once(runtime.server,'close');store.close();if(previousUrl===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=previousUrl}
