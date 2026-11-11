import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MemoryRaidStore} from '../shared/raid-store-memory.mjs';
import {RaidService} from '../server/raids.mjs';
import {GuestSession,createGuestSession,offlineSessionRoute} from '../shared/raid-session.mjs';
import {RuleError} from '../shared/raid-rules.mjs';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('the session module is browser-safe and never touches Node credentials', () => {
  const text = source('shared/raid-session.mjs');
  assert.equal(/from\s+['"]node:/.test(text), false, 'session module must not import node:*');
  assert.equal(/\bscryptSync\b|encodePassword|verifyPassword|timingSafeEqual/.test(text), false, 'no credential primitives offline');
});

test('offline auth auto-creates a passwordless guest and returns its authoritative profile', () => {
  const store = new MemoryRaidStore();
  const session = createGuestSession(store);
  assert.ok(session instanceof GuestSession);
  assert.equal(session.authenticate(), session.account);
  assert.equal(session.account, store.createGuest('guest').id, 'the session reuses the named guest');
  assert.equal(store.accounts.size, 1, 'no duplicate guest accounts');

  const profile = session.profile();
  assert.equal(profile.id, session.account);
  assert.equal(profile.username, 'guest');
  assert.equal(profile.credits, 250);
  assert.equal(profile.items.length, 4, 'starter weapon, armor and two meds are deployable');
  assert.deepEqual(profile.items.map(it => it.kind), ['weapon', 'armor', 'med', 'med']);
  assert.equal(profile.activeDeployment, null);
  assert.deepEqual(profile.overflow, []);
  assert.deepEqual(profile.insurance, []);
  assert.equal(session.results().length, 0);
});

test('signing in claims the typed local name; registration is the same offline path', () => {
  const store = new MemoryRaidStore();
  const session = createGuestSession(store);
  const alice = session.signIn('Alice_One');
  assert.equal(alice.username, 'alice_one');
  assert.equal(session.profile().id, alice.id);
  const before = session.account;

  const logged = offlineSessionRoute(session, 'login', {username: 'alice_one', password: 'ignored'});
  assert.equal(logged.id, before, 'the same local name keeps the same operator and stash');

  const registered = offlineSessionRoute(session, 'register', {username: 'Raider2', password: 'ignored'});
  assert.equal(registered.username, 'raider2');
  assert.notEqual(registered.id, before, 'a new name gets its own operator');
  assert.equal(store.accounts.size, 3, 'guest, alice_one and raider2 each exist once');
});

test('offline session exposes profile/results/sessions and an explicit password-free logout', () => {
  const store = new MemoryRaidStore();
  const session = createGuestSession(store);
  assert.deepEqual(offlineSessionRoute(session, 'logout'), {ok: true});
  assert.equal(session.profile().username, 'guest', 'signing out leaves the local operator intact');
  const sessions = offlineSessionRoute(session, 'sessions');
  assert.equal(sessions.sessions.length, 1);
  assert.equal(sessions.sessions[0].current, true);
  assert.equal(sessions.recoveryRemaining, 0);
  assert.equal(offlineSessionRoute(session, 'action', {type: 'move'}), undefined, 'gameplay routes belong to the service');
});

test('password-only account security fails explicitly offline', () => {
  const session = createGuestSession(new MemoryRaidStore());
  for (const path of ['change-password', 'recovery-codes', 'revoke-session', 'recover']) {
    assert.throws(() => offlineSessionRoute(session, path, {currentPassword: 'x'}), error =>
      error instanceof RuleError && error.status === 501 && /unavailable offline/.test(error.message));
  }
});

test('a deployment through the authoritative service binds to the offline session account', () => {
  const store = new MemoryRaidStore();
  const session = createGuestSession(store);
  let clock = 1000;
  const service = new RaidService(store, {now: () => clock, owner: 'offline-owner'});
  const profile = session.profile();
  const request = {
    itemIds: [profile.items.find(it => it.kind === 'weapon').id, profile.items.find(it => it.kind === 'armor').id],
    mapId: 'relay',
    requestId: 'session-deploy-1',
    recovery: false,
    insureIds: [],
  };
  const snapshot = service.deploy(session.authenticate(), request);
  assert.equal(service.byAccount.get(session.account).account, session.account, 'the service binds the guest account to the deployment');
  assert.equal(session.profile().activeDeployment.id, snapshot.self.deploymentId);
  assert.equal(session.profile().items.length, 2, 'deployed gear leaves the stash');
  clock += 1;
  service.tick(0.05);
  service.close();
});
