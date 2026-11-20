// Opt-in raid squad roles. Each role is chosen when a party member readies and
// applies only to that deployment; solo operators and other modes are unchanged.
export const SQUAD_ROLES={
 scout:{label:'Scout',summary:'Squad pings last 30 seconds instead of 20.',pingSeconds:30},
 medic:{label:'Medic',summary:'Reviving a squadmate takes 3.5 seconds instead of 5.',reviveSeconds:3.5},
 engineer:{label:'Engineer',summary:'Locked doors can be picked without spending a key.'},
 hauler:{label:'Hauler',summary:'Backpack holds 4 more slots and 8 kg more carry weight.',packBonus:4,weightBonus:8}
};
export const SQUAD_ROLE_IDS=Object.keys(SQUAD_ROLES);
export function squadRole(value){return typeof value==='string'&&Object.hasOwn(SQUAD_ROLES,value)?value:null}
export function roleLabel(value){const role=squadRole(value);return role?SQUAD_ROLES[role].label:null}
export function roleSummary(value){const role=squadRole(value);return role?SQUAD_ROLES[role].summary:null}
export function pingSecondsFor(role){return role==='scout'?SQUAD_ROLES.scout.pingSeconds:20}
export function reviveSecondsFor(role){return role==='medic'?SQUAD_ROLES.medic.reviveSeconds:5}
export function engineerPicks(role){return role==='engineer'}
// Authoritative deployment capacities. The hauler role deepens the backpack and
// weight budget on top of whichever baseline the deployment uses; invalid roles
// and solo deployments fall back to the baseline.
export function packCapacityFor(role,recovery){return (recovery?8:18)+(squadRole(role)==='hauler'?SQUAD_ROLES.hauler.packBonus:0)}
export function weightCapacityFor(role,recovery){return (recovery?22:40)+(squadRole(role)==='hauler'?SQUAD_ROLES.hauler.weightBonus:0)}
