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
| HDRI sky (environment reflections) | Kloofendal 48d Partly Cloudy (Pure Sky) | Greg Zaal, Jarod Guest | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |
| Model: barrels | Barrel 03 | Serhii Khromov | https://polyhaven.com/a/barrel_03 | CC0 |
| Model: Royale loot chest (v46) | Treasure Chest | Rico Cilliers | https://polyhaven.com/a/treasure_chest | CC0 |
| Model: crates | Wooden Crate 02 | James Ray Cock, Jurita Burger | https://polyhaven.com/a/wooden_crate_02 | CC0 |

Processing: textures downscaled to 512px (colour maps converted to greyscale detail so map tints still apply); models optimised with gltf-transform (meshopt geometry, 512px WebP textures, simplified). Libraries: three.js r160 GLTFLoader + meshopt decoder (MIT).

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
