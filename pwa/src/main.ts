import type { AppGameContainer } from "slick2d-ts/slick/AppGameContainer";
import { SoundStore } from "slick2d-ts/slick/openal/SoundStore";
import { ResourceLoader } from "slick2d-ts/slick/util/ResourceLoader";
import { createDisplayMonochromePalette, DISPLAY_MODE_DEFINITIONS, isDisplayModePreference, type DisplayModePreference } from "./DisplayThemes.js";
import { RumbleManager } from "./rumble/RumbleManager.js";
import { getBrowserStorageKey } from "./stickvania/BrowserStorageKeys.js";
import type { Main } from "./stickvania/Main.js";
import { hasPotentialBrowserStoredStickvaniaGameState } from "./stickvania/persistence/GameStatePreflight.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import type { StickvaniaBufferedGame, StickvaniaScalingPreference } from "./stickvania/StickvaniaBufferedGame.js";
import type { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import "./styles.css";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const GAME_VIEWPORT_WIDTH = 512;
const GAME_VIEWPORT_HEIGHT = 416;
const DEFAULT_VOLUME = 0.1;
const DEFAULT_RUMBLE_ENABLED = true;
const HIGH_DPI_ENABLED = true;
const MAX_DEVICE_PIXEL_RATIO = 2;
const GAME_CURSOR_HIDE_DELAY_MS = 3000;
const RESOURCE_CACHE_RETRY_COUNT = 3;
const RESOURCE_CACHE_RETRY_DELAY_MS = 250;
const THEME_PICKER_BREATHING_ROOM_PX = 10;
type SlickRuntimeModule = typeof import("slick2d-ts");
type MainConstructor = typeof import("./stickvania/Main.js").Main;
type StickvaniaBufferedGameConstructor = typeof import("./stickvania/StickvaniaBufferedGame.js").StickvaniaBufferedGame;
type StickvaniaGameStateStoreConstructor = typeof import("./stickvania/persistence/StickvaniaGameStateStore.js").StickvaniaGameStateStore;

declare global {
    interface Window {
        __stickvaniaBooted?: boolean;
    }
}

type PreparedRuntime = {
    slick: SlickRuntimeModule;
    Main: MainConstructor;
    StickvaniaBufferedGame: StickvaniaBufferedGameConstructor;
    StickvaniaGameStateStore: StickvaniaGameStateStoreConstructor;
};

const VOLUME_STORAGE_KEY = getBrowserStorageKey("volume");
const DISPLAY_MODE_STORAGE_KEY = getBrowserStorageKey("display-mode");
const SCALING_STORAGE_KEY = getBrowserStorageKey("scaling");
const RUMBLE_STORAGE_KEY = getBrowserStorageKey("rumble");
const DIFFICULTY_STORAGE_KEY = getBrowserStorageKey("difficulty");
const INPUT_MAPPING_STORAGE_KEY = getBrowserStorageKey("input-mapping");
const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";
const DEFAULT_SCALING_PREFERENCE: StickvaniaScalingPreference = "crisp";
const PWA_RESET_STORAGE_KEYS = [
    GAME_STATE_STORAGE_KEY,
    VOLUME_STORAGE_KEY,
    DISPLAY_MODE_STORAGE_KEY,
    SCALING_STORAGE_KEY,
    RUMBLE_STORAGE_KEY,
    DIFFICULTY_STORAGE_KEY,
    INPUT_MAPPING_STORAGE_KEY
] as const;
type DisplayModeDefinition = (typeof DISPLAY_MODE_DEFINITIONS)[number];
const SCALING_MODE_DEFINITIONS: readonly { value: StickvaniaScalingPreference; label: string }[] = [
    { value: "smooth", label: "Smooth" },
    { value: "crisp", label: "Crisp" },
    { value: "pixel-perfect", label: "Pixel Perfect" }
];
type ScalingModeDefinition = (typeof SCALING_MODE_DEFINITIONS)[number];

let app: HTMLElement;
let container: AppGameContainer | null = null;
let game: Main | null = null;
let activeBufferedGame: StickvaniaBufferedGame | null = null;
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
let scalingPreference = safeReadScalingPreference();
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
    volume = clampVolume(value);
    writeVolume(volume);
    applyAudioVolume(volume);
}

function applyAudioVolume(value: number): void {
    const clampedValue = clampVolume(value);
    // Slick applies sound volume twice on Sound.play(); compensate so this is a master volume.
    SoundStore.get().setSoundVolume(Math.sqrt(clampedValue));
    SoundStore.get().setMusicVolume(clampedValue);
    container?.setSoundVolume(Math.sqrt(clampedValue));
    container?.setMusicVolume(clampedValue);
}

function clampVolume(value: number): number {
    return Math.max(0, Math.min(1, value));
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

function applyDisplayModePreference(target: Main): void {
    target.darkDisplayMode = displayModePreference === "dark";
    target.displayMonochromePalette = createDisplayMonochromePalette(displayModePreference);
}

function updateDisplayModeUi(displayModePicker: HTMLElement): void {
    const selectedDefinition = getDisplayModeDefinition(displayModePreference);
    const selectedLabel = displayModePicker.querySelector<HTMLElement>(".theme-picker-label");
    const selectedSwatch = displayModePicker.querySelector<HTMLElement>(".theme-picker-button .theme-swatch");
    if (selectedLabel !== null) {
        selectedLabel.textContent = selectedDefinition.label;
    }
    if (selectedSwatch !== null) {
        applyDisplayModeSwatchStyle(selectedSwatch, selectedDefinition);
    }
    for (const option of displayModePicker.querySelectorAll<HTMLElement>("[data-display-mode]")) {
        option.setAttribute("aria-selected", String(option.dataset.displayMode === displayModePreference));
    }
}

function displayModePickerHtml(): string {
    const selectedDefinition = getDisplayModeDefinition(displayModePreference);
    return `
        <div id="display-mode-picker" class="theme-picker" data-open="false">
            <button id="display-mode-button" class="theme-picker-button display-mode-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="display-mode-list">
                <span class="theme-picker-label">${escapeHtml(selectedDefinition.label)}</span>
                ${displayModeSwatchHtml(selectedDefinition)}
                <span class="picker-caret" aria-hidden="true"></span>
            </button>
            <div id="display-mode-popup" class="theme-picker-popup" hidden>
                <div id="display-mode-list" class="theme-picker-list" role="listbox" aria-label="Display theme">
                    ${DISPLAY_MODE_DEFINITIONS.map((definition) => displayModeOptionHtml(definition)).join("")}
                </div>
            </div>
        </div>`;
}

function displayModeOptionHtml(definition: DisplayModeDefinition): string {
    return `
        <button class="theme-picker-option" type="button" role="option" aria-selected="${definition.value === displayModePreference}" data-display-mode="${definition.value}">
            <span>${escapeHtml(definition.label)}</span>
            ${displayModeSwatchHtml(definition)}
        </button>`;
}

function displayModeSwatchHtml(definition: DisplayModeDefinition): string {
    const colors = getDisplayModeSwatchColors(definition);
    return `<span class="theme-swatch" aria-hidden="true" style="--theme-bg: ${colors.background}; --theme-fg: ${colors.drawing};"></span>`;
}

function applyDisplayModeSwatchStyle(swatch: HTMLElement, definition: DisplayModeDefinition): void {
    const colors = getDisplayModeSwatchColors(definition);
    swatch.style.setProperty("--theme-bg", colors.background);
    swatch.style.setProperty("--theme-fg", colors.drawing);
}

function getDisplayModeDefinition(value: DisplayModePreference): DisplayModeDefinition {
    return DISPLAY_MODE_DEFINITIONS.find((definition) => definition.value === value) ?? DISPLAY_MODE_DEFINITIONS[0];
}

function getDisplayModeSwatchColors(definition: DisplayModeDefinition): { background: string; drawing: string } {
    if (definition.value === "dark") {
        return { background: "#000000", drawing: "#ffffff" };
    }
    if (definition.blackReplacement !== null && definition.whiteReplacement !== null) {
        return {
            background: rgbToCssHex(definition.whiteReplacement),
            drawing: rgbToCssHex(definition.blackReplacement)
        };
    }
    return { background: "#ffffff", drawing: "#000000" };
}

function rgbToCssHex(rgb: readonly [number, number, number]): string {
    return `#${rgb.map((component) => component.toString(16).padStart(2, "0")).join("")}`;
}

function setScalingPreference(value: StickvaniaScalingPreference): void {
    scalingPreference = value;
    writeScalingPreference(value);
    activeBufferedGame?.setScalingPreference(value);
}

function updateScalingUi(scalingPicker: HTMLElement): void {
    const selectedDefinition = getScalingDefinition(scalingPreference);
    const selectedLabel = scalingPicker.querySelector<HTMLElement>(".scaling-picker-label");
    if (selectedLabel !== null) {
        selectedLabel.textContent = selectedDefinition.label;
    }
    for (const option of scalingPicker.querySelectorAll<HTMLElement>("[data-scaling-mode]")) {
        option.setAttribute("aria-selected", String(option.dataset.scalingMode === scalingPreference));
    }
}

function scalingPickerHtml(): string {
    const selectedDefinition = getScalingDefinition(scalingPreference);
    return `
        <div id="scaling-picker" class="theme-picker scaling-picker" data-open="false">
            <button id="scaling-button" class="theme-picker-button scaling-picker-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="scaling-list">
                <span class="theme-picker-label scaling-picker-label">${escapeHtml(selectedDefinition.label)}</span>
                <span class="picker-caret" aria-hidden="true"></span>
            </button>
            <div id="scaling-popup" class="theme-picker-popup scaling-picker-popup" hidden>
                <div id="scaling-list" class="theme-picker-list scaling-picker-list" role="listbox" aria-label="Scaling">
                    ${SCALING_MODE_DEFINITIONS.map((definition) => scalingOptionHtml(definition)).join("")}
                </div>
            </div>
        </div>`;
}

function scalingOptionHtml(definition: ScalingModeDefinition): string {
    return `
        <button class="theme-picker-option scaling-picker-option" type="button" role="option" aria-selected="${definition.value === scalingPreference}" data-scaling-mode="${definition.value}">
            <span>${escapeHtml(definition.label)}</span>
            <span class="picker-caret-placeholder" aria-hidden="true"></span>
        </button>`;
}

function getScalingDefinition(value: StickvaniaScalingPreference): ScalingModeDefinition {
    return SCALING_MODE_DEFINITIONS.find((definition) => definition.value === value) ?? SCALING_MODE_DEFINITIONS[0];
}

function isScalingPreference(value: unknown): value is StickvaniaScalingPreference {
    return typeof value === "string" && SCALING_MODE_DEFINITIONS.some((definition) => definition.value === value);
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
    destroyGame();
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
    menu.style.visibility = "hidden";
    if (overlay) {
        menu.dataset.liveMenu = "true";
    }
    menu.innerHTML = `
        <section class="menu-panel" aria-label="Stickvania menu">
            <div class="settings-row">
                <div class="setting-theme-row" role="group" aria-label="Theme">
                    <span>Theme</span>
                    ${displayModePickerHtml()}
                </div>
                <div class="setting-switch-row" role="group" aria-label="Rumble">
                    <span>Rumble</span>
                    <button id="rumble-switch-button" class="menu-switch" type="button" aria-label="Toggle rumble" aria-pressed="${rumbleEnabled}" data-enabled="${rumbleEnabled}">
                        <span></span>
                    </button>
                </div>
            </div>
            <div class="setting-scaling-row" role="group" aria-label="Scaling">
                <span>Scaling</span>
                ${scalingPickerHtml()}
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
            <button id="reset-button" class="reset-button" type="button">Reset</button>
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
    const displayModePicker = menu.querySelector("#display-mode-picker") as HTMLElement;
    const displayModeButton = menu.querySelector("#display-mode-button") as HTMLButtonElement;
    const displayModePopup = menu.querySelector("#display-mode-popup") as HTMLElement;
    const displayModeList = menu.querySelector("#display-mode-list") as HTMLElement;
    const displayModeOptions = Array.from(menu.querySelectorAll<HTMLButtonElement>("[data-display-mode]"));
    const scalingPicker = menu.querySelector("#scaling-picker") as HTMLElement;
    const scalingButton = menu.querySelector("#scaling-button") as HTMLButtonElement;
    const scalingPopup = menu.querySelector("#scaling-popup") as HTMLElement;
    const scalingList = menu.querySelector("#scaling-list") as HTMLElement;
    const scalingOptions = Array.from(menu.querySelectorAll<HTMLButtonElement>("[data-scaling-mode]"));
    const rumbleSwitchButton = menu.querySelector("#rumble-switch-button") as HTMLButtonElement;
    const newGameButton = menu.querySelector("#new-game-button") as HTMLButtonElement;
    const continueButton = menu.querySelector("#continue-button") as HTMLButtonElement;
    const resetButton = menu.querySelector("#reset-button") as HTMLButtonElement;
    measureDisplayModePickerWidth(displayModePicker, displayModeButton, displayModePopup, displayModeList);
    measureScalingPickerWidth(scalingPicker, scalingButton, scalingPopup, scalingList);
    menu.style.visibility = "";
    const handleDisplayModeChange = (value: string) => {
        if (!isDisplayModePreference(value)) {
            updateDisplayModeUi(displayModePicker);
            return;
        }
        setDisplayModePreference(value);
        if (game !== null) {
            applyDisplayModePreference(game);
        }
        updateDisplayModeUi(displayModePicker);
        setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
        displayModeButton.focus();
    };
    displayModeButton.addEventListener("click", () => {
        setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
        setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, !isDisplayModePickerOpen(displayModePicker), true);
    });
    displayModeButton.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
            setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, true, true);
        }
    });
    displayModeList.addEventListener("keydown", (event) => {
        const currentIndex = Math.max(
            0,
            displayModeOptions.findIndex((option) => option === document.activeElement)
        );
        if (event.key === "Escape") {
            event.preventDefault();
            setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
            displayModeButton.focus();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            displayModeOptions[(currentIndex + 1) % displayModeOptions.length]?.focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            displayModeOptions[(currentIndex + displayModeOptions.length - 1) % displayModeOptions.length]?.focus();
        } else if (event.key === "Home") {
            event.preventDefault();
            displayModeOptions[0]?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            displayModeOptions[displayModeOptions.length - 1]?.focus();
        } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            const target = document.activeElement;
            if (target instanceof HTMLElement) {
                handleDisplayModeChange(target.dataset.displayMode ?? "");
            }
        }
    });
    for (const option of displayModeOptions) {
        option.addEventListener("click", () => handleDisplayModeChange(option.dataset.displayMode ?? ""));
    }
    const handleScalingChange = (value: string) => {
        if (!isScalingPreference(value)) {
            updateScalingUi(scalingPicker);
            return;
        }
        setScalingPreference(value);
        updateScalingUi(scalingPicker);
        setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
        scalingButton.focus();
    };
    scalingButton.addEventListener("click", () => {
        setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
        setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, !isScalingPickerOpen(scalingPicker), true);
    });
    scalingButton.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
            setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, true, true);
        }
    });
    scalingList.addEventListener("keydown", (event) => {
        const currentIndex = Math.max(
            0,
            scalingOptions.findIndex((option) => option === document.activeElement)
        );
        if (event.key === "Escape") {
            event.preventDefault();
            setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
            scalingButton.focus();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            scalingOptions[(currentIndex + 1) % scalingOptions.length]?.focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            scalingOptions[(currentIndex + scalingOptions.length - 1) % scalingOptions.length]?.focus();
        } else if (event.key === "Home") {
            event.preventDefault();
            scalingOptions[0]?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            scalingOptions[scalingOptions.length - 1]?.focus();
        } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            const target = document.activeElement;
            if (target instanceof HTMLElement) {
                handleScalingChange(target.dataset.scalingMode ?? "");
            }
        }
    });
    for (const option of scalingOptions) {
        option.addEventListener("click", () => handleScalingChange(option.dataset.scalingMode ?? ""));
    }
    menu.addEventListener("click", (event) => {
        if (event.target instanceof Node && !displayModePicker.contains(event.target)) {
            setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
        }
        if (event.target instanceof Node && !scalingPicker.contains(event.target)) {
            setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
        }
    });
    displayModePicker.addEventListener("focusout", () => {
        window.setTimeout(() => {
            if (!displayModePicker.contains(document.activeElement)) {
                setDisplayModePickerOpen(displayModePicker, displayModeButton, displayModePopup, false);
            }
        }, 0);
    });
    scalingPicker.addEventListener("focusout", () => {
        window.setTimeout(() => {
            if (!scalingPicker.contains(document.activeElement)) {
                setScalingPickerOpen(scalingPicker, scalingButton, scalingPopup, false);
            }
        }, 0);
    });
    updateDisplayModeUi(displayModePicker);
    updateScalingUi(scalingPicker);
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
    resetButton.addEventListener("click", resetPwaState);
    return menu;
}

function resetPwaState(): void {
    destroyGame();
    clearPwaStorage();
    volume = DEFAULT_VOLUME;
    displayModePreference = DEFAULT_DISPLAY_MODE;
    scalingPreference = DEFAULT_SCALING_PREFERENCE;
    rumbleEnabled = DEFAULT_RUMBLE_ENABLED;
    applyAudioVolume(volume);
    const manager = getRumbleManager();
    manager.setEnabled(rumbleEnabled);
    manager.setSuspended(false);
    renderRootMenu();
}

function clearPwaStorage(): void {
    for (const key of PWA_RESET_STORAGE_KEYS) {
        try {
            localStorage.removeItem(key);
        } catch {}
    }
}

function measureDisplayModePickerWidth(
    displayModePicker: HTMLElement,
    displayModeButton: HTMLButtonElement,
    displayModePopup: HTMLElement,
    displayModeList: HTMLElement
): void {
    measurePickerWidth(
        displayModePicker,
        displayModeButton,
        displayModePopup,
        displayModeList,
        DISPLAY_MODE_DEFINITIONS.map((definition) => definition.label),
        [".theme-swatch", ".picker-caret"],
        [".theme-swatch"]
    );
}

function measureScalingPickerWidth(scalingPicker: HTMLElement, scalingButton: HTMLButtonElement, scalingPopup: HTMLElement, scalingList: HTMLElement): void {
    measurePickerWidth(
        scalingPicker,
        scalingButton,
        scalingPopup,
        scalingList,
        SCALING_MODE_DEFINITIONS.map((definition) => definition.label),
        [".picker-caret"],
        [".picker-caret-placeholder"]
    );
}

function measurePickerWidth(
    picker: HTMLElement,
    button: HTMLButtonElement,
    popup: HTMLElement,
    list: HTMLElement,
    labels: readonly string[],
    buttonAccessorySelectors: readonly string[],
    optionAccessorySelectors: readonly string[]
): void {
    const wasPopupHidden = popup.hidden;
    popup.hidden = false;
    const buttonStyle = window.getComputedStyle(button);
    const option = list.querySelector<HTMLElement>(".theme-picker-option");
    const optionStyle = option === null ? null : window.getComputedStyle(option);
    const popupStyle = window.getComputedStyle(popup);
    const listStyle = window.getComputedStyle(list);
    const buttonAccessoryWidth = getElementsOuterWidth(button, buttonAccessorySelectors);
    const optionAccessoryWidth = option === null ? 0 : getElementsOuterWidth(option, optionAccessorySelectors);
    const maxLabelWidth = measureWidestPickerLabel(picker, optionStyle ?? buttonStyle, labels);
    const scrollbarWidth = getElementVerticalScrollbarWidth(list, listStyle);
    const buttonWidth =
        maxLabelWidth +
        parseCssPixels(buttonStyle.columnGap) * buttonAccessorySelectors.length +
        buttonAccessoryWidth +
        horizontalSpacing(buttonStyle, true) +
        4;
    const optionWidth =
        optionStyle === null
            ? 0
            : maxLabelWidth +
              parseCssPixels(optionStyle.columnGap) * optionAccessorySelectors.length +
              optionAccessoryWidth +
              horizontalSpacing(optionStyle, false) +
              horizontalSpacing(popupStyle, true) +
              horizontalSpacing(listStyle, true) +
              scrollbarWidth +
              4;
    picker.style.setProperty("--theme-picker-width", `${Math.ceil(Math.max(buttonWidth, optionWidth) + THEME_PICKER_BREATHING_ROOM_PX)}px`);
    popup.hidden = wasPopupHidden;
}

function measureWidestPickerLabel(parent: HTMLElement, style: CSSStyleDeclaration, labels: readonly string[]): number {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.left = "-10000px";
    probe.style.top = "0";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "nowrap";
    probe.style.fontFamily = style.fontFamily;
    probe.style.fontSize = style.fontSize;
    probe.style.fontWeight = style.fontWeight;
    probe.style.fontStyle = style.fontStyle;
    probe.style.letterSpacing = style.letterSpacing;
    parent.appendChild(probe);
    let maxLabelWidth = 0;
    for (const label of labels) {
        probe.textContent = label;
        maxLabelWidth = Math.max(maxLabelWidth, probe.getBoundingClientRect().width);
    }
    probe.remove();
    return maxLabelWidth;
}

function getElementOuterWidth(element: HTMLElement | null): number {
    return element?.getBoundingClientRect().width ?? 0;
}

function getElementsOuterWidth(parent: HTMLElement, selectors: readonly string[]): number {
    return selectors.reduce((width, selector) => width + getElementOuterWidth(parent.querySelector<HTMLElement>(selector)), 0);
}

function getElementVerticalScrollbarWidth(element: HTMLElement, style: CSSStyleDeclaration): number {
    const borderWidth = parseCssPixels(style.borderLeftWidth) + parseCssPixels(style.borderRightWidth);
    return Math.max(0, element.offsetWidth - element.clientWidth - borderWidth);
}

function horizontalSpacing(style: CSSStyleDeclaration, includeBorder: boolean): number {
    const borderWidth = includeBorder ? parseCssPixels(style.borderLeftWidth) + parseCssPixels(style.borderRightWidth) : 0;
    return parseCssPixels(style.paddingLeft) + parseCssPixels(style.paddingRight) + borderWidth;
}

function parseCssPixels(value: string): number {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}

function isDisplayModePickerOpen(displayModePicker: HTMLElement): boolean {
    return displayModePicker.dataset.open === "true";
}

function setDisplayModePickerOpen(
    displayModePicker: HTMLElement,
    displayModeButton: HTMLButtonElement,
    displayModePopup: HTMLElement,
    open: boolean,
    focusSelected = false
): void {
    displayModePicker.dataset.open = String(open);
    displayModeButton.setAttribute("aria-expanded", String(open));
    displayModePopup.hidden = !open;
    if (!open || !focusSelected) {
        return;
    }

    const displayModeList = displayModePopup.querySelector<HTMLElement>("#display-mode-list") as HTMLElement;
    const selectedOption =
        Array.from(displayModeList.querySelectorAll<HTMLElement>("[data-display-mode]")).find(
            (option) => option.dataset.displayMode === displayModePreference
        ) ?? displayModeList.querySelector<HTMLElement>("[data-display-mode]");
    selectedOption?.focus();
}

function isScalingPickerOpen(scalingPicker: HTMLElement): boolean {
    return scalingPicker.dataset.open === "true";
}

function setScalingPickerOpen(
    scalingPicker: HTMLElement,
    scalingButton: HTMLButtonElement,
    scalingPopup: HTMLElement,
    open: boolean,
    focusSelected = false
): void {
    scalingPicker.dataset.open = String(open);
    scalingButton.setAttribute("aria-expanded", String(open));
    scalingPopup.hidden = !open;
    if (!open || !focusSelected) {
        return;
    }

    const scalingList = scalingPopup.querySelector<HTMLElement>("#scaling-list") as HTMLElement;
    const selectedOption =
        Array.from(scalingList.querySelectorAll<HTMLElement>("[data-scaling-mode]")).find((option) => option.dataset.scalingMode === scalingPreference) ??
        scalingList.querySelector<HTMLElement>("[data-scaling-mode]");
    selectedOption?.focus();
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
    destroyGame();
    if (preparedRuntime === null) {
        showBoot(preparationProgress);
    }
    try {
        const runtime = await ensureRuntimePrepared(preparationError !== null);
        await audioUnlockPromise;
        if (restoreSavedGame && !getGameStateStore(runtime).hasValidSave()) {
            showMenu("Unable to restore the saved game. Try Continue again or start a new game.");
            return;
        }
        await launchPreparedGame(runtime, restoreSavedGame);
    } catch (error) {
        console.error(error);
        destroyGame();
        showLoadError("Unable to start.", "Check your connection and try again.", () => {
            void startGame(restoreSavedGame);
        });
    }
}

async function launchPreparedGame(runtime: PreparedRuntime, restoreSavedGame: boolean): Promise<void> {
    const host = showGameShell();
    activeGameHost = host;
    runtime.slick.Display.setParent(host);
    const mainGame = new runtime.Main();
    let restoreFailed = false;
    applyDisplayModePreference(mainGame);
    mainGame.rumble = getRumbleManager();
    const bufferedGame = new runtime.StickvaniaBufferedGame(mainGame, scalingPreference);
    const displayMode = getResponsiveWindowedDisplayMode();
    const appContainer = new runtime.slick.AppGameContainer(bufferedGame, displayMode.width, displayMode.height, false);
    appContainer.setPreserveAudioCacheOnDestroy(true);
    appContainer.setLoopSuspended(true);
    appContainer.setHighDpiEnabled(HIGH_DPI_ENABLED);
    appContainer.setMaxDevicePixelRatio(MAX_DEVICE_PIXEL_RATIO);
    container = appContainer;
    game = mainGame;
    activeBufferedGame = bufferedGame;
    mainGame.appGameContainer = appContainer;
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
    await appContainer.start();
    if (restoreFailed) {
        destroyGame();
        showMenu("Unable to restore the saved game. Try Continue again or start a new game.");
        return;
    }
    appContainer.setErrorHandler((error: unknown) => {
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
    ResourceLoader.setCacheBust(__CACHE_VERSION__);
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
    const [slick, mainModule, bufferedGameModule, gameStateStoreModule, resourceModule] = await Promise.all([
        import("slick2d-ts"),
        import("./stickvania/Main.js"),
        import("./stickvania/StickvaniaBufferedGame.js"),
        import("./stickvania/persistence/StickvaniaGameStateStore.js"),
        import("./resources.js")
    ]);
    const resourceRefs = Array.from(new Set(resourceModule.STICKVANIA_RESOURCE_REFS));
    await preloadPreparedResources(resourceRefs);
    return {
        slick,
        Main: mainModule.Main,
        StickvaniaBufferedGame: bufferedGameModule.StickvaniaBufferedGame,
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
        ResourceLoader.preloadResources(nonAudioRefs, (progress: { loaded: number }) => {
            nonAudioLoaded = progress.loaded;
            updateProgress();
        }),
        SoundStore.get().preloadAudioBuffers(audioRefs, (progress: { loaded: number }) => {
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
    applyDisplayModePreference(liveGame);
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
    activeBufferedGame = null;
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
    const version = encodeURIComponent(__CACHE_VERSION__);
    const serviceWorkerUrl = new URL(`./sw.js?v=${version}`, window.location.href);
    await navigator.serviceWorker.register(serviceWorkerUrl.href, { scope: "./" });
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
    applyAudioVolume(volume);
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
        const value = Number.parseInt(localStorage.getItem(VOLUME_STORAGE_KEY) ?? String(Math.round(DEFAULT_VOLUME * 100)), 10);
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
        localStorage.setItem(VOLUME_STORAGE_KEY, String(Math.round(value * 100)));
    } catch {}
}

function safeReadDisplayModePreference(): DisplayModePreference {
    try {
        const value = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
        if (isDisplayModePreference(value)) {
            return value;
        }
        if (value !== null) {
            writeDisplayModePreference(DEFAULT_DISPLAY_MODE);
        }
        return DEFAULT_DISPLAY_MODE;
    } catch {
        return DEFAULT_DISPLAY_MODE;
    }
}

function writeDisplayModePreference(value: DisplayModePreference): void {
    try {
        localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, value);
    } catch {}
}

function safeReadScalingPreference(): StickvaniaScalingPreference {
    try {
        const value = localStorage.getItem(SCALING_STORAGE_KEY);
        if (isScalingPreference(value)) {
            return value;
        }
        if (value !== null) {
            writeScalingPreference(DEFAULT_SCALING_PREFERENCE);
        }
        return DEFAULT_SCALING_PREFERENCE;
    } catch {
        return DEFAULT_SCALING_PREFERENCE;
    }
}

function writeScalingPreference(value: StickvaniaScalingPreference): void {
    try {
        localStorage.setItem(SCALING_STORAGE_KEY, value);
    } catch {}
}

function safeReadRumbleEnabled(): boolean {
    try {
        const value = localStorage.getItem(RUMBLE_STORAGE_KEY);
        if (value === "true") {
            return true;
        }
        if (value === "false") {
            return false;
        }
        return DEFAULT_RUMBLE_ENABLED;
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
