// Requires Chrome launched with --use-fake-device-for-media-stream and
// --use-fake-ui-for-media-stream. Never use a real microphone/profile for this test.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {browserHarness} from './browser-harness.mjs';
const h=await browserHarness();
async function register(p,suffix){
 await p.command('Page.addScriptToEvaluateOnNewDocument',{source:`window.__testPCs=[];window.__testMedia=[];const OriginalPC=window.RTCPeerConnection;window.RTCPeerConnection=class extends OriginalPC{constructor(...args){super(...args);window.__testPCs.push(this)}};const originalMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await originalMedia(...args);window.__testMedia.push(stream);return stream}`});
 await p.command('Page.reload');await p.grantPermissions(['audioCapture']);
 await p.wait("document.getElementById('message')?.textContent.includes('Sign in')");
 await p.evaluate(`document.querySelector('[name=username]').value='comms_${suffix}_'+Date.now().toString(36);document.querySelector('[name=password]').value='a long comms test password';document.getElementById('register').click()`);
 await p.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 assert.equal(await p.evaluate('window.__testMedia.length'),0,'no microphone request at startup');
}
try{
 const a=await h.page(),b=await h.page();await register(a,'a');await register(b,'b');
 await a.evaluate("document.getElementById('partyMode').value='duo';document.getElementById('partyCreate').click()");await a.wait("document.getElementById('partyState').textContent.includes('Invite') && document.body.getAttribute('aria-busy')==='false'");
 const party=await a.evaluate("fetch('/api/party').then(r=>r.json())");
 await b.evaluate(`document.getElementById('partyCode').value=${JSON.stringify(party.id)};document.getElementById('partyJoin').click()`);await b.wait("!document.getElementById('partyReady').hidden && document.body.getAttribute('aria-busy')==='false'");
 for(const p of [a,b]){
  await p.evaluate("document.getElementById('commsToggle').click();document.getElementById('voiceEnable').click()");
  await p.wait("document.getElementById('voiceStatus').textContent.includes('Voice enabled') && document.body.getAttribute('aria-busy')==='false'");
  assert.equal(await p.evaluate('window.__testMedia[0].getAudioTracks()[0].enabled'),false,'opt-in microphone starts quiet');
 }
 const connected="window.__testPCs.some(p=>p.connectionState==='connected')";
 for(const p of [a,b])await p.wait(connected);
 await a.command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyV',key:'v'});
 assert.equal(await a.evaluate("window.__testMedia[0].getAudioTracks()[0].enabled"),true);
 await b.wait("Promise.all(window.__testPCs.map(async p=>[...await p.getStats()].some(([,s])=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))).then(x=>x.some(Boolean))");
 await a.command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyV',key:'v'});
 assert.equal(await a.evaluate("window.__testMedia[0].getAudioTracks()[0].enabled"),false);
 await a.evaluate("window.dispatchEvent(new Event('blur'))");assert.equal(await a.evaluate("window.__testMedia[0].getAudioTracks()[0].enabled"),false);
 const aId=await a.evaluate("fetch('/api/profile').then(r=>r.json()).then(p=>p.id)");
 await b.wait(`!!document.querySelector('[data-person="${aId}"]')`);
 await b.evaluate(`document.querySelector('[data-person="${aId}"] button').click()`);await b.wait("document.getElementById('commsRoster').textContent.includes('Unmute') && document.body.getAttribute('aria-busy')==='false'");
 await b.wait("!window.__testPCs.some(p=>p.connectionState==='connected')");await a.wait("!window.__testPCs.some(p=>p.connectionState==='connected')");
 await b.evaluate(`document.querySelector('[data-person="${aId}"] button').click()`);for(const p of [a,b])await p.wait(connected);
 for(const p of [a,b]){await p.evaluate("document.getElementById('commsToggle').click();document.getElementById('recovery').checked=true;document.getElementById('partyReady').click()");await p.wait("document.getElementById('partyRoster').textContent.includes('READY') && document.body.getAttribute('aria-busy')==='false'")}
 await a.wait("!document.getElementById('deploy').disabled");await a.evaluate("document.getElementById('deploy').click()");for(const p of [a,b])await p.wait("document.getElementById('play').style.display==='block'");
 await a.evaluate("document.getElementById('commsToggle').click();document.getElementById('pingKind').value='needAmmo';document.getElementById('sendPing').click()");
 await b.wait("document.getElementById('squadPings').textContent.includes('Need ammunition')");
 await b.evaluate("document.getElementById('commsToggle').click()");
 await b.evaluate(`document.querySelector('[data-person="${aId}"] button:nth-of-type(3)').click()`);await b.wait("document.getElementById('reportDialog').open");
 await b.evaluate("document.getElementById('reportDetail').value='Isolated automated test report';document.getElementById('reportForm').requestSubmit()");await b.wait("document.getElementById('reportResult').textContent.includes('Report saved') && document.body.getAttribute('aria-busy')==='false'");
 const screenshot=await b.command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/headshotz-comms-report.png',Buffer.from(screenshot.data,'base64'));
 await b.evaluate("document.getElementById('reportCancel').click()");
 await b.evaluate(`document.querySelector('[data-person="${aId}"] button:nth-of-type(2)').click()`);await b.wait("document.getElementById('commsRoster').textContent.includes('Unblock') && document.body.getAttribute('aria-busy')==='false'");
 await b.wait("document.getElementById('squadPings').textContent===''");
 for(const p of [a,b]){
  await p.evaluate("document.getElementById('voiceEnable').click()");await p.wait("document.getElementById('voiceStatus').textContent.includes('Voice off') && document.body.getAttribute('aria-busy')==='false'");
  assert.equal(await p.evaluate("window.__testMedia.every(s=>s.getTracks().every(t=>t.readyState==='ended'))"),true,'disable releases microphone');
  assert.deepEqual(p.errors,[]);
 }
 console.log(JSON.stringify({optIn:true,pushToTalk:true,audioRtpReceived:true,muteDisconnect:true,unmuteReconnect:true,squadPing:true,reportSaved:true,blockSuppressesPing:true,microphoneReleased:true,browserErrors:[]}));
}finally{await h.close()}
