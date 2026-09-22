import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const mainSource = readFileSync(new URL("../pwa/src/main.ts", import.meta.url), "utf8");
const rumbleSource = readFileSync(new URL("../pwa/src/rumble/RumbleManager.ts", import.meta.url), "utf8");

function deferred() {
    let resolve;
    const promise = new Promise((yes) => {
        resolve = yes;
    });
    return { promise, resolve };
}

function fixture({ enabled = true, restore = true, rejectHaptics = false, saveSucceeds = true, exclusiveHaptics = false } = {}) {
    const noop = () => {};
    const events = { pulses: 0, restores: 0, saves: 0, continuous: 0, loopResumes: 0, silencePredicates: [], playPredicates: [] };
    const runtimeControls = { display: () => Promise.resolve(), focus: noop };
    const hapticControls = { deferSilence: false, pendingSilenceResolves: [] };
    const node = () => ({ addEventListener: noop, removeEventListener: noop, remove: noop });
    const shell = node();
    const host = node();
    const hamburger = node();
    const root = {
        innerHTML: "",
        querySelector: (selector) => (selector === "#game-shell" ? shell : selector === "#game-host" ? host : hamburger)
    };
    const document = {
        readyState: "loading",
        visibilityState: "visible",
        hasFocus: () => true,
        addEventListener: noop,
        removeEventListener: noop,
        getElementById: () => hamburger
    };
    const common = { console, Promise, setTimeout, clearTimeout, performance, window: { setTimeout, location: { reload: noop } }, document };
    const rumbleContext = {
        ...common,
        exports: {},
        require: (id) => {
            if (id === "./BrowserHaptics.js") {
                return {
                    getConnectedGamepads: () => [{}],
                    silenceGamepads: (_gamepads, isCurrent = () => true) => {
                        events.silencePredicates.push(isCurrent);
                        if (rejectHaptics) {
                            return Promise.reject(new Error("haptic silence failed"));
                        }
                        if (hapticControls.deferSilence) {
                            return new Promise((resolve) => hapticControls.pendingSilenceResolves.push(resolve));
                        }
                        return Promise.resolve();
                    },
                    playPulseOnGamepad: (_gamepad, _pulse, isCurrent = () => true) => {
                        events.playPredicates.push(isCurrent);
                        if (isCurrent()) {
                            events.pulses++;
                        }
                        return rejectHaptics ? Promise.reject(new Error("haptic pulse failed")) : Promise.resolve();
                    }
                };
            }
            if (id === "./RumbleEffects.js") {
                return {
                    getRumbleEffect: (id) => ({
                        channel: id === "other" ? "other" : "test",
                        pattern: [{ duration: 1 }],
                        exclusive: exclusiveHaptics
                    }),
                    isRumbleDelayStep: () => false
                };
            }
            throw new Error(`Unexpected rumble import: ${id}`);
        }
    };
    vm.runInNewContext(compile(rumbleSource), rumbleContext);

    class Preferences {
        volume = 0.5;
        displayMode = "dark";
        scaling = "smooth";
        rumbleEnabled = enabled;
        static clampVolume(value) {
            return value;
        }
        setRumbleEnabled(value) {
            this.rumbleEnabled = value;
            return true;
        }
        reset() {
            return true;
        }
    }

    class Sessions {
        serial = 0;
        begin() {
            return ++this.serial;
        }
        invalidate() {
            this.serial++;
        }
        isCurrent(serial) {
            return serial === this.serial;
        }
    }

    class Cleanup {
        unsafe = null;
        get safe() {
            return this.unsafe === null;
        }
        get failure() {
            return this.unsafe;
        }
        run(...steps) {
            for (const step of steps) {
                try {
                    step();
                } catch (error) {
                    this.unsafe ??= error instanceof Error ? error : new Error(String(error));
                }
            }
            return this.safe;
        }
        trySave(save) {
            try {
                return save();
            } catch {
                return false;
            }
        }
        assertSafe() {
            if (this.unsafe !== null) {
                throw this.unsafe;
            }
        }
    }

    class Viewport {
        gameShell = null;
        gameHost = null;

        getFullscreenCapability() {
            return "unavailable";
        }

        createShell() {
            this.gameShell = shell;
            this.gameHost = host;
            return host;
        }

        attach() {}

        getResponsiveDisplayMode() {
            return { width: 640, height: 480 };
        }

        startResponsiveSizing(host) {
            this.gameHost = host;
        }

        stopResponsiveSizing() {}

        reconcileDisplayModeNow() {}

        scheduleResize() {}

        focusMenuPanel() {}
        focusCanvas() {
            runtimeControls.focus();
        }

        requestFullscreen() {
            return Promise.resolve(false);
        }

        exitFullscreenForMenu() {
            return Promise.resolve(true);
        }

        startHamburgerVisibilityMonitor() {}

        stopHamburgerVisibilityMonitor() {}

        hideHamburger() {}

        startCursorAutoHide() {}

        stopCursorAutoHide() {}

        clear() {
            this.gameShell = null;
            this.gameHost = null;
        }
    }

    class Mapping {
        static load() {
            return new Mapping();
        }
        copyFrom() {}
        resetToDefaults() {}
        save(authorized) {
            return authorized() ? { saved: true } : { saved: false, reason: "stale-session" };
        }
    }

    class PersistenceSession {
        epoch = -1;
        accepted = null;
        rejected = false;
        beginOwnership(epoch) {
            if (epoch === this.epoch) return false;
            this.epoch = epoch;
            this.accepted = null;
            this.rejected = false;
            return true;
        }
        accept(game) {
            this.accepted = game;
        }
        retire(game) {
            if (this.accepted === game) this.accepted = null;
        }
        canSave(game) {
            return this.accepted === game;
        }
        rejectStored() {
            this.rejected = true;
        }
        abandonStored() {
            this.rejected = true;
        }
        didSave() {
            this.rejected = false;
        }
        canReadStored() {
            return !this.rejected;
        }
    }

    class RestoreAttempt {
        rejected = false;
        reject() {
            this.rejected = true;
            throw new Error("Stored game restoration was rejected.");
        }
    }

    class Main {
        buttonMapping = new Mapping();
        clearInputPressedRecords() {}
        setBrowserSuspended() {}
        setInputMappingChangedHandler() {}
        setDifficultyChangedHandler() {}
        stopAllSounds() {}
        isStateSaveReady() {
            return true;
        }
        resumeBrowserOnlyRumbles() {
            events.continuous++;
        }
    }

    class Buffered {
        constructor(game) {
            this.game = game;
        }
    }

    const input = { pause: noop, resume: noop };
    class Container {
        lifetime = new globalThis.AbortController();
        getBrowserLifetimeSignal() {
            return this.lifetime.signal;
        }
        destroyed = false;
        loopSuspended = false;
        constructor(buffered) {
            this.game = buffered.game;
        }
        setPreserveAudioCacheOnDestroy() {}
        setHighDpiEnabled() {}
        setMaxDevicePixelRatio() {}
        setAlwaysRender() {}
        setVSync() {}
        setSmoothDeltas() {}
        setShowFPS() {}
        setClearEachFrame() {}
        setGraphicsLifecycleHandler() {}
        setDisplayMode() {
            return runtimeControls.display();
        }
        async start() {
            this.game.loadingCompleteHandler?.(this);
        }
        setErrorHandler() {}
        setLoopSuspended(suspended) {
            this.loopSuspended = suspended;
            if (!suspended) {
                events.loopResumes++;
            }
        }
        isLoopSuspended() {
            return this.loopSuspended;
        }
        getInput() {
            return input;
        }
        isFullscreen() {
            return false;
        }
        isGraphicsContextLost() {
            return false;
        }
        isDestroyed() {
            return this.destroyed;
        }
        setSoundVolume() {}
        setMusicVolume() {}
        stopSoundEffects() {}
        destroy() {
            this.lifetime.abort();
            this.destroyed = true;
        }
    }

    class Store {
        hasValidSave() {
            return true;
        }
        restore() {
            events.restores++;
            return restore;
        }
        save() {
            events.saves++;
            return saveSucceeds ? { saved: true } : { saved: false, reason: "write-failed" };
        }
        clear() {
            return true;
        }
    }

    const runtime = {
        Main,
        StickvaniaBufferedGame: Buffered,
        StickvaniaGameStateStore: Store,
        slick: { Display: { setParent: noop }, AppGameContainer: Container }
    };

    let latestAudio = null;
    let audioSerial = 0;
    const playback = {
        beginGameAudio() {
            const attempt = { id: ++audioSerial, ready: Promise.resolve(true) };
            latestAudio = attempt;
            return attempt;
        },
        commitGameAudio(attempt) {
            return Promise.resolve(latestAudio === attempt);
        },
        isGameAudioCurrent(attempt) {
            return latestAudio === attempt;
        },
        isGameAudioLatest(attempt) {
            return latestAudio === attempt;
        },
        releaseGameAudio(attempt) {
            if (attempt === undefined || latestAudio === attempt) {
                latestAudio = null;
            }
        },
        setGameAudioInterruptionHandler() {}
    };

    const imports = {
        "./app/FocusOwnership.js": { focusOwnedPanel: noop },
        "./app/PreparationDeadline.js": { initializeWithDeadline: (promise) => promise, ReloadRequiredError: class extends Error {} },
        "./app/BrowserPersistence.js": { removePreference: () => true },
        "./stickvania/ButtonMapping.js": { ButtonMapping: Mapping },
        "./app/PersistenceSession.js": { PersistenceSession, RestoreAttempt },
        "./app/SessionCleanup.js": { SessionCleanup: Cleanup },
        "./app/PlaybackSession.js": playback,
        "./app/GameSessionOwnership.js": { GameSessionOwnership: class {} },
        "slick2d-ts": {
            SoundStore: {
                get: () => ({
                    setMusicOn: noop,
                    setSoundsOn: noop,
                    setSoundVolume: noop,
                    setMusicVolume: noop,
                    stopAllPlayback: noop
                })
            }
        },
        "./app/BrowserPreferences.js": { BrowserPreferences: Preferences },
        "./app/GameViewportController.js": { GameViewportController: Viewport },
        "./app/MenuView.js": { renderMenu: () => node() },
        "./app/RuntimeLoader.js": {
            StickvaniaRuntimeLoader: class {
                getPreparedRuntime() {
                    return runtime;
                }
            }
        },
        "./app/ScreenWakeLockManager.js": {
            ScreenWakeLockManager: class {
                setDesired() {}
            }
        },
        "./app/ServiceWorkerRegistrar.js": { registerStickvaniaServiceWorker: () => Promise.resolve() },
        "./app/SessionGeneration.js": { SessionGeneration: Sessions },
        "./DisplayThemes.js": { createDisplayMonochromePalette: () => null },
        "./rumble/RumbleManager.js": rumbleContext.exports,
        "./stickvania/persistence/GameStatePreflight.js": { hasPotentialBrowserStoredStickvaniaGameState: () => true },
        "./stickvania/persistence/GameStateSchema.js": { GAME_STATE_STORAGE_KEY: "test-state" },
        "./styles.css": {}
    };
    const context = {
        ...common,
        exports: {},
        __APP_VERSION__: "test",
        __CACHE_VERSION__: "test",
        cancelAnimationFrame: noop,
        localStorage: { removeItem: noop },
        require(id) {
            assert.ok(Object.hasOwn(imports, id), `Unexpected application import: ${id}`);
            return imports[id];
        },
        testRoot: root,
        testViewport: new Viewport(),
        testOwnership: { owned: true, epoch: 1, isCurrent: () => true }
    };
    const bridge = `
        app = globalThis.testRoot;
        ownership = globalThis.testOwnership;
        viewport = globalThis.testViewport;
        pwaSessionState = "menu";
        globalThis.harness = {
            startGame, resetPwaState, showMenu, requestPwaMenu, resumeLiveGameFromMenu,
            getRumbleManager, setRumbleEnabled,
            state: () => ({ phase: pwaSessionState, game, container })
        };
    `;
    vm.runInNewContext(compile(mainSource.replace(/}\s*$/, bridge + "\n}")), context);
    return { ...context.harness, events, runtimeControls, hapticControls };
}

for (const enabled of [true, false]) {
    for (const restore of [true, false]) {
        test(`${restore ? "cold Continue" : "New Game"} releases lifecycle suspension while preserving rumble enabled=${enabled}`, async () => {
            const f = fixture({ enabled, restore });
            const manager = f.getRumbleManager();
            manager.play("test");
            assert.equal(f.events.pulses, 0, "MENU must suppress haptics");
            await f.startGame(restore);
            assert.equal(f.state().phase, "running");
            manager.play("test");
            assert.equal(f.events.pulses, enabled ? 1 : 0);
            assert.equal(manager.isEnabled(), enabled);
            assert.equal(f.events.restores, restore ? 1 : 0);
            assert.equal(f.events.continuous, 1);
        });
    }
}

test("repeated suspension stops make only the newest async shutdown authoritative", () => {
    const f = fixture();
    const manager = f.getRumbleManager();

    manager.stopAll();
    const firstStop = f.events.silencePredicates.at(-1);
    assert.equal(typeof firstStop, "function");
    assert.equal(firstStop(), true);

    manager.stopAll();
    const secondStop = f.events.silencePredicates.at(-1);
    assert.equal(typeof secondStop, "function");
    assert.equal(firstStop(), false);
    assert.equal(secondStop(), true);
});

test("new rumble ownership invalidates fallback work from an earlier stop", async () => {
    const f = fixture();
    const manager = f.getRumbleManager();

    manager.stopAll();
    const staleStop = f.events.silencePredicates.at(-1);
    assert.equal(typeof staleStop, "function");
    assert.equal(staleStop(), true);

    await f.startGame(false);
    manager.play("test");

    assert.equal(staleStop(), false, "a newer play must invalidate pending fallback work from the old stop");
});

test("positive playback predicate retires immediately when stopAll takes ownership", async () => {
    const f = fixture();
    await f.startGame(false);
    const manager = f.getRumbleManager();

    manager.play("test");
    const playPredicate = f.events.playPredicates.at(-1);
    assert.equal(typeof playPredicate, "function");
    assert.equal(playPredicate(), true);

    manager.stopAll();
    assert.equal(playPredicate(), false, "a stale positive play must not own fallback commands after stopAll");
});

test("nonexclusive channels stay independent until a global physical stop is requested", async () => {
    const f = fixture();
    await f.startGame(false);
    const manager = f.getRumbleManager();

    manager.play("test");
    const firstChannel = f.events.playPredicates.at(-1);
    manager.play("other");
    const secondChannel = f.events.playPredicates.at(-1);

    assert.equal(firstChannel(), true, "starting another nonexclusive channel must not retire the first");
    assert.equal(secondChannel(), true);

    manager.stop("test");
    assert.equal(firstChannel(), false, "channel stop maps to a global physical silence and retires every sequence");
    assert.equal(secondChannel(), false, "global physical silence cannot leave another logical channel claiming hardware ownership");
});

test("exclusive rumble waits for its pre-stop before starting the new effect", async () => {
    const f = fixture({ exclusiveHaptics: true });
    await f.startGame(false);
    const manager = f.getRumbleManager();

    manager.play("test");
    const exclusivePreStop = f.events.silencePredicates.at(-1);

    assert.equal(typeof exclusivePreStop, "function");
    assert.equal(exclusivePreStop(), true);
    assert.equal(f.events.pulses, 0, "exclusive playback must not race ahead of the hardware pre-stop");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.events.pulses, 1);
});

test("a newer haptic command cancels an exclusive effect still waiting on its pre-stop", async () => {
    const f = fixture({ exclusiveHaptics: true });
    await f.startGame(false);
    const manager = f.getRumbleManager();
    f.hapticControls.deferSilence = true;

    manager.play("test");
    const exclusivePreStop = f.events.silencePredicates.at(-1);
    const resolveExclusiveStop = f.hapticControls.pendingSilenceResolves.shift();
    assert.equal(typeof exclusivePreStop, "function");
    assert.equal(typeof resolveExclusiveStop, "function");
    assert.equal(f.events.pulses, 0);
    assert.equal(exclusivePreStop(), true);

    manager.stopAll();
    assert.equal(exclusivePreStop(), false, "newer stop ownership must invalidate the pending exclusive startup");
    resolveExclusiveStop();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.events.pulses, 0, "superseded exclusive playback must never start");

    for (const resolve of f.hapticControls.pendingSilenceResolves.splice(0)) {
        resolve();
    }
});

test("best-effort haptic promise failures do not escape stop or play operations", async () => {
    const f = fixture({ rejectHaptics: true });
    const manager = f.getRumbleManager();

    manager.stopAll();
    await new Promise((resolve) => setImmediate(resolve));

    await f.startGame(false);
    manager.play("test");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(f.state().phase, "running");
    assert.equal(f.events.pulses, 1);
});

test("New Game after a live-menu transition reuses and unsuspends the page-lifetime manager", async () => {
    const f = fixture();
    await f.startGame(false);
    const manager = f.getRumbleManager();
    f.requestPwaMenu("hamburger");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.state().phase, "menu");
    manager.play("test");
    assert.equal(f.events.pulses, 0);
    await f.startGame(false);
    assert.equal(f.getRumbleManager(), manager);
    manager.play("test");
    assert.equal(f.events.pulses, 1);
});

test("Reset stays silent in MENU and permits haptics only after another accepted start", async () => {
    const f = fixture();
    await f.startGame(false);
    const manager = f.getRumbleManager();

    f.requestPwaMenu("hamburger");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.state().phase, "menu");
    manager.play("test");
    assert.equal(f.events.pulses, 0);

    f.resetPwaState();
    assert.equal(f.state().phase, "menu");
    manager.play("test");
    assert.equal(f.events.pulses, 0);

    await f.startGame(false);
    manager.play("test");
    assert.equal(f.events.pulses, 1);
});

test("cancelled startup cannot enable rumble when its pending display operation finishes", async () => {
    const f = fixture();
    const pending = deferred();
    const manager = f.getRumbleManager();
    f.runtimeControls.display = () => pending.promise;
    const start = f.startGame(false);
    for (let i = 0; i < 8; i++) {
        await Promise.resolve();
    }
    f.requestPwaMenu("blur");
    pending.resolve();
    await start;
    assert.equal(f.state().phase, "menu");
    manager.play("test");
    assert.equal(f.events.pulses, 0);
    assert.equal(f.events.continuous, 0);
});

test("synchronous focus-hook cancellation cannot reach the RUNNING or rumble commit", async () => {
    const f = fixture();
    f.runtimeControls.focus = () => f.requestPwaMenu("blur");
    await f.startGame(false);
    assert.equal(f.state().phase, "menu");
    f.getRumbleManager().play("test");
    assert.equal(f.events.pulses, 0);
    assert.equal(f.events.loopResumes, 0);
});

test("failed cold restore never releases rumble suspension", async () => {
    const f = fixture({ restore: false });
    await f.startGame(true);
    assert.equal(f.state().phase, "menu");
    f.getRumbleManager().play("test");
    assert.equal(f.events.pulses, 0);
    assert.equal(f.events.continuous, 0);
});

test("failed live-menu persistence keeps the initialized game continuable", async () => {
    const f = fixture({ saveSucceeds: false });
    await f.startGame(false);
    const game = f.state().game;

    f.requestPwaMenu("hamburger");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(f.state().phase, "menu");
    assert.equal(f.state().game, game, "save failure must not destroy the retained live game");
    assert.equal(f.events.saves, 1);

    await f.resumeLiveGameFromMenu();
    assert.equal(f.state().phase, "running");
    assert.equal(f.state().game, game, "Continue after save failure must resume the same live game");
});

test("live Continue still resumes the retained session and its haptics", async () => {
    const f = fixture();
    await f.startGame(false);
    const game = f.state().game;
    f.requestPwaMenu("hamburger");
    await new Promise((resolve) => setImmediate(resolve));
    await f.resumeLiveGameFromMenu();
    assert.equal(f.state().phase, "running");
    assert.equal(f.state().game, game);
    f.getRumbleManager().play("test");
    assert.equal(f.events.pulses, 1);
});
