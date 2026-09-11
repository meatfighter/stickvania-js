import { isMusicPlaybackSnapshot } from "slick2d-ts/slick/MusicPlaybackState";
import { SONG_FIELD_NAMES } from "../AudioRegistry.js";
import type { InputConfigModeSnapshot } from "../InputConfigMode.js";
import type { AudioSnapshot, MusicSnapshot, StickvaniaGameStateSnapshot } from "./GameStateSnapshot.js";

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
        !Array.isArray(snapshot.songs) ||
        snapshot.songs.length !== SONG_FIELD_NAMES.length
    ) {
        return false;
    }
    const seen = new Set<string>();
    for (const song of snapshot.songs) {
        if (!isRecord(song) || !hasExactFields(song, SONG_FIELDS) || !EXPECTED_SONG_IDS.has(song.id) || seen.has(song.id)) {
            return false;
        }
        seen.add(song.id);
        if ((song.intro !== null && !isReasonableMusic(song.intro)) || (song.loop !== null && !isReasonableMusic(song.loop))) {
            return false;
        }
    }
    if (seen.size !== EXPECTED_SONG_IDS.size) {
        return false;
    }
    return snapshot.currentMusic === null || isReasonableMusic(snapshot.currentMusic);
}

function isReasonableMusic(snapshot: MusicSnapshot): boolean {
    if (!isRecord(snapshot) || !hasExactFields(snapshot, MUSIC_FIELDS)) {
        return false;
    }
    return isMusicPlaybackSnapshot(snapshot.playback) && snapshot.playback.positionSeconds <= MAX_MUSIC_POSITION_SECONDS;
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
