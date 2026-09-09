import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadBrowserHaptics() {
    const context = {
        exports: {},
        console,
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

test("browser haptics prefers dual-rumble and preserves strong/weak magnitudes", async () => {
    const { playPulseOnGamepad } = loadBrowserHaptics();
    const calls = [];
    const gamepad = {
        vibrationActuator: {
            effects: ["dual-rumble"],
            async playEffect(effect, params) {
                calls.push({ effect, params });
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
