# Sector salvage, recovery contracts and changing conditions

The persistent raid service now gives each authored sector its own salvage identity, recovery artifact and two-stage contract. These are gameplay implementations with automated and isolated-browser evidence. Human route/encounter/economy balance, finished presentation and release acceptance remain open.

## Sector identities

| Sector | Salvage emphasis | Recovery objective | Contract |
| --- | --- | --- | --- |
| Relay Graveyard | Wire, light/medium ammunition, compact weapons and optics | Relay telemetry core in the Sealed relay vault; find/bring a key to open it | **Recover the Silent Relay:** survey three distinct Relay caches, claim that stage, then deliver the recovered core to Scrapwright |
| Dry Reservoir | Chemicals, medicine, field ammunition and survival supplies | Intake water sample in Tower equipment | **A Drink of Tomorrow:** extract the sample, claim that stage, then deliver the same owned sample to Field Medic |
| Ember Switchyard | Steel, fuel, heavy ammunition and support weapons | Freight dispatch ledger in the Depot roof strongbox; use the depot's vertical routes | **The Missing Freight:** destroy three machines in this sector, claim that stage, then deliver a recovered ledger to the Outfitter |

The original five contracts remain available. New contracts must be accepted before their fact-driven stage can progress. Unaccepted contracts do not retroactively credit earlier raids. Delivery stages can use an artifact already recovered and kept in the stash. Exploration counts distinct sites in the specified sector; machine stages use kills in the specified sector. Nearby living squadmates share machine credit, as in the existing combat contracts.

Loot tables use different weighted material, ammunition and weapon pools. Tier/vault containers offer stronger valuables, weapon attachments and salvaged weapons with condition between 65 and 100. Reservoir containers also provide extra medical opportunities. Each authored raid has one artifact instance at its designated site, a key opportunity at the first cache, and at least two fuel at cache 7 so the freight-winch route remains viable. These guarantees describe opportunities, not unopposed ownership: containers and the single artifact can be contested.

The actual cache rolls use a private server seed distinct from the public raid ID. Neither that seed nor unopened contents are in snapshots. Item instances and rolled cache contents are checkpointed; reconnect/restart does not reroll them. Sector definitions and suggested routes are public planning information. Authoritative ownership, distance, line of sight, search timers, slots, weight and stack limits still control taking items.

## Artifact risk and delivery

Recovery artifacts are unique item instances with server-created sector/raid provenance. They weigh 0.8 kg and cannot stack, enter protected storage, or be carried into another raid. They must leave the world through successful extraction. Death loses the unsecured artifact; a rival who takes it and extracts can earn their own accepted contract credit. Picking it up, leaving the play screen or dying does not grant extraction credit.

An artifact is reserved from individual selling, bulk selling and recycling until its associated contract is complete, including when that contract has not yet been accepted. The stash explains that reservation and disables sale/recycle/loadout selection. The server enforces the same protections independently. Presets cannot include artifacts. Explicit contract delivery consumes the required owned stash instance; it is not a credit based on a client-supplied item count. Resolve overflow before delivery if the item is in protected overflow storage.

Raid records retain the contract progress earned in that raid, including stage requirement completion; later claims do not rewrite that historical report. Stage claims and deliveries are separate transactions. Delivery consumes the artifact once; claiming pays that stage once. Failed writes preserve the item, credits and stage progress. Spare artifacts can be sold after the associated contract is complete; completing a contract does not make it repeatable.

## Day, night and weather

New raids save an authoritative environment plan: starting sector hour, a 6.5-hour daylight progression over the ten-minute raid, and a weather front at five minutes. Start profiles include daytime, dusk, overnight and dawn deployments. The sector clock is accelerated gameplay time; it is not the player's wall clock. Different starts deliberately produce different visibility during an expedition.

Ambient/directional light, sky/fog colors, fog distance, sun/moon positions and static stars follow the sector clock. Rendering smooths changes; it does not decide gameplay visibility. Optional weather particles remain suppressed by reduced-motion settings. Daylight continues to matter when reduced motion is enabled, because it affects the world rules rather than cosmetic motion alone.

Weather/lighting affect machine detection range and server filtering of distant rivals/machines. Squad positions remain shared. Attack telegraphs outside the observer's visibility/line of sight are filtered rather than revealing a hidden rival's attack point. A weather warning arrives up to 30 seconds before the front, and period/front changes have text captions. The HUD and status-announcement command include the sector clock/conditions. Plans, warning flags and transitions survive checkpoints without replaying old announcements.

Older checkpoints keep their existing cache rolls and legacy weather policy. They are not given new artifacts, rerolled loot or a new clock. Geometry versions remain explicit; unknown versions reject rather than silently substituting the latest layout.

## Data compatibility and verification

Schema 6 is a compatibility boundary for the new item/contract semantics. Upgrading older supported data does not rewrite existing accounts, inventory, session/recovery credentials or checkpoint policies. Startup refuses migration when an unexpired simulation lease exists. Stop/drain the old process using OPERATIONS.md before upgrading. Pre-v6 server code must not reopen v6 data; its supported-schema check should reject it. Do not lower the version marker to bypass that check.

Backup tooling supports schemas 3–9, including the later utility-item, matching-consent and combat boundaries. On restore it clears the lease in the verified private copy before migration; it does not clear the live source lease. Migration/restore tests preserve owned gear and legacy checkpoints, retain account/recovery access, and verify source isolation. Unsupported newer schemas and geometry versions fail closed; a failed map-version startup releases its own lease without compensating or replacing the unsupported active deployment.

`tests/raid-sectors.test.mjs` covers private deterministic loot, distinct distributions, stack bounds, authored artifact sites, map-specific facts, actual contested ownership/extraction, protected sales/delivery, rollback, restart, night visibility, machine detection and warning deduplication. `tests/raid-content-migration.test.mjs` covers v5 preservation, live-lease refusal and unknown geometry. Existing account, backup and process-recovery tests run against the current schema (now v9 for combat rules, following matching consent and utility effects).

`tests/raid-browser-sectors.mjs` verifies sector briefing, rendered day/night/moon/stars, searching and taking the sample, extraction, stash sale/loadout protection, filtering, delivery, reward-replay rejection and progress after reload. Screenshots were inspected. Its private fixtures arrange time, positions and an available exit; this does not prove human navigation or balanced survival. Practical device/network/content playtests, combat/loot-heavy capacity and the remaining issue #1 acceptance gates are still required.

## Traversable layout versions

New deployments use layout version 3, with roof landings placed at ramp tops. Version-2 layouts remain archived byte-for-byte for existing checkpoints; version 1 also remains supported. Shared navigation checks physical ramp clearance, step height, platform support and traversable start connections. Automated movement routes cover every spawn to every current cache/exit and all archived roof approaches. This verifies reachability, not combat fairness or route balance.

Platform support uses the operator footprint at edges so descending a catwalk onto a ramp cannot drop the body into the platform side. Matching navigation and actual simulation checks cover cache-to-exit routes and measured mid-ramp stall positions. Ground machines use their own footprint radius for the same descent support.

## Character geometry lifetime

Persistent raid/base characters use an isolated procedural geometry cache. Live actors with the same appearance share geometry; the last actor releasing that appearance frees its GPU allocation. A bounded least-recently-used cache keeps at most 112 idle CPU geometries so recent appearances can return without rebuilding their meshes; older idle entries are evicted. Tags, weapons and other owned resources retain their separate disposal rules. Instanced environment meshes also dispose their per-instance GPU buffers, independently of their shared geometry. Returning to base or signing out clears the field scene, render lists and field audio; the WebGL context is reused on re-entry. Clearing local graphics does not extract, protect or replace the server-owned operator. Operator identity and appearance generation are unchanged. The default ordinary-mode character cache remains separate and is not disposed by raid cleanup.

`tests/raid-browser-render-resources.mjs` measures repeated visible-operator replacement with the real WebGL renderer and checks live sharing, final release and ordinary-cache isolation. `tests/raid-browser-performance.mjs` measures all three authored maps at desktop and mobile-sized viewports using declared development frame/CPU targets and an explicit pixel ratio. These are renderer fixtures on the measured workstation, not physical mobile hardware, whole-client performance or human presentation acceptance.
