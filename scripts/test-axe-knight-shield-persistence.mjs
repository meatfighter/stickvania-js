import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
    root: resolve(rootDir, "pwa"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

function axeKnight(id = 0, remaining = 3) {
    return {
        id,
        type: "AxeKnight",
        fields: { shieldReflectionsRemaining: remaining }
    };
}

function boomerang(id = 1, overrides = {}) {
    return {
        id,
        type: "Boomerang",
        fields: {
            state: 3,
            vx: -1.25,
            g: Math.fround(-0.13988657844990548204158790170132),
            shieldBlockedBy: { $thing: 0 },
            ...overrides
        }
    };
}

function snapshot(things) {
    return { things };
}

function createCaptureContext(main) {
    return {
        main,
        stageSegments: [],
        segmentIndexes: new Map(),
        regionIndexes: new Map(),
        stairsIndexes: new Map(),
        thingIds: new Map(),
        things: []
    };
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { AxeKnight } = await server.ssrLoadModule("/src/stickvania/AxeKnight.ts");
    const { Boomerang } = await server.ssrLoadModule("/src/stickvania/Boomerang.ts");
    const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    const { THING_PERSISTED_STATE_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/persistence/StateFieldRegistry.generated.ts");
    const { isAxeKnightShieldSnapshotStateValid } = await server.ssrLoadModule("/src/stickvania/persistence/AxeKnightShieldStatePolicy.ts");

    assert.equal(isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang()])), true);
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { vx: 0 })])),
        true,
        "exact-zero reflected velocity is valid because signed g owns the outgoing direction"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { shieldBlockedBy: null })])),
        true,
        "a separated reflected Boomerang has no active shield lock"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([boomerang(0, { state: 0, vx: 3, g: -0.13988657844990548, shieldBlockedBy: null })])),
        true,
        "ordinary unreflected flight remains valid without an AxeKnight"
    );

    assert.equal(isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(0, 5)])), false, "shield durability above Hard maximum must fail");
    assert.equal(isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { state: 4 })])), false, "unknown Boomerang state must fail");
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { state: 2 })])),
        false,
        "only reflected flight may own a shield lock"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), { id: 2, type: "Simon", fields: {} }, boomerang(1, { shieldBlockedBy: { $thing: 2 } })])),
        false,
        "shield lock must target an AxeKnight"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { shieldBlockedBy: { $thing: 99 } })])),
        false,
        "dangling shield lock must fail"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { shieldBlockedBy: { $thing: 0, extra: true } })])),
        false,
        "encoded reference must have the exact one-field shape"
    );
    assert.equal(isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { g: 0 })])), false, "reflected g cannot be zero");
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { g: 0.25 })])),
        false,
        "reflected acceleration must be the canonical magnitude"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { vx: 1.25, g: -0.13988657844990548 })])),
        false,
        "nonzero reflected vx and g must point in the same direction"
    );
    assert.equal(
        isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(), boomerang(1, { vx: -3.1 })])),
        false,
        "reflected speed above the runtime cap must fail"
    );
    assert.equal(isAxeKnightShieldSnapshotStateValid(snapshot([axeKnight(0), axeKnight(0)])), false, "duplicate Thing IDs must fail");

    // Exercise the actual generic serializer field codec and JSON boundary. The
    // contact lock must restore as the exact restored AxeKnight object, not merely
    // as a valid numeric ID or an independent lookalike object.
    {
        const serializer = new StickvaniaGameStateSerializer();
        const main = { mode: Main.MODE_PLAYING };
        const sourceKnight = Object.create(AxeKnight.prototype);
        for (const field of THING_PERSISTED_STATE_FIELD_NAMES.AxeKnight) sourceKnight[field] = null;
        Object.assign(sourceKnight, {
            shieldReflectionsRemaining: 2,
            dead: false,
            kill: false
        });

        const sourceBoomerang = Object.create(Boomerang.prototype);
        for (const field of THING_PERSISTED_STATE_FIELD_NAMES.Boomerang) sourceBoomerang[field] = null;
        Object.assign(sourceBoomerang, {
            state: Boomerang.STATE_REFLECTED,
            vx: -1.25,
            g: Math.fround(-0.13988657844990548204158790170132),
            direction: Main.RIGHT,
            shieldBlockedBy: sourceKnight,
            kill: false
        });

        const captureContext = createCaptureContext(main);
        serializer.registerThing(captureContext, sourceBoomerang);
        assert.equal(captureContext.things.length, 2, "lock ownership must register the referenced AxeKnight in the Thing graph");
        const encodedThings = captureContext.things.map((thing, id) => serializer.captureThing(captureContext, thing, id));
        const decodedThings = JSON.parse(JSON.stringify(encodedThings));
        assert.equal(decodedThings[0].type, "Boomerang");
        assert.equal(decodedThings[1].type, "AxeKnight");
        assert.deepEqual(decodedThings[0].fields.shieldBlockedBy, { $thing: 1 });

        const restoredBoomerang = Object.create(Boomerang.prototype);
        const restoredKnight = Object.create(AxeKnight.prototype);
        const restoreContext = {
            main,
            gc: null,
            stageSegments: [],
            thingById: new Map([
                [0, restoredBoomerang],
                [1, restoredKnight]
            ])
        };
        serializer.restoreThingFields(restoreContext, decodedThings);
        assert.equal(restoredBoomerang.state, Boomerang.STATE_REFLECTED);
        assert.equal(restoredBoomerang.vx, -1.25);
        assert.equal(restoredBoomerang.g, Math.fround(-0.13988657844990548204158790170132));
        assert.equal(restoredBoomerang.direction, Main.RIGHT);
        assert.equal(restoredBoomerang.shieldBlockedBy, restoredKnight, "lock must restore by object identity");
        assert.equal(restoredKnight.shieldReflectionsRemaining, 2);
    }

    const preflight = readFileSync(resolve(rootDir, "pwa/src/stickvania/persistence/GameStatePreflight.ts"), "utf8");
    const store = readFileSync(resolve(rootDir, "pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts"), "utf8");
    assert.match(preflight, /isAxeKnightShieldSnapshotStateValid\(snapshot\)/);
    assert.match(store, /private isSnapshotValid\(snapshot: StickvaniaGameStateSnapshot\): boolean/);
    assert.match(store, /isAxeKnightShieldSnapshotStateValid\(snapshot\)/);
    assert.match(store, /if \(!this\.isSnapshotValid\(snapshot\)\)/, "save-time validation must use the shared semantic validator");
    assert.match(store, /this\.isSnapshotValid\(typedSnapshot\)/, "read-time validation must use the shared semantic validator");

    console.log("AxeKnight shield save-state semantic validation and graph round-trip checks passed.");
} finally {
    await server.close();
}
