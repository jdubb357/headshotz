import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Medkit has its own control and can be used while grenades are still in the throwable slot.
// Run: node --test tests/medkit-slot.test.mjs

const root = new URL('..', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const game = read('game.js');
const html = read('index.html');
const css = read('style.css');
const sw = read('sw.js');

function slice(start, end) {
  const a = game.indexOf(start);
  const b = game.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return game.slice(a, b);
}

function api() {
  const ctx = {
    C: { hub: 0, mode: 'ffa' },
    BC: null,
    RAIDM: () => false,
    me: { alive: true, frozen: false, down: false, air: null, pf: null, hp: 40, utilN: 3, load: ['ar', 'handgun', 'fists', 'grenade'], nl: { smoke: 2, flash: 1, decoy: 1, medkit: 2 }, nlSel: 'smoke' },
    sent: [],
    threw: null,
    br: null,
    NLK: ['smoke', 'flash', 'decoy'],
    WIDS: ['smoke', 'flash', 'decoy', 'grenade'],
    send(m) { ctx.sent.push(m); },
    center() {},
    buildSlots() {},
    SFX: { heal() {} },
    brUse(k) { ctx.br = k; },
  };
  vm.createContext(ctx);
  const src = [
    slice('function lethalK(){', 'function throwUtil('),
    'function throwUtil(k){threw=k}\n',
    slice('function useUtil(){', 'function nlSel(){'),
  ].join('\n');
  vm.runInContext(src, ctx);
  return ctx;
}

test('the medkit has its own HUD control, separate from the grenade cycle', () => {
  assert.match(sw, /const CACHE='headshotz-v107'/);
  assert.match(html, /id="bMed"/);
  assert.match(html, /aria-label="Use medkit"/);
  assert.match(css, /#bMed\{/);
  assert.match(game, /id==='bMed'\)useMedkit\(\)/);
  assert.match(game, /data-med="1"/);
  assert.match(game, /KeyH'&&!e\.repeat\)useMedkit\(\)/);
  const list = slice('function nlList(){', 'function nlSel(){');
  assert.match(list, /\['smoke','flash','decoy'\]/);
  assert.doesNotMatch(list, /'medkit'/);
  assert.match(list, /i!==1/);
  assert.match(slice('function useUtil(){', 'function medCount(){'), /me\.utilN--/);
  assert.match(read('weapons.js'), /throw:'knife'/);
  assert.match(read('weapons.js'), /throw:'star'/);
});

test('a medkit can be used while grenades and other throwables are still held', () => {
  const ctx = api();
  ctx.useMedkit();
  assert.equal(ctx.me.nl.medkit, 1);
  assert.equal(ctx.me.utilN, 3, 'frag count stays');
  assert.equal(ctx.me.nl.smoke, 2);
  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].t, 'heal');
  assert.equal([...ctx.nlList()].map(e => String(e.k)).join(','), 'smoke,flash,decoy');
  ctx.useUtil();
  assert.equal(ctx.threw, 'grenade');
  assert.equal(ctx.me.utilN, 2);
  assert.equal(ctx.me.nl.medkit, 1, 'throwing a grenade does not spend the medkit');
  ctx.me.hp = 100;
  ctx.sent.length = 0;
  ctx.useMedkit();
  assert.equal(ctx.me.nl.medkit, 1, 'full health does not consume a medkit');
  assert.equal(ctx.sent.length, 0);
});

test('royale medkit button does not wait for the throwable stack to hit zero', () => {
  const ctx = api();
  ctx.BC = { inv: { n: [0, 2], u: [3, 4], c: [3, 2, 1, 0] } };
  ctx.me.utilN = 4;
  assert.equal(ctx.medCount(), 2);
  ctx.useMedkit();
  assert.equal(ctx.br, 1);
  assert.equal(ctx.BC.inv.u[1], 4);
  assert.equal(ctx.BC.inv.n[1], 2);
  assert.equal(ctx.me.utilN, 4);
  const list = ctx.nlList();
  assert.ok(list.some(e => e.k === 'smoke'));
  assert.ok(list.some(e => e.c === 0));
  assert.equal(list.some(e => e.c === 1), false);
});
