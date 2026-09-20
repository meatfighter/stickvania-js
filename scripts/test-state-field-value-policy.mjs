import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pwaRoot = join(rootDir, "pwa");
const stickvaniaRoot = join(pwaRoot, "src", "stickvania");

const server = await createServer({
    root: pwaRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

try {
    const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    const { GAME_STATE_VERSION } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");
    const fields = await server.ssrLoadModule("/src/stickvania/persistence/StateFieldRegistry.generated.ts");
    const policy = await server.ssrLoadModule("/src/stickvania/persistence/StateFieldValuePolicy.ts");
    const { THING_TYPES } = await server.ssrLoadModule("/src/stickvania/persistence/ThingTypeRegistry.ts");
    const { SONG_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");

    verifyPolicyMatchesTypeScript(fields, policy, THING_TYPES);

    const serializer = new StickvaniaGameStateSerializer();
    const valid = createValidStageSnapshot(GAME_STATE_VERSION, fields, policy, SONG_FIELD_NAMES);
    assert.equal(serializer.isSupportedSnapshot(valid), true, "full descriptor-valid stage snapshot must pass");

    const wrongMainPrimitive = structuredClone(valid);
    wrongMainPrimitive.mainFields.killAllFlag = 0;
    assert.equal(serializer.isSupportedSnapshot(wrongMainPrimitive), false, "boolean Main fields must reject numeric aliases");

    const wrongThingPrimitive = structuredClone(valid);
    wrongThingPrimitive.things.find((thing) => thing.type === "Simon").fields.supported = 1;
    assert.equal(serializer.isSupportedSnapshot(wrongThingPrimitive), false, "boolean Thing fields must reject numeric aliases");

    const wrongReferenceTarget = structuredClone(valid);
    const boomerang = wrongReferenceTarget.things.find((thing) => thing.type === "Boomerang");
    const simon = wrongReferenceTarget.things.find((thing) => thing.type === "Simon");
    boomerang.fields.shieldBlockedBy = { $thing: simon.id };
    assert.equal(serializer.isSupportedSnapshot(wrongReferenceTarget), false, "Boomerang shield ownership must point only to an AxeKnight");

    const wrongSimonRoot = structuredClone(valid);
    wrongSimonRoot.stage.simon = wrongSimonRoot.stage.checkpoint;
    assert.equal(serializer.isSupportedSnapshot(wrongSimonRoot), false, "stage Simon root must reference a Simon");

    const validRetargetedCheckpoint = structuredClone(valid);
    const retargeted = validRetargetedCheckpoint.things[validRetargetedCheckpoint.stage.checkpoint];
    retargeted.fields.stageSegmentIndex = 1;
    retargeted.fields.regionIndex = 0;
    validRetargetedCheckpoint.stage.currentSegmentIndex = 1;
    validRetargetedCheckpoint.stage.segments[1].regionIndex = 0;
    validRetargetedCheckpoint.stage.platforms = validRetargetedCheckpoint.stage.segments[1].regions[0].platforms;
    validRetargetedCheckpoint.mainFields.stage = validRetargetedCheckpoint.stage.segments[1].regions[0].stageNumber;
    assert.equal(
        serializer.isSupportedSnapshot(validRetargetedCheckpoint),
        true,
        "demo-style checkpoint retargeting to another real segment/region is reachable"
    );

    const wrongCheckpointOwnership = structuredClone(valid);
    const currentCheckpoint = wrongCheckpointOwnership.things[wrongCheckpointOwnership.stage.checkpoint];
    currentCheckpoint.fields.regionIndex = 99;
    assert.equal(serializer.isSupportedSnapshot(wrongCheckpointOwnership), false, "checkpoint respawn target must name a real region");

    const wrongStageNumber = structuredClone(valid);
    wrongStageNumber.stage.segments[0].regions[0].stageNumber = 18;
    assert.equal(serializer.isSupportedSnapshot(wrongStageNumber), false, "region stage number must match Main.stageNumbers topology");

    const wrongPlatformRoot = structuredClone(valid);
    wrongPlatformRoot.stage.platforms = [wrongPlatformRoot.stage.simon];
    assert.equal(serializer.isSupportedSnapshot(wrongPlatformRoot), false, "platform roots must reference MovingPlatform Things");

    const wrongMapDomain = structuredClone(valid);
    wrongMapDomain.stage.segments[0].map[0][0] = 99;
    assert.equal(serializer.isSupportedSnapshot(wrongMapDomain), false, "saved map blocks must remain in the shipped block domain");

    const wrongWallDomain = structuredClone(valid);
    wrongWallDomain.stage.segments[0].walls[0][0] = 3;
    assert.equal(serializer.isSupportedSnapshot(wrongWallDomain), false, "saved walls must remain in the wall domain");

    const orphaned = structuredClone(valid);
    orphaned.things.push(createThingSnapshot("Axe", orphaned.things.length, fields, policy));
    assert.equal(serializer.isSupportedSnapshot(orphaned), false, "capture never emits unowned Thing records");

    const loadedMain = createLoadedResourceMain(Main, 8);
    assert.equal(serializer.isSupportedSnapshotForLoadedResources(loadedMain, valid), true, "matching loaded resource topology must pass");

    const wrongResourceWidth = createLoadedResourceMain(Main, 9);
    assert.equal(
        serializer.isSupportedSnapshotForLoadedResources(wrongResourceWidth, valid),
        false,
        "loaded-resource preflight must reject a structurally valid wrong-width stage before mutation"
    );

    let stopCalls = 0;
    const resourceInvalidRestoreMain = {
        ...createLoadedResourceMain(Main, 9),
        stopAllSounds() {
            stopCalls++;
        }
    };
    assert.throws(
        () => serializer.restoreSnapshot(resourceInvalidRestoreMain, {}, valid),
        /Unsupported saved game state/,
        "resource-invalid restore must fail before destructive restore work"
    );
    assert.equal(stopCalls, 0, "resource preflight must complete before stopAllSounds");

    const wrongResourceRegions = createLoadedResourceMain(Main, 8);
    wrongResourceRegions.loadedSegments[0][0].stage[5][4] = Main.TILE_EMPTY;
    assert.equal(
        serializer.isSupportedSnapshotForLoadedResources(wrongResourceRegions, valid),
        false,
        "loaded-resource preflight must derive region splits from raw door tiles"
    );

    console.log("Stickvania persisted field value/topology policy checks passed.");
} finally {
    await server.close();
}

function verifyPolicyMatchesTypeScript(fields, policy, thingTypes) {
    const model = buildClassModel();

    const mainFields = fieldsForClass(model, "Main");
    const expectedMainBooleans = new Set();
    for (const name of fields.MAIN_PERSISTED_STATE_FIELD_NAMES) {
        const type = mainFields.get(name);
        assert.ok(type, "missing Main field declaration " + name);
        if (type === "boolean") {
            expectedMainBooleans.add(name);
            assert.equal(policy.MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.has(name), true, "Main." + name + " policy type");
        } else {
            assert.equal(type, "number", "persisted Main." + name + " must remain primitive number/boolean");
            assert.equal(policy.MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.has(name), false, "Main." + name + " cannot be boolean policy");
        }
    }
    assert.deepEqual(
        [...policy.MAIN_BOOLEAN_PERSISTED_STATE_FIELDS].sort(),
        [...expectedMainBooleans].sort(),
        "Main boolean policy must be exact"
    );

    const expectedThingBooleans = new Set();
    const expectedReferences = new Set();
    for (const [typeId, constructor] of Object.entries(thingTypes)) {
        const classFields = fieldsForClass(model, constructor.name);
        const referencePolicy = policy.THING_REFERENCE_FIELD_POLICY[typeId] ?? {};
        for (const name of fields.THING_PERSISTED_STATE_FIELD_NAMES[typeId]) {
            const type = classFields.get(name);
            assert.ok(type, "missing " + typeId + "." + name + " declaration");
            if (type === "boolean") {
                expectedThingBooleans.add(name);
                assert.equal(policy.THING_BOOLEAN_PERSISTED_STATE_FIELDS.has(name), true, typeId + "." + name + " policy type");
                assert.equal(Object.hasOwn(referencePolicy, name), false);
            } else if (type === "number") {
                assert.equal(policy.THING_BOOLEAN_PERSISTED_STATE_FIELDS.has(name), false, typeId + "." + name + " numeric collision");
                assert.equal(Object.hasOwn(referencePolicy, name), false, typeId + "." + name + " numeric reference collision");
            } else {
                expectedReferences.add(typeId + "." + name);
                assert.equal(Object.hasOwn(referencePolicy, name), true, typeId + "." + name + " must have typed reference policy (" + type + ")");
            }
        }
    }
    assert.deepEqual(
        [...policy.THING_BOOLEAN_PERSISTED_STATE_FIELDS].sort(),
        [...expectedThingBooleans].sort(),
        "Thing boolean policy must be exact"
    );
    const actualReferences = [];
    for (const [typeId, referencePolicy] of Object.entries(policy.THING_REFERENCE_FIELD_POLICY)) {
        for (const name of Object.keys(referencePolicy)) actualReferences.push(typeId + "." + name);
    }
    assert.deepEqual(actualReferences.sort(), [...expectedReferences].sort(), "Thing reference policy must be exact");
}

function createValidStageSnapshot(version, fields, policy, songIds) {
    const things = [];
    const checkpointIds = [];
    const stageNumbers = [
        [1, 1, 2, 3, 3],
        [2]
    ];
    for (let segment = 0; segment < stageNumbers.length; segment++) {
        for (let region = 0; region < stageNumbers[segment].length; region++) {
            const id = things.length;
            checkpointIds.push(id);
            things.push(
                createThingSnapshot("Checkpoint", id, fields, policy, {
                    stageSegmentIndex: segment,
                    regionIndex: region,
                    song: { $song: segment === 0 && region === 0 ? "stage_1_1" : "stage_1_2" }
                })
            );
        }
    }
    const simonId = things.length;
    things.push(createThingSnapshot("Simon", simonId, fields, policy));
    const boomerangId = things.length;
    things.push(createThingSnapshot("Boomerang", boomerangId, fields, policy, { shieldBlockedBy: { $thing: null } }));

    let checkpointCursor = 0;
    const segments = stageNumbers.map((numbers, segmentIndex) => ({
        direction: 1,
        stageSegmentIndex: segmentIndex,
        map: createGrid(11, 9, 0),
        walls: createGrid(11, 9, 0),
        mapWidth: 8,
        regionIndex: 0,
        regions: numbers.map((stageNumber, regionIndex) => {
            const checkpoint = checkpointIds[checkpointCursor++];
            const segment0Bounds = [
                [0, 64],
                [64, 96],
                [96, 128],
                [128, 160],
                [160, 256]
            ];
            const bounds = segmentIndex === 0 ? segment0Bounds[regionIndex] : [0, 256];
            return {
                min: bounds[0],
                max: bounds[1],
                checkpoint,
                thingStack: createStack(checkpoint === 0 ? [checkpoint, boomerangId] : [checkpoint]),
                platforms: [],
                stageNumber
            };
        })
    }));

    const mainFields = {};
    for (const name of fields.MAIN_PERSISTED_STATE_FIELD_NAMES) {
        mainFields[name] = policy.MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.has(name) ? false : 0;
    }
    Object.assign(mainFields, {
        mode: 4,
        fadeState: 0,
        fade: 0,
        fadeReason: 0,
        score: 0,
        time: 300,
        timeIncrementor: 0,
        stage: 1,
        stageIndex: 0,
        hearts: 5,
        players: 4,
        playerPower: 16,
        enemyPower: 16,
        weaponType: 0,
        weaponRepeats: 0,
        difficulty: 0
    });

    return {
        version,
        appVersion: "policy-test",
        savedAt: new Date(0).toISOString(),
        mode: 4,
        mainFields,
        inputConfigMode: null,
        random: { seed0: 1, seed1: 2, seed2: 3 },
        stage: {
            stageIndex: 0,
            currentSegmentIndex: 0,
            checkpoint: checkpointIds[0],
            simon: simonId,
            door: null,
            platforms: [],
            regionThingStack: createStack([boomerangId]),
            regionStackSwap: createStack([]),
            weaponsStack: createStack([]),
            weaponsStackSwap: createStack([]),
            oldThingStack: createStack([]),
            segments
        },
        things,
        audio: createAudio(songIds)
    };
}

function createThingSnapshot(type, id, fields, policy, overrides = {}) {
    const values = {};
    const references = policy.THING_REFERENCE_FIELD_POLICY[type] ?? {};
    for (const name of fields.THING_PERSISTED_STATE_FIELD_NAMES[type]) {
        const reference = references[name];
        if (reference?.kind === "thing") {
            values[name] = reference.nullable ? { $thing: null } : null;
        } else if (reference?.kind === "thingArray") {
            values[name] = [];
        } else if (reference?.kind === "segment") {
            values[name] = reference.nullable ? { $segment: null } : { $segment: 0 };
        } else if (reference?.kind === "song") {
            values[name] = reference.nullable ? { $song: null } : { $song: "stage_1_1" };
        } else {
            values[name] = policy.THING_BOOLEAN_PERSISTED_STATE_FIELDS.has(name) ? false : 0;
        }
    }
    Object.assign(values, overrides);
    return { id, type, fields: values };
}

function createAudio(songIds) {
    const musicIds = new Set([
        "game_over", "map_1", "map_2", "map_3", "map_4", "prologue", "simon_killed", "stage_cleared", "dracula_dead",
        "boss_1.intro", "boss_1.loop", "boss_2.intro", "boss_2.loop", "ending.loop", "stage_1_1.loop",
        "stage_1_2.intro", "stage_1_2.loop", "stage_2_1.intro", "stage_2_1.loop", "stage_3_1.intro", "stage_3_1.loop",
        "stage_4_1.loop", "stage_4_2.loop", "stage_5_1.intro", "stage_5_1.loop", "stage_6_1.loop", "stage_6_2.intro", "stage_6_2.loop"
    ]);
    const part = (songId, suffix) => {
        const id = songId + "." + suffix;
        if (!musicIds.has(id)) return null;
        return {
            id,
            playback: { transport: "stopped", looped: suffix === "loop", playbackRate: 1, positionSeconds: 0, volume: 1, fade: null }
        };
    };
    return {
        currentSong: null,
        requestedSong: null,
        currentMusic: null,
        songs: songIds.map((id) => ({ id, playing: false, intro: part(id, "intro"), loop: part(id, "loop") })),
        sounds: []
    };
}

function createLoadedResourceMain(Main, width) {
    const makeRaw = (direction, doorColumns) => {
        const stage = createGrid(11, width, Main.TILE_EMPTY);
        for (const column of doorColumns) stage[5][column] = Main.TILE_DOOR;
        return { direction, stage };
    };
    return {
        loadedSegments: [
            [makeRaw(Main.RIGHT, [1, 2, 3, 4]), makeRaw(Main.RIGHT, [])],
            [], [], [], [], []
        ]
    };
}

function createStack(things) {
    return { $stack: { capacity: Math.max(32, things.length), things: [...things] } };
}

function createGrid(rows, columns, value) {
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => value));
}

function buildClassModel() {
    const result = new Map();
    for (const path of collectTypeScriptFiles(stickvaniaRoot)) {
        if (path.includes("persistence")) continue;
        const sourceText = readFileSync(path, "utf8");
        const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of source.statements) {
            if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
            const declared = new Map();
            for (const member of statement.members) {
                if (ts.isPropertyDeclaration(member) && !hasModifier(member, ts.SyntaxKind.StaticKeyword)) {
                    const name = propertyName(member.name);
                    if (name !== null) declared.set(name, normalizeType(member.type?.getText(source) ?? ""));
                } else if (ts.isConstructorDeclaration(member)) {
                    for (const parameter of member.parameters) {
                        const parameterProperty =
                            hasModifier(parameter, ts.SyntaxKind.PublicKeyword) ||
                            hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) ||
                            hasModifier(parameter, ts.SyntaxKind.ProtectedKeyword) ||
                            hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword);
                        if (parameterProperty) {
                            const name = propertyName(parameter.name);
                            if (name !== null) declared.set(name, normalizeType(parameter.type?.getText(source) ?? ""));
                        }
                    }
                }
            }
            const heritage = statement.heritageClauses?.find((item) => item.token === ts.SyntaxKind.ExtendsKeyword);
            const base = heritage?.types[0]?.expression.getText(source) ?? null;
            result.set(statement.name.text, { base, declared });
        }
    }
    return result;
}

function fieldsForClass(model, className, visiting = new Set()) {
    assert.equal(visiting.has(className), false, "inheritance cycle for " + className);
    const info = model.get(className);
    assert.ok(info, "missing class " + className);
    const next = new Set(visiting);
    next.add(className);
    const fields = info.base && model.has(info.base) ? fieldsForClass(model, info.base, next) : new Map();
    for (const [name, type] of info.declared) fields.set(name, type);
    return fields;
}

function collectTypeScriptFiles(directory) {
    const result = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) result.push(...collectTypeScriptFiles(path));
        else if (entry.isFile() && entry.name.endsWith(".ts")) result.push(path);
    }
    return result;
}

function propertyName(name) {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : null;
}

function hasModifier(node, kind) {
    return node.modifiers?.some((modifier) => modifier.kind === kind) === true;
}

function normalizeType(value) {
    return value.replace(/\s+/g, "");
}
