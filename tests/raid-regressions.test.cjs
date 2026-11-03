// Run with: node --test tests/raid-regressions.test.cjs
// Exercise production handlers with isolated networking/storage boundaries.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,`Missing production section: ${start}`);
 return source.slice(a,b);
}
function context(extra={}){
 const messages=[];
 const c={messages,H:{mode:'raid',phase:'play',t:10,players:{},raid:{items:{},settle:{}}},
  RAID:{v:63,cap:18,secure:2,recCap:12,recSecure:1,maxP:9,perSquad:3},
  RAIDM:m=>m==='raid',BRM:m=>m==='br'||m==='brs',MAXP:10,
  RSQCOL:[11,22,33],TEAMCOL:{A:11,B:22},FFACOL:[1,2,3,4,5,6,7,8,9,10],
  RARCH:{scout:{color:44}},W:{ar:{slot:0}},conns:{},
  sendTo:(id,m)=>messages.push({id,...m}),bcast:()=>{},sendSB:()=>{},sendRaidStat:()=>{},
  raidClamp:(v,a,b)=>Math.max(a,Math.min(b,v)),raidLootPubs:()=>[],
  cleanSkin:x=>x,cleanWS:x=>x,clOf:x=>x,fitOf:x=>x,
  lobbyData:()=>({t:'lobby'}),startData:()=>({t:'start'}),
  newP:(id,name)=>({id,name,team:'A',alive:false,ord:Object.keys(c.H.players).length}),
  MODEMAX:{team:4,ffa:10,ext:4,ctf:8,raid:9},...extra};
 c.plist=()=>Object.values(c.H.players);
 let itemN=0;
 c.raidNewItem=(R,kind,opt)=>{const it={id:'item'+(++itemN),kind,...opt};R.items[it.id]=it;return it};
 vm.createContext(c);
 vm.runInContext(section('function raidLoad(from,m,p){','window.__raid='),c);
 vm.runInContext(section('function raidAssignSquads(){','function raidSpawnZones('),c);
 vm.runInContext(section('function teamForJoiner(id){','\n'),c);
 vm.runInContext(section('function hostHandle(from,m){','function rayClearHost('),c);
 return c;
}
function load(c,p,id,gear={weapon:'ar',armor:1,meds:3}){
 c.raidLoad(p.id,{rv:63,deployId:id,gear},p);
}
test('changing deployment ID cannot heal or generate more equipment',()=>{
 const c=context(),p={id:'p',alive:true};load(c,p,'original');
 p.hp=10;p.raiPack.pop();const gear=p.raiGear,pack=p.raiPack;
 const count=Object.keys(c.H.raid.items).length;
 load(c,p,'forged');
 assert.equal(p.hp,10);assert.equal(p.raiGear,gear);assert.equal(p.raiPack,pack);
 assert.equal(Object.keys(c.H.raid.items).length,count);assert.equal(p.raiDeploy,'original');
 assert.equal(c.messages.at(-1).t,'rerr');
});
test('legitimate retries return current state without healing or refilling',()=>{
 const c=context(),p={id:'p',alive:true};load(c,p,'original');p.hp=9;p.raiPack.pop();
 const count=Object.keys(c.H.raid.items).length;
 for(const id of ['original',''])load(c,p,id,{weapon:'ar',armor:0,meds:3});
 assert.equal(p.hp,9);assert.equal(p.raiPack.length,2);
 assert.equal(Object.keys(c.H.raid.items).length,count);assert.equal(c.messages.at(-1).t,'rloadok');
});
test('first load must match deployment already bound during joining',()=>{
 const c=context(),p={id:'p',alive:true,raiDeploy:'reserved',hp:12};
 load(c,p,'different');assert.equal(p.hp,12);assert.equal(Object.keys(c.H.raid.items).length,0);
 load(c,p,'reserved');assert.equal(p.raiLoaded,'reserved');
});
test('repeating hello cannot replace a deployed player or its equipment',()=>{
 const c=context(),p={id:'p',alive:true,raiDeploy:'reserved',hp:12};c.H.players.p=p;
 c.conns.p={send:m=>c.messages.push(m)};
 c.hostHandle('p',{t:'hello',rv:63,deployId:'different'});
 assert.equal(c.H.players.p,p);assert.equal(p.hp,12);assert.equal(p.raiDeploy,'reserved');
 assert.equal(c.messages.at(-1).t,'rerr');
});
test('disconnect preserves downed state and the original bleed deadline',()=>{
 const c=context();vm.runInContext(section('function hostLeave(id){','function hostHandle('),c);
 const p={id:'p',alive:true,down:true,hp:0,dhp:25,downT:22,rev:{by:'friend'}};
 c.H.players.p=p;c.hostLeave('p');
 assert.equal(p.raiGhost,1);assert.equal(p.down,true);assert.equal(p.hp,0);
 assert.equal(p.dhp,25);assert.equal(p.downT,22);assert.equal(p.rev.by,'friend');
});
for(const mode of ['ffa','team','ctf','ext'])test(`${mode} mid-match join retains its own team rules`,()=>{
 const c=context();c.H.mode=mode;c.H.raid=null;
 c.H.players={a:{id:'a',team:'A'},b:{id:'b',team:'A'},d:{id:'d',team:'B'}};
 c.conns.joiner={send:m=>c.messages.push(m)};
 c.hostHandle('joiner',{t:'hello',name:'Joiner'});
 const p=c.H.players.joiner;
 assert.equal(p.team,mode==='ffa'?'joiner':mode==='ext'?'A':'B');
 assert.equal(p.raidSq,undefined);assert.equal(p.respawn,11);
});
test('parties stay together without exceeding squad capacities',()=>{
 const c=context();
 for(let i=0;i<9;i++)c.H.players['p'+i]={id:'p'+i,party:i<3?'trio':i<5?'duo':null};
 c.raidAssignSquads();const ps=c.plist();
 assert.equal(new Set(ps.slice(0,3).map(p=>p.team)).size,1);
 assert.equal(ps[3].team,ps[4].team);
 for(const team of ['A','B','C'])assert.equal(ps.filter(p=>p.team===team).length,3);
});
test('a late party member replaces bot capacity in the same squad',()=>{
 const c=context();c.H.players={a:{id:'a',party:'friends',team:'B'},b:{id:'b',bot:true,team:'B'},d:{id:'d',bot:true,team:'B'}};
 const p={id:'new',party:'friends'};
 assert.equal(c.raidJoinTeam(p),'B');assert.equal(p.team,'B');
});
test('full party squad rejects late member instead of splitting it',()=>{
 const c=context();c.H.players={a:{id:'a',party:'friends',team:'B'},b:{id:'b',team:'B'},d:{id:'d',team:'B'}};
 assert.equal(c.raidJoinTeam({id:'new',party:'friends'}),null);
});
test('lobby rejects a fourth party member before changing roster',()=>{
 const c=context();c.H.phase='lobby';
 for(let i=0;i<3;i++)c.H.players['p'+i]={id:'p'+i,party:'friends',team:'A'};
 c.conns.new={send:m=>c.messages.push(m)};
 c.hostHandle('new',{t:'hello',party:'friends'});
 assert.equal(c.H.players.new,undefined);assert.equal(c.messages.at(-1).t,'full');
});
test('loadout edits and saving preserve damaged condition and other metadata',()=>{
 let saved;
 const stash={gear:{weapon:'ar',armor:true,meds:1,insure:false,contract:'cores',wcond:25,acond:30,custom:'preserve'}};
 const ui={raidRecovery:{checked:false},raidMap:{value:'0'},raidWeapon:{value:'ar'},raidArmor:{checked:true},raidMeds:{value:'2'},raidInsure:{checked:true},raidContract:{value:'extract'}};
 const c={raidStash:()=>stash,$:id=>ui[id],raidSaveStash:s=>{saved=JSON.parse(JSON.stringify(s))},raidClamp2:(v,a,b)=>Math.max(a,Math.min(b,v))};
 vm.createContext(c);vm.runInContext(section('function raidUiGear(){','function raidRenderBase(){'),c);
 c.raidUiGear();c.raidUiGear();
 assert.equal(saved.gear.wcond,25);assert.equal(saved.gear.acond,30);assert.equal(saved.gear.custom,'preserve');
 assert.equal(saved.gear.contract,'extract');assert.equal(saved.gear.meds,2);
});
