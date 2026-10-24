// Test-only transport (?net=local): emulates the PeerJS API across tabs of one browser via BroadcastChannel.
(function(){if(!/[?&]net=local/.test(location.search))return;
const bc=new BroadcastChannel('hsz-local');const peers={};
class Em{constructor(){this.h={}}on(e,f){(this.h[e]=this.h[e]||[]).push(f)}emit(e,...a){(this.h[e]||[]).forEach(f=>f(...a))}}
class Conn extends Em{constructor(self,other,cid){super();this.self=self;this.peer=other;this.cid=cid;this.open=false}
 send(d){bc.postMessage({k:'d',to:this.peer,from:this.self,cid:this.cid,d:JSON.parse(JSON.stringify(d))})}}
class LP extends Em{constructor(id){super();if(typeof id!=='string')id='p'+Math.random().toString(36).slice(2,9);this.id=id;this.c={};this.connections={};
 setTimeout(()=>{bc.postMessage({k:'who',id});this._t=setTimeout(()=>{peers[id]=this;this.emit('open',id)},300)},10)}
 connect(to){const cid=Math.random().toString(36).slice(2);const c=new Conn(this.id,to,cid);this.c[cid]=c;bc.postMessage({k:'conn',to,from:this.id,cid});
  c._to=setTimeout(()=>this.emit('error',{type:'peer-unavailable'}),1500);return c}
 destroy(){delete peers[this.id]}reconnect(){}}
bc.onmessage=({data:m})=>{
 if(m.k==='who'){if(peers[m.id])bc.postMessage({k:'taken',id:m.id});return}
 if(m.k==='taken'){for(const p of pending)if(p.id===m.id){clearTimeout(p._t);p.emit('error',{type:'unavailable-id'})}return}
 const p=peers[m.to];if(!p)return;
 if(m.k==='conn'){const c=new Conn(p.id,m.from,m.cid);c.open=true;p.c[m.cid]=c;p.connections[m.from]=[c];p.emit('connection',c);bc.postMessage({k:'ack',to:m.from,cid:m.cid});setTimeout(()=>c.emit('open'),0)}
 if(m.k==='ack'){const c=p.c[m.cid];if(c){clearTimeout(c._to);c.open=true;c.emit('open')}}
 if(m.k==='d'){const c=p.c[m.cid];if(c)c.emit('data',m.d)}};
const pending=[];const Orig=LP;window.Peer=function(id){const p=new Orig(id);pending.push(p);return p};})();
