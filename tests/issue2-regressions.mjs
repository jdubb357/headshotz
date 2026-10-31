import assert from 'node:assert/strict';

// Focused regressions for GitHub issue #2 gaps reproduced against the production game:
// 1. a party friend joining a live Squad Royale match whose party squad is full of humans must
//    still enter the match by taking a bot slot in another squad (squad cap stays 4).
// 2. a duplicated BR roundEnd message pays the +30 victory bonus only once per match, and the
//    guard resets for the next match.
// 3. the shop pricing tiers match the issue: Legendary ("godly") 5,000, Secret 3,000, with the
//    same amounts shown in the weapon shop and deducted on purchase.
//
// Run: node tests/issue2-regressions.mjs
// Defaults: Chrome CDP 127.0.0.1:9337, local game server 127.0.0.1:8010.
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9337';
const BASE = process.env.RAID_TEST_URL || 'http://127.0.0.1:8010';

async function connect(url) {
  const socket = new WebSocket(url), pending = new Map(), errors = [];
  let seq = 0;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser WebSocket did not open: ' + url)), 15000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = error => { clearTimeout(timer); reject(error); };
  });
  socket.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  };
  socket.onclose = () => { for (const p of pending.values()) p.reject(new Error('Browser disconnected')); pending.clear(); };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 90000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, errors, command };
}

async function makePage(root, contextId, url, beforeNavigation) {
  const { targetId } = await root.command('Target.createTarget', { url: 'about:blank', browserContextId: contextId });
  const list = await (await fetch(CDP + '/json/list')).json();
  const target = list.find(t => t.id === targetId);
  assert.ok(target, 'created browser target must be inspectable');
  const page = await connect(target.webSocketDebuggerUrl);
  await page.command('Runtime.enable');
  await page.command('Page.enable');
  await page.command('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (beforeNavigation) await page.command('Page.addScriptToEvaluateOnNewDocument', { source: beforeNavigation });
  await page.command('Page.navigate', { url });
  try { await page.command('Page.setWebLifecycleState', { state: 'active' }); } catch {}
  page.evaluate = async expression => {
    const result = await page.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  page.wait = async (expression, timeout = 30000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try { if (await page.evaluate(expression)) return; }
      catch (error) {
        if (!/Execution context.*destroyed|Cannot find context|Inspected target navigated/.test(error.message)) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    throw new Error('Timed out: ' + expression);
  };
  page.targetId = targetId;
  return page;
}

async function newGamePage(root, contextId, path = '/', beforeNavigation) {
  const page = await makePage(root, contextId, BASE + path + (path.includes('?') ? '&' : '?') + 'net=local', beforeNavigation);
  await page.wait('document.readyState==="complete" && !!window.__hsz && !!window.__hsz.room');
  return page;
}

async function startRoyale(root, contextId, mode, name) {
  const host = await newGamePage(root, contextId);
  await host.evaluate(`document.getElementById('nameIn').value=${JSON.stringify(name)};document.getElementById('createBtn').click()`);
  await host.wait(`window.__hsz.room.code && !document.getElementById('lobby').classList.contains('hidden')`);
  const code = String(await host.evaluate('window.__hsz.room.code'));
  await host.evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
  await host.wait(`window.__hsz.H.mode==='${mode}'`);
  await host.evaluate(`document.getElementById('startBtn').click()`);
  await host.wait(`window.__hsz.H.phase==='play'`);
  return { host, code };
}

async function joinClient(root, contextId, code, beforeNavigation) {
  const client = await makePage(root, contextId, BASE + '/?join=' + code + '&net=local', beforeNavigation);
  await client.wait('document.readyState==="complete" && !!window.__hsz && !!window.__hsz.room');
  return client;
}

async function closeContext(root, contextId, pages = []) {
  for (const page of pages) {
    try { await root.command('Target.closeTarget', { targetId: page.targetId }); } catch {}
    try { await page.socket.close(); } catch {}
  }
  try { await root.command('Target.disposeBrowserContext', { browserContextId: contextId }); } catch {}
}

const result = { checks: {} };
const root = await connect((await (await fetch(CDP + '/json/version')).json()).webSocketDebuggerUrl);

try {
  // ---- 1. full party squad joins by taking a bot slot in another squad ----
  {
    console.log('CASE full-squad party join');
    const contextId = (await root.command('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const { host, code } = await startRoyale(root, contextId, 'brs', 'Austin');
    const before = await host.evaluate(`(() => {
      const H = window.__hsz.H, me = window.__hsz.me;
      H.players[me.id].party = 'P1';
      const s1bots = Object.values(H.players).filter(q => q.bot && q.team === 'S1');
      for (const b of s1bots) delete H.players[b.id];
      for (let i = 0; i < 3; i++) {
        const id = 'p1_' + i;
        H.players[id] = {id, name: 'Party Friend ' + (i + 1), bot: false, machine: false, team: 'S1', party: 'P1', alive: true, air: null, hp: 100, elim: 0, ord: 100 + i, p: [0, 0, 0]};
      }
      const p = Object.values(H.players);
      return {total: p.length, bots: p.filter(q => q.bot).length, humans: p.filter(q => !q.bot).length, s1Humans: p.filter(q => !q.bot && q.team === 'S1').length};
    })()`);
    assert.equal(before.total, 24, 'full-squad fixture keeps the 24-player match size');
    assert.equal(before.bots, 20, 'full-squad fixture has bots in other squads');
    assert.equal(before.humans, 4, 'full-squad fixture has four humans');
    assert.equal(before.s1Humans, 4, 'party squad S1 is at its 4-human cap');

    const partyScript = `sessionStorage.setItem('hsz_party', JSON.stringify({id:'P1',lead:'HOST',m:[{code:'HOST',name:'Austin'},{code:'C1',name:'Party Friend 5'}]}))`;
    const client = await joinClient(root, contextId, code, partyScript);
    let joined = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 240));
      joined = await client.evaluate(`(() => {const C = window.__hsz.CC(), me = window.__hsz.ME();return C && me.id && C.players[me.id] ? {id: me.id, team: C.players[me.id].team, msg: document.getElementById('menuMsg').textContent} : null})()`);
      if (joined) break;
    }
    assert.ok(joined, 'party friend was rejected instead of entering the live match');
    const after = await host.evaluate(`(() => {
      const p = Object.values(window.__hsz.H.players);
      return {total: p.length, bots: p.filter(q => q.bot).length, humans: p.filter(q => !q.bot).length,
        byTeam: p.reduce((a, q) => ((a[q.team] = (a[q.team] || 0) + 1), a), {}),
        joiner: window.__hsz.H.players[${JSON.stringify(joined.id)}] && {team: window.__hsz.H.players[${JSON.stringify(joined.id)}].team}};
    })()`);
    assert.equal(after.total, 24, 'match size stays 24 after the party friend joins');
    assert.equal(after.bots, 19, 'the party friend replaced an available bot');
    assert.equal(after.humans, 5, 'the party friend is in the match as a human');
    assert.equal(after.joiner.team, 'S2', 'the full party squad is preserved; the joiner takes a bot slot in another squad');
    assert.ok(Object.values(after.byTeam).every(n => n <= 4), 'every squad stays at the 4-player cap: ' + JSON.stringify(after.byTeam));
    result.checks.fullSquadJoin = {...before, ...after, clientId: joined.id, clientTeam: joined.team};
    result.checks.fullSquadJoin.errors = host.errors.concat(client.errors);
    assert.equal(result.checks.fullSquadJoin.errors.length, 0, 'console errors: ' + JSON.stringify(result.checks.fullSquadJoin.errors));
    await closeContext(root, contextId, [host, client]);
  }

  // ---- 1b. solo Battle Royale mid-match join also replaces a bot ----
  {
    console.log('CASE solo mid-match join');
    const contextId = (await root.command('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const { host, code } = await startRoyale(root, contextId, 'br', 'Austin');
    const before = await host.evaluate(`(() => {
      const p = Object.values(window.__hsz.H.players);
      return {mode: window.__hsz.H.mode, total: p.length, bots: p.filter(q => q.bot).length};
    })()`);
    assert.equal(before.mode, 'br', 'solo Battle Royale fixture is in br mode');
    assert.equal(before.total, 24, 'solo Battle Royale match starts at its 24-player size');
    assert.equal(before.bots, 23, 'solo Battle Royale match starts with bots');
    const client = await joinClient(root, contextId, code);
    await client.wait(`(() => {const C = window.__hsz.CC(), me = window.__hsz.ME();return !!(C && C.mode==='br' && me.id && C.players[me.id] && window.__hsz.room.inGame)})()`, 40000);
    const joined = await client.evaluate(`(() => {const C = window.__hsz.CC(), me = window.__hsz.ME();return {id: me.id, mode: C.mode, phase: C.phase, team: C.players[me.id].team, air: me.air}})()`);
    const after = await host.evaluate(`(() => {const p = Object.values(window.__hsz.H.players);return {total: p.length, bots: p.filter(q => q.bot).length, humans: p.filter(q => !q.bot).length}})()`);
    assert.equal(after.total, 24, 'solo match size stays 24 after the online join');
    assert.equal(after.bots, 22, 'solo online join replaces one bot');
    assert.equal(after.humans, 2, 'solo match now has two humans');
    assert.equal(joined.mode, 'br', 'client entered solo Battle Royale');
    assert.equal(joined.team, joined.id, 'solo joiners keep their own team id');
    assert.ok(joined.air === 'bus' || joined.air === 'fall' || joined.air === 'chute', 'solo joiner is airborne on arrival: ' + joined.air);
    result.checks.soloJoin = {before, joined, after, errors: host.errors.concat(client.errors)};
    assert.equal(result.checks.soloJoin.errors.length, 0, 'console errors: ' + JSON.stringify(result.checks.soloJoin.errors));
    await closeContext(root, contextId, [host, client]);
  }

  // ---- 2. duplicate roundEnd pays the victory bonus once, and the guard resets next match ----
  {
    console.log('CASE victory duplicate guard');
    const contextId = (await root.command('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    console.log('victory context created');
    const { host, code } = await startRoyale(root, contextId, 'brs', 'Austin');
    console.log('victory host in play', code);
    const client = await joinClient(root, contextId, code);
    console.log('victory client page loaded');
    let joined = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 240));
      joined = await client.evaluate(`(() => {const C = window.__hsz.CC(), me = window.__hsz.ME();return C && me.id && C.players[me.id] ? {id: me.id, team: C.players[me.id].team} : null})()`);
      if (joined) break;
    }
    assert.ok(joined, 'client did not join the Squad Royale match');
    console.log('victory client joined', joined.id);
    const weekend = await client.evaluate('window.__hsz.isWknd()===true');
    console.log('victory weekend', weekend);
    const bonusValue = 30 * (weekend ? 2 : 1);
    const placementValue = 50 * (weekend ? 2 : 1);
    const sendRoundEnd = `(() => {
      const H = window.__hsz.H, id = ${JSON.stringify(joined.id)}, team = H.players[id].team;
      const m = {t: 'roundEnd', win: team, name: 'SQUAD', score: {}, match: true, br: 1, title: 'VICTORY ROYALE', sub: 'test squad', k: {}};
      window.__hsz.brx.bcast(m);
      window.__hsz.brx.bcast(m);
      return true;
    })()`;
    await host.evaluate(sendRoundEnd);
    await host.evaluate(`(() => {
      const m = {t: 'brp', ids: [${JSON.stringify(joined.id)}], place: 1, n: 24, k: {}, win: 1};
      window.__hsz.brx.bcast(m);
      window.__hsz.brx.bcast(m);
      return true;
    })()`);
    await new Promise(resolve => setTimeout(resolve, 800));
    const first = await client.evaluate(`(() => {
      const log = (window.__dlog || []).filter(e => String(e[1] || '').startsWith('royale victory bonus'));
      const place = (window.__dlog || []).filter(e => String(e[1] || '').startsWith('placement #1'));
      return {bonus: log, placement: place, dia: window.__hsz.PROG.dia};
    })()`);
    assert.equal(first.bonus.length, 1, 'duplicate roundEnd must not pay the victory bonus twice: ' + JSON.stringify(first.bonus));
    assert.equal(first.bonus[0][0], bonusValue, 'victory bonus amount is the base 30 (or weekend double)');
    assert.equal(first.placement.length, 1, 'duplicate brp must not pay placement twice: ' + JSON.stringify(first.placement));
    assert.equal(first.placement[0][0], placementValue, 'placement #1 reward remains correct');

    // Next match: drive the host rematch path, which sends startGame/startData to the client.
    await host.evaluate(`(() => {
      const H = window.__hsz.H;
      H.phase = 'roundEnd';
      H.matchOver = true;
      H.rem = {};
      window.__hsz.endGo(true);
      return true;
    })()`);
    await client.wait(`(() => {const C = window.__hsz.CC();return C && C.matchDia === 0 && C.phase === 'play'})()`, 30000);
    const nextTeam = await client.evaluate(`(() => {const C = window.__hsz.CC();return C.players[window.__hsz.ME().id].team})()`);
    await host.evaluate(`(() => {
      const m = {t: 'roundEnd', win: ${JSON.stringify(nextTeam)}, name: 'SQUAD', score: {}, match: true, br: 1, title: 'VICTORY ROYALE', sub: 'test squad 2', k: {}};
      window.__hsz.brx.bcast(m);
      window.__hsz.brx.bcast(m);
      return true;
    })()`);
    await new Promise(resolve => setTimeout(resolve, 800));
    const second = await client.evaluate(`(() => (window.__dlog || []).filter(e => String(e[1] || '').startsWith('royale victory bonus')))()`);
    assert.equal(second.length, 2, 'the guard must reset for the next match and pay once there: ' + JSON.stringify(second));
    assert.equal(second[1][0], bonusValue, 'next-match victory bonus amount is correct');
    result.checks.victoryGuard = {clientId: joined.id, first, second, weekend, bonusValue, placementValue};
    result.checks.victoryGuard.errors = host.errors.concat(client.errors);
    assert.equal(result.checks.victoryGuard.errors.length, 0, 'console errors: ' + JSON.stringify(result.checks.victoryGuard.errors));
    await closeContext(root, contextId, [host, client]);
  }

  // ---- 3. chest and weapon shop pricing ----
  {
    console.log('CASE chest and weapon pricing');
    const contextId = (await root.command('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const page = await newGamePage(root, contextId);
    const catalog = await page.evaluate(`(() => {
      const W = window.__hsz.W, C = window.__hsz.CHEST;
      return {
        chest: {legendary: C.cost.legendary, secret: C.cost.secret, common: C.cost.common},
        weapons: {
          aa12: {rar: W.aa12.rar, shop: W.aa12.shop, price: W.aa12.price},
          barrett: {rar: W.barrett.rar, shop: W.barrett.shop},
          awp: {rar: W.awp.rar, shop: W.awp.shop},
          minigun: {rar: W.minigun.rar, shop: W.minigun.shop}
        }
      };
    })()`);
    assert.deepEqual(catalog.chest, {legendary: 5000, secret: 3000, common: 300}, 'chest tier prices must match the issue');
    assert.equal(catalog.weapons.aa12.rar, 'LEGENDARY', 'legendary-tier weapons carry the project rarity label');
    assert.equal(catalog.weapons.aa12.shop, 5000, 'legendary-tier weapons cost 5,000 in the shop');
    assert.equal(catalog.weapons.barrett.shop, 5000, 'legendary-tier weapons cost 5,000 in the shop');
    assert.equal(catalog.weapons.awp.rar, 'SECRET', 'secret-tier weapons carry the project rarity label');
    assert.equal(catalog.weapons.awp.shop, 3000, 'secret-tier weapons cost 3,000 in the shop');
    assert.equal(catalog.weapons.minigun.shop, 3000, 'secret-tier weapons cost 3,000 in the shop');
    assert.equal(catalog.weapons.aa12.price, 1100, 'raid valuation retains the weapon base price');

    await page.evaluate(`(() => {window.__hsz.PROG.dia = 5100; document.getElementById('openShop').click(); return true})()`);
    await page.wait(`!document.getElementById('arsenal').classList.contains('hidden')`);
    await page.evaluate(`document.querySelector('#arsTabs [data-c="shotgun"]').click()`);
    await page.wait(`!!document.querySelector('#arsGrid [data-w="aa12"]')`);
    const badge = await page.evaluate(`document.querySelector('#arsGrid [data-w="aa12"]').innerText`);
    assert.ok(/LEGENDARY · 💎 5000/.test(badge), 'shop badge shows the rarity and 5,000 price: ' + JSON.stringify(badge));
    await page.evaluate(`document.querySelector('#arsGrid [data-w="aa12"]').click()`);
    await page.wait(`document.getElementById('arsEquip').textContent.includes('5000')`);
    await page.evaluate(`document.getElementById('arsEquip').click()`);
    const boughtLegendary = await page.evaluate(`(() => ({dia: window.__hsz.PROG.dia, owned: window.__hsz.PROG.owned.includes('aa12')}))()`);
    assert.equal(boughtLegendary.dia, 100, 'buying a legendary weapon deducts exactly 5,000 diamonds');
    assert.equal(boughtLegendary.owned, true, 'legendary weapon unlocked');

    await page.evaluate(`(() => {window.__hsz.PROG.dia = 3100; document.querySelector('#arsTabs [data-c="sniper"]').click(); return true})()`);
    await page.wait(`!!document.querySelector('#arsGrid [data-w="awp"]')`);
    await page.evaluate(`document.querySelector('#arsGrid [data-w="awp"]').click()`);
    await page.wait(`document.getElementById('arsEquip').textContent.includes('3000')`);
    await page.evaluate(`document.getElementById('arsEquip').click()`);
    const boughtSecret = await page.evaluate(`(() => ({dia: window.__hsz.PROG.dia, owned: window.__hsz.PROG.owned.includes('awp')}))()`);
    assert.equal(boughtSecret.dia, 100, 'buying a secret weapon deducts exactly 3,000 diamonds');
    assert.equal(boughtSecret.owned, true, 'secret weapon unlocked');
    result.checks.pricing = {catalog, boughtLegendary, boughtSecret, errors: page.errors};
    assert.equal(page.errors.length, 0, 'console errors: ' + JSON.stringify(page.errors));
    await closeContext(root, contextId, [page]);
  }

  result.error = null;
} catch (error) {
  result.error = String(error && error.stack || error);
  console.error('ISSUE 2 REGRESSION FAILED', error);
}

console.log('RESULT ' + JSON.stringify(result));
try { await root.socket.close(); } catch {}
process.exit(result.error ? 1 : 0);
