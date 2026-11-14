# HeadShotz third-party assets

Everything below is **CC0 1.0 (public domain)** from [Poly Haven](https://polyhaven.com/license). No Roblox, NC/ND or ripped assets are used. All game sound effects are synthesised in code (Web Audio), no sample files.

| Used for | Asset | Author(s) | Source | License |
|---|---|---|---|---|
| Texture: concrete surface | Concrete Floor 02 | Rob Tuytel | https://polyhaven.com/a/concrete_floor_02 | CC0 |
| Texture: brick surface | Red Brick 03 | Rob Tuytel | https://polyhaven.com/a/red_brick_03 | CC0 |
| Texture: planks surface | Brown Planks 03 | Rob Tuytel | https://polyhaven.com/a/brown_planks_03 | CC0 |
| Texture: asphalt surface | Asphalt 02 | Rob Tuytel | https://polyhaven.com/a/asphalt_02 | CC0 |
| Texture: rock surface | Rock Wall 08 | Amal Kumar | https://polyhaven.com/a/rock_wall_08 | CC0 |
| Texture: tiles surface | Floor Tiles 06 | Rob Tuytel | https://polyhaven.com/a/floor_tiles_06 | CC0 |
| Texture: metal surface | Metal Plate | Rob Tuytel | https://polyhaven.com/a/metal_plate | CC0 |
| Texture: grass surface | Leafy Grass | Charlotte Baglioni | https://polyhaven.com/a/leafy_grass | CC0 |
| Texture: sand surface | Coast Sand 01 | Rob Tuytel | https://polyhaven.com/a/coast_sand_01 | CC0 |
| Texture: plaster surface | Painted Plaster Wall | Amal Kumar | https://polyhaven.com/a/painted_plaster_wall | CC0 |
| Texture: crate surface | Plywood | Rob Tuytel | https://polyhaven.com/a/plywood | CC0 |
| Texture: forest floor surface (v59) | Forrest Ground 01 | Rob Tuytel | https://polyhaven.com/a/forrest_ground_01 | CC0 |
| Texture: dirt surface (v59) | Brown Mud Dry | Rob Tuytel | https://polyhaven.com/a/brown_mud_dry | CC0 |
| Texture: gravel surface (v59) | Gravel Ground 01 | Rob Tuytel | https://polyhaven.com/a/gravel_ground_01 | CC0 |
| Texture: cobble surface (v59) | Cobblestone Floor 04 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_04 | CC0 |
| HDRI sky (environment reflections) | Kloofendal 48d Partly Cloudy (Pure Sky) | Greg Zaal, Jarod Guest | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |
| Model: barrels | Barrel 03 | Serhii Khromov | https://polyhaven.com/a/barrel_03 | CC0 |
| Model: Royale loot chest (v46) | Treasure Chest | Rico Cilliers | https://polyhaven.com/a/treasure_chest | CC0 |
| Model: crates | Wooden Crate 02 | James Ray Cock, Jurita Burger | https://polyhaven.com/a/wooden_crate_02 | CC0 |
| Model: Pistol weapon (v60) | Service Pistol | Mateusz Sadek | https://polyhaven.com/a/service_pistol | CC0 |
| Model: Sniper rifle weapon (v60) | Bolt Action Rifle 7.62 | Mateusz Sadek | https://polyhaven.com/a/bolt_action_rifle_7_62 | CC0 |
| Model: Katana weapon (v60) | Antique Katana 01 | Tal Swicegood | https://polyhaven.com/a/antique_katana_01 | CC0 |
| Models: Assault rifle (M4A1), SMG (Grease Gun) and Shotgun weapons (v60) | Guns & Explosives pack (M4A1, AK-47, Grease Gun, Suomi KP, Sniper, Luger, Shotgun, Frag Grenade, Smoke Grenade, Flashbang, Molotov Cocktail) | 3dmodelscc0 | https://3dmodelscc0.itch.io/free-cc0-guns-explosives-pack | CC0 |
| Model: Axe weapon (v60) | Wooden Axe | Ulan Cabanilla | https://polyhaven.com/a/wooden_axe | CC0 |
| Texture: gun wood grain (v60) | Black Walnut Veneer 02 | Jenelle van Heerden | https://polyhaven.com/a/black_walnut_veneer_02 | CC0 |

Processing (v60 weapons): scanned meshes simplified with meshoptimizer to a ~8k-triangle first-person version and a ~3-4k-triangle third-person version, textures resized to 1024/256px WebP, original node names kept so slides, bolts and magazines still animate.

Processing: surface textures downscaled to 512px and kept in full colour (the raid scene repeats them at real brick/board scale and keeps the photographed hue; building tints now set exposure only, with the pre-photo greyscale tint retired); gun wood grain likewise keeps the black-walnut colour. Models optimised with gltf-transform (meshopt geometry, 512px WebP textures, simplified). Libraries: three.js r160 GLTFLoader + meshopt decoder (MIT).

## Characters (v39)

All player, bot and hub-NPC characters are built from **MakeHuman** assets, CC0 (public domain):

| Use | Asset | Author | Source | License |
|---|---|---|---|---|
| Body mesh, skeleton ("game_engine" rig) + weights, low-poly proxy `male1591` | MakeHuman base mesh / MPFB 2.0.18 system assets | MakeHuman Community (makehuman_system) | https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html | CC0 |
| Skins | young_caucasian_male, young_african_male, young_asian_male, middleage_african_male | makehuman_system | same pack | CC0 |
| Clothes | male_casualsuit01 (recoloured in-shader into team shirt + class trousers/camo), shoes03 | makehuman_system | same pack | CC0 |
| Hair, eyes, eyebrows, eyelashes | short02, low-poly eyes (brown), eyebrow001, eyelashes01 | makehuman_system | same pack | CC0 |

Generated headless with Blender 4.2 + MPFB 2.0.18 (the exporter output is CC0 per the MakeHuman licence); three LOD tiers (hi ≈28k tris, md ≈17k, lo ≈9.7k) exported to glTF, compressed with gltf-transform (meshopt) and textures converted to WebP (1024/512 px). Helmets, plate carriers, packs and patches are procedural (HeadShotz code). Animation is procedural on the skeleton with IK hands on the weapon. Library: three.js SkeletonUtils (MIT).

## HeadShotz Royale (v45+) — asset source review

| Source | Used? | Why |
|---|---|---|
| Poly Haven | **Yes** (CC0, keyless API, unique User-Agent) | Treasure Chest model (Royale chests) + all earlier textures/models/HDRI. It has no airship, balloon, helicopter or glider models. Large foliage (island_tree_*) was tried and rejected: 8–12 MB after meshopt, too heavy for iPhone. |
| SketchUp 3D Warehouse | No | Models are under the 3D Warehouse General Model Terms; redistribution inside a public web game is not permitted, and downloads need a Trimble sign-in. |
| BIMobject | No | Personal / project-planning use only; no redistribution rights. |
| Fab | No | Requires a signed-in Epic account (not allowed to create one). Only individual CC0/CC-BY listings would be usable; the Fab Standard License forbids redistributing raw files in a web game. |
| Meshy | No (no key) | API needs a paid Pro plan; env var would be `MESHY_API_KEY`. Free plan = 100 credits/month, web UI only, CC BY 4.0 output (~30 credits per textured model). |
| Hyper3D Rodin | No (no key) | API needs a Business plan; env var would be `HYPER3D_API_KEY` (Rodin docs call it `RODIN_API_KEY`). ~0.5 credit per Gen-1 generation at ~$1.50/credit. |

Heroes (`toon.js`), battle bus, glider and gun grips are original, procedurally built in code. Gun hands are the existing procedural viewmodel hands (no third-party assets).

## Character skins (v56)

The 40 shop skins are **original procedural geometry written in code** (`kits.js`): armour plates, helmets, capes, hats, packs, belts and props are lathed/extruded primitives attached to the MakeHuman skeleton bones, with per-skin cloth shader styles (mummy wraps, zombie rags, stripes), PBR-style gear materials (metal, leather, cloth, glass, scales, fur) and a built-in analytic sky/ground reflection. No third-party models or textures were added; the only external assets in the characters remain the CC0 MakeHuman body/skin/hair/eyes above. Skin tone, eyes and body proportions are recoloured/scaled per skin. The v55 galaxy skins' animated star/nebula shader is original code too. (Retargeting third-party rigged outfits was not possible without Blender in this environment.)

## Sidekicks (v57)

The 15 sidekick buddies (dog, cat, bunny, bat, fox, penguin, bear, tiger, speedy hedgehog, lion cub, caped hero pup, two-headed cat-dog, robot, ghost, baby dragon) are **original low-poly models written in code** (`sidekicks.js`): shared primitive geometry, cached materials, procedural animation. The hedgehog, hero pup, cat-dog, robot, ghost and dragon are original designs (not based on any existing franchise character). No third-party models, textures or sounds were added.

## Royale inventory & Secret crates (v58)

No new third-party assets. The typed quick slots, backpack, swap prompts, red **Secret** rarity tier, secret crates (red glow, beam, alarm sound, minimap ping) and their sounds are **original code and procedural geometry/WebAudio** in `game.js` / `style.css`.

## v58b: chests, doors, crouch, non-lethal slot
No new third-party assets. The PBR chest kit (`chests.js`: wood planks, iron bands, lock, lid hinge, rarity glow), the swinging doors, the new door/crouch sound effects and the decoy model are all procedural (generated in code, existing CC0 Poly Haven wood/metal textures reused).

## v62: battle bus engine audio (CC0)
`heli_loop.mp3`: a loopable 8 s mono excerpt (steady middle section, cross-faded at the loop point, loudness-normalised, MP3 48 kbps) of **"Helicopter SFX" by WuxiaScrub**, https://opengameart.org/content/helicopter-sfx, licence **CC0** (public domain, no attribution required; credited anyway). Played as a looping Web Audio source whose gain and low-pass follow the distance to the bus. The old synthesized engine pulses remain only as a fallback until the sample has loaded.

## v91: Battle Royale biomes & effects
No new third-party assets. The 16 named areas of Skyline Island (Neon City, Inferno Forge, Golden Savanna, Nebula Realm, Moonlit Lagoon, Thunder Isle, Crystal Caverns, Aurora Ridge, Firefly Hollow, Phantom Keep, Rust Valley, Blossom Village, Toxic Swamp, Frostbite Peaks, Jungle Ruins, Sandstorm Dunes) are **original code**: `biomes.js` (per-area sky / fog / light blending, pooled ambient particles, rain streaks, lightning, procedurally painted ground textures, the area-name banner) and `biomeprops.js` (crystals, floating rocks, lava pools, neon signs, ice spikes, mushrooms, waterfall and so on, built from the same merged primitives as the rest of the map). The extra muzzle sparks, biome-tinted bullet impacts, chest-open / elimination bursts, landing dust, glider trails and the animated storm wall are built on the existing pooled FX system and one GLSL shader written for the game.

## v93: ambient life
No new third-party assets. The airliners, contrails, helicopters, bird flocks, bats, deer and rabbits are generated in code (original low-poly shapes). Any future CC0/CC-BY models will be listed here.

## v94 — Pet tiers + active abilities (batch 1)
No third-party assets. Shadow Bat ("Nyx") and Ember Dragon ("Cinder") are original in-code models (`petmodels.js`, `petkit.js`: membrane wings, glowing eyes, T2 halo, T3 spark aura). All code is original.

## v95 — Pet batch 2
No third-party assets. Wisp (Phantom Wisp), Glacier (Frost Fox) and Volt (Thunder Hawk) are original in-code models (`petmodels2.js`, built with `petkit.js`); abilities live in `petabil.js`.

## v96 — Pet batch 3
No third-party assets. Rocky (Stone Golem Pup), Fenix (Phoenix Chick), Finn (Shark-Pup), Mirra (Mirror Monkey), Orbit (Gravity Owl), Bandit (Magnet Raccoon) and Magnetron (Magnet Drone) are original in-code models (`petmodels3.js`, built with `petkit.js`); abilities live in `petabil2.js`.

## v97 — Battle Royale roofs, auto-pickup, mantle
No third-party assets: all new geometry (ladders, stair runs) and code are original.

## v98 — Godly/Secret chests, sculpted add-ons, Galaxy rebuild
No third-party assets: ears, horns, tails, wings, crowns, halos and the Galaxy helmet/visor (`addons.js`, `galaxyhead.js`) and the nebula/starfield shader (`wskins.js`) are original procedural code.

## Raid mode (iteration 87) — ships the main game's art
No new downloads or third-party files. Raids opt in to the art the main game already ships and reuse the existing registry above: the CC0 Poly Haven surface textures (`assets/tex/*.jpg`) through `assets.js`/`loadAssets()`, the CC0 MakeHuman bodies and skins through `humans.js`/`loadHumans()`, and the CC0 scanned guns already registered for v60. Everything is the same origin-relative static payload; raid-specific procedural fallbacks remain in place until the load resolves.

Iteration 93: the painted-steel `drum` map, brushed-steel rim/lid map and the crate battens/lid/bracing added to `gfx.js`/`raid-environment.mjs` are **original procedural code and geometry**, no third-party files; all other raid surfaces continue to use the CC0 Poly Haven texture pipeline above.

## Raid scout — Quaternius "Robot Enemy Legs Gun" (CC0), iteration 99
`assets/models/machines/scout.glb` (316 KB, ~4.7k tris, 15-joint skin, seven authored clips) by **Quaternius**, published on Poly Pizza at https://poly.pizza/m/lFZfDh2hzP, licence **Public Domain (CC0 1.0)**; source FBX/GLTF "Robot Enemy Legs Gun" (Aug 2022, animated). It replaces the procedural orange-bowl scout in raid mode. Presentation only: the server still owns the machine's health, yaw, attack windup and shot tokens, and the client reports hostile fire through the same authoritative tracer pipeline. Materials are recoloured in `raid-models.mjs` from the asset's authored names to dark worn gun-metal with a small emissive orange weak-point core; five of the seven clip names (`Idle`, `Walk`, `Run`, `Attack`, `Shoot`) drive the rig.

## Raid facades — Poly Haven "Modular Urban Apartments Facade" window module (CC0), iteration 105

`assets/models/windows/window_urban.glb` (186 KB, ~1.4k tris, two materials with 512 px WebP maps) is a single façade window extracted from **"Modular Urban Apartments Facade" by James Ray Cock**, published on Poly Haven at https://polyhaven.com/a/modular_urban_apartments_facade under **CC0 1.0** (public domain, no attribution required; credited anyway). The source GLB `window_centered_large_01` is a photogrammetry-scanned timber sash window with recessed glass; unrelated alley modules were removed, node transforms and bounds normalised, textures resized and converted to WebP with glTF-Transform. Raid mode instances the frame and glass into existing near-spawn window openings; the procedural dark pane remains behind the glass as the interior and the procedural trim/shutter/sill boxes are hidden at upgraded sites. Presentation only — the server's world, collision and window data are unchanged.

## Raid building façades — Poly Haven "Modular Urban Apartments Facade" kit (CC0), iteration 106

`assets/models/buildings/facade_kit.glb` (636 KB, seven instanced modules, 512 px WebP maps) is derived from **"Modular Urban Apartments Facade" by James Ray Cock**, published on Poly Haven at https://polyhaven.com/a/modular_urban_apartments_facade under **CC0 1.0** (public domain, no attribution required; credited anyway). Modules kept: `wall_standard_standard_01` (dressed plaster wall bay), `door_centered_large_01` (timber door with recessed glass), `base_standard_01` (projecting foundation plinth), `cornice_standard_standard_01` (roofline cornice), `wall_pier_standard_01` (sculpted façade pier), `dado_standard_standard_01` and `crown_standard_standard_01` (wall-band and roof-tile trim). Unrelated alley modules were removed, node transforms and bounds normalised so each module is centred on x/z with its base at y = 0 and front facing +z, textures resized to 512 px WebP/JPEG, and scanned geometry simplified with meshoptimizer (per-module triangle counts: wall 459, door 1,070, base 8, cornice 18, pier 375, crown 578, dado 8). Raid mode instances these modules map-wide as the visible street façade; the old flat extruded box skins and procedural plank doors are no longer drawn. Presentation only — the server's world, collision, door and prop data are unchanged.

## Raid ground and nature — Poly Haven scans (CC0), iteration 107

The pavement, sidewalk, gravel bank and terrain no longer rely on flat author-picked colours in the raid. Five photographed PBR sets live under `assets/tex/ground/` as 512 × 512 JPEGs: a diffuse albedo, a tangent-space normal map and a packed roughness map (`*_d.jpg`, `*_n.jpg`, `*_r.jpg`). The street slabs use asphalt/concrete; the raised bank uses the gravel set plus the dirt terrain tile; each map is exposed with `RepeatWrapping` and the terrain gets its own high-repeat clones so grains stay small at first-person range. All are CC0 1.0 (public domain, credited anyway):

| Sets | Asset | Author(s) | Source | License |
|---|---|---|---|---|
| `asphalt_d/n/r.jpg` | Asphalt 02 | Rob Tuytel | https://polyhaven.com/a/asphalt_02 | CC0 1.0 |
| `concrete_d/n/r.jpg` | Concrete Floor 02 | Rob Tuytel | https://polyhaven.com/a/concrete_floor_02 | CC0 1.0 |
| `gravel_d/n/r.jpg` | Gravel Ground 01 | Rob Tuytel | https://polyhaven.com/a/gravel_ground_01 | CC0 1.0 |
| `dirt_d/n/r.jpg` | Brown Mud Dry | Rob Tuytel | https://polyhaven.com/a/brown_mud_dry | CC0 1.0 |
| `gravelfloor_d/n/r.jpg` | Gravel Floor | Jenelle van Heerden (processing), Matterfield (photography) | https://polyhaven.com/a/gravel_floor | CC0 1.0 |

The 15 ground files total 1,533,679 bytes. Only the map channels change at load; surface instancing, slab footprints, terrain collision and all authored data are untouched.

Near-spawn vegetation is rebuilt from six optimized CC0 Poly Haven scans in `assets/models/nature/`, one GLB per kind. Each was transformed to a metre-scale height, centred on x/z with its base at y = 0, simplified with meshoptimizer and glTF-Transform, and its textures resized to 512 × 512 (WebP where the scan has alpha; JPEG normal/roughness otherwise). Presentation only; placement is deterministic and seeded from frozen world props, and no collision is derived from it.

| File | Asset | Author(s) | Source | Final triangles | Size |
|---|---|---|---|---|---|
| `tree_small_02.glb` | Tree Small 02 | Rico Cilliers | https://polyhaven.com/a/tree_small_02 | 1,681 (from 8,726) | 847,728 B |
| `shrub_02.glb` | Shrub 02 | Rico Cilliers | https://polyhaven.com/a/shrub_02 | 1,059 (from 8,160) | 204,468 B |
| `fern_02.glb` | Fern 02 | Rob Tuytel (scanning), Rico Cilliers (modelling) | https://polyhaven.com/a/fern_02 | 2,768 (from 2,801) | 221,368 B |
| `grass_medium_02.glb` | Grass Medium 02 | Rico Cilliers | https://polyhaven.com/a/grass_medium_02 | 119 (from 397) | 102,856 B |
| `tree_stump_01.glb` | Tree Stump 01 | Rob Tuytel | https://polyhaven.com/a/tree_stump_01 | 1,327 (from 7,381) | 397,956 B |
| `rock_07.glb` | Rock 07 | Jenelle van Heerden | https://polyhaven.com/a/rock_07 | 652 (from 5,936) | 225,224 B |

All six are CC0 1.0, total 1,999,600 bytes (under the 3 MB cap). Leaves use the scanned diffuse + alpha packed as a WebP and an alpha-tested cutout (`alphaTest .42`) so instances stay opaque to the depth buffer; the remaining materials keep photographed albedo, normal and roughness maps. The shared deterministic wind shader and its reduced-motion zero-clock behavior are applied by `raid-view.mjs`.
