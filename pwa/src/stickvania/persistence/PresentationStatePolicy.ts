import { isFloorBreakSnapshotValid } from "./FloorBreakStatePolicy.js";
import { CREDITS_TITLES, creditsSecondLine } from "../CreditsText.js";
import { isCastleTransitionValid } from "./CastlePresentationPhasePolicy.js";
import { isRestorableGameStateMode } from "./GameStatePolicy.js";

// Existing serialized Main values. Tests compare these to the real Main constants.
export const PRESENTATION_MODE = { TITLE: 0, DEMO: 1, CONTINUE: 2, PLAY: 4, INTRO: 5, MAP: 6, CASTLE: 7, CREDITS: 8, INPUT: 10 } as const;
export const PRESENTATION_FADE = { DONE: 0, OUT: 1, IN: 2, MAX: 22 } as const;
export const PRESENTATION_REASON = {
    STAIRS: 0,
    CHECKPOINT: 1,
    MAP: 2,
    INTRO: 3,
    CONTINUE: 4,
    TITLE: 5,
    CASTLE: 6,
    DEMO: 7,
    CREDITS: 8,
    NEXT_CREDIT: 9,
    INPUT: 10
} as const;
const M = PRESENTATION_MODE,
    F = PRESENTATION_FADE,
    R = PRESENTATION_REASON;
const CREDIT_STAGE = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4] as const;
type Fields = Readonly<Record<string, unknown>>;

function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}
function integer(value: unknown, min: number, max: number): value is number {
    return finite(value) && Number.isInteger(value) && value >= min && value <= max;
}
function simulationMode(mode: unknown): boolean {
    return mode === M.PLAY || mode === M.DEMO || mode === M.CREDITS;
}
function completedTally(f: Fields): boolean {
    return f.beatStageFlag === true && f.beatStageDelay === 0 && f.playerPower === 16 && f.time === 0 && f.hearts === 0;
}
function finalCreditReady(f: Fields): boolean {
    return (
        f.creditsIndex === 12 &&
        f.recordingIndex === 728 &&
        f.creditsPaused === true &&
        f.creditsAdvance === true &&
        f.creditsDelay === 0 &&
        f.creditsTitleIndex === CREDITS_TITLES[12].length &&
        f.creditsTitleIndex2 === creditsSecondLine(12).length
    );
}

/** Necessary stable producer states; never call half-way through a simulation tick. */
export function isCreditsPresentationValid(f: Fields): boolean {
    if (f.mode !== M.CREDITS) return true; // Unrelated modes retain stale credits fields.
    const index = f.creditsIndex,
        cursor = f.recordingIndex;
    if (!integer(index, 0, 12) || !integer(cursor, 0, 728) || f.stageIndex !== CREDIT_STAGE[index]) return false;
    const last = index === 12;
    if (f.creditsPresents !== last || typeof f.creditsPaused !== "boolean" || typeof f.creditsAdvance !== "boolean") return false;
    const first = f.creditsTitleIndex,
        second = f.creditsTitleIndex2,
        delay = f.creditsDelay;
    const title = CREDITS_TITLES[index];
    if (title === undefined) return false;
    const firstLength = title.length,
        secondLength = creditsSecondLine(index).length;
    if (!integer(first, 0, firstLength) || !integer(second, 0, secondLength) || !integer(delay, 0, last ? 1365 : 182)) return false;
    const empty = first === 0 && second === 0 && delay === 0 && f.creditsAdvance === false;
    const complete = first === firstLength && second === secondLength;

    if (!f.creditsPaused) {
        // cursor 728 is legal for ONE stable frame: the last input was consumed,
        // but updateCredits has not yet run to begin its first caption letter.
        if (last || !empty) return false;
    } else {
        if (cursor !== 728) return false; // Otherwise updateCredits and gameplay both stall forever.
        if (first < firstLength && second !== 0) return false;
        if (f.creditsAdvance) {
            if (!complete) return false;
        } else {
            if (delay > 15) return false;
            if (first === 0 && !(last && empty)) return false;
        }
    }
    if (last && cursor !== 728) return false;

    if (!integer(f.fadeState, F.DONE, F.IN) || !integer(f.fade, 0, F.MAX) || !integer(f.fadeReason, R.STAIRS, R.INPUT)) return false;
    if (f.fadeState === F.DONE) return f.fade === 0 && !(last && empty); // Final-card entry is still fading in.
    if (f.fadeState === F.IN) {
        if (f.fadeReason === R.STAIRS) return !f.creditsPaused && empty;
        const incoming = index === 0 ? R.CREDITS : R.NEXT_CREDIT;
        return f.fadeReason === incoming && empty && (last ? f.creditsPaused && cursor === 728 : !f.creditsPaused && cursor === 0);
    }
    if (f.creditsPaused) {
        return complete && f.creditsAdvance && delay === 0 && f.fadeReason === (last ? R.TITLE : R.NEXT_CREDIT);
    }
    // Credits execute shared gameplay: do not outlaw a genuine stair/death/tally
    // transition solely because today's twelve recordings may not reach it.
    return f.fadeReason === R.STAIRS || f.fadeReason === R.CHECKPOINT || f.fadeReason === R.MAP || f.fadeReason === R.CONTINUE;
}

function savedSimon(snapshot: Fields): Fields | null {
    if (!record(snapshot.stage) || !integer(snapshot.stage.simon, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(snapshot.things)) return null;
    const id = snapshot.stage.simon;
    const thing: unknown = snapshot.things.find((candidate: unknown) => record(candidate) && candidate.id === id);
    return record(thing) && thing.type === "Simon" && record(thing.fields) ? thing.fields : null;
}
function deathTransition(f: Fields, simon: Fields | null): boolean {
    return simulationMode(f.mode) && f.beatStageFlag === false && f.playerPower === 0 && simon !== null && integer(simon.dead, 474, 1_000_000);
}

/** Validate active routing authority, not dormant fadeReason values. */
function isFadeRouteValid(snapshot: Fields, f: Fields): boolean {
    if (f.fadeState !== F.OUT) return true;
    const simon = savedSimon(snapshot);
    switch (f.fadeReason) {
        case R.STAIRS:
            return (
                simulationMode(f.mode) &&
                f.beatStageFlag === false &&
                simon !== null &&
                simon.onStairs === true &&
                simon.hurt === false &&
                finite(simon.y) &&
                simon.y <= 416 &&
                (simon.y <= -62 || simon.y >= 285)
            );
        case R.CHECKPOINT:
            if (!integer(f.players, 1, 100)) return false; // Dispatcher decrements before rebuilding.
            if (f.mode === M.INTRO) return f.stageIndex === 0 && f.introTime === 0;
            if (f.mode === M.MAP) {
                return (
                    integer(f.stageIndex, 1, 5) &&
                    f.mapScreenTargetX === (f.stageIndex > 2 ? -192 : 64) &&
                    f.mapScreenX === f.mapScreenTargetX &&
                    f.introSimonX === 576 &&
                    f.mapDelay === 0
                );
            }
            if (f.mode === M.CONTINUE) return f.continueSelected === true;
            return deathTransition(f, simon);
        case R.MAP:
            if (!simulationMode(f.mode) || !integer(f.stageIndex, 0, 4)) return false;
            // Stage three's FloorBreaker clears floorBreaking and is removed in
            // its terminal update. FloorBreakStatePolicy corroborates walls and retirement;
            // final-tally health/hearts are not this route's contract.
            if (f.stageIndex === 2) return f.beatStageFlag === false && f.floorBreaking === false;
            return completedTally(f);
        case R.INTRO:
            return f.mode === M.TITLE && f.titleMenu === 0 && f.titleSelectedIndex === 0;
        case R.CONTINUE:
            return f.players === 0 && deathTransition(f, simon);
        case R.TITLE:
            return f.mode === M.DEMO || (f.mode === M.CONTINUE && f.continueSelected === false) || (f.mode === M.CREDITS && finalCreditReady(f));
        case R.CASTLE:
            return f.mode === M.PLAY && f.stageIndex === 5 && completedTally(f);
        case R.DEMO:
            return f.mode === M.TITLE && f.titleMenu === 0 && finite(f.titleTimeout) && f.titleTimeout <= 0;
        case R.CREDITS:
            return f.mode === M.CASTLE && isCastleTransitionValid(f);
        case R.NEXT_CREDIT:
            return (
                f.mode === M.CREDITS &&
                integer(f.creditsIndex, 0, 11) &&
                f.creditsPaused === true &&
                f.recordingIndex === 728 &&
                f.creditsAdvance === true &&
                f.creditsDelay === 0
            );
        case R.INPUT:
            return f.mode === M.TITLE && f.titleMenu === 2 && f.titleSelectedIndex === 0;
        default:
            return false;
    }
}

/** Current ending ownership, not a general soundtrack/history authenticator. */
export function isEndingAudioStateValid(f: Fields, audio: unknown): boolean {
    const pendingCastle = f.mode === M.PLAY && f.fadeState === F.OUT && f.fadeReason === R.CASTLE;
    if (!pendingCastle && f.mode !== M.CASTLE && f.mode !== M.CREDITS) return true;
    if (!record(audio) || audio.currentSong !== "ending" || audio.currentMusic !== null || !Array.isArray(audio.songs)) return false;
    if (typeof audio.requestedSong !== "string") return false;
    if (f.mode !== M.CREDITS && audio.requestedSong !== "ending") return false;
    // Credits stage construction intentionally changes requestedSong; never
    // require equality to the still-current ending Song there.
    const matches = audio.songs.filter((song: unknown) => record(song) && song.id === "ending");
    if (matches.length !== 1) return false;
    const song: unknown = matches[0];
    if (!record(song) || song.playing !== true || song.intro !== null || !record(song.loop) || song.loop.id !== "ending.loop" || !record(song.loop.playback))
        return false;
    return song.loop.playback.transport === "playing" && song.loop.playback.looped === true;
}

/** Read-only adjunct to full schema/graph/audio validation; also safe for menu preflight. */
export function isPresentationSnapshotValid(snapshot: unknown): boolean {
    if (!record(snapshot) || !record(snapshot.mainFields)) return false;
    const f = snapshot.mainFields;
    if (
        !isRestorableGameStateMode(f.mode) ||
        snapshot.mode !== f.mode ||
        !integer(f.fadeState, F.DONE, F.IN) ||
        !integer(f.fade, 0, F.MAX) ||
        !integer(f.fadeReason, R.STAIRS, R.INPUT)
    )
        return false;
    // Main publishes DONE only when its fade counter has reached zero.
    if (f.fadeState === F.DONE && f.fade !== 0) return false;
    return (
        isCastleTransitionValid(f) &&
        isCreditsPresentationValid(f) &&
        isFadeRouteValid(snapshot, f) &&
        isFloorBreakSnapshotValid(snapshot) &&
        isEndingAudioStateValid(f, snapshot.audio)
    );
}
