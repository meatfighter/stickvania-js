import type { AppGameContainer } from "slick2d-ts/slick/AppGameContainer";
import { SoundStore } from "slick2d-ts/slick/openal/SoundStore";
import { ResourceLoader } from "slick2d-ts/slick/util/ResourceLoader";
import { RumbleManager } from "./rumble/RumbleManager.js";
import type { Main } from "./stickvania/Main.js";
import { hasPotentialBrowserStoredStickvaniaGameState } from "./stickvania/persistence/GameStatePreflight.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import type { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import "./styles.css";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const GAME_VIEWPORT_WIDTH = 512;
const GAME_VIEWPORT_HEIGHT = 416;
const DEFAULT_VOLUME = 0.1;
const DEFAULT_RUMBLE_ENABLED = false;
const HIGH_DPI_ENABLED = true;
const MAX_DEVICE_PIXEL_RATIO = 2;
const BASE_URL = import.meta.env.BASE_URL;
const GAME_CURSOR_HIDE_DELAY_MS = 3000;
const RESOURCE_CACHE_RETRY_COUNT = 3;
const RESOURCE_CACHE_RETRY_DELAY_MS = 250;
type DisplayModePreference = "light" | "dark";
type SlickRuntimeModule = typeof import("slick2d-ts");
type MainConstructor = typeof import("./stickvania/Main.js").Main;
type ScalableGame2Constructor = typeof import("./stickvania/ScalableGame2.js").ScalableGame2;
type StickvaniaGameStateStoreConstructor = typeof import("./stickvania/persistence/StickvaniaGameStateStore.js").StickvaniaGameStateStore;

declare global {
    interface Window {
        __stickvaniaBooted?: boolean;
    }
}

type PreparedRuntime = {
    slick: SlickRuntimeModule;
    Main: MainConstructor;
    ScalableGame2: ScalableGame2Constructor;
    StickvaniaGameStateStore: StickvaniaGameStateStoreConstructor;
};

const DISPLAY_MODE_STORAGE_KEY = "stickvania-display-mode";
const RUMBLE_STORAGE_KEY = "stickvania-rumble";
const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";

let app: HTMLElement;
let container: AppGameContainer | null = null;
let game: Main | null = null;
let activeGameShell: HTMLElement | null = null;
let activeGameHost: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeAnimationFrame = 0;
let hamburgerVisibilityAnimationFrame = 0;
let menuOverlay: HTMLElement | null = null;
let liveMenuOpen = false;
let cursorGameHost: HTMLElement | null = null;
let cursorHideTimer = 0;
let pointerOverGameHost = false;
let volume = safeReadVolume();
let displayModePreference = safeReadDisplayModePreference();
let rumbleEnabled = safeReadRumbleEnabled();
let rumbleManager: RumbleManager | null = null;
let preparedRuntime: PreparedRuntime | null = null;
let preparationPromise: Promise<PreparedRuntime> | null = null;
let preparationError: unknown = null;
let preparationProgress = 0;
let backgroundPreparationScheduled = false;
let initialServiceWorkerReadyPromise: Promise<void> | null = null;
let suspendedByFocusLoss = false;
let suspendedByVisibilityLoss = false;
let gameStateStore: StickvaniaGameStateStore | null = null;

function setAudioVolume(value: number): void {
    volume = Math.max(0, Math.min(1, value));
    writeVolume(volume);
    // Slick applies sound volume twice on Sound.play(); compensate so this is a master volume.
    SoundStore.get().setSoundVolume(Math.sqrt(volume));
    SoundStore.get().setMusicVolume(volume);
    container?.setSoundVolume(Math.sqrt(volume));
    container?.setMusicVolume(volume);
}

function updateVolumeUi(volumeInput: HTMLInputElement, volumeValue: HTMLElement, volumeIcon: HTMLElement): void {
    const volumePercent = Math.round(volume * 100);
    volumeInput.style.setProperty("--thumb-position", `${volumePercent}%`);
    volumeValue.textContent = String(volumePercent);
    volumeIcon.innerHTML = volumeIconSvg(volume);
}

function volumeIconSvg(value: number): string {
    const waves =
        Math.round(value * 100) === 0
            ? `<path d="M18 9l5 5m0-5l-5 5"></path>`
            : value < 0.33
              ? `<path d="M17 10a4 4 0 0 1 0 4"></path>`
              : value < 0.66
                ? `<path d="M17 8a6 6 0 0 1 0 8"></path><path d="M20 6a9 9 0 0 1 0 12"></path>`
                : `<path d="M17 8a6 6 0 0 1 0 8"></path><path d="M20 6a9 9 0 0 1 0 12"></path><path d="M23 4a12 12 0 0 1 0 16"></path>`;

    return `
        <svg viewBox="0 0 26 24" focusable="false" aria-hidden="true">
            <path d="M3 9v6h5l6 5V4L8 9H3z"></path>
            ${waves}
        </svg>`;
}

function setDisplayModePreference(value: DisplayModePreference): void {
    displayModePreference = value;
    writeDisplayModePreference(value);
}

function updateDisplayModeUi(displaySwitchButton: HTMLButtonElement): void {
    const darkEnabled = displayModePreference === "dark";
    displaySwitchButton.setAttribute("aria-pressed", String(darkEnabled));
    displaySwitchButton.setAttribute("data-enabled", String(darkEnabled));
}

function getRumbleManager(): RumbleManager {
    if (rumbleManager === null) {
        rumbleManager = new RumbleManager(rumbleEnabled);
    }
    return rumbleManager;
}

function setRumbleEnabled(value: boolean): void {
    rumbleEnabled = value;
    writeRumbleEnabled(value);
    const manager = getRumbleManager();
    manager.setEnabled(value);
    if (game !== null) {
        game.rumble = manager;
        game.resumeBrowserOnlyRumbles();
    }
}

function updateRumbleUi(rumbleSwitchButton: HTMLButtonElement): void {
    rumbleSwitchButton.setAttribute("aria-pressed", String(rumbleEnabled));
    rumbleSwitchButton.setAttribute("data-enabled", String(rumbleEnabled));
}

function showBoot(progress = 0): void {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const existingProgress = app.querySelector<HTMLElement>("[data-boot-progress='true']");
    if (existingProgress !== null) {
        existingProgress.setAttribute("aria-valuenow", String(percent));
        existingProgress.querySelector<HTMLElement>(".progress-bar")?.style.setProperty("--progress", `${percent}%`);
        return;
    }

    app.innerHTML = `
        <main class="boot-screen" role="status" aria-label="Loading">
            <section class="load-progress-panel" aria-live="polite">
                <div class="progress-shell" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" data-boot-progress="true">
                    <div class="progress-bar" style="--progress: ${percent}%"></div>
                </div>
            </section>
        </main>`;
}

function skullIconMarkup(): string {
    return "&#x1F480;";
}

function showLoadError(title: string, message: string, retryHandler: () => void): void {
    app.innerHTML = `
        <main class="boot-screen boot-failed" role="alert">
            <section class="load-error-panel" aria-label="${escapeHtml(title)}">
                <div class="failure-icon" aria-hidden="true">${skullIconMarkup()}</div>
                <div class="boot-title">${escapeHtml(title)}</div>
                <p class="boot-error">${escapeHtml(message)}</p>
                <button id="retry-button" class="retry-button" type="button">Retry</button>
            </section>
        </main>`;
    document.getElementById("retry-button")?.addEventListener("click", retryHandler);
}

function showError(message: string): void {
    showLoadError("Unable to continue.", message, () => {
        window.location.reload();
    });
}

function showMenu(errorText = ""): void {
    destroyGame();
    renderRootMenu(errorText);
}

function renderRootMenu(errorText = ""): HTMLElement {
    return renderMenu(app, hasPotentialSavedGameState(), errorText, false);
}

function renderMenu(parent: HTMLElement, canContinue: boolean, errorText: string, overlay: boolean): HTMLElement {
    const menu = document.createElement("main");
    menu.className = overlay ? "menu-screen menu-overlay" : "menu-screen";
    if (overlay) {
        menu.dataset.liveMenu = "true";
    }
    menu.innerHTML = `
        <section class="menu-panel" aria-label="Stickvania menu">
            <div class="settings-row">
                <div class="setting-switch-row" role="group" aria-label="Dark mode">
                    <span>Dark</span>
                    <button id="display-switch-button" class="menu-switch" type="button" aria-label="Toggle dark mode" aria-pressed="${displayModePreference === "dark"}" data-enabled="${displayModePreference === "dark"}">
                        <span></span>
                    </button>
                </div>
                <div class="setting-switch-row" role="group" aria-label="Rumble">
                    <span>Rumble</span>
                    <button id="rumble-switch-button" class="menu-switch" type="button" aria-label="Toggle rumble" aria-pressed="${rumbleEnabled}" data-enabled="${rumbleEnabled}">
                        <span></span>
                    </button>
                </div>
            </div>
            <label class="volume-row">
                <span id="volume-icon" class="volume-icon" aria-hidden="true">${volumeIconSvg(volume)}</span>
                <input id="volume-input" type="range" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="Volume">
                <span id="volume-value" class="volume-value">${Math.round(volume * 100)}</span>
            </label>
            <div class="menu-buttons">
                <button id="new-game-button" class="start-button" type="button">New Game</button>
                <button id="continue-button" class="start-button" type="button"${canContinue ? "" : " disabled"}>Continue</button>
            </div>
            ${errorText ? `<p class="error-text">${escapeHtml(errorText)}</p>` : ""}
        </section>`;
    if (overlay) {
        parent.appendChild(menu);
    } else {
        parent.replaceChildren(menu);
    }

    const volumeInput = menu.querySelector("#volume-input") as HTMLInputElement;
    const volumeValue = menu.querySelector("#volume-value") as HTMLElement;
    const volumeIcon = menu.querySelector("#volume-icon") as HTMLElement;
    const displaySwitchButton = menu.querySelector("#display-switch-button") as HTMLButtonElement;
    const rumbleSwitchButton = menu.querySelector("#rumble-switch-button") as HTMLButtonElement;
    const newGameButton = menu.querySelector("#new-game-button") as HTMLButtonElement;
    const continueButton = menu.querySelector("#continue-button") as HTMLButtonElement;
    const handleDisplayModeChange = (value: DisplayModePreference) => {
        setDisplayModePreference(value);
        if (game !== null) {
            game.darkDisplayMode = value === "dark";
        }
        updateDisplayModeUi(displaySwitchButton);
    };
    displaySwitchButton.addEventListener("click", () => handleDisplayModeChange(displayModePreference === "light" ? "dark" : "light"));
    updateDisplayModeUi(displaySwitchButton);
    rumbleSwitchButton.addEventListener("click", () => {
        setRumbleEnabled(!rumbleEnabled);
        updateRumbleUi(rumbleSwitchButton);
    });
    updateRumbleUi(rumbleSwitchButton);
    volumeInput.addEventListener("input", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        updateVolumeUi(volumeInput, volumeValue, volumeIcon);
    });
    updateVolumeUi(volumeInput, volumeValue, volumeIcon);
    newGameButton.addEventListener("click", () => {
        clearStoredGameState();
        setAudioVolume(Number(volumeInput.value) / 100);
        void startGame(false);
    });
    continueButton.addEventListener("click", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        if (hasLiveSuspendedGame()) {
            resumeLiveGameFromMenu();
            return;
        }
        void startGame(true);
    });
    return menu;
}

function showGameShell(): HTMLElement {
    app.innerHTML = `
        <div id="game-shell" class="game-shell">
            <div id="game-host" class="game-host"></div>
            <button id="hamburger-button" class="hamburger-button" type="button" aria-label="Return to menu" hidden>
                <span></span>
            </button>
        </div>`;
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement;
    hamburger.addEventListener("click", returnToMenu);
    activeGameShell = document.getElementById("game-shell") as HTMLElement;
    return document.getElementById("game-host") as HTMLElement;
}

async function startGame(restoreSavedGame: boolean): Promise<void> {
    const audioUnlockPromise = unlockAudio();
    let runtimePrepared = false;
    destroyGame();
    if (preparedRuntime === null) {
        showBoot(preparationProgress);
    }
    try {
        const runtime = await ensureRuntimePrepared(preparationError !== null);
        runtimePrepared = true;
        await audioUnlockPromise;
        if (restoreSavedGame && !getGameStateStore(runtime).hasValidSave()) {
            clearStoredGameState();
            showMenu();
            return;
        }
        await launchPreparedGame(runtime, restoreSavedGame);
    } catch (error) {
        console.error(error);
        destroyGame();
        if (restoreSavedGame && runtimePrepared) {
            clearStoredGameState();
            showMenu();
            return;
        }
        showLoadError("Unable to start.", "Check your connection and try again.", () => {
            void startGame(false);
        });
    }
}

async function launchPreparedGame(runtime: PreparedRuntime, restoreSavedGame: boolean): Promise<void> {
    const host = showGameShell();
    activeGameHost = host;
    runtime.slick.Display.setParent(host);
    const mainGame = new runtime.Main();
    let restoreFailed = false;
    mainGame.darkDisplayMode = displayModePreference === "dark";
    mainGame.rumble = getRumbleManager();
    const scalableGame = new runtime.ScalableGame2(mainGame, GAME_WIDTH, GAME_HEIGHT, true);
    const displayMode = getResponsiveWindowedDisplayMode();
    const appContainer = new runtime.slick.AppGameContainer(scalableGame, displayMode.width, displayMode.height, false);
    appContainer.setPreserveAudioCacheOnDestroy(true);
    appContainer.setLoopSuspended(true);
    appContainer.setHighDpiEnabled(HIGH_DPI_ENABLED);
    appContainer.setMaxDevicePixelRatio(MAX_DEVICE_PIXEL_RATIO);
    container = appContainer;
    game = mainGame;
    mainGame.appGameContainer = appContainer;
    mainGame.scalableGame = scalableGame;
    mainGame.windowedDisplayModeProvider = getResponsiveWindowedDisplayMode;
    mainGame.browserFullscreenController = {
        isFullscreen: isGameShellFullscreen,
        enterFullscreen: enterGameShellFullscreen,
        exitFullscreen: exitGameShellFullscreen
    };
    if (restoreSavedGame) {
        mainGame.loadingCompleteHandler = (gc) => {
            if (!getGameStateStore(runtime).restore(mainGame, gc)) {
                restoreFailed = true;
                return false;
            }
            mainGame.darkDisplayMode = displayModePreference === "dark";
            return true;
        };
    }
    appContainer.setAlwaysRender(true);
    appContainer.setVSync(true);
    appContainer.setSmoothDeltas(false);
    appContainer.setShowFPS(false);
    appContainer.setClearEachFrame(true);
    await Promise.resolve(appContainer.setDisplayMode(displayMode.width, displayMode.height, false));
    await appContainer.start();
    if (restoreFailed) {
        clearStoredGameState();
        destroyGame();
        showMenu();
        return;
    }
    appContainer.setErrorHandler((error) => {
        console.error(error);
        destroyGame();
        showLoadError("Unable to continue.", "Reload the page and try again.", () => {
            window.location.reload();
        });
    });
    startResponsiveGameSizing(host);
    startGameCursorAutoHide(host);
    startHamburgerVisibilityMonitor();
    setAudioVolume(volume);
    getRumbleManager().setEnabled(rumbleEnabled);
    focusGameCanvas();
    applyCurrentGameLifecycleSuspension();
    if (!suspendedByFocusLoss && !suspendedByVisibilityLoss) {
        mainGame.setBrowserSuspended(false);
        appContainer.setLoopSuspended(false);
    }
}

async function ensureRuntimePrepared(forceRetry = false): Promise<PreparedRuntime> {
    if (preparedRuntime !== null) {
        return preparedRuntime;
    }
    if (preparationPromise !== null) {
        return preparationPromise;
    }
    if (forceRetry) {
        preparationError = null;
        preparationProgress = 0;
        refreshVisibleBootProgress();
    } else if (preparationError !== null) {
        throw preparationError;
    }

    await waitForInitialServiceWorkerReady();
    ResourceLoader.clearFailures();
    ResourceLoader.setCacheBust(__BUILD_STAMP__);
    ResourceLoader.setRetryOptions(RESOURCE_CACHE_RETRY_COUNT, RESOURCE_CACHE_RETRY_DELAY_MS);
    preparationPromise = prepareRuntime()
        .then((runtime) => {
            preparedRuntime = runtime;
            preparationError = null;
            preparationProgress = 1;
            refreshVisibleBootProgress();
            return runtime;
        })
        .catch((error) => {
            preparationError = error;
            throw error;
        })
        .finally(() => {
            preparationPromise = null;
        });
    return preparationPromise;
}

async function prepareRuntime(): Promise<PreparedRuntime> {
    const [slick, mainModule, scalableGameModule, gameStateStoreModule, resourceModule] = await Promise.all([
        import("slick2d-ts"),
        import("./stickvania/Main.js"),
        import("./stickvania/ScalableGame2.js"),
        import("./stickvania/persistence/StickvaniaGameStateStore.js"),
        import("./resources.js")
    ]);
    const resourceRefs = Array.from(new Set(resourceModule.STICKVANIA_RESOURCE_REFS));
    await preloadPreparedResources(resourceRefs);
    return {
        slick,
        Main: mainModule.Main,
        ScalableGame2: scalableGameModule.ScalableGame2,
        StickvaniaGameStateStore: gameStateStoreModule.StickvaniaGameStateStore
    };
}

async function preloadPreparedResources(resourceRefs: readonly string[]): Promise<void> {
    const audioRefs = resourceRefs.filter(isAudioResourceRef);
    const nonAudioRefs = resourceRefs.filter((ref) => !isAudioResourceRef(ref));
    const total = audioRefs.length + nonAudioRefs.length;
    let audioLoaded = 0;
    let nonAudioLoaded = 0;
    const updateProgress = () => {
        preparationProgress = total === 0 ? 1 : (audioLoaded + nonAudioLoaded) / total;
        refreshVisibleBootProgress();
    };

    updateProgress();
    await Promise.all([
        ResourceLoader.preloadResources(nonAudioRefs, (progress) => {
            nonAudioLoaded = progress.loaded;
            updateProgress();
        }),
        SoundStore.get().preloadAudioBuffers(audioRefs, (progress) => {
            audioLoaded = progress.loaded;
            updateProgress();
        })
    ]);
    preparationProgress = 1;
    refreshVisibleBootProgress();
}

function scheduleBackgroundPreparation(): void {
    if (backgroundPreparationScheduled || preparedRuntime !== null || preparationPromise !== null || preparationError !== null) {
        return;
    }
    backgroundPreparationScheduled = true;
    requestAnimationFrame(() => {
        window.setTimeout(() => {
            backgroundPreparationScheduled = false;
            void ensureRuntimePrepared().catch((error) => {
                console.warn("Stickvania background preparation failed.", error);
            });
        }, 0);
    });
}

function refreshVisibleBootProgress(): void {
    if (app.querySelector("[data-boot-progress='true']") !== null) {
        showBoot(preparationProgress);
    }
}

function isAudioResourceRef(ref: string): boolean {
    return ref.toLowerCase().endsWith(".ogg");
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
    if (preparedRuntime === null) {
        return null;
    }
    return getGameStateStore(preparedRuntime);
}

function hasPotentialSavedGameState(): boolean {
    return hasPotentialBrowserStoredStickvaniaGameState();
}

function returnToMenu(): void {
    if (canOpenLiveMenuOverlay()) {
        showLiveMenuOverlay();
        return;
    }
    saveCurrentGameState();
    showMenu();
}

function canOpenLiveMenuOverlay(): boolean {
    return (
        game !== null && container !== null && activeGameShell !== null && activeGameHost !== null && game.isStateSaveReady() && game.isLiveMenuOverlayAllowed()
    );
}

function hasLiveSuspendedGame(): boolean {
    return liveMenuOpen && menuOverlay !== null && game !== null && container !== null && activeGameHost !== null;
}

function showLiveMenuOverlay(): void {
    if (!canOpenLiveMenuOverlay() || game === null || container === null || activeGameShell === null) {
        saveCurrentGameState();
        showMenu();
        return;
    }
    removeMenuOverlay();
    liveMenuOpen = true;
    saveCurrentGameState();
    game.setBrowserSuspended(true);
    container.stopSoundEffects();
    getRumbleManager().setSuspended(true);
    container.setLoopSuspended(true);
    container.getInput().pause();
    stopHamburgerVisibilityMonitor();
    hideHamburgerButton();
    stopGameCursorAutoHide();
    menuOverlay = renderMenu(activeGameShell, true, "", true);
}

function resumeLiveGameFromMenu(): void {
    if (!hasLiveSuspendedGame() || game === null || container === null || activeGameHost === null) {
        return;
    }
    const liveGame = game;
    const liveContainer = container;
    const liveHost = activeGameHost;
    removeMenuOverlay();
    liveContainer.getInput().resume();
    liveGame.clearInputPressedRecords();
    liveGame.darkDisplayMode = displayModePreference === "dark";
    startGameCursorAutoHide(liveHost);
    setAudioVolume(volume);
    scheduleResponsiveGameResize();
    focusGameCanvas();
    applyCurrentGameLifecycleSuspension();
    startHamburgerVisibilityMonitor();
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

function focusGameCanvas(): void {
    const canvas = activeGameHost?.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
        return;
    }
    try {
        canvas.focus({ preventScroll: true });
    } catch {
        canvas.focus();
    }
}

function saveCurrentGameState(): boolean {
    if (game === null) {
        return false;
    }
    if (!game.isStateSaveReady()) {
        return false;
    }
    const store = getLoadedGameStateStore();
    if (store === null) {
        return false;
    }
    return store.save(game);
}

function clearStoredGameState(): void {
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY);
    } catch {}
    gameStateStore?.clear();
}

function suspendCurrentGameForPageHide(): void {
    suspendedByVisibilityLoss = true;
    applyCurrentGameLifecycleSuspension();
}

function syncCurrentGameLifecycleSuspension(): void {
    if (game === null) {
        resetLifecycleSuspension();
        return;
    }

    suspendedByVisibilityLoss = document.visibilityState !== "visible";
    suspendedByFocusLoss = !document.hasFocus();
    applyCurrentGameLifecycleSuspension();
}

function handleWindowBlur(): void {
    suspendedByFocusLoss = true;
    applyCurrentGameLifecycleSuspension();
}

function handleWindowFocus(): void {
    suspendedByFocusLoss = false;
    applyCurrentGameLifecycleSuspension();
}

function handleVisibilityChange(): void {
    suspendedByVisibilityLoss = document.visibilityState !== "visible";
    if (!suspendedByVisibilityLoss) {
        suspendedByFocusLoss = !document.hasFocus();
    }
    applyCurrentGameLifecycleSuspension();
}

function applyCurrentGameLifecycleSuspension(): void {
    if (game === null) {
        resetLifecycleSuspension();
        return;
    }
    if (liveMenuOpen) {
        suspendCurrentGameForLifecycle();
        return;
    }
    if (suspendedByVisibilityLoss || suspendedByFocusLoss) {
        suspendCurrentGameForLifecycle();
        return;
    }

    game.setBrowserSuspended(false);
    getRumbleManager().setSuspended(false);
    game.resumeBrowserOnlyRumbles();
    container?.setLoopSuspended(false);
}

function suspendCurrentGameForLifecycle(): void {
    if (game === null) {
        return;
    }
    saveCurrentGameState();
    game.setBrowserSuspended(true);
    container?.stopSoundEffects();
    getRumbleManager().setSuspended(true);
    container?.setLoopSuspended(true);
}

function resetLifecycleSuspension(): void {
    suspendedByFocusLoss = false;
    suspendedByVisibilityLoss = false;
}

function destroyGame(): void {
    resetLifecycleSuspension();
    removeMenuOverlay();
    stopHamburgerVisibilityMonitor();
    stopGameCursorAutoHide();
    stopResponsiveGameSizing();
    game?.stopAllSounds();
    rumbleManager?.setSuspended(true);
    rumbleManager?.stopAll();
    exitGameShellFullscreen();
    if (container !== null) {
        container.destroy();
        container = null;
    } else {
        SoundStore.get().stopAllPlayback();
    }
    game = null;
    activeGameShell = null;
    activeGameHost = null;
    preparedRuntime?.slick.Display.setParent(null);
}

function startResponsiveGameSizing(host: HTMLElement): void {
    stopResponsiveGameSizing();
    activeGameHost = host;
    if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(scheduleResponsiveGameResize);
        resizeObserver.observe(host);
    }
    window.addEventListener("resize", scheduleResponsiveGameResize);
    document.addEventListener("fullscreenchange", scheduleResponsiveGameResize);
    scheduleResponsiveGameResize();
}

function stopResponsiveGameSizing(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener("resize", scheduleResponsiveGameResize);
    document.removeEventListener("fullscreenchange", scheduleResponsiveGameResize);
    if (resizeAnimationFrame !== 0) {
        cancelAnimationFrame(resizeAnimationFrame);
        resizeAnimationFrame = 0;
    }
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
    const fullscreen = isGameShellFullscreen() || container?.isFullscreen() === true;
    const hidden = liveMenuOpen || game === null || fullscreen;
    if (!hidden) {
        applyCurrentGameLifecycleSuspension();
    }
    if (hamburger !== null) {
        hamburger.hidden = hidden;
    }
}

function scheduleResponsiveGameResize(): void {
    if (resizeAnimationFrame !== 0) {
        return;
    }
    resizeAnimationFrame = requestAnimationFrame(() => {
        resizeAnimationFrame = 0;
        applyResponsiveGameDisplayMode();
    });
}

function applyResponsiveGameDisplayMode(): void {
    if (container === null || activeGameHost === null) {
        return;
    }

    const fullscreenElement = document.fullscreenElement;
    const shellFullscreen = fullscreenElement === activeGameShell;
    const containerFullscreen = container.isFullscreen();
    if (!shellFullscreen && !containerFullscreen && fullscreenElement !== null) {
        return;
    }

    const displayMode = containerFullscreen ? getResponsiveFullscreenDisplayMode() : getResponsiveWindowedDisplayMode();
    try {
        void Promise.resolve(container.setDisplayMode(displayMode.width, displayMode.height, containerFullscreen)).catch((error) => {
            console.error(error);
            showError("Unable to resize the game. Reload the page and try again.");
        });
    } catch (error) {
        console.error(error);
        showError("Unable to resize the game. Reload the page and try again.");
    }
}

function getResponsiveWindowedDisplayMode(): { width: number; height: number } {
    const host = activeGameHost ?? document.getElementById("game-host");
    const fallbackDisplayMode = getResponsiveFullscreenDisplayMode();
    if (host === null) {
        return fallbackDisplayMode;
    }

    const rect = host.getBoundingClientRect();
    const width = host.clientWidth || rect.width || fallbackDisplayMode.width;
    const height = host.clientHeight || rect.height || fallbackDisplayMode.height;
    return getAspectFitDisplayMode(width, height);
}

function getResponsiveFullscreenDisplayMode(): { width: number; height: number } {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth || GAME_WIDTH;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight || GAME_HEIGHT;
    return normalizeDisplayMode(width, height);
}

function getAspectFitDisplayMode(width: number, height: number): { width: number; height: number } {
    const displayMode = normalizeDisplayMode(width, height);
    const gameAspectRatio = GAME_VIEWPORT_WIDTH / GAME_VIEWPORT_HEIGHT;
    const displayAspectRatio = displayMode.width / displayMode.height;
    if (displayAspectRatio > gameAspectRatio) {
        return normalizeDisplayMode(displayMode.height * gameAspectRatio, displayMode.height);
    }
    return normalizeDisplayMode(displayMode.width, displayMode.width / gameAspectRatio);
}

function normalizeDisplayMode(width: number, height: number): { width: number; height: number } {
    return {
        width: Math.max(1, Math.trunc(width)),
        height: Math.max(1, Math.trunc(height))
    };
}

function isGameShellFullscreen(): boolean {
    return activeGameShell !== null && document.fullscreenElement === activeGameShell;
}

function enterGameShellFullscreen(): void {
    if (activeGameShell === null || isGameShellFullscreen() || !activeGameShell.requestFullscreen) {
        return;
    }
    void activeGameShell
        .requestFullscreen()
        .then(scheduleResponsiveGameResize)
        .catch((error) => {
            console.error(error);
        });
}

function exitGameShellFullscreen(): void {
    if (!isGameShellFullscreen() || !document.exitFullscreen) {
        return;
    }
    void document
        .exitFullscreen()
        .then(scheduleResponsiveGameResize)
        .catch((error) => {
            console.error(error);
        });
}

function startGameCursorAutoHide(host: HTMLElement): void {
    stopGameCursorAutoHide();
    cursorGameHost = host;
    pointerOverGameHost = isElementHovered(host);
    host.addEventListener("pointerenter", handleGamePointerEnter);
    host.addEventListener("pointerleave", handleGamePointerLeave);
    host.addEventListener("pointermove", handleGameMouseInput);
    host.addEventListener("pointerdown", handleGameMouseInput);
    host.addEventListener("pointerup", handleGameMouseInput);
    host.addEventListener("wheel", handleGameMouseInput, { passive: true });
    showGameCursor();
    scheduleGameCursorHide();
}

function stopGameCursorAutoHide(): void {
    if (cursorGameHost !== null) {
        cursorGameHost.removeEventListener("pointerenter", handleGamePointerEnter);
        cursorGameHost.removeEventListener("pointerleave", handleGamePointerLeave);
        cursorGameHost.removeEventListener("pointermove", handleGameMouseInput);
        cursorGameHost.removeEventListener("pointerdown", handleGameMouseInput);
        cursorGameHost.removeEventListener("pointerup", handleGameMouseInput);
        cursorGameHost.removeEventListener("wheel", handleGameMouseInput);
        cursorGameHost.classList.remove("cursor-hidden");
    }
    clearGameCursorHideTimer();
    pointerOverGameHost = false;
    cursorGameHost = null;
}

function handleGamePointerEnter(): void {
    pointerOverGameHost = true;
    handleGameMouseInput();
}

function handleGamePointerLeave(): void {
    pointerOverGameHost = false;
    showGameCursor();
    clearGameCursorHideTimer();
}

function handleGameMouseInput(): void {
    showGameCursor();
    scheduleGameCursorHide();
}

function scheduleGameCursorHide(): void {
    clearGameCursorHideTimer();
    if (cursorGameHost === null || !pointerOverGameHost) {
        return;
    }
    cursorHideTimer = window.setTimeout(() => {
        cursorHideTimer = 0;
        hideGameCursorIfIdle();
    }, GAME_CURSOR_HIDE_DELAY_MS);
}

function hideGameCursorIfIdle(): void {
    if (cursorGameHost === null || !pointerOverGameHost) {
        showGameCursor();
        return;
    }
    cursorGameHost.classList.add("cursor-hidden");
}

function showGameCursor(): void {
    cursorGameHost?.classList.remove("cursor-hidden");
}

function clearGameCursorHideTimer(): void {
    if (cursorHideTimer !== 0) {
        clearTimeout(cursorHideTimer);
        cursorHideTimer = 0;
    }
}

function isElementHovered(element: HTMLElement): boolean {
    try {
        return element.matches(":hover");
    } catch {
        return false;
    }
}

async function unlockAudio(): Promise<void> {
    await SoundStore.get().unlock();
}

async function registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV || location.protocol === "file:") {
        return;
    }
    const version = encodeURIComponent(`${__APP_VERSION__}-${__BUILD_STAMP__}`);
    await navigator.serviceWorker.register(`${BASE_URL}sw.js?v=${version}`, { scope: BASE_URL });
    await navigator.serviceWorker.ready;
    await waitForServiceWorkerController();
}

async function waitForInitialServiceWorkerReady(): Promise<void> {
    if (initialServiceWorkerReadyPromise === null) {
        return;
    }
    await initialServiceWorkerReadyPromise.catch(() => undefined);
}

async function waitForServiceWorkerController(): Promise<void> {
    if (navigator.serviceWorker.controller !== null) {
        return;
    }
    await new Promise<void>((resolve) => {
        const finish = () => {
            window.clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", finish);
            resolve();
        };
        const timeout = window.setTimeout(finish, 3000);
        navigator.serviceWorker.addEventListener("controllerchange", finish);
    });
}

function startPwaMenu(): void {
    setAudioVolume(volume);
    showMenu();
    window.__stickvaniaBooted = true;
    initialServiceWorkerReadyPromise = registerServiceWorker().catch((error) => {
        console.warn("Service worker registration failed.", error);
    });
    void initialServiceWorkerReadyPromise.finally(scheduleBackgroundPreparation);
}

function setupPageLifecycleHandlers(): void {
    window.addEventListener("pagehide", () => {
        suspendCurrentGameForPageHide();
    });
    window.addEventListener("pageshow", () => {
        syncCurrentGameLifecycleSuspension();
    });
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

async function boot(): Promise<void> {
    app = document.getElementById("app") as HTMLElement;
    setupPageLifecycleHandlers();
    startPwaMenu();
}

function safeReadVolume(): number {
    try {
        const value = Number.parseInt(localStorage.getItem("stickvania-volume") ?? String(Math.round(DEFAULT_VOLUME * 100)), 10);
        if (!Number.isFinite(value)) {
            return DEFAULT_VOLUME;
        }
        return Math.max(0, Math.min(1, value / 100));
    } catch {
        return DEFAULT_VOLUME;
    }
}

function writeVolume(value: number): void {
    try {
        localStorage.setItem("stickvania-volume", String(Math.round(value * 100)));
    } catch {}
}

function safeReadDisplayModePreference(): DisplayModePreference {
    try {
        return localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === "dark" ? "dark" : DEFAULT_DISPLAY_MODE;
    } catch {
        return DEFAULT_DISPLAY_MODE;
    }
}

function writeDisplayModePreference(value: DisplayModePreference): void {
    try {
        localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, value);
    } catch {}
}

function safeReadRumbleEnabled(): boolean {
    try {
        return localStorage.getItem(RUMBLE_STORAGE_KEY) === "true" ? true : DEFAULT_RUMBLE_ENABLED;
    } catch {
        return DEFAULT_RUMBLE_ENABLED;
    }
}

function writeRumbleEnabled(value: boolean): void {
    try {
        localStorage.setItem(RUMBLE_STORAGE_KEY, String(value));
    } catch {}
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
    void boot();
}
