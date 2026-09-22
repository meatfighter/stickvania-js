import { Sys, ResourceLoader, type AppGameContainer } from "slick2d-ts";
import { beginGameAudio, commitGameAudio, releaseGameAudio } from "./app/PlaybackSession.js";
import { StickvaniaRuntimeLoader } from "./app/RuntimeLoader.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import { getBrowserStorageKey } from "./stickvania/BrowserStorageKeys.js";
import { ButtonMapping } from "./stickvania/ButtonMapping.js";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    throw new Error("Persistence matrix is a local development fixture only.");
}
const gameHost = document.querySelector<HTMLElement>("#game-host")!;
const status = document.querySelector<HTMLElement>("#status")!;
const failure = document.querySelector<HTMLElement>("#failure")!;
const startButton = document.querySelector<HTMLButtonElement>("#start")!;
const verifyButton = document.querySelector<HTMLButtonElement>("#verify")!;
const resumeButton = document.querySelector<HTMLButtonElement>("#resume")!;
const casePicker = document.querySelector<HTMLSelectElement>("#case")!;
const notes = document.querySelector<HTMLInputElement>("#notes")!;
const cases: readonly string[] = [
    "Title/non-stage",
    "Input unfinished",
    "Input finished SAVED",
    "Input finished NOT SAVED",
    "Stage 1 topology",
    "Stage 2 topology",
    "Stage 3 topology",
    "Stage 4 topology",
    "Stage 5 topology",
    "Stage 6 topology",
    "Stopwatch active",
    "Shield/boomerang",
    "Hurt",
    "Dead/terminal",
    "Stage clear",
    "Final boss transition",
    "Music paused/end-pending"
];
for (const name of cases) casePicker.add(new Option(name, name));
const records: Array<Record<string, unknown>> = [];
let mounted: Mounted | null = null;
let busy = false;
let lockHeld = false;
let sessionMapping = new ButtonMapping();
let clock = 1_000_000;
const originalNow = Date.now;
const originalTime = Sys.getTime;
let wallOrigin = originalNow() - originalTime();
const label = "stickvania-js";

// Resource roots are the actual game's normal dev root, not this fixture's
// isolated /__persistence_matrix__/ storage scope.
ResourceLoader.removeAllResourceLocations();
ResourceLoader.addResourceLocation(new URL("../", location.href));
const loader = new StickvaniaRuntimeLoader(() => {});
let runtime: Awaited<ReturnType<StickvaniaRuntimeLoader["ensurePrepared"]>>;
type Main = InstanceType<Awaited<ReturnType<StickvaniaRuntimeLoader["ensurePrepared"]>>["Main"]>;
type Mounted = { main: Main; container: AppGameContainer };
const serializer = new StickvaniaGameStateSerializer();
type Snapshot = ReturnType<StickvaniaGameStateSerializer["createSnapshot"]>;
let store: InstanceType<Awaited<ReturnType<StickvaniaRuntimeLoader["ensurePrepared"]>>["StickvaniaGameStateStore"]>;
const mappingStorageKey = getBrowserStorageKey("input-mapping");

function selectedFinishedMappingResult(): "SAVED" | "NOT SAVED" | null {
    if (casePicker.value === "Input finished SAVED") return "SAVED";
    if (casePicker.value === "Input finished NOT SAVED") return "NOT SAVED";
    return null;
}

function persistSessionMapping(main: Main) {
    const authorized = () => lockHeld && mounted?.main === main;
    if (selectedFinishedMappingResult() !== "NOT SAVED") return sessionMapping.save(authorized);

    const storage = localStorage;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
        if (this === storage && key === mappingStorageKey) {
            throw new DOMException("Injected mapping write failure", "QuotaExceededError");
        }
        setItem.call(this, key, value);
    };
    try {
        return sessionMapping.save(authorized);
    } finally {
        Storage.prototype.setItem = setItem;
    }
}

function scheduleFinishedMappingPause(main: Main, result: "SAVED" | "NOT SAVED"): void {
    const expected = selectedFinishedMappingResult();
    if (expected !== result) return;
    queueMicrotask(() => {
        if (busy || !lockHeld || mounted?.main !== main) return;
        const inputState = main.captureInputConfigModeState();
        if (inputState === null || !inputState.finished || inputState.message !== result) return;
        freeze();
        resumeButton.disabled = false;
        status.textContent = `Auto-paused on real ${result} input-configuration completion. Add evidence notes, then verify.`;
    });
}

async function prepare(): Promise<void> {
    runtime = await loader.ensurePrepared();
    store = new runtime.StickvaniaGameStateStore(label);
}
async function mount(restore: boolean): Promise<Mounted> {
    gameHost.replaceChildren();
    runtime.slick.Display.setParent(gameHost);
    const main = new runtime.Main();
    main.buttonMapping.copyFrom(sessionMapping);
    const game = new runtime.StickvaniaBufferedGame(main, "crisp");
    const container = new runtime.slick.AppGameContainer(game, 800, 650, false);
    container.setPreserveAudioCacheOnDestroy(true);
    container.setLoopSuspended(true);
    if (restore)
        main.loadingCompleteHandler = (gc) => {
            assert(store.restore(main, gc), "Fresh Stickvania restore rejected.");
            return true;
        };
    mounted = { main, container };
    main.setInputMappingChangedHandler(() => {
        if (!lockHeld || mounted?.main !== main) return { saved: false, reason: "stale-session" };
        sessionMapping.copyFrom(main.buttonMapping);
        const result = persistSessionMapping(main);
        scheduleFinishedMappingPause(main, result.saved ? "SAVED" : "NOT SAVED");
        return result;
    });
    await container.start();
    await runtime.slick.ResourceLoader.waitForAll();
    assert(main.isStateSaveReady(), "Stickvania init did not become save-ready.");
    return { main, container };
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
function normalized(snapshot: Snapshot): string {
    const copy = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    delete copy.savedAt;
    // nextFrameTime is a reconstructed wall-clock schedule, not game progress.
    const fields = copy.mainFields;
    if (fields && typeof fields === "object" && !Array.isArray(fields)) delete (fields as Record<string, unknown>).nextFrameTime;
    return JSON.stringify(copy);
}
function freeze(): void {
    if (!mounted) return;
    mounted.container.setLoopSuspended(true);
    mounted.main.setBrowserSuspended(true);
    mounted.container.getInput().pause();
    releaseGameAudio();
}
function retire(): void {
    const previous = mounted;
    mounted = null;
    if (!previous) return;
    previous.main.setInputMappingChangedHandler(null);
    previous.main.stopAllSounds();

    previous.container.destroy();
    runtime.slick.Display.setParent(null);
}
function controlledTrace(value: Mounted, count: number): string[] {
    const trace: string[] = [];
    Date.now = () => wallOrigin + clock;
    Sys.getTime = () => clock;
    try {
        value.main.setBrowserSuspended(false);
        value.main.resetNextFrameTime();
        for (let frame = 0; frame < count; frame++) {
            clock += 10;
            const frameOperation = Reflect.get(value.main, "updateFrame") as ((gc: AppGameContainer) => void) | undefined;
            assert(typeof frameOperation === "function", "Missing production updateFrame operation.");
            frameOperation.call(value.main, value.container);
            trace.push(normalized(serializer.createSnapshot(value.main, label)));
        }
        value.main.setBrowserSuspended(true);
        return trace;
    } finally {
        Date.now = originalNow;
        Sys.getTime = originalTime;
    }
}
async function execute(action: () => Promise<void>): Promise<void> {
    if (busy || !lockHeld) return;
    busy = true;
    failure.textContent = "";
    startButton.disabled = verifyButton.disabled = resumeButton.disabled = true;
    try {
        await action();
    } catch (error) {
        console.error(error);
        failure.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
        status.textContent = "FAILED — not a passing evidence row.";
        try {
            freeze();
            retire();
        } catch (cleanupError) {
            console.error(cleanupError);
        }
    } finally {
        busy = false;
        startButton.disabled = false;
        verifyButton.disabled = mounted === null;
        resumeButton.disabled = mounted === null || mounted.container.isLoopSuspended() === false;
    }
}
startButton.addEventListener(
    "click",
    () =>
        void execute(async () => {
            freeze();
            retire();
            const audio = beginGameAudio();
            await prepare();
            mounted = await mount(false);
            assert(await audio.ready, "Playback preparation rejected.");
            assert(await commitGameAudio(audio), "Playback attachment rejected.");
            mounted.container.getInput().resume();
            mounted.main.setBrowserSuspended(false);
            mounted.container.setLoopSuspended(false);
            mounted.container.getInput().clearKeyPressedRecord();
            gameHost.querySelector<HTMLCanvasElement>("canvas")?.focus();
            status.textContent = "Drive the real game to a listed phase, then Pause and verify. No phase is fabricated by this fixture.";
        })
);
verifyButton.addEventListener(
    "click",
    () =>
        void execute(async () => {
            assert(mounted, "No runtime.");
            const name = casePicker.value;
            assert(notes.value.trim().length > 0, "Record the actual stage/phase/transition evidence before verifying.");
            if (name === "Input finished SAVED" || name === "Input finished NOT SAVED") {
                const expectedResult = name === "Input finished SAVED" ? "SAVED" : "NOT SAVED";
                const inputState = mounted.main.captureInputConfigModeState();
                assert(inputState !== null && inputState.finished, `${name} requires a real finished input-configuration state.`);
                assert(inputState.message === expectedResult, `${name} requires the real ${expectedResult} completion result.`);
            }
            freeze();
            assert(mounted.main.isStateSaveReady(), "This phase is not save-ready.");
            const mappingBefore = localStorage.getItem(getBrowserStorageKey("input-mapping"));
            clock = originalTime();
            wallOrigin = originalNow() - clock;
            const baselineClock = clock;
            Date.now = () => wallOrigin + clock;
            Sys.getTime = () => clock;
            let source: Snapshot;
            try {
                assert(store.save(mounted.main, () => lockHeld).saved, "Production store rejected the real runtime.");
                const text = localStorage.getItem(GAME_STATE_STORAGE_KEY);
                assert(text !== null, "Production save is absent.");
                source = JSON.parse(text) as Snapshot;
            } finally {
                Date.now = originalNow;
                Sys.getTime = originalTime;
            }
            const expected = controlledTrace(mounted, 12);
            retire();
            clock = baselineClock;
            // Logical-only fresh restoration occurs while physical playback is deferred.
            Date.now = () => wallOrigin + clock;
            Sys.getTime = () => clock;
            try {
                mounted = await mount(true);
            } finally {
                Date.now = originalNow;
                Sys.getTime = originalTime;
            }
            Date.now = () => wallOrigin + clock;
            Sys.getTime = () => clock;
            let restored: Snapshot;
            try {
                restored = serializer.createSnapshot(mounted.main, label);
            } finally {
                Date.now = originalNow;
                Sys.getTime = originalTime;
            }
            assert(normalized(restored) === normalized(source), "Immediate durable recapture differs; do not discard additional fields to hide the mismatch.");
            assert(localStorage.getItem(getBrowserStorageKey("input-mapping")) === mappingBefore, "Restoring game state changed the mapping storage slot.");
            const actual = controlledTrace(mounted, 12);
            assert(JSON.stringify(actual) === JSON.stringify(expected), "Fresh runtime continuation differs from the original neutral-input trace.");
            const entry = {
                case: name,
                evidence: notes.value.trim(),
                sourceMode: source.mode,
                passed: true,
                continuationFrames: 12,
                snapshot: source,
                capturedAt: new Date().toISOString(),
                userAgent: navigator.userAgent
            };
            records.push(entry);
            status.textContent = `Passed comparison for ${name}. This does not itself certify that the selected descriptive phase was reached; retain the recorded snapshot and transition notes.`;
            notes.value = "";
        })
);
resumeButton.addEventListener(
    "click",
    () =>
        void execute(async () => {
            assert(mounted, "No runtime.");
            const audio = beginGameAudio();
            assert(await audio.ready, "Playback preparation rejected.");
            assert(await commitGameAudio(audio), "Playback attachment rejected.");
            mounted.container.getInput().resume();
            mounted.main.setBrowserSuspended(false);
            mounted.container.setLoopSuspended(false);
            gameHost.querySelector<HTMLCanvasElement>("canvas")?.focus();
            status.textContent = "Running. Reach the next case through normal controls.";
        })
);
document.querySelector<HTMLButtonElement>("#export")!.addEventListener("click", () => {
    const reached = new Set(records.map((record) => record.case));
    const missing = cases.filter((name) => !reached.has(name));
    const report = {
        game: label,
        sourceRevision: "Record git rev-parse HEAD alongside this evidence",
        missing,
        completeCaseCoverage: missing.length === 0,
        phaseClassificationRequiresReview: true,
        records
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label}-transition-evidence.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
if (!navigator.locks?.request) throw new Error("This fixture requires the same single-writer browser capability as the games.");
void navigator.locks.request(`persistence-matrix:${location.pathname}`, { ifAvailable: true }, async (lock) => {
    if (!lock) {
        status.textContent = "The matrix is already open in another tab.";
        startButton.disabled = true;
        return;
    }
    lockHeld = true;
    sessionMapping = ButtonMapping.load();
    await new Promise<void>((resolve) =>
        window.addEventListener(
            "pagehide",
            () => {
                lockHeld = false;
                freeze();
                retire();
                resolve();
            },
            { once: true }
        )
    );
});
