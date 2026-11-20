// Passwordless guest session for the static-Pages offline raid.
//
// Online identity is an HttpOnly `raid_session` cookie backed by a scrypt
// password (server/main.mjs, server/store.mjs, server/credentials.mjs). A static
// GitHub Pages host can deliver neither, so offline identity is the in-memory
// store's guest account: no password, token, cookie, or scrypt. This module is
// DOM-free and free of `node:*` imports so the in-page dispatcher can import it
// directly, while the online register/login/cookie path stays exactly as it is.
//
// The session is a thin identity contract over the store. Raid rules still run
// through the authoritative RaidService in the page; this module never decides
// damage, loot, or extraction.
import {RuleError,requireRule} from './raid-rules.mjs';

const normalizeUsername = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 24) || 'guest';

const OFFLINE_SECURITY_MESSAGE = 'Passwords and account security are unavailable offline.';

export class GuestSession {
  constructor(store, { username = 'guest' } = {}) {
    requireRule(
      store && typeof store.createGuest === 'function' && typeof store.profile === 'function',
      'Offline session needs a raid store with createGuest/profile',
      500,
    );
    this.store = store;
    this.username = normalizeUsername(username);
    this.account = this.store.createGuest(this.username).id;
  }

  // Same contract the online server exposes after authenticating a cookie:
  // the account id, then that account's authoritative profile.
  authenticate() {
    return this.account;
  }

  profile() {
    return this.store.profile(this.account);
  }

  results() {
    return this.store.results(this.account);
  }

  // Online lists cookie-backed sessions; offline the implicit guest session is
  // always the current one and recovery codes do not exist.
  sessions() {
    return {
      sessions: [{ id: 'offline-guest', label: 'Offline operator', created: 0, seen: 0, expires: 0, current: true }],
      recoveryRemaining: 0,
    };
  }

  // Offline sign-in and registration are the same operation: claim the named
  // local guest, creating it with starter gear if it does not exist yet. The
  // password the online form sends is deliberately ignored.
  signIn(username = this.username) {
    this.username = normalizeUsername(username);
    this.account = this.store.createGuest(this.username).id;
    return this.profile();
  }

  // Signing out ends the UI session; the local operator and stash remain available
  // to sign back in, matching online logout (the account persists, only the cookie
  // session is revoked).
  logout() {
    return { ok: true };
  }
}

export function createGuestSession(store, options) {
  return new GuestSession(store, options);
}

// Session-owned route contract for the in-page dispatcher (slice 6). Returns the
// response value for auth/profile routes and `undefined` for everything else so
// raid gameplay routes stay owned by RaidService. Password-only account-security
// routes fail explicitly instead of pretending to work offline.
export function offlineSessionRoute(session, path, body = {}) {
  switch (path) {
    case 'profile':
      return session.profile();
    case 'results':
      return session.results();
    case 'sessions':
      return session.sessions();
    case 'login':
    case 'register':
      return session.signIn(body.username);
    case 'logout':
      return session.logout();
    case 'change-password':
    case 'recovery-codes':
    case 'revoke-session':
    case 'recover':
      throw new RuleError(OFFLINE_SECURITY_MESSAGE, 501);
    default:
      return undefined;
  }
}
