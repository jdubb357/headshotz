import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Battle Royale join / kick regressions.
// A dropped connection must not eliminate a human, a friend must replace a bot (never a human),
// late join stays open until 50 humans, and a missed party room must not create a rival host.
// Run: node --test tests/br-join.test.mjs

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('game.js', root), 'utf8');
const sw = readFileSync(new URL('sw.js', root), 'utf8');

function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `missing section ${start}`);
  return source.slice(a, b);
}

function fresh() {
  const messages = [];
  const elims = [];
  const H = {
    mode: 'brs', phase: 'play', t: 30, offline: false, order: 1, botN: 1, round: 1, score: {}, mid: 4, next: 0,
    br: { over: 0, ph: 'bus', y: 230, t0: 10, half: 200, heli: { a: [0, 0], b: [100, 0] }, storm: { ph: 0 }, alive: 40, squads: 12, zones: [{ x: 0, z: 0, r: 40 }] },
    players: {},
  };
  const conns = {};
  const outQ = {};
  const window = {};
  const ctx = {
    messages, elims, H, conns, outQ, window, me: { id: 'host' }, peer: null,
    BRM: m => m === 'br' || m === 'brs', RAIDM: () => false, MAXP: 10, BR_RECONN: 20,
    MODEMAX: { br: 50, brs: 50, team: 4 },
    BRC: { sq: 4, busDur: 52, heliY: 230 },
    SQCOL: [1, 2, 3, 4, 5, 6, 7, 8], FFACOL: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    WIDX: { fists: 0 },
    roomCode: '', conn: null,
    normCode: c => { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : null; },
    cleanSkin: x => x, cleanWS: x => x || {}, clOf: x => x || 'soldier', fitOf: () => 0,
    rrand: a => a,
    heliAt: () => [50, 10],
    newInv: () => ({ g: [], bp: [], m: [0, 0], c: [0, 0, 0, 0], res: [0, 0, 0, 0] }),
    newP: (id, name, bot) => ({ id, name: name || id, bot: !!bot, team: 'A', color: 1, alive: false, hp: 100, elim: 0, ord: H.order++, p: [0, 0, 0, 0], air: null }),
    plist: () => Object.values(H.players).sort((a, b) => (a.ord || 0) - (b.ord || 0)),
    lobbyData: () => ({ t: 'lobby' }),
    startData: () => ({ t: 'start', mid: H.mid }),
    stormState: () => ({ ph: 0 }),
    sendSB() {},
    noteSack(id) { messages.push({ to: id, t: 'sack' }); },
    sendTo(id, m) { messages.push({ to: id, ...m }); },
    bcast(m) { messages.push({ to: '*', ...m }); },
    brElim(p) { p.elim = 1; elims.push(p.id); },
    sendLobby() { messages.push({ t: 'lobby' }); },
    checkRound() {}, remCheck() {}, botTakeover() {},
    clientHandle() {},
  };
  ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(section('function brTeam(p,team){', 'function teamSmaller(){'), ctx);
  vm.runInContext(section('function brLink(from,m){', 'function brLateMsg(np){'), ctx);
  vm.runInContext(section('function hostLeave(id){', 'function hostHandle(from,m){'), ctx);
  vm.runInContext(section('function joinMissPlan(attempt,locked){', 'function joinRoom(code,auto,attempt,opt){'), ctx);
  vm.runInContext(section('function partyFollow(room){', 'function partyMsg(m,code,name,cat){'), ctx);
  vm.runInContext(section('function sendTo(id,m){', 'function bcast(m,except){'), ctx);
  return ctx;
}

function add(ctx, id, extra) {
  const p = ctx.newP(id, extra.name || id, !!extra.bot);
  Object.assign(p, extra, { id });
  ctx.H.players[id] = p;
  return p;
}

test('service worker is v101+ and in-progress Royale join goes through brLateJoin', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 101);
  const host = section('function hostHandle(from,m){', 'function rayClearHost(');
  assert.match(host, /brLink\(from,m\)/);
  assert.match(host, /brLateJoin\(from,m\)/);
  const late = section('function brLateJoin(from,m){', 'function brLateMsg(np){');
  assert.doesNotMatch(late, /MAXP/);
  assert.match(source, /fc:FR&&FR\.code/);
  assert.match(source, /joinMissPlan\(attempt,locked\)/);
});

test('a dropped Battle Royale connection keeps the human for the reconnect window', () => {
  const ctx = fresh();
  const human = add(ctx, 'p1', { bot: false, alive: true, hp: 80, team: 'S1', fc: 'ABCD-EFGH', elim: 0 });
  ctx.hostLeave('p1');
  assert.equal(ctx.H.players.p1, human);
  assert.equal(human.elim, 0);
  assert.equal(human.alive, true);
  assert.equal(human.dc, 1);
  assert.equal(ctx.elims.length, 0);
  assert.equal(ctx.messages.some(m => m.t === 'bye'), false);
  ctx.hostLeave('p1');
  assert.equal(ctx.H.players.p1, human, 'a second close during the window must not delete them');
  ctx.H.t = human.gone + 19;
  ctx.brSweepGone();
  assert.equal(ctx.H.players.p1, human);
  ctx.H.t = human.gone + 20;
  ctx.brSweepGone();
  assert.equal(ctx.H.players.p1, undefined);
  assert.deepEqual(ctx.elims, ['p1']);
});

test('round end still removes a leaver so the lobby can move on', () => {
  const ctx = fresh();
  ctx.H.phase = 'roundEnd';
  add(ctx, 'p1', { bot: false, alive: true, team: 'S1' });
  ctx.hostLeave('p1');
  assert.equal(ctx.H.players.p1, undefined);
  assert.equal(ctx.messages.some(m => m.t === 'bye' && m.id === 'p1'), true);
});

test('the same friend code reclaims the seat and does not remove a bot or a human', () => {
  const ctx = fresh();
  const human = add(ctx, 'old', { bot: false, alive: true, hp: 73, team: 'S2', air: 'bus', fc: 'ABCD-EFGH', dc: 1, gone: 12, p: [4, 230, 8, 0] });
  const bot = add(ctx, 'b1', { bot: true, team: 'S2', alive: true });
  const other = add(ctx, 'h2', { bot: false, team: 'S3', alive: true, fc: 'ZZZZ-ZZZZ' });
  const how = ctx.brLink('new', { fc: 'ABCD-EFGH', name: 'Ada' });
  assert.equal(how, 'reclaim');
  assert.equal(ctx.H.players.new, human);
  assert.equal(human.id, 'new');
  assert.equal(human.hp, 73);
  assert.equal(human.team, 'S2');
  assert.equal(human.dc, 0);
  assert.equal(ctx.H.players.old, undefined);
  assert.equal(ctx.H.players.b1, bot);
  assert.equal(ctx.H.players.h2, other);
  assert.equal(ctx.window.__brReclaim, 1);
  assert.equal(ctx.brLink('new', { fc: 'ABCD-EFGH' }), 'same');
  const host = add(ctx, 'host', { bot: false, fc: 'HHHH-HHHH', alive: true, team: 'S1' });
  ctx.me.id = 'host';
  assert.equal(ctx.brLink('other', { fc: 'HHHH-HHHH' }), '');
  assert.equal(ctx.H.players.host, host);
  const live = add(ctx, 'live', { bot: false, fc: 'LLLL-LLLL', alive: true, team: 'S4' });
  ctx.conns.live = { open: true };
  assert.equal(ctx.brLink('other2', { fc: 'LLLL-LLLL' }), '');
  assert.equal(ctx.H.players.live, live);
});

test('an 11th human replaces a bot in a 50-player match', () => {
  const ctx = fresh();
  const humans = [];
  for (let i = 0; i < 10; i++) humans.push(add(ctx, 'h' + i, { bot: false, team: 'S' + (1 + (i % 8)), alive: true, air: 'bus', party: i === 0 ? 'P1' : null }).id);
  for (let i = 0; i < 40; i++) add(ctx, 'b' + i, { bot: true, team: 'S' + (1 + (i % 12)), alive: true });
  assert.equal(ctx.plist().length, 50);
  ctx.brLateJoin('joiner', { name: 'Jin', party: 'P9', fc: 'JJJJ-JJJJ' });
  const ids = ctx.plist();
  assert.equal(ctx.messages.some(m => m.t === 'full'), false);
  assert.equal(ids.length, 50);
  assert.equal(ids.filter(p => !p.bot).length, 11);
  assert.ok(ctx.H.players.joiner);
  for (const id of humans) assert.ok(ctx.H.players[id], 'human removed: ' + id);
  assert.equal(ctx.messages.filter(m => m.t === 'bye' && humans.includes(m.id)).length, 0);
  assert.equal(ctx.messages.filter(m => m.t === 'bye').length, 1);
  assert.equal(ctx.H.players.joiner.air, 'bus');
  const queued = ctx.outQ.joiner || [];
  assert.ok(queued.some(m => m.t === 'brin' && m.air === 'bus'));
  assert.ok(queued.some(m => m.t === 'start'));
});

test('a party friend replaces a bot in the same squad and drops with them', () => {
  const ctx = fresh();
  ctx.H.br.ph = 'play';
  ctx.H.t = 90;
  ctx.H.br.t0 = 0;
  const mate = add(ctx, 'mate', { bot: false, team: 'S1', party: 'P1', alive: true, air: 'fall', p: [10, 80, 12, 1] });
  const squadBots = ['b0', 'b1', 'b2'].map(id => add(ctx, id, { bot: true, team: 'S1', alive: true }).id);
  for (let i = 0; i < 36; i++) add(ctx, 'o' + i, { bot: true, team: 'S2', alive: true });
  for (let i = 0; i < 9; i++) add(ctx, 'x' + i, { bot: false, team: 'S3', alive: true });
  ctx.brLateJoin('joiner', { name: 'Bea', party: 'P1', fc: 'BBBB-BBBB' });
  assert.equal(ctx.H.players.joiner.team, 'S1');
  assert.equal(ctx.H.players.joiner.air, 'fall');
  assert.equal(ctx.H.players.joiner.p[0], mate.p[0]);
  assert.equal(ctx.H.players.joiner.p[2], mate.p[2]);
  assert.equal(ctx.H.players.mate, mate);
  const gone = squadBots.filter(id => !ctx.H.players[id]);
  assert.equal(gone.length, 1);
  assert.equal(ctx.plist().filter(p => p.team === 'S1').length, 4);
  assert.equal(ctx.plist().length, 49);
});

test('a full human squad takes a bot from another squad and never a human', () => {
  const ctx = fresh();
  const humans = ['h0', 'h1', 'h2', 'h3'].map((id, i) => add(ctx, id, { bot: false, team: 'S1', party: 'P1', alive: true, air: 'bus', ord: i + 1 }).id);
  const s2 = add(ctx, 's2bot', { bot: true, team: 'S2', alive: false, ord: 10 });
  for (let i = 0; i < 45; i++) add(ctx, 'b' + i, { bot: true, team: 'S3', alive: true, ord: 20 + i });
  ctx.brLateJoin('joiner', { name: 'Cy', party: 'P1', fc: 'CCCC-CCCC' });
  assert.equal(ctx.messages.some(m => m.t === 'full'), false);
  assert.equal(ctx.H.players.joiner.team, 'S2');
  assert.equal(ctx.H.players.s2bot, undefined);
  assert.equal(s2.id, 's2bot');
  for (const id of humans) assert.ok(ctx.H.players[id]);
  assert.equal(ctx.plist().length, 50);
  assert.ok(ctx.plist().filter(p => p.team === 'S1').every(p => !p.bot));
  assert.equal(ctx.H.players.joiner.air, 'bus');
});

test('a squad with room keeps the friend even when its own bots are already gone', () => {
  const ctx = fresh();
  add(ctx, 'mate', { bot: false, team: 'S1', party: 'P1', alive: true, air: 'bus' });
  for (let i = 0; i < 48; i++) add(ctx, 'b' + i, { bot: true, team: 'S4', alive: true });
  ctx.brLateJoin('joiner', { name: 'Dee', party: 'P1', fc: 'DDDD-DDDD' });
  assert.equal(ctx.H.players.joiner.team, 'S1');
  assert.equal(ctx.H.players.mate.team, 'S1');
  assert.equal(ctx.plist().length, 50);
  assert.equal(ctx.plist().filter(p => !p.bot && p.team === 'S1').length, 2);
  assert.equal(ctx.messages.some(m => m.t === 'full'), false);
});

test('fifty humans is full and removes nobody', () => {
  const ctx = fresh();
  for (let i = 0; i < 50; i++) add(ctx, 'h' + i, { bot: false, team: 'S' + (1 + (i % 12)), alive: true });
  ctx.brLateJoin('joiner', { name: 'Eve', fc: 'EEEE-EEEE' });
  assert.equal(ctx.H.players.joiner, undefined);
  assert.equal(ctx.plist().length, 50);
  assert.ok((ctx.outQ.joiner || []).some(m => m.t === 'full'));
  assert.equal(ctx.messages.some(m => m.t === 'bye'), false);
});

test('solo Royale gives the joiner their own team and replaces one bot', () => {
  const ctx = fresh();
  ctx.H.mode = 'br';
  add(ctx, 'host', { bot: false, team: 'host', alive: true, air: 'bus' });
  for (let i = 0; i < 49; i++) add(ctx, 'b' + i, { bot: true, team: 'b' + i, alive: true });
  ctx.brLateJoin('joiner', { name: 'Sol', fc: 'SSSS-SSSS' });
  assert.equal(ctx.H.players.joiner.team, 'joiner');
  assert.equal(ctx.plist().length, 50);
  assert.equal(ctx.plist().filter(p => !p.bot).length, 2);
  assert.equal(ctx.H.players.host.team, 'host');
});

test('a closed connection queues the start message until the link opens', () => {
  const ctx = fresh();
  const sent = [];
  ctx.conns.a = { open: false, send(m) { sent.push(m); } };
  ctx.sendTo('a', { t: 'start', mid: 4 });
  assert.equal(sent.length, 0);
  assert.equal(ctx.outQ.a.length, 1);
  ctx.conns.a.open = true;
  ctx.flushOut('a');
  assert.deepEqual(sent, [{ t: 'start', mid: 4 }]);
  assert.equal(ctx.outQ.a, undefined);
});

test('party follow retries a missed room and never creates a rival host', () => {
  const ctx = fresh();
  for (let i = 0; i < 8; i++) assert.equal(ctx.joinMissPlan(i, true), 'retry');
  assert.equal(ctx.joinMissPlan(8, true), 'giveup');
  assert.equal(ctx.joinMissPlan(4, false), 'create');
  ctx.roomCode = 'ABCD';
  ctx.conn = { open: true };
  assert.equal(ctx.partyFollow('ABCD'), false);
  ctx.conn = { open: false };
  assert.equal(ctx.partyFollow('ABCD'), true);
  assert.equal(ctx.partyFollow('no'), false);
  assert.match(section('if(m.t===\'pgo\'){', 'return{t:\'ok\'}'), /partyFollow\(room\)/);
  assert.match(section('if(m.t===\'pgo\'){', 'return{t:\'ok\'}'), /locked:1/);
});
