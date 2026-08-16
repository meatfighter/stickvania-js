# Stickvania Difficulty Modes

This file defines the current difficulty contract for the PWA and the updated Java desktop build. The 2010 Java baseline had no difficulty selector; the current Java desktop source now mirrors the PWA `NORMAL`/`HARD` selector and hard-mode hooks.

## Shared Rules

- `NORMAL` is the accepted baseline for the current PWA and updated Java desktop builds.
- `HARD` modifies only live user-gameplay balance.
- Demo playback, cutscenes, the ending, credits, loading, input configuration, and title/menu behavior stay at NORMAL/current behavior.
- Boss health is not changed by HARD.
- Ground movement speeds are not changed by HARD.
- HARD helpers live in `pwa/src/stickvania/Main.ts` and `desktop/src/stickvania/Main.java`.
- Random call counts are preserved. When a random delay exists, the original random value is computed first and then adjusted.

## Stored State

- In the PWA, the currently selected difficulty is stored in `localStorage` under `stickvania.difficulty`.
- In the updated Java desktop build, the currently selected difficulty is stored with `java.util.prefs.Preferences` under `stickvania.difficulty` in the `stickvania.Main` package node.
- The current difficulty is also captured in exact game-state snapshots because `Main.difficulty` is serialized with other save-ready `Main` fields.
- A saved game restored by Continue resumes with the saved difficulty value.

## NORMAL

NORMAL uses current PWA behavior:

- Player-controlled Simon uses the PWA player physics profile:
    - Gravity: `0.130027228`
    - Jump velocity: `-4.262100987`
- Demo, cutscene, ending, and game-controlled Simon behavior use the original Java physics profile:
    - Gravity: `0.21`
    - Jump velocity: `-5.25`
- Enemy health, spawner timing, attack cooldowns, and damage are otherwise the current Java-port/PWA baseline.

## HARD Activation

HARD gameplay rules use two gates:

- Player damage uses `Main.isHardDifficultyActiveForGameplay()`.
    - This is true only when the mode is `MODE_PLAYING`, Simon exists, Simon is alive, the player has power, no door transition is active, the stage is not beaten, and floor breaking is not active.
- Enemy health and delay construction use the stage-state gate.
    - This is false during demo, credits, ending, castle falls, title, loading, and input configuration.
    - It is allowed while preparing user-gameplay stage state during intro, map, continue, and restore flows.

## HARD Player Damage

HARD increases non-instant player damage by 1 power unit:

- `hurtSimon(1)` subtracts `2`.
- `hurtSimon(2)` subtracts `3`.
- `hurtSimon(3)` subtracts `4`.
- `hurtSimon(16)` remains `16`.

This is centralized in `Main.adjustSimonDamage(power)`.

Boss contact/projectile damage also goes through this rule if it calls `hurtSimon(power)` during live user-controlled gameplay. Boss health is still unchanged.

## HARD Enemy Health

HARD increases regular multi-hit enemy health by 1 hit:

| Enemy       | NORMAL Hits | HARD Hits | File                                                                           |
| ----------- | ----------: | --------: | ------------------------------------------------------------------------------ |
| AxeKnight   |           3 |         4 | `pwa/src/stickvania/AxeKnight.ts`, `desktop/src/stickvania/AxeKnight.java`     |
| BoneDragon  |           5 |         6 | `pwa/src/stickvania/BoneDragon.ts`, `desktop/src/stickvania/BoneDragon.java`   |
| BonePillar  |           3 |         4 | `pwa/src/stickvania/BonePillar.ts`, `desktop/src/stickvania/BonePillar.java`   |
| Ghost       |           2 |         3 | `pwa/src/stickvania/Ghost.ts`, `desktop/src/stickvania/Ghost.java`             |
| LanceKnight |           2 |         3 | `pwa/src/stickvania/LanceKnight.ts`, `desktop/src/stickvania/LanceKnight.java` |

Boss health is intentionally unchanged.

## HARD Spawn Timing

HARD reduces positive non-boss spawner reset delays to `trunc(baseDelay * 0.66)`, with a minimum positive delay of `1`.

| Spawner           | NORMAL Delay | HARD Delay | File                                                                                       |
| ----------------- | -----------: | ---------: | ------------------------------------------------------------------------------------------ |
| ZombieSpawner     |          273 |        180 | `pwa/src/stickvania/ZombieSpawner.ts`, `desktop/src/stickvania/ZombieSpawner.java`         |
| BatSpawner        |          546 |        360 | `pwa/src/stickvania/BatSpawner.ts`, `desktop/src/stickvania/BatSpawner.java`               |
| BirdSpawner       |          182 |        120 | `pwa/src/stickvania/BirdSpawner.ts`, `desktop/src/stickvania/BirdSpawner.java`             |
| MedusaHeadSpawner |          273 |        180 | `pwa/src/stickvania/MedusaHeadSpawner.ts`, `desktop/src/stickvania/MedusaHeadSpawner.java` |
| MermanSpawner     |          182 |        120 | `pwa/src/stickvania/MermanSpawner.ts`, `desktop/src/stickvania/MermanSpawner.java`         |

HARD also increases selected active ambient enemy caps by 1 during live stage state:

| Spawner       | NORMAL Active Cap | HARD Active Cap | File                                                                               |
| ------------- | ----------------: | --------------: | ---------------------------------------------------------------------------------- |
| ZombieSpawner |                 3 |               4 | `pwa/src/stickvania/ZombieSpawner.ts`, `desktop/src/stickvania/ZombieSpawner.java` |
| BirdSpawner   |                 3 |               4 | `pwa/src/stickvania/BirdSpawner.ts`, `desktop/src/stickvania/BirdSpawner.java`     |
| MermanSpawner |                 2 |               3 | `pwa/src/stickvania/MermanSpawner.ts`, `desktop/src/stickvania/MermanSpawner.java` |

## HARD Enemy Attack Cooldowns

HARD reduces positive non-boss attack/cooldown delays to `trunc(baseDelay * 0.70)`, with a minimum positive delay of `1`.

| Enemy                         | NORMAL Delay Expression    | HARD Result                                                      | File                                                                               |
| ----------------------------- | -------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AxeKnight                     | `random.nextInt(273)`      | Same random call, result multiplied by `0.70`; zero remains zero | `pwa/src/stickvania/AxeKnight.ts`, `desktop/src/stickvania/AxeKnight.java`         |
| BoneDragon                    | `91 + random.nextInt(273)` | `63..254`                                                        | `pwa/src/stickvania/BoneDragon.ts`, `desktop/src/stickvania/BoneDragon.java`       |
| BonePillar short fireball gap | `60`                       | `42`                                                             | `pwa/src/stickvania/BonePillar.ts`, `desktop/src/stickvania/BonePillar.java`       |
| BonePillar long fireball gap  | `364`                      | `254`                                                            | `pwa/src/stickvania/BonePillar.ts`, `desktop/src/stickvania/BonePillar.java`       |
| Merman initial shot delay     | `45 + random.nextInt(45)`  | `31..62`                                                         | `pwa/src/stickvania/Merman.ts`, `desktop/src/stickvania/Merman.java`               |
| Merman repeat shot delay      | `91 + random.nextInt(273)` | `63..254`                                                        | `pwa/src/stickvania/Merman.ts`, `desktop/src/stickvania/Merman.java`               |
| WhiteSkeleton throw delay     | `91 + random.nextInt(273)` | `63..254`                                                        | `pwa/src/stickvania/WhiteSkeleton.ts`, `desktop/src/stickvania/WhiteSkeleton.java` |

Boss timing is intentionally unchanged in this pass.

## HARD Enemy Behavior Timing

HARD reduces selected regular enemy behavior pauses to `trunc(baseDelay * 0.75)`, with a minimum positive delay of `1`. Movement speeds and movement distances are unchanged.

| Enemy                        | NORMAL Delay Expression    | HARD Result                                       | File                                                                               |
| ---------------------------- | -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| WhiteSkeleton stand pause    | `23 + random.nextInt(46)`  | `17..51`                                          | `pwa/src/stickvania/WhiteSkeleton.ts`, `desktop/src/stickvania/WhiteSkeleton.java` |
| WhiteSkeleton walk duration  | `91 + random.nextInt(273)` | `68..272`                                         | `pwa/src/stickvania/WhiteSkeleton.ts`, `desktop/src/stickvania/WhiteSkeleton.java` |
| Raven hover pause            | `91 + random.nextInt(91)`  | `68..135`                                         | `pwa/src/stickvania/Raven.ts`, `desktop/src/stickvania/Raven.java`                 |
| BridgeBat hover pause        | `random.nextInt(43)`       | zero remains zero; positive values become `1..31` | `pwa/src/stickvania/BridgeBat.ts`, `desktop/src/stickvania/BridgeBat.java`         |
| AxeKnight standing threshold | `43`                       | `32`                                              | `pwa/src/stickvania/AxeKnight.ts`, `desktop/src/stickvania/AxeKnight.java`         |
| AxeKnight standing reset     | `random.nextInt(43)`       | zero remains zero; positive values become `1..31` | `pwa/src/stickvania/AxeKnight.ts`, `desktop/src/stickvania/AxeKnight.java`         |

## Explicit Non-Changes

HARD currently does not change:

- Boss health.
- Boss attack/cooldown timing.
- Stage timer speed.
- Item drop tables.
- Stopwatch duration.
- Ground enemy movement speeds.
- Projectile speeds.
- Simon movement speed.
- Demo input recordings.
- Ending input recordings.
- Cutscene timing.
- Credits timing.
