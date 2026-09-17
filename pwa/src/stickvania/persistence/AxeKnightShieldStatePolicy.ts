const BOOMERANG_STATE_REFLECTED = 3;
const BOOMERANG_STATE_MIN = 0;
const BOOMERANG_STATE_MAX = 3;
const BOOMERANG_MAX_SPEED = 3;
const BOOMERANG_REFLECT_ACCELERATION = Math.fround(0.13988657844990548204158790170132);
const MAX_AXE_KNIGHT_DURABILITY = 4;

/**
 * Semantic validation for the persisted AxeKnight-shield object graph.
 *
 * The generic serializer validates that encoded Thing references point at an
 * existing ID. This policy adds the domain contract: a Boomerang shield lock may
 * reference only an AxeKnight, only reflected flight owns a lock, and reflected
 * kinematics must be a state the runtime can actually produce.
 */
export function isAxeKnightShieldSnapshotStateValid(snapshot: unknown): boolean {
    if (!isRecord(snapshot) || !Array.isArray(snapshot.things)) {
        return false;
    }

    const typeById = new Map<number, string>();
    for (const thing of snapshot.things) {
        if (!isRecord(thing) || !Number.isInteger(thing.id) || typeof thing.type !== "string") {
            return false;
        }
        if (typeById.has(thing.id as number)) {
            return false;
        }
        typeById.set(thing.id as number, thing.type);
    }

    for (const thing of snapshot.things) {
        const fields = isRecord(thing) && isRecord(thing.fields) ? thing.fields : null;
        if (fields === null) {
            return false;
        }

        if (thing.type === "AxeKnight") {
            if (!isIntegerInRange(fields.shieldReflectionsRemaining, 0, MAX_AXE_KNIGHT_DURABILITY)) {
                return false;
            }
            continue;
        }

        if (thing.type !== "Boomerang") {
            continue;
        }

        if (!isIntegerInRange(fields.state, BOOMERANG_STATE_MIN, BOOMERANG_STATE_MAX)) {
            return false;
        }

        const state = fields.state as number;
        const lockTarget = readThingReference(fields.shieldBlockedBy);
        if (fields.shieldBlockedBy !== null && lockTarget === undefined) {
            return false;
        }
        if (lockTarget !== undefined && lockTarget !== null) {
            if (state !== BOOMERANG_STATE_REFLECTED || typeById.get(lockTarget) !== "AxeKnight") {
                return false;
            }
        }

        if (state === BOOMERANG_STATE_REFLECTED && !isReasonableReflectedKinematics(fields.vx, fields.g)) {
            return false;
        }
    }

    return true;
}

function isReasonableReflectedKinematics(vx: unknown, g: unknown): boolean {
    if (typeof vx !== "number" || !Number.isFinite(vx) || Math.abs(vx) > BOOMERANG_MAX_SPEED) {
        return false;
    }
    if (typeof g !== "number" || !Number.isFinite(g) || g === 0) {
        return false;
    }
    if (Math.abs(Math.abs(g) - BOOMERANG_REFLECT_ACCELERATION) > 1e-6) {
        return false;
    }
    return vx === 0 || Math.sign(vx) === Math.sign(g);
}

function readThingReference(value: unknown): number | null | undefined {
    if (value === null) {
        return null;
    }
    if (!isRecord(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, "$thing")) {
        return undefined;
    }
    const id = value.$thing;
    return Number.isInteger(id) && (id as number) >= 0 ? (id as number) : undefined;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
