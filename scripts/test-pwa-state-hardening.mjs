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
    const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } = await server.ssrLoadModule(
        "/src/stickvania/persistence/GameStateSchema.ts"
    );
    const { hasPotentialStoredStickvaniaGameState } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");

    assert.equal(GAME_STATE_VERSION, 12);
    assert.match(GAME_STATE_STORAGE_KEY, /game-state-v12$/);

    const serializer = new StickvaniaGameStateSerializer();
    assert.equal(serializer.isThingIdArray([null, 0], 1), true);
    assert.equal(serializer.isThingIdArray([1], 1), false);
    assert.equal(serializer.isThingIdArray([-1], 1), false);
    assert.equal(serializer.isThingIdArray([0.5], 1), false);
    assert.equal(serializer.isThingIdArray([Number.NaN], 1), false);

    const snapshot = createSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
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

    const invalidCurrentSong = clone(snapshot);
    invalidCurrentSong.audio.currentSong = "not-a-song";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(invalidCurrentSong), false);

    const orphanedCurrentSong = createSongOwnershipSnapshot(snapshot, "boss_1", null, "boss_1");
    assert.equal(isReasonableStickvaniaGameStateSnapshot(orphanedCurrentSong), false);

    const currentSongNotPlaying = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_1", null);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(currentSongNotPlaying), false);

    const twoLogicalSongsPlaying = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_1", "boss_1");
    twoLogicalSongsPlaying.audio.songs.find((song) => song.id === "boss_2").playing = true;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(twoLogicalSongsPlaying), false);

    const songAndStandaloneBothOwned = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_1", "boss_1");
    songAndStandaloneBothOwned.audio.currentMusic = {
        id: "dracula_dead",
        playback: createPlayback({ transport: "paused" })
    };
    assert.equal(isReasonableStickvaniaGameStateSnapshot(songAndStandaloneBothOwned), false);

    const pendingSongHandoff = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_2", "boss_1");
    pendingSongHandoff.audio.songs.find((song) => song.id === "boss_1").intro.playback.transport = "playing";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(pendingSongHandoff), true);

    const requestedSongWithoutCurrent = createSongOwnershipSnapshot(snapshot, null, "boss_2", null);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(requestedSongWithoutCurrent), true);

    const impossibleDeferredSongStart = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_1", "boss_1");
    assert.equal(isReasonableStickvaniaGameStateSnapshot(impossibleDeferredSongStart), false);

    const deferredCurrentSongStart = createSongOwnershipSnapshot(createStopWatchAggregateSnapshot(snapshot, 455, [0], []), "boss_1", "boss_1", "boss_1");
    assert.equal(isReasonableStickvaniaGameStateSnapshot(deferredCurrentSongStart), true);

    const mismatchedSongPart = clone(snapshot);
    mismatchedSongPart.audio.songs.find((song) => song.id === "boss_1").intro.id = "boss_2.intro";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(mismatchedSongPart), false);

    const contradictoryTracks = clone(snapshot);
    contradictoryTracks.audio.songs.find((song) => song.id === "boss_1").intro.playback.transport = "playing";
    contradictoryTracks.audio.songs.find((song) => song.id === "boss_2").intro.playback.transport = "playing";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(contradictoryTracks), false);

    const unsafeVelocity = clone(snapshot);
    unsafeVelocity.things.push({ id: 0, type: "Synthetic", fields: { vx: 1000000 } });
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unsafeVelocity), false);

    const unsafeVolume = clone(snapshot);
    unsafeVolume.audio.currentMusic = {
        id: "game_over",
        playback: createPlayback({ volume: 2 })
    };
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unsafeVolume), false);

    const maxStopWatchLifetime = clone(snapshot);
    maxStopWatchLifetime.things.push({ id: 0, type: "StopWatch", fields: { lifeTime: 455 } });
    assert.equal(isReasonableStickvaniaGameStateSnapshot(maxStopWatchLifetime), true);

    const excessiveStopWatchLifetime = clone(snapshot);
    excessiveStopWatchLifetime.things.push({ id: 0, type: "StopWatch", fields: { lifeTime: 456 } });
    assert.equal(isReasonableStickvaniaGameStateSnapshot(excessiveStopWatchLifetime), false);

    const negativeStopWatchLifetime = clone(snapshot);
    negativeStopWatchLifetime.things.push({ id: 0, type: "StopWatch", fields: { lifeTime: -1 } });
    assert.equal(isReasonableStickvaniaGameStateSnapshot(negativeStopWatchLifetime), false);

    const validStopWatchAggregate = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(validStopWatchAggregate), true);

    const staleStopWatchAggregate = createStopWatchAggregateSnapshot(snapshot, 455, [], []);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(staleStopWatchAggregate), false);

    const duplicateStopWatchReference = createStopWatchAggregateSnapshot(snapshot, 455, [0], [0]);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(duplicateStopWatchReference), false);

    const inputSnapshot = createSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
    inputSnapshot.inputConfigMode = createInputConfigSnapshot();
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), true);
    inputSnapshot.inputConfigMode.stepIndex = 99;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), false);

    const storage = createStorage();

    const future = createPotentialSnapshot(GAME_STATE_VERSION + 1);
    const futureText = JSON.stringify(future);
    storage.setItem(GAME_STATE_STORAGE_KEY, futureText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), futureText);

    const malformed = "{";
    storage.setItem(GAME_STATE_STORAGE_KEY, malformed);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), malformed);

    const oversized = "x".repeat(MAX_GAME_STATE_TEXT_LENGTH + 1);
    storage.setItem(GAME_STATE_STORAGE_KEY, oversized);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), oversized);

    // Space (Slick key code 57) is now an ordinary browser gameplay binding. Prove
    // that it survives the real ButtonMapping save/load path rather than merely
    // checking that the reserved-key predicate changed.
    const oldLocalStorage = globalThis.localStorage;
    const mappingStorage = createStorage();
    globalThis.localStorage = mappingStorage;
    try {
        const { ButtonMapping } = await server.ssrLoadModule("/src/stickvania/ButtonMapping.ts");
        const mapping = new ButtonMapping();
        mapping.keyJump = 57;
        assert.equal(ButtonMapping.isReservedKey(57), false);
        assert.equal(mapping.save(), true);
        const restored = ButtonMapping.load();
        assert.equal(restored.keyJump, 57);
        assert.equal(restored.keyboardLabelFor("JUMP"), "SPACE");
    } finally {
        if (oldLocalStorage === undefined) {
            delete globalThis.localStorage;
        } else {
            globalThis.localStorage = oldLocalStorage;
        }
    }

    console.log("Stickvania save-state and input-mapping hardening checks passed.");
} finally {
    await server.close();
}

function createSnapshot(songIds, version) {
    return {
        version,
        appVersion: "test-version",
        savedAt: new Date(0).toISOString(),
        mode: 4,
        mainFields: { mode: 4, stageIndex: 0, score: 0 },
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: { stageIndex: 0 },
        things: [],
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

function createSongOwnershipSnapshot(base, currentSong, requestedSong, playingSong) {
    const snapshot = clone(base);
    snapshot.audio.currentSong = currentSong;
    snapshot.audio.requestedSong = requestedSong;
    if (playingSong !== null) {
        snapshot.audio.songs.find((song) => song.id === playingSong).playing = true;
    }
    return snapshot;
}

function createStopWatchAggregateSnapshot(base, timeFrozen, weapons, weaponsSwap) {
    const snapshot = clone(base);
    snapshot.mainFields.timeFrozen = timeFrozen;
    snapshot.mainFields.playerPower = 16;
    snapshot.mainFields.beatStageFlag = false;
    snapshot.things = [{ id: 0, type: "StopWatch", fields: { lifeTime: 455 } }];
    snapshot.stage.weaponsStack = createThingStack(weapons);
    snapshot.stage.weaponsStackSwap = createThingStack(weaponsSwap);
    return snapshot;
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
              playback: createPlayback({ looped: suffix === "loop" })
          }
        : null;
}

function createPlayback(overrides = {}) {
    return {
        transport: "stopped",
        looped: false,
        playbackRate: 1,
        positionSeconds: 0,
        volume: 1,
        fade: null,
        ...overrides
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
        audio: { musicOn: true, soundOn: true, songs: [] }
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
