# Jackal Desktop Gamepad Input Enhancement Handoff

Date: 2026-08-15

Audience: another AI enhancing `C:\js-projects\jackal-js` desktop Java gamepad input.

This note summarizes the desktop-only Stickvania fix that made multiple gamepads work correctly after problems with old Slick2D/LWJGL 2/JInput on Windows. It is intended as a practical handoff for improving Jackal's desktop build.

## User-Observed Stickvania Symptoms

- Turning off a gamepad repeatedly printed:

```text
Failed to poll device: Failed to poll device (8007000c)
```

- The d-pad did not behave properly until a stick was moved.
- After the desktop-only fix, the user reported: "All my gamepads work well now."

## Root Issues Found

The desktop Java build was depending on Slick2D's old controller abstraction. That layer sits on LWJGL 2/JInput and is much rougher than the browser Gamepad API.

The main issues were:

- JInput can print native poll failures directly to stdout/stderr when a controller disconnects, so normal Java `try/catch` around Slick `Input` calls is not enough to stop console spam.
- Slick's controller polling can continue hitting a disconnected/bad device every frame.
- D-pads may be exposed as standard buttons, POV/hat state, or ordinary axes.
- Some controllers report bogus initial axis values, often `-1.0`, before settling.
- A first-read baseline strategy can turn a bad initial axis value into false movement later.
- Some non-game HID devices appear as controllers.
- Trigger/brake/accelerator/media axes can have misleading ids such as `y` or `rz`, so both component id and human-readable axis name need filtering.

## Stickvania Solution

Reference implementation in this repo:

- `desktop/src/stickvania/ControllerSupport.java`
- `desktop/src/stickvania/StickvaniaInput.java`
- `desktop/src/stickvania/InputConfigMode.java`
- `desktop/src/stickvania/Main.java`
- `desktop/src/stickvania/AppletGameContainer2.java`

Stickvania now:

- Installs a small stdout/stderr filter that suppresses known JInput poll failure lines only.
- Calls `Input.disableControllers()` before Slick's controller path is used.
- Avoids `input.initControllers()`, Slick `ControllerListener`, `Input.isControllerUp(...)`, `Input.isButtonPressed(...)`, and `Input.getAxisValue(...)` in game/input code.
- Polls LWJGL `Controllers` directly through `ControllerSupport`.
- Treats controller polling as best effort. If create/poll fails, keyboard play continues.
- Marks controller input unavailable after native poll failure so the app stops polling the failed device.
- Supports direction from POV/hat, directional buttons, and true X/Y/RX/RY axes.
- Uses raw axis values plus deadzone, not first-read baseline subtraction.
- Rejects trigger/brake/accelerator/throttle/slider/volume axes for movement.
- Filters keyboard/mouse/consumer-control/system-controller names and media/volume-only devices.
- Polls input mapping edges manually because Slick controller listeners are disabled.

## Jackal Current State

Jackal already has `desktop/src/jackal/ControllerSupport.java`, but it is still a partial compatibility layer:

- It still accepts an `org.newdawn.slick.Input` parameter everywhere.
- It still calls Slick controller APIs such as `input.isControllerUp(...)`, `input.isButtonPressed(...)`, `input.isControlPressed(...)`, `input.getAxisCount(...)`, and `input.getAxisValue(...)`.
- It still uses first-read axis baseline correction.
- It does not install the JInput poll-failure stdout/stderr filter.
- It does not disable Slick controller polling.
- `desktop/src/jackal/InputMode.java` still uses Slick `ControllerListener`.
- Jackal's vendored Slick containers call `getInput().initControllers()` in `desktop/src/org/newdawn/slick/ApplicationGameContainer.java` and `desktop/src/org/newdawn/slick/ScalableGameContainer.java`.

So Jackal has some helpful structure, but it does not yet have the full fix that worked in Stickvania.

## Recommended Jackal Changes

Port the Stickvania `ControllerSupport` approach into Jackal, but adapt the constants carefully.

Jackal `ButtonMapping` currently uses:

- `DEFAULT_CONTROLLER_UP = 12`
- `DEFAULT_CONTROLLER_DOWN = 13`
- `DEFAULT_CONTROLLER_LEFT = 14`
- `DEFAULT_CONTROLLER_RIGHT = 15`

Stickvania uses negative logical direction sentinels plus compatibility for `12..15`. Do not blindly copy those negative constants into Jackal unless you intentionally migrate Jackal's saved mapping format. Jackal can keep `12..15` as logical d-pad direction defaults and make `ControllerSupport.isDirectionDown(...)` treat those values as "any controller up/down/left/right plus matching button."

Specific Jackal tasks:

1. Replace or substantially enhance `desktop/src/jackal/ControllerSupport.java` with the raw LWJGL/JInput polling approach from Stickvania.
2. Add `prepareDesktopInput()` that installs the poll-failure filter and calls `Input.disableControllers()`.
3. Call `ControllerSupport.prepareDesktopInput()` before desktop container startup and before any custom applet/container initialization that may otherwise initialize Slick controllers.
4. Remove direct Slick controller reads from Jackal gameplay input. `HumanInput` should ask `ControllerSupport` for direction/button state instead of passing Slick `Input` into the support layer.
5. Rework `InputMode` so controller configuration is edge-polled by `ControllerSupport`, not delivered by Slick `ControllerListener`.
6. Remove first-read axis baselines from Jackal input. Use raw axis values plus deadzone.
7. Support POV/hat, directional buttons, and named X/Y/RX/RY axes.
8. Filter non-game and media/volume HID devices.
9. Treat any non-directional gamepad button as menu confirm/start where Jackal currently wants that behavior.

## Validation To Run

At minimum:

- Build the desktop Java project.
- Start the desktop game with no controller connected.
- Start with a controller connected and verify d-pad, left stick, and right stick behavior.
- Turn the controller off while the game is running and confirm no repeated `Failed to poll device:` spam.
- Turn the controller back on and decide expected behavior. The Stickvania fix treats a native poll failure as controller input unavailable for the rest of that process; keyboard remains available. If Jackal wants hot reconnect after a failure, add it deliberately and test it hard.
- Open Jackal's input mapping screen and verify controller directions/buttons can still be mapped after Slick controller listeners are disabled.

## Concerns

- The Stickvania support layer uses reflection into LWJGL 2's JInput-backed controller implementation to inspect raw axes/buttons/POV. This compiled and worked for Stickvania's bundled legacy jars, but Jackal should be built and run against its own bundled desktop jars.
- The stdout/stderr filter is global. It is intentionally narrow, suppressing only lines that match known JInput poll failures. Keep it narrow.
- After a native poll failure, Stickvania stops polling controllers for the rest of the process. This is quiet and stable, but it means controller hot-reconnect after a disconnect may require restarting the game.
- Jackal stores `controllerIndex`, but its current `HumanInput` already mostly behaves like "any controller." Decide whether to keep `controllerIndex` as legacy UI state or formalize the "any controller" behavior.
- Disabling Slick controllers means any code relying on Slick control pressed records or controller listeners must be migrated. In Jackal, `InputMode.java` is the key file to audit.

## Outcome In Stickvania

After implementing this desktop-only path in Stickvania:

- Desktop build passed.
- Slick controller polling was removed from game-facing desktop input.
- The user verified all tested gamepads worked well.
