import { Music } from "slick2d-ts";
import { Main } from "./Main.js";
import type { Song } from "./Song.js";

let held = false;
let heldMain: Main | null = null;
let pausedStandalone: Music | null = null;

function isSameLiveGame(main: Main): boolean {
    return heldMain === main && main.mode == Main.MODE_PLAYING && main.timeFrozen > 0;
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
}

/** Clear runtime-only pause ownership before rebuilding a saved game. */
export function resetStopWatchMusicHold(): void {
    abandonHold();
}

/** Song uses this to defer an owner selected while gameplay music is frozen. */
export function isStopWatchMusicHeld(song: Song): boolean {
    if (held && heldMain !== null && (!isSameLiveGame(heldMain) || !songBelongsToMain(heldMain, song))) {
        abandonHold();
    }
    return held;
}

/**
 * State restoration rebuilds StopWatch objects before audio transport. Mark the
 * logical hold now; restored paused Music transport is adopted during the final
 * reconciliation without manufacturing playback.
 */
export function prepareStopWatchMusicHoldAfterRestore(main: Main): void {
    if (!shouldHold(main)) {
        return;
    }
    held = true;
    heldMain = main;
    pausedStandalone = null;
}

function releaseHold(main: Main): void {
    const pausedMusic = pausedStandalone;

    held = false;
    heldMain = null;
    pausedStandalone = null;

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
    if (currentMusic === pausedMusic && currentMusic?.getTransportState() === "paused") {
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
        if (currentSong === main.requestedSong) {
            currentSong.holdForStopWatch();
        }
        pausedStandalone = null;
        return;
    }

    const currentMusic = main.currentMusic;
    if (currentMusic === null) {
        pausedStandalone = null;
        return;
    }

    const state = currentMusic.getTransportState();
    if (state === "playing") {
        currentMusic.pause();
    }
    if (currentMusic.getTransportState() === "paused") {
        pausedStandalone = currentMusic;
    } else {
        // A naturally ended one-shot remains a stopped Main.currentMusic pointer.
        // It is not a pending owner and must never be resurrected by stopwatch release.
        pausedStandalone = null;
    }
}

/**
 * Dracula's death cue is the only nonterminal standalone gameplay Music swap.
 * While held, install it as a logically paused owner at position zero without
 * ever attaching a playback source. The paused transport is durable, so save /
 * restore can distinguish this pending cue from a naturally ended stopped cue.
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
    music.restorePlaybackState({
        transport: "paused",
        looped: false,
        playbackRate: 1,
        positionSeconds: 0,
        volume: 1,
        fade: null
    });
    pausedStandalone = music;
}
