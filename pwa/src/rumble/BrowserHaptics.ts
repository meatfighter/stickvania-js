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
    const hapticGamepad = gamepad as HapticGamepad;
    const params = {
        startDelay: 0,
        duration: pulse.duration,
        strongMagnitude: pulse.strong,
        weakMagnitude: pulse.weak
    };

    const result = await tryActuator(hapticGamepad.vibrationActuator, "vibrationActuator", params);
    if (result.handled) {
        return result.message;
    }

    const hapticActuators = getHapticActuators(gamepad);
    for (let i = 0; i < hapticActuators.length; i++) {
        const actuatorResult = await tryActuator(hapticActuators[i], `hapticActuators[${i}]`, params);
        if (actuatorResult.handled) {
            return actuatorResult.message;
        }
    }

    return "no supported haptic actuator";
}

export async function silenceGamepads(gamepads: readonly Gamepad[]): Promise<void> {
    for (const gamepad of gamepads) {
        const hapticGamepad = gamepad as HapticGamepad;
        const actuators = [hapticGamepad.vibrationActuator, ...getHapticActuators(gamepad)].filter(
            (actuator): actuator is HapticActuator => actuator !== undefined
        );
        for (const actuator of actuators) {
            if (typeof actuator.reset === "function") {
                try {
                    await actuator.reset();
                } catch {}
            } else if (typeof actuator.playEffect === "function") {
                try {
                    await actuator.playEffect("dual-rumble", {
                        duration: 1,
                        strongMagnitude: 0,
                        weakMagnitude: 0
                    });
                } catch {}
            } else if (typeof actuator.pulse === "function") {
                try {
                    // Legacy GamepadHapticActuator implementations can expose only
                    // pulse(). A zero-intensity pulse supersedes an active pulse.
                    await actuator.pulse(0, 1);
                } catch {}
            }
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

async function tryActuator(
    actuator: HapticActuator | undefined,
    label: string,
    params: DualRumbleParameters
): Promise<{ readonly handled: boolean; readonly message: string }> {
    if (actuator === undefined) {
        return { handled: false, message: `${label}: missing` };
    }

    if (typeof actuator.playEffect === "function") {
        const supportedEffects = Array.from(actuator.effects ?? []);
        const supportsDualRumble = supportedEffects.length === 0 || supportedEffects.includes("dual-rumble");
        if (supportsDualRumble) {
            try {
                const result = await actuator.playEffect("dual-rumble", params);
                return { handled: true, message: `${label}.playEffect: ${result || "started"}` };
            } catch {
                return { handled: false, message: `${label}.playEffect failed` };
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

    return { handled: false, message: `${label}: unsupported` };
}
