import { Main } from "./stickvania/Main.js";
import { DropItem } from "./stickvania/DropItem.js";
import { inspectSnapshotAuthority } from "./stickvania/persistence/SnapshotAuthorityPolicy.js";
import { isAudioOwnerStateValid } from "./stickvania/persistence/AudioOwnerPolicy.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { isReasonableStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStateSanity.js";
import { isPotentialStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStatePreflight.js";
import type { StickvaniaGameStateSnapshot as GameStateSnapshot } from "./stickvania/persistence/GameStateSnapshot.js";

function check(value: unknown, label: string): asserts value {
    if (!value) throw Error(label);
}
/** Mutations of complete current snapshots captured from the loaded game, never partial graph exceptions. */
export function verifyAuthority(records: Array<{ label: string; bytes: string }>): void {
    check(Main.RIGHT === 1 && DropItem.TYPE_WHIP === 15, "policy constants match producers");
    const serializer = new StickvaniaGameStateSerializer();
    const from = (label: string): GameStateSnapshot => {
        const r = records.find((r) => r.label === label);
        check(r, label);
        return JSON.parse(r.bytes) as GameStateSnapshot;
    };
    const healthy = from("WhiteSkeleton-pit-history-2199");
    const door = from("door-1-2-1-0-phase-3");
    const outcomes: string[] = [];
    function valid(s: GameStateSnapshot, label: string): void {
        check(serializer.isSupportedSnapshot(s), label + " structure");
        check(isReasonableStickvaniaGameStateSnapshot(s), label + " sanity");
        check(isPotentialStickvaniaGameStateSnapshot(s), label + " preflight");
    }
    function reject(base: GameStateSnapshot, label: string, mutate: (s: GameStateSnapshot) => void): void {
        const s = structuredClone(base);
        mutate(s);
        const before = JSON.stringify(s);
        check(!serializer.isSupportedSnapshot(s), label + " structure rejection");
        check(!isReasonableStickvaniaGameStateSnapshot(s), label + " sanity rejection");
        check(!isPotentialStickvaniaGameStateSnapshot(s), label + " preflight rejection");
        check(JSON.stringify(s) === before, label + " pure validation");
        outcomes.push(label);
    }
    for (const r of records) valid(JSON.parse(r.bytes) as GameStateSnapshot, r.label);
    reject(healthy, "duplicate region", (s) => s.stage!.regionThingStack.$stack.things.push(s.stage!.regionThingStack.$stack.things[0]!));
    reject(healthy, "cross dispatch", (s) => s.stage!.regionStackSwap.$stack.things.push(s.stage!.regionThingStack.$stack.things[0]!));
    reject(healthy, "Simon dispatched", (s) => s.stage!.regionThingStack.$stack.things.push(s.stage!.simon!));
    reject(healthy, "wrong weapon role", (s) => s.stage!.weaponsStack.$stack.things.push(s.stage!.regionThingStack.$stack.things[0]!));
    reject(healthy, "wrong whip count", (s) => (s.mainFields.visibleWhipCount = 1));
    reject(healthy, "freeze without watch", (s) => (s.mainFields.timeFrozen = 1));
    for (const state of [0, 4, 7]) reject(door, "uncontrolled door " + state, (s) => (s.things[s.stage!.door!]!.fields.state = state));
    for (const delay of [0, -1, 71]) reject(door, "door wait " + delay, (s) => (s.things[s.stage!.door!]!.fields.doorDelay = delay));
    for (const [state, delays] of [
        [1, [0, 70]],
        [2, [1, 10]],
        [3, [1, 70]],
        [5, [1, 10]],
        [6, [0, 70]]
    ] as const) {
        for (const delay of delays) {
            const s = structuredClone(door);
            Object.assign(s.things[s.stage!.door!]!.fields, { state, doorDelay: delay });
            check(inspectSnapshotAuthority(s) !== null, `Door phase ${state} delay ${delay}`);
        }
    }
    for (const state of [2, 5])
        for (const doorDelay of [0, 11])
            reject(door, `diagonal ${state}:${doorDelay}`, (s) => Object.assign(s.things[s.stage!.door!]!.fields, { state, doorDelay }));
    reject(door, "inactive door", (s) => (s.things[s.stage!.door!]!.fields.active = false));
    reject(door, "door scroll", (s) => (s.things[s.stage!.door!]!.fields.doorScroll1 = 0));
    reject(door, "missing old door", (s) => (s.stage!.oldThingStack.$stack.things = []));
    reject(healthy, "ownerless playing", (s) => {
        s.audio.currentSong = null;
        s.audio.requestedSong = null;
        for (const song of s.audio.songs) song.playing = false;
    });
    const intro = from("intro-ended-pending");
    reject(intro, "looped intro", (s) => {
        const part = s.audio.songs.find((song) => song.id === s.audio.currentSong)!.intro!;
        check(part.playback.transport !== "stopped", "active intro");
        Reflect.set(part.playback, "looped", true);
    });
    reject(healthy, "nonlooping active loop", (s) => {
        const part = s.audio.songs.find((song) => song.id === s.audio.currentSong)!.loop!;
        check(part.playback.transport !== "stopped", "active loop");
        Reflect.set(part.playback, "looped", false);
    });
    reject(intro, "standalone song alias", (s) => {
        const part = s.audio.songs.find((song) => song.id === s.audio.currentSong)!.intro!;
        s.audio.currentMusic = structuredClone(part);
        s.audio.currentSong = null;
        s.audio.requestedSong = null;
        for (const song of s.audio.songs) song.playing = false;
    });
    const ownerless = structuredClone(intro);
    ownerless.audio.currentSong = null;
    ownerless.audio.requestedSong = null;
    for (const song of ownerless.audio.songs) song.playing = false;
    valid(ownerless, "ownerless completion");
    const watchRecord = records.find((r) => {
        const s = JSON.parse(r.bytes) as GameStateSnapshot;
        return s.mode === Main.MODE_PLAYING && (s.mainFields.timeFrozen as number) > 0;
    });
    check(watchRecord, "real active watch");
    const watch = JSON.parse(watchRecord.bytes) as GameStateSnapshot;
    reject(watch, "wrong aggregate", (s) => (s.mainFields.timeFrozen = 0));
    reject(watch, "dead Simon", (s) => (s.things[s.stage!.simon!]!.fields.dead = 1));
    reject(watch, "wrong watch mode", (s) => {
        s.mode = Main.MODE_TITLE_SCREEN;
        s.mainFields.mode = s.mode;
    });
    reject(watch, "duplicate watch", (s) => {
        const item = s.things.find((t) => t.type === "StopWatch")!;
        const copy = structuredClone(item);
        copy.id = s.things.length;
        s.things.push(copy);
        s.stage!.weaponsStack.$stack.things.push(copy.id);
    });
    const zero = structuredClone(watch);
    zero.things.find((t) => t.type === "StopWatch")!.fields.lifeTime = 0;
    zero.mainFields.timeFrozen = 0;
    check(inspectSnapshotAuthority(zero) !== null, "zero-life retirement authority");
    check(isAudioOwnerStateValid(zero.audio), "watch lifetime does not change audio roles");
    Reflect.set(window, "authorityEvidence", outcomes);
}
