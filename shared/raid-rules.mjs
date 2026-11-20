// Browser-safe authoritative rule primitives.
//
// The Node store and the in-page offline raid service must reject the same
// invalid states with the same messages. Keeping RuleError/requireRule/item here
// (with no node:* imports) means the authoritative service can load in a static
// browser page while server/rules.mjs remains a thin re-export for Node callers.
import {randomUUID} from './raid-crypto.mjs';
import {WEAPONS} from './raid-catalog.mjs';

export class RuleError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export const requireRule = (value, message, status) => {
  if (!value) throw new RuleError(message, status);
};

export const item = (kind, extra = {}) => ({
  id: randomUUID(),
  kind,
  condition: 100,
  quantity: 1,
  ...(kind === 'weapon' ? {loaded: WEAPONS[extra.weapon]?.mag || 30, attachments: []} : {}),
  ...extra,
});
