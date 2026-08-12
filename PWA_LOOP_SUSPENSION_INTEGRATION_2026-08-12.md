# Stickvania PWA Loop Suspension Integration

Date: 2026-08-12

## Verdict

Yes. `C:\js-projects\stickvania-js` should integrate the new `slick2d-ts` browser loop suspension feature.

This is a PWA/browser lifecycle improvement, not a Java gameplay parity change. Stickvania already has browser lifecycle suspension in its PWA shell and a `Main.browserSuspended` flag that stops game update/timing and audio. The remaining issue is that `AppGameContainer` can continue running its RAF-backed loop and renderer path while the game is browser-suspended, especially when focus is lost but the document is still visible.

## Relevant Engine Feature

The shared `slick2d-ts` dependency now exposes these `AppGameContainer` methods:

```ts
setLoopSuspended(suspended: boolean): void;
isLoopSuspended(): boolean;
suspendLoop(): void;
resumeLoop(): void;
```

Confirmed in this project through the local dependency junction:

- `C:\js-projects\stickvania-js\package.json` depends on `slick2d-ts` as `file:../slick2d-ts`.
- `C:\js-projects\stickvania-js\node_modules\slick2d-ts` is a junction to `C:\js-projects\slick2d-ts`.
- `node_modules\slick2d-ts\dist\slick\AppGameContainer.d.ts` contains `setLoopSuspended`, `isLoopSuspended`, `suspendLoop`, and `resumeLoop`.

The engine semantics are appropriate for a PWA lifecycle wrapper:

- `setLoopSuspended(true)` cancels any scheduled RAF and clears stored delta.
- While suspended, the container RAF callback returns before `loopFrame`.
- `loopFrame` also checks suspension after update before render.
- `setLoopSuspended(false)` resets frame timing and schedules one new RAF.
- It does not change Java Slick2D pause semantics, game pause state, fullscreen state, resource state, textures, audio buffers, or `alwaysRender`.

## Current Stickvania Behavior

Project shell:

- `pwa/src/main.ts:1-7` imports `AppGameContainer` directly from `slick2d-ts`.
- `pwa/src/main.ts:27` stores the active container as `AppGameContainer | null`.
- `pwa/src/main.ts:193-199` constructs the container, stores it in `container`, stores the game in `game`, and passes browser/display hooks into `Main`.
- `pwa/src/main.ts:223` calls `appContainer.setAlwaysRender(true)`.
- `pwa/src/main.ts:248-255` returns to the PWA menu by browser-suspending the game, saving state, then calling `showMenu()`.
- `pwa/src/main.ts:275-331` tracks focus/visibility lifecycle state and calls `game.setBrowserSuspended(...)` from `applyCurrentGameLifecycleSuspension()` and `suspendCurrentGameForLifecycle()`.
- `pwa/src/main.ts:616-625` wires `pagehide`, `pageshow`, `blur`, `focus`, and `visibilitychange` handlers.
- `pwa/src/main.ts:380-407` runs a separate hamburger visibility RAF only while the hamburger is hidden because the game is still loading.

Game class:

- `pwa/src/stickvania/Main.ts:1047-1052` returns early from `update(...)` while `browserSuspended` is true and resets `nextFrameTime` to `Sys.getTime()`.
- `pwa/src/stickvania/Main.ts:2748-2764` toggles `browserSuspended`, stops sound effects, disables container music while suspended, restores music on resume, clears input pressed records, and resets timing.
- `pwa/src/stickvania/Main.ts:4204-4285` renders according to the current mode. It does not need a browser-suspended render guard; the PWA shell should stop the container loop instead of adding browser conditionals to Java-parity game classes.

Loading/resource behavior:

- `pwa/src/main.ts:181-185` determines whether the visible internal loading screen should be shown based on `runtimeResourcesLoaded`.
- `pwa/src/main.ts:229-237` starts the container, optionally completes internal loading immediately when resources were already loaded, then starts responsive sizing, cursor auto-hide, and hamburger monitoring.
- `pwa/src/main.ts:599-605` applies cache busting, retry options, queues resource loads, and waits for all resources.
- `pwa/src/main.ts:314-316` already avoids lifecycle suspension while the internal loading screen is active.
- `pwa/src/stickvania/Main.ts:2861-2871` exposes `isLoadingScreenActive()` and `completeLoadingImmediately(gc)`.

## Why This Project Benefits

The existing `browserSuspended` game flag is necessary but not sufficient.

When focus is lost while the document is still visible, `document.visibilityState` remains `visible`. In that case, the engine's hidden-tab guard does not apply. Since the shell has set `alwaysRender` to true, `AppGameContainer.loopFrame(...)` can still render even when the browser window is not focused.

When the tab is actually hidden, the engine's `updateOnlyWhenVisible` path avoids update/render work, but it still schedules follow-up RAF callbacks. Browsers usually throttle hidden RAFs, but the scheduling source is not intentionally stopped.

Using `container.setLoopSuspended(true)` during lifecycle suspension closes both gaps:

- No new RAF is scheduled while suspended.
- No input polling happens while suspended.
- No music or sound polling happens while suspended.
- No `game.update(...)` call happens while suspended.
- No `game.render(...)` call happens while suspended.
- No clear/beginFrame/endFrame work reaches the renderer while suspended.
- No accumulated delta is delivered on resume.

A brace-level scan of `pwa/src/stickvania` found no confirmed render-time field mutation in methods whose names contain `render`. That means this project does not appear to have Jackal's exact rotor-style visible animation bug. The integration is still worthwhile because it stops unnecessary CPU/GPU/audio/input work in a desktop browser PWA.

## Required Implementation

Only edit the PWA shell unless testing reveals a separate game-specific issue. Do not edit Java-parity gameplay classes for this feature.

1. Update lifecycle suspend/resume paths in `pwa/src/main.ts`.

In `suspendCurrentGameForLifecycle()`:

- Keep the existing `game === null || game.isLoadingScreenActive()` guard.
- Keep `game.setBrowserSuspended(true)`.
- Add `container?.setLoopSuspended(true)` immediately after the game browser-suspended call.
- Keep `saveCurrentGameState()`.

In `applyCurrentGameLifecycleSuspension()`:

- Keep the `game === null` reset path.
- Keep the `game.isLoadingScreenActive()` exemption.
- In the active/resume branch, call `container?.setLoopSuspended(false)` together with `game.setBrowserSuspended(false)`.

If preferred for clarity, mirror Jackal's shell shape by adding a small `resumeCurrentGameForLifecycle()` helper that:

```ts
game.setBrowserSuspended(false);
container?.setLoopSuspended(false);
```

and then calling that helper from the non-suspended branch of `applyCurrentGameLifecycleSuspension()`.

2. Preserve loading-screen behavior.

Do not suspend the container while `game.isLoadingScreenActive()` is true. Stickvania intentionally supports skipping the visible resource-loading screen after resources are already loaded, and the hamburger icon remains hidden during active loading. Freezing the container during visible loading could prevent loading progress, completion, or error presentation from behaving naturally.

3. Do not connect this to normal gameplay/menu modes.

There is no separate ordinary in-game pause path in the same style as Ms. Pac-Man, but the rule is the same: this feature should be driven only by browser lifecycle state, not by Java-parity game mode decisions.

4. Destroy/menu path.

`showMenu()` already calls `destroyGame()` at `pwa/src/main.ts:109-110`, and `destroyGame()` destroys the container at `pwa/src/main.ts:338-354`. No separate loop-resume call is required before destruction. If a suspended container is destroyed, `AppGameContainer.destroy()` cancels scheduled frames and clears engine state.

5. Do not change `setAlwaysRender(true)`.

The PWA uses responsive sizing, fullscreen behavior, menu return affordances, and browser-hosted presentation. `alwaysRender` can remain true for active/focused play. The new lifecycle API is the explicit off switch when the app should be dormant.

## Verification Plan

Run after implementation:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:pwa
```

Manual browser checks:

- Start a new game, wait until the game is past visible loading, then Alt-Tab/click another desktop application while the browser remains visible.
- Confirm the game visually freezes while unfocused.
- Confirm CPU/GPU activity drops compared with the old always-render loop.
- Return focus to the browser and confirm gameplay resumes without a catch-up jump.
- Confirm music resumes and sound effects remain stopped according to existing `Main.setBrowserSuspended(...)` behavior.
- Confirm the visible loading screen still progresses on a fresh boot.
- Confirm the loading screen can still be skipped after resources have already loaded.
- Confirm the hamburger icon remains hidden during loading and appears after loading finishes.
- Confirm return-to-menu still saves/clears state according to the existing persistence rules.

## Concerns / Things Not To Change Casually

- This is not a Java Slick2D parity correction. It is a browser PWA lifecycle hook around the Java-parity game.
- Do not move update logic into render or render logic into update.
- Do not alter `Main.setBrowserSuspended(...)` unless a separate input/audio bug is confirmed.
- Do not remove `setAlwaysRender(true)` as a substitute. That would alter active-window rendering behavior and still would not intentionally cancel the RAF scheduling source.
- Keep the internal loading-mode exemption. Stickvania has intentional loading-screen skip behavior, and the hamburger monitor depends on the distinction between loading and active game modes.
