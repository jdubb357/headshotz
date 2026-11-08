import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rideOf, shouldDismount, grabNearby, hostOmni } from '../petabil3.js';

const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const pets = readFileSync(new URL('../sidekicks.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const def = id => {
  const m = pets.match(new RegExp(`\\{id:'${id}'[^}]*\\}`));
  assert.ok(m, id);
  const o = {};
  for (const part of m[0].slice(1, -1).split(',')) {
    const [k, v] = part.split(':');
    if (!k || v == null) continue;
    o[k.trim()] = v.trim().replace(/^'|'$/g, '');
  }
  if (o.price) o.price = +o.price;
  if (o.rar) o.rar = +o.rar;
  return o;
};

function lootLine(name) {
  const i = game.indexOf(`CHEST.loot.${name}=[`);
  assert.ok(i > 0, name);
  return game.slice(i, game.indexOf('];', i));
}

test('the original 15 sidekicks all get the fur, feather, scale or glow pass', () => {
  for (const id of ['dog','cat','bunny','bat','fox','penguin','bear','tiger','hedgehog','lion','superdog','twohead','robot','ghost','dragon']) {
    assert.match(pets, new RegExp(`'${id}'`));
  }
  assert.match(pets, /ORIG15\.has\(id\)\)detailOriginal\(m,id,def\.col,tier\)/);
});

test('cache is v103 or newer', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 103);
  assert.match(sw, /petabil3\.js/);
  assert.match(sw, /petmodels4\.js/);
});

test('Celestial Chimera is a 5000-diamond Godly pet and only the Godly chest rolls it', () => {
  const c = def('chimera');
  assert.equal(c.name, 'Sol');
  assert.equal(c.kind, 'Celestial Chimera');
  assert.equal(c.price, 5000);
  assert.equal(c.rar, 5);
  assert.equal(c.ab, 'omni');
  assert.equal(+c.godly, 1);
  const godly = lootLine('godly');
  const secret = lootLine('secret');
  assert.match(godly, /\['pet','chimera',1\]/);
  assert.doesNotMatch(secret, /chimera/);
  assert.match(godly, /gk_ak47/);
  assert.match(secret, /'wpn','awp'/);
  assert.doesNotMatch(godly, /'wpn','awp'|minigun/);
});

test('Magnet Raccoon and Magnet Drone are still in the roster', () => {
  assert.equal(def('raccoon').kind, 'Magnet Raccoon');
  assert.equal(def('raccoon').ab, 'pull');
  assert.equal(def('magnetdrone').kind, 'Magnet Drone');
  assert.equal(def('magnetdrone').ab, 'vacuum');
});

test('rides get faster and jump higher by tier, and heavy hits dismount', () => {
  const order = ['spincapy', 'stormwolf', 'raptor', 'rocketrich'];
  let prev = 0;
  for (const id of order) {
    const t1 = rideOf(id, 1), t3 = rideOf(id, 3);
    assert.ok(t3.spd > t1.spd, id);
    assert.ok(t3.jump > t1.jump, id);
    assert.ok(t1.spd > prev, id + ' tier order');
    prev = t1.spd;
    assert.equal(shouldDismount(t1.heavy - 1, t1.heavy), false);
    assert.equal(shouldDismount(t1.heavy, t1.heavy), true);
  }
  assert.equal(rideOf('spincapy', 2).atk, true);
  assert.equal(rideOf('spincapy', 2).spin, true);
  assert.equal(rideOf('rocketrich', 1).atk, false);
  assert.equal(def('spincapy').price, 1800);
  assert.equal(def('stormwolf').price, 2200);
  assert.equal(def('rocketrich').price, 2600);
  assert.equal(def('raptor').price, 2400);
});

test('the spinning capybara magnet takes medkits and shields, not guns', () => {
  const items = {
    1: [1, 0, 0, 0, 1, 0, 0],
    2: [2, 2, 1, 0, 2, 0, 1],
    3: [3, 0, 0, 0, 30, 0, 0]
  };
  const got = [];
  const n = grabNearby({ items }, { p: [0, 0, 0] }, 8, [2], (p, id) => { got.push(id); return true; }, 4);
  assert.equal(n, 1);
  assert.deepEqual(got, [2]);
});

test('the chimera uses heal, shield, magnet and a diamond automatically', () => {
  const p = { id: 'me', alive: true, hp: 40, sh: 0, hurtT: 0, p: [0, 0, 0, 0], ws: { pet: 'chimera', pt: 1 } };
  const sent = [];
  const H = { t: 20, phase: 'play', br: { items: { kit: [9, 2, 0, 0, 1, 0, 1] } } };
  const X = {
    plist: () => [p],
    enemy: () => false,
    los: () => false,
    bcast: m => sent.push(m),
    toPlayer: (id, m) => sent.push(m),
    damage() {},
    take: (who, id) => { delete H.br.items.kit; return true; }
  };
  hostOmni(X, p, { fl: [] }, H, 1.15, 1, 1);
  assert.ok(p.hp > 40);
  assert.equal(p.sh, 25);
  assert.equal(H.br.items.kit, undefined);
  assert.ok(sent.some(m => m.t === 'pdia' && m.n === 1));
  assert.match(pets, /id:'chimera'/);
});
