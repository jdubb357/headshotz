import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dressBld } from '../br.js';

const src = readFileSync(new URL('../br.js', import.meta.url), 'utf8');

function fake() {
  const cols = [];
  const parts = [];
  const B = {
    box(x, y, z, w, h, d, c, tex, o) {
      parts.push(tex || 'concrete');
      if (!o || o.solid !== false) cols.push(1);
    },
    glow() { parts.push('glow'); },
  };
  return { B, cols, parts };
}

test('building dress is visual only and themes the facade', () => {
  assert.match(src, /dressBld\(B,/);
  const full = fake();
  dressBld(full.B, { x: 0, z: 0, w: 12, d: 9, h: 5.8, c: 0xe8dcc8, tex: 'plaster', door: 's', dg: 2.1, y: 0 }, false);
  assert.equal(full.cols.length, 0);
  assert.ok(full.parts.includes('window'));
  assert.ok(full.parts.includes('glow'));
  assert.ok(full.parts.length > 12);
  const low = fake();
  dressBld(low.B, { x: 0, z: 0, w: 12, d: 9, h: 5.8, c: 0x9ba3ab, tex: 'metal', door: 's', dg: 4, y: 0 }, true);
  assert.equal(low.cols.length, 0);
  assert.ok(low.parts.length < full.parts.length);
  assert.ok(low.parts.includes('metal'));
});
