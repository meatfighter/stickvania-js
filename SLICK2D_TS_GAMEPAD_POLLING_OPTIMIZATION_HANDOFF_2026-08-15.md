# Slick2D-ts Gamepad Polling Optimization Handoff

Date: 2026-08-15

Dependent project: `C:\js-projects\stickvania-js`

Target project: `C:\js-projects\slick2d-ts`

## Purpose

Stickvania's PWA loop polls input during active gameplay at the Java-style fixed update cadence. The Stickvania-side input layer now avoids its own per-tick state object allocation, but the underlying `slick2d-ts` input implementation still performs repeated browser gamepad reads and small callback allocations during the same frame.

This handoff requests a narrow internal performance improvement in `slick2d-ts`. It is not a request for broad Slick2D API expansion.

## Scope

Only change `slick2d-ts` behavior that Stickvania actually uses:

- `Input.poll(...)`
- `Input.isButtonPressed(...)`
- `Input.isButtonDown(...)`
- `Input.getControllerCount()`
- `Input.getAxisCount(...)`
- `Input.getAxisValue(...)`
- `Input.isControllerUp(...)`
- `Input.isControllerDown(...)`
- `Input.isControllerLeft(...)`
- `Input.isControllerRight(...)`
- Internal controller listener polling/dispatch
- Internal POV-hat directional checks

Do not add unrelated Slick2D parity APIs.

## Current Hot-Path Concern

In `C:\js-projects\slick2d-ts\src\slick\Input.ts`, `getGamepads()` directly calls `navigator.getGamepads()`.

Current call sites include:

- `Input.isButtonPressed(...)` around line 412
- `Input.getControllerCount()` around line 446
- `Input.getAxisCount(...)` around line 460
- `Input.getAxisValue(...)` around line 465
- `Input.poll(...)` / `pollControllers()` around lines 555 and 737
- `Input.anyController(...)` around line 829

Stickvania's `StickvaniaInput.readStateInto(...)` calls several of these helpers while resolving keyboard/gamepad mappings. For one logical input sample, `slick2d-ts` can therefore call `navigator.getGamepads()` many times.

This is behaviorally correct, but wasteful. Browser gamepad state should be sampled once at the start of a Slick input poll and reused consistently for that input frame.

## Requested Fix

Add frame-scoped gamepad snapshot caching inside `Input`.

Preferred behavior:

- `Input.poll(...)` refreshes a cached gamepad snapshot once per poll before controller state is processed.
- All gamepad helper methods read from that cached snapshot during the frame.
- If a helper is called before the first `poll(...)`, it may lazily refresh once so pre-loop callers still behave sensibly.
- If controllers are disabled, helper methods should keep returning the same disabled-controller behavior they return today.
- The public Java-style API should remain unchanged.

The snapshot can remain browser-native, for example `Array<Gamepad | null>` / `Gamepad[]`, as long as it is not mutated by `slick2d-ts`.

Important: confirm current browser behavior around `navigator.getGamepads()`. Some browsers return an array-like object, not a normal mutable array. The current TypeScript signature is `Array<Gamepad | null>`, but the browser type is normally `Gamepad[]`. Keep typings clean.

## Suggested Implementation Shape

Add private fields to `Input`, conceptually:

- `cachedGamepads`
- `gamepadsCached`

Then split the current direct `getGamepads()` path into something like:

- `refreshGamepads()`: calls `navigator.getGamepads()` once and stores the result.
- `getFrameGamepads()`: returns the cached result, refreshing lazily if needed.

`poll(...)` should refresh before `pollControllers()`.

`pollControllers()` should use the already refreshed snapshot rather than calling `navigator.getGamepads()` again.

Avoid changing observable pressed-edge behavior. `controlPressed`, `controlDown`, keyboard state, mouse state, and listener callback ordering should remain compatible with current tests.

## Callback Allocation Cleanup

`pollControllers()` currently passes fresh arrow callbacks into `updateControlState(...)`, for example:

```ts
(listener) => listener.controllerLeftPressed(controller)
```

Those arrows are created every controller poll. Prefer replacing this with an internal enum/control code or a switch-based dispatch method so no per-poll listener closures are needed.

Behavior must remain the same:

- Direction pressed/released callbacks fire for left/right/up/down.
- Non-directional gamepad button callbacks still use the Slick2D-style `index + 1` button number.
- Standard d-pad buttons remain excluded from generic button callback dispatch if that is current behavior.

This is an internal optimization. Do not change public listener method names or event order unless existing behavior is demonstrably wrong.

## POV-Hat Cleanup

`Input.isGamepadPovHat(...)` currently uses `values.some(...)`, which allocates a callback closure. Replace this with a simple indexed loop.

Expected behavior must remain the same:

- The same `POV_HAT_AXIS` is checked.
- The same tolerance is used.
- The same direction value arrays are honored.

## Why This Matters For Stickvania

Stickvania supports keyboard and gamepad remapping in the PWA title menus and live gameplay. Its local input code checks:

- mapped d-pad buttons
- Slick controller directional helpers
- extra axes for right stick / alternate stick support
- mapped jump/attack buttons
- any non-directional gamepad button for menu select

The Stickvania project has already reduced its own temporary object churn in `pwa/src/stickvania/StickvaniaInput.ts`. The remaining repeated polling is now primarily inside `slick2d-ts`.

Reducing repeated gamepad reads and callback allocation should lower active-gameplay CPU/GC pressure without changing Stickvania game rules, timing, rendering, audio, saves, menus, or Java parity logic.

## Non-Goals

Do not:

- Add new Stickvania-specific APIs to `slick2d-ts`.
- Change Stickvania's button mapping semantics.
- Change keyboard behavior.
- Change mouse behavior.
- Change the fixed timestep/game loop.
- Change controller connection/disconnection semantics unless needed to preserve current behavior under the cached snapshot.
- Add polling outside `Input.poll(...)`.
- Add broad controller remapping support to `slick2d-ts`; Stickvania handles mapping itself.

## Edge Cases To Preserve

Please verify:

- No controller connected: controller count and helper methods behave as before.
- Controller connected after boot: next poll sees it.
- Controller disconnected after boot: stale `controlDown` entries are cleared as before.
- `Input.disableControllers()` still prevents controller reads and controller state changes.
- `Input.enableControllers()` resumes controller reads.
- `Input.ANY_CONTROLLER` still scans all connected controllers.
- Specific controller indexes still work.
- `isButtonPressed(...)` still reports the live/down button state expected by current code.
- `isControlPressed(...)` edge behavior remains one-shot through `controlPressed`.
- D-pad buttons continue to behave as direction controls.
- Non-d-pad buttons continue to dispatch `controllerButtonPressed/Released`.
- POV-hat axis direction detection still works.

## Testing Recommendations

Add or update tests in `C:\js-projects\slick2d-ts\test`.

Suggested coverage:

1. `navigator.getGamepads()` is called at most once during one `Input.poll(...)`.
2. Calling several helpers after one `poll(...)` uses the cached frame snapshot.
3. A later `poll(...)` refreshes the snapshot and sees changed button/axis state.
4. `Input.ANY_CONTROLLER` helper behavior is unchanged.
5. Specific controller-index helper behavior is unchanged.
6. Controller disconnect still clears stale `controlDown` state.
7. POV-hat direction checks still pass with the same tolerance.
8. Direction and button listener callbacks still fire once on press and once on release.

If the existing fake DOM/gamepad test harness cannot count `navigator.getGamepads()` calls cleanly, add a small local fake navigator wrapper for this test file only.

## Validation

After the change, run the standard `slick2d-ts` validation:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

Then run Stickvania validation if available from `C:\js-projects\stickvania-js`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:pwa
```

## Visual/Manual Check

After the dependency update is consumed by Stickvania, manually test the PWA in a desktop browser:

- Keyboard movement still works.
- Gamepad d-pad works.
- Left stick works.
- Right stick / alternate axes still work.
- Mapped jump and attack buttons still work.
- Title menus honor remapped direction controls.
- Any non-directional mapped or unmapped gamepad button still selects the current menu item according to Stickvania's current rules.
- Turning a controller off and back on does not leave stuck direction/button state.

## Risk Assessment

Risk is low if the cache is refreshed once at the beginning of each `Input.poll(...)` and helper APIs keep their current return behavior.

The main concern is stale reads if helpers are called outside the normal game loop. Handle that with a lazy refresh path before the first poll or after cache invalidation. Do not retain an old snapshot forever across controller disable/enable or initialization boundaries.

This should be treated as an internal performance fix for browser gamepad input, not a gameplay change.
