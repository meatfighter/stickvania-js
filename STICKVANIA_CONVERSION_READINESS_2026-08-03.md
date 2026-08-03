# Stickvania Conversion Readiness - 2026-08-03

## Executive Answer

There is no new `slick2d-ts` blocker to fix before converting Stickvania. The latest relevant Slick2D-ts issues from the prior audits were fullscreen/cursor and resource/audio parity concerns; the current local scan shows the project-facing APIs Stickvania needs are present in `C:\js-projects\slick2d-ts`, and the other AI reported `typecheck`, `lint`, and `test` passing after its cursor/fullscreen rejection fix.

The remaining pre-conversion work is project-side discipline, not another Slick2D-ts feature pass:

1. Establish the 1-to-1 class/file conversion rule before touching game code.
2. Establish Java numeric helper rules before translating any method body.
3. Preserve every asset and data file under the Java `src` tree, including files that look unused.
4. Build the PWA shell around the Java-shaped game, without changing game logic to fit browser UI needs.
5. Add parity audit scripts/tests as soon as the TS class files exist.

No separate `slick2d-ts` patch request markdown was created from this pass, because I did not find a Stickvania-relevant missing Slick feature or Slick bug.

## Scope

Inputs audited:

- Java game: `C:\NetBeansProjects\stickvania`
- Slick2D TypeScript port: `C:\js-projects\slick2d-ts`
- Current target repo: `C:\js-projects\stickvania-js`
- Browser shell examples:
  - `C:\js-projects\pitfall-js`
  - `C:\js-projects\worst-mario-game-ever`

Target:

- Desktop-browser PWA SPA.
- Modern evergreen browsers only.
- One Java class maps to one TS file wherever possible.
- Java package/file layout is preserved as closely as the web build allows.
- Game behavior remains Java-shaped; browser-only concerns live in a shell/bootstrap layer.

## Conversion Readiness Verdict

The game conversion can start after this document is accepted as the current source of truth.

Before converting method bodies, create the TS project shell and numeric helper conventions. That is not "game conversion" yet; it is guardrail setup. Without those conventions, integer-sensitive code will be translated inconsistently.

Do not wait for a broader Slick2D-ts port. Stickvania does not need all of Java Slick2D. It needs the subset used by this game: `BasicGame`, `GameContainer`, `AppGameContainer`, `ApplicationGameContainer`, `Graphics`, `Image`, `PackedSpriteSheet`, `SpriteSheet`, `Color`, `Input`, `Sound`, `Music`, `SoundStore`, `ResourceLoader`, `FastTrig`, `Sys`, `Display`, `DisplayMode`, `Mouse`, `Cursor`, `CursorLoader`, `BufferUtils`, and a few compatibility helpers such as `JavaRandom`, `BinaryReader`, `RecordedInput`, and `Song`.

## Source Inventory

Java source count:

- 73 Java files under `src\stickvania`.
- 1 large game driver: `Main.java` at 127,579 bytes.
- 72 supporting classes, enemies, projectiles, effects, data holders, wrappers, and platform helpers.

Resource source count:

- 10 image/sprite-sheet files.
- 28 music files.
- 52 sound-effect files.
- 15 recording files.
- 18 stage files.

All files under Java `src\images`, `src\music`, `src\soundfx`, `src\recordings`, and `src\stages` should be copied to the web asset tree with the same logical resource refs, such as `images/pack_1.def` and `music/stage_1_2_loop.ogg`.

## Class/File Mapping

Recommended TS root:

- Java: `C:\NetBeansProjects\stickvania\src\stickvania\X.java`
- TS: `C:\js-projects\stickvania-js\src\stickvania\X.ts`

Each class should keep its Java class name. Use named exports for TS ergonomics, but keep the primary class name identical.

| Java class | TS target | Notes |
|---|---|---|
| `AppletGameContainer2` | `src/stickvania/AppletGameContainer2.ts` | Preserve class/file for structure. Implement as browser adapter/stub only if needed; do not port Java AWT/Applet behavior. Runtime should prefer PWA bootstrap plus `AppGameContainer`. |
| `Axe` | `src/stickvania/Axe.ts` | Direct class port. |
| `AxeKnight` | `src/stickvania/AxeKnight.ts` | Direct class port. |
| `Bat` | `src/stickvania/Bat.ts` | Direct class port. |
| `BatBoss` | `src/stickvania/BatBoss.ts` | Direct class port. |
| `BatSpawner` | `src/stickvania/BatSpawner.ts` | Direct class port. |
| `Bird` | `src/stickvania/Bird.ts` | Direct class port. |
| `BirdSpawner` | `src/stickvania/BirdSpawner.ts` | Direct class port. |
| `Bone` | `src/stickvania/Bone.ts` | Direct class port. |
| `BoneDragon` | `src/stickvania/BoneDragon.ts` | Direct class port. |
| `BoneDragonVertebra` | `src/stickvania/BoneDragonVertebra.ts` | Direct class port. |
| `BonePillar` | `src/stickvania/BonePillar.ts` | Direct class port. |
| `Boomerang` | `src/stickvania/Boomerang.ts` | Direct class port. Preserve typo `STATE_FOWARD`. |
| `BoomerangAxe` | `src/stickvania/BoomerangAxe.ts` | Direct class port. Preserve typo `STATE_FOWARD`. |
| `BreakWall` | `src/stickvania/BreakWall.ts` | Direct class port. |
| `BrickFragment` | `src/stickvania/BrickFragment.ts` | Direct class port. |
| `BridgeBat` | `src/stickvania/BridgeBat.ts` | Direct class port. |
| `Candles` | `src/stickvania/Candles.ts` | Direct class port. |
| `Checkpoint` | `src/stickvania/Checkpoint.ts` | Direct data class port. |
| `Dagger` | `src/stickvania/Dagger.ts` | Direct class port. |
| `DieBat` | `src/stickvania/DieBat.ts` | Direct class port. |
| `Dog` | `src/stickvania/Dog.ts` | Direct class port. |
| `Door` | `src/stickvania/Door.ts` | Direct class port. |
| `Dracula` | `src/stickvania/Dracula.ts` | Direct class port. |
| `DraculaBat` | `src/stickvania/DraculaBat.ts` | Direct class port. |
| `DropItem` | `src/stickvania/DropItem.ts` | Direct class port. |
| `Droplets` | `src/stickvania/Droplets.ts` | Direct class port. |
| `FadingStairs` | `src/stickvania/FadingStairs.ts` | Direct class port. |
| `Fireball` | `src/stickvania/Fireball.ts` | Direct class port. |
| `Flame` | `src/stickvania/Flame.ts` | Direct class port. |
| `FloatingPoints` | `src/stickvania/FloatingPoints.ts` | Direct class port. |
| `FloorBreaker` | `src/stickvania/FloorBreaker.ts` | Direct class port. |
| `FoodOrb` | `src/stickvania/FoodOrb.ts` | Direct class port. |
| `Frankenstein` | `src/stickvania/Frankenstein.ts` | Direct class port. |
| `Ghost` | `src/stickvania/Ghost.ts` | Direct class port. |
| `GrimReaper` | `src/stickvania/GrimReaper.ts` | Direct class port. |
| `HolyWater` | `src/stickvania/HolyWater.ts` | Direct class port. |
| `Igor` | `src/stickvania/Igor.ts` | Direct class port. |
| `LanceKnight` | `src/stickvania/LanceKnight.ts` | Direct class port. |
| `Main` | `src/stickvania/Main.ts` | Direct game driver port. Keep modes, fields, and methods shaped like Java. Browser bootstrap should call into it. |
| `MedusaBoss` | `src/stickvania/MedusaBoss.ts` | Direct class port. |
| `MedusaHead` | `src/stickvania/MedusaHead.ts` | Direct class port. |
| `MedusaHeadSpawner` | `src/stickvania/MedusaHeadSpawner.ts` | Direct class port. |
| `Merman` | `src/stickvania/Merman.ts` | Direct class port. |
| `MermanSpawner` | `src/stickvania/MermanSpawner.ts` | Direct class port. |
| `MovingPlatform` | `src/stickvania/MovingPlatform.ts` | Direct class port. |
| `MummyBoss` | `src/stickvania/MummyBoss.ts` | Direct class port. |
| `Orb` | `src/stickvania/Orb.ts` | Direct class port. |
| `Raven` | `src/stickvania/Raven.ts` | Direct class port. |
| `RedSkeleton` | `src/stickvania/RedSkeleton.ts` | Direct class port. |
| `Region` | `src/stickvania/Region.ts` | Direct data class port. |
| `ScalableGame2` | `src/stickvania/ScalableGame2.ts` | Preserve project class/file. It may delegate to `slick/ScalableGame2`, but keep local file for parity. |
| `Secret` | `src/stickvania/Secret.ts` | Direct class port. |
| `ShootingSpark` | `src/stickvania/ShootingSpark.ts` | Direct class port. |
| `Sickle` | `src/stickvania/Sickle.ts` | Direct class port. Preserve typo `STATE_FOWARD`. |
| `Simon` | `src/stickvania/Simon.ts` | Direct class port. Integer/array-heavy. |
| `SmallHeart` | `src/stickvania/SmallHeart.ts` | Direct class port. |
| `Snakes` | `src/stickvania/Snakes.ts` | Direct class port. |
| `Song` | `src/stickvania/Song.ts` | Preserve game helper class even though `slick2d-ts` also has support `Song`. |
| `Spark` | `src/stickvania/Spark.ts` | Direct class port. |
| `Spikes` | `src/stickvania/Spikes.ts` | Direct class port. |
| `StageSegment` | `src/stickvania/StageSegment.ts` | Direct data class port. Decide `stage` storage before porting. |
| `StairsEntry` | `src/stickvania/StairsEntry.ts` | Direct data class port. |
| `StopWatch` | `src/stickvania/StopWatch.ts` | Direct class port. |
| `SwoopingBat` | `src/stickvania/SwoopingBat.ts` | Direct class port. |
| `Thing` | `src/stickvania/Thing.ts` | Direct base class port. Most collision integer rules live here. |
| `ThingStack` | `src/stickvania/ThingStack.ts` | Direct stack class port. |
| `Torch` | `src/stickvania/Torch.ts` | Direct class port. |
| `WhiteSkeleton` | `src/stickvania/WhiteSkeleton.ts` | Direct class port. |
| `Wrapping` | `src/stickvania/Wrapping.ts` | Direct class port. |
| `Zombie` | `src/stickvania/Zombie.ts` | Direct class port. |
| `ZombieSpawner` | `src/stickvania/ZombieSpawner.ts` | Direct class port. |

## Project-Side Browser Files

These are allowed because a PWA cannot be launched exactly like a Java desktop app:

- `src/main.ts` or equivalent SPA bootstrap.
- PWA UI shell files for splash screen, menu screen, hamburger return, and error state.
- `version.json` or equivalent build version file.
- Service worker and manifest files.
- Asset preloader/registration glue.
- Numeric helper file, recommended `src/stickvania/JavaMath.ts`.

Keep browser files outside `src/stickvania` where possible. `src/stickvania` should remain the Java-shaped port.

## Asset Inventory

Images and sheets:

- `images/castle_gates.png`
- `images/ending.png`
- `images/icon.png`
- `images/map_1.png`
- `images/map_2.png`
- `images/pack_1.def`
- `images/pack_1.png`
- `images/pack_2.def`
- `images/pack_2.png`
- `images/title_screen.png`

Music:

- `music/boss_1_intro.ogg`
- `music/boss_1_loop.ogg`
- `music/boss_2_intro.ogg`
- `music/boss_2_loop.ogg`
- `music/dracula_dead.ogg`
- `music/ending_loop.ogg`
- `music/game_over.ogg`
- `music/map_1.ogg`
- `music/map_2.ogg`
- `music/map_3.ogg`
- `music/map_4.ogg`
- `music/prologue.ogg`
- `music/simon_killed.ogg`
- `music/stage_1_1_loop.ogg`
- `music/stage_1_2_intro.ogg`
- `music/stage_1_2_loop.ogg`
- `music/stage_2_1_intro.ogg`
- `music/stage_2_1_loop.ogg`
- `music/stage_3_1_intro.ogg`
- `music/stage_3_1_loop.ogg`
- `music/stage_4_1_loop.ogg`
- `music/stage_4_2_loop.ogg`
- `music/stage_5_1_intro.ogg`
- `music/stage_5_1_loop.ogg`
- `music/stage_6_1_loop.ogg`
- `music/stage_6_2_intro.ogg`
- `music/stage_6_2_loop.ogg`
- `music/stage_cleared.ogg`

Sound effects:

- `soundfx/advance_whip.ogg`
- `soundfx/bat_killed.ogg`
- `soundfx/bleep.ogg`
- `soundfx/boss_hurt.ogg`
- `soundfx/boss_killed_1.ogg`
- `soundfx/boss_killed_2.ogg`
- `soundfx/boss_killed_3.ogg`
- `soundfx/breaks_wall.ogg`
- `soundfx/ching.ogg`
- `soundfx/crumble.ogg`
- `soundfx/dog_killed.ogg`
- `soundfx/door_opens_1.ogg`
- `soundfx/door_opens_2.ogg`
- `soundfx/dracula_to_bats.ogg`
- `soundfx/fire_ball_sfx.ogg`
- `soundfx/fire_ball_shot.ogg`
- `soundfx/gain_potion.ogg`
- `soundfx/got_double.ogg`
- `soundfx/got_money.ogg`
- `soundfx/got_weapon.ogg`
- `soundfx/heartbeat.ogg`
- `soundfx/hit_candle.ogg`
- `soundfx/kill_all_sfx.ogg`
- `soundfx/killed_1.ogg`
- `soundfx/killed_2.ogg`
- `soundfx/killed_3.ogg`
- `soundfx/killed_4.ogg`
- `soundfx/killed_5.ogg`
- `soundfx/lands.ogg`
- `soundfx/large_bat_killed.ogg`
- `soundfx/lose_potion.ogg`
- `soundfx/medusa_head_killed.ogg`
- `soundfx/merman_spit.ogg`
- `soundfx/one_up.ogg`
- `soundfx/pressed_enter.ogg`
- `soundfx/raven_killed.ogg`
- `soundfx/simon_hurt.ogg`
- `soundfx/simon_in_pit.ogg`
- `soundfx/snuffed.ogg`
- `soundfx/spinning.ogg`
- `soundfx/splash.ogg`
- `soundfx/stunned.ogg`
- `soundfx/threw_dagger.ogg`
- `soundfx/thunder.ogg`
- `soundfx/torch_breaks.ogg`
- `soundfx/twang.ogg`
- `soundfx/used_holy_water.ogg`
- `soundfx/watch_tick.ogg`
- `soundfx/whip_1.ogg`
- `soundfx/whip_2.ogg`
- `soundfx/wing_flaps.ogg`
- `soundfx/zombie_killed.ogg`

Recordings:

- `recordings/demo_1.dat`
- `recordings/demo_2.dat`
- `recordings/demo_3.dat`
- `recordings/ending_1.dat`
- `recordings/ending_2.dat`
- `recordings/ending_3.dat`
- `recordings/ending_4.dat`
- `recordings/ending_5.dat`
- `recordings/ending_6.dat`
- `recordings/ending_7.dat`
- `recordings/ending_8.dat`
- `recordings/ending_9.dat`
- `recordings/ending_10.dat`
- `recordings/ending_11.dat`
- `recordings/ending_12.dat`

Stages:

- `stages/stage_0_0.txt`
- `stages/stage_0_1.txt`
- `stages/stage_1_0.txt`
- `stages/stage_1_1.txt`
- `stages/stage_1_2.txt`
- `stages/stage_1_3.txt`
- `stages/stage_2_0.txt`
- `stages/stage_2_1.txt`
- `stages/stage_2_2.txt`
- `stages/stage_3_0.txt`
- `stages/stage_3_1.txt`
- `stages/stage_4_0.txt`
- `stages/stage_4_1.txt`
- `stages/stage_4_2.txt`
- `stages/stage_4_3.txt`
- `stages/stage_5_0.txt`
- `stages/stage_5_1.txt`
- `stages/stage_5_2.txt`

Asset notes:

- `Main.java:461-469` loads all demo and ending recordings in the constructor.
- `Main.java:497-500` constructs `PackedSpriteSheet` from `images/pack_1.def` and `images/pack_2.def`.
- `Main.java:689-864` loads standalone images.
- `Main.java:903-953` constructs most sound effects.
- `Main.java:3470-3535` constructs music and `Song` instances in the loading mode.
- `soundfx/fire_ball_sfx.ogg` exists in the Java asset tree but did not appear in the current `new Sound(...)` scan. Copy it anyway; do not prune source assets during parity conversion.

## PWA Shell Requirements

Browser shell behavior should be outside the Java-shaped game classes.

Required shell states:

1. Boot splash with animated dots.
2. Boot or loading error screen with actionable text.
3. Menu screen with Start button.
4. Menu audio volume slider.
5. Game canvas screen.
6. In-game hamburger control in the upper-left that returns to the menu.

Why the Start button is required:

- Modern browsers restrict audible autoplay.
- Web Audio should be started or resumed in a user gesture.
- Fullscreen also requires transient user activation.
- Therefore Start should be the moment that sets volume, resumes/creates audio if needed, mounts the game canvas, and starts the Slick container.

Local examples to follow:

- `C:\js-projects\pitfall-js\src\start.ts:21-47` builds a start/menu DOM with a volume slider and Start button.
- `C:\js-projects\pitfall-js\src\start.ts:135-139` calls `setVolume(...)`, exits the menu, and enters the game from the button path.
- `C:\js-projects\pitfall-js\src\audio.ts:57-65` resumes audio before applying volume when suspended.
- `C:\js-projects\pitfall-js\src\input.ts:302` and `src\input.ts:337` reserve the upper-left hamburger zone.
- `C:\js-projects\pitfall-js\src\screen.ts:121` draws the hamburger icon.
- `C:\js-projects\worst-mario-game-ever\pwa\index.html:45-70` uses animated boot dots.
- `C:\js-projects\worst-mario-game-ever\pwa\index.html:72-94` switches to a boot error state.
- `C:\js-projects\worst-mario-game-ever\pwa\src\scenes\LoadingScene.ts:18-60` renders an in-app loading failure.
- `C:\js-projects\worst-mario-game-ever\pwa\vite.config.ts:28-39` stamps version/cache values into HTML.
- `C:\js-projects\worst-mario-game-ever\pwa\src\app\ServiceWorkerRegistrar.ts:7-11` registers the service worker with a version query.
- `C:\js-projects\worst-mario-game-ever\pwa\public\sw.js:1-4` names service-worker caches by version.

## Versioning And Cache Busting

Add a single version source, recommended:

- `version.json`
- fields: `version`, `buildStamp`

Use it in:

- `package.json` version, if desired.
- PWA manifest URL: `manifest.webmanifest?v=<buildStamp>`.
- favicon/icon URLs.
- service worker registration URL: `sw.js?v=<version>-<buildStamp>`.
- Slick resource fetching via `ResourceLoader.setCacheBust(buildStamp)`.
- Any manually referenced resource URL.

Slick2D-ts already exposes:

- `ResourceLoader.setCacheBust(value)` in `src/slick/util/ResourceLoader.ts`.
- `ResourceLoader.setRetryOptions(retries, delayMs)` in `src/slick/util/ResourceLoader.ts`.
- Fetch retry handling in `ResourceLoader.fetchWithRetry(...)`.

Do not change the Java resource ref used as the cache key. `images/pack_1.def` should remain the logical ref even if the actual network URL becomes `images/pack_1.def?v=...`.

## Resource Loading Rules

Java code expects synchronous resource availability:

- `ClassLoader.getResourceAsStream(...)` for recordings and stage files.
- `PackedSpriteSheet(...)` constructor reads `.def` bytes.
- `Image`, `Sound`, and `Music` constructors queue/consume resource loads.

Browser implementation rule:

1. Register or preload all bytes before the first Java-shaped game code needs synchronous reads.
2. Use `ResourceLoader.loadResource(...)` and `ResourceLoader.waitForAll()` as the barrier.
3. Use `ResourceLoader.getResourceAsStream(ref)` only after preload/registration.
4. Surface any failure in the PWA loading screen.
5. Configure retry options before asset preload starts.

The Stickvania loading mode still needs to be preserved because Java creates music in `updateLoading(...)` one item per step. The shell should not flatten that behavior away. It can preload bytes and decode support data, but the Java-shaped `updateLoading` sequence should still create the same objects at the same loading indices.

## Integer And Numeric Semantics

Java and TS differ in ways that matter here.

Java:

- `int` is signed 32-bit.
- `float` is 32-bit floating point.
- `(int)floatOrDouble` truncates toward zero.
- Integer division truncates toward zero.
- Shifts and bitwise operations are 32-bit signed for `int`.
- `char` is a 16-bit numeric code unit and can index arrays.

TypeScript/JavaScript:

- `number` is IEEE-754 double precision.
- Safe integer precision extends well beyond Java `int`, but it does not overflow automatically like Java `int`.
- `Math.trunc(...)` removes fractional digits and matches Java cast/division truncation direction for finite values.
- Bitwise operators coerce operands to signed 32-bit integers.
- Strings are not numeric char values; `string.charCodeAt(0)` is needed when Java code indexes arrays by `char`.

Recommended helper file:

- `src/stickvania/JavaMath.ts`

Recommended helpers:

- `toInt(value: number): number` for Java signed 32-bit coercion, implemented with `value | 0`.
- `trunc(value: number): number` for Java `(int)` casts on finite game values, implemented with `Math.trunc(value)`.
- `idiv(a: number, b: number): number` for Java integer division.
- `irem(a: number, b: number): number` for Java remainder after operand truncation.
- `ishl(a: number, b: number): number` for `a << b`.
- `ishr(a: number, b: number): number` for `a >> b`.
- `iushr(a: number, b: number): number` for `a >>> b`, if encountered.
- `charCode(ch: string): number` for Java char-array indexing.
- `javaSeed(value: number): number` for hex-int seeds such as `0xDEADBEEF | 0`.

Do not replace every numeric expression with helpers. Use helpers where Java `int`, `char`, integer division, or cast semantics are actually present.

### Required Integer Decisions

Use `Math.trunc` for Java `(int)` casts:

- Collision and movement probes in `Thing.java:48-52`, `97-103`, `135-136`, `176-180`, and `248-252`.
- Simon/stair/tile alignment in `Main.java:1414-1548`.
- Camera and actor draw positions in `Main.java:3759-3770`, `3880-3891`, and many entity render methods.
- Door proximity checks in `Door.java:42-43` and `Door.java:88-89`.
- Boss/projectile integer hit boxes, for example `Dracula.java:66-76`.

Use integer division helper where Java divides ints:

- `Main.java:492`: fade alpha table uses `(255 * i) / fades.length`. Expected integer alphas for 23 fades are `0, 11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 133, 144, 155, 166, 177, 188, 199, 210, 221, 232, 243`.
- `Main.java:982`: `Sys.getTimerResolution() / 91`. With a 1000 ms resolution this is `10`, not `10.989...`.
- `Main.java:2459`: `(level.size() / 11) << 4`.
- `Main.java:2475-2482`: `drawNumber` uses `value /= 10` inside the loop. In TS, use `value = idiv(value, 10)` or digits become fractional.

Use bitwise operations directly where Java used shifts/bitwise:

- `Main.java:1308-1316` and `1347-1355` packs/unpacks recorded key bits.
- `Main.java:1838`, `1857-1858`, `1896`, `1917` multiply tiles by 32 with shifts.
- `Main.java:2349` derives an index with `((int)thing.x) >> 8`.
- `Main.java:2393` and `2427` builds wall masks with shifts and OR.
- `Main.java:2505-2562` converts pixel coordinates to tile coordinates with `>> 5`.
- `Main.java:3777-3782` and `3933-3940` align camera and block drawing.
- `Simon.java:254` uses `(((((int)y + 8) >> 4) & 1) == 0)`.
- `BirdSpawner.java:34-35` aligns Simon's Y to 32-pixel rows before random offset.

Use numeric char codes where Java indexes arrays by `char`:

- `Main.java:505-524` assigns `symbols['a' + i]`, `symbols['0' + i]`, and punctuation.
- `Main.java:794` reads `symbols['^']`.
- `Main.java:2481`, `2488`, `2494`, and `2500` draw digits/strings through `symbols[...]`.

Recommended representation:

- `symbols: Array<Image | null> = new Array(256).fill(null);`
- `symbols[charCode("A")] = image;`
- `symbols[charCodeAt(string, i)]?.draw(...)` or a helper that throws if missing.

Stage char grid:

- Java: `char[][] stage` in `StageSegment.java:6`.
- TS option A: `string[][]` with one-character strings. Easy for comparisons with `"x"`.
- TS option B: `number[][]` of UTF-16 char codes. Closer to Java `char`, easier for array indexing.
- Recommended: use `number[][]` for `stage` because the code already relies on numeric char behavior elsewhere. Provide helpers to compare against character literals by code.

Use `JavaRandom` for `java.util.Random`:

- `Main.java:248`: field default `new Random()`.
- `Main.java:3019`, `3123`, `3248`, `3266`: `new Random(0xDEADBEEF)`.
- `Main.java:3288`: `new Random()`.
- Many classes use `nextInt`, `nextFloat`, and `nextBoolean`.

Critical seed rule:

- Java `0xDEADBEEF` as an `int` literal is `-559038737`, then widened to long for `Random(long)`.
- JS `0xDEADBEEF` is `3735928559`.
- The TS port must use `new JavaRandom(0xDEADBEEF | 0)` or `new JavaRandom(-559038737)` to match Java.

Float decision:

- TS `number` gives double precision, not Java `float`.
- Do not apply `Math.fround` everywhere up front; that can create noise and may diverge from the current `slick2d-ts` APIs.
- First port with explicit integer/cast/division rules.
- Add replay/snapshot audits for demos and credits.
- If deterministic drift appears in float-heavy movement, selectively apply `Math.fround` in the affected local calculations and document every use.

Integer overflow decision:

- Stickvania coordinates, timers, counters, and scores appear to stay safely within JS exact integer range.
- Java int overflow is not an expected gameplay feature, except through bitwise coercion and `Random` seeds.
- Use `toInt` around values that are conceptually Java int state when they feed bitwise operations, random seeds, packed key records, or array dimensions.

## Input And Recordings

Java code records and replays input as packed bits:

- `Main.java:1308-1316` shifts key state into `keyDown`.
- `Main.java:1347-1355` shifts it back out during playback.
- `Main.java:1332` ends demo at `recordingIndex == 2730` or Enter.
- `Main.java:3129` pauses credits at `recordingIndex == 728`.

Port requirement:

- Human input and recorded input should both conform to the same interface.
- Preserve `input.clearKeyPressedRecord()` behavior.
- Preserve one-shot `isKeyPressed` behavior separately from held `isKeyDown`.
- Preserve key constants: Enter, Space, Escape, arrows, `D`, `F`, and any pause/fullscreen keys used by Java.

Slick2D-ts already contains `src/slick/support/RecordedInput.ts`. Use it if it matches the exact Stickvania bit order. If it does not, keep the game-specific code in `Main.ts` to match Java and only use Slick helper APIs where exact.

## Fullscreen, Cursor, And Hamburger

Java `Main.update(...)` toggles fullscreen on Space and exits on Escape:

- `Main.java:1003-1021`: Space toggles fullscreen/windowed mode and hides/shows mouse cursor.
- `Main.java:1022-1030`: Escape exits fullscreen.
- `Main.java:958-975`: transparent cursor hide/restore paths.

Browser constraints:

- Fullscreen requests are asynchronous.
- Fullscreen entry requires transient user activation.
- Transient activation can be consumed or expire.
- Direct Java-style callers may ignore returned promises, so Slick2D-ts must internally observe failures. The current Slick2D-ts docs/source indicate this has been handled.

Port requirement:

- Keep Java fullscreen logic in `Main.ts`.
- Let `AppGameContainer`/`Display` bridge async browser fullscreen.
- Add a browser smoke test once the shell exists:
  1. Click Start.
  2. Focus canvas.
  3. Press Space.
  4. Assert `document.fullscreenElement` is the canvas.
  5. Assert no unhandled rejection.
  6. Assert cursor restore works after Escape and after hamburger return.

Hamburger:

- This is browser shell behavior, not Java game logic.
- It should draw or overlay in the upper-left.
- On click/tap, destroy or stop the current game container, restore cursor/fullscreen/audio state, and return to the menu.
- It must not modify Stickvania's `Main` modes or internal update logic except through a clean shutdown/return-to-menu wrapper.

## Slick2D-ts Requirements Status

Stickvania needs the following Slick2D-ts behavior, all currently present or previously reported fixed:

- `AppGameContainer.start()` calls `game.init`, waits on resource loading, then runs frames.
- `ResourceLoader` supports cache busting and retry options.
- `ResourceLoader.getResourceAsStream(ref)` returns already loaded bytes.
- `Image`, `PackedSpriteSheet`, `Sound`, and `Music` integrate with `ResourceLoader`.
- `SoundStore` uses Web Audio and supports global music/sound volume.
- `Music` and `Sound` preserve required Slick call shapes.
- `ScalableGame2` exists in `src/slick/ScalableGame2.ts`.
- `FastTrig` exists.
- `Sys.getTime()` and `Sys.getTimerResolution()` exist.
- `Display` and `DisplayMode` exist.
- `Mouse`, `Cursor`, and `CursorLoader` exist.
- Fullscreen rejection is internally observed.
- Cursor hidden for fullscreen is restored after denied fullscreen entry or forced exit.
- `JavaRandom` exists for `java.util.Random` parity.
- `BinaryReader` exists for Java-style binary reads.
- `RecordedInput` exists for recorded/demo input support.

Not required from Slick2D-ts for this project:

- Java AWT/Applet support.
- Real LWJGL display enumeration parity beyond what the browser adapter needs.
- Complete Slick2D API coverage unrelated to Stickvania.
- Java file/URL APIs beyond resource bytes needed by the game.
- Desktop-native icon/window behavior beyond browser PWA equivalents.

No new `slick2d-ts` issue markdown was created. If the later Playwright/browser smoke test fails for fullscreen activation or audio resume despite correct shell usage, create a new focused Slick2D-ts patch request then.

## Audit And Verification Plan

Do this as soon as TS files exist:

1. Static file map audit:
   - Every Java file in `src\stickvania` has exactly one TS target in `src/stickvania`.
   - No Java class is merged into another file.
   - No Java method is omitted without an explicit browser-only note.

2. Method/field parity audit:
   - Extract class names, fields, constants, constructors, and method names from Java.
   - Extract the same from TS.
   - Produce a diff table.

3. Resource audit:
   - Every Java resource path listed above exists in the web asset tree.
   - Every runtime resource ref keeps the Java logical name.
   - All refs pass through cache-busting only at URL-fetch time.

4. Integer unit tests:
   - Fade alpha table from `Main.java:492`.
   - `Sys.getTimerResolution() / 91` behavior.
   - `drawNumber` digit loop.
   - Camera offset and tile index calculations.
   - `0xDEADBEEF` JavaRandom seed first outputs.
   - Symbol char-code indexing.
   - Stage width calculation from `(level.size() / 11) << 4`.

5. Boot tests:
   - Splash appears before app mount.
   - Loading dots animate.
   - Failed resource load shows a visible error.
   - Retry settings are applied before preload.

6. Browser shell tests:
   - Menu appears first.
   - Start button starts game through a user gesture.
   - Volume slider affects `SoundStore`/audio gain.
   - Hamburger returns to menu and cleans up fullscreen/cursor/audio state.
   - Service worker registration URL contains version/build stamp in production.

7. Gameplay snapshot tests:
   - Title screen loads.
   - Demo recordings advance with correct frame counts.
   - Credits recordings advance with correct frame counts.
   - First playable stage loads with expected map dimensions.
   - A small deterministic replay produces matching core state snapshots frame by frame once Java-side snapshot tooling exists.

## Conversion Order

Recommended order:

1. Create project shell, version source, PWA manifest, service worker, splash/menu DOM, and asset folder layout.
2. Add `JavaMath.ts` and char/stage helper conventions.
3. Copy all assets exactly.
4. Wire `ResourceLoader.setCacheBust(...)` and `setRetryOptions(...)`.
5. Port data/simple support classes: `Region`, `StageSegment`, `StairsEntry`, `Checkpoint`, `ThingStack`.
6. Port `Thing`.
7. Port `Simon`.
8. Port small entities/effects/projectiles.
9. Port bosses/spawners/platforms.
10. Port `Song`.
11. Port `Main`.
12. Preserve local `ScalableGame2.ts` and `AppletGameContainer2.ts` as parity files/adapters.
13. Add audits and tests after each cluster.
14. Run browser smoke tests after `Main` can boot.

## Sources Used

Local sources:

- `C:\NetBeansProjects\stickvania\src\stickvania`
- `C:\NetBeansProjects\stickvania\src\images`
- `C:\NetBeansProjects\stickvania\src\music`
- `C:\NetBeansProjects\stickvania\src\soundfx`
- `C:\NetBeansProjects\stickvania\src\recordings`
- `C:\NetBeansProjects\stickvania\src\stages`
- `C:\js-projects\slick2d-ts\src`
- `C:\js-projects\slick2d-ts\docs\SLICK2D-PARITY-API.md`
- `C:\js-projects\pitfall-js\src\start.ts`
- `C:\js-projects\pitfall-js\src\audio.ts`
- `C:\js-projects\pitfall-js\src\input.ts`
- `C:\js-projects\pitfall-js\src\screen.ts`
- `C:\js-projects\worst-mario-game-ever\pwa\index.html`
- `C:\js-projects\worst-mario-game-ever\pwa\src\scenes\LoadingScene.ts`
- `C:\js-projects\worst-mario-game-ever\pwa\vite.config.ts`
- `C:\js-projects\worst-mario-game-ever\pwa\src\app\ServiceWorkerRegistrar.ts`
- `C:\js-projects\worst-mario-game-ever\pwa\public\sw.js`

Browser/platform references:

- MDN `Element.requestFullscreen()`: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
- MDN autoplay guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MDN Web Audio best practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- MDN user activation: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation
- MDN JavaScript `Number`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number
- MDN `Math.trunc()`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
- MDN JavaScript expressions/operators, bitwise operators: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
