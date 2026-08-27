# stickvania-js

This repository contains the browser and desktop release project for **Stickvania**.

The browser version is a TypeScript Progressive Web App (PWA) port of the original Java game and uses `slick2d-ts` as its Slick2D-style runtime layer. The desktop tree preserves the original Java project as a buildable archival artifact and as a behavioral reference for the browser port. A static public project/about page is built and released with both versions.

The TypeScript gameplay code intentionally stays close to the Java implementation where practical. Browser-only behavior—PWA lifecycle, deployment-scoped storage, save/continue, page UI, dark display mode, fullscreen/focus handling, and optional gamepad rumble—is layered around that gameplay port instead of being used as a reason to rewrite it wholesale.

The root release tooling treats `dist/` as a canonical deployable artifact. Production output is built in a verified candidate location first and is promoted only after the required checks succeed.

---

## Start Here

If you are new to the repository, keep these points in mind:

1. **`pwa/` is the browser game.** It contains the TypeScript port, browser shell, persistent-state implementation, service worker, resources, and rumble integration.
2. **`desktop/` is the preserved Java game.** It remains buildable for archival use, parity checks, and downloadable desktop releases.
3. **`about/` is the production source for the public project page.** The root `about.md` is project prose/reference material; `scripts/build-about.mjs` builds the deployed page from `about/`.
4. **`scripts/` is the build/release system.** It stamps generated output, verifies the PWA and desktop package, enforces release-path safety, locks release operations, and promotes verified production candidates.
5. **`dist/` is generated production output.** Do not patch it directly or manually assemble production output inside it.
6. **Save data has an explicit compatibility model.** Stable `Thing` type IDs and a versioned snapshot format prevent minification/class-layout changes from silently reinterpreting old saves.
7. **A public release uses `npm run release`.** That command runs the verification gate, performs the high-severity dependency audit, builds a production candidate, verifies it, and promotes it to `dist/`.

For ordinary browser development:

```sh
npm ci
npm run dev
```

On Windows, `npm.cmd` can be used instead of `npm`.

For a public production build, use:

```sh
npm run release
```

Do not invoke internal underscore-prefixed build scripts directly unless you are changing the release implementation itself.

---

## Mental Model

The repository has three layers:

```text
SOURCE
  about/        production project-page source
  pwa/          TypeScript browser game
  desktop/      preserved Java game
       |
       v
RELEASE TOOLING
  scripts/      build + verify + stamp + package + promotion/recovery
       |
       v
CANONICAL ARTIFACT
  dist/         exact generated tree to deploy
```

The normal public release path is:

```text
clean Git checkout
       |
       v
npm run verify
       |
       v
npm audit --audit-level=high
       |
       v
build a fresh production candidate
       |
       v
verify PWA + desktop ZIP + candidate invariants
       |
       v
confirm tracked source did not change
       |
       v
journal-promote candidate to dist/
       |
       v
smoke-test generated artifacts
       |
       v
deploy dist/
```

The important distinction is that **component builds and production releases are different artifacts**. Component builds under `.release-components/` are useful for development and verification, but only the production path is allowed to replace `dist/`.

### Source-of-truth quick reference

| Concern | Source of truth | Generated/derived output |
| --- | --- | --- |
| Gameplay behavior | `pwa/src/stickvania/`, compared with Java under `desktop/src/` | bundled PWA JavaScript |
| Browser shell/lifecycle | `pwa/src/main.ts` | bundled PWA JavaScript |
| Game resource inventory | `pwa/src/resources.ts` | runtime-prepared resources |
| Browser rumble | `pwa/src/rumble/` | Gamepad vibration calls |
| Deployment-scoped storage | `pwa/src/stickvania/BrowserStorageKeys.ts` | browser local-storage keys |
| Save/continue format | `pwa/src/stickvania/persistence/` | browser save state |
| Static PWA/offline behavior | `pwa/public/`, `pwa/vite.config.ts` | generated PWA release |
| Public project page | `about/` | root of assembled web/full release |
| Desktop Java source | `desktop/src/` | `desktop/target/` and desktop ZIP |
| Desktop runtime contract | `desktop/RUNTIME_DEPENDENCIES.md` plus full-repo runtime files | packaged desktop runtime |
| Release version/build stamp | `version.json` + release-time stamp override | generated PWA/about/release filenames |
| Production release logic | `scripts/` | production candidate then `dist/` |

If source and generated output disagree, fix the source and rebuild. Do not edit generated files to make a release look correct.

---

## Release Deliverables

After a successful public release, `dist/` is the deployable web tree:

```text
dist/
├── index.html
├── styles.css
├── assets/
├── pwa/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── ...built game resources...
└── downloads/
    ├── stickvania-desktop.zip
    └── stickvania-desktop-<version>.zip
```

The stable and versioned desktop ZIPs represent the same generated desktop release under two download names.

The public root page links into the PWA, so users do not need to know or enter `/pwa/` directly.

`dist/` is generated. Do not use it as a source tree.

---

## Requirements

### Node and npm

Use a Node version accepted by `package.json`:

```text
^20.19.0 || >=22.12.0
```

Install JavaScript dependencies from the lockfile:

```sh
npm ci
```

The browser toolchain uses TypeScript, Vite, ESLint, Prettier, and `slick2d-ts`.

### Java desktop toolchain

The Java desktop source is legacy-style and is compiled to Java 8-compatible bytecode.

The root desktop builder tries available build routes conservatively:

1. Maven on the host;
2. Maven in WSL2 when running from Windows and WSL2 Maven is available;
3. a direct `javac`/`jar` fallback.

This allows a developer with a JDK but no Maven installation to build the desktop artifact.

If Maven is installed, Java-only development can also use:

```sh
cd desktop
mvn package
```

That is a developer build path. Public desktop releases should still be produced by the root release tooling, which verifies runtime/source hashes and the final ZIP.

See:

- `desktop/README.md`
- `desktop/RUNTIME_DEPENDENCIES.md`

### Git

The production build requires a clean Git source tree and captures tracked-source state so the release candidate cannot be promoted if tracked source changes during the build.

---

## Repository Layout

### Source and configuration

| Path | Purpose |
| --- | --- |
| `about/` | Source template/assets for the deployed public project page. |
| `about.md` | Project/about prose reference; not the input consumed by `scripts/build-about.mjs`. |
| `pwa/` | TypeScript browser PWA. |
| `pwa/src/main.ts` | Browser application shell and lifecycle/UI integration. |
| `pwa/src/resources.ts` | Application resource inventory/preparation data. |
| `pwa/src/rumble/` | Browser Gamepad vibration implementation and effect definitions. |
| `pwa/src/stickvania/` | Main TypeScript gameplay port plus browser storage/input helpers. |
| `pwa/src/stickvania/persistence/` | Versioned save-state schema, preflight validation, snapshots, serializer, store, and stable `Thing` registry. |
| `pwa/public/` | Manifest, service-worker source, images/audio/game resources, and other static PWA files. |
| `desktop/` | Preserved Java project, legacy NetBeans/Maven metadata, launchers, runtime documentation, licenses, and third-party source material. |
| `scripts/` | Build, verification, stamping, desktop packaging, release locking, path safety, and production-promotion tooling. |
| `version.json` | Checked-in application version/build stamp. |
| `package.json` | Root development/build/release command surface. |
| `package-lock.json` | Reproducible JavaScript dependency resolution. |
| `THIRD_PARTY_NOTICES.md` | Root third-party notices. |
| `LICENSE` | Project license. |

### Generated and local state

The following are generated/local-only and should not be committed:

```text
node_modules/
dist/
.release-components/
.release-secrets/
.release-candidates/
.dist-pending-*/
.dist-previous-*/
.dist-active-before-*/
desktop/target/
releases/*.zip
releases/*.log
releases/*.tmp
```

The release code owns these paths. Do not manually move recovery state around while a release recovery path exists.

---

## Source Trees

### `about/` — Public project page

`about/` contains the source consumed by the production about-page build.

The repository also contains root `about.md`, but that file is not what `scripts/build-about.mjs` renders into `dist/index.html`. Treat `about.md` as project prose/reference material unless the build scripts are deliberately changed to consume it.

The production page is stamped with release information and assembled with the PWA and desktop download links.

Do not patch `dist/index.html` after release. Change `about/` or the about build script and rebuild.

### `pwa/` — Browser/PWA port

`pwa/` is a Vite/TypeScript application using the root package installation.

The source is organized as:

```text
pwa/src/
├── main.ts
├── resources.ts
├── styles.css
├── rumble/
└── stickvania/
    └── persistence/
```

#### `pwa/src/stickvania/`

This is the Java-shaped TypeScript gameplay port.

It contains game entities, enemies, bosses, weapons, stage/region logic, input abstractions, the main game class, and browser-side helpers associated closely with game behavior.

When changing gameplay, compare the TypeScript class with the corresponding Java implementation under `desktop/src/` before assuming that Java-shaped structure is accidental technical debt.

The goal is not to make the browser source look maximally idiomatic at the expense of parity. It is to make browser-specific architecture clean **around** a gameplay implementation whose behavior can still be compared with Java.

#### `pwa/src/main.ts`

`main.ts` is the primary browser integration layer.

It coordinates browser concerns including:

- browser startup and menu flow;
- New Game / Continue;
- resource preparation;
- responsive canvas sizing and high-DPI behavior;
- fullscreen/focus/visibility behavior;
- volume and browser options;
- dark display mode;
- optional gamepad rumble;
- save/continue integration;
- game/menu transitions.

If a feature exists because Stickvania is running on a web page rather than in the original Java desktop container, inspect `main.ts` before putting the feature into gameplay classes.

#### `pwa/src/resources.ts`

This is the application-level resource inventory used by the browser startup/preparation path.

The application resource list and the service-worker precache are related but separate concepts:

- the application resource inventory says what the game must prepare;
- the service-worker precache says what generated files belong in the release cache.

A resource change can require updates/tests in both places.

#### `pwa/src/rumble/`

Browser rumble is isolated under:

```text
pwa/src/rumble/
├── BrowserHaptics.ts
├── RumbleEffects.ts
└── RumbleManager.ts
```

`RumbleManager` is opt-in and browser-only. It manages effect patterns, channels, cancellation/exclusivity, minimum intervals, suspension, and cleanup.

Disabling or suspending rumble stops active sequences and silences connected gamepads.

Keep this system browser-specific. The preserved Java game is not the architectural source for web haptic behavior.

#### `pwa/src/stickvania/persistence/`

Save/continue is explicit and versioned:

```text
GameStatePreflight.ts
GameStateSchema.ts
GameStateSnapshot.ts
StickvaniaGameStateSerializer.ts
StickvaniaGameStateStore.ts
ThingTypeRegistry.ts
```

The persistence layer handles more than a few scalar fields. It captures enough runtime state to resume a game, including stage/object graphs, main-game state, mode-specific state, random state, and audio/song state.

`ThingTypeRegistry.ts` provides stable serialized IDs for game object types. This is intentional: minification, constructor names, import ordering, or class rearrangement must not silently turn a saved object into a different runtime type.

When changing the save format, update the schema/serializer/tests deliberately.

### `desktop/` — Preserved Java desktop project

The desktop tree is an archival copy of the original Java Stickvania project and also serves as a behavioral reference for the TypeScript port.

The legacy layout includes Java and resources under `desktop/src/`, along with:

- NetBeans project metadata (`build.xml`, `manifest.mf`, `nbproject/`);
- Maven/assembly metadata;
- platform launchers;
- legacy runtime JAR/native material in the full repository;
- licenses and third-party source material;
- `README.md`;
- `RUNTIME_DEPENDENCIES.md`.

Generated `build/`, `dist/`, `target/`, machine-local NetBeans state, and crash logs are not source.

The desktop runtime remains intentionally conservative. It preserves the Slick2D/LWJGL-era stack rather than modernizing the rendering/audio platform as part of the browser-port project.

### `scripts/` — Build and release system

The scripts are easier to understand by responsibility.

| Area | Representative scripts | Responsibility |
| --- | --- | --- |
| Stamped component builds | `run-stamped-release.mjs`, `stamp.mjs` | Provide release build stamps and run component scripts under managed output rules. |
| PWA/about build | Vite command surface, `build-about.mjs` | Build browser/about output. |
| Desktop build | `build-desktop.mjs`, `desktop-runtime-manifest.mjs` | Compile/package Java and enforce runtime dependency expectations. |
| Desktop verification | `verify-desktop-release.mjs`, `copy-desktop-release.mjs`, `release-desktop.mjs` | Validate ZIP contents/hashes/launchers and stage a verified desktop release. |
| PWA verification | `verify-pwa-release.mjs` | Validate generated PWA resources, service worker, deployment-relative behavior, storage/cache assumptions, and related invariants. |
| Release tooling tests | `verify-release-tooling.mjs` | Exercise build/release safety behavior and regressions. |
| Production release | `build-production.mjs`, `assemble.mjs` | Build a full verified candidate and promote it to `dist/`. |
| Path/lock/filesystem safety | `build-utils.mjs` | Managed output paths, link/path validation, release-operation locking, atomic/recovery helpers used by the release workflow. |
| ZIP support | `zip-store.mjs` | Create/inspect release ZIP content used by packaging/verifiers. |

Internal underscore-prefixed npm scripts are implementation primitives. Normal developer/release work should use public commands.

---

## Daily Development Workflow

### Start the browser game

```sh
npm run dev
```

This starts the Vite development server on loopback.

### Run the normal verification gate

```sh
npm run verify
```

The current `verify` command runs:

1. Prettier formatting check;
2. ESLint;
3. release-tooling verification;
4. a stamped PWA release build/test;
5. the desktop build.

For individual checks:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run verify:release-tooling
npm run test:pwa-release
npm run build:desktop
```

### Format source

```sh
npm run format
```

### Dependency advisory check

```sh
npm run verify:dependencies
```

This runs:

```text
npm audit --audit-level=high
```

The dependency audit is part of `npm run release`, but not the deterministic `verify` command.

### Run the desktop build

```sh
npm run build:desktop
npm run run:desktop
```

---

## Browser/PWA Architecture

### Slick2D compatibility layer

The PWA uses `slick2d-ts`, a TypeScript/browser adaptation of the Slick2D API surface used by the Java game.

Treat runtime upgrades as behavior-sensitive changes. Rendering, timing, audio, input, and controller behavior can all affect gameplay parity even when the project still compiles.

### Browser shell versus gameplay code

Keep the boundary clear:

- `pwa/src/stickvania/` contains the game port;
- `pwa/src/main.ts` coordinates browser/page behavior;
- `pwa/src/rumble/` owns browser haptics;
- `pwa/src/stickvania/persistence/` owns browser save/continue state.

That separation makes it possible to preserve a Java-comparable gameplay core without forcing browser lifecycle/storage/service-worker concerns into it.

### Focus, visibility, and suspension

Browser focus/visibility changes can interrupt rendering/input/audio for arbitrary lengths of time.

The web layer must suspend/resume cleanly instead of treating a long-hidden tab as if it merely rendered one unusually slow frame. When changing timing/lifecycle code, test:

- tab hide/show;
- window focus loss/return;
- browser back/forward/reload behavior;
- audio resume;
- input state after resume;
- rumble suspension/cancellation.

### Resource loading

`pwa/src/resources.ts` is the application resource inventory.

The final release also has a generated service-worker precache list. A release verifier checks the generated PWA rather than assuming source/resource lists are correct merely because the build completed.

---

## Deployment-Relative PWA Design

The PWA is designed to work from more than one installation directory.

Release tests exercise paths such as production, staging, and nested preview locations rather than assuming one hard-coded root.

### Vite/static URLs

Generated static URLs must remain deployment-relative.

Do not introduce a hard-coded production or staging prefix into browser resource URLs.

### Service-worker scope

`pwa/public/sw.js` derives cache identity from:

- `self.registration.scope`;
- the release version/build identity.

Its cache prefix includes an encoded deployment scope, so side-by-side deployments do not treat each other’s immutable caches as their own.

The worker only handles same-origin `GET` requests within its own service-worker scope.

### Navigation and static requests

Navigation uses network access with an offline cached-index fallback.

Static resources are served from the versioned release cache when available.

The worker does not indiscriminately take over unrelated paths on the same origin.

### Browser storage scope

`pwa/src/stickvania/BrowserStorageKeys.ts` derives local-storage keys from the deployment directory path.

Separate deployment roots therefore receive separate persistent namespaces.

Query-string changes are not intended to create a new logical save namespace; deployment path is the meaningful identity.

This is what allows staging and production copies to coexist on one origin without sharing save/settings data.

---

## Persistent State

The browser port can resume a game across page sessions through an explicit snapshot format.

### Preflight validation

`GameStatePreflight.ts` performs a lightweight validation before advertising Continue.

Its behavior is intentionally conservative:

- current-format plausible snapshots can enable Continue;
- malformed/obsolete state can be cleared;
- a snapshot from a **future schema version** is preserved rather than destroyed by older code;
- local-storage failures are handled without crashing the application.

A future-version save is not treated as restorable by the older client, but it is not casually deleted.

### Stable `Thing` IDs

Runtime constructor names are not a safe persistence format.

`ThingTypeRegistry.ts` defines explicit stable IDs for serialized game object types. Tests ensure that minification or class-name changes do not silently change the meaning of existing saves.

When adding a new serializable `Thing` type, update the registry deliberately.

### Changing the save format

When persistent state changes:

1. decide whether the change is compatible with existing snapshots;
2. update the schema/snapshot/serializer deliberately;
3. preserve stable `Thing` IDs;
4. update preflight and serialization tests;
5. test save/continue in multiple modes/stages;
6. test malformed and future-version state;
7. test after a real page reload.

---

## Browser Options and Rumble

Stickvania’s browser wrapper intentionally contains features not present in the preserved Java application.

Current browser-facing integration includes:

- New Game / Continue;
- volume control;
- display-mode option;
- fullscreen/responsive browser behavior;
- persisted input configuration;
- optional gamepad rumble.

Rumble is disabled unless the user enables it.

The rumble manager supports named effects, channels, effect cancellation, minimum repeat intervals, and suspension. Browser lifecycle changes should stop rumble rather than leave hardware vibrating after the game has been hidden or paused.

When changing rumble behavior, test with a physical gamepad. Browser APIs and controller actuators vary; compile-time success is not a hardware smoke test.

---

## Versioning and Build Identity

`version.json` contains the tracked application version and a build stamp.

These values have distinct roles:

- `version` is the human/application release version;
- `buildStamp` contributes to generated release/cache identity.

### Manual source stamp

```sh
npm run stamp
```

intentionally updates `version.json`.

### Normal release-time stamp

Component and production release wrappers do **not** need to permanently rewrite tracked `version.json` just to create fresh generated output.

`run-stamped-release.mjs` creates a fresh effective stamp and supplies it through:

```text
STICKVANIA_BUILD_STAMP
```

with the corresponding release override controls.

The production pipeline uses the same principle: generated artifacts receive a fresh release stamp while source bytes are restored/checked defensively.

This distinction matters because a failed or killed build should not leave the source tree dirty merely because the release needed new cache-busting identity.

---

## Build and Release Workflows

There are separate commands for PWA components, web components, desktop artifacts, lower-level production assembly, and the public release gate.

### PWA component build

```sh
npm run build:pwa
```

This is the public alias for the stamped release PWA component build.

Generated component output lives under `.release-components/`, not canonical `dist/`.

### About-page component build

```sh
npm run build:about
```

This creates stamped about-page component output under managed release-component storage.

### Web component build

```sh
npm run build:web
```

This builds about + PWA together under `.release-components/`.

It is useful for inspecting the web deliverable without promoting a production release.

### Desktop build

```sh
npm run build:desktop
```

Generated Java output lives under `desktop/target/`.

### Standalone desktop release

```sh
npm run release:desktop
```

This runs the repository `verify` gate (which builds the desktop artifact) and then atomically copies the produced versioned desktop ZIP into local `releases/`.

It does not run the separate `verify:desktop-release` command again during the copy step, and it does not produce the complete public website release.

### Lower-level production build

```sh
npm run build
```

This executes `scripts/build-production.mjs`.

It creates and verifies a production candidate, protects the existing `dist/`, checks tracked-source integrity, and promotes the candidate.

`npm run build` is intentionally a lower-level production operation used by the public release wrapper.

### Public production release

```sh
npm run release
```

This is the normal public release command.

It expands to:

```text
npm run verify
npm run verify:dependencies
npm run build
```

Use **`npm run release`** when the intent is “qualify and create the production artifact.”

### Build-command quick reference

| Goal | Command | Output |
| --- | --- | --- |
| Develop browser game | `npm run dev` | Vite dev server |
| Build PWA component | `npm run build:pwa` | `.release-components/pwa/` |
| Build about component | `npm run build:about` | `.release-components/about/` |
| Build about + PWA component | `npm run build:web` | `.release-components/web/` |
| Build desktop JAR/ZIP | `npm run build:desktop` | `desktop/target/` |
| Stage standalone desktop ZIP | `npm run release:desktop` | `releases/` |
| Run lower-level production assembly/promotion | `npm run build` | `dist/` after candidate verification |
| **Run complete public release gate** | **`npm run release`** | **verified `dist/`** |

---

## Production Release Pipeline

The public release wrapper first runs verification and the dependency audit, then invokes the production build.

The production build itself is candidate-first:

```text
acquire release-operation lock
       ↓
recover interrupted previous promotion
       ↓
require/capture clean tracked source
       ↓
capture tracked-source hashes
       ↓
generate effective build stamp
       ↓
build PWA candidate
       ↓
build about page
       ↓
build desktop package
       ↓
assemble candidate
       ↓
verify PWA + desktop release
       ↓
restore/check version source
       ↓
confirm tracked source unchanged
       ↓
journal-promote candidate to dist/
```

The production build runs its internal release primitives against a managed candidate directory rather than allowing each component to write directly to `dist/`.

A failure before promotion preserves the previous `dist/`.

A deliberately injected/tested failure after candidate creation must likewise not destroy the last good release.

---

## Release Safety and Provenance

### Clean source requirement

Production promotion requires a clean Git working tree.

The build records tracked source before building and checks it again before promotion. If a tracked file changes while the release is running, promotion stops.

A clean tree at startup is not enough for a long build; the final source-state comparison protects against mid-build edits.

### Managed output paths

The release system recognizes specific generated roots rather than accepting arbitrary recursive-delete targets.

This protects source directories and repository roots from accidental cleanup.

### Symlink and junction safety

Output/path validation rejects filesystem-link situations that could make a generated path escape its managed root.

Treat these checks as release safety, not cosmetic code. Windows junctions matter just as POSIX symlinks do.

### Release-operation lock

Release mutation uses a shared lock so nested/parallel release commands cannot clean, stamp, build, or promote the same generated paths concurrently.

Do not manually delete a release lock simply because a process previously died. Run the normal recovery-aware command first.

### Candidate-first promotion

The production candidate is fully built and verified before it can replace `dist/`.

Promotion uses journaled filesystem state so an interrupted rename sequence can be recovered conservatively.

The invariant is:

> Recovery should leave a complete previous release or a complete new release at `dist/`, not an empty/half-promoted production tree.

### Source immutability

The production builder stores the original `version.json` bytes and restores/checks them as part of the release flow.

That is defense in depth around transient build stamping; generated release identity should not silently mutate committed source.

---

## Generated Directory Lifecycle

### `.release-components/`

Component outputs, test builds, production candidate state, release-lock state, and promotion/recovery working data used by the current release implementation.

It is generated and ignored.

Do not deploy a component subdirectory merely because it contains a working PWA.

### `.release-secrets/`

Reserved ignored release-only private/local state.

Never include it in a source or deployment archive.

### `.release-candidates/`

Ignored generated release coordination/candidate state.

Treat it as release-tool-owned data.

### `.dist-pending-*`, `.dist-previous-*`, `.dist-active-before-*`

Temporary/recovery paths used around release promotion workflows.

Do not delete these casually if an interrupted operation is being recovered.

### `desktop/target/`

Generated Java classes/JAR/ZIP/distribution staging.

Regenerate it rather than editing it.

### `releases/`

Local staging for verified standalone desktop ZIPs.

### `dist/`

Canonical promoted production output.

Treat it as disposable generated output that can always be recreated from source + the release process.

---

## Testing

The normal gate is:

```sh
npm run verify
```

It covers formatting, lint, release-tooling tests, a stamped PWA release/test path, and desktop building.

The release-tooling/PWA tests cover concrete invariants such as:

- deployment-relative PWA behavior;
- service-worker scope/cache isolation;
- browser storage namespaces;
- save-state preflight;
- stable serialized `Thing` IDs;
- release path safety;
- version/build-stamp propagation;
- clean-source requirements;
- source immutability;
- release lock behavior;
- failed/interrupted promotion handling;
- desktop package requirements.

The desktop release verifier checks the generated ZIP rather than trusting the compile step. Its checks include expected entries, documented runtime/source SHA-256 values, stable/versioned desktop ZIP identity, launcher permissions, and rejection of accidental/undeclared runtime files.

Before a public release, `npm run release` also runs:

```sh
npm audit --audit-level=high
```

When changing release tooling, add a test for the failure mode being addressed. When changing gameplay, automated release tests do not replace manual play/parity testing.

---

## Common Change Workflows

### Changing gameplay

1. Start in `pwa/src/stickvania/`.
2. Find the corresponding Java class under `desktop/src/`.
3. Decide whether the change is a parity fix, intentional browser divergence, or shared behavior change.
4. Keep browser-only behavior outside gameplay classes where practical.
5. Run `npm run verify`.
6. Play-test the affected mechanic and nearby interactions.

### Changing the browser shell/options

1. Start in `pwa/src/main.ts`.
2. Identify any persistent setting/storage impact.
3. Consider focus/visibility/fullscreen behavior.
4. Consider touch-free keyboard/gamepad navigation paths where relevant.
5. Run `verify`.
6. Test from generated PWA output, not only the dev server.

### Changing save/continue

1. Review `pwa/src/stickvania/persistence/`.
2. Decide whether the serialized format remains compatible.
3. Preserve stable `Thing` type IDs.
4. Update snapshot/serializer/preflight logic deliberately.
5. Update persistence tests.
6. Test saves across multiple modes/stages and real reloads.

### Adding a serializable game object type

1. add the gameplay class;
2. add it to `ThingTypeRegistry.ts` if it can appear in persisted state;
3. update serializer logic if the type needs custom fields;
4. run stable-type/save-state tests;
5. create/restore a save containing the object.

### Changing rumble

1. start in `pwa/src/rumble/`;
2. keep browser hardware behavior out of Java gameplay code;
3. consider cancellation, exclusivity, minimum intervals, and suspension;
4. test enable/disable transitions;
5. test hide/focus/pause behavior;
6. smoke-test with physical controller hardware.

### Adding or moving PWA resources

1. update source resources;
2. update `pwa/src/resources.ts` when the game must prepare the resource;
3. run the stamped PWA build/test;
4. verify service-worker precache output;
5. test from a non-root deployment path when URL generation changed.

### Changing service-worker behavior

1. update `pwa/public/sw.js` and/or build configuration;
2. consider side-by-side deployment scopes;
3. consider online navigation and offline fallback;
4. preserve scoped cache cleanup;
5. run `test:pwa-release` and `verify`;
6. manually test install, reload, offline reload, and upgrade behavior.

### Changing desktop dependencies

Update together:

- `desktop/lib/` and/or `desktop/natives/` in the full repository;
- platform launchers/classpath/native assumptions;
- `desktop/RUNTIME_DEPENDENCIES.md`;
- dependency licenses/notices;
- `desktop/third-party-sources/`;
- `desktop-runtime-manifest.mjs`;
- desktop package verifier expectations.

Then build and launch the **generated ZIP** on every OS/JVM combination you intend to advertise.

### Changing release infrastructure

1. identify which managed output path/policy is involved;
2. preserve candidate-first production builds;
3. preserve source-state checks;
4. preserve lock/recovery behavior;
5. add adversarial tests for crash/race/path cases;
6. run `npm run verify`;
7. run `npm run release` from a clean checkout.

---

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local PWA development server. |
| `npm run clean` | Remove/recreate managed canonical `dist/` output. |
| `npm run typecheck` | Run TypeScript checking. |
| `npm run lint` | Run ESLint over browser source/config/service worker. |
| `npm run format` | Apply Prettier. |
| `npm run format:check` | Check formatting. |
| `npm run verify:release-tooling` | Exercise release-tooling safety tests. |
| `npm run test:pwa-release` | Build a stamped PWA test artifact and verify it. |
| `npm run verify` | Run the normal source/release qualification gate. |
| `npm run verify:dependencies` | Run high-severity npm advisory audit. |
| `npm run build:pwa` | Build stamped PWA component output. |
| `npm run build:about` | Build stamped about-page component output. |
| `npm run build:web` | Build stamped about + PWA component output. |
| `npm run build:desktop` | Build desktop JAR/ZIP. |
| `npm run verify:desktop-release` | Verify generated desktop release package. |
| `npm run release:desktop` | Stage a verified standalone desktop ZIP. |
| `npm run run:desktop` | Run the built desktop game. |
| `npm run build` | Run lower-level candidate-first production build/promotion. |
| **`npm run release`** | **Run verification + dependency audit + production build.** |
| `npm run preview:pwa` | Preview the PWA with Vite. |
| `npm run preview:dist` | Preview generated `dist/`. |
| `npm run stamp` | Intentionally update the tracked `version.json` build stamp. |

---

## Where Do I Make This Change?

| Goal | Start here |
| --- | --- |
| Player/enemy/boss/game mechanics | `pwa/src/stickvania/`, compare `desktop/src/` |
| Browser menu/startup/lifecycle/options | `pwa/src/main.ts` |
| Browser resource inventory | `pwa/src/resources.ts` |
| Rumble/haptic effects | `pwa/src/rumble/` |
| Deployment-scoped browser keys | `pwa/src/stickvania/BrowserStorageKeys.ts` |
| Input mapping/game input | `pwa/src/stickvania/ButtonMapping.ts`, `StickvaniaInput.ts`, browser shell integration |
| Save-state schema/preflight | `pwa/src/stickvania/persistence/GameStateSchema.ts`, `GameStatePreflight.ts` |
| Save serialization/store | `pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts`, `StickvaniaGameStateStore.ts` |
| Stable saved-object IDs | `pwa/src/stickvania/persistence/ThingTypeRegistry.ts` |
| Offline/cache behavior | `pwa/public/sw.js` |
| PWA build configuration | `pwa/vite.config.ts` |
| Public project page | `about/`, `scripts/build-about.mjs` |
| Java behavior | `desktop/src/` |
| Desktop build/runtime | `scripts/build-desktop.mjs`, `desktop/RUNTIME_DEPENDENCIES.md` |
| Desktop runtime allowlist/hashes | `scripts/desktop-runtime-manifest.mjs` |
| Desktop ZIP verification | `scripts/verify-desktop-release.mjs` |
| Stamped component builds | `scripts/run-stamped-release.mjs` |
| Full production orchestration | `scripts/build-production.mjs` |
| Release path/lock/safety helpers | `scripts/build-utils.mjs` |
| Release-tooling regression tests | `scripts/verify-release-tooling.mjs` |
| Third-party notices/source | root notices plus `desktop/licenses/`, `desktop/third-party-sources/` |

---

## Production Release Checklist

Start from the full, unstripped repository and a clean committed checkout.

Run:

```sh
git status --porcelain
npm ci
npm run verify
npm run verify:dependencies
npm run release
git status --porcelain
```

`npm run release` already includes `verify` and `verify:dependencies`; running them separately first is useful as an explicit qualification checklist and makes failures easier to isolate.

Both Git-status checks should show no unexpected source changes.

Then inspect and smoke-test the generated `dist/`.

### PWA smoke test

Test the generated release rather than relying only on the dev server:

- New Game;
- Continue/save;
- keyboard controls;
- physical gamepad controls/remapping;
- fullscreen enter/exit;
- volume/options persistence;
- dark display mode;
- rumble enabled/disabled with physical hardware;
- focus/tab-hide/resume;
- online reload;
- offline reload after installation;
- service-worker upgrade;
- side-by-side/non-root deployment if deployment logic changed.

### Desktop smoke test

Extract and run the **generated desktop ZIP**, not loose development classes.

Test every OS/JVM combination you intend to advertise:

- startup;
- keyboard input;
- physical controller input;
- audio;
- representative gameplay;
- launcher scripts;
- native library discovery.

The ZIP includes launchers for Windows, Linux, and macOS, but treat a platform as supported only after smoke-testing the exact final ZIP on that platform.

### Deployment rule

Deploy the generated `dist/` only after release qualification and artifact smoke testing pass.

Do not rebuild different bytes between acceptance and deployment.

---

## Troubleshooting

### `build:desktop` reports a missing runtime JAR/native/source file

Stripped review archives may omit large runtime files.

In the full repository, check `desktop/RUNTIME_DEPENDENCIES.md` and the expected runtime/source material. Do not weaken the package verifier merely to make an intentionally stripped archive behave like the full distribution repository.

### Production build says the checkout is dirty

Run:

```sh
git status --porcelain
```

Resolve the source difference before producing a public release.

### Release succeeds until candidate verification, then `dist/` remains unchanged

That is expected safety behavior. The candidate must pass all checks before promotion can replace the previous canonical release.

Fix the underlying build/verification issue and rerun the normal release path.

### A release operation was killed during promotion

Run the normal recovery-aware production path again before manually deleting any pending/previous/journal state.

The release system is designed to recover interrupted promotion.

### PWA works at one path but not another

Look for hard-coded deployment paths in:

- resource URLs;
- service-worker code;
- Vite output assumptions;
- browser storage keys;
- generated page links.

Run the stamped PWA release test, which exercises multiple deployment roots.

### Continue disappears after moving the deployment

Browser persistent state is path-scoped. Moving to a different deployment directory intentionally creates a different storage namespace.

### A future-version save does not enable Continue

That is intentional. Older code preserves a future-version save rather than attempting to deserialize or delete data it does not understand.

### Rumble continues after suspension/disable

Treat that as a bug in the browser haptic lifecycle. `RumbleManager` is designed to cancel sequences and silence connected gamepads when disabled or suspended.

---

## Design Principles

The repository’s structure and release machinery enforce a small set of rules:

1. **Keep the TypeScript gameplay port comparable with the preserved Java implementation.**
2. **Put browser-only concerns around the gameplay port, not into it unnecessarily.**
3. **Treat saved state as a versioned compatibility contract.**
4. **Use stable serialized game-object IDs instead of runtime/minified constructor identity.**
5. **Keep browser rumble optional, isolated, and lifecycle-aware.**
6. **Side-by-side PWA deployments must not share cache or storage namespaces.**
7. **Component output is not production output.**
8. **Build and verify a candidate before replacing `dist/`.**
9. **A build must not silently change tracked source while producing a release.**
10. **A failed/interrupted promotion should preserve a complete usable release.**
11. **Parallel/nested release operations must not race.**
12. **Release verification should inspect generated artifacts, including desktop ZIP contents and runtime/source hashes.**
13. **Legacy desktop dependencies should be changed deliberately, with documentation/license/source packaging updated at the same time.**

If a proposed shortcut violates one of these rules, understand why the guardrail exists before removing it.

---

## License and Third-Party Material

Project code is licensed under GPL-3.0-or-later unless a file says otherwise.

See:

- `LICENSE` for the project license;
- `THIRD_PARTY_NOTICES.md` for root notices;
- browser-distributed notices/resources under `pwa/`;
- `desktop/licenses/` for desktop dependency licenses/notices;
- `desktop/third-party-sources/` for redistributed corresponding/source material;
- `desktop/RUNTIME_DEPENDENCIES.md` for the preserved desktop runtime set.

When changing a distributed third-party dependency, treat runtime files, launchers, hashes, licenses, notices, and corresponding-source material as one coordinated change.
