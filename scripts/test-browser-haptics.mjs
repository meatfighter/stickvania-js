import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadBrowserHaptics(globals = {}) {
    const context = {
        exports: {},
        console,
        ...globals,
        require: () => ({})
    };
    const source = readFileSync("pwa/src/rumble/BrowserHaptics.ts", "utf8");
    vm.runInNewContext(
        ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
        }).outputText,
        context
    );
    return context.exports;
}

function chromeLikeBrowser() {
    function Gamepad() {}
    Object.defineProperty(Gamepad.prototype, "vibrationActuator", { configurable: true, get: () => undefined });
    function GamepadHapticActuator() {}
    GamepadHapticActuator.prototype.playEffect = function () {};
    return {
        navigator: { getGamepads: () => [] },
        Gamepad,
        GamepadHapticActuator
    };
}

function firefoxLegacyBrowser() {
    function Gamepad() {}
    Object.defineProperty(Gamepad.prototype, "hapticActuators", { configurable: true, get: () => [] });
    function GamepadHapticActuator() {}
    GamepadHapticActuator.prototype.pulse = function () {};
    return {
        navigator: { getGamepads: () => [] },
        Gamepad,
        GamepadHapticActuator
    };
}

test("modern browser rumble capability is available without any connected controller", () => {
    const { getBrowserRumbleCapability } = loadBrowserHaptics(chromeLikeBrowser());
    assert.equal(getBrowserRumbleCapability(), "available");
});

test("Firefox-155-like legacy haptics surface is unavailable for the PWA menu", () => {
    const { getBrowserRumbleCapability } = loadBrowserHaptics(firefoxLegacyBrowser());
    assert.equal(getBrowserRumbleCapability(), "unavailable");
});

test("browser rumble capability probing treats throwing native surfaces as unavailable", () => {
    const throwingPrototype = new Proxy(
        {},
        {
            has() {
                throw new Error("native Gamepad prototype query failed");
            }
        }
    );
    const { getBrowserRumbleCapability } = loadBrowserHaptics({
        navigator: { getGamepads: () => [] },
        Gamepad: { prototype: throwingPrototype },
        GamepadHapticActuator: { prototype: { playEffect() {} } }
    });

    assert.equal(getBrowserRumbleCapability(), "unavailable");
});

test("missing browser Gamepad API is unavailable for rumble", () => {
    const { getBrowserRumbleCapability } = loadBrowserHaptics({ navigator: {} });
    assert.equal(getBrowserRumbleCapability(), "unavailable");
});

test("null vibrationActuator is treated as an unsupported controller rather than an actuator", async () => {
    const { getActuatorDescriptions, playPulseOnGamepad, silenceGamepads } = loadBrowserHaptics();
    const gamepad = { vibrationActuator: null };

    assert.deepEqual(Array.from(getActuatorDescriptions(gamepad)), []);
    assert.equal(await playPulseOnGamepad(gamepad, { duration: 80, strong: 0.5, weak: 0.5 }), "no supported haptic actuator");
    await assert.doesNotReject(silenceGamepads([gamepad]));
});

test("null vibrationActuator still permits a legacy hapticActuators fallback", async () => {
    const { playPulseOnGamepad, silenceGamepads } = loadBrowserHaptics();
    const pulses = [];
    const gamepad = {
        vibrationActuator: null,
        hapticActuators: [
            {
                async pulse(value, duration) {
                    pulses.push({ value, duration });
                    return true;
                }
            }
        ]
    };

    assert.equal(await playPulseOnGamepad(gamepad, { duration: 90, strong: 0.25, weak: 0.6 }), "hapticActuators[0].pulse: started");
    await silenceGamepads([gamepad]);
    assert.deepEqual(pulses, [
        { value: 0.6, duration: 90 },
        { value: 0, duration: 1 }
    ]);
});

test("sparse gamepad enumeration ignores nullish slots", () => {
    const connected = { connected: true };
    const disconnected = { connected: false };
    const { getConnectedGamepads } = loadBrowserHaptics({
        navigator: {
            getGamepads: () => [undefined, null, disconnected, connected]
        }
    });

    assert.deepEqual(Array.from(getConnectedGamepads()), [connected]);
});

test("gamepad enumeration failure is treated as no connected gamepads", () => {
    const { getConnectedGamepads } = loadBrowserHaptics({
        navigator: {
            getGamepads() {
                throw new Error("gamepad enumeration failed");
            }
        }
    });

    assert.deepEqual(Array.from(getConnectedGamepads()), []);
});

test("throwing vibrationActuator getter is ignored while legacy haptics remain usable", async () => {
    const { getActuatorDescriptions, playPulseOnGamepad, silenceGamepads } = loadBrowserHaptics();
    const pulses = [];
    const gamepad = {
        get vibrationActuator() {
            throw new Error("vibration actuator unavailable");
        },
        hapticActuators: [
            {
                async pulse(value, duration) {
                    pulses.push({ value, duration });
                    return true;
                }
            }
        ]
    };

    assert.deepEqual(Array.from(getActuatorDescriptions(gamepad)), ["hapticActuators[0]: pulse; unknown effects"]);
    assert.equal(await playPulseOnGamepad(gamepad, { duration: 90, strong: 0.25, weak: 0.6 }), "hapticActuators[0].pulse: started");
    await silenceGamepads([gamepad]);
    assert.deepEqual(pulses, [
        { value: 0.6, duration: 90 },
        { value: 0, duration: 1 }
    ]);
});

test("throwing legacy actuator getter and sparse actuator entries are ignored", async () => {
    const { getActuatorDescriptions, getHapticActuators, playPulseOnGamepad, silenceGamepads } = loadBrowserHaptics();
    const modernCalls = [];
    const modernActuator = {
        effects: ["dual-rumble"],
        async playEffect(effect, params) {
            modernCalls.push({ effect, params: { ...params } });
            return "complete";
        }
    };
    const throwingLegacy = {
        vibrationActuator: modernActuator,
        get hapticActuators() {
            throw new Error("legacy actuator getter failed");
        }
    };
    const sparseLegacy = { hapticActuators: [null, undefined] };

    assert.deepEqual(Array.from(getHapticActuators(throwingLegacy)), []);
    assert.deepEqual(Array.from(getHapticActuators(sparseLegacy)), []);
    assert.deepEqual(Array.from(getActuatorDescriptions(throwingLegacy)), ["vibrationActuator: playEffect; dual-rumble"]);
    assert.equal(await playPulseOnGamepad(throwingLegacy, { duration: 70, strong: 0.4, weak: 0.2 }), "vibrationActuator.playEffect: complete");
    await silenceGamepads([throwingLegacy, sparseLegacy]);
    assert.equal(modernCalls.length, 2);
});

test("browser haptics prefers dual-rumble and preserves strong/weak magnitudes", async () => {
    const { playPulseOnGamepad } = loadBrowserHaptics();
    const calls = [];
    const gamepad = {
        vibrationActuator: {
            effects: ["dual-rumble"],
            async playEffect(effect, params) {
                calls.push({ effect, params: { ...params } });
                return "complete";
            }
        }
    };

    const result = await playPulseOnGamepad(gamepad, { duration: 120, strong: 0.8, weak: 0.35 });
    assert.equal(result, "vibrationActuator.playEffect: complete");
    assert.deepEqual(calls, [
        {
            effect: "dual-rumble",
            params: { startDelay: 0, duration: 120, strongMagnitude: 0.8, weakMagnitude: 0.35 }
        }
    ]);
});

test("browser haptics falls back from a failed vibration actuator to legacy pulse", async () => {
    const { playPulseOnGamepad } = loadBrowserHaptics();
    const pulses = [];
    const gamepad = {
        vibrationActuator: {
            effects: ["dual-rumble"],
            async playEffect() {
                throw new Error("browser rejected dual-rumble");
            }
        },
        hapticActuators: [
            {
                async pulse(value, duration) {
                    pulses.push({ value, duration });
                    return true;
                }
            }
        ]
    };

    const result = await playPulseOnGamepad(gamepad, { duration: 90, strong: 0.25, weak: 0.6 });
    assert.equal(result, "hapticActuators[0].pulse: started");
    assert.deepEqual(pulses, [{ value: 0.6, duration: 90 }]);
});

test("browser haptics reports an exposed actuator rejection when no fallback succeeds", async () => {
    const { playPulseOnGamepad } = loadBrowserHaptics();
    const result = await playPulseOnGamepad(
        {
            vibrationActuator: {
                effects: ["dual-rumble"],
                async playEffect() {
                    throw new Error("browser rejected dual-rumble");
                }
            }
        },
        { duration: 80, strong: 0.5, weak: 0.5 }
    );

    assert.equal(result, "vibrationActuator.playEffect failed");
});

test("the same actuator exposed through both gamepad APIs is attempted only once", async () => {
    const { playPulseOnGamepad } = loadBrowserHaptics();
    let playCalls = 0;
    const actuator = {
        effects: ["dual-rumble"],
        async playEffect() {
            playCalls++;
            throw new Error("browser rejected dual-rumble");
        }
    };

    const result = await playPulseOnGamepad(
        {
            vibrationActuator: actuator,
            hapticActuators: [actuator]
        },
        { duration: 80, strong: 0.5, weak: 0.5 }
    );

    assert.equal(playCalls, 1);
    assert.equal(result, "vibrationActuator.playEffect failed");
});

test("silencing a legacy pulse-only actuator supersedes vibration with zero intensity", async () => {
    const { silenceGamepads } = loadBrowserHaptics();
    const pulses = [];
    const gamepad = {
        hapticActuators: [
            {
                async pulse(value, duration) {
                    pulses.push({ value, duration });
                    return true;
                }
            }
        ]
    };

    await silenceGamepads([gamepad]);
    assert.deepEqual(pulses, [{ value: 0, duration: 1 }]);
});

test("stale haptic shutdown does not issue fallback stop commands after a newer operation", async () => {
    const { silenceGamepads } = loadBrowserHaptics();
    let current = true;
    let rejectReset;
    const calls = [];
    const resetPromise = new Promise((_, reject) => {
        rejectReset = reject;
    });
    const actuator = {
        reset() {
            calls.push("reset");
            return resetPromise;
        },
        async playEffect() {
            calls.push("playEffect");
            return "complete";
        },
        async pulse() {
            calls.push("pulse");
            return true;
        }
    };

    const stopping = silenceGamepads([{ vibrationActuator: actuator }], () => current);
    current = false;
    rejectReset(new Error("stale reset rejected"));
    await stopping;

    assert.deepEqual(calls, ["reset"], "a stale stop must not issue playEffect/pulse fallbacks after ownership changes");
});

test("silencing falls through to pulse when newer stop APIs are exposed but rejected", async () => {
    const { silenceGamepads } = loadBrowserHaptics();
    const calls = [];
    const actuator = {
        async reset() {
            calls.push("reset");
            throw new Error("reset rejected");
        },
        async playEffect() {
            calls.push("playEffect");
            throw new Error("playEffect rejected");
        },
        async pulse(value, duration) {
            calls.push(`pulse:${value}:${duration}`);
            return true;
        }
    };

    await silenceGamepads([{ vibrationActuator: actuator, hapticActuators: [actuator] }]);
    assert.deepEqual(calls, ["reset", "playEffect", "pulse:0:1"], "the same actuator should be deduplicated and fall through all stop APIs");
});

test("actuator descriptions distinguish missing browser functionality from exposed APIs", () => {
    const { getActuatorDescriptions } = loadBrowserHaptics();
    assert.deepEqual(Array.from(getActuatorDescriptions({})), []);
    assert.deepEqual(
        Array.from(
            getActuatorDescriptions({
                vibrationActuator: {
                    effects: ["dual-rumble"],
                    playEffect: async () => undefined,
                    reset: async () => undefined
                }
            })
        ),
        ["vibrationActuator: playEffect/reset; dual-rumble"]
    );
});
