import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { distDir, rootDir } from "./build-utils.mjs";

const distPwaDir = join(distDir, "pwa");
const serviceWorkerPath = join(distPwaDir, "sw.js");
const mainSourcePath = join(rootDir, "pwa", "src", "main.ts");
const gameStateSchemaSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStateSchema.ts");
const gameStatePreflightSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStatePreflight.ts");
const gameStateSnapshotSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStateSnapshot.ts");
const gameStateSerializerSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "StickvaniaGameStateSerializer.ts");
const thingTypeRegistrySourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "ThingTypeRegistry.ts");
const inputMappingStorageKey = "stickvania.input-mapping";
const inputMappingVersion = 5;
const tempRoot = join(rootDir, "scripts", ".verify-pwa-release-temp");

test.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
});

function collectFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

function expectedPrecacheUrls() {
    const fileUrls = collectFiles(distPwaDir)
        .map((file) => relative(distPwaDir, file).replaceAll("\\", "/"))
        .filter((file) => file !== "sw.js")
        .sort()
        .map((file) => `./${file}`);
    return ["./", ...fileUrls];
}

function actualPrecacheUrls() {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const match = serviceWorker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
    assert.ok(match, "Built service worker should contain a generated PRECACHE_URLS declaration.");
    return JSON.parse(match[1]);
}

function builtJavaScript() {
    return collectFiles(distPwaDir)
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
}

function createLocalStorageMock() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        clear() {
            values.clear();
        }
    };
}

async function importButtonMapping() {
    const outputDirectory = join(tempRoot, "button-mapping");
    const outputPath = join(outputDirectory, "ButtonMapping.mjs");
    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts"), outputPath);

    return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

async function importGameStatePreflight() {
    const outputDirectory = join(tempRoot, "game-state-preflight");
    const schemaOutputPath = join(outputDirectory, "GameStateSchema.js");
    const preflightOutputPath = join(outputDirectory, "GameStatePreflight.mjs");

    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(gameStateSchemaSourcePath, schemaOutputPath);
    writeTranspiledModule(gameStatePreflightSourcePath, preflightOutputPath);

    const schema = await import(`${pathToFileURL(schemaOutputPath).href}?v=${Date.now()}`);
    const preflight = await import(`${pathToFileURL(preflightOutputPath).href}?v=${Date.now()}`);
    return {
        GAME_STATE_STORAGE_KEY: schema.GAME_STATE_STORAGE_KEY,
        GAME_STATE_VERSION: schema.GAME_STATE_VERSION,
        hasPotentialStoredStickvaniaGameState: preflight.hasPotentialStoredStickvaniaGameState
    };
}

function writeTranspiledModule(sourcePath, outputPath) {
    const source = readFileSync(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ES2022,
            target: ts.ScriptTarget.ES2022
        }
    }).outputText;
    writeFileSync(outputPath, compiled);
}

function validMappingSnapshot(overrides = {}) {
    return {
        version: inputMappingVersion,
        keyJump: -1,
        keyAttack: 90,
        keyUp: 200,
        keyDown: 201,
        keyLeft: 202,
        keyRight: 203,
        controllerJump: 0,
        controllerAttack: 2,
        controllerUp: 12,
        controllerDown: 13,
        controllerLeft: 14,
        controllerRight: 15,
        ...overrides
    };
}

function validPotentialGameStateSnapshot(version) {
    return {
        version,
        appVersion: "test-version",
        savedAt: "2026-08-19T00:00:00.000Z",
        mode: 0,
        mainFields: {
            mode: 0
        },
        inputConfigMode: null,
        random: {
            seed0: 1,
            seed1: 2,
            seed2: 3
        },
        stage: null,
        things: [],
        audio: {
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            songs: []
        }
    };
}

test("PWA service worker precaches the built PWA output", () => {
    assert.ok(existsSync(serviceWorkerPath), "Run npm.cmd run build:pwa before release verification.");
    assert.deepEqual(actualPrecacheUrls(), expectedPrecacheUrls());
});

test("PWA service worker normalizes build-stamp cache-busting parameters", () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    assert.match(serviceWorker, /const IGNORED_CACHE_SEARCH_PARAMS = new Set\(\["v"\]\);/);
    assert.match(serviceWorker, /url\.searchParams\.delete\(param\);/);
    assert.match(serviceWorker, /caches\.match\(createCacheUrl\(request\)\)/);
});

test("PWA game-state Thing type IDs are stable through production minification", () => {
    const schemaSource = readFileSync(gameStateSchemaSourcePath, "utf8");
    const snapshotSource = readFileSync(gameStateSnapshotSourcePath, "utf8");
    const registrySource = readFileSync(thingTypeRegistrySourcePath, "utf8");
    const serializerSource = readFileSync(gameStateSerializerSourcePath, "utf8");
    const mainSource = readFileSync(mainSourcePath, "utf8");
    const builtSource = builtJavaScript();

    assert.match(schemaSource, /export const GAME_STATE_STORAGE_KEY = "stickvania\.game-state";/);
    assert.match(schemaSource, /export const GAME_STATE_VERSION = 5;/);
    assert.match(snapshotSource, /export \{ GAME_STATE_VERSION \} from "\.\/GameStateSchema\.js";/);
    assert.match(registrySource, /THING_TYPE_ID_BY_CONSTRUCTOR/);
    assert.match(serializerSource, /getThingTypeId\(thing\)/);
    assert.doesNotMatch(serializerSource, /constructor\.name/);
    assert.match(mainSource, /hasPotentialStoredStickvaniaGameState\(localStorage\)/);
    assert.doesNotMatch(mainSource, /const GAME_STATE_VERSION\s*=/);
    assert.doesNotMatch(mainSource, /const GAME_STATE_STORAGE_KEY\s*=/);
    assert.doesNotMatch(builtSource, /\.constructor\.name/);
});

test("PWA root-menu preflight accepts current-version saved games", async () => {
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, hasPotentialStoredStickvaniaGameState } = await importGameStatePreflight();
    const storage = createLocalStorageMock();
    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(validPotentialGameStateSnapshot(GAME_STATE_VERSION)));

    assert.equal(hasPotentialStoredStickvaniaGameState(storage), true);
    assert.notEqual(storage.getItem(GAME_STATE_STORAGE_KEY), null);
});

test("PWA root-menu preflight clears obsolete or malformed saved games", async () => {
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, hasPotentialStoredStickvaniaGameState } = await importGameStatePreflight();
    const storage = createLocalStorageMock();

    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(validPotentialGameStateSnapshot(GAME_STATE_VERSION - 1)));
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), null);

    storage.setItem(GAME_STATE_STORAGE_KEY, "{");
    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), null);
});

test("ButtonMapping accepts persisted integer bindings and NO_BINDING", async () => {
    globalThis.localStorage = createLocalStorageMock();
    const { ButtonMapping } = await importButtonMapping();

    localStorage.setItem(inputMappingStorageKey, JSON.stringify(validMappingSnapshot()));
    const mapping = ButtonMapping.load();

    assert.equal(mapping.keyJump, -1);
    assert.equal(mapping.keyAttack, 90);
    assert.equal(mapping.controllerLeft, 14);
});

test("ButtonMapping rejects malformed persisted bindings", async () => {
    globalThis.localStorage = createLocalStorageMock();
    const { ButtonMapping } = await importButtonMapping();

    for (const invalid of [1.5, -2, null, "12"]) {
        localStorage.setItem(inputMappingStorageKey, JSON.stringify(validMappingSnapshot({ keyJump: invalid, keyAttack: 12345 })));
        const mapping = ButtonMapping.load();
        assert.notEqual(mapping.keyAttack, 12345);
    }
});
