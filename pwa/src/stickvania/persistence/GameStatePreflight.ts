import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } from "./GameStateSchema.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";

type GameStateStorage = {
    getItem(key: string): string | null;
    removeItem(key: string): void;
};

export function hasPotentialStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string = GAME_STATE_STORAGE_KEY): boolean {
    try {
        const text = storage.getItem(storageKey);
        if (text === null) return false;
        const snapshot = JSON.parse(text) as unknown;
        if (isFutureVersionStickvaniaGameStateSnapshot(snapshot)) return false;
        if (!isPotentialStickvaniaGameStateSnapshot(snapshot)) {
            clearStoredStickvaniaGameState(storage, storageKey);
            return false;
        }
        return true;
    } catch {
        clearStoredStickvaniaGameState(storage, storageKey);
        return false;
    }
}

function isFutureVersionStickvaniaGameStateSnapshot(snapshot: unknown): boolean {
    return isRecord(snapshot) && typeof snapshot.version === "number" && Number.isInteger(snapshot.version) && snapshot.version > GAME_STATE_VERSION;
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
    const hasStageShape =
        stageValue !== null &&
        typeof stageValue === "object" &&
        typeof (stageValue as { stageIndex?: unknown }).stageIndex === "number" &&
        Array.isArray((stageValue as { segments?: unknown }).segments);
    return (
        (stageRequired ? hasStageShape : stageValue === null && snapshot.things.length === 0) &&
        (isInputConfigGameStateMode(snapshot.mode) ? snapshot.inputConfigMode != null : snapshot.inputConfigMode == null) &&
        mainFieldsValue !== null &&
        typeof mainFieldsValue === "object" &&
        (mainFieldsValue as { mode?: unknown }).mode === snapshot.mode &&
        snapshot.random !== null &&
        typeof snapshot.random === "object" &&
        snapshot.audio !== null &&
        typeof snapshot.audio === "object" &&
        Array.isArray((snapshot.audio as { songs?: unknown }).songs)
    );
}

function clearStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string): void {
    try {
        storage.removeItem(storageKey);
    } catch {
        // Storage can be disabled in hardened/private browser contexts.
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}
