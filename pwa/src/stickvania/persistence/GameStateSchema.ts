import { getBrowserStorageKey } from "../BrowserStorageKeys.js";

export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey("game-state");
export const GAME_STATE_VERSION = 9;
export const FIRST_PUBLIC_GAME_STATE_VERSION = 9;
export const MAX_GAME_STATE_TEXT_LENGTH = 2_000_000;
