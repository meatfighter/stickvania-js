import { isMusicPlaybackSnapshot } from "slick2d-ts/slick/MusicPlaybackState";
import { SONG_FIELD_NAMES, STANDALONE_MUSIC_FIELD_NAMES } from "../AudioRegistry.js";
import type { InputConfigModeSnapshot } from "../InputConfigMode.js";
import type { AudioSnapshot, MusicId, MusicSnapshot, SongId, StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";

const JAVA_INT_MIN = -2_147_483_648;
const JAVA_INT_MAX = 2_147_483_647;
const MAX_VALUE_DEPTH = 64;
const MAX_ARRAY_LENGTH = 4096;
const MAX_RECORD_FIELDS = 512;
const MAX_STRING_LENGTH = 4096;
const MAX_GENERAL_NUMBER_MAGNITUDE = 1_000_000;
const MAX_POSITION_MAGNITUDE = 131_072;
const MAX_VELOCITY_MAGNITUDE = 512;
const MAX_COLLISION_OFFSET_MAGNITUDE = 4096;
const MAX_MUSIC_POSITION_SECONDS = 86_400;
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
const AUDIO_FIELDS = ["musicOn", "soundOn", "currentSong", "requestedSong", "currentMusic", "songs"] as const;
const SONG_FIELDS = ["id", "playing", "intro", "loop"] as const;
const MUSIC_FIELDS = ["id", "playback"] as const;
const INPUT_CONFIG_FIELDS = [
    "stepIndex",
    "doneDelay",
    "armDelay",
    "message",
    "finished",
    "draft",
    "assignedKeys",
    "assignedControllerButtons",
    "controllerButtonDown",
    "controllerUpDown",
    "controllerDownDown",
    "controllerLeftDown",
    "controllerRightDown"
] as const;
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
    if (snapshot.stage !== null && !isReasonableValue(snapshot.stage, "stage", 0)) {
        return false;
    }
    if (snapshot.stage !== null && snapshot.mainFields.stageIndex !== snapshot.stage.stageIndex) {
        return false;
    }
    if (!isReasonableInputConfig(snapshot.inputConfigMode)) {
        return false;
    }
    if (!isReasonableAudio(snapshot.audio)) {
        return false;
    }
    return true;
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
        isReasonableValue(snapshot.draft, "draft", 0) &&
        isReasonableValue(snapshot.assignedKeys, "assignedKeys", 0) &&
        isReasonableValue(snapshot.assignedControllerButtons, "assignedControllerButtons", 0)
    );
}

function isReasonableAudio(snapshot: AudioSnapshot): boolean {
    if (
        !isRecord(snapshot) ||
        !hasExactFields(snapshot, AUDIO_FIELDS) ||
        typeof snapshot.musicOn !== "boolean" ||
        typeof snapshot.soundOn !== "boolean" ||
        !isNullableSongId(snapshot.currentSong) ||
        !isNullableSongId(snapshot.requestedSong) ||
        !Array.isArray(snapshot.songs) ||
        snapshot.songs.length !== SONG_FIELD_NAMES.length
    ) {
        return false;
    }

    const seenSongs = new Set<string>();
    const music = new Map<MusicId, MusicSnapshot>();
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

    if (snapshot.currentMusic !== null) {
        if (!isReasonableMusic(snapshot.currentMusic)) {
            return false;
        }
        const existing = music.get(snapshot.currentMusic.id);
        if (existing !== undefined && !sameMusicPlayback(existing, snapshot.currentMusic)) {
            return false;
        }
        music.set(snapshot.currentMusic.id, snapshot.currentMusic);
    }

    // Slick owns one logical Music transport. More than one active transport is
    // contradictory and restore order must never decide which one wins.
    return Array.from(music.values()).filter((part) => part.playback.transport !== "stopped").length <= 1;
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
    return isMusicPlaybackSnapshot(snapshot.playback) && snapshot.playback.positionSeconds <= MAX_MUSIC_POSITION_SECONDS;
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

function isReasonableNumber(value: number, key: string): boolean {
    if (!Number.isFinite(value)) {
        return false;
    }
    if (key === "score") {
        return Number.isInteger(value) && value >= JAVA_INT_MIN && value <= JAVA_INT_MAX;
    }
    if (key === "vx" || key === "vy" || key === "G") {
        return Math.abs(value) <= MAX_VELOCITY_MAGNITUDE;
    }
    if (key === "x" || key === "y") {
        return Math.abs(value) <= MAX_POSITION_MAGNITUDE;
    }
    if (key === "rx1" || key === "rx2" || key === "ry1" || key === "ry2") {
        return Math.abs(value) <= MAX_COLLISION_OFFSET_MAGNITUDE;
    }
    return Math.abs(value) <= MAX_GENERAL_NUMBER_MAGNITUDE;
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
