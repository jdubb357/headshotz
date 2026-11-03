# Raid progression and ordinary-mode isolation

Persistent raid progression opens equipment choices and base services. It grants no passive health, damage, movement, magazine, regeneration, shield, scanner or revival bonus. All equipment still has to be owned, carried, paid for and put at risk. COMBAT.md and ECONOMY.md define the field/economy rules; the full release acceptance list remains in RELEASE_ACCEPTANCE.md.

## Experience and ranks

A normal raid grants 20 XP for extraction plus up to 50 XP from machine defeats (5 each) and unique explored cache sites (3 each). Nearby squad members share the existing machine facts. Player kills do not award a separate XP bonus. Aborted deployments grant no XP. Contracts award their authored XP only when their stage reward is claimed, once. Raid rewards/facts and contract claims remain server transactions; a client cannot submit XP, rank or a reward multiplier.

| Rank | Name | Total XP | Newly available weapon assembly |
| --- | --- | ---: | --- |
| 1 | Wayfarer | 0 | Existing equipment, shops and non-rank recipes remain available |
| 2 | Salvager | 60 | Sidearm |
| 3 | Surveyor | 160 | Assault rifle, compact SMG |
| 4 | Pathfinder | 320 | Pump shotgun |
| 5 | Specialist | 560 | Scout rifle |
| 6 | Veteran | 900 | Rank title; progress toward Quartermaster |
| 7 | Quartermaster | 1,400 | Support gun |

The base shows current rank/XP and the XP remaining to the next rank. Craft buttons show required rank, workbench level, credits and materials. Locked blueprints are visible but disabled; a direct request is rejected by the server before consuming anything. New raid reports freeze the XP/rank before and after settlement and any newly unlocked blueprints. Later contract claims do not rewrite an old raid report. Replaying a settled result does not award XP or unlocks twice.

## Assembly costs and ownership

| Assembly | Workbench | Credits | Materials |
| --- | ---: | ---: | --- |
| Sidearm | 0 | 18 | 3 steel, 1 wire |
| Assault rifle | 1 | 25 | 5 steel, 2 wire, 1 fuel |
| Compact SMG | 1 | 30 | 5 steel, 3 wire |
| Pump shotgun | 1 | 35 | 6 steel, 2 wire, 2 fuel |
| Scout rifle | 2 | 55 | 9 steel, 4 wire, 3 fuel |
| Support gun | 2 | 65 | 12 steel, 4 wire, 4 fuel |

Assembly creates a new canonical equipment instance at full condition with its ordinary magazine. It has the same base stats as the corresponding bought/looted weapon. Rank does not upgrade an existing gun, provide free ingredients, waive station requirements or make gear permanent. The normal material/credit source rules apply: earned inputs are used first; any starter-funded fee/material binds the output to its original operator. Stale stash revisions and failed durable writes cannot consume twice, duplicate output or lose ingredients.

Existing trader reputation unlocks, ordinary recipes, inventory and saves are preserved. New players can still buy the existing equipment and use the free recovery kit. Recovery equipment keeps its eight backpack/one protected slot/22 kg limits; paid deployments keep 18/two/40 kg. Stash/workbench/repair-bay upgrades do not enlarge the field backpack or increase field combat stats.

These are authored initial thresholds/costs. The static economy audit includes all new craft/sell and craft/recycle/sell paths and finds no positive resale loop. Human progression speed, reliable salvage supply, weapon-crafting substitution for trader stock, long-term farming and practical balance remain acceptance work. ECONOMY_MODEL.md describes the buying-only stock assumptions; those are not a simulation of blueprint manufacturing.

## Ordinary-mode power audit

The ordinary game reads its device-local wallet/progression in game.js. The raid authority never imports that game state or the PeerJS hit/ability handlers. The raid account's canonical items/XP and server catalog are the sources of field power. Client models may reuse existing art builders, but model appearance is not a health/damage/inventory authority.

| Ordinary system | Existing effect | Persistent raid policy/evidence |
| --- | --- | --- |
| Soldier/scout/engineer/ninja/medic/juggernaut classes | Jump/slide, extra utility, speed/noise, regeneration/shorter revives or 140 health | No class selection or class modifiers enter raid deployment. New bodies start at 100 health; normal jump velocity is 6, unarmored movement 5 and revival takes five uninterrupted seconds. Armor/injury/carry rules still apply. |
| Sidekick abilities | Guard damage, scanning/tracking, speed, luck, healing, shields, loot magnet, decoys and diamonds | No sidekick actor, passive effect or ability action in the persistent authority. Legacy pet fields/peer messages cannot grant effects or reveal raid enemies. |
| Weapon upgrades | Arena extended magazines and faster reload | Raid magazines/reloads come from the owned weapon and compatible installed attachment. A real extended-magazine attachment changes AR capacity from 30 to 38; arena upgrade data does not. |
| Diamond wallet, skins and permanent ownership | Ordinary purchases/cosmetics/classes/pets | No conversion into raid currency, XP or equipment. Raid loss cannot remove the ordinary wallet/cosmetic records. Current raid character presentation is separate; no permanent-cosmetic import is being promised. |
| XP, reputation and station upgrades | Raid unlock/economy choices | No passive stat multiplication. Rank blueprints, trader discounts/stock and base services still require ordinary owned-item transactions. |
| Item rarity label | Equipment presentation/loot differentiation | The label alone does not multiply damage, magazine size or reload. Weapon definition, condition and compatible attachment determine those stats. |

Core action validation rejects legacy ability/peer-hit messages and forged fire modifiers. Deployment normalization does not copy class, pet, wallet, HP, upgrade or ability fields into the actor. server/raids.mjs, server/raid-medical.mjs, shared/raid-catalog.mjs and shared/raid-combat.mjs own the actual rules. The server/shared source graph contains no ordinary PROG/PCL/PETS/localStorage dependency.

`tests/raid-isolation.test.mjs` covers forged legacy powers, equal novice/veteran field stats, recovery caps, standard healing/revival, item modifiers and invalid actions. `tests/raid-ranks.test.mjs` covers thresholds, gates, costs, ownership, rollback, settlement replay and rank-aware station modeling. `tests/raid-browser-ranks.mjs` exercises XP → unlock → owned crafting → deployment through real controls. `tests/raid-browser-legacy.mjs` loads an ordinary profile with juggernaut, a medic pet and maximum AR magazine/reload upgrades, verifies an ordinary 100-health/30-round raid deployment and checks that the old wallet/class/pet/upgrades survive returning to the main game. Fixtures and evidence are not an exhaustive human/remote legacy regression.
