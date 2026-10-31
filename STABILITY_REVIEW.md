# Recorded-stall and failed-action review

The historical two-hour schema-8/protocol-5 load remains preserved in tests/evidence/2026-10-30-two-hour-soak.json. It recorded 42 controller stalls and three unclassified action rejections. Later passing runs do not replace those observations. Commands below run from the source checkout; runtime packages omit development harnesses and datasets.

## Physical replay

Run `node scripts/replay-raid-stalls.mjs --report tests/evidence/2026-10-30-two-hour-soak.json --out NEW_FILE`. It replays the recorded positions on version-3 geometry, whose source hash matches the original run, with both original movement speed and current heavy armor plus a leg injury.

| Check | Result |
| --- | --- |
| Recorded poses | 42 |
| Known static destinations, two movement profiles | All 80 reachable through current physics and fresh navigation |
| Original immediate waypoint, direct movement | 82 reachable; two blocked cases are the same ramp-side pose under both profiles |
| Controller following/recovering the original immediate waypoint | All 84 reachable without a stall timeout after the correction |
| Dynamic full destinations | Two machine-salvage positions were not recorded; four full-route replays remain unavailable |

The blocked segment starts at `(-44.017898565, 0, 27.401471475)` in Ember Switchyard and aims at `(-44, 0.68, 28)`. The operator is outside the north side of an X-axis ramp. Entering sideways would exceed the supported step height. The terrain correctly rejects that movement; a valid route approaches the ramp's low end around `(-46, 28)`.

The controller previously retained the recorded waypoint and waited about three seconds before counting a stall and replanning. A regression reproduces that extra stall before the fix. It now checks the next segment using the same geometric traversal rules as pathfinding and immediately discards an invalid segment. Fresh continuous-position checks are not memoized into an ever-growing edge cache. Shared pathfinding keeps its existing grid-edge cache and rules; terrain, movement speed and collision limits are unchanged.

This demonstrates a recoverable stale-segment problem. Original velocity, complete paths, combat interruptions and packet timing are missing. The replay cannot establish the exact cause of every old stall or reconstruct the two missing dynamic destinations. The earlier combat/treatment pause-clock correction is not retroactively assigned as their cause.

## Rejected actions after lost success responses

An action may commit while all three response attempts are lost. The server keeps the receipt, consumes once and returns current state on a later rejected command. Two tests exercise that sequence through the real action service and reliable client:

- A thrown utility commits once. A new throw from the stale client can correctly fail with `Utility not ready`; the utility is not consumed again.
- A protected transfer commits once. A stale client that still sees an empty pocket can correctly fail with `Protected pocket full`; the owned items remain unique.

These reproductions are plausible mechanisms for the old action types, not proof of the old three messages. Their exact causes remain unexplained. Recognized utility cooldowns and state-confirmed pocket-capacity changes are counted in gameplay rejections and still participate in the rejection-rate gate. Inconsistent capacity errors, malformed/stale sequences and other unexpected failures are not reclassified as harmless races.

## Prospective diagnostics

The load report's `failureDiagnostics` field records reviewed reason labels, action type, status, elapsed time and selected client-observed state before/after a failure. It includes inventory counts/capacities, owned item kind/quantity and public geometry; it excludes credentials, raw errors, usernames, account/deployment/item IDs, arbitrary labels and request bodies. Unknown errors retain an `unrecognized_rule` label rather than their contents. After a transport failure with no response state, the after view is still the last client-observed view; it does not prove that the server rejected or rolled back the action.

Budgets are separate: at most eight transport, eight recognized, 24 unexpected-rule and eight server-error samples per client, with at most two samples per key. Counts cap at 256 keys and preserve overflow counts. Packet loss cannot fill the unexpected-rule budget before a rare late failure. Tests inject secret-like strings and excessive errors to verify redaction and bounds.

The original three unclassified failures remain in their original evidence. No missing original message, target or outcome is invented. Current-build multi-hour, real-network/device and human-play acceptance remain open in RELEASE_ACCEPTANCE.md.

## Verification boundary

The first 180-second impaired follow-up failed the complete-loop gate because no extraction finished before cutoff; it also counted 43 failed searches without retaining their positions. That report remains in tests/evidence/2026-10-30-gameplay-load.json. It is not relabeled as passing because the unit replays pass. The next run records bounded failed-search poses and full target positions, including dynamic targets, to distinguish airborne/unsupported states from actual route barriers.

The 300-second follow-up completed eight extractions and passed its declared gates, while preserving four failed searches. Three were airborne poses. The fourth was a grounded position at `(38.768601514, 0, 37.701367939)` in Dry Reservoir: the physical 0.45-radius body was clear of a wall, but the controller’s 0.48 planning radius rejected the start. The controller now uses the exported physical operator radius. Motion retains the same collision size. Ground searches wait for landing; an unsupported body lasting over three seconds is recorded separately and fails a dedicated load gate. Tests reproduce all four positions and retain a deliberately stuck-airborne case. The first telemetry version’s default armor label can be ambiguous; the geometry/radius result does not depend on armor speed.

The corrected 600-second, nine-client impaired run completed 19 extractions and nine deaths with zero unreachable searches, controller stalls, prolonged airborne waits, gameplay-rule rejections or simulation errors. It retained 13 bounded delivery failures under the configured loss; every declared development gate passed. The 31 ordinary airborne deferrals were observed separately. Browser/unit verification activity shared the workstation, so timing data does not certify isolated production capacity. Original failed/partial runs remain preserved.

## Entry and legacy integration

A browser regression reproduced a separate entry bug: the main raid button opened persistent raids, but saved `?raid=1` and session-storage entries could open the old local base. The central base-entry function now redirects on the persistent service. Automatic entry replaces history to avoid a back-button redirect loop. A plain static page retains its local fallback. The service-worker cache version advances to 75.

The expanded entry check covers the main button, saved query, saved session and a marker-removed static-page branch. Separate browser checks naturally start offline co-op Extraction, Royale and FFA, migrate a representative legacy wallet with an owned skin/weapon/upgrade, visit the persistent account without converting diamonds/equipment, and return with the local wallet intact. This is not remote legacy multiplayer or exhaustive migration/device acceptance. The first new legacy driver mistakenly waited on an unexposed debug property; its corrected check uses actual client phase and visible HUD rather than advancing the game clock.
