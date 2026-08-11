# Stickvania PWA Parity Deviations

This file records intentional differences between the original Java Stickvania game and the browser PWA port. The TypeScript game remains a 1-to-1 class/function port where possible; entries here are the approved places where the PWA deliberately breaks Java parity.

## PWA-001: Browser Launch Menu

Java Behavior:

- The Slick2D application starts directly in the game loading/title flow.

PWA Behavior:

- `pwa/src/main.ts` presents a browser menu before the Slick2D game starts.
- The menu has `New Game`, `Continue`, and an audio volume slider.
- The initial user click unlocks Web Audio before gameplay starts.

Reason:

- Browser audio APIs require a user activation before playback can reliably begin.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`

Gameplay/Parity Risk:

- None inside the Java game loop after the user starts the game.

## PWA-002: Volume Setting

Java Behavior:

- Audio volume is controlled by the desktop runtime/device.

PWA Behavior:

- The PWA menu has a volume slider.
- Default volume is 10 percent.
- The setting is saved in `localStorage` under `stickvania-volume`.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`

Gameplay/Parity Risk:

- Audio loudness differs from Java by design.

## PWA-003: PWA Versioning And Cache Busting

Java Behavior:

- Desktop Java resources are loaded from the local packaged/runtime filesystem with no browser cache.

PWA Behavior:

- `pwa/index.html` contains an app version placeholder.
- `pwa/vite.config.ts` replaces app version/build stamp placeholders.
- `pwa/src/main.ts` calls `ResourceLoader.setCacheBust(__BUILD_STAMP__)`.
- The service worker is registered as `sw.js?v=${__APP_VERSION__}-${__BUILD_STAMP__}`.
- `pwa/public/sw.js` names caches using the service-worker version query value.

Reason:

- Browser deployments need explicit cache invalidation.

Affected Files:

- `pwa/index.html`
- `pwa/vite.config.ts`
- `pwa/src/main.ts`
- `pwa/public/sw.js`

Gameplay/Parity Risk:

- None, except stale browser caches should be less likely.

## PWA-004: Resource Preload, Retry, And Loading Countdown

Java Behavior:

- Slick2D resource construction happens inside the Java app flow.

PWA Behavior:

- `pwa/src/main.ts` preloads declared resources with retry options before entering the game.
- Resource URLs use the current build stamp as a cache-busting query.
- If resource preload fails, the page shows a user-facing load error.
- The in-game loading countdown is preserved the first time Slick resources are initialized.
- If Slick resources already loaded successfully in the page session, New Game or Continue can skip the countdown.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- The countdown can be skipped after successful resource initialization in a page session. The game resources and game state are unchanged.

## PWA-005: Hamburger Menu

Java Behavior:

- There is no browser menu overlay.

PWA Behavior:

- The PWA presents a hamburger button over the game.
- Pressing it returns to the PWA menu.
- Sound is stopped/suspended when returning to the menu.
- The button is hidden during the initial resource loading countdown.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`

Gameplay/Parity Risk:

- Returning to the menu is a browser-only interruption path.

## PWA-006: Browser Focus Suspension

Java Behavior:

- Losing OS/window focus is handled by the desktop runtime.

PWA Behavior:

- The page listens for `blur`, `focus`, `pagehide`, `pageshow`, and `visibilitychange`.
- On focus loss/page hide, the current game is suspended and sound effects are stopped.
- On focus regain/page show, the game resumes with input pressed records cleared.
- Save-ready game state is captured before suspension/page hide.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- The browser can pause/suspend the game at points Java would not. This is intentional for tab/window safety.

## PWA-007: Exact Resume From Local Storage

Java Behavior:

- The desktop game does not serialize exact game state to browser storage.

PWA Behavior:

- Save-ready game state is serialized to `localStorage`.
- Continue resumes from the saved stage, entities, stacks, random state, audio state, and captured `Main` fields.
- The current difficulty value is captured as part of the exact game-state snapshot.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/stickvania/persistence/GameStateSnapshot.ts`
- `pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts`
- `pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts`

Gameplay/Parity Risk:

- Resume is a browser-only feature. Snapshot bugs can create non-Java states, so persistence changes must be tested carefully.

## PWA-008: Browser Scaling

Java Behavior:

- The Java game uses the Slick2D desktop display/window model.

PWA Behavior:

- The browser game scales to the available content/fullscreen area while preserving the internal game aspect ratio.
- Black bars are used as needed.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`
- `pwa/src/stickvania/ScalableGame2.ts`

Gameplay/Parity Risk:

- Rendered pixel size differs from Java, but internal game coordinates remain 640x480.

## PWA-009: Mouse Auto-Hide

Java Behavior:

- Desktop cursor behavior is handled through Slick/LWJGL cursor APIs.

PWA Behavior:

- The browser cursor is hidden over the game after inactivity.
- The cursor is shown when the PWA menu is active or browser focus/menu interaction resumes.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`
- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- Cursor visibility differs by design.

## PWA-010: Title Screen Menu

Java Behavior:

- The title screen presents the original input text and starts the game from the original title flow.

PWA Behavior:

- The title screen menu is now:
  - `START`
  - `OPTIONS`
- The options menu is:
  - `INPUT`
  - `DIFFICULTY`
  - `DONE`
- The difficulty menu is:
  - `NORMAL`
  - `HARD`
- The input menu shows current keyboard/gamepad mappings and offers:
  - `CHANGE`
  - `DONE`
- The title demo timeout runs only from the main title menu.

Affected Files:

- `pwa/src/stickvania/Main.ts`
- `pwa/src/stickvania/InputConfigMode.ts`
- `pwa/src/stickvania/ButtonMapping.ts`
- `pwa/src/stickvania/StickvaniaInput.ts`

Gameplay/Parity Risk:

- Title/menu behavior differs from Java. Demo playback itself remains the current NORMAL behavior once started.

## PWA-011: Remappable Keyboard And Gamepad Input

Java Behavior:

- The original Java controls are fixed around keyboard input.

PWA Behavior:

- Keyboard defaults are `Z` for attack, `X` for jump, and arrow keys for movement.
- Gamepad defaults are `GP-X` for attack, `GP-A` for jump, and logical d-pad/stick directions.
- `Space` is reserved for fullscreen toggle and cannot be mapped.
- `Escape` is reserved for fullscreen exit and cannot be mapped.
- Input mapping is saved in `localStorage` under `stickvania.input-mapping`.
- Mapping schema version is `5`; older development schemas are intentionally ignored.
- Gamepad mapping uses an "any controller" model. It does not store browser gamepad device IDs.
- Remapping uses a draft. Old saved bindings do not block new choices, duplicate controls picked earlier in the same remap pass still show `ALREADY USED`, and the draft is committed only after all actions are collected.

Affected Files:

- `pwa/src/stickvania/ButtonMapping.ts`
- `pwa/src/stickvania/InputConfigMode.ts`
- `pwa/src/stickvania/StickvaniaInput.ts`
- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- Browser input behavior differs from Java. The in-game action interpretation remains Castlevania-like: attack plus up triggers subweapon; attack without up triggers whip.

## PWA-012: Player-Controlled Physics

Java Behavior:

- Simon uses Java gravity and jump velocity during all contexts:
  - `Main.GRAVITY = 0.21`
  - `Main.SIMON_JUMP_VELOCITY = -5.25`

PWA Behavior:

- During live user-controlled gameplay only, Simon uses:
  - `Main.PLAYER_CONTROLLED_GRAVITY = 0.130027228`
  - `Main.PLAYER_CONTROLLED_JUMP_VELOCITY = -4.262100987`
- Demo, credits, ending, cutscene, and game-controlled states use the original Java values.
- Dog, WhiteSkeleton, enemies, items, and non-Simon objects continue using original gravity unless their own class logic says otherwise.

Affected Files:

- `pwa/src/stickvania/Main.ts`
- `pwa/src/stickvania/Simon.ts`
- `pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts`

Gameplay/Parity Risk:

- Player jump arc differs from Java during live user control. This is an intentional PWA gameplay adjustment.

## PWA-013: Difficulty Modes

Java Behavior:

- Java has one behavior profile.

PWA Behavior:

- The PWA has `NORMAL` and `HARD`.
- `NORMAL` is the accepted PWA baseline, not strict Java parity because other PWA deviations already exist.
- `HARD` is documented in `DIFFICULTY_MODES.md`.

Affected Files:

- `pwa/src/stickvania/Main.ts`
- `pwa/src/stickvania/AxeKnight.ts`
- `pwa/src/stickvania/BatSpawner.ts`
- `pwa/src/stickvania/BirdSpawner.ts`
- `pwa/src/stickvania/BoneDragon.ts`
- `pwa/src/stickvania/BonePillar.ts`
- `pwa/src/stickvania/Ghost.ts`
- `pwa/src/stickvania/LanceKnight.ts`
- `pwa/src/stickvania/MedusaHeadSpawner.ts`
- `pwa/src/stickvania/Merman.ts`
- `pwa/src/stickvania/MermanSpawner.ts`
- `pwa/src/stickvania/WhiteSkeleton.ts`
- `pwa/src/stickvania/ZombieSpawner.ts`

Gameplay/Parity Risk:

- HARD intentionally diverges from Java and NORMAL.
