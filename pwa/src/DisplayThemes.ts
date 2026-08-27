import { Color } from "slick2d-ts/slick/Color";

export type DisplayModePreference =
    "light" | "dark" | "sepia" | "candlelight" | "chalkboard" | "twilight" | "ditto" | "moonlight" | "phantom" | "cyanotype" | "blood-moon" | "amber-monitor";

export type DisplayMonochromePalette = Readonly<{
    blackReplacement: Color;
    whiteReplacement: Color;
}>;

type Rgb24 = readonly [red: number, green: number, blue: number];

type DisplayModeDefinition = Readonly<{
    value: DisplayModePreference;
    label: string;
    blackReplacement: Rgb24 | null;
    whiteReplacement: Rgb24 | null;
}>;

export const DISPLAY_MODE_DEFINITIONS: readonly DisplayModeDefinition[] = [
    {
        value: "light",
        label: "Light",
        blackReplacement: null,
        whiteReplacement: null
    },
    {
        value: "dark",
        label: "Dark",
        blackReplacement: null,
        whiteReplacement: null
    },
    {
        value: "sepia",
        label: "Sepia",
        blackReplacement: [0x4b, 0x36, 0x21],
        whiteReplacement: [0xd8, 0xc3, 0xa5]
    },
    {
        value: "candlelight",
        label: "Candlelight",
        blackReplacement: [0x17, 0x12, 0x0a],
        whiteReplacement: [0xc3, 0xa4, 0x4f]
    },
    {
        value: "chalkboard",
        label: "Chalkboard",
        blackReplacement: [0xf0, 0xeb, 0xd8],
        whiteReplacement: [0x1e, 0x48, 0x36]
    },
    {
        value: "twilight",
        label: "Twilight",
        blackReplacement: [0x21, 0x11, 0x17],
        whiteReplacement: [0xd9, 0x95, 0xa1]
    },
    {
        value: "ditto",
        label: "Ditto",
        blackReplacement: [0x71, 0x68, 0x9d],
        whiteReplacement: [0xe9, 0xe2, 0xd2]
    },
    {
        value: "moonlight",
        label: "Moonlight",
        blackReplacement: [0xd2, 0xd9, 0xe1],
        whiteReplacement: [0x10, 0x18, 0x27]
    },
    {
        value: "phantom",
        label: "Phantom",
        blackReplacement: [0x06, 0x13, 0x10],
        whiteReplacement: [0x72, 0xad, 0x9f]
    },
    {
        value: "cyanotype",
        label: "Cyanotype",
        blackReplacement: [0xec, 0xe9, 0xd9],
        whiteReplacement: [0x17, 0x4e, 0x78]
    },
    {
        value: "blood-moon",
        label: "Blood Moon",
        blackReplacement: [0xe0, 0x91, 0x6a],
        whiteReplacement: [0x14, 0x09, 0x0a]
    },
    {
        value: "amber-monitor",
        label: "Amber Monitor",
        blackReplacement: [0xf2, 0xb8, 0x4b],
        whiteReplacement: [0x11, 0x0c, 0x04]
    }
];

const DISPLAY_MODE_VALUES = new Set<DisplayModePreference>(DISPLAY_MODE_DEFINITIONS.map((definition) => definition.value));
const DISPLAY_MODE_BY_VALUE = new Map<DisplayModePreference, DisplayModeDefinition>(
    DISPLAY_MODE_DEFINITIONS.map((definition) => [definition.value, definition])
);

export function isDisplayModePreference(value: string | null): value is DisplayModePreference {
    return value !== null && DISPLAY_MODE_VALUES.has(value as DisplayModePreference);
}

export function createDisplayMonochromePalette(value: DisplayModePreference): DisplayMonochromePalette | null {
    const definition = DISPLAY_MODE_BY_VALUE.get(value);
    if (definition === undefined || definition.blackReplacement === null || definition.whiteReplacement === null) {
        return null;
    }

    return {
        blackReplacement: createColor(definition.blackReplacement),
        whiteReplacement: createColor(definition.whiteReplacement)
    };
}

function createColor(rgb: Rgb24): Color {
    return Color.fromInts(rgb[0], rgb[1], rgb[2]);
}
