import { Axe } from "../Axe.js";
import { AxeKnight } from "../AxeKnight.js";
import { Bat } from "../Bat.js";
import { BatBoss } from "../BatBoss.js";
import { BatSpawner } from "../BatSpawner.js";
import { Bird } from "../Bird.js";
import { BirdSpawner } from "../BirdSpawner.js";
import { Bone } from "../Bone.js";
import { BoneDragon } from "../BoneDragon.js";
import { BoneDragonVertebra } from "../BoneDragonVertebra.js";
import { BonePillar } from "../BonePillar.js";
import { Boomerang } from "../Boomerang.js";
import { BoomerangAxe } from "../BoomerangAxe.js";
import { BreakWall } from "../BreakWall.js";
import { BrickFragment } from "../BrickFragment.js";
import { BridgeBat } from "../BridgeBat.js";
import { Candles } from "../Candles.js";
import { Checkpoint } from "../Checkpoint.js";
import { Dagger } from "../Dagger.js";
import { DieBat } from "../DieBat.js";
import { Dog } from "../Dog.js";
import { Door } from "../Door.js";
import { Dracula } from "../Dracula.js";
import { DraculaBat } from "../DraculaBat.js";
import { DropItem } from "../DropItem.js";
import { Droplets } from "../Droplets.js";
import { FadingStairs } from "../FadingStairs.js";
import { Fireball } from "../Fireball.js";
import { Flame } from "../Flame.js";
import { FloatingPoints } from "../FloatingPoints.js";
import { FloorBreaker } from "../FloorBreaker.js";
import { FoodOrb } from "../FoodOrb.js";
import { Frankenstein } from "../Frankenstein.js";
import { Ghost } from "../Ghost.js";
import { GrimReaper } from "../GrimReaper.js";
import { HolyWater } from "../HolyWater.js";
import { Igor } from "../Igor.js";
import { LanceKnight } from "../LanceKnight.js";
import { MedusaBoss } from "../MedusaBoss.js";
import { MedusaHead } from "../MedusaHead.js";
import { MedusaHeadSpawner } from "../MedusaHeadSpawner.js";
import { Merman } from "../Merman.js";
import { MermanSpawner } from "../MermanSpawner.js";
import { MovingPlatform } from "../MovingPlatform.js";
import { MummyBoss } from "../MummyBoss.js";
import { Orb } from "../Orb.js";
import { Raven } from "../Raven.js";
import { RedSkeleton } from "../RedSkeleton.js";
import { Secret } from "../Secret.js";
import { ShootingSpark } from "../ShootingSpark.js";
import { Sickle } from "../Sickle.js";
import { Simon } from "../Simon.js";
import { SmallHeart } from "../SmallHeart.js";
import { Snakes } from "../Snakes.js";
import { Spark } from "../Spark.js";
import { Spikes } from "../Spikes.js";
import { StopWatch } from "../StopWatch.js";
import { SwoopingBat } from "../SwoopingBat.js";
import { Thing } from "../Thing.js";
import { Torch } from "../Torch.js";
import { WhiteSkeleton } from "../WhiteSkeleton.js";
import { Wrapping } from "../Wrapping.js";
import { Zombie } from "../Zombie.js";
import { ZombieSpawner } from "../ZombieSpawner.js";

export type ThingConstructor = {
    readonly name: string;
    readonly prototype: Thing;
};

export const THING_TYPES = {
    Axe: Axe,
    AxeKnight: AxeKnight,
    Bat: Bat,
    BatBoss: BatBoss,
    BatSpawner: BatSpawner,
    Bird: Bird,
    BirdSpawner: BirdSpawner,
    Bone: Bone,
    BoneDragon: BoneDragon,
    BoneDragonVertebra: BoneDragonVertebra,
    BonePillar: BonePillar,
    Boomerang: Boomerang,
    BoomerangAxe: BoomerangAxe,
    BreakWall: BreakWall,
    BrickFragment: BrickFragment,
    BridgeBat: BridgeBat,
    Candles: Candles,
    Checkpoint: Checkpoint,
    Dagger: Dagger,
    DieBat: DieBat,
    Dog: Dog,
    Door: Door,
    Dracula: Dracula,
    DraculaBat: DraculaBat,
    DropItem: DropItem,
    Droplets: Droplets,
    FadingStairs: FadingStairs,
    Fireball: Fireball,
    Flame: Flame,
    FloatingPoints: FloatingPoints,
    FloorBreaker: FloorBreaker,
    FoodOrb: FoodOrb,
    Frankenstein: Frankenstein,
    Ghost: Ghost,
    GrimReaper: GrimReaper,
    HolyWater: HolyWater,
    Igor: Igor,
    LanceKnight: LanceKnight,
    MedusaBoss: MedusaBoss,
    MedusaHead: MedusaHead,
    MedusaHeadSpawner: MedusaHeadSpawner,
    Merman: Merman,
    MermanSpawner: MermanSpawner,
    MovingPlatform: MovingPlatform,
    MummyBoss: MummyBoss,
    Orb: Orb,
    Raven: Raven,
    RedSkeleton: RedSkeleton,
    Secret: Secret,
    ShootingSpark: ShootingSpark,
    Sickle: Sickle,
    Simon: Simon,
    SmallHeart: SmallHeart,
    Snakes: Snakes,
    Spark: Spark,
    Spikes: Spikes,
    StopWatch: StopWatch,
    SwoopingBat: SwoopingBat,
    Torch: Torch,
    WhiteSkeleton: WhiteSkeleton,
    Wrapping: Wrapping,
    Zombie: Zombie,
    ZombieSpawner
} as const satisfies Record<string, ThingConstructor>;

export type ThingTypeId = keyof typeof THING_TYPES;

const THING_TYPE_IDS = new Set<string>(Object.keys(THING_TYPES));

export const THING_TYPE_ID_BY_CONSTRUCTOR: ReadonlyMap<unknown, ThingTypeId> = new Map(
    Object.entries(THING_TYPES).map(([typeId, constructor]) => [constructor, typeId as ThingTypeId])
);

export function isThingTypeId(value: unknown): value is ThingTypeId {
    return typeof value === "string" && THING_TYPE_IDS.has(value);
}

export function getThingTypeId(thing: Thing): ThingTypeId {
    const constructor = thing.constructor;
    const typeId = THING_TYPE_ID_BY_CONSTRUCTOR.get(constructor);
    if (typeId === undefined) {
        throw new Error(`Unregistered Thing type: ${constructor.name}`);
    }
    return typeId;
}
