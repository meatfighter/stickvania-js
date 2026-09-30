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
    assert.match(schema, /GAME_STATE_VERSION = 23/);
    assert.doesNotMatch(schema, /FIRST_PUBLIC_GAME_STATE_VERSION|MIN_SUPPORTED_GAME_STATE_VERSION|SUPPORTED_GAME_STATE_VERSIONS/);

    // Reads accept only the exact current schema and never mutate storage.
    // Writes validate only the outgoing value and never protect existing bytes by version.
    assert.doesNotMatch(store, /unsupported-future|invalid-existing|FIRST_PUBLIC|writeProtected/);
    assert.match(store, /captureAndWriteSnapshot/);
    assert.match(store, /public inspectStoredGameState\(\)/);
    assert.match(store, /status: "current"/);
    assert.match(store, /status: "invalid"/);
    assert.match(store, /public clear\(isAuthorized: \(\) => boolean\)/);

    assert.doesNotMatch(preflight, /unsupported-future/);
    assert.match(preflight, /isPotentialStickvaniaGameStateSnapshot\(snapshot\)/);
    assert.match(preflight, /return \{ status: "invalid" \}/);
    assert.match(preflight, /Menu preflight has no write capability and never migrates or deletes saves/);

    assert.doesNotMatch(mapping, /FIRST_PUBLIC_VERSION|storageWriteProtected|hasProtectedStoredSnapshot|replaceProtected/);
    assert.match(mapping, /readCurrentJson/);
    assert.match(mapping, /captureAndWriteSnapshot/);
    assert.match(mapping, /MAX_TEXT_LENGTH/);
    assert.match(mapping, /save\(isAuthorized: \(\) => boolean\)/);
    assert.match(mapping, /MappingWriteFailureReason = "unavailable" \| "invalid" \| "stale-session"/);
    assert.match(mapping, /result\.reason === "not-authorized" \? "stale-session"/);

    assert.match(serializer, /areRecordFieldNamesExact/);
    assert.match(serializer, /fields\.length !== expected\.length/);
    assert.doesNotMatch(serializer, /areRecordFieldNamesAllowed/);
});
