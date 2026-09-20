import { GameContainer, JavaRandom, Music, isMusicPlaybackSnapshot } from "slick2d-ts";
import { Checkpoint } from "../Checkpoint.js";
import { isInputConfigModeSnapshot, type InputConfigModeSnapshot } from "../InputConfigMode.js";
import { Main } from "../Main.js";
import { Region } from "../Region.js";
import { Song } from "../Song.js";
import { StageSegment } from "../StageSegment.js";
import { StairsEntry } from "../StairsEntry.js";
import { Thing } from "../Thing.js";
import { ThingStack } from "../ThingStack.js";
import {
    type AudioSnapshot,
    type EncodedRecord,
    type EncodedValue,
    type JsonRecord,
    type JsonValue,
    type MusicId,
    type MusicSnapshot,
    type RandomSnapshot,
    type RegionSnapshot,
    type SegmentSnapshot,
    type SongId,
    type SongSnapshot,
    type StageSnapshot,
    type StickvaniaGameStateSnapshot,
    type ThingSnapshot,
    type ThingStackSnapshot
} from "./GameStateSnapshot.js";
import { GAME_STATE_VERSION } from "./GameStateSchema.js";
import { captureSoundEffects, isSoundEffectSnapshotsShape, restoreSoundEffects } from "./GameStateSoundEffects.js";
import { MAIN_PERSISTED_STATE_FIELD_NAMES, THING_PERSISTED_STATE_FIELD_NAMES } from "./StateFieldRegistry.generated.js";
import {
    isPersistedMainFieldValuesValid,
    isPersistedThingFieldValuesValid
} from "./StateFieldValuePolicy.js";
import { getThingTypeId, isThingTypeId, THING_TYPES, type ThingTypeId } from "./ThingTypeRegistry.js";
import { rehydrateThingAfterStateRestore } from "./ThingRehydrationRegistry.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";
import { SONG_FIELD_NAMES, STANDALONE_MUSIC_FIELD_NAMES } from "../AudioRegistry.js";

type FieldBag = Record<string, unknown>;

type CaptureContext = {
    main: Main;
    stageSegments: StageSegment[];
    segmentIndexes: Map<StageSegment, number>;
    regionIndexes: Map<Region, [number, number]>;
    stairsIndexes: Map<StairsEntry, [number, number]>;
    thingIds: Map<Thing, number>;
    things: Thing[];
};

type RestoreContext = {
    main: Main;
    gc: GameContainer;
    stageSegments: StageSegment[];
    thingById: Map<number, Thing>;
};

type SnapshotReferenceLimits = {
    thingCount: number;
    segmentCount: number;
    regionCounts: number[];
    stairsCounts: number[] | null;
};

const SONG_IDS: SongId[] = [...SONG_FIELD_NAMES];
const STANDALONE_MUSIC_IDS: MusicId[] = [...STANDALONE_MUSIC_FIELD_NAMES];

const EXPECTED_STAGE_SEGMENT_COUNTS = [2, 4, 3, 2, 4, 3];
const MAX_SAVED_STACK_CAPACITY = 4096;
const SONG_ID_SET = new Set<string>(SONG_IDS);
const MUSIC_IDS: MusicId[] = [
    ...STANDALONE_MUSIC_IDS,
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
];
const MUSIC_ID_SET = new Set<string>(MUSIC_IDS);

export class StickvaniaGameStateSerializer {
    public createSnapshot(main: Main, appVersion: string): StickvaniaGameStateSnapshot {
        if (!main.isStateSaveReady()) {
            throw new Error("Game state is not ready to save.");
        }

        const captureStage = main.shouldCaptureStageForStateSave();
        const context = this.createCaptureContext(main);
        const stage = captureStage ? this.captureStage(context) : null;
        const things: ThingSnapshot[] = stage === null ? [] : context.things.map((thing, id) => this.captureThing(context, thing, id));

        return {
            version: GAME_STATE_VERSION,
            appVersion,
            savedAt: new Date().toISOString(),
            mode: this.snapshotMode(main),
            mainFields: this.captureMainFields(context),
            inputConfigMode: main.captureInputConfigModeState(),
            random: this.captureRandom(main.random),
            stage,
            things,
            audio: this.captureAudio(main)
        };
    }

    public restoreSnapshot(main: Main, gc: GameContainer, snapshot: StickvaniaGameStateSnapshot): void {
        if (!this.isSupportedSnapshot(snapshot) || !this.isSupportedSnapshotForLoadedResources(main, snapshot)) {
            throw new Error("Unsupported saved game state.");
        }

        main.stopAllSounds();
        if (snapshot.stage !== null) {
            this.callCreateStage(main, snapshot.stage.stageIndex);
        }

        const context = this.createRestoreContext(main, gc, snapshot);
        this.restoreMainFields(main, snapshot.mainFields, context);
        this.restoreRandom(main.random, snapshot.random);
        if (snapshot.stage !== null) {
            this.restoreThingFields(context, snapshot.things);
            this.restoreStage(context, snapshot.stage);
            this.restoreMainRoots(context, snapshot.stage);
            this.runAfterRestoreHooks(context);
        } else {
            this.clearMainStageRoots(main);
        }
        main.restoreInputConfigModeState(gc, snapshot.inputConfigMode);
        this.restoreAudio(context, snapshot.audio);
        main.clearInputPressedRecords();
        main.resetNextFrameTime();
    }

    public isSupportedSnapshot(snapshot: StickvaniaGameStateSnapshot): boolean {
        if (!snapshot || typeof snapshot !== "object" || snapshot.version !== GAME_STATE_VERSION) {
            return false;
        }
        if (!this.isSupportedMode(snapshot.mode) || !Array.isArray(snapshot.things) || !this.isPlainRecord(snapshot.mainFields)) {
            return false;
        }
        if (
            snapshot.mainFields.mode !== snapshot.mode ||
            !this.areRecordFieldNamesExact(snapshot.mainFields, MAIN_PERSISTED_STATE_FIELD_NAMES) ||
            !isPersistedMainFieldValuesValid(snapshot.mainFields) ||
            !this.areThingSnapshotsValid(snapshot.things)
        ) {
            return false;
        }

        const thingTypes = new Map<number, ThingTypeId>(snapshot.things.map((thing) => [thing.id, thing.type]));
        const segmentCount = snapshot.stage === null ? 0 : snapshot.stage.segments.length;
        if (!snapshot.things.every((thing) => isPersistedThingFieldValuesValid(thing, thingTypes, segmentCount))) {
            return false;
        }

        const stageRequired = isStageRequiredGameStateMode(snapshot.mode);
        if (stageRequired) {
            if (!this.isStageSnapshotValid(snapshot.stage, thingTypes, snapshot.mainFields, snapshot.things)) {
                return false;
            }
        } else if (snapshot.stage !== null || snapshot.things.length !== 0) {
            return false;
        }
        if (isInputConfigGameStateMode(snapshot.mode)) {
            if (!this.isInputConfigSnapshotShape(snapshot.inputConfigMode)) {
                return false;
            }
        } else if (snapshot.inputConfigMode != null) {
            return false;
        }
        if (!this.isRandomSnapshotShape(snapshot.random)) {
            return false;
        }
        if (!this.isAudioSnapshotShape(snapshot.audio)) {
            return false;
        }

        const references = this.createSnapshotReferenceLimits(snapshot.stage, snapshot.things.length);
        return (
            this.isEncodedRecordReferencesValid(snapshot.mainFields, references) &&
            snapshot.things.every((thing) => this.isEncodedRecordReferencesValid(thing.fields, references))
        );
    }

    public isSupportedSnapshotForLoadedResources(main: Main, snapshot: StickvaniaGameStateSnapshot): boolean {
        if (snapshot.stage === null) {
            return true;
        }
        const loadedStages = this.getField<StageSegment[][] | null>(main, "loadedSegments");
        const loadedSegments = loadedStages?.[snapshot.stage.stageIndex];
        if (loadedSegments === undefined || loadedSegments.length !== snapshot.stage.segments.length) {
            return false;
        }

        const stairsCounts: number[] = [];
        for (let segmentIndex = 0; segmentIndex < loadedSegments.length; segmentIndex++) {
            const loaded = loadedSegments[segmentIndex];
            const saved = snapshot.stage.segments[segmentIndex];
            if (!Array.isArray(loaded.stage) || loaded.stage.length !== 11 || loaded.stage.some((row) => !Array.isArray(row))) {
                return false;
            }
            const width = loaded.stage[0]?.length ?? 0;
            if (width <= 0 || loaded.stage.some((row) => row.length !== width) || saved.mapWidth !== width) {
                return false;
            }
            if (saved.map.length !== 11 || saved.walls.length !== 11) {
                return false;
            }
            if (saved.map.some((row) => row.length !== width + 1) || saved.walls.some((row) => row.length !== width + 1)) {
                return false;
            }

            let doors = 0;
            let stairs = 0;
            for (let y = 0; y < loaded.stage.length; y++) {
                for (let x = 0; x < width; x++) {
                    const tile = loaded.stage[y]![x];
                    if (tile === Main.TILE_DOOR && (loaded.direction === Main.RIGHT || x !== 0)) {
                        doors++;
                    }
                    if (
                        (y === 0 || y === loaded.stage.length - 1) &&
                        (tile === Main.TILE_STAIRS_LEFT ||
                            tile === Main.TILE_STAIRS_RIGHT ||
                            tile === Main.TILE_STAIRS_LEFT_CAPPED ||
                            tile === Main.TILE_STAIRS_RIGHT_CAPPED)
                    ) {
                        stairs++;
                    }
                }
            }
            if (doors + 1 !== saved.regions.length) {
                return false;
            }
            stairsCounts.push(stairs);
        }

        const limits = this.createSnapshotReferenceLimits(snapshot.stage, snapshot.things.length, stairsCounts);
        return (
            this.isEncodedRecordReferencesValid(snapshot.mainFields, limits) &&
            snapshot.things.every((thing) => this.isEncodedRecordReferencesValid(thing.fields, limits))
        );
    }

    private isSupportedMode(mode: unknown): mode is number {
        return isRestorableGameStateMode(mode);
    }

    private isStageSnapshotValid(
        snapshot: unknown,
        thingTypes: ReadonlyMap<number, ThingTypeId>,
        mainFields: EncodedRecord,
        thingSnapshots: readonly ThingSnapshot[]
    ): snapshot is StageSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, [
                "stageIndex",
                "currentSegmentIndex",
                "checkpoint",
                "simon",
                "door",
                "platforms",
                "regionThingStack",
                "regionStackSwap",
                "weaponsStack",
                "weaponsStackSwap",
                "oldThingStack",
                "segments"
            ])
        ) {
            return false;
        }
        const stageIndex = snapshot.stageIndex;
        if (!this.isFiniteInteger(stageIndex) || stageIndex < 0 || stageIndex >= EXPECTED_STAGE_SEGMENT_COUNTS.length) {
            return false;
        }
        const expectedSegmentCount = EXPECTED_STAGE_SEGMENT_COUNTS[stageIndex];
        if (
            !Array.isArray(snapshot.segments) ||
            snapshot.segments.length !== expectedSegmentCount ||
            !this.isFiniteInteger(snapshot.currentSegmentIndex) ||
            snapshot.currentSegmentIndex < 0 ||
            snapshot.currentSegmentIndex >= expectedSegmentCount ||
            !this.isThingIdOfType(snapshot.checkpoint, thingTypes, ["Checkpoint"], false) ||
            !this.isThingIdOfType(snapshot.simon, thingTypes, ["Simon"], false) ||
            !this.isThingIdOfType(snapshot.door, thingTypes, ["Door"], true) ||
            !Array.isArray(snapshot.platforms) ||
            !snapshot.platforms.every((id) => this.isThingIdOfType(id, thingTypes, ["MovingPlatform"], false)) ||
            !this.isStackSnapshotValid(snapshot.regionThingStack, thingTypes.size) ||
            !this.isStackSnapshotValid(snapshot.regionStackSwap, thingTypes.size) ||
            !this.isStackSnapshotValid(snapshot.weaponsStack, thingTypes.size) ||
            !this.isStackSnapshotValid(snapshot.weaponsStackSwap, thingTypes.size) ||
            !this.isStackSnapshotValid(snapshot.oldThingStack, thingTypes.size)
        ) {
            return false;
        }

        if (!snapshot.segments.every((segment, index) => this.isSegmentSnapshotValid(segment, index, stageIndex, thingTypes))) {
            return false;
        }

        const checkpointIds = new Set<number>();
        for (const segment of snapshot.segments) {
            for (const region of segment.regions) {
                if (checkpointIds.has(region.checkpoint)) {
                    return false;
                }
                checkpointIds.add(region.checkpoint);
                if (!this.isCheckpointTargetValid(region.checkpoint, thingSnapshots, snapshot.segments)) {
                    return false;
                }
            }
        }
        if (!checkpointIds.has(snapshot.checkpoint)) {
            return false;
        }

        const currentSegment = snapshot.segments[snapshot.currentSegmentIndex];
        const currentRegion = currentSegment?.regions[currentSegment.regionIndex];
        if (currentRegion === undefined || !this.sameThingIdArray(snapshot.platforms, currentRegion.platforms)) {
            return false;
        }
        if (mainFields.stage !== currentRegion.stageNumber || mainFields.stageIndex !== stageIndex) {
            return false;
        }

        return this.isThingGraphFullyReachable(snapshot, thingSnapshots);
    }

    private isSegmentSnapshotValid(
        snapshot: unknown,
        segmentIndex: number,
        stageIndex: number,
        thingTypes: ReadonlyMap<number, ThingTypeId>
    ): snapshot is SegmentSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, ["direction", "stageSegmentIndex", "map", "walls", "mapWidth", "regionIndex", "regions"]) ||
            !Array.isArray(snapshot.regions)
        ) {
            return false;
        }
        const expectedStageNumbers = Main.stageNumbers[stageIndex]?.[segmentIndex];
        if (expectedStageNumbers === undefined || snapshot.regions.length !== expectedStageNumbers.length) {
            return false;
        }
        if (
            (snapshot.direction !== Main.LEFT && snapshot.direction !== Main.RIGHT) ||
            snapshot.stageSegmentIndex !== segmentIndex ||
            !this.isFiniteInteger(snapshot.mapWidth) ||
            snapshot.mapWidth <= 0 ||
            !this.isMapGridSnapshot(snapshot.map, snapshot.mapWidth) ||
            !this.isWallGridSnapshot(snapshot.walls, snapshot.mapWidth) ||
            !this.isFiniteInteger(snapshot.regionIndex) ||
            snapshot.regionIndex < 0 ||
            snapshot.regionIndex >= snapshot.regions.length
        ) {
            return false;
        }
        return snapshot.regions.every((region, regionIndex) =>
            this.isRegionSnapshotValid(region, snapshot.mapWidth, expectedStageNumbers[regionIndex]!, thingTypes)
        );
    }

    private isRegionSnapshotValid(
        snapshot: unknown,
        mapWidth: number,
        expectedStageNumber: number,
        thingTypes: ReadonlyMap<number, ThingTypeId>
    ): snapshot is RegionSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, ["min", "max", "checkpoint", "thingStack", "platforms", "stageNumber"]) ||
            !this.isFiniteNumber(snapshot.min) ||
            !this.isFiniteNumber(snapshot.max) ||
            snapshot.min < 0 ||
            snapshot.max < snapshot.min ||
            snapshot.max > mapWidth * 32 ||
            snapshot.stageNumber !== expectedStageNumber ||
            !this.isThingIdOfType(snapshot.checkpoint, thingTypes, ["Checkpoint"], false) ||
            !this.isStackSnapshotValid(snapshot.thingStack, thingTypes.size) ||
            !Array.isArray(snapshot.platforms) ||
            !snapshot.platforms.every((id) => this.isThingIdOfType(id, thingTypes, ["MovingPlatform"], false))
        ) {
            return false;
        }

        return true;
    }

    private isCheckpointTargetValid(
        checkpointId: number,
        things: readonly ThingSnapshot[],
        segments: readonly SegmentSnapshot[]
    ): boolean {
        const checkpoint = things[checkpointId];
        if (checkpoint === undefined || checkpoint.type !== "Checkpoint") {
            return false;
        }
        const segmentIndex = checkpoint.fields.stageSegmentIndex;
        const regionIndex = checkpoint.fields.regionIndex;
        return (
            typeof segmentIndex === "number" &&
            Number.isInteger(segmentIndex) &&
            segmentIndex >= 0 &&
            segmentIndex < segments.length &&
            typeof regionIndex === "number" &&
            Number.isInteger(regionIndex) &&
            regionIndex >= 0 &&
            regionIndex < segments[segmentIndex]!.regions.length
        );
    }

    private isThingGraphFullyReachable(stage: StageSnapshot, things: readonly ThingSnapshot[]): boolean {
        const reachable = new Set<number>();
        const queue: number[] = [];
        const add = (id: number | null): void => {
            if (id !== null && !reachable.has(id)) {
                reachable.add(id);
                queue.push(id);
            }
        };
        const addStack = (stack: ThingStackSnapshot): void => {
            for (const id of stack.$stack.things) add(id);
        };
        const addIds = (ids: readonly (number | null)[]): void => {
            for (const id of ids) add(id);
        };

        add(stage.checkpoint);
        add(stage.simon);
        add(stage.door);
        addIds(stage.platforms ?? []);
        addStack(stage.regionThingStack);
        addStack(stage.regionStackSwap);
        addStack(stage.weaponsStack);
        addStack(stage.weaponsStackSwap);
        addStack(stage.oldThingStack);
        for (const segment of stage.segments) {
            for (const region of segment.regions) {
                add(region.checkpoint);
                addIds(region.platforms);
                addStack(region.thingStack);
            }
        }

        while (queue.length > 0) {
            const id = queue.pop()!;
            const thing = things[id];
            if (thing === undefined) {
                return false;
            }
            this.visitEncodedThingReferences(thing.fields, add);
        }
        return reachable.size === things.length;
    }

    private visitEncodedThingReferences(value: EncodedValue | EncodedRecord, add: (id: number | null) => void): void {
        if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return;
        }
        if (Array.isArray(value)) {
            for (const entry of value) this.visitEncodedThingReferences(entry as EncodedValue, add);
            return;
        }
        if (this.hasOwn(value, "$thing")) {
            add((value as { $thing: number | null }).$thing);
            return;
        }
        if (this.hasOwn(value, "$stack")) {
            for (const id of (value as ThingStackSnapshot).$stack.things) add(id);
            return;
        }
        for (const child of Object.values(value)) {
            this.visitEncodedThingReferences(child as EncodedValue, add);
        }
    }

    private isMapGridSnapshot(value: unknown, mapWidth: number): value is number[][] {
        return (
            Array.isArray(value) &&
            value.length === 11 &&
            value.every(
                (row) =>
                    Array.isArray(row) &&
                    row.length === mapWidth + 1 &&
                    row.every((cell) => this.isFiniteInteger(cell) && cell >= Main.BLOCK_EMPTY && cell <= Main.BLOCK_STAIRS_RIGHT_CAPPED)
            )
        );
    }

    private isWallGridSnapshot(value: unknown, mapWidth: number): value is number[][] {
        return (
            Array.isArray(value) &&
            value.length === 11 &&
            value.every(
                (row) =>
                    Array.isArray(row) &&
                    row.length === mapWidth + 1 &&
                    row.every((cell) => cell === Main.WALL_EMPTY || cell === Main.WALL_PLATFORM || cell === Main.WALL_FULL)
            )
        );
    }

    private isStackSnapshotValid(snapshot: unknown, thingCount: number): snapshot is ThingStackSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, ["$stack"]) ||
            !this.isPlainRecord(snapshot.$stack) ||
            !this.areRecordFieldNamesExact(snapshot.$stack, ["capacity", "things"]) ||
            !Array.isArray(snapshot.$stack.things)
        ) {
            return false;
        }
        return (
            this.isFiniteInteger(snapshot.$stack.capacity) &&
            snapshot.$stack.capacity >= snapshot.$stack.things.length &&
            snapshot.$stack.capacity <= MAX_SAVED_STACK_CAPACITY &&
            snapshot.$stack.things.length <= MAX_SAVED_STACK_CAPACITY &&
            snapshot.$stack.things.every((id) => this.isNullableThingId(id, thingCount))
        );
    }

    private areThingSnapshotsValid(snapshots: ThingSnapshot[]): boolean {
        if (snapshots.length > MAX_SAVED_STACK_CAPACITY) {
            return false;
        }
        for (let i = 0; i < snapshots.length; i++) {
            const thing = snapshots[i];
            if (
                !this.isPlainRecord(thing) ||
                thing.id !== i ||
                !isThingTypeId(thing.type) ||
                !this.isPlainRecord(thing.fields) ||
                !this.areRecordFieldNamesExact(thing.fields, THING_PERSISTED_STATE_FIELD_NAMES[thing.type])
            ) {
                return false;
            }
        }
        return true;
    }

    private areRecordFieldNamesExact(record: JsonRecord | EncodedRecord, expected: readonly string[]): boolean {
        const fields = Object.keys(record);
        if (fields.length !== expected.length) {
            return false;
        }
        const fieldSet = new Set<string>(fields);
        return expected.every((field) => fieldSet.has(field));
    }

    private isInputConfigSnapshotShape(snapshot: unknown): snapshot is InputConfigModeSnapshot {
        return isInputConfigModeSnapshot(snapshot);
    }

    private isRandomSnapshotShape(snapshot: unknown): snapshot is RandomSnapshot {
        if (!this.isPlainRecord(snapshot)) {
            return false;
        }
        return (
            this.isFiniteInteger(snapshot.seed0) &&
            snapshot.seed0 >= 0 &&
            snapshot.seed0 <= 0xffff &&
            this.isFiniteInteger(snapshot.seed1) &&
            snapshot.seed1 >= 0 &&
            snapshot.seed1 <= 0xffff &&
            this.isFiniteInteger(snapshot.seed2) &&
            snapshot.seed2 >= 0 &&
            snapshot.seed2 <= 0xffff
        );
    }

    private isAudioSnapshotShape(snapshot: unknown): snapshot is AudioSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, ["currentSong", "requestedSong", "currentMusic", "songs", "sounds"]) ||
            !this.isNullableSongId(snapshot.currentSong) ||
            !this.isNullableSongId(snapshot.requestedSong) ||
            !Array.isArray(snapshot.songs) ||
            snapshot.songs.length !== SONG_IDS.length ||
            !isSoundEffectSnapshotsShape(snapshot.sounds) ||
            (snapshot.currentMusic !== null && !this.isMusicSnapshotShape(snapshot.currentMusic))
        ) {
            return false;
        }
        const songs = new Set<string>();
        const music = new Map<MusicId, MusicSnapshot>();
        for (const song of snapshot.songs) {
            if (!this.isSongSnapshotShape(song) || songs.has(song.id)) {
                return false;
            }
            songs.add(song.id);
            for (const part of [song.intro, song.loop]) {
                if (part !== null) {
                    music.set(part.id, part);
                }
            }
        }
        const currentMusic = snapshot.currentMusic as MusicSnapshot | null;
        if (currentMusic !== null) {
            const existing = music.get(currentMusic.id);
            if (existing !== undefined && !this.sameMusicPlayback(existing, currentMusic)) {
                return false;
            }
            music.set(currentMusic.id, currentMusic);
        }
        // Slick has one logical Music transport. Reject contradictory snapshots
        // rather than letting restore order choose which track survives.
        return Array.from(music.values()).filter((part) => part.playback.transport !== "stopped").length <= 1;
    }

    private isSongSnapshotShape(snapshot: unknown): snapshot is SongSnapshot {
        if (
            !this.isPlainRecord(snapshot) ||
            !this.areRecordFieldNamesExact(snapshot, ["id", "playing", "intro", "loop"]) ||
            typeof snapshot.id !== "string" ||
            !SONG_ID_SET.has(snapshot.id) ||
            typeof snapshot.playing !== "boolean"
        ) {
            return false;
        }
        for (const suffix of ["intro", "loop"] as const) {
            const id = `${snapshot.id}.${suffix}`;
            const part = snapshot[suffix];
            if (MUSIC_ID_SET.has(id)) {
                if (!this.isMusicSnapshotShape(part) || part.id !== id) {
                    return false;
                }
            } else if (part !== null) {
                return false;
            }
        }
        return true;
    }

    private isMusicSnapshotShape(snapshot: unknown): snapshot is MusicSnapshot {
        return (
            this.isPlainRecord(snapshot) &&
            this.areRecordFieldNamesExact(snapshot, ["id", "playback"]) &&
            typeof snapshot.id === "string" &&
            MUSIC_ID_SET.has(snapshot.id) &&
            isMusicPlaybackSnapshot(snapshot.playback)
        );
    }

    private sameMusicPlayback(left: MusicSnapshot, right: MusicSnapshot): boolean {
        const a = left.playback;
        const b = right.playback;
        return (
            a.transport === b.transport &&
            a.looped === b.looped &&
            a.playbackRate === b.playbackRate &&
            a.positionSeconds === b.positionSeconds &&
            a.volume === b.volume &&
            (a.fade === null || b.fade === null
                ? a.fade === b.fade
                : a.fade.durationMs === b.fade.durationMs &&
                  a.fade.elapsedMs === b.fade.elapsedMs &&
                  a.fade.startVolume === b.fade.startVolume &&
                  a.fade.endVolume === b.fade.endVolume &&
                  a.fade.stopAfterFade === b.fade.stopAfterFade)
        );
    }

    private createSnapshotReferenceLimits(
        stage: StageSnapshot | null,
        thingCount: number,
        stairsCounts: number[] | null = null
    ): SnapshotReferenceLimits {
        return {
            thingCount,
            segmentCount: stage === null ? 0 : stage.segments.length,
            regionCounts: stage === null ? [] : stage.segments.map((segment) => segment.regions.length),
            stairsCounts
        };
    }

    private isEncodedRecordReferencesValid(record: EncodedRecord, limits: SnapshotReferenceLimits): boolean {
        if (!this.isPlainRecord(record)) {
            return false;
        }
        return Object.values(record).every((value) => this.isEncodedValueReferencesValid(value as EncodedValue, limits));
    }

    private isEncodedValueReferencesValid(value: EncodedValue, limits: SnapshotReferenceLimits): boolean {
        if (value === null || value === undefined || typeof value === "string" || typeof value === "boolean") {
            return true;
        }
        if (typeof value === "number") {
            return this.isFiniteNumber(value);
        }
        if (Array.isArray(value)) {
            return value.every((item) => this.isEncodedValueReferencesValid(item as EncodedValue, limits));
        }
        if (!this.isPlainRecord(value)) {
            return false;
        }

        const referenceTagCount = this.referenceTagCount(value);
        if (referenceTagCount > 1) {
            return false;
        }
        if (this.hasOwn(value, "$thing")) {
            return Object.keys(value).length === 1 && this.isNullableThingId((value as { $thing: unknown }).$thing, limits.thingCount);
        }
        if (this.hasOwn(value, "$segment")) {
            return Object.keys(value).length === 1 && this.isNullableIndex((value as { $segment: unknown }).$segment, limits.segmentCount);
        }
        if (this.hasOwn(value, "$region")) {
            return Object.keys(value).length === 1 && this.isNullableRegionRef((value as { $region: unknown }).$region, limits);
        }
        if (this.hasOwn(value, "$stairs")) {
            return Object.keys(value).length === 1 && this.isNullableStairsRef((value as { $stairs: unknown }).$stairs, limits);
        }
        if (this.hasOwn(value, "$song")) {
            return Object.keys(value).length === 1 && this.isNullableSongId((value as { $song: unknown }).$song);
        }
        if (this.hasOwn(value, "$music")) {
            return Object.keys(value).length === 1 && this.isNullableMusicId((value as { $music: unknown }).$music);
        }
        if (this.hasOwn(value, "$stack")) {
            return Object.keys(value).length === 1 && this.isStackSnapshotValid(value as unknown as ThingStackSnapshot, limits.thingCount);
        }

        return Object.values(value).every((child) => this.isEncodedValueReferencesValid(child as EncodedValue, limits));
    }

    private referenceTagCount(value: JsonRecord): number {
        let count = 0;
        if (this.hasOwn(value, "$thing")) {
            count++;
        }
        if (this.hasOwn(value, "$segment")) {
            count++;
        }
        if (this.hasOwn(value, "$region")) {
            count++;
        }
        if (this.hasOwn(value, "$stairs")) {
            count++;
        }
        if (this.hasOwn(value, "$song")) {
            count++;
        }
        if (this.hasOwn(value, "$music")) {
            count++;
        }
        if (this.hasOwn(value, "$stack")) {
            count++;
        }
        return count;
    }

    private isThingIdOfType(
        value: unknown,
        thingTypes: ReadonlyMap<number, ThingTypeId>,
        allowedTypes: readonly ThingTypeId[],
        nullable: boolean
    ): value is number | null {
        if (value === null) {
            return nullable;
        }
        return this.isFiniteInteger(value) && value >= 0 && allowedTypes.includes(thingTypes.get(value) as ThingTypeId);
    }

    private sameThingIdArray(left: readonly (number | null)[], right: readonly (number | null)[]): boolean {
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }

    private isNullableThingId(value: unknown, thingCount: number): value is number | null {
        return value === null || (this.isFiniteInteger(value) && value >= 0 && value < thingCount);
    }

    private isNullableIndex(value: unknown, length: number): value is number | null {
        return value === null || (this.isFiniteInteger(value) && value >= 0 && value < length);
    }

    private isThingIdArray(value: unknown, thingCount: number): value is Array<number | null> {
        return Array.isArray(value) && value.every((id) => this.isNullableThingId(id, thingCount));
    }

    private isNullableRegionRef(value: unknown, limits: SnapshotReferenceLimits): value is [number, number] | null {
        if (value === null) {
            return true;
        }
        if (!Array.isArray(value) || value.length !== 2 || !this.isFiniteInteger(value[0]) || !this.isFiniteInteger(value[1])) {
            return false;
        }
        const segment = value[0];
        const region = value[1];
        return segment >= 0 && segment < limits.segmentCount && region >= 0 && region < limits.regionCounts[segment];
    }

    private isNullableStairsRef(value: unknown, limits: SnapshotReferenceLimits): value is [number, number] | null {
        if (value === null) {
            return true;
        }
        if (!Array.isArray(value) || value.length !== 2 || !this.isFiniteInteger(value[0]) || !this.isFiniteInteger(value[1])) {
            return false;
        }
        if (value[0] < 0 || value[0] >= limits.segmentCount || value[1] < 0) {
            return false;
        }
        return limits.stairsCounts === null ? value[1] <= 255 : value[1] < limits.stairsCounts[value[0]]!;
    }

    private isNullableSongId(value: unknown): value is SongId | null {
        return value === null || (typeof value === "string" && SONG_ID_SET.has(value));
    }

    private isNullableMusicId(value: unknown): value is MusicId | null {
        return value === null || (typeof value === "string" && MUSIC_ID_SET.has(value));
    }

    private isFiniteInteger(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value) && Math.trunc(value) === value;
    }

    private isFiniteNumber(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value);
    }

    private createCaptureContext(main: Main): CaptureContext {
        const stageSegments = this.getField<StageSegment[]>(main, "stageSegments") ?? [];
        const segmentIndexes = new Map<StageSegment, number>();
        const regionIndexes = new Map<Region, [number, number]>();
        const stairsIndexes = new Map<StairsEntry, [number, number]>();

        for (let i = 0; i < stageSegments.length; i++) {
            const segment = stageSegments[i];
            segmentIndexes.set(segment, i);
            for (let j = 0; j < segment.regions.length; j++) {
                regionIndexes.set(segment.regions[j], [i, j]);
            }
            for (let j = 0; j < segment.stairsEntries.length; j++) {
                stairsIndexes.set(segment.stairsEntries[j], [i, j]);
            }
        }

        return {
            main,
            stageSegments,
            segmentIndexes,
            regionIndexes,
            stairsIndexes,
            thingIds: new Map<Thing, number>(),
            things: []
        };
    }

    private createRestoreContext(main: Main, gc: GameContainer, snapshot: StickvaniaGameStateSnapshot): RestoreContext {
        const stageSegments = this.getField<StageSegment[]>(main, "stageSegments") ?? [];
        const thingById = new Map<number, Thing>();

        for (const thingSnapshot of snapshot.things) {
            const constructor = THING_TYPES[thingSnapshot.type];
            if (!constructor) {
                throw new Error(`Unknown Thing type: ${thingSnapshot.type}`);
            }
            thingById.set(thingSnapshot.id, Object.create(constructor.prototype) as Thing);
        }

        return {
            main,
            gc,
            stageSegments,
            thingById
        };
    }

    private captureStage(context: CaptureContext): StageSnapshot {
        const main = context.main;
        const stageSegments = context.stageSegments;
        const currentSegment = this.getField<StageSegment | null>(main, "stageSegment");
        const checkpoint = this.getField<Checkpoint | null>(main, "checkpoint");
        const simon = main.simon;
        const door = main.door;

        const segments = stageSegments.map((segment) => this.captureSegment(context, segment));
        const platforms = main.platforms === null ? null : main.platforms.map((thing) => this.registerThing(context, thing));

        return {
            stageIndex: main.stageIndex,
            currentSegmentIndex: currentSegment === null ? null : this.segmentIndex(context, currentSegment),
            checkpoint: this.registerThing(context, checkpoint),
            simon: this.registerThing(context, simon),
            door: this.registerThing(context, door),
            platforms,
            regionThingStack: this.captureStack(context, main.regionThingStack),
            regionStackSwap: this.captureStack(context, main.regionStackSwap),
            weaponsStack: this.captureStack(context, main.weaponsStack),
            weaponsStackSwap: this.captureStack(context, main.weaponsStackSwap),
            oldThingStack: this.captureStack(context, main.oldThingStack),
            segments
        };
    }

    private captureSegment(context: CaptureContext, segment: StageSegment): SegmentSnapshot {
        return {
            direction: segment.direction,
            stageSegmentIndex: segment.stageSegmentIndex,
            map: this.cloneNumberGrid(segment.map),
            walls: this.cloneNumberGrid(segment.walls),
            mapWidth: segment.mapWidth,
            regionIndex: segment.regionIndex,
            regions: segment.regions.map((region) => this.captureRegion(context, region))
        };
    }

    private captureRegion(context: CaptureContext, region: Region): RegionSnapshot {
        return {
            min: region.min,
            max: region.max,
            checkpoint: this.registerThing(context, region.checkpoint),
            thingStack: this.captureStack(context, region.thingStack),
            platforms: region.platforms === null ? [] : region.platforms.map((thing) => this.registerThing(context, thing)),
            stageNumber: region.stageNumber
        };
    }

    private captureStack(context: CaptureContext, stack: ThingStack): ThingStackSnapshot {
        const things: Array<number | null> = [];
        for (let i = 0; i <= stack.top; i++) {
            things.push(this.registerThing(context, stack.things[i]));
        }
        return {
            $stack: {
                capacity: stack.things.length,
                things
            }
        };
    }

    private registerThing(context: CaptureContext, thing: Thing | null): number | null {
        if (thing === null || thing === undefined) {
            return null;
        }
        const existing = context.thingIds.get(thing);
        if (existing !== undefined) {
            return existing;
        }

        const id = context.things.length;
        context.thingIds.set(thing, id);
        context.things.push(thing);
        this.visitThingReferences(context, thing);
        return id;
    }

    private visitThingReferences(context: CaptureContext, thing: Thing): void {
        const type = getThingTypeId(thing);
        for (const key of THING_PERSISTED_STATE_FIELD_NAMES[type]) {
            this.visitValueReferences(context, this.getField<unknown>(thing, key));
        }
    }

    private visitValueReferences(context: CaptureContext, value: unknown): void {
        if (value instanceof Thing) {
            this.registerThing(context, value);
            return;
        }
        if (value instanceof ThingStack) {
            for (let i = 0; i <= value.top; i++) {
                this.registerThing(context, value.things[i]);
            }
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                this.visitValueReferences(context, item);
            }
        }
    }

    private captureThing(context: CaptureContext, thing: Thing, id: number): ThingSnapshot {
        const type = getThingTypeId(thing);
        const fields: EncodedRecord = {};
        for (const key of THING_PERSISTED_STATE_FIELD_NAMES[type]) {
            const value = this.getField<unknown>(thing, key);
            fields[key] = this.encodeValue(context, value, `${type}.${key}`);
        }
        return { id, type, fields };
    }

    private captureMainFields(context: CaptureContext): EncodedRecord {
        const fields: EncodedRecord = {};
        for (const key of MAIN_PERSISTED_STATE_FIELD_NAMES) {
            fields[key] = this.encodeValue(context, this.getField<unknown>(context.main, key), `Main.${key}`);
        }
        return fields;
    }

    private snapshotMode(main: Main): number {
        return main.mode;
    }

    private encodeValue(context: CaptureContext, value: unknown, path: string): EncodedValue {
        if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return value as JsonValue;
        }
        if (value instanceof Thing) {
            return { $thing: this.existingThingId(context, value, path) };
        }
        if (value instanceof StageSegment) {
            return { $segment: this.segmentIndex(context, value) };
        }
        if (value instanceof Region) {
            return { $region: this.regionIndex(context, value) };
        }
        if (value instanceof StairsEntry) {
            return { $stairs: this.stairsIndex(context, value) };
        }
        if (value instanceof Song) {
            return { $song: this.songIdForSong(context.main, value) };
        }
        if (value instanceof Music) {
            return { $music: this.musicIdForMusic(context.main, value) };
        }
        if (value instanceof ThingStack) {
            return this.captureStack(context, value);
        }
        if (Array.isArray(value)) {
            return value.map((item, index) => this.encodeValue(context, item, `${path}[${index}]`));
        }
        if (this.isPlainRecord(value)) {
            const record: JsonRecord = {};
            for (const key of Object.keys(value)) {
                record[key] = this.encodeValue(context, (value as FieldBag)[key], `${path}.${key}`) as JsonValue;
            }
            return record;
        }
        throw new Error(`Unsupported state field at ${path}: ${this.describeValue(value)}`);
    }

    private restoreMainFields(main: Main, fields: EncodedRecord, context: RestoreContext): void {
        for (const [key, value] of Object.entries(fields)) {
            this.setField(main, key, this.decodeValue(context, value));
        }
    }

    private restoreThingFields(context: RestoreContext, snapshots: ThingSnapshot[]): void {
        for (const snapshot of snapshots) {
            const thing = this.requiredThing(context, snapshot.id);
            for (const [key, value] of Object.entries(snapshot.fields)) {
                this.setField(thing, key, this.decodeValue(context, value));
            }
            thing.main = context.main;
        }
    }

    private restoreStage(context: RestoreContext, snapshot: StageSnapshot): void {
        if (snapshot.segments.length !== context.stageSegments.length) {
            throw new Error("Saved stage segment count does not match loaded stage.");
        }

        for (let i = 0; i < snapshot.segments.length; i++) {
            this.restoreSegment(context, context.stageSegments[i], snapshot.segments[i]);
        }
    }

    private restoreSegment(context: RestoreContext, segment: StageSegment, snapshot: SegmentSnapshot): void {
        if (snapshot.regions.length !== segment.regions.length) {
            throw new Error(`Saved region count does not match stage segment ${snapshot.stageSegmentIndex}.`);
        }

        segment.direction = snapshot.direction;
        segment.stageSegmentIndex = snapshot.stageSegmentIndex;
        segment.map = this.cloneNumberGrid(snapshot.map);
        segment.walls = this.cloneNumberGrid(snapshot.walls);
        segment.mapWidth = snapshot.mapWidth;
        segment.regionIndex = snapshot.regionIndex;

        for (let i = 0; i < snapshot.regions.length; i++) {
            this.restoreRegion(context, segment.regions[i], snapshot.regions[i]);
        }
    }

    private restoreRegion(context: RestoreContext, region: Region, snapshot: RegionSnapshot): void {
        region.min = snapshot.min;
        region.max = snapshot.max;
        region.checkpoint = this.thingOrNull(context, snapshot.checkpoint) as Checkpoint;
        this.restoreStack(context, region.thingStack, snapshot.thingStack);
        region.platforms = snapshot.platforms.map((id) => this.thingOrNull(context, id)!);
        region.stageNumber = snapshot.stageNumber;
    }

    private restoreMainRoots(context: RestoreContext, snapshot: StageSnapshot): void {
        const main = context.main;
        const currentSegment = snapshot.currentSegmentIndex === null ? null : context.stageSegments[snapshot.currentSegmentIndex];
        this.setField(main, "stageSegments", context.stageSegments);
        this.setField(main, "stageSegment", currentSegment);
        this.setField(main, "checkpoint", this.thingOrNull(context, snapshot.checkpoint));
        main.simon = this.thingOrNull(context, snapshot.simon) as Main["simon"];
        main.door = this.thingOrNull(context, snapshot.door) as Main["door"];
        main.map = currentSegment === null ? null : currentSegment.map;
        main.walls = currentSegment === null ? null : currentSegment.walls;
        main.mapWidth = currentSegment === null ? 0 : currentSegment.mapWidth;
        main.platforms = snapshot.platforms === null ? null : snapshot.platforms.map((id) => this.thingOrNull(context, id)!);
        this.restoreStack(context, main.regionThingStack, snapshot.regionThingStack);
        this.restoreStack(context, main.regionStackSwap, snapshot.regionStackSwap);
        this.restoreStack(context, main.weaponsStack, snapshot.weaponsStack);
        this.restoreStack(context, main.weaponsStackSwap, snapshot.weaponsStackSwap);
        this.restoreStack(context, main.oldThingStack, snapshot.oldThingStack);
    }

    private clearMainStageRoots(main: Main): void {
        this.setField(main, "stageSegments", null);
        this.setField(main, "stageSegment", null);
        this.setField(main, "checkpoint", null);
        main.door = null;
        main.map = null;
        main.walls = null;
        main.platforms = null;
        main.mapWidth = 0;
        main.regionThingStack.clear();
        main.regionStackSwap.clear();
        main.weaponsStack.clear();
        main.weaponsStackSwap.clear();
        main.oldThingStack.clear();
    }

    private restoreStack(context: RestoreContext, stack: ThingStack, snapshot: ThingStackSnapshot): void {
        const capacity = Math.max(32, snapshot.$stack.capacity, snapshot.$stack.things.length);
        stack.things = new Array<Thing | null>(capacity).fill(null);
        stack.top = snapshot.$stack.things.length - 1;
        for (let i = 0; i < snapshot.$stack.things.length; i++) {
            stack.things[i] = this.thingOrNull(context, snapshot.$stack.things[i]);
        }
    }

    private decodeValue(context: RestoreContext, value: EncodedValue): unknown {
        if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.decodeValue(context, item as EncodedValue));
        }
        if (this.hasOwn(value, "$thing")) {
            return this.thingOrNull(context, (value as { $thing: number | null }).$thing);
        }
        if (this.hasOwn(value, "$segment")) {
            const index = (value as { $segment: number | null }).$segment;
            return index === null ? null : context.stageSegments[index];
        }
        if (this.hasOwn(value, "$region")) {
            const ref = (value as { $region: [number, number] | null }).$region;
            return ref === null ? null : context.stageSegments[ref[0]].regions[ref[1]];
        }
        if (this.hasOwn(value, "$stairs")) {
            const ref = (value as { $stairs: [number, number] | null }).$stairs;
            return ref === null ? null : context.stageSegments[ref[0]].stairsEntries[ref[1]];
        }
        if (this.hasOwn(value, "$song")) {
            return this.songForId(context.main, (value as { $song: SongId | null }).$song);
        }
        if (this.hasOwn(value, "$music")) {
            return this.musicForId(context.main, (value as { $music: MusicId | null }).$music);
        }
        if (this.hasOwn(value, "$stack")) {
            const stack = new ThingStack();
            this.restoreStack(context, stack, value as ThingStackSnapshot);
            return stack;
        }

        const record: JsonRecord = {};
        for (const [key, child] of Object.entries(value)) {
            record[key] = this.decodeValue(context, child as EncodedValue) as JsonValue;
        }
        return record;
    }

    private runAfterRestoreHooks(context: RestoreContext): void {
        for (const thing of context.thingById.values()) {
            thing.main = context.main;
            rehydrateThingAfterStateRestore(getThingTypeId(thing), thing, context.main);
        }
        this.restoreSimonAlpha(context.main);
        context.main.syncSimonPhysicsProfile();
    }

    private restoreSimonAlpha(main: Main): void {
        if (main.simon === null) {
            return;
        }
        if (main.simon.flashing > 0) {
            main.flashSimon();
            return;
        }
        if (main.simon.invincible > 705) {
            main.setSimonAlpha(0.25 + (main.simon.invincible - 705) * Main.INVINCIBLE_FRACTION);
            return;
        }
        if (main.simon.invincible > 0 && main.simon.invincible < 23) {
            main.setSimonAlpha(0.25 + (23 - main.simon.invincible) * Main.INVINCIBLE_FRACTION);
            return;
        }
        if (main.simon.invincible > 0) {
            main.setSimonAlpha(0.25);
            return;
        }
        main.setSimonAlpha(1);
    }

    private captureAudio(main: Main): AudioSnapshot {
        const songs = SONG_IDS.map((id) => this.captureSong(main, id));
        const currentMusicId = this.musicIdForMusic(main, main.currentMusic);
        const songPart = songs.flatMap((song) => [song.intro, song.loop]).find((part) => part !== null && part.id === currentMusicId);
        return {
            currentSong: this.songIdForSong(main, main.currentSong),
            requestedSong: this.songIdForSong(main, main.requestedSong),
            currentMusic: main.currentMusic === null ? null : (songPart ?? this.captureMusic(main, main.currentMusic)),
            songs,
            sounds: captureSoundEffects(main)
        };
    }

    private captureSong(main: Main, id: SongId): SongSnapshot {
        const song = this.songForId(main, id);
        if (song === null) {
            throw new Error(`Music is not initialized for state capture: ${id}`);
        }
        const intro = song.getIntroForState();
        const loop = song.getLoopForState();
        return {
            id,
            playing: song.isPlayingForState(),
            intro: intro === null ? null : this.captureMusic(main, intro),
            loop: loop === null ? null : this.captureMusic(main, loop)
        };
    }

    private captureMusic(main: Main, music: Music): MusicSnapshot {
        const id = this.musicIdForMusic(main, music);
        if (id === null) {
            throw new Error("Unable to identify music for state capture.");
        }
        return { id, playback: music.capturePlaybackState() };
    }

    private restoreAudio(context: RestoreContext, snapshot: AudioSnapshot): void {
        const main = context.main;
        main.stopAllSounds();
        Music.resetPlaybackState();
        try {
            const parts = new Map<MusicId, MusicSnapshot>();
            for (const state of snapshot.songs) {
                const song = this.songForId(main, state.id);
                if (song === null) {
                    throw new Error(`Saved song is unavailable: ${state.id}`);
                }
                song.setPlayingForState(state.playing);
                for (const part of [state.intro, state.loop]) {
                    if (part !== null) {
                        parts.set(part.id, part);
                    }
                }
            }
            if (snapshot.currentMusic !== null) {
                parts.set(snapshot.currentMusic.id, snapshot.currentMusic);
            }
            // Restore stopped parts first, then the sole active/paused/end-pending
            // transport. No play/seek timer, native source, or temporary unmute is used.
            const ordered = Array.from(parts.values()).sort((a, b) => Number(a.playback.transport !== "stopped") - Number(b.playback.transport !== "stopped"));
            for (const part of ordered) {
                const music = this.musicForId(main, part.id);
                if (music === null) {
                    throw new Error(`Saved music is unavailable: ${part.id}`);
                }
                music.restorePlaybackState(part.playback);
            }
            main.currentSong = this.songForId(main, snapshot.currentSong);
            main.requestedSong = this.songForId(main, snapshot.requestedSong);
            main.currentMusic = snapshot.currentMusic === null ? null : this.musicForId(main, snapshot.currentMusic.id);
            restoreSoundEffects(main, snapshot.sounds);
        } catch (error) {
            main.stopAllSounds();
            Music.resetPlaybackState();
            throw error;
        }
    }

    private captureRandom(random: JavaRandom): RandomSnapshot {
        return random.getState();
    }

    private restoreRandom(random: JavaRandom, snapshot: RandomSnapshot): void {
        random.setState(snapshot);
    }

    private callCreateStage(main: Main, stageIndex: number): void {
        main.createStageForStateRestore(stageIndex);
    }

    private songForId(main: Main, id: SongId | null): Song | null {
        return id === null ? null : this.getField<Song | null>(main, id);
    }

    private songIdForSong(main: Main, song: Song | null): SongId | null {
        if (song === null) {
            return null;
        }
        for (const id of SONG_IDS) {
            if (this.songForId(main, id) === song) {
                return id;
            }
        }
        throw new Error("Unable to identify song for state capture.");
    }

    private musicForId(main: Main, id: MusicId | null): Music | null {
        if (id === null) {
            return null;
        }
        if ((STANDALONE_MUSIC_IDS as string[]).includes(id)) {
            return this.getField<Music | null>(main, id);
        }
        const dot = id.indexOf(".");
        const songId = id.substring(0, dot) as SongId;
        const part = id.substring(dot + 1);
        const song = this.songForId(main, songId);
        if (song === null) {
            return null;
        }
        return part === "intro" ? song.getIntroForState() : song.getLoopForState();
    }

    private musicIdForMusic(main: Main, music: Music | null): MusicId | null {
        if (music === null) {
            return null;
        }
        for (const id of STANDALONE_MUSIC_IDS) {
            if (this.musicForId(main, id) === music) {
                return id;
            }
        }
        for (const songId of SONG_IDS) {
            const song = this.songForId(main, songId);
            if (song === null) {
                continue;
            }
            if (song.getIntroForState() === music) {
                return `${songId}.intro` as MusicId;
            }
            if (song.getLoopForState() === music) {
                return `${songId}.loop` as MusicId;
            }
        }
        return null;
    }

    private existingThingId(context: CaptureContext, thing: Thing, path: string): number {
        const id = context.thingIds.get(thing);
        if (id === undefined) {
            throw new Error(`Unregistered Thing reference at ${path}.`);
        }
        return id;
    }

    private thingOrNull(context: RestoreContext, id: number | null): Thing | null {
        if (id === null) {
            return null;
        }
        return this.requiredThing(context, id);
    }

    private requiredThing(context: RestoreContext, id: number): Thing {
        const thing = context.thingById.get(id);
        if (thing === undefined) {
            throw new Error(`Missing saved Thing id: ${id}`);
        }
        return thing;
    }

    private segmentIndex(context: CaptureContext, segment: StageSegment): number {
        const index = context.segmentIndexes.get(segment);
        if (index === undefined) {
            throw new Error("Unregistered StageSegment reference.");
        }
        return index;
    }

    private regionIndex(context: CaptureContext, region: Region): [number, number] {
        const index = context.regionIndexes.get(region);
        if (index === undefined) {
            throw new Error("Unregistered Region reference.");
        }
        return index;
    }

    private stairsIndex(context: CaptureContext, stairsEntry: StairsEntry): [number, number] {
        const index = context.stairsIndexes.get(stairsEntry);
        if (index === undefined) {
            throw new Error("Unregistered StairsEntry reference.");
        }
        return index;
    }

    private cloneNumberGrid(grid: number[][]): number[][] {
        return grid.map((row) => row.slice());
    }

    private isPlainRecord(value: unknown): value is JsonRecord {
        if (value === null || typeof value !== "object") {
            return false;
        }
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    private hasOwn(value: object, key: string): boolean {
        return Object.prototype.hasOwnProperty.call(value, key);
    }

    private getField<T>(target: unknown, key: string): T {
        return (target as FieldBag)[key] as T;
    }

    private setField(target: unknown, key: string, value: unknown): void {
        (target as FieldBag)[key] = value;
    }

    private describeValue(value: unknown): string {
        if (value === null) {
            return "null";
        }
        if (value === undefined) {
            return "undefined";
        }
        if (typeof value !== "object") {
            return typeof value;
        }
        return value.constructor?.name ?? "object";
    }
}
