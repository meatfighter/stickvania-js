import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { distDir, rootDir } from "./build-utils.mjs";

const distPwaDir = join(distDir, "pwa");
const serviceWorkerPath = join(distPwaDir, "sw.js");
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
    const sourcePath = join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts");
    const outputPath = join(tempRoot, "ButtonMapping.mjs");
    const source = readFileSync(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ES2022,
            target: ts.ScriptTarget.ES2022
        }
    }).outputText;

    rmSync(tempRoot, { recursive: true, force: true });
    mkdirSync(tempRoot, { recursive: true });
    writeFileSync(outputPath, compiled);

    return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
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
    const snapshotSource = readFileSync(gameStateSnapshotSourcePath, "utf8");
    const registrySource = readFileSync(thingTypeRegistrySourcePath, "utf8");
    const serializerSource = readFileSync(gameStateSerializerSourcePath, "utf8");
    const builtSource = builtJavaScript();

    assert.match(snapshotSource, /export const GAME_STATE_VERSION = 5;/);
    assert.match(registrySource, /THING_TYPE_ID_BY_CONSTRUCTOR/);
    assert.match(serializerSource, /getThingTypeId\(thing\)/);
    assert.doesNotMatch(serializerSource, /constructor\.name/);
    assert.doesNotMatch(builtSource, /\.constructor\.name/);
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
