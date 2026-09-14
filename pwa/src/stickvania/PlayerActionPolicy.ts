import type { Main } from "./Main.js";

const MODE_DEMO = 1;
const MODE_PLAYING = 4;
const MODE_CREDITS = 8;
const FADE_DONE = 0;
const STAIR_TOP_TRANSITION_Y = -62;
const STAIR_BOTTOM_TRANSITION_Y = 285;

let registeredMain: Main | null = null;

/** Register the live game instance used by input-side action checks. */
export function registerPlayerActionMain(main: Main): void {
    registeredMain = main;
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
