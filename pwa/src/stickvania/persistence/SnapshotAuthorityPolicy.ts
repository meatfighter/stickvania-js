type RecordValue = Record<string, unknown>;
type SavedThing = { readonly id: number; readonly type: string; readonly fields: RecordValue };
export interface SnapshotAuthority {
    readonly timeFrozen: number;
    readonly hasActiveStopWatch: boolean;
    readonly visibleWhipCount: number | null;
}
const LIMIT = 4096;
const WATCH_LIFETIME = 455;
const TYPE_WHIP = 15;
const PLAYER_WEAPONS = new Set(["Axe", "Boomerang", "Dagger", "HolyWater", "StopWatch"]);

function record(value: unknown): RecordValue | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}
function integer(value: unknown, min: number, max: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
export function readUniqueThingIds(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length > LIMIT) return null;
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const id of value as unknown[]) {
        if (!integer(id, 0, LIMIT - 1) || seen.has(id)) return null;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}
export function readSnapshotStackIds(value: unknown): number[] | null {
    const stack = record(record(value)?.$stack);
    if (stack === null) return null;
    const ids = readUniqueThingIds(stack.things);
    return ids !== null && integer(stack.capacity, ids.length, LIMIT) ? ids : null;
}
function readThings(value: unknown): SavedThing[] | null {
    if (!Array.isArray(value) || value.length > LIMIT) return null;
    const result: SavedThing[] = [];
    for (let i = 0; i < value.length; i++) {
        const item = record(value[i]);
        const fields = record(item?.fields);
        if (item === null || item.id !== i || typeof item.type !== "string" || fields === null) return null;
        result.push({ id: i, type: item.type, fields });
    }
    return result;
}
/** Pure incoming/outgoing checks. Never reads storage or changes a live Main. */
export function inspectSnapshotAuthority(value: unknown): SnapshotAuthority | null {
    const root = record(value);
    const fields = record(root?.mainFields);
    const things = readThings(root?.things);
    if (root === null || fields === null || things === null || fields.mode !== root.mode) return null;
    if (!integer(fields.timeFrozen, 0, WATCH_LIFETIME)) return null;
    if (root.stage === null) {
        // A dormant whip scalar is irrelevant without a stage; no freeze effect is live.
        return things.length === 0 && fields.timeFrozen === 0 ? { timeFrozen: 0, hasActiveStopWatch: false, visibleWhipCount: null } : null;
    }
    const stage = record(root.stage);
    if (stage === null) return null;
    const current = readSnapshotStackIds(stage.regionThingStack);
    const swap = readSnapshotStackIds(stage.regionStackSwap);
    const weapons = readSnapshotStackIds(stage.weaponsStack);
    const weaponsSwap = readSnapshotStackIds(stage.weaponsStackSwap);
    const old = readSnapshotStackIds(stage.oldThingStack);
    const platforms = readUniqueThingIds(stage.platforms);
    if (current === null || swap === null || weapons === null || weaponsSwap === null || old === null || platforms === null) return null;
    if (!integer(stage.simon, 0, things.length - 1) || things[stage.simon]?.type !== "Simon") return null;
    const regionIds = [...current, ...swap];
    const weaponIds = [...weapons, ...weaponsSwap];
    const active = [...regionIds, ...weaponIds, ...platforms];
    if (new Set(active).size !== active.length || active.some((id) => things[id] === undefined || id === stage.simon)) return null;
    if (old.some((id) => things[id] === undefined)) return null;
    if (weaponIds.some((id) => !PLAYER_WEAPONS.has(things[id]!.type))) return null;
    if (regionIds.some((id) => PLAYER_WEAPONS.has(things[id]!.type) || things[id]!.type === "MovingPlatform")) return null;
    if (platforms.some((id) => things[id]!.type !== "MovingPlatform")) return null;

    const segments: unknown[] | null = Array.isArray(stage.segments) ? stage.segments : null;
    if (segments === null || segments.length === 0 || segments.length > 4 || !integer(stage.currentSegmentIndex, 0, segments.length - 1)) return null;
    // Historical ownership can alias active objects and other historical regions.
    // Uniqueness is local to each stack/list, not global across retained history.
    for (const segmentValue of segments) {
        const segment = record(segmentValue);
        const regions: unknown[] | null = Array.isArray(segment?.regions) ? segment.regions : null;
        if (regions === null || regions.length === 0 || regions.length > LIMIT) return null;
        for (const regionValue of regions) {
            const region = record(regionValue);
            const ids = readSnapshotStackIds(region?.thingStack);
            const p = readUniqueThingIds(region?.platforms);
            if (ids === null || p === null || ids.some((id) => things[id] === undefined) || p.some((id) => things[id]?.type !== "MovingPlatform")) return null;
        }
    }
    if (stage.door !== null) {
        if (!integer(stage.door, 0, things.length - 1) || active.includes(stage.door)) return null;
        const door = things[stage.door];
        if (door?.type !== "Door" || door.fields.active !== true) return null;
        const d = door.fields;
        if (![1, 2, 3, 5, 6].includes(d.state as number) || !integer(d.direction, 0, 1)) return null;
        if (!integer(d.doorDelay, 0, 70)) return null;
        if ((d.state === 2 || d.state === 5) && !integer(d.doorDelay, 1, 10)) return null;
        if (d.state === 3 && !integer(d.doorDelay, 1, 70)) return null;
        if (typeof d.x !== "number" || !Number.isFinite(d.x)) return null;
        const right = d.direction === 1; // Must agree with Main.RIGHT; verified by a constants test.
        if (d.doorScroll1 !== Math.trunc(d.x) - (right ? 264 : 256)) return null;
        if (d.doorScroll2 !== Math.trunc(d.x) + (right ? 24 : -521)) return null;
        const segment = record(segments[stage.currentSegmentIndex]);
        const regions: unknown[] | null = Array.isArray(segment?.regions) ? segment.regions : null;
        if (regions === null || !integer(segment?.regionIndex, 0, regions.length - 1)) return null;
        const sourceIndex = segment.regionIndex + (right ? -1 : 1);
        if (!integer(sourceIndex, 0, regions.length - 1)) return null;
        const source = record(regions[sourceIndex]);
        const sourceIds = readSnapshotStackIds(source?.thingStack);
        if (sourceIds === null || !sourceIds.includes(stage.door) || !old.includes(stage.door)) return null;
    }

    const whips = regionIds.filter((id) => things[id]!.type === "DropItem" && things[id]!.fields.type === TYPE_WHIP).length;
    // TYPE_WHIP must match the production constant, checked independently.
    if (whips > 2 || fields.visibleWhipCount !== whips) return null;

    const watches = things.filter((thing) => thing.type === "StopWatch");
    if (watches.length > 1) return null;
    let total = 0;
    for (const watch of watches) {
        if (!weaponIds.includes(watch.id) || !integer(watch.fields.lifeTime, 0, WATCH_LIFETIME)) return null;
        total += watch.fields.lifeTime;
    }
    if (fields.timeFrozen !== total) return null;
    if (total > 0) {
        const floor = fields.stageIndex === 2 && fields.floorBreaking === true;
        const simon = things[stage.simon]!.fields;
        const visibleOrb = regionIds.some((id) => things[id]!.type === "Orb" && things[id]!.fields.appearDelay === 0);
        if (
            ![1, 4, 8].includes(root.mode as number) ||
            typeof fields.playerPower !== "number" ||
            fields.playerPower <= 0 ||
            simon.dead !== 0 ||
            fields.beatStageFlag !== false
        )
            return null;
        if (fields.floorBreaking !== false && !floor) return null;
        if ((typeof fields.time !== "number" || fields.time <= 0) && !floor) return null;
        if (fields.stageIndex === 5 && fields.enemyPower === 0 && !visibleOrb) return null;
    }
    return { timeFrozen: total, hasActiveStopWatch: total > 0, visibleWhipCount: whips };
}
