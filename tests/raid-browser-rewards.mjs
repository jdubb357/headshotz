// Isolated Chrome grader for the post-raid rewards loop. A fresh account signs
// in, deploys a purchased weapon through the real base UI, extracts with an
// authoritative settlement, and returns to base where the rewards card must
// surface the returned item, XP/rank progress, contract state and working
// navigation into stash/workshop/contracts/records/deploy controls.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {RaidStore,RuleError,item} from '../server/store.mjs';
import {createRaidServer} from '../server/main.mjs';
import {browserHarness} from './browser-harness.mjs';
import {earnedPurchase} from './earned-fixture.mjs';
import {rankProgress} from '../shared/raid-progression.mjs';

const store = new RaidStore();
const runtime = createRaidServer(store, {now: () => 1000});
runtime.server.listen(0, '127.0.0.1');
await once(runtime.server, 'listening');
const prior = process.env.RAID_TEST_URL;
process.env.RAID_TEST_URL = 'http://127.0.0.1:' + runtime.server.address().port;
const h = await browserHarness();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const username = 'rewards_ui_' + Date.now().toString(36).slice(-8);
const password = 'a long rewards summary password';
const account = store.register(username, password);
const weapon = earnedPurchase(store, account.id, {sku: 'smg'});

const page = await h.page();
try {
  await page.wait("document.getElementById('message')?.textContent.includes('Sign in')");
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(username)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.querySelector('form#login').requestSubmit()`);
  await page.wait("!document.getElementById('base').hidden && !document.body.hasAttribute('aria-busy') || document.body.getAttribute('aria-busy')==='false'");
  await page.wait("document.getElementById('rewards').hidden===true");
  assert.equal(await page.evaluate("document.getElementById('rewards').hidden"), true, 'the rewards card starts hidden with no settlement');
  assert.equal(await page.evaluate("document.querySelector('input[data-equip][value=" + JSON.stringify(weapon.id) + "]')!==null"), true, 'the earned weapon is in the stash');

  // Accept a contract through the existing base UI so the summary also proves
  // authoritative contract stage progress is linked from settlement to panel.
  await page.evaluate("[...document.querySelectorAll('#contracts button')].find(b=>b.textContent==='Accept contract').click()");
  await page.wait("document.getElementById('contracts').textContent.includes('Stage 1') && document.body.getAttribute('aria-busy')==='false'");
  const acceptedContract = Object.keys(store.profile(account.id).contracts)[0];
  assert.equal(acceptedContract, 'survey', 'the first contract offer is the survey');

  // Deploy through the real base controls: choose the purchased weapon, use no
  // recovery kit, and skip the optional latency probe for the local fixture.
  // Selection and deploy are separate UI actions because the selection change
  // runs the base's unready handler and briefly guards the deploy click.
  await page.evaluate(`document.getElementById('maxRtt').value='0';document.getElementById('recovery').checked=false;document.querySelector(${JSON.stringify(`input[data-equip][value="${weapon.id}"]`)}).click()`);
  await sleep(600);
  await page.evaluate("document.getElementById('deploy').click()");
  await page.wait("document.getElementById('play').style.display==='block' && document.body.getAttribute('aria-busy')==='false'");
  const operator = runtime && runtime.raids.byAccount.get(account.id);
  assert.ok(operator, 'the UI deployment reached the authoritative raid service');
  const raid = runtime.raids.raids.get(operator.raidId);
  assert.ok(raid, 'the UI deployment created a raid');
  assert.equal(operator.pack.length + operator.equipment.length >= 1, true, 'the purchased weapon deployed');
  assert.equal(await page.evaluate("document.getElementById('rewards').hidden===true"), true, 'no stale settlement card is shown while deployed');
  assert.equal(runtime.raids.byAccount.get(account.id), operator, 'the browser deployment is the same authoritative operator');

  // Authoritative settlement. The fixture records eight machine kills and three
  // surveyed loot sites. Base extraction XP plus combat/survey XP crosses the
  // first rank threshold (0 -> 60 XP, Wayfarer -> Salvager), and the accepted
  // survey contract gains its full first stage.
  const present = operator.equipment.some(it => it.id === weapon.id);
  assert.equal(present, true, 'the weapon is server-owned and deployed during the raid');
  runtime.raids.atomic(() => {
    operator.facts = {...(operator.facts || {}), machines: 8, explorations: ['relay:cache-1', 'relay:cache-2', 'relay:cache-3']};
    runtime.raids.end(raid, operator, 'extract');
  });
  const settled = store.results(account.id)[0];
  assert.equal(settled.outcome, 'extract', 'the authoritative settlement is an extraction');
  assert.equal(settled.xp, 69, 'the settlement awards extraction, combat and survey XP');
  assert.equal(settled.progression.xpAfter, 69, 'the settled profile XP matches the award');
  assert.deepEqual(settled.contracts.map(c => [c.id, c.stage, c.progress, c.need, c.delta, c.requirementsMet]), [['survey', 0, 3, 3, 3, true]], 'the accepted survey advanced exactly once by the surveyed sites');
  // Damage the returned weapon to a realistic worn state and supply both field
  // and workshop materials so the base renders and executes each repair grade.
  store.transaction(() => {
    const s = store.state(account.id), returned = s.items.find(it => it.id === weapon.id);
    returned.condition = 40;
    s.items.push(item('material', {material: 'wire', quantity: 2}), item('material', {material: 'steel', quantity: 2}));
    store.save(account.id, s);
  });
  await page.wait(`document.getElementById('hud').textContent.includes('EXTRACT') || document.getElementById('hint').textContent.includes('EXTRACT')`);
  await page.evaluate("document.getElementById('leave').click()");
  await page.wait("document.getElementById('play').style.display==='none' && document.body.getAttribute('aria-busy')==='false'");
  await page.wait("document.getElementById('rewards').hidden===false");

  const card = await page.evaluate("({characterized: document.getElementById('rewards').getAttribute('data-wide')===''||document.getElementById('rewards').hasAttribute('data-wide'), hidden: document.getElementById('rewards').hidden, title: document.getElementById('rewardsTitle').textContent, outcome: document.getElementById('rewardsTotals').textContent, loot: document.getElementById('rewardsLoot').textContent, rank: document.getElementById('rewardsRank').textContent, next: document.getElementById('rewardsNext').textContent, contract: document.getElementById('rewardsContract').textContent, bar: {max: Number(document.getElementById('rewardsRankBar').max), value: Number(document.getElementById('rewardsRankBar').value), label: document.getElementById('rewardsRankBar').getAttribute('aria-label')}, itemId: document.querySelector('#rewardsLoot [data-item-id]')?.getAttribute('data-item-id')})");
  assert.equal(card.hidden, false, 'the post-raid rewards card is visible after settlement');
  assert.match(card.title, /Last raid rewards/);
  assert.ok(card.outcome.includes('+' + settled.credits) && card.outcome.includes('Credits earned this raid'), 'credits earned query matches the settlement');
  assert.ok(card.outcome.includes('+' + settled.xp) && card.outcome.includes('Raid XP earned'), 'raid XP matches the settlement');
  assert.ok(card.rank.startsWith(`Rank ${settled.progression.rankBefore} ${rankProgress(settled.progression.xpBefore).name} → Rank ${settled.progression.rankAfter} ${settled.progression.rankName}`), 'rank before and after match the settlement');
  assert.equal(card.rank, rankProgress(settled.progression.xpAfter).next ? `Rank ${settled.progression.rankBefore} ${rankProgress(settled.progression.xpBefore).name} → Rank ${settled.progression.rankAfter} ${settled.progression.rankName} · ${settled.progression.xpAfter} XP · ${rankProgress(settled.progression.xpAfter).next.name} needs ${rankProgress(settled.progression.xpAfter).nextXp} more XP · Blueprints unlocked: ${settled.progression.unlockedBlueprints.join(', ')}.` : `Rank ${settled.progression.rankBefore} ${rankProgress(settled.progression.xpBefore).name} → Rank ${settled.progression.rankAfter} ${settled.progression.rankName} · ${settled.progression.xpAfter} XP · maximum rank reached.`, 'rank progress is derived from the settlement');
  assert.equal(card.contract, 'Contract stage progress this raid: ' + settled.contracts.map(c => `${c.name} stage ${c.stage+1}: +${c.delta} → ${c.progress}/${c.need}${c.requirementsMet?' (claim in Contracts)':''}`).join('; ') + '.', 'contract progress matches the settlement');
  assert.equal(card.itemId, weapon.id, 'the returned loot row carries the authoritative item id');
  assert.ok(card.loot.includes('Returned from raid · 1 item'), 'the returned loot is summarized');
  assert.ok(card.loot.includes('Compact SMG ×1'), 'the returned loot shows the authoritative item name and quantity');
  assert.ok(card.outcome.includes('0') && card.outcome.includes('Items lost or dropped'), 'the lost-item count is shown');
  assert.ok(card.next.includes('Returned items are already in your stash'), 'the card explains the extract→store→deploy loop');
  assert.ok(card.title.length < 100 && card.outcome.length < 220, 'summary text stays compact');
  assert.ok(card.bar.max >= 1 && card.bar.value <= card.bar.max, 'rank progress bar has valid bounds');
  assert.ok(/Progress to next rank/.test(card.bar.label), 'the progress bar has an accessible label');
  assert.equal(await page.evaluate("Boolean(document.getElementById('rewards').compareDocumentPosition(document.getElementById('stash')) & Node.DOCUMENT_POSITION_FOLLOWING)"), true, 'the rewards card precedes the stash/equipment bench in document order');

  // Repair grades are the base's equipment-condition choice. Both must be
  // rendered from authoritative damage and material costs, and the cheaper
  // field patch must leave the rifle degraded until a full workshop repair.
  const repairLabels = await page.evaluate(`(()=>{const row=[...document.querySelectorAll('#stash .item')].find(r=>r.dataset.itemId===${JSON.stringify(weapon.id)});return row?[...row.querySelectorAll('button')].map(b=>b.textContent):[]})()`);
  assert.ok(repairLabels.some(text => text.startsWith('Field patch → 65% · 15 credits + 1 wire')), 'field patch offers 25 condition points for 15 credits and one wire');
  assert.ok(repairLabels.some(text => text.startsWith('Full repair · 30 credits + 1 steel')), 'full repair prices the full 60-point restoration separately');
  const clickRepair = async prefix => {
    await page.wait("document.body.getAttribute('aria-busy')==='false'");
    const clicked = await page.evaluate(`(()=>{const row=[...document.querySelectorAll('#stash .item')].find(r=>r.dataset.itemId===${JSON.stringify(weapon.id)});const b=[...row.querySelectorAll('button')].find(b=>b.textContent.startsWith(${JSON.stringify(prefix)}));if(!b||b.disabled)return false;b.click();return true})()`);
    assert.equal(clicked, true, 'available repair grade: ' + prefix);
  };
  const creditsBeforeRepair = store.profile(account.id).credits;
  await clickRepair('Field patch');
  await page.wait(`document.body.getAttribute('aria-busy')==='false' && [...document.querySelectorAll('#stash .item')].some(r=>r.dataset.itemId===${JSON.stringify(weapon.id)} && r.textContent.includes('65%'))`);
  const patched = store.profile(account.id);
  assert.equal(patched.items.find(it => it.id === weapon.id).condition, 65, 'the field patch left the rifle at partial condition');
  assert.equal(creditsBeforeRepair - patched.credits, 15, 'the field patch charged its authoritative credits');
  await clickRepair('Full repair');
  await page.wait(`document.body.getAttribute('aria-busy')==='false' && [...document.querySelectorAll('#stash .item')].some(r=>r.dataset.itemId===${JSON.stringify(weapon.id)} && r.textContent.includes('100%'))`);
  const repaired = store.profile(account.id);
  assert.equal(repaired.items.find(it => it.id === weapon.id).condition, 100, 'the workshop repair restored the remaining condition');
  assert.equal(patched.credits - repaired.credits, 20, 'the workshop repair charged the remaining condition');
  assert.equal(repaired.items.filter(it => it.id === weapon.id).length, 1, 'no duplicate stash item was invented by the repair grades');
  assert.equal(repaired.items.filter(it => it.kind === 'material' && it.material === 'wire').reduce((n, it) => n + it.quantity, 0), 1, 'the field patch consumed exactly one wire');
  assert.equal(repaired.items.filter(it => it.kind === 'material' && it.material === 'steel').reduce((n, it) => n + it.quantity, 0), 1, 'the workshop repair consumed exactly one steel');

  const controls = await page.evaluate("[...document.querySelectorAll('#rewards .rewardsActions button')].map(b => ({tag: b.tagName, name: b.textContent.trim(), tabIndex: b.tabIndex, disabled: b.disabled}))");
  assert.equal(controls.length, 5, 'all five navigation controls are present');
  assert.equal(controls.every(control => control.tag === 'BUTTON' && control.tabIndex === 0 && !control.disabled), true, 'every navigation control is a focusable enabled native button');
  assert.equal(new Set(controls.map(control => control.name)).size, controls.length, 'every navigation control has a unique accessible name');
  const stateBeforeActions = structuredClone(store.profile(account.id));

  // Every summary action must reach the existing base surface and land focus
  // there for keyboard players.
  const actions = [
    ['rewardsStash', "document.activeElement.closest('#stash')!==null"],
    ['rewardsWorkshop', "document.activeElement.closest('#workshop')!==null"],
    ['rewardsContracts', "document.activeElement.closest('#contracts')!==null"],
    ['rewardsRecords', "document.activeElement.tagName==='SUMMARY' && document.activeElement.closest('#records')!==null && document.activeElement.closest('details').open"],
    ['rewardsDeploy', "document.activeElement.id==='map'"]
  ];
  for (const [id, expectation] of actions) {
    await page.evaluate("document.getElementById(" + JSON.stringify(id) + ").click()");
    await page.wait("(" + expectation + ") || true");
    assert.equal(await page.evaluate(expectation), true, id + ' focuses the matching base surface');
  }
  const stateAfterActions = store.profile(account.id);
  assert.equal(stateAfterActions.revision, stateBeforeActions.revision, 'navigation controls do not mutate the authoritative profile revision');
  assert.equal(stateAfterActions.credits, stateBeforeActions.credits, 'navigation controls do not spend or invent credits');
  assert.deepEqual(stateAfterActions.items.map(it => it.id), stateBeforeActions.items.map(it => it.id), 'navigation controls do not move or invent stash items');

  // Signing out must clear every rewards surface, and a different account must
  // never inherit the prior account's settlement summary.
  await page.evaluate("document.getElementById('logout').click()");
  await page.wait("document.getElementById('auth').hidden===false");
  const signedOutState = await page.evaluate("({hidden: document.getElementById('rewards').hidden, loot: document.getElementById('rewardsLoot').textContent, item: document.querySelector('#rewardsLoot [data-item-id]')?.getAttribute('data-item-id') || null})");
  assert.deepEqual(signedOutState, {hidden: true, loot: '', item: null}, 'sign-out clears the rewards summary');
  const other = 'rewards_other_' + Date.now().toString(36).slice(-8);
  await page.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(other)};document.querySelector('[name=password]').value='a different long rewards password';document.getElementById('register').click()`);
  await page.wait("!document.getElementById('base').hidden && document.body.getAttribute('aria-busy')==='false'");
  const switchedState = await page.evaluate("({hidden: document.getElementById('rewards').hidden, loot: document.getElementById('rewardsLoot').textContent, item: document.querySelector('#rewardsLoot [data-item-id]')?.getAttribute('data-item-id') || null, identity: document.getElementById('identity').textContent})");
  assert.equal(switchedState.hidden, true, 'another account does not inherit the prior rewards card');
  assert.equal(switchedState.loot, '', 'another account has no prior loot rows');
  assert.equal(switchedState.item, null, 'another account has no prior loot item');
  assert.ok(switchedState.identity.includes(other), 'the second account signed in through the real UI');
  assert.deepEqual(page.errors, [], 'rewards browser context has no errors');
  console.log(JSON.stringify({
    rewardsVisibleAfterExtraction: true,
    lootItemId: card.itemId,
    creditsAndXp: card.outcome,
    rankProgress: card.rank,
    contractSummary: card.contract,
    navigationControls: controls,
    focusedActions: actions.map(([id]) => id),
    presentationOnly: stateAfterActions.revision === stateBeforeActions.revision,
    signOutClearsRewards: signedOutState.hidden && signedOutState.loot === '' && signedOutState.item === null,
    accountSwitchKeepsRewardsHidden: switchedState.hidden,
    repairGrades: {labels: repairLabels.filter(text => /patch|repair/i.test(text)), fieldPatchTo: patched.items.find(it => it.id === weapon.id).condition, fullRepairTo: repaired.items.find(it => it.id === weapon.id).condition},
    browserErrors: [],
    scope: 'Fresh account, UI deployment and authoritative extraction settlement; rewards are read from /api/profile and /api/results only.'
  }));
} catch (error) {
  console.error(JSON.stringify({
    rewardsHidden: await page.evaluate("document.getElementById('rewards')?.hidden").catch(() => null),
    rewardsText: await page.evaluate("document.getElementById('rewards')?.textContent").catch(() => null),
    errors: page.errors
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
