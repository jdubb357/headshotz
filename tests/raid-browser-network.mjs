// Isolated browser context and in-memory service. Intercepts only this test's requests.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
const store=new RaidStore(),{server,raids}=createRaidServer(store);server.listen(0,'127.0.0.1');await once(server,'listening');
const prior=process.env.RAID_TEST_URL;process.env.RAID_TEST_URL='http://127.0.0.1:'+server.address().port;const h=await browserHarness(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bounded=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error(label)),10000);timer.unref()})]);
try{
 const p=await h.page();await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate("document.querySelector('[name=username]').value='network_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long network browser password';document.getElementById('register').click()");
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 // Observe actual rendered camera positions through the renderer; no production test hooks.
 await p.evaluate("import('./raid-view.mjs').then(({RaidView})=>{const frame=RaidView.prototype.frame;RaidView.prototype.frame=function(...args){const result=frame.apply(this,args);window.__networkCamera={x:this.camera.position.x,z:this.camera.position.z,at:performance.now()};return result}})");
 const profile=await p.evaluate("fetch('/api/profile').then(r=>r.json())");
 await p.evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await p.wait("document.getElementById('play').style.display==='block' && window.__networkCamera && document.body.getAttribute('aria-busy')==='false'");
 const operator=raids.byAccount.get(profile.id);operator.protectedUntil=Date.now()/1000+60;
 let mode='movement',resolveMovement,resolveShot;const movement=new Promise(r=>resolveMovement=r),shot=new Promise(r=>resolveShot=r),shots=[],interceptErrors=[];
 const listener=event=>{const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;const paused=message.params;
  const handle=async()=>{const packet=JSON.parse(paused.request.postData||'{}');
   if(mode==='movement'&&packet.type==='move'){mode='holding';resolveMovement(paused.requestId);return}
   if(packet.type==='fire'){shots.push(packet);if(mode==='shot'){mode='shot-lost';await p.command('Fetch.failRequest',{requestId:paused.requestId,errorReason:'ConnectionReset'});resolveShot();return}}
   await p.command('Fetch.continueRequest',{requestId:paused.requestId});
  };handle().catch(error=>interceptErrors.push(error.message));
 };
 p.socket.addEventListener('message',listener);await p.command('Fetch.enable',{patterns:[{urlPattern:'*/api/action',requestStage:'Request'}]});
 const held=await bounded(movement,'Movement did not pause'),before={x:operator.x,z:operator.z},cameraBefore=await p.evaluate('window.__networkCamera');
 await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await sleep(180);
 const predicted=await p.evaluate('window.__networkCamera');assert.ok(Math.hypot(predicted.x-cameraBefore.x,predicted.z-cameraBefore.z)>.12,'camera moves before authority receives held movement');
 assert.ok(Math.hypot(operator.x-before.x,operator.z-before.z)<.01,'held movement has not moved the authoritative body');
 await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});await p.command('Fetch.continueRequest',{requestId:held});mode='normal';
 await sleep(900);const reconciled=await p.evaluate('window.__networkCamera');assert.ok(Math.hypot(reconciled.x-operator.x,reconciled.z-operator.z)<.25,'camera reconciles to the unchanged server body');
 await p.command('Fetch.disable');
 // Lose the response only after the server has committed the shot, then observe the retry.
 mode='shot';await p.command('Fetch.enable',{patterns:[{urlPattern:'*/api/action',requestStage:'Response'}]});
 const ammo=operator.ammo,rounds=operator.facts.roundsFired||0;
 await p.evaluate("document.getElementById('fire').click()");await bounded(shot,'Shot response did not pause');
 await p.wait(`document.getElementById('hud').textContent.includes('Ammo ${ammo-1}') && document.body.getAttribute('aria-busy')==='false'`);
 assert.equal(operator.ammo,ammo-1);assert.equal(operator.facts.roundsFired,rounds+1);assert.equal(shots.length,2);assert.deepEqual(shots[0],shots[1],'retry sends the same command and sequence');
 assert.deepEqual(interceptErrors,[]);await p.command('Fetch.disable');p.socket.removeEventListener('message',listener);
 // A real browser reload resumes the current protocol and the same escrowed operator.
 const deploymentId=operator.deploymentId;await p.command('Page.reload');await p.wait("!document.getElementById('resume').hidden && document.body.getAttribute('aria-busy')==='false'");await p.evaluate("document.getElementById('resume').click()");await p.wait(`document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('Ammo ${ammo-1}')`);
 assert.equal(raids.byAccount.get(profile.id).deploymentId,deploymentId);
 // Disable periodic movement polling: an 80 ms press/release must still reach authority.
 await p.command('Page.addScriptToEvaluateOnNewDocument',{source:"window.__inputTimers=[];const interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>{const id=interval(fn,ms,...args);if(ms===150)window.__inputTimers.push(id);return id}"});await p.command('Page.reload');await p.wait("!document.getElementById('resume').hidden && document.body.getAttribute('aria-busy')==='false'");await p.evaluate("document.getElementById('resume').click()");await p.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");await p.evaluate('window.__inputTimers.forEach(clearInterval)');const tapStart=raids.byAccount.get(profile.id).z;
 await p.command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await sleep(80);await p.command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});await p.wait("fetch('/api/raid').then(r=>r.json()).then(r=>Math.hypot(r.self.move.x,r.self.move.z)===0)");assert.ok(raids.byAccount.get(profile.id).z>tapStart+.1,'a short tap reaches the server without the polling timer');const tapEnd=raids.byAccount.get(profile.id).z;await sleep(500);assert.ok(Math.abs(raids.byAccount.get(profile.id).z-tapEnd)<.05,'release sends an immediate stop');
 // The injected ConnectionReset is an expected network console message, not a JS exception.
 const unexpected=p.errors.filter(error=>!/net::ERR_CONNECTION_RESET/.test(error));assert.deepEqual(unexpected,[]);
 console.log(JSON.stringify({immediateVisualMovement:true,authorityUnchangedBeforeDelivery:true,reconciled:true,lostShotResponseRetried:true,ammunitionConsumedOnce:true,sameDeploymentAfterReload:true,shortInputDeliveredWithoutPolling:true,releaseStopsWithoutPolling:true,browserErrors:unexpected}));
}finally{await h.close();server.close();await once(server,'close');store.close();if(prior===undefined)delete process.env.RAID_TEST_URL;else process.env.RAID_TEST_URL=prior}
