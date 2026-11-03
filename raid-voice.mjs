// Microphone access begins only in join(), called by the player's Enable voice button.
export class RaidVoice {
 constructor({api,accountId,onStatus=()=>{},onPeers=()=>{},now=()=>performance.now(),schedule=fn=>setInterval(fn,500),cancel=id=>clearInterval(id)}){this.now=now;this.schedule=schedule;this.cancel=cancel;this.api=api;this.accountId=accountId;this.onStatus=onStatus;this.onPeers=onPeers;this.connections=new Map();this.generation=0;this.cursor=0;this.talkSources=new Set();this.volume=.7;this.joined=false;this.polling=false;this.signalChain=Promise.resolve();this.lastSuccess=0}
 async join(scope){
  if(this.stream||this.starting)return;const generation=++this.generation;this.starting=true;this.clientId=crypto.randomUUID();const clientId=this.clientId;this.onStatus('Requesting microphone permission…');
  try{
   if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw new Error('Voice requires a supported browser on HTTPS or localhost.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(generation!==this.generation){for(const track of stream.getTracks())track.stop();return}
   this.stream=stream;for(const track of stream.getAudioTracks()){track.enabled=false;track.onended=()=>this.leave('Microphone disconnected. Enable voice to try again.')}
   const result=await this.api('voice',{type:'join',clientId,scope});
   if(generation!==this.generation){try{await this.api('voice',{type:'leave',clientId})}catch{}return}
   this.epoch=result.epoch;this.joined=true;this.scope=scope;this.cursor=0;this.lastSuccess=this.now();this.onStatus('Voice enabled · hold your push-to-talk key or Hold to talk. Microphone is quiet.');this.timer=this.schedule(()=>{if(this.now()-this.lastSuccess>6500)this.leave('Voice connection expired. Microphone released.');else this.poll()});await this.poll();
  }catch(error){if(generation===this.generation){await this.leave('Voice unavailable: '+error.message);throw error}}
  finally{if(generation===this.generation)this.starting=false}
 }
 async leave(message='Voice off. Microphone released.'){
  ++this.generation;this.starting=false;this.joined=false;this.polling=false;this.talkSources.clear();
  const clientId=this.clientId;this.clientId=null;
  const stream=this.stream;this.stream=null;if(stream)for(const track of stream.getTracks()){track.onended=null;track.stop()}
  try{this.cancel(this.timer)}catch{}
  for(const id of [...this.connections.keys()])this.closePeer(id);this.onPeers([]);this.onStatus(message);
  if(clientId)try{await this.api('voice',{type:'leave',clientId})}catch{}
 }
 setTalking(active,source='key'){
  active?this.talkSources.add(source):this.talkSources.delete(source);const talking=this.joined&&this.talkSources.size>0;
  for(const track of this.stream?.getAudioTracks()||[])track.enabled=talking;
  if(this.joined)this.onStatus(talking?'TRANSMITTING · release to stop.':'Voice enabled · microphone quiet. Hold your push-to-talk key or Hold to talk.');
 }
 quiet(){this.talkSources.clear();this.setTalking(false)}
 setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));for(const entry of this.connections.values())entry.audio.volume=this.volume*(entry.peer.gain??1)}
 async resumeAudio(){for(const entry of this.connections.values())if(entry.audio.srcObject)try{await entry.audio.play()}catch{this.onStatus('Audio playback is blocked by the browser. Use Resume voice audio.')}}
 closePeer(id){const entry=this.connections.get(id);if(!entry)return;this.connections.delete(id);entry.pc.onicecandidate=null;entry.pc.ontrack=null;entry.pc.onconnectionstatechange=null;entry.pc.close();entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove()}
 send(peer,kind,payload){
  const clientId=this.clientId,epoch=this.epoch;
  const work=()=>{if(!this.joined||clientId!==this.clientId)return;return this.api('voice',{type:'signal',clientId,epoch,target:peer.id,targetEpoch:peer.epoch,kind,payload})};
  this.signalChain=this.signalChain.catch(()=>{}).then(work);return this.signalChain;
 }
 async peer(peer,iceServers){
  let entry=this.connections.get(peer.id);if(entry&&entry.peer.epoch!==peer.epoch){this.closePeer(peer.id);entry=null}
  if(entry){entry.peer=peer;entry.audio.volume=this.volume*(peer.gain??1);return entry}
  const pc=new RTCPeerConnection({iceServers}),audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('aria-hidden','true');audio.dataset.voicePeer=peer.id;audio.volume=this.volume*(peer.gain??1);document.body.append(audio);
  entry={pc,audio,peer,pending:[],receivedBytes:0};this.connections.set(peer.id,entry);
  pc.onicecandidate=e=>{if(e.candidate)this.send(peer,'candidate',e.candidate.toJSON()).catch(()=>{})};
  pc.ontrack=e=>{audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.play().catch(()=>this.onStatus('Voice connected. Use Resume voice audio if you cannot hear it.'))};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){this.closePeer(peer.id);this.onStatus('A voice connection failed. Retrying; remote networks may require a TURN relay.')}};
  for(const track of this.stream.getAudioTracks())pc.addTrack(track,this.stream);
  if(this.accountId()<peer.id){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await this.send(peer,'offer',pc.localDescription.sdp)}
  return entry;
 }
 async poll(){
  if(!this.joined||this.polling)return;this.polling={};const marker=this.polling,generation=this.generation;
  try{
   if(this.now()-(this.renewed||0)>1800){await this.api('voice',{type:'renew',clientId:this.clientId});this.renewed=this.now()}
   const data=await this.api('voice?clientId='+encodeURIComponent(this.clientId)+'&after='+this.cursor);if(generation!==this.generation)return;
   if(!data.joined||data.epoch!==this.epoch){await this.leave('Voice session expired. Enable voice to reconnect.');return}
   const ids=new Set(data.peers.map(p=>p.id));for(const id of [...this.connections.keys()])if(!ids.has(id))this.closePeer(id);
   for(const peer of data.peers){if(generation!==this.generation)return;await this.peer(peer,data.iceServers||[])}
   for(const signal of data.signals){
    if(generation!==this.generation)return;
    const entry=this.connections.get(signal.from);if(!entry||signal.epoch!==entry.peer.epoch)continue;
    if(signal.kind==='candidate'){if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(signal.payload);else entry.pending.push(signal.payload)}
    else{
     await entry.pc.setRemoteDescription({type:signal.kind,sdp:signal.payload});for(const candidate of entry.pending)await entry.pc.addIceCandidate(candidate);entry.pending=[];
     if(signal.kind==='offer'){await entry.pc.setLocalDescription(await entry.pc.createAnswer());await this.send(entry.peer,'answer',entry.pc.localDescription.sdp)}
    }
   }
   if(generation!==this.generation)return;
   this.cursor=data.cursor;this.lastSuccess=this.now();this.onPeers(data.peers.map(p=>({...p,state:this.connections.get(p.id)?.pc.connectionState||'new'})));
  }catch(error){if(generation===this.generation){if(this.now()-this.lastSuccess>5500)await this.leave('Voice disconnected. Microphone released.');else this.onStatus('Voice reconnecting: '+error.message)}}
  finally{if(this.polling===marker)this.polling=false}
 }
}
