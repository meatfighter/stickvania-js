import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";

const WEAPON_TYPE_STOP_WATCH = 5;
const WEAPON_REPEATS_SINGLE = 0;

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
    const hasObsoleteTerminalStopWatch =
        isRecord(mainFieldsValue) &&
        typeof mainFieldsValue.timeFrozen === "number" &&
        mainFieldsValue.timeFrozen > 0 &&
        isTerminalStopWatchState(snapshot, mainFieldsValue);
    const hasInvalidStopWatchRepeatState =
        isRecord(mainFieldsValue) && mainFieldsValue.weaponType === WEAPON_TYPE_STOP_WATCH && mainFieldsValue.weaponRepeats !== WEAPON_REPEATS_SINGLE;
    return (
        (stageRequired ? hasStageShape : stageValue === null && snapshot.things.length === 0) &&
        (isInputConfigGameStateMode(snapshot.mode) ? snapshot.inputConfigMode != null : snapshot.inputConfigMode == null) &&
        isRecord(mainFieldsValue) &&
        mainFieldsValue.mode === snapshot.mode &&
        isRecord(snapshot.random) &&
        isRecord(audioValue) &&
        typeof audioValue.musicOn === "boolean" &&
        typeof audioValue.soundOn === "boolean" &&
        Array.isArray(audioValue.songs) &&
        !hasObsoletePausedStandalone &&
        !hasObsoleteTerminalStopWatch &&
        !hasInvalidStopWatchRepeatState
    );
}

function hasVisibleFinalOrb(snapshot: Record<string, unknown>): boolean {
    if (!Array.isArray(snapshot.things)) {
        return false;
    }
    return snapshot.things.some((thing) => isRecord(thing) && thing.type === "Orb" && isRecord(thing.fields) && thing.fields.appearDelay === 0);
}

function isTerminalStopWatchState(snapshot: Record<string, unknown>, mainFields: Record<string, unknown>): boolean {
    return (
        (typeof mainFields.playerPower === "number" && mainFields.playerPower <= 0) ||
        mainFields.beatStageFlag === true ||
        mainFields.floorBreaking === true ||
        (typeof mainFields.time === "number" && mainFields.time <= 0) ||
        (mainFields.stageIndex === 5 && mainFields.enemyPower === 0 && !hasVisibleFinalOrb(snapshot))
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
