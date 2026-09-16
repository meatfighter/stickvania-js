import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

// Development cutover: only the current logical-audio schema is supported.
export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state-v13");
export const GAME_STATE_VERSION = 13;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
