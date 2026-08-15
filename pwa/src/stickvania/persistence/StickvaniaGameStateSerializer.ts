import { Color, GameContainer, Image, JavaRandom, Music, Sound } from "slick2d-ts";
import { Checkpoint } from "../Checkpoint.js";
import { Fireball } from "../Fireball.js";
import { Main } from "../Main.js";
import { Region } from "../Region.js";
import { Song } from "../Song.js";
import { StageSegment } from "../StageSegment.js";
import { StairsEntry } from "../StairsEntry.js";
import { Thing } from "../Thing.js";
import { ThingStack } from "../ThingStack.js";
import {
    GAME_STATE_VERSION,
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
import { THING_TYPES } from "./ThingTypeRegistry.js";

type FieldBag = Record<string, any>;

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

const MAIN_EXCLUDED_FIELDS = new Set<string>([
    "fades",
    "nativeCursor",
    "nativeDisplayMode",
    "appGameContainer",
    "appletGameContainer",
    "scalableGame",
    "loadedSegments",
    "stageSegments",
    "stageSegment",
    "checkpoint",
    "map",
    "walls",
    "regionThingStack",
    "regionStackSwap",
    "weaponsStack",
    "weaponsStackSwap",
    "platforms",
    "simon",
    "random",
    "demoKeyRecordings",
    "endingKeyRecordings",
    "door",
    "oldThingStack",
    "blocks",
    "symbols",
    "power",
    "simonWalking",
    "simonOnStairsUp",
    "simonOnStairsDown",
    "simonKneeling",
    "simonWhipping",
    "simonKneelWhipping",
    "simonUpWhipping",
    "simonDownWhipping",
    "simonHurt",
    "simonDead",
    "whips",
    "dropItems",
    "candles",
    "itemPoints",
    "fires",
    "doors",
    "daggers",
    "holyWaters",
    "zombies",
    "bats",
    "dogs",
    "mermen",
    "fireballs",
    "batBoss",
    "lanceKnight",
    "medusaHeads",
    "bonePillars",
    "ghosts",
    "medusaBoss",
    "snakes",
    "igors",
    "skeletons",
    "crumble",
    "ravens",
    "mummyBoss",
    "wrappings",
    "birds",
    "boneDragons",
    "axeKnights",
    "grimReaperBoss",
    "draculaBoss",
    "frankensteinBoss",
    "titleImage",
    "titleBats",
    "gateBats",
    "gates",
    "clouds",
    "castleMaps",
    "castleBottom",
    "castleTop",
    "castleTrees",
    "axe",
    "boomerang",
    "weaponBorder",
    "smallHeart",
    "spark",
    "brickFragment",
    "torch",
    "droplets",
    "orb",
    "platform",
    "spikes",
    "bone",
    "sickle",
    "simonBack",
    "blank_32",
    "boss_1",
    "boss_2",
    "ending",
    "game_over",
    "map_1",
    "map_2",
    "map_3",
    "map_4",
    "prologue",
    "simon_killed",
    "stage_1_1",
    "stage_1_2",
    "stage_2_1",
    "stage_3_1",
    "stage_4_1",
    "stage_4_2",
    "stage_5_1",
    "stage_6_1",
    "stage_6_2",
    "stage_cleared",
    "dracula_dead",
    "advance_whip",
    "bat_killed",
    "bleep",
    "boss_hurt",
    "boss_killed_1",
    "boss_killed_2",
    "boss_killed_3",
    "breaks_wall",
    "crumble_sfx",
    "dog_killed",
    "door_opens_1",
    "door_opens_2",
    "gain_potion",
    "got_money",
    "heartbeat",
    "hit_candle",
    "killed_1",
    "killed_2",
    "killed_3",
    "killed_4",
    "killed_5",
    "lose_potion",
    "merman_spit",
    "one_up",
    "pressed_enter",
    "simon_hurt",
    "splash",
    "torch_breaks",
    "whip_1",
    "whip_2",
    "wing_flaps",
    "zombie_killed",
    "got_double",
    "kill_all_sfx",
    "simon_in_pit",
    "threw_dagger",
    "got_weapon",
    "used_holy_water",
    "spinning",
    "raven_killed",
    "ching",
    "snuffed",
    "medusa_head_killed",
    "stunned",
    "watch_tick",
    "twang",
    "large_bat_killed",
    "thunder",
    "fire_ball_shot",
    "dracula_to_bats",
    "lands",
    "currentSong",
    "requestedSong",
    "currentMusic",
    "input",
    "buttonMapping",
    "controlInput",
    "inputConfigMode",
    "startupAudioQueued",
    "loadingCompleteHandler",
    "stateSaveInvalidatedHandler",
    "windowedDisplayModeProvider",
    "browserFullscreenController",
    "darkDisplayMode",
    "browserSuspended",
    "browserSuspendedMusicOn",
    "browserSuspendedSoundOn",
    "titleInputMappingLines",
    "titleInputMappingX",
    "titleInputMappingCacheDirty"
]);

const SONG_IDS: SongId[] = [
    "boss_1",
    "boss_2",
    "ending",
    "stage_1_1",
    "stage_1_2",
    "stage_2_1",
    "stage_3_1",
    "stage_4_1",
    "stage_4_2",
    "stage_5_1",
    "stage_6_1",
    "stage_6_2"
];

const STANDALONE_MUSIC_IDS: MusicId[] = [
    "game_over",
    "map_1",
    "map_2",
    "map_3",
    "map_4",
    "prologue",
    "simon_killed",
    "stage_cleared",
    "dracula_dead"
];

export class StickvaniaGameStateSerializer {
    public createSnapshot(main: Main, appVersion: string): StickvaniaGameStateSnapshot {
        if (!main.isStateSaveReady()) {
            throw new Error("Game state is not ready to save.");
        }

        const captureStage = main.shouldCaptureStageForStateSave();
        const context = this.createCaptureContext(main);
        const stage = captureStage ? this.captureStage(context) : null;
        const things: ThingSnapshot[] = stage === null
            ? []
            : context.things.map((thing, id) => this.captureThing(context, thing, id));

        return {
            version: GAME_STATE_VERSION,
            appVersion,
            savedAt: new Date().toISOString(),
            mode: this.snapshotMode(main),
            mainFields: this.captureMainFields(context),
            random: this.captureRandom(main.random),
            stage,
            things,
            audio: this.captureAudio(main)
        };
    }

    public restoreSnapshot(main: Main, gc: GameContainer, snapshot: StickvaniaGameStateSnapshot): void {
        if (!this.isSupportedSnapshot(snapshot)) {
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
        this.restoreAudio(context, snapshot.audio);
        main.setBrowserSuspended(false);
        main.clearInputPressedRecords();
        main.resetNextFrameTime();
    }

    public isSupportedSnapshot(snapshot: StickvaniaGameStateSnapshot): boolean {
        if (!snapshot || snapshot.version !== GAME_STATE_VERSION) {
            return false;
        }
        if (typeof snapshot.mode !== "number" || !Array.isArray(snapshot.things)) {
            return false;
        }
        if (snapshot.stage === null) {
            if (snapshot.things.length !== 0) {
                return false;
            }
        } else if (!snapshot.stage) {
            return false;
        }
        if (!snapshot.audio || !Array.isArray(snapshot.audio.songs)) {
            return false;
        }
        return snapshot.things.every((thing) => !!THING_TYPES[thing.type]);
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
        for (const key of Object.keys(thing as unknown as FieldBag)) {
            if (key === "main") {
                continue;
            }
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
        const fields: EncodedRecord = {};
        for (const key of Object.keys(thing as unknown as FieldBag)) {
            const value = this.getField<unknown>(thing, key);
            if (!this.shouldCaptureThingField(key, value)) {
                continue;
            }
            fields[key] = this.encodeValue(context, value, `${thing.constructor.name}.${key}`);
        }
        return {
            id,
            type: thing.constructor.name,
            fields
        };
    }

    private shouldCaptureThingField(key: string, value: unknown): boolean {
        if (key === "main") {
            return false;
        }
        return !this.isRuntimeResource(value);
    }

    private captureMainFields(context: CaptureContext): EncodedRecord {
        const main = context.main;
        const fields: EncodedRecord = {};
        for (const key of Object.keys(main as unknown as FieldBag)) {
            const value = this.getField<unknown>(main, key);
            if (!this.shouldCaptureMainField(key, value)) {
                continue;
            }
            fields[key] = this.encodeValue(context, this.mainFieldValueForSnapshot(main, key, value), `Main.${key}`);
        }
        return fields;
    }

    private mainFieldValueForSnapshot(main: Main, key: string, value: unknown): unknown {
        if (main.mode !== Main.MODE_INPUT_CONFIG) {
            return value;
        }
        switch (key) {
            case "mode":
                return Main.MODE_TITLE_SCREEN;
            case "titleMenu":
                return Main.TITLE_MENU_INPUT;
            case "titleSelectedIndex":
                return 0;
            case "fadeState":
                return Main.FADE_DONE;
            case "fade":
                return Main.FADE_DONE;
            case "fadeReason":
                return 0;
            default:
                return value;
        }
    }

    private snapshotMode(main: Main): number {
        return main.mode === Main.MODE_INPUT_CONFIG ? Main.MODE_TITLE_SCREEN : main.mode;
    }

    private shouldCaptureMainField(key: string, value: unknown): boolean {
        if (MAIN_EXCLUDED_FIELDS.has(key)) {
            return false;
        }
        if (this.isRuntimeResource(value) || value instanceof Song || value instanceof Thing
                || value instanceof ThingStack || value instanceof StageSegment || value instanceof Region
                || value instanceof StairsEntry) {
            return false;
        }
        if (Array.isArray(value) && this.arrayContainsRuntimeResource(value)) {
            return false;
        }
        return typeof value !== "function";
    }

    private encodeValue(context: CaptureContext, value: unknown, path: string): EncodedValue {
        if (value === null || value === undefined || typeof value === "string"
                || typeof value === "number" || typeof value === "boolean") {
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
            if (MAIN_EXCLUDED_FIELDS.has(key)) {
                continue;
            }
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
        region.platforms = snapshot.platforms.map((id) => this.thingOrNull(context, id));
        region.stageNumber = snapshot.stageNumber;
    }

    private restoreMainRoots(context: RestoreContext, snapshot: StageSnapshot): void {
        const main = context.main;
        const currentSegment = snapshot.currentSegmentIndex === null ? null : context.stageSegments[snapshot.currentSegmentIndex];
        this.setField(main, "stageSegments", context.stageSegments);
        this.setField(main, "stageSegment", currentSegment);
        this.setField(main, "checkpoint", this.thingOrNull(context, snapshot.checkpoint));
        main.simon = this.thingOrNull(context, snapshot.simon) as any;
        main.door = this.thingOrNull(context, snapshot.door) as any;
        main.map = currentSegment === null ? null : currentSegment.map;
        main.walls = currentSegment === null ? null : currentSegment.walls;
        main.mapWidth = currentSegment === null ? 0 : currentSegment.mapWidth;
        main.platforms = snapshot.platforms === null ? null : snapshot.platforms.map((id) => this.thingOrNull(context, id));
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
        main.simon = null as any;
        main.door = null as any;
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
        stack.things = new Array<Thing>(capacity).fill(null);
        stack.top = snapshot.$stack.things.length - 1;
        for (let i = 0; i < snapshot.$stack.things.length; i++) {
            stack.things[i] = this.thingOrNull(context, snapshot.$stack.things[i]);
        }
    }

    private decodeValue(context: RestoreContext, value: EncodedValue): unknown {
        if (value === null || value === undefined || typeof value === "string"
                || typeof value === "number" || typeof value === "boolean") {
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
            if (thing instanceof Fireball) {
                this.setField(thing, "image", context.main.fireballs[thing.vx < 0 ? Main.LEFT : Main.RIGHT]);
            }
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
        return {
            currentSong: this.songIdForSong(main, main.currentSong),
            requestedSong: this.songIdForSong(main, main.requestedSong),
            currentMusic: main.currentMusic === null ? null : this.captureMusic(main, main.currentMusic),
            songs: SONG_IDS
                .map((id) => this.captureSong(main, id))
                .filter((song): song is SongSnapshot => song !== null)
        };
    }

    private captureSong(main: Main, id: SongId): SongSnapshot | null {
        const song = this.songForId(main, id);
        if (song === null) {
            return null;
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
        const looped = Boolean(this.getField<boolean>(music, "looped"));
        return {
            id,
            looped,
            paused: Boolean(this.getField<boolean>(music, "paused")),
            playing: music.playing(),
            playbackRate: this.numberField(music, "playbackRate", 1),
            position: this.normalizeMusicPosition(music, music.getPosition(), looped),
            volume: music.getVolume()
        };
    }

    private restoreAudio(context: RestoreContext, snapshot: AudioSnapshot): void {
        const main = context.main;
        main.stopAllSounds();
        for (const songSnapshot of snapshot.songs) {
            const song = this.songForId(main, songSnapshot.id);
            if (song === null) {
                continue;
            }
            song.setPlayingForState(songSnapshot.playing);
            this.restoreMusicPassive(main, songSnapshot.intro);
            this.restoreMusicPassive(main, songSnapshot.loop);
        }

        main.currentSong = this.songForId(main, snapshot.currentSong);
        main.requestedSong = this.songForId(main, snapshot.requestedSong);
        main.currentMusic = snapshot.currentMusic === null ? null : this.musicForId(main, snapshot.currentMusic.id);

        if (snapshot.currentMusic !== null) {
            this.restoreMusicPassive(main, snapshot.currentMusic);
            if (snapshot.currentMusic.playing || snapshot.currentMusic.paused) {
                this.restoreActiveMusic(context, snapshot.currentMusic);
            } else {
                context.gc.setMusicOn(true);
            }
            return;
        }

        const currentSongSnapshot = snapshot.currentSong === null
            ? null
            : snapshot.songs.find((song) => song.id === snapshot.currentSong) ?? null;
        if (currentSongSnapshot === null) {
            context.gc.setMusicOn(true);
            return;
        }
        const activeSongMusic = this.activeSongMusicSnapshot(currentSongSnapshot);
        if (activeSongMusic !== null) {
            this.restoreActiveMusic(context, activeSongMusic);
        } else {
            context.gc.setMusicOn(true);
        }
    }

    private activeSongMusicSnapshot(song: SongSnapshot): MusicSnapshot | null {
        if (song.intro !== null && (song.intro.playing || song.intro.paused)) {
            return song.intro;
        }
        if (song.loop !== null && (song.loop.playing || song.loop.paused)) {
            return song.loop;
        }
        return null;
    }

    private restoreMusicPassive(main: Main, snapshot: MusicSnapshot | null): void {
        if (snapshot === null) {
            return;
        }
        const music = this.musicForId(main, snapshot.id);
        if (music === null) {
            return;
        }
        music.setVolume(snapshot.volume);
        music.setPosition(this.normalizeMusicPosition(music, snapshot.position, snapshot.looped));
    }

    private restoreActiveMusic(context: RestoreContext, snapshot: MusicSnapshot): void {
        const music = this.musicForId(context.main, snapshot.id);
        if (music === null) {
            context.gc.setMusicOn(true);
            return;
        }
        if (!snapshot.playing && !snapshot.paused) {
            this.restoreMusicPassive(context.main, snapshot);
            context.gc.setMusicOn(true);
            return;
        }
        const position = this.normalizeMusicPosition(music, snapshot.position, snapshot.looped);
        context.gc.setMusicOn(false);
        music.setVolume(snapshot.volume);
        music.setPosition(position);
        if (snapshot.looped) {
            music.loop(snapshot.playbackRate, snapshot.volume);
        } else {
            music.play(snapshot.playbackRate, snapshot.volume);
        }
        void music.ready().then(() => {
            globalThis.setTimeout(() => {
                music.setPosition(this.normalizeMusicPosition(music, position, snapshot.looped));
                music.setVolume(snapshot.volume);
                if (snapshot.paused) {
                    music.pause();
                }
                context.gc.setMusicOn(true);
            }, 0);
        }).catch(() => {
            context.gc.setMusicOn(true);
        });
    }

    private captureRandom(random: JavaRandom): RandomSnapshot {
        return {
            seed0: this.numberField(random, "seed0", 0),
            seed1: this.numberField(random, "seed1", 0),
            seed2: this.numberField(random, "seed2", 0)
        };
    }

    private restoreRandom(random: JavaRandom, snapshot: RandomSnapshot): void {
        this.setField(random, "seed0", snapshot.seed0);
        this.setField(random, "seed1", snapshot.seed1);
        this.setField(random, "seed2", snapshot.seed2);
    }

    private callCreateStage(main: Main, stageIndex: number): void {
        this.getField<(stageIndex: number, setCheckpoint: boolean) => void>(main, "createStage").call(main, stageIndex, true);
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

    private normalizeMusicPosition(music: Music, position: number, looped: boolean): number {
        const sanitized = Number.isFinite(position) ? Math.max(0, position) : 0;
        if (!looped) {
            return sanitized;
        }
        const buffer = this.getField<{ duration?: unknown } | null>(music, "buffer");
        const duration = typeof buffer?.duration === "number" ? buffer.duration : 0;
        if (!Number.isFinite(duration) || duration <= 0) {
            return sanitized;
        }
        return sanitized % duration;
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

    private isRuntimeResource(value: unknown): boolean {
        return value instanceof Image || value instanceof Sound || value instanceof Music || value instanceof Color;
    }

    private arrayContainsRuntimeResource(value: unknown[]): boolean {
        for (const item of value) {
            if (this.isRuntimeResource(item)) {
                return true;
            }
            if (Array.isArray(item) && this.arrayContainsRuntimeResource(item)) {
                return true;
            }
        }
        return false;
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

    private numberField(target: unknown, key: string, fallback: number): number {
        const value = this.getField<unknown>(target, key);
        return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
