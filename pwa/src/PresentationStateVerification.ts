import { Music, SoundStore } from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import type { StageSegment } from "./stickvania/StageSegment.js";
import { FloorBreaker } from "./stickvania/FloorBreaker.js";
import { CREDITS_TITLES, creditsSecondLine } from "./stickvania/CreditsText.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import { isPotentialStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStatePreflight.js";
import { isEndingAudioStateValid } from "./stickvania/persistence/PresentationStatePolicy.js";
import { isReasonableStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStateSanity.js";
import type { Harness } from "./RumbleCastleVerification.js";

type Snapshot = ReturnType<StickvaniaGameStateSerializer["createSnapshot"]>;
function check(value: unknown, label: string): asserts value {
    if (!value) throw Error(label);
}

/** Loaded producers and reader boundaries; no release entry point imports this module. */
export async function verifyPresentationState(h: Harness): Promise<void> {
    let mounted: Awaited<ReturnType<Harness["mountMain"]>> | null = await h.mountMain(null);
    const serializer = new StickvaniaGameStateSerializer(),
        store = new StickvaniaGameStateStore("presentation");
    const checkpoints: Array<{ label: string; bytes: string; expected: string }> = [];
    const rejected: string[] = [],
        routes: string[] = [];
    const live = () => {
        check(mounted, "Presentation runtime mounted");
        return mounted;
    };
    const m = () => live().main;
    const frame = () => h.advanceFrames(live(), 1);
    const value = (name: string): number => Reflect.get(m(), name) as number;
    const flag = (name: string): boolean => Reflect.get(m(), name) as boolean;
    const capture = () => serializer.createSnapshot(m(), "presentation");
    const invoke = (name: string, ...args: unknown[]) => (Reflect.get(m(), name) as (...values: unknown[]) => unknown).apply(m(), args);
    const quietFade = () => {
        m().fade = 0;
        m().fadeState = Main.FADE_DONE;
    };
    function reject(bad: Snapshot, label: string): void {
        const before = h.gameplaySnapshot(serializer, m()),
            policy = [SoundStore.get().musicOn(), SoundStore.get().soundsOn()];
        check(!serializer.isSupportedSnapshot(bad), "Presentation full reader rejects " + label);
        check(!isPotentialStickvaniaGameStateSnapshot(bad), "Presentation preflight rejects " + label);
        const bytes = JSON.stringify(bad);
        localStorage.setItem(GAME_STATE_STORAGE_KEY, bytes);
        const set = Storage.prototype.setItem,
            remove = Storage.prototype.removeItem;
        let writes = 0;
        Storage.prototype.setItem = () => {
            writes++;
        };
        Storage.prototype.removeItem = () => {
            writes++;
        };
        try {
            check(!store.hasValidSave() && !store.restore(m(), live().container), "Presentation store rejects " + label);
        } finally {
            Storage.prototype.setItem = set;
            Storage.prototype.removeItem = remove;
        }
        check(writes === 0 && localStorage.getItem(GAME_STATE_STORAGE_KEY) === bytes, "Presentation bad read preserves bytes " + label);
        check(h.gameplaySnapshot(serializer, m()) === before, "Presentation bad read preserves live graph " + label);
        check(
            JSON.stringify(policy) === JSON.stringify([SoundStore.get().musicOn(), SoundStore.get().soundsOn()]),
            "Presentation bad read preserves audio policy"
        );
        rejected.push(label);
    }
    async function checkpoint(label: string, fresh = true): Promise<Snapshot> {
        const snapshot = capture();
        if ([Main.MODE_TITLE_SCREEN, Main.MODE_INPUT_CONFIG, Main.MODE_INTRO, Main.MODE_MAP].includes(snapshot.mode)) {
            const dormant = structuredClone(snapshot);
            Object.assign(dormant.mainFields, {
                creditsIndex: 12,
                recordingIndex: 100,
                creditsPaused: true,
                creditsAdvance: true,
                creditsTitleIndex: 100,
                creditsTitleIndex2: 100,
                creditsDelay: 1000
            });
            check(serializer.isSupportedSnapshot(dormant) && isPotentialStickvaniaGameStateSnapshot(dormant), "Dormant credits fields remain legal " + label);
        }
        check(serializer.isSupportedSnapshot(snapshot), "Presentation full positive " + label);
        check(isPotentialStickvaniaGameStateSnapshot(snapshot), "Presentation preflight positive " + label);
        const expected = h.gameplaySnapshot(serializer, m());
        // A valid authorized save must never inspect the old slot, even following a malformed read.
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
            if (key === GAME_STATE_STORAGE_KEY) throw Error("No-read overwrite");
            return get.call(this, key);
        };
        try {
            check(store.save(m(), () => true).saved, "Presentation save " + label);
        } finally {
            Storage.prototype.getItem = get;
        }
        const bytes = localStorage.getItem(GAME_STATE_STORAGE_KEY)!;
        m().render(live().container, live().container.getGraphics());
        check(h.gameplaySnapshot(serializer, m()) === expected, "Presentation first render " + label);
        m().setBrowserSuspended(true);
        m().setBrowserSuspended(false);
        const resumed = JSON.parse(expected);
        if (snapshot.mode === Main.MODE_PLAYING) {
            const simon = resumed.things.find((thing: { id: number }) => thing.id === snapshot.stage?.simon);
            if (simon) Object.assign(simon.fields, { releasedJump: false, releasedKneel: false, releasedWhip: false });
        }
        check(h.gameplaySnapshot(serializer, m()) === JSON.stringify(resumed), "Presentation retained Continue " + label);
        if (fresh) {
            h.destroyMounted(mounted);
            mounted = null;
            mounted = await h.mountMain((main, gc) => store.restore(main, gc));
            check(h.gameplaySnapshot(serializer, m()) === expected, "Presentation fresh Main recapture " + label);
            m().render(live().container, live().container.getGraphics());
            check(h.gameplaySnapshot(serializer, m()) === expected, "Presentation fresh Main first render " + label);
            check(isEndingAudioStateValid(capture().mainFields, capture().audio), "Presentation restored ending owner " + label);
            checkpoints.push({ label, bytes, expected });
        }
        return snapshot;
    }
    function press(method: string, action: () => void): void {
        const input = m().controlInput;
        check(input, "Producer input");
        const original = Reflect.get(input, method);
        Reflect.set(input, method, () => true);
        try {
            action();
        } finally {
            Reflect.set(input, method, original);
        }
    }
    async function route(label: string, reason: number, mutate: (bad: Snapshot) => void): Promise<void> {
        check(m().fadeState === Main.FADE_OUT && m().fadeReason === reason, "Actual route producer " + label);
        const good = await checkpoint("route-" + label);
        const bad = structuredClone(good);
        mutate(bad);
        reject(bad, "route-" + label);
        routes.push(label);
    }
    function stage(index: number): void {
        m().mode = Main.MODE_PLAYING;
        m().players = 4;
        m().beatStageFlag = false;
        m().floorBreaking = false;
        m().createStageForStateRestore(index);
        quietFade();
    }
    try {
        // Real title producers, with input boundary doubles only for the selected edge.
        m().initTitleScreen();
        quietFade();
        Reflect.set(m(), "titleTimeout", 1);
        frame();
        await route("title-timeout", Main.FADE_REASON_SHOW_DEMO, (b) => {
            b.mainFields.titleTimeout = 1;
        });
        m().initTitleScreen();
        quietFade();
        press("isMenuSelectPressed", frame);
        await route("title-start", Main.FADE_REASON_SHOW_INTRO, (b) => {
            b.mainFields.titleSelectedIndex = 1;
        });
        m().initTitleScreen();
        quietFade();
        invoke("setTitleMenu", 2);
        press("isMenuSelectPressed", frame);
        await route("title-change", Main.FADE_REASON_SHOW_INPUT_CONFIG, (b) => {
            b.mainFields.titleMenu = 0;
        });
        m().initIntro();
        quietFade();
        Reflect.set(m(), "introTime", 1);
        frame();
        await route("intro", Main.FADE_REASON_RESTORE_CHECKPOINT, (b) => {
            b.mainFields.introTime = 1;
        });
        stage(0);
        m().initMapScreen();
        quietFade();
        Reflect.set(m(), "mapScreenX", value("mapScreenTargetX"));
        Reflect.set(m(), "introSimonX", 576);
        Reflect.set(m(), "mapDelay", 0);
        frame();
        await route("map", Main.FADE_REASON_RESTORE_CHECKPOINT, (b) => {
            b.mainFields.mapDelay = 1;
        });
        for (const selected of [true, false]) {
            stage(0);
            m().initContinueScreen();
            quietFade();
            Reflect.set(m(), "continueSelected", selected);
            press("isMenuSelectPressed", frame);
            await route(selected ? "continue" : "end", selected ? Main.FADE_REASON_RESTORE_CHECKPOINT : Main.FADE_REASON_SHOW_TITLE_SCREEN, (b) => {
                b.mainFields.continueSelected = !selected;
            });
        }
        for (const reserves of [0, 1]) {
            stage(0);
            m().players = reserves;
            m().playerPower = 0;
            check(m().simon, "Death Simon");
            Reflect.set(m().simon!, "dead", 474);
            frame();
            await route("death-" + reserves, reserves ? Main.FADE_REASON_RESTORE_CHECKPOINT : Main.FADE_REASON_SHOW_CONTINUE_SCREEN, (b) => {
                b.mainFields.playerPower = 1;
            });
        }
        for (const index of [0, 1, 3, 4]) {
            stage(index);
            Object.assign(m(), { beatStageFlag: true, beatStageDelay: 0, playerPower: 16, time: 0, hearts: 0 });
            frame();
            await route("tally-" + index, Main.FADE_REASON_SHOW_MAP, (b) => {
                b.mainFields.hearts = 1;
            });
        }
        stage(2);
        Reflect.set(
            m(),
            "checkpoint",
            (Reflect.get(m(), "stageSegments") as StageSegment[])[2].regions.find((region) => region.checkpoint !== null)!.checkpoint
        );
        m().restoreCheckpoint();
        m().floorBreaking = true;
        const breaker = new FloorBreaker(m());
        Object.assign(breaker, { breakDelay: 0, X: 143, delay: 0 });
        check(m().walls, "Loaded FloorBreaker walls");
        for (const [x, y] of [
            [144, 6],
            [145, 6],
            [146, 7],
            [147, 8]
        ])
            m().removeBlock(x, y);
        check(!breaker.update(live().container), "Actual FloorBreaker terminal producer");
        await route("floor-breaker", Main.FADE_REASON_SHOW_MAP, (b) => {
            b.mainFields.floorBreaking = true;
        });
        stage(0);
        const stairSegment = (Reflect.get(m(), "stageSegments") as StageSegment[]).find(
            (segment) => segment.stairsEntries.some((entry) => entry.connection !== null) && segment.regions.some((region) => region.checkpoint !== null)
        );
        check(stairSegment, "Connected stairs segment");
        Reflect.set(m(), "checkpoint", stairSegment.regions.find((region) => region.checkpoint !== null)!.checkpoint);
        m().restoreCheckpoint();
        const stair = (Reflect.get(m(), "stageSegment") as StageSegment).stairsEntries.find((entry) => entry.connection !== null);
        check(stair, "Connected stairs entry");
        check(m().simon, "Stairs Simon");
        Object.assign(m().simon!, { x: stair.x, onStairs: true, hurt: false, y: stair.up ? -62 : 285, flashing: 0, dead: 0 });
        invoke("updateSimon", live().container);
        await route("stairs", Main.FADE_REASON_STAIRS, (b) => {
            const s = b.things.find((t) => t.id === b.stage?.simon);
            check(s, "Saved Simon");
            s.fields.onStairs = false;
        });
        for (let i = 0; i < 23; i++) frame();
        check(m().fadeState === Main.FADE_IN, "Actual stairs dispatcher reaches destination");
        m().initDemo();
        quietFade();
        press("isAnyNonDirectionalPressed", frame);
        await route("demo-exit", Main.FADE_REASON_SHOW_TITLE_SCREEN, (b) => {
            b.mainFields.mode = Main.MODE_PLAYING;
            b.mode = Main.MODE_PLAYING;
        });
        m().initTitleScreen();
        quietFade();
        m().initInputConfig(live().container);
        await checkpoint("input-editor");
        m().finishInputConfig();
        check(m().mode === Main.MODE_TITLE_SCREEN && m().fadeState === Main.FADE_DONE, "Input return remains direct");
        await checkpoint("input-review-return");
        for (const mode of [Main.MODE_DEMO, Main.MODE_CREDITS]) {
            for (const action of ["stairs", "death", "tally"]) {
                m().beatStageFlag = false;
                m().floorBreaking = false;
                if (mode === Main.MODE_CREDITS) {
                    m().stopAllSounds();
                    m().requestSong(m().ending);
                    m().currentSong = m().ending;
                    m().currentMusic = null;
                    m().ending.play();
                    m().initCredits();
                } else m().initDemo();
                quietFade();
                m().players = 2;
                if (action === "stairs") {
                    const segment = Reflect.get(m(), "stageSegment") as StageSegment;
                    const entry = segment.stairsEntries.find((entry) => entry.connection !== null);
                    check(entry, "Shared simulation connected stairs");
                    Object.assign(m().simon!, { x: entry.x, onStairs: true, hurt: false, y: entry.up ? -62 : 285, dead: 0 });
                    invoke("updateSimon", live().container);
                    await route(mode + "-shared-stairs", Main.FADE_REASON_STAIRS, (b) => {
                        b.things.find((t) => t.id === b.stage?.simon)!.fields.onStairs = false;
                    });
                } else if (action === "death") {
                    m().playerPower = 0;
                    Reflect.set(m().simon!, "dead", 474);
                    frame();
                    await route(mode + "-shared-death", Main.FADE_REASON_RESTORE_CHECKPOINT, (b) => {
                        b.mainFields.playerPower = 1;
                    });
                } else {
                    Object.assign(m(), { beatStageFlag: true, beatStageDelay: 0, playerPower: 16, time: 0, hearts: 0 });
                    frame();
                    await route(mode + "-shared-tally", Main.FADE_REASON_SHOW_MAP, (b) => {
                        b.mainFields.hearts = 1;
                    });
                }
            }
        }
        m().beatStageFlag = false;
        // Canonical ending ownership; the real credits mounts deliberately change requestedSong.
        m().stopAllSounds();
        m().requestSong(m().ending);
        m().currentSong = m().ending;
        m().currentMusic = null;
        m().ending.play();
        m().initCredits();
        m().fadeState = Main.FADE_IN;
        m().fade = 22;
        m().fadeReason = Main.FADE_REASON_SHOW_CREDITS;
        const seen = new Set<string>();
        let last = -1;
        for (let steps = 0; steps < 50000 && m().mode === Main.MODE_CREDITS; steps++) {
            const index = value("creditsIndex"),
                first = value("creditsTitleIndex"),
                second = value("creditsTitleIndex2"),
                delay = value("creditsDelay"),
                cursor = value("recordingIndex");
            if (index !== last) {
                console.info("Presentation clip " + index);
                last = index;
            }
            let phase: string | null = null;
            if (m().fadeState === Main.FADE_IN && m().fade === 22) phase = "initial";
            else if (m().fadeState === Main.FADE_DONE && cursor === 364 && !flag("creditsPaused")) phase = "mid-recording";
            else if (cursor === 728 && !flag("creditsPaused")) phase = "last-input";
            else if (m().fadeState === Main.FADE_DONE && first === 1 && second === 0 && delay === 15) phase = "first-letter";
            else if (m().fadeState === Main.FADE_DONE && first === CREDITS_TITLES[index].length && second === 0 && delay === 15) phase = "first-line";
            else if (m().fadeState === Main.FADE_DONE && second === 1 && delay === 15) phase = "second-line";
            else if (m().fadeState === Main.FADE_DONE && second === creditsSecondLine(index).length && !flag("creditsAdvance") && delay === 15)
                phase = "second-complete";
            else if (flag("creditsAdvance") && delay === (index === 12 ? 1365 : 182)) phase = "hold-start";
            else if (flag("creditsAdvance") && delay === 0 && m().fadeState === Main.FADE_DONE) phase = "hold-end";
            else if (m().fadeState === Main.FADE_OUT && [0, 11, 22].includes(m().fade)) phase = "out-" + m().fade;
            const label = index + "-" + phase;
            if (phase && !seen.has(label)) {
                seen.add(label);
                const good = await checkpoint("credit-" + label);
                check(isEndingAudioStateValid(good.mainFields, good.audio), "Credits ending ownership");
                if (index === 0 && phase === "first-letter") {
                    for (const owner of [null, "stage_1_1"] as const) {
                        const bad = structuredClone(good);
                        bad.audio.currentSong = owner;
                        bad.audio.currentMusic = null;
                        bad.audio.requestedSong = owner ?? "ending";
                        for (const song of bad.audio.songs) {
                            song.playing = false;
                            for (const part of [song.intro, song.loop])
                                if (part) Object.assign(part.playback, { transport: "stopped", positionSeconds: 0, fade: null });
                        }
                        if (owner) {
                            const song = bad.audio.songs.find((song) => song.id === owner)!;
                            song.playing = true;
                            check(song.loop, "Alternative loop");
                            Object.assign(song.loop.playback, { transport: "playing", looped: true });
                        }
                        check(isReasonableStickvaniaGameStateSnapshot(bad), "Wrong ending owner remains generically coherent");
                        reject(bad, "ending-owner-" + owner);
                    }
                    for (const patch of [{ transport: "stopped" as const }, { looped: false }]) {
                        const bad = structuredClone(good),
                            ending = bad.audio.songs.find((song) => song.id === "ending")!;
                        check(ending.loop, "Ending loop");
                        Object.assign(ending.loop.playback, patch);
                        reject(bad, "ending-transport-" + JSON.stringify(patch));
                    }
                    const missing = structuredClone(good);
                    missing.audio.songs = missing.audio.songs.filter((song) => song.id !== "ending");
                    reject(missing, "missing-ending");
                    const loop = Reflect.get(m().ending, "loop") as Music;
                    const playback = { ...loop.capturePlaybackState(), positionSeconds: 0.125, volume: 0 };
                    loop.restorePlaybackState(playback);
                    SoundStore.get().setMusicOn(false);
                    await checkpoint("ending-muted-offset");
                    const restored = (Reflect.get(m().ending, "loop") as Music).capturePlaybackState();
                    check(
                        restored.transport === "playing" &&
                            restored.looped &&
                            restored.positionSeconds === 0.125 &&
                            restored.volume === 0 &&
                            !SoundStore.get().musicOn(),
                        "Muted zero-volume ending preserves logical offset"
                    );
                    SoundStore.get().setMusicOn(true);
                }
                if (phase === "mid-recording") {
                    const bads: Array<[string, Record<string, number | boolean>]> = [
                        ["paused-cursor-100", { creditsPaused: true, recordingIndex: 100 }],
                        ["caption-during-playback", { creditsTitleIndex: 1 }],
                        ["fractional-caption", { creditsTitleIndex: 0.5 }],
                        ["negative-caption", { creditsTitleIndex: -1 }],
                        ["oversized-caption", { creditsTitleIndex: 100 }],
                        ["second-before-first", { creditsPaused: true, recordingIndex: 728, creditsTitleIndex: 1, creditsTitleIndex2: 1 }],
                        ["early-advance", { creditsAdvance: true }],
                        ["wrong-stage", { stageIndex: (Number(good.mainFields.stageIndex) + 1) % 6 }],
                        ["early-title", { fadeState: Main.FADE_OUT, fadeReason: Main.FADE_REASON_SHOW_TITLE_SCREEN }],
                        ["fractional-second", { creditsTitleIndex2: 0.5 }],
                        ["oversized-second", { creditsTitleIndex2: 100 }],
                        ["early-next", { fadeState: Main.FADE_OUT, fadeReason: Main.FADE_REASON_ADVANCE_CREDITS }]
                    ];
                    for (const [name, patch] of bads) {
                        const bad = structuredClone(good);
                        Object.assign(bad.mainFields, patch);
                        reject(bad, index + "-" + name);
                    }
                    check(store.save(m(), () => true).saved, "Valid save replaces corrupt slot before outgoing failure control");
                    const old = localStorage.getItem(GAME_STATE_STORAGE_KEY);
                    Reflect.set(m(), "creditsPaused", true);
                    Reflect.set(m(), "recordingIndex", 100);
                    check(
                        !store.save(m(), () => true).saved && localStorage.getItem(GAME_STATE_STORAGE_KEY) === old,
                        "Invalid outgoing credits preserve previous bytes"
                    );
                    Reflect.set(m(), "creditsPaused", false);
                    Reflect.set(m(), "recordingIndex", cursor);
                }
                if (phase === "hold-start")
                    for (const delay of [-1, 0.5, index === 12 ? 1366 : 183]) {
                        const bad = structuredClone(good);
                        bad.mainFields.creditsDelay = delay;
                        reject(bad, index + "-delay-" + delay);
                    }
                if (index === 12 && phase === "out-0") {
                    const bad = structuredClone(good);
                    bad.mainFields.fadeReason = Main.FADE_REASON_ADVANCE_CREDITS;
                    reject(bad, "final-card-index-13");
                }
            }
            if (index === 12 && flag("creditsPaused") && delay > 0) press("isAnyNonDirectionalPressed", frame);
            else frame();
        }
        check(m().mode === Main.MODE_TITLE_SCREEN, "All twelve recordings and final card return to title");
        for (let i = 0; i <= 12; i++)
            for (const phase of [
                "initial",
                "first-letter",
                "first-line",
                "second-line",
                "second-complete",
                "hold-start",
                "hold-end",
                "out-0",
                "out-11",
                "out-22"
            ])
                check(seen.has(i + "-" + phase), "Complete credits boundary census " + i + "-" + phase);
        for (let i = 0; i < 12; i++)
            for (const phase of ["mid-recording", "last-input"]) check(seen.has(i + "-" + phase), "Recording boundary " + i + "-" + phase);
        quietFade();
        const title = await checkpoint("returned-title");
        const frozen = structuredClone(title);
        frozen.mainFields.fade = 12;
        reject(frozen, "DONE-nonzero-title");
        for (const version of [22, 24]) {
            const bad = structuredClone(title);
            bad.version = version;
            reject(bad, "schema-" + version);
        }
        Reflect.set(window, "presentationStateEvidence", { checkpoints, rejected, routes, creditsBoundaries: [...seen] });
    } finally {
        h.destroyMounted(mounted);
    }
}
