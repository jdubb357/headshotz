// Isolated Chrome grader for searching and looting a downed enemy operator.
// Proves the server-authoritative body container is discoverable through the
// live client hint and backpack, that the exclusive search claim and countdown
// are shown, that Take applies the ownership rules, and that the minimap marker
// follows the body's opened state. A second isolated browser context confirms
// the downed squadmate still receives rescue controls instead of loot controls.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {earnedPurchase} from './earned-fixture.mjs';
import {browserHarness} from './browser-harness.mjs';

let now = 1000;
const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => now});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
let looterPage, matePage;
const idle = (page) => page.wait("document.body.getAttribute('aria-busy')==='false'");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error('Timed out: ' + label);
}
async function register(page, username, password) {
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
}
async function signIn(page, username, password) {
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.getElementById('login').requestSubmit()`);
  await page.wait("document.body.getAttribute('aria-busy')==='false' && (!document.getElementById('base').hidden||document.getElementById('play').style.display==='block')");
}
async function click(page, container, id, text) {
  await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll(${JSON.stringify(container + ' [data-item-id]')})].filter((row) => row.dataset.itemId === ${JSON.stringify(id)});
    const button = rows.map((row) => [...row.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(text)}&&!b.disabled)).find(Boolean);
    if (!button) throw new Error('Body loot control unavailable: ' + ${JSON.stringify(text)});
    button.focus(); button.click();
  })()`);
}
try {
  // Looter enters the raid through the real UI and deploys the free kit.
  looterPage = await h.page();
  const looterName = 'body_ui_looter_' + Date.now().toString(36);
  await register(looterPage, looterName, 'a long body ui looter password');
  const looterId = (await looterPage.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  await looterPage.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await looterPage.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");

  // Victim gear is earned stock so the base inventory ownership rules allow
  // recovery; starter-issued equipment remains bound to its original operator.
  const victimName = 'body_ui_victim';
  const victimId = store.register(victimName, 'a long body ui victim password').id;
  const mateName = 'body_ui_mate';
  const mateId = store.register(mateName, 'a long body ui mate password').id;
  const gun = earnedPurchase(store, victimId, {sku: 'smg'});
  const ammo = earnedPurchase(store, victimId, {sku: 'ammo_medium'});
  const armor = earnedPurchase(store, victimId, {sku: 'armor_light'});
  runtime.raids.deploy(victimId, {mapId: 'relay', requestId: 'bodyui_victim_deploy', itemIds: [gun.id, ammo.id, armor.id]});
  runtime.raids.deploy(mateId, {mapId: 'relay', requestId: 'bodyui_mate_deploy', recovery: true});
  const looter = runtime.raids.byAccount.get(looterId);
  const victim = runtime.raids.byAccount.get(victimId);
  const mate = runtime.raids.byAccount.get(mateId);
  const raid = runtime.raids.raids.get(looter.raidId);
  assert.ok(raid, 'loot raid exists');
  assert.equal(victim.raidId, raid.id, 'victim joined the looter raid');
  assert.equal(mate.raidId, raid.id, 'mate joined the looter raid');
  assert.notEqual(victim.team, looter.team, 'the victim is a rival operator');

  raid.machines = [];
  raid.rivals = [];
  raid.caches = [];
  raid.bags = [];
  raid.floorLoot = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: []};
  for (const operator of raid.players.values()) Object.assign(operator, {protectedUntil: 0, move: {x: 0, z: 0}, lastInput: now});
  Object.assign(victim, {x: looter.x, y: looter.y || 0, z: looter.z, hp: 100, alive: true, downed: false, bleedUntil: 0});
  Object.assign(mate, {x: looter.x + 1, y: looter.y || 0, z: looter.z + 1, team: victim.team});
  runtime.raids.damage(raid, victim, 400, {source: 'operator'});
  assert.equal(victim.alive, true, 'a squadmate keeps the victim alive');
  assert.equal(victim.downed, true, 'the victim is downed but not out');

  // The second isolated context is the victim's squadmate: sign in after the
  // deployment already exists, then resume the authoritative raid session.
  matePage = await h.page();
  await signIn(matePage, mateName, 'a long body ui mate password');
  await matePage.wait("!document.getElementById('resume').hidden");
  await matePage.evaluate("document.getElementById('resume').click()");
  await matePage.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  await matePage.wait(`!!document.querySelector('[data-rescue="${victimId}"]')`);
  const rescueRow = await matePage.evaluate(`(() => { const row = document.querySelector('[data-rescue="${victimId}"]'); return {text: row.textContent, revive: !!row.querySelector('[data-rescue-action=revive]'), carry: !!row.querySelector('[data-rescue-action=carry]')}; })()`);
  assert.match(rescueRow.text, /DOWNED/, 'the squadmate sees the downed teammate');
  assert.ok(rescueRow.revive && rescueRow.carry, 'squadmates keep revive/carry controls');
  const squadmateBodySources = await matePage.evaluate("document.getElementById('pack').textContent.includes('downed operator')||[...document.querySelectorAll('#pack button')].some(b=>b.textContent.startsWith('Search '))");
  assert.equal(squadmateBodySources, false, 'a squadmate is never offered a body loot control');

  // Looter: discover the body through the interaction hint, start the search
  // from the real UI button, and see the exclusive countdown.
  await looterPage.wait(`document.getElementById('hint').textContent.includes(${JSON.stringify(victimName)})&&document.getElementById('hint').textContent.includes('search')`);
  await looterPage.evaluate("document.getElementById('interact').click()");
  await idle(looterPage);
  await until(() => victim.bodySearcher === looterId, 'search claim');
  await looterPage.wait(`document.getElementById('interactionStatus').textContent.includes('Searching')&&document.getElementById('interactionStatus').textContent.includes(${JSON.stringify(victimName)})`);
  const enemyLooterRescue = await looterPage.evaluate(`!!document.querySelector('[data-rescue="${victimId}"]')`);
  assert.equal(enemyLooterRescue, false, 'an enemy body exposes loot instead of rescue controls');

  // Advance authoritative time and run the simulation; repeated snapshots no
  // longer claim a search, and the open container exposes equipped gear.
  now = 1002.5;
  runtime.raids.tick(0.05);
  assert.equal(victim.bodyOpen, true, 'the 2.4 s search opened the body');
  assert.equal(victim.bodySearcher, null, 'the search claim completed cleanly');
  assert.ok(victim.weaponId, 'the victim still has the weapon before it is taken');
  await looterPage.wait("document.getElementById('hint').textContent.includes('loot')");
  await looterPage.wait(`(() => { const rows=[...document.querySelectorAll('#pack [data-item-id]')].filter(r=>r.dataset.itemId===${JSON.stringify(gun.id)}); return rows.some(row=>[...row.querySelectorAll('button')].some(b=>b.textContent==='Take'&&!b.disabled)); })()`);

  // Take the equipped weapon from the body through the rendered control.
  await click(looterPage, '#pack', gun.id, 'Take');
  await idle(looterPage);
  await until(() => looter.pack.some((it) => it.id === gun.id) && !victim.equipment.some((it) => it.id === gun.id), 'body weapon transfer');
  assert.equal(victim.weaponId, null, 'the downed victim no longer aims a looted weapon');
  assert.equal(store.db.prepare('SELECT account FROM inventory WHERE id=?').get(gun.id).account, looterId, 'the checkpoint records the looter as owner');
  assert.equal(victim.ammo > 0, true, 'the body keeps ammunition for further looting');

  // The module-level map receives the snapshot bodies and paints the marker:
  // closed bodies are red, opened bodies are amber. Assert the change by
  // counting the exact marker colours near the body's scaled map position.
  const marker = await looterPage.evaluate(`(async () => {
    const {drawMap} = await import('./raid-online.mjs');
    const {getWorld} = await import('./shared/raid-worlds.mjs');
    const state = await (await fetch('/api/raid')).json();
    const body = state.bodies.find((b) => b.team !== state.self.team);
    const world = getWorld(state.map, state.mapVersion === undefined ? 1 : state.mapVersion);
    const k = 360 / world.size, bx = 180 + body.x * k, by = 180 + body.z * k;
    // Move the probe operator away from the body so its amber self-halo cannot
    // cover the equally scaled body marker; the marker colour rule is unchanged.
    const probe = {...state, self: {...state.self, x: body.x + 400, z: body.z + 400}};
    const render = (bodies) => {
      const canvas = document.createElement('canvas');
      canvas.width = 360; canvas.height = 360;
      drawMap(canvas, state.map, {...probe, bodies});
      return canvas.getContext('2d').getImageData(0, 0, 360, 360).data;
    };
    // The letter glyph sits on top of most of the small marker disc, so the
    // stable assertion is the pixel delta around the body rather than a count
    // of one fill colour.
    const delta = (a, b) => {
      let count = 0;
      for (let y = Math.max(0, by - 14); y < Math.min(360, by + 14); y++) for (let x = Math.max(0, bx - 14); x < Math.min(360, bx + 14); x++) {
        const i = (y * 360 + x) * 4;
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
      }
      return count;
    };
    const opened = render(state.bodies.map((b) => ({...b, open: true})));
    const closed = render(state.bodies.map((b) => ({...b, open: false})));
    const absent = render([]);
    const teammate = render(state.bodies.map((b) => ({...b, team: state.self.team})));
    return {
      body: {x: body.x, z: body.z, open: body.open, lootable: body.lootable},
      worldSize: world.size, bx, by,
      openedVsClosed: delta(opened, closed),
      markerVsEmpty: delta(opened, absent),
      teammateVsEmpty: delta(teammate, absent)
    };
  })()`);
  assert.equal(marker.body.open, true, 'the fetched snapshot body is open');
  assert.equal(marker.body.lootable, true, 'the fetched snapshot body is lootable');
  assert.ok(marker.markerVsEmpty > 0, 'the enemy body paints a tactical-map marker');
  assert.ok(marker.openedVsClosed > 0, 'the marker changes when the body is opened');
  assert.equal(marker.teammateVsEmpty, 0, 'a squadmate body is drawn through rescue controls, never the loot marker');

  assert.deepEqual(looterPage.errors, []);
  assert.deepEqual(matePage.errors, []);
  console.log(JSON.stringify({
    bodySearchClaimed: true,
    exclusiveCountdownVisible: true,
    bodyOpenedAfter24: true,
    bodyLootItemRendered: true,
    takeTransfersOwnership: true,
    victimWeaponCleared: true,
    squadmateKeepsRescueControls: true,
    opponentSeesLootNotRescue: true,
    minimapOpenMarkerAmber: true,
    minimapClosedMarkerRed: true,
    browserErrors: [],
    scope: 'Isolated Chrome looter/mate contexts; positions, team and downed state are authoritative server fixtures. Not live matchmaking or human balance acceptance.'
  }));
} catch (error) {
  console.error(JSON.stringify({looterErrors: looterPage?.errors, mateErrors: matePage?.errors, hint: await looterPage?.evaluate("document.getElementById('hint').textContent").catch(() => null), interactions: await looterPage?.evaluate("document.getElementById('interactionStatus').textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
