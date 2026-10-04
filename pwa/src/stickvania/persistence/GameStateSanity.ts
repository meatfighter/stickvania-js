import { isSnapshotJsonWithinBudget } from "../../app/SnapshotJsonBudget.js";
import { inspectSnapshotAuthority } from "./SnapshotAuthorityPolicy.js";
import { isAudioOwnerStateValid } from "./AudioOwnerPolicy.js";
import { GAME_STATE_MODE_PLAYING, isCountdownSnapshotValueValid } from "./GameStatePolicy.js";
import { isMusicPlaybackSnapshot } from "slick2d-ts/slick/MusicPlaybackState";
import { SONG_FIELD_NAMES, STANDALONE_MUSIC_FIELD_NAMES } from "../AudioRegistry.js";
import { isInputConfigModeSnapshot, type InputConfigModeSnapshot } from "../InputConfigMode.js";
import type { AudioSnapshot, MusicId, MusicSnapshot, SongId, StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";
import { isSoundEffectSnapshotsShape } from "./GameStateSoundEffects.js";

const MAX_VALUE_DEPTH = 64;
const MAX_ARRAY_LENGTH = 4096;
const MAX_RECORD_FIELDS = 512;
const MAX_STRING_LENGTH = 4096;

const MAX_INPUT_CONFIG_MESSAGE_LENGTH = 256;
const MAX_INPUT_CONFIG_STEP_INDEX = 6;
const MAX_INPUT_CONFIG_DONE_DELAY = 30;
const MAX_INPUT_CONFIG_ARM_DELAY = 8;

const EXPECTED_SONG_IDS = new Set<string>(SONG_FIELD_NAMES);
const EXPECTED_MUSIC_IDS = new Set<string>([
    ...STANDALONE_MUSIC_FIELD_NAMES,
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
const TOP_LEVEL_FIELDS = ["version", "appVersion", "savedAt", "mode", "mainFields", "inputConfigMode", "random", "stage", "things", "audio"] as const;
const AUDIO_FIELDS = ["currentSong", "requestedSong", "currentMusic", "songs", "sounds"] as const;
const SONG_FIELDS = ["id", "playing", "intro", "loop"] as const;
const MUSIC_FIELDS = ["id", "playback"] as const;
const INPUT_CONFIG_FIELDS = ["stepIndex", "doneDelay", "armDelay", "message", "finished", "draft", "assignedKeys", "assignedControllerBindings"] as const;
const INPUT_DRAFT_FIELDS = [
    "keyJump",
    "keyAttack",
    "keyUp",
    "keyDown",
    "keyLeft",
    "keyRight",
    "controllerJump",
    "controllerAttack",
    "controllerUp",
    "controllerDown",
    "controllerLeft",
    "controllerRight"
] as const;

export function isReasonableStickvaniaGameStateSnapshot(snapshot: StickvaniaGameStateSnapshot): boolean {
    if (!isWithinStickvaniaGameStateValidationBudget(snapshot)) {
        return false;
    }
    if (!isRecord(snapshot) || !hasExactFields(snapshot, TOP_LEVEL_FIELDS)) {
        return false;
    }
    if (typeof snapshot.appVersion !== "string" || snapshot.appVersion.length === 0 || snapshot.appVersion.length > 128) {
        return false;
    }
    if (typeof snapshot.savedAt !== "string" || snapshot.savedAt.length > 64 || !Number.isFinite(Date.parse(snapshot.savedAt))) {
        return false;
    }
    if (!isReasonableValue(snapshot.mainFields, "mainFields", 0) || !isReasonableValue(snapshot.things, "things", 0)) {
        return false;
    }
    if (!isRecord(snapshot.mainFields) || !isCountdownSnapshotValueValid(snapshot.mode, snapshot.mainFields.timeIncrementor)) {
        return false;
    }
    if (snapshot.stage !== null && !isReasonableValue(snapshot.stage, "stage", 0)) {
        return false;
    }
    if (snapshot.stage !== null && snapshot.mainFields.stageIndex !== snapshot.stage.stageIndex) {
        return false;
    }
    const authority = inspectSnapshotAuthority(snapshot);
    if (authority === null) {
        return false;
    }
    if (!isReasonableInputConfig(snapshot.inputConfigMode)) {
        return false;
    }
    const stopWatchHoldAllowed = snapshot.mode === GAME_STATE_MODE_PLAYING && authority.hasActiveStopWatch;
    if (!isReasonableAudio(snapshot.audio, stopWatchHoldAllowed, snapshot.mode)) {
        return false;
    }
    return true;
}

export function isWithinStickvaniaGameStateValidationBudget(value: unknown): boolean {
    return isSnapshotJsonWithinBudget(value);
}

function isReasonableInputConfig(snapshot: InputConfigModeSnapshot | null): boolean {
    if (snapshot === null) {
        return true;
    }
    if (
        !isRecord(snapshot) ||
        !hasExactFields(snapshot, INPUT_CONFIG_FIELDS) ||
        !isRecord(snapshot.draft) ||
        !hasExactFields(snapshot.draft, INPUT_DRAFT_FIELDS)
    ) {
        return false;
    }
    return (
        isIntegerInRange(snapshot.stepIndex, 0, MAX_INPUT_CONFIG_STEP_INDEX) &&
        isIntegerInRange(snapshot.doneDelay, 0, MAX_INPUT_CONFIG_DONE_DELAY) &&
        isIntegerInRange(snapshot.armDelay, 0, MAX_INPUT_CONFIG_ARM_DELAY) &&
        typeof snapshot.message === "string" &&
        snapshot.message.length <= MAX_INPUT_CONFIG_MESSAGE_LENGTH &&
        typeof snapshot.finished === "boolean" &&
        isReasonableValue(snapshot.draft, "draft", 0) &&
        isReasonableValue(snapshot.assignedKeys, "assignedKeys", 0) &&
        isReasonableValue(snapshot.assignedControllerBindings, "assignedControllerBindings", 0) &&
        isInputConfigModeSnapshot(snapshot)
    );
}

function isReasonableAudio(snapshot: AudioSnapshot, stopWatchHoldAllowed: boolean, mode: number): boolean {
    if (!isAudioOwnerStateValid(snapshot)) return false;
    if (
        !isRecord(snapshot) ||
        !hasExactFields(snapshot, AUDIO_FIELDS) ||
        !isNullableSongId(snapshot.currentSong) ||
        !isNullableSongId(snapshot.requestedSong) ||
        !Array.isArray(snapshot.songs) ||
        snapshot.songs.length !== SONG_FIELD_NAMES.length ||
        !isSoundEffectSnapshotsShape(snapshot.sounds)
    ) {
        return false;
    }

    const seenSongs = new Set<string>();
    const music = new Map<MusicId, MusicSnapshot>();
    let playingSong: SongId | null = null;
    for (const song of snapshot.songs) {
        if (
            !isRecord(song) ||
            !hasExactFields(song, SONG_FIELDS) ||
            typeof song.id !== "string" ||
            !EXPECTED_SONG_IDS.has(song.id) ||
            seenSongs.has(song.id) ||
            typeof song.playing !== "boolean"
        ) {
            return false;
        }
        seenSongs.add(song.id);
        if (song.playing) {
            if (playingSong !== null) {
                return false;
            }
            playingSong = song.id as SongId;
        }
        if (!isReasonableSongPart(song.id as SongId, "intro", song.intro) || !isReasonableSongPart(song.id as SongId, "loop", song.loop)) {
            return false;
        }
        for (const part of [song.intro, song.loop]) {
            if (part !== null) {
                const existing = music.get(part.id);
                if (existing !== undefined && !sameMusicPlayback(existing, part)) {
                    return false;
                }
                music.set(part.id, part);
            }
        }
    }
    if (seenSongs.size !== EXPECTED_SONG_IDS.size) {
        return false;
    }

    // Main's Song ownership has one stable current owner. A requested Song may
    // differ for one frame while ownership is being transferred, but clearing
    // requestedSong while leaving currentSong installed is impossible and would
    // make Main assign null and then call play() on it on the next gameplay tick.
    if (snapshot.currentSong === null) {
        if (playingSong !== null) {
            return false;
        }
    } else if (snapshot.requestedSong === null || playingSong !== snapshot.currentSong || snapshot.currentMusic !== null) {
        return false;
    }

    if (snapshot.currentMusic !== null) {
        if (!isReasonableMusic(snapshot.currentMusic) || snapshot.currentMusic.playback.transport === "paused") {
            // Standalone Music is scripted transition/death/presentation audio;
            // the stopwatch never pauses it.
            return false;
        }
        const existing = music.get(snapshot.currentMusic.id);
        if (existing !== undefined && !sameMusicPlayback(existing, snapshot.currentMusic)) {
            return false;
        }
        music.set(snapshot.currentMusic.id, snapshot.currentMusic);
    }

    const musicStates = Array.from(music.values());
    const active = musicStates.filter((part) => part.playback.transport !== "stopped");
    if (active.length > 1) return false;

    const owner = snapshot.currentSong === null ? undefined : snapshot.songs.find((song) => song.id === snapshot.currentSong);
    const belongsToOwner = (part: MusicSnapshot): boolean => owner !== undefined && (owner.intro?.id === part.id || owner.loop?.id === part.id);

    // A Song cannot borrow another Song's active transport as validation evidence.
    if (owner !== undefined && active.some((part) => !belongsToOwner(part))) return false;

    // Only PLAYING promises to promote this replacement on the next game tick.
    // Credits intentionally retain ending even when requestedSong differs.
    const pendingReplacement =
        mode === GAME_STATE_MODE_PLAYING && owner !== undefined && snapshot.requestedSong !== null && snapshot.requestedSong !== snapshot.currentSong;

    // The last watch may have departed while its OLD Song remains paused.
    if (active.some((part) => part.playback.transport === "paused")) {
        if (!active.every(belongsToOwner) || (!stopWatchHoldAllowed && !pendingReplacement)) {
            return false;
        }
    }

    // Music.poll can consume intro completion before another Main fixed tick.
    // The next Song.update starts the loop, including after a faithful restore.
    const betweenIntroAndLoop =
        owner !== undefined &&
        snapshot.currentSong === snapshot.requestedSong &&
        owner.intro !== null &&
        owner.loop !== null &&
        owner.intro.playback.transport === "stopped" &&
        owner.loop.playback.transport === "stopped";

    if (playingSong !== null && active.length === 0 && !stopWatchHoldAllowed && !pendingReplacement && !betweenIntroAndLoop) {
        return false;
    }
    return true;
}

function isReasonableSongPart(songId: SongId, suffix: "intro" | "loop", snapshot: MusicSnapshot | null): boolean {
    const id = `${songId}.${suffix}`;
    if (!EXPECTED_MUSIC_IDS.has(id)) {
        return snapshot === null;
    }
    return snapshot !== null && isReasonableMusic(snapshot) && snapshot.id === id;
}

function isReasonableMusic(snapshot: MusicSnapshot): boolean {
    if (!isRecord(snapshot) || !hasExactFields(snapshot, MUSIC_FIELDS) || typeof snapshot.id !== "string" || !EXPECTED_MUSIC_IDS.has(snapshot.id)) {
        return false;
    }
    return isMusicPlaybackSnapshot(snapshot.playback);
}

function sameMusicPlayback(left: MusicSnapshot, right: MusicSnapshot): boolean {
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

function isNullableSongId(value: unknown): value is SongId | null {
    return value === null || (typeof value === "string" && EXPECTED_SONG_IDS.has(value));
}

function isReasonableValue(value: unknown, key: string, depth: number): boolean {
    if (depth > MAX_VALUE_DEPTH) {
        return false;
    }
    if (value === null || typeof value === "boolean") {
        return true;
    }
    if (typeof value === "string") {
        return value.length <= MAX_STRING_LENGTH;
    }
    if (typeof value === "number") {
        return isReasonableNumber(value, key);
    }
    if (Array.isArray(value)) {
        return value.length <= MAX_ARRAY_LENGTH && value.every((entry) => isReasonableValue(entry, key, depth + 1));
    }
    if (!isRecord(value)) {
        return false;
    }
    const entries = Object.entries(value);
    if (entries.length > MAX_RECORD_FIELDS) {
        return false;
    }
    return entries.every(([entryKey, entryValue]) => isReasonableValue(entryValue, entryKey, depth + 1));
}

function isReasonableNumber(value: number, _key: string): boolean {
    // Exact field policies are authoritative; this traversal checks encoding.
    return Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function hasExactFields(value: Record<string, unknown>, expected: readonly string[]): boolean {
    const keys = Object.keys(value);
    return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
