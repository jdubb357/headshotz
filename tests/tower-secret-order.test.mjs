import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cmpRarity, cmpSecretFirst, displayRank, gunSkinRank } from '../rarorder.js';

// Lookout-tower floors and Secret-before-Godly list order.
// Run: node --test tests/tower-secret-order.test.mjs

const root = new URL('..', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const game = read('game.js');
const pets = read('sidekicks.js');
const shop = read('sidekickshop.js');
const br = read('br.js');
const sw = read('sw.js');

function petDefs(){
  const block = pets.slice(pets.indexOf('export const SK_DEFS'), pets.indexOf('export const SK_BY'));
  const out = [];
  for(const line of block.split('\n')){
    const id = line.match(/id:'([^']+)'/);
    if(!id) continue;
    const rar = +line.match(/rar:(\d+)/)[1];
    const price = +line.match(/price:(\d+)/)[1];
    out.push({ id: id[1], rar, price, godly: /godly:1/.test(line) ? 1 : 0, secret: /secret:1/.test(line) ? 1 : 0 });
  }
  return out;
}

test('service worker cache moved forward and prices stayed put', () => {
  assert.match(sw, /const CACHE='headshotz-v106'/);
  assert.match(sw, /rarorder\.js/);
  assert.match(game, /secret:25000,godly:50000/);
  assert.match(pets, /id:'chimera'[^}]*price:50000[^}]*godly:1/);
  assert.match(pets, /id:'novamoth'[^}]*price:25000[^}]*secret:1/);
  const rar = game.slice(game.indexOf('const RAR=['), game.indexOf('];', game.indexOf('const RAR=[')));
  const names = [...rar.matchAll(/n:'([A-Z]+)'/g)].map(m => m[1]);
  assert.ok(names.indexOf('SECRET') >= 0 && names.indexOf('SECRET') < names.indexOf('GODLY'));
  assert.match(rar, /SECRET'[^}]*d:1\.6/);
  assert.match(rar, /GODLY'[^}]*d:1\.8/);
});

test('Secret sorts before Godly in every display comparator', () => {
  const defs = petDefs();
  const chimera = defs.find(d => d.id === 'chimera');
  const secret = defs.filter(d => d.secret);
  assert.equal(chimera.godly, 1);
  assert.equal(chimera.rar, 5);
  assert.equal(secret.length, 4);
  assert.ok(secret.every(d => d.rar === 6 && d.price === 25000));
  // Pet numbers store Godly at 5 and Secret at 6. Display still puts Secret first.
  assert.equal(displayRank(5), 6);
  assert.equal(displayRank(6), 5);
  assert.ok(displayRank(chimera) > displayRank(secret[0]));
  const shown = defs.slice().sort((a, b) => cmpRarity(a, b, (x, y) => x.price - y.price));
  const si = shown.findIndex(d => d.secret);
  const gi = shown.findIndex(d => d.godly);
  assert.ok(si >= 0 && si < gi, 'secret pets before Sol');
  assert.ok(shown.slice(si, gi).every(d => d.secret));
  assert.ok(shown.slice(0, si).every(d => !d.secret && !d.godly));
  // Shop price order already lists the real 25,000 Secret guns before the 50,000 Godly guns.
  const priced = [{ id: 'knife', shop: 200 }, { id: 'g', godly: 1, rar: 'GODLY', shop: 50000 }, { id: 's', rar: 'SECRET', shop: 25000 }];
  assert.deepEqual(priced.slice().sort((a, b) => cmpSecretFirst(a, b, (x, y) => x.shop - y.shop)).map(w => w.id), ['knife', 's', 'g']);
  // A cheaper Godly still lists after Secret.
  const flipped = [{ id: 'g', godly: 1, rar: 'GODLY', shop: 1 }, { id: 's', rar: 'SECRET', shop: 9 }];
  assert.deepEqual(flipped.slice().sort((a, b) => cmpSecretFirst(a, b, (x, y) => x.shop - y.shop)).map(w => w.id), ['s', 'g']);
  const tiers = ['godly', 'common', 'secret', 'legendary'].map(tier => ({ tier }));
  assert.deepEqual(tiers.slice().sort(cmpRarity).map(t => t.tier), ['common', 'legendary', 'secret', 'godly']);
  assert.ok(gunSkinRank('galaxy') < gunSkinRank('galaxy_gold'));
  assert.equal(gunSkinRank('galaxy'), gunSkinRank('galaxy_red'));
  assert.match(shop, /\['6','SECRET'\],\['5','GODLY'\]/);
  assert.match(shop, /cmpRarity/);
  assert.match(game, /cmpSecretFirst/);
  assert.match(game, /cmpRarity\(\{tier:a\[0\]\}/);
  assert.match(read('skinshop.js'), /cmpRarity/);
  // Chest membership is unchanged: Godly stays Godly-only, Secret stays Secret-only.
  const godly = game.slice(game.indexOf('CHEST.loot.godly='), game.indexOf(';', game.indexOf('CHEST.loot.godly=')));
  const secretLoot = game.slice(game.indexOf('CHEST.loot.secret='), game.indexOf(';', game.indexOf('CHEST.loot.secret=')));
  assert.match(godly, /'pet','chimera'/);
  assert.doesNotMatch(godly, /novamoth|seahorse|scorpion|peacock/);
  assert.match(secretLoot, /'pet','novamoth'/);
  assert.doesNotMatch(secretLoot, /chimera/);
});

test('the Godly-chest lookout deck is a solid floor, including the ladder exit', async () => {
  const ctx2d = new Proxy({
    getImageData(x, y, w, h){ return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    measureText(){ return { width: 10 }; },
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
  }, { get(t, p){ if(p in t) return t[p]; if(typeof p === 'symbol') return undefined; return () => {}; } });
  globalThis.document = { createElement: () => ({ width: 64, height: 64, style: {}, getContext: () => ctx2d }), body: { appendChild(){}, style: {} }, addEventListener(){} };
  globalThis.window = globalThis;
  globalThis.Image = class { set src(_){} };
  const { BR_I, buildMap } = await import('../maps.js');
  const { GQ } = await import('../gfx.js');
  GQ.level = 'low';
  const m = buildMap(BR_I);
  const PR = 0.35, PH = 1.8;
  const cols = m.cols;
  function surface(x, z, hi, lo){
    let gy = -1e9;
    for(const c of cols) if(x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y1 <= hi && c.y1 > lo && c.y1 > gy) gy = c.y1;
    return gy;
  }
  function free(x, y, z){
    for(const c of cols) if(x + PR > c.x0 && x - PR < c.x1 && z + PR > c.z0 && z - PR < c.z1 && y + (PH - 0.05) > c.y0 && y < c.y1) return false;
    return true;
  }
  function settle(x, z, y0){
    let y = y0, vy = 0;
    for(let i = 0; i < 50; i++){
      const dt = 1 / 60;
      vy = Math.max(-40, vy - 24 * dt);
      const py0 = y;
      y += vy * dt;
      if(vy <= 0){
        let top = -1e9;
        for(const c of cols) if(x + PR > c.x0 && x - PR < c.x1 && z + PR > c.z0 && z - PR < c.z1 && py0 >= c.y1 - 0.06 && y < c.y1 && c.y1 > top) top = c.y1;
        if(top > -1e9){ y = top; vy = 0; }
      }
      for(const c of cols){
        if(!(x + PR > c.x0 && x - PR < c.x1 && z + PR > c.z0 && z - PR < c.z1 && y + PH > c.y0 && y < c.y1)) continue;
        if(vy <= 0 && y > c.y1 - 0.6){ y = c.y1; vy = 0; }
      }
    }
    return y;
  }
  assert.match(br, /const floor=c=>/);
  const high = m.chestSpots.filter(c => c[1] > 4);
  assert.ok(high.length >= 8, 'authored high chests');
  const lookout = c => m.ladders.some(L => L.y1 > 6 && L.y1 < 14 && Math.hypot(((L.x0 + L.x1) / 2) - c[0], ((L.z0 + L.z1) / 2) - c[2]) < 4 && Math.abs(c[1] - (L.y1 - 0.25)) < 2);
  const towers = high.filter(lookout);
  assert.ok(towers.length >= 4, 'lookout towers still host high chests');
  for(const c of high){
    const gy = surface(c[0], c[2], c[1] + 0.8, c[1] - 1.4);
    assert.ok(gy > c[1] - 0.8, `chest ${c[0]},${c[2]} has a floor, got ${gy}`);
  }
  for(const c of towers){
    const gy = surface(c[0], c[2], c[1] + 0.6, c[1] - 1.2);
    assert.equal(free(c[0], gy + 0.02, c[2]), true, `lookout chest ${c[0]},${c[2]} is standable`);
    const y = settle(c[0], c[2], gy + 0.4);
    assert.ok(Math.abs(y - gy) < 0.15, `lookout chest ${c[0]},${c[2]} holds a player at ${y}, floor ${gy}`);
  }
  let mounted = 0;
  for(const L of m.ladders){
    if(L.y1 < 6) continue;
    const n = L.n, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, top = L.y1 - 0.25;
    let ok = false;
    for(const d of [0.75, 1, 0.55, 1.3, 0.15]){
      const bx = cx - n[0] * (0.4 + d), bz = cz - n[1] * (0.4 + d);
      const gy = surface(bx, bz, top + 0.8, top - 1.2);
      if(gy < 0) continue;
      if(!free(bx, gy + 0.02, bz)) continue;
      const y = settle(bx, bz, gy + 0.35);
      if(Math.abs(y - gy) < 0.15){ ok = true; break; }
    }
    assert.equal(ok, true, `ladder at ${cx.toFixed(1)},${cz.toFixed(1)} y ${L.y1.toFixed(1)} has a standable top`);
    mounted++;
    const chest = high.find(c => Math.hypot(c[0] - cx, c[2] - cz) < 4 && Math.abs(c[1] - top) < 2);
    if(!chest || L.y1 > 14) continue;
    // The ladder exit itself, not only a step further onto the deck.
    const ex = cx - n[0] * 0.15, ez = cz - n[1] * 0.15;
    const gy = surface(ex, ez, top + 1.2, top - 0.4);
    assert.ok(gy > 1, `ladder exit ${ex.toFixed(1)},${ez.toFixed(1)} is floored`);
    assert.equal(free(ex, gy + 0.02, ez), true);
    const y = settle(ex, ez, gy + 0.3);
    assert.ok(y > gy - 0.2, `player stays on the ladder exit, y ${y}`);
  }
  assert.ok(mounted >= 15);
});
