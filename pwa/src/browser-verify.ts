import { verifyCounterParity } from "./CounterParityVerification.js";
import * as NesInputProfile from "./stickvania/NesInputProfile.js";
import { Orb } from "./stickvania/Orb.js";
import { StopWatch } from "./stickvania/StopWatch.js";
import { verifyAuthoritativeSave } from "./PersistenceContractVerification.js";
import { AppGameContainer, Display, Input, ResourceLoader, SoundStore, type SoundPlaybackSnapshot } from "slick2d-ts";
import { getStickvaniaResourceVersion } from "./ResourceVersions.generated.js";
import { STICKVANIA_RESOURCE_REFS } from "./resources.js";
import { Main } from "./stickvania/Main.js";
import { ButtonMapping } from "./stickvania/ButtonMapping.js";
import { INPUT_CONFIG_ARM_DELAY, INPUT_CONFIG_DONE_DELAY, isInputConfigModeSnapshot } from "./stickvania/InputConfigMode.js";
import { StickvaniaBufferedGame } from "./stickvania/StickvaniaBufferedGame.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";

const result = document.querySelector<HTMLElement>("#result");
const host = document.querySelector<HTMLElement>("#game-host");
if (result === null || host === null) {
    throw new Error("Browser verification fixture is missing required elements.");
}
const gameHost = host;

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function soundPlaybackForRef(ref: string, fractions: number[], activeVoiceIndex: number | null): SoundPlaybackSnapshot {
    const buffer = SoundStore.get().getDecodedAudioBuffer(ref);
    assert(buffer !== null && Number.isFinite(buffer.duration) && buffer.duration > 0, `Missing decoded duration for ${ref}.`);
    return {
        voices: fractions.map((fraction) => {
            assert(fraction > 0 && fraction < 1, `Invalid test offset fraction for ${ref}: ${fraction}`);
            return {
                looped: false,
                playbackRate: 1,
                positionSeconds: buffer.duration * fraction,
                gain: 1,
                spatialPosition: null
            };
        }),
        activeVoiceIndex
    };
}

function sameSnapshot(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

async function waitForTitle(main: Main): Promise<void> {
    const deadline = performance.now() + 10_000;
    while (main.mode !== Main.MODE_TITLE_SCREEN && performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    assert(main.mode === Main.MODE_TITLE_SCREEN, `Real Stickvania Main did not reach the title screen; mode=${main.mode}.`);
    for (let i = 0; i < 3; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
}

async function preloadRuntimeResources(): Promise<void> {
    ResourceLoader.clearCache();
    ResourceLoader.removeAllResourceLocations();
    ResourceLoader.addResourceLocation(new URL("./", window.location.href));
    ResourceLoader.setCacheVersionResolver((ref) => getStickvaniaResourceVersion(ref));
    ResourceLoader.setRetryOptions(1, 0);
    const audioRefs = STICKVANIA_RESOURCE_REFS.filter((ref) => ref.endsWith(".ogg"));
    const nonAudioRefs = STICKVANIA_RESOURCE_REFS.filter((ref) => !ref.endsWith(".ogg"));
    await Promise.all([ResourceLoader.preloadResources(nonAudioRefs, { concurrency: 6 }), SoundStore.get().preloadAudioBuffers(audioRefs, { concurrency: 4 })]);
}

async function mountMain(restore: ((main: Main, container: AppGameContainer) => boolean) | null): Promise<{
    main: Main;
    buffered: StickvaniaBufferedGame;
    container: AppGameContainer;
}> {
    gameHost.replaceChildren();
    Display.setParent(gameHost);
    const main = new Main();
    const buffered = new StickvaniaBufferedGame(main, "crisp");
    const container = new AppGameContainer(buffered, 1024, 832, false);
    container.setPreserveAudioCacheOnDestroy(true);
    container.setHighDpiEnabled(true);
    container.setMaxDevicePixelRatio(2);
    if (restore !== null) {
        main.loadingCompleteHandler = () => {
            container.setLoopSuspended(true);
            const restored = restore(main, container);
            return restored;
        };
    }
    await container.start();
    await ResourceLoader.waitForAll();
    if (restore === null) await waitForTitle(main);
    container.setLoopSuspended(true);
    assert(buffered.getPresentationInfo().physicalWidth > 0, "Buffered presentation did not acquire a physical width.");
    return { main, buffered, container };
}

function destroyMounted(mounted: { main: Main; container: AppGameContainer } | null): void {
    if (mounted === null) {
        return;
    }
    mounted.main.stopAllSounds();
    mounted.container.destroy();
    Display.setParent(null);
}

function advanceFrames(mounted: { main: Main; container: AppGameContainer }, count: number): void {
    // Call the existing Java-parity frame operation, bypassing only the wall clock.
    const frame = Reflect.get(mounted.main, "updateFrame") as (gc: AppGameContainer) => void;
    for (let i = 0; i < count; i++) frame.call(mounted.main, mounted.container);
}

function gameplaySnapshot(serializer: StickvaniaGameStateSerializer, main: Main): string {
    const snapshot = serializer.createSnapshot(main, "browser-verification");
    // Wall-clock timestamps and audio playback positions are intentionally nondeterministic.
    const fields = { ...snapshot.mainFields };
    delete fields.nextFrameTime;
    return JSON.stringify({ mode: snapshot.mode, fields, random: snapshot.random, stage: snapshot.stage, things: snapshot.things });
}

async function verify(): Promise<void> {
    localStorage.clear();
    await preloadRuntimeResources();

    if (new URLSearchParams(location.search).get("suite") === "counter-parity") {
        await verifyCounterParity({ mountMain, destroyMounted, advanceFrames, gameplaySnapshot });
        return;
    }
    const store = new StickvaniaGameStateStore("browser-verification");
    let first: Awaited<ReturnType<typeof mountMain>> | null = null;
    let second: Awaited<ReturnType<typeof mountMain>> | null = null;
    try {
        first = await mountMain(null);
        verifyAuthoritativeSave(GAME_STATE_STORAGE_KEY, first.main, (main) => store.save(main, () => true));
        first.main.createStageForStateRestore(0);
        first.main.mode = Main.MODE_PLAYING;
        first.main.playerPower = 16;
        first.main.fade = Main.FADE_DONE;
        first.main.fadeState = Main.FADE_IN;
        assert(first.main.simon !== null, "Stage must contain Simon.");
        first.main.simon.x += 16;
        first.main.fireSparks(first.main.simon.x + 100, first.main.simon.y - 40);
        assert(first.main.isStateSaveReady(), "Active stage must be saveable.");
        first.main.score = 123450;
        first.main.players = 3;

        // Install physically valid nonzero logical offsets through the public
        // Slick 1.7 API. Fractions of the decoded duration cannot accidentally
        // place a one-shot at/past its real end on a short sample.
        first.main.watch_tick.restorePlaybackState(soundPlaybackForRef("soundfx/watch_tick.ogg", [0.25], 0));
        first.main.heartbeat.restorePlaybackState(soundPlaybackForRef("soundfx/heartbeat.ogg", [0.2, 0.1], null));

        const saveResult = store.save(first.main, () => true);
        assert(saveResult.saved, `Real browser Main did not save successfully: ${JSON.stringify(saveResult)}`);
        assert(store.hasValidSave(), "Saved real browser Main did not validate.");
        const storedText = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        assert(storedText !== null, "Saved state was not written under the current storage key.");
        const stored = JSON.parse(storedText) as ReturnType<StickvaniaGameStateSerializer["createSnapshot"]>;
        const expectedWatchTick = stored.audio.sounds.find(({ id }) => id === "watch_tick")?.playback;
        const expectedHeartbeat = stored.audio.sounds.find(({ id }) => id === "heartbeat")?.playback;
        assert(expectedWatchTick !== undefined, "Saved state omitted active watch_tick Sound.");
        assert(expectedHeartbeat !== undefined, "Saved state omitted active heartbeat Sound.");
        assert(expectedHeartbeat.voices.length === 2 && expectedHeartbeat.activeVoiceIndex === null, "Saved state lost overlapping heartbeat voice semantics.");
        assert(!stored.audio.sounds.some(({ id }) => id === "lands"), "Sparse Sound state included an inactive effect.");

        first.buffered.setScalingPreference("smooth");
        first.buffered.setScalingPreference("pixel-perfect");
        first.buffered.setScalingPreference("crisp");

        const serializer = new StickvaniaGameStateSerializer();
        const saved = serializer.createSnapshot(first.main, "browser-verification");
        assert(saved.stage !== null && saved.things.length > 1, "Fixture must contain a real stage and multiple entities.");
        advanceFrames(first, 12);
        const expected = gameplaySnapshot(serializer, first.main);
        destroyMounted(first);
        first = null;

        second = await mountMain((main, container) => {
            const restored = store.restore(main, container);
            if (!restored) {
                return false;
            }
            // Assert exact logical state inside the loading-complete restore hook,
            // before resumed simulation or a replacement physical generation can
            // advance any one-shot waveform.
            assert(sameSnapshot(main.watch_tick.capturePlaybackState(), expectedWatchTick), "Fresh Main did not restore watch_tick at the exact saved offset.");
            assert(sameSnapshot(main.heartbeat.capturePlaybackState(), expectedHeartbeat), "Fresh Main did not restore overlapping heartbeat voices exactly.");
            assert(main.lands.capturePlaybackState().voices.length === 0, "Omitted Sound state did not restore lands as empty.");
            return true;
        });
        assert(second.main.isStateSaveReady(), "Restored browser Main is not save-state ready.");
        assert(second.main.score === 123450, "Fresh Stickvania Main did not restore score state.");
        assert(second.main.players === 3, "Fresh Stickvania Main did not restore player-count state.");
        assert(second.main.mode === Main.MODE_PLAYING && second.main.simon !== null, "Fresh Main must restore active gameplay.");
        advanceFrames(second, 12);
        assert(gameplaySnapshot(serializer, second.main) === expected, "Restored stage diverged from uninterrupted gameplay after 12 simulation frames.");
        verifyMappingCompletionPollBoundary(second.main, second.container);
        verifyEditorResume(second.main, second.container);
        destroyMounted(second);
        second = null;
        await verifyCounterParity({ mountMain, destroyMounted, advanceFrames, gameplaySnapshot });
        await verifyOrbRestore();
        await verifyNesMapping();
    } finally {
        destroyMounted(first);
        destroyMounted(second);
        store.clear(() => true);
        localStorage.clear();
    }
}

void verify().then(
    () => {
        result.dataset.status = "passed";
        result.textContent = "Real Stickvania browser boot/save/fresh-lifetime restore verification passed.";
    },
    (error: unknown) => {
        console.error(error);
        result.dataset.status = "failed";
        result.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
    }
);

/** Complete mapping through real DOM -> Input.poll -> editor -> Main transition. */
function verifyMappingCompletionPollBoundary(main: Main, container: AppGameContainer): void {
    container.setLoopSuspended(true);
    const input = container.getInput();
    const controls = main.controlInput;
    const canvas = gameHost.querySelector("canvas");
    assert(controls !== null, "Completion fixture requires real StickvaniaInput.");
    assert(canvas instanceof HTMLCanvasElement, "Completion fixture requires the real input canvas.");

    const originalMapping = main.buttonMapping.clone();
    const gamepadsDescriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    const store = new StickvaniaGameStateStore("browser-verification");
    let padPresent = false;
    let heldButton = -1;
    const digits = [
        { code: "Digit8", key: "8", binding: Input.KEY_8 },
        { code: "Digit2", key: "2", binding: Input.KEY_2 },
        { code: "Digit4", key: "4", binding: Input.KEY_4 },
        { code: "Digit6", key: "6", binding: Input.KEY_6 },
        { code: "KeyF", key: "f", binding: Input.KEY_F },
        { code: "KeyG", key: "g", binding: Input.KEY_G }
    ];
    const numpad = [
        { code: "Numpad8", key: "8", binding: Input.KEY_NUMPAD8 },
        { code: "Numpad2", key: "2", binding: Input.KEY_NUMPAD2 },
        { code: "Numpad4", key: "4", binding: Input.KEY_NUMPAD4 },
        { code: "Numpad6", key: "6", binding: Input.KEY_NUMPAD6 },
        { code: "KeyF", key: "f", binding: Input.KEY_F },
        { code: "KeyG", key: "g", binding: Input.KEY_G }
    ];
    const scenarios = [
        { name: "digits / keyboard final / no pad", keys: digits, controllerFinal: false, withPad: false },
        { name: "numpad / keyboard final / held pad", keys: numpad, controllerFinal: false, withPad: true },
        { name: "digits / controller final", keys: digits, controllerFinal: true, withPad: true }
    ];
    const send = (type: string, key: { code: string; key: string }, repeat = false): void => {
        canvas.dispatchEvent(new KeyboardEvent(type, { code: key.code, key: key.key, repeat, bubbles: true }));
    };
    const poll = (): void => input.poll(1024, 832);
    const frame = (): void => advanceFrames({ main, container }, 1);
    const tick = (): void => {
        poll();
        frame();
    };
    const state = () => {
        const snapshot = main.captureInputConfigModeState();
        assert(snapshot !== null, "Completion fixture lost its actual editor.");
        return snapshot;
    };

    Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () =>
            padPresent
                ? [
                      {
                          id: "mapping-completion-fixture",
                          index: 0,
                          connected: true,
                          mapping: "standard",
                          timestamp: 1,
                          axes: [0, 0],
                          buttons: Array.from({ length: 17 }, (_, i) => ({
                              pressed: i === heldButton,
                              touched: i === heldButton,
                              value: i === heldButton ? 1 : 0
                          }))
                      }
                  ]
                : []
    });

    try {
        for (const persistenceSucceeds of [true, false]) {
            for (const scenario of scenarios) {
                const label = `${scenario.name}; saved=${persistenceSucceeds}`;
                for (const key of [...digits, ...numpad]) send("keyup", key);
                heldButton = -1;
                padPresent = scenario.withPad;
                main.setInputMappingChangedHandler(null);
                main.buttonMapping.resetToDefaults();
                const defaults = main.buttonMapping.clone();
                assert(defaults.save(() => true).saved, "Unable to seed fixture mapping storage.");
                main.fade = Main.FADE_DONE;
                main.fadeState = Main.FADE_DONE;
                canvas.focus();
                input.resume();
                main.setBrowserSuspended(false);
                main.initInputConfig(container);

                let writes = 0;
                main.setInputMappingChangedHandler(() => {
                    writes++;
                    // Control the failure outcome, not Input/StickvaniaInput behavior.
                    if (!persistenceSucceeds) return { saved: false, reason: "unavailable" };
                    const outcome = main.buttonMapping.save(() => true);
                    assert(outcome.saved, `${label}: real fixture mapping save failed.`);
                    return outcome;
                });
                for (let tickIndex = 0; tickIndex < INPUT_CONFIG_ARM_DELAY; tickIndex++) tick();
                assert(state().armDelay === 0, `${label}: editor did not arm.`);

                // The first five assignments also enter through the real event queue.
                for (let i = 0; i < 5; i++) {
                    const key = scenario.keys[i]!;
                    send("keydown", key);
                    poll();
                    assert(state().stepIndex === i + 1 && !state().finished, `${label}: wrong intermediate step ${i}.`);
                    assert(writes === 0, `${label}: mapping committed before the final assignment.`);
                    send("keyup", key);
                    tick();
                }

                const finalKey = scenario.keys[5]!;
                if (scenario.withPad) heldButton = 2;
                if (scenario.controllerFinal) {
                    tick(); // Controller capture occurs during actual post-poll Main.updateFrame.
                } else {
                    send("keydown", finalKey);
                    // The old production implementation must throw HERE, on the sixth poll.
                    poll();
                }

                const completed = state();
                assert(completed.finished && completed.stepIndex === 6, `${label}: completion was not reached.`);
                assert(completed.doneDelay === INPUT_CONFIG_DONE_DELAY, `${label}: completion delay changed.`);
                assert(completed.message === (persistenceSucceeds ? "SAVED" : "NOT SAVED"), `${label}: wrong completion result.`);
                assert(isInputConfigModeSnapshot(completed), `${label}: current producer emitted invalid editor state.`);
                assert(writes === 1, `${label}: completion must notify exactly once.`);
                assert(completed.assignedKeys.length === (scenario.controllerFinal ? 5 : 6), `${label}: wrong keyboard assignment count.`);
                assert(completed.assignedControllerBindings.length === (scenario.controllerFinal ? 1 : 0), `${label}: wrong controller assignment count.`);
                const expectedKeys = scenario.keys.slice(0, 5).map(({ binding }) => binding);
                expectedKeys.push(scenario.controllerFinal ? defaults.keyAttack : finalKey.binding);
                const actualKeys = [
                    main.buttonMapping.keyUp,
                    main.buttonMapping.keyDown,
                    main.buttonMapping.keyLeft,
                    main.buttonMapping.keyRight,
                    main.buttonMapping.keyJump,
                    main.buttonMapping.keyAttack
                ];
                assert(sameSnapshot(actualKeys, expectedKeys), `${label}: committed keyboard mapping differs.`);
                if (scenario.controllerFinal) assert(main.buttonMapping.controllerAttack === 2, `${label}: controller ATTACK missing.`);
                const expectedStoredMapping = persistenceSucceeds ? main.buttonMapping : defaults;
                assert(sameSnapshot(ButtonMapping.load(), expectedStoredMapping), `${label}: mapping persistence outcome differs.`);
                assert(store.save(main, () => true).saved && store.hasValidSave(), `${label}: completed editor must remain game-saveable.`);

                // Keep the final keyboard key and/or controller button held throughout.
                for (let elapsed = 1; elapsed < INPUT_CONFIG_DONE_DELAY; elapsed++) {
                    tick();
                    assert(state().doneDelay === INPUT_CONFIG_DONE_DELAY - elapsed, `${label}: countdown drift.`);
                    assert(state().message === completed.message, `${label}: completion message changed early.`);
                }
                tick();
                const assertReviewMenu = (): void => {
                    assert(main.mode === Main.MODE_TITLE_SCREEN, `${label}: review is not in title mode.`);
                    assert(Reflect.get(main, "titleMenu") === Main.TITLE_MENU_INPUT, `${label}: expected the Input review table.`);
                    assert(Reflect.get(main, "titleSelectedIndex") === 2, `${label}: Done must be selected for review.`);
                    assert(main.fadeState === Main.FADE_DONE, `${label}: review unexpectedly left the menu.`);
                };
                assertReviewMenu();
                assert(main.captureInputConfigModeState() === null, `${label}: completed editor/listener was not retired.`);
                assert(!controls.isMenuSelectPressed(), `${label}: review transition exposed a held completion edge.`);
                assert(store.save(main, () => true).saved && store.hasValidSave(), `${label}: Input/Done review must remain game-saveable.`);
                if (!scenario.controllerFinal) send("keydown", finalKey, true);
                for (let i = 0; i < 3; i++) tick();
                assertReviewMenu();
                assert(writes === 1, `${label}: countdown/review replayed the mapping write.`);

                // The first release/fresh press activates DONE, not START.
                heldButton = -1;
                send("keyup", finalKey);
                tick();
                assert(!controls.isMenuSelectPressed(), `${label}: release manufactured a selection.`);
                assertReviewMenu();
                if (scenario.controllerFinal) heldButton = 2;
                else send("keydown", finalKey);
                tick();
                assert(Reflect.get(main, "titleMenu") === Main.TITLE_MENU_MAIN, `${label}: fresh input did not activate Done.`);
                assert(Reflect.get(main, "titleSelectedIndex") === 0, `${label}: Done must return to root/Start.`);
                assert(main.mode === Main.MODE_TITLE_SCREEN && main.fadeState === Main.FADE_DONE, `${label}: Done also started gameplay.`);
                assert(writes === 1, `${label}: activating Done replayed the mapping write.`);

                // Keeping that same activation held cannot carry through to START.
                if (!scenario.controllerFinal) send("keydown", finalKey, true);
                for (let i = 0; i < 3; i++) tick();
                assert(Reflect.get(main, "titleMenu") === Main.TITLE_MENU_MAIN, `${label}: held Done activation changed the root menu.`);
                assert(Reflect.get(main, "titleSelectedIndex") === 0, `${label}: held Done activation moved the cursor.`);
                assert(main.fadeState === Main.FADE_DONE, `${label}: held Done activation selected Start.`);

                // A SECOND release/fresh press may now select START normally.
                heldButton = -1;
                send("keyup", finalKey);
                tick();
                assert(!controls.isMenuSelectPressed(), `${label}: second release manufactured a selection.`);
                if (scenario.controllerFinal) heldButton = 2;
                else send("keydown", finalKey);
                tick();
                assert(
                    main.fadeState === Main.FADE_OUT && main.fadeReason === Main.FADE_REASON_SHOW_INTRO,
                    `${label}: fresh input after Done did not select Start.`
                );
                heldButton = -1;
                send("keyup", finalKey);
                poll(); // Drain release; do not advance into another scene.
                assert(writes === 1, `${label}: review/Done/Start replayed the mapping write.`);
            }
        }
    } finally {
        main.setInputMappingChangedHandler(null);
        heldButton = -1;
        for (const key of [...digits, ...numpad]) send("keyup", key);
        main.buttonMapping.copyFrom(originalMapping);
        if (gamepadsDescriptor) Object.defineProperty(navigator, "getGamepads", gamepadsDescriptor);
        else Reflect.deleteProperty(navigator, "getGamepads");
    }
    console.log("Mapping completion passed through real polling, Input/Done review, and separate fresh Done/Start activations.");
}

/** Exercise real DOM -> Slick Input -> Main resume -> editor boundaries. */
function verifyEditorResume(main: Main, container: AppGameContainer): void {
    container.setLoopSuspended(true);
    const input = container.getInput();
    const canvas = document.querySelector("canvas");
    assert(canvas !== null, "Missing actual input canvas");

    const start = () => {
        main.initInputConfig(container);
    };
    const update = () => {
        main.updateInputConfig(container);
    };
    const count = () => main.captureInputConfigModeState()!.assignedKeys.length;
    const poll = () => input.poll(1024, 960);
    const event = (target: EventTarget, type: string, code = "KeyQ", key = "q", repeat = false) =>
        target.dispatchEvent(new KeyboardEvent(type, { code, key, repeat, bubbles: true }));
    for (const scenario of ["released", "held", "queued", "menu-only"]) {
        input.resume();
        main.setBrowserSuspended(false);
        canvas.focus();
        start();
        if (scenario !== "menu-only") {
            event(canvas, "keydown");
            poll();
        }
        if (scenario === "queued") {
            event(canvas, "keyup");
            event(canvas, "keydown");
            event(canvas, "keyup");
        }
        assert(count() === 0, "Arming must not bind");
        main.setBrowserSuspended(true);
        input.pause();
        if (scenario === "released") event(window, "keyup");
        if (scenario === "menu-only") {
            event(window, "keydown");
            event(window, "keyup");
        }
        for (const [code, key] of [
            ["Enter", "Enter"],
            ["Space", " "]
        ]) {
            event(window, "keydown", code, key);
            event(window, "keyup", code, key);
        }
        input.resume();
        main.setBrowserSuspended(false);
        canvas.focus();
        for (let i = 0; i < 12; i++) {
            poll();
            update();
        }
        assert(count() === 0, "Paused/queued activation leaked: " + scenario);
        if (scenario === "held") {
            event(canvas, "keydown", "KeyQ", "q", true);
            poll();
            update();
            assert(count() === 0, "Held repeat bound after resume");
            event(canvas, "keyup");
            poll();
        }
        event(canvas, "keydown");
        poll();
        update();
        assert(count() === 1, "First fresh released key rejected: " + scenario);
        event(canvas, "keydown", "KeyQ", "q", true);
        poll();
        update();
        assert(count() === 1, "Repeat advanced editor twice");
        event(canvas, "keyup");
        poll();
    }
    verifyControllerResume(main, container);
}

function verifyControllerResume(main: Main, container: AppGameContainer): void {
    const input = container.getInput();
    const previous = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    let held = -1,
        invalid = false,
        identity = "fixture-pad";
    Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => {
            if (invalid) throw new Error("Injected enumeration failure");
            return [
                {
                    id: identity,
                    index: 0,
                    connected: true,
                    mapping: "standard",
                    timestamp: 1,
                    axes: [0, 0],
                    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === held, touched: i === held, value: i === held ? 1 : 0 }))
                }
            ];
        }
    });
    const tick = () => {
        input.poll(1024, 960);
        main.updateInputConfig(container);
    };
    const count = () => main.captureInputConfigModeState()!.assignedControllerBindings.length;
    try {
        for (const scenario of ["neutral", "held", "invalid", "replacement"]) {
            held = -1;
            invalid = false;
            main.initInputConfig(container);
            for (let i = 0; i < 12; i++) tick();
            held = 0;
            tick();
            assert(count() === 1, "First controller assignment missing");
            main.setBrowserSuspended(true);
            input.pause();
            if (scenario === "neutral") held = -1;
            if (scenario === "invalid") invalid = true;
            input.resume();
            main.setBrowserSuspended(false);
            // Finish arming without extra neutral ticks that could hide the stale-gate defect.
            while (main.captureInputConfigModeState()!.armDelay > 0) tick();
            assert(count() === 1, "Resume baseline manufactured an assignment");
            if (scenario === "replacement") {
                identity += "-new";
                held = 1;
                tick();
                tick();
                assert(count() === 1, "Same-slot replacement manufactured an edge");
            }
            if (scenario !== "neutral") {
                tick();
                assert(count() === 1, "Held or invalid input bypassed the neutral gate");
                invalid = false;
                held = -1;
                tick();
                tick();
            }
            assert(count() === 1, "Neutral sample assigned a control");
            held = 1;
            tick();
            assert(count() === 2, "First fresh controller edge lost: " + scenario);
            tick();
            assert(count() === 2, "Held controller assigned twice");
        }
    } finally {
        if (previous) Object.defineProperty(navigator, "getGamepads", previous);
        else Reflect.deleteProperty(navigator, "getGamepads");
    }
}

/** Current-schema stage-clear poses retain presentation but never reacquire hits. */
async function verifyOrbRestore(): Promise<void> {
    const store = new StickvaniaGameStateStore("orb-browser");
    const serializer = new StickvaniaGameStateSerializer();
    let mounted: Awaited<ReturnType<typeof mountMain>> | null = null;
    const retire = (): void => {
        destroyMounted(mounted);
        mounted = null;
    };
    const action = (main: Main): string => {
        const s = main.simon;
        assert(s !== null, "Missing Simon");
        return JSON.stringify([s.whipping, s.throwing, s.whipIndex, s.whipIncrementor, s.releasedWhip, s.whipType]);
    };
    try {
        for (const [stage, reentered] of [
            [0, false],
            [2, false],
            [2, true]
        ] as const)
            for (const throwing of [false, true]) {
                mounted = await mountMain(null);
                const source = mounted.main;
                source.createStageForStateRestore(stage);
                if (reentered) source.createStageForStateRestore(stage);
                source.mode = Main.MODE_PLAYING;
                source.fadeState = Main.FADE_DONE;
                source.playerPower = 16;
                source.time = 1;
                source.hearts = 1;
                const simon = source.simon;
                assert(simon !== null, "Orb stage missing Simon");
                simon.hurt = false;
                simon.dead = 0;
                simon.invincible = 0;
                Object.assign(simon, { whipping: true, throwing, whipIndex: throwing ? 1 : 2, whipIncrementor: throwing ? 12 : 25, releasedWhip: false });
                source.weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                source.weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
                const watch = new StopWatch(source);
                source.weaponsStack.push(watch);
                assert(watch.lifeTime > 0 && source.timeFrozen > 0, "Active watch fixture failed");
                const orb = new Orb(source, simon.x + 20, simon.y + 8, 0);
                orb.fadeIn = 91;
                let frozen = "";
                const updateOrb = orb.update;
                orb.update = (gc) => {
                    const alive = updateOrb.call(orb, gc);
                    assert(!alive && source.beatStageFlag, "Real Orb did not establish boundary");
                    frozen = action(source);
                    // Existing policy rejects the transient pre-cleanup watch state.
                    assert(!store.save(source, () => true).saved, "Terminal active-watch state must not be persisted");
                    return alive;
                };
                source.regionThingStack.push(orb);
                advanceFrames(mounted, 1);
                orb.update = updateOrb;
                assert(frozen !== "" && action(source) === frozen, "Orb weapon pass changed frozen action");
                assert(source.timeFrozen === 0 && watch.lifeTime === 0, "Orb weapon pass skipped StopWatch cleanup");
                const beforeSave = serializer.createSnapshot(source, "orb-browser");
                assert(serializer.isSupportedSnapshotForLoadedResources(source, beforeSave), "Source loaded-resource validation failed stage " + stage);
                const malformed = structuredClone(beforeSave);
                assert(malformed.stage !== null, "Missing saved resource graph");
                malformed.stage.segments[0]!.regions[0]!.max++;
                assert(!serializer.isSupportedSnapshotForLoadedResources(source, malformed), "Malformed region boundary accepted");
                assert(store.save(source, () => true).saved, "Frozen pose/current watch save rejected");
                retire();
                mounted = await mountMain((fresh, gc) => {
                    const ok = store.restore(fresh, gc);
                    assert(ok, "Orb restore rejected valid saved state");
                    if (ok) {
                        assert(fresh !== source && fresh.beatStageFlag, "Fresh Orb restore missing");
                        assert(action(fresh) === frozen, "Frozen action changed on restore");
                    }
                    return ok;
                });
                const fresh = mounted.main;
                assert(fresh.simon !== null, "Restored Simon missing");
                assert(fresh.timeFrozen === 0, "Restored stage-clear watch retained freeze");
                for (const stack of [fresh.weaponsStack, fresh.weaponsStackSwap])
                    for (let i = 0; i <= stack.top; i++) {
                        const thing = stack.things[i];
                        if (thing instanceof StopWatch) assert(thing.lifeTime === 0, "Restored watch remained active");
                    }
                const rect = [fresh.simon.x - 128, fresh.simon.y - 128, fresh.simon.x + 256, fresh.simon.y + 256] as const;
                assert(
                    !fresh.intersectsSimon(...rect) && !fresh.intersectsWhip(...rect) && !fresh.intersectsWeapon(...rect),
                    "Fresh restore acquired an interaction " +
                        JSON.stringify({
                            stage,
                            throwing,
                            flag: fresh.beatStageFlag,
                            mode: fresh.mode,
                            delay: fresh.beatStageDelay,
                            simon: fresh.intersectsSimon(...rect),
                            whip: fresh.intersectsWhip(...rect),
                            weapon: fresh.intersectsWeapon(...rect)
                        })
                );
                fresh.hurtSimon(16);
                assert(fresh.playerPower === 16 && !fresh.simon.hurt && action(fresh) === frozen, "Restored Orb damage was not a no-op");
                const snapshot = serializer.createSnapshot(fresh, "orb-browser");
                assert(
                    serializer.isSupportedSnapshot(snapshot) && serializer.isSupportedSnapshotForLoadedResources(fresh, snapshot),
                    "Restored stage clear rejected"
                );
                if (stage === 2) {
                    for (let i = 0; i < 600 && fresh.beatStageFlag; i++) advanceFrames(mounted, 1);
                    assert(!fresh.beatStageFlag && fresh.floorBreaking, "Stage-three tally failed to resume");
                    assert(fresh.intersectsSimon(...rect), "Stage-three interactions stayed locked");
                    if (!throwing) assert(fresh.intersectsWhip(...rect), "Stage-three frozen whip lost interaction");
                    assert(action(fresh) === frozen, "Tally mutated frozen pose");
                } else {
                    advanceFrames(mounted, 10);
                    assert(fresh.beatStageFlag && action(fresh) === frozen, "Stage-clear pose did not remain frozen");
                }
                const continued = serializer.createSnapshot(fresh, "orb-browser");
                assert(
                    serializer.isSupportedSnapshot(continued) && serializer.isSupportedSnapshotForLoadedResources(fresh, continued),
                    "Tally continuation became unsaveable"
                );
                retire();
            }
    } finally {
        retire();
        store.clear(() => true);
    }
}
/** Exercise the six-slot transaction through actual browser polling and fresh restore. */
async function verifyNesMapping(): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    const pad = {
        id: "nes-mapping-contract-pad",
        index: 0,
        connected: true,
        mapping: "standard",
        timestamp: 1,
        axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    };
    let invalid = false;
    let mounted: Awaited<ReturnType<typeof mountMain>> | null = null;
    const store = new StickvaniaGameStateStore("nes-mapping");
    const serializer = new StickvaniaGameStateSerializer();
    let writes = 0;
    const state = () => {
        const value = mounted?.main.captureInputConfigModeState();
        assert(value !== null && value !== undefined, "NES fixture lost editor");
        return value;
    };
    const tick = (): void => {
        assert(mounted !== null, "NES fixture unmounted");
        pad.timestamp++;
        mounted.container.getInput().poll(1024, 832);
        advanceFrames(mounted, 1);
    };
    const hardware = (binding: number | null): void => {
        for (const b of pad.buttons) {
            b.pressed = b.touched = false;
            b.value = 0;
        }
        pad.axes[0] = pad.axes[1] = 0;
        if (binding !== null && binding < 0 && pad.mapping !== "standard") {
            pad.axes[binding === -2 || binding === -3 ? 1 : 0] = binding === -2 || binding === -4 ? -1 : 1;
        } else if (binding !== null) {
            const b = pad.buttons[binding < 0 ? 10 - binding : binding]!;
            b.pressed = b.touched = true;
            b.value = 1;
        }
    };
    const press = (binding: number): void => {
        hardware(null);
        tick();
        hardware(binding);
        tick();
    };
    const save = (): void => {
        assert(mounted !== null, "Missing mapping runtime");
        const snapshot = serializer.createSnapshot(mounted.main, "nes-mapping");
        assert(
            serializer.isSupportedSnapshot(snapshot) && serializer.isSupportedSnapshotForLoadedResources(mounted.main, snapshot),
            "NES editor snapshot invalid"
        );
        assert(store.save(mounted.main, () => true).saved, "NES editor save failed");
        const current = state();
        assert(isInputConfigModeSnapshot(current), "Invalid partial mapping state");
        const old = { ...current, assignedControllerButtons: current.assignedControllerBindings } as Record<string, unknown>;
        delete old.assignedControllerBindings;
        assert(!isInputConfigModeSnapshot(old), "Old assigned-property alias accepted");
    };
    const attachWriter = (main: Main): void => {
        main.setInputMappingChangedHandler(() => {
            writes++;
            return main.buttonMapping.save(() => true);
        });
    };
    const review = (): void => {
        assert(mounted !== null, "Missing review runtime");
        assert(
            mounted.main.mode === Main.MODE_TITLE_SCREEN &&
                Reflect.get(mounted.main, "titleMenu") === Main.TITLE_MENU_INPUT &&
                Reflect.get(mounted.main, "titleSelectedIndex") === 2 &&
                mounted.main.fadeState === Main.FADE_DONE,
            "Held completion left Input/Done review"
        );
    };
    try {
        Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => {
                if (invalid) throw new Error("Injected enumeration failure");
                return [pad];
            }
        });
        mounted = await mountMain(null);
        attachWriter(mounted.main);
        for (let i = 0; i < 30 && mounted.main.fadeState !== Main.FADE_DONE; i++) tick();
        pad.mapping = "";
        pad.id = "nonstandard-raw-pad";
        hardware(null);
        mounted.container.getInput().poll(1024, 960);
        for (const raw of [12, 13, 14, 15]) {
            hardware(raw);
            const input = mounted.container.getInput();
            input.poll(1024, 960);
            assert(input.isButtonPressed(raw, 0) && !input.isControllerButtonDirectional(raw, 0), "Nonstandard browser button stays raw");
            assert(
                !input.isControllerUp(0) && !input.isControllerDown(0) && !input.isControllerLeft(0) && !input.isControllerRight(0),
                "Native fallback leaked into browser"
            );
            hardware(null);
            input.poll(1024, 960);
        }
        pad.mapping = "standard";
        pad.id = "nes-mapping-contract-pad";
        mounted.container.getInput().poll(1024, 960);
        mounted.container.getInput().clearControlPressedRecord();
        await verifyCompactLabels(mounted);
        let resets = 0;
        const wanted = [7, 6, 3, 0, -2, -3];
        for (let cycle = 0; cycle < 2; cycle++) {
            pad.mapping = cycle === 0 ? "standard" : "";
            hardware(null);
            tick();
            Reflect.set(mounted.main, "titleMenu", Main.TITLE_MENU_INPUT);
            Reflect.set(mounted.main, "titleSelectedIndex", 1);
            Reflect.get(mounted.main, "selectTitleMenuOption").call(mounted.main);
            resets++;
            assert(writes === cycle + resets, "Reset must persist once under either style");
            verifyGamepadLabelTransitions(mounted);
            hardware(null);
            tick();
            mounted.main.initInputConfig(mounted.container);
            for (let i = 0; i < INPUT_CONFIG_ARM_DELAY; i++) tick();
            for (let i = 0; i < wanted.length; i++) {
                press(wanted[i]!);
                assert(state().stepIndex === i + 1, `NES capture ${cycle}/${i}`);
                save();
            }
            assert(writes === cycle + 1 + resets && state().finished, "Repeated mapping did not commit once");
            const loaded = ButtonMapping.load();
            assert(loaded.controllerJump === -2 && loaded.controllerAttack === -3 && loaded.controllerUp === 7, "Logical mapping did not persist");
            assert(!Object.hasOwn(loaded, "controllerStart"), "Hidden Start mapping appeared");
            for (let i = 0; i < INPUT_CONFIG_DONE_DELAY + 3; i++) tick();
            review();
        }
        hardware(null);
        tick();
        mounted.main.initInputConfig(mounted.container);
        for (let i = 0; i < INPUT_CONFIG_ARM_DELAY; i++) tick();
        press(6);
        assert(state().draft.controllerDown === -1, "Old future owner not displaced");
        const before = JSON.stringify(state().draft);
        press(6);
        assert(state().message === "ALREADY USED" && state().stepIndex === 1 && JSON.stringify(state().draft) === before, "Duplicate changed draft");
        save();
        hardware(null);
        tick();
        const mappingBeforeRestore = JSON.stringify(mounted.main.buttonMapping);
        const writesBeforeRestore = writes;
        pad.mapping = "standard";
        assert(store.restore(mounted.main, mounted.container), "Same-instance editor restore failed");
        assert(
            JSON.stringify(mounted.main.buttonMapping) === mappingBeforeRestore && writes === writesBeforeRestore,
            "Same-instance restore changed mapping authority or persisted"
        );
        verifyGamepadLabelTransitions(mounted);
        pad.mapping = "";
        mounted.container.getInput().poll(1024, 960);
        save();
        const oldMain = mounted.main;
        const authority = oldMain.buttonMapping.clone();
        pad.mapping = "standard";
        destroyMounted(mounted);
        mounted = null;
        mounted = await mountMain((fresh, gc) => {
            fresh.buttonMapping.copyFrom(authority);
            attachWriter(fresh);
            assert(store.restore(fresh, gc), "Mid-editor fresh restore failed");
            assert(fresh !== oldMain, "Reused Main");
            return true;
        });
        assert(state().stepIndex === 1 && state().draft.controllerDown === -1 && writes === 2 + resets, "Restore lost draft or committed preferences");
        assert(sameSnapshot(mounted.main.buttonMapping, authority), "Restore replaced session authority");
        for (const binding of [7, 0, 3, -3, -2]) {
            press(binding);
            save();
        }
        assert(Number(writes) === 3 + resets && state().finished, "Fresh transaction failed to finish once");
        for (let i = 0; i < INPUT_CONFIG_DONE_DELAY + 3; i++) tick();
        review();
        await verifyCompactLabels(mounted);
        press(-3);
        assert(
            Reflect.get(mounted.main, "titleMenu") === Main.TITLE_MENU_MAIN && mounted.main.fadeState === Main.FADE_DONE,
            "Logical A did not activate only Done"
        );
        for (let i = 0; i < 3; i++) tick();
        assert(mounted.main.fadeState === Main.FADE_DONE, "Held Done activation also selected Start");
        press(-3);
        assert(
            mounted.main.fadeState === Main.FADE_OUT && mounted.main.fadeReason === Main.FADE_REASON_SHOW_INTRO,
            "Second fresh logical A did not select Start"
        );
        hardware(null);
        mounted.container.getInput().poll(1024, 832);
        mounted.main.buttonMapping.copyFrom(authority);
        mounted.main.createStageForStateRestore(0);
        mounted.main.mode = Main.MODE_PLAYING;
        mounted.main.fadeState = Main.FADE_DONE;
        mounted.main.playerPower = 16;
        mounted.main.time = 300;
        const controls = mounted.main.controlInput;
        assert(controls !== null && mounted.main.simon !== null, "Missing real gameplay input");
        controls.clearPressedState();
        const sample = (): void => {
            pad.timestamp++;
            mounted!.container.getInput().poll(1024, 832);
            controls.update();
        };
        hardware(-2);
        sample();
        assert(controls.isJump() && !controls.isUp() && controls.isMenuSelectPressed(), "Logical Jump gameplay/menu meaning");
        hardware(null);
        sample();
        hardware(-3);
        sample();
        assert(controls.isAttack() && !controls.isDown() && controls.isMenuSelectPressed(), "Logical Attack gameplay/menu meaning");
        hardware(null);
        sample();
        hardware(7);
        sample();
        assert(controls.isUp() && controls.isMenuUpPressed() && !controls.isMenuSelectPressed(), "Mapped raw movement also confirmed");
        hardware(-2);
        pad.id = "nes-replacement";
        sample();
        assert(!controls.isJump(), "Replacement held Jump leaked");
        invalid = true;
        hardware(null);
        sample();
        invalid = false;
        hardware(-2);
        sample();
        assert(!controls.isJump(), "Invalid enumeration manufactured release");
        hardware(null);
        sample();
        hardware(-2);
        sample();
        assert(controls.isJump(), "First fresh replacement Jump lost");
        controls.clearPressedState();
        sample();
        assert(!controls.isJump() && !controls.isMenuSelectPressed(), "Held resume action leaked");
        hardware(null);
        sample();
        hardware(-2);
        sample();
        assert(controls.isJump(), "First fresh resume Jump lost");
    } finally {
        invalid = false;
        destroyMounted(mounted);
        store.clear(() => true);
        if (descriptor) Object.defineProperty(navigator, "getGamepads", descriptor);
        else Reflect.deleteProperty(navigator, "getGamepads");
    }
}

async function verifyCompactLabels(mounted: Awaited<ReturnType<typeof mountMain>>): Promise<void> {
    const { main, container } = mounted;
    verifyGamepadLabelTransitions(mounted);
    const provider = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    const labelPad = {
        id: "label-presentation",
        index: 0,
        connected: true,
        mapping: "standard",
        axes: [0, 0],
        timestamp: 1,
        buttons: Array.from({ length: 64 }, () => ({ pressed: false, touched: false, value: 0 }))
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [labelPad] });
    const original = main.buttonMapping.clone();
    const input = container.getInput();
    const canvas = gameHost.querySelector("canvas");
    assert(canvas !== null, "Label canvas");
    canvas.focus();
    const owner = main;
    const refreshName = "updateTitleInputMappingCache";
    const linesName = "titleInputMappingLines";
    const xName = "titleInputMappingX";
    const cell = 16,
        left = 64,
        right = 576;
    const oldMenu = Reflect.get(main, "titleMenu");
    Reflect.set(main, "titleMenu", Main.TITLE_MENU_INPUT);
    const refresh = (): void => {
        Reflect.set(main, "titleInputMappingCacheDirty", true);
        const f = Reflect.get(owner, refreshName);
        assert(typeof f === "function", "Production cache refresher");
        f.call(owner);
    };
    try {
        const variants = [
            ["ControlLeft", Input.KEY_LCONTROL],
            ["ControlRight", Input.KEY_RCONTROL],
            ["AltLeft", Input.KEY_LALT],
            ["AltRight", Input.KEY_RALT],
            ["ShiftLeft", Input.KEY_LSHIFT],
            ["ShiftRight", Input.KEY_RSHIFT],
            ["MetaLeft", Input.KEY_LWIN],
            ["MetaRight", Input.KEY_RWIN],
            ["Enter", Input.KEY_ENTER],
            ["NumpadEnter", Input.KEY_NUMPADENTER],
            ["Digit1", Input.KEY_1],
            ["Numpad1", Input.KEY_NUMPAD1],
            ["Equal", Input.KEY_EQUALS],
            ["NumpadAdd", Input.KEY_ADD],
            ["NumpadDivide", Input.KEY_DIVIDE],
            ["BracketLeft", Input.KEY_LBRACKET],
            ["Backslash", Input.KEY_BACKSLASH]
        ] as const;
        for (const [code, key] of variants) {
            canvas.dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));
            input.poll(1024, 960);
            assert(input.isKeyDown(key), `Real DOM code ${code}`);
            main.buttonMapping.keyUp = key;
            refresh();
            const lines: unknown = Reflect.get(owner, linesName);
            assert(Array.isArray(lines) && typeof lines[0] === "string" && lines[0].includes(ButtonMapping.getKeyText(key)), `Actual row for ${code}`);
            canvas.dispatchEvent(new KeyboardEvent("keyup", { code, key: code, bubbles: true }));
            input.poll(1024, 960);
        }
        for (let key = -1; key < 256; key++)
            for (const c of ButtonMapping.getKeyText(key)) {
                assert(main.symbols[c.charCodeAt(0)] !== null && main.symbols[c.charCodeAt(0)] !== undefined, `Loaded bitmap glyph ${c}`);
            }
        for (const standard of [false, true])
            for (const binding of [-6, -5, -4, -3, -2, -1, ...Array.from({ length: 64 }, (_, i) => i)]) {
                for (const c of ButtonMapping.getGamepadButtonText(binding, standard))
                    assert(main.symbols[c.charCodeAt(0)] !== null && main.symbols[c.charCodeAt(0)] !== undefined, `Loaded controller glyph ${c}`);
            }
        for (const standard of [false, true]) {
            labelPad.mapping = standard ? "standard" : "";
            input.poll(1024, 960);
            for (const row of NesInputProfile.INPUTS) {
                main.buttonMapping[row.key] = Input.KEY_SEMICOLON;
                main.buttonMapping[row.controller] = -5;
            }
            refresh();
            const lines: unknown = Reflect.get(owner, linesName);
            const x: unknown = Reflect.get(owner, xName);
            assert(Array.isArray(lines) && lines.length === NesInputProfile.INPUTS.length && typeof x === "number", "Actual mapping cache shape");
            for (const line of lines) {
                assert(
                    typeof line === "string" && line.includes("SEMICOLON") && line.includes("GP-RIGHT") && x >= left && x + line.length * cell <= right,
                    "Painted mapping row bounds"
                );
                for (const c of line) assert(main.symbols[c.charCodeAt(0)] !== null && main.symbols[c.charCodeAt(0)] !== undefined, `Loaded row glyph ${c}`);
            }
        }
        const rawBindings = [0, 2, 9, 15, 17, 63, 12];
        for (let i = 0; i < NesInputProfile.INPUTS.length; i++) main.buttonMapping[NesInputProfile.INPUTS[i]!.controller] = rawBindings[i]!;
        refresh();
        for (const presentation of ["standard", "generic", "transition"] as const) {
            labelPad.mapping = presentation === "generic" ? "" : "standard";
            input.poll(1024, 960);
            const originalWidth = container.getWidth(),
                originalHeight = container.getHeight();
            const bodyStyle = document.body.getAttribute("style");
            document.body.style.margin = "0";
            document.body.style.overflow = "hidden";
            const update = main.update;
            main.update = () => {};
            try {
                container.setLoopSuspended(false);
                await new Promise<void>((resolve) => {
                    Reflect.set(window, "compactLabelCapture", {
                        game: "stickvania-" + presentation,
                        resolve,
                        resize: async (width: number, height: number): Promise<void> => {
                            await container.setDisplayMode(width, height, false);
                        }
                    });
                });
            } finally {
                container.setLoopSuspended(true);
                main.update = update;
                await container.setDisplayMode(originalWidth, originalHeight, false);
                if (bodyStyle === null) document.body.removeAttribute("style");
                else document.body.setAttribute("style", bodyStyle);
            }
        }
    } finally {
        if (provider) Object.defineProperty(navigator, "getGamepads", provider);
        else Reflect.deleteProperty(navigator, "getGamepads");
        input.poll(1024, 960);
        main.buttonMapping.copyFrom(original);
        Reflect.set(main, "titleMenu", oldMenu);
        refresh();
        input.clearKeyPressedRecord();
        input.clearControlPressedRecord();
    }
}

/** Real polled metadata must refresh the actual renderer without a cache-dirty shortcut. */
function verifyGamepadLabelTransitions(mounted: Awaited<ReturnType<typeof mountMain>>): void {
    const { main, container } = mounted;
    const input = container.getInput();
    const owner = main;
    const provider = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    const disabled = Reflect.get(Input, "controllersDisabled");
    const nativeSet = Storage.prototype.setItem;
    const notification = Object.getOwnPropertyDescriptor(main, "notifyInputMappingChanged");
    let writes = 0,
        notifications = 0,
        fail = false;
    const pad = {
        id: "unbranded-label-fixture",
        index: 3,
        connected: true,
        mapping: "standard",
        timestamp: 1,
        axes: [0, 0],
        buttons: Array.from({ length: 64 }, () => ({ pressed: false, touched: false, value: 0 }))
    };
    const second = { ...pad, index: 5, buttons: pad.buttons.map((b) => ({ ...b })) };
    let pads: (typeof pad | null)[] = [];
    const state = () => JSON.stringify({ mapping: main.buttonMapping, workflow: main.captureInputConfigModeState() });
    const before = state();
    const preferences = JSON.stringify(Object.entries(localStorage).sort());
    const draw = (standard: boolean): void => {
        const render = Reflect.get(owner, "renderTitleInputMenu");
        assert(typeof render === "function", "Real Input renderer");
        render.call(owner, container, container.getGraphics());
        const rows: unknown = Reflect.get(owner, "titleInputMappingLines");
        assert(Array.isArray(rows), "Rendered row cache");
        for (let i = 0; i < NesInputProfile.INPUTS.length; i++) {
            const binding = main.buttonMapping[NesInputProfile.INPUTS[i]!.controller];
            assert(rows[i].endsWith(", " + ButtonMapping.getGamepadButtonText(binding, standard)), "Automatic label refresh " + rows[i]);
        }
        assert(state() === before, "Label rendering changed mapping/editor transaction");
        assert(writes === 0 && notifications === 0 && JSON.stringify(Object.entries(localStorage).sort()) === preferences, "Label rendering persisted state");
    };
    const sample = (standard: boolean): void => {
        pad.timestamp++;
        input.poll(1024, 960);
        draw(standard);
    };
    try {
        Reflect.set(Input, "controllersDisabled", false);
        Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => {
                if (fail) throw new Error("label enumeration");
                return pads;
            }
        });
        Storage.prototype.setItem = function (key, value) {
            writes++;
            return nativeSet.call(this, key, value);
        };
        Object.defineProperty(main, "notifyInputMappingChanged", {
            configurable: true,
            value: () => {
                notifications++;
                return { saved: false, reason: "unavailable" };
            }
        });
        sample(false);
        pads = [null, null, null, pad];
        sample(true);
        assert(input.getControllerCount() === 1 && input.getControllerMapping(0) === "standard", "Sparse browser indexes must become dense Slick slots");
        pads = [null, pad, null, second];
        sample(true);
        second.mapping = "";
        sample(false);
        pads = [second, null, pad];
        sample(false);
        pad.mapping = "";
        sample(false);
        pads = [pad];
        pad.mapping = "standard";
        sample(true);
        pad.mapping = "";
        sample(false);
        pad.mapping = "standard";
        sample(true);
        const topology = input.getControllerSampleStatus().topologyGeneration;
        fail = true;
        sample(false);
        assert(input.getControllerSampleStatus().topologyGeneration === topology, "Invalid sample changed topology fixture");
        fail = false;
        sample(true);
        Input.disableControllers();
        sample(false);
        Reflect.set(Input, "controllersDisabled", false);
        sample(true);
        input.poll(1024, 960);
        for (const raw of [0, 12, 13, 14, 15, 17, 63]) {
            pad.buttons[raw]!.pressed = true;
            pad.buttons[raw]!.value = 1;
            input.poll(1024, 960);
            assert(input.isButtonPressed(raw, 0), "Fresh physical button before label draw");
            const control = raw >= 12 && raw <= 15 ? [2, 3, 0, 1][raw - 12]! : 4 + raw;
            draw(true);
            assert(input.isButtonPressed(raw, 0) && input.isControlPressed(control, 0), `Label draw changed physical level or drained edge ${raw}`);
            assert(!input.isControlPressed(control, 0), "Press must remain consumptive");
            pad.buttons[raw]!.pressed = false;
            pad.buttons[raw]!.value = 0;
            input.poll(1024, 960);
        }
        pads = [];
        sample(false);
    } finally {
        for (const b of pad.buttons) {
            b.pressed = false;
            b.value = 0;
        }
        fail = false;
        pads = [];
        input.poll(1024, 960);
        if (provider) Object.defineProperty(navigator, "getGamepads", provider);
        else Reflect.deleteProperty(navigator, "getGamepads");
        Reflect.set(Input, "controllersDisabled", disabled);
        Storage.prototype.setItem = nativeSet;
        if (notification) Object.defineProperty(main, "notifyInputMappingChanged", notification);
        else Reflect.deleteProperty(main, "notifyInputMappingChanged");
        input.poll(1024, 960);
    }
}
