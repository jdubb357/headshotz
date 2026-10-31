# Raid networking and performance verification

These are development results, not a production capacity guarantee. Full issue #1 still requires remote-network, long-session, physical desktop/mobile and human playtesting. The dedicated raid service uses nine-player sessions; the load fixture distributes clients across the three authored maps and keeps replacing eliminated operators with new deployments. Existing arena/Royale capacity constants do not configure this service.

## Protocol and responsiveness

The current HTTP raid protocol is version 9, with schema 12. It fences current ballistics and the preceding armor/injury/medical, inventory, starter-provenance, squad-matching and utility boundaries. Layout version 3 remains supported alongside archived layouts. `/api/capabilities`, raid snapshots and action acknowledgements report the protocol. Deployments reject an incompatible client with HTTP 426 before equipment debit. Existing active raids retain their saved combat/ballistics rules. Every public action binds its sequence to both the raid and deployment, validates an action-specific field allowlist, and carries no client-granted health, loot or rewards. The historical measurements below retain the versions they actually tested.

The client serializes commands. A movement command queued behind another action samples current controls when dispatched, so releasing a key does not leave an old buffered movement direction. Each action requests its authoritative state in the same response, removing the previous second HTTP round trip. Up to three attempts reuse exactly the same sequence and payload after a transport failure or server error. Semantic rejections are not automatically retried. A 2.5-second action deadline and bounded backoff prevent a request from blocking the queue indefinitely. The UI reports interruption/retry and measured RTT.

Keyboard and touch movement changes enqueue immediately, in addition to the 150 ms keepalive. Focus loss/menu opening sends a stop. The server expires movement 400 ms after the last new movement command; snapshot reads, firing and replayed movement receipts cannot renew that deadline. Presence and movement freshness are separate.

The server persists the last 64 accepted **and rejected** outcomes per operator in its transactional checkpoint. An identical retry returns that outcome without repeating ammunition use, healing, pickup or other mutations. Changing the payload for an already-used sequence is rejected. Older evicted sequences remain stale and cannot execute again. Durable-write failure commits neither the mutation nor its receipt. Receipts survive restart; they are not sent in snapshots. The current sequence and deployment identity come from a fresh snapshot after reconnect.

Visual movement prediction shares positional collision, ramp, gravity and jumping code with the server. Rendering responds to current controls, reconciles on authoritative responses, and bounds extrapolation: movement freezes after 350 ms without a confirmed state. Health, inventory, damage and rewards are never predicted. Camera correction smooths small positional discrepancies. This is bounded prediction and interpolation; it does not implement full input-history replay or server lag compensation. High-latency playability remains a practical test gate.

Each successful action backs up and checkpoints only its affected raid; simulation ticks and group deployment still back up/checkpoint all advanced worlds atomically. Checkpoint ownership validation still visits every retained item and rejects items already banked/consumed/in another raid. Prepared statements are reused, unchanged inventory rows are not rewritten, and action rollback reuses the transaction's existing memory backup. A scoped rollback preserves other raid objects and account bindings. Restored bodies use the account's durable current/latest deployment, never checkpoint iteration order. Regression checks cover historical bodies, cross-raid isolation, unchanged-row writes, persisted ammunition/wear, canonical ownership violations and database failures.

## Repeatable isolated load fixture

Requires Node.js 24+. No browser or runtime dependencies are needed:

```sh
node scripts/raid-load.mjs --players 27 --seconds 60 --out /tmp/headshotz-load.json --enforce true
node scripts/raid-load.mjs --players 27 --seconds 900 --latency-ms 150 --loss 0.05 --out /tmp/headshotz-endurance.json --enforce true
```

Use a new output filename for each run. The runner always creates a new private, disposable, file-backed SQLite/WAL fixture, preseeds authenticated accounts and starts its own separate server on a loopback ephemeral port. It has no option for targeting an existing service. It closes its child and removes fixture data after completion or failure. It does not measure registration/password hashing, voice relay traffic, rendering or physical-device performance.

Clients send movement through the actual reliable transport about every 150 ms, with AI, collision, deadlines, checkpoints, death and settlement running in the service. A dead client redeploys to sustain activity. A 409 accompanied by authoritative final-death state is a normal raid-end race, counted separately. Other failures are recorded by HTTP status or delivery failure; no cookie, account identifier, password or private request payload is included in reports.

`--latency-ms` adds half the configured delay before and after each action attempt. `--loss` is an independent probability of dropping an outbound attempt or losing a committed response. **This is application-level impairment over loopback, not packet-level loss or a real WAN.** Fixed seeds make the random stream repeatable, but scheduling and AI deaths still vary.

Reports include payload bandwidth, actual elapsed duration, client request quantiles, process CPU/memory, five-second memory/operator/tick samples, and private server metrics. Tick execution and intervals between tick starts are separate: fast execution can still conceal event-loop starvation. Server histogram percentiles are upper bucket bounds; client quantiles use measured samples. Server metrics are cumulative since startup, including deployments. Payload bytes omit transport/TLS headers and voice.

The runner now guarantees an initial command for each scheduled client, even if scheduling contention consumes a very short smoke-test window. After that command it respects the shared deadline and 150 ms pacing; it does not accelerate requests during the trailing window. Short gameplay smoke tests count accepted actions rather than assuming the first action is movement. A one-second movement test also bounds total requests to detect accidental terminal bursts. Historical measurements retain their actual runner fingerprint; the interaction evidence distinguishes the five-minute gameplay run made before this runner correction from the subsequent paced movement verification. Neither measurement establishes physical WAN or device capacity.

New runs also fingerprint all service/shared modules, reliable transport and load-runner sources with SHA-256. Startup verifies that those sources remained unchanged while the fixture booted, and the service build ID includes the fingerprint prefix. Historical evidence predating this addition has descriptive source-state annotations instead.

The `--enforce true` development checks require all clients to finish, no simulation errors, no unexpected action failures without impairment (at most 1% with impairment), tick execution p95 at most 50 ms, and tick-start interval p95 at most 75 ms. These provisional thresholds are explicitly reported; satisfying them does not prove the full release performance acceptance criteria.

## Recorded local measurements, October 30, 2026

Aggregate evidence is in `tests/evidence/2026-10-30-network-load.json`. Hardware: Apple M5 Max, 18 logical CPUs, 128 GiB RAM, macOS 25.5.0, Node 24.21.0. Other workstation activity is uncontrolled.

| Run | Actions completed | Client p95 | Tick p95 | Tick-start interval p95 | Results |
| --- | ---: | ---: | ---: | ---: | --- |
| 9 clients, 10 s, before optimization | 644 | 33.9 ms | ≤25 ms | not captured | 0 failed actions |
| 27 clients, 15 s, before optimization | 2,741 | 93.9 ms | ≤10 ms | not captured | event-loop p99 135.9 ms |
| 27 clients, 20 s, optimized | 3,654 | 36.8 ms | ≤10 ms | ≤75 ms | one unclassified rejection; failure gate correctly failed |
| 27 clients, 60 s, optimized, 150 ms delay/5% loss | 8,919 | 404.6 ms including retries | ≤10 ms | ≤75 ms | 5 exhausted-delivery failures, 7 normal raid-end rejections, 0 simulation errors |
| 27 clients, 900 s, optimized, 150 ms delay/5% loss | 134,114 | 404.1 ms including retries | ≤10 ms | ≤75 ms | 106 exhausted-delivery failures, 69 normal raid-end rejections, 0 simulation errors |
| 27 clients, 20 s, limited-exit build with concurrent browser verification | 3,649 | 45.3 ms | ≤5 ms | ≤100 ms | **Scheduling gate failed**; 0 action/simulation failures |
| 27 clients, 60 s, limited-exit build, test browser stopped | 10,885 | 49.0 ms | ≤5 ms | ≤100 ms | **Scheduling gate failed again**; 0 action/simulation failures |
| 27 clients, 60 s, affected-raid rollback | 10,996 | 31.5 ms | ≤10 ms | ≤75 ms | All declared gates passed; 0 action/simulation failures |
| 27 clients, 900 s, limited-exit/scoped-rollback/no-repeat build, 150 ms/5% impairment | 134,873 | 402.5 ms including retries | ≤25 ms | ≤75 ms | All declared gates passed; 0 simulation errors |
| 27 clients, 60 s, sector loot/day-night/schema 6 | 11,014 | 56.8 ms | ≤10 ms | ≤75 ms | All declared gates passed; 0 action/simulation failures |

The impaired run made 34 deployments, handled 484 duplicate acknowledgements and injected 1,010 drops. Delivery failure rate was about 0.056%, within its declared 1% development threshold. RSS rose from about 81 MiB to 217 MiB, while live heap oscillated with garbage collection; a minute is insufficient to establish a long-term memory bound. Payload traffic averaged about 26.6 kB per client per second. These short, differently timed scenarios are useful diagnostics, not a controlled benchmark or supported-player-count claim.

The 15-minute endurance baseline completed successfully across raid deadlines/redeployment and the 12-minute cleanup boundary. It made 104 deployments, handled 6,847 duplicate acknowledgements and injected 14,330 drops. Delivery exhaustion was about 0.079%; all declared development gates passed. Peak/final RSS was about 261 MiB; sampled heap oscillated with collection. At the 10-minute deadline sample, active operators dropped from 27 to 15 before clients redeployed; the run ended with 27 across 11 active raids. Payload traffic averaged 26.9 kB per client per second. This was the networking baseline loaded **before** the limited-exit changes and does not exercise their boarding/payment paths. It is not a multi-hour soak, a loot/combat-heavy scenario, or a production memory/capacity bound.

A subsequent limited-exit build measurement during browser verification missed the 75 ms scheduling p95 threshold (reported upper bucket 100 ms), despite no action/simulation failures. Repeating it after stopping the test browser and extra service also failed, so browser contention alone did not explain the result. After narrowing action memory backup/rollback to the affected raid, the next 60-second run met the same budgets. Both failures are retained alongside the later pass. Workstation activity and timing remain uncontrolled; this is evidence for the optimization, not proof of a production capacity limit.

The source-fingerprinted limited-exit/scoped-rollback/no-repeat build (`e041bcd9b4f981cc…`) also completed 15 minutes: 134,873 actions, 87 deployments, 6,879 duplicate acknowledgements, 106 exhausted deliveries (about 0.079%) and 53 normal raid-end races. Peak/final RSS was about 238 MiB. It predates sector content. The subsequent 60-second sector/v6 measurement includes the richer checkpoint/snapshot data, but remains a movement workload; it does not establish sustained artifact search/delivery/combat or rendering capacity. Its source also predates the additive historical contract-progress report field.

## Browser verification

`tests/raid-browser-network.mjs` creates its own in-memory service and isolated Chrome context. It holds a movement request before delivery and observes the rendered camera moving while the authoritative body remains still; after release, it verifies reconciliation. It drops a shot response after commit, observes an identical retry, checks one ammunition debit, then reloads and resumes the same deployment. Network error output from the deliberately reset connection is expected; JavaScript exceptions are not.

Run it against a disposable Chrome debugging profile using the existing browser-harness instructions and `CDP_URL` (default `http://127.0.0.1:9336`). Do not attach test automation to a personal browser profile. Fourteen browser scenarios (smoke, worlds, party, progression, entry, communication, accessibility, offline, accounts, network, exits, sectors, audio and loss report) pass on the current player-support/audio/protocol-3 client. The subsequent AI-only platform-support correction is covered by its machine catwalk regression and full unit suite. The network scenario also disables periodic movement polling and verifies an 80 ms press/release reaches authority and stops. The audio scenario renders the real Web Audio graph offline to check five distinct cues, stereo direction, mute and node cleanup. Their focused fixtures do not establish full human playability or device support.

Remaining performance gates include multi-hour stability, combat/loot-heavy load, actual WAN latency and packet loss, multi-device voice relay load, low/mid-range hardware frame-time and memory profiling, deployment hardware sizing and production capacity enforcement.


## Combat, search, loot and extraction workload

Use `--profile raid` for the full gameplay workload; the default `movement` remains a networking baseline:

```sh
node scripts/raid-load.mjs --profile raid --players 9 --seconds 240 --out /tmp/headshotz-gameplay.json --enforce true
node scripts/raid-load.mjs --profile raid --players 27 --seconds 900 --latency-ms 150 --loss 0.05 --out /tmp/headshotz-gameplay-impaired.json --enforce true
```

The pilot navigates public map geometry and visible snapshots, fires at visible threats, reloads owned ammunition, heals, searches containers/death bags, takes actual items, protects eligible salvage and uses real exit access/boarding. It never reads private loot, teleports operators or grants damage, inventory or settlement. Base preparation uses ordinary account funds, owned equipment, trader purchases, insurance and contract accept/deliver/claim APIs; bankruptcy falls back to the normal recovery kit. Final outcome/reward totals come from authoritative result records, deduplicated by result ID.

Reports separate accepted action types, recognized gameplay races, unexpected failures, base actions, canonical settlements and navigation diagnostics. Runs of at least 180 seconds additionally require combat, searching, loot and successful extraction, with acknowledged gameplay rejections at most 5%. The existing timing/error gates remain unchanged. A run with successful shots but no settled result does not prove extraction. A short diagnostic is not a full-loop acceptance run.

Ctrl-C/SIGTERM cancels the isolated run, waits for clients to stop, closes its child service and removes its disposable data. Cancellation was checked against live parent/child PIDs; it produced no success report. Source fingerprints include the pilot module. Subsequent source edits do not alter modules already loaded by a running child; each report describes its recorded build, not automatically the latest checkout.

The first three-client diagnostic exposed unreachable roof routes. Physical traversal tests now cover every spawn-to-cache/exit route in all three current maps, plus archived roof routes. Navigation respects ramp width, actual collision and ledge support; pilots commit to a chosen cache/exit instead of oscillating between greedy goals. Machine pathfinding backs off on unreachable goals instead of replanning every simulation tick. New version-3 landings join ramp tops; saved version-2 geometry remains unchanged.

A nine-client, four-minute gameplay run completed six extractions and ten deaths, with 502 accepted shots, 28 searches, 27 pickups and all four workload coverage checks. It reported no unexpected or acknowledged gameplay rejections and passed its declared timing/error gates. That measurement preceded the final navigation/presence/protocol changes. The larger 27-client, 900-second delayed/lossy run finished 133,949 accepted actions, including 4,096 shots, 230 searches, 215 pickups and 72 boarding starts. Canonical settlements record 64 extractions, 162 deaths, one timeout, 307 machine kills, 15 boss kills, 156 returned items and 159 lost items. It handled 6,849 duplicate acknowledgements over 254 deployments. All declared development gates passed: tick p95 ≤25 ms, interval p95 ≤75 ms, client p95 402.6 ms including retries, and no simulation errors. There were 107 failed actions (106 exhausted deliveries and one unclassified medicine rejection), about 0.080%, within the declared impaired budget. Those failures remain recorded. Peak sampled RSS was about 454 MiB. Twenty-two pilot stalls remain diagnostics requiring follow-up; a budget pass is not proof of flawless traversal. Exact source fingerprints and the earlier partial diagnostic are preserved in `tests/evidence/2026-10-30-gameplay-load.json`. These scripted loopback workloads do not replace human route/balance acceptance, real WAN, voice or device measurements.

The follow-up nine-client, 180-second post-player-support/protocol-3 run completed 10,860 actions, 464 shots, 23 searches/pickups, 22 medicine uses and four canonical extractions. It reported no unexpected failures, no gameplay rejections, no navigation stalls/unreachable goals and no simulation errors; all declared gates passed (tick p95 ≤25 ms, interval p95 ≤75 ms). This source predates the subsequent AI-only footprint-support correction, which is covered by its catwalk regression. The evidence retains both builds and their fingerprints. A three-minute zero-stall result is not a guarantee for all combat detours or a substitute for the longer follow-up soak.

Protocol-4/schema-7 utility effects add bounded snapshot entities and smoke sight checks. Historical workload measurements above predate this change and do not establish its crowded-smoke/lure/blast capacity. Fifteen focused browser scenarios passed on the utility build, with a final real-touch utility rerun and four utility cues added to the real Web Audio DSP check.

The first utility-aware nine-client/180-second gameplay workload completed 10,808 accepted actions, nine throws, 497 shots, 27 searches/pickups and four canonical extractions. Completed results record seven utility uses, 21 machine kills and eight deaths; actions still in active deployments are not counted as settled rewards. There were no action/simulation failures, navigation stalls or unreachable goals, and all declared gates passed (tick p95 ≤25 ms, interval p95 ≤75 ms). Its fingerprinted source predates the later nearby-strike-through-smoke warning exception. This short mixed workload does not establish crowded-effect or production capacity.

The load runner accepts up to 7,200 seconds for continuous two-hour soak measurements. A fresh 27-client/7,200-second gameplay run with 150 ms/5% application impairment is in progress on the initial protocol-5/schema-8 matching/spawn build. Its loaded source predates leader preference reconfiguration and the final handoff docs. No terminal outcome or full current-build capacity claim is made while it remains live. The scripted no-limit accounts do not benchmark the browser admission-handshake endpoint or actual WAN ping.

The first schema-9/protocol-6/armor-injury nine-client 180-second gameplay run completed 10,904 actions and three canonical extractions, with zero action/simulation failures and zero acknowledged gameplay rejections. All declared gates passed (tick p95 ≤10 ms, interval p95 ≤75 ms). One elapsed route stall was retained; isolated movement from that pose reached the goal even with heavy armor/leg impairment. A later pilot diagnostic fix excludes time spent fighting/treating from active navigation stall time. The report source predates that fix and additive damage-dealt result fields; it is not retroactively treated as a zero-stall pass. Concurrent local tests/earlier soak make this an uncontrolled development measurement.

## Completed historical two-hour gameplay run

The preserved schema-8/protocol-5 run completed 7,200 seconds with 27 clients, 150 ms application impairment and 5% request/response loss: 1,071,459 accepted actions, 549 extractions, 695 deaths and 12 timeouts. All its declared timing/error-rate gates passed and simulation errors were zero. Its 1,012 failed deliveries/actions, three unclassified 409 failures and 42 recorded pilot navigation stalls are retained in tests/evidence/2026-10-30-two-hour-soak.json. This predates later matching/combat/inventory/starter changes and does not certify the current build.

RSS warmed up, stayed around 330–334 MiB across much of minutes 15–105, then ended near 363 MiB; the late increase is not explained by these samples. Memory, stall-pose reproduction and unexpected action failures remain review items. The final report is historical evidence, not a reason to discard later/current-build acceptance requirements.

The newer nine-client 900-second source-fingerprinted run adds public-API economy observation, with all declared development gates passing, 31 extractions, 15 deaths and no recorded navigation stalls/gameplay-rule rejections/simulation errors. It shared the workstation with the older soak and brief verification work. ECONOMY_MODEL.md separates its actual cash flows from counterfactual financial assumptions; neither report is a real WAN/device test.

STABILITY_REVIEW.md records the replay and current corrections: immediate invalid-segment replanning, physical-radius planning and landing-aware ground searches. The first 180-second follow-up failed full-loop coverage and is retained. Its 300-second follow-up exposed four sampled search failures, reproduced before correction. The final 600-second nine-client impaired run passed all declared gates with 19 extractions, no unreachable searches/stalls/prolonged airborne waits and 13 bounded delivery failures retained. Redacted bounded failure snapshots now retain reviewed reasons and state counts, keeping unknown failures visible without recording identifiers or arbitrary messages. These checks do not assign missing original causes or replace current-build multi-hour/WAN/device acceptance.

## Renderer lifetime and workstation measurements

Persistent raid characters now use a separate, reference-counted geometry cache. Removing the last live actor frees GPU allocations; at most 112 idle CPU geometries remain for recent-appearance reuse. The ordinary-mode cache remains separate. Instanced environment meshes dispose their instance buffers as well as shared geometry. Returning to base or signing out clears the field scene/render lists/audio and reuses the WebGL context when the same server body is resumed.

The reproduced character leak added 560 GPU geometries after 40 distinct operators left view (12 → 572). The fixed probe returns to its baseline (12 → 12), including tag textures. Instrumented WebGL buffers previously grew 18 → 34 → 50 → 66 over four world clears; they now remain 2 → 2 → 2 → 2. Live-sharing, last-reference release, bounded CPU reuse and ordinary-cache isolation are checked independently.

The final copied package was measured in headless Chrome/ANGLE Metal on Apple M5 Max, concurrently with a 27-client server soak. Each case uses a real authored map, eight other operators, ten machine models and animated camera/aim. One second of warmup precedes an eight-second sample. DPR 2 is emulated and the actual drawing buffer is verified at the client cap of 1.5×: 1920×1080 desktop and 585×1266 mobile-sized. These are renderer-only fixtures, not a supported-device guarantee or whole-client performance test.

Declared development targets were desktop frame p95 ≤20 ms/render CPU p95 ≤12 ms, mobile-sized frame p95 ≤35 ms/CPU p95 ≤20 ms, with at least 180 sampled frames. All six cases passed.

| Map | Viewport | Frame interval p95 | Render CPU p95 | Draw calls p95 |
| --- | --- | ---: | ---: | ---: |
| relay | desktop | 16.8 ms | 0.6 ms | 381 |
| reservoir | desktop | 16.8 ms | 0.6 ms | 383 |
| switchyard | desktop | 16.8 ms | 0.7 ms | 382 |
| relay | mobile-sized | 16.8 ms | 0.4 ms | 235 |
| reservoir | mobile-sized | 16.8 ms | 0.4 ms | 232 |
| switchyard | mobile-sized | 16.7 ms | 0.5 ms | 239 |

Cold scene/model setup is recorded separately and excluded from those steady-state samples; first appearances and full input/network/UI performance remain practical acceptance work. The initial density probe constructed the renderer before device emulation and stayed at 1×; it is retained but does not establish high-density performance. The final report verifies the actual drawing buffer.

Run with an isolated debugging Chrome profile (default CDP 9336), choosing a new report filename each time:

```sh
node tests/raid-browser-render-resources.mjs
node tests/raid-browser-render-lifecycle.mjs
RAID_RENDER_REPORT=/tmp/headshotz-render-report.json node tests/raid-browser-performance.mjs
```

`RAID_TEST_ROOT=/absolute/path/to/copied/release` selects a copied runtime for these probes. Full evidence and artifact identity are in `tests/evidence/2026-10-30-render-resources.json`. A new two-hour/27-client authoritative gameplay soak is running separately; its handle/state is in `tests/evidence/2026-10-30-current-two-hour-soak.json`. A running process is not a completed soak result.

## Whole-client endurance fixture

`RAID_TEST_ROOT=/absolute/copied/release RAID_CLIENT_SECONDS=1800 RAID_CLIENT_CYCLE_SECONDS=60 RAID_CLIENT_REPORT=/tmp/NEW-REPORT.json node tests/raid-browser-endurance.mjs` runs one real Chrome client against its own disposable file-backed authoritative service. It requires the isolated test Chrome/CDP surface used by the browser suite. It never targets the user service or player database.

The scenario uses native movement, look and fire, all three authored maps, free recovery kits, field/base transitions and same-body/context resume. Natural machine deaths remain enabled. Fixture-controlled timeouts cycle surviving operators to the next map and are reported separately; these are not successful extractions or human survival measurements. Samples retain actual HTTP status counts, distinguish final-state races/cooldown refusals from unexpected API errors, collect browser errors and context losses, and record real renderer resources, raw JS heap, DOM counts and frame/CPU quantiles.

Declared workstation gates are field frame interval p95 at most 35 ms, no browser errors or lost contexts, no unexpected API failures, cleared field actors/audio, at most 32 MiB retained-heap growth after warmup and at most 200 extra DOM nodes excluding the visible bounded 20-result history. Raw DOM counts and history size remain recorded. Heap comparisons use explicit GC after returning to base; raw field heap remains available. Frame quantiles cover a bounded last-7,200-frame window. Startup/re-entry costs are included in the rolling intervals. These provisional local targets do not establish physical mobile, WAN, multi-client rendering, real voice or human performance acceptance.

The 38.8-second rehearsal completed five cycles/all three maps with no unexpected API errors or lost contexts; its five HTTP 409 responses were confirmed final-state races after fixture cutoffs. Retained heap grew 143,104 bytes relative to the first three cycles. This is harness rehearsal, not endurance proof. The 30-minute run completed 1,800.22 seconds/29 cycles with all declared checks passing: 58 field starts, no browser errors/lost contexts/unexpected API failures, bounded 20-result history and 279,644 bytes retained-heap growth after warmup. The raw result is `tests/evidence/2026-10-30-client-endurance.json`; terminal coordination is `tests/evidence/2026-10-30-current-client-endurance.json`. Its browser files are byte-identical in the newer admission-limit candidate, whose backend is verified separately.

## Deployment sizing and cost envelope

Planning snapshot: October 30, 2026. This is a proposed single-region configuration and an explicit cost model; no infrastructure was purchased or deployed. The loaded two-hour build remains under observation. A Mac measurement cannot certify a cloud CPU or a provider SLA.

The implemented runtime is one Node.js 24 authoritative process over one local SQLite/WAL database, with a database lease preventing a second simulation against that database. It can host multiple nine-player raid sessions. Multiple independent application replicas cannot share the same file and be called distributed allocation. Cross-host identity, routing/allocation and failover still need implementation/verification before promising that topology.

For a first hosted validation, use a dedicated-CPU 2-vCPU/4-GiB Linux VM with local SSD, one process and a short private data path, a TLS reverse proxy, secure cookies, private operator socket and off-host backups. This is a test target, not a capacity guarantee. Begin the hosted measurement at nine concurrent players, then test 27 with actual AI churn, registration/authentication, browser traffic and voice. Keep the existing tick execution/start-interval gates; require zero failed simulation ticks, no pending-settlement growth and a stable post-warmup memory trend. The service now also enforces a configurable whole-host operator budget, default 27, counting living bodies and pending settlements. Whole squads must fit before valuable debits; reconnects, actions and idempotent deployment retries remain available when full. This enforces admissions, not a hard CPU/memory or historical-raid limit. The proposed cloud host still requires its own measurement.

An interim private status sample at 4,846.544 seconds recorded 4,964,101,800 response payload bytes for 27 scheduled synthetic clients, approximately 0.12719 GiB per scheduled-player hour. Cumulative process CPU averaged 0.489 M5 CPU cores; RSS at that sample was about 410 MiB. These are workload observations, not x86 sizing equivalence. The traffic total includes the fixture's API responses but omits HTTP/TLS headers, assets, voice and real-WAN effects. Scheduled clients include redeployment gaps.

For planning only, multiply observed payload by 1.25 and use 720 hours/month. The 25% allowance is an assumption to replace with actual NIC/billing measurements, not a proven upper bound. At 0.15899 GiB per player-hour, the traffic scenarios are:

| Average concurrent players | Monthly player-hours | Planned game API transfer | Transfer above a 4,000-GiB allowance |
| --- | ---: | ---: | ---: |
| 1 | 720 | 114 GiB | 0 |
| 9 | 6,480 | 1,030 GiB | 0 |
| 27 | 19,440 | 3,091 GiB | 0 |
| 50 | 36,000 | 5,723 GiB | 1,723 GiB |
| 100 | 72,000 | 11,447 GiB | 7,447 GiB |

These are bandwidth extrapolations, not supported player counts. Peak concurrency sizes compute; average player-hours drive transfer. More or smaller snapshots, inventory sizes, extra retries and authentication/voice traffic change the result. Raw arithmetic/assumptions: tests/evidence/2026-10-30-hosting-cost.json. Replace the interim rate after the current run completes.

Reference list prices checked October 30, 2026, in USD/month:

| Reference VM | CPU / RAM | Included outbound transfer | VM list price |
| --- | --- | ---: | ---: |
| DigitalOcean Basic Regular | 2 shared vCPU / 4 GiB | 4,000 GiB | $24 |
| DigitalOcean CPU-Optimized Regular | 2 dedicated vCPU / 4 GiB | 4,000 GiB | $42 |
| DigitalOcean CPU-Optimized Regular | 4 dedicated vCPU / 8 GiB | 5,000 GiB | $84 |

These are reference configurations from [DigitalOcean's official pricing](https://www.digitalocean.com/pricing/droplets). Dedicated CPU is the proposed test target because shared CPU adds contention variability. Additional outbound transfer is $0.01/GiB under the [documented Droplet bandwidth rules](https://docs.digitalocean.com/products/droplets/details/pricing/). In the 50/100-average-player traffic examples, a single 4,000-GiB allowance would add roughly $17.23/$74.47; this does not establish that one VM can run those players.

[Spaces Standard](https://docs.digitalocean.com/products/spaces/details/pricing/) is a reference off-host backup store at $5/month, including 250 GiB storage and 1,024 GiB outbound; excess storage is $0.02/GiB-month and outbound $0.01/GiB. Actual backup database/WAL growth, retention and restore traffic must be measured. Thus the proposed dedicated 2-vCPU VM plus reference backup subscription starts at $47/month before variable usage, tax, domains, monitoring/support and relay costs. A planning reserve such as $75/month is a proposed budget for review, not an approved purchase or guaranteed bill.

[Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/faq/) documents $0.05 per outbound GB after a shared 1,000-GB free tier. For TURN-only budgeting, cost = max(0, billed outbound GB - available free GB) × $0.05; 2,000 GB with the full free tier available would be $50. This service is not configured here. TURN credentials, real remote connectivity and relay billing need their own validation; codec bitrate, silence and peer count are not assumed to equal billed traffic. Voice is separate from game-server API transfer.

Before public hosting, the remaining concrete work is the actual host/network benchmark, trusted-proxy/client-address configuration, remote TURN/HTTPS/cookie tests, off-host restore and alert delivery, disk/audit retention limits and named operator/moderation ownership. OPERATIONS.md and RELEASE.md contain the existing deployment, drain, backup, rollback and pinned-candidate procedures. Prices and assumptions must be rechecked when selecting a real provider.

## Completed corrected-pacing two-hour gameplay run

The pre-admission fingerprint f7827207 run completed 7,200.40 seconds with 27 clients, injected 150 ms request/response delay and 5% application loss: 1,064,553 actions, 628 extractions, 1,182 deaths and three timeouts. All declared workload gates pass; there are no simulation errors or recorded ground/airborne/unreachable navigation failures. Six classified gameplay races and 1,044 delivery failures remain retained. Tick execution p95 is an upper histogram bound of 50 ms; tick-start interval p95 is 75 ms. Raw data: `tests/evidence/2026-10-30-two-hour-gameplay-f782.json`.

Memory remains a follow-up: quarter-two/three/four mean RSS is 424.52/418.84/457.49 MiB, while mean JavaScript heap is 65.79/69.29/68.91 MiB. Peak RSS is 480.47 MiB. This report does not attribute the late RSS rise or prove a bounded long-term process footprint. Stable JS heap alone is insufficient. The later host-admission/configuration/private-status changes have separate focused concurrency/retry/process/browser and 120-second impaired-load evidence; the old report is not an exact-current-backend-build certificate. No WAN/device/human acceptance is implied.

## Idle-world allocation investigation

A private 30,000-action statement experiment compared identical file-backed 27-account fixtures in independent Node processes. Experimental statement caching cut native statement compilations from 92,414 to 18, but post-GC RSS changed only from about 255.5 to 253.4 MiB. That does not support introducing a production statement cache to explain the late RSS rise. No such cache was added.

The simulation did contain unnecessary allocation and I/O: completed, unjoinable worlds continued AI/events, full rollback cloning and repeated checkpoint serialization while any other world was active. Tick selection now scopes backup/checkpoints to active/pending, still-joinable or expiry-eligible worlds and skips simulation of settled worlds that cannot accept another operator. A shared authoritative time sample prevents a world crossing the cleanup boundary between selection and advancement. Partial failure restores original world ordering as well as canonical state.

In a paired controlled fixture with 60 completed/unjoinable worlds and nine active bodies, 500 ticks fall from 31,500 checkpoints/462,772,914 serialized bytes to 1,500/24,159,234. Measured processing time falls from 6.85 to 0.40 seconds; post-GC RSS falls from 253.1 to 90.3 MiB. The byte counter performs its own JSON serialization, so timing includes instrumentation and is not a real-time capacity multiplier. Each run starts from the identical cloned database; before/after workers run separately. The unchanged-code control gives similar before/after values. Fixed simulation time and explicit GC are diagnostic fixtures, not live gameplay.

Seven new regression cases cover paused-world persistence, open-window admission, pending settlement, multiple active-world rollback, cleanup deletion/ownership/order and time-boundary coherence. The full suite passes 1,069 tests. Raw controlled reports and the initially failing new rollback test are retained in `tests/evidence/2026-10-30-idle-world-memory.json`. The current 900-second/27-client follow-up completed 134,188 actions, 64 extractions/175 deaths and all declared gates, with no simulation/navigation stalls. Its 134 failures remain retained, including one unclassified throw rejection. Peak sampled RSS is 303.58 MiB; this does not prove a multi-hour plateau. Raw data: `tests/evidence/2026-10-30-idle-world-gameplay.json`; terminal handle: `tests/evidence/2026-10-30-current-idle-world-soak.json`. This fix reduces demonstrated allocation pressure; it does not retroactively explain every component of the older two-hour RSS trend.
