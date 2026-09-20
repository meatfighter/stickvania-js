import { isDisplayModePreference, type DisplayModePreference } from "../DisplayThemes.js";
import { getBrowserStorageKey } from "../stickvania/BrowserStorageKeys.js";
import { GAME_STATE_STORAGE_KEY } from "../stickvania/persistence/GameStateSchema.js";
import type { StickvaniaScalingPreference } from "../stickvania/StickvaniaBufferedGame.js";

export const DEFAULT_VOLUME = 0.1;
export const DEFAULT_RUMBLE_ENABLED = true;
export const DEFAULT_FULLSCREEN_PREFERENCE = true;
export const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";
export const DEFAULT_SCALING_PREFERENCE: StickvaniaScalingPreference = "crisp";
export const DEFAULT_DIFFICULTY = 0;
export const HARD_DIFFICULTY = 1;

const VOLUME_STORAGE_KEY = getBrowserStorageKey("volume");
const DISPLAY_MODE_STORAGE_KEY = getBrowserStorageKey("display-mode");
const SCALING_STORAGE_KEY = getBrowserStorageKey("scaling");
const RUMBLE_STORAGE_KEY = getBrowserStorageKey("rumble");
const FULLSCREEN_STORAGE_KEY = getBrowserStorageKey("fullscreen");
const DIFFICULTY_STORAGE_KEY = getBrowserStorageKey("difficulty");
const INPUT_MAPPING_STORAGE_KEY = getBrowserStorageKey("input-mapping");

const PWA_RESET_STORAGE_KEYS = [
    GAME_STATE_STORAGE_KEY,
    VOLUME_STORAGE_KEY,
    DISPLAY_MODE_STORAGE_KEY,
    SCALING_STORAGE_KEY,
    RUMBLE_STORAGE_KEY,
    FULLSCREEN_STORAGE_KEY,
    DIFFICULTY_STORAGE_KEY,
    INPUT_MAPPING_STORAGE_KEY
] as const;

export class BrowserPreferences {
    public volume = this.readVolume();
    public displayMode = this.readDisplayMode();
    public scaling = this.readScaling();
    public rumbleEnabled = this.readRumbleEnabled();
    public fullscreen = this.readFullscreen();
    public difficulty = this.readDifficulty();

    public setVolume(value: number, persist = true, isAuthorized: () => boolean = () => true): boolean {
        this.volume = BrowserPreferences.clampVolume(value);
        return !persist || this.write(VOLUME_STORAGE_KEY, String(Math.round(this.volume * 100)), "volume", isAuthorized);
    }

    public setDisplayMode(value: DisplayModePreference, isAuthorized: () => boolean = () => true): boolean {
        this.displayMode = value;
        return this.write(DISPLAY_MODE_STORAGE_KEY, value, "display theme", isAuthorized);
    }

    public setScaling(value: StickvaniaScalingPreference, isAuthorized: () => boolean = () => true): boolean {
        this.scaling = value;
        return this.write(SCALING_STORAGE_KEY, value, "scaling preference", isAuthorized);
    }

    public setRumbleEnabled(value: boolean, isAuthorized: () => boolean = () => true): boolean {
        this.rumbleEnabled = value;
        return this.write(RUMBLE_STORAGE_KEY, String(value), "rumble preference", isAuthorized);
    }

    public setFullscreen(value: boolean, isAuthorized: () => boolean = () => true): boolean {
        this.fullscreen = value;
        return this.write(FULLSCREEN_STORAGE_KEY, String(value), "fullscreen preference", isAuthorized);
    }

    public setDifficulty(value: number, isAuthorized: () => boolean = () => true): boolean {
        this.difficulty = value === HARD_DIFFICULTY ? HARD_DIFFICULTY : DEFAULT_DIFFICULTY;
        return this.write(DIFFICULTY_STORAGE_KEY, String(this.difficulty), "difficulty preference", isAuthorized);
    }

    public reset(isAuthorized: () => boolean = () => true): boolean {
        let success = true;
        for (const key of PWA_RESET_STORAGE_KEYS) {
            if (!isAuthorized()) {
                return false;
            }
            try {
                localStorage.removeItem(key);
            } catch (error) {
                success = false;
                console.warn(`Unable to clear Stickvania browser storage key ${key}.`, error);
            }
        }
        this.volume = DEFAULT_VOLUME;
        this.displayMode = DEFAULT_DISPLAY_MODE;
        this.scaling = DEFAULT_SCALING_PREFERENCE;
        this.rumbleEnabled = DEFAULT_RUMBLE_ENABLED;
        this.fullscreen = DEFAULT_FULLSCREEN_PREFERENCE;
        this.difficulty = DEFAULT_DIFFICULTY;
        return success;
    }

    public static clampVolume(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    private readVolume(): number {
        try {
            const value = Number.parseInt(localStorage.getItem(VOLUME_STORAGE_KEY) ?? String(Math.round(DEFAULT_VOLUME * 100)), 10);
            return Number.isFinite(value) ? BrowserPreferences.clampVolume(value / 100) : DEFAULT_VOLUME;
        } catch {
            return DEFAULT_VOLUME;
        }
    }

    private readDisplayMode(): DisplayModePreference {
        try {
            const value = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
            return isDisplayModePreference(value) ? value : DEFAULT_DISPLAY_MODE;
        } catch {
            return DEFAULT_DISPLAY_MODE;
        }
    }

    private readScaling(): StickvaniaScalingPreference {
        try {
            const value = localStorage.getItem(SCALING_STORAGE_KEY);
            return value === "smooth" || value === "crisp" || value === "pixel-perfect" ? value : DEFAULT_SCALING_PREFERENCE;
        } catch {
            return DEFAULT_SCALING_PREFERENCE;
        }
    }

    private readRumbleEnabled(): boolean {
        try {
            const value = localStorage.getItem(RUMBLE_STORAGE_KEY);
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
        } catch {
            return DEFAULT_RUMBLE_ENABLED;
        }
        return DEFAULT_RUMBLE_ENABLED;
    }

    private readFullscreen(): boolean {
        try {
            const value = localStorage.getItem(FULLSCREEN_STORAGE_KEY);
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
        } catch {
            return DEFAULT_FULLSCREEN_PREFERENCE;
        }
        return DEFAULT_FULLSCREEN_PREFERENCE;
    }

    private readDifficulty(): number {
        try {
            return Number.parseInt(localStorage.getItem(DIFFICULTY_STORAGE_KEY) ?? "", 10) === HARD_DIFFICULTY
                ? HARD_DIFFICULTY
                : DEFAULT_DIFFICULTY;
        } catch {
            return DEFAULT_DIFFICULTY;
        }
    }

    private write(key: string, value: string, label: string, isAuthorized: () => boolean): boolean {
        if (!isAuthorized()) {
            return false;
        }
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.warn(`Unable to save Stickvania ${label}.`, error);
            return false;
        }
    }
}
