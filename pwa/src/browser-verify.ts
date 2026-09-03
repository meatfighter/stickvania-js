import { AppGameContainer, Display, ResourceLoader, SoundStore } from "slick2d-ts";
import { getStickvaniaResourceVersion } from "./ResourceVersions.generated.js";
import { STICKVANIA_RESOURCE_REFS } from "./resources.js";
import { Main } from "./stickvania/Main.js";
import { StickvaniaBufferedGame } from "./stickvania/StickvaniaBufferedGame.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";

const result = document.querySelector<HTMLElement>("#result");
const host = document.querySelector<HTMLElement>("#game-host");
if (result === null || host === null) throw new Error("Browser verification fixture is missing required elements.");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function waitForTitle(main: Main): Promise<void> {
    const deadline = performance.now() + 10_000;
    while (main.mode !== Main.MODE_TITLE_SCREEN && performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    assert(main.mode === Main.MODE_TITLE_SCREEN, `Real Stickvania Main did not reach the title screen; mode=${main.mode}.`);
    for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function verify(): Promise<void> {
    localStorage.clear();
    ResourceLoader.clearCache();
    ResourceLoader.removeAllResourceLocations();
    ResourceLoader.addResourceLocation(new URL("./", window.location.href));
    ResourceLoader.setCacheVersionResolver((ref) => getStickvaniaResourceVersion(ref));
    ResourceLoader.setRetryOptions(1, 0);
    const audioRefs = STICKVANIA_RESOURCE_REFS.filter((ref) => ref.endsWith(".ogg"));
    const nonAudioRefs = STICKVANIA_RESOURCE_REFS.filter((ref) => !ref.endsWith(".ogg"));
    await Promise.all([ResourceLoader.preloadResources(nonAudioRefs, { concurrency: 6 }), SoundStore.get().preloadAudioBuffers(audioRefs, { concurrency: 4 })]);

    Display.setParent(host);
    const main = new Main();
    const buffered = new StickvaniaBufferedGame(main, "crisp");
    const container = new AppGameContainer(buffered, 1024, 832, false);
    container.setPreserveAudioCacheOnDestroy(true);
    container.setHighDpiEnabled(true);
    container.setMaxDevicePixelRatio(2);
    try {
        await container.start();
        await waitForTitle(main);
        assert(buffered.getPresentationInfo().physicalWidth > 0, "Buffered presentation did not acquire a physical width.");
        const store = new StickvaniaGameStateStore("browser-verification");
        assert(main.isStateSaveReady(), "Title-screen Main should be ready for a stageless save.");
        assert(store.save(main), "Real browser Main did not save successfully.");
        assert(store.hasValidSave(), "Saved real browser Main did not validate.");
        store.clear();
        buffered.setScalingPreference("smooth");
        buffered.setScalingPreference("pixel-perfect");
        buffered.setScalingPreference("crisp");
    } finally {
        container.destroy();
        Display.setParent(null);
        localStorage.clear();
    }
}

void verify().then(
    () => {
        result.dataset.status = "passed";
        result.textContent = "Real Stickvania browser verification passed.";
    },
    (error: unknown) => {
        console.error(error);
        result.dataset.status = "failed";
        result.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
    }
);
