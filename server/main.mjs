import {MATCH_POLICY,matchPreferences} from '../shared/raid-matchmaking.mjs';
import {MatchmakingProbes} from './matchmaking.mjs';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RaidStore,RuleError} from './store.mjs';
import {RaidService} from './raids.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {RaidComms} from './comms.mjs';
import {AccountSecurity} from './account-security.mjs';
import {sessionLabel,digest} from './credentials.mjs';
import {RAID_PROTOCOL,validateAction} from '../shared/raid-protocol.mjs';
import {Operations} from './operations.mjs';
import {startControlSocket} from './control.mjs';
import {RateLimiter} from './rate-limit.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const token=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('raid_session='))?.slice(13)||'';
const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value))};
async function body(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new RuleError('JSON content type required',415);
 let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>8192)throw new RuleError('Request too large',413)}
 try{const parsed=JSON.parse(data||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed}catch{throw new RuleError('Expected a JSON object',400)}
}
export function createRaidServer(store,{secureCookies=false,now,region='local',iceServers=[],build='development',maxOperators}={}){
 const raids=new RaidService(store,{now,region,maxOperators}),probes=new MatchmakingProbes(store),rates=new RateLimiter(),comms=new RaidComms(store,raids,{now,iceServers}),accounts=new AccountSecurity(store),operations=new Operations({store,raids,rates,comms,region,build});let last=performance.now(),disposed=false,shutdownError=null;
 const timer=setInterval(()=>{const next=performance.now();let failed=false;try{raids.tick((next-last)/1000);comms.prune()}catch(error){failed=true;console.error(JSON.stringify({event:'raid_tick_failure',code:/^SQLITE_[A-Z_]+$/.test(error.code||'')?error.code:'SIMULATION_FAILURE'}))}finally{operations.tick(performance.now()-next,failed,next-last);last=next}},50);timer.unref();
 const dispose=()=>{if(disposed)return;disposed=true;clearInterval(timer);operations.close();try{raids.close()}catch(error){shutdownError=error;console.error(JSON.stringify({event:'shutdown_checkpoint_failed',code:'CHECKPOINT_FAILURE'}))}};

 const server=createServer(async(req,res)=>{
  operations.track(req,res);
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','same-origin');
  try{
   const url=new URL(req.url,'http://localhost'),label=sessionLabel(req.headers['user-agent']);
   if(req.method==='GET'&&url.pathname==='/health/live')return json(res,200,{status:'alive'});
   if(req.method==='GET'&&url.pathname==='/health/ready'){const ready=operations.ready();return json(res,ready?200:503,{status:ready?'ready':'not_ready'})}
   const setSession=auth=>res.setHeader('set-cookie',`raid_session=${auth?.token||''}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${auth?604800:0}${secureCookies?'; Secure':''}`);
   if(url.pathname.startsWith('/api/')){
    const key=req.socket.remoteAddress||'local';rates.check('ip:'+key,30000);
    if(req.method==='POST'&&['/api/register','/api/login'].includes(url.pathname))rates.check('auth:'+key,20);
    if(req.headers.origin&&req.headers.origin!==`${secureCookies?'https':'http'}://${req.headers.host}`)throw new RuleError('Origin rejected',403);
    if(req.method==='POST'&&url.pathname==='/api/recover'){rates.check('recover-ip:'+key,10,900000);const data=await body(req);rates.check('recover-account:'+String(data.username||'').trim().toLowerCase().slice(0,24),5,900000);const recovered=accounts.recover(data);comms.revoke(recovered.account);setSession(null);return json(res,200,{ok:true})}
    if(req.method==='GET'&&url.pathname==='/api/worlds')return json(res,200,RAID_WORLDS);
    if(req.method==='GET'&&url.pathname==='/api/capabilities')return json(res,200,{protocol:RAID_PROTOCOL,region,partyModes:['solo','duo','trio'],maxPlayers:MATCH_POLICY.maxPlayers,maxOperators:raids.maxOperators,matchmaking:MATCH_POLICY});
    if(req.method==='POST'&&['/api/register','/api/login'].includes(url.pathname)){
     const data=await body(req);rates.check('credentials:'+String(data.username||'').trim().toLowerCase().slice(0,24),10);if(url.pathname==='/api/register')store.register(data.username,data.password);
     const auth=store.login(data.username,data.password,label);
     setSession(auth);return json(res,200,auth.account);
    }
    const session=token(req),account=store.authenticate(session);
    rates.check('account:'+account,2400);
    if(req.method==='GET'&&url.pathname==='/api/sessions')return json(res,200,accounts.list(session));
    if(req.method==='GET'&&url.pathname==='/api/matchmaking')return json(res,200,{region,policy:MATCH_POLICY});
    if(req.method==='GET'&&url.pathname==='/api/profile')return json(res,200,store.profile(account));
    if(req.method==='GET'&&url.pathname==='/api/results')return json(res,200,store.results(account));
    if(req.method==='GET'&&url.pathname==='/api/market')return json(res,200,store.market(account));
    if(req.method==='GET'&&url.pathname==='/api/raid')return json(res,200,raids.snapshot(account,url.searchParams.get('spectate')));
    if(req.method==='GET'&&url.pathname==='/api/social')return json(res,200,comms.preferences(account));
    if(req.method==='GET'&&url.pathname==='/api/voice')return json(res,200,comms.poll(account,url.searchParams.get('clientId'),Number(url.searchParams.get('after')||0)));
    if(req.method==='GET'&&url.pathname==='/api/party'){const party=store.partyFor(account);if(party)party.members=party.members.map(m=>({...m,latency:probes.status(m.account,party.match?.maxRttMs||0)}));return json(res,200,party)}
    if(req.method==='POST'){
     const data=await body(req);
     // A session can be revoked while an HTTP body is still arriving.
     if(store.authenticate(session)!==account)throw new RuleError('Sign in required',401);
     const category=url.pathname==='/api/action'?(['move','fire'].includes(data.type)?data.type:'otherAction'):url.pathname;
     rates.check('action:'+account+':'+category,category==='move'||category==='fire'?1200:240);
     if(url.pathname==='/api/logout'){store.logout(session);comms.revoke(account,digest(session));setSession(null);return json(res,200,{ok:true})}
     if(['/api/change-password','/api/recovery-codes','/api/revoke-session'].includes(url.pathname)){
      rates.check('security:'+account,10,900000);
      if(url.pathname==='/api/change-password'){const auth=accounts.changePassword(session,data,label);comms.revoke(account);setSession(auth);return json(res,200,{ok:true})}
      if(url.pathname==='/api/recovery-codes')return json(res,200,accounts.generateCodes(session,data.currentPassword));
      const result=accounts.revoke(session,data,label);if(result.auth){comms.revoke(account);setSession(result.auth)}else comms.revoke(account,result.revokedToken);return json(res,200,{ok:true});
     }
     if(url.pathname==='/api/matchmaking'){rates.check('latency:'+account,30);if(data.operation==='probe')return json(res,200,probes.issue(account,digest(session)));if(data.operation==='measure')return json(res,200,probes.finish(account,digest(session),data.nonce));throw new RuleError('Unknown latency operation',400)}
     if(url.pathname==='/api/deploy'){
      if(data.protocol!==RAID_PROTOCOL)throw new RuleError('Client update required. Reload to deploy safely.',426);const known=raids.byAccount.get(account),retry=known&&!known.result&&known.requestId===data.requestId;
      if(operations.draining&&!retry)throw new RuleError('Server draining; finish your active raid and deploy after maintenance',503);if(!operations.draining&&!operations.ready())throw new RuleError('Server not ready for new deployments',503);
      if(!retry){const party=store.partyFor(account);let match;try{match=matchPreferences(party?.match??data.match)}catch(error){throw new RuleError(error.message,400)}probes.require(account,match.maxRttMs,{session:digest(session),proofId:data.latencyProof});for(const member of party?.members||[])if(member.account!==account)probes.require(member.account,match.maxRttMs)}
      return json(res,200,raids.deploy(account,data));
     }
     if(url.pathname==='/api/action'){if(data.protocol!==RAID_PROTOCOL)throw new RuleError('Client update required. Reload to use the current game protocol.',426);try{validateAction(data,{wire:true})}catch(error){throw new RuleError(error.message,400)}let ack;try{ack=raids.action(account,data)}catch(error){const p=raids.byAccount.get(account);if(data.includeState&&p?.raidId===data.raidId&&p?.deploymentId===data.deploymentId)try{error.state=raids.snapshot(account)}catch{}throw error}return json(res,200,{ok:true,ack,...(data.includeState?{state:raids.snapshot(account)}:{})})}
     if(url.pathname==='/api/trade')return json(res,200,store.trade(account,data));
     if(url.pathname==='/api/social'){rates.check('social:'+account,30);return json(res,200,comms.social(account,data))}
     if(url.pathname==='/api/voice'){rates.check('voice:'+account,180);return json(res,200,data.type==='signal'?comms.signal(account,data):comms.presence(account,data,digest(session)))}
     if(url.pathname==='/api/party'){if(data.type==='ready'&&data.ready){const party=store.partyFor(account),match=matchPreferences(party?.match);probes.require(account,match.maxRttMs,{session:digest(session),proofId:data.latencyProof})}return json(res,200,raids.party(account,data))}
    }
    throw new RuleError('Unknown endpoint',404);
   }
   if(req.method!=='GET')throw new RuleError('Method not allowed',405);
   let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{throw new RuleError('Invalid path encoding',400)}const file=await realpath(resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname)));
   const relative=file.slice(ROOT.length+1);
   if(!file.startsWith(ROOT+sep)||relative.split(sep).some(p=>p.startsWith('.'))||['server','tests','scripts','dev'].includes(relative.split(sep)[0])||!mime[extname(file)])throw new RuleError('Not found',404);
   const info=await stat(file);if(!info.isFile())throw new RuleError('Not found',404);
   const content=await readFile(file);
   res.writeHead(200,{'content-type':mime[extname(file)],'cache-control':'no-cache'});
   res.end(file===resolve(ROOT,'index.html')?content.toString().replace('<head>','<head><meta name="headshotz-raid-service" content="1">'):content);
  }catch(error){if(error.status===429)res.setHeader('retry-after','60');json(res,error instanceof RuleError?error.status:error.code==='ENOENT'?404:500,{error:error instanceof RuleError?error.message:error.code==='ENOENT'?'Not found':'Server could not complete the request',...(error.ack?{ack:error.ack}:{}),...(error.state?{state:error.state}:{})})}
 });
 server.headersTimeout=10000;server.requestTimeout=10000;server.keepAliveTimeout=5000;server.on('listening',()=>{operations.listening=true});server.on('close',dispose);return {server,raids,comms,accounts,probes,operations,dispose,get shutdownError(){return shutdownError}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const data=process.env.RAID_DATA_DIR||resolve(ROOT,'.raid-data');let store,runtime,control;
 try{
  await mkdir(data,{recursive:true,mode:0o700});store=new RaidStore(resolve(data,'raid.sqlite'));
  runtime=createRaidServer(store,{secureCookies:process.env.RAID_SECURE_COOKIES==='1',region:process.env.RAID_REGION||'local',iceServers:JSON.parse(process.env.RAID_ICE_SERVERS||'[]'),build:process.env.RAID_BUILD_ID||'development',maxOperators:process.env.RAID_MAX_OPERATORS===undefined?undefined:Number(process.env.RAID_MAX_OPERATORS)});
  control=await startControlSocket({path:resolve(data,'.ops/control.sock'),operations:runtime.operations});
  const port=Number(process.env.PORT||8020),host=process.env.HOST||'127.0.0.1';
  await new Promise((resolve,reject)=>{const error=e=>reject(e);runtime.server.once('error',error);runtime.server.listen(port,host,()=>{runtime.server.removeListener('error',error);resolve()})});
  console.log(`HeadShotz raid service: http://${host}:${runtime.server.address().port} (durable raid checkpoints enabled)`);
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;try{runtime.operations.setDraining(true,{reason:'maintenance'})}catch{runtime.operations.draining=true}await control.close();const force=setTimeout(()=>runtime.server.closeAllConnections(),10000);force.unref();await new Promise(resolve=>runtime.server.close(resolve));clearTimeout(force);store.close();process.exit(runtime.shutdownError?1:0)};
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop().catch(()=>{console.error('Shutdown failed');process.exit(1)}));
 }catch(error){if(control)try{await control.close()}catch{}if(runtime){if(runtime.server.listening)await new Promise(resolve=>runtime.server.close(resolve));else runtime.dispose()}if(store)try{store.close()}catch{}console.error('Raid service startup failed: '+(error.code||error.message));process.exitCode=1}
}
