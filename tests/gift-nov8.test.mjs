import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Focused check for the Sunday Nov 8, 2026 America/Chicago 100,000 diamond gift.
// Runs the real gift functions sliced out of game.js (no browser). 
// Run: node --test tests/gift-nov8.test.mjs

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

// UTC instant whose America/Chicago wall clock is y-m-d hh:mm:ss.mmm.
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

function loadGifts() {
  const start = game.indexOf('const GIFT={key:\'gift_2000_oct29\'');
  const end = game.indexOf('Object.assign(window.__hsz,{aa:AA,giftCheck');
  assert.ok(start > 0 && end > start, 'gift block markers');
  const slice = game.slice(start, end);
  const scheduled = [];
  const docListeners = {};
  const winListeners = {};
  const pops = [];
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  const document = {
    hidden: false,
    body: { appendChild(node) { pops.push(node); } },
    createElement() {
      const node = {
        id: '', innerHTML: '', classList: { add() {} },
        listeners: {},
        querySelector() { return { onclick: null }; },
        addEventListener(ev, fn) { (node.listeners[ev] ||= []).push(fn); },
        remove() {},
      };
      return node;
    },
    addEventListener(ev, fn) { (docListeners[ev] ||= []).push(fn); },
  };
  const window = { __hsz: {}, __dlog: [] };
  const PROG = { dia: 0, gifts: [] };
  let saves = 0;
  const api = new Function('PROG', 'saveProg', 'SFX', 'localStorage', 'document', 'window', 'setTimeout', 'setInterval', 'addEventListener', slice + `
    return { GIFT, GIFT2, GIFT3, giftDue, gift2Due, gift3Due, giftCheck, gift2Check, gift3Check, giftLater, ctYMD };
  `)(
    PROG,
    () => { saves++; },
    { beep() {} },
    localStorage,
    document,
    window,
    (fn, ms) => { scheduled.push({ fn, ms, kind: 'timeout' }); return scheduled.length; },
    (fn, ms) => { scheduled.push({ fn, ms, kind: 'interval' }); return scheduled.length; },
    (ev, fn) => { (winListeners[ev] ||= []).push(fn); },
  );
  return { api, PROG, store, pops, scheduled, docListeners, winListeners, window, document, saves: () => saves };
}

test('service worker cache is headshotz-v100 or newer and gift3 is exported', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m, 'sw.js cache name');
  assert.ok(+m[1] >= 100, 'cache bump must be v100+ so clients drop v99');
  assert.match(game, /gift3Check,gift3Due,GIFT3/);
  assert.match(game, /function giftLater\(\)\{gift2Check\(\);gift3Check\(\)\}/);
  assert.match(game, /setTimeout\(giftLater,2500\)/);
  assert.match(game, /setInterval\(giftLater,30000\)/);
  assert.match(game, /visibilitychange',\(\)=>\{if\(!document\.hidden\)setTimeout\(giftLater,300\)\}/);
  assert.match(game, /pageshow',\(\)=>setTimeout\(giftLater,300\)/);
});

test('Nov 8 Chicago window pays 100000 once and keeps the Nov 3 claim separate', () => {
  const start = chicagoTime(2026, 11, 8, 0, 0, 0, 0);
  const justBefore = start - 1;
  const late = chicagoTime(2026, 11, 8, 23, 59, 59, 999);
  const end = chicagoTime(2026, 11, 9, 0, 0, 0, 0);
  const g = loadGifts();
  const { api, PROG, store, pops, window } = g;
  assert.equal(api.GIFT3.key, 'gift_100k_nov8');
  assert.equal(api.GIFT3.n, 100000);
  assert.deepEqual(api.ctYMD(start), [2026, 11, 8]);
  assert.deepEqual(api.ctYMD(justBefore), [2026, 11, 7]);
  assert.deepEqual(api.ctYMD(late), [2026, 11, 8]);
  assert.deepEqual(api.ctYMD(end), [2026, 11, 9]);

  window.__mockNow = justBefore;
  assert.equal(api.gift3Due(), false);
  assert.equal(api.gift3Check(), false);
  assert.equal(PROG.dia, 0);

  window.__mockNow = end;
  assert.equal(api.gift3Due(), false);

  // Already claimed the Nov 3 gift. This one is a different key.
  store.set('gift_100k_nov3', '1');
  PROG.gifts.push('gift_100k_nov3');
  window.__mockNow = start;
  assert.equal(api.gift3Check(), true);
  assert.equal(PROG.dia, 100000);
  assert.equal(store.get('gift_100k_nov8'), '1');
  assert.ok(PROG.gifts.includes('gift_100k_nov8'));
  assert.equal(pops.length, 1);
  assert.match(pops[0].innerHTML, /Gift from the devs/);
  assert.match(pops[0].innerHTML, /\+100,000 💎/);
  assert.equal(pops[0].id, 'giftPop');
  assert.deepEqual(window.__dlog.at(-1), [100000, 'gift from the devs (100k nov8)']);

  assert.equal(api.gift3Check(), false);
  assert.equal(PROG.dia, 100000);
  assert.equal(pops.length, 1);

  window.__mockNow = late;
  assert.equal(api.gift3Due(), false);
});

test('wallet flag alone and device flag alone each block a second claim', () => {
  const noon = chicagoTime(2026, 11, 8, 12, 0, 0, 0);
  const wallet = loadGifts();
  wallet.window.__mockNow = noon;
  wallet.PROG.gifts.push('gift_100k_nov8');
  assert.equal(wallet.api.gift3Due(), false);
  assert.equal(wallet.api.gift3Check(), false);
  assert.equal(wallet.PROG.dia, 0);

  const device = loadGifts();
  device.window.__mockNow = noon;
  device.store.set('gift_100k_nov8', '1');
  assert.equal(device.api.gift3Due(), false);
  assert.equal(device.api.gift3Check(), false);
});

test('load, visibility, and pageshow wiring claim the gift once', () => {
  const noon = chicagoTime(2026, 11, 8, 15, 30, 0, 0);
  const g = loadGifts();
  g.window.__mockNow = noon;
  const loadTimer = g.scheduled.find(s => s.kind === 'timeout' && s.ms === 2500);
  const poll = g.scheduled.find(s => s.kind === 'interval' && s.ms === 30000);
  assert.ok(loadTimer && poll, 'giftLater scheduled on load and every 30s');
  loadTimer.fn();
  assert.equal(g.PROG.dia, 100000);
  poll.fn();
  assert.equal(g.PROG.dia, 100000, 'interval does not pay twice');

  const again = loadGifts();
  again.window.__mockNow = noon;
  assert.equal(again.docListeners.visibilitychange.length, 1);
  again.document.hidden = true;
  again.docListeners.visibilitychange[0]();
  const hiddenTimers = again.scheduled.filter(s => s.ms === 300);
  assert.equal(hiddenTimers.length, 0, 'hidden tab does not schedule a check');
  again.document.hidden = false;
  again.docListeners.visibilitychange[0]();
  const vis = again.scheduled.filter(s => s.ms === 300);
  assert.equal(vis.length, 1);
  vis[0].fn();
  assert.equal(again.PROG.dia, 100000);

  const show = loadGifts();
  show.window.__mockNow = noon;
  assert.equal(show.winListeners.pageshow.length, 1);
  show.winListeners.pageshow[0]();
  const page = show.scheduled.filter(s => s.ms === 300);
  assert.equal(page.length, 1);
  page[0].fn();
  assert.equal(show.PROG.dia, 100000);
  assert.match(show.pops[0].innerHTML, /gpBox/);
});
