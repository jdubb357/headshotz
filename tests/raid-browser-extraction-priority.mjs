// Isolated Chrome grader for extraction interaction priority. A real deployment and
// real native E presses drive the shared client. The open exit and the salvage bags are
// clearly labeled runtime fixtures so the two ordering cases are reachable without
// waiting a scheduled 35-second arrival or farming a machine. With an open exit inside
// reach, the single interact key must choose the exit even when salvage is nearer; with
// no open window, the nearer salvage must still win.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {writeFileSync} from 'node:fs';
import {RaidStore,item} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store);
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();

const pressE = async page => {
  await page.command('Input.dispatchKeyEvent', {type: 'keyDown', code: 'KeyE', key: 'e'});
  await page.command('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyE', key: 'e'});
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitUntil = async (test, label, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await test()) return;
    await sleep(50);
  }
  throw new Error('Timed out waiting for ' + label);
};

let page;
try {
  page = await h.page();
  await page.command('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify('priority_' + Date.now().toString(36).slice(-6))};document.querySelector('[name=password]').value='a long priority browser password';document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  await page.evaluate("document.getElementById('recovery').checked=true;document.body.setAttribute('aria-busy','true');document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  const accountId = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(accountId);
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(operator && raid, 'the UI account deployed into an inspectable raid');
  // Fixtures: quiet world for the ordering checks. Only machines, rivals, ground loot
  // and bags are cleared; the authored exits and rock cover stay as deployed.
  raid.machines = []; raid.rivals = []; raid.floorLoot = []; raid.bags = [];
  const call = raid.exits.find(e => e.id === 'call');
  const hatch = raid.exits.find(e => e.id === 'hatch');
  assert.ok(call && hatch, 'the deployed relay raid has call and hatch exits');

  // Case 1 (preserved behaviour): the hatch has no open window. A salvage bag 1.2 m
  // from the operator beats the 2 m exit in ordinary distance ordering, and E takes
  // the recoverable weapon from it instead of trying to board.
  const hatchWeapon = item('weapon', {weapon: 'smg', condition: 100, loaded: 12});
  raid.bags.push({id: 'fixture_priority_hatch_bag', x: hatch.x + 0.8, y: hatch.y || 0, z: hatch.z, kind: 'machine', label: 'Salvage machine', items: [hatchWeapon]});
  Object.assign(operator, {x: hatch.x + 2.0, y: hatch.y || 0, z: hatch.z, hp: 100, alive: true, downed: false, protectedUntil: runtime.raids.now() + 3600, move: {x: 0, z: 0}, board: null});
  await page.wait("document.getElementById('hint').textContent.includes('salvage machine · 1 item')");
  await pressE(page);
  await waitUntil(() => operator.pack.some(it => it.id === hatchWeapon.id), 'the nearer bag weapon to be taken');
  const hatchLooted = operator.pack.some(it => it.id === hatchWeapon.id);
  assert.ok(hatchLooted, 'the nearer bag weapon entered the backpack');
  assert.ok(!operator.board, 'a closed exit cannot hijack the loot press');
  assert.equal(operator.pack.filter(it => it.id === hatchWeapon.id).length, 1, 'exactly one bag weapon entered the backpack');
  const lootShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-extraction-priority-loot.png', Buffer.from(lootShot.data, 'base64'));

  // Case 2 (new rule): the transport beacon is open, and a fresh salvage bag is nearer
  // than the exit. The single interact key must open the boarding window on call, not
  // salvage. The exit fixture only moves its countdown; the server's boarding rules are
  // unchanged and still decide seat, reach and wave validity.
  const bagWeapon = item('weapon', {weapon: 'smg', condition: 100, loaded: 12});
  raid.bags.push({id: 'fixture_priority_call_bag', x: call.x + 1.0, y: call.y || 0, z: call.z, kind: 'machine', label: 'Salvage machine', items: [bagWeapon]});
  Object.assign(operator, {x: call.x + 2.6, y: call.y || 0, z: call.z, hp: 100, alive: true, downed: false, protectedUntil: runtime.raids.now() + 3600, move: {x: 0, z: 0}, board: null});
  Object.assign(call, {openAt: runtime.raids.now() - 1, closeAt: runtime.raids.now() + 120, usedSeats: 0, activations: 1, wave: 1});
  await page.wait("document.getElementById('hint').textContent.includes('call exit · OPEN')");
  const exitShot = await page.command('Page.captureScreenshot', {format: 'png'});
  writeFileSync('/tmp/raid-extraction-priority-open.png', Buffer.from(exitShot.data, 'base64'));
  await pressE(page);
  await page.wait("document.getElementById('interactionStatus').textContent.includes('Boarding')");
  assert.equal(operator.board?.exit, call.id, 'E started authoritative boarding on the exit');
  await page.wait("document.getElementById('hint').textContent.includes('EXTRACT')");
  assert.ok(operator.result?.outcome === 'extract', 'the raid settled as an extraction');
  assert.equal(raid.bags.find(b => b.id === 'fixture_priority_call_bag').items.length, 1, 'the nearer salvage was not taken by the boarding press');
  assert.equal(store.results(accountId).length, 1, 'the extraction is persisted once');
  assert.equal(store.results(accountId)[0].outcome, 'extract');
  assert.deepEqual(page.errors, [], 'extraction-priority context has no browser errors');
  console.log(JSON.stringify({
    closedExitLoot: [hatchWeapon.id, hatchLooted, operator.board === null],
    openExitBoarding: {exit: call.id, outcome: operator.result.outcome, salvageRemaining: raid.bags.find(b => b.id === 'fixture_priority_call_bag').items.length},
    screenshots: ['/tmp/raid-extraction-priority-loot.png', '/tmp/raid-extraction-priority-open.png'],
    browserErrors: [],
    fixtures: 'Machine/rival/loot/bag sets cleared; hatch remains closed; the call window and the two salvage bags are labeled runtime fixtures, not shipped content.',
    scope: 'One isolated Chrome context; recovery deployment and native E presses; boarding/settlement are real server behaviour.'
  }));
} catch (error) {
  console.error(JSON.stringify({errors: page?.errors, hint: await page?.evaluate("document.getElementById('hint')?.textContent").catch(() => null), status: await page?.evaluate("document.getElementById('interactionStatus')?.textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
