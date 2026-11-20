// Isolated Chrome grader for field salvage appraisal: backpack and nearby-loot
// rows show the shared carry weight and base sale value, the header totals the
// salvage carried, and container rows warn before a take exceeds capacity.
// Fixtures are injected into one authoritative raid and every read comes from
// the live snapshot; the Take and Secure goods are real server actions.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {itemWeight} from '../shared/raid-catalog.mjs';
import {sellValue} from '../shared/raid-appraisal.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const short = () => Date.now().toString(36).slice(-6);
const round = n => Math.round(n * 10) / 10;

function loot(kind, extra) {
  return {id: randomUUID(), kind, condition: 100, quantity: 1, rarity: 2, ...extra};
}

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false});
  const name = 'appraisal_' + short();
  await page.wait(`document.getElementById('message')?.textContent.includes('Sign in')`);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value='a long appraisal password';document.getElementById('register').click()`);
  await page.wait(`!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'`);
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait(`document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false' && document.getElementById('pack').hidden===false`);
  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  assert.ok(operator, 'the UI account deployed into a raid');
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(raid, 'the authoritative raid is inspectable');

  // Deterministic field: one exposed cache at arm's reach, no distractions.
  raid.machines = [];
  raid.rivals = [];
  raid.bags = [];
  raid.floorLoot = [];
  raid.caches = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: [], doors: []};
  Object.assign(operator, {x: 0, y: 0, z: 0, hp: 100, alive: true, downed: false, protectedUntil: 0, move: {x: 0, z: 0}});
  operator.pack = [];
  operator.secure = [];
  operator.equipment = [];
  operator.cap = 8;
  operator.weightCap = 40;
  operator.weaponId = null;

  const valuable = loot('valuable', {value: 17, label: 'Purifier cartridge'});
  const cacheId = randomUUID();
  raid.caches = [{id: cacheId, x: 1.2, y: 0, z: 0, open: true, label: 'Salvage cache', items: [valuable, loot('material', {material: 'steel', quantity: 4, label: 'Steel stock'})]}];
  await page.wait(`!!document.querySelector('#pack [data-item-id="${valuable.id}"] .itemAppraisal .metaWeight')`);

  const readRow = (id) => page.evaluate(`(() => {
    const row = document.querySelector('#pack [data-item-id="${id}"]');
    return {
      chips: [...row.querySelectorAll('.itemAppraisal .metaChip')].map(c => [c.className, c.textContent]),
      label: row.getAttribute('aria-label'),
      weight: row.dataset.weight,
      value: row.dataset.sellValue,
      warn: row.querySelector('.itemWarn')?.textContent ?? null
    };
  })()`);

  // Acceptance 2: both rows publish the same numbers the shared economy uses,
  // visibly and in the accessible name, with no client-invented price.
  const valueRow = await readRow(valuable.id);
  assert.equal(valueRow.weight, String(round(itemWeight(valuable))), 'valuable row publishes authoritative weight');
  assert.equal(valueRow.value, String(sellValue(valuable)), 'valuable row publishes authoritative sale value');
  assert.deepEqual(valueRow.chips, [['metaChip metaWeight', '1 kg'], ['metaChip metaValue', '17 cr']], 'valuable row shows weight and value chips');
  assert.ok(valueRow.label.includes('1 kilograms, 17 credits base sale'), 'valuable row accessible name includes weight and value: ' + valueRow.label);
  assert.equal(valueRow.warn, null, 'no warning while the cache fits the pack');
  const steel = raid.caches[0].items[1], steelRowRead = await readRow(steel.id);
  assert.equal(steelRowRead.weight, String(round(itemWeight(steel))), 'steel row publishes authoritative weight');
  assert.equal(steelRowRead.value, String(sellValue(steel)), 'steel row publishes authoritative sale value');
  assert.ok(steelRowRead.chips.some(([, text]) => text === '8 cr'), 'steel stack shows its stack sale value');

  // Acceptance 3: the header starts at zero salvage and totals the pack and
  // protected pocket from the authoritative snapshot.
  await page.wait("document.querySelector('#pack .packHead strong')?.textContent.includes('salvage 0 cr')");
  await page.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${valuable.id}"] button')].find(b => b.textContent==='Take').click()`);
  await page.wait(`document.querySelector('#pack [data-item-id="${valuable.id}"][data-reorder=pack]') && document.querySelector('#pack .packHead strong').textContent.includes('salvage ${sellValue(valuable)} cr')`);
  assert.ok(operator.pack.some(it => it.id === valuable.id), 'Take moved the valuable through the server');
  assert.equal(operator.pack.length, 1, 'one authoritative pack item after Take');

  await page.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${valuable.id}"] button')].find(b => b.textContent==='Secure').click()`);
  await page.wait(`document.querySelector('#pack [data-item-id="${valuable.id}"]') && document.querySelector('#pack .packHead strong').textContent.includes('protected 1/1') && document.querySelector('#pack .packHead strong').textContent.includes('salvage ${sellValue(valuable)} cr')`);
  assert.equal(operator.secure.filter(it => it.id === valuable.id).length, 1, 'Secure moved the valuable into the protected pocket');
  assert.equal(operator.pack.length, 0, 'the secured item is no longer in the pack');

  // Unsecure and Drop both refresh the carried total from the live snapshot.
  await page.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${valuable.id}"] button')].find(b => b.textContent==='Move to backpack').click()`);
  await page.wait(`document.querySelector('#pack [data-item-id="${valuable.id}"][data-reorder=pack]') && document.querySelector('#pack .packHead strong').textContent.includes('salvage ${sellValue(valuable)} cr')`);
  await page.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${valuable.id}"][data-reorder=pack] button')].find(b => b.textContent==='Drop').click()`);
  await page.wait(`!document.querySelector('#pack [data-item-id="${valuable.id}"][data-reorder=pack]') && document.querySelector('#pack .packHead strong').textContent.includes('salvage 0 cr')`);
  assert.equal(operator.pack.length, 0, 'Drop emptied the pack through the server');

  // Acceptance 4: a real overweight take would be rejected server-side, so the
  // container row states the shortfall before the button is pressed.
  operator.secure = [];
  operator.pack = [];
  operator.cap = 8;
  operator.weightCap = 0.5;
  const ammo = loot('ammo', {quantity: 40, label: 'Light ammunition'});
  raid.caches = [{id: randomUUID(), x: 1.2, y: 0, z: 0, open: true, label: 'Salvage cache', items: [ammo]}];
  await page.wait(`!!document.querySelector('#pack [data-item-id="${ammo.id}"] .itemWarn')`);
  const overweight = await readRow(ammo.id);
  assert.equal(overweight.warn, 'Over weight by ' + round(itemWeight(ammo) - operator.weightCap) + ' kg', 'overweight container row states the shortfall');
  assert.ok(overweight.label.includes(overweight.warn), 'overweight warning reaches the accessible name');
  const overweightShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-appraisal-overweight.png', Buffer.from(overweightShot.data, 'base64'));

  // A full backpack is reported before the quantity choice even opens.
  const heavy = loot('valuable', {value: 9, label: 'Signal regulator'});
  operator.cap = 1;
  operator.weightCap = 40;
  operator.pack = [loot('valuable', {value: 9, label: 'Phase capacitor'})];
  raid.caches = [{id: randomUUID(), x: 1.2, y: 0, z: 0, open: true, label: 'Salvage cache', items: [heavy]}];
  await page.wait(`!!document.querySelector('#pack [data-item-id="${heavy.id}"] .itemWarn')`);
  const full = await readRow(heavy.id);
  assert.equal(full.warn, 'Backpack full', 'full backpack warning is visible');
  assert.ok(full.label.includes('Backpack full'), 'full warning reaches the accessible name');
  const takeButtonDisabled = await page.evaluate(`[...document.querySelectorAll('#pack [data-item-id="${heavy.id}"] button')].find(b => b.textContent==='Take').disabled`);
  assert.equal(takeButtonDisabled, false, 'controls stay usable; partial take and hand-off remain choices');

  // The full pool of appraisal rows is exposed in a real screenshot for visual
  // review alongside the assertions above.
  await page.evaluate("document.getElementById('pack').style.maxHeight='none'");
  const shot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-appraisal.png', Buffer.from(shot.data, 'base64'));

  assert.deepEqual(page.errors, [], 'appraisal context has no browser errors');
  console.log(JSON.stringify({
    chips: {valuable: valueRow.chips, steel: steelRowRead.chips},
    ariaLabels: {valuable: valueRow.label, overweight: overweight.label, full: full.label},
    takeToPack: 1,
    secureToPocket: 1,
    unsecureToPack: true,
    dropEmptied: true,
    headerSalvage: sellValue(valuable),
    warnings: [overweight.warn, full.warn],
    controlsUsable: true,
    screenshot: '/tmp/raid-appraisal.png',
    browserErrors: [],
    scope: 'One isolated Chrome context; one real deployment; Take and Secure through the real UI; capacity rows are injected fixtures.'
  }));
} catch (error) {
  console.error(JSON.stringify({errors: page?.errors, pack: await page?.evaluate("document.getElementById('pack').textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
