// HeadShotz v103 pets: Celestial Chimera (every safe ability, automatic) and rideable mounts.
// No third-party assets. Host applies damage, shields and loot; the client only moves and draws.
export const RIDES={
 spincapy:{spd:[1.35,1.5,1.7],jump:[1.25,1.4,1.55],atk:1,spin:1,heavy:40,grab:2},
 stormwolf:{spd:[1.45,1.65,1.9],jump:[1.35,1.55,1.75],atk:1,heavy:45},
 rocketrich:{spd:[1.7,1.95,2.2],jump:[1.8,2.1,2.4],atk:0,heavy:35},
 raptor:{spd:[1.55,1.8,2.05],jump:[1.5,1.75,2.0],atk:1,heavy:50},
 fizzy:{spd:[1.42,1.58,1.78],jump:[1.32,1.48,1.68],atk:1,heavy:42,veil:1,tongue:1}
};
export const rideOf=(id,tier=1)=>{const r=RIDES[id];if(!r)return null;const i=Math.max(0,Math.min(2,(tier|0)-1));return{id,spd:r.spd[i],jump:r.jump[i],atk:!!r.atk,spin:!!r.spin,heavy:r.heavy,grab:r.grab||0,veil:!!r.veil,tongue:!!r.tongue}};
export const shouldDismount=(dmg,heavy)=>dmg>=(heavy||40);
// kinds: 1 ammo, 2 medkits and shields. take(player, itemId, far) is the host pickup.
export function grabNearby(E,p,R,kinds,take,max=4){if(!E||!E.items||!p||!p.p)return 0;let n=0;
 for(const k in E.items){const it=E.items[k];if(!kinds.includes(it[1]))continue;if(Math.hypot(p.p[0]-it[4],p.p[2]-it[6])>R||Math.abs(p.p[1]-it[5])>3.2)continue;if(take(p,+k,true)&&++n>=max)break}return n}
function nearestEnemy(X,p,H,R){let best=null,bd=1e9;const t=H.t;
 for(const q of X.plist()){if(q.id===p.id||!q.alive||q.down||q.air||(q.prot&&t<q.prot)||!X.enemy(p,q))continue;const dd=Math.hypot(q.p[0]-p.p[0],q.p[1]-p.p[1],q.p[2]-p.p[2]);if(dd>R||dd>=bd||!X.los(p,q))continue;bd=dd;best=q}return best}
// Passives from every buddy, plus a rotating active that does not lock out shooting (no bat form, no phase).
export function hostOmni(X,p,S,H,pw,tr,dt){const t=H.t;
 if(t>=(S.g||0)&&!H.noFight){const best=nearestEnemy(X,p,H,5+pw);if(best){S.g=t+4.2;X.bcast({t:'pfx',k:'zap',id:p.id,v:best.id});X.damage(best,Math.round(8+4*pw),p.id,false,'fists')}else S.g=t+.35}
 if(p.hp<100){const o=Math.floor(p.hp);p.hp=Math.min(100,p.hp+omniHealRate(pw,t-(p.hurtT||0)>4)*dt);if(Math.floor(p.hp)!==o)X.bcast({t:'hp',id:p.id,hp:Math.round(p.hp)})}
 if(t>=(S.shT||0)&&(p.sh||0)<25){S.shT=t+26/Math.max(.6,pw);p.sh=25;X.toPlayer(p.id,{t:'shd',sh:25});X.bcast({t:'pfx',k:'shield',id:p.id})}
 if(t>=(S.mag||0)){S.mag=t+.35;grabNearby(H.br,p,6.5+pw,[1,2],(who,id)=>X.take(who,id,true),4)}
 S.fl=S.fl||[];if(t>=(S.fd||8)){S.fl=S.fl.filter(x=>t-x<360);if(S.fl.length<4){S.fl.push(t);S.fd=t+60/Math.max(.6,pw);X.toPlayer(p.id,{t:'pdia',n:1})}else S.fd=t+20}
 if(S.fire&&t<S.fire.until&&t>=(S.fire.next||0)&&!H.noFight){const best=nearestEnemy(X,p,H,50);if(best){S.fire.next=t+1.4;X.bcast({t:'pfx',k:'fball',id:p.id,v:best.id});X.damage(best,40,p.id,false,'fists')}else S.fire.next=t+.3}
 if(t>=(S.auto||10)){S.auto=t+16;const step=(S.step=(S.step||0)+1)%4;
  if(step===0)X.bcast({t:'pfx',k:'omniscan',id:p.id,d:4});
  else if(step===1){p.decoy=Math.max(p.decoy||0,t+5);X.bcast({t:'pfx',k:'decoy',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],yaw:p.p[3]||0,d:5})}
  else if(step===2){S.fire={until:t+3.2,next:t+.3};X.bcast({t:'pfx',k:'fireon',id:p.id,d:3.2,cd:16})}
  else grabNearby(H.br,p,14,[1,2],(who,id)=>X.take(who,id,true),6)}}
export function hostSpinGrab(X,p,S,H){const t=H.t;if(!p.ride||t<(S.sp||0))return 0;S.sp=t+.28;return grabNearby(H.br,p,7,[2],(who,id)=>X.take(who,id,true),4)}
// Fizzy's tongue: while you are the chameleon, it lashes out and pulls nearby loot.
export function hostTongue(X,p,S,H){const t=H.t;if(!p.ride||t<(S.tg||0))return 0;S.tg=t+1.15;const n=grabNearby(H.br,p,9,[1,2],(who,id)=>X.take(who,id,true),3);X.bcast&&X.bcast({t:'pfx',k:'tongue',id:p.id,n});return n}
// Same rise-again numbers as the phoenix: tier HP, 150 s cooldown, 2.5 s protection.
export const REBIRTH={hp:[35,50,65],cd:150,prot:2.5};
export function tryRebirth(S,t,tier){if(!S||t<(S.rb||0))return null;const i=Math.max(0,Math.min(2,(tier|0)-1));S.rb=t+REBIRTH.cd;return{hp:REBIRTH.hp[i],prot:t+REBIRTH.prot,cd:REBIRTH.cd}}
// Slow trickle while you are being shot, and the bigger medic rate after 4 s of calm.
export function omniHealRate(pw,calm){return (calm?1.6:0.55)*Math.max(.2,pw||1)}
// Secret pets. Each one is automatic and small so a Secret chest is not a second Chimera.
export function hostSecret(X,p,S,H,ab,pw,dt){const t=H.t;
 if(ab==='tide'){if(p.hp>=100)return;const o=Math.floor(p.hp);p.hp=Math.min(100,p.hp+.9*pw*dt);if(Math.floor(p.hp)!==o)X.bcast({t:'hp',id:p.id,hp:Math.round(p.hp)});return}
 if(ab==='lantern'){if(t<(S.a||0)||H.noFight)return;S.a=t+16;X.bcast({t:'pfx',k:'omniscan',id:p.id,d:3});return}
 if(ab==='sting'){if(t<(S.a||0)||H.noFight)return;const best=nearestEnemy(X,p,H,6);if(!best){S.a=t+.45;return}S.a=t+7;X.damage(best,Math.round(6*pw),p.id,false,'fists');if(best.bot){best.slowT=t+1.2;best.slowF=.72}else X.toPlayer(best.id,{t:'slow',f:.72,d:1.2});return}
 if(ab==='dazzle'){if(t<(S.a||0))return;S.a=t+22;p.decoy=Math.max(p.decoy||0,t+4);X.bcast({t:'pfx',k:'decoy',id:p.id,x:p.p[0],y:p.p[1],z:p.p[2],yaw:p.p[3]||0,d:4});if((p.sh||0)<15){p.sh=15;X.toPlayer(p.id,{t:'shd',sh:15});X.bcast({t:'pfx',k:'shield',id:p.id})}}}
