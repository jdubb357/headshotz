// Pure presentation rules for authoritative outgoing hit tokens. Keeping the
// token baseline and caption here lets the client and unit tests share one
// definition: a reconnect seeds the token already visible in a snapshot and
// therefore suppresses replay instead of showing a stale marker.
export function hitToken(hit){
 return Number.isFinite(hit?.token)&&hit.token>0?Math.floor(hit.token):0;
}

export function shouldShowHit(hit,lastToken=0){
 return !!hit&&hitToken(hit)>lastToken;
}

export function hitCaption(hit){
 const target=hit.target==='machine'?'machine':hit.target==='rival'?'rival':'operator';
 return hit.kill
  ?(hit.boss?'Boss destroyed':hit.elite?'Elite machine destroyed':target==='machine'?'Machine destroyed':target==='rival'?'Rival eliminated':'Operator eliminated')
  :(hit.headshot?'Headshot confirmed':'Hit confirmed')+' · '+target+(hit.elite?' · elite':'');
}
