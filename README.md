# MU Survivor

A three-minute, single-player WebGL proof of concept built from the supplied MU client assets. Three heroes, one Lorencia stage, ten waves, five monster types and a final Guardian. No account or database is required.

## Run locally

Use Node **24** (see `.nvmrc`; minimum 22.12). From **App**:

```sh
npm ci
npm start
```

Open http://localhost:5173. `npm start` type-checks and builds the UI, shared packages and API, then starts the production server. After the first dependency installation, the built demo needs no internet connection. All models, textures, music and sounds are local.

For development with Vite, live UI reload and TypeScript watchers:

```sh
npm run dev
```

The UI uses port 5173 and proxies `/api` to the API on port 5174. Production serves everything on one origin; `HOST`, `PORT` and an optional private API proxy are configurable. See [DEPLOYMENT.md](DEPLOYMENT.md) for Railway and Docker.

## Play and equipment

- Move with WASD, arrows, mouse hold, or the touch joystick. Space/right click dashes; Escape pauses.
- Attacks are automatic. Learn the second class skill from a level-up blessing and switch with 1/2. Level-ups grant combat blessings, skills and aura, **never armor**.
- Open **Inventory** or press **I**, during a run, in character selection, or after a run. Opening it pauses active combat. Select an item and Equip or Unequip.
- Matching dropped pieces automatically equip **only when that slot is empty**. Occupied slots keep your choice. Equipment is restricted to its class.
- Armor has separate Helm, Armor, Pants, Gloves and Boots slots, with an original client mesh for each piece. The remaining body stays unarmored. Each enhanced piece receives its own +13/+15 shine.
- Each class has one better weapon drop: Giant Sword, Staff of Kundun, or Silver Bow. The first regular drop is a weapon; later drops supply armor pieces. The Guardian drops a Kundun box. At most five ground item drops occur per run.
- Kundun boxes can be opened from the inventory to receive compatible equipment. Better late-wave drops and some box contents have +13 or +15 enhancement. Jewels from an older stash remain stored for future crafting.
- Pickups and equipment choices are saved immediately in this browser. Each hero has its own loadout and appears with that gear in character selection. End-of-run results show collected drops. Inventory persists across runs and reloads; it is local to the device and site origin.

Critical attacks have a 12% base chance, deal 50% extra damage, and display cyan numbers. Critical precision increases the chance. Combat values, item drop rules, equipment defense and box contents are simplified PoC rules.

Survive to 03:00 and defeat the Guardian, which appears at 02:42. Play continues past three minutes if the Guardian is still alive. Up to 180 enemies are retained; the final five seconds of each 18-second wave intensify the horde. Hit feedback includes flashes, recoil and floating numbers. Monster idle, attack and death voices use the matching original client sounds, with bounded pools and distance-based volume. Lorencia bar music starts after interaction; the audio button mutes everything.

## Compiled monorepo

```text
App/
  apps/
    ui/src/                TypeScript WebGL, effects, audio and inventory UI
    ui/src/styles/         CSS bundled by Vite
    ui/public/assets/      converted MU assets and source provenance
    ui/index.html          Vite entry
    server/src/            TypeScript HTTP API, static delivery, private proxy
  packages/
    models/src/            shared domain models and API contracts
    game/src/              simulation, equipment, drops, persistence and stage rules
    sdk/src/               typed, validated API client
  scripts/                 local build/dev orchestration and offline asset conversion
  tests/                   tests against compiled packages; HTTP integration checks
```

Every first-party application module is TypeScript. Shared packages and server compile with `tsc` project references and declarations; Vite bundles the browser app and Three.js. Strict checking runs before the production build. The API SDK owns service requests, timeouts, response validation and errors. The storage adapter is separate from equipment and drop rules; a future account-backed implementation can replace it. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Development checks

```sh
npm run typecheck
npm run lint
npm run format
npm run format:check
npm test
npm run build
npm run check
```

`check` runs type checking, ESLint, Prettier verification, tests and the production build. `lint:fix` applies automatic lint fixes. The GitHub Actions workflow runs the same checks. Dependency versions are locked in `package-lock.json`.

## Native assets

Characters use the supplied unarmored `Class02` (Knight), `Class01` (Wizard), and `Class03` (Elf) parts. Skin placeholders are resolved by character class; hidden meshes are excluded. Armor reward names come from `Local/item.bmd`: Dark Phoenix (`Male18`), Grand Soul (`Male19`, including `t_PantMale19`), and Guardian (`Elf05`). Equipment mesh parts replace only their corresponding body slot. Transparent OZT variants have separate `-alpha` texture files to preserve transparency.

The converted files are included, so the original client directory is not required to run or deploy. `assets/manifest.json`, `armor-catalog.json` and `credits.json` record source files and texture mappings. Lorencia uses the original terrain layers, height field and placements, with a runtime filter for small/medium props and collision footprints.

BMD v10/v15 meshes and native S20 animations are converted offline. Locomotion follows actual travel distance; attacks use the original spin, thrust, cast and bow motions. Skill effects use custom animated WebGL geometry inspired by MU names. Inventory frames, cells and empty-slot artwork come from `Data/Interface/newui_item_*` and `InventoryBox2`.

To regenerate, install Python, Pillow and NumPy, keep `../Mu Eternals S20 1-2/Data` beside App, and run:

```sh
python3 scripts/convert-assets.py
npm run build
```

The converter requires Node on PATH, or `MU_NODE` set to its executable. The offline LEA helper is adapted from [xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer), ISC attribution in `scripts/vendor/LEA-LICENSE.txt`. Three.js 0.180.0 is bundled from npm; its MIT license is retained under `apps/ui/public/vendor`. MU assets retain their original ownership.

The armor enhancement treatment recreates the tiered light effects described by [Webzen](https://muonline.webzen.com/pt/gameinfo/guide/detail/32), using native Chrome/Shiny textures and armor-bound highlights. This is an investor PoC rather than a full MU client implementation.
