import {
    AL,
    AppGameContainer,
    Display,
    ResourceLoader,
    SoundStore
} from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { ScalableGame2 } from "./stickvania/ScalableGame2.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { STICKVANIA_RESOURCE_REFS } from "./resources.js";
import "./styles.css";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const GAME_VIEWPORT_WIDTH = 512;
const GAME_VIEWPORT_HEIGHT = 416;
const DEFAULT_VOLUME = 0.1;
const BASE_URL = import.meta.env.BASE_URL;
const GAME_CURSOR_HIDE_DELAY_MS = 3000;
type DisplayModePreference = "light" | "dark";
type ScreenTest = "static-loading" | "static-error" | "dynamic-loading" | "dynamic-error";

const DISPLAY_MODE_STORAGE_KEY = "stickvania-display-mode";
const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";

let app: HTMLElement;
let container: AppGameContainer | null = null;
let game: Main | null = null;
let activeGameShell: HTMLElement | null = null;
let activeGameHost: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeAnimationFrame = 0;
let hamburgerVisibilityAnimationFrame = 0;
let cursorGameHost: HTMLElement | null = null;
let cursorHideTimer = 0;
let pointerOverGameHost = false;
let volume = safeReadVolume();
let displayModePreference = safeReadDisplayModePreference();
let runtimeResourcesLoaded = false;
let suspendedByFocusLoss = false;
let suspendedByVisibilityLoss = false;

const gameStateStore = new StickvaniaGameStateStore(__APP_VERSION__);

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
    const waves = Math.round(value * 100) === 0
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

function updateDisplayModeUi(lightButton: HTMLButtonElement, darkButton: HTMLButtonElement): void {
    lightButton.setAttribute("aria-pressed", String(displayModePreference === "light"));
    darkButton.setAttribute("aria-pressed", String(displayModePreference === "dark"));
    document.getElementById("display-switch-button")?.setAttribute("data-mode", displayModePreference);
    document.getElementById("display-switch-button")?.setAttribute("aria-pressed", String(displayModePreference === "dark"));
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

function getScreenTest(): ScreenTest | null {
    const value = new URLSearchParams(window.location.search).get("testScreen");
    switch (value) {
        case "static-loading":
        case "static-error":
        case "dynamic-loading":
        case "dynamic-error":
            return value;
        default:
            return null;
    }
}

function shouldKeepStaticTestScreen(): boolean {
    const screenTest = getScreenTest();
    return screenTest === "static-loading" || screenTest === "static-error";
}

function showDynamicLoadingTestScreen(): void {
    let progress = 0;
    showBoot(progress);
    window.setInterval(() => {
        progress = progress >= 1 ? 0 : Math.min(1, progress + 0.04);
        showBoot(progress);
    }, 160);
}

function showMenu(errorText = ""): void {
    destroyGame();
    const canContinue = gameStateStore.hasValidSave();
    app.innerHTML = `
        <main class="menu-screen">
            <section class="menu-panel" aria-label="Stickvania menu">
                <div class="display-row" role="group" aria-label="Display mode">
                    <button id="display-light-button" class="display-label-button" type="button" aria-pressed="${displayModePreference === "light"}">Light</button>
                    <button id="display-switch-button" class="display-switch" type="button" aria-label="Toggle display mode" aria-pressed="${displayModePreference === "dark"}" data-mode="${displayModePreference}">
                        <span></span>
                    </button>
                    <button id="display-dark-button" class="display-label-button" type="button" aria-pressed="${displayModePreference === "dark"}">Dark</button>
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
            </section>
        </main>`;

    const volumeInput = document.getElementById("volume-input") as HTMLInputElement;
    const volumeValue = document.getElementById("volume-value") as HTMLElement;
    const volumeIcon = document.getElementById("volume-icon") as HTMLElement;
    const displayLightButton = document.getElementById("display-light-button") as HTMLButtonElement;
    const displaySwitchButton = document.getElementById("display-switch-button") as HTMLButtonElement;
    const displayDarkButton = document.getElementById("display-dark-button") as HTMLButtonElement;
    const newGameButton = document.getElementById("new-game-button") as HTMLButtonElement;
    const continueButton = document.getElementById("continue-button") as HTMLButtonElement;
    const handleDisplayModeChange = (value: DisplayModePreference) => {
        setDisplayModePreference(value);
        updateDisplayModeUi(displayLightButton, displayDarkButton);
    };
    displayLightButton.addEventListener("click", () => handleDisplayModeChange("light"));
    displaySwitchButton.addEventListener("click", () => handleDisplayModeChange(displayModePreference === "light" ? "dark" : "light"));
    displayDarkButton.addEventListener("click", () => handleDisplayModeChange("dark"));
    updateDisplayModeUi(displayLightButton, displayDarkButton);
    volumeInput.addEventListener("input", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        updateVolumeUi(volumeInput, volumeValue, volumeIcon);
    });
    updateVolumeUi(volumeInput, volumeValue, volumeIcon);
    newGameButton.addEventListener("click", () => {
        gameStateStore.clear();
        setAudioVolume(Number(volumeInput.value) / 100);
        void startGame(false);
    });
    continueButton.addEventListener("click", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        void startGame(true);
    });
}

function showGameShell(): HTMLElement {
    app.innerHTML = `
        <div id="game-shell" class="game-shell">
            <div id="game-host" class="game-host"></div>
            <button id="hamburger-button" class="hamburger-button" type="button" aria-label="Return to menu" title="Return to menu" hidden>
                <span></span>
            </button>
        </div>`;
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement;
    hamburger.addEventListener("click", returnToMenu);
    activeGameShell = document.getElementById("game-shell") as HTMLElement;
    return document.getElementById("game-host") as HTMLElement;
}

async function startGame(restoreSavedGame: boolean): Promise<void> {
    destroyGame();
    const host = showGameShell();
    activeGameHost = host;
    const showVisibleLoading = !runtimeResourcesLoaded;
    try {
        await unlockAudio();
        Display.setParent(host);
        const mainGame = new Main();
        mainGame.darkDisplayMode = displayModePreference === "dark";
        const scalableGame = new ScalableGame2(mainGame, GAME_WIDTH, GAME_HEIGHT, true);
        const displayMode = getResponsiveWindowedDisplayMode();
        const appContainer = new AppGameContainer(scalableGame, displayMode.width, displayMode.height, false);
        container = appContainer;
        game = mainGame;
        mainGame.stateSaveInvalidatedHandler = clearStoredGameState;
        mainGame.appGameContainer = appContainer;
        mainGame.scalableGame = scalableGame;
        mainGame.windowedDisplayModeProvider = getResponsiveWindowedDisplayMode;
        mainGame.browserFullscreenController = {
            isFullscreen: isGameShellFullscreen,
            enterFullscreen: enterGameShellFullscreen,
            exitFullscreen: exitGameShellFullscreen
        };
        if (showVisibleLoading) {
            mainGame.loadingFinishedHandler = () => {
                runtimeResourcesLoaded = true;
            };
        }
        if (restoreSavedGame) {
            mainGame.loadingCompleteHandler = (gc) => {
                if (!gameStateStore.restore(mainGame, gc)) {
                    throw new Error("Saved game could not be restored.");
                }
                mainGame.darkDisplayMode = displayModePreference === "dark";
                return true;
            };
        }
        appContainer.setErrorHandler(error => {
            console.error(error);
            destroyGame();
            showLoadError("Unable to continue.", "Reload the page and try again.", () => {
                window.location.reload();
            });
        });
        appContainer.setAlwaysRender(true);
        appContainer.setVSync(true);
        appContainer.setSmoothDeltas(false);
        appContainer.setShowFPS(false);
        appContainer.setClearEachFrame(true);
        await Promise.resolve(appContainer.setDisplayMode(displayMode.width, displayMode.height, false));
        await appContainer.start();
        if (!showVisibleLoading) {
            mainGame.completeLoadingImmediately(appContainer);
            await ResourceLoader.waitForAll();
            runtimeResourcesLoaded = true;
        }
        startResponsiveGameSizing(host);
        startGameCursorAutoHide(host);
        startHamburgerVisibilityMonitor();
        setAudioVolume(volume);
    } catch (error) {
        console.error(error);
        destroyGame();
        if (restoreSavedGame) {
            showMenu("Unable to restore the saved game. Start a new game and try again.");
            return;
        }
        showLoadError("Unable to start.", "Check your connection and try again.", () => {
            void startGame(false);
        });
    }
}

function returnToMenu(): void {
    if (game?.isLoadingScreenActive()) {
        return;
    }
    game?.setBrowserSuspended(true);
    saveCurrentGameState();
    showMenu();
}

function saveCurrentGameState(): boolean {
    if (game === null) {
        return false;
    }
    if (game.isStateSaveInvalidatingMenuActive()) {
        clearStoredGameState();
        return false;
    }
    if (!game.isStateSaveReady()) {
        return false;
    }
    return gameStateStore.save(game);
}

function clearStoredGameState(): void {
    gameStateStore.clear();
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
    if (game.isLoadingScreenActive()) {
        return;
    }
    if (suspendedByVisibilityLoss || suspendedByFocusLoss) {
        suspendCurrentGameForLifecycle();
        return;
    }

    game.setBrowserSuspended(false);
    container?.setLoopSuspended(false);
}

function suspendCurrentGameForLifecycle(): void {
    if (game === null || game.isLoadingScreenActive()) {
        return;
    }
    game.setBrowserSuspended(true);
    container?.setLoopSuspended(true);
    saveCurrentGameState();
}

function resetLifecycleSuspension(): void {
    suspendedByFocusLoss = false;
    suspendedByVisibilityLoss = false;
}

function destroyGame(): void {
    resetLifecycleSuspension();
    stopHamburgerVisibilityMonitor();
    stopGameCursorAutoHide();
    stopResponsiveGameSizing();
    game?.stopAllSounds();
    exitGameShellFullscreen();
    if (container !== null) {
        container.destroy();
        container = null;
    } else {
        AL.destroy();
    }
    game = null;
    activeGameShell = null;
    activeGameHost = null;
    Display.setParent(null);
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
    updateHamburgerVisibility();
}

function stopHamburgerVisibilityMonitor(): void {
    if (hamburgerVisibilityAnimationFrame !== 0) {
        cancelAnimationFrame(hamburgerVisibilityAnimationFrame);
        hamburgerVisibilityAnimationFrame = 0;
    }
}

function updateHamburgerVisibility(): void {
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement | null;
    const hidden = game === null || game.isLoadingScreenActive();
    if (!hidden) {
        applyCurrentGameLifecycleSuspension();
    }
    if (hamburger !== null) {
        hamburger.hidden = hidden;
    }
    if (hidden && game !== null) {
        hamburgerVisibilityAnimationFrame = requestAnimationFrame(() => {
            hamburgerVisibilityAnimationFrame = 0;
            updateHamburgerVisibility();
        });
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

    const displayMode = containerFullscreen
        ? getResponsiveFullscreenDisplayMode()
        : getResponsiveWindowedDisplayMode();
    try {
        void Promise.resolve(container.setDisplayMode(displayMode.width, displayMode.height, containerFullscreen))
            .catch(error => {
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
    void activeGameShell.requestFullscreen()
        .then(scheduleResponsiveGameResize)
        .catch(error => {
            console.error(error);
        });
}

function exitGameShellFullscreen(): void {
    if (!isGameShellFullscreen() || !document.exitFullscreen) {
        return;
    }
    void document.exitFullscreen()
        .then(scheduleResponsiveGameResize)
        .catch(error => {
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
    const context = SoundStore.get().getAudioContext();
    if (context !== null && context.state !== "running") {
        await context.resume();
    }
}

async function preloadResources(onProgress: (progress: number) => void): Promise<void> {
    ResourceLoader.clearFailures();
    ResourceLoader.setCacheBust(__BUILD_STAMP__);
    ResourceLoader.setRetryOptions(3, 250);
    const refs = Array.from(new Set(STICKVANIA_RESOURCE_REFS));
    const total = refs.length;
    let loaded = 0;
    if (total === 0) {
        onProgress(1);
        return;
    }
    await Promise.all(refs.map(async ref => {
        await ResourceLoader.loadResource(ref);
        loaded++;
        onProgress(loaded / total);
    }));
}

async function registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV || location.protocol === "file:") {
        return;
    }
    const version = encodeURIComponent(`${__APP_VERSION__}-${__BUILD_STAMP__}`);
    await navigator.serviceWorker.register(`${BASE_URL}sw.js?v=${version}`, { scope: BASE_URL });
}

async function loadStartupResources(): Promise<void> {
    showBoot(0);
    try {
        await preloadResources(showBoot);
        setAudioVolume(volume);
        showMenu();
        void registerServiceWorker().catch(error => console.warn("Service worker registration failed.", error));
    } catch (error) {
        console.error(error);
        showLoadError("Unable to load resources.", "Check your connection and try again.", () => {
            void loadStartupResources();
        });
    }
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
    const screenTest = getScreenTest();
    if (screenTest === "dynamic-loading") {
        showDynamicLoadingTestScreen();
        return;
    }
    if (screenTest === "dynamic-error") {
        showLoadError("Unable to start.", "Check your connection and try again.", () => {
            void loadStartupResources();
        });
        return;
    }

    setupPageLifecycleHandlers();
    await loadStartupResources();
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
    } catch {
    }
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
    } catch {
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (!shouldKeepStaticTestScreen()) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
    } else {
        void boot();
    }
}
