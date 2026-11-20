// Isolated Chrome grader for backpack drag reorder, hand-off trade and
// double-click equip. Two real browser contexts enter one authoritative raid,
// then the export path is exercised through pointer drag and button controls
// while the recipient's received gear is inspected and equipped.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = () => Date.now().toString(36).slice(-6);

async function register(page) {
  const name = 'invui_' + short();
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long inventory password';document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  return name;
}
async function signIn(page, name) {
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long inventory password';document.getElementById('login').requestSubmit()`);
  await page.wait("document.body.getAttribute('aria-busy')==='false' && (!document.getElementById('base').hidden||document.getElementById('play').style.display==='block')");
}
async function deploy(page) {
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('pack').hidden===false");
}
function drag(page, sourceId, targetSelector) {
  return page.evaluate(`(() => {
    const row = document.querySelector('#pack [data-item-id="${sourceId}"][data-reorder=pack]');
    const target = document.querySelector(${JSON.stringify(targetSelector)});
    if (!row) throw new Error('backpack row unavailable: ${sourceId}');
    if (!target) throw new Error('drop target unavailable: ' + ${JSON.stringify(targetSelector)});
    // Keep the real pack scrollport so hand-off targets below the fold are
    // reachable exactly as they are for a player with a full backpack.
    document.getElementById('pack').style.maxHeight = 'calc(100dvh - 260px)';
    row.scrollIntoView({block: 'nearest'});
    target.scrollIntoView({block: 'nearest'});
    const a = row.getBoundingClientRect(), b = target.getBoundingClientRect();
    const sx = a.left + 18, sy = a.top + 12, tx = b.left + Math.min(40, b.width / 2), ty = b.bottom - 4;
    row.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, pointerId: 21, clientX: sx, clientY: sy, button: 0, buttons: 1}));
    row.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, cancelable: true, pointerId: 21, clientX: tx, clientY: ty, button: 0, buttons: 1}));
    row.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, cancelable: true, pointerId: 21, clientX: tx, clientY: ty, button: 0, buttons: 0}));
    return {hit: document.elementFromPoint(tx, ty)?.className || '', source: [a.left, a.top, a.width, a.height], target: [b.left, b.top, b.width, b.height]};
  })()`);
}
async function clickRowButton(page, itemId, text) {
  return page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('#pack [data-item-id="${itemId}"]')];
    const row = rows.find((r) => r.dataset.reorder === 'pack') || rows[0];
    if (!row) throw new Error('backpack row unavailable: ${itemId}');
    const button = [...row.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(text)});
    if (!button) throw new Error('control unavailable: ' + ${JSON.stringify(text)});
    if (button.disabled) throw new Error('control disabled: ' + button.title);
    button.focus();
    button.click();
  })()`);
}

let exporterPage, recipientPage;
try {
  exporterPage = await h.page();
  await exporterPage.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  const exporterName = await register(exporterPage);
  const exporterId = (await exporterPage.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  await deploy(exporterPage);

  // A second real account joins the exporter's raid and signs in through the
  // normal resume path; both operators are then put on one squad server-side.
  const recipientName = 'invrcv_' + short();
  const recipientId = store.register(recipientName, 'a long inventory password').id;
  runtime.raids.deploy(recipientId, {mapId: 'relay', requestId: 'inventory_recipient_deploy', recovery: true});
  recipientPage = await h.page();
  await recipientPage.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  await signIn(recipientPage, recipientName);
  await recipientPage.wait("!document.getElementById('resume').hidden");
  await recipientPage.evaluate("document.getElementById('resume').click()");
  await recipientPage.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  const exporter = runtime.raids.byAccount.get(exporterId), recipient = runtime.raids.byAccount.get(recipientId);
  assert.ok(exporter && recipient, 'both operators are deployed');
  assert.equal(exporter.raidId, recipient.raidId, 'the recipient landed in the exporter raid');
  const raid = runtime.raids.raids.get(exporter.raidId);
  raid.machines = [];
  raid.rivals = [];
  raid.caches = [];
  raid.bags = [];
  raid.floorLoot = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: []};
  for (const p of [exporter, recipient]) Object.assign(p, {team: 'inventory-squad', x: 0, y: 0, z: 0, protectedUntil: 0, move: {x: 0, z: 0}, hp: 100, alive: true, downed: false});
  exporter.pack.splice(0, exporter.pack.length);
  const material = {id: randomUUID(), kind: 'material', material: 'steel', quantity: 2, condition: 100, rarity: 1, label: 'Steel'};
  const tradeWeapon = {id: randomUUID(), kind: 'weapon', weapon: 'smg', quantity: 1, condition: 100, loaded: 20, rarity: 2, label: 'SMG'};
  const equipWeapon = {id: randomUUID(), kind: 'weapon', weapon: 'pistol', quantity: 1, condition: 100, loaded: 8, rarity: 2, label: 'Pistol'};
  exporter.pack.push(material, tradeWeapon, equipWeapon);

  // Live snapshots expose both operators as squadmates and render the trade
  // destinations in each backpack.
  await exporterPage.wait(`!!document.querySelector('#pack [data-target-id="${recipientId}"]') && !!document.querySelector('#pack [data-item-id="${material.id}"][data-reorder=pack]')`);
  await recipientPage.wait(`!!document.querySelector('#pack [data-target-id="${exporterId}"]')`);
  const initialOrder = await exporterPage.evaluate("[...document.querySelectorAll('#pack [data-reorder=pack]')].map((row) => row.dataset.itemId)");
  assert.deepEqual(initialOrder, [material.id, tradeWeapon.id, equipWeapon.id], 'backpack starts in authoritative order');

  // Drag the material below the trade weapon. Ordering is presentation-only
  // but must persist to localStorage and survive the next snapshot render.
  await drag(exporterPage, material.id, `#pack [data-item-id="${tradeWeapon.id}"][data-reorder=pack]`);
  await exporterPage.wait(`[...document.querySelectorAll('#pack [data-reorder=pack]')].map((row) => row.dataset.itemId).join(',') === ${JSON.stringify([tradeWeapon.id, material.id, equipWeapon.id].join(','))}`);
  assert.deepEqual(JSON.parse(await exporterPage.evaluate("localStorage.getItem('headshotz:backpack-order')")), [tradeWeapon.id, material.id, equipWeapon.id], 'the dragged order persists locally');
  assert.ok((await exporterPage.evaluate("document.getElementById('statusAnnouncement').textContent")).includes('Backpack order changed'), 'the reorder is announced for assistive clients');

  // The presentation-only order is not a fabricated server item: the pack and
  // weight meters are untouched by the drag.
  const afterReorder = await exporterPage.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>s.self.pack.map(x=>x.id))");
  assert.deepEqual(afterReorder, [material.id, tradeWeapon.id, equipWeapon.id], 'server pack order is unchanged by the local reorder');

  // Double-clicking a weapon equips it through the existing authoritative action.
  await exporterPage.evaluate(`(() => { const row = document.querySelector('#pack [data-item-id="${equipWeapon.id}"][data-reorder=pack]'); row.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true})); })()`);
  await exporterPage.wait(`fetch('/api/raid').then(r=>r.json()).then(s=>s.self.weaponId===${JSON.stringify(equipWeapon.id)})`);
  assert.equal(exporter.weaponId, equipWeapon.id, 'double-click equips the pump pistol through the server');

  // Drag the trade weapon onto the recipient's squad hand-off zone.
  await drag(exporterPage, tradeWeapon.id, `#pack [data-target-id="${recipientId}"]`);
  await exporterPage.wait(`!document.querySelector('#pack [data-item-id="${tradeWeapon.id}"][data-reorder=pack]')`);
  await recipientPage.wait(`(() => { const rows = [...document.querySelectorAll('#pack [data-item-id="${tradeWeapon.id}"]')]; return rows.some((row) => [...row.querySelectorAll('button')].some((b) => b.textContent === 'Equip')); })()`);
  assert.equal(recipient.pack.filter((it) => it.id === tradeWeapon.id).length, 1, 'the recipient owns exactly one traded weapon');
  assert.equal(exporter.pack.some((it) => it.id === tradeWeapon.id), false, 'the exporter handed the weapon away');
  assert.ok((await exporterPage.evaluate("document.getElementById('statusAnnouncement').textContent")).includes('Handing off'), 'the hand-off is announced');

  // Button/label parity: the row Give control performs the same server
  // transaction without a pointer drag.
  const giveLabel = await exporterPage.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${material.id}"] button')].find((b) => b.textContent === ${JSON.stringify('Give to ' + recipientName)})?.textContent ?? null`);
  assert.equal(giveLabel, 'Give to ' + recipientName, 'each pack row exposes an accessible Give control');
  await clickRowButton(exporterPage, material.id, 'Give to ' + recipientName);
  await recipientPage.wait(`!!document.querySelector('#pack [data-item-id="${material.id}"]')`);
  assert.equal(recipient.pack.filter((it) => it.id === material.id).length, 1, 'the Give control transfers the matching item once');
  assert.equal(exporter.pack.some((it) => it.id === material.id), false, 'the Give control removes the item from the sender');

  // The recipient can equip the received weapon in the same raid, proving the
  // transferred item is valid authoritative inventory for later rounds.
  await clickRowButton(recipientPage, tradeWeapon.id, 'Equip');
  await recipientPage.wait(`fetch('/api/raid').then(r=>r.json()).then(s=>s.self.weaponId===${JSON.stringify(tradeWeapon.id)})`);
  assert.equal(recipient.weaponId, tradeWeapon.id, 'the recipient equips the received weapon');
  assert.equal(store.db.prepare('SELECT account FROM inventory WHERE id=?').get(tradeWeapon.id).account, recipientId, 'ownership is checkpointed to the recipient');
  assert.equal(store.db.prepare('SELECT account FROM inventory WHERE id=?').get(material.id).account, recipientId, 'stack ownership follows the recipient');

  assert.deepEqual(exporterPage.errors, [], 'exporter context has no browser errors');
  assert.deepEqual(recipientPage.errors, [], 'recipient context has no browser errors');
  console.log(JSON.stringify({
    dragReorder: true,
    persistedOrder: [tradeWeapon.id, material.id, equipWeapon.id],
    serverPackUnfabricated: true,
    doubleClickEquip: true,
    dragTrade: true,
    buttonTrade: true,
    recipientEquip: true,
    ownershipCheckpoint: true,
    browserErrors: [],
    scope: 'Two isolated Chrome contexts through the real raid UI; server pack item identity and ownership are authoritative.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    exporterErrors: exporterPage?.errors,
    recipientErrors: recipientPage?.errors,
    pack: await exporterPage?.evaluate("document.getElementById('pack').textContent").catch(() => null),
    recipientPack: await recipientPage?.evaluate("document.getElementById('pack').textContent").catch(() => null),
    recipientLive: await recipientPage?.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>JSON.stringify({pack:s.self.pack.map(x=>x.id),hint:document.getElementById('hint').textContent,status:document.getElementById('statusAnnouncement').textContent,interaction:document.getElementById('interactionStatus').textContent}))").catch(() => null),
    exporterLive: await exporterPage?.evaluate("fetch('/api/raid').then(r=>r.json()).then(s=>JSON.stringify({pack:s.self.pack.map(x=>x.id),hint:document.getElementById('hint').textContent,status:document.getElementById('statusAnnouncement').textContent}))").catch(() => null)
  }));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
