import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state-v11");
export const GAME_STATE_VERSION = 11;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
