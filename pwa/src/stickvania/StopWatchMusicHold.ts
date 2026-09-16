import type { Main } from "./Main.js";
import { Orb } from "./Orb.js";
import { canSimonActionContinue, isStageThreeFloorBreaking } from "./PlayerActionPolicy.js";
import type { Song } from "./Song.js";

const MODE_DEMO = 1;
const MODE_PLAYING = 4;
const MODE_CREDITS = 8;

let held = false;
let heldMain: Main | null = null;

function hasVisibleFinalOrb(main: Main): boolean {
    for (const stack of [main.regionThingStack, main.regionStackSwap]) {
        for (let i = 0; i <= stack.top; i++) {
            const thing = stack.things[i];
            if (thing instanceof Orb && thing.appearDelay == 0) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Dracula's final hit disables only the StopWatch. The lock lasts through the
 * death presentation and the final orb's hidden delay; once the orb is visible,
 * StopWatch use is valid again until normal orb collection completes the stage.
 */
export function isDraculaDeathStopWatchLocked(main: Main): boolean {
    return main.stageIndex == 5 && main.enemyPower == 0 && !hasVisibleFinalOrb(main);
}

/**
 * Return whether the stopwatch is still a valid simulation effect. Demo and
 * credits recordings historically run the gameplay simulation and may use the
 * stopwatch, but only real MODE_PLAYING gameplay is allowed to hold BGM.
 */
export function canStopWatchRun(main: Main): boolean {
    const stageThreeFloorBreaking = isStageThreeFloorBreaking(main);
    return (
        (main.mode == MODE_PLAYING || main.mode == MODE_DEMO || main.mode == MODE_CREDITS) &&
        main.playerPower > 0 &&
        main.simon !== null &&
        main.simon.dead == 0 &&
        !main.beatStageFlag &&
        (!main.floorBreaking || stageThreeFloorBreaking) &&
        (main.time > 0 || stageThreeFloorBreaking) &&
        !isDraculaDeathStopWatchLocked(main)
    );
}

/** A new stopwatch may start only when the delayed action and stopwatch are both valid. */
export function canStartStopWatch(main: Main): boolean {
    return canSimonActionContinue(main) && canStopWatchRun(main) && main.timeFrozen == 0;
}

function shouldHold(main: Main): boolean {
    return main.mode == MODE_PLAYING && canStopWatchRun(main) && main.timeFrozen > 0;
}

function songBelongsToMain(main: Main, song: Song): boolean {
    return (
        main.boss_1 === song ||
        main.boss_2 === song ||
        main.ending === song ||
        main.stage_1_1 === song ||
        main.stage_1_2 === song ||
        main.stage_2_1 === song ||
        main.stage_3_1 === song ||
        main.stage_4_1 === song ||
        main.stage_4_2 === song ||
        main.stage_5_1 === song ||
        main.stage_6_1 === song ||
        main.stage_6_2 === song
    );
}

function abandonHold(): void {
    held = false;
    heldMain = null;
}

/** Clear runtime-only pause ownership before rebuilding a saved game. */
export function resetStopWatchMusicHold(): void {
    abandonHold();
}

/** Song uses this to defer an owner selected while gameplay BGM is frozen. */
export function isStopWatchMusicHeld(song: Song): boolean {
    if (held && heldMain !== null && (!shouldHold(heldMain) || !songBelongsToMain(heldMain, song))) {
        abandonHold();
    }
    return held;
}

/**
 * State restoration rebuilds StopWatch objects before audio transport. Mark the
 * logical hold now; restored paused Song transport is adopted during the final
 * reconciliation without manufacturing playback.
 */
export function prepareStopWatchMusicHoldAfterRestore(main: Main): void {
    if (!shouldHold(main)) {
        return;
    }
    held = true;
    heldMain = main;
}

function releaseHold(main: Main): void {
    held = false;
    heldMain = null;

    const currentSong = main.currentSong;
    if (currentSong === null) {
        return;
    }

    if (currentSong === main.requestedSong) {
        currentSong.releaseStopWatchHold();
    } else {
        currentSong.cancelStopWatchHold();
    }
}

/**
 * Reconcile the stopwatch effect with the current gameplay Song. Standalone
 * Music is intentionally never paused: all standalone tracks in Stickvania are
 * scripted transition/death/presentation cues whose timelines keep advancing.
 */
export function reconcileStopWatchMusic(main: Main): void {
    if (!shouldHold(main)) {
        if (held && heldMain === main) {
            releaseHold(main);
        }
        return;
    }

    if (!held || heldMain !== main) {
        abandonHold();
        held = true;
        heldMain = main;
    }

    const currentSong = main.currentSong;
    if (currentSong !== null && currentSong === main.requestedSong) {
        currentSong.holdForStopWatch();
    }
}
