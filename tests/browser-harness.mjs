import assert from 'node:assert/strict';
async function connect(url){
 const socket=new WebSocket(url),pending=new Map(),errors=[];let seq=0;
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '))};
 socket.onclose=()=>{for(const p of pending.values())p.reject(new Error('Browser disconnected'));pending.clear()};
 return {socket,errors,command:(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Browser command timed out: '+method))},30000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});socket.send(JSON.stringify({id,method,params}))})};
}
export async function browserHarness(){
 const cdp=process.env.CDP_URL||'http://127.0.0.1:9336';
 const version=await(await fetch(cdp+'/json/version')).json(),root=await connect(version.webSocketDebuggerUrl),pages=[];
 return {
  async page(path='/raid-online.html'){
   const {browserContextId}=await root.command('Target.createBrowserContext',{disposeOnDetach:true});
   const {targetId}=await root.command('Target.createTarget',{url:'about:blank',browserContextId});
   const list=await(await fetch(cdp+'/json/list')).json(),target=list.find(t=>t.id===targetId);assert.ok(target,'Created browser target is inspectable');
   const p=await connect(target.webSocketDebuggerUrl);pages.push({p,targetId,browserContextId});
   p.background=async()=>{const {targetId:other}=await root.command('Target.createTarget',{url:'about:blank',browserContextId});await root.command('Target.activateTarget',{targetId:other});return async()=>{await root.command('Target.closeTarget',{targetId:other});await p.command('Page.bringToFront')}};
   p.browserContextId=browserContextId;p.grantPermissions=permissions=>root.command('Browser.grantPermissions',{browserContextId,origin:process.env.RAID_TEST_URL||'http://127.0.0.1:8021',permissions});
   p.evaluate=async expression=>{const result=await p.command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value};
   p.wait=async expression=>{const until=Date.now()+20000;while(Date.now()<until){try{if(await p.evaluate(expression))return}catch(error){if(!/Execution context.*destroyed|Cannot find context|Inspected target navigated/.test(error.message))throw error}await new Promise(r=>setTimeout(r,100))}throw new Error('Timed out: '+expression)};
   await p.command('Runtime.enable');await p.command('Page.enable');await p.command('Emulation.setFocusEmulationEnabled',{enabled:true});await p.command('Page.navigate',{url:(process.env.RAID_TEST_URL||'http://127.0.0.1:8021')+path});
   return p;
  },
  async close(){for(const {p,browserContextId}of pages){p.socket.close();await root.command('Target.disposeBrowserContext',{browserContextId})}root.socket.close()}
 };
}
