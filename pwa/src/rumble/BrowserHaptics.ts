import type { RumblePulseStep } from "./RumbleEffects.js";

type DualRumbleParameters = {
    readonly startDelay?: number;
    readonly duration: number;
    readonly strongMagnitude: number;
    readonly weakMagnitude: number;
};

type HapticActuator = {
    readonly effects?: readonly string[];
    playEffect?(effect: string, params: DualRumbleParameters): Promise<unknown>;
    pulse?(value: number, duration: number): Promise<boolean | void>;
    reset?(): Promise<void>;
};

type HapticGamepad = Gamepad & {
    readonly vibrationActuator?: HapticActuator;
    readonly hapticActuators?: ArrayLike<HapticActuator | null>;
};

type LabeledActuator = {
    readonly label: string;
    readonly actuator: HapticActuator;
};

type BrowserRumbleGlobal = {
    readonly Gamepad?: { readonly prototype: object };
    readonly GamepadHapticActuator?: { readonly prototype: { readonly playEffect?: unknown } };
};

export type BrowserRumbleCapability = "available" | "unavailable";

/** Browser-level menu capability. Controller capability is intentionally evaluated later, per connected pad. */
export function getBrowserRumbleCapability(): BrowserRumbleCapability {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        return "unavailable";
    }

    const browser = globalThis as unknown as BrowserRumbleGlobal;
    const gamepad = browser.Gamepad;
    const hapticActuator = browser.GamepadHapticActuator;
    if (gamepad === undefined || hapticActuator === undefined) {
        return "unavailable";
    }

    return "vibrationActuator" in gamepad.prototype && typeof hapticActuator.prototype.playEffect === "function" ? "available" : "unavailable";
}

export function getConnectedGamepads(): HapticGamepad[] {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        return [];
    }
    return Array.from(navigator.getGamepads()).filter((gamepad): gamepad is HapticGamepad => gamepad !== null && gamepad.connected);
}

export function getHapticActuators(gamepad: Gamepad): HapticActuator[] {
    const hapticGamepad = gamepad as HapticGamepad;
    return Array.from(hapticGamepad.hapticActuators ?? []).filter((actuator): actuator is HapticActuator => actuator !== null);
}

export function getActuatorDescriptions(gamepad: Gamepad): string[] {
    const hapticGamepad = gamepad as HapticGamepad;
    const descriptions: string[] = [];
    if (hapticGamepad.vibrationActuator !== undefined) {
        descriptions.push(describeActuator("vibrationActuator", hapticGamepad.vibrationActuator));
    }
    getHapticActuators(gamepad).forEach((actuator, index) => descriptions.push(describeActuator(`hapticActuators[${index}]`, actuator)));
    return descriptions;
}

export async function playPulseOnGamepad(gamepad: Gamepad, pulse: RumblePulseStep): Promise<string> {
    const params = {
        startDelay: 0,
        duration: pulse.duration,
        strongMagnitude: pulse.strong,
        weakMagnitude: pulse.weak
    };
    const candidates = getDistinctLabeledActuators(gamepad);
    if (candidates.length === 0) {
        return "no supported haptic actuator";
    }

    let failureMessage = "no supported haptic actuator";
    for (const { label, actuator } of candidates) {
        const result = await tryActuator(actuator, label, params);
        if (result.handled) {
            return result.message;
        }
        failureMessage = result.message;
    }
    return failureMessage;
}

export async function silenceGamepads(gamepads: readonly Gamepad[]): Promise<void> {
    for (const gamepad of gamepads) {
        const actuators = Array.from(new Set(getDistinctLabeledActuators(gamepad).map(({ actuator }) => actuator)));
        for (const actuator of actuators) {
            await silenceActuator(actuator);
        }
    }
}

export function describeActuator(label: string, actuator: HapticActuator): string {
    const effects = actuator.effects !== undefined && actuator.effects.length > 0 ? Array.from(actuator.effects).join(", ") : "unknown effects";
    const methods = [
        typeof actuator.playEffect === "function" ? "playEffect" : "",
        typeof actuator.pulse === "function" ? "pulse" : "",
        typeof actuator.reset === "function" ? "reset" : ""
    ].filter(Boolean);
    return `${label}: ${methods.join("/") || "no methods"}; ${effects}`;
}

function getDistinctLabeledActuators(gamepad: Gamepad): LabeledActuator[] {
    const hapticGamepad = gamepad as HapticGamepad;
    const candidates: LabeledActuator[] = [];
    if (hapticGamepad.vibrationActuator !== undefined) {
        candidates.push({ label: "vibrationActuator", actuator: hapticGamepad.vibrationActuator });
    }
    getHapticActuators(gamepad).forEach((actuator, index) => {
        if (!candidates.some((candidate) => candidate.actuator === actuator)) {
            candidates.push({ label: `hapticActuators[${index}]`, actuator });
        }
    });
    return candidates;
}

async function tryActuator(
    actuator: HapticActuator,
    label: string,
    params: DualRumbleParameters
): Promise<{ readonly handled: boolean; readonly message: string }> {
    let playEffectFailed = false;
    if (typeof actuator.playEffect === "function") {
        const supportedEffects = Array.from(actuator.effects ?? []);
        const supportsDualRumble = supportedEffects.length === 0 || supportedEffects.includes("dual-rumble");
        if (supportsDualRumble) {
            try {
                const result = await actuator.playEffect("dual-rumble", params);
                return { handled: true, message: `${label}.playEffect: ${result || "started"}` };
            } catch {
                playEffectFailed = true;
                // Fall through to pulse() when the browser exposes both APIs but
                // rejects dual-rumble at runtime.
            }
        }
    }

    if (typeof actuator.pulse === "function") {
        try {
            const intensity = Math.max(params.strongMagnitude, params.weakMagnitude);
            const result = await actuator.pulse(intensity, params.duration);
            return { handled: result !== false, message: `${label}.pulse: ${result === false ? "rejected" : "started"}` };
        } catch {
            return { handled: false, message: `${label}.pulse failed` };
        }
    }

    return {
        handled: false,
        message: playEffectFailed ? `${label}.playEffect failed` : `${label}: unsupported`
    };
}

async function silenceActuator(actuator: HapticActuator): Promise<void> {
    if (typeof actuator.reset === "function") {
        try {
            await actuator.reset();
            return;
        } catch {
            // Try the other haptic APIs if reset() is exposed but rejected.
        }
    }

    if (typeof actuator.playEffect === "function") {
        try {
            await actuator.playEffect("dual-rumble", {
                duration: 1,
                strongMagnitude: 0,
                weakMagnitude: 0
            });
            return;
        } catch {
            // Legacy pulse() can still stop vibration when playEffect() fails.
        }
    }

    if (typeof actuator.pulse === "function") {
        try {
            // A zero-intensity pulse supersedes an active legacy pulse.
            await actuator.pulse(0, 1);
        } catch {}
    }
}
