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
- Move with WASD or arrow keys. Holding the mouse on the arena also moves toward the pointer. Touch devices have a joystick.
- Attacks are automatic. Space or right click dashes with a three-second cooldown.
- Collect blue experience jewels; choose a blessing each time you level up.
- Survive ten 30-second waves and defeat the Lorencia Guardian. The guardian appears at 04:30; play continues after 05:00 if it is still alive.
- Escape pauses; losing browser focus also pauses. Retry or choose another hero after a run.
- Music and effects begin after your first interaction. Toggle audio at the top right.

The stage contains five enemy types: Spider, Budge Dragon, Bull Fighter, Hound, and Giant. The final guardian is a larger, stronger Giant. Each class has its own automatic attack: an area slash, explosive seeking magic, or multiple arrows.

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

The converter reads the supplied unencrypted BMD v10 meshes, bakes their bone hierarchy into geometry, and samples four walk poses for the enemies. OZJ and OZT images become PNG textures. Armor pieces are assembled into the three characters. Weapons and spell visuals are simple demo geometry. The heroes use a static armor pose with movement sway; full player skeletal animation is outside this initial PoC. Encrypted v15 client models are not converted.

Music: `Data/Music/Pub.mp3` (Lorencia bar). Effects: `eSwingLightSword.wav`, `sMagic.wav`, `Magic_Arrow_Cast_01.wav`, and `pLevelUp.wav` from `Data/Sound`.

To regenerate assets with Python, Pillow and NumPy installed:

```sh
python3 scripts/convert-assets.py
npm run build
```

The converter expects `../Mu Eternals S20 1-2/Data` relative to `App`. Keep the original folder there only for reconversion.

Three.js 0.180.0 is vendored for offline use. Its MIT license is in `apps/ui/public/vendor/THREE-LICENSE.txt`. MU models, textures, music and sounds come from the supplied client and retain their original ownership. This repository is an investor demonstration, not a production MU client.
