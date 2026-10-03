import { isFloorBreakerFieldsValid } from "./FloorBreakStatePolicy.js";
import { isCreditsPresentationValid } from "./PresentationStatePolicy.js";
import { isCastleTransitionValid } from "./CastlePresentationPhasePolicy.js";
import { isCastlePresentationValid } from "../../rumble/CastleCrumbleTimeline.js";
import { Main } from "../Main.js";
import type { EncodedRecord, EncodedValue, ThingSnapshot } from "./GameStateSnapshot.js";
import { isCountdownSnapshotValueValid, isRestorableGameStateMode } from "./GameStatePolicy.js";
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

// Most translated Thing fields keep the same primitive type when a field name is
// reused across classes. Type-qualified exceptions cover the rare Java case where
// a shared field name has a different primitive type (Simon.dead is an int while
// several enemies use boolean dead).
export const THING_NUMERIC_PERSISTED_STATE_FIELD_KEYS = new Set<string>(["Simon.dead"]);

export function isThingBooleanPersistedStateField(type: ThingTypeId, name: string): boolean {
    return THING_BOOLEAN_PERSISTED_STATE_FIELDS.has(name) && !THING_NUMERIC_PERSISTED_STATE_FIELD_KEYS.has(`${type}.${name}`);
}

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

export const PROVEN_MAIN_INTEGER_RANGES: Readonly<Partial<Record<string, readonly [number, number]>>> = {
    visibleWhipCount: [0, 2],
    timeFrozen: [0, 455],
    titleBatSpriteIndex: [0, 3],
    titleBatSpriteIndexIncrementor: [0, 8],
    titleBatSteps: [0, 273],
    introWalkSpriteIndex: [0, 3],
    introWalkSpriteIndexIncrementor: [0, 15],
    gateBatSpriteIndex: [0, 1],
    gateBatSpriteIndexIncrementor: [0, 9],
    demoIndex: [0, 2]
};

export const PROVEN_THING_INTEGER_RANGES: Partial<Record<ThingTypeId, Readonly<Record<string, readonly [number, number]>>>> = {
    Bat: { spriteIndex: [0, 3], spriteDelay: [0, 10] },
    MedusaHead: { spriteIndex: [0, 1], spriteDelay: [0, 23] },
    Dog: {
        STATE_RESTING: [0, 0],
        STATE_RUNNING: [1, 1],
        STATE_JUMPING: [2, 2],
        state: [0, 2],
        spriteIndex: [1, 3],
        spriteIndexIncrementor: [0, 14]
    },
    Simon: {
        walkSpriteIndex: [0, 3],
        walkSpriteIndexIncrementor: [0, 15],
        whipType: [0, 2],
        whipIndex: [0, 2],
        whipIncrementor: [0, 45]
    }
};

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
        if (!isMainNumberValid(name, value, fields)) {
            return false;
        }
    }
    return isRecordedInputCursorValid(fields) && isCastlePresentationValid(fields) && isCastleTransitionValid(fields);
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
        if (isThingBooleanPersistedStateField(snapshot.type, name)) {
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
    return snapshot.type !== "FloorBreaker" || isFloorBreakerFieldsValid(snapshot.fields);
}

function isMainNumberValid(name: string, value: number, fields: EncodedRecord): boolean {
    const bounds = PROVEN_MAIN_INTEGER_RANGES[name];
    if (bounds !== undefined) {
        return isIntegerInRange(value, bounds[0], bounds[1]);
    }
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
            return Number.isSafeInteger(value) && value >= 0;
        case "time":
            return isIntegerInRange(value, 0, 999);
        case "timeIncrementor":
            return isCountdownSnapshotValueValid(fields.mode, value);
        case "stage":
            return isIntegerInRange(value, 0, 18);
        case "stageIndex":
            return isIntegerInRange(value, 0, 5);
        case "hearts":
            return isIntegerInRange(value, 0, 99);
        case "players":
            // MAP borrows one count for the later checkpoint-entry decrement.
            return isIntegerInRange(value, 0, fields.mode === Main.MODE_MAP ? 100 : 99);
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
            return Number.isFinite(value);
    }
}

function isThingNumberValid(type: ThingTypeId, name: string, value: number): boolean {
    const range = PROVEN_THING_INTEGER_RANGES[type]?.[name];
    if (range !== undefined) return isIntegerInRange(value, range[0], range[1]);
    if (type === "Simon" && name === "dead") {
        return Number.isInteger(value) && value >= 0 && value <= 1_000_000;
    }
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
        return Number.isSafeInteger(value);
    }
    if (name === "lifeTime" && type === "StopWatch") {
        return isIntegerInRange(value, 0, 455);
    }
    if (name === "shieldReflectionsRemaining" && type === "AxeKnight") {
        return isIntegerInRange(value, 0, 1_000_000);
    }
    return Number.isFinite(value);
}

function inferStaticIntegerValues(type: ThingTypeId, prefix: string): readonly number[] | null {
    const constructor = THING_TYPES[type] as unknown as Record<string, unknown>;
    const values = Object.entries(constructor)
        .filter(([key, value]) => key.startsWith(prefix) && typeof value === "number" && Number.isInteger(value))
        .map(([, value]) => value as number);
    return values.length === 0 ? null : values;
}

function isReferenceValueValid(value: EncodedValue, policy: ThingReferencePolicy, thingTypes: ReadonlyMap<number, ThingTypeId>, segmentCount: number): boolean {
    // The serializer writes absent object references as plain null.
    if (value === null) return policy.kind !== "thingArray" && policy.nullable;
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

function isRecordedInputCursorValid(fields: EncodedRecord): boolean {
    if (fields.mode === Main.MODE_DEMO) {
        // demoIndex is checked by the global Main field domain.
        return typeof fields.recordingIndex === "number" && isIntegerInRange(fields.recordingIndex, 0, 2730);
    }
    if (fields.mode === Main.MODE_CREDITS) {
        return isCreditsPresentationValid(fields);
    }
    return true;
}
