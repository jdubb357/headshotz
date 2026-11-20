import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Thanksgiving 2026: America/Chicago Thu Nov 19 00:00 inclusive through Mon Nov 23 00:00 exclusive.
const root = new URL('..', import.meta.url);
const game = readFileSync(new URL('game.js', root), 'utf8');
const sw = readFileSync(new URL('sw.js', root), 'utf8');

function chicagoParts(ms) {
  const o = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms))) if (x.type !== 'literal') o[x.type] = +x.value;
  return o;
}
function chicagoTime(y, m, d, hh = 0, mm = 0, ss = 0, ms = 0) {
  let t = Date.UTC(y, m - 1, d, hh + 6, mm, ss, ms);
  for (let i = 0; i < 8; i++) {
    const p = chicagoParts(t);
    const delta = Date.UTC(y, m - 1, d, hh, mm, ss) - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (delta === 0) return t;
    t += delta;
  }
  throw new Error('could not resolve America/Chicago time');
}

function load() {
  const start = game.indexOf('const GIFT={key:\'gift_2000_oct29\'');
  const end = game.indexOf('Object.assign(window.__hsz,{aa:AA,giftCheck');
  const slice = game.slice(start, end);
  const store = new Map();
  const pops = [];
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const document = {
    hidden: false,
    body: { appendChild(node) { pops.push(node); } },
    createElement() {
      return { id: '', innerHTML: '', classList: { add() {} }, addEventListener() {}, remove() {} };
    },
    addEventListener() {},
  };
  const window = { __hsz: {}, __dlog: [] };
  const PROG = { dia: 500, gifts: [] };
  const api = new Function('PROG', 'saveProg', 'SFX', 'localStorage', 'document', 'window', 'setTimeout', 'setInterval', 'addEventListener', slice + `
    return { GIFT4, gift4Due, gift4Check, ctYMD };
  `)(PROG, () => {}, { beep() {} }, localStorage, document, window, () => 0, () => 0, () => {});
  return { api, PROG, store, pops, window };
}

test('Thanksgiving gift is 200000 from Nov 19 through Sunday, once', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 108);
  const start = chicagoTime(2026, 11, 19, 0, 0, 0, 0);
  const before = start - 1;
  const sunday = chicagoTime(2026, 11, 22, 18, 0, 0, 0);
  const end = chicagoTime(2026, 11, 23, 0, 0, 0, 0);
  const g = load();
  assert.equal(g.api.GIFT4.key, 'gift_200k_nov21');
  assert.equal(g.api.GIFT4.n, 200000);
  assert.deepEqual(g.api.GIFT4.from, [2026, 11, 19]);
  assert.deepEqual(g.api.GIFT4.until, [2026, 11, 23]);
  assert.deepEqual(g.api.ctYMD(start), [2026, 11, 19]);
  assert.deepEqual(g.api.ctYMD(before), [2026, 11, 18]);
  assert.deepEqual(g.api.ctYMD(sunday), [2026, 11, 22]);
  assert.deepEqual(g.api.ctYMD(end), [2026, 11, 23]);

  g.window.__mockNow = before;
  assert.equal(g.api.gift4Check(), false);
  assert.equal(g.PROG.dia, 500);

  g.window.__mockNow = end;
  assert.equal(g.api.gift4Due(), false);
  assert.equal(g.api.gift4Check(), false);

  g.window.__mockNow = start;
  assert.equal(g.api.gift4Check(), true);
  assert.equal(g.PROG.dia, 200500);
  assert.equal(g.store.get('gift_200k_nov21'), '1');
  assert.ok(g.PROG.gifts.includes('gift_200k_nov21'));
  assert.equal(g.pops.length, 1);
  assert.equal(g.pops[0].id, 'thanksPop');
  assert.match(g.pops[0].innerHTML, /Happy Thanksgiving! \+200,000 gems/);

  g.window.__mockNow = sunday;
  assert.equal(g.api.gift4Due(), false);
  assert.equal(g.api.gift4Check(), false);
  assert.equal(g.PROG.dia, 200500);
});
