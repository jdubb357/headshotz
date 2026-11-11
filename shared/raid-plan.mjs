// Device-local deploy plan for the static offline base: the sector and the
// optional field objective the operator intends to raid next. This only
// prefills the Deploy card; it is never authority. The deploy route validates
// the sector and objective again and every settlement/loot decision stays in
// the in-page RaidService.
//
// A plan is discarded unless its sector exists and its objective is authored
// for that sector, so a stale save cannot prefill an id the service rejects.
import {objectivesFor} from './raid-objectives.mjs';

export const RAID_PLAN_KEY = 'headshotz:raid-plan-v1';

function usableStorage(storage) {
  return !!storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

export function resolveRaidPlan(value, worlds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!Array.isArray(worlds) || typeof value.mapId !== 'string') return null;
  const world = worlds.find(candidate => candidate.id === value.mapId);
  if (!world) return null;
  let objective = null;
  if (typeof value.objective === 'string' && /^[a-z0-9-]{1,80}$/.test(value.objective) && objectivesFor(world).some(item => item.id === value.objective)) objective = value.objective;
  return {mapId: world.id, objective};
}

export function readRaidPlan(storage, worlds) {
  if (!usableStorage(storage)) return null;
  try {
    const raw = storage.getItem(RAID_PLAN_KEY);
    if (!raw) return null;
    return resolveRaidPlan(JSON.parse(raw), worlds);
  } catch {
    return null;
  }
}

export function writeRaidPlan(storage, plan, worlds) {
  const resolved = resolveRaidPlan(plan, worlds);
  if (!usableStorage(storage) || !resolved) return false;
  try {
    storage.setItem(RAID_PLAN_KEY, JSON.stringify(resolved));
    return true;
  } catch {
    return false;
  }
}
