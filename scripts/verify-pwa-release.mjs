import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { readVersion, resolveConfiguredDistDir, rootDir, versionPath } from "./build-utils.mjs";

const distDir = resolveConfiguredDistDir();
const distPwaDir = join(distDir, "pwa");
const packageJsonPath = join(rootDir, "package.json");
const packageLockPath = join(rootDir, "package-lock.json");
const releaseStampScriptPath = join(rootDir, "scripts", "run-stamped-release.mjs");
const serviceWorkerPath = join(distPwaDir, "sw.js");
const mainSourcePath = join(rootDir, "pwa", "src", "main.ts");
const displayThemesSourcePath = join(rootDir, "pwa", "src", "DisplayThemes.ts");
const stickvaniaMainSourcePath = join(rootDir, "pwa", "src", "stickvania", "Main.ts");
const browserStorageKeysSourcePath = join(rootDir, "pwa", "src", "stickvania", "BrowserStorageKeys.ts");
const gameStateSchemaSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStateSchema.ts");
const gameStatePreflightSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStatePreflight.ts");
const gameStateSnapshotSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "GameStateSnapshot.ts");
const gameStateSerializerSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "StickvaniaGameStateSerializer.ts");
const gameStateStoreSourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "StickvaniaGameStateStore.ts");
const thingTypeRegistrySourcePath = join(rootDir, "pwa", "src", "stickvania", "persistence", "ThingTypeRegistry.ts");
const inputMappingStorageKey = expectedBrowserStorageKey("input-mapping");
const inputMappingVersion = 5;
const tempRoot = join(rootDir, "scripts", ".verify-pwa-release-temp");
const versionInfo = readVersion();
const cacheVersion = `${versionInfo.version}-${versionInfo.buildStamp}`;
const encodedCacheVersion = encodeURIComponent(cacheVersion);
const slick2dTsCommit = "f80554f5bad1be46f77f58d5a4516a7788c33542";
const defaultPwaScopeUrl = "https://example.test/pwa/";
const relocationPwaScopeUrls = [
    "https://example.invalid/stickvania/pwa/",
    "https://example.invalid/stickvania-staging/pwa/",
    "https://example.invalid/foo/bar/baz/pwa/"
];
const blockedRuntimePathPatterns = [
    { label: "/pwa/", pattern: /(?<!\.)\/pwa\// },
    { label: "/stickvania/", pattern: /(?<!\.)\/stickvania\// },
    { label: "/stickvania-staging/", pattern: /(?<!\.)\/stickvania-staging\// }
];
const releaseTextExtensions = new Set([".css", ".html", ".js", ".json", ".txt", ".webmanifest"]);

test.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
});

function collectFiles(directory) {
    const rootStat = lstatSync(directory);
    if (rootStat.isSymbolicLink()) {
        throw new Error(`Release output must not contain symbolic links or junctions: ${directory}`);
    }
    if (!rootStat.isDirectory()) {
        throw new Error(`Release output must be a directory: ${directory}`);
    }

    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`Release output must not contain symbolic links or junctions: ${fullPath}`);
        }
        if (stat.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (stat.isFile()) {
            files.push(fullPath);
        } else {
            throw new Error(`Release output must not contain special filesystem entries: ${fullPath}`);
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

function expectedPrecacheCacheUrls(scopeUrl = defaultPwaScopeUrl) {
    return expectedPrecacheUrls().map((url) => new URL(url, scopeUrl).href);
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

function builtJavaScript() {
    return collectFiles(distPwaDir)
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
}

function builtPwaIndexHtml() {
    return readFileSync(join(distPwaDir, "index.html"), "utf8");
}

function builtPwaManifest() {
    return JSON.parse(readFileSync(join(distPwaDir, "manifest.webmanifest"), "utf8"));
}

function extractHtmlResourceUrls(html) {
    const urls = [];
    const pattern = /\b(?:href|src)="([^"]+)"/g;
    for (const match of html.matchAll(pattern)) {
        const url = match[1];
        if (!url || url.startsWith("#") || url.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
            continue;
        }
        urls.push(url);
    }
    return urls;
}

function pwaReleaseTextFiles() {
    return collectFiles(distPwaDir).filter((file) => releaseTextExtensions.has(extname(file)));
}

function assertUrlInsideScope(urlText, scopeUrl, label) {
    const scope = new URL(scopeUrl);
    const url = new URL(urlText, scope);
    assert.equal(url.origin, scope.origin, `${label} should stay on the deployment origin.`);
    assert.ok(url.href.startsWith(scope.href), `${label} should resolve under ${scope.href}, got ${url.href}`);
    return url;
}

function expectedScopeCacheId(scopeUrl) {
    return encodeURIComponent(new URL(scopeUrl).pathname);
}

function expectedBrowserStorageScopePath(href = "https://stickvania.invalid/") {
    const url = new URL(href, "https://stickvania.invalid/");
    const pathname = url.pathname || "/";
    if (pathname.endsWith("/")) {
        return pathname;
    }

    const slash = pathname.lastIndexOf("/");
    return slash < 0 ? "/" : pathname.substring(0, slash + 1);
}

function expectedBrowserStorageKey(name, href = "https://stickvania.invalid/") {
    return `stickvania:${encodeURIComponent(expectedBrowserStorageScopePath(href))}:${name}`;
}

function expectedCachePrefix(scopeUrl) {
    return `stickvania-pwa|${expectedScopeCacheId(scopeUrl)}|`;
}

function expectedCacheName(scopeUrl, version = cacheVersion) {
    return `${expectedCachePrefix(scopeUrl)}${version}`;
}

function defaultCacheKeys(scopeUrl = defaultPwaScopeUrl) {
    return [`${expectedCachePrefix(scopeUrl)}old`, expectedCacheName(scopeUrl), "stickvania-pwa-old", "stickvania-old", "unrelated-cache"];
}

function evaluateBuiltServiceWorker(locationVersion = cacheVersion, scopeUrl = defaultPwaScopeUrl, cacheKeys = defaultCacheKeys(scopeUrl)) {
    const events = [];
    const openedCaches = [];
    const addAllCalls = [];
    const cachePuts = [];
    const deletedCaches = [];
    let clientsClaimCount = 0;
    let skipWaitingCount = 0;
    const workerUrl = new URL(`./sw.js?v=${encodeURIComponent(locationVersion)}`, scopeUrl);
    const context = {
        URL,
        console,
        self: {
            location: workerUrl,
            registration: {
                scope: scopeUrl
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
                return Promise.resolve(cacheKeys);
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
this.__scopeCacheId = SCOPE_CACHE_ID;
this.__cachePrefix = CACHE_PREFIX;
this.__cacheName = CACHE_NAME;
this.__precacheCacheUrls = PRECACHE_CACHE_URLS;
this.__canUseCacheApi = canUseCacheApi;
this.__createCacheUrl = createCacheUrl;
`,
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

function builtServiceWorkerCacheUrl(requestOrUrl, locationVersion = cacheVersion, scopeUrl = defaultPwaScopeUrl) {
    return evaluateBuiltServiceWorker(locationVersion, scopeUrl).context.__createCacheUrl(requestOrUrl);
}

async function runBuiltServiceWorkerEvent(type, locationVersion = cacheVersion, scopeUrl = defaultPwaScopeUrl, cacheKeys = defaultCacheKeys(scopeUrl)) {
    const worker = evaluateBuiltServiceWorker(locationVersion, scopeUrl, cacheKeys);
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
    const browserStorageKeysOutputPath = join(outputDirectory, "BrowserStorageKeys.js");
    const outputPath = join(outputDirectory, "ButtonMapping.mjs");
    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(browserStorageKeysSourcePath, browserStorageKeysOutputPath);
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts"), outputPath);

    return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

async function importBrowserStorageKeys() {
    const outputDirectory = join(tempRoot, "browser-storage-keys");
    const outputPath = join(outputDirectory, "BrowserStorageKeys.mjs");
    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(browserStorageKeysSourcePath, outputPath);

    return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

async function importStickvaniaInput() {
    const outputDirectory = join(tempRoot, "stickvania-input");
    const browserStorageKeysOutputPath = join(outputDirectory, "BrowserStorageKeys.js");
    const buttonMappingOutputPath = join(outputDirectory, "ButtonMapping.js");
    const inputOutputPath = join(outputDirectory, "StickvaniaInput.mjs");

    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(outputDirectory, { recursive: true });
    writeTranspiledModule(browserStorageKeysSourcePath, browserStorageKeysOutputPath);
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts"), buttonMappingOutputPath);
    writeTranspiledModule(join(rootDir, "pwa", "src", "stickvania", "StickvaniaInput.ts"), inputOutputPath);

    return import(`${pathToFileURL(inputOutputPath).href}?v=${Date.now()}`);
}

async function importGameStatePreflight() {
    const outputDirectory = join(tempRoot, "game-state-preflight");
    const browserStorageKeysOutputPath = join(outputDirectory, "BrowserStorageKeys.js");
    const persistenceOutputDirectory = join(outputDirectory, "persistence");
    const schemaOutputPath = join(persistenceOutputDirectory, "GameStateSchema.js");
    const preflightOutputPath = join(persistenceOutputDirectory, "GameStatePreflight.mjs");

    rmSync(outputDirectory, { recursive: true, force: true });
    mkdirSync(persistenceOutputDirectory, { recursive: true });
    writeTranspiledModule(browserStorageKeysSourcePath, browserStorageKeysOutputPath);
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

test("package scripts use temporary release stamping for public builds", () => {
    const scripts = packageScripts();

    assert.equal(scripts["build:pwa"], "npm run build:pwa:release");
    assert.equal(scripts["build:pwa:release"], "node scripts/run-stamped-release.mjs --dist .release-components/pwa --clean-dist _build:pwa:release");
    assert.equal(scripts["_build:pwa:release"], "tsc --project pwa/tsconfig.json && vite build --config pwa/vite.config.ts");
    assert.equal(scripts["build:about"], "node scripts/run-stamped-release.mjs --dist .release-components/about --clean-dist _build:about");
    assert.equal(scripts["_build:about"], "node scripts/build-about.mjs");
    assert.equal(scripts.assemble, undefined);
    assert.equal(scripts["_assemble"], "node scripts/assemble.mjs");
    assert.equal(scripts["_verify:pwa-release"], "node scripts/verify-pwa-release.mjs");
    assert.equal(
        scripts["test:pwa-release"],
        "node scripts/run-stamped-release.mjs --dist .release-components/pwa-test --clean-dist _build:pwa:release _verify:pwa-release"
    );
    assert.equal(scripts["verify:desktop-source"], "node scripts/verify-desktop-source.mjs");
    assert.equal(scripts["verify:desktop-release"], "node scripts/verify-desktop-release.mjs");
    assert.equal(scripts["verify:release-tooling"], "node scripts/verify-release-tooling.mjs");
    assert.equal(scripts["verify:dependencies"], "npm audit --audit-level=high");
    assert.equal(
        scripts["build:web"],
        "node scripts/run-stamped-release.mjs --dist .release-components/web --clean-dist _build:pwa:release _build:about build:desktop _assemble verify:desktop-release"
    );
    assert.equal(scripts["build"], "node scripts/build-production.mjs");
    assert.equal(scripts["test:about-page"], "node scripts/test-about-page.mjs");
    assert.equal(scripts["release"], "npm run verify && npm run verify:dependencies && npm run build");
    assert.equal(scripts["release:desktop"], "node scripts/release-desktop.mjs");
    assert.equal(
        scripts["verify"],
        "npm run format:check && npm run lint && npm run test:about-page && npm run verify:release-tooling && npm run test:pwa-release && npm run verify:desktop-source && npm run build:desktop"
    );

    for (const [name, script] of Object.entries(scripts)) {
        if (name === "stamp") {
            continue;
        }
        assert.doesNotMatch(script, /npm run stamp/);
    }

    for (const name of ["build:pwa:release", "build:about", "build:web", "test:pwa-release"]) {
        assert.match(scripts[name], /\.release-components\//);
    }
});

test("PWA pins the palette-capable Slick2D-ts runtime", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
    const expectedDependency = `git+https://github.com/meatfighter/slick2d-ts.git#${slick2dTsCommit}`;

    assert.equal(packageJson.dependencies["slick2d-ts"], expectedDependency);
    assert.equal(packageLock.packages[""].dependencies["slick2d-ts"], expectedDependency);
    assert.match(packageLock.packages["node_modules/slick2d-ts"].resolved, new RegExp(`${slick2dTsCommit}$`));
});

test("PWA display themes remain browser-only presentation state", () => {
    const mainSource = readFileSync(mainSourcePath, "utf8");
    const displayThemesSource = readFileSync(displayThemesSourcePath, "utf8");
    const stickvaniaMainSource = readFileSync(stickvaniaMainSourcePath, "utf8");
    const serializerSource = readFileSync(gameStateSerializerSourcePath, "utf8");

    for (const theme of [
        "amber-monitor",
        "ballpoint",
        "candlelight",
        "charcoal",
        "chalkboard",
        "cyanotype",
        "dark",
        "ditto",
        "lcd",
        "led",
        "light",
        "green-monitor",
        "plasma",
        "twilight",
        "sepia",
        "negative",
        "moonlight",
        "vfd",
        "phantom"
    ]) {
        assert.match(displayThemesSource, new RegExp(`value: "${theme}"`), `DisplayThemes.ts should define ${theme}.`);
    }
    assert.match(mainSource, /id="display-mode-select"/);
    assert.match(mainSource, /const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";/);
    assert.match(mainSource, /createDisplayMonochromePalette\(displayModePreference\)/);
    assert.match(mainSource, /isDisplayModePreference\(value\)/);
    assert.match(mainSource, /getBrowserStorageKey\("display-mode"\)/);
    assert.match(mainSource, /target\.darkDisplayMode = displayModePreference === "dark";/);
    assert.match(mainSource, /target\.displayMonochromePalette = createDisplayMonochromePalette\(displayModePreference\);/);
    assert.match(stickvaniaMainSource, /public displayMonochromePalette:/);
    assert.match(stickvaniaMainSource, /g\.setMonochromePalette\(displayMonochromePalette\.blackReplacement, displayMonochromePalette\.whiteReplacement\);/);
    assert.match(stickvaniaMainSource, /g\.clearMonochromePalette\(\);/);
    assert.match(stickvaniaMainSource, /g\.setColorInverted\(false\);/);
    assert.match(serializerSource, /"darkDisplayMode"/);
    assert.match(serializerSource, /"displayMonochromePalette"/);
});

test("temporary release stamp wrapper restores version.json after success and failure", () => {
    const before = readFileSync(versionPath);
    const success = spawnSync(process.execPath, [releaseStampScriptPath, "stamp"], {
        cwd: rootDir,
        encoding: "utf8"
    });
    assert.equal(success.status, 0, success.stderr);
    assert.deepEqual(readFileSync(versionPath), before);

    const failure = spawnSync(process.execPath, [releaseStampScriptPath, "__missing_release_script_for_test__"], {
        cwd: rootDir,
        encoding: "utf8"
    });
    assert.notEqual(failure.status, 0);
    assert.deepEqual(readFileSync(versionPath), before);
});

test("PWA service worker registration is relative to the current PWA page", () => {
    const mainSource = readFileSync(mainSourcePath, "utf8");

    assert.doesNotMatch(mainSource, /BASE_URL/);
    assert.match(mainSource, /new URL\(`\.\/sw\.js\?v=\$\{version\}`, window\.location\.href\)/);
    assert.match(mainSource, /navigator\.serviceWorker\.register\(serviceWorkerUrl\.href, \{ scope: "\.\/" \}\)/);
});

test("PWA runtime error screen tears down the active game before replacing the UI", () => {
    const mainSource = readFileSync(mainSourcePath, "utf8");

    assert.match(
        mainSource,
        /function showError\(message: string\): void \{\s*destroyGame\(\);\s*showLoadError\("Unable to continue\.", message,/,
        "showError should destroy the active AppGameContainer before showing the retry screen."
    );
});

test("PWA release output uses relocatable relative URLs", () => {
    const html = builtPwaIndexHtml();
    const manifest = builtPwaManifest();
    const htmlResourceUrls = extractHtmlResourceUrls(html);
    assert.ok(htmlResourceUrls.length > 0, "Built PWA index should contain resource URLs to verify.");

    for (const scopeUrl of relocationPwaScopeUrls) {
        for (const resourceUrl of htmlResourceUrls) {
            assertUrlInsideScope(resourceUrl, scopeUrl, `PWA index resource ${resourceUrl}`);
        }

        assert.equal(new URL(manifest.id, scopeUrl).href, scopeUrl);
        assert.equal(new URL(manifest.scope, scopeUrl).href, scopeUrl);

        const startUrl = assertUrlInsideScope(manifest.start_url, scopeUrl, "manifest start_url");
        assert.equal(startUrl.searchParams.get("v"), cacheVersion);

        for (const icon of manifest.icons) {
            const iconUrl = assertUrlInsideScope(icon.src, scopeUrl, `manifest icon ${icon.src}`);
            assert.equal(iconUrl.searchParams.get("v"), cacheVersion);
        }

        for (const precacheUrl of actualPrecacheUrls()) {
            assertUrlInsideScope(precacheUrl, scopeUrl, `precache URL ${precacheUrl}`);
        }
    }
});

test("PWA release output does not contain hard-coded deployment paths", () => {
    for (const file of pwaReleaseTextFiles()) {
        const text = readFileSync(file, "utf8");
        const relativeFile = relative(rootDir, file).replaceAll("\\", "/");
        for (const blocked of blockedRuntimePathPatterns) {
            assert.equal(blocked.pattern.test(text), false, `${relativeFile} should not contain hard-coded deployment path ${blocked.label}`);
        }
    }
});

test("PWA third-party notice contains no provisional pre-release instructions", () => {
    const notice = readFileSync(join(distPwaDir, "THIRD_PARTY_NOTICES.txt"), "utf8");

    assert.match(notice, /slick2d-ts/, "The PWA notice should identify its browser runtime dependency.");
    assert.doesNotMatch(notice, /Before publishing a binary desktop release/i);
    assert.doesNotMatch(notice, /should be treated .* verified against the source package/i);
    assert.doesNotMatch(notice, /verify the exact source and license text/i);
});

test("PWA service worker embeds its own cache version", async () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const worker = evaluateBuiltServiceWorker("old-release");

    assert.match(serviceWorker, new RegExp(`const VERSION = ${JSON.stringify(cacheVersion).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
    assert.match(serviceWorker, /const CACHE_PREFIX = `stickvania-pwa\|\$\{SCOPE_CACHE_ID\}\|`;/);
    assert.doesNotMatch(serviceWorker, /__SERVICE_WORKER_VERSION__/);
    assert.doesNotMatch(serviceWorker, /self\.location\.href/);
    assert.doesNotMatch(serviceWorker, /skipWaiting/);
    assert.equal(worker.context.__serviceWorkerVersion, cacheVersion);
    assert.equal(worker.context.__scopeCacheId, expectedScopeCacheId(defaultPwaScopeUrl));
    assert.equal(worker.context.__cachePrefix, expectedCachePrefix(defaultPwaScopeUrl));
    assert.equal(worker.context.__cacheName, expectedCacheName(defaultPwaScopeUrl));

    const installedWorker = await runBuiltServiceWorkerEvent("install", "old-release");
    assert.deepEqual(installedWorker.openedCaches, [expectedCacheName(defaultPwaScopeUrl)]);
    assert.deepEqual(installedWorker.addAllCalls, [expectedPrecacheCacheUrls()]);
    assert.equal(installedWorker.skipWaitingCount, 0);
});

test("PWA service worker cache scope IDs preserve encoded deployment paths", () => {
    const scopeUrls = [
        "https://example.test/a/b/",
        "https://example.test/a_b/",
        "https://example.test/a+b/",
        "https://example.test/a/pwa/",
        "https://example.test/a/pwa/-stage/pwa/",
        "https://example.test/%25/",
        "https://example.test/_2525/",
        "https://example.test/%2F/",
        "https://example.test/_252F/"
    ];
    const scopeIds = scopeUrls.map(expectedScopeCacheId);

    assert.equal(new Set(scopeIds).size, scopeIds.length);

    for (const scopeUrl of scopeUrls) {
        assert.equal(evaluateBuiltServiceWorker(cacheVersion, scopeUrl).context.__scopeCacheId, expectedScopeCacheId(scopeUrl));
    }
});

test("PWA service worker activation removes only same-scope superseded caches", async () => {
    const stagingScope = "https://example.test/staging/pwa/";
    const productionScope = "https://example.test/production/pwa/";
    const stagingOldCache = `${expectedCachePrefix(stagingScope)}old-release`;
    const stagingCurrentCache = expectedCacheName(stagingScope);
    const productionOldCache = `${expectedCachePrefix(productionScope)}old-release`;
    const productionCurrentCache = expectedCacheName(productionScope);
    const worker = await runBuiltServiceWorkerEvent("activate", "old-release", stagingScope, [
        stagingOldCache,
        stagingCurrentCache,
        productionOldCache,
        productionCurrentCache,
        "stickvania-pwa-old-global",
        "stickvania-old-global",
        "unrelated-cache"
    ]);

    assert.deepEqual(worker.deletedCaches, [stagingOldCache]);
    assert.equal(worker.deletedCaches.includes(stagingCurrentCache), false);
    assert.equal(worker.deletedCaches.includes(productionOldCache), false);
    assert.equal(worker.deletedCaches.includes(productionCurrentCache), false);
    assert.equal(worker.deletedCaches.includes("stickvania-pwa-old-global"), false);
    assert.equal(worker.deletedCaches.includes("stickvania-old-global"), false);
    assert.equal(worker.deletedCaches.includes("unrelated-cache"), false);
    assert.equal(worker.clientsClaimCount, 1);
});

test("PWA service worker activation keeps hyphen-neighboring scope caches isolated", async () => {
    const primaryScope = "https://example.test/a/pwa/";
    const nestedScope = "https://example.test/a/pwa/-stage/pwa/";
    const primaryOldCache = `${expectedCachePrefix(primaryScope)}old-release`;
    const primaryCurrentCache = expectedCacheName(primaryScope);
    const nestedOldCache = `${expectedCachePrefix(nestedScope)}old-release`;
    const nestedCurrentCache = expectedCacheName(nestedScope);
    const cacheKeys = [primaryOldCache, primaryCurrentCache, nestedOldCache, nestedCurrentCache, "unrelated-cache"];

    const primaryWorker = await runBuiltServiceWorkerEvent("activate", "old-release", primaryScope, cacheKeys);
    assert.deepEqual(primaryWorker.deletedCaches, [primaryOldCache]);
    assert.equal(primaryWorker.deletedCaches.includes(nestedOldCache), false);
    assert.equal(primaryWorker.deletedCaches.includes(nestedCurrentCache), false);

    const nestedWorker = await runBuiltServiceWorkerEvent("activate", "old-release", nestedScope, cacheKeys);
    assert.deepEqual(nestedWorker.deletedCaches, [nestedOldCache]);
    assert.equal(nestedWorker.deletedCaches.includes(primaryOldCache), false);
    assert.equal(nestedWorker.deletedCaches.includes(primaryCurrentCache), false);
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

test("PWA service worker handles only same-origin requests under its own scope", () => {
    const scopeUrl = "https://example.test/staging/pwa/";
    const worker = evaluateBuiltServiceWorker(cacheVersion, scopeUrl);
    const canUseCacheApi = worker.context.__canUseCacheApi;

    assert.equal(canUseCacheApi({ method: "GET", url: new URL("./images/icon.png", scopeUrl).href }), true);
    assert.equal(canUseCacheApi({ method: "GET", url: "https://example.test/staging/other/icon.png" }), false);
    assert.equal(canUseCacheApi({ method: "GET", url: "https://example.test/production/pwa/images/icon.png" }), false);
    assert.equal(canUseCacheApi({ method: "GET", url: "https://cdn.example.test/staging/pwa/images/icon.png" }), false);
    assert.equal(canUseCacheApi({ method: "POST", url: new URL("./images/icon.png", scopeUrl).href }), false);
});

test("PWA service worker precache keys include the current cache version", () => {
    for (const url of actualPrecacheUrls()) {
        assert.equal(new URL(url, defaultPwaScopeUrl).searchParams.get("v"), cacheVersion);
    }
});

test("PWA service worker release cache is install-time immutable", () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");

    assert.doesNotMatch(serviceWorker, /function remember/);
    assert.doesNotMatch(serviceWorker, /cache\.put/);
    assert.doesNotMatch(serviceWorker, /__remember/);
});

test("PWA browser storage keys are scoped to the deployed path", async () => {
    const { getBrowserStorageKey, getBrowserStorageScopePath } = await importBrowserStorageKeys();
    const productionUrl = "https://example.test/stickvania/?v=one";
    const productionCacheBustUrl = "https://example.test/stickvania/?v=two";
    const stagingUrl = "https://example.test/stickvania-staging/?v=one";
    const productionIndexUrl = "https://example.test/stickvania/index.html?v=one";
    const names = ["game-state", "volume", "display-mode", "rumble", "difficulty", "input-mapping"];

    assert.equal(getBrowserStorageScopePath(productionUrl), "/stickvania/");
    assert.equal(getBrowserStorageScopePath(productionIndexUrl), "/stickvania/");

    for (const name of names) {
        assert.equal(getBrowserStorageKey(name, productionUrl), expectedBrowserStorageKey(name, productionUrl));
        assert.equal(getBrowserStorageKey(name, productionUrl), getBrowserStorageKey(name, productionCacheBustUrl));
        assert.notEqual(getBrowserStorageKey(name, productionUrl), getBrowserStorageKey(name, stagingUrl));
    }
});

test("PWA browser storage source uses scoped keys for saves and preferences", () => {
    const sources = [
        mainSourcePath,
        browserStorageKeysSourcePath,
        join(rootDir, "pwa", "src", "stickvania", "ButtonMapping.ts"),
        join(rootDir, "pwa", "src", "stickvania", "Main.ts"),
        gameStateSchemaSourcePath
    ];
    const sourceText = sources.map((sourcePath) => readFileSync(sourcePath, "utf8")).join("\n");
    const legacyKeys = [
        "stickvania-volume",
        "stickvania-display-mode",
        "stickvania-rumble",
        "stickvania.input-mapping",
        "stickvania.difficulty",
        "stickvania.game-state"
    ];

    for (const legacyKey of legacyKeys) {
        assert.doesNotMatch(sourceText, new RegExp(legacyKey.replaceAll(".", "\\.")));
    }

    assert.match(sourceText, /getBrowserStorageKey\("volume"\)/);
    assert.match(sourceText, /getBrowserStorageKey\("display-mode"\)/);
    assert.match(sourceText, /getBrowserStorageKey\("rumble"\)/);
    assert.match(sourceText, /getBrowserStorageKey\("input-mapping"\)/);
    assert.match(sourceText, /getBrowserStorageKey\("difficulty"\)/);
    assert.match(sourceText, /getBrowserStorageKey\("game-state"\)/);
});

test("PWA game-state Thing type IDs are stable through production minification", () => {
    const schemaSource = readFileSync(gameStateSchemaSourcePath, "utf8");
    const snapshotSource = readFileSync(gameStateSnapshotSourcePath, "utf8");
    const registrySource = readFileSync(thingTypeRegistrySourcePath, "utf8");
    const serializerSource = readFileSync(gameStateSerializerSourcePath, "utf8");
    const mainSource = readFileSync(mainSourcePath, "utf8");
    const builtSource = builtJavaScript();

    assert.match(schemaSource, /export const GAME_STATE_STORAGE_KEY = getBrowserStorageKey\("game-state"\);/);
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

test("PWA root-menu preflight preserves future-version saved games", async () => {
    const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION, hasPotentialStoredStickvaniaGameState } = await importGameStatePreflight();
    const storage = createLocalStorageMock();
    const futureSnapshot = validPotentialGameStateSnapshot(GAME_STATE_VERSION + 1);

    storage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(futureSnapshot));

    assert.equal(hasPotentialStoredStickvaniaGameState(storage), false);
    assert.equal(storage.getItem(GAME_STATE_STORAGE_KEY), JSON.stringify(futureSnapshot));
});

test("PWA Continue launch failures preserve saved games", () => {
    const mainSource = readFileSync(mainSourcePath, "utf8");
    const storeSource = readFileSync(gameStateStoreSourcePath, "utf8");
    const mainClearCalls = [...mainSource.matchAll(/\bclearStoredGameState\(\);/g)].map((match) => match.index ?? -1);
    const newGameClearIndex = mainSource.indexOf("newGameButton.addEventListener");

    assert.equal(mainClearCalls.length, 1, "The PWA shell should only clear saved game state from the New Game action.");
    assert.ok(newGameClearIndex >= 0 && mainClearCalls[0] > newGameClearIndex, "The remaining shell save clear should stay in the New Game handler.");
    assert.match(mainSource, /void startGame\(restoreSavedGame\);/, "Load-error Retry should preserve the original New Game or Continue intent.");
    assert.match(
        storeSource,
        /console\.warn\("Unable to restore Stickvania game state\.", error\);\s*return false;\s*}\s*}\s*public hasValidSave/,
        "Restore-time exceptions should return false without deleting the stored save."
    );
});

test("PWA root-menu preflight clears only the selected deployment save", async () => {
    const { GAME_STATE_VERSION, hasPotentialStoredStickvaniaGameState } = await importGameStatePreflight();
    const storage = createLocalStorageMock();
    const stagingStorageKey = expectedBrowserStorageKey("game-state", "https://example.test/stickvania-staging/");
    const productionStorageKey = expectedBrowserStorageKey("game-state", "https://example.test/stickvania/");

    storage.setItem(stagingStorageKey, "{");
    storage.setItem(productionStorageKey, JSON.stringify(validPotentialGameStateSnapshot(GAME_STATE_VERSION)));

    assert.equal(hasPotentialStoredStickvaniaGameState(storage, stagingStorageKey), false);
    assert.equal(storage.getItem(stagingStorageKey), null);
    assert.notEqual(storage.getItem(productionStorageKey), null);
    assert.equal(hasPotentialStoredStickvaniaGameState(storage, productionStorageKey), true);
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
