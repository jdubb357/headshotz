import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isInfinite, needsReload, hitDamage, throwMotion, startBurn, burnStep } from '../throwkit.js';

const weapons = readFileSync(new URL('../weapons.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');

function def(id) {
  const m = weapons.match(new RegExp(`${id}:\\{[^}]*\\}`));
  assert.ok(m, id);
  const o = {};
  for (const part of m[0].slice(m[0].indexOf('{') + 1, -1).split(',')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    let v = part.slice(i + 1).trim();
    if (v.startsWith("'")) v = v.slice(1, -1);
    else if (v === '1' || v === '.1' || /^-?\d/.test(v)) v = +v;
    o[k] = v;
  }
  return o;
}

test('throwing knives and ninja stars deal 20, fly fast, and never reload', () => {
  for (const id of ['tknife', 'star']) {
    const w = def(id);
    assert.equal(w.cls, 'melee');
    assert.equal(w.body, 20);
    assert.equal(w.head, 20);
    assert.equal(hitDamage(w, false), 20);
    assert.equal(hitDamage(w, true), 20);
    assert.ok(w.rate <= .22 && w.rate >= .12, id + ' rate ' + w.rate);
    assert.equal(w.inf, 1);
    assert.equal(isInfinite(w), true);
    assert.equal(needsReload(w), false);
    assert.equal(w.mag, undefined);
    const motion = throwMotion(w);
    assert.ok(motion.speed >= 40, id + ' speed');
    assert.ok(motion.grav <= 10, id + ' grav');
  }
  assert.ok(def('star').rate < def('tknife').rate);
  assert.ok(def('star').spd > def('tknife').spd);
  assert.match(weapons, /tknife:THROWKNIFE,star:SHURIKEN/);
  assert.match(game, /MELEES=\['knife','katana','axe','bat','pan','tknife','star'\]/);
  assert.match(game, /isInfinite\(w\)/);
  assert.match(game, /needsReload\(w\)/);
  assert.match(game, /if\(w\.throw\)/);
});

test('Godly costs 50000 and Secret costs 25000', () => {
  assert.match(game, /secret:25000,godly:50000/);
  assert.match(weapons, /shop:50000/);
  assert.match(weapons, /rar:'SECRET',price:1900,shop:25000/);
  assert.match(weapons, /rar:'SECRET',price:2000,shop:25000/);
  assert.doesNotMatch(weapons, /shop:3000|shop:5000(?!\d)/);
});

test('the flamethrower is a short close-range stream with a burn, not a one-shot', () => {
  const w = def('flamegun');
  assert.equal(w.cls, 'fun');
  assert.equal(w.maxR, 8);
  assert.equal(w.mag, 70);
  assert.equal(w.reload, 3.6);
  assert.equal(w.flame, 1);
  assert.ok(w.body / w.rate <= 25, 'stream dps ' + (w.body / w.rate));
  assert.equal(needsReload(w), true);
  const burn = startBurn(0);
  let now = 0, total = 0, ticks = 0;
  while (now < 3 && ticks < 10) {
    const step = burnStep(burn, now);
    if (step.done) break;
    if (step.dmg) { total += step.dmg; burn.next = step.next; ticks++; now = step.next; }
    else now = step.next;
  }
  assert.equal(ticks, 4);
  assert.equal(total, 16);
  assert.match(game, /if\(w\.flame\)/);
  assert.match(game, /v\.burn=Object\.assign\(startBurn/);
  assert.doesNotMatch(game, /POOLS[\s\S]{0,400}flamegun/);
});
