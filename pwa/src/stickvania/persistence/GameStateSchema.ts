import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

// Current save schema: only this exact format is restorable; earlier internal schemas are not migrated.
export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state");
export const GAME_STATE_VERSION = 23;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
