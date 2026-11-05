// HeadShotz v62 ADMIN ABUSE events (America/Chicago clock, DST-safe via Intl):
//   daily 6:00-7:00 PM CT, plus Sat + Sun 12:00-1:00 PM CT. Claim once per event window: +1000 diamonds and 3 free Secret chests.
// Test overrides: ?adminabuse=1 (forces an active 1-hour event; the value becomes the event id) and window.__mockNow (ms) like the weekend event.
export const AA_DIA=1000,AA_CHESTS=3;
const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hourCycle:'h23',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const pad=n=>String(n).padStart(2,'0');
export function ctParts(ms){const o={};for(const p of fmt.formatToParts(new Date(ms)))o[p.type]=p.value;return{y:+o.year,mo:+o.month,d:+o.day,h:(+o.hour)%24,mi:+o.minute,s:+o.second,wd:o.weekday}}
// returns {key,start,end,left(seconds)} while an event is running, else null. Seconds-into-the-CT-day arithmetic is exact because DST changes happen at 2 AM, never inside 12:00-13:00 or 18:00-19:00.
export function adminWindow(ms){const c=ctParts(ms),wk=c.wd==='Sat'||c.wd==='Sun',sod=c.h*3600+c.mi*60+c.s;const slots=[[18,19,'eve']];if(wk)slots.push([12,13,'noon']);
 for(const[a,b,tag]of slots)if(sod>=a*3600&&sod<b*3600)return{key:`${c.y}-${pad(c.mo)}-${pad(c.d)}@${tag}`,start:ms-(sod-a*3600)*1000,end:ms+(b*3600-sod)*1000,left:b*3600-sod};return null}
// next start (for tests/info): scans minute by minute up to 8 days (cheap, only called on demand)
export function nextAdmin(ms){for(let t=ms;t<ms+8*86400e3;t+=60e3){const w=adminWindow(t);if(w&&!adminWindow(t-60e3))return{key:w.key,start:t}}return null}
const q=new URLSearchParams(location.search);const FORCE=q.get('adminabuse');
const t0=Date.now();
export function adminNow(){const now=window.__mockNow!=null?window.__mockNow:Date.now();
 if(FORCE&&FORCE!=='0'){const key='test-'+FORCE+(window.__aaTestKey||'');return{key,start:t0,end:t0+3600e3,left:Math.max(0,Math.round((t0+3600e3-Date.now())/1000)),test:1}}
 return adminWindow(now)}
export function initAdminAbuse(A){const P=A.PROG;let el=null,last='';
 const claimed=k=>Array.isArray(P.aa)&&P.aa.includes(k);
 function claim(){const w=adminNow();if(!w||claimed(w.key))return null;P.aa=(Array.isArray(P.aa)?P.aa:[]).concat(w.key).slice(-14);P.dia=(P.dia|0)+AA_DIA;P.free=P.free||{};P.free.secret=(P.free.secret|0)+AA_CHESTS;A.save();A.onClaim&&A.onClaim(w);upd(true);return{dia:AA_DIA,chests:AA_CHESTS,key:w.key}}
 function mk(){el=document.createElement('div');el.id='adminBan';el.className='hidden';el.innerHTML='<div class="aaPill"><span class="aaT">⚡ ADMIN ABUSE ⚡</span><span class="aaC" id="aaCount"></span><button id="aaBtn" type="button"></button></div>';document.body.appendChild(el);
  el.querySelector('#aaBtn').addEventListener('click',e=>{e.stopPropagation();const w=adminNow();if(!w)return;if(!claimed(w.key)){const r=claim();if(r)A.toast&&A.toast(`⚡ ADMIN ABUSE: +${r.dia} 💎 and ${r.chests} Secret chests! Open them in the Chest Shop.`)}else A.openChests&&A.openChests()})}
 function upd(force){if(!el)mk();const w=adminNow(),on=!!w;document.body.classList.toggle('aaOn',on);el.classList.toggle('hidden',!on);if(!on){last='';return}
  const l=Math.max(0,w.left),hh=Math.floor(l/3600),mm=Math.floor(l%3600/60),ss=l%60,txt=`${hh?hh+':':''}${pad(mm)}:${pad(ss)} LEFT`;const cl=claimed(w.key),free=(P.free&&P.free.secret)|0,ig=A.inGame&&A.inGame();
  const sig=txt+'|'+cl+'|'+free+'|'+ig;if(!force&&sig===last)return;last=sig;el.querySelector('#aaCount').textContent=txt;const b=el.querySelector('#aaBtn');b.textContent=cl?(free>0?`OPEN ${free} SECRET CHEST${free>1?'S':''}`:'CLAIMED ✔'):`CLAIM +${AA_DIA} 💎 + ${AA_CHESTS} CHESTS`;b.dataset.s=cl?(free>0?'open':'done'):'claim';b.style.display=ig?'none':'';el.classList.toggle('aaGame',!!ig)}
 setInterval(()=>upd(false),500);upd(true);
 return{claim,upd,win:adminNow,claimed:()=>{const w=adminNow();return !!(w&&claimed(w.key))}}}
