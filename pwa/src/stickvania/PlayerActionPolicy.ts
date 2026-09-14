import type { Main } from "./Main.js";

const MODE_DEMO = 1;
const MODE_PLAYING = 4;
const MODE_CREDITS = 8;
const FADE_DONE = 0;
const FADE_IN = 2;
const STAIR_TOP_TRANSITION_Y = -62;
const STAIR_BOTTOM_TRANSITION_Y = 285;
const LAST_DEATH_SIMULATION_TICK = 473;

let registeredMain: Main | null = null;

/** Register the live game instance used by input-side frame/action checks. */
export function registerPlayerActionMain(main: Main): void {
    registeredMain = main;
}

/**
 * Return whether Main will reach its ordinary gameplay countdown check after
 * StickvaniaInput.update() returns. Demo uses the same gameplay simulation.
 * Credits are deliberately excluded because their pause decision happens later
 * in Main.updateFrame(), and Main.playSound() does not emit gameplay SFX there.
 */
function willReachCountdownCheck(main: Main): boolean {
    const simon = main.simon;
    if (simon === null) {
        return false;
    }

    const fadeAllowsGameplay = main.fadeState == FADE_DONE || (main.fadeState == FADE_IN && main.fade == 0);
    return (
        fadeAllowsGameplay &&
        (main.mode == MODE_PLAYING || main.mode == MODE_DEMO) &&
        !main.beatStageFlag &&
        simon.dead <= LAST_DEATH_SIMULATION_TICK &&
        simon.flashing == 0 &&
        main.door === null
    );
}

/**
 * Preflight Main's countdown immediately before Main evaluates it.
 *
 * Main intentionally owns the actual countdown and StopWatch short-circuit. This
 * helper adds the NES low-time cue for an imminent real decrement and compensates
 * the historical expression ordering where ++timeIncrementor precedes the
 * playerPower/floorBreaking guards. The temporary -1 phase at an original phase
 * of zero exists only between this call and Main's immediate ++; it is never a
 * stable/rendered/saved state.
 */
export function prepareRegisteredCountdownTimer(): void {
    const main = registeredMain;
    if (main === null || !willReachCountdownCheck(main) || main.timeFrozen != 0) {
        return;
    }

    if (main.playerPower <= 0 || main.floorBreaking) {
        main.timeIncrementor--;
        return;
    }

    if (main.timeIncrementor == 90 && main.time > 1 && main.time <= 31) {
        main.playSound(main.twang);
    }
}

/**
 * Return whether a delayed Simon attack may still resolve. This is intentionally
 * broader than sub-weapon eligibility: it covers both whip and sub-weapon windup
 * and only describes terminal/control-loss state, not hearts or repeat capacity.
 */
export function canSimonActionContinue(main: Main): boolean {
    const simon = main.simon;
    return (
        (main.mode == MODE_PLAYING || main.mode == MODE_DEMO || main.mode == MODE_CREDITS) &&
        main.fadeState == FADE_DONE &&
        main.playerPower > 0 &&
        simon !== null &&
        simon.dead == 0 &&
        !simon.hurt &&
        simon.flashing == 0 &&
        simon.y <= 416 &&
        !(simon.onStairs && (simon.y <= STAIR_TOP_TRANSITION_Y || simon.y >= STAIR_BOTTOM_TRANSITION_Y)) &&
        !main.beatStageFlag &&
        !main.floorBreaking &&
        main.time > 0 &&
        main.door === null &&
        !(main.stageIndex == 5 && main.enemyPower == 0)
    );
}

/**
 * A fresh Attack may start only while general action state is valid. This does
 * not inspect hearts, repeat capacity, weapon type, or timeFrozen, so Main's
 * normal unavailable-subweapon -> whip fallback remains authoritative.
 */
export function canRegisteredSimonActionStart(): boolean {
    return registeredMain === null || canSimonActionContinue(registeredMain);
}

/**
 * Cancel an active delayed attack completely. releasedWhip=false means a held
 * Attack cannot manufacture a fresh action after cancellation; the player must
 * release Attack first, matching the normal attack latch.
 */
export function cancelSimonAction(main: Main): void {
    const simon = main.simon;
    if (simon === null || (!simon.whipping && !simon.throwing)) {
        return;
    }
    simon.whipping = false;
    simon.throwing = false;
    simon.whipIncrementor = 0;
    simon.whipIndex = 0;
    simon.releasedWhip = false;
    main.stopRumble("weaponThrow");
}

/**
 * Main reads Attack immediately before advancing the delayed action. Reconcile
 * here as well as in Simon.update() because on-stairs gameplay intentionally
 * skips Simon.update(), and timeout can become terminal earlier in the same tick.
 */
export function reconcileRegisteredSimonActionBeforeAttackRead(): void {
    const main = registeredMain;
    if (main === null) {
        return;
    }
    const simon = main.simon;
    if (simon === null || (!simon.whipping && !simon.throwing)) {
        return;
    }
    if (!canSimonActionContinue(main)) {
        cancelSimonAction(main);
    }
}
