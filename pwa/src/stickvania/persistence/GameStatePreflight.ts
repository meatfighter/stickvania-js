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

/** Menu preflight has no write capability and never migrates or deletes saves. */
export function hasPotentialStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string = GAME_STATE_STORAGE_KEY): boolean {
    try {
        const text = storage.getItem(storageKey);
        return text !== null && text.length <= MAX_GAME_STATE_TEXT_LENGTH && isPotentialStickvaniaGameStateSnapshot(JSON.parse(text) as unknown);
    } catch {
        return false;
    }
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
    const currentMusicValue = isRecord(audioValue) ? audioValue.currentMusic : null;
    const currentMusicPlayback = isRecord(currentMusicValue) && isRecord(currentMusicValue.playback) ? currentMusicValue.playback : null;
    const hasObsoletePausedStandalone = isRecord(currentMusicPlayback) && currentMusicPlayback.transport === "paused";
    const hasObsoleteTerminalStopWatch = isRecord(mainFieldsValue) && hasActiveStopWatch(snapshot) && isTerminalStopWatchState(snapshot, mainFieldsValue);
    const hasInvalidStopWatchRepeatState =
        isRecord(mainFieldsValue) && mainFieldsValue.weaponType === WEAPON_TYPE_STOP_WATCH && mainFieldsValue.weaponRepeats !== WEAPON_REPEATS_SINGLE;
    return (
        (stageRequired ? hasStageShape : stageValue === null && snapshot.things.length === 0) &&
        (isInputConfigGameStateMode(snapshot.mode)
            ? isInputConfigModeSnapshot(snapshot.inputConfigMode)
            : snapshot.inputConfigMode == null) &&
        isRecord(mainFieldsValue) &&
        mainFieldsValue.mode === snapshot.mode &&
        isRecord(snapshot.random) &&
        isRecord(audioValue) &&
        !Object.prototype.hasOwnProperty.call(audioValue, "musicOn") &&
        !Object.prototype.hasOwnProperty.call(audioValue, "soundOn") &&
        Array.isArray(audioValue.songs) &&
        hasPotentialSoundEffects(audioValue.sounds) &&
        !hasObsoletePausedStandalone &&
        !hasObsoleteTerminalStopWatch &&
        !hasInvalidStopWatchRepeatState &&
        isAxeKnightShieldSnapshotStateValid(snapshot)
    );
}

function hasActiveStopWatch(snapshot: Record<string, unknown>): boolean {
    if (!Array.isArray(snapshot.things)) {
        return false;
    }
    return snapshot.things.some(
        (thing) => isRecord(thing) && thing.type === "StopWatch" && isRecord(thing.fields) && typeof thing.fields.lifeTime === "number" && thing.fields.lifeTime > 0
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

function hasVisibleFinalOrb(snapshot: Record<string, unknown>): boolean {
    if (!Array.isArray(snapshot.things)) {
        return false;
    }
    return snapshot.things.some((thing) => isRecord(thing) && thing.type === "Orb" && isRecord(thing.fields) && thing.fields.appearDelay === 0);
}

function isStageThreeFloorBreaking(mainFields: Record<string, unknown>): boolean {
    return mainFields.stageIndex === 2 && mainFields.floorBreaking === true;
}

function isTerminalStopWatchState(snapshot: Record<string, unknown>, mainFields: Record<string, unknown>): boolean {
    const stageThreeFloorBreaking = isStageThreeFloorBreaking(mainFields);
    return (
        (typeof mainFields.playerPower === "number" && mainFields.playerPower <= 0) ||
        mainFields.beatStageFlag === true ||
        (mainFields.floorBreaking === true && !stageThreeFloorBreaking) ||
        (typeof mainFields.time === "number" && mainFields.time <= 0 && !stageThreeFloorBreaking) ||
        (mainFields.stageIndex === 5 && mainFields.enemyPower === 0 && !hasVisibleFinalOrb(snapshot))
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
