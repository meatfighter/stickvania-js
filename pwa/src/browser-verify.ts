import { AppGameContainer, Display, ResourceLoader, SoundStore } from "slick2d-ts";
import { getStickvaniaResourceVersion } from "./ResourceVersions.generated.js";
import { STICKVANIA_RESOURCE_REFS } from "./resources.js";
import { Main } from "./stickvania/Main.js";
import { StickvaniaBufferedGame } from "./stickvania/StickvaniaBufferedGame.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
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
        assert(store.save(first.main), "Real browser Main did not save successfully.");
        assert(store.hasValidSave(), "Saved real browser Main did not validate.");
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

        second = await mountMain((main, container) => store.restore(main, container));
        assert(second.main.isStateSaveReady(), "Restored browser Main is not save-state ready.");
        assert(second.main.score === 123450, "Fresh Stickvania Main did not restore score state.");
        assert(second.main.players === 3, "Fresh Stickvania Main did not restore player-count state.");
        assert(second.main.mode === Main.MODE_PLAYING && second.main.simon !== null, "Fresh Main must restore active gameplay.");
        advanceFrames(second, 12);
        assert(gameplaySnapshot(serializer, second.main) === expected, "Restored stage diverged from uninterrupted gameplay after 12 simulation frames.");
    } finally {
        destroyMounted(first);
        destroyMounted(second);
        store.clear();
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
