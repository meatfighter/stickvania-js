import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
    root: resolve(rootDir, "pwa"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

try {
    const { StopWatch } = await server.ssrLoadModule("/src/stickvania/StopWatch.ts");
    const { resetStopWatchMusicHold } = await server.ssrLoadModule("/src/stickvania/StopWatchMusicHold.ts");

    resetStopWatchMusicHold();

    const simon = {
        dead: 0,
        hurt: false,
        flashing: 0,
        y: 100,
        onStairs: false,
        whipping: true,
        throwing: false,
        whipIncrementor: 25,
        whipIndex: 2,
        releasedWhip: false
    };
    const before = {
        whipping: simon.whipping,
        throwing: simon.throwing,
        whipIncrementor: simon.whipIncrementor,
        whipIndex: simon.whipIndex,
        releasedWhip: simon.releasedWhip
    };
    const main = {
        mode: 4,
        playerPower: 16,
        simon,
        beatStageFlag: true,
        floorBreaking: false,
        time: 100,
        timeFrozen: 455,
        stageIndex: 0,
        enemyPower: 16,
        regionThingStack: { top: -1, things: [] },
        regionStackSwap: { top: -1, things: [] },
        currentSong: null,
        requestedSong: null,
        boss_1: null,
        boss_2: null,
        ending: null,
        stage_1_1: null,
        stage_1_2: null,
        stage_2_1: null,
        stage_3_1: null,
        stage_4_1: null,
        stage_4_2: null,
        stage_5_1: null,
        stage_6_1: null,
        stage_6_2: null
    };

    const watch = Object.create(StopWatch.prototype);
    Object.assign(watch, {
        main,
        lifeTime: 455,
        x: 0,
        y: -10000,
        kill: false
    });

    assert.equal(watch.update(null), false, "stage-clear tally must terminate an active StopWatch");
    assert.equal(watch.lifeTime, 0);
    assert.equal(main.timeFrozen, 0, "StopWatch must release its entire remaining time contribution");
    assert.deepEqual(
        {
            whipping: simon.whipping,
            throwing: simon.throwing,
            whipIncrementor: simon.whipIncrementor,
            whipIndex: simon.whipIndex,
            releasedWhip: simon.releasedWhip
        },
        before,
        "StopWatch cleanup must not mutate the independently frozen Simon action pose"
    );

    console.log("Stage-clear StopWatch cancellation/action-preservation regression passed.");
} finally {
    await server.close();
}
