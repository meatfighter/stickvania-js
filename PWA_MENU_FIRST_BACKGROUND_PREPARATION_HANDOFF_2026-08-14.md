# PWA Menu-First Background Preparation Handoff

Date: 2026-08-14

Audience: AIs implementing the same startup improvement in:

- `C:\js-projects\ms-pac-man-2010-js`
- `C:\js-projects\jackal-js`

Reference implementation:

- `C:\js-projects\stickvania-js\pwa\src\main.ts`
- `C:\js-projects\stickvania-js\pwa\src\stickvania\Main.ts`
- `C:\js-projects\stickvania-js\pwa\src\stickvania\Thing.ts`
- `C:\js-projects\stickvania-js\PWA_PARITY_DEVIATIONS.md`

## Goal

Make the browser PWA shell show its menu immediately. Resource fetching and audio decoding should happen in the background after the menu paints. If the user presses `New Game` or `Continue` before preparation finishes, show the existing PWA loader/progress UI. If preparation already finished, enter the game without showing the PWA loader and without showing the Java-style internal loading countdown.

This is an intentional PWA behavior improvement, not strict Java parity.

## Slick2D-ts APIs Used

This handoff assumes the dependent projects are using a `slick2d-ts` build that includes these browser/PWA helper APIs:

- `SoundStore.get().unlock()`
- `SoundStore.get().preloadAudioBuffers(refs, onProgress?)`
- `SoundStore.get().stopAllPlayback()`
- `AL.destroyPreservingAudioCache()`
- `AppGameContainer.setPreserveAudioCacheOnDestroy(true)`
- `AppGameContainer.setLoopSuspended(true | false)`

The important behavioral contract:

- `preloadAudioBuffers()` fetches and decodes `.ogg` files early, without playback.
- Browser playback still requires a user gesture, so `unlock()` must be called synchronously from the `New Game`/`Continue` click path before awaiting unrelated work.
- Destroying the PWA game container should preserve decoded audio buffers. Otherwise returning to the menu and starting again wastes the audio warmup.

## What Changed In Stickvania

### 1. Initial PWA boot became menu-first

Before:

- The PWA startup path showed a loader immediately.
- It preloaded all resources before showing the PWA menu.
- The game still had an internal loading countdown on first entry.

After:

- `startPwaMenu()` applies saved volume, renders the PWA menu immediately, registers the service worker asynchronously, and schedules background preparation.
- The game module and resource manifest are no longer imported at top level.
- The first visible UI is the PWA menu unless the `testScreen` query parameter requests a test loading/error screen.

### 2. Heavy modules are dynamically imported during preparation

Stickvania removed static top-level imports for:

- `Main`
- `ScalableGame2`
- `StickvaniaGameStateStore`
- the full `slick2d-ts` barrel
- `STICKVANIA_RESOURCE_REFS`

Stickvania keeps only lightweight static imports needed before user click:

- `SoundStore` from `slick2d-ts/slick/openal/SoundStore`
- `ResourceLoader` from `slick2d-ts/slick/util/ResourceLoader`
- type-only imports for game/container/store types

This prevents the menu bundle path from evaluating the entire Java-port module graph.

### 3. Preparation is a singleton with progress and retry state

Stickvania added a prepared-runtime state:

- `preparedRuntime`
- `preparationPromise`
- `preparationError`
- `preparationProgress`
- `backgroundPreparationScheduled`

The logic is:

- If already prepared, reuse it.
- If preparation is in flight, share the same promise.
- If preparation failed, `Start`/`Continue` can force a retry.
- If a PWA progress UI is currently visible, background progress updates it.
- If only the menu is visible, progress updates are silent.

### 4. Preparation starts after the menu has painted

Stickvania schedules background work with:

- `requestAnimationFrame(...)`
- then `window.setTimeout(..., 0)`

This gives the browser a chance to paint the menu before fetch/decode work begins.

### 5. Resource preparation is split by media type

Stickvania splits the manifest into:

- non-audio refs: loaded through `ResourceLoader.preloadResources(...)`
- audio refs ending in `.ogg`: decoded through `SoundStore.get().preloadAudioBuffers(...)`

Progress is combined as:

- total units = non-audio count + audio count
- loaded units = loaded non-audio + decoded audio

This is count-based, not byte-accurate. It is good enough for fallback UI and avoids building a custom byte progress system.

### 6. Start/Continue unlocks audio immediately

Stickvania's `startGame(restoreSavedGame)` begins with:

- `const audioUnlockPromise = unlockAudio();`

Then it awaits preparation.

This ordering matters. The browser user activation is tied to the click event. Calling `SoundStore.get().unlock()` before unrelated awaits gives the best chance of a successful Web Audio resume.

### 7. The PWA loader appears only if the user clicks early

If `preparedRuntime === null` when `startGame()` runs:

- `showBoot(preparationProgress)` replaces the menu with the existing PWA progress bar.
- Preparation continues or retries.
- On success, the game launches.

If preparation has already completed while the user waited on the PWA menu:

- no progress bar is shown.
- game launch proceeds directly.

### 8. The game container starts suspended

Stickvania sets:

- `appContainer.setPreserveAudioCacheOnDestroy(true)`
- `appContainer.setLoopSuspended(true)`

Then:

- `await appContainer.start()`
- call the PWA loading-complete hook
- `await ResourceLoader.waitForAll()`
- install the runtime error handler
- start resizing/cursor/hamburger helpers
- apply volume
- focus canvas
- resume the game loop only if the page is not focus/visibility suspended

The suspended start prevents an accidental visible/loading frame from leaking before the PWA has moved the game out of loading mode.

### 9. Stickvania added a PWA-only loading-complete hook

Stickvania added `Main.completePwaLoadingImmediately(gc)`.

It differs from the existing Java-style `completeLoadingImmediately(gc)`:

- It queues audio wrapper construction.
- It runs `loadingCompleteHandler` if present, which is how `Continue` restore takes over.
- If no restore handler takes over, it calls `initTitleScreen()` directly.
- It does not start the Java fade-out reason that would normally move from loading countdown to title.

This avoids showing the Java loading countdown/fade path in the PWA.

### 10. Destroying the menu/game path preserves warmed audio

Stickvania changed the no-container destroy path from plain `AL.destroy()` to:

- `SoundStore.get().stopAllPlayback()`

When a container exists, it relies on:

- `appContainer.setPreserveAudioCacheOnDestroy(true)`

Without this, returning to the PWA menu and starting again can clear decoded buffers, defeating background audio warmup.

### 11. Continue enablement uses a lightweight localStorage probe

The PWA menu no longer constructs the full serializer-backed game-state store just to enable/disable `Continue`.

Stickvania checks localStorage directly:

- storage key: `stickvania.game-state`
- snapshot version: `1`

The full `StickvaniaGameStateStore` is created lazily only after game runtime modules are prepared and a real save/restore operation is needed.

This prevents the serializer and much of the game graph from being pulled into the menu startup path.

### 12. A circular import was exposed and fixed

After dynamic importing the game graph during background preparation, Vite dev exposed:

```text
ReferenceError: Cannot access 'Thing' before initialization
    at Axe.ts:75:26
```

Root cause:

- `Thing.ts` had conversion-noise imports for many subclasses, including `Axe.ts`.
- `Axe.ts` extends `Thing`.
- That created a runtime cycle: `Thing -> Axe -> Thing`.

Fix:

- Remove unused subclass imports from `Thing.ts`.
- Change `Main` import in `Thing.ts` to type-only.
- Duplicate only the small primitive constants `DEFAULT_GRAVITY = 0.21`, `WALL_EMPTY = 0`, and `WALL_PLATFORM = 1` locally so `Thing.ts` has no runtime dependency on `Main`.

This is worth checking in other mechanically converted projects. Large converted base classes often have unused imports back to subclasses.

## Applicability To Ms. Pac-Man 2010

Project path:

- `C:\js-projects\ms-pac-man-2010-js`

Primary file to change:

- `pwa/src/app/main.ts`

Relevant current behavior observed:

- The PWA already renders the menu immediately at module load.
- `startGame()` currently performs runtime configuration, audio unlock, resource preload, game host render, and mount after the user clicks.
- `preloadResources(...)` sequentially calls `ResourceLoader.loadResource(ref)` for every `RESOURCE_REFS` entry.
- `mountGame(...)` dynamically imports `Main` and `ScalableGame2`.
- `runtimeResourcesLoaded` controls whether the PWA resource loader appears.
- `runtimeGameLoadingCompleted` controls whether `mainGame.completeLoadingImmediately(appContainer)` is called.
- `MsPacManGameStateStore` is statically imported by the PWA shell.

Recommended adaptation:

1. Keep the current immediate menu render.
2. Add the same prepared-runtime singleton state used in Stickvania.
3. Schedule background preparation after `renderMenu()` paints.
4. Move resource preloading out of `startGame()` and into background preparation.
5. Split `RESOURCE_REFS` into audio and non-audio:
   - `.ogg` through `SoundStore.get().preloadAudioBuffers(...)`
   - everything else through `ResourceLoader.preloadResources(...)`
6. Keep `ResourceLoader.setCacheBust(CACHE_BUST)` and retry options in the preparation path.
7. Change `startGame()` so it calls `SoundStore.get().unlock()` immediately from the click path before awaiting `ensureRuntimePrepared(...)`.
8. Show `renderBoot(preparationProgress)` only if the user clicked before preparation finished.
9. Set `AppGameContainer.setPreserveAudioCacheOnDestroy(true)` before starting the container.
10. Start the container suspended with `setLoopSuspended(true)`.
11. After `container.start()`, call `mainGame.completeLoadingImmediately(appContainer)`, then `await ResourceLoader.waitForAll()`, then resume the loop.
12. Consider lazily constructing `MsPacManGameStateStore` and replacing menu `Continue` enablement with a lightweight localStorage probe:
    - key: `ms-pac-man-2010.game-state`
    - snapshot version: `1`

Ms. Pac-Man likely does not need a new `completePwaLoadingImmediately(...)` method unless the current `completeLoadingImmediately(...)` has visible fade/countdown side effects. The current `LoadingMode.completeImmediately(gc)` loops through the loading steps and calls the normal loading-complete path, so it may already be adequate when the container is suspended.

Important Ms. Pac-Man checks:

- Confirm no internal loading frame appears on a slow or fast machine.
- Confirm high-score/network behavior in `LoadingMode` remains acceptable. Its `completeImmediately(gc)` path runs `runStep(gc, false)`, so it intentionally does not block on score loading.
- Confirm `Continue` restore still works when loading completion is forced immediately.
- Confirm the first music playback starts after `SoundStore.unlock()`.
- Confirm returning to the PWA menu and starting again does not re-decode all audio.
- Confirm the full serializer store can be lazy-loaded without disabling valid existing saves.

Potential Ms. Pac-Man concern:

- `MsPacManGameStateStore` imports its serializer at runtime. The serializer mostly uses type-only game imports, but it is still unnecessary menu-start work. Lazy construction is cleaner and matches Stickvania.

## Applicability To Jackal

Project path:

- `C:\js-projects\jackal-js`

Primary file to change:

- `src/app/JackalWebApp.ts`

Relevant current behavior observed:

- `JackalWebApp.ts` statically imports `slick2d-ts`, `Main`, `JackalGameStateStore`, `JackalInputMappingStore`, and `RESOURCE_MANIFEST`.
- `showMenu()` renders the PWA menu, but the heavy game graph has already been evaluated because of the static imports.
- `startGame()` renders loading, unlocks audio, configures resources, preloads all manifest entries through `ResourceLoader.preloadResources(...)`, then creates `Main` and the container.
- `Main.completeLoadingImmediately(gc)` exists and loops `loadNext()` until `loadIndex >= 42`.
- `destroyGame()` calls `container.destroy()` or `AL.destroy()`, which can clear warmed audio unless preservation is added.

Recommended adaptation:

1. Convert top-level imports in `JackalWebApp.ts`:
   - keep only lightweight/static browser shell imports
   - import `SoundStore` and `ResourceLoader` directly or keep the full Slick import only if it does not materially delay menu paint
   - move `Main`, `ScalableGame`, `AppGameContainer`, `Display`, `JackalGameStateStore`, and `RESOURCE_MANIFEST` into a prepared-runtime dynamic import path
2. Remove runtime dependency on `Main.DISPLAY_WIDTH` and `Main.DISPLAY_HEIGHT` from menu-time helpers:
   - use local constants copied from Java/Jackal constants, or
   - read them only after runtime preparation
3. Add prepared-runtime state:
   - `preparedRuntime`
   - `preparationPromise`
   - `preparationError`
   - `preparationProgress`
   - `backgroundPreparationScheduled`
4. In `showMenu()`, render the menu first, then schedule background preparation after first paint.
5. Move `configureResourceLoader()` into the preparation path before any resource fetch:
   - keep `ResourceLoader.removeAllResourceLocations()`
   - keep `ResourceLoader.addResourceLocation("/resources/")`
   - keep build-stamp cache busting
   - keep retry options
6. Split `RESOURCE_MANIFEST`:
   - `.ogg` refs through `SoundStore.get().preloadAudioBuffers(...)`
   - non-audio refs through `ResourceLoader.preloadResources(...)`
7. Change `startGame()` so it calls `SoundStore.get().unlock()` immediately from the click handler path, before awaiting preparation.
8. If the user clicks before preparation completes, show the existing Jackal progress bar via `renderLoading(preparationProgress)`.
9. If preparation already completed, skip the PWA loader.
10. Create `Main` and `AppGameContainer` only after preparation.
11. Set `appContainer.setPreserveAudioCacheOnDestroy(true)`.
12. Start the container suspended with `appContainer.setLoopSuspended(true)`.
13. After `appContainer.start()`, call `mainGame.completeLoadingImmediately(appContainer)`, then `await ResourceLoader.waitForAll()`, then install runtime error handlers and resume the loop.
14. Change the no-container destroy path from `AL.destroy()` to a cache-preserving/stop-playback path:
    - preferred: `SoundStore.get().stopAllPlayback()`
    - or, if the app has already initialized AL and needs state reset while keeping cache: `AL.destroyPreservingAudioCache()`
15. Consider lazy construction of `JackalGameStateStore` and direct localStorage probing for `Continue`:
    - key: `jackal.game-state`
    - snapshot version: `2`
16. `JackalInputMappingStore` may remain static if it only imports `ButtonMapping` and does not pull `Main`; verify before changing. It is not the main startup cost compared with `Main`.

Jackal may still have visible or noticeable CPU work at click time because `Main.completeLoadingImmediately(gc)` runs `loadNext()` steps synchronously. Background resource fetch and audio decode remove network/audio wait, but image/sprite/stage object construction may still occur during launch. If that is too noticeable, Jackal may need a second phase:

- a PWA-specific "prepare Java runtime objects while menu is visible" path, if those objects can be safely constructed without a WebGL canvas/container, or
- a chunked/suspended launch path that does the CPU-only `loadNext()` work behind the PWA progress UI.

Do not assume this is needed. Measure first.

Important Jackal checks:

- Confirm the menu appears before `Main.ts` is evaluated.
- Confirm `New Game` clicked immediately shows progress.
- Confirm waiting on the PWA menu avoids the progress screen.
- Confirm `Continue` restore still works after immediate `completeLoadingImmediately(...)`.
- Confirm input mappings still restore before gameplay/title input is read.
- Confirm no audio re-decode occurs after returning to the PWA menu and starting again.
- Confirm no `Cannot access ... before initialization` module-cycle errors appear in Vite dev.

Potential Jackal concern:

- Because `JackalWebApp.ts` currently imports `Main` at top level, helper functions such as aspect-ratio sizing use `Main.DISPLAY_WIDTH` and `Main.DISPLAY_HEIGHT`. Those references must be replaced before the game graph can be genuinely lazy.

## Common Implementation Pattern

Use this shape, adjusted to each project's names:

1. Render the PWA menu immediately.
2. Schedule background preparation after first paint.
3. Preparation:
   - configure `ResourceLoader`
   - dynamically import the game/runtime/store/manifest modules
   - preload non-audio resources
   - decode audio resources
   - save prepared constructors/modules
4. Start click:
   - call `SoundStore.get().unlock()` immediately
   - clear saved state for New Game
   - resume live overlay game if applicable
   - otherwise show fallback loader only if preparation is incomplete
   - await preparation
   - create game/container
   - preserve audio cache on destroy
   - start suspended
   - force internal loading completion
   - wait for tracked resources
   - start browser helpers
   - resume loop if focus/visibility permits
5. Destroy/menu return:
   - stop playback
   - do not clear decoded audio buffers
   - do not leave a running RAF loop under the menu

## Cache And Dev-Server Note

After changing lazy imports or fixing module cycles, browser dev sessions may continue to show old stack traces if they are using stale transformed modules.

Tell testers to:

1. Stop the Vite dev server.
2. Restart it.
3. Unregister any local service worker for the project origin.
4. Hard reload the browser.

For Vite dev, a useful smoke test is to create a Vite server in middleware mode and run `server.ssrLoadModule(...)` against the game `Main.ts`. Stickvania used this to confirm the module graph loaded after the `Thing` import-cycle fix.

## Validation Checklist

Run normal project validation:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- project-specific PWA build command

Browser checks:

- cold load shows PWA menu immediately
- immediate `New Game` shows PWA progress fallback
- waiting on menu avoids progress fallback
- immediate `Continue` shows fallback only if preparation is unfinished
- waiting on menu lets `Continue` enter directly
- first sound/music plays after Start/Continue
- hamburger/live menu still suspends game loop/audio
- returning to PWA menu and starting again does not redo audio decode
- localStorage saves still enable/disable `Continue` correctly
- invalid saves are cleared
- no internal loading countdown/frame is visible
- loading failure still shows user-facing error with Retry

## Documentation To Update In Each Project

Add or update each project's PWA parity/deviation document with:

- menu-first startup
- background resource preparation
- audio decode warmup
- user-click audio unlock ordering
- PWA loader only as early-click fallback
- internal Java loading countdown skipped or forced-completed
- audio cache preservation across menu/game restarts
- any remaining CPU work that still happens at launch

