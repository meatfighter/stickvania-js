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
const DEFAULT_VOLUME = 0.1;
const BASE_URL = import.meta.env.BASE_URL;
const GAME_CURSOR_HIDE_DELAY_MS = 3000;

let app: HTMLElement;
let container: AppGameContainer | null = null;
let game: Main | null = null;
let activeGameHost: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeAnimationFrame = 0;
let cursorGameHost: HTMLElement | null = null;
let cursorHideTimer = 0;
let pointerOverGameHost = false;
let volume = safeReadVolume();

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

function updateVolumeUi(volumeInput: HTMLInputElement, volumeValue: HTMLElement): void {
    const volumePercent = Math.round(volume * 100);
    volumeInput.style.setProperty("--thumb-position", `${volumePercent}%`);
    volumeValue.textContent = String(volumePercent);
}

function showBoot(): void {
    app.innerHTML = `
        <div class="boot-screen" role="status" aria-label="Loading">
            <div class="boot-dots" aria-hidden="true">
                <span class="boot-dot"></span>
                <span class="boot-dot"></span>
                <span class="boot-dot"></span>
            </div>
            <div class="boot-error"></div>
        </div>`;
}

function showError(message: string): void {
    app.innerHTML = `
        <div class="boot-screen boot-failed" role="alert">
            <div class="boot-error">${escapeHtml(message)}</div>
        </div>`;
}

function showMenu(errorText = ""): void {
    destroyGame();
    const canContinue = gameStateStore.hasValidSave();
    app.innerHTML = `
        <main class="menu-screen">
            <section class="menu-panel" aria-label="Stickvania menu">
                <label class="volume-row">
                    <span>Volume</span>
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
    const newGameButton = document.getElementById("new-game-button") as HTMLButtonElement;
    const continueButton = document.getElementById("continue-button") as HTMLButtonElement;
    volumeInput.addEventListener("input", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        updateVolumeUi(volumeInput, volumeValue);
    });
    updateVolumeUi(volumeInput, volumeValue);
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
        <div id="game-host" class="game-host"></div>
        <button id="hamburger-button" class="hamburger-button" type="button" aria-label="Return to menu" title="Return to menu">
            <span></span>
        </button>`;
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement;
    hamburger.addEventListener("click", returnToMenu);
    return document.getElementById("game-host") as HTMLElement;
}

async function startGame(restoreSavedGame: boolean): Promise<void> {
    destroyGame();
    const host = showGameShell();
    activeGameHost = host;
    try {
        await unlockAudio();
        Display.setParent(host);
        const mainGame = new Main();
        const scalableGame = new ScalableGame2(mainGame, GAME_WIDTH, GAME_HEIGHT, true);
        const displayMode = getResponsiveWindowedDisplayMode();
        const appContainer = new AppGameContainer(scalableGame, displayMode.width, displayMode.height, false);
        container = appContainer;
        game = mainGame;
        mainGame.appGameContainer = appContainer;
        mainGame.scalableGame = scalableGame;
        mainGame.windowedDisplayModeProvider = getResponsiveWindowedDisplayMode;
        if (restoreSavedGame) {
            mainGame.loadingCompleteHandler = (gc) => {
                if (!gameStateStore.restore(mainGame, gc)) {
                    throw new Error("Saved game could not be restored.");
                }
                return true;
            };
        }
        appContainer.setErrorHandler(error => {
            console.error(error);
            showError("Unable to continue. Reload the page and try again.");
        });
        appContainer.setAlwaysRender(true);
        appContainer.setVSync(true);
        appContainer.setSmoothDeltas(false);
        appContainer.setShowFPS(false);
        appContainer.setClearEachFrame(true);
        await Promise.resolve(appContainer.setDisplayMode(displayMode.width, displayMode.height, false));
        await appContainer.start();
        startResponsiveGameSizing(host);
        startGameCursorAutoHide(host);
        setAudioVolume(volume);
    } catch (error) {
        console.error(error);
        destroyGame();
        showMenu(restoreSavedGame
            ? "Unable to restore the saved game. Start a new game and try again."
            : "Unable to start. Check your connection and try again.");
    }
}

function returnToMenu(): void {
    game?.setBrowserSuspended(true);
    saveCurrentGameState();
    showMenu();
}

function saveCurrentGameState(): boolean {
    if (game === null || !game.isStateSaveReady()) {
        return false;
    }
    return gameStateStore.save(game);
}

function suspendCurrentGame(): void {
    if (game === null) {
        return;
    }
    game.setBrowserSuspended(true);
    saveCurrentGameState();
}

function resumeCurrentGame(): void {
    if (document.visibilityState === "visible") {
        game?.setBrowserSuspended(false);
    }
}

function destroyGame(): void {
    stopGameCursorAutoHide();
    stopResponsiveGameSizing();
    game?.stopAllSounds();
    if (container !== null) {
        container.destroy();
        container = null;
    } else {
        AL.destroy();
    }
    game = null;
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

function scheduleResponsiveGameResize(): void {
    if (resizeAnimationFrame !== 0) {
        return;
    }
    resizeAnimationFrame = requestAnimationFrame(() => {
        resizeAnimationFrame = 0;
        applyResponsiveWindowedDisplayMode();
    });
}

function applyResponsiveWindowedDisplayMode(): void {
    if (container === null || activeGameHost === null || container.isFullscreen()
            || document.fullscreenElement !== null) {
        return;
    }

    const displayMode = getResponsiveWindowedDisplayMode();
    try {
        void Promise.resolve(container.setDisplayMode(displayMode.width, displayMode.height, false))
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
    const fallbackWidth = window.innerWidth || GAME_WIDTH;
    const fallbackHeight = window.innerHeight || GAME_HEIGHT;
    if (host === null) {
        return {
            width: Math.max(1, Math.trunc(fallbackWidth)),
            height: Math.max(1, Math.trunc(fallbackHeight))
        };
    }

    const rect = host.getBoundingClientRect();
    const width = host.clientWidth || rect.width || fallbackWidth;
    const height = host.clientHeight || rect.height || fallbackHeight;
    return {
        width: Math.max(1, Math.trunc(width)),
        height: Math.max(1, Math.trunc(height))
    };
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

async function preloadResources(): Promise<void> {
    ResourceLoader.setCacheBust(__BUILD_STAMP__);
    ResourceLoader.setRetryOptions(3, 250);
    for (const ref of STICKVANIA_RESOURCE_REFS) {
        ResourceLoader.loadResource(ref);
    }
    await ResourceLoader.waitForAll();
}

async function registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV || location.protocol === "file:") {
        return;
    }
    const version = encodeURIComponent(`${__APP_VERSION__}-${__BUILD_STAMP__}`);
    await navigator.serviceWorker.register(`${BASE_URL}sw.js?v=${version}`, { scope: BASE_URL });
}

function setupPageLifecycleHandlers(): void {
    window.addEventListener("pagehide", () => {
        suspendCurrentGame();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            resumeCurrentGame();
        } else {
            suspendCurrentGame();
        }
    });
}

async function boot(): Promise<void> {
    app = document.getElementById("app") as HTMLElement;
    setupPageLifecycleHandlers();
    showBoot();
    try {
        await preloadResources();
        setAudioVolume(volume);
        showMenu();
        void registerServiceWorker().catch(error => console.warn("Service worker registration failed.", error));
    } catch (error) {
        console.error(error);
        showError("Unable to load resources. Check your connection and reload.");
    }
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

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
    void boot();
}
