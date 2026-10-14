# MU Survivor — local proof of concept

A single-player WebGL survival game built from the supplied MU client assets. No account, database, or external service. Once the source is on your machine, the demo runs without an internet connection.

## Run

Use Node.js 20.12 or newer. From this folder:

```sh
npm start
```

Open **http://localhost:5173**. This builds the UI and starts the local server. There are no npm dependencies to install. Stop with Ctrl+C.

For source development:

```sh
npm run dev
```

Refresh the browser after editing. Use `PORT=5174 npm start` to choose another port.

## Deployment

Docker, Railway, a configurable private API connection, and environment examples are included. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Play

- Choose Dark Knight, Dark Wizard, or Fairy Elf.
- Move with WASD or arrow keys. Holding the mouse on the arena also moves toward the pointer (walk nearby, run farther away). Touch devices have a joystick.
- Attacks are automatic. Each class starts with one skill. Learn its second skill from a level-up choice, then switch with the two skill buttons or keys 1 and 2. Space or right click dashes with a three-second cooldown.
- Collect blue experience jewels; choose a blessing each time you level up. New skills, a damaging aura, armor rewards, and +13 / +15 enhancements become available as you progress.
- Survive ten 18-second waves and defeat the Lorencia Guardian. The guardian appears at 02:42; play continues after 03:00 if it is still alive.
- Escape pauses; losing browser focus also pauses. Retry or choose another hero after a run.
- Music and effects begin after your first interaction. Toggle audio at the top right.

The stage contains five enemy types: Spider, Budge Dragon, Bull Fighter, Hound, and Giant. The final guardian is a larger, stronger Giant. Each class has two learnable automatic skills: Dark Knight — Twisting Slash / Death Stab; Dark Wizard — Evil Spirits / Hellfire; Fairy Elf — Multiple Shot / Ice Arrow. Ice Arrow slows enemies. Skill names and visuals come from MU; combat tuning is simplified for this survivor PoC.

## Monorepo architecture

```text
App/
  package.json               npm workspaces and root commands
  apps/
    server/src/index.mjs     local HTTP server and /api routes
    ui/
      public/                HTML/CSS, Three.js renderer, converted assets
      build.mjs              produces a self-contained dist directory
      dist/                  generated; ignored by Git
  packages/
    game/src/index.js        rendering-independent game simulation
  scripts/
    start.mjs                builds UI, then starts the production server
    convert-assets.py        original client → browser models/textures/audio
  tests/
    game.test.mjs            combat, progression, pause, dash, win/death checks
```

**UI:** Three.js renders the 3D arena, models, effects and character selection. HTML/CSS renders the interface. Input and audio live here. The game advances at a fixed 60-Hz simulation rate.

**Shared game package:** Character/enemy definitions, movement, waves, attacks, pickups, upgrades and run outcomes. It has no DOM, Three.js, or server dependencies, so it can be tested directly and reused by a future server.

**Server:** Serves the UI and all assets from localhost by default; HOST and PORT configure deployment binding. It can also proxy /api to a private API service via INTERNAL_API_URL. `GET /api/health` provides readiness; `GET /api/demo` exposes basic demo metadata. Gameplay runs in the browser for this PoC; there is no authoritative multiplayer simulation. During development, the server exposes the shared game source at `/shared/game.js`; builds copy it into the UI output.

**Commands:** `npm start` builds and runs both parts; `npm run dev` serves sources; `npm run build` builds only the UI; `npm run serve` serves an existing build; `npm test` runs the simulation checks.

## Assets and conversion

The converted assets are already included under `apps/ui/public/assets`; the source client folder is not needed to run the demo. `assets/manifest.json` records the source BMD files and triangle counts. Original files remain untouched.

The converter reads BMD v10 and decodes the supplied BMD v15 player animation with an offline LEA helper. Original S20 idle, walk and weapon-specific run poses are baked onto the armor meshes with quaternion interpolation. Root motion is removed and strides follow actual distance travelled; weapons attach to animated hand sockets. Attacks use sampled spin, thrust, casting and bow motions from the player animation file. During movement, ranged casts blend upper-body poses over the locomotion cycle. Attack playback speeds up with attack haste. Four walk poses are sampled for enemies. OZJ/OZT images become PNG textures. Transparent OZT variants use separate -alpha filenames so matching JPG/TGA stems do not overwrite one another. World props and weapons are converted from the client. Spell effects are custom animated WebGL trails, glow, sparks and frost/fire bursts inspired by the original skill names; original skill sounds and HUD icons remain.

Lorencia uses the actual `World1/Terrain.map` texture layers, `TerrainHeight.OZB` height field, and 511 placements from `Terrain.obj`, cropped to an 80 × 80 tile region around town. Object types, transforms and scales follow the original client mapping. A runtime filter keeps only small and medium props; large structures, roofs, houses and gates are excluded. Solid props have collision footprints. Players slide along their edges, and enemies steer around them. The player starts in a free part of the plaza. Navigation remains a simple local steering system for the PoC.

Health orb, health gauge, experience fill, skill frames and skill icons use converted `Data/Interface/newui_*` assets. Wave packs intensify during the final five seconds of each 18-second wave. Up to 180 enemies are retained at once. Hit feedback includes a brief armor/body flash, recoil, floating damage, and a red edge flash when the hero takes damage. Death feedback includes a collapsing/fading model, rising soul light, sparks, and the matching original monster sound.

Characters start unarmored using the native Class01 / Class02 / Class03 body pieces. Armor names are verified from the supplied S20 Local/item.bmd table. The converter resolves skin placeholder textures by class and excludes the client’s hidden meshes. Grand Soul uses t_PantMale19.bmd for its pants, matching the client mapping. One additional armor set is available per class: Dark Phoenix (`Male18`), Grand Soul (`Male19`), and Guardian (`Elf05`). +13 and +15 are render enhancements over the actual armor meshes, using the client's Chrome and Shiny textures; they are not separate model files. The aura uses `AuraWave_Blue_00` and `Shiny01` and damages nearby enemies.

The bottom dock groups vitality (orb, current/maximum health and gauge), both switchable skills with cooldown indicators, dash, pause, and experience. Labels and survivor-specific controls use HTML/CSS, with layouts checked at desktop, portrait and landscape sizes.

Music: `Data/Music/Pub.mp3` (Lorencia bar). Effects: `eSwingLightSword.wav`, `sEvil.wav`, `sHellFire.wav`, `SwordInertiaAttack.wav`, `eIceArrow.wav`, `Magic_Arrow_Cast_01.wav`, and `pLevelUp.wav` from `Data/Sound`.

To regenerate assets with Node.js plus Python, Pillow and NumPy installed:

```sh
python3 scripts/convert-assets.py
npm run build
```

The converter expects `../Mu Eternals S20 1-2/Data` relative to `App`. Keep the original folder there only for reconversion.

The offline LEA helper is adapted from [xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer) (ISC; attribution in `scripts/vendor/LEA-LICENSE.txt`). Three.js 0.180.0 is vendored for offline use. Its MIT license is in `apps/ui/public/vendor/THREE-LICENSE.txt`. MU models, textures, music and sounds come from the supplied client and retain their original ownership. This repository is an investor demonstration, not a production MU client.

## Stage loot and saved inventory

Up to five item drops per run: Kundun boxes and a few original MU jewels. Move close to collect. The end-of-run screen lists collected items and banks them in this browser's stash, including after defeat. Opening boxes and equipping stash items in later stages are future features. Browser storage is local to the device and site origin; the localhost stash does not migrate to Railway automatically. No account is needed.

`packages/game/src/loot.js` owns the item catalog, bounded drops, collection and inventory merging; `packages/game/src/inventory.js` adapts persistence to versioned localStorage and the UI imports that adapter. `audio.js` owns native monster voice pools and attenuation. Critical attacks have a 12% base chance, deal 50% extra damage, and display larger cyan numbers; Critical precision upgrades add chance. These combat values are PoC tuning.

The enhancement treatment follows the tiered light effects in [Webzen’s item upgrade guide](https://muonline.webzen.com/pt/gameinfo/guide/detail/32), with browser-rendered chrome highlights and armor-bound sparkles using the client’s effect textures. It is a PoC recreation of the visual treatment.
