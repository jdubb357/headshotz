// Isolated Chrome grader for salvage-container readability. It exercises the real
// backpack drawer and interaction hint with authoritative snapshot bag shapes,
// then renders detached maps to prove each container kind has its own marker.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';

const now = 1000;
const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => now});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
let page;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error('Timed out: ' + label);
}
try {
  page = await h.page();
  const name = 'bag_ui_' + Date.now().toString(36);
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value=${JSON.stringify('a long bag ui password')};document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  await page.evaluate("document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=true;document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  await page.wait("!(document.getElementById('hint')?.textContent||'').startsWith('Connecting')");

  const account = (await page.evaluate("fetch('/api/profile').then(r => r.json())")).id;
  const operator = runtime.raids.byAccount.get(account);
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(operator && raid, 'the live UI deployment is authoritative');
  raid.machines = [];
  raid.rivals = [];
  raid.caches = [];
  raid.floorLoot = [];
  raid.bags = [];
  raid.world = {...raid.world, blocks: [], ramps: [], hazards: []};
  Object.assign(operator, {x: 0, y: 0, z: 0, protectedUntil: 0, move: {x: 0, z: 0}, lastInput: now});

  const valued = (id) => ({id, kind: 'valuable', quantity: 1, value: 1, rarity: 1, condition: 100});
  const fixtures = [
    {id: 'ui_machine_salvage', x: 0, y: 0, z: 0, kind: 'machine', label: 'Machine salvage', items: [valued('bag_item_machine')]},
    {id: 'ui_rival_salvage', x: 0.4, y: 0, z: 0.4, kind: 'rival', label: 'Rival salvage', items: [valued('bag_item_rival')]},
    {id: 'ui_gear_salvage', x: 0.8, y: 0, z: 0.8, kind: 'gear', team: operator.team, label: 'Dropped gear', items: [valued('bag_item_gear')]},
    {id: 'ui_operator_salvage', x: -0.8, y: 0, z: 0.8, kind: 'operator', team: 'enemy_team', items: [valued('bag_item_operator')]},
    {id: 'ui_friendly_salvage', x: -0.8, y: 0, z: -0.8, kind: 'operator', team: operator.team, items: [valued('bag_item_friendly')]}
  ];
  raid.bags.push(...fixtures);

  // HUD hint: the nearest container is the machine salvage.
  await page.wait("document.getElementById('hint').textContent.includes('salvage machine')");
  await page.wait("document.getElementById('hint').textContent.includes('1 item')");

  // Backpack drawer: every source kind has its own heading, and both operator
  // teammate and enemy labels stay distinct.
  await page.evaluate("document.getElementById('interact').click()");
  await page.wait("!document.getElementById('pack').hidden");
  await page.wait(`(() => {
    const text = document.getElementById('pack').textContent;
    return ['Machine salvage','Rival salvage','Dropped gear','Operator salvage bag','Squadmate salvage bag','1 item'].every((part) => text.includes(part));
  })()`);

  // Detached map render: each authoritative kind paints its documented color.
  const rendered = await page.evaluate(`(async () => {
    const {drawMap, drawTacticalMap, bagMarker, lootBagHint, lootBagLabel} = await import('./raid-online.mjs');
    const {getWorld} = await import('./shared/raid-worlds.mjs');
    const world = getWorld('relay');
    const markers = {
      operator: bagMarker({kind: 'operator'}),
      machine: bagMarker({kind: 'machine'}),
      rival: bagMarker({kind: 'rival'}),
      gear: bagMarker({kind: 'gear'})
    };
    const hint = {
      machine: lootBagHint({source: 'bag', kind: 'machine', items: [{}]}),
      rival: lootBagHint({source: 'bag', kind: 'rival', items: [{}]}),
      gear: lootBagHint({source: 'bag', kind: 'gear', items: [{}]}),
      operator: lootBagHint({source: 'bag', kind: 'operator', label: 'Operator salvage bag', items: [{}]}),
      ground: lootBagHint({source: 'loot', items: [{}]})
    };
    const labels = {
      operatorEnemy: lootBagLabel({kind: 'operator', friendly: false}),
      operatorFriend: lootBagLabel({kind: 'operator', friendly: true}),
      machine: lootBagLabel({kind: 'machine'})
    };
    const colors = {operator: '#ff7bd5', machine: '#ffc46b', rival: '#ff8a52', gear: '#c7a0ff'};
    const bag = (kind, x, z) => ({id: 'marker_' + kind, x, y: 0, z, kind, label: kind + ' salvage', items: []});
    const bags = [bag('operator', 40, 40), bag('machine', 80, 40), bag('rival', 120, 40), bag('gear', 160, 40)];
    const self = {x: -200, y: 0, z: -200, yaw: 0, team: 'team', alive: true, hp: 100};
    const state = {map: 'relay', mapVersion: world.version || 10, self, bags, loot: [], exits: [], hazards: [], caches: [], doors: [], bodies: [], machines: [], rivals: [], players: [], serverTime: 0};
    const readCanvas = (draw) => {
      const canvas = document.createElement('canvas');
      canvas.width = 360; canvas.height = 360;
      draw(canvas);
      return canvas;
    };
    const minimap = readCanvas((canvas) => drawMap(canvas, 'relay', state));
    const tactical = readCanvas((canvas) => drawTacticalMap(canvas, 'relay', state));
    const k = 360 / world.size;
    const count = (canvas, x, z, rgb, ox = 0, oz = 0) => {
      const data = canvas.getContext('2d').getImageData(0, 0, 360, 360).data, px = 180 + (x - ox) * k, py = 180 + (z - oz) * k;
      let total = 0;
      for (let y = Math.max(0, py - 12); y < Math.min(360, py + 12); y++) for (let x0 = Math.max(0, px - 12); x0 < Math.min(360, px + 12); x0++) {
        const i = (y * 360 + x0) * 4;
        if (data[i] === rgb.r && data[i + 1] === rgb.g && data[i + 2] === rgb.b) total++;
      }
      return total;
    };
    const expected = [['operator', colors.operator], ['machine', colors.machine], ['rival', colors.rival], ['gear', colors.gear]];
    const counts = {minimap: {}, tactical: {}};
    for (const [kind, hex] of expected) {
      const rgb = {r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16)};
      const source = bags.find((b) => b.kind === kind);
      counts.minimap[kind] = count(minimap, source.x, source.z, rgb);
      counts.tactical[kind] = count(tactical, source.x, source.z, rgb, self.x, self.z);
    }
    return {
      markers,
      hint,
      labels,
      counts,
      aria: minimap.getAttribute('aria-label') || '',
      distinct: new Set(expected.map(([, color]) => color)).size === expected.length
    };
  })()`);

  assert.deepEqual(rendered.markers.operator.letter, 'C');
  assert.deepEqual(rendered.markers.machine.letter, 'M');
  assert.deepEqual(rendered.markers.rival.letter, 'R');
  assert.deepEqual(rendered.markers.gear.letter, 'G');
  assert.equal(rendered.distinct, true, 'container marker colors are distinct');
  for (const kind of ['operator', 'machine', 'rival', 'gear']) assert.ok(rendered.counts.minimap[kind] > 0, 'the minimap paints a ' + kind + ' salvage marker');
  for (const kind of ['operator', 'machine', 'rival', 'gear']) assert.ok(rendered.counts.tactical[kind] > 0, 'the tactical map paints a ' + kind + ' salvage marker');
  assert.match(rendered.hint.machine, /^salvage machine · 1 item$/);
  assert.match(rendered.hint.rival, /^salvage rival · 1 item$/);
  assert.match(rendered.hint.gear, /^pick up dropped gear · 1 item$/);
  assert.match(rendered.hint.operator, /^search Operator salvage bag · 1 item$/);
  assert.match(rendered.hint.ground, /^pick up ground loot · 1 item$/);
  assert.equal(rendered.labels.operatorEnemy, 'Operator salvage bag');
  assert.equal(rendered.labels.operatorFriend, 'Squadmate salvage bag');
  assert.equal(rendered.labels.machine, 'Machine salvage');
  assert.match(rendered.aria, /pink C marks operator salvage/);
  assert.match(rendered.aria, /amber M machine salvage/);
  assert.match(rendered.aria, /orange R rival salvage/);
  assert.match(rendered.aria, /lavender G dropped gear/);
  assert.match(rendered.aria, /pink B marks a downed operator body/);

  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    hudMachineSalvage: true,
    backpackHeadingsDistinct: true,
    operatorEnemyLabel: 'Operator salvage bag',
    operatorFriendLabel: 'Squadmate salvage bag',
    markers: rendered.markers,
    minimapPixels: rendered.counts.minimap,
    tacticalPixels: rendered.counts.tactical,
    hintWording: rendered.hint,
    legendDistinct: true,
    browserErrors: [],
    scope: 'Isolated Chrome deployment plus detached canvas renders; bag fixtures are authoritative raid containers with client-derived presentation.'
  }));
} catch (error) {
  console.error(JSON.stringify({pageErrors: page?.errors, hint: await page?.evaluate("document.getElementById('hint').textContent").catch(() => null), pack: await page?.evaluate("document.getElementById('pack').textContent").catch(() => null)}));
  throw error;
} finally {
  await h.close();
  runtime.server.close();
  await once(runtime.server, 'close');
  store.close();
  if (prior === undefined) delete process.env.RAID_TEST_URL;
  else process.env.RAID_TEST_URL = prior;
}
