import { DISPLAY_MODE_DEFINITIONS, isDisplayModePreference, type DisplayModePreference } from "../DisplayThemes.js";
import { getBrowserRumbleCapability } from "../rumble/BrowserHaptics.js";
import type { StickvaniaScalingPreference } from "../stickvania/StickvaniaBufferedGame.js";

export type MenuState = {
    canContinue: boolean;
    errorText: string;
    overlay: boolean;
    volume: number;
    displayMode: DisplayModePreference;
    scaling: StickvaniaScalingPreference;
    rumbleEnabled: boolean;
    fullscreen: boolean;
    fullscreenUnavailable: boolean;
};

export type MenuCallbacks = {
    onDisplayModeChange(value: DisplayModePreference): boolean;
    onScalingChange(value: StickvaniaScalingPreference): boolean;
    onRumbleChange(value: boolean): boolean;
    onFullscreenChange(value: boolean): boolean;
    onVolumeInput(value: number): void;
    onVolumeCommit(value: number): boolean;
    onNewGame(): void;
    onContinue(): void;
    onReset(): void;
};

type DisplayModeDefinition = (typeof DISPLAY_MODE_DEFINITIONS)[number];
type ScalingModeDefinition = (typeof SCALING_MODE_DEFINITIONS)[number];

const THEME_PICKER_BREATHING_ROOM_PX = 10;
const SCALING_MODE_DEFINITIONS: readonly { value: StickvaniaScalingPreference; label: string }[] = [
    { value: "smooth", label: "Smooth" },
    { value: "crisp", label: "Crisp" },
    { value: "pixel-perfect", label: "Pixel Perfect" }
];

export function renderMenu(parent: HTMLElement, state: MenuState, callbacks: MenuCallbacks): HTMLElement {
    let currentVolume = state.volume;
    let currentDisplayMode = state.displayMode;
    let currentScaling = state.scaling;
    let currentRumble = state.rumbleEnabled;
    let currentFullscreen = state.fullscreen;
    const rumbleUnavailable = getBrowserRumbleCapability() === "unavailable";
    const rumblePresented = !rumbleUnavailable && currentRumble;
    const fullscreenPresented = !state.fullscreenUnavailable && currentFullscreen;
    const menu = document.createElement("main");
    menu.className = state.overlay ? "menu-screen menu-overlay" : "menu-screen";
    menu.style.visibility = "hidden";
    if (state.overlay) {
        menu.dataset.liveMenu = "true";
    }
    menu.innerHTML = `
        <section class="menu-panel" aria-label="Stickvania menu">
            <div class="settings-row">
                <div class="setting-theme-row" role="group" aria-label="Theme">
                    <span>Theme</span>
                    ${displayModePickerHtml(currentDisplayMode)}
                </div>
                <div class="setting-switch-row" role="group" aria-label="Rumble">
                    <span>Rumble</span>
                    <button id="rumble-switch-button" class="menu-switch rumble-switch" type="button" aria-label="Toggle rumble" aria-pressed="${rumblePresented}" data-enabled="${rumblePresented}"${rumbleUnavailable ? ' disabled title="Rumble is unavailable in this browser"' : ""}><span></span></button>
                </div>
            </div>
            <div class="settings-row settings-fullscreen-scaling-row">
                <div class="setting-switch-row setting-fullscreen-row" role="group" aria-label="Fullscreen">
                    <span>Fullscreen</span>
                    <button id="fullscreen-switch-button" class="menu-switch fullscreen-switch" type="button" aria-label="Toggle fullscreen" aria-pressed="${fullscreenPresented}" data-enabled="${fullscreenPresented}"${state.fullscreenUnavailable ? ' disabled title="Fullscreen is unavailable in this browser"' : ""}><span></span></button>
                </div>
                <div class="setting-scaling-row" role="group" aria-label="Scaling">
                    <span>Scaling</span>
                    ${scalingPickerHtml(currentScaling)}
                </div>
            </div>
            <label class="volume-row">
                <span id="volume-icon" class="volume-icon" aria-hidden="true">${volumeIconSvg(currentVolume)}</span>
                <input id="volume-input" type="range" min="0" max="100" step="1" value="${Math.round(currentVolume * 100)}" aria-label="Volume">
                <span id="volume-value" class="volume-value">${Math.round(currentVolume * 100)}</span>
            </label>
            <div class="menu-buttons">
                <button id="new-game-button" class="start-button" type="button">New Game</button>
                <button id="continue-button" class="start-button" type="button"${state.canContinue ? "" : " disabled"}>Continue</button>
            </div>
            <button id="reset-button" class="reset-button" type="button">Reset</button>
            <p class="error-text" data-menu-error${state.errorText ? "" : " hidden"}>${escapeHtml(state.errorText)}</p>
        </section>`;
    if (state.overlay) {
        parent.appendChild(menu);
    } else {
        parent.replaceChildren(menu);
    }

    const volumeInput = requiredElement<HTMLInputElement>(menu, "#volume-input");
    const volumeValue = requiredElement<HTMLElement>(menu, "#volume-value");
    const volumeIcon = requiredElement<HTMLElement>(menu, "#volume-icon");
    const displayModePicker = requiredElement<HTMLElement>(menu, "#display-mode-picker");
    const displayModeButton = requiredElement<HTMLButtonElement>(menu, "#display-mode-button");
    const displayModePopup = requiredElement<HTMLElement>(menu, "#display-mode-popup");
    const displayModeList = requiredElement<HTMLElement>(menu, "#display-mode-list");
    const displayModeOptions = Array.from(menu.querySelectorAll<HTMLButtonElement>("[data-display-mode]"));
    const scalingPicker = requiredElement<HTMLElement>(menu, "#scaling-picker");
    const scalingButton = requiredElement<HTMLButtonElement>(menu, "#scaling-button");
    const scalingPopup = requiredElement<HTMLElement>(menu, "#scaling-popup");
    const scalingList = requiredElement<HTMLElement>(menu, "#scaling-list");
    const scalingOptions = Array.from(menu.querySelectorAll<HTMLButtonElement>("[data-scaling-mode]"));
    const rumbleSwitchButton = requiredElement<HTMLButtonElement>(menu, "#rumble-switch-button");
    const fullscreenSwitchButton = requiredElement<HTMLButtonElement>(menu, "#fullscreen-switch-button");
    const newGameButton = requiredElement<HTMLButtonElement>(menu, "#new-game-button");
    const continueButton = requiredElement<HTMLButtonElement>(menu, "#continue-button");
    const resetButton = requiredElement<HTMLButtonElement>(menu, "#reset-button");

    measurePickerWidth(
        displayModePicker,
        displayModeButton,
        displayModePopup,
        displayModeList,
        DISPLAY_MODE_DEFINITIONS.map((definition) => definition.label),
        [".theme-swatch", ".picker-caret"],
        [".theme-swatch"]
    );
    measurePickerWidth(
        scalingPicker,
        scalingButton,
        scalingPopup,
        scalingList,
        SCALING_MODE_DEFINITIONS.map((definition) => definition.label),
        [".picker-caret"],
        [".picker-caret-placeholder"]
    );
    menu.style.visibility = "";

    const handleDisplayModeChange = (value: string) => {
        if (!isDisplayModePreference(value)) {
            updateDisplayModeUi(displayModePicker, currentDisplayMode);
            return;
        }
        currentDisplayMode = value;
        if (!callbacks.onDisplayModeChange(value)) {
            showPersistenceError(menu);
        }
        updateDisplayModeUi(displayModePicker, currentDisplayMode);
        setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode);
        displayModeButton.focus();
    };
    displayModeButton.addEventListener("click", () => {
        setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling);
        setPickerOpen(displayModePicker, displayModeButton, displayModePopup, !isPickerOpen(displayModePicker), "display-mode", currentDisplayMode, true);
    });
    displayModeButton.addEventListener("keydown", (event) => {
        if (isPickerOpenKey(event.key)) {
            event.preventDefault();
            setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling);
            setPickerOpen(displayModePicker, displayModeButton, displayModePopup, true, "display-mode", currentDisplayMode, true);
        }
    });
    installPickerListKeyboard(
        displayModeList,
        displayModeOptions,
        displayModeButton,
        () => setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode),
        (option) => handleDisplayModeChange(option.dataset.displayMode ?? "")
    );
    for (const option of displayModeOptions) {
        option.addEventListener("click", () => handleDisplayModeChange(option.dataset.displayMode ?? ""));
    }

    const handleScalingChange = (value: string) => {
        if (!isScalingPreference(value)) {
            updateScalingUi(scalingPicker, currentScaling);
            return;
        }
        currentScaling = value;
        if (!callbacks.onScalingChange(value)) {
            showPersistenceError(menu);
        }
        updateScalingUi(scalingPicker, currentScaling);
        setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling);
        scalingButton.focus();
    };
    scalingButton.addEventListener("click", () => {
        setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode);
        setPickerOpen(scalingPicker, scalingButton, scalingPopup, !isPickerOpen(scalingPicker), "scaling-mode", currentScaling, true);
    });
    scalingButton.addEventListener("keydown", (event) => {
        if (isPickerOpenKey(event.key)) {
            event.preventDefault();
            setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode);
            setPickerOpen(scalingPicker, scalingButton, scalingPopup, true, "scaling-mode", currentScaling, true);
        }
    });
    installPickerListKeyboard(
        scalingList,
        scalingOptions,
        scalingButton,
        () => setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling),
        (option) => handleScalingChange(option.dataset.scalingMode ?? "")
    );
    for (const option of scalingOptions) {
        option.addEventListener("click", () => handleScalingChange(option.dataset.scalingMode ?? ""));
    }

    menu.addEventListener("click", (event) => {
        if (event.target instanceof Node && !displayModePicker.contains(event.target)) {
            setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode);
        }
        if (event.target instanceof Node && !scalingPicker.contains(event.target)) {
            setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling);
        }
    });
    installFocusClose(displayModePicker, () =>
        setPickerOpen(displayModePicker, displayModeButton, displayModePopup, false, "display-mode", currentDisplayMode)
    );
    installFocusClose(scalingPicker, () => setPickerOpen(scalingPicker, scalingButton, scalingPopup, false, "scaling-mode", currentScaling));

    updateDisplayModeUi(displayModePicker, currentDisplayMode);
    updateScalingUi(scalingPicker, currentScaling);
    updateRumbleUi(rumbleSwitchButton, currentRumble);
    updateFullscreenUi(fullscreenSwitchButton, currentFullscreen);
    updateVolumeUi(volumeInput, volumeValue, volumeIcon, currentVolume);

    rumbleSwitchButton.addEventListener("click", () => {
        if (rumbleSwitchButton.disabled) {
            return;
        }
        currentRumble = !currentRumble;
        if (!callbacks.onRumbleChange(currentRumble)) {
            showPersistenceError(menu);
        }
        updateRumbleUi(rumbleSwitchButton, currentRumble);
    });
    fullscreenSwitchButton.addEventListener("click", () => {
        if (fullscreenSwitchButton.disabled) {
            return;
        }
        currentFullscreen = !currentFullscreen;
        if (!callbacks.onFullscreenChange(currentFullscreen)) {
            showPersistenceError(menu);
        }
        updateFullscreenUi(fullscreenSwitchButton, currentFullscreen);
    });
    volumeInput.addEventListener("input", () => {
        currentVolume = Number(volumeInput.value) / 100;
        callbacks.onVolumeInput(currentVolume);
        updateVolumeUi(volumeInput, volumeValue, volumeIcon, currentVolume);
    });
    volumeInput.addEventListener("change", () => {
        currentVolume = Number(volumeInput.value) / 100;
        if (!callbacks.onVolumeCommit(currentVolume)) {
            showPersistenceError(menu);
        }
    });
    newGameButton.addEventListener("click", () => {
        callbacks.onNewGame();
    });
    continueButton.addEventListener("click", () => {
        callbacks.onContinue();
    });
    resetButton.addEventListener("click", callbacks.onReset);
    return menu;
}

function displayModePickerHtml(value: DisplayModePreference): string {
    const selected = getDisplayModeDefinition(value);
    return `<div id="display-mode-picker" class="theme-picker" data-open="false"><button id="display-mode-button" class="theme-picker-button display-mode-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="display-mode-list"><span class="theme-picker-label">${escapeHtml(selected.label)}</span>${displayModeSwatchHtml(selected)}<span class="picker-caret" aria-hidden="true"></span></button><div id="display-mode-popup" class="theme-picker-popup" hidden><div id="display-mode-list" class="theme-picker-list" role="listbox" aria-label="Display theme">${DISPLAY_MODE_DEFINITIONS.map((definition) => `<button class="theme-picker-option" type="button" role="option" aria-selected="${definition.value === value}" data-display-mode="${definition.value}"><span>${escapeHtml(definition.label)}</span>${displayModeSwatchHtml(definition)}</button>`).join("")}</div></div></div>`;
}

function scalingPickerHtml(value: StickvaniaScalingPreference): string {
    const selected = getScalingDefinition(value);
    return `<div id="scaling-picker" class="theme-picker scaling-picker" data-open="false"><button id="scaling-button" class="theme-picker-button scaling-picker-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="scaling-list"><span class="theme-picker-label scaling-picker-label">${escapeHtml(selected.label)}</span><span class="picker-caret" aria-hidden="true"></span></button><div id="scaling-popup" class="theme-picker-popup scaling-picker-popup" hidden><div id="scaling-list" class="theme-picker-list scaling-picker-list" role="listbox" aria-label="Scaling">${SCALING_MODE_DEFINITIONS.map((definition) => `<button class="theme-picker-option scaling-picker-option" type="button" role="option" aria-selected="${definition.value === value}" data-scaling-mode="${definition.value}"><span>${escapeHtml(definition.label)}</span><span class="picker-caret-placeholder" aria-hidden="true"></span></button>`).join("")}</div></div></div>`;
}

function displayModeSwatchHtml(definition: DisplayModeDefinition): string {
    const colors = getDisplayModeSwatchColors(definition);
    return `<span class="theme-swatch" aria-hidden="true" style="--theme-bg: ${colors.background}; --theme-fg: ${colors.drawing};"></span>`;
}

function updateDisplayModeUi(picker: HTMLElement, value: DisplayModePreference): void {
    const definition = getDisplayModeDefinition(value);
    picker.querySelector<HTMLElement>(".theme-picker-label")!.textContent = definition.label;
    const swatch = picker.querySelector<HTMLElement>(".theme-picker-button .theme-swatch");
    if (swatch !== null) {
        const colors = getDisplayModeSwatchColors(definition);
        swatch.style.setProperty("--theme-bg", colors.background);
        swatch.style.setProperty("--theme-fg", colors.drawing);
    }
    for (const option of picker.querySelectorAll<HTMLElement>("[data-display-mode]")) {
        option.setAttribute("aria-selected", String(option.dataset.displayMode === value));
    }
}

function updateScalingUi(picker: HTMLElement, value: StickvaniaScalingPreference): void {
    picker.querySelector<HTMLElement>(".scaling-picker-label")!.textContent = getScalingDefinition(value).label;
    for (const option of picker.querySelectorAll<HTMLElement>("[data-scaling-mode]")) {
        option.setAttribute("aria-selected", String(option.dataset.scalingMode === value));
    }
}

function getDisplayModeDefinition(value: DisplayModePreference): DisplayModeDefinition {
    return DISPLAY_MODE_DEFINITIONS.find((definition) => definition.value === value) ?? DISPLAY_MODE_DEFINITIONS[0];
}

function getScalingDefinition(value: StickvaniaScalingPreference): ScalingModeDefinition {
    return SCALING_MODE_DEFINITIONS.find((definition) => definition.value === value) ?? SCALING_MODE_DEFINITIONS[0];
}

function isScalingPreference(value: unknown): value is StickvaniaScalingPreference {
    return value === "smooth" || value === "crisp" || value === "pixel-perfect";
}

function getDisplayModeSwatchColors(definition: DisplayModeDefinition): { background: string; drawing: string } {
    if (definition.value === "dark") {
        return { background: "#000000", drawing: "#ffffff" };
    }
    if (definition.blackReplacement !== null && definition.whiteReplacement !== null) {
        return { background: rgbToCssHex(definition.whiteReplacement), drawing: rgbToCssHex(definition.blackReplacement) };
    }
    return { background: "#ffffff", drawing: "#000000" };
}

function rgbToCssHex(rgb: readonly [number, number, number]): string {
    return `#${rgb.map((component) => component.toString(16).padStart(2, "0")).join("")}`;
}

function updateRumbleUi(button: HTMLButtonElement, enabled: boolean): void {
    const presented = !button.disabled && enabled;
    button.setAttribute("aria-pressed", String(presented));
    button.setAttribute("data-enabled", String(presented));
}

function updateFullscreenUi(button: HTMLButtonElement, enabled: boolean): void {
    const presented = !button.disabled && enabled;
    button.setAttribute("aria-pressed", String(presented));
    button.setAttribute("data-enabled", String(presented));
}

function updateVolumeUi(input: HTMLInputElement, valueElement: HTMLElement, icon: HTMLElement, volume: number): void {
    const percent = Math.round(volume * 100);
    input.style.setProperty("--thumb-position", `${percent}%`);
    valueElement.textContent = String(percent);
    icon.innerHTML = volumeIconSvg(volume);
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
    return `<svg viewBox="0 0 26 24" focusable="false" aria-hidden="true"><path d="M3 9v6h5l6 5V4L8 9H3z"></path>${waves}</svg>`;
}

function installPickerListKeyboard(
    list: HTMLElement,
    options: HTMLButtonElement[],
    button: HTMLButtonElement,
    close: () => void,
    choose: (option: HTMLButtonElement) => void
): void {
    list.addEventListener("keydown", (event) => {
        const currentIndex = Math.max(
            0,
            options.findIndex((option) => option === document.activeElement)
        );
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            button.focus();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            options[(currentIndex + 1) % options.length]?.focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            options[(currentIndex + options.length - 1) % options.length]?.focus();
        } else if (event.key === "Home") {
            event.preventDefault();
            options[0]?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            options[options.length - 1]?.focus();
        } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            const target = document.activeElement;
            if (target instanceof HTMLButtonElement) {
                choose(target);
            }
        }
    });
}

function installFocusClose(picker: HTMLElement, close: () => void): void {
    picker.addEventListener("focusout", () => {
        window.setTimeout(() => {
            if (!picker.contains(document.activeElement)) {
                close();
            }
        }, 0);
    });
}

function isPickerOpenKey(key: string): boolean {
    return key === " " || key === "Enter" || key === "ArrowDown" || key === "ArrowUp";
}

function isPickerOpen(picker: HTMLElement): boolean {
    return picker.dataset.open === "true";
}

function setPickerOpen(
    picker: HTMLElement,
    button: HTMLButtonElement,
    popup: HTMLElement,
    open: boolean,
    dataName: "display-mode" | "scaling-mode",
    selectedValue: string,
    focusSelected = false
): void {
    picker.dataset.open = String(open);
    button.setAttribute("aria-expanded", String(open));
    popup.hidden = !open;
    if (!open || !focusSelected) {
        return;
    }
    const selected =
        Array.from(popup.querySelectorAll<HTMLElement>(`[data-${dataName}]`)).find((option) => option.dataset[toDatasetName(dataName)] === selectedValue) ??
        popup.querySelector<HTMLElement>(`[data-${dataName}]`);
    selected?.focus();
}

function toDatasetName(dataName: "display-mode" | "scaling-mode"): "displayMode" | "scalingMode" {
    return dataName === "display-mode" ? "displayMode" : "scalingMode";
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
    const wasHidden = popup.hidden;
    popup.hidden = false;
    const buttonStyle = window.getComputedStyle(button);
    const option = list.querySelector<HTMLElement>(".theme-picker-option");
    const optionStyle = option === null ? null : window.getComputedStyle(option);
    const popupStyle = window.getComputedStyle(popup);
    const listStyle = window.getComputedStyle(list);
    const maxLabelWidth = measureWidestPickerLabel(picker, optionStyle ?? buttonStyle, labels);
    const buttonWidth =
        maxLabelWidth +
        parseCssPixels(buttonStyle.columnGap) * buttonAccessorySelectors.length +
        getElementsOuterWidth(button, buttonAccessorySelectors) +
        horizontalSpacing(buttonStyle, true) +
        4;
    const optionWidth =
        option === null || optionStyle === null
            ? 0
            : maxLabelWidth +
              parseCssPixels(optionStyle.columnGap) * optionAccessorySelectors.length +
              getElementsOuterWidth(option, optionAccessorySelectors) +
              horizontalSpacing(optionStyle, false) +
              horizontalSpacing(popupStyle, true) +
              horizontalSpacing(listStyle, true) +
              getElementVerticalScrollbarWidth(list, listStyle) +
              4;
    picker.style.setProperty("--theme-picker-width", `${Math.ceil(Math.max(buttonWidth, optionWidth) + THEME_PICKER_BREATHING_ROOM_PX)}px`);
    popup.hidden = wasHidden;
}

function measureWidestPickerLabel(parent: HTMLElement, style: CSSStyleDeclaration, labels: readonly string[]): number {
    const probe = document.createElement("span");
    Object.assign(probe.style, {
        position: "absolute",
        left: "-10000px",
        top: "0",
        visibility: "hidden",
        whiteSpace: "nowrap",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        letterSpacing: style.letterSpacing
    });
    parent.appendChild(probe);
    let maximum = 0;
    for (const label of labels) {
        probe.textContent = label;
        maximum = Math.max(maximum, probe.getBoundingClientRect().width);
    }
    probe.remove();
    return maximum;
}

function getElementsOuterWidth(parent: HTMLElement, selectors: readonly string[]): number {
    let width = 0;
    for (const selector of selectors) {
        width += parent.querySelector<HTMLElement>(selector)?.getBoundingClientRect().width ?? 0;
    }
    return width;
}

function getElementVerticalScrollbarWidth(element: HTMLElement, style: CSSStyleDeclaration): number {
    return Math.max(0, element.offsetWidth - element.clientWidth - parseCssPixels(style.borderLeftWidth) - parseCssPixels(style.borderRightWidth));
}

function horizontalSpacing(style: CSSStyleDeclaration, includeBorder: boolean): number {
    const border = includeBorder ? parseCssPixels(style.borderLeftWidth) + parseCssPixels(style.borderRightWidth) : 0;
    return parseCssPixels(style.paddingLeft) + parseCssPixels(style.paddingRight) + border;
}

function parseCssPixels(value: string): number {
    const pixels = Number.parseFloat(value);
    return Number.isFinite(pixels) ? pixels : 0;
}

function showPersistenceError(menu: HTMLElement): void {
    const error = menu.querySelector<HTMLElement>("[data-menu-error]");
    if (error !== null) {
        error.textContent = "Unable to save settings in this browser.";
        error.hidden = false;
    }
}

function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
    const element = parent.querySelector<T>(selector);
    if (element === null) {
        throw new Error(`Stickvania menu is missing ${selector}.`);
    }
    return element;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
