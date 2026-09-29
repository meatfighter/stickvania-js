import { isRumbleDelayStep, type RumbleEffect, type RumblePulseStep } from "./RumbleEffects.js";

export type RumbleSample = {
    readonly pulse: RumblePulseStep | null;
    readonly remainingMs: number;
    readonly done: boolean;
};

/** Half-open intervals. Hardware completion is deliberately not an input. */
export function sampleRumble(effect: RumbleEffect, elapsedMs: number): RumbleSample {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { pulse: null, remainingMs: 0, done: true };
    let start = 0;
    for (const step of effect.pattern) {
        const duration = isRumbleDelayStep(step) ? step.delay : step.duration;
        if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid authored rumble duration.");
        const end = start + duration;
        if (elapsedMs < end) {
            const remainingMs = end - elapsedMs;
            return {
                pulse: isRumbleDelayStep(step) ? null : { ...step, duration: remainingMs },
                remainingMs,
                done: false
            };
        }
        start = end;
    }
    return { pulse: null, remainingMs: 0, done: true };
}

/** Death cannot be displaced by a simultaneous boss cue or routine feedback. */
export function rumblePriority(effect: RumbleEffect): number {
    return effect.id === "playerDeath" ? 2 : effect.exclusive === true ? 1 : 0;
}
