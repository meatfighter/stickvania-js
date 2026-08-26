import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rootDir } from "./build-utils.mjs";

const controllerSupportSource = readDesktopSource("ControllerSupport.java");
const inputConfigModeSource = readDesktopSource("InputConfigMode.java");
const mainSource = readDesktopSource("Main.java");

test("desktop controller rediscovery is guarded by ControllerSupport", () => {
    assert.match(controllerSupportSource, /private static boolean controllerRefreshEnabled = true;/);
    assert.match(
        controllerSupportSource,
        /public static boolean refreshControllersIfNeeded\(\) \{\s*if \(!controllerRefreshEnabled\) \{\s*return false;\s*\}/s
    );
    assert.match(controllerSupportSource, /public static void setControllerRefreshEnabled\(boolean enabled\)/);
    assert.match(controllerSupportSource, /lastControllerRefreshNanos = Long\.MIN_VALUE;/);
});

test("desktop controller rediscovery policy enables only safe modes", () => {
    const policyBody = extractMethodBody(mainSource, "isControllerRefreshAllowedForCurrentMode");

    for (const mode of ["MODE_TITLE_SCREEN", "MODE_CONTINUE_SCREEN", "MODE_INPUT_CONFIG"]) {
        assert.match(policyBody, new RegExp(`case ${mode}:`), `${mode} should enable desktop controller rediscovery.`);
    }

    for (const mode of ["MODE_PLAYING", "MODE_DEMO", "MODE_INTRO", "MODE_MAP", "MODE_CASTLE_FALLS", "MODE_CREDITS", "MODE_LOADING"]) {
        assert.doesNotMatch(policyBody, new RegExp(`case ${mode}:`), `${mode} should not enable desktop controller rediscovery.`);
    }

    assert.match(policyBody, /default:\s*return false;/s);
    assert.match(mainSource, /syncControllerRefreshPolicy\(\);\s*controlInput\.update\(\);/s);
    assert.match(mainSource, /mode = MODE_INPUT_CONFIG;\s*syncControllerRefreshPolicy\(\);/s);
});

test("desktop input configuration can still request controller rediscovery", () => {
    assert.match(inputConfigModeSource, /ControllerSupport\.refreshControllersIfNeeded\(\)/);
});

test("desktop JInput filter suppresses controller plugin load noise", () => {
    assert.match(
        controllerSupportSource,
        /"Loading: net\.java\.games\.input\.DirectAndRawInputEnvironmentPlugin"\s*\.equals\(text\)\) \{\s*return true;\s*\}/s
    );
});

function readDesktopSource(file) {
    return readFileSync(join(rootDir, "desktop", "src", "stickvania", file), "utf8");
}

function extractMethodBody(source, methodName) {
    const signatureIndex = source.indexOf(`${methodName}()`);
    assert.notEqual(signatureIndex, -1, `Missing ${methodName}().`);
    const openBraceIndex = source.indexOf("{", signatureIndex);
    assert.notEqual(openBraceIndex, -1, `Missing ${methodName}() body.`);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index++) {
        const char = source[index];
        if (char === "{") {
            depth++;
        } else if (char === "}") {
            depth--;
            if (depth === 0) {
                return source.slice(openBraceIndex + 1, index);
            }
        }
    }

    throw new Error(`Unable to locate complete ${methodName}() body.`);
}
