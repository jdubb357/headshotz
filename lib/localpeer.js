// Test-only transport (?net=local): emulates the PeerJS API across tabs of one browser via BroadcastChannel.
(function(){if(!/[?&]net=local/.test(location.search))return;
const bc=new BroadcastChannel('hsz-local');const peers={};const pending=[];
class Em{constructor(){this.h={}}on(e,f){(this.h[e]=this.h[e]||[]).push(f);return this}off(){}emit(e,...a){(this.h[e]||[]).slice().forEach(f=>{try{f(...a)}catch(err){console.error(err)}})}}
class Conn extends Em{constructor(owner,other,cid){super();this.owner=owner;this.self=owner.id;this.peer=other;this.cid=cid;this.open=false}
 send(d){if(!this.open)return;bc.postMessage({k:'d',to:this.peer,from:this.self,cid:this.cid,d:JSON.parse(JSON.stringify(d))})}
 close(){if(!this.open&&!this.owner.c[this.cid])return;bc.postMessage({k:'cls',to:this.peer,from:this.self,cid:this.cid});this._closed()}
 _closed(){if(this.dead)return;this.dead=true;this.open=false;delete this.owner.c[this.cid];this.emit('close')}}
class LP extends Em{constructor(id){super();if(typeof id!=='string')id='p'+Math.random().toString(36).slice(2,9);this.id=id;this.c={};this.connections={};this.destroyed=false;
 setTimeout(()=>{bc.postMessage({k:'who',id});this._t=setTimeout(()=>{if(this.destroyed)return;peers[id]=this;this.open=true;this.emit('open',id)},250)},10)}
 connect(to){const cid=Math.random().toString(36).slice(2);const c=new Conn(this,to,cid);this.c[cid]=c;bc.postMessage({k:'conn',to,from:this.id,cid});
  c._to=setTimeout(()=>{if(c.open)return;delete this.c[cid];this.emit('error',{type:'peer-unavailable',message:'Could not connect to peer '+to})},900);return c}
 destroy(){if(this.destroyed)return;this.destroyed=true;clearTimeout(this._t);for(const k in this.c){const c=this.c[k];bc.postMessage({k:'cls',to:c.peer,from:this.id,cid:k});c._closed()}if(peers[this.id]===this)delete peers[this.id];bc.postMessage({k:'gone',id:this.id})}
 disconnect(){}reconnect(){}}
bc.onmessage=({data:m})=>{
 if(m.k==='who'){if(peers[m.id])bc.postMessage({k:'taken',id:m.id});return}
 if(m.k==='taken'){for(const p of pending)if(p.id===m.id&&!peers[m.id]&&!p.destroyed){clearTimeout(p._t);p.destroyed=true;p.emit('error',{type:'unavailable-id',message:'ID "'+m.id+'" is taken'})}return}
 if(m.k==='gone'){for(const id in peers){const p=peers[id];for(const k in p.c)if(p.c[k].peer===m.id)p.c[k]._closed()}return}
 const p=peers[m.to];if(!p)return;
 if(m.k==='conn'){const c=new Conn(p,m.from,m.cid);c.open=true;p.c[m.cid]=c;p.connections[m.from]=[c];p.emit('connection',c);bc.postMessage({k:'ack',to:m.from,cid:m.cid});setTimeout(()=>c.emit('open'),0)}
 if(m.k==='ack'){const c=p.c[m.cid];if(c){clearTimeout(c._to);c.open=true;c.emit('open')}}
 if(m.k==='cls'){const c=p.c[m.cid];if(c)c._closed()}
 if(m.k==='d'){const c=p.c[m.cid];if(c)c.emit('data',m.d)}};
addEventListener('pagehide',()=>{for(const id in peers)peers[id].destroy()});
window.Peer=function(id){const p=new LP(id);pending.push(p);return p};})();
