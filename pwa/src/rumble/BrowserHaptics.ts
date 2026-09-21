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
    readonly vibrationActuator?: HapticActuator | null;
    readonly hapticActuators?: ArrayLike<HapticActuator | null | undefined>;
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

const SILENCE_ATTEMPT_TIMEOUT_MS = 250;
const RETIRED_MESSAGE = "retired";

/** Browser-level menu capability. Controller capability is intentionally evaluated later, per connected pad. */
export function getBrowserRumbleCapability(): BrowserRumbleCapability {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        return "unavailable";
    }

    try {
        const browser = globalThis as unknown as BrowserRumbleGlobal;
        const gamepad = browser.Gamepad;
        const hapticActuator = browser.GamepadHapticActuator;
        if (gamepad === undefined || hapticActuator === undefined) {
            return "unavailable";
        }

        return "vibrationActuator" in gamepad.prototype && typeof hapticActuator.prototype.playEffect === "function" ? "available" : "unavailable";
    } catch {
        return "unavailable";
    }
}

export function getConnectedGamepads(): HapticGamepad[] {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
        return [];
    }
    try {
        return Array.from(navigator.getGamepads()).filter((gamepad): gamepad is HapticGamepad => gamepad != null && gamepad.connected);
    } catch {
        return [];
    }
}

export function getHapticActuators(gamepad: Gamepad): HapticActuator[] {
    try {
        const hapticGamepad = gamepad as HapticGamepad;
        return Array.from(hapticGamepad.hapticActuators ?? []).filter((actuator): actuator is HapticActuator => actuator != null);
    } catch {
        return [];
    }
}

export function getActuatorDescriptions(gamepad: Gamepad): string[] {
    const descriptions: string[] = [];
    const vibrationActuator = getVibrationActuator(gamepad);
    if (vibrationActuator != null) {
        descriptions.push(describeActuator("vibrationActuator", vibrationActuator));
    }
    getHapticActuators(gamepad).forEach((actuator, index) => descriptions.push(describeActuator(`hapticActuators[${index}]`, actuator)));
    return descriptions;
}

export async function playPulseOnGamepad(gamepad: Gamepad, pulse: RumblePulseStep, isCurrent: () => boolean = () => true): Promise<string> {
    if (!isCurrent()) {
        return RETIRED_MESSAGE;
    }
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
        if (!isCurrent()) {
            return RETIRED_MESSAGE;
        }
        try {
            const result = await tryActuator(actuator, label, params, isCurrent);
            if (!isCurrent()) {
                return RETIRED_MESSAGE;
            }
            if (result.handled) {
                return result.message;
            }
            failureMessage = result.message;
        } catch {
            if (!isCurrent()) {
                return RETIRED_MESSAGE;
            }
            failureMessage = `${label}: failed`;
        }
    }
    return isCurrent() ? failureMessage : RETIRED_MESSAGE;
}

export async function silenceGamepads(gamepads: readonly Gamepad[], isCurrent: () => boolean = () => true): Promise<void> {
    if (!isCurrent()) {
        return;
    }
    const actuators = new Set<HapticActuator>();
    for (const gamepad of gamepads) {
        for (const { actuator } of getDistinctLabeledActuators(gamepad)) {
            actuators.add(actuator);
        }
    }
    await Promise.all(Array.from(actuators, (actuator) => silenceActuatorBounded(actuator, isCurrent)));
}

export function describeActuator(label: string, actuator: HapticActuator): string {
    try {
        const rawEffects = actuator.effects;
        const effects = rawEffects !== undefined && rawEffects.length > 0 ? Array.from(rawEffects).join(", ") : "unknown effects";
        const methods = [
            typeof actuator.playEffect === "function" ? "playEffect" : "",
            typeof actuator.pulse === "function" ? "pulse" : "",
            typeof actuator.reset === "function" ? "reset" : ""
        ].filter(Boolean);
        return `${label}: ${methods.join("/") || "no methods"}; ${effects}`;
    } catch {
        return `${label}: unavailable`;
    }
}

function getVibrationActuator(gamepad: Gamepad): HapticActuator | null {
    try {
        return (gamepad as HapticGamepad).vibrationActuator ?? null;
    } catch {
        return null;
    }
}

function getDistinctLabeledActuators(gamepad: Gamepad): LabeledActuator[] {
    const candidates: LabeledActuator[] = [];
    const vibrationActuator = getVibrationActuator(gamepad);
    if (vibrationActuator != null) {
        candidates.push({ label: "vibrationActuator", actuator: vibrationActuator });
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
    params: DualRumbleParameters,
    isCurrent: () => boolean
): Promise<{ readonly handled: boolean; readonly message: string }> {
    let playEffectFailed = false;
    if (!isCurrent()) {
        return { handled: false, message: RETIRED_MESSAGE };
    }
    if (typeof actuator.playEffect === "function") {
        const supportedEffects = Array.from(actuator.effects ?? []);
        const supportsDualRumble = supportedEffects.length === 0 || supportedEffects.includes("dual-rumble");
        if (supportsDualRumble && isCurrent()) {
            try {
                const result = await actuator.playEffect("dual-rumble", params);
                if (!isCurrent()) {
                    return { handled: false, message: RETIRED_MESSAGE };
                }
                return { handled: true, message: `${label}.playEffect: ${result || "started"}` };
            } catch {
                if (!isCurrent()) {
                    return { handled: false, message: RETIRED_MESSAGE };
                }
                playEffectFailed = true;
                // Fall through only while the same logical rumble command still
                // owns the actuator. A retired play must never start a fallback.
            }
        }
    }

    if (typeof actuator.pulse === "function" && isCurrent()) {
        try {
            const intensity = Math.max(params.strongMagnitude, params.weakMagnitude);
            const result = await actuator.pulse(intensity, params.duration);
            if (!isCurrent()) {
                return { handled: false, message: RETIRED_MESSAGE };
            }
            return { handled: result !== false, message: `${label}.pulse: ${result === false ? "rejected" : "started"}` };
        } catch {
            return {
                handled: false,
                message: isCurrent() ? `${label}.pulse failed` : RETIRED_MESSAGE
            };
        }
    }

    return {
        handled: false,
        message: isCurrent() ? (playEffectFailed ? `${label}.playEffect failed` : `${label}: unsupported`) : RETIRED_MESSAGE
    };
}

async function silenceActuatorBounded(actuator: HapticActuator, isCurrent: () => boolean): Promise<void> {
    if (!isCurrent()) {
        return;
    }

    let retired = false;
    const isAttemptCurrent = (): boolean => !retired && isCurrent();
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    const timeoutPromise = new Promise<void>((resolve) => {
        timeout = globalThis.setTimeout(resolve, SILENCE_ATTEMPT_TIMEOUT_MS);
    });
    const attempt = silenceActuator(actuator, isAttemptCurrent).catch(() => undefined);

    try {
        await Promise.race([attempt, timeoutPromise]);
    } finally {
        retired = true;
        if (timeout !== null) {
            globalThis.clearTimeout(timeout);
        }
    }
}

async function silenceActuator(actuator: HapticActuator, isCurrent: () => boolean): Promise<void> {
    if (!isCurrent()) {
        return;
    }

    if (typeof actuator.reset === "function") {
        try {
            await actuator.reset();
            return;
        } catch {
            // Yield even for a synchronous throw so a newer rumble command can
            // invalidate this stop before any compatibility fallback is issued.
            await Promise.resolve();
            if (!isCurrent()) {
                return;
            }
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
            await Promise.resolve();
            if (!isCurrent()) {
                return;
            }
        }
    }

    if (typeof actuator.pulse === "function" && isCurrent()) {
        try {
            // A zero-intensity pulse supersedes an active legacy pulse.
            await actuator.pulse(0, 1);
        } catch {}
    }
}
