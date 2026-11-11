# Extraction Raids — reference analysis and design direction

Status: working design note, updated 2026-11-10. Extraction Raids is an opt-in
HeadShotz mode; this document does not affect Battle Royale, Squad Royale, arena/team
modes, the original cooperative Extraction, or the main menu.

## Sources inspected

- ARC Raiders official site feature blocks and FAQ page (`arcraiders.com`): game loop,
  raid length, extraction types, safe pocket, squad sizes, vendors/crafting.
- ARC Raiders official `/game` overview page: third-person multiplayer extraction
  shooter, 30–40 minute raids, base "Speranza", gear loss on death except safe-pocket
  items, extraction elevators/metro/air shafts/keyed raider hatches, ARC machine parts
  as salvage, solo/duo/trio matchmaking.

Limitations: I did not view gameplay footage or listen to game audio for this note.
Anything about feel, pacing, camera framing, sound design, or machine readability is
design inference from the official descriptions and general third-person-shooter
conventions, not an observation of ARC Raiders footage. No ARC Raiders name, map,
character, item or asset is reproduced here; HeadShotz uses its own names and code.

## Observed facts (from official material)

- Raid runs are time-boxed (30 minutes, extended on the 40-minute maps); extraction is
  a deliberate end-of-raid decision, not an open-ended session.
- Death forfeits carried gear and collected materials; only safe-pocket items persist.
- Multiple exit kinds have different access rules and key requirements.
- Machines ("ARC") are the primary environmental threat; their components can be
  salvaged and carried out.
- Between raids the player returns to an underground base to sell, craft, buy, upgrade
  perks and accept vendor quests.
- Squads are small (two or three), cross-platform, and set adjacent solo play.

## Design inference relevant to HeadShotz

The reference's tension comes from three intertwined loops: (1) being seen or heard by
machines, (2) deciding which loot is worth its carry cost and risk, and (3) leaving
before the raid closes. Combat is readable and directional; machines are dangerous but
can be avoided with cover, sound discipline and the timer. Extraction rewards the
decision to stop looting, not the amount looted.

## Current HeadShotz Extraction Raids

Implemented and graded locally: three sectors with terrain, five machine classes plus a
boss, authoritative line-of-sight/noise detection, guard caches, boolean raid loot,
protected pocket, four exit kinds with countdown/contested states, squad revive/carry,
opt-in roles, hit feedback, minimap/compass, rarity celebration, persistent stash and
base economy.

Observed differences and gaps:

- Raid rows show rarity but not carry weight or sale value, so comparing loot requires
  opening the modal for each item; risk/reward is not understandable at a glance.
- Backpack header shows slot/weight/protected counts but not the value carried.
- Container rows do not say when the pack is full or too heavy, so the player learns the
  rule from a rejection instead of before acting.
- The insertion machine patrol is telegraphed in text; directional awareness of
  off-screen threats and incoming damage was limited to the minimap and stereo audio
  cues before iterations 15 and 16 added the on-screen threat and hurt layers.
- Art is stylized/low-poly rather than UE5 realism; the achievable goal is coherent
  atmosphere and readable action, not visual equivalence.

## Achievable improvements (ordered by observable gameplay impact)

1. Field salvage appraisal: per-item weight and base sale value chips in backpack and
   nearby-loot rows, plus carried salvage total, all derived from shared authoritative
   functions (iteration 14, COMPLETE in local scope).
2. Capacity-aware container rows: full/overweight warnings driven by the same snapshot
   (iteration 14, COMPLETE in local scope).
3. Directional threat feedback for blind spots and audio-off play: yaw-derived off-screen
   machine markers with charging treatment (iteration 15, COMPLETE in local scope).
4. Directional incoming-damage feedback: a server-recorded, 1.6 s attacker bearing rendered
   as an audible/blind-spot arrow (iteration 16, COMPLETE in local scope).
5. Ammunition readiness: magazine/capacity in the HUD from authoritative `self.ammo` and
   catalog `mag`, with warn below 25% and a critical empty-reload alert (iteration 17,
   COMPLETE in local scope).
6. Extraction interaction priority: an open exit inside the beacon's 4 m interaction
   radius remains the single E target even when ambush salvage is nearer; ordinary loot
   ordering still applies outside the open window (iteration 18, COMPLETE in local
   presentation scope; natural extract/secure acceptance still PARTIAL).
7. Machine-enemy presentation detail: every machine hull now carries a deterministic
   procedural worn-plating texture with seams, bolts, rust and chips; blue-lit cores gain
   an additive halo that follows the authoritative state/phase colour, and each class
   carries a distinct detail silhouette (scout antenna/fins, hunter dorsal ridge/mast,
   heavy hazard chevrons/vents, flyer rotors/struts, overlord crown/vents). Weak core
   hits additionally spawn a pooled camera-facing cyan flash/ring/spark burst and a
   bounded tinted light at the authoritative core, anchored by the weak hit token's new
   `core` coordinate and suppressed/turned static under reduced motion. Presentation
   only; rules, AI, hit detection and other modes are unchanged (iterations 27 and 29,
   COMPLETE in local presentation scope; human aesthetic acceptance UNVERIFIED).
8. Authoritative idle look synchronization: while standing still, the client now sends
   a view-only move packet when the local view has not reached `self.yaw`/`self.pitch`,
   so the compass, minimap, threat ring and hurt arrow stay authoritative instead of
   freezing on the last movement packet. Pure idle with unchanged look still defers
   (iteration 19, COMPLETE in local authoritative scope).
9. Encounter pacing review with human playtesters (blocked: no playtest cohort).
10. Hosted transport/reconnect and physical-device acceptance (blocked: no deployed WAN
   or devices owned/testable here).

Human balance, pacing and "fun" judgments are explicitly unverified by automated tests.

## Static Pages offline deployment (P0)

Austin's playable target is `https://jdubb357.github.io/headshotz/`, where no Node raid
host exists. The ordered slices in `EXTRACTION_BACKLOG.md` (P0) build a same-rules
in-page `RaidService` for that static site while leaving `node server/main.mjs`, the
hosted transport, and all other modes intact.

Slice 1 adds `shared/raid-static.mjs`, the single transport-mode detector used before
any raid request:

- `offline=1` in the query string selects offline mode explicitly.
- A missing `<meta name="headshotz-raid-service">` means the page was served statically
  (only the Node host injects that meta).
- An explicitly failed `/api/profile` probe is also treated as offline; an unchecked
  probe does not change the decision.
- The result carries a reason string (`offline-query`, `no-service-meta`,
  `profile-unreachable`, `service-meta`) for later diagnostic logging.

`readServiceMeta`/`browserRaidMode` read the browser document defensively, and the module
stays DOM-free at import time so Node tests can use it directly. No routing or gameplay
behaviour is wired to the detector yet; that lands with the in-page dispatcher and Pages
DEPLOY routing slices.
