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
    const { getBrowserStorageKey } = await server.ssrLoadModule("/src/stickvania/BrowserStorageKeys.ts");
    const { InputConfigMode } = await server.ssrLoadModule("/src/stickvania/InputConfigMode.ts");
    const { isReasonableStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSanity.ts");
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } = await server.ssrLoadModule(
        "/src/stickvania/persistence/GameStateSchema.ts"
    );
    const { hasPotentialStoredStickvaniaGameState } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");
    const { THING_STATE_FIELD_NAMES, THING_PERSISTED_STATE_FIELD_NAMES } = await server.ssrLoadModule(
        "/src/stickvania/persistence/StateFieldRegistry.generated.ts"
    );
    const { THING_TRANSIENT_STATE_FIELDS } = await server.ssrLoadModule("/src/stickvania/persistence/ThingStateFieldPolicy.ts");

    assert.equal(GAME_STATE_VERSION, 17);
    assert.match(GAME_STATE_STORAGE_KEY, /game-state-v17$/);

    assert.deepEqual(Array.from(THING_TRANSIENT_STATE_FIELDS.Simon), ["releasedJump", "releasedKneel", "releasedWhip"]);
    for (const field of THING_TRANSIENT_STATE_FIELDS.Simon) {
        assert.equal(THING_STATE_FIELD_NAMES.Simon.includes(field), true, `${field} remains a real Simon runtime field`);
        assert.equal(THING_PERSISTED_STATE_FIELD_NAMES.Simon.includes(field), false, `${field} must not be durable save state`);
    }

    assert.equal(ButtonMapping.isValidControllerActionBinding(63), true);
    assert.equal(ButtonMapping.isValidControllerActionBinding(64), false);
    assert.equal(ButtonMapping.isValidControllerBinding(63), true);
    assert.equal(ButtonMapping.isValidControllerBinding(64), false);

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

    const liveInputConfigSnapshot = createInputConfigSnapshot();
    assert.equal(serializer.isInputConfigSnapshotShape(liveInputConfigSnapshot), true);
    const validCompletedInputConfig = createInputConfigSnapshot();
    validCompletedInputConfig.stepIndex = 1;
    validCompletedInputConfig.armDelay = 0;
    validCompletedInputConfig.assignedKeys = [200];
    assert.equal(serializer.isInputConfigSnapshotShape(validCompletedInputConfig), true);

    const staleCompletedInputConfig = clone(validCompletedInputConfig);
    staleCompletedInputConfig.assignedKeys = [999];
    assert.equal(serializer.isInputConfigSnapshotShape(staleCompletedInputConfig), false);

    const reservedDraftKey = createInputConfigSnapshot();
    reservedDraftKey.draft.keyJump = 1;
    assert.equal(serializer.isInputConfigSnapshotShape(reservedDraftKey), false);

    const dpadActionDraft = createInputConfigSnapshot();
    dpadActionDraft.draft.controllerJump = 12;
    assert.equal(serializer.isInputConfigSnapshotShape(dpadActionDraft), false);

    const duplicateDraftKey = createInputConfigSnapshot();
    duplicateDraftKey.draft.keyAttack = duplicateDraftKey.draft.keyJump;
    assert.equal(serializer.isInputConfigSnapshotShape(duplicateDraftKey), false);

    const duplicateDraftController = createInputConfigSnapshot();
    duplicateDraftController.draft.controllerAttack = duplicateDraftController.draft.controllerJump;
    assert.equal(serializer.isInputConfigSnapshotShape(duplicateDraftController), false);

    const duplicateCompletedInputConfig = clone(validCompletedInputConfig);
    duplicateCompletedInputConfig.stepIndex = 2;
    duplicateCompletedInputConfig.assignedKeys = [200, 200];
    assert.equal(serializer.isInputConfigSnapshotShape(duplicateCompletedInputConfig), false);


    assert.deepEqual(
        Object.keys(liveInputConfigSnapshot).sort(),
        ["armDelay", "assignedControllerButtons", "assignedKeys", "doneDelay", "draft", "finished", "message", "stepIndex"].sort(),
        "save state must exclude physical controller-down edge state"
    );

    let heldControllerButtonForDuplicate = -1;
    const liveInput = {
        setAdditionalControllerDirectionAxes() {},
        addKeyListener() {},
        removeKeyListener() {},
        getControllerCount: () => 1,
        getButtonCount: () => 17,
        isControllerUp: () => false,
        isControllerDown: () => false,
        isControllerLeft: () => false,
        isControllerRight: () => false,
        isButtonPressed: (button) => button === heldControllerButtonForDuplicate,
        clearKeyPressedRecord() {},
        clearControlPressedRecord() {}
    };
    const liveMain = {
        buttonMapping: new ButtonMapping(),
        pressed_enter: {},
        playSound() {},
        clearInputPressedRecords() {}
    };
    const liveInputConfig = new InputConfigMode(liveMain);
    liveInputConfig.init({ getInput: () => liveInput });
    liveInputConfig.armDelay = 0;
    for (const key of [200, 208, 203, 205]) {
        liveInputConfig.keyPressed(key, "");
    }
    assert.equal(liveInputConfig.stepIndex, 4); // JUMP
    assert.deepEqual(liveInputConfig.createSnapshot().assignedKeys, [200, 208, 203, 205]);

    heldControllerButtonForDuplicate = 0;
    liveInputConfig.bindControllerInputPressed();
    assert.equal(liveInputConfig.stepIndex, 5);
    assert.deepEqual(liveInputConfig.createSnapshot().assignedControllerButtons, [0]);

    heldControllerButtonForDuplicate = -1;
    liveInputConfig.bindControllerInputPressed();
    heldControllerButtonForDuplicate = 0;
    liveInputConfig.bindControllerInputPressed();
    assert.equal(liveInputConfig.stepIndex, 5, "duplicate JUMP/ATTACK controller button must not advance the input-config step");
    assert.equal(liveInputConfig.message, "ALREADY USED");

    const capturedRuntimeInputConfig = liveInputConfig.createSnapshot();
    assert.equal(capturedRuntimeInputConfig.message, "ALREADY USED");
    assert.deepEqual(capturedRuntimeInputConfig.assignedKeys, [200, 208, 203, 205]);
    assert.deepEqual(capturedRuntimeInputConfig.assignedControllerButtons, [0]);
    assert.equal(Object.hasOwn(capturedRuntimeInputConfig, "controllerButtonDown"), false);
    assert.equal(serializer.isInputConfigSnapshotShape(capturedRuntimeInputConfig), true, "duplicate-button runtime snapshot must validate");

    const restoredInputConfig = new InputConfigMode({
        buttonMapping: new ButtonMapping(),
        clearInputPressedRecords() {}
    });
    let heldControllerButton = 0;
    const restoredInput = {
        setAdditionalControllerDirectionAxes() {},
        addKeyListener() {},
        removeKeyListener() {},
        getControllerCount: () => 1,
        getButtonCount: () => 17,
        isControllerUp: () => false,
        isControllerDown: () => false,
        isControllerLeft: () => false,
        isControllerRight: () => false,
        isButtonPressed: (button) => button === heldControllerButton
    };
    restoredInputConfig.restoreSnapshot({ getInput: () => restoredInput }, capturedRuntimeInputConfig);
    const roundTrippedInputConfig = restoredInputConfig.createSnapshot();
    assert.equal(roundTrippedInputConfig.message, "ALREADY USED");
    assert.deepEqual(roundTrippedInputConfig.assignedKeys, [200, 208, 203, 205]);
    assert.deepEqual(roundTrippedInputConfig.assignedControllerButtons, [0]);
    assert.equal(Object.hasOwn(roundTrippedInputConfig, "controllerButtonDown"), false);
    assert.equal(serializer.isInputConfigSnapshotShape(roundTrippedInputConfig), true, "restored input-config state must remain valid");

    assert.equal(
        restoredInputConfig.getPressedNonDirectionalControllerButton(),
        ButtonMapping.NO_BINDING,
        "controller state present at restore time must become the baseline, not a fresh binding"
    );
    heldControllerButton = -1;
    restoredInputConfig.resyncControllerStateAfterBrowserResume();
    heldControllerButton = 1;
    assert.equal(
        restoredInputConfig.getPressedNonDirectionalControllerButton(),
        1,
        "a button pressed after browser resume must still produce a fresh input-config edge"
    );

    const inputSnapshot = createSnapshot(SONG_FIELD_NAMES, GAME_STATE_VERSION);
    inputSnapshot.inputConfigMode = createInputConfigSnapshot();
    inputSnapshot.inputConfigMode.message = "ALREADY USED";
    assert.equal(isReasonableStickvaniaGameStateSnapshot(inputSnapshot), true, "sanity validation must accept logical input-config state");

    const transientFieldSnapshot = clone(inputSnapshot);
    transientFieldSnapshot.inputConfigMode.controllerButtonDown = [];
    assert.equal(
        isReasonableStickvaniaGameStateSnapshot(transientFieldSnapshot),
        false,
        "obsolete physical controller-edge fields must not be accepted by the current schema"
    );

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

    const invalidInputPreflight = createPotentialSnapshot(GAME_STATE_VERSION);
    invalidInputPreflight.mode = 10;
    invalidInputPreflight.mainFields.mode = 10;
    invalidInputPreflight.inputConfigMode = createInputConfigSnapshot();
    invalidInputPreflight.inputConfigMode.stepIndex = 1;
    invalidInputPreflight.inputConfigMode.armDelay = 0;
    invalidInputPreflight.inputConfigMode.assignedKeys = [999];
    const invalidInputPreflightText = JSON.stringify(invalidInputPreflight);
    storage.setItem(GAME_STATE_STORAGE_KEY, invalidInputPreflightText);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), invalidInputPreflightText);

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

        const mappingKey = getBrowserStorageKey("input-mapping");
        const sameVersionSnapshot = JSON.parse(mappingStorage.getItem(mappingKey));
        sameVersionSnapshot.obsoleteField = true;
        mappingStorage.setItem(mappingKey, JSON.stringify(sameVersionSnapshot));
        const exactShapeFallback = ButtonMapping.load();
        assert.equal(exactShapeFallback.keyJump, 45, "same-version mappings with extra fields must be discarded");
        assert.equal(mappingStorage.getItem(mappingKey), null);

        mapping.keyJump = 57;
        assert.equal(mapping.save(), true);

        mapping.keyJump = 1; // Slick KEY_ESCAPE
        assert.equal(ButtonMapping.isReservedKey(1), true);
        assert.equal(ButtonMapping.isValidKeyBinding(1), false);
        assert.equal(mapping.save(), false, "reserved keys must not enter the persisted mapping store");

        mapping.keyJump = 57;
        mapping.keyAttack = 57;
        assert.equal(mapping.save(), false, "duplicate key mappings must not be persisted");

        mapping.keyAttack = 44;
        mapping.controllerJump = 12;
        assert.equal(mapping.save(), false, "standard D-pad buttons must not be persisted as action bindings");
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
        assignedControllerButtons: []
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
