import { Main } from "../Main.js";
import type { EncodedRecord, EncodedValue, ThingSnapshot } from "./GameStateSnapshot.js";
import { isRestorableGameStateMode } from "./GameStatePolicy.js";
import { MAIN_PERSISTED_STATE_FIELD_NAMES, THING_PERSISTED_STATE_FIELD_NAMES } from "./StateFieldRegistry.generated.js";
import { THING_TYPES, type ThingTypeId } from "./ThingTypeRegistry.js";

export const MAIN_BOOLEAN_PERSISTED_STATE_FIELDS = new Set<string>([
    "killAllFlag",
    "beatStageFlag",
    "floorBreaking",
    "justShowedMap",
    "castleFallSparkVisible",
    "continueSelected",
    "creditsPaused",
    "creditsAdvance",
    "creditsPresents"
]);

export const THING_BOOLEAN_PERSISTED_STATE_FIELDS = new Set<string>([
    "active",
    "applyingGravity",
    "capeOpen",
    "changeDirection",
    "dead",
    "disappears",
    "drankPotion",
    "dropped",
    "fading",
    "hasAxe",
    "hurt",
    "intersected",
    "kill",
    "kneeling",
    "liftFast",
    "lifting",
    "monsterForm",
    "onStairs",
    "releasedFoodOrb",
    "releasedFoodOrb2",
    "releasedJump",
    "releasedKneel",
    "releasedWhip",
    "rightStairs",
    "shouldMove",
    "simonSplashed",
    "sleeping",
    "supported",
    "throwing",
    "up",
    "whipping"
]);

type ThingReferencePolicy =
    | { readonly kind: "thing"; readonly targets: readonly ThingTypeId[]; readonly nullable: boolean }
    | { readonly kind: "thingArray"; readonly targets: readonly ThingTypeId[]; readonly length: number }
    | { readonly kind: "segment"; readonly nullable: boolean }
    | { readonly kind: "song"; readonly nullable: boolean };

export const THING_REFERENCE_FIELD_POLICY: Partial<Record<ThingTypeId, Readonly<Record<string, ThingReferencePolicy>>>> = {
    Bird: {
        birdSpawner: { kind: "thing", targets: ["BirdSpawner"], nullable: false }
    },
    BoneDragon: {
        vertebrae: { kind: "thingArray", targets: ["BoneDragonVertebra"], length: 6 }
    },
    Boomerang: {
        shieldBlockedBy: { kind: "thing", targets: ["AxeKnight"], nullable: true }
    },
    BoomerangAxe: {
        axeKnight: { kind: "thing", targets: ["AxeKnight"], nullable: false }
    },
    Checkpoint: {
        song: { kind: "song", nullable: true }
    },
    Dracula: {
        draculaBats: { kind: "thingArray", targets: ["DraculaBat"], length: 16 }
    },
    FadingStairs: {
        segment: { kind: "segment", nullable: false }
    },
    Merman: {
        mermanSpawner: { kind: "thing", targets: ["MermanSpawner"], nullable: false }
    },
    Sickle: {
        grimReaper: { kind: "thing", targets: ["GrimReaper"], nullable: false }
    },
    Zombie: {
        zombieSpawner: { kind: "thing", targets: ["ZombieSpawner"], nullable: false }
    }
};

const JAVA_INT_MAX = 2_147_483_647;

export function isPersistedMainFieldValuesValid(fields: EncodedRecord): boolean {
    for (const name of MAIN_PERSISTED_STATE_FIELD_NAMES) {
        const value = fields[name];
        if (MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.has(name)) {
            if (typeof value !== "boolean") return false;
            continue;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return false;
        }
        if (!isMainNumberValid(name, value)) {
            return false;
        }
    }
    return true;
}

export function isPersistedThingFieldValuesValid(snapshot: ThingSnapshot, thingTypes: ReadonlyMap<number, ThingTypeId>, segmentCount: number): boolean {
    const referencePolicy = THING_REFERENCE_FIELD_POLICY[snapshot.type] ?? {};
    for (const name of THING_PERSISTED_STATE_FIELD_NAMES[snapshot.type]) {
        const value = snapshot.fields[name];
        const reference = referencePolicy[name];
        if (reference !== undefined) {
            if (!isReferenceValueValid(value, reference, thingTypes, segmentCount)) {
                return false;
            }
            continue;
        }
        if (THING_BOOLEAN_PERSISTED_STATE_FIELDS.has(name)) {
            if (typeof value !== "boolean") {
                return false;
            }
            continue;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return false;
        }
        if (!isThingNumberValid(snapshot.type, name, value)) {
            return false;
        }
    }
    return true;
}

function isMainNumberValid(name: string, value: number): boolean {
    switch (name) {
        case "mode":
            return isRestorableGameStateMode(value);
        case "fadeState":
            return isIntegerInRange(value, Main.FADE_DONE, Main.FADE_IN);
        case "fade":
            return isIntegerInRange(value, 0, 22);
        case "fadeReason":
            return isIntegerInRange(value, Main.FADE_REASON_STAIRS, Main.FADE_REASON_SHOW_INPUT_CONFIG);
        case "score":
            return Number.isInteger(value) && value >= 0 && value <= JAVA_INT_MAX;
        case "time":
            return isIntegerInRange(value, 0, 999);
        case "timeIncrementor":
            return isIntegerInRange(value, 0, 90);
        case "stage":
            return isIntegerInRange(value, 0, 18);
        case "stageIndex":
            return isIntegerInRange(value, 0, 5);
        case "hearts":
        case "players":
            return isIntegerInRange(value, 0, 99);
        case "playerPower":
        case "enemyPower":
            return isIntegerInRange(value, 0, 16);
        case "weaponType":
            return isIntegerInRange(value, Main.WEAPON_TYPE_NONE, Main.WEAPON_TYPE_STOP_WATCH);
        case "weaponRepeats":
            return isIntegerInRange(value, Main.WEAPON_REPEATS_SINGLE, Main.WEAPON_REPEATS_TRIPLE);
        case "difficulty":
            return isIntegerInRange(value, Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD);
        default:
            return Math.abs(value) <= 1_000_000;
    }
}

function isThingNumberValid(type: ThingTypeId, name: string, value: number): boolean {
    if (name === "direction" || name === "displayDirection" || name === "originalDirection") {
        return value === Main.LEFT || value === Main.RIGHT;
    }
    if (name === "state") {
        const values = inferStaticIntegerValues(type, "STATE_");
        if (values !== null) {
            return Number.isInteger(value) && values.includes(value);
        }
    }
    if (name === "type") {
        const values = inferStaticIntegerValues(type, "TYPE_");
        if (values !== null) {
            return Number.isInteger(value) && values.includes(value);
        }
    }
    if (
        name === "spriteIndex" ||
        name === "spriteIndexIncrementor" ||
        name.endsWith("Delay") ||
        name.endsWith("Timer") ||
        name === "hits" ||
        name === "count"
    ) {
        return Number.isInteger(value) && Math.abs(value) <= 1_000_000;
    }
    if (name === "lifeTime" && type === "StopWatch") {
        return isIntegerInRange(value, 0, 455);
    }
    if (name === "shieldReflectionsRemaining" && type === "AxeKnight") {
        return isIntegerInRange(value, 0, 1_000_000);
    }
    return Math.abs(value) <= 1_000_000;
}

function inferStaticIntegerValues(type: ThingTypeId, prefix: string): readonly number[] | null {
    const constructor = THING_TYPES[type] as unknown as Record<string, unknown>;
    const values = Object.entries(constructor)
        .filter(([key, value]) => key.startsWith(prefix) && typeof value === "number" && Number.isInteger(value))
        .map(([, value]) => value as number);
    return values.length === 0 ? null : values;
}

function isReferenceValueValid(value: EncodedValue, policy: ThingReferencePolicy, thingTypes: ReadonlyMap<number, ThingTypeId>, segmentCount: number): boolean {
    switch (policy.kind) {
        case "thing": {
            const reference = asThingReference(value);
            if (reference === null) return false;
            if (reference.$thing === null) return policy.nullable;
            return policy.targets.includes(thingTypes.get(reference.$thing) as ThingTypeId);
        }
        case "thingArray": {
            if (!Array.isArray(value) || value.length !== policy.length) {
                return false;
            }
            const ids: number[] = [];
            for (const entry of value) {
                const reference = asThingReference(entry);
                if (reference === null || reference.$thing === null || !policy.targets.includes(thingTypes.get(reference.$thing) as ThingTypeId)) {
                    return false;
                }
                ids.push(reference.$thing);
            }
            return new Set(ids).size === ids.length;
        }
        case "segment": {
            const reference = asSegmentReference(value);
            if (reference === null) return false;
            if (reference.$segment === null) return policy.nullable;
            return reference.$segment >= 0 && reference.$segment < segmentCount;
        }
        case "song": {
            const reference = asSongReference(value);
            if (reference === null) return false;
            return policy.nullable ? true : reference.$song !== null;
        }
    }
}

function asThingReference(value: unknown): { readonly $thing: number | null } | null {
    if (!isExactSingleKeyRecord(value, "$thing") || !(value.$thing === null || (typeof value.$thing === "number" && Number.isInteger(value.$thing)))) {
        return null;
    }
    return value as { readonly $thing: number | null };
}

function asSegmentReference(value: unknown): { readonly $segment: number | null } | null {
    if (!isExactSingleKeyRecord(value, "$segment") || !(value.$segment === null || (typeof value.$segment === "number" && Number.isInteger(value.$segment)))) {
        return null;
    }
    return value as { readonly $segment: number | null };
}

function asSongReference(value: unknown): { readonly $song: string | null } | null {
    if (!isExactSingleKeyRecord(value, "$song") || !(value.$song === null || typeof value.$song === "string")) {
        return null;
    }
    return value as { readonly $song: string | null };
}

function isExactSingleKeyRecord<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, key);
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
    return Number.isInteger(value) && value >= min && value <= max;
}
