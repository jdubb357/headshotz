// Isolated Chrome grader for rarity-derived loot pickup feedback. It deploys a
// real UI against an authoritative raid, injects four salvage containers, takes
// one item of each rarity through the actual backpack buttons, and checks the
// decorative celebration, its wording, cue selection and reduced-motion path.
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
const takeExpr = (id) => `(() => {
  const row = document.querySelector('[data-item-id="${id}"]');
  if (!row) return false;
  const take = [...row.querySelectorAll('button')].find((b) => b.textContent === 'Take');
  if (!take) return false;
  take.click();
  return true;
})()`;
const pick = async (id) => {
  await page.wait(`document.querySelector('[data-item-id="${id}"]') !== null`);
  await page.wait(`(() => {
    const row = document.querySelector('[data-item-id="${id}"]');
    return row !== null && [...row.querySelectorAll('button')].some((b) => b.textContent === 'Take' && !b.disabled);
  })()`);
  await page.evaluate(takeExpr(id));
};
try {
  page = await h.page();
  const name = 'loot_ui_' + Date.now().toString(36);
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('[name=password]').value=${JSON.stringify('a long loot ui password')};document.getElementById('register').click()`);
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

  const fixtures = [
    {id: 'loot_common', label: 'Scrap watch', rarity: 0},
    {id: 'loot_rare', label: 'Signal lens', rarity: 2},
    {id: 'loot_epic', label: 'Field relay', rarity: 3},
    {id: 'loot_legendary', label: 'Warden core shard', rarity: 4}
  ];
  for (const [index, item] of fixtures.entries()) {
    raid.bags.push({
      id: 'loot_bag_' + index,
      x: index * 0.5,
      y: 0,
      z: 0,
      kind: 'machine',
      label: 'Salvage crate ' + index,
      items: [{...item, kind: 'valuable', quantity: 1, value: 10, condition: 100}]
    });
  }

  await page.wait("document.getElementById('hint').textContent.includes('salvage machine')");
  await page.evaluate("document.getElementById('interact').click()");
  await page.wait("!document.getElementById('pack').hidden");
  const overlay = (expression) => page.evaluate(expression);

  // Common and uncommon pickups are recovered through the existing caption
  // and never trigger the decorative overlay.
  await pick('loot_common');
  await page.wait("document.getElementById('statusAnnouncement').textContent==='Common item recovered: Scrap watch.'");
  assert.equal(await overlay("document.getElementById('lootCelebration').hidden"), true);
  assert.equal(await overlay("document.getElementById('events').textContent"), 'Common item recovered: Scrap watch.');

  // Rare triggers the cyan flourish and its own cue.
  await pick('loot_rare');
  await page.wait("document.getElementById('lootCelebration').dataset.tier==='rare'");
  assert.equal(await overlay("document.getElementById('lootCelebration').hidden"), false);
  assert.equal(await overlay("document.getElementById('lootCelebration').classList.contains('show')"), true);
  assert.equal(await overlay("document.getElementById('lootCelebration').dataset.cue"), 'lootRare');
  assert.equal(await overlay("getComputedStyle(document.getElementById('lootCelebration')).getPropertyValue('--loot-accent').trim()"), '#63d9f2');
  assert.equal(await overlay("document.getElementById('lootCelebrationTier').textContent"), 'Rare haul');
  assert.equal(await overlay("document.getElementById('lootCelebrationName').textContent"), 'Signal lens');
  assert.equal(await overlay("document.getElementById('lootCelebration').getAttribute('aria-hidden')"), 'true');
  assert.equal(await overlay("document.getElementById('statusAnnouncement').textContent"), 'Rare haul: Signal lens recovered.');

  // Legendary replaces the flourish in place with the amber tone.
  await pick('loot_legendary');
  await page.wait("document.getElementById('lootCelebration').dataset.tier==='legendary'");
  assert.equal(await overlay("document.getElementById('lootCelebration').dataset.cue"), 'lootLegendary');
  assert.equal(await overlay("getComputedStyle(document.getElementById('lootCelebration')).getPropertyValue('--loot-accent').trim()"), '#ffb44a');
  assert.equal(await overlay("document.getElementById('lootCelebrationName').textContent"), 'Warden core shard');
  assert.equal(await overlay("document.getElementById('events').textContent"), 'Legendary haul: Warden core shard recovered.');

  // The decorative card clears itself and never blocks interaction.
  await sleep(2600);
  assert.equal(await overlay("document.getElementById('lootCelebration').hidden"), true);
  assert.equal(await overlay("document.getElementById('lootCelebration').classList.contains('show')"), false);
  assert.equal(await overlay("getComputedStyle(document.getElementById('lootCelebration')).pointerEvents"), 'none');

  // Reduced motion keeps the same words and tier but freezes the flourish.
  await page.evaluate("document.documentElement.dataset.reducedMotion='true'");
  await pick('loot_epic');
  await page.wait("document.getElementById('lootCelebration').dataset.tier==='epic'");
  assert.equal(await overlay("document.getElementById('lootCelebration').hidden"), false);
  assert.equal(await overlay("getComputedStyle(document.getElementById('lootCelebration')).animationName"), 'none');
  assert.equal(await overlay("getComputedStyle(document.getElementById('lootCelebration')).opacity"), '1');
  assert.equal(await overlay("document.getElementById('statusAnnouncement').textContent"), 'Epic haul: Field relay recovered.');
  await sleep(2600);
  assert.equal(await overlay("document.getElementById('lootCelebration').hidden"), true);

  assert.deepEqual(page.errors, []);
  console.log(JSON.stringify({
    commonPlain: true,
    rareCelebration: true,
    legendaryCelebration: true,
    cues: {rare: 'lootRare', epic: 'lootEpic', legendary: 'lootLegendary'},
    accents: {rare: '#63d9f2', epic: '#c790ff', legendary: '#ffb44a'},
    reducedMotionFreezesFlourish: true,
    statusAnnouncementLive: true,
    selfClearing: true,
    browserErrors: [],
    scope: 'Isolated Chrome deployment against an authoritative raid. Salvage fixtures are injected containers; not human balance, hosted transport or physical-device acceptance.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    hint: await page?.evaluate("document.getElementById('hint').textContent").catch(() => null),
    pack: await page?.evaluate("document.getElementById('pack').textContent").catch(() => null),
    announcement: await page?.evaluate("document.getElementById('statusAnnouncement').textContent").catch(() => null),
    errors: page?.errors
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
