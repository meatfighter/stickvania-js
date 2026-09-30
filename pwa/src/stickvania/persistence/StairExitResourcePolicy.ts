type Fields = Readonly<Record<string, unknown>>;
type LoadedStage = ReadonlyArray<{ readonly stage: ReadonlyArray<ReadonlyArray<number>> }>;
type LoadedStages = ReadonlyArray<LoadedStage>;
function record(v: unknown): v is Fields {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
function integer(v: unknown): v is number {
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}
function finite(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}
function slope(tile: number | undefined): -1 | 1 | null {
    if (tile === 92 || tile === 76) return -1; // backslash or L
    if (tile === 47 || tile === 82) return 1; // slash or R
    return null;
}
type Entry = { readonly x: number; readonly row: number; readonly column: number; readonly slope: -1 | 1 };

/** Resource-dependent corroboration of an outgoing stair transition, before any live mutation. */
export function isStairExitResourceValid(snapshot: unknown, loadedStages: LoadedStages | null): boolean {
    if (!record(snapshot) || !record(snapshot.mainFields)) return false;
    const f = snapshot.mainFields;
    if (f.fadeState !== 1 || f.fadeReason !== 0) return true;
    if (![1, 4, 8].includes(f.mode as number) || !record(snapshot.stage) || !Array.isArray(snapshot.things)) return false;
    const stage = snapshot.stage;
    if (!integer(stage.stageIndex) || !integer(stage.currentSegmentIndex) || !integer(stage.simon)) return false;
    const grid = loadedStages?.[stage.stageIndex]?.[stage.currentSegmentIndex]?.stage;
    if (grid === undefined || grid.length !== 11 || !Array.isArray(grid[0])) return false;
    const width = grid[0].length;
    if (width === 0 || grid.some((row) => !Array.isArray(row) || row.length !== width)) return false;
    const candidate: unknown = snapshot.things.find((v: unknown) => record(v) && v.id === stage.simon);
    if (!record(candidate) || candidate.type !== "Simon" || !record(candidate.fields)) return false;
    const s = candidate.fields;
    if (s.onStairs !== true || s.hurt !== false || !finite(s.x) || !finite(s.y)) return false;
    // One +/-1 stair step crossed the threshold. Preserve possible float32 subpixel values.
    const top = s.y > -63 && s.y <= -62;
    const bottom = s.y >= 285 && s.y < 286;
    if ((!top && !bottom) || s.up !== top) return false;
    let nearest: Entry | null = null;
    let distance = Number.MAX_SAFE_INTEGER;
    // Match convertStage's column-major entry order and followStairs' truncated float32 metric.
    for (let column = 0; column < width; column++) {
        for (const row of [0, 10]) {
            const kind = slope(grid[row]![column]);
            if (kind === null) continue;
            const x = column * 32 + (row === 0 ? (kind === -1 ? 32 : -63) : kind === -1 ? -7 : -24);
            const d = Math.trunc(Math.abs(Math.fround(s.x - x)));
            if (d < distance) {
                distance = d;
                nearest = { x, row, column, slope: kind };
            }
        }
    }
    if (nearest === null || nearest.row !== (top ? 0 : 10)) return false;
    const dx = top ? nearest.slope : -nearest.slope;
    const previousX = Math.fround(s.x - dx);
    const previousY = Math.fround(s.y + (top ? 1 : -1));
    const column = (Math.trunc(previousX) + 31) >> 5;
    const row = (Math.trunc(previousY) + 63) >> 5;
    if (column !== nearest.column || row !== nearest.row || slope(grid[row]?.[column]) !== nearest.slope) return false;
    if (bottom) {
        // Main's descending-stairs path also checks the next foot sample.
        const nextColumn = (Math.trunc(previousX) + (nearest.slope === 1 ? 30 : 32)) >> 5;
        const nextRow = (Math.trunc(previousY) + 64) >> 5;
        if (slope(grid[nextRow]?.[nextColumn]) !== nearest.slope) return false;
    }
    return true;
}
