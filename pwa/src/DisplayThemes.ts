import { Color } from "slick2d-ts/slick/Color";

export type DisplayModePreference = "light" | "dark" | "sepia" | "chalkboard" | "moonlight" | "cyanotype" | "blood-moon";

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
        blackReplacement: [0x3a, 0x2b, 0x20],
        whiteReplacement: [0xe7, 0xd5, 0xaf]
    },
    {
        value: "chalkboard",
        label: "Chalkboard",
        blackReplacement: [0xf0, 0xeb, 0xd8],
        whiteReplacement: [0x1e, 0x48, 0x36]
    },
    {
        value: "moonlight",
        label: "Moonlight",
        blackReplacement: [0xd2, 0xd9, 0xe1],
        whiteReplacement: [0x10, 0x18, 0x27]
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
