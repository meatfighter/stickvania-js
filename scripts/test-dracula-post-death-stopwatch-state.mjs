import assert from "node:assert/strict";
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

try {
    const { SONG_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_VERSION } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");

    const hiddenOrb = createFinalStageWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION, 1);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(hiddenOrb), false, "an active StopWatch remains invalid while Dracula's final orb is hidden");

    const visibleOrb = createFinalStageWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION, 0);
    assert.equal(
        isReasonableStickvaniaGameStateSnapshot(visibleOrb),
        true,
        "an active StopWatch becomes a valid save state once Dracula's final orb is visible"
    );

    const collectedOrb = createFinalStageWatchSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION, 0);
    collectedOrb.mainFields.beatStageFlag = true;
    assert.equal(
        isReasonableStickvaniaGameStateSnapshot(collectedOrb),
        false,
        "stage completion remains terminal even after the final orb made StopWatch valid"
    );

    console.log("Dracula post-death StopWatch save-state checks passed.");
} finally {
    await server.close();
}

function createFinalStageWatchSnapshot(songIds, version, appearDelay) {
    return {
        version,
        appVersion: "test-version",
        savedAt: new Date(0).toISOString(),
        mode: 4,
        mainFields: {
            mode: 4,
            stageIndex: 5,
            score: 0,
            time: 300,
            timeIncrementor: 0,
            playerPower: 16,
            enemyPower: 0,
            beatStageFlag: false,
            floorBreaking: false
        },
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: {
            stageIndex: 5,
            weaponsStack: createThingStack([0]),
            weaponsStackSwap: createThingStack([])
        },
        things: [
            { id: 0, type: "StopWatch", fields: { lifeTime: 455 } },
            { id: 1, type: "Orb", fields: { appearDelay } }
        ],
        audio: {
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            songs: songIds.map((id) => ({
                id,
                playing: false,
                intro: createSongPart(id, "intro"),
                loop: createSongPart(id, "loop")
            })),
            sounds: []
        }
    };
}

function createThingStack(things) {
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
