export const GAME_STATE_VERSION = 2;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export type JsonRecord = { [key: string]: JsonValue };

export type ThingRefSnapshot = {
    $thing: number | null;
};

export type SegmentRefSnapshot = {
    $segment: number | null;
};

export type RegionRefSnapshot = {
    $region: [number, number] | null;
};

export type StairsRefSnapshot = {
    $stairs: [number, number] | null;
};

export type SongRefSnapshot = {
    $song: SongId | null;
};

export type MusicRefSnapshot = {
    $music: MusicId | null;
};

export type EncodedValue = JsonValue
    | ThingRefSnapshot
    | SegmentRefSnapshot
    | RegionRefSnapshot
    | StairsRefSnapshot
    | SongRefSnapshot
    | MusicRefSnapshot
    | ThingStackSnapshot;

export type EncodedRecord = { [key: string]: EncodedValue };

export type ThingStackSnapshot = {
    $stack: {
        capacity: number;
        things: Array<number | null>;
    };
};

export type ThingSnapshot = {
    id: number;
    type: string;
    fields: EncodedRecord;
};

export type RegionSnapshot = {
    min: number;
    max: number;
    checkpoint: number | null;
    thingStack: ThingStackSnapshot;
    platforms: Array<number | null>;
    stageNumber: number;
};

export type SegmentSnapshot = {
    direction: number;
    stageSegmentIndex: number;
    map: number[][];
    walls: number[][];
    mapWidth: number;
    regionIndex: number;
    regions: RegionSnapshot[];
};

export type StageSnapshot = {
    stageIndex: number;
    currentSegmentIndex: number | null;
    checkpoint: number | null;
    simon: number | null;
    door: number | null;
    platforms: Array<number | null> | null;
    regionThingStack: ThingStackSnapshot;
    regionStackSwap: ThingStackSnapshot;
    weaponsStack: ThingStackSnapshot;
    weaponsStackSwap: ThingStackSnapshot;
    oldThingStack: ThingStackSnapshot;
    segments: SegmentSnapshot[];
};

export type RandomSnapshot = {
    seed0: number;
    seed1: number;
    seed2: number;
};

export type MusicId =
    | "game_over"
    | "map_1"
    | "map_2"
    | "map_3"
    | "map_4"
    | "prologue"
    | "simon_killed"
    | "stage_cleared"
    | "dracula_dead"
    | "boss_1.intro"
    | "boss_1.loop"
    | "boss_2.intro"
    | "boss_2.loop"
    | "ending.loop"
    | "stage_1_1.loop"
    | "stage_1_2.intro"
    | "stage_1_2.loop"
    | "stage_2_1.intro"
    | "stage_2_1.loop"
    | "stage_3_1.intro"
    | "stage_3_1.loop"
    | "stage_4_1.loop"
    | "stage_4_2.loop"
    | "stage_5_1.intro"
    | "stage_5_1.loop"
    | "stage_6_1.loop"
    | "stage_6_2.intro"
    | "stage_6_2.loop";

export type SongId =
    | "boss_1"
    | "boss_2"
    | "ending"
    | "stage_1_1"
    | "stage_1_2"
    | "stage_2_1"
    | "stage_3_1"
    | "stage_4_1"
    | "stage_4_2"
    | "stage_5_1"
    | "stage_6_1"
    | "stage_6_2";

export type MusicSnapshot = {
    id: MusicId;
    looped: boolean;
    paused: boolean;
    playing: boolean;
    playbackRate: number;
    position: number;
    volume: number;
};

export type SongSnapshot = {
    id: SongId;
    playing: boolean;
    intro: MusicSnapshot | null;
    loop: MusicSnapshot | null;
};

export type AudioSnapshot = {
    currentSong: SongId | null;
    requestedSong: SongId | null;
    currentMusic: MusicSnapshot | null;
    songs: SongSnapshot[];
};

export type StickvaniaGameStateSnapshot = {
    version: number;
    appVersion: string;
    savedAt: string;
    mode: number;
    mainFields: EncodedRecord;
    random: RandomSnapshot;
    stage: StageSnapshot | null;
    things: ThingSnapshot[];
    audio: AudioSnapshot;
};
