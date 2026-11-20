import test from 'node:test';
import assert from 'node:assert/strict';
import {RAID_WORLDS} from '../shared/raid-worlds.mjs';
import {objectivesFor} from '../shared/raid-objectives.mjs';
import {RAID_PLAN_KEY,readRaidPlan,resolveRaidPlan,writeRaidPlan} from '../shared/raid-plan.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const definition = objectivesFor(RAID_WORLDS[0])[0];

test('a plan resolves only when its sector and objective are authored', () => {
  assert.deepEqual(resolveRaidPlan({mapId: definition.map, objective: definition.id}, RAID_WORLDS), {mapId: definition.map, objective: definition.id});
  assert.deepEqual(resolveRaidPlan({mapId: definition.map, objective: null}, RAID_WORLDS), {mapId: definition.map, objective: null});
  assert.equal(resolveRaidPlan({mapId: 'missing', objective: null}, RAID_WORLDS), null, 'unknown sectors are discarded');
  assert.deepEqual(resolveRaidPlan({mapId: definition.map, objective: 'relay-field-missing'}, RAID_WORLDS), {mapId: definition.map, objective: null}, 'unknown objectives drop the objective only');
  assert.equal(resolveRaidPlan({mapId: definition.map, objective: 'Bad Id'}, RAID_WORLDS).objective, null, 'unsafe ids are discarded');
  assert.equal(resolveRaidPlan({mapId: definition.map, objective: RAID_WORLDS[1] && objectivesFor(RAID_WORLDS[1])[0]?.id || 'x'}, RAID_WORLDS).objective, null, 'objective ids are scoped to their sector');
  assert.equal(resolveRaidPlan(null, RAID_WORLDS), null);
  assert.equal(resolveRaidPlan({mapId: definition.map}, null), null);
});

test('read/write round-trips through storage and survives malformed values', () => {
  const storage = memoryStorage();
  assert.equal(writeRaidPlan(storage, {mapId: definition.map, objective: definition.id}, RAID_WORLDS), true);
  assert.deepEqual(JSON.parse(storage.getItem(RAID_PLAN_KEY)), {mapId: definition.map, objective: definition.id});
  assert.deepEqual(readRaidPlan(storage, RAID_WORLDS), {mapId: definition.map, objective: definition.id});
  storage.setItem(RAID_PLAN_KEY, '{not json');
  assert.equal(readRaidPlan(storage, RAID_WORLDS), null, 'a damaged save falls back to no plan');
  storage.setItem(RAID_PLAN_KEY, JSON.stringify({mapId: 'gone'}));
  assert.equal(readRaidPlan(storage, RAID_WORLDS), null, 'a stale sector falls back to no plan');
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(readRaidPlan(broken, RAID_WORLDS), null);
  assert.equal(writeRaidPlan(broken, {mapId: definition.map}, RAID_WORLDS), false);
  assert.equal(readRaidPlan(null, RAID_WORLDS), null);
  assert.equal(writeRaidPlan(null, {mapId: definition.map}, RAID_WORLDS), false);
});
