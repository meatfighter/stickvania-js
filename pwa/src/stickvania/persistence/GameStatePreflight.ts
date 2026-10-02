import { inspectSnapshotAuthority } from "./SnapshotAuthorityPolicy.js";
import { isAudioOwnerStateValid } from "./AudioOwnerPolicy.js";
import { isPresentationSnapshotValid } from "./PresentationStatePolicy.js";
import { MAX_PERSISTED_SOUND_EFFECT_VOICES, SOUND_EFFECT_FIELD_NAMES } from "../AudioRegistry.js";
import { isInputConfigModeSnapshot } from "../InputConfigMode.js";
import { isAxeKnightShieldSnapshotStateValid } from "./AxeKnightShieldStatePolicy.js";
import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";

const WEAPON_TYPE_STOP_WATCH = 5;
const WEAPON_REPEATS_SINGLE = 0;
const SOUND_EFFECT_IDS = new Set<string>(SOUND_EFFECT_FIELD_NAMES);

type GameStateStorage = {
    getItem(key: string): string | null;
};

export type PotentialStoredStickvaniaGameStateInspection =
    { readonly status: "read-failed" } | { readonly status: "missing" } | { readonly status: "invalid" } | { readonly status: "current" };

/** Menu preflight has no write capability and never migrates or deletes saves. */
export function inspectPotentialStoredStickvaniaGameState(
    storage: GameStateStorage,
    storageKey: string = GAME_STATE_STORAGE_KEY
): PotentialStoredStickvaniaGameStateInspection {
    let text: string | null;
    try {
        text = storage.getItem(storageKey);
    } catch {
        return { status: "read-failed" };
    }
    if (text === null) {
        return { status: "missing" };
    }
    if (text.length > MAX_GAME_STATE_TEXT_LENGTH) {
        return { status: "invalid" };
    }

    let snapshot: unknown;
    try {
        snapshot = JSON.parse(text) as unknown;
    } catch {
        return { status: "invalid" };
    }
    try {
        return isPotentialStickvaniaGameStateSnapshot(snapshot) ? { status: "current" } : { status: "invalid" };
    } catch {
        return { status: "invalid" };
    }
}

export function hasPotentialStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string = GAME_STATE_STORAGE_KEY): boolean {
    return inspectPotentialStoredStickvaniaGameState(storage, storageKey).status === "current";
}

export function hasPotentialBrowserStoredStickvaniaGameState(): boolean {
    try {
        return hasPotentialStoredStickvaniaGameState(localStorage);
    } catch {
        return false;
    }
}

export function isPotentialStickvaniaGameStateSnapshot(snapshot: unknown): boolean {
    if (!isRecord(snapshot) || snapshot.version !== GAME_STATE_VERSION || !isRestorableGameStateMode(snapshot.mode) || !Array.isArray(snapshot.things)) {
        return false;
    }
    const stageValue = snapshot.stage;
    const stageRequired = isStageRequiredGameStateMode(snapshot.mode);
    const mainFieldsValue = snapshot.mainFields;
    const hasStageShape = isRecord(stageValue) && typeof stageValue.stageIndex === "number" && Array.isArray(stageValue.segments);
    const audioValue = snapshot.audio;
    const hasInvalidStopWatchRepeatState =
        isRecord(mainFieldsValue) && mainFieldsValue.weaponType === WEAPON_TYPE_STOP_WATCH && mainFieldsValue.weaponRepeats !== WEAPON_REPEATS_SINGLE;
    return (
        (stageRequired ? hasStageShape : stageValue === null && snapshot.things.length === 0) &&
        (isInputConfigGameStateMode(snapshot.mode) ? isInputConfigModeSnapshot(snapshot.inputConfigMode) : snapshot.inputConfigMode == null) &&
        isRecord(mainFieldsValue) &&
        mainFieldsValue.mode === snapshot.mode &&
        isPresentationSnapshotValid(snapshot) &&
        isRecord(snapshot.random) &&
        isRecord(audioValue) &&
        !Object.prototype.hasOwnProperty.call(audioValue, "musicOn") &&
        !Object.prototype.hasOwnProperty.call(audioValue, "soundOn") &&
        Array.isArray(audioValue.songs) &&
        hasPotentialSoundEffects(audioValue.sounds) &&
        inspectSnapshotAuthority(snapshot) !== null &&
        isAudioOwnerStateValid(audioValue) &&
        !hasInvalidStopWatchRepeatState &&
        isAxeKnightShieldSnapshotStateValid(snapshot)
    );
}

function hasPotentialSoundEffects(value: unknown): boolean {
    if (!Array.isArray(value) || value.length > SOUND_EFFECT_FIELD_NAMES.length) {
        return false;
    }
    const seen = new Set<string>();
    let totalVoices = 0;
    for (const entry of value) {
        if (!isRecord(entry) || typeof entry.id !== "string" || !SOUND_EFFECT_IDS.has(entry.id) || seen.has(entry.id) || !isRecord(entry.playback)) {
            return false;
        }
        if (!Array.isArray(entry.playback.voices) || entry.playback.voices.length === 0) {
            return false;
        }
        totalVoices += entry.playback.voices.length;
        if (totalVoices > MAX_PERSISTED_SOUND_EFFECT_VOICES) {
            return false;
        }
        seen.add(entry.id);
    }
    return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
