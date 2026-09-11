import { SessionCleanup } from "./app/SessionCleanup.js";
import {
    beginGameAudio,
    commitGameAudio,
    isGameAudioCurrent,
    isGameAudioLatest,
    releaseGameAudio,
    setGameAudioInterruptionHandler,
    type GameAudioAttempt
} from "./app/PlaybackSession.js";
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
type PwaSessionState = "booting" | "menu" | "starting" | "running" | "stopping" | "error";

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
let gameOwnershipEpoch = -1;
let activeGameSession = 0;
let menuRequestSerial = 0;
let hamburgerVisibilityAnimationFrame = 0;
let rumbleManager: RumbleManager | null = null;
let gameStateStore: StickvaniaGameStateStore | null = null;

const preferences = new BrowserPreferences();
const sessions = new SessionGeneration();
const viewport = new GameViewportController();
const runtimeLoader = new StickvaniaRuntimeLoader(refreshVisibleBootProgress);
const screenWakeLock = new ScreenWakeLockManager();
const sessionCleanup = new SessionCleanup();

declare global {
    interface Window {
        __stickvaniaBooted?: boolean;
    }
}

function canActivateFromMenu(): boolean {
    return sessionCleanup.safe && pwaSessionState === "menu" && ownership.isCurrent(ownership.epoch) && document.visibilityState === "visible" && document.hasFocus();
}

function isCurrentGameSession(session: number): boolean {
    return sessionCleanup.safe && sessions.isCurrent(session) && ownership.isCurrent(gameOwnershipEpoch);
}

function isStartingGameSession(session: number, audio: GameAudioAttempt): boolean {
    return (
        isCurrentGameSession(session) &&
        pwaSessionState === "starting" &&
        isGameAudioCurrent(audio) &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        container?.isGraphicsContextLost() !== true
    );
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
    if (!ownership?.owned) {
        return;
    }
    app.innerHTML = `<main class="boot-screen boot-failed" role="alert"><section class="load-error-panel" aria-label="${escapeHtml(title)}"><div class="failure-icon" aria-hidden="true">&#x1F480;</div><div class="boot-title">${escapeHtml(title)}</div><p class="boot-error">${escapeHtml(message)}</p><button id="retry-button" class="retry-button" type="button">Retry</button></section></main>`;
    document.getElementById("retry-button")?.addEventListener("click", retryHandler);
}

function showError(message: string): void {
    if (!destroyGame()) {
        return;
    }
    pwaSessionState = "menu";
    showLoadError("Unable to continue.", message, () => window.location.reload());
}

function showMenu(errorText = ""): void {
    if (!ownership?.isCurrent(ownership.epoch)) {
        return;
    }
    if (!destroyGame()) {
        return;
    }
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
                if (!canActivateFromMenu()) {
                    return;
                }
                clearStoredGameState();
                void startGame(false);
            },
            onContinue: () => {
                if (!canActivateFromMenu()) {
                    return;
                }
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
    if (!canActivateFromMenu()) {
        return;
    }
    if (!destroyGame()) {
        return;
    }
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
    if (!canActivateFromMenu()) {
        return;
    }
    const runtime = runtimeLoader.getPreparedRuntime();
    if (runtime === null) {
        startPwaMenu();
        return;
    }
    if (!destroyGame()) {
        return;
    }
    gameOwnershipEpoch = ownership.epoch;
    const session = sessions.begin();
    activeGameSession = session;
    pwaSessionState = "starting";
    gameLaunchInProgress = true;
    syncScreenWakeLock();
    if (!isCurrentGameSession(session) || pwaSessionState !== "starting") {
        return;
    }
    const audio = beginGameAudio();
    try {
        if (!(await audio.ready) || !isStartingGameSession(session, audio)) {
            return;
        }
        if (restoreSavedGame && !getGameStateStore(runtime).hasValidSave()) {
            showMenu("Unable to restore the saved game. Try Continue again or start a new game.");
            return;
        }
        await launchPreparedGame(runtime, restoreSavedGame, session, audio);
    } catch (error) {
        if (!isCurrentGameSession(session)) {
            return;
        }
        console.error(error);
        if (!destroyGame()) {
            return;
        }
        pwaSessionState = "menu";
        showLoadError("Unable to start.", "Check your connection and try again.", startPwaMenu);
    } finally {
        if (isGameAudioLatest(audio) && isCurrentGameSession(session) && pwaSessionState === "starting") {
            requestPwaMenu("start-failed");
        }
    }
}

async function launchPreparedGame(runtime: PreparedRuntime, restoreSavedGame: boolean, session: number, audio: GameAudioAttempt): Promise<void> {
    if (!isStartingGameSession(session, audio)) {
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
    mainGame.browserFullscreenController = viewport.createFullscreenController();
    appContainer.setGraphicsLifecycleHandler((state) => {
        if (state === "lost" && isCurrentGameSession(session)) {
            requestPwaMenu("graphics-context-lost");
        }
    });
    if (restoreSavedGame) {
        mainGame.loadingCompleteHandler = (gc) => {
            if (!isStartingGameSession(session, audio) || !getGameStateStore(runtime).restore(mainGame, gc)) {
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
    if (!isStartingGameSession(session, audio)) {
        appContainer.destroy();
        return;
    }
    await appContainer.start();
    if (!isStartingGameSession(session, audio)) {
        appContainer.destroy();
        return;
    }
    if (restoreFailed) {
        showMenu("Unable to restore the saved game. Try Continue again or start a new game.");
        return;
    }
    appContainer.setErrorHandler((error: unknown) => {
        if (!isCurrentGameSession(session)) {
            return;
        }
        console.error(error);
        if (!destroyGame()) {
            return;
        }
        pwaSessionState = "menu";
        showLoadError("Unable to continue.", "Reload the page and try again.", () => window.location.reload());
    });
    applyAudioVolume(preferences.volume);
    if (!(await commitGameAudio(audio)) || !isStartingGameSession(session, audio)) {
        return;
    }
    viewport.start(appContainer, () => isCurrentGameSession(session), showError);
    getRumbleManager().setEnabled(preferences.rumbleEnabled);
    viewport.focusCanvas();
    if (!isStartingGameSession(session, audio) || game !== mainGame || container !== appContainer) {
        return;
    }
    gameLaunchInProgress = false;
    pwaSessionState = "running";
    // Only this accepted transaction releases the page-lifetime rumble manager.
    mainGame.setBrowserSuspended(false);
    getRumbleManager().setSuspended(false);
    mainGame.resumeBrowserOnlyRumbles();
    if (!isCurrentGameSession(session) || !isGameAudioCurrent(audio) || pwaSessionState !== "running" || game !== mainGame || container !== appContainer) {
        return;
    }
    appContainer.setLoopSuspended(false);
    startHamburgerVisibilityMonitor();
    syncScreenWakeLock();
}

function refreshVisibleBootProgress(): void {
    if (typeof app !== "undefined" && ownership?.owned && pwaSessionState === "booting" && app.querySelector("[data-boot-progress='true']") !== null) {
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

function suspendGameForMenu(): boolean {
    return sessionCleanup.run(
        () => container?.setLoopSuspended(true),
        () => game?.setBrowserSuspended(true),
        () => container?.getInput().pause(),
        () => rumbleManager?.setSuspended(true),

        () => releaseGameAudio()
    );
}

function requestPwaMenu(_reason: string): void {
    if (pwaSessionState === "booting" || pwaSessionState === "menu" || pwaSessionState === "stopping" || pwaSessionState === "error") {
        return;
    }
    if (pwaSessionState === "running" && canOpenLiveMenuOverlay()) {
        showLiveMenuOverlay();
        return;
    }
    const retainExistingOverlay = liveMenuOpen && game !== null && container !== null;
    pwaSessionState = "stopping";
    sessionCleanup.run(() => syncScreenWakeLock());
    suspendGameForMenu();
    sessionCleanup.trySave(saveCurrentGameState);
    if (!sessionCleanup.safe) {
        showCleanupFailure();
        return;
    }
    if (retainExistingOverlay) {
        pwaSessionState = "menu";
        syncScreenWakeLock();
    } else {
        showMenu();
    }
}

function canOpenLiveMenuOverlay(): boolean {
    return pwaSessionState === "running" && game !== null && container !== null && !container.isDestroyed() && activeGameShell !== null && activeGameHost !== null;
}

function hasLiveSuspendedGame(): boolean {
    return pwaSessionState === "menu" && liveMenuOpen && menuOverlay !== null && game !== null && container !== null && activeGameHost !== null;
}

function showLiveMenuOverlay(): void {
    if (pwaSessionState !== "running" || game === null || container === null || activeGameShell === null) {
        return;
    }
    const host = activeGameShell;
    pwaSessionState = "stopping";
    liveMenuOpen = true;
    sessionCleanup.run(() => syncScreenWakeLock());
    suspendGameForMenu();
    // Music has already been detached at its old context position before saving.
    const saved = sessionCleanup.trySave(saveCurrentGameState);
    sessionCleanup.run(
        () => stopHamburgerVisibilityMonitor(),
        () => hideHamburgerButton(),
        () => viewport.suspendCursor()
    );
    if (!sessionCleanup.safe) {
        showCleanupFailure();
        return;
    }
    if (!sessionCleanup.run(() => { menuOverlay = renderMenuForParent(host, true, saved ? "" : "Progress could not be saved. Continue still preserves this live game.", true); })) {
        showCleanupFailure();
        return;
    }
    pwaSessionState = "menu";
    syncScreenWakeLock();
}

async function resumeLiveGameFromMenu(): Promise<void> {
    if (!canActivateFromMenu() || !hasLiveSuspendedGame() || game === null || container === null || container.isGraphicsContextLost()) {
        return;
    }
    const liveGame = game;
    const liveContainer = container;
    const liveOverlay = menuOverlay;
    const session = activeGameSession;
    pwaSessionState = "starting";
    const audio = beginGameAudio();
    try {
        if (!(await audio.ready) || !isStartingGameSession(session, audio) || game !== liveGame || container !== liveContainer || menuOverlay !== liveOverlay) {
            return;
        }
        applyDisplayModePreference(liveGame);
        applyAudioVolume(preferences.volume);
        if (!(await commitGameAudio(audio)) || !isStartingGameSession(session, audio) || game !== liveGame || container !== liveContainer || menuOverlay !== liveOverlay) {
            return;
        }
        viewport.scheduleResize();
        viewport.focusCanvas();
        if (!isStartingGameSession(session, audio)) {
            return;
        }
        liveContainer.getInput().resume();
        liveGame.clearInputPressedRecords();
        if (!isStartingGameSession(session, audio)) {
            return;
        }
        pwaSessionState = "running";
        removeMenuOverlay();
        if (!isCurrentGameSession(session) || !isGameAudioCurrent(audio) || pwaSessionState !== "running" || game !== liveGame || container !== liveContainer) {
            return;
        }
        viewport.resumeCursor();
        liveGame.setBrowserSuspended(false);
        getRumbleManager().setSuspended(false);
        liveGame.resumeBrowserOnlyRumbles();
        if (!isCurrentGameSession(session) || !isGameAudioCurrent(audio) || pwaSessionState !== "running") {
            return;
        }
        liveContainer.setLoopSuspended(false);
        startHamburgerVisibilityMonitor();
        syncScreenWakeLock();
    } catch (error) {
        if (isGameAudioLatest(audio) && isCurrentGameSession(session)) {
            console.error("Unable to continue the playback session.", error);
            requestPwaMenu("continue-failed");
        }
    } finally {
        if (isGameAudioLatest(audio) && isCurrentGameSession(session) && pwaSessionState === "starting" && game === liveGame && container === liveContainer && menuOverlay === liveOverlay) {
            requestPwaMenu("continue-not-accepted");
        }
    }
}

function removeMenuOverlay(): void {
    const overlay = menuOverlay;
    menuOverlay = null;
    liveMenuOpen = false;
    // Drop old ownership before DOM callbacks can publish a replacement overlay.
    overlay?.remove();
}

function hideHamburgerButton(): void {
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement | null;
    if (hamburger !== null) {
        hamburger.hidden = true;
    }
}


function saveCurrentGameState(): boolean {
    if (!ownership?.owned) {
        return false;
    }
    if (game === null || !game.isStateSaveReady()) {
        return false;
    }
    return getLoadedGameStateStore()?.save(game) ?? false;
}

function clearStoredGameState(): void {
    if (!ownership?.owned) {
        return;
    }
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
    screenWakeLock.setDesired(
        ownership?.isCurrent(gameOwnershipEpoch) === true &&
            (pwaSessionState === "running" || (pwaSessionState === "starting" && !liveMenuOpen && gameLaunchInProgress))
    );
}

function destroyGame(): boolean {
    pwaSessionState = "stopping";
    menuRequestSerial++;
    sessions.invalidate();
    activeGameSession = 0;
    gameLaunchInProgress = false;
    const oldGame = game;
    const oldContainer = container;
    sessionCleanup.run(
        () => syncScreenWakeLock(),
        () => oldContainer?.setLoopSuspended(true),
        () => oldGame?.setBrowserSuspended(true),
        () => oldContainer?.getInput().pause(),

        () => releaseGameAudio(),
        () => removeMenuOverlay(),
        () => stopHamburgerVisibilityMonitor(),
        () => oldGame?.stopAllSounds(),
        () => rumbleManager?.setSuspended(true),
        () => rumbleManager?.stopAll(),
        () => viewport.exitFullscreen(),
        () => viewport.stop(),
        () => {
            if (oldContainer !== null) {
                oldContainer.destroy();
            } else {
                SoundStore.get().stopAllPlayback();
            }
        },
        () => runtimeLoader.getPreparedRuntime()?.slick.Display.setParent(null)
    );
    container = null;
    game = null;
    menuOverlay = null;
    liveMenuOpen = false;
    activeGameHost = null;
    activeBufferedGame = null;
    activeGameShell = null;
    if (!sessionCleanup.safe) {
        showCleanupFailure();
    }
    return sessionCleanup.safe;
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

function startPwaMenu(): void {
    const epoch = ownership.epoch;
    if (!sessionCleanup.safe || !ownership.isCurrent(epoch)) {
        return;
    }
    const request = ++menuRequestSerial;
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
            if (request !== menuRequestSerial || !ownership.isCurrent(epoch) || pwaSessionState !== "booting") {
                return;
            }
            pwaSessionState = "menu";
            renderRootMenu();
            window.__stickvaniaBooted = true;
        })
        .catch((error) => {
            if (request !== menuRequestSerial || !ownership.isCurrent(epoch) || pwaSessionState !== "booting") {
                return;
            }
            console.error(error);
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
    setGameAudioInterruptionHandler(requestPwaMenu);
    ownership = new GameSessionOwnership(app, startPwaMenu, () => releaseOwnedSession());
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

/** Final save remains authorized by ownership.owned until this callback returns. */
function releaseOwnedSession(): void {
    pwaSessionState = "stopping";
    sessions.invalidate();
    menuRequestSerial++;
    sessionCleanup.run(() => syncScreenWakeLock());
    suspendGameForMenu();
    sessionCleanup.trySave(saveCurrentGameState);
    destroyGame();
    if (sessionCleanup.safe) {
        pwaSessionState = "menu";
    }
    sessionCleanup.assertSafe();
}

function showCleanupFailure(): void {
    pwaSessionState = "error";
    try {
        screenWakeLock.setDesired(false);
    } catch (error) {
        console.error("Unable to release screen wake intent.", error);
    }
    console.error("Session cleanup requires a reload.", sessionCleanup.failure);
    try {
        app.innerHTML = '<main class="boot-screen" role="alert"><section class="load-error-panel"><p>This session could not be stopped safely. Reload this tab before continuing.</p><button type="button" id="session-reload">Reload</button></section></main>';
        app.querySelector<HTMLButtonElement>("#session-reload")?.addEventListener("click", () => window.location.reload());
    } catch (error) {
        console.error("Unable to display the reload message.", error);
    }
}
