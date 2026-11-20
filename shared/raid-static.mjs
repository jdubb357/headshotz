// Static Pages offline-mode detection for the Extraction Raid client.
//
// Online Node hosts inject <meta name="headshotz-raid-service" content="1"> into
// index.html (server/main.mjs) and serve /api. GitHub Pages serves the same files
// with no meta and no API. The raid client must make one deterministic transport
// decision before it talks to the authority; offline mode is an in-page copy of
// the same RaidService rules, not a substitute for hosted authority.
//
// This module intentionally has no DOM imports at module load: Node unit tests and
// the static-file browser grader import it directly. The browser pass reads the
// meta tag through `readServiceMeta`, which tolerates a missing document.
//
// Signal precedence (first match wins):
//   1. `offline=1` in the query string  -> offline ("offline-query")
//   2. no Node-injected service meta    -> offline ("no-service-meta")
//   3. /api/profile probe reported failed -> offline ("profile-unreachable")
//   4. otherwise                         -> online  ("service-meta")
// An unchecked probe (`unchecked`, the default) never forces offline; only an
// explicit failure becomes a static-mode signal.

export const SERVICE_META_NAME = 'headshotz-raid-service';
export const SERVICE_META_SELECTOR = `meta[name="${SERVICE_META_NAME}"]`;

const OFFLINE_QUERY = /[?&]offline=1(?:&|$)/;

export function isOfflineQuery(search = '') {
  return OFFLINE_QUERY.test(String(search || ''));
}

// Browser helper: true only when the current document really has the Node-injected
// meta. A null/undefined document (Node, worker, or an early boot probe) is treated
// as missing so callers fall back to online only when they can prove it.
export function readServiceMeta(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof doc.querySelector !== 'function') return false;
  return !!doc.querySelector(SERVICE_META_SELECTOR);
}

// `profileProbe` is one of:
//   'unchecked'  -> not probed yet (default)
//   'reachable'  -> /api/profile answered
//   'failed'     -> network error, non-JSON response, 404/503 or similar
// Boolean false is accepted as a failed probe for convenience.
export function detectRaidMode({ search = '', serviceMeta = true, profileProbe = 'unchecked' } = {}) {
  if (isOfflineQuery(search)) return { mode: 'offline', reason: 'offline-query' };
  if (serviceMeta === false) return { mode: 'offline', reason: 'no-service-meta' };
  if (profileProbe === 'failed' || profileProbe === false) return { mode: 'offline', reason: 'profile-unreachable' };
  return { mode: 'online', reason: 'service-meta' };
}

export function isStaticRaidMode(options = {}) {
  return detectRaidMode(options).mode === 'offline';
}

// Browser convenience wrapper. `env` defaults to the real window globals but can be
// supplied by tests: { document, location: { search } }.
export function browserRaidMode(env) {
  const documentRef = env && 'document' in env ? env.document : typeof document === 'undefined' ? null : document;
  const search = env && env.location && typeof env.location.search === 'string' ? env.location.search : typeof location === 'undefined' ? '' : location.search;
  return detectRaidMode({ search, serviceMeta: readServiceMeta(documentRef) });
}
