# Economy measurement and sensitivity model

This captured report covers the full extraction economy workstream in issue #1. Reproduction commands run from the source checkout; runtime packages omit the development harnesses and datasets. It is analysis and instrumentation, not a release acceptance certificate. No game prices or protected-item rules were changed by this analysis.

## Reproduce

Run `node scripts/economy-model.mjs` for the source-fingerprinted JSON model. `--out NEW_FILE` saves a new owner-only file and refuses an existing destination. The model uses private in-memory accounts and actual service actions/settlements to quote prices, armor/weapon wear, insurance and repairs. It never opens a player database.

Model source fingerprint: `964fdb364c7327432a830851c64d3f95c70e98623613fc37bd3e247e05007962`. Full inputs/results are in `tests/evidence/2026-10-30-economy.json`.

For observed gameplay, run `node scripts/raid-load.mjs --profile raid --players 9 --seconds 900 --latency-ms 150 --loss 0.05 --out NEW_FILE --enforce true`. This creates a disposable file-backed service and synthetic clients. Its `economy` section records public-API wallet deltas, starter/earned balances, stash quotes, returned bring-in stacks and newly recovered stacks. It does not grant loot or settle the players itself.

## Controlled financial scenarios

The table assumes no reputation discount, repair bay zero, 30 shots, 15 armor protection spent and market-priced repair steel. A paid attempt budgets one spare ammo pack and one medkit. Scavenging attempts average five minutes; the empty recovery comparison assumes two minutes. All nonempty cases assume 80 credits of loot sold per extraction and ten protected credits per available protected slot after a loss. Survival probabilities and these timings/loot values are counterfactual inputs, not measured human rates. Insurance assumes half the lost equipment is eventually unclaimed and eligible to return; delay and replacement cash are not simulated.

| Strategy | Assumed survival | Expected net/attempt | Expected net/hour | Loot needed per extraction to break even | Expected shop demand fits stock |
| --- | ---: | ---: | ---: | ---: | --- |
| Free, empty escape | 25% | 5 | 150 | 0 | Yes |
| Free, scavenging | 25% | 32.5 | 390 | 0 | Yes |
| Field kit | 25% | -133.8 | -1605 | 615 | No |
| Insured field kit | 25% | -117.9 | -1414.5 | 551.5 | No |
| Free, empty escape | 50% | 10 | 300 | 0 | Yes |
| Free, scavenging | 50% | 55 | 660 | 0 | Yes |
| Field kit | 50% | -80.5 | -966 | 241 | No |
| Insured field kit | 50% | -81.3 | -975 | 242.5 | Yes |
| Free, empty escape | 75% | 15 | 450 | 0 | Yes |
| Free, scavenging | 75% | 77.5 | 930 | 0 | Yes |
| Field kit | 75% | -27.3 | -327 | 116.3 | Yes |
| Insured field kit | 75% | -44.6 | -535.5 | 139.5 | Yes |

A negative projection means that this fixed replacement strategy is not sustainable under its stated assumptions. Actual accounts cannot spend below zero and can switch equipment, retain recovered gear or use a recovery kit. The model sells recovered loot; keeping a recovered weapon can avoid a much larger market replacement cost than its resale quote. Gear's effect on survival, route access and capacity, quests, XP utility, acquisition delays and player enjoyment are not reduced to a credit rate.

The 50% field-kit example needs six replacement rifles per modeled hour, while the Outfitter offers four assault rifles. That flags a resupply constraint rather than assuming infinite stock. Other guns, recovered equipment, slower attempt rates and delayed insurance returns can change the result. Insurance can reduce replacement exposure but its premium is paid on successful raids too. Discounts lower replacement costs while the canonical insurance premium remains based on equipment grade.

## Base investment

These quotes use actual upgrade transactions. Material budgets value consumed salvage at average market unit replacement prices; whole purchase packs can require more cash temporarily and leave unused salvage. Upgrades are personal. Their costs are listed separately rather than silently amortized into the table above.

| Station | Level | Credit fee | Steel | Wire | Market resource budget, reputation zero | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| stash | 1 | 100 | 2 | 1 | 118 | 28 stash slots |
| stash | 2 | 150 | 3 | 1 | 174 | 36 stash slots |
| stash | 3 | 200 | 4 | 1 | 230 | 44 stash slots |
| bay | 1 | 100 | 2 | 1 | 118 | Lower repair fees |
| bay | 2 | 150 | 3 | 1 | 174 | Lower repair fees |
| bench | 1 | 100 | 2 | 1 | 118 | 15 available recipes |
| bench | 2 | 150 | 3 | 1 | 174 | 17 available recipes |

## Protected-loot pressure

The model samples 32 deterministic loot seeds per map, then selects the most valuable eligible items from the entire map. This is a capacity-only ceiling: it ignores reaching dangerous/gated caches, competition, keys, death before pickup and travel. These are not demonstrated farming rates.

| Map | Largest sampled one-slot resale value | Largest sampled two-slot resale value |
| --- | ---: | ---: |
| relay | 77 | 153 |
| reservoir | 77 | 152 |
| switchyard | 77 | 152 |

This liquidity warrants a dedicated public-API route test of acquire/protect/disconnect or intentional-loss strategies. The JSON varies assumed access chance and attempt duration explicitly. Its gross ceilings omit equipment replacement and are not net profits. No protected-item nerf is justified solely by this pool calculation. Successful extraction still matters for unsecured loot, recovered artifacts and extraction-specific contracts.

## Interpretation limits

The live pilot uses available equipment, buys ammunition/utilities when funded and falls back to recovery kits. It does not follow the table's fixed full-kit replacement plan. Its wallet data can establish what that mixed strategy earned/spent, not validate the table's human survival assumptions. Returned initial gear is excluded from new-loot counts. Unknown historical deployments and unquoted overflow are reported explicitly. Final stash quotes exclude active equipment, overflow, attachments and future insurance, so they must not be called total account wealth. Cash conservation checks verify observer arithmetic, not fraud resistance.

Still required: targeted protected-rush and insurance-delay strategies, physical route/access measurements, contract/unlock speed over longer sessions, richer behavior cohorts and human balance acceptance. RELEASE_ACCEPTANCE.md retains the complete feature requirements.

## Observed fifteen-minute mixed-strategy cohort

Nine synthetic players used public account/trader/action APIs for 900 seconds with 150 ms injected application delay and 5% request/response loss. They made 45,077 accepted actions and recorded 31 extractions and 15 deaths. There were 31 bounded delivery failures under the configured impairment, no gameplay-rule rejections, no simulation errors and zero recorded navigation stalls. All declared development gates passed. The older 27-player soak and brief unit/model work shared the workstation; this is not isolated production capacity or a WAN/device benchmark.

| Observed cash | Initial | Final |
| --- | ---: | ---: |
| Total credits | 2250 | 3687 |
| Starter credits | 2250 | 1652 |
| Earned credits | 0 | 2035 |

| Observed phase | Credit change | Starter portion | Earned portion |
| --- | ---: | ---: | ---: |
| Purchases | -1986 | -558 | -1428 |
| Insurance premiums | -844 | -205 | -639 |
| Extraction payments | 620 | 0 | 620 |
| Contract stage claims | 1190 | 0 | 1190 |
| Sales | 2457 | 165 | 2292 |

The cohort made 37 paid and 18 recovery deployments. Of 46 recorded settlements, 47 returned stacks were bring-in equipment and 90 were newly recovered stacks. The latter includes protected returns after losses; it is not a per-extraction loot average. There were no unclassified deployment returns or unquoted recovered stacks. Quoted catalog values are not cash income: contract/favorite restrictions can prevent sale. The actual sales row above records real wallet changes.

Known one-time contract payouts contributed 1190 earned credits. Subtracting those claims leaves an observed earned-cash change of 845, but starter-funded spending still subsidized this cohort and 9 operators were in active raids at the cutoff. It is not a steady-state income estimate or total account wealth. All wallets reconciled exactly to their observed phase deltas. No base upgrades were bought by this pilot; their budgets are the separate authoritative quote scenarios above.

Gameplay source fingerprint: `f25561e24c0b1b31250d89e2823a01e0654f29428f2e922fb1a40d9a75656c5e`. The complete report is retained in `tests/evidence/2026-10-30-gameplay-load.json`; analysis/test scope is in `tests/evidence/2026-10-30-economy.json`.

The rank/blueprint addition provides six material-and-credit weapon assemblies (PROGRESSION.md). Buying-only stock-demand rows above do not include that alternative supply, and must not be read as an absolute replacement-rate ceiling for every ranked operator. Current station quotes count only recipes whose rank and workbench requirements are both met; `quoteBaseUpgrades({xp:1400})` exposes high-rank recipe availability separately. Static craft/sell and craft/recycle/sell audits include assembly outputs. Manufacturing rates, time to earn XP/materials and actual strategy substitution remain outside the historical financial sensitivity rows.

## Targeted protected-disconnect cohort

Run `node scripts/raid-strategy-load.mjs --seconds 900 --out /tmp/NEW-REPORT.json`. The runner owns a new private file-backed service and six persistent accounts: one protected-disconnect and one extraction account on each map. Both use free recovery kits, normal navigation/AI/PvP/search/loot/protection and the first eligible protected item. The shared defensive pilot prioritizes protectable loot over optional equipment; it is a measured behavior, not an optimal human route. The extraction account heads for an exit after protecting loot. The disconnect account sends a final stop and then leaves the body exposed to the normal 45-second timer.

Raid snapshot requests are reconnect heartbeats. While disconnected and during final drain, the observer therefore polls only the base profile and reads the raid again after canonical settlement. The final drain is included in hourly returns. Newly recovered non-grant items are sold through normal trade rules; original starter items and allowance remain untouched. Reports separate earned/starter credits, XP, outcomes, protected-item reach times, navigation diagnostics, actual failed actions and observed conservation. They do not grant loot, positions, damage, currency or outcomes.

The corrected short rehearsal verified six normal disconnect settlements and conserved unchanged starter funds. The earlier heartbeat-polling measurement failed its settlement gate and remains retained. Neither rehearsal acquired protected loot or measures strategy returns. The 900-second comparison was launched with its handle recorded in `tests/evidence/2026-10-30-current-strategy-cohort.json`; the completed results below retain that terminal state and all measurements.

One account per map/strategy, different unseeded spawns/loot, synthetic combat choices and no paid-kit/insurance/contract strategy limit conclusions. This measurement complements the mixed-strategy workload and financial sensitivity model; it cannot establish universal strategy dominance, human progression speed or complete anti-farming balance.

## Completed protected-disconnect comparison

The 900-second six-account comparison completed with a 45.22-second final disconnect drain (945.22 seconds total). Every body settled, starter allowance stayed unchanged, observed balances reconciled and no unexpected actions failed. All six accounts reached protected loot. No route stalls or unreachable targets were recorded. Full fingerprinted data: `tests/evidence/2026-10-30-strategy-comparison.json`; retained failed rehearsals and terminal handle state: `tests/evidence/2026-10-30-current-strategy-cohort.json`.

| Map | Protected-disconnect earned credits | Extraction-policy earned credits | Protected / extraction credits per hour |
| --- | ---: | ---: | ---: |
| Relay | 171 | 613 | 651 / 2,335 |
| Reservoir | 65 | 530 | 248 / 2,019 |
| Switchyard | 167 | 532 | 636 / 2,026 |

Protected-disconnect accounts completed 41 attempts: 40 disconnects and one death. Extraction-policy accounts completed 29 attempts: 26 extractions, two deaths and one disconnect during the final measurement cutoff. That cutoff outcome is retained rather than counted as successful extraction. Extraction-policy XP was 367–391 per account, versus 104–118 for protected-disconnect. This policy earned about 3.2–8.2 times as much cash by continuing toward extraction on these runs. Cash rates include the real disconnect exposure/drain; original starter items and 1,500 combined starter credits remain untouched.

The result demonstrates an extraction incentive and a functioning recovery-income route in this synthetic cohort. It does not prove the best possible protected-rush route is dominated: these accounts take the first eligible item, use defensive machine combat and different private loot/spawn rolls, and do not model expert avoidance, paid/protected-capacity gear, full nine-player contention, contracts or insurance. The findings do not justify a protection nerf or establish complete progression/farming balance.
