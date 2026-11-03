// Run against an isolated service and Chrome profile:
// RAID_TEST_URL=http://127.0.0.1:8021 CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-smoke.mjs
import assert from 'node:assert/strict';
const cdp=process.env.CDP_URL||'http://127.0.0.1:9336',url=process.env.RAID_TEST_URL||'http://127.0.0.1:8021';
const target=await(await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),errors=[];let sequence=0;
await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)};
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value}
async function wait(expression){const until=Date.now()+15000;while(Date.now()<until){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw new Error('Timed out: '+expression)}
try{
 await command('Runtime.enable');await command('Page.enable');await command('Page.navigate',{url:url+'/raid-online.html'});
 await wait("!!document.getElementById('login')");
 await evaluate("fetch('/api/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(()=>true)");
 await command('Page.reload');
 await wait("document.getElementById('message')?.textContent.includes('Sign in')");
 const username='smoke_'+Date.now().toString(36);
 await evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value='a long smoke password';document.getElementById('register').click()`);
 await wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
 assert.match(await evaluate("document.getElementById('identity').textContent"),/250 credits/);
 await evaluate("document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
 await wait("document.getElementById('play').style.display==='block' && document.getElementById('hud').textContent.includes('HP 100')");
 assert.equal(await evaluate("document.getElementById('view').width>0"),true);
 const initial=await evaluate("fetch('/api/raid').then(r=>r.json())");
 await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});
 await new Promise(r=>setTimeout(r,700));
 await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 const moved=await evaluate("fetch('/api/raid').then(r=>r.json())");
 assert.ok(Math.hypot(initial.self.x-moved.self.x,initial.self.z-moved.self.z)>1,'Server accepted bounded keyboard movement');
 await evaluate("document.getElementById('leave').click()");await wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
 await evaluate("document.getElementById('resume').click()");await wait("document.getElementById('play').style.display==='block'");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({account:true,recoveryDeployment:true,rendered:true,serverMovement:true,reconnect:true,browserExceptions:errors}));
}finally{socket.close();await fetch(cdp+'/json/close/'+target.id)}
