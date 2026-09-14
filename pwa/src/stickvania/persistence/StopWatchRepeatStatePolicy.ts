const WEAPON_TYPE_STOP_WATCH = 5;
const WEAPON_REPEATS_SINGLE = 0;

/** Reject persisted StopWatch repeat state that normal gameplay can no longer create. */
export function isStopWatchRepeatStateValid(mainFields: Record<string, unknown>): boolean {
    return mainFields.weaponType !== WEAPON_TYPE_STOP_WATCH || mainFields.weaponRepeats === WEAPON_REPEATS_SINGLE;
}
