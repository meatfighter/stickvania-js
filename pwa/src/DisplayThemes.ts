import { Color } from "slick2d-ts";

export type DisplayModePreference =
    | "amber"
    | "ballpoint"
    | "candlelight"
    | "charcoal"
    | "chalkboard"
    | "cyanotype"
    | "dark"
    | "ditto"
    | "lcd"
    | "led"
    | "light"
    | "newsprint"
    | "oscilloscope"
    | "plasma"
    | "redline"
    | "rose"
    | "sepia"
    | "silver"
    | "slate"
    | "tattoo"
    | "vfd"
    | "viridian"
    | "wash";

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
        value: "amber",
        label: "Amber",
        blackReplacement: [0xf2, 0xb8, 0x4b],
        whiteReplacement: [0x11, 0x0c, 0x04]
    },
    {
        value: "ballpoint",
        label: "Ballpoint",
        blackReplacement: [0x2d, 0x11, 0x74],
        whiteReplacement: [0xed, 0xf0, 0xf2]
    },
    {
        value: "candlelight",
        label: "Candlelight",
        blackReplacement: [0x17, 0x12, 0x0a],
        whiteReplacement: [0xc3, 0xa4, 0x4f]
    },
    {
        value: "charcoal",
        label: "Charcoal",
        blackReplacement: [0x29, 0x2a, 0x28],
        whiteReplacement: [0xd8, 0xd2, 0xc6]
    },
    {
        value: "chalkboard",
        label: "Chalkboard",
        blackReplacement: [0xf0, 0xeb, 0xd8],
        whiteReplacement: [0x1e, 0x48, 0x36]
    },
    {
        value: "cyanotype",
        label: "Cyanotype",
        blackReplacement: [0xec, 0xe9, 0xd9],
        whiteReplacement: [0x17, 0x4e, 0x78]
    },
    {
        value: "dark",
        label: "Dark",
        blackReplacement: null,
        whiteReplacement: null
    },
    {
        value: "ditto",
        label: "Ditto",
        blackReplacement: [0x71, 0x68, 0x9d],
        whiteReplacement: [0xe9, 0xe2, 0xd2]
    },
    {
        value: "lcd",
        label: "LCD",
        blackReplacement: [0x27, 0x31, 0x1e],
        whiteReplacement: [0xa2, 0xa9, 0x7f]
    },
    {
        value: "led",
        label: "LED",
        blackReplacement: [0xf0, 0x4b, 0x32],
        whiteReplacement: [0x12, 0x04, 0x04]
    },
    {
        value: "light",
        label: "Light",
        blackReplacement: null,
        whiteReplacement: null
    },
    {
        value: "newsprint",
        label: "Newsprint",
        blackReplacement: [0x22, 0x20, 0x1b],
        whiteReplacement: [0xdd, 0xd2, 0xb7]
    },
    {
        value: "oscilloscope",
        label: "Oscilloscope",
        blackReplacement: [0x66, 0xe6, 0xb8],
        whiteReplacement: [0x08, 0x16, 0x15]
    },
    {
        value: "plasma",
        label: "Plasma",
        blackReplacement: [0xff, 0x8c, 0x32],
        whiteReplacement: [0x13, 0x09, 0x00]
    },
    {
        value: "redline",
        label: "Redline",
        blackReplacement: [0xa4, 0x38, 0x30],
        whiteReplacement: [0xf4, 0xf0, 0xe6]
    },
    {
        value: "rose",
        label: "Rose",
        blackReplacement: [0x21, 0x11, 0x17],
        whiteReplacement: [0xd9, 0x95, 0xa1]
    },
    {
        value: "sepia",
        label: "Sepia",
        blackReplacement: [0x4b, 0x36, 0x21],
        whiteReplacement: [0xd8, 0xc3, 0xa5]
    },
    {
        value: "silver",
        label: "Silver",
        blackReplacement: [0xc9, 0xd0, 0xcc],
        whiteReplacement: [0x15, 0x19, 0x1b]
    },
    {
        value: "slate",
        label: "Slate",
        blackReplacement: [0xd2, 0xd9, 0xe1],
        whiteReplacement: [0x10, 0x18, 0x27]
    },
    {
        value: "tattoo",
        label: "Tattoo",
        blackReplacement: [0x12, 0x15, 0x17],
        whiteReplacement: [0xea, 0xc1, 0xac]
    },
    {
        value: "vfd",
        label: "VFD",
        blackReplacement: [0x72, 0xe3, 0xe3],
        whiteReplacement: [0x06, 0x10, 0x15]
    },
    {
        value: "viridian",
        label: "Viridian",
        blackReplacement: [0x06, 0x13, 0x10],
        whiteReplacement: [0x72, 0xad, 0x9f]
    },
    {
        value: "wash",
        label: "Wash",
        blackReplacement: [0x18, 0x23, 0x27],
        whiteReplacement: [0x8c, 0xa0, 0xa8]
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
