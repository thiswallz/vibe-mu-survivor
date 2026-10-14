# MU Survivor — local proof of concept

A single-player WebGL survival game built from the supplied MU client assets. No account, database, or external service. Once the source is on your machine, the demo runs without an internet connection.

## Run

Use Node.js 20 or newer. From this folder:

```sh
npm start
```

Open **http://localhost:5173**. This builds the UI and starts the local server. There are no npm dependencies to install. Stop with Ctrl+C.

For source development:

```sh
npm run dev
```

Refresh the browser after editing. Use `PORT=5174 npm start` to choose another port.

## Play

- Choose Dark Knight, Dark Wizard, or Fairy Elf.
- Move with WASD or arrow keys. Holding the mouse on the arena also moves toward the pointer (walk nearby, run farther away). Touch devices have a joystick.
- Attacks are automatic. Choose the active skill during battle with the two skill buttons or keys 1 and 2. Space or right click dashes with a three-second cooldown.
- Collect blue experience jewels; choose a blessing each time you level up.
- Survive ten 30-second waves and defeat the Lorencia Guardian. The guardian appears at 04:30; play continues after 05:00 if it is still alive.
- Escape pauses; losing browser focus also pauses. Retry or choose another hero after a run.
- Music and effects begin after your first interaction. Toggle audio at the top right.

The stage contains five enemy types: Spider, Budge Dragon, Bull Fighter, Hound, and Giant. The final guardian is a larger, stronger Giant. Each class has two switchable automatic skills: Dark Knight — Twisting Slash / Death Stab; Dark Wizard — Evil Spirits / Hellfire; Fairy Elf — Multiple Shot / Ice Arrow. Ice Arrow slows enemies. Skill names and visuals come from MU; combat tuning is simplified for this survivor PoC.

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

**Server:** Serves the UI and all assets from loopback only. `GET /api/health` provides readiness; `GET /api/demo` exposes basic demo metadata. Gameplay runs in the browser for this PoC; there is no authoritative multiplayer simulation. During development, the server exposes the shared game source at `/shared/game.js`; builds copy it into the UI output.

**Commands:** `npm start` builds and runs both parts; `npm run dev` serves sources; `npm run build` builds only the UI; `npm run serve` serves an existing build; `npm test` runs the simulation checks.

## Assets and conversion

The converted assets are already included under `apps/ui/public/assets`; the source client folder is not needed to run the demo. `assets/manifest.json` records the source BMD files and triangle counts. Original files remain untouched.

The converter reads BMD v10 and decodes the supplied BMD v15 player animation with an offline LEA helper. Original idle, walk, weapon-specific run and attack clips are baked onto the armor meshes; weapons attach to animated hand sockets. Four walk poses are sampled for enemies. OZJ/OZT images become PNG textures. All world props, weapons and spell meshes are converted from the client.

Lorencia uses the actual `World1/Terrain.map` texture layers, `TerrainHeight.OZB` height field, and 511 placements from `Terrain.obj`, cropped to an 80 × 80 tile region around town. Object types, transforms and scales follow the original client mapping. The player is placed in the plaza. The game currently uses a simple arena boundary; full original map navigation and obstacle pathfinding are outside this PoC.

Health orb, health gauge, experience fill, skill frames and skill icons use converted `Data/Interface/newui_*` assets. Additional readable labels and survivor-specific controls use HTML/CSS. Brief hit particles and targeting indicators remain simple procedural effects.

Music: `Data/Music/Pub.mp3` (Lorencia bar). Effects: `eSwingLightSword.wav`, `sEvil.wav`, `sHellFire.wav`, `SwordInertiaAttack.wav`, `eIceArrow.wav`, `Magic_Arrow_Cast_01.wav`, and `pLevelUp.wav` from `Data/Sound`.

To regenerate assets with Node.js plus Python, Pillow and NumPy installed:

```sh
python3 scripts/convert-assets.py
npm run build
```

The converter expects `../Mu Eternals S20 1-2/Data` relative to `App`. Keep the original folder there only for reconversion.

The offline LEA helper is adapted from [xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer) (ISC; attribution in `scripts/vendor/LEA-LICENSE.txt`). Three.js 0.180.0 is vendored for offline use. Its MIT license is in `apps/ui/public/vendor/THREE-LICENSE.txt`. MU models, textures, music and sounds come from the supplied client and retain their original ownership. This repository is an investor demonstration, not a production MU client.
