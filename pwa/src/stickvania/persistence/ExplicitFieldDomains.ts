import type { ThingTypeId } from "./ThingTypeRegistry.js";

/** Explicit producer states/types from ../<Owner>.ts. Never infer from names. */
export const THING_ENUM_DOMAINS: Readonly<Partial<Record<ThingTypeId, Readonly<Record<string, readonly number[]>>>>> = {
    AxeKnight: { state: [0, 1, 2] },
    BatBoss: { state: [0, 1, 2, 3] },
    Boomerang: { state: [0, 1, 2, 3] },
    BoomerangAxe: { state: [0, 1, 2] },
    BridgeBat: { state: [0, 1, 2] },
    Door: { state: [0, 1, 2, 3, 4, 5, 6] },
    Dracula: { state: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    Flame: { state: [0, 1, 2, 3] },
    FoodOrb: { state: [0, 1, 2] },
    Frankenstein: { state: [0, 1, 2, 3] },
    GrimReaper: { state: [0, 1, 2, 3, 4] },
    HolyWater: { state: [0, 1] },
    MedusaBoss: { state: [0, 1, 2, 3, 4] },
    MovingPlatform: { state: [0, 1, 2, 3] },
    MummyBoss: { state: [0, 1, 2, 3] },
    Raven: { state: [0, 1, 2] },
    RedSkeleton: { state: [0, 1, 2, 3] },
    Sickle: { state: [0, 1, 2] },
    WhiteSkeleton: { state: [0, 1, 2, 3] },
    DropItem: { type: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    FloatingPoints: { type: [0, 1, 2, 3, 4] }
};
