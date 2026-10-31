# Armor, injuries and medical supplies

New raids use these combat rules. Existing active checkpoints retain their original health/armor/medicine rules and are not filled with new-rule deployments. Full human combat, economy and encounter balance remain release requirements.

## Health and protection

Every new deployment starts with 100 health. Armor is owned equipment with one worn slot, condition, weight, a protection reserve and a movement tradeoff. It does not increase maximum health.

| Armor | Full-condition protection | Body-hit absorption | Movement | Weight | Base price |
| --- | ---: | ---: | ---: | ---: | ---: |
| Scout Harness | 25 | 55% | 100% | 3.5 kg | 55 credits |
| Field Vest | 45 | 65% | 96% | 6 kg | 70 credits |
| Bulwark Rig | 75 | 70% | 85% | 10 kg | 130 credits |

Available protection equals capacity × condition / 100. A body hit spends the smaller of that reserve and the absorption fraction of incoming damage; the remainder reaches health. Spent protection reduces the actual item's condition. For example, a pristine Field Vest absorbs 26 of a 40-damage body hit, leaving 14 health damage and 19 protection. Once depleted, armor absorbs nothing. Wearing a broken heavy rig still carries its movement/weight cost; remove it or repair it at base.

Player head and leg hits bypass armor. Existing headshot damage amplification still applies. Machine attacks count as body combat damage, explosives use body protection with their existing cover/distance rules, and falls/environment hazards bypass armor. Downed operators retain the separate bleed-out/finishing rules. Armor does not grant immunity or automatically regenerate during a raid.

The Outfitter sells all three grades. Owned-material recipes craft light/field/heavy armor with workbench requirements; high-tier/vault loot offers additional recovery opportunities. Insurance quotes/premiums use the actual grade's base price. Repairs preserve the instance and restore its condition through the existing paid repair system. Sell/recycle and normal ownership/escrow/insurance rules apply. Static resale/crafting audits are not a substitute for long-term balance.

## Changing armor in a raid

Backpack offers **Wear armor** for an unbroken carried armor item and **Remove armor** for the worn one. Switching moves the old instance to the backpack and the new one into the worn slot without refreshing either item's condition. Removing requires a free backpack slot. Slots/weight/ownership remain server-controlled; an item still in another tab's stash cannot be worn.

Changing armor requires at least one second without taking damage and no boarding, revival or carried-passenger interaction. Changes have a two-second reuse cooldown and a one-second weapon recovery. Downed operators cannot change armor. Bringing multiple sets therefore costs real weight/slots and does not create instant free protection. Successful extraction banks the same worn/carried instances at their remaining condition; death bags and insurance track those instances normally.

## Injuries

- An individual combat hit that reaches health for at least 25 damage causes bleeding. Armor absorption can prevent reaching that threshold. Bleeding drains one health per second for up to 20 seconds; another qualifying hit extends the duration rather than stacking the rate. Missed ticks are caught up once after interruption/restart. Bleeding damage bypasses armor and can interrupt boarding.
- A leg hit reaching health for at least 15 damage, or fall damage of at least 24, causes a 90-second leg injury with movement reduced to 70%. Armor weight/mobility and carrying penalties still apply. The HUD and status announcements identify the injury.
- Downing uses the existing separate bleed-out deadline. Ordinary wound bleeding clears on downing so revival does not charge damage for time already spent unconscious. A leg injury can remain after revival and may need treatment.

Injuries are deterministic server facts, not client rolls or client-granted damage. They do not disclose an opponent's private inventory/status. Movement prediction uses the same armor/injury speed calculation as authority, converting the local timing correctly. These thresholds and durations need practical counterplay/balance testing.

## Medical choices

| Supply | Health restored, capped at 100 | Stops bleeding | Treats leg injury | Base price |
| --- | ---: | --- | --- | ---: |
| Field Medkit | 35 | Yes | No | 25 credits |
| Pressure Dressing | 0 | Yes | No | 12 credits |
| Field Splint | 0 | No | Yes | 18 credits |
| Trauma Pack | 60 | Yes | Yes | 50 credits |

The free recovery kit retains one Field Medkit, so injury treatment does not require paid gear. Field Medic sells the supplies; recipes consume actual owned salvage and authored sector loot includes medical opportunities. Supplies stack to five and weigh 0.4 kg each. Compatible stacks must have the same medical type and recovery status.

Backpack inspection explains each supply. Use a specific item's **Use** button, or the remappable medicine key for the first applicable carried supply. A two-second server reuse delay prevents repeated rapid healing; the UI updates availability when it ends. Healthy operators cannot spend a supply that treats none of their current conditions. A dressing or splint does not silently heal, and medical supplies do not repair armor. Downed operators cannot treat themselves.

Consumption, healing, wound changes, cooldowns and action receipts commit together. Repeated requests, reconnect and restart cannot heal or consume twice; failed durable writes restore the previous state. HUD/captions/status announcements show injury and clearance. Reports record each medical type used, health damage, armor absorption, wounds, shots hit/fired and actual damage dealt. Damage totals exclude overkill and include absorbed protection spent on valid player hits; machine damage uses actual machine health lost. Protected/spawn-immune hits do not grant damage.

## Compatibility and evidence

Schema 9 prevents older binaries from silently interpreting new armor/medical/injury semantics. Supported migrations preserve items, profiles, credentials and checkpoints. Legacy active raids retain their old combat behavior; new deployments use a separate current-rule raid. Layout versions remain unchanged. The combat update introduced protocol 6; current schema 12/protocol 9 also includes the inventory rules in INVENTORY.md and rejects older clients before equipment debit. Backup tools support schemas 3–12. ECONOMY.md describes the current starter-supply rules.

`tests/raid-medical.test.mjs` covers absorption/depletion, price/weight/mobility choices, server hitscan zones, deterministic wounds, medical differences/cooldowns, armor transfers, save failure, matching prediction speed, missed-tick/replay restart safety and legacy preservation. `tests/raid-browser-medical.mjs` buys/deploys/insures actual items, treats damage fixtures through the UI, changes armor and extracts its remaining condition/report. It does not prove human combat or traversal balance. Broader browser, ownership, rollback and process tests remain required.

The earlier two-hour soak loaded the pre-injury matching build. Its eventual result cannot establish the new combat rules' balance or performance. The new-rule gameplay run and complete acceptance ledger are tracked separately; no full-release claim follows from these component checks.

## Trigger controls

Assault rifles, compact SMGs and support guns support held automatic fire. Sidearms, pump shotguns and scout rifles fire once per trigger press. Hold the remapped Fire key, a primary mouse press in the captured view, or the on-screen Fire control. The first view click captures the mouse without firing. A keyboard/screen-reader button activation remains a single shot; touch-generated follow-up clicks do not spend a second round.

Releasing a trigger source stops that source independently. Losing focus/capture, hiding the page, opening a dialog/communications/backpack, leaving the raid, downing or final death clears held inputs. Closing a dialog or recovering from downing does not restore the old trigger. OS key-repeat events cannot recreate a key cleared by a menu, focus loss or reload; a fresh press is required. Reloading and selecting a weapon release the trigger, finish any already submitted reliable action, and wait for the authoritative weapon recovery timer before requesting the change. Movement can continue during that wait. Newly pressing Fire during a weapon action does not bypass its server timer.

The client permits only one outstanding shot. Its local catalog cadence includes a small scheduling guard; the current server cooldown is adjusted by observed round-trip time so stable transport delay is not paid twice. If an acknowledged cooldown rejection shows that estimate is too optimistic, the current weapon switches to the full reported cooldown. Held input continues after that bounded deferral; other errors retain the normal stop/error behavior. A different weapon or deployment begins a fresh timing estimate. The server always validates ammunition, condition and actual cadence.

A queued held shot records the exact input press, deployment and weapon. Releasing and re-pressing a key cannot revive the old queued shot; a newer press remains usable. Empty/broken weapons are checked again before transmission. Clicks on an unusable weapon are discarded rather than saved for later ammunition or repairs; a semi-automatic weapon needs a new press after it becomes usable. A shot already transmitted can still complete or be safely retried after release. Transport retries reuse the original sequence/payload and do not replay local feedback. Local recoil/muzzle feedback anticipates a request; actual rounds, hits and damage come from authority.

Redundant zero-movement polls are deferred while a firing intent already receives fresh state. Real movement, a necessary stop, stale state or an idle/consumed semi-automatic input still sends ordinary movement/presence updates. The serialized request path still limits very fast weapons when RTT exceeds their catalog delay, especially while moving. Real WAN/asymmetric-path behavior, human weapon feel and broader balance remain acceptance work.

The deterministic authority/transport probe at 150 ms RTT accepts 17 rifle rounds over three seconds, versus seven before the correction, without concurrent requests or extra ammunition debit. The real Chrome/HTTP probe observed 22 accepted rifle rounds over a four-second hold versus 13 on the prior copied build; movement and release still work. These controlled application-delay fixtures are not packet-level WAN measurements.

`tests/raid-trigger.test.mjs` checks all six fire modes, cadence, server recovery times, input edges, cancellation, pending-request bounds and error handling. `tests/raid-browser-trigger.mjs` uses actual keyboard/touch controls and owned ammunition against an isolated authority, including dialog cleanup and reload interruption. Its machines are removed by the fixture; it is not a human encounter or network-balance playtest.

## Ballistics and aiming

New raids use ballistics version 1. Each rifle/SMG/sidearm/scout/support shot traces a server-owned ray against the nearest enemy body or machine silhouette. Operator bodies are vertical 0.5 m-radius cylinders (standing height 1.8 m; downed height 0.65 m); machines use their authored radii/heights. True 3D distance limits range. The ray intersects the body surface, not a target-center aiming cone. Solid blocks/roofs and the thin ramp surface clip bullets analytically, including cover thinner than a movement/visibility sample step. Squad friendly fire remains disabled and squad bodies do not block these shots. Smoke obstructs sight but does not become bulletproof cover.

The Pump Shotgun fires eight pellets per shell. Its listed damage is the full body-hit shell total, not damage per pellet: 65 at pristine condition before armor, head amplification or machine armor/core modifiers. Four pellets occupy the inner third of a 0.06 rad angular spread and four the outer ring; the server rotates that pattern by accepted shot ordinal. A replay does not reroll a spread, and clients cannot supply pellets, seeds, damage or target IDs. Damage begins falling after 7 m and reaches 25% at 20 m. Each pellet stops at the nearest body/cover. All pellet intersections are resolved as one simultaneous shell, so killing a front machine with the first pellet does not let remaining pellets pass through it or create duplicate salvage/kill credit.

Player pellet damage is combined per body region before armor/injury handling, allowing a substantial combined body hit to cause bleeding. A shell counts once in shots fired/accuracy even when it hits multiple rivals; the report also records pellet contacts/fired. Spawn-protected contacts do not earn hit credit or damage. Health/protection damage excludes overkill. Ammunition, condition, hit facts, wounds, kills and ownership changes share the normal durable action/receipt/checkpoint transaction; failure rolls them back together.

Hold the remappable **Aim down sights** key (default left Shift), hold the right mouse button in the captured view, or toggle **Aim** on screen. Ordinary guns use 1.3× magnification; the Scout Rifle uses 2.5× and an owned Survey Optic multiplies magnification by 1.5. The projection uses the selected base FOV rather than replacing it with a hard-coded camera setting. Aim reduces look sensitivity, centers the held weapon and removes its idle sway. Reduced-motion mode changes projection immediately. New-raid camera and shot rays share the same 1.55 m eye height. Aiming grants no damage/armor bonus, wall penetration or hidden-target information. Focus/menu/downing/deployment cleanup clears aiming together with held input; touch Aim exposes a pressed state and preserves the minimum target size. Previous complete saved keymaps retain their bindings, choosing an unused key if a new control conflicts.

Schema 12/protocol 9 fence incompatible binaries/clients before valuable changes. Migration leaves previous profiles, credentials, gear and active checkpoints intact. Existing raids without the ballistics marker retain their original single-hit rules and camera height, and cannot receive new-rule admissions. They can reconnect/finish under the current client, whose weapon inspection identifies the legacy rules. Unknown future ballistics versions fail closed at restore. Backup tools support schemas 3–12.

`tests/raid-ballistics.test.mjs` covers geometric range/cover, deterministic pellets, falloff, multi-rival hits, immunity, exact consumption, duplicate kill/replay safety, write rollback, forged ballistic fields and legacy migration. `tests/raid-browser-ballistics.mjs` exercises owned optics, actual keyboard/mouse/touch aiming, camera alignment, legacy keymaps and a real shotgun action through the UI. Its actor/cover positions are controlled fixtures. Full arsenal integration, human weapon/encounter balance and device/WAN acceptance remain open.

## Consistent cover and exposed targets

Current ballistics-version-1 raids use the same exact solid/ramp clipping for opponent visibility, machine perception/locked strikes, utility placement/explosion cover, inventory interaction and exit marking. Thin cover cannot be skipped just because it falls between old sight samples. An exposed head can make an otherwise covered operator visible; a completely hidden downed body cannot be revealed by testing a point above its actual height. Cover and smoke must both be clear along the same sight ray, so a smoked head plus a covered torso does not expose the operator by combining two unrelated clear tests. Squad markers retain their deliberate through-cover teammate behavior. Legacy active raids keep their original sampled cover and sight policy.

`tests/raid-cover.test.mjs` retains seven pre-fix failing cases and tests current thin cover, head/downed visibility, matched smoke/cover, machine attacks, blast damage, throws and legacy preservation. It also finds a collision-valid routed approach with a clear exact interaction line for all 48 current map caches/exits. `tests/raid-browser-cover.mjs` checks enemy actor addition/removal, blocked blind fire and a real owned utility throw through the UI. Its panels are server-only fixtures; it does not claim rendered authored-wall pixels or human encounter acceptance.

PROGRESSION.md records the audit that ordinary classes, weapon upgrades, pets, abilities and wallet values cannot grant persistent raid power. Rank-based assembly expands acquisition choices using owned ingredients; it does not alter field stats.

## Field audio feedback

The six raid firearm definitions have distinct original synthesized firing signatures. Local firing sounds accompany the predicted trigger cue; they do not confirm an authoritative hit. Accepted reload, equipment swap, search, pickup and medical actions have separate cues. Rejected actions do not play an acceptance cue; a reload cue marks starting the action, not finishing its server cooldown.

Local authoritative damage, downing, revival, boarding start/interruption, extraction and elimination have distinct transition cues. Initial reconnect snapshots are silent, repeated snapshots do not repeat these transitions, and ending a raid does not also play boarding interruption. Spectating does not turn a teammate's health into local damage feedback. Existing health, injury, interaction and outcome text remains available. Volume/mute applies to these sounds together with machine and utility sounds; voice retains its separate controls. Audio uses no additional hidden-player positions or world state.

The actual Web Audio engine renders all six weapon signatures, twelve action/status cues, five machine cues and four utility cues in `tests/raid-browser-audio.mjs`, including silence under mute, stereo direction, a twelve-voice ceiling and node release. A local browser scenario checks native firing, acknowledged reload, silent rejection and one damage cue. This verifies synthesis and integration; final mixing and human sound readability remain release acceptance work.
