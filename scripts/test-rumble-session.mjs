import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) =>
    ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const mainSource = readFileSync(new URL("../pwa/src/main.ts", import.meta.url), "utf8");
const rumbleSource = readFileSync(new URL("../pwa/src/rumble/RumbleManager.ts", import.meta.url), "utf8");

function deferred() {
    let resolve;
    const promise = new Promise((yes) => {
        resolve = yes;
    });
    return { promise, resolve };
}

function fixture({ enabled = true, restore = true } = {}) {
    const noop = () => {};
    const events = { pulses: 0, restores: 0, continuous: 0, loopResumes: 0 };
    const runtimeControls = { display: () => Promise.resolve(), focus: noop };
    const node = () => ({ addEventListener: noop, remove: noop });
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
                    silenceGamepads: () => Promise.resolve(),
                    playPulseOnGamepad: () => {
                        events.pulses++;
                        return Promise.resolve();
                    }
                };
            }
            if (id === "./RumbleEffects.js") {
                return { getRumbleEffect: () => ({ channel: "test", pattern: [{ duration: 1 }] }), isRumbleDelayStep: () => false };
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
    class Viewport {
        setHost() {}
        createFullscreenController() {
            return {};
        }
        getResponsiveWindowedDisplayMode() {
            return { width: 640, height: 480 };
        }
        start() {}
        focusCanvas() {
            runtimeControls.focus();
        }
        isShellFullscreen() {
            return false;
        }
        exitFullscreen() {}
        stop() {}
        suspendCursor() {}
        resumeCursor() {}
        scheduleResize() {}
    }
    class Main {
        clearInputPressedRecords() {}
        setBrowserSuspended() {}
        stopAllSounds() {}
        isStateSaveReady() {
            return true;
        }
        isLiveMenuOverlayAllowed() {
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
        setDisplayMode() {
            return runtimeControls.display();
        }
        async start() {
            this.game.loadingCompleteHandler?.(this);
        }
        setErrorHandler() {}
        setLoopSuspended(suspended) {
            if (!suspended) {
                events.loopResumes++;
            }
        }
        getInput() {
            return input;
        }
        isFullscreen() {
            return false;
        }
        setSoundVolume() {}
        setMusicVolume() {}
        stopSoundEffects() {}
        destroy() {}
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
            return true;
        }
        cancelPendingRestore() {}
    }
    const runtime = {
        Main,
        StickvaniaBufferedGame: Buffered,
        StickvaniaGameStateStore: Store,
        slick: { Display: { setParent: noop }, AppGameContainer: Container }
    };
    const imports = {
        "./app/AudioUnlock.js": { releaseGameAudio: noop, unlockGameAudio: () => Promise.resolve("ready") },
        "./app/GameSessionOwnership.js": { GameSessionOwnership: class {} },
        "slick2d-ts": { SoundStore: { get: () => ({ setSoundVolume: noop, setMusicVolume: noop, stopAllPlayback: noop }) } },
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
        "./stickvania/persistence/GameStatePreflight.js": { hasPotentialBrowserStoredStickvaniaGameState: () => false },
        "./stickvania/persistence/GameStateSchema.js": { GAME_STATE_STORAGE_KEY: "test-state" },
        "./styles.css": {}
    };
    const context = {
        ...common,
        exports: {},
        __APP_VERSION__: "test",
        cancelAnimationFrame: noop,
        require(id) {
            assert.ok(Object.hasOwn(imports, id), `Unexpected application import: ${id}`);
            return imports[id];
        },
        testRoot: root,
        testOwnership: { owned: true }
    };
    // The whole application module executes. This test-only access bridge exposes
    // existing lexical state without copying any production method into the test.
    const bridge = `
        app = globalThis.testRoot;
        ownership = globalThis.testOwnership;
        pwaSessionState = "menu";
        globalThis.harness = {
            startGame, resetPwaState, showMenu, requestPwaMenu, resumeLiveGameFromMenu,
            getRumbleManager, setRumbleEnabled,
            state: () => ({ phase: pwaSessionState, game, container })
        };
    `;
    vm.runInNewContext(compile(mainSource) + bridge, context);
    return { ...context.harness, events, runtimeControls };
}

for (const enabled of [true, false]) {
    for (const restore of [true, false]) {
        test(`${restore ? "cold Continue" : "New Game"} releases lifecycle suspension while preserving rumble enabled=${enabled}`, async () => {
            const f = fixture({ enabled });
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

test("New Game after a live-menu transition reuses and unsuspends the page-lifetime manager", async () => {
    const f = fixture();
    await f.startGame(false);
    const manager = f.getRumbleManager();
    f.requestPwaMenu("hamburger");
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
    f.resetPwaState();
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

test("live Continue still resumes the retained session and its haptics", async () => {
    const f = fixture();
    await f.startGame(false);
    const game = f.state().game;
    f.requestPwaMenu("hamburger");
    await f.resumeLiveGameFromMenu();
    assert.equal(f.state().phase, "running");
    assert.equal(f.state().game, game);
    f.getRumbleManager().play("test");
    assert.equal(f.events.pulses, 1);
});
