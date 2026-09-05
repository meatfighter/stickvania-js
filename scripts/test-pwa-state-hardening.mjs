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

try {
    const { SONG_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");
    const { GAME_STATE_STORAGE_KEY, hasPotentialStoredStickvaniaGameState } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");

    assert.equal(GAME_STATE_VERSION, 9);

    const snapshot = createSnapshot(SONG_FIELD_NAMES);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(snapshot), true);

    const mismatchedStage = clone(snapshot);
    mismatchedStage.stage.stageIndex = 1;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(mismatchedStage), false);

    const duplicateSong = clone(snapshot);
    duplicateSong.audio.songs.at(-1).id = duplicateSong.audio.songs[0].id;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(duplicateSong), false);

    const missingSong = clone(snapshot);
    missingSong.audio.songs.pop();
    assert.equal(isReasonableStickvaniaGameStateSnapshot(missingSong), false);

    const unsafeVelocity = clone(snapshot);
    unsafeVelocity.things.push({ id: 0, type: "Synthetic", fields: { vx: 1000000 } });
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unsafeVelocity), false);

    const unsafeVolume = clone(snapshot);
    unsafeVolume.audio.currentMusic = {
        id: "game_over",
        looped: false,
        paused: false,
        playing: false,
        playbackRate: 1,
        position: 0,
        volume: 2
    };
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unsafeVolume), false);

    const inputSnapshot = createSnapshot(SONG_FIELD_NAMES);
    inputSnapshot.inputConfigMode = createInputConfigSnapshot();
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), true);
    inputSnapshot.inputConfigMode.stepIndex = 99;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), false);

    const storage = createStorage();
    const obsolete = createPotentialSnapshot(8);
    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(obsolete));
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), null);

    const future = createPotentialSnapshot(10);
    const futureText = JSON.stringify(future);
    storage.setItem(GAME_STATE_STORAGE_KEY, futureText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), futureText);

    const oversized = "x".repeat(MAX_GAME_STATE_TEXT_LENGTH + 1);
    storage.setItem(GAME_STATE_STORAGE_KEY, oversized);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), oversized);

    console.log("Stickvania save-state hardening checks passed.");
} finally {
    await server.close();
}

function createSnapshot(songIds) {
    return {
        version: 9,
        appVersion: "test-version",
        savedAt: new Date(0).toISOString(),
        mode: 4,
        mainFields: { mode: 4, stageIndex: 0, score: 0 },
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: { stageIndex: 0 },
        things: [],
        audio: {
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            songs: songIds.map((id) => ({ id, playing: false, intro: null, loop: null }))
        }
    };
}

function createInputConfigSnapshot() {
    return {
        stepIndex: 0,
        doneDelay: 0,
        armDelay: 8,
        message: "",
        finished: false,
        draft: {
            keyJump: 45,
            keyAttack: 44,
            keyUp: 200,
            keyDown: 208,
            keyLeft: 203,
            keyRight: 205,
            controllerJump: 0,
            controllerAttack: 2,
            controllerUp: -2,
            controllerDown: -3,
            controllerLeft: -4,
            controllerRight: -5
        },
        assignedKeys: [],
        assignedControllerButtons: [],
        controllerButtonDown: new Array(64).fill(false),
        controllerUpDown: false,
        controllerDownDown: false,
        controllerLeftDown: false,
        controllerRightDown: false
    };
}

function createPotentialSnapshot(version) {
    return {
        version,
        mode: 0,
        mainFields: { mode: 0 },
        inputConfigMode: null,
        random: {},
        stage: null,
        things: [],
        audio: { songs: [] }
    };
}

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.get(String(key)) ?? null;
        },
        setItem(key, value) {
            values.set(String(key), String(value));
        },
        removeItem(key) {
            values.delete(String(key));
        }
    };
}

function clone(value) {
    return structuredClone(value);
}
