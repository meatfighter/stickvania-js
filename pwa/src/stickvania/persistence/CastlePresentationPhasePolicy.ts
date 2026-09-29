import { CASTLE_LAST_ACTIVE_TICK } from "../../rumble/CastleCrumbleTimeline.js";
import { GAME_STATE_MODE_CASTLE_FALLS, GAME_STATE_MODE_PLAYING } from "./GameStatePolicy.js";

// Main's wire values. Keep this reader constructor-free; verify parity with Main in tests.
const FADE_DONE = 0;
const FADE_OUT = 1;
const FADE_IN = 2;
const FADE_MAX = 22;
const SHOW_CASTLE_FALLS = 6;
const SHOW_CREDITS = 8;

function isCompletedFinalTally(fields: Readonly<Record<string, unknown>>): boolean {
    return (
        fields.stageIndex === 5 &&
        fields.beatStageFlag === true &&
        fields.beatStageDelay === 0 &&
        fields.playerPower === 16 &&
        fields.time === 0 &&
        fields.hearts === 0
    );
}

/** Stable snapshot boundary only, never half-way through Main.updateFrame(). */
export function isCastleTransitionValid(fields: Readonly<Record<string, unknown>>): boolean {
    const inCastle = fields.mode === GAME_STATE_MODE_CASTLE_FALLS;
    const entering = fields.fadeState === FADE_OUT && fields.fadeReason === SHOW_CASTLE_FALLS;
    const leaving = fields.fadeState === FADE_OUT && fields.fadeReason === SHOW_CREDITS;
    // Inactive/stale fade reasons outside castle mode have no transition authority.
    if (!inCastle && !entering && !leaving) return true;

    const fade = fields.fade;
    if (typeof fade !== "number" || !Number.isInteger(fade) || fade < 0 || fade > FADE_MAX) return false;
    if (!inCastle) {
        // Reject both a counterfeit castle entry and a credits jump from another mode.
        return entering && fields.mode === GAME_STATE_MODE_PLAYING && isCompletedFinalTally(fields);
    }
    if (!isCompletedFinalTally(fields)) return false;

    const tick = fields.castleCrumbleRumbleTicks;
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0 || tick > CASTLE_LAST_ACTIVE_TICK) return false;
    if (tick === 0) return fields.fadeState === FADE_IN && fields.fadeReason === SHOW_CASTLE_FALLS;
    if (fields.fadeState === FADE_DONE) return fade === 0 && fields.fadeReason === SHOW_CASTLE_FALLS;
    return tick === CASTLE_LAST_ACTIVE_TICK && fields.fadeState === FADE_OUT && fields.fadeReason === SHOW_CREDITS;
}
