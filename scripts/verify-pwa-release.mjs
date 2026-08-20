import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { distDir, readVersion, rootDir } from "./build-utils.mjs";

const distPwaDir = join(distDir, "pwa");
const packageJsonPath = join(rootDir, "package.json");
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
const versionInfo = readVersion();
const cacheVersion = `${versionInfo.version}-${versionInfo.buildStamp}`;
const encodedCacheVersion = encodeURIComponent(cacheVersion);

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
    return ["./", ...fileUrls].map(addCacheVersion);
}

function addCacheVersion(url) {
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodedCacheVersion}`;
}

function expectedPrecacheCacheUrls() {
    return expectedPrecacheUrls().map((url) => new URL(url, "https://example.test/pwa/").href);
}

function actualPrecacheUrls() {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const match = serviceWorker.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/);
    assert.ok(match, "Built service worker should contain a generated PRECACHE_URLS declaration.");
    return JSON.parse(match[1]);
}

function packageScripts() {
    return JSON.parse(readFileSync(packageJsonPath, "utf8")).scripts;
}

function countOccurrences(text, pattern) {
    return text.split(pattern).length - 1;
}

function builtJavaScript() {
    return collectFiles(distPwaDir)
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
}

function evaluateBuiltServiceWorker(locationVersion = cacheVersion) {
    const events = [];
    const openedCaches = [];
    const addAllCalls = [];
    const cachePuts = [];
    const deletedCaches = [];
    let clientsClaimCount = 0;
    let skipWaitingCount = 0;
    const workerUrl = new URL(`https://example.test/pwa/sw.js?v=${encodeURIComponent(locationVersion)}`);
    const context = {
        URL,
        console,
        self: {
            location: workerUrl,
            registration: {
                scope: "https://example.test/pwa/"
            },
            clients: {
                claim() {
                    clientsClaimCount++;
                    return Promise.resolve();
                }
            },
            addEventListener(type, listener) {
                events.push({ type, listener });
            },
            skipWaiting() {
                skipWaitingCount++;
                return Promise.resolve();
            }
        },
        caches: {
            open(name) {
                openedCaches.push(name);
                return Promise.resolve({
                    addAll(urls) {
                        addAllCalls.push([...urls]);
                        return Promise.resolve();
                    },
                    put(url, response) {
                        cachePuts.push({ cacheName: name, url, response });
                        return Promise.resolve();
                    }
                });
            },
            keys() {
                return Promise.resolve([`stickvania-pwa-old`, `stickvania-old`, `stickvania-pwa-${cacheVersion}`, "unrelated-cache"]);
            },
            delete(name) {
                deletedCaches.push(name);
                return Promise.resolve(true);
            },
            match(url) {
                return Promise.resolve({ url });
            }
        }
    };
    runInNewContext(
        `${readFileSync(serviceWorkerPath, "utf8")}
this.__serviceWorkerVersion = VERSION;
this.__cacheName = CACHE_NAME;
this.__precacheCacheUrls = PRECACHE_CACHE_URLS;
this.__createCacheUrl = createCacheUrl;
this.__remember = remember;`,
        context
    );
    return {
        addAllCalls,
        cachePuts,
        context,
        deletedCaches,
        events,
        get clientsClaimCount() {
            return clientsClaimCount;
        },
        get skipWaitingCount() {
            return skipWaitingCount;
        },
        openedCaches
    };
}

function builtServiceWorkerCacheUrl(requestOrUrl, locationVersion = cacheVersion) {
    return evaluateBuiltServiceWorker(locationVersion).context.__createCacheUrl(requestOrUrl);
}

async function runBuiltServiceWorkerEvent(type, locationVersion = cacheVersion) {
    const worker = evaluateBuiltServiceWorker(locationVersion);
    const registration = worker.events.find((event) => event.type === type);
    assert.ok(registration, `Built service worker should register a ${type} listener.`);

    let waitUntilPromise = Promise.resolve();
    registration.listener({
        waitUntil(promise) {
            waitUntilPromise = Promise.resolve(promise);
        }
    });
    await waitUntilPromise;
    return worker;
}

function okResponseMock() {
    return {
        ok: true,
        clone() {
            return this;
        }
    };
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

async function importStickvaniaInput() {
    const outputDirectory = join(tempRoot, "stickvania-input");
    const buttonMappingOutputPath = join(outputDirectory, "ButtonMapping.js");
    const inputOutputPath = join(outputDirectory, "StickvaniaInput.mjs");

    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts"), buttonMappingOutputPath);
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "StickvaniaInput.ts"), inputOutputPath);

    return import(`${pathToFileURL(inputOutputPath).href}?v=${Date.now()}`);
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
        hasPotentialBrowserStoredStickvaniaGameState: preflight.hasPotentialBrowserStoredStickvaniaGameState,
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

function createTestButtonMapping(overrides = {}) {
    return {
        keyJump: 10,
        keyAttack: 11,
        keyUp: 12,
        keyDown: 13,
        keyLeft: 14,
        keyRight: 15,
        controllerJump: 0,
        controllerAttack: 2,
        controllerUp: 12,
        controllerDown: 13,
        controllerLeft: 14,
        controllerRight: 15,
        ...overrides
    };
}

class FakeStickvaniaInput {
    keys = new Set();
    buttons = new Set();
    axes = Array.from({ length: 16 }, () => []);
    axisCountCalls = 0;
    axisValueCalls = 0;
    controllerUp = false;
    controllerDown = false;
    controllerLeft = false;
    controllerRight = false;

    isKeyDown(key) {
        return this.keys.has(key);
    }

    isButtonPressed(index, controller) {
        void controller;
        return this.buttons.has(index);
    }

    isControllerUp(controller) {
        void controller;
        return this.controllerUp;
    }

    isControllerDown(controller) {
        void controller;
        return this.controllerDown;
    }

    isControllerLeft(controller) {
        void controller;
        return this.controllerLeft;
    }

    isControllerRight(controller) {
        void controller;
        return this.controllerRight;
    }

    getAxisCount(controller) {
        this.axisCountCalls++;
        return this.axes[controller]?.length ?? 0;
    }

    getAxisValue(controller, axis) {
        this.axisValueCalls++;
        return this.axes[controller]?.[axis] ?? 0;
    }

    resetAxisCounters() {
        this.axisCountCalls = 0;
        this.axisValueCalls = 0;
    }
}

function installThrowingLocalStorage() {
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
            throw new Error("localStorage is unavailable.");
        }
    });
    return () => {
        if (previousDescriptor === undefined) {
            delete globalThis.localStorage;
        } else {
            Object.defineProperty(globalThis, "localStorage", previousDescriptor);
        }
    };
}

test("PWA service worker precaches the built PWA output", () => {
    assert.ok(existsSync(serviceWorkerPath), "Run npm.cmd run build:pwa:release before release verification.");
    assert.deepEqual(actualPrecacheUrls(), expectedPrecacheUrls());
});

test("package scripts stamp release PWA builds exactly once", () => {
    const scripts = packageScripts();

    assert.equal(scripts["build:pwa"], "npm run build:pwa:release");
    assert.equal(scripts["build:pwa:release"], "npm run stamp && npm run _build:pwa:release");
    assert.equal(scripts["_build:pwa:release"], "tsc --project pwa/tsconfig.json && vite build --config pwa/vite.config.ts");
    assert.equal(scripts["test:pwa-release"], "npm run build:pwa:release && node scripts/verify-pwa-release.mjs");
    assert.equal(scripts["build:web"], "npm run clean && npm run build:pwa:release && npm run build:about");
    assert.equal(scripts["build"], "npm run clean && npm run build:pwa:release && npm run build:about && npm run build:desktop && npm run assemble");

    assert.equal(countOccurrences(scripts["build:pwa:release"], "npm run stamp"), 1);
    assert.equal(countOccurrences(scripts["_build:pwa:release"], "npm run stamp"), 0);
    assert.equal(countOccurrences(scripts["build:web"], "npm run stamp"), 0);
    assert.equal(countOccurrences(scripts["build"], "npm run stamp"), 0);
});

test("PWA service worker embeds its own cache version", async () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const worker = evaluateBuiltServiceWorker("old-release");

    assert.match(serviceWorker, new RegExp(`const VERSION = ${JSON.stringify(cacheVersion).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
    assert.doesNotMatch(serviceWorker, /__SERVICE_WORKER_VERSION__/);
    assert.doesNotMatch(serviceWorker, /self\.location\.href/);
    assert.doesNotMatch(serviceWorker, /skipWaiting/);
    assert.equal(worker.context.__serviceWorkerVersion, cacheVersion);
    assert.equal(worker.context.__cacheName, `stickvania-pwa-${cacheVersion}`);

    const installedWorker = await runBuiltServiceWorkerEvent("install", "old-release");
    assert.deepEqual(installedWorker.openedCaches, [`stickvania-pwa-${cacheVersion}`]);
    assert.deepEqual(installedWorker.addAllCalls, [expectedPrecacheCacheUrls()]);
    assert.equal(installedWorker.skipWaitingCount, 0);
});

test("PWA service worker activation removes superseded Stickvania caches", async () => {
    const worker = await runBuiltServiceWorkerEvent("activate", "old-release");

    assert.deepEqual(new Set(worker.deletedCaches), new Set(["stickvania-pwa-old", "stickvania-old"]));
    assert.equal(worker.deletedCaches.includes(`stickvania-pwa-${cacheVersion}`), false);
    assert.equal(worker.deletedCaches.includes("unrelated-cache"), false);
    assert.equal(worker.clientsClaimCount, 1);
});

test("PWA service worker preserves versioned cache-busting parameters", () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    assert.doesNotMatch(serviceWorker, /IGNORED_CACHE_SEARCH_PARAMS/);
    assert.doesNotMatch(serviceWorker, /searchParams\.delete/);
    assert.match(serviceWorker, /!url\.searchParams\.has\("v"\)/);
    assert.match(serviceWorker, /url\.searchParams\.set\("v", VERSION\)/);
    assert.match(serviceWorker, /caches\.match\(createCacheUrl\(request\)\)/);

    const oldCacheUrl = builtServiceWorkerCacheUrl("./images/icon.png?v=old");
    const newCacheUrl = builtServiceWorkerCacheUrl("./images/icon.png?v=new");
    const defaultedCacheUrl = builtServiceWorkerCacheUrl("./images/icon.png");
    const unrelatedQueryCacheUrl = builtServiceWorkerCacheUrl("./images/icon.png?palette=blue");
    const externalCacheUrl = builtServiceWorkerCacheUrl("https://cdn.example.test/file.png");

    assert.notEqual(oldCacheUrl, newCacheUrl);
    assert.equal(new URL(oldCacheUrl).searchParams.get("v"), "old");
    assert.equal(new URL(newCacheUrl).searchParams.get("v"), "new");
    assert.equal(new URL(defaultedCacheUrl).searchParams.get("v"), cacheVersion);
    assert.equal(new URL(unrelatedQueryCacheUrl).searchParams.get("v"), cacheVersion);
    assert.equal(new URL(unrelatedQueryCacheUrl).searchParams.get("palette"), "blue");
    assert.notEqual(defaultedCacheUrl, unrelatedQueryCacheUrl);
    assert.equal(new URL(externalCacheUrl).searchParams.has("v"), false);
});

test("PWA service worker precache keys include the current cache version", () => {
    for (const url of actualPrecacheUrls()) {
        assert.equal(new URL(url, "https://example.test/pwa/").searchParams.get("v"), cacheVersion);
    }
});

test("PWA service worker runtime cache writes are limited to current precache keys", async () => {
    const worker = evaluateBuiltServiceWorker("old-release");

    assert.equal(await worker.context.__remember(`./images/icon.png?v=${encodedCacheVersion}`, okResponseMock()), true);
    assert.deepEqual(
        worker.cachePuts.map((put) => put.cacheName),
        [`stickvania-pwa-${cacheVersion}`]
    );
    assert.deepEqual(
        worker.cachePuts.map((put) => put.url),
        [new URL(`./images/icon.png?v=${encodedCacheVersion}`, "https://example.test/pwa/").href]
    );

    assert.equal(await worker.context.__remember("./images/icon.png?v=old-release", okResponseMock()), false);
    assert.equal(await worker.context.__remember(`./not-precached.txt?v=${encodedCacheVersion}`, okResponseMock()), false);
    assert.equal(await worker.context.__remember(`https://cdn.example.test/file.png?v=${encodedCacheVersion}`, okResponseMock()), false);
    assert.equal(worker.cachePuts.length, 1);
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
    assert.match(mainSource, /hasPotentialBrowserStoredStickvaniaGameState\(\)/);
    assert.doesNotMatch(mainSource, /hasPotentialStoredStickvaniaGameState\(localStorage\)/);
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

test("PWA root-menu preflight handles unavailable localStorage", async () => {
    const { hasPotentialBrowserStoredStickvaniaGameState } = await importGameStatePreflight();
    const restoreLocalStorage = installThrowingLocalStorage();

    try {
        assert.equal(hasPotentialBrowserStoredStickvaniaGameState(), false);
    } finally {
        restoreLocalStorage();
    }
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

test("StickvaniaInput preserves Java-style keyboard/controller menu edges", async () => {
    const { StickvaniaInput } = await importStickvaniaInput();

    const directionMapping = createTestButtonMapping();
    const directionInput = new FakeStickvaniaInput();
    directionInput.keys.add(directionMapping.keyUp);
    const directionControl = new StickvaniaInput(directionInput, directionMapping);

    directionInput.buttons.add(directionMapping.controllerUp);
    directionControl.update();
    assert.equal(directionControl.isMenuUpPressed(), true);

    directionControl.update();
    assert.equal(directionControl.isMenuUpPressed(), false);

    const selectMapping = createTestButtonMapping();
    const selectInput = new FakeStickvaniaInput();
    selectInput.keys.add(selectMapping.keyJump);
    const selectControl = new StickvaniaInput(selectInput, selectMapping);

    selectInput.buttons.add(selectMapping.controllerAttack);
    selectControl.update();
    assert.equal(selectControl.isMenuSelectPressed(), true);
});

test("StickvaniaInput reads extra gamepad axes once per update", async () => {
    const { StickvaniaInput } = await importStickvaniaInput();
    const fakeInput = new FakeStickvaniaInput();
    fakeInput.axes[0] = [0, 0, 0, 0, 0, 0, 0, 0];
    const control = new StickvaniaInput(fakeInput, createTestButtonMapping());

    fakeInput.axes[0][3] = -1;
    fakeInput.resetAxisCounters();
    control.update();

    assert.equal(control.isUp(), true);
    assert.equal(fakeInput.axisCountCalls, 16);
    assert.equal(fakeInput.axisValueCalls, 4);
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
