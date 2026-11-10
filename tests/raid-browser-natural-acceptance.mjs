// Natural, fixture-free raid acceptance run. This is an acceptance probe, NOT a
// unit or regression test: it plays one real raid through the shipped UI with
// native keyboard/mouse controls against the authoritative live server. It
// touches no raid state directly and grants no loot. It reads the public snapshot
// to steer and to select loot, and uses the shipped route graph only as a local
// navigation aid — the operator still walks every metre through native input.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {getWorld} from '../shared/raid-worlds.mjs';
import {findPath} from '../shared/raid-navigation.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wrapped = a => Math.atan2(Math.sin(a), Math.cos(a));
let page, accountId;

const down = (code, key) => page.command('Input.dispatchKeyEvent', {type: 'keyDown', code, key: key ?? code});
const up = (code, key) => page.command('Input.dispatchKeyEvent', {type: 'keyUp', code, key: key ?? code});
const press = async (code, key) => { await down(code, key); await sleep(50); await up(code, key); };
const state = () => page.evaluate("fetch('/api/raid').then(r => r.json())");
const self = async () => (await state()).self;

async function waitFor(fn, timeout = 10000, interval = 120) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await fn();
    if (value) return value;
    await sleep(interval);
  }
  throw new Error('Timed out waiting for condition');
}

async function face(desiredYaw, maxMs = 4000) {
  const until = Date.now() + maxMs;
  let arrow = null;
  try {
    while (Date.now() < until) {
      const snap = await state();
      if (!snap?.self?.alive || snap.self.downed) return;
      const d = wrapped(desiredYaw - (snap.self.yaw || 0));
      if (Math.abs(d) < 0.04) return;
      const next = d > 0 ? 'ArrowLeft' : 'ArrowRight';
      if (arrow !== next) { if (arrow) await up(arrow); await down(next); arrow = next; }
      await sleep(80);
    }
  } finally { if (arrow) await up(arrow); }
}

async function pitchTo(target, maxMs = 2000) {
  const until = Date.now() + maxMs;
  let arrow = null;
  try {
    while (Date.now() < until) {
      const snap = await state();
      if (!snap?.self?.alive || snap.self.downed) return;
      const d = target - (snap.self.pitch || 0);
      if (Math.abs(d) < 0.025) return;
      const next = d > 0 ? 'ArrowUp' : 'ArrowDown';
      if (arrow !== next) { if (arrow) await up(arrow); await down(next); arrow = next; }
      await sleep(70);
    }
  } finally { if (arrow) await up(arrow); }
}

async function walkTo(x, z, {sprint = false, timeout = 60000} = {}) {
  await down('KeyW');
  if (sprint) await down('KeyX');
  let arrow = null;
  try {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const snap = await state();
      if (!snap?.self?.alive || snap.self.downed) return snap?.self;
      const dx = x - snap.self.x, dz = z - snap.self.z, dist = Math.hypot(dx, dz);
      if (dist <= 1.4) return snap.self;
      const d = wrapped(Math.atan2(dx, dz) - (snap.self.yaw || 0));
      const next = Math.abs(d) < 0.05 ? null : d > 0 ? 'ArrowLeft' : 'ArrowRight';
      if (next !== arrow) { if (arrow) await up(arrow); if (next) await down(next); arrow = next; }
      await sleep(110);
    }
    return (await state())?.self;
  } finally {
    await up('KeyW'); if (sprint) await up('KeyX'); if (arrow) await up(arrow);
  }
}

async function clickControl(itemId, label) {
  return waitFor(() => page.evaluate(`(() => {
    const row = document.querySelector('#pack .item[data-item-id=${JSON.stringify(itemId)}]');
    if (!row) return false;
    const button = [...row.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(label)});
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`).catch(() => false), 6000);
}

async function countpacked(itemId) {
  return waitFor(async () => {
    const snap = await state();
    const owned = [...(snap.self.pack || []), ...(snap.self.secure || [])];
    return owned.some(it => it.id === itemId) ? snap : false;
  }, 4000);
}

async function activeLoot() {
  const snap = await state();
  const loot = (snap.loot || []).filter(l => l.items.length);
  loot.sort((a, b) => Math.hypot(a.x - snap.self.x, a.z - snap.self.z) - Math.hypot(b.x - snap.self.x, b.z - snap.self.z));
  return loot[0] || null;
}

async function nearestThreat(maxDistance = 45) {
  const snap = await state();
  if (!snap?.self?.alive || snap.self.downed) return null;
  const machines = (snap.machines || []).filter(m => m.hp > 0);
  machines.sort((a, b) => Math.hypot(a.x - snap.self.x, a.z - snap.self.z) - Math.hypot(b.x - snap.self.x, b.z - snap.self.z));
  const nearest = machines[0];
  if (!nearest) return null;
  const dist = Math.hypot(nearest.x - snap.self.x, nearest.z - snap.self.z);
  return dist <= maxDistance ? {...nearest, distance: dist} : null;
}

async function shootMachine(machine, maxRounds = 8) {
  let before = machine.hp;
  for (let round = 0; round < maxRounds; round++) {
    const snap = await state();
    const live = (snap.machines || []).find(m => m.id === machine.id && m.hp > 0);
    if (!live) { evidence.combat.push({target: machine.kind, hpBefore: before, hpAfter: 0, killed: true}); return true; }
    const dx = live.x - snap.self.x, dz = live.z - snap.self.z, dist = Math.hypot(dx, dz);
    if (dist > 64) return false;
    const height = {scout: 1.35, hunter: 1.8, heavy: 2.8, flyer: 1.1, overlord: 5.2}[live.kind] || 1.8;
    await face(Math.atan2(dx, dz), 900);
    await pitchTo(Math.atan2(height * 0.55 - 1.55, Math.max(1, dist)), 700);
    const hpBeforeShot = live.hp;
    await press('KeyF', 'f');
    await sleep(240);
    const after = (await state()).machines?.find(m => m.id === machine.id);
    if (!after || after.hp < hpBeforeShot) {
      evidence.combatHits = (evidence.combatHits || 0) + (after ? 1 : 0);
      evidence.combat.push({target: machine.kind, distance: Math.round(dist), hpBefore: hpBeforeShot, hpAfter: after?.hp ?? 0});
    }
    if (!after || after.hp <= 0) return true;
  }
  return false;
}

function settlement() {
  return store.results(accountId)[0] || null;
}

function planRoute(snap, targetX, targetZ) {
  const world = getWorld(snap.map, snap.mapVersion || 1);
  const path = findPath(world, {x: snap.self.x, y: snap.self.y || 0, z: snap.self.z}, {x: targetX, y: 0, z: targetZ}, {radius: 0.5, height: 1.2, maxNodes: 1000000});
  assert.ok(path?.length, 'Navigation graph found a walkable route');
  const points = [];
  let last = {x: snap.self.x, z: snap.self.z};
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (Math.hypot(p.x - last.x, p.z - last.z) >= 11 || i === path.length - 1) { points.push({x: p.x, z: p.z}); last = p; }
  }
  return points;
}

const evidence = {events: [], lootTaken: [], secured: [], routedMetres: 0, routePoints: 0, combat: []};
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('natural_' + Date.now().toString(36).slice(-6))};document.querySelector('[name=password]').value='a natural raid acceptance password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;

  // Load actual starter equipment through the stash checkboxes, as a player would.
  const loadout = await page.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('#stash input[data-equip]:not([disabled])')];
    const pick = kind => inputs.find(i => i.closest('[data-kind]')?.dataset.kind === kind);
    const weapon = pick('weapon'), armor = pick('armor'), med = pick('med');
    for (const input of [weapon, armor, med].filter(Boolean)) { input.checked = true; input.dispatchEvent(new Event('change', {bubbles: true})); }
    return {weapon: weapon?.value || null, armor: armor?.value || null, med: med?.value || null};
  })()`);
  assert.ok(loadout.weapon, 'a starter weapon is selectable');
  evidence.loadout = loadout;

  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  let snap = await state();
  const start = {x: snap.self.x, z: snap.self.z};
  evidence.deployed = {map: snap.map, x: start.x, z: start.z, hp: snap.self.hp, cap: snap.self.cap, secureCap: snap.self.secureCap, ammo: snap.self.ammo};

  // Loot the nearest visible field pile with native movement and the E key.
  const firstLoot = await activeLoot();
  assert.ok(firstLoot, 'a natural ground-loot pile is visible from insertion');
  evidence.events.push('walked to ' + firstLoot.label);
  await walkTo(firstLoot.x, firstLoot.z, {timeout: 30000});
  await press('KeyE', 'e');
  const weaponItem = firstLoot.items.find(it => it.kind === 'weapon');
  if (weaponItem) {
    try { await clickControl(weaponItem.id, 'Take'); } catch {} // E already auto-takes the weapon when one is present.
  }
  snap = await state();
  const takenNow = [...(snap.self.pack || []), ...(snap.self.equipment || [])].map(it => it.id);
  evidence.lootTaken = takenNow;
  evidence.events.push('looted ' + firstLoot.label);
  for (const it of firstLoot.items) {
    if (it.kind === 'weapon') continue;
    try { await clickControl(it.id, 'Take'); evidence.lootTaken.push(it.id); } catch {}
  }

  // Let the first pile clear server-side, then walk to the nearer field supply pile
  // that advertises a medical/material item. This keeps the acceptance's secure
  // check meaningful without injecting items or teleporting.
  const firstLootId = firstLoot.id;
  await waitFor(async () => {
    const s = await state();
    const pile = (s.loot || []).find(l => l.id === firstLootId);
    return !pile || !pile.items.length;
  }, 8000).catch(() => false);
  const supplySnapshot = await state();
  const supplyLoot = (supplySnapshot.loot || [])
    .filter(l => l.id !== firstLootId && l.items.some(it => it.kind === 'med' || it.kind === 'material'))
    .sort((a, b) => Math.hypot(a.x - supplySnapshot.self.x, a.z - supplySnapshot.self.z) - Math.hypot(b.x - supplySnapshot.self.x, b.z - supplySnapshot.self.z))[0];
  if (supplyLoot) {
    evidence.events.push('walked to ' + supplyLoot.label);
    if ((await walkTo(supplyLoot.x, supplyLoot.z, {timeout: 40000}))?.alive) await press('KeyE', 'e');
    for (const it of supplyLoot.items) {
      try { await clickControl(it.id, 'Take'); evidence.lootTaken.push(it.id); } catch {}
    }
    snap = await state();
    const secureable = (snap.self.pack || []).find(it => it.kind === 'med' || it.kind === 'material');
    if (secureable) {
      await clickControl(secureable.id, 'Secure');
      const secured = await countpacked(secureable.id);
      evidence.secured = (secured.self.secure || []).map(it => ({id: it.id, kind: it.kind, label: it.label || it.medical || it.material}));
      evidence.events.push('secured ' + JSON.stringify(evidence.secured));
    }
  }

  // Capture the field state before the long native walk to extraction.
  const fieldShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-natural-loot.png', Buffer.from(fieldShot.data, 'base64'));

  snap = await state();
  const call = snap.exits.find(e => e.kind === 'call') || snap.exits[0];
  const routePoints = planRoute(snap, call.x, call.z);
  evidence.routePoints = routePoints.length;
  evidence.events.push('planning ' + routePoints.length + ' waypoints to ' + call.id);
  let travelled = 0;
  for (let i = 0; i < routePoints.length; i++) {
    const s = await self();
    if (!s.alive || s.result) break;
    const before = {x: s.x, z: s.z};
    const s2 = await walkTo(routePoints[i].x, routePoints[i].z, {sprint: true, timeout: 60000});
    travelled += Math.hypot((s2?.x ?? before.x) - before.x, (s2?.z ?? before.z) - before.z);
    if (!s2?.alive || s2.downed) break;
    if ((s2.result)) break;
    // If a machine closes to fighting distance during the march, the operator
    // stops and engages with real aimed fire rather than walking through it.
    const threat = await nearestThreat(22);
    if (threat) {
      evidence.combat.push({kind: threat.kind, distance: Math.round(threat.distance)});
      await shootMachine(threat, 8);
    }
    if (i % 6 === 0) await sleep(150);
  }
  evidence.routedMetres = Math.round(travelled);
  snap = await self();
  evidence.reachedExit = snap ? {x: Math.round(snap.x), z: Math.round(snap.z), alive: snap.alive, downed: snap.downed} : null;

  if (snap.alive && !snap.downed && !snap.result) {
    // Hail the transport and stand the extraction watch under the arrival timer.
    await walkTo(call.x, call.z, {timeout: 30000});
    await press('KeyE', 'e');
    evidence.events.push('called transport');
    const activated = await waitFor(async () => {
      const s = await state();
      if (!s?.self?.alive || s.self.downed || s.self.result) return s;
      const exit = s.exits?.find(e => e.id === call.id);
      return exit && exit.openAt > 0 ? s : false;
    }, 15000);
    evidence.transport = activated.exits ? {openAt: activated.exits.find(e => e.id === call.id)?.openAt ?? null, serverTime: activated.serverTime} : null;
  } else {
    evidence.events.push('operator went down before reaching the beacon');
  }
  if (evidence.transport) {
    const exitShot = await page.command('Page.captureScreenshot', {format: 'png'});
    writeFileSync('/tmp/raid-natural-exit.png', Buffer.from(exitShot.data, 'base64'));

    // Fight whatever comes for the beacon while genuinely waiting the 35 s arrival.
    const arrivalDeadline = Date.now() + 40000;
    while (Date.now() < arrivalDeadline) {
      const s = await state();
      if (!s?.self?.alive || s.self.downed || s.self.result) break;
      const exit = s.exits.find(e => e.id === call.id);
      if (exit && s.serverTime >= exit.openAt) break;
      const threat = await nearestThreat(30);
      if (threat) await shootMachine(threat, 8);
      else await sleep(700);
    }
    // Walk into the beacon and board with the shipped E key. Iteration 18 makes
    // the open exit win the single interact key even when ambush salvage is nearer,
    // so no bag-dodging detour is attempted here.
    for (let attempt = 0; attempt < 20; attempt++) {
      snap = await state();
      if (!snap?.self?.alive || snap.self.downed || snap.self.result || snap.self.board) break;
      const exit = snap.exits.find(e => e.id === call.id);
      if (!exit || snap.serverTime >= exit.closeAt) break;
      evidence.bagsNearOpenExit = (snap.bags || []).filter(b => Math.hypot(b.x - exit.x, b.z - exit.z) < 4.5).length;
      await walkTo(exit.x, exit.z, {timeout: 8000});
      snap = await state();
      const current = snap?.exits?.find(e => e.id === call.id);
      evidence.boardingHint = await page.evaluate("document.getElementById('hint')?.textContent || ''");
      if (snap?.self?.alive && !snap.self.downed && !snap.self.result && current?.openAt <= snap.serverTime && snap.serverTime < current.closeAt && !evidence.boardingHint.includes('exit')) {
        throw new Error('the open exit was not the targeted interaction: ' + evidence.boardingHint);
      }
      await press('KeyE', 'e');
      await sleep(900);
    }
  }
  const result = await waitFor(async () => {
    try {
      const s = await state();
      return s?.self?.result ? s : false;
    } catch { return false; }
  }, 25000).catch(() => null);
  evidence.raidResult = result?.self?.result ? {outcome: result.self.result.outcome, items: (result.self.result.items || []).length} : null;

  // The public hint reports outcome; settle through the real Back to base button.
  const hint = await waitFor(() => page.evaluate("document.getElementById('hint')?.textContent || ''").then(t => /EXTRACTED|DEATH|TIMEOUT/i.test(t) ? t : false)).catch(() => null);
  evidence.hint = hint;
  if (hint) await page.evaluate("document.getElementById('leave').click()").catch(() => {});
  await sleep(1500);

  const results = store.results(accountId);
  assert.ok(results.length >= 1, 'the raid settlement is on record');
  const settled = results[0];
  evidence.settlement = {
    outcome: settled.outcome,
    reason: settled.reason,
    items: (settled.items || []).map(it => ({id: it.id, kind: it.kind, recovery: !!it.recovery})),
    lostItems: (settled.lostItems || []).map(it => ({id: it.id, kind: it.kind})),
    credits: settled.credits,
    facts: settled.facts
  };
  evidence.browserErrors = page.errors;
  assert.deepEqual(page.errors, [], 'the natural-play browser context has no errors');
  assert.ok(['extract', 'death'].includes(settled.outcome), 'the raid ended naturally by extraction or death');
  assert.ok((settled.facts?.roundsFired || 0) > 0, 'the player fired with native controls during the raid');
  assert.ok(evidence.secured.length > 0, 'an item was secured in the protected pocket');
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  console.error(JSON.stringify({failure: String(error), evidence, browserErrors: page?.errors}, null, 2));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
