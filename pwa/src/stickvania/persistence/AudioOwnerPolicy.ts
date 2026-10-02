import { SONG_FIELD_NAMES, STANDALONE_MUSIC_FIELD_NAMES } from "../AudioRegistry.js";
const SONGS = new Set<string>(SONG_FIELD_NAMES);
const STANDALONE = new Set<string>(STANDALONE_MUSIC_FIELD_NAMES);
const TRANSPORTS = new Set(["stopped", "playing", "paused", "ended-pending"]);
type Fields = Record<string, unknown>;
function record(value: unknown): Fields | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : null;
}
/** Role/ownership constraints only; engine playback-value validation stays separate. */
export function isAudioOwnerStateValid(value: unknown): boolean {
    const audio = record(value);
    if (audio === null || !Array.isArray(audio.songs) || audio.songs.length !== SONG_FIELD_NAMES.length) return false;
    const current = audio.currentSong;
    const requested = audio.requestedSong;
    if (current !== null && (typeof current !== "string" || !SONGS.has(current))) return false;
    if (requested !== null && (typeof requested !== "string" || !SONGS.has(requested))) return false;
    const seen = new Set<string>();
    let playing: string | null = null;
    let activeCount = 0;
    for (const value of audio.songs as unknown[]) {
        const song = record(value);
        if (song === null || typeof song.id !== "string" || !SONGS.has(song.id) || seen.has(song.id) || typeof song.playing !== "boolean") return false;
        seen.add(song.id);
        if (song.playing) {
            if (playing !== null) return false;
            playing = song.id;
        }
        for (const suffix of ["intro", "loop"] as const) {
            if (suffix === "intro" && song.intro === null) continue;
            const part = record(song[suffix]);
            const playback = record(part?.playback);
            if (
                part?.id !== `${song.id}.${suffix}` ||
                playback === null ||
                typeof playback.transport !== "string" ||
                !TRANSPORTS.has(playback.transport) ||
                typeof playback.looped !== "boolean"
            )
                return false;
            if (playback.transport === "stopped") continue;
            activeCount++;
            if (playback.looped !== (suffix === "loop")) return false;
            if (current === null) {
                // Song.stop -> Music.stop leaves a completion awaiting the next poll.
                if (playback.transport !== "ended-pending") return false;
            } else if (song.id !== current) return false;
        }
    }
    if (current === null ? playing !== null : playing !== current || requested === null || audio.currentMusic !== null) return false;
    if (audio.currentMusic !== null) {
        const music = record(audio.currentMusic);
        const playback = record(music?.playback);
        if (
            music === null ||
            typeof music.id !== "string" ||
            !STANDALONE.has(music.id) ||
            playback === null ||
            typeof playback.transport !== "string" ||
            !TRANSPORTS.has(playback.transport) ||
            typeof playback.looped !== "boolean"
        )
            return false;
        if (playback.transport === "paused") return false;
        if (playback.transport !== "stopped") {
            if (playback.looped) return false;
            activeCount++;
        }
    }
    return activeCount <= 1;
}
