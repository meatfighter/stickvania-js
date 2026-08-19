import { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } from "./GameStateSchema.js";

type GameStateStorage = {
    getItem(key: string): string | null;
    removeItem(key: string): void;
};

const GAME_STATE_STAGELESS_MODES = new Set([0, 10]);
const GAME_STATE_RESTORABLE_MODES = new Set([0, 1, 2, 4, 5, 6, 7, 8, 10]);
const GAME_STATE_MODE_INPUT_CONFIG = 10;

export function hasPotentialStoredStickvaniaGameState(storage: GameStateStorage): boolean {
    try {
        const text = storage.getItem(GAME_STATE_STORAGE_KEY);
        if (text === null) {
            return false;
        }
        if (!isPotentialStickvaniaGameStateSnapshot(JSON.parse(text) as unknown)) {
            clearStoredStickvaniaGameState(storage);
            return false;
        }
        return true;
    } catch {
        clearStoredStickvaniaGameState(storage);
        return false;
    }
}

export function isPotentialStickvaniaGameStateSnapshot(snapshot: unknown): boolean {
    if (!isRecord(snapshot)) {
        return false;
    }

    const stageValue = snapshot.stage;
    const mainFieldsValue = snapshot.mainFields;
    const hasStageShape =
        stageValue !== null &&
        typeof stageValue === "object" &&
        typeof (stageValue as { stageIndex?: unknown }).stageIndex === "number" &&
        Array.isArray((stageValue as { segments?: unknown }).segments);

    return (
        snapshot.version === GAME_STATE_VERSION &&
        typeof snapshot.mode === "number" &&
        GAME_STATE_RESTORABLE_MODES.has(snapshot.mode) &&
        Array.isArray(snapshot.things) &&
        stageValue !== undefined &&
        (stageValue === null || typeof stageValue === "object") &&
        (stageValue !== null || snapshot.things.length === 0) &&
        (!GAME_STATE_STAGELESS_MODES.has(snapshot.mode) || stageValue === null) &&
        (GAME_STATE_STAGELESS_MODES.has(snapshot.mode) || stageValue !== null) &&
        (stageValue === null || hasStageShape) &&
        (snapshot.mode !== GAME_STATE_MODE_INPUT_CONFIG || snapshot.inputConfigMode != null) &&
        (snapshot.mode === GAME_STATE_MODE_INPUT_CONFIG || snapshot.inputConfigMode == null) &&
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

function clearStoredStickvaniaGameState(storage: GameStateStorage): void {
    try {
        storage.removeItem(GAME_STATE_STORAGE_KEY);
    } catch {
        // Storage can be disabled in hardened/private browser contexts.
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}
