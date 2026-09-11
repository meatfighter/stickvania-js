import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, MAX_GAME_STATE_TEXT_LENGTH } from "./GameStateSchema.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";

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
    return (
        (stageRequired ? hasStageShape : stageValue === null && snapshot.things.length === 0) &&
        (isInputConfigGameStateMode(snapshot.mode) ? snapshot.inputConfigMode != null : snapshot.inputConfigMode == null) &&
        isRecord(mainFieldsValue) &&
        mainFieldsValue.mode === snapshot.mode &&
        isRecord(snapshot.random) &&
        isRecord(snapshot.audio) &&
        typeof snapshot.audio.musicOn === "boolean" &&
        typeof snapshot.audio.soundOn === "boolean" &&
        Array.isArray(snapshot.audio.songs)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
