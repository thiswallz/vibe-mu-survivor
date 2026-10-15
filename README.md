# MU Survivor

A three-minute, single-player WebGL proof of concept built from the supplied MU client assets. Three hero classes, three worlds with two maps each, ten waves per map, five monster types and a final Guardian. Local accounts and character inventories are stored in SQLite.

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
- Attacks are automatic while stationary. Skills root the hero until the animation completes; walking resumes afterward, and dash can cancel a cast. Both class skills are available from the start; switch with 1/2. XP levels never pause combat or grant blessings, skills, stat boosts, or aura. Bonuses come from equipped items.
- Open **Inventory** or press **I**, during a run, in character selection, or after a run. Opening it pauses active combat. Click an item for its stats dialog; hover for a rotating 3D preview. Drag pieces from the bag to matching slots and back, or use Equip/Unequip. Equipped copies leave the bag. Drop names use MU-style enhancement colors.
- Matching dropped pieces automatically equip **only when that slot is empty**. Occupied slots keep your choice. Class armor and weapons remain restricted to their class; accessories and pets are universal.
- Armor has separate Helm, Armor, Pants, Gloves and Boots slots, with an original client mesh for each piece. The remaining body stays unarmored. Each enhanced piece receives its own +13/+15 shine.
- Each class has one better weapon drop: Giant Sword, Staff of Kundun, or Silver Bow. The first regular drop is a weapon; later drops supply armor pieces. The Guardian drops a Kundun box. At most twelve ground item drops occur per run. Later drops include rings, pendants, shields, wings, pets, and jewels.
- Kundun boxes can be opened from the inventory to receive compatible equipment. Equipment drops and box contents roll enhancements from +0 through +15. Each piece has increasing defense/vitality or weapon attack stats. Jewels from an older stash remain stored for future crafting.
- Pickups and equipment choices are queued to the local SQLite service. Each named character has its own loadout and appears with that gear in character selection. End-of-run results show collected drops. Inventory persists across runs and reloads; it belongs to the selected character in the local database.

Critical attacks have a 12% base chance, deal 50% extra damage, and display cyan numbers. Combat values, item drop rules, equipment defense and box contents are simplified PoC rules.

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

To regenerate, install Python, Pillow and NumPy, keep `../Nexus MU Online/Data` beside the app (or set `MU_ASSET_SOURCE` to a Data directory), and run:

```sh
python3 scripts/convert-assets.py
npm run build
```

The converter requires Node on PATH, or `MU_NODE` set to its executable. The offline LEA helper is adapted from [xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer), ISC attribution in `scripts/vendor/LEA-LICENSE.txt`. Three.js 0.180.0 is bundled from npm; its MIT license is retained under `apps/ui/public/vendor`. MU assets retain their original ownership.

The armor enhancement treatment recreates the tiered light effects described by [Webzen](https://muonline.webzen.com/pt/gameinfo/guide/detail/32), using native Chrome/Shiny textures and armor-bound highlights. This is an investor PoC rather than a full MU client implementation.

## Accounts and characters

Create an account with a username and password, then create up to ten characters. Names are globally unique without regard to case. Select a character, World 1 · Lorencia, and Map 1 · The First Stand to play. No email is required. Class choices are Dark Knight, Dark Wizard and Fairy Elf. Each character begins with an empty inventory; previous browser saves are not automatically imported. Combat level and blessings still reset each run.

The server creates `data/mu-survivor.sqlite` automatically. Override it with `DATABASE_PATH`; back up this database and use a persistent volume when deploying. SQLite files are ignored by Git. Passwords use salted scrypt hashes; sessions use HttpOnly cookies and expire after seven days. Inventory saves are asynchronous, and failures appear on the map selection screen. Gameplay remains client-authoritative for now.

The Nexus client is only an offline reference/conversion source. The app runs from bundled converted assets and never reads the original client at runtime.

Choose **Create account** to open registration, or **Play as guest** to choose a name and class without an account. Guest inventory is held in memory per named character and disappears when the page reloads. Guest mode does not create an account or write to SQLite.

Character creation shows one live animated 3D class preview alongside the class buttons and name field. Creating a character opens World/Map selection directly. Existing accounts show their named roster with the selected character’s equipped 3D preview and an explicit Select Character action. The World/Map screen hides the character lineup.

## Character bag and account vault

Each character, including two characters of the same class, has its own bag and equipped items. Only items explicitly deposited into the account vault are shared. From map selection, open **Vault** in the header or **Account Vault** in Inventory. Deposit or withdraw one copy at a time; unequip an item before depositing it. The vault is unavailable in combat and for guests.

Vault transfers update both inventories in a SQLite transaction. Character and vault revisions reject stale writes or repeated transfers from another tab. Existing local profiles migrate without deleting gear. Back up the SQLite database with the app stopped.

Equipment now has twelve slots: Helm, Armor, Pants, Gloves, Boots, Weapon, Shield, two Rings, Pendant, Wings, and Pet. Initial accessories are Ring of Ice, Ring of Fire, Pendant of Lightning, Small Shield and Wings of Angel. Guardian Angel and Satan occupy the Pet slot and appear beside the character; their bonuses apply only while equipped. Guardian Angel supplies the protective damaging aura, while Satan increases attack power. Matching +13 armor still has its equipment-based shine. Stats, accessory class compatibility and companion motion are simplified survivor rules; elemental resistances, pet durability, jewel crafting and the full MU item catalog are future work.

Additional native assets and their sources are recorded in `assets/accessory-catalog.json`. Run `python scripts/convert-extra-assets.py` with NumPy and Pillow to reconvert just these assets from Nexus, preserving the existing bundled world.

## Worlds, maps and movement

The flow is Account → named character with 3D preview → World → Map → Play. World changes load native terrain and props before enabling Play; errors restore the previous selection. Character and account requests block duplicate submissions. Equipment statistics show the actual item bonuses, and the account vault is disabled during a run.

| World        | Map 1           | Map 2                |
| ------------ | --------------- | -------------------- |
| 1 · Lorencia | The First Stand | Forgotten Crossroads |
| 2 · Noria    | Tree of Light   | Forgotten Grove      |
| 3 · Devias   | Snowfield       | Frozen Pass          |

Each map has its own layout and encounter configuration. Noria and Devias use locally converted native textures, props and music, with new small survivor arena layouts rather than imported encrypted full client maps. `packages/game/stage` defines the catalog and difficulty modifiers; adding maps does not require another UI screen. World assets are regenerated with `scripts/convert-world-assets.py`.

Shields follow the animated off-hand socket. Wings follow the upper spine during walking and skills and play their native flap animation. Guardian Angel and Satan live independently in world space and follow with smoothing; character rotations and skill poses do not rotate them. Both use native seven-frame flight loops plus hovering motion. `scripts/convert-attachment-sockets.py` can add the spine socket to older bundled player exports; the main converter now also emits it.
