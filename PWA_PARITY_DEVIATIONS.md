# Stickvania PWA Parity Deviations

This file records intentional differences between the original Java Stickvania game and the browser PWA port. The TypeScript game remains a 1-to-1 class/function port where possible; entries here are the approved places where the PWA deliberately breaks Java parity.

Unless otherwise noted, "Java Behavior" means the original 2010 Java baseline. Some PWA-originated gameplay/menu features have also been mirrored into the updated Java desktop source; see `DESKTOP_JAVA_PWA_FEATURE_PORT.md`.

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

## PWA-004: Resource Preparation, Retry, And Loading Countdown Removal

Java Behavior:

- Slick2D resource construction happens inside the Java app flow.

PWA Behavior:

- `pwa/src/main.ts` renders the PWA menu first, then starts declared resource preparation in the background after the first menu paint.
- The full game module, scalable wrapper, save-state serializer/store, and resource manifest are dynamically imported during preparation instead of being part of the initial menu bundle path.
- Non-audio resources are preloaded through `ResourceLoader.preloadResources()`.
- Audio resources are preloaded and decoded through `SoundStore.preloadAudioBuffers()` so `Sound`/`Music` construction can reuse decoded Web Audio buffers.
- Start/Continue calls `SoundStore.unlock()` immediately from the user click before awaiting any unfinished background work.
- Resource URLs use the current build stamp as a cache-busting query.
- If the user clicks Start/Continue before background preparation has finished, the browser PWA loader is shown until preparation completes.
- If preparation fails, the page shows a user-facing load error with Retry.
- The Java in-game loading countdown is not displayed in the PWA once this background preparation path is active.
- The PWA calls `Main.completePwaLoadingImmediately()` after `AppGameContainer.start()` while the game loop is still suspended, so the first active game frame is title/restored gameplay rather than the Java countdown.
- Destroyed PWA containers preserve the warmed Web Audio cache so returning to the PWA menu does not force audio decode to repeat.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- Startup order differs from Java by design. The PWA prepares resources before the Java loading screen would normally count down, then skips that countdown entirely. Game resources, title state, and restored game state should be equivalent after loading completion.

## PWA-005: Hamburger Menu

Java Behavior:

- There is no browser menu overlay.

PWA Behavior:

- The PWA presents a hamburger button over the game.
- Pressing it during save-ready play opens the PWA menu as a live overlay over the still-mounted game.
- The game loop is suspended under the overlay.
- Active sound effects are stopped; music is suspended through the browser music-on path so it can resume without restarting.
- Pressing `Continue` from that live overlay resumes the same in-memory game instance.
- Pressing `New Game`, or returning to the menu from a non-live/non-save-ready state, still destroys the current runtime.
- The button is hidden while the PWA loader is visible or before a live game state exists.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`

Gameplay/Parity Risk:

- Returning to the menu is a browser-only interruption path. Same-page Continue can now resume live state without deserializing, while reload/cold-start Continue still uses the saved snapshot.

## PWA-006: Browser Focus Suspension

Java Behavior:

- Losing OS/window focus is handled by the desktop runtime.

PWA Behavior:

- The page listens for `blur`, `focus`, `pagehide`, `pageshow`, and `visibilitychange`.
- On focus loss/page hide, the current game is suspended and sound effects are stopped.
- On focus regain/page show, the game resumes with input pressed records cleared.
- Save-ready game state is captured before suspension/page hide.
- A live PWA menu overlay counts as a browser suspension reason, so focus/visibility events cannot resume gameplay behind the menu.

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
- If the PWA hamburger menu is open over a live suspended game, `Continue` resumes the live object graph instead of deserializing.
- A fresh serialized snapshot is still written before showing the live overlay, so browser reload while the overlay is open can fall back to local-storage Continue.
- The current difficulty value is captured as part of the exact game-state snapshot.
- Stored game state is cleared when the running game reaches title/main menu, title submenus, input configuration, or the game-over Continue/End menu.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/stickvania/Main.ts`
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
- The PWA opts into the `slick2d-ts` high-DPI canvas path with high-DPI enabled and device-pixel-ratio capped at `2`.
- Display sizes, input coordinates, and game logic remain in logical Slick/CSS pixels; only the canvas backing store is enlarged on high-DPI displays.

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
  - `RESET`
  - `DONE`
- `RESET` restores the default mapping, saves it to `localStorage`, and remains on the input menu.
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

- Default mapping:
  - `UP = UP, GP-UP`
  - `DOWN = DOWN, GP-DOWN`
  - `LEFT = LEFT, GP-LEFT`
  - `RIGHT = RIGHT, GP-RIGHT`
  - `JUMP = X, GP-A`
  - `ATTACK = Z, GP-X`
- `Space` is reserved for fullscreen toggle and cannot be mapped.
- `Escape` is reserved for fullscreen exit and cannot be mapped.
- Input mapping is saved in `localStorage` under `stickvania.input-mapping`.
- Mapping schema version is `5`; older development schemas are intentionally ignored.
- Gamepad mapping uses an "any controller" model. It does not store browser gamepad device IDs.
- The `GP-UP`, `GP-DOWN`, `GP-LEFT`, and `GP-RIGHT` direction mappings accept standard D-pad buttons, primary stick axes, POV-hat style axes, and common extra stick axes.
- Extra stick axes currently follow the same coverage used by `ms-pac-man-2010-js`: horizontal axes `2` and `6`, vertical axes `3` and `7`, with baseline/recenter handling.
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
- `pwa/src/stickvania/BridgeBat.ts`
- `pwa/src/stickvania/Ghost.ts`
- `pwa/src/stickvania/LanceKnight.ts`
- `pwa/src/stickvania/MedusaHeadSpawner.ts`
- `pwa/src/stickvania/Merman.ts`
- `pwa/src/stickvania/MermanSpawner.ts`
- `pwa/src/stickvania/Raven.ts`
- `pwa/src/stickvania/WhiteSkeleton.ts`
- `pwa/src/stickvania/ZombieSpawner.ts`

Gameplay/Parity Risk:

- HARD intentionally diverges from Java and NORMAL.
## PWA-014: Dark Display Mode

Java Behavior:

- The Java game renders with its original light display colors.

PWA Behavior:

- The PWA launch menu has a persisted `Display` switch with `Light` and `Dark` choices.
- `Dark` uses the `slick2d-ts` browser-only renderer inversion API for scene, title, menu, image, font, and solid primitive draws.
- The final fade overlay draws with inversion disabled so fades go to black.
- The setting is saved in `localStorage` under `stickvania-display-mode`.
- The display setting is a PWA preference, not saved game state; Continue always uses the current launch-menu preference.

Affected Files:

- `pwa/src/main.ts`
- `pwa/src/styles.css`
- `pwa/src/stickvania/Main.ts`
- `pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts`

Gameplay/Parity Risk:

- Display colors differ from Java by design. Renderer inversion is per draw call rather than a CSS postprocess, so untouched clear-only regions must be checked during browser validation.

## PWA-015: Up+Attack Subweapon Fallback

Java Behavior:

- Java uses separate `D` whip and `F` subweapon keys.
- Pressing the subweapon key attempts a subweapon only when a subweapon is equipped, the repeat limit is not reached, and Simon has enough hearts.
- A failed subweapon attempt does not automatically become a whip because whip and subweapon are separate inputs.

PWA Behavior:

- The PWA maps both whip and subweapon intent to one logical `ATTACK` button.
- During live user-controlled gameplay, `UP + ATTACK` attempts a subweapon only when it can actually be emitted.
- If no subweapon is equipped, the active subweapon count is at the repeat limit, or Simon lacks enough hearts, `UP + ATTACK` starts a normal whip instead.
- Demo, credits, ending, and recorded playback inputs keep the original Java behavior and do not use this fallback.
- Existing attack release and whip animation delay constraints still apply.

Affected Files:

- `pwa/src/stickvania/Main.ts`

Gameplay/Parity Risk:

- Live user input differs from Java by design to support the PWA's combined Castlevania-style attack/subweapon mapping.
