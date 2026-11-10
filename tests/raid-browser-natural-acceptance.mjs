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

// One precise turn-in-place through the shipped look bindings (see lookPulse
// below). Unlike a CDP held arrow key, this pulse covers exactly the requested
// arc, so the operator faces the waypoint instead of curving past it.
async function turnTo(x, z, p, maxPulseMs = 1600) {
  const diff = wrapped(Math.atan2(x - p.x, z - p.z) - (p.yaw || 0));
  if (Math.abs(diff) <= 0.03) return;
  await lookPulse(diff > 0 ? 'ArrowLeft' : 'ArrowRight', Math.min(maxPulseMs, Math.abs(diff) / 1.7 * 1000));
  // Let the client ship the held look in its next move packet (150 ms cadence)
  // and the authority reflect it before reading position again.
  await sleep(340);
}

// Native march to a waypoint: turn to the bearing once, hold the shipped
// forward and sprint keys, and re-turn only when terrain or a machine pushes
// the heading meaningfully off the waypoint. Steering with held arrows the
// whole way instead alternates above/below the bearing and effectively crawls.
// `arrive` is deliberately wider for route legs than for loot/exit points: the
// authoritative snapshot can lag a held key by several metres in headless
// Chrome, so an exact check misses the point and the operator orbits it.
async function walkTo(x, z, {sprint = false, timeout = 60000, arrive = 1.4} = {}) {
  let snap = await state();
  if (!snap?.self?.alive || snap.self.downed || snap.self.result) return snap?.self;
  await turnTo(x, z, snap.self);
  await down('KeyW');
  let fast = sprint;
  if (fast) await down('KeyX');
  let lastTurn = Date.now();
  let previous = null;
  try {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      snap = await state();
      if (!snap?.self?.alive || snap.self.downed || snap.self.result) return snap?.self;
      const dx = x - snap.self.x, dz = z - snap.self.z, dist = Math.hypot(dx, dz);
      if (dist <= arrive) return snap.self;
      // If the operator was inside the approach band and is now moving away,
      // it crossed the point between slow authoritative samples. Accept the
      // pass instead of turning back and orbiting it until the timeout. Precise
      // loot/exit approaches are handled by the bounded-step branch below, so
      // this pass rule only applies to the wider route-waypoint band.
      if (arrive > 2.6 && previous !== null && previous <= arrive + 1 && dist > previous + 0.8) return snap.self;
      previous = dist;
      // Near a tight interaction radius, a held key outruns the poll cadence and
      // overshoots. Stop, re-aim, and take one bounded step (at base walk speed)
      // so the player settles inside the loot/exit radius rather than circling.
      if (arrive <= 2.6 && dist <= 8) {
        await up('KeyW');
        if (fast) { await up('KeyX'); fast = false; }
        await turnTo(x, z, snap.self);
        const stepMs = Math.min(260, Math.max(60, (dist - arrive) / 5 * 1000));
        await down('KeyW');
        await sleep(stepMs);
        await up('KeyW');
        await sleep(180);
        continue;
      }
      // A sprint stop takes a few hundred ms to reach the shipped input
      // handler, so release sprint before the waypoint: at 9 m/s the operator
      // would otherwise carry past a corner and jam against the terrain.
      if (fast && dist <= 25) { await up('KeyX'); fast = false; }
      if (Date.now() - lastTurn >= 500) {
        const d = wrapped(Math.atan2(dx, dz) - (snap.self.yaw || 0));
        if (Math.abs(d) > 0.05) await turnTo(x, z, snap.self);
        lastTurn = Date.now();
      }
      await sleep(100);
    }
    return snap?.self || (await state())?.self;
  } finally {
    await up('KeyW'); if (sprint) await up('KeyX');
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

const MACHINE_HEIGHT = {scout: 1.35, hunter: 1.8, heavy: 2.8, flyer: 1.1, overlord: 5.2};

// Precise look pulse through the shipped key bindings. A CDP
// Input.dispatchKeyEvent hold is not duration-accurate in this headless
// environment: its transport lag varies by >100 ms per edge, so a requested
// 150 ms pulse can turn the view by 0.54 rad instead of 0.21 rad and alternate
// above/below a moving target. The raid input handler only needs keydown/keyup
// events, so the pulse is dispatched in-page and released by an exact
// setTimeout; the client's own per-frame look integration therefore receives
// the duration the probe requested, and the 150 ms authoritative sync ships
// that exact local look to the server.
async function lookPulse(code, ms) {
  await page.evaluate(`(() => new Promise(resolve => {
    const target = document.getElementById('view') || document.activeElement || document.body;
    const send = type => target.dispatchEvent(new KeyboardEvent(type, {bubbles: true, cancelable: true, code: ${JSON.stringify(code)}, key: ${JSON.stringify(code)}}));
    send('keydown');
    setTimeout(() => { send('keyup'); resolve(true); }, ${Math.max(1, Math.round(ms))});
  }))()`);
}

// Closed-loop look convergence: one pulse covers the authoritative remainder
// (or as much of the axis budget as is left) and is released exactly by the
// in-page timer, then the probe waits for the client's next move packets so
// the snapshot reflects the held view before checking the residual again.
// Capping every pulse at 120 ms silently turned a 2 rad bearing correction into
// a chase that never converged inside the short close-range aiming window.
async function pulseLook(desired, axis, maxMs) {
  const rate = axis === 'yaw' ? 1.7 : 1.4;
  const until = Date.now() + maxMs;
  for (;;) {
    const snap = await state();
    if (!snap?.self?.alive || snap.self.downed) return;
    const actual = axis === 'yaw' ? (snap.self.yaw || 0) : (snap.self.pitch || 0);
    const difference = axis === 'yaw' ? wrapped(desired - actual) : desired - actual;
    if (Math.abs(difference) <= 0.02) return;
    const budget = until - Date.now();
    if (budget <= 40) return;
    const holdMs = Math.min(budget, Math.abs(difference) / rate * 1000);
    const code = axis === 'yaw' ? (difference > 0 ? 'ArrowLeft' : 'ArrowRight') : (difference > 0 ? 'ArrowUp' : 'ArrowDown');
    await lookPulse(code, Math.max(12, holdMs));
    // The client ships the held look in a 150 ms move packet. Waiting 300 ms
    // covers two ticks so the next snapshot is not a stale bearing.
    await sleep(300);
  }
}

// Native aim helper. The authority records the operator's submitted yaw/pitch,
// and terrain can raise either the operator or the machine, so the requested
// pitch targets the machine's body centre in world space, not a flat-ground
// approximation. Returns the residual alignment when the server accepted the
// look input.
async function aimAt(live, snap, yawMs = 2600, pitchMs = 1400) {
  const height = MACHINE_HEIGHT[live.kind] || 1.8;
  const dx = live.x - snap.self.x, dz = live.z - snap.self.z, horizontal = Math.hypot(dx, dz);
  const eyeY = (snap.self.y || 0) + 1.55;
  const desiredYaw = Math.atan2(dx, dz);
  const desiredPitch = Math.atan2((live.y || 0) + height * 0.5 - eyeY, Math.max(1, horizontal));
  await pulseLook(desiredYaw, 'yaw', yawMs);
  await pulseLook(desiredPitch, 'pitch', pitchMs);
  const aimed = await state();
  if (!aimed?.self?.alive || aimed.self.downed) return null;
  const yaw = aimed.self.yaw || 0, pitch = aimed.self.pitch || 0;
  return {
    desiredYaw, desiredPitch, yaw, pitch, horizontal, eyeY, machineY: live.y || 0,
    dy: Math.abs(wrapped(desiredYaw - yaw)), dp: Math.abs(desiredPitch - pitch)
  };
}

async function shootMachine(machine, maxRounds = 8) {
  const record = {target: machine.kind, startHp: machine.hp, distance: null, aim: null, misaligned: 0, shots: [], killed: false, killedBy: null};
  let lastToken = null;
  for (let round = 0; round < maxRounds; round++) {
    const snap = await state();
    if (!snap?.self?.alive || snap.self.downed) break;
    const live = (snap.machines || []).find(m => m.id === machine.id && m.hp > 0);
    if (!live) {
      // Snapshot machines are visibility-filtered: absence can mean killed or
      // merely out of sight. Only an authoritative salvage bag proves a kill.
      record.killed = (snap.bags || []).some(b => b.id === machine.id + '_salvage');
      record.killedBy = record.killed ? 'authoritative salvage bag' : 'left line of sight';
      evidence.combat.push(record);
      return record.killed;
    }
    const horizontal = Math.hypot(live.x - snap.self.x, live.z - snap.self.z);
    // Close machines manoeuvre quickly; shorten the aiming window so the shot
    // follows the bearing the player currently sees.
    const aim = await aimAt(live, snap, horizontal < 14 ? 2200 : 2600, horizontal < 14 ? 1200 : 1400);
    if (!aim) break;
    record.distance = Math.round(aim.horizontal);
    record.aim = {
      dy: Math.round(aim.dy * 1000) / 1000,
      dp: Math.round(aim.dp * 1000) / 1000,
      machineY: Math.round(aim.machineY * 1000) / 1000,
      operatorY: Math.round(((snap.self.y || 0)) * 1000) / 1000,
      desiredPitch: Math.round(aim.desiredPitch * 1000) / 1000,
      pitch: Math.round(aim.pitch * 1000) / 1000
    };
    // A player fires at the machine they see even while it manoeuvres. The
    // shipped fire packet carries the client's local aim, not the slower
    // authoritative snapshot, so only a badly mis-read bearing defers a shot.
    if (aim.dy > Math.PI / 2) { record.misaligned++; continue; }
    lastToken = snap.self.hit?.token ?? null;
    const hpBeforeShot = live.hp;
    await press('KeyF', 'f');
    await sleep(320);
    const afterSnap = await state();
    const hit = afterSnap?.self?.hit && afterSnap.self.hit.token !== lastToken ? afterSnap.self.hit : null;
    record.shots.push({hpBefore: hpBeforeShot, hpAfter: (afterSnap.machines || []).find(m => m.id === machine.id)?.hp ?? null, hit: hit ? {zone: hit.zone, kill: !!hit.kill, target: hit.target} : null});
    if (hit) { evidence.combatHits = (evidence.combatHits || 0) + 1; }
    if (hit?.kill || (afterSnap.bags || []).some(b => b.id === machine.id + '_salvage')) { record.killed = true; record.killedBy = hit?.kill ? 'operator hit token' : 'authoritative salvage bag'; evidence.combat.push(record); return true; }
    if (!afterSnap?.self?.alive || afterSnap.self.downed) break;
  }
  evidence.combat.push(record);
  return record.killed;
}

// Fight a machine that is already visible in an authoritative snapshot. The
// natural probe uses this before the supply walk as well as during the march:
// machines in sight of the operator are also in the snapshot, and waiting for
// the route leg lets a nearby patrol shoot first.
async function engageVisibleThreat(maxDistance) {
  const threat = await nearestThreat(maxDistance);
  if (!threat) return false;
  evidence.events.push('engaged ' + threat.kind + ' at ' + Math.round(threat.distance) + ' m');
  await shootMachine(threat, 6);
  return true;
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

  // Prefer a visible pile that actually carries a medical/material item: the
  // protected pocket is the acceptance's proof that raid loot can be secured
  // before combat, and ground piles are the only fixture-free source of it.
  const visiblePiles = (snap.loot || []).filter(l => l.items.length)
    .sort((a, b) => Math.hypot(a.x - snap.self.x, a.z - snap.self.z) - Math.hypot(b.x - snap.self.x, b.z - snap.self.z));
  const supplyFirst = visiblePiles.find(l => l.items.some(it => it.kind === 'med' || it.kind === 'material'));
  const firstLoot = supplyFirst || visiblePiles[0];
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
  snap = await state();
  const firstSecureable = (snap.self.pack || []).find(it => it.kind === 'med' || it.kind === 'material');
  if (firstSecureable) {
    await clickControl(firstSecureable.id, 'Secure');
    const secured = await countpacked(firstSecureable.id);
    evidence.secured = (secured.self.secure || []).map(it => ({id: it.id, kind: it.kind, label: it.label || it.medical || it.material}));
    evidence.events.push('secured ' + JSON.stringify(evidence.secured));
  }
  // The insertion pile is the first natural contact point: fight any machine
  // already in sight before moving on, rather than waiting for the route march.
  await engageVisibleThreat(30);

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
  if (!evidence.secured.length && supplyLoot) {
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
    if (snap?.self?.alive && !snap.self.downed && !snap.self.result) await engageVisibleThreat(26);
  }

  // Close the backpack with its shipped key before travelling. Leaving it open
  // would hide the field view and is not what a player does when moving to the
  // beacon; the native control also proves the panel toggle still works.
  await press('KeyB', 'b');
  await waitFor(() => page.evaluate("document.getElementById('pack').hidden"), 4000).catch(() => { throw new Error('the backpack did not close with the shipped B key'); });
  evidence.packClosed = await page.evaluate("document.getElementById('pack').hidden");

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
    const s2 = await walkTo(routePoints[i].x, routePoints[i].z, {sprint: true, timeout: 60000, arrive: 3.5});
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
  assert.ok((settled.facts?.pelletsHit || 0) > 0, 'the operator landed an authoritative hit against a machine');
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
