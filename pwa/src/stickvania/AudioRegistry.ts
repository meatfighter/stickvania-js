import type { Sound } from "slick2d-ts";
import type { Main } from "./Main.js";

export const SONG_FIELD_NAMES = [
    "boss_1",
    "boss_2",
    "ending",
    "stage_1_1",
    "stage_1_2",
    "stage_2_1",
    "stage_3_1",
    "stage_4_1",
    "stage_4_2",
    "stage_5_1",
    "stage_6_1",
    "stage_6_2"
] as const;

export const STANDALONE_MUSIC_FIELD_NAMES = [
    "game_over",
    "map_1",
    "map_2",
    "map_3",
    "map_4",
    "prologue",
    "simon_killed",
    "stage_cleared",
    "dracula_dead"
] as const;

export const SOUND_EFFECT_FIELD_NAMES = [
    "advance_whip",
    "bat_killed",
    "bleep",
    "boss_hurt",
    "boss_killed_1",
    "boss_killed_2",
    "boss_killed_3",
    "breaks_wall",
    "crumble_sfx",
    "dog_killed",
    "door_opens_1",
    "door_opens_2",
    "gain_potion",
    "got_money",
    "heartbeat",
    "hit_candle",
    "killed_1",
    "killed_2",
    "killed_3",
    "killed_4",
    "killed_5",
    "lose_potion",
    "merman_spit",
    "one_up",
    "pressed_enter",
    "simon_hurt",
    "splash",
    "torch_breaks",
    "whip_1",
    "whip_2",
    "wing_flaps",
    "zombie_killed",
    "got_double",
    "kill_all_sfx",
    "simon_in_pit",
    "threw_dagger",
    "got_weapon",
    "used_holy_water",
    "spinning",
    "raven_killed",
    "ching",
    "snuffed",
    "medusa_head_killed",
    "stunned",
    "watch_tick",
    "twang",
    "large_bat_killed",
    "thunder",
    "fire_ball_shot",
    "dracula_to_bats",
    "lands"
] as const;

// Slick's default 64-source pool reserves indices 0 and 63, leaving 62
// simultaneous logical effect voices available to a game that does not call
// setMaxSources(). Keep durable-state validation aligned with that real limit.
export const MAX_PERSISTED_SOUND_EFFECT_VOICES = 62;

export type SoundEffectFieldName = (typeof SOUND_EFFECT_FIELD_NAMES)[number];

export type RegisteredSoundEffect = Readonly<{
    id: SoundEffectFieldName;
    sound: Sound;
}>;

const SOUND_EFFECT_FIELD_NAME_SET = new Set<string>(SOUND_EFFECT_FIELD_NAMES);

export function isSoundEffectFieldName(value: unknown): value is SoundEffectFieldName {
    return typeof value === "string" && SOUND_EFFECT_FIELD_NAME_SET.has(value);
}

export function registeredSoundEffects(main: Main): ReadonlyArray<RegisteredSoundEffect> {
    const seen = new Set<Sound>();
    return SOUND_EFFECT_FIELD_NAMES.map((id) => {
        const sound = main[id];
        if (sound == null) {
            throw new Error(`Sound effect is not initialized: ${id}`);
        }
        if (seen.has(sound)) {
            throw new Error(`Two Stickvania sound IDs reference the same Sound object: ${id}`);
        }
        seen.add(sound);
        return { id, sound };
    });
}

export function soundEffectForId(main: Main, id: SoundEffectFieldName): Sound {
    const sound = main[id];
    if (sound == null) {
        throw new Error(`Sound effect is not initialized: ${id}`);
    }
    return sound;
}
