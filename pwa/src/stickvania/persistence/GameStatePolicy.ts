export const GAME_STATE_MODE_TITLE_SCREEN = 0;
export const GAME_STATE_MODE_DEMO = 1;
export const GAME_STATE_MODE_CONTINUE_SCREEN = 2;
export const GAME_STATE_MODE_PLAYING = 4;
export const GAME_STATE_MODE_INTRO = 5;
export const GAME_STATE_MODE_MAP = 6;
export const GAME_STATE_MODE_CASTLE_FALLS = 7;
export const GAME_STATE_MODE_CREDITS = 8;
export const GAME_STATE_MODE_INPUT_CONFIG = 10;

const RESTORABLE_GAME_STATE_MODES = new Set<number>([
    GAME_STATE_MODE_TITLE_SCREEN,
    GAME_STATE_MODE_DEMO,
    GAME_STATE_MODE_CONTINUE_SCREEN,
    GAME_STATE_MODE_PLAYING,
    GAME_STATE_MODE_INTRO,
    GAME_STATE_MODE_MAP,
    GAME_STATE_MODE_CASTLE_FALLS,
    GAME_STATE_MODE_CREDITS,
    GAME_STATE_MODE_INPUT_CONFIG
]);

const STAGELESS_GAME_STATE_MODES = new Set<number>([GAME_STATE_MODE_TITLE_SCREEN, GAME_STATE_MODE_INPUT_CONFIG]);

export function isRestorableGameStateMode(mode: unknown): mode is number {
    return typeof mode === "number" && Number.isInteger(mode) && RESTORABLE_GAME_STATE_MODES.has(mode);
}

export function isStageRequiredGameStateMode(mode: number): boolean {
    return isRestorableGameStateMode(mode) && !STAGELESS_GAME_STATE_MODES.has(mode);
}

export function isInputConfigGameStateMode(mode: number): boolean {
    return mode === GAME_STATE_MODE_INPUT_CONFIG;
}
