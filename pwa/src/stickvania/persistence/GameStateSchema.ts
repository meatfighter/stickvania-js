import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state-v10");
export const GAME_STATE_VERSION = 10;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
