type Fields = Readonly<Record<string, unknown>>;
function record(v: unknown): v is Fields {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
function integer(v: unknown, lo: number, hi: number): v is number {
    return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

/** These are the exact twenty cells FloorBreaker removes, not an arbitrary cleared region. */
export const FLOOR_BREAK_CELLS: ReadonlyArray<readonly [number, number]> = [
    [144, 6],
    [145, 6],
    [146, 7],
    [147, 8],
    ...Array.from({ length: 16 }, (_, i): readonly [number, number] => [144 + i, 10])
];
export function isFloorBreakerFieldsValid(f: Fields): boolean {
    return integer(f.X, 143, 159) && integer(f.breakDelay, 0, 91) && integer(f.delay, 0, 1) && (f.delay !== 0 || f.X === 143);
}
function denseIds(stack: unknown): readonly number[] | null {
    if (!record(stack) || !record(stack.$stack) || !Array.isArray(stack.$stack.things)) return null;
    const ids = stack.$stack.things;
    return ids.every((id: unknown) => integer(id, 0, Number.MAX_SAFE_INTEGER)) ? (ids as number[]) : null;
}

/** Necessary terminal evidence in a stable snapshot; not a proof of the whole play history. */
export function isFloorBreakSnapshotValid(snapshot: unknown): boolean {
    if (!record(snapshot) || !record(snapshot.mainFields) || !Array.isArray(snapshot.things)) return false;
    const things = new Map<number, Fields>();
    for (const candidate of snapshot.things) {
        if (!record(candidate) || !integer(candidate.id, 0, Number.MAX_SAFE_INTEGER) || things.has(candidate.id)) return false;
        things.set(candidate.id, candidate);
        if (candidate.type === "FloorBreaker" && (!record(candidate.fields) || !isFloorBreakerFieldsValid(candidate.fields))) return false;
    }
    const f = snapshot.mainFields;
    const exiting = f.stageIndex === 2 && f.fadeState === 1 && f.fadeReason === 2;
    if (!exiting) return true; // Do not constrain dormant wall/transition data in other phases.
    if (![1, 4, 8].includes(f.mode as number) || f.beatStageFlag !== false || f.floorBreaking !== false || !record(snapshot.stage)) return false;
    const stage = snapshot.stage;
    if (stage.stageIndex !== 2 || stage.currentSegmentIndex !== 2 || !Array.isArray(stage.segments)) return false;
    const segment: unknown = stage.segments[2];
    if (!record(segment) || segment.stageSegmentIndex !== 2 || segment.mapWidth !== 160 || !Array.isArray(segment.walls)) return false;
    for (const [x, y] of FLOOR_BREAK_CELLS) {
        const row: unknown = segment.walls[y];
        if (!Array.isArray(row) || row[x] !== 0) return false; // Main.WALL_EMPTY
    }
    // The dispatcher drained and swapped these stacks before publication.
    // Do not forbid a harmless historical reference in an inactive region snapshot.
    for (const stack of [stage.regionThingStack, stage.regionStackSwap]) {
        const ids = denseIds(stack);
        if (ids === null || ids.some((id) => !things.has(id) || things.get(id)!.type === "FloorBreaker")) return false;
    }
    return true;
}
