# Extraction Raid gameplay backlog — full-mechanics audit

Last audited: 2026-11-12 (iteration 92: director note 1 first item landed — the bright green cone vegetation on roadsides, foundations and slopes is now flat-blade instanced grass tufts with wet-olive colours and unchanged instance budgets; static offline and mobile HUD graders green). Current project: P0 Static Pages offline raid — COMPLETE. Feel priority: GUNFEEL complete; lighting/ground, building variety, slim HUD, main-game controls, leg walk, map cleanup, readable spawn road, articulated machines, edge highlights, window culling, held-fire/LOS, the main-game touch deck, the shipped art/human upgrade, route encounters/loot, the HUD bearing fixes, visible ground loot and flat roadside grass landed. → NEXT: rest of director note 1 — wood-slat crate, ribbed steel barrel grounded, textured stoops/planks, striped tower façade, readable radar exit arrow, collider-stop thump; then note 2 (scout standoff/engagement readability), note 4 (window/door coherence) and note 5 (desktop keymap) follow. Note 1 / item 1 overall awaits Austin's live iPad/phone playtest. Do not turn the raid into a different game or require raid setup to play other modes.

This backlog is scoped only to the opt-in Extraction Raid mode. It does not change,
and must not require changes to, Battle Royale, Squad Royale, arena/team modes, the
original cooperative Extraction mode or the hub/main menu. Every item is closed
only when the authoritative service and the playable raid client both support the
behavior and it has been exercised; a passing unit test alone is not gameplay
acceptance. Visual polish alone is not primary; stay scoped to raid UI, raid rules
and raid progression.

## Director P1 — controls must match the main HeadShotz game (iteration 70, 2026-11-11)

Status: IMPLEMENTED 2026-11-11 (iteration 70 tuning + iteration 77 held-fire/LOS follow-up); live
two-thumb playtest pending. The playable raid client now uses the main game's input and
camera tuning instead of its separate scheme. `raid-online.mjs` matches: `game.js:1075`
mouse look `.0021*S.sens*zoomSens()`; `game.js:1078-1079` FOV sensitivity ratio `pow(r,.85)`;
`game.js:1094-1101` touch pad on the left 42%, floating base under the thumb, radius 52, .14
dead zone, `pow((n-.14)/.86,1.15)` gain, rim sprint, raw look deltas; `game.js:1102-1105`
`applyTouchLook` dt*38 smoothing, `.0052*S.sens*zoomSens()`, 0.6 near-reticle damping,
`aimPull`, `1+min(.5,speed/4000)` acceleration, pitch *.9; `game.js:1153-1157`
nearAim/aimPull 5° cone, 60 m cap and dt*3.2/*.6 blend; `game.js:1277-1279` crosshair-owned
trigger with the reticle turning red. Raid keeps its server pitch clamp ±1.2 and adapts chest
height to machine bodies; raid has no separate aim-assist toggle, so it uses the main game's
default-on assist. Exercise evidence (temporary harness at /tmp/hsz-cap/verify-controls3.mjs):
844 touch moved 3.6 m while tracking and auto-firing a scout 75->15 hp -> 27 ammo (TOUCH PASS);
1024 keyboard S+ArrowLeft moved 12.0 m while auto-firing 75->15 hp -> 28 ammo (DESKTOP PASS).

Iteration 85, 2026-11-12: the deck now matches the main game's round-icon shape. The
crosshair source is marked `auto` in `raid-trigger.mjs`, so the reticle fires every
weapon class (AR, pistol, shotgun) while it covers a machine; keyboard/pointer presses
keep their semi-automatic edge. An empty magazine reloads automatically while sighted
when a compatible reserve exists, Aim is hold-to-zoom, Swap equips the other carried
weapon, Fire and Sprint are removed, and Interact is contextual and labelled USE.
Exercised offline: AR 30→29, pistol 12→11, shotgun 6→5 while the reticle stayed on a
staged scout; empty shotgun magazine 0→6 with a shell reserve, no Reload tap; Aim
`aria-pressed`/`dataset.aiming` true→false; Swap sets weaponId to the second pistol.
`raid-browser-mobile-hud.mjs` (91% unobstructed at 1024, 80% at 844) and Node 1247/1247 green.
Still needs Austin's live two-thumb playtest; screenshots in `~/headshotz-loop/shots/latest/`.
Screenshots: `~/headshotz-loop/shots/latest/{before,after}-{1024,844}.png`,
after-844-hit.png, after-844-stick.png, after-1024-fire.png. Mobile HUD and static-offline green;
Node 1247/1247. Known gap: physical iPad/phone latency/fatigue unverified, and the 1024
red-reticle screenshot can race the target frame (cyan reticle while the target lapses).

Follow-up (iteration 77, 2026-11-11): per-frame `trigger.tap()` was replaced by
`trigger.hold('crosshair', sighted && automatic)`, so automatic weapons keep firing until the
reticle loses the lane and semi-automatics keep the one-shot-per-press contract. The reticle
and touch aim assist now use the server's shape — weapon range, lateral `atan2(radius,
horizontal)`, pitched hitY inside the machine body, and `clearLine` to the hit point — and
`machinesInView` is gated by `machineInSight`, so the assist cannot pull through cover.
Exercised offline: 1024 keyboard walk+turn auto-fired and killed a hunter; 844 two simultaneous
thumbs (left move, right look) also killed one; in the cover fixture HEAD fired through a
head-visible/chest-blocked wall and at 72 m while the current reticle stayed false and fired
nothing. Node 1247/1247, trigger/static-offline/mobile-HUD green. Still needs Austin's live
two-thumb playtest over real WAN cadence; screenshots are in `~/headshotz-loop/shots/latest/`.
Iteration 85 extended the crosshair auto flag to pistol and shotgun as well, added automatic
empty-magazine reload, hold-to-zoom Aim, Swap and contextual USE, and removed Fire and Sprint.

## Director P2 — enemy legs must move (iteration 71, 2026-11-11)

Status: COMPLETE 2026-11-11 — hunter and Warden (overlord) legs are now articulated
joints rather than single rigid pivots, and their gait is driven by the snapshot
movement speed. `raid-models.mjs` builds each hunter leg as hip → knee → foot (four
legs, diagonal phases) and each Warden leg as hip → knee (four). `updateActor` derives
cadence `0.9 + speed*0.28` cycles/s (capped 2.3) and amplitude `0.1 + speed*0.09` rad
(capped 0.46), flexes the knee on the swinging leg, counter-rotates the foot pad to stay
flat, and eases a stopped machine back to a planted stance via `walkBlend`; gait phase is
seeded from the machine's world position and `state.reduced` stops it. Exercise evidence:
`/tmp/hsz_cap_legs/bench.mjs` (not committed) hunter frames at speed 4.2 differ by ~0.3 rad
at hip/knee between frames 12 and 26, speed 1.1 gives a shorter stride, and 40 idle frames
return every leg to rotation 0; gameplay capture at 1024x720 and 844x390 shows stiff legs
before and knee flex/stride after. Screenshots: `~/headshotz-loop/shots/latest/`
before/after 1024 and 844 plus after-1024-stride, after-844-stride and bench leg frames.
Grader `raid-browser-machine-models` green (hunter detail 256 px changed), Mobile HUD and
static-offline green, Node 1247/1247. Known gap: the cycle is time-driven, not foot-locked,
so the stance foot can skate slightly; scout/flyer hover with no locomotion animation.
Next: P3 fix the map.

## Director note 2 — readable in-world machines (iteration 74, 2026-11-11)

Status: COMPLETE 2026-11-11 — the scout at spawn is rebuilt as one cohesive amber armoured
sensor pod: graphite belly yoke with hip sockets buried inside it, dark visor/brow cowl around
the glowing eye, dorsal plate, sensor beak, side plates, steel fins and antenna, on three
articulated hip→knee→foot legs with amber knee guards and round planted pads. Hunter hull
covers its four hip pivots with a pelvic girdle and socket balls; thighs/shins are parented to
the hip/knee groups via a new local `limb()` helper (the old `hull` closure was bound to the
model root, so struts dropped below the hips). Foot pads cancel hip+knee pitch to stay level
with terrain. Presentation only: no world/collision/spawn/loot/extraction rule changes.
Evidence: `raid-browser-machine-models` green (scout detail 311 px, hunter 416; worn meshes
15/11, features and core halo unchanged), `raid-browser-mobile-hud` green, static offline
green, Node 1247/1247. Screenshots `~/headshotz-loop/shots/latest/` before/after 1024 and
844, action frames at both sizes, close attachment frame and a 3x crop. Known gap: at
844x390 and 10 m the leg articulation collapses to a few pixels, and the hunter attachment
was verified on the isolated bench rather than a live wandering frame. Followed by director note 5
viewmodel edge highlights, sleeve cuff and thicker brighter tracer (iteration 75).

## Director note 5 — viewmodel edge highlights, sleeve cuff, tapered tracer (iteration 75, 2026-11-11)

Status: COMPLETE 2026-11-11 — the gun keeps its dark gunmetal PBR body while a Fresnel rim on
the metal/poly/rubber groups catches cool highlights at the silhouette, and warm additive
`EdgesGeometry` glints (30° threshold, .20 opacity) draw only at hard panel seams on the
metal/alu/chrome groups. The sleeve forearm is narrower than the old cone and now ends in a
brighter rolled cuff band with a dark seam fold and a closing elbow hem. Each shot carries a
pooled tapered additive cylinder beam (near radius .011 m, far .0022 m) with a vertex-colour
fade and a 185 ms bleed, width authored in metres (not `viewScale`) so the 720 m sector world
does not blow the near ring into a screen wedge; the original 2-point tracer Line is retained,
and the pooled effect trail was dimmed .62→.34 so one streak reads. Presentation only; the
mesh material stays `MeshStandardMaterial` and reduced motion suppresses the beam.
Evidence: Node 1247/1247, static-offline green (deployment, move, hit, loot, extraction, no API
traffic, errors []), mobile-hud green (1024 compact .0806, 844 .1806, unobstructed .9194/.8194),
machine-models and effects green (tracerCollision true, 2 tracer points, pool 16, tagged 244 /
untagged 0, errors []), same-spawn and fire frames captured at 1024x720 and 844x390. Known gap:
`raid-browser-viewmodel.mjs` still times out at `play.dataset.packOpen==='false'` (test line
441), reproduced identically at HEAD with these three files stashed — pre-existing headless
environment flake, assertions before that point pass. Visual gap: the beam has no smoke or heat
texture and its white core nearly vanishes on the white plaster façade, fabric cuff reads as a
band more than a tailored hem, and enemy-gun glint/beam draw cost is unmeasured on a physical iPad.

## Director P3 — fix the map (iteration 72, 2026-11-11)

Status: COMPLETE 2026-11-11 — presentation defects found by the audit were fixed in
`raid-environment.mjs` without touching frozen world data. Authored `sign` props no longer
use floating `THREE.Sprite` billboards: façade signs gain wall-mounted jibs and a board
clamped below the wall top; free-standing signs gain two terrain-sampled posts, hazard
sleeves, concrete footings and tie bars, so the `QUARANTINE LINE` insertion sign is visibly
anchored. Exact duplicate block volumes are drawn once via a per-signature set, removing 365
coincident solids (relay 91, reservoir 179, switchyard 95) while leaving `world.blocks`,
collision, spawn/exit coordinates, navigation, loot and frozen V8/V9/V10 assertions unchanged.
Sector audit at `/tmp/hsz-mapfix/audit.mjs`: all three sectors report 0 blocked sites,
0 unsupported sites, 0 buried blocks, and 0 route failures across 156 spawn↔exit pairs;
no holes, invisible-wall collision or stuck spawn/extraction remain. Evidence: static
offline, structures, scenery and mobile-HUD graders green; Node 1247/1247; screenshots
`~/headshotz-loop/shots/latest/before-1024.png`, `after-1024.png`, `before-844.png`,
`after-844.png`, `after-1024-anchor.png`, `after-1024-post.png`. Known gap: the duplicate
fix is not frame-visible because the old copies were exactly coincident, and the sector
audit used the existing 0.4 m test radius rather than a live walk of every route. Next:
older note 4 viewmodel feel.

## Director P3 follow-up — duplicate window openings and worn near road (iteration 76, 2026-11-11)

Status: COMPLETE 2026-11-11 — presentation-only repairs in `raid-environment.mjs` and
`raid-view.mjs`; world/collision/loot/authored data unchanged. `uniqueWindowProps` collapses
window props with an exact shared footprint, keeping the lit copy when a pair disagrees, for
the world+scenery draw list and the doorway-window gap test: relay 8,823 -> 8,374 unique
openings (449 duplicate groups / 449 copies culled; 364 had a lit pane kept), reservoir 432,
switchyard 599. Free-standing signs keep two terrain-sampled posts, hazard sleeves, concrete
footings and tie bars, so the QUARANTINE LINE insertion sign stays visibly planted. The near
asphalt gained a lifted base value plus faded centre dashes, pale edge lines, crack seams,
aggregate repair patches and shoulder chips; a shadow-free overhead warm `skyBounce`
directional (.62 × daylight, damped for rain/ash, off at night) lifts roads/pavement/rooflines
without flattening face sun direction. Evidence: Node 1247/1247, structures green (frames
33,496, windowSills 7,967, deterministic, errors []), static-offline green (loot/extract, no
API traffic), mobile-hud green (compact .0806/.1806, unobstructed .9194/.8194, all touch
actions). Screenshots in `~/headshotz-loop/shots/latest/` before/after 1024 and 844, sign
frames and action frame, same pinned dusk condition. Known gap: headless Chrome cannot verify
"perceived frame rate"; the overhead fill is one non-shadow directional and dedupe removes
~449 window instance groups, so expected cost is neutral-to-lower but a physical iPad run is
unverified. Next: director note 1 controls.

## P0 — Static Pages offline raid (CURRENT PROJECT — do this first)

Austin plays only at https://jdubb357.github.io/headshotz/ (static GitHub Pages). There
will be no public Node raid host. The EXTRACTION RAIDS DEPLOY button on that site must
launch the new `raid-online.html` / `RaidService` stack in offline mode so a phone
browser can complete a solo raid versus AI machines with no `/api` backend.

Status: COMPLETE 2026-11-10 — all ordered slices 1–12 are COMPLETE. A solo offline
raid versus AI machines is playable and persists on static-file/GitHub-Pages-style
hosting with no Node raid server: deploy, move, fight machines, loot, extract, reload
a settled profile/stash, or reload and resume an unfinished raid. IndexedDB is the
primary browser store with a localStorage fallback. P0's approved exception to “do not
change the hub/main menu or the original cooperative Extraction” ends here: its
legacy entry remains reachable from a clearly labeled secondary button.
Do not weaken the online/Node path or move hosted-server authority onto an untrusted
client. Offline mode is an in-page copy of the same `RaidService` rules.

## Post-P0 priority — Mobile/touch HUD declutter (iteration 59, 2026-11-11)

Status: COMPLETE 2026-11-11 (tabbed base lobby shipped iteration 62) — raid-view HUD and
between-raid base slices are complete; offline boot form, offline-only surface hiding and
naming remain covered by the graders below. The compact landscape touch HUD leaves
at least 75% of the 1024x720 and 844x390 raid view unobstructed (92.2% and 82.2% measured
by union of visible HUD surfaces). A slim translucent top strip carries HP (bar plus
number, with a damage flash and warn/critical/downed colours), ammunition/magazine,
raid time and backpack slots. Zone/weather/compass/field-objective copy appears transiently
on spawn and zone/objective change, then fades; the offline connection/RTT readout stays
hidden. A bottom-left virtual thumbstick replaces the arrow grid and drives the same
authoritative move action; a drag on the right half turns the camera through the existing
touch view handler. The bottom-right deck is a 3×3 cluster of round 44px+ icons
(Map, Utility, Interact, Slide, Vault, Swap, Aim, Reload, Jump) that matches the main
game's `#touch .tb` shape: there is no Fire button, the reticle auto-fires the equipped
class, an empty magazine auto-reloads, Aim is hold-to-zoom, Swap equips the other weapon,
and Interact appears only when the authoritative snapshot has something in reach and is
labelled USE. Backpack stays in its top-right context slot. Back to base, Account, Guide and Settings collapse behind one 44px
raid-menu icon. Safe-area insets are applied throughout, compact surfaces do not overlap,
and the crosshair centre remains clear. Settings offers Auto/On/Off "Compact HUD"; Auto
enables on coarse-pointer landscape only, so desktop keyboard/mouse and portrait layouts
keep their existing readable HUD. Evidence: `tests/raid-browser-mobile-hud.mjs` (static
server, zero `/api`, touch emulation, compact/briefing screenshots, thumbstick authoritative
travel, right-half yaw drag, all-class crosshair auto-fire, automatic empty-magazine
reload, hold-to-zoom Aim, Swap, contextual USE, menu collapse and overlap checks) plus
`tests/raid-browser-hud-layout.mjs`, `tests/raid-browser-hud-theme.mjs`,
`tests/raid-browser-accessibility.mjs`, `tests/raid-browser-static-offline.mjs` and the
full unit suite green. Honest gap: physical-device feel on Austin's iPad/phone and
subjective combat readability remain UNVERIFIED (P7); browser touch emulation covers geometry,
target size and authoritative input but not sensor/pointer latency or human fatigue.

Base lobby shipped 2026-11-11 (iteration 62): the between-raid base is now one hero Deploy
screen with credits/stash/loadout/sector at a glance, map/objective/recovery/primary
controls, and one big DEPLOY action. A compact tab bar (Loadout, Traders, Workshop,
Contracts, Records, Sector, online-only Squad) shows exactly one group of panels at a
time, with the tab bar, the hero card and the operator row fixed while long panels scroll
inside their own region. Offline hides the Account control and account dialog (no
password/recovery/session surfaces can open), the Squad tab, connection/latency controls,
squad communication and the network badge; local sign-out remains in the identity row.
The first-raid guide is a one-line dismissible strip (and is hidden entirely in compact
landscape). Player-facing naming stays THE SECTOR / CLASSIC EXTRACTION and forbidden jargon
(protected overflow, appraisal, vitality, field-objective deploy plan, persistent
extraction, server-owned, authoritative, reconciliation) is asserted absent. Evidence:
`tests/raid-browser-base-lobby.mjs` — static server, zero `/api`, 1024x720 and 844x390
touch layouts, page does not scroll, one panel group per tab, offline surfaces hidden,
big DEPLOY target, one-line dismissible tip, banned phrases absent, screenshots
`/tmp/hs-base-lobby-1024x720.png` and `/tmp/hs-base-lobby-844x390.png`. `tests/raid-browser-menu.mjs`
was rewritten for lobby semantics (flex lobby, hero DEPLOY, tab switching, 44px targets,
no page scroll desktop/mobile, `/tmp/hs-menu-desktop.png`, `/tmp/hs-menu-mobile.png`).
`tests/raid-browser-static-account.mjs` now proves offline exposes no Account entry point.
Honest gap: portrait 390x844 is usable but tabs scroll horizontally; 1024x720 base was
not exercised on a physical iPad.

First-person gun presentation shipped 2026-11-11 (iteration 63): offline raid now boots
first-person instead of showing the operator's back, so the weapon — the thing the player
actually controls — is visible within seconds of deploying. The viewmodel pose was raised
and pulled closer/slightly larger (home x .2, y -.135, z -.46, scale .74) so both hands and
the sight clear the bottom touch row at 1024x720 and 844x390. Recoil kick is stronger with
a fast exponential settle and a bounded sustained climb; muzzle bloom, warm muzzle light
and tracer are brighter and longer-lived, with a larger pooled world shot light, all still
suppressed under reduced motion. Evidence: `tests/raid-browser-viewmodel.mjs` (pose/kick/
flash/heat/casing/reload/visibility, screenshots `/tmp/hs-viewmodel*.png`), plus
`tests/raid-browser-mobile-hud.mjs` and `tests/raid-browser-base-lobby.mjs` green on
rerun and the full 1247-test unit suite. Gameplay screenshots
`/tmp/hs-field-1024x720-after.png`, `/tmp/hs-field-844x390-after.png`,
`/tmp/hs-combatfire-1024-0.png`, `/tmp/hs-combatfire-844-0.png` and
`/tmp/hs-combat-aim-1024.png`, compared against
`/tmp/hs-field-1024x720-baseline.png` and `/tmp/hs-field-844x390-baseline.png`. Honest gap:
weapon/hand materials still read flat and plastic, the wood buildings remain boxy with soft
lighting, and trigger-feel on a physical iPad is still unverified.

Worn viewmodel finish shipped 2026-11-11 (iteration 64): the merged gun material groups now
carry cached procedural sRGB canvas maps (brushed/worn steel, wood grain, pebbled leather
with stitch seams, woven cloth) as Map/BumpMap, with hand tints changed from cyan/beige to
olive sleeve + leather glove. The optic is a dark compact scope with its own warm emissive
dot instead of a blown-white plane, and ADS fades the forearms early and the rear stock in
the back half of the blend so the sight picture stays clear. Barrel heat skips the reticle
and glass so the dot survives firing. Evidence: `node tests/raid-browser-viewmodel.mjs`
PASS (PBR, lighting, reflections, aim/return, reload disposal, visibility; no browser
errors), `tests/raid-browser-mobile-hud.mjs` PASS 92.1% / 82.2% unobstructed,
`tests/raid-browser-static-offline.mjs` PASS (deploy/headshot/loot/extract, no API traffic),
full suite 1247/1247. Screenshots: baseline `/tmp/hs-before-combat-aim-1024x720.png`; after
`/tmp/hs-after6-combat-aim-{1024x720,844x390}.png`,
`/tmp/hs-after6-combat-fire-{1024x720,844x390}-0.png`, overlay isolation
`/tmp/hs-ov-aim-fade.png`, `/tmp/hs-ov-hip-fade.png`. Honest gap: hip hands still read as
one soft dark mass without knuckle seams, stock top faces stay flat, world still washed-out
and boxy (priority 5), and the actual trigger punch/physical-device feel remain UNVERIFIED
(P7). Next feel priority: MOVEMENT FEEL (acceleration, bob, sprint FOV, landing dip,
footsteps, touch dead zones).

Movement feel shipped 2026-11-11 (iteration 65): a presentation-only camera feel layer now
adds a grounded stride scaled by server movement and sprint, suspends it when aiming or
airborne, widens the view by ~6 degrees while sprinting (+4 while sliding) with the optic
FOV still winning, crouches and pitches the camera on slide, and drops/pitches it on landing
with a spring recovery scaled by fall height. Footfalls alternate stereo pan through a new
synthesized `footstep` cue. The touch thumbstick gained a 12% dead zone and rim curve for
precision walking, and touch look now banks sub-pixel jitter so a resting finger no longer
shivers the crosshair; authoritative pose, fire origin and ballistics are untouched, and
reduced motion keeps every offset at zero. Evidence: runtime probe
`/tmp/hs-move-check.mjs` (idle bob 0, walk .0077, sprint fov 80.83/bob .025, aim fov 61.11/
bob 0, landing dip .0346 m/pitch −.0242 then recovered, 1 px look jitter 0 rad vs 40 px
drag −.24 rad, phone sprint fov 80.86), `tests/raid-browser-viewmodel.mjs` PASS,
`tests/raid-browser-mobile-hud.mjs` PASS 92.1%/82.2%, `tests/raid-browser-static-offline.mjs`
PASS, `tests/raid-browser-audio.mjs` PASS 23 distinct action cues,
`tests/raid-audio.test.mjs` 6/6, full suite 1246 pass + the known intermittent matchmaking
ECONNRESET that passes 11/11 alone. Screenshots: `/tmp/hs-move-idle-1024x720.png`,
`/tmp/hs-move-walk-1024x720.png`, `/tmp/hs-move-sprint-1024x720.png`,
`/tmp/hs-move-sprint-aim-1024x720.png`, `/tmp/hs-move-stop-1024x720.png`,
`/tmp/hs-move-landback-1024x720.png`, `/tmp/hs-move-sprint-844x390.png`. Honest gap: a still
cannot show the stride/landing pulses, the world and gloved hands remain dark and flat
(priority 5/4), and the synthesized footstep is unjudged on a physical phone. Next feel
priority: ENEMIES (readable procedural machines and a scout telegraph/stagger loop).

Naming shipped 2026-11-11 (iteration 60): the mode is "THE SECTOR" in the page title, base
heading and main-menu raid banner, with the original co-op raid kept as CLASSIC EXTRACTION.
Visible base copy no longer says Persistent Extraction, Server-owned, authoritative or
reconciliation, and `tests/raid-browser-mobile-hud.mjs` asserts that.

Fixed for the block 2026-11-11 (iteration 61): the offline boot path no longer paints the
online account/password form at any point — `#auth` is hidden in the markup, `?offline=1`
is honored synchronously, a "Preparing the sector…" notice covers store hydration, and
`tests/raid-browser-mobile-hud.mjs` reloads under a document-start observer that proves the
password field never becomes visible.

Closed for the block 2026-11-11 (iteration 62): the between-raid base no longer stacks ~20
panels in one scroll; it is a hero Deploy screen with one-panel-at-a-time tabs (Loadout,
Traders, Workshop, Contracts, Records plus Sector and online-only Squad). Offline-only
surfaces (account/password, recovery codes, sessions, squad, comms, latency) are hidden,
and the first-raid guide is a one-line dismissible tip.

Post-P0 UX resumed 2026-11-11 (iteration 58): the static offline Deploy card now previews
an authored field objective from the shared catalogue and remembers the sector/objective
plan on the device. The readiness line names the objective, site, hold and authoritative
`rewardCredits`/`rewardXp`; a stale or unknown plan is discarded instead of prefilled;
changing either selection saves the plan and a reload restores it. Deploying that plan
sends the objective to the real in-page `RaidService`, and the offline store settles the
authored bonus on extraction. This is base UX and device-local preference only — no loot,
damage, extraction, reward or transport rule changed, and online pages never read or write
the plan. Evidence: new `tests/raid-browser-static-plan.mjs` (static server, no `/api`,
six options, selected switchyard objective, reload-restored map/objective, exact
"+42 credits / +20 XP after a 12 s hold" copy, deployed snapshot objective matching
`objectivesFor`, zero browser errors; screenshot `/tmp/hs-offline-plan.png`), unit tests in
`tests/raid-offline.test.mjs` and `tests/raid-plan.test.mjs`, static readiness and P0 gates
green. Physical-device readability remains UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 56): the base "Raid records" card now opens
with an honest empty state and an aggregate line computed from the authoritative
settled results — recorded deployments, extractions, deployments that ended without
extraction, interrupted/refunded deployments, raid-reward credits, XP and machines
destroyed. The line updates in place after each settlement and survives a reload
from the same `results` rows the detail list renders; online and offline show it
identically, and no rule, reward, transport or record was invented. Evidence: new
`tests/raid-browser-static-records.mjs` (empty state → death settlement → recovery
extraction → reload, exact parity with `careerText(api('results'))`, zero `/api`,
zero browser errors; screenshots `/tmp/hs-records-summary.png` /
`/tmp/hs-records-summary-extracted.png`), unit cases in `tests/raid-report.test.mjs`,
static P0 gate and online rewards grader green.

Post-P0 UX resumed 2026-11-11 (iteration 54): static offline insurance claims now
update themselves. After a death settlement the base shows the authoritative pending
claim copy (label, "pending", eligibility time); when the in-page RaidService tick
resolves a claim through `MemoryRaidStore.processInsurance`, the 2 s base poll detects
the authoritative insurance-list change and re-renders the card (for example
"Assault Rifle · returned") without a reload, and the returned gear reappears in the
stash. This is use of the existing authoritative store rules, not a client shortcut:
no rules, rewards, loot, AI or `/api` transport changed and online keeps its previous
deployment-only refresh behavior. Evidence: new
`tests/raid-browser-static-insurance-refresh.mjs` (premium 20 debited, pending claim,
due-only advance, returned + banked rifle, marker proves no reload, zero `/api`, zero
browser errors; screenshots `/tmp/hs-insurance-pending.png` /
`/tmp/hs-insurance-returned.png`), static P0 playability gate, static persistence
grader and full suite 1240/1240. Physical-device readability remains UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-11 (iteration 53): the active raid now paints a
presentation-only screen-edge vitality haze from the authoritative `self.hp`/`self.downed`
fields — invisible above 60 health, a restrained amber-red warning at 60 or below, a
stronger red `vitalPulse` at 30 or below, and a deep maroon while downed. The overlay is
pointer-transparent, hidden from assistive technology (the numeric HP token remains the
text authority), spans the raid view, and freezes to a static tint under reduced motion.
No rules, damage, loot, AI, extraction or `/api` code changed. Evidence:
`tests/raid-browser-vital-vignette.mjs` (live hp 55 → warn, hp 25 → critical, downed,
reduced-motion freeze, pointer-events none, 610,031-pixel isolated tint delta,
zero browser errors; screenshots `/tmp/hs-vital-vignette-clear.png`,
`/tmp/hs-vital-vignette-dark.png`, `/tmp/hs-vital-vignette-critical.png`), static P0
gate green, full suite 1239/1240 with the known matchmaking ECONNRESET rerun 11/11.
Human readability on a phone remains UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 52): the static offline Account surface is
passwordless and truthful. The Account dialog explains that the operator and stash
are stored on this device and hides online-only password change, recovery-code and
server-session controls instead of invoking routes that can only return 501. Signing
out shows a name-only local sign-in (password hidden and non-required, register and
recovery controls hidden, "Continue offline" submit); signing back in reuses the same
guest account, stash and progress. Online/Node account security, cookies and
passwords are unchanged. Evidence: new `tests/raid-browser-static-account.mjs`
(dialog note, hidden online controls, passwordless sign-out/sign-in, reused operator
and stash, zero `/api` traffic, zero browser errors), static P0 playability gate,
readiness grader and full suite 1240/1240. Physical-device readability remains
UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 50): the static offline base Deploy card now shows a
store-authoritative loadout readiness line. A read-only in-page `readiness` route calls the
same `MemoryRaidStore.preflightLoadout` rules deploy uses, reporting the concrete blocker
verbatim when the selection cannot deploy (for example "Equip one or two weapons") and the
authoritative carried weight plus insurance premium when it can; recovery kits are ready with
no premium, and an active deployment shows "Operator still in raid" while Resume stays
available. The offline Deploy button is gated by that verdict and every loadout, insurance and
recovery change refreshes it; online/Node readiness and deploy behavior are unchanged and the
line stays hidden there. Evidence: new `tests/raid-browser-static-readiness.mjs` (blocked →
4.0 kg ready → 14-credit insured premium → recovery → cleared → deployment → active resume,
zero `/api` traffic, zero browser errors), `tests/raid-offline.test.mjs` readiness unit test,
static P0 playability gate, offline dispatch/persist graders, online smoke against an isolated
`node server/main.mjs`, and full suite 1240/1240. Physical-device feel remains UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-11 (iteration 51): every extraction exit prop now carries
a presentation-only signal — a coloured flare and a pooled eight-puff smoke column. The
signal vents only while the authoritative `openAt`/`closeAt` window is scheduled or open
and is tinted by the exit colour code (open green `0x86efbb`, inbound amber `0xd7a650`,
contested red `0xff805b`); an inactive exit shows nothing. Animation is deterministic from
scene time, freezes fully under reduced motion, reuses the authored `TX.smoke` texture and
the cached procedural glow map, and never touches boarding, seats, timing, settlement, AI,
loot or `/api`. Evidence: new `tests/raid-browser-exit-signal.mjs` (all four exits, open/
inbound/inactive/contested states, 24 animated fields, frozen pose, shared maps, ~2,500-pixel
isolated delta, screenshots `/tmp/hs-exit-signal-before.png` / `/tmp/hs-exit-signal.png`),
static P0 playability gate green, zero browser errors. Human readability on a phone remains
UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-11 (iteration 47): authored ground-loot piles now render a
presentation-only pickup beacon in both online and offline raids — a floating gem, additive
halo and light wisp tinted by the pile's brightest authoritative item rarity, plus a pulsing
accent ring. The gem hovers and turns at runtime and freezes to a still pose under reduced
motion; the shared procedural glow map and gem geometry mean per-actor disposal does not
release another pile's resources. Loot ownership, items, positions, settlements and the
`/api` transport are unchanged. Evidence: new `tests/raid-browser-loot-beacons.mjs`
(3 live piles, shared map/geometry, animation/freeze, 14,287-pixel isolated delta; before/after
screenshots `/tmp/hs-loot-beacons-before.png` / `/tmp/hs-loot-beacons.png`), static P0
playability gate, cache-tiers and loot-excitement graders, full suite 1239/1239. Human
readability/feel on a phone remains UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 48): the static offline base no longer renders an
empty Traders card or live contract buttons that can only return 501. Offline Traders becomes
a "Salvage exchange · offline" section that states vendor stock is online-only and lists
held non-favorited material/valuable salvage with authoritative base sale values plus one
liquidation action routed through `bulkSell`; offline Contracts list every authored contract
with read-only progress and an online-only note instead of accept/deliver/claim controls.
Online trader/contract UI is unchanged. Evidence: new
`tests/raid-browser-static-availability.mjs` (no `/api`, notices, zero dead controls,
seeded sale 250 → 275 credits with favorited wire retained, persisted reload, zero browser
errors; screenshot `/tmp/hs-offline-availability.png`), static P0 playability gate and full
suite 1239/1239 green. Physical-device feel remains UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-11 (iteration 49): rain fronts ("Electrical squall") now
carry a deterministic lightning sheet in Extraction Raids — the sky dome lifts cold overhead
light with a horizon echo, the existing sun and hemisphere lights briefly brighten and cool,
and the fog haze lifts with the strike. A pure `lightningPulse(seconds, weather)` schedules a
full strike ~1.1 s into every 8.5 s cycle plus a softer sheet ~1.38 s, with no runtime
randomness or extra scene light. Clear, mist, ash and reduced-motion states leave every
flash-driven value at its neutral baseline, and all values return exactly between strikes.
Loot, rules, snapshots and `/api` transport are unchanged. Evidence:
`tests/raid-browser-lightning.mjs` (pulse determinism/cycle, uniform + light + tint transition,
reduced/clear/ash gating, 57,600-pixel sky delta, before/after screenshots
`/tmp/hs-lightning-before.png` / `/tmp/hs-lightning.png`), atmosphere grader and full unit
suite green. Live storm readability on a phone remains UNVERIFIED (P7).

Post-P0 economy resumed 2026-11-11 (iteration 46): the static offline base workshop now
crafts, repairs, upgrades and moves stash stacks through `MemoryRaidStore.trade`, using
the same shared recipe/repair/progression rules as the Node store; online-only traders
and contracts stay explicit offline 501 stubs. Workshop recipe rows show owned versus
required salvage, credit stock and human-readable blockers (rank, workbench, active
deployment, missing stock, short credits) bound by `aria-describedby`. Evidence:
`tests/raid-store-memory.test.mjs`/`tests/raid-offline.test.mjs` (28 targeted), new
`tests/raid-browser-static-base-economy.mjs` (craft → upgrade → reload persisted, no
`/api`, zero errors), static P0 playability gate and online progression grader green.
Physical-device feel remains UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 42): the post-raid rewards card now shows
an authoritative settlement reconciliation line (credits before → after with raid
reward and insurance premium/refund, XP before → after, returned vs lost items) and
a stash capacity reminder that flags protected overflow with an actionable warning.
Both render offline from `MemoryRaidStore` results and online from Node facts via
shared `settlementGapText`/`stashUsageText`; the static offline grader and full suite
stay green. Human-readable feel on Austin's phone remains UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-11 (iteration 43): a confirmed machine kill now
reports its authoritative core coordinate and class through the hit token, and the
raid client renders a pooled hull-break wreck there — a warm flash, camera-facing ring,
embers, matte smoke plume, angular scrap and a short pooled light, scaled by machine
class and static/quiet under reduced motion. No rules, AI, damage, loot or transport
changed; the hit-feedback browser grader and the static offline playability gate are
green. Human readability/feel on a phone remains UNVERIFIED (P7).

Post-P0 UX resumed 2026-11-11 (iteration 44): stale/partial/future-version IndexedDB
snapshots and truncated localStorage JSON no longer block offline raid boot. The bad
save is quarantined, a clean local profile and persistent store are created, the base
screen explains the reset or a failed local write, and a normal reload restores the new
operator/stash by identity. Snapshot import is atomic, the localStorage fallback restores
degraded saves when IndexedDB loads empty, and online `/api` authority is unchanged.
Evidence: `tests/raid-store-persist.test.mjs`, `tests/raid-browser-static-recovery.mjs`,
static persistence/playability and offline-dispatch graders green; full suite 1233/1233.
P7 physical-device feel of the notice remains UNVERIFIED.

Post-P0 look/feel resumed 2026-11-11 (iteration 45): the searchable salvage caches now
render a shared procedural stamped-metal shell — rolled plate bands, recessed riveted
panel borders, welded diagonal braces, rust blooms, chips and grime — plus corner braces,
a lid hinge beam, front latch and a recessed lid lip, so containers read as weathered
municipal crates instead of flat boxes. The tier accent (ground ring, lid rim strips,
side ribbons, front badge, top seal) and the authoritative open/vault lid tint are
unchanged; production presentation only. Evidence: `tests/raid-browser-cache-tiers.mjs`
(5,679-pixel isolated delta, one shared shell map, before/after screenshots), static P0
playability gate, effects resource-lifecycle grader and full suite 1233/1233 green.
Human readability/feel on a phone remains UNVERIFIED (P7).

Post-P0 look/feel resumed 2026-11-10 (iteration 41): rain fronts are now a
camera-local 620-drop streak volume instead of a sparse sector-wide field, so the
static offline client reads rain near the operator. Presentation-only; the P0
playability graders and the full suite remain green.

Required pieces: (a) browser store adapter replacing `node:sqlite` — in-memory first
if that unblocks play, then IndexedDB with localStorage fallback; (b) Web Crypto shims
for `node:crypto` imports in `server/raids.mjs` and `server/raid-*.mjs`; (c) guest/local
session, no password, no HttpOnly cookies or scrypt offline; (d) in-page dispatcher so
`raid-online.mjs` `api(path, body)` calls in-browser `RaidService` when `/api` is
unavailable, with the 50 ms tick running in the page and squads/PvP/voice stubbed;
(e) static Pages DEPLOY → `raid-online.html` offline instead of `raidOpenBase()`;
(f) keep `node server/main.mjs` working; (g) a static-file browser grader.

### Ordered slices (one per iteration, about 15–30 minutes)

1. **Static-mode detection** — COMPLETE (iteration 30). `shared/raid-static.mjs` is a
   DOM-free detector returning `{mode:'offline'|'online', reason:'offline-query'|
   'no-service-meta'|'profile-unreachable'|'service-meta'}` from `offline=1`, the
   absence of the Node-injected `headshotz-raid-service` meta, or an explicit failed
   `/api/profile` probe (unchecked never forces offline). `readServiceMeta` and
   `browserRaidMode` are browser convenience helpers; no game/routing behaviour was
   wired in this slice by design. Evidence: `tests/raid-static-mode.test.mjs` (7/7).
   Next: slice 2 Web Crypto shim.
2. **Web Crypto shim** — COMPLETE (iteration 31). `shared/raid-crypto.mjs` is a
   DOM-free, `node:*`-free wrapper exporting `randomUUID`, `randomBytes`, `randomHex`,
   `fromHex`/`toHex` and a synchronous `createHash('sha256').update(x).digest('hex')`
   (pure-JS SHA-256 fallback, Web Crypto `getRandomValues`/`randomUUID` when present).
   `server/raids.mjs`, `server/raid-loot.mjs`, `server/raid-inventory.mjs` and
   `server/raid-utilities.mjs` now import it, so those modules no longer pull
   `node:crypto` and can load in the browser. `server/credentials.mjs` keeps
   `scryptSync`/`timingSafeEqual` on the Node path. Evidence:
   `tests/raid-crypto.test.mjs` (5/5: Node-oracle SHA-256 vectors incl. unicode,
   UUIDv4 format/uniqueness, byte/hex helpers) and a real `node server/main.mjs`
   boot (`/health/live` 200) plus targeted loot/inventory/ballistics/exits suites.
   Next: slice 3 in-memory store skeleton.
3. **In-memory store skeleton** — COMPLETE (iteration 32). `shared/raid-store-memory.mjs`
   is a DOM-free, `node:*`-free adapter implementing the construction/profile
   contract (`acquireLease`/`releaseLease`, `loadRaids`/`checkpoint`,
   `recoverInterrupted`, `transaction`, `audit`, `state`/`save`, `profile`) with an
   automatic passwordless guest. The guest mirrors the online starter account
   (250 starter credits, bound AR/armor/2 meds) so deployment has gear; it has no
   earned loot, insurance, overflow or active deployment. `shared/raid-rules.mjs`
   owns the browser-safe `RuleError`/`requireRule`/`item` primitives, `server/rules.mjs`
   re-exports them, and `server/raids.mjs`/`server/comms.mjs` no longer import
   `node:crypto`. Evidence: `tests/raid-store-memory.test.mjs` 7/7, targeted raid
   suites 130/130, full suite 1198/1198, `node server/main.mjs` `/health/live` 200.
   Next: slice 4 in-memory deployments and checkpoints.
4. **In-memory deployments and checkpoints** — COMPLETE (iteration 33).
   `MemoryRaidStore.deploy/preflightLoadout/checkpoint/settle/processInsurance/results/
   latestDeploymentId/purgeRaid/blockedBetween` now implement the authoritative store
   contract: gear leaves the stash for raid inventory, checkpointing records every
   carried/container item canonically, extraction returns equipment and pack, death
   returns only the protected pocket while dropped gear becomes `lost` (so insurance can
   resolve), credits/XP/progression/contracts match the online settlement shape, and
   aborted deployments refund the premium. `server/raids.mjs` reaches the store through
   `latestDeploymentId`/`purgeRaid` instead of `store.db`, and `server/comms.mjs`
   delegates block checks to `store.blockedBetween`; `RaidStore` implements both, so the
   Node path is unchanged. Evidence: `tests/raid-store-memory.test.mjs` 9/9 (scripted
   deploy → move → fire → boarding → extract settles 20 credits/20 XP with gear back in
   stash; death loses both deployed items and returns no gear; one-active-deployment
   rejection), targeted raid suites 56/56, full suite 1200/1200.
   No browser acceptance for offline mode yet — the dispatcher/grader slices are next.
   Next: slice 5 guest/local session.
5. **Guest/local session** — COMPLETE (iteration 34). `shared/raid-session.mjs` is a
   DOM-free, `node:*`-free passwordless guest session: `createGuestSession`/`GuestSession`
   claim the store guest (no password, token, cookie, or scrypt) and expose
   `authenticate`/`profile`/`results`/`sessions`/`signIn`/`logout`. Its
   `offlineSessionRoute` contract maps the client's auth/profile calls (`profile`,
   `results`, `sessions`, `login`, `register`, `logout`) and rejects password-only
   routes with 501; gameplay routes stay with `RaidService`. Login/register are the
   same local operation (typed name picks or creates the guest; the password field
   is ignored). Online register/login/cookies are unchanged. Evidence:
   `tests/raid-session.test.mjs` 6/6 (guest profile shape, name reuse, route contract,
   501 password routes, deployment bound to the session account), targeted 22/22,
   full suite 1206/1206. Next: slice 6 in-page dispatcher/tick.
6. **In-page dispatcher and 50 ms tick** — COMPLETE (iteration 35).
   `shared/raid-offline.mjs` constructs the browser-safe `MemoryRaidStore`,
   passwordless `GuestSession` and real `server/raids.mjs` `RaidService`, exposes
   the hosted route subset (`worlds`, `capabilities`, `profile`/`results`/
   `sessions`/`login`/`register`/`logout` via the slice-5 session contract,
   `market`, `raid`, `deploy`, `action`, `social`, `voice`, `party`,
   `matchmaking`) and starts the same 50 ms `raids.tick(0.05)` loop
   (`startOfflineTick`, stoppable via `dispose`). Party/voice/trade/security
   mutation routes fail explicitly with 501; matchmaking probe/measure return
   offline proofs; GET party/voice return well-formed empty responses so the base
   screen boots. `raid-online.mjs` selects the transport once per page:
   `offline=1` wins, Node meta means online, otherwise one `/api/profile` probe
   (online only for 200/401 JSON; GitHub Pages 404/non-JSON means offline) and
   dynamically imports the dispatcher only when static. No server authority or
   hosted fetch path changed. Evidence: `tests/raid-offline.test.mjs` 9/9
   (source safety, routes, deploy/action, stubs, tick lifecycle) and
   `tests/raid-browser-offline-dispatch.mjs` (static server, no `/api` traffic:
   offline boot with/without flag, deploy, keyboard movement, fire action,
   ticking; browser exceptions empty). Targeted 31/31; full suite 1215/1215.
   Next: slice 7 offline multiplayer UI stub.
7. **Stub offline multiplayer** — COMPLETE (iteration 36). Offline mode hides the
   squad mutation controls (`#squadOnlineControls`: size, create/join/leave/ready,
   invite code, roster, role) and hosted connection probes (`#connectionControls`:
   mixed-size, round-trip limit, Check connection), hides the Squad/voice toggle
   and voice controls, and states "Playing solo offline — machines are the
   opposition." Deploy pins a neutral no-limit match, skips the latency probe and
   sends no proof, and the interpolation/matchmaking probe paths are bypassed.
   Online/Node pages keep every control and their probe validation. Evidence:
   `tests/raid-browser-offline-dispatch.mjs` asserts the hidden/disabled controls
   on both static boot paths and still deploys, moves, fires and shows zero `/api`
   traffic; `tests/raid-browser-smoke.mjs` is green online; full suite 1215/1215.
8. **Pages DEPLOY routing** — COMPLETE (iteration 37). `game.js` now routes the
   hub `#raidBtn` to `raid-online.html?offline=1` when the Node-injected
   `headshotz-raid-service` meta is absent (and to plain `raid-online.html` when it
   is present, as before), so the GitHub Pages DEPLOY enters the in-page offline
   raid client instead of `raidOpenBase()`. A new clearly labeled secondary control
   (`#raidLegacyBtn`, "🧓 CLASSIC EXTRACTION · original co-op raid base") is shown
   only on static pages and still opens the original `game.js` RAID BASE; Battle
   Royale and all other modes are untouched. Evidence: a plain static-file server
   (no meta, no `/api`) in `tests/raid-browser-offline-dispatch.mjs` asserts the
   legacy control is visible, opens the classic base, and DEPLOY navigates to
   `raid-online.html?offline=1` then boots offline; `tests/raid-browser-entry.mjs`
   re-checks the server-marker removal path, deep-link entry and saved-session entry.
   Full unit suite 1215/1215.
9. **Playable combat/loot/extract wiring** — COMPLETE (iteration 38). The dispatcher
   gameplay routes now work offline: `RAID_WORLDS` deploy, `move`, `fire` (machine
   health/hit feedback), `take` ground loot plus container claims, `call`/`extract`
   boarding and settlement all run through the real `RaidService` and
   `MemoryRaidStore`. The missing store method was `claimLoot`: it now invalidates
   rival `covered`/`pending` insurance claims exactly like `server/store.mjs`, so an
   in-page Take no longer throws. No new endpoints or client-trusted shortcuts were
   added. Evidence: three new dispatcher tests in `tests/raid-offline.test.mjs`
   (loot take, machine shot/hit token, call → boarding → extraction settlement with
   returned gear and 270 credits), a `claimLoot` parity test in
   `tests/raid-store-memory.test.mjs`, the static dispatch browser grader, and the
   full suite 1219/1219. UI-level looting/extraction on static hosting is now covered
   by the green slice 10 grader (iteration 39). Next: slice 11 IndexedDB persistence.
10. **Static Pages browser grader** — COMPLETE (iteration 39). Added
    `tests/raid-browser-static-offline.mjs`: a plain static-file server in the test
    process (no Node raid `/api`) drives headless Chrome from the hub DEPLOY button
    into `raid-online.html?offline=1`, then verifies deploy, `KeyW` movement, a
    `keyF` machine hit (authoritative HP drop + machine hit token), a `KeyE` ground
    loot take, and a `KeyE` call-exit boarding that settles to `extract` with
    returned gear and applicable credits. World blockers/rivals are cleared only
    around the shot fixture; interactions still run through the shipped UI and
    in-page `RaidService`. Result: all assertions pass, no `/api` traffic, zero browser
    errors. **The playability gate is green.** Remaining P0 work is persistence
    (slices 11–12); after that resume visual/look-feel work.
11. **IndexedDB persistence** — COMPLETE. `MemoryRaidStore`
    now snapshots its accounts, stash inventory, deployment records, insurance claims
    and active raid checkpoints to a single async backend. `PersistentRaidStore`
    flushes after committed transactions (debounced, with an unload flush), and
    `shared/raid-store-idb.mjs` stores the flattened snapshot under one IndexedDB key.
    `createPersistentOfflineRaidRuntime` hydrates before constructing `RaidService`,
    so the static client boots with the same guest, stash and unfinished raids.
    Evidence: `tests/raid-store-persist.test.mjs` round-trip and reload/resume tests;
    `tests/raid-browser-static-persist.mjs` reloads a settled guest and resumes an
    active deployment from IndexedDB with zero `/api` traffic or browser errors.
12. **localStorage fallback** — COMPLETE. If IndexedDB is
    absent or its first read/write fails, `createFallbackSnapshotBackend` switches to
    `shared/raid-store-local.mjs`, which JSON-persists the same snapshot under one
    localStorage key. Both backends are absent-safe; gameplay falls back to the
    in-memory store if neither is available. The online Node store and cookie path
    are untouched. Evidence: fallback/degraded-write unit tests, and a browser reload/
    resume scenario with `window.indexedDB` removed that reports
    `storageMode:'localStorage'`.

All P0 slices are COMPLETE. Resume look/feel work (alternating with gameplay) and the
P5–P10 items below.

## How statuses are judged

- `COMPLETE` — server-authoritative rule exists, the live client exposes the mechanic,
  and at least one server/browser grader exercises the user-visible behavior.
- `PARTIAL` — implemented and useful, but one required path or acceptance question
  (often live-human, hosted network, or physical-device behavior) is not verified.
- `BROKEN` — implemented path contradicts required gameplay or reliably fails a check.
- `MISSING` — no authoritative mechanics or client affordance exists.
- `UNVERIFIED` — behavior cannot be exercised with the tools available in this
  checkout (for example hosted internet transport or physical-device touch feel).

Evidence references are existing test names or recorded runtime verifications; they
are pointers, not claims that every command was rerun in this iteration. Where a
runtime check was rerun, the iteration entry in `RALPH_PROGRESS.md` records it.

## Audit summary

| Category | Overall status | One-line reason |
| --- | --- | --- |
| Loot | COMPLETE | Ground loot, deterministic random spawns, caches, rarity, inspection, take/drop and downed-body transfer are covered by server and browser graders. |
| PvP | COMPLETE (local) | Downing, crawl, finish, revive, full-body looting, armor and death penalties are authoritative; live human-hosted balance is UNVERIFIED. |
| Extraction | COMPLETE | Four exit kinds, markers, activation, countdown, contested states, boarding and gear retention have server/browser evidence. |
| Navigation | COMPLETE | Minimap, full tactical map, compass, pings, waypoints and squad/extraction markers are driven by snapshots, and idle look input now stays synchronized to the authority (iteration 19). |
| Inventory | COMPLETE | Slots, backpack, stacks, weight/cap, consumables, drag/drop, give and persistent stash are enforced server-side. |
| Combat | COMPLETE | Weapons, recoil, reload, switching, hit feedback, armor, healing, throwables and movement are complete; authoritative hit tokens, markers, captions and cues are graded. Balance is tracked under game feel. |
| Enemy AI | COMPLETE | Patrols, detection, noise investigation, pursuit, five machine classes, weak points, boss phases and salvage drops exist and are graded. |
| World | COMPLETE (local) | Exploration, terrain, caches, vaults, hazards, dynamic encounters, interactive doors, key-gated rooms and opt-in field objectives are server-authoritative and graded. Hosted/network acceptance is UNVERIFIED. |
| Progression | COMPLETE | Base, crafting, vendors, contracts, upgrades, stash, loadout and post-raid rewards are connected with authoritative results. |
| Multiplayer | PARTIAL (local complete) | Same-raid squads, PvP damage, revive, authoritative inventories, extraction and loot ownership pass twin-client graders; live hosted matchmaking/latency is UNVERIFIED. |
| Game feel | PARTIAL | Tension/risk/reward support exists at the systems level, and hit/kill feedback is now complete; balance, loot-excitement and pacing are still not human-accepted. |

## Dependency-aware priority list (highest gameplay impact first)

1. **P1 — Authoritative outgoing hit feedback** — COMPLETE (iteration 6). The
   server records a monotonic post-damage hit token (zone, headshot, target class,
   kill/boss/elite), the snapshot exposes it only inside a bounded window, and the
   client renders a visible hit/kill marker with an accessible caption and cue.
   Unit and isolated-Chrome graders cover hits, misses and reconnect baselineing.
2. **P2 — Interactive doors and locked areas** — COMPLETE (iteration 7, local authoritative
   scope). Stable door ids at real wall openings, deterministic per-raid state, wire-valid
   server `door` action with key consumption and rejection safety, closed-door collision/
   LOS/ballistic blocking, per-sector key-gated room routes, client prompt/announcement/
   cue plus world and map state, and reconnect baselineing. Endurance and Playwright-engine
   suites are environmental gaps, recorded honestly.
3. **P3 — Dynamic in-raid objectives** — COMPLETE (iteration 8, local authoritative
   scope). The shared catalog is derived from authored landmarks; deployments opt in or
   out; the server owns approach → hold → secured progression with pause/failure reasons;
   settled extractions pay catalog credits and XP; the client shows an accessible panel,
   bearing, hold progress and cyan/green markers on both maps with announcements,
   reconnect authority and rewards/record reporting. Live hosted and human-accepted
   objective play remains unverified.
4. **P4 — Dead-body and bag persistence clarity** — COMPLETE (iteration 9, local
   authoritative scope). Downed bodies remain independent searchable/revivable
   containers; death creates exactly one operator salvage bag without protected or
   recovery gear; machine, rival and dropped-gear containers carry stable kinds and
   labels; snapshots preserve metadata but hide items out of range; the HUD/backpack
   and both maps distinguish body (`B`/`L`), operator salvage (pink `C`), machine
   salvage (amber `M`), rival salvage (orange `R`) and dropped gear (lavender `G`),
   with updated legends. Unit and isolated-Chrome graders prove distinction, privacy,
   cleanup and no phantom body. Live hosted readability remains unverified.
5. **P5 — Live-human combat balance** (UNVERIFIED): tune machine aggro, weapon range,
   armor and extraction pressure with actual repeated human play, not only fixtures.
   Must preserve all existing modes and raid-only scoping.
6. **P6 — Hosted multi-client and reconnect quality** (UNVERIFIED): run independent
   clients over the deployed transport, verify reconnect, action replay, loot
   ownership and extraction under real latency/network interruption.
7. **P7 — Physical-device touch/pointer feel** (UNVERIFIED): verify drag/drop,
   aim, fire and map gestures on real phones/tablets with reduced-motion settings.
8. **P8 — Deeper squad coordination and roles** (PARTIAL, local slices COMPLETE):
   squad revive/carry and give/trade exist; a squad link-up extraction bonus pays
   +6 credits/+10 XP per linked squadmate (iteration 11); opt-in Scout/Medic/Engineer
   roles now persist through party readiness, ship in snapshots, and grant longer pings,
   3.5 s revives and keyless door picks (iteration 12), with role labels in Squad hand-off
   and downed rescue panels and the medic revive timing exposed in the control (iteration
   13). A fourth opt-in role, Hauler, adds 4 backpack slots and 8 kg of weight capacity
   for that deployment through the same authoritative catalog and snapshot fields
   (iteration 26), leaving the baseline and other roles unchanged. Live hosted coordination
   remains unverified and the role catalog may grow. Keep additions opt-in to raids.
9. **P9 — Encounter pacing and loot-excitement** (PARTIAL, celebration COMPLETE):
   event cadence and reward feedback exist, and rarity-derived visual/audio pickup
   celebration is now server-snapshot-driven and browser-graded (iteration 10). The
   loop's addictiveness and pacing are still not proven by humans.
10. **P10 — Persistent richer home-base economy** (COMPLETE baseline, PARTIAL depth):
    vendors/crafting/contracts/upgrades work, damaged equipment offers two authoritative
    repair grades — a cheap partial field patch (+25 condition, one wire) and a full
    workshop restoration (100%, one steel) — and worn weapons/armor now dismantle into
    condition-scaled steel (3/2/1) with a salvage-versus-repair comparison shown in the
    base stash (iteration 24). The relative value of those choices is not yet
    human-evaluated.

## 1. Loot

- **Physical, scanned ground loot** — COMPLETE. `server/raid-loot.mjs` seeds piles per
  spawn; `raid-online.mjs` resolves nearby ground loot; `tests/raid-game-loop.test.mjs`
  verifies reachability, deterministic reproduction, stack rules and immediate loot at
  every spawn; `raid-browser-interactions.mjs` drives Take through the real backpack UI.
- **Randomized spawns without duplicates** — COMPLETE. Seeded deterministic generation
  per raid (`createSectorGroundLoot`, `createSectorCaches`, `createWeaponCaches`);
  no two takers can duplicate an item; `raid-browser-interactions.mjs` asserts exactly
  one ownership row after two contexts take the same contested item.
- **Searchable containers** — COMPLETE. Cache claim is exclusive, 2.4 s by default, and
  cancels on movement/damage/fire; multiple cache archetypes and vaults exist; covered by
  `tests/raid-interactions.test.mjs` and twin-client browser graders.
- **Rarity/readability** — COMPLETE at mechanics/UI level. Item rarity and labels are
  generated and rendered; `raid-browser-accessibility.mjs` asserts the inspect dialog
  shows weapon damage and "Common". Rarity-differentiated visual excitement is PARTIAL
  (see Game feel). Ground piles now carry a rarity-tinted pickup beacon — floating gem,
  additive halo, wisp and pulsing ring, still and readable under reduced motion — proven by
  `raid-browser-loot-beacons.mjs` (iteration 47, presentation-only; labels are unchanged).
- **Item inspection** — COMPLETE. Inspect dialog is a native dialog with focus management
  and keyboard close; `raid-browser-accessibility.mjs`.
- **Pickup / drop / stack / secure** — COMPLETE. `take`, `drop`, `stack`, `split` and
  `secure` are server actions with weight/slot/ownership guards; tested in
  `raid-game-loop.test.mjs`, `raid-transfers.test.mjs` and
  `raid-browser-accessibility.mjs`; persistent stash returns on extraction.
- **Persistent lootable downed bodies** — COMPLETE for raid lifetime. Downed opposing
  bodies keep gear, claim/search state and opened state until the body dies or the raid
  ends; `raid-body-loot.test.mjs` covers restart durability; `raid-browser-body-loot.mjs`
  shows the live prompt/countdown/Take and minimap state. Death-bag readability is P4.
- **AI/contract/valuable drops** — COMPLETE. Machine salvage bags, contract artifacts,
  weapon armories and rare caches are generated and display; settlement returns/drops
  them under existing ownership rules.

## 2. PvP (human-vs-human raid contact)

- **Downing without elimination when a squadmate lives** — COMPLETE. `damage()` sets
  `downed` while an alive teammate exists; `raid-browser-body-loot.mjs` and
  `raid-browser-rescue.mjs` exercise the result; `raid-game-loop.test.mjs` covers the
  no-squadmate death path.
- **Downed crawling** — COMPLETE. Downed operators may send `move`/`ping`; movement
  speed is 1 versus base 5; server rejects non-crawl actions while downed.
- **Finishing a downed enemy** — COMPLETE. Additional body damage subtracts the bleed
  timer and ends the operator at zero; `raid-body-loot.test.mjs`/body-loot browser flow
  covers open/closed body interactions and weapon extraction.
- **Cooperative revive/carry** — COMPLETE (local). Revive is a timed 5 s interaction with
  line-of-sight/reach checks; carry moves a downed squadmate; rescue browser grader and
  rescue server suite are green. Failed revive is surfaced through the existing distance
  rejection and is exercised in iteration 7.
- **Stealing equipment / full-body looting** — COMPLETE. Opposing downed bodies expose
  equipment and pack (never secure pocket or recovery items), exclusive search, one-owner
  takes and cleared equipped weapon on weapon take.
- **Armor damage and protection** — COMPLETE. Combat v2 absorbs body hits per armor
  stats; head/leg hits bypass protection; armor condition degrades and can be removed/
  worn; `raid-medical.test.mjs`, `raid-ballistics.test.mjs` and medical/accessibility
  graders cover piece values and effects.
- **Death penalties** — COMPLETE (local). Non-extraction deaths drop non-recovery
  gear as a salvage bag, wear weapon condition, and only secure-pocket items return;
  extraction returns equipment/pack/secure with condition wear. Rewards/loss-report
  graders show returned/lost counts.
- **Live PvP balance** — UNVERIFIED. No human-hosted fairness or latency acceptance is
  claimed; this is P5/P6.

## 3. Extraction

- **Multiple functional zones** — COMPLETE. Every world has a call beacon (`call`),
  timed cargo lift (`timed`), key hatch (`key`/`unlock`) and resource freight
  (`resource`); created and cost-checked in `shared/raid-exits.mjs` and
  `server/raids.mjs`; `tests/raid-exits.test.mjs` and `raid-browser-exits.mjs`.
- **Markers** — COMPLETE. Exits are drawn on minimap and full tactical map from the
  snapshot, with names/costs in exit cards; `raid-browser-tactical-map.mjs` and
  `raid-browser-extraction-ui.mjs`.
- **Activation** — COMPLETE. Call/unlock/pay rules are server-authoritative, consume the
  cost only on success and publish events; browser exits grader activates and extracts.
- **Countdown / state badges** — COMPLETE. Exit cards show open/inbound/departed/etc.
  using server timestamps; `raid-browser-extraction-ui.mjs` checks phases and inventory
  extraction panel.
- **Contested extraction** — COMPLETE. Enemies/rivals/elites near an exit mark it contested;
  late-raid elite ambushes and squeeze publish contested state; `raid-escalation.test.mjs`
  and `raid-browser-escalation.mjs`.
- **Evacuation (boarding and seats)** — COMPLETE. Boarding is a 2.2 s action, seats are
  reserved, squadmates/rivals are handled independently, and movement cancels boarding;
  `raid-browser-interactions.mjs` and server exit/rescue suites exercise start/restart.
- **Squad link-up extraction** — COMPLETE local (iteration 11). A shared policy
  (`shared/raid-exits.mjs`) caps the bonus at two companions; the authoritative snapshot
  exposes living standing squadmates within 4 m; settle-time companions also include a
  carried passenger and same-wave departures within 60 s. Server awards +6 credits/+10 XP
  per companion. The client shows a snapshot-derived card chip, accessible bonus label,
  boarding caption/announcement and settlement report. `raid-squad-extraction.test.mjs`
  (6) and two-Context `raid-browser-squad-extraction.mjs`; hosted/human coordination
  remains UNVERIFIED.
- **Gear retention / loss** — COMPLETE. Extraction returns equipment+pack+secure
  (minus recovery items) and records item/loss detail; death returns only secure and
  creates a bag. `raid-browser-rewards.mjs` and `raid-browser-loss-report.mjs`.
- **Persistence before settlement** — COMPLETE. Raid checkpoints serialize world/version,
  operator fields and containers; `raid-checkpoints.test.mjs`, content migration and
  restart durability in body-loot/transfer suites verify reload.

## 4. Navigation

- **Minimap** — COMPLETE. Snapshot markers for exits, caches, machines, rivals,
  floor loot, bags, bodies, squad/self, pings, hazards and waypoints; `drawMap` and
  `drawMinimapWaypoint`; graders `raid-browser-minimap.mjs`, `raid-browser-minimap-detail.mjs`.
- **Full tactical map** — COMPLETE. M opens a pan/zoom overlay with forced clear
  controls; detached canvas grading proves every marker and pan/zoom/recenter;
  `raid-browser-tactical-map.mjs`.
- **Compass and bearing readout** — COMPLETE. HUD compass shows facing degrees and
  waypoint distance/direction/bearing; `raid-browser-tactical-map.mjs` asserts values.
- **Pings / squad markers** — COMPLETE. Player pings are server-rate-limited, team-scoped,
  temporary, optional exit mark; squad roster and map show friend state; tested in
  `raid-comms.test.mjs`/`raid-browser-comms.mjs` and tactical-map grader.
- **Waypoints** — COMPLETE. Map click sets/clears world-coordinate waypoint; distance
  and bearing are shared by minimap/full map/HUD; no client-side loot invention.
- **Exit/squad markers** — COMPLETE in map drawing; tactical-map browser grader checks
  exits and squadmate markers via pixel deltas.

## 5. Inventory

- **Equipment slots** — COMPLETE. Server-backed equipment array and equip/wear/
  removeArmor actions; `raid-browser-loadout.mjs`, `raid-browser-inventory.mjs`,
  `raid-equipment.test.mjs`.
- **Backpack / secure pocket** — COMPLETE. Pack cap and secure cap differ by recovery
  deployment; secure focuses keys, materials, valuables, meds and mods; browser inventory
  and accessibility flows pass.
- **Stacking / splitting / merging** — COMPLETE. Stack rules in `shared/raid-items.mjs`,
  unit tests for take/split/stack/partial transfer; `raid-browser-inventory.mjs` covers
  merge and split controls.
- **Weight/capacity** — COMPLETE. Authoritative `weight()` and `itemWeight`, pack cap
  and weight cap enforcement; take/stack/weight tests and failure-message browser flow.
- **Consumables/use** — COMPLETE. Medical use with two-second reuse delay, utility throw,
  wound status; medical/utilities server tests and browser graders.
- **Drag/drop reorder and trade** — COMPLETE. Row drag reorders local presentation only;
  drag-to-squad and Give buttons perform server `give`; double-click equips; no server
  item inventions; `raid-browser-inventory.mjs` plus `raid-inventory-give.test.mjs`.
- **Persistent storage** — COMPLETE. Base stash + insurance + recovery items persist
  across raid settlement; rewards/loss/recycling graders show returned/lost and existing
  revision/ownership guards.

## 6. Combat

- **Weapon readiness / responsiveness** — COMPLETE. Reliable action queue, trigger
  gating, prediction and authoritative cooldowns; trigger and trigger-latency suites
  plus production browser grader.
- **Recoil / viewmodel feedback** — COMPLETE (presentation; iteration 63). Bounded recoil
  impulse now snaps the camera and gun harder and settles exponentially faster, muzzle
  bloom/light and tracer are brighter with a larger pooled world shot light, and the
  first-person pose is raised so the weapon and hands clear the mobile touch row.
  Alternating side, reduced-motion suppression, heat/muzzle/casing/reload state remain
  graded by `raid-browser-viewmodel.mjs` and the accessibility grader. This is not an
  aim debuff on the server.
- **Reloads and weapon switching** — COMPLETE. Server reload consumes compatible ammo,
  magazine full/cooldown rejected; equip validates ownership and usability; browser
  ballistics and viewmodel graders.
- **Hit feedback (outgoing)** — COMPLETE (iteration 6). `server/raid-hit-feedback.mjs`
  records a monotonic post-damage token on both ballistics and legacy shot paths:
  body/head/leg zones, target class, and verified kill/boss/elite flags. The snapshot
  carries `self.hit` only within 1.6 s; the client `#hitmarker` and sr-only caption
  render new tokens once and play local hit/headshot/kill cues. Misses create no token.
  Evidence: `tests/raid-hit-feedback.test.mjs` (7/7) and
  `tests/raid-browser-hit-feedback.mjs` (real UI fire, marker/caption/cue, miss and
  reconnect baseline, `browserErrors:[]`).
- **Armor / healing / wounds** — COMPLETE. Absorption, head/leg bypass, bleeding, limp,
  trauma and splints; `raid-medical.test.mjs` and `raid-browser-medical.mjs` pass.
- **Throwables** — COMPLETE. Smoke, decoy, frag with armed/detonation states, hazard
  warnings and spatial cues; `raid-utilities.test.mjs`; utilities browser grader is green.
- **Tactical movement** — COMPLETE. Sprint, slide, jump, vault, ledge scan and server
  collision; `raid-input.test.mjs`, pilot route tests, vault/accessibility browser graders.
- **Weapon/armor condition and durability** — COMPLETE at rule level. Condition degrades
  per shot and on settlement; condition excludes unusable weapons; browser viewmodel
  and result summaries expose condition.

## 7. Enemy AI

- **Patrols / detection / sound investigation** — COMPLETE. `server/raid-ai.mjs` uses
  machine state machine with patrol, investigate, chase, attack; noises from movement,
  firing, vaults, slide, alarms, smoke/lures; unit encounter/escalation tests.
- **Pursuit and combat** — COMPLETE. Machines path toward noise/target, telegraph attacks,
  damage operators with line-of-sight rules; boss/medical/ballistics suites exercise.
- **Varied machines** — COMPLETE. Five classes (scout, hunter, heavy, flyer, overlord)
  with distinct stats/cues/models; common/escalation scenes.
- **Weak points** — COMPLETE. Core/head hits deal 2.5x through `hitMachine`; body damage
  otherwise normal; unit tests assert multipliers. A core hit while a machine is charging
  now staggers that attack by 0.22 s (three-hit cap), and the authoritative hit token
  reports `weak:true`, rendered as a cyan marker, "Weak point hit · machine" caption and
  synthesized cue (iteration 28). Evidence: `raid-encounters.test.mjs`,
  `raid-hit-feedback.test.mjs`, `raid-audio.test.mjs`, `raid-browser-hit-feedback.mjs`.
- **Bosses** — COMPLETE. Foundry Warden with approach/furnace/meltdown phases, phase
  hazards and HUD panel; `raid-boss.test.mjs`/`raid-browser-boss.mjs`.
- **Loot drops** — COMPLETE. Destroyed machines drop salvage bags and fuel; elite and
  boss variants have enhanced tables; game-loop/encounter tests assert salvage.
- **Live difficulty/balance** — UNVERIFIED (P5); no human flavor judgment.

## 8. World

- **Meaningful exploration** — COMPLETE at authored geometry level. 1,440 m terrain
  sectors with districts, roads, interiors, roofs, landmarks, hazards and elevated
  caches; v10 terrain and v9 city tests, world browser grader and route suites.
- **Interactive doors** — COMPLETE, P2. Authored stable ids per sector wall opening,
  per-raid cloned state, wire-valid `door` action, collision/LOS/projectile/navigation
  blocking while closed, open/close/unlock prompts, announcements, audio cue, minimap
  and tactical-map markers, and reconnect baselineing. Unit and browser graders pass.
- **Locked areas** — COMPLETE for door-gated rooms. Every sector has a key-gated room/
  vault route that is genuinely unreachable while locked and walkable after consuming
  one carried key; spawn and extraction routes stay reachable.
- **Vaults** — COMPLETE as loot containers. Key requirement, alarm escalation, heavy armor
  drop and hidden loot; vault/browser tests and content tests.
- **Hidden loot** — COMPLETE. Ground loot, roof caches, interior caches, armory caches,
  supply drop and boss salvage are hidden behind exploration/encounters.
- **Dynamic events** — COMPLETE at time/event level. Supply drop, machine reinforcement
  waves, elite patrols, weather, hazard windows and endgame squeeze publish events and
  snapshot data; opt-in field objectives add an authoritative marker/hold/settlement chain (P3, iteration 8).
- **Hazards** — COMPLETE. Sector hazard windows warning/active/expiry, geometry/pixel
  rings, damage and safe cover guidance; escalation unit/browser tests.
- **Dynamic in-raid objectives** — COMPLETE in local authoritative scope: deployment can opt
  into a landmark objective, the server advances approach → hold → secured with pause and
  explicit failure reasons, settlement pays only on secured extraction, and the client
  shows panel/bearing/progress/map markers/announcements/reconnect. Live hosted and
  human-accepted objective feel remain unverified.

## 9. Progression and home base

- **Home base** — COMPLETE. Auth/base screens, deploy/loadout/records/identity, low-RTT
  readiness and reconnect entries; browser account/menu/readiness/entry/network graders.
- **Crafting** — COMPLETE. Workshop crafts medkits, optics, weapons and mods with credits/
  materials/blueprint checks; economy and progression suites and base UI.
- **Offline workshop parity** — COMPLETE (iteration 46). Static Pages `trade` is routed to
  `MemoryRaidStore.trade`, which implements crafting, repair grades, bench/stash upgrades,
  sell/recycle, stack/split, favorite/preset/attachment and overflow claim with the same
  shared catalog rules as `server/store.mjs`; traders and contracts stay online-only.
  Recipe rows show owned salvage, credits and unavailable reasons. Evidence:
  `tests/raid-store-memory.test.mjs`, `tests/raid-offline.test.mjs`,
  `raid-browser-static-base-economy.mjs` (craft/upgrade/reload, no `/api`), plus the P0
  static playability gate and online progression grader. Live-device feel UNVERIFIED.
- **Offline availability clarity** — COMPLETE (iteration 48). On static Pages the Traders
  card explains that vendor stock is online-only, lists held sellable material/valuable
  salvage with authoritative sale values, and liquidates it through the same `bulkSell`
  store rule (favorited stacks excluded; disabled while deployed). Contracts stay online-only
  and render read-only progress plus an explanation instead of 501 action buttons. Hosted
  trader/contract UI is unchanged. Evidence: `tests/raid-browser-static-availability.mjs`,
  static P0 gate, full suite 1239/1239; physical-device feel still UNVERIFIED (P7).
- **Offline deploy readiness** — COMPLETE (iteration 50). The static base's Deploy card
  reports the in-page store's `preflightLoadout` verdict for the current selection through
  a read-only `readiness` route (blocker verbatim, carried weight and insurance premium
  when ready), gates the offline Deploy button, and leaves an active deployment resumable.
  Online behavior is unchanged and the line stays hidden. Evidence:
  `tests/raid-browser-static-readiness.mjs`, `tests/raid-offline.test.mjs`, static P0 gate,
  isolated online smoke, full suite 1240/1240; physical-device feel UNVERIFIED (P7).
- **Offline account surface** — COMPLETE (iteration 52). The static offline Account
  dialog states that the operator, stash and checkpoints are device-local and hides
  online-only password, recovery-code and session controls. Sign-out returns to a
  name-only local sign-in (password hidden/non-required, register and recovery hidden)
  that reuses the same guest account and stash; online account security is unchanged.
  Evidence: `tests/raid-browser-static-account.mjs`, static P0 and readiness graders,
  full suite 1240/1240; physical-device readability UNVERIFIED (P7).
- **Offline insurance refresh** — COMPLETE (iteration 54). The static base's Insurance
  claims card starts from the authoritative pending claim after a death settlement and
  re-renders when the in-page tick's `MemoryRaidStore.processInsurance` returns,
  destroys or invalidates it — no reload and no client rule duplication. Evidence:
  `tests/raid-browser-static-insurance-refresh.mjs`, static P0 and persistence graders,
  full suite 1240/1240; physical-device feel UNVERIFIED (P7).
- **Offline deploy plan** — COMPLETE (iteration 58). The static base previews the selected
  field objective from the shared catalogue (name, site, hold, authoritative credits and
  XP) through the read-only `readiness` route, discards stale/unknown plan ids, persists the
  sector and objective on the device, restores them after reload, and deploys them into the
  real in-page `RaidService`; the offline store settles the authored extraction bonus.
  No rules, loot, damage, rewards or transport changed and online ignores the preference.
  Evidence: `tests/raid-browser-static-plan.mjs`, `tests/raid-plan.test.mjs`,
  `tests/raid-offline.test.mjs` objective/deploy/settlement cases, P0 and readiness gates;
  physical-device readability UNVERIFIED (P7).
- **Vendors** — COMPLETE. Trader stock, prices, locks and starter boundary; `economy`
  tests and browser grants/loadout/rewards.
- **Contracts** — COMPLETE. Accept active contracts, survey/elimination stages, progress
  derived from authoritative facts, claim flow and settlement summary; rewards grader.
- **Upgrades** — COMPLETE. Bench tiers unlock based on blueprints/levels; progression
  tests and browser progression/ranks graders.
- **Persistent stash** — COMPLETE. Inventory checkpoints, insurance/recovery, sell/
  recycle/craft/attach all preserve ownership and revision; loss/recycling tests.
- **Stash rarity and appraisal readability** — COMPLETE (iteration 57). Every base
  stash row now carries a decorative rarity gem in the shared loot palette and one
  compact appraisal line whose weight and sale value come from the authoritative
  `itemWeight` and the store's `profile.sellValues` (fallback `sellValue`); the
  existing condition border/chip and all action controls are unchanged, and no
  rules or persistence changed. Evidence: `tests/raid-browser-stash-rarity.mjs`
  (rarity 3/4/0 seeded rows, palette colours, exact `4.0 kg · 36 cr` / `1.0 kg · 90 cr` /
  `0.6 kg · 6 cr`, one gem/facts per row, zero `/api`, zero browser errors; screenshots
  `/tmp/hs-stash-rarity-before.png` / `/tmp/hs-stash-rarity.png`), plus the static P0
  gate, hud-theme and recycling graders green. Physical-device/human aesthetic
  acceptance remains UNVERIFIED (P7).
- **Loadout selection** — COMPLETE. Chosen gear is authoritative, earn-only and
  incompatible with recovery boundary; loadout/accessibility/rewards graders.
- **Post-raid rewards** — COMPLETE. `#rewards` card from `/api/results` plus sign-out/
  account isolation, focus/navigation and no invented state; rewards grader.
- **Record aggregate on the base** — COMPLETE (iteration 56). The "Raid records"
  card leads with an authoritative aggregate over the same settled results the
  details list — recorded deployments, extractions, deployments ended without
  extraction, interrupted/refunded deployments, raid-reward credits, XP and machine
  destroys — with a first-run empty state, in-place update after settlement and
  reload parity. `careerSummary`/`careerText` in `shared/raid-report.mjs` read only
  the records the store returns; no rules, rewards or client state are invented.
  Evidence: `tests/raid-report.test.mjs` and
  `tests/raid-browser-static-records.mjs`, static P0 gate, online rewards grader.
- **Equipment repair grades** — COMPLETE local (iteration 22). Damaged weapons and armor
  can receive an authoritative partial field patch (+25 condition, capped at 100, one
  wire, credits priced per restored points) or a full workshop repair (100%, one steel,
  existing formula); unknown grades and no-op repairs are rejected, and the stash renders
  both costs and starter-binding hints. `raid-progression.test.mjs` and the real-UI
  repair flow in `raid-browser-rewards.mjs` are green.
- **Deeper human-evaluated economically meaningful choices** — PARTIAL (P10); baseline
  systems work, and condition-scaled equipment recycling now presents a visible repair-
  versus-scrap price, but depth/values are not human-accepted.

## 10. Multiplayer

- **Squads / same-raid team** — COMPLETE local. Party deployments share one authoritative
  raid and team; `raid-parties.test.mjs`, `raid-browser-party.mjs`.
- **Coordinated extraction (link-up bonus)** — COMPLETE local (iteration 11). Same-team
  boarding through the same exit rewards credits/XP from the authoritative snapshot,
  including carried and same-wave departures; card, captions, announcements and report
  are driven by server facts (`raid-squad-extraction.test.mjs`,
  `raid-browser-squad-extraction.mjs`). Live hosted and human-rated coordination remain
  UNVERIFIED.
- **Sync/reconnect** — COMPLETE local. ReliableActions sequence/receipts, snapshot sync
  and prediction reconciliation; browser network/account/smoke and reload persistence.
- **PvP damage** — COMPLETE local; singles/twin-client firing, teams and damage rules.
- **Cooperative revive** — COMPLETE local; tests and browser rescue.
- **Authoritative inventories** — COMPLETE local; body-loot/inventory/give graders prove
  ownership and anti-duplication on the store.
- **Extraction and loot persistence** — COMPLETE local; exits/rewards/loss and body-loot
  flows through isolated Chrome contexts.
- **Live hosted multi-client / independent clients over real transport** — UNVERIFIED/P6;
  no WAN, coworker or long-run hosted acceptance is claimed.
- **Twin-client FPS / timing under real people** — UNVERIFIED (P5/P6), though existing
  body-loot/inventory/interactions graders use two independent Chrome contexts with
  server-authoritative fixtures.

## 11. Game feel (satisfaction, tension, UX)

- **Tension and risk/reward** — PARTIAL. Mutually exclusive caches, fire/light/noise
  consequences, armor loss, gear-loss on death and a ticking deadline create risk; no
  human-paced acceptance.
- **Pacing and encounter variety** — COMPLETE at system level. Five machine types,
  rivals, crawlers, boss, hazard windows, supply drop, elite patrols and endgame squeeze;
  not human-tuned.
- **Loot excitement** — PARTIAL. Rarity, item values, inspect and returned/lost summaries
  exist, and rare/epic/legendary pickups now have a distinct visual celebration, synthesized
  cue and accessible live-region caption derived from the authoritative snapshot (iteration 10).
  Encounter pacing and human-loot excitement remain unverified.
- **Visual/sound feedback** — PARTIAL. Muzzle/reload/boss/incoming-hurt cues exist, and
  authoritative outgoing hit/kill markers, captions and cues are COMPLETE (iteration 6).
  Body/bag labels and map markers are now distinct by container kind (iteration 9, P4);
  the server now records a 1.6 s positioned incoming-damage bearing for every machine,
  rival, hazard, blast and operator shot, and the raid client draws a transient red
  direction arrow with an accessible source/side label (iteration 16). Façade detail is
  richer at street range: 8009 detected exterior window openings now carry projecting
  stone sill ledges and 1681 carry hanging flower-box planters with foliage and blooms,
  proven as instanced PBR `windowSill`/`flowerBox` groups with isolated pixel evidence
  (iteration 21, presentation-only). Salvage cache props now carry a shared-palette tier
  accent — a ground ring, lid rim strips, side ribbons, a front badge and a top seal
  derived from the authoritative cache tier with the vault bonus — plus procedural
  reinforcement feet and riveted lid seams (iteration 23, presentation-only), and a
  shared procedural stamped-metal shell with panel seams, rivet rows, welded braces,
  rust and grime plus corner braces, hinge beam and latch (iteration 45,
  presentation-only; one shared map, tier accents and open/vault lid tint unchanged). Base
  stash weapon/armor rows now carry a compact condition meter, a READY/WORN/CRITICAL
  grade chip and a severity stripe driven by the authoritative condition, alongside
  the existing salvage/repair note (iteration 25, presentation-only). All five machine
  classes now carry a shared procedural worn-plating map (seams, bolts, rust, chips), a
  camera-facing additive halo on the authoritative core that follows state/phase colour,
  and class-specific silhouette details — scout antenna/fins, hunter dorsal ridge/mast,
  heavy hazard chevrons/vents, flyer rotor blades/struts and overlord crown/chest vents
  (iteration 27, presentation-only; live-combat readability and human aesthetics remain
  UNVERIFIED). Machine core hits now carry authoritative weak feedback — a cyan hit
  marker, "Weak point hit" caption and a distinct synthesized cue — and stagger a charged
  attack by a bounded 0.22 s (iteration 28). A weak token now also carries the resolved
  core coordinate, and the client renders one pooled camera-facing cyan burst there —
  additive flash sprite, expanding shock ring, 14-spark field and a bounded tinted light
  — with no burst on a miss or a reconnect baseline and a static reduced-motion variant
  (iteration 29, presentation-only; readable pixel delta 4,234 in an isolated frame,
  subjective live-combat readability UNVERIFIED). Every extraction exit now vents a
  presentation-only signal — a coloured flare and an eight-puff smoke column tinted by
  the authoritative open/inbound/contested window state, deterministic, fully frozen
  under reduced motion and sharing one smoke map and glow map (iteration 51,
  presentation-only; ~2,500-pixel isolated delta in `tests/raid-browser-exit-signal.mjs`;
  live readability on a phone UNVERIFIED). A presentation-only vitality haze now spans
  the raid view from the authoritative hp/downed fields: transparent above 60, restrained
  amber-red at 60 or below, pulsing red at 30 or below, and deep maroon while downed,
  with the pulse and transition removed under reduced motion (iteration 53,
  presentation-only; 610,031-pixel isolated tint delta; live readability UNVERIFIED).
  An active rain front now also paints a presentation-only ground-impact ripple field —
  one 48-instance additive ring mesh on a 1.7 s authored cycle, seated 3 cm above the
  authoritative terrain and re-anchored to the operator each frame, deterministic per
  scene time, hidden under clear weather/reduced motion and disposed with the front
  (iteration 55, presentation-only; 4,903-pixel isolated delta in
  `tests/raid-browser-rain-splashes.mjs`; live phone readability UNVERIFIED).
  Older screenshots may still show the former edge-on ring or the generic "salvage bag"
  wording.
- **UI usability/accessibility** — COMPLETE at automated level. Keyboard/touch, focus
  restoration, next-step announcement, native dialogs, mobile overflow and reduced
  motion validated by accessibility/tactical-map/rewards graders.
- **Replay reasons** — PARTIAL. Contracts, XP/rank, blueprints, insurance, extraction
  rewards and gear retention create reasons to redeploy; long-term playtest retention
  is unmeasured and must not be declared proven.
- **Final subjective quality** — UNVERIFIED. Tests can prove mechanics, not "better than
  ARC Raiders" or human fun/balance. Recorded honestly; no false completion promise.

## Completed in iteration 6

**P1 — Outgoing hit feedback.** COMPLETE. Acceptance criteria and evidence were recorded
in `RALPH_PROGRESS.md` before implementation. Unit and isolated-Chrome graders prove the
server token, marker, caption, cue, miss isolation and reconnect baseline; the prior
ballistics/audio suites stay green. The next active gap was P3 dynamic objectives.

## Completed in iteration 7

**P2 — Interactive doors and locked areas.** COMPLETE in local authoritative scope.
Stable door ids at authored wall openings, deterministic per-raid cloned state, wire-valid
`door` action with key consumption and unchanged-state rejection paths, closed-door
collision/LOS/projectile/navigation blocking, one genuinely gated key-openable room route
per sector (spawn/extraction routes preserved), live prompt/announcement/cue and map
markers, and reconnect baselineing. Evidence: door unit suite 9/9, browser doors grader
green with reconnect authority and screenshots, full unit suite 1,132/1,132, and 34/36
prior browser graders green after the dock layout repair. Environmental gaps: optional
Playwright engine grader lacks its external module; default 1,800 s endurance not run
(25 s smoke green). These are recorded, not hidden.

## Completed in iteration 8

**P3 — Dynamic in-raid field objectives.** COMPLETE in local authoritative scope.
A deterministic catalog derives wire-safe objectives from authored sector landmarks;
deployments explicitly opt in or remain unchanged; unsafe/unknown ids are rejected before
the raid starts. The server owns the approach → secure → secured chain, advances hold only
while alive, inside the radius and not downed, pauses on exit/down, publishes reached and
secured events/noise escalation, and snapshots stage, progress, remaining hold and
coordinates. Extracting after securing pays catalog credits/XP; death, timeout, disconnect
and extracting-before-securing settle as failed with explicit reasons and no bonus. The
client deploys the selected objective and shows an accessible panel (site, distance,
bearing, hold progress and bonus), cyan/green markers on both maps, announcements,
dedicated cues, reconnect authority and rewards/record lines. Evidence: objective unit
suite 10/10; browser objectives grader green with screenshots and zero errors; full unit
suite 1,142/1,142; affected prior browser regression sweep green. Honest gaps: live hosted
multi-client objective play, physical-device feel, 1,800 s endurance and the optional
Playwright engine module remain unverified.

## Completed in iteration 9

**P4 — Corpse bag and dead-body readability.** COMPLETE in local authoritative scope.
Every authoritative container now carries a stable kind/label/owner: operator death
salvage (pink C marker, "Operator salvage bag"/"Squadmate salvage bag"), machine salvage
(amber M), rival salvage (orange R) and dropped gear (lavender G), independent of ground
loot. Out-of-range snapshots keep that metadata while items stay private to the 3 m
interaction range. HUD hints, backpack headings, minimap/tactical markers and legend/aria
distinguish every class and the downed-body search (B, amber L once searched) without
breaking the waypoint or door legend. Death salvage excludes recovery-protected pocket and
temporary recovery gear, taking the last item prunes the container, and a downed operator
remains a body with no phantom salvage bag. Evidence: `raid-bag-metadata.test.mjs` 6/6;
affected unit suites 693/693; full unit suite 1,148/1,148; `raid-browser-body-loot.mjs`
green; new `raid-browser-bag-metadata.mjs` green with zero errors. Honest gaps: hosted
multi-client readability, physical-device feel and long endurance remain unverified.

## Completed in iteration 10

**P9 — Rarity-derived loot pickup celebration.** COMPLETE in local authoritative scope.
Pickups now map the authoritative item rarity (0–5) to a deterministic tier, accent and
synthesized cue in `shared/raid-loot-presentation.mjs`; rare/epic/legendary/special
pickups raise a decorative, non-blocking card with the item name, self-clear in 2.4 s,
honour reduced motion, and write the same tier words to the existing live-region status.
Common/uncommon pickups stay on the plain caption path so the flourish keeps meaning.
Evidence: `raid-loot-excitement.test.mjs` 4/4 plus audio cue unit checks (focused 9/9);
browser `raid-browser-loot-excitement.mjs` green with zero errors (rare/epic/legendary
tiers, distinct accents and cues, self-clear, reduced motion); full unit suite
1,152/1,152; prior inventory/accessibility/hud-layout browser regressions green.
Honest gaps: encounter cadence and human loot excitement are not proven; P5/P6/P7
external gates remain BLOCKED; P8 and P10 remain PARTIAL.

## Completed in iteration 11

**P8 — Squad link-up extraction (coordinated extraction slice).** COMPLETE in local
authoritative scope. `shared/raid-exits.mjs` owns the 4 m / 60 s / two-companion policy
and the +6 credits and +10 XP per linked squadmate. `server/raids.mjs` records bounded
per-wave departures, counts a carried passenger, adjacent living standing squadmates and
recent same-wave teammates, exposes `squadNear` on exit snapshots, and writes
`squadLink`/`squadLinkBonus`/`squadLinkXp` facts that settle through `end(..., exit)`.
`server/store.mjs` adds the link XP to settlement. `raid-online.mjs`/`.html` add a
visible snapshotted chip, accessible bonus label, boarding caption/announcement and a
results line. Evidence: `raid-squad-extraction.test.mjs` 6/6; exits+link 16/16; full unit
suite 1,158/1,158; `raid-browser-squad-extraction.mjs` green (one shared raid, both
settlements 26 credits/30 XP, facts `squadLink=1`, zero errors); prior extraction UI,
exits, rescue, rewards, accessibility and HUD layout green. Honest gaps: richer persistent
squad roles, live hosted coordination, human balance and pacing remain UNVERIFIED.

## Completed in iteration 12

**P8 — Opt-in squad roles (Scout / Medic / Engineer).** COMPLETE in local
authoritative scope. `shared/raid-roles.mjs` owns the role catalog and effect helpers.
`server/store.mjs` validates the role on party readiness and persists it in the existing
member loadout JSON. `server/raids.mjs` assigns each member only their own role, emits it
in `self` and squad snapshots, extends scout ping life to 30 s, shortens medic revive to
3.5 s, and lets engineers pick locked doors without a key (door event, noise, escalation,
`doorsPicked`), while roleless operators still require a key. `raid-online.mjs`/`.html`
add a party-role select with hints, roster summaries, an idle-HUD role label, the role in
the ready payload, and an engineer-aware door control. Evidence:
`raid-squad-roles.test.mjs` 8/8; full unit suite 1,166/1,166;
`raid-browser-squad-roles.mjs` green (three isolated Chrome clients; roster and snapshot
roles; 30 s scout ping; 3.4 s revive still in progress then complete at 3.6 s; keyless
engineer pick with zero key use; zero browser errors); squad-extraction, party, rescue,
comms, accessibility, HUD layout, doors, exits and extraction UI regressions green.
Honest gaps: live hosted role coordination, human balance and richer role depth remain
UNVERIFIED.

## Completed in iteration 14

**P10 — Field salvage appraisal.** COMPLETE in local authoritative scope.
`shared/raid-appraisal.mjs` owns the single base sale-value calculation for weapons,
armor, meds, mods, utilities, valuables, contracts, ammunition, materials and other
kinds; `RaidStore.value()` delegates to it, so appraisals and payouts cannot drift.
`raid-online.mjs` renders a compact `N kg · N cr` appraisal chip row on every backpack
and nearby-loot item (from shared `itemWeight` and `sellValue`), exposes
`data-weight`/`data-sell-value`, and includes both in the row accessible name. The
backpack header adds `salvage N cr`, the total base sale value in pack and protected
pocket, and refreshes on take/secure. Nearby container rows display an accessible
`Backpack full` or `Over weight by N kg` warning before a whole-stack take would fail;
buttons stay enabled so partial takes and squad hand-off remain valid. Evidence:
`raid-appraisal.test.mjs` 2/2 (all item kinds, real store sale), full unit suite
1,168/1,168 sequential; `raid-browser-appraisal.mjs` green (real deployment, chips,
header 0 → 17 cr, Take then Secure, full and overweight warnings, zero browser
errors, screenshot `/tmp/raid-appraisal.png`); inventory, accessibility, loot
excitement, bag metadata, body loot and HUD layout regressions green; the inventory
drag grader now scopes pointer drags to the real pack scrollport so hand-off zones
below the fold stay exercised. Honest gaps: whether a player judges the salvage
"worth it", human loot excitement and hosted multiplayer remain UNVERIFIED.

## Completed in iteration 15

**Combat awareness — directional off-screen threat readability.** COMPLETE in local
authoritative scope. `raid-online.mjs` exports `threatIndicators(snapshot)`, which derives markers only
from living snapshot machines at most 40 m away whose relative bearing is outside a 55°
forward cone, nearest four; `renderThreatIndicators` places them around a fixed ring
using the operator yaw and right-vector math (right/left/behind), exposes `data-machine-id`,
`data-kind`, `data-state`, `data-elite` and an accessible name with machine name, rounded
distance, side, degrees and `· charging`, and reuses a single labelled `#threats` group.
A machine in `windup` gets a red pulsing `!` treatment; reduced motion suppresses the
animation. Forward and >40 m machines produce nothing, and empty snapshots hide and empty
the layer. Evidence: `raid-browser-threats.mjs` green with authoritative fixtures
(forward excluded; three markers at right (+150, 0), left (−150, 0), behind (0, +150);
labels "Prowler 7 m right 90°", "Needle Scout 9 m left 90°", "Bulwark 7 m behind 180° ·
charging"; hidden empty state; zero browser errors; screenshot `/tmp/raid-threats.png`).
Boss, crosshair, HUD layout, accessibility, HUD theme, appraisal and inventory browser
regressions green; sequential unit suite 1,168/1,168. Honest gaps: real-combat readability,
telegraph fairness and organic raid pacing are UNVERIFIED without human playtesters; P5
human balance, P6 hosted transport and P7 physical-device touch remain BLOCKED.

## Completed in iteration 16

**Combat awareness — incoming damage direction.** COMPLETE in local authoritative scope.
`RaidService.damage()` records `hurtFeedback` (`at`, attacker-relative `dx`/`dz`, source)
whenever a finite `from` position is supplied; `snapshot()` exposes it as `self.hurt` for
1.6 s and omits expired or unpositioned damage. Machine strikes (including hazards and
pounce-safe displacement), rival fire, explosive utilities and operator shots pass true
positions; fall and bleed intentionally pass none. The raid client exports
`hurtIndicator()` and renders one transient red arrow inside the threat ring using operator
yaw/right-vector math, with `data-source`/`data-side` and the accessible name
"Incoming damage from behind · machine fire"; it hides and empties when the snapshot has no
recent positioned damage, leaving the hitmarker and threat markers independent. Evidence:
two new unit tests in `raid-hit-feedback.test.mjs` (positioned bearing and expiry; ambient
damage invents none), full sequential suite 1170/1170; `raid-browser-hurt-direction.mjs`
green through a real deployment and an authoritative behind mortar strike (HP 100 → 70 after
armor absorption, single behind marker at (0, 90), label, arrow, cleared after a 3 s clock
advance, zero browser errors, screenshot `/tmp/raid-hurt-direction.png`); hit-feedback,
threats, boss, crosshair, HUD layout, accessibility, HUD theme, ballistics, medical,
appraisal and inventory browser regressions green. Honest gaps: whether the cue feels fair
and legible in live human combat, balance and hosted/device acceptance remain UNVERIFIED.

## Completed in iteration 17

**Combat readiness — ammunition visibility.** COMPLETE in local scope. The raid HUD now
shows the equipped weapon's magazine and catalog capacity (`Ammo N/M`), derived from the
authoritative `self.ammo` and the equipped weapon's catalog `mag`, with warn below 25%
and critical at zero. Empty magazines add a visible, red-cased `EMPTY · RELOAD` alert; an
`aria-label` announces total capacity and empty/low status. Unarmed keeps the existing
`UNARMED` token, and fire/reload remain server-guarded without client-side blocking.
Evidence: `raid-browser-ammo-readiness.mjs` green with a real deployment and native shot
(30/30 → 29/30, exactly one server round), authoritative low/empty fixtures (`7/30` warn,
`0/30` critical + alert), real Reload button restoring `30/30` and consuming a compatible
stack, zero browser errors, screenshots `/tmp/raid-ammo-low.png` and
`/tmp/raid-ammo-empty.png` inspected; 15 affected browser regressions green; sequential
unit suite 1170/1170 on two consecutive runs. Honest gaps: human balance, pacing,
loot-excitement, hosted multiplayer and physical-device acceptance remain UNVERIFIED.

## Completed in iteration 18

**Extraction interaction priority.** COMPLETE in local presentation scope. A natural
acceptance run found that an open evacuation beacon could lose the shipped `E` press to
nearby ambush salvage: the single interaction target was chosen purely by distance, so a
closer machine bag could be looted instead of starting authoritative boarding. Added the
pure shared helper `extractionInteractionTarget(exits,actor,now,radius)` and used it in
`raid-online.mjs` before the ordinary source distance sort. When an exit window is open
(and not full) and within 4 m, the exit is both the hint target and the interact target;
when no window is open, the previous distance ordering and call/unlock/loot behaviour are
unchanged. No server boarding, seat, wave, settlement or other-mode code changed; salvage
remains reachable through its backpack source row, so nothing is silently removed.

Evidence: new unit test in `tests/raid-exits.test.mjs` (reach boundary 3.9 m/4.1 m, window
gating, full exit does not outrank loot); new isolated Chrome grader
`tests/raid-browser-extraction-priority.mjs` — a real deployment, native E presses, labeled
runtime fixture bags. With a locked hatch and nearer salvage, E took the bag SMG and did not
board; with an open call beacon and nearer salvage, E started boarding on `call`, salvaged
bag untouched, authoritative settlement `extract`, zero browser errors. Screenshots
`/tmp/raid-extraction-priority-loot.png` and `/tmp/raid-extraction-priority-open.png`
inspected. Green sequential browser set: exits, interactions, accessibility, bag-metadata,
loot-excitement, ranks, squad-extraction, extraction-ui, doors, body-loot, inventory,
appraisal, ballistics, medical, rescue, sectors, tactical-map, vault, grants, and
loss-report (run against a fresh isolated data dir; the shared stale 8021 service returned a
client-protocol mismatch and was left untouched). Sequential unit suite 1171/1171, all pass.
Honest gaps: the fixture-free natural acceptance run died to a machine after looting and
engaging at the insertion site; with an empty secure pocket because no supply item was
reached, the natural "secure/extract" path is PARTIAL and its script assertion fails. Human
balance, pacing and atmosphere judgments remain UNVERIFIED.

## Completed in iteration 19

**Client view — authoritative idle look synchronization.** COMPLETE in local
authoritative scope. Holding a look key while stationary is still a real authoritative
action: `raid-trigger.mjs` now exports the pure helper `lookNeedsSync(yaw,pitch,synced)`
and the raid client's 150 ms tick uses it before the idle-movement deferral decision. When
the local view has not reached the snapshot (`self.yaw`/`self.pitch`), a view-only move
packet is sent; pure idle with unchanged look still defers the periodic packet. This keeps
the compass, minimap operator bearing, interaction bearings, off-screen threat markers
and incoming-hurt direction driven by authoritative yaw instead of frozen local state.
Yaw comparison is wrap-safe; `NaN` input and missing samples are handled.

Evidence: new unit test in `tests/raid-trigger-latency.test.mjs`; new isolated Chrome
grader `tests/raid-browser-view-sync.mjs` (real deployment, no fixtures) syncs yaw −1.33161 rad
and pitch up +0.86338/down −0.53662 rad with 0 m movement, matching compass 180° → 256°,
zero browser errors, screenshot `/tmp/raid-view-sync.png`. Threat-ring and hurt-direction
browser graders remain green. The fixture-free natural acceptance now locks the nearest
medical/material supply pile, secures a bandage in the protected pocket before engaging a
scout, fires 18 authoritative rounds with native keys, and settles by natural death with
the secured bandage returned and the carried starter/field gear lost; it exits 0. The
natural run's snapshot-driven aim did not land a hit (0 pelletsHit), so hit-rate quality in
motion remains a probe gap. Affected regressions and 1171 other unit tests pass; the
whole suite reports one pre-existing intermittent ECONNRESET in the unrelated matchmaking
wire-latency test (11/11 green when rerun standalone). Honest gaps: natural extraction was
not reached in this run (covered by exit graders), and human balance, paced combat and
loot excitement remain UNVERIFIED.

## Completed in iteration 20

**Natural acceptance — precise aim and a stall-free native route.** COMPLETE in local
authoritative scope. The fixture-free probe now drives the shipped `Arrow` bindings with
exact in-page 100 ms hold timers (`lookPulse`), so the authoritative look changes at the
client rate (yaw 1.7 rad/s, pitch 1.4 rad/s) instead of overshooting from CDP transport
latency. `turnTo` covers the full bearing in one closed-loop pulse and lets the client's
150 ms view-only move packet land before steering again. `walkTo` gained a width-aware
`arrive` band: route legs accept a crossed waypoint (a previous sample inside 3.5 m plus
growing distance) instead of orbiting an overshot point, while loot/exit points stop,
re-aim and take bounded 60–260 ms steps once within 8 m of a tight 1.4 m interaction
target. Evidence: a temporary 69-waypoint relay probe completed 799 m in 262 s with no
stall; the final natural acceptance exited 0 with a `material` secured in the protective
pocket, 772 m travelled, 11 of 17 authoritative pellets hit, settlement `extract`
(5 items returned, 0 lost), and zero browser errors. A second natural run settled by
`death` with 4 hits and a securely pocketed item. New `raid-browser-look-pulse.mjs` proves
the 100 ms pulses at the client's yaw 1.7 rad/s and pitch 1.4 rad/s within one
animation-frame quantum (0.03 rad), green in five consecutive runs (yaw exactly 0.17;
pitch 0.14, or 0.163 when the hold rounds up one 60 Hz frame); view-sync, hit-feedback
and the full 1,172-test unit suite are green. Honest gaps: human playtest
balance/pacing, hosted transport and physical-device acceptance remain UNVERIFIED; the
probe only exercises the local loopback service, and loot/machine placement still varies
per raid.

## Completed in iteration 21

**Façade window sill ledges and flower-box planters.** COMPLETE in local presentation
scope. `raid-environment.mjs` builds a presentation-only 12 m footprint grid from the
frozen block layer so each authored window prop can find its exterior parent face without
quadratic block scans. Every detected opening (8009 of 8823) gains a two-tier projecting
stone sill ledge (`windowSill`); a deterministic share (1681) of broad openings gains a
sun-bleached wooden planter (`flowerBox`) with thin soil, two wind-shared foliage clumps
and three warm flower spheres. Sites publish through `userData.raidWindowSills` with
`planter` metadata and counts ship in `raidStructureDetail`. Evidence:
`tests/raid-browser-structures.mjs` green (counts, deterministic rebuild, lifecycle
restart, `sillPixels: 6153`, `flowerBoxPixels: 29542`, `pbr: true`,
`stateUntouched: true`, `browserErrors: []`) with screenshot `/tmp/hs-window-sills.png`
inspected; full unit suite `1172 pass / 0 fail`. Honest gap: the 814 window props authored
inside/floating in earlier district fabric match no block face and receive no ledge;
human aesthetic acceptance remains UNVERIFIED. This is visual detail only and changes no
raid rules or other modes.

## Completed in iteration 22

**Equipment repair grades — field patch vs workshop repair.** COMPLETE in local
authoritative scope. `shared/raid-grants.mjs` now exposes `patchTarget` and a
target-aware `repairCost`; the base `repair` trade action takes an optional
`quality` (`full` default, or `patch`). A patch restores at most 25 condition points
(capped at 100) and consumes one wire, while full repair restores to 100 with one
steel. Unknown grades and repairs that would restore no condition are rejected, and
the exact restored range/credits are recorded in an `equipment_repair` audit event.
The stash renders both controls for damaged weapons/armor with authoritative costs
and starter-binding hints. Evidence: `tests/raid-progression.test.mjs` proves a
40→65 patch costs 15 credits and one wire, the following 65→100 repair costs 20
credits and one steel, and invalid/no-op grades fail without changing inventory;
`raid-browser-rewards.mjs` exercises both controls through the real post-extraction
UI (`repairGrades`: patch→65%, full→100%, one wire and one steel consumed,
`browserErrors: []`); full unit suite `1173 pass / 0 fail`. Honest gap: the relative
balance/feel of paying partial vs full prices, and hosted/device behavior, remain
UNVERIFIED (P5/P6/P10), so P10 depth stays PARTIAL as a human-acceptance question.

## Completed in iteration 23

**Tiered salvage cache container props.** COMPLETE in local presentation scope. The
authoritative snapshot already carries each cache's authored `tier` and `vault`; the raid
client now feeds `tier + vault bonus` (clamped 0–5) into `propModel('cache', ...)`, which
marks the crate with the same accent the shared loot palette assigns to that rarity. The
tier group adds a ground ring, two lid rim strips, two side ribbons, a front badge and a
corner-seated top seal; independent procedural reinforcement feet and lid rivets improve
the plain body. Opening/lid status colours, lock/search rules, container ownership,
collision and settlement are unchanged. Evidence: `tests/raid-browser-cache-tiers.mjs`
deploys a real relay raid (15 cache props), asserts every prop's tier/accent and geometry
and measures each tier's contribution (571, 605, 656, 614 and 641 changed pixels in a
production-prop bench), with before/after screenshots `/tmp/hs-cache-tiers-before.png` and
`/tmp/hs-cache-tiers.png` inspected; the full unit suite is 1174/1174 and an isolated
smoke browser run stays green. Honest gap: subjective in-world readability (especially the
authored night/rain front), human aesthetic acceptance, hosted multiplayer and
physical-device behavior remain UNVERIFIED; do not claim P5/P6/P7 or human acceptance.

## Completed in iteration 24

**Condition-aware equipment salvage versus repair.** COMPLETE in local authoritative/UI
scope. `shared/raid-inventory.mjs` now exports `equipmentSalvage(condition)` and the shared
`recyclingQuote` uses it for weapons/armor: three steel at 75–100% condition, two at
50–74%, and one below 50%. The base stash labels worn equipment recycling with the
condition and gives each damaged weapon/armor row a small comparison note (steel and its
sale credits versus the full-repair credit/material cost), while the store records the
input condition in the `item_recycled` audit. Repair grades, sale values, favorites,
contract reservations and starter-ownership binding are unchanged. Evidence: a new case in
`tests/raid-recycling.test.mjs` asserts the thresholds, quote quantities, store recycle
output and audited condition; `tests/raid-browser-recycling.mjs` injects one 60-condition
weapon into a real account, asserts the production base row
(`Recycle · 2 steel · worn 60%`, repair/scrap note, title), recycles it and counts 2 steel,
with `conditionScaledEquipmentSalvage:true`, `repairVersusScrapNote:true`,
`browserErrors:[]`; the targeted grants/progression suites are green (27/27); the full
unit suite is 1174 pass / 1 intermittent `matchmaking.test.mjs` ECONNRESET (isolated
rerun 11/11). Honest gap: whether the presented repair-versus-scrap trade is fun or
well-balanced is human-evaluated and UNVERIFIED; hosted/device behavior also remains
UNVERIFIED (P5/P6/P7), so P10 depth stays PARTIAL.

## Completed in iteration 26

**P8 — Fourth opt-in squad role: Hauler.** COMPLETE in local authoritative/UI scope.
`shared/raid-roles.mjs` extends the role catalog with `hauler` (`+4` backpack slots,
`+8` kg weight capacity) and exports `packCapacityFor(role,recovery)` /
`weightCapacityFor(role,recovery)`, which fall back to the 18/40 baseline (8/22 with a
recovery kit) for invalid or roleless deployments and add the hauler bonus only to
haulers. `server/raids.mjs` derives each deployed operator's `cap`/`weightCap` from those
helpers, so the existing snapshot/HUD cleanup counters, pickup weight checks and
give/hand-off capacity rules all consume the bonus without a second rule source. The
party role select gains a Hauler option with its bonus title; the roster summary and
field role label use the catalog automatically. Evidence: `tests/raid-squad-roles.test.mjs`
asserts the four-role catalog, baseline vs hauler capacities for recovery/standard kits,
and a deployed hauler party (`cap:12`, `weightCap:30` beside a baseline scout `8/22`);
`tests/raid-browser-squad-roles.mjs` verifies the real select has the new option/title
alongside the existing authority behavior and reports no browser errors. Honest gap:
live hosted role coordination and human balance/role-depth acceptance remain UNVERIFIED.

## Completed in iteration 28

**Weak-point stagger and authoritative weak-hit feedback.** COMPLETE in local
authoritative/UI scope. `server/raid-ai.mjs` exports `STAGGER={delay:.22,hits:3}` and
`hitMachine` now delays an inbound attack and its matching telegraph expiry on a living
machine's exposed-core hit, capped at three per charge, resetting on resolution or the
next charge; the function returns `{weak,staggered,killed}` for both ballistics and legacy
shot paths. `server/raid-hit-feedback.mjs` accepts the weak outcome and emits an optional
`weak:true` token only for machine hits, leaving all other tokens unchanged.
`shared/raid-hit-presentation.mjs` captions it "Weak point hit"; `raid-online.mjs` renders
a cyan `[data-kind=weak]` marker and `raid-audio.mjs` plays a distinct synthesized weak cue
(and still prefers the kill cue). Evidence: targeted suites are green (57/57 across
encounters/hit-feedback/audio/ballistics and 19/19 game-loop), the real-Chrome grader reports
`weakMarker:true`, `weakCaption:"Weak point hit · machine"`, one weak cue, a server token
with `weak:true` and `kill:false`, and `browserErrors:[]`, with screenshots
`/tmp/headshotz-hit-weak.png` and `/tmp/headshotz-hit-feedback.png`. Honest gap: subjective
weak-point readability and attack-tell fairness under live human combat remain UNVERIFIED,
as do hosted transport and physical-device behavior (P5/P6/P7).

## Later items (not yet closed)

- P5 human balance and potency evaluation (BLOCKED: needs human playtesters).
- P6 hosted multi-client transport/reconnect acceptance (BLOCKED: needs deployed transport/WAN).
- P7 touch/pointer physical-device acceptance (BLOCKED: needs physical devices).
- P8 live hosted role coordination; local Scout/Medic/Engineer/Hauler roles and link-up slices are complete.
- P9 celebration implemented; encounter pacing/human excitement still UNVERIFIED.
- P10 richer persistent progression/economy depth.

All mechanics in the original request are represented above; none is silently removed
or downgraded. Items marked PARTIAL/MISSING/UNVERIFIED stay open until exercised.
