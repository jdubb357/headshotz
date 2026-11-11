import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {item} from '../shared/raid-rules.mjs';
import {
  createOfflineRaidRuntime,
  offlineReadiness,
  offlineRaidRequest,
  offlineRaidRoute,
  startOfflineTick,
} from '../shared/raid-offline.mjs';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function runtime(options) {
  return createOfflineRaidRuntime(options);
}

function starterWeapon(profile) {
  const weapon = profile.items.find(it => it.kind === 'weapon');
  assert.ok(weapon, 'the offline guest has a starter weapon');
  return weapon;
}

function deploy(runtime, requestId = 'offline-deploy-1') {
  const profile = offlineRaidRoute(runtime, 'profile');
  return offlineRaidRoute(runtime, 'deploy', {
    protocol: RAID_PROTOCOL,
    requestId,
    mapId: RAID_WORLDS[0].id,
    match: {allowMixed: true, maxRttMs: 0},
    itemIds: [starterWeapon(profile).id],
  });
}

function fail(runtime) {
  try {
    runtime.raids.tick(0.05);
  } catch (error) {
    return error;
  }
  return null;
}

test('offline dispatcher has no Node-only imports and stays DOM-free', () => {
  const text = source('shared/raid-offline.mjs');
  assert.equal(/from\s+['"]node:/.test(text), false);
  assert.equal(/document\.|window\./.test(text), false);
});

test('offline capabilities and worlds describe a solo, no-party transport', () => {
  const rt = runtime({username: 'guest_one'});
  try {
    const capabilities = offlineRaidRoute(rt, 'capabilities');
    assert.equal(capabilities.protocol, RAID_PROTOCOL);
    assert.equal(capabilities.region, 'local');
    assert.deepEqual(capabilities.partyModes, ['solo']);
    assert.equal(capabilities.maxPlayers, 1);
    assert.equal(capabilities.offline, true);
    assert.equal(offlineRaidRoute(rt, 'worlds'), RAID_WORLDS);
  } finally {
    rt.dispose();
  }
});

test('offline profile and auth routes share the passwordless guest', () => {
  const rt = runtime({username: 'offline_guest'});
  try {
    const profile = offlineRaidRoute(rt, 'profile');
    assert.equal(profile.username, 'offline_guest');
    assert.equal(profile.credits, 250);
    assert.equal(profile.items.length, 4);
    assert.deepEqual(offlineRaidRoute(rt, 'sessions').recoveryRemaining, 0);
    assert.deepEqual(offlineRaidRoute(rt, 'logout'), {ok: true});
    assert.equal(offlineRaidRoute(rt, 'login', {username: 'offline_guest', password: 'ignored'}).id, profile.id);
    assert.deepEqual(offlineRaidRoute(rt, 'results'), []);
  } finally {
    rt.dispose();
  }
});

test('offline deploy uses the authoritative service and binds the guest account', () => {
  const rt = runtime();
  try {
    const profile = offlineRaidRoute(rt, 'profile');
    const deployed = deploy(rt);
    assert.equal(deployed.protocol, RAID_PROTOCOL);
    assert.equal(deployed.self.alive, true);
    assert.ok(deployed.self.deploymentId);
    assert.equal(rt.raids.byAccount.get(rt.account).deploymentId, deployed.self.deploymentId);
    assert.equal(rt.store.activeDeployment(rt.account)?.id, deployed.self.deploymentId);
    assert.equal(rt.store.profile(profile.id).items.some(it => it.id === starterWeapon(profile).id), false, 'deployed gear leaves the stash');
  } finally {
    rt.dispose();
  }
});

test('offline actions are validated by the shared protocol and return authoritative state', async () => {
  const rt = runtime();
  try {
    const deployed = deploy(rt);
    const base = {raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, protocol: RAID_PROTOCOL, includeState: true};
    const moved = await offlineRaidRequest(rt, 'action', {type: 'move', x: 1, z: 0, yaw: 0, pitch: 0, sprint: false, seq: 1, ...base});
    assert.equal(moved.ok, true);
    assert.equal(moved.ack.protocol, RAID_PROTOCOL);
    assert.equal(moved.ack.accepted, true);
    assert.equal(moved.state.self.deploymentId, deployed.self.deploymentId);
    const fired = await offlineRaidRequest(rt, 'action', {type: 'fire', yaw: 0, pitch: 0, seq: 2, ...base});
    assert.equal(fired.ack.accepted, true);
  } finally {
    rt.dispose();
  }
});

test('offline action rejects unknown fields and stale protocol with status codes', async () => {
  const rt = runtime();
  try {
    const deployed = deploy(rt);
    const base = {type: 'move', x: 0, z: 0, yaw: 0, pitch: 0, sprint: false, raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, seq: 1, includeState: true};
    await assert.rejects(offlineRaidRequest(rt, 'action', {...base, protocol: RAID_PROTOCOL, teleport: 1}), error => error.status === 400);
    await assert.rejects(offlineRaidRequest(rt, 'deploy', {requestId: 'offline_deploy_bad', mapId: RAID_WORLDS[0].id, protocol: 0, itemIds: []}), error => error.status === 426);
    await assert.rejects(offlineRaidRequest(rt, 'action', {type: 'ping', kind: 'invalid', seq: 1, raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, protocol: RAID_PROTOCOL}), error => error.status === 400 || error.status === 409);
  } finally {
    rt.dispose();
  }
});

test('offline multiplayer, trader/contract, and voice probes are explicit stubs', async () => {
  const rt = runtime();
  try {
    assert.equal(offlineRaidRoute(rt, 'party'), null);
    assert.deepEqual(offlineRaidRoute(rt, 'social'), {scope: 'squad', controls: [], privacy: '/raid-privacy.html'});
    assert.equal(offlineRaidRoute(rt, 'voice').joined, false);
    assert.deepEqual(offlineRaidRoute(rt, 'market'), []);
    await assert.rejects(offlineRaidRequest(rt, 'party', {type: 'create'}), error => error.status === 501);
    await assert.rejects(offlineRaidRequest(rt, 'trade', {type: 'buy', trader: 'outfitter', sku: 'steel'}), error => error.status === 501);
    await assert.rejects(offlineRaidRequest(rt, 'trade', {type: 'contract', contract: 'survey', operation: 'accept'}), error => error.status === 501);
    await assert.rejects(offlineRaidRequest(rt, 'voice', {type: 'join'}), error => error.status === 501);
    assert.deepEqual(offlineRaidRoute(rt, 'matchmaking'), {region: 'local', policy: rt.matchInfo.policy});
    const probe = offlineRaidRoute(rt, 'matchmaking', {operation: 'probe'});
    assert.match(probe.nonce, /^offline-/);
    const measured = offlineRaidRoute(rt, 'matchmaking', {operation: 'measure', nonce: probe.nonce});
    assert.equal(measured.rttMs, 0);
    assert.equal(measured.withinLimit, true);
  } finally {
    rt.dispose();
  }
});

test('offline trade routes crafting and repairs through the authoritative store', async () => {
  const rt = runtime({username: 'offline_workshop'});
  try {
    const account = rt.session.account;
    const state = rt.store.state(account);
    state.items.push(item('material', {material: 'steel', quantity: 3}), item('material', {material: 'wire', quantity: 1}), item('material', {material: 'chem', quantity: 1}));
    rt.store.save(account, state);
    const revision = rt.store.state(account).revision;
    const crafted = await offlineRaidRequest(rt, 'trade', {type: 'craft', recipe: 'med', expectedRevision: revision});
    assert.equal(crafted.credits, 245, 'the recipe charges through the offline store');
    assert.equal(crafted.items.filter(it => it.kind === 'med').length, 3, 'a crafted medkit lands in the stash');
    const damaged = rt.store.state(account), weapon = damaged.items.find(it => it.kind === 'weapon');
    weapon.condition = 40;
    rt.store.save(account, damaged);
    const damagedRevision = rt.store.state(account).revision;
    const repaired = await offlineRaidRequest(rt, 'trade', {type: 'repair', itemId: weapon.id, quality: 'patch', expectedRevision: damagedRevision});
    assert.equal(repaired.items.find(it => it.id === weapon.id).condition, 65, 'field patch matches the shared repair target');
    assert.equal(repaired.credits, 230, 'the patch is priced from the shared rule');
    assert.deepEqual(rt.store.profile(account).items.filter(it => it.id === weapon.id)[0].condition, 65, 'repair persists');
  } finally {
    rt.dispose();
  }
});

test('offline readiness previews the authoritative preflight without deploying gear', () => {
  const rt = runtime({username: 'offline_readiness'});
  try {
    const profile = offlineRaidRoute(rt, 'profile');
    const weapon = starterWeapon(profile);
    const armor = profile.items.find(it => it.kind === 'armor');
    const blocked = offlineRaidRoute(rt, 'readiness', { recovery: false, itemIds: [] });
    assert.equal(blocked.ready, false);
    assert.match(blocked.blocker, /Equip one or two weapons/);
    assert.equal(profile.items.filter(it => it.kind === 'weapon').length, 1, 'the preview never removes stash gear');
    const ready = offlineReadiness(rt, { recovery: false, itemIds: [weapon.id] });
    assert.equal(ready.ready, true);
    assert.equal(ready.premium, 0);
    assert.equal(ready.insured, 0);
    assert.equal(ready.weight, 4, 'carried weight comes from the shared catalogue');
    assert.ok(rt.store.profile(rt.account).items.some(it => it.id === weapon.id), 'readiness never deploys gear');
    const insured = offlineReadiness(rt, { itemIds: [weapon.id, armor.id], insureIds: [weapon.id, armor.id] });
    assert.equal(insured.ready, true);
    assert.equal(insured.insured, 2);
    assert.equal(insured.premium, 34, '20% of the starter rifle and armor prices');
    const recovery = offlineReadiness(rt, { recovery: true, itemIds: [], insureIds: [] });
    assert.equal(recovery.ready, true);
    assert.equal(recovery.recovery, true);
    assert.equal(recovery.premium, 0);
    deploy(rt, 'offline-readiness-deploy-1');
    const deployed = offlineReadiness(rt, { recovery: true });
    assert.equal(deployed.ready, false);
    assert.match(deployed.blocker, /only one raid at a time/);
  } finally {
    rt.dispose();
  }
});

test('the in-page 50 ms tick runs the same raids.tick loop and can be stopped', async () => {
  const rt = runtime();
  try {
    const timer = startOfflineTick(rt, {intervalMs: 10});
    assert.ok(timer);
    assert.equal(rt.tickTimer, timer);
    assert.equal(fail(rt), null, 'the detached simulation loop must not throw');
    const again = startOfflineTick(rt, {intervalMs: 10});
    assert.equal(again, timer, 'the tick is started once per runtime');
    rt.dispose();
    assert.equal(rt.tickTimer, null);
  } finally {
    if (rt.tickTimer !== null) rt.dispose();
  }
});

test('unknown offline endpoints fail with 404 instead of inventing behaviour', async () => {
  const rt = runtime();
  try {
    await assert.rejects(offlineRaidRequest(rt, 'unknown'), error => error.status === 404);
    await assert.rejects(offlineRaidRequest(rt, 'change-password', {currentPassword: 'x'}), error => error.status === 501);
  } finally {
    rt.dispose();
  }
});

// Slice 9 gameplay wiring: the dispatcher must serve the real authoritative
// loot, machine combat, and extraction routes in-page, not just deploy.
function offlineGameplayRuntime(username = 'offline_gameplay') {
  let clock = 1000;
  const rt = createOfflineRaidRuntime({username, now: () => clock});
  const advance = seconds => { clock += seconds; rt.raids.tick(0.05); return clock; };
  return {rt, advance, clock: () => clock};
}

test('offline take loot resolves through the authoritative store claim route', async () => {
  const game = offlineGameplayRuntime('offline_looter');
  const {rt, advance} = game;
  try {
    const deployed = deploy(rt, 'offline-deploy-loot');
    const pile = deployed.loot[0];
    assert.ok(pile, 'a nearby ground-loot pile is exposed by the offline snapshot');
    const it = pile.items[0];
    // Stand inside the 3 m interaction reach the client requires. Movement is
    // still simulated by the service; this test targets the dispatcher/store
    // contract behind the Take button.
    const p = rt.raids.byAccount.get(rt.account);
    p.x = pile.x; p.z = pile.z; p.lastInput = game.clock();
    advance(0.2);
    const base = {raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, protocol: RAID_PROTOCOL, includeState: true};
    const taken = await offlineRaidRequest(rt, 'action', {type: 'take', sourceId: pile.id, itemId: it.id, seq: 2, ...base});
    assert.equal(taken.ok, true);
    assert.equal(taken.ack.accepted, true);
    assert.ok(taken.state.self.pack.some(entry => entry.id === it.id), 'the taken item is in the authoritative backpack');
    assert.equal(rt.raids.raids.get(deployed.raidId).floorLoot.find(l => l.id === pile.id).items.some(entry => entry.id === it.id), false, 'the loot pile loses the taken item');
  } finally {
    rt.dispose();
  }
});

test('offline fire damages machines and records authoritative hit feedback', async () => {
  const game = offlineGameplayRuntime('offline_shooter');
  const {rt, advance, clock} = game;
  try {
    const deployed = deploy(rt, 'offline-deploy-fire');
    const visible = deployed.machines[0];
    assert.ok(visible, 'the insertion patrol machine is visible offline');
    const raid = rt.raids.raids.get(deployed.raidId), p = rt.raids.byAccount.get(rt.account);
    const machine = raid.machines.find(m => m.id === visible.id);
    const before = machine.hp;
    const yaw = Math.atan2(machine.x - p.x, machine.z - p.z);
    const pitch = Math.atan2((machine.y || 0) + 0.9 - ((p.y || 0) + 1.55), Math.hypot(machine.x - p.x, machine.z - p.z));
    const base = {raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, protocol: RAID_PROTOCOL, includeState: true};
    let hit = null;
    for (let seq = 2; seq <= 5 && machine.hp === before; seq++) {
      advance(0.5);
      const attemptYaw = Math.atan2(machine.x - p.x, machine.z - p.z);
      const result = await offlineRaidRequest(rt, 'action', {type: 'fire', yaw: attemptYaw, pitch, seq, ...base});
      if (result.state?.self?.hit && result.state.self.hit.zone) hit = result.state.self.hit;
    }
    assert.ok(machine.hp < before || machine.hp <= 0, 'machine health changed from the authoritative shot');
    assert.ok(hit, 'the snapshot carries authoritative hit feedback');
    assert.ok(clock() > 1000);
  } finally {
    rt.dispose();
  }
});

test('offline call beacon, boarding, and extraction settle through the dispatcher', async () => {
  const game = offlineGameplayRuntime('offline_extractor');
  const {rt, advance, clock} = game;
  try {
    const deployed = deploy(rt, 'offline-deploy-extract');
    const raid = rt.raids.raids.get(deployed.raidId), p = rt.raids.byAccount.get(rt.account);
    const exit = raid.exits.find(e => e.kind === 'call');
    p.x = exit.x; p.z = exit.z; p.lastInput = clock();
    const base = {raidId: deployed.raidId, deploymentId: deployed.self.deploymentId, protocol: RAID_PROTOCOL, includeState: true};
    const called = await offlineRaidRequest(rt, 'action', {type: 'call', exitId: exit.id, seq: 2, ...base});
    assert.equal(called.ok, true);
    advance(40);
    const boarded = await offlineRaidRequest(rt, 'action', {type: 'extract', exitId: exit.id, seq: 3, ...base});
    assert.equal(boarded.ok, true);
    assert.equal(boarded.ack.accepted, true);
    advance(3);
    assert.equal(p.result?.outcome, 'extract');
    assert.ok(p.result.items.length >= 1, 'extraction returns equipment');
    assert.equal(p.result.lostItems.length, 0);
    const profile = rt.store.profile(rt.account);
    assert.equal(profile.credits, 270);
    assert.equal(profile.activeDeployment, null);
    assert.equal(rt.store.results(rt.account).length, 1);
  } finally {
    rt.dispose();
  }
});
