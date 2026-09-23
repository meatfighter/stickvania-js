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
            const restored = restore(main, container);
            container.setLoopSuspended(true);
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
                assert(completed.assignedControllerButtons.length === (scenario.controllerFinal ? 1 : 0), `${label}: wrong controller assignment count.`);
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
                assert(main.mode === Main.MODE_TITLE_SCREEN, `${label}: did not return to the title screen.`);
                assert(main.captureInputConfigModeState() === null, `${label}: completed editor/listener was not retired.`);
                assert(!controls.isMenuSelectPressed(), `${label}: title transition exposed a held completion edge.`);
                if (!scenario.controllerFinal) send("keydown", finalKey, true);
                for (let i = 0; i < 3; i++) tick();
                assert(main.fadeState === Main.FADE_DONE, `${label}: held completion input accidentally selected START.`);
                assert(Reflect.get(main, "titleMenu") === Main.TITLE_MENU_MAIN, `${label}: held input changed the title menu.`);
                assert(Reflect.get(main, "titleSelectedIndex") === 0, `${label}: held input moved the title cursor.`);
                assert(writes === 1, `${label}: countdown/title return replayed the mapping write.`);

                // A real release followed by a new press must still work; do not fix by blocking forever.
                heldButton = -1;
                send("keyup", finalKey);
                tick();
                assert(!controls.isMenuSelectPressed(), `${label}: release manufactured a selection.`);
                if (scenario.controllerFinal) heldButton = 2;
                else send("keydown", finalKey);
                tick();
                assert(
                    main.fadeState === Main.FADE_OUT && main.fadeReason === Main.FADE_REASON_SHOW_INTRO,
                    `${label}: fresh post-release input did not select START.`
                );
                heldButton = -1;
                send("keyup", finalKey);
                poll(); // Drain release; do not advance into another scene.
                assert(writes === 1, `${label}: fresh title input replayed the mapping write.`);
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
    console.log("Mapping completion passed through real input polling, current validation/storage, completion countdown, and held/fresh title input.");
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
    const count = () => main.captureInputConfigModeState()!.assignedControllerButtons.length;
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
