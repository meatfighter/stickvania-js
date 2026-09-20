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
    const { MAX_TOTAL_SOUND_VOICES } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSoundEffects.ts");
    const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    const { ButtonMapping } = await server.ssrLoadModule("/src/stickvania/ButtonMapping.ts");
    const { ControllerSupport } = await server.ssrLoadModule("/src/stickvania/ControllerSupport.ts");
    const { InputConfigMode } = await server.ssrLoadModule("/src/stickvania/InputConfigMode.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } = await server.ssrLoadModule(
        "/src/stickvania/persistence/GameStateSchema.ts"
    );
    const { hasPotentialStoredStickvaniaGameState } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");

    assert.equal(GAME_STATE_VERSION, 16);
    assert.match(GAME_STATE_STORAGE_KEY, /game-state-v16$/);

    const serializer = new StickvaniaGameStateSerializer();
    assert.equal(serializer.isThingIdArray([null, 0], 1), true);
    assert.equal(serializer.isThingIdArray([1], 1), false);
    assert.equal(serializer.isThingIdArray([-1], 1), false);
    assert.equal(serializer.isThingIdArray([0.5], 1), false);
    assert.equal(serializer.isThingIdArray([Number.NaN], 1), false);

    const snapshot = createSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(snapshot), true);

    for (const timeIncrementor of [0, 90]) {
        const timerPhase = clone(snapshot);
        timerPhase.mainFields.timeIncrementor = timeIncrementor;
        assert.equal(isReasonableStickvaniaGameStateSnapshot(timerPhase), true, `timeIncrementor=${timeIncrementor} must remain valid`);
    }
    for (const timeIncrementor of [-1, 91, 0.5]) {
        const timerPhase = clone(snapshot);
        timerPhase.mainFields.timeIncrementor = timeIncrementor;
        assert.equal(isReasonableStickvaniaGameStateSnapshot(timerPhase), false, `timeIncrementor=${timeIncrementor} must be rejected`);
    }

    const mismatchedStage = clone(snapshot);
    mismatchedStage.stage.stageIndex = 1;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(mismatchedStage), false);

    const duplicateSong = clone(snapshot);
    duplicateSong.audio.songs.at(-1).id = duplicateSong.audio.songs[0].id;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(duplicateSong), false);

    const missingSong = clone(snapshot);
    missingSong.audio.songs.pop();
    assert.equal(isReasonableStickvaniaGameStateSnapshot(missingSong), false);

    const validSound = clone(snapshot);
    validSound.audio.sounds = [{ id: "watch_tick", playback: createSoundPlayback([createSoundVoice(0.037)], 0) }];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(validSound), true);

    const missingSounds = clone(snapshot);
    delete missingSounds.audio.sounds;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(missingSounds), false);

    const unknownSound = clone(snapshot);
    unknownSound.audio.sounds = [{ id: "not-a-sound", playback: createSoundPlayback([createSoundVoice()], 0) }];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unknownSound), false);

    const duplicateSound = clone(snapshot);
    duplicateSound.audio.sounds = [
        { id: "watch_tick", playback: createSoundPlayback([createSoundVoice(0.01)], 0) },
        { id: "watch_tick", playback: createSoundPlayback([createSoundVoice(0.02)], 0) }
    ];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(duplicateSound), false);

    const emptySparseSound = clone(snapshot);
    emptySparseSound.audio.sounds = [{ id: "watch_tick", playback: createSoundPlayback([], null) }];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(emptySparseSound), false);

    const tooManySoundVoices = clone(snapshot);
    tooManySoundVoices.audio.sounds = [
        {
            id: "heartbeat",
            playback: createSoundPlayback(
                new Array(MAX_TOTAL_SOUND_VOICES + 1).fill(null).map(() => createSoundVoice()),
                null
            )
        }
    ];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(tooManySoundVoices), false);

    const excessiveSoundPosition = clone(snapshot);
    excessiveSoundPosition.audio.sounds = [{ id: "watch_tick", playback: createSoundPlayback([createSoundVoice(86_401)], 0) }];
    assert.equal(isReasonableStickvaniaGameStateSnapshot(excessiveSoundPosition), false);

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
        playback: createPlayback({ transport: "playing" })
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

    const pausedSongWithoutWatch = createSongOwnershipSnapshot(snapshot, "boss_1", "boss_1", "boss_1");
    pausedSongWithoutWatch.audio.songs.find((song) => song.id === "boss_1").intro.playback.transport = "paused";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(pausedSongWithoutWatch), false);

    const pausedSongWithWatch = createSongOwnershipSnapshot(createStopWatchAggregateSnapshot(snapshot, 455, [0], []), "boss_1", "boss_1", "boss_1");
    pausedSongWithWatch.audio.songs.find((song) => song.id === "boss_1").intro.playback.transport = "paused";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(pausedSongWithWatch), true);

    const pausedStandaloneWithoutWatch = clone(snapshot);
    pausedStandaloneWithoutWatch.audio.currentMusic = {
        id: "dracula_dead",
        playback: createPlayback({ transport: "paused" })
    };
    assert.equal(isReasonableStickvaniaGameStateSnapshot(pausedStandaloneWithoutWatch), false);

    const pausedStandaloneWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    pausedStandaloneWithWatch.audio.currentMusic = {
        id: "dracula_dead",
        playback: createPlayback({ transport: "paused" })
    };
    assert.equal(isReasonableStickvaniaGameStateSnapshot(pausedStandaloneWithWatch), false);

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

    const deadPlayerWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    deadPlayerWithWatch.mainFields.playerPower = 0;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(deadPlayerWithWatch), false);

    const stageCompleteWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    stageCompleteWithWatch.mainFields.beatStageFlag = true;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(stageCompleteWithWatch), false);

    const floorBreakingWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    floorBreakingWithWatch.mainFields.floorBreaking = true;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(floorBreakingWithWatch), false);

    const zeroTimeWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    zeroTimeWithWatch.mainFields.time = 0;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(zeroTimeWithWatch), false);

    const draculaDeadWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    draculaDeadWithWatch.mainFields.stageIndex = 5;
    draculaDeadWithWatch.stage.stageIndex = 5;
    draculaDeadWithWatch.mainFields.enemyPower = 0;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(draculaDeadWithWatch), false);

    const finalStageOneHpWithWatch = createStopWatchAggregateSnapshot(snapshot, 455, [0], []);
    finalStageOneHpWithWatch.mainFields.stageIndex = 5;
    finalStageOneHpWithWatch.stage.stageIndex = 5;
    finalStageOneHpWithWatch.mainFields.enemyPower = 1;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(finalStageOneHpWithWatch), true);

    const runtimeSizedInputConfig = createInputConfigSnapshot(17);
    runtimeSizedInputConfig.message = "ALREADY USED";
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(runtimeSizedInputConfig.controllerButtonDown), true);
    assert.equal(serializer.isInputConfigSnapshotShape(runtimeSizedInputConfig), true, "runtime-sized controller edge state must be saveable");

    const noControllerInputConfig = createInputConfigSnapshot(0);
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(noControllerInputConfig.controllerButtonDown), true);
    assert.equal(serializer.isInputConfigSnapshotShape(noControllerInputConfig), true, "keyboard-only input config must be saveable");

    const maximumControllerState = createInputConfigSnapshot(64);
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(maximumControllerState.controllerButtonDown), true);
    assert.equal(serializer.isInputConfigSnapshotShape(maximumControllerState), true, "the runtime scan limit must remain saveable");

    const oversizedControllerState = createInputConfigSnapshot(65);
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(oversizedControllerState.controllerButtonDown), false);
    assert.equal(serializer.isInputConfigSnapshotShape(oversizedControllerState), false, "controller edge state must remain bounded");

    const invalidControllerState = createInputConfigSnapshot(17);
    invalidControllerState.controllerButtonDown[3] = 1;
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(invalidControllerState.controllerButtonDown), false);
    assert.equal(serializer.isInputConfigSnapshotShape(invalidControllerState), false, "controller edge state entries must remain boolean");

    const sparseControllerState = createInputConfigSnapshot(17);
    delete sparseControllerState.controllerButtonDown[3];
    assert.equal(ControllerSupport.isValidButtonDownSnapshot(sparseControllerState.controllerButtonDown), false);
    assert.equal(serializer.isInputConfigSnapshotShape(sparseControllerState), false, "sparse controller edge state must be rejected");

    const liveInputConfig = new InputConfigMode({
        buttonMapping: new ButtonMapping(),
        clearInputPressedRecords() {}
    });
    liveInputConfig.draft = liveInputConfig.createDraft();
    assert.equal(liveInputConfig.bindControllerButton(0), true);
    liveInputConfig.stepIndex++;
    assert.equal(liveInputConfig.bindControllerButton(0), false, "pressing the same gamepad button twice must be rejected");
    liveInputConfig.message = "ALREADY USED";
    liveInputConfig.controllerButtonDown = new Array(17).fill(false);
    liveInputConfig.controllerButtonDown[0] = true;
    const capturedRuntimeInputConfig = liveInputConfig.createSnapshot();
    assert.equal(capturedRuntimeInputConfig.controllerButtonDown.length, 17, "capture must preserve the runtime controller scan length");
    assert.equal(capturedRuntimeInputConfig.message, "ALREADY USED");
    assert.deepEqual(capturedRuntimeInputConfig.assignedControllerButtons, [0]);
    assert.equal(serializer.isInputConfigSnapshotShape(capturedRuntimeInputConfig), true, "a duplicate-button runtime snapshot must validate");

    const inputSnapshot = createSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
    inputSnapshot.inputConfigMode = createInputConfigSnapshot(17);
    inputSnapshot.inputConfigMode.message = "ALREADY USED";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), true, "sanity validation must accept runtime-sized input-config state");

    const unreasonableInputButtonState = clone(inputSnapshot);
    unreasonableInputButtonState.inputConfigMode.controllerButtonDown = new Array(65).fill(false);
    assert.equal(isReasonableStickvaniaGameStateSnapshot(unreasonableInputButtonState), false);

    inputSnapshot.inputConfigMode.stepIndex = 99;
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), false);

    const storage = createStorage();

    const obsolete = createPotentialSnapshot(GAME_STATE_VERSION - 1);
    const obsoleteText = JSON.stringify(obsolete);
    storage.setItem(GAME_STATE_STORAGE_KEY, obsoleteText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), obsoleteText);

    const future = createPotentialSnapshot(GAME_STATE_VERSION + 1);
    const futureText = JSON.stringify(future);
    storage.setItem(GAME_STATE_STORAGE_KEY, futureText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), futureText);

    const missingPreflightSounds = createPotentialSnapshot(GAME_STATE_VERSION);
    delete missingPreflightSounds.audio.sounds;
    const missingPreflightText = JSON.stringify(missingPreflightSounds);
    storage.setItem(GAME_STATE_STORAGE_KEY, missingPreflightText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), missingPreflightText);

    const obsoleteAudioPolicy = createPotentialSnapshot(GAME_STATE_VERSION);
    obsoleteAudioPolicy.audio.musicOn = false;
    obsoleteAudioPolicy.audio.soundOn = true;
    const obsoleteAudioPolicyText = JSON.stringify(obsoleteAudioPolicy);
    storage.setItem(GAME_STATE_STORAGE_KEY, obsoleteAudioPolicyText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), obsoleteAudioPolicyText);

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
        mainFields: {
            mode: 4,
            stageIndex: 0,
            score: 0,
            time: 300,
            timeIncrementor: 0,
            timeFrozen: 0,
            playerPower: 16,
            enemyPower: 16,
            beatStageFlag: false,
            floorBreaking: false
        },
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: { stageIndex: 0 },
        things: [],
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

function createSoundVoice(positionSeconds = 0.01, overrides = {}) {
    return {
        looped: false,
        playbackRate: 1,
        positionSeconds,
        gain: 1,
        spatialPosition: null,
        ...overrides
    };
}

function createSoundPlayback(voices, activeVoiceIndex = voices.length === 0 ? null : voices.length - 1) {
    return { voices, activeVoiceIndex };
}

function createInputConfigSnapshot(controllerButtonCount = 64) {
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
        controllerButtonDown: new Array(controllerButtonCount).fill(false),
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
        audio: { songs: [], sounds: [] }
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
