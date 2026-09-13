import { Music } from "slick2d-ts";
import { Main } from "./Main.js";

let held = false;
let heldMain: Main | null = null;
let pausedStandalone: Music | null = null;
let pendingStandalone: Music | null = null;
let classifyRestoredStandalone = false;

function isSameLiveGame(main: Main): boolean {
    return heldMain === main && main.mode == Main.MODE_PLAYING && main.timeFrozen > 0;
}

function shouldHold(main: Main): boolean {
    return (
        main.mode == Main.MODE_PLAYING &&
        main.playerPower > 0 &&
        main.simon !== null &&
        main.simon.dead == 0 &&
        !main.beatStageFlag &&
        main.timeFrozen > 0
    );
}

function abandonHold(): void {
    held = false;
    heldMain = null;
    pausedStandalone = null;
    pendingStandalone = null;
    classifyRestoredStandalone = false;
}

/** Clear runtime-only pause ownership before rebuilding a saved game. */
export function resetStopWatchMusicHold(): void {
    abandonHold();
}

/** Song uses this to defer an owner selected while gameplay music is frozen. */
export function isStopWatchMusicHeld(): boolean {
    if (held && heldMain !== null && !isSameLiveGame(heldMain)) {
        abandonHold();
    }
    return held;
}

/**
 * State restoration rebuilds StopWatch objects before audio transport. Mark the
 * logical hold now; Song/Music transport restoration will be adopted on the
 * first normal reconciliation rather than manufacturing playback here.
 */
export function prepareStopWatchMusicHoldAfterRestore(main: Main): void {
    if (!shouldHold(main)) {
        return;
    }
    held = true;
    heldMain = main;
    pausedStandalone = null;
    pendingStandalone = null;
    classifyRestoredStandalone = true;
}

function releaseHold(main: Main): void {
    const pausedMusic = pausedStandalone;
    const pendingMusic = pendingStandalone;

    held = false;
    heldMain = null;
    pausedStandalone = null;
    pendingStandalone = null;
    classifyRestoredStandalone = false;

    const currentSong = main.currentSong;
    if (currentSong !== null) {
        if (currentSong === main.requestedSong) {
            currentSong.releaseStopWatchHold();
        } else {
            currentSong.cancelStopWatchHold();
        }
        return;
    }

    // A requested Song already owns the next music state even though Main does
    // not install it until the next frame. Never resurrect a paused standalone
    // owner for one tick while that replacement is pending.
    if (main.requestedSong !== null) {
        const obsoleteMusic = main.currentMusic;
        if (obsoleteMusic !== null && obsoleteMusic.getTransportState() !== "stopped") {
            obsoleteMusic.stop();
        }
        return;
    }

    const currentMusic = main.currentMusic;
    if (currentMusic === null) {
        return;
    }
    if (currentMusic === pendingMusic) {
        currentMusic.play();
    } else if (currentMusic === pausedMusic && currentMusic.getTransportState() === "paused") {
        currentMusic.resume();
    }
}

/** Reconcile the logical stopwatch effect with the single current music owner. */
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
    if (currentSong !== null) {
        classifyRestoredStandalone = false;
        if (currentSong === main.requestedSong) {
            currentSong.holdForStopWatch();
        }
        pausedStandalone = null;
        pendingStandalone = null;
        return;
    }

    const currentMusic = main.currentMusic;
    if (currentMusic === null || currentMusic === pendingStandalone) {
        return;
    }

    const state = currentMusic.getTransportState();
    if (state === "stopped" && classifyRestoredStandalone) {
        // A pending standalone owner is represented durably as currentMusic with
        // a stopped transport. Only infer that meaning during state restoration;
        // an ordinarily ended one-shot must not be restarted by a later watch.
        classifyRestoredStandalone = false;
        pausedStandalone = null;
        pendingStandalone = currentMusic;
        return;
    }

    classifyRestoredStandalone = false;
    if (state === "playing") {
        currentMusic.pause();
    }
    if (currentMusic.getTransportState() === "paused") {
        pausedStandalone = currentMusic;
        pendingStandalone = null;
    }
}

/**
 * Dracula's death cue is the only nonterminal standalone gameplay Music swap.
 * While held, make it the latest logical owner without producing a start/pause
 * blip; release starts it from zero if it is still current.
 */
export function requestStopWatchAwareGameplayMusic(main: Main, music: Music): void {
    if (!held || heldMain !== main || !shouldHold(main)) {
        main.requestMusic(music);
        return;
    }

    if (main.currentSong !== null) {
        main.stopSong();
    }
    const oldMusic = main.currentMusic;
    if (oldMusic !== null && oldMusic !== music && oldMusic.getTransportState() !== "stopped") {
        oldMusic.stop();
    }

    main.requestedSong = null;
    main.currentSong = null;
    main.currentMusic = music;
    pausedStandalone = null;
    pendingStandalone = music;
    classifyRestoredStandalone = false;
}
