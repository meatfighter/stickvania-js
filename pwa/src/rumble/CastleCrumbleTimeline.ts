import type { RumbleStep } from "./RumbleEffects.js";

// Browser Main deliberately preserves integer 1000 / 91 == 10 ms. Do not retime gameplay.
export const CASTLE_TICK_MS = 10;
export const CASTLE_FIRST_SPARK_TICK = 46;
export const CASTLE_SPARK_PERIOD_TICKS = 17;
export const CASTLE_FALL_START_TICK = 177;
export const CASTLE_LANDING_TICK = 722;
export const CASTLE_LAST_ACTIVE_TICK = 813;

/** Preserve authored counts/strengths, but fit each group to its real visual phase. */
export function makeCastleCrumblePattern(): RumbleStep[] {
    const result: RumbleStep[] = [];
    let cursor = 0;
    const appendAt = (at: number, duration: number, strong: number, weak: number): void => {
        if (at < cursor || duration <= 0) throw new Error("Overlapping castle rumble intervals.");
        if (at > cursor) result.push({ delay: at - cursor });
        result.push({ duration, strong, weak });
        cursor = at + duration;
    };
    const magnitude = (value: number): number => Math.max(0, Math.min(1, Math.round(value * 100) / 100));
    for (let i = 0; i < 8; i++) {
        appendAt((CASTLE_FIRST_SPARK_TICK + i * CASTLE_SPARK_PERIOD_TICKS) * CASTLE_TICK_MS, 48, 0.3, 0.72);
    }
    const fallingStart = CASTLE_FALL_START_TICK * CASTLE_TICK_MS;
    const landing = CASTLE_LANDING_TICK * CASTLE_TICK_MS;
    for (let i = 0; i < 25; i++) {
        const at = fallingStart + Math.round((i * (landing - fallingStart)) / 25);
        appendAt(at, 145, magnitude(0.28 + (0.34 * i) / 24), magnitude(0.18 + 0.1 * Math.sin(i * 0.9)));
    }
    appendAt(landing, 320, 0.88, 0.48);
    const tailStart = cursor;
    const tailLength = CASTLE_LAST_ACTIVE_TICK * CASTLE_TICK_MS - tailStart;
    const originalTailLength = 1455; // five 105-ms gaps plus 150,168,186,204,222-ms pulses
    let originalCursor = 0;
    for (let i = 0; i < 5; i++) {
        originalCursor += 105;
        const begin = tailStart + Math.round((originalCursor * tailLength) / originalTailLength);
        originalCursor += 150 + i * 18;
        const end = tailStart + Math.round((originalCursor * tailLength) / originalTailLength);
        const fraction = 1 - i / 5;
        appendAt(begin, end - begin, magnitude(0.38 * fraction), magnitude(0.2 * fraction));
    }
    if (cursor !== CASTLE_LAST_ACTIVE_TICK * CASTLE_TICK_MS) throw new Error("Castle rumble must finish inside its scene.");
    return result;
}

// The actual loop adds a JS 0.2 then frounds, not fround(n * 0.2).
const fallY: number[] = [Math.fround(111)];
for (let i = 1; i <= CASTLE_LANDING_TICK - CASTLE_FALL_START_TICK + 1; i++) {
    fallY.push(Math.fround(fallY[i - 1]! + 0.2));
}

/** Pure, constructor-free validation of the production castle state machine. */
export function isCastlePresentationValid(fields: Readonly<Record<string, unknown>>): boolean {
    const tick = fields.castleCrumbleRumbleTicks;
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0 || tick > CASTLE_LAST_ACTIVE_TICK) return false;
    // Castle fields are stale but harmless outside this mode. Keep the tick's global producer bound.
    if (fields.mode !== 7) return true;
    let count = 8;
    let visible = false;
    let sparkDelay = 45 - tick;
    if (tick >= CASTLE_FIRST_SPARK_TICK && tick < 176) {
        const iteration = Math.floor((tick - CASTLE_FIRST_SPARK_TICK) / CASTLE_SPARK_PERIOD_TICKS);
        const phase = (tick - CASTLE_FIRST_SPARK_TICK) % CASTLE_SPARK_PERIOD_TICKS;
        visible = phase <= 10;
        count = (visible ? 8 : 7) - iteration;
        sparkDelay = visible ? 10 - phase : 16 - phase;
    } else if (tick >= 176) {
        count = 0;
        sparkDelay = 5;
    }
    const fallen = Math.min(Math.max(0, tick - 176), fallY.length - 1);
    const delay = 91 - Math.max(0, tick - CASTLE_LANDING_TICK);
    if (
        fields.castleFallSparkCount !== count ||
        fields.castleFallSparkVisible !== visible ||
        fields.castleFallSparkDelay !== sparkDelay ||
        fields.castleFallY !== fallY[fallen] ||
        fields.castleFallDelay !== delay
    )
        return false;
    const x = fields.castleFallX;
    if (tick < CASTLE_FALL_START_TICK ? x !== 410 : typeof x !== "number" || !Number.isInteger(x) || x < 408 || x > 412) return false;
    if (tick >= CASTLE_FIRST_SPARK_TICK) {
        const sx = fields.castleFallSparkX;
        const sy = fields.castleFallSparkY;
        if (typeof sx !== "number" || !Number.isInteger(sx) || sx < 433 || sx > 448 || typeof sy !== "number" || !Number.isInteger(sy) || sy < 113 || sy > 128)
            return false;
    }
    return true;
}
