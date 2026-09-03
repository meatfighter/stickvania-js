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
    assert.match(schema, /FIRST_PUBLIC_GAME_STATE_VERSION = 8/);
    assert.match(store, /version >= FIRST_PUBLIC_GAME_STATE_VERSION/);
    assert.match(store, /version !== GAME_STATE_VERSION/);
    assert.match(store, /hasProtectedStoredSnapshot/);
    assert.match(preflight, /version >= FIRST_PUBLIC_GAME_STATE_VERSION/);
    assert.match(preflight, /version !== GAME_STATE_VERSION/);
    assert.doesNotMatch(preflight, /FutureVersion/);
    assert.match(mapping, /version !== null && version > ButtonMapping\.VERSION/);
    assert.match(mapping, /hasProtectedStoredSnapshot/);
    assert.match(serializer, /areRecordFieldNamesExact/);
    assert.match(serializer, /fields\.length !== expected\.length/);
    assert.doesNotMatch(serializer, /areRecordFieldNamesAllowed/);
});
