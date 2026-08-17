# Desktop Java Ported PWA Features

This file records PWA-originated gameplay/menu features that were mirrored into the updated Java desktop source.

## Scope

The original NetBeans Java game used the old title text and fixed keyboard controls. The current Java desktop source now mirrors these PWA changes:

- Title menu: `START`, `OPTIONS`.
- Options menu: `INPUT`, `DIFFICULTY`, `DONE`.
- Input menu: current mapping plus `CHANGE`, `RESET`, `DONE`.
- Difficulty menu: `NORMAL`, `HARD`.
- Remappable logical controls: `UP`, `DOWN`, `LEFT`, `RIGHT`, `JUMP`, `ATTACK`.
- Default mapping:
    - `UP = UP, GP-UP`
    - `DOWN = DOWN, GP-DOWN`
    - `LEFT = LEFT, GP-LEFT`
    - `RIGHT = RIGHT, GP-RIGHT`
    - `JUMP = X, GP-A`
    - `ATTACK = Z, GP-X`
- `Space` remains reserved for fullscreen and cannot be remapped.
- `Escape` remains reserved for fullscreen exit and cannot be remapped.
- `UP + ATTACK` uses the Castlevania-style subweapon intent; if no subweapon can be emitted during live play, it falls back to whip.
- Demo playback, cutscenes, ending, credits, loading, and recorded playback remain on the original/NORMAL behavior path.
- Menu navigation accepts the configured logical direction bindings and also keeps physical arrow keys as permanent menu fallbacks. Menu pressed-state detection is source-specific so a stale held controller/key source cannot hide a fresh `UP`, `DOWN`, or select press from another source.
- Java controller direction defaults use Slick native direction bindings, not browser button IDs. The labels still render as `GP-UP`, `GP-DOWN`, `GP-LEFT`, and `GP-RIGHT`.
- `GP-UP`, `GP-DOWN`, `GP-LEFT`, and `GP-RIGHT` accept Slick native directions plus common extra stick axes. Extra stick axes currently follow the same coverage used by `ms-pac-man-2010-js`: horizontal axes `2` and `6`, vertical axes `3` and `7`, with baseline/recenter handling.

## Preference Storage

The Java desktop build uses `java.util.prefs.Preferences`, not browser `localStorage`.

Input mapping is stored under the `stickvania.ButtonMapping` package node:

- `inputMappingVersion = 6`
- `keyUp`
- `keyDown`
- `keyLeft`
- `keyRight`
- `keyJump`
- `keyAttack`
- `controllerUp`
- `controllerDown`
- `controllerLeft`
- `controllerRight`
- `controllerJump`
- `controllerAttack`

Difficulty is stored under the `stickvania.Main` package node:

- `stickvania.difficulty`

If the stored input mapping version is not `6`, the Java build ignores it and uses defaults.

The PWA stores browser-standard gamepad direction buttons as `12..15`. The Java desktop build stores native Slick direction bindings as negative sentinel values:

- `-2 = GP-UP`
- `-3 = GP-DOWN`
- `-4 = GP-LEFT`
- `-5 = GP-RIGHT`

Actual Java controller buttons are still stored as zero-based button indexes.

## Source Files

Workspace Java desktop source:

- `desktop/src/stickvania/ButtonMapping.java`
- `desktop/src/stickvania/InputConfigMode.java`
- `desktop/src/stickvania/StickvaniaInput.java`
- `desktop/src/stickvania/Main.java`
- `desktop/src/stickvania/Simon.java`
- `desktop/src/stickvania/AxeKnight.java`
- `desktop/src/stickvania/BatSpawner.java`
- `desktop/src/stickvania/BirdSpawner.java`
- `desktop/src/stickvania/BoneDragon.java`
- `desktop/src/stickvania/BonePillar.java`
- `desktop/src/stickvania/BridgeBat.java`
- `desktop/src/stickvania/Ghost.java`
- `desktop/src/stickvania/LanceKnight.java`
- `desktop/src/stickvania/MedusaHeadSpawner.java`
- `desktop/src/stickvania/Merman.java`
- `desktop/src/stickvania/MermanSpawner.java`
- `desktop/src/stickvania/Raven.java`
- `desktop/src/stickvania/WhiteSkeleton.java`
- `desktop/src/stickvania/ZombieSpawner.java`

## Validation

Passed:

```text
npm.cmd run build:desktop
```

This built:

- `desktop\target\stickvania-desktop.jar`
- `desktop\target\stickvania-desktop.zip`

One compatibility change was needed for the older NetBeans Slick jar:

- `Log.warn("Unable to initialize controllers.", t)` became `Log.warn("Unable to initialize controllers: " + t)`.

One Java menu-input fix was added after runtime testing:

- `StickvaniaInput.isMenuUpPressed()`, `isMenuDownPressed()`, and `isMenuSelectPressed()` now detect edges per keyboard/controller source instead of only on the combined logical menu state.

One Java gamepad-direction fix was added after runtime testing:

- Java no longer treats default `GP-UP`, `GP-DOWN`, `GP-LEFT`, and `GP-RIGHT` as browser-standard button indexes.
- Controller direction remapping now stores Slick native direction sentinel values when Slick emits `controllerUpPressed`, `controllerDownPressed`, `controllerLeftPressed`, or `controllerRightPressed`.
- The menu's "any non-directional controller button selects" scan excludes buttons currently mapped as logical directions.

One Java/PWA extra-axis support pass was added after comparing against another Slick2D desktop port:

- Runtime direction polling checks extra horizontal axes `2` and `6`.
- Runtime direction polling checks extra vertical axes `3` and `7`.
- The input configuration screen also accepts those extra axes for logical direction bindings.
- Axis baselines are captured and reset near center so nonzero resting values do not behave like held directions.
