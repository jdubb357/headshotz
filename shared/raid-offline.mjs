// In-page transport for the static-Pages offline raid.
//
// GitHub Pages has no Node `/api`, so the raid client needs the same
// authoritative service rules without a network hop. This module constructs the
// browser-safe MemoryRaidStore, a passwordless GuestSession, and the real
// RaidService from server/raids.mjs, then exposes an api(path, body) dispatcher
// matching the hosted routes the client already speaks. Every gameplay decision
// (damage, loot, extraction, settlement) still runs in RaidService; this file
// only moves JSON-shaped requests inside the page.
//
// It is DOM-free and imports nothing from `node:*` so Node unit tests and the
// static browser grader can exercise it directly. Online authority is untouched.
import {RuleError,requireRule} from './raid-rules.mjs';
import {RAID_PROTOCOL, validateAction} from './raid-protocol.mjs';
import {RAID_WORLDS} from './raid-worlds.mjs';
import {MATCH_POLICY,matchPreferences} from './raid-matchmaking.mjs';
import {MemoryRaidStore} from './raid-store-memory.mjs';
import {PersistentRaidStore,createFallbackSnapshotBackend} from './raid-store-persist.mjs';
import {createIndexedDbBackend} from './raid-store-idb.mjs';
import {createLocalStorageBackend} from './raid-store-local.mjs';
import {createGuestSession, offlineSessionRoute} from './raid-session.mjs';

// RaidService lives on the Node-hosted source tree but is itself node-free (the
// crypto/rules primitives were moved to shared/ in slices 2–3). Importing it
// here reuses the exact hosted rules rather than a client-trusting clone.
import {RaidService} from '../server/raids.mjs';

const OFFLINE_PARTY_MESSAGE = 'Squads, parties, and voice are unavailable in offline raid mode.';
// The base workshop (crafting, repairs, upgrades, stash transfers) runs on the
// same authoritative MemoryRaidStore rules as the hosted store. Only online-only
// authorities (traders and contracts) remain unavailable offline.

function parsePath(path) {
  const raw = String(path ?? '');
  const index = raw.indexOf('?');
  return {
    route: index < 0 ? raw : raw.slice(0, index),
    query: new URLSearchParams(index < 0 ? '' : raw.slice(index + 1)),
  };
}

function offlineSnapshot(runtime) {
  return runtime.raids.snapshot(runtime.account);
}

function buildOfflineRaidRuntime(store, { username = 'guest', now = () => Date.now() / 1000 } = {}) {
  const session = createGuestSession(store, { username });
  const raids = new RaidService(store, { now, owner: 'offline-' + session.account, region: 'local' });
  const matchInfo = { region: 'local', policy: MATCH_POLICY };
  return {
    mode: 'offline',
    persistent: store instanceof PersistentRaidStore,
    storage: () => (store instanceof PersistentRaidStore ? store.backend.getActiveName?.() || 'snapshot' : 'memory'),
    store,
    session,
    raids,
    matchInfo,
    account: session.account,
    tickTimer: null,
    flush: () => (typeof store.flushNow === 'function' ? store.flushNow() : Promise.resolve()),
    dispose() {
      if (this.tickTimer !== null) {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
      }
      raids.close();
      store.close();
    },
  };
}

// Build the in-page authority. `now` is injectable so unit tests can advance
// simulation deterministically; the page uses wall-clock seconds like Node.
export function createOfflineRaidRuntime(options = {}) {
  return buildOfflineRaidRuntime(new MemoryRaidStore(), options);
}

// Async browser factory: hydrate the durable snapshot before constructing the
// RaidService, so active checkpoints, stash and deployment records are restored
// before the client's first profile/raid request. IndexedDB is preferred, with a
// localStorage fallback when it is missing or fails to open/write. If neither
// store is available, gameplay still runs from a clean in-memory store.
export async function createPersistentOfflineRaidRuntime({ username = 'guest', now, flushDelayMs = 80, databaseName } = {}) {
  const backend = createFallbackSnapshotBackend(
    createIndexedDbBackend(databaseName ? { name: databaseName } : undefined),
    createLocalStorageBackend(),
  );
  const store = new PersistentRaidStore({ backend, flushDelayMs });
  try {
    await store.hydrate();
  } catch {
    try { await store.close(); } catch {}
    return buildOfflineRaidRuntime(new MemoryRaidStore(), { username, now });
  }
  const runtime = buildOfflineRaidRuntime(store, { username, now });
  runtime.recoveredSnapshot = store.recoveredSnapshot;
  runtime.recovery = store.recoveredSnapshot
    ? { recoveredFromCorruptSnapshot: true, ...store.recoveredSnapshot }
    : null;
  try {
    // Persist the guest account creation (and any restored-state migration)
    // before the client starts interacting. After a rejected snapshot this
    // flush replaces the quarantined save with clean state.
    await store.flushNow();
  } catch (error) {
    store.lastPersistenceError = error;
  }
  runtime.lastPersistenceError = store.lastPersistenceError;
  return runtime;
}

// Start the same 50 ms simulation loop server/main.mjs runs. Returns the timer
// so a page or test can stop it; failures are reported without tearing down the
// interval, mirroring the Node host's logging behaviour.
export function startOfflineTick(runtime, { intervalMs = 50, onError = null } = {}) {
  requireRule(runtime && runtime.raids && typeof runtime.raids.tick === 'function', 'Offline tick needs a RaidService', 500);
  if (runtime.tickTimer !== null && runtime.tickTimer !== undefined) return runtime.tickTimer;
  runtime.tickTimer = setInterval(() => {
    try {
      runtime.raids.tick(intervalMs / 1000);
    } catch (error) {
      if (onError) onError(error);
    }
  }, intervalMs);
  if (typeof runtime.tickTimer.unref === 'function') runtime.tickTimer.unref();
  return runtime.tickTimer;
}

// Route table mirroring server/main.mjs for the subset a solo offline raid
// needs. Auth/profile/results/sessions/login/register/logout are delegated to
// the guest session contract; gameplay routes go through RaidService.
export function offlineRaidRoute(runtime, path, body) {
  const { route, query } = parsePath(path);
  const payload = body === undefined || body === null ? null : body;

  const sessionValue = offlineSessionRoute(runtime.session, route, payload || {});
  if (sessionValue !== undefined) return sessionValue;

  switch (route) {
    case 'worlds':
      return RAID_WORLDS;
    case 'capabilities':
      return {
        protocol: RAID_PROTOCOL,
        region: runtime.raids.region,
        partyModes: ['solo'],
        maxPlayers: 1,
        maxOperators: runtime.raids.maxOperators,
        matchmaking: MATCH_POLICY,
        offline: true,
      };
    case 'market':
      // The memory store keeps the same stash/presets/contracts model but does
      // not implement traders; an empty market keeps the base screen usable
      // without inventing prices on the client.
      return [];
    case 'raid':
      return runtime.raids.snapshot(runtime.account, query.get('spectate') || null);
    case 'social':
      if (payload) throw new RuleError(OFFLINE_PARTY_MESSAGE, 501);
      return { scope: 'squad', controls: [], privacy: '/raid-privacy.html' };
    case 'voice':
      // Voice signalling has no offline transport. GET stays a well-formed
      // empty poll so the client can boot; enabling voice fails explicitly.
      if (payload) throw new RuleError(OFFLINE_PARTY_MESSAGE, 501);
      return { joined: false, epoch: 0, peers: [], signals: [], iceServers: [] };
    case 'party':
      // GET is how the base screen discovers it is playing solo. All mutation
      // routes are explicit offline stubs rather than silently accepted.
      if (!payload) return null;
      throw new RuleError(OFFLINE_PARTY_MESSAGE, 501);
    case 'trade':
      requireRule(payload,'Trading needs an action',400);
      return runtime.store.trade(runtime.account,payload);
    case 'matchmaking': {
      if (!payload) return runtime.matchInfo;
      if (payload.operation === 'probe') {
        return { nonce: 'offline-' + runtime.session.account + '-' + Date.now().toString(36), expires: Date.now() + 30000, offline: true };
      }
      if (payload.operation === 'measure') {
        // Offline has no transport latency to measure; report a zero RTT proof
        // so the solo deploy path (and any configured maxRtt) can proceed.
        return { proofId: 'offline-proof', rttMs: 0, withinLimit: true, allowMixed: true, offline: true };
      }
      throw new RuleError('Unknown latency operation', 400);
    }
    case 'deploy': {
      requireRule(payload && payload.protocol === RAID_PROTOCOL, 'Client update required. Reload to deploy safely.', 426);
      // Match the hosted server's preference validation without the human
      // latency probe (there is no transport to measure offline).
      try {
        matchPreferences(payload.match);
      } catch (error) {
        throw new RuleError(error.message, 400);
      }
      return runtime.raids.deploy(runtime.account, payload);
    }
    case 'action': {
      requireRule(payload && payload.protocol === RAID_PROTOCOL, 'Client update required. Reload to use the current game protocol.', 426);
      try {
        validateAction(payload, { wire: true });
      } catch (error) {
        throw new RuleError(error.message, 400);
      }
      try {
        const ack = runtime.raids.action(runtime.account, payload);
        return { ok: true, ack, ...(payload.includeState ? { state: runtime.raids.snapshot(runtime.account) } : {}) };
      } catch (error) {
        // Mirror the hosted route: when the service rejects an action it may
        // still supply the authoritative state so the client can reconcile.
        const rejected = runtime.raids.byAccount.get(runtime.account);
        if (payload.includeState && rejected && rejected.raidId === payload.raidId && rejected.deploymentId === payload.deploymentId) {
          try {
            error.state = runtime.raids.snapshot(runtime.account);
          } catch {}
        }
        throw error;
      }
    }
    default:
      throw new RuleError('Unknown endpoint', 404);
  }
}

// The client's `api(path, body)` contract is async and rejects with an Error
// carrying `status`/`ack`/`state`. The offline transport keeps that shape so
// no client call-site needs to know whether it is online.
export async function offlineRaidRequest(runtime, path, body) {
  return offlineRaidRoute(runtime, path, body);
}
