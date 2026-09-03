import { FIRST_PUBLIC_GAME_STATE_VERSION, GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } from "./GameStateSchema.js";
import { isInputConfigGameStateMode, isRestorableGameStateMode, isStageRequiredGameStateMode } from "./GameStatePolicy.js";

type GameStateStorage = {
    getItem(key: string): string | null;
    removeItem(key: string): void;
};

export function hasPotentialStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string = GAME_STATE_STORAGE_KEY): boolean {
    let text: string | null;
    try {
        text = storage.getItem(storageKey);
    } catch {
        return false;
    }
    if (text === null) return false;

    let snapshot: unknown;
    try {
        snapshot = JSON.parse(text) as unknown;
    } catch {
        clearStoredStickvaniaGameState(storage, storageKey);
        return false;
    }

    const version = getStickvaniaGameStateVersion(snapshot);
    if (version !== null && version >= FIRST_PUBLIC_GAME_STATE_VERSION && version !== GAME_STATE_VERSION) {
        return false;
    }
    if (!isPotentialStickvaniaGameStateSnapshot(snapshot)) {
        clearStoredStickvaniaGameState(storage, storageKey);
        return false;
    }
    return true;
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

function getStickvaniaGameStateVersion(snapshot: unknown): number | null {
    if (!isRecord(snapshot)) {
        return null;
    }
    const version = snapshot.version;
    return typeof version === "number" && Number.isInteger(version) ? version : null;
}

function clearStoredStickvaniaGameState(storage: GameStateStorage, storageKey: string): void {
    try {
        storage.removeItem(storageKey);
    } catch {
        // Storage can be disabled in hardened/private browser contexts.
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
