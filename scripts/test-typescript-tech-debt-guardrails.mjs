import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const pwaSource = join(root, "pwa", "src");

function source(path) {
    return readFileSync(join(root, path), "utf8");
}

test("controller input hot path uses scalar state instead of transient result objects", () => {
    const source = readFileSync(join(root, "pwa", "src", "stickvania", "StickvaniaInput.ts"), "utf8");
    assert.doesNotMatch(source, /type ControllerBindingState/);
    assert.doesNotMatch(source, /type ControllerReadContext/);
    assert.doesNotMatch(source, /return \{ down: anyDown, pressed: anyPressed \}/);
});

test("translated TypeScript cannot regain obsolete desktop/applet compatibility scaffolding", () => {
    const main = source("pwa/src/stickvania/Main.ts");
    const bootstrap = source("pwa/src/main.ts");
    const registry = source("pwa/src/stickvania/persistence/ThingTypeRegistry.ts");
    assert.doesNotMatch(
        main + bootstrap,
        /\bAppletGameContainer2\b|\bScalableGame2\b|\bappGameContainer\b|\bappletGameContainer\b|\bscalableGame\b|\bwindowedDisplayModeProvider\b/,
        "desktop/applet compatibility state"
    );
    assert.doesNotMatch(registry, /\bas unknown as\b/, "Thing registry double assertion");
    assert.equal(existsSync(join(pwaSource, "stickvania", "AppletGameContainer2.ts")), false);
    assert.equal(existsSync(join(pwaSource, "stickvania", "ScalableGame2.ts")), false);
});

test("release-safe persistence and unused-local guardrails remain enabled", () => {
    const tsconfig = JSON.parse(source("pwa/tsconfig.json"));
    assert.equal(tsconfig.compilerOptions.noUnusedLocals, true);
    assert.equal(tsconfig.compilerOptions.noUnusedParameters, false);

    const schema = source("pwa/src/stickvania/persistence/GameStateSchema.ts");
    const store = source("pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts");
    const preflight = source("pwa/src/stickvania/persistence/GameStatePreflight.ts");
    const mapping = source("pwa/src/stickvania/ButtonMapping.ts");
    const serializer = source("pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    assert.match(schema, /GAME_STATE_VERSION = 18/);
    assert.doesNotMatch(schema, /FIRST_PUBLIC_GAME_STATE_VERSION|MIN_SUPPORTED_GAME_STATE_VERSION|SUPPORTED_GAME_STATE_VERSIONS/);

    // Development cutover: only the current exact schema is restorable, while
    // reads remain non-destructive and future/invalid data blocks automatic writes.
    assert.match(store, /status: "unsupported-future"/);
    assert.match(store, /typedSnapshot\.version === GAME_STATE_VERSION/);
    assert.match(store, /Reads never mutate storage; only an owned Save, New Game, or Reset writes/);
    assert.match(store, /public clear\(isAuthorized: \(\) => boolean\)/);
    assert.match(store, /if \(!isAuthorized\(\)\) \{\s*return false;/);

    assert.match(preflight, /status: "unsupported-future"/);
    assert.match(preflight, /isPotentialStickvaniaGameStateSnapshot\(snapshot\) \? \{ status: "current" \} : \{ status: "invalid" \}/);
    assert.match(preflight, /Menu preflight has no write capability and never migrates or deletes saves/);

    assert.match(mapping, /FIRST_PUBLIC_VERSION = 7/);
    assert.match(mapping, /storageWriteProtected = true/);
    assert.match(mapping, /hasProtectedStoredSnapshot\(\)/);
    assert.match(mapping, /save\(isAuthorized: \(\) => boolean, replaceProtected: boolean = false\)/);
    assert.match(mapping, /reason: "stale-session"/);

    assert.match(serializer, /areRecordFieldNamesExact/);
    assert.match(serializer, /fields\.length !== expected\.length/);
    assert.doesNotMatch(serializer, /areRecordFieldNamesAllowed/);
});
