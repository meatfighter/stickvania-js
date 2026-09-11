import { releaseGameAudio, unlockGameAudio, type GameAudioActivation } from "./app/AudioUnlock.js";
import { GameSessionOwnership } from "./app/GameSessionOwnership.js";
import { SoundStore, type AppGameContainer } from "slick2d-ts";
import { BrowserPreferences } from "./app/BrowserPreferences.js";
import { GameViewportController } from "./app/GameViewportController.js";
import { renderMenu } from "./app/MenuView.js";
import { StickvaniaRuntimeLoader, type PreparedRuntime } from "./app/RuntimeLoader.js";
import { ScreenWakeLockManager } from "./app/ScreenWakeLockManager.js";
import { registerStickvaniaServiceWorker } from "./app/ServiceWorkerRegistrar.js";
import { SessionGeneration } from "./app/SessionGeneration.js";
import { createDisplayMonochromePalette, type DisplayModePreference } from "./DisplayThemes.js";
import { RumbleManager } from "./rumble/RumbleManager.js";
import type { Main } from "./stickvania/Main.js";
import { hasPotentialBrowserStoredStickvaniaGameState } from "./stickvania/persistence/GameStatePreflight.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import type { StickvaniaBufferedGame, StickvaniaScalingPreference } from "./stickvania/StickvaniaBufferedGame.js";
import type { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import "./styles.css";

const HIGH_DPI_ENABLED = true;
const MAX_DEVICE_PIXEL_RATIO = 4;
type PwaSessionState = "booting" | "menu" | "starting" | "running" | "stopping";

let app: HTMLElement;
let ownership: GameSessionOwnership;
let container: AppGameContainer | null = null;
let game: Main | null = null;
let activeBufferedGame: StickvaniaBufferedGame | null = null;
let activeGameShell: HTMLElement | null = null;
let activeGameHost: HTMLElement | null = null;
let menuOverlay: HTMLElement | null = null;
let liveMenuOpen = false;
let gameLaunchInProgress = false;
let pwaSessionState: PwaSessionState = "booting";
let hamburgerVisibilityAnimationFrame = 0;
let rumbleManager: RumbleManager | null = null;
let gameStateStore: StickvaniaGameStateStore | null = null;

const preferences = new BrowserPreferences();
const sessions = new SessionGeneration();
const viewport = new GameViewportController();
const runtimeLoader = new StickvaniaRuntimeLoader(refreshVisibleBootProgress);
const screenWakeLock = new ScreenWakeLockManager();

declare global {
    interface Window {
        __stickvaniaBooted?: boolean;
    }
}

function setAudioVolume(value: number, persist = true): boolean {
    const saved = preferences.setVolume(value, persist);
    applyAudioVolume(preferences.volume);
    return saved;
}

function applyAudioVolume(value: number): void {
    const clampedValue = BrowserPreferences.clampVolume(value);
    SoundStore.get().setSoundVolume(Math.sqrt(clampedValue));
    SoundStore.get().setMusicVolume(clampedValue);
    container?.setSoundVolume(Math.sqrt(clampedValue));
    container?.setMusicVolume(clampedValue);
}

function setDisplayModePreference(value: DisplayModePreference): boolean {
    const saved = preferences.setDisplayMode(value);
    if (game !== null) {
        applyDisplayModePreference(game);
    }
    return saved;
}

function applyDisplayModePreference(target: Main): void {
    target.darkDisplayMode = preferences.displayMode === "dark";
    target.displayMonochromePalette = createDisplayMonochromePalette(preferences.displayMode);
}

function setScalingPreference(value: StickvaniaScalingPreference): boolean {
    const saved = preferences.setScaling(value);
    activeBufferedGame?.setScalingPreference(value);
    return saved;
}

function getRumbleManager(): RumbleManager {
    if (rumbleManager === null) {
        rumbleManager = new RumbleManager(preferences.rumbleEnabled);
        rumbleManager.setSuspended(pwaSessionState !== "running");
    }
    return rumbleManager;
}

function setRumbleEnabled(value: boolean): boolean {
    const saved = preferences.setRumbleEnabled(value);
    const manager = getRumbleManager();
    manager.setEnabled(value);
    if (game !== null) {
        game.rumble = manager;
        if (pwaSessionState === "running") {
            game.resumeBrowserOnlyRumbles();
        }
    }
    return saved;
}

function showBoot(progress = 0): void {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const existingProgress = app.querySelector<HTMLElement>("[data-boot-progress='true']");
    if (existingProgress !== null) {
        existingProgress.setAttribute("aria-valuenow", String(percent));
        existingProgress.querySelector<HTMLElement>(".progress-bar")?.style.setProperty("--progress", `${percent}%`);
        return;
    }
    app.innerHTML = `<main class="boot-screen" role="status" aria-label="Loading"><section class="load-progress-panel" aria-live="polite"><div class="progress-shell" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" data-boot-progress="true"><div class="progress-bar" style="--progress: ${percent}%"></div></div></section></main>`;
}

function showLoadError(title: string, message: string, retryHandler: () => void): void {
    app.innerHTML = `<main class="boot-screen boot-failed" role="alert"><section class="load-error-panel" aria-label="${escapeHtml(title)}"><div class="failure-icon" aria-hidden="true">&#x1F480;</div><div class="boot-title">${escapeHtml(title)}</div><p class="boot-error">${escapeHtml(message)}</p><button id="retry-button" class="retry-button" type="button">Retry</button></section></main>`;
    document.getElementById("retry-button")?.addEventListener("click", retryHandler);
}

function showError(message: string): void {
    destroyGame();
    pwaSessionState = "menu";
    showLoadError("Unable to continue.", message, () => window.location.reload());
}

function showMenu(errorText = ""): void {
    destroyGame();
    pwaSessionState = "menu";
    renderRootMenu(errorText);
}

function renderRootMenu(errorText = ""): HTMLElement {
    return renderMenuForParent(app, hasPotentialSavedGameState(), errorText, false);
}

function renderMenuForParent(parent: HTMLElement, canContinue: boolean, errorText: string, overlay: boolean): HTMLElement {
    return renderMenu(
        parent,
        {
            canContinue,
            errorText,
            overlay,
            volume: preferences.volume,
            displayMode: preferences.displayMode,
            scaling: preferences.scaling,
            rumbleEnabled: preferences.rumbleEnabled
        },
        {
            onDisplayModeChange: setDisplayModePreference,
            onScalingChange: setScalingPreference,
            onRumbleChange: setRumbleEnabled,
            onVolumeInput: (value) => void setAudioVolume(value, false),
            onVolumeCommit: (value) => setAudioVolume(value, true),
            onNewGame: () => {
                if (pwaSessionState !== "menu") {
                    return;
                }
                clearStoredGameState();
                void startGame(false);
            },
            onContinue: () => {
                if (hasLiveSuspendedGame()) {
                    void resumeLiveGameFromMenu();
                } else {
                    void startGame(true);
                }
            },
            onReset: resetPwaState
        }
    );
}

function resetPwaState(): void {
    destroyGame();
    pwaSessionState = "menu";
    const cleared = preferences.reset();
    applyAudioVolume(preferences.volume);
    const manager = getRumbleManager();
    manager.setEnabled(preferences.rumbleEnabled);
    manager.setSuspended(true);
    renderRootMenu(cleared ? "" : "Some browser settings could not be cleared.");
}

function showGameShell(): HTMLElement {
    app.innerHTML = `<div id="game-shell" class="game-shell"><div id="game-host" class="game-host"></div><button id="hamburger-button" class="hamburger-button" type="button" aria-label="Return to menu" hidden><span></span></button></div>`;
    const shell = requiredElement<HTMLElement>(app, "#game-shell");
    const host = requiredElement<HTMLElement>(app, "#game-host");
    requiredElement<HTMLButtonElement>(app, "#hamburger-button").addEventListener("click", returnToMenu);
    activeGameShell = shell;
    activeGameHost = host;
    viewport.setHost(shell, host);
    return host;
}

async function startGame(restoreSavedGame: boolean): Promise<void> {
    if (pwaSessionState !== "menu") {
        return;
    }
    const runtime = runtimeLoader.getPreparedRuntime();
    if (runtime === null) {
        startPwaMenu();
        return;
    }
    destroyGame();
    pwaSessionState = "starting";
    const audioUnlockPromise = unlockAudio();
    gameLaunchInProgress = true;
    syncScreenWakeLock();
    const session = sessions.begin();
    try {
        const audioActivation = await audioUnlockPromise;
        if (audioActivation === "superseded" || !sessions.isCurrent(session) || pwaSessionState !== "starting") {
            return;
        }
        if (restoreSavedGame && !getGameStateStore(runtime).hasValidSave()) {
            showMenu("Unable to restore the saved game. Try Continue again or start a new game.");
            return;
        }
        await launchPreparedGame(runtime, restoreSavedGame, session);
    } catch (error) {
        if (!sessions.isCurrent(session)) {
            return;
        }
        console.error(error);
        destroyGame();
        pwaSessionState = "menu";
        showLoadError("Unable to start.", "Check your connection and try again.", startPwaMenu);
    }
}

async function launchPreparedGame(runtime: PreparedRuntime, restoreSavedGame: boolean, session: number): Promise<void> {
    if (!sessions.isCurrent(session) || pwaSessionState !== "starting") {
        return;
    }
    const host = showGameShell();
    runtime.slick.Display.setParent(host);
    const mainGame = new runtime.Main();
    let restoreFailed = false;
    applyDisplayModePreference(mainGame);
    mainGame.rumble = getRumbleManager();
    const bufferedGame = new runtime.StickvaniaBufferedGame(mainGame, preferences.scaling);
    const displayMode = viewport.getResponsiveWindowedDisplayMode();
    const appContainer = new runtime.slick.AppGameContainer(bufferedGame, displayMode.width, displayMode.height, false);
    appContainer.setPreserveAudioCacheOnDestroy(true);
    appContainer.setLoopSuspended(true);
    appContainer.setHighDpiEnabled(HIGH_DPI_ENABLED);
    appContainer.setMaxDevicePixelRatio(MAX_DEVICE_PIXEL_RATIO);
    container = appContainer;
    game = mainGame;
    activeBufferedGame = bufferedGame;
    mainGame.browserAudioController = appContainer;
    mainGame.browserFullscreenController = viewport.createFullscreenController();
    if (restoreSavedGame) {
        mainGame.loadingCompleteHandler = (gc) => {
            if (!sessions.isCurrent(session) || !getGameStateStore(runtime).restore(mainGame, gc)) {
                restoreFailed = true;
                return false;
            }
            applyDisplayModePreference(mainGame);
            return true;
        };
    }
    appContainer.setAlwaysRender(true);
    appContainer.setVSync(true);
    appContainer.setSmoothDeltas(false);
    appContainer.setShowFPS(false);
    appContainer.setClearEachFrame(true);
    await Promise.resolve(appContainer.setDisplayMode(displayMode.width, displayMode.height, false));
    if (!sessions.isCurrent(session) || pwaSessionState !== "starting") {
        appContainer.destroy();
        return;
    }
    await appContainer.start();
    if (!sessions.isCurrent(session) || pwaSessionState !== "starting") {
        appContainer.destroy();
        return;
    }
    if (restoreFailed) {
        destroyGame();
        pwaSessionState = "menu";
        renderRootMenu("Unable to restore the saved game. Try Continue again or start a new game.");
        return;
    }
    appContainer.setErrorHandler((error: unknown) => {
        if (!sessions.isCurrent(session)) {
            return;
        }
        console.error(error);
        destroyGame();
        pwaSessionState = "menu";
        showLoadError("Unable to continue.", "Reload the page and try again.", () => window.location.reload());
    });
    viewport.start(appContainer, () => sessions.isCurrent(session), showError);
    applyAudioVolume(preferences.volume);
    getRumbleManager().setEnabled(preferences.rumbleEnabled);
    viewport.focusCanvas();
    if (!sessions.isCurrent(session) || pwaSessionState !== "starting" || game !== mainGame || container !== appContainer) {
        return;
    }
    gameLaunchInProgress = false;
    pwaSessionState = "running";
    mainGame.setBrowserSuspended(false);
    // Enabled preference and lifecycle suspension are independent. A prior game
    // suspended the page-lifetime manager; only this accepted start may release it.
    getRumbleManager().setSuspended(false);
    mainGame.resumeBrowserOnlyRumbles();
    appContainer.setLoopSuspended(false);
    startHamburgerVisibilityMonitor();
    syncScreenWakeLock();
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
        requestPwaMenu("launch-lost-focus");
    }
}

function refreshVisibleBootProgress(): void {
    if (typeof app !== "undefined" && app.querySelector("[data-boot-progress='true']") !== null) {
        showBoot(runtimeLoader.getProgress());
    }
}

function getGameStateStore(runtime: PreparedRuntime): StickvaniaGameStateStore {
    if (gameStateStore === null) {
        gameStateStore = new runtime.StickvaniaGameStateStore(__APP_VERSION__);
    }
    return gameStateStore;
}

function getLoadedGameStateStore(): StickvaniaGameStateStore | null {
    if (gameStateStore !== null) {
        return gameStateStore;
    }
    const runtime = runtimeLoader.getPreparedRuntime();
    return runtime === null ? null : getGameStateStore(runtime);
}

function hasPotentialSavedGameState(): boolean {
    return hasPotentialBrowserStoredStickvaniaGameState();
}

function returnToMenu(): void {
    requestPwaMenu("hamburger");
}

function requestPwaMenu(_reason: string): void {
    if (pwaSessionState === "booting" || pwaSessionState === "menu" || pwaSessionState === "stopping") {
        return;
    }
    if (pwaSessionState === "starting") {
        if (liveMenuOpen) {
            releaseGameAudio();
            pwaSessionState = "menu";
            syncScreenWakeLock();
            return;
        }
        saveCurrentGameState();
        showMenu();
        return;
    }
    if (canOpenLiveMenuOverlay()) {
        showLiveMenuOverlay();
        return;
    }
    saveCurrentGameState();
    showMenu();
}

function canOpenLiveMenuOverlay(): boolean {
    return (
        pwaSessionState === "running" &&
        game !== null &&
        container !== null &&
        activeGameShell !== null &&
        activeGameHost !== null &&
        game.isStateSaveReady() &&
        game.isLiveMenuOverlayAllowed()
    );
}

function hasLiveSuspendedGame(): boolean {
    return pwaSessionState === "menu" && liveMenuOpen && menuOverlay !== null && game !== null && container !== null && activeGameHost !== null;
}

function showLiveMenuOverlay(): void {
    if (!canOpenLiveMenuOverlay() || game === null || container === null || activeGameShell === null) {
        saveCurrentGameState();
        showMenu();
        return;
    }
    pwaSessionState = "stopping";
    removeMenuOverlay();
    liveMenuOpen = true;
    syncScreenWakeLock();
    game.setBrowserSuspended(true);
    container.stopSoundEffects();
    getRumbleManager().setSuspended(true);
    container.setLoopSuspended(true);
    container.getInput().pause();
    const saved = saveCurrentGameState();
    stopHamburgerVisibilityMonitor();
    hideHamburgerButton();
    viewport.suspendCursor();
    releaseGameAudio();
    menuOverlay = renderMenuForParent(activeGameShell, true, saved ? "" : "Unable to save progress in this browser.", true);
    pwaSessionState = "menu";
    syncScreenWakeLock();
}

async function resumeLiveGameFromMenu(): Promise<void> {
    if (!hasLiveSuspendedGame() || game === null || container === null) {
        return;
    }
    const liveGame = game;
    const liveContainer = container;
    const liveOverlay = menuOverlay;
    pwaSessionState = "starting";
    const audioUnlockPromise = unlockAudio();
    const audioActivation = await audioUnlockPromise;
    if (audioActivation === "superseded") {
        return;
    }
    if (
        pwaSessionState !== "starting" ||
        game !== liveGame ||
        container !== liveContainer ||
        menuOverlay !== liveOverlay ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
    ) {
        releaseGameAudio();
        if (game === liveGame && container === liveContainer && menuOverlay === liveOverlay) {
            pwaSessionState = "menu";
        }
        return;
    }
    removeMenuOverlay();
    liveContainer.getInput().resume();
    liveGame.clearInputPressedRecords();
    applyDisplayModePreference(liveGame);
    viewport.resumeCursor();
    applyAudioVolume(preferences.volume);
    viewport.scheduleResize();
    viewport.focusCanvas();
    liveGame.setBrowserSuspended(false);
    getRumbleManager().setSuspended(false);
    liveGame.resumeBrowserOnlyRumbles();
    liveContainer.setLoopSuspended(false);
    pwaSessionState = "running";
    startHamburgerVisibilityMonitor();
    syncScreenWakeLock();
}

function removeMenuOverlay(): void {
    menuOverlay?.remove();
    menuOverlay = null;
    liveMenuOpen = false;
}

function hideHamburgerButton(): void {
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement | null;
    if (hamburger !== null) {
        hamburger.hidden = true;
    }
}

function saveCurrentGameState(): boolean {
    if (!ownership?.owned) return false;
    if (game === null || !game.isStateSaveReady()) {
        return false;
    }
    return getLoadedGameStateStore()?.save(game) ?? false;
}

function clearStoredGameState(): void {
    const store = getLoadedGameStateStore();
    if (store !== null) {
        store.clear();
        return;
    }
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY);
    } catch (error) {
        console.warn("Unable to clear Stickvania saved game.", error);
    }
}

function syncScreenWakeLock(): void {
    screenWakeLock.setDesired(pwaSessionState === "running" || (pwaSessionState === "starting" && !liveMenuOpen && gameLaunchInProgress));
}

function destroyGame(): void {
    pwaSessionState = "stopping";
    syncScreenWakeLock();
    sessions.invalidate();
    gameStateStore?.cancelPendingRestore();
    gameLaunchInProgress = false;
    releaseGameAudio();
    removeMenuOverlay();
    stopHamburgerVisibilityMonitor();
    game?.stopAllSounds();
    rumbleManager?.setSuspended(true);
    rumbleManager?.stopAll();
    viewport.exitFullscreen();
    viewport.stop();
    if (container !== null) {
        container.destroy();
        container = null;
    } else {
        SoundStore.get().stopAllPlayback();
    }
    game = null;
    activeBufferedGame = null;
    activeGameShell = null;
    activeGameHost = null;
    runtimeLoader.getPreparedRuntime()?.slick.Display.setParent(null);
    syncScreenWakeLock();
}

function startHamburgerVisibilityMonitor(): void {
    stopHamburgerVisibilityMonitor();
    document.addEventListener("fullscreenchange", updateHamburgerVisibility);
    updateHamburgerVisibility();
}

function stopHamburgerVisibilityMonitor(): void {
    document.removeEventListener("fullscreenchange", updateHamburgerVisibility);
    if (hamburgerVisibilityAnimationFrame !== 0) {
        cancelAnimationFrame(hamburgerVisibilityAnimationFrame);
        hamburgerVisibilityAnimationFrame = 0;
    }
}

function updateHamburgerVisibility(): void {
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement | null;
    const fullscreen = viewport.isShellFullscreen() || container?.isFullscreen() === true;
    const hidden = pwaSessionState !== "running" || game === null || fullscreen;
    if (hamburger !== null) {
        hamburger.hidden = hidden;
    }
}

async function unlockAudio(): Promise<GameAudioActivation> {
    return unlockGameAudio();
}

function startPwaMenu(): void {
    pwaSessionState = "booting";
    applyAudioVolume(preferences.volume);
    showBoot(runtimeLoader.getProgress());
    const serviceWorkerReady = registerStickvaniaServiceWorker(__CACHE_VERSION__).catch((error) => {
        console.warn("Service worker registration failed.", error);
    });
    runtimeLoader.setReadinessBarrier(serviceWorkerReady);
    void runtimeLoader
        .ensurePrepared(runtimeLoader.hasError())
        .then(() => {
            if (pwaSessionState !== "booting") {
                return;
            }
            pwaSessionState = "menu";
            renderRootMenu();
            window.__stickvaniaBooted = true;
        })
        .catch((error) => {
            console.error(error);
            if (pwaSessionState !== "booting") {
                return;
            }
            pwaSessionState = "menu";
            showLoadError("Unable to load.", "Check your connection and try again.", startPwaMenu);
        });
}

function setupPageLifecycleHandlers(): void {
    window.addEventListener("pagehide", () => requestPwaMenu("pagehide"));
    window.addEventListener("blur", () => requestPwaMenu("blur"));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            requestPwaMenu("hidden");
        }
    });
}

async function boot(): Promise<void> {
    app = requiredElement<HTMLElement>(document, "#app");
    setupPageLifecycleHandlers();
    ownership = new GameSessionOwnership(app, startPwaMenu, () => {
        saveCurrentGameState();
        destroyGame();
        pwaSessionState = "menu";
    });
    ownership.start();
}

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
    const element = parent.querySelector<T>(selector);
    if (element === null) {
        throw new Error(`Stickvania page is missing ${selector}.`);
    }
    return element;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
    void boot();
}
