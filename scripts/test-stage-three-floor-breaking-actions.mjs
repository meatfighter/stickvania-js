import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pwaRoot = resolve(rootDir, "pwa");
const server = await createServer({
    root: pwaRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

const MUSIC_IDS = new Set([
    "boss_1.intro",
    "boss_1.loop",
    "boss_2.intro",
    "boss_2.loop",
    "ending.loop",
    "stage_1_1.loop",
    "stage_1_2.intro",
    "stage_1_2.loop",
    "stage_2_1.intro",
    "stage_2_1.loop",
    "stage_3_1.intro",
    "stage_3_1.loop",
    "stage_4_1.loop",
    "stage_4_2.loop",
    "stage_5_1.intro",
    "stage_5_1.loop",
    "stage_6_1.loop",
    "stage_6_2.intro",
    "stage_6_2.loop"
]);

function createStack(initial = []) {
    const values = [...initial];
    return {
        top: values.length - 1,
        things: values,
        pop() {
            const value = values.length === 0 ? null : values.pop();
            this.top = values.length - 1;
            return value;
        },
        push(value) {
            values.push(value);
            this.top = values.length - 1;
        }
    };
}

function createActionMain(overrides = {}) {
    return {
        mode: 4,
        fadeState: 0,
        playerPower: 16,
        simon: { dead: 0, hurt: false, flashing: 0, y: 100, onStairs: false },
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        stageIndex: 0,
        enemyPower: 16,
        timeFrozen: 0,
        hearts: 0,
        door: null,
        regionThingStack: createStack(),
        regionStackSwap: createStack(),
        currentSong: null,
        requestedSong: null,
        ...overrides
    };
}

function createFrameMain(Main, registerPlayerActionMain, prepareRegisteredCountdownTimer, overrides = {}) {
    const main = Object.create(Main.prototype);
    const twang = { id: "twang" };
    Object.assign(main, {
        currentSong: null,
        requestedSong: null,
        currentMusic: null,
        mode: Main.MODE_PLAYING,
        fadeState: Main.FADE_DONE,
        fade: 0,
        fadeReason: 0,
        beatStageFlag: false,
        beatStageDelay: 0,
        floorBreaking: false,
        playerPower: 16,
        enemyPower: 16,
        time: 100,
        timeIncrementor: 0,
        timeFrozen: 0,
        hearts: 0,
        score: 0,
        simon: { dead: 0, flashing: 0, x: 0, y: 100, lastX: 0, lastY: 100 },
        door: null,
        repeatsFlashing: 0,
        killAllFlag: false,
        regionThingStack: createStack(),
        regionStackSwap: createStack(),
        weaponsStack: createStack(),
        weaponsStackSwap: createStack(),
        platforms: [],
        twang,
        playedSounds: [],
        timeoutDamage: [],
        syncSimonPhysicsProfile() {},
        updateSimon() {},
        moveCamera() {},
        playSound(sound) {
            this.playedSounds.push(sound);
        },
        hurtSimon(power) {
            this.timeoutDamage.push(power);
        },
        addPoints(points) {
            this.score += points;
        },
        ...overrides
    });
    registerPlayerActionMain(main);
    main.controlInput = {
        update() {
            prepareRegisteredCountdownTimer();
        }
    };
    return main;
}

function createFloorBreakingWatchSnapshot(songIds, version, overrides = {}) {
    const mainFields = {
        mode: 4,
        stageIndex: 2,
        score: 0,
        time: 0,
        timeIncrementor: 90,
        timeFrozen: 455,
        playerPower: 16,
        enemyPower: 0,
        beatStageFlag: false,
        floorBreaking: true,
        ...overrides
    };
    return {
        version,
        appVersion: "test-version",
        savedAt: new Date(0).toISOString(),
        mode: 4,
        mainFields,
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: {
            stageIndex: mainFields.stageIndex,
            segments: [],
            weaponsStack: createSerializedStack([0]),
            weaponsStackSwap: createSerializedStack([])
        },
        things: [{ id: 0, type: "StopWatch", fields: { lifeTime: 455 } }],
        audio: {
            musicOn: true,
            soundOn: true,
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            songs: songIds.map((id) => ({
                id,
                playing: false,
                intro: createSongPart(id, "intro"),
                loop: createSongPart(id, "loop")
            }))
        }
    };
}

function createSerializedStack(things) {
    return {
        $stack: {
            capacity: things.length,
            things
        }
    };
}

function createSongPart(songId, suffix) {
    const id = `${songId}.${suffix}`;
    return MUSIC_IDS.has(id)
        ? {
              id,
              playback: {
                  transport: "stopped",
                  looped: suffix === "loop",
                  playbackRate: 1,
                  positionSeconds: 0,
                  volume: 1,
                  fade: null
              }
          }
        : null;
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { FloorBreaker } = await server.ssrLoadModule("/src/stickvania/FloorBreaker.ts");
    const { Candles } = await server.ssrLoadModule("/src/stickvania/Candles.ts");
    const { SmallHeart } = await server.ssrLoadModule("/src/stickvania/SmallHeart.ts");
    const { SONG_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");
    const {
        canSimonActionContinue,
        isStageThreeFloorBreaking,
        prepareRegisteredCountdownTimer,
        registerPlayerActionMain
    } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    const { canStartStopWatch, canStopWatchRun } = await server.ssrLoadModule("/src/stickvania/StopWatchMusicHold.ts");
    const { isPotentialStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_VERSION } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");

    const brickBreaking = createActionMain({ stageIndex: 2, floorBreaking: true, time: 0, hearts: 0 });
    assert.equal(isStageThreeFloorBreaking(brickBreaking), true);
    assert.equal(canSimonActionContinue(brickBreaking), true, "whip/sub-weapon windup must remain legal during the stage-three brick break");
    assert.equal(canStopWatchRun(brickBreaking), true, "StopWatch must be a valid effect during the stage-three brick break");
    assert.equal(canStartStopWatch(brickBreaking), true, "a newly affordable StopWatch may start during the stage-three brick break");

    assert.equal(
        canSimonActionContinue(createActionMain({ stageIndex: 0, floorBreaking: true, time: 0 })),
        false,
        "floorBreaking must not become a generic TIME-zero action bypass"
    );
    assert.equal(
        canStopWatchRun(createActionMain({ stageIndex: 0, floorBreaking: true, time: 0 })),
        false,
        "only the real stage-three brick-break scene receives the StopWatch exception"
    );
    assert.equal(
        canSimonActionContinue(createActionMain({ stageIndex: 2, floorBreaking: true, beatStageFlag: true, time: 0 })),
        false,
        "the stage-clear tally remains non-interactive until floor breaking actually begins"
    );

    const activeWatch = createActionMain({ stageIndex: 2, floorBreaking: true, time: 0, timeFrozen: 455 });
    assert.equal(canStopWatchRun(activeWatch), true, "an active StopWatch remains alive while bricks break");
    assert.equal(canStartStopWatch(activeWatch), false, "the ordinary one-live-StopWatch rule still applies");

    const makeMain = (overrides = {}) => createFrameMain(Main, registerPlayerActionMain, prepareRegisteredCountdownTimer, overrides);

    // Stage clear converts the final remaining hearts to points before entering
    // the special stage-three brick-break scene.
    {
        const main = makeMain({ stageIndex: 2, beatStageFlag: true, beatStageDelay: 0, hearts: 2, time: 0, timeIncrementor: 90 });
        for (let i = 0; i < 40 && !main.floorBreaking; i++) {
            main.updateFrame(null);
        }
        assert.equal(main.floorBreaking, true);
        assert.equal(main.beatStageFlag, false);
        assert.equal(main.hearts, 0, "brick breaking must begin only after the stage-clear heart tally drains hearts to zero");
        assert.equal(main.time, 0, "TIME has already been converted to score before brick breaking begins");
    }

    // The post-orb countdown remains stopped throughout brick breaking. Preserve
    // its fractional phase too, regardless of whether StopWatch is active.
    for (const timeFrozen of [0, 455]) {
        const main = makeMain({ stageIndex: 2, floorBreaking: true, time: 0, timeIncrementor: 90, timeFrozen });
        for (let i = 0; i < 5; i++) {
            main.updateFrame(null);
        }
        assert.equal(main.time, 0);
        assert.equal(main.timeIncrementor, 90);
        assert.deepEqual(main.timeoutDamage, []);
        assert.deepEqual(main.playedSounds, []);
    }

    // FloorBreaker itself is not a frozen-time actor. A live StopWatch must not
    // delay its first scheduled brick removal.
    {
        const walls = Array.from({ length: 11 }, () => []);
        walls[6][144] = Main.WALL_FULL;
        const removed = [];
        const pushed = [];
        const floorMain = {
            timeFrozen: 455,
            floorBreaking: true,
            walls,
            removeBlock(x, y) {
                removed.push([x, y]);
                walls[y][x] = Main.WALL_EMPTY;
            },
            pushThing(thing) {
                pushed.push(thing);
            },
            playSound() {},
            playRumble() {}
        };
        const breaker = new FloorBreaker(floorMain);
        breaker.breakDelay = 0;
        assert.equal(breaker.update(null), true);
        assert.deepEqual(removed, [[144, 6]]);
        assert.equal(pushed.length, 4);
    }

    // Candles remain hittable and a heart obtained from one can replenish the
    // zero-heart post-tally inventory while the scene is still running.
    {
        const heartToken = { kind: "heart" };
        const pushed = [];
        const candleMain = {
            timeFrozen: 455,
            candles: [],
            hit_candle: {},
            random: {
                nextInt() {
                    return 0;
                }
            },
            intersectsWhip() {
                return true;
            },
            intersectsWeapon() {
                return false;
            },
            createCandleItem() {
                return heartToken;
            },
            pushThing(thing) {
                pushed.push(thing);
            },
            playSound() {}
        };
        const candle = new Candles(candleMain, 0, 0, Main.CANDLE_ITEM_SMALL_HEART);
        assert.equal(candle.update(null), false);
        assert.equal(pushed.includes(heartToken), true);

        const heartMain = {
            hearts: 0,
            bleep: {},
            intersectsSimon() {
                return true;
            },
            addHearts(value) {
                this.hearts += value;
            },
            playSound() {}
        };
        const heart = new SmallHeart(heartMain, 0, 0);
        assert.equal(heart.update(null), false);
        assert.equal(heartMain.hearts, 1);
    }

    const floorBreakingSave = createFloorBreakingWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
    assert.equal(isPotentialStickvaniaGameStateSnapshot(floorBreakingSave), true, "Continue preflight must accept an active StopWatch in the brick-break scene");
    assert.equal(isReasonableStickvaniaGameStateSnapshot(floorBreakingSave), true, "full save sanity must accept an active StopWatch in the brick-break scene");

    const wrongStageSave = createFloorBreakingWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION, { stageIndex: 0 });
    wrongStageSave.stage.stageIndex = 0;
    assert.equal(isPotentialStickvaniaGameStateSnapshot(wrongStageSave), false);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(wrongStageSave), false);

    const tallySave = createFloorBreakingWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION, { beatStageFlag: true });
    assert.equal(isPotentialStickvaniaGameStateSnapshot(tallySave), false);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(tallySave), false);

    const tsMain = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
    const javaMain = readFileSync(resolve(rootDir, "desktop/src/stickvania/Main.java"), "utf8");
    const tsFloorBreaker = readFileSync(resolve(rootDir, "pwa/src/stickvania/FloorBreaker.ts"), "utf8");
    const javaFloorBreaker = readFileSync(resolve(rootDir, "desktop/src/stickvania/FloorBreaker.java"), "utf8");
    const tsPolicy = readFileSync(resolve(rootDir, "pwa/src/stickvania/PlayerActionPolicy.ts"), "utf8");
    const javaPolicy = readFileSync(resolve(rootDir, "desktop/src/stickvania/PlayerActionPolicy.java"), "utf8");

    assert.match(tsMain, /else if \(this\.hearts > 0\)[\s\S]*?this\.hearts--;[\s\S]*?stageIndex == 2[\s\S]*?this\.floorBreaking = true/);
    assert.match(javaMain, /else if \(hearts > 0\)[\s\S]*?hearts--;[\s\S]*?stageIndex == 2[\s\S]*?floorBreaking = true/);
    assert.match(tsMain, /timeFrozen == 0[\s\S]*?\+\+this\.timeIncrementor == 91[\s\S]*?!this\.floorBreaking/);
    assert.match(javaMain, /timeFrozen == 0[\s\S]*?\+\+timeIncrementor == 91[\s\S]*?!floorBreaking/);
    assert.doesNotMatch(tsFloorBreaker, /timeFrozen/);
    assert.doesNotMatch(javaFloorBreaker, /timeFrozen/);
    assert.match(tsPolicy, /isStageThreeFloorBreaking[\s\S]*?stageIndex == 2 && main\.floorBreaking/);
    assert.match(javaPolicy, /isStageThreeFloorBreaking[\s\S]*?stageIndex == 2 && main\.floorBreaking/);

    console.log("Stage-three floor-breaking attack, StopWatch, candle, timer, and save-state checks passed.");
} finally {
    await server.close();
}
