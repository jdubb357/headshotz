import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Seeded Royale crate placement and the synthesized headshot crack.
// Run: node --test tests/royale-crates.test.mjs

const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}

function api() {
  const ctx = { BRC: { secret: 7, god: 2 } };
  vm.createContext(ctx);
  vm.runInContext(section('function mulberry32(seed){', 'function brInfo(){'), ctx);
  return ctx;
}

function island() {
  const chests = [];
  let id = 0;
  const zones = [
    { x: 0, z: 0, r: 40, n: 'dunes' },
    { x: 160, z: 0, r: 40, n: 'pines' },
    { x: 0, z: 160, r: 40, n: 'city' },
    { x: 160, z: 160, r: 40, n: 'dock' },
  ];
  for (const z of zones) for (const [dx, dz] of [[0, 0], [12, 4], [-10, 8]]) chests.push({ id: id++, x: z.x + dx, y: 0, z: z.z + dz, sec: 0, god: 0, zone: z.n });
  chests.push({ id: id++, x: 900, y: 0, z: 900, sec: 0, god: 0 });
  return { chests, zones };
}

test('service worker is v102 or newer and the headshot is a noise crack', () => {
  const m = sw.match(/const CACHE='headshotz-v(\d+)'/);
  assert.ok(m && +m[1] >= 102);
  const head = section('head(){', 'headKill(){');
  assert.match(head, /highpass/);
  assert.doesNotMatch(head, /sine|square/);
  const kill = section('headKill(){', 'hurt(){');
  assert.doesNotMatch(kill, /sine|square/);
  assert.match(source, /chestSeed:E\.chestSeed/);
});

test('the same seed places the same 2 Godly and 7 Secret crates on reachable spots', () => {
  const { placeRoyaleCrates } = api();
  const a = island(), b = island();
  const A = placeRoyaleCrates(a.chests, a.zones, 20261108, 400);
  const B = placeRoyaleCrates(b.chests, b.zones, 20261108, 400);
  assert.deepEqual(A, B);
  assert.equal(A.god.length, 2);
  assert.equal(A.secret.length, 7);
  const chosen = new Set([...A.god, ...A.secret]);
  assert.equal(chosen.size, 9);
  assert.equal(chosen.has(12), false, 'spot outside the island is not used');
  const zoneOf = id => a.chests.find(c => c.id === id).zone;
  const zones = new Set([...A.god, ...A.secret].map(zoneOf));
  assert.ok(zones.size >= 3, 'crates spread across biomes: ' + [...zones].join(','));
  const other = placeRoyaleCrates(island().chests, island().zones, 7, 400);
  assert.notDeepEqual(other.god.concat(other.secret), A.god.concat(A.secret));
});
