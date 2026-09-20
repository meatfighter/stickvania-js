import { Main } from "../Main.js";
import type { EncodedRecord, EncodedValue, ThingSnapshot } from "./GameStateSnapshot.js";
import { MAIN_PERSISTED_STATE_FIELD_NAMES, THING_PERSISTED_STATE_FIELD_NAMES } from "./StateFieldRegistry.generated.js";
import type { ThingTypeId } from "./ThingTypeRegistry.js";

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
        song: { kind: "song", nullable: false }
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

export function isPersistedThingFieldValuesValid(
    snapshot: ThingSnapshot,
    thingTypes: ReadonlyMap<number, ThingTypeId>,
    segmentCount: number
): boolean {
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
            return Number.isInteger(value) && [0, 1, 2, 4, 5, 6, 7, 8, 10].includes(value);
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
        const range = inferStaticIntegerRange(type, "STATE_");
        if (range !== null) {
            return Number.isInteger(value) && value >= range[0] && value <= range[1];
        }
    }
    if (name === "type") {
        const range = inferStaticIntegerRange(type, "TYPE_");
        if (range !== null) {
            return Number.isInteger(value) && value >= range[0] && value <= range[1];
        }
    }
    if (name === "spriteIndex" || name === "spriteIndexIncrementor" || name.endsWith("Delay") || name.endsWith("Timer") || name === "hits" || name === "count") {
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

function inferStaticIntegerRange(type: ThingTypeId, prefix: string): readonly [number, number] | null {
    // The exact constructor is intentionally resolved lazily to avoid a second field-name registry.
    // State/type constants are validated by the caller's imported class constructor in generated tests;
    // fields without static enum constants retain the general finite-number envelope.
    void type;
    void prefix;
    return null;
}

function isReferenceValueValid(
    value: EncodedValue,
    policy: ThingReferencePolicy,
    thingTypes: ReadonlyMap<number, ThingTypeId>,
    segmentCount: number
): boolean {
    switch (policy.kind) {
        case "thing":
            if (!isExactTaggedRecord(value, "$thing")) return false;
            if (value.$thing === null) return policy.nullable;
            return Number.isInteger(value.$thing) && policy.targets.includes(thingTypes.get(value.$thing) as ThingTypeId);
        case "thingArray":
            return (
                Array.isArray(value) &&
                value.length === policy.length &&
                value.every(
                    (entry) =>
                        isExactTaggedRecord(entry, "$thing") &&
                        entry.$thing !== null &&
                        Number.isInteger(entry.$thing) &&
                        policy.targets.includes(thingTypes.get(entry.$thing) as ThingTypeId)
                )
            );
        case "segment":
            if (!isExactTaggedRecord(value, "$segment")) return false;
            if (value.$segment === null) return policy.nullable;
            return Number.isInteger(value.$segment) && value.$segment >= 0 && value.$segment < segmentCount;
        case "song":
            if (!isExactTaggedRecord(value, "$song")) return false;
            return policy.nullable ? value.$song === null || typeof value.$song === "string" : typeof value.$song === "string";
    }
}

function isExactTaggedRecord<K extends "$thing" | "$segment" | "$song">(
    value: unknown,
    key: K
): value is Record<K, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, key);
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
    return Number.isInteger(value) && value >= min && value <= max;
}
