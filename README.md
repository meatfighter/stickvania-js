# Stickvania

This repository contains the browser and desktop versions of **Stickvania**, a stick-figure demake of Konami's original _Castlevania_.

I originally wrote Stickvania in Java in 2010 using Slick2D and JInput. The browser version is a TypeScript Progressive Web App (PWA) built on [`slick2d-ts`](https://github.com/meatfighter/slick2d-ts). The maintained Java source remains in this repository as the behavioral and structural reference for the TypeScript port and as the source for downloadable desktop builds.

Stickvania is a reimplementation, not an emulator, and does not contain or run the original NES ROM.

## Gameplay

Stickvania follows the stages, enemy placements, and bosses of the original _Castlevania_ while deliberately changing some mechanics. Simon moves faster and can change direction in midair, weapons and enemies are rebalanced, and several bosses and the ending draw inspiration from _Super Castlevania IV_.

A selectable **Hard** mode is available from the in-game options menu.

## Controls

Stickvania supports keyboard and gamepad input. The default mappings are:

| Action | Keyboard    | Gamepad     |
| ------ | ----------- | ----------- |
| Up     | Up Arrow    | D-Pad Up    |
| Down   | Down Arrow  | D-Pad Down  |
| Left   | Left Arrow  | D-Pad Left  |
| Right  | Right Arrow | D-Pad Right |
| Jump   | X           | A           |
| Attack | Z           | X           |

Press **Attack** to use the whip. Hold **Up** and press **Attack** to use the current sub-weapon.

Mappings can be changed from **Options → Input** in the game.

Two browser controls are reserved and cannot be remapped:

| Key   | Action            |
| ----- | ----------------- |
| Space | Toggle fullscreen |
| Esc   | Exit fullscreen   |

## Browser version

The PWA opens with a browser menu offering **New Game** and **Continue**. Save-ready state is stored in deployment-scoped browser storage so a game can be resumed after closing the tab or browser.

The browser shell also provides volume, display-theme, scaling, and gamepad-rumble preferences. During windowed play, the hamburger button opens the browser menu as a live overlay when the current game state can safely be suspended. The game also suspends when the page loses focus or becomes hidden.

Display scaling supports:

- **Smooth** — linear filtering.
- **Crisp** — nearest-neighbor scaling.
- **Pixel Perfect** — integer nearest-neighbor scaling with letterboxing when necessary.

Rendering uses the shared native-size framebuffer support in `slick2d-ts`, while gameplay coordinates remain at the game's logical resolution.

## Save-state compatibility

Browser save data uses an explicit versioned format with stable entity type identifiers and strict structural validation.

Save schema **9** is the first public save-state format. Earlier schema versions were development-only and are intentionally discarded. If a future public save format is encountered by an older build, that save is left untouched rather than silently rewritten or deleted.

The save system validates object references, entity types, stage structure, stack/grid bounds, random state, audio state, and conservative sanity limits before restoring data. Runtime restoration failures do not automatically destroy the stored save.

Input mappings and other browser preferences are stored separately from game state.

## Repository layout

| Path                              | Purpose                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `pwa/`                            | TypeScript browser/PWA implementation and static game resources            |
| `pwa/src/stickvania/`             | Java-shaped TypeScript gameplay port and browser-side game helpers         |
| `pwa/src/stickvania/persistence/` | Save-state schema, validation, serialization, and restoration              |
| `pwa/src/rumble/`                 | Browser gamepad-vibration support                                          |
| `desktop/`                        | Maintained Java/Slick2D reference implementation and desktop runtime files |
| `about/`                          | Source for the public project/about page                                   |
| `scripts/`                        | Build, verification, packaging, and release tooling                        |
| `version.json`                    | Application version/build-stamp source                                     |
| `THIRD_PARTY_NOTICES.md`          | Third-party notices and attribution                                        |

Generated output such as `node_modules/`, `dist/`, `.release-components/`, and `desktop/target/` is not source and should not be edited manually.

## Requirements

For browser development, use a Node.js version accepted by `package.json`:

```text
^20.19.0 || >=22.12.0
```

Install dependencies from the lockfile:

```sh
npm ci
```

The desktop build uses JDK 21. The Java source is compiled as Java 8-compatible bytecode against the verified legacy runtime dependencies included with the desktop project.

## Development

Start the browser development server:

```sh
npm run dev
```

Run TypeScript checking directly:

```sh
npm run typecheck
```

Run formatting and lint checks:

```sh
npm run format:check
npm run lint
```

Build individual components:

```sh
npm run build:pwa
npm run build:about
npm run build:desktop
npm run build:web
```

Build the complete production artifact:

```sh
npm run build
```

## Verification

The main verification gate is:

```sh
npm run verify
```

It checks formatting and linting, generated resource and Java-parity metadata, save-state field coverage, save-state hardening, buffered scaling, Java/TypeScript parity guardrails, public page output, release tooling, PWA release output, desktop source, and the desktop build.

Real-browser and offline-PWA verification can be run with:

```sh
npm run verify:browser
```

Production dependencies can be audited with:

```sh
npm run verify:dependencies
```

The public release command runs verification, dependency auditing, and the production build:

```sh
npm run release
```

## Java/TypeScript parity

The TypeScript gameplay source intentionally retains much of the organization and numeric behavior of the Java implementation. Java-shaped structure is therefore not automatically technical debt.

Generated parity metadata and dedicated tests guard important behavioral boundaries, including Java float32 semantics and fixed-step timing. Browser-only features such as PWA lifecycle handling, save/continue, display themes, scaling, rumble, and browser menus are kept outside or around the gameplay port where practical.

When changing gameplay code, compare the corresponding implementation under `desktop/src/` before replacing Java-shaped logic with a more idiomatic TypeScript design.

## `slick2d-ts`

The browser project depends on an exact immutable HTTPS archive of a qualified `slick2d-ts` commit. The package and lockfile must agree on that commit. Engine updates should be qualified against Stickvania rather than repinned casually.

## License and attribution

The project source is licensed under **GPL-3.0-or-later**. See `LICENSE`.

Third-party licenses, runtime components, and attribution are documented in `THIRD_PARTY_NOTICES.md` and the desktop runtime documentation.

Stickvania is an unofficial fan-made project and is not affiliated with, sponsored by, or endorsed by Konami or Nintendo. Original game characters, music, sound effects, and other copyrighted material remain the property of their respective rights holders.

Stickvania is provided free of charge, contains no advertising, and generates no revenue.

## Production readiness

See [RELEASING.md](RELEASING.md) for browser qualification, reproducible source
identification, build archives and checksums, artifact retention, and rollback.

The PWA permits one writable game session per deployment path. Another tab can
request **Continue here**; the current owner saves and closes its game before the
new tab starts. Unresponsive owners are not forcibly displaced. This requires a
secure context (HTTPS or localhost), Web Locks, and BroadcastChannel. Close legacy
tabs during the first rollout so every open client uses the ownership protocol.

Resource requests have a 30-second deadline covering response bodies as well as
headers. Audio activation waits at most three seconds before allowing silent play.
Unknown public save versions and oversized saves are preserved; **New Game** and
**Reset** are the explicit paths for replacing protected saves.
