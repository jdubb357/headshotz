import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hostTongue, rideOf, veilView } from '../petabil3.js';

// Fizzy the Rainbow Chameleon: Godly, 50,000, Godly chest only, ride hides the player, tongue grabs loot.
const root = new URL('..', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const pets = read('sidekicks.js');
const game = read('game.js');
const models = read('petmodels4.js');

function def(id) {
  const line = pets.split('\n').find(l => l.includes(`id:'${id}'`));
  assert.ok(line, id);
  const grab = key => { const m = line.match(new RegExp(key + ":'([^']*)'")); return m ? m[1] : ''; };
  const num = key => { const m = line.match(new RegExp(key + ':(\\d+)')); return m ? +m[1] : NaN; };
  return { name: grab('name'), kind: grab('kind'), ab: grab('ab'), price: num('price'), rar: num('rar'), godly: /godly:1/.test(line), ride: /ride:1/.test(line), veil: /veil:1/.test(line) };
}

test('Fizzy is the Godly Rainbow Chameleon at 50,000 and only in the Godly chest', () => {
  const f = def('fizzy');
  assert.equal(f.name, 'Fizzy');
  assert.equal(f.kind, 'Rainbow Chameleon');
  assert.equal(f.ab, 'veil');
  assert.equal(f.price, 50000);
  assert.equal(f.rar, 5);
  assert.equal(f.godly, true);
  assert.equal(f.ride, true);
  assert.equal(f.veil, true);
  assert.match(pets, /Fizzy the Rainbow Chameleon/);
  const godly = game.slice(game.lastIndexOf('CHEST.loot.godly='), game.indexOf(';', game.lastIndexOf('CHEST.loot.godly=')));
  const secret = game.slice(game.lastIndexOf('CHEST.loot.secret='), game.indexOf(';', game.lastIndexOf('CHEST.loot.secret=')));
  assert.match(godly, /\['pet','fizzy',1\]/);
  assert.doesNotMatch(secret, /fizzy/);
  assert.match(godly, /\['pet','chimera',1\]/);
  assert.match(models, /fizzy\(\)/);
  assert.match(models, /rig\.eyes/);
  assert.match(models, /rig\.tongue/);
  assert.match(game, /me\.ride\.veil/);
  assert.match(game, /q\.rideOn&&q\.ws&&SK_BY\[q\.ws\.pet\]&&SK_BY\[q\.ws\.pet\]\.veil/);
});

test('riding Fizzy is a full vanish and the tongue snatches loot and a close chest', () => {
  const t1 = rideOf('fizzy', 1), t3 = rideOf('fizzy', 3);
  assert.equal(t1.veil, true);
  assert.equal(t1.tongue, true);
  assert.equal(t1.atk, true);
  assert.ok(t3.spd > t1.spd && t3.jump > t1.jump);
  const others = veilView(false), self = veilView(true);
  assert.deepEqual(others, { body: false, gun: false, tag: false, chameleon: false });
  assert.equal(self.chameleon, true);
  assert.equal(self.body, false);
  assert.equal(self.gun, false);
  assert.equal(self.tag, false);
  assert.match(game, /q\.veil\|\|/);
  assert.match(pets, /p\.veil=1/);
  const items = { 2: [2, 2, 1, 0, 1, 0, 0], 7: [7, 0, 4, 0, 2, 0, 1], 9: [9, 0, 0, 0, 40, 0, 0] };
  const got = [];
  const fx = [];
  const X = { take(p, id) { got.push(id); return true; }, bcast(m) { fx.push(m.k); }, openChest() { return true; } };
  const p = { id: 'me', ride: 1, p: [0, 0, 0] };
  const S = {};
  const H = { t: 3, br: { items } };
  assert.equal(hostTongue(X, p, S, H), 3);
  assert.deepEqual(got.sort((a, b) => a - b), [2, 7]);
  assert.deepEqual(fx, ['tongue']);
  assert.equal(hostTongue(X, p, S, H), 0, 'tongue waits before the next grab');
  p.ride = 0;
  S.tg = 0;
  assert.equal(hostTongue(X, p, S, { t: 20, br: { items } }), 0);
});
