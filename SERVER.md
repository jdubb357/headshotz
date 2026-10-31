# Persistent raid service

Requires Node.js 24 or later. No third-party runtime packages are required.

```sh
node server/main.mjs
```

Open `http://127.0.0.1:8020/raid-online.html`. Create an account, select owned equipment or the free recovery kit, and deploy. The service also serves the existing game at `/`. Its raid button and saved query/session entries consistently open the persistent page; plain static previews keep the separate local fallback. The persistent raid client is a separate development path; the PeerJS mode does not award server inventory or share its local diamond wallet.

`RAID_MAX_OPERATORS` sets the whole-host admission budget (default 27, integer 1–1024), independently of the nine-player raid limit. Alive bodies and pending settlements retain slots across all maps. A squad must fit in full before any loadout or insurance debit; a full host returns HTTP 503 and preserves readiness/gear. Reconnect, existing actions and matching deployment retries remain available. Lowering the limit does not evict restored operators; new admissions wait until capacity is available. Raising this setting does not establish hardware capacity. Private operator status includes the limit, usage, free slots and an over-capacity alert.

Data is stored in `.raid-data/raid.sqlite`, excluded from Git. `RAID_DATA_DIR`, `HOST`, and `PORT` configure the location/listener. The default listener accepts local connections only. For a hosted environment, terminate HTTPS at a trusted reverse proxy, set `RAID_SECURE_COOKIES=1`, preserve the public Host header, and configure the listener explicitly. No hosted environment has been deployed.

## Implemented foundation

- Password authentication with salted scrypt hashes; random session credentials are hashed at rest and delivered in HttpOnly, SameSite cookies.
- Separate raid credits and item-instance ownership. Paid loadouts debit actual stash items. Accounts can have only one active deployment.
- SQLite transactions include deployment/settlement and their audit record. Settlement retries survive database restarts and cannot award twice.
- Recovery equipment cannot be banked. Final death loses carried equipment. Normal logout does not compensate a deployment.
- Server-owned movement/collision, line-of-sight hitscan damage, AI detection/attacks, loot claims, protected inventory, exit timers, and extraction rewards.
- Three versioned authored districts shared by collision/navigation and rendering, with interiors, roof ramps, elevated loot, landmarks and hazards. New raids use version 3; existing checkpoints retain their original version 1 or 2 geometry. Version 3 moves roof landings to join the ramp tops. New raids also have an authoritative accelerated sector clock, day/night lighting, sun/moon/stars, weather-front warnings and visibility-dependent detection/snapshots. Existing checkpoints keep their saved content/weather policy. Finished content and route balance still require playtests.
- Protocol-v8 actions bind increasing sequences to a raid/deployment. Durable bounded receipts replay accepted/rejected outcomes safely, and combined acknowledgements include authoritative state without a second poll. Incompatible clients are rejected before deployment debit. Requests are bounded and rate limited; HTTP clients have no settlement endpoint. See PERFORMANCE.md for retry, prediction and load-test details.
- Inventory uses a unique, indexed ownership registry. Successful actions and simulation ticks atomically update the raid checkpoint, item locations, settlements, and audit records. A failed checkpoint rolls back the in-memory transition and the database writes together.
- Restart restores active raid checkpoints, including owned loot, protected inventory, action sequences, positions and deadlines. An exclusive expiring database lease prevents two simulations from advancing the same world. Only orphaned deployments without checkpoints are compensated; items already banked elsewhere cannot be restored twice.
- Authenticated solo/duo/trio parties provide invite codes, ready checks, leader deployment and capacity limits. Squad deployment is atomic: one invalid loadout rolls the group back. `RAID_REGION` identifies this server's actual configured region; unavailable regions are rejected rather than silently routed elsewhere.
- Squad downing, five-second interrupted revives, bleeding, carrying, and paired carrier/teammate extraction run on the server. New raids have seat-limited call-in/timed/key/fuel exits with durable reservations and finite activations; a carried teammate needs a second seat. Damage to either passenger cancels group boarding. See RAID_RULES.md for exact costs, schedules, eligibility, legacy checkpoint behavior and verification.
- The main game's Extraction Raids button routes to the persistent raid flow when served by this service. Static-only hosting retains the existing peer mode.
- Six firearm classes use persistent magazines and owned compatible ammunition; firing consumes rounds and applies wear. Instanced optics, suppressors and magazines survive equipment transfers; attachment ownership is tracked separately in the canonical registry.
- Three traders have distinct stock, hourly restocking, reputation discounts and unlocks. The workshop crafts medicine, ammunition, armor and mods from actual salvage; recycling, repairs and station/stash upgrades provide resource sinks.
- Eight contracts cover exploration, recovery, deliveries, machine combat and multi-stage objectives. Each sector now has distinct salvage and a two-stage recovery contract with an original, unsecured artifact. Only authoritative map/extraction facts advance objectives; delivery consumes the owned stash instance. Reserved quest items cannot be sold/recycled/deployed, and stage rewards are claimed once. WORLD_CONTENT.md documents the rules and evidence.
- Optional equipment insurance charges a premium at deployment, waits at least two minutes and until raid closure, and permanently excludes equipment claimed by another operator. Unclaimed lost equipment returns once to stash or protected overflow storage.
- Overflow items are retained without automatic sale. Resolve overflow before another deployment. Favorites protect selling/recycling; stash search/filter/sort, bulk sales and twelve loadout presets are available.
- Post-raid records enumerate banked/overflow and dropped items, ammunition/supplies used, premiums/refunds, credits and XP. The base refreshes when an operator left in the world settles; closing the raid screen does not extract or refund equipment.
- Per-account/action limits are separate from IP/credential throttles, so a normal squad sharing one network does not consume a single low request quota.

## Content and controls

`raid-view.mjs`, `raid-models.mjs` and `raid-environment.mjs` render the server state with original HeadShotz weapons/characters, procedural machine silhouettes, instanced districts and weather/attack cues. WASD moves; the mouse aims after clicking the canvas; click/Fire shoots, R reloads, E interacts, Space/Jump jumps, 1/2 select weapons and 3 uses medicine. Touch players can drag the view to aim and use the movement/action buttons. Map markers show self, squadmates and exit sites. Downed operators crawl; eliminated operators can follow a surviving squadmate.

Five machine types use server perception, ground navigation/flying movement, telegraphed locked-point strikes, armor and exposed cores. Supply drops, patrol reinforcements, a weather front and periodic hazards advance with the raid clock. Each machine archetype has an original synthesized directional charge cue, bounded to visible nearby machines; repeated snapshots do not restart it. The sound setting mutes it, and warning rings/captions remain available. Twelve simultaneous cues bound audio work and completed nodes disconnect. Current models/audio and balance still need production polish and human playtests.

## Field utilities

Ashveil smoke canisters, Scrapchatter noise lures and Shatter charges can be bought from Scrapwright, crafted from owned salvage or recovered in sector caches. Utility stacks hold three, each item has its own weight, and utilities cannot enter protected storage or insurance. Deploying them uses the ordinary owned-item escrow. Unused utilities extract or drop with the rest of carried equipment; throwing consumes one immediately and records it in the raid report.

G (remappable) or the touch Utility button throws the first carried utility. Backpack's **Throw toward aim** chooses a specific item and closes the pack. Inspection explains each effect. Existing saved keyboard remaps survive the new action; if G is already bound, the utility receives an unused key.

The server derives a 3–18 metre placement from the operator's view, stopping before walls/blocked floors. Clients cannot supply placement, damage, radius or timers. Throws clear spawn protection, have a 1.5-second cooldown and bounded concurrent effects. They are unavailable while downed. Effects and consumption are checkpointed with the action receipt; retries, restart and failed writes cannot duplicate a throw or restore its spent item.

- **Ashveil:** activates after 0.8 seconds, lasts 18 seconds, radius 4 m. Smoke blocks rival snapshot identification and machine sight, including elevated rays only when they intersect the cloud. Bullets still pass through. Squad markers remain; already committed machine attacks are not canceled. The client draws the cloud and reduces visibility while inside it.
- **Scrapchatter:** activates after 0.5 seconds and pulses for 12 seconds, audible to machines within 32 m. Idle/investigating machines follow its saved position; a visible operator retains priority. Nearby clients hear a directional repeating cue and see its marker.
- **Shatter:** 1.5-second fuse, radius 4 m, server damage with distance falloff and wall/height checks. It can hurt its owner, spares squadmates, and applies machine armor rules and normal squad kill credit. A warning ring marks the blast area. A missed fuse during a process interruption detonates once on the next simulation tick; a failed durable tick rolls damage back with the effect.

Utility sound respects mute/volume and shared polyphony limits. Schema 7 introduced utility-instance/effect semantics; schema 8 adds matching consent and schema 9 combat rules. The current protocol 9 rejects old clients before valuable deployment changes. Schema 10 adds the inventory semantics documented in INVENTORY.md. Layout versions remain unchanged. Automated and isolated Chrome checks cover the paid loadout, real touch/keyboard/backpack use, rendering, consumption, save failures, restart and v6-to-v7 preservation. Human counterplay/balance and realistic crowded-effect performance remain open.

## Account recovery and session management

Account opens a security panel in the base or during a raid. It lists coarse browser/device labels, sign-in/activity/expiry times and the current session. Raw session credentials and stored hashes never appear in its API response. Sign-ins expire after seven days; at most 20 active sessions are retained per account. The server updates activity at most once a minute rather than writing on every simulation poll.

- Changing a password requires the current password, rotates the current HttpOnly cookie, revokes other sign-ins and invalidates every saved recovery code. Generate a new code set afterwards.
- Generating codes requires the current password and creates eight random single-use codes. Only hashes are stored. The plaintext set is shown once, can be copied at the player's request, and is cleared on close/hide/sign-out. A delayed response cannot redisplay codes after the panel closes. Nothing writes these codes to localStorage or a repository file.
- Recover with a saved code is available on the sign-in screen. A valid unused code and new password atomically consume that code, change the password and revoke every sign-in. It does not auto-login; sign in with the new password. Other unused codes remain valid until regeneration or a normal password change. There is no email recovery service.
- Individual session revocation and Sign out other sessions require the current password. The latter rotates this browser's cookie as well. Current-browser sign-out is available in the security panel without another password prompt.
- Revoked sessions lose API and voice eligibility. The client clears private UI data and microphone capture, while the body remains vulnerable in its existing raid. Recovery/sign-out never settle, heal, extract, refund or duplicate equipment. Reconnect using the new credentials to resume the same operator.

Security mutations are transactional and audited without secrets. Recovery has separate IP and account throttles; security mutations require recent password knowledge. Every authenticated POST revalidates its cookie after the body finishes arriving, so an already-open request cannot act after revocation. Client generations prevent stale raid inputs/profile responses from crossing sign-out or account changes. Schema v5 migrates existing sessions and preserves canonical inventory/deployments/checkpoints. Account/operator support, data-retention/deletion procedures, hosted HTTPS and public deployment review remain launch requirements.

## Controls, accessibility and onboarding

Settings and Field guide are always available above the raid. Every gameplay keyboard action can be remapped; choosing a used key swaps the two bindings. Escape and Tab remain browser navigation controls. Defaults include arrow-key aiming, F for fire, B for Backpack, H for a status announcement and F1/F2 for guide/settings. Mouse/touch sensitivity, vertical inversion, FOV, HUD/text scale, contrast, sound/voice levels, captions and reduced motion are saved on the device; they never replace account inventory or enable a microphone.

Reduced motion follows the OS by default and removes optional weapon sway/recoil, weather particles, warning-ring pulsing and base idle motion. Critical machine events, low-health/downed warnings, timed searching, reviving and boarding have text feedback. H announces current raid status on demand rather than sending every HUD poll to a screen reader. Rarity is written out, and item inspection displays weapon statistics/attachments and comparisons with the current weapon. Backpack also lists exit access/schedules. Native modal dialogs add explicit Tab wrapping and preserve browser Escape behavior.

Touch players can drag an unobscured part of the view to aim, use directional look buttons, and open Backpack for item actions. On small/coarse-pointer screens, an open backpack uses the control area; close it to move. Targets are at least 44 CSS pixels. Menus/backgrounding clear held movement and quiet voice; returning does not replay stale held keys. Physical-device and assistive-technology testing remain release requirements.

The service worker uses network-only requests for `/api/`, never caches authenticated profile/raid/report responses, clears previous HeadShotz asset caches on upgrade, and returns an explicit offline JSON error. It does not convert a failed API request into cached game HTML. Browser tests verify this by stopping and restarting an isolated service. Offline status is not an extraction or equipment refund.

## Communication and moderation

Squad communication opens from the fixed **Squad / voice** button. Q or the Ping button sends an authoritative aimed marker; supply requests mark the operator's position. Only squadmates receive these markers, and blocks suppress them in both directions. Markers have cooldowns, per-operator limits and a 20-second lifetime. Squad status includes downing, bleed time, boarding, disconnection and final outcomes.

Voice starts off and requests microphone access only on Enable voice. Choose squad, nearby (24 metres, including opted-in rivals), or both. Hold V or Hold to talk to transmit. Focus loss quiets transmission; disable, leaving the raid screen, a stale session or a signaling watchdog releases capture. Mute and block disconnect the peer. Mute/block settings survive sign-ins; enabling voice does not. The server validates mutual scope, raid/party relationship, proximity and session epochs on every relay. The client closes ineligible peers after polling. Audio is encrypted peer-to-peer WebRTC; it is not routed through the raid simulation or stored in its database. The development privacy disclosure is served at `/raid-privacy.html`.

Localhost voice tests use direct ICE candidates. Remote deployments must configure and test their own STUN/TURN using `RAID_ICE_SERVERS` (JSON accepted by the browser's WebRTC ICE configuration). Keep provider secrets outside the repository and use appropriately short-lived client relay credentials. No external provider, public relay, HTTPS host, operator contact or retention schedule has been configured. Real networks and microphones still need validation.

Reports are stored with immutable submitted details/context, and repeating the same report returns its original ID. Players have no report-reading API. An operator with database access can use:

```sh
node scripts/moderation.mjs list
node scripts/moderation.mjs show --report REPORT_ID
node scripts/moderation.mjs review --report REPORT_ID --status reviewed --operator OPERATOR_NAME --note "Review findings"
```

`--db /absolute/path/raid.sqlite` selects a development or hosted database. Statuses are `open`, `reviewed` and `dismissed`; reviews append an audit record without replacing report evidence. The tool performs no automatic account punishment. Public launch still requires moderation ownership, retention/deletion procedures and deployment privacy review. Schema v4 added communication preferences, control lists and reports; v5 adds session metadata and recovery codes while retaining existing inventory/checkpoints. Schema v6 fences the new sector quest-item semantics without rewriting old items, sessions or checkpoint policies; startup refuses a live simulation lease during migration. Backup restore clears only its private copied lease before supported migration.

## Operations and recovery

[OPERATIONS.md](OPERATIONS.md) documents local health checks, owner-only Unix-socket status/drain controls, a private operations snapshot dashboard, verified online backup/restore commands, explicit abort/resume recovery policies and the deployment/rollback runbook. Live backups include committed WAL state; restore writes a new directory, invalidates sessions/recovery codes, and never overwrites the existing data directory. File-backed databases and backup outputs use owner-only file permissions.

Health endpoints return minimal status only. Detailed metrics omit credentials, identities, voice payloads and query strings and are available through the private socket. Drain stops new deployments before equipment debit while existing raids continue. A process-level drill validates live backup, crash, restore, drain and normal restart using isolated data. Off-host storage, monitoring/alert delivery, hosting/release automation, production proxy configuration and operational ownership still need deployment-specific work.

## Verification

```sh
node --test tests/*.test.*
```

`tests/raid-browser-exits.mjs` creates its own isolated service and two browser contexts. It deploys owned fuel, pays at the emergency winch, contests a fixture's final seat, releases it through damage, extracts independently and checks access-cost/returned-item reporting. Fixtures arrange positions and prior seat use; practical map traversal/balance remains a separate gate. It also checks compact-window caption/map separation.

INVENTORY.md documents quantity selection, stack compatibility, partial pickups, protected withdrawals, weapon drops and unarmed persistence (schema 10/protocol 7). `tests/raid-browser-transfers.mjs` runs the actual stash/raid controls with two isolated accounts and checks keyboard focus, quoted sales and both players' weapon models. Server-arranged positions keep that check separate from human contested-looting acceptance.

`tests/raid-browser-comms.mjs` additionally requires Chrome's `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` flags and isolated browser contexts. It must never use a real microphone or the local model's browser profile. It checks actual inbound audio RTP and microphone track shutdown, as well as the product's mute/report/ping controls.

`tests/raid-browser-accessibility.mjs` and `tests/raid-browser-offline.mjs` create their own in-memory HTTP services against the isolated Chrome instance. The accessibility test arranges a container/exit position server-side and exercises actual timed search, keyboard transfer/protection and touch boarding. It also checks mobile geometry, dialog focus, persisted bindings, rendered reduced motion and visible/hidden input clearing. These checks do not replace real-device or human onboarding/playability validation.

`tests/raid-browser-account.mjs` starts an isolated service and uses two browser contexts with fake microphone capture. It covers password/session rotation, secret panel cleanup and delayed responses, remote sign-out/microphone shutdown, code recovery during a paid deployment, resuming the same operator with unchanged gear/health, and suppressing a delayed old raid response after an account switch. Its fixture sets test health/protection explicitly; it does not simulate a full human raid or configure production account support.

The browser smoke test additionally requires a separate Chrome process with remote debugging and a running service with a temporary data directory. Do not point it at production accounts or the local model's active browser profile.

On this Mac, start each of these in its own terminal, using unused test ports:

```sh
RAID_DATA_DIR="$(mktemp -d /tmp/hs-browser-data.XXXXXX)" PORT=8021 node server/main.mjs
```

```sh
task_raid_chrome_profile=$(mktemp -d /tmp/hs-browser-chrome.XXXXXX)
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --remote-debugging-port=9336 --user-data-dir="$task_raid_chrome_profile" --no-first-run --no-default-browser-check --use-fake-device-for-media-stream --use-fake-ui-for-media-stream about:blank
```

Then run the desired browser scenario from a third terminal in this checkout. Account, accessibility, offline and network checks create their own service; the other scenarios use the temporary service above. Keep the fake-media flags for communication/account tests. Stop the two dedicated terminal processes when finished; do not stop a personal browser or another model's service.

```sh
RAID_TEST_URL=http://127.0.0.1:8021 CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-smoke.mjs
CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-network.mjs
```

## Open work against issue #1

The service is not the completed feature. Full original-arsenal integration, distributed matchmaking, full input-history replay/lag compensation and real-network prediction validation, finished machine art/audio and encounter balance, spectator polish, finished maps and practical sector-content balance, remote voice service and moderation operations, production identity/support operations, production monitoring/alerts, off-host recovery drills, deployment automation, device profiling, long-term economy balance and load testing remain open. The existing peer prototype has some of those systems, but they must be ported and verified with server authority before they count toward completion.

Account metadata and checkpoints are JSON snapshots; canonical item ownership is normalized in SQLite with indexed account, deployment and raid locations. Schema migrations preserve existing saves and refuse a newer unsupported schema. Run one simulation process per database; independent region instances need their own allocation/data architecture before production scaling. Leases fence duplicate local processes, not an entire distributed deployment.

There is no automatic season reset. Do not wipe account data to apply updates. Schema and game-state migrations must preserve inventory, and local backup/restore/rollback tooling and drills are in place; production launch still requires deployment-specific verification and operational ownership.

## Economy verification

`node scripts/economy-audit.mjs` reports static buy/sell and craft/sell margins at maximum reputation discounts. It does not substitute for playtesting raid reward rates, progression pacing, scarcity or insurance behavior under a live population.

## Standalone candidates

RELEASE.md documents the explicit runtime inventory, SHA-256 release manifest, trusted-ID verification and guarded starter. The builder excludes local save/credential/development folders and refuses source races, linked files and existing destinations. The starter validates a separate absolute/short-enough save path and settings, pins operational build identity, strips unrelated environment credentials/loaders and forwards normal shutdown. A real copied-package process drill verifies paid escrow/ammunition/restart and refusal of a tampered client before save creation. Native process-manager/provider installation, HTTPS, off-host operation and the full release acceptance remain separate requirements.

## Placement and connection checks

MATCHMAKING.md documents same-size preference and explicit mixed-size consent, actual configured region, whole-group capacity/formation, dynamic rival/machine spawn separation and transparent low-population behavior. Authenticated server-clock nonce checks enforce an optional fresh round-trip limit before any deployment debit, including every party member. Party leaders may change preferences while everyone is in base; all readiness is cleared. New checkpoints preserve the matching policy; the matching boundary introduced schema 8/protocol 5, followed by the current schema 12/protocol 9. This remains one service/region/database, with distributed allocation and practical WAN acceptance open.

## Combat equipment and treatment

COMBAT.md specifies the current 100-health, condition-backed light/field/heavy armor, body protection/head-leg bypass, armor changes, bleeding/leg injuries and four distinct medical supplies. Shared prediction matches mobility/weight/injury rules. Owned item identity, actual-grade insurance and remaining condition survive extraction/restart; treatment and injury ticks roll back with failed checkpoints. Legacy active raids keep their saved combat rules and receive no new-rule admissions. The combat boundary introduced schema 9/protocol 6, followed by the inventory boundary at schema 10/protocol 7; practical balance and full combat acceptance remain open.

ECONOMY.md describes schema 11/protocol 8 starter provenance: owner-bound new-account support, earned-first spending, source-preserving transformations, earned-only deliveries, exact premium refunds and loaded-ammo transfer rules. Existing saves keep their ordinary items/balances. Actual shop/loot controls expose the distinction and reject stale quoted balances; comprehensive rate/balance and human acceptance remain open.

`CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-trigger.mjs` starts its own isolated service and tests held automatic fire, semi-automatic press edges, touch release/click behavior, menu cleanup and owned-ammunition reloads. It removes machines for controlled input assertions; no personal account, local-model browser or production service should be used. COMBAT.md documents the exact input and network timing limits.

New deployments now use ballistics version 1 under schema 12/protocol 9: body-surface ray intersections, exact bullet cover/ramp clipping, eight-pellet shotgun spread/falloff, transactional hit facts and bounded damage. Existing raids retain the legacy hit rules without accepting new-rule admissions. COMBAT.md describes exact timing/geometry, first-person eye alignment, owned-optic aiming and keymap migration. `CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-ballistics.mjs` runs its own isolated actor/position fixture; physical devices, human balance and complete arsenal acceptance remain open.

PROGRESSION.md specifies server-checked XP ranks and six weapon assembly blueprints, exact costs/station gates, starter/earned ownership and the ordinary-mode class/pet/upgrade isolation audit. This additive catalog feature uses existing XP/item records and does not rewrite legacy inventories. `CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-ranks.mjs` and `node tests/raid-browser-cover.mjs` create their own isolated fixtures. Current raids share exact cover for visibility, AI, utilities and interactions; legacy raid cover behavior is preserved. See COMBAT.md for the precise policy and remaining playtest scope.

LOADOUTS.md documents stable primary ordering, owned item inspection at base, gear/armor portrait previews, preset order/missing-item handling and readied-loadout reconciliation. A party leader sending a different own selection is rejected before deployment debit. `CDP_URL=http://127.0.0.1:9336 node tests/raid-browser-loadout.mjs` creates an isolated service and tests the complete preparation/deployment/cleanup flow; human presentation/device acceptance remains open.

## Completed-world tick work

Once every operator in a world is settled and its first-minute admission window has closed, the service keeps its saved world/loot until normal cleanup without continuing AI/events or rewriting that checkpoint on every tick. Active worlds, pending settlements, still-joinable worlds and expiry cleanup remain selected. Snapshot requests can still return a settled operator’s report. Raid deadlines, loot ownership, insurance eligibility/delays and cleanup timing do not change. A tick uses one authoritative time sample for selection and advancement; multi-world failure restores both affected state and original map ordering.
