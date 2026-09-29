import { makeCastleCrumblePattern } from "./CastleCrumbleTimeline.js";
export type RumbleEffectId =
    | "playerHurt"
    | "playerDeath"
    | "bossFinalHit"
    | "blockBreak"
    | "floorBreak"
    | "draculaLand"
    | "castleCrumble"
    | "orbHeartbeat"
    | "orbCollect"
    | "itemLand"
    | "majorItemCollect"
    | "invincibilityPotion"
    | "whipUpgrade"
    | "spikesLand"
    | "doorOpen"
    | "rosary"
    | "stopwatch"
    | "fireProjectile"
    | "weaponImpactLight"
    | "weaponThrow"
    | "snakeLand";

export type RumbleChannel = "ambient" | "boss" | "impact" | "item" | "player" | "stopwatch" | "weapon" | "world";

export type RumblePulseStep = {
    readonly duration: number;
    readonly strong: number;
    readonly weak: number;
};

export type RumbleDelayStep = {
    readonly delay: number;
};

export type RumbleStep = RumblePulseStep | RumbleDelayStep;

export type RumbleEffect = {
    readonly id: RumbleEffectId;
    readonly label: string;
    readonly description: string;
    readonly channel: RumbleChannel;
    readonly pattern: readonly RumbleStep[];
    readonly exclusive?: boolean;
    readonly minIntervalMs?: number;
};

function pulse(duration: number, strong: number, weak: number): readonly RumbleStep[] {
    return [{ duration, strong, weak }];
}

export const RUMBLE_EFFECTS: readonly RumbleEffect[] = [
    {
        id: "playerHurt",
        label: "Player Hurt",
        description: "Short two-phase pin prick",
        channel: "player",
        pattern: [{ duration: 28, strong: 1, weak: 0.12 }, { delay: 14 }, { duration: 36, strong: 0.26, weak: 0.08 }],
        minIntervalMs: 90
    },
    {
        id: "playerDeath",
        label: "Player Death",
        description: "Stepped drain-out",
        channel: "player",
        pattern: [
            { duration: 115, strong: 0.98, weak: 0.72 },
            { delay: 70 },
            { duration: 125, strong: 0.74, weak: 0.5 },
            { delay: 90 },
            { duration: 145, strong: 0.48, weak: 0.3 },
            { delay: 105 },
            { duration: 165, strong: 0.22, weak: 0.14 }
        ],
        exclusive: true
    },
    {
        id: "bossFinalHit",
        label: "Boss Final Hit",
        description: "Heavy hit that fades out",
        channel: "boss",
        pattern: [
            { duration: 160, strong: 1, weak: 0.65 },
            { delay: 55 },
            { duration: 220, strong: 0.68, weak: 0.4 },
            { delay: 70 },
            { duration: 300, strong: 0.34, weak: 0.16 }
        ],
        exclusive: true
    },
    {
        id: "blockBreak",
        label: "Block Break",
        description: "Breakable wall shatter",
        channel: "world",
        pattern: pulse(110, 0.48, 0.72)
    },
    {
        id: "floorBreak",
        label: "Floor Break",
        description: "Mummy floor blocks",
        channel: "world",
        pattern: pulse(140, 0.62, 0.75)
    },
    {
        id: "draculaLand",
        label: "Dracula Land",
        description: "Blue monster impact",
        channel: "boss",
        pattern: pulse(260, 0.95, 0.42)
    },
    {
        id: "castleCrumble",
        label: "Castle Crumble",
        description: "Full ending collapse timeline",
        channel: "ambient",
        pattern: makeCastleCrumblePattern()
    },
    {
        id: "orbCollect",
        label: "Orb Collect",
        description: "Simon collects orb",
        channel: "item",
        pattern: pulse(260, 0.62, 0.78)
    },
    {
        id: "itemLand",
        label: "Item Land",
        description: "Ordinary item lands",
        channel: "item",
        pattern: pulse(60, 0.16, 0.24),
        minIntervalMs: 45
    },
    {
        id: "majorItemCollect",
        label: "Major Item Collect",
        description: "Weapon, meat, 1UP, repeat item",
        channel: "item",
        pattern: pulse(130, 0.25, 0.62)
    },
    {
        id: "invincibilityPotion",
        label: "Invincibility Potion",
        description: "Sparkling power-up shimmer",
        channel: "item",
        pattern: [
            { duration: 45, strong: 0.12, weak: 0.28 },
            { delay: 28 },
            { duration: 55, strong: 0.18, weak: 0.44 },
            { delay: 34 },
            { duration: 70, strong: 0.24, weak: 0.62 },
            { delay: 42 },
            { duration: 120, strong: 0.36, weak: 0.86 }
        ]
    },
    {
        id: "whipUpgrade",
        label: "Whip Upgrade",
        description: "Whip item advances whip",
        channel: "item",
        pattern: pulse(220, 0.42, 0.88)
    },
    {
        id: "spikesLand",
        label: "Spikes Land",
        description: "Falling spikes impact",
        channel: "world",
        pattern: pulse(95, 0.6, 0.95)
    },
    {
        id: "doorOpen",
        label: "Door Open",
        description: "Creaky door squeak",
        channel: "world",
        pattern: [
            { duration: 55, strong: 0.04, weak: 0.28 },
            { delay: 24 },
            { duration: 80, strong: 0.1, weak: 0.54 },
            { delay: 18 },
            { duration: 42, strong: 0.03, weak: 0.2 },
            { delay: 34 },
            { duration: 96, strong: 0.14, weak: 0.62 },
            { delay: 22 },
            { duration: 68, strong: 0.07, weak: 0.42 },
            { delay: 38 },
            { duration: 120, strong: 0.1, weak: 0.5 },
            { delay: 52 },
            { duration: 180, strong: 0.04, weak: 0.22 }
        ]
    },
    {
        id: "rosary",
        label: "Rosary",
        description: "Screen clear burst",
        channel: "world",
        pattern: [
            { duration: 120, strong: 0.5, weak: 0.8 },
            { delay: 35 },
            { duration: 180, strong: 0.75, weak: 0.55 },
            { delay: 45 },
            { duration: 260, strong: 0.42, weak: 0.32 }
        ]
    },
    {
        id: "stopwatch",
        label: "Stopwatch",
        description: "Single time stop tick",
        channel: "stopwatch",
        pattern: pulse(46, 0.1, 0.5)
    },
    {
        id: "orbHeartbeat",
        label: "Orb Heartbeat",
        description: "Single clock-like heartbeat tick",
        channel: "item",
        pattern: pulse(46, 0.1, 0.5),
        minIntervalMs: 250
    },
    {
        id: "fireProjectile",
        label: "Fire Projectile",
        description: "Fireball launch flutter",
        channel: "weapon",
        pattern: [{ duration: 48, strong: 0.22, weak: 0.58 }, { delay: 18 }, { duration: 64, strong: 0.12, weak: 0.38 }]
    },
    {
        id: "weaponImpactLight",
        label: "Weapon Impact",
        description: "Whip / dagger / axe / boomerang / holy water contact",
        channel: "impact",
        pattern: pulse(75, 0.18, 0.42)
    },
    {
        id: "weaponThrow",
        label: "Weapon Throw",
        description: "Optional launch tap",
        channel: "weapon",
        pattern: pulse(45, 0.14, 0.3),
        minIntervalMs: 40
    },
    {
        id: "snakeLand",
        label: "Snake Land",
        description: "Medusa snake lands",
        channel: "impact",
        pattern: pulse(65, 0.2, 0.28),
        minIntervalMs: 45
    }
];

export const RUMBLE_EFFECT_BY_ID: ReadonlyMap<RumbleEffectId, RumbleEffect> = new Map(RUMBLE_EFFECTS.map((effect) => [effect.id, effect]));

export function getRumbleEffect(id: RumbleEffectId): RumbleEffect {
    const effect = RUMBLE_EFFECT_BY_ID.get(id);
    if (effect === undefined) {
        throw new Error(`Unknown rumble effect: ${id}`);
    }
    return effect;
}

export function isRumbleDelayStep(step: RumbleStep): step is RumbleDelayStep {
    return "delay" in step;
}

export function effectSummary(effect: RumbleEffect): string {
    const pulses: RumblePulseStep[] = [];
    for (const step of effect.pattern) {
        if (!isRumbleDelayStep(step)) {
            pulses.push(step);
        }
    }
    const totalDuration = effect.pattern.reduce((total, step) => total + (isRumbleDelayStep(step) ? step.delay : step.duration), 0);
    if (pulses.length === 1) {
        return `duration ${pulses[0].duration}ms, strong ${pulses[0].strong}, weak ${pulses[0].weak}`;
    }
    return `${pulses.length} pulses over ${totalDuration}ms`;
}
