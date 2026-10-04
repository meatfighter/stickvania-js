import { isSoundPlaybackSnapshot, type SoundPlaybackSnapshot } from "slick2d-ts";
import {
    MAX_PERSISTED_SOUND_EFFECT_VOICES,
    SOUND_EFFECT_FIELD_NAMES,
    isSoundEffectFieldName,
    registeredSoundEffects,
    type SoundEffectFieldName
} from "../AudioRegistry.js";
import type { Main } from "../Main.js";
import type { SoundEffectSnapshot } from "./GameStateSnapshot.js";

export { MAX_PERSISTED_SOUND_EFFECT_VOICES as MAX_TOTAL_SOUND_VOICES } from "../AudioRegistry.js";

const EMPTY_SOUND_PLAYBACK: SoundPlaybackSnapshot = Object.freeze({
    voices: Object.freeze([]),
    activeVoiceIndex: null
});

export function captureSoundEffects(main: Main): SoundEffectSnapshot[] {
    const snapshots: SoundEffectSnapshot[] = [];
    for (const { id, sound } of registeredSoundEffects(main)) {
        const playback = sound.capturePlaybackState();
        if (playback.voices.length > 0) {
            snapshots.push({ id, playback });
        }
    }
    return snapshots;
}

export function restoreSoundEffects(main: Main, snapshots: readonly SoundEffectSnapshot[]): void {
    const byId = new Map<SoundEffectFieldName, SoundPlaybackSnapshot>();
    for (const snapshot of snapshots) {
        byId.set(snapshot.id, snapshot.playback);
    }
    for (const { id, sound } of registeredSoundEffects(main)) {
        sound.restorePlaybackState(byId.get(id) ?? EMPTY_SOUND_PLAYBACK);
    }
}

export function isSoundEffectSnapshotsShape(value: unknown): value is SoundEffectSnapshot[] {
    if (!Array.isArray(value) || value.length > SOUND_EFFECT_FIELD_NAMES.length) {
        return false;
    }
    const seen = new Set<SoundEffectFieldName>();
    let totalVoices = 0;
    for (const entry of value) {
        if (!isPlainRecord(entry) || !hasExactFields(entry, ["id", "playback"]) || !isSoundEffectFieldName(entry.id) || seen.has(entry.id)) {
            return false;
        }
        if (!isSoundPlaybackSnapshot(entry.playback) || entry.playback.voices.length === 0) {
            return false;
        }
        totalVoices += entry.playback.voices.length;
        if (totalVoices > MAX_PERSISTED_SOUND_EFFECT_VOICES) {
            return false;
        }
        seen.add(entry.id);
    }
    return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
    const keys = Object.keys(value);
    return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}
