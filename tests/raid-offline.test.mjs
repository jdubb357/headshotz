import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RAID_PROTOCOL} from '../shared/raid-protocol.mjs';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {
  createOfflineRaidRuntime,
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

test('offline multiplayer, trade, and voice probes are explicit stubs', async () => {
  const rt = runtime();
  try {
    assert.equal(offlineRaidRoute(rt, 'party'), null);
    assert.deepEqual(offlineRaidRoute(rt, 'social'), {scope: 'squad', controls: [], privacy: '/raid-privacy.html'});
    assert.equal(offlineRaidRoute(rt, 'voice').joined, false);
    assert.deepEqual(offlineRaidRoute(rt, 'market'), []);
    await assert.rejects(offlineRaidRequest(rt, 'party', {type: 'create'}), error => error.status === 501);
    await assert.rejects(offlineRaidRequest(rt, 'trade', {type: 'buy'}), error => error.status === 501);
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
