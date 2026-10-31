// Network-first service worker: always try fresh files (so updates show), fall back to cache offline.
const CACHE='headshotz-v86';
const ASSETS=['./','index.html','style.css','game.js','maps.js','maps2.js','mapdress.js','wskins.js','gfx.js','weapons.js','chests.js','photoguns.js','br.js','br2.js','chars.js','humans.js','gear.js','post.js','assets.js','ice.js','manifest.json','lib/three.module.min.js','lib/peerjs.min.js','lib/localpeer.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('headshotz-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if((u.pathname.startsWith('/api/')||u.pathname.startsWith('/health/'))){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>new Response(JSON.stringify({error:'Raid service offline. Reconnect to continue; your operator may remain at risk.'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})));return}
 e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(u.search?new Request(u.pathname):e.request,cp))}return r})
  .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
