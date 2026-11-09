// Display order when Secret and Godly appear in the same list.
// Godly stays the higher rarity. Lists show Secret, then Godly.
const NAME = {COMMON:0, UNCOMMON:1, RARE:2, EPIC:3, LEGENDARY:4, SECRET:5, GODLY:6};
function nameRank(s){return NAME[String(s||'').toUpperCase()] ?? -1}

// Pet catalog numbers store Godly at 5 and Secret at 6. Weapon names and the
// Battle Royale gun table already use 5 = Secret and 6 = Godly.
export function displayRank(item){
  if(item==null) return 0;
  if(typeof item==='number'){const n=item|0; return n===6?5:n===5?6:n}
  if(typeof item==='string'){const n=nameRank(item); return n<0?0:n}
  if(item.godly || item.rar==='GODLY' || item.tier==='godly') return 6;
  if(item.secret || item.rar==='SECRET' || item.rar===6 || item.tier==='secret') return 5;
  if(typeof item.rar==='number') return item.rar;
  if(typeof item.rar==='string'){const n=nameRank(item.rar); return n<0?0:n}
  if(typeof item.tier==='string'){const n=nameRank(item.tier); return n<0?0:n}
  return 0;
}

// Full catalog order: common … legendary, Secret, Godly.
export function cmpRarity(a, b, tie = () => 0){
  return displayRank(a) - displayRank(b) || tie(a, b) || 0;
}

// Galaxy gun skins: the gold nebula is Godly, the others are Secret.
const GUN_SKIN={galaxy:{secret:1},galaxy_blue:{secret:1},galaxy_red:{secret:1},galaxy_gold:{godly:1}};
export function gunSkinRank(id){return GUN_SKIN[id]?displayRank(GUN_SKIN[id]):0}

// Leave an existing price/name order alone, except Secret always precedes Godly.
export function cmpSecretFirst(a, b, tie = () => 0){
  const ra = displayRank(a), rb = displayRank(b);
  if(ra >= 5 && rb >= 5 && ra !== rb) return ra - rb;
  return tie(a, b) || 0;
}
