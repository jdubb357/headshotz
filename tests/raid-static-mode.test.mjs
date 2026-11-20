import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_META_SELECTOR,
  detectRaidMode,
  isOfflineQuery,
  isStaticRaidMode,
  readServiceMeta,
  browserRaidMode,
} from '../shared/raid-static.mjs';

test('offline=1 in the query wins even when the Node service meta is present', () => {
  assert.equal(isOfflineQuery('?offline=1'), true);
  assert.equal(isOfflineQuery('?a=1&offline=1&b=2'), true);
  assert.equal(isOfflineQuery('?offline=0'), false);
  assert.equal(isOfflineQuery('?offline=10'), false);
  assert.equal(isOfflineQuery(''), false);
  const decision = detectRaidMode({ search: '?offline=1', serviceMeta: true });
  assert.deepEqual(decision, { mode: 'offline', reason: 'offline-query' });
});

test('a Node host that injects the service meta is online by default', () => {
  assert.deepEqual(detectRaidMode({ serviceMeta: true }), { mode: 'online', reason: 'service-meta' });
  assert.equal(isStaticRaidMode({ serviceMeta: true }), false);
});

test('a missing Node-injected service meta means static Pages mode', () => {
  assert.deepEqual(detectRaidMode({ serviceMeta: false }), { mode: 'offline', reason: 'no-service-meta' });
  assert.equal(isStaticRaidMode({ serviceMeta: false }), true);
});

test('an explicit failed profile probe downgrades an online host to offline, but unchecked does not', () => {
  assert.equal(isStaticRaidMode({ serviceMeta: true, profileProbe: 'unchecked' }), false);
  assert.equal(isStaticRaidMode({ serviceMeta: true, profileProbe: 'reachable' }), false);
  assert.equal(isStaticRaidMode({ serviceMeta: true, profileProbe: 'failed' }), true);
  assert.equal(isStaticRaidMode({ serviceMeta: true, profileProbe: false }), true);
  assert.deepEqual(detectRaidMode({ serviceMeta: true, profileProbe: 'failed' }), { mode: 'offline', reason: 'profile-unreachable' });
});

test('readServiceMeta tolerates missing documents and fake selectors', () => {
  assert.equal(readServiceMeta(null), false);
  assert.equal(readServiceMeta(undefined), false);
  assert.equal(readServiceMeta({}), false);
  const found = readServiceMeta({ querySelector: selector => selector === SERVICE_META_SELECTOR ? {} : null });
  assert.equal(found, true);
  const missing = readServiceMeta({ querySelector: () => null });
  assert.equal(missing, false);
});

test('browserRaidMode reads a fake window without touching the global DOM', () => {
  const offlineEnv = {
    document: { querySelector: () => null },
    location: { search: '' },
  };
  assert.deepEqual(browserRaidMode(offlineEnv), { mode: 'offline', reason: 'no-service-meta' });
  const onlineEnv = {
    document: { querySelector: selector => selector === SERVICE_META_SELECTOR ? {} : null },
    location: { search: '?prof=abc' },
  };
  assert.deepEqual(browserRaidMode(onlineEnv), { mode: 'online', reason: 'service-meta' });
  const forcedEnv = {
    document: { querySelector: () => ({}) },
    location: { search: '?offline=1' },
  };
  assert.deepEqual(browserRaidMode(forcedEnv), { mode: 'offline', reason: 'offline-query' });
});

test('online and offline decisions are pure and repeatable', () => {
  const input = { search: '?offline=1', serviceMeta: true, profileProbe: 'reachable' };
  const first = detectRaidMode(input);
  const second = detectRaidMode(input);
  assert.equal(first.mode, 'offline');
  assert.deepEqual(first, second);
  assert.deepEqual(input, { search: '?offline=1', serviceMeta: true, profileProbe: 'reachable' });
});
