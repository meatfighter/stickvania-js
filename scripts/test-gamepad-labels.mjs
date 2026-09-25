import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.ok(["jackal-js", "stickvania-js"].includes(pkg.name));
const jackal = pkg.name === "jackal-js";
const game = jackal ? "jackal" : "stickvania";
const expected = [
    "GP-BOT",
    "GP-RGT",
    "GP-LFT",
    "GP-TOP",
    "GP-LB",
    "GP-RB",
    "GP-LT",
    "GP-RT",
    "GP-BACK",
    "GP-START",
    "GP-LS",
    "GP-RS",
    "GP-UP",
    "GP-DOWN",
    "GP-LEFT",
    "GP-RIGHT",
    "GP-HOME"
];
const server = await createServer({
    root: fileURLToPath(new URL("../pwa/", import.meta.url)),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});
try {
    const { ButtonMapping: B } = await server.ssrLoadModule(`/src/${game}/ButtonMapping.ts`);
    const profile = await server.ssrLoadModule(`/src/${game}/NesInputProfile.ts`);
    for (const standard of [false, true]) {
        for (let b = 0; b < 64; b++) {
            const label = B.getGamepadButtonText(b, standard);
            assert.equal(label, standard && b < 17 ? expected[b] : `GP-B${b + 1}`);
            assert.match(label, /^[A-Z0-9-]{1,8}$/);
        }
        for (const [b, label] of [
            [-1, "GP-NONE"],
            [-2, "GP-UP"],
            [-3, "GP-DOWN"],
            [-4, "GP-LEFT"],
            [-5, "GP-RIGHT"]
        ]) {
            assert.equal(B.getGamepadButtonText(b, standard), label);
        }
        for (const b of [-6, 64, 1.5, NaN, Infinity, -Infinity]) {
            assert.equal(B.getGamepadButtonText(b, standard), "GP-UNK");
        }
    }
    assert.equal(B.getGamepadButtonText(0), "GP-B1", "No context must not assume standard");
    const status = { available: true, valid: true, sequence: 1, topologyGeneration: 7, baselineOnly: false };
    let layouts = [];
    const input = {
        getControllerSampleStatus: () => status,
        getControllerCount: () => layouts.length,
        getControllerMapping: (i) => layouts[i]
    };
    for (const [value, expectedStyle] of [
        [[], false],
        [["standard"], true],
        [["standard", "standard"], true],
        [[""], false],
        [["standard", ""], false],
        [["", "standard"], false],
        [["xr-standard"], false]
    ]) {
        layouts = value;
        assert.equal(B.usesStandardGamepadLabels(input), expectedStyle);
    }
    layouts = ["standard"];
    status.valid = false;
    assert.equal(B.usesStandardGamepadLabels(input), false);
    status.valid = true;
    assert.equal(B.usesStandardGamepadLabels(input), true);
    status.available = false;
    assert.equal(B.usesStandardGamepadLabels(input), false);
    status.available = true;
    status.baselineOnly = true;
    assert.equal(B.usesStandardGamepadLabels(input), true);
    status.baselineOnly = false;
    assert.equal(
        B.usesStandardGamepadLabels({
            ...input,
            getControllerMapping() {
                throw new Error("metadata");
            }
        }),
        false
    );
    assert.equal(
        B.usesStandardGamepadLabels({
            ...input,
            getControllerCount() {
                status.sequence++;
                return 1;
            }
        }),
        false
    );
    for (const count of [0, -1, NaN, Infinity, 1.5]) {
        assert.equal(B.usesStandardGamepadLabels({ ...input, getControllerCount: () => count }), false);
    }

    const mapping = new B();
    const before = JSON.stringify(mapping);
    const gc = { getInput: () => input };
    let screen, draw, lineName, xName;
    if (jackal) {
        const { InputMode } = await server.ssrLoadModule("/src/jackal/InputMode.ts");
        screen = new InputMode();
        screen.buttonMapping = mapping;
        screen.gc = gc;
        screen.main = { drawString() {} };
        screen.menu = null;
        draw = () => screen.renderInputMenu(gc, {});
        lineName = "inputMappingLines";
        xName = "inputMappingX";
    } else {
        const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
        // Real presentation methods with a field-only fixture; no resource-loading constructor.
        screen = Object.create(Main.prototype);
        screen.buttonMapping = mapping;
        screen.titleInputMappingLines = Array(profile.INPUTS.length).fill("");
        screen.titleInputMappingCacheDirty = true;
        screen.titleSelectedIndex = 0;
        screen.drawString = () => {};
        draw = () => screen.renderTitleInputMenu(gc);
        lineName = "titleInputMappingLines";
        xName = "titleInputMappingX";
    }
    let formattingCalls = 0;
    const controllerLabelFor = mapping.controllerLabelFor;
    mapping.controllerLabelFor = function (...args) {
        formattingCalls++;
        return controllerLabelFor.apply(this, args);
    };
    const assertDraw = (standard) => {
        draw();
        for (let i = 0; i < profile.INPUTS.length; i++) {
            const row = profile.INPUTS[i];
            const label = B.getGamepadButtonText(mapping[row.controller], standard);
            assert.ok(screen[lineName][i].endsWith(", " + label), screen[lineName][i]);
        }
        const count = formattingCalls;
        draw();
        assert.equal(formattingCalls, count, "Unchanged visible style must not rebuild rows");
        assert.equal(JSON.stringify(mapping), before, "Naming changed durable mapping fields");
    };
    for (const [value, standard] of [
        [[], false],
        [["standard"], true],
        [["standard", ""], false],
        [["standard", "standard"], true],
        [[""], false],
        [["standard"], true]
    ]) {
        layouts = value;
        status.sequence++;
        // Deliberately keep topologyGeneration unchanged to test the full display policy.
        assertDraw(standard);
    }
    status.valid = false;
    status.sequence++;
    assertDraw(false);
    status.valid = true;
    status.sequence++;
    assertDraw(true);
    status.available = false;
    status.sequence++;
    assertDraw(false);
    status.available = true;
    layouts = [];
    status.sequence++;
    assertDraw(false);
    // No direct refresh/dirty call was used for any of the preceding style transitions.

    for (const standard of [false, true]) {
        for (let key = -1; key < 256; key++) {
            for (let binding = -5; binding < 64; binding++) {
                for (let i = 0; i < profile.INPUTS.length; i++) {
                    const row = profile.INPUTS[i];
                    mapping[row.key] = key;
                    mapping[row.controller] = binding;
                    const line = jackal ? mapping.inputMappingLine(row.label, i, standard) : screen.createInputMappingLine(row.label, standard);
                    assert.ok(line.length <= 32, line);
                }
            }
        }
    }
    mapping.resetToDefaults();
    if (jackal) screen.refreshInputMappingLines(false);
    else screen.titleInputMappingCacheDirty = true;
    layouts = ["standard"];
    status.sequence++;
    assertDraw(true);
    assert.ok(screen[xName] >= (jackal ? 0 : 64));

    const about = readFileSync(new URL("../about/content.md", import.meta.url), "utf8");
    const qualifier = "Gamepad button names use Xbox-style labels; equivalent buttons may have different labels on other controllers.";
    assert.equal(about.split(qualifier).length - 1, 1);
    const controls = about.split("# Controls")[1].split("## Browser Menu")[0];
    const rows = controls
        .split(/\r?\n/)
        .filter((line) => line.startsWith("|"))
        .map((line) =>
            line
                .split("|")
                .slice(1, -1)
                .map((cell) => cell.trim())
        );
    const gamepad = (action) => rows.find((row) => row[0] === action)?.[2];
    assert.equal(gamepad(jackal ? "Grenade" : "Jump"), "A");
    assert.equal(gamepad(jackal ? "Gun" : "Attack"), "X");
    if (jackal) assert.equal(gamepad("Start / Pause"), "Menu");
    assert.doesNotMatch(controls, /bottom face button|GP-BOT|GP-LFT/i);
    const nativeTest = readFileSync(new URL(`../desktop/test/${game}/ControllerSupportTest.java`, import.meta.url), "utf8");
    const dispatches = nativeTest.match(/if\s*\(scenario\.endsWith\("-buttons"\)\s*\|\|\s*scenario\.equals\("pov-only"\)\)/g) ?? [];
    assert.equal(dispatches.length, 1, "Keep only one native layout-scenario dispatch");
    console.log(`ok - ${game} device-aware labels, automatic cache transitions, widths and terse About copy`);
} finally {
    await server.close();
}
