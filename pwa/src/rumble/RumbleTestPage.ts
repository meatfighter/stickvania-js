import { getActuatorDescriptions, getConnectedGamepads, playPulseOnGamepad, silenceGamepads } from "./BrowserHaptics.js";
import { effectSummary, isRumbleDelayStep, RUMBLE_EFFECTS, type RumbleEffect } from "./RumbleEffects.js";

const logElement = document.getElementById("log") as HTMLElement;
const statusElement = document.getElementById("gamepad-status") as HTMLElement;
const targetSelect = document.getElementById("target-select") as HTMLSelectElement;
const effectButtonsElement = document.getElementById("effect-buttons") as HTMLElement;
let playbackToken = 0;

function log(message: string): void {
    const time = new Date().toLocaleTimeString();
    logElement.textContent = `[${time}] ${message}\n${logElement.textContent}`;
}

function renderGamepads(): void {
    const gamepads = getConnectedGamepads();
    const selectedValue = targetSelect.value;
    targetSelect.replaceChildren(new Option("All supported gamepads", "all"));
    for (const gamepad of gamepads) {
        targetSelect.add(new Option(`#${gamepad.index} ${gamepad.id}`, String(gamepad.index)));
    }
    if ([...targetSelect.options].some((option) => option.value == selectedValue)) {
        targetSelect.value = selectedValue;
    }

    if (gamepads.length == 0) {
        statusElement.innerHTML = `<p class="muted">No gamepads visible yet. Press a button on your controller, then refresh.</p>`;
        return;
    }

    statusElement.replaceChildren(
        ...gamepads.map((gamepad) => {
            const card = document.createElement("article");
            card.className = "gamepad-card";
            const actuators = getActuatorDescriptions(gamepad);
            card.innerHTML = `
                <strong>#${gamepad.index} ${escapeHtml(gamepad.id)}</strong>
                <div>Mapping: ${escapeHtml(gamepad.mapping || "unknown")}</div>
                <div>Buttons: ${gamepad.buttons.length}; Axes: ${gamepad.axes.length}</div>
                <div>${actuators.length > 0 ? escapeHtml(actuators.join(" | ")) : "No haptic actuator detected"}</div>`;
            return card;
        })
    );
}

function selectedGamepads(): Gamepad[] {
    const gamepads = getConnectedGamepads();
    if (targetSelect.value == "all") {
        return gamepads;
    }
    const index = Number(targetSelect.value);
    return gamepads.filter((gamepad) => gamepad.index == index);
}

async function playEffectOnGamepad(gamepad: Gamepad, effect: RumbleEffect, token: number): Promise<string> {
    const messages: string[] = [];
    for (const step of effect.pattern) {
        if (token != playbackToken) {
            return "cancelled";
        }
        if (isRumbleDelayStep(step)) {
            await sleep(step.delay);
            continue;
        }
        messages.push(await playPulseOnGamepad(gamepad, step));
    }
    return messages.join("; ");
}

async function playEffect(effect: RumbleEffect): Promise<void> {
    const gamepads = selectedGamepads();
    if (gamepads.length == 0) {
        log(`${effect.label}: no selected gamepad`);
        renderGamepads();
        return;
    }
    const token = ++playbackToken;
    await silenceGamepads(gamepads);
    log(`${effect.label}: ${effectSummary(effect)}`);
    const results = await Promise.all(gamepads.map((gamepad) => playEffectOnGamepad(gamepad, effect, token)));
    if (token != playbackToken) {
        return;
    }
    results.forEach((result, index) => log(`#${gamepads[index].index} ${result}`));
    renderGamepads();
}

async function stopRumble(): Promise<void> {
    playbackToken++;
    await silenceGamepads(getConnectedGamepads());
    log("Stop requested.");
}

function renderEffectButtons(): void {
    effectButtonsElement.replaceChildren(
        ...RUMBLE_EFFECTS.map((effect) => {
            const button = document.createElement("button");
            button.className = "effect-button";
            button.type = "button";
            button.innerHTML = `${escapeHtml(effect.label)}<span>${escapeHtml(effect.description)}</span>`;
            button.addEventListener("click", () => void playEffect(effect));
            return button;
        })
    );
}

function escapeHtml(value: string): string {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

document.getElementById("refresh-button")?.addEventListener("click", () => {
    renderGamepads();
    log("Gamepad list refreshed.");
});
document.getElementById("stop-button")?.addEventListener("click", () => void stopRumble());
window.addEventListener("gamepadconnected", (event) => {
    renderGamepads();
    log(`Connected #${event.gamepad.index}: ${event.gamepad.id}`);
});
window.addEventListener("gamepaddisconnected", (event) => {
    renderGamepads();
    log(`Disconnected #${event.gamepad.index}: ${event.gamepad.id}`);
});

renderEffectButtons();
renderGamepads();
log("Ready. If no gamepad appears, press a controller button and refresh.");
