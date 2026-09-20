import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

// Current cutover schema: only this exact version is restorable.
export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state-v17");
export const GAME_STATE_VERSION = 17;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
