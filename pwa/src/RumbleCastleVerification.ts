import { isEndingAudioStateValid } from "./stickvania/persistence/PresentationStatePolicy.js";
import { isCastleTransitionValid } from "./stickvania/persistence/CastlePresentationPhasePolicy.js";
import { isPotentialStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStatePreflight.js";
import { Sys, type AppGameContainer } from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { Dracula } from "./stickvania/Dracula.js";
import { Orb } from "./stickvania/Orb.js";
import { cancelSimonAction, reconcileRegisteredSimonActionBeforeAttackRead } from "./stickvania/PlayerActionPolicy.js";
import { RumbleManager, type RumblePorts } from "./rumble/RumbleManager.js";
import { sampleRumble } from "./rumble/RumbleTimeline.js";
import { getRumbleEffect } from "./rumble/RumbleEffects.js";
import { CASTLE_TICK_MS, isCastlePresentationValid } from "./rumble/CastleCrumbleTimeline.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";

type Mounted = { main: Main; container: AppGameContainer };
export type Harness = {
    mountMain(restore: ((main: Main, container: AppGameContainer) => boolean) | null): Promise<Mounted>;
    destroyMounted(m: Mounted | null): void;
    advanceFrames(m: Mounted, n: number): void;
    gameplaySnapshot(s: StickvaniaGameStateSerializer, m: Main): string;
};
function check(value: unknown, message: string): asserts value {
    if (!value) throw Error(message);
}
const microtasks = async (): Promise<void> => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
function clock(readTick: () => number) {
    let now = 0,
        next = 0;
    const timers = new Map<number, { at: number; cb: () => void }>();
    const output: Array<{ tick: number; at: number; duration: number; strong: number; weak: number }> = [];
    const ports: RumblePorts = {
        now: () => now,
        available: () => true,
        pads: () => [{} as Gamepad],
        schedule: (cb, delay) => {
            const id = ++next;
            timers.set(id, { at: now + delay, cb });
            return id as unknown as ReturnType<typeof globalThis.setTimeout>;
        },
        cancel: (id) => {
            timers.delete(id as unknown as number);
        },
        play: async (_pad, pulse) => {
            output.push({ tick: readTick(), at: now, ...pulse });
        },
        silence: async () => {}
    };
    return {
        manager: new RumbleManager(true, ports),
        output,
        timers,
        async advance(ms: number) {
            const target = now + ms;
            for (let n = 0; n < 10000; n++) {
                await microtasks();
                const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) {
                    now = target;
                    return;
                }
                now = due[1].at;
                timers.delete(due[0]);
                due[1].cb();
            }
            throw Error("Busy rumble loop");
        }
    };
}
const tick = (m: Main): number => Reflect.get(m, "castleCrumbleRumbleTicks") as number;

/** A new document reconstructs each transition-produced checkpoint before any gameplay update. */
export async function verifyRumbleRestore(h: Harness): Promise<void> {
    const expected = localStorage.getItem("rumble-expected");
    check(expected, "Missing expected checkpoint");
    const store = new StickvaniaGameStateStore("rumble"),
        serializer = new StickvaniaGameStateSerializer();
    let attached = false;
    const mounted = await h.mountMain((m, gc) => {
        m.setBrowserSuspended(true);
        const f = clock(() => tick(m));
        m.rumble = f.manager;
        check(store.restore(m, gc), "Fresh-document castle restore");
        const restored = serializer.createSnapshot(m, "rumble");
        check(isEndingAudioStateValid(restored.mainFields, restored.audio), "Fresh-document retains ending ownership");
        check(f.timers.size === 0, "Restore cannot attach output before accepted session");
        check(h.gameplaySnapshot(serializer, m) === expected, "Fresh-document immediate recapture");
        m.render(gc, gc.getGraphics());
        check(h.gameplaySnapshot(serializer, m) === expected, "Fresh-document first render");
        m.setBrowserSuspended(false);
        f.manager.setSuspended(false);
        m.resumeBrowserOnlyRumbles();
        attached = true;
        f.manager.stopAll();
        return true;
    });
    check(attached, "Accepted restore ran");
    const continuation = JSON.parse(localStorage.getItem("presentation-continuation") ?? "null") as { frames: number; expected: string } | null;
    if (continuation !== null) {
        check(Number.isInteger(continuation.frames) && continuation.frames > 0 && continuation.frames <= 24, "Fresh-document continuation bound");
        h.advanceFrames(mounted, continuation.frames);
        mounted.main.render(mounted.container, mounted.container.getGraphics());
        check(h.gameplaySnapshot(serializer, mounted.main) === continuation.expected, "Fresh-document identical transition destination/camera/graph/RNG");
    }
    h.destroyMounted(mounted);
}

/** Boundary seeds are explicit: final Dracula death tick, Orb contact, and a short tally. */
export async function verifyRumbleCastle(h: Harness): Promise<void> {
    let mounted: Mounted | null = await h.mountMain(null);
    const serializer = new StickvaniaGameStateSerializer(),
        store = new StickvaniaGameStateStore("rumble");
    const checkpoints: Array<{ label: string; bytes: string; expected: string }> = [],
        states: unknown[] = [],
        actions: string[] = [];
    const current = (): Mounted => {
        check(mounted, "Mounted runtime");
        return mounted;
    };
    const frame = (): void => {
        h.advanceFrames(current(), 1);
        current().main.render(current().container, current().container.getGraphics());
    };
    try {
        let m = current().main;
        // Real loaded final stage and real producer/dispatcher; no copied castle loop.
        m.mode = Main.MODE_PLAYING;
        m.players = 4;
        m.createStageForStateRestore(5);
        m.fade = 0;
        m.fadeState = Main.FADE_DONE;
        m.playerPower = 16;
        m.time = 5;
        m.hearts = 2;
        check(m.simon, "Simon loaded");
        m.simon.invincible = 500;
        m.regionThingStack.clear();
        m.regionStackSwap.clear();
        const dracula = new Dracula(m, m.simon.x + 100, m.simon.y);
        m.pushThing(dracula);
        frame();
        check(store.save(m, () => true).saved, "Save actual loaded Dracula combat producer");
        checkpoints.push({ label: "dracula-combat", bytes: localStorage.getItem(GAME_STATE_STORAGE_KEY)!, expected: h.gameplaySnapshot(serializer, m) });
        Object.assign(dracula, { state: Dracula.STATE_DYING, dying: 909, hits: 0 });
        frame();
        const orb = m.regionThingStack.things.slice(0, m.regionThingStack.top + 1).find((t) => t instanceof Orb) as Orb | undefined;
        check(orb, "Dracula terminal update must produce a real Orb");
        Object.assign(orb, { appearDelay: 0, fadeIn: 91, x: m.simon.x + 20, y: m.simon.y + 8 });
        frame();
        check(m.beatStageFlag, "Orb collision starts tally");
        const orbBoundary = serializer.createSnapshot(m, "rumble");
        check(
            orbBoundary.audio.requestedSong === "ending" && serializer.isSupportedSnapshot(orbBoundary),
            "Immediate Orb request before next-frame promotion is valid"
        );
        for (let i = 0; i < 200 && m.mode !== Main.MODE_CASTLE_FALLS; i++) {
            if (m.fadeState === Main.FADE_OUT && m.fadeReason === Main.FADE_REASON_SHOW_CASTLE_FALLS && [0, 11, 22].includes(m.fade)) {
                const snapshot = serializer.createSnapshot(m, "rumble");
                check(isCastleTransitionValid(snapshot.mainFields), "Real completed tally requests castle entry");
                check(isEndingAudioStateValid(snapshot.mainFields, snapshot.audio), "Pending castle owns current and requested ending");
                const wrongPending = structuredClone(snapshot);
                wrongPending.audio.requestedSong = "stage_6_1";
                check(
                    !serializer.isSupportedSnapshot(wrongPending) && !isPotentialStickvaniaGameStateSnapshot(wrongPending),
                    "Reject stale pending castle song"
                );
                const expected = h.gameplaySnapshot(serializer, m);
                check(store.save(m, () => true).saved, "Save real pending castle entry");
                checkpoints.push({ label: "entry-fade" + m.fade, bytes: localStorage.getItem(GAME_STATE_STORAGE_KEY)!, expected });
            }
            frame();
        }
        check(m.mode === Main.MODE_CASTLE_FALLS && m.currentSong === m.ending, "Tally/fade enters castle with ending owner");
        let f = clock(() => tick(current().main));
        m.rumble = f.manager;
        m.resumeBrowserOnlyRumbles();
        const checkpoint = async (label: string): Promise<void> => {
            m = current().main;
            const before = h.gameplaySnapshot(serializer, m);
            check(store.save(m, () => true).saved, "Save reachable castle " + label);
            const bytes = localStorage.getItem(GAME_STATE_STORAGE_KEY)!;
            check(JSON.parse(bytes).version === 24, "Current schema");
            checkpoints.push({ label, bytes, expected: before });
            m.setBrowserSuspended(true);
            f.manager.setSuspended(true);
            await f.advance(100);
            check(h.gameplaySnapshot(serializer, m) === before, "Retained suspension preserves " + label);
            m.setBrowserSuspended(false);
            f.manager.setSuspended(false);
            m.resumeBrowserOnlyRumbles();
            await f.advance(0);
            check(h.gameplaySnapshot(serializer, m) === before, "Retained resume preserves " + label);
            f.manager.stopAll();
            h.destroyMounted(mounted);
            mounted = null;
            mounted = await h.mountMain((fresh, gc) => {
                fresh.setBrowserSuspended(true);
                check(store.restore(fresh, gc), "Fresh Main " + label);
                check(fresh.currentSong === fresh.ending, "Fresh Main retains ending ownership");
                return true;
            });
            m = current().main;
            check(h.gameplaySnapshot(serializer, m) === before, "Fresh Main immediate recapture " + label);
            m.render(current().container, current().container.getGraphics());
            check(h.gameplaySnapshot(serializer, m) === before, "Fresh Main first render " + label);
            f = clock(() => tick(current().main));
            m.rumble = f.manager;
            check(f.timers.size === 0, "No restore-side rumble subscription");
            m.setBrowserSuspended(false);
            m.resumeBrowserOnlyRumbles();
            await f.advance(0);
        };
        await checkpoint("fade22");
        for (let i = 0; i < 22; i++) {
            frame();
            await f.advance(10);
            check(tick(current().main) === 0, "Fade must not advance castle clock");
            if (i === 10) await checkpoint("fade11");
        }
        check(f.output.length === 0, "No castle output during fade-in");
        await checkpoint("fade0");
        // All 814 stable producer states, not the independent unit oracle.
        for (let n = 0; n <= 813; n++) {
            m = current().main;
            check(tick(m) === n, "Actual castle counter " + n);
            const snapshot = serializer.createSnapshot(m, "rumble");
            check(isCastlePresentationValid(snapshot.mainFields), "Actual visual state " + n);
            check(isCastleTransitionValid(snapshot.mainFields), "Actual castle transition phase " + n);
            check(isEndingAudioStateValid(snapshot.mainFields, snapshot.audio), "Actual castle ending owner " + n);
            states.push({
                tick: n,
                fields: Object.fromEntries(Object.entries(snapshot.mainFields).filter(([k]) => k.startsWith("castleFall"))),
                sample: sampleRumble(getRumbleEffect("castleCrumble"), n * 10)
            });
            const phaseCheckpoint =
                n === 176 ||
                n === 177 ||
                n === 505 ||
                n === 721 ||
                n === 722 ||
                n === 754 ||
                n === 780 ||
                n === 812 ||
                n === 813 ||
                [46, 63, 80, 97, 114, 131, 148, 165].some((t) => n === t || n === t + 11);
            if (phaseCheckpoint) await checkpoint("tick" + n);
            if (n < 813) {
                const begin = f.output.length;
                frame();
                await f.advance(10);
                for (const packet of f.output.slice(begin)) {
                    const expected = sampleRumble(getRumbleEffect("castleCrumble"), packet.tick * 10).pulse;
                    check(
                        expected !== null && packet.strong === expected.strong && packet.weak === expected.weak,
                        "Scene output matches visual tick " + packet.tick
                    );
                    check(packet.duration > 0 && packet.duration <= 20, "Finite bounded lease");
                }
            }
        }
        frame();
        check(tick(current().main) === 813 && current().main.fadeState === Main.FADE_OUT, "Terminal stops at 813");
        await checkpoint("terminal-fade");
        for (let i = 0; i < 23; i++) {
            frame();
            if (i === 10) await checkpoint("terminal-fade11");
            if (i === 21) await checkpoint("terminal-fade22");
        }
        check(current().main.mode === Main.MODE_CREDITS, "Natural credits transition");
        f.manager.stopAll();
        // Actual outer dispatcher retains integer 10ms step and eight-update debt cap.
        const saved = checkpoints.find((c) => c.label === "tick505")!;
        localStorage.setItem(GAME_STATE_STORAGE_KEY, saved.bytes);
        check(store.restore(current().main, current().container), "Restore catch-up seed");
        m = current().main;
        const getTime = Sys.getTime;
        const wall = 10000;
        Sys.getTime = () => wall;
        try {
            Reflect.set(m, "nextFrameTime", wall - 1);
            m.update(current().container, 10);
            check(Reflect.get(m, "nextFrameTime") === wall - 1 + CASTLE_TICK_MS, "Actual fixed step");
            const before = tick(m);
            Reflect.set(m, "nextFrameTime", wall - 10000);
            m.update(current().container, 10000);
            check(tick(m) === before + 8, "Catch-up cap remains eight");
        } finally {
            Sys.getTime = getTime;
        }
        // Real save/store rejection: malformed reads never write or mutate the live graph.
        const good = serializer.createSnapshot(m, "rumble");
        const goodBytes = JSON.stringify(good);
        const badFields = {
            castleCrumbleRumbleTicks: [-1, 0.5, 814, 0],
            castleFallSparkCount: [8],
            castleFallSparkDelay: [0],
            castleFallSparkVisible: [true],
            castleFallY: [111],
            castleFallDelay: [0]
        };
        const mutations = Object.entries(badFields).flatMap(([key, values]) =>
            values.map((value) => {
                const bad = structuredClone(good);
                Reflect.set(bad.mainFields, key, value);
                return bad;
            })
        );
        const phasePatches: Array<Record<string, number | boolean>> = [
            { fadeState: Main.FADE_OUT, fade: 22, fadeReason: Main.FADE_REASON_SHOW_CREDITS },
            { fadeState: Main.FADE_IN, fade: 22 },
            { fadeState: Main.FADE_OUT, fade: 22, fadeReason: Main.FADE_REASON_STAIRS },
            { fade: 1 },
            { beatStageFlag: false },
            { beatStageDelay: 7 },
            { playerPower: 15 },
            { time: 1 },
            { hearts: 1 }
        ];
        for (const patch of phasePatches) {
            const bad = structuredClone(good);
            Object.assign(bad.mainFields, patch);
            check(!isPotentialStickvaniaGameStateSnapshot(bad), "Potential reader rejects contradictory castle phase");
            mutations.push(bad);
        }
        const entryCheckpoint = checkpoints.find((c) => c.label === "entry-fade22");
        check(entryCheckpoint, "Real pending-entry checkpoint exists");
        const entry = JSON.parse(entryCheckpoint.bytes);
        for (const [key, value] of Object.entries({ beatStageFlag: false, beatStageDelay: 7, playerPower: 15, time: 1, hearts: 1 })) {
            const bad = structuredClone(entry);
            Reflect.set(bad.mainFields, key, value);
            check(!isPotentialStickvaniaGameStateSnapshot(bad), "Potential reader rejects impossible pending entry");
            mutations.push(bad);
        }
        for (const version of [22, 23, 25]) {
            const bad = structuredClone(good);
            bad.version = version;
            mutations.push(bad);
        }
        for (const bad of mutations) {
            const bytes = JSON.stringify(bad),
                before = h.gameplaySnapshot(serializer, m);
            localStorage.setItem(GAME_STATE_STORAGE_KEY, bytes);
            const set = Storage.prototype.setItem,
                remove = Storage.prototype.removeItem;
            let writes = 0;
            Storage.prototype.setItem = function (k, v) {
                writes++;
                set.call(this, k, v);
            };
            Storage.prototype.removeItem = function (k) {
                writes++;
                remove.call(this, k);
            };
            try {
                check(!store.hasValidSave() && !store.restore(m, current().container), "Malformed castle rejection");
            } finally {
                Storage.prototype.setItem = set;
                Storage.prototype.removeItem = remove;
            }
            check(
                writes === 0 && localStorage.getItem(GAME_STATE_STORAGE_KEY) === bytes && h.gameplaySnapshot(serializer, m) === before,
                "Rejection containment"
            );
        }
        localStorage.setItem(GAME_STATE_STORAGE_KEY, goodBytes);
        const old = tick(m);
        Reflect.set(m, "castleCrumbleRumbleTicks", 814);
        check(
            !store.save(m, () => true).saved && localStorage.getItem(GAME_STATE_STORAGE_KEY) === goodBytes,
            "Outgoing invalid state preserves previous bytes"
        );
        Reflect.set(m, "castleCrumbleRumbleTicks", old);
        const originalPhase = { fadeState: m.fadeState, fade: m.fade, fadeReason: m.fadeReason };
        try {
            m.fadeState = Main.FADE_OUT;
            m.fade = 22;
            m.fadeReason = Main.FADE_REASON_SHOW_CREDITS;
            check(
                !store.save(m, () => true).saved && localStorage.getItem(GAME_STATE_STORAGE_KEY) === goodBytes,
                "Outgoing contradictory castle phase preserves previous bytes"
            );
        } finally {
            Object.assign(m, originalPhase);
        }
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = () => {
            throw Error("Save must not read");
        };
        try {
            check(store.save(m, () => true).saved, "Valid no-read overwrite");
        } finally {
            Storage.prototype.getItem = get;
        }
        const start = performance.now();
        for (let i = 0; i < 10000; i++) check(isCastlePresentationValid(good.mainFields), "Validator diagnostic");
        const validationMs = performance.now() - start;
        // Real hurt and action reconciliation across difficulties and delayed attack phases.
        for (const difficulty of [Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD])
            for (const attack of ["whip", "prethrow", "launched"])
                for (const damage of ["enemy", "timeout", "already-hurt-timeout"]) {
                    m = current().main;
                    m.mode = Main.MODE_PLAYING;
                    m.createStageForStateRestore(0);
                    m.setDifficulty(difficulty);
                    m.fade = 0;
                    m.fadeState = Main.FADE_DONE;
                    m.beatStageFlag = false;
                    m.time = 10;
                    m.playerPower = 16;
                    check(m.simon, "Action Simon");
                    Object.assign(m.simon, {
                        invincible: 0,
                        hurt: false,
                        dead: 0,
                        flashing: 0,
                        whipping: true,
                        throwing: attack !== "whip",
                        whipIncrementor: attack === "launched" ? 19 : 1,
                        whipIndex: 0
                    });
                    m.regionThingStack.clear();
                    m.regionStackSwap.clear();
                    f = clock(() => tick(m));
                    m.rumble = f.manager;
                    if (attack === "launched") {
                        m.weaponType = Main.WEAPON_TYPE_DAGGER;
                        m.hearts = 5;
                        frame();
                        check(m.weaponsStack.top >= 0, "Real delayed throw launches before next-tick damage");
                    }
                    if (damage === "enemy") {
                        m.hurtSimon(2);
                        frame();
                    } else {
                        if (damage === "already-hurt-timeout") m.hurtSimon(2);
                        m.time = 1;
                        m.timeIncrementor = 90;
                        frame();
                    }
                    reconcileRegisteredSimonActionBeforeAttackRead();
                    cancelSimonAction(m);
                    await f.advance(0);
                    check(!m.simon.whipping && !m.simon.throwing, "Actual action canceled " + attack + damage);
                    const death = damage !== "enemy";
                    const expected = getRumbleEffect(death ? "playerDeath" : "playerHurt").pattern[0];
                    check("strong" in expected, "Initial hit pulse");
                    check(f.output[0]?.strong === expected.strong, "Hurt/death survives cancellation " + attack + damage);
                    actions.push(difficulty + ":" + attack + ":" + damage);
                    f.manager.stopAll();
                }
        m.mode = Main.MODE_PLAYING;
        m.createStageForStateRestore(0);
        // Castle presentation fields may be stale outside castle mode; only its tick bound is global.
        Reflect.set(m, "castleCrumbleRumbleTicks", 0);
        Object.assign(m, { castleFallY: 111, castleFallSparkCount: 0, castleFallDelay: 91 });
        check(store.save(m, () => true).saved, "Stale castle phase outside mode7 remains saveable");
        Reflect.set(window, "rumbleCastleEvidence", {
            states,
            checkpoints,
            actions,
            validationMs,
            scope: "Loaded dispatcher with labeled Dracula/Orb boundary seeds; physical feel pending"
        });
    } finally {
        current().main.stopAllRumbles();
        h.destroyMounted(mounted);
    }
}
