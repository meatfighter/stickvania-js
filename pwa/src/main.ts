import {
    AL,
    AppGameContainer,
    Display,
    ResourceLoader,
    SoundStore
} from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { ScalableGame2 } from "./stickvania/ScalableGame2.js";
import { STICKVANIA_RESOURCE_REFS } from "./resources.js";
import "./styles.css";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const DEFAULT_VOLUME = 0.6;
const BASE_URL = import.meta.env.BASE_URL;

let app: HTMLElement;
let container: AppGameContainer | null = null;
let volume = DEFAULT_VOLUME;

function setAudioVolume(value: number): void {
    volume = Math.max(0, Math.min(1, value));
    // Slick applies sound volume twice on Sound.play(); compensate so this is a master volume.
    SoundStore.get().setSoundVolume(Math.sqrt(volume));
    SoundStore.get().setMusicVolume(volume);
}

function versionedAssetUrl(ref: string): string {
    return `${BASE_URL}${ref.replace(/^\/+/, "")}?v=${encodeURIComponent(__BUILD_STAMP__)}`;
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
            <div class="boot-error">${message}</div>
        </div>`;
}

function showMenu(): void {
    destroyGame();
    app.innerHTML = `
        <section class="menu-screen">
            <div class="menu-panel">
                <img class="menu-title" src="${versionedAssetUrl("images/title_screen.png")}" alt="Stickvania">
                <label class="volume-row">
                    <span>Volume</span>
                    <input id="volume-input" type="range" min="0" max="100" step="1" value="${Math.round(volume * 100)}">
                </label>
                <button id="start-button" type="button">Start</button>
            </div>
        </section>`;

    const volumeInput = document.getElementById("volume-input") as HTMLInputElement;
    const startButton = document.getElementById("start-button") as HTMLButtonElement;
    volumeInput.addEventListener("input", () => setAudioVolume(Number(volumeInput.value) / 100));
    startButton.addEventListener("click", () => {
        setAudioVolume(Number(volumeInput.value) / 100);
        void startGame();
    });
}

function showGameShell(): HTMLElement {
    app.innerHTML = `
        <section class="game-screen">
            <button id="hamburger-button" class="hamburger-button" type="button" aria-label="Return to menu">
                <span></span><span></span><span></span>
            </button>
            <div id="game-host" class="game-host"></div>
        </section>`;
    const hamburger = document.getElementById("hamburger-button") as HTMLButtonElement;
    hamburger.addEventListener("click", showMenu);
    return document.getElementById("game-host") as HTMLElement;
}

async function startGame(): Promise<void> {
    destroyGame();
    const host = showGameShell();
    try {
        Display.setParent(host);
        const game = new Main();
        const scalableGame = new ScalableGame2(game, GAME_WIDTH, GAME_HEIGHT, true);
        container = new AppGameContainer(scalableGame, GAME_WIDTH, GAME_HEIGHT, false);
        game.appGameContainer = container;
        game.scalableGame = scalableGame;
        container.setErrorHandler(error => {
            console.error(error);
            showError("Unable to continue. Reload the page and try again.");
        });
        container.setAlwaysRender(true);
        container.setVSync(true);
        container.setSmoothDeltas(false);
        container.setShowFPS(false);
        container.setClearEachFrame(true);
        await container.start();
    } catch (error) {
        console.error(error);
        showError("Unable to start. Check your connection and reload.");
    }
}

function destroyGame(): void {
    if (container !== null) {
        container.destroy();
        container = null;
    } else {
        AL.destroy();
    }
    Display.setParent(null);
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

async function boot(): Promise<void> {
    app = document.getElementById("app") as HTMLElement;
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
    void boot();
}
